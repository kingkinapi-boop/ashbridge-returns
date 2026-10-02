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
function serialToIso(day: number, seconds: number, date1904: boolean): string {
  let date: string
  if (date1904) date = isoDate(new Date(Date.UTC(1904, 0, 1 + day)))
  else if (day === 60) date = '1900-02-29'
  else if (day < 60) date = isoDate(new Date(Date.UTC(1899, 11, 31 + Math.max(day, 1))))
  else date = isoDate(new Date(Date.UTC(1899, 11, 30 + day)))
  if (seconds === 0) return date
  return `${date}T${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
}

/** ExcelJS's JS date back to the file's own serial, then to ISO text. */
function dateText(value: Date, date1904: boolean): string {
  const offset = UNIX_EPOCH_SERIAL - (date1904 ? DATE_1904_OFFSET : 0)
  const total = Math.round(value.getTime() / 1000) + offset * SECONDS_PER_DAY
  const day = Math.floor(total / SECONDS_PER_DAY)
  return serialToIso(day, total - day * SECONDS_PER_DAY, date1904)
}

type Parts = { text: string; type: Cell['type'] }

function scalar(value: unknown, date1904: boolean): Parts {
  if (value === null || value === undefined || value === '') return { text: '', type: 'empty' }
  if (value instanceof Date) return { text: dateText(value, date1904), type: 'date' }
  if (typeof value === 'number') return { text: String(value), type: 'number' }
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', type: 'boolean' }
  if (typeof value === 'string') return { text: value, type: 'text' }
  const rich = value as { richText?: { text: string }[]; text?: unknown; error?: string }
  if (rich.richText) return { text: rich.richText.map((r) => r.text).join(''), type: 'text' }
  if (rich.error !== undefined) return { text: rich.error, type: 'text' }
  if (typeof rich.text === 'string') return { text: rich.text, type: 'text' }
  return { text: JSON.stringify(value), type: 'text' }
}

function readCell(cell: ExcelJS.Cell, date1904: boolean, range: string | null, hiddenRow: boolean, hiddenColumn: boolean): Cell {
  const base = {
    row: Number(cell.row),
    column: { letter: columnLetter(Number(cell.col)), number: Number(cell.col) },
    hiddenRow,
    hiddenColumn,
    merged: range,
  }
  const isMergedFollower = cell.type === ExcelJS.ValueType.Merge
  if (isMergedFollower) return { ...base, text: '', type: 'empty' }
  if (cell.type === ExcelJS.ValueType.Formula) {
    const cached = (cell.value as { result?: unknown }).result
    return { ...base, text: scalar(cached, date1904).text, type: 'formula', formula: cell.formula }
  }
  return { ...base, ...scalar(cell.value, date1904) }
}

/** The cells a merge range covers, by address. */
function rangeAddresses(range: string): Set<string> {
  const [from = '', to = ''] = range.split(':')
  const a = decodeAddress(from)
  const b = decodeAddress(to)
  const out = new Set<string>()
  for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) out.add(`${columnLetter(c)}${String(r)}`)
  return out
}

function decodeAddress(address: string): { r: number; c: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(address)
  const letters = m?.[1] ?? 'A'
  let c = 0
  for (let i = 0; i < letters.length; i++) c = c * 26 + letters.charCodeAt(i) - 64
  return { r: Number(m?.[2] ?? '1'), c }
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
    const merges = (sheet.model.merges as string[] | undefined) ?? []
    const rangeOf = new Map<string, string>()
    for (const range of merges) for (const address of rangeAddresses(range)) rangeOf.set(address, range)
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
