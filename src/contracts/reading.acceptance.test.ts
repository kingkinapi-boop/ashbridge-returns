// F09 acceptance tests: the reading contract (EV-5, EV-6, ARC-6, ARC-10).
// Written by the spec-writer before the build. The builder never edits this file.
//
// API the builder must export from src/contracts/reading.ts:
//
//   BoxSchema           zod schema for a box: { page, left, top, width, height }
//                       page: integer >= 1 (required); left, top, width, height:
//                       fractions of the page, 0 to 1, origin top left.
//   ReadingResultSchema zod schema for one document's reading result:
//                       {
//                         documentFingerprint: string,
//                         engine: { name: string (non-empty), version: string (non-empty) },
//                         readAt: string (ISO date-time, from the injected clock),
//                         pageCount: integer >= 1,
//                         pages: { number, widthPt, heightPt, hasTextLayer }[],
//                         words: { text, box: Box, confidence: 0..1, order: integer }[],
//                       }
//                       Every word's box.page must be between 1 and pageCount.
//   types Box, ReadingResult, Word, PointsRect, PixelsRect, AmountResult, ValueInBoxResult
//   pointsToBox(page, rect: { x, y, width, height }, pageWidthPt, pageHeightPt): Box
//                       PDF points, origin bottom left, (x, y) is the rect's bottom-left corner.
//   boxToPoints(box, pageWidthPt, pageHeightPt): { x, y, width, height }   (inverse of pointsToBox)
//   pixelsToBox(page, rect: { x, y, width, height }, imageWidthPx, imageHeightPx): Box
//                       image pixels, origin top left, (x, y) is the rect's top-left corner.
//   wordsInBox(result, box): Word[]   words whose centre lies inside the box, same page, in reading order.
//   normaliseAmount(text): { ok: true, cents: number } | { ok: false, reason: string }
//   valueInBox(result, box, value: string):
//                       { ok: true } | { ok: false, reason: 'no words in box' | 'value not found' | 'box on another page' }
//   interface ReadingEngine { name: string; isLive: boolean; read(document): Promise<ReadingResult> }
//
// Round 2 (findings F01-F09, RC4 and RC5; checks 8 to 13):
//   valueInBox reads the words in the box into maximal amount groups (same line, reading order),
//   joining only across "$", a sign word ("-", "DR", brackets), ".dd", or a ",ddd" or
//   space-separated three-digit group, and matches a whole group only. A sign word flips the sign.
//   Text values join words with one space. normaliseAmount refuses a leading zero before other
//   digits ("001234") and reads "$-1,234.56", "-$1,234.56", "$(1,234.56)" as negative.
//   BoxSchema refuses left + width or top + height above 1. pointsToBox and pixelsToBox THROW
//   (never clamp, never NaN) on a rect partly or wholly off the page, a rect of zero width or
//   height, and a page of zero width or height. ReadingResultSchema refuses a page list that is not
//   exactly pages 1 to pageCount. reading.ts carries `// @mutate` in its first 5 lines.

import { readFileSync } from 'node:fs'
import { describe, expect, expectTypeOf, test } from 'vitest'
import fc from 'fast-check'
import {
  BoxSchema,
  ReadingResultSchema,
  boxToPoints,
  normaliseAmount,
  pixelsToBox,
  pointsToBox,
  valueInBox,
  wordsInBox,
  type Box,
  type ReadingEngine,
  type ReadingResult,
} from './reading'

const SEED = 20261001

// ---------- fixtures ----------

type WordInput = { text: string; box: Box; order: number; confidence?: number }

function makeResult(words: WordInput[], pageCount = 1): ReadingResult {
  const raw = {
    documentFingerprint: 'sha256:bank-statement-maple-leaf-bank-test',
    engine: { name: 'recorded (Test)', version: '1.0.0' },
    readAt: '2026-10-01T14:00:00.000Z',
    pageCount,
    pages: Array.from({ length: pageCount }, (_, i) => ({
      number: i + 1,
      widthPt: 612,
      heightPt: 792,
      hasTextLayer: true,
    })),
    words: words.map((w) => ({ confidence: 0.99, ...w })),
  }
  return ReadingResultSchema.parse(raw)
}

// Index access that fails the test (never passes silently) when the item is missing.
function at<T>(items: readonly T[], i: number): T {
  const v = items[i]
  if (v === undefined) throw new Error(`test fixture: no item at index ${String(i)}`)
  return v
}

function box(page: number, left: number, top: number, width: number, height: number): Box {
  return { page, left, top, width, height }
}

// A line on page 1 near the top: "$1,234.56" sits at left 0.60..0.70, top 0.20..0.22.
const amountWord: WordInput = { text: '$1,234.56', box: box(1, 0.6, 0.2, 0.1, 0.02), order: 3 }
const labelWords: WordInput[] = [
  { text: 'Closing', box: box(1, 0.1, 0.2, 0.08, 0.02), order: 1 },
  { text: 'balance', box: box(1, 0.19, 0.2, 0.08, 0.02), order: 2 },
]
// The cited box drawn around the amount.
const amountBox = box(1, 0.58, 0.19, 0.14, 0.04)

// ---------- EV-6: valueInBox ----------

describe('valueInBox', () => {
  test('EV-6 finds 1234.56 in a box holding "$1,234.56"', () => {
    const result = makeResult([...labelWords, amountWord])
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: true })
  })

  test('EV-6 finds 1234.56 when "1,234" and ".56" are two adjacent words inside the box', () => {
    const result = makeResult([
      ...labelWords,
      { text: '1,234', box: box(1, 0.6, 0.2, 0.06, 0.02), order: 3 },
      { text: '.56', box: box(1, 0.66, 0.2, 0.03, 0.02), order: 4 },
    ])
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: true })
  })

  test('EV-6 finds 1234.56 across "1 234.56" and across "$ 1,234.56"', () => {
    const spaced = makeResult([
      { text: '1', box: box(1, 0.6, 0.2, 0.01, 0.02), order: 1 },
      { text: '234.56', box: box(1, 0.62, 0.2, 0.07, 0.02), order: 2 },
    ])
    expect(valueInBox(spaced, amountBox, '1234.56')).toEqual({ ok: true })
    const dollar = makeResult([
      { text: '$', box: box(1, 0.6, 0.2, 0.01, 0.02), order: 1 },
      { text: '1,234.56', box: box(1, 0.62, 0.2, 0.08, 0.02), order: 2 },
    ])
    expect(valueInBox(dollar, amountBox, '1234.56')).toEqual({ ok: true })
  })

  test('EV-6 planted fault: the same words just outside the box are refused with "no words in box"', () => {
    // Centres sit just below the box (box bottom is 0.23; centres at 0.245).
    const result = makeResult([
      { text: '1,234', box: box(1, 0.6, 0.235, 0.06, 0.02), order: 1 },
      { text: '.56', box: box(1, 0.66, 0.235, 0.03, 0.02), order: 2 },
    ])
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: false, reason: 'no words in box' })
  })

  test('EV-6 planted fault: the box on another page of the document is refused', () => {
    // The amount is on page 1; the citation points at the same place on page 2, which holds nothing there.
    const result = makeResult(
      [...labelWords, amountWord, { text: 'Page 2 (Test)', box: box(2, 0.1, 0.9, 0.1, 0.02), order: 4 }],
      2,
    )
    const onPage2 = { ...amountBox, page: 2 }
    expect(valueInBox(result, onPage2, '1234.56')).toEqual({ ok: false, reason: 'no words in box' })
  })

  test('EV-6 a box on a page the result does not have is refused with "box on another page"', () => {
    const result = makeResult([...labelWords, amountWord], 2)
    const onPage3 = { ...amountBox, page: 3 }
    expect(valueInBox(result, onPage3, '1234.56')).toEqual({ ok: false, reason: 'box on another page' })
  })

  test('EV-6 planted fault: a different amount in the box is "value not found", including a longer number that contains it', () => {
    const other = makeResult([{ ...amountWord, text: '$1,234.65' }])
    expect(valueInBox(other, amountBox, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
    const longer = makeResult([{ ...amountWord, text: '$11,234.56' }])
    expect(valueInBox(longer, amountBox, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
    const truncated = makeResult([{ ...amountWord, text: '$1,234.5' }])
    expect(valueInBox(truncated, amountBox, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
  })

  test('EV-6 planted fault: words that are not adjacent in reading order do not join into the value', () => {
    const result = makeResult([
      { text: '1,234', box: box(1, 0.6, 0.2, 0.03, 0.02), order: 1 },
      { text: 'Fee', box: box(1, 0.635, 0.2, 0.02, 0.02), order: 2 },
      { text: '.56', box: box(1, 0.66, 0.2, 0.03, 0.02), order: 3 },
    ])
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
  })

  test('EV-6 text values compare after trimming and folding case and spaces', () => {
    const result = makeResult([
      { text: 'Maple', box: box(1, 0.1, 0.05, 0.1, 0.02), order: 1 },
      { text: 'Leaf', box: box(1, 0.21, 0.05, 0.08, 0.02), order: 2 },
      { text: 'Bank', box: box(1, 0.3, 0.05, 0.08, 0.02), order: 3 },
      { text: '(Test)', box: box(1, 0.39, 0.05, 0.08, 0.02), order: 4 },
    ])
    const header = box(1, 0.05, 0.03, 0.5, 0.06)
    expect(valueInBox(result, header, '  maple   LEAF bank (test) ')).toEqual({ ok: true })
    expect(valueInBox(result, header, 'Birch Bank (Test)')).toEqual({ ok: false, reason: 'value not found' })
  })
})

// ---------- EV-6: normaliseAmount ----------

describe('normaliseAmount', () => {
  test('EV-6 strips dollar signs, commas and spaces and returns integer cents', () => {
    expect(normaliseAmount('$1,234.56')).toEqual({ ok: true, cents: 123456 })
    expect(normaliseAmount(' $ 1,234.56 ')).toEqual({ ok: true, cents: 123456 })
    expect(normaliseAmount('1234.56')).toEqual({ ok: true, cents: 123456 })
    expect(normaliseAmount('1,234')).toEqual({ ok: true, cents: 123400 })
    expect(normaliseAmount('0.05')).toEqual({ ok: true, cents: 5 })
  })

  test('EV-6 sign rule: brackets mean negative, "(1,234.56)" is -123456 cents', () => {
    expect(normaliseAmount('(1,234.56)')).toEqual({ ok: true, cents: -123456 })
  })

  test('EV-6 sign rule: a leading minus means negative, "-1234.56" is -123456 cents', () => {
    expect(normaliseAmount('-1234.56')).toEqual({ ok: true, cents: -123456 })
  })

  test('EV-6 sign rule: a trailing minus means negative, "1,234.56-" is -123456 cents', () => {
    expect(normaliseAmount('1,234.56-')).toEqual({ ok: true, cents: -123456 })
  })

  test('EV-6 sign rule: on a bank statement CR is a credit to the account (positive) and DR a debit (negative)', () => {
    expect(normaliseAmount('1,234.56 CR')).toEqual({ ok: true, cents: 123456 })
    expect(normaliseAmount('1,234.56 DR')).toEqual({ ok: true, cents: -123456 })
  })

  test('EV-6 planted faults: European format, scientific notation and an empty string are refused with a reason', () => {
    for (const bad of ['1.234,56', '1.2E3', '', '   ', 'abc (Test)']) {
      const r = normaliseAmount(bad)
      expect(r.ok, `"${bad}" should be refused`).toBe(false)
      if (!r.ok) {
        expect(typeof r.reason).toBe('string')
        expect(r.reason.length).toBeGreaterThan(0)
      }
    }
  })

  test('EV-6 property: any cents up to 10^13 formatted as "$1,234.56" normalise back to the same cents', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 13n }), (cents) => {
        const text = formatDollars(cents)
        const r = normaliseAmount(text)
        expect(r).toEqual({ ok: true, cents: Number(cents) })
        expect(Number.isSafeInteger(Number(cents))).toBe(true)
      }),
      { seed: SEED, numRuns: 1000 },
    )
  })

  test('EV-6 property: the same amounts in brackets normalise to the negative cents', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 13n }), (cents) => {
        const r = normaliseAmount(`(${formatDollars(cents)})`)
        expect(r).toEqual({ ok: true, cents: -Number(cents) })
      }),
      { seed: SEED, numRuns: 500 },
    )
  })
})

// Integer-only formatting: "$" + dollars with thousands commas + "." + two-digit cents.
function formatDollars(cents: bigint): string {
  const dollars = cents / 100n
  const rem = cents % 100n
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${grouped}.${rem.toString().padStart(2, '0')}`
}

// ---------- EV-6: wordsInBox ----------

describe('wordsInBox', () => {
  test('EV-6 returns the words whose centre is inside, in reading order, and ignores the same place on another page', () => {
    const result = makeResult(
      [
        { text: 'second', box: box(1, 0.3, 0.1, 0.1, 0.02), order: 2 },
        { text: 'first', box: box(1, 0.1, 0.1, 0.1, 0.02), order: 1 },
        // Overlaps the box but its centre (0.62) is outside the box (right edge 0.6): excluded.
        { text: 'edge', box: box(1, 0.55, 0.1, 0.14, 0.02), order: 3 },
        { text: 'elsewhere', box: box(2, 0.1, 0.1, 0.1, 0.02), order: 4 },
      ],
      2,
    )
    const got = wordsInBox(result, box(1, 0.05, 0.05, 0.55, 0.1))
    expect(got.map((w) => w.text)).toEqual(['first', 'second'])
  })

  test('EV-6 property: for any words and any box, exactly the words whose centre is inside come back, and the box moved off the page returns none', () => {
    // Dyadic grid so arithmetic is exact: box edges on multiples of 1/64,
    // word centres on odd multiples of 1/128, so no centre ever sits on an edge.
    const wordArb = fc.record({
      cx: fc.integer({ min: 0, max: 63 }),
      cy: fc.integer({ min: 0, max: 63 }),
      hw: fc.integer({ min: 1, max: 8 }),
      hh: fc.integer({ min: 1, max: 8 }),
    })
    const edgePair = fc
      .tuple(fc.integer({ min: 0, max: 64 }), fc.integer({ min: 0, max: 64 }))
      .filter(([a, b]) => a !== b)
      .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const)
    fc.assert(
      fc.property(
        fc.array(wordArb, { minLength: 0, maxLength: 30 }),
        edgePair,
        edgePair,
        fc.integer({ min: 0, max: 1_000_000 }),
        (specs, [l, r], [t, b], shuffleSeed) => {
          const n = specs.length
          // Reading orders are a permutation; array order is a different shuffle.
          const orders = permute(
            Array.from({ length: n }, (_, i) => i + 1),
            shuffleSeed,
          )
          const words: WordInput[] = specs.map((s, i) => {
            const cx = (2 * s.cx + 1) / 128
            const cy = (2 * s.cy + 1) / 128
            const hw = s.hw / 1024
            const hh = s.hh / 1024
            return { text: `w${String(i)} (Test)`, box: box(1, cx - hw, cy - hh, 2 * hw, 2 * hh), order: at(orders, i) }
          })
          const result = makeResult(permute(words, shuffleSeed + 7), 2)
          const theBox = box(1, l / 64, t / 64, (r - l) / 64, (b - t) / 64)

          const expected = specs
            .map((s, i) => ({ s, w: at(words, i) }))
            .filter(({ s }) => {
              const cx = (2 * s.cx + 1) / 128
              const cy = (2 * s.cy + 1) / 128
              return cx > l / 64 && cx < r / 64 && cy > t / 64 && cy < b / 64
            })
            .map(({ w }) => w)
            .sort((a, c) => a.order - c.order)
            .map((w) => w.text)

          expect(wordsInBox(result, theBox).map((w) => w.text)).toEqual(expected)
          // Moved off the page the words are on: none.
          expect(wordsInBox(result, { ...theBox, page: 2 })).toEqual([])
        },
      ),
      { seed: SEED, numRuns: 500 },
    )
  })
})

// Deterministic Fisher-Yates driven by a small LCG (no Math.random).
function permute<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  let s = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    const a = at(out, i)
    const b = at(out, j)
    out[i] = b
    out[j] = a
  }
  return out
}

// ---------- EV-5: box pointers ----------

describe('box pointer schema', () => {
  test('EV-5 a box that names no page is refused by the schema', () => {
    expect(BoxSchema.safeParse({ left: 0.1, top: 0.1, width: 0.2, height: 0.05 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 0, left: 0.1, top: 0.1, width: 0.2, height: 0.05 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 1.5, left: 0.1, top: 0.1, width: 0.2, height: 0.05 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 1, left: 0.1, top: 0.1, width: 0.2, height: 0.05 }).success).toBe(true)
  })

  test('EV-5 box coordinates outside 0 to 1 are refused', () => {
    expect(BoxSchema.safeParse({ page: 1, left: 1.2, top: 0.1, width: 0.2, height: 0.05 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 1, left: 0.1, top: -0.1, width: 0.2, height: 0.05 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 1, left: 0.1, top: 0.1, width: 1.5, height: 0.05 }).success).toBe(false)
  })

  test('EV-5 a word whose box names a page beyond the result page count is refused', () => {
    const raw = {
      documentFingerprint: 'sha256:t4-slip-test',
      engine: { name: 'recorded (Test)', version: '1.0.0' },
      readAt: '2026-10-01T14:00:00.000Z',
      pageCount: 2,
      pages: [
        { number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true },
        { number: 2, widthPt: 612, heightPt: 792, hasTextLayer: true },
      ],
      words: [{ text: '1,234.56', box: box(3, 0.1, 0.1, 0.1, 0.02), confidence: 0.9, order: 1 }],
    }
    expect(ReadingResultSchema.safeParse(raw).success).toBe(false)
    // The same word on page 2 is fine (the fault, not the fixture, is what is refused).
    at(raw.words, 0).box.page = 2
    expect(ReadingResultSchema.safeParse(raw).success).toBe(true)
  })

  test('EV-5 converting a box from PDF points to fractions and back returns the same box (property, within 0.01 pt)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20_000, max: 200_000 }), // page width in hundredths of a point
        fc.integer({ min: 20_000, max: 200_000 }), // page height
        fc.integer({ min: 0, max: 9_999 }), // x, ten-thousandths of the width
        fc.integer({ min: 0, max: 9_999 }), // y
        fc.integer({ min: 1, max: 10_000 }), // width share
        fc.integer({ min: 1, max: 10_000 }), // height share
        fc.integer({ min: 1, max: 50 }), // page
        (wH, hH, xs, ys, ws, hs, page) => {
          const W = wH / 100
          const H = hH / 100
          const x = (W * xs) / 10_000
          const y = (H * ys) / 10_000
          const width = ((W - x) * ws) / 10_000
          const height = ((H - y) * hs) / 10_000
          const b = pointsToBox(page, { x, y, width, height }, W, H)
          expect(BoxSchema.safeParse(b).success).toBe(true)
          expect(b.page).toBe(page)
          const back = boxToPoints(b, W, H)
          expect(Math.abs(back.x - x)).toBeLessThanOrEqual(0.01)
          expect(Math.abs(back.y - y)).toBeLessThanOrEqual(0.01)
          expect(Math.abs(back.width - width)).toBeLessThanOrEqual(0.01)
          expect(Math.abs(back.height - height)).toBeLessThanOrEqual(0.01)
        },
      ),
      { seed: SEED, numRuns: 1000 },
    )
  })

  test('EV-5 PDF points (origin bottom left) become fractions from the top left', () => {
    // Letter page 612 x 792 pt; a rect 1 inch in, whose top is 1 inch below the top edge.
    const b = pointsToBox(1, { x: 72, y: 684, width: 144, height: 36 }, 612, 792)
    expect(b.page).toBe(1)
    expect(b.left).toBeCloseTo(72 / 612, 10)
    expect(b.top).toBeCloseTo(72 / 792, 10) // 792 - (684 + 36) = 72, not 684
    expect(b.width).toBeCloseTo(144 / 612, 10)
    expect(b.height).toBeCloseTo(36 / 792, 10)
  })

  test('EV-5 image pixels (origin top left) become fractions without flipping', () => {
    const b = pixelsToBox(2, { x: 250, y: 330, width: 500, height: 110 }, 2550, 3300)
    expect(b.page).toBe(2)
    expect(b.left).toBeCloseTo(250 / 2550, 10)
    expect(b.top).toBeCloseTo(330 / 3300, 10)
    expect(b.width).toBeCloseTo(500 / 2550, 10)
    expect(b.height).toBeCloseTo(110 / 3300, 10)
  })
})

// ---------- ARC-10: engine versions stamped ----------

describe('engine stamp', () => {
  const good = () => ({
    documentFingerprint: 'sha256:receipt-test',
    engine: { name: 'pdf-text-layer (Test)', version: '4.2.1' },
    readAt: '2026-10-01T14:00:00.000Z',
    pageCount: 1,
    pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
    words: [{ text: 'Total', box: box(1, 0.1, 0.1, 0.1, 0.02), confidence: 0.98, order: 1 }],
  })

  test('ARC-10 a result stamped with engine name and version is accepted', () => {
    const parsed = ReadingResultSchema.parse(good())
    expect(parsed.engine).toEqual({ name: 'pdf-text-layer (Test)', version: '4.2.1' })
  })

  test('ARC-10 a reading result with no engine version is refused', () => {
    const noVersion = good() as Record<string, unknown>
    noVersion.engine = { name: 'pdf-text-layer (Test)' }
    expect(ReadingResultSchema.safeParse(noVersion).success).toBe(false)
    const blankVersion = good() as Record<string, unknown>
    blankVersion.engine = { name: 'pdf-text-layer (Test)', version: '' }
    expect(ReadingResultSchema.safeParse(blankVersion).success).toBe(false)
  })

  test('ARC-10 a reading result with no engine name, or no engine at all, is refused', () => {
    const noName = good() as Record<string, unknown>
    noName.engine = { version: '4.2.1' }
    expect(ReadingResultSchema.safeParse(noName).success).toBe(false)
    const noEngine = good() as Record<string, unknown>
    delete noEngine.engine
    expect(ReadingResultSchema.safeParse(noEngine).success).toBe(false)
  })
})

// ---------- ARC-6: the adapter every engine implements ----------

describe('ReadingEngine adapter', () => {
  test('ARC-6 a free stand-in engine implements read, name and isLive, and its result passes the schema', async () => {
    const recorded = makeResult([...labelWords, amountWord])
    const standIn: ReadingEngine = {
      name: 'recorded (Test)',
      isLive: false,
      read: () => Promise.resolve(recorded),
    }
    expectTypeOf<typeof standIn.read>().returns.resolves.toEqualTypeOf<ReadingResult>()
    expectTypeOf(standIn.isLive).toEqualTypeOf<boolean>()
    expectTypeOf(standIn.name).toEqualTypeOf<string>()
    const out = await standIn.read(undefined as unknown as Parameters<ReadingEngine['read']>[0])
    expect(ReadingResultSchema.safeParse(out).success).toBe(true)
    expect(valueInBox(out, amountBox, '1234.56')).toEqual({ ok: true })
  })
})

// ---------- Round 2: amount groups (EV-6, check 8, item a) ----------

// One line on page 1 at top 0.20, height 0.02, inside amountBox (left 0.58..0.72, top 0.19..0.23).
// Words are laid left to right in reading order; each gets an equal slot.
function line(texts: string[], top = 0.2): WordInput[] {
  const slot = 0.12 / texts.length
  return texts.map((text, i) => ({ text, box: box(1, 0.59 + i * slot, top, slot * 0.9, 0.02), order: i + 1 }))
}

describe('valueInBox amount groups (round 2)', () => {
  test('EV-6 (a) "12" "34" never matches 1234: neither part is a three-digit group, so they never join', () => {
    const result = makeResult(line(['12', '34']))
    expect(valueInBox(result, amountBox, '1234')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, amountBox, '12.34')).toEqual({ ok: false, reason: 'value not found' })
  })

  test('EV-6 (a) "234.56" is not found in "1" "234.56": the whole group is 1234.56, never a part of it', () => {
    const result = makeResult(line(['1', '234.56']))
    expect(valueInBox(result, amountBox, '234.56')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, amountBox, '1')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: true })
  })

  test('EV-6 (a) ".56" or "1,234" alone is not found in "1,234" ".56"; the whole group still matches', () => {
    const result = makeResult(line(['1,234', '.56']))
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: true })
    expect(valueInBox(result, amountBox, '1,234')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, amountBox, '0.56')).toEqual({ ok: false, reason: 'value not found' })
  })

  test('EV-6 (a) a zero-padded "001234" is not the amount 1,234.00', () => {
    const result = makeResult(line(['001234']))
    expect(valueInBox(result, amountBox, '1,234.00')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, amountBox, '1234')).toEqual({ ok: false, reason: 'value not found' })
  })

  test('EV-6 (a) a value next to a separate sign word is refused when read without its sign', () => {
    const cases: string[][] = [
      ['-', '1,234.56'],
      ['1,234.56', 'DR'],
      ['(', '1,234.56', ')'],
    ]
    for (const words of cases) {
      const result = makeResult(line(words))
      expect(valueInBox(result, amountBox, '1234.56'), words.join(' ')).toEqual({ ok: false, reason: 'value not found' })
      expect(valueInBox(result, amountBox, '-1234.56'), words.join(' ')).toEqual({ ok: true })
    }
  })

  test('EV-6 (a) "-" "1,234.56" matches -1234.56, and "1" "234.56", "1,234" ".56", "$" "1,234.56" still match 1234.56', () => {
    expect(valueInBox(makeResult(line(['-', '1,234.56'])), amountBox, '-1234.56')).toEqual({ ok: true })
    expect(valueInBox(makeResult(line(['-', '1,234.56'])), amountBox, '(1,234.56)')).toEqual({ ok: true })
    expect(valueInBox(makeResult(line(['1', '234.56'])), amountBox, '1234.56')).toEqual({ ok: true })
    expect(valueInBox(makeResult(line(['1,234', '.56'])), amountBox, '1234.56')).toEqual({ ok: true })
    expect(valueInBox(makeResult(line(['$', '1,234.56'])), amountBox, '1234.56')).toEqual({ ok: true })
    expect(valueInBox(makeResult(line(['1', '234', '567.89'])), amountBox, '1234567.89')).toEqual({ ok: true })
  })

  test('EV-6 (a) words on two different lines never join into one amount', () => {
    // "1" on the line at top 0.19, "234.56" on the line at top 0.21; no vertical overlap (heights 0.015).
    const result = makeResult([
      { text: '1', box: box(1, 0.6, 0.19, 0.01, 0.015), order: 1 },
      { text: '234.56', box: box(1, 0.6, 0.21, 0.07, 0.015), order: 2 },
    ])
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, amountBox, '234.56')).toEqual({ ok: true })
  })

  test('EV-6 (a) a whole amount word still matches next to label words on the same line', () => {
    const result = makeResult(line(['Balance', '1,234.56']))
    expect(valueInBox(result, amountBox, '1234.56')).toEqual({ ok: true })
  })
})

describe('normaliseAmount signs with a dollar sign (round 2)', () => {
  test('EV-6 (a) "$-1,234.56", "-$1,234.56" and "$(1,234.56)" read as negative', () => {
    for (const t of ['$-1,234.56', '-$1,234.56', '$(1,234.56)']) {
      expect(normaliseAmount(t), t).toEqual({ ok: true, cents: -123456 })
    }
  })
})

// ---------- Round 2: properties (EV-6, check 9, item b) ----------

// Integer-only formatting without the dollar sign: "1,234.56".
function formatPlain(cents: bigint): string {
  return formatDollars(cents).slice(1)
}

describe('valueInBox amount group properties (round 2)', () => {
  test('EV-6 (b) property: an adjacent sign word flips the match', () => {
    const signArb = fc.constantFrom('leading minus', 'trailing DR', 'brackets')
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 13n }), signArb, (cents, sign) => {
        const amount = formatPlain(cents)
        const words =
          sign === 'leading minus' ? ['-', amount] : sign === 'trailing DR' ? [amount, 'DR'] : ['(', amount, ')']
        const result = makeResult(line(words))
        const positive = `${(cents / 100n).toString()}.${(cents % 100n).toString().padStart(2, '0')}`
        expect(valueInBox(result, amountBox, positive)).toEqual({ ok: false, reason: 'value not found' })
        expect(valueInBox(result, amountBox, `-${positive}`)).toEqual({ ok: true })
        // Without the sign word the same amount matches the positive value and not the negative one.
        const bare = makeResult(line([amount]))
        expect(valueInBox(bare, amountBox, positive)).toEqual({ ok: true })
        expect(valueInBox(bare, amountBox, `-${positive}`)).toEqual({ ok: false, reason: 'value not found' })
      }),
      { seed: SEED, numRuns: 300 },
    )
  })

  test('EV-6 (b) property: a split whose second part is not a three-digit group never joins; one that is does', () => {
    // First part 1 to 3 digits, no leading zero. Second part: digits of length 1, 2, 4 or 5 (no
    // leading zero), optionally followed by ".dd". The glued value must never be found.
    const secondArb = fc.oneof(
      fc.integer({ min: 1, max: 9 }),
      fc.integer({ min: 10, max: 99 }),
      fc.integer({ min: 1000, max: 9999 }),
      fc.integer({ min: 10000, max: 99999 }),
    )
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        secondArb,
        fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
        fc.integer({ min: 0, max: 999 }),
        (first, second, decimals, three) => {
          const dec = decimals === undefined ? '' : `.${String(decimals).padStart(2, '0')}`
          const glued = makeResult(line([String(first), `${String(second)}${dec}`]))
          expect(valueInBox(glued, amountBox, `${String(first)}${String(second)}${dec}`)).toEqual({
            ok: false,
            reason: 'value not found',
          })
          // Control: a space-separated three-digit group (leading zeros allowed inside the group) joins.
          const group = String(three).padStart(3, '0')
          const joined = makeResult(line([String(first), `${group}${dec}`]))
          expect(valueInBox(joined, amountBox, `${String(first)}${group}${dec}`)).toEqual({ ok: true })
        },
      ),
      { seed: SEED, numRuns: 500 },
    )
  })
})

// ---------- Round 2: text values (EV-6, check 10, item c) ----------

describe('valueInBox text values (round 2)', () => {
  test('EV-6 (c) text joins words with one space: "Maple" "Leaf" matches "Maple Leaf", never "MapleLeaf"', () => {
    const result = makeResult([
      { text: 'Maple', box: box(1, 0.1, 0.05, 0.1, 0.02), order: 1 },
      { text: 'Leaf', box: box(1, 0.21, 0.05, 0.08, 0.02), order: 2 },
    ])
    const header = box(1, 0.05, 0.03, 0.5, 0.06)
    expect(valueInBox(result, header, 'Maple Leaf')).toEqual({ ok: true })
    expect(valueInBox(result, header, '  maple   LEAF ')).toEqual({ ok: true })
    expect(valueInBox(result, header, 'MapleLeaf')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, header, 'mapleleaf')).toEqual({ ok: false, reason: 'value not found' })
  })
})

// ---------- Round 2: leading zeros (EV-6, check 11, item d) ----------

describe('normaliseAmount leading zeros (round 2)', () => {
  test('EV-6 (d) an amount with a leading zero before other digits is refused with a reason', () => {
    for (const bad of ['001234', '01234.00', '$001,234', '00.56', '-0123']) {
      const r = normaliseAmount(bad)
      expect(r.ok, `"${bad}" should be refused`).toBe(false)
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0)
    }
  })

  test('EV-6 (d) a single zero before the decimal point passes: "0.56" is 56 cents, "$0.05" is 5 cents', () => {
    expect(normaliseAmount('0.56')).toEqual({ ok: true, cents: 56 })
    expect(normaliseAmount('$0.05')).toEqual({ ok: true, cents: 5 })
    expect(normaliseAmount('0')).toEqual({ ok: true, cents: 0 })
    expect(normaliseAmount('1,034.56')).toEqual({ ok: true, cents: 103456 })
  })
})

// ---------- Round 2: whole-box validity (EV-5, check 12, item e) ----------

describe('whole-box validity (round 2)', () => {
  test('EV-5 (e) BoxSchema refuses a box that overflows the page to the right or the bottom', () => {
    expect(BoxSchema.safeParse({ page: 1, left: 0.6, top: 0.1, width: 0.5, height: 0.05 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 1, left: 0.1, top: 0.9, width: 0.2, height: 0.25 }).success).toBe(false)
    expect(BoxSchema.safeParse({ page: 1, left: 1, top: 1, width: 1, height: 1 }).success).toBe(false)
    // Exactly to the edge is inside the page.
    expect(BoxSchema.safeParse({ page: 1, left: 0.75, top: 0.5, width: 0.25, height: 0.5 }).success).toBe(true)
    expect(BoxSchema.safeParse({ page: 1, left: 0, top: 0, width: 1, height: 1 }).success).toBe(true)
  })

  test('EV-5 (e) pointsToBox refuses a rect partly or wholly off the page, never clamping it', () => {
    const W = 612
    const H = 792
    const off = [
      { x: 600, y: 100, width: 50, height: 10 }, // runs off the right
      { x: -10, y: 100, width: 50, height: 10 }, // starts left of the page
      { x: 100, y: 780, width: 50, height: 30 }, // runs off the top (origin bottom left)
      { x: 100, y: -5, width: 50, height: 10 }, // starts below the page
      { x: 700, y: 900, width: 50, height: 10 }, // wholly off
    ]
    for (const rect of off) {
      expect(() => pointsToBox(1, rect, W, H), JSON.stringify(rect)).toThrow()
    }
    // Planted control: the same width inside the page converts.
    expect(BoxSchema.safeParse(pointsToBox(1, { x: 500, y: 100, width: 50, height: 10 }, W, H)).success).toBe(true)
  })

  test('EV-5 (e) pixelsToBox refuses a rect partly or wholly off the image, never clamping it', () => {
    const off = [
      { x: 2500, y: 100, width: 100, height: 10 },
      { x: 100, y: 3250, width: 100, height: 100 },
      { x: -1, y: 100, width: 100, height: 10 },
      { x: 100, y: -1, width: 100, height: 10 },
      { x: 3000, y: 4000, width: 10, height: 10 },
    ]
    for (const rect of off) {
      expect(() => pixelsToBox(1, rect, 2550, 3300), JSON.stringify(rect)).toThrow()
    }
    expect(BoxSchema.safeParse(pixelsToBox(1, { x: 2450, y: 100, width: 100, height: 10 }, 2550, 3300)).success).toBe(
      true,
    )
  })

  test('EV-5 (e) the converters refuse a page of zero width or height and a zero-size rect, never returning NaN', () => {
    const rect = { x: 10, y: 10, width: 50, height: 10 }
    expect(() => pointsToBox(1, rect, 0, 792)).toThrow()
    expect(() => pointsToBox(1, rect, 612, 0)).toThrow()
    expect(() => pixelsToBox(1, rect, 0, 3300)).toThrow()
    expect(() => pixelsToBox(1, rect, 2550, 0)).toThrow()
    expect(() => pointsToBox(1, { x: 10, y: 10, width: 0, height: 10 }, 612, 792)).toThrow()
    expect(() => pointsToBox(1, { x: 10, y: 10, width: 50, height: 0 }, 612, 792)).toThrow()
    expect(() => pixelsToBox(1, { x: 10, y: 10, width: 0, height: 10 }, 2550, 3300)).toThrow()
    expect(() => pixelsToBox(1, { x: 10, y: 10, width: 50, height: 0 }, 2550, 3300)).toThrow()
  })

  test('EV-5 (e) a result whose page list is not exactly pages 1 to pageCount is refused', () => {
    const page = (number: number) => ({ number, widthPt: 612, heightPt: 792, hasTextLayer: true })
    const result = (pageCount: number, numbers: number[]) => ({
      documentFingerprint: 'sha256:page-list-test',
      engine: { name: 'recorded (Test)', version: '1.0.0' },
      readAt: '2026-10-01T14:00:00.000Z',
      pageCount,
      pages: numbers.map(page),
      words: [],
    })
    expect(ReadingResultSchema.safeParse(result(2, [1, 2])).success).toBe(true)
    expect(ReadingResultSchema.safeParse(result(2, [1])).success, 'missing page 2').toBe(false)
    expect(ReadingResultSchema.safeParse(result(2, [1, 1])).success, 'page 1 twice').toBe(false)
    expect(ReadingResultSchema.safeParse(result(3, [1, 3])).success, 'gap at page 2').toBe(false)
    expect(ReadingResultSchema.safeParse(result(1, [])).success, 'no pages').toBe(false)
    expect(ReadingResultSchema.safeParse(result(2, [1, 2, 2])).success, 'extra page').toBe(false)
  })

  test('EV-5 (e) "box on another page" is given for any page the result does not have, below 1 or beyond pageCount', () => {
    const result = makeResult([...labelWords, amountWord], 2)
    expect(valueInBox(result, { ...amountBox, page: 3 }, '1234.56')).toEqual({ ok: false, reason: 'box on another page' })
    expect(valueInBox(result, { ...amountBox, page: 0 }, '1234.56')).toEqual({ ok: false, reason: 'box on another page' })
    expect(valueInBox(result, { ...amountBox, page: -1 }, '1234.56')).toEqual({ ok: false, reason: 'box on another page' })
    // A page the result has, with nothing in the box, is "no words in box", not "box on another page".
    expect(valueInBox(result, { ...amountBox, page: 2 }, '1234.56')).toEqual({ ok: false, reason: 'no words in box' })
  })
})

// ---------- Round 2: mutation marker (ARC-15, check 13, item f) ----------

describe('mutation testing marker (round 2)', () => {
  test('ARC-15 (f) reading.ts carries "// @mutate" in its first 5 lines, so mutate:changed runs Stryker on it', () => {
    const source = readFileSync(new URL('./reading.ts', import.meta.url), 'utf8')
    const head = source.split('\n').slice(0, 5)
    expect(head.some((l) => l.includes('// @mutate'))).toBe(true)
  })
})

// ---------- Round 3 (findings F09 round 2, RC-B; checks 17 and 18) ----------
//   normaliseAmount never returns -0: an amount of zero is 0 whatever its sign mark (amber A296 list).
//   pointsToBox and pixelsToBox throw RangeError (never ZodError, never a box) when any numeric
//   input (rect x, y, width, height, page width, page height) is NaN, Infinity or -Infinity.
//   amountGroups is not exported, so the groups are observed through normaliseAmount on the group
//   text valueInBox builds (sign words joined onto the amount) and through valueInBox itself.

describe('no amount returns -0 (round 3, check 17)', () => {
  test('EV-6 check 17 normaliseAmount reads "(0.00)", "-0", "-0.00", "0.00-" and "0.00 CR" as 0, never -0', () => {
    for (const text of ['(0.00)', '-0', '-0.00', '0.00-', '0.00 CR']) {
      const got = normaliseAmount(text)
      expect(got, text).toEqual({ ok: true, cents: 0 })
      const cents = got.ok ? got.cents : Number.NaN
      expect(Object.is(cents, 0), `${text} gave ${Object.is(cents, -0) ? '-0' : String(cents)}`).toBe(true)
    }
  })

  test('EV-6 check 17 the matching amount groups give 0, never -0, and still match the value zero', () => {
    // The group texts valueInBox builds when sign words join a zero amount.
    for (const group of ['(0.00)', '$(0.00)', '-$0.00', '$-0.00', '-0.00', '0.00-', '0.00DR', '0.00CR', '-0']) {
      const got = normaliseAmount(group)
      const cents = got.ok ? got.cents : Number.NaN
      expect(Object.is(cents, 0), `group ${group}`).toBe(true)
    }
    // The same zero amounts as separate words in a box match the value zero, with or without a sign.
    const splits: string[][] = [['(', '0.00', ')'], ['-', '0.00'], ['0.00', '-'], ['0.00', 'DR'], ['0.00', 'CR'], ['$', '-0.00']]
    for (const words of splits) {
      const result = makeResult(line(words))
      expect(valueInBox(result, amountBox, '0.00'), words.join(' ')).toEqual({ ok: true })
      expect(valueInBox(result, amountBox, '-0.00'), words.join(' ')).toEqual({ ok: true })
    }
  })

  test('EV-6 check 17 property: no input text yields -0 from normaliseAmount', () => {
    const zero = fc.constantFrom('0', '0.0', '0.00', '$0.00', '0.', '00')
    const lead = fc.constantFrom('', '-', '$-', '-$', '(', '$(', ' - ')
    const trail = fc.constantFrom('', '-', ' CR', ' DR', 'CR', 'DR', ')', ' -')
    const shaped = fc.tuple(lead, zero, trail).map(([a, b, c]) => (a.includes('(') ? `${a}${b})` : `${a}${b}${c}`))
    const amountish = fc.string({ unit: fc.constantFrom('0', '1', '-', '(', ')', '$', '.', ',', ' ', 'C', 'R', 'D') })
    fc.assert(
      fc.property(fc.oneof(shaped, amountish, fc.string()), (text) => {
        const got = normaliseAmount(text)
        if (got.ok) expect(Object.is(got.cents, -0), `"${text}" gave -0`).toBe(false)
      }),
      { seed: SEED, numRuns: 2000 },
    )
  })
})

describe('converters refuse non-finite input (round 3, check 18)', () => {
  type Field = 'x' | 'y' | 'width' | 'height' | 'pageWidth' | 'pageHeight'
  const FIELDS: readonly Field[] = ['x', 'y', 'width', 'height', 'pageWidth', 'pageHeight']
  const NON_FINITE: readonly number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
  type Inputs = { x: number; y: number; width: number; height: number; pageWidth: number; pageHeight: number }
  const CONVERTERS = {
    points: (i: Inputs) => pointsToBox(1, { x: i.x, y: i.y, width: i.width, height: i.height }, i.pageWidth, i.pageHeight),
    pixels: (i: Inputs) => pixelsToBox(1, { x: i.x, y: i.y, width: i.width, height: i.height }, i.pageWidth, i.pageHeight),
  } as const

  function outcome(fn: () => unknown): string {
    let value: unknown
    try {
      value = fn()
    } catch (e) {
      if (e instanceof RangeError) return 'RangeError'
      return e instanceof Error ? e.name : 'non-error throw'
    }
    return `returned ${JSON.stringify(value)}`
  }

  test('EV-5 check 18 NaN, Infinity or -Infinity in any field of either converter throws RangeError, never ZodError or a box', () => {
    const valid: Inputs = { x: 72, y: 100, width: 144, height: 20, pageWidth: 612, pageHeight: 792 }
    // The valid rect converts, so each failure below is caused by the one non-finite field.
    expect(outcome(() => CONVERTERS.points(valid))).toMatch(/^returned /)
    expect(outcome(() => CONVERTERS.pixels(valid))).toMatch(/^returned /)
    const wrong: string[] = []
    for (const [name, convert] of Object.entries(CONVERTERS)) {
      for (const field of FIELDS) {
        for (const bad of NON_FINITE) {
          const got = outcome(() => convert({ ...valid, [field]: bad }))
          if (got !== 'RangeError') wrong.push(`${name} ${field}=${String(bad)}: ${got}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  test('EV-5 check 18 property: over every converter, field and non-finite value, any valid rect throws RangeError', () => {
    const inputs = fc.record({
      x: fc.integer({ min: 0, max: 300 }),
      y: fc.integer({ min: 0, max: 300 }),
      width: fc.integer({ min: 1, max: 300 }),
      height: fc.integer({ min: 1, max: 300 }),
      pageWidth: fc.constant(612),
      pageHeight: fc.constant(792),
    })
    fc.assert(
      fc.property(
        inputs,
        fc.constantFrom('points' as const, 'pixels' as const),
        fc.constantFrom(...FIELDS),
        fc.constantFrom(...NON_FINITE),
        (valid, name, field, bad) => {
          expect(outcome(() => CONVERTERS[name](valid))).toMatch(/^returned /)
          expect(outcome(() => CONVERTERS[name]({ ...valid, [field]: bad })), `${name} ${field}=${String(bad)}`).toBe(
            'RangeError',
          )
        },
      ),
      { seed: SEED, numRuns: 500 },
    )
  })
})
