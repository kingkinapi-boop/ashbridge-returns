// DB16 acceptance tests, database part (spec-writer; builders never edit this file). Runs in the db
// project twice in cloud checks: with the switch off (PGlite, the default) and with TEST_DB=pg16 (the
// local Postgres 16 cluster). The unit part is pg16.acceptance.test.ts.
//
// What these tests fix (amber in reports/DB16-spec.md):
// - Switch off: cloneTestDb() is a PGlite clone, exactly as today.
// - Switch on: cloneTestDb() gives a PGlite-shaped handle (query, exec, transaction, close) on a fresh
//   database of the local Postgres 16 cluster, reached over TCP on 127.0.0.1, with the whole schema
//   loaded (triggers included). Separate transactions on one handle run on separate connections, so
//   they really overlap (A06's row-locked sign-in is proven only there).
// - The planted race: two transactions both read one row before either writes, under READ COMMITTED,
//   so one update is lost. PGlite's single connection serialises them (the second cannot start until the
//   first commits), so the race cannot happen there: the test is expected to FAIL on PGlite (test.fails)
//   and to PASS on Postgres 16. Before the build, TEST_DB=pg16 still runs PGlite, so it fails there.
//   The barrier waits at most RACE_WAIT_MS for the other transaction; on Postgres 16 both arrive within
//   milliseconds, on PGlite the wait runs out and the first transaction carries on alone.
// - Clones stay isolated, and SEC-7 (the database refuses changes to events) holds on either backend.
//
// Round 2 (reports/DB16-spec-review.md, A411):
// - createTemplate(DEFAULT_SCHEMA_DIR) honours the switch too (two contract test files call it directly).
// - SEC-7 by class: every returns table the catalog shows with a truncate guard refuses truncate through
//   its own guard, and has a row guard on UPDATE and DELETE (jobs: DELETE); the triggers loaded are
//   exactly the `create trigger` names in db/schema/*.sql, so a partial load fails.
// - ARC-16 parity: the session settings and the JS types of values are the same on both backends, fixed
//   to what PGlite gives today (read 3 Oct 2026 with TZ=America/Toronto): money in int8 cents stays a
//   JS number, numeric stays a string, a date is a Date at UTC midnight.
// This file imports no PGlite value: only src/core/db builds a database (the rule scan in the unit part).
import fs from 'node:fs'
import path from 'node:path'
import type { Transaction } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { DEFAULT_SCHEMA_DIR, cloneTestDb, createTemplate } from './index'

const ON = process.env['TEST_DB'] === 'pg16'
const RACE_WAIT_MS = 1_000
const BOOT_MS = 30_000
const DEFAULT_DATABASES = ['postgres', 'template0', 'template1']

describe('DB16 which backend the db project runs on (ARC-4)', () => {
  test.runIf(!ON)('ARC-4 with the switch off, a test database is a PGlite clone, exactly as today', async () => {
    const db = await cloneTestDb()
    const v = await db.query<{ v: string }>('select version() as v')
    expect(v.rows[0]?.v).toMatch(/PGlite/)
  })

  test.runIf(ON)(
    'ARC-4 with TEST_DB=pg16, createTemplate(DEFAULT_SCHEMA_DIR) called directly also gives Postgres 16 on 127.0.0.1, not PGlite',
    async () => {
      const template = await createTemplate(DEFAULT_SCHEMA_DIR)
      try {
        const db = await template.clone()
        try {
          const r = await db.query<{ v: string; num: string; host: string | null }>(
            `select version() as v, current_setting('server_version_num') as num, host(inet_server_addr()) as host`,
          )
          expect(r.rows[0]?.v).not.toMatch(/PGlite/)
          expect(Number(r.rows[0]?.num)).toBeGreaterThanOrEqual(160000)
          expect(Number(r.rows[0]?.num)).toBeLessThan(170000)
          expect(r.rows[0]?.host).toBe('127.0.0.1')
        } finally {
          await db.close()
        }
      } finally {
        await template.close()
      }
    },
    BOOT_MS,
  )

  test.runIf(ON)(
    'ARC-4 with TEST_DB=pg16, a test database is Postgres 16 (not PGlite), reached on 127.0.0.1, in a fresh database of its own',
    async () => {
      const db = await cloneTestDb()
      const r = await db.query<{ v: string; num: string; host: string | null; name: string }>(
        `select version() as v, current_setting('server_version_num') as num,
                host(inet_server_addr()) as host, current_database() as name`,
      )
      const row = r.rows[0]
      expect(row?.v).not.toMatch(/PGlite/)
      expect(Number(row?.num)).toBeGreaterThanOrEqual(160000)
      expect(Number(row?.num)).toBeLessThan(170000)
      expect(row?.host).toBe('127.0.0.1')
      expect(DEFAULT_DATABASES).not.toContain(row?.name)
    },
  )
})

describe('DB16 test databases on either backend (ARC-4, SEC-7)', () => {
  test('ARC-4 two test databases are isolated: a table made in one is not in the other', async () => {
    const a = await cloneTestDb()
    const b = await cloneTestDb()
    await a.exec('create table public.db16_only_here (id int primary key)')
    const inA = await a.query<{ t: string | null }>(`select to_regclass('public.db16_only_here')::text as t`)
    const inB = await b.query<{ t: string | null }>(`select to_regclass('public.db16_only_here')::text as t`)
    expect(inA.rows[0]?.t).toBe('db16_only_here')
    expect(inB.rows[0]?.t).toBeNull()
  })

  test('SEC-7 the schema is loaded with its triggers: truncating the state events is refused by the database', async () => {
    const db = await cloneTestDb()
    await expect(db.exec('truncate returns.state_events')).rejects.toThrow()
    const n = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_trigger where tgname in ('state_events_no_truncate', 'state_events_append_only', 'state_events_guard')`,
    )
    expect(n.rows[0]?.n).toBe(3)
  })
})

// ---- SEC-7 by class: every guard the schema declares is loaded and refuses ----

type Db = Awaited<ReturnType<typeof cloneTestDb>>

// The append-only and versioned tables of the schema as of 3 Oct 2026: a floor, not the list (the
// catalog is the list, so a new guarded table is covered without editing this file).
const GUARDED_FLOOR = [
  'adjusting_entries', 'approvals', 'bridge_ops_items', 'client_handoff', 'client_refs', 'entry_lines', 'events', 'facts',
  'gifi_mappings', 'jobs', 'judgment_inputs', 'sign_in_events', 'state_events', 'version_cells', 'versions',
]
// pg_trigger.tgtype bits (src/include/catalog/pg_trigger.h).
const ROW = 1
const BEFORE = 2
const DELETE = 8
const UPDATE = 16
const TRUNCATE = 32

function declaredTriggers(): string[] {
  const names = new Set<string>()
  for (const f of fs.readdirSync(DEFAULT_SCHEMA_DIR).filter((x) => x.endsWith('.sql'))) {
    const sql = fs
      .readFileSync(path.join(DEFAULT_SCHEMA_DIR, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '')
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+"?([a-z_][a-z0-9_]*)"?/gi)) {
      names.add((m[1] ?? '').toLowerCase())
    }
  }
  return [...names].sort()
}

async function loadedTriggers(db: Db): Promise<string[]> {
  const r = await db.query<{ name: string }>(
    `select g.tgname as name from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where not g.tgisinternal and n.nspname not in ('pg_catalog', 'information_schema') order by 1`,
  )
  return r.rows.map((x) => x.name)
}

function triggerDiff(declared: string[], loaded: string[]): { missing: string[]; extra: string[] } {
  return {
    missing: declared.filter((n) => !loaded.includes(n)),
    extra: loaded.filter((n) => !declared.includes(n)),
  }
}

async function truncateGuarded(db: Db): Promise<string[]> {
  const r = await db.query<{ t: string }>(
    `select distinct c.relname as t from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'returns' and not g.tgisinternal and (g.tgtype & ${String(TRUNCATE)}) <> 0 and (g.tgtype & ${String(BEFORE)}) <> 0
      order by 1`,
  )
  return r.rows.map((x) => x.t)
}

/** What truncating one table does. Cascade, so a foreign key cannot refuse it in the guard's place: the table's own guard fires first. */
async function truncateOutcome(db: Db, table: string): Promise<string> {
  try {
    await db.exec(`truncate returns.${table} cascade`)
    return 'allowed'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new RegExp(`TRUNCATE on returns\\.${table}\\b`).test(msg) ? 'refused by its own guard' : `refused by something else: ${msg}`
  }
}

async function rowGuards(db: Db, table: string): Promise<{ update: boolean; delete: boolean }> {
  const r = await db.query<{ ty: number }>(
    `select g.tgtype::int as ty from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'returns' and c.relname = $1 and not g.tgisinternal`,
    [table],
  )
  const rowBefore = r.rows.map((x) => x.ty).filter((ty) => (ty & ROW) !== 0 && (ty & BEFORE) !== 0)
  return { update: rowBefore.some((ty) => (ty & UPDATE) !== 0), delete: rowBefore.some((ty) => (ty & DELETE) !== 0) }
}

describe('DB16 SEC-7 every guard, by class, on either backend', () => {
  test('SEC-7 the triggers loaded are exactly the create trigger names in db/schema/*.sql (a partial load fails)', async () => {
    const db = await cloneTestDb()
    const declared = declaredTriggers()
    expect(declared.length, 'the schema declares its guards').toBeGreaterThanOrEqual(40)
    expect(triggerDiff(declared, await loadedTriggers(db))).toEqual({ missing: [], extra: [] })
  })

  test('SEC-7 planted: a declared trigger missing from the catalog is reported by name', async () => {
    const db = await cloneTestDb()
    const loaded = await loadedTriggers(db)
    expect(triggerDiff([...declaredTriggers(), 'planted_missing_guard'], loaded).missing).toEqual(['planted_missing_guard'])
    await db.exec('drop trigger jobs_no_delete on returns.jobs')
    expect(triggerDiff(declaredTriggers(), await loadedTriggers(db)).missing).toEqual(['jobs_no_delete'])
  })

  test('SEC-7 every returns table with a truncate guard refuses truncate through its own guard, and guards its rows on update and delete (jobs: delete)', async () => {
    const db = await cloneTestDb()
    const guarded = await truncateGuarded(db)
    expect(guarded).toEqual(expect.arrayContaining(GUARDED_FLOOR))
    const outcomes: Record<string, string> = {}
    const rows: Record<string, { update: boolean; delete: boolean }> = {}
    for (const t of guarded) {
      outcomes[t] = await truncateOutcome(db, t)
      const g = await rowGuards(db, t)
      rows[t] = t === 'jobs' ? { update: true, delete: g.delete } : g
    }
    expect(outcomes).toEqual(Object.fromEntries(guarded.map((t) => [t, 'refused by its own guard'])))
    expect(rows).toEqual(Object.fromEntries(guarded.map((t) => [t, { update: true, delete: true }])))
  })

  test('SEC-7 planted: with its truncate guard dropped, state_events is no longer refused by its own guard', async () => {
    const db = await cloneTestDb()
    await db.exec('drop trigger state_events_no_truncate on returns.state_events')
    expect(await truncateOutcome(db, 'state_events')).not.toBe('refused by its own guard')
    expect(await truncateGuarded(db)).not.toContain('state_events')
  })
})

// ---- ARC-16 the same results on both backends ----

describe('DB16 ARC-16 parity: Postgres 16 behaves like PGlite for the tests', () => {
  test('ARC-16 the session settings and the test database locale are pinned (the values PGlite gives today)', async () => {
    const db = await cloneTestDb()
    const r = await db.query<Record<string, string>>(
      `select current_setting('TimeZone') as timezone, current_setting('DateStyle') as datestyle,
              current_setting('IntervalStyle') as intervalstyle,
              current_setting('default_transaction_isolation') as isolation,
              current_setting('server_encoding') as server_encoding, current_setting('client_encoding') as client_encoding,
              current_setting('standard_conforming_strings') as standard_strings,
              d.datcollate as collate, d.datctype as ctype
         from pg_database d where d.datname = current_database()`,
    )
    expect(r.rows[0]).toEqual({
      timezone: 'Etc/GMT+5',
      datestyle: 'ISO, MDY',
      intervalstyle: 'postgres',
      isolation: 'read committed',
      server_encoding: 'UTF8',
      client_encoding: 'UTF8',
      standard_strings: 'on',
      collate: 'C',
      ctype: 'C.UTF-8',
    })
  })

  test('ARC-16 values come back as the same JS types: int8 cents stay numbers, numeric stays a string, a date is a Date at UTC midnight', async () => {
    const db = await cloneTestDb()
    const r = await db.query<Record<string, unknown>>(
      `select 7::int4 as i4, 12345::int8 as cents, (-123456)::int8 as cents_negative, 9007199254740993::int8 as i8_beyond_safe,
              count(*) as n, 1234.50::numeric(12,2) as num, 'Hello (Test)'::text as txt, true as yes,
              date '2026-03-31' as day, timestamptz '2026-03-31 12:00:00+00' as at, '{"k": [1, "2"]}'::jsonb as doc,
              null::text as nothing, null::int8 as no_cents, '{1,2}'::int4[] as ints,
              'a1b2c3d4-0000-4000-8000-000000000001'::uuid as id`,
    )
    expect(r.rows[0]).toStrictEqual({
      i4: 7,
      cents: 12345,
      cents_negative: -123456,
      i8_beyond_safe: 9007199254740993n,
      n: 1,
      num: '1234.50',
      txt: 'Hello (Test)',
      yes: true,
      day: new Date('2026-03-31T00:00:00.000Z'),
      at: new Date('2026-03-31T12:00:00.000Z'),
      doc: { k: [1, '2'] },
      nothing: null,
      no_cents: null,
      ints: [1, 2],
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
    })
  })

  test('ARC-16 a money parameter goes in as a number and comes back as the same number', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ cents: unknown; total: unknown }>('select $1::int8 as cents, ($1::int8 + $2::int8) as total', [123456, -6])
    expect(r.rows[0]).toStrictEqual({ cents: 123456, total: 123450 })
  })
})

describe('DB16 the planted race (ARC-4): only real Postgres runs two transactions at once', () => {
  const race = ON ? test : test.fails
  race(
    'ARC-4 planted race: two transactions both read the row before either writes (READ COMMITTED), so one increment is lost; PGlite serialises them, so this fails there and passes on Postgres 16',
    async () => {
      const db = await cloneTestDb()
      await db.exec('create table public.db16_counter (id int primary key, n int not null); insert into public.db16_counter values (1, 0);')
      let arrived = 0
      const waiting: (() => void)[] = []
      const barrier = (): Promise<void> =>
        new Promise<void>((resolve) => {
          arrived += 1
          if (arrived >= 2) {
            for (const w of waiting.splice(0)) w()
            resolve()
            return
          }
          waiting.push(resolve)
          setTimeout(resolve, RACE_WAIT_MS)
        })
      const reads: number[] = []
      const isolation: string[] = []
      const backends: number[] = []
      const bump = async (tx: Transaction): Promise<void> => {
        const iso = await tx.query<{ i: string; pid: number }>(`select current_setting('transaction_isolation') as i, pg_backend_pid() as pid`)
        isolation.push(iso.rows[0]?.i ?? '')
        backends.push(iso.rows[0]?.pid ?? -1)
        const r = await tx.query<{ n: number }>('select n from public.db16_counter where id = 1')
        const seen = r.rows[0]?.n ?? -1
        reads.push(seen)
        await barrier()
        await tx.query('update public.db16_counter set n = $1 where id = 1', [seen + 1])
      }
      await Promise.all([db.transaction(bump), db.transaction(bump)])
      const end = await db.query<{ n: number }>('select n from public.db16_counter where id = 1')
      expect(isolation).toEqual(['read committed', 'read committed'])
      expect(new Set(backends).size, 'the two transactions run on two connections, not one session').toBe(2)
      expect(reads, 'both transactions read before either wrote').toEqual([0, 0])
      expect(end.rows[0]?.n, 'one increment is lost').toBe(1)
    },
    RACE_WAIT_MS * 5,
  )
})
