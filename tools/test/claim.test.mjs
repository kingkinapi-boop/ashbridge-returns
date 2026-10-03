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

// ---- CQ2 (ARC-15): released checks re-offered, honest counts, a reopened spec carries the Lead's note ----
const T_OLD = '2026-10-02T09:00:00Z'
const SHA_BAD = 'deadbeefdeadbeef'
// A card with a spec writer w0 and a builder w1, build reported. Returns the world.
async function reportedBuild(cards = [card('B', 'carded')]) {
  const w = await world({ cards })
  const sha = await git(w.work, 'rev-parse', 'origin/main')
  expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED B spec')
  await claim(w, ['update', 'B', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
  expect(await nextFor(w, 'w1', 'build')).toBe('CLAIMED B build')
  await claim(w, ['update', 'B', 'build', 'reported', '--worker', 'w1'])
  return { ...w, sha }
}

describe('ARC-15 CQ2 rule 1: a released check is offered again, with no re-stamp of the build', () => {
  test('ARC-15 a check released for the build is offered to a third worker, never to the spec writer or the builder', async () => {
    const w = await reportedBuild()
    expect(await nextFor(w, 'w2', 'check')).toBe('CLAIMED B check')
    expect((await claim(w, ['update', 'B', 'check', 'released', '--worker', 'w2', '--note', 'ran out of time'])).code).toBe(0)
    expect(await nextFor(w, 'w0', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w1', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED B check')
    // taken again: no one else gets it while it is working
    expect(await nextFor(w, 'w4', 'check')).toBe('NOTHING')
  })

  test('ARC-15 a check that reported (any verdict) for this build is not offered again', async () => {
    const w = await reportedBuild()
    expect(await nextFor(w, 'w2', 'check')).toBe('CLAIMED B check')
    await claim(w, ['update', 'B', 'check', 'reported', '--worker', 'w2', '--note', 'PASS'])
    expect(await nextFor(w, 'w3', 'check')).toBe('NOTHING')
  })

  test('ARC-15 a check that is still working (not stale) is not offered to anyone else', async () => {
    const w = await reportedBuild()
    expect(await nextFor(w, 'w2', 'check')).toBe('CLAIMED B check')
    for (const who of ['w3', 'w4']) expect(await nextFor(w, who, 'check')).toBe('NOTHING')
  })

  test('ARC-15 a released check does not make a released build checkable: no reported build, no check offer', async () => {
    const w = await world({ cards: [card('B', 'carded', { spec: 'abc123' })] })
    expect(await nextFor(w, 'w1')).toBe('CLAIMED B build')
    await claim(w, ['update', 'B', 'build', 'released', '--worker', 'w1', '--note', 'could not finish'])
    expect(await nextFor(w, 'w2', 'check')).toBe('NOTHING')
  })
})

describe('ARC-15 CQ2 rule 2: no spec job while the card build is reported and not merged', () => {
  test('ARC-15 a spec refit is not offered while the build is reported and unchecked; it is offered once the Lead reopens the build', async () => {
    const w = await reportedBuild()
    await pushCards(w, [card('B', 'carded')], { toolchain: true })
    expect((await claim(w, ['list'])).out).toMatch(/B spec reported \(toolchain refit\)/)
    for (const who of ['w5', 'w6']) expect(await nextFor(w, who, 'spec')).toBe('NOTHING')
    await claim(w, ['update', 'B', 'build', 'reopened', '--worker', 'lead'])
    expect(await nextFor(w, 'w7', 'spec')).toBe('CLAIMED B spec')
  })

  test('ARC-15 a spec refit is not offered while the build is under check either', async () => {
    const w = await reportedBuild()
    expect(await nextFor(w, 'w2', 'check')).toBe('CLAIMED B check')
    await pushCards(w, [card('B', 'carded')], { toolchain: true })
    expect(await nextFor(w, 'w5', 'spec')).toBe('NOTHING')
  })

  test('ARC-15 a spec with no sha (a refit by definition) is held back the same way while the build is reported', async () => {
    const w = await reportedBuild()
    await claim(w, ['update', 'B', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', SHA_BAD])
    expect(await nextFor(w, 'w5', 'spec')).toBe('NOTHING')
  })

  test('ARC-15 with no reported build the refit is still offered (the rule is only for a reported, unmerged build)', async () => {
    const w = await world({ cards: [card('B', 'carded')] })
    await claim(w, ['update', 'B', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', SHA_BAD])
    expect(await nextFor(w, 'w5', 'spec')).toBe('CLAIMED B spec')
  })
})

describe('ARC-15 CQ2 rule 3: next.mjs counts in flight from the claims and never starts a reported build', () => {
  // A: build working. C: build reported, check PASS. B: build reported, check working. D: nothing yet.
  async function busyWorld() {
    const w = await world({ cards: ['A', 'C', 'B', 'D'].map((id) => card(id, 'carded', { spec: 'abc123' })) })
    expect(await nextBS(w, 'w1')).toBe('CLAIMED A build')
    expect(await nextBS(w, 'w2')).toBe('CLAIMED C build')
    await claim(w, ['update', 'C', 'build', 'reported', '--worker', 'w2'])
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED C check')
    await claim(w, ['update', 'C', 'check', 'reported', '--worker', 'w3', '--note', 'PASS'])
    expect(await nextFor(w, 'w4', 'build')).toBe('CLAIMED B build')
    await claim(w, ['update', 'B', 'build', 'reported', '--worker', 'w4'])
    expect(await nextFor(w, 'w5', 'check')).toBe('CLAIMED B check')
    return w
  }

  test('ARC-15 in flight counts the working jobs of any role from the claims, not the card statuses', async () => {
    const w = await busyWorld()
    const r = await run(w, 'next.mjs', ['10'])
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/^in flight 2 \|/m)
  })

  test('ARC-15 next.mjs starts only the card with no build; reported builds show as waiting on check or ready to board', async () => {
    const w = await busyWorld()
    const r = await run(w, 'next.mjs', ['10'])
    expect([...r.out.matchAll(/^START (\S+)/gm)].map((m) => m[1])).toEqual(['D'])
    expect(r.out).toMatch(/^waiting on check: .*\bB\b/m)
    expect(r.out).not.toMatch(/^waiting on check: .*\b[AC]\b/m)
    expect(r.out).toMatch(/^ready to board: .*\bC\b/m)
    expect(r.out).not.toMatch(/^ready to board: .*\b[ABD]\b/m)
  })

  test('ARC-15 a stale working claim is not counted as in flight', async () => {
    const w = await world({ cards: [card('A', 'carded', { spec: 'abc123' })] })
    expect((await run(w, 'claim.mjs', ['next', '--worker', 'w1', '--roles', 'build'], { CLAIMS_NOW: T_OLD })).out).toBe('CLAIMED A build')
    const r = await run(w, 'next.mjs', ['10'])
    expect(r.out).toMatch(/^in flight 0 \|/m)
  })

  test('ARC-15 a card whose spec is reported and whose build is reported is not started', async () => {
    const w = await reportedBuild([card('B', 'carded')])
    const r = await run(w, 'next.mjs', ['10'])
    expect(r.out).not.toMatch(/^START B\b/m)
    expect(r.out).toMatch(/^waiting on check: .*\bB\b/m)
  })

  test('ARC-15 with no claims in flight it prints in flight 0 and starts a fresh card', async () => {
    const w = await world({ cards: [card('A', 'carded', { spec: 'abc123' })] })
    const r = await run(w, 'next.mjs', ['10'])
    expect(r.out).toMatch(/^in flight 0 \|/m)
    expect(r.out).toMatch(/^START A\b/m)
  })
})

describe('ARC-15 CQ2 rule 5: a spec the Lead reopens for a new round carries the Lead note and is no refit', () => {
  async function reopened(note = 'round 2: add the six tests from reports/A-findings.md') {
    const w = await world({ cards: [card('A', 'carded')] })
    const sha = await git(w.work, 'rev-parse', 'origin/main')
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED A spec')
    await claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'c1c1c1', '--validated', sha])
    expect((await claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', note])).code).toBe(0)
    return { ...w, sha, note }
  }

  test('ARC-15 the reopened spec is offered with the Lead note on the line after CLAIMED, and the claim keeps the note', async () => {
    const w = await reopened()
    const r = await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    expect(r.code).toBe(0)
    const lines = r.out.split('\n')
    expect(lines[0]).toBe('CLAIMED A spec')
    expect(lines[1]).toContain(w.note)
    expect((await claim(w, ['list'])).out).toContain(`A spec working | w1 |`)
    expect((await claim(w, ['list'])).out).toContain(w.note)
  })

  test('ARC-15 a worker cannot report the new round with no commit or with the old spec commit', async () => {
    const w = await reopened()
    await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    for (const extra of [[], ['--commit', 'c1c1c1'], ['--commit', 'c1c1c1', '--note', 'refit: no test change']]) {
      const r = await claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--validated', w.sha, ...extra])
      expect(r.code, extra.join(' ')).toBe(6)
      expect(r.out).toMatch(/^REFUSED/)
    }
    expect((await claim(w, ['list'])).out).toMatch(/^A spec working /m)
  })

  test('ARC-15 a worker who reports a new spec commit for the new round is accepted', async () => {
    const w = await reopened()
    await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    const r = await claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'c2c2c2', '--validated', w.sha, '--note', '6 tests added'])
    expect(r.code).toBe(0)
    expect((await claim(w, ['list'])).out).toMatch(/^A spec reported /m)
  })

  test('ARC-15 a toolchain refit may still be reported with the same spec commit and a new validated sha', async () => {
    const w = await world({ cards: [card('A', 'carded')] })
    const sha = await git(w.work, 'rev-parse', 'origin/main')
    await claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'c1c1c1', '--validated', SHA_BAD])
    expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
    const r = await claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'c1c1c1', '--validated', sha])
    expect(r.code).toBe(0)
  })
})
