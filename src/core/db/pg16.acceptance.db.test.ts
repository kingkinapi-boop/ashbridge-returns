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
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { cloneTestDb } from './index'

const ON = process.env['TEST_DB'] === 'pg16'
const RACE_WAIT_MS = 1_000
const DEFAULT_DATABASES = ['postgres', 'template0', 'template1']

describe('DB16 which backend the db project runs on (ARC-4)', () => {
  test.runIf(!ON)('ARC-4 with the switch off, a test database is a PGlite clone, exactly as today', async () => {
    const db = await cloneTestDb()
    expect(db).toBeInstanceOf(PGlite)
    const v = await db.query<{ v: string }>('select version() as v')
    expect(v.rows[0]?.v).toMatch(/PGlite/)
  })

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
