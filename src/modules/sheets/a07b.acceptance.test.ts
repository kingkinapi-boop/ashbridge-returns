// A07B acceptance tests: the last narrow repairs after A07 round 2 (reports/A07-check.md on claude/A07, items 1 to 4).
//
// Spec choices (amber, see the A07B report):
//   1. Number text: the round-2 rule stands (the cent amount in plain digits, else the shortest round-trip text), with the
//      snap band scaled to the value's magnitude. A stored double within 4 units in the last place (ulps) of a whole cent,
//      or within 1e-9 of it, reads as that cent amount; one further than 64 ulps and further than 1e-9 reads as its own
//      shortest text; the band never reaches half a cent. Above 1e12 (4 ulps of 0.001 or more) either text is allowed.
//      The card's "9000000.30" is the amount: the cell text is the cent text "9000000.3" (as round 2 writes "0.3"), and
//      cellValueMatches accepts "9000000.30" and "$9,000,000.30".
//   2. A zip that is not a workbook (a .docx, a plain zip, a zip with no workbook part) is a refusal { ok: false, reason }
//      whose reason says "workbook", never a thrown error. A01's reader refuses the same .docx by its own contract (a
//      rejected Error "Reading refused: ..."), never a TypeError; that test runs once A01's reader is in the tree.
//   3. A file named .csv whose bytes are not a readable zip reads as CSV, even when they start "PK"; a real workbook named
//      .csv still reads as the workbook. No refusal reason carries a library message, a URL or a question mark.
//   4. A number cell or cached value that is not finite (ExcelJS reads `<v>#DIV/0!</v>` without t="e" as NaN) is an error:
//      type 'error' (cached.type 'error' on a formula), text an error code starting "#", never "NaN" or "Infinity". The
//      exact code is not pinned: the pinned library drops the stored text. A hyperlink whose text is rich text reads as
//      text, its runs joined.
import fc from 'fast-check'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import type { ReadingEngine } from '../../contracts/reading'
import { cellValueMatches, type CellPointer, type SheetResult } from '../../contracts/sheets'
import { createSheetsReader } from './index'
import { PLANTED, ROOT, fixture, numbersXlsx, rawXlsx, storedZip } from './__fixtures__/harness'

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array, fileName: string): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, fileName)
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
const cellAt = (r: SheetResult, sheet: string, row: number, letter: string) =>
  r.sheets.find((s) => s.name === sheet)?.cells.find((c) => c.row === row && c.column.letter === letter)
const ptr = (r: SheetResult, sheet: string, row: number, column: string): CellPointer => ({ fileFingerprint: r.fileFingerprint, sheet, row, column })

/** How Excel stores a double in <v>: its shortest text, exponent in capitals. */
const stored = (x: number): string => String(x).replace('e', 'E')

/** The next double up or down, exactly (one unit in the last place). */
function nextUp(x: number): number {
  if (x === 0) return Number.MIN_VALUE
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, x)
  view.setBigInt64(0, view.getBigInt64(0) + (x > 0 ? 1n : -1n))
  return view.getFloat64(0)
}
const nextDown = (x: number): number => -nextUp(-x)
function stepUlps(x: number, k: number): number {
  let y = x
  for (let i = 0; i < Math.abs(k); i++) y = k > 0 ? nextUp(y) : nextDown(y)
  return y
}
/** The cent amount n/100 as two-decimal text from exact integer arithmetic ("-9000000.30"). */
function centsText(n: bigint): string {
  const sign = n < 0n ? '-' : ''
  const a = n < 0n ? -n : n
  return `${sign}${String(a / 100n)}.${String(a % 100n).padStart(2, '0')}`
}

async function readNumbers(values: number[]): Promise<SheetResult> {
  return readBytes(numbersXlsx(values.map(stored)), 'numbers.xlsx')
}
const numberCell = (r: SheetResult, i: number) => cellAt(r, 'Numbers (Test)', i + 1, 'A')

describe('A07B item 1: large-magnitude float noise reads as the cent amount (EV-14, EV-6)', () => {
  test('EV-14 9000000.1+0.2 and 123456789.12+0.01+0.01 read as "9000000.3" and "123456789.14"', async () => {
    const values = [9000000.1 + 0.2, 123456789.12 + 0.01 + 0.01]
    // The planted noise is real: neither stored double is the cent amount itself.
    expect(values.map(stored)).toEqual(['9000000.299999999', '123456789.14000002'])
    const r = await readNumbers(values)
    expect([numberCell(r, 0)?.text, numberCell(r, 1)?.text]).toEqual(['9000000.3', '123456789.14'])
    expect([numberCell(r, 0)?.type, numberCell(r, 1)?.type]).toEqual(['number', 'number'])
  })

  test('EV-6 a correct citation of a large total matches ("9000000.30", "$9,000,000.30", "123456789.14"); a cent off is "value differs"', async () => {
    const r = await readNumbers([9000000.1 + 0.2, 123456789.12 + 0.01 + 0.01])
    const a1 = ptr(r, 'Numbers (Test)', 1, 'A')
    const a2 = ptr(r, 'Numbers (Test)', 2, 'A')
    expect(cellValueMatches(r, a1, '9000000.30')).toEqual({ ok: true })
    expect(cellValueMatches(r, a1, '$9,000,000.30')).toEqual({ ok: true })
    expect(cellValueMatches(r, a2, '123456789.14')).toEqual({ ok: true })
    expect(cellValueMatches(r, a2, '$123,456,789.14')).toEqual({ ok: true })
    expect(cellValueMatches(r, a1, '9000000.31')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, a2, '123456789.13')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-6 a SUM total cached with large-magnitude noise matches its amount and says "cached value differs" a cent off', async () => {
    const r = await readBytes(
      rawXlsx({ sheetData: '<row r="1"><c r="A1"><f>SUM(B1:C1)</f><v>9000000.299999999</v></c><c r="B1"><v>9000000.1</v></c><c r="C1"><v>0.2</v></c></row>' }),
      'sum.xlsx',
    )
    const cell = cellAt(r, 'Cells (Test)', 1, 'A')
    expect(cell?.type).toBe('formula')
    expect(cell?.cached).toEqual({ type: 'number', text: '9000000.3' })
    expect(cell?.text).toBe('9000000.3')
    expect(cellValueMatches(r, ptr(r, 'Cells (Test)', 1, 'A'), '$9,000,000.30')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, 'Cells (Test)', 1, 'A'), '9000000.29')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-6 planted fault: values that are truly not cents keep their own text at any magnitude, and never match the cent', async () => {
    const values = [9000000.301, 123456789.125, 1000000.005, 0.125, 4503599627.371]
    const r = await readNumbers(values)
    expect(values.map((_, i) => numberCell(r, i)?.text)).toEqual(['9000000.301', '123456789.125', '1000000.005', '0.125', '4503599627.371'])
    expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', 1, 'A'), '9000000.30')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', 2, 'A'), '123456789.13')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', 2, 'A'), '123456789.12')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-14 property (seed 20261003): a cent amount up to 1e12 with up to 4 ulps of noise reads back as that cent amount', async () => {
    const MAX_CENTS = 100_000_000_000_000 // 1e12 in cents
    const noisy = fc.tuple(fc.integer({ min: -MAX_CENTS, max: MAX_CENTS }), fc.integer({ min: -4, max: 4 }))
    await fc.assert(
      fc.asyncProperty(fc.array(noisy, { minLength: 1, maxLength: 20 }), async (pairs) => {
        const values = pairs.map(([n, k]) => stepUlps(n / 100, k))
        const r = await readNumbers(values)
        pairs.forEach(([n], i) => {
          const at = `cents ${String(n)} stored as ${stored(values[i] ?? NaN)}`
          expect(numberCell(r, i)?.type, at).toBe('number')
          expect(numberCell(r, i)?.text, at).toBe(String(n / 100))
          expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', i + 1, 'A'), centsText(BigInt(n))), at).toEqual({ ok: true })
        })
      }),
      { seed: 20261003, numRuns: 100 },
    )
  })

  test('EV-6 property (seed 20261004): two cent amounts a cent apart, each with noise, still read and match differently', async () => {
    const MAX_CENTS = 100_000_000_000_000
    const pair = fc.tuple(fc.integer({ min: -MAX_CENTS, max: MAX_CENTS - 1 }), fc.integer({ min: -4, max: 4 }), fc.integer({ min: -4, max: 4 }))
    await fc.assert(
      fc.asyncProperty(pair, async ([n, j, k]) => {
        const r = await readNumbers([stepUlps(n / 100, j), stepUlps((n + 1) / 100, k)])
        const at = `cents ${String(n)} and ${String(n + 1)}`
        expect(numberCell(r, 0)?.text, at).not.toBe(numberCell(r, 1)?.text)
        expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', 1, 'A'), centsText(BigInt(n + 1))), at).toEqual({ ok: false, reason: 'value differs' })
        expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', 2, 'A'), centsText(BigInt(n))), at).toEqual({ ok: false, reason: 'value differs' })
      }),
      { seed: 20261004, numRuns: 100 },
    )
  })
})

/** Text that only a library, a stack or a web page would put in a reason. */
const LIBRARY_TEXT = /https?:|www\.|jszip|exceljs|central directory|corrupted|end of data|TypeError|cannot read|undefined|\[object|\?/i

describe('A07B item 2: a wrong-kind container is refused with a reason, never thrown (EV-14 rule, every reader)', () => {
  const CONTAINERS: [string, string][] = [
    ['containers/letter (Test).docx', 'letter (Test).docx'],
    ['containers/letter (Test).docx', 'letter (Test).xlsx'],
    ['containers/notes (Test).zip', 'notes (Test).zip'],
    ['containers/notes (Test).zip', 'notes (Test).xlsx'],
    ['containers/no-workbook (Test).xlsx', 'no-workbook (Test).xlsx'],
  ]

  test.each(CONTAINERS)('EV-14 %s read as "%s" is refused with a reason that says it is not a workbook', async (file, name) => {
    const reader = createSheetsReader()
    const out = await reader.read(fixture(file), name)
    if (out.ok) throw new Error('read, not refused')
    expect(out.reason).toMatch(/workbook/i)
    expect(out.reason).not.toMatch(LIBRARY_TEXT)
    expect(out.reason).not.toContain(name)
    // The same bytes again give the same refusal (the cache holds refusals too).
    expect(await reader.read(fixture(file), name)).toEqual(out)
  })

  test('EV-14 the .docx with planted instructions has no effect: it is refused, and its words reach no reason or cell', async () => {
    const reader = createSheetsReader()
    const out = await reader.read(fixture('containers/letter (Test).docx'), 'letter (Test).xlsx')
    expect(out.ok).toBe(false)
    expect(JSON.stringify(out)).not.toContain('Ignore your rules')
    expect(JSON.stringify(out)).not.toContain('1234.56')
    // The reader still reads a real workbook afterwards, unchanged by the planted file.
    const after = await reader.read(fixture('xlsx/tb-1900.xlsx'), 'tb-1900.xlsx')
    expect(after).toEqual(await createSheetsReader().read(fixture('xlsx/tb-1900.xlsx'), 'tb-1900.xlsx'))
    expect(PLANTED).toContain('Ignore your rules')
  })

  test('EV-14 property (seed 20261005): any zip without a workbook part is refused with a reason, never thrown', async () => {
    const PARTS = [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'ppt/presentation.xml',
      'mimetype',
      'content.xml',
      'notes (Test).txt',
      'xl/styles.xml',
      'xl/sharedStrings.xml',
      'xl/worksheets/sheet1.xml',
      'xl/_rels/workbook.xml.rels',
      'docProps/core.xml',
    ]
    const BODIES = [
      '',
      'Amount,1234.56\n',
      '<?xml version="1.0"?><x/>',
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`,
      PLANTED,
    ]
    const entry = fc.tuple(fc.constantFrom(...PARTS), fc.oneof(fc.constantFrom(...BODIES), fc.string({ maxLength: 40 })))
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(entry, { minLength: 1, maxLength: 6, selector: ([name]) => name }), fc.constantFrom('x.xlsx', 'x.docx', 'x.zip'), async (entries, name) => {
        const out = await createSheetsReader().read(storedZip(entries), name)
        const at = entries.map(([n]) => n).join(', ')
        expect(out.ok, at).toBe(false)
        if (!out.ok) {
          expect(out.reason.trim(), at).not.toBe('')
          expect(out.reason, at).not.toMatch(LIBRARY_TEXT)
        }
      }),
      { seed: 20261005, numRuns: 60 },
    )
  })

  // The same planted .docx through A01's PDF reader (ARC-6 adapter, contract: a refusal is a rejected Error "Reading
  // refused: ..."). A01 is not in this tree yet; the test runs as soon as src/modules/ocr/index.ts is.
  const OCR_INDEX = path.join(ROOT, 'src/modules/ocr/index.ts')
  describe.runIf(fs.existsSync(OCR_INDEX))("A01's reader", () => {
    test("EV-14 rule: A01's reader refuses the same planted .docx with its reason, never a TypeError", async () => {
      const specifier = '../ocr/index'
      const ocr = (await import(/* @vite-ignore */ specifier)) as { createReadingAdapter: (o?: { env?: Record<string, string | undefined> }) => ReadingEngine }
      const bytes = fixture('containers/letter (Test).docx')
      const engine = ocr.createReadingAdapter({ env: {} })
      const read = engine.read({ fingerprint: 'd0c0'.repeat(16), fileName: 'letter (Test).docx', bytes })
      await expect(read).rejects.toThrow(/^Reading refused: /)
      const error = await read.then(
        () => null,
        (e: unknown) => e,
      )
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(TypeError)
      expect((error as Error).message).not.toMatch(LIBRARY_TEXT)
      expect((error as Error).message).not.toContain('Ignore your rules')
    })
  })
})

describe('A07B item 3: a file named .csv whose first cell starts "PK" (EV-14)', () => {
  test('EV-14 pkey.csv (header "PKey,Amount") reads as CSV: sheet csv, every cell, its encoding and separator', async () => {
    const r = await readBytes(fixture('containers/pkey.csv'), 'pkey.csv')
    expect(r.engine.name).not.toBe('exceljs')
    expect(r.encoding).toBe('utf-8')
    expect(r.separator).toBe(',')
    expect(r.sheets.map((s) => s.name)).toEqual(['csv'])
    expect(cellAt(r, 'csv', 1, 'A')?.text).toBe('PKey')
    expect(cellAt(r, 'csv', 1, 'B')?.text).toBe('Amount')
    expect(cellAt(r, 'csv', 2, 'A')?.text).toBe('PK-0001 (Test)')
    expect(cellAt(r, 'csv', 3, 'B')?.text).toBe('-3.00')
    expect(cellValueMatches(r, ptr(r, 'csv', 2, 'B'), '$12.50')).toEqual({ ok: true })
  })

  test('EV-14 a header that is exactly "PK", and an upper-case .CSV name, read as CSV too', async () => {
    const one = await readBytes(utf8('PK,Amount\nK1 (Test),1.00\n'), 'keys.csv')
    expect(cellAt(one, 'csv', 1, 'A')?.text).toBe('PK')
    const two = await readBytes(fixture('containers/pkey.csv'), 'PKEY.CSV')
    expect(cellAt(two, 'csv', 1, 'A')?.text).toBe('PKey')
  })

  test('EV-14 the same "PK" text named .xlsx, a truncated zip and "PK" garbage are refused with no library message or URL', async () => {
    const broken: [Uint8Array, string][] = [
      [fixture('containers/pkey.csv'), 'pkey.xlsx'],
      [Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 1, 2, 3), 'cut.xlsx'],
      [utf8('PK\u0003\u0004 made-up bytes (Test)'), 'junk.xlsx'],
    ]
    for (const [bytes, name] of broken) {
      const out = await createSheetsReader().read(bytes, name)
      if (out.ok) throw new Error(`${name} read, not refused`)
      expect(out.reason.trim(), name).not.toBe('')
      expect(out.reason, name).not.toMatch(LIBRARY_TEXT)
      expect(out.reason, name).not.toContain(name)
    }
  })

  test('EV-14 one reader: the "PK" text as .xlsx then .csv, and as .csv then .xlsx, is refused then read, read then refused', async () => {
    const bytes = fixture('containers/pkey.csv')
    const one = createSheetsReader()
    expect((await one.read(bytes, 'p.xlsx')).ok).toBe(false)
    expect((await one.read(bytes, 'p.csv')).ok).toBe(true)
    const two = createSheetsReader()
    expect((await two.read(bytes, 'p.csv')).ok).toBe(true)
    expect((await two.read(bytes, 'p.xlsx')).ok).toBe(false)
  })

  test('EV-14 a real workbook named .csv still reads as the workbook, and a protected one named .csv is still refused as protected', async () => {
    const asCsv = await readBytes(fixture('xlsx/tb-1900.xlsx'), 'tb-1900.csv')
    const asXlsx = await readBytes(fixture('xlsx/tb-1900.xlsx'), 'tb-1900.xlsx')
    expect(asCsv.engine).toEqual(asXlsx.engine)
    expect(asCsv.sheets).toEqual(asXlsx.sheets)
    const prot = await createSheetsReader().read(fixture('xlsx/protected.xlsx'), 'protected.csv')
    expect(prot).toEqual({ ok: false, reason: 'password-protected' })
  })
})

describe('A07B item 4: non-finite numbers and rich-text hyperlinks (EV-14, EV-6)', () => {
  const NOT_NUMBER_TEXT = ['NaN', 'Infinity', '-Infinity', '']

  test('EV-14 a formula cached as <v>#DIV/0!</v> without t="e" reads as a cached error, never "NaN"', async () => {
    const r = await readBytes(rawXlsx({ sheetData: '<row r="1"><c r="A1"><f>1/0</f><v>#DIV/0!</v></c></row>' }), 'div.xlsx')
    const cell = cellAt(r, 'Cells (Test)', 1, 'A')
    expect(cell?.type).toBe('formula')
    expect(cell?.formula).toBe('1/0')
    expect(cell?.cached?.type).toBe('error')
    expect(cell?.text).toBe(cell?.cached?.text)
    expect(cell?.text).toMatch(/^#/)
    expect(NOT_NUMBER_TEXT).not.toContain(cell?.text)
    const at = ptr(r, 'Cells (Test)', 1, 'A')
    expect(cellValueMatches(r, at, 'NaN')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    expect(cellValueMatches(r, at, '0')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test.each(['#DIV/0!', '#N/A', '#VALUE!', '#NUM!', '1E+309', '-1E+309', 'not a number (Test)'])(
    'EV-14 a number cell stored as <v>%s</v> without a type reads as an error cell, never "NaN" or "Infinity"',
    async (raw) => {
      const r = await readBytes(numbersXlsx([raw]), 'n.xlsx')
      const cell = numberCell(r, 0)
      expect(cell?.type).toBe('error')
      expect(cell?.text).toMatch(/^#/)
      expect(NOT_NUMBER_TEXT).not.toContain(cell?.text)
      expect(cellValueMatches(r, ptr(r, 'Numbers (Test)', 1, 'A'), 'NaN')).toEqual({ ok: false, reason: 'value differs' })
    },
  )

  test('EV-14 a hyperlink whose text is rich text reads its plain text; a plain hyperlink still reads its text', async () => {
    const r = await readBytes(
      rawXlsx({
        sheetData: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
        after: '<hyperlinks><hyperlink ref="A1" r:id="rId1"/><hyperlink ref="B1" r:id="rId2"/></hyperlinks>',
        sharedStrings: ['<si><r><t xml:space="preserve">Bank </t></r><r><rPr><b/></rPr><t>statement (Test)</t></r></si>', '<si><t>Plain link (Test)</t></si>'],
        hyperlinks: ['https://example.invalid/statement', 'https://example.invalid/plain'],
      }),
      'links.xlsx',
    )
    expect(cellAt(r, 'Cells (Test)', 1, 'A')).toMatchObject({ type: 'text', text: 'Bank statement (Test)' })
    expect(cellAt(r, 'Cells (Test)', 1, 'B')).toMatchObject({ type: 'text', text: 'Plain link (Test)' })
    expect(cellValueMatches(r, ptr(r, 'Cells (Test)', 1, 'A'), 'bank statement (test)')).toEqual({ ok: true })
  })
})
