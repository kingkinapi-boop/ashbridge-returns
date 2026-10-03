// SC4 R68 fixtures (spec-writer): sheet layouts of nested SUMs and reference cycles, placed on the grid in many ways.
// A layout is logical: cells at (row, col) on a small grid, SUMs over rectangles, cached values fixed once from the
// logical structure. `place` moves the same layout by one of the eight symmetries of the rectangle and an offset, so
// only where the cells sit (and so the order a reader visits them) changes, never what they hold.
import { address } from './xlsx.mjs'

/**
 * Cells: `{ name?, at: [r, c], num?: string }` for a number, `{ name, at, sum: [[r1, c1], [r2, c2]], cached }` for a SUM,
 * `{ name, at, refTo: [r, c], suffix, cached }` for another formula that refers to one cell (`A1*1`). Returns the cells
 * as `{ ref, f?, v }` and each named cell's address.
 */
export function place(layout, { sym, dr, dc }) {
  const transpose = (sym & 1) !== 0
  const flipRows = (sym & 2) !== 0
  const flipCols = (sym & 4) !== 0
  const rows = transpose ? layout.cols : layout.rows
  const cols = transpose ? layout.rows : layout.cols
  const move = ([r0, c0]) => {
    let [r, c] = transpose ? [c0, r0] : [r0, c0]
    if (flipRows) r = rows + 1 - r
    if (flipCols) c = cols + 1 - c
    return [r + dr, c + dc]
  }
  const ref = (p) => {
    const [r, c] = move(p)
    return address(r, c)
  }
  const area = (a, b) => {
    const [r1, c1] = move(a)
    const [r2, c2] = move(b)
    return `${address(Math.min(r1, r2), Math.min(c1, c2))}:${address(Math.max(r1, r2), Math.max(c1, c2))}`
  }
  const nodes = {}
  const cells = layout.cells.map((cell) => {
    const at = ref(cell.at)
    if (cell.name !== undefined) nodes[cell.name] = at
    if (cell.sum !== undefined) return { ref: at, f: `SUM(${area(cell.sum[0], cell.sum[1])})`, v: cell.cached }
    if (cell.refTo !== undefined) return { ref: at, f: `${ref(cell.refTo)}${cell.suffix}`, v: cell.cached }
    return { ref: at, v: cell.num }
  })
  return { cells, nodes }
}

/** The text Excel stores for a double: its shortest round-trip text, exponent in capitals. */
export const stored = (x) => String(x).replace('e', 'E')
const floatSum = (xs) => xs.reduce((a, b) => a + b, 0)

/**
 * A chain of `depth` nested SUMs (N0 the outermost). Node k sits in column H of row rho[k]; its range is row rho[k+1],
 * columns B to H: the six terms in B to G and node k+1 in H (the last node's range stops at G). `rho` is a permutation
 * of 1..depth+1, so the outer total can sit above, below or between the inner ones. Cached values come from the logical
 * chain (terms then the inner total, left to right), the same whatever rho is.
 */
export function nestedChain(terms, depth, rho) {
  const cells = []
  const cached = new Array(depth)
  for (let k = depth - 1; k >= 0; k--) cached[k] = floatSum(terms.map(Number)) + (k + 1 < depth ? cached[k + 1] : 0)
  for (let k = 0; k < depth; k++) {
    const row = rho[k + 1]
    terms.forEach((t, i) => cells.push({ at: [row, 2 + i], num: t }))
    const last = k + 1 === depth ? 1 + terms.length : 2 + terms.length
    cells.push({ name: `N${String(k)}`, at: [rho[k], 2 + terms.length], sum: [[row, 2], [row, last]], cached: stored(cached[k]) })
  }
  return { rows: depth + 1, cols: 2 + terms.length, cells }
}

/**
 * Reference cycles, each with the members a reader must find. A member whose range also holds the six terms has a
 * cached value in the window where only a sum snap would change its text, so a member the reader misses shows.
 *  - joined: X = SUM(Y:Z), Y = SUM(X:X), Z = SUM over Y and the terms (Y's row). A depth-first walk from X finishes Y first and
 *    then meets Z, which joins the cycle through the finished Y (A07D Opus read item 2).
 *  - non-sum: X = SUM over Y and the terms, Y = X*1 (the cycle runs through a formula that is not a SUM).
 *  - self: X = SUM over itself and the terms.
 *  - pair: X = SUM over Y and the terms, Y = SUM(X:X).
 */
export function cycles(terms) {
  const n = terms.length
  const termCells = (row, from) => terms.map((t, i) => ({ at: [row, from + i], num: t }))
  const withTerms = stored(0 + floatSum(terms.map(Number)))
  return {
    joined: {
      members: ['X', 'Y', 'Z'],
      layout: {
        rows: 3,
        cols: 1 + n,
        cells: [
          { name: 'X', at: [1, 1], sum: [[2, 1], [3, 1]], cached: '0' },
          { name: 'Y', at: [2, 1], sum: [[1, 1], [1, 1]], cached: '0' },
          ...termCells(2, 2),
          { name: 'Z', at: [3, 1], sum: [[2, 1], [2, 1 + n]], cached: withTerms },
        ],
      },
    },
    'non-sum': {
      members: ['X', 'Y'],
      layout: {
        rows: 2,
        cols: 1 + n,
        cells: [
          { name: 'X', at: [1, 1], sum: [[2, 1], [2, 1 + n]], cached: withTerms },
          { name: 'Y', at: [2, 1], refTo: [1, 1], suffix: '*1', cached: '0' },
          ...termCells(2, 2),
        ],
      },
    },
    self: {
      members: ['X'],
      layout: { rows: 1, cols: 1 + n, cells: [{ name: 'X', at: [1, 1], sum: [[1, 1], [1, 1 + n]], cached: withTerms }, ...termCells(1, 2)] },
    },
    pair: {
      members: ['X', 'Y'],
      layout: {
        rows: 2,
        cols: 1 + n,
        cells: [{ name: 'X', at: [1, 1], sum: [[2, 1], [2, 1 + n]], cached: withTerms }, { name: 'Y', at: [2, 1], sum: [[1, 1], [1, 1]], cached: '0' }, ...termCells(2, 2)],
      },
    },
  }
}
