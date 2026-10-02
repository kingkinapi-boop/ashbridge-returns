// F09A builder tests: the F09 defects carried onto this card (reading.ts) and edges of the grammar.
import { describe, expect, test } from 'vitest'
import { AMOUNT_FORMATS, amountGroups, formatAmount, normaliseAmount } from './amount-grammar'
import { ReadingResultSchema, WordSchema, pixelsToBox, pointsToBox, valueInBox, type Box } from './reading'

const word = (text: string, left: number, order: number) => ({
  text,
  box: { page: 1, left, top: 0.2, width: 0.05, height: 0.02 },
  confidence: 0.9,
  order,
})
const band: Box = { page: 1, left: 0, top: 0, width: 1, height: 1 }
const resultOf = (texts: string[]) =>
  ReadingResultSchema.parse({
    documentFingerprint: 'sha256:x',
    engine: { name: 'recorded (Test)', version: '1' },
    readAt: '2026-10-02T13:00:00.000Z',
    pageCount: 1,
    pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
    words: texts.map((t, i) => word(t, 0.01 + i * 0.052, i + 1)),
  })

describe('EV-6 blank values and blank words (F09 defect 1)', () => {
  test('a blank value is never found, even when the box holds a blank-looking word', () => {
    const r = resultOf(['Fee', '5.00'])
    for (const v of ['', '   ', '\t']) expect(valueInBox(r, band, v)).toEqual({ ok: false, reason: 'value not found' })
  })
  test('WordSchema refuses blank text', () => {
    for (const t of ['', ' ', '\n ']) {
      expect(WordSchema.safeParse(word(t, 0.1, 1)).success, JSON.stringify(t)).toBe(false)
    }
    expect(WordSchema.safeParse(word('x', 0.1, 1)).success).toBe(true)
  })
})

describe('EV-5 converters refuse a bad page with RangeError (F09 defect 2)', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 }
  test.each([Number.NaN, 0, 1.5, -1, Infinity])('page %s', (page) => {
    expect(() => pointsToBox(page, rect, 100, 100)).toThrow(RangeError)
    expect(() => pixelsToBox(page, rect, 100, 100)).toThrow(RangeError)
  })
  test('page 1 still works', () => {
    expect(pointsToBox(1, rect, 100, 100).page).toBe(1)
  })
})

describe('EV-6 grammar edges', () => {
  test('too large an amount is refused by normaliseAmount and never grouped', () => {
    expect(normaliseAmount('99999999999999999')).toEqual({ ok: false, reason: 'amount is too large' })
    expect(amountGroups([word('99999999999999999', 0.1, 1)])).toEqual([])
  })
  test('empty text and a lone mark are refused with a reason', () => {
    expect(normaliseAmount('')).toEqual({ ok: false, reason: 'empty amount' })
    expect(normaliseAmount('  ').ok).toBe(false)
    expect(normaliseAmount('-').ok).toBe(false)
  })
  test('a wider tolerance joins words the default keeps apart', () => {
    const w = [word('1', 0.1, 1), word('234.56', 0.2, 2)]
    expect(amountGroups(w)).toHaveLength(2)
    expect(amountGroups(w, 10)).toHaveLength(1)
  })
  test('lower case cr and dr marks read like upper case', () => {
    expect(normaliseAmount('5.00 dr')).toEqual({ ok: true, cents: -500 })
    expect(normaliseAmount('5.00cr')).toEqual({ ok: true, cents: 500 })
  })
  test('ARC-8 formatAmount refuses unsafe cents and prints each format', () => {
    expect(() => formatAmount(1.5, AMOUNT_FORMATS['plain'] ?? { dollar: false, thousands: ',', negative: 'leading' })).toThrow(RangeError)
    const f = (name: string, c: number) => formatAmount(c, AMOUNT_FORMATS[name] ?? (null as never))
    expect(f('plain', 123456)).toBe('1,234.56')
    expect(f('plain', -5)).toBe('-0.05')
    expect(f('dollar', -123456)).toBe('-$1,234.56')
    expect(f('spaces', 123456789)).toBe('1 234 567.89')
    expect(f('trailingMinus', -100)).toBe('1.00-')
    expect(f('dollarTrailingMinus', -100)).toBe('$1.00-')
    expect(f('brackets', -100)).toBe('(1.00)')
    expect(f('dollarBrackets', -100)).toBe('($1.00)')
    expect(f('debitCredit', -100)).toBe('1.00 DR')
    expect(f('debitCredit', 100)).toBe('1.00 CR')
    expect(f('debitCredit', 0)).toBe('0.00')
  })
})
