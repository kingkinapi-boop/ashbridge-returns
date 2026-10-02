// @mutate
// One definition of "blank" (F01 round 3, EV-1). A string is blank when it is made only of
// White_Space, Cc, Cf or Default_Ignorable_Code_Point characters, or U+2800 (the braille blank).
// The empty string is blank. The SQL function returns.is_blank (db/schema/00_schema.sql) holds
// the same table; the F01 acceptance test compares the two on every code point.
import { z } from 'zod'

/** Inclusive code point ranges, generated once under Node 24 (Unicode 16) from the rule above. */
export const BLANK_RANGES: readonly (readonly [number, number])[] = Object.freeze([
  [0x0, 0x20], [0x7f, 0xa0], [0xad, 0xad], [0x34f, 0x34f],
  [0x600, 0x605], [0x61c, 0x61c], [0x6dd, 0x6dd], [0x70f, 0x70f],
  [0x890, 0x891], [0x8e2, 0x8e2], [0x115f, 0x1160], [0x1680, 0x1680],
  [0x17b4, 0x17b5], [0x180b, 0x180f], [0x2000, 0x200f], [0x2028, 0x202f],
  [0x205f, 0x206f], [0x2800, 0x2800], [0x3000, 0x3000], [0x3164, 0x3164],
  [0xfe00, 0xfe0f], [0xfeff, 0xfeff], [0xffa0, 0xffa0], [0xfff0, 0xfffb],
  [0x110bd, 0x110bd], [0x110cd, 0x110cd], [0x13430, 0x1343f], [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a], [0xe0000, 0xe0fff],
] as const)

const hex = (cp: number): string => `\\u{${cp.toString(16)}}`
// One compiled pattern, built on first use: the check runs over every code point in the tests.
let compiled: RegExp | undefined
const blankPattern = (): RegExp =>
  (compiled ??= new RegExp(`^[${BLANK_RANGES.map(([lo, hi]) => `${hex(lo)}-${hex(hi)}`).join('')}]*$`, 'u'))

/** True when s holds no visible character. A lone surrogate is not blank. */
export function isBlank(s: string): boolean {
  return blankPattern().test(s)
}

/** A string with at least one visible character; kept exactly as given (no trimming). */
export const NonBlankSchema = z.string().refine((s) => !isBlank(s), { message: 'must not be blank' })

/**
 * The text columns where an empty value is a value (RT-12), keyed 'table.column', each with the
 * reason it may be blank. The one list: the schema marks these columns with a VALUE_COLUMN comment
 * (db/schema) and the rule tests compare the two.
 */
export const VALUE_COLUMNS: Readonly<Record<string, string>> = Object.freeze({
  'differences.after_value': 'a cell can be empty after the change',
  'differences.before_value': 'a cell can be empty before the change',
  'facts.value': 'an empty cell is a fact: the source cell was empty',
  'figures.value': 'a computed figure can be empty',
  'judgment_inputs.value': 'a preparer can set a cell to empty',
  'version_cells.value': 'a frozen cell can be empty',
})
