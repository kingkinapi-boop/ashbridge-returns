// CQ1 acceptance tests (ARC-15 queue repairs): the queue makes no wasted offers.
// tools/claim.mjs, tools/next.mjs and tools/status.mjs, run against a bare remote and a clone,
// the clock pinned with CLAIMS_NOW. Every child process is async (A247).
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

async function world({ cards, readme } = {}) {
  const remote = mk('cq1-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('cq1-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.1', cards }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  const files = ['tools', 'plan', 'package.json']
  if (readme !== undefined) {
    fs.mkdirSync(path.join(work, 'blueprint'), { recursive: true })
    fs.writeFileSync(path.join(work, 'blueprint', 'README.md'), readme)
    files.push('blueprint')
  }
  await git(work, 'add', ...files)
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return { remote, work }
}
// Change the cards on main (a Lead commit), optionally touching package.json (a toolchain change).
async function pushCards(w, cards, { toolchain = false } = {}) {
  fs.writeFileSync(path.join(w.work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.1', cards }))
  const files = ['plan']
  if (toolchain) {
    fs.writeFileSync(path.join(w.work, 'package.json'), '{"name":"x","changed":true}\n')
    files.push('package.json')
  }
  await git(w.work, 'add', ...files)
  await git(w.work, 'commit', '-q', '-m', 'main moves')
  await git(w.work, 'push', '-q', 'origin', 'main')
}
async function run(w, tool, args, env = {}) {
  const r = await exec('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    env: { ...process.env, CLAIMS_NOW: T0, CLAIMS_BACKOFF_MS: '1', ...env },
  })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
const claim = (w, args) => run(w, 'claim.mjs', args)
const nextFor = async (w, worker, roles = 'check,build,spec') => (await claim(w, ['next', '--worker', worker, '--roles', roles])).out
const nextBS = (w, worker) => nextFor(w, worker, 'build,spec')

describe('ARC-15 CQ1 rule 1: no offer for a done card or a build that passed its check', () => {
  test('ARC-15 a done card is never offered any job, even with a spec that needs a toolchain refit', async () => {
    const w = await world({ cards: [card('D', 'carded')] })
    expect((await claim(w, ['update', 'D', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', 'deadbeefdeadbeef'])).code).toBe(0)
    await pushCards(w, [card('D', 'done')])
    for (const who of ['w1', 'w2']) expect(await nextFor(w, who)).toBe('NOTHING')
    expect((await claim(w, ['list'])).out).toMatch(/D spec reported \(toolchain refit\)/)
  })

  test('ARC-15 a build whose check passed is not re-offered, and its spec refit waits for the Lead to reopen it', async () => {
    const w = await world({ cards: [card('B', 'carded')] })
    const sha = await git(w.work, 'rev-parse', 'origin/main')
    expect((await claim(w, ['next', '--worker', 'w0', '--roles', 'spec'])).out).toBe('CLAIMED B spec')
    await claim(w, ['update', 'B', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
    expect(await nextFor(w, 'w1')).toBe('CLAIMED B build')
    await claim(w, ['update', 'B', 'build', 'reported', '--worker', 'w1'])
    expect(await nextFor(w, 'w2')).toBe('CLAIMED B check')
    await claim(w, ['update', 'B', 'check', 'reported', '--worker', 'w2', '--note', 'PASS'])
    // main now changes the toolchain: the passed card's spec would need a refit
    await pushCards(w, [card('B', 'carded')], { toolchain: true })
    expect((await claim(w, ['list'])).out).toMatch(/B spec reported \(toolchain refit\)/)
    for (const who of ['w3', 'w4']) expect(await nextFor(w, who)).toBe('NOTHING')
    // the Lead reopens the build: only then does the refit run
    expect((await claim(w, ['update', 'B', 'build', 'reopened', '--worker', 'lead'])).code).toBe(0)
    expect(await nextFor(w, 'w5')).toBe('CLAIMED B spec')
  })

  test('ARC-15 a released build whose check passed is not offered again until the Lead reopens it', async () => {
    const w = await world({ cards: [card('B', 'carded', { spec: 'abc123' })] })
    expect(await nextFor(w, 'w1')).toBe('CLAIMED B build')
    await claim(w, ['update', 'B', 'build', 'reported', '--worker', 'w1'])
    expect(await nextFor(w, 'w2')).toBe('CLAIMED B check')
    await claim(w, ['update', 'B', 'check', 'reported', '--worker', 'w2', '--note', 'PASS'])
    await claim(w, ['update', 'B', 'build', 'released', '--worker', 'w1'])
    expect(await nextFor(w, 'w3')).toBe('NOTHING')
    await claim(w, ['update', 'B', 'build', 'reopened', '--worker', 'lead'])
    expect(await nextFor(w, 'w3')).toBe('CLAIMED B build')
  })
})

describe('ARC-15 CQ1 rule 2: a "wait:" release is not offered again (until the Lead reopens it, CQ3)', () => {
  const waiting = [card('D', 'building', { spec: 'n/a', paths: ['src/d/**'] }), card('A', 'carded', { deps: ['D'], paths: ['src/a/**'] })]

  async function released(note) {
    const w = await world({ cards: waiting })
    // D has a reported build, so A's spec may start
    await claim(w, ['update', 'D', 'build', 'reported', '--worker', 'wd'])
    expect(await nextBS(w, 'w1')).toBe('CLAIMED A spec')
    await claim(w, ['update', 'A', 'spec', 'released', '--worker', 'w1', '--note', note])
    return w
  }

  test('ARC-15 a spec released with a "wait:" note is not offered again while nothing changed', async () => {
    const w = await released('wait: must not start until D lands')
    for (const who of ['w2', 'w3']) expect(await nextBS(w, who)).toBe('NOTHING')
    // an unrelated change on main does not lift the wait
    await pushCards(w, [...waiting, card('Z', 'todo')])
    expect(await nextBS(w, 'w4')).toBe('NOTHING')
  })

  test('ARC-15 a release without "wait:" is offered again at once (the rule is only for the must-not-start class)', async () => {
    const w = await released('could not finish')
    expect(await nextBS(w, 'w2')).toBe('CLAIMED A spec')
  })

  // CQ3 rule 2 retired "the wait lifts when a dep changes status" and "the wait lifts when the card deps
  // change": a "wait:" release now holds until the Lead reopens it (tools/test/claim-wait.test.mjs).

  test('ARC-15 a build released with "wait:" is held the same way', async () => {
    const w = await world({ cards: [card('A', 'carded', { spec: 'abc123' })] })
    expect(await nextBS(w, 'w1')).toBe('CLAIMED A build')
    await claim(w, ['update', 'A', 'build', 'released', '--worker', 'w1', '--note', 'wait: Zo has not approved D00'])
    expect(await nextBS(w, 'w2')).toBe('NOTHING')
  })

  test('ARC-15 next.mjs lists a held card under "waiting" and does not start it; it starts again once the Lead reopens it (CQ3)', async () => {
    const w = await released('wait: must not start until D lands')
    const held = await run(w, 'next.mjs', ['10'])
    expect(held.code).toBe(0)
    expect(held.out).not.toMatch(/^START A\b/m)
    expect(held.out).toMatch(/^waiting \(released with wait:\): .*\bA\b/m)
    await claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead'])
    const freed = await run(w, 'next.mjs', ['10'])
    expect(freed.out).toMatch(/^START A\b/m)
    expect(freed.out).not.toMatch(/^waiting \(released with wait:\)/m)
  })
})

describe('ARC-15 CQ1 rule 3: the design lane has no spec or build job', () => {
  const cards = [card('DS', 'carded', { lane: 'design' }), card('DS2', 'carded', { lane: 'design', spec: 'abc123' }), card('OK', 'carded')]

  test('ARC-15 claim next offers a normal card but never a design-lane card, for spec or build', async () => {
    const w = await world({ cards })
    expect(await nextBS(w, 'w1')).toBe('CLAIMED OK spec')
    expect(await nextBS(w, 'w2')).toBe('NOTHING')
  })

  test('ARC-15 next.mjs does not START a design-lane card', async () => {
    const w = await world({ cards })
    const r = await run(w, 'next.mjs', ['10'])
    expect([...r.out.matchAll(/^START (\S+)/gm)].map((m) => m[1])).toEqual(['OK'])
  })

  test('ARC-15 a card without a lane still waits for deps done or reported (rule 3 keeps the current gate)', async () => {
    const w = await world({ cards: [card('P', 'building', { spec: 'n/a' }), card('Q', 'carded', { deps: ['P'] })] })
    expect(await nextBS(w, 'wp')).toBe('CLAIMED P build')
    expect(await nextBS(w, 'w1')).toBe('NOTHING')
    await claim(w, ['update', 'P', 'build', 'reported', '--worker', 'wp'])
    expect(await nextBS(w, 'w2')).toBe('CLAIMED Q spec')
  })
})

describe('ARC-15 CQ1 rule 4: status.mjs prints the blueprint version from blueprint/README.md', () => {
  const readme = '# Blueprint: Ashbridge Returns\n\nVersion v1.7, 2 Oct 2026 (plus a change).\n\n## The end state\n'

  test('ARC-15 the version comes from blueprint/README.md, not from slices.json', async () => {
    const w = await world({ cards: [card('A', 'done')], readme })
    const r = await run(w, 'status.mjs', [])
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/blueprint v1\.7 \|/)
    expect(r.out).not.toMatch(/blueprint v1\.1\b/)
  })

  test('ARC-15 with no blueprint/README.md it exits 0 and does not print the stale slices.json literal', async () => {
    const w = await world({ cards: [card('A', 'done')] })
    const r = await run(w, 'status.mjs', [])
    expect(r.code).toBe(0)
    expect(r.out).not.toMatch(/blueprint v1\.1\b/)
  })
})
