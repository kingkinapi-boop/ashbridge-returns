// The job queue for workers (decision 0007). Many workers (cloud sessions,
// routines, local helpers) pull jobs; a claim file on the branch
// `claude/claims` makes sure no two take the same job. Git itself is the lock:
// a claim is a commit pushed on top of the branch tip; if another worker
// pushed first, the push is refused, and we wait a jittered, growing time,
// re-read and try again (at most 6 tries).
// The working tree and HEAD are never touched (git plumbing only).
//
// Jobs, in priority order: check (a reported build needs an independent
// check), build (a card with its spec commit, every dep done), spec (a card with no spec
// yet, every dep done or with a reported build). Parked cards and cards with a parked dep
// are never offered a build or a spec. Checks are not gated by deps.
// A worker never checks a card it built or spec'd.
//
// Usage:
//   node tools/claim.mjs next --worker <name> [--roles check,build,spec]
//        prints "CLAIMED <card> <role>" (exit 0), "NOTHING" (exit 4) or "PAUSED <mode>" (exit 3)
//        After mode.wind_down_at no new build is handed out; checks and specs still flow.
//   node tools/claim.mjs update <card> <role> <state> --worker <name> [--note text] [--commit sha]
//        state: working | reported | failed | released | reopened. A spec-writer reports
//        with --commit <spec commit>. Only the worker holding a claim may update it
//        (the Lead, --worker lead, may update any; exit 6 otherwise). A checker that
//        FAILS a card (`update <card> check failed`) writes the check and puts the
//        build on `hold-findings` in ONE push; the queue does not reopen the build
//        until the Lead runs `update <card> build reopened --worker lead` after the
//        (`update <card> spec reopened --worker lead` likewise reopens a spec once the
//        findings review has added tests; no other worker or role may reopen)
//        findings review. After 3 failed builds a card is not handed out again until
//        the Lead parks or re-cards it.
//   node tools/claim.mjs beat <card> <role> --worker <name>
//        heartbeat: refreshes the claim's timestamp. A working claim with no beat
//        and no update for 90 minutes is stale and can be taken again.
//   node tools/claim.mjs list            all claims, one per line, with minutes since the last beat
//
// Tests pin the clock with CLAIMS_NOW (ISO time) and shorten the backoff with CLAIMS_BACKOFF_MS.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT, pathsOverlap, depGate } from './lib.mjs'

const BRANCH = 'claude/claims'
const REMOTE = process.env.CLAIMS_REMOTE || 'origin'
const STALE_MIN = 90
const MAX_TRIES = 6
// Working claims allowed at once, and which jobs, by mode (decision 0007).
// prep: specs only. wind-down: checks only, to land what is in flight.
const CAPS = { pause: 0, hold: 0, prep: 2, normal: 2, 'wind-down': 4 }
const ROLES = { prep: ['spec'], 'wind-down': ['check'] }
const MAX_ROUNDS = 3
// Cloud sessions may have no git identity; claims still need an author.
const ID = { GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'returns-worker', GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'worker@ashbridge-returns.invalid', GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'returns-worker', GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'worker@ashbridge-returns.invalid' }

const nowMs = () => (process.env.CLAIMS_NOW ? Date.parse(process.env.CLAIMS_NOW) : Date.now())
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
// Exponential backoff with full jitter: a random wait up to base * 2^(try-1).
const backoff = (attempt) => sleep(Math.floor(Math.random() * Number(process.env.CLAIMS_BACKOFF_MS || 250) * 2 ** (attempt - 1)))

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

// One ls-tree and one cat-file --batch: every claim in a single pass.
function readClaims(tip) {
  const claims = []
  if (!tip) return claims
  const shas = (tryGit(['ls-tree', '-r', tip, 'claims/']) || '')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(/\s+/)[2])
  if (!shas.length) return claims
  const raw = execFileSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: shas.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 })
  let pos = 0
  while (pos < raw.length) {
    const nl = raw.indexOf(10, pos)
    if (nl < 0) break
    const [, type, size] = raw.toString('utf8', pos, nl).split(' ')
    const n = Number(size)
    if (type === 'blob') {
      try {
        claims.push(JSON.parse(raw.toString('utf8', nl + 1, nl + 1 + n)))
      } catch {}
    }
    pos = nl + 1 + n + 1
  }
  return claims
}

// Last sign of life: the later of the claim's write time and its heartbeat.
const lastSeen = (c) => Math.max(Date.parse(c.at) || 0, Date.parse(c.beat) || 0)
const isStale = (c) => c.state === 'working' && nowMs() - lastSeen(c) > STALE_MIN * 60000
const isActive = (c) => (c.state === 'working' || c.state === 'reported') && !isStale(c)

// Write claims/<file> (one or several, in ONE commit) on top of the claims branch tip and push.
// `files` is { name: object }. A refused push (someone else pushed first) waits a
// jittered, growing time, re-fetches and returns 'retry'; after 6 tries it returns false.
function writeClaims(files, attempt = 1) {
  const tip = claimsTip()
  const index = path.join(os.tmpdir(), `claims-index-${process.pid}-${attempt}`)
  const env = { ...process.env, ...ID, GIT_INDEX_FILE: index }
  const run = (a, input) => execFileSync('git', a, { cwd: ROOT, env, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  try {
    if (tip) run(['read-tree', tip])
    else run(['read-tree', '--empty'])
    const names = Object.keys(files)
    for (const f of names) {
      const blob = run(['hash-object', '-w', '--stdin'], JSON.stringify(files[f], null, 1) + '\n')
      run(['update-index', '--add', '--cacheinfo', `100644,${blob},claims/${f}`])
    }
    const tree = run(['write-tree'])
    const parent = tip ? ['-p', tip] : []
    const first = files[names[0]]
    const commit = run(['commit-tree', tree, ...parent, '-m', `${first.state} ${first.card} ${first.role} (${first.worker})`])
    try {
      git(['push', '-q', REMOTE, `${commit}:refs/heads/${BRANCH}`])
      git(['update-ref', `refs/remotes/${REMOTE}/${BRANCH}`, commit])
      return true
    } catch {
      if (attempt >= MAX_TRIES) return false
      backoff(attempt)
      fetchAll()
      return 'retry'
    }
  } finally {
    fs.rmSync(index, { force: true })
  }
}
const writeClaim = (file, obj, attempt) => writeClaims({ [file]: obj }, attempt)

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
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    fetchAll()
    const mode = modeNow()
    const cap = mode.mode === 'turbo' ? Number(mode.max_workers || 16) : CAPS[mode.mode] ?? 0
    const { cards } = JSON.parse(readMain('plan/slices.json'))
    const claims = readClaims(claimsTip())
    const active = claims.filter(isActive)
    if (cap === 0) return out(`PAUSED ${mode.mode}`, 3)
    if (active.filter((c) => c.state === 'working').length >= cap) return out(`PAUSED ${mode.mode} (cap ${cap} reached)`, 3)

    const status = Object.fromEntries(cards.map((c) => [c.id, c.status]))
    const reportedBuilds = new Set(claims.filter((c) => c.role === 'build' && c.state === 'reported').map((c) => c.card))
    const claimFor = (id, role) => claims.find((c) => c.card === id && c.role === role)
    // Paths are held by working specs and by builds until the Lead merges them; a card never blocks itself.
    const holds = (c) => c.role === 'build' || (c.role === 'spec' && c.state === 'working')
    const busyFor = (id) => active.filter((c) => holds(c) && c.card !== id).flatMap((c) => (cards.find((k) => k.id === c.card) || {}).paths || [])
    let allowed = ROLES[mode.mode] ? roles.filter((r) => ROLES[mode.mode].includes(r)) : roles
    // Past wind_down_at no new build starts; checks and specs still flow.
    if (mode.wind_down_at && nowMs() > Date.parse(mode.wind_down_at)) allowed = allowed.filter((r) => r !== 'build')

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
          const reopened = s && s.state === 'reopened'
          const specReady = (c.spec && !reopened) || (s && s.state === 'reported' && s.commit)
          if (!specReady || !depGate(c, 'build', status, reportedBuilds).ok) continue
          const b = claimFor(c.id, 'build')
          if (b && isActive(b)) continue
          if (b && b.state === 'hold-findings') continue // waits for the Lead's findings review
          if (b && b.state === 'failed' && (b.round || 1) >= MAX_ROUNDS) continue
          if (s && s.worker === worker && c.spec !== 'n/a') continue
          if (pathsOverlap(c.paths || [], busyFor(c.id))) continue
          pick = { card: c.id, role, round: (b?.round || 0) + 1, spec: (reopened ? s.commit : c.spec) || s.commit }
          break
        }
        if (role === 'spec') {
          const s = claimFor(c.id, 'spec')
          if (c.spec && !(s && s.state === 'reopened')) continue
          if (!depGate(c, 'spec', status, reportedBuilds).ok) continue
          if (s && (isActive(s) || s.state === 'reported')) continue
          pick = { card: c.id, role }
          break
        }
      }
    }
    if (!pick) return out('NOTHING', 4)
    const claim = { ...pick, worker, state: 'working', at: new Date(nowMs()).toISOString(), mode: mode.mode }
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

const STATES = ['working', 'reported', 'failed', 'released', 'reopened']

function update() {
  const [, card, role, state] = args
  if (!card || !role || !STATES.includes(state)) return out('usage: update <card> <role> <working|reported|failed|released|reopened> --worker <name>', 2)
  const worker = opt('worker', 'unknown')
  if (state === 'reopened' && (worker !== 'lead' || !['build', 'spec'].includes(role))) return out('REFUSED: only --worker lead may reopen a build or a spec', 6)
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    fetchAll()
    const claims = readClaims(claimsTip())
    const find = (r) => claims.find((c) => c.card === card && c.role === r)
    const prev = find(role) || {}
    if (prev.worker && prev.worker !== worker && worker !== 'lead') return out(`REFUSED: ${card} ${role} is held by ${prev.worker}, not ${worker}`, 6)
    const at = new Date(nowMs()).toISOString()
    // The Lead updating someone else's claim leaves the holder's name on it.
    const obj = { ...prev, card, role, state, worker: prev.worker || worker, at, note: opt('note', prev.note), commit: opt('commit', prev.commit) }
    const files = { [`${card}.${role}.json`]: obj }
    // A check FAIL: one push writes the failed check and holds the build for the findings review.
    const held = role === 'check' && state === 'failed' ? find('build') : null
    if (held) files[`${card}.build.json`] = { ...held, state: 'hold-findings', at, note: opt('note', held.note) }
    const res = writeClaims(files, attempt)
    if (res === true) {
      if (state !== 'working') setCurrentJob(null)
      return out(`UPDATED ${card} ${role} ${state}${held ? ' (build on hold-findings)' : ''}`, 0)
    }
    if (res === false) break
  }
  return out('RACE: gave up after 6 tries', 5)
}

function beat() {
  const [, card, role] = args
  const worker = opt('worker', 'unknown')
  if (!card || !role) return out('usage: beat <card> <role> --worker <name>', 2)
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    fetchAll()
    const prev = readClaims(claimsTip()).find((c) => c.card === card && c.role === role)
    if (!prev) return out(`REFUSED: no claim for ${card} ${role}`, 6)
    if (prev.worker !== worker && worker !== 'lead') return out(`REFUSED: ${card} ${role} is held by ${prev.worker}, not ${worker}`, 6)
    const res = writeClaims({ [`${card}.${role}.json`]: { ...prev, beat: new Date(nowMs()).toISOString() } }, attempt)
    if (res === true) return out(`BEAT ${card} ${role}`, 0)
    if (res === false) break
  }
  return out('RACE: gave up after 6 tries', 5)
}

function list() {
  fetchAll()
  const claims = readClaims(claimsTip())
  if (!claims.length) return out('no claims', 0)
  for (const c of claims.sort((a, b) => a.at.localeCompare(b.at))) {
    const age = Math.round((nowMs() - lastSeen(c)) / 60000)
    const tag = isStale(c) ? ' (stale)' : isActive(c) || c.state === 'hold-findings' ? '' : ' (inactive)'
    console.log(`${c.card} ${c.role} ${c.state}${tag} | ${c.worker} | ${age} min since last beat${c.note ? ' | ' + c.note : ''}`)
  }
  return 0
}

function out(line, code) {
  console.log(line)
  return code
}

const code = cmd === 'next' ? next() : cmd === 'update' ? update() : cmd === 'beat' ? beat() : cmd === 'list' ? list() : out('usage: node tools/claim.mjs next|update|beat|list', 2)
process.exit(code)
