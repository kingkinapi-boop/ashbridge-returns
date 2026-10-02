// A07 round 2 unit tests: the typed text rule, cached values and hidden lists (EV-14, EV-6).
import ExcelJS from 'exceljs'
import { describe, expect, test } from 'vitest'
import { CellSchema, SheetSchema } from '../../../contracts/sheets'
import { numberText, readXlsx, typed } from './index'

async function read(fill: (ws: ExcelJS.Worksheet) => void) {
  const wb = new ExcelJS.Workbook()
  fill(wb.addWorksheet('S (Test)'))
  const out = await readXlsx(new Uint8Array(await wb.xlsx.writeBuffer()))
  if (!out.ok) throw new Error(out.reason)
  const sheet = out.sheets[0]
  if (!sheet) throw new Error('no sheet')
  return sheet
}
const at = (sheet: Awaited<ReturnType<typeof read>>, row: number, letter: string) =>
  sheet.cells.find((c) => c.row === row && c.column.letter === letter)

describe('EV-14 numberText', () => {
  test('EV-14 whole numbers, cents, noise within 1e-9 of a cent, and values that are not cents', () => {
    expect(numberText(5)).toBe('5')
    expect(numberText(-0)).toBe('0')
    expect(numberText(1234.56)).toBe('1234.56')
    expect(numberText(0.1 + 0.2)).toBe('0.3')
    expect(numberText(1234.56 + 4e-10)).toBe('1234.56')
    expect(numberText(1234.56 + 2e-9)).toBe(String(1234.56 + 2e-9))
    expect(numberText(0.125)).toBe('0.125')
    expect(numberText(1e21)).toBe('1000000000000000000000')
    expect(numberText(999_999_999_999_999_900_000)).toBe('999999999999999900000')
    expect(numberText(1e-7)).toBe('1e-7')
    expect(numberText(1e-9)).toBe('1e-9')
  })
})

describe('EV-14 typed values', () => {
  test('EV-14 each library value gets its own type and text; anything else has none', () => {
    expect(typed(null, false)).toBeUndefined()
    expect(typed(undefined, false)).toBeUndefined()
    expect(typed(0, false)).toEqual({ type: 'number', text: '0' })
    expect(typed(false, false)).toEqual({ type: 'boolean', text: 'FALSE' })
    expect(typed('', false)).toEqual({ type: 'text', text: '' })
    expect(typed({ error: '#N/A' }, false)).toEqual({ type: 'error', text: '#N/A' })
    expect(typed({ richText: [{ text: 'a' }, { text: 'b' }] }, false)).toEqual({ type: 'text', text: 'ab' })
    expect(typed({ richText: [] }, false)).toEqual({ type: 'text', text: '' })
    expect(typed({ text: 'link' }, false)).toEqual({ type: 'text', text: 'link' })
    expect(typed({ text: 5 }, false)).toBeUndefined()
    expect(typed({}, false)).toBeUndefined()
    expect(typed({ error: 5 }, false)).toBeUndefined()
  })
})

describe('EV-14 typed cell text', () => {
  test('EV-14 text, boolean, date, error, rich text and hyperlink cells read as their own type and text', async () => {
    const sheet = await read((ws) => {
      ws.getCell('A1').value = 'plain'
      ws.getCell('A2').value = true
      ws.getCell('A3').value = new Date(Date.UTC(2025, 11, 31))
      ws.getCell('A4').value = { error: '#N/A' }
      ws.getCell('A5').value = { richText: [{ text: 'rich ' }, { text: 'text' }] }
      ws.getCell('A6').value = { text: 'link', hyperlink: 'https://example.invalid' }
      ws.getCell('A7').value = ''
      ws.getCell('A8').value = false
      ws.getCell('C9').value = 'master'
      ws.mergeCells('C9:D9')
    })
    expect(at(sheet, 1, 'A')).toMatchObject({ type: 'text', text: 'plain' })
    expect(at(sheet, 2, 'A')).toMatchObject({ type: 'boolean', text: 'TRUE' })
    expect(at(sheet, 3, 'A')).toMatchObject({ type: 'date', text: '2025-12-31' })
    expect(at(sheet, 4, 'A')).toMatchObject({ type: 'error', text: '#N/A' })
    expect(at(sheet, 5, 'A')).toMatchObject({ type: 'text', text: 'rich text' })
    expect(at(sheet, 6, 'A')).toMatchObject({ type: 'text', text: 'link' })
    expect(at(sheet, 7, 'A')).toMatchObject({ type: 'empty', text: '' })
    expect(at(sheet, 8, 'A')).toMatchObject({ type: 'boolean', text: 'FALSE' })
    expect(at(sheet, 9, 'C')).toMatchObject({ type: 'text', text: 'master' })
    expect(at(sheet, 9, 'D')).toMatchObject({ type: 'empty', text: '' })
  })

  test('EV-14 a formula keeps the type and text of its cached value, and none when it stored no value', async () => {
    const sheet = await read((ws) => {
      ws.getCell('A1').value = { formula: 'X', result: 'words' }
      ws.getCell('A2').value = { formula: 'X', result: new Date(Date.UTC(2025, 0, 1)) }
      ws.getCell('A3').value = { formula: 'X', result: { error: '#REF!' } }
      ws.getCell('A4').value = { formula: 'X', result: 0.1 + 0.2 }
      ws.getCell('A5').value = { formula: 'X' }
      ws.getCell('A6').value = { formula: 'X', result: '' }
    })
    expect(at(sheet, 1, 'A')).toMatchObject({ type: 'formula', formula: 'X', text: 'words', cached: { type: 'text', text: 'words' } })
    expect(at(sheet, 2, 'A')).toMatchObject({ text: '2025-01-01', cached: { type: 'date', text: '2025-01-01' } })
    expect(at(sheet, 3, 'A')).toMatchObject({ text: '#REF!', cached: { type: 'error', text: '#REF!' } })
    expect(at(sheet, 4, 'A')).toMatchObject({ text: '0.3', cached: { type: 'number', text: '0.3' } })
    expect(at(sheet, 5, 'A')).toMatchObject({ text: '', cached: { type: 'none', text: '' } })
    expect(at(sheet, 6, 'A')).toMatchObject({ text: '', cached: { type: 'none', text: '' } })
  })
})

describe('EV-14 hidden lists', () => {
  test('EV-14 hidden rows and columns are listed sorted, a column definition spanning several columns lists each, visible ones are not', async () => {
    const sheet = await read((ws) => {
      ws.getCell('A1').value = 'x'
      ws.getCell('A4').value = 'y'
      ws.getRow(4).hidden = true
      ws.getCell('A2').value = 'z'
      ws.getRow(2).hidden = true
      ws.getRow(3).height = 20
      ws.getColumn(2).hidden = true
      ws.getColumn(3).width = 12
      ws.getColumn(5).hidden = true
    })
    expect(sheet.hiddenRows).toEqual([2, 4])
    expect(sheet.hiddenColumns).toEqual([2, 5])
    expect((await read((ws) => (ws.getCell('A1').value = 'x'))).hiddenRows).toEqual([])
    expect((await read((ws) => (ws.getCell('A1').value = 'x'))).hiddenColumns).toEqual([])
  })
})

describe('EV-14 schemas', () => {
  const cell = { row: 1, column: { letter: 'A', number: 1 }, text: '', type: 'empty', hiddenRow: false, hiddenColumn: false, merged: null }
  test('EV-14 a formula cell needs cached and no other cell may carry it, with a message that says so', () => {
    const noCache = CellSchema.safeParse({ ...cell, type: 'formula' })
    expect(noCache.success).toBe(false)
    expect(JSON.stringify(noCache.error?.issues)).toContain('carries its cached value')
    expect(CellSchema.safeParse({ ...cell, cached: { type: 'none', text: '' } }).success).toBe(false)
    expect(CellSchema.safeParse({ ...cell, type: 'formula', cached: { type: 'none', text: '' } }).success).toBe(true)
  })
  test('EV-14 every cached type is accepted and none outside the list', () => {
    for (const type of ['number', 'text', 'boolean', 'date', 'error', 'none']) {
      expect(CellSchema.safeParse({ ...cell, type: 'formula', cached: { type, text: '' } }).success, type).toBe(true)
    }
    expect(CellSchema.safeParse({ ...cell, type: 'formula', cached: { type: 'currency', text: '' } }).success).toBe(false)
  })
  test('EV-5 a blank sheet name is refused with a message that says so', () => {
    const r = SheetSchema.safeParse({ name: ' ', hidden: false, hiddenRows: [], hiddenColumns: [], cells: [] })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain('must not be blank')
  })
})
