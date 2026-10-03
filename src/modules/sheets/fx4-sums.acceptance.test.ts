// FX4 acceptance tests, A07D Opus read items 1 to 3 (reports/A07D-opus-read.md; card plan/cards/FX4.md): SUM totals at 16
// or more significant digits, every member of a reference cycle, and range walks inside a time budget.
//
// Spec choices (amber, see reports/FX4-spec.md):
//   F1. "Unsnapped" means the cell keeps its own text: numberText of its cached double, as every non-SUM number reads.
//       Item 1 is pinned as "exact cents of the terms as read, or the own text", over cent totals up to 1e15 dollars. On
//       main no output breaks this (a 2,000,000-case search found none: from 2^46 dollars up, where the shortest text of a
//       total can name another cent, the half-cent cap only lets a total snap when its cached double is the total's own
//       double, so the snap prints the own text). The item 1 tests are therefore guards that pass before the build; the
//       build still takes the finding's one-line fix (snap only when the total's text is the exact cent text).
//   F2. A cycle member is any formula cell in a strongly connected component of two or more cells, or one that refers to
//       itself, counting the references of formulas that are not SUMs (A2 = A1*1). Every member keeps its own text.
//   F3. Time budgets are wall time from the moment the reader's modules are loaded in a worker (the walk is synchronous,
//       so only a worker can be stopped); a work counter would need a product hook the card does not ask for. The
//       running balance has the S6 budget (30 s); the whole-sheet range 10 s, as SC4's R74 gives it.
//   F4. A SUM over budget may stay unsnapped (the card's fallback), so each running-balance total reads its exact cents
//       or its own text; the first 100 balances (5,050 term visits) are pinned as exact, so "never snap" does not pass.
import fc from 'fast-check'
import { Worker } from 'node:worker_threads'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { cellValueMatches, type Cell, type SheetResult } from '../../contracts/sheets'
import { address } from './__fixtures__/a07d'
import {
  CELLS_SHEET,
  PLANTED,
  cellCents,
  cycleMembers,
  exactText,
  floatSum,
  formulaBody,
  graphSheet,
  numberBody,
  sparseXlsx,
  textCents,
  type GraphNode,
} from './__fixtures__/fx4'
import { createSheetsReader } from './index'
import { numberText } from './xlsx/index'

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
function textsOf(r: SheetResult): Map<string, string> {
  const sheet = r.sheets.find((s) => s.name === CELLS_SHEET)
  return new Map((sheet?.cells ?? []).map((c: Cell) => [address(c.column.number, c.row), c.text]))
}

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
  const exact = terms.every((t) => t !== undefined && /^-?\d+(?:\.\d{1,2})?$/.test(t))
    ? exactText(terms.reduce((s, t) => s + textCents(t as string), 0n))
    : undefined
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

  test('EV-14 EV-6 property (seed 20261031): over cent totals up to 1e15 dollars, a snapped SUM maps back to the exact cents of its terms, else it keeps its own text', { timeout: 120_000 }, async () => {
    const big = fc.bigInt({ min: 10n ** 12n, max: 10n ** 17n })
    const small = fc.bigInt({ min: -(10n ** 7n), max: 10n ** 7n })
    await fc.assert(
      fc.asyncProperty(big, small, async (b, s) => {
        const { texts, cached } = await readPair(b, s)
        const { exact, own } = allowed(texts, cached)
        const total = texts.get('A3')
        if (total !== own) expect(total, `${centsTextOf(b)} + ${centsTextOf(s)}: snapped, so it must be the exact cents`).toBe(exact)
      }),
      { seed: 20261031, numRuns: 150 },
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
const sum = (lo: number, hi: number, withTerms = false): GraphNode => ({ kind: 'sum', lo, hi, withTerms })
const ref = (target: number): GraphNode => ({ kind: 'ref', target })
const NOISY = String(floatSum(PLANTED))

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

  const node: fc.Arbitrary<(n: number) => GraphNode> = fc.oneof(
    { weight: 4, arbitrary: fc.tuple(fc.nat(), fc.nat(), fc.boolean()).map(([a, b, t]) => (n: number) => sum(Math.min(a % n, b % n) + 1, Math.max(a % n, b % n) + 1, t)) },
    { weight: 1, arbitrary: fc.nat().map((a) => (n: number) => ref((a % n) + 1)) },
  )
  const graph: fc.Arbitrary<GraphNode[]> = fc
    .tuple(fc.integer({ min: 2, max: 6 }), fc.array(node, { minLength: 6, maxLength: 6 }))
    .map(([n, makers]) => makers.slice(0, n).map((make) => make(n)))

  test('EV-14 EV-5 property (seed 20261032): in random SUM graphs with cycles (through SUMs and through A<n>*1 formulas), every member of every strongly connected component keeps its own text', { timeout: 120_000 }, async () => {
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
})

// ------------------------------------------------------------------------------------------- item 3: bounded range walks

type WorkerRead = { status: 'over' } | { status: 'error'; error: string } | { status: 'done'; ok: false; reason: string } | { status: 'done'; ok: true; cells: Record<string, { text: string; merged: string | null }> }

/** Module loading in the worker has its own limit; the budget counts from when the modules are loaded. */
const LOAD_LIMIT_MS = 30_000

/** Reads the bytes through createSheetsReader in a worker; a read still running at the budget is stopped. */
function readInWorker(bytes: Uint8Array, budgetMs: number): Promise<WorkerRead> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./__fixtures__/fx4-worker.mjs', import.meta.url), {
      workerData: { bytes, fileName: 'budget (Test).xlsx' },
      resourceLimits: { maxOldGenerationSizeMb: 2048 },
      stdout: true,
      stderr: true,
    })
    let settled = false
    const finish = (r: WorkerRead): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(r)
    }
    let timer = setTimeout(() => {
      finish({ status: 'error', error: 'modules did not load' })
    }, LOAD_LIMIT_MS)
    worker.on('message', (m: { ready?: boolean; done?: boolean; ok?: boolean; reason?: string; error?: string; cells?: Record<string, { text: string; merged: string | null }> }) => {
      if (m.ready === true) {
        clearTimeout(timer)
        timer = setTimeout(() => {
          finish({ status: 'over' })
        }, budgetMs)
        return
      }
      if (m.done !== true) finish({ status: 'error', error: m.error ?? 'unknown' })
      else if (m.ok === true) finish({ status: 'done', ok: true, cells: m.cells ?? {} })
      else finish({ status: 'done', ok: false, reason: m.reason ?? '' })
    })
    worker.on('error', (e: Error) => {
      finish({ status: 'error', error: `${e.name}: ${e.message}` })
    })
    worker.on('exit', (code) => {
      finish({ status: 'error', error: `worker exited with code ${String(code)}` })
    })
  })
}

/** A fixed stream of whole cents up to 1e6 (10,000 dollars), mixed sign. */
function centStream(seed: number, count: number): number[] {
  let state = seed
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0
    out.push((state % 2_000_001) - 1_000_000)
  }
  return out
}

describe('FX4 item 3: range walks are bounded by the cells that exist, inside the budget (EV-14, ARC-10)', () => {
  test('EV-14 ARC-10 a 20,000-row ledger running balance B<r> = SUM($A$1:A<r>) reads inside the 30 s budget; each balance reads its exact cents or its own text, the first 100 exactly', { timeout: 90_000 }, async () => {
    const ROWS = 20_000
    const amounts = centStream(20261033, ROWS)
    const cells = new Map<string, string>()
    const exact: bigint[] = []
    const cached: number[] = []
    let running = 0
    let runningExact = 0n
    amounts.forEach((c, i) => {
      const row = i + 1
      // Excel sums A1..A<r> in range order, which is the running float sum.
      running += c / 100
      runningExact += BigInt(c)
      cached.push(running)
      exact.push(runningExact)
      cells.set(`A${String(row)}`, numberBody(c / 100))
      cells.set(`B${String(row)}`, formulaBody(`SUM($A$1:A${String(row)})`, running))
    })
    const out = await readInWorker(sparseXlsx(cells), 30_000)
    expect(out.status === 'done' && out.ok, `the read ${out.status === 'over' ? 'did not finish inside 30 s' : JSON.stringify(out).slice(0, 200)}`).toBe(true)
    if (out.status !== 'done' || !out.ok) return
    const wrong: string[] = []
    for (let row = 1; row <= ROWS; row++) {
      const text = out.cells[`B${String(row)}`]?.text
      const want = cellCents(exact[row - 1] as bigint)
      const own = numberText(cached[row - 1] as number)
      const ok = row <= 100 ? text === want : text === want || text === own
      if (!ok) wrong.push(`B${String(row)} read ${String(text)}, exact ${want}, own ${own}`)
    }
    expect({ wrongCount: wrong.length, first: wrong.slice(0, 3) }).toEqual({ wrongCount: 0, first: [] })
    expect(out.cells.A20000?.text).toBe(String((amounts[ROWS - 1] as number) / 100))
  })

  test('EV-14 ARC-10 A1 = SUM(A2:XFD1048576) over the planted terms spread to the far corner reads inside 10 s, as their exact cents or its own text', { timeout: 60_000 }, async () => {
    const at = ['A2', 'B3', 'Z10', 'AA100', 'XFC1048576', 'XFD1048576']
    const cells = new Map<string, string>()
    PLANTED.forEach((x, i) => cells.set(at[i] as string, numberBody(x)))
    // Range order is row by row, so the cached sum adds the terms in the order listed.
    const cachedTotal = floatSum(PLANTED)
    cells.set('A1', formulaBody('SUM(A2:XFD1048576)', cachedTotal))
    const out = await readInWorker(sparseXlsx(cells), 10_000)
    expect(out.status === 'done' && out.ok, `the read ${out.status === 'over' ? 'did not finish inside 10 s' : JSON.stringify(out).slice(0, 200)}`).toBe(true)
    if (out.status !== 'done' || !out.ok) return
    expect(['253914.88', numberText(cachedTotal)]).toContain(out.cells.A1?.text)
    expect(at.map((a) => out.cells[a]?.text)).toEqual(PLANTED.map((x) => String(x)))
  })
})
