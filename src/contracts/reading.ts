// @mutate
// The reading contract (F09): what any reading engine returns, and the one code check that a value
// sits inside a box (EV-6), used by extraction and by AI citations (AI-4). Money is integer cents.
import { z } from 'zod'

const fraction = z.number().min(0).max(1)

/** EV-5: a page plus left, top, width and height as fractions of the page (origin top left). */
const EPS = 1e-9

export const BoxSchema = z
  .object({
    page: z.number().int().min(1),
    left: fraction,
    top: fraction,
    width: fraction,
    height: fraction,
  })
  .refine((b) => b.left + b.width <= 1 + EPS && b.top + b.height <= 1 + EPS, {
    message: 'box runs off the page',
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
const snap = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

function checkRect(rect: PointsRect, width: number, height: number): void {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError('page size must be above zero')
  }
  if (!(rect.width > 0) || !(rect.height > 0)) throw new RangeError('rect must have a width and a height')
  if (rect.x < -EPS || rect.y < -EPS || rect.x + rect.width > width + EPS || rect.y + rect.height > height + EPS) {
    throw new RangeError('rect runs off the page')
  }
}

/** PDF points, origin bottom left, (x, y) the rect's bottom-left corner. Throws on an off-page rect. */
export function pointsToBox(page: number, rect: PointsRect, pageWidthPt: number, pageHeightPt: number): Box {
  checkRect(rect, pageWidthPt, pageHeightPt)
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

/** Image pixels, origin top left, (x, y) the rect's top-left corner. Throws on an off-image rect. */
export function pixelsToBox(page: number, rect: PixelsRect, imageWidthPx: number, imageHeightPx: number): Box {
  checkRect(rect, imageWidthPx, imageHeightPx)
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

export type AmountResult = { ok: true; cents: number } | { ok: false; reason: string }

const GROUPED = /^(0|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)(?:\.(\d{1,2}))?$/

/**
 * Integer cents from bank-statement text, with no floating point on the way.
 * Sign rules: brackets, a leading minus, a trailing minus and DR mean negative; CR (a credit to the
 * account) means positive. More than one sign mark is refused. A "$" may sit either side of a leading
 * sign. Not a number: "1.234,56", "1.2E3", "" and an amount with a leading zero ("001234").
 */
export function normaliseAmount(text: string): AmountResult {
  let s = text.replace(/\s+/g, '')
  if (s === '') return { ok: false, reason: 'empty amount' }
  let negative = 0
  let credit = false
  let dollars = 0
  const tail = s.match(/(CR|DR)$/i)
  if (tail) {
    if (tail[1]?.toUpperCase() === 'DR') negative += 1
    else credit = true
    s = s.slice(0, -2)
  }
  if (s.startsWith('$')) {
    dollars += 1
    s = s.slice(1)
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
  if (s.startsWith('$')) {
    dollars += 1
    s = s.slice(1)
  }
  if (negative > 1 || (negative > 0 && credit)) return { ok: false, reason: 'more than one sign mark' }
  const m = dollars > 1 ? null : GROUPED.exec(s)
  if (!m) return { ok: false, reason: `"${text}" is not an amount in dollars and cents` }
  const whole = (m[1] ?? '').replace(/,/g, '')
  const frac = (m[2] ?? '').padEnd(2, '0')
  if (whole.length > 15) return { ok: false, reason: 'amount is too large' }
  const cents = Number(whole) * 100 + Number(frac)
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: 'amount is too large' }
  return { ok: true, cents: negative > 0 ? -cents : cents }
}

// ---- the value-in-box check (EV-6) ----

export type ValueInBoxResult =
  | { ok: true }
  | { ok: false; reason: 'no words in box' | 'value not found' | 'box on another page' }

const foldText = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

const sameLine = (a: Word, b: Word): boolean =>
  a.box.top < b.box.top + b.box.height && b.box.top < a.box.top + a.box.height

const SIGN_ONLY = /^[-$(]+$/
const TRAILING_SIGN = /^(\)|-|CR|DR)$/i
const DECIMALS = /^\.\d{1,2}$/
const COMMA_GROUP = /^,\d{3}(\.\d{1,2})?$/
const SPACE_GROUP = /^\d{3}(\.\d{1,2})?$/
const WHOLE_TAIL = /(?:^|[^\d.,])\d{1,3}(?:,\d{3})*$/
const OPENS_AMOUNT = /^[\d$(.-]/

/** What the group text becomes when `next` joins it, or null when `next` starts a new group. */
function joinWord(group: string, next: string): string | null {
  if (SIGN_ONLY.test(group)) return OPENS_AMOUNT.test(next) ? group + next : null
  if (!/\d$/.test(group)) return null
  if (TRAILING_SIGN.test(next)) return group + next
  if (DECIMALS.test(next) || COMMA_GROUP.test(next)) return /[.]/.test(group) ? null : group + next
  if (SPACE_GROUP.test(next)) return WHOLE_TAIL.test(group) ? `${group},${next}` : null
  return null
}

/** The words read into maximal amount groups: same line, reading order, joined only by the rules above. */
function amountGroups(words: Word[]): string[] {
  const groups: string[] = []
  let current = ''
  let last: Word | undefined
  for (const w of words) {
    const joined = last && sameLine(last, w) ? joinWord(current, w.text) : null
    if (joined === null) {
      if (last) groups.push(current)
      current = w.text
    } else {
      current = joined
    }
    last = w
  }
  if (last) groups.push(current)
  return groups
}

/**
 * True only when the value, normalised on both sides, equals a whole amount group among the words in
 * the box (never part of a group, never two groups glued). A value that is not an amount is text:
 * a contiguous run of words joined by one space, trimmed, case folded.
 */
export function valueInBox(result: ReadingResult, box: Box, value: string): ValueInBoxResult {
  if (box.page < 1 || box.page > result.pageCount) return { ok: false, reason: 'box on another page' }
  const words = wordsInBox(result, box)
  if (words.length === 0) return { ok: false, reason: 'no words in box' }
  const wanted = normaliseAmount(value)
  if (wanted.ok) {
    for (const group of amountGroups(words)) {
      const got = normaliseAmount(group)
      if (got.ok && got.cents === wanted.cents) return { ok: true }
    }
    return { ok: false, reason: 'value not found' }
  }
  const folded = foldText(value)
  for (let i = 0; i < words.length; i++) {
    let joined = ''
    for (let j = i; j < words.length; j++) {
      joined = j === i ? (words[j]?.text ?? '') : `${joined} ${words[j]?.text ?? ''}`
      if (foldText(joined) === folded) return { ok: true }
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
