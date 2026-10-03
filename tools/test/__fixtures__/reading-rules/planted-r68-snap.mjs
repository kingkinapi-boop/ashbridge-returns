// Planted (SC4 R68): a SUM snap that visits cells row by row (the A07C shape). An outer total above its inner total
// sees the inner one's unsnapped text, so it is never snapped; the same sheet with the rows the other way round is.
const CENT_TEXT = /^-?\d+(?:\.\d{1,2})?$/
const SUM_RANGE = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/
const col = (l) => Array.from(l).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const pos = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  return { row: Number(m[2]), col: col(m[1]) }
}
const cents = (text) => {
  const [whole, frac = ''] = text.replace('-', '').split('.')
  const n = BigInt(`${whole}${frac.padEnd(2, '0')}`)
  return text.startsWith('-') ? -n : n
}

/** Cells `{ ref, f?, v }` to each cell's text, snapping SUMs in row-major order. */
export function derive(cells) {
  const sorted = [...cells].sort((a, b) => pos(a.ref).row - pos(b.ref).row || pos(a.ref).col - pos(b.ref).col)
  const text = new Map(sorted.map((c) => [c.ref, String(Number(c.v))]))
  for (const c of sorted) {
    const m = c.f === undefined ? null : SUM_RANGE.exec(c.f)
    if (!m) continue
    const terms = sorted.filter((t) => {
      const p = pos(t.ref)
      return p.row >= Number(m[2]) && p.row <= Number(m[4]) && p.col >= col(m[1]) && p.col <= col(m[3])
    })
    if (!terms.every((t) => CENT_TEXT.test(text.get(t.ref)))) continue
    const total = terms.reduce((s, t) => s + cents(text.get(t.ref)), 0n)
    if (Math.abs(Number(c.v) - Number(total) / 100) < 1e-6) text.set(c.ref, String(Number(total) / 100))
  }
  return text
}
