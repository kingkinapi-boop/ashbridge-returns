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

// Rule 3 (A440, check finding 1 of CQ8): a worker named local-* is never offered any job of a card whose Where line says
// only "cloud"; next.mjs tags such a card "cloud only". The Where line is read from plan/cards/<id>.md on main.
describe('ARC-15 CQ8 rule 3: local workers skip cards that run in the cloud only', () => {
  const where = (text) => `# t\n\nPhase 0. Size S. Deps: none. Where: ${text}\nTags: none.\n`
  const CARDS = {
    CLOUDP: 'cloud (a long run on a big box).',
    CLOUDD: 'cloud.',
    CLOUDLAPTOP: 'cloud, then one laptop run',
    EITHER: 'local or cloud',
  }
  async function whereWorld(withSpec) {
    const w = await world(Object.keys(CARDS).map((id) => card(id, 'carded', withSpec ? { spec: 'abc' } : {})))
    fs.mkdirSync(path.join(w.work, 'plan', 'cards'), { recursive: true })
    for (const [id, text] of Object.entries(CARDS)) fs.writeFileSync(path.join(w.work, 'plan', 'cards', `${id}.md`), where(text))
    await git(w.work, 'add', 'plan/cards')
    await git(w.work, 'commit', '-q', '-m', 'cards')
    await git(w.work, 'push', '-q', 'origin', 'main')
    return w
  }

  test('ARC-15 a local-* worker is refused a spec of a "Where: cloud (...)" card and a "Where: cloud." card, and offered the other two', async () => {
    const w = await whereWorld(false)
    const offered = []
    for (let i = 0; i < 6; i++) {
      const out = await nextFor(w, 'local-1', 'spec')
      if (out === 'NOTHING') break
      offered.push(out)
    }
    expect(offered.sort()).toEqual(['CLAIMED CLOUDLAPTOP spec', 'CLAIMED EITHER spec'])
    const list1 = await list(w)
    expect(list1).not.toMatch(/^CLOUDP /m)
    expect(list1).not.toMatch(/^CLOUDD /m)
  })

  test('ARC-15 a cloud worker is still offered the cloud-only cards (spec)', async () => {
    const w = await whereWorld(false)
    const offered = new Set()
    for (let i = 0; i < 6; i++) {
      const out = await nextFor(w, 'cloud-a1', 'spec')
      if (out === 'NOTHING') break
      offered.add(out)
    }
    expect(offered.has('CLAIMED CLOUDP spec')).toBe(true)
    expect(offered.has('CLAIMED CLOUDD spec')).toBe(true)
    expect(offered.size).toBe(4)
  })

  test('ARC-15 a local-* worker is refused a build of a cloud-only card and offered the others', async () => {
    const w = await whereWorld(true)
    const offered = []
    for (let i = 0; i < 6; i++) {
      const out = await nextFor(w, 'local-1', 'build')
      if (out === 'NOTHING') break
      offered.push(out)
    }
    expect(offered.sort()).toEqual(['CLAIMED CLOUDLAPTOP build', 'CLAIMED EITHER build'])
    expect(await nextFor(w, 'cloud-a1', 'build')).toMatch(/^CLAIMED CLOUD[PD] build$/)
  })

  test('ARC-15 a local-* worker is refused a check of a cloud-only card with a reported build, and offered the others', async () => {
    const w = await whereWorld(true)
    const sha = await git(w.work, 'rev-parse', 'origin/main')
    const ids = Object.keys(CARDS)
    for (const id of ids) {
      await claim(w, ['update', id, 'spec', 'reported', '--worker', 'cloud-s1', '--commit', 'abc123', '--validated', sha])
    }
    for (let i = 0; i < ids.length; i++) {
      const out = await nextFor(w, 'cloud-b1', 'build')
      expect(out).toMatch(/^CLAIMED \w+ build$/)
      expect((await claim(w, ['update', out.split(' ')[1], 'build', 'reported', '--worker', 'cloud-b1'])).code, out).toBe(0)
    }
    const localChecks = []
    for (let i = 0; i < ids.length; i++) {
      const out = await nextFor(w, 'local-1', 'check')
      if (out === 'NOTHING') break
      localChecks.push(out)
    }
    expect(localChecks.sort()).toEqual(['CLAIMED CLOUDLAPTOP check', 'CLAIMED EITHER check'])
    const cloudChecks = []
    for (let i = 0; i < 2; i++) cloudChecks.push(await nextFor(w, 'cloud-c1', 'check'))
    expect(cloudChecks.sort()).toEqual(['CLAIMED CLOUDD check', 'CLAIMED CLOUDP check'])
  })

  test('ARC-15 next.mjs tags only the cloud-only cards "cloud only"', async () => {
    const w = await whereWorld(true)
    const out = await nextOut(w)
    const tag = (id) => out.split('\n').find((l) => l.startsWith(`START ${id} `)) ?? ''
    expect(tag('CLOUDP')).toMatch(/cloud only/)
    expect(tag('CLOUDD')).toMatch(/cloud only/)
    expect(tag('CLOUDLAPTOP')).not.toMatch(/cloud only/)
    expect(tag('EITHER')).not.toMatch(/cloud only/)
  })
})

// CQ11 (A493 item 2): a file that is not on main and is named in the Paths of a card whose spec has reported and which has
// not landed is held; no other card's spec or build naming it is offered. Planted as on 3 Oct: SC6 and SC10 both wrote
// tools/test/card-rules.test.mjs.
describe('ARC-15 CQ11 A493: a new file in the Paths of a reported spec holds every other card naming it', () => {
  const NEWFILE = 'tools/test/card-rules.test.mjs'
  // SC6 has a reported spec (w0); its Paths name NEWFILE, which main does not have.
  async function sc6Reported(others, sc6Extra = {}) {
    const w = await world([card('SC6', 'carded', { paths: ['tools/scope.mjs', NEWFILE], ...sc6Extra }), ...others])
    const sha = await git(w.work, 'rev-parse', 'origin/main')
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED SC6 spec')
    await claim(w, ['update', 'SC6', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
    return w
  }

  test('ARC-15 A493 SC10 (spec needed) naming the same new file is "waiting on paths: SC6", never START, and claim.mjs offers it nothing', async () => {
    const w = await sc6Reported([card('SC10', 'carded', { paths: ['tools/check.mjs', NEWFILE] })])
    const out = await nextOut(w)
    expect(starts(out)).not.toContain('SC10')
    expect(out).toMatch(/^SC10 waiting on paths: SC6\b/m)
    expect(await nextFor(w, 'w2', 'spec')).toBe('NOTHING')
  })

  test('ARC-15 A493 a card with a spec naming the new file is held for its build too', async () => {
    const w = await sc6Reported([card('SC10', 'carded', { spec: 'abc', paths: [NEWFILE] })])
    const out = await nextOut(w)
    expect(starts(out)).not.toContain('SC10')
    expect(out).toMatch(/^SC10 waiting on paths: SC6\b/m)
    expect(await nextFor(w, 'w2', 'build')).toBe('NOTHING')
  })

  test('ARC-15 A493 a card that names other files only still starts', async () => {
    const w = await sc6Reported([card('SC10', 'carded', { paths: ['tools/check.mjs'] })])
    expect(starts(await nextOut(w))).toContain('SC10')
    expect(await nextFor(w, 'w2', 'spec')).toBe('CLAIMED SC10 spec')
  })

  test('ARC-15 A493 the hold lifts when SC6 has landed (status done)', async () => {
    const w = await world([card('SC6', 'done', { paths: ['tools/scope.mjs', NEWFILE] }), card('SC10', 'carded', { paths: [NEWFILE] })])
    const out = await nextOut(w)
    expect(starts(out)).toContain('SC10')
    expect(out).not.toMatch(/waiting on paths: SC6/)
  })

  test('ARC-15 A493 a file that already exists on main holds nothing: a reported spec on it does not hold a spec job', async () => {
    const w = await world([card('SC6', 'carded', { paths: ['tools/scope.mjs', NEWFILE] }), card('SC10', 'carded', { paths: [NEWFILE] })])
    fs.mkdirSync(path.join(w.work, 'tools', 'test'), { recursive: true })
    fs.writeFileSync(path.join(w.work, NEWFILE), '// exists\n')
    await git(w.work, 'add', NEWFILE)
    await git(w.work, 'commit', '-q', '-m', 'the file lands')
    await git(w.work, 'push', '-q', 'origin', 'main')
    const sha = await git(w.work, 'rev-parse', 'origin/main')
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED SC6 spec')
    await claim(w, ['update', 'SC6', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
    expect(await nextOut(w)).not.toMatch(/^SC10 waiting on paths/m)
    expect(await nextFor(w, 'w2', 'spec')).toBe('CLAIMED SC10 spec')
  })

  test('ARC-15 A493 a spec still being written (not reported) does not hold the new file', async () => {
    const w = await world([card('SC6', 'carded', { paths: [NEWFILE] }), card('SC10', 'carded', { paths: [NEWFILE] })])
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED SC6 spec')
    expect(starts(await nextOut(w))).toContain('SC10')
  })
})
