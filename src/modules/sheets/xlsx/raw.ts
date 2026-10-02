// @mutate
// What each sheet's XML stores for a cell (A07C): its type letter, its stored <v> text and its <f> formula, by sheet name and address.
// ExcelJS 4.4.0 reads <v>12abc</v> as 12 and drops the formula of a hyperlinked cell; this is the file's own word on both.
import type { Zip } from './zip'

export type RawCell = { type: string | undefined; value: string | undefined; formula: string | undefined }
/** A cell the sheet XML does not mention: nothing stored. */
export const NO_RAW: RawCell = { type: undefined, value: undefined, formula: undefined }
export type RawSheets = Map<string, Map<string, RawCell>>

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** XML text to plain text: the five named entities and numeric references. */
export function decodeXml(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_m, dec: string | undefined, hex: string | undefined, named: string | undefined) => {
    if (named !== undefined) return ENTITIES[named] as string
    return String.fromCodePoint(dec === undefined ? parseInt(hex as string, 16) : Number(dec))
  })
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

function cellsOf(xml: string): Map<string, RawCell> {
  const cells = new Map<string, RawCell>()
  for (const found of xml.matchAll(CELL)) {
    const address = attribute(found[1] as string, 'r')
    if (address === undefined) continue
    // Stryker disable next-line StringLiteral: any text without <v> or <f> reads the same as a self-closed cell
    const inner = found[2] ?? ''
    const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
    const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1]
    cells.set(address, {
      type: attribute(found[1] as string, 't'),
      value: value === undefined ? undefined : decodeXml(value),
      formula: formula === undefined ? undefined : decodeXml(formula),
    })
  }
  return cells
}

/** Every sheet's raw cells by sheet name, or undefined when the workbook's own parts cannot be read. */
export function readRaw(zip: Zip): RawSheets | undefined {
  try {
    const book = text(zip, 'xl/workbook.xml')
    const rels = text(zip, 'xl/_rels/workbook.xml.rels')
    // Stryker disable next-line ConditionalExpression,LogicalOperator: a missing part would throw on the next line and the catch below returns the same undefined
    if (book === undefined || rels === undefined) return undefined
    const targets = relationshipTargets(rels)
    const sheets: RawSheets = new Map()
    for (const found of book.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
      const name = attribute(found[1] as string, 'name')
      // A sheet with no relationship id looks up nothing; a relationship with no target was never listed.
      const xml = text(zip, targets.get(attribute(found[1] as string, 'r:id') as string) as string)
      if (name !== undefined && xml !== undefined) sheets.set(name, cellsOf(xml))
    }
    return sheets
    // Stryker disable next-line BlockStatement: an emptied catch falls out of the function and returns the same undefined
  } catch {
    return undefined
  }
}
