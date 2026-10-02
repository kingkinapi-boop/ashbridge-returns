// A01 round 3 rule test (A357, reports/A01-check.md): every reading engine treats a page whose only text is invisible
// as a page with no text layer (ARC-6), using the one blank rule (src/contracts/text.ts isBlank, BLANK_RANGES), never
// its own trim(). It feeds each engine the reading adapter switches to a one-page PDF whose only glyph maps to a
// blank code point: both ends of every BLANK_RANGES range, plus NEL and a soft hyphen. Expected: no throw, no words,
// the page marked "no text layer". A02 (tesseract) and A03 (recorded) add their engine names to ENGINES.
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../../core/clock'
import { BLANK_RANGES, isBlank } from '../../../contracts/text'
import type { ReadingResult } from '../../../contracts/reading'
import { createReadingAdapter } from '../index'
import { invisibleTextPdf, NEL, SOFT_HYPHEN } from './__fixtures__/make-fixtures'
import { failure, sha256 } from './__fixtures__/harness'

const ENGINES = ['textlayer'] as const

const CODE_POINTS = [...new Set([...BLANK_RANGES.flatMap(([lo, hi]) => [lo, hi]), NEL, SOFT_HYPHEN])].sort((a, b) => a - b)
const label = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

describe('A01 rule: a page of only invisible text has no text layer, on every engine', () => {
  test('ARC-6 the rule covers every blank range: each code point fed is blank by the one rule, and there is at least one per range', () => {
    expect(CODE_POINTS.every((cp) => isBlank(String.fromCodePoint(cp)))).toBe(true)
    expect(CODE_POINTS.length).toBeGreaterThanOrEqual(BLANK_RANGES.length)
    expect(CODE_POINTS).toContain(NEL)
    expect(CODE_POINTS).toContain(SOFT_HYPHEN)
  })

  for (const name of ENGINES) {
    for (const cp of CODE_POINTS) {
      test(`ARC-6 ${name}: a page whose only text is ${label(cp)} reads as no text layer, never a throw`, async () => {
        const bytes = invisibleTextPdf([cp])
        const engine = createReadingAdapter({ env: { OCR_ENGINE: name } })
        let result: ReadingResult | undefined
        const err = await failure(async () => {
          result = await engine.read({ fingerprint: sha256(bytes), fileName: `invisible ${label(cp)} (Test).pdf`, bytes })
        })
        expect(err?.message, 'the read must not throw').toBeUndefined()
        expect(result?.words).toEqual([])
        expect(result?.pages.map((p) => [p.number, p.hasTextLayer])).toEqual([[1, false]])
      })
    }

    test(`ARC-6 ${name} planted fault: a visible glyph fed the same way is read, so the rule cannot pass by reading nothing`, async () => {
      const bytes = invisibleTextPdf([0x58])
      const engine = createReadingAdapter({ env: { OCR_ENGINE: name } })
      const result = await engine.read({ fingerprint: sha256(bytes), fileName: 'visible (Test).pdf', bytes })
      expect(result.words.map((w) => w.text)).toEqual(['X'])
      expect(result.pages.map((p) => [p.number, p.hasTextLayer])).toEqual([[1, true]])
    })
  }
})
