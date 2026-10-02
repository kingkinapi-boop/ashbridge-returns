import ExcelJS from 'exceljs'
import { describe, expect, test } from 'vitest'
import { dateText, readXlsx, serialToIso, XLSX_LIBRARY } from './xlsx/index'

describe('EV-14 serial dates', () => {
  test('EV-14 1900 system: serial 1 is 1900-01-01, 59 is 1900-02-28, 60 is the 1900-02-29 that never was, 61 is 1900-03-01', () => {
    expect(serialToIso(1, 0, false)).toBe('1900-01-01')
    expect(serialToIso(59, 0, false)).toBe('1900-02-28')
    expect(serialToIso(60, 0, false)).toBe('1900-02-29')
    expect(serialToIso(61, 0, false)).toBe('1900-03-01')
    expect(serialToIso(0, 0, false)).toBe('1899-12-31')
    expect(serialToIso(45_657, 0, false)).toBe('2024-12-31')
  })
  test('EV-14 1904 system: serial 0 is 1904-01-01', () => {
    expect(serialToIso(0, 0, true)).toBe('1904-01-01')
    expect(serialToIso(1, 0, true)).toBe('1904-01-02')
    expect(serialToIso(43_830, 0, true)).toBe('2024-01-01')
  })
  test('EV-14 a time of day is kept as hours, minutes and seconds', () => {
    expect(serialToIso(45_657, 13 * 3600 + 7 * 60 + 9, false)).toBe('2024-12-31T13:07:09')
    expect(serialToIso(45_657, 3600, false)).toBe('2024-12-31T01:00:00')
    expect(serialToIso(45_657, 60, false)).toBe('2024-12-31T00:01:00')
    expect(serialToIso(45_657, 1, false)).toBe('2024-12-31T00:00:01')
  })
  test('EV-14 the library date is turned back into the file serial first, for both systems', () => {
    expect(dateText(new Date(Date.UTC(2025, 11, 31)), false)).toBe('2025-12-31')
    expect(dateText(new Date(Date.UTC(2025, 11, 31, 8, 30, 15)), false)).toBe('2025-12-31T08:30:15')
    expect(dateText(new Date(Date.UTC(2025, 0, 1)), true)).toBe('2025-01-01')
  })
})

async function build(fill: (ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('S (Test)')
  fill(ws, wb)
  const out = await readXlsx(new Uint8Array(await wb.xlsx.writeBuffer()))
  if (!out.ok) throw new Error(out.reason)
  return out.sheets
}
const find = (sheets: Awaited<ReturnType<typeof build>>, row: number, letter: string) =>
  sheets[0]?.cells.find((c) => c.row === row && c.column.letter === letter)

describe('EV-14 xlsx cell kinds', () => {
  test('EV-14 the pinned library is exceljs at an exact version', () => {
    expect(XLSX_LIBRARY).toEqual({ name: 'exceljs', version: '4.4.0' })
  })

  test('EV-14 rich text, a hyperlink and an error value are text, a boolean is TRUE or FALSE, a number is its digits', async () => {
    const s = await build((ws) => {
      ws.getCell('A1').value = { richText: [{ text: 'Rich ' }, { text: 'text (Test)' }] }
      ws.getCell('A2').value = { text: 'Link (Test)', hyperlink: 'https://example.test/' }
      ws.getCell('A3').value = { error: '#N/A' }
      ws.getCell('A4').value = true
      ws.getCell('A5').value = false
      ws.getCell('A6').value = 12.5
    })
    expect(find(s, 1, 'A')).toMatchObject({ text: 'Rich text (Test)', type: 'text' })
    expect(find(s, 2, 'A')).toMatchObject({ text: 'Link (Test)', type: 'text' })
    // Round 2 (A07 spec r2, 6b; A360 type error): the type is pinned by round2.acceptance.test.ts.
    expect(find(s, 3, 'A')).toMatchObject({ text: '#N/A' })
    expect(find(s, 4, 'A')).toMatchObject({ text: 'TRUE', type: 'boolean' })
    expect(find(s, 5, 'A')).toMatchObject({ text: 'FALSE', type: 'boolean' })
    expect(find(s, 6, 'A')).toMatchObject({ text: '12.5', type: 'number' })
  })

  test('EV-14 an empty string, a styled blank cell and a styled blank row are empty cells and are listed', async () => {
    const s = await build((ws) => {
      ws.getCell('A1').value = 'x'
      ws.getCell('C1').value = 'z'
      ws.getCell('A2').value = ''
      ws.getCell('A3').font = { bold: true }
    })
    expect(find(s, 1, 'B')).toMatchObject({ text: '', type: 'empty' })
    expect(find(s, 2, 'A')).toMatchObject({ text: '', type: 'empty' })
    expect(find(s, 3, 'A')).toMatchObject({ text: '', type: 'empty' })
  })

  test('EV-14 a formula with a date result keeps the date as ISO text and the formula without its equals sign', async () => {
    const s = await build((ws) => {
      ws.getCell('A1').value = { formula: 'DATE(2025,12,31)', result: new Date(Date.UTC(2025, 11, 31)) }
      ws.getCell('A2').value = { formula: 'A3*2', result: 8 }
      ws.getCell('A3').value = 4
    })
    expect(find(s, 1, 'A')).toMatchObject({ type: 'formula', text: '2025-12-31', formula: 'DATE(2025,12,31)' })
    expect(find(s, 2, 'A')).toMatchObject({ type: 'formula', text: '8', formula: 'A3*2' })
  })

  test('EV-14 a merge range far to the right is on every cell it covers and no other', async () => {
    const s = await build((ws) => {
      ws.getCell('AA3').value = 'head (Test)'
      ws.mergeCells('AA3:AB4')
      ws.getCell('AC3').value = 'beside'
    })
    for (const [row, letter] of [[3, 'AA'], [3, 'AB'], [4, 'AA'], [4, 'AB']] as const) {
      expect(find(s, row, letter)?.merged, `${letter}${String(row)}`).toBe('AA3:AB4')
    }
    expect(find(s, 3, 'AC')?.merged).toBeNull()
    expect(find(s, 3, 'AA')).toMatchObject({ text: 'head (Test)', column: { letter: 'AA', number: 27 } })
    expect(find(s, 4, 'AB')).toMatchObject({ text: '', type: 'empty' })
  })

  test('EV-14 a very hidden sheet is listed as hidden', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Shown (Test)').getCell('A1').value = 1
    const v = wb.addWorksheet('Very (Test)')
    v.state = 'veryHidden'
    v.getCell('A1').value = 2
    const out = await readXlsx(new Uint8Array(await wb.xlsx.writeBuffer()))
    if (!out.ok) throw new Error(out.reason)
    expect(out.sheets.map((x) => [x.name, x.hidden])).toEqual([['Shown (Test)', false], ['Very (Test)', true]])
  })
})

describe('EV-14 an unreadable zip', () => {
  test('EV-14 a file that starts like a zip but is not one is refused with a reason that says so', async () => {
    const out = await readXlsx(Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 1, 2, 3))
    expect(out.ok).toBe(false)
    // A07B item 3: the reason says so and never carries the library's message or URL.
    if (!out.ok) expect(out.reason).toMatch(/^not a readable \.xlsx file|not a workbook/)
    if (!out.ok) expect(out.reason).not.toMatch(/https?:|central directory|corrupted|end of data|\?/i)
  })
})
