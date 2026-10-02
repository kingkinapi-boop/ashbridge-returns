// A07 test fixtures, built from fixed content with no library (spec-writer; run `node src/modules/sheets/__fixtures__/make-fixtures.mjs`).
// Every byte is deterministic: re-running gives the same files.
//
// Writes, next to this script:
//   c01/            sample client C01's three made-up downloads, copied from reference/sample-clients/01-maple-ridge/accounts/
//   csv-faults/     fault copies of the chequing download (see FAULTS below)
//   xlsx/           tb-1900.xlsx and tb-1904.xlsx (hand-written SpreadsheetML in a stored zip), protected.xlsx
//                   (an encrypted-package compound file, as Excel writes a password-protected workbook) and old.xls
//                   (a BIFF8 compound file), each with <name>.expected.json
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../../..')
const C01 = path.join(ROOT, 'reference/sample-clients/01-maple-ridge/accounts')

const out = (rel, data) => {
  const p = path.join(HERE, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, data)
}
const json = (v) => `${JSON.stringify(v, null, 2)}\n`

// ---------------------------------------------------------------- CSV

const DOWNLOADS = ['lakeview-chequing-4821.csv', 'aurora-business-card-7712.csv', 'aurora-personal-card-3309.csv']
for (const f of DOWNLOADS) out(`c01/${f}`, fs.readFileSync(path.join(C01, f)))

const chequing = fs.readFileSync(path.join(C01, 'lakeview-chequing-4821.csv'), 'utf8')
if (chequing.includes('\r') || chequing.includes('"')) throw new Error('the C01 chequing download changed: expected LF and no quotes')
const lines = chequing.replace(/\n$/, '').split('\n')
const withRow = (row, fn) => lines.map((l, i) => (i === row - 1 ? fn(l) : l))
const lf = (ls) => `${ls.join('\n')}\n`

/** The payee written into row 3 of the accent copies: E acute, E grave, an en dash and a right single quote (all in Windows-1252). */
const ACCENT_PAYEE = 'POS PURCHASE CAFÉ DÉPANNEUR – L’ÉTÈ (Test)'
const accentLines = withRow(3, (l) => l.replace('POS PURCHASE AMAZON.CA', ACCENT_PAYEE))
const accentText = lf(accentLines)

const CP1252 = new Map([
  ['É', 0xc9],
  ['È', 0xc8],
  ['–', 0x96],
  ['’', 0x92],
])
const toCp1252 = (s) =>
  Uint8Array.from([...s].map((ch) => {
    const code = ch.codePointAt(0)
    if (code < 0x80) return code
    const b = CP1252.get(ch)
    if (b === undefined) throw new Error(`no Windows-1252 byte for ${ch}`)
    return b
  }))

const QUOTED_PAYEE_RAW = '"POS PURCHASE ""BEST"" SMITH, JONES\nAND CO (Test)"'

out('csv-faults/chequing-accents.csv', accentText)
out('csv-faults/chequing-bom.csv', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(accentText, 'utf8')]))
out('csv-faults/chequing-crlf.csv', accentText.replace(/\n/g, '\r\n'))
out('csv-faults/chequing-cp1252.csv', toCp1252(accentText))
out('csv-faults/chequing-semicolon.csv', lf(lines.map((l) => l.replace(/,/g, ';'))))
out('csv-faults/chequing-quoted.csv', lf(withRow(3, (l) => l.replace('POS PURCHASE AMAZON.CA', QUOTED_PAYEE_RAW))))
out(
  'csv-faults/chequing-reference.csv',
  lf(lines.map((l, i) => `${l},${i === 0 ? 'Reference' : String(i).padStart(6, '0')}`)),
)
out('csv-faults/chequing-scientific.csv', lf(withRow(3, (l) => l.replace(',44.51,', ',1.2E3,'))))
out('csv-faults/chequing-blank-zero.csv', lf(withRow(2, (l) => l.replace(',282.50,,', ',0,,'))))

// ---------------------------------------------------------------- zip (stored, fixed times)

function zip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  const DOS_TIME = 0
  const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1980-01-01
  for (const [name, text] of entries) {
    const data = Buffer.from(text, 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = zlib.crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(DOS_TIME, 12)
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
  return Buffer.concat([...locals, cd, end])
}

// ---------------------------------------------------------------- xlsx

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STYLE = { general: 0, dateBuiltin: 1, dateIso: 2, amount: 3 }
const STYLES = `${XML}<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const colLetter = (n) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
const colNumber = (letter) => [...letter].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)

/**
 * One cell spec: { ref, kind: 'text'|'number'|'date'|'bool'|'formula'|'empty', raw, style?, formula?, expect }
 * `raw` is what is stored in the file; `expect` is the cell the reader must return (text and type).
 */
function sheetXml(spec, strings) {
  const rows = new Map()
  for (const c of spec.cells) {
    const r = Number(/\d+$/.exec(c.ref)[0])
    if (!rows.has(r)) rows.set(r, [])
    rows.get(r).push(c)
  }
  const cellXml = (c) => {
    const s = c.style ? ` s="${c.style}"` : ''
    switch (c.kind) {
      case 'text': {
        let i = strings.indexOf(c.raw)
        if (i === -1) i = strings.push(c.raw) - 1
        return `<c r="${c.ref}" t="s"${s}><v>${i}</v></c>`
      }
      case 'number':
      case 'date':
        return `<c r="${c.ref}"${s}><v>${c.raw}</v></c>`
      case 'bool':
        return `<c r="${c.ref}" t="b"${s}><v>${c.raw}</v></c>`
      case 'formula':
        return `<c r="${c.ref}"${s}><f>${esc(c.formula)}</f><v>${c.raw}</v></c>`
      case 'empty':
        return `<c r="${c.ref}"${s}/>`
      default:
        throw new Error(c.kind)
    }
  }
  const rowXml = [...rows.keys()]
    .sort((a, b) => a - b)
    .map((r) => `<row r="${r}"${spec.hiddenRows?.includes(r) ? ' hidden="1"' : ''}>${rows.get(r).map(cellXml).join('')}</row>`)
    .join('')
  const cols = (spec.hiddenColumns ?? [])
    .map((l) => `<col min="${colNumber(l)}" max="${colNumber(l)}" width="20" hidden="1" customWidth="1"/>`)
    .join('')
  const merges = spec.merged?.length
    ? `<mergeCells count="${spec.merged.length}">${spec.merged.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : ''
  return `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><dimension ref="${spec.dimension}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rowXml}</sheetData>${merges}</worksheet>`
}

function workbook(sheets, { date1904 }) {
  const strings = []
  const sheetParts = sheets.map((s) => sheetXml(s, strings))
  const n = sheets.length
  const ct = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`
  const rels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const wb = `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><workbookPr${date1904 ? ' date1904="1"' : ''}/><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029"/></workbook>`
  const wbRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
  const sst = `${XML}<sst xmlns="${NS}" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`
  return zip([
    ['[Content_Types].xml', ct],
    ['_rels/.rels', rels],
    ['xl/workbook.xml', wb],
    ['xl/_rels/workbook.xml.rels', wbRels],
    ...sheetParts.map((p, i) => [`xl/worksheets/sheet${i + 1}.xml`, p]),
    ['xl/styles.xml', STYLES],
    ['xl/sharedStrings.xml', sst],
  ])
}

const t = (ref, raw) => ({ ref, kind: 'text', raw, expect: { text: raw, type: 'text' } })
const num = (ref, raw, style = STYLE.amount) => ({ ref, kind: 'number', raw, style, expect: { text: raw, type: 'number' } })
const date = (ref, serial, iso, style = STYLE.dateIso) => ({ ref, kind: 'date', raw: String(serial), style, expect: { text: iso, type: 'date' } })
const formula = (ref, f, cached) => ({ ref, kind: 'formula', raw: cached, formula: f, style: STYLE.amount, expect: { text: cached, type: 'formula', formula: f } })
const empty = (ref) => ({ ref, kind: 'empty', raw: '', expect: { text: '', type: 'empty' } })
const bool = (ref) => ({ ref, kind: 'bool', raw: '1', expect: { type: 'boolean' } })

const TB_1900 = [
  {
    name: 'Trial Balance (Test)',
    dimension: 'A1:D13',
    hiddenRows: [4],
    hiddenColumns: ['D'],
    merged: ['A1:C1'],
    cells: [
      t('A1', 'Maple Ridge (Test) trial balance'), empty('B1'), empty('C1'),
      t('A2', 'Account'), t('B2', 'Debit'), t('C2', 'Credit'), t('D2', 'Note'),
      t('A3', '1010 Chequing (CAD)'), num('B3', '1234.56'), t('D3', 'internal note (Test)'),
      t('A4', '9999 Suspense (Test)'), num('B4', '10'), num('C4', '10'),
      t('A5', '3000 Capital (Test)'), num('C5', '1234.56'),
      t('A6', 'Total'), formula('B6', 'SUM(B3:B5)', '1244.56'), formula('C6', 'SUM(C3:C5)', '1244.56'),
      // A stale cached value: the formula would give 0, the file holds 5. The reader keeps 5 (never recalculates).
      t('A7', 'Stale check (Test)'), formula('B7', 'B6-C6', '5'),
      t('A8', 'As at'), date('B8', 46022, '2025-12-31', STYLE.dateBuiltin),
      t('A9', 'Day before the 1900 quirk'), date('B9', 59, '1900-02-28'),
      t('A10', 'Day after the 1900 quirk'), date('B10', 61, '1900-03-01'),
      t('A11', 'First day'), date('B11', 1, '1900-01-01'),
      t('A12', 'Reconciled'), bool('B12'),
      t('A13', 'Reference'), t('B13', '000123'),
    ],
  },
  {
    name: 'Workings (Test)',
    hidden: true,
    dimension: 'A1:A2',
    cells: [t('A1', 'hidden workings (Test)'), num('A2', '42', STYLE.general)],
  },
]

const TB_1904 = [
  {
    name: 'Dates 1904 (Test)',
    dimension: 'A1:B3',
    cells: [
      t('A1', 'Opened'), date('B1', 44196, '2025-01-01'),
      t('A2', 'Epoch'), date('B2', 0, '1904-01-01', STYLE.dateBuiltin),
      t('A3', 'Next day'), date('B3', 1, '1904-01-02'),
    ],
  },
]

function expected(file, sheets) {
  return {
    file,
    sheets: sheets.map((s) => ({ name: s.name, hidden: Boolean(s.hidden) })),
    cells: sheets.flatMap((s) =>
      s.cells.map((c) => {
        const [, letter, row] = /^([A-Z]+)(\d+)$/.exec(c.ref)
        const merged = (s.merged ?? []).find((m) => {
          const [a, b] = m.split(':')
          const [, la, ra] = /^([A-Z]+)(\d+)$/.exec(a)
          const [, lb, rb] = /^([A-Z]+)(\d+)$/.exec(b)
          const n = colNumber(letter)
          return Number(row) >= Number(ra) && Number(row) <= Number(rb) && n >= colNumber(la) && n <= colNumber(lb)
        })
        return {
          sheet: s.name,
          row: Number(row),
          column: { letter, number: colNumber(letter) },
          ...c.expect,
          hiddenRow: (s.hiddenRows ?? []).includes(Number(row)),
          hiddenColumn: (s.hiddenColumns ?? []).includes(letter),
          merged: merged ?? null,
        }
      }),
    ),
  }
}

out('xlsx/tb-1900.xlsx', workbook(TB_1900, { date1904: false }))
out('xlsx/tb-1900.expected.json', json(expected('tb-1900.xlsx', TB_1900)))
out('xlsx/tb-1904.xlsx', workbook(TB_1904, { date1904: true }))
out('xlsx/tb-1904.expected.json', json(expected('tb-1904.xlsx', TB_1904)))

// ---------------------------------------------------------------- compound files (.xls, password-protected .xlsx)

const SECTOR = 512
const FREESECT = 0xffffffff
const ENDOFCHAIN = 0xfffffffe
const FATSECT = 0xfffffffd
const NOSTREAM = 0xffffffff

/** A minimal Compound File Binary (v3) with streams of at least 4096 bytes each (so no mini stream). */
function compoundFile(streams) {
  const padded = streams.map(([name, data]) => {
    if (data.length < 4096) throw new Error(`${name} must be at least 4096 bytes`)
    const sectors = Math.ceil(data.length / SECTOR)
    const buf = Buffer.alloc(sectors * SECTOR)
    data.copy(buf)
    return { name, data, buf, sectors }
  })
  let next = 0
  for (const s of padded) {
    s.start = next
    next += s.sectors
  }
  const dirStart = next
  const dirEntries = 1 + padded.length
  const dirSectors = Math.ceil(dirEntries / 4)
  next += dirSectors
  const fatStart = next
  const fatSectors = 1
  next += fatSectors
  if (next > 128) throw new Error('one FAT sector only')

  const fat = new Array(128).fill(FREESECT)
  const chain = (start, count) => {
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? ENDOFCHAIN : start + i + 1
  }
  for (const s of padded) chain(s.start, s.sectors)
  chain(dirStart, dirSectors)
  fat[fatStart] = FATSECT
  const fatBuf = Buffer.alloc(SECTOR)
  fat.forEach((v, i) => fatBuf.writeUInt32LE(v, i * 4))

  const entry = (name, type, start, size, child, right) => {
    const e = Buffer.alloc(128)
    const n = Buffer.from(`${name}\0`, 'utf16le')
    n.copy(e, 0)
    e.writeUInt16LE(n.length, 64)
    e.writeUInt8(type, 66)
    e.writeUInt8(1, 67) // black
    e.writeUInt32LE(NOSTREAM, 68) // left
    e.writeUInt32LE(right, 72)
    e.writeUInt32LE(child, 76)
    e.writeUInt32LE(start, 116)
    e.writeUInt32LE(size, 120)
    return e
  }
  // Sibling order: shorter names first, then by upper-case code points. Every stream hangs to the right.
  const order = padded
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.name.length - b.s.name.length || (a.s.name.toUpperCase() < b.s.name.toUpperCase() ? -1 : 1))
  const rightOf = new Map(order.map((o, k) => [o.i, k + 1 < order.length ? order[k + 1].i + 1 : NOSTREAM]))
  const dir = Buffer.alloc(dirSectors * SECTOR)
  entry('Root Entry', 5, ENDOFCHAIN, 0, order[0].i + 1, NOSTREAM).copy(dir, 0)
  padded.forEach((s, i) => entry(s.name, 2, s.start, s.data.length, NOSTREAM, rightOf.get(i)).copy(dir, (i + 1) * 128))
  for (let k = dirEntries; k < dirSectors * 4; k++) {
    // unused entries: empty name, type 0, no siblings
    const e = Buffer.alloc(128)
    e.writeUInt32LE(NOSTREAM, 68)
    e.writeUInt32LE(NOSTREAM, 72)
    e.writeUInt32LE(NOSTREAM, 76)
    e.copy(dir, k * 128)
  }

  const header = Buffer.alloc(SECTOR)
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0)
  header.writeUInt16LE(0x003e, 24)
  header.writeUInt16LE(0x0003, 26)
  header.writeUInt16LE(0xfffe, 28)
  header.writeUInt16LE(9, 30)
  header.writeUInt16LE(6, 32)
  header.writeUInt32LE(0, 40) // directory sectors (v3: 0)
  header.writeUInt32LE(fatSectors, 44)
  header.writeUInt32LE(dirStart, 48)
  header.writeUInt32LE(0, 52)
  header.writeUInt32LE(4096, 56)
  header.writeUInt32LE(ENDOFCHAIN, 60)
  header.writeUInt32LE(0, 64)
  header.writeUInt32LE(ENDOFCHAIN, 68)
  header.writeUInt32LE(0, 72)
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i === 0 ? fatStart : FREESECT, 76 + i * 4)

  return Buffer.concat([header, ...padded.map((s) => s.buf), dir, fatBuf])
}

/** Deterministic filler bytes (a counter through a fixed mix), standing in for ciphertext. */
const filler = (n, seed) => {
  const b = Buffer.alloc(n)
  let x = seed >>> 0
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0
    b[i] = x >>> 24
  }
  return b
}

// BIFF8 workbook globals: a BOF record (0x0809, length 16, BIFF8 0x0600, workbook globals 0x0005), then EOF (0x000A).
const bof = Buffer.alloc(20)
bof.writeUInt16LE(0x0809, 0)
bof.writeUInt16LE(16, 2)
bof.writeUInt16LE(0x0600, 4)
bof.writeUInt16LE(0x0005, 6)
bof.writeUInt16LE(0x0dbb, 8)
bof.writeUInt16LE(0x07cc, 10)
const eof = Buffer.from([0x0a, 0x00, 0x00, 0x00])
const workbookStream = Buffer.alloc(4096)
Buffer.concat([bof, eof]).copy(workbookStream)
out('xlsx/old.xls', compoundFile([['Workbook', workbookStream]]))
out('xlsx/old.expected.json', json({ file: 'old.xls', refused: true, reason: 'old .xls format' }))

// Agile encryption (ECMA-376 part 2): EncryptionInfo version 4.4, reserved 0x40, then the XML descriptor.
const infoXml = Buffer.from(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password"><keyData saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" saltValue="AAAAAAAAAAAAAAAAAAAAAA=="/><keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password"><p:encryptedKey spinCount="100000" saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" saltValue="AAAAAAAAAAAAAAAAAAAAAA=="/></keyEncryptor></keyEncryptors></encryption>`,
  'utf8',
)
const infoHead = Buffer.alloc(8)
infoHead.writeUInt16LE(4, 0)
infoHead.writeUInt16LE(4, 2)
infoHead.writeUInt32LE(0x40, 4)
const encryptionInfo = Buffer.alloc(4096)
Buffer.concat([infoHead, infoXml]).copy(encryptionInfo)
const packageSize = 4096
const encryptedPackage = Buffer.concat([Buffer.alloc(8), filler(packageSize, 0xa07)])
encryptedPackage.writeUInt32LE(packageSize, 0)
out(
  'xlsx/protected.xlsx',
  compoundFile([
    ['EncryptionInfo', encryptionInfo],
    ['EncryptedPackage', encryptedPackage],
  ]),
)
out('xlsx/protected.expected.json', json({ file: 'protected.xlsx', refused: true, reason: 'password-protected' }))
