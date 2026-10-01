import { expect, test } from 'vitest'
import { normaliseAmount } from './reading'

test('EV-6 two sign marks are refused', () => {
  expect(normaliseAmount('(-5.00)').ok).toBe(false)
  expect(normaliseAmount('5.00 CR-').ok).toBe(false)
})

test('EV-6 one decimal digit reads as tenths and three digits are refused', () => {
  expect(normaliseAmount('1,234.5')).toEqual({ ok: true, cents: 123450 })
  expect(normaliseAmount('1.234').ok).toBe(false)
})

test('EV-6 badly grouped commas are refused', () => {
  expect(normaliseAmount('12,34.00').ok).toBe(false)
})
