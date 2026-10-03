// FX4 test fixtures (spec-writer): sparse one-sheet workbooks (only rows that hold cells are written, so a cell at
// XFD1048576 costs one row), random SUM graphs with reference cycles and their strongly connected components computed
// here (an oracle that shares no code with the reader), and the six planted cent terms.
import { rawXlsx } from './harness'
import { address, parseAddress, stored, xmlText } from './a07d'

/** The sheet every rawXlsx workbook holds. */
export const CELLS_SHEET = 'Cells (Test)'

/** The six terms of the A07B check's planted sum; their floating-point sum is 253914.87999999803. */
export const PLANTED = [-7335624.99, 2860106.52, -2434451.58, 8522880.37, 4815622.56, -6174618]
export const floatSum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

/** The cent amount n/100 as the reader writes a snapped total: the shortest text of the nearest double. */
export const cellCents = (n: bigint): string => String(Number(n) / 100)
/** Exact cents of a cent-amount text ("-12.5" is -1250n). */
export function textCents(text: string): bigint {
  const found = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!found) throw new Error(`not a cent amount: ${text}`)
  const cents = BigInt(`${found[2] as string}${(found[3] ?? '').padEnd(2, '0')}`)
  return found[1] === '-' ? -cents : cents
}
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

/**
 * A one-sheet workbook ("Cells (Test)") from cell bodies by address (what follows `<c r=".."`), rows written in order and
 * only where a cell sits; `merges` are written as the sheet's <mergeCells>.
 */
export function sparseXlsx(cells: Map<string, string>, merges: string[] = []): Uint8Array {
  const byRow = new Map<number, [number, string][]>()
  for (const [at, body] of cells) {
    const [column, row] = parseAddress(at)
    const list = byRow.get(row) ?? []
    list.push([column, `<c r="${at}"${body}`])
    byRow.set(row, list)
  }
  const sheetData = [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([row, list]) =>
        `<row r="${String(row)}">${list
          .sort((a, b) => a[0] - b[0])
          .map(([, xml]) => xml)
          .join('')}</row>`,
    )
    .join('')
  const after = merges.length > 0 ? `<mergeCells count="${String(merges.length)}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''
  return rawXlsx({ sheetData, after })
}

// ------------------------------------------------------------------------------------------------- SUM graphs (item 2)

/**
 * One node of a SUM graph, at A<row>. A `sum` node is SUM(A<lo>:A<hi>) over other nodes, or SUM(A<lo>:G<hi>) when
 * `withTerms` (every node row holds the six planted terms in B to G). A `ref` node is `A<target>*1`, a formula that is not a SUM.
 */
export type GraphNode = { kind: 'sum'; lo: number; hi: number; withTerms: boolean } | { kind: 'ref'; target: number }

/** The rows each node refers to (its out-edges), by node row. */
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
export const formulaOf = (n: GraphNode): string =>
  n.kind === 'ref' ? `A${String(n.target)}*1` : `SUM(A${String(n.lo)}:${n.withTerms ? 'G' : 'A'}${String(n.hi)})`

/**
 * The sheet of a graph: the nodes in A1..An, the six planted terms in B to G of every node row. Cached values are what a
 * spreadsheet that gave up on its cycles might leave: every node counts as 0, so a SUM with terms caches the
 * floating-point sum, in range order (row by row), of the planted terms in its rows (noise only a snap would change),
 * and every other node caches 0. A member a reader misses then shows: its terms read "0" or as stored, so it snaps.
 */
export function graphSheet(nodes: GraphNode[]): { cells: Map<string, string>; cached: number[] } {
  const cached = nodes.map((n) => {
    if (n.kind === 'ref' || !n.withTerms) return 0
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
