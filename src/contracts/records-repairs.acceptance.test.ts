// F01C acceptance tests, the zod side (spec-writer; builders never edit this file).
// Card plan/cards/F01C.md, spec points 3 and 4 (reports/F01-check.md round 3, risks 3 and 4).
//
// The shape these tests fix:
// - zod mirrors SQL on numbers: version_no (facts, adjusting entries, judgment inputs, versions) and
//   gifi_mappings.mapping_version are whole numbers from 1; facts.source_page and source_row are
//   whole numbers from 1 or null (SQL facts_pointer_values).
// - The value allow-list (the text columns where an empty value is a value, RT-12) lives in one
//   place: src/contracts/text.ts exports VALUE_COLUMNS, an object keyed 'table.column' whose value
//   is the reason that column may hold a blank (amber: the export name and shape are this spec's
//   choice; SC R13 reads it). The db side (records-repairs.acceptance.db.test.ts) checks that the
//   tables agree with it and that no schema file keeps its own copy.
import { describe, expect, test } from 'vitest'
import {
  AdjustingEntryRecordSchema,
  FactRecordSchema,
  GifiMappingRecordSchema,
  JudgmentInputRecordSchema,
  VersionRecordSchema,
} from './records'
import * as text from './text'
import { isBlank } from './text'

interface FieldSchema {
  safeParse: (x: unknown) => { success: boolean }
}
const field = (schema: { shape: Record<string, unknown> }, name: string): FieldSchema => {
  const f = schema.shape[name] as FieldSchema | undefined
  if (!f) throw new Error(`records.ts has no field ${name}`)
  return f
}

const VERSION_FIELDS: readonly (readonly [string, FieldSchema])[] = [
  ['facts.version_no', field(FactRecordSchema, 'version_no')],
  ['adjusting_entries.version_no', field(AdjustingEntryRecordSchema, 'version_no')],
  ['judgment_inputs.version_no', field(JudgmentInputRecordSchema, 'version_no')],
  ['versions.version_no', field(VersionRecordSchema, 'version_no')],
  ['gifi_mappings.mapping_version', field(GifiMappingRecordSchema, 'mapping_version')],
]

describe('FLOW-4 EV-1 zod mirrors SQL on version numbers', () => {
  for (const [name, f] of VERSION_FIELDS) {
    test(`FLOW-4 EV-1 records.ts ${name} refuses 0, -1, -999 and 1.5, as SQL does`, () => {
      for (const n of [0, -1, -999, 1.5]) expect(f.safeParse(n).success, `${name} = ${String(n)}`).toBe(false)
    })
    test(`FLOW-4 EV-1 records.ts ${name} accepts 1, 2 and 999 (control)`, () => {
      for (const n of [1, 2, 999]) expect(f.safeParse(n).success, `${name} = ${String(n)}`).toBe(true)
    })
  }
})

describe('EV-5 EV-14 zod mirrors SQL on a fact source page and row', () => {
  for (const name of ['source_page', 'source_row'] as const) {
    const f = field(FactRecordSchema, name)
    test(`EV-5 EV-14 records.ts facts.${name} refuses 0, -1 and 2.5, as facts_pointer_values does`, () => {
      for (const n of [0, -1, 2.5]) expect(f.safeParse(n).success, `${name} = ${String(n)}`).toBe(false)
    })
    test(`EV-5 EV-14 records.ts facts.${name} accepts 1, 40 and null (control)`, () => {
      for (const n of [1, 40, null]) expect(f.safeParse(n).success, `${name} = ${String(n)}`).toBe(true)
    })
  }
})

// The six value columns of F01 (reports/findings-F01-r2.md, card decisions).
const SIX = [
  'differences.after_value',
  'differences.before_value',
  'facts.value',
  'figures.value',
  'judgment_inputs.value',
  'version_cells.value',
]

describe('EV-1 RT-12 the value allow-list lives in text.ts with reasons', () => {
  test('EV-1 RT-12 text.ts exports VALUE_COLUMNS naming exactly the six F01 value columns', () => {
    const list = (text as Record<string, unknown>)['VALUE_COLUMNS']
    expect(list, 'text.ts exports VALUE_COLUMNS').toBeTypeOf('object')
    expect(Object.keys(list ?? {}).sort()).toEqual(SIX)
  })
  test('EV-1 RT-12 every VALUE_COLUMNS entry gives a non-blank reason', () => {
    const list = ((text as Record<string, unknown>)['VALUE_COLUMNS'] ?? {}) as Record<string, unknown>
    expect(Object.keys(list).length, 'text.ts exports VALUE_COLUMNS').toBeGreaterThan(0)
    for (const [k, reason] of Object.entries(list)) {
      expect(typeof reason === 'string' && !isBlank(reason), `${k} has a reason`).toBe(true)
    }
  })
  test('EV-1 RT-12 VALUE_COLUMNS is frozen: a caller cannot widen the allow-list at run time', () => {
    const list = (text as Record<string, unknown>)['VALUE_COLUMNS']
    expect(list, 'text.ts exports VALUE_COLUMNS').toBeTypeOf('object')
    expect(Object.isFrozen(list)).toBe(true)
  })
})
