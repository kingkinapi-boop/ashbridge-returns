// F00T (spec job): money.ts tests by a worker who did not build it (reviews/REVIEW.md 2 Oct 01:50Z, findings 1 and 2).
// Every survivor of reports/F00T-mutants.md for money.ts is killed here or classed equivalent there.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { addCents, cents, formatCents, roundCentsToDollars } from './money'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const MAX = Number.MAX_SAFE_INTEGER
const NOT_SAFE: readonly number[] = [0.5, -1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, MAX + 1, -(MAX + 1), 2 ** 60]

/** Every safe integer, with -0 and the edges weighted in. */
const anyCents = fc.oneof(fc.maxSafeInteger(), fc.constantFrom(0, -0, 1, -1, 49, 50, -50, 149, 150, -150, MAX, -MAX))

/** The exact text of `c` cents, computed with BigInt (never through a float). */
function exactText(c: number): string {
  const b = BigInt(Object.is(c, -0) ? 0 : c)
  const abs = b < 0n ? -b : b
  const whole = (abs / 100n).toString()
  const rest = (abs % 100n).toString().padStart(2, '0')
  return `${b < 0n ? '-' : ''}${whole}.${rest}`
}

describe('F00T money.ts (ARC-13)', () => {
  test('ARC-13 cents refuses a non-safe integer with its reason', () => {
    for (const n of NOT_SAFE) {
      expect(() => cents(n), String(n)).toThrow(RangeError)
      expect(() => cents(n), String(n)).toThrow('cents must be a safe integer')
    }
    expect(cents(MAX)).toBe(MAX)
    expect(cents(-MAX)).toBe(-MAX)
  })

  test('ARC-13 every entry point refuses a non-safe integer (addCents, roundCentsToDollars, formatCents)', () => {
    for (const n of NOT_SAFE) {
      expect(() => addCents(n), `addCents(${String(n)})`).toThrow('cents must be a safe integer')
      expect(() => addCents(1, n), `addCents(1, ${String(n)})`).toThrow('cents must be a safe integer')
      expect(() => roundCentsToDollars(n), `roundCentsToDollars(${String(n)})`).toThrow('cents must be a safe integer')
      expect(() => formatCents(n), `formatCents(${String(n)})`).toThrow('cents must be a safe integer')
    }
  })

  test('ARC-13 addCents examples: sums in integer cents, empty is 0', () => {
    expect(addCents(10, 20, 5)).toBe(35)
    expect(addCents()).toBe(0)
    expect(addCents(-1205, 1205)).toBe(0)
    expect(addCents(MAX)).toBe(MAX)
  })

  test('ARC-13 addCents refuses a total that is not a safe integer', () => {
    expect(() => addCents(MAX, 1)).toThrow('cents must be a safe integer')
    expect(() => addCents(-MAX, -1)).toThrow('cents must be a safe integer')
    // counterexample found by the seed 20261002 property on main: a float running total hides the overflow
    expect(() => addCents(MAX, 50, -49)).toThrow('cents must be a safe integer')
  })

  test('ARC-13 addCents is exact when a running total passes the safe range but the sum does not (counterexample)', () => {
    // A float running total rounds 2^53 + 1 to 2^53, so a naive loop returns MAX - 1 here.
    expect(addCents(MAX, 2, -2)).toBe(MAX)
    expect(addCents(-MAX, -2, 2)).toBe(-MAX)
    expect(addCents(MAX, MAX, -MAX)).toBe(MAX)
  })

  test('ARC-13 property (seed 20261002): addCents gives the exact sum, or refuses when the exact sum is not safe', () => {
    fc.assert(
      fc.property(fc.array(anyCents, { maxLength: 8 }), (xs) => {
        const exact = xs.reduce((a, b) => a + BigInt(b), 0n)
        if (exact > BigInt(MAX) || exact < BigInt(-MAX)) {
          expect(() => addCents(...xs)).toThrow('cents must be a safe integer')
        } else {
          expect(BigInt(addCents(...xs))).toBe(exact)
        }
      }),
      { seed: 20261002, numRuns: 500 },
    )
  })

  test('ARC-13 property (seed 20261003): sums of everyday amounts stay exact and order does not matter', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1e12, max: 1e12 }), { maxLength: 30 }), (xs) => {
        const total = addCents(...xs)
        expect(total).toBe(xs.reduce((a, b) => a + b, 0))
        expect(addCents(...[...xs].reverse())).toBe(total)
      }),
      { seed: 20261003, numRuns: 300 },
    )
  })

  test('ARC-13 rounding rule examples: halves away from zero, to whole dollars, never -0', () => {
    expect(roundCentsToDollars(149)).toBe(1)
    expect(roundCentsToDollars(150)).toBe(2)
    expect(roundCentsToDollars(-149)).toBe(-1)
    expect(roundCentsToDollars(-150)).toBe(-2)
    expect(roundCentsToDollars(50)).toBe(1)
    expect(roundCentsToDollars(-50)).toBe(-1)
    expect(roundCentsToDollars(250)).toBe(3)
    expect(roundCentsToDollars(-250)).toBe(-3)
    expect(roundCentsToDollars(100)).toBe(1)
    expect(roundCentsToDollars(-100)).toBe(-1)
    for (const c of [0, -0, 1, -1, 49, -49]) expect(Object.is(roundCentsToDollars(c), 0), `roundCentsToDollars(${String(c)}) is +0`).toBe(true)
  })

  test('ARC-13 property (seed 20261004): roundCentsToDollars rounds half away from zero, is odd-symmetric and never gives -0', () => {
    fc.assert(
      fc.property(anyCents, (c) => {
        const d = roundCentsToDollars(c)
        expect(Number.isSafeInteger(d)).toBe(true)
        expect(Object.is(d, -0)).toBe(false)
        // exact expectation with BigInt: halves away from zero
        const b = BigInt(Object.is(c, -0) ? 0 : c)
        const abs = b < 0n ? -b : b
        const absDollars = abs / 100n + (abs % 100n >= 50n ? 1n : 0n)
        const expected = b < 0n ? -absDollars : absDollars
        expect(BigInt(d)).toBe(expected)
        const mirrored = roundCentsToDollars(-c)
        expect(Object.is(mirrored, -0)).toBe(false)
        expect(mirrored).toBe(d === 0 ? 0 : -d)
      }),
      { seed: 20261004, numRuns: 500 },
    )
  })

  test('ARC-13 formatCents(0) and formatCents(-0) print "0.00" (survivor money.ts:29 c <= 0)', () => {
    expect(formatCents(0)).toBe('0.00')
    expect(formatCents(-0)).toBe('0.00')
  })

  test('ARC-13 formatCents examples: a sign only below zero, two decimals', () => {
    expect(formatCents(5)).toBe('0.05')
    expect(formatCents(-5)).toBe('-0.05')
    expect(formatCents(100)).toBe('1.00')
    expect(formatCents(1205)).toBe('12.05')
    expect(formatCents(-1205)).toBe('-12.05')
    expect(formatCents(123456789)).toBe('1234567.89')
    expect(formatCents(MAX)).toBe('90071992547409.91')
    expect(formatCents(-MAX)).toBe('-90071992547409.91')
  })

  test('ARC-13 property (seed 20261005): formatCents is the exact decimal of the cents and never prints "-0.00"', () => {
    fc.assert(
      fc.property(anyCents, (c) => {
        const text = formatCents(c)
        expect(text).toMatch(/^-?\d+\.\d{2}$/)
        expect(text).not.toBe('-0.00')
        expect(text).toBe(exactText(c))
      }),
      { seed: 20261005, numRuns: 500 },
    )
  })

  test('ARC-15 money.ts is a mutation target (// @mutate in its first 5 lines)', () => {
    const head = fs.readFileSync(path.join(ROOT, 'src', 'core', 'money.ts'), 'utf8').split('\n').slice(0, 5).join('\n')
    expect(head).toMatch(/\/\/ @mutate/)
  })
})
