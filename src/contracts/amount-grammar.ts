// @mutate
// The amount grammar (F09A, EV-6, ARC-8): one lexer, one table, one group function. Reading one amount
// from text, reading the amount groups among a box's words, and the formats the test world prints.
// Money is integer cents; no floating point on the way. Amber A296 (the dash rule).
import type { Word } from './reading'

export type AmountResult = { ok: true; cents: number } | { ok: false; reason: string }

/** An amount group among words: its integer cents and the input words it covers (sign words included). */
export type AmountGroup = { cents: number; words: Word[] }

/** The grammar table (EV-6): token patterns as data. A group is `LEAD* NUM (GRP3|CGRP)* DEC2? TRAIL?`. */
export const AMOUNT_TOKENS = {
  /** A whole word. A single word may carry one decimal digit; a joined decimal never does. */
  NUM: /^(?:0|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)(?:\.\d{1,2})?$/,
  /** A space-separated thousands group. */
  GRP3: /^\d{3}(?:\.\d\d)?$/,
  /** A comma thousands group as its own word. */
  CGRP: /^,\d{3}(?:\.\d\d)?$/,
  /** Decimals as their own word: exactly two digits. */
  DEC2: /^\.\d\d$/,
  LEAD: ['-', '−', '$', '(', '$-', '-$', '$(', '($', '−$'],
  TRAIL: ['-', ')', 'CR', 'DR'],
} as const

const LEADS: ReadonlySet<string> = new Set(AMOUNT_TOKENS.LEAD)
const LEAD_CHARS = /^[$\-−(]+/
const WHOLE_SO_FAR = /^[1-9]\d{0,2}(?:,\d{3})*$/
const NEGATIVE_LEAD = /[-−(]/

type Trail = '-' | ')' | 'CR' | 'DR'

type Lexed = {
  /** Leading marks attached to the word (the whole text for a marks-only word). */
  lead: string
  /** The number part, or '' for a marks-only word. */
  body: string
  trail: Trail | ''
  isNum: boolean
  isGrp3: boolean
  isCgrp: boolean
  isDec2: boolean
}

const NOT_AMOUNT: Lexed = { lead: '', body: '', trail: '', isNum: false, isGrp3: false, isCgrp: false, isDec2: false }

function trailOf(rest: string): { body: string; trail: Trail | '' } {
  if (rest.endsWith('-')) return { body: rest.slice(0, -1), trail: '-' }
  if (rest.endsWith(')')) return { body: rest.slice(0, -1), trail: ')' }
  const tail = rest.slice(-2).toUpperCase()
  if (tail === 'CR' || tail === 'DR') return { body: rest.slice(0, -2), trail: tail }
  return { body: rest, trail: '' }
}

/** One word to its token parts. A word that fits no token is a separator (SEP). */
function lex(raw: string): Lexed {
  const text = raw.trim()
  if (LEAD_CHARS.test(text) && LEAD_CHARS.exec(text)?.[0] === text) {
    // A lone "-" is a leading or a trailing mark; the dash rule decides.
    return LEADS.has(text) ? { ...NOT_AMOUNT, lead: text, trail: text === '-' ? '-' : '' } : NOT_AMOUNT
  }
  const lead = LEAD_CHARS.exec(text)?.[0] ?? ''
  if (lead !== '' && !LEADS.has(lead)) return NOT_AMOUNT
  const { body, trail } = trailOf(text.slice(lead.length))
  if (body === '') return trail !== '' && lead === '' ? { ...NOT_AMOUNT, trail } : NOT_AMOUNT
  const isNum = AMOUNT_TOKENS.NUM.test(body)
  const isGrp3 = AMOUNT_TOKENS.GRP3.test(body)
  const isCgrp = AMOUNT_TOKENS.CGRP.test(body)
  const isDec2 = AMOUNT_TOKENS.DEC2.test(body)
  if (!isNum && !isGrp3 && !isCgrp && !isDec2) return NOT_AMOUNT
  return { lead, body, trail, isNum, isGrp3, isCgrp, isDec2 }
}

/** The geometry the grouping needs from a word, in page fractions. */
type Spot = { left: number; width: number; top: number; height: number }

const sameLine = (a: Spot, b: Spot): boolean => a.top < b.top + b.height && b.top < a.top + a.height

/** Same line and a gap between the words no wider than `tolerance` word heights. */
const adjacent = (a: Spot, b: Spot, tolerance: number): boolean =>
  sameLine(a, b) && b.left - (a.left + a.width) <= a.height * tolerance

/** The default join gap: one word height. */
export const DEFAULT_GAP_TOLERANCE = 1

type Found = { end: number; cents: number; tooLarge: boolean }

function centsOf(whole: string, negative: boolean): { cents: number; tooLarge: boolean } {
  const [intPart = '', fracPart = ''] = whole.replace(/,/g, '').split('.')
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return { cents: 0, tooLarge: true }
  return { cents: negative && cents !== 0 ? -cents : cents, tooLarge: false }
}

/** The group that starts at word `start`, or null. */
function groupAt(spots: readonly Spot[], lexed: readonly Lexed[], start: number, tolerance: number): Found | null {
  const at = (i: number): Lexed => lexed[i] ?? NOT_AMOUNT
  const spot = (i: number): Spot => spots[i] as Spot
  const next = (i: number): boolean => i + 1 < spots.length && adjacent(spot(i), spot(i + 1), tolerance)

  // Leading marks as their own words, then the number word.
  let lead = ''
  let i = start
  while (i < spots.length && at(i).body === '' && at(i).lead !== '') {
    lead += at(i).lead
    if (!LEADS.has(lead) || !next(i)) return null
    i += 1
  }
  const first = at(i)
  if (i >= spots.length || !first.isNum) return null
  lead += first.lead
  if (lead !== '' && !LEADS.has(lead)) return null

  let sign: 'none' | 'negative' | 'credit' = NEGATIVE_LEAD.test(lead) ? 'negative' : 'none'
  const open = lead.includes('(')
  const bracket = { closed: false }
  let whole = first.body
  let decimals = whole.includes('.')
  let done = false

  /** Applies a trailing mark; false when it does not fit this group. */
  const takeTrail = (trail: Trail): boolean => {
    if (trail === ')') {
      if (!open || bracket.closed) return false
      bracket.closed = true
      return true
    }
    if (open || sign !== 'none') return false
    sign = trail === 'CR' ? 'credit' : 'negative'
    return true
  }

  if (first.trail !== '') {
    if (!takeTrail(first.trail)) return null
    done = true
  }

  let end = i + 1
  while (!done && end < spots.length && adjacent(spot(end - 1), spot(end), tolerance)) {
    const w = at(end)
    if (w.body === '') {
      // A marks-only word: only a trailing mark can join, and a "-" followed by an amount leads that amount.
      if (w.trail === '' || (w.trail === '-' && next(end) && groupAt(spots, lexed, end + 1, tolerance) !== null)) break
      if (!takeTrail(w.trail)) break
      done = true
      end += 1
      continue
    }
    if (w.lead !== '') break
    const joinsWhole = !decimals && WHOLE_SO_FAR.test(whole)
    let joined: string
    if (w.isDec2 && !decimals) joined = whole + w.body
    else if (w.isGrp3 && joinsWhole) joined = `${whole},${w.body}`
    else if (w.isCgrp && joinsWhole) joined = whole + w.body
    else break
    if (w.trail !== '' && !takeTrail(w.trail)) break
    if (w.trail !== '') done = true
    whole = joined
    decimals = whole.includes('.')
    end += 1
  }
  if (open && !bracket.closed) return null
  return { end, ...centsOf(whole, sign === 'negative') }
}

/** Every maximal group over positioned words (reading order), as index ranges. */
function groupsOver(spots: readonly Spot[], texts: readonly string[], tolerance: number): { start: number; found: Found }[] {
  const lexed = texts.map(lex)
  const out: { start: number; found: Found }[] = []
  let i = 0
  while (i < spots.length) {
    const found = groupAt(spots, lexed, i, tolerance)
    if (found === null) {
      i += 1
    } else {
      out.push({ start: i, found })
      i = found.end
    }
  }
  return out
}

/**
 * The maximal amount groups among words in reading order: same line, a gap no wider than the word height
 * (`tolerance`, in word heights), joined only by the grammar table. Each group has its integer cents and
 * the words it covers.
 * @money
 */
export function amountGroups(words: readonly Word[], tolerance: number = DEFAULT_GAP_TOLERANCE): AmountGroup[] {
  const spots = words.map((w) => w.box)
  const texts = words.map((w) => w.text)
  return groupsOver(spots, texts, tolerance)
    .filter(({ found }) => !found.tooLarge)
    .map(({ start, found }) => ({ cents: found.cents, words: words.slice(start, found.end) }))
}

/**
 * Integer cents from amount text: the text is split on spaces into words and must give exactly one group
 * that covers every word. Sign rules: brackets, a leading minus (also U+2212), a trailing minus and DR mean
 * negative; CR means positive; one sign mark only. Not a number: "1.234,56", "1.2E3", "" and leading zeros.
 * @money
 */
export function normaliseAmount(text: string): AmountResult {
  const texts = text.split(/\s+/).filter((w) => w !== '')
  if (texts.length === 0) return { ok: false, reason: 'empty amount' }
  const spots: Spot[] = texts.map((_, k) => ({ left: k * 0.1, width: 0.1, top: 0, height: 1 }))
  const groups = groupsOver(spots, texts, DEFAULT_GAP_TOLERANCE)
  const only = groups.length === 1 ? groups[0] : undefined
  if (only === undefined || only.start !== 0 || only.found.end !== texts.length) {
    const marks = texts.map(lex).filter((w) => /[-−(]/.test(w.lead) || w.trail === '-' || w.trail === 'CR' || w.trail === 'DR').length
    return marks > 1
      ? { ok: false, reason: 'more than one sign mark' }
      : { ok: false, reason: `"${text}" is not an amount in dollars and cents` }
  }
  if (only.found.tooLarge) return { ok: false, reason: 'amount is too large' }
  return { ok: true, cents: only.found.cents }
}

// ---- the formats the test world prints and the spreadsheet reader compares (ARC-8) ----

export type AmountFormat = {
  dollar: boolean
  /** Thousands separator: a comma, or a space (as its own words). */
  thousands: ',' | ' '
  /** How a negative amount is marked. */
  negative: 'leading' | 'trailing' | 'brackets' | 'DR'
  /** A positive amount carries CR (a credit) instead of nothing. */
  creditMark?: boolean
}

export const AMOUNT_FORMATS: Readonly<Record<string, AmountFormat>> = {
  plain: { dollar: false, thousands: ',', negative: 'leading' },
  dollar: { dollar: true, thousands: ',', negative: 'leading' },
  spaces: { dollar: false, thousands: ' ', negative: 'leading' },
  trailingMinus: { dollar: false, thousands: ',', negative: 'trailing' },
  dollarTrailingMinus: { dollar: true, thousands: ',', negative: 'trailing' },
  brackets: { dollar: false, thousands: ',', negative: 'brackets' },
  dollarBrackets: { dollar: true, thousands: ',', negative: 'brackets' },
  debitCredit: { dollar: false, thousands: ',', negative: 'DR', creditMark: true },
}

/**
 * Cents as text in one of the formats: two decimals, thousands groups, the format's negative mark. Zero
 * (and -0) prints with no negative mark.
 * @money
 */
export function formatAmount(cents: number, format: AmountFormat): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError('cents must be a safe integer')
  const abs = Math.abs(cents)
  const dollars = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands)
  const number = `${dollars}.${String(abs % 100).padStart(2, '0')}`
  const dollar = format.dollar ? '$' : ''
  if (cents >= 0) return `${dollar}${number}${format.creditMark === true && cents > 0 ? ' CR' : ''}`
  if (format.negative === 'leading') return `-${dollar}${number}`
  if (format.negative === 'trailing') return `${dollar}${number}-`
  if (format.negative === 'brackets') return `(${dollar}${number})`
  return `${dollar}${number} DR`
}
