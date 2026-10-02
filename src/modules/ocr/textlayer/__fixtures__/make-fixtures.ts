// A01 spec fixtures: small made-up PDFs written in raw PDF syntax (no dependency), with the words and boxes each
// one should read as. Deterministic: the same bytes every run (fixed /ID, no dates, no randomness).
// Test support only; product code never imports this file.
//
// Regenerate (spec-writer only):  node --experimental-strip-types src/modules/ocr/textlayer/__fixtures__/make-fixtures.ts
// (Node 24 runs .ts directly: node src/modules/ocr/textlayer/__fixtures__/make-fixtures.ts)
//
// Layout rules the expected boxes follow:
// - Font: Courier (monospace), size 12, with an explicit /Widths array of 600 per glyph, so every character is
//   exactly 7.2 pt wide and a word's left edge and width are exact.
// - Each line is one string shown with Tj, words separated by one space.
// - A word's expected box runs from its baseline to baseline + font size (12 pt) vertically, and from its first
//   glyph's left edge to its last glyph's right edge horizontally. Boxes are fractions of the page as displayed
//   (rotation applied), origin top left, as F09's BoxSchema.
// - The acceptance tests allow one hundredth of the page on each of left, top, width and height (card check 1).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FONT_SIZE = 12
export const CHAR_WIDTH = 7.2
export const LETTER = { width: 612, height: 792 } as const

export interface Line {
  x: number
  baseline: number
  text: string
}

export interface ExpectedBox {
  page: number
  left: number
  top: number
  width: number
  height: number
}

export interface ExpectedWord {
  text: string
  box: ExpectedBox
}

export interface ExpectedPage {
  number: number
  widthPt: number
  heightPt: number
  hasTextLayer: boolean
}

export interface Expected {
  file: string
  note: string
  pageCount: number
  pages: ExpectedPage[]
  /** In reading order: page by page, lines top to bottom, words left to right. */
  words: ExpectedWord[]
  /** Named field boxes (fractions of the page) for value-in-box checks. */
  boxes: Record<string, ExpectedBox>
}

export interface Fixture {
  name: string
  bytes: Uint8Array
  /** Absent for files that must be refused (encrypted, broken). */
  expected?: Expected
}

// ---- the made-up content ----

export const ONE_PAGE_LINES: readonly Line[] = [
  { x: 72, baseline: 720, text: 'Maple Ridge Consulting Inc. (Test)' },
  { x: 72, baseline: 696, text: 'Statement date 2025-12-31' },
  { x: 72, baseline: 672, text: 'Opening balance $100.00' },
  { x: 72, baseline: 648, text: 'Closing balance $1,234.56' },
  { x: 300, baseline: 600, text: 'Account 4417 (Test)' },
]

const TWO_PAGES_LINES: readonly (readonly Line[])[] = [
  [
    { x: 72, baseline: 720, text: 'Page one (Test)' },
    { x: 72, baseline: 696, text: 'Opening balance $100.00' },
  ],
  [
    { x: 144, baseline: 500, text: 'Page two (Test)' },
    { x: 144, baseline: 476, text: 'Closing balance $987.65' },
  ],
]

const IMAGE_PAGE_LINES: readonly (readonly Line[] | null)[] = [
  [{ x: 72, baseline: 720, text: 'Before the scan (Test)' }],
  null,
  [{ x: 72, baseline: 720, text: 'After the scan (Test)' }],
]

export const USER_PASSWORD = 'user (Test)'
export const OWNER_PASSWORD = 'owner (Test)'

// ---- expected words ----

const round = (n: number): number => Math.round(n * 1e9) / 1e9

function wordsOf(page: number, lines: readonly Line[], size: { width: number; height: number }): ExpectedWord[] {
  const out: ExpectedWord[] = []
  for (const line of lines) {
    let col = 0
    for (const text of line.text.split(' ')) {
      const left = line.x + col * CHAR_WIDTH
      const width = text.length * CHAR_WIDTH
      out.push({
        text,
        box: {
          page,
          left: round(left / size.width),
          top: round((size.height - (line.baseline + FONT_SIZE)) / size.height),
          width: round(width / size.width),
          height: round(FONT_SIZE / size.height),
        },
      })
      col += text.length + 1
    }
  }
  return out
}

/** The box of `word` on `page`, grown by `pad` (a fraction of the page) on every side. */
function padded(words: readonly ExpectedWord[], text: string, pad: number): ExpectedBox {
  const w = words.find((x) => x.text === text)
  if (!w) throw new Error(`no word ${text}`)
  return {
    page: w.box.page,
    left: round(w.box.left - pad),
    top: round(w.box.top - pad),
    width: round(w.box.width + 2 * pad),
    height: round(w.box.height + 2 * pad),
  }
}

// ---- raw PDF writing ----

const latin1 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'latin1'))

function concat(parts: readonly Uint8Array[]): Uint8Array {
  return Uint8Array.from(Buffer.concat(parts.map((p) => Buffer.from(p))))
}

const escapePdf = (s: string): string => s.replace(/[\\()]/g, (c) => `\\${c}`)

function textStream(lines: readonly Line[], prefix = ''): string {
  const body = lines.map((l) => `BT /F1 ${String(FONT_SIZE)} Tf ${String(l.x)} ${String(l.baseline)} Td (${escapePdf(l.text)}) Tj ET`)
  return [prefix, ...body].filter((s) => s !== '').join('\n') + '\n'
}

const IMAGE_STREAM = 'q 200 0 0 200 156 400 cm /Im1 Do Q\n'
/** A 4 x 4 grey checkerboard, 8 bits per pixel, uncompressed. */
const IMAGE_PIXELS = Uint8Array.from([0, 255, 0, 255, 255, 0, 255, 0, 0, 255, 0, 255, 255, 0, 255, 0])

interface PdfObject {
  dict: string
  stream?: Uint8Array
}

interface PageSpec {
  content: string
  mediaBox: readonly [number, number]
  rotate?: number
  image?: boolean
}

const FIXED_ID = '<41303153504543464958545552455331>'

/** Encryption: RC4 40-bit, standard security handler revision 2 (PDF 1.4 Algorithms 2, 3, 4). */
const PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6,
  0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = Array.from({ length: 256 }, (_, i) => i)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + (s[i] ?? 0) + (key[i % key.length] ?? 0)) & 0xff
    const t = s[i] ?? 0
    s[i] = s[j] ?? 0
    s[j] = t
  }
  const out = new Uint8Array(data.length)
  let i = 0
  j = 0
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff
    j = (j + (s[i] ?? 0)) & 0xff
    const t = s[i] ?? 0
    s[i] = s[j] ?? 0
    s[j] = t
    out[k] = (data[k] ?? 0) ^ (s[((s[i] ?? 0) + (s[j] ?? 0)) & 0xff] ?? 0)
  }
  return out
}

const md5 = (...parts: Uint8Array[]): Uint8Array =>
  Uint8Array.from(crypto.createHash('md5').update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest())

const padPassword = (pw: string): Uint8Array => concat([latin1(pw).slice(0, 32), PAD]).slice(0, 32)

const hex = (b: Uint8Array): string => `<${Buffer.from(b).toString('hex')}>`

interface Encryption {
  fileKey: Uint8Array
  dict: string
}

function encryption(): Encryption {
  const p = -4
  const o = rc4(md5(padPassword(OWNER_PASSWORD)).slice(0, 5), padPassword(USER_PASSWORD))
  const pBytes = new Uint8Array(4)
  new DataView(pBytes.buffer).setInt32(0, p, true)
  const id = Uint8Array.from(Buffer.from(FIXED_ID.slice(1, -1), 'hex'))
  const fileKey = md5(padPassword(USER_PASSWORD), o, pBytes, id).slice(0, 5)
  const u = rc4(fileKey, PAD)
  return { fileKey, dict: `<< /Filter /Standard /V 1 /R 2 /O ${hex(o)} /U ${hex(u)} /P ${String(p)} >>` }
}

function objectKey(fileKey: Uint8Array, num: number): Uint8Array {
  const tail = Uint8Array.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0])
  return md5(fileKey, tail).slice(0, Math.min(fileKey.length + 5, 16))
}

function writePdf(pages: readonly PageSpec[], encrypt = false): Uint8Array {
  // 1 catalog, 2 pages, 3 font, 4 image, then a page and its content per page; encrypt dict last.
  const objects: PdfObject[] = []
  const widths = Array.from({ length: 95 }, () => '600').join(' ')
  const kids = pages.map((_, i) => `${String(5 + 2 * i)} 0 R`).join(' ')
  objects.push({ dict: '<< /Type /Catalog /Pages 2 0 R >>' })
  objects.push({ dict: `<< /Type /Pages /Kids [${kids}] /Count ${String(pages.length)} >>` })
  objects.push({
    dict: `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 126 /Widths [${widths}] >>`,
  })
  objects.push({
    dict: `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${String(IMAGE_PIXELS.length)} >>`,
    stream: IMAGE_PIXELS,
  })
  pages.forEach((p, i) => {
    const resources = p.image ? '<< /XObject << /Im1 4 0 R >> >>' : '<< /Font << /F1 3 0 R >> >>'
    const rotate = p.rotate === undefined ? '' : ` /Rotate ${String(p.rotate)}`
    objects.push({
      dict: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(p.mediaBox[0])} ${String(p.mediaBox[1])}]${rotate} /Resources ${resources} /Contents ${String(6 + 2 * i)} 0 R >>`,
    })
    const data = latin1(p.content)
    objects.push({ dict: `<< /Length ${String(data.length)} >>`, stream: data })
  })
  const enc = encrypt ? encryption() : null
  if (enc) objects.push({ dict: enc.dict })

  const parts: Uint8Array[] = [latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')]
  let offset = parts[0]?.length ?? 0
  const offsets: number[] = []
  objects.forEach((o, i) => {
    const num = i + 1
    offsets.push(offset)
    let stream = o.stream
    if (stream && enc) stream = rc4(objectKey(enc.fileKey, num), stream)
    const chunk = stream
      ? concat([latin1(`${String(num)} 0 obj\n${o.dict}\nstream\n`), stream, latin1('\nendstream\nendobj\n')])
      : latin1(`${String(num)} 0 obj\n${o.dict}\nendobj\n`)
    parts.push(chunk)
    offset += chunk.length
  })
  const xref = [
    'xref',
    `0 ${String(objects.length + 1)}`,
    '0000000000 65535 f ',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `),
  ].join('\n')
  const encryptRef = enc ? ` /Encrypt ${String(objects.length)} 0 R` : ''
  const trailer = `\ntrailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R /ID [${FIXED_ID} ${FIXED_ID}]${encryptRef} >>\nstartxref\n${String(offset)}\n%%EOF\n`
  parts.push(latin1(xref + trailer))
  return concat(parts)
}

// ---- the fixtures ----

const letterPage = (lines: readonly Line[]): PageSpec => ({ content: textStream(lines), mediaBox: [LETTER.width, LETTER.height] })
const imagePage = (): PageSpec => ({ content: IMAGE_STREAM, mediaBox: [LETTER.width, LETTER.height], image: true })
const letter = (number: number, hasTextLayer: boolean): ExpectedPage => ({
  number,
  widthPt: LETTER.width,
  heightPt: LETTER.height,
  hasTextLayer,
})

export function buildFixtures(): Fixture[] {
  const oneWords = wordsOf(1, ONE_PAGE_LINES, LETTER)
  const oneBoxes = {
    closingBalance: padded(oneWords, '$1,234.56', 0.005),
    statementDate: padded(oneWords, '2025-12-31', 0.005),
    openingBalance: padded(oneWords, '$100.00', 0.005),
  }
  const onePage: Fixture = {
    name: 'one-page.pdf',
    bytes: writePdf([letterPage(ONE_PAGE_LINES)]),
    expected: {
      file: 'one-page.pdf',
      note: 'Made up (A01 spec). One Letter page, Courier 12, words at known positions.',
      pageCount: 1,
      pages: [letter(1, true)],
      words: oneWords,
      boxes: oneBoxes,
    },
  }

  // The same page drawn on a landscape MediaBox with /Rotate 90: shown upright it is identical to one-page.pdf.
  // The cm maps upright (X, Y) to unrotated user space (792 - Y, X).
  const rotated: Fixture = {
    name: 'rotated.pdf',
    bytes: writePdf([
      { content: textStream(ONE_PAGE_LINES, `0 1 -1 0 ${String(LETTER.height)} 0 cm`), mediaBox: [LETTER.height, LETTER.width], rotate: 90 },
    ]),
    expected: {
      file: 'rotated.pdf',
      note: 'Made up (A01 spec). one-page.pdf drawn on a 792 x 612 MediaBox with /Rotate 90; upright it matches one-page.pdf.',
      pageCount: 1,
      pages: [letter(1, true)],
      words: oneWords,
      boxes: oneBoxes,
    },
  }

  const twoWords = TWO_PAGES_LINES.flatMap((lines, i) => wordsOf(i + 1, lines, LETTER))
  const twoPages: Fixture = {
    name: 'two-pages.pdf',
    bytes: writePdf(TWO_PAGES_LINES.map(letterPage)),
    expected: {
      file: 'two-pages.pdf',
      note: 'Made up (A01 spec). Two Letter pages with different words at different positions.',
      pageCount: 2,
      pages: [letter(1, true), letter(2, true)],
      words: twoWords,
      boxes: { closingBalance: padded(twoWords, '$987.65', 0.005) },
    },
  }

  const imageWords = IMAGE_PAGE_LINES.flatMap((lines, i) => (lines ? wordsOf(i + 1, lines, LETTER) : []))
  const imagePageFixture: Fixture = {
    name: 'image-page.pdf',
    bytes: writePdf(IMAGE_PAGE_LINES.map((lines) => (lines ? letterPage(lines) : imagePage()))),
    expected: {
      file: 'image-page.pdf',
      note: 'Made up (A01 spec). Page 2 is an image with no text (a scan); pages 1 and 3 have text.',
      pageCount: 3,
      pages: [letter(1, true), letter(2, false), letter(3, true)],
      words: imageWords,
      boxes: {},
    },
  }

  const scanOnly: Fixture = {
    name: 'scan-only.pdf',
    bytes: writePdf([imagePage()]),
    expected: {
      file: 'scan-only.pdf',
      note: 'Made up (A01 spec). One page, an image and no text at all.',
      pageCount: 1,
      pages: [letter(1, false)],
      words: [],
      boxes: {},
    },
  }

  const encrypted: Fixture = { name: 'encrypted.pdf', bytes: writePdf([letterPage(ONE_PAGE_LINES)], true) }
  // A PDF cut off after its header and first object: no page tree, no xref.
  const truncated: Fixture = { name: 'truncated.pdf', bytes: onePage.bytes.slice(0, 60) }
  const notPdf: Fixture = { name: 'not-a-pdf.pdf', bytes: latin1('This is a text file named .pdf, not a PDF (Test).\n') }

  return [onePage, rotated, twoPages, imagePageFixture, scanOnly, encrypted, truncated, notPdf]
}

export const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url))

export const expectedFileName = (pdf: string): string => pdf.replace(/\.pdf$/, '.expected.json')

/** Writes every fixture and its expected JSON next to this script. */
export function writeFixtures(dir: string = FIXTURES_DIR): void {
  for (const f of buildFixtures()) {
    fs.writeFileSync(path.join(dir, f.name), f.bytes)
    if (f.expected) fs.writeFileSync(path.join(dir, expectedFileName(f.name)), JSON.stringify(f.expected, null, 2) + '\n')
  }
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) writeFixtures()
