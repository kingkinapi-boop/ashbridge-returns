// @mutate
// The .xlsx reader (A07, EV-14): every cell as the file stores it, through one free library. Formulas keep their cached
// value and are never recalculated; hidden sheets, rows and columns are listed as hidden; dates come back as ISO dates.
import ExcelJS from 'exceljs'
import { columnLetter, type Cell } from '../../../contracts/sheets'
import { NO_RAW, readRaw, type RawCell } from './raw'
import { openZip } from './zip'

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

/** A stored double as text: a value within 4 ulps (never half a cent) of a whole cent is that cent amount, anything else its shortest round-trip text. */
export function numberText(x: number): string {
  const cents = Number.isInteger(x) ? x : Math.round(x * 100) / 100
  const gap = Math.abs(x - cents)
  const ulpBand = Math.min(MAX_BAND, ULPS_IN_BAND * ulp(Math.max(Math.abs(x), Math.abs(cents))))
  return gap <= ulpBand ? plain(cents) : String(x)
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
  // A hyperlink wraps the cell's own value (any shape) as its text.
  return typed(rich.text, date1904)
}

/** One whole number literal: sign, digits with at most one point, an optional exponent. Nothing else is a number. */
const NUMBER_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

/** A number the file stores as text that is not one whole number literal ("12abc", "0x10"): the library would read another number. */
function notALiteral(raw: RawCell): boolean {
  return raw.value !== undefined && (raw.type === undefined || raw.type === 'n') && !NUMBER_LITERAL.test(raw.value)
}

/** What a cell holds, by the type the file gave it. */
function parts(cell: ExcelJS.Cell, date1904: boolean, raw: RawCell): Parts {
  // Stryker disable next-line ConditionalExpression: a null or merged-over cell has no typed value either, so the early return only saves the lookup
  if (cell.type === ExcelJS.ValueType.Null || cell.type === ExcelJS.ValueType.Merge) return EMPTY
  const value = typed(notALiteral(raw) ? Number.NaN : cell.value, date1904)
  // Stryker disable next-line OptionalChaining: a cell with no typed value is one the early return above already took
  return value?.text ? { text: value.text, type: value.type } : EMPTY
}

function readCell(cell: ExcelJS.Cell, date1904: boolean, range: string | null, hiddenRow: boolean, hiddenColumn: boolean, raw: RawCell): Cell {
  const base = {
    row: Number(cell.row),
    column: { letter: columnLetter(Number(cell.col)), number: Number(cell.col) },
    hiddenRow,
    hiddenColumn,
    merged: range,
  }
  const isHyperlink = cell.type === ExcelJS.ValueType.Hyperlink
  // ExcelJS drops a hyperlinked formula cell's formula and keeps only its result as the link's text: the sheet's own <f> has it.
  if (cell.type !== ExcelJS.ValueType.Formula && !(isHyperlink && raw.formula !== undefined)) return { ...base, ...parts(cell, date1904, raw) }
  const result = isHyperlink ? cell.value : cell.result
  // A cached empty string cannot be told from no cached value in ExcelJS 4.4.0: both read as none.
  const found = typed(notALiteral(raw) ? Number.NaN : result, date1904)
  const cached: Cached = found?.text ? found : { type: 'none', text: '' }
  // The sheet's own <f> is the word on every formula (a shared child whose master was hyperlinked has none left in the library).
  // Stryker disable next-line OptionalChaining,LogicalOperator: a formula cell the sheet XML does not mention is one the raw read could not map; the library's text is the same
  const formula = raw.formula ?? cell.formula
  return { ...base, text: cached.text, type: 'formula', formula, cached }
}

const SUM_RANGE = /^SUM\(\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)\)$/
const CENT_TEXT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/
/** A sum is never within half a cent of the wrong cent total: a wider bound would let a stale total pass. */
const HALF_CENT = 0.005

const columnNumber = (letters: string): number => Array.from(letters).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)

/** The cell text "-12.5" as whole cents, or undefined when it is not a cent amount. */
function toCents(cellText: string): bigint | undefined {
  const found = CENT_TEXT.exec(cellText)
  if (!found) return undefined
  const cents = BigInt(`${found[2] as string}${(found[3] ?? '').padEnd(2, '0')}`)
  return found[1] === '-' ? -cents : cents
}

/** The exact cent total of a SUM range's number terms and how far a floating-point sum of them can stray; undefined when a term is an error or not a cent amount. */
function sumOf(byAddress: Map<string, Cell>, range: RegExpExecArray): { cents: bigint; bound: number } | undefined {
  let cents = 0n
  let count = 0
  let peak = 0
  for (let r = Number(range[2]); r <= Number(range[4]); r++) {
    for (let c = columnNumber(range[1] as string); c <= columnNumber(range[3] as string); c++) {
      const term = byAddress.get(`${String(r)}:${String(c)}`)
      const value = term?.type === 'formula' ? term.cached : term
      if (value?.type === 'error') return undefined
      if (value?.type !== 'number') continue
      const termCents = toCents(value.text)
      if (termCents === undefined) return undefined
      cents += termCents
      count++
      peak = Math.max(peak, Math.abs(Number(value.text)))
    }
  }
  // Every addition rounds by at most an ulp of the largest partial sum (at most count times the largest term), and every term is itself rounded.
  return { cents, bound: (count + 1) * ulp(count * peak) }
}

/**
 * A SUM over number cells whose cached value is the floating-point sum of its terms reads as the exact cent total
 * (never recalculated: a cache that disagrees by more than the sum's own rounding keeps its own text).
 */
function snapSums(cells: Cell[]): void {
  const byAddress = new Map<string, Cell>(cells.map((c) => [`${String(c.row)}:${String(c.column.number)}`, c]))
  for (const cell of cells) {
    if (cell.cached?.type !== 'number') continue
    const range = SUM_RANGE.exec(cell.formula as string)
    const sum = range ? sumOf(byAddress, range) : undefined
    if (!sum) continue
    const total = Number(sum.cents) / 100
    // Stryker disable next-line EqualityOperator: a difference exactly equal to the bound cannot be built
    if (Math.abs(Number(cell.cached.text) - total) > Math.min(HALF_CENT, sum.bound + ulp(total))) continue
    cell.cached = { type: 'number', text: plain(total) }
    cell.text = cell.cached.text
  }
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
  // The sheet XML is read again as the file stores it: a file whose parts cannot be read that way is refused too, never read leniently.
  const zip = openZip(bytes)
  const raw = zip && readRaw(zip)
  let isWorkbook = false
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer)
    isWorkbook = workbook.worksheets.length > 0
  } catch {
    // Stays false: the reason below carries no library message.
  }
  // Stryker disable next-line ConditionalExpression: a file the library loads always has the parts readRaw needs; this guard is defence only
  if (!isWorkbook || raw === undefined) return { ok: false, reason: NOT_A_WORKBOOK }
  const date1904 = workbook.properties.date1904
  const sheets: XlsxSheet[] = workbook.worksheets.map((sheet) => {
    const rangeOf = mergedRanges(sheet)
    const rawCells = raw.get(sheet.name) ?? new Map<string, RawCell>()
    const cells: Cell[] = []
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const hiddenColumn = sheet.getColumn(Number(cell.col)).hidden
        cells.push(readCell(cell, date1904, rangeOf.get(cell.address) ?? null, row.hidden, hiddenColumn, rawCells.get(cell.address) ?? NO_RAW))
      })
    })
    snapSums(cells)
    return { name: sheet.name, hidden: sheet.state !== 'visible', hiddenRows: hiddenRows(sheet), hiddenColumns: hiddenColumns(sheet), cells }
  })
  return { ok: true, sheets }
}
