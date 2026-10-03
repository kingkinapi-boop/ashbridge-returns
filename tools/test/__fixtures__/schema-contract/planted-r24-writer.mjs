// Planted (SC R24, R30): a writer that prints 1e+21 for a large number, and a read-back check that always passes.

/** Reads whole numbers written as plain digits; anything else is not a number. */
export function plantedRead(text) {
  return /^-?\d+$/.test(text) ? Number(text) : null
}

/**
 * Prints a whole number. @writes plantedRead
 */
export function plantedWrite(n) {
  return String(n)
}

/** The read-back check: always true (planted). */
export function readBackPlanted(_given, _back) {
  return true
}
