// CQ12 fixture: tests that assert nothing. Run only by test-assertions.acceptance.test.ts under each project's setup.
import { expect, test } from 'vitest'

test('CQ12 fixture: a test body with no assertion', () => {
  const value = 1 + 1
  String(value)
})

test.each([1, 2])('CQ12 fixture: an each-case with no assertion %d', (n) => {
  String(n)
})

test('CQ12 fixture: an assertion only in a callback that never runs', () => {
  const never = (): void => {
    expect(1).toBe(1)
  }
  String(never)
})
