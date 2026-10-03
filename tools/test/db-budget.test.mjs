// FX12 acceptance tests (ARC-15): the db project's time budget.
// FX10 found the auth db flake was a timeout: each extra test world is a database clone (about 0.85 s on
// the laptop) and `vitest.config.ts` counted a 16-CPU laptop as a cloud box (A429). Three rules here:
//   1. the db worker count comes from a named setting with a pinned default per machine kind, never from
//      the CPU count (the config is loaded in a child process with a faked os.cpus());
//   2. no db test builds more than one database (FX10's guard, made general; static, over every
//      *.db.test.ts, planted fixtures included); KNOWN names today's seven with an owner card;
//   3. a measured table of the 10 slowest db tests, each under half the test budget or named with an owner.
// Every child process of the test itself is async (A247).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 60000 })

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fx12-'))
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

// ---- 1. the worker setting ------------------------------------------------------------------------------
// Pinned defaults per machine kind (amber: laptop 2 as measured in FX10, cloud 4). The machine kind is
// DB_TEST_MACHINE (cloud|laptop), else cloud when CI is set, else laptop; DB_TEST_WORKERS overrides the count.
const PINNED = { laptop: 2, cloud: 4 }
const PRELOAD = path.join(tmp, 'cpus.mjs').replace(/\\/g, '/')
fs.writeFileSync(
  PRELOAD,
  `import os from 'node:os'
import { syncBuiltinESMExports } from 'node:module'
const n = Number(process.env.FAKE_CPUS)
os.cpus = () => Array.from({ length: n }, () => ({ model: 'x', speed: 1, times: {} }))
syncBuiltinESMExports()
`,
)
const PRINT = `
const m = await import(process.env.CONFIG_FILE)
const db = m.default.test.projects.find((p) => p.test.name === 'db').test
console.log(JSON.stringify({ workers: db.maxWorkers ?? m.default.test.maxWorkers, testTimeout: db.testTimeout, hookTimeout: db.hookTimeout }))
`
function load(env, cpus = 16) {
  const clean = { ...process.env }
  for (const k of ['CI', 'DB_TEST_MACHINE', 'DB_TEST_WORKERS']) delete clean[k]
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, ['--import', PRELOAD, '--input-type=module', '-e', PRINT], {
      cwd: ROOT,
      env: { ...clean, FAKE_CPUS: String(cpus), CONFIG_FILE: path.join(ROOT, 'vitest.config.ts').replace(/\\/g, '/'), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (err += d))
    c.on('error', reject)
    c.on('close', (status) => resolve({ status, out: out.trim(), err }))
  })
}
const workers = async (env, cpus) => {
  const r = await load(env, cpus)
  expect(r.status, r.err).toBe(0)
  return JSON.parse(r.out.split('\n').pop())
}

describe('ARC-15 FX12: the db worker count is a named setting with a pinned default per machine kind', () => {
  test('ARC-15 a laptop (no CI, no setting) runs the pinned laptop worker count, a whole number', async () => {
    expect((await workers({})).workers).toBe(PINNED.laptop)
  })

  test('ARC-15 a cloud box (CI set) runs the pinned cloud worker count, a whole number', async () => {
    expect((await workers({ CI: 'true' })).workers).toBe(PINNED.cloud)
  })

  test('ARC-15 the count never depends on the CPU count: 2, 4 and 16 CPUs give the same answer for each machine kind', async () => {
    for (const env of [{}, { CI: 'true' }]) {
      const seen = await Promise.all([2, 4, 16].map(async (cpus) => (await workers(env, cpus)).workers))
      expect(new Set(seen).size, JSON.stringify({ env, seen })).toBe(1)
    }
  })

  test('ARC-15 DB_TEST_MACHINE names the machine kind and beats CI', async () => {
    expect((await workers({ CI: 'true', DB_TEST_MACHINE: 'laptop' })).workers).toBe(PINNED.laptop)
    expect((await workers({ DB_TEST_MACHINE: 'cloud' })).workers).toBe(PINNED.cloud)
  })

  test('ARC-15 DB_TEST_WORKERS sets the count outright', async () => {
    expect((await workers({ DB_TEST_WORKERS: '3' })).workers).toBe(3)
    expect((await workers({ CI: 'true', DB_TEST_WORKERS: '1' })).workers).toBe(1)
  })

  test('ARC-15 a bad DB_TEST_WORKERS or DB_TEST_MACHINE is refused by name, never guessed', async () => {
    for (const env of [{ DB_TEST_WORKERS: 'abc' }, { DB_TEST_WORKERS: '0' }, { DB_TEST_WORKERS: '2.5' }, { DB_TEST_WORKERS: '' + -1 }]) {
      const r = await load(env)
      expect(r.status, JSON.stringify(env)).not.toBe(0)
      expect(r.err).toContain('DB_TEST_WORKERS')
    }
    const r = await load({ DB_TEST_MACHINE: 'desktop' })
    expect(r.status).not.toBe(0)
    expect(r.err).toContain('DB_TEST_MACHINE')
  })

  test('ARC-15 the db budgets are not weakened: testTimeout stays at or above 6000 ms and hookTimeout at or above 30000 ms (A329)', async () => {
    const w = await workers({})
    expect(w.testTimeout).toBeGreaterThanOrEqual(6000)
    expect(w.hookTimeout).toBeGreaterThanOrEqual(30000)
  })
})

// ---- 2. one database per test ----------------------------------------------------------------------------
// Static, by the TypeScript AST. A "world maker" is `cloneTestDb`, or a function declared in the same file
// whose body calls a maker (to any depth). Per test body: every maker call counts once; a call inside a
// for/while loop counts twice (it can run more than once). Nested test() calls are their own tests.
export function worldsPerTest(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const nameOf = (e) => (ts.isIdentifier(e) ? e.text : undefined)
  const isTest = (c) => {
    const e = c.expression
    const base = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) ? e.expression.text : ''
    return base === 'test' || base === 'it'
  }
  const fns = new Map()
  const decls = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) fns.set(n.name.text, n.body)
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) fns.set(n.name.text, n.initializer.body)
    ts.forEachChild(n, decls)
  }
  decls(sf)
  const calledNames = (node) => {
    const found = []
    const w = (n) => {
      if (ts.isCallExpression(n)) {
        const c = nameOf(n.expression)
        if (c) found.push(c)
      }
      ts.forEachChild(n, w)
    }
    w(node)
    return found
  }
  const makers = new Set(['cloneTestDb'])
  for (let grew = true; grew; ) {
    grew = false
    for (const [n, body] of fns) {
      if (!makers.has(n) && calledNames(body).some((c) => makers.has(c))) {
        makers.add(n)
        grew = true
      }
    }
  }
  const count = (node, inLoop) => {
    let k = 0
    const w = (n, loop) => {
      if (ts.isCallExpression(n)) {
        if (isTest(n)) return
        const c = nameOf(n.expression)
        if (c && makers.has(c)) k += loop ? 2 : 1
      }
      const l = loop || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)
      ts.forEachChild(n, (x) => w(x, l))
    }
    w(node, inLoop)
    return k
  }
  const results = []
  const walk = (n) => {
    if (ts.isCallExpression(n) && isTest(n)) {
      const t = n.arguments[0]
      const fn = n.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a))
      if (fn) results.push({ title: t && ts.isStringLiteralLike(t) ? t.text : '(untitled)', worlds: count(fn.body, false) })
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return results
}
const problems = (file, text) =>
  worldsPerTest(file, text)
    .filter((t) => t.worlds > 1)
    .map((t) => `${file}: "${t.title}" builds ${t.worlds} databases`)

function dbTestFiles() {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(rel)
      } else if (e.name.endsWith('.db.test.ts')) out.push(rel)
    }
  }
  for (const d of ['src', 'testworld']) if (fs.existsSync(path.join(ROOT, d))) walk(d)
  return out.sort()
}

// KNOWN: tests that still build more than one database. One entry per test: file, exact title, the count
// and an owner card that splits it (card FX14, to be written by the Lead: these files are outside FX12's
// paths). Any problem not listed fails; a listed one not produced fails as stale.
const KNOWN = [
  { file: 'src/core/db/db.db.test.ts', title: 'ARC-4 a database is created from the schema folder and cloned per test', worlds: 2, owner: 'FX14' },
  { file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'RT-5 the number is never built from client data: names, business numbers and quote references change nothing', worlds: 2, owner: 'FX14' },
  { file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'END-1 a year end the client never confirmed becomes an ops-confirms item and no return', worlds: 2, owner: 'FX14' },
  { file: 'src/modules/jobs/jobs.acceptance.db.test.ts', title: 'ARC-16 two runs of the same scenario give identical rows (no randomness in the backoff)', worlds: 2, owner: 'FX14' },
  { file: 'src/modules/jobs/jobs.acceptance.db.test.ts', title: 'ARC-5 given the same jobs, handlers and clock both runners end with deep-equal statuses and results', worlds: 2, owner: 'FX14' },
  { file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-4 two test databases are isolated: a table made in one is not in the other', worlds: 2, owner: 'FX14' },
  { file: 'src/core/db/pg16.acceptance.db.test.ts', title: "ARC-4 closing one test database never drops a role another open test database made and uses; each database's roles go when it closes", worlds: 3, owner: 'FX14' },
]
const knownStrings = KNOWN.map((k) => `${k.file}: "${k.title}" builds ${k.worlds} databases`)

const PLANTED_TWO = `import { test } from 'vitest'
import { cloneTestDb } from '../core/db'
test('ARC-4 planted two worlds in one test', async () => {
  const a = await cloneTestDb()
  const b = await cloneTestDb()
  void a; void b
})
test('ARC-4 planted one world', async () => {
  await cloneTestDb()
})
`
const PLANTED_HELPER = `import { it } from 'vitest'
import { cloneTestDb } from '../core/db'
async function world() { return cloneTestDb() }
const twin = async () => world()
it('ARC-4 planted two worlds through a helper', async () => {
  await world()
  await twin()
})
it('ARC-4 planted one world through a helper', async () => { await twin() })
`
const PLANTED_LOOP = `import { test } from 'vitest'
import { cloneTestDb } from '../core/db'
test('ARC-4 planted a world per loop turn', async () => {
  for (const y of [1, 2, 3]) { await cloneTestDb(); void y }
})
test('ARC-4 planted a clone outside any loop', async () => { await cloneTestDb() })
`

describe('ARC-15 FX12: no db test builds more than one database', () => {
  test('ARC-15 a test that builds two databases is reported by file, title and count; a one-world test next to it is not', () => {
    expect(problems('planted.db.test.ts', PLANTED_TWO)).toEqual(['planted.db.test.ts: "ARC-4 planted two worlds in one test" builds 2 databases'])
  })

  test('ARC-15 a world made through a local helper (even two levels deep) counts as a database', () => {
    expect(problems('planted.db.test.ts', PLANTED_HELPER)).toEqual(['planted.db.test.ts: "ARC-4 planted two worlds through a helper" builds 2 databases'])
  })

  test('ARC-15 a world made inside a loop counts as more than one', () => {
    expect(problems('planted.db.test.ts', PLANTED_LOOP)).toEqual(['planted.db.test.ts: "ARC-4 planted a world per loop turn" builds 2 databases'])
  })

  test('ARC-15 every db test file is scanned (at least the nine known homes, and the auth file with its tests)', () => {
    const files = dbTestFiles()
    expect(files.length).toBeGreaterThanOrEqual(9)
    expect(files).toContain('src/modules/auth/auth.acceptance.db.test.ts')
    expect(files).toContain('src/core/db/db.db.test.ts')
    const auth = worldsPerTest('auth', fs.readFileSync(path.join(ROOT, 'src/modules/auth/auth.acceptance.db.test.ts'), 'utf8'))
    expect(auth.length).toBeGreaterThanOrEqual(57)
  })

  test('ARC-15 every db test in the repo builds at most one database, apart from the KNOWN list with its owner cards', () => {
    const found = dbTestFiles().flatMap((f) => problems(f, fs.readFileSync(path.join(ROOT, f), 'utf8')))
    const unlisted = found.filter((p) => !knownStrings.includes(p))
    expect(unlisted, `new multi-world db tests: split each into one test per world (FX10 did)`).toEqual([])
  })

  test('ARC-15 KNOWN has no stale entries: every listed problem is still produced', () => {
    const found = dbTestFiles().flatMap((f) => problems(f, fs.readFileSync(path.join(ROOT, f), 'utf8')))
    expect(knownStrings.filter((p) => !found.includes(p)), 'a listed problem that no longer exists: remove it from KNOWN').toEqual([])
  })

  test('ARC-15 every KNOWN entry names its file, exact title, count and an owner card id', () => {
    for (const k of KNOWN) {
      expect(k.file).toMatch(/\.db\.test\.ts$/)
      expect(k.title.length).toBeGreaterThan(10)
      expect(k.worlds).toBeGreaterThan(1)
      expect(k.owner).toMatch(/^[A-Z]{1,3}\d+[a-z]?$/)
    }
    expect(new Set(knownStrings).size).toBe(KNOWN.length)
  })
})

// ---- 3. the measured table -------------------------------------------------------------------------------
// The 10 slowest db tests, measured 3 Oct on a cloud box (4 CPUs, 2 db workers, `vitest run --project db
// --sequence.shuffle --sequence.seed=20261001`, 564 tests, all passed, 210 s wall). Each under half the
// test budget, or named with the owner card that splits or speeds it. The check re-measures with
// `npm run test:flake` and the Lead refreshes the numbers; this test keeps the table honest.
const MEASURED = [
  { ms: 4506, file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'RT-5 property (fixed seed): any order of runs gives unique, stable, contiguous refs numbered in order of first sight', owner: 'FX14' },
  { ms: 1998, file: 'src/modules/jobs/jobs.acceptance.db.test.ts', title: 'ARC-16 two runs of the same scenario give identical rows (no randomness in the backoff)' },
  { ms: 1404, file: 'src/modules/auth/auth.acceptance.db.test.ts', title: 'SEC-1 a mix of wrong passwords and wrong codes counts toward the five' },
  { ms: 1378, file: 'src/contracts/records.acceptance.db.test.ts', title: 'EV-1 returns.is_blank agrees with isBlank on every code point except U+0000 and the surrogates' },
  { ms: 1317, file: 'src/modules/jobs/jobs.acceptance.db.test.ts', title: 'ARC-5 given the same jobs, handlers and clock both runners end with deep-equal statuses and results' },
  { ms: 1312, file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'OUT-6 a T1-only client and a company with no T2 are skipped; the rest of the batch still goes through' },
  { ms: 1305, file: 'src/core/db/db.db.test.ts', title: 'ARC-4 a database is created from the schema folder and cloned per test' },
  { ms: 1239, file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'RT-5 the number is never built from client data: names, business numbers and quote references change nothing' },
  { ms: 1172, file: 'src/modules/auth/auth.acceptance.db.test.ts', title: 'SEC-1 an unknown user, a locked user, a non-test user and a wrong password each cost exactly one scrypt call' },
  { ms: 1114, file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'END-1 a year end the client never confirmed becomes an ops-confirms item and no return' },
]

describe('ARC-15 FX12: the 10 slowest db tests sit under half the test budget, or have an owner', () => {
  test('ARC-15 the table has 10 distinct tests, slowest first, each found by title in its file', () => {
    expect(MEASURED).toHaveLength(10)
    expect(new Set(MEASURED.map((m) => `${m.file}|${m.title}`)).size).toBe(10)
    expect(MEASURED.map((m) => m.ms)).toEqual([...MEASURED.map((m) => m.ms)].sort((a, b) => b - a))
    for (const m of MEASURED) {
      const titles = worldsPerTest(m.file, fs.readFileSync(path.join(ROOT, m.file), 'utf8')).map((t) => t.title)
      expect(titles, `${m.file} has no test titled "${m.title}": the table is stale`).toContain(m.title)
    }
  })

  test('ARC-15 each measured test is under half the db testTimeout, or names an owner card that fixes it', async () => {
    const { testTimeout } = await workers({})
    for (const m of MEASURED) {
      if (m.ms < testTimeout / 2) continue
      expect(m.owner, `"${m.title}" took ${m.ms} ms of ${testTimeout}: split it or name its owner`).toMatch(/^[A-Z]{1,3}\d+[a-z]?$/)
    }
  })

  test('ARC-15 a slow test with an owner really is over half the budget (no owner left on a fixed test)', async () => {
    const { testTimeout } = await workers({})
    for (const m of MEASURED.filter((x) => x.owner)) expect(m.ms, `"${m.title}" is under half the budget: drop its owner`).toBeGreaterThanOrEqual(testTimeout / 2)
  })
})
