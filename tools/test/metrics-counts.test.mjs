// CQ11 acceptance tests (ARC-15 queue repairs, decision 0027): `tools/metrics.mjs` counts what happened.
// 15 landed cards showed 0 check fails against 19 real failures (a failed check is written as
// "failed <card> check"), and "jobs" counted heartbeats. Every history is made by the real queue
// commands against a bare remote and a clone, the clock pinned with CLAIMS_NOW. Async children (A247).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 180000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const T0 = '2026-10-03T12:00:00Z'
// The clock is pinned and steps one second per tool run, so each claim write has its own time.
const tick = (w) => new Date(Date.parse(T0) + 1000 * (w.clock = (w.clock || 0) + 1)).toISOString()
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

// `files` adds files to main, e.g. { 'plan/cards/A.md': 'Where: cloud.' }.
async function world(cards, files = {}) {
  const remote = mk('cq11-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('cq11-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.2', cards }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(work, rel)), { recursive: true })
    fs.writeFileSync(path.join(work, rel), text)
  }
  await git(work, 'add', 'tools', 'plan', 'package.json')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  const sha = await git(work, 'rev-parse', 'origin/main')
  return { remote, work, sha, cards }
}
async function run(w, tool, args) {
  const r = await exec('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    env: { ...process.env, CLAIMS_NOW: tick(w), CLAIMS_BACKOFF_MS: '1' },
  })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
const claim = (w, args) => run(w, 'claim.mjs', args)
// The first line of `next` (a reopened spec may carry the Lead's note on the line after CLAIMED).
const nextFor = async (w, worker, roles = 'check,build,spec') => (await claim(w, ['next', '--worker', worker, '--roles', roles])).out.split('\n')[0]
async function ok(w, args) {
  const r = await claim(w, args)
  expect(r.code, `claim.mjs ${args.join(' ')}: ${r.out} ${r.err}`).toBe(0)
  return r
}
const listing = async (w) => (await claim(w, ['list'])).out
// A card with a reported build, built by wb (the spec is on the card), ready for a check.
async function built(w, id = 'A') {
  expect(await nextFor(w, 'wb', 'build')).toBe(`CLAIMED ${id} build`)
  await ok(w, ['update', id, 'build', 'reported', '--worker', 'wb', '--note', '9 of 9 acceptance tests pass'])
}

async function metrics(w, id = 'A') {
  const r = await run(w, 'metrics.mjs', [id, '--dry'])
  expect(r.code, r.out + r.err).toBe(0)
  return JSON.parse(r.out)
}
const beats = async (w, id, role, who, n) => {
  for (let i = 0; i < n; i++) await ok(w, ['beat', id, role, '--worker', who])
}

describe('CQ11 rule 3: metrics.mjs counts failed checks and claims, not beats', () => {
  test('ARC-15 a history with 2 failed checks and 40 beats gives check_fails 2 and the true job count', async () => {
    const w = await world([card('A', 'carded')])
    // job 1: spec
    expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
    await beats(w, 'A', 'spec', 'w1', 5)
    await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc123', '--validated', w.sha])
    // job 2: build round 1
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await beats(w, 'A', 'build', 'w2', 15)
    await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'w2'])
    // job 3: check 1 fails
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await beats(w, 'A', 'check', 'w3', 5)
    await ok(w, ['update', 'A', 'check', 'failed', '--worker', 'w3', '--note', 'FAIL: one'])
    await ok(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])
    // job 4: build round 2
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await beats(w, 'A', 'build', 'w2', 10)
    await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'w2'])
    // job 5: check 2 fails
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await beats(w, 'A', 'check', 'w3', 5)
    await ok(w, ['update', 'A', 'check', 'failed', '--worker', 'w3', '--note', 'FAIL: two'])
    const m = await metrics(w)
    expect(m.check_fails).toBe(2)
    expect(m.jobs).toBe(5)
    expect(m.rounds).toBe(2)
  })

  test('ARC-15 heartbeats alone add nothing: the same job with 0 and with 30 beats counts the same', async () => {
    const counts = []
    for (const n of [0, 30]) {
      const w = await world([card('A', 'carded')])
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
      await beats(w, 'A', 'spec', 'w1', n)
      counts.push((await metrics(w)).jobs)
    }
    expect(counts).toEqual([1, 1])
  })

  test('ARC-15 a release and a re-take are two jobs (releases and refits included)', async () => {
    const w = await world([card('A', 'carded')])
    expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
    await ok(w, ['update', 'A', 'spec', 'released', '--worker', 'w1', '--note', 'ran out of time'])
    expect(await nextFor(w, 'w2', 'spec')).toBe('CLAIMED A spec')
    // reported against a sha git does not know: offered again as a toolchain refit (a third job)
    await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w2', '--commit', 'abc123', '--validated', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'])
    expect(await nextFor(w, 'w3', 'spec')).toBe('CLAIMED A spec')
    expect((await metrics(w)).jobs).toBe(3)
  })

  test('ARC-15 a card with no failed check reports check_fails 0 even after many beats', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    await built(w)
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await beats(w, 'A', 'check', 'w3', 12)
    await ok(w, ['update', 'A', 'check', 'reported', '--worker', 'w3', '--note', 'PASS'])
    const m = await metrics(w)
    expect(m.check_fails).toBe(0)
    expect(m.jobs).toBe(2)
  })

  test('ARC-15 old "failed <card> build" lines are still counted as failed checks', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    expect(await nextFor(w, 'wb', 'build')).toBe('CLAIMED A build')
    await ok(w, ['update', 'A', 'build', 'failed', '--worker', 'wb', '--note', 'FAIL: old style'])
    expect((await metrics(w)).check_fails).toBe(1)
  })

  test('ARC-15 one card\'s metrics do not count another card\'s checks or claims', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' }), card('B', 'carded')])
    await built(w, 'A')
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'failed', '--worker', 'w3', '--note', 'FAIL: a'])
    const b = await metrics(w, 'B')
    expect(b.check_fails).toBe(0)
    expect(b.jobs).toBe(0)
  })
})
