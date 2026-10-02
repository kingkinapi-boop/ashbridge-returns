import { expect, test } from 'vitest'
import {
  BoxSchema,
  ReadingResultSchema,
  normaliseAmount,
  pixelsToBox,
  pointsToBox,
  valueInBox,
  type Box,
} from './reading'

const b = (left: number, top: number, width: number, height: number, page = 1): Box => ({
  page,
  left,
  top,
  width,
  height,
})

function raw(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    documentFingerprint: 'sha256:unit-test',
    engine: { name: 'recorded (Test)', version: '1.0.0' },
    readAt: '2026-10-01T14:00:00.000Z',
    pageCount: 2,
    pages: [1, 2].map((number) => ({ number, widthPt: 612, heightPt: 792, hasTextLayer: true })),
    words: [],
    ...over,
  }
}

function result(texts: string[], boxes?: Box[]) {
  return ReadingResultSchema.parse(
    raw({
      pageCount: 1,
      pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
      words: texts.map((text, i) => ({
        text,
        box: boxes?.[i] ?? b(0.1 + i * 0.1, 0.2, 0.05, 0.02),
        confidence: 0.9,
        order: i,
      })),
    }),
  )
}

const whole = b(0, 0, 1, 1)

function issueOf(input: unknown) {
  const r = ReadingResultSchema.safeParse(input)
  expect(r.success).toBe(false)
  return r.success ? [] : r.error.issues
}

test('EV-6 two sign marks are refused', () => {
  expect(normaliseAmount('(-5.00)').ok).toBe(false)
  expect(normaliseAmount('5.00 CR-').ok).toBe(false)
})

test('EV-6 one decimal digit reads as tenths and three digits are refused', () => {
  expect(normaliseAmount('1,234.5')).toEqual({ ok: true, cents: 123450 })
  expect(normaliseAmount('1.234').ok).toBe(false)
})

test('EV-6 badly grouped commas are refused', () => {
  expect(normaliseAmount('12,34.00').ok).toBe(false)
})

test('EV-6 an empty amount is refused with its own reason', () => {
  expect(normaliseAmount('')).toEqual({ ok: false, reason: 'empty amount' })
  expect(normaliseAmount('  ')).toEqual({ ok: false, reason: 'empty amount' })
})

test('EV-6 CR with another sign mark is refused with the sign reason', () => {
  expect(normaliseAmount('-5.00 CR')).toEqual({ ok: false, reason: 'more than one sign mark' })
  expect(normaliseAmount('(5.00) CR')).toEqual({ ok: false, reason: 'more than one sign mark' })
  expect(normaliseAmount('5.00 DR CR').ok).toBe(false)
})

test('EV-6 two dollar signs are refused', () => {
  for (const t of ['$$5.00', '$-$5.00', '$5.00$']) {
    expect(normaliseAmount(t).ok).toBe(false)
  }
  expect(normaliseAmount('$5.00')).toEqual({ ok: true, cents: 500 })
  expect(normaliseAmount('-$5.00')).toEqual({ ok: true, cents: -500 })
})

test('EV-6 refusal messages are stable text', () => {
  expect(normaliseAmount('abc')).toEqual({ ok: false, reason: '"abc" is not an amount in dollars and cents' })
  expect(normaliseAmount('99999999999999999')).toEqual({ ok: false, reason: 'amount is too large' })
})

test('EV-5 BoxSchema refusal message', () => {
  const r = BoxSchema.safeParse(b(0.6, 0.1, 0.5, 0.1))
  expect(r.success).toBe(false)
  expect(r.error?.issues[0]?.message).toBe('box runs off the page')
})

test('ARC-10 readAt accepts a UTC offset as well as Z', () => {
  expect(ReadingResultSchema.safeParse(raw({ readAt: '2026-10-01T10:00:00.000-04:00' })).success).toBe(true)
  expect(ReadingResultSchema.safeParse(raw({ readAt: '2026-10-01T10:00:00' })).success).toBe(false)
})

test('EV-5 a word beyond the page count names its place and the reason', () => {
  const issues = issueOf(
    raw({ words: [{ text: 'x', box: b(0.1, 0.1, 0.1, 0.1, 3), confidence: 0.9, order: 1 }] }),
  )
  expect(issues).toHaveLength(1)
  expect(issues[0]).toMatchObject({
    code: 'custom',
    path: ['words', 0, 'box', 'page'],
    message: 'page 3 is beyond the page count 2',
  })
})

test('EV-5 the page list issue names its place and the reason', () => {
  const issues = issueOf(raw({ pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }] }))
  expect(issues).toHaveLength(1)
  expect(issues[0]).toMatchObject({ code: 'custom', path: ['pages'], message: 'pages must be exactly 1 to 2' })
})

test('EV-5 pages given out of order are accepted (the list is checked as a set 1 to pageCount)', () => {
  const pages = [2, 1].map((number) => ({ number, widthPt: 612, heightPt: 792, hasTextLayer: true }))
  expect(ReadingResultSchema.safeParse(raw({ pages })).success).toBe(true)
  const gap = [1, 3].map((number) => ({ number, widthPt: 612, heightPt: 792, hasTextLayer: true }))
  expect(ReadingResultSchema.safeParse(raw({ pages: gap })).success).toBe(false)
  const three = [3, 1, 2].map((number) => ({ number, widthPt: 612, heightPt: 792, hasTextLayer: true }))
  expect(ReadingResultSchema.safeParse(raw({ pageCount: 3, pages: three })).success).toBe(true)
})

test('EV-5 converter refusal messages are stable text', () => {
  expect(() => pointsToBox(1, { x: 0, y: 0, width: 10, height: 10 }, 0, 792)).toThrow('page size must be above zero')
  expect(() => pointsToBox(1, { x: 0, y: 0, width: 0, height: 10 }, 612, 792)).toThrow(
    'rect must have a width and a height',
  )
  expect(() => pointsToBox(1, { x: 600, y: 0, width: 20, height: 10 }, 612, 792)).toThrow('rect runs off the page')
})

test('EV-5 a fraction that overshoots 1 by float noise is snapped, a real overshoot is refused', () => {
  const noisy = pixelsToBox(1, { x: 0, y: 0, width: 100 * (1 + 1e-12), height: 50 }, 100, 100)
  expect(noisy.width).toBe(1)
  const under = pixelsToBox(1, { x: -1e-12, y: 0, width: 50, height: 50 }, 100, 100)
  expect(under.left).toBe(0)
  expect(() => pixelsToBox(1, { x: 0, y: 0, width: 100.001, height: 50 }, 100, 100)).toThrow(RangeError)
})

test('EV-6 a word that starts with a space after a bare sign opens its own amount', () => {
  const r = result(['-', ' 5'])
  expect(valueInBox(r, whole, '5')).toEqual({ ok: true })
  expect(valueInBox(r, whole, '-5')).toEqual({ ok: false, reason: 'value not found' })
})

test('EV-6 a blank text value is not found among real words', () => {
  expect(valueInBox(result(['Maple', 'Leaf']), whole, '')).toEqual({ ok: false, reason: 'value not found' })
})

test('EV-6 text runs match at any start and any length, never part of a word', () => {
  const r = result(['Total', 'Maple', 'Leaf', 'Bank'])
  expect(valueInBox(r, whole, 'maple leaf').ok).toBe(true)
  expect(valueInBox(r, whole, 'leaf bank').ok).toBe(true)
  expect(valueInBox(r, whole, 'total maple leaf bank').ok).toBe(true)
  expect(valueInBox(r, whole, 'Bank').ok).toBe(true)
  expect(valueInBox(r, whole, 'total leaf').ok).toBe(false)
  expect(valueInBox(r, whole, 'maple lea').ok).toBe(false)
})
