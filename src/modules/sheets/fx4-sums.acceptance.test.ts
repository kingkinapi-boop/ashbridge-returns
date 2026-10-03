// FX4 acceptance tests, A07D Opus read items 1 and 2 (reports/A07D-opus-read.md; card plan/cards/FX4.md; spec review
// reports/FX4-spec-review.md): SUM totals at 16 or more significant digits, and every member of a reference cycle.
//
// Public API this file needs from src/modules/sheets/xlsx/index.ts (Lead directive A434):
//   centText(cents: bigint): string | undefined
//     The text a snapped total writes for an exact cent total: the shortest text of the total's double when it reads
//     back as exactly those cents ("46897341536252.6"), else undefined (the total keeps its own text).
//   snapSums(cells: Cell[], limit?: number): { visits: number; skipped: { row: number; column: number; reason: 'reference cycle' | 'over the work limit' }[] }
//     Snaps one sheet's SUM cells in place (cells in sheet order, as the reader lists them) and says what it did:
//     `visits` counts every cell a range walk reads (cycle search and totals alike); `skipped` lists each SUM cell left
//     with its own text for a reason, and why. A cached total that disagrees with its terms is not "skipped".
//
// Spec choices (amber, see reports/FX4-spec.md):
//   F1. "Unsnapped" means the cell keeps its own text: numberText of its cached double, as every non-SUM number reads.
//       Through the reader item 1 cannot be seen (its two reader tests are guards that pass on main), so centText is
//       pinned directly: 7053684657509001n has no text, and every cent total below 1e15 cents has one.
//   F2. A cycle member is any formula cell in a strongly connected component of two or more cells, or one that refers to
//       itself, counting every reference of every formula: ranges inside other functions, `$` parts, references through
//       IF, ROUND and AVERAGE, and references qualified with a sheet name (to that sheet). Every member keeps its own text.
//   F9. A SUM over cells that read as exact cents (numbers, formulas whose cached double prints as a cent amount, and SUMs
//       that themselves must snap) snaps to the exact total, cycles or not elsewhere on the sheet; others read their exact
//       total or their own text.
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type Cell, type SheetResult } from '../../contracts/sheets'
import { address } from './__fixtures__/a07d'
import {
  CELLS_SHEET,
  PLANTED,
  acyclicSheet,
  cycleMembers,
  exactText,
  floatSum,
  formulaBody,
  graphSheet,
  inSheetOrder,
  isCentText,
  memAt,
  memFormula,
  memNumber,
  numberBody,
  sheetsXlsx,
  sparseXlsx,
  textCents,
  type GraphNode,
  type RangeShape,
  type RefShape,
} from './__fixtures__/fx4'
import { createSheetsReader } from './index'
import * as xlsx from './xlsx/index'
import { numberText } from './xlsx/index'

type Skipped = { row: number; column: number; reason: 'reference cycle' | 'over the work limit' }
type SnapSums = (cells: Cell[], limit?: number) => { visits: number; skipped: Skipped[] }
type CentText = (cents: bigint) => string | undefined
const api = xlsx as unknown as { snapSums?: SnapSums; centText?: CentText }
function snapSums(cells: Cell[], limit?: number): { visits: number; skipped: Skipped[] } {
  if (typeof api.snapSums !== 'function') throw new Error('src/modules/sheets/xlsx/index.ts does not export snapSums')
  return limit === undefined ? api.snapSums(cells) : api.snapSums(cells, limit)
}
function centText(cents: bigint): string | undefined {
  if (typeof api.centText !== 'function') throw new Error('src/modules/sheets/xlsx/index.ts does not export centText')
  return api.centText(cents)
}
const sortSkipped = (s: Skipped[]): Skipped[] => [...s].sort((a, b) => a.row - b.row || a.column - b.column)

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-03T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, 'fx4 (Test).xlsx')
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
function textsOf(r: SheetResult, sheet = CELLS_SHEET): Map<string, string> {
  const found = r.sheets.find((s) => s.name === sheet)
  return new Map((found?.cells ?? []).map((c: Cell) => [address(c.column.number, c.row), c.text]))
}

/** Whole cents drawn log-uniformly: a decade from `lo` to `hi` (10^lo up to 10^(hi+1)), then a value inside it, either sign. */
const decadeCents = (lo: number, hi: number): fc.Arbitrary<bigint> =>
  fc
    .tuple(fc.integer({ min: lo, max: hi }), fc.boolean())
    .chain(([k, negative]) => fc.bigInt({ min: k === 0 ? 0n : 10n ** BigInt(k), max: 10n ** BigInt(k + 1) - 1n }).map((c) => (negative ? -c : c)))

// ------------------------------------------------------------------------------------------------ item 1: 16+ digits

/** The two totals the Opus read gives: [big term, small term] in cents. */
const OPUS_PAIRS: [bigint, bigint][] = [
  [4689734153581555n, 43705n],
  [7053684657411262n, 97739n],
]
const centsTextOf = (c: bigint): string => {
  const a = c < 0n ? -c : c
  return `${c < 0n ? '-' : ''}${String(a / 100n)}.${String(a % 100n).padStart(2, '0')}`
}

/** A1 and A2 hold the terms as Excel stores them, A3 = SUM(A1:A2) caches their floating-point sum. */
async function readPair(big: bigint, small: bigint): Promise<{ texts: Map<string, string>; cached: number; r: SheetResult }> {
  const x = Number(centsTextOf(big))
  const y = Number(centsTextOf(small))
  const cached = x + y
  const r = await readBytes(
    sparseXlsx(
      new Map([
        ['A1', numberBody(x)],
        ['A2', numberBody(y)],
        ['A3', formulaBody('SUM(A1:A2)', cached)],
      ]),
    ),
  )
  return { texts: textsOf(r), cached, r }
}
/** What A3 may read: the exact cent total of the terms as read, or its own text (unsnapped). */
function allowed(texts: Map<string, string>, cached: number): { exact: string | undefined; own: string } {
  const terms = [texts.get('A1'), texts.get('A2')]
  const exact = terms.every(isCentText) ? exactText(terms.reduce((s, t) => s + textCents(t as string), 0n)) : undefined
  return { exact, own: numberText(cached) }
}

describe('FX4 item 1: a SUM total at 16 or more significant digits reads its exact cents or its own text (EV-14, EV-6)', () => {
  test('EV-14 EV-6 the Opus read totals (46897341535815.55 + 437.05, 70536846574112.62 + 977.39) read the exact cent total or their own text, never another cent', async () => {
    for (const [big, small] of OPUS_PAIRS) {
      const { texts, cached, r } = await readPair(big, small)
      const { exact, own } = allowed(texts, cached)
      const total = texts.get('A3')
      expect([exact, own], `${centsTextOf(big)} + ${centsTextOf(small)} read ${String(total)}`).toContain(total)
      // Whichever it reads, a citation of that text matches and the cell never claims a cent it does not hold.
      const at = { fileFingerprint: r.fileFingerprint, sheet: CELLS_SHEET, row: 3, column: 'A' }
      expect(cellValueMatches(r, at, total as string)).toEqual({ ok: true })
    }
  })

  test('EV-14 EV-6 property (seed 20261031): over cent totals from 1e12 to 1e17 cents (log-uniform), a snapped SUM maps back to the exact cents of its terms, else it keeps its own text', { timeout: 120_000 }, async () => {
    const small = fc.bigInt({ min: -(10n ** 7n), max: 10n ** 7n })
    await fc.assert(
      fc.asyncProperty(decadeCents(12, 16), small, async (b, s) => {
        const { texts, cached } = await readPair(b, s)
        const { exact, own } = allowed(texts, cached)
        const total = texts.get('A3')
        if (total !== own) expect(total, `${centsTextOf(b)} + ${centsTextOf(s)}: snapped, so it must be the exact cents`).toBe(exact)
      }),
      { seed: 20261031, numRuns: 150 },
    )
  })

  test('EV-14 EV-6 centText: 7053684657509001 cents (the Opus read total 70536846575090.01) has no text; String(Number(c)/100) would print .02', () => {
    expect(String(Number(7053684657509001n) / 100)).toBe('70536846575090.02')
    expect(centText(7053684657509001n)).toBeUndefined()
    expect(centText(-7053684657509001n)).toBeUndefined()
  })

  test('EV-14 EV-6 centText: a total whose shortest text is its exact cents gets that text, trailing zeros dropped', () => {
    expect(centText(4689734153625260n)).toBe('46897341536252.6')
    expect(centText(25391488n)).toBe('253914.88')
    expect(centText(-1250n)).toBe('-12.5')
    expect(centText(100n)).toBe('1')
    expect(centText(7n)).toBe('0.07')
    expect(centText(0n)).toBe('0')
  })

  test('EV-14 EV-6 property (seed 20261040): centText gives the exact cent text or nothing, from 0 to 1e17 cents (log-uniform), and always a text below 1e15 cents', () => {
    fc.assert(
      fc.property(decadeCents(0, 16), (c) => {
        const text = centText(c)
        if (text !== undefined) expect(text, String(c)).toBe(exactText(c))
        const magnitude = c < 0n ? -c : c
        if (magnitude < 10n ** 15n) expect(text, `${String(c)} is below 1e15 cents, so it has a text`).toBe(exactText(c))
      }),
      { seed: 20261040, numRuns: 2_000 },
    )
  })
})

// ---------------------------------------------------------------------------------------------- item 2: cycle members

/** Reads a graph's sheet; gives each node's text by row. */
async function readGraph(nodes: GraphNode[]): Promise<{ texts: Map<string, string>; cached: number[] }> {
  const { cells, cached } = graphSheet(nodes)
  const r = await readBytes(sparseXlsx(cells))
  return { texts: textsOf(r), cached }
}
const sum = (lo: number, hi: number, withTerms = false, abs = false): GraphNode => ({ kind: 'sum', lo, hi, withTerms, abs })
const ref = (target: number, shape: RefShape = 'mul'): GraphNode => ({ kind: 'ref', target, shape })
const range = (lo: number, hi: number, shape: RangeShape): GraphNode => ({ kind: 'range', lo, hi, shape })
const NOISY = String(floatSum(PLANTED))
const REF_SHAPES: RefShape[] = ['mul', 'abs', 'if', 'round', 'sheet']
const RANGE_SHAPES: RangeShape[] = ['average', 'sum-and-zero']

describe('FX4 item 2: every member of a reference cycle keeps its own text (EV-14, EV-5)', () => {
  test('EV-14 the Opus read cycle joined through a finished node: A1 SUM(A2:A3), A2 SUM(A1:A1), A3 SUM over A2 and the planted terms keeps its own text', async () => {
    // The report's A3 = SUM(A2:A2), widened over the planted terms in B2:G2 so a snap of the missed member would show.
    const cells = new Map<string, string>([
      ['A1', formulaBody('SUM(A2:A3)', 0)],
      ['A2', formulaBody('SUM(A1:A1)', 0)],
      ['A3', formulaBody('SUM(A2:G2)', floatSum([0, ...PLANTED]))],
    ])
    PLANTED.forEach((x, i) => cells.set(address(2 + i, 2), numberBody(x)))
    const texts = textsOf(await readBytes(sparseXlsx(cells)))
    expect({ A1: texts.get('A1'), A2: texts.get('A2'), A3: texts.get('A3') }).toEqual({ A1: '0', A2: '0', A3: NOISY })
    // The terms themselves read as stored.
    expect(PLANTED.map((_, i) => texts.get(address(2 + i, 2)))).toEqual(PLANTED.map((x) => String(x)))
  })

  test('EV-14 the Opus read cycle through a formula that is not a SUM: A1 SUM over A2 and the planted terms, A2 = A1*1, keeps its own text', async () => {
    const cells = new Map<string, string>([
      ['A1', formulaBody('SUM(A2:G2)', floatSum([0, ...PLANTED]))],
      ['A2', formulaBody('A1*1', 0)],
    ])
    PLANTED.forEach((x, i) => cells.set(address(2 + i, 2), numberBody(x)))
    const texts = textsOf(await readBytes(sparseXlsx(cells)))
    expect({ A1: texts.get('A1'), A2: texts.get('A2') }).toEqual({ A1: NOISY, A2: '0' })
  })

  test('EV-14 a SUM outside any cycle beside them still snaps (the fix leaves no cycle-free total unsnapped)', async () => {
    const cells = new Map<string, string>([
      ['A1', formulaBody('SUM(A2:G2)', floatSum([0, ...PLANTED]))],
      ['A2', formulaBody('A1*1', 0)],
      ['A4', formulaBody('SUM(B4:G4)', floatSum(PLANTED))],
    ])
    PLANTED.forEach((x, i) => {
      cells.set(address(2 + i, 2), numberBody(x))
      cells.set(address(2 + i, 4), numberBody(x))
    })
    const texts = textsOf(await readBytes(sparseXlsx(cells)))
    expect({ A1: texts.get('A1'), A4: texts.get('A4') }).toEqual({ A1: NOISY, A4: '253914.88' })
  })

  /** A1 = SUM(A2:G2) over the planted terms in B2:G2 and A2 = Other!A1*1; the second sheet "Other" holds `other` at A1. */
  async function readCrossSheet(other: string): Promise<{ cells: Map<string, string>; others: Map<string, string> }> {
    const a2 = other.startsWith('><f>') ? 0 : 5
    const main = new Map<string, string>([
      ['A1', formulaBody('SUM(A2:G2)', floatSum([a2, ...PLANTED]))],
      ['A2', formulaBody('Other!A1*1', a2)],
    ])
    PLANTED.forEach((x, i) => main.set(address(2 + i, 2), numberBody(x)))
    const r = await readBytes(
      sheetsXlsx([
        { name: CELLS_SHEET, cells: main },
        { name: 'Other', cells: new Map([['A1', other]]) },
      ]),
    )
    return { cells: textsOf(r), others: textsOf(r, 'Other') }
  }

  test("EV-14 EV-5 a cycle across two sheets (A1 SUM(A2:G2), A2 = Other!A1*1, Other!A1 = 'Cells (Test)'!A1*1) leaves A1 with its own text", async () => {
    const { cells, others } = await readCrossSheet(formulaBody(`'${CELLS_SHEET}'!A1*1`, 0))
    expect({ A1: cells.get('A1'), A2: cells.get('A2'), 'Other!A1': others.get('A1') }).toEqual({ A1: NOISY, A2: '0', 'Other!A1': '0' })
  })

  test('EV-14 EV-5 the same two sheets with no cycle (Other!A1 holds 5) snap A1 to 253919.88: Other!A1 is not this sheet\'s A1', async () => {
    const { cells, others } = await readCrossSheet(numberBody(5))
    expect({ A1: cells.get('A1'), A2: cells.get('A2'), 'Other!A1': others.get('A1') }).toEqual({ A1: '253919.88', A2: '5', 'Other!A1': '5' })
  })

  const node: fc.Arbitrary<(n: number) => GraphNode> = fc.oneof(
    {
      weight: 4,
      arbitrary: fc.tuple(fc.nat(), fc.nat(), fc.boolean(), fc.boolean()).map(([a, b, t, abs]) => (n: number) => sum(Math.min(a % n, b % n) + 1, Math.max(a % n, b % n) + 1, t, abs)),
    },
    { weight: 3, arbitrary: fc.tuple(fc.nat(), fc.constantFrom(...REF_SHAPES)).map(([a, shape]) => (n: number) => ref((a % n) + 1, shape)) },
    {
      weight: 1,
      arbitrary: fc.tuple(fc.nat(), fc.nat(), fc.constantFrom(...RANGE_SHAPES)).map(([a, b, shape]) => (n: number) => range(Math.min(a % n, b % n) + 1, Math.max(a % n, b % n) + 1, shape)),
    },
  )
  const graph: fc.Arbitrary<GraphNode[]> = fc
    .tuple(fc.integer({ min: 2, max: 6 }), fc.array(node, { minLength: 6, maxLength: 6 }))
    .map(([n, makers]) => makers.slice(0, n).map((make) => make(n)))

  test("EV-14 EV-5 property (seed 20261032): in random formula graphs with cycles (through SUMs, $ parts, IF, ROUND, AVERAGE, SUM(range,0) and 'Cells (Test)'! references), every member of every strongly connected component keeps its own text", { timeout: 120_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(graph, async (nodes) => {
        const members = cycleMembers(nodes)
        const { texts, cached } = await readGraph(nodes)
        const wrong = [...members]
          .filter((row) => texts.get(`A${String(row)}`) !== numberText(cached[row - 1] as number))
          .map((row) => `A${String(row)} read ${String(texts.get(`A${String(row)}`))}, own ${numberText(cached[row - 1] as number)}`)
        expect(wrong, JSON.stringify(nodes)).toEqual([])
      }),
      { seed: 20261032, numRuns: 300 },
    )
  })

  /** Node i (1-based) of an acyclic graph of n nodes refers only to rows i+1 to n+2 (rows n+1 and n+2 hold numbers). */
  const acyclicNode: fc.Arbitrary<(i: number, n: number) => GraphNode> = fc.oneof(
    {
      weight: 4,
      arbitrary: fc.tuple(fc.nat(), fc.nat(), fc.boolean(), fc.boolean()).map(([a, b, t, abs]) => (i: number, n: number) => {
        const span = n + 2 - i
        return sum(i + 1 + Math.min(a % span, b % span), i + 1 + Math.max(a % span, b % span), t, abs)
      }),
    },
    { weight: 2, arbitrary: fc.tuple(fc.nat(), fc.constantFrom(...REF_SHAPES)).map(([a, shape]) => (i: number, n: number) => ref(i + 1 + (a % (n + 2 - i)), shape)) },
    {
      weight: 1,
      arbitrary: fc.tuple(fc.nat(), fc.nat(), fc.constantFrom(...RANGE_SHAPES)).map(([a, b, shape]) => (i: number, n: number) => {
        const span = n + 2 - i
        return range(i + 1 + Math.min(a % span, b % span), i + 1 + Math.max(a % span, b % span), shape)
      }),
    },
  )
  const acyclic: fc.Arbitrary<GraphNode[]> = fc
    .tuple(fc.integer({ min: 2, max: 6 }), fc.array(acyclicNode, { minLength: 6, maxLength: 6 }))
    .map(([n, makers]) => makers.slice(0, n).map((make, k) => make(k + 1, n)))

  test('EV-14 EV-5 property (seed 20261039): in random formula graphs with no cycle and Excel-true cached values, a SUM over cells that read as exact cents snaps to their exact total, any other SUM reads its exact total or its own text, and no other formula changes', { timeout: 120_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(acyclic, async (nodes) => {
        const n = nodes.length
        const { cells, cached } = acyclicSheet(nodes)
        const texts = textsOf(await readBytes(sparseXlsx(cells)))
        const must = new Map<number, boolean>()
        // Bottom-up: a SUM must snap when every cell in its range reads as exact cents of its own double, or is a SUM that must snap.
        for (let row = n; row >= 1; row--) {
          const node = nodes[row - 1] as GraphNode
          if (node.kind !== 'sum') continue
          let ok = true
          for (let r = node.lo; r <= node.hi; r++) {
            if (r > n) continue
            const inner = nodes[r - 1] as GraphNode
            if (inner.kind === 'sum') ok &&= must.get(r) === true
            else ok &&= isCentText(String(cached[r - 1]))
          }
          must.set(row, ok)
        }
        const wrong: string[] = []
        nodes.forEach((node, k) => {
          const row = k + 1
          const text = texts.get(`A${String(row)}`)
          const own = numberText(cached[k] as number)
          if (node.kind !== 'sum') {
            if (text !== own) wrong.push(`A${String(row)} (${node.kind}) read ${String(text)}, own ${own}`)
            return
          }
          const terms: (string | undefined)[] = []
          for (let r = node.lo; r <= node.hi; r++) for (let c = 1; c <= (node.withTerms ? 7 : 1); c++) terms.push(texts.get(address(c, r)))
          const exact = terms.every(isCentText) ? exactText(terms.reduce((s, t) => s + textCents(t as string), 0n)) : undefined
          if (must.get(row) === true) {
            if (text !== exact) wrong.push(`A${String(row)} must snap: read ${String(text)}, exact ${String(exact)}`)
          } else if (text !== own && text !== exact) wrong.push(`A${String(row)} read ${String(text)}, own ${own}, exact ${String(exact)}`)
        })
        expect(wrong, JSON.stringify(nodes)).toEqual([])
      }),
      { seed: 20261039, numRuns: 200 },
    )
  })

  test('EV-14 a 50,000-cell ring through formulas that are not SUMs (A1 SUM(A2:G2), A<r> = A<r+1>*1, A50000 = A1*1) reads without a stack overflow, and A1 keeps its own text', { timeout: 120_000 }, async () => {
    const RING = 50_000
    const cells = new Map<string, string>([['A1', formulaBody('SUM(A2:G2)', floatSum([0, ...PLANTED]))]])
    PLANTED.forEach((x, i) => cells.set(address(2 + i, 2), numberBody(x)))
    for (let r = 2; r < RING; r++) cells.set(`A${String(r)}`, formulaBody(`A${String(r + 1)}*1`, 0))
    cells.set(`A${String(RING)}`, formulaBody('A1*1', 0))
    const texts = textsOf(await readBytes(sparseXlsx(cells)))
    expect({ A1: texts.get('A1'), A2: texts.get('A2'), A50000: texts.get('A50000') }).toEqual({ A1: NOISY, A2: '0', A50000: '0' })
  })
})

describe('FX4 item 2 through snapSums: cycle members are skipped with the reason "reference cycle" (EV-14, EV-5)', () => {
  const own = numberText(floatSum([0, ...PLANTED]))
  const planted = (row: number): Cell[] => PLANTED.map((x, i) => memNumber(address(2 + i, row), String(x)))

  test('EV-14 the cycle joined through a finished node: all three SUMs are skipped as a reference cycle, and none changes', () => {
    const cells = inSheetOrder([memFormula('A1', 'SUM(A2:A3)', '0'), memFormula('A2', 'SUM(A1:A1)', '0'), memFormula('A3', 'SUM(A2:G2)', own), ...planted(2)])
    const out = snapSums(cells)
    expect(sortSkipped(out.skipped)).toEqual([
      { row: 1, column: 1, reason: 'reference cycle' },
      { row: 2, column: 1, reason: 'reference cycle' },
      { row: 3, column: 1, reason: 'reference cycle' },
    ])
    expect(['A1', 'A2', 'A3'].map((a) => memAt(cells, a)?.text)).toEqual(['0', '0', own])
  })

  test('EV-14 the cycle through A2 = A1*1 skips the SUM A1 only; A4 = SUM(B4:G4) beside it snaps and is not skipped', () => {
    const cells = inSheetOrder([memFormula('A1', 'SUM(A2:G2)', own), memFormula('A2', 'A1*1', '0'), ...planted(2), memFormula('A4', 'SUM(B4:G4)', numberText(floatSum(PLANTED))), ...planted(4)])
    const out = snapSums(cells)
    expect(sortSkipped(out.skipped)).toEqual([{ row: 1, column: 1, reason: 'reference cycle' }])
    expect({ A1: memAt(cells, 'A1')?.text, A4: memAt(cells, 'A4')?.text, A4cached: memAt(cells, 'A4')?.cached }).toEqual({
      A1: own,
      A4: '253914.88',
      A4cached: { type: 'number', text: '253914.88' },
    })
  })

  test('EV-14 a self-reference (A1 = SUM(A1:G1)) is a cycle of one: skipped, own text kept', () => {
    const cells = inSheetOrder([memFormula('A1', 'SUM(A1:G1)', own), ...planted(1)])
    const out = snapSums(cells)
    expect(out.skipped).toEqual([{ row: 1, column: 1, reason: 'reference cycle' }])
    expect(memAt(cells, 'A1')?.text).toBe(own)
  })

  test('EV-14 a chain of 50,000 SUMs closed into a ring (A<r> = SUM(A<r+1>:A<r+1>), A50000 = SUM(A1:G1)) is walked without recursion: every one is skipped as a reference cycle', { timeout: 60_000 }, () => {
    const RING = 50_000
    const cells: Cell[] = []
    for (let r = 1; r < RING; r++) cells.push(memFormula(`A${String(r)}`, `SUM(A${String(r + 1)}:A${String(r + 1)})`, '0'))
    cells.push(memFormula(`A${String(RING)}`, 'SUM(A1:G1)', own), ...planted(1))
    const out = snapSums(inSheetOrder(cells))
    expect(out.skipped.length).toBe(RING)
    expect(out.skipped.every((s) => s.reason === 'reference cycle' && s.column === 1)).toBe(true)
    expect(new Set(out.skipped.map((s) => s.row)).size).toBe(RING)
    expect(memAt(cells, `A${String(RING)}`)?.text).toBe(own)
  })
})
