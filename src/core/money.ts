// @mutate
// Money is integer cents (ARC-13). Formatting happens only at the edge.
export type Cents = number

export function cents(n: number): Cents {
  if (!Number.isSafeInteger(n)) throw new RangeError('cents must be a safe integer')
  return n
}

export function addCents(...parts: Cents[]): Cents {
  // Summed exactly (BigInt): a float running total can pass the safe range and hide an overflow.
  let total = 0n
  for (const p of parts) total += BigInt(cents(p))
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('cents must be a safe integer')
  }
  return Number(total)
}

// The one written rounding rule: halves round away from zero.
// GIFI reports whole dollars, so cents become dollars with this rule.
export function roundCentsToDollars(c: Cents): number {
  cents(c)
  const abs = Math.abs(c)
  const dollars = Math.floor(abs / 100) + (abs % 100 >= 50 ? 1 : 0)
  return dollars === 0 ? 0 : c < 0 ? -dollars : dollars
}

export function formatCents(c: Cents): string {
  cents(c)
  const abs = Math.abs(c)
  const text = `${Math.floor(abs / 100).toString()}.${(abs % 100).toString().padStart(2, '0')}`
  return c < 0 ? `-${text}` : text
}
