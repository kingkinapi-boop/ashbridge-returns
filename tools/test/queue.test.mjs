// Tests for the queue repairs: tools/claim.mjs, tools/scope.mjs, tools/status.mjs.
// Node built-ins and temp git repos only; the clock is pinned with CLAIMS_NOW.
import { execFileSync, spawnSync } from 'node:child_process'
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
const git = (cwd, ...a) => execFileSync('git', [...G, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const CARDS = [
  { id: 'A', status: 'carded', spec: 'abc123', deps: [], paths: ['src/a/**'] },
  { id: 'B', status: 'carded', spec: null, deps: [], paths: ['src/b/**'] },
]

// A bare remote, one clone with a copy of tools/, main pushed with the plan files.
function world({ mode = {}, cards = CARDS, files = {} } = {}) {
  const remote = mk('remote')
  git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('work')
  git(work, 'init', '-q', '-b', 'main')
  git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan', 'cards'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'x', cards }))
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12, ...mode }))
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(work, f)), { recursive: true })
    fs.writeFileSync(path.join(work, f), c)
  }
  git(work, 'add', 'tools', 'plan', ...Object.keys(files))
  git(work, 'commit', '-q', '-m', 'main')
  git(work, 'push', '-q', 'origin', 'main')
  return { remote, work }
}

function run(w, tool, args, now = T0, env = {}) {
  const r = spawnSync('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    encoding: 'utf8',
    env: { ...process.env, CLAIMS_NOW: now, CLAIMS_BACKOFF_MS: '1', ...env },
  })
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const claim = (w, args, now, env) => run(w, 'claim.mjs', args, now, env)
const claimsCommits = (w) => Number(git(w.remote, 'rev-list', '--count', 'claude/claims'))

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
  test('retry: a rejected push is retried with backoff and then succeeds', () => {
    const w = world()
    const attempts = rejectFirst(w, 2)
    const r = claim(w, ['next', '--worker', 'w1'])
    expect(r.out).toBe('CLAIMED A build')
    expect(attempts()).toBe(3)
  })

  test('retry: gives up after at most 6 tries with exit 5', () => {
    const w = world()
    const attempts = rejectFirst(w, 99)
    const r = claim(w, ['next', '--worker', 'w1'])
    expect(r.code).toBe(5)
    expect(r.out).toMatch(/RACE/)
    expect(attempts()).toBe(6)
  })
})

describe('claim owner check', () => {
  test('owner: another worker cannot update a claim; the holder and the lead can', () => {
    const w = world()
    claim(w, ['next', '--worker', 'w1'])
    const bad = claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w2'])
    expect(bad.code).toBe(6)
    expect(bad.out).toMatch(/REFUSED/)
    expect(claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1']).code).toBe(0)
    const lead = claim(w, ['update', 'A', 'build', 'released', '--worker', 'lead'])
    expect(lead.code).toBe(0)
    // the holder's name stays on the claim
    expect(claim(w, ['list']).out).toMatch(/A build released.*\| w1 \|/)
  })

  test('owner: a worker cannot beat a claim it does not hold', () => {
    const w = world()
    claim(w, ['next', '--worker', 'w1'])
    expect(claim(w, ['beat', 'A', 'build', '--worker', 'w2']).code).toBe(6)
  })
})

describe('claim heartbeat', () => {
  test('heartbeat: 90 minutes with no beat is stale and the job can be taken again', () => {
    const w = world()
    claim(w, ['next', '--worker', 'w1'], T0)
    expect(claim(w, ['next', '--worker', 'w2', '--roles', 'build'], at(89)).out).toBe('NOTHING')
    expect(claim(w, ['list'], at(100)).out).toMatch(/A build working \(stale\) \| w1 \| 100 min since last beat/)
    expect(claim(w, ['next', '--worker', 'w2', '--roles', 'build'], at(100)).out).toBe('CLAIMED A build')
  })

  test('heartbeat: a beat keeps the claim alive and list shows age since the beat', () => {
    const w = world()
    claim(w, ['next', '--worker', 'w1'], T0)
    expect(claim(w, ['beat', 'A', 'build', '--worker', 'w1'], at(80)).out).toBe('BEAT A build')
    expect(claim(w, ['list'], at(100)).out).toMatch(/A build working \| w1 \| 20 min since last beat/)
    expect(claim(w, ['next', '--worker', 'w2', '--roles', 'build'], at(100)).out).toBe('NOTHING')
  })

  test('heartbeat: list reads all claims in one pass (many claims, correct output)', () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({ id: `C${i}`, status: 'carded', spec: 's', deps: [], paths: [`src/c${i}/**`] }))
    const w = world({ cards })
    for (let i = 0; i < 12; i++) claim(w, ['next', '--worker', `w${i}`], T0)
    expect(claim(w, ['list']).out.split('\n')).toHaveLength(12)
  })
})

describe('check FAIL holds the build for the findings review', () => {
  test('hold: FAIL is one push, the build goes to hold-findings, only the lead reopens', () => {
    const w = world()
    claim(w, ['next', '--worker', 'w1'])
    claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'])
    expect(claim(w, ['next', '--worker', 'w2', '--roles', 'check']).out).toBe('CLAIMED A check')
    const before = claimsCommits(w)
    const f = claim(w, ['update', 'A', 'check', 'failed', '--worker', 'w2', '--note', '3 findings'])
    expect(f.out).toMatch(/UPDATED A check failed \(build on hold-findings\)/)
    expect(claimsCommits(w)).toBe(before + 1)
    const list = claim(w, ['list']).out
    expect(list).toMatch(/A build hold-findings/)
    expect(list).toMatch(/A check failed/)
    // the queue does not reopen the build, for any worker, not even the original builder
    expect(claim(w, ['next', '--worker', 'w3', '--roles', 'build']).out).toBe('NOTHING')
    expect(claim(w, ['next', '--worker', 'w1', '--roles', 'build']).out).toBe('NOTHING')
    // only the lead reopens
    expect(claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'w1']).code).toBe(6)
    expect(claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'w3']).code).toBe(6)
    expect(claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead']).out).toBe('UPDATED A build reopened')
    expect(claim(w, ['next', '--worker', 'w3', '--roles', 'build']).out).toBe('CLAIMED A build')
  })
})

describe('dependency gate', () => {
  const mkCards = (depStatus = 'carded', depSpec = 'd1') => [
    { id: 'D', status: depStatus, spec: depSpec, deps: [], paths: ['src/d/**'] },
    { id: 'S', status: 'carded', spec: null, deps: ['D'], paths: ['src/s/**'] },
    { id: 'W', status: 'carded', spec: 'w1', deps: ['D'], paths: ['src/w/**'] },
  ]
  const only = (w, role, worker = 'w9') => claim(w, ['next', '--worker', worker, '--roles', role]).out

  test('gate: a spec is not offered while a dep has no reported build', () => {
    const w = world({ cards: mkCards() })
    expect(only(w, 'spec')).toBe('NOTHING')
    claim(w, ['next', '--worker', 'w1', '--roles', 'build']) // D build working, not reported
    expect(only(w, 'spec')).toBe('NOTHING')
  })

  test('gate: a spec is offered once every dep has a reported build, but its build waits for merge', () => {
    const w = world({ cards: mkCards() })
    claim(w, ['next', '--worker', 'w1', '--roles', 'build'])
    claim(w, ['update', 'D', 'build', 'reported', '--worker', 'w1'])
    expect(only(w, 'spec')).toBe('CLAIMED S spec')
    expect(only(w, 'build')).toBe('NOTHING') // W has a spec but D is not merged
  })

  test('gate: a build is offered when every dep is done', () => {
    const w = world({ cards: mkCards('done') })
    expect(only(w, 'build')).toBe('CLAIMED W build')
    expect(only(w, 'spec')).toBe('CLAIMED S spec')
  })

  test('gate: checks are not gated by deps', () => {
    const w = world({ cards: mkCards() })
    // W depends on D, which is not merged; its build was reported anyway (written directly)
    claim(w, ['update', 'W', 'build', 'reported', '--worker', 'w1'])
    expect(only(w, 'check')).toBe('CLAIMED W check')
  })

  test('gate: a parked dep blocks the spec and the build', () => {
    const w = world({ cards: mkCards('parked') })
    expect(only(w, 'spec')).toBe('NOTHING')
    expect(only(w, 'build')).toBe('NOTHING')
  })

  test('gate: next.mjs says which deps a card is waiting on', () => {
    const w = world({ cards: mkCards() })
    const r = run(w, 'next.mjs', ['5'])
    expect(r.out).toMatch(/waiting on deps: .*S \(D\)/)
    expect(r.out).toMatch(/W \(D\)/)
    expect(r.out).toMatch(/START D /)
    expect(r.out).not.toMatch(/START S /)
  })

  test('gate: next.mjs sees a reported dep build and lets the spec start', () => {
    const w = world({ cards: mkCards() })
    claim(w, ['next', '--worker', 'w1', '--roles', 'build'])
    claim(w, ['update', 'D', 'build', 'reported', '--worker', 'w1'])
    const r = run(w, 'next.mjs', ['5'])
    expect(r.out).toMatch(/START S .*NEEDS SPEC FIRST/)
    expect(r.out).toMatch(/W \(D\)/)
  })
})

describe('spec reopen', () => {
  const cards = [{ id: 'A', status: 'carded', spec: null, deps: [], paths: ['src/a/**'] }]
  test('reopen: the lead may reopen a spec and it is offered again; a worker is refused', () => {
    const w = world({ cards })
    claim(w, ['next', '--worker', 'w1', '--roles', 'spec'])
    claim(w, ['update', 'A', 'spec', 'reported', '--worker', 'w1', '--commit', 'abc'])
    expect(claim(w, ['next', '--worker', 'w2', '--roles', 'spec']).out).toBe('NOTHING')
    expect(claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'w1']).code).toBe(6)
    expect(claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'w2']).code).toBe(6)
    expect(claim(w, ['update', 'A', 'spec', 'reopened', '--worker', 'lead']).out).toBe('UPDATED A spec reopened')
    expect(claim(w, ['next', '--worker', 'w2', '--roles', 'spec']).out).toBe('CLAIMED A spec')
  })

  test('reopen: a role other than build or spec is still refused', () => {
    const w = world({ cards })
    expect(claim(w, ['update', 'A', 'check', 'reopened', '--worker', 'lead']).code).toBe(6)
  })
})

describe('wind-down', () => {
  const mode = { wind_down_at: at(60) }
  test('wind-down: after the time no new build is handed out, but specs still flow', () => {
    const w = world({ mode })
    expect(claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(61)).out).toBe('NOTHING')
    expect(claim(w, ['next', '--worker', 'w1'], at(61)).out).toBe('CLAIMED B spec')
  })

  test('wind-down: before the time builds still flow', () => {
    const w = world({ mode })
    expect(claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(59)).out).toBe('CLAIMED A build')
  })

  test('wind-down: checks still flow after the time', () => {
    const w = world({ mode })
    claim(w, ['next', '--worker', 'w1', '--roles', 'build'], at(10))
    claim(w, ['update', 'A', 'build', 'reported', '--worker', 'w1'], at(20))
    expect(claim(w, ['next', '--worker', 'w2'], at(61)).out).toBe('CLAIMED A check')
  })

  test('wind-down: status prints the time and says when it has passed', () => {
    const w = world({ mode })
    expect(run(w, 'status.mjs', [], at(10)).out).toMatch(/wind-down at /)
    expect(run(w, 'status.mjs', [], at(10)).out).not.toMatch(/PASSED/)
    expect(run(w, 'status.mjs', [], at(61)).out).toMatch(/PASSED/)
  })
})

describe('scope allows listed test and golden paths', () => {
  const card = '# A\n\nPaths: src/a/**\n\n## Tests\n- `src/a/extra/` is not a file\n- `e2e/a/journey.spec.ts`\n\nGolden: fixtures/a/golden.json, fixtures/a/more.json\n'
  const scopeWorld = (changed) => {
    const w = world({ files: { 'plan/cards/A.md': card, 'src/a/seed.ts': 'x' } })
    git(w.work, 'checkout', '-q', '-b', 'work')
    for (const f of changed) {
      fs.mkdirSync(path.dirname(path.join(w.work, f)), { recursive: true })
      fs.writeFileSync(path.join(w.work, f), 'x')
    }
    git(w.work, 'add', ...changed)
    git(w.work, 'commit', '-q', '-m', 'work')
    return w
  }

  test('scope: acceptance files, __golden__ folders and paths the card lists are not out of scope', () => {
    const w = scopeWorld([
      'src/a/x.ts',
      'src/other/x.acceptance.test.ts',
      'src/other/__golden__/x.txt',
      'e2e/a/journey.spec.ts',
      'fixtures/a/golden.json',
      'fixtures/a/more.json',
      'reports/A-build.md',
    ])
    const r = run(w, 'scope.mjs', ['A', 'main'])
    expect(r.out).toMatch(/SCOPE OK A/)
    expect(r.code).toBe(0)
  })

  test('scope: a file that is neither a card path nor a listed test path still fails', () => {
    const w = scopeWorld(['src/a/x.ts', 'fixtures/a/other.json', 'src/zzz/y.ts'])
    const r = run(w, 'scope.mjs', ['A', 'main'])
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/2 file\(s\) outside/)
    expect(r.out).toMatch(/src\/zzz\/y\.ts/)
  })
})
