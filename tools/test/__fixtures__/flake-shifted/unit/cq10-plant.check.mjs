// CQ10 planted date-dependent tests (the A04 shape, A469). CQ10_FIXED is a fixed instant handed in by the
// test that starts the script: the real date, read from a fresh file's mtime (the OS clock, which no date
// shim moves). Each test below names the runs in which its result differs from the unshifted run.
import { describe, expect, test } from 'vitest'

const DAY = 86_400_000
const FIXED = Date.parse(process.env['CQ10_FIXED'] ?? '')
// Read when the file loads: the shift must already be in place before any test file loads.
const LOADED_AT = Date.now()

describe('cq10 plant', () => {
  test('a04 shape: a fixed date against Date.now (differs +2d and +1y)', () => {
    expect(Number.isFinite(FIXED)).toBe(true)
    expect(Date.now() - FIXED).toBeLessThan(DAY)
  })
  test('new Date with no argument against a fixed date (differs +2d and +1y)', () => {
    expect(new Date().getTime() - FIXED).toBeLessThan(DAY)
  })
  test('the clock read at file load against a fixed date (differs +2d and +1y)', () => {
    expect(LOADED_AT - FIXED).toBeLessThan(DAY)
  })
  test('within three days of a fixed date (differs +1y only)', () => {
    expect(Date.now() - FIXED).toBeLessThan(3 * DAY)
  })
  test('within 300 days of a fixed date (differs +1y only)', () => {
    expect(Date.now() - FIXED).toBeLessThan(300 * DAY)
  })
  test('a day or more after a fixed date (fails unshifted, differs +2d and +1y)', () => {
    expect(Date.now() - FIXED).toBeGreaterThanOrEqual(DAY)
  })
  test('more than 300 days after a fixed date (fails unshifted and +2d, differs +1y only)', () => {
    expect(Date.now() - FIXED).toBeGreaterThan(300 * DAY)
  })
  test('always fails whatever the date (never differs)', () => {
    expect('cq10 planted always-failing test').toBe('a different string')
  })
})
