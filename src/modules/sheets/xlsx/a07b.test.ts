import { describe, expect, test } from 'vitest'
import { NOT_A_WORKBOOK, numberText, readXlsx, typed, ulp } from './index'

describe('EV-14 ulp', () => {
  test('EV-14 one unit in the last place of known doubles, sign ignored', () => {
    expect(ulp(1)).toBe(2 ** -52)
    expect(ulp(-1)).toBe(2 ** -52)
    expect(ulp(9_000_000)).toBe(2 ** -29)
    expect(ulp(0)).toBe(Number.MIN_VALUE)
  })
})

describe('EV-14 numberText band', () => {
  test('EV-14 four ulps snap, five ulps and more than 1e-9 do not', () => {
    const x = 9_000_000.3
    expect(numberText(x + 4 * ulp(x))).toBe('9000000.3')
    expect(numberText(x - 4 * ulp(x))).toBe('9000000.3')
    expect(numberText(x + 1e-6)).toBe(String(x + 1e-6))
  })

  test('EV-14 the band is scaled by the larger magnitude across a power of two', () => {
    expect(numberText(2 ** 30 - 6 * 2 ** -23)).toBe('1073741824')
  })

  test('EV-14 the band never reaches half a cent at huge magnitude', () => {
    const x = 1e14 + 0.5
    expect(numberText(x)).toBe(String(x))
    expect(numberText(1e14 + 0.25)).toBe('100000000000000.25')
  })

  // A07C round 2 R2-2 retired "just under 1e-9 snaps" (0.5e-9 read '0'): the snap has no absolute floor (a07c.acceptance.test.ts).
  test('EV-14 a gap of exactly 1e-9 is its own text', () => {
    expect(numberText(1e-9)).toBe('1e-9')
  })
})

describe('EV-14 typed: non-finite and nested rich text', () => {
  test('EV-14 NaN and both infinities are error cells with a code', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(typed(v, false)).toEqual({ type: 'error', text: '#NUM!' })
  })

  test('EV-14 a hyperlink whose text is rich text reads the runs joined', () => {
    expect(typed({ text: { richText: [{ text: 'a ' }, { text: 'b' }] }, hyperlink: 'x' }, false)).toEqual({ type: 'text', text: 'a b' })
  })

  test('EV-14 an object with neither text nor rich text reads as nothing', () => {
    expect(typed({ text: 5 }, false)).toEqual({ type: 'number', text: '5' })
    expect(typed({ text: { other: 1 } }, false)).toBeUndefined()
  })
})

describe('EV-14 readXlsx refusal', () => {
  test('EV-14 non-zip bytes are refused with the fixed reason', async () => {
    expect(await readXlsx(new Uint8Array([1, 2, 3]))).toEqual({ ok: false, reason: NOT_A_WORKBOOK })
  })
})
