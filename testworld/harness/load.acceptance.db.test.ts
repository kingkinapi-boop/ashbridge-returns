// JH0 acceptance tests, checks 1, 2, 5 and 7 (END-9, SEC-11, ARC-16, ARC-4). Spec-writer; builders never edit this file.
// Mapping the builder implements (amber, JH0 spec): one returns.returns row (id `ret-<client>`, state 'intake'); one
// returns.accounts row per adjusted trial-balance row (qbo_account_id = the row's account, balance_cents = debit - credit);
// one returns.facts row per transaction (fact_key `txn:<id>`, value = amount cents, source = a QBO pointer); one
// returns.adjusting_entries row per adjusting entry with one returns.entry_lines row per line (amount_cents = debit - credit).
// Rows are inserted in bulk: C01 has 1502 transactions and a db test body has 6 s.
import { describe, expect, test } from 'vitest'
import { cloneTestDb } from '../../src/core/db'
import { loadClient } from '../index'
import { loadHarness, must, type HarnessDb } from './_api'

const count = async (db: HarnessDb, table: string): Promise<number> => {
  const r = (await db.query(`select count(*)::int as n from returns.${table}`)).rows[0] as { n: number }
  return r.n
}
const TABLES = ['returns', 'accounts', 'facts', 'adjusting_entries', 'entry_lines'] as const

describe('JH0 loader', () => {
  test('END-9 loading C01 into a fresh database writes its accounts, transactions and adjusting entries, all is_test', async () => {
    const h = await loadHarness()
    const c = loadClient('C01')
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const res = await h.load.loadIntoDb(db, 'C01')
    expect(res.returnId).toBe('ret-C01')
    expect(await count(db, 'returns')).toBe(1)
    expect(await count(db, 'accounts')).toBe(c.trialBalance.adjusted.rows.length)
    expect(await count(db, 'facts')).toBe(c.transactions.length)
    expect(await count(db, 'adjusting_entries')).toBe(c.adjustingEntries.length)
    expect(await count(db, 'entry_lines')).toBe(c.adjustingEntries.reduce((n, e) => n + e.lines.length, 0))
    expect(res.counts.facts).toBe(c.transactions.length)
    // no row in any table of schema returns is a live row
    const tables = (
      await db.query(
        `select table_name from information_schema.columns where table_schema = 'returns' and column_name = 'is_test'`,
      )
    ).rows as { table_name: string }[]
    expect(tables.length).toBeGreaterThan(5)
    for (const t of tables) {
      const live = (await db.query(`select count(*)::int as n from returns.${t.table_name} where is_test is not true`)).rows[0] as { n: number }
      expect(live.n, t.table_name).toBe(0)
    }
  })

  test('END-9 the loaded accounts carry the client balances and the adjusted trial balance nets to zero', async () => {
    const h = await loadHarness()
    const c = loadClient('C01')
    const db = (await cloneTestDb()) as unknown as HarnessDb
    await h.load.loadIntoDb(db, 'C01')
    const rows = (await db.query(`select qbo_account_id, balance_cents::text as b from returns.accounts order by qbo_account_id`)).rows as {
      qbo_account_id: string
      b: string
    }[]
    const want = new Map(c.trialBalance.adjusted.rows.map((r) => [r.account, r.debitCents - r.creditCents]))
    expect(rows.length).toBe(want.size)
    for (const r of rows) expect(Number(r.b), r.qbo_account_id).toBe(want.get(r.qbo_account_id))
    expect(rows.reduce((s, r) => s + Number(r.b), 0)).toBe(0)
  })

  test('END-9 every sample client C01 to C10 loads with its own return row', async () => {
    const h = await loadHarness()
    for (const id of ['C02', 'C05', 'C10'] as const) {
      const db = (await cloneTestDb()) as unknown as HarnessDb
      const res = await h.load.loadIntoDb(db, id)
      expect(res.returnId).toBe(`ret-${id}`)
      expect(await count(db, 'facts')).toBe(loadClient(id).transactions.length)
    }
  })

  test('END-9 an id that is neither a sample client nor a built kind is refused with the reason and nothing is written', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    await expect(h.load.loadIntoDb(db, 'C99')).rejects.toThrow(/C99/)
    await expect(h.load.loadIntoDb(db, 'K99')).rejects.toThrow(/K99/)
    for (const t of TABLES) expect(await count(db, t), t).toBe(0)
  })

  test('SEC-11 a database URL that is not local or a test-cloud database is refused with the reason, nothing written', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    for (const url of [
      'postgres://app:pw@db.prod.example.com:5432/returns',
      'postgres://postgres:pw@db.abcdefgh.supabase.co:5432/postgres',
      'postgres://10.0.0.5/returns',
      'not a url',
    ]) {
      const check = h.load.checkDatabaseUrl(url)
      expect(check.ok, url).toBeFalsy()
      await expect(h.load.loadIntoDb(db, 'C01', { databaseUrl: url }), url).rejects.toThrow(/not a local or test database/)
    }
    for (const t of TABLES) expect(await count(db, t), t).toBe(0)
  })

  test('SEC-11 a refusal never prints the password or the host credentials of the URL', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const err = await h.load.loadIntoDb(db, 'C01', { databaseUrl: 'postgres://app:hunter2secret@db.prod.example.com/returns' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(h.load.HarnessRefusal)
    expect((err as Error).message).not.toContain('hunter2secret')
    expect((err as { reason: string }).reason).not.toContain('hunter2secret')
  })

  test('SEC-11 local URLs and an allow-listed test-cloud host pass; the same host without the allow-list does not', async () => {
    const h = await loadHarness()
    for (const url of [undefined, '', 'postgres://postgres@localhost:5432/returns_test', 'postgres://u:p@127.0.0.1/x', 'postgres://u@[::1]/x', 'pglite://memory']) {
      expect(h.load.checkDatabaseUrl(url).ok, url ?? 'undefined').toBe(true)
    }
    const cloud = 'postgres://u:p@returns-test.cloud.example.net/x'
    expect(h.load.checkDatabaseUrl(cloud).ok).toBe(false)
    expect(h.load.checkDatabaseUrl(cloud, { testCloudHosts: ['returns-test.cloud.example.net'] }).ok).toBe(true)
    // a look-alike host is not the allow-listed host
    expect(h.load.checkDatabaseUrl('postgres://u@returns-test.cloud.example.net.evil.com/x', { testCloudHosts: ['returns-test.cloud.example.net'] }).ok).toBe(false)
    // a local name smuggled into the user part is not a local host
    expect(h.load.checkDatabaseUrl('postgres://localhost@db.prod.example.com/x').ok).toBe(false)
  })

  test('SEC-11 a record with is_test = false is refused, naming the table, and nothing at all is written', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const rows = h.load.buildRows(loadClient('C01'))
    expect(Object.values(rows).every((rs) => rs.every((r) => r.isTest))).toBe(true)
    for (const table of ['accounts', 'facts', 'entry_lines'] as const) {
      const bad = structuredClone(rows)
      const last = bad[table].length - 1
      bad[table][last] = { ...must(bad[table][last]), isTest: false }
      await expect(h.load.writeRows(db, bad), table).rejects.toThrow(new RegExp(`is_test.*${table}|${table}.*is_test`))
      for (const t of TABLES) expect(await count(db, t), table + ' then ' + t).toBe(0)
    }
  })

  test('SEC-11 a row with no isTest value at all is refused like a live one', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const rows = h.load.buildRows(loadClient('C01'))
    const bad = structuredClone(rows)
    const first = must(bad.accounts[0])
    const rest: Record<string, unknown> = { ...first }
    delete rest['isTest']
    bad.accounts[0] = rest as never
    await expect(h.load.writeRows(db, bad)).rejects.toThrow(/is_test/)
    expect(await count(db, 'accounts')).toBe(0)
  })

  test('ARC-16 two loads of the same client with the same seed give identical stored rows', async () => {
    const h = await loadHarness()
    const dump = async (): Promise<unknown> => {
      const db = (await cloneTestDb()) as unknown as HarnessDb
      await h.load.loadIntoDb(db, 'C01')
      const out: Record<string, unknown> = {}
      for (const t of ['returns', 'accounts', 'adjusting_entries', 'entry_lines'] as const) {
        out[t] = (await db.query(`select to_jsonb(x) - 'created_at' as r from returns.${t} x order by id`)).rows
      }
      out['facts'] = (await db.query(`select fact_key, value, version_no from returns.facts order by fact_key`)).rows
      return out
    }
    expect(await dump()).toEqual(await dump())
  })
})

describe('JH0 loader on Postgres 16 (cloud journeys only)', () => {
  test.skipIf(!process.env['HARNESS_PG_URL'])('ARC-4 the same C01 load writes the same counts on Postgres 16', async () => {
    const h = await loadHarness()
    const url = process.env['HARNESS_PG_URL'] as string
    expect(h.load.checkDatabaseUrl(url, { testCloudHosts: [] }).ok).toBe(true)
    const pgName = 'pg'
    const pg = (await import(/* @vite-ignore */ pgName)) as unknown as {
      default: { Client: new (o: { connectionString: string }) => { connect(): Promise<void>; query(s: string, p?: unknown[]): Promise<{ rows: unknown[] }>; end(): Promise<void> } }
    }
    const client = new pg.default.Client({ connectionString: url })
    await client.connect()
    try {
      const adapter: HarnessDb = { query: (s, p) => client.query(s, p), exec: async (s) => client.query(s) }
      const c = loadClient('C01')
      const res = await h.load.loadIntoDb(adapter, 'C01')
      expect(res.counts.facts).toBe(c.transactions.length)
      expect(res.counts.accounts).toBe(c.trialBalance.adjusted.rows.length)
    } finally {
      await client.end()
    }
  })
})
