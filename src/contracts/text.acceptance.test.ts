// F01 round 3 acceptance tests: one definition of "blank" (spec-writer; builders never edit this file).
// Findings F01 round 2 (reports/findings-F01-r2.md), S1 and the TypeScript half of S2 and S5.
//
// API the builder must export from src/contracts/text.ts (`// @mutate` in its first lines):
//   BLANK_RANGES     frozen table of the blank code points, generated once under Node 24
//   isBlank(s)       true when s is made only of White_Space, Cc, Cf or Default_Ignorable_Code_Point
//                    characters, or U+2800 (the empty string is blank)
//   NonBlankSchema   zod string schema refusing every blank string
// ids.ts builds every id kind on NonBlankSchema; records.ts uses NonBlankSchema for every text
// field outside the value allow-list, and VersionStampSchema uses isBlank.
// The SQL half (returns.is_blank agrees with isBlank on every code point) is in
// records.acceptance.db.test.ts.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import * as Ids from './ids'
import { VersionStampSchema } from './records'
import { BLANK_RANGES, NonBlankSchema, isBlank } from './text'

// The rule written out, independently of text.ts.
const ORACLE = /^[\p{White_Space}\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u2800]*$/u

// The eight blanks every non-blank text column and field refuses (S2), plus more of the class.
const EIGHT_BLANKS = ['', ' ', '\t', '\n', '\u00A0', '\u200B', '\u3000', '\u2800'] as const
const MORE_BLANKS = [
  '\r',
  '\u000B',
  '\u000C',
  '\u0000',
  '\u0085', // NEL
  '\u001F', // Cc
  '\u007F', // DEL, Cc
  '\u00AD', // soft hyphen, Cf
  '\u034F', // combining grapheme joiner, Default_Ignorable
  '\u115F', // Hangul choseong filler, Default_Ignorable
  '\u1680',
  '\u180E', // Mongolian vowel separator, Cf
  '\u2007',
  '\u2028',
  '\u2029',
  '\u202F',
  '\u2060', // word joiner
  '\u2066', // left-to-right isolate, Cf
  '\u3164', // Hangul filler, Default_Ignorable
  '\uFE0F', // variation selector 16
  '\uFEFF', // byte order mark
  '\uFFA0', // halfwidth Hangul filler
  '\u{1D173}', // musical symbol begin beam, Cf
  '\u{E0001}', // language tag
  '\u{E0100}', // variation selector 17
  '\u{E0FFF}', // reserved Default_Ignorable
] as const
const VISIBLE = ['a', '0', '.', '-', '\u00E9', '\u0301', '\u{1F600}', '\u05D0', '\u4E00', '\u2801', '\uFFFD'] as const

const ID_SCHEMAS = Object.entries(Ids).filter(([name]) => name.endsWith('IdSchema'))

describe('EV-1 FLOW-1 one definition of blank (text.ts)', () => {
  test('EV-1 the empty string and the eight blanks of the findings are blank', () => {
    for (const b of EIGHT_BLANKS) expect(isBlank(b), JSON.stringify(b)).toBe(true)
  })

  test('EV-1 every other White_Space, Cc, Cf and Default_Ignorable example, and U+2800, is blank', () => {
    for (const b of MORE_BLANKS) expect(isBlank(b), JSON.stringify(b)).toBe(true)
  })

  test('EV-1 a mix of blank characters is blank', () => {
    expect(isBlank(' \t\n\u00A0\u200B\u3000\u2800\uFEFF\u034F\u3164\u0085')).toBe(true)
    expect(isBlank('\u{E0001}\u{E0020}\u{E007F}')).toBe(true)
    expect(isBlank('\u2800'.repeat(50))).toBe(true)
  })

  test('EV-1 one visible character among blanks, including a lone U+0301, is not blank', () => {
    for (const v of VISIBLE) {
      expect(isBlank(v), JSON.stringify(v)).toBe(false)
      expect(isBlank(` \t${v}\u00A0\u200B`), JSON.stringify(v)).toBe(false)
      expect(isBlank(`\u2800${v}`), JSON.stringify(v)).toBe(false)
      expect(isBlank(`${v}\u3000`), JSON.stringify(v)).toBe(false)
    }
    expect(isBlank('Preparer (Test)')).toBe(false)
  })

  test('EV-1 isBlank agrees with the written rule on every code point except the surrogates', () => {
    const disagree: string[] = []
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      const s = String.fromCodePoint(cp)
      if (isBlank(s) !== ORACLE.test(s)) disagree.push(cp.toString(16))
      if (disagree.length > 20) break
    }
    expect(disagree).toEqual([])
  })

  test('EV-1 property: a string is blank exactly when every character is blank', () => {
    const blankChar = fc.constantFrom<string>(...EIGHT_BLANKS.filter((b) => b !== ''), ...MORE_BLANKS)
    const anyChar = fc.oneof(blankChar, fc.constantFrom<string>(...VISIBLE), fc
      .integer({ min: 0, max: 0x10ffff - 0x800 })
      .map((n) => String.fromCodePoint(n >= 0xd800 ? n + 0x800 : n)))
    fc.assert(
      fc.property(fc.array(anyChar, { maxLength: 12 }), (chars) => {
        const s = chars.join('')
        expect(isBlank(s), JSON.stringify(s)).toBe(ORACLE.test(s))
      }),
      { seed: 20261003, numRuns: 500 },
    )
    fc.assert(
      fc.property(fc.array(blankChar, { maxLength: 12 }), fc.constantFrom<string>(...VISIBLE), fc.nat(12), (blanks, v, at) => {
        expect(isBlank(blanks.join(''))).toBe(true)
        const i = Math.min(at, blanks.length)
        expect(isBlank([...blanks.slice(0, i), v, ...blanks.slice(i)].join(''))).toBe(false)
      }),
      { seed: 20261004, numRuns: 300 },
    )
  })

  test('EV-1 BLANK_RANGES is frozen', () => {
    expect(Object.isFrozen(BLANK_RANGES)).toBe(true)
  })
})

describe('EV-1 FLOW-1 NonBlankSchema and the zod side use the one definition', () => {
  test('EV-1 NonBlankSchema refuses every blank and accepts text with one visible character', () => {
    for (const b of [...EIGHT_BLANKS, ...MORE_BLANKS]) {
      expect(NonBlankSchema.safeParse(b).success, JSON.stringify(b)).toBe(false)
    }
    for (const v of VISIBLE) expect(NonBlankSchema.safeParse(` ${v} `).success, JSON.stringify(v)).toBe(true)
    expect(NonBlankSchema.safeParse('Preparer (Test)').success).toBe(true)
  })

  test('EV-1 NonBlankSchema keeps the text as given (no trimming) and refuses non-strings', () => {
    const r = NonBlankSchema.safeParse('  Preparer (Test)\t')
    expect(r.success && r.data).toBe('  Preparer (Test)\t')
    for (const x of [null, undefined, 0, {}, []]) expect(NonBlankSchema.safeParse(x).success).toBe(false)
  })

  test('EV-1 ARC-3 every id kind in ids.ts refuses every blank and accepts a real id', () => {
    expect(ID_SCHEMAS.length).toBeGreaterThanOrEqual(21)
    for (const [name, schema] of ID_SCHEMAS) {
      const s = schema as { safeParse: (x: unknown) => { success: boolean } }
      for (const b of [...EIGHT_BLANKS, ...MORE_BLANKS]) {
        expect(s.safeParse(b).success, `${name} ${JSON.stringify(b)}`).toBe(false)
      }
      expect(s.safeParse('t-000001').success, name).toBe(true)
    }
  })

  test('ARC-10 a version stamp value of tab, NBSP or U+200B is refused by records.ts (S5)', () => {
    for (const x of ['\t', '\u00A0', '\u200B', '\u2800', '\uFEFF', ' \u3000 ']) {
      expect(VersionStampSchema.safeParse({ x }).success, JSON.stringify(x)).toBe(false)
      expect(VersionStampSchema.safeParse({ reader: 'qbo-reader (Test)', x }).success, JSON.stringify(x)).toBe(false)
    }
    expect(VersionStampSchema.safeParse({ reader: 'qbo-reader (Test)', rule_version: 3 }).success).toBe(true)
  })
})
