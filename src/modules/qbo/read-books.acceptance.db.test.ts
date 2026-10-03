// B04 acceptance tests, the database side: snapshots and the normalised rows they hold in the card's schema file,
// 56_qbo.sql (TB-10, TB-1, EV-1, EV-5, SEC-7, SEC-11). Spec-writer's file; builders never edit it. Each behaviour proven
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
// return_id is a foreign key to returns.returns(id) (EV-5, ARC-3; SC R43 and the records catalog test). The file is
// 56_qbo.sql, after 50_returns.sql, so the key is real (A454). The tests below seed the return they read for.
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock } from '../../core/clock'
import { cloneTestDb } from '../../core/db'
import { createFileStore } from '../storage'
import { createDbSnapshotStore, createQboReader, readBooks } from './index'
import type { QboTransaction } from '../../contracts/qbo'
import { NON_TEST_REALM, REALM, RETURN_ID, STANDIN_DIR, YEAR_END, YEAR_START, copyStandIn, failure, readJson, samplesEnv, tempDir, writeJson } from './__fixtures__/harness'

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
function run(at: string = AT, dir: string = STANDIN_DIR) {
  const files = createFileStore({ root: path.join(tmp.dir, 'store') })
  return readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, {
    reader: createQboReader({ env: samplesEnv(dir) }),
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

// A507 item 8: the table checks run on every qbo_ table the catalogue holds, not only the hand list above, so a table
// the build adds is held to the same rules.
async function catalogueTables(): Promise<string[]> {
  const got = await rows<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'returns' and c.relkind in ('r', 'p') and c.relname like 'qbo\\_%' order by c.relname`,
  )
  return got.map((r) => r.relname)
}

describe('B04 every qbo_ table in the catalogue (EV-1, SEC-7, SEC-11, A507 item 8)', () => {
  test('EV-1 SEC-7 the catalogue holds every table of the hand list, and each catalogued qbo_ table has row-level security on, no policies and is_test', async () => {
    const tables = await catalogueTables()
    expect(tables.length).toBeGreaterThanOrEqual(TABLES.length)
    for (const t of TABLES) expect(tables, t).toContain(t)
    for (const t of tables) {
      const rel = await rows<{ relrowsecurity: boolean }>(`select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'returns' and c.relname = $1`, [t])
      expect(rel[0]?.relrowsecurity, t).toBe(true)
      expect(await rows(`select 1 from pg_policies where schemaname = 'returns' and tablename = $1`, [t]), t).toEqual([])
      expect(await rows(`select 1 from information_schema.columns where table_schema = 'returns' and table_name = $1 and column_name = 'is_test'`, [t]), t).toHaveLength(1)
    }
  })

  test('EV-1 SEC-7 SEC-11 planted: after a read, every catalogued qbo_ table holds rows, all is_test, and refuses UPDATE, DELETE and TRUNCATE', async () => {
    await run()
    const tables = await catalogueTables()
    expect(tables.length).toBeGreaterThan(0)
    for (const t of tables) {
      const before = await count(t)
      expect(before, `${t} has rows to guard`).toBeGreaterThan(0)
      expect(await count(t, 'is_test is not true'), t).toBe(0)
      expect(await failure(() => db.query(`update returns.${t} set is_test = is_test`)), `${t} update`).toBeInstanceOf(Error)
      expect(await failure(() => db.query(`delete from returns.${t}`)), `${t} delete`).toBeInstanceOf(Error)
      expect(await failure(() => db.query(`truncate returns.${t} cascade`)), `${t} truncate`).toBeInstanceOf(Error)
      expect(await count(t), t).toBe(before)
    }
  })

  // The plant copies a stored row and points it at a snapshot that does not exist. Columns with a default (an
  // identity, a created_at) take their default; a unique key that leaves out snapshot_id gets a fresh value of its
  // own type, so the only fault in the row is the missing snapshot (foreign key violation, 23503).
  const MISSING_SNAPSHOT = '00000000-0000-4000-8000-00000000b04f'
  function freshValue(dataType: string, k: number): string | number {
    if (/int|numeric|decimal/.test(dataType)) return 32000 + k
    if (dataType === 'uuid') return `00000000-0000-4000-8000-${String(900000000000 + k)}`
    if (/date|time/.test(dataType)) return '2099-12-31'
    return `b04-fk-plant-${String(k)} (Test)`
  }

  test('EV-5 TB-10 planted: every catalogued normalised qbo_ table with a snapshot_id refuses a row whose snapshot does not exist, and keeps none', async () => {
    await run()
    const tables = (await catalogueTables()).filter((t) => t !== 'qbo_snapshots')
    const withSnapshot: string[] = []
    for (const t of tables) {
      const cols = await rows<{ column_name: string; data_type: string; column_default: string | null; is_identity: string; is_generated: string }>(
        `select column_name, data_type, column_default, is_identity, is_generated from information_schema.columns where table_schema = 'returns' and table_name = $1 order by ordinal_position`,
        [t],
      )
      if (!cols.some((c) => c.column_name === 'snapshot_id')) continue
      withSnapshot.push(t)
      const uniqueCols = await rows<{ attname: string }>(
        `select distinct a.attname from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
           join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
          where n.nspname = 'returns' and c.relname = $1 and i.indisunique
            and not exists (select 1 from pg_attribute s where s.attrelid = c.oid and s.attnum = any(i.indkey) and s.attname = 'snapshot_id')`,
        [t],
      )
      const insertable = cols.filter((c) => c.column_default === null && c.is_identity === 'NO' && c.is_generated === 'NEVER')
      const patch: Record<string, string | number> = { snapshot_id: MISSING_SNAPSHOT }
      uniqueCols.forEach((u, k) => {
        const col = cols.find((c) => c.column_name === u.attname)
        if (col !== undefined && insertable.includes(col)) patch[u.attname] = freshValue(col.data_type, k)
      })
      const names = insertable.map((c) => `"${c.column_name}"`).join(', ')
      const before = await count(t)
      expect(before, `${t} has a row to copy`).toBeGreaterThan(0)
      let code = ''
      try {
        await db.query(
          `insert into returns.${t} (${names}) select ${names} from jsonb_populate_record(null::returns.${t}, (select to_jsonb(x) || $1::jsonb from returns.${t} x limit 1))`,
          [JSON.stringify(patch)],
        )
      } catch (e) {
        code = (e as { code?: string }).code ?? `no code: ${String((e as { message?: string }).message)}`
      }
      expect(code, `${t}: a row with a missing snapshot`).toBe('23503')
      expect(await count(t), t).toBe(before)
    }
    for (const t of ['qbo_accounts', 'qbo_trial_balance_lines', 'qbo_transactions', 'qbo_journal_entries', 'qbo_attachments']) expect(withSnapshot, t).toContain(t)
  })
})

// A507 item 6, the database side: identical rows are both stored, each with its 1-based position in its snapshot
// (source_line). Unit twin: "B04 identical rows are both kept" in read-books.acceptance.test.ts.
describe('B04 identical rows are both stored, with their source position (TB-10, A507 item 6)', () => {
  test('TB-10 planted: two identical transactions with a blank number on one account are both stored, at their own source_line', async () => {
    const dir = copyStandIn(path.join(tmp.dir, 'standin'))
    const file = path.join(dir, REALM, 'transactions', '35.json')
    const twin: QboTransaction = { txnId: '2025-05-02|Deposit||35|2500', idKind: 'composite', entityType: 'Deposit', date: '2025-05-02', number: '', memo: 'Coin deposit (Test)', accountId: '35', amountCents: 2500, otherAccountIds: ['79'], attachmentIds: [] }
    writeJson(file, [...(readJson(file) as QboTransaction[]), twin, twin])
    const r = await run(AT, dir)
    const snap = r.snapshots.find((s) => s.kind === 'transactions' && s.accountId === '35')
    expect(snap).toBeDefined()
    const stored = await rows<{ txn_id: string; source_line: number | string }>('select txn_id, source_line from returns.qbo_transactions where snapshot_id = $1 order by source_line', [snap?.id])
    expect(stored.map((s) => [s.txn_id, Number(s.source_line)])).toEqual([
      ['130', 1],
      ['131', 2],
      [twin.txnId, 3],
      [twin.txnId, 4],
    ])
    expect(await count('qbo_transactions')).toBe(r.transactions.length)
  })
})
