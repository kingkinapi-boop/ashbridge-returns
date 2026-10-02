// A07 acceptance tests: the .xlsx reader (EV-14), card checks 6 and 7. The public API is listed at the top of
// csv.acceptance.test.ts. Fixtures: __fixtures__/xlsx/, built by __fixtures__/make-fixtures.mjs, each with its
// expected cells as JSON.
import { isDeepStrictEqual } from 'node:util'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type CellPointer, type SheetResult } from '../../contracts/sheets'
import { createSheetsReader } from './index'
import { FIXTURES, expectedRefusal, expectedWorkbook, fixture, listing, sha256 } from './__fixtures__/harness'

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readXlsx(name: string): Promise<SheetResult> {
  const out = await createSheetsReader().read(fixture(`xlsx/${name}`), name)
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
const cellAt = (r: SheetResult, sheet: string, row: number, letter: string) =>
  r.sheets.find((s) => s.name === sheet)?.cells.find((c) => c.row === row && c.column.letter === letter)
const TB = 'Trial Balance (Test)'
const at = (r: SheetResult, sheet: string, row: number, column: string): CellPointer => ({
  fileFingerprint: r.fileFingerprint,
  sheet,
  row,
  column,
})

/** Each expected cell (from the fixture's JSON) that the result does not hold as expected, with what it holds instead. */
function cellProblems(r: SheetResult, name: string): string[] {
  const want = expectedWorkbook(name)
  return want.cells.flatMap((e) => {
    const { sheet, ...fields } = e
    const got = cellAt(r, sheet, e.row, e.column.letter)
    if (!got) return [`${sheet}!${e.column.letter}${String(e.row)} missing`]
    const picked = Object.fromEntries(Object.keys(fields).map((k) => [k, (got as Record<string, unknown>)[k]]))
    return isDeepStrictEqual(picked, fields)
      ? []
      : [`${sheet}!${e.column.letter}${String(e.row)}: want ${JSON.stringify(fields)}, got ${JSON.stringify(picked)}`]
  })
}

describe('A07 check 6: the .xlsx trial balance fixture', () => {
  test('EV-14 tb-1900.xlsx returns every expected cell: text, type, formula, hidden row and column, merged range', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(r.fileFingerprint).toBe(sha256(fixture('xlsx/tb-1900.xlsx')))
    expect(cellProblems(r, 'tb-1900')).toEqual([])
  })

  test('EV-14 the hidden sheet is listed as hidden with its cells, never dropped, in workbook order', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(r.sheets.map((s) => ({ name: s.name, hidden: s.hidden }))).toEqual(expectedWorkbook('tb-1900').sheets)
    expect(r.sheets.map((s) => s.hidden)).toEqual([false, true])
    expect(cellAt(r, 'Workings (Test)', 1, 'A')?.text).toBe('hidden workings (Test)')
  })

  test('EV-14 the hidden row and the hidden column are listed as hidden; their neighbours are not', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(cellAt(r, TB, 4, 'A')).toMatchObject({ text: '9999 Suspense (Test)', hiddenRow: true, hiddenColumn: false })
    expect(cellAt(r, TB, 3, 'A')).toMatchObject({ hiddenRow: false, hiddenColumn: false })
    expect(cellAt(r, TB, 3, 'D')).toMatchObject({ text: 'internal note (Test)', hiddenRow: false, hiddenColumn: true })
    expect(cellAt(r, TB, 5, 'C')).toMatchObject({ hiddenRow: false, hiddenColumn: false })
  })

  test('EV-14 the merged header range is on each merged cell (A1, B1, C1) and on no other cell', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    for (const letter of ['A', 'B', 'C']) expect(cellAt(r, TB, 1, letter)?.merged, letter).toBe('A1:C1')
    expect(cellAt(r, TB, 1, 'A')?.text).toBe('Maple Ridge (Test) trial balance')
    expect(cellAt(r, TB, 1, 'B')).toMatchObject({ text: '', type: 'empty' })
    const others = (r.sheets.find((s) => s.name === TB)?.cells ?? []).filter((c) => c.row !== 1 && c.merged !== null)
    expect(others).toEqual([])
  })

  test('EV-14 formula cells are marked as formulas and keep the cached value, never recalculated (a stale cache stays)', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(cellAt(r, TB, 6, 'B')).toMatchObject({ type: 'formula', formula: 'SUM(B3:B5)', text: '1244.56' })
    // B7 is B6-C6, which is 0; the file holds 5 and the reader keeps 5.
    expect(cellAt(r, TB, 7, 'B')).toMatchObject({ type: 'formula', formula: 'B6-C6', text: '5' })
  })

  test('EV-14 1900 date system: 2025-12-31, and either side of the 29 Feb 1900 quirk (serials 59 and 61), and serial 1', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(cellAt(r, TB, 8, 'B')).toMatchObject({ type: 'date', text: '2025-12-31' })
    expect(cellAt(r, TB, 9, 'B')).toMatchObject({ type: 'date', text: '1900-02-28' })
    expect(cellAt(r, TB, 10, 'B')).toMatchObject({ type: 'date', text: '1900-03-01' })
    expect(cellAt(r, TB, 11, 'B')).toMatchObject({ type: 'date', text: '1900-01-01' })
  })

  test('EV-14 1904 date system: tb-1904.xlsx returns 2025-01-01, 1904-01-01 and 1904-01-02', async () => {
    const r = await readXlsx('tb-1904.xlsx')
    expect(cellProblems(r, 'tb-1904')).toEqual([])
    expect(cellAt(r, 'Dates 1904 (Test)', 1, 'B')).toMatchObject({ type: 'date', text: '2025-01-01' })
    expect(cellAt(r, 'Dates 1904 (Test)', 2, 'B')).toMatchObject({ type: 'date', text: '1904-01-01' })
  })

  test('EV-14 numbers, a boolean and a leading-zero text cell come back with the type the file gave', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(cellAt(r, TB, 3, 'B')).toMatchObject({ type: 'number', text: '1234.56' })
    expect(cellAt(r, TB, 12, 'B')?.type).toBe('boolean')
    expect(cellAt(r, TB, 13, 'B')).toMatchObject({ type: 'text', text: '000123' })
  })

  test('EV-14 cellValueMatches finds a date cell by its ISO date and refuses the day before', async () => {
    const r = await readXlsx('tb-1900.xlsx')
    expect(cellValueMatches(r, at(r, TB, 8, 'B'), '2025-12-31')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(r, TB, 9, 'B'), '1900-02-28')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(r, TB, 9, 'B'), '1900-02-27')).toEqual({ ok: false, reason: 'value differs' })
  })
})

describe('A07 check 7: old .xls and password-protected files are refused', () => {
  const refusal = async (file: string, name: string) => {
    const before = listing(FIXTURES)
    const out = await createSheetsReader().read(fixture(`xlsx/${file}`), name)
    expect(listing(FIXTURES), 'nothing is written').toEqual(before)
    if (out.ok) throw new Error(`${name} was read, not refused`)
    return out.reason
  }

  test('EV-14 the password-protected .xlsx is refused with the reason "password-protected"', async () => {
    expect(expectedRefusal('protected').reason).toBe('password-protected')
    const reason = await refusal('protected.xlsx', 'protected.xlsx')
    expect(reason).toMatch(/password-protected/i)
    expect(reason, 'not a raw zip error').not.toMatch(/zip|central directory/i)
  })

  test('EV-14 the old .xls file is refused with the reason "old .xls format"', async () => {
    expect(expectedRefusal('old').reason).toBe('old .xls format')
    const reason = await refusal('old.xls', 'old.xls')
    expect(reason).toMatch(/old \.xls format/i)
  })

  test('EV-14 planted fault: an .xls renamed .xlsx is refused by its content as old .xls, not read and not a zip error', async () => {
    const reason = await refusal('old.xls', 'renamed (Test).xlsx')
    expect(reason).toMatch(/old \.xls format/i)
    expect(reason).not.toMatch(/zip|central directory/i)
  })

  test('EV-14 planted fault: the protected file renamed .xls is still refused as password-protected', async () => {
    const reason = await refusal('protected.xlsx', 'protected (Test).xls')
    expect(reason).toMatch(/password-protected/i)
  })
})
