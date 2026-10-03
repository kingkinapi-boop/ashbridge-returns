// Planted (SC4 R74): a SUM-range walker bounded by the area the formula names, not by the cells that exist. Over
// A1:XFD1048576 it looks up 1.7e10 addresses, so it never finishes inside any budget.
const SUM_RANGE = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/
const col = (l) => Array.from(l).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)

function walk(formula, cells, bounded) {
  const m = SUM_RANGE.exec(formula)
  let found = 0
  if (bounded) {
    for (const [r, c] of cells.keys().map((k) => k.split(':').map(Number))) {
      if (r >= Number(m[2]) && r <= Number(m[4]) && c >= col(m[1]) && c <= col(m[3])) found++
    }
    return found
  }
  for (let r = Number(m[2]); r <= Number(m[4]); r++) {
    for (let c = col(m[1]); c <= col(m[3]); c++) if (cells.has(`${String(r)}:${String(c)}`)) found++
  }
  return found
}

const WHOLE_SHEET = { formula: 'SUM(A2:XFD1048576)', cells: new Map([['2:1', 1], ['3:1', 2], ['4:1', 3]]) }

/** The planted walker on the whole-sheet case. */
export function run(caseName) {
  if (caseName !== 'whole-sheet-range') return { skipped: caseName }
  return { terms: walk(WHOLE_SHEET.formula, WHOLE_SHEET.cells, false) }
}

/** Clean twin: the same walk over the cells that exist. */
export function runBounded(caseName) {
  if (caseName !== 'whole-sheet-range') return { skipped: caseName }
  return { terms: walk(WHOLE_SHEET.formula, WHOLE_SHEET.cells, true) }
}
