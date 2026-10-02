// Money is integer cents everywhere (ARC-13). The one converter between decimal text and cents: no floating point.

export type CentsResult = { ok: true; cents: number } | { ok: false; reason: string }

const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/

/** Turns a decimal string of dollars ("-1234.5", "0.29", "12") into integer cents, or says why it cannot. */
export function decimalToCents(s: string): CentsResult {
  const m = DECIMAL.exec(s)
  if (m === null) return { ok: false, reason: refusalReason(s) }
  const [, sign = '', whole = '0', frac = ''] = m
  const abs = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'))
  const cents = Number(sign === '-' ? -abs : abs)
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: `"${s}" is too large to hold exactly in cents` }
  return { ok: true, cents: cents + 0 }
}

function refusalReason(s: string): string {
  if (s.trim() === '') return 'an amount cannot be blank'
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

/** A JSON dollar figure (a number written with at most two decimals) to cents, through its text, never by multiplying. */
export function dollarsToCents(x: number): CentsResult {
  return decimalToCents(String(x))
}
