// A07D class D3 acceptance tests: a number cell's text at the edges of the doubles (reports/A07C-findings.md, "Acceptance
// tests for A07D", D3; RC3). Each test fails on A07C's landed head b80c251.
//
// Input domain (RC0: stated, then generated over). Every finite double a number cell can store: positive and negative,
// zero and negative zero, subnormals (5e-324 up), normals up to 1.7976931348623157e+308, each stored in <v> as Excel writes
// it (the shortest round-trip text, exponent in capitals). NaN and the infinities cannot be stored as a number literal.
// The text of such a cell is either the double's own number (the text reads back to the same double) or, within 4 ulps of a
// whole cent and never as far as a quarter cent, that cent amount; a nonzero double never reads "0"; the text never
// carries more significant digits than the double's shortest round-trip text.
//
// Spec choices (amber, see the A07D spec report):
//   S7. "Its own text" for 1e21 and up and for subnormals is the shortest round-trip text, lower-case exponent ("1e+23",
//       "5e-324"), as String(x) gives it. A SUM total of 1e21 or more reads String(total), never a digit expansion.
//   S8. Kept from A07C (inside its rule, not a defect): terms 1e13, -1e13 and 0.01 with a stale cached 0.014 read "0.01".
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type Cell, type SheetResult } from '../../contracts/sheets'
import { SHEET as SUM_SHEET, sumXlsx } from './__fixtures__/a07c'
import { stored } from './__fixtures__/a07d'
import { numbersXlsx } from './__fixtures__/harness'
import { createSheetsReader } from './index'

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

const NUMBERS = 'Numbers (Test)'
async function readBytes(bytes: Uint8Array): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, 'numbers.xlsx')
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
const columnA = (r: SheetResult, sheet: string): Cell[] =>
  (r.sheets.find((s) => s.name === sheet)?.cells ?? []).filter((c) => c.column.letter === 'A').sort((a, b) => a.row - b.row)

/** Reads each double as a column-A number cell and returns the cells' texts in order. */
async function texts(values: number[]): Promise<string[]> {
  const r = await readBytes(numbersXlsx(values.map(stored)))
  const cells = columnA(r, NUMBERS)
  expect(cells.map((c) => c.type)).toEqual(values.map(() => 'number'))
  return cells.map((c) => c.text)
}

/** One unit in the last place of x (the gap to the next double away from zero); written here, not imported. */
function ulpOf(x: number): number {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, Math.abs(x))
  view.setBigInt64(0, view.getBigInt64(0) + 1n)
  return view.getFloat64(0) - Math.abs(x)
}
/** Significant digits of a number text: sign, point, exponent, leading and trailing zeros left out ("1e+23" is 1, "0" is 0). */
function significant(text: string): number {
  const mantissa = text.replace(/^[+-]/, '').split(/[eE]/)[0] as string
  return mantissa.replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
}
/** True when y is the double nearest some whole cent amount. */
const isCent = (y: number): boolean => Number.isInteger(y) || Math.round(y * 100) / 100 === y

/** The D3 rule for one double and the text its cell gave, as a list of what is wrong (empty when it holds). */
function problems(x: number, text: string): string[] {
  const out: string[] = []
  const y = Number(text)
  if (text.trim() === '' || Number.isNaN(y)) return [`${String(x)} read ${JSON.stringify(text)}, not a number`]
  const same = y === x
  const cent = isCent(y) && Math.abs(x - y) <= Math.min(0.0025, 4 * ulpOf(Math.max(Math.abs(x), Math.abs(y))))
  if (!same && !cent) out.push(`${String(x)} read ${text}: neither the same double nor a cent within 4 ulps`)
  if (x !== 0 && y === 0) out.push(`${String(x)} read ${text}: a nonzero value read as zero`)
  if (significant(text) > significant(String(x))) out.push(`${String(x)} read ${text}: ${String(significant(text))} digits, more than ${String(significant(String(x)))}`)
  return out
}

describe('A07D D3: number text at the edges of the doubles (EV-14, EV-6)', () => {
  test('EV-14 1E+23 reads "1e+23", 1E+300 reads "1e+300", and the rest of the band from 1e21 up reads its own text', async () => {
    const values = [1e23, 1e300, -1e23, 1e21, 2.5e21, 1.2345678901234569e23, 1.7976931348623157e308, -1.7976931348623157e308]
    expect(await texts(values)).toEqual(values.map((x) => String(x)))
    expect(await texts([1e23, 1e300])).toEqual(['1e+23', '1e+300'])
  })

  test('EV-14 5e-324 and 1e-310 read as their own text, never "0"; the smallest normal and its neighbours too', async () => {
    const values = [5e-324, 1e-310, -5e-324, 1e-323, 2.2250738585072014e-308, 2.225073858507201e-308, -1e-310]
    const got = await texts(values)
    expect(got).toEqual(values.map((x) => String(x)))
    expect(got.slice(0, 2)).toEqual(['5e-324', '1e-310'])
    expect(got).not.toContain('0')
  })

  test('EV-6 planted fault: a citation of "0" against a stored 5e-324 differs; a citation of "1e+23" against a stored 1E+23 matches as text', async () => {
    const r = await readBytes(numbersXlsx(['5E-324', '1E+23']))
    const at = (row: number): { fileFingerprint: string; sheet: string; row: number; column: string } => ({ fileFingerprint: r.fileFingerprint, sheet: NUMBERS, row, column: 'A' })
    expect(cellValueMatches(r, at(1), '0')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, at(2), '1e+23')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(2), '99999999999999991611392')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-14 a SUM total of 1e21 or more reads String(total), terms too; the A07C cancellation case still reads "0.01"', async () => {
    const big = await readBytes(sumXlsx(['1E+21', '2E+21'], '3E+21'))
    const [t1, t2, total] = columnA(big, SUM_SHEET)
    expect([t1?.text, t2?.text]).toEqual(['1e+21', '2e+21'])
    expect(total).toMatchObject({ type: 'formula', formula: 'SUM(A1:A2)', text: '3e+21', cached: { type: 'number', text: '3e+21' } })
    const huge = await readBytes(sumXlsx(['1E+23', '1'], '1E+23'))
    expect(columnA(huge, SUM_SHEET)[2]).toMatchObject({ text: '1e+23', cached: { type: 'number', text: '1e+23' } })
    // Kept: the stale 0.014 is within the sum's own rounding at 1e13 (capped at half a cent), so it reads as the cent total.
    const cancel = await readBytes(sumXlsx(['10000000000000', '-10000000000000', '0.01'], '0.014'))
    expect(columnA(cancel, SUM_SHEET)[3]?.text).toBe('0.01')
  })
})

describe('A07D D3 property: every double (EV-14)', () => {
  test(
    'EV-14 property (seed 20261014): over every finite double (subnormals and both zeros included) the text maps back to the double or to a cent within 4 ulps, never reads "0" when nonzero, and never invents digits',
    { timeout: 60_000 },
    async () => {
      const anyDouble = fc.double({ noNaN: true, noDefaultInfinity: true })
      // Every band, weighted so that each is drawn often: the whole range, subnormals, the money band, and 1e15 to 1e300.
      const banded = fc.oneof(
        anyDouble,
        fc.double({ min: -Number.MIN_VALUE * 2 ** 52, max: Number.MIN_VALUE * 2 ** 52, noNaN: true }),
        fc.integer({ min: -100_000_000_000, max: 100_000_000_000 }).map((n) => n / 100 + (n % 7) * ulpOf(n / 100)),
        fc.double({ min: 1e15, max: 1e300, noNaN: true }),
      )
      await fc.assert(
        fc.asyncProperty(fc.array(banded, { minLength: 1, maxLength: 300 }), async (values) => {
          const got = await texts(values)
          const wrong = values.flatMap((x, i) => problems(x, got[i] as string))
          expect(wrong).toEqual([])
        }),
        { seed: 20261014, numRuns: 60 },
      )
    },
  )
})
