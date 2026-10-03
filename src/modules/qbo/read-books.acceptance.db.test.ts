// B04 acceptance tests, the database side: snapshots and the normalised rows they hold in the card's schema file,
// 35_qbo.sql (TB-10, TB-1, EV-1, EV-5, SEC-7, SEC-11). Spec-writer's file; builders never edit it. Each behaviour proven
// here through createDbSnapshotStore has a unit twin through createMemorySnapshotStore in read-books.acceptance.test.ts
// (A04, A391); the table properties (row-level security, no policies, is_test, append-only, the return foreign key) are
// schema facts with no TypeScript to mutate.
//
// The tables these tests fix (spec choices, amber): schema returns, all append-only (UPDATE, DELETE and TRUNCATE refused),
// row-level security on and no policies, id, created_at and is_test on every table (ARC-2, the records test):
//   qbo_snapshots           id, return_id, realm, kind, as_of, period_from, period_to, basis, account_id, attachment_id,
//                           engine, engine_version, read_at (timestamptz), sha256, file_key
//   qbo_accounts            snapshot_id, account_id, ... (one row per account of a trial balance snapshot)
//   qbo_trial_balance_lines snapshot_id, account_id, debit_cents, credit_cents, ...
//   qbo_transactions        snapshot_id, txn_id, id_kind, account_id, amount_cents, ...
//   qbo_journal_entries     snapshot_id, txn_id, memo, ...
//   qbo_journal_lines       account_id, debit_cents, credit_cents, ... (tied to its entry by a column of the builder's choice)
//   qbo_attachments         snapshot_id, attachment_id, sha256, ...
// return_id is a foreign key to returns.returns(id) (EV-5, ARC-3; SC R43 and the records catalog test). returns.returns
// is created by 50_returns.sql, after 35_qbo.sql, so that key cannot be declared in 35_qbo.sql alone: the Lead decides
// where it is added (a Paths gap reported with this spec). The tests below seed the return they read for.
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { createFileStore } from '../storage'
import { createDbSnapshotStore, createQboReader, readBooks } from './index'
import { NON_TEST_REALM, REALM, RETURN_ID, STANDIN_DIR, YEAR_END, YEAR_START, failure, samplesEnv, tempDir } from './__fixtures__/harness'

const TABLES = ['qbo_snapshots', 'qbo_accounts', 'qbo_trial_balance_lines', 'qbo_transactions', 'qbo_journal_entries', 'qbo_journal_lines', 'qbo_attachments'] as const
const AT = '2026-10-01T12:00:00-04:00'
const LATER = '2026-10-02T09:30:00-04:00'

let db: PGlite
let tmp: { dir: string; cleanup: () => void }

beforeEach(async () => {
  db = await cloneTestDb()
  await addReturn(RETURN_ID)
  tmp = tempDir('db')
  fs.mkdirSync(path.join(tmp.dir, 'store'))
})
afterEach(async () => {
  await db.close()
  tmp.cleanup()
})

async function addReturn(id: string): Promise<void> {
  await db.query(`insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, '2025-12-31', 'intake')`, [id, 'Birchwood Fixture Ltd. (Test)'])
}
async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}
async function count(table: string, where = 'true', params: unknown[] = []): Promise<number> {
  return (await rows<{ n: number }>(`select count(*)::int as n from returns.${table} where ${where}`, params))[0]?.n ?? -1
}
function run(at: string = AT) {
  const files = createFileStore({ root: path.join(tmp.dir, 'store') })
  return readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, {
    reader: createQboReader({ env: samplesEnv(STANDIN_DIR) }),
    files,
    store: createDbSnapshotStore(db),
    clock: fixedClock(at),
  })
}

describe('B04 snapshot rows in the database (TB-10)', () => {
  test('TB-10 readBooks writes one returns.qbo_snapshots row per read, with read-at, sha256, engine and file key as the result says', async () => {
    const r = await run()
    const got = await rows<{ id: string; kind: string; sha256: string; file_key: string; engine: string; engine_version: string; read_at: Date; realm: string; return_id: string; basis: string | null; as_of: unknown }>(
      'select * from returns.qbo_snapshots order by id',
    )
    expect(got).toHaveLength(r.snapshots.length)
    for (const s of r.snapshots) {
      const row = got.find((g) => g.id === s.id)
      expect(row, s.id).toBeDefined()
      expect([row?.kind, row?.sha256, row?.file_key, row?.engine, row?.engine_version, row?.realm, row?.return_id]).toEqual([s.kind, s.sha256, s.fileKey, s.engine, s.engineVersion, s.realm, s.returnId])
      expect(new Date(String(row?.read_at)).toISOString()).toBe(new Date(AT).toISOString())
    }
    expect(await createDbSnapshotStore(db).list()).toEqual(r.snapshots)
  })

  test('TB-10 reading again adds new dated rows and never changes the first ones', async () => {
    const first = await run(AT)
    const before = await rows('select * from returns.qbo_snapshots order by id')
    const second = await run(LATER)
    expect(await count('qbo_snapshots')).toBe(first.snapshots.length + second.snapshots.length)
    const firstAgain = await rows(`select * from returns.qbo_snapshots where id = any($1) order by id`, [first.snapshots.map((s) => s.id)])
    expect(firstAgain).toEqual(before)
    expect(await count('qbo_snapshots', 'read_at = $1', [new Date(LATER).toISOString()])).toBe(second.snapshots.length)
  })

  test('TB-1 TB-10 the normalised rows of each snapshot are stored: the year-end trial balance balances, every transaction and journal line is there', async () => {
    const r = await run()
    const tbSnap = r.snapshots.find((s) => s.kind === 'trial_balance' && s.asOf === YEAR_END)
    const lines = await rows<{ account_id: string; debit_cents: string | number; credit_cents: string | number }>(
      'select account_id, debit_cents, credit_cents from returns.qbo_trial_balance_lines where snapshot_id = $1 order by account_id',
      [tbSnap?.id],
    )
    expect(lines.map((l) => [l.account_id, Number(l.debit_cents), Number(l.credit_cents)])).toEqual(
      [...r.trialBalance].sort((a, b) => a.accountId.localeCompare(b.accountId)).map((x) => [x.accountId, x.debitCents, x.creditCents]),
    )
    expect(await count('qbo_accounts', 'snapshot_id = $1', [tbSnap?.id])).toBe(r.trialBalance.length)
    expect(await count('qbo_transactions')).toBe(r.transactions.length)
    const moved = await rows<{ account_id: string; txn_id: string; amount_cents: string | number; id_kind: string }>('select account_id, txn_id, amount_cents, id_kind from returns.qbo_transactions')
    for (const t of r.transactions) {
      expect(moved.some((m) => m.account_id === t.accountId && m.txn_id === t.txnId && Number(m.amount_cents) === t.amountCents && m.id_kind === t.idKind), `${t.accountId} ${t.txnId}`).toBe(true)
    }
    expect(await count('qbo_journal_entries')).toBe(r.journalEntries.length)
    const jl = await rows<{ d: string | number; c: string | number; n: number }>('select sum(debit_cents) as d, sum(credit_cents) as c, count(*)::int as n from returns.qbo_journal_lines')
    expect([Number(jl[0]?.d), Number(jl[0]?.c), jl[0]?.n]).toEqual([4500, 4500, 2])
    const att = await rows<{ attachment_id: string; sha256: string }>('select attachment_id, sha256 from returns.qbo_attachments order by attachment_id')
    expect(att.map((a) => a.attachment_id)).toEqual(['901', '902'])
    for (const a of att) expect(a.sha256).toBe(r.snapshots.find((s) => s.attachmentId === a.attachment_id)?.sha256)
  })

  test('EV-5 ARC-3 planted: readBooks for a return that does not exist is refused by the database and leaves no QBO row', async () => {
    const files = createFileStore({ root: path.join(tmp.dir, 'store') })
    const e = await failure(() =>
      readBooks('ret-b04-no-such-return', REALM, YEAR_START, YEAR_END, { reader: createQboReader({ env: samplesEnv(STANDIN_DIR) }), files, store: createDbSnapshotStore(db), clock: fixedClock(AT) }),
    )
    expect(e).toBeInstanceOf(Error)
    expect(await count('qbo_snapshots')).toBe(0)
  })

  test('SEC-11 a company whose legal name lacks "(Test)" writes no row in any QBO table', async () => {
    const files = createFileStore({ root: path.join(tmp.dir, 'store') })
    const e = await failure(() =>
      readBooks(RETURN_ID, NON_TEST_REALM, YEAR_START, YEAR_END, { reader: createQboReader({ env: samplesEnv(STANDIN_DIR) }), files, store: createDbSnapshotStore(db), clock: fixedClock(AT) }),
    )
    expect(e?.message).toContain('(Test)')
    for (const t of TABLES) expect(await count(t), t).toBe(0)
  })
})

describe('B04 the QBO tables are append-only, test-marked and closed (EV-1, SEC-7)', () => {
  for (const t of TABLES) {
    test(`EV-1 SEC-7 returns.${t} exists with row-level security on, no policies and an is_test column`, async () => {
      const rel = await rows<{ relrowsecurity: boolean }>(`select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'returns' and c.relname = $1`, [t])
      expect(rel, t).toHaveLength(1)
      expect(rel[0]?.relrowsecurity).toBe(true)
      expect(await rows(`select 1 from pg_policies where schemaname = 'returns' and tablename = $1`, [t])).toEqual([])
      expect(await rows(`select 1 from information_schema.columns where table_schema = 'returns' and table_name = $1 and column_name = 'is_test'`, [t])).toHaveLength(1)
    })
  }

  test('EV-1 SEC-7 planted: an UPDATE, a DELETE and a TRUNCATE of every QBO table after a read are refused, and the rows stay', async () => {
    await run()
    for (const t of TABLES) {
      const before = await count(t)
      expect(before, `${t} has rows to guard`).toBeGreaterThan(0)
      expect(await failure(() => db.query(`update returns.${t} set is_test = is_test`)), `${t} update`).toBeInstanceOf(Error)
      expect(await failure(() => db.query(`delete from returns.${t}`)), `${t} delete`).toBeInstanceOf(Error)
      expect(await failure(() => db.query(`truncate returns.${t} cascade`)), `${t} truncate`).toBeInstanceOf(Error)
      expect(await count(t), t).toBe(before)
    }
  })

  test('SEC-11 every QBO row written by a read is marked is_test', async () => {
    await run()
    for (const t of TABLES) expect(await count(t, 'is_test is not true'), t).toBe(0)
  })
})
