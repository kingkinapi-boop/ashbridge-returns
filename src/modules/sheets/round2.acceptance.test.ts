// A07 round 2 acceptance tests (reports/findings-A07-r1.md S1 to S6; card decisions amber A360).
//
// Public API added in round 2 (spec choices; the round-1 API is listed at the top of csv.acceptance.test.ts):
//   src/contracts/sheets.ts
//     Cell.type gains 'error' (a stored error such as "#N/A"; text is the error code).
//     A formula cell carries cached: { type: 'number' | 'text' | 'boolean' | 'date' | 'error' | 'none', text }, and its
//       text equals cached.text. A formula with no stored value has type 'none' and text '' (a cached empty string reads
//       the same: the pinned library cannot tell <v></v> from no <v>).
//     A sheet carries hiddenRows: number[] and hiddenColumns: number[] (1-based, sorted, empty rows and columns included);
//       a CSV sheet has both empty.
//     A number cell's text: the shortest round-trip text of the stored double (String(x)), except a value within 1e-9 of a
//       whole cent, which is written as that cent amount in plain digits (String of the cent value, or every digit when it
//       is 1e21 or more; never exponent form).
//     cellValueMatches adds the reason 'formula cell: no cached value' (a no-cache formula never matches).
//     Sheet names and pointer sheet names are kept exactly as stored ("TB " is not "TB"); a blank or whitespace-only one is
//       refused.
//   src/modules/sheets/index.ts
//     A refusal never names the file; the same bytes under any name of the same route give the same outcome, and every
//       read hands back its own copy (changing it never changes a later read).
import fc from 'fast-check'
import { isDeepStrictEqual } from 'node:util'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { CellPointerSchema, SheetResultSchema, cellValueMatches, type CellPointer, type SheetResult } from '../../contracts/sheets'
import { createSheetsReader } from './index'
import { expectedWorkbook, fixture, numbersXlsx } from './__fixtures__/harness'

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
const readXlsx = (name: string): Promise<SheetResult> => readBytes(fixture(`xlsx/${name}`), name)
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
const cellAt = (r: SheetResult, sheet: string, row: number, letter: string) =>
  r.sheets.find((s) => s.name === sheet)?.cells.find((c) => c.row === row && c.column.letter === letter)
const ptr = (r: SheetResult, sheet: string, row: number, column: string): CellPointer => ({
  fileFingerprint: r.fileFingerprint,
  sheet,
  row,
  column,
})
/** Loose views of a result, so a test can name round-2 fields before the contract has them. */
type Loose = Record<string, unknown>
const loose = (v: unknown): Loose => v as Loose
const sheetOf = (r: SheetResult, name: string): Loose => loose(r.sheets.find((s) => s.name === name))

/** Each expected cell (from the fixture's JSON, made by make-fixtures.mjs) that the result does not hold as expected. */
function cellProblems(r: SheetResult, name: string): string[] {
  return expectedWorkbook(name).cells.flatMap((e) => {
    const { sheet, ...fields } = e
    const got = cellAt(r, sheet, e.row, e.column.letter)
    if (!got) return [`${JSON.stringify(sheet)}!${e.column.letter}${String(e.row)} missing`]
    const picked = Object.fromEntries(Object.keys(fields).map((k) => [k, loose(got)[k]]))
    return isDeepStrictEqual(picked, fields)
      ? []
      : [`${JSON.stringify(sheet)}!${e.column.letter}${String(e.row)}: want ${JSON.stringify(fields)}, got ${JSON.stringify(picked)}`]
  })
}
const hiddenLists = (r: SheetResult) =>
  r.sheets.map((s) => ({ name: s.name, hiddenRows: loose(s)['hiddenRows'], hiddenColumns: loose(s)['hiddenColumns'] }))

const TB = 'TB'
const TB_SPACE = 'TB '

describe('A07 round 2 S1 and S2: cell text from the typed value (EV-14, EV-6)', () => {
  test('EV-14 cells-r2.xlsx returns every expected cell: typed cached values, float noise, error cells', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellProblems(r, 'cells-r2')).toEqual([])
  })

  test('EV-14 the round-1 fixtures carry the cached value on each formula cell (regenerated expected JSON)', async () => {
    expect(cellProblems(await readXlsx('tb-1900.xlsx'), 'tb-1900')).toEqual([])
    expect(cellProblems(await readXlsx('tb-1904.xlsx'), 'tb-1904')).toEqual([])
    expect(loose(cellAt(await readXlsx('tb-1900.xlsx'), 'Trial Balance (Test)', 6, 'B'))['cached']).toEqual({ type: 'number', text: '1244.56' })
  })

  test('EV-14 every formula cell has its cached value, and its text is the cached text', async () => {
    for (const name of ['cells-r2.xlsx', 'tb-1900.xlsx']) {
      const r = await readXlsx(name)
      const formulas = r.sheets.flatMap((s) => s.cells).filter((c) => c.type === 'formula')
      expect(formulas.length, name).toBeGreaterThan(0)
      for (const c of formulas) {
        const cached = loose(c)['cached'] as { text?: unknown } | undefined
        expect(cached, `${name} ${c.column.letter}${String(c.row)}`).toBeDefined()
        expect(c.text, `${name} ${c.column.letter}${String(c.row)}`).toBe(cached?.text)
      }
    }
  })

  test('EV-6 a formula total cached as 0 reads "0" and matches "0" and "$0.00"; "1" is refused as a cached difference', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 5, 'B')).toMatchObject({ type: 'formula', formula: 'B2-B2', text: '0', cached: { type: 'number', text: '0' } })
    expect(cellValueMatches(r, ptr(r, TB, 5, 'B'), '0')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 5, 'B'), '$0.00')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 5, 'B'), '1')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-6 cached TRUE and FALSE read as booleans; "false" matches FALSE and "true" does not', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 6, 'B')).toMatchObject({ type: 'formula', text: 'TRUE', cached: { type: 'boolean', text: 'TRUE' } })
    expect(cellAt(r, TB, 6, 'C')).toMatchObject({ type: 'formula', text: 'FALSE', cached: { type: 'boolean', text: 'FALSE' } })
    expect(cellValueMatches(r, ptr(r, TB, 6, 'C'), 'false')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 6, 'C'), 'FALSE')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 6, 'B'), 'true')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 6, 'C'), 'true')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
    expect(cellValueMatches(r, ptr(r, TB, 6, 'C'), '0')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-6 float noise: 1234.5600000000001 and -1234.5600000000001 read as "1234.56" and "-1234.56" and match the amount', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 2, 'B')).toMatchObject({ type: 'number', text: '1234.56' })
    expect(cellAt(r, TB, 12, 'B')).toMatchObject({ type: 'number', text: '-1234.56' })
    expect(cellValueMatches(r, ptr(r, TB, 2, 'B'), '1234.56')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 2, 'B'), '$1,234.56')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 12, 'B'), '-1234.56')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 2, 'B'), '1234.57')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-6 a SUM cached as 0.30000000000000004 reads "0.3" and matches "0.30"; "0.31" is a cached difference', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 3, 'B')).toMatchObject({ type: 'formula', text: '0.3', cached: { type: 'number', text: '0.3' } })
    expect(cellValueMatches(r, ptr(r, TB, 3, 'B'), '0.30')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 3, 'B'), '0.31')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-14 1E+21 is written as its whole digits, never in exponent form', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 4, 'B')).toMatchObject({ type: 'number', text: '1000000000000000000000' })
  })

  test('EV-6 planted fault: 0.125 is not within 1e-9 of a cent, so it stays "0.125" and "0.13" is refused', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 11, 'B')).toMatchObject({ type: 'number', text: '0.125' })
    expect(cellValueMatches(r, ptr(r, TB, 11, 'B'), '0.125')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 11, 'B'), '0.13')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, ptr(r, TB, 11, 'B'), '0.12')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-14 a stored #N/A is an error cell; a formula cached as #DIV/0! is a formula whose cached type is error', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 8, 'C')).toMatchObject({ type: 'error', text: '#N/A' })
    expect(cellAt(r, TB, 8, 'B')).toMatchObject({ type: 'formula', formula: 'B2/0', text: '#DIV/0!', cached: { type: 'error', text: '#DIV/0!' } })
    const all = r.sheets.flatMap((s) => s.cells)
    expect(all.filter((c) => c.text.includes('[object')), 'no object text').toEqual([])
  })

  test('EV-6 a formula with no cached value is refused with its own reason, whatever the value offered', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 10, 'B')).toMatchObject({ type: 'formula', formula: 'B2*2', text: '', cached: { type: 'none', text: '' } })
    const none = { ok: false, reason: 'formula cell: no cached value' }
    for (const value of ['', '0', '2469.12', 'none']) expect(cellValueMatches(r, ptr(r, TB, 10, 'B'), value), value).toEqual(none)
    // A cached empty string reads as none too (A07 spec r2 amber): it never matches either.
    expect(cellAt(r, TB, 7, 'B')).toMatchObject({ type: 'formula', text: '', cached: { type: 'none', text: '' } })
    expect(cellValueMatches(r, ptr(r, TB, 7, 'B'), '')).toEqual(none)
  })

  test('EV-14 the schema takes an error cell and a formula cell with its cached value, and refuses a formula cell without one', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(SheetResultSchema.safeParse(r).success).toBe(true)
    const json = JSON.parse(JSON.stringify(r)) as { sheets: { cells: Loose[] }[] }
    const formulaCell = json.sheets[0]?.cells.find((c) => c['type'] === 'formula')
    if (!formulaCell) throw new Error('no formula cell')
    const cached = formulaCell['cached']
    delete formulaCell['cached']
    expect(SheetResultSchema.safeParse(json).success, 'formula without cached').toBe(false)
    formulaCell['cached'] = { type: 'currency', text: '1' }
    expect(SheetResultSchema.safeParse(json).success, 'cached type outside the list').toBe(false)
    formulaCell['cached'] = cached
    expect(SheetResultSchema.safeParse(json).success).toBe(true)
  })
})

describe('A07 round 2 S3: hidden rows and columns listed per sheet, empty ones included (EV-14)', () => {
  test('EV-14 cells-r2.xlsx lists hidden rows 3 and 9 (9 has no cells) and hidden columns 3, 8 and 9 (8 and 9 past the data)', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(hiddenLists(r)).toEqual(expectedWorkbook('cells-r2').hiddenLists)
    expect(sheetOf(r, TB)).toMatchObject({ hiddenRows: [3, 9], hiddenColumns: [3, 8, 9] })
  })

  test('EV-14 the round-1 fixtures list their hidden rows and columns too, and a sheet with none lists none', async () => {
    expect(hiddenLists(await readXlsx('tb-1900.xlsx'))).toEqual(expectedWorkbook('tb-1900').hiddenLists)
    expect(hiddenLists(await readXlsx('tb-1904.xlsx'))).toEqual(expectedWorkbook('tb-1904').hiddenLists)
    expect(sheetOf(await readXlsx('tb-1900.xlsx'), 'Trial Balance (Test)')).toMatchObject({ hiddenRows: [4], hiddenColumns: [4] })
  })

  test('EV-14 hidden rows and columns with content are still marked on their cells', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellAt(r, TB, 3, 'A')).toMatchObject({ text: 'Sum noise (Test)', hiddenRow: true, hiddenColumn: false })
    expect(cellAt(r, TB, 6, 'C')).toMatchObject({ hiddenRow: false, hiddenColumn: true })
    expect(cellAt(r, TB, 2, 'B')).toMatchObject({ hiddenRow: false, hiddenColumn: false })
  })

  test('EV-14 a CSV sheet lists no hidden rows or columns', async () => {
    const r = await readBytes(utf8('Amount,Payee\n1.00,SHOP (Test)\n'), 'a.csv')
    expect(sheetOf(r, 'csv')).toMatchObject({ hiddenRows: [], hiddenColumns: [] })
  })

  test('EV-14 the schema refuses a sheet without its hidden lists, or with a row or column number below 1', async () => {
    const r = await readXlsx('tb-1904.xlsx')
    const patched = (patch: (sheet: Loose) => void): boolean => {
      const json = JSON.parse(JSON.stringify(r)) as { sheets: Loose[] }
      const sheet = json.sheets[0]
      if (!sheet) throw new Error('no sheet')
      patch(sheet)
      return SheetResultSchema.safeParse(json).success
    }
    expect(patched(() => undefined)).toBe(true)
    expect(patched((s) => delete s['hiddenRows'])).toBe(false)
    expect(patched((s) => delete s['hiddenColumns'])).toBe(false)
    expect(patched((s) => (s['hiddenRows'] = [0]))).toBe(false)
    expect(patched((s) => (s['hiddenColumns'] = [1.5]))).toBe(false)
  })
})

describe('A07 round 2 S4: the fingerprint cache (EV-14, ARC-11 rule as A01)', () => {
  const PDFISH = utf8('%PDF-1.4 made-up (Test)\n')

  test('EV-14 the same unreadable bytes as a.pdf then b.doc are refused with a reason naming neither file', async () => {
    const reader = createSheetsReader()
    const first = await reader.read(PDFISH, 'a.pdf')
    const second = await reader.read(PDFISH, 'b.doc')
    for (const out of [first, second]) {
      if (out.ok) throw new Error('read, not refused')
      expect(out.reason).not.toContain('a.pdf')
      expect(out.reason).not.toContain('b.doc')
      expect(out.reason.trim()).not.toBe('')
    }
    expect(second).toEqual(first)
  })

  test('EV-14 the same bytes as .pdf then .csv, and as .csv then .pdf, give different outcomes', async () => {
    const bytes = utf8('Amount\n1.00\n')
    const one = createSheetsReader()
    expect((await one.read(bytes, 'x.pdf')).ok).toBe(false)
    expect((await one.read(bytes, 'x.csv')).ok).toBe(true)
    const two = createSheetsReader()
    expect((await two.read(bytes, 'x.csv')).ok).toBe(true)
    expect((await two.read(bytes, 'x.pdf')).ok).toBe(false)
  })

  test('EV-14 changing a returned result leaves the next read of the same bytes intact', async () => {
    const reader = createSheetsReader()
    const bytes = fixture('xlsx/tb-1900.xlsx')
    const fresh = await createSheetsReader().read(bytes, 'tb-1900.xlsx')
    const first = await reader.read(bytes, 'tb-1900.xlsx')
    if (!first.ok) throw new Error('refused')
    const cell = first.result.sheets[0]?.cells[0]
    if (!cell) throw new Error('no cell')
    cell.text = 'changed by a caller (Test)'
    first.result.sheets.pop()
    first.result.engine.version = '0.0.0'
    expect(await reader.read(bytes, 'tb-1900.xlsx')).toEqual(fresh)
  })

  test('EV-14 changing a returned refusal leaves the next read of the same bytes intact', async () => {
    const reader = createSheetsReader()
    const first = await reader.read(PDFISH, 'a.pdf')
    if (first.ok) throw new Error('read, not refused')
    const reason = first.reason
    ;(first as { reason: string }).reason = 'changed by a caller (Test)'
    const second = await reader.read(PDFISH, 'a.pdf')
    expect(second).toEqual({ ok: false, reason })
  })
})

describe('A07 round 2 S5: sheet and pointer names exactly as stored (EV-14, EV-5)', () => {
  test('EV-14 "TB" and "TB " are two sheets, each name kept exactly as stored', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(r.sheets.map((s) => s.name)).toEqual([TB, TB_SPACE])
    expect(cellAt(r, TB_SPACE, 1, 'A')?.text).toBe('trailing space sheet (Test)')
  })

  test('EV-5 a pointer to "TB " finds "TB ", and the same row and column on "TB" is another cell', async () => {
    const r = await readXlsx('cells-r2.xlsx')
    expect(cellValueMatches(r, ptr(r, TB_SPACE, 2, 'B'), '7')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 2, 'B'), '7')).toEqual({ ok: false, reason: 'value differs' })
    expect(cellValueMatches(r, ptr(r, TB_SPACE, 1, 'A'), 'trailing space sheet (Test)')).toEqual({ ok: true })
    expect(cellValueMatches(r, ptr(r, TB, 1, 'A'), 'trailing space sheet (Test)')).toEqual({ ok: false, reason: 'value differs' })
  })

  test('EV-5 the schemas keep a name exactly as given and refuse a blank or whitespace-only one', async () => {
    const pointer = { fileFingerprint: 'a'.repeat(64), sheet: TB_SPACE, row: 1, column: 'A' }
    expect(CellPointerSchema.parse(pointer).sheet).toBe(TB_SPACE)
    expect(CellPointerSchema.parse({ ...pointer, sheet: ' Sheet 1 (Test)' }).sheet).toBe(' Sheet 1 (Test)')
    for (const blank of ['', ' ', '\t', '\n', '  \t ']) {
      expect(CellPointerSchema.safeParse({ ...pointer, sheet: blank }).success, JSON.stringify(blank)).toBe(false)
    }
    const r = await readXlsx('cells-r2.xlsx')
    expect(SheetResultSchema.parse(r).sheets.map((s) => s.name)).toEqual([TB, TB_SPACE])
    const json = JSON.parse(JSON.stringify(r)) as { sheets: Loose[] }
    for (const blank of ['', ' ', '\t']) {
      const sheet = json.sheets[1]
      if (!sheet) throw new Error('no sheet')
      sheet['name'] = blank
      expect(SheetResultSchema.safeParse(json).success, JSON.stringify(blank)).toBe(false)
    }
  })
})

describe('A07 round 2 S6: the number text rule (EV-14)', () => {
  /** How Excel stores a double in <v>: its shortest text, exponent in capitals. */
  const stored = (x: number): string => String(x).replace('e', 'E')
  /** The cent amount in plain digits: String below 1e21, every digit from there up. */
  const plain = (c: number): string => (Math.abs(c) < 1e21 ? String(c) : BigInt(c).toString())
  const nearestCent = (x: number): number => (Number.isInteger(x) ? x : Math.round(x * 100) / 100)
  /** One unit in the last place of x (the gap to the next double away from zero). */
  function ulp(x: number): number {
    const a = Math.abs(x)
    if (a === Number.MAX_VALUE) return 2 ** 971
    const view = new DataView(new ArrayBuffer(8))
    view.setFloat64(0, a)
    view.setBigInt64(0, view.getBigInt64(0) + 1n)
    return view.getFloat64(0) - a
  }
  /**
   * The texts the rule allows for a stored double (A07B item 1 supersedes the fixed 1e-9 band of round 2): the cent amount
   * within 4 ulps or 1e-9, the shortest round-trip text beyond 64 ulps and 1e-9. A thin band either side accepts either
   * text, so floating point in the bound itself never decides; past 1e12 (4 ulps of 0.001 or more) either text is allowed.
   */
  function allowed(x: number): string[] {
    const c = nearestCent(x)
    const distance = Math.abs(x - c)
    const lower = Math.max(0.9e-9, 4 * ulp(x))
    const upper = Math.max(1.1e-9, 64 * ulp(x))
    if (lower < 0.001 && distance <= lower) return [plain(c)]
    if (upper < 0.005 && distance > upper) return [String(x)]
    return [plain(c), String(x)]
  }
  async function readNumbers(values: number[]): Promise<{ x: number; text: string | undefined; type: string | undefined }[]> {
    const r = await readBytes(numbersXlsx(values.map(stored)), 'numbers.xlsx')
    return values.map((x, i) => {
      const c = cellAt(r, 'Numbers (Test)', i + 1, 'A')
      return { x, text: c?.text, type: c?.type }
    })
  }

  test('EV-14 fixed examples: float noise, 1E+21, the largest double, the smallest, -0, and values that are not cents', async () => {
    const got = await readNumbers([Number('1234.5600000000001'), 0.30000000000000004, 1e21, Number.MAX_VALUE, 5e-324, -0, 0.1, 1e-7, 0.125, -2.675, 12345678.9])
    expect(got.map((g) => g.text)).toEqual([
      '1234.56',
      '0.3',
      '1000000000000000000000',
      BigInt(Number.MAX_VALUE).toString(),
      '0',
      '0',
      '0.1',
      '1e-7',
      '0.125',
      '-2.675',
      '12345678.9',
    ])
    expect(got.every((g) => g.type === 'number')).toBe(true)
  })

  test('EV-14 property (seed 20261002): any finite double reads back as its shortest round-trip text or, within its magnitude band, its cent amount', async () => {
    const value = fc.oneof(
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      // Money-sized values with float noise: a cent amount plus or minus a few units in the last place.
      fc
        .tuple(fc.integer({ min: -1e11, max: 1e11 }), fc.integer({ min: -3, max: 3 }))
        .map(([cents, ulps]) => {
          let x = cents / 100
          for (let i = 0; i < Math.abs(ulps); i++) x = ulps > 0 ? x + Number.EPSILON * Math.max(1, Math.abs(x)) : x - Number.EPSILON * Math.max(1, Math.abs(x))
          return x
        }),
    )
    await fc.assert(
      fc.asyncProperty(fc.array(value, { minLength: 1, maxLength: 20 }), async (values) => {
        for (const g of await readNumbers(values)) {
          expect(g.type, stored(g.x)).toBe('number')
          expect(allowed(g.x), `stored ${stored(g.x)} read as ${String(g.text)}`).toContain(g.text)
        }
      }),
      { seed: 20261002, numRuns: 100 },
    )
  })
})
