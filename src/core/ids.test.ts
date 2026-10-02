import { afterEach, expect, test } from 'vitest'
import { fixedClock, setClock, systemClock } from './clock'
import { newId, resetIdRandom, setIdRandom } from './ids'

afterEach(() => {
  resetIdRandom()
  setClock(systemClock)
})

test('ARC-16 the real random source is the default: ids on one pinned millisecond differ in the random part and are hex', () => {
  setClock(fixedClock('2026-05-01T00:00:00.000Z'))
  const tails = new Set(Array.from({ length: 20 }, () => newId().slice(16)))
  expect(tails.size).toBeGreaterThan(1)
  for (const t of tails) expect(t).toMatch(/^[0-9a-f]{8}$/)
})

test('ARC-16 resetIdRandom puts the real source back after a pinned one', () => {
  setClock(fixedClock('2026-05-01T00:00:00.000Z'))
  setIdRandom(() => Uint8Array.from([1, 2, 3, 4]))
  expect(newId().slice(16)).toBe('01020304')
  resetIdRandom()
  const tails = new Set(Array.from({ length: 20 }, () => newId().slice(16)))
  expect(tails.size).toBeGreaterThan(1)
})
