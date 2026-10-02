// A07 test harness (spec-writer): fixture bytes and expected cells, file IO only.
// The fixtures are built by make-fixtures.mjs in this folder; re-run it to rebuild them byte for byte.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

export const FIXTURES = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(FIXTURES, '../../../..')

/** The bytes of a fixture, by its path under __fixtures__ (for example `c01/lakeview-chequing-4821.csv`). */
export function fixture(rel: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, rel)))
}

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

/** Row 3's payee in the accent copies (make-fixtures.mjs ACCENT_PAYEE). */
export const ACCENT_PAYEE = 'POS PURCHASE CAFÉ DÉPANNEUR – L’ÉTÈ (Test)'
/** Row 3's payee in the quoted copy, as read (RFC 4180 doubled quotes undone, the line break kept). */
export const QUOTED_PAYEE = 'POS PURCHASE "BEST" SMITH, JONES\nAND CO (Test)'

export interface ExpectedCell {
  sheet: string
  row: number
  column: { letter: string; number: number }
  text?: string
  type: string
  formula?: string
  /** Round 2 (A360): on formula cells, the cached value's type and text. */
  cached?: { type: string; text: string }
  hiddenRow: boolean
  hiddenColumn: boolean
  merged: string | null
}
export interface ExpectedWorkbook {
  file: string
  sheets: { name: string; hidden: boolean }[]
  /** Round 2 (A360): every hidden row and column number per sheet, 1-based and sorted, empty ones included. */
  hiddenLists: { name: string; hiddenRows: number[]; hiddenColumns: number[] }[]
  cells: ExpectedCell[]
}
export interface ExpectedRefusal {
  file: string
  refused: true
  reason: string
}

export function expectedWorkbook(name: string): ExpectedWorkbook {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'xlsx', `${name}.expected.json`), 'utf8')) as ExpectedWorkbook
}
export function expectedRefusal(name: string): ExpectedRefusal {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'xlsx', `${name}.expected.json`), 'utf8')) as ExpectedRefusal
}

export interface AnswerKeyTransaction {
  id: string
  acct: string
  amount: number
  line: number
}
export interface AnswerKeyAccount {
  key: string
  file: string
  closingBalance: number
  rowsInExport: number
}
/** C01's answer key (made-up data, reference/sample-clients). */
export function c01AnswerKey(): { accounts: AnswerKeyAccount[]; transactions: AnswerKeyTransaction[] } {
  const file = path.join(ROOT, 'reference/sample-clients/01-maple-ridge/answer-key.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as { accounts: AnswerKeyAccount[]; transactions: AnswerKeyTransaction[] }
}

/** Every file path under `dir` (relative), sorted, with its sha256: a before/after picture for "nothing is written". */
export function listing(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath, e.name))
    .map((p) => `${path.relative(dir, p)} ${sha256(new Uint8Array(fs.readFileSync(p)))}`)
    .sort()
}

/** A stored (uncompressed) zip with fixed times, as make-fixtures.mjs writes one. */
function storedZip(entries: [string, string][]): Uint8Array {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
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

/**
 * Round 2 (S6): a one-sheet .xlsx named "Numbers (Test)" whose column A holds each stored number text in turn (A1, A2, ...),
 * written as Excel writes a number cell: `<c r="A1"><v>1234.5600000000001</v></c>`, no style, no shared strings.
 */
export function numbersXlsx(stored: string[]): Uint8Array {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  const rows = stored.map((v, i) => `<row r="${String(i + 1)}"><c r="A${String(i + 1)}"><v>${v}</v></c></row>`).join('')
  return storedZip([
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><workbookPr/><sheets><sheet name="Numbers (Test)" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ],
    ['xl/worksheets/sheet1.xml', `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetData>${rows}</sheetData></worksheet>`],
  ])
}
