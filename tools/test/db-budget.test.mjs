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
  // A test is a call whose callee chain starts at `test` or `it`: test(...), test.skip(...), and the table forms
  // test.each(rows)(title, fn), test.for(rows)(title, fn), it.each`table`(title, fn) (A504: each body is one test
  // run once per row, so a body that makes two worlds is two worlds per row).
  const rootName = (e) =>
    ts.isIdentifier(e)
      ? e.text
      : ts.isPropertyAccessExpression(e)
        ? rootName(e.expression)
        : ts.isCallExpression(e)
          ? rootName(e.expression)
          : ts.isTaggedTemplateExpression(e)
            ? rootName(e.tag)
            : ''
  const isTest = (c) => {
    const base = rootName(c.expression)
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
      // A property body (fc.property / fc.asyncProperty) runs once per generated run, so a world made in it is a
      // world per run: it counts like a loop (FX14: the bridge RT-5 and jobs lease properties made one per run).
      const prop = ts.isCallExpression(n) && /^(?:fc\.)?(?:async)?[pP]roperty$/.test(ts.isPropertyAccessExpression(n.expression) ? `${nameOf(n.expression.expression) ?? ''}.${n.expression.name.text}` : (nameOf(n.expression) ?? ''))
      const l = loop || prop || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)
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

// CONCURRENT: the only tests allowed more than one database (FX14, A504). Every other db test is split into
// one test per world. These three prove a fact between databases that are open at the same time in one cluster
// (isolation; a role one database made surviving another's close; a role gone once its handle closed, seen from
// a second handle), so they cannot be split; each names its exact title, its exact count and why. A test over
// its count fails, and an entry no test produces fails as stale. The list does not grow without a Lead's
// amber: it is for a cluster-level fact, never for convenience.
const CONCURRENT = [
  { file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-4 two test databases are isolated: a table made in one is not in the other', worlds: 2, why: 'isolation is a fact about two databases open at once' },
  { file: 'src/core/db/pg16.acceptance.db.test.ts', title: "ARC-4 closing one test database never drops a role another open test database made and uses; each database's roles go when it closes", worlds: 3, why: 'a role made by A must survive A closing while B uses its own, and a third handle shows none are left' },
  { file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-4 T5 a handle that made a role and ran set session authorization to it closes with the role gone from the cluster', worlds: 2, why: 'a role gone from the cluster is seen from a second open handle' },
]
const concurrentStrings = CONCURRENT.map((k) => `${k.file}: "${k.title}" builds ${k.worlds} databases`)

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
const PLANTED_EACH = `import { test, it } from 'vitest'
import { cloneTestDb } from '../core/db'
test.each([1, 2])('ARC-4 planted two worlds in a test.each body %i', async (n) => {
  await cloneTestDb()
  await cloneTestDb()
  void n
})
test.each([1, 2])('ARC-4 planted one world in a test.each body %i', async (n) => {
  await cloneTestDb()
  void n
})
it.each\`
  n
  \${1}
\`('ARC-4 planted two worlds in a tagged it.each body', async () => {
  await cloneTestDb()
  await cloneTestDb()
})
test.for([1, 2])('ARC-4 planted two worlds in a test.for body', async () => {
  await cloneTestDb()
  await cloneTestDb()
})
test.runIf(true)('ARC-4 planted two worlds in a test.runIf body', async () => {
  await cloneTestDb()
  await cloneTestDb()
})
test.skipIf(false)('ARC-4 planted two worlds in a test.skipIf body', async () => {
  await cloneTestDb()
  await cloneTestDb()
})
test.concurrent.each([1])('ARC-4 planted a world per loop turn in a chained each body', async () => {
  for (const y of [1, 2]) { await cloneTestDb(); void y }
})
`
const PLANTED_PROPERTY = `import fc from 'fast-check'
import { test } from 'vitest'
import { cloneTestDb } from '../core/db'
test('ARC-4 planted a world per property run', async () => {
  await fc.assert(fc.asyncProperty(fc.integer(), async () => { await cloneTestDb() }), { numRuns: 8 })
})
test('ARC-4 planted a world per sync property run', () => {
  fc.assert(fc.property(fc.integer(), () => { void cloneTestDb() }))
})
test('ARC-4 planted a property with no world', async () => {
  await cloneTestDb()
  await fc.assert(fc.asyncProperty(fc.integer(), async (n) => { void n }), { numRuns: 8 })
})
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

  test('ARC-15 a world made inside a property body counts as more than one: it is a database per generated run (FX14)', () => {
    expect(problems('planted.db.test.ts', PLANTED_PROPERTY)).toEqual([
      'planted.db.test.ts: "ARC-4 planted a world per property run" builds 2 databases',
      'planted.db.test.ts: "ARC-4 planted a world per sync property run" builds 2 databases',
    ])
  })

  test('ARC-15 every db test file is scanned (at least the nine known homes, and the auth file with its tests)', () => {
    const files = dbTestFiles()
    expect(files.length).toBeGreaterThanOrEqual(9)
    expect(files).toContain('src/modules/auth/auth.acceptance.db.test.ts')
    expect(files).toContain('src/core/db/db.db.test.ts')
    const auth = worldsPerTest('auth', fs.readFileSync(path.join(ROOT, 'src/modules/auth/auth.acceptance.db.test.ts'), 'utf8'))
    expect(auth.length).toBeGreaterThanOrEqual(57)
  })

  test('ARC-15 a test.each, test.for, it.each (tagged), test.runIf, test.skipIf or chained each body that builds two databases is reported by its title and count; a one-world body next to it is not (A504)', () => {
    expect(problems('planted.db.test.ts', PLANTED_EACH)).toEqual([
      'planted.db.test.ts: "ARC-4 planted two worlds in a test.each body %i" builds 2 databases',
      'planted.db.test.ts: "ARC-4 planted two worlds in a tagged it.each body" builds 2 databases',
      'planted.db.test.ts: "ARC-4 planted two worlds in a test.for body" builds 2 databases',
      'planted.db.test.ts: "ARC-4 planted two worlds in a test.runIf body" builds 2 databases',
      'planted.db.test.ts: "ARC-4 planted two worlds in a test.skipIf body" builds 2 databases',
      'planted.db.test.ts: "ARC-4 planted a world per loop turn in a chained each body" builds 2 databases',
    ])
  })

  test('ARC-15 the table forms are read as tests: a test.each body with one world is counted as a test, not skipped', () => {
    const t = worldsPerTest('planted.db.test.ts', PLANTED_EACH)
    expect(t.find((x) => x.title === 'ARC-4 planted one world in a test.each body %i')?.worlds).toBe(1)
    expect(t).toHaveLength(7)
  })

  test('ARC-15 every db test in the repo builds at most one database, apart from the CONCURRENT list', () => {
    const found = dbTestFiles().flatMap((f) => problems(f, fs.readFileSync(path.join(ROOT, f), 'utf8')))
    const unlisted = found.filter((p) => !concurrentStrings.includes(p))
    expect(unlisted, `multi-world db tests: split each into one test per world (FX10 and FX14 did)`).toEqual([])
  })

  test('ARC-15 CONCURRENT has no stale entries: every listed test is still produced, at exactly its count', () => {
    const found = dbTestFiles().flatMap((f) => problems(f, fs.readFileSync(path.join(ROOT, f), 'utf8')))
    expect(concurrentStrings.filter((p) => !found.includes(p)), 'a listed test that no longer exists or no longer has that count: remove or fix its entry').toEqual([])
  })

  test('ARC-15 CONCURRENT is short, in one file, and each entry names its file, exact title, count (2 or 3) and why', () => {
    expect(CONCURRENT.length).toBeLessThanOrEqual(3)
    for (const k of CONCURRENT) {
      expect(k.file).toBe('src/core/db/pg16.acceptance.db.test.ts')
      expect(k.title.length).toBeGreaterThan(10)
      expect([2, 3]).toContain(k.worlds)
      expect(k.why.length).toBeGreaterThan(20)
    }
    expect(new Set(concurrentStrings).size).toBe(CONCURRENT.length)
  })
})

// ---- 3. the measured table -------------------------------------------------------------------------------
// The 10 slowest db tests with a plain written title, measured 3 Oct after FX14's split on a cloud box (4 CPUs,
// 2 db workers, Postgres 16.14, `vitest run --project db --sequence.shuffle --sequence.seed=20261001`, 704 tests,
// all passed). Tests that a table form writes once per row (test.each) are not in the table: each row is its own
// test and none was over 1100 ms. Each under half the test budget, or named with the owner card that splits or
// speeds it. FX14 took the three slow ones (the RT-5 property at 4506 ms, the ARC-5 lease property at 4804 ms and
// ARC-16 at 1998 ms) out of the table by one test per world; the check re-measures with `npm run test:flake`
// and the Lead refreshes the numbers; this test keeps the table honest.
const MEASURED = [
  { ms: 960, file: 'src/modules/auth/auth.acceptance.db.test.ts', title: 'SEC-1 an unknown user, a locked user, a non-test user and a wrong password each cost exactly one scrypt call' },
  { ms: 836, file: 'src/core/db/pg16.acceptance.db.test.ts', title: "ARC-4 closing one test database never drops a role another open test database made and uses; each database's roles go when it closes" },
  { ms: 771, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-4 with TEST_DB=pg16, createTemplate(DEFAULT_SCHEMA_DIR) called directly also gives Postgres 16 on 127.0.0.1, not PGlite' },
  { ms: 593, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-4 T5 a handle that made a role and ran set session authorization to it closes with the role gone from the cluster' },
  { ms: 470, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-4 two test databases are isolated: a table made in one is not in the other' },
  { ms: 456, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-16 a template built from a custom folder (as the contract tests build theirs) honours the switch, and its clones keep the pinned settings and the same types, inside a transaction too' },
  { ms: 324, file: 'src/modules/bridge/bridge.acceptance.db.test.ts', title: 'END-1 a snapshot that is not made-up data, or does not parse, is refused and writes nothing' },
  { ms: 312, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-16 T2 set session authorization on the handle: the transaction runs as that user (current_user and session_user) and row-level security holds inside it (0 rows, never the superuser count), or it is refused naming the user' },
  { ms: 302, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-16 two overlapping transactions on a handle with a role set both run as that role, or are refused naming it; neither runs as another user' },
  { ms: 298, file: 'src/core/db/pg16.acceptance.db.test.ts', title: 'ARC-16 parity on every connection: inside a transaction and in both of two overlapping transactions, the pinned settings and the same-types row are unchanged' },
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
