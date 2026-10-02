// A07C test fixtures (spec-writer): workbooks built in memory from raw SpreadsheetML, no library, fixed bytes.
// Every workbook here is a one-sheet stored zip with fixed times (harness.ts storedZip), so the same call gives the same bytes.
import { storedZip } from './harness'

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/** Style 0 is General; style 1 is the built-in short date (numFmtId 14), as Excel writes a date cell. */
const STYLES = `${XML}<styleSheet xmlns="${NS}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

export const SHEET = 'Shapes (Test)'

/**
 * A one-sheet .xlsx named "Shapes (Test)" with a styles part (style 1 is a date) and shared strings.
 * `rows[r]` is the inside of row r+1: whole <c> elements. `links` maps a cell address to an external hyperlink target.
 */
export function shapesXlsx(parts: { rows: string[]; sharedStrings?: string[]; links?: [string, string][] }): Uint8Array {
  const strings = parts.sharedStrings ?? []
  const links = parts.links ?? []
  const sheetData = parts.rows.map((cells, i) => `<row r="${String(i + 1)}">${cells}</row>`).join('')
  const hyperlinks =
    links.length > 0 ? `<hyperlinks>${links.map(([ref], i) => `<hyperlink ref="${ref}" r:id="rId${String(i + 1)}"/>`).join('')}</hyperlinks>` : ''
  const n = String(strings.length)
  const entries: [string, string][] = [
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    ],
    ['_rels/.rels', `${XML}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><workbookPr/><sheets><sheet name="${SHEET}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rId3" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ],
    ['xl/styles.xml', STYLES],
    ['xl/sharedStrings.xml', `${XML}<sst xmlns="${NS}" count="${n}" uniqueCount="${n}">${strings.join('')}</sst>`],
    ['xl/worksheets/sheet1.xml', `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetData>${sheetData}</sheetData>${hyperlinks}</worksheet>`],
  ]
  if (links.length > 0) {
    const rels = links.map(([, target], i) => `<Relationship Id="rId${String(i + 1)}" Type="${REL}/hyperlink" Target="${target}" TargetMode="External"/>`).join('')
    entries.push(['xl/worksheets/_rels/sheet1.xml.rels', `${XML}<Relationships xmlns="${PKG_REL}">${rels}</Relationships>`])
  }
  return storedZip(entries)
}

/** A SUM total over its terms, as Excel stores one: terms in column A (A1..An), the total in A(n+1) as SUM(A1:An) with the cached value. */
export function sumXlsx(terms: string[], cachedTotal: string): Uint8Array {
  const rows = terms.map((v, i) => `<c r="A${String(i + 1)}"><v>${v}</v></c>`)
  const total = terms.length + 1
  rows.push(`<c r="A${String(total)}"><f>SUM(A1:A${String(terms.length)})</f><v>${cachedTotal}</v></c>`)
  return shapesXlsx({ rows })
}

/** An empty zip: only the end-of-central-directory record ("PK\x05\x06" and 18 zero bytes). */
export const EMPTY_ZIP = Uint8Array.of(0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0))
