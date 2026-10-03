// Builder unit tests for the strict converter in src/core/money.ts: exact values and exact refusal reasons.
import { describe, expect, test } from 'vitest'
import { centsToDecimal, decimalToCents } from '../../src/core/money'

const refused = (s: string): string => {
  const r = decimalToCents(s)
  if (r.ok) throw new Error(`expected a refusal for ${JSON.stringify(s)}`)
  return r.reason
}

const NOT_DECIMAL = (s: string): string =>
  `"${s}" is not a decimal amount of dollars (digits, an optional "-", at most two decimals)`

describe('decimalToCents', () => {
  test('ARC-13 accepts whole, one-decimal and two-decimal amounts exactly', () => {
    expect(decimalToCents('12')).toEqual({ ok: true, cents: 1200 })
    expect(decimalToCents('-1234.5')).toEqual({ ok: true, cents: -123450 })
    expect(decimalToCents('0.29')).toEqual({ ok: true, cents: 29 })
    expect(decimalToCents('0.05')).toEqual({ ok: true, cents: 5 })
    expect(decimalToCents('-0.05')).toEqual({ ok: true, cents: -5 })
  })

  test('ARC-13 zero is positive zero', () => {
    const r = decimalToCents('-0.00')
    expect(r).toEqual({ ok: true, cents: 0 })
    expect(r.ok && Object.is(r.cents, 0)).toBe(true)
  })

  test('ARC-13 an amount too large for exact cents is refused with its text', () => {
    expect(decimalToCents('90071992547409.91')).toEqual({ ok: true, cents: 9007199254740991 })
    expect(refused('90071992547409.92')).toBe('"90071992547409.92" is too large to hold exactly in cents')
    expect(refused('-90071992547409.92')).toBe('"-90071992547409.92" is too large to hold exactly in cents')
  })

  test('ARC-13 a blank is refused as blank', () => {
    expect(refused('')).toBe('an amount cannot be blank')
    expect(refused('   ')).toBe('an amount cannot be blank')
  })

  test('ARC-13 a thousands separator is refused as such', () => {
    const msg = (s: string): string => `"${s}" has a thousands separator; amounts carry none`
    expect(refused('1,234')).toBe(msg('1,234'))
    expect(refused('-1,234.56')).toBe(msg('-1,234.56'))
    expect(refused('1,5')).toBe(msg('1,5'))
    expect(refused('1,234.567')).toBe(msg('1,234.567'))
  })

  test('ARC-13 exponent notation is refused as such', () => {
    const msg = (s: string): string => `"${s}" is in exponent notation; amounts are written in full`
    expect(refused('1e5')).toBe(msg('1e5'))
    expect(refused('1.5E3')).toBe(msg('1.5E3'))
    expect(refused('e5')).toBe(msg('e5'))
  })

  test('ARC-13 letters without both an e and a digit are plain non-decimals', () => {
    expect(refused('e')).toBe(NOT_DECIMAL('e'))
    expect(refused('abc5')).toBe(NOT_DECIMAL('abc5'))
    expect(refused('abc')).toBe(NOT_DECIMAL('abc'))
    expect(refused('5.')).toBe(NOT_DECIMAL('5.'))
    expect(refused('.5')).toBe(NOT_DECIMAL('.5'))
  })

  test('ARC-13 three or more decimals are refused as such', () => {
    const msg = (s: string): string => `"${s}" has more than two decimals; cents are the smallest unit`
    expect(refused('1.234')).toBe(msg('1.234'))
    expect(refused('-1.234')).toBe(msg('-1.234'))
    expect(refused('12.3456')).toBe(msg('12.3456'))
  })

  test('ARC-13 the three-decimal rule is anchored at both ends', () => {
    expect(refused('a1.234')).toBe(NOT_DECIMAL('a1.234'))
    expect(refused('1.234x')).toBe(NOT_DECIMAL('1.234x'))
    expect(refused('1.2x34')).toBe(NOT_DECIMAL('1.2x34'))
    expect(refused('1.')).toBe(NOT_DECIMAL('1.'))
  })

  test('ARC-13 a plus sign, a space or a second minus is not a decimal', () => {
    expect(refused('+5')).toBe(NOT_DECIMAL('+5'))
    expect(refused(' 5')).toBe(NOT_DECIMAL(' 5'))
    expect(refused('--5')).toBe(NOT_DECIMAL('--5'))
  })
})

describe('centsToDecimal', () => {
  test('ARC-13 writes exactly two decimals and a leading minus', () => {
    expect(centsToDecimal(1234)).toBe('12.34')
    expect(centsToDecimal(-5)).toBe('-0.05')
    expect(centsToDecimal(0)).toBe('0.00')
    expect(centsToDecimal(1200)).toBe('12.00')
  })

  test('ARC-13 refuses a non-integer or unsafe number with its text', () => {
    expect(() => centsToDecimal(1.5)).toThrow(new Error('1.5 is not a whole number of cents'))
    expect(() => centsToDecimal(Number.NaN)).toThrow(new Error('NaN is not a whole number of cents'))
    expect(() => centsToDecimal(2 ** 53)).toThrow(new Error('9007199254740992 is not a whole number of cents'))
  })
})
