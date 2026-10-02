// @mutate
// The .xlsx reader (A07, EV-14): every cell as the file stores it, through one free library. Formulas keep their cached
// value and are never recalculated; hidden sheets, rows and columns are listed as hidden; dates come back as ISO dates.
import ExcelJS from 'exceljs'
import { columnLetter, type Cell } from '../../../contracts/sheets'

/** The npm package that reads .xlsx, at its exact pinned version (no account, key or network). */
export const XLSX_LIBRARY = { name: 'exceljs', version: '4.4.0' } as const

export type XlsxSheet = { name: string; hidden: boolean; hiddenRows: number[]; hiddenColumns: number[]; cells: Cell[] }
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
  else if (day < 60) date = isoDate(new Date(Date.UTC(1899, 11, 31 + day)))
  else if (day === 60) date = '1900-02-29'
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
type Cached = NonNullable<Cell['cached']>

/** The cent amount in plain digits: String below 1e21, every digit from there up, never exponent form. */
const plain = (n: number): string => (Math.abs(n) < 1e21 ? String(n) : BigInt(n).toString())

const FLOAT_VIEW = new DataView(new ArrayBuffer(8))

/** One unit in the last place of x (the gap to the next double of larger magnitude). */
export function ulp(x: number): number {
  const a = Math.abs(x)
  FLOAT_VIEW.setFloat64(0, a)
  FLOAT_VIEW.setBigInt64(0, FLOAT_VIEW.getBigInt64(0) + 1n)
  return FLOAT_VIEW.getFloat64(0) - a
}

/** The snap band never reaches half a cent. */
const MAX_BAND = 0.0025
const ULPS_IN_BAND = 4
const FLOOR_BAND = 1e-9

/** A stored double as text: a value within 4 ulps (at least 1e-9, under half a cent) of a whole cent is that cent amount, anything else its shortest round-trip text. */
export function numberText(x: number): string {
  const cents = Number.isInteger(x) ? x : Math.round(x * 100) / 100
  const gap = Math.abs(x - cents)
  const ulpBand = Math.min(MAX_BAND, ULPS_IN_BAND * ulp(Math.max(Math.abs(x), Math.abs(cents))))
  return gap < FLOOR_BAND || gap <= ulpBand ? plain(cents) : String(x)
}

/** The error text for a number cell that is not a finite number (the library drops the stored text, so one code stands for all). */
const NOT_A_NUMBER = '#NUM!'

/** One typed switch from a library value to text (never the library's own display text). */
export function typed(value: unknown, date1904: boolean): (Cached & { type: Exclude<Cached['type'], 'none'> }) | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? { type: 'number', text: numberText(value) } : { type: 'error', text: NOT_A_NUMBER }
  if (typeof value === 'boolean') return { type: 'boolean', text: value ? 'TRUE' : 'FALSE' }
  if (typeof value === 'string') return { type: 'text', text: value }
  if (value instanceof Date) return { type: 'date', text: dateText(value, date1904) }
  const rich = value as { error?: string; richText?: { text: string }[]; text?: unknown }
  if (typeof rich.error === 'string') return { type: 'error', text: rich.error }
  if (Array.isArray(rich.richText)) return { type: 'text', text: rich.richText.map((r) => r.text).join('') }
  if (typeof rich.text === 'string') return { type: 'text', text: rich.text }
  // A hyperlink's text may itself be rich text.
  const inner = rich.text as { richText?: { text: string }[] } | undefined
  if (Array.isArray(inner?.richText)) return { type: 'text', text: inner.richText.map((r) => r.text).join('') }
  return undefined
}

/** What a cell holds, by the type the file gave it. */
function parts(cell: ExcelJS.Cell, date1904: boolean): Parts {
  // Stryker disable next-line ConditionalExpression: a null or merged-over cell has no typed value either, so the early return only saves the lookup
  if (cell.type === ExcelJS.ValueType.Null || cell.type === ExcelJS.ValueType.Merge) return EMPTY
  const value = typed(cell.value, date1904)
  // Stryker disable next-line OptionalChaining: a cell with no typed value is one the early return above already took
  return value?.text ? { text: value.text, type: value.type } : EMPTY
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
  // A cached empty string cannot be told from no cached value in ExcelJS 4.4.0: both read as none.
  const found = typed(cell.result, date1904)
  const cached: Cached = found?.text ? found : { type: 'none', text: '' }
  return { ...base, text: cached.text, type: 'formula', formula: cell.formula, cached }
}

/** Hidden row numbers, empty rows included, from the sheet's own row records. */
function hiddenRows(sheet: ExcelJS.Worksheet): number[] {
  const rows: number[] = []
  for (let r = 1; r <= sheet.rowCount; r++) if (sheet.getRow(r).hidden) rows.push(r)
  return rows
}

/** Hidden column numbers, empty columns included, from the sheet's column definitions (a definition may span many columns). */
function hiddenColumns(sheet: ExcelJS.Worksheet): number[] {
  const columns = new Set<number>()
  // Stryker disable next-line ArrayDeclaration: a sheet with no definitions has none to read; any other fallback has no hidden flag
  const defs = (sheet.model as unknown as { cols?: { min: number; max: number; hidden?: boolean }[] }).cols ?? []
  for (const def of defs) {
    if (def.hidden) for (let c = def.min; c <= def.max; c++) columns.add(c)
  }
  // Stryker disable next-line MethodExpression,ArithmeticOperator,ArrowFunction: the library lists definitions in column order, so the sort only guards a file that does not
  return [...columns].sort((x, y) => x - y)
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

/** The one refusal for a container that is not a workbook: never a library message, a file name or a link. */
export const NOT_A_WORKBOOK = 'not a workbook (not a readable .xlsx file)'

export async function readXlsx(bytes: Uint8Array): Promise<XlsxRead> {
  const workbook = new ExcelJS.Workbook()
  // A zip that fails to load, or loads but holds no sheet (a .docx, a plain zip), is not a workbook; every real workbook has at least one.
  let isWorkbook = false
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer)
    isWorkbook = workbook.worksheets.length > 0
  } catch {
    // Stays false: the reason below carries no library message.
  }
  if (!isWorkbook) return { ok: false, reason: NOT_A_WORKBOOK }
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
    return { name: sheet.name, hidden: sheet.state !== 'visible', hiddenRows: hiddenRows(sheet), hiddenColumns: hiddenColumns(sheet), cells }
  })
  return { ok: true, sheets }
}
