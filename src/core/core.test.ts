import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { fixedClock, now, setClock, systemClock } from './clock'
import { newId } from './ids'
import { makeLogger } from './log'
import { addCents, formatCents, roundCentsToDollars } from './money'
import { readSettings } from './env'

describe('core', () => {
  test('ARC-13 money adds in integer cents', () => {
    expect(addCents(10, 20, 5)).toBe(35)
    expect(() => addCents(0.5)).toThrow()
    expect(formatCents(-1205)).toBe('-12.05')
  })

  test('ARC-13 rounding rule: halves away from zero, to whole dollars', () => {
    expect(roundCentsToDollars(149)).toBe(1)
    expect(roundCentsToDollars(150)).toBe(2)
    expect(roundCentsToDollars(-150)).toBe(-2)
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), (c) => {
        const d = roundCentsToDollars(c)
        expect(Math.abs(d * 100 - c)).toBeLessThanOrEqual(50)
        expect(roundCentsToDollars(-c)).toBe(d === 0 ? 0 : -d)
      }),
    )
  })

  test('ARC-13 sums of cents stay exact', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1e9, max: 1e9 })), (xs) => {
        expect(addCents(...xs)).toBe(xs.reduce((a, b) => a + b, 0))
      }),
    )
  })

  test('ARC-15 the clock can be pinned', () => {
    setClock(fixedClock('2026-01-15T12:00:00Z'))
    expect(now().toISOString()).toBe('2026-01-15T12:00:00.000Z')
    setClock(systemClock)
  })

  test('ARC-15 ids sort by creation time', () => {
    const ids: string[] = []
    for (const t of ['2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2027-06-01T00:00:00Z']) {
      setClock(fixedClock(t))
      ids.push(newId())
    }
    setClock(systemClock)
    expect([...ids].sort()).toEqual(ids)
  })

  test('SEC-5 the logger never prints a planted SIN or date of birth', () => {
    const lines: string[] = []
    const log = makeLogger((l) => lines.push(l))
    log.info('client 123-456-789 filed', { sin: '123456789', dob: '1980-01-01', accountNumber: '99887766', note: 'ok 987 654 321' })
    const out = lines.join('\n')
    for (const bad of ['123-456-789', '123456789', '1980-01-01', '99887766', '987 654 321']) expect(out).not.toContain(bad)
    expect(out).toContain('ok')
  })

  test('SEC-10 env.ts never prints a value', () => {
    expect(readSettings({ NODE_ENV: 'test' }).NODE_ENV).toBe('test')
    let message = ''
    try {
      readSettings({ NODE_ENV: 'super-secret-value' })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('NODE_ENV')
    expect(message).not.toContain('super-secret-value')
  })

  test('ARC-9 tools/lib.mjs globToRegExp matches src/** correctly', async () => {
    // @ts-expect-error plain Node module without types
    const lib = (await import('../../tools/lib.mjs')) as { globToRegExp: (g: string) => RegExp }
    const re = lib.globToRegExp('src/**')
    expect(re.test('src/a/b.ts')).toBe(true)
    expect(re.test('srcx/a')).toBe(false)
  })
})
