// @mutate
// The reading contract (F09): what any reading engine returns, and the one code check that a value
// sits inside a box (EV-6), used by extraction and by AI citations (AI-4). Money is integer cents.
import { z } from 'zod'
import { amountGroups, normaliseAmount, type AmountResult } from './amount-grammar'

const fraction = z.number().min(0).max(1)

/** EV-5: a page plus left, top, width and height as fractions of the page (origin top left). */
const EPS = 1e-9

const fitsPage = (b: { left: number; width: number; top: number; height: number }): boolean =>
  // Stryker disable next-line EqualityOperator: the tolerance edge (exactly 1 + 1e-9) is float noise, no clause or input reaches it
  b.left + b.width <= 1 + EPS && b.top + b.height <= 1 + EPS

export const BoxSchema = z
  .strictObject({
    page: z.number().int().min(1),
    left: fraction,
    top: fraction,
    width: fraction,
    height: fraction,
  })
  .refine(fitsPage, { message: 'box runs off the page' })
export type Box = z.infer<typeof BoxSchema>

export const WordSchema = z.strictObject({
  /** Never blank: a blank word would let a blank value count as found (EV-6, AI-4). */
  text: z.string().refine((t) => t.trim() !== '', { message: 'word text must not be blank' }),
  box: BoxSchema,
  confidence: fraction,
  /** The engine's reading order. */
  order: z.number().int(),
})
export type Word = z.infer<typeof WordSchema>

export const PageSchema = z.strictObject({
  number: z.number().int().min(1),
  /** Size in points, rotation already applied. */
  widthPt: z.number().positive(),
  heightPt: z.number().positive(),
  hasTextLayer: z.boolean(),
})

/** ARC-10: the engine name and version are stamped on every result and never blank. */
export const EngineStampSchema = z.strictObject({
  name: z.string().trim().min(1),
  version: z.string().trim().min(1),
})

export const ReadingResultSchema = z
  .strictObject({
    documentFingerprint: z.string().min(1),
    engine: EngineStampSchema,
    /** From the injected clock (src/core/clock.ts). */
    readAt: z.iso.datetime({ offset: true }),
    pageCount: z.number().int().min(1),
    pages: z.array(PageSchema),
    words: z.array(WordSchema),
  })
  .superRefine((r, ctx) => {
    r.words.forEach((w, i) => {
      if (w.box.page > r.pageCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['words', i, 'box', 'page'],
          message: `page ${String(w.box.page)} is beyond the page count ${String(r.pageCount)}`,
        })
      }
    })
    const numbers = r.pages.map((p) => p.number).sort((a, b) => a - b)
    if (numbers.length !== r.pageCount || numbers.some((n, i) => n !== i + 1)) {
      ctx.addIssue({ code: 'custom', path: ['pages'], message: `pages must be exactly 1 to ${String(r.pageCount)}` })
    }
  })
export type ReadingResult = z.infer<typeof ReadingResultSchema>

// ---- converters ----

export type PointsRect = { x: number; y: number; width: number; height: number }
export type PixelsRect = { x: number; y: number; width: number; height: number }

/** A fraction that overshot 0 or 1 only by float noise is snapped; a real overshoot was refused earlier. */
const snap = (n: number): number => Math.min(1, Math.max(0, n))

const RECT_FIELDS = ['x', 'y', 'width', 'height'] as const

function checkRect(page: number, rect: PointsRect, width: number, height: number): void {
  if (!Number.isInteger(page) || page < 1) throw new RangeError('page must be a whole number from 1')
  for (const f of RECT_FIELDS) {
    if (!Number.isFinite(rect[f])) throw new RangeError(`rect ${f} must be a finite number`)
  }
  if (!Number.isFinite(width)) throw new RangeError('page width must be a finite number')
  if (!Number.isFinite(height)) throw new RangeError('page height must be a finite number')
  if (!(width > 0) || !(height > 0)) throw new RangeError('page size must be above zero')
  if (!(rect.width > 0) || !(rect.height > 0)) throw new RangeError('rect must have a width and a height')
  // Stryker disable next-line EqualityOperator: the tolerance edge (exactly 1e-9 off the page) is float noise, no clause or input reaches it
  if (rect.x < -EPS || rect.y < -EPS || rect.x + rect.width > width + EPS || rect.y + rect.height > height + EPS) {
    throw new RangeError('rect runs off the page')
  }
}

/**
 * PDF points, origin bottom left, (x, y) the rect's bottom-left corner. Throws RangeError on an off-page
 * or non-finite rect.
 * @converter
 */
export function pointsToBox(page: number, rect: PointsRect, pageWidthPt: number, pageHeightPt: number): Box {
  checkRect(page, rect, pageWidthPt, pageHeightPt)
  return BoxSchema.parse({
    page,
    left: snap(rect.x / pageWidthPt),
    top: snap((pageHeightPt - (rect.y + rect.height)) / pageHeightPt),
    width: snap(rect.width / pageWidthPt),
    height: snap(rect.height / pageHeightPt),
  })
}

export function boxToPoints(box: Box, pageWidthPt: number, pageHeightPt: number): PointsRect {
  return {
    x: box.left * pageWidthPt,
    y: pageHeightPt - (box.top + box.height) * pageHeightPt,
    width: box.width * pageWidthPt,
    height: box.height * pageHeightPt,
  }
}

/**
 * Image pixels, origin top left, (x, y) the rect's top-left corner. Throws RangeError on an off-image
 * or non-finite rect.
 * @converter
 */
export function pixelsToBox(page: number, rect: PixelsRect, imageWidthPx: number, imageHeightPx: number): Box {
  checkRect(page, rect, imageWidthPx, imageHeightPx)
  return BoxSchema.parse({
    page,
    left: snap(rect.x / imageWidthPx),
    top: snap(rect.y / imageHeightPx),
    width: snap(rect.width / imageWidthPx),
    height: snap(rect.height / imageHeightPx),
  })
}

// ---- words in a box ----

/** The words on the box's page whose centre lies inside the box, in reading order. */
export function wordsInBox(result: ReadingResult, box: Box): Word[] {
  return result.words
    .filter((w) => {
      if (w.box.page !== box.page) return false
      const cx = w.box.left + w.box.width / 2
      const cy = w.box.top + w.box.height / 2
      return cx >= box.left && cx <= box.left + box.width && cy >= box.top && cy <= box.top + box.height
    })
    .sort((a, b) => a.order - b.order)
}

// ---- amounts ----

export { normaliseAmount }
export type { AmountResult }

// ---- the value-in-box check (EV-6) ----

export type ValueInBoxResult =
  | { ok: true }
  | { ok: false; reason: 'no words in box' | 'value not found' | 'box on another page' }

const collapse = (s: string): string => s.trim().replace(/\s+/g, ' ')
// Stryker disable next-line MethodExpression: toLowerCase and toUpperCase fold both sides alike, so either compares the same
const foldText = (s: string): string => collapse(s).toLowerCase()

/**
 * True only when the value, normalised on both sides, equals a whole amount group among the words in
 * the box (never part of a group, never two groups glued). A value that is not an amount is text:
 * a contiguous run of words joined by one space, trimmed, case folded.
 */
export function valueInBox(result: ReadingResult, box: Box, value: string): ValueInBoxResult {
  const parsed = ReadingResultSchema.parse(result)
  if (box.page < 1 || box.page > parsed.pageCount) return { ok: false, reason: 'box on another page' }
  const words = wordsInBox(parsed, box)
  if (words.length === 0) return { ok: false, reason: 'no words in box' }
  const folded = foldText(value)
  const wanted = normaliseAmount(value)
  if (wanted.ok) {
    return amountGroups(words).some((g) => g.cents === wanted.cents) ? { ok: true } : { ok: false, reason: 'value not found' }
  }
  const texts = words.map((w) => w.text)
  const found = texts.some((_, i) => {
    const run: string[] = []
    return texts.slice(i).some((t) => {
      run.push(t)
      return foldText(run.join(' ')) === folded
    })
  })
  if (found) return { ok: true }
  return { ok: false, reason: 'value not found' }
}

// valueInBox parses its result through ReadingResultSchema (it throws on a refused result); `read` is an
// interface only, so each engine (A01 to A03) parses its own output.

// ---- the adapter every reading engine implements (ARC-6) ----

export type ReadingDocument = { fingerprint: string; fileName?: string; bytes?: Uint8Array }

export interface ReadingEngine {
  name: string
  isLive: boolean
  read(document: ReadingDocument): Promise<ReadingResult>
}
