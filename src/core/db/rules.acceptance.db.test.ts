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
// - A453 edge cases (DB16 security review), each a planted test below: a tx used after its transaction ended is
//   refused; custom settings set as `set_config (`, a quoted name or a `$` name are carried or refused, never
//   dropped; roles are tracked per handle (a role another worker makes meanwhile, a role made in a rolled-back
//   transaction, a role made in a DO block or by `create group`, a handle left in an aborted block, a role name
//   with a double quote); session read-only and isolation characteristics apply to the transaction;
//   `pg16RunId()` refuses a DB16_RUN_ID outside ^[0-9a-z_]+$ and the global setup never reuses an inherited id
//   (it mints a fresh one and puts it in DB16_RUN_ID); R92 also scans the empty `catch {}` block, and the one in
//   index.ts (the first rollback of `transaction`) is the allow list's only entry.
// - The plant for R90 and R92 is __fixtures__/index-36672c88.ts, index.ts as the DB16 round 4 check found it.
// - Round 3 (A508), at the end of this file: S6 to S9 and the S12 guard, on Postgres 16; S4, S5, S10, S11 and R118
//   are unit tests in pool-rules.acceptance.test.ts. index.ts exports `withAdmin(url, run)` (S9, amber).
// This file imports no PGlite value: only src/core/db builds a database (the rule scan in pg16.acceptance.test.ts).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../testing/read-own-source'
import setupGlobal from './global-setup'
import * as dbModule from './index'
import { cloneTestDb, pg16RunId } from './index'
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
      // The clone first: its name carries the real run id, so the teardown below never drops it.
      const db = (await cloneTestDb()) as unknown as Queryable
      const keep = process.env['DB16_RUN_ID']
      process.env['DB16_RUN_ID'] = `sc11_r91_${PID}`
      try {
        const base = await newRole(db, 'base')
        const teardown = await setupGlobal()
        expect(teardown, 'sentinel: the pg16 global setup returns a teardown').toBeTypeOf('function')
        const quiet = teardown as () => Promise<void>
        // The setup mints a fresh run id: this test's databases carry it, so the teardown drops them.
        const runId = process.env['DB16_RUN_ID'] ?? ''
        expect(runId).not.toBe(`sc11_r91_${PID}`)
        // Nothing made since setup: the run left nothing (roles of other test files are not this test's).
        const leaked = await newRole(db, 'leak')
        await db.exec(`create database "ashbridge_t_${runId}_x1"`)
        const rejected = await quiet().then(
          () => undefined,
          (e: unknown) => (e instanceof Error ? e.message : String(e)),
        )
        expect(rejected, 'the teardown fails when a role is left').toBeDefined()
        expect(rejected).toContain(leaked)
        expect(rejected).not.toContain(base)
        const dbs = await db.query(`select datname from pg_database where datname like $1`, [
          `ashbridge\\_t\\_${(process.env['DB16_RUN_ID'] ?? '').replaceAll('_', '\\_')}\\_%`,
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
      // The clone first: its name carries the real run id, so the teardown below never drops it.
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

type Tx = Parameters<Parameters<Queryable['transaction']>[0]>[0]
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
async function roleNamesIn(db: Queryable, names: string[]): Promise<string[]> {
  const r = await db.query('select rolname from pg_roles where rolname = any($1) order by rolname', [names])
  return r.rows.map((x) => String(x['rolname']))
}

describe('SC11 R90 edge cases from the DB16 security review (A453)', () => {
  test('ARC-6 a tx used after its transaction ended is refused, whichever method is called', async () => {
    const db = (await cloneTestDb()) as unknown as Queryable
    let kept: Tx | undefined
    await db.transaction(async (tx) => {
      kept = tx
      await tx.query('select 1')
    })
    expect(kept, 'sentinel: the transaction ran').toBeDefined()
    const ended = kept as Tx
    await expect(ended.query('select 1')).rejects.toThrow()
    await expect(ended.exec('select 1')).rejects.toThrow()
    await expect(ended.rollback()).rejects.toThrow()
  })

  test('ARC-6 a tx used after a rollback of its transaction is refused too', async () => {
    const db = (await cloneTestDb()) as unknown as Queryable
    await expect(
      db.transaction(async (tx) => {
        await tx.rollback()
        await tx.query('select 1')
      }),
    ).rejects.toThrow()
  })

  test.runIf(ON)(
    'ARC-6 a call from a promise chain never awaited, issued after the transaction ended, cannot set a role on the pooled connection',
    async () => {
      const db = (await cloneTestDb()) as unknown as Queryable
      const role = await newRole(db, 'late')
      let late: Promise<unknown> | undefined
      await db.transaction((tx) => {
        late = sleep(150).then(() => tx.exec(`set role ${role}`))
        late.catch(() => undefined)
        return Promise.resolve()
      })
      await sleep(400)
      await expect(late).rejects.toThrow()
      await expect(problemsOf(db)).resolves.toEqual([])
      await db.transaction(async (tx) => {
        const r = await tx.query('select current_user as u, session_user as s')
        expect(r.rows[0]?.['u']).toBe(r.rows[0]?.['s'])
      })
    },
    BOOT_MS,
  )

  const SETTING_FORMS: { name: string; sql: string; key: string }[] = [
    { name: 'set_config with a space before the parenthesis', sql: `select set_config ('app.sc11_sp', 'v', false)`, key: 'app.sc11_sp' },
    { name: 'a quoted name', sql: `set "app"."sc11_q" = 'v'`, key: 'app.sc11_q' },
    { name: 'a name with a dollar sign', sql: `select set_config('app.sc11$d', 'v', false)`, key: 'app.sc11$d' },
    { name: 'a dollar sign in a set statement', sql: `set app.sc11$e to 'v'`, key: 'app.sc11$e' },
    { name: 'set session with a quoted second part', sql: `set session app."sc11_s" to 'v'`, key: 'app.sc11_s' },
  ]
  for (const f of SETTING_FORMS) {
    test(`ARC-6 a custom setting set by ${f.name} is carried into a transaction or the transaction is refused, never silently dropped`, async () => {
      const db = (await cloneTestDb()) as unknown as Queryable
      await db.exec(f.sql)
      const outcome = await db
        .transaction((tx) => tx.query(`select current_setting('${f.key}', true) as v`))
        .then(
          (r) => ({ value: r.rows[0]?.['v'] }),
          (e: unknown) => ({ refused: e instanceof Error ? e.message : String(e) }),
        )
      if ('refused' in outcome) expect(outcome.refused).toMatch(/refused|custom setting/i)
      else expect(outcome.value).toBe('v')
      await expect(problemsOf(db)).resolves.toEqual([])
    })
  }

  test('ARC-6 a session read-only default and a session isolation default apply to the transaction a handle opens', async () => {
    const db = (await cloneTestDb()) as unknown as Queryable
    await db.exec('set default_transaction_read_only = on')
    const ro = await db.transaction((tx) => tx.query(`select current_setting('transaction_read_only') as v`))
    expect(ro.rows[0]?.['v']).toBe('on')
    await expect(db.transaction((tx) => tx.exec('create temp table sc11_ro (x int)'))).rejects.toThrow(/read-only/i)
    await db.exec('set default_transaction_read_only = off')
    await db.exec(`set default_transaction_isolation = 'serializable'`)
    const iso = await db.transaction((tx) => tx.query(`select current_setting('transaction_isolation') as v`))
    expect(iso.rows[0]?.['v']).toBe('serializable')
  })
})

describe('SC11 R91 role tracking is per handle and complete (A453, ARC-6, SEC-1)', () => {
  test.runIf(ON)(
    'SEC-1 a role another worker makes while this handle runs a statement is never dropped by this handle',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const db = (await cloneTestDb()) as unknown as Queryable
      const mine = `sc11_mine_${PID}`
      const foreign = `sc11_foreign_${PID}`
      try {
        const slow = db.exec(`select pg_sleep(1); create role ${mine}`)
        await sleep(300)
        const pool = (db as unknown as { pool: PoolLike }).pool
        const c = await pool.connect()
        await c.query(`create role ${foreign}`)
        c.release()
        await slow
        await expect(db.close()).resolves.toBeUndefined()
        expect(await roleNamesIn(real, [mine, foreign])).toEqual([foreign])
      } finally {
        await real.exec(`drop role if exists ${foreign}`)
        await real.exec(`drop role if exists ${mine}`)
      }
    },
    BOOT_MS,
  )

  test('SEC-1 a role made in a transaction that rolls back does not make close fail', async () => {
    const db = (await cloneTestDb()) as unknown as Queryable
    const name = `sc11_rb_${PID}`
    await db.transaction(async (tx) => {
      await tx.exec(`create role ${name}`)
      await tx.rollback()
    })
    await expect(db.close()).resolves.toBeUndefined()
  })

  test.runIf(ON)(
    'SEC-1 a role made in a DO block or by create group is dropped when the handle closes',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const db = (await cloneTestDb()) as unknown as Queryable
      const viaDo = `sc11_do_${PID}`
      const viaGroup = `sc11_grp_${PID}`
      try {
        await db.exec(`do $$ begin create role ${viaDo}; end $$`)
        await db.exec(`create group ${viaGroup}`)
        await expect(db.close()).resolves.toBeUndefined()
        expect(await roleNamesIn(real, [viaDo, viaGroup])).toEqual([])
      } finally {
        await real.exec(`drop role if exists ${viaDo}`)
        await real.exec(`drop role if exists ${viaGroup}`)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'SEC-1 a handle left in an aborted block still has its roles dropped when it closes',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const db = (await cloneTestDb()) as unknown as Queryable
      const name = `sc11_abort_${PID}`
      try {
        await db.exec(`create role ${name}`)
        await db.exec('begin')
        await expect(db.query('select 1/0')).rejects.toThrow()
        await expect(db.close()).resolves.toBeUndefined()
        expect(await roleNamesIn(real, [name])).toEqual([])
      } finally {
        await real.exec(`drop role if exists ${name}`)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'SEC-1 a role name with a double quote is escaped as an identifier when it is dropped',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const db = (await cloneTestDb()) as unknown as Queryable
      const name = `sc11_q"x_${PID}`
      try {
        await db.exec(`create role "${name.replaceAll('"', '""')}"`)
        await expect(db.close()).resolves.toBeUndefined()
        expect(await roleNamesIn(real, [name])).toEqual([])
      } finally {
        await real.exec(`drop role if exists "${name.replaceAll('"', '""')}"`)
      }
    },
    BOOT_MS,
  )
})

describe('SC11 the run id is checked and never inherited (A453, SEC-1)', () => {
  test('SEC-1 pg16RunId refuses a DB16_RUN_ID outside lowercase letters, digits and underscores, naming the variable', () => {
    const keep = process.env['DB16_RUN_ID']
    try {
      for (const bad of ['a"b', "a'b", 'a%b', 'A_b', 'a-b', 'a b', 'a\\b', 'a;drop', 'é']) {
        process.env['DB16_RUN_ID'] = bad
        expect(() => pg16RunId(), JSON.stringify(bad)).toThrow(/DB16_RUN_ID/)
      }
      process.env['DB16_RUN_ID'] = 'abc_123'
      expect(pg16RunId()).toBe('abc_123')
      delete process.env['DB16_RUN_ID']
      expect(pg16RunId()).toMatch(/^[0-9a-z_]+$/)
    } finally {
      if (keep === undefined) delete process.env['DB16_RUN_ID']
      else process.env['DB16_RUN_ID'] = keep
    }
  })

  test.runIf(ON)(
    'SEC-1 the global setup mints a fresh run id and its teardown leaves the databases of an inherited one alone',
    async () => {
      const real = (await cloneTestDb()) as unknown as Queryable
      const keep = process.env['DB16_RUN_ID']
      const inherited = `sc11_inh_${PID}`
      process.env['DB16_RUN_ID'] = inherited
      try {
        await real.exec(`create database "ashbridge_t_${inherited}_x1"`)
        const teardown = (await setupGlobal()) as () => Promise<void>
        const minted = process.env['DB16_RUN_ID'] ?? ''
        expect(minted).not.toBe(inherited)
        expect(minted).toMatch(/^[0-9a-z_]+$/)
        await teardown()
        const left = await real.query('select datname from pg_database where datname = $1', [`ashbridge_t_${inherited}_x1`])
        expect(left.rows).toHaveLength(1)
      } finally {
        await real.exec(`drop database if exists "ashbridge_t_${inherited}_x1" with (force)`)
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

// The empty catch block (`catch {}`, `catch (e) {}`, comments only): its hit text is the block with its body removed.
const EMPTY_CATCH = /\bcatch\s*(?:\(\s*\w*\s*(?::\s*\w+\s*)?\))?\s*\{(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\}/g

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
    for (const m of src.matchAll(EMPTY_CATCH)) {
      out.push({ file, line: src.slice(0, m.index).split('\n').length, text: m[0].replace(/\{[\s\S]*\}/, '{}') })
    }
  }
  return out
}

interface Allow {
  file: string
  text: string
  reason: string
}
// One allow entry silences one hit: a second swallow with the same text in the same file is still reported.
function unallowed(found: Hit[], allow: Allow[]): string[] {
  const spent = new Set<number>()
  return found
    .filter((h) => {
      const i = allow.findIndex((a, n) => !spent.has(n) && a.file === h.file && a.text === h.text)
      if (i < 0) return true
      spent.add(i)
      return false
    })
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

  test('ARC-15 the scan flags an empty catch block, with or without a binding or comments, and no handled one', () => {
    const bad = [
      'try { f() } catch {}',
      'try { f() } catch (e) {}',
      'try { f() } catch (e: unknown) { }',
      'try { f() } catch {\n  // ignore\n}',
      'try { f() } catch { /* ignore */ }',
    ]
    for (const src of bad) {
      const found = hits([{ file: 'f.ts', src }])
      expect(found, src).toHaveLength(1)
      expect(found[0]?.text, src).toMatch(/^catch\s*(\(\w+(: unknown)?\)\s*)?\{\}$/)
    }
    const fine = ['try { f() } catch (e) { throw e }', 'try { f() } catch { return 1 }', 'try { f() } catch (e) { log(e) }']
    for (const src of fine) expect(hits([{ file: 'f.ts', src }]), src).toHaveLength(0)
  })

  test('ARC-15 one allow entry silences one hit: a second empty catch in the same file is still reported', () => {
    const found = hits([{ file: 'a.ts', src: 'try {} catch {}\ntry {} catch {}' }])
    expect(found).toHaveLength(2)
    const one: Allow[] = [{ file: 'a.ts', text: 'catch {}', reason: 'test' }]
    expect(unallowed(found, one)).toEqual(['a.ts:2 swallowed failure catch {}'])
    expect(unallowed(found, [...one, ...one])).toEqual([])
  })

  test('ARC-15 the allow list holds exactly the empty catch around the first rollback in index.ts, with its reason', () => {
    const allow = allowList()
    expect(allow.map((a) => `${a.file} ${a.text}`)).toEqual([`${DB_DIR}/index.ts catch {}`])
    expect(allow[0]?.reason).toMatch(/rollback/i)
    expect(allow[0]?.reason).toMatch(/finally|destroy/i)
  })

  test('ARC-15 an allow entry silences only its own file and text', () => {
    const found = hits([{ file: 'a.ts', src: 'x.catch(() => undefined)\ny.catch(() => {})' }])
    const allow: Allow[] = [{ file: 'a.ts', text: '.catch(() => undefined)', reason: 'test' }]
    expect(unallowed(found, allow)).toEqual(['a.ts:2 swallowed failure .catch(() => {})'])
    expect(unallowed(found, [{ file: 'b.ts', text: '.catch(() => undefined)', reason: 'test' }])).toHaveLength(2)
  })
})

// SC11 round 2 (A500): R116 and R117 at run time, on Postgres 16 (PGlite has no pool). index.ts exports
// `openPool(config)` (a pg.Pool whose clients are tracked from connect to end and whose pool and client errors are
// recorded), `endPool(pool)` (pool.end(), then waits, 5 s at most, for every tracked client to end, including one
// destroyed by release(true); a client that never ends is a failure naming it) and `takeLateErrors()` (the errors
// recorded after their pool had ended, as strings with the code and message, cleared by the call; assertCleanClones
// rejects naming them, so vitest-setup.ts reports them in afterEach).
interface PoolApi {
  openPool(config: Record<string, unknown>): PoolHandle
  endPool(pool: PoolHandle): Promise<void>
  takeLateErrors(): string[]
}
interface PoolHandle {
  connect(): Promise<ClientHandle>
}
interface ClientHandle {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  release(destroy?: boolean): void
  emit(event: string, ...args: unknown[]): boolean
  connection?: { stream?: { destroyed?: boolean } }
}
function poolApi(): PoolApi {
  const m = dbModule as unknown as Partial<PoolApi>
  for (const k of ['openPool', 'endPool', 'takeLateErrors'] as const) {
    if (typeof m[k] !== 'function') throw new Error(`src/core/db/index.ts does not export ${k} (SC11 round 2 build)`)
  }
  return m as PoolApi
}
function pgUrl(): string {
  const t = dbModule.testDbTarget(process.env)
  if (t.kind !== 'pg16') throw new Error('SC11: these tests need TEST_DB=pg16')
  return t.url
}
const killed57P01 = (): Error =>
  Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' })
const dbNamed = (name: string): RegExp => new RegExp(`${name}[\\s\\S]*57P01|57P01[\\s\\S]*${name}`)

describe('SC11 R117 endPool resolves only after every connection has ended (ARC-6)', () => {
  test.runIf(ON)(
    'ARC-6 after endPool every client socket the pool opened is closed, including one destroyed by release(true)',
    async () => {
      const pa = poolApi()
      const pool = pa.openPool({ connectionString: pgUrl(), max: 3, application_name: `sc11_end_${PID}` })
      const [a, b, c] = [await pool.connect(), await pool.connect(), await pool.connect()]
      await Promise.all([a.query('select 1'), b.query('select 1'), c.query('select 1')])
      a.release(true)
      b.release()
      c.release()
      await pa.endPool(pool)
      for (const [name, cl] of [
        ['destroyed', a],
        ['idle', b],
        ['second idle', c],
      ] as const) {
        expect(cl.connection?.stream?.destroyed, `the ${name} client's socket is closed when endPool resolves`).toBe(true)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 endPool rejects, naming the pool, when a checked-out client is never released within the bound',
    async () => {
      const pa = poolApi()
      const pool = pa.openPool({ connectionString: pgUrl(), max: 1, application_name: `sc11_bound_${PID}` })
      const held = await pool.connect()
      await held.query('select 1')
      const t0 = Date.now()
      await expect(pa.endPool(pool)).rejects.toThrow(/sc11_bound_|did not end|checked out/i)
      expect(Date.now() - t0, 'the wait is bounded (5 s) and the 30 s hookTimeout does not fire').toBeLessThan(15_000)
      held.release(true)
    },
    BOOT_MS,
  )
})

describe('SC11 R116 a connection error is recorded, never thrown (ARC-6, ARC-15)', () => {
  test.runIf(ON)(
    'ARC-6 an error that arrives after endPool is recorded as a late error, not thrown out of the test, and is taken once',
    async () => {
      const pa = poolApi()
      pa.takeLateErrors()
      const pool = pa.openPool({ connectionString: pgUrl(), max: 1, application_name: `sc11_late_${PID}` })
      const c = await pool.connect()
      await c.query('select 1')
      c.release()
      await pa.endPool(pool)
      expect(() => c.emit('error', killed57P01())).not.toThrow()
      expect(pa.takeLateErrors().join('\n')).toMatch(/57P01/)
      expect(pa.takeLateErrors(), 'taking clears them').toEqual([])
    },
    BOOT_MS,
  )

  type Pooled = Queryable & { pool: PoolLike }
  const killIdle = async (db: Pooled): Promise<void> => {
    const c = (await db.pool.connect()) as unknown as ClientHandle
    const pid = (await c.query('select pg_backend_pid() as pid')).rows[0]?.['pid']
    c.release()
    await db.query('select pg_terminate_backend($1)', [pid])
    await sleep(500)
  }

  test.runIf(ON)(
    'ARC-6 a pooled backend killed while idle is recorded: assertCleanClones and close reject naming the database and 57P01',
    async () => {
      const db = (await cloneTestDb()) as unknown as Pooled
      const name = (await db.query('select current_database() as n')).rows[0]?.['n'] as string
      await killIdle(db)
      await expect(api('assertCleanClones')()).rejects.toThrow(dbNamed(name))
      await expect(db.close()).rejects.toThrow(/57P01/)
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 a backend killed while checked out inside transaction() is recorded: the transaction rejects, then assertCleanClones and close reject naming 57P01',
    async () => {
      const db = (await cloneTestDb()) as unknown as Pooled
      const name = (await db.query('select current_database() as n')).rows[0]?.['n'] as string
      await expect(
        db.transaction(async (tx) => {
          const pid = (await tx.query('select pg_backend_pid() as pid')).rows[0]?.['pid']
          const other = (await db.pool.connect()) as unknown as ClientHandle
          await other.query('select pg_terminate_backend($1)', [pid])
          other.release()
          await sleep(500)
          await tx.query('select 1')
        }),
      ).rejects.toThrow()
      await expect(api('assertCleanClones')()).rejects.toThrow(dbNamed(name))
      await expect(db.close()).rejects.toThrow(/57P01/)
    },
    BOOT_MS,
  )

  test('ARC-6 assertCleanClones reports takeLateErrors, so a late error is named by the next afterEach or afterAll', () => {
    const src = readOwnSource(`${DB_DIR}/index.ts`)
    const body = /export\s+async\s+function\s+assertCleanClones\b[\s\S]*?\n\}/.exec(src)?.[0] ?? ''
    expect(body, 'sentinel: assertCleanClones is defined in index.ts').not.toBe('')
    expect(body).toContain('takeLateErrors')
  })
})

// SC11 round 3 (A508): close, closeClones, the template's failure path and withAdmin collect every failure (RC1),
// and closing 25 clones at once stays well inside max_connections (S12, a guard). Postgres 16 only.
interface AdminPool {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}
interface Round3DbApi {
  openPool(config: Record<string, unknown>): AdminPool
  endPool(pool: AdminPool): Promise<void>
  takeLateErrors(): string[]
  withAdmin<T>(url: string, run: (admin: AdminPool) => Promise<T>): Promise<T>
}
function round3<K extends keyof Round3DbApi>(k: K): Round3DbApi[K] {
  const f = (dbModule as unknown as Partial<Round3DbApi>)[k]
  if (typeof f !== 'function') throw new Error(`src/core/db/index.ts does not export ${k} (SC11 round 3 build)`)
  return f as Round3DbApi[K]
}
type Clone = Queryable & { pool: PoolLike }
const failureOf = async (p: Promise<unknown>): Promise<string> =>
  p.then(
    () => 'resolved',
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  )
const nameOf = async (db: Clone): Promise<string> => (await db.query('select current_database() as n')).rows[0]?.['n'] as string
async function killOneIdle(db: Clone): Promise<void> {
  const c = (await db.pool.connect()) as unknown as ClientHandle
  const pid = (await c.query('select pg_backend_pid() as pid')).rows[0]?.['pid']
  c.release()
  await db.query('select pg_terminate_backend($1)', [pid])
  await sleep(500)
}
/** A clone made undroppable: `drop database ... with (force)` fails on a template database. */
async function undroppable(admin: AdminPool, name: string): Promise<void> {
  await admin.query(`alter database "${name}" is_template true`)
}
async function unblockAndDrop(admin: AdminPool, name: string): Promise<void> {
  await admin.query(`alter database "${name}" is_template false`)
  await admin.query(`drop database if exists "${name}" with (force)`)
}

describe('SC11 round 3 cleanup collects every failure on Postgres 16 (RC1, ARC-6)', () => {
  test.runIf(ON)(
    'ARC-6 S6 close names both a killed idle backend (57P01) and a failed drop, and leaves nothing late',
    async () => {
      const admin = poolApi().openPool({ connectionString: pgUrl(), max: 1, application_name: `sc11_s6_${PID}` }) as unknown as AdminPool
      const db = (await cloneTestDb()) as unknown as Clone
      const name = await nameOf(db)
      try {
        poolApi().takeLateErrors()
        await killOneIdle(db)
        await undroppable(admin, name)
        const msg = await failureOf(db.close())
        expect(msg).toMatch(/57P01/)
        expect(msg).toMatch(/template database/i)
        expect(poolApi().takeLateErrors(), 'nothing from this close reaches the next test').toEqual([])
      } finally {
        await unblockAndDrop(admin, name)
        await poolApi().endPool(admin as never)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 S7 closeClones with two undroppable clones rejects naming both databases',
    async () => {
      const admin = poolApi().openPool({ connectionString: pgUrl(), max: 1, application_name: `sc11_s7_${PID}` }) as unknown as AdminPool
      const a = (await cloneTestDb()) as unknown as Clone
      const b = (await cloneTestDb()) as unknown as Clone
      const names = [await nameOf(a), await nameOf(b)]
      try {
        for (const n of names) await undroppable(admin, n)
        const msg = await failureOf(dbModule.closeClones())
        for (const n of names) expect(msg).toContain(n)
      } finally {
        for (const n of names) await unblockAndDrop(admin, n)
        await poolApi().endPool(admin as never)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 S8 a schema file that kills its own backend fails createTemplate naming the file and 57P01, and leaves no template database',
    async () => {
      const admin = poolApi().openPool({ connectionString: pgUrl(), max: 1, application_name: `sc11_s8_${PID}` }) as unknown as AdminPool
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc11-s8-'))
      fs.writeFileSync(path.join(dir, '001_sc11_kill_test.sql'), 'select pg_terminate_backend(pg_backend_pid());\n')
      const templates = async (): Promise<string[]> =>
        (
          await admin.query('select datname from pg_database where datname like $1 order by datname', [
            `ashbridge\\_t\\_%\\_tpl%\\_${PID}`,
          ])
        ).rows.map((r) => String(r['datname']))
      try {
        const before = await templates()
        const msg = await failureOf(
          dbModule.createTemplate(dir).then(async (t) => {
            await t.close()
          }),
        )
        expect(msg).toContain('001_sc11_kill_test.sql')
        expect(msg).toMatch(/57P01/)
        expect(await templates(), 'the failed template database is dropped').toEqual(before)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
        await poolApi().endPool(admin as never)
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-6 S9 withAdmin is exported, and a run that kills its own backend rejects naming 57P01',
    async () => {
      const withAdmin = round3('withAdmin')
      const msg = await failureOf(
        withAdmin(pgUrl(), async (admin) => {
          await admin.query('select pg_terminate_backend(pg_backend_pid())')
        }),
      )
      expect(msg).toMatch(/57P01/)
    },
    BOOT_MS,
  )

  /** Throws when the peak passes the limit (S12's check; proved below by a limit one under the peak). */
  const assertPeak = (peak: number, limit: number): void => {
    if (peak > limit) throw new Error(`connection peak ${String(peak)} is over the limit ${String(limit)}`)
  }

  test.runIf(ON)(
    'ARC-6 S12 GUARD closing 25 clones, each after a transaction, peaks at most 0.8 of max_connections (the peak is printed)',
    async () => {
      const sampler = poolApi().openPool({ connectionString: pgUrl(), max: 1, application_name: `sc11_s12_${PID}` }) as unknown as AdminPool
      try {
        const max = Number((await sampler.query('show max_connections')).rows[0]?.['max_connections'])
        expect(max).toBeGreaterThan(0)
        const dbs: Queryable[] = []
        for (let i = 0; i < 25; i += 1) dbs.push((await cloneTestDb()) as unknown as Queryable)
        await Promise.all(dbs.map((d) => d.transaction((tx) => tx.query('select 1'))))
        const count = async (): Promise<number> =>
          Number(
            (await sampler.query(`select count(*)::int as n from pg_stat_activity where backend_type = 'client backend'`)).rows[0]?.['n'],
          )
        let peak = await count()
        const sampling = { on: true }
        const loop = (async (): Promise<void> => {
          while (sampling.on) {
            peak = Math.max(peak, await count())
            await sleep(10)
          }
        })()
        try {
          await dbModule.closeClones()
        } finally {
          sampling.on = false
          await loop
        }
        process.stdout.write(`SC11 S12: connection peak ${String(peak)} of max_connections ${String(max)} (0.6 is ${String(0.6 * max)})\n`)
        expect(peak, 'sentinel: the sampler saw every clone').toBeGreaterThanOrEqual(25)
        expect(() => {
          assertPeak(peak, peak - 1)
        }, 'PLANT: a limit one under the peak fails').toThrow(/over the limit/)
        assertPeak(peak, Math.floor(0.8 * max))
      } finally {
        await poolApi().endPool(sampler as never)
      }
    },
    120_000,
  )
})
