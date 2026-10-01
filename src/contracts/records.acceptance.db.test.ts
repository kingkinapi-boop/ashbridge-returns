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
//   version_cells, approvals, entry_lines.
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from '../core/clock'
import { cloneTestDb } from '../core/db'
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
    entity_name: 'Maple Grove Dental Professional Corporation (Test)',
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
    source_box: { x0: 400, y0: 610, x1: 470, y1: 622 } as unknown as FactRecord['source_box'],
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
    const e2 = await newEntry(db, w, { reason: '   ' })
    await addLines(db, e2, [100, -100])
    await expectRefused(markExplained(db, e2))
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

describe('FLOW-1 a return has exactly one state and every change is an event', () => {
  test('FLOW-1 a return with no state is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'returns', { ...w.rows.returns, id: tid(), state: null }))
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

  test('FLOW-1 a state outside blueprint 02 is refused; every listed state is accepted', async () => {
    const { db, w } = await freshWorld()
    for (const s of STATES) await expectAccepted(insert(db, 'returns', { ...w.rows.returns, id: tid(), entity_name: 'Return ' + s + ' (Test)', state: s }))
    await expectRefused(insert(db, 'returns', { ...w.rows.returns, id: tid(), entity_name: 'Waiting (Test)', state: 'waiting_on_client' }))
  })

  test('FLOW-1 a second current state for the same return is refused (one row per return)', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'returns', { ...w.rows.returns, state: 'evidence' }))
    expect(await count(db, 'returns', 'id = $1', [w.ids.returns])).toBe(1)
  })

  test('FLOW-1 a state change with no event is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(moveTo(db, w.ids.returns, 'gaps'))
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
    await expectRefused(moveTo(db, w.ids.returns, 'gaps'))
  })

  for (const missing of ['actor', 'occurred_at', 'from_state', 'to_state', 'reason']) {
    test(`FLOW-1 a state event with no ${missing} is refused`, async () => {
      const { db, w } = await freshWorld()
      await expectRefused(insert(db, 'state_events', { ...w.rows.state_events, id: tid(), [missing]: null }))
    })
  }

  test('FLOW-1 a complete state event is accepted (control for the refusals above)', async () => {
    const { db, w } = await freshWorld()
    await expectAccepted(
      insert(db, 'state_events', { ...w.rows.state_events, id: tid(), from_state: 'evidence', to_state: 'gaps' }),
    )
  })

  test('FLOW-1 a state event with a blank reason is refused', async () => {
    const { db, w } = await freshWorld()
    await expectRefused(insert(db, 'state_events', { ...w.rows.state_events, id: tid(), reason: '  ' }))
  })
})

// ---------- 12. types and tables agree ----------

describe('records.ts and the tables agree', () => {
  test('ARC-3 one row inserts into every F01 table from a typed record object', async () => {
    const { db } = await freshWorld()
    for (const t of F01_TABLES) expect(await count(db, t), t).toBe(1)
  })

  test('ARC-3 the F01 schema files alone create exactly the F01 tables', async () => {
    const dir = path.resolve(process.cwd(), 'db/schema')
    const db = new PGlite()
    for (const f of F01_FILES) {
      const file = path.join(dir, f)
      expect(fs.existsSync(file), `db/schema/${f} exists`).toBe(true)
      await db.exec(fs.readFileSync(file, 'utf8'))
    }
    expect(await tablesIn(db, 'returns')).toEqual([...F01_TABLES].sort())
    await insertWorld(db)
    await db.close()
  })

})
