// Tests for the queue repairs: tools/claim.mjs, tools/next.mjs, tools/scope.mjs, tools/status.mjs.
// Node built-ins and temp git repos only; the clock is pinned with CLAIMS_NOW.
// Every child process is async: blocking execFileSync calls starve the vitest worker RPC (A247).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

// Each test spawns several node and git processes; Windows is slow at that.
vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const T0 = '2026-10-02T12:00:00Z'
const at = (min) => new Date(Date.parse(T0) + min * 60000).toISOString()
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

const CARDS = [
  { id: 'A', status: 'carded', spec: 'abc123', deps: [], paths: ['src/a/**'] },
  { id: 'B', status: 'carded', spec: null, deps: [], paths: ['src/b/**'] },
]

// A bare remote, one clone with a copy of tools/, main pushed with the plan files.
async function world({ mode = {}, cards = CARDS, files = {} } = {}) {
  const remote = mk('remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan', 'cards'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'x', cards }))
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12, ...mode }))
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(work, f)), { recursive: true })
    fs.writeFileSync(path.join(work, f), c)
  }
  await git(work, 'add', 'tools', 'plan', ...Object.keys(files))
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return { remote, work }
}

async function run(w, tool, args, now = T0, env = {}) {
  const r = await exec('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    env: { ...process.env, CLAIMS_NOW: now, CLAIMS_BACKOFF_MS: '1', ...env },
  })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
const claim = (w, args, now, env) => run(w, 'claim.mjs', args, now, env)
const claimsCommits = async (w) => Number(await git(w.remote, 'rev-list', '--count', 'claude/claims'))

// Make the remote refuse the first `n` pushes to claude/claims (a lost race), counting every attempt.
function rejectFirst(w, n) {
  const counter = path.join(w.remote, 'attempts.txt').replace(/\\/g, '/')
  fs.writeFileSync(counter, '0')
  const hook = path.join(w.remote, 'hooks', 'pre-receive')
  fs.writeFileSync(
    hook,
    `#!/bin/sh\nwhile read old new ref; do\n if [ "$ref" = "refs/heads/claude/claims" ]; then\n  c=$(cat "${counter}"); c=$((c+1)); echo $c > "${counter}"\n  if [ $c -le ${n} ]; then echo "non-fast-forward (simulated)" >&2; exit 1; fi\n fi\ndone\nexit 0\n`,
  )
  fs.chmodSync(hook, 0o755)
  return () => Number(fs.readFileSync(counter, 'utf8'))
}

describe('claim push retry', () => {
  test('retry: a rejected push is retried with backoff and then succeeds', async () => {
    const w = await world()
    const attempts = rejectFirst(w, 2)
    const r = await claim(w, ['next', '--worker', 'w1'])
    expect(r.out).toBe('CLAIMED A build')
    expect(attempts()).toBe(3)
  })

  test('retry: gives up after at most 6 tries with exit 5', async () => {
    const w = await world()
    const attempts = rejectFirst(w, 99)
    const r = await claim(w, ['next', '--worker', 'w1'])
    expect(r.code).toBe(5)
    expect(r.out).toMatch(/RACE/)
    expect(attempts()).toBe(6)
  })
})

describe('claim owner check', () => {
  test('owner: another worker cannot update a claim; the holder and the lead can', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1'])
    const bad = await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w2'])
    expect(bad.code).toBe(6)
    expect(bad.out).toMatch(/REFUSED/)
    expect((await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'])).code).toBe(0)
    const lead = await claim(w, ['update', 'A', 'build', 'released', '--worker', 'lead'])
    expect(lead.code).toBe(0)
    // the holder's name stays on the claim
    expect((await claim(w, ['list'])).out).toMatch(/A build released.*\| w1 \|/)
  })

  test('owner: a worker cannot beat a claim it does not hold', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1'])
    expect((await claim(w, ['beat', 'A', 'build', '--worker', 'w2'])).code).toBe(6)
  })
})

describe('claim heartbeat', () => {
  test('heartbeat: 90 minutes with no beat is stale and the job can be taken again', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1'], T0)
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'build'], at(89))).out).toBe('NOTHING')
    expect((await claim(w, ['list'], at(100))).out).toMatch(/A build working \(stale\) \| w1 \| 100 min since last beat/)
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'build'], at(100))).out).toBe('CLAIMED A build')
  })

  test('heartbeat: a beat keeps the claim alive and list shows age since the beat', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1'], T0)
    expect((await claim(w, ['beat', 'A', 'build', '--worker', 'w1'], at(80))).out).toBe('BEAT A build')
    expect((await claim(w, ['list'], at(100))).out).toMatch(/A build working \| w1 \| 20 min since last beat/)
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'build'], at(100))).out).toBe('NOTHING')
  })

  test('heartbeat: list reads all claims in one pass (many claims, correct output)', async () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({ id: `C${i}`, status: 'carded', spec: 's', deps: [], paths: [`src/c${i}/**`] }))
    const w = await world({ cards })
    for (let i = 0; i < 12; i++) await claim(w, ['next', '--worker', `w${i}`], T0)
    expect((await claim(w, ['list'])).out.split('\n')).toHaveLength(12)
  })
})

describe('check FAIL holds the build for the findings review', () => {
  test('hold: FAIL is one push, the build goes to hold-findings, only the lead reopens', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1'])
    await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'])
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'check'])).out).toBe('CLAIMED A check')
    const before = await claimsCommits(w)
    const f = await claim(w, ['update', 'A', 'check', 'failed', '--worker', 'w2', '--note', '3 findings'])
    expect(f.out).toMatch(/UPDATED A check failed \(build on hold-findings\)/)
    expect(await claimsCommits(w)).toBe(before + 1)
    const list = (await claim(w, ['list'])).out
    expect(list).toMatch(/A build hold-findings/)
    expect(list).toMatch(/A check failed/)
    // the queue does not reopen the build, for any worker, not even the original builder
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'build'])).out).toBe('NOTHING')
    expect((await claim(w, ['next', '--worker', 'w1', '--roles', 'build'])).out).toBe('NOTHING')
    // only the lead reopens
    expect((await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'w1'])).code).toBe(6)
    expect((await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'w3'])).code).toBe(6)
    expect((await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])).out).toBe('UPDATED A build reopened')
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'build'])).out).toBe('CLAIMED A build')
  })
})

describe('a reopened build is checked again', () => {
  test('recheck: after a PASS, a reopen and a new reported build, a check is offered again', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(0))
    await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'], at(10))
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'check'], at(11))).out).toBe('CLAIMED A check')
    await claim(w, ['update', 'A', 'check', 'reported', '--worker', 'w2', '--note', 'pass'], at(20))
    // the same build, already passed: no second check
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'check'], at(21))).out).toBe('NOTHING')
    // the Lead reopens (a red train); a new build is claimed and reported
    expect((await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'], at(30))).out).toBe('UPDATED A build reopened')
    expect((await claim(w, ['next', '--worker', 'w4', '--roles', 'build'], at(31))).out).toBe('CLAIMED A build')
    // while the new build is only working, no check
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'check'], at(32))).out).toBe('NOTHING')
    await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w4'], at(40))
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'check'], at(41))).out).toBe('CLAIMED A check')
  })

  test('recheck: a check that is still working is not offered twice', async () => {
    const w = await world()
    await claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(0))
    await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'], at(10))
    await claim(w, ['next', '--worker', 'w2', '--roles', 'check'], at(11))
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'check'], at(12))).out).toBe('NOTHING')
  })
})

describe('dependency gate', () => {
  const mkCards = (depStatus = 'carded', depSpec = 'd1') => [
    { id: 'D', status: depStatus, spec: depSpec, deps: [], paths: ['src/d/**'] },
    { id: 'S', status: 'carded', spec: null, deps: ['D'], paths: ['src/s/**'] },
    { id: 'W', status: 'carded', spec: 'w1', deps: ['D'], paths: ['src/w/**'] },
  ]
  const only = async (w, role, worker = 'w9') => (await claim(w, ['next', '--worker', worker, '--roles', role])).out

  test('gate: a spec is not offered while a dep has no reported build', async () => {
    const w = await world({ cards: mkCards() })
    expect(await only(w, 'spec')).toBe('NOTHING')
    await claim(w, ['next', '--worker', 'w1', '--roles', 'build']) // D build working, not reported
    expect(await only(w, 'spec')).toBe('NOTHING')
  })

  test('gate: a spec is offered once every dep has a reported build, but its build waits for merge', async () => {
    const w = await world({ cards: mkCards() })
    await claim(w, ['next', '--worker', 'w1', '--roles', 'build'])
    await claim(w, ['update', 'D', 'build', 'reported', '--worker', 'w1'])
    expect(await only(w, 'spec')).toBe('CLAIMED S spec')
    expect(await only(w, 'build')).toBe('NOTHING') // W has a spec but D is not merged
  })

  test('gate: a build is offered when every dep is done', async () => {
    const w = await world({ cards: mkCards('done') })
    expect(await only(w, 'build')).toBe('CLAIMED W build')
    expect(await only(w, 'spec')).toBe('CLAIMED S spec')
  })

  test('gate: checks are not gated by deps', async () => {
    const w = await world({ cards: mkCards() })
    // W depends on D, which is not merged; its build was reported anyway (written directly)
    await claim(w, ['update', 'W', 'build', 'reported', '--worker', 'w1'])
    expect(await only(w, 'check')).toBe('CLAIMED W check')
  })

  test('gate: a check on a card whose dep is parked still flows', async () => {
    const w = await world({ cards: mkCards('parked') })
    await claim(w, ['update', 'W', 'build', 'reported', '--worker', 'w1'])
    expect(await only(w, 'check')).toBe('CLAIMED W check')
    expect(await only(w, 'build')).toBe('NOTHING')
  })

  test('gate: a parked dep blocks the spec and the build', async () => {
    const w = await world({ cards: mkCards('parked') })
    expect(await only(w, 'spec')).toBe('NOTHING')
    expect(await only(w, 'build')).toBe('NOTHING')
  })

  test('gate: next.mjs says which deps a card is waiting on', async () => {
    const w = await world({ cards: mkCards() })
    const r = await run(w, 'next.mjs', ['5'])
    expect(r.out).toMatch(/waiting on deps: .*S \(D\)/)
    expect(r.out).toMatch(/W \(D\)/)
    expect(r.out).toMatch(/START D /)
    expect(r.out).not.toMatch(/START S /)
  })

  test('gate: next.mjs sees a reported dep build and lets the spec start', async () => {
    const w = await world({ cards: mkCards() })
    await claim(w, ['next', '--worker', 'w1', '--roles', 'build'])
    await claim(w, ['update', 'D', 'build', 'reported', '--worker', 'w1'])
    const r = await run(w, 'next.mjs', ['5'])
    expect(r.out).toMatch(/START S .*NEEDS SPEC FIRST/)
    expect(r.out).toMatch(/W \(D\)/)
  })

  test('gate: next.mjs reads a reported spec from the claims and no longer says NEEDS SPEC FIRST', async () => {
    const cards = [{ id: 'S', status: 'carded', spec: null, deps: [], paths: ['src/s/**'] }]
    const w = await world({ cards })
    expect((await run(w, 'next.mjs', ['5'])).out).toMatch(/START S .*NEEDS SPEC FIRST/)
    await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    await claim(w, ['update', 'S', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc1234', '--validated', await git(w.work, 'rev-parse', 'HEAD')])
    const r = await run(w, 'next.mjs', ['5'])
    expect(r.out).toMatch(/START S .*spec reported/)
    expect(r.out).not.toMatch(/NEEDS SPEC FIRST/)
  })

  test('gate: a reported spec is judged as a build: next.mjs waits on an unmerged dep, and next and claim offer the build once the dep is done', async () => {
    const mk2 = (depStatus) => [
      { id: 'D', status: depStatus, spec: 'd1', deps: [], paths: ['src/d/**'] },
      { id: 'S', status: 'carded', spec: null, deps: ['D'], paths: ['src/s/**'] },
    ]
    const reportSpec = async (w) => {
      await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
      await claim(w, ['update', 'S', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc1234', '--validated', await git(w.work, 'rev-parse', 'HEAD')])
    }
    // dep carded with a reported build but not merged: a spec job would be offered, a build is not
    const open = await world({ cards: mk2('carded') })
    await claim(open, ['update', 'D', 'build', 'reported', '--worker', 'w0'])
    await claim(open, ['update', 'S', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc1234', '--validated', await git(open.work, 'rev-parse', 'HEAD')])
    const waiting = (await run(open, 'next.mjs', ['5'])).out
    expect(waiting).not.toMatch(/START S /)
    expect(waiting).toMatch(/waiting on deps: .*S \(D\)/)
    expect((await claim(open, ['next', '--worker', 'w2', '--roles', 'build'])).out).not.toMatch(/CLAIMED S/)
    // dep merged: both offer the build
    const done = await world({ cards: mk2('done') })
    await reportSpec(done)
    expect((await run(done, 'next.mjs', ['5'])).out).toMatch(/START S .*spec reported/)
    expect((await claim(done, ['next', '--worker', 'w2', '--roles', 'build'])).out).toBe('CLAIMED S build')
  })

  test('gate: next.mjs still says NEEDS SPEC FIRST for a reopened spec', async () => {
    const cards = [{ id: 'S', status: 'carded', spec: null, deps: [], paths: ['src/s/**'] }]
    const w = await world({ cards })
    await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    await claim(w, ['update', 'S', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc1234', '--validated', await git(w.work, 'rev-parse', 'HEAD')])
    await claim(w, ['update', 'S', 'spec', 'reopened', '--worker', 'lead'])
    expect((await run(w, 'next.mjs', ['5'])).out).toMatch(/START S .*NEEDS SPEC FIRST/)
  })
})

describe('spec reopen', () => {
  const cards = [{ id: 'A', status: 'carded', spec: null, deps: [], paths: ['src/a/**'] }]
  test('reopen: the lead may reopen a spec and it is offered again; a worker is refused', async () => {
    const w = await world({ cards })
    await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    await claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc', '--validated', await git(w.work, 'rev-parse', 'HEAD')])
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'spec'])).out).toBe('NOTHING')
    expect((await claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'w1'])).code).toBe(6)
    expect((await claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'w2'])).code).toBe(6)
    expect((await claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead'])).out).toBe('UPDATED A spec reopened')
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'spec'])).out).toBe('CLAIMED A spec')
  })

  test('reopen: a role other than build or spec is still refused', async () => {
    const w = await world({ cards })
    expect((await claim(w, ['update', 'A', 'check', 'reopened', '--worker', 'lead'])).code).toBe(6)
  })
})

describe('toolchain refit of a reported spec', () => {
  const cards = [{ id: 'S', status: 'carded', spec: null, deps: [], paths: ['src/s/**'] }]
  const head = (w) => git(w.work, 'rev-parse', 'HEAD')
  async function pushMain(w, file) {
    fs.mkdirSync(path.dirname(path.join(w.work, file)), { recursive: true })
    fs.writeFileSync(path.join(w.work, file), `x${Math.random()}`)
    await git(w.work, 'add', file)
    await git(w.work, 'commit', '-q', '-m', `change ${file}`)
    await git(w.work, 'push', '-q', 'origin', 'main')
  }
  // A spec reported at `validated` (a sha on main), or with none.
  async function reported(w, validated) {
    await claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    const extra = validated ? ['--validated', validated] : []
    return claim(w, ['update', 'S', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc', ...extra])
  }

  test('refit: a spec validated on a main with no toolchain change since keeps its build offer', async () => {
    const w = await world({ cards })
    await reported(w, await head(w))
    await pushMain(w, 'src/s/other.ts')
    await pushMain(w, 'sub/package.json')
    await pushMain(w, 'tools/test/not-a-rule.test.mjs')
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'build'])).out).toBe('CLAIMED S build')
  })

  for (const file of ['vitest.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'package.json', 'tools/test/toolchain-rules.test.mjs', 'tools/test/db-rules.test.mjs']) {
    test(`refit: ${file} changed on main since the validated sha reopens the spec as a toolchain refit`, async () => {
      const w = await world({ cards })
      await reported(w, await head(w))
      await pushMain(w, file)
      expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'build'])).out).toBe('NOTHING')
      expect((await claim(w, ['list'])).out).toMatch(/S spec reported \(toolchain refit\)/)
      expect((await run(w, 'next.mjs', ['5'])).out).toMatch(/START S .*NEEDS SPEC FIRST/)
      expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'spec'])).out).toBe('CLAIMED S spec')
      expect((await claim(w, ['list'])).out).toMatch(/S spec working.*\| toolchain refit/)
    })
  }

  test('refit: a spec report with no validated sha is offered as a refit', async () => {
    const w = await world({ cards })
    await reported(w, null)
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'build'])).out).toBe('NOTHING')
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'spec'])).out).toBe('CLAIMED S spec')
  })

  test('refit: a validated sha git does not know is offered as a refit', async () => {
    const w = await world({ cards })
    await reported(w, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
    expect((await claim(w, ['next', '--worker', 'w2', '--roles', 'spec'])).out).toBe('CLAIMED S spec')
  })

  test('refit: the refit spec, reported again on the new main, lets the build start', async () => {
    const w = await world({ cards })
    await reported(w, await head(w))
    await pushMain(w, 'vitest.config.ts')
    await claim(w, ['next', '--worker', 'w2', '--roles', 'spec'])
    await claim(w, ['update', 'S', 'spec', 'reported', '--worker', 'w2', '--commit', 'def', '--validated', await head(w)])
    expect((await claim(w, ['next', '--worker', 'w3', '--roles', 'build'])).out).toBe('CLAIMED S build')
  })
})

describe('wind-down', () => {
  const mode = { wind_down_at: at(60) }
  test('wind-down: after the time no new build is handed out, but specs still flow', async () => {
    const w = await world({ mode })
    expect((await claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(61))).out).toBe('NOTHING')
    expect((await claim(w, ['next', '--worker', 'w1'], at(61))).out).toBe('CLAIMED B spec')
  })

  test('wind-down: before the time builds still flow', async () => {
    const w = await world({ mode })
    expect((await claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(59))).out).toBe('CLAIMED A build')
  })

  test('wind-down: checks still flow after the time', async () => {
    const w = await world({ mode })
    await claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(10))
    await claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'], at(20))
    expect((await claim(w, ['next', '--worker', 'w2'], at(61))).out).toBe('CLAIMED A check')
  })

  test('wind-down: status prints the time and says when it has passed', async () => {
    const w = await world({ mode })
    expect((await run(w, 'status.mjs', [], at(10))).out).toMatch(/wind-down at /)
    expect((await run(w, 'status.mjs', [], at(10))).out).not.toMatch(/PASSED/)
    expect((await run(w, 'status.mjs', [], at(61))).out).toMatch(/PASSED/)
  })
})

describe('scope allows listed test and golden paths', () => {
  const card = '# A\n\nPaths: src/a/**\n\n## Tests\n- `src/a/extra/` is not a file\n- `e2e/a/journey.spec.ts`\n\nGolden: fixtures/a/golden.json, fixtures/a/more.json\n'
  const scopeWorld = async (changed) => {
    const w = await world({ files: { 'plan/cards/A.md': card, 'src/a/seed.ts': 'x' } })
    await git(w.work, 'checkout', '-q', '-b', 'work')
    for (const f of changed) {
      fs.mkdirSync(path.dirname(path.join(w.work, f)), { recursive: true })
      fs.writeFileSync(path.join(w.work, f), 'x')
    }
    await git(w.work, 'add', ...changed)
    await git(w.work, 'commit', '-q', '-m', 'work')
    return w
  }

  test('scope: acceptance files, __golden__ folders and paths the card lists are not out of scope', async () => {
    const w = await scopeWorld([
      'src/a/x.ts',
      'src/other/x.acceptance.test.ts',
      'src/other/__golden__/x.txt',
      'e2e/a/journey.spec.ts',
      'fixtures/a/golden.json',
      'fixtures/a/more.json',
      'reports/A-build.md',
    ])
    const r = await run(w, 'scope.mjs', ['A', 'main'])
    expect(r.out).toMatch(/SCOPE OK A/)
    expect(r.code).toBe(0)
  })

  test('scope: a file that is neither a card path nor a listed test path still fails', async () => {
    const w = await scopeWorld(['src/a/x.ts', 'fixtures/a/other.json', 'src/zzz/y.ts'])
    const r = await run(w, 'scope.mjs', ['A', 'main'])
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/2 file\(s\) outside/)
    expect(r.out).toMatch(/src\/zzz\/y\.ts/)
  })
})
