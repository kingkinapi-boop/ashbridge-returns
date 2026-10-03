// FX4 test fixtures (spec-writer): sparse workbooks (only rows that hold cells are written, so a cell at XFD1048576 costs
// one row), workbooks of several sheets, cells built in memory for snapSums, random formula graphs with reference
// cycles and their strongly connected components computed here (an oracle that shares no code with the reader), Excel-true
// cached values for graphs without cycles, the six planted cent terms, and the worker harness for time budgets.
import { Worker } from 'node:worker_threads'
import type { Cell } from '../../../contracts/sheets'
import { rawXlsx, storedZip } from './harness'
import { address, letters, parseAddress, stored, xmlText } from './a07d'

/** The sheet every rawXlsx workbook holds. */
export const CELLS_SHEET = 'Cells (Test)'

/** The six terms of the A07B check's planted sum; their floating-point sum is 253914.87999999803. */
export const PLANTED = [-7335624.99, 2860106.52, -2434451.58, 8522880.37, 4815622.56, -6174618]
export const floatSum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

/** The cent amount n/100 as String prints the nearest double (the snap's text before FX4). */
export const cellCents = (n: bigint): string => String(Number(n) / 100)
/** Exact cents of a cent-amount text ("-12.5" is -1250n). */
export function textCents(text: string): bigint {
  const found = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!found) throw new Error(`not a cent amount: ${text}`)
  const cents = BigInt(`${found[2] as string}${(found[3] ?? '').padEnd(2, '0')}`)
  return found[1] === '-' ? -cents : cents
}
/** True when the text is a cent amount ("-12.5", "3", "0.07"). */
export const isCentText = (text: string | undefined): boolean => text !== undefined && /^-?\d+(?:\.\d{1,2})?$/.test(text)
/** Exact cent text with trailing zeros dropped, as String() prints a number that holds it exactly ("46897341536252.6"). */
export function exactText(n: bigint): string {
  const a = n < 0n ? -n : n
  const fraction = String(a % 100n)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return `${n < 0n ? '-' : ''}${String(a / 100n)}${fraction === '' ? '' : `.${fraction}`}`
}

/** A number cell body. */
export const numberBody = (x: number): string => `><v>${stored(x)}</v></c>`
/** A formula cell body with its cached number. */
export const formulaBody = (formula: string, cached: number): string => `><f>${xmlText(formula)}</f><v>${stored(cached)}</v></c>`

/** The inside of <sheetData> from cell bodies by address, rows in order, only where a cell sits. */
function sheetDataOf(cells: Map<string, string>): string {
  const byRow = new Map<number, [number, string][]>()
  for (const [at, body] of cells) {
    const [column, row] = parseAddress(at)
    const list = byRow.get(row) ?? []
    list.push([column, `<c r="${at}"${body}`])
    byRow.set(row, list)
  }
  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([row, list]) =>
        `<row r="${String(row)}">${list
          .sort((a, b) => a[0] - b[0])
          .map(([, xml]) => xml)
          .join('')}</row>`,
    )
    .join('')
}
const mergeXml = (merges: string[]): string =>
  merges.length > 0 ? `<mergeCells count="${String(merges.length)}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''

/**
 * A one-sheet workbook ("Cells (Test)") from cell bodies by address (what follows `<c r=".."`), rows written in order and
 * only where a cell sits; `merges` are written as the sheet's <mergeCells>.
 */
export function sparseXlsx(cells: Map<string, string>, merges: string[] = []): Uint8Array {
  return rawXlsx({ sheetData: sheetDataOf(cells), after: mergeXml(merges) })
}

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'

/** A workbook of several sheets, in order, each from cell bodies by address (as sparseXlsx). Stored zip, fixed times. */
export function sheetsXlsx(sheets: { name: string; cells: Map<string, string> }[]): Uint8Array {
  const overrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${String(i + 1)}.xml" ContentType="${SHEET_TYPE}"/>`).join('')
  const entries: [string, string][] = [
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`,
    ],
    ['_rels/.rels', `${XML}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    [
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><workbookPr/><sheets>${sheets
        .map((s, i) => `<sheet name="${xmlText(s.name)}" sheetId="${String(i + 1)}" r:id="rId${String(i + 1)}"/>`)
        .join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${PKG_REL}">${sheets
        .map((_, i) => `<Relationship Id="rId${String(i + 1)}" Type="${REL}/worksheet" Target="worksheets/sheet${String(i + 1)}.xml"/>`)
        .join('')}</Relationships>`,
    ],
    ...sheets.map(
      (s, i): [string, string] => [
        `xl/worksheets/sheet${String(i + 1)}.xml`,
        `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetData>${sheetDataOf(s.cells)}</sheetData></worksheet>`,
      ],
    ),
  ]
  return storedZip(entries)
}

// ------------------------------------------------------------------------------------------- cells in memory (snapSums)

const base = (at: string): Omit<Cell, 'text' | 'type'> => {
  const [column, row] = parseAddress(at)
  return { row, column: { letter: letters(column), number: column }, hiddenRow: false, hiddenColumn: false, merged: null }
}
/** A number cell as the reader gives it, with the text the reader would give its stored value. */
export const memNumber = (at: string, text: string): Cell => ({ ...base(at), text, type: 'number' })
/** A formula cell as the reader gives it: cached number text and cell text alike. */
export const memFormula = (at: string, formula: string, text: string): Cell => ({ ...base(at), text, type: 'formula', formula, cached: { type: 'number', text } })
/** Cells in sheet order (row, then column), as the reader lists them. */
export const inSheetOrder = (cells: Cell[]): Cell[] => [...cells].sort((a, b) => a.row - b.row || a.column.number - b.column.number)
/** The cell at an address. */
export const memAt = (cells: Cell[], at: string): Cell | undefined => {
  const [column, row] = parseAddress(at)
  return cells.find((c) => c.row === row && c.column.number === column)
}

// ------------------------------------------------------------------------------------------- formula graphs (item 2)

/** A formula with one reference, in the shapes a reader must follow: `A<t>*1`, `$A$<t>+0`, `IF(A<t>>0,A<t>,0)`, `ROUND(A<t>,2)`, `'Cells (Test)'!A<t>*1`. */
export type RefShape = 'mul' | 'abs' | 'if' | 'round' | 'sheet'
/** A formula over a range that the snap leaves alone: `AVERAGE(A<lo>:A<hi>)`, `SUM(A<lo>:A<hi>,0)`. */
export type RangeShape = 'average' | 'sum-and-zero'

/**
 * One node of a formula graph, at A<row>. A `sum` node is SUM(A<lo>:A<hi>) over other nodes, or SUM(A<lo>:G<hi>) when
 * `withTerms` (every node row holds the six planted terms in B to G), written with `$` on every part when `abs`. A `ref`
 * node refers to one cell; a `range` node is a formula over A<lo>:A<hi> that is not a plain SUM.
 */
export type GraphNode =
  | { kind: 'sum'; lo: number; hi: number; withTerms: boolean; abs: boolean }
  | { kind: 'ref'; target: number; shape: RefShape }
  | { kind: 'range'; lo: number; hi: number; shape: RangeShape }

/** The rows each node refers to (its out-edges: every cell of every range), by node row; rows past the nodes hold no formula. */
export function edges(nodes: GraphNode[]): number[][] {
  return nodes.map((n) => {
    if (n.kind === 'ref') return [n.target]
    const out: number[] = []
    for (let r = n.lo; r <= n.hi; r++) if (r <= nodes.length) out.push(r)
    return out
  })
}

/** Rows of the nodes that sit in a reference cycle: a strongly connected component of two or more, or a node that refers to itself. */
export function cycleMembers(nodes: GraphNode[]): Set<number> {
  const out = edges(nodes)
  const index = new Map<number, number>()
  const low = new Map<number, number>()
  const onStack = new Set<number>()
  const stack: number[] = []
  const members = new Set<number>()
  let next = 0
  const visit = (v: number): void => {
    index.set(v, next)
    low.set(v, next)
    next++
    stack.push(v)
    onStack.add(v)
    for (const w of out[v - 1] ?? []) {
      if (!index.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number))
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v) as number, index.get(w) as number))
    }
    if (low.get(v) === index.get(v)) {
      const component: number[] = []
      let w: number
      do {
        w = stack.pop() as number
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      const selfLoop = (out[v - 1] ?? []).includes(v)
      if (component.length > 1 || selfLoop) for (const m of component) members.add(m)
    }
  }
  for (let v = 1; v <= nodes.length; v++) if (!index.has(v)) visit(v)
  return members
}

/** The formula text of a node. */
export function formulaOf(n: GraphNode): string {
  const r = (x: number): string => String(x)
  if (n.kind === 'ref') {
    const t = r(n.target)
    if (n.shape === 'mul') return `A${t}*1`
    if (n.shape === 'abs') return `$A$${t}+0`
    if (n.shape === 'if') return `IF(A${t}>0,A${t},0)`
    if (n.shape === 'round') return `ROUND(A${t},2)`
    return `'${CELLS_SHEET}'!A${t}*1`
  }
  if (n.kind === 'range') return n.shape === 'average' ? `AVERAGE(A${r(n.lo)}:A${r(n.hi)})` : `SUM(A${r(n.lo)}:A${r(n.hi)},0)`
  const last = n.withTerms ? 'G' : 'A'
  return n.abs ? `SUM($A$${r(n.lo)}:$${last}$${r(n.hi)})` : `SUM(A${r(n.lo)}:${last}${r(n.hi)})`
}

/**
 * The sheet of a graph with cycles: the nodes in A1..An, the six planted terms in B to G of every node row. Cached values
 * are what a spreadsheet that gave up on its cycles might leave: every node counts as 0, so a SUM with terms caches the
 * floating-point sum, in range order (row by row), of the planted terms in its rows (noise only a snap would change),
 * and every other node caches 0. A member a reader misses then shows: its terms read "0" or as stored, so it snaps.
 */
export function graphSheet(nodes: GraphNode[]): { cells: Map<string, string>; cached: number[] } {
  const cached = nodes.map((n) => {
    if (n.kind !== 'sum' || !n.withTerms) return 0
    let v = 0
    for (let r = n.lo; r <= n.hi; r++) for (const x of PLANTED) v += x
    return v
  })
  const cells = new Map<string, string>()
  nodes.forEach((n, i) => {
    const row = i + 1
    cells.set(`A${String(row)}`, formulaBody(formulaOf(n), cached[i] as number))
    PLANTED.forEach((x, j) => cells.set(address(2 + j, row), numberBody(x)))
  })
  return { cells, cached }
}

/** Column A of the two number rows below an acyclic graph's nodes (B to G hold the planted terms there too). */
export const BELOW_A = 1234.56

/**
 * The sheet of a graph with no cycle (every edge goes to a later row): nodes in A1..An, the planted terms in B to G of
 * every node row, and two number rows n+1 and n+2 (A = 1234.56, B to G the planted terms) that ranges and references may
 * reach. Cached values are Excel-true, computed bottom-up: a SUM adds its range in range order (row by row, A to G),
 * AVERAGE divides that sum by the cell count, ROUND rounds to cents, IF keeps a positive value, the rest copy their target.
 */
export function acyclicSheet(nodes: GraphNode[]): { cells: Map<string, string>; value: (row: number, column: number) => number | undefined; cached: number[] } {
  const n = nodes.length
  const values = new Map<string, number>()
  const key = (row: number, column: number): string => `${String(row)}:${String(column)}`
  for (let row = 1; row <= n + 2; row++) PLANTED.forEach((x, j) => values.set(key(row, 2 + j), x))
  for (let row = n + 1; row <= n + 2; row++) values.set(key(row, 1), BELOW_A)
  const rangeSum = (lo: number, hi: number, lastColumn: number): { sum: number; count: number } => {
    let sum = 0
    let count = 0
    for (let row = lo; row <= hi; row++)
      for (let column = 1; column <= lastColumn; column++) {
        const v = values.get(key(row, column))
        if (v !== undefined) {
          sum += v
          count++
        }
      }
    return { sum, count }
  }
  for (let row = n; row >= 1; row--) {
    const node = nodes[row - 1] as GraphNode
    let v: number
    if (node.kind === 'sum') v = rangeSum(node.lo, node.hi, node.withTerms ? 7 : 1).sum
    else if (node.kind === 'range') {
      const { sum, count } = rangeSum(node.lo, node.hi, 1)
      v = node.shape === 'average' ? sum / count : sum + 0
    } else {
      const t = values.get(key(node.target, 1)) as number
      v = node.shape === 'round' ? Math.round(t * 100) / 100 : node.shape === 'if' ? (t > 0 ? t : 0) : t
    }
    values.set(key(row, 1), v)
  }
  const cells = new Map<string, string>()
  const cached: number[] = []
  for (let row = 1; row <= n + 2; row++) {
    PLANTED.forEach((x, j) => cells.set(address(2 + j, row), numberBody(x)))
    if (row > n) cells.set(`A${String(row)}`, numberBody(BELOW_A))
    else {
      const v = values.get(key(row, 1)) as number
      cached.push(v)
      cells.set(`A${String(row)}`, formulaBody(formulaOf(nodes[row - 1] as GraphNode), v))
    }
  }
  return { cells, value: (row, column) => values.get(key(row, column)), cached }
}

// ------------------------------------------------------------------------------------------------- time budgets (item 3)

export type WorkerRead =
  | { status: 'over' }
  | { status: 'error'; error: string }
  | { status: 'done'; ok: false; reason: string }
  | { status: 'done'; ok: true; cells: Record<string, { text: string; merged: string | null }> }

export type SnapOut = { visits: number; skipped: { row: number; column: number; reason: string }[]; texts: Record<string, string> }
export type WorkerSnap = { status: 'over' } | { status: 'error'; error: string } | { status: 'done'; snap: SnapOut }

/** Module loading in the worker has its own limit; the budget counts from when the modules are loaded. */
const LOAD_LIMIT_MS = 30_000

type WorkerMessage = {
  ready?: boolean
  done?: boolean
  ok?: boolean
  reason?: string
  error?: string
  cells?: Record<string, { text: string; merged: string | null }>
  snap?: SnapOut
}

/** Runs one job in fx4-worker.mjs; a job still running at the budget (counted from when its modules are loaded) is stopped. */
function runWorker(data: Record<string, unknown>, budgetMs: number): Promise<{ status: 'over' } | { status: 'error'; error: string } | { status: 'message'; m: WorkerMessage }> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./fx4-worker.mjs', import.meta.url), {
      workerData: data,
      resourceLimits: { maxOldGenerationSizeMb: 2048 },
      stdout: true,
      stderr: true,
    })
    let settled = false
    const finish = (r: { status: 'over' } | { status: 'error'; error: string } | { status: 'message'; m: WorkerMessage }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(r)
    }
    let timer = setTimeout(() => {
      finish({ status: 'error', error: 'modules did not load' })
    }, LOAD_LIMIT_MS)
    worker.on('message', (m: WorkerMessage) => {
      if (m.ready === true) {
        clearTimeout(timer)
        timer = setTimeout(() => {
          finish({ status: 'over' })
        }, budgetMs)
        return
      }
      if (m.done !== true) finish({ status: 'error', error: m.error ?? 'unknown' })
      else finish({ status: 'message', m })
    })
    worker.on('error', (e: Error) => {
      finish({ status: 'error', error: `${e.name}: ${e.message}` })
    })
    worker.on('exit', (code) => {
      finish({ status: 'error', error: `worker exited with code ${String(code)}` })
    })
  })
}

/** Reads the bytes through createSheetsReader in a worker; a read still running at the budget is stopped. */
export async function readInWorker(bytes: Uint8Array, budgetMs: number, fileName = 'budget (Test).xlsx'): Promise<WorkerRead> {
  const r = await runWorker({ job: 'read', bytes, fileName }, budgetMs)
  if (r.status !== 'message') return r
  return r.m.ok === true ? { status: 'done', ok: true, cells: r.m.cells ?? {} } : { status: 'done', ok: false, reason: r.m.reason ?? '' }
}

/** Runs snapSums over cells built in memory in a worker (default limit unless one is given); a hang is stopped at the budget. */
export async function snapInWorker(cells: Cell[], budgetMs: number, limit?: number): Promise<WorkerSnap> {
  const r = await runWorker(limit === undefined ? { job: 'snap', cells } : { job: 'snap', cells, limit }, budgetMs)
  if (r.status !== 'message') return r
  return r.m.snap ? { status: 'done', snap: r.m.snap } : { status: 'error', error: 'no snap result' }
}

/** A fixed stream of whole cents up to 1e6 (10,000 dollars), mixed sign. */
export function centStream(seed: number, count: number): number[] {
  let state = seed
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0
    out.push((state % 2_000_001) - 1_000_000)
  }
  return out
}
