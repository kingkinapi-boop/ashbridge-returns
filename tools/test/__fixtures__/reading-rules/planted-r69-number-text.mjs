// Planted (SC4 R69): number text that never uses exponent form, so from 1e21 up it expands the double through BigInt
// and invents digits: 1e23 reads "99999999999999991611392".
export function numberText(x) {
  return Math.abs(x) < 1e21 ? String(x) : BigInt(x).toString()
}

// Clean twin: the shortest round-trip text everywhere.
export function cleanNumberText(x) {
  return String(x)
}
