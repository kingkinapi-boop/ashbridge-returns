// F01D acceptance tests, the zod side (spec-writer; builders never edit this file).
// Card plan/cards/F01D.md, spec points 2 and 3 (reports/F01C-check.md failures 3 and 4). The
// database side, the catalog sweep and the SQL parity are in records-closing.acceptance.db.test.ts.
//
// The shape these tests fix:
// - every zod number mirror of an SQL integer column (version_no on facts, adjusting entries,
//   judgment inputs and versions; gifi_mappings.mapping_version; facts.source_page and source_row)
//   refuses 2147483648 and accepts 2147483647, as SQL `integer` does;
// - VersionStampSchema and sourcesAreReal refuse the hostile sample set (as JSON.parse hands it to
//   records.ts: "__proto__" an own key, 1e400 as Infinity), never drop a key, and a stamp that
//   parses keeps every key it came with.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import {
  AdjustingEntryRecordSchema,
  CheckResultRecordSchema,
  FactRecordSchema,
  FigureRecordSchema,
  GifiMappingRecordSchema,
  JudgmentInputRecordSchema,
  VersionRecordSchema,
  VersionStampSchema,
  sourcesAreReal,
} from './records'

const INT4_MAX = 2147483647

interface FieldSchema {
  safeParse: (x: unknown) => { success: boolean; data?: unknown }
}
const field = (schema: { shape: Record<string, unknown> }, name: string): FieldSchema => {
  const f = schema.shape[name] as FieldSchema | undefined
  if (!f) throw new Error(`records.ts has no field ${name}`)
  return f
}

const INTEGER_FIELDS: readonly (readonly [string, FieldSchema])[] = [
  ['facts.version_no', field(FactRecordSchema, 'version_no')],
  ['adjusting_entries.version_no', field(AdjustingEntryRecordSchema, 'version_no')],
  ['judgment_inputs.version_no', field(JudgmentInputRecordSchema, 'version_no')],
  ['versions.version_no', field(VersionRecordSchema, 'version_no')],
  ['gifi_mappings.mapping_version', field(GifiMappingRecordSchema, 'mapping_version')],
  ['facts.source_page', field(FactRecordSchema, 'source_page')],
  ['facts.source_row', field(FactRecordSchema, 'source_row')],
]

describe('FLOW-4 EV-5 EV-14 zod mirrors SQL integer bounds', () => {
  for (const [name, f] of INTEGER_FIELDS) {
    test(`FLOW-4 EV-5 records.ts ${name} refuses 2147483648 and anything above, as SQL integer does`, () => {
      for (const v of [INT4_MAX + 1, 2 ** 32, Number.MAX_SAFE_INTEGER]) {
        expect(f.safeParse(v).success, `${name} = ${String(v)}`).toBe(false)
      }
    })
    test(`FLOW-4 EV-5 records.ts ${name} accepts 2147483647, the largest SQL integer (control)`, () => {
      expect(f.safeParse(INT4_MAX).success, name).toBe(true)
    })
    test(`FLOW-4 EV-5 property: records.ts ${name} accepts a whole number exactly when it is from 1 to 2147483647`, () => {
      fc.assert(
        fc.property(fc.integer({ min: -(2 ** 33), max: 2 ** 33 }), (v) => {
          expect(f.safeParse(v).success).toBe(v >= 1 && v <= INT4_MAX)
        }),
        { seed: 20261002, numRuns: 300 },
      )
    })
  }
})

// The shared hostile sample set as JSON text (the db file holds the same list and checks SQL agrees).
const HOSTILE: readonly string[] = [
  '{"__proto__":"v1"}',
  '{"__proto__":"v1","b":"v"}',
  '{"a":1e400}',
  '{"a":-1e400}',
]

const STAMP_FIELDS: readonly (readonly [string, FieldSchema])[] = [
  ['VersionStampSchema', VersionStampSchema],
  ['facts.version_stamp', field(FactRecordSchema, 'version_stamp')],
  ['figures.version_stamp', field(FigureRecordSchema, 'version_stamp')],
  ['check_results.version_stamp', field(CheckResultRecordSchema, 'version_stamp')],
]

describe('ARC-10 TB-2 records.ts refuses the hostile stamps and sources and never drops a key', () => {
  for (const h of HOSTILE) {
    test(`ARC-10 every version stamp field refuses ${h}`, () => {
      for (const [name, f] of STAMP_FIELDS) expect(f.safeParse(JSON.parse(h)).success, name).toBe(false)
    })
    test(`TB-2 sourcesAreReal refuses a source member ${h}, alone or beside a good one`, () => {
      expect(sourcesAreReal(JSON.parse(`[${h}]`) as unknown[])).toBe(false)
      expect(sourcesAreReal(JSON.parse(`["Kite fabric invoice 77 (Test)", ${h}]`) as unknown[])).toBe(false)
    })
  }

  test('ARC-10 {"__proto__":"v1","b":"v"} is refused rather than parsed with the __proto__ key dropped', () => {
    const r = VersionStampSchema.safeParse(JSON.parse('{"__proto__":"v1","b":"v"}'))
    expect(r.success).toBe(false)
  })

  test('ARC-10 control: a good stamp parses with every key kept, constructor and toString included', () => {
    const input = JSON.parse('{"reader":"qbo-reader (Test)","constructor":"v1","toString":"v2","rule_version":3}') as object
    const r = VersionStampSchema.safeParse(input)
    expect(r.success).toBe(true)
    expect(Object.keys(r.data ?? {}).sort()).toEqual(['constructor', 'reader', 'rule_version', 'toString'])
    expect(r.data).toMatchObject({ reader: 'qbo-reader (Test)', constructor: 'v1', toString: 'v2', rule_version: 3 })
  })

  test('ARC-10 property: a stamp that parses keeps exactly the keys it came with', () => {
    const key = fc.constantFrom('reader', 'rule_version', 'model', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__')
    const value = fc.constantFrom('"v1"', '3', '1e400', '"qbo-reader (Test)"')
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(key, value), { minLength: 1, maxLength: 4, selector: ([k]) => k }), (pairs) => {
        const json = `{${pairs.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(',')}}`
        const r = VersionStampSchema.safeParse(JSON.parse(json))
        const hostile = pairs.some(([k, v]) => k === '__proto__' || v === '1e400')
        expect(r.success, json).toBe(!hostile)
        if (r.success) expect(Object.keys(r.data).sort(), json).toEqual(pairs.map(([k]) => k).sort())
      }),
      { seed: 20261002, numRuns: 300 },
    )
  })
})
