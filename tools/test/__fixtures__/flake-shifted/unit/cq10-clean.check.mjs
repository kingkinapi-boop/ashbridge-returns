// CQ10 clean tests: each passes on the real date and under both shifts, so the script names none of them.
// They also pin the shim's shape: forward only, under 400 days, explicit dates and the time zone untouched,
// and a test's own pinned clock (vi.setSystemTime) still wins.
import { afterEach, describe, expect, test, vi } from 'vitest'

const DAY = 86_400_000
const FIXED = Date.parse(process.env['CQ10_FIXED'] ?? '')

afterEach(() => {
  vi.useRealTimers()
})

describe('cq10 clean', () => {
  test('clean: the date only moves forward, by less than 400 days', () => {
    expect(Number.isFinite(FIXED)).toBe(true)
    const d = Date.now() - FIXED
    expect(d).toBeGreaterThan(-60_000)
    expect(d).toBeLessThan(400 * DAY)
    expect(Number.isInteger(Date.now())).toBe(true)
  })
  test('clean: a pinned clock wins over the shift', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
    expect(Date.now()).toBe(Date.parse('2026-10-02T12:00:00Z'))
    expect(new Date().toISOString()).toBe('2026-10-02T12:00:00.000Z')
  })
  test('clean: dates built from explicit values are unchanged', () => {
    expect(new Date(0).getTime()).toBe(0)
    expect(new Date('2026-01-01T00:00:00Z').getTime()).toBe(1_767_225_600_000)
    expect(Date.parse('2026-10-02T12:00:00Z')).toBe(1_790_942_400_000)
    expect(Date.UTC(2026, 0, 1)).toBe(1_767_225_600_000)
    const local = new Date(2026, 0, 15, 9, 30)
    expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes()]).toEqual([2026, 0, 15, 9, 30])
  })
  test('clean: the time zone is untouched (America/Toronto)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Toronto')
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300)
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240)
  })
  test('clean: a date made with no argument is still a Date', () => {
    const now = new Date()
    expect(now).toBeInstanceOf(Date)
    expect(Object.prototype.toString.call(now)).toBe('[object Date]')
    expect(Number.isNaN(now.getTime())).toBe(false)
  })
})
