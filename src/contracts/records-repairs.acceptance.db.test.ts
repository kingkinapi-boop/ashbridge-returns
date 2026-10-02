// F01C acceptance tests, the database side (spec-writer; builders never edit this file).
// Card plan/cards/F01C.md: the last narrow repairs after F01 round 3 (reports/F01-check.md round 3,
// failures 1 and 2, risks 3 and 4). F01's own acceptance file stays as it is; these add to it.
//
// The shape these tests fix (the builder matches it):
// 1. Every table with a version column (an integer column named version_no or ending in _version:
//    facts, adjusting_entries, judgment_inputs, versions, gifi_mappings, and any later one) has a
//    BEFORE UPDATE row trigger, and refuses an UPDATE of its version column and of its key columns
//    (facts: return_id, fact_key; adjusting_entries: return_id, qbo_snapshot_id, qbo_txn_id;
//    judgment_inputs: return_id, cell_id; versions: return_id; gifi_mappings: account_id) with
//    SQLSTATE 23514 or P0001 and a message or constraint naming the column or saying "append-only";
//    the row stays as it was. gifi_mappings.gifi_code is refused too (amber: a new code is a new
//    mapping version, TB-3; reports/F01-check.md round 3 failure 1 names it).
// 2. JSON keys are non-blank like values (returns.is_blank, one definition): a version stamp
//    with a blank key and an adjusting-entry source member with a blank key are refused by SQL
//    (is_version_stamp, sources_are_real) and by zod (VersionStampSchema, and an explained
//    AdjustingEntryRecordSchema), over the F01 blank sample set.
// 3. zod mirrors sources_are_real: an AdjustingEntryRecordSchema record with explained true parses
//    exactly when returns.sources_are_real(sources) is true (an unexplained entry may hold any array,
//    as the table allows). The number mirrors are in records-repairs.acceptance.test.ts.
// 4. The catalog loops of 90_learning.sql (non-blank checks, return_id foreign keys) reach F01's
//    own tables only: a table made by a later schema file that sorts before 90 gets neither. No
//    F01 schema file keeps its own copy of the value allow-list ('table.column' literals); the list
//    lives in src/contracts/text.ts VALUE_COLUMNS.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from '../core/clock'
import { DEFAULT_SCHEMA_DIR, cloneTestDb, createTemplate, type DbTemplate } from '../core/db'
import {
  AdjustingEntryRecordSchema,
  CheckResultRecordSchema,
  FactRecordSchema,
  FigureRecordSchema,
  VersionStampSchema,
} from './records'
import { isBlank } from './text'

beforeAll(() => {
  setClock(fixedClock('2026-03-15T14:00:00-04:00'))
})
afterAll(() => {
  setClock(systemClock)
})

// The F01 blank sample set (findings F01 r2, S2): empty, space, tab, newline, NBSP, U+200B,
// U+3000, U+2800.
const BLANKS = ['', ' ', '\t', '\n', ' ', '​', '　', '⠀'] as const
const show = (s: string): string =>
  JSON.stringify(s).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)

const STAMP = { reader: 'qbo-reader (Test)', reader_version: '0.0.1' }

let n = 0
function tid(prefix = 'c'): string {
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
  constraint: string
}
async function refusalOf(p: Promise<unknown>): Promise<Refusal | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    const err = e as { code?: string; message?: string; constraint?: string }
    return { code: err.code ?? '', message: err.message ?? '', constraint: err.constraint ?? '' }
  }
}
async function expectAccepted(p: Promise<unknown>): Promise<void> {
  const r = await refusalOf(p)
  expect(r, `expected the database to accept this, got ${r?.code ?? ''} ${r?.message ?? ''}`).toBeUndefined()
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
    await insert(db, 'returns', { id, entity_name: 'Quillfeather Sample Widgets Inc. (Test)', year_end: '2025-12-31', state: 'intake' })
  }
  const documentId = tid('d')
  await insert(db, 'documents', {
    id: documentId,
    return_id: returnId,
    fingerprint: 'sha256:' + 'b'.repeat(64),
    file_name: 'rent-invoice-1042 (Test).pdf',
  })
  const accountId = tid('a')
  const otherAccountId = tid('a')
  for (const [id, q] of [[accountId, '35'], [otherAccountId, '36']] as const) {
    await insert(db, 'accounts', { id, return_id: returnId, qbo_snapshot_id: 'snap-0001', qbo_account_id: q, name: `Account ${q} (Test)` })
  }
  return { returnId, otherReturnId, documentId, accountId, otherAccountId }
}

// ---------- 1. every version table refuses an update of its version and key columns ----------

type Versioned = 'facts' | 'adjusting_entries' | 'judgment_inputs' | 'versions' | 'gifi_mappings'
const VERSIONED: readonly Versioned[] = ['facts', 'adjusting_entries', 'judgment_inputs', 'versions', 'gifi_mappings']

// One fresh version-1 row per table, and for each guarded column a different, valid value (an
// existing return or account, so a foreign key can never be the reason for a refusal).
function guarded(b: Base, t: Versioned): { row: Row; changes: Record<string, unknown> } {
  const id = tid()
  switch (t) {
    case 'facts':
      return {
        row: {
          id, return_id: b.returnId, fact_key: 'test.guard.' + id, value: '1', origin: 'judgment',
          source_reason: 'Owner said so on the call (Test)', status: 'proposed', version_stamp: STAMP, version_no: 1,
        },
        changes: { version_no: 999, return_id: b.otherReturnId, fact_key: 'test.guard.other.' + id },
      }
    case 'adjusting_entries':
      return {
        row: {
          id, return_id: b.returnId, qbo_snapshot_id: 'snap-0001', qbo_txn_id: 'JE-' + id, entry_type: 'accrual',
          reason: 'Year-end accrual of December rent (Test)', sources: ['Rent invoice 1042 (Test)'],
          author: 'Preparer (Test)', version_no: 1,
        },
        changes: { version_no: 999, return_id: b.otherReturnId, qbo_snapshot_id: 'snap-9999', qbo_txn_id: 'JE-other-' + id },
      }
    case 'judgment_inputs':
      return {
        row: {
          id, return_id: b.returnId, cell_id: 'T2S8.' + id, value: '4200', author: 'Preparer (Test)',
          reason: 'Half-year rule on the new van (Test)', version_no: 1,
        },
        changes: { version_no: 999, return_id: b.otherReturnId, cell_id: 'T2S8.other.' + id },
      }
    case 'versions':
      return {
        row: { id, return_id: b.returnId, version_no: 1 },
        changes: { version_no: 999, return_id: b.otherReturnId },
      }
    case 'gifi_mappings':
      return {
        row: { id, return_id: b.returnId, account_id: b.accountId, mapping_version: 1, gifi_code: '1001' },
        changes: { mapping_version: 999, account_id: b.otherAccountId, gifi_code: '8000' },
      }
  }
}

// The rule: each change is refused (23514 or P0001, naming the column or "append-only") and the
// row is left as it was. Returns the problems found.
async function updateGuardProblems(db: PGlite, t: string, row: Row, changes: Record<string, unknown>): Promise<string[]> {
  const problems: string[] = []
  for (const [c, v] of Object.entries(changes)) {
    const r = await refusalOf(db.query(`update returns.${t} set ${c} = $1 where id = $2`, [v, row['id']]))
    if (!r) problems.push(`${t}.${c} = ${String(v)}: accepted`)
    else if (!/^(23514|P0001)$/.test(r.code)) problems.push(`${t}.${c} = ${String(v)}: refused for the wrong reason ${r.code} ${r.message}`)
    else if (!new RegExp(`append-only|\\b${c}\\b`, 'i').test(`${r.constraint} ${r.message}`)) {
      problems.push(`${t}.${c}: the refusal does not name the column: ${r.message}`)
    }
    const now = await db.query<{ v: unknown }>(`select ${c}::text as v from returns.${t} where id = $1`, [row['id']])
    if (String(now.rows[0]?.v) !== String(row[c])) problems.push(`${t}.${c}: the row changed to ${String(now.rows[0]?.v)}`)
  }
  return problems
}

// The catalog rule: every table in schema returns with a version column has a BEFORE UPDATE row
// trigger. Returns the tables that have none.
async function versionTablesWithoutUpdateGuard(db: PGlite): Promise<{ versionTables: string[]; unguarded: string[] }> {
  const vt = await db.query<{ t: string }>(
    `select distinct c.table_name as t from information_schema.columns c
     join information_schema.tables tb
       on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'returns' and c.data_type in ('integer', 'bigint', 'smallint')
       and (c.column_name = 'version_no' or c.column_name like '%\\_version')
     order by 1`,
  )
  const guardedT = await db.query<{ t: string }>(
    `select distinct cl.relname as t from pg_trigger tg
     join pg_class cl on cl.oid = tg.tgrelid
     join pg_namespace ns on ns.oid = cl.relnamespace
     where ns.nspname = 'returns' and not tg.tgisinternal
       and (tg.tgtype & 1) = 1 and (tg.tgtype & 2) = 2 and (tg.tgtype & 16) = 16`,
  )
  const versionTables = vt.rows.map((r) => r.t)
  const have = new Set(guardedT.rows.map((r) => r.t))
  return { versionTables, unguarded: versionTables.filter((t) => !have.has(t)) }
}

describe('FLOW-4 EV-1 TB-3 every version table refuses an update of its version and key columns', () => {
  test('FLOW-4 EV-1 TB-3 every table with a version column has a BEFORE UPDATE row trigger (catalog, so a later version table is covered)', async () => {
    const db = await cloneTestDb()
    const { versionTables, unguarded } = await versionTablesWithoutUpdateGuard(db)
    expect(versionTables).toEqual(expect.arrayContaining([...VERSIONED]))
    expect(unguarded).toEqual([])
  })

  test('FLOW-4 EV-1 the catalog rule catches a planted later version table with an insert guard and no update guard', async () => {
    const db = await cloneTestDb()
    await db.exec(`
      create table returns.planted_versions_test (
        id text primary key, thing_key text not null, version_no integer not null
      );
      create trigger planted_versions_test_next_version before insert on returns.planted_versions_test
        for each row execute function returns.next_version_guard('version_no', 'thing_key');
    `)
    const { versionTables, unguarded } = await versionTablesWithoutUpdateGuard(db)
    expect(versionTables).toContain('planted_versions_test')
    expect(unguarded).toContain('planted_versions_test')
    // and the behaviour rule reports it too
    await insert(db, 'planted_versions_test', { id: 'pv-1', thing_key: 'k (Test)', version_no: 1 })
    const problems = await updateGuardProblems(db, 'planted_versions_test', { id: 'pv-1', thing_key: 'k (Test)', version_no: 1 }, { version_no: 999 })
    expect(problems.join('\n')).toMatch(/accepted/)
  })

  test('TB-3 FLOW-4 planted: update returns.gifi_mappings set mapping_version = 999 is refused and the mapping stays at 1', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const { row } = guarded(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    const r = await refusalOf(db.query('update returns.gifi_mappings set mapping_version = 999'))
    expect(r, 'the update is refused').toBeDefined()
    expect(r?.code).toMatch(/^(23514|P0001)$/)
    const now = await db.query<{ v: number }>('select mapping_version as v from returns.gifi_mappings where id = $1', [row['id']])
    expect(now.rows[0]?.v).toBe(1)
  })

  test('TB-3 FLOW-4 a GIFI mapping cannot be bumped in place to the next version either (set mapping_version = 2)', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const { row } = guarded(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    expect(await updateGuardProblems(db, 'gifi_mappings', row, { mapping_version: 2 })).toEqual([])
  })

  for (const t of VERSIONED) {
    test(`FLOW-4 EV-1 ${t} refuses an UPDATE of its version column and each key column, and the row stays`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const { row, changes } = guarded(b, t)
      await expectAccepted(insert(db, t, row))
      expect(await updateGuardProblems(db, t, row, changes)).toEqual([])
    })
  }

  test('EV-8 FLOW-4 the status of a fact still changes in place (control for the guards above)', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const { row } = guarded(b, 'facts')
    await insert(db, 'facts', row)
    await expectAccepted(db.query("update returns.facts set status = 'preparer_verified' where id = $1", [row['id']]))
  })

  test('TB-3 a new GIFI code for an account is a new mapping version (control: version 2 inserts)', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const { row } = guarded(b, 'gifi_mappings')
    await insert(db, 'gifi_mappings', row)
    await expectAccepted(insert(db, 'gifi_mappings', { ...row, id: tid(), mapping_version: 2, gifi_code: '8000' }))
  })
})

// ---------- 2. JSON keys are non-blank like values, in SQL and zod ----------

const STAMPED = ['facts', 'figures', 'check_results'] as const
type Stamped = (typeof STAMPED)[number]
const STAMP_ZOD = {
  facts: FactRecordSchema.shape.version_stamp,
  figures: FigureRecordSchema.shape.version_stamp,
  check_results: CheckResultRecordSchema.shape.version_stamp,
}
function stampedRow(b: Base, t: Stamped, stamp: unknown): Row {
  const id = tid()
  switch (t) {
    case 'facts':
      return {
        id, return_id: b.returnId, fact_key: 'test.stamp.' + id, value: '1', origin: 'judgment',
        source_reason: 'Owner said so on the call (Test)', status: 'proposed', version_stamp: stamp,
      }
    case 'figures':
      return { id, return_id: b.returnId, figure_key: 'key-' + id, cell_id: 'T2S100.1001', value: '1', version_stamp: stamp }
    case 'check_results':
      return { id, return_id: b.returnId, check_id: 'CK-' + id, outcome: 'pass', version_stamp: stamp }
  }
}

async function sqlBool(db: PGlite, fn: 'is_version_stamp' | 'sources_are_real', v: unknown): Promise<boolean | undefined> {
  const r = await db.query<{ ok: boolean | null }>(`select returns.${fn}($1::jsonb) as ok`, [JSON.stringify(v)])
  return r.rows[0]?.ok ?? undefined
}

describe('ARC-10 a version stamp key is never blank, in SQL and zod alike', () => {
  for (const t of STAMPED) {
    test(`ARC-10 ${t} refuses a stamp with a blank key over the blank sample set ({" ":"v1"} and a good key beside a blank one), and so does records.ts`, async () => {
      const db = await cloneTestDb()
      const b = await base(db)
      const problems: string[] = []
      for (const k of BLANKS) {
        for (const stamp of [{ [k]: 'v1' }, { reader: 'qbo-reader (Test)', [k]: 'v1' }, { [k]: 3 }]) {
          const label = `blank key ${show(k)} among ${String(Object.keys(stamp).length)} key(s)`
          const r = await refusalOf(insert(db, t, stampedRow(b, t, stamp)))
          if (!r) problems.push(`${t} ${label}: accepted`)
          else if (r.code !== '23514') problems.push(`${t} ${label}: ${r.code} ${r.message}`)
          if (STAMP_ZOD[t].safeParse(stamp).success) problems.push(`records.ts ${t}.version_stamp ${label}: accepted`)
          if (VersionStampSchema.safeParse(stamp).success) problems.push(`VersionStampSchema ${label}: accepted`)
        }
      }
      expect(problems).toEqual([])
    })
  }

  test('ARC-10 planted: the stamp {" ":"v1"} is not a version stamp (returns.is_version_stamp and VersionStampSchema)', async () => {
    const db = await cloneTestDb()
    expect(await sqlBool(db, 'is_version_stamp', { ' ': 'v1' })).toBe(false)
    expect(VersionStampSchema.safeParse({ ' ': 'v1' }).success).toBe(false)
  })

  test('ARC-10 a stamp whose keys and values are non-blank is accepted by every stamped table and records.ts (control)', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    for (const t of STAMPED) {
      const stamp = { reader: 'qbo-reader (Test)', rule_version: 3, ' padded key ': 'v1' }
      await expectAccepted(insert(db, t, stampedRow(b, t, stamp)))
      expect(STAMP_ZOD[t].safeParse(stamp).success).toBe(true)
    }
  })

  test('ARC-10 property: is_version_stamp and VersionStampSchema accept exactly the same stamps, blank keys included', async () => {
    const db = await cloneTestDb()
    const key = fc.oneof(fc.constantFrom(...BLANKS), fc.constantFrom('reader', 'rule_version', 'x', ' a '))
    const value = fc.oneof(
      fc.constantFrom<unknown>(...BLANKS, 'v1', 'qbo-reader (Test)', null, true, {}, []),
      fc.integer({ min: -5, max: 99 }),
    )
    const stampArb = fc.dictionary(key, value, { maxKeys: 3, noNullPrototype: true })
    await fc.assert(
      fc.asyncProperty(stampArb, async (stamp) => {
        const sql = await sqlBool(db, 'is_version_stamp', stamp)
        expect(VersionStampSchema.safeParse(stamp).success, JSON.stringify(stamp)).toBe(sql)
      }),
      { seed: 20261002, numRuns: 120 },
    )
  })
})

// An explained adjusting entry as records.ts parses it; only sources varies.
function explainedEntryRecord(sources: unknown, explained = true): Row {
  return {
    id: 'e-zod-1', created_at: new Date('2026-03-15T18:00:00Z'), is_test: true, return_id: 'r-zod-1',
    qbo_snapshot_id: 'snap-0001', qbo_txn_id: 'JE-0001', entry_type: 'accrual',
    reason: 'Year-end accrual of December rent (Test)', sources, author: 'Preparer (Test)', explained, version_no: 1,
  }
}

async function explainOutcome(db: PGlite, b: Base, sources: unknown): Promise<string> {
  const id = tid('e')
  const ins = await refusalOf(insert(db, 'adjusting_entries', {
    id, return_id: b.returnId, qbo_snapshot_id: 'snap-0001', qbo_txn_id: 'JE-' + id, entry_type: 'accrual',
    reason: 'Year-end accrual of December rent (Test)', sources, author: 'Preparer (Test)',
  }))
  if (ins) return ins.code === '23514' ? 'refused' : `insert refused for the wrong reason ${ins.code} ${ins.message}`
  for (const [i, amt] of [100, -100].entries()) {
    await insert(db, 'entry_lines', { id: `${id}-l${String(i)}`, entry_id: id, qbo_account_id: '35', amount_cents: amt })
  }
  const r = await refusalOf(db.query('update returns.adjusting_entries set explained = true where id = $1', [id]))
  if (!r) return 'explained'
  return /^(23|P0001)/.test(r.code) ? 'refused' : `refused for the wrong reason ${r.code} ${r.message}`
}

describe('TB-2 a source member key is never blank, in SQL and zod alike', () => {
  test('TB-2 planted: an entry whose source is [{"\\t":"x"}] is never explained, sources_are_real says no, and records.ts refuses it', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const sources = [{ '\t': 'x' }]
    expect(await sqlBool(db, 'sources_are_real', sources)).toBe(false)
    expect(await explainOutcome(db, b, sources)).toBe('refused')
    expect(AdjustingEntryRecordSchema.safeParse(explainedEntryRecord(sources)).success).toBe(false)
  })

  test('TB-2 every source member with a blank key, over the blank sample set, is refused by SQL and records.ts', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const problems: string[] = []
    for (const k of BLANKS) {
      const cases: readonly unknown[] = [
        [{ [k]: 'x' }],
        ['Rent invoice 1042 (Test)', { [k]: 'x' }],
        [{ document_id: b.documentId, [k]: 3 }],
      ]
      for (const sources of cases) {
        const label = `${show(k)} in ${JSON.stringify(sources)}`
        if ((await sqlBool(db, 'sources_are_real', sources)) !== false) problems.push(`sources_are_real accepts ${label}`)
        const out = await explainOutcome(db, b, sources)
        if (out !== 'refused') problems.push(`entry ${label}: ${out}`)
        if (AdjustingEntryRecordSchema.safeParse(explainedEntryRecord(sources)).success) problems.push(`records.ts accepts ${label}`)
      }
    }
    expect(problems).toEqual([])
  })

  test('TB-2 a source object with non-blank keys and values is enough, in SQL and records.ts (control)', async () => {
    const db = await cloneTestDb()
    const b = await base(db)
    const sources = [{ document_id: b.documentId, page: 1, note: 'Invoice 1042 (Test)' }, 'Landlord letter (Test)']
    expect(await sqlBool(db, 'sources_are_real', sources)).toBe(true)
    expect(await explainOutcome(db, b, sources)).toBe('explained')
    expect(AdjustingEntryRecordSchema.safeParse(explainedEntryRecord(sources)).success).toBe(true)
  })
})

// ---------- 3. zod mirrors sources_are_real ----------

describe('TB-2 records.ts refuses the sources sources_are_real refuses', () => {
  const named: readonly (readonly [string, unknown])[] = [
    ['[]', []],
    ['[""]', ['']],
    ['["\\t"]', ['\t']],
    ['[NBSP]', [' ']],
    ['[U+2800]', ['⠀']],
    ['[null]', [null]],
    ['[{}]', [{}]],
    ['[{"x":""}]', [{ x: '' }]],
    ['[{"x":null}]', [{ x: null }]],
    ['[{"x":"\\u200b"}]', [{ x: '​' }]],
    ['[{"x":true}]', [{ x: true }]],
    ['[{"x":{}}]', [{ x: {} }]],
    ['[{"x":[]}]', [{ x: [] }]],
    ['[[]]', [[]]],
    ['[["Invoice (Test)"]]', [['Invoice (Test)']]],
    ['[3]', [3]],
    ['[true]', [true]],
    ['a good member then {"document_id":" "}', ['Invoice 1042 (Test)', { document_id: ' ' }]],
  ]
  for (const [label, sources] of named) {
    test(`TB-2 sources ${label}: sources_are_real refuses it and an explained entry record in records.ts refuses it too`, async () => {
      const db = await cloneTestDb()
      expect(await sqlBool(db, 'sources_are_real', sources)).toBe(false)
      expect(AdjustingEntryRecordSchema.safeParse(explainedEntryRecord(sources)).success).toBe(false)
    })
  }

  test('TB-2 an unexplained entry record may hold an empty source list, as the table allows (control)', () => {
    expect(AdjustingEntryRecordSchema.safeParse(explainedEntryRecord([], false)).success).toBe(true)
  })

  test('TB-2 property: an explained entry record parses exactly when returns.sources_are_real is true', async () => {
    const db = await cloneTestDb()
    const blank = fc.constantFrom<string>(...BLANKS)
    const visible = fc.constantFrom('Invoice 1042 (Test)', 'x', ' a ', '́')
    const key = fc.oneof(blank, fc.constantFrom('document_id', 'page', 'note'))
    const scalar = fc.oneof(blank, visible, fc.integer({ min: -5, max: 99 }), fc.constantFrom<unknown>(null, true, {}, []))
    const obj = fc.dictionary(key, scalar, { maxKeys: 3, noNullPrototype: true })
    const member = fc.oneof(blank, visible, obj, obj, fc.integer({ min: 0, max: 9 }), fc.constantFrom<unknown>(null, [], false))
    await fc.assert(
      fc.asyncProperty(fc.array(member, { maxLength: 3 }), async (sources) => {
        const sql = await sqlBool(db, 'sources_are_real', sources)
        expect(AdjustingEntryRecordSchema.safeParse(explainedEntryRecord(sources)).success, JSON.stringify(sources)).toBe(sql)
      }),
      { seed: 20261002, numRuns: 150 },
    )
  })
})

// ---------- 4. the catalog loops reach F01's own tables only; the value list lives in text.ts ----------

const F01_FILES = [
  '00_schema.sql',
  '10_documents.sql',
  '20_ledger.sql',
  '30_books.sql',
  '40_figures.sql',
  '50_returns.sql',
  '60_versions.sql',
  '70_checks.sql',
  '90_learning.sql',
]
// A later card's schema file that sorts before 90_learning.sql (as 05_bridge, 15_auth, 35_qbo and
// 80_jobs do): its table has a return_id and a text column and no checks of its own.
const LATER_FILE = '05_later_test.sql'
const LATER_SQL = `
create table returns.later_things_test (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  note text not null
);
`

let laterDir: string | undefined
let laterTemplate: DbTemplate | undefined
let laterBootError = ''

beforeAll(async () => {
  laterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f01c-schema-'))
  for (const f of F01_FILES) fs.copyFileSync(path.join(DEFAULT_SCHEMA_DIR, f), path.join(laterDir, f))
  fs.writeFileSync(path.join(laterDir, LATER_FILE), LATER_SQL)
  try {
    laterTemplate = await createTemplate(laterDir)
  } catch (e) {
    laterBootError = e instanceof Error ? e.message : String(e)
  }
})
afterAll(async () => {
  await laterTemplate?.close()
  if (laterDir) fs.rmSync(laterDir, { recursive: true, force: true })
})

async function laterClone(): Promise<PGlite> {
  expect(laterBootError, 'F01 schema files plus a later file boot').toBe('')
  if (!laterTemplate) throw new Error('the later-file template did not boot')
  return laterTemplate.clone()
}

describe('EV-1 ARC-3 the 90_learning.sql loops cover F01 tables only', () => {
  test('ARC-3 a table from a later schema file gets no return_id foreign key from F01 (SC R43 covers it)', async () => {
    const db = await laterClone()
    try {
      const fk = await db.query<{ n: number }>(
        `select count(*)::int as n from information_schema.table_constraints
         where table_schema = 'returns' and table_name = 'later_things_test' and constraint_type = 'FOREIGN KEY'`,
      )
      expect(fk.rows[0]?.n).toBe(0)
      await expectAccepted(insert(db, 'later_things_test', { id: 'lt-1', return_id: 'no-such-return (Test)', note: 'Later card row (Test)' }))
    } finally {
      await db.close()
    }
  })

  test('EV-1 a text column of a table from a later schema file gets no non-blank check from F01 (SC R13 covers it)', async () => {
    const db = await laterClone()
    try {
      const ck = await db.query<{ n: number }>(
        `select count(*)::int as n from information_schema.table_constraints
         where table_schema = 'returns' and table_name = 'later_things_test' and constraint_type = 'CHECK'
           and constraint_name not like '%_not_null'`,
      )
      expect(ck.rows[0]?.n).toBe(0)
      const r = await db.query<{ id: string }>('select id from returns.returns limit 1')
      const returnId = r.rows[0]?.id ?? 'none'
      for (const blank of BLANKS) {
        await expectAccepted(insert(db, 'later_things_test', { id: tid('lt'), return_id: returnId, note: blank }))
      }
    } finally {
      await db.close()
    }
  })

  test('EV-1 ARC-3 F01 tables in the same database still refuse a blank and a missing return (control)', async () => {
    const db = await laterClone()
    try {
      const blankName = await refusalOf(insert(db, 'returns', { id: tid('r'), entity_name: ' ', year_end: '2025-12-31', state: 'intake' }))
      expect(blankName?.code, blankName?.message ?? 'accepted').toBe('23514')
      const noReturn = await refusalOf(insert(db, 'documents', {
        id: tid('d'), return_id: 'no-such-return (Test)', fingerprint: 'sha256:' + 'c'.repeat(64), file_name: 'x (Test).pdf',
      }))
      expect(noReturn?.code, noReturn?.message ?? 'accepted').toBe('23503')
    } finally {
      await db.close()
    }
  })

  test('EV-1 RT-12 no F01 schema file keeps its own copy of the value allow-list (it lives in text.ts VALUE_COLUMNS)', () => {
    const six = [
      'facts.value', 'version_cells.value', 'judgment_inputs.value', 'figures.value',
      'differences.before_value', 'differences.after_value',
    ]
    const hits: string[] = []
    for (const f of F01_FILES) {
      const src = fs.readFileSync(path.join(DEFAULT_SCHEMA_DIR, f), 'utf8')
      for (const c of six) if (src.includes(`'${c}'`)) hits.push(`${f}: '${c}'`)
    }
    expect(hits).toEqual([])
  })
})

// Guard against a silent pass: the blank sample set really is blank by the one definition.
test('EV-1 the blank sample set used here is blank by isBlank', () => {
  for (const b of BLANKS) expect(isBlank(b), show(b)).toBe(true)
})
