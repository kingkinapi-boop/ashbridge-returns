// FX3 acceptance tests, the contract side (spec-writer; builders never edit this file).
// Card plan/cards/FX3.md: rule defects in landed code, found by SC. SC's own rules are the main tests
// (tools/test/schema-contract-rules.test.mjs and src/contracts/schema-rules.db.test.ts, with every FX3
// entry deleted from tools/test/__fixtures__/schema-contract/known.json). This file is the unit-project
// twin of what those db rules prove on the TypeScript side (findings A04, A391: mutation runs the unit
// project only), so a mutant in records.ts, jobs.ts or ids.ts is caught without a database.
//
// The shape these tests fix (amber, listed in reports/FX3-spec.md):
// - records.ts: ExceptionRecordSchema.status is a z.enum over a string list records.ts exports (SQL's
//   default 'open' among its values); records.ts also exports a list equal to jobs.ts JOB_STATUSES and
//   one equal to the client_handoff status list of bridge.ts (SC R15 finds a CHECK's list among the
//   exported records.ts lists).
// - records.ts: a *RecordSchema per table SC R42 found without one, paired by SC's naming rule.
//   returns.client_handoff is left out: no schema name maps to a table name that is not a plural (see the
//   spec report: a rule question for the Lead, not this card's to settle).
// - Every records.ts *RecordSchema refuses a stray key at the top level (SC R23 checks it at run time).
// - ids.ts exports FUTURE_POINTERS: 'table.column' -> text that starts with the id of a card in
//   plan/slices.json, for each pointer column SC R43 found pointing at no built table.
// - VersionStampSchema and sourcesAreReal refuse every number JS cannot read back as written: the
//   values JSON.parse gives for the round-up midpoint of the largest double, 1e-400 and 2^53 + 1 (SC R55).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import * as bridge from './bridge'
import * as ids from './ids'
import * as jobs from './jobs'
import * as records from './records'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

/** SC R42's naming rule (src/contracts/schema-rules.db.test.ts tableFor): FooBarRecordSchema pairs with foo_bars. */
function tableFor(schemaName: string): string {
  const snake = schemaName
    .replace(/RecordSchema$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
  return snake.endsWith('y') ? `${snake.slice(0, -1)}ies` : snake.endsWith('s') ? `${snake}es` : `${snake}s`
}

const recordExports = (): [string, z.ZodObject][] =>
  Object.entries(records as Record<string, unknown>)
    .filter(([name, v]) => name.endsWith('RecordSchema') && v instanceof z.ZodObject)
    .map(([name, v]) => [name, v as z.ZodObject])

/** Every exported list of strings in records.ts, by export name. */
function exportedLists(): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {}
  for (const [name, v] of Object.entries(records as Record<string, unknown>)) {
    if (!Array.isArray(v) || v.length === 0) continue
    const items: unknown[] = v
    if (items.every((x): x is string => typeof x === 'string')) out[name] = items
  }
  return out
}
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x))

describe('FX3 defect 2: records.ts exception status and status lists (EV-8, FLOW-1; SC R15)', () => {
  test('EV-8 FLOW-1 R15 ExceptionRecordSchema.status is an enum whose values are a list records.ts exports', () => {
    const status = records.ExceptionRecordSchema.shape.status as unknown
    expect(status, 'ExceptionRecordSchema.status is not a z.enum').toBeInstanceOf(z.ZodEnum)
    const options = (status as z.ZodEnum).options.map(String)
    expect(options.length).toBeGreaterThan(0)
    const lists = exportedLists()
    expect(Object.keys(lists).length, 'records.ts exports no string list').toBeGreaterThan(0)
    expect(Object.entries(lists).filter(([, l]) => sameSet(l, options)).map(([n]) => n), 'no records.ts list equals the status values').not.toEqual([])
  })

  test("EV-8 R15 an exception's status list holds 'open', the value the table gives a new exception", () => {
    const status = records.ExceptionRecordSchema.shape.status as unknown as z.ZodType
    expect(status.safeParse('open').success).toBe(true)
  })

  test('EV-8 R15 planted: an exception status outside the list, or blank, is refused', () => {
    const status = records.ExceptionRecordSchema.shape.status as unknown as z.ZodType
    for (const bad of ['not-a-value (Test)', 'Open', 'open ', '⠀', '']) {
      expect(status.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })

  test('FLOW-1 R15 records.ts exports a list equal to the job statuses of jobs.ts (the jobs.status CHECK)', () => {
    const want = [...jobs.JOB_STATUSES]
    expect(want.length).toBeGreaterThan(0)
    expect(Object.values(exportedLists()).some((l) => sameSet(l, want))).toBe(true)
  })

  test('FLOW-1 R15 records.ts exports a list equal to the client_handoff statuses of bridge.ts (the client_handoff.status CHECK)', () => {
    const status = bridge.BridgeHandoffRowSchema.shape.status
    const want = status.options.map(String)
    expect(want.length).toBeGreaterThan(0)
    expect(Object.values(exportedLists()).some((l) => sameSet(l, want))).toBe(true)
  })
})

describe('FX3 defect 2: a record schema for every table, and no stray key (EV-1, EV-5; SC R42, R23)', () => {
  // The tables SC R42 found with no record schema on main (known.json before this card), less client_handoff.
  const TABLES = ['bridge_ops_items', 'bridge_returns', 'client_refs', 'jobs', 'sign_in_events', 'staff_sessions', 'staff_users']

  test.each(TABLES)('EV-1 R42 records.ts exports a record schema SC pairs with returns.%s', (table) => {
    const paired = recordExports().filter(([name]) => tableFor(name) === table)
    expect(paired.map(([n]) => n), `no *RecordSchema in records.ts pairs with ${table}`).toHaveLength(1)
  })

  test('EV-5 R23 every records.ts record schema refuses a stray key at the top level (strict objects)', () => {
    const all = recordExports()
    expect(all.length).toBeGreaterThan(20)
    const loose = all
      .filter(([, s]) => {
        return !(s.def.catchall instanceof z.ZodNever)
      })
      .map(([n]) => n)
    expect(loose).toEqual([])
  })

  test('EV-5 R23 planted: a record that parses is refused once a stray key is added (ReturnRecordSchema)', () => {
    const row = {
      id: 'r-1 (Test)', created_at: new Date('2026-03-02T15:00:00.000Z'), is_test: true,
      entity_name: 'Riverdale Rentals Inc. (Test)', year_end: new Date('2025-12-31T00:00:00.000Z'), state: 'intake',
      current_state_event_id: null,
    }
    expect(records.ReturnRecordSchema.safeParse(row).success, 'the control row does not parse').toBe(true)
    expect(records.ReturnRecordSchema.safeParse({ ...row, strayKeyTest: 'x' }).success).toBe(false)
  })

  test('EV-5 R23 jobs.ts JobSchema refuses a stray key at the top level (a strict object)', () => {
    expect(jobs.JobSchema.def.catchall).toBeInstanceOf(z.ZodNever)
  })
})

describe('FX3 defect 1: FUTURE_POINTERS names the card for every pointer to an unbuilt table (EV-5; SC R43)', () => {
  // Every pointer column SC R43 found on main pointing at no built table (known.json before this card).
  // client_handoff.fact_id is left out: a table it seems to name exists (see the spec report).
  const POINTERS = [
    'accounts.qbo_snapshot_id', 'accounts.qbo_account_id', 'adjusting_entries.qbo_snapshot_id', 'adjusting_entries.qbo_txn_id',
    'bridge_ops_items.corporation_id', 'bridge_returns.corporation_id', 'bridge_returns.group_id', 'check_results.check_id',
    'client_handoff.corporation_id', 'client_handoff.engagement_id', 'client_handoff.item_id', 'client_handoff.recommendation_id',
    'client_handoff.reason_id', 'client_refs.corporation_id', 'differences.cell_id', 'entry_lines.qbo_account_id',
    'events.record_id', 'facts.source_qbo_snapshot_id', 'facts.source_qbo_account_id', 'facts.source_qbo_txn_id',
    'facts.source_client_answer_id', 'facts.source_cra_capture_id', 'facts.source_prior_return_id', 'figures.cell_id',
    'judgment_inputs.cell_id', 'links.from_id', 'links.to_id', 'version_cells.cell_id',
  ]
  const slices = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'plan', 'slices.json'), 'utf8')) as { cards: { id: string }[] }
  const CARDS = new Set(slices.cards.map((c) => c.id))
  const future = (): Record<string, unknown> => {
    const f = (ids as Record<string, unknown>)['FUTURE_POINTERS']
    return f !== null && typeof f === 'object' ? (f as Record<string, unknown>) : {}
  }

  test('EV-5 R43 ids.ts exports FUTURE_POINTERS, a frozen record', () => {
    const f = (ids as Record<string, unknown>)['FUTURE_POINTERS']
    expect(f, 'ids.ts exports no FUTURE_POINTERS').toBeTypeOf('object')
    expect(Object.isFrozen(f)).toBe(true)
  })

  test.each(POINTERS)('EV-5 R43 FUTURE_POINTERS names a card in plan/slices.json for %s', (key) => {
    const v = future()[key]
    expect(v, `no FUTURE_POINTERS entry for ${key}`).toBeTypeOf('string')
    const card = /^[A-Z][A-Z0-9]{1,4}\b/.exec(String(v))?.[0]
    expect(card, `${key}: ${JSON.stringify(v)} does not start with a card id`).toBeDefined()
    expect(CARDS.has(card ?? ''), `${key}: ${String(card)} is not a card in plan/slices.json`).toBe(true)
  })

  test('EV-5 R43 every FUTURE_POINTERS key is one table.column, and every value starts with a card in plan/slices.json', () => {
    const entries = Object.entries(future())
    expect(entries.length).toBeGreaterThanOrEqual(POINTERS.length)
    const bad = entries.filter(([k, v]) => {
      const card = /^[A-Z][A-Z0-9]{1,4}\b/.exec(typeof v === 'string' ? v : '')?.[0]
      return !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*_id$/.test(k) || card === undefined || !CARDS.has(card)
    })
    expect(bad).toEqual([])
  })

  test('EV-5 R43 planted: a pointer no card builds has no FUTURE_POINTERS entry', () => {
    expect(future()['facts.planted_widget_id']).toBeUndefined()
    expect(Object.keys(future()).some((k) => k.includes('(Test)'))).toBe(false)
  })
})

describe('FX3 defect 1: SQL and JS agree at the edge of a double (ARC-10; SC R55, the A367 landing rule)', () => {
  // The texts SC R55 found accepted by JS and refused by SQL, or accepted by both but read back changed.
  const EDGE = ['1.797693134862315807937e308', '-1.797693134862315807937e308', '1e-400', '9007199254740993']
  const stampOf = (n: string): unknown => JSON.parse(`{"x":${n}}`)

  test.each(EDGE)('ARC-10 R55 VersionStampSchema refuses the stamp {"x":%s} (JS cannot read it back as written)', (n) => {
    expect(records.VersionStampSchema.safeParse(stampOf(n)).success).toBe(false)
  })

  test.each(EDGE)('ARC-10 R55 sourcesAreReal refuses the source [{"x":%s}] (JS cannot read it back as written)', (n) => {
    expect(records.sourcesAreReal([stampOf(n)])).toBe(false)
  })

  test('ARC-10 R55 the values JS reads for those texts are the ones refused (0, the largest double, 2^53)', () => {
    expect(EDGE.map((n) => (stampOf(n) as { x: number }).x)).toEqual([Number.MAX_VALUE, -Number.MAX_VALUE, 0, 2 ** 53])
    for (const v of [Number.MAX_VALUE, -Number.MAX_VALUE, 0, 2 ** 53]) {
      expect(records.VersionStampSchema.safeParse({ x: v }).success, String(v)).toBe(false)
      expect(records.sourcesAreReal([{ x: v }]), String(v)).toBe(false)
    }
  })

  test('ARC-10 R55 control: a stamp and a source of non-blank text still pass', () => {
    expect(records.VersionStampSchema.safeParse({ catalogue: 'v1 (Test)' }).success).toBe(true)
    expect(records.sourcesAreReal(['statement page 1 (Test)', { page: 'statement page 2 (Test)' }])).toBe(true)
  })
})
