// CQ12 fixture: tests that each make at least one assertion. Run only by test-assertions.acceptance.test.ts.
import { expect, test } from 'vitest'

test('CQ12 fixture: a test body with one assertion', () => {
  expect(1 + 1).toBe(2)
})

test('CQ12 fixture: an async test body with one assertion', async () => {
  await Promise.resolve()
  expect(await Promise.resolve('a')).toBe('a')
})

test('CQ12 fixture: expect.assertions(1) with one assertion', () => {
  expect.assertions(1)
  expect(true).toBe(true)
})
