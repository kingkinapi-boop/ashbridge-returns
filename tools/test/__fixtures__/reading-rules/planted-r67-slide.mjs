// Planted (SC4 R67): a shared-formula slider that rewrites formula text with a regex instead of a tokenizer. It slides
// inside quoted sheet names ('Q4 FY2026'!B1 becomes 'Q5 FY2027'!B2), inside strings, and skips whole columns and rows.
const col = (l) => Array.from(l).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const letters = (n) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}

export function slide(formula, from, to) {
  const a = /^([A-Z]+)(\d+)$/.exec(from)
  const b = /^([A-Z]+)(\d+)$/.exec(to)
  const dc = col(b[1]) - col(a[1])
  const dr = Number(b[2]) - Number(a[2])
  return formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (_m, ca, c, ra, r) => {
    const cc = ca ? c : letters(col(c) + dc)
    const rr = ra ? r : String(Number(r) + dr)
    return `${ca}${cc}${ra}${rr}`
  })
}
