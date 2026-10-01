import { expect, test } from 'vitest'
import { clampCents } from './canary'

test('ARC-15 canary: clampCents kills every mutant', () => {
  expect(clampCents(-1, 10)).toBe(0)
  expect(clampCents(0, 10)).toBe(0)
  expect(clampCents(1, 10)).toBe(1)
  expect(clampCents(10, 10)).toBe(10)
  expect(clampCents(11, 10)).toBe(10)
})
