// FX4 acceptance tests, A07D Opus read item 3 and the whole-sheet merge (reports/A07D-opus-read.md; card
// plan/cards/FX4.md, Lead directive A434; spec review reports/FX4-spec-review.md gaps 7 to 9): range walks bounded by the
// cells that exist, measured in work counts, and merges too big to load refused with a reason.
//
// Public API this file needs from src/modules/sheets/xlsx/index.ts (Lead directive A434):
//   SUM_WORK_LIMIT: number   the most cells the SUM walks of one sheet may read (at least 1,000,000)
//   snapSums(cells: Cell[], limit = SUM_WORK_LIMIT): { visits: number; skipped: { row: number; column: number; reason: 'reference cycle' | 'over the work limit' }[] }
//     `visits` counts every cell a range walk reads (cycle search and totals alike); a SUM the walks cannot afford keeps
//     its own text and is listed as skipped, reason "over the work limit".
//
// Spec choices (amber, see reports/FX4-spec.md):
//   F3. Budgets are work counts, not wall time. Each snapSums test runs in a worker only so that a walk that never ends
//       is stopped (60 s, far above any correct build); the counts decide. Two reads through the reader keep the S6 30 s
//       wall-time budget as smoke tests (the far-corner sheet costs ExcelJS about 5 s to load, too close to 10 s).
//   F4. SUMs are taken in sheet order, so the cheapest running balances come first: every balance k with k(k+1) within
//       the limit (two reads per term, room for a cycle search) reads exact; a skipped balance reads its own text.
//   F10. A workbook whose merge regions cover more than 1,000,000 cells in all is refused before the library loads it
//       (ExcelJS 4.4.0 makes a cell for every address a merge names): `ok: false`, a reason that says merge and names no
//       library message and no file name. One region over the cap is the same refusal. A merge under the cap reads.
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import type { Cell, SheetResult } from '../../contracts/sheets'
import { address, letters } from './__fixtures__/a07d'
import {
  CELLS_SHEET,
  PLANTED,
  centStream,
  exactText,
  floatSum,
  formulaBody,
  memFormula,
  memNumber,
  numberBody,
  readInWorker,
  snapInWorker,
  sparseXlsx,
  type SnapOut,
  type WorkerSnap,
} from './__fixtures__/fx4'
import { createSheetsReader } from './index'
import * as xlsx from './xlsx/index'
import { NOT_A_WORKBOOK, numberText } from './xlsx/index'

const api = xlsx as unknown as { SUM_WORK_LIMIT?: number }
function workLimit(): number {
  if (typeof api.SUM_WORK_LIMIT !== 'number') throw new Error('src/modules/sheets/xlsx/index.ts does not export SUM_WORK_LIMIT')
  return api.SUM_WORK_LIMIT
}
/** A hang stop only: a correct build finishes these walks in well under a second. */
const HANG_STOP_MS = 60_000

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
const textsOf = (r: SheetResult): Map<string, string> =>
  new Map((r.sheets.find((s) => s.name === CELLS_SHEET)?.cells ?? []).map((c: Cell) => [address(c.column.number, c.row), c.text]))

function snapped(out: WorkerSnap): SnapOut {
  if (out.status === 'over') throw new Error(`snapSums did not finish inside ${String(HANG_STOP_MS / 1000)} s`)
  if (out.status === 'error') throw new Error(out.error)
  return out.snap
}

/** A 20,000-row ledger: A<r> the amounts, B<r> = SUM($A$1:A<r>) caching the running floating-point sum. */
function runningBalance(rows: number): { cells: Cell[]; bytes: Map<string, string>; exact: bigint[]; cached: number[] } {
  const amounts = centStream(20261033, rows)
  const cells: Cell[] = []
  const bytes = new Map<string, string>()
  const exact: bigint[] = []
  const cached: number[] = []
  let running = 0
  let runningExact = 0n
  amounts.forEach((c, i) => {
    const row = String(i + 1)
    // Excel sums A1..A<r> in range order, which is the running float sum.
    running += c / 100
    runningExact += BigInt(c)
    cached.push(running)
    exact.push(runningExact)
    cells.push(memNumber(`A${row}`, String(c / 100)), memFormula(`B${row}`, `SUM($A$1:A${row})`, numberText(running)))
    bytes.set(`A${row}`, numberBody(c / 100))
    bytes.set(`B${row}`, formulaBody(`SUM($A$1:A${row})`, running))
  })
  return { cells, bytes, exact, cached }
}

/** The planted terms at the far corners of A2:XFD1048576, in range order (row by row), and A1 summing them. */
const FAR = ['A2', 'B3', 'Z10', 'AA100', 'XFC1048576', 'XFD1048576']

describe('FX4 item 3: SUM walks read only cells that exist, within a work limit (EV-14)', () => {
  test('EV-14 SUM_WORK_LIMIT is at least 1,000,000 cell reads', () => {
    expect(workLimit()).toBeGreaterThanOrEqual(1_000_000)
  })

  test('EV-14 a 20,000-row running balance B<r> = SUM($A$1:A<r>) stays within the work limit; every balance reads its exact cents unless skipped "over the work limit", when it reads its own text', { timeout: 120_000 }, async () => {
    const ROWS = 20_000
    const { cells, exact, cached } = runningBalance(ROWS)
    const limit = workLimit()
    const out = snapped(await snapInWorker(cells, HANG_STOP_MS))
    expect(out.visits, 'visits').toBeLessThanOrEqual(limit + cells.length)
    expect(out.skipped.filter((s) => s.reason !== 'over the work limit' || s.column !== 2)).toEqual([])
    const skipped = new Set(out.skipped.map((s) => s.row))
    const wrong: string[] = []
    for (let row = 1; row <= ROWS; row++) {
      const text = out.texts[`B${String(row)}`]
      const want = skipped.has(row) ? numberText(cached[row - 1] as number) : exactText(exact[row - 1] as bigint)
      if (text !== want) wrong.push(`B${String(row)} read ${String(text)}, ${skipped.has(row) ? 'skipped, own' : 'exact'} ${want}`)
    }
    expect({ wrongCount: wrong.length, first: wrong.slice(0, 3) }).toEqual({ wrongCount: 0, first: [] })
  })

  test('EV-14 every running balance k with k(k+1) within SUM_WORK_LIMIT reads exact (SUMs are taken in sheet order, so a tiny limit cannot pass)', { timeout: 120_000 }, async () => {
    const ROWS = 20_000
    const { cells, exact } = runningBalance(ROWS)
    const limit = workLimit()
    const out = snapped(await snapInWorker(cells, HANG_STOP_MS))
    const wrong: string[] = []
    for (let k = 1; k <= ROWS && k * (k + 1) <= limit; k++) {
      const text = out.texts[`B${String(k)}`]
      if (text !== exactText(exact[k - 1] as bigint)) wrong.push(`B${String(k)} read ${String(text)}, exact ${exactText(exact[k - 1] as bigint)}`)
    }
    expect({ wrongCount: wrong.length, first: wrong.slice(0, 3) }).toEqual({ wrongCount: 0, first: [] })
  })

  test('EV-14 20,000 rows of C<r> = SUM($A$1:$B$20000) (8e8 reads if each were walked in full) stay within the work limit; each reads the exact total or, skipped "over the work limit", its own text; C1 reads exact', { timeout: 120_000 }, async () => {
    const ROWS = 20_000
    const amounts = centStream(20261041, 2 * ROWS)
    const cells: Cell[] = []
    let exact = 0n
    for (let r = 1; r <= ROWS; r++) {
      const a = amounts[2 * (r - 1)] as number
      const b = amounts[2 * (r - 1) + 1] as number
      exact += BigInt(a) + BigInt(b)
      cells.push(memNumber(`A${String(r)}`, String(a / 100)), memNumber(`B${String(r)}`, String(b / 100)))
    }
    // Range order is row by row: A1, B1, A2, B2, ...
    const cached = floatSum(amounts.map((c) => c / 100))
    const own = numberText(cached)
    const withTotals: Cell[] = []
    for (let r = 1; r <= ROWS; r++) withTotals.push(cells[2 * (r - 1)] as Cell, cells[2 * (r - 1) + 1] as Cell, memFormula(`C${String(r)}`, 'SUM($A$1:$B$20000)', own))
    const limit = workLimit()
    const out = snapped(await snapInWorker(withTotals, HANG_STOP_MS))
    expect(out.visits, 'visits').toBeLessThanOrEqual(limit + withTotals.length)
    expect(out.skipped.filter((s) => s.reason !== 'over the work limit' || s.column !== 3)).toEqual([])
    const skipped = new Set(out.skipped.map((s) => s.row))
    const wrong: string[] = []
    for (let r = 1; r <= ROWS; r++) {
      const text = out.texts[`C${String(r)}`]
      const want = skipped.has(r) ? own : exactText(exact)
      if (text !== want) wrong.push(`C${String(r)} read ${String(text)}, want ${want}`)
    }
    expect({ wrongCount: wrong.length, first: wrong.slice(0, 3) }).toEqual({ wrongCount: 0, first: [] })
    expect(out.texts.C1).toBe(exactText(exact))
  })

  test('EV-14 A1 = SUM(A2:XFD1048576) over six cells reads at most the cells that exist, skips nothing and reads exactly 253914.88', { timeout: 120_000 }, async () => {
    const cells: Cell[] = [memFormula('A1', 'SUM(A2:XFD1048576)', numberText(floatSum(PLANTED))), ...PLANTED.map((x, i) => memNumber(FAR[i] as string, String(x)))]
    const out = snapped(await snapInWorker(cells, HANG_STOP_MS))
    expect({ visitsWithinCells: out.visits <= cells.length, skipped: out.skipped, A1: out.texts.A1 }).toEqual({ visitsWithinCells: true, skipped: [], A1: '253914.88' })
  })

  test('EV-14 a limit too small for a walk skips that SUM "over the work limit" with its own text (a limit of 3 against a six-term SUM)', { timeout: 120_000 }, async () => {
    const own = numberText(floatSum(PLANTED))
    const cells: Cell[] = [...PLANTED.map((x, i) => memNumber(address(1 + i, 1), String(x))), memFormula('A2', 'SUM(A1:F1)', own)]
    const out = snapped(await snapInWorker(cells, HANG_STOP_MS, 3))
    expect({ visitsWithin: out.visits <= 3 + cells.length, skipped: out.skipped, A2: out.texts.A2 }).toEqual({
      visitsWithin: true,
      skipped: [{ row: 2, column: 1, reason: 'over the work limit' }],
      A2: own,
    })
  })

  test('EV-14 whole-column and whole-row SUMs over six cells read exactly: SUM(A2:A1048576) and SUM(A2:XFD2)', { timeout: 60_000 }, async () => {
    const down = ['A2', 'A3', 'A100', 'A5000', 'A1048575', 'A1048576']
    const across = ['A2', 'B2', 'Z2', 'AA2', 'XFC2', 'XFD2']
    for (const [formula, at] of [
      ['SUM(A2:A1048576)', down],
      ['SUM(A2:XFD2)', across],
    ] as const) {
      const cells = new Map<string, string>([['A1', formulaBody(formula, floatSum(PLANTED))]])
      PLANTED.forEach((x, i) => cells.set(at[i] as string, numberBody(x)))
      const texts = textsOf(await readBytes(sparseXlsx(cells)))
      expect(texts.get('A1'), formula).toBe('253914.88')
    }
  })

  test('EV-14 smoke: the 20,000-row running balance reads through the reader inside the S6 30 s budget, each balance exact or its own text', { timeout: 90_000 }, async () => {
    const ROWS = 20_000
    const { bytes, exact, cached } = runningBalance(ROWS)
    const out = await readInWorker(sparseXlsx(bytes), 30_000)
    expect(out.status === 'done' && out.ok, `the read ${out.status === 'over' ? 'did not finish inside 30 s' : JSON.stringify(out).slice(0, 200)}`).toBe(true)
    if (out.status !== 'done' || !out.ok) return
    const wrong: string[] = []
    for (let row = 1; row <= ROWS; row++) {
      const text = out.cells[`B${String(row)}`]?.text
      if (text !== exactText(exact[row - 1] as bigint) && text !== numberText(cached[row - 1] as number)) wrong.push(`B${String(row)} read ${String(text)}`)
    }
    expect({ wrongCount: wrong.length, first: wrong.slice(0, 3) }).toEqual({ wrongCount: 0, first: [] })
  })

  test('EV-14 smoke: A1 = SUM(A2:XFD1048576) over the planted terms at the far corner reads through the reader inside the S6 30 s budget as exactly 253914.88', { timeout: 90_000 }, async () => {
    // ExcelJS 4.4.0 alone takes about 5 s on the laptop to load a sheet that reaches row 1048576, so this smoke has the S6
    // budget, not R74's 10 s (R74's own whole-sheet case keeps its cells near the top). The work counts above decide.
    const cells = new Map<string, string>()
    PLANTED.forEach((x, i) => cells.set(FAR[i] as string, numberBody(x)))
    cells.set('A1', formulaBody('SUM(A2:XFD1048576)', floatSum(PLANTED)))
    const out = await readInWorker(sparseXlsx(cells), 30_000)
    expect(out.status === 'done' && out.ok, `the read ${out.status === 'over' ? 'did not finish inside 30 s' : JSON.stringify(out).slice(0, 200)}`).toBe(true)
    if (out.status !== 'done' || !out.ok) return
    expect(out.cells.A1?.text).toBe('253914.88')
    expect(FAR.map((a) => out.cells[a]?.text)).toEqual(PLANTED.map((x) => String(x)))
  })
})

describe('FX4: merge regions too big to load are refused with a reason, a flag for a person (EV-14)', () => {
  const FILE = 'merges (Test).xlsx'
  function expectMergeRefusal(out: Awaited<ReturnType<typeof readInWorker>>, what: string): void {
    expect(out.status === 'done' && !out.ok, `${what}: ${out.status === 'over' ? 'did not finish inside 10 s' : JSON.stringify(out).slice(0, 200)}`).toBe(true)
    if (out.status !== 'done' || out.ok) return
    expect(out.reason, what).toMatch(/merge/i)
    expect(out.reason, what).not.toBe(NOT_A_WORKBOOK)
    expect(out.reason, what).not.toContain('merges (Test)')
    expect(out.reason, what).not.toMatch(/exceljs|Error|\bat \S+:\d+/i)
  }

  test('EV-14 one merge over the whole sheet (A1:XFD1048576, 17,179,869,184 cells) is refused inside 10 s, never loaded', { timeout: 60_000 }, async () => {
    const out = await readInWorker(sparseXlsx(new Map([['A1', numberBody(1)]]), ['A1:XFD1048576']), 10_000, FILE)
    expectMergeRefusal(out, 'A1:XFD1048576')
  })

  test('EV-14 2,000 merges of 1,000 cells each (2,000,000 cells in all, each under the cap) are refused inside 10 s', { timeout: 60_000 }, async () => {
    const merges = Array.from({ length: 2_000 }, (_, i) => `A${String(i + 1)}:${letters(1_000)}${String(i + 1)}`)
    const out = await readInWorker(sparseXlsx(new Map([['A1', numberBody(1)]]), merges), 10_000, FILE)
    expectMergeRefusal(out, '2,000 merges of 1,000 cells')
  })

  test('EV-14 a merge well under the cap (A1:XFD1, 16,384 cells) reads inside 10 s, A1 carrying its range', { timeout: 60_000 }, async () => {
    const out = await readInWorker(sparseXlsx(new Map([['A1', numberBody(1)]]), ['A1:XFD1']), 10_000, FILE)
    expect(out.status === 'done' && out.ok, JSON.stringify(out).slice(0, 200)).toBe(true)
    if (out.status !== 'done' || !out.ok) return
    expect(out.cells.A1).toEqual({ text: '1', merged: 'A1:XFD1' })
  })
})
