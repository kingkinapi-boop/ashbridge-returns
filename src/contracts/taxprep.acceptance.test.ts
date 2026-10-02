/**
 * F03 Taxprep CSV contract: acceptance tests (re-spec of 2 Oct 2026; spec-writer only, builders never edit).
 * Follows plan/cards/F03.md and reference/taxprep/FINDINGS.md (release CCH iFirm 2026.20.198267), not CCH's help page.
 *
 * The contract these tests pin (src/contracts/taxprep.ts):
 *
 *   type CellId = { readonly text: string; readonly copyPath: string | null; readonly copyIndex: number | null }
 *     made only by parseCellId (a plain string is not a CellId). copyPath is the identifier up to the part that
 *     carries the copy index, without the index (`CCACat.FD08C[2].FED.Ttw08cA1` -> 'CCACat.FD08C', 2);
 *     both null when the identifier has no copy index.
 *   parseCellId(text): { ok: true; id: CellId } | { ok: false; reason: string }
 *   withCopyIndex(id, n): CellId          (throws when id has no copy index or n is not a whole number from 1)
 *
 *   type CellValue = { kind: 'clear' } | { kind: 'value'; text: string }
 *   type RowShape = 'current-only' | 'standard' | 'extra-columns'
 *   type ParsedRow = { line: number; id: CellId; current: CellValue; last: CellValue | null;
 *                      description: string | null; shape: RowShape; apostrophe: boolean }
 *     line 1 is the header; last and description are null on a current-only row; apostrophe is true when a
 *     value carried the export's leading apostrophe before a negative number (the value holds the number).
 *   type TaxprepHeader = { returnName: string; guid: string }
 *   parseTaxprepCsv(bytes): { ok: true; file: { header: TaxprepHeader; rows: ParsedRow[] } }
 *                         | { ok: false; faults: { code: TaxprepFaultCode; reason: string; line: number | null }[] }
 *     TaxprepFaultCode includes 'bom' | 'line-ends' | 'separator' | 'unquoted' | 'negative-parens' | 'thousands'
 *       | 'decimal-comma' | 'scientific' | 'date-format' | 'utf8' | 'header' | 'identifier' | 'apostrophe'.
 *
 *   type WriteValue = { kind: 'amount'; amount: number } | { kind: 'text'; text: string } | { kind: 'date'; date: string }
 *                   | { kind: 'yesNo'; yes: boolean } | { kind: 'rate'; rate: number } | { kind: 'clear' }
 *   type WriteRow = { id: CellId; current: WriteValue; last?: WriteValue; description?: string }
 *   writeTaxprepCsv({ header, rows }, { purpose: 'import' | 'export' })
 *     : { ok: true; bytes: Uint8Array } | { ok: false; problems: { index; identifier; reason; character? }[] }
 *     index is the row's position in `rows` (0-based); rates are written with 4 decimals ('0.2000').
 *     'import' refuses the ignored-on-import cells (RT-13); 'export' writes the shape Taxprep's export writes
 *     (the simulator, S00) and allows them.
 *
 *   TAXPREP_SETTINGS (RT-9), IGNORED_ON_IMPORT: readonly { identifier: string; finding: string }[] (RT-13),
 *   type NaturalKeyRegistry = Readonly<Record<string, string>>  (copy path -> key cell under the copy), NATURAL_KEYS,
 *   copiesByNaturalKey(rows, copyPath, registry = NATURAL_KEYS)
 *     : { ok: true; copies: ReadonlyMap<string, number> } | { ok: false; reason: string }   (RT-7)
 *   CELL_CLASSES, type CellClass, isCellClass(value: unknown) (RT-14).
 *
 * The type tests (RT-8/RT-12 and the CellId one) are enforced by `npm run typecheck`: every `@ts-expect-error`
 * below must be needed.
 *
 * Committed CSVs under reference/ are stored LF by .gitattributes (`* text=auto eol=lf`); `taxprepBytes` restores
 * the CRLF Taxprep wrote. Golden files in __golden__/ keep their bytes (`-text`) and are compared byte for byte;
 * the parsed records are golden JSON files (toMatchFileSnapshot).
 */
import { readFileSync, readdirSync } from 'node:fs'
import fc from 'fast-check'
import { describe, expect, expectTypeOf, test } from 'vitest'
import {
  CELL_CLASSES,
  IGNORED_ON_IMPORT,
  NATURAL_KEYS,
  TAXPREP_SETTINGS,
  copiesByNaturalKey,
  isCellClass,
  parseCellId,
  parseTaxprepCsv,
  withCopyIndex,
  writeTaxprepCsv,
  type CellClass,
  type CellId,
  type CellValue,
  type NaturalKeyRegistry,
  type ParsedRow,
  type TaxprepFaultCode,
  type TaxprepHeader,
  type WriteRow,
  type WriteValue,
} from './taxprep'

const SEED = 20261002

// ---------- helpers (test-side only) ----------

const repoUrl = (rel: string): URL => new URL(`../../${rel}`, import.meta.url)
const golden = (name: string): Buffer => readFileSync(new URL(`./__golden__/${name}`, import.meta.url))
const goldenPath = (name: string): string => `./__golden__/${name}`

/** A committed reference CSV (LF in git) with the CRLF line ends Taxprep wrote. */
function taxprepBytes(rel: string): Buffer {
  const raw = readFileSync(repoUrl(rel))
  if (raw.includes(0x0d)) throw new Error(`${rel} already holds CR bytes: the CRLF restore would double them`)
  return Buffer.from(raw.toString('latin1').replace(/\n/g, '\r\n'), 'latin1')
}

/** Bytes as a 1:1 string (latin1), for readable exact comparisons. */
const asText = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1')
const fromText = (text: string): Buffer => Buffer.from(text, 'latin1')

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`test fixture: ${what} missing`)
  return value
}

function id(text: string): CellId {
  const r = parseCellId(text)
  if (!r.ok) throw new Error(`test fixture: ${text} should parse: ${r.reason}`)
  return r.id
}

function parseOk(bytes: Uint8Array) {
  const r = parseTaxprepCsv(bytes)
  if (!r.ok) throw new Error(`expected the file to parse, got faults: ${JSON.stringify(r.faults)}`)
  return r.file
}

function writeOk(header: TaxprepHeader, rows: readonly WriteRow[], purpose: 'import' | 'export'): Uint8Array {
  const r = writeTaxprepCsv({ header, rows }, { purpose })
  if (!r.ok) throw new Error(`expected the writer to accept, got: ${JSON.stringify(r.problems)}`)
  return r.bytes
}

function writeRefused(header: TaxprepHeader, rows: readonly WriteRow[], purpose: 'import' | 'export') {
  const r = writeTaxprepCsv({ header, rows }, { purpose })
  if (r.ok) throw new Error(`expected the writer to refuse, but it wrote: ${asText(r.bytes)}`)
  return r.problems
}

type Kind = 'amount' | 'text' | 'date' | 'yesNo' | 'rate'

/** A parsed value turned back into a writer value, given the cell's kind (the caller knows the kind). */
function toWriteValue(v: CellValue, kind: Kind): WriteValue {
  if (v.kind === 'clear') return { kind: 'clear' }
  switch (kind) {
    case 'amount':
      return { kind: 'amount', amount: Number(v.text) }
    case 'text':
      return { kind: 'text', text: v.text }
    case 'date':
      return { kind: 'date', date: v.text }
    case 'yesNo':
      return { kind: 'yesNo', yes: v.text === 'Y' }
    case 'rate':
      return { kind: 'rate', rate: Number(v.text) }
  }
}

function toWriteRows(rows: readonly ParsedRow[], kinds: Readonly<Record<string, Kind>>): WriteRow[] {
  return rows.map((r) => {
    const kind = kinds[r.id.text] ?? 'amount'
    const row: WriteRow = { id: r.id, current: toWriteValue(r.current, kind) }
    if (r.description !== null && r.description !== '') row.description = r.description
    return row
  })
}

/** A stable view of parsed rows for the golden records (independent of CellId's inner fields). */
const view = (rows: readonly ParsedRow[]) =>
  rows.map((r) => ({
    line: r.line,
    id: r.id.text,
    copyPath: r.id.copyPath,
    copyIndex: r.id.copyIndex,
    current: r.current,
    last: r.last,
    description: r.description,
    shape: r.shape,
    apostrophe: r.apostrophe,
  }))

const PROBE: TaxprepHeader = { returnName: 'Probe Co. (Test)', guid: '5f0c2e9a-1b7d-4c3e-9a21-0d6e8b4f7a10' }
const ZERO_GUID = '00000000-0000-0000-0000-000000000000'
const HEADER_LINE = '[Probe Co. (Test)|0|0|5f0c2e9a-1b7d-4c3e-9a21-0d6e8b4f7a10],"Current Year","Last Year",""\r\n'

const RT07 = 'reference/taxprep/2026-10-02-day2/exports/rt-07-imported-default.csv'
const MAPLE = 'reference/sample-clients/01-maple-ridge/taxprep/import.csv'
const MADE_UP = 'made-up-return.csv'
const IGNORED = ['IDENT.Ident120', 'IDENT.Ident121', 'IDENT.Ident311', 'IDENT.Ident492']

const RT07_KINDS: Readonly<Record<string, Kind>> = {
  'IDENT.Ident120': 'date',
  'IDENT.Ident121': 'date',
  'IDENT.Ident311': 'text',
  'IDENT.Ident230': 'text',
  'IDENT.Ident451': 'text',
  'IDENT.Ident492': 'yesNo',
  'IFirm.ContactPartner': 'text',
}
const MADE_UP_KINDS: Readonly<Record<string, Kind>> = {
  'IDENT.Ident120': 'date',
  'IDENT.Ident311': 'text',
  'IDENT.Ident180': 'yesNo',
  'IDENT.Ident183': 'yesNo',
  'CCACat.FD08C[2].FED.Ttw08cA2': 'rate',
}

// ---------- generators (fixed seed) ----------

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const ALNUM = [...UPPER, ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')]
const partArb = fc
  .tuple(fc.constantFrom(...UPPER), fc.array(fc.constantFrom(...ALNUM), { maxLength: 8 }))
  .map(([first, rest]) => first + rest.join(''))
const identifierArb: fc.Arbitrary<string> = fc
  .tuple(fc.array(partArb, { minLength: 2, maxLength: 4 }), fc.option(fc.integer({ min: 1, max: 99 })), fc.nat())
  .map(([parts, copy, at]) => {
    if (copy === null) return parts.join('.')
    const i = at % (parts.length - 1)
    return parts.map((p, j) => (j === i ? `${p}[${String(copy)}]` : p)).join('.')
  })

// No character that encodes to 80 to BF (€, ’, °, «): next to an accented letter those bytes form a valid UTF-8
// sequence, which the parser must refuse (RT-9). The € and ’ bytes have their own example test (check 5).
const TEXT_CHARS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''),
  ...[' ', '.', '-', '&', '(', ')', 'é', 'è', 'ç', 'à', 'É', 'Ç', 'ô', 'ü', 'ñ'],
]
const textArb = fc
  .tuple(fc.constantFrom(...UPPER), fc.array(fc.constantFrom(...TEXT_CHARS), { maxLength: 30 }))
  .map(([first, rest]) => first + rest.join(''))
const dateArb = fc
  .date({ min: new Date(Date.UTC(1990, 0, 1)), max: new Date(Date.UTC(2040, 11, 31)), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10))

type Expected = { value: WriteValue; text: string | null }
const valueArb: fc.Arbitrary<Expected> = fc.oneof(
  fc
    .integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER })
    .map((n): Expected => ({ value: { kind: 'amount', amount: n }, text: String(n) })),
  textArb.map((t): Expected => ({ value: { kind: 'text', text: t }, text: t })),
  dateArb.map((d): Expected => ({ value: { kind: 'date', date: d }, text: d })),
  fc.boolean().map((yes): Expected => ({ value: { kind: 'yesNo', yes }, text: yes ? 'Y' : 'N' })),
  fc
    .integer({ min: 0, max: 10_000 })
    .map((n): Expected => ({ value: { kind: 'rate', rate: n / 10_000 }, text: (n / 10_000).toFixed(4) })),
  fc.constant<Expected>({ value: { kind: 'clear' }, text: null }),
)
const rowsArb = fc
  .uniqueArray(fc.tuple(identifierArb, valueArb), { selector: ([t]) => t, maxLength: 25 })
  .map((rows) => rows.filter(([t]) => !IGNORED.includes(t)))

// ---------- 1. RT-3, ARC-14: known files in, the same files out ----------

describe('F03 check 1: round trip byte for byte (RT-3, ARC-14)', () => {
  test('RT-3 ARC-14 the trial export rt-07-imported-default.csv parses and is written back byte for byte', async () => {
    const bytes = taxprepBytes(RT07)
    const file = parseOk(bytes)
    expect(file.header).toEqual({
      returnName: 'Riverdale Rentals Inc. (Test)',
      guid: '0aad6c0c-6444-466e-a247-ed6d63078cd2',
    })
    expect(file.rows).toHaveLength(20)
    expect(file.rows.every((r) => r.shape === 'standard' && !r.apostrophe)).toBe(true)
    await expect(JSON.stringify(view(file.rows), null, 2) + '\n').toMatchFileSnapshot(
      goldenPath('rt-07-imported-default.parsed.json'),
    )
    const out = writeOk(file.header, toWriteRows(file.rows, RT07_KINDS), 'export')
    expect(asText(out)).toBe(asText(bytes))
  })

  test('RT-3 ARC-14 a made-up file with a GUID, a zero, a clear, a date, Y and N, an accented text (E9), a copy index and a rate parses and is written back byte for byte', async () => {
    const bytes = golden(MADE_UP)
    const file = parseOk(bytes)
    expect(file.header).toEqual(PROBE)
    const byId = new Map(file.rows.map((r) => [r.id.text, r]))
    expect(must(byId.get('GFGBA.Ttwgba64'), 'zero row').current).toEqual({ kind: 'value', text: '0' })
    expect(must(byId.get('GFGBA.Ttwgba72'), 'clear row').current).toEqual({ kind: 'clear' })
    expect(must(byId.get('IDENT.Ident120'), 'date row').current).toEqual({ kind: 'value', text: '2025-01-01' })
    expect(must(byId.get('IDENT.Ident180'), 'Y row').current).toEqual({ kind: 'value', text: 'Y' })
    expect(must(byId.get('IDENT.Ident183'), 'N row').current).toEqual({ kind: 'value', text: 'N' })
    expect(must(byId.get('IDENT.Ident311'), 'accented row').current).toEqual({
      kind: 'value',
      text: 'Café Étienne Ltée (Test)',
    })
    const copy = must(byId.get('CCACat.FD08C[2].FED.Ttw08cA1'), 'copy row')
    expect([copy.id.copyPath, copy.id.copyIndex]).toEqual(['CCACat.FD08C', 2])
    expect(must(byId.get('CCACat.FD08C[2].FED.Ttw08cA2'), 'rate row').current).toEqual({
      kind: 'value',
      text: '0.2000',
    })
    await expect(JSON.stringify(view(file.rows), null, 2) + '\n').toMatchFileSnapshot(
      goldenPath('made-up-return.parsed.json'),
    )
    const out = writeOk(file.header, toWriteRows(file.rows, MADE_UP_KINDS), 'export')
    expect(asText(out)).toBe(asText(bytes))
  })

  test("RT-3 ARC-14 sample client 01's import.csv (all-zero GUID) parses and is written back byte for byte as an import", () => {
    const bytes = taxprepBytes(MAPLE)
    const file = parseOk(bytes)
    expect(file.header).toEqual({ returnName: 'Maple Ridge Consulting Inc. (Test)', guid: ZERO_GUID })
    expect(file.rows).toHaveLength(15)
    const out = writeOk(file.header, toWriteRows(file.rows, {}), 'import')
    expect(asText(out)).toBe(asText(bytes))
  })

  test('RT-3 the parser returns any return name and GUID without checking them (identity is T02)', () => {
    const text = asText(golden(MADE_UP)).replace(
      'Probe Co. (Test)|0|0|5f0c2e9a-1b7d-4c3e-9a21-0d6e8b4f7a10',
      'Some Other Co. (Test)|0|0|not-a-guid',
    )
    expect(parseOk(fromText(text)).header).toEqual({ returnName: 'Some Other Co. (Test)', guid: 'not-a-guid' })
  })
})

// ---------- 2. RT-3: row shapes ----------

describe('F03 check 2: row shapes (RT-3)', () => {
  test('RT-3 a row with only the current value and a row with two extra trailing columns both parse, with their shape reported', () => {
    const file = parseOk(golden('row-shapes-in.csv'))
    expect(file.header).toEqual({ returnName: 'Probe Co. (Test)', guid: ZERO_GUID })
    expect(file.rows).toHaveLength(2)
    const a = must(file.rows[0], 'row 1')
    const b = must(file.rows[1], 'row 2')
    expect(a.id.text).toBe('GFGBA.Ttwgba64')
    expect(a).toMatchObject({
      line: 2,
      current: { kind: 'value', text: '7693' },
      last: null,
      description: null,
      shape: 'current-only',
    })
    expect(b.id.text).toBe('GFGBA.Ttwgba72')
    expect(b).toMatchObject({
      line: 3,
      current: { kind: 'value', text: '975' },
      last: { kind: 'clear' },
      description: 'GIFI code 1062 - Trade accounts receivable',
      shape: 'extra-columns',
    })
  })

  test('RT-3 the writer writes both rows back in the four-column shape, description empty unless given (golden)', () => {
    const file = parseOk(golden('row-shapes-in.csv'))
    const out = writeOk(file.header, toWriteRows(file.rows, {}), 'import')
    expect(asText(out)).toBe(asText(golden('row-shapes-out.csv')))
  })
})

// ---------- 3. RT-12, RT-8: clear versus zero ----------

describe('F03 check 3: a clear is not zero (RT-12, RT-8)', () => {
  const file = (current: string) => fromText(`${HEADER_LINE}GFGBA.Ttwgba64,"${current}","",""\r\n`)

  test('RT-12 "" parses as a clear, never as zero', () => {
    expect(must(parseOk(file('')).rows[0], 'row').current).toEqual({ kind: 'clear' })
  })

  test('RT-12 " " (one space) parses as a clear, never as zero', () => {
    expect(must(parseOk(file(' ')).rows[0], 'row').current).toEqual({ kind: 'clear' })
  })

  test('RT-12 "0" parses as zero, not as a clear', () => {
    expect(must(parseOk(file('0')).rows[0], 'row').current).toEqual({ kind: 'value', text: '0' })
  })

  test('RT-8 RT-12 the writer cannot be called with an empty value without the explicit clear flag (type test, enforced by typecheck)', () => {
    const cell = id('GFGBA.Ttwgba64')
    const typeOnly = (): unknown[] => {
      // @ts-expect-error a row with no value is a type error (a blank cannot be written by accident)
      const noValue: WriteRow = { id: cell }
      // @ts-expect-error an undefined value is a type error
      const undefinedValue: WriteRow = { id: cell, current: undefined }
      // @ts-expect-error a bare empty string is not a writer value
      const bareEmpty: WriteRow = { id: cell, current: '' }
      // @ts-expect-error a text value must carry its text
      const textWithout: WriteRow = { id: cell, current: { kind: 'text' } }
      // @ts-expect-error an amount value must carry its amount
      const amountWithout: WriteRow = { id: cell, current: { kind: 'amount' } }
      return [noValue, undefinedValue, bareEmpty, textWithout, amountWithout]
    }
    expect(typeOnly).toBeTypeOf('function')
    expectTypeOf<{ kind: 'clear' }>().toExtend<WriteValue>()
    expectTypeOf<WriteRow['current']>().toEqualTypeOf<WriteValue>()
  })

  test('RT-8 with the explicit clear flag the writer writes ""', () => {
    const out = writeOk(PROBE, [{ id: id('GFGBA.Ttwgba64'), current: { kind: 'clear' } }], 'import')
    expect(asText(out)).toBe(`${HEADER_LINE}GFGBA.Ttwgba64,"","",""\r\n`)
  })

  test.each(['', ' '])(
    'RT-12 planted fault: the text value %j is refused naming the row (a clear must be explicit)',
    (text) => {
      const problems = writeRefused(
        PROBE,
        [
          { id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: 1 } },
          { id: id('IFirm.ContactPartner'), current: { kind: 'text', text } },
        ],
        'import',
      )
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatchObject({ index: 1, identifier: 'IFirm.ContactPartner' })
      expect(must(problems[0], 'problem').reason).toMatch(/clear/i)
    },
  )
})

// ---------- 4. RT-9: the fault set ----------

describe('F03 check 4: the fault set, each refused with its own reason (RT-9)', () => {
  const good = asText(golden(MADE_UP))
  const GOOD_HEADER = '[Probe Co. (Test)|0|0|5f0c2e9a-1b7d-4c3e-9a21-0d6e8b4f7a10]'

  /** Each member: the one change from the good file, and the fault code (and line) it must be refused with. */
  const members: readonly { name: string; code: TaxprepFaultCode; line: number | null; make: (t: string) => string }[] =
    [
      { name: 'a byte-order mark', code: 'bom', line: null, make: (t) => 'ï»¿' + t },
      { name: 'LF-only line ends', code: 'line-ends', line: null, make: (t) => t.replace(/\r\n/g, '\n') },
      { name: 'a missing CRLF on the last line', code: 'line-ends', line: null, make: (t) => t.slice(0, -2) },
      { name: 'a tab separator', code: 'separator', line: null, make: (t) => t.replace(/,"/g, '\t"') },
      { name: 'a semicolon separator', code: 'separator', line: null, make: (t) => t.replace(/,"/g, ';"') },
      { name: 'a space separator', code: 'separator', line: null, make: (t) => t.replace(/,"/g, ' "') },
      { name: 'an unquoted value', code: 'unquoted', line: 8, make: (t) => t.replace('"1620"', '1620') },
      { name: 'a (123) negative', code: 'negative-parens', line: 10, make: (t) => t.replace('"-1356"', '"(1356)"') },
      { name: 'a thousands comma', code: 'thousands', line: 9, make: (t) => t.replace('"48600"', '"48,600"') },
      { name: 'a thousands space', code: 'thousands', line: 9, make: (t) => t.replace('"48600"', '"48 600"') },
      { name: 'a decimal comma', code: 'decimal-comma', line: 12, make: (t) => t.replace('"0.2000"', '"0,2000"') },
      { name: 'scientific notation', code: 'scientific', line: 9, make: (t) => t.replace('"48600"', '"4.86E+04"') },
      {
        name: 'a reformatted date',
        code: 'date-format',
        line: 2,
        make: (t) => t.replace('"2025-01-01"', '"01/01/2025"'),
      },
      {
        name: 'UTF-8 byte sequences (C3 A9 for e-acute)',
        code: 'utf8',
        line: 3,
        make: (t) => t.replace(/é/g, 'Ã©').replace(/É/g, 'Ã\u0089'),
      },
      {
        name: 'a header that is not in brackets',
        code: 'header',
        line: 1,
        make: (t) => t.replace(GOOD_HEADER, GOOD_HEADER.slice(1, -1)),
      },
    ]

  test('RT-9 the good file the fault set is made from parses (no false alarm)', () => {
    expect(parseTaxprepCsv(golden(MADE_UP)).ok).toBe(true)
  })

  for (const m of members) {
    test(`RT-9 ${m.name} is refused with its own reason`, () => {
      const bad = m.make(good)
      expect(bad).not.toBe(good)
      const r = parseTaxprepCsv(fromText(bad))
      expect(r.ok).toBe(false)
      if (r.ok) return
      const fault = r.faults.find((f) => f.code === m.code)
      expect(fault, `codes seen: ${r.faults.map((f) => f.code).join(', ')}`).toBeDefined()
      expect(must(fault, 'fault').reason.trim().length).toBeGreaterThan(10)
      if (m.line !== null) expect(must(fault, 'fault').line).toBe(m.line)
    })
  }

  test('RT-9 every member of the fault set has its own plain reason (no two codes share a reason)', () => {
    const reasons = new Map<TaxprepFaultCode, string>()
    for (const m of members) {
      const r = parseTaxprepCsv(fromText(m.make(good)))
      if (r.ok) throw new Error(`${m.name} was not refused`)
      const fault = must(
        r.faults.find((f) => f.code === m.code),
        `${m.code} fault`,
      )
      reasons.set(m.code, fault.reason)
    }
    expect(reasons.size).toBe(11)
    expect(new Set(reasons.values()).size).toBe(reasons.size)
  })

  test('RT-9 commas and spaces inside a text value, and an apostrophe in a description, are not faults', () => {
    const text = `${HEADER_LINE}IDENT.Ident311,"Lakeshore Eats, Inc. (Test)","","Corporation's name, line 1"\r\n`
    const row = must(parseOk(fromText(text)).rows[0], 'row')
    expect(row.current).toEqual({ kind: 'value', text: 'Lakeshore Eats, Inc. (Test)' })
    expect(row.description).toBe("Corporation's name, line 1")
  })

  test("RT-9 the fixed settings are one constant holding Taxprep's defaults", () => {
    expect(TAXPREP_SETTINGS).toMatchObject({
      separator: ',',
      negatives: '-123',
      decimal: '.',
      thousands: 'none',
      encoding: 'windows-1252',
      lineEnd: '\r\n',
      quoteValues: true,
      byteOrderMark: false,
    })
  })
})

// ---------- 5. RT-9: Windows-1252 on the writer ----------

describe('F03 check 5: the writer encodes Windows-1252 and refuses anything outside it (RT-9)', () => {
  const textRow = (text: string): WriteRow => ({ id: id('IFirm.ContactPartner'), current: { kind: 'text', text } })
  const rowBytes = (out: Uint8Array): Buffer => Buffer.from(out).subarray(Buffer.byteLength(HEADER_LINE, 'latin1'))

  test.each(['≥', '😀'])('RT-9 a text value holding %s is refused naming the row and the character', (ch) => {
    const problems = writeRefused(
      PROBE,
      [{ id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: 7694 } }, textRow(`Partner ${ch} (Test)`)],
      'import',
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ index: 1, identifier: 'IFirm.ContactPartner', character: ch })
    expect(must(problems[0], 'problem').reason).toContain(ch)
  })

  test('RT-9 é, è, ç and à are written as the single bytes E9, E8, E7 and E0', () => {
    const row = rowBytes(writeOk(PROBE, [textRow('éèçà (Test)')], 'import'))
    expect([...row]).toEqual([...fromText('IFirm.ContactPartner,"éèçà (Test)","",""\r\n')])
    expect(row.includes(0xc3)).toBe(false)
  })

  test('RT-9 Windows-1252 characters above Latin-1 (€ and ’) are written as the single bytes 80 and 92 and read back', () => {
    const out = writeOk(PROBE, [textRow('Caf€’s (Test)')], 'import')
    const row = rowBytes(out)
    expect(row.includes(0x80)).toBe(true)
    expect(row.includes(0x92)).toBe(true)
    expect(must(parseOk(out).rows[0], 'row').current).toEqual({ kind: 'value', text: 'Caf€’s (Test)' })
  })
})

// ---------- 6. RT-25: whole dollars ----------

describe('F03 check 6: amounts are whole dollars (RT-25)', () => {
  const amountRow = (amount: number): WriteRow => ({ id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount } })

  test('RT-25 an amount of 7693.52 is refused naming the row', () => {
    const problems = writeRefused(PROBE, [amountRow(100), amountRow(7693.52)], 'import')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ index: 1, identifier: 'GFGBA.Ttwgba64' })
    expect(must(problems[0], 'problem').reason).toMatch(/whole dollars|cents/i)
  })

  test('RT-25 7694 and -123 are written as "7694" and "-123"', () => {
    const out = writeOk(
      PROBE,
      [amountRow(7694), { id: id('FDONE.Ttwone5'), current: { kind: 'amount', amount: -123 } }],
      'import',
    )
    expect(asText(out)).toBe(`${HEADER_LINE}GFGBA.Ttwgba64,"7694","",""\r\nFDONE.Ttwone5,"-123","",""\r\n`)
  })

  test('RT-25 property (fixed seed): every whole-dollar amount is written as plain digits with a leading - and reads back equal', () => {
    fc.assert(
      fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }), (n) => {
        const out = writeOk(PROBE, [amountRow(n)], 'import')
        const row = asText(out).slice(HEADER_LINE.length)
        expect(row).toBe(`GFGBA.Ttwgba64,"${String(n)}","",""\r\n`)
        expect(row).toMatch(/^GFGBA\.Ttwgba64,"-?\d+","",""\r\n$/)
        const back = must(parseOk(out).rows[0], 'row').current
        expect(back.kind === 'value' ? Number(back.text) : null).toBe(n)
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  test('RT-25 property (fixed seed): every amount with cents is refused naming the row', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }), fc.integer({ min: 1, max: 99 }), (d, c) => {
        const amount = d + (d < 0 ? -c : c) / 100
        const problems = writeRefused(PROBE, [amountRow(amount)], 'import')
        expect(problems[0]).toMatchObject({ index: 0, identifier: 'GFGBA.Ttwgba64' })
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2])(
    'RT-25 planted fault: %s is refused as an amount, naming the row',
    (bad) => {
      const problems = writeRefused(PROBE, [amountRow(bad)], 'import')
      expect(problems[0]).toMatchObject({ index: 0, identifier: 'GFGBA.Ttwgba64' })
    },
  )
})

// ---------- 7. RT-21: identifier grammar ----------

describe('F03 check 7: the identifier grammar (RT-21)', () => {
  const exportDirs = ['reference/taxprep/2026-10-01-day1/exports', 'reference/taxprep/2026-10-02-day2/exports']
  const exportIds: string[] = []
  for (const dir of exportDirs) {
    for (const name of readdirSync(repoUrl(dir)).filter((n) => n.endsWith('.csv'))) {
      const lines = readFileSync(repoUrl(`${dir}/${name}`), 'latin1').split(/\r?\n/).slice(1)
      for (const line of lines) if (line !== '') exportIds.push(must(line.split(',')[0], 'identifier'))
    }
  }

  test('RT-21 every identifier in the committed trial exports (days 1 and 2) parses, keeping its text', () => {
    expect(exportIds.length).toBeGreaterThan(2000)
    const refused = exportIds.filter((t) => {
      const r = parseCellId(t)
      return !r.ok || r.id.text !== t
    })
    expect(refused).toEqual([])
  })

  test.each([
    ['IDENT.Ident120', null, null],
    ['GFBGII[1].GFGIJ.Ttwgij104', 'GFBGII', 1],
    ['GFGBA.Ttwgba64', null, null],
    ['FDONE.SLIPA[3].TtwoneA2', 'FDONE.SLIPA', 3],
    ['CCACat.FD08C[2].FED.Ttw08cA1', 'CCACat.FD08C', 2],
    ['IFirm.ContactPartner', null, null],
  ])('RT-21 %s parses with copy path %s and copy index %s', (text, copyPath, copyIndex) => {
    const r = parseCellId(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.id.text).toBe(text)
    expect(r.id.copyPath).toBe(copyPath)
    expect(r.id.copyIndex).toBe(copyIndex)
  })

  test.each([
    ['no dot', 'IDENT'],
    ['an empty part', 'IDENT..Ident120'],
    ['a lower-case first character in a part', 'IDENT.ident120'],
    ['a lower-case first character in the first part', 'iDENT.Ident120'],
    ['a digit first character in a part', 'IDENT.7Ident'],
    ['a copy index of 0', 'CCACat.FD08C[0].FED.Ttw08cA1'],
    ['a non-number copy index', 'CCACat.FD08C[a].FED.Ttw08cA1'],
    ['a space', 'IDENT.Ident 120'],
    ['a leading space', ' IDENT.Ident120'],
    ['nothing', ''],
  ])('RT-21 an identifier with %s (%j) is refused with a reason', (_what, text) => {
    const r = parseCellId(text)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason.trim().length).toBeGreaterThan(5)
  })

  test('RT-21 a file row with a bad identifier is refused naming the row and the reason', () => {
    const text = asText(golden(MADE_UP)).replace('CCACat.FD08C[2].FED.Ttw08cA1', 'CCACat.FD08C[0].FED.Ttw08cA1')
    const r = parseTaxprepCsv(fromText(text))
    expect(r.ok).toBe(false)
    if (r.ok) return
    const fault = must(
      r.faults.find((f) => f.code === 'identifier'),
      'identifier fault',
    )
    expect(fault.line).toBe(11)
    expect(fault.reason).toContain('CCACat.FD08C[0].FED.Ttw08cA1')
  })

  test('RT-21 withCopyIndex replaces the copy index and keeps the rest', () => {
    const moved = withCopyIndex(id('CCACat.FD08C[2].FED.Ttw08cA1'), 1)
    expect(moved.text).toBe('CCACat.FD08C[1].FED.Ttw08cA1')
    expect([moved.copyPath, moved.copyIndex]).toEqual(['CCACat.FD08C', 1])
    expect(withCopyIndex(id('FDONE.SLIPA[3].TtwoneA2'), 12).text).toBe('FDONE.SLIPA[12].TtwoneA2')
  })

  test('RT-21 planted fault: withCopyIndex refuses 0, a fraction, and an identifier with no copy index', () => {
    expect(() => withCopyIndex(id('CCACat.FD08C[2].FED.Ttw08cA1'), 0)).toThrow()
    expect(() => withCopyIndex(id('CCACat.FD08C[2].FED.Ttw08cA1'), 1.5)).toThrow()
    expect(() => withCopyIndex(id('IDENT.Ident120'), 1)).toThrow()
  })

  test('RT-21 a plain string is not a CellId (type test, enforced by typecheck)', () => {
    const typeOnly = (): unknown => {
      // @ts-expect-error a CellId comes only from parseCellId
      const row: WriteRow = { id: 'GFGBA.Ttwgba64', current: { kind: 'amount', amount: 1 } }
      return row
    }
    expect(typeOnly).toBeTypeOf('function')
  })

  test('RT-21 property (fixed seed): identifiers built from the grammar parse back to the same text', () => {
    fc.assert(
      fc.property(identifierArb, (text) => {
        const r = parseCellId(text)
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.id.text).toBe(text)
      }),
      { seed: SEED, numRuns: 300 },
    )
  })
})

// ---------- 8. RT-7: natural keys ----------

describe('F03 check 8: copies are found by natural key (RT-7)', () => {
  const exportRows = (rows: readonly (readonly [string, string])[]): ParsedRow[] => {
    const body = rows.map(([i, v]) => `${i},"${v}","",""\r\n`).join('')
    return parseOk(fromText(HEADER_LINE + body)).rows
  }

  test('RT-7 the registry keys CCACat.FD08C by FED.Ttw08cA1 (the CCA class)', () => {
    const registry: NaturalKeyRegistry = NATURAL_KEYS
    expect(registry['CCACat.FD08C']).toBe('FED.Ttw08cA1')
  })

  test('RT-7 after a delete renumbered class 8 from copy 2 to copy 1, the helper maps class 8 to copy 1', () => {
    const rows = exportRows([
      ['CCACat.FD08C[1].FED.Ttw08cA1', '8'],
      ['CCACat.FD08C[1].FED.Ttw08cA2', '0.2000'],
      ['CCACat.FD08C[1].FED.Ttw08cA5', '5000'],
      ['CCACat.FED.Ttw08c3', '1000'],
    ])
    const r = copiesByNaturalKey(rows, 'CCACat.FD08C')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect([...r.copies]).toEqual([['8', 1]])
  })

  test('RT-7 classes 1 and 8 at copies 1 and 2 map to their own copies', () => {
    const rows = exportRows([
      ['CCACat.FD08C[1].FED.Ttw08cA1', '1'],
      ['CCACat.FD08C[2].FED.Ttw08cA1', '8'],
      ['CCACat.FD08C[2].FED.Ttw08cA2', '0.2000'],
    ])
    const r = copiesByNaturalKey(rows, 'CCACat.FD08C', NATURAL_KEYS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.copies.get('1')).toBe(1)
    expect(r.copies.get('8')).toBe(2)
    expect(r.copies.size).toBe(2)
  })

  test('RT-7 planted fault: two copies holding the same class are refused as duplicates, naming the key', () => {
    const rows = exportRows([
      ['CCACat.FD08C[1].FED.Ttw08cA1', '8'],
      ['CCACat.FD08C[2].FED.Ttw08cA1', '8'],
    ])
    const r = copiesByNaturalKey(rows, 'CCACat.FD08C')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/duplicate/i)
    expect(r.reason).toContain('8')
  })

  test('RT-7 planted fault: a copy path with no natural-key cell in the registry is refused', () => {
    const rows = exportRows([['FDONE.SLIPA[1].TtwoneA2', '100']])
    const r = copiesByNaturalKey(rows, 'FDONE.SLIPA', {})
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toContain('FDONE.SLIPA')
  })
})

// ---------- 9. RT-13: ignored on import ----------

describe('F03 check 9: cells Taxprep ignores on import (RT-13)', () => {
  test('RT-13 the ignored-on-import list is one constant: year start and end and the contact-synchronised cells, each with its finding', () => {
    expect(IGNORED_ON_IMPORT.map((e) => e.identifier).sort()).toEqual([...IGNORED].sort())
    for (const e of IGNORED_ON_IMPORT) expect(e.finding.trim().length).toBeGreaterThan(10)
  })

  const valueFor = (ignored: string): WriteValue => {
    if (ignored === 'IDENT.Ident120' || ignored === 'IDENT.Ident121') return { kind: 'date', date: '2025-12-31' }
    if (ignored === 'IDENT.Ident492') return { kind: 'yesNo', yes: false }
    return { kind: 'text', text: 'Probe Co. (Test)' }
  }

  test.each(IGNORED)('RT-13 the import writer refuses a row for %s, naming it', (ignored) => {
    const problems = writeRefused(
      PROBE,
      [
        { id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: 1 } },
        { id: id(ignored), current: valueFor(ignored) },
      ],
      'import',
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ index: 1, identifier: ignored })
    expect(must(problems[0], 'problem').reason).toContain(ignored)
  })

  test('RT-13 the import writer refuses a clear for an ignored cell too', () => {
    const problems = writeRefused(PROBE, [{ id: id('IDENT.Ident311'), current: { kind: 'clear' } }], 'import')
    expect(problems[0]).toMatchObject({ index: 0, identifier: 'IDENT.Ident311' })
  })

  test('RT-13 the export writer (the shape Taxprep exports, for the simulator) writes those cells', () => {
    const out = writeOk(PROBE, [{ id: id('IDENT.Ident121'), current: { kind: 'date', date: '2025-12-31' } }], 'export')
    expect(asText(out)).toBe(`${HEADER_LINE}IDENT.Ident121,"2025-12-31","",""\r\n`)
  })
})

// ---------- 10. RT-3 property: write then parse ----------

describe('F03 check 10: write then parse (RT-3 property)', () => {
  test('RT-3 property (fixed seed): any list of valid rows survives write then parse unchanged', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const out = writeOk(
          PROBE,
          rows.map(([t, e]) => ({ id: id(t), current: e.value })),
          'import',
        )
        const back = parseOk(out)
        expect(back.header).toEqual(PROBE)
        expect(back.rows.map((r) => [r.id.text, r.current])).toEqual(
          rows.map(([t, e]) => [t, e.text === null ? { kind: 'clear' } : { kind: 'value', text: e.text }]),
        )
        expect(back.rows.every((r) => r.shape === 'standard' && !r.apostrophe)).toBe(true)
      }),
      { seed: SEED, numRuns: 200 },
    )
  })

  test('RT-3 planted fault: a date that is not YYYY-MM-DD is refused by the writer, naming the row', () => {
    for (const date of ['31/12/2025', '2025-02-30', '2025-1-5']) {
      const problems = writeRefused(PROBE, [{ id: id('IDENT.Ident121'), current: { kind: 'date', date } }], 'export')
      expect(problems[0]).toMatchObject({ index: 0, identifier: 'IDENT.Ident121' })
    }
  })

  test('RT-3 yes and no are written as Y and N, and a rate with 4 decimals', () => {
    const out = writeOk(
      PROBE,
      [
        { id: id('IDENT.Ident180'), current: { kind: 'yesNo', yes: true } },
        { id: id('IDENT.Ident183'), current: { kind: 'yesNo', yes: false } },
        { id: id('CCACat.FD08C[1].FED.Ttw08cA2'), current: { kind: 'rate', rate: 0.2 } },
      ],
      'import',
    )
    expect(asText(out)).toBe(
      `${HEADER_LINE}IDENT.Ident180,"Y","",""\r\nIDENT.Ident183,"N","",""\r\nCCACat.FD08C[1].FED.Ttw08cA2,"0.2000","",""\r\n`,
    )
  })
})

// ---------- 11. RT-14: cell classes ----------

describe('F03 check 11: the six cell classes (RT-14)', () => {
  const SIX = ['traced', 'overridden', 'dropped', 'rolled-forward', 'orphan', 'calculated'] as const

  test('RT-14 the cell-class type holds exactly the six classes', () => {
    expect([...CELL_CLASSES].sort()).toEqual([...SIX].sort())
    expectTypeOf<CellClass>().toEqualTypeOf<(typeof SIX)[number]>()
    for (const c of SIX) expect(isCellClass(c)).toBe(true)
  })

  test.each(['imported', 'Traced', 'rolled forward', 'rolledForward', '', 'calculated ', null, 3])(
    'RT-14 planted fault: %j is refused as a cell class',
    (value) => {
      expect(isCellClass(value)).toBe(false)
    },
  )
})

// ---------- 12. RT-3, RT-9: the export apostrophe ----------

describe('F03 check 12: a negative exported with a leading apostrophe (RT-3, RT-9; trial day 3)', () => {
  test('RT-3 RT-9 FDONE.Ttwone66,"\'-1356" parses as the amount -1356 with the row marked apostrophe', () => {
    const row = must(parseOk(golden('apostrophe-in.csv')).rows[0], 'row')
    expect(row.id.text).toBe('FDONE.Ttwone66')
    expect(row.current).toEqual({ kind: 'value', text: '-1356' })
    expect(row.apostrophe).toBe(true)
  })

  test('RT-3 RT-9 written back it is "-1356" with no apostrophe (golden)', () => {
    const file = parseOk(golden('apostrophe-in.csv'))
    const out = writeOk(file.header, toWriteRows(file.rows, {}), 'export')
    expect(asText(out)).toBe(asText(golden('apostrophe-out.csv')))
  })

  test('RT-9 a negative without the apostrophe is not marked', () => {
    expect(must(parseOk(golden('apostrophe-out.csv')).rows[0], 'row').apostrophe).toBe(false)
  })

  test.each(["'1356", "''-1356", "-'1356", "'0"])('RT-9 planted fault: %s is refused naming the row', (value) => {
    const r = parseTaxprepCsv(
      fromText(`${HEADER_LINE}GFGBA.Ttwgba64,"7693","",""\r\nFDONE.Ttwone66,"${value}","",""\r\n`),
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    const fault = must(
      r.faults.find((f) => f.code === 'apostrophe'),
      'apostrophe fault',
    )
    expect(fault.line).toBe(3)
  })

  test('RT-9 planted fault: a text value starting with an apostrophe is refused by the writer, naming the row', () => {
    const problems = writeRefused(
      PROBE,
      [{ id: id('IFirm.ContactPartner'), current: { kind: 'text', text: "'-1356" } }],
      'import',
    )
    expect(problems[0]).toMatchObject({ index: 0, identifier: 'IFirm.ContactPartner' })
  })

  test('RT-9 property (fixed seed): no input to the writer produces an apostrophe-marked value, import or export', () => {
    fc.assert(
      fc.property(rowsArb, fc.constantFrom('import' as const, 'export' as const), (rows, purpose) => {
        const out = writeOk(
          PROBE,
          rows.map(([t, e]) => ({ id: id(t), current: e.value })),
          purpose,
        )
        expect(asText(out)).not.toMatch(/,"'/)
        expect(parseOk(out).rows.some((r) => r.apostrophe)).toBe(false)
      }),
      { seed: SEED, numRuns: 200 },
    )
  })
})

// =====================================================================================================================
// Spec round 2 (fix round 2, findings review E03-F03 fix 5; reports/F03-mutants.md). One planted fault per refusal
// path and per regex anchor or class: each variant differs from the good made-up file in one way only. Near-miss text
// values (they only start or end like a fault) must read as text, because the writer writes them (RT-3 round trip).
// Assertions pin the stable fault `code`, the line, and the row and character where the card names them; reason
// wording is not pinned.
// =====================================================================================================================

const GOOD_FILE = asText(golden(MADE_UP))
const LINE_8 = 'GFGBA.Ttwgba127,"1620","",""'

/** The good made-up file with one change. */
function oneChange(from: string, to: string): Buffer {
  if (!GOOD_FILE.includes(from)) throw new Error(`test fixture: ${JSON.stringify(from)} is not in the good file`)
  return fromText(GOOD_FILE.replace(from, to))
}

function faultsOf(bytes: Uint8Array) {
  const r = parseTaxprepCsv(bytes)
  if (r.ok) throw new Error('expected the file to be refused, but it parsed')
  return r.faults
}

function expectFault(bytes: Uint8Array, code: TaxprepFaultCode, line: number | null) {
  const faults = faultsOf(bytes)
  const hit = faults.find((f) => f.code === code && f.line === line)
  expect(hit, `faults seen: ${JSON.stringify(faults)}`).toBeDefined()
  expect(must(hit, 'fault').reason.trim().length).toBeGreaterThan(10)
}

/** The value in row 8 (GFGBA.Ttwgba127, "1620") replaced by `value`. */
const row8 = (value: string): Buffer => oneChange('"1620"', `"${value}"`)
/** The text value in row 3 (IDENT.Ident311) replaced by `value`. */
const row3 = (value: string): Buffer => oneChange('"Café Étienne Ltée (Test)"', `"${value}"`)

const UNDEFINED_1252 = ['\u0081', '\u008d', '\u008f', '\u0090', '\u009d']

describe('F03 round 2: the writer refuses what Windows-1252 cannot hold (RT-9)', () => {
  const textRow = (text: string): WriteRow => ({
    id: id('IFirm.ContactPartner'),
    current: { kind: 'text', text },
  })
  const lead: WriteRow = {
    id: id('GFGBA.Ttwgba64'),
    current: { kind: 'amount', amount: 7694 },
  }

  test.each(UNDEFINED_1252.map((ch) => [`U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`, ch]))(
    'RT-9 a text value holding the Windows-1252 undefined character %s is refused naming the row and the character',
    (_name, ch) => {
      const problems = writeRefused(PROBE, [lead, textRow(`Partner ${ch} (Test)`)], 'import')
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatchObject({
        index: 1,
        identifier: 'IFirm.ContactPartner',
        character: ch,
      })
      expect(must(problems[0], 'problem').reason).toContain('IFirm.ContactPartner')
    },
  )

  test.each(UNDEFINED_1252.map((ch) => [`U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`, ch]))(
    'RT-9 the export writer refuses the undefined character %s as well (no purpose writes it)',
    (_name, ch) => {
      const problems = writeRefused(PROBE, [textRow(`Partner ${ch} (Test)`)], 'export')
      expect(problems[0]).toMatchObject({
        index: 0,
        identifier: 'IFirm.ContactPartner',
        character: ch,
      })
    },
  )

  test('RT-9 U+0080 (a control character with no Windows-1252 byte; byte 80 is the euro) is refused naming the character', () => {
    const problems = writeRefused(PROBE, [textRow('Partner \u0080 (Test)')], 'import')
    expect(problems[0]).toMatchObject({
      index: 0,
      identifier: 'IFirm.ContactPartner',
      character: '\u0080',
    })
  })

  test.each([
    ['a line feed', '\n'],
    ['a carriage return', '\r'],
    ['a tab', '\t'],
    ['a delete', '\u007f'],
  ])(
    'RT-9 a text value holding %s (it would break the one-row-per-line file) is refused naming the row and the character',
    (_what, ch) => {
      const problems = writeRefused(PROBE, [lead, textRow(`Partner${ch}Two (Test)`)], 'import')
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatchObject({
        index: 1,
        identifier: 'IFirm.ContactPartner',
        character: ch,
      })
    },
  )

  test('RT-9 a description holding a character outside Windows-1252 is refused naming the row and the character', () => {
    const problems = writeRefused(
      PROBE,
      [
        lead,
        {
          id: id('GFGBA.Ttwgba72'),
          current: { kind: 'amount', amount: 5 },
          description: 'Line ≥ 100 (Test)',
        },
      ],
      'import',
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({
      index: 1,
      identifier: 'GFGBA.Ttwgba72',
      character: '≥',
    })
  })

  test('RT-9 the edges of the single-byte ranges are written as one byte each: A0 (no-break space), FF (y-diaeresis), 9F (Y-diaeresis), 80 (euro)', () => {
    const out = writeOk(PROBE, [textRow('Prix net ÿ Ÿves € (Test)')], 'import')
    expect(asText(out).slice(HEADER_LINE.length)).toBe(
      'IFirm.ContactPartner,"Prix\xa0net \xff \x9fves \x80 (Test)","",""\r\n',
    )
    expect(must(parseOk(out).rows[0], 'row').current).toEqual({
      kind: 'value',
      text: 'Prix net ÿ Ÿves € (Test)',
    })
  })

  test('RT-9 byte 9F in a file reads as Y-diaeresis (U+0178), byte 80 as the euro', () => {
    const row = must(parseOk(row3('\x9fves \x80 (Test)')).rows[1], 'row 3')
    expect(row.current).toEqual({ kind: 'value', text: 'Ÿves € (Test)' })
  })

  test('RT-9 a refusal that is not about a character carries no character', () => {
    const problems = writeRefused(
      PROBE,
      [{ id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: 1.5 } }],
      'import',
    )
    expect(must(problems[0], 'problem')).not.toHaveProperty('character')
  })
})

describe('F03 round 2: the RT-3 round trip over the whole Windows-1252 alphabet', () => {
  // Every printable Windows-1252 character: 20 to 7E, the 27 defined in 80 to 9F, A0 to FF. The five undefined
  // characters (U+0081, U+008D, U+008F, U+0090, U+009D) are left out: the writer refuses them (RT-9).
  const decoder = new TextDecoder('windows-1252')
  const ALPHABET: string[] = []
  for (let b = 0x20; b <= 0xff; b++) {
    if (b === 0x7f) continue
    const ch = decoder.decode(Uint8Array.of(b))
    if (!UNDEFINED_1252.includes(ch)) ALPHABET.push(ch)
  }

  test('RT-3 RT-9 neither round-trip alphabet holds any of the five undefined characters', () => {
    expect(ALPHABET).toHaveLength(95 + 27 + 96)
    for (const ch of UNDEFINED_1252) {
      expect(ALPHABET).not.toContain(ch)
      expect(TEXT_CHARS).not.toContain(ch)
    }
  })

  test('RT-3 RT-9 property (fixed seed): text of any Windows-1252 characters, spaced so no two high bytes touch, survives write then parse', () => {
    // Spacing keeps the bytes from forming a UTF-8 sequence, which the parser must refuse (spec amber 6, logged on T02).
    const spaced = fc
      .array(fc.constantFrom(...ALPHABET), { minLength: 1, maxLength: 40 })
      .map((chars) => `A ${chars.join(' ')}`)
    fc.assert(
      fc.property(spaced, fc.constantFrom('import' as const, 'export' as const), (text, purpose) => {
        const out = writeOk(
          PROBE,
          [
            {
              id: id('IFirm.ContactPartner'),
              current: { kind: 'text', text },
            },
          ],
          purpose,
        )
        expect(must(parseOk(out).rows[0], 'row').current).toEqual({
          kind: 'value',
          text,
        })
      }),
      { seed: SEED, numRuns: 300 },
    )
  })
})

describe('F03 round 2: the identifier grammar is anchored at both ends (RT-21)', () => {
  test.each([
    ['text after the copy index', 'A.B[1]x'],
    ['a second closing bracket', 'A.B[1]]'],
    ['a hyphen inside a part', 'IDENT.Ident-120'],
    ['an underscore inside a part', 'IDENT.Ident_120'],
    ['a copy index in scientific notation', 'A.B[1e3].C'],
    ['a copy index with letters after the digits', 'A.B[2x].C'],
    ['an empty copy index', 'A.B[].C'],
    ['a trailing dot', 'IDENT.Ident120.'],
  ])('RT-21 an identifier with %s (%j) is refused with a reason', (_what, text) => {
    const r = parseCellId(text)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toContain(text)
  })

  test.each(['A.B[1]x', 'A.B[1]]'])('RT-21 a file row with the identifier %s is refused naming the row', (bad) => {
    expectFault(oneChange('GFGBA.Ttwgba127,', `${bad},`), 'identifier', 8)
  })

  test('RT-21 A.B[1] (copy index on the last part) parses with copy path A.B and index 1', () => {
    const r = parseCellId('A.B[1]')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect([r.id.copyPath, r.id.copyIndex]).toEqual(['A.B', 1])
  })
})

describe('F03 round 2: each fault regex is anchored and class-exact (RT-9)', () => {
  test.each([
    // apostrophe
    ['apostrophe', "'-1356'"],
    ['apostrophe', "'-12'3"],
    ['apostrophe', "'-0"],
    ['apostrophe', "'-00"],
    // negatives in brackets
    ['negative-parens', '(-1356)'],
    ['negative-parens', '( 1356 )'],
    ['negative-parens', '(1,356.00)'],
    // thousands
    ['thousands', '1,234,567'],
    ['thousands', '1 234 567'],
    ['thousands', '48,600.50'],
    ['thousands', '-48,600'],
    // decimal comma
    ['decimal-comma', '12,50'],
    ['decimal-comma', '-0,5'],
    // scientific
    ['scientific', '12E3'],
    ['scientific', '5e3'],
    ['scientific', '4.86E04'],
    ['scientific', '-1.5e-3'],
    // reformatted dates
    ['date-format', '2026/10/01'],
    ['date-format', '2026.10.01'],
    ['date-format', '2026.1.5'],
    ['date-format', '1.10.2026'],
    ['date-format', '01-10-2026'],
    ['date-format', '1/10/26'],
  ] as const)('RT-9 the value is refused with code %s: %j (row 8, one change from the good file)', (code, value) => {
    expectFault(row8(value), code, 8)
  })

  test.each([
    "O'Neil Unit 12",
    "12 O'Neil Street",
    '(12) Rear unit',
    'Unit (12)',
    'Lot 1,250',
    '3,4 Rear',
    'Lot 3,4',
    '4.86E+04 units',
    'Item 4.86E+04',
    '01/10/2026 onwards',
    '2026/10/01 onwards',
    'Ref 2026/10/01',
  ])('RT-3 RT-9 the text %j only starts or ends like a fault: it is written and read back as that text', (text) => {
    const r = parseTaxprepCsv(row3(text))
    expect(r.ok, r.ok ? '' : JSON.stringify(r.faults)).toBe(true)
    if (!r.ok) return
    expect(must(r.file.rows[1], 'row 3').current).toEqual({
      kind: 'value',
      text,
    })
    const out = writeOk(PROBE, [{ id: id('IDENT.Ident311'), current: { kind: 'text', text } }], 'export')
    expect(must(parseOk(out).rows[0], 'row').current).toEqual({
      kind: 'value',
      text,
    })
  })
})

describe('F03 round 2: separators, quotes, line ends, byte-order mark and UTF-8 (RT-9)', () => {
  test.each([
    ['a tab', '\t'],
    ['a semicolon', ';'],
    ['a space', ' '],
  ])('RT-9 %s between the values of one row only is refused as a separator fault on that row', (_what, sep) => {
    expectFault(oneChange(LINE_8, `GFGBA.Ttwgba127,"1620"${sep}""${sep}""`), 'separator', 8)
  })

  test.each([
    ['a tab', '\t'],
    ['a semicolon', ';'],
    ['a space', ' '],
  ])('RT-9 %s after the identifier of one row only is refused as a separator fault on that row', (_what, sep) => {
    expectFault(oneChange(LINE_8, `GFGBA.Ttwgba127${sep}"1620","",""`), 'separator', 8)
  })

  test.each([
    ['a tab', '\t'],
    ['a semicolon', ';'],
    ['a space', ' '],
  ])('RT-9 %s after the header brackets only is refused as a separator fault on line 1', (_what, sep) => {
    expectFault(oneChange('],"Current Year"', `]${sep}"Current Year"`), 'separator', 1)
  })

  test.each([
    ['text after a closing quote', 'GFGBA.Ttwgba127,"16"20,"",""'],
    ['an unquoted last-year value', 'GFGBA.Ttwgba127,"1620",0,""'],
    ['an unquoted description', 'GFGBA.Ttwgba127,"1620","",Bank'],
    ['a quote that is never closed', 'GFGBA.Ttwgba127,"1620","","'],
    ['a trailing comma with no value', 'GFGBA.Ttwgba127,"1620","",'],
    ['no value after the identifier', 'GFGBA.Ttwgba127'],
  ])('RT-9 %s is refused as unquoted on that row', (_what, line) => {
    expectFault(oneChange(LINE_8, line), 'unquoted', 8)
  })

  test('RT-9 a file with only a byte-order mark wrong is refused for the mark alone (the header after it still reads)', () => {
    const faults = faultsOf(fromText('\xef\xbb\xbf' + GOOD_FILE))
    expect(faults.map((f) => f.code)).toEqual(['bom'])
  })

  test.each([
    ['a three-byte UTF-8 euro (E2 82 AC)', 'Caf\xe2\x82\xac (Test)'],
    ['a four-byte UTF-8 emoji (F0 9F 98 80)', 'Caf\xf0\x9f\x98\x80 (Test)'],
    ['a two-byte UTF-8 e-acute (C3 A9)', 'Caf\xc3\xa9 (Test)'],
  ])('RT-9 %s in one text value is refused as UTF-8 on that row', (_what, text) => {
    expectFault(row3(text), 'utf8', 3)
  })

  test.each([
    [
      'e-acute then the euro byte (E9 80): a lead byte with one continuation byte only',
      'Caf\xe9\x80 (Test)',
      'Café€ (Test)',
    ],
    [
      'eth then the Y-diaeresis byte (F0 9F): a four-byte lead with one continuation byte only',
      'Bj\xf0\x9f (Test)',
      'BjðŸ (Test)',
    ],
  ])('RT-9 %s is Windows-1252 text, not UTF-8: it reads as text', (_what, raw, text) => {
    const r = parseTaxprepCsv(row3(raw))
    expect(r.ok, r.ok ? '' : JSON.stringify(r.faults)).toBe(true)
    if (!r.ok) return
    expect(must(r.file.rows[1], 'row 3').current).toEqual({
      kind: 'value',
      text,
    })
  })

  test('RT-9 one lone CR (a line ended CR only) is refused as a line-end fault', () => {
    expectFault(oneChange('IDENT.Ident180,"Y","",""\r\n', 'IDENT.Ident180,"Y","",""\r'), 'line-ends', null)
  })

  test('RT-9 one LF-only line among CRLF lines is refused as a line-end fault', () => {
    expectFault(oneChange('IDENT.Ident180,"Y","",""\r\n', 'IDENT.Ident180,"Y","",""\n'), 'line-ends', null)
  })

  test('RT-9 every fault is reported: a missing last CRLF and a bad identifier on the last row both show', () => {
    const text = GOOD_FILE.replace('CCACat.FD08C[2].FED.Ttw08cA2', 'CCACat.FD08C[0].FED.Ttw08cA2').slice(0, -2)
    const faults = faultsOf(fromText(text))
    expect(faults.some((f) => f.code === 'line-ends')).toBe(true)
    expect(faults.some((f) => f.code === 'identifier' && f.line === 12)).toBe(true)
  })
})

describe('F03 round 2: the header line (RT-3, RT-9)', () => {
  const GOOD_HEADER = '[Probe Co. (Test)|0|0|5f0c2e9a-1b7d-4c3e-9a21-0d6e8b4f7a10]'

  test('RT-9 an empty file is refused with a header fault on line 1', () => {
    expectFault(new Uint8Array(0), 'header', 1)
  })

  test.each([
    ['text before the opening bracket', (t: string) => t.replace(GOOD_HEADER, `x${GOOD_HEADER}`)],
    [
      'the last column name missing',
      (t: string) => t.replace(',"Current Year","Last Year",""\r\n', ',"Current Year","Last Year"\r\n'),
    ],
    [
      'text between the bracket and the column names',
      (t: string) => t.replace('],"Current Year"', ']x,"Current Year"'),
    ],
    ['text after the column names', (t: string) => t.replace('"Last Year",""\r\n', '"Last Year","",x\r\n')],
    ['unquoted column names', (t: string) => t.replace(',"Current Year","Last Year",""', ',Current Year,Last Year,')],
  ])('RT-9 a header with %s is refused with a header fault on line 1', (_what, make) => {
    const bad = make(GOOD_FILE)
    expect(bad).not.toBe(GOOD_FILE)
    expectFault(fromText(bad), 'header', 1)
  })
})

describe('F03 round 2: row shapes and the last-year column (RT-3)', () => {
  test('RT-3 a row with a current and a last-year value but no description reads both values, description null', () => {
    const row = must(parseOk(oneChange(LINE_8, 'GFGBA.Ttwgba127,"1620","1500"')).rows[6], 'row 8')
    expect(row.id.text).toBe('GFGBA.Ttwgba127')
    expect(row.current).toEqual({ kind: 'value', text: '1620' })
    expect(row.last).toEqual({ kind: 'value', text: '1500' })
    expect(row.description).toBeNull()
  })

  test('RT-3 a four-column row reads its last-year value', () => {
    const row = must(parseOk(oneChange(LINE_8, 'GFGBA.Ttwgba127,"1620","1500",""')).rows[6], 'row 8')
    expect(row.last).toEqual({ kind: 'value', text: '1500' })
    expect(row.shape).toBe('standard')
  })

  test('RT-3 a last-year value given to the writer is written in the third column and read back', () => {
    const out = writeOk(
      PROBE,
      [
        {
          id: id('GFGBA.Ttwgba127'),
          current: { kind: 'amount', amount: 1620 },
          last: { kind: 'amount', amount: -1500 },
        },
      ],
      'import',
    )
    expect(asText(out)).toBe(`${HEADER_LINE}GFGBA.Ttwgba127,"1620","-1500",""\r\n`)
    expect(must(parseOk(out).rows[0], 'row').last).toEqual({
      kind: 'value',
      text: '-1500',
    })
  })

  test('RT-25 a last-year amount with cents is refused naming the row', () => {
    const problems = writeRefused(
      PROBE,
      [
        {
          id: id('GFGBA.Ttwgba127'),
          current: { kind: 'amount', amount: 1620 },
          last: { kind: 'amount', amount: 15.5 },
        },
      ],
      'import',
    )
    expect(problems[0]).toMatchObject({
      index: 0,
      identifier: 'GFGBA.Ttwgba127',
    })
  })

  test('RT-9 a bad last-year value in a file is refused on that row', () => {
    expectFault(oneChange(LINE_8, 'GFGBA.Ttwgba127,"1620","1,500",""'), 'thousands', 8)
  })
})

describe('F03 round 2: the natural-key helper skips what is not a key cell (RT-7)', () => {
  const exportRows = (rows: readonly (readonly [string, string])[]): ParsedRow[] =>
    parseOk(fromText(HEADER_LINE + rows.map(([i, v]) => `${i},"${v}","",""\r\n`).join(''))).rows

  test('RT-7 a row whose copy index sits on another part (CCACat[1].FD08C.FED.Ttw08cA1) is not a copy of CCACat.FD08C', () => {
    const r = copiesByNaturalKey(
      exportRows([
        ['CCACat[1].FD08C.FED.Ttw08cA1', '10'],
        ['CCACat.FD08C[2].FED.Ttw08cA1', '8'],
      ]),
      'CCACat.FD08C',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect([...r.copies]).toEqual([['8', 2]])
  })

  test('RT-7 a copy whose key cell is a clear has no natural key and is left out', () => {
    const r = copiesByNaturalKey(
      exportRows([
        ['CCACat.FD08C[1].FED.Ttw08cA1', ''],
        ['CCACat.FD08C[2].FED.Ttw08cA1', '8'],
      ]),
      'CCACat.FD08C',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect([...r.copies]).toEqual([['8', 2]])
  })
})

describe('F03 round 2: writer refusals for dates, rates and the header (RT-3, RT-9, RT-25)', () => {
  test.each(['12025-01-01', '2025-01-01x', ' 2025-01-01', '2025-13-01', '2025-00-10', '2025-12-32', '0099-06-15'])(
    'RT-3 RT-9 the date %j is refused naming the row',
    (date) => {
      const problems = writeRefused(PROBE, [{ id: id('IDENT.Ident121'), current: { kind: 'date', date } }], 'export')
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatchObject({
        index: 0,
        identifier: 'IDENT.Ident121',
      })
    },
  )

  test.each(['2024-02-29', '2025-12-31', '1990-01-01'])('RT-3 the real date %s is written as given', (date) => {
    const out = writeOk(PROBE, [{ id: id('IDENT.Ident121'), current: { kind: 'date', date } }], 'export')
    expect(asText(out)).toBe(`${HEADER_LINE}IDENT.Ident121,"${date}","",""\r\n`)
  })

  test.each([0.12345, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'RT-25 the rate %s is refused naming the row',
    (rate) => {
      const problems = writeRefused(
        PROBE,
        [
          {
            id: id('CCACat.FD08C[1].FED.Ttw08cA2'),
            current: { kind: 'rate', rate },
          },
        ],
        'import',
      )
      expect(problems[0]).toMatchObject({
        index: 0,
        identifier: 'CCACat.FD08C[1].FED.Ttw08cA2',
      })
    },
  )

  test.each([
    ['a return name holding a character outside Windows-1252', { returnName: 'Probe ≥ Co. (Test)', guid: ZERO_GUID }],
    ['a return name holding |', { returnName: 'Probe | Co. (Test)', guid: ZERO_GUID }],
    ['a return name holding ]', { returnName: 'Probe ] Co. (Test)', guid: ZERO_GUID }],
    ['a GUID holding |', { returnName: 'Probe Co. (Test)', guid: '0000|0000' }],
    ['a GUID holding ]', { returnName: 'Probe Co. (Test)', guid: '0000]0000' }],
    ['a GUID starting with a non-ASCII character', { returnName: 'Probe Co. (Test)', guid: `é${ZERO_GUID}` }],
    ['a GUID ending with a non-ASCII character', { returnName: 'Probe Co. (Test)', guid: `${ZERO_GUID}é` }],
  ])('RT-9 a header with %s is refused as the header, not as a row', (_what, header) => {
    const problems = writeRefused(
      header,
      [{ id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: 1 } }],
      'import',
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ index: -1, identifier: 'header' })
  })
})
