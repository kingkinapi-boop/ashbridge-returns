import { describe, expect, test } from 'vitest'
import { BLANK_RANGES, NonBlankSchema, isBlank } from './text'

const at = (cp: number): string => String.fromCodePoint(cp)
const covered = (cp: number): boolean => BLANK_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)

describe('EV-1 BLANK_RANGES edges', () => {
  test('EV-1 both ends of every range are blank and the code points just outside are not', () => {
    for (const [lo, hi] of BLANK_RANGES) {
      expect(isBlank(at(lo)), `U+${lo.toString(16)}`).toBe(true)
      expect(isBlank(at(hi)), `U+${hi.toString(16)}`).toBe(true)
      expect(isBlank(at(Math.floor((lo + hi) / 2)))).toBe(true)
      if (!covered(lo - 1) && lo > 0) expect(isBlank(at(lo - 1)), `U+${(lo - 1).toString(16)}`).toBe(false)
      if (!covered(hi + 1)) expect(isBlank(at(hi + 1)), `U+${(hi + 1).toString(16)}`).toBe(false)
    }
  })

  test('EV-1 ranges are ordered, whole and do not overlap', () => {
    let prev = -2
    for (const [lo, hi] of BLANK_RANGES) {
      expect(lo).toBeLessThanOrEqual(hi)
      expect(lo).toBeGreaterThan(prev + 1)
      prev = hi
    }
  })

  test('EV-1 a lone surrogate is not blank, and a string is checked character by character', () => {
    expect(isBlank('\ud800')).toBe(false)
    expect(isBlank(' \ud83d')).toBe(false)
    expect(isBlank('\u{E0100}\u{E0FFF}')).toBe(true)
    expect(isBlank('\u{E1000}')).toBe(false)
    expect(isBlank('')).toBe(true)
  })

  test('EV-1 the schema message says what is wrong', () => {
    const r = NonBlankSchema.safeParse(' ')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('must not be blank')
  })
})
