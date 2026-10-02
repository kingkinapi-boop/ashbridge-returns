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
/** A relative reference: not part of a longer name, not a function call, not inside a string (strings are cut out first). */
const REFERENCE = /(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g

/** A shared formula's text moved from its master's address to a child's: relative references slide, absolute ones stay. */
export function slide(formula: string, from: string, to: string): string {
  const a = /^([A-Z]+)(\d+)$/.exec(from)
  const b = /^([A-Z]+)(\d+)$/.exec(to)
  if (!a || !b) return formula
  const columns = columnNumber(b[1] as string) - columnNumber(a[1] as string)
  const rows = Number(b[2]) - Number(a[2])
  return formula
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(REFERENCE, (whole, colAbs: string, col: string, rowAbs: string, row: string) => {
            const c = colAbs ? columnNumber(col) : columnNumber(col) + columns
            const r = rowAbs ? Number(row) : Number(row) + rows
            return c < 1 || r < 1 ? whole : `${colAbs}${columnLetter(c)}${rowAbs}${String(r)}`
          }),
    )
    .join('')
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
