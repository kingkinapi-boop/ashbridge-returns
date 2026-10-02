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
const ALL_MARKS = /^[$\-−(]+$/
const WHOLE_SO_FAR = /^[1-9]\d{0,2}(?:,\d{3})*$/
const NEGATIVE_LEAD = /[-−(]/

type Trail = '-' | ')' | 'CR' | 'DR'

/** A word made only of marks: leading marks, or one trailing mark ("CR", ")" and a lone "-" which is both). */
type Marks = { marks: true; lead: string; trail: Trail | '' }

/** A word with a number part (a word that fits no token is a separator, SEP, and lexes to null). */
type Part = {
  marks: false
  /** Leading marks attached to the word. */
  lead: string
  body: string
  trail: Trail | ''
  isNum: boolean
  isGrp3: boolean
  isCgrp: boolean
  isDec2: boolean
}

type Lexed = Marks | Part

function trailOf(rest: string): { body: string; trail: Trail | '' } {
  if (rest.endsWith('-')) return { body: rest.slice(0, -1), trail: '-' }
  if (rest.endsWith(')')) return { body: rest.slice(0, -1), trail: ')' }
  const tail = rest.slice(-2).toUpperCase()
  if (tail === 'CR' || tail === 'DR') return { body: rest.slice(0, -2), trail: tail }
  return { body: rest, trail: '' }
}

/** One word to its token parts, or null for a separator. */
function lex(raw: string): Lexed | null {
  const text = raw.trim()
  // A lone "-" is a leading or a trailing mark; the dash rule decides.
  if (ALL_MARKS.test(text)) return { marks: true, lead: text, trail: text === '-' ? '-' : '' }
  const lead = LEAD_CHARS.exec(text)?.[0] ?? ''
  const { body, trail } = trailOf(text.slice(lead.length))
  if (body === '') return lead === '' ? { marks: true, lead, trail } : null
  const isNum = AMOUNT_TOKENS.NUM.test(body)
  const isGrp3 = AMOUNT_TOKENS.GRP3.test(body)
  const isCgrp = AMOUNT_TOKENS.CGRP.test(body)
  const isDec2 = AMOUNT_TOKENS.DEC2.test(body)
  return { marks: false, lead, body, trail, isNum, isGrp3, isCgrp, isDec2 }
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
  // Stryker disable next-line StringLiteral: split always yields a first element, so the default is never used
  const [intPart = '', fracPart = ''] = whole.replace(/,/g, '').split('.')
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return { cents: 0, tooLarge: true }
  return { cents: negative && cents !== 0 ? -cents : cents, tooLarge: false }
}

/** The group that starts at word `start`, or null. */
function groupAt(spots: readonly Spot[], lexed: readonly (Lexed | null)[], start: number, tolerance: number): Found | null {
  const at = (i: number): Lexed | null => lexed[i] ?? null
  const spot = (i: number): Spot => spots[i] as Spot
  const next = (i: number): boolean => i + 1 < spots.length && adjacent(spot(i), spot(i + 1), tolerance)

  // Leading marks as their own words, then the number word.
  let lead = ''
  let i = start
  for (let w = at(i); w?.marks === true && w.lead !== ''; w = at(i)) {
    lead += w.lead
    if (!LEADS.has(lead) || !next(i)) return null
    i += 1
  }
  const first = at(i)
  if (first === null || first.marks || !first.isNum) return null
  lead += first.lead
  if (lead !== '' && !LEADS.has(lead)) return null

  let negative = NEGATIVE_LEAD.test(lead)
  const signed = negative
  const open = lead.includes('(')
  let closed = false as boolean
  let whole = first.body
  let decimals = whole.includes('.')
  let done = false

  /** Applies a trailing mark; false when it does not fit this group. */
  const takeTrail = (trail: Trail): boolean => {
    if (trail === ')') {
      if (!open || closed) return false
      closed = true
      return true
    }
    if (open || signed) return false
    // A mark taken here always ends the group, so the group never takes a second one
    negative = trail !== 'CR'
    return true
  }

  if (first.trail !== '') {
    if (!takeTrail(first.trail)) return null
    done = true
  }

  let end = i + 1
  while (!done && end < spots.length && adjacent(spot(end - 1), spot(end), tolerance)) {
    const w = at(end)
    if (w === null) break
    if (w.marks) {
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
    if (w.trail !== '') {
      if (!takeTrail(w.trail)) break
      done = true
    }
    whole = joined
    decimals = whole.includes('.')
    end += 1
  }
  if (open && !closed) return null
  return { end, ...centsOf(whole, negative) }
}

/** Every maximal group over positioned words (reading order), as index ranges. */
function groupsOver(spots: readonly Spot[], texts: readonly string[], tolerance: number): { start: number; found: Found }[] {
  const lexed = texts.map(lex)
  const out: { start: number; found: Found }[] = []
  let i = 0
  // Stryker disable next-line EqualityOperator: at i equal to the length groupAt finds nothing and the loop ends the same way
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
  const texts = text.match(/\S+/g) ?? []
  if (texts.length === 0) return { ok: false, reason: 'empty amount' }
  const spots: Spot[] = texts.map((_, k) => ({ left: k * 0.1, width: 0.1, top: 0, height: 1 }))
  const groups = groupsOver(spots, texts, DEFAULT_GAP_TOLERANCE)
  // Maximal groups are disjoint, so a first group that covers every word is the only group
  const only = groups[0]
  if (only === undefined || only.start !== 0 || only.found.end !== texts.length) {
    const marks = texts.map(lex).filter((w) => w !== null && (/[-−(]/.test(w.lead) || w.trail === '-' || w.trail === 'CR' || w.trail === 'DR')).length
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
  debitCredit: {
    dollar: false,
    thousands: ',',
    // Stryker disable next-line StringLiteral: 'DR' is the last branch of formatAmount, so any other text prints the same
    negative: 'DR',
    creditMark: true,
  },
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
