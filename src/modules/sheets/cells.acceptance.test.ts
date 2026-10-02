// A07 acceptance tests: cell pointers, the cell check and the result schema (EV-5, EV-6, ARC-10), card checks 4, 5
// and 8, plus the adapter shape and "same bytes, same result". The public API is listed at the top of
// csv.acceptance.test.ts.
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { CellPointerSchema, SheetResultSchema, cellValueMatches, type CellPointer, type SheetResult } from '../../contracts/sheets'
import { createSheetsReader } from './index'
import { XLSX_LIBRARY } from './xlsx/index'
import { fixture, sha256 } from './__fixtures__/harness'

const PINNED = '2026-10-02T09:00:00-04:00'
let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock(PINNED))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array, fileName: string): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, fileName)
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
const readFixture = (rel: string): Promise<SheetResult> => readBytes(fixture(rel), rel.split('/').pop() ?? rel)
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
const TB = 'Trial Balance (Test)'
const ptr = (r: SheetResult, sheet: string, row: number, column: string): CellPointer => ({
  fileFingerprint: r.fileFingerprint,
  sheet,
  row,
  column,
})
const clone = (r: SheetResult): Record<string, unknown> => JSON.parse(JSON.stringify(r)) as Record<string, unknown>

describe('A07 check 4: pointers (EV-5)', () => {
  test('EV-5 a pointer is file fingerprint, sheet, row and column; a well-formed one passes the schema', () => {
    const ok = CellPointerSchema.safeParse({ fileFingerprint: 'a'.repeat(64), sheet: 'csv', row: 2, column: 'C' })
    expect(ok.success).toBe(true)
  })

  test('EV-5 a pointer without a sheet name, with a blank sheet name, row 0 or no column is refused by the schema', () => {
    const base = { fileFingerprint: 'a'.repeat(64), sheet: 'csv', row: 2, column: 'C' }
    const omit = (key: string): Record<string, unknown> => Object.fromEntries(Object.entries(base).filter(([k]) => k !== key))
    expect(CellPointerSchema.safeParse(omit('sheet')).success).toBe(false)
    expect(CellPointerSchema.safeParse({ ...base, sheet: '' }).success).toBe(false)
    expect(CellPointerSchema.safeParse({ ...base, sheet: '   ' }).success).toBe(false)
    expect(CellPointerSchema.safeParse({ ...base, row: 0 }).success).toBe(false)
    expect(CellPointerSchema.safeParse({ ...base, row: 2.5 }).success).toBe(false)
    expect(CellPointerSchema.safeParse(omit('column')).success).toBe(false)
    expect(CellPointerSchema.safeParse(omit('fileFingerprint')).success).toBe(false)
  })

  test('EV-5 a pointer to a sheet, row or column that does not exist is refused with "no such cell"', async () => {
    const x = await readFixture('xlsx/tb-1900.xlsx')
    const none = { ok: false, reason: 'no such cell' }
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '1234.56')).toEqual({ ok: true })
    expect(cellValueMatches(x, ptr(x, 'Nope (Test)', 3, 'B'), '1234.56')).toEqual(none)
    expect(cellValueMatches(x, ptr(x, TB, 999, 'B'), '1234.56')).toEqual(none)
    expect(cellValueMatches(x, ptr(x, TB, 3, 'ZZ'), '1234.56')).toEqual(none)
    const c = await readFixture('c01/lakeview-chequing-4821.csv')
    expect(cellValueMatches(c, ptr(c, 'csv', 2, 'C'), '282.50')).toEqual({ ok: true })
    expect(cellValueMatches(c, ptr(c, 'Sheet1', 2, 'C'), '282.50')).toEqual(none)
    expect(cellValueMatches(c, ptr(c, 'csv', 563, 'C'), '282.50')).toEqual(none)
    expect(cellValueMatches(c, ptr(c, 'csv', 2, 'F'), '282.50')).toEqual(none)
  })

  test("EV-5 planted fault: a pointer carrying another file's fingerprint is refused with \"no such cell\"", async () => {
    const c = await readFixture('c01/lakeview-chequing-4821.csv')
    const other = sha256(fixture('c01/aurora-business-card-7712.csv'))
    expect(cellValueMatches(c, { fileFingerprint: other, sheet: 'csv', row: 2, column: 'C' }, '282.50')).toEqual({
      ok: false,
      reason: 'no such cell',
    })
  })
})

describe('A07 check 5: cellValueMatches (EV-6 for cells)', () => {
  test('EV-6 "$1,234.56" matches a cell storing 1234.56; 1234.57 is refused with "value differs" (xlsx and csv)', async () => {
    const x = await readFixture('xlsx/tb-1900.xlsx')
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '$1,234.56')).toEqual({ ok: true })
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '1234.56')).toEqual({ ok: true })
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '1234.57')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '$1,234.57')).toEqual({ ok: false, reason: 'value differs' })
    const c = await readBytes(utf8('Amount,Payee\n1234.56,STORE (Test)\n'), 'amount.csv')
    expect(cellValueMatches(c, ptr(c, 'csv', 2, 'A'), '$1,234.56')).toEqual({ ok: true })
    expect(cellValueMatches(c, ptr(c, 'csv', 2, 'A'), '1234.57')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-6 planted fault: the right digits with the wrong sign are refused', async () => {
    const x = await readFixture('xlsx/tb-1900.xlsx')
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '(1,234.56)')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(x, ptr(x, TB, 3, 'B'), '-1234.56')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-6 the formula cell is judged by its cached value, and a difference says so in the reason', async () => {
    const x = await readFixture('xlsx/tb-1900.xlsx')
    expect(cellValueMatches(x, ptr(x, TB, 6, 'B'), '$1,244.56')).toEqual({ ok: true })
    expect(cellValueMatches(x, ptr(x, TB, 6, 'B'), '1,244.57')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    // The stale cache: B7 holds 5 though B6-C6 is 0. The cached 5 matches; the recalculated 0 does not.
    expect(cellValueMatches(x, ptr(x, TB, 7, 'B'), '5.00')).toEqual({ ok: true })
    expect(cellValueMatches(x, ptr(x, TB, 7, 'B'), '0')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-6 text is trimmed and case-folded; part of a cell is not the cell', async () => {
    const c = await readFixture('c01/lakeview-chequing-4821.csv')
    expect(cellValueMatches(c, ptr(c, 'csv', 3, 'B'), 'POS PURCHASE AMAZON.CA')).toEqual({ ok: true })
    expect(cellValueMatches(c, ptr(c, 'csv', 3, 'B'), '  pos purchase amazon.ca ')).toEqual({ ok: true })
    expect(cellValueMatches(c, ptr(c, 'csv', 3, 'B'), 'POS PURCHASE AMAZON')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(c, ptr(c, 'csv', 3, 'B'), 'AMAZON.CA')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-6 an empty cell is refused with "empty cell" whatever the value', async () => {
    const x = await readFixture('xlsx/tb-1900.xlsx')
    expect(cellValueMatches(x, ptr(x, TB, 1, 'B'), '')).toEqual({ ok: false, reason: 'empty cell' })
    expect(cellValueMatches(x, ptr(x, TB, 1, 'B'), 'Maple Ridge (Test) trial balance')).toEqual({ ok: false, reason: 'empty cell' })
  })
})

describe('A07 check 8: the result schema carries the engine (ARC-10)', () => {
  test('ARC-10 a CSV and an xlsx result pass the schema with a non-blank engine name and version and readAt from the clock', async () => {
    for (const r of [await readFixture('c01/lakeview-chequing-4821.csv'), await readFixture('xlsx/tb-1900.xlsx')]) {
      expect(SheetResultSchema.safeParse(r).success).toBe(true)
      expect(r.engine.name.trim()).not.toBe('')
      expect(r.engine.version.trim()).not.toBe('')
      expect(new Date(r.readAt).getTime()).toBe(new Date(PINNED).getTime())
    }
  })

  test('ARC-10 the xlsx result names the version of the library that read it', async () => {
    const x = await readFixture('xlsx/tb-1900.xlsx')
    expect(`${x.engine.name} ${x.engine.version}`).toContain(XLSX_LIBRARY.version)
  })

  test('ARC-10 a result without an engine, without a name or version, or with a blank one is refused by the schema', async () => {
    const r = await readFixture('c01/lakeview-chequing-4821.csv')
    const engine = r.engine
    const without = (patch: (o: Record<string, unknown>) => void): boolean => {
      const o = clone(r)
      patch(o)
      return SheetResultSchema.safeParse(o).success
    }
    expect(without(() => undefined)).toBe(true)
    expect(without((o) => delete o['engine'])).toBe(false)
    expect(without((o) => (o['engine'] = { version: engine.version }))).toBe(false)
    expect(without((o) => (o['engine'] = { name: engine.name }))).toBe(false)
    expect(without((o) => (o['engine'] = { name: '  ', version: engine.version }))).toBe(false)
    expect(without((o) => (o['engine'] = { name: engine.name, version: '' }))).toBe(false)
  })
})

describe('A07 the adapter and the fingerprint cache', () => {
  test('END-8 the reader is local work: it has a name and isLive is false', () => {
    const reader = createSheetsReader()
    expect(reader.name.trim()).not.toBe('')
    expect(reader.isLive).toBe(false)
  })

  test('EV-14 same bytes, same result: a second read of the same bytes, later, returns the first result', async () => {
    const reader = createSheetsReader()
    const bytes = fixture('xlsx/tb-1900.xlsx')
    const first = await reader.read(bytes, 'tb-1900.xlsx')
    setClock(fixedClock('2026-10-03T09:00:00-04:00'))
    const second = await reader.read(bytes, 'tb-1900.xlsx')
    expect(second).toEqual(first)
    const other = await reader.read(fixture('xlsx/tb-1904.xlsx'), 'tb-1904.xlsx')
    if (!other.ok || !first.ok) throw new Error('refused')
    expect(other.result.fileFingerprint).not.toBe(first.result.fileFingerprint)
    expect(new Date(other.result.readAt).getTime()).toBe(new Date('2026-10-03T09:00:00-04:00').getTime())
  })
})
