// SC4 fixtures (spec-writer): one-sheet .xlsx workbooks built in memory from raw SpreadsheetML, no library, fixed bytes.
// Every workbook is a stored zip with a fixed DOS date, so the same call gives the same bytes. Names end in "(Test)".
import zlib from 'node:zlib'

export const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL = NS_R
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export const SHEET = 'Rules (Test)'

/** A stored (uncompressed) zip of the given entries, in order, with a fixed date. */
export function storedZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  const DOS_DATE = (1 << 5) | 1
  for (const [name, text] of entries) {
    const data = Buffer.from(text, 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = zlib.crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    locals.push(local, nameBuf, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locals, cd, end]))
}

/** Column number (1 = A) to letters. */
export function letters(n) {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
/** Letters to column number. */
export const columnOf = (l) => Array.from(l).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
/** "B7" from row 7, column 2. */
export const address = (row, col) => `${letters(col)}${String(row)}`
/** { row, col } from "B7". */
export function parseAddress(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!m) throw new Error(`not an address: ${ref}`)
  return { row: Number(m[2]), col: columnOf(m[1]) }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** One <c> element as Excel writes it: `{ ref, v?, f?, t? }`, or `{ ref, xml }` written as given. */
export function cellXml({ ref, v, f, t, xml }) {
  if (xml !== undefined) return xml
  const type = t === undefined ? '' : ` t="${t}"`
  const formula = f === undefined ? '' : `<f>${esc(f)}</f>`
  const value = v === undefined ? '' : `<v>${esc(v)}</v>`
  return `<c r="${ref}"${type}>${formula}${value}</c>`
}

/** The parts of a one-sheet workbook: cells `{ ref, v?, f?, t? }` in any order (written row by row), and merge ranges. */
export function workbookParts({ cells, merges = [] }) {
  const byRow = new Map()
  for (const c of cells) {
    const { row, col } = parseAddress(c.ref)
    if (!byRow.has(row)) byRow.set(row, [])
    byRow.get(row).push({ col, xml: cellXml(c) })
  }
  const rows = [...byRow.keys()]
    .sort((a, b) => a - b)
    .map((r) => `<row r="${String(r)}">${byRow.get(r).sort((a, b) => a.col - b.col).map((c) => c.xml).join('')}</row>`)
    .join('')
  const mergeXml = merges.length > 0 ? `<mergeCells count="${String(merges.length)}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''
  return {
    contentTypes: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    rootRels: `${XML}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    workbook: `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><workbookPr/><sheets><sheet name="${SHEET}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    workbookRels: `${XML}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    sheet: `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetData>${rows}</sheetData>${mergeXml}</worksheet>`,
  }
}

/** Parts to .xlsx bytes. */
export function zipParts(parts) {
  return storedZip([
    ['[Content_Types].xml', parts.contentTypes],
    ['_rels/.rels', parts.rootRels],
    ['xl/workbook.xml', parts.workbook],
    ['xl/_rels/workbook.xml.rels', parts.workbookRels],
    ['xl/worksheets/sheet1.xml', parts.sheet],
  ])
}

/** A one-sheet workbook named "Rules (Test)". */
export const xlsx = (spec) => zipParts(workbookParts(spec))
