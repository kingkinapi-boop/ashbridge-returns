// @mutate
// What each sheet's XML stores for a cell (A07C): its type letter, its stored <v> text and its <f> formula, by sheet name and address.
// ExcelJS 4.4.0 reads <v>12abc</v> as 12 and drops the formula of a hyperlinked cell; this is the file's own word on both.
import { columnLetter } from '../../../contracts/sheets'
import type { Zip } from './zip'

export type RawCell = {
  type: string | undefined
  value: string | undefined
  formula: string | undefined
}
/** A cell the sheet XML does not mention: nothing stored. */
export const NO_RAW: RawCell = {
  type: undefined,
  value: undefined,
  formula: undefined,
}
export type RawSheets = Map<string, Map<string, RawCell>>

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/** XML text to plain text: the five named entities and numeric references. */
export function decodeXml(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g,
    (_m, dec: string | undefined, hex: string | undefined, named: string | undefined) => {
      if (named !== undefined) return ENTITIES[named] as string
      return String.fromCodePoint(dec === undefined ? parseInt(hex as string, 16) : Number(dec))
    },
  )
}

const attribute = (attributes: string, name: string): string | undefined => {
  const found = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes)
  return found ? decodeXml(found[1] as string) : undefined
}

const text = (zip: Zip, name: string): string | undefined => zip.read(name)?.toString('utf8')

/** The part a relationship id points at, from its relationships file ("worksheets/sheet1.xml" next to xl/, or "/xl/..." from the root). */
function relationshipTargets(xml: string): Map<string, string> {
  const targets = new Map<string, string>()
  for (const found of xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attribute(found[1] as string, 'Id')
    const target = attribute(found[1] as string, 'Target')
    if (id !== undefined && target !== undefined) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }
  return targets
}

const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
/** One <f> element, open or self-closed: its attributes and, when open, its text. */
const FORMULA = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/

const columnNumber = (letters: string): number => Array.from(letters).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const MAX_COLUMN = 16_384
const MAX_ROW = 1_048_576
/** What may follow a reference: not more name, not a call, not a sheet prefix or a table (then it was a name, not a reference). */
const NOT_NAME_AFTER = '(?![A-Za-z0-9_.(!\\[])'
const CELL_PART = '\\$?[A-Z]{1,3}\\$?\\d+'
const COLUMN_PART = '\\$?[A-Z]{1,3}'
const ROW_PART = '\\$?\\d+'
const AREA = new RegExp(`${CELL_PART}(?::${CELL_PART})?${NOT_NAME_AFTER}`, 'y')
const COLUMNS = new RegExp(`${COLUMN_PART}:${COLUMN_PART}${NOT_NAME_AFTER}`, 'y')
const ROWS = new RegExp(`${ROW_PART}:${ROW_PART}${NOT_NAME_AFTER}`, 'y')
/** A number with whatever name characters run on from it ("1E5", "1A1"): never a reference. */
const NUMBER = /\d[\d.]*[A-Za-z0-9_.]*/y
const STRING = /"(?:[^"]|"")*"?/y
const QUOTED_NAME = /'(?:[^']|'')*'?/y
const WORD = /[A-Za-z_\\][A-Za-z0-9_.]*/y

/** One end of a reference (a cell, a column or a row) moved by (dc, dr); undefined when it falls off the grid. */
function slidePart(part: string, columns: number, rows: number): string | undefined {
  const col = /[A-Z]+/.exec(part)?.[0]
  const row = /\d+/.exec(part)?.[0]
  // The row's "$" is the second one when a column comes first ("$A$1"), the first when it stands alone ("$1").
  const rowAbs = part.includes('$', col === undefined ? 0 : 1) ? '$' : ''
  const colAbs = col !== undefined && part.startsWith('$') ? '$' : ''
  let out = ''
  if (col !== undefined) {
    const c = colAbs ? columnNumber(col) : columnNumber(col) + columns
    if (c < 1 || c > MAX_COLUMN) return undefined
    out += `${colAbs}${columnLetter(c)}`
  }
  if (row !== undefined) {
    const r = rowAbs ? Number(row) : Number(row) + rows
    if (r < 1 || r > MAX_ROW) return undefined
    out += `${rowAbs}${String(r)}`
  }
  return out
}

/** The end of a bracketed part starting at `start` (the "["), brackets nested. */
function closeBracket(formula: string, start: number): number {
  let depth = 0
  // Stryker disable next-line EqualityOperator: one step past the end reads nothing and the loop ends there either way
  for (let i = start; i < formula.length; i++) {
    if (formula[i] === '[') depth++
    // Stryker disable next-line ArithmeticOperator: ending one character early leaves the "]" to be copied as itself
    else if (formula[i] === ']' && --depth === 0) return i + 1
  }
  return formula.length
}

/**
 * A shared formula's text moved from its master's address to a child's. One tokenizer: strings, quoted sheet names,
 * brackets (tables and external parts), names and numbers stay as they are; cell, column and row references slide on
 * their own axes, absolute parts stay; a reference that slides off the grid reads #REF!.
 */
export function slide(formula: string, from: string, to: string): string {
  const a = /^([A-Z]+)(\d+)$/.exec(from)
  const b = /^([A-Z]+)(\d+)$/.exec(to)
  if (!a || !b) return formula
  const columns = columnNumber(b[1] as string) - columnNumber(a[1] as string)
  const rows = Number(b[2]) - Number(a[2])
  let out = ''
  let i = 0
  const take = (re: RegExp): string | undefined => {
    re.lastIndex = i
    return re.exec(formula)?.[0]
  }
  while (i < formula.length) {
    const ch = formula[i] as string
    const quoted = ch === '"' ? take(STRING) : ch === "'" ? take(QUOTED_NAME) : ch === '[' ? formula.slice(i, closeBracket(formula, i)) : undefined
    if (quoted !== undefined) {
      out += quoted
      i += quoted.length
      continue
    }
    const reference = take(ROWS) ?? take(COLUMNS) ?? take(AREA)
    if (reference !== undefined) {
      const slid = reference.split(':').map((part) => slidePart(part, columns, rows))
      out += slid.includes(undefined) ? '#REF!' : slid.join(':')
      i += reference.length
      continue
    }
    const word = take(NUMBER) ?? take(WORD) ?? ch
    out += word
    i += word.length
  }
  return out
}

export function cellsOf(xml: string): Map<string, RawCell> {
  const cells = new Map<string, RawCell>()
  const masters = new Map<string, { formula: string; address: string }>()
  const children = new Map<string, string>()
  for (const found of xml.matchAll(CELL)) {
    const address = attribute(found[1] as string, 'r')
    if (address === undefined) continue
    // Stryker disable next-line StringLiteral: any text without <v> or <f> reads the same as a self-closed cell
    const inner = found[2] ?? ''
    const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
    const f = FORMULA.exec(inner)
    const si = f === null ? undefined : attribute(f[1] as string, 'si')
    const formula = f?.[2] === undefined ? undefined : decodeXml(f[2])
    // Stryker disable next-line ConditionalExpression: a cell with no shared id files nothing either way, as no child asks for an undefined id
    if (si !== undefined) {
      if (formula === undefined) children.set(address, si)
      else masters.set(si, { formula, address })
    }
    // An empty stored value (<v></v>) is no value, as <v/> is.
    cells.set(address, {
      type: attribute(found[1] as string, 't'),
      value: value === undefined || value === '' ? undefined : decodeXml(value),
      formula,
    })
  }
  for (const [address, si] of children) {
    const master = masters.get(si)
    const cell = cells.get(address)
    if (master && cell)
      cells.set(address, {
        ...cell,
        formula: slide(master.formula, master.address, address),
      })
  }
  return cells
}

/** Every sheet's raw cells by sheet name, or undefined when the workbook's own parts cannot be read. */
export function readRaw(zip: Zip): RawSheets | undefined {
  let sheets: RawSheets | undefined = new Map()
  try {
    const book = text(zip, 'xl/workbook.xml')
    const rels = text(zip, 'xl/_rels/workbook.xml.rels')
    // Stryker disable next-line ConditionalExpression,LogicalOperator: a missing part would throw on the next line and the catch below gives the same undefined
    if (book === undefined || rels === undefined) return undefined
    const targets = relationshipTargets(rels)
    for (const found of book.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
      const name = attribute(found[1] as string, 'name')
      // A sheet with no relationship id looks up nothing; a relationship with no target was never listed.
      const xml = text(zip, targets.get(attribute(found[1] as string, 'r:id') as string) as string)
      if (name !== undefined && xml !== undefined) sheets.set(name, cellsOf(xml))
    }
  } catch {
    // A part that cannot be read leaves no sheets at all, never some of them.
    sheets = undefined
  }
  return sheets
}
