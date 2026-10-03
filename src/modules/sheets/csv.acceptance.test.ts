// A07 acceptance tests: the CSV reader (EV-14), card checks 1, 2, 3 and 9.
//
// Public API these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/contracts/sheets.ts (zod v4)
//     SheetResultSchema, type SheetResult: { fileFingerprint (sha256 hex of the bytes), engine: { name, version } (both
//       non-blank, ARC-10), readAt (ISO datetime from the injected clock), encoding?: 'utf-8' | 'utf-8-bom' |
//       'windows-1252' (CSV only), separator?: ',' | ';' | '\t' (CSV only), sheets: { name, hidden, cells: Cell[] }[] }
//     Cell: { row (1-based; for a CSV the record number, header = 1), column: { letter: 'C', number: 3 },
//       text (exactly as stored; ISO yyyy-mm-dd for a date; the cached value for a formula),
//       type: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'empty', formula?: string (without "="),
//       hiddenRow: boolean, hiddenColumn: boolean, merged: string | null (for example 'A1:C1') }
//       A CSV gives no types: its cells are 'text', or 'empty' when blank. Every field of every record is a cell.
//     CellPointerSchema, type CellPointer: { fileFingerprint, sheet (non-blank; 'csv' for a CSV), row (int >= 1), column: 'C' }
//     cellValueMatches(result, pointer, value): { ok: true }
//       | { ok: false; reason: 'no such cell' | 'empty cell' | 'value differs' | 'formula cell: cached value differs' }
//   src/modules/sheets/index.ts
//     createSheetsReader(): { name: string; isLive: boolean; read(bytes: Uint8Array, fileName: string): Promise<
//       { ok: true; result: SheetResult } | { ok: false; reason: string }> }   (.csv and .xlsx read; .xls refused)
//   src/modules/sheets/xlsx/index.ts
//     XLSX_LIBRARY: { name: string; version: string }   (the npm package that reads .xlsx and its exact pinned version)
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type CellPointer, type SheetResult } from '../../contracts/sheets'
import { createSheetsReader } from './index'
import { ACCENT_PAYEE, QUOTED_PAYEE, c01AnswerKey, fixture, sha256 } from './__fixtures__/harness'

const CHEQUING = 'c01/lakeview-chequing-4821.csv'

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
const readFixture = (rel: string): Promise<SheetResult> => readBytes(fixture(rel), rel.split('/').pop() ?? rel)
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

const csvCells = (r: SheetResult) => {
  const sheet = r.sheets.find((s) => s.name === 'csv')
  if (!sheet) throw new Error('no csv sheet')
  return sheet.cells
}
const cellAt = (r: SheetResult, row: number, letter: string) =>
  csvCells(r).find((c) => c.row === row && c.column.letter === letter)
/** The cells as plain rows of text, in column order. */
const table = (r: SheetResult): string[][] => {
  const rows = new Map<number, { n: number; text: string }[]>()
  for (const c of csvCells(r)) rows.set(c.row, [...(rows.get(c.row) ?? []), { n: c.column.number, text: c.text }])
  return [...rows.keys()]
    .sort((a, b) => a - b)
    .map((k) => (rows.get(k) ?? []).sort((a, b) => a.n - b.n).map((c) => c.text))
}
const simple = (r: SheetResult) =>
  csvCells(r)
    .map((c) => ({ row: c.row, column: c.column.letter, number: c.column.number, text: c.text, type: c.type }))
    .sort((a, b) => a.row - b.row || a.number - b.number)
const at = (r: SheetResult, row: number, column: string): CellPointer => ({ fileFingerprint: r.fileFingerprint, sheet: 'csv', row, column })
const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

describe('A07 check 1: C01 chequing download, every cell with sheet, row and column', () => {
  test('EV-14 reading C01 chequing gives one sheet "csv" with every record as a row of five cells A to E, header in row 1', async () => {
    const bytes = fixture(CHEQUING)
    const r = await readBytes(bytes, 'lakeview-chequing-4821.csv')
    expect(r.fileFingerprint).toBe(sha256(bytes))
    expect(r.sheets.map((s) => ({ name: s.name, hidden: s.hidden }))).toEqual([{ name: 'csv', hidden: false }])
    const rows = table(r)
    const key = c01AnswerKey().accounts.find((a) => a.key === 'CHQ')
    expect(rows).toHaveLength((key?.rowsInExport ?? 0) + 1)
    expect(rows[0]).toEqual(['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance'])
    expect(rows.every((row) => row.length === 5)).toBe(true)
    expect(rows[1]).toEqual(['2025-01-01', 'PRE-AUTH DEBIT BRIGHTPATH BOOKKEEPING TEST INC', '282.50', '', '7729.19'])
    const cells = csvCells(r)
    expect(cells).toHaveLength(rows.length * 5)
    expect(new Set(cells.map((c) => `${c.column.letter}${String(c.column.number)}`))).toEqual(new Set(['A1', 'B2', 'C3', 'D4', 'E5']))
    expect(cells.every((c) => !c.hiddenRow && !c.hiddenColumn && c.merged === null)).toBe(true)
  })

  test("EV-14 every chequing amount in C01's answer key is found by its pointer (row = line, Withdrawals or Deposits) and cellValueMatches holds", async () => {
    const r = await readFixture(CHEQUING)
    const tx = c01AnswerKey().transactions.filter((t) => t.acct === 'CHQ')
    expect(tx.length).toBeGreaterThan(500)
    const misses = tx
      .map((t) => ({ t, res: cellValueMatches(r, at(r, t.line, t.amount < 0 ? 'C' : 'D'), money(t.amount)) }))
      .filter((x) => !x.res.ok)
      .map((x) => x.t.id)
    expect(misses).toEqual([])
  })

  test("EV-14 the closing balance in C01's answer key is the last row's Balance cell", async () => {
    const r = await readFixture(CHEQUING)
    const key = c01AnswerKey().accounts.find((a) => a.key === 'CHQ')
    if (!key) throw new Error('no CHQ account in the answer key')
    const last = key.rowsInExport + 1
    expect(cellAt(r, last, 'E')?.text).toBe('131184.97')
    expect(cellValueMatches(r, at(r, last, 'E'), money(key.closingBalance))).toEqual({ ok: true })
  })

  test('EV-14 planted faults: a wrong cent, the right amount in the empty Deposits cell and the next row are each refused', async () => {
    const r = await readFixture(CHEQUING)
    expect(cellValueMatches(r, at(r, 2, 'C'), '$282.50')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(r, 2, 'C'), '$282.51')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, at(r, 2, 'D'), '$282.50')).toEqual({ ok: false, reason: 'empty cell' })
    expect(cellValueMatches(r, at(r, 3, 'C'), '$282.50')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-14 the two C01 card downloads read with four cells per row and one row per record', async () => {
    const key = c01AnswerKey()
    for (const [file, acct] of [
      ['c01/aurora-business-card-7712.csv', 'BCD'],
      ['c01/aurora-personal-card-3309.csv', 'PCD'],
    ] as const) {
      const r = await readFixture(file)
      const rows = table(r)
      expect(rows[0], file).toEqual(['Transaction Date', 'Posting Date', 'Description', 'Amount'])
      expect(rows, file).toHaveLength((key.accounts.find((a) => a.key === acct)?.rowsInExport ?? 0) + 1)
      expect(rows.every((row) => row.length === 4), file).toBe(true)
    }
  })
})

describe('A07 check 2: encodings, line ends and separators', () => {
  test('EV-14 the BOM, CRLF and Windows-1252 copies give the same cells as the clean UTF-8 file, accents read correctly', async () => {
    const clean = await readFixture('csv-faults/chequing-accents.csv')
    expect(cellAt(clean, 3, 'B')?.text).toBe(ACCENT_PAYEE)
    for (const copy of ['chequing-bom.csv', 'chequing-crlf.csv', 'chequing-cp1252.csv']) {
      const r = await readFixture(`csv-faults/${copy}`)
      expect(cellAt(r, 3, 'B')?.text, copy).toBe(ACCENT_PAYEE)
      expect(cellAt(r, 1, 'A')?.text, `${copy}: no BOM in the first cell`).toBe('Date')
      expect(simple(r), copy).toEqual(simple(clean))
      expect(r.fileFingerprint, copy).not.toBe(clean.fileFingerprint)
    }
  })

  test('EV-14 the result names the encoding: utf-8, utf-8-bom, utf-8 for CRLF, windows-1252', async () => {
    const enc = async (rel: string) => (await readFixture(rel)).encoding
    expect(await enc('csv-faults/chequing-accents.csv')).toBe('utf-8')
    expect(await enc('csv-faults/chequing-bom.csv')).toBe('utf-8-bom')
    expect(await enc('csv-faults/chequing-crlf.csv')).toBe('utf-8')
    expect(await enc('csv-faults/chequing-cp1252.csv')).toBe('windows-1252')
    expect(await enc(CHEQUING)).toBe('utf-8')
  })

  test('EV-14 the semicolon copy names its separator and gives the same cells as the comma file', async () => {
    const comma = await readFixture(CHEQUING)
    const semi = await readFixture('csv-faults/chequing-semicolon.csv')
    expect(comma.separator).toBe(',')
    expect(semi.separator).toBe(';')
    expect(simple(semi)).toEqual(simple(comma))
  })

  test('EV-14 a tab-separated file names the tab; a first line with both commas and semicolons is ambiguous and stays comma', async () => {
    const tab = await readBytes(utf8('Date\tPayee (Test)\tAmount\n2025-01-02\tCORNER STORE (Test)\t12.50\n'), 'tab.csv')
    expect(tab.separator).toBe('\t')
    expect(table(tab)).toEqual([
      ['Date', 'Payee (Test)', 'Amount'],
      ['2025-01-02', 'CORNER STORE (Test)', '12.50'],
    ])
    const mixed = await readBytes(utf8('Date;Payee,Amount\n2025-01-02;SHOP (Test),12.50\n'), 'mixed.csv')
    expect(mixed.separator).toBe(',')
    expect(table(mixed)).toEqual([
      ['Date;Payee', 'Amount'],
      ['2025-01-02;SHOP (Test)', '12.50'],
    ])
  })

  test('EV-14 CRLF leaves no carriage return in any cell', async () => {
    const r = await readFixture('csv-faults/chequing-crlf.csv')
    expect(csvCells(r).filter((c) => c.text.includes('\r'))).toEqual([])
  })
})

describe('A07 check 3: values kept as stored text', () => {
  test('EV-14 the quoted payee with a comma, doubled quotes and a line break is one cell; the next record is the next row', async () => {
    const r = await readFixture('csv-faults/chequing-quoted.csv')
    expect(cellAt(r, 3, 'B')?.text).toBe(QUOTED_PAYEE)
    expect(cellAt(r, 3, 'C')?.text).toBe('44.51')
    expect(cellAt(r, 4, 'A')?.text).toBe('2025-01-06')
    expect(table(r)).toHaveLength(562)
    expect(table(r).every((row) => row.length === 5)).toBe(true)
  })

  test('EV-14 the leading-zero reference keeps its zeros, and a value "1" is not the reference "000001"', async () => {
    const r = await readFixture('csv-faults/chequing-reference.csv')
    expect(cellAt(r, 1, 'F')?.text).toBe('Reference')
    expect(cellAt(r, 2, 'F')).toMatchObject({ text: '000001', type: 'text' })
    expect(cellAt(r, 562, 'F')?.text).toBe('000561')
    expect(cellValueMatches(r, at(r, 2, 'F'), '000001')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(r, 2, 'F'), '1')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-14 "1.2E3" stays text and is not 1200', async () => {
    const r = await readFixture('csv-faults/chequing-scientific.csv')
    expect(cellAt(r, 3, 'C')).toMatchObject({ text: '1.2E3', type: 'text' })
    expect(cellValueMatches(r, at(r, 3, 'C'), '1200')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, at(r, 3, 'C'), '1200.00')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, at(r, 3, 'C'), '1.2e3')).toEqual({ ok: true })
  })

  test('EV-14 the blank cell and the "0" cell differ: blank is empty, "0" is zero', async () => {
    const r = await readFixture('csv-faults/chequing-blank-zero.csv')
    expect(cellAt(r, 2, 'C')?.text).toBe('0')
    expect(cellAt(r, 2, 'C')?.type).not.toBe('empty')
    expect(cellAt(r, 2, 'D')).toMatchObject({ text: '', type: 'empty' })
    expect(cellValueMatches(r, at(r, 2, 'C'), '0')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(r, 2, 'C'), '$0.00')).toEqual({ ok: true })
    expect(cellValueMatches(r, at(r, 2, 'D'), '0')).toEqual({ ok: false, reason: 'empty cell' })
  })

  test('EV-14 leading and trailing spaces in an unquoted value are kept as stored', async () => {
    const r = await readBytes(utf8('Payee,Note\n  PADDED SHOP (Test) ,x\n'), 'spaces.csv')
    expect(cellAt(r, 2, 'A')?.text).toBe('  PADDED SHOP (Test) ')
  })
})

describe('A07 check 9: RFC 4180 round trip', () => {
  // No ";" or tab: separator detection has its own tests above, and this property is about RFC 4180 quoting.
  const ALPHABET = ['a', 'Z', '0', '9', ' ', ',', '"', '\n', '\r', 'é', '’', '–', '.', '-', '$']
  const field = fc.array(fc.constantFrom(...ALPHABET), { maxLength: 8 }).map((a) => a.join(''))
  const tableArb = fc
    .integer({ min: 2, max: 5 })
    .chain((cols) => fc.array(fc.array(field, { minLength: cols, maxLength: cols }), { minLength: 1, maxLength: 6 }))

  const write = (t: string[][], eol: string, quoteAll: boolean, finalEol: boolean): string =>
    t
      .map((row) => row.map((v) => (quoteAll || /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','))
      .join(eol) + (finalEol ? eol : '')

  test('EV-14 property (seed 20261002): any table of strings written as RFC 4180 CSV reads back as the same table', async () => {
    await fc.assert(
      fc.asyncProperty(tableArb, fc.constantFrom('\n', '\r\n'), fc.boolean(), fc.boolean(), async (t, eol, quoteAll, finalEol) => {
        const r = await readBytes(utf8(write(t, eol, quoteAll, finalEol)), 'roundtrip.csv')
        expect(table(r)).toEqual(t)
      }),
      { seed: 20261002, numRuns: 300 },
    )
  })

  test('EV-14 fixed examples: an empty quoted field, a lone quote, a CR inside quotes and a trailing empty field', async () => {
    const t = [
      ['', '"', 'a\rb'],
      ['x,y', '', ''],
    ]
    for (const eol of ['\n', '\r\n']) {
      const r = await readBytes(utf8(`"","""","a\rb"${eol}"x,y",,${eol}`), 'fixed.csv')
      expect(table(r)).toEqual(t)
    }
  })
})
