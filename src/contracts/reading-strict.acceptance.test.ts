// F09A acceptance tests, spec round 2 (findings review wave 2: RC2 fix 1b; amber A333).
// Written by the spec-writer before the build. The builder never edits this file.
//
// What reading.ts must do (card F09A, Build and Spec round 2):
//   - BoxSchema, WordSchema, PageSchema, EngineStampSchema and ReadingResultSchema are strict at every
//     depth at runtime: an unknown key is refused with an issue at that depth naming the key, never
//     dropped (EV-5).
//   - A333 (1): WordSchema.text is never blank, and valueInBox never finds a blank value (EV-6, AI-4).
//   - A333 (2): pointsToBox and pixelsToBox throw RangeError (never ZodError, never a box) on a page
//     that is NaN, not whole, or below 1 (EV-5).
//   - A333 (3): every "Stryker disable" comment in reading.ts and amount-grammar.ts names every
//     mutable method on the line it covers, and never calls one of them tested (ARC-15).
//   - A333 (4): valueInBox parses its result through ReadingResultSchema: a result the schema refuses
//     is never answered { ok: true } (it throws, or answers ok false). `read` is an interface with no
//     implementation in this card; the engines (A01 to A03) parse their own output.

import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import { readOwnSource } from '../core/testing/read-own-source'
import {
  BoxSchema,
  EngineStampSchema,
  PageSchema,
  ReadingResultSchema,
  WordSchema,
  pixelsToBox,
  pointsToBox,
  valueInBox,
  type Box,
  type ReadingResult,
} from './reading'

const SEED = 20261002

// ---------- fixtures (fresh objects on every call, so no test can change another's) ----------

const goodBox = (): Record<string, unknown> => ({ page: 1, left: 0.6, top: 0.2, width: 0.1, height: 0.02 })
const goodWord = (): Record<string, unknown> => ({ text: '$1,234.56', box: goodBox(), confidence: 0.99, order: 1 })
const goodPage = (): Record<string, unknown> => ({ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true })
const goodStamp = (): Record<string, unknown> => ({ name: 'recorded (Test)', version: '1.0.0' })
const goodResult = (): Record<string, unknown> => ({
  documentFingerprint: 'sha256:statement-birch-lane-bakery-test',
  engine: goodStamp(),
  readAt: '2026-10-02T13:00:00.000Z',
  pageCount: 1,
  pages: [goodPage()],
  words: [goodWord()],
})

const AMOUNT_BOX: Box = { page: 1, left: 0.58, top: 0.19, width: 0.14, height: 0.04 }

type Issue = { path: readonly PropertyKey[]; message: string; keys?: readonly string[] }

/** The issues of a refused parse; fails the test when the parse succeeded. */
function issuesOf(r: { success: boolean; error?: { issues: readonly Issue[] } }): readonly Issue[] {
  expect(r.success, 'the parse should have been refused').toBe(false)
  return r.error?.issues ?? []
}

/** True when some issue sits exactly at `path` and names the stray key. */
function refusesKeyAt(issues: readonly Issue[], path: readonly PropertyKey[], key: string): boolean {
  return issues.some(
    (i) =>
      JSON.stringify(i.path) === JSON.stringify(path) &&
      ((i.keys ?? []).includes(key) || i.message.includes(key)),
  )
}

// ---------- EV-5 (RC2): strict at every depth ----------

type Depth = {
  name: string
  /** The standalone schema for that depth. */
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: readonly Issue[] } } }
  good: () => Record<string, unknown>
  /** Puts a stray key at this depth inside a whole reading result; returns the path of that object. */
  plant: (result: Record<string, unknown>, key: string) => readonly PropertyKey[]
}

const child = (o: Record<string, unknown>, k: string): Record<string, unknown> => o[k] as Record<string, unknown>
const first = (o: Record<string, unknown>, k: string): Record<string, unknown> => (o[k] as Record<string, unknown>[])[0] as Record<string, unknown>

const DEPTHS: readonly Depth[] = [
  {
    name: 'the box (BoxSchema)',
    schema: BoxSchema,
    good: goodBox,
    plant: (r, key) => {
      child(first(r, 'words'), 'box')[key] = 0.5
      return ['words', 0, 'box']
    },
  },
  {
    name: 'a word (WordSchema)',
    schema: WordSchema,
    good: goodWord,
    plant: (r, key) => {
      first(r, 'words')[key] = 'kept by the engine (Test)'
      return ['words', 0]
    },
  },
  {
    name: 'a page (PageSchema)',
    schema: PageSchema,
    good: goodPage,
    plant: (r, key) => {
      first(r, 'pages')[key] = 90
      return ['pages', 0]
    },
  },
  {
    name: 'the engine stamp (EngineStampSchema)',
    schema: EngineStampSchema,
    good: goodStamp,
    plant: (r, key) => {
      child(r, 'engine')[key] = 'eng'
      return ['engine']
    },
  },
  {
    name: 'the result (ReadingResultSchema)',
    schema: ReadingResultSchema,
    good: goodResult,
    plant: (r, key) => {
      r[key] = true
      return []
    },
  },
]

describe('EV-5 strict reading schemas: an unknown key is refused at every depth, never dropped', () => {
  test('EV-5 control: the clean box, word, page, engine stamp and result all parse', () => {
    for (const d of DEPTHS) expect(d.schema.safeParse(d.good()).success, d.name).toBe(true)
  })

  for (const d of DEPTHS) {
    test(`EV-5 a stray key on ${d.name} is refused by that schema and inside a whole reading result`, () => {
      const stray = 'rotation'
      const alone = { ...d.good(), [stray]: 1 }
      expect(refusesKeyAt(issuesOf(d.schema.safeParse(alone)), [], stray), `${d.name} alone`).toBe(true)
      expect(() => d.schema.safeParse(alone)).not.toThrow()

      const whole = goodResult()
      const path = d.plant(whole, stray)
      expect(refusesKeyAt(issuesOf(ReadingResultSchema.safeParse(whole)), path, stray), `${d.name} at ${JSON.stringify(path)}`).toBe(true)
      expect(() => ReadingResultSchema.parse(whole), `${d.name}: parse must throw, never drop the key`).toThrow()
    })
  }

  test('EV-5 property: any stray key name at any depth is refused with an issue at that depth naming the key', () => {
    const known = new Set([
      ...Object.keys(goodBox()),
      ...Object.keys(goodWord()),
      ...Object.keys(goodPage()),
      ...Object.keys(goodStamp()),
      ...Object.keys(goodResult()),
      '__proto__',
      'constructor',
      'prototype',
    ])
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_]{0,15}$/).filter((k) => !known.has(k)),
        fc.nat({ max: DEPTHS.length - 1 }),
        (key, i) => {
          const d = DEPTHS[i]
          if (d === undefined) throw new Error(`test fixture: no depth at ${String(i)}`)
          const whole = goodResult()
          const path = d.plant(whole, key)
          expect(refusesKeyAt(issuesOf(ReadingResultSchema.safeParse(whole)), path, key), `${key} on ${d.name}`).toBe(true)
        },
      ),
      { seed: SEED, numRuns: 300 },
    )
  })
})

// ---------- A333 (1): blank words and blank values (EV-6, AI-4) ----------

const BLANKS = ['', ' ', '   ', '\t', '\n', ' \t\n ', ' '] as const

/** A result the schema would refuse, built by hand (no parse), to see what valueInBox does with it. */
function unparsed(words: readonly Record<string, unknown>[]): ReadingResult {
  return { ...goodResult(), words } as unknown as ReadingResult
}

/** valueInBox's answer, or "refused" when it throws. */
function answer(result: ReadingResult, box: Box, value: string): unknown {
  try {
    return valueInBox(result, box, value)
  } catch {
    return 'refused'
  }
}

describe('EV-6 A333 (1): a blank word and a blank value are refused', () => {
  test('EV-6 A333 WordSchema refuses blank text, alone and inside a reading result; a real word passes', () => {
    for (const text of BLANKS) {
      expect(WordSchema.safeParse({ ...goodWord(), text }).success, `word ${JSON.stringify(text)}`).toBe(false)
      expect(ReadingResultSchema.safeParse({ ...goodResult(), words: [{ ...goodWord(), text }] }).success, `result ${JSON.stringify(text)}`).toBe(false)
    }
    expect(WordSchema.safeParse({ ...goodWord(), text: 'Fee' }).success).toBe(true)
  })

  test('EV-6 A333 a blank value is never found in a box of real words', () => {
    const result = ReadingResultSchema.parse(goodResult())
    for (const value of BLANKS) {
      expect(valueInBox(result, AMOUNT_BOX, value), JSON.stringify(value)).toEqual({ ok: false, reason: 'value not found' })
    }
    // Control: the real value is found in the same box.
    expect(valueInBox(result, AMOUNT_BOX, '1234.56')).toEqual({ ok: true })
  })

  test('EV-6 A333 planted fault: a box holding a blank word never makes a blank value count as found', () => {
    const blankWord = { ...goodWord(), text: ' ', order: 2, box: { ...goodBox(), left: 0.62, width: 0.02 } }
    for (const value of BLANKS) {
      expect(answer(unparsed([blankWord]), AMOUNT_BOX, value), JSON.stringify(value)).not.toEqual({ ok: true })
      expect(answer(unparsed([goodWord(), blankWord]), AMOUNT_BOX, value), JSON.stringify(value)).not.toEqual({ ok: true })
    }
  })
})

// ---------- A333 (2): a bad page in either converter throws RangeError (EV-5) ----------

describe('EV-5 A333 (2): a NaN, fractional, zero or negative page throws RangeError in both converters', () => {
  const rect = { x: 10, y: 10, width: 100, height: 20 }
  const CONVERTERS = [
    ['pointsToBox', pointsToBox],
    ['pixelsToBox', pixelsToBox],
  ] as const

  for (const [name, convert] of CONVERTERS) {
    test(`EV-5 A333 ${name} throws RangeError naming the page for page NaN, 1.5, 0, -1 and Infinity, never ZodError or a box`, () => {
      for (const page of [Number.NaN, 1.5, 0.5, 0, -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        let thrown: unknown = 'no throw'
        try {
          convert(page, rect, 612, 792)
        } catch (e) {
          thrown = e
        }
        expect(thrown, `page ${String(page)}`).toBeInstanceOf(RangeError)
        expect(thrown instanceof Error ? thrown.message : '', `page ${String(page)} message`).toMatch(/page/i)
      }
      // Control: page 1 and page 3 give boxes on those pages.
      expect(convert(1, rect, 612, 792).page).toBe(1)
      expect(convert(3, rect, 612, 792).page).toBe(3)
    })
  }
})

// ---------- A333 (3): every disable comment names what it disables (ARC-15) ----------

// The methods Stryker's MethodExpression mutator changes (StrykerJS mutator list).
const MUTABLE_METHODS = [
  'charAt', 'endsWith', 'startsWith', 'every', 'some', 'filter', 'reverse', 'slice', 'sort', 'substr',
  'substring', 'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase', 'trim', 'trimEnd',
  'trimStart', 'min', 'max', 'at',
] as const

/** Stryker's instrumented copy (inside its sandbox) has no line structure to read (findings wave 2, RC5). */
const INSTRUMENTED = 'stryMutAct_9fa48'

describe('ARC-15 A333 (3): a Stryker disable comment names every method it disables and calls none of them tested', () => {
  for (const file of ['reading.ts', 'amount-grammar.ts']) {
    test(`ARC-15 A333 every MethodExpression disable in ${file} names each mutable method on its line and claims none is tested`, () => {
      const source = readOwnSource(fileURLToPath(new URL(`./${file}`, import.meta.url)))
      if (source.includes(INSTRUMENTED)) {
        // Inside Stryker's sandbox: the comments are checked on the plain source by the ordinary run.
        expect(source).toContain(INSTRUMENTED)
        return
      }
      const lines = source.split('\n')
      lines.forEach((line, i) => {
        const m = /Stryker disable next-line ([A-Za-z, ]+):(.*)$/.exec(line)
        if (!m) return
        const mutators = (m[1] ?? '').split(',').map((s) => s.trim())
        const reason = m[2] ?? ''
        expect(mutators, `${file}:${String(i + 1)} names its mutators, never "all"`).not.toContain('all')
        expect(reason.trim(), `${file}:${String(i + 1)} gives a reason`).not.toBe('')
        if (!mutators.includes('MethodExpression')) return
        const covered = lines[i + 1] ?? ''
        const used = MUTABLE_METHODS.filter((name) => new RegExp(String.raw`\.${name}\(`).test(covered))
        for (const name of used) {
          expect(reason, `${file}:${String(i + 1)} disables ${name} on the next line but does not name it`).toMatch(new RegExp(String.raw`\b${name}\b`))
          const claimedTested = new RegExp(String.raw`\b${name}\b[^.;]*\b(?:is|are)\s+(?:tested|covered|killed)\b`).test(reason)
          expect(claimedTested, `${file}:${String(i + 1)} disables ${name} yet says it is tested`).toBe(false)
        }
      })
    })
  }

  test('ARC-15 A333 planted fault: the check catches a disable that covers trim but explains only toLowerCase', () => {
    const planted = [
      '// Stryker disable next-line MethodExpression: both sides are folded alike, so lower or upper case compare the same',
      "const foldText = (s: string): string => s.trim().replace(/\\s+/g, ' ').toLowerCase()",
    ]
    const reason = /Stryker disable next-line [A-Za-z, ]+:(.*)$/.exec(planted[0] ?? '')?.[1] ?? ''
    const used = MUTABLE_METHODS.filter((name) => new RegExp(String.raw`\.${name}\(`).test(planted[1] ?? ''))
    expect(used).toEqual(['toLowerCase', 'trim'])
    const unnamed = used.filter((name) => !new RegExp(String.raw`\b${name}\b`).test(reason))
    expect(unnamed).toEqual(['toLowerCase', 'trim'])
    const claimsTrimTested = 'toLowerCase and toUpperCase fold both sides alike; trim and whitespace collapse are tested'
    expect(new RegExp(String.raw`\btrim\b[^.;]*\b(?:is|are)\s+(?:tested|covered|killed)\b`).test(claimsTrimTested)).toBe(true)
  })
})

// ---------- A333 (4): valueInBox parses through ReadingResultSchema (EV-5) ----------

describe('EV-5 A333 (4): valueInBox never answers found for a result the schema refuses', () => {
  const cases: readonly [string, () => ReadingResult][] = [
    ['a word confidence above 1', () => unparsed([{ ...goodWord(), confidence: 1.5 }])],
    ['a word order that is not whole', () => unparsed([{ ...goodWord(), order: 1.5 }])],
    ['a blank word beside the amount', () => unparsed([goodWord(), { ...goodWord(), text: '  ', order: 2, box: { ...goodBox(), left: 0.71, width: 0.005 } }])],
    ['a stray key on a word', () => unparsed([{ ...goodWord(), rotation: 90 }])],
    ['a stray key on the box', () => unparsed([{ ...goodWord(), box: { ...goodBox(), rotation: 90 } }])],
    ['a stray key on the result', () => ({ ...goodResult(), rotation: 90 }) as unknown as ReadingResult],
    ['a missing engine stamp', () => ({ ...goodResult(), engine: undefined }) as unknown as ReadingResult],
    ['a readAt that is not a date-time', () => ({ ...goodResult(), readAt: 'yesterday' }) as unknown as ReadingResult],
  ]

  test('EV-5 A333 control: the same words in a parsed result are found', () => {
    expect(valueInBox(ReadingResultSchema.parse(goodResult()), AMOUNT_BOX, '1234.56')).toEqual({ ok: true })
  })

  for (const [what, make] of cases) {
    test(`EV-5 A333 valueInBox refuses a result with ${what} (throws or answers not found), never { ok: true }`, () => {
      const result = make()
      expect(ReadingResultSchema.safeParse(result).success, `the schema refuses ${what}`).toBe(false)
      expect(answer(result, AMOUNT_BOX, '1234.56')).not.toEqual({ ok: true })
    })
  }
})
