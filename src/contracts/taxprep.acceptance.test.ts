/**
 * F03 Taxprep CSV contract: acceptance tests (spec-writer; builders never edit this file).
 *
 * The contract these tests pin (src/contracts/taxprep.ts):
 *
 *   type CellId = { form: string; copy?: number; cell: string }
 *     `T4SLIP[1].TOATSC4` -> { form: 'T4SLIP', copy: 1, cell: 'TOATSC4' }
 *     `S100.1002`         -> { form: 'S100', cell: '1002' }            (no copy key)
 *     `S1.ADD[1].DESC`    -> { form: 'S1.ADD', copy: 1, cell: 'DESC' } (form = everything before the
 *                            last dot; at most one copy index, written just before the last dot)
 *   parseCellId(text): { ok: true; id: CellId } | { ok: false; reason: string }
 *   formatCellId(id): string
 *
 *   type TaxprepHeader = { taxpayerName: string; returnId: string; language: string }
 *   type TaxprepRow = { id: CellId; thisYear: string | null; priorYear?: string | null }
 *     thisYear null = blank = "no import" (RT-12); priorYear absent = the row has no prior-year field;
 *     priorYear null = the field is present but blank.
 *   type TaxprepFile = { header: TaxprepHeader; rows: TaxprepRow[] }
 *   type NaturalKeyRegistry = Readonly<Record<string, readonly string[]>>   (form -> key cells, RT-7)
 *
 *   parseTaxprepCsv(bytes: Uint8Array, options?: { naturalKeys?: NaturalKeyRegistry }): ParseResult
 *   type ParseResult = { ok: true; file: TaxprepFile } | { ok: false; faults: TaxprepFault[] }
 *   type TaxprepFault = { code: TaxprepFaultCode; reason: string; line?: number; row?: string }
 *     line is 1-based (the header is line 1); row is the raw text of that line.
 *   writeTaxprepCsv(file: TaxprepFile): Uint8Array   (UTF-8, no BOM, LF after every line;
 *     throws with a plain reason when a value cannot be written under the fixed settings)
 *
 *   TAXPREP_EXPORT_SETTINGS (RT-9), T2_YEAR_START_ID, T2_YEAR_END_ID, isIgnoredOnImport (RT-13),
 *   CELL_CLASSES, type CellClass, isCellClass (RT-14).
 */
import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { describe, expect, expectTypeOf, test } from 'vitest'
import {
  CELL_CLASSES,
  T2_YEAR_END_ID,
  T2_YEAR_START_ID,
  TAXPREP_EXPORT_SETTINGS,
  formatCellId,
  isCellClass,
  isIgnoredOnImport,
  parseCellId,
  parseTaxprepCsv,
  writeTaxprepCsv,
  type CellClass,
  type CellId,
  type NaturalKeyRegistry,
  type ParseResult,
  type TaxprepFaultCode,
  type TaxprepFile,
  type TaxprepRow,
} from './taxprep'

const SEED = 20261001

const goldenUrl = (name: string) => new URL(`./__golden__/${name}`, import.meta.url)
const readGolden = (name: string): Buffer => readFileSync(goldenUrl(name))
const decode = (bytes: Uint8Array): string =>
  new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)

const CCH_EXAMPLE = 'cch-example.csv'
const NATURAL_KEYS = 'natural-keys.csv'
const REGISTRY: NaturalKeyRegistry = { S50: ['SIN'], S8: ['CLASS'] }

const SAMPLE_CLIENTS = [
  '01-maple-ridge',
  '02-halton-haulage',
  '03-bluewater-renovations',
  '04-lakeshore-eats',
  '05-eglinton-holdings',
  '06-eglinton-retail',
  '07-riverdale-rentals',
  '08-queen-west-design',
  '09-scarborough-robotics',
  '10-danforth-cleaning',
] as const
const sampleImport = (client: string): Buffer =>
  readFileSync(new URL(`../../reference/sample-clients/${client}/taxprep/import.csv`, import.meta.url))

/** The golden text with line `lineNo` (1-based) replaced. */
function withLine(name: string, lineNo: number, text: string): Buffer {
  const lines = readGolden(name).toString('utf8').split('\n')
  expect(lines[lineNo - 1], `golden ${name} has a line ${String(lineNo)}`).toBeDefined()
  lines[lineNo - 1] = text
  return Buffer.from(lines.join('\n'), 'utf8')
}

function parsedOk(result: ParseResult): TaxprepFile {
  if (!result.ok) throw new Error(`expected the file to parse, got faults ${JSON.stringify(result.faults)}`)
  return result.file
}

/** Expects a refusal carrying `code`, a plain reason and (for row faults) the line and the row text. */
function expectRefused(
  result: ParseResult,
  code: TaxprepFaultCode,
  at?: { line: number; row?: string },
): void {
  expect(result.ok, 'the file must be refused').toBe(false)
  if (result.ok) return
  const fault = result.faults.find((f) => f.code === code)
  expect(fault, `expected a "${code}" fault, got ${JSON.stringify(result.faults)}`).toBeDefined()
  if (!fault) return
  expect(fault.reason.trim().length, 'the reason is a plain sentence').toBeGreaterThan(10)
  expect(fault.reason).not.toBe(code)
  if (at) {
    expect(fault.line).toBe(at.line)
    if (at.row !== undefined) expect(fault.row).toBe(at.row)
  }
}

describe('F03 Taxprep CSV contract', () => {
  // ---------------------------------------------------------------- check 1: golden round trip
  test('RT-3 ARC-14 the CCH example file parses then writes back the same bytes (golden)', async () => {
    const golden = readGolden(CCH_EXAMPLE)
    const out = writeTaxprepCsv(parsedOk(parseTaxprepCsv(golden)))
    expect(out).toBeInstanceOf(Uint8Array)
    await expect(decode(out)).toMatchFileSnapshot(`./__golden__/${CCH_EXAMPLE}`)
    expect(Buffer.from(out).equals(golden), 'byte for byte').toBe(true)
  })

  test('RT-3 the CCH example parses into the header, a zero, a blank, a date, copy indexes and a row with no prior-year field', () => {
    const file = parsedOk(parseTaxprepCsv(readGolden(CCH_EXAMPLE)))
    expect(file.header).toStrictEqual({
      taxpayerName: 'Société Birchwood Exemple (Test)',
      returnId: '0',
      language: '0',
    })
    expect(file.rows).toHaveLength(11)
    const [t4a, t4b, s100a, s100b, s125, netIncome, dateInc, addDesc, name, sin, pct] = file.rows
    expect(t4a).toStrictEqual({
      id: { form: 'T4SLIP', copy: 1, cell: 'TOATSC4' },
      thisYear: '57565.00',
      priorYear: '51200.00',
    })
    expect(t4b).toStrictEqual({ id: { form: 'T4SLIP', copy: 2, cell: 'TOATSC4' }, thisYear: '0', priorYear: null })
    expect(s100a).toStrictEqual({ id: { form: 'S100', cell: '1002' }, thisYear: '131184.97', priorYear: '120000.00' })
    expect(s100b).toStrictEqual({ id: { form: 'S100', cell: '3700' }, thisYear: '-20000.00' })
    expect(s100b !== undefined && 'priorYear' in s100b, 'no prior-year field means no priorYear key').toBe(false)
    expect(s125).toStrictEqual({ id: { form: 'S125', cell: '8000' }, thisYear: null, priorYear: '186700.00' })
    expect(netIncome).toStrictEqual({ id: { form: 'S1', cell: 'NETINCOME' }, thisYear: null })
    expect(dateInc).toStrictEqual({ id: { form: 'T2', cell: 'DATEINC' }, thisYear: '2019-03-15' })
    expect(addDesc).toStrictEqual({
      id: { form: 'S1.ADD', copy: 1, cell: 'DESC' },
      thisYear: '50% of meals and entertainment',
    })
    expect(name).toStrictEqual({ id: { form: 'S50', copy: 1, cell: 'NAME' }, thisYear: 'Jane Example (Test)' })
    expect(sin).toStrictEqual({ id: { form: 'S50', copy: 1, cell: 'SIN' }, thisYear: '046454286' })
    expect(pct).toStrictEqual({ id: { form: 'S50', copy: 1, cell: 'COMMONPCT' }, thisYear: '100.00' })
  })

  test('RT-3 ARC-14 sample client 01 import.csv round-trips byte for byte', () => {
    const bytes = sampleImport('01-maple-ridge')
    const file = parsedOk(parseTaxprepCsv(bytes, { naturalKeys: REGISTRY }))
    expect(file.header).toStrictEqual({
      taxpayerName: 'Maple Ridge Consulting Inc. (Test)',
      returnId: 'TEST-01',
      language: 'EN',
    })
    expect(file.rows).toHaveLength(26)
    expect(Buffer.from(writeTaxprepCsv(file)).equals(bytes)).toBe(true)
  })

  test.each(SAMPLE_CLIENTS)('RT-3 RT-9 no false alarm: sample client %s import.csv parses clean and round-trips', (client) => {
    const bytes = sampleImport(client)
    const file = parsedOk(parseTaxprepCsv(bytes, { naturalKeys: REGISTRY }))
    expect(decode(writeTaxprepCsv(file))).toBe(decode(bytes))
  })

  // ---------------------------------------------------------------- check 2: other formats refused
  test('RT-9 the fixed export settings are one constant: comma columns, leading minus, point decimal, no thousands separator', () => {
    expect(TAXPREP_EXPORT_SETTINGS).toMatchObject({
      columnSeparator: ',',
      negativeNumbers: 'leading-minus',
      decimalSeparator: '.',
      thousandsSeparator: null,
    })
  })

  test.each([
    ['semicolon', ';'],
    ['tab', '\t'],
    ['pipe', '|'],
  ])('RT-9 a file written with %s column separators is refused', (_label, sep) => {
    const text = readGolden(CCH_EXAMPLE)
      .toString('utf8')
      .split('\n')
      .map((line, i) => (i === 0 ? line : line.replaceAll(',', sep)))
      .join('\n')
    expectRefused(parseTaxprepCsv(Buffer.from(text, 'utf8')), 'separator')
  })

  test('RT-9 a semicolon file with decimal commas (57565,00) is refused', () => {
    const text = readGolden(CCH_EXAMPLE)
      .toString('utf8')
      .split('\n')
      .map((line, i) => (i === 0 ? line : line.replaceAll(',', ';').replace(/(\d)\.(\d\d)(?=;|$)/g, '$1,$2')))
      .join('\n')
    expect(text).toContain('T4SLIP[1].TOATSC4;57565,00;51200,00')
    expectRefused(parseTaxprepCsv(Buffer.from(text, 'utf8')), 'separator')
  })

  test.each([
    ['a quoted number with a thousands separator', 'T4SLIP[1].TOATSC4,"57,565.00",51200.00', 2],
    ['a negative in parentheses', 'S100.3700,(20000.00)', 5],
    ['a trailing minus', 'S100.3700,20000.00-', 5],
    ['a currency symbol', 'T4SLIP[1].TOATSC4,$57565.00,51200.00', 2],
    ['a thousands separator in the prior-year field', 'S100.1002,131184.97,"120,000.00"', 4],
  ])('RT-9 a number written with %s is refused with a plain reason', (_label, row, line) => {
    expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, line, row)), 'number-format', { line, row })
  })

  test('RT-9 a row with an unquoted thousands separator (more than three fields) is refused at its line', () => {
    const result = parseTaxprepCsv(withLine(CCH_EXAMPLE, 4, 'S100.1002,131,184.97,120000.00'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.faults.some((f) => f.line === 4 && f.reason.trim().length > 10)).toBe(true)
  })

  test('RT-9 the writer refuses a value it cannot write under the fixed settings', () => {
    const header = { taxpayerName: 'Writer Example (Test)', returnId: '0', language: '0' }
    const comma: TaxprepRow = { id: { form: 'S50', copy: 1, cell: 'NAME' }, thisYear: 'Example, Jane (Test)' }
    const newline: TaxprepRow = { id: { form: 'S1.ADD', copy: 1, cell: 'DESC' }, thisYear: 'Line one\nLine two' }
    expect(() => writeTaxprepCsv({ header, rows: [comma] })).toThrow(/separator|comma/i)
    expect(() => writeTaxprepCsv({ header, rows: [newline] })).toThrow(/line|newline/i)
  })

  // ---------------------------------------------------------------- check 3: blank is "no import"
  test('RT-12 a blank value parses as "no import" (null), never as zero, and "0" stays a value', () => {
    const file = parsedOk(parseTaxprepCsv(readGolden(CCH_EXAMPLE)))
    const byId = new Map(file.rows.map((r) => [formatCellId(r.id), r]))
    expect(byId.get('S1.NETINCOME')?.thisYear).toBeNull()
    expect(byId.get('S125.8000')?.thisYear).toBeNull()
    expect(byId.get('S125.8000')?.thisYear).not.toBe('0')
    expect(byId.get('T4SLIP[2].TOATSC4')?.thisYear).toBe('0')
    expect(byId.get('T4SLIP[2].TOATSC4')?.priorYear).toBeNull()
  })

  test('RT-12 a blank written back stays blank: a null value writes an empty field, not a zero', () => {
    const file: TaxprepFile = {
      header: { taxpayerName: 'Blank Example (Test)', returnId: '0', language: '0' },
      rows: [
        { id: { form: 'S1', cell: 'NETINCOME' }, thisYear: null },
        { id: { form: 'S100', cell: '1002' }, thisYear: '0', priorYear: null },
      ],
    }
    expect(decode(writeTaxprepCsv(file))).toBe('[Blank Example (Test)|0|0]\nS1.NETINCOME,\nS100.1002,0,\n')
  })

  // ---------------------------------------------------------------- check 4: year start and end ignored
  test('RT-13 the T2 year-start and year-end identifiers are marked "ignored on import"', () => {
    expect(T2_YEAR_START_ID).not.toBe(T2_YEAR_END_ID)
    for (const text of [T2_YEAR_START_ID, T2_YEAR_END_ID]) {
      const parsed = parseCellId(text)
      expect(parsed.ok, `${text} follows the identifier grammar`).toBe(true)
      if (parsed.ok) expect(isIgnoredOnImport(parsed.id)).toBe(true)
    }
  })

  test('RT-13 planted fault: an ordinary cell (or another T2 date) is not marked ignored on import', () => {
    expect(isIgnoredOnImport({ form: 'S100', cell: '1002' })).toBe(false)
    expect(isIgnoredOnImport({ form: 'T2', cell: 'DATEINC' })).toBe(false)
    expect(isIgnoredOnImport({ form: 'T4SLIP', copy: 1, cell: 'TOATSC4' })).toBe(false)
  })

  // ---------------------------------------------------------------- check 5: natural keys
  test('RT-7 repeating-form rows with distinct natural keys parse, whatever the copy order', () => {
    const file = parsedOk(parseTaxprepCsv(readGolden(NATURAL_KEYS), { naturalKeys: REGISTRY }))
    expect(file.rows).toHaveLength(8)
  })

  test('RT-7 two shareholder copies with the same SIN are refused as duplicates', () => {
    const row = 'S50[1].SIN,046454294'
    const result = parseTaxprepCsv(withLine(NATURAL_KEYS, 5, row), { naturalKeys: REGISTRY })
    expectRefused(result, 'duplicate-key', { line: 5, row })
    if (!result.ok) expect(result.faults.find((f) => f.code === 'duplicate-key')?.reason).toMatch(/S50/)
  })

  test('RT-7 two CCA copies with the same class number are refused as duplicates', () => {
    const row = 'S8[2].CLASS,8'
    expectRefused(parseTaxprepCsv(withLine(NATURAL_KEYS, 8, row), { naturalKeys: REGISTRY }), 'duplicate-key', {
      line: 8,
      row,
    })
  })

  // ---------------------------------------------------------------- check 6: property round trip
  test('RT-3 property: any list of valid rows survives write then parse unchanged (fixed seed)', () => {
    const segment = fc.stringMatching(/^[A-Z][A-Z0-9]{0,5}$/)
    const form = fc.array(segment, { minLength: 1, maxLength: 2 }).map((s) => s.join('.'))
    const cell = fc.stringMatching(/^[A-Z0-9]{1,8}$/).filter((c) => c !== 'SIN')
    const copy = fc.option(fc.integer({ min: 1, max: 99 }), { nil: undefined })
    const cellId: fc.Arbitrary<CellId> = fc
      .record({ form, copy, cell })
      .map(({ form: f, copy: n, cell: c }) => (n === undefined ? { form: f, cell: c } : { form: f, copy: n, cell: c }))
    const amount = fc
      .tuple(fc.boolean(), fc.integer({ min: 0, max: 999_999_999 }), fc.integer({ min: 0, max: 99 }))
      .map(([neg, whole, cents]) => `${neg && whole + cents > 0 ? '-' : ''}${String(whole)}.${String(cents).padStart(2, '0')}`)
    const date = fc
      .integer({ min: Date.UTC(1990, 0, 1), max: Date.UTC(2030, 11, 31) })
      .map((ms) => new Date(ms).toISOString().slice(0, 10))
    const text = fc.stringMatching(/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ().%&'-]{0,30}[A-Za-z)]$/)
    const value: fc.Arbitrary<string | null> = fc.oneof(
      fc.constant(null),
      fc.constant('0'),
      amount,
      date,
      text,
      fc.integer({ min: 1, max: 99_999 }).map(String),
    )
    const prior = fc.option(value, { nil: undefined })
    const row: fc.Arbitrary<TaxprepRow> = fc
      .record({ id: cellId, thisYear: value, priorYear: prior })
      .map(({ id, thisYear, priorYear }) => (priorYear === undefined ? { id, thisYear } : { id, thisYear, priorYear }))
    const key = (id: CellId) => `${id.form}${id.copy === undefined ? '' : `[${String(id.copy)}]`}.${id.cell}`
    const header = fc.record({
      taxpayerName: fc.stringMatching(/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .&'()-]{0,40}$/),
      returnId: fc.stringMatching(/^[A-Z0-9-]{1,10}$/),
      language: fc.constantFrom('0', '1', 'EN', 'FR'),
    })
    // fc.record builds null-prototype objects; spread into plain objects so toStrictEqual compares data only.
    const fileArb: fc.Arbitrary<TaxprepFile> = fc
      .record({ header, rows: fc.uniqueArray(row, { selector: (r) => key(r.id), maxLength: 30 }) })
      .map(({ header: h, rows }) => ({ header: { ...h }, rows }))

    fc.assert(
      fc.property(fileArb, (file) => {
        const bytes = writeTaxprepCsv(file)
        const parsed = parsedOk(parseTaxprepCsv(bytes))
        expect(parsed).toStrictEqual(file)
        expect(Buffer.from(writeTaxprepCsv(parsed)).equals(Buffer.from(bytes))).toBe(true)
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  // ---------------------------------------------------------------- check 7: the fault set
  test('RT-9 fault set: a byte-order mark is refused', () => {
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), readGolden(CCH_EXAMPLE)])
    expectRefused(parseTaxprepCsv(bytes), 'bom')
  })

  test('RT-9 fault set: CRLF line endings are refused', () => {
    const text = readGolden(CCH_EXAMPLE).toString('utf8').replaceAll('\n', '\r\n')
    expectRefused(parseTaxprepCsv(Buffer.from(text, 'utf8')), 'crlf')
  })

  test('RT-9 fault set: Windows-1252 accents (not UTF-8) are refused', () => {
    const golden = readGolden(CCH_EXAMPLE)
    const accent = golden.indexOf(Buffer.from('é', 'utf8'))
    expect(accent, 'the golden header carries an accent').toBeGreaterThan(0)
    const bytes = Buffer.concat([golden.subarray(0, accent), Buffer.from([0xe9]), golden.subarray(accent + 2)])
    expectRefused(parseTaxprepCsv(bytes), 'encoding')
  })

  test('RT-9 fault set: another column separator is refused', () => {
    expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, 4, 'S100.1002;131184.97;120000.00')), 'separator')
  })

  test.each([
    ['1.31185E+05'],
    ['1.31185e+05'],
    ['1E+05'],
  ])('RT-9 fault set: scientific notation %s is refused', (value) => {
    const row = `S100.1002,${value},120000.00`
    expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, 4, row)), 'scientific-notation', { line: 4, row })
  })

  test('RT-9 fault set: a SIN that lost its leading zero is refused', () => {
    const row = 'S50[1].SIN,46454286'
    expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, 11, row)), 'leading-zeros-lost', { line: 11, row })
  })

  test.each([['03/15/2019'], ['15/03/2019'], ['2019/03/15'], ['15-Mar-19'], ['2019-3-15']])(
    'RT-9 fault set: a reformatted date %s is refused',
    (value) => {
      const row = `T2.DATEINC,${value}`
      expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, 8, row)), 'date-format', { line: 8, row })
    },
  )

  test.each([
    ['a dash (a spreadsheet zero)', 'T4SLIP[2].TOATSC4,-,'],
    ['spaces only', 'T4SLIP[2].TOATSC4, ,'],
  ])('RT-9 RT-12 fault set: blank versus "0", %s is refused as neither blank nor zero', (_label, row) => {
    expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, 3, row)), 'blank-or-zero', { line: 3, row })
  })

  test('RT-3 a file without the [name|return id|language] header is refused', () => {
    const text = readGolden(CCH_EXAMPLE).toString('utf8').split('\n').slice(1).join('\n')
    expectRefused(parseTaxprepCsv(Buffer.from(text, 'utf8')), 'header', { line: 1 })
  })

  // ---------------------------------------------------------------- check 8: identifier grammar
  test.each([
    ['T4SLIP[1].TOATSC4', { form: 'T4SLIP', copy: 1, cell: 'TOATSC4' }],
    ['T4SLIP[12].TOATSC4', { form: 'T4SLIP', copy: 12, cell: 'TOATSC4' }],
    ['S100.1002', { form: 'S100', cell: '1002' }],
    ['S1.ADD[1].DESC', { form: 'S1.ADD', copy: 1, cell: 'DESC' }],
  ] as const)('RT-3 the identifier %s parses into form, copy and cell, and formats back', (text, id) => {
    const parsed = parseCellId(text)
    expect(parsed).toStrictEqual({ ok: true, id })
    expect(formatCellId(id)).toBe(text)
  })

  test.each([
    ['no form', 'TOATSC4'],
    ['an empty form', '.TOATSC4'],
    ['no cell', 'T4SLIP[1]'],
    ['an empty cell', 'T4SLIP[1].'],
    ['a copy index of 0', 'T4SLIP[0].TOATSC4'],
    ['a negative copy index', 'T4SLIP[-1].TOATSC4'],
    ['a copy index that is not a number', 'T4SLIP[a].TOATSC4'],
    ['a fractional copy index', 'T4SLIP[1.5].TOATSC4'],
    ['an empty copy index', 'T4SLIP[].TOATSC4'],
    ['a copy index with a leading zero', 'T4SLIP[01].TOATSC4'],
    ['a copy index on the cell', 'T4SLIP.TOATSC4[1]'],
    ['a leading space', ' T4SLIP[1].TOATSC4'],
    ['a trailing space', 'T4SLIP[1].TOATSC4 '],
    ['a space before the copy index', 'T4SLIP [1].TOATSC4'],
    ['a space after the dot', 'T4SLIP[1]. TOATSC4'],
    ['an empty identifier', ''],
  ])('RT-3 an identifier with %s is refused with a reason', (_label, text) => {
    const parsed = parseCellId(text)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason.trim().length).toBeGreaterThan(10)
  })

  test.each([
    ['no form', 'TOATSC4,57565.00,51200.00'],
    ['a copy index of 0', 'T4SLIP[0].TOATSC4,57565.00,51200.00'],
    ['a copy index that is not a number', 'T4SLIP[x].TOATSC4,57565.00,51200.00'],
    ['stray spaces', 'T4SLIP[1] .TOATSC4,57565.00,51200.00'],
  ])('RT-3 a file row whose identifier has %s is refused with the row and the reason', (_label, row) => {
    expectRefused(parseTaxprepCsv(withLine(CCH_EXAMPLE, 2, row)), 'identifier', { line: 2, row })
  })

  // ---------------------------------------------------------------- check 9: the six cell classes
  test('RT-14 the cell-class type holds exactly the six classes', () => {
    expect([...CELL_CLASSES].sort()).toStrictEqual(
      ['calculated', 'dropped', 'orphan', 'overridden', 'rolled-forward', 'traced'].sort(),
    )
    expectTypeOf<CellClass>().toEqualTypeOf<
      'traced' | 'overridden' | 'dropped' | 'rolled-forward' | 'orphan' | 'calculated'
    >()
    for (const c of CELL_CLASSES) expect(isCellClass(c)).toBe(true)
  })

  test.each([['imported'], ['Traced'], ['rolled forward'], ['rolled_forward'], [''], ['unknown']])(
    'RT-14 a value outside the six classes (%s) is refused',
    (value) => {
      expect(isCellClass(value)).toBe(false)
    },
  )
})
