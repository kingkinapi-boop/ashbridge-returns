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
            return { text: `w${i} (Test)`, box: box(1, cx - hw, cy - hh, 2 * hw, 2 * hh), order: orders[i]! }
          })
          const result = makeResult(permute(words, shuffleSeed + 7), 2)
          const theBox = box(1, l / 64, t / 64, (r - l) / 64, (b - t) / 64)

          const expected = specs
            .map((s, i) => ({ s, w: words[i]! }))
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
    ;[out[i], out[j]] = [out[j]!, out[i]!]
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
    raw.words[0]!.box.page = 2
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
      read: async () => recorded,
    }
    expectTypeOf(standIn.read).returns.resolves.toEqualTypeOf<ReadingResult>()
    expectTypeOf(standIn.isLive).toEqualTypeOf<boolean>()
    expectTypeOf(standIn.name).toEqualTypeOf<string>()
    const out = await standIn.read(undefined as unknown as Parameters<ReadingEngine['read']>[0])
    expect(ReadingResultSchema.safeParse(out).success).toBe(true)
    expect(valueInBox(out, amountBox, '1234.56')).toEqual({ ok: true })
  })
})
