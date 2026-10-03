// CQ8 acceptance tests (ARC-15): next.mjs and claim.mjs agree on path holds, and the Lead can reopen a check (A439).
// tools against a bare remote and a clone, the clock pinned with CLAIMS_NOW, every child process async (A247).
// Pattern of claim-needs-lead.test.mjs. The held-paths line next.mjs prints is `<card> waiting on paths: <holder>` (amber).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const T0 = '2026-10-02T12:00:00Z'
const tmpDirs = []
const mk = (p) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `${p}-`))
  tmpDirs.push(d)
  return d.replace(/\\/g, '/')
}
afterAll(() => tmpDirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

const G = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', '-c', 'commit.gpgsign=false']
function exec(cmd, a, opts = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, a, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (err += d))
    c.on('error', reject)
    c.on('close', (status) => resolve({ status, out, err }))
  })
}
async function git(cwd, ...a) {
  const r = await exec('git', [...G, ...a], { cwd })
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.err}`)
  return r.out.trim()
}

const card = (id, status = 'carded', extra = {}) => ({ id, title: `t ${id}`, status, spec: null, deps: [], paths: [`src/${id.toLowerCase()}/**`], ...extra })

async function world(cards) {
  const remote = mk('nl-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('nl-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.1', cards }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return { remote, work }
}
async function run(w, tool, args) {
  const r = await exec('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    env: { ...process.env, CLAIMS_NOW: T0, CLAIMS_BACKOFF_MS: '1' },
  })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
const claim = (w, args) => run(w, 'claim.mjs', args)
const nextFor = async (w, worker, roles) => (await claim(w, ['next', '--worker', worker, '--roles', roles])).out
const list = async (w) => (await claim(w, ['list'])).out
const release = (w, id, role, who, note = 'ran out of time') => claim(w, ['update', id, role, 'released', '--worker', who, '--note', note])
// A real commit on origin/claude/<id>; n keeps each tip different.
async function pushCommit(w, id, n) {
  await git(w.work, 'checkout', '-q', '-B', `claude/${id}`, 'origin/main')
  const dir = path.join(w.work, 'src', id.toLowerCase())
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `f${n}.ts`), `export const n = ${n}\n`)
  await git(w.work, 'add', `src/${id.toLowerCase()}/f${n}.ts`)
  await git(w.work, 'commit', '-q', '-m', `c${n}`)
  await git(w.work, 'push', '-q', '-f', 'origin', `claude/${id}`)
  await git(w.work, 'checkout', '-q', 'main')
}
// Each worker in turn takes the job and releases it.
async function takeAndRelease(w, id, role, workers) {
  for (const who of workers) {
    expect(await nextFor(w, who, role), `${who} takes ${id} ${role}`).toBe(`CLAIMED ${id} ${role}`)
    expect((await release(w, id, role, who)).code).toBe(0)
  }
}
// A card with a reported spec (w0) and a reported build (w1): a check can be offered.
async function reportedBuild(id = 'B') {
  const w = await world([card(id)])
  const sha = await git(w.work, 'rev-parse', 'origin/main')
  expect(await nextFor(w, 'w0', 'spec')).toBe(`CLAIMED ${id} spec`)
  await claim(w, ['update', id, 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
  expect(await nextFor(w, 'w1', 'build')).toBe(`CLAIMED ${id} build`)
  await claim(w, ['update', id, 'build', 'reported', '--worker', 'w1'])
  return w
}


const nextOut = async (w) => (await run(w, 'next.mjs', ['10'])).out
const starts = (out) => [...out.matchAll(/^START (\S+)/gm)].map((m) => m[1])
const SHARED = ['src/core/env.ts']
// X has a reported spec and build (w0 specs, w1 builds); the claims say so, slices.json still says carded.
async function reportedX(cards) {
  const w = await world(cards)
  const sha = await git(w.work, 'rev-parse', 'origin/main')
  expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED X spec')
  await claim(w, ['update', 'X', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
  expect(await nextFor(w, 'w1', 'build')).toBe('CLAIMED X build')
  return w
}

describe('ARC-15 CQ8 rule 1: next.mjs and claim.mjs agree on path holds', () => {
  test('ARC-15 a build-ready card whose Paths overlap a reported build is "waiting on paths", never START, and claim.mjs offers it nothing', async () => {
    const w = await reportedX([card('X', 'carded', { paths: SHARED }), card('Y', 'carded', { spec: 'abc', paths: SHARED })])
    await claim(w, ['update', 'X', 'build', 'reported', '--worker', 'w1'])
    const out = await nextOut(w)
    expect(starts(out)).not.toContain('Y')
    expect(out).toMatch(/^Y waiting on paths: X\b/m)
    expect(await nextFor(w, 'w2', 'build')).toBe('NOTHING')
  })

  test('ARC-15 a working build holds its Paths the same way', async () => {
    const w = await reportedX([card('X', 'carded', { paths: SHARED }), card('Y', 'carded', { spec: 'abc', paths: SHARED })])
    const out = await nextOut(w)
    expect(starts(out)).not.toContain('Y')
    expect(out).toMatch(/^Y waiting on paths: X\b/m)
    expect(await nextFor(w, 'w2', 'build')).toBe('NOTHING')
  })

  test('ARC-15 a card with disjoint Paths still starts while X holds its own', async () => {
    const w = await reportedX([card('X', 'carded', { paths: SHARED }), card('Z', 'carded', { spec: 'abc', paths: ['src/other/**'] })])
    await claim(w, ['update', 'X', 'build', 'reported', '--worker', 'w1'])
    expect(starts(await nextOut(w))).toEqual(['Z'])
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED Z build')
  })

  test('ARC-15 a card that still needs its spec starts as before: a spec job is not held by paths', async () => {
    const w = await reportedX([card('X', 'carded', { paths: SHARED }), card('Y', 'carded', { paths: SHARED })])
    await claim(w, ['update', 'X', 'build', 'reported', '--worker', 'w1'])
    expect(starts(await nextOut(w))).toContain('Y')
    expect(await nextFor(w, 'w2', 'spec')).toBe('CLAIMED Y spec')
  })

  test('ARC-15 the hold lifts when the holder is merged (status done)', async () => {
    const w = await world([card('X', 'done', { paths: SHARED }), card('Y', 'carded', { spec: 'abc', paths: SHARED })])
    const out = await nextOut(w)
    expect(starts(out)).toContain('Y')
    expect(out).not.toMatch(/waiting on paths: X/)
  })
})

describe('ARC-15 CQ8 rule 2: the Lead can reopen a check', () => {
  async function needsLeadCheck() {
    const w = await reportedBuild('B')
    await takeAndRelease(w, 'B', 'check', ['w2', 'w3'])
    expect(await nextFor(w, 'w4', 'check')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^B check released \(needs Lead\)/m)
    return w
  }

  test('ARC-15 update <card> check reopened --worker lead clears needs Lead and the check is offered again', async () => {
    const w = await needsLeadCheck()
    const r = await claim(w, ['update', 'B', 'check', 'reopened', '--worker', 'lead'])
    expect(r.code).toBe(0)
    expect(await list(w)).not.toMatch(/^B check .*needs Lead/m)
    expect(await nextFor(w, 'w5', 'check')).toBe('CLAIMED B check')
  })

  test('ARC-15 another worker cannot reopen a check: refused, still needs Lead', async () => {
    const w = await needsLeadCheck()
    const r = await claim(w, ['update', 'B', 'check', 'reopened', '--worker', 'w2'])
    expect(r.code).toBe(6)
    expect(r.out).toMatch(/REFUSED/)
    expect(await list(w)).toMatch(/^B check released \(needs Lead\)/m)
    expect(await nextFor(w, 'w5', 'check')).toBe('NOTHING')
  })

  test('ARC-15 a reopened build or spec is still reopened by the Lead only (unchanged)', async () => {
    const w = await reportedBuild('B')
    const r = await claim(w, ['update', 'B', 'build', 'reopened', '--worker', 'w9'])
    expect(r.code).toBe(6)
  })
})
