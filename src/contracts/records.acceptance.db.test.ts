/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- the fixture casts adapt to whatever id, time and json types records.ts chooses */
// F01 acceptance tests: records and schema (spec-writer; builders never edit this file).
//
// The shape these tests fix (the builder matches it; extra columns are fine if nullable or defaulted):
// - Every table lives in schema `returns` and has `id text primary key`, `created_at timestamptz`,
//   `is_test boolean not null default true`. Row-level security on, no policies (deny-all).
// - Record types in `src/contracts/records.ts` use the column names as property names (snake_case),
//   so a row read from the database is the record. Money columns are integer cents (`*_cents`, number).
// - Tables by file:
//   10_documents: documents
//   20_ledger:    facts, links, events
//   30_books:     accounts, adjusting_entries, entry_lines, gifi_mappings, judgment_inputs
//   40_figures:   figures
//   50_returns:   returns, state_events, holds
//   60_versions:  versions, version_cells, approvals
//   70_checks:    check_results, exceptions, answers
//   90_learning:  differences, lessons
// - Facts carry exactly one source pointer: one of source_document_id (with source_page, source_box),
//   source_qbo_snapshot_id, source_client_answer_id, source_cra_capture_id, source_prior_return_id,
//   source_reason (EV-5). Origins: third_party, client_filed, client_prepared, client_said, judgment
//   (EV-10). Status: proposed, preparer_verified, cpa_accepted (EV-8).
// - facts, figures and check_results carry `version_stamp jsonb not null`, a non-empty object (ARC-10).
// - adjusting_entries: entry_type (reclass, accrual, allocation, estimate, correction; nullable),
//   reason (nullable), sources (jsonb array), explained (boolean, default false); an entry with no
//   type, reason or source may be stored but not marked explained; entry_lines: entry_id, amount_cents
//   (signed; debits positive). Explained only when lines net to zero with a type, reason and source.
// - gifi_mappings: account_id, mapping_version, gifi_code; one code per account per version (TB-3).
// - returns.state is one of blueprint 02's states; changing it needs a state_events row for that
//   return with from_state = old state and to_state = new state (FLOW-1).
// - Append-only (trigger, message contains "append-only"): events, state_events, versions,
//   version_cells, approvals, entry_lines, judgment_inputs; TRUNCATE is refused on each too.
//
// Round 2 (checks 13 to 19, findings review F01-F09; amber choices are named in reports/F01-spec-r2.md):
// - facts pointer columns: a document pointer is source_document_id with exactly one of
//   (source_page and source_box) or (source_sheet, source_row integer, source_column); a QBO pointer
//   is source_qbo_snapshot_id with source_qbo_account_id (source_qbo_txn_id where there is one).
//   Page, box, sheet, row and column only with a document; QBO account and transaction only with
//   a snapshot. source_box is F09's Box without the page: { left, top, width, height }, fractions
//   0 to 1, left + width and top + height at most 1 (SQL check and the zod schema alike).
// - state_events.seq bigint generated always as identity orders events; returns.current_state_event_id
//   names the event that licensed the latest move (set by the move, moveTo below sets only state).
//   A return is inserted at intake only; later states are reached through events.
// - actor, reason (events, state_events, judgment_inputs) and author (judgment_inputs) are non-blank.
// - a version stamp is a non-empty object whose values are non-blank strings or numbers.
// - adjusting_entries and judgment_inputs carry version_no integer not null (default 1); a new
//   version of an entry is a new row with the same return, snapshot and transaction.
// - facts and adjusting_entries refuse in-place UPDATE of value columns (status and explained may
//   change) and DELETE.
//
// Round 3, the last (checks 16 and 17 widened, new check 20; reports/findings-F01-r2.md S1 to S8):
// - Blank, defined once (src/contracts/text.ts isBlank, SQL returns.is_blank(text)): a string made
//   only of White_Space, Cc, Cf or Default_Ignorable_Code_Point characters, or U+2800. The two agree
//   on every code point except U+0000 (not storable) and the surrogates.
// - Every text column outside the value list (facts.value, version_cells.value,
//   judgment_inputs.value, figures.value, differences.before_value, differences.after_value) refuses
//   a blank value with SQLSTATE 23514 (ids, pointer ids, and nullable columns when present); the
//   same row with a non-blank value in that column is accepted; the matching records.ts field
//   refuses the same blanks. (returns.current_state_event_id is set only by the move: zod only.)
// - Every return_id is a foreign key to returns.returns(id).
// - adjusting entry sources: each member is a non-blank string, or a non-empty object whose every
//   value is a non-blank string or a number.
// - state_events (FLOW-1), refused with SQLSTATE 23514 and a message naming the rule:
//   a seq the caller set (OVERRIDING SYSTEM VALUE): message contains "seq";
//   from_state other than the return's state: "from_state"; to_state equal to from_state: "to_state";
//   a second pending event (one not yet used by a move) for the return: "pending".
//   A move with no licence says "no matching state event" or "no pending state event".
// - version_no on facts (per return_id, fact_key), adjusting_entries (per return_id,
//   qbo_snapshot_id, qbo_txn_id), judgment_inputs (per return_id, cell_id), versions (per return_id)
//   and gifi_mappings.mapping_version (per account_id) start at 1 and go up by exactly one; any other
//   number is refused with SQLSTATE class 23 and a message or constraint naming the column.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from '../core/clock'
import { DEFAULT_SCHEMA_DIR, cloneTestDb as cloneBareDb, createTemplate, type DbTemplate } from '../core/db'
import type {
  AccountRecord,
  AdjustingEntryRecord,
  AnswerRecord,
  ApprovalRecord,
  CheckResultRecord,
  DifferenceRecord,
  DocumentRecord,
  EntryLineRecord,
  EventRecord,
  ExceptionRecord,
  FactRecord,
  FigureRecord,
  GifiMappingRecord,
  HoldRecord,
  JudgmentInputRecord,
  LessonRecord,
  LinkRecord,
  ReturnRecord,
  StateEventRecord,
  VersionCellRecord,
  VersionRecord,
} from './records'
import type * as Ids from './ids'
import {
  AccountRecordSchema,
  AdjustingEntryRecordSchema,
  AnswerRecordSchema,
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
} from './records'
import { BoxSchema } from './reading'
import { isBlank } from './text'

// FX17 (SEC-1, SEC-7): an actor column takes a staff_users id or a listed system actor, so every clone this file
// makes first holds its made-up actors as staff users. Only the fixture changes; no assertion does.
const FX17_ACTORS: readonly string[] = ['Preparer (Test)', 'Reviewer (Test)', 'system (Test)', 'Someone else (Test)', 'Someone (Test)']
async function cloneTestDb(): Promise<PGlite> {
  const db = await cloneBareDb()
  for (const id of FX17_ACTORS) {
    await db.query(`insert into returns.staff_users (id, display_name, roles) values ($1, $1, '{preparer}')`, [id])
  }
  return db
}

// ids.ts must exist and name the id kinds; this line fails typecheck until it does.
export type IdKindsExist = [Ids.ReturnId, Ids.FactId, Ids.FigureId, Ids.DocumentId]

beforeAll(() => {
  setClock(fixedClock('2026-03-15T14:00:00-04:00'))
})
afterAll(() => {
  setClock(systemClock)
})

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

const F01_TABLES = [
  'returns',
  'documents',
  'versions',
  'version_cells',
  'approvals',
  'events',
  'facts',
  'links',
  'accounts',
  'gifi_mappings',
  'adjusting_entries',
  'entry_lines',
  'judgment_inputs',
  'figures',
  'state_events',
  'holds',
  'check_results',
  'exceptions',
  'answers',
  'differences',
  'lessons',
] as const
type Table = (typeof F01_TABLES)[number]

const APPEND_ONLY: readonly Table[] = [
  'events',
  'state_events',
  'versions',
  'version_cells',
  'approvals',
  'entry_lines',
]

// ---------- helpers ----------

let seq = 0
// A deterministic text id.
function tid(): string {
  seq += 1
  return `t-${String(seq).padStart(6, '0')}`
}
// The pinned moment, as an ISO string (cast to each record's time type where used).
const AT = '2026-03-15T14:00:00-04:00'

const STAMP = { reader: 'qbo-reader (Test)', reader_version: '0.0.1', mapping_release: 'M-2026.1' }
const FINGERPRINT = 'sha256:' + 'a'.repeat(64)
// F09's Box without the page: fractions of the page, origin top left.
const BOX = { left: 0.62, top: 0.71, width: 0.11, height: 0.02 }
// Round 3: the eight blanks every non-blank text column refuses (findings F01 r2, S2).
const EIGHT_BLANKS = ['', ' ', '\t', '\n', ' ', '​', '　', '⠀'] as const

type Row = Record<string, unknown>

async function insert(db: PGlite, table: Table, row: Row): Promise<void> {
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
// Round 3 (S8): refused, and the refusal names its rule: the constraint name or the message
// matches `naming` (a column name, a constraint name or the trigger's words listed in the header).
async function expectRefusedNaming(p: Promise<unknown>, naming: RegExp, code: RegExp = /^(23|P0001)/): Promise<void> {
  const r = await refusalOf(p)
  expect(r, 'expected the database to refuse this').toBeDefined()
  expect(r?.code, `refused for the wrong reason: ${r?.code ?? ''} ${r?.message ?? ''}`).toMatch(code)
  expect(`${r?.constraint ?? ''} ${r?.message ?? ''}`, 'the refusal names its rule').toMatch(naming)
}
// Refused by an integrity rule (class 23) or a trigger (P0001), never by a mistake such as a
// missing column (42703) or a missing table (42P01).
async function expectRefused(p: Promise<unknown>, reason?: RegExp): Promise<void> {
  const r = await refusalOf(p)
  expect(r, 'expected the database to refuse this').toBeDefined()
  expect(r?.code, `refused for the wrong reason: ${r?.code ?? ''} ${r?.message ?? ''}`).toMatch(
    /^(23|P0001)/,
  )
  if (reason) expect(r?.message).toMatch(reason)
}
async function expectAccepted(p: Promise<unknown>): Promise<void> {
  const r = await refusalOf(p)
  expect(r, `expected the database to accept this, got ${r?.code ?? ''} ${r?.message ?? ''}`).toBeUndefined()
}

async function count(db: PGlite, table: string, where = 'true', params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from returns.${table} where ${where}`,
    params,
  )
  return r.rows[0]?.n ?? -1
}

// ---------- the typed fixture world: one row per table ----------

interface World {
  ids: Record<Table, string>
  rows: Record<Table, Row>
}

function makeWorld(): World {
  // ids first, typed by each record's own id type, so references must agree with the targets
  const returnId = tid() as ReturnRecord['id']
  const documentId = tid() as DocumentRecord['id']
  const versionId = tid() as VersionRecord['id']
  const accountId = tid() as AccountRecord['id']
  const entryId = tid() as AdjustingEntryRecord['id']
  const factId = tid() as FactRecord['id']
  const checkId = tid() as CheckResultRecord['id']
  const exceptionId = tid() as ExceptionRecord['id']
  const differenceId = tid() as DifferenceRecord['id']

  const returnRow: Partial<ReturnRecord> = {
    id: returnId,
    entity_name: 'Quillfeather Sample Widgets Inc. (Test)',
    year_end: '2025-12-31' as unknown as ReturnRecord['year_end'],
    state: 'intake',
  }
  const documentRow: Partial<DocumentRecord> = {
    id: documentId,
    return_id: returnId,
    fingerprint: FINGERPRINT,
    file_name: 'chequing-dec-2025 (Test).pdf',
  }
  const versionRow: Partial<VersionRecord> = { id: versionId, return_id: returnId, version_no: 1 }
  const versionCellRow: Partial<VersionCellRecord> = {
    id: tid() as VersionCellRecord['id'],
    version_id: versionId,
    cell_id: 'T2S100.1001',
    value: '12500',
  }
  const approvalRow: Partial<ApprovalRecord> = {
    id: tid() as ApprovalRecord['id'],
    return_id: returnId,
    version_id: versionId,
    approved_by: 'Reviewer (Test)',
    fingerprint: FINGERPRINT,
  }
  const factRow: Partial<FactRecord> = {
    id: factId,
    return_id: returnId,
    fact_key: 'bank.chequing.closing_balance',
    value: '12500.00',
    source_document_id: documentId,
    source_page: 1,
    source_box: { ...BOX } as unknown as FactRecord['source_box'],
    origin: 'third_party',
    method: 'ocr',
    status: 'proposed',
    version_stamp: STAMP as unknown as FactRecord['version_stamp'],
  }
  const eventRow: Partial<EventRecord> = {
    id: tid() as EventRecord['id'],
    record_table: 'facts',
    record_id: factId,
    actor: 'Preparer (Test)',
    occurred_at: AT as unknown as EventRecord['occurred_at'],
    from_value: { status: 'proposed' } as unknown as EventRecord['from_value'],
    to_value: { status: 'preparer_verified' } as unknown as EventRecord['to_value'],
    reason: 'Ticked against the statement (Test)',
  }
  const accountRow: Partial<AccountRecord> = {
    id: accountId,
    return_id: returnId,
    qbo_snapshot_id: 'snap-0001',
    qbo_account_id: '35',
    name: 'Chequing (Test)',
    balance_cents: 1_250_000,
  }
  const gifiRow: Partial<GifiMappingRecord> = {
    id: tid() as GifiMappingRecord['id'],
    return_id: returnId,
    account_id: accountId,
    mapping_version: 1,
    gifi_code: '1001',
  }
  const entryRow: Partial<AdjustingEntryRecord> = {
    id: entryId,
    return_id: returnId,
    qbo_snapshot_id: 'snap-0001',
    qbo_txn_id: 'JE-0001',
    entry_type: 'accrual',
    reason: 'Year-end accrual of December rent (Test)',
    sources: [{ document_id: documentId, page: 1 }] as unknown as AdjustingEntryRecord['sources'],
    author: 'Preparer (Test)',
  }
  const lineRow: Partial<EntryLineRecord> = {
    id: tid() as EntryLineRecord['id'],
    entry_id: entryId,
    qbo_account_id: '35',
    amount_cents: 50_000,
  }
  const linkRow: Partial<LinkRecord> = {
    id: tid() as LinkRecord['id'],
    kind: 'built_from',
    from_table: 'figures',
    from_id: 'figure-0001',
    to_table: 'accounts',
    to_id: accountId,
  }
  const judgmentRow: Partial<JudgmentInputRecord> = {
    id: tid() as JudgmentInputRecord['id'],
    return_id: returnId,
    cell_id: 'T2S8.CCA.CLASS10',
    value: '4200',
    author: 'Preparer (Test)',
    reason: 'Half-year rule applied to the new van (Test)',
  }
  const figureRow: Partial<FigureRecord> = {
    id: tid() as FigureRecord['id'],
    return_id: returnId,
    figure_key: 'GIFI.1001',
    cell_id: 'T2S100.1001',
    value: '12500',
    version_stamp: STAMP as unknown as FigureRecord['version_stamp'],
  }
  const stateEventRow: Partial<StateEventRecord> = {
    id: tid() as StateEventRecord['id'],
    return_id: returnId,
    from_state: 'intake',
    to_state: 'evidence',
    actor: 'system (Test)',
    occurred_at: AT as unknown as StateEventRecord['occurred_at'],
    reason: 'Created from client-app data (Test)',
  }
  const holdRow: Partial<HoldRecord> = {
    id: tid() as HoldRecord['id'],
    return_id: returnId,
    holder: 'Preparer (Test)',
    taken_at: AT as unknown as HoldRecord['taken_at'],
  }
  const checkRow: Partial<CheckResultRecord> = {
    id: checkId,
    return_id: returnId,
    check_id: 'CK-20',
    outcome: 'pass',
    version_stamp: { check: 'CK-20', rule_version: '1' } as unknown as CheckResultRecord['version_stamp'],
  }
  const exceptionRow: Partial<ExceptionRecord> = {
    id: exceptionId,
    return_id: returnId,
    check_result_id: checkId,
    amount_cents: 12_345,
    tax_effect_cents: 1_500,
  }
  const answerRow: Partial<AnswerRecord> = {
    id: tid() as AnswerRecord['id'],
    exception_id: exceptionId,
    author: 'Preparer (Test)',
    answer: 'Timing difference on a December deposit (Test)',
  }
  const differenceRow: Partial<DifferenceRecord> = {
    id: differenceId,
    return_id: returnId,
    cell_id: 'T2S100.1001',
    before_value: '12000',
    after_value: '12500',
  }
  const lessonRow: Partial<LessonRecord> = {
    id: tid() as LessonRecord['id'],
    difference_id: differenceId,
    summary: 'Read the December statement, not November (Test)',
  }

  const rows: Record<Table, Row> = {
    returns: returnRow,
    documents: documentRow,
    versions: versionRow,
    version_cells: versionCellRow,
    approvals: approvalRow,
    events: eventRow,
    facts: factRow,
    links: linkRow,
    accounts: accountRow,
    gifi_mappings: gifiRow,
    adjusting_entries: entryRow,
    entry_lines: lineRow,
    judgment_inputs: judgmentRow,
    figures: figureRow,
    state_events: stateEventRow,
    holds: holdRow,
    check_results: checkRow,
    exceptions: exceptionRow,
    answers: answerRow,
    differences: differenceRow,
    lessons: lessonRow,
  }
  const ids = Object.fromEntries(
    Object.entries(rows).map(([t, row]) => [t, String(row['id'])]),
  ) as Record<Table, string>
  return { ids, rows }
}

async function insertWorld(db: PGlite): Promise<World> {
  const w = makeWorld()
  for (const t of F01_TABLES) await insert(db, t, w.rows[t])
  return w
}

async function freshWorld(): Promise<{ db: PGlite; w: World }> {
  const db = await cloneTestDb()
  const w = await insertWorld(db)
  return { db, w }
}

// ---------- 1. EV-1, SEC-7 append-only ----------

describe('EV-1 SEC-7 append-only records', () => {
  for (const t of APPEND_ONLY) {
    test(`EV-1 SEC-7 an UPDATE of a row in ${t} is refused and the row is unchanged`, async () => {
      const { db, w } = await freshWorld()
      await expectRefused(
        db.query(`update returns.${t} set is_test = false where id = $1`, [w.ids[t]]),
        /append-only/i,
      )
      expect(await count(db, t, 'id = $1 and is_test = true', [w.ids[t]])).toBe(1)
    })

    test(`EV-1 SEC-7 a DELETE of a row in ${t} is refused and the row stays`, async () => {
      const { db, w } = await freshWorld()
      await expectRefused(db.query(`delete from returns.${t} where id = $1`, [w.ids[t]]), /append-only/i)
      expect(await count(db, t, 'id = $1', [w.ids[t]])).toBe(1)
    })
  }

  test('EV-1 a new row can still be appended to an append-only table', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(
      insert(db, 'events', { ...w.rows.events, id: tid(), reason: 'Second change (Test)' }),
    )
    expect(await count(db, 'events')).toBe(2)
  })
})

// ---------- 2. TB-2 adjusting entries ----------

async function newEntry(db: PGlite, w: World, over: Row = {}): Promise<string> {
  const id = tid()
  await insert(db, 'adjusting_entries', { ...w.rows.adjusting_entries, id, qbo_txn_id: 'JE-' + id, ...over })
  return id
}
async function addLines(db: PGlite, entryId: string, amounts: number[]): Promise<void> {
  for (const a of amounts) {
    await insert(db, 'entry_lines', { id: tid(), entry_id: entryId, qbo_account_id: '35', amount_cents: a })
  }
}
function markExplained(db: PGlite, entryId: string): Promise<unknown> {
  return db.query('update returns.adjusting_entries set explained = true where id = $1', [entryId])
}

describe('TB-2 an adjusting entry counts as explained only when complete and balanced', () => {
  test('TB-2 an entry whose lines net to zero with a type, reason and source can be marked explained', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w)
    await addLines(db, e, [50_000, -30_000, -20_000])
    await expectAccepted(markExplained(db, e))
    expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [e])).toBe(1)
  })

  test('TB-2 an entry whose lines are off by one cent cannot be marked explained', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w)
    await addLines(db, e, [50_000, -49_999])
    await expectRefused(markExplained(db, e))
    expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [e])).toBe(0)
  })

  test('TB-2 an entry with no type cannot be marked explained', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w, { entry_type: null })
    await addLines(db, e, [100, -100])
    await expectRefused(markExplained(db, e))
  })

  test('TB-2 an entry with no reason (null or blank) cannot be marked explained', async () => {
    const { db, w } = await freshWorld()
    const e1 = await newEntry(db, w, { reason: null })
    await addLines(db, e1, [100, -100])
    await expectRefused(markExplained(db, e1))
    // round 3 (check 17 widened): a blank reason may already be refused when the entry is written
    // (23514); if it is written, it still cannot be marked explained
    const e2 = tid()
    const ins = await refusalOf(insert(db, 'adjusting_entries', { ...w.rows.adjusting_entries, id: e2, qbo_txn_id: 'JE-' + e2, reason: '   ' }))
    if (ins) expect(ins.code, ins.message).toBe('23514')
    else {
      await addLines(db, e2, [100, -100])
      await expectRefused(markExplained(db, e2))
    }
    expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [e2])).toBe(0)
  })

  test('TB-2 an entry with no source cannot be marked explained', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w, { sources: [] })
    await addLines(db, e, [100, -100])
    await expectRefused(markExplained(db, e))
  })

  test('TB-2 an entry type outside reclass, accrual, allocation, estimate, correction is refused', async () => {
    const { db, w } = await freshWorld()
    for (const ok of ['reclass', 'accrual', 'allocation', 'estimate', 'correction']) {
      await expectAccepted(newEntry(db, w, { entry_type: ok }))
    }
    await expectRefused(newEntry(db, w, { entry_type: 'plug' }))
  })

  test('TB-2 inserting an entry already marked explained with no type is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(newEntry(db, w, { entry_type: null, explained: true }))
  })

  test('TB-2 a line added to an explained entry that unbalances it is refused', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w)
    await addLines(db, e, [700, -700])
    await expectAccepted(markExplained(db, e))
    await expectRefused(addLines(db, e, [1]))
  })

  test('TB-2 ARC-13 property: an entry can be marked explained if and only if its lines net to zero', async () => {
    const db = await cloneTestDb()
    const w = await insertWorld(db)
    const amount = fc.integer({ min: -10_000_000_000, max: 10_000_000_000 }).filter((n) => n !== 0)
    await fc.assert(
      fc.asyncProperty(fc.array(amount, { minLength: 1, maxLength: 6 }), fc.boolean(), async (xs, balance) => {
        const sum = xs.reduce((a, b) => a + b, 0)
        const lines = balance && sum !== 0 ? [...xs, -sum] : xs
        const net = lines.reduce((a, b) => a + b, 0)
        const e = await newEntry(db, w)
        await addLines(db, e, lines)
        const r = await refusalOf(markExplained(db, e))
        if (net === 0) expect(r, `lines ${JSON.stringify(lines)} net to zero`).toBeUndefined()
        else expect(r?.code ?? 'accepted', `lines ${JSON.stringify(lines)} net to ${String(net)}`).toMatch(/^(23|P0001)/)
      }),
      { seed: 20261001, numRuns: 40 },
    )
  })
})

// ---------- 3, 4, 5. facts: EV-5, EV-10, EV-8 ----------

function factWith(w: World, over: Row): Row {
  const id = tid()
  return { ...w.rows.facts, id, fact_key: 'test.key.' + id, ...over }
}
const NO_SOURCE: Row = {
  source_document_id: null,
  source_page: null,
  source_box: null,
  source_reason: null,
}

describe('EV-5 a fact has exactly one source pointer', () => {
  test('EV-5 a fact with one document pointer, or one written reason, is accepted', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(insert(db, 'facts', factWith(w, {})))
    await expectAccepted(
      insert(db, 'facts', factWith(w, { ...NO_SOURCE, origin: 'judgment', source_reason: 'Half of the phone bill is personal (Test)' })),
    )
  })

  test('EV-5 a fact with no source pointer is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, NO_SOURCE)))
  })

  test('EV-5 a fact with two source pointers (a document and a reason) is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, { source_reason: 'Also a reason (Test)' })))
  })
})

describe('EV-10 every source has one of five origins', () => {
  test('EV-10 each of the five origins is accepted', async () => {
    const { db, w } = await freshWorld()
    for (const origin of ['third_party', 'client_filed', 'client_prepared', 'client_said', 'judgment']) {
      await expectAccepted(insert(db, 'facts', factWith(w, { origin })))
    }
  })

  test('EV-10 an origin outside the five, or none, is refused', async () => {
    const { db, w } = await freshWorld()
    for (const origin of ['client', 'Third party', 'ai', '', null]) {
      await expectRefused(insert(db, 'facts', factWith(w, { origin })))
    }
  })
})

describe('EV-8 fact status is one of three', () => {
  test('EV-8 proposed, preparer_verified and cpa_accepted are accepted', async () => {
    const { db, w } = await freshWorld()
    for (const status of ['proposed', 'preparer_verified', 'cpa_accepted']) {
      await expectAccepted(insert(db, 'facts', factWith(w, { status })))
    }
  })

  test('EV-8 a status outside the three, or none, is refused', async () => {
    const { db, w } = await freshWorld()
    for (const status of ['approved', 'verified', 'Proposed', null]) {
      await expectRefused(insert(db, 'facts', factWith(w, { status })))
    }
  })
})

// ---------- 6. TB-3 ----------

describe('TB-3 an account has one GIFI code per mapping version', () => {
  test('TB-3 a second GIFI code for the same account in the same version is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'gifi_mappings', { ...w.rows.gifi_mappings, id: tid(), gifi_code: '1002' }))
    expect(await count(db, 'gifi_mappings', 'account_id = $1', [w.ids.accounts])).toBe(1)
  })

  test('TB-3 the same account in a new mapping version may carry a different code', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(
      insert(db, 'gifi_mappings', { ...w.rows.gifi_mappings, id: tid(), mapping_version: 2, gifi_code: '1002' }),
    )
  })
})

// ---------- 7. SEC-6 ----------

async function tablesIn(db: PGlite, schema: string): Promise<string[]> {
  const r = await db.query<{ t: string }>(
    `select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relkind in ('r', 'p') order by 1`,
    [schema],
  )
  return r.rows.map((x) => x.t)
}

describe('SEC-6 row-level security denies everything by default', () => {
  test('SEC-6 every table in schema returns has row-level security on and no policies', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ t: string; rls: boolean }>(
      `select c.relname as t, c.relrowsecurity as rls from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'returns' and c.relkind in ('r', 'p') order by 1`,
    )
    expect(r.rows.length).toBeGreaterThanOrEqual(F01_TABLES.length)
    expect(r.rows.filter((x) => !x.rls).map((x) => x.t)).toEqual([])
    const p = await db.query<{ n: number }>(`select count(*)::int as n from pg_policies where schemaname = 'returns'`)
    expect(p.rows[0]?.n).toBe(0)
  })

  test('SEC-6 a role granted SELECT (the public key) reads zero rows from every table after a row is inserted', async () => {
    const { db } = await freshWorld()
    for (const t of F01_TABLES) expect(await count(db, t), `${t} has its row as the owner`).toBe(1)
    await db.exec(`create role anon_test nologin;
      grant usage on schema returns to anon_test;
      grant select on all tables in schema returns to anon_test;`)
    const all = await tablesIn(db, 'returns')
    await db.exec('set role anon_test')
    try {
      for (const t of all) {
        const r = await db.query<{ n: number }>(`select count(*)::int as n from returns.${t}`)
        expect(r.rows[0]?.n, `${t} leaked rows to the public key`).toBe(0)
      }
    } finally {
      await db.exec('reset role')
    }
  })

  test('SEC-6 a role with no grants reads nothing from any table', async () => {
    const { db } = await freshWorld()
    await db.exec('create role nobody_test nologin;')
    const all = await tablesIn(db, 'returns')
    await db.exec('set role nobody_test')
    try {
      for (const t of all) {
        const r = await refusalOf(db.query(`select * from returns.${t}`))
        if (r) expect(r.code, `${t}: ${r.message}`).toBe('42501')
        else {
          const rows = await db.query(`select * from returns.${t}`)
          expect(rows.rows.length, `${t} leaked rows`).toBe(0)
        }
      }
    } finally {
      await db.exec('reset role')
    }
  })
})

// ---------- 8. ARC-2 ----------

describe('ARC-2 every table lives in schema returns', () => {
  test('ARC-2 every F01 table is in schema returns', async () => {
    const db = await cloneTestDb()
    const have = await tablesIn(db, 'returns')
    expect(F01_TABLES.filter((t) => !have.includes(t))).toEqual([])
  })

  test('ARC-2 no table is created in public or any other schema', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ s: string; t: string }>(
      `select n.nspname as s, c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p', 'v', 'm')
         and n.nspname not in ('returns', 'pg_catalog', 'information_schema')
         and n.nspname not like 'pg\\_%'`,
    )
    expect(r.rows.map((x) => `${x.s}.${x.t}`)).toEqual([])
  })
})

// ---------- 9. is_test, id, created_at ----------

describe('every table has is_test, id and created_at', () => {
  test('ARC-2 every table in schema returns has is_test boolean not null default true, id and created_at', async () => {
    const db = await cloneTestDb()
    const all = await tablesIn(db, 'returns')
    expect(all.length).toBeGreaterThanOrEqual(F01_TABLES.length)
    const cols = await db.query<{ t: string; c: string; ty: string; nullable: string; def: string | null }>(
      `select table_name as t, column_name as c, data_type as ty, is_nullable as nullable, column_default as def
       from information_schema.columns where table_schema = 'returns'`,
    )
    const problems: string[] = []
    for (const t of all) {
      const of = (c: string) => cols.rows.find((x) => x.t === t && x.c === c)
      const isTest = of('is_test')
      if (!isTest) problems.push(`${t}: no is_test`)
      else if (isTest.ty !== 'boolean' || isTest.nullable !== 'NO' || !/true/i.test(isTest.def ?? ''))
        problems.push(`${t}: is_test is not boolean not null default true`)
      if (!of('id')) problems.push(`${t}: no id`)
      if (!of('created_at')) problems.push(`${t}: no created_at`)
    }
    expect(problems).toEqual([])
  })

  test('ARC-2 a row inserted without is_test is marked as test data in every table', async () => {
    const { db } = await freshWorld()
    for (const t of F01_TABLES) {
      expect(await count(db, t, 'is_test = true'), t).toBe(1)
    }
  })
})

// ---------- 10. ARC-10 ----------

describe('ARC-10 derived records store the versions that made them', () => {
  const stamped = ['facts', 'figures', 'check_results'] as const
  const keyCol: Record<(typeof stamped)[number], string> = {
    facts: 'fact_key',
    figures: 'figure_key',
    check_results: 'check_id',
  }
  // a copy of the fixture row with its own id and key, so only the stamp can cause a refusal
  function copy(w: World, t: (typeof stamped)[number]): Row {
    const id = tid()
    return { ...w.rows[t], id, [keyCol[t]]: 'key-' + id }
  }
  for (const t of stamped) {
    test(`ARC-10 ${t} refuses a row with no version stamp`, async () => {
      const { db, w } = await freshWorld()
      await expectRefused(insert(db, t, { ...copy(w, t), version_stamp: null }))
      const without = copy(w, t)
      delete without['version_stamp']
      await expectRefused(insert(db, t, without))
      await expectAccepted(insert(db, t, copy(w, t)))
    })

    test(`ARC-10 ${t} refuses an empty version stamp`, async () => {
      const { db, w } = await freshWorld()
      await expectRefused(insert(db, t, { ...copy(w, t), version_stamp: {} }))
    })

    test(`ARC-10 ${t} accepts a row with a version stamp and keeps it`, async () => {
      const { db, w } = await freshWorld()
      const r = await db.query<{ v: unknown }>(`select version_stamp as v from returns.${t} where id = $1`, [w.ids[t]])
      expect(r.rows[0]?.v).toEqual(w.rows[t]['version_stamp'])
    })
  }
})

// ---------- 11. FLOW-1 ----------

const STATES = [
  'intake',
  'evidence',
  'gaps',
  'qa',
  'build',
  'prepare',
  'trace',
  'respond',
  'review',
  'rework',
  'approved',
  'client_sign',
  'ready_to_file',
  'filed',
  'assessed',
  'closed',
]

function moveTo(db: PGlite, returnId: string, to: string): Promise<unknown> {
  return db.query('update returns.returns set state = $1 where id = $2', [to, returnId])
}
// A complete state event (who, when, from, to, why); extra columns override.
async function stateEvent(db: PGlite, returnId: string, from: string, to: string, over: Row = {}): Promise<string> {
  const id = typeof over['id'] === 'string' ? over['id'] : tid()
  await insert(db, 'state_events', {
    id,
    return_id: returnId,
    from_state: from,
    to_state: to,
    actor: 'Preparer (Test)',
    occurred_at: AT,
    reason: `Moved ${from} to ${to} (Test)`,
    ...over,
  })
  return id
}
// Round 3: a new return at intake with no state event yet, so no pending event can be the reason
// a refusal happens.
async function freshReturn(db: PGlite, w: World): Promise<string> {
  const id = tid()
  await insert(db, 'returns', { ...w.rows.returns, id, entity_name: 'Fresh return (Test)' })
  return id
}
const NO_LICENCE = /no (matching|pending) state event/i

describe('FLOW-1 a return has exactly one state and every change is an event', () => {
  test('FLOW-1 a return with no state is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefusedNaming(insert(db, 'returns', { ...w.rows.returns, id: tid(), state: null }), /\bstate\b|intake/)
  })

  test('FLOW-1 the state is a single value: one column, not a list', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ ty: string }>(
      `select data_type as ty from information_schema.columns
       where table_schema = 'returns' and table_name = 'returns' and column_name = 'state'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]?.ty).not.toBe('ARRAY')
  })

  // Round 2 (check 16): a return is inserted at intake only, so every listed state is now accepted
  // by reaching it through its events, in blueprint 02's order.
  test('FLOW-1 a state outside blueprint 02 is refused; every listed state is accepted', async () => {
    const { db, w } = await freshWorld()
    const r = tid()
    await expectAccepted(insert(db, 'returns', { ...w.rows.returns, id: r, entity_name: 'Return walk (Test)', state: 'intake' }))
    for (let i = 1; i < STATES.length; i++) {
      const from = STATES[i - 1] ?? ''
      const to = STATES[i] ?? ''
      await expectAccepted(stateEvent(db, r, from, to))
      await expectAccepted(moveTo(db, r, to))
      expect(await count(db, 'returns', 'id = $1 and state = $2', [r, to]), to).toBe(1)
    }
    await expectRefusedNaming(
      insert(db, 'returns', { ...w.rows.returns, id: tid(), entity_name: 'Waiting (Test)', state: 'waiting_on_client' }),
      /returns_state|intake/,
    )
  })

  test('FLOW-1 a second current state for the same return is refused (one row per return)', async () => {
    const { db, w } = await freshWorld()
    await expectRefusedNaming(insert(db, 'returns', { ...w.rows.returns, state: 'evidence' }), /returns_pkey|intake/)
    await expectRefusedNaming(insert(db, 'returns', { ...w.rows.returns, state: 'intake' }), /returns_pkey/)
    expect(await count(db, 'returns', 'id = $1', [w.ids.returns])).toBe(1)
  })

  test('FLOW-1 a state change with no event is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefusedNaming(moveTo(db, w.ids.returns, 'gaps'), NO_LICENCE)
    expect(await count(db, 'returns', "id = $1 and state = 'intake'", [w.ids.returns])).toBe(1)
  })

  test('FLOW-1 a state change with its event (who, when, from, to, why) is accepted', async () => {
    const { db, w } = await freshWorld()
    // the fixture world already holds the event intake -> evidence
    await expectAccepted(moveTo(db, w.ids.returns, 'evidence'))
    expect(await count(db, 'returns', "id = $1 and state = 'evidence'", [w.ids.returns])).toBe(1)
  })

  test('FLOW-1 an event for a different move does not license this one', async () => {
    const { db, w } = await freshWorld()
    // the only event is intake -> evidence; intake -> gaps has none
    await expectRefusedNaming(moveTo(db, w.ids.returns, 'gaps'), NO_LICENCE)
  })

  for (const missing of ['actor', 'occurred_at', 'from_state', 'to_state', 'reason']) {
    test(`FLOW-1 a state event with no ${missing} is refused`, async () => {
      const { db, w } = await freshWorld()
      // round 3 (S8): on a return with no pending event, so only the missing column can be the reason
      const r = await freshReturn(db, w)
      await expectRefusedNaming(
        insert(db, 'state_events', { ...w.rows.state_events, id: tid(), return_id: r, [missing]: null }),
        new RegExp(missing),
      )
      expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(0)
    })
  }

  test('FLOW-1 a complete state event is accepted (control for the refusals above)', async () => {
    const { db, w } = await freshWorld()
    // round 3 (S8): the fixture's pending event (intake -> evidence) is used first
    await expectAccepted(moveTo(db, w.ids.returns, 'evidence'))
    await expectAccepted(
      insert(db, 'state_events', { ...w.rows.state_events, id: tid(), from_state: 'evidence', to_state: 'gaps' }),
    )
    const r = await freshReturn(db, w)
    await expectAccepted(insert(db, 'state_events', { ...w.rows.state_events, id: tid(), return_id: r }))
  })

  test('FLOW-1 a state event with a blank reason is refused', async () => {
    const { db, w } = await freshWorld()
    const r = await freshReturn(db, w)
    await expectRefusedNaming(insert(db, 'state_events', { ...w.rows.state_events, id: tid(), return_id: r, reason: '  ' }), /reason/)
  })
})

// ---------- 12. types and tables agree ----------

describe('records.ts and the tables agree', () => {
  test('ARC-3 one row inserts into every F01 table from a typed record object', async () => {
    const { db } = await freshWorld()
    for (const t of F01_TABLES) expect(await count(db, t), t).toBe(1)
  })

  test('ARC-3 the F01 schema files alone create exactly the F01 tables', async () => {
    expect(missingF01Files, 'every F01 schema file exists').toEqual([])
    expect(f01Template, 'the F01 schema files alone boot a template').toBeDefined()
    if (!f01Template) return
    const db = await f01Template.clone()
    try {
      expect(await tablesIn(db, 'returns')).toEqual([...F01_TABLES].sort())
      await insertWorld(db)
    } finally {
      await db.close()
    }
  })
})

// F01's nine files only, copied into a temp folder: later cards adding schema files cannot
// change this table set. The boot is a hook (30 s hookTimeout), not a test body (6 s).
let f01Dir: string | undefined
let f01Template: DbTemplate | undefined
let missingF01Files: string[] = []

beforeAll(async () => {
  f01Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f01-schema-'))
  missingF01Files = F01_FILES.filter((f) => !fs.existsSync(path.join(DEFAULT_SCHEMA_DIR, f)))
  if (missingF01Files.length > 0) return
  for (const f of F01_FILES) fs.copyFileSync(path.join(DEFAULT_SCHEMA_DIR, f), path.join(f01Dir, f))
  f01Template = await createTemplate(f01Dir)
})

afterAll(async () => {
  await f01Template?.close()
  if (f01Dir) fs.rmSync(f01Dir, { recursive: true, force: true })
})

// ======================= Round 2: checks 13 to 19 (findings review F01-F09) =======================

const APPEND_ONLY_ALL: readonly Table[] = [...APPEND_ONLY, 'judgment_inputs']

// ---------- 13. SEC-7, EV-1 TRUNCATE ----------

describe('SEC-7 EV-1 TRUNCATE is refused on every append-only table', () => {
  for (const t of APPEND_ONLY_ALL) {
    test(`SEC-7 EV-1 a TRUNCATE of ${t} is refused and its row stays`, async () => {
      const { db, w } = await freshWorld()
      // cascade, so a foreign key from another table cannot be the reason for the refusal
      await expectRefused(db.query(`truncate returns.${t} cascade`), /append-only/i)
      expect(await count(db, t, 'id = $1', [w.ids[t]])).toBe(1)
    })
  }
})

// ---------- 14. TB-2 sources member by member, and real lines ----------

describe('TB-2 explained needs real sources and at least two lines', () => {
  const blankSources: readonly (readonly [string, unknown[]])[] = [
    ['[null]', [null]],
    ['[""]', ['']],
    ['["  "]', ['  ']],
    ['[{}]', [{}]],
    ['a good source and a null', [{ document_id: 'doc-1', page: 1 }, null]],
  ]
  for (const [label, sources] of blankSources) {
    test(`TB-2 an entry whose sources hold ${label} cannot be marked explained`, async () => {
      const { db, w } = await freshWorld()
      const e = await newEntry(db, w, { sources })
      await addLines(db, e, [100, -100])
      await expectRefused(markExplained(db, e))
      expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [e])).toBe(0)
    })
  }

  test('TB-2 a source that is a non-blank note is enough (control for the refusals above)', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w, { sources: ['Landlord invoice 1042 (Test)'] })
    await addLines(db, e, [100, -100])
    await expectAccepted(markExplained(db, e))
  })

  test('TB-2 an entry with a single 0-cent line cannot be marked explained', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w)
    await addLines(db, e, [0])
    await expectRefused(markExplained(db, e))
    expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [e])).toBe(0)
  })

  test('TB-2 an entry with fewer than two lines cannot be marked explained', async () => {
    const { db, w } = await freshWorld()
    const none = await newEntry(db, w)
    await expectRefused(markExplained(db, none))
    const one = await newEntry(db, w)
    await addLines(db, one, [0])
    await expectRefused(markExplained(db, one))
    await expectRefused(newEntry(db, w, { explained: true }))
  })
})

// ---------- 15. EV-5, EV-14 the whole source pointer ----------

describe('EV-5 EV-14 a source pointer is whole and of one kind', () => {
  const REASON: Row = { ...NO_SOURCE, origin: 'judgment', source_reason: 'Half of the phone bill is personal (Test)' }
  function sheet(w: World): Row {
    return { ...NO_SOURCE, source_document_id: w.ids.documents, source_sheet: 'Trial balance (Test)', source_row: 12, source_column: 'D' }
  }
  const QBO: Row = { ...NO_SOURCE, source_qbo_snapshot_id: 'snap-0001', source_qbo_account_id: '35' }

  test('EV-14 a document pointer by sheet, row and column is accepted', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(insert(db, 'facts', factWith(w, sheet(w))))
  })

  test('EV-5 a document pointer with neither page and box nor sheet, row and column is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, { source_page: null, source_box: null })))
  })

  test('EV-5 a document pointer with a page but no box, or a box but no page, is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, { source_box: null })))
    await expectRefused(insert(db, 'facts', factWith(w, { source_page: null })))
  })

  test('EV-14 a sheet pointer missing its row or column is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, { ...sheet(w), source_row: null })))
    await expectRefused(insert(db, 'facts', factWith(w, { ...sheet(w), source_column: null })))
    await expectRefused(insert(db, 'facts', factWith(w, { ...sheet(w), source_sheet: null })))
  })

  test('EV-5 EV-14 a document pointer with both page and box and sheet, row and column is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(
      insert(db, 'facts', factWith(w, { ...sheet(w), source_page: 1, source_box: BOX })),
    )
  })

  test('EV-5 page, box, sheet, row or column with a pointer that is not a document is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, { ...REASON, source_page: 1, source_box: BOX })))
    await expectRefused(insert(db, 'facts', factWith(w, { ...REASON, source_page: 1 })))
    await expectRefused(insert(db, 'facts', factWith(w, { ...REASON, source_box: BOX })))
    await expectRefused(
      insert(db, 'facts', factWith(w, { ...QBO, source_sheet: 'Trial balance (Test)', source_row: 12, source_column: 'D' })),
    )
  })

  test('EV-5 a QBO pointer with the snapshot and the account, with or without the transaction, is accepted', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(insert(db, 'facts', factWith(w, QBO)))
    await expectAccepted(insert(db, 'facts', factWith(w, { ...QBO, source_qbo_txn_id: 'JE-0001' })))
  })

  test('EV-5 a QBO pointer without the account is refused, and so is an account without a snapshot', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'facts', factWith(w, { ...QBO, source_qbo_account_id: null })))
    await expectRefused(
      insert(db, 'facts', factWith(w, { ...QBO, source_qbo_account_id: null, source_qbo_txn_id: 'JE-0001' })),
    )
    await expectRefused(insert(db, 'facts', factWith(w, { ...REASON, source_qbo_account_id: '35' })))
    await expectRefused(insert(db, 'facts', factWith(w, { source_qbo_account_id: '35', source_qbo_txn_id: 'JE-0001' })))
  })

  const badBoxes: readonly (readonly [string, unknown])[] = [
    ['the old {x0,y0,x1,y1} shape', { x0: 400, y0: 610, x1: 470, y1: 622 }],
    ['a box wider than the page from its left edge', { left: 0.5, top: 0.1, width: 0.6, height: 0.1 }],
    ['a box taller than the page from its top edge', { left: 0.1, top: 0.95, width: 0.1, height: 0.1 }],
    ['a negative left', { left: -0.1, top: 0.1, width: 0.2, height: 0.1 }],
    ['a width above 1', { left: 0, top: 0, width: 1.5, height: 0.1 }],
    ['a missing height', { left: 0.1, top: 0.1, width: 0.2 }],
    ['points instead of fractions', { left: 400, top: 610, width: 70, height: 12 }],
    ['a number given as text', { left: '0.1', top: 0.1, width: 0.2, height: 0.1 }],
  ]
  for (const [label, box] of badBoxes) {
    test(`EV-5 a source box with ${label} is refused by the table and by records.ts`, async () => {
      const { db, w } = await freshWorld()
      await expectRefused(insert(db, 'facts', factWith(w, { source_box: box })))
      expect(FactRecordSchema.shape.source_box.safeParse(box).success).toBe(false)
    })
  }

  test('EV-5 the fixture box and the whole page are accepted by the table and by records.ts', async () => {
    const { db, w } = await freshWorld()
    const whole = { left: 0, top: 0, width: 1, height: 1 }
    await expectAccepted(insert(db, 'facts', factWith(w, { source_box: whole })))
    expect(FactRecordSchema.shape.source_box.safeParse(BOX).success).toBe(true)
    expect(FactRecordSchema.shape.source_box.safeParse(whole).success).toBe(true)
  })

  test('EV-5 property: the table, records.ts and F09 BoxSchema (with a page) accept exactly the same boxes', async () => {
    const db = await cloneTestDb()
    const w = await insertWorld(db)
    // eighths are exact in binary, so no case sits on a rounding edge
    const frac = fc.integer({ min: -2, max: 10 }).map((n) => n / 8)
    await fc.assert(
      fc.asyncProperty(fc.record({ left: frac, top: frac, width: frac, height: frac }), async (box) => {
        const f09 = BoxSchema.safeParse({ page: 1, ...box }).success
        expect(FactRecordSchema.shape.source_box.safeParse(box).success, JSON.stringify(box)).toBe(f09)
        const r = await refusalOf(insert(db, 'facts', factWith(w, { source_box: box })))
        if (f09) expect(r, `${JSON.stringify(box)} is a good box`).toBeUndefined()
        else expect(r?.code ?? 'accepted', `${JSON.stringify(box)} is a bad box`).toMatch(/^(23|P0001)/)
      }),
      { seed: 20261002, numRuns: 40 },
    )
  })
})

// ---------- 16. FLOW-1 ordering and licences ----------

describe('FLOW-1 the latest state event is decided by an identity sequence', () => {
  test('FLOW-1 state_events.seq is an identity column and returns carries current_state_event_id', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ t: string; c: string; ident: string; gen: string | null }>(
      `select table_name as t, column_name as c, is_identity as ident, identity_generation as gen
       from information_schema.columns
       where table_schema = 'returns'
         and ((table_name = 'state_events' and column_name = 'seq')
           or (table_name = 'returns' and column_name = 'current_state_event_id'))
       order by 1`,
    )
    expect(r.rows.map((x) => `${x.t}.${x.c}`)).toEqual(['returns.current_state_event_id', 'state_events.seq'])
    const seqCol = r.rows.find((x) => x.c === 'seq')
    expect(seqCol?.ident).toBe('YES')
    expect(seqCol?.gen).toBe('ALWAYS')
  })

  test("FLOW-1 two state events in one transaction, ids 'se-2' then 'se-10', move the return in order", async () => {
    const { db, w } = await freshWorld()
    const r = w.ids.returns
    const run = async (): Promise<void> => {
      await db.exec('begin')
      try {
        await moveTo(db, r, 'evidence')
        await stateEvent(db, r, 'evidence', 'gaps', { id: 'se-2' })
        await moveTo(db, r, 'gaps')
        await stateEvent(db, r, 'gaps', 'qa', { id: 'se-10' })
        await moveTo(db, r, 'qa')
        await db.exec('commit')
      } catch (e) {
        await db.exec('rollback')
        throw e
      }
    }
    await expectAccepted(run())
    expect(await count(db, 'returns', "id = $1 and state = 'qa'", [r])).toBe(1)
    expect(await count(db, 'returns', "id = $1 and current_state_event_id = 'se-10'", [r])).toBe(1)
  })

  test("FLOW-1 ids 'se-2' and 'se-10' with the same created_at resolve by insertion order", async () => {
    const { db, w } = await freshWorld()
    const r = w.ids.returns
    const same = '2030-01-01T00:00:00Z'
    await expectAccepted(moveTo(db, r, 'evidence'))
    await stateEvent(db, r, 'evidence', 'gaps', { id: 'se-2', created_at: same })
    await expectAccepted(moveTo(db, r, 'gaps'))
    await stateEvent(db, r, 'gaps', 'qa', { id: 'se-10', created_at: same })
    await expectAccepted(moveTo(db, r, 'qa'))
    expect(await count(db, 'returns', "id = $1 and state = 'qa'", [r])).toBe(1)
  })

  test('FLOW-1 a back-dated state event still licenses the next move', async () => {
    const { db, w } = await freshWorld()
    const r = w.ids.returns
    await expectAccepted(moveTo(db, r, 'evidence'))
    const back = await stateEvent(db, r, 'evidence', 'gaps', {
      created_at: '2020-01-01T00:00:00Z',
      occurred_at: '2020-01-01T00:00:00Z',
    })
    await expectAccepted(moveTo(db, r, 'gaps'))
    expect(await count(db, 'returns', "id = $1 and state = 'gaps' and current_state_event_id = $2", [r, back])).toBe(1)
  })

  test('FLOW-1 a future-dated old event does not license a later move', async () => {
    const { db, w } = await freshWorld()
    const r = tid()
    await insert(db, 'returns', { ...w.rows.returns, id: r, entity_name: 'Future dated (Test)' })
    await stateEvent(db, r, 'intake', 'evidence', { created_at: '2099-01-01T00:00:00Z' })
    await expectAccepted(moveTo(db, r, 'evidence'))
    await stateEvent(db, r, 'evidence', 'gaps')
    await expectAccepted(moveTo(db, r, 'gaps'))
    expect(await count(db, 'returns', "id = $1 and state = 'gaps'", [r])).toBe(1)
  })

  test('FLOW-1 one event licenses one move only, and current_state_event_id changes on every move', async () => {
    const { db, w } = await freshWorld()
    const r = w.ids.returns
    const first = w.ids.state_events
    await expectAccepted(moveTo(db, r, 'evidence'))
    expect(await count(db, 'returns', 'id = $1 and current_state_event_id = $2', [r, first])).toBe(1)
    const back = await stateEvent(db, r, 'evidence', 'intake')
    await expectAccepted(moveTo(db, r, 'intake'))
    expect(await count(db, 'returns', 'id = $1 and current_state_event_id = $2', [r, back])).toBe(1)
    // the first event (intake -> evidence) was used; it cannot move the return again
    await expectRefusedNaming(moveTo(db, r, 'evidence'), NO_LICENCE)
    await expectRefusedNaming(
      db.query('update returns.returns set state = $1, current_state_event_id = $2 where id = $3', ['evidence', first, r]),
      /no (matching|pending) state event|current_state_event_id/i,
    )
    expect(await count(db, 'returns', "id = $1 and state = 'intake'", [r])).toBe(1)
  })

  test('FLOW-1 a state event with a from or to state outside the 16 is refused', async () => {
    const { db, w } = await freshWorld()
    // round 3 (S6, S8): a return with no pending event, so the state list is the only reason
    const r = await freshReturn(db, w)
    await expectRefusedNaming(stateEvent(db, r, 'waiting_on_client', 'evidence'), /from_state|state_events_from/)
    await expectRefusedNaming(stateEvent(db, r, 'intake', 'waiting_on_client'), /to_state|state_events_to/)
    await expectRefusedNaming(stateEvent(db, r, 'Intake', 'evidence'), /from_state|state_events_from/)
    expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(0)
    await expectAccepted(stateEvent(db, r, 'intake', 'evidence'))
  })

  for (const s of STATES.filter((x) => x !== 'intake')) {
    test(`FLOW-1 a return inserted in state ${s} is refused (later states are reached through events)`, async () => {
      const { db, w } = await freshWorld()
      const id = tid()
      await expectRefusedNaming(
        insert(db, 'returns', { ...w.rows.returns, id, entity_name: 'Inserted late (Test)', state: s }),
        /intake|returns_state/,
      )
      expect(await count(db, 'returns', 'id = $1', [id])).toBe(0)
    })
  }
})

// ---------- 17. EV-1, FLOW-1 non-blank actor, reason, author ----------

describe('EV-1 FLOW-1 who and why are never blank', () => {
  // round 3: the eight blanks of the findings (one definition of blank), not only spaces
  const blanks = EIGHT_BLANKS
  const cases: readonly (readonly [Table, string])[] = [
    ['events', 'actor'],
    ['events', 'reason'],
    ['state_events', 'actor'],
    ['state_events', 'reason'],
    ['judgment_inputs', 'author'],
    ['judgment_inputs', 'reason'],
  ]
  for (const [t, col] of cases) {
    test(`EV-1 FLOW-1 a blank or all-space ${col} on ${t} is refused`, async () => {
      const { db, w } = await freshWorld()
      // round 3 (S8): a state event goes on a return with no pending event and a judgment input on
      // a new cell (version 1), so blankness is the only reason for a refusal
      const where = async (): Promise<Row> =>
        t === 'state_events' ? { return_id: await freshReturn(db, w) } : t === 'judgment_inputs' ? { cell_id: 'T2S8.' + tid() } : {}
      for (const b of blanks) {
        await expectRefusedNaming(insert(db, t, { ...w.rows[t], id: tid(), ...(await where()), [col]: b }), new RegExp(col))
      }
      expect(await count(db, t)).toBe(1)
      // control: the same row with a real name is accepted (a judgment input on another cell)
      const other: Row = t === 'judgment_inputs' ? { cell_id: 'T2S8.CCA.CLASS8' } : await where()
      await expectAccepted(insert(db, t, { ...w.rows[t], id: tid(), ...other, [col]: 'Someone (Test)' }))
    })
  }
})

// ---------- 18. ARC-10 stamps are non-blank scalars ----------

type StampValue = string | number | null | Record<string, never> | never[]
// The rule, written out: a non-empty object whose every value is a non-blank string or a number.
function isGoodStamp(v: Record<string, StampValue>): boolean {
  const vals = Object.values(v)
  return vals.length > 0 && vals.every((x) => (typeof x === 'string' && x.trim() !== '') || typeof x === 'number')
}

describe('ARC-10 a version stamp holds non-blank scalars, in SQL and zod alike', () => {
  const stamped = ['facts', 'figures', 'check_results'] as const
  const keyCol: Record<(typeof stamped)[number], string> = { facts: 'fact_key', figures: 'figure_key', check_results: 'check_id' }
  const zodOf = {
    facts: FactRecordSchema.shape.version_stamp,
    figures: FigureRecordSchema.shape.version_stamp,
    check_results: CheckResultRecordSchema.shape.version_stamp,
  }
  const bad: readonly (readonly [string, unknown])[] = [
    ['{}', {}],
    ['{"x":null}', { x: null }],
    ['{"x":""}', { x: '' }],
    ['{"x":"  "}', { x: '  ' }],
    ['{"x":{}}', { x: {} }],
    ['{"x":[]}', { x: [] }],
    ['a good key and a null', { reader: 'qbo-reader (Test)', x: null }],
  ]
  for (const t of stamped) {
    for (const [label, stamp] of bad) {
      test(`ARC-10 ${t} refuses the version stamp ${label}, and so does records.ts`, async () => {
        const { db, w } = await freshWorld()
        const id = tid()
        await expectRefused(insert(db, t, { ...w.rows[t], id, [keyCol[t]]: 'key-' + id, version_stamp: stamp }))
        expect(zodOf[t].safeParse(stamp).success).toBe(false)
        expect(VersionStampSchema.safeParse(stamp).success).toBe(false)
      })
    }
    test(`ARC-10 ${t} accepts a stamp of non-blank strings and numbers, and so does records.ts`, async () => {
      const { db, w } = await freshWorld()
      const stamp = { reader: 'qbo-reader (Test)', rule_version: 3 }
      const id = tid()
      await expectAccepted(insert(db, t, { ...w.rows[t], id, [keyCol[t]]: 'key-' + id, version_stamp: stamp }))
      expect(zodOf[t].safeParse(stamp).success).toBe(true)
    })
  }

  test('ARC-10 property: the table and records.ts accept exactly the stamps of non-blank scalars', async () => {
    const db = await cloneTestDb()
    const w = await insertWorld(db)
    const value = fc.oneof(
      fc.constantFrom<StampValue>('', '  ', null, {}, [], '1', 'v2 (Test)'),
      fc.integer({ min: 0, max: 99 }),
    )
    const stampArb = fc.dictionary(fc.constantFrom('reader', 'rule_version', 'model', 'x'), value, { maxKeys: 3, noNullPrototype: true })
    await fc.assert(
      fc.asyncProperty(stampArb, async (stamp) => {
        const good = isGoodStamp(stamp)
        expect(VersionStampSchema.safeParse(stamp).success, JSON.stringify(stamp)).toBe(good)
        const id = tid()
        const r = await refusalOf(insert(db, 'figures', { ...w.rows.figures, id, figure_key: 'key-' + id, version_stamp: stamp }))
        if (good) expect(r, `${JSON.stringify(stamp)} is a good stamp`).toBeUndefined()
        else expect(r?.code ?? 'accepted', `${JSON.stringify(stamp)} is a bad stamp`).toMatch(/^(23|P0001)/)
      }),
      { seed: 20261002, numRuns: 40 },
    )
  })
})

// ---------- 19. FLOW-4, EV-1 versions, not edits ----------

describe('FLOW-4 EV-1 facts, entries and judgment inputs change by a new version row', () => {
  test('FLOW-4 adjusting_entries and judgment_inputs carry version_no integer not null', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ t: string; ty: string; nullable: string }>(
      `select table_name as t, data_type as ty, is_nullable as nullable from information_schema.columns
       where table_schema = 'returns' and column_name = 'version_no'
         and table_name in ('adjusting_entries', 'judgment_inputs') order by 1`,
    )
    expect(r.rows).toEqual([
      { t: 'adjusting_entries', ty: 'integer', nullable: 'NO' },
      { t: 'judgment_inputs', ty: 'integer', nullable: 'NO' },
    ])
  })

  test('FLOW-4 a new version of an entry or a judgment input is a new row; the same version twice is refused', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(insert(db, 'adjusting_entries', { ...w.rows.adjusting_entries, id: tid(), version_no: 2, reason: 'Accrual corrected (Test)' }))
    await expectRefused(insert(db, 'adjusting_entries', { ...w.rows.adjusting_entries, id: tid(), version_no: 2 }))
    await expectAccepted(insert(db, 'judgment_inputs', { ...w.rows.judgment_inputs, id: tid(), version_no: 2, value: '4300' }))
    expect(await count(db, 'judgment_inputs', 'return_id = $1', [w.ids.returns])).toBe(2)
  })

  const factEdits: readonly (readonly [string, unknown])[] = [
    ['value', '99999.99'],
    ['fact_key', 'bank.chequing.opening_balance'],
    ['origin', 'client_said'],
    ['version_stamp', { reader: 'qbo-reader (Test)', reader_version: '0.0.2' }],
    ['version_no', 2],
  ]
  for (const [col, v] of factEdits) {
    test(`EV-1 FLOW-4 an in-place UPDATE of facts.${col} is refused and the fact is unchanged`, async () => {
      const { db, w } = await freshWorld()
      const val = v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      await expectRefused(db.query(`update returns.facts set ${col} = $1 where id = $2`, [val, w.ids.facts]))
      expect(await count(db, 'facts', "id = $1 and value = '12500.00' and version_no = 1 and origin = 'third_party'", [w.ids.facts])).toBe(1)
    })
  }

  test('EV-1 FLOW-4 the status of a fact may still change in place', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(db.query(`update returns.facts set status = 'preparer_verified' where id = $1`, [w.ids.facts]))
    expect(await count(db, 'facts', "id = $1 and status = 'preparer_verified'", [w.ids.facts])).toBe(1)
  })

  const entryEdits: readonly (readonly [string, unknown])[] = [
    ['reason', 'A different reason (Test)'],
    ['entry_type', 'reclass'],
    ['sources', ['Another note (Test)']],
    ['author', 'Someone else (Test)'],
    ['version_no', 2],
  ]
  for (const [col, v] of entryEdits) {
    test(`EV-1 FLOW-4 an in-place UPDATE of adjusting_entries.${col} is refused and the entry is unchanged`, async () => {
      const { db, w } = await freshWorld()
      const val = v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      await expectRefused(db.query(`update returns.adjusting_entries set ${col} = $1 where id = $2`, [val, w.ids.adjusting_entries]))
      expect(
        await count(db, 'adjusting_entries', "id = $1 and entry_type = 'accrual' and author = 'Preparer (Test)' and version_no = 1", [w.ids.adjusting_entries]),
      ).toBe(1)
    })
  }

  test('EV-1 FLOW-4 explained may still change on a balanced, complete entry', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w)
    await addLines(db, e, [250, -250])
    await expectAccepted(markExplained(db, e))
    expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [e])).toBe(1)
  })

  test('EV-1 a DELETE of a fact is refused and the fact stays', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(db.query('delete from returns.facts where id = $1', [w.ids.facts]))
    expect(await count(db, 'facts', 'id = $1', [w.ids.facts])).toBe(1)
  })

  test('EV-1 a DELETE of an adjusting entry (one with no lines) is refused and the entry stays', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w)
    await expectRefused(db.query('delete from returns.adjusting_entries where id = $1', [e]))
    expect(await count(db, 'adjusting_entries', 'id = $1', [e])).toBe(1)
  })

  test('EV-1 SEC-7 judgment inputs are append-only: UPDATE and DELETE are refused', async () => {
    const { db, w } = await freshWorld()
    const id = w.ids.judgment_inputs
    await expectRefused(db.query(`update returns.judgment_inputs set value = '1' where id = $1`, [id]), /append-only/i)
    await expectRefused(db.query(`update returns.judgment_inputs set is_test = false where id = $1`, [id]), /append-only/i)
    await expectRefused(db.query('delete from returns.judgment_inputs where id = $1', [id]), /append-only/i)
    expect(await count(db, 'judgment_inputs', "id = $1 and value = '4200' and is_test", [id])).toBe(1)
  })
})

// ======================= Round 3, the last (findings F01 r2: S1 to S7) =======================

// The value allow-list: the only text columns that may hold a blank (an empty cell is a value).
const VALUE_COLUMNS: readonly string[] = [
  'facts.value',
  'version_cells.value',
  'judgment_inputs.value',
  'figures.value',
  'differences.before_value',
  'differences.after_value',
]
// Set only by the move trigger and refused on insert whatever it holds: tested in records.ts only
// (check 16 covers the column itself).
const ZOD_ONLY: readonly string[] = ['returns.current_state_event_id']
// A column the fixture leaves to its default: the non-blank value to use as the control.
const CONTROL_OVERRIDE: Readonly<Record<string, string>> = { 'exceptions.status': 'open' }

interface FieldSchema {
  safeParse: (x: unknown) => { success: boolean }
}
const ZOD: Record<Table, { shape: Record<string, FieldSchema | undefined> }> = {
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

const P_SHEET = (w: World): Row => ({
  ...NO_SOURCE,
  source_document_id: w.ids.documents,
  source_sheet: 'Trial balance (Test)',
  source_row: 12,
  source_column: 'D',
})
const P_QBO: Row = { ...NO_SOURCE, source_qbo_snapshot_id: 'snap-0001', source_qbo_account_id: '35', source_qbo_txn_id: 'JE-0001' }
const P_REASON: Row = { ...NO_SOURCE, origin: 'judgment', source_reason: 'Half of the phone bill is personal (Test)' }

async function freshAccount(db: PGlite, w: World): Promise<string> {
  const id = tid()
  await insert(db, 'accounts', { ...w.rows.accounts, id, qbo_account_id: 'acct-' + id })
  return id
}

// Fresh, valid rows for a table (new ids and new keys, version 1 of a new version key, a state
// event on a return with no pending event), one per pointer shape where the table has several.
async function freshRows(db: PGlite, w: World, t: Table): Promise<Row[]> {
  const id = tid()
  switch (t) {
    case 'returns':
      return [{ ...w.rows.returns, id, entity_name: 'Fresh return (Test)' }]
    case 'versions':
      return [{ id, return_id: await freshReturn(db, w), version_no: 1 }]
    case 'version_cells':
      return [{ ...w.rows.version_cells, id, cell_id: 'T2S100.' + id }]
    case 'facts':
      return [
        factWith(w, {}),
        factWith(w, P_SHEET(w)),
        factWith(w, P_QBO),
        factWith(w, { ...NO_SOURCE, origin: 'client_said', source_client_answer_id: 'ca-0001' }),
        factWith(w, { ...NO_SOURCE, origin: 'third_party', source_cra_capture_id: 'cra-0001' }),
        factWith(w, { ...NO_SOURCE, origin: 'client_filed', source_prior_return_id: 'pr-0001' }),
        factWith(w, P_REASON),
      ]
    case 'accounts':
      return [{ ...w.rows.accounts, id, qbo_account_id: 'acct-' + id }]
    case 'gifi_mappings':
      return [{ ...w.rows.gifi_mappings, id, account_id: await freshAccount(db, w), mapping_version: 1 }]
    case 'adjusting_entries':
      return [{ ...w.rows.adjusting_entries, id, qbo_txn_id: 'JE-' + id }]
    case 'judgment_inputs':
      return [{ ...w.rows.judgment_inputs, id, cell_id: 'T2S8.' + id }]
    case 'figures':
      return [{ ...w.rows.figures, id, figure_key: 'key-' + id }]
    case 'state_events':
      return [{ ...w.rows.state_events, id, return_id: await freshReturn(db, w) }]
    case 'holds':
      return [{ ...w.rows.holds, id, reason: 'Waiting on the bank (Test)' }]
    case 'check_results':
      return [{ ...w.rows.check_results, id, check_id: 'CK-' + id }]
    case 'exceptions':
      return [{ ...w.rows.exceptions, id, status: 'open' }]
    default:
      return [{ ...w.rows[t], id }]
  }
}

// A fresh row in which column c holds a non-blank value, and that value (the control).
async function rowWith(db: PGlite, w: World, t: Table, c: string): Promise<{ row: Row; control: unknown }> {
  const rows = await freshRows(db, w, t)
  const hit = rows.find((r) => r[c] !== undefined && r[c] !== null)
  if (hit) return { row: hit, control: hit[c] }
  const base = rows[0] ?? {}
  return { row: base, control: CONTROL_OVERRIDE[`${t}.${c}`] ?? 'Control value (Test)' }
}

async function textColumns(db: PGlite, t: Table): Promise<string[]> {
  const r = await db.query<{ c: string }>(
    `select column_name as c from information_schema.columns
     where table_schema = 'returns' and table_name = $1 and data_type in ('text', 'character varying')
     order by ordinal_position`,
    [t],
  )
  return r.rows.map((x) => x.c)
}

const show = (s: string): string => JSON.stringify(s).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)

// ---------- 17 widened (S2): every text column outside the value list refuses a blank ----------

describe('EV-1 FLOW-1 every text column outside the value list refuses a blank, in SQL and zod alike', () => {
  for (const t of F01_TABLES) {
    test(`EV-1 FLOW-1 ARC-3 every text column of ${t} outside the value list refuses the eight blanks with 23514, and so does records.ts`, async () => {
      const { db, w } = await freshWorld()
      const cols = (await textColumns(db, t)).filter((c) => !VALUE_COLUMNS.includes(`${t}.${c}`))
      expect(cols, 'the catalog lists the id column at least').toContain('id')
      const problems: string[] = []
      for (const c of cols) {
        const field = ZOD[t].shape[c]
        if (!field) problems.push(`${t}.${c}: no field in records.ts`)
        for (const b of EIGHT_BLANKS) {
          if (field?.safeParse(b).success) problems.push(`${t}.${c} = ${show(b)}: records.ts accepts it`)
          if (ZOD_ONLY.includes(`${t}.${c}`)) continue
          const { row } = await rowWith(db, w, t, c)
          const r = await refusalOf(insert(db, t, { ...row, [c]: b }))
          if (r?.code !== '23514') problems.push(`${t}.${c} = ${show(b)}: ${r ? `${r.code} ${r.message}` : 'accepted'}`)
        }
        const { row, control } = await rowWith(db, w, t, c)
        if (field && !field.safeParse(control).success) problems.push(`${t}.${c}: records.ts refuses the control ${String(control)}`)
        if (ZOD_ONLY.includes(`${t}.${c}`)) continue
        const r = await refusalOf(insert(db, t, { ...row, [c]: control }))
        if (r) problems.push(`${t}.${c}: the control ${String(control)} is refused: ${r.code} ${r.message}`)
      }
      expect(problems).toEqual([])
    })
  }

  test('EV-1 the value columns keep an empty value (an empty cell is a value, RT-12)', async () => {
    const { db, w } = await freshWorld()
    const tables: readonly Table[] = ['facts', 'version_cells', 'judgment_inputs', 'figures', 'differences']
    for (const t of tables) {
      const { row } = await rowWith(db, w, t, 'id')
      const empty: Row = t === 'differences' ? { before_value: '', after_value: '' } : { value: '' }
      await expectAccepted(insert(db, t, { ...row, ...empty }))
    }
  })
})

// ---------- 14 widened (S4): explaining an entry needs real text everywhere ----------

describe('TB-2 explaining an adjusting entry is refused on any blank reason, source or pointer', () => {
  // The entry is never explained: either the row itself is refused (23514), or marking it explained is.
  async function expectNeverExplained(db: PGlite, w: World, over: Row): Promise<void> {
    const id = tid()
    const ins = await refusalOf(insert(db, 'adjusting_entries', { ...w.rows.adjusting_entries, id, qbo_txn_id: 'JE-' + id, ...over }))
    if (ins) {
      expect(ins.code, `${JSON.stringify(over)}: ${ins.message}`).toBe('23514')
      return
    }
    await addLines(db, id, [100, -100])
    await expectRefused(markExplained(db, id))
    expect(await count(db, 'adjusting_entries', 'id = $1 and explained', [id])).toBe(0)
  }

  const cases: readonly (readonly [string, Row])[] = [
    ['reason tab', { reason: '\t' }],
    ['reason NBSP and U+200B', { reason: ' ​' }],
    ['sources ["\\t"]', { sources: ['\t'] }],
    ['sources [" "]', { sources: [' '] }],
    ['sources [NBSP]', { sources: [' '] }],
    ['sources [U+2800]', { sources: ['⠀'] }],
    ['sources [{"x":""}]', { sources: [{ x: '' }] }],
    ['sources [{"x":null}]', { sources: [{ x: null }] }],
    ['sources [{"x":"\\t"}]', { sources: [{ x: '\t' }] }],
    ['sources with a good member and {"document_id":" "}', { sources: ['Landlord invoice 1042 (Test)', { document_id: ' ' }] }],
    ['a blank snapshot id', { qbo_snapshot_id: ' ' }],
    ['a blank transaction id', { qbo_txn_id: '\t' }],
    ['a blank author', { author: '　' }],
  ]
  for (const [label, over] of cases) {
    test(`TB-2 an adjusting entry with ${label} is never explained`, async () => {
      const { db, w } = await freshWorld()
      await expectNeverExplained(db, w, over)
    })
  }

  test('TB-2 a source object of non-blank strings and numbers is enough (control for the refusals above)', async () => {
    const { db, w } = await freshWorld()
    const e = await newEntry(db, w, { sources: [{ document_id: w.ids.documents, page: 1, note: 'Invoice 1042 (Test)' }] })
    await addLines(db, e, [100, -100])
    await expectAccepted(markExplained(db, e))
  })
})

describe('EV-5 a blank pointer id is not a source', () => {
  const blankPointers: readonly (readonly [string, Row])[] = [
    ['an empty client answer id', { ...NO_SOURCE, origin: 'client_said', source_client_answer_id: '' }],
    ['a blank QBO snapshot and account', { ...NO_SOURCE, source_qbo_snapshot_id: ' ', source_qbo_account_id: ' ' }],
    ['a real snapshot with a blank account', { ...NO_SOURCE, source_qbo_snapshot_id: 'snap-0001', source_qbo_account_id: '\t' }],
    ['a blank QBO transaction', { ...P_QBO, source_qbo_txn_id: '​' }],
    ['a tab CRA capture id', { ...NO_SOURCE, source_cra_capture_id: '\t' }],
    ['an NBSP prior return id', { ...NO_SOURCE, origin: 'client_filed', source_prior_return_id: ' ' }],
    ['a U+2800 reason', { ...NO_SOURCE, origin: 'judgment', source_reason: '⠀' }],
    ['a blank document id', { source_document_id: '　' }],
  ]
  for (const [label, over] of blankPointers) {
    test(`EV-5 a fact whose only pointer is ${label} is refused with 23514`, async () => {
      const { db, w } = await freshWorld()
      const r = await refusalOf(insert(db, 'facts', factWith(w, over)))
      expect(r?.code, r ? r.message : 'accepted').toBe('23514')
      expect(await count(db, 'facts')).toBe(1)
    })
  }
})

// ---------- 18 widened (S5): stamps with any blank value ----------

describe('ARC-10 a version stamp value made only of blank characters is refused, in SQL and zod alike', () => {
  const stamped = ['facts', 'figures', 'check_results'] as const
  const keyCol: Record<(typeof stamped)[number], string> = { facts: 'fact_key', figures: 'figure_key', check_results: 'check_id' }
  const blanks: readonly (readonly [string, string])[] = [
    ['tab', '\t'],
    ['NBSP', ' '],
    ['U+200B', '​'],
    ['U+2800', '⠀'],
    ['a newline and U+3000', '\n　'],
  ]
  for (const t of stamped) {
    for (const [label, x] of blanks) {
      test(`ARC-10 ${t} refuses the version stamp {"x": ${label}}, and so does records.ts`, async () => {
        const { db, w } = await freshWorld()
        const id = tid()
        await expectRefused(insert(db, t, { ...w.rows[t], id, [keyCol[t]]: 'key-' + id, version_stamp: { reader: 'qbo-reader (Test)', x } }))
        expect(ZOD[t].shape['version_stamp']?.safeParse({ x }).success).toBe(false)
        expect(VersionStampSchema.safeParse({ x }).success).toBe(false)
      })
    }
  }
})

// ---------- 20 (S3): every return_id is a foreign key ----------

describe('EV-5 ARC-3 every return_id points at a real return', () => {
  test('EV-5 ARC-3 every return_id column in schema returns is a foreign key to returns.returns(id) (catalog)', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ t: string; fk: boolean }>(
      `select c.relname as t,
              exists (select 1 from pg_constraint k
                      where k.conrelid = c.oid and k.contype = 'f'
                        and k.confrelid = 'returns.returns'::regclass and k.conkey = array[a.attnum]) as fk
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'returns' and c.relkind in ('r', 'p') and a.attname = 'return_id' and not a.attisdropped
       order by 1`,
    )
    const have = r.rows.map((x) => x.t)
    for (const t of [
      'documents', 'facts', 'accounts', 'gifi_mappings', 'adjusting_entries', 'judgment_inputs', 'figures',
      'versions', 'approvals', 'check_results', 'exceptions', 'differences', 'state_events', 'holds',
    ]) expect(have, t).toContain(t)
    expect(r.rows.filter((x) => !x.fk).map((x) => x.t)).toEqual([])
  })

  test('EV-5 ARC-3 a row whose return does not exist is refused in every table with return_id', async () => {
    const { db, w } = await freshWorld()
    const tables = F01_TABLES.filter((t) => t !== 'returns' && 'return_id' in w.rows[t])
    expect(tables.length).toBeGreaterThanOrEqual(14)
    const problems: string[] = []
    for (const t of tables) {
      const { row } = await rowWith(db, w, t, 'return_id')
      const r = await refusalOf(insert(db, t, { ...row, return_id: 'no-such-return (Test)' }))
      // a state event's trigger may refuse first (the return has no state), with 23514
      if (!r || !/^23(503|514)$/.test(r.code)) problems.push(`${t}: ${r ? `${r.code} ${r.message}` : 'accepted'}`)
    }
    expect(problems).toEqual([])
  })
})

// ---------- 16 widened (S6): FLOW-1 the caller cannot set the order or skip the state ----------

describe('FLOW-1 a state event follows the return: no caller-set seq, no stale or duplicate licence', () => {
  async function eventWithSeq(db: PGlite, r: string, seqValue: number | string, from = 'intake', to = 'evidence'): Promise<unknown> {
    return db.query(
      `insert into returns.state_events (id, seq, return_id, from_state, to_state, actor, occurred_at, reason)
       overriding system value values ($1, ${typeof seqValue === 'number' ? String(seqValue) : seqValue}, $2, $3, $4, $5, $6, $7)`,
      [tid(), r, from, to, 'Preparer (Test)', AT, 'Caller-set order (Test)'],
    )
  }

  test('FLOW-1 a state event with a caller-set seq (OVERRIDING SYSTEM VALUE, seq 999) is refused', async () => {
    const { db, w } = await freshWorld()
    const r = await freshReturn(db, w)
    await expectRefusedNaming(eventWithSeq(db, r, 999), /seq/i, /^23514$/)
    expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(0)
  })

  test('FLOW-1 a caller-set seq equal to the next number is refused too', async () => {
    const { db, w } = await freshWorld()
    const r = await freshReturn(db, w)
    await expectRefusedNaming(
      eventWithSeq(db, r, '(select coalesce(max(seq), 0) + 1 from returns.state_events)'),
      /seq/i,
      /^23514$/,
    )
    expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(0)
    // control: the same event with the sequence's own number is accepted and moves the return
    await expectAccepted(stateEvent(db, r, 'intake', 'evidence'))
    await expectAccepted(moveTo(db, r, 'evidence'))
  })

  test('FLOW-1 a state event from filed to closed is refused while the return is at evidence', async () => {
    const { db, w } = await freshWorld()
    const r = w.ids.returns
    await expectAccepted(moveTo(db, r, 'evidence'))
    await expectRefusedNaming(stateEvent(db, r, 'filed', 'closed'), /from_state/, /^23514$/)
    await expectRefusedNaming(stateEvent(db, r, 'intake', 'gaps'), /from_state/, /^23514$/)
    expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(1)
    await expectAccepted(stateEvent(db, r, 'evidence', 'gaps'))
  })

  test('FLOW-1 a second pending state event for a return is refused', async () => {
    const { db, w } = await freshWorld()
    const r = w.ids.returns
    // the fixture's intake -> evidence is pending (not yet used by a move)
    await expectRefusedNaming(stateEvent(db, r, 'intake', 'evidence'), /pending/i, /^23514$/)
    await expectRefusedNaming(stateEvent(db, r, 'intake', 'gaps'), /pending/i, /^23514$/)
    expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(1)
    // once it is used, the next event is accepted
    await expectAccepted(moveTo(db, r, 'evidence'))
    await expectAccepted(stateEvent(db, r, 'evidence', 'gaps'))
  })

  test('FLOW-1 a state event whose to_state equals its from_state is refused', async () => {
    const { db, w } = await freshWorld()
    const r = await freshReturn(db, w)
    await expectRefusedNaming(stateEvent(db, r, 'intake', 'intake'), /to_state/, /^23514$/)
    expect(await count(db, 'state_events', 'return_id = $1', [r])).toBe(0)
  })

  test('FLOW-1 property: a walk of random events moves the return only along licensed, pending events', async () => {
    const db = await cloneTestDb()
    const w = await insertWorld(db)
    const st = fc.constantFrom(...STATES)
    await fc.assert(
      fc.asyncProperty(fc.array(fc.record({ from: st, to: st, move: fc.boolean() }), { minLength: 1, maxLength: 8 }), async (steps) => {
        const r = await freshReturn(db, w)
        let state = 'intake'
        let pending: string | undefined
        for (const s of steps) {
          const ok = s.from === state && s.to !== s.from && pending === undefined
          const res = await refusalOf(stateEvent(db, r, s.from, s.to))
          expect(res === undefined, `event ${s.from} -> ${s.to} at ${state}, pending ${pending ?? 'none'}: ${res?.message ?? 'accepted'}`).toBe(ok)
          if (ok) pending = s.to
          if (s.move && pending !== undefined) {
            await expectAccepted(moveTo(db, r, pending))
            state = pending
            pending = undefined
          }
        }
        expect(await count(db, 'returns', 'id = $1 and state = $2', [r, state])).toBe(1)
      }),
      { seed: 20261005, numRuns: 30 },
    )
  }, 20_000)
})

// ---------- 20 (S7): version numbers start at 1 and go up by exactly one ----------

describe('FLOW-4 EV-1 a version number is the previous plus one', () => {
  type Versioned = 'facts' | 'adjusting_entries' | 'judgment_inputs' | 'versions' | 'gifi_mappings'
  const col: Record<Versioned, string> = {
    facts: 'version_no',
    adjusting_entries: 'version_no',
    judgment_inputs: 'version_no',
    versions: 'version_no',
    gifi_mappings: 'mapping_version',
  }
  // A new version key for the table, and a row of that key with a given number.
  async function newKey(db: PGlite, w: World, t: Versioned): Promise<(n: number) => Row> {
    const k = tid()
    switch (t) {
      case 'facts':
        return (n) => factWith(w, { fact_key: 'test.version.' + k, version_no: n })
      case 'adjusting_entries':
        return (n) => ({ ...w.rows.adjusting_entries, id: tid(), qbo_txn_id: 'JE-V-' + k, version_no: n })
      case 'judgment_inputs':
        return (n) => ({ ...w.rows.judgment_inputs, id: tid(), cell_id: 'T2S8.V.' + k, version_no: n })
      case 'versions': {
        const r = await freshReturn(db, w)
        return (n) => ({ id: tid(), return_id: r, version_no: n })
      }
      case 'gifi_mappings': {
        const a = await freshAccount(db, w)
        return (n) => ({ ...w.rows.gifi_mappings, id: tid(), account_id: a, mapping_version: n })
      }
    }
  }

  for (const t of Object.keys(col) as Versioned[]) {
    test(`FLOW-4 EV-1 ${t}.${col[t]} starts at 1: a first row numbered 2, 999, 0 or -1 is refused`, async () => {
      const { db, w } = await freshWorld()
      const row = await newKey(db, w, t)
      for (const n of [2, 999, 0, -1]) {
        await expectRefusedNaming(insert(db, t, row(n)), new RegExp(col[t]), /^23/)
      }
      await expectAccepted(insert(db, t, row(1)))
    })

    test(`FLOW-4 EV-1 ${t}.${col[t]} goes up by exactly one: a gap, 999, a repeat or a step back is refused`, async () => {
      const { db, w } = await freshWorld()
      const row = await newKey(db, w, t)
      await expectAccepted(insert(db, t, row(1)))
      for (const n of [3, 999, 1, 0]) {
        await expectRefusedNaming(insert(db, t, row(n)), new RegExp(col[t]), /^23/)
      }
      await expectAccepted(insert(db, t, row(2)))
      await expectRefusedNaming(insert(db, t, row(4)), new RegExp(col[t]), /^23/)
      await expectAccepted(insert(db, t, row(3)))
    })
  }

  test('FLOW-4 EV-1 numbering is per key: a new key starts at 1 again', async () => {
    const { db, w } = await freshWorld()
    for (const t of Object.keys(col) as Versioned[]) {
      const a = await newKey(db, w, t)
      await expectAccepted(insert(db, t, a(1)))
      await expectAccepted(insert(db, t, a(2)))
      const b = await newKey(db, w, t)
      await expectAccepted(insert(db, t, b(1)))
    }
  })
})

// ---------- S1: SQL returns.is_blank and text.ts isBlank are one definition ----------

describe('EV-1 FLOW-1 returns.is_blank and isBlank agree', () => {
  test('EV-1 returns.is_blank agrees with isBlank on every code point except U+0000 and the surrogates', async () => {
    const db = await cloneTestDb()
    const r = await db.query<{ cps: number[] | null }>(
      `select array_agg(n order by n) as cps from generate_series(1, 1114111) as n
       where (n < 55296 or n > 57343) and returns.is_blank(chr(n))`,
    )
    const sql = new Set(r.rows[0]?.cps ?? [])
    const disagree: string[] = []
    for (let cp = 1; cp <= 0x10ffff && disagree.length <= 20; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      if (isBlank(String.fromCodePoint(cp)) !== sql.has(cp)) disagree.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`)
    }
    expect(sql.size, 'some code points are blank').toBeGreaterThan(100)
    expect(disagree).toEqual([])
  }, 30_000)

  test('EV-1 mixed blanks are blank in SQL; one visible character among blanks, even a lone U+0301, is not', async () => {
    const db = await cloneTestDb()
    const sqlBlank = async (s: string): Promise<boolean | undefined> =>
      (await db.query<{ b: boolean }>('select returns.is_blank($1) as b', [s])).rows[0]?.b
    for (const s of ['', ' ', ' \t\n\r ​　⠀﻿͏ㅤ\u0085', '\u{E0001}\u{E0020}']) {
      expect(await sqlBlank(s), show(s)).toBe(true)
    }
    for (const s of ['́', ' ́ ', '⠀a', ' Preparer (Test)\t', '\u{1F600}', '⠁']) {
      expect(await sqlBlank(s), show(s)).toBe(false)
    }
  })

  test('EV-1 property: returns.is_blank and isBlank agree on strings of blanks with or without a visible character', async () => {
    const db = await cloneTestDb()
    const ch = fc.oneof(
      fc.constantFrom(' ', '\t', '\n', ' ', '​', '　', '⠀', '﻿', '͏', '­', '\u{E0001}', ' '),
      fc.constantFrom('a', '0', '́', '⠁', '\u{1F600}'),
      fc.integer({ min: 1, max: 0x10ffff - 0x800 }).map((n) => String.fromCodePoint(n >= 0xd800 ? n + 0x800 : n)),
    )
    await fc.assert(
      fc.asyncProperty(fc.array(ch, { maxLength: 8 }), async (chars) => {
        const s = chars.join('')
        const b = (await db.query<{ b: boolean }>('select returns.is_blank($1) as b', [s])).rows[0]?.b
        expect(b, show(s)).toBe(isBlank(s))
      }),
      { seed: 20261006, numRuns: 200 },
    )
  })
})
