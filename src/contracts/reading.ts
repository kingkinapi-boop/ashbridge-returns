// The reading contract (F09): what any reading engine returns, and the one code check that a value
// sits inside a box (EV-6), used by extraction and by AI citations (AI-4). Money is integer cents.
import { z } from 'zod'

const fraction = z.number().min(0).max(1)

/** EV-5: a page plus left, top, width and height as fractions of the page (origin top left). */
export const BoxSchema = z.object({
  page: z.number().int().min(1),
  left: fraction,
  top: fraction,
  width: fraction,
  height: fraction,
})
export type Box = z.infer<typeof BoxSchema>

export const WordSchema = z.object({
  text: z.string(),
  box: BoxSchema,
  confidence: fraction,
  /** The engine's reading order. */
  order: z.number().int(),
})
export type Word = z.infer<typeof WordSchema>

export const PageSchema = z.object({
  number: z.number().int().min(1),
  /** Size in points, rotation already applied. */
  widthPt: z.number().positive(),
  heightPt: z.number().positive(),
  hasTextLayer: z.boolean(),
})

/** ARC-10: the engine name and version are stamped on every result and never blank. */
export const EngineStampSchema = z.object({
  name: z.string().trim().min(1),
  version: z.string().trim().min(1),
})

export const ReadingResultSchema = z
  .object({
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
    r.pages.forEach((p, i) => {
      if (p.number > r.pageCount) {
        ctx.addIssue({ code: 'custom', path: ['pages', i, 'number'], message: 'page is beyond the page count' })
      }
    })
  })
export type ReadingResult = z.infer<typeof ReadingResultSchema>

// ---- converters ----

export type PointsRect = { x: number; y: number; width: number; height: number }
export type PixelsRect = { x: number; y: number; width: number; height: number }

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** PDF points, origin bottom left, (x, y) the rect's bottom-left corner. */
export function pointsToBox(page: number, rect: PointsRect, pageWidthPt: number, pageHeightPt: number): Box {
  return {
    page,
    left: clamp01(rect.x / pageWidthPt),
    top: clamp01((pageHeightPt - (rect.y + rect.height)) / pageHeightPt),
    width: clamp01(rect.width / pageWidthPt),
    height: clamp01(rect.height / pageHeightPt),
  }
}

export function boxToPoints(box: Box, pageWidthPt: number, pageHeightPt: number): PointsRect {
  return {
    x: box.left * pageWidthPt,
    y: pageHeightPt - (box.top + box.height) * pageHeightPt,
    width: box.width * pageWidthPt,
    height: box.height * pageHeightPt,
  }
}

/** Image pixels, origin top left, (x, y) the rect's top-left corner. */
export function pixelsToBox(page: number, rect: PixelsRect, imageWidthPx: number, imageHeightPx: number): Box {
  return {
    page,
    left: clamp01(rect.x / imageWidthPx),
    top: clamp01(rect.y / imageHeightPx),
    width: clamp01(rect.width / imageWidthPx),
    height: clamp01(rect.height / imageHeightPx),
  }
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

export type AmountResult = { ok: true; cents: number } | { ok: false; reason: string }

const GROUPED = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/

/**
 * Integer cents from bank-statement text, with no floating point on the way.
 * Sign rules: brackets, a leading minus, a trailing minus and DR mean negative; CR (a credit to the
 * account) means positive. More than one sign mark is refused. Not a number: "1.234,56", "1.2E3", "".
 */
export function normaliseAmount(text: string): AmountResult {
  let s = text.replace(/\s+/g, '')
  if (s === '') return { ok: false, reason: 'empty amount' }
  let negative = 0
  let credit = false
  const tail = s.match(/(CR|DR)$/i)
  if (tail) {
    if (tail[1]?.toUpperCase() === 'DR') negative += 1
    else credit = true
    s = s.slice(0, -2)
  }
  if (s.startsWith('(') && s.endsWith(')')) {
    negative += 1
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative += 1
    s = s.slice(1)
  }
  if (s.endsWith('-')) {
    negative += 1
    s = s.slice(0, -1)
  }
  s = s.replace(/^\$/, '')
  if (negative > 1 || (negative > 0 && credit)) return { ok: false, reason: 'more than one sign mark' }
  const m = GROUPED.exec(s)
  if (!m) return { ok: false, reason: `"${text}" is not an amount in dollars and cents` }
  const dollars = (m[1] ?? '').replace(/,/g, '')
  const frac = (m[2] ?? '').padEnd(2, '0')
  if (dollars.length > 15) return { ok: false, reason: 'amount is too large' }
  const cents = Number(dollars) * 100 + Number(frac)
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: 'amount is too large' }
  return { ok: true, cents: negative > 0 ? -cents : cents }
}

// ---- the value-in-box check (EV-6) ----

export type ValueInBoxResult =
  | { ok: true }
  | { ok: false; reason: 'no words in box' | 'value not found' | 'box on another page' }

const foldText = (s: string): string => s.replace(/\s+/g, '').toLowerCase()

/**
 * True only when the value, normalised on both sides, is found among the words in the box: a
 * contiguous run of words in reading order (a value may span "1 234.56" or "$ 1,234.56").
 */
export function valueInBox(result: ReadingResult, box: Box, value: string): ValueInBoxResult {
  if (box.page > result.pageCount) return { ok: false, reason: 'box on another page' }
  const words = wordsInBox(result, box)
  if (words.length === 0) return { ok: false, reason: 'no words in box' }
  const wanted = normaliseAmount(value)
  const folded = foldText(value)
  for (let i = 0; i < words.length; i++) {
    let joined = ''
    for (let j = i; j < words.length; j++) {
      joined += words[j]?.text ?? ''
      if (wanted.ok) {
        const got = normaliseAmount(joined)
        if (got.ok && got.cents === wanted.cents) return { ok: true }
      } else if (foldText(joined) === folded) {
        return { ok: true }
      }
    }
  }
  return { ok: false, reason: 'value not found' }
}

// ---- the adapter every reading engine implements (ARC-6) ----

export type ReadingDocument = { fingerprint: string; fileName?: string; bytes?: Uint8Array }

export interface ReadingEngine {
  name: string
  isLive: boolean
  read(document: ReadingDocument): Promise<ReadingResult>
}
