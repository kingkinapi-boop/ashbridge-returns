// F09A acceptance tests: the amount grammar, written down once as a table (EV-6, EV-5, ARC-8, ARC-15).
// Written by the spec-writer before the build. The builder never edits this file.
//
// API the builder must export from src/contracts/amount-grammar.ts (the card's Build section):
//
//   normaliseAmount(text: string): AmountResult
//       AmountResult is reading.ts's: { ok: true, cents: number } | { ok: false, reason: string }.
//       Splits the text on spaces into words and must give exactly one amount group that covers
//       every word; anything else is "not a number" with a non-empty reason. Integer cents, never -0.
//   amountGroups(words: readonly Word[], ...optional tolerance): AmountGroup[]
//       Word is reading.ts's Word (text, box in page fractions, confidence, order). The words come in
//       reading order. Returns the maximal amount groups in reading order, each { cents, words },
//       where words are the input words the group covers (sign words included). A tolerance
//       parameter may follow; these tests use only its default (a gap no wider than the word height).
//   AMOUNT_FORMATS: the amount-format table (an array or a record; these tests read Object.values).
//   formatAmount(cents: number, format): string   (format: one entry of AMOUNT_FORMATS)
//   normaliseAmount, amountGroups and formatAmount carry `@money` in their JSDoc; the file carries
//   `// @mutate` in its first 5 lines. reading.ts re-exports the same normaliseAmount function.
//
// Readings this spec takes where the card leaves room (ambers, see the spec report):
//   - "exactly one group" for normaliseAmount means one group covering every word: "Fee 5.00",
//     "5.00 )" and "( 5.00" are not numbers.
//   - Sign marks may sit attached to the first or last word of a group ("$1,234.56", "(5.00", "567.89-").
//   - The gap between two words is the left edge of the second minus the right edge of the first,
//     compared with the word height, both as page fractions. The fixtures keep every tight gap at a
//     tenth of the word height and every wide gap at four word heights, so measuring in points on a
//     612 x 792 page gives the same answers.
//   - One sign mark per group: a second minus or a CR after a minus is not joined (the group keeps
//     its first sign; the extra mark joins nothing).
//   - Zero formats with no negative mark: formatAmount(-0, f) equals formatAmount(0, f).

import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import fc from 'fast-check'
import { fixedClock, getClock, setClock, type Clock } from '../core/clock'
import { AMOUNT_FORMATS, amountGroups, formatAmount, normaliseAmount } from './amount-grammar'
import { readOwnSource } from '../core/testing/read-own-source'
import {
  ReadingResultSchema,
  WordSchema,
  normaliseAmount as readingNormaliseAmount,
  valueInBox,
  type Box,
  type ReadingResult,
  type Word,
} from './reading'

const SEED = 20261002

let savedClock: Clock
beforeAll(() => {
  savedClock = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterAll(() => {
  setClock(savedClock)
})

// ---------- fixtures ----------

const WORD_HEIGHT = 0.02
const TIGHT_GAP = 0.002 // a tenth of the word height
const WIDE_GAP = 0.08 // four word heights
const LINE_STEP = 0.05
const FIRST_TOP = 0.2
const START_LEFT = 0.02

const WIDE = { kind: 'wide gap' } as const
const NEXT_LINE = { kind: 'next line' } as const
type Item = string | typeof WIDE | typeof NEXT_LINE
type Spec = readonly Item[]

const wordWidth = (text: string): number => 0.004 + 0.005 * text.length

/** Lays words out left to right on one line (tight gaps), in reading order. */
function lay(spec: Spec): Word[] {
  const words: Word[] = []
  let left = START_LEFT
  let top = FIRST_TOP
  let gap = 0
  for (const item of spec) {
    if (typeof item !== 'string') {
      if (item.kind === 'wide gap') {
        gap = WIDE_GAP
      } else {
        top += LINE_STEP
        left = START_LEFT
        gap = 0
      }
      continue
    }
    left += gap
    const width = wordWidth(item)
    if (left + width > 0.99) throw new Error(`test fixture: line too long at "${item}"`)
    words.push({ text: item, box: { page: 1, left, top, width, height: WORD_HEIGHT }, confidence: 0.99, order: words.length + 1 })
    left += width
    gap = TIGHT_GAP
  }
  return words
}

const WHOLE_PAGE_BAND: Box = { page: 1, left: 0, top: 0.1, width: 1, height: 0.4 }

function resultOf(words: readonly Word[]): ReadingResult {
  return ReadingResultSchema.parse({
    documentFingerprint: 'sha256:statement-birch-lane-bakery-test',
    engine: { name: 'recorded (Test)', version: '1.0.0' },
    readAt: '2026-10-02T13:00:00.000Z',
    pageCount: 1,
    pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
    words,
  })
}

/** Plain cents text with no commas or dollar sign: -123456 is "-1234.56", 0 is "0.00". */
function centsText(cents: number): string {
  const abs = Math.abs(cents)
  const sign = cents < 0 ? '-' : ''
  return `${sign}${String(Math.trunc(abs / 100))}.${String(abs % 100).padStart(2, '0')}`
}

type GroupView = readonly [number, readonly string[]]
const view = (words: readonly Word[]): GroupView[] =>
  amountGroups(words).map((g) => [g.cents, g.words.map((w) => w.text)] as const)

const NOT_FOUND = { ok: false, reason: 'value not found' }

// ---------- check 14: the grammar table, one row per rule ----------

type Row = {
  rule: string
  words: Spec
  groups: readonly GroupView[]
  /** Values that a wrong reading would find and the grammar must not. */
  notFound?: readonly string[]
}

const ROWS: readonly Row[] = [
  // NUM
  { rule: 'NUM: a whole number with no commas', words: ['1234'], groups: [[123400, ['1234']]] },
  { rule: 'NUM: comma thousands with two decimals', words: ['1,234,567.89'], groups: [[123456789, ['1,234,567.89']]] },
  { rule: 'NUM: one decimal digit is allowed inside a single word', words: ['1,234.5'], groups: [[123450, ['1,234.5']]], notFound: ['1234.05'] },
  { rule: 'NUM: "0.56" is fine (one zero before the point)', words: ['0.56'], groups: [[56, ['0.56']]] },
  // Not a number
  { rule: 'not a number: leading zeros ("001234")', words: ['001234'], groups: [], notFound: ['1234', '1234.00'] },
  { rule: 'not a number: three decimals', words: ['1,234.567'], groups: [], notFound: ['1234.56', '1234.57', '1234567'] },
  { rule: 'not a number: a decimal comma ("1.234,56")', words: ['1.234,56'], groups: [], notFound: ['1234.56', '1.23'] },
  { rule: 'not a number: lakh grouping ("1,23,456")', words: ['1,23,456'], groups: [], notFound: ['123456'] },
  { rule: 'not a number: scientific notation ("1.2E3")', words: ['1.2E3'], groups: [], notFound: ['1200', '1.20'] },
  // GRP3
  { rule: 'GRP3: a space-separated three-digit group joins', words: ['1', '234.56'], groups: [[123456, ['1', '234.56']]], notFound: ['234.56', '1'] },
  { rule: 'GRP3: groups chain before the decimals', words: ['1', '234', '567.89'], groups: [[123456789, ['1', '234', '567.89']]], notFound: ['567.89', '1234'] },
  { rule: 'GRP3: a group may start with a zero', words: ['1', '034.00'], groups: [[103400, ['1', '034.00']]], notFound: ['34.00'] },
  { rule: 'GRP3: four digits are not a group', words: ['5', '1234'], groups: [[500, ['5']], [123400, ['1234']]], notFound: ['51234'] },
  { rule: 'GRP3: two bare integers that are not a three-digit group never join as space thousands', words: ['12', '34'], groups: [[1200, ['12']], [3400, ['34']]], notFound: ['1234', '12.34'] },
  // CGRP
  { rule: 'CGRP: a comma group as its own word joins', words: ['1', ',234.56'], groups: [[123456, ['1', ',234.56']]], notFound: ['234.56'] },
  { rule: 'CGRP: comma groups chain', words: ['1,234', ',567'], groups: [[123456700, ['1,234', ',567']]], notFound: ['1234'] },
  // DEC2
  { rule: 'DEC2: decimals as their own word join', words: ['1,234', '.56'], groups: [[123456, ['1,234', '.56']]], notFound: ['0.56', '1234'] },
  { rule: 'DEC2 at a join needs exactly two digits: "1" ".5" does not join', words: ['1', '.5'], groups: [[100, ['1']]], notFound: ['1.50', '1.05'] },
  { rule: 'a joined group needs exactly two decimals: "1" "234.5" stays two amounts', words: ['1', '234.5'], groups: [[100, ['1']], [23450, ['234.5']]], notFound: ['1234.50'] },
  { rule: 'a joined comma group needs exactly two decimals: "1" ",234.5" does not join', words: ['1', ',234.5'], groups: [[100, ['1']]], notFound: ['1234.50'] },
  { rule: 'continuations join only before any decimals: a group after decimals starts afresh', words: ['12.50', '100'], groups: [[1250, ['12.50']], [10000, ['100']]], notFound: ['12500'] },
  { rule: 'continuations join only before any decimals: nothing joins after a DEC2 word', words: ['1', '.50', '234'], groups: [[150, ['1', '.50']], [23400, ['234']]], notFound: ['1234.50'] },
  { rule: 'at most one DEC2 word per group', words: ['1,234', '.56', '.78'], groups: [[123456, ['1,234', '.56']]], notFound: ['1234.78'] },
  // LEAD
  { rule: 'LEAD "-" attached', words: ['-1,234.56'], groups: [[-123456, ['-1,234.56']]], notFound: ['1234.56'] },
  { rule: 'LEAD "-" as its own word', words: ['-', '1,234.56'], groups: [[-123456, ['-', '1,234.56']]], notFound: ['1234.56'] },
  { rule: 'LEAD "−" (U+2212) attached is a minus', words: ['−5.00'], groups: [[-500, ['−5.00']]], notFound: ['5.00'] },
  { rule: 'LEAD "−" (U+2212) as its own word is a minus', words: ['−', '5.00'], groups: [[-500, ['−', '5.00']]], notFound: ['5.00'] },
  { rule: 'LEAD "$" as its own word', words: ['$', '1,234.56'], groups: [[123456, ['$', '1,234.56']]] },
  { rule: 'LEAD "$" attached', words: ['$1,234.56'], groups: [[123456, ['$1,234.56']]] },
  { rule: 'LEAD "$" then "-" as two words: one sign', words: ['$', '-', '1,234.56'], groups: [[-123456, ['$', '-', '1,234.56']]], notFound: ['1234.56'] },
  { rule: 'LEAD "(" with TRAIL ")" as their own words', words: ['(', '1,234.56', ')'], groups: [[-123456, ['(', '1,234.56', ')']]], notFound: ['1234.56'] },
  { rule: 'LEAD "(" with TRAIL ")" attached', words: ['(1,234.56)'], groups: [[-123456, ['(1,234.56)']]], notFound: ['1234.56'] },
  { rule: 'LEAD "$-"', words: ['$-', '5.00'], groups: [[-500, ['$-', '5.00']]], notFound: ['5.00'] },
  { rule: 'LEAD "-$"', words: ['-$', '5.00'], groups: [[-500, ['-$', '5.00']]], notFound: ['5.00'] },
  { rule: 'LEAD "$("', words: ['$(', '5.00', ')'], groups: [[-500, ['$(', '5.00', ')']]], notFound: ['5.00'] },
  { rule: 'LEAD "($"', words: ['($', '5.00', ')'], groups: [[-500, ['($', '5.00', ')']]], notFound: ['5.00'] },
  { rule: 'LEAD "−$"', words: ['−$', '5.00'], groups: [[-500, ['−$', '5.00']]], notFound: ['5.00'] },
  // TRAIL
  { rule: 'TRAIL "-" as its own word at the end of the line', words: ['5.00', '-'], groups: [[-500, ['5.00', '-']]], notFound: ['5.00'] },
  { rule: 'TRAIL "-" attached', words: ['5.00-'], groups: [[-500, ['5.00-']]], notFound: ['5.00'] },
  { rule: 'TRAIL "CR" is a credit to the account, positive', words: ['5.00', 'CR'], groups: [[500, ['5.00', 'CR']]], notFound: ['-5.00'] },
  { rule: 'TRAIL "DR" is a debit, negative', words: ['5.00', 'DR'], groups: [[-500, ['5.00', 'DR']]], notFound: ['5.00'] },
  // The dash rule (A296)
  { rule: 'dash rule: a "-" followed by an amount within the gap is its leading sign', words: ['Fee', '-', '50.00'], groups: [[-5000, ['-', '50.00']]], notFound: ['50.00'] },
  { rule: 'dash rule: "100.00" "-" "50.00" finds 100.00 and -50.00', words: ['100.00', '-', '50.00'], groups: [[10000, ['100.00']], [-5000, ['-', '50.00']]], notFound: ['-100.00', '50.00'] },
  { rule: 'dash rule: leading binds first, "1,234.56" "-" "7" is 1234.56 and -7', words: ['1,234.56', '-', '7'], groups: [[123456, ['1,234.56']], [-700, ['-', '7']]], notFound: ['-1234.56', '7'] },
  { rule: 'dash rule: a "-" with no amount after it within the gap trails the amount to its left', words: ['100.00', '-', WIDE, '50.00'], groups: [[-10000, ['100.00', '-']], [5000, ['50.00']]], notFound: ['100.00', '-50.00'] },
  { rule: 'dash rule: a "-" before a label trails the amount to its left', words: ['100.00', '-', 'Fee'], groups: [[-10000, ['100.00', '-']]], notFound: ['100.00'] },
  { rule: 'dash rule r3: a "-" before an amount that carries its own leading minus trails the amount on its left', words: ['100.00', '-', '-50.00'], groups: [[-10000, ['100.00', '-']], [-5000, ['-50.00']]], notFound: ['100.00'] },
  { rule: 'dash rule r3: a "-" before a bracketed amount trails the amount on its left', words: ['100.00', '-', '(50.00)'], groups: [[-10000, ['100.00', '-']], [-5000, ['(50.00)']]], notFound: ['100.00', '50.00'] },
  { rule: 'dash rule r3: a "-" before an amount with an attached CR trails the amount on its left', words: ['100.00', '-', '50.00CR'], groups: [[-10000, ['100.00', '-']], [5000, ['50.00CR']]], notFound: ['100.00', '-50.00'] },
  { rule: 'dash rule r3: a "-" before a trailing-minus amount trails the amount on its left', words: ['100.00', '-', '50.00-'], groups: [[-10000, ['100.00', '-']], [-5000, ['50.00-']]], notFound: ['100.00', '50.00'] },
  { rule: 'dash rule r3: a "-" before an amount that can take it still leads that amount ("$" attached is no sign of its own)', words: ['100.00', '-', '$50.00'], groups: [[10000, ['100.00']], [-5000, ['-', '$50.00']]], notFound: ['-100.00'] },
  { rule: 'trailing marks are exactly CR and DR in upper case (A348): "5.00" "cr" is not a credit', words: ['5.00', 'cr'], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'trailing marks are exactly CR and DR in upper case (A348): "5.00" "dr" is not a debit', words: ['5.00', 'dr'], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'trailing marks are exactly CR and DR in upper case (A348): "5.00Dr" attached is no amount', words: ['5.00Dr'], groups: [], notFound: ['5.00', '-5.00'] },
  { rule: '"100.00" "CR" "50.00": CR trails the amount before it and the next amount stands alone', words: ['100.00', 'CR', '50.00'], groups: [[10000, ['100.00', 'CR']], [5000, ['50.00']]], notFound: ['-50.00', '-100.00'] },
  { rule: 'a CR then a dash: CR trails the first amount, the dash leads the second', words: ['5.00', 'CR', '-', '3.00'], groups: [[500, ['5.00', 'CR']], [-300, ['-', '3.00']]], notFound: ['-5.00', '3.00'] },
  // Brackets and sign marks
  { rule: 'a stray ")" makes no group with it and leaves the amount before it whole', words: ['5.00', ')'], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'an unbalanced "(" makes no group with it', words: ['(', '5.00'], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'one sign mark per group: a second minus is not joined', words: ['-', '5.00', '-'], groups: [[-500, ['-', '5.00']]], notFound: ['5.00'] },
  { rule: 'CR never stacks with a minus', words: ['-', '5.00', 'CR'], groups: [[-500, ['-', '5.00']]], notFound: ['5.00'] },
  { rule: 'marks alone make no group', words: ['$', '-', '(', ')', 'CR'], groups: [] },
  // SEP, gaps and lines
  { rule: 'SEP: an en dash separates and is never a minus', words: ['100.00', '–', '50.00'], groups: [[10000, ['100.00']], [5000, ['50.00']]], notFound: ['-50.00', '-100.00'] },
  { rule: 'SEP: an em dash separates and is never a minus', words: ['100.00', '—', '50.00'], groups: [[10000, ['100.00']], [5000, ['50.00']]], notFound: ['-50.00', '-100.00'] },
  { rule: 'SEP: a label word ends a group', words: ['Fee', '5.00', 'Total', '7.00'], groups: [[500, ['5.00']], [700, ['7.00']]] },
  { rule: 'a gap wider than the word height ends a group (columns never join)', words: ['1', WIDE, '234.56'], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'a "-" across a gap wider than the word height is no sign of the amount after it', words: ['-', WIDE, '5.00'], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'words on different lines never join', words: ['1', NEXT_LINE, '234.56'], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  // Zero
  { rule: 'an amount of zero is 0, never -0, whatever its sign mark', words: ['(', '0.00', ')', 'Fee', '-', '0.00', 'Fee', '0.00', 'DR'], groups: [[0, ['(', '0.00', ')']], [0, ['-', '0.00']], [0, ['0.00', 'DR']]] },
]

describe('check 14: the grammar table (amountGroups)', () => {
  for (const row of ROWS) {
    test(`EV-6 grammar row: ${row.rule}`, () => {
      const words = lay(row.words)
      const got = view(words)
      expect(got).toEqual(row.groups)
      for (const [cents] of got) expect(Object.is(cents, -0), `${row.rule}: -0`).toBe(false)
      // valueInBox compares the same whole groups.
      const result = resultOf(words)
      for (const [cents] of row.groups) {
        expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(cents)), `${row.rule}: ${centsText(cents)}`).toEqual({ ok: true })
      }
      for (const decoy of row.notFound ?? []) {
        expect(valueInBox(result, WHOLE_PAGE_BAND, decoy), `${row.rule}: decoy ${decoy}`).toEqual(NOT_FOUND)
      }
    })
  }

  test('EV-6 the table has a row for every token and mark the card lists', () => {
    const rules = ROWS.map((r) => r.rule).join('\n')
    for (const name of ['NUM', 'GRP3', 'CGRP', 'DEC2', 'SEP', 'dash rule']) expect(rules).toContain(name)
    for (const lead of ['"-"', '"−"', '"$"', '"("', '"$-"', '"-$"', '"$("', '"($"', '"−$"']) expect(rules).toContain(`LEAD ${lead}`)
    for (const trail of ['"-"', '")"', '"CR"', '"DR"']) expect(rules).toContain(`TRAIL ${trail}`)
    expect(ROWS.length).toBeGreaterThanOrEqual(40)
  })
})

type TextRow = { rule: string; text: string; cents: number | null }

const TEXT_ROWS: readonly TextRow[] = [
  { rule: 'normaliseAmount does not strip inner spaces: "12 34" is two groups, not 1234 (finding 3)', text: '12 34', cents: null },
  { rule: 'normaliseAmount: two amounts are not one number ("100.00 - 50.00")', text: '100.00 - 50.00', cents: null },
  { rule: 'normaliseAmount: an en dash between amounts is not one number', text: '5.00 – 3.00', cents: null },
  { rule: 'normaliseAmount: space thousands are one group', text: '1 234.56', cents: 123456 },
  { rule: 'normaliseAmount: separate decimals are one group', text: '1,234 .56', cents: 123456 },
  { rule: 'normaliseAmount: a separate leading minus', text: '- 50.00', cents: -5000 },
  { rule: 'normaliseAmount: U+2212 is a minus', text: '−5.00', cents: -500 },
  { rule: 'normaliseAmount: a separate CR is a credit', text: '1,234.56 CR', cents: 123456 },
  { rule: 'normaliseAmount r3: a lower-case "cr" is not a credit mark (A348)', text: '5 cr', cents: null },
  { rule: 'normaliseAmount r3: a lower-case "dr" attached is not a debit mark (A348)', text: '5.00dr', cents: null },
  { rule: 'normaliseAmount: "1" ".5" is not one group', text: '1 .5', cents: null },
  { rule: 'normaliseAmount: "1" "234.5" is not one group', text: '1 234.5', cents: null },
  { rule: 'normaliseAmount: a stray ")" leaves a word outside the group', text: '5.00 )', cents: null },
  { rule: 'normaliseAmount: an unbalanced "(" leaves a word outside the group', text: '( 5.00', cents: null },
  { rule: 'normaliseAmount: a label word leaves the text not a number', text: 'Fee 5.00', cents: null },
  { rule: 'normaliseAmount: leading zeros are not a number', text: '001234', cents: null },
  { rule: 'normaliseAmount: "0.56" is 56 cents', text: '0.56', cents: 56 },
  { rule: 'normaliseAmount: "(0.00)" is 0, never -0', text: '(0.00)', cents: 0 },
  { rule: 'normaliseAmount: "- 0.00" is 0, never -0', text: '- 0.00', cents: 0 },
]

describe('check 14: the grammar table (normaliseAmount)', () => {
  for (const row of TEXT_ROWS) {
    test(`EV-6 grammar row: ${row.rule}`, () => {
      const got = normaliseAmount(row.text)
      if (row.cents === null) {
        expect(got.ok, `"${row.text}" should be refused`).toBe(false)
        expect(got.ok ? '' : got.reason.trim(), `"${row.text}" reason`).not.toBe('')
      } else {
        expect(got).toEqual({ ok: true, cents: row.cents })
        expect(got.ok && Object.is(got.cents, -0), `"${row.text}" gave -0`).toBe(false)
      }
    })
  }

  test('EV-6 reading.ts re-exports the grammar\'s normaliseAmount (one function, one result type)', () => {
    expect(readingNormaliseAmount).toBe(normaliseAmount)
  })
})

// ---------- check 15: generator property ----------

const THOUSANDS = ['one word commas', 'one word plain', 'comma words', 'space words'] as const
const DECIMALS = ['attached', 'separate word', 'none'] as const
const SIGNS = [
  'none', '$ attached', '$ word',
  '- attached', '- word', '− attached', '− word',
  '$- word', '-$ word', '−$ word', '$- attached', '-$ attached',
  'trailing - attached', 'trailing - word',
  'brackets attached', 'brackets words', '$( word', '($ word',
  'DR word', 'CR word',
] as const
type Sign = (typeof SIGNS)[number]
const SEPARATORS: readonly Spec[] = [['Fee'], ['Total'], ['|'], ['*'], ['–'], ['—'], [WIDE], [WIDE, 'Fee', WIDE]]

function commaGroups(dollars: bigint): string[] {
  return dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',').split(',')
}

function numberWords(dollars: bigint, rem: bigint, thousands: (typeof THOUSANDS)[number], decimals: (typeof DECIMALS)[number]): string[] {
  const g = commaGroups(dollars)
  const head = g[0] ?? '0'
  const words =
    thousands === 'one word commas' ? [g.join(',')]
    : thousands === 'one word plain' ? [dollars.toString()]
    : thousands === 'comma words' ? [head, ...g.slice(1).map((x) => `,${x}`)]
    : [...g]
  const dd = rem.toString().padStart(2, '0')
  if (decimals === 'attached') words[words.length - 1] = `${words[words.length - 1] ?? ''}.${dd}`
  if (decimals === 'separate word') words.push(`.${dd}`)
  return words
}

function withFirst(words: string[], f: (w: string) => string): string[] {
  return words.map((w, i) => (i === 0 ? f(w) : w))
}
function withLast(words: string[], f: (w: string) => string): string[] {
  return words.map((w, i) => (i === words.length - 1 ? f(w) : w))
}

function applySign(n: string[], sign: Sign): { words: string[]; negative: boolean } {
  switch (sign) {
    case 'none': return { words: n, negative: false }
    case '$ attached': return { words: withFirst(n, (w) => `$${w}`), negative: false }
    case '$ word': return { words: ['$', ...n], negative: false }
    case '- attached': return { words: withFirst(n, (w) => `-${w}`), negative: true }
    case '- word': return { words: ['-', ...n], negative: true }
    case '− attached': return { words: withFirst(n, (w) => `−${w}`), negative: true }
    case '− word': return { words: ['−', ...n], negative: true }
    case '$- word': return { words: ['$-', ...n], negative: true }
    case '-$ word': return { words: ['-$', ...n], negative: true }
    case '−$ word': return { words: ['−$', ...n], negative: true }
    case '$- attached': return { words: withFirst(n, (w) => `$-${w}`), negative: true }
    case '-$ attached': return { words: withFirst(n, (w) => `-$${w}`), negative: true }
    case 'trailing - attached': return { words: withLast(n, (w) => `${w}-`), negative: true }
    case 'trailing - word': return { words: [...n, '-'], negative: true }
    case 'brackets attached': return { words: withLast(withFirst(n, (w) => `(${w}`), (w) => `${w})`), negative: true }
    case 'brackets words': return { words: ['(', ...n, ')'], negative: true }
    case '$( word': return { words: ['$(', ...n, ')'], negative: true }
    case '($ word': return { words: ['($', ...n, ')'], negative: true }
    case 'DR word': return { words: [...n, 'DR'], negative: true }
    case 'CR word': return { words: [...n, 'CR'], negative: false }
  }
}

/** Cents a single number word would give if read alone (a partial-group decoy), or null. */
function partValue(word: string): number | null {
  const m = /^,?(\d+)?(?:\.(\d\d?))?$/.exec(word)
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  const whole = Number(m[1] ?? '0')
  const frac = Number((m[2] ?? '').padEnd(2, '0'))
  return whole * 100 + frac
}

const amountArb = fc.record({
  dollars: fc.oneof(fc.bigInt({ min: 0n, max: 999n }), fc.bigInt({ min: 1000n, max: 999_999n }), fc.bigInt({ min: 1_000_000n, max: 999_999_999n })),
  rem: fc.bigInt({ min: 0n, max: 99n }),
  thousands: fc.constantFrom(...THOUSANDS),
  decimals: fc.constantFrom(...DECIMALS),
  sign: fc.constantFrom(...SIGNS),
})

describe('check 15: generator property', () => {
  test('EV-6 property: lines of 1 to 3 amounts with random signs, splits and separators: every amount is found with its sign, no decoy ever', () => {
    fc.assert(
      fc.property(
        fc.array(amountArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.constantFrom(...SEPARATORS), { minLength: 2, maxLength: 2 }),
        (amounts, seps) => {
          const spec: Item[] = []
          const intended: GroupView[] = []
          const decoys = new Set<number>()
          amounts.forEach((a, i) => {
            if (i > 0) spec.push(...(seps[i - 1] ?? []))
            const n = numberWords(a.dollars, a.rem, a.thousands, a.decimals)
            const { words, negative } = applySign(n, a.sign)
            const abs = Number(a.dollars) * 100 + (a.decimals === 'none' ? 0 : Number(a.rem))
            const cents = negative && abs !== 0 ? -abs : abs
            spec.push(...words)
            intended.push([cents, words])
            if (abs !== 0) decoys.add(-cents)
            for (const w of n) {
              const p = partValue(w)
              if (p !== null) {
                decoys.add(p)
                decoys.add(-p)
              }
            }
          })
          const laid = lay(spec)
          const got = view(laid)
          expect(got).toEqual(intended)
          const result = resultOf(laid)
          const wanted = new Set(intended.map(([c]) => c))
          for (const c of wanted) expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(c)), centsText(c)).toEqual({ ok: true })
          for (const d of decoys) {
            if (wanted.has(d) || Object.is(d, -0)) continue
            expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(d)), `decoy ${centsText(d)}`).toEqual(NOT_FOUND)
          }
        },
      ),
      { seed: SEED, numRuns: 400 },
    )
  })

  test('EV-6 planted fault: the same amounts with no separator between them are not read as the intended amounts', () => {
    // Control for the property: the separators are what keeps "1" and "234.56" apart.
    expect(view(lay(['1', '234.56']))).not.toEqual([[100, ['1']], [23456, ['234.56']]])
    expect(view(lay(['1', 'Fee', '234.56']))).toEqual([[100, ['1']], [23456, ['234.56']]])
  })
})

describe('check 15 round 3: a sign word before an amount that already carries its own sign mark', () => {
  const FORMS: readonly (readonly [string, (x: string) => string, number])[] = [
    ['leading minus attached', (x) => `-${x}`, -1],
    ['U+2212 attached', (x) => `\u2212${x}`, -1],
    ['"$-" attached', (x) => `$-${x}`, -1],
    ['"-$" attached', (x) => `-$${x}`, -1],
    ['trailing minus attached', (x) => `${x}-`, -1],
    ['brackets attached', (x) => `(${x})`, -1],
    ['CR attached', (x) => `${x}CR`, 1],
    ['DR attached', (x) => `${x}DR`, -1],
  ]
  test('EV-6 property: A "-" B where B carries its own sign gives -A and B with its own sign (the dash trails A)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999_999 }),
        fc.integer({ min: 1, max: 99_999_999 }),
        fc.constantFrom(...FORMS),
        (a, b, [, form, sign]) => {
          const words = lay([centsText(a), '-', form(centsText(b))])
          expect(view(words)).toEqual([
            [-a, [centsText(a), '-']],
            [sign * b, [form(centsText(b))]],
          ])
        },
      ),
      { seed: SEED, numRuns: 300 },
    )
  })
  test('EV-6 planted fault: when B has no sign of its own the same dash leads B instead', () => {
    expect(view(lay(['100.00', '-', '50.00']))).toEqual([[10000, ['100.00']], [-5000, ['-', '50.00']]])
  })
})

describe('check 14 round 3: long runs and blank words', () => {
  const run = (pairs: number, first: string, second: string): Word[] => {
    const width = 0.00002
    const words: Word[] = []
    for (let i = 0; i < pairs * 2; i++) {
      words.push({ text: i % 2 === 0 ? first : second, box: { page: 1, left: 0.01 + i * width, top: 0.2, width, height: WORD_HEIGHT }, confidence: 0.99, order: i + 1 })
    }
    return words
  }
  test('EV-6 r3 a same-line run of 20000 alternating "1" "-" words returns within 2 s and never throws', () => {
    const words = run(20_000, '1', '-')
    const started = performance.now()
    let groups: ReturnType<typeof amountGroups> = []
    expect(() => {
      groups = amountGroups(words)
    }).not.toThrow()
    expect(performance.now() - started).toBeLessThan(2000)
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) expect(Math.abs(g.cents)).toBe(100)
  })
  test('EV-6 r3 valueInBox over the same long run does not throw either', () => {
    const result = resultOf(run(20_000, '1', '-'))
    expect(() => valueInBox(result, WHOLE_PAGE_BAND, '1.00')).not.toThrow()
  })
  test('EV-6 r3 a same-line run of 20000 alternating "1.00" "-" words is also iterative', () => {
    expect(() => amountGroups(run(20_000, '1.00', '-'))).not.toThrow()
  })
  for (const [name, text] of [['U+200B', '\u200B'], ['U+200C', '\u200C'], ['U+200D', '\u200D'], ['U+FEFF', '\uFEFF'], ['a mix of them', '\u200B\uFEFF\u200D']] as const) {
    test(`EV-5 r3 WordSchema refuses a word that is only ${name}`, () => {
      const word = { text, box: { page: 1, left: 0.1, top: 0.1, width: 0.1, height: 0.02 }, confidence: 0.9, order: 1 }
      expect(WordSchema.safeParse(word).success).toBe(false)
    })
  }
  test('EV-5 r3 WordSchema keeps a word that has a real character beside a zero-width one', () => {
    const word = { text: '\u200B5.00', box: { page: 1, left: 0.1, top: 0.1, width: 0.1, height: 0.02 }, confidence: 0.9, order: 1 }
    expect(WordSchema.safeParse(word).success).toBe(true)
  })
})

// ---------- check 16: normaliseAmount and valueInBox agree ----------

const TOKENS = [
  '$', '-', '−', '(', ')', 'CR', 'DR', '$-', '-$', '($', '$(',
  '0', '1', '12', '234', '034', '1234', '1,234', ',234', ',234.56', '.56', '.5', '234.56', '234.5', '0.00', '0.56', '5.00',
  '001', '1.234,56', '1,23,456', '1.234', 'Fee', '–', '—', '5.00-', '(7.00)', '$-3.00', '1,234.5',
] as const

describe('check 16: normaliseAmount equals valueInBox over the same words', () => {
  test('EV-6 property: for any text, normaliseAmount gives cents exactly when the words in one box form one whole group of those cents, and valueInBox finds exactly the groups', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...TOKENS), { minLength: 1, maxLength: 5 }), (tokens) => {
        const text = tokens.join(' ')
        const words = lay(tokens)
        const groups = amountGroups(words)
        const single = groups.length === 1 && groups[0]?.words.length === words.length ? groups[0] : undefined
        const n = normaliseAmount(text)
        if (n.ok) {
          expect(single?.cents, `"${text}"`).toBe(n.cents)
        } else {
          expect(single, `"${text}" is not a number but its words form one group`).toBeUndefined()
          expect(n.reason.trim(), `"${text}" reason`).not.toBe('')
        }
        const result = resultOf(words)
        const groupCents = new Set(groups.map((g) => g.cents))
        if (n.ok) expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(n.cents)), `"${text}"`).toEqual({ ok: true })
        for (const g of groupCents) expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(g)), `"${text}" group ${centsText(g)}`).toEqual({ ok: true })
        for (const g of groupCents) {
          for (const d of [g + 1, -g, g * 10 + 1]) {
            if (groupCents.has(d) || Object.is(d, -0)) continue
            expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(d)), `"${text}" decoy ${centsText(d)}`).toEqual(NOT_FOUND)
          }
        }
      }),
      { seed: SEED, numRuns: 1500 },
    )
  })
})

// ---------- check 19 (ARC-8): the amount-format table round-trips ----------

type Format = Parameters<typeof formatAmount>[1]
const formats = (): readonly Format[] => Object.values(AMOUNT_FORMATS)
const fmt = (cents: number, f: Format): string => formatAmount(cents, f)

describe('check 19: AMOUNT_FORMATS and formatAmount', () => {
  test('ARC-8 the format table covers dollar sign or not, commas or spaces, two decimals, and negatives as leading minus, trailing minus, brackets and DR', () => {
    const list = formats()
    expect(list.length).toBeGreaterThanOrEqual(6)
    const pos = list.map((f) => fmt(123456789, f))
    const neg = list.map((f) => fmt(-123456789, f))
    expect(pos.some((t) => t.includes('$')), 'a format with a dollar sign').toBe(true)
    expect(pos.some((t) => !t.includes('$')), 'a format with no dollar sign').toBe(true)
    expect(pos.some((t) => t.includes('1,234,567.89')), 'thousands commas').toBe(true)
    expect(pos.some((t) => t.includes('1 234 567.89')), 'thousands spaces').toBe(true)
    for (const t of [...pos, ...neg]) expect(t, 'two decimals').toMatch(/\d\.89(?!\d)/)
    expect(neg.some((t) => /^\$?-|^-\$/.test(t)), 'negative as a leading minus').toBe(true)
    expect(neg.some((t) => /-$/.test(t)), 'negative as a trailing minus').toBe(true)
    expect(neg.some((t) => /^\$?\(.*\)$|^\(\$.*\)$/.test(t)), 'negative in brackets').toBe(true)
    expect(neg.some((t) => /DR$/.test(t)), 'negative as DR').toBe(true)
  })

  test('ARC-8 property: any cents up to 10^13 in every format prints then reads back the same, by normaliseAmount and as one group of words', () => {
    const list = formats()
    const centsArb = fc.oneof(
      fc.integer({ min: -100_000, max: 100_000 }),
      fc.bigInt({ min: -(10n ** 13n), max: 10n ** 13n }).map((b) => Number(b)),
    )
    fc.assert(
      fc.property(centsArb, fc.nat({ max: Math.max(0, list.length - 1) }), (cents, i) => {
        const f = list[i]
        if (f === undefined) throw new Error(`test fixture: no format at ${String(i)}`)
        const printed = fmt(cents, f)
        expect(normaliseAmount(printed), printed).toEqual({ ok: true, cents })
        const words = lay(printed.split(' ').filter((w) => w !== ''))
        const groups = view(words)
        expect(groups, printed).toEqual([[cents, words.map((w) => w.text)]])
      }),
      { seed: SEED, numRuns: 2000 },
    )
  })

  test('ARC-8 zero prints with no negative mark in every format and reads back as 0, never -0', () => {
    for (const f of formats()) {
      const zero = fmt(0, f)
      expect(fmt(-0, f), zero).toBe(zero)
      expect(zero, 'no negative mark on zero').not.toMatch(/[-−()]|DR/)
      const back = normaliseAmount(zero)
      expect(back, zero).toEqual({ ok: true, cents: 0 })
      expect(back.ok && Object.is(back.cents, 0), zero).toBe(true)
      const groups = amountGroups(lay(zero.split(' ').filter((w) => w !== '')))
      expect(groups.length, zero).toBe(1)
      expect(Object.is(groups[0]?.cents, 0), zero).toBe(true)
    }
  })

  test('ARC-8 planted fault: a printed amount with one digit changed reads back as other cents', () => {
    for (const f of formats()) {
      const printed = fmt(123456, f).replace('3', '8')
      const back = normaliseAmount(printed)
      expect(back.ok && back.cents === 123456, printed).toBe(false)
    }
  })
})

// ---------- check 20 (ARC-15): markers ----------

describe('check 20: mutation and money markers', () => {
  const source = (): string => readOwnSource(fileURLToPath(new URL('./amount-grammar.ts', import.meta.url)))

  test('ARC-15 amount-grammar.ts carries "// @mutate" in its first 5 lines', () => {
    const head = source().split('\n').slice(0, 5)
    expect(head.some((l) => l.includes('// @mutate'))).toBe(true)
  })

  for (const name of ['normaliseAmount', 'amountGroups', 'formatAmount']) {
    test(`ARC-15 ${name} carries @money in the JSDoc right above its export`, () => {
      const re = new RegExp(String.raw`/\*\*((?:(?!\*/)[\s\S])*)\*/\s*export\s+(?:async\s+)?(?:function\s+${name}\b|const\s+${name}\b)`)
      const m = re.exec(source())
      expect(m, `${name}: no JSDoc directly above the export`).not.toBeNull()
      expect(m?.[1] ?? '', name).toMatch(/@money\b/)
    })
  }
})

// ---------- F09B: gap geometry, blank words, one grouping style, linear joining ----------
//
// Readings this round takes where the card leaves room (ambers, see the spec report):
//   - The gap between two consecutive words is the second's left edge minus the first's right edge; a
//     group joins only when 0 <= gap <= word height x tolerance. Both words in these fixtures have the
//     same height, so which word's height is used does not matter here.
//   - The fixtures use binary fractions (powers of two) so the gap at exactly 0 and at exactly the
//     tolerance is exact in floating point; "just past" is 2^-10 of the page beyond the tolerance.
//   - The geometry predicates of amount-grammar.ts are found by their signature: a function or arrow
//     whose first two parameters are typed with the same position type (Spot, Box or Word). A new
//     predicate needs rows here (a spec round), so the rule cannot be dodged by adding one.
//   - Mixed grouping: the style of the first join (or of the first word's own commas) wins; the group
//     ends where the style changes and the next word starts afresh.
//   - The 50000-group run is too large for a safe integer, so it makes no group and normaliseAmount
//     refuses it; the test pins that and the time.
//
// Round 2 (float geometry, reports/F09B-check.md):
//   - Real readings give decimal page fractions, so a boundary computed in floating point lands a hair
//     either side of the exact value (0.3 - (0.1 + 0.2) is -5.55e-17). Rows marked `decimal` use such
//     coordinates: a boundary that is exact on paper (touching, a gap of exactly the tolerance, touching
//     lines) gives the same answer as with binary fractions; anything more than 1e-9 past it does not.
//   - Rule: every geometry predicate has a decimal-coordinate boundary row (amber: the decimal rows for
//     sameLine are included, so its "touching lines are two lines" boundary needs the same allowance).
//   - The 50000-word runs use exact binary geometry (width 2^-17, every gap exactly 0), and every one of
//     their 50000 neighbouring pairs is proved to join, so the run really is one chain. normaliseAmount's
//     50000-group run is refused as too large (the whole text is one group), not as "not an amount".

const GH = 0.03125 // word height, 2^-5
const GTOP = 0.25
const HAIR = 0.0009765625 // 2^-10
/** Past a decimal boundary by clearly more than 1e-9 of the page. */
const PAST = 2e-9

type Placed = readonly [text: string, left: number, width: number, top?: number, height?: number]

function place(items: readonly Placed[]): Word[] {
  return items.map(([text, left, width, top, height], i) => ({
    text,
    box: { page: 1, left, top: top ?? GTOP, width, height: height ?? GH },
    confidence: 0.99,
    order: i + 1,
  }))
}

type GeometryRow = {
  rule: string
  /** The geometry predicate in amount-grammar.ts the row proves. */
  predicate: string
  gap: 'backwards' | 'overlapping' | 'edge'
  /** Round 2: the row's coordinates are decimal page fractions (not binary), at or just past a boundary. */
  decimal?: true
  words: readonly Placed[]
  tolerance?: number
  groups: readonly GroupView[]
  notFound?: readonly string[]
}

const GEOMETRY_ROWS: readonly GeometryRow[] = [
  // adjacent: backwards (the second word sits left of the first, consecutive in reading order)
  { rule: 'F09B "1" at left 0.80 then "234.56" at left 0.05 on one line are two groups, never 123456 cents', predicate: 'adjacent', gap: 'backwards', words: [['1', 0.8, 0.0625], ['234.56', 0.05, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B a comma group to the left of the previous word does not join', predicate: 'adjacent', gap: 'backwards', words: [['1', 0.75, 0.0625], [',234.56', 0.0625, 0.125]], groups: [[100, ['1']]], notFound: ['1234.56'] },
  { rule: 'F09B a decimals word to the left of the previous word does not join', predicate: 'adjacent', gap: 'backwards', words: [['1,234', 0.75, 0.125], ['.56', 0.0625, 0.0625]], groups: [[123400, ['1,234']]], notFound: ['1234.56', '0.56'] },
  { rule: 'F09B a "-" to the left of the amount before it is no trailing sign', predicate: 'adjacent', gap: 'backwards', words: [['5.00', 0.75, 0.125], ['-', 0.0625, 0.0625]], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'F09B a "-" whose next amount sits to its left is no leading sign', predicate: 'adjacent', gap: 'backwards', words: [['-', 0.75, 0.0625], ['5.00', 0.0625, 0.125]], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  { rule: 'F09B a "(" and ")" around an amount to their left make no brackets', predicate: 'adjacent', gap: 'backwards', words: [['(', 0.75, 0.0625], ['5.00', 0.5, 0.125], [')', 0.25, 0.0625]], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  // adjacent: overlapping (the second word starts inside the first)
  { rule: 'F09B "234.56" starting inside "1" does not join it', predicate: 'adjacent', gap: 'overlapping', words: [['1', 0.125, 0.0625], ['234.56', 0.15625, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B an overlap of a hair (2^-10 of the page) does not join', predicate: 'adjacent', gap: 'overlapping', words: [['1', 0.125, 0.0625], ['234.56', 0.1875 - HAIR, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B two words at the same left edge do not join', predicate: 'adjacent', gap: 'overlapping', words: [['1', 0.125, 0.0625], ['234.56', 0.125, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B a "-" overlapping the amount after it is no leading sign', predicate: 'adjacent', gap: 'overlapping', words: [['-', 0.125, 0.0625], ['5.00', 0.15625, 0.125]], groups: [[500, ['5.00']]], notFound: ['-5.00'] },
  // adjacent: the edges of the allowed gap
  { rule: 'F09B a gap of exactly 0 joins', predicate: 'adjacent', gap: 'edge', words: [['1', 0.125, 0.0625], ['234.56', 0.1875, 0.125]], groups: [[123456, ['1', '234.56']]], notFound: ['234.56'] },
  { rule: 'F09B a gap of exactly one word height (the default tolerance) joins', predicate: 'adjacent', gap: 'edge', words: [['1', 0.125, 0.0625], ['234.56', 0.1875 + GH, 0.125]], groups: [[123456, ['1', '234.56']]], notFound: ['234.56'] },
  { rule: 'F09B a gap just past one word height does not join', predicate: 'adjacent', gap: 'edge', words: [['1', 0.125, 0.0625], ['234.56', 0.1875 + GH + HAIR, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B with tolerance 2 a gap of exactly two word heights joins', predicate: 'adjacent', gap: 'edge', tolerance: 2, words: [['1', 0.125, 0.0625], ['234.56', 0.1875 + 2 * GH, 0.125]], groups: [[123456, ['1', '234.56']]] },
  { rule: 'F09B with tolerance 2 a gap just past two word heights does not join', predicate: 'adjacent', gap: 'edge', tolerance: 2, words: [['1', 0.125, 0.0625], ['234.56', 0.1875 + 2 * GH + HAIR, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]] },
  { rule: 'F09B with tolerance 2 a backwards word still does not join', predicate: 'adjacent', gap: 'backwards', tolerance: 2, words: [['1', 0.5, 0.0625], ['234.56', 0.5 - 0.125, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]] },
  // sameLine: vertical geometry
  { rule: 'F09B a word wholly above the previous one (next in reading order) is another line', predicate: 'sameLine', gap: 'backwards', words: [['1', 0.125, 0.0625], ['234.56', 0.1875, 0.125, GTOP - 2 * GH]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B a word offset down by a quarter of its height overlaps the line and joins', predicate: 'sameLine', gap: 'overlapping', words: [['1', 0.125, 0.0625], ['234.56', 0.1875, 0.125, GTOP + GH / 4]], groups: [[123456, ['1', '234.56']]] },
  { rule: 'F09B a word offset up by a quarter of its height overlaps the line and joins', predicate: 'sameLine', gap: 'overlapping', words: [['1', 0.125, 0.0625], ['234.56', 0.1875, 0.125, GTOP - GH / 4]], groups: [[123456, ['1', '234.56']]] },
  { rule: 'F09B a word that only touches the line below is another line', predicate: 'sameLine', gap: 'edge', words: [['1', 0.125, 0.0625], ['234.56', 0.1875, 0.125, GTOP + GH]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  // Round 2: decimal coordinates at the boundaries (float geometry)
  { rule: 'F09B r2 decimal: "1" at left 0.1 width 0.2 touching "234.56" at left 0.3 joins to 123456 cents', predicate: 'adjacent', gap: 'edge', decimal: true, words: [['1', 0.1, 0.2], ['234.56', 0.3, 0.125]], groups: [[123456, ['1', '234.56']]], notFound: ['234.56'] },
  { rule: 'F09B r2 decimal: a gap of exactly one height (0.82 after 0.7 + 0.1, height 0.02) joins', predicate: 'adjacent', gap: 'edge', decimal: true, words: [['1', 0.7, 0.1, GTOP, 0.02], ['234.56', 0.82, 0.1, GTOP, 0.02]], groups: [[123456, ['1', '234.56']]], notFound: ['234.56'] },
  { rule: 'F09B r2 decimal: a gap more than 1e-9 past one height (0.82 + 2e-9 after 0.7 + 0.1, height 0.02) does not join', predicate: 'adjacent', gap: 'edge', decimal: true, words: [['1', 0.7, 0.1, GTOP, 0.02], ['234.56', 0.82 + PAST, 0.1, GTOP, 0.02]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B r2 decimal: an overlap of more than 1e-9 ("234.56" at 0.3 - 2e-9 after 0.1 + 0.2) does not join', predicate: 'adjacent', gap: 'overlapping', decimal: true, words: [['1', 0.1, 0.2], ['234.56', 0.3 - PAST, 0.125]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B r2 decimal: with tolerance 2 a gap of exactly two heights (0.84 after 0.7 + 0.1, height 0.02) joins', predicate: 'adjacent', gap: 'edge', decimal: true, tolerance: 2, words: [['1', 0.7, 0.1, GTOP, 0.02], ['234.56', 0.84, 0.1, GTOP, 0.02]], groups: [[123456, ['1', '234.56']]] },
  { rule: 'F09B r2 decimal: a word whose top (0.3) touches the bottom of the line above (0.2 + 0.1) is another line', predicate: 'sameLine', gap: 'edge', decimal: true, words: [['1', 0.125, 0.0625, 0.2, 0.1], ['234.56', 0.1875, 0.125, 0.3, 0.1]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B r2 decimal: a word whose bottom (0.2 + 0.1) touches the top of the line below (0.3) is another line', predicate: 'sameLine', gap: 'edge', decimal: true, words: [['1', 0.125, 0.0625, 0.3, 0.1], ['234.56', 0.1875, 0.125, 0.2, 0.1]], groups: [[100, ['1']], [23456, ['234.56']]], notFound: ['1234.56'] },
  { rule: 'F09B r2 decimal: a word overlapping the line by more than 1e-9 (top 0.3 - 2e-9 under 0.2 + 0.1) joins', predicate: 'sameLine', gap: 'overlapping', decimal: true, words: [['1', 0.125, 0.0625, 0.2, 0.1], ['234.56', 0.1875, 0.125, 0.3 - PAST, 0.1]], groups: [[123456, ['1', '234.56']]] },
]

describe('F09B check 1: gap geometry (amountGroups)', () => {
  for (const row of GEOMETRY_ROWS) {
    test(`EV-6 geometry row: ${row.rule}`, () => {
      const words = place(row.words)
      const got = (row.tolerance === undefined ? amountGroups(words) : amountGroups(words, row.tolerance)).map(
        (g) => [g.cents, g.words.map((w) => w.text)] as const,
      )
      expect(got).toEqual(row.groups)
      if (row.tolerance !== undefined) return
      // valueInBox compares the same whole groups (it uses the default tolerance).
      const result = resultOf(words)
      for (const [cents] of row.groups) {
        expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(cents)), `${row.rule}: ${centsText(cents)}`).toEqual({ ok: true })
      }
      for (const decoy of row.notFound ?? []) {
        expect(valueInBox(result, WHOLE_PAGE_BAND, decoy), `${row.rule}: decoy ${decoy}`).toEqual(NOT_FOUND)
      }
    })
  }

  test('EV-6 planted fault: the same two words laid left to right with a tight gap do join (the backwards row is about position only)', () => {
    expect(view(place([['1', 0.05, 0.0625], ['234.56', 0.05 + 0.0625 + HAIR, 0.125]]))).toEqual([[123456, ['1', '234.56']]])
  })
})

describe('F09B check 2: rule, every geometry predicate has a backwards and an overlapping row', () => {
  const source = (): string => readOwnSource(fileURLToPath(new URL('./amount-grammar.ts', import.meta.url)))
  /** Functions or arrows whose first two parameters share one position type (Spot, Box or Word). */
  const predicates = (src: string): string[] => {
    const names = new Set<string>()
    const pair = String.raw`\(\s*\w+\s*:\s*(Spot|Box|Word)\b\s*,\s*\w+\s*:\s*\2\b`
    for (const m of src.matchAll(new RegExp(String.raw`\bfunction\s+(\w+)\s*` + pair, 'g'))) names.add(m[1] as string)
    for (const m of src.matchAll(new RegExp(String.raw`\b(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*` + pair, 'g'))) names.add(m[1] as string)
    return [...names].sort()
  }

  test('EV-6 rule: amount-grammar.ts has geometry predicates, and each has a backwards row and an overlapping row in the geometry table', () => {
    const found = predicates(source())
    expect(found.length, 'no geometry predicate found by signature').toBeGreaterThan(0)
    for (const name of found) {
      const rows = GEOMETRY_ROWS.filter((r) => r.predicate === name)
      expect(rows.some((r) => r.gap === 'backwards'), `${name}: no backwards row`).toBe(true)
      expect(rows.some((r) => r.gap === 'overlapping'), `${name}: no overlapping row`).toBe(true)
    }
  })

  test('EV-6 rule planted fault: the finder sees a new predicate, and a predicate with no rows fails the rule', () => {
    const planted = `${source()}\nconst nearBy = (a: Spot, b: Spot): boolean => a.left < b.left\nfunction overlapsBox(x: Box, y: Box): boolean { return x.left < y.left }\n`
    const found = predicates(planted)
    expect(found).toContain('nearBy')
    expect(found).toContain('overlapsBox')
    expect(GEOMETRY_ROWS.some((r) => r.predicate === 'nearBy')).toBe(false)
  })

  /** A coordinate that is not a binary fraction with at most 20 bits after the point (0.1, 0.82, 0.3 - 2e-9). */
  const isDecimal = (x: number): boolean => !Number.isInteger(x * 2 ** 20)
  const coordinates = (row: GeometryRow): number[] =>
    row.words.flatMap(([, left, width, top, height]) => [left, width, top ?? GTOP, height ?? GH])
  const hasDecimalRow = (rows: readonly GeometryRow[], name: string): boolean =>
    rows.some((r) => r.predicate === name && r.decimal === true && r.gap === 'edge' && coordinates(r).some(isDecimal))

  test('EV-6 r2 rule: every geometry predicate in amount-grammar.ts has a decimal-coordinate boundary row in the geometry table', () => {
    const found = predicates(source())
    expect(found.length, 'no geometry predicate found by signature').toBeGreaterThan(0)
    for (const name of found) expect(hasDecimalRow(GEOMETRY_ROWS, name), `${name}: no decimal-coordinate boundary row`).toBe(true)
    // A row marked decimal really has a decimal coordinate.
    for (const row of GEOMETRY_ROWS.filter((r) => r.decimal === true)) {
      expect(coordinates(row).some(isDecimal), `${row.rule}: marked decimal but every coordinate is binary`).toBe(true)
    }
  })

  test('EV-6 r2 rule planted fault: a new predicate with no decimal row fails, and a binary-only row marked decimal does not count', () => {
    const planted = `${source()}\nconst nearBy = (a: Spot, b: Spot): boolean => a.left < b.left\n`
    expect(predicates(planted)).toContain('nearBy')
    expect(hasDecimalRow(GEOMETRY_ROWS, 'nearBy')).toBe(false)
    const binaryOnly: GeometryRow = { rule: 'planted (Test)', predicate: 'nearBy', gap: 'edge', decimal: true, words: [['1', 0.125, 0.0625], ['234.56', 0.1875, 0.125]], groups: [] }
    expect(hasDecimalRow([binaryOnly], 'nearBy')).toBe(false)
    expect(hasDecimalRow([{ ...binaryOnly, words: [['1', 0.1, 0.2], ['234.56', 0.3, 0.125]] }], 'nearBy')).toBe(true)
  })
})

// Every code point of Unicode category Cf (format characters), computed once.
const FORMAT_CHARS: readonly string[] = (() => {
  const out: string[] = []
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue
    const ch = String.fromCodePoint(cp)
    if (/^\p{Cf}$/u.test(ch)) out.push(ch)
  }
  return out
})()
const BLANK_SPACES = [' ', '\t', ' ', ' ', '　'] as const
const VISIBLE = ['5', 'A', '$', '-', '(', 'é', 'Fee'] as const

const wordWith = (text: string): unknown => ({ text, box: { page: 1, left: 0.1, top: 0.1, width: 0.1, height: 0.02 }, confidence: 0.9, order: 1 })

describe('F09B check 3: a word of format characters only is blank', () => {
  for (const [name, text] of [
    ['U+2060 (word joiner)', '⁠'],
    ['U+200E (left-to-right mark)', '‎'],
    ['U+00AD (soft hyphen)', '­'],
    ['U+180E (Mongolian vowel separator)', '᠎'],
    ['U+202E (right-to-left override)', '‮'],
    ['U+2066 (left-to-right isolate)', '⁦'],
    ['U+E0001 (language tag, outside the BMP)', '\u{E0001}'],
    ['U+2060 and U+00AD around a space', '⁠ ­'],
    ['U+200B, U+2060 and U+FEFF together', '​⁠﻿'],
    ['U+0085 (next line, NEL), which trim() keeps', '\u0085'],
    ['U+0085 beside U+200B and a space', '\u0085​ '],
  ] as const) {
    test(`EV-5 F09B WordSchema refuses a word that is only ${name}`, () => {
      expect(WordSchema.safeParse(wordWith(text)).success).toBe(false)
    })
  }

  for (const [name, text] of [
    ['"A" after U+2060', '⁠A'],
    ['"5" between U+00AD and U+200E', '­5‎'],
    ['"$" after U+180E and a space', '᠎ $'],
    ['"5.00" after U+0085', '\u00855.00'],
  ] as const) {
    test(`EV-5 F09B WordSchema keeps a word with one visible character among format characters: ${name}`, () => {
      expect(WordSchema.safeParse(wordWith(text)).success).toBe(true)
    })
  }

  test('EV-5 F09B the format-character list is the whole of category Cf (sanity of the fixture)', () => {
    for (const ch of ['­', '᠎', '​', '‎', '⁠', '﻿', '\u{E0001}']) expect(FORMAT_CHARS).toContain(ch)
    expect(FORMAT_CHARS).not.toContain('A')
  })

  test('EV-5 F09B property: any word made only of format characters and spaces is refused; one visible character makes it a word', () => {
    const blankArb = fc.array(fc.constantFrom(...FORMAT_CHARS, ...BLANK_SPACES), { minLength: 1, maxLength: 6 })
    fc.assert(
      fc.property(blankArb, fc.constantFrom(...VISIBLE), fc.nat(6), (chars, visible, at) => {
        const blank = chars.join('')
        expect(WordSchema.safeParse(wordWith(blank)).success, `blank ${JSON.stringify(blank)}`).toBe(false)
        const k = Math.min(at, chars.length)
        const real = [...chars.slice(0, k), visible, ...chars.slice(k)].join('')
        expect(WordSchema.safeParse(wordWith(real)).success, `real ${JSON.stringify(real)}`).toBe(true)
      }),
      { seed: SEED, numRuns: 500 },
    )
  })
})

const MIXED_ROWS: readonly Row[] = [
  { rule: 'F09B mixed grouping: "1,234" "567" (comma groups then a space group) is two amounts, the comma style wins', words: ['1,234', '567'], groups: [[123400, ['1,234']], [56700, ['567']]], notFound: ['1234567', '12345.67'] },
  { rule: 'F09B mixed grouping: "1,234" "567.89" is two amounts', words: ['1,234', '567.89'], groups: [[123400, ['1,234']], [56789, ['567.89']]], notFound: ['1234567.89'] },
  { rule: 'F09B mixed grouping: "1" ",234" "567" keeps the comma group and leaves "567" alone', words: ['1', ',234', '567'], groups: [[123400, ['1', ',234']], [56700, ['567']]], notFound: ['1234567'] },
  { rule: 'F09B mixed grouping: "1" "234" ",567" keeps the space group; ",567" alone is no amount', words: ['1', '234', ',567'], groups: [[123400, ['1', '234']]], notFound: ['1234567', '567'] },
  { rule: 'F09B mixed grouping: "1,234" ",567" "890" chains the comma groups and leaves "890" alone', words: ['1,234', ',567', '890'], groups: [[123456700, ['1,234', ',567']], [89000, ['890']]], notFound: ['1234567890'] },
  { rule: 'F09B one style is fine: "1" "234" "567" still joins as space groups', words: ['1', '234', '567'], groups: [[123456700, ['1', '234', '567']]], notFound: ['567'] },
]

describe('F09B check 4: one grouping style per amount', () => {
  for (const row of MIXED_ROWS) {
    test(`EV-6 grammar row: ${row.rule}`, () => {
      const words = lay(row.words)
      expect(view(words)).toEqual(row.groups)
      const result = resultOf(words)
      for (const [cents] of row.groups) {
        expect(valueInBox(result, WHOLE_PAGE_BAND, centsText(cents)), `${row.rule}: ${centsText(cents)}`).toEqual({ ok: true })
      }
      for (const decoy of row.notFound ?? []) {
        expect(valueInBox(result, WHOLE_PAGE_BAND, decoy), `${row.rule}: decoy ${decoy}`).toEqual(NOT_FOUND)
      }
    })
  }

  for (const text of ['1,234 567', '1 ,234 567', '1 234 ,567', '1,234 567.89']) {
    test(`EV-6 F09B normaliseAmount refuses mixed grouping "${text}"`, () => {
      const got = normaliseAmount(text)
      expect(got.ok).toBe(false)
      expect(got.ok ? '' : got.reason.trim()).not.toBe('')
    })
  }
})

describe('F09B check 5: joining groups is linear', () => {
  // Exact binary geometry (round 2): width 2^-17 from left 2^-7, so every left edge and right edge is
  // exact and every gap is exactly 0 (50001 words end near 0.39 of the page).
  const RUN_WIDTH = 2 ** -17
  const RUN_LEFT = 2 ** -7
  const longRun = (first: string, group: string, count: number): Word[] => {
    const words: Word[] = []
    for (let i = 0; i <= count; i++) {
      words.push({ text: i === 0 ? first : group, box: { page: 1, left: RUN_LEFT + i * RUN_WIDTH, top: 0.2, width: RUN_WIDTH, height: WORD_HEIGHT }, confidence: 0.99, order: i + 1 })
    }
    return words
  }
  /** How many neighbouring pairs of the run join: each pair laid as "1" then the group word. */
  const pairJoins = (words: readonly Word[], group: string): number => {
    let joins = 0
    for (let i = 0; i + 1 < words.length; i++) {
      const pair = [{ ...words[i] as Word, text: '1' }, { ...words[i + 1] as Word, text: group }]
      const groups = amountGroups(pair)
      if (groups.length === 1 && groups[0]?.words.length === 2) joins += 1
    }
    return joins
  }

  for (const group of ['000', ',000']) {
    test(`EV-6 r2 the 50000-word "${group}" run has exact geometry: every gap is exactly 0 and all 50000 neighbouring pairs join`, () => {
      const words = longRun('1', group, 50_000)
      for (let i = 0; i + 1 < words.length; i++) {
        const a = (words[i] as Word).box
        const b = (words[i + 1] as Word).box
        expect(b.left - (a.left + a.width), `gap after word ${String(i)}`).toBe(0)
      }
      expect(pairJoins(words, group)).toBe(50_000)
    })
  }

  test('EV-6 r2 planted fault: one word of the run moved a hair to the left of its neighbour breaks one pair, and the count sees it', () => {
    const words = longRun('1', '000', 50_000)
    const moved = words[25_000] as Word
    words[25_000] = { ...moved, box: { ...moved.box, left: moved.box.left - RUN_WIDTH / 2 } }
    expect(pairJoins(words, '000')).toBe(49_999)
  })

  test('EV-6 F09B 50000 "000" group words after a "1" return within 2 s (too large for a safe integer, so no group)', () => {
    const words = longRun('1', '000', 50_000)
    const started = performance.now()
    const groups = amountGroups(words)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(groups).toEqual([])
  })

  test('EV-6 F09B 50000 ",000" comma group words after a "1" return within 2 s too', () => {
    const words = longRun('1', ',000', 50_000)
    const started = performance.now()
    const groups = amountGroups(words)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(groups).toEqual([])
  })

  test('EV-6 F09B normaliseAmount of "1" and 50000 " 000" groups is refused within 2 s', () => {
    const text = `1${' 000'.repeat(50_000)}`
    const started = performance.now()
    const got = normaliseAmount(text)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(got.ok).toBe(false)
    // Round 2: refused because the whole text is one group too large for exact cents, not because the
    // chain broke part way (normaliseAmount lays its words out itself, so its geometry must hold for 50001 words).
    expect(got.ok ? '' : got.reason).toMatch(/too large/)
  })

  test('EV-6 F09B a long run that fits still reads exactly: "1" then four "000" groups is 1,000,000,000,000.00', () => {
    expect(view(longRun('1', '000', 4))).toEqual([[100_000_000_000_000, ['1', '000', '000', '000', '000']]])
  })
})
