// A07D test fixtures (spec-writer): one-sheet workbooks from raw SpreadsheetML, plus the reference grammar the D1 property
// generates over. No library and no product code: the grammar renders a formula at any offset from its own tokens, so the
// expected slid text never comes from a parser.
import { shapesXlsx } from './a07c'

export { SHEET } from './a07c'

/** Excel's grid: columns A to XFD, rows 1 to 1048576. */
export const MAX_COLUMN = 16_384
export const MAX_ROW = 1_048_576

/** Column number to letters (1 is A, 27 is AA), written here so the oracle shares no code with the reader. */
export function letters(column: number): string {
  let n = column
  let out = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    out = String.fromCharCode(65 + rest) + out
    n = (n - rest - 1) / 26
  }
  return out
}

/** "C12" to [column, row]. */
export function parseAddress(address: string): [number, number] {
  const found = /^([A-Z]+)(\d+)$/.exec(address)
  if (!found) throw new Error(`not an address: ${address}`)
  const column = Array.from(found[1] as string).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
  return [column, Number(found[2])]
}
export const address = (column: number, row: number): string => `${letters(column)}${String(row)}`

/** Element text as XML stores it. */
export const xmlText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A one-sheet workbook ("Shapes (Test)") from cells by address; each value is what follows `<c r=".."` (for example
 * `><v>1</v></c>`). Rows and cells are written in sheet order whatever order they are given in.
 */
export function gridXlsx(cells: Map<string, string>, links: [string, string][] = []): Uint8Array {
  const byRow = new Map<number, [number, string][]>()
  for (const [at, body] of cells) {
    const [column, row] = parseAddress(at)
    const list = byRow.get(row) ?? []
    list.push([column, `<c r="${at}"${body}`])
    byRow.set(row, list)
  }
  const last = Math.max(0, ...byRow.keys())
  const rows: string[] = []
  for (let r = 1; r <= last; r++) {
    const list = byRow.get(r) ?? []
    rows.push(
      list
        .sort((a, b) => a[0] - b[0])
        .map(([, xml]) => xml)
        .join(''),
    )
  }
  return shapesXlsx({ rows, links })
}

/** How Excel stores a double in <v>: its shortest text, exponent in capitals; -0 as "-0". */
export const stored = (x: number): string => (Object.is(x, -0) ? '-0' : String(x).replace('e', 'E'))
/** A number cell body. */
export const numberCell = (x: number): string => `><v>${stored(x)}</v></c>`
/** A formula cell body with its cached number. */
export const formulaCell = (formula: string, cached: number): string => `><f>${xmlText(formula)}</f><v>${stored(cached)}</v></c>`

// ------------------------------------------------------------------------------------------------ D1 reference grammar

/**
 * One token of a formula. References carry their grid position and `$` flags; everything else renders the same at any
 * offset. `prefix` is a sheet or external part ("Sheet2!", "'Q4 FY2026'!", "[1]Sheet1!") that never changes.
 */
export type Token =
  | { kind: 'cell'; prefix: string; column: number; row: number; columnAbs: boolean; rowAbs: boolean }
  | { kind: 'area'; prefix: string; from: CellRef; to: CellRef }
  | { kind: 'columns'; prefix: string; from: number; fromAbs: boolean; to: number; toAbs: boolean }
  | { kind: 'rows'; prefix: string; from: number; fromAbs: boolean; to: number; toAbs: boolean }
  | { kind: 'fixed'; text: string; protected: boolean }
export type CellRef = { column: number; row: number; columnAbs: boolean; rowAbs: boolean }

const dollar = (abs: boolean): string => (abs ? '$' : '')
const cellText = (c: CellRef, dc: number, dr: number): string =>
  `${dollar(c.columnAbs)}${letters(c.columnAbs ? c.column : c.column + dc)}${dollar(c.rowAbs)}${String(c.rowAbs ? c.row : c.row + dr)}`

/** The token's text with every relative part moved by (dc columns, dr rows), as Excel slides a shared formula. */
export function renderToken(t: Token, dc: number, dr: number): string {
  switch (t.kind) {
    case 'cell':
      return `${t.prefix}${cellText(t, dc, dr)}`
    case 'area':
      return `${t.prefix}${cellText(t.from, dc, dr)}:${cellText(t.to, dc, dr)}`
    case 'columns':
      return `${t.prefix}${dollar(t.fromAbs)}${letters(t.fromAbs ? t.from : t.from + dc)}:${dollar(t.toAbs)}${letters(t.toAbs ? t.to : t.to + dc)}`
    case 'rows':
      return `${t.prefix}${dollar(t.fromAbs)}${String(t.fromAbs ? t.from : t.from + dr)}:${dollar(t.toAbs)}${String(t.toAbs ? t.to : t.to + dr)}`
    case 'fixed':
      return t.text
  }
}
export const render = (tokens: Token[], dc: number, dr: number): string => tokens.map((t) => renderToken(t, dc, dr)).join('')

/** Every relative column and row the tokens hold: the offsets that keep all of them on the grid follow from these. */
export function relativeSpans(tokens: Token[]): { columns: number[]; rows: number[] } {
  const columns: number[] = []
  const rows: number[] = []
  const cell = (c: CellRef): void => {
    if (!c.columnAbs) columns.push(c.column)
    if (!c.rowAbs) rows.push(c.row)
  }
  for (const t of tokens) {
    if (t.kind === 'cell') cell(t)
    if (t.kind === 'area') {
      cell(t.from)
      cell(t.to)
    }
    if (t.kind === 'columns') {
      if (!t.fromAbs) columns.push(t.from)
      if (!t.toAbs) columns.push(t.to)
    }
    if (t.kind === 'rows') {
      if (!t.fromAbs) rows.push(t.from)
      if (!t.toAbs) rows.push(t.to)
    }
  }
  return { columns, rows }
}

/** Sheet and external prefixes, quoted names holding the grammar's own syntax ("A1 B2", "It's", "$B$2") included. */
export const PREFIXES = ['', '', '', 'Sheet2!', "'Q4 FY2026'!", "'It''s'!", "'A1 B2'!", "'Tax 2025-Q4 (Test)'!", "'R1C1 $B$2'!", '[1]Sheet1!', "'[2]Q4 FY2026'!"]
/** String literals: reference-like text inside, doubled quotes included. These never change. */
export const STRINGS = ['"A1"', '"Q4 B2:C3"', '"say ""B1"""', '""', '"$A$1&C:C"', '"1:1"']
/** Structured references: table and column names that look like references. These never change. */
export const STRUCTURED = ['Table1[Amount]', 'Table1[B1]', 'Table1[[#This Row],[C2]]', 'Sales[[#Totals],[Q4 2026]]', 'Table1[@A1]', 'Table1[#All]']
/** Literals and names that are not references. */
export const OTHER = ['2', '1.5', '100', '0.25', 'TRUE', '#N/A']
export const FUNCTIONS = ['SUM', 'LOG10', 'ATAN2', 'ROUND', 'IF', 'MAX']
export const OPERATORS = ['+', '-', '*', '/', '&', '=', '<>', ',']
