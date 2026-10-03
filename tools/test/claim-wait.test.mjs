// CQ3 acceptance tests (ARC-15 queue repairs): no build while its spec is open, no check while its
// build is, and a job released with "wait:" holds until the Lead reopens it (A411, A416: DB16's build
// was offered twice while its spec was reopened and being rewritten).
// Both rules are tested by class, through tables of claim histories: every role pair (spec before
// build, build before check) and every "wait:" release (spec and build) against every change that
// used to lift it. tools/claim.mjs runs against a bare remote and a clone, the clock pinned with
// CLAIMS_NOW. Every child process is async (A247).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 180000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const T0 = '2026-10-03T12:00:00Z'
const T_LATER = '2026-10-03T15:00:00Z' // three hours on: past every stale limit
// The clock is pinned and steps one second per tool run, so each claim write has its own time (a
// rebuilt build must not share its `at` with the one an earlier check was for).
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

async function world(cards) {
  const remote = mk('cq3-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('cq3-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.2', cards }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  const sha = await git(work, 'rev-parse', 'origin/main')
  return { remote, work, sha, cards }
}
// A Lead commit on main that changes the cards (plan/ only, so no toolchain refit).
async function pushCards(w, cards) {
  fs.writeFileSync(path.join(w.work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.2', cards }))
  await git(w.work, 'add', 'plan')
  await git(w.work, 'commit', '-q', '-m', 'main moves')
  await git(w.work, 'push', '-q', 'origin', 'main')
  w.cards = cards
}
async function run(w, tool, args, env = {}) {
  const r = await exec('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    env: { ...process.env, CLAIMS_NOW: tick(w), CLAIMS_BACKOFF_MS: '1', ...env },
  })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
const claim = (w, args, env) => run(w, 'claim.mjs', args, env)
// The first line of `next` (a reopened spec may carry the Lead's note on the line after CLAIMED).
const nextFor = async (w, worker, roles = 'check,build,spec', env) => (await claim(w, ['next', '--worker', worker, '--roles', roles], env)).out.split('\n')[0]
async function ok(w, args) {
  const r = await claim(w, args)
  expect(r.code, `claim.mjs ${args.join(' ')}: ${r.out} ${r.err}`).toBe(0)
  return r
}
const listing = async (w) => (await claim(w, ['list'])).out

// ---------------------------------------------------------------------------------------------
// Rule 1: next never offers a card's build while its spec job is reopened or working, nor its
// check while its build is. Each row opens the earlier job of a pair, proves the later job is not
// offered (to two workers, alone and with every role allowed), then closes the earlier job and
// proves the later one is offered again (the filter is a wait, never a ban).
// ---------------------------------------------------------------------------------------------
const OPEN = [
  {
    name: 'a build is not offered while the spec the Lead reopened is being rewritten (spec commit on the card, the DB16 case)',
    blocker: ['spec', 'working'],
    blocked: 'build',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
      await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2: add the tests from reports/A-findings.md'])
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
      return w
    },
    async close(w) {
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'c2c2c2', '--validated', w.sha])
    },
  },
  {
    name: 'a build is not offered while the spec the Lead reopened waits for a writer (spec commit on the card)',
    blocker: ['spec', 'reopened'],
    blocked: 'build',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
      await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2: add the tests from reports/A-findings.md'])
      return w
    },
    async close(w) {
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'c2c2c2', '--validated', w.sha])
    },
  },
  {
    name: 'a build is not offered while its spec is being refitted for a toolchain change (spec commit only in the claim)',
    blocker: ['spec', 'working'],
    blocked: 'build',
    async open() {
      const w = await world([card('A', 'carded')])
      // reported with a sha git does not know: the spec is offered again as a toolchain refit
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'])
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
      return w
    },
    async close(w) {
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc123', '--validated', w.sha])
    },
  },
  {
    name: 'a build is not offered while a reopened spec is rewritten (spec commit only in the claim)',
    blocker: ['spec', 'working'],
    blocked: 'build',
    async open() {
      const w = await world([card('A', 'carded')])
      expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED A spec')
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
      await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2: add the tests from reports/A-findings.md'])
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
      return w
    },
    async close(w) {
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'c2c2c2', '--validated', w.sha])
    },
  },
  {
    name: 'a released build is not offered again while the spec the Lead reopened is being rewritten',
    blocker: ['spec', 'working'],
    blocked: 'build',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
      expect(await nextFor(w, 'wb', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'released', '--worker', 'wb', '--note', 'could not finish'])
      await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2: add the tests from reports/A-findings.md'])
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
      return w
    },
    async close(w) {
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'c2c2c2', '--validated', w.sha])
    },
  },
  {
    name: 'a check is not offered while the build is still working',
    blocker: ['build', 'working'],
    blocked: 'check',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      expect(await nextFor(w, 'wb', 'build')).toBe('CLAIMED A build')
      return w
    },
    async close(w) {
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb', '--note', '9 of 9 acceptance tests pass'])
    },
  },
  {
    name: 'a check is not offered while the build the Lead reopened after a failed check waits for a builder',
    blocker: ['build', 'reopened'],
    blocked: 'check',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      expect(await nextFor(w, 'wb', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb'])
      expect(await nextFor(w, 'wc', 'check')).toBe('CLAIMED A check')
      await ok(w, ['update', 'A', 'check', 'failed', '--worker', 'wc', '--note', 'FAIL: see reports/A-check.md'])
      await ok(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])
      return w
    },
    async close(w) {
      expect(await nextFor(w, 'wb2', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb2'])
    },
  },
  {
    name: 'a check is not offered while the build the Lead reopened is being rebuilt',
    blocker: ['build', 'working'],
    blocked: 'check',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      expect(await nextFor(w, 'wb', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb'])
      expect(await nextFor(w, 'wc', 'check')).toBe('CLAIMED A check')
      await ok(w, ['update', 'A', 'check', 'failed', '--worker', 'wc', '--note', 'FAIL: see reports/A-check.md'])
      await ok(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])
      expect(await nextFor(w, 'wb2', 'build')).toBe('CLAIMED A build')
      return w
    },
    async close(w) {
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb2'])
    },
  },
  {
    name: 'a check is not offered while a build that passed is reopened by the Lead',
    blocker: ['build', 'reopened'],
    blocked: 'check',
    async open() {
      const w = await world([card('A', 'carded', { spec: 'abc123' })])
      expect(await nextFor(w, 'wb', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb'])
      expect(await nextFor(w, 'wc', 'check')).toBe('CLAIMED A check')
      await ok(w, ['update', 'A', 'check', 'reported', '--worker', 'wc', '--note', 'PASS'])
      await ok(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])
      return w
    },
    async close(w) {
      expect(await nextFor(w, 'wb2', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'wb2'])
    },
  },
]

describe('ARC-15 CQ3 rule 1: no build while its spec is open, no check while its build is', () => {
  for (const row of OPEN) test(`ARC-15 ${row.name}`, async () => {
    const w = await row.open()
    const [role, state] = row.blocker
    expect(await listing(w)).toMatch(new RegExp(`^A ${role} ${state}\\b`, 'm'))
    // the later job of the pair is offered to nobody: alone, or with every role but the open one allowed
    const others = ['check', 'build', 'spec'].filter((r) => r !== role).join(',')
    for (const who of ['x1', 'x2']) expect(await nextFor(w, who, row.blocked), `${who} asked for ${row.blocked}`).toBe('NOTHING')
    for (const who of ['x3', 'x4']) expect(await nextFor(w, who, others), `${who} asked for ${others}`).toBe('NOTHING')
    // the earlier job closes: the later one is offered again
    await row.close(w)
    expect(await nextFor(w, 'x5', row.blocked)).toBe(`CLAIMED A ${row.blocked}`)
  })
})

// ---------------------------------------------------------------------------------------------
// Rule 2: a job released with a note starting "wait:" is not offered again until the Lead reopens
// it. Every change that used to lift a CQ1 wait (the card's status, its deps, a dep's status) and
// every other thing that might is applied in turn; none lifts it. Then the Lead's reopen does.
// ---------------------------------------------------------------------------------------------
const SPEC_CARDS = [card('D', 'building', { spec: 'n/a', paths: ['src/d/**'] }), card('A', 'carded', { deps: ['D'], paths: ['src/a/**'] })]
const BUILD_CARDS = [card('E', 'done', { spec: 'n/a', paths: ['src/e/**'] }), card('A', 'carded', { spec: 'abc123', deps: ['E'], paths: ['src/a/**'] })]

const WAITS = {
  spec: {
    async released(note) {
      const w = await world(SPEC_CARDS)
      // D has a reported build, so A's spec may start
      await ok(w, ['update', 'D', 'build', 'reported', '--worker', 'wd'])
      expect(await nextFor(w, 'w1', 'build,spec')).toBe('CLAIMED A spec')
      await ok(w, ['update', 'A', 'spec', 'released', '--worker', 'w1', ...(note === undefined ? [] : ['--note', note])])
      return w
    },
  },
  build: {
    async released(note) {
      const w = await world(BUILD_CARDS)
      expect(await nextFor(w, 'w1', 'build,spec')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'released', '--worker', 'w1', ...(note === undefined ? [] : ['--note', note])])
      return w
    },
  },
}
const withCard = (w, id, change) => w.cards.map((c) => (c.id === id ? { ...c, ...change } : c))

// Each change runs after the "wait:" release; `env` is the environment of the offers that follow.
const CHANGES = [
  { what: 'nothing changes', roles: ['spec', 'build'], async apply() {} },
  { what: 'three hours pass', roles: ['spec', 'build'], env: { CLAIMS_NOW: T_LATER }, async apply() {} },
  { what: 'an unrelated card is added on main', roles: ['spec', 'build'], async apply(w) { await pushCards(w, [...w.cards, card('Z', 'todo', { paths: ['src/z/**'] })]) } },
  { what: 'the card status changes', roles: ['spec', 'build'], async apply(w) { await pushCards(w, withCard(w, 'A', { status: 'building' })) } },
  { what: 'a dep changes status (CQ1 lifted the wait here)', roles: ['spec'], async apply(w) { await pushCards(w, withCard(w, 'D', { status: 'done' })) } },
  { what: 'the card deps change (CQ1 lifted the wait here)', roles: ['spec', 'build'], async apply(w) { await pushCards(w, withCard(w, 'A', { deps: [] })) } },
  { what: 'the spec commit on the card changes', roles: ['build'], async apply(w) { await pushCards(w, withCard(w, 'A', { spec: 'def456' })) } },
  {
    what: 'a worker who is not the Lead tries to reopen it',
    roles: ['spec', 'build'],
    async apply(w, role) {
      const r = await claim(w, ['update', 'A', role, 'reopened', '--worker', 'w1'])
      expect(r.code).toBe(6)
      expect(r.out).toMatch(/^REFUSED/)
    },
  },
]
const HOLD_ROWS = CHANGES.flatMap((c) => c.roles.map((role) => ({ ...c, role })))

describe('ARC-15 CQ3 rule 2: a "wait:" release holds until the Lead reopens it', () => {
  for (const row of HOLD_ROWS) test(`ARC-15 a ${row.role} released with "wait:" stays held when ${row.what}, and is offered once the Lead reopens it`, async () => {
    const w = await WAITS[row.role].released('wait: Zo has not approved D00')
    await row.apply(w, row.role)
    for (const who of ['w1', 'w2', 'w3']) expect(await nextFor(w, who, 'build,spec', row.env), `${who} after: ${row.what}`).toBe('NOTHING')
    expect(await listing(w)).toMatch(new RegExp(`^A ${row.role} released \\(waiting\\)`, 'm'))
    await ok(w, ['update', 'A', row.role, 'reopened', '--worker', 'lead'])
    expect(await nextFor(w, 'w4', 'build,spec', row.env)).toBe(`CLAIMED A ${row.role}`)
  })

  const OTHER = [
    { how: 'a note that does not start with "wait:"', note: 'could not finish' },
    { how: 'a note with "wait:" later in it', note: 'ran out of time; will wait: no' },
    { how: 'no note', note: undefined },
  ]
  const OTHER_ROWS = ['spec', 'build'].flatMap((role) => OTHER.map((o) => ({ ...o, role })))
  for (const row of OTHER_ROWS) test(`ARC-15 a ${row.role} released with ${row.how} is offered again at once (any other release behaves as today)`, async () => {
    const w = await WAITS[row.role].released(row.note)
    expect(await nextFor(w, 'w2', 'build,spec')).toBe(`CLAIMED A ${row.role}`)
  })

  test('ARC-15 next.mjs keeps a held card under "waiting" after the change that used to lift it, and drops it once the Lead reopens it', async () => {
    const w = await WAITS.spec.released('wait: must not start until D lands')
    await pushCards(w, withCard(w, 'D', { status: 'done' }))
    const held = await run(w, 'next.mjs', ['10'])
    expect(held.code).toBe(0)
    expect(held.out).not.toMatch(/^START A\b/m)
    expect(held.out).toMatch(/^waiting \(released with wait:\): .*\bA\b/m)
    await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead'])
    const freed = await run(w, 'next.mjs', ['10'])
    expect(freed.out).not.toMatch(/^waiting \(released with wait:\): .*\bA\b/m)
  })
})
