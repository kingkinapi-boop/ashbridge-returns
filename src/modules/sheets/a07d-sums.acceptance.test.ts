// A07D class D2 acceptance tests: nested SUM totals snap whatever order they sit in (reports/A07C-findings.md, "Acceptance
// tests for A07D", D2; RC2). Each test fails on A07C's landed head b80c251.
//
// Input domain (RC0: stated, then generated over). A trial-balance shape on one sheet: 1 to 4 groups of 1 to 6 cent amounts
// (mixed sign, magnitudes up to 1e10 dollars, plus a band up to 1e5), each group totalled by a SUM over its own line of
// cells; a grand total SUM over the line of subtotals; a check total SUM over the grand total's one cell. Layouts: terms
// down columns (subtotals in one row) or across rows (transposed: subtotals in one column); the subtotal line above or
// below the terms (left or right when transposed); the grand and check totals in any free row and column, above, below,
// left or right of what they sum. Every cached value is what Excel stores: the floating-point sum, in range order, of the
// cached doubles of its terms (so an outer total carries its inner totals' float noise).
//
// Spec choices (amber, see the A07D spec report):
//   S4. A SUM whose terms include other SUMs reads the exact cent total of its terms once those terms are snapped,
//       whatever row or column order the cells sit in. Its cached value is judged against what Excel summed: the cached
//       doubles of its terms. So the tolerance is the sum's own rounding bound plus, for each term that was itself
//       snapped, that term's own distance from its cached double; the half-cent cap is unchanged. (The findings fix list
//       says "the error bound is unchanged": without the inner terms' share no outer total over a noisy subtotal can
//       ever snap, so the spec reads "unchanged" as "the same rule, applied to what Excel actually summed".)
//   S5. A SUM in a reference cycle (itself, or through other SUMs) keeps its own cached text, the read never throws or
//       hangs, and SUMs outside the cycle still snap. A SUM over a cycle cell's unsnapped noisy text keeps its own text.
//   S6. The 20,000-row sheet reads, snapped, inside one test's 30 s budget (the suite's slow-test budget for a cold read).
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type Cell, type SheetResult } from '../../contracts/sheets'
import { SHEET, address, formulaCell, gridXlsx, letters, numberCell, parseAddress } from './__fixtures__/a07d'
import { createSheetsReader } from './index'

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, 'tb.xlsx')
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
function cellsByAddress(r: SheetResult): Map<string, Cell> {
  const sheet = r.sheets.find((s) => s.name === SHEET)
  return new Map((sheet?.cells ?? []).map((c) => [address(c.column.number, c.row), c]))
}
const textAt = (r: SheetResult, at: string): string | undefined => cellsByAddress(r).get(at)?.text

/** The cell text of a cent amount, as A07B writes one: the shortest text of the nearest double ("253914.88", "9000000.3"). */
const cellCents = (n: bigint): string => String(Number(n) / 100)
/** The cent amount n/100 as two-decimal text from exact integer arithmetic. */
function centsText(n: bigint): string {
  const a = n < 0n ? -n : n
  return `${n < 0n ? '-' : ''}${String(a / 100n)}.${String(a % 100n).padStart(2, '0')}`
}
const toCents = (x: number): bigint => BigInt(Math.round(x * 100))

/** The six terms of the A07B check's planted sum; their floating-point sum is 253914.87999999803. */
const PLANTED = [-7335624.99, 2860106.52, -2434451.58, 8522880.37, 4815622.56, -6174618]
const floatSum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

describe('A07D D2: a SUM over other SUMs snaps whatever order the cells sit in (EV-14, EV-6)', () => {
  test('EV-14 the findings case: A1 SUM(A2:A3) above A2 SUM(B1:B6) over the planted six terms snaps both', async () => {
    const cells = new Map<string, string>()
    PLANTED.forEach((x, i) => cells.set(`B${String(i + 1)}`, numberCell(x)))
    const inner = floatSum(PLANTED)
    expect(String(inner)).toBe('253914.87999999803')
    cells.set('A2', formulaCell('SUM(B1:B6)', inner))
    cells.set('A3', numberCell(1000.1))
    const outer = inner + 1000.1
    cells.set('A1', formulaCell('SUM(A2:A3)', outer))
    // The outer cache carries the inner noise: far from its cent total, so only a snap can read it as "254914.98".
    expect(String(outer)).not.toBe('254914.98')
    const r = await readBytes(gridXlsx(cells))
    expect(cellsByAddress(r).get('A2')).toMatchObject({ formula: 'SUM(B1:B6)', text: '253914.88', cached: { type: 'number', text: '253914.88' } })
    expect(cellsByAddress(r).get('A1')).toMatchObject({ formula: 'SUM(A2:A3)', text: '254914.98', cached: { type: 'number', text: '254914.98' } })
    const at = { fileFingerprint: r.fileFingerprint, sheet: SHEET, row: 1, column: 'A' }
    expect(cellValueMatches(r, at, '$254,914.98')).toEqual({ ok: true })
    expect(cellValueMatches(r, at, '254914.97')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })

  test('EV-14 the same pair with the outer total left of the inner one in its row (A1 SUM(B1:C1), B1 SUM(B2:B7)) snaps both', async () => {
    const cells = new Map<string, string>()
    PLANTED.forEach((x, i) => cells.set(`B${String(i + 2)}`, numberCell(x)))
    const inner = floatSum(PLANTED)
    cells.set('B1', formulaCell('SUM(B2:B7)', inner))
    cells.set('C1', numberCell(1000.1))
    cells.set('A1', formulaCell('SUM(B1:C1)', inner + 1000.1))
    const r = await readBytes(gridXlsx(cells))
    expect(textAt(r, 'B1')).toBe('253914.88')
    expect(textAt(r, 'A1')).toBe('254914.98')
  })

  test('EV-14 a 5-deep chain in reverse row order snaps every level; a cycle beside it keeps its own text and the read does not throw', async () => {
    const cells = new Map<string, string>()
    // A5 sums the planted terms in C1:C6; each row above sums the row below it (A and B), so every outer total sits above its inner one.
    PLANTED.forEach((x, i) => cells.set(`C${String(i + 1)}`, numberCell(x)))
    const sides = new Map([
      [5, 0.7],
      [4, -1234.56],
      [3, 0.1],
      [2, 99.99],
    ])
    let cached = floatSum(PLANTED)
    let exact = PLANTED.reduce((a, x) => a + toCents(x), 0n)
    const expected = new Map<string, string>([['A5', cellCents(exact)]])
    cells.set('A5', formulaCell('SUM(C1:C6)', cached))
    for (let row = 4; row >= 1; row--) {
      const side = sides.get(row + 1) as number
      cells.set(`B${String(row + 1)}`, numberCell(side))
      cached = cached + side
      exact += toCents(side)
      cells.set(`A${String(row)}`, formulaCell(`SUM(A${String(row + 1)}:B${String(row + 1)})`, cached))
      expected.set(`A${String(row)}`, cellCents(exact))
    }
    // A two-cell cycle (E1 and F1), a self-including SUM (G1) and a SUM over a cycle cell (H1): all cached with planted noise.
    const noisy = floatSum(PLANTED)
    cells.set('E1', formulaCell('SUM(F1:F1)', noisy))
    cells.set('F1', formulaCell('SUM(E1:E1)', noisy))
    cells.set('G1', formulaCell('SUM(G1:G2)', noisy))
    cells.set('G2', numberCell(0))
    cells.set('H1', formulaCell('SUM(E1:E1)', noisy))
    const r = await readBytes(gridXlsx(cells))
    const got = cellsByAddress(r)
    for (const [at, text] of expected) expect({ at, text: got.get(at)?.text, cached: got.get(at)?.cached }).toEqual({ at, text, cached: { type: 'number', text } })
    for (const at of ['E1', 'F1', 'G1', 'H1']) expect({ at, text: got.get(at)?.text }).toEqual({ at, text: '253914.87999999803' })
  })
})

// ---------------------------------------------------------------------------------------------------------- D2 property

type Layout = {
  groups: number[][]
  transposed: boolean
  subtotalsFirst: boolean
  grand: { line: number; side: 'before' | 'after' }
  check: { line: number; side: 'before' | 'after' }
}

/** Whole cents: mostly up to 1e10 dollars, some up to 1e5 (the trial-balance band). */
const cents = fc.oneof(fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }), fc.integer({ min: -10_000_000, max: 10_000_000 }))
const layout: fc.Arbitrary<Layout> = fc.record({
  groups: fc.array(fc.array(cents, { minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 4 }),
  transposed: fc.boolean(),
  subtotalsFirst: fc.boolean(),
  grand: fc.record({ line: fc.nat({ max: 7 }), side: fc.constantFrom('before' as const, 'after' as const) }),
  check: fc.record({ line: fc.nat({ max: 7 }), side: fc.constantFrom('before' as const, 'after' as const) }),
})

/**
 * Builds the sheet for a layout in "down" coordinates (line = row, lane = column), transposed on request. Lanes 1 and 2 are
 * left free for totals placed before; groups take lanes 3 onward; totals placed after take the two lanes past the groups.
 */
function build(l: Layout): { cells: Map<string, string>; expected: Map<string, string> } {
  const at = (lane: number, line: number): string => (l.transposed ? address(line, lane) : address(lane, line))
  const tallest = Math.max(...l.groups.map((g) => g.length))
  const termStart = l.subtotalsFirst ? 2 : 1
  const subtotalLine = l.subtotalsFirst ? 1 : tallest + 1
  const cells = new Map<string, string>()
  const expected = new Map<string, string>()
  const subtotalCached: number[] = []
  let grandExact = 0n
  l.groups.forEach((group, g) => {
    const lane = 3 + g
    group.forEach((n, i) => cells.set(at(lane, termStart + i), numberCell(n / 100)))
    const cached = floatSum(group.map((n) => n / 100))
    const exact = group.reduce((a, n) => a + BigInt(n), 0n)
    cells.set(at(lane, subtotalLine), formulaCell(`SUM(${at(lane, termStart)}:${at(lane, termStart + group.length - 1)})`, cached))
    expected.set(at(lane, subtotalLine), cellCents(exact))
    subtotalCached.push(cached)
    grandExact += exact
  })
  const lastLane = 2 + l.groups.length
  const grandAt = at(l.grand.side === 'before' ? 1 : lastLane + 1, 1 + l.grand.line)
  const grandCached = floatSum(subtotalCached)
  cells.set(grandAt, formulaCell(`SUM(${at(3, subtotalLine)}:${at(lastLane, subtotalLine)})`, grandCached))
  expected.set(grandAt, cellCents(grandExact))
  const checkAt = at(l.check.side === 'before' ? 2 : lastLane + 2, 1 + l.check.line)
  cells.set(checkAt, formulaCell(`SUM(${grandAt}:${grandAt})`, grandCached))
  expected.set(checkAt, cellCents(grandExact))
  return { cells, expected }
}

describe('A07D D2 property: nested totals read the same whatever the layout (EV-14)', () => {
  test(
    'EV-14 property (seed 20261012): subtotals, a grand total and a check total over them read the exact cent totals in every layout, so every layout gives the same texts',
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(layout, async (l) => {
          const { cells, expected } = build(l)
          const r = await readBytes(gridXlsx(cells))
          const got = cellsByAddress(r)
          const read = [...expected.keys()].map((a) => [a, got.get(a)?.text])
          expect(read, JSON.stringify(l)).toEqual([...expected.entries()])
          // The grand total cites as its exact cent total; a cent off differs.
          const grand = [...expected.entries()].at(-2) as [string, string]
          const [column, row] = parseAddress(grand[0])
          const pointer = { fileFingerprint: r.fileFingerprint, sheet: SHEET, row, column: letters(column) }
          const exact = toCents(Number(grand[1]))
          expect(cellValueMatches(r, pointer, centsText(exact)), JSON.stringify(l)).toEqual({ ok: true })
          expect(cellValueMatches(r, pointer, centsText(exact + 1n)), JSON.stringify(l)).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
        }),
        { seed: 20261012, numRuns: 120 },
      )
    },
  )
})

// --------------------------------------------------------------------------------------------------------- D2 time budget

/** A fixed-seed stream of whole cents up to 1e6 (10,000 dollars), mixed sign. */
function centStream(seed: number, count: number): number[] {
  let state = seed
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0
    out.push((state % 2_000_001) - 1_000_000)
  }
  return out
}

describe('A07D D2: a 20,000-row sheet reads inside the time budget (EV-14)', () => {
  test(
    'EV-14 a 20,000-row running total (each SUM above the SUM it adds to) and one 19,999-term SUM above it all read snapped within 30 s',
    { timeout: 30_000 },
    async () => {
      const ROWS = 20_000
      const terms = centStream(20261013, ROWS)
      const cells = new Map<string, string>()
      // D2..D20000 are terms; C20000 is a term too; C(r) = SUM(C(r+1):D(r+1)) for r = 19999 down to 1; E1 = SUM(D2:D20000).
      const cached: number[] = new Array<number>(ROWS + 1).fill(0)
      const exact: bigint[] = new Array<bigint>(ROWS + 1).fill(0n)
      cells.set(`C${String(ROWS)}`, numberCell((terms[0] as number) / 100))
      cached[ROWS] = (terms[0] as number) / 100
      exact[ROWS] = BigInt(terms[0] as number)
      for (let r = ROWS - 1; r >= 1; r--) {
        const d = terms[r] as number
        cells.set(`D${String(r + 1)}`, numberCell(d / 100))
        cached[r] = (cached[r + 1] as number) + d / 100
        exact[r] = (exact[r + 1] as bigint) + BigInt(d)
        cells.set(`C${String(r)}`, formulaCell(`SUM(C${String(r + 1)}:D${String(r + 1)})`, cached[r] as number))
      }
      let big = 0
      let bigExact = 0n
      for (let r = 2; r <= ROWS; r++) {
        big += (terms[r - 1] as number) / 100
        bigExact += BigInt(terms[r - 1] as number)
      }
      cells.set('E1', formulaCell(`SUM(D2:D${String(ROWS)})`, big))
      const bytes = gridXlsx(cells)
      const started = performance.now()
      const r = await readBytes(bytes)
      const seconds = (performance.now() - started) / 1000
      const got = cellsByAddress(r)
      const wrong: string[] = []
      for (let row = 1; row < ROWS; row++) {
        const want = cellCents(exact[row] as bigint)
        const text = got.get(`C${String(row)}`)?.text
        if (text !== want) wrong.push(`C${String(row)} read ${String(text)}, expected ${want}`)
      }
      expect({ wrongCount: wrong.length, first: wrong.slice(0, 3) }).toEqual({ wrongCount: 0, first: [] })
      expect(got.get('E1')?.text).toBe(cellCents(bigExact))
      expect(seconds).toBeLessThan(30)
    },
  )
})
