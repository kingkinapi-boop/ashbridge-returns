import { describe, expect, test } from 'vitest'
import * as ids from './ids'
import * as records from './records'
import { FactRecordSchema, ReturnStateSchema, VersionStampSchema } from './records'

test('ARC-10 a version stamp must be a non-empty object', () => {
  expect(VersionStampSchema.safeParse({}).success).toBe(false)
  expect(VersionStampSchema.safeParse({ reader: 'qbo-reader (Test)' }).success).toBe(true)
})

test('FLOW-1 a state outside blueprint 02 is not a ReturnState', () => {
  expect(ReturnStateSchema.safeParse('waiting_on_client').success).toBe(false)
  expect(ReturnStateSchema.safeParse('closed').success).toBe(true)
})

test('EV-10 a fact record refuses an origin outside the five', () => {
  expect(FactRecordSchema.shape.origin.safeParse('ai').success).toBe(false)
})

// ---------- shape tests: every record schema accepts a good row and refuses a broken one ----------

const D = new Date('2026-01-15T00:00:00Z')
const base = { created_at: D, is_test: true }
const STAMP = { reader: 'qbo-reader (Test)', rule_version: 3 }
const BOX = { left: 0.1, top: 0.2, width: 0.3, height: 0.1 }

const good: Record<string, [{ parse: (x: unknown) => unknown; safeParse: (x: unknown) => { success: boolean } }, Record<string, unknown>]> = {
  Return: [records.ReturnRecordSchema, { id: 'r1', ...base, entity_name: 'X (Test)', year_end: D, state: 'intake', current_state_event_id: null }],
  Document: [records.DocumentRecordSchema, { id: 'd1', ...base, return_id: 'r1', fingerprint: 'f', file_name: 'a.pdf' }],
  Version: [records.VersionRecordSchema, { id: 'v1', ...base, return_id: 'r1', version_no: 1 }],
  VersionCell: [records.VersionCellRecordSchema, { id: 'vc1', ...base, version_id: 'v1', cell_id: 'c', value: null }],
  Approval: [records.ApprovalRecordSchema, { id: 'a1', ...base, return_id: 'r1', version_id: 'v1', approved_by: 'p', fingerprint: 'f' }],
  Event: [records.EventRecordSchema, { id: 'e1', ...base, record_table: 'facts', record_id: 'f1', actor: 'p', occurred_at: D, from_value: null, to_value: { a: 1 }, reason: 'why' }],
  Fact: [records.FactRecordSchema, {
    id: 'f1', ...base, return_id: 'r1', fact_key: 'k', version_no: 1, value: '1', source_document_id: 'd1', source_page: 1,
    source_box: BOX, source_sheet: null, source_row: null, source_column: null, source_qbo_snapshot_id: null,
    source_qbo_account_id: null, source_qbo_txn_id: null, source_client_answer_id: null, source_cra_capture_id: null,
    source_prior_return_id: null, source_reason: null, origin: 'third_party', method: 'ocr', status: 'proposed', version_stamp: STAMP,
  }],
  Link: [records.LinkRecordSchema, { id: 'l1', ...base, kind: 'k', from_table: 'a', from_id: '1', to_table: 'b', to_id: '2' }],
  Account: [records.AccountRecordSchema, { id: 'ac1', ...base, return_id: 'r1', qbo_snapshot_id: 's', qbo_account_id: '35', name: 'n', balance_cents: 100 }],
  GifiMapping: [records.GifiMappingRecordSchema, { id: 'g1', ...base, return_id: 'r1', account_id: 'ac1', mapping_version: 1, gifi_code: '1001' }],
  AdjustingEntry: [records.AdjustingEntryRecordSchema, {
    id: 'ae1', ...base, return_id: 'r1', qbo_snapshot_id: 's', qbo_txn_id: 't', entry_type: 'accrual', reason: 'r',
    sources: ['s'], author: 'p', explained: false, version_no: 1,
  }],
  EntryLine: [records.EntryLineRecordSchema, { id: 'el1', ...base, entry_id: 'ae1', qbo_account_id: '35', amount_cents: -5 }],
  JudgmentInput: [records.JudgmentInputRecordSchema, { id: 'j1', ...base, return_id: 'r1', cell_id: 'c', value: '1', author: 'p', reason: 'r', version_no: 1 }],
  Figure: [records.FigureRecordSchema, { id: 'fg1', ...base, return_id: 'r1', figure_key: 'k', cell_id: null, value: null, version_stamp: STAMP }],
  StateEvent: [records.StateEventRecordSchema, { id: 'se1', ...base, seq: 1, return_id: 'r1', from_state: 'intake', to_state: 'evidence', actor: 'p', occurred_at: D, reason: 'r' }],
  Hold: [records.HoldRecordSchema, { id: 'h1', ...base, return_id: 'r1', holder: 'p', taken_at: D, released_at: null, reason: null }],
  CheckResult: [records.CheckResultRecordSchema, { id: 'cr1', ...base, return_id: 'r1', check_id: 'CK-20', outcome: 'pass', version_stamp: STAMP }],
  Exception: [records.ExceptionRecordSchema, { id: 'x1', ...base, return_id: 'r1', check_result_id: 'cr1', amount_cents: null, tax_effect_cents: 5, status: 'open' }],
  Answer: [records.AnswerRecordSchema, { id: 'an1', ...base, exception_id: 'x1', author: 'p', answer: 'a' }],
  Difference: [records.DifferenceRecordSchema, { id: 'df1', ...base, return_id: 'r1', cell_id: 'c', before_value: null, after_value: '2' }],
  Lesson: [records.LessonRecordSchema, { id: 'ls1', ...base, difference_id: 'df1', summary: 's' }],
}

describe('records.ts every schema matches its row', () => {
  for (const [name, [schema, row]] of Object.entries(good)) {
    test(`EV-1 ${name} accepts a good row`, () => {
      expect(schema.safeParse(row).success).toBe(true)
    })
    test(`EV-1 ${name} refuses {} and a row with any column missing or of the wrong type`, () => {
      expect(schema.safeParse({}).success).toBe(false)
      for (const key of Object.keys(row)) {
        const rest = Object.fromEntries(Object.entries(row).filter(([k]) => k !== key))
        expect(schema.safeParse(rest).success, `${name} without ${key}`).toBe(false)
        // from_value and to_value hold any JSON, so no value is the wrong type for them
        if (name === 'Event' && (key === 'from_value' || key === 'to_value')) continue
        expect(schema.safeParse({ ...row, [key]: Symbol('wrong') }).success, `${name} ${key} wrong type`).toBe(false)
      }
    })
  }

  test('EV-1 every id kind refuses an empty id and accepts a text id', () => {
    const kinds = Object.entries(ids).filter(([k]) => k.endsWith('IdSchema'))
    expect(kinds).toHaveLength(21)
    for (const [k, s] of kinds) {
      const schema = s as unknown as { safeParse: (x: unknown) => { success: boolean } }
      expect(schema.safeParse('').success, k).toBe(false)
      expect(schema.safeParse('x').success, k).toBe(true)
      expect(schema.safeParse(1).success, k).toBe(false)
    }
  })

  test('FLOW-4 adjusting entries and judgment inputs need a version_no', () => {
    for (const name of ['AdjustingEntry', 'JudgmentInput']) {
      const [schema, row] = good[name] ?? []
      expect(schema?.safeParse({ ...row, version_no: 'one' }).success).toBe(false)
      expect(schema?.safeParse({ ...row, version_no: 1.5 }).success).toBe(false)
    }
  })
})

describe('ARC-10 the version stamp holds non-blank strings or numbers', () => {
  const ok = (v: unknown): boolean => records.VersionStampSchema.safeParse(v).success
  test('ARC-10 accepts strings and numbers, refuses blanks, null, objects, arrays and an empty stamp', () => {
    expect(ok({ a: 'x' })).toBe(true)
    expect(ok({ a: 0 })).toBe(true)
    expect(ok({ a: ' x ' })).toBe(true)
    expect(ok({ a: '' })).toBe(false)
    expect(ok({ a: ' ' })).toBe(false)
    expect(ok({ a: '\t\n' })).toBe(false)
    expect(ok({ a: null })).toBe(false)
    expect(ok({ a: {} })).toBe(false)
    expect(ok({ a: [] })).toBe(false)
    expect(ok({ a: true })).toBe(false)
    expect(ok({ a: 'x', b: '' })).toBe(false)
    expect(ok({})).toBe(false)
    expect(ok(null)).toBe(false)
    expect(ok([])).toBe(false)
  })
})

describe('EV-5 the source box is F09 Box without the page', () => {
  const ok = (v: unknown): boolean => records.SourceBoxSchema.safeParse(v).success
  test('EV-5 accepts the whole page and a normal box', () => {
    expect(ok({ left: 0, top: 0, width: 1, height: 1 })).toBe(true)
    expect(ok(BOX)).toBe(true)
  })
  test('EV-5 refuses a box off the page, with a missing or extra key, or with the old shape', () => {
    expect(ok({ left: 0.5, top: 0, width: 0.6, height: 0.1 })).toBe(false)
    expect(ok({ left: 0, top: 0.95, width: 0.1, height: 0.1 })).toBe(false)
    expect(ok({ left: -0.1, top: 0, width: 0.1, height: 0.1 })).toBe(false)
    expect(ok({ left: 0, top: 0, width: 0.1 })).toBe(false)
    expect(ok({ ...BOX, page: 1 })).toBe(false)
    expect(ok({ x0: 1, y0: 1, x1: 2, y1: 2 })).toBe(false)
    expect(ok(null)).toBe(false)
  })
  test('EV-5 says why a box off the page is refused', () => {
    const r = records.SourceBoxSchema.safeParse({ left: 0.5, top: 0, width: 0.6, height: 0.1 })
    expect(r.error?.issues.map((i) => i.message)).toEqual(['box runs off the page'])
  })
})

describe('the state, origin, status and entry type lists', () => {
  test('FLOW-1 EV-10 EV-8 TB-2 each list is exactly the blueprint list', () => {
    expect(records.RETURN_STATES).toHaveLength(16)
    expect(records.RETURN_STATES[0]).toBe('intake')
    expect(records.RETURN_STATES[15]).toBe('closed')
    expect([...records.ORIGINS]).toEqual(['third_party', 'client_filed', 'client_prepared', 'client_said', 'judgment'])
    expect([...records.FACT_STATUSES]).toEqual(['proposed', 'preparer_verified', 'cpa_accepted'])
    expect([...records.ENTRY_TYPES]).toEqual(['reclass', 'accrual', 'allocation', 'estimate', 'correction'])
    const [schema, row] = good['CheckResult'] ?? []
    for (const o of ['pass', 'fail', 'flag']) expect(schema?.safeParse({ ...row, outcome: o }).success).toBe(true)
    expect(schema?.safeParse({ ...row, outcome: 'other' }).success).toBe(false)
  })
})

// ---------- F01C: the zod mirrors of the SQL rules ----------

describe('TB-2 sourcesAreReal mirrors returns.sources_are_real', () => {
  const real: unknown[][] = [
    ['Invoice 1042 (Test)'],
    [{ document_id: 'd1' }],
    [{ page: 3, document_id: 'd1' }],
    ['Invoice (Test)', { row: 4 }],
  ]
  const notReal: unknown[][] = [
    [], [''], [' '], [null], [{}], [{ x: '' }], [{ x: null }], [{ x: true }], [{ x: {} }], [{ x: [] }],
    [{ x: 'ok', y: '' }], [{ ' ': 'x' }], [{ '': 'x' }], [{ '\t': 'x' }], [[]], [['Invoice']], [3], [true],
    ['Invoice (Test)', { document_id: ' ' }],
  ]
  for (const s of real) test(`TB-2 ${JSON.stringify(s)} is real`, () => { expect(records.sourcesAreReal(s)).toBe(true); })
  for (const s of notReal) test(`TB-2 ${JSON.stringify(s)} is not real`, () => { expect(records.sourcesAreReal(s)).toBe(false); })
})

describe('TB-2 an explained entry record needs real sources', () => {
  const entry = (sources: unknown[], explained: boolean): unknown => ({
    ...good['AdjustingEntry']?.[1], sources, explained,
  })
  test('TB-2 explained with no real source is refused and the issue names sources', () => {
    const r = records.AdjustingEntryRecordSchema.safeParse(entry([], true))
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['sources'])
    expect(r.error?.issues[0]?.message).toBe('an explained entry needs real sources')
  })
  test('TB-2 explained with a real source parses; unexplained holds any array', () => {
    expect(records.AdjustingEntryRecordSchema.safeParse(entry(['Invoice (Test)'], true)).success).toBe(true)
    expect(records.AdjustingEntryRecordSchema.safeParse(entry([], false)).success).toBe(true)
    expect(records.AdjustingEntryRecordSchema.safeParse(entry([null], false)).success).toBe(true)
  })
})

test('ARC-10 a version stamp key is never blank', () => {
  expect(VersionStampSchema.safeParse({ ' ': 'v1' }).success).toBe(false)
  expect(VersionStampSchema.safeParse({ reader: 'a', '\t': 'v1' }).success).toBe(false)
})
