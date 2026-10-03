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
  // + 0 turns -0 into 0, so an amount of zero never prints or compares as negative.
  return Math.sign(c) * dollars + 0
}

export function formatCents(c: Cents): string {
  cents(c)
  const abs = Math.abs(c)
  const text = `${Math.floor(abs / 100).toString()}.${(abs % 100).toString().padStart(2, '0')}`
  return c < 0 ? `-${text}` : text
}

// The one strict converter between decimal text and cents (ARC-13, A353): no floating point, no thousands separator,
// at most two decimals.
export type CentsResult = { ok: true; cents: number } | { ok: false; reason: string }

const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/

/** Turns a decimal string of dollars ("-1234.5", "0.29", "12") into integer cents, or says why it cannot. */
export function decimalToCents(s: string): CentsResult {
  const m = DECIMAL.exec(s)
  if (m === null) return { ok: false, reason: refusalReason(s) }
  // Stryker disable next-line StringLiteral: groups 1 and 2 always match (the regex cannot match without them), so their defaults are never used
  const [, sign = '', whole = '0', frac = ''] = m
  const abs = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'))
  const cents = Number(sign === '-' ? -abs : abs)
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: `"${s}" is too large to hold exactly in cents` }
  // Stryker disable next-line ArithmeticOperator: -abs of 0n is 0n (BigInt has no negative zero), so + 0 and - 0 are both no-ops
  return { ok: true, cents: cents + 0 }
}

function refusalReason(s: string): string {
  if (s.trim() === '') return 'an amount cannot be blank'
  // Stryker disable next-line Regex: the regex only matches text that includes(','), so any change to it leaves the result unchanged
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) || s.includes(',')) return `"${s}" has a thousands separator; amounts carry none`
  if (/[eE]/.test(s) && /\d/.test(s)) return `"${s}" is in exponent notation; amounts are written in full`
  if (/^-?\d+\.\d{3,}$/.test(s)) return `"${s}" has more than two decimals; cents are the smallest unit`
  return `"${s}" is not a decimal amount of dollars (digits, an optional "-", at most two decimals)`
}

/** The canonical decimal text of a whole number of cents: "-0.05", "12.00". Throws on anything that is not a safe integer. */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error(`${String(cents)} is not a whole number of cents`)
  const abs = BigInt(Math.abs(cents))
  const text = `${(abs / 100n).toString()}.${(abs % 100n).toString().padStart(2, '0')}`
  return cents < 0 ? `-${text}` : text
}
