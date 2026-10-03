// Planted (SC4 R69, cents-to-text): a SUM snap that adds the terms as doubles and prints two decimals. From 1e13 up the
// double sum is not the exact cent total: 572223582302257.9 + 891.67 reads "572223582303149.50" (exact .57).
export function derive(cells) {
  const texts = new Map(cells.map((c) => [c.ref, ownText(Number(c.v))]))
  for (const c of cells) {
    const found = c.f === undefined ? null : /^SUM\(A(\d+):A(\d+)\)$/.exec(c.f)
    if (!found) continue
    let total = 0
    for (let r = Number(found[1]); r <= Number(found[2]); r += 1) total += Number(texts.get(`A${String(r)}`))
    texts.set(c.ref, total.toFixed(2))
  }
  return texts
}

// A cell's own text, as A07 reads a lone number: the cent amount when the double is within 4 ulps of one.
export function ownText(x) {
  const cents = Math.round(x * 100) / 100
  if (cents === 0) return String(x)
  const e = Math.floor(Math.log2(Math.abs(x)))
  return Math.abs(x - cents) <= Math.min(0.0025, 4 * 2 ** (e - 52)) ? String(cents) : String(x)
}

// Clean twin: the total keeps its own text.
export function cleanDerive(cells) {
  return new Map(cells.map((c) => [c.ref, ownText(Number(c.v))]))
}
