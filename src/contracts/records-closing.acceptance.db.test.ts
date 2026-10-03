// F01D acceptance tests, the database side (spec-writer; builders never edit this file).
// Card plan/cards/F01D.md: the closing repairs after F01C (reports/F01C-check.md failures 2 to 4).
// F01's and F01C's acceptance files stay as they are; these add to them.
//
// The shape these tests fix (the builder matches it):
// 1. A version table is a base table in schema returns with an integer column named version_no or
//    ending in _version (today facts, adjusting_entries, judgment_inputs, versions, gifi_mappings;
//    found by the catalog, so a later one is covered). On every version table:
//    - an UPDATE of any column, the primary key included, is refused with SQLSTATE 23514 or P0001
//      and a message saying "append-only", and the row stays as it was. The only columns that
//      still change in place are the two F01 check 19 names: facts.status (EV-8) and
//      adjusting_entries.explained (TB-2) (amber: "any column" read with F01 check 19's two
//      exceptions, so no F01 test is retired);
//    - DELETE and TRUNCATE are refused the same way, and the rows stay;
//    - all of this goes through one shared guard: one trigger function is attached to every
//      version table as a BEFORE ROW UPDATE trigger, a BEFORE ROW DELETE trigger and a BEFORE
//      STATEMENT TRUNCATE trigger (it may take the allowed columns as trigger arguments).
// 2. Every SQL `integer` column of an F01 table that records.ts mirrors with a number refuses
//    2147483648 and accepts 2147483647 in zod, as SQL does (the integer columns come from the
//    catalog, so a new one is covered).
// 3. SQL and zod agree on one shared hostile sample set for version stamps and source members, and
//    both refuse each sample (the card's choice: stamps are short text maps). See HOSTILE below.
import fc from 'fast-check'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from '../core/clock'
import { cloneTestDb as cloneBareDb } from '../core/db'
import {
  AdjustingEntryRecordSchema,
  AnswerRecordSchema,
  AccountRecordSchema,
  ApprovalRecordSchema,
  CheckResultRecordSchema,
  DifferenceRecordSchema,
  DocumentRecordSchema,
  EntryLineRecordSchema,
  EventRecordSchema,
  ExceptionRecordSchema,
  FactRecordSchema,
  FigureRecordSchema,
  GifiMappingRecordSchema,
  HoldRecordSchema,
  JudgmentInputRecordSchema,
  LessonRecordSchema,
  LinkRecordSchema,
  ReturnRecordSchema,
  StateEventRecordSchema,
  VersionCellRecordSchema,
  VersionRecordSchema,
  VersionStampSchema,
  sourcesAreReal,
} from './records'

// FX17 (SEC-1, SEC-7): an actor column takes a staff_users id or a listed system actor, so every clone this file
// makes first holds its made-up actors as staff users. Only the fixture changes; no assertion does.
const FX17_ACTORS: readonly string[] = ['Preparer (Test)']
async function cloneTestDb(): Promise<PGlite> {
  const db = await cloneBareDb()
  for (const id of FX17_ACTORS) {
    await db.query(`insert into returns.staff_users (id, display_name, roles) values ($1, $1, '{preparer}')`, [id])
  }
  return db
}

beforeAll(() => {
  setClock(fixedClock('2026-03-15T14:00:00-04:00'))
})
afterAll(() => {
  setClock(systemClock)
})

const STAMP = { reader: 'qbo-reader (Test)', reader_version: '0.0.1' }
const INT4_MAX = 2147483647

let n = 0
function tid(prefix = 'd'): string {
  n += 1
  return `${prefix}-${String(n).padStart(6, '0')}`
}

type Row = Record<string, unknown>

async function insert(db: PGlite, table: string, row: Row): Promise<void> {
  const cols = Object.keys(row)
  const vals = cols.map((c) => {
    const v = row[c]
    return v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v
  })
  const params = cols.map((_, i) => `$${String(i + 1)}`).join(', ')
  await db.query(`insert into returns.${table} (${cols.join(', ')}) values (${params})`, vals)
}

interface Refusal {
  code: string
  message: string
}
async function refusalOf(p: Promise<unknown>): Promise<Refusal | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    const err = e as { code?: string; message?: string }
    return { code: err.code ?? '', message: err.message ?? '' }
  }
}
async function expectAccepted(p: Promise<unknown>): Promise<void> {
  const r = await refusalOf(p)
  expect(r, `expected the database to accept this, got ${r?.code ?? ''} ${r?.message ?? ''}`).toBeUndefined()
}
/** The guard's refusal: 23514 or P0001, saying "append-only". Returns a problem or undefined. */
function guardProblem(label: string, r: Refusal | undefined): string | undefined {
  if (!r) return `${label}: accepted`
  if (!/^(23514|P0001)$/.test(r.code)) return `${label}: refused for the wrong reason ${r.code} ${r.message}`
  if (!/append-only/i.test(r.message)) return `${label}: the refusal does not say append-only: ${r.message}`
  return undefined
}

// ---------- a small typed world: two returns, a document, two accounts ----------

interface Base {
  returnId: string
  otherReturnId: string
  documentId: string
  accountId: string
  otherAccountId: string
}

async function base(db: PGlite): Promise<Base> {
  const returnId = tid('r')
  const otherReturnId = tid('r')
  for (const id of [returnId, otherReturnId]) {
    await insert(db, 'returns', { id, entity_name: 'Thistledown Kite Works Ltd. (Test)', year_end: '2025-12-31', state: 'intake' })
  }
  const documentId = tid('doc')
  await insert(db, 'documents', {
    id: documentId,
    return_id: returnId,
    fingerprint: 'sha256:' + 'c'.repeat(64),
    file_name: 'kite-fabric-invoice-77 (Test).pdf',
  })
  const accountId = tid('a')
  const otherAccountId = tid('a')
  for (const [id, q] of [[accountId, '41'], [otherAccountId, '42']] as const) {
    await insert(db, 'accounts', { id, return_id: returnId, qbo_snapshot_id: 'snap-0002', qbo_account_id: q, name: `Account ${q} (Test)` })
  }
  return { returnId, otherReturnId, documentId, accountId, otherAccountId }
}

// ---------- 1. every version table: no UPDATE of any column, no DELETE, no TRUNCATE ----------

type Versioned = 'facts' | 'adjusting_entries' | 'judgment_inputs' | 'versions' | 'gifi_mappings'
const VERSIONED: readonly Versioned[] = ['facts', 'adjusting_entries', 'judgment_inputs', 'versions', 'gifi_mappings']
/** F01 check 19: the only columns of a version table that still change in place. */
const CHANGES_IN_PLACE: Readonly<Record<string, readonly string[]>> = {
  facts: ['status'],
  adjusting_entries: ['explained'],
}

/** One fresh, valid version-1 row per version table. */
function versionRow(b: Base, t: Versioned): Row {
  const id = tid()
  switch (t) {
    case 'facts':
      return {
        id, return_id: b.returnId, fact_key: 'test.closing.' + id, value: '1250', origin: 'third_party',
        source_document_id: b.documentId, source_page: 2, source_box: { left: 0.1, top: 0.2, width: 0.3, height: 0.05 },
        method: 'read (Test)', status: 'proposed', version_stamp: STAMP, version_no: 1,
      }
    case 'adjusting_entries':
      return {
        id, return_id: b.returnId, qbo_snapshot_id: 'snap-0002', qbo_txn_id: 'JE-' + id, entry_type: 'accrual',
        reason: 'Year-end accrual of kite fabric (Test)', sources: ['Kite fabric invoice 77 (Test)'],
        author: 'Preparer (Test)', version_no: 1,
      }
    case 'judgment_inputs':
      return {
        id, return_id: b.returnId, cell_id: 'T2S8.' + id, value: '900', author: 'Preparer (Test)',
        reason: 'Half-year rule on the new sewing machine (Test)', version_no: 1,
      }
    case 'versions':
      return { id, return_id: b.returnId, version_no: 1 }
    case 'gifi_mappings':
      return { id, return_id: b.returnId, account_id: b.accountId, mapping_version: 1, gifi_code: '1001' }
  }
}

interface Column {
  name: string
  type: string
}
async function columnsOf(db: PGlite, t: string): Promise<Column[]> {
  const r = await db.query<{ name: string; type: string }>(
    `select column_name as name, data_type as type from information_schema.columns
     where table_schema = 'returns' and table_name = $1 order by ordinal_position`,
    [t],
  )
  return r.rows
}

/** A SET expression that gives the column a different value of its own type. */
function changedValue(c: Column): string | undefined {
  const q = `"${c.name}"`
  switch (c.type) {
    case 'text':
      return `coalesce(${q}, '') || ' (changed Test)'`
    case 'integer':
    case 'bigint':
    case 'smallint':
    case 'numeric':
      return `coalesce(${q}, 0) + 1`
    case 'boolean':
      return `not coalesce(${q}, false)`
    case 'jsonb':
      return `'{"changed":"(Test)"}'::jsonb`
    case 'timestamp with time zone':
      return `coalesce(${q}, now()) + interval '1 day'`
    case 'date':
      return `coalesce(${q}, current_date) + 1`
    default:
      return undefined
  }
}

async function snapshot(db: PGlite, t: string, id: unknown): Promise<string | undefined> {
  const r = await db.query<{ j: string }>(`select to_jsonb(x)::text as j from returns.${t} x where id = $1`, [id])
  return r.rows[0]?.j
}

/** Every column outside CHANGES_IN_PLACE: an UPDATE is refused by the guard and the row stays. */
async function updateProblems(db: PGlite, t: string, row: Row): Promise<string[]> {
  const problems: string[] = []
  const before = await snapshot(db, t, row['id'])
  if (before === undefined) return [`${t}: the fixture row is missing`]
  const allowed = CHANGES_IN_PLACE[t] ?? []
  for (const c of await columnsOf(db, t)) {
    if (allowed.includes(c.name)) continue
    const expr = changedValue(c)
    if (expr === undefined) {
      problems.push(`${t}.${c.name}: no test value for type ${c.type} (the spec-writer adds one)`)
      continue
    }
    const r = await refusalOf(db.query(`update returns.${t} set "${c.name}" = ${expr} where id = $1`, [row['id']]))
    const p = guardProblem(`${t}.${c.name}`, r)
    if (p) problems.push(p)
    if ((await snapshot(db, t, row['id'])) !== before) problems.push(`${t}.${c.name}: the row changed`)
  }
  return problems
}

/** The catalog: version tables, and for each the trigger functions refusing update, delete, truncate. */
async function versionTables(db: PGlite): Promise<string[]> {
  const r = await db.query<{ t: string }>(
    `select distinct c.table_name as t from information_schema.columns c
     join information_schema.tables tb
       on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'returns' and c.data_type in ('integer', 'bigint', 'smallint')
       and (c.column_name = 'version_no' or c.column_name like '%\\_version')
     order by 1`,
  )
  return r.rows.map((x) => x.t)
}

interface SharedGuard {
  tables: string[]
  /** functions attached to every version table for row UPDATE, row DELETE and statement TRUNCATE */
  shared: string[]
  /** version tables where no single function covers all three */
  uncovered: string[]
}
async function sharedGuard(db: PGlite): Promise<SharedGuard> {
  const tables = await versionTables(db)
  const trig = await db.query<{ t: string; fn: string; tgtype: number }>(
    `select cl.relname as t, pn.nspname || '.' || p.proname as fn, tg.tgtype::int as tgtype
     from pg_trigger tg
     join pg_class cl on cl.oid = tg.tgrelid
     join pg_namespace ns on ns.oid = cl.relnamespace
     join pg_proc p on p.oid = tg.tgfoid
     join pg_namespace pn on pn.oid = p.pronamespace
     where ns.nspname = 'returns' and not tg.tgisinternal`,
  )
  // tgtype bits: 1 row, 2 before, 8 delete, 16 update, 32 truncate
  const covers = (t: string): Set<string> => {
    const rows = trig.rows.filter((x) => x.t === t && (x.tgtype & 2) === 2)
    const upd = new Set(rows.filter((x) => (x.tgtype & 1) === 1 && (x.tgtype & 16) === 16).map((x) => x.fn))
    const del = new Set(rows.filter((x) => (x.tgtype & 1) === 1 && (x.tgtype & 8) === 8).map((x) => x.fn))
    const tru = new Set(rows.filter((x) => (x.tgtype & 1) === 0 && (x.tgtype & 32) === 32).map((x) => x.fn))
    return new Set([...upd].filter((f) => del.has(f) && tru.has(f)))
  }
  const perTable = tables.map((t) => [t, covers(t)] as const)
  const uncovered = perTable.filter(([, s]) => s.size === 0).map(([t]) => t)
  let shared: string[] | undefined
  for (const [, s] of perTable) shared = shared === undefined ? [...s] : shared.filter((f) => s.has(f))
  return { tables, shared: (shared ?? []).sort(), uncovered }
}

describe('FLOW-4 EV-1 SEC-7 TB-3 every version table refuses UPDATE of any column, DELETE and TRUNCATE through one shared guard', () => {
  test('FLOW-4 EV-1 SEC-7 one trigger function guards UPDATE, DELETE and TRUNCATE on every version table (catalog)', async () => {
    const db = await cloneTestDb()
    const g = await sharedGuard(db)
    expect(g.tables).toEqual(expect.arrayContaining([...VERSIONED]))
    expect(g.uncovered, 'version tables with no one function for update, delete and truncate').toEqual([])
    expect(g.shared.length, `one function shared by ${g.tables.join(', ')}`).toBeGreaterThanOrEqual(1)
  })

  test('FLOW-4 EV-1 planted: a later version table with its own guard function is caught by the catalog rule', async () => {
    const db = await cloneTestDb()
    const before = await sharedGuard(db)
    await db.exec(`
      create function returns.planted_own_guard_test() returns trigger language plpgsql as $$
      begin raise exception 'append-only: planted (Test)'; end $$;
      create table returns.planted_versions_test (id text primary key, thing_key text not null, version_no integer not null);
      create trigger planted_versions_test_u before update or delete on returns.planted_versions_test
        for each row execute function returns.planted_own_guard_test();
      create trigger planted_versions_test_t before truncate on returns.planted_versions_test
        for each statement execute function returns.planted_own_guard_test();
    `)
    const after = await sharedGuard(db)
    expect(after.tables).toContain('planted_versions_test')
    // the planted table is guarded, but not by the shared function: no function is shared by all any more
    for (const f of before.shared) expect(after.shared).not.toContain(f)
  })

  test('FLOW-4 EV-1 planted: a later version table with no truncate guard is caught by the catalog rule', async () => {
    const db = await cloneTestDb()
    await db.exec(`
      create table returns.planted_versions_test (id text primary key, thing_key text not null, version_no integer not null);
      create trigger planted_versions_test_u before update or delete on returns.planted_versions_test
        for each row execute function returns.refuse_change();
    `)
    const g = await sharedGuard(db)
    expect(g.uncovered).toContain('planted_versions_test')
  })

  for (const t of VERSIONED) {
    test(`FLOW-4 EV-1 ${t} refuses an UPDATE of every column (primary key included) outside F01 check 19's in-place columns, and the row stays`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const row = versionRow(b, t)
      await expectAccepted(insert(db, t, row))
      expect(await updateProblems(db, t, row)).toEqual([])
    })

    test(`FLOW-4 EV-1 SEC-7 ${t} refuses DELETE and the row stays`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const row = versionRow(b, t)
      await expectAccepted(insert(db, t, row))
      const r = await refusalOf(db.query(`delete from returns.${t} where id = $1`, [row['id']]))
      expect(guardProblem(`delete ${t}`, r)).toBeUndefined()
      expect(await snapshot(db, t, row['id'])).toBeDefined()
    })

    test(`FLOW-4 EV-1 SEC-7 ${t} refuses TRUNCATE and the row stays`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const row = versionRow(b, t)
      await expectAccepted(insert(db, t, row))
      const r = await refusalOf(db.query(`truncate returns.${t} cascade`))
      expect(guardProblem(`truncate ${t}`, r)).toBeUndefined()
      expect(await snapshot(db, t, row['id'])).toBeDefined()
    })
  }

  test("TB-3 planted: delete gifi_mappings v1, then insert v1 with another code, is refused and the mapping keeps code 1001", async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const row = versionRow(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    const del = await refusalOf(db.query('delete from returns.gifi_mappings where id = $1', [row['id']]))
    expect(guardProblem('delete gifi_mappings v1', del)).toBeUndefined()
    // the rewrite attempt: v1 again with another code, under a new id
    await refusalOf(insert(db, 'gifi_mappings', { ...row, id: tid(), gifi_code: '8000' }))
    const now = await db.query<{ code: string }>(
      'select gifi_code as code from returns.gifi_mappings where account_id = $1 and mapping_version = 1',
      [b.accountId],
    )
    expect(now.rows.map((x) => x.code)).toEqual(['1001'])
  })

  test("TB-3 planted: update returns.gifi_mappings set id = 'g9' is refused and the id stays", async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const row = versionRow(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    const r = await refusalOf(db.query("update returns.gifi_mappings set id = 'g9'"))
    expect(guardProblem("update gifi_mappings set id = 'g9'", r)).toBeUndefined()
    const ids = await db.query<{ id: string }>('select id from returns.gifi_mappings')
    expect(ids.rows.map((x) => x.id)).toEqual([row['id']])
  })

  test('TB-3 planted: a TRUNCATE of gifi_mappings is refused and the mapping stays', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const row = versionRow(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    const r = await refusalOf(db.query('truncate returns.gifi_mappings'))
    expect(guardProblem('truncate gifi_mappings', r)).toBeUndefined()
    expect(await snapshot(db, 'gifi_mappings', row['id'])).toBeDefined()
  })

  test('EV-8 FLOW-4 control: the status of a fact still changes in place', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const row = versionRow(b, 'facts')
    await insert(db, 'facts', row)
    await expectAccepted(db.query("update returns.facts set status = 'preparer_verified' where id = $1", [row['id']]))
  })

  test('TB-2 FLOW-4 control: an adjusting entry whose lines net to zero can still be marked explained in place', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const row = versionRow(b, 'adjusting_entries')
    await insert(db, 'adjusting_entries', row)
    await insert(db, 'entry_lines', { id: tid('l'), entry_id: row['id'], qbo_account_id: '41', amount_cents: 12500 })
    await insert(db, 'entry_lines', { id: tid('l'), entry_id: row['id'], qbo_account_id: '42', amount_cents: -12500 })
    await expectAccepted(db.query('update returns.adjusting_entries set explained = true where id = $1', [row['id']]))
  })

  test('TB-3 control: a new GIFI code for an account is a new mapping version (version 2 inserts)', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const row = versionRow(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    await expectAccepted(insert(db, 'gifi_mappings', { ...row, id: tid(), mapping_version: 2, gifi_code: '8000' }))
  })
})

// ---------- 2. every zod mirror of an SQL integer column carries the int4 bounds ----------

interface FieldSchema {
  safeParse: (x: unknown) => { success: boolean }
}
interface ObjectSchema {
  shape: Record<string, unknown>
}
/** records.ts's mirror of each F01 table. */
const MIRRORS: Readonly<Record<string, ObjectSchema>> = {
  returns: ReturnRecordSchema,
  documents: DocumentRecordSchema,
  versions: VersionRecordSchema,
  version_cells: VersionCellRecordSchema,
  approvals: ApprovalRecordSchema,
  events: EventRecordSchema,
  facts: FactRecordSchema,
  links: LinkRecordSchema,
  accounts: AccountRecordSchema,
  gifi_mappings: GifiMappingRecordSchema,
  adjusting_entries: AdjustingEntryRecordSchema,
  entry_lines: EntryLineRecordSchema,
  judgment_inputs: JudgmentInputRecordSchema,
  figures: FigureRecordSchema,
  state_events: StateEventRecordSchema,
  holds: HoldRecordSchema,
  check_results: CheckResultRecordSchema,
  exceptions: ExceptionRecordSchema,
  answers: AnswerRecordSchema,
  differences: DifferenceRecordSchema,
  lessons: LessonRecordSchema,
}

/** The int4 rule for one zod field: refuses 2147483648, accepts 2147483647. */
function int4Problems(label: string, f: FieldSchema | undefined): string[] {
  if (!f) return [`${label}: records.ts has no field for this integer column`]
  const p: string[] = []
  if (f.safeParse(INT4_MAX + 1).success) p.push(`${label}: accepts 2147483648, which SQL integer refuses`)
  if (!f.safeParse(INT4_MAX).success) p.push(`${label}: refuses 2147483647, which SQL integer accepts`)
  return p
}

async function integerColumns(db: PGlite): Promise<string[]> {
  const r = await db.query<{ k: string }>(
    `select c.table_name || '.' || c.column_name as k from information_schema.columns c
     join information_schema.tables tb
       on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'returns' and c.data_type = 'integer' and c.table_name = any($1::text[])
     order by 1`,
    [Object.keys(MIRRORS)],
  )
  return r.rows.map((x) => x.k)
}

describe('FLOW-4 EV-5 EV-14 every zod mirror of an SQL integer column refuses 2147483648 and accepts 2147483647', () => {
  test('FLOW-4 EV-5 the catalog finds at least the F01 integer columns (version_no, mapping_version, source_page, source_row)', async () => {
    const db = await cloneTestDb()
    expect(await integerColumns(db)).toEqual(
      expect.arrayContaining([
        'adjusting_entries.version_no',
        'facts.source_page',
        'facts.source_row',
        'facts.version_no',
        'gifi_mappings.mapping_version',
        'judgment_inputs.version_no',
        'versions.version_no',
      ]),
    )
  })

  test('FLOW-4 EV-5 EV-14 each integer column of an F01 table found by the catalog has a zod mirror bounded at 2147483647', async () => {
    const db = await cloneTestDb()
    const problems: string[] = []
    for (const k of await integerColumns(db)) {
      const [t = '', c = ''] = k.split('.')
      problems.push(...int4Problems(k, MIRRORS[t]?.shape[c] as FieldSchema | undefined))
    }
    expect(problems).toEqual([])
  })

  test('FLOW-4 planted: the int4 rule catches a mirror with no upper bound (z.number().int().min(1))', async () => {
    const { z } = await import('zod')
    expect(int4Problems('planted (Test)', z.number().int().min(1))).toEqual([
      'planted (Test): accepts 2147483648, which SQL integer refuses',
    ])
    expect(int4Problems('bounded (Test)', z.number().int().min(1).max(INT4_MAX))).toEqual([])
  })

  for (const c of ['source_page', 'source_row'] as const) {
    test(`EV-5 EV-14 SQL and zod agree on facts.${c}: 2147483648 refused by both, 2147483647 accepted by both`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const pointer = (v: number): Row =>
        c === 'source_page'
          ? { source_page: v, source_box: { left: 0.1, top: 0.2, width: 0.3, height: 0.05 } }
          : { source_sheet: 'Sheet1 (Test)', source_row: v, source_column: 'C' }
      const fact = (v: number): Row => {
        const id = tid()
        return {
          id, return_id: b.returnId, fact_key: 'test.int4.' + id, value: '1', origin: 'third_party',
          source_document_id: b.documentId, ...pointer(v), status: 'proposed', version_stamp: STAMP,
        }
      }
      const big = await refusalOf(insert(db, 'facts', fact(INT4_MAX + 1)))
      expect(big?.code, 'SQL refuses 2147483648 as out of range').toBe('22003')
      expect((FactRecordSchema.shape[c] as FieldSchema).safeParse(INT4_MAX + 1).success).toBe(false)
      await expectAccepted(insert(db, 'facts', fact(INT4_MAX)))
      expect((FactRecordSchema.shape[c] as FieldSchema).safeParse(INT4_MAX).success).toBe(true)
    })
  }
})

// ---------- 3. SQL and zod agree on one hostile sample set, and both refuse ----------

/**
 * The shared hostile sample set, as JSON text (the database receives the text; zod receives
 * JSON.parse of it, which is how a stamp or a source reaches records.ts). JSON.parse makes
 * "__proto__" an own key and turns 1e400 into Infinity. The card's choice: refuse all (stamps are
 * short text maps; -1e400 is the same class as 1e400, added by this spec).
 */
const HOSTILE: readonly string[] = [
  '{"__proto__":"v1"}',
  '{"__proto__":"v1","b":"v"}',
  '{"a":1e400}',
  '{"a":-1e400}',
]

async function sqlBool(db: PGlite, fn: 'is_version_stamp' | 'sources_are_real', json: string): Promise<boolean | undefined> {
  const r = await db.query<{ ok: boolean | null }>(`select returns.${fn}($1::jsonb) as ok`, [json])
  return r.rows[0]?.ok ?? undefined
}

const STAMPED = ['facts', 'figures', 'check_results'] as const
type Stamped = (typeof STAMPED)[number]
const STAMP_ZOD: Record<Stamped, FieldSchema> = {
  facts: FactRecordSchema.shape.version_stamp,
  figures: FigureRecordSchema.shape.version_stamp,
  check_results: CheckResultRecordSchema.shape.version_stamp,
}
function stampedRow(b: Base, t: Stamped): Row {
  const id = tid()
  switch (t) {
    case 'facts':
      return {
        id, return_id: b.returnId, fact_key: 'test.hostile.' + id, value: '1', origin: 'judgment',
        source_reason: 'Owner said so on the call (Test)', status: 'proposed',
      }
    case 'figures':
      return { id, return_id: b.returnId, figure_key: 'key-' + id, cell_id: 'T2S100.1001', value: '1' }
    case 'check_results':
      return { id, return_id: b.returnId, check_id: 'CK-' + id, outcome: 'pass' }
  }
}
async function insertStamped(db: PGlite, t: Stamped, row: Row, stampJson: string): Promise<void> {
  const cols = Object.keys(row)
  const params = cols.map((_, i) => `$${String(i + 1)}`)
  await db.query(
    `insert into returns.${t} (${cols.join(', ')}, version_stamp) values (${params.join(', ')}, $${String(cols.length + 1)}::jsonb)`,
    [...cols.map((c) => row[c]), stampJson],
  )
}

describe('ARC-10 TB-2 SQL and zod agree on the hostile sample set for stamps and sources, and both refuse it', () => {
  for (const h of HOSTILE) {
    test(`ARC-10 is_version_stamp and VersionStampSchema both refuse ${h}`, async () => {
      const db = await cloneTestDb()
      expect(await sqlBool(db, 'is_version_stamp', h), 'SQL is_version_stamp').toBe(false)
      expect(VersionStampSchema.safeParse(JSON.parse(h)).success, 'zod VersionStampSchema').toBe(false)
    })

    for (const t of STAMPED) {
      test(`ARC-10 ${t} refuses the version stamp ${h}, and so does records.ts`, async () => {
        const db = await cloneTestDb()
        const b = await base(db)
        const r = await refusalOf(insertStamped(db, t, stampedRow(b, t), h))
        expect(r?.code, `${t} refuses ${h}`).toBe('23514')
        expect(STAMP_ZOD[t].safeParse(JSON.parse(h)).success, `records.ts ${t}.version_stamp`).toBe(false)
      })
    }

    test(`TB-2 sources_are_real and sourcesAreReal both refuse a source member ${h}`, async () => {
      const db = await cloneTestDb()
      for (const sources of [`[${h}]`, `["Kite fabric invoice 77 (Test)", ${h}]`]) {
        expect(await sqlBool(db, 'sources_are_real', sources), `SQL sources_are_real ${sources}`).toBe(false)
        expect(sourcesAreReal(JSON.parse(sources) as unknown[]), `zod sourcesAreReal ${sources}`).toBe(false)
      }
    })

    test(`TB-2 an adjusting entry with the source member ${h} cannot be marked explained, in SQL and in records.ts`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const row = versionRow(b, 'adjusting_entries')
      const rest = Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'sources'))
      const cols = Object.keys(rest)
      const params = cols.map((_, i) => `$${String(i + 1)}`)
      await db.query(
        `insert into returns.adjusting_entries (${cols.join(', ')}, sources) values (${params.join(', ')}, $${String(cols.length + 1)}::jsonb)`,
        [...cols.map((c) => rest[c]), `[${h}]`],
      )
      await insert(db, 'entry_lines', { id: tid('l'), entry_id: row['id'], qbo_account_id: '41', amount_cents: 500 })
      await insert(db, 'entry_lines', { id: tid('l'), entry_id: row['id'], qbo_account_id: '42', amount_cents: -500 })
      const r = await refusalOf(db.query('update returns.adjusting_entries set explained = true where id = $1', [row['id']]))
      expect(r?.code, 'SQL refuses explained').toBe('23514')
      const record = {
        ...row, sources: JSON.parse(`[${h}]`) as unknown, explained: true,
        created_at: new Date('2026-03-15T18:00:00Z'), is_test: true,
      }
      expect(AdjustingEntryRecordSchema.safeParse(record).success, 'records.ts refuses explained').toBe(false)
    })
  }

  test('ARC-10 control: a stamp with keys like constructor and toString is accepted by SQL and zod alike, every key kept', async () => {
    const db = await cloneTestDb()
    const h = '{"reader":"qbo-reader (Test)","constructor":"v1","toString":"v2","rule_version":3}'
    expect(await sqlBool(db, 'is_version_stamp', h)).toBe(true)
    const parsed = VersionStampSchema.safeParse(JSON.parse(h))
    expect(parsed.success).toBe(true)
    expect(Object.keys(parsed.data ?? {}).sort()).toEqual(['constructor', 'reader', 'rule_version', 'toString'])
  })

  test('ARC-10 property: SQL is_version_stamp and zod VersionStampSchema agree on stamps over normal, prototype and huge-number samples', async () => {
    const db = await cloneTestDb()
    const key = fc.constantFrom('reader', 'rule_version', 'constructor', 'toString', '__proto__')
    const value = fc.constantFrom('"v1"', '3', '1e400', '-1e400', '"qbo-reader (Test)"')
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(fc.tuple(key, value), { minLength: 1, maxLength: 3, selector: ([k]) => k }), async (pairs) => {
        const json = `{${pairs.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(',')}}`
        const sql = await sqlBool(db, 'is_version_stamp', json)
        const zod = VersionStampSchema.safeParse(JSON.parse(json)).success
        expect({ json, sql }).toEqual({ json, sql: zod })
      }),
      { seed: 20261002, numRuns: 60 },
    )
  })
})
