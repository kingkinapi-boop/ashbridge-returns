// The job queue for workers (decision 0007). Many workers (cloud sessions,
// routines, local helpers) pull jobs; a claim file on the branch
// `claude/claims` makes sure no two take the same job. Git itself is the lock:
// a claim is a commit pushed on top of the branch tip; if another worker
// pushed first, the push is refused, and we re-read and try again.
// The working tree and HEAD are never touched (git plumbing only).
//
// Jobs, in priority order: check (a reported build needs an independent
// check), build (a card with its spec commit), spec (a card with no spec yet).
// A worker never checks a card it built or spec'd.
//
// Usage:
//   node tools/claim.mjs next --worker <name> [--roles check,build,spec]
//        prints "CLAIMED <card> <role>" (exit 0), "NOTHING" (exit 4) or "PAUSED <mode>" (exit 3)
//   node tools/claim.mjs update <card> <role> <state> --worker <name> [--note text] [--commit sha]
//        state: working | reported | failed | released. A spec-writer reports
//        with --commit <spec commit>; a checker that fails a card also sets the
//        card's build claim to failed. After 3 failed builds a card is
//        not handed out again until the Lead parks or re-cards it.
//   node tools/claim.mjs list            active claims, one per line
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT, pathsOverlap } from './lib.mjs'

const BRANCH = 'claude/claims'
const REMOTE = process.env.CLAIMS_REMOTE || 'origin'
const STALE_MIN = 90
// Working claims allowed at once, and which jobs, by mode (decision 0007).
// prep: specs only. wind-down: checks only, to land what is in flight.
const CAPS = { pause: 0, hold: 0, prep: 2, normal: 2, 'wind-down': 4 }
const ROLES = { prep: ['spec'], 'wind-down': ['check'] }
const MAX_ROUNDS = 3
// Cloud sessions may have no git identity; claims still need an author.
const ID = { GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'returns-worker', GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'worker@ashbridge-returns.invalid', GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'returns-worker', GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'worker@ashbridge-returns.invalid' }

const args = process.argv.slice(2)
const cmd = args[0]
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const git = (a, input) =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] }).trim()
const tryGit = (a) => {
  try {
    return git(a)
  } catch {
    return null
  }
}

function fetchAll() {
  tryGit(['fetch', '-q', REMOTE, 'main'])
  tryGit(['fetch', '-q', REMOTE, `+refs/heads/${BRANCH}:refs/remotes/${REMOTE}/${BRANCH}`])
}
const mainRef = () => (tryGit(['rev-parse', '--verify', '-q', `${REMOTE}/main`]) ? `${REMOTE}/main` : 'main')
const claimsTip = () => tryGit(['rev-parse', '--verify', '-q', `refs/remotes/${REMOTE}/${BRANCH}`])

function readMain(rel) {
  return git(['show', `${mainRef()}:${rel}`])
}

function readClaims(tip) {
  const claims = []
  if (!tip) return claims
  const names = (tryGit(['ls-tree', '-r', '--name-only', tip, 'claims/']) || '').split('\n').filter(Boolean)
  for (const n of names) {
    try {
      claims.push(JSON.parse(git(['show', `${tip}:${n}`])))
    } catch {}
  }
  return claims
}

const isActive = (c) => (c.state === 'working' || c.state === 'reported') && !(c.state === 'working' && Date.now() - Date.parse(c.at) > STALE_MIN * 60000)

// Write claims/<file> on top of the claims branch tip and push; retry on a race.
function writeClaim(file, obj, attempt = 1) {
  const tip = claimsTip()
  const index = path.join(os.tmpdir(), `claims-index-${process.pid}-${attempt}`)
  const env = { ...process.env, ...ID, GIT_INDEX_FILE: index }
  const run = (a, input) => execFileSync('git', a, { cwd: ROOT, env, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  try {
    if (tip) run(['read-tree', tip])
    else run(['read-tree', '--empty'])
    const blob = run(['hash-object', '-w', '--stdin'], JSON.stringify(obj, null, 1) + '\n')
    run(['update-index', '--add', '--cacheinfo', `100644,${blob},claims/${file}`])
    const tree = run(['write-tree'])
    const parent = tip ? ['-p', tip] : []
    const commit = run(['commit-tree', tree, ...parent, '-m', `${obj.state} ${obj.card} ${obj.role} (${obj.worker})`])
    try {
      git(['push', '-q', REMOTE, `${commit}:refs/heads/${BRANCH}`])
      git(['update-ref', `refs/remotes/${REMOTE}/${BRANCH}`, commit])
      return true
    } catch {
      if (attempt >= 6) return false
      fetchAll()
      return 'retry'
    }
  } finally {
    fs.rmSync(index, { force: true })
  }
}


// The protect-spec hook reads this to know whether we are building or checking.
function setCurrentJob(job) {
  try {
    const gitDir = path.resolve(ROOT, git(['rev-parse', '--git-dir']))
    const file = path.join(gitDir, 'current-job.json')
    if (job) fs.writeFileSync(file, JSON.stringify(job))
    else fs.rmSync(file, { force: true })
  } catch {}
}

function modeNow() {
  try {
    return JSON.parse(readMain('plan/mode.json'))
  } catch {
    return { mode: 'prep' }
  }
}

function next() {
  const worker = opt('worker', `${os.hostname()}-${process.pid}`)
  const roles = opt('roles', 'check,build,spec').split(',')
  for (let attempt = 1; attempt <= 6; attempt++) {
    fetchAll()
    const mode = modeNow()
    const cap = mode.mode === 'turbo' ? Number(mode.max_workers || 16) : CAPS[mode.mode] ?? 0
    const { cards } = JSON.parse(readMain('plan/slices.json'))
    const claims = readClaims(claimsTip())
    const active = claims.filter(isActive)
    if (cap === 0) return out(`PAUSED ${mode.mode}`, 3)
    if (active.filter((c) => c.state === 'working').length >= cap) return out(`PAUSED ${mode.mode} (cap ${cap} reached)`, 3)

    const status = Object.fromEntries(cards.map((c) => [c.id, c.status]))
    const depsDone = (c) => (c.deps || []).every((d) => status[d] === 'done')
    const claimFor = (id, role) => claims.find((c) => c.card === id && c.role === role)
    // Paths are held by working specs and by builds until the Lead merges them; a card never blocks itself.
    const holds = (c) => c.role === 'build' || (c.role === 'spec' && c.state === 'working')
    const busyFor = (id) => active.filter((c) => holds(c) && c.card !== id).flatMap((c) => (cards.find((k) => k.id === c.card) || {}).paths || [])
    const allowed = ROLES[mode.mode] ? roles.filter((r) => ROLES[mode.mode].includes(r)) : roles

    let pick = null
    for (const role of ['check', 'build', 'spec']) {
      if (!allowed.includes(role) || pick) continue
      for (const c of cards) {
        if (['done', 'parked', 'todo'].includes(c.status)) continue
        if (role === 'check') {
          const b = claimFor(c.id, 'build')
          const ck = claimFor(c.id, 'check')
          if (!b || b.state !== 'reported' || b.worker === worker) continue
          if (ck && (isActive(ck) || ck.for === b.at)) continue
          const s = claimFor(c.id, 'spec')
          if (s && s.worker === worker) continue
          pick = { card: c.id, role, for: b.at }
          break
        }
        if (role === 'build') {
          const s = claimFor(c.id, 'spec')
          const specReady = c.spec || (s && s.state === 'reported' && s.commit)
          if (!specReady || !depsDone(c)) continue
          const b = claimFor(c.id, 'build')
          if (b && isActive(b)) continue
          if (b && b.state === 'failed' && (b.round || 1) >= MAX_ROUNDS) continue
          if (s && s.worker === worker && c.spec !== 'n/a') continue
          if (pathsOverlap(c.paths || [], busyFor(c.id))) continue
          pick = { card: c.id, role, round: (b?.round || 0) + 1, spec: c.spec || s.commit }
          break
        }
        if (role === 'spec') {
          if (c.spec) continue
          const s = claimFor(c.id, 'spec')
          if (s && (isActive(s) || s.state === 'reported')) continue
          pick = { card: c.id, role }
          break
        }
      }
    }
    if (!pick) return out('NOTHING', 4)
    const claim = { ...pick, worker, state: 'working', at: new Date().toISOString(), mode: mode.mode }
    const file = `${pick.card}.${pick.role}.json`
    const res = writeClaim(file, claim, attempt)
    if (res === true) {
      setCurrentJob({ card: pick.card, role: pick.role, worker })
      return out(`CLAIMED ${pick.card} ${pick.role}`, 0)
    }
    if (res === false) return out('RACE: gave up after 6 tries', 5)
  }
  return out('RACE: gave up after 6 tries', 5)
}

function update() {
  const [, card, role, state] = args
  if (!card || !role || !['working', 'reported', 'failed', 'released'].includes(state)) return out('usage: update <card> <role> <working|reported|failed|released> --worker <name>', 2)
  for (let attempt = 1; attempt <= 6; attempt++) {
    fetchAll()
    const prev = readClaims(claimsTip()).find((c) => c.card === card && c.role === role) || {}
    const obj = { ...prev, card, role, state, worker: opt('worker', prev.worker || 'unknown'), at: new Date().toISOString(), note: opt('note', prev.note), commit: opt('commit', prev.commit) }
    const res = writeClaim(`${card}.${role}.json`, obj, attempt)
    if (res === true) {
      if (state !== 'working') setCurrentJob(null)
      return out(`UPDATED ${card} ${role} ${state}`, 0)
    }
    if (res === false) break
  }
  return out('RACE: gave up after 6 tries', 5)
}

function list() {
  fetchAll()
  const claims = readClaims(claimsTip())
  if (!claims.length) return out('no claims', 0)
  for (const c of claims.sort((a, b) => a.at.localeCompare(b.at))) {
    const age = Math.round((Date.now() - Date.parse(c.at)) / 60000)
    console.log(`${c.card} ${c.role} ${c.state}${isActive(c) ? '' : ' (inactive)'} | ${c.worker} | ${age} min ago${c.note ? ' | ' + c.note : ''}`)
  }
  return 0
}

function out(line, code) {
  console.log(line)
  return code
}

const code = cmd === 'next' ? next() : cmd === 'update' ? update() : cmd === 'list' ? list() : out('usage: node tools/claim.mjs next|update|list', 2)
process.exit(code)
