// CQ11 acceptance tests (ARC-15 queue repairs, decision 0027): a check released with "wait:" is held until
// the Lead reopens it (CQ6's check went out 14 times after "wait:" releases), a Lead reopen can name the
// worker that may take the job, and a local-* worker is never offered a card that runs in the cloud only
// (CQ8 built this rule without a spec test, A473). tools run against a bare remote and a clone, the
// clock pinned with CLAIMS_NOW. Every child process is async (A247).
// Needs CQ8 landed: `update <card> check reopened` and the cloud-only rule are CQ8's.
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

const readTool = (f) => fs.readFileSync(path.join(TOOLS, f), 'utf8')

describe('CQ11 rule 1: a check released with "wait:" is held until the Lead reopens it', () => {
  test('ARC-15 a "wait:" check is not offered again, to anyone, alone or with every role allowed', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    await built(w)
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w3', '--note', 'wait: pg16 is down'])
    for (const who of ['w4', 'w5', 'w3']) {
      expect(await nextFor(w, who, 'check')).toBe('NOTHING')
      expect(await nextFor(w, who)).toBe('NOTHING')
    }
  })

  test('ARC-15 the hold survives a status change of the card and of its deps (what used to lift a build or spec hold)', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    await built(w)
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w3', '--note', 'WAIT: needs the train first'])
    const cards = [card('A', 'checking', { spec: 'abc123' })]
    fs.writeFileSync(path.join(w.work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.2', cards }))
    await git(w.work, 'add', 'plan')
    await git(w.work, 'commit', '-q', '-m', 'main moves')
    await git(w.work, 'push', '-q', 'origin', 'main')
    expect(await nextFor(w, 'w4', 'check')).toBe('NOTHING')
  })

  test('ARC-15 the Lead reopens the check and it is offered again, then held again by the next "wait:" release', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    await built(w)
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w3', '--note', 'wait: pg16 is down'])
    expect(await nextFor(w, 'w4', 'check')).toBe('NOTHING')
    await ok(w, ['update', 'A', 'check', 'reopened', '--worker', 'lead'])
    expect(await nextFor(w, 'w4', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w4', '--note', 'wait: still down'])
    expect(await nextFor(w, 'w5', 'check')).toBe('NOTHING')
  })

  test('ARC-15 a "wait:" check shows as waiting in the listing, not as an offered job', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    await built(w)
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w3', '--note', 'wait: pg16 is down'])
    expect(await listing(w)).toMatch(/^A check released \(waiting\)/m)
  })

  test('ARC-15 a plain release (no "wait:") is re-offered once, then held "needs Lead" (unchanged)', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    await built(w)
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w3', '--note', 'ran out of time'])
    expect(await nextFor(w, 'w4', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'released', '--worker', 'w4', '--note', 'ran out of time again'])
    expect(await nextFor(w, 'w5', 'check')).toBe('NOTHING')
    expect(await listing(w)).toMatch(/^A check released \(needs Lead\)/m)
  })
})

describe('CQ11 rule 2: a Lead reopen can name the worker that may take the job', () => {
  for (const role of ['spec', 'build']) {
    async function reopenWorld() {
      const w = await world([card('A', 'carded', { spec: role === 'build' ? 'abc123' : null })])
      if (role === 'spec') {
        expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED A spec')
        await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
        await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2: add the tests'])
      } else {
        expect(await nextFor(w, 'w0', 'build')).toBe('CLAIMED A build')
        await ok(w, ['update', 'A', 'build', 'released', '--worker', 'w0', '--note', 'could not finish'])
        await ok(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead', '--note', 'round 2'])
      }
      return w
    }

    test(`ARC-15 ${role}: with --for <name>, that worker takes the reopened job with "update working"`, async () => {
      const w = await reopenWorld()
      await ok(w, ['update', 'A', role, 'reopened', '--worker', 'lead', '--for', 'w7'])
      const r = await claim(w, ['update', 'A', role, 'working', '--worker', 'w7'])
      expect(r.code, r.out + r.err).toBe(0)
      expect(await listing(w)).toMatch(new RegExp(`^A ${role} working .*\\| w7 \\|`, 'm'))
    })

    test(`ARC-15 ${role}: with --for <name>, any other worker is refused (exit 6)`, async () => {
      const w = await reopenWorld()
      await ok(w, ['update', 'A', role, 'reopened', '--worker', 'lead', '--for', 'w7'])
      const r = await claim(w, ['update', 'A', role, 'working', '--worker', 'w9'])
      expect(r.code).toBe(6)
      expect(r.out).toMatch(/REFUSED/)
    })

    test(`ARC-15 ${role}: without --for, "update working" by a worker is still refused (the SC12 refusal) and only next hands the job out`, async () => {
      const w = await reopenWorld()
      const refused = await claim(w, ['update', 'A', role, 'working', '--worker', 'w7'])
      expect(refused.code).toBe(6)
      expect(await nextFor(w, 'w7', role)).toBe(`CLAIMED A ${role}`)
    })
  }

  test('ARC-15 --for is the Lead\'s alone: a worker reopening with --for is refused (exit 6)', async () => {
    const w = await world([card('A', 'carded')])
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED A spec')
    const r = await claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'w0', '--for', 'w0'])
    expect(r.code).toBe(6)
  })
})

describe('CQ11 rule 4: a local-* worker is never offered a card that runs in the cloud only (CQ8 rule 3)', () => {
  const CLOUD = { 'plan/cards/A.md': '# A t\n\nPhase 0. Size S. Where: cloud.\n' }
  const EITHER = { 'plan/cards/B.md': '# B t\n\nPhase 0. Size S. Where: local or cloud.\n' }

  test('ARC-15 spec: local-1 gets NOTHING on a cloud-only card, a cloud worker gets it', async () => {
    const w = await world([card('A')], CLOUD)
    expect(await nextFor(w, 'local-1', 'spec')).toBe('NOTHING')
    expect(await nextFor(w, 'local-1')).toBe('NOTHING')
    expect(await nextFor(w, 'cloud-aaaaaa', 'spec')).toBe('CLAIMED A spec')
  })

  test('ARC-15 build: local-1 gets NOTHING on a cloud-only card whose spec is ready', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })], CLOUD)
    expect(await nextFor(w, 'local-1', 'build')).toBe('NOTHING')
    expect(await nextFor(w, 'cloud-aaaaaa', 'build')).toBe('CLAIMED A build')
  })

  test('ARC-15 check: local-2 gets NOTHING on a cloud-only card with a reported build', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })], CLOUD)
    await built(w)
    expect(await nextFor(w, 'local-2', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'cloud-aaaaaa', 'check')).toBe('CLAIMED A check')
  })

  test('ARC-15 a card whose Where line allows local, or has none, is still offered to local-1', async () => {
    const w = await world([card('B'), card('C')], EITHER)
    expect(await nextFor(w, 'local-1', 'spec')).toBe('CLAIMED B spec')
    expect(await nextFor(w, 'local-1', 'spec')).toBe('CLAIMED C spec')
  })

  test('ARC-15 a cloud-only card is skipped and the next card is taken (the filter picks on, it does not stop)', async () => {
    const w = await world([card('A'), card('B')], { ...CLOUD, ...EITHER })
    expect(await nextFor(w, 'local-1', 'spec')).toBe('CLAIMED B spec')
  })

  test('ARC-15 next.mjs tags a cloud-only card "cloud only" and not a local-or-cloud one', async () => {
    const w = await world([card('A'), card('B')], { ...CLOUD, ...EITHER })
    const r = await run(w, 'next.mjs', ['3'])
    expect(r.out).toMatch(/START A \[[^\]]*cloud only[^\]]*\]/)
    expect(r.out).not.toMatch(/START B \[[^\]]*cloud only/)
  })

  test('ARC-15 the Where-line reader is one copy in tools/lib.mjs: claim.mjs and next.mjs hold no Where pattern of their own', async () => {
    const lib = await import('../lib.mjs')
    expect(typeof lib.cloudOnlyText).toBe('function')
    const cases = [
      ['Phase 0. Where: cloud.', true],
      ['Phase 0. Where: Cloud.', true],
      ['Where: cloud (needs Postgres 16)', true],
      ['Where: local or cloud.', false],
      ['Where: local.', false],
      ['Phase 0. No where line.', false],
      ['', false],
    ]
    for (const [text, want] of cases) expect(lib.cloudOnlyText(text), text).toBe(want)
    expect(lib.cloudOnlyText(undefined)).toBe(false)
    for (const f of ['claim.mjs', 'next.mjs']) {
      expect(readTool(f), f).not.toMatch(/Where: \(|Where:\s*\(/)
      expect(readTool(f), f).toMatch(/cloudOnlyText|lib\.mjs/)
    }
  })
})

// ---- A478 (c) and (a), A482: the Where reader and the queue rules added to CQ11 --------------------------

describe("CQ11 rule 5 (A478 a): a check is refused to any worker named anywhere in the card's spec or build history", () => {
  test('ARC-15 the spec writer of an earlier round, no longer the current spec claim, is not offered the check', async () => {
    const w = await world([card('A', 'carded')])
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED A spec')
    await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
    await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2'])
    expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
    await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'def456', '--validated', w.sha])
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'w2', '--note', '9 of 9 acceptance tests pass'])
    expect(await nextFor(w, 'w0', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w1', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w2', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
  })

  test('ARC-15 the builder of an earlier round is not offered the check of a later round built by someone else', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })])
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'w2', '--note', 'round 1'])
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED A check')
    await ok(w, ['update', 'A', 'check', 'failed', '--worker', 'w3', '--note', 'FAIL: one'])
    await ok(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])
    expect(await nextFor(w, 'w4', 'build')).toBe('CLAIMED A build')
    await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'w4', '--note', 'round 2'])
    expect(await nextFor(w, 'w2', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w4', 'check')).toBe('NOTHING')
    expect(await nextFor(w, 'w5', 'check')).toBe('CLAIMED A check')
  })

  test("ARC-15 a worker who worked on another card only is still offered this card's check (the refusal is per card)", async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' }), card('B', 'carded', { spec: 'abc123' })])
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'w2', '--note', 'built'])
    expect(await nextFor(w, 'w6', 'build')).toBe('CLAIMED B build')
    expect(await nextFor(w, 'w6', 'check')).toBe('CLAIMED A check')
  })
})

describe('CQ11 rule 6 (A478 c): no spec is offered for a card that rides a requested or checking train', () => {
  const train = (status) => ({
    'plan/train.json': JSON.stringify({
      status,
      branch: 'claude/train',
      head: '725bc456',
      cards: ['A'],
    }),
  })

  for (const status of ['requested', 'checking']) {
    test(`ARC-15 train ${status}: claim.mjs offers no spec for the train's card and still offers another card's`, async () => {
      const w = await world([card('A'), card('B')], train(status))
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED B spec')
      expect(await nextFor(w, 'w2', 'spec')).toBe('NOTHING')
    })

    test(`ARC-15 train ${status}: next.mjs prints no START for the train's card and still starts another card`, async () => {
      const w = await world([card('A'), card('B')], train(status))
      const r = await run(w, 'next.mjs', ['3'])
      expect(r.out).not.toMatch(/START A\b/)
      expect(r.out).toMatch(/START B\b/)
    })
  }

  for (const status of ['green', 'red', 'blocked', 'landed']) {
    test(`ARC-15 train ${status}: the card is offered a spec again (only requested and checking hold)`, async () => {
      const w = await world([card('A')], train(status))
      expect(await nextFor(w, 'w1', 'spec')).toBe('CLAIMED A spec')
    })
  }

  test('ARC-15 a reopened spec for a card on a checking train is not handed out either', async () => {
    const w = await world([card('A')])
    expect(await nextFor(w, 'w0', 'spec')).toBe('CLAIMED A spec')
    await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', w.sha])
    await ok(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead', '--note', 'round 2'])
    fs.writeFileSync(path.join(w.work, 'plan', 'train.json'), JSON.stringify({ status: 'checking', cards: ['A'] }))
    await git(w.work, 'add', 'plan')
    await git(w.work, 'commit', '-q', '-m', 'train')
    await git(w.work, 'push', '-q', 'origin', 'main')
    expect(await nextFor(w, 'w1', 'spec')).toBe('NOTHING')
  })
})

describe('CQ11 rule 7 (A482): one Where reader in tools/lib.mjs, answering per role', () => {
  // [header text, answer for spec, build, check]; 'cloud' means only a cloud-* worker may take that role.
  // The wordings are the distinct ones on main, grouped as the findings review of 3 Oct (CQ8-findings-1) rules them.
  const C = 'cloud'
  const A = 'any'
  const TABLE = [
    ['Phase 0. Size S. Where: cloud.', C, C, C],
    ['Phase 0. Size S. Where: Cloud.', C, C, C],
    ['Phase 0. Size S. Where: cloud only.', C, C, C],
    ['Phase 0. Size S. Where: cloud (Postgres 16).', C, C, C],
    ['Phase 0. Size S. Where: cloud (core: spec read and check by Opus subagents).', C, C, C],
    ['Phase 0. Size S. Where: cloud (Stryker).', C, C, C],
    ['Phase 3. Size M. Where: cloud (Postgres 16 for the lock-out; the Node parts run anywhere); Deps: none.', C, C, C],
    ['Phase 0. Size S. Where: local or cloud.', A, A, A],
    ['Phase 0. Size S. Where: local or cloud (Node scripts, no browser).', A, A, A],
    ['Phase 0. Size S. Where: local or cloud (core: spec read by an Opus subagent).', A, A, A],
    ['Phase 0. Size S. Where: local or cloud; check: cloud (journeys).', A, A, C],
    ['Phase 4. Size M. Where: local for unit tests; cloud for the journeys.', A, A, C],
    ['Phase 4. Size M. Where: local or cloud (unit tests); cloud (journeys) for the check.', A, A, C],
  ]
  const lib = () => import('../lib.mjs')

  test('ARC-15 whereFor answers every wording of the table for spec, build and check', async () => {
    const { whereFor } = await lib()
    expect(typeof whereFor).toBe('function')
    for (const [text, ...want] of TABLE) {
      expect(
        ['spec', 'build', 'check'].map((r) => whereFor(text, r)),
        text,
      ).toEqual(want)
    }
  })

  test('ARC-15 the reader reads only the header line: a Lead directive that quotes "Where: cloud" does not count', async () => {
    const { whereFor } = await lib()
    const text = '# A t\n\n**Lead directive, 3 Oct: the old line said "Where: cloud" and is wrong.**\n\nPhase 0. Size S. Where: local or cloud.\nTags: none\n\nWhere: cloud (quoted in the body)\n'
    expect(['spec', 'build', 'check'].map((r) => whereFor(text, r))).toEqual([A, A, A])
  })

  test('ARC-15 whereFor treats no Where line and an unparseable one as "any" and parseWhere says which (null)', async () => {
    const { whereFor, parseWhere } = await lib()
    expect(parseWhere('Phase 0. No line here.')).toBeNull()
    expect(parseWhere('')).toBeNull()
    expect(parseWhere(undefined)).toBeNull()
    expect(parseWhere('Phase 0. Where: a cloud worker (it creates package.json)')).toBeNull()
    expect(parseWhere('Phase 0. Where: design lane.')).toBeNull()
    for (const r of ['spec', 'build', 'check']) expect(whereFor('Phase 0. Where: a cloud worker (it creates package.json)', r)).toBe(A)
    expect(parseWhere('Phase 0. Where: cloud.')).toEqual({
      spec: C,
      build: C,
      check: C,
    })
    expect(parseWhere('Phase 0. Where: local or cloud; check: cloud (journeys).')).toEqual({ spec: A, build: A, check: C })
  })

  test('ARC-15 cloudOnlyText keeps its CQ8 meaning: true only when every role is cloud', async () => {
    const { cloudOnlyText } = await lib()
    for (const [text, ...want] of TABLE) expect(cloudOnlyText(text), text).toBe(want.every((x) => x === C))
  })

  test("ARC-15 the family template's line is read when the card has none, and the card's own line wins", async () => {
    const { whereFor, whereOf } = await lib()
    expect(typeof whereOf).toBe('function')
    const fam = 'Runs in the cloud.\nPhase 4. Where: cloud (journeys, Postgres 16).\n'
    expect(whereFor(whereOf('# V01 t\n\nPhase 4. Size S.\n', fam), 'build')).toBe(C)
    expect(whereFor(whereOf('# V01 t\n\nPhase 4. Size S. Where: local or cloud.\n', fam), 'build')).toBe(A)
    expect(whereFor(whereOf('# V01 t\n\nNo line.\n', 'Template with no line either.\n'), 'build')).toBe(A)
  })

  test('ARC-15 slices.json `where` is read by the same reader as a header line', async () => {
    const { whereFor, whereOf } = await lib()
    expect(['spec', 'build', 'check'].map((r) => whereFor(whereOf('# A\n', '', 'cloud'), r))).toEqual([C, C, C])
    expect(['spec', 'build', 'check'].map((r) => whereFor(whereOf('# A\n', '', 'local or cloud; check: cloud (journeys)'), r))).toEqual([A, A, C])
  })

  test('ARC-15 claim.mjs and next.mjs hold no Where pattern of their own (one copy, in lib.mjs)', () => {
    for (const f of ['claim.mjs', 'next.mjs']) {
      expect(readTool(f), f).not.toMatch(/Where: \(|Where:\s*\(|WHERE\s*=/)
      expect(readTool(f), f).toMatch(/whereFor|whereOf|lib\.mjs/)
    }
  })
})

describe('CQ11 rule 8 (A482): the queue honours the per-role answers, and only cloud-* names take a cloud job', () => {
  const MIXED = {
    'plan/cards/A.md': '# A t\n\nPhase 0. Size S. Where: local or cloud; check: cloud (journeys).\n',
  }
  const OLD = {
    'plan/cards/A.md': '# A t\n\nPhase 4. Size M. Where: local for unit tests; cloud for the journeys.\n',
  }
  const CLOUD = {
    'plan/cards/A.md': '# A t\n\nPhase 0. Size S. Where: cloud (Postgres 16).\n',
  }

  for (const [name, files] of [
    ['"local or cloud; check: cloud"', MIXED],
    ['"local for unit tests; cloud for the journeys"', OLD],
  ]) {
    test(`ARC-15 ${name}: local-1 takes the spec and the build, but is never offered the check; a cloud worker is`, async () => {
      const w = await world([card('A')], files)
      expect(await nextFor(w, 'local-1', 'spec')).toBe('CLAIMED A spec')
      await ok(w, ['update', 'A', 'spec', 'reported', '--worker', 'local-1', '--commit', 'abc123', '--validated', w.sha])
      expect(await nextFor(w, 'local-2', 'build')).toBe('CLAIMED A build')
      await ok(w, ['update', 'A', 'build', 'reported', '--worker', 'local-2', '--note', 'built'])
      expect(await nextFor(w, 'local-3', 'check')).toBe('NOTHING')
      expect(await nextFor(w, 'local-3')).toBe('NOTHING')
      expect(await nextFor(w, 'cloud-aaaaaa', 'check')).toBe('CLAIMED A check')
    })
  }

  test('ARC-15 a worker whose name is neither local-* nor cloud-* ("unknown", "worker-1") is given no cloud-only job in any role', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc123' })], CLOUD)
    for (const who of ['unknown', 'worker-1']) {
      expect(await nextFor(w, who, 'build')).toBe('NOTHING')
      expect(await nextFor(w, who, 'spec')).toBe('NOTHING')
    }
    const noName = await claim(w, ['next', '--roles', 'build,spec,check'])
    expect(noName.out.split('\n')[0]).toBe('NOTHING')
    expect(await nextFor(w, 'cloud-aaaaaa', 'build')).toBe('CLAIMED A build')
  })

  test('ARC-15 a worker with an anywhere card is still served by a non-cloud name (the filter is for cloud-only jobs only)', async () => {
    const w = await world([card('B')], {
      'plan/cards/B.md': '# B t\n\nPhase 0. Size S. Where: local or cloud.\n',
    })
    expect(await nextFor(w, 'worker-1', 'spec')).toBe('CLAIMED B spec')
  })

  test('ARC-15 slices.json `where` decides when the card file has no Where line, for claim.mjs and next.mjs alike', async () => {
    const w = await world([card('A', 'carded', { where: 'cloud' }), card('B')], { 'plan/cards/B.md': '# B t\n\nPhase 0. Where: local or cloud.\n' })
    expect(await nextFor(w, 'local-1', 'spec')).toBe('CLAIMED B spec')
    const r = await run(w, 'next.mjs', ['3'])
    expect(r.out).toMatch(/START A \[[^\]]*cloud only/)
  })

  test('ARC-15 next.mjs tags a card "cloud only" only when every role is cloud; the mixed card is not tagged', async () => {
    const w = await world([card('A'), card('B')], {
      ...CLOUD,
      'plan/cards/B.md': MIXED['plan/cards/A.md'].replace('# A', '# B'),
    })
    const r = await run(w, 'next.mjs', ['3'])
    expect(r.out).toMatch(/START A \[[^\]]*cloud only/)
    expect(r.out).not.toMatch(/START B \[[^\]]*cloud only/)
  })
})

describe("CQ11 rule 9 (R1): every carded card has a Where line, its own or its family's, that parses in the vocabulary", () => {
  const ROOT = path.resolve(TOOLS, '..')
  const lib = () => import('../lib.mjs')

  test('ARC-15 planted: a card whose Where line is "a cloud worker" fails the check, one with no line anywhere fails it, a good one passes', async () => {
    const { whereLines } = await lib()
    expect(typeof whereLines).toBe('function')
    const cards = [
      {
        id: 'X1',
        text: '# X1\n\nPhase 0. Where: a cloud worker (it creates package.json)\n',
      },
      {
        id: 'X2',
        text: '# X2\n\nPhase 0. Size S.\n',
        family: 'F',
        familyText: 'Template with no Where line.\n',
      },
      { id: 'X3', text: '# X3\n\nPhase 0. Where: local or cloud.\n' },
      {
        id: 'X4',
        text: '# X4\n\nPhase 0. Size S.\n',
        family: 'F2',
        familyText: 'Phase 4. Where: cloud (journeys, Postgres 16).\n',
      },
    ]
    const bad = whereLines(cards)
    expect(bad.map((b) => b.id).sort()).toEqual(['X1', 'X2'])
  })

  test('ARC-15 on main every carded, non-design card passes (the Lead rewrites the odd wordings before this card is checked; offenders are listed)', async () => {
    const { whereLines } = await lib()
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'slices.json'), 'utf8'))
    const rd = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), 'utf8') : '')
    const cards = index.cards
      .filter((c) => c.status === 'carded' && c.lane !== 'design')
      .map((c) => ({
        id: c.id,
        text: rd(`plan/cards/${c.id}.md`),
        family: c.family,
        familyText: c.family ? rd(`plan/cards/families/${c.family}.md`) : '',
        where: c.where,
      }))
    expect(whereLines(cards).map((b) => `${b.id}: ${b.why}`)).toEqual([])
  })
})
