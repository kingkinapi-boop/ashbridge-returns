// @mutate
// The .xlsx reader (A07, EV-14): every cell as the file stores it, through one free library. Formulas keep their cached
// value and are never recalculated; hidden sheets, rows and columns are listed as hidden; dates come back as ISO dates.
import ExcelJS from 'exceljs'
import { columnLetter, type Cell } from '../../../contracts/sheets'

/** The npm package that reads .xlsx, at its exact pinned version (no account, key or network). */
export const XLSX_LIBRARY = { name: 'exceljs', version: '4.4.0' } as const

export type XlsxSheet = { name: string; hidden: boolean; cells: Cell[] }
export type XlsxRead = { ok: true; sheets: XlsxSheet[] } | { ok: false; reason: string }

const SECONDS_PER_DAY = 86_400
/** ExcelJS turns a serial into a JS date by days since 1970; this is the serial of 1970-01-01. */
const UNIX_EPOCH_SERIAL = 25_569
const DATE_1904_OFFSET = 1_462

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

const isoDate = (d: Date): string => `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** A serial day and seconds into the day to ISO text, by the file's date system (the 1900 system counts a 29 Feb 1900 that never was). */
export function serialToIso(day: number, seconds: number, date1904: boolean): string {
  let date: string
  if (date1904) date = isoDate(new Date(Date.UTC(1904, 0, 1 + day)))
  else if (day === 60) date = '1900-02-29'
  else if (day < 60) date = isoDate(new Date(Date.UTC(1899, 11, 31 + day)))
  else date = isoDate(new Date(Date.UTC(1899, 11, 30 + day)))
  if (seconds === 0) return date
  return `${date}T${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
}

/** ExcelJS's JS date back to the file's own serial, then to ISO text. */
export function dateText(value: Date, date1904: boolean): string {
  const offset = UNIX_EPOCH_SERIAL - (date1904 ? DATE_1904_OFFSET : 0)
  const total = Math.round(value.getTime() / 1000) + offset * SECONDS_PER_DAY
  const day = Math.floor(total / SECONDS_PER_DAY)
  return serialToIso(day, total - day * SECONDS_PER_DAY, date1904)
}

type Parts = { text: string; type: Cell['type'] }
const EMPTY: Parts = { text: '', type: 'empty' }

/** What a cell holds, by the type the file gave it. */
function parts(cell: ExcelJS.Cell, date1904: boolean): Parts {
  switch (cell.type) {
    case ExcelJS.ValueType.Null:
    case ExcelJS.ValueType.Merge:
      return EMPTY
    case ExcelJS.ValueType.Date:
      return { text: dateText(cell.value as Date, date1904), type: 'date' }
    case ExcelJS.ValueType.Number:
      return { text: cell.text, type: 'number' }
    case ExcelJS.ValueType.Boolean:
      return { text: cell.value ? 'TRUE' : 'FALSE', type: 'boolean' }
    default:
      return cell.text === '' ? EMPTY : { text: cell.text, type: 'text' }
  }
}

function readCell(cell: ExcelJS.Cell, date1904: boolean, range: string | null, hiddenRow: boolean, hiddenColumn: boolean): Cell {
  const base = {
    row: Number(cell.row),
    column: { letter: columnLetter(Number(cell.col)), number: Number(cell.col) },
    hiddenRow,
    hiddenColumn,
    merged: range,
  }
  if (cell.type !== ExcelJS.ValueType.Formula) return { ...base, ...parts(cell, date1904) }
  const cached = cell.result
  const text = cached instanceof Date ? dateText(cached, date1904) : cell.text
  return { ...base, text, type: 'formula', formula: cell.formula }
}

/** The merge ranges of a sheet, each cell address to its range ("A1:C1"). */
function mergedRanges(sheet: ExcelJS.Worksheet): Map<string, string> {
  const rangeOf = new Map<string, string>()
  for (const range of sheet.model.merges) {
    const [from, to] = range.split(':')
    const first = sheet.getCell(from as string)
    const last = sheet.getCell(to as string)
    for (let r = Number(first.row); r <= Number(last.row); r++) {
      for (let c = Number(first.col); c <= Number(last.col); c++) rangeOf.set(`${columnLetter(c)}${String(r)}`, range)
    }
  }
  return rangeOf
}

export async function readXlsx(bytes: Uint8Array): Promise<XlsxRead> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer)
  } catch (error) {
    return { ok: false, reason: `not a readable .xlsx file: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
  const date1904 = workbook.properties.date1904
  const sheets: XlsxSheet[] = workbook.worksheets.map((sheet) => {
    const rangeOf = mergedRanges(sheet)
    const cells: Cell[] = []
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const hiddenColumn = sheet.getColumn(Number(cell.col)).hidden
        cells.push(readCell(cell, date1904, rangeOf.get(cell.address) ?? null, row.hidden, hiddenColumn))
      })
    })
    return { name: sheet.name, hidden: sheet.state !== 'visible', cells }
  })
  return { ok: true, sheets }
}
