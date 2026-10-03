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
