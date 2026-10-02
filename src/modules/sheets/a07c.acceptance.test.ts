// A07C acceptance tests: the closing repairs after A07B's last round (reports/A07B-check.md on claude/A07B, failures 1 to 4,
// and its two surviving mutants).
//
// Spec choices (amber, see the A07C report):
//   1. Money text from sums: a formula cell SUM(A1:An) over number cells on the same sheet whose cached value is the
//      floating-point sum of those cells reads as the exact cent total of the terms (text as A07B writes a cent amount:
//      the shortest text of the nearest double to the cent value, "253914.88", "9000000.3"). The cached value is never
//      recalculated: a cache that disagrees with its terms by more than the sum's own rounding (a stale total, one cent
//      or a tenth of a cent off) keeps its own text. A bare number cell keeps A07B's rule (no terms, no sum).
//   2. A hyperlink never changes what a cell reads as: the same cell with and without a hyperlink reads with the same
//      type, text, formula and cached value. ExcelJS 4.4.0 drops the formula of a hyperlinked cell on load (cell-xform
//      reconcile turns it into a hyperlink value holding only the result), so the build recovers it from the sheet.
//   3. Bytes that are a zip container (a local file header "PK\x03\x04" or an empty zip's "PK\x05\x06") and not a
//      readable workbook are refused under every name, CSV names included; text that merely starts "PK" ("PKey") is
//      still CSV under a CSV name. Replaces A07B spec amber 3. The reason is not pinned beyond: non-blank, no library
//      text, never the file name.
//   4. A stored number <v> that is not a whole number literal (parseFloat would read a prefix of it) is never another
//      number: the read is refused, or the cell reads as text holding the stored text exactly, or as an error cell
//      (A07B pinned "not a number (Test)" as an error cell, so error is allowed too). Cached formula values the same.
//   5. Mutants: bytes matching only part of the compound header are not the compound route (a UTF-8 CSV whose first byte
//      is 0xD0 reads as CSV); every route's outcome is pinned per name so the route label is load-bearing. The current
//      code passes item 5's tests: they exist to kill the two A07B survivors in mutate:changed, and the build makes the
//      route label observable (an equivalent mutant is removed by rewrite, .claude/rules/testing.md).
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type Cell, type CellPointer, type SheetResult } from '../../contracts/sheets'
import { EMPTY_ZIP, SHEET, shapesXlsx, sumXlsx } from './__fixtures__/a07c'
import { PLANTED, fixture, numbersXlsx, storedZip } from './__fixtures__/harness'
import { createSheetsReader, type SheetsOutcome } from './index'

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
const cellAt = (r: SheetResult, sheet: string, row: number, letter: string): Cell | undefined =>
  r.sheets.find((s) => s.name === sheet)?.cells.find((c) => c.row === row && c.column.letter === letter)
const ptr = (r: SheetResult, sheet: string, row: number, column: string): CellPointer => ({ fileFingerprint: r.fileFingerprint, sheet, row, column })

/** How Excel stores a double in <v>: its shortest text, exponent in capitals. */
const stored = (x: number): string => String(x).replace('e', 'E')
/** The cent amount n/100 as two-decimal text from exact integer arithmetic ("-253914.88"). */
function centsText(n: bigint): string {
  const sign = n < 0n ? '-' : ''
  const a = n < 0n ? -n : n
  return `${sign}${String(a / 100n)}.${String(a % 100n).padStart(2, '0')}`
}
/** The cell text of a cent amount, as A07B writes one: the shortest text of the nearest double ("253914.88", "9000000.3"). */
const cellCents = (n: bigint): string => String(Number(n) / 100)

/** Text that only a library, a stack or a web page would put in a reason. */
const LIBRARY_TEXT = /https?:|www\.|jszip|exceljs|central directory|corrupted|end of data|TypeError|cannot read|undefined|\[object|\?/i

// ---------------------------------------------------------------------------------------------------------------- item 1

/** The six terms of the A07B check's planted sum, in order; their floating-point sum is 253914.87999999803. */
const PLANTED_TERMS = [-7335624.99, 2860106.52, -2434451.58, 8522880.37, 4815622.56, -6174618]

describe('A07C item 1: money text from sums reads as the exact cent total (EV-14, EV-6)', () => {
  test('EV-14 the planted six-term SUM cached as "253914.87999999803" reads "253914.88", formula and type kept', async () => {
    const floatSum = PLANTED_TERMS.reduce((a, b) => a + b, 0)
    // The planted noise is real: the cached double is not the cent amount, and it is far outside a few ulps of the result.
    expect(stored(floatSum)).toBe('253914.87999999803')
    const r = await readBytes(sumXlsx(PLANTED_TERMS.map(stored), stored(floatSum)), 'sum.xlsx')
    const total = cellAt(r, SHEET, 7, 'A')
    expect(total).toMatchObject({ type: 'formula', formula: 'SUM(A1:A6)', text: '253914.88', cached: { type: 'number', text: '253914.88' } })
    // The terms read as their own cent amounts.
    expect(PLANTED_TERMS.map((_, i) => cellAt(r, SHEET, i + 1, 'A')?.text)).toEqual(['-7335624.99', '2860106.52', '-2434451.58', '8522880.37', '4815622.56', '-6174618'])
  })

  test('EV-6 a correct citation of the planted total matches ("253914.88", "$253,914.88"); a cent either side says "cached value differs"', async () => {
    const floatSum = PLANTED_TERMS.reduce((a, b) => a + b, 0)
    const r = await readBytes(sumXlsx(PLANTED_TERMS.map(stored), stored(floatSum)), 'sum.xlsx')
    const at = ptr(r, SHEET, 7, 'A')
    expect(cellValueMatches(r, at, '253914.88')).toEqual({ ok: true })
    expect(cellValueMatches(r, at, '$253,914.88')).toEqual({ ok: true })
    expect(cellValueMatches(r, at, '253914.87')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    expect(cellValueMatches(r, at, '253914.89')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-14 planted fault: a cached total that disagrees with its terms is never recalculated; it keeps its own text', async () => {
    // A stale cache one cent off, and one a tenth of a cent off: both beyond the sum's own rounding.
    for (const [cachedText, expected] of [
      ['253914.89', '253914.89'],
      ['253914.881', '253914.881'],
      ['253914.87', '253914.87'],
    ] as const) {
      const r = await readBytes(sumXlsx(PLANTED_TERMS.map(stored), cachedText), 'stale.xlsx')
      const total = cellAt(r, SHEET, 7, 'A')
      expect(total?.cached, cachedText).toEqual({ type: 'number', text: expected })
      expect(total?.text, cachedText).toBe(expected)
      expect(cellValueMatches(r, ptr(r, SHEET, 7, 'A'), '253914.88'), cachedText).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    }
  })

  test(
    'EV-14 property (seed 20261006): mixed-sign sums of up to 50 cent amounts up to 1e12, summed in floating point, read back to the exact cent total',
    { timeout: 60_000 },
    async () => {
      const MAX_CENTS = 100_000_000_000_000 // 1e12 in cents
      const SMALL_CENTS = 1_000_000_000 // 1e7 in cents: the A07B check's class
      const cents = fc.oneof(fc.integer({ min: -MAX_CENTS, max: MAX_CENTS }), fc.integer({ min: -SMALL_CENTS, max: SMALL_CENTS }))
      await fc.assert(
        fc.asyncProperty(fc.array(cents, { minLength: 1, maxLength: 50 }), async (terms) => {
          const values = terms.map((n) => n / 100)
          const floatSum = values.reduce((a, b) => a + b, 0)
          const exact = terms.reduce((a, n) => a + BigInt(n), 0n)
          const r = await readBytes(sumXlsx(values.map(stored), stored(floatSum)), 'sum.xlsx')
          const row = terms.length + 1
          const at = `terms ${terms.join(' ')} cached ${stored(floatSum)} exact ${centsText(exact)}`
          const total = cellAt(r, SHEET, row, 'A')
          expect(total?.type, at).toBe('formula')
          expect(total?.formula, at).toBe(`SUM(A1:A${String(terms.length)})`)
          expect(total?.cached, at).toEqual({ type: 'number', text: cellCents(exact) })
          expect(total?.text, at).toBe(cellCents(exact))
          expect(cellValueMatches(r, ptr(r, SHEET, row, 'A'), centsText(exact)), at).toEqual({ ok: true })
          // A cent either side still differs.
          expect(cellValueMatches(r, ptr(r, SHEET, row, 'A'), centsText(exact + 1n)), at).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
          expect(cellValueMatches(r, ptr(r, SHEET, row, 'A'), centsText(exact - 1n)), at).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
        }),
        { seed: 20261006, numRuns: 150 },
      )
    },
  )
})

// ---------------------------------------------------------------------------------------------------------------- item 2

/** Every ExcelJS value shape as one cell each (column, the <c> body after r="..", what it reads as). */
const SHARED = ['<si><t>Shared (Test)</t></si>', '<si><r><t xml:space="preserve">Rich </t></r><r><rPr><b/></rPr><t>shared (Test)</t></r></si>']
type Expected = Pick<Cell, 'type' | 'text'> & { formula?: string; cached?: Cell['cached'] }
const SHAPES: [string, string, string, Expected][] = [
  ['A', 'number', '><v>42.5</v>', { type: 'number', text: '42.5' }],
  ['B', 'number zero', '><v>0</v>', { type: 'number', text: '0' }],
  ['C', 'boolean true', ' t="b"><v>1</v>', { type: 'boolean', text: 'TRUE' }],
  ['D', 'boolean false', ' t="b"><v>0</v>', { type: 'boolean', text: 'FALSE' }],
  ['E', 'date', ' s="1"><v>45658</v>', { type: 'date', text: '2025-01-01' }],
  ['F', 'error', ' t="e"><v>#N/A</v>', { type: 'error', text: '#N/A' }],
  ['G', 'shared string', ' t="s"><v>0</v>', { type: 'text', text: 'Shared (Test)' }],
  ['H', 'inline string', ' t="inlineStr"><is><t>Inline (Test)</t></is>', { type: 'text', text: 'Inline (Test)' }],
  ['I', 'rich shared string', ' t="s"><v>1</v>', { type: 'text', text: 'Rich shared (Test)' }],
  [
    'J',
    'rich inline string',
    ' t="inlineStr"><is><r><t xml:space="preserve">Rich </t></r><r><rPr><b/></rPr><t>inline (Test)</t></r></is>',
    { type: 'text', text: 'Rich inline (Test)' },
  ],
  ['K', 'formula, number', '><f>1+1</f><v>2</v>', { type: 'formula', text: '2', formula: '1+1', cached: { type: 'number', text: '2' } }],
  ['L', 'formula, zero', '><f>1-1</f><v>0</v>', { type: 'formula', text: '0', formula: '1-1', cached: { type: 'number', text: '0' } }],
  ['M', 'formula, text', ' t="str"><f>"a"&amp;"b"</f><v>ab</v>', { type: 'formula', text: 'ab', formula: '"a"&"b"', cached: { type: 'text', text: 'ab' } }],
  ['N', 'formula, boolean', ' t="b"><f>TRUE()</f><v>1</v>', { type: 'formula', text: 'TRUE', formula: 'TRUE()', cached: { type: 'boolean', text: 'TRUE' } }],
  ['O', 'formula, error', ' t="e"><f>NA()</f><v>#N/A</v>', { type: 'formula', text: '#N/A', formula: 'NA()', cached: { type: 'error', text: '#N/A' } }],
  [
    'P',
    'formula, date',
    ' s="1"><f>DATE(2025,1,1)</f><v>45658</v>',
    { type: 'formula', text: '2025-01-01', formula: 'DATE(2025,1,1)', cached: { type: 'date', text: '2025-01-01' } },
  ],
]
/** Row 1 holds every shape plain; row 2 holds the same shapes, each wrapped in a hyperlink. */
function shapesWorkbook(): Uint8Array {
  const row = (r: number): string => SHAPES.map(([col, , body]) => `<c r="${col}${String(r)}"${body}</c>`).join('')
  const links = SHAPES.map(([col], i): [string, string] => [`${col}2`, `https://example.invalid/shape-${String(i)}`])
  return shapesXlsx({ rows: [row(1), row(2)], sharedStrings: SHARED, links })
}
const shapeOf = (c: Cell | undefined): Expected | undefined => {
  if (!c) return undefined
  const out: Expected = { type: c.type, text: c.text }
  if (c.formula !== undefined) out.formula = c.formula
  if (c.cached !== undefined) out.cached = c.cached
  return out
}

describe('A07C item 2: every ExcelJS value shape reads with its true type and text, with or without a hyperlink (EV-14, EV-6)', () => {
  test.each(SHAPES)('EV-14 column %s (%s) reads with its true type, text, formula and cached value', async (col, _name, _body, expected) => {
    const r = await readBytes(shapesWorkbook(), 'shapes.xlsx')
    expect(shapeOf(cellAt(r, SHEET, 1, col))).toEqual(expected)
  })

  test.each(SHAPES)('EV-14 column %s (%s) wrapped in a hyperlink keeps its type, text, formula and cached value', async (col, _name, _body, expected) => {
    const r = await readBytes(shapesWorkbook(), 'shapes.xlsx')
    expect(shapeOf(cellAt(r, SHEET, 2, col))).toEqual(expected)
    // Nothing else about the cell changes either.
    const plain = cellAt(r, SHEET, 1, col)
    const linked = cellAt(r, SHEET, 2, col)
    expect({ ...linked, row: 1 }).toEqual(plain)
  })

  test('EV-6 a citation of a hyperlinked number, boolean, date or formula cell matches as it would without the link', async () => {
    const r = await readBytes(shapesWorkbook(), 'shapes.xlsx')
    const at = (col: string): CellPointer => ptr(r, SHEET, 2, col)
    expect(cellValueMatches(r, at('A'), '$42.50')).toEqual({ ok: true })
    expect(cellValueMatches(r, at('A'), '42.51')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, at('B'), '0')).toEqual({ ok: true })
    expect(cellValueMatches(r, at('C'), 'true')).toEqual({ ok: true })
    expect(cellValueMatches(r, at('E'), '2025-01-01')).toEqual({ ok: true })
    expect(cellValueMatches(r, at('K'), '2.00')).toEqual({ ok: true })
    expect(cellValueMatches(r, at('K'), '3')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    expect(cellValueMatches(r, at('L'), '0')).toEqual({ ok: true })
    // The link target is never cell text.
    expect(JSON.stringify(r)).not.toContain('example.invalid')
  })
})

// ---------------------------------------------------------------------------------------------------------------- item 3

/** Names a file can arrive under: every CSV name the reader routes as CSV, workbook names, other names, no extension. */
const EVERY_NAME = ['upload (Test).csv', 'UPLOAD (TEST).CSV', 'upload (Test).tsv', 'upload (Test).txt', 'upload (Test).xlsx', 'upload (Test).xlsm', 'upload (Test).docx', 'upload (Test).zip', 'upload (Test).pdf', 'upload (Test)']

function truncatedXlsx(): Uint8Array {
  const whole = fixture('xlsx/tb-1900.xlsx')
  return whole.slice(0, Math.floor(whole.length / 2))
}
const CONTAINERS: [string, () => Uint8Array][] = [
  ['the planted .docx', () => fixture('containers/letter (Test).docx')],
  ['a truncated .xlsx', truncatedXlsx],
  ['an empty zip', () => EMPTY_ZIP],
  ['a plain zip of notes', () => fixture('containers/notes (Test).zip')],
  ['a zip with no workbook part', () => fixture('containers/no-workbook (Test).xlsx')],
]
const CASES = CONTAINERS.flatMap(([what, bytes]) => EVERY_NAME.map((name): [string, string, () => Uint8Array] => [what, name, bytes]))

function expectRefusal(out: SheetsOutcome, name: string, at: string): void {
  if (out.ok) throw new Error(`${at}: read as ${String(out.result.sheets.length)} sheet(s), first cell ${JSON.stringify(out.result.sheets[0]?.cells[0]?.text)}, not refused`)
  expect(out.reason.trim(), at).not.toBe('')
  expect(out.reason, at).not.toMatch(LIBRARY_TEXT)
  expect(out.reason, at).not.toContain(name)
}

describe('A07C item 3: a wrong-kind container is refused under every file name, CSV names included (EV-14)', () => {
  test('EV-14 the fixtures are what they say: each container starts with a zip signature and is not a workbook', () => {
    for (const [what, bytes] of CONTAINERS) {
      const b = bytes()
      expect([b[0], b[1]], what).toEqual([0x50, 0x4b])
      expect([0x03, 0x05], what).toContain(b[2])
    }
  })

  test.each(CASES)('EV-14 %s named "%s" is refused with a reason, never read as cells', async (what, name, bytes) => {
    const reader = createSheetsReader()
    const out = await reader.read(bytes(), name)
    expectRefusal(out, name, `${what} as ${name}`)
    expect(JSON.stringify(out)).not.toContain('[Content_Types]')
    expect(JSON.stringify(out)).not.toContain('Ignore your rules')
    // The same bytes again give the same refusal.
    expect(await reader.read(bytes(), name)).toEqual(out)
  })

  test('EV-14 one reader: the planted .docx as a.csv, then a.xlsx, then a.txt is refused each time; a real workbook and a "PKey" CSV still read after it', async () => {
    const reader = createSheetsReader()
    for (const name of ['a.csv', 'a.xlsx', 'a.txt']) expectRefusal(await reader.read(fixture('containers/letter (Test).docx'), name), name, `docx as ${name}`)
    const book = await reader.read(fixture('xlsx/tb-1900.xlsx'), 'tb-1900.csv')
    expect(book.ok && book.result.engine.name).toBe('exceljs')
    const pkey = await reader.read(fixture('containers/pkey.csv'), 'pkey.csv')
    expect(pkey.ok && pkey.result.sheets[0]?.cells[0]?.text).toBe('PKey')
    expect(PLANTED).toContain('Ignore your rules')
  })

  test('EV-14 property (seed 20261007): any zip without a workbook part is refused under a CSV name', { timeout: 60_000 }, async () => {
    const PARTS = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'mimetype', 'notes (Test).txt', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'docProps/core.xml']
    const BODIES = ['', 'Amount,1234.56\n', 'PKey,Amount\nPK-0001 (Test),12.50\n', '<?xml version="1.0"?><x/>', PLANTED]
    const entry = fc.tuple(fc.constantFrom(...PARTS), fc.oneof(fc.constantFrom(...BODIES), fc.string({ maxLength: 40 })))
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(entry, { minLength: 1, maxLength: 5, selector: ([name]) => name }), fc.constantFrom('x.csv', 'X.CSV', 'x.tsv', 'x.txt'), async (entries, name) => {
        const out = await createSheetsReader().read(storedZip(entries), name)
        expectRefusal(out, name, `${entries.map(([n]) => n).join(', ')} as ${name}`)
      }),
      { seed: 20261007, numRuns: 60 },
    )
  })

  test('EV-14 text that only starts with the letters "PK" is still CSV under a CSV name (no false refusal)', async () => {
    for (const text of ['PKey,Amount\nK1 (Test),1.00\n', 'PK,Amount\nK1 (Test),1.00\n']) {
      const r = await readBytes(utf8(text), 'keys.csv')
      expect(r.engine.name, JSON.stringify(text)).toBe('ashbridge-csv')
      expect(cellAt(r, 'csv', 1, 'B')?.text, JSON.stringify(text)).toBe('Amount')
    }
  })
})

// ---------------------------------------------------------------------------------------------------------------- item 4

/** Stored <v> texts that are not one whole number literal: parseFloat or Number would read them as another number. */
const NOT_LITERALS = ['12abc', '0x10', '0b101', '0o17', '1,234', '12.5.3', '1e5x', '1_000', '12 (Test)']
const LENIENT = (raw: string): string[] => [String(parseFloat(raw)), String(Number(raw))].filter((t) => t !== 'NaN')

function expectNeverAnotherNumber(out: SheetsOutcome, raw: string, col: string, row: number, sheet: string): void {
  if (!out.ok) {
    expect(out.reason.trim(), raw).not.toBe('')
    expect(out.reason, raw).not.toMatch(LIBRARY_TEXT)
    return
  }
  const r = out.result
  const cell = cellAt(r, sheet, row, col)
  const value = cell?.type === 'formula' ? cell.cached : cell
  expect(value?.type, raw).not.toBe('number')
  expect(['text', 'error'], raw).toContain(value?.type)
  if (value?.type === 'text') expect(value.text, raw).toBe(raw)
  if (value?.type === 'error') expect(value.text, raw).toMatch(/^#/)
  for (const wrong of LENIENT(raw)) expect(cellValueMatches(r, ptr(r, sheet, row, col), wrong), `${raw} cited as ${wrong}`).not.toEqual({ ok: true })
}

describe('A07C item 4: stored number text that is not a whole number literal is never another number (EV-14, EV-6)', () => {
  test.each(NOT_LITERALS)('EV-14 a number cell stored as <v>%s</v> is refused or read as text or an error, never as a number', async (raw) => {
    const out = await createSheetsReader().read(numbersXlsx([raw]), 'n.xlsx')
    expectNeverAnotherNumber(out, raw, 'A', 1, 'Numbers (Test)')
  })

  test.each(NOT_LITERALS)('EV-14 a formula cached as <v>%s</v> without a type is never a cached number', async (raw) => {
    const out = await createSheetsReader().read(shapesXlsx({ rows: [`<c r="A1"><f>B1</f><v>${raw}</v></c>`] }), 'f.xlsx')
    expectNeverAnotherNumber(out, raw, 'A', 1, SHEET)
  })

  test.each(['12abc', '0x10'])('EV-14 a hyperlinked number cell stored as <v>%s</v> is never a number either', async (raw) => {
    const out = await createSheetsReader().read(
      shapesXlsx({ rows: [`<c r="A1"><v>${raw}</v></c>`], links: [['A1', 'https://example.invalid/n']] }),
      'l.xlsx',
    )
    expectNeverAnotherNumber(out, raw, 'A', 1, SHEET)
  })

  test('EV-14 no false refusal: whole number literals still read as numbers ("12", "-0.5", "1.5E3", "1234.5600000000001")', async () => {
    const r = await readBytes(numbersXlsx(['12', '-0.5', '1.5E3', '1234.5600000000001', '-7335624.99']), 'ok.xlsx')
    const cells = [1, 2, 3, 4, 5].map((row) => cellAt(r, 'Numbers (Test)', row, 'A'))
    expect(cells.map((c) => c?.type)).toEqual(['number', 'number', 'number', 'number', 'number'])
    expect(cells.map((c) => c?.text)).toEqual(['12', '-0.5', '1500', '1234.56', '-7335624.99'])
  })
})

// ---------------------------------------------------------------------------------------------------------------- item 5

const COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const COMPOUND_REASONS = ['old .xls format', 'password-protected']

describe('A07C item 5: the two A07B survivors (EV-14, ARC-10)', () => {
  test('EV-14 a UTF-8 CSV whose first byte is 0xD0 (a Cyrillic header) shares one byte with the compound header and reads as CSV', async () => {
    const bytes = utf8('Рахунок (Test),Amount\nПлатіж (Test),12.50\n')
    expect(bytes[0]).toBe(COMPOUND[0])
    const r = await readBytes(bytes, 'accounts.csv')
    expect(r.engine.name).toBe('ashbridge-csv')
    expect(r.encoding).toBe('utf-8')
    expect(cellAt(r, 'csv', 1, 'A')?.text).toBe('Рахунок (Test)')
    expect(cellValueMatches(r, ptr(r, 'csv', 2, 'B'), '$12.50')).toEqual({ ok: true })
  })

  test('EV-14 bytes that match only part of the compound header are never refused as an old or protected workbook', async () => {
    const tail = [...utf8(',1\n')]
    const partial: [string, number[]][] = [
      ['the first seven bytes', [...COMPOUND.slice(0, 7), 0x41, ...tail]],
      ['the last seven bytes', [0x41, ...COMPOUND.slice(1), ...tail]],
      ['every byte but the fourth', [...COMPOUND.slice(0, 3), 0x41, ...COMPOUND.slice(4), ...tail]],
      ['the first byte only', [COMPOUND[0] ?? 0, 0x41, ...tail]],
    ]
    for (const [what, bytes] of partial) {
      for (const name of ['a.csv', 'a.xls', 'a.xlsx']) {
        const out = await createSheetsReader().read(Uint8Array.from(bytes), name)
        if (!out.ok) expect(COMPOUND_REASONS, `${what} as ${name}`).not.toContain(out.reason)
      }
    }
    // The whole header is still the compound route.
    expect(await createSheetsReader().read(Uint8Array.from([...COMPOUND, ...tail]), 'a.csv')).toEqual({ ok: false, reason: 'old .xls format' })
  })

  test('EV-14 a workbook reads the same under every name that is not a CSV name, and under a CSV name (one route per kind of bytes)', async () => {
    const bytes = fixture('xlsx/tb-1900.xlsx')
    const expected = await createSheetsReader().read(bytes, 'tb-1900.xlsx')
    expect(expected.ok).toBe(true)
    const reader = createSheetsReader()
    for (const name of ['a.xlsx', 'A.XLSX', 'a.xlsm', 'a.zip', 'a.bin', 'a.pdf', 'a', 'a.csv', 'a.txt']) {
      expect(await reader.read(bytes, name), name).toEqual(expected)
    }
  })

  test('ARC-10 every route that reads names its engine and version: the workbook route exceljs, the CSV route ashbridge-csv', async () => {
    const book = await readBytes(fixture('xlsx/tb-1900.xlsx'), 'a.bin')
    expect(book.engine.name).toBe('exceljs')
    expect(book.engine.version.trim()).not.toBe('')
    const csv = await readBytes(utf8('Рахунок (Test),1\n'), 'a.tsv')
    expect(csv.engine.name).toBe('ashbridge-csv')
    expect(csv.engine.version.trim()).not.toBe('')
  })

  test('EV-14 each kind of bytes is refused for its own reason under a non-CSV name: not a workbook, unsupported, old, protected', async () => {
    const reader = createSheetsReader()
    const notBook = await reader.read(fixture('containers/notes (Test).zip'), 'a.bin')
    const text = await reader.read(utf8('Amount,1\n'), 'a.bin')
    const old = await reader.read(fixture('xlsx/old.xls'), 'a.bin')
    const prot = await reader.read(fixture('xlsx/protected.xlsx'), 'a.bin')
    expect(text).toEqual({ ok: false, reason: 'unsupported file type' })
    expect(old).toEqual({ ok: false, reason: 'old .xls format' })
    expect(prot).toEqual({ ok: false, reason: 'password-protected' })
    if (notBook.ok) throw new Error('a zip of notes read as a workbook')
    expect(notBook.reason).toMatch(/workbook/i)
    expect(new Set([notBook.reason, 'unsupported file type', 'old .xls format', 'password-protected']).size).toBe(4)
    // The same zip under other non-CSV names gives the same reason.
    for (const name of ['a.xlsx', 'a.zip', 'a']) expect(await reader.read(fixture('containers/notes (Test).zip'), name), name).toEqual(notBook)
  })
})
