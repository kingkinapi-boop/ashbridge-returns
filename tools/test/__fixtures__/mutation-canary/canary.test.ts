import { expect, test } from 'vitest'
import { sign } from './canary'

test('ARC-15 canary: sign kills every mutant', () => {
  expect(sign(-5)).toBe(-1)
  expect(sign(-1)).toBe(-1)
  expect(sign(0)).toBe(0)
  expect(sign(1)).toBe(1)
  expect(sign(5)).toBe(1)
})
