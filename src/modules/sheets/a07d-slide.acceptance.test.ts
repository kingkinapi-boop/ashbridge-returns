// A07D class D1 acceptance tests: a shared formula's text slid from its master to each child (reports/A07C-findings.md,
// "Acceptance tests for A07D", D1; RC1). Each test fails on A07C's landed head b80c251.
//
// Input domain (RC0: stated, then generated over). A shared-formula master's text is any sequence of these tokens joined by
// operators (+ - * / & = <> ,), each token optionally wrapped in a function call (SUM, LOG10, ATAN2, ROUND, IF, MAX):
//   - a cell reference `$?COL$?ROW`, columns A to XFD, rows 1 to 1048576, every `$` mix;
//   - an area `ref:ref`, a whole-column range `$?COL:$?COL`, a whole-row range `$?ROW:$?ROW`;
//   - any of these behind a sheet or external prefix: a bare name (`Sheet2!`), a quoted name holding the grammar's own
//     syntax (`'Q4 FY2026'!`, `'It''s'!`, `'A1 B2'!`, `'Tax 2025-Q4 (Test)'!`, `'R1C1 $B$2'!`) or an external part
//     (`[1]Sheet1!`, `'[2]Q4 FY2026'!`);
//   - string literals with reference-like text and doubled quotes; structured references (`Table1[B1]`,
//     `Table1[[#This Row],[C2]]`); numbers, TRUE, #N/A.
// A child at offset (dc, dr) from its master reads the master's text with every relative column moved by dc and every
// relative row by dr; absolute parts, prefixes, strings and brackets never change.
//
// Spec choices (amber, see the A07D spec report):
//   S1. A reference that slides off the grid (row < 1 or > 1048576, column < A or > XFD) reads `#REF!` in place of that
//       reference, operators and the rest of the text kept (`A1*2` slid up one row reads `#REF!*2`), as Excel shows it.
//       Only single-cell references are pinned for this; ranges that partly fall off are not pinned.
//   S2. The property calls `slide(formula, from, to)` in src/modules/sheets/xlsx/raw.ts with its A07C signature (A1
//       addresses of the master and the child); the reader tests pin the same through createSheetsReader.
//   S3. A child stored before its master in the sheet (the A1-slides-up case) is read the same as one stored after it.
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type Cell, type SheetResult } from '../../contracts/sheets'
import {
  FUNCTIONS,
  MAX_COLUMN,
  MAX_ROW,
  OPERATORS,
  OTHER,
  PREFIXES,
  SHEET,
  STRINGS,
  STRUCTURED,
  address,
  gridXlsx,
  parseAddress,
  relativeSpans,
  render,
  xmlText,
  type CellRef,
  type Token,
} from './__fixtures__/a07d'
import { createSheetsReader } from './index'
import { slide } from './xlsx/raw'

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, 'shared.xlsx')
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
const cellAt = (r: SheetResult, at: string): Cell | undefined => {
  const [column, row] = parseAddress(at)
  return r.sheets.find((s) => s.name === SHEET)?.cells.find((c) => c.row === row && c.column.number === column)
}

/** A two-cell shared group: the master at `from` holding `formula`, one self-closed child at `to`; both cache a number. */
function sharedPair(formula: string, from: string, to: string): Map<string, string> {
  const [fc0, fr0] = parseAddress(from)
  const [tc0, tr0] = parseAddress(to)
  const ref = `${address(Math.min(fc0, tc0), Math.min(fr0, tr0))}:${address(Math.max(fc0, tc0), Math.max(fr0, tr0))}`
  return new Map([
    [from, `><f t="shared" ref="${ref}" si="0">${xmlText(formula)}</f><v>1</v></c>`],
    [to, `><f t="shared" si="0"/><v>2</v></c>`],
  ])
}
const linkBoth = (from: string, to: string): [string, string][] => [
  [from, 'https://example.invalid/master'],
  [to, 'https://example.invalid/child'],
]

// ------------------------------------------------------------------------------------------------------------- D1 table

/** [master address, child address, master text, the child's text as Excel shows it]. */
const TABLE: [string, string, string, string][] = [
  ['C1', 'C2', "'Q4 FY2026'!B1*2", "'Q4 FY2026'!B2*2"],
  ['C1', 'C2', "'It''s'!A1", "'It''s'!A2"],
  ['C1', 'D1', 'SUM(A:A)', 'SUM(B:B)'],
  ['C1', 'D1', 'SUM($A:A)', 'SUM($A:B)'],
  ['A1', 'A2', 'SUM(1:1)', 'SUM(2:2)'],
  ['C1', 'C2', 'Sheet2!B1', 'Sheet2!B2'],
  ['C1', 'C2', '"A1"&B1', '"A1"&B2'],
  ['C1', 'C2', 'Table1[Amount]', 'Table1[Amount]'],
  ['C1', 'C2', 'LOG10(A1)', 'LOG10(A2)'],
  ['C2', 'C1', 'A1*2', '#REF!*2'],
  ['C1', 'D1', 'XFD1', '#REF!'],
  // The same classes, one step further: each axis alone, `$` on rows, names and brackets that look like references.
  ['C1', 'C2', 'SUM(A:A)', 'SUM(A:A)'],
  ['C1', 'D1', 'SUM(1:1)', 'SUM(1:1)'],
  ['C1', 'C2', 'SUM($1:2)', 'SUM($1:3)'],
  ['C1', 'C2', "'A1 B2'!C3+C3", "'A1 B2'!C4+C4"],
  ['C1', 'C2', 'Table1[B1]+Table1[[#This Row],[C2]]+B1', 'Table1[B1]+Table1[[#This Row],[C2]]+B2'],
  ['C1', 'C2', '"say ""B1"""&B1', '"say ""B1"""&B2'],
  ['C1', 'C2', '[1]Sheet1!A1', '[1]Sheet1!A2'],
  ['C1', 'D2', 'SUM($A1:B$1)', 'SUM($A2:C$1)'],
]

describe('A07D D1: a shared formula child reads its master text slid by the grammar (EV-14, EV-5)', () => {
  test('EV-14 the D1 table: each child reads its master text slid by the grammar, master text and both caches kept', async () => {
    const wrong: string[] = []
    for (const [from, to, master, child] of TABLE) {
      const r = await readBytes(gridXlsx(sharedPair(master, from, to)))
      const m = cellAt(r, from)
      const c = cellAt(r, to)
      expect(m, `${master} at ${from}`).toMatchObject({ type: 'formula', formula: master, cached: { type: 'number', text: '1' } })
      expect(c, `${master} at ${to}`).toMatchObject({ type: 'formula', cached: { type: 'number', text: '2' } })
      if (c?.formula !== child) wrong.push(`${master} from ${from} to ${to} read ${String(c?.formula)}, expected ${child}`)
    }
    expect(wrong).toEqual([])
  })

  test('EV-14 the D1 table with both cells of each pair hyperlinked reads the identical cells, and the slid text', async () => {
    const wrong: string[] = []
    for (const [from, to, master, child] of TABLE) {
      const plain = await readBytes(gridXlsx(sharedPair(master, from, to)))
      const linked = await readBytes(gridXlsx(sharedPair(master, from, to), linkBoth(from, to)))
      expect(cellAt(linked, from), `${master} at ${from}`).toEqual(cellAt(plain, from))
      expect(cellAt(linked, to), `${master} at ${to}`).toEqual(cellAt(plain, to))
      expect(JSON.stringify(linked)).not.toContain('example.invalid')
      if (cellAt(linked, to)?.formula !== child) wrong.push(`${master} from ${from} to ${to} read ${String(cellAt(linked, to)?.formula)}, expected ${child}`)
    }
    expect(wrong).toEqual([])
  })

  test('EV-6 the slid child still cites by its cached value, and its master keeps its own (a slide never touches the cache)', async () => {
    const r = await readBytes(gridXlsx(sharedPair("'Q4 FY2026'!B1*2", 'C1', 'C2'), linkBoth('C1', 'C2')))
    expect(cellAt(r, 'C2')?.formula).toBe("'Q4 FY2026'!B2*2")
    const at = { fileFingerprint: r.fileFingerprint, sheet: SHEET, row: 2, column: 'C' }
    expect(cellValueMatches(r, at, '2')).toEqual({ ok: true })
    expect(cellValueMatches(r, at, '1')).toEqual({ ok: false, reason: 'formula cell: cached value differs' })
  })
})

// ---------------------------------------------------------------------------------------------------------- D1 property

const column = fc.oneof(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: MAX_COLUMN }), fc.integer({ min: MAX_COLUMN - 40, max: MAX_COLUMN }))
const row = fc.oneof(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: MAX_ROW }), fc.integer({ min: MAX_ROW - 40, max: MAX_ROW }))
const cellRef: fc.Arbitrary<CellRef> = fc.record({ column, row, columnAbs: fc.boolean(), rowAbs: fc.boolean() })
const prefix = fc.constantFrom(...PREFIXES)
const fixed = (list: string[], isProtected: boolean): fc.Arbitrary<Token> => fc.constantFrom(...list).map((text) => ({ kind: 'fixed', text, protected: isProtected }))
const sorted = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a])

/** One operand of the grammar (see the input domain at the top of this file). */
const operand: fc.Arbitrary<Token> = fc.oneof(
  fc.tuple(prefix, cellRef).map(([p, c]): Token => ({ kind: 'cell', prefix: p, ...c })),
  fc.tuple(prefix, cellRef, cellRef).map(([p, a, b]): Token => ({ kind: 'area', prefix: p, from: a, to: b })),
  fc.tuple(prefix, column, column, fc.boolean(), fc.boolean()).map(([p, a, b, fa, ta]): Token => {
    const [from, to] = sorted(a, b)
    return { kind: 'columns', prefix: p, from, fromAbs: fa, to, toAbs: ta }
  }),
  fc.tuple(prefix, row, row, fc.boolean(), fc.boolean()).map(([p, a, b, fa, ta]): Token => {
    const [from, to] = sorted(a, b)
    return { kind: 'rows', prefix: p, from, fromAbs: fa, to, toAbs: ta }
  }),
  fixed(STRINGS, true),
  fixed(STRUCTURED, true),
  fixed(OTHER, false),
)
/** An operand, sometimes inside a function call: the call's name and brackets are fixed tokens. */
const term: fc.Arbitrary<Token[]> = fc.tuple(operand, fc.option(fc.constantFrom(...FUNCTIONS), { nil: undefined })).map(([t, fn]) =>
  fn === undefined ? [t] : [{ kind: 'fixed', text: `${fn}(`, protected: false }, t, { kind: 'fixed', text: ')', protected: false }],
)
/** A whole formula: one to six terms joined by operators. */
const formula: fc.Arbitrary<Token[]> = fc
  .tuple(term, fc.array(fc.tuple(fc.constantFrom(...OPERATORS), term), { maxLength: 5 }))
  .map(([first, rest]) => [...first, ...rest.flatMap(([op, t]): Token[] => [{ kind: 'fixed', text: op, protected: false }, ...t])])

/** A formula with an offset that keeps every relative reference on the grid, and master and child addresses that differ by it. */
const onGrid = formula.chain((tokens) => {
  const spans = relativeSpans(tokens)
  const columnLow = 1 - Math.min(MAX_COLUMN, ...spans.columns)
  const columnHigh = MAX_COLUMN - Math.max(1, ...spans.columns)
  const rowLow = 1 - Math.min(MAX_ROW, ...spans.rows)
  const rowHigh = MAX_ROW - Math.max(1, ...spans.rows)
  const offset = (low: number, high: number, max: number): fc.Arbitrary<number> =>
    fc.oneof(fc.integer({ min: Math.max(low, -5), max: Math.min(high, 5) }), fc.integer({ min: Math.max(low, 1 - max), max: Math.min(high, max - 1) }))
  return fc.record({
    tokens: fc.constant(tokens),
    dc: offset(columnLow, columnHigh, MAX_COLUMN),
    dr: offset(rowLow, rowHigh, MAX_ROW),
  })
})
/** Master and child addresses `(dc, dr)` apart, both on the grid. */
function addresses(dc: number, dr: number, seed: number): [string, string] {
  const fromColumn = Math.max(1, 1 - dc) + (seed % (MAX_COLUMN - Math.abs(dc)))
  const fromRow = Math.max(1, 1 - dr) + (seed % (MAX_ROW - Math.abs(dr)))
  return [address(fromColumn, fromRow), address(fromColumn + dc, fromRow + dr)]
}

/** The protected tokens' texts (string literals and structured references) in order. */
const protectedTexts = (tokens: Token[]): string[] => tokens.flatMap((t) => (t.kind === 'fixed' && t.protected ? [t.text] : []))
/** True when every text appears in `haystack` in this order. */
function inOrder(haystack: string, texts: string[]): boolean {
  let at = 0
  for (const t of texts) {
    const found = haystack.indexOf(t, at)
    if (found < 0) return false
    at = found + t.length
  }
  return true
}

describe('A07D D1 property: the slider follows the reference grammar over its whole domain (EV-14)', () => {
  test('EV-14 property (seed 20261009): a child at any on-grid offset reads exactly the grammar\'s own slide of the master', () => {
    fc.assert(
      fc.property(onGrid, fc.nat(), ({ tokens, dc, dr }, seed) => {
        const [from, to] = addresses(dc, dr, seed)
        const master = render(tokens, 0, 0)
        expect(slide(master, from, to), `${master} from ${from} to ${to}`).toBe(render(tokens, dc, dr))
      }),
      { seed: 20261009, numRuns: 3000 },
    )
  })

  test('EV-14 property (seed 20261010): sliding by (0,0) changes nothing; out and back changes nothing; quotes and brackets never change, even when a reference falls off', () => {
    fc.assert(
      fc.property(onGrid, fc.nat(), formula, fc.integer({ min: -60, max: 60 }), fc.integer({ min: -60, max: 60 }), ({ tokens, dc, dr }, seed, any, ac, ar) => {
        const [from, to] = addresses(dc, dr, seed)
        const master = render(tokens, 0, 0)
        expect(slide(master, from, from), `${master} at ${from}`).toBe(master)
        expect(slide(slide(master, from, to), to, from), `${master} ${from} to ${to} and back`).toBe(master)
        // Any formula, any offset (references may fall off): its string literals and structured references come through whole.
        const anyText = render(any, 0, 0)
        const [base, moved] = addresses(ac, ar, seed)
        const slid = slide(anyText, base, moved)
        expect(inOrder(slid, protectedTexts(any)), `${anyText} from ${base} to ${moved} read ${slid}`).toBe(true)
        // The quoted and bracketed prefixes of on-grid references come through whole too.
        for (const t of tokens) if (t.kind !== 'fixed' && t.prefix !== '') expect(slide(master, from, to), master).toContain(t.prefix)
      }),
      { seed: 20261010, numRuns: 3000 },
    )
  })

  test(
    'EV-14 property (seed 20261011): through the reader, with and without hyperlinks, a shared child reads the grammar\'s slide of its master',
    { timeout: 60_000 },
    async () => {
      const near = formula.chain((tokens) => {
        const spans = relativeSpans(tokens)
        // The master sits at J10; the child is up to five cells away in any direction, and every relative reference stays on the grid.
        const low = (values: number[]): number => Math.max(-5, 1 - Math.min(MAX_COLUMN, ...values))
        return fc.record({
          tokens: fc.constant(tokens),
          dc: fc.integer({ min: low(spans.columns), max: Math.min(5, MAX_COLUMN - Math.max(1, ...spans.columns)) }),
          dr: fc.integer({ min: Math.max(-5, 1 - Math.min(MAX_ROW, ...spans.rows)), max: Math.min(5, MAX_ROW - Math.max(1, ...spans.rows)) }),
        })
      })
      await fc.assert(
        fc.asyncProperty(
          near.filter(({ dc, dr }) => dc !== 0 || dr !== 0),
          async ({ tokens, dc, dr }) => {
            const from = 'J10'
            const to = address(10 + dc, 10 + dr)
            const master = render(tokens, 0, 0)
            const expected = render(tokens, dc, dr)
            const plain = await readBytes(gridXlsx(sharedPair(master, from, to)))
            const linked = await readBytes(gridXlsx(sharedPair(master, from, to), linkBoth(from, to)))
            expect(cellAt(plain, from)?.formula, master).toBe(master)
            expect(cellAt(plain, to)?.formula, `${master} to ${to}`).toBe(expected)
            expect(cellAt(linked, to), `${master} to ${to}, linked`).toEqual(cellAt(plain, to))
          },
        ),
        { seed: 20261011, numRuns: 80 },
      )
    },
  )
})
