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
  test('upper case CR and DR marks read as the table says (lower case is refused, A348 supersedes the round 2 builder test)', () => {
    expect(normaliseAmount('5.00 DR')).toEqual({ ok: true, cents: -500 })
    expect(normaliseAmount('5.00CR')).toEqual({ ok: true, cents: 500 })
    expect(normaliseAmount('5.00 dr').ok).toBe(false)
    expect(normaliseAmount('5.00cr').ok).toBe(false)
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

// ---- mutation-killing edges (F09A build; DG holds each file to 100) ----

const cents = (texts: string[]): number[] => amountGroups(texts.map((t, i) => word(t, 0.01 + i * 0.052, i + 1))).map((g) => g.cents)
const reason = (t: string): string => {
  const r = normaliseAmount(t)
  return r.ok ? 'ok' : r.reason
}

describe('EV-6 grammar edges: what closes a group and what never joins', () => {
  test('a trailing mark closes the group, so a later group word starts a new amount', () => {
    expect(cents(['1-', '234'])).toEqual([-100, 23400])
    expect(cents(['1', 'CR', '234'])).toEqual([100, 23400])
    expect(cents(['(1', ')', '234'])).toEqual([-100, 23400])
    expect(cents(['1', '234-', '567'])).toEqual([-123400, 56700])
  })
  test('a word with leading marks never joins as a continuation', () => {
    expect(cents(['1', '-234'])).toEqual([100, -23400])
    expect(cents(['1', '$234'])).toEqual([100, 23400])
  })
  test('continuations join only the whole part before any decimals', () => {
    expect(cents(['1.00', '234'])).toEqual([100, 23400])
    expect(cents(['1234', '567'])).toEqual([123400, 56700])
    expect(cents(['12', '345'])).toEqual([1234500])
    expect(cents(['1', '234', '567'])).toEqual([123456700])
    expect(cents(['0', '123'])).toEqual([0, 12300])
  })
  test('lead marks must form a table entry and a lone mark word is no amount', () => {
    expect(cents(['$$5.00'])).toEqual([])
    expect(cents(['--5.00'])).toEqual([])
    expect(cents(['((5.00)'])).toEqual([])
    expect(cents(['$', '-', '5.00'])).toEqual([-500])
    expect(cents(['$', '$', '5.00'])).toEqual([500])
    expect(cents(['100.00', '$'])).toEqual([10000])
    expect(cents(['100.00', '(', '5.00'])).toEqual([10000, 500])
    expect(cents(['$', 'CR', '5.00'])).toEqual([500])
    expect(cents(['100.00', '$DR'])).toEqual([10000])
    expect(amountGroups(['$', 'CR', '5.00'].map((t, i) => word(t, 0.01 + i * 0.052, i + 1))).map((g) => g.words.length)).toEqual([1])
    expect(cents(['$CR'])).toEqual([])
    expect(cents(['(CR'])).toEqual([])
    expect(cents(['100.00', '$CR'])).toEqual([10000])
    expect(cents(['$abc'])).toEqual([])
  })
  test('the gap between words may equal the word height and no more', () => {
    const at = (left: number) => [
      { text: '1', box: { page: 1, left: 0.25, top: 0.1, width: 0.25, height: 0.25 }, confidence: 1, order: 1 },
      { text: '234', box: { page: 1, left, top: 0.1, width: 0.125, height: 0.25 }, confidence: 1, order: 2 },
    ]
    expect(amountGroups(at(0.75))).toHaveLength(1)
    expect(amountGroups(at(0.8125))).toHaveLength(2)
  })
  test('words on different lines never join, and lines that only touch do not count as the same line', () => {
    const on = (top: number) => [
      { text: '1', box: { page: 1, left: 0.1, top: 0.25, width: 0.1, height: 0.25 }, confidence: 1, order: 1 },
      { text: '234', box: { page: 1, left: 0.2, top, width: 0.1, height: 0.25 }, confidence: 1, order: 2 },
    ]
    expect(amountGroups(on(0.25))).toHaveLength(1)
    expect(amountGroups(on(0.5))).toHaveLength(2)
    expect(amountGroups(on(0))).toHaveLength(2)
  })
  test('a "-" before the last word of a line has no amount to lead and a "-" with no gap rule keeps its dash', () => {
    expect(cents(['100.00', '-'])).toEqual([-10000])
    expect(cents(['100.00', '-', '50.00'])).toEqual([10000, -5000])
    expect(cents(['-', '-', '5.00'])).toEqual([-500])
  })
})

describe('EV-6 normaliseAmount reasons', () => {
  test('two sign marks say so, one mark or none says not an amount', () => {
    for (const t of ['5.00- 6.00-', '5.00 CR 6.00 CR', '5.00 DR 6.00 DR', '-5.00 −6.00', '(5.00 (6.00', '5.00- -6.00']) {
      expect(reason(t), t).toBe('more than one sign mark')
    }
    expect(reason('abc -5.00')).toBe('"abc -5.00" is not an amount in dollars and cents')
    expect(reason('-abc')).toBe('"-abc" is not an amount in dollars and cents')
    expect(reason('abc')).toBe('"abc" is not an amount in dollars and cents')
    expect(reason('abc 5.00 CR')).toBe('"abc 5.00 CR" is not an amount in dollars and cents')
    expect(reason('abc 5.00 DR')).toBe('"abc 5.00 DR" is not an amount in dollars and cents')
    expect(reason('abc 5.00-')).toBe('"abc 5.00-" is not an amount in dollars and cents')
    expect(reason('5.00 6.00')).toBe('"5.00 6.00" is not an amount in dollars and cents')
  })
  test('text with extra whitespace in any form still reads', () => {
    expect(normaliseAmount(' 1 \t 234.56\n')).toEqual({ ok: true, cents: 123456 })
    expect(normaliseAmount('1 234')).toEqual({ ok: true, cents: 123400 })
    expect(normaliseAmount('12 34')).toEqual({ ok: false, reason: '"12 34" is not an amount in dollars and cents' })
  })
  test('ARC-8 formatAmount names an unsafe amount and prints every format with thousands and a minus', () => {
    expect(() => formatAmount(Number.MAX_SAFE_INTEGER + 2, AMOUNT_FORMATS['plain'] as never)).toThrow('cents must be a safe integer')
    const f = (name: string, c: number) => formatAmount(c, AMOUNT_FORMATS[name] ?? (null as never))
    const want: Record<string, string> = {
      plain: '-1,234,567.89',
      dollar: '-$1,234,567.89',
      spaces: '-1 234 567.89',
      trailingMinus: '1,234,567.89-',
      dollarTrailingMinus: '$1,234,567.89-',
      brackets: '(1,234,567.89)',
      dollarBrackets: '($1,234,567.89)',
      debitCredit: '1,234,567.89 DR',
    }
    for (const [name, text] of Object.entries(want)) expect(f(name, -123456789), name).toBe(text)
    expect(f('debitCredit', 123456789)).toBe('1,234,567.89 CR')
  })
  test('EV-5 a blank word names why it is refused', () => {
    const r = WordSchema.safeParse(word(' ', 0.1, 1))
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('word text must not be blank')
  })
})
