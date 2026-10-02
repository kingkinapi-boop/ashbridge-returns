import { describe, expect, test } from 'vitest'
import { CellPointerSchema, SheetResultSchema, cellValueMatches, columnLetter, type SheetResult } from './sheets'

const FP = 'a'.repeat(64)
const cell = (row: number, letter: string, text: string, type: 'text' | 'empty' | 'formula' = 'text') => ({
  row,
  column: { letter, number: letter.length === 1 ? letter.charCodeAt(0) - 64 : 27 },
  text,
  type,
  hiddenRow: false,
  hiddenColumn: false,
  merged: null,
})
const result = (cells: ReturnType<typeof cell>[]): SheetResult =>
  SheetResultSchema.parse({
    fileFingerprint: FP,
    engine: { name: 'test-engine', version: '1' },
    readAt: '2026-10-02T09:00:00-04:00',
    sheets: [{ name: 'csv', hidden: false, cells }],
  })
const point = (row: number, column: string) => ({ fileFingerprint: FP, sheet: 'csv', row, column })

describe('EV-5 column letters', () => {
  test('EV-5 columnLetter counts A to Z, AA, AZ, BA, ZZ, AAA', () => {
    const got = [1, 2, 26, 27, 28, 52, 53, 702, 703].map(columnLetter)
    expect(got).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
})

describe('EV-5 pointer schema shapes', () => {
  const ok = { fileFingerprint: FP, sheet: 'csv', row: 1, column: 'A' }
  test('EV-5 the fingerprint is exactly 64 lower-case hex characters', () => {
    for (const bad of ['a'.repeat(63), 'a'.repeat(65), `x${'a'.repeat(63)}`, 'A'.repeat(64), `${'a'.repeat(64)}\n`, ` ${'a'.repeat(64)}`]) {
      expect(CellPointerSchema.safeParse({ ...ok, fileFingerprint: bad }).success, bad).toBe(false)
    }
  })
  test('EV-5 the column is one to three capital letters and nothing else', () => {
    for (const good of ['A', 'AB', 'ABC']) expect(CellPointerSchema.safeParse({ ...ok, column: good }).success, good).toBe(true)
    for (const bad of ['', 'a', 'ABCD', 'A1', ' A', 'A ', '1']) expect(CellPointerSchema.safeParse({ ...ok, column: bad }).success, bad).toBe(false)
  })
})

describe('ARC-10 result schema shapes', () => {
  const base = { fileFingerprint: FP, engine: { name: 'e', version: '1' }, readAt: '2026-10-02T09:00:00-04:00', sheets: [] }
  test('ARC-10 readAt must be an ISO date and time, with or without an offset', () => {
    expect(SheetResultSchema.safeParse(base).success).toBe(true)
    expect(SheetResultSchema.safeParse({ ...base, readAt: '2026-10-02T13:00:00.000Z' }).success).toBe(true)
    expect(SheetResultSchema.safeParse({ ...base, readAt: 'yesterday' }).success).toBe(false)
    expect(SheetResultSchema.safeParse({ ...base, readAt: '2026-10-02' }).success).toBe(false)
  })
  test('ARC-10 a blank engine name or version, or a blank sheet name, is refused even when it is only spaces', () => {
    expect(SheetResultSchema.safeParse({ ...base, engine: { name: '  ', version: '1' } }).success).toBe(false)
    expect(SheetResultSchema.safeParse({ ...base, engine: { name: 'e', version: '  ' } }).success).toBe(false)
    expect(SheetResultSchema.safeParse({ ...base, sheets: [{ name: '  ', hidden: false, cells: [] }] }).success).toBe(false)
  })
  test('EV-14 the encoding and separator are optional but fixed lists', () => {
    expect(SheetResultSchema.safeParse({ ...base, encoding: 'utf-8-bom', separator: '\t' }).success).toBe(true)
    expect(SheetResultSchema.safeParse({ ...base, encoding: 'latin-1' }).success).toBe(false)
    expect(SheetResultSchema.safeParse({ ...base, separator: '|' }).success).toBe(false)
  })
})

describe('EV-6 cellValueMatches', () => {
  const r = result([cell(1, 'A', 'Straße (Test)'), cell(1, 'B', ''), cell(2, 'A', '000123'), cell(2, 'AA', '1234.56'), cell(3, 'A', '5', 'formula')].map((c) => (c.text === '' ? { ...c, type: 'empty' as const } : c)))
  test('EV-6 the amount grammar compares cents when both sides are amounts; a one-sided amount is plain text', () => {
    expect(cellValueMatches(r, point(2, 'AA'), '$1,234.56')).toEqual({ ok: true })
    expect(cellValueMatches(r, point(2, 'AA'), 'abc')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, point(1, 'A'), '5')).toEqual({ ok: false, reason: 'value differs' })
  })
  test('EV-6 text is trimmed and case-folded; leading zeros are text', () => {
    expect(cellValueMatches(r, point(1, 'A'), '  straße (TEST) ')).toEqual({ ok: true })
    expect(cellValueMatches(r, point(2, 'A'), '123')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, point(2, 'A'), '000123')).toEqual({ ok: true })
  })
  test('EV-5 a missing cell, a blank cell and a formula cell give their own reasons', () => {
    expect(cellValueMatches(r, point(9, 'A'), 'x')).toEqual({ ok: false, reason: 'no such cell' })
    expect(cellValueMatches(r, point(1, 'B'), 'x')).toEqual({ ok: false, reason: 'empty cell' })
    expect(cellValueMatches(r, point(3, 'A'), '6')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    expect(cellValueMatches(r, point(3, 'A'), '5')).toEqual({ ok: true })
    expect(cellValueMatches(r, { ...point(1, 'A'), sheet: 'other' }, 'x')).toEqual({ ok: false, reason: 'no such cell' })
    expect(cellValueMatches(r, { ...point(1, 'A'), fileFingerprint: 'b'.repeat(64) }, 'x')).toEqual({ ok: false, reason: 'no such cell' })
  })
})
