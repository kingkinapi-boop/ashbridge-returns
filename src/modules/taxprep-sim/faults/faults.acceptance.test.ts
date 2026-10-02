/**
 * S01 Taxprep simulator, fault injection: acceptance tests (spec-writer only; builders never edit).
 * Follows plan/cards/S01.md, blueprint 04 (RT-1, RT-2, RT-7, RT-9, RT-14, RT-20, RT-23) and reference/taxprep/FINDINGS.md
 * (Q21 copies renumber after a delete, Q27 the header is not read on import).
 *
 * The public API these tests fix (spec choices, amber; the builder implements exactly these names in
 * src/modules/taxprep-sim/faults/index.ts). It uses S00's simulator (`../index`) and F03's contract only.
 *
 *   type FaultName = 'partial-import' | 'wrong-client' | 'reordered-copies' | 'stale-export'
 *                  | 'spreadsheet-mangled' | 'edit-outside-trace'
 *   type ClauseId = `RT-${number}`
 *   type CatalogueEntry = { readonly fault: FaultName; readonly clauses: readonly [ClauseId, ...ClauseId[]];
 *                           readonly summary: string }
 *     the type refuses an entry with no clauses or an empty list (RT-23).
 *   FAULT_CATALOGUE: readonly CatalogueEntry[]   exactly the six faults, each once.
 *   type Mangling = 'bom' | 'line-ends' | 'separator' | 'unquoted' | 'negative-parens' | 'thousands'
 *                 | 'decimal-comma' | 'scientific' | 'date-format' | 'utf8'
 *     (each is the F03 fault code its mangled file is refused with; 'line-ends' is LF-only line ends)
 *   MANGLINGS: readonly Mangling[]               exactly those ten.
 *   type FaultChange = { readonly kind: 'header' } | { readonly kind: 'cell'; readonly identifier: string }
 *                    | { readonly kind: 'format'; readonly mangling: Mangling }
 *   type FaultRecord = { readonly fault: FaultName; readonly clauses: readonly [ClauseId, ...ClauseId[]];
 *                        readonly changed: readonly FaultChange[] }
 *     clauses are the catalogue entry's. `changed` names exactly what the fault changed against its clean baseline
 *     (below), each cell once, by its identifier in the faulty result (or in the baseline when the fault removed it).
 *   type SeedOptions = { readonly seed: number }   a whole number; the only source of choice (no Math.random, no clock).
 *
 *   partialImport(sim, ret, bytes, { seed }): { report: ImportReport; applied: number; record: FaultRecord }
 *     applies only the first `applied` rows (1 <= applied < the file's row count, chosen by the seed); the rest are
 *     silently missing. `report` is the report the whole file would have given (RT-26: the fault hides itself).
 *     Baseline: the same file imported whole into an identical return. A file of fewer than 2 rows throws.
 *   wrongClientExport(bytes, { seed, form?: 'year-end' | 'business-number' }): { bytes: Uint8Array; record }
 *     an export as if from another return: another GUID in the header (always), and either another year end in
 *     IDENT.Ident121 (form 'year-end', the default: test returns hold no business number, RT-1 trial day 5) or another
 *     business number in IDENT.Ident7 (form 'business-number': planted when the export has none, changed when it has
 *     one; NNNNNNNNNRCNNNN). Baseline: the input bytes.
 *   wrongReturnImport(sim, other, bytes, { seed }): { report: ImportReport; record }
 *     an import file written for one return (its header names that return) applied to `other`, as Taxprep does,
 *     silently (Q27). Baseline: `other`'s "entered" export just before.
 *   reorderedCopies(bytes, { seed, copyPath? }): { bytes; record; deleted: { copyPath: string; index: number;
 *     naturalKey: string } }
 *     on an export: one copy of a repeating form deleted (never the last, so the copies after it move) and the copies
 *     after it renumbered down with no gap (Q21). The form is `copyPath`, or the first form of F03's NATURAL_KEYS with
 *     at least two copies. Fewer than two copies throws. Baseline: the input bytes.
 *   staleExport(sim, ret, nextImport, { seed, filter? }): { stale: Uint8Array; report: ImportReport; record }
 *     takes an export (filter default 'entered'), then imports `nextImport` into `ret`; `stale` is the earlier export.
 *     Baseline: `ret`'s export after the import.
 *   mangleExport(bytes, mangling, { seed }): { bytes; record }
 *     the export re-saved by a spreadsheet program in one way (RT-9). File-wide manglings ('bom', 'line-ends',
 *     'separator', 'unquoted') record only { kind: 'format' }; the others record the format and one 'cell' (or
 *     'header') change per line they touch, and leave every other line byte-identical. Baseline: the input bytes.
 *   editOutsideTrace(sim, ret, { seed }): { record }
 *     on a locked return: one cell changed by hand, with no import and no unlock (RT-20); the return stays locked.
 *     An unlocked return throws. Baseline: `ret`'s "entered" export just before.
 *
 * Every function leaves its input bytes untouched and gives the same bytes and the same record for the same seed.
 */
import fc from 'fast-check'
import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest'
import { NATURAL_KEYS, copiesByNaturalKey, type TaxprepFaultCode } from '../../../contracts/taxprep'
import { createSimulator, type ReleaseCell, type SimReturn, type Simulator } from '../index'
import {
  FAULT_CATALOGUE,
  MANGLINGS,
  editOutsideTrace,
  mangleExport,
  partialImport,
  reorderedCopies,
  staleExport,
  wrongClientExport,
  wrongReturnImport,
  type CatalogueEntry,
  type FaultChange,
  type FaultName,
  type FaultRecord,
  type Mangling,
} from './index'
import {
  BN_CELL,
  CCA,
  CLASS_CELL,
  FILE_A_ROWS,
  FILE_B_CHANGES,
  FILE_B_ROWS,
  GIFI,
  GUID_A,
  GUID_B,
  GUID_RE,
  RATE_CELL,
  SEED,
  SEEDS,
  UCC_CELL,
  CLAIMED_CELL,
  YEAR_END_CELL,
  ZERO_HEADER,
  asText,
  cellDiff,
  cellsOf,
  faultsOf,
  fromText,
  importFile,
  lineId,
  linesOf,
  linesWithout,
  parseOk,
  repoText,
} from './__fixtures__/harness'

// ---------- the test world: a small release list and returns built the same way every time ----------

function releaseList(): ReleaseCell[] {
  const cells: Omit<ReleaseCell, 'order'>[] = [
    { identifier: 'IDENT.Ident120', description: 'Line 060 - Tax year start date', kind: 'date' },
    { identifier: YEAR_END_CELL, description: 'Line 061 - Tax year-end', kind: 'date' },
    { identifier: BN_CELL, description: 'Business number', kind: 'text' },
    { identifier: 'IDENT.Ident311', description: "Corporation's name", kind: 'text' },
    { identifier: 'IDENT.Ident230', description: 'Line 990 - Language of correspondence', kind: 'text' },
    { identifier: 'IDENT.Ident451', description: 'CCH iFirm - Client code', kind: 'text' },
    { identifier: 'IDENT.Ident492', description: '', kind: 'yesNo' },
    { identifier: 'IFirm.ContactPartner', description: 'Partner', kind: 'text' },
    { identifier: 'IFirm.ContactID', description: 'Contact ID', kind: 'text' },
    ...GIFI.map((identifier, i) => ({
      identifier,
      description: `GIFI code ${String(1000 + i)} - Test description`,
      kind: 'amount' as const,
    })),
    { identifier: CLASS_CELL(1), description: 'CCA class number', kind: 'text', repeating: true },
    { identifier: RATE_CELL(1), description: 'CCA rate', kind: 'rate', repeating: true },
    { identifier: UCC_CELL(1), description: 'UCC at start of year', kind: 'amount', repeating: true },
    { identifier: CLAIMED_CELL(1), description: 'CCA claimed', kind: 'amount', repeating: true },
  ]
  return cells.map((c, i) => ({ ...c, order: i + 1 }))
}

const NAME_A = 'Café Probe (Test)'
const NAME_B = 'Other Probe (Test)'

type World = { sim: Simulator; a: SimReturn; b: SimReturn }

/** A simulator with two returns, A (Café Probe, GUID_A) and B (Other Probe, GUID_B), years set, nothing imported. */
function world(): World {
  const queue = [GUID_A, GUID_B]
  const sim = createSimulator({
    releaseList: releaseList(),
    newGuid: () => {
      const next = queue.shift()
      if (next === undefined) throw new Error('test world: only two guids')
      return next
    },
  })
  const a = sim.createReturn({
    businessNumber: '100000009RC0001',
    yearEnd: '2025-12-31',
    returnName: NAME_A,
    corporationName: NAME_A,
    clientCode: 'C900',
  })
  const b = sim.createReturn({
    businessNumber: '100000017RC0001',
    yearEnd: '2025-06-30',
    returnName: NAME_B,
    corporationName: NAME_B,
    clientCode: 'C901',
  })
  sim.setYear(a, { start: '2025-01-01', end: '2025-12-31' })
  sim.setYear(b, { start: '2024-07-01', end: '2025-06-30' })
  return { sim, a, b }
}

const FILE_A = importFile(FILE_A_ROWS, ZERO_HEADER)
const FILE_B = importFile(FILE_B_ROWS, ZERO_HEADER)

function mustImport(sim: Simulator, ret: SimReturn, bytes: Uint8Array) {
  const r = sim.importCsv(ret, bytes)
  if (!r.ok) throw new Error(`test world: import refused: ${JSON.stringify(r.faults)}`)
  return r.report
}

/** World with FILE_A imported into A. */
function worldWithA(): World {
  const w = world()
  mustImport(w.sim, w.a, FILE_A)
  return w
}

/** A's "entered" export after FILE_A: three S8 copies, a negative, an accent, dates. */
function exportA(): Uint8Array {
  const w = worldWithA()
  return w.sim.exportCsv(w.a, 'entered')
}

const cellsIn = (record: FaultRecord): string[] =>
  record.changed.flatMap((c) => (c.kind === 'cell' ? [c.identifier] : [])).sort()
const hasHeader = (record: FaultRecord): boolean => record.changed.some((c) => c.kind === 'header')
const formats = (record: FaultRecord): Mangling[] =>
  record.changed.flatMap((c) => (c.kind === 'format' ? [c.mangling] : []))

function entry(fault: FaultName): CatalogueEntry {
  const found = FAULT_CATALOGUE.find((e) => e.fault === fault)
  if (found === undefined) throw new Error(`no catalogue entry for ${fault}`)
  return found
}

function expectRecordOf(record: FaultRecord, fault: FaultName): void {
  expect(record.fault).toBe(fault)
  expect([...record.clauses]).toEqual([...entry(fault).clauses])
  const cells = cellsIn(record)
  expect(new Set(cells).size).toBe(cells.length)
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------- 1: the catalogue ----------

const SIX: readonly FaultName[] = [
  'partial-import',
  'wrong-client',
  'reordered-copies',
  'stale-export',
  'spreadsheet-mangled',
  'edit-outside-trace',
]

describe('RT-23 the fault catalogue (check 1)', () => {
  test('RT-23 the catalogue holds exactly the six faults the clause names, each once', () => {
    expect(FAULT_CATALOGUE.map((e) => e.fault).sort()).toEqual([...SIX].sort())
  })

  test('RT-23 every catalogue entry names at least one clause, and every clause exists in blueprint 04', () => {
    const blueprint = repoText('blueprint/04-roundtrip.md')
    for (const e of FAULT_CATALOGUE) {
      expect(e.clauses.length, e.fault).toBeGreaterThan(0)
      expect(e.summary.trim().length, e.fault).toBeGreaterThan(0)
      for (const clause of e.clauses) expect(blueprint, `${e.fault} cites ${clause}`).toContain(`**${clause}**`)
    }
  })

  test('RT-23 each fault cites the clause that must catch it (RT-14, RT-1, RT-7, RT-2, RT-9, RT-20)', () => {
    expect(entry('partial-import').clauses).toContain('RT-14')
    expect(entry('wrong-client').clauses).toContain('RT-1')
    expect(entry('reordered-copies').clauses).toContain('RT-7')
    expect(entry('stale-export').clauses).toContain('RT-2')
    expect(entry('spreadsheet-mangled').clauses).toContain('RT-9')
    expect(entry('edit-outside-trace').clauses).toContain('RT-20')
  })

  test('RT-23 the type refuses a fault with no clause or an empty clause list, and an unknown fault name', () => {
    expectTypeOf<FaultName>().toEqualTypeOf<
      'partial-import' | 'wrong-client' | 'reordered-copies' | 'stale-export' | 'spreadsheet-mangled' | 'edit-outside-trace'
    >()
    // @ts-expect-error a catalogue entry with no clauses does not type-check
    const noClause: CatalogueEntry = { fault: 'partial-import', summary: 'x' }
    // @ts-expect-error an empty clause list does not type-check
    const emptyClauses: CatalogueEntry = { fault: 'partial-import', clauses: [], summary: 'x' }
    // @ts-expect-error a clause that is not a clause id does not type-check
    const notAClause: CatalogueEntry = { fault: 'partial-import', clauses: ['dropped cells'], summary: 'x' }
    // @ts-expect-error a fault the catalogue does not name does not type-check
    const unknown: CatalogueEntry = { fault: 'lost-leading-zeros', clauses: ['RT-9'], summary: 'x' }
    const fine: CatalogueEntry = { fault: 'partial-import', clauses: ['RT-14', 'RT-1'], summary: 'x' }
    expect([noClause, emptyClauses, notAClause, unknown, fine]).toHaveLength(5)
    // @ts-expect-error a record with no clauses does not type-check either
    const record: FaultRecord = { fault: 'stale-export', changed: [] }
    expect(record.fault).toBe('stale-export')
  })

  test('RT-9 the spreadsheet manglings are exactly the ten of the F03 fault set, each an F03 fault code', () => {
    const ten = [
      'bom',
      'line-ends',
      'separator',
      'unquoted',
      'negative-parens',
      'thousands',
      'decimal-comma',
      'scientific',
      'date-format',
      'utf8',
    ] as const
    expect([...MANGLINGS].sort()).toEqual([...ten].sort())
    expectTypeOf<Mangling>().toEqualTypeOf<(typeof ten)[number]>()
    expectTypeOf<Mangling>().toExtend<TaxprepFaultCode>()
  })
})

// ---------- 7: partial import ----------

describe('RT-14 partial import (check 7)', () => {
  for (const seed of SEEDS) {
    test(`RT-14 seed ${String(seed)}: the report says the whole file applied while the export lacks the dropped rows`, () => {
      const clean = world()
      const cleanReport = mustImport(clean.sim, clean.a, FILE_A)
      const cleanExport = clean.sim.exportCsv(clean.a, 'entered')

      const w = world()
      const { report, applied, record } = partialImport(w.sim, w.a, FILE_A, { seed })
      const faulty = w.sim.exportCsv(w.a, 'entered')

      expect(report).toEqual(cleanReport)
      expect(report.summary).toBe('Data imported successfully')
      expect(report.lines).toEqual([])

      const rows = parseOk(FILE_A).rows
      expect(applied).toBeGreaterThanOrEqual(1)
      expect(applied).toBeLessThan(rows.length)
      const dropped = rows.slice(applied).map((r) => r.id.text)
      const kept = rows.slice(0, applied).map((r) => r.id.text)
      const seen = cellsOf(faulty)
      for (const cell of dropped) expect(seen.has(cell), `${cell} is dropped`).toBe(false)
      for (const cell of kept) expect(seen.get(cell), `${cell} is applied`).toBe(cellsOf(cleanExport).get(cell))

      expectRecordOf(record, 'partial-import')
      expect(cellsIn(record)).toEqual([...dropped].sort())
      expect(cellDiff(cleanExport, faulty)).toEqual(cellsIn(record))
      expect(hasHeader(record)).toBe(false)
      expect(asText(faulty).split('\r\n')[0]).toBe(asText(cleanExport).split('\r\n')[0])
    })
  }

  test('RT-14 on a return that already holds values, the report still equals the whole file\'s report, "replaced" lines included', () => {
    const clean = worldWithA()
    const cleanReport = mustImport(clean.sim, clean.a, FILE_B)
    const cleanExport = clean.sim.exportCsv(clean.a, 'entered')
    expect(cleanReport.lines.length).toBeGreaterThan(0)

    for (const seed of SEEDS) {
      const w = worldWithA()
      const { report, applied, record } = partialImport(w.sim, w.a, FILE_B, { seed })
      const faulty = w.sim.exportCsv(w.a, 'entered')
      expect(report, `seed ${String(seed)}`).toEqual(cleanReport)
      const dropped = parseOk(FILE_B)
        .rows.slice(applied)
        .map((r) => r.id.text)
      const droppedChanges = dropped.filter((c) => FILE_B_CHANGES.includes(c)).sort()
      expect(cellsIn(record), `seed ${String(seed)}`).toEqual(droppedChanges)
      expect(cellDiff(cleanExport, faulty), `seed ${String(seed)}`).toEqual(droppedChanges)
    }
  })

  test('RT-14 a file of one row cannot be partly imported, so the fault refuses it', () => {
    const w = world()
    const one = importFile([[GIFI[0], { kind: 'amount', amount: 1 }]], ZERO_HEADER)
    expect(() => partialImport(w.sim, w.a, one, { seed: SEED })).toThrow()
  })
})

// ---------- 2: wrong client ----------

describe('RT-1 wrong client (check 2)', () => {
  for (const seed of SEEDS) {
    test(`RT-1 seed ${String(seed)}: the default form differs from the return's own export in the header GUID and the year end only`, () => {
      const own = exportA()
      const before = asText(own)
      const { bytes, record } = wrongClientExport(own, { seed })
      expect(asText(own)).toBe(before)

      const ownFile = parseOk(own)
      const wrong = parseOk(bytes)
      expect(wrong.header.returnName).toBe(ownFile.header.returnName)
      expect(wrong.header.guid).toMatch(GUID_RE)
      expect(wrong.header.guid.toLowerCase()).not.toBe(ownFile.header.guid.toLowerCase())

      const yearEnd = cellsOf(bytes).get(YEAR_END_CELL) ?? ''
      expect(yearEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${yearEnd}T00:00:00Z`).toISOString().slice(0, 10)).toBe(yearEnd)
      expect(yearEnd).not.toBe(cellsOf(own).get(YEAR_END_CELL))
      expect(cellsOf(bytes).get(BN_CELL) ?? '').toBe('')

      expect(cellDiff(own, bytes)).toEqual([YEAR_END_CELL])
      expectRecordOf(record, 'wrong-client')
      expect(hasHeader(record)).toBe(true)
      expect(cellsIn(record)).toEqual([YEAR_END_CELL])
      expect(linesWithout(bytes, [YEAR_END_CELL], true)).toEqual(linesWithout(own, [YEAR_END_CELL], true))
      expect(linesOf(bytes)[0]).toBe(linesOf(own)[0]?.replace(ownFile.header.guid, wrong.header.guid))
    })

    test(`RT-1 seed ${String(seed)}: the business-number form plants a business number where the export has none, and changes nothing else but the GUID`, () => {
      const own = exportA()
      expect(cellsOf(own).get(BN_CELL) ?? '').toBe('')
      const { bytes, record } = wrongClientExport(own, { seed, form: 'business-number' })
      const bn = cellsOf(bytes).get(BN_CELL) ?? ''
      expect(bn).toMatch(/^\d{9}RC\d{4}$/)
      expect(parseOk(bytes).header.guid).not.toBe(parseOk(own).header.guid)
      expect(cellDiff(own, bytes)).toEqual([BN_CELL])
      expectRecordOf(record, 'wrong-client')
      expect(hasHeader(record)).toBe(true)
      expect(cellsIn(record)).toEqual([BN_CELL])
      expect(linesWithout(bytes, [BN_CELL], true)).toEqual(linesWithout(own, [BN_CELL], true))
    })
  }

  test('RT-1 the business-number form changes a business number the export already holds', () => {
    const w = worldWithA()
    w.sim.typeCell(w.a, BN_CELL, '100000009RC0001')
    const own = w.sim.exportCsv(w.a, 'entered')
    const { bytes } = wrongClientExport(own, { seed: SEED, form: 'business-number' })
    const bn = cellsOf(bytes).get(BN_CELL) ?? ''
    expect(bn).toMatch(/^\d{9}RC\d{4}$/)
    expect(bn).not.toBe('100000009RC0001')
    expect(cellDiff(own, bytes)).toEqual([BN_CELL])
  })

  test("RT-1 the wrong-return import changes the other return, and its report says nothing about the file's header", () => {
    const forA = importFile(FILE_B_ROWS, { returnName: NAME_A, guid: GUID_A })

    const clean = worldWithA()
    mustImport(clean.sim, clean.b, FILE_A)
    const cleanBefore = clean.sim.exportCsv(clean.b, 'entered')
    const cleanReport = mustImport(clean.sim, clean.b, forA)
    const cleanAfter = clean.sim.exportCsv(clean.b, 'entered')

    const w = worldWithA()
    mustImport(w.sim, w.b, FILE_A)
    const aBefore = asText(w.sim.exportCsv(w.a, 'entered'))
    const bBefore = w.sim.exportCsv(w.b, 'entered')
    const { report, record } = wrongReturnImport(w.sim, w.b, forA, { seed: SEED })
    const bAfter = w.sim.exportCsv(w.b, 'entered')

    expect(asText(bBefore)).toBe(asText(cleanBefore))
    expect(report).toEqual(cleanReport)
    expect(asText(bAfter)).toBe(asText(cleanAfter))
    expect(cellDiff(bBefore, bAfter)).toEqual([...FILE_B_CHANGES])
    expect(asText(w.sim.exportCsv(w.a, 'entered'))).toBe(aBefore)
    expect(parseOk(bAfter).header).toEqual({ returnName: NAME_B, guid: GUID_B })

    const said = JSON.stringify(report)
    for (const word of [NAME_A, GUID_A, 'Café', 'GUID', 'header', 'return name']) {
      expect(said.toLowerCase(), `the report mentions ${word}`).not.toContain(word.toLowerCase())
    }
    expectRecordOf(record, 'wrong-client')
    expect(cellsIn(record)).toEqual([...FILE_B_CHANGES])
  })
})

// ---------- 3: stale export ----------

describe('RT-2 stale export (check 3)', () => {
  for (const filter of ['entered', 'all-input'] as const) {
    test(`RT-2 RT-1 (${filter}) the stale export equals the export taken before the latest import and differs from the current one in exactly the cells that import changed`, () => {
      const clean = worldWithA()
      const cleanBefore = clean.sim.exportCsv(clean.a, filter)
      const cleanReport = mustImport(clean.sim, clean.a, FILE_B)
      const cleanAfter = clean.sim.exportCsv(clean.a, filter)

      const w = worldWithA()
      const { stale, report, record } = staleExport(w.sim, w.a, FILE_B, { seed: SEED, filter })
      const current = w.sim.exportCsv(w.a, filter)

      expect(asText(stale)).toBe(asText(cleanBefore))
      expect(asText(current)).toBe(asText(cleanAfter))
      expect(report).toEqual(cleanReport)
      expect(cellDiff(stale, current)).toEqual([...FILE_B_CHANGES])
      expect(linesOf(stale)[0]).toBe(linesOf(current)[0])
      expectRecordOf(record, 'stale-export')
      expect(cellsIn(record)).toEqual([...FILE_B_CHANGES])
      expect(hasHeader(record)).toBe(false)
    })
  }

  test('RT-2 the default filter is "entered"', () => {
    const clean = worldWithA()
    const cleanBefore = clean.sim.exportCsv(clean.a, 'entered')
    const w = worldWithA()
    const { stale } = staleExport(w.sim, w.a, FILE_B, { seed: SEED })
    expect(asText(stale)).toBe(asText(cleanBefore))
  })
})

// ---------- 4: reordered copies ----------

function keysOf(bytes: Uint8Array): Map<string, number> {
  const r = copiesByNaturalKey(parseOk(bytes).rows, CCA)
  if (!r.ok) throw new Error(r.reason)
  return new Map(r.copies)
}

/** Natural key to the values of its copy, keyed by the cell under the copy (`FED.Ttw08cA5`). */
function valuesByKey(bytes: Uint8Array): Map<string, Map<string, string>> {
  const keys = keysOf(bytes)
  const byIndex = new Map([...keys].map(([k, i]) => [i, k]))
  const out = new Map<string, Map<string, string>>()
  for (const row of parseOk(bytes).rows) {
    if (row.id.copyPath !== CCA || row.id.copyIndex === null) continue
    const key = byIndex.get(row.id.copyIndex)
    if (key === undefined) throw new Error(`copy ${String(row.id.copyIndex)} has no natural key`)
    const under = row.id.text.slice(`${CCA}[${String(row.id.copyIndex)}].`.length)
    const m = out.get(key) ?? new Map<string, string>()
    m.set(under, row.current.kind === 'clear' ? '' : row.current.text)
    out.set(key, m)
  }
  return out
}

describe('RT-7 reordered copies (check 4)', () => {
  test('RT-7 the test world uses the natural key F03 registers for Schedule 8 (the class number)', () => {
    expect(NATURAL_KEYS[CCA]).toBe('FED.Ttw08cA1')
    expect([...keysOf(exportA())]).toEqual([
      ['8', 1],
      ['10', 2],
      ['50', 3],
    ])
  })

  for (const seed of SEEDS) {
    test(`RT-7 seed ${String(seed)}: the copies left are numbered 1 to n with no gap, keep their keys and values, and one key moves down`, () => {
      const own = exportA()
      const before = asText(own)
      const { bytes, record, deleted } = reorderedCopies(own, { seed })
      expect(asText(own)).toBe(before)

      const keysBefore = keysOf(own)
      const keysAfter = keysOf(bytes)
      expect(deleted.copyPath).toBe(CCA)
      expect(keysBefore.get(deleted.naturalKey)).toBe(deleted.index)
      expect(deleted.index).toBeLessThan(keysBefore.size)
      expect(keysAfter.has(deleted.naturalKey)).toBe(false)
      expect([...keysAfter.values()].sort((x, y) => x - y)).toEqual([1, 2])
      expect([...keysAfter.keys()].sort()).toEqual([...keysBefore.keys()].filter((k) => k !== deleted.naturalKey).sort())

      const indexes = parseOk(bytes)
        .rows.filter((r) => r.id.copyPath === CCA)
        .map((r) => r.id.copyIndex ?? 0)
      expect(Math.max(...indexes)).toBe(2)
      expect(new Set(indexes)).toEqual(new Set([1, 2]))

      const vBefore = valuesByKey(own)
      const vAfter = valuesByKey(bytes)
      for (const [key, values] of vAfter) expect(values, `class ${key}`).toEqual(vBefore.get(key))

      const moved = [...keysAfter].filter(([k, i]) => i < (keysBefore.get(k) ?? 0))
      expect(moved.length).toBeGreaterThanOrEqual(1)

      expectRecordOf(record, 'reordered-copies')
      expect(cellsIn(record)).toEqual(cellDiff(own, bytes))
      expect(cellsIn(record).length).toBeGreaterThan(0)
      expect(hasHeader(record)).toBe(false)
      const copyCells = cellsIn(record)
      expect(copyCells.every((c) => c.startsWith(`${CCA}[`))).toBe(true)
      expect(linesWithout(bytes, copyCells, false).filter((l) => !l.startsWith(`${CCA}[`))).toEqual(
        linesOf(own).filter((l) => !l.startsWith(`${CCA}[`)),
      )
    })
  }

  test('RT-7 across seeds, deleting the first copy moves both later copies down', () => {
    const own = exportA()
    const firsts = SEEDS.map((seed) => reorderedCopies(own, { seed, copyPath: CCA })).filter((r) => r.deleted.index === 1)
    for (const r of firsts) {
      expect([...keysOf(r.bytes)]).toEqual([
        ['10', 1],
        ['50', 2],
      ])
    }
  })

  test('RT-7 an export with fewer than two copies cannot be reordered, so the fault refuses it', () => {
    const w = world()
    mustImport(
      w.sim,
      w.a,
      importFile(
        [
          [CLASS_CELL(1), { kind: 'text', text: '8' }],
          [UCC_CELL(1), { kind: 'amount', amount: 100 }],
        ],
        ZERO_HEADER,
      ),
    )
    expect(() => reorderedCopies(w.sim.exportCsv(w.a, 'entered'), { seed: SEED })).toThrow()
  })
})

// ---------- 5: spreadsheet-mangled numbers ----------

const FILE_WIDE: readonly Mangling[] = ['bom', 'line-ends', 'separator', 'unquoted']

describe('RT-9 spreadsheet-mangled exports are refused by F03 with the reason for that mangling (check 5)', () => {
  const clean = exportA()
  test('RT-9 the export the manglings start from parses cleanly (no false alarm)', () => {
    expect(faultsOf(clean)).toEqual([])
  })

  for (const mangling of [
    'bom',
    'line-ends',
    'separator',
    'unquoted',
    'negative-parens',
    'thousands',
    'decimal-comma',
    'scientific',
    'date-format',
    'utf8',
  ] as const) {
    test(`RT-9 ${mangling}: the mangled export is refused with F03's "${mangling}" reason`, () => {
      const before = asText(clean)
      const { bytes, record } = mangleExport(clean, mangling, { seed: SEED })
      expect(asText(clean)).toBe(before)
      expect(asText(bytes)).not.toBe(before)

      const faults = faultsOf(bytes)
      expect(faults.length).toBeGreaterThan(0)
      expect(faults.map((f) => f.code)).toContain(mangling)
      for (const f of faults.filter((x) => x.code === mangling)) expect(f.reason.length).toBeGreaterThan(0)

      expectRecordOf(record, 'spreadsheet-mangled')
      expect(formats(record)).toEqual([mangling])

      if (FILE_WIDE.includes(mangling)) {
        expect(cellsIn(record)).toEqual([])
        expect(hasHeader(record)).toBe(false)
        return
      }
      // A value mangling touches only the lines its record names, and F03 refuses exactly those lines for that reason.
      const cells = cellsIn(record)
      expect(cells.length + (hasHeader(record) ? 1 : 0)).toBeGreaterThan(0)
      const was = linesOf(clean)
      const now = linesOf(bytes)
      expect(now.length).toBe(was.length)
      const touched = now.flatMap((line, i) => (line === was[i] ? [] : [i]))
      const named = touched.map((i) => (i === 0 ? '(header)' : lineId(now[i] ?? ''))).sort()
      expect(named).toEqual([...cells, ...(hasHeader(record) ? ['(header)'] : [])].sort())
      if (mangling !== 'utf8') {
        expect(faults.every((f) => f.code === mangling)).toBe(true)
        expect(faults.map((f) => f.line).sort()).toEqual(touched.map((i) => i + 1).sort())
      }
    })
  }

  test('RT-9 the file-wide manglings are what a re-save does: a byte-order mark added, CR LF turned into LF', () => {
    const bom = mangleExport(clean, 'bom', { seed: SEED }).bytes
    expect(Array.from(bom.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(asText(bom.slice(3))).toBe(asText(clean))
    const lf = mangleExport(clean, 'line-ends', { seed: SEED }).bytes
    expect(asText(lf)).toBe(asText(clean).replace(/\r\n/g, '\n'))
  })

  test('RT-9 the utf8 mangling writes é as C3 A9 and leaves every ASCII byte where it was', () => {
    const { bytes } = mangleExport(clean, 'utf8', { seed: SEED })
    expect(Buffer.from(bytes).toString('utf8')).toBe(Buffer.from(clean).toString('latin1'))
    expect(asText(bytes)).toContain('Caf\xc3\xa9')
  })
})

// ---------- 6: an edit outside the trace ----------

describe('RT-20 an edit outside the trace (check 6)', () => {
  for (const seed of SEEDS) {
    test(`RT-20 seed ${String(seed)}: the export differs from the last lock export in exactly one cell, with no import between`, () => {
      const w = worldWithA()
      w.sim.lock(w.a)
      const lockExport = w.sim.exportCsv(w.a, 'entered')
      const lockAll = w.sim.exportCsv(w.a, 'all-input')
      const eventsAtLock = w.sim.events(w.a).length

      const { record } = editOutsideTrace(w.sim, w.a, { seed })
      const after = w.sim.exportCsv(w.a, 'entered')
      const afterAll = w.sim.exportCsv(w.a, 'all-input')

      const diff = cellDiff(lockExport, after)
      expect(diff).toHaveLength(1)
      expect(cellDiff(lockAll, afterAll)).toEqual(diff)
      expect(linesOf(after)[0]).toBe(linesOf(lockExport)[0])
      expectRecordOf(record, 'edit-outside-trace')
      expect(cellsIn(record)).toEqual(diff)
      expect(hasHeader(record)).toBe(false)

      const since = w.sim.events(w.a).slice(eventsAtLock)
      expect(since.some((e) => e.source === 'import')).toBe(false)
      expect(since.length).toBeGreaterThanOrEqual(1)
      expect(since.every((e) => e.identifier === diff[0])).toBe(true)
      expect(since.every((e) => e.source === 'typed' || e.source === 'cleared')).toBe(true)
      expect(w.sim.isLocked(w.a)).toBe(true)
    })
  }

  test('RT-20 the fault needs a locked return: on an unlocked return it throws and changes nothing', () => {
    const w = worldWithA()
    const before = asText(w.sim.exportCsv(w.a, 'entered'))
    expect(() => editOutsideTrace(w.sim, w.a, { seed: SEED })).toThrow(/lock/i)
    expect(asText(w.sim.exportCsv(w.a, 'entered'))).toBe(before)
  })
})

// ---------- 8: determinism ----------

type Outcome = { bytes: string; record: FaultRecord }

/** Every fault, run once on a fresh test world with the given seed: its output bytes and its record. */
function runAll(seed: number): Record<string, Outcome> {
  const out: Record<string, Outcome> = {}
  {
    const w = world()
    const r = partialImport(w.sim, w.a, FILE_A, { seed })
    out['partial-import'] = { bytes: asText(w.sim.exportCsv(w.a, 'all-input')), record: r.record }
  }
  for (const form of ['year-end', 'business-number'] as const) {
    const r = wrongClientExport(exportA(), { seed, form })
    out[`wrong-client ${form}`] = { bytes: asText(r.bytes), record: r.record }
  }
  {
    const w = worldWithA()
    const r = wrongReturnImport(w.sim, w.b, importFile(FILE_B_ROWS, { returnName: NAME_A, guid: GUID_A }), { seed })
    out['wrong-return import'] = { bytes: asText(w.sim.exportCsv(w.b, 'all-input')), record: r.record }
  }
  {
    const r = reorderedCopies(exportA(), { seed })
    out['reordered-copies'] = { bytes: asText(r.bytes), record: r.record }
  }
  {
    const w = worldWithA()
    const r = staleExport(w.sim, w.a, FILE_B, { seed })
    out['stale-export'] = { bytes: asText(r.stale) + asText(w.sim.exportCsv(w.a, 'entered')), record: r.record }
  }
  for (const m of MANGLINGS) {
    const r = mangleExport(exportA(), m, { seed })
    out[`mangled ${m}`] = { bytes: asText(r.bytes), record: r.record }
  }
  {
    const w = worldWithA()
    w.sim.lock(w.a)
    const r = editOutsideTrace(w.sim, w.a, { seed })
    out['edit-outside-trace'] = { bytes: asText(w.sim.exportCsv(w.a, 'all-input')), record: r.record }
  }
  return out
}

describe('RT-23 determinism (check 8)', () => {
  test('RT-23 every fault run twice with the same seed gives the same bytes and the same record', () => {
    for (const seed of SEEDS) {
      const first = runAll(seed)
      const second = runAll(seed)
      expect(Object.keys(first)).toHaveLength(17)
      expect(second, `seed ${String(seed)}`).toEqual(first)
    }
  })

  test('RT-23 no fault reads Math.random or the system clock: the seed is the only source of choice', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('a fault read Math.random')
    })
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('a fault read Date.now')
    })
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('a fault read crypto.randomUUID')
    })
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('a fault read crypto.getRandomValues')
    })
    expect(Object.keys(runAll(SEED))).toHaveLength(17)
  })

  test('RT-23 property (fast-check, fixed seed): for any seed, every record names exactly what its fault changed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        // partial import: the dropped rows, against the whole import
        const clean = world()
        mustImport(clean.sim, clean.a, FILE_A)
        const w = world()
        const p = partialImport(w.sim, w.a, FILE_A, { seed })
        expect(cellsIn(p.record)).toEqual(cellDiff(clean.sim.exportCsv(clean.a, 'entered'), w.sim.exportCsv(w.a, 'entered')))
        expect(p.applied).toBeGreaterThanOrEqual(1)
        expect(p.applied).toBeLessThan(FILE_A_ROWS.length)

        // wrong client, both forms
        const own = exportA()
        for (const form of ['year-end', 'business-number'] as const) {
          const wc = wrongClientExport(own, { seed, form })
          expect(cellsIn(wc.record)).toEqual(cellDiff(own, wc.bytes))
          expect(cellsIn(wc.record)).toEqual([form === 'year-end' ? YEAR_END_CELL : BN_CELL])
          expect(hasHeader(wc.record)).toBe(true)
          expect(parseOk(wc.bytes).header.guid).not.toBe(GUID_A)
        }

        // reordered copies
        const rc = reorderedCopies(own, { seed })
        expect(cellsIn(rc.record)).toEqual(cellDiff(own, rc.bytes))
        expect([...keysOf(rc.bytes).values()].sort((x, y) => x - y)).toEqual([1, 2])

        // value manglings name exactly the lines they touch
        for (const m of MANGLINGS.filter((x) => !FILE_WIDE.includes(x))) {
          const mg = mangleExport(own, m, { seed })
          const was = linesOf(own)
          const named = linesOf(mg.bytes)
            .flatMap((line, i) => (line === was[i] ? [] : [i === 0 ? '(header)' : lineId(line)]))
            .sort()
          expect(named, m).toEqual([...cellsIn(mg.record), ...(hasHeader(mg.record) ? ['(header)'] : [])].sort())
          expect(faultsOf(mg.bytes).map((f) => f.code), m).toContain(m)
        }

        // edit outside the trace
        const e = worldWithA()
        e.sim.lock(e.a)
        const lockExport = e.sim.exportCsv(e.a, 'entered')
        const ed = editOutsideTrace(e.sim, e.a, { seed })
        const diff = cellDiff(lockExport, e.sim.exportCsv(e.a, 'entered'))
        expect(diff).toHaveLength(1)
        expect(cellsIn(ed.record)).toEqual(diff)
      }),
      { seed: SEED, numRuns: 40 },
    )
  })
})

// ---------- every fault leaves the clean side alone ----------

describe('RT-23 faults change only what their record says', () => {
  test('RT-23 the faults that take bytes never change the bytes they are given', () => {
    const own = exportA()
    const copy = Uint8Array.from(own)
    wrongClientExport(own, { seed: SEED })
    wrongClientExport(own, { seed: SEED, form: 'business-number' })
    reorderedCopies(own, { seed: SEED })
    for (const m of MANGLINGS) mangleExport(own, m, { seed: SEED })
    expect(Array.from(own)).toEqual(Array.from(copy))
    const file = Uint8Array.from(FILE_A)
    const w = world()
    partialImport(w.sim, w.a, file, { seed: SEED })
    expect(Array.from(file)).toEqual(Array.from(FILE_A))
  })

  test('RT-23 a fault on one return leaves the other return in the same simulator unchanged', () => {
    const w = worldWithA()
    mustImport(w.sim, w.b, FILE_A)
    const bBefore = asText(w.sim.exportCsv(w.b, 'all-input'))
    const bEvents = w.sim.events(w.b).length
    staleExport(w.sim, w.a, FILE_B, { seed: SEED })
    w.sim.lock(w.a)
    editOutsideTrace(w.sim, w.a, { seed: SEED })
    expect(asText(w.sim.exportCsv(w.b, 'all-input'))).toBe(bBefore)
    expect(w.sim.events(w.b)).toHaveLength(bEvents)
  })

  test('RT-23 a record change is one of the three kinds, and a format change appears only on a mangled export', () => {
    const all = runAll(SEED)
    for (const [name, { record }] of Object.entries(all)) {
      for (const c of record.changed) {
        expect(['header', 'cell', 'format'], name).toContain(c.kind)
        if (c.kind === 'format') expect(name.startsWith('mangled '), name).toBe(true)
      }
      expect(record.changed.length, name).toBeGreaterThan(0)
    }
    const kinds: FaultChange['kind'][] = ['header', 'cell', 'format']
    expect(kinds).toHaveLength(3)
  })
})

// keep the test world's helpers honest: the fixtures say what they claim
describe('RT-23 the test world (no false alarm)', () => {
  test('RT-23 FILE_B changes exactly the cells the fixtures say, on a clean simulator with no fault', () => {
    const w = worldWithA()
    const before = w.sim.exportCsv(w.a, 'entered')
    mustImport(w.sim, w.a, FILE_B)
    expect(cellDiff(before, w.sim.exportCsv(w.a, 'entered'))).toEqual([...FILE_B_CHANGES])
  })

  test('RT-23 the export of return A holds an accent, a negative with its apostrophe, a date and a number of four digits or more', () => {
    const text = asText(exportA())
    expect(text).toContain('Caf\xe9 Probe (Test)')
    expect(text).toContain('"\'-1299"')
    expect(text).toContain('"2025-12-31"')
    expect(text).toContain('"125000"')
    expect(fromText(text)).toEqual(exportA())
  })
})
