// SC11 acceptance tests: db rules R90 to R92 (spec-writer; builders never edit this file). Runs in the db
// project on both backends in cloud checks. The pooled-connection rules only have something to prove on
// Postgres 16 (PGlite has one session and no pool), so they are gated with ON, as DB16's race test is.
//
// What these tests fix (amber in reports/SC11-spec.md):
// - R90: src/core/db/index.ts exports `idleConnectionProblems(db)` (it works on a handle through its `pool`
//   (a pg.Pool), its `customSettings` set and its `closed` flag, so the plant below can be checked too; every idle
//   pooled connection of one handle, inspected after a rollback so an aborted block still shows its role:
//   one string per problem, naming it: a role, a session authorization, a session-source setting by name, a
//   tracked custom setting by name, or an open transaction; [] on PGlite and on a closed handle) and
//   `assertCleanClones()` (rejects naming every problem of every open clone made by cloneTestDb). vitest-setup.ts
//   calls assertCleanClones in afterEach BEFORE closeClones, so vitest fails the test that left it dirty by its
//   own name. close() of a handle with a dirty idle connection also rejects naming the problem, after the
//   database is dropped.
// - R91: `leftoverRoles(before, after)` (the roles in after and not in before, sorted) and the global teardown:
//   it compares pg_roles at setup with pg_roles at the end, drops this run's databases first, then rejects
//   naming each leftover role.
// - R92: no `.catch(() => undefined)` (or the same swallow written `() => {}`, `() => null`, `() => void 0`,
//   `.catch(noop)`) in a non-test file of src/core/db outside `dbCatchAllow` in tools/test-homes.json, each
//   entry { file, text, reason } with the exact text. The allow list starts empty. A stale entry fails.
// - The plant for R90 and R92 is __fixtures__/index-36672c88.ts, index.ts as the DB16 round 4 check found it.
// This file imports no PGlite value: only src/core/db builds a database (the rule scan in pg16.acceptance.test.ts).
import fs from 'node:fs'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../testing/read-own-source'
import setupGlobal from './global-setup'
import * as dbModule from './index'
import { cloneTestDb } from './index'
import { createTemplate as createOldTemplate } from './__fixtures__/index-36672c88'

const ON = process.env['TEST_DB'] === 'pg16'
const BOOT_MS = 30_000
const DB_DIR = 'src/core/db'
const PID = String(process.pid)

interface Sc11Api {
  idleConnectionProblems(db: unknown): Promise<string[]>
  assertCleanClones(): Promise<void>
  leftoverRoles(before: Iterable<string>, after: Iterable<string>): string[]
}
function api<K extends keyof Sc11Api>(name: K): Sc11Api[K] {
  const f = (dbModule as unknown as Partial<Sc11Api>)[name]
  if (typeof f !== 'function') throw new Error(`src/core/db/index.ts does not export ${name} (SC11 build)`)
  return f as Sc11Api[K]
}

interface PoolLike {
  connect(): Promise<{ query(sql: string): Promise<unknown>; release(destroy?: boolean): void }>
}
/** Leaves one idle pooled connection of this handle with `sql` run on it and not undone. */
async function dirty(db: unknown, sql: string): Promise<void> {
  const pool = (db as { pool: PoolLike }).pool
  const c = await pool.connect()
  await c.query(sql)
  c.release()
}

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  exec(sql: string): Promise<void>
  transaction<T>(fn: (tx: { query: Queryable['query']; exec: Queryable['exec']; rollback(): Promise<void> }) => Promise<T>): Promise<T>
  close(): Promise<void>
}
let roleCounter = 0
async function newRole(db: Queryable, kind: string): Promise<string> {
  roleCounter += 1
  const name = `sc11_${kind}_${PID}_${String(roleCounter)}`
  await db.exec(`create role ${name}`)
  return name
}

const problemsOf = async (db: unknown): Promise<string[]> => api('idleConnectionProblems')(db)

describe('SC11 R90 pooled connections are clean before the pool ends (ARC-6, SEC-1)', () => {
  test.runIf(!ON)('ARC-6 on PGlite there is no pool: no problems, and assertCleanClones passes', async () => {
    const db = await cloneTestDb()
    await db.query('select 1')
    await expect(problemsOf(db)).resolves.toEqual([])
    await expect(api('assertCleanClones')()).resolves.toBeUndefined()
  })

  test.runIf(ON)(
    'ARC-6 a handle that ran transactions with set local role and set_config is clean, and so is every clone',
    async () => {
      const db = (await cloneTestDb()) as unknown as Queryable
      const role = await newRole(db, 'clean')
      await db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`)
        await tx.query(`select set_config('app.sc11_clean', 'x', true)`)
      })
      await db.query(`select set_config('app.sc11_clean', 'y', false)`)
      await db.transaction((tx) => tx.query('select 1'))
      await expect(problemsOf(db)).resolves.toEqual([])
      await expect(api('assertCleanClones')()).resolves.toBeUndefined()
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 the poisoned sequence of the DB16 check (rollback, set role, then an aborted block) leaves no problem on the real index.ts',
    async () => {
      const db = (await cloneTestDb()) as unknown as Queryable
      const role = await newRole(db, 'poison')
      await expect(
        db.transaction(async (tx) => {
          await tx.rollback()
          await tx.exec(`set role ${role}`)
          await tx.exec('begin')
          await tx.query('select 1/0')
        }),
      ).rejects.toThrow()
      await expect(problemsOf(db)).resolves.toEqual([])
    },
    BOOT_MS,
  )

  const DIRT: { name: string; before?: string; sql: (role: string) => string; shown: RegExp }[] = [
    { name: 'a role', sql: (r) => `set role ${r}`, shown: /role/i },
    { name: 'a session authorization', sql: (r) => `set session authorization ${r}`, shown: /session.?authorization/i },
    { name: 'a session-source setting', sql: () => `set search_path to pg_catalog`, shown: /search_path/ },
    {
      name: 'a tracked custom setting',
      before: `select set_config('app.sc11_dirty', 'x', false)`,
      sql: () => `select set_config('app.sc11_dirty', 'x', false)`,
      shown: /app\.sc11_dirty/,
    },
    { name: 'an open transaction', sql: () => 'begin', shown: /transaction/i },
  ]
  for (const d of DIRT) {
    test.runIf(ON)(
      `ARC-6 an idle pooled connection left with ${d.name} is named by idleConnectionProblems, by assertCleanClones and by close`,
      async () => {
        const db = (await cloneTestDb()) as unknown as Queryable
        const role = await newRole(db, 'dirt')
        if (d.before !== undefined) await db.query(d.before)
        // Dirtied again before each check: a check may destroy the connection it found dirty.
        await dirty(db, d.sql(role))
        const problems = await problemsOf(db)
        expect(problems.length).toBeGreaterThan(0)
        expect(problems.join('\n')).toMatch(d.shown)
        await dirty(db, d.sql(role))
        await expect(api('assertCleanClones')()).rejects.toThrow(d.shown)
        await dirty(db, d.sql(role))
        await expect(db.close()).rejects.toThrow(d.shown)
      },
      BOOT_MS,
    )
  }

  test.runIf(ON)(
    'ARC-6 PLANT: index.ts at 36672c88 leaves a session authorization on a pooled connection after a committed transaction',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const template = await createOldTemplate()
      const old = (await template.clone()) as unknown as Queryable
      const role = await newRole(old, 'plant1')
      try {
        await old.transaction((tx) => tx.exec(`set session authorization ${role}`))
        const problems = await problemsOf(old)
        expect(problems.join('\n')).toMatch(/session.?authorization/i)
      } finally {
        await old.close()
        await template.close()
        await real.exec(`drop role if exists ${role}`)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 PLANT: index.ts at 36672c88 returns a connection in an aborted block with its role still set (the poisoned sequence)',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const template = await createOldTemplate()
      const old = (await template.clone()) as unknown as Queryable
      const role = await newRole(old, 'plant2')
      try {
        await expect(
          old.transaction(async (tx) => {
            await tx.rollback()
            await tx.exec(`set role ${role}`)
            await tx.exec('begin')
            await tx.query('select 1/0')
          }),
        ).rejects.toThrow()
        const problems = (await problemsOf(old)).join('\n')
        expect(problems).toMatch(/role/i)
        expect(problems).toMatch(/transaction/i)
      } finally {
        await old.close()
        await template.close()
        await real.exec(`drop role if exists ${role}`)
      }
    },
    BOOT_MS,
  )

  test('ARC-6 vitest-setup.ts checks every clone before closing them, so vitest fails the test that left one dirty', () => {
    const src = readOwnSource(`${DB_DIR}/vitest-setup.ts`)
    const block = /afterEach\(\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\}\)/.exec(src)
    expect(block, 'sentinel: the afterEach block of vitest-setup.ts').not.toBeNull()
    const body = block?.[1] ?? ''
    const check = body.indexOf('assertCleanClones()')
    const close = body.indexOf('closeClones()')
    expect(check).toBeGreaterThanOrEqual(0)
    expect(close).toBeGreaterThanOrEqual(0)
    expect(check).toBeLessThan(close)
    expect(src).toMatch(/import\s*\{[^}]*\bassertCleanClones\b[^}]*\}\s*from\s*'\.\/index'/)
  })
})

describe('SC11 R91 no role outlives the run (ARC-6, SEC-1)', () => {
  test('SEC-1 leftoverRoles names the roles in after and not in before, sorted', () => {
    const f = api('leftoverRoles')
    expect(f(['postgres', 'a'], ['postgres', 'a', 'zed', 'bob'])).toEqual(['bob', 'zed'])
    expect(f(['postgres'], ['postgres'])).toEqual([])
    expect(f([], [])).toEqual([])
    expect(f(['a', 'b'], ['a'])).toEqual([])
  })

  test('SEC-1 leftoverRoles is exactly after minus before, for any lists', () => {
    const f = api('leftoverRoles')
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z_]{1,8}$/)), fc.array(fc.stringMatching(/^[a-z_]{1,8}$/)), (before, after) => {
        const out = f(before, after)
        const expected = [...new Set(after.filter((r) => !before.includes(r)))].sort()
        expect(out).toEqual(expected)
      }),
      { seed: 20261003, numRuns: 200 },
    )
  })

  test.runIf(ON)(
    'SEC-1 the global teardown drops this run databases, then fails naming a role made after setup and not a role that was there at setup',
    async () => {
      // The clone first: its name carries the real run id, so the teardown below (run id sc11_r91_) never drops it.
      const db = (await cloneTestDb()) as unknown as Queryable
      const keep = process.env['DB16_RUN_ID']
      process.env['DB16_RUN_ID'] = `sc11_r91_${PID}`
      try {
        const base = await newRole(db, 'base')
        const teardown = await setupGlobal()
        expect(teardown, 'sentinel: the pg16 global setup returns a teardown').toBeTypeOf('function')
        const quiet = teardown as () => Promise<void>
        // Nothing made since setup: the run left nothing (roles of other test files are not this test's).
        const leaked = await newRole(db, 'leak')
        await db.exec(`create database "ashbridge_t_sc11_r91_${PID}_x1"`)
        const rejected = await quiet().then(
          () => undefined,
          (e: unknown) => (e instanceof Error ? e.message : String(e)),
        )
        expect(rejected, 'the teardown fails when a role is left').toBeDefined()
        expect(rejected).toContain(leaked)
        expect(rejected).not.toContain(base)
        const dbs = await db.query(`select datname from pg_database where datname like $1`, [
          `ashbridge\\_t\\_sc11\\_r91\\_${PID}\\_%`,
        ])
        expect(dbs.rows, 'the run databases are dropped even when a role is left').toEqual([])
      } finally {
        await db.close()
        if (keep === undefined) delete process.env['DB16_RUN_ID']
        else process.env['DB16_RUN_ID'] = keep
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'SEC-1 the global teardown passes when the run left no new role',
    async () => {
      // The clone first: its name carries the real run id, so the teardown below (run id sc11_r91b_) never drops it.
      const db = (await cloneTestDb()) as unknown as Queryable
      const keep = process.env['DB16_RUN_ID']
      process.env['DB16_RUN_ID'] = `sc11_r91b_${PID}`
      try {
        await newRole(db, 'before_setup')
        const teardown = (await setupGlobal()) as () => Promise<void>
        await expect(teardown()).resolves.toBeUndefined()
      } finally {
        await db.close()
        if (keep === undefined) delete process.env['DB16_RUN_ID']
        else process.env['DB16_RUN_ID'] = keep
      }
    },
    BOOT_MS,
  )
})

// R92: the scan. `hits` finds each swallowed catch with its line; `unallowed` applies the Lead's allow list.
const SWALLOW =
  /\.catch\(\s*(?:async\s*)?(?:\(\s*\w*\s*\)\s*=>\s*(?:undefined|void 0|null|\{\s*(?:\/\/[^\n]*\n\s*)?\})|noop)\s*\)/g

interface Hit {
  file: string
  line: number
  text: string
}
function hits(files: { file: string; src: string }[]): Hit[] {
  const out: Hit[] = []
  for (const { file, src } of files) {
    for (const m of src.matchAll(SWALLOW)) {
      out.push({ file, line: src.slice(0, m.index).split('\n').length, text: m[0] })
    }
  }
  return out
}

interface Allow {
  file: string
  text: string
  reason: string
}
function unallowed(found: Hit[], allow: Allow[]): string[] {
  return found
    .filter((h) => !allow.some((a) => a.file === h.file && a.text === h.text))
    .map((h) => `${h.file}:${String(h.line)} swallowed failure ${h.text}`)
}

function dbSources(): { file: string; src: string }[] {
  return fs
    .readdirSync(DB_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !/\.test\.ts$/.test(e.name))
    .map((e) => ({ file: `${DB_DIR}/${e.name}`, src: readOwnSource(`${DB_DIR}/${e.name}`) }))
}

function allowList(): Allow[] {
  const homes = JSON.parse(readOwnSource('tools/test-homes.json')) as { dbCatchAllow?: unknown }
  expect(Array.isArray(homes.dbCatchAllow), 'tools/test-homes.json has a dbCatchAllow array (Lead-owned)').toBe(true)
  return homes.dbCatchAllow as Allow[]
}

describe('SC11 R92 no swallowed database errors in src/core/db (ARC-15)', () => {
  test('ARC-15 the scan flags every way of swallowing a failure and no handled catch', () => {
    const bad = [
      'await x.catch(() => undefined)',
      'await x.catch(() => {})',
      'await x.catch(() => null)',
      'await x.catch(() => void 0)',
      'await x.catch((e) => undefined)',
      'await x.catch(async () => undefined)',
      'await x.catch(noop)',
      'await x.catch(() => {\n  // ignore\n})',
    ]
    for (const src of bad) expect(hits([{ file: 'f.ts', src }]), src).toHaveLength(1)
    const fine = [
      'await x.catch((e) => { throw e })',
      'await x.catch((e: unknown) => log(e))',
      'await x.catch(() => fallback)',
      "await x.then(() => undefined, (e) => { throw e })",
    ]
    for (const src of fine) expect(hits([{ file: 'f.ts', src }]), src).toHaveLength(0)
  })

  test('ARC-15 PLANT: index.ts at 36672c88 is flagged once per swallowed catch, with its line', () => {
    const src = fs.readFileSync(`${DB_DIR}/__fixtures__/index-36672c88.ts`, 'utf8')
    const expected = src.split('.catch(() => undefined)').length - 1
    const found = hits([{ file: 'plant', src }])
    expect(expected, 'sentinel: the plant really swallows').toBeGreaterThanOrEqual(4)
    expect(found).toHaveLength(expected)
    expect(unallowed(found, [])).toHaveLength(expected)
    for (const h of found) expect(src.split('\n')[h.line - 1]).toContain('.catch(')
  })

  test('ARC-15 the real src/core/db has no swallowed catch outside the allow list (which starts empty)', () => {
    const files = dbSources()
    const names = files.map((f) => f.file)
    expect(names, 'sentinel: the scan read the harness files').toEqual(
      expect.arrayContaining([`${DB_DIR}/index.ts`, `${DB_DIR}/global-setup.ts`, `${DB_DIR}/vitest-setup.ts`, `${DB_DIR}/target.ts`]),
    )
    expect(names.some((n) => n.includes('__fixtures__') || n.includes('.test.'))).toBe(false)
    const allow = allowList()
    expect(unallowed(hits(files), allow)).toEqual([])
  })

  test('ARC-15 each allow entry names a file, the exact text, and a reason, and still matches (a stale entry fails)', () => {
    const allow = allowList()
    const files = dbSources()
    for (const a of allow) {
      expect(a.reason.trim().length, `${a.file}: an allow entry needs a reason`).toBeGreaterThan(0)
      const f = files.find((x) => x.file === a.file)
      expect(f, `${a.file}: allow entry names a non-test file of ${DB_DIR}`).toBeDefined()
      expect(hits(f ? [f] : []).some((h) => h.text === a.text), `${a.file}: stale allow entry ${a.text}`).toBe(true)
    }
  })

  test('ARC-15 an allow entry silences only its own file and text', () => {
    const found = hits([{ file: 'a.ts', src: 'x.catch(() => undefined)\ny.catch(() => {})' }])
    const allow: Allow[] = [{ file: 'a.ts', text: '.catch(() => undefined)', reason: 'test' }]
    expect(unallowed(found, allow)).toEqual(['a.ts:2 swallowed failure .catch(() => {})'])
    expect(unallowed(found, [{ file: 'b.ts', text: '.catch(() => undefined)', reason: 'test' }])).toHaveLength(2)
  })
})
