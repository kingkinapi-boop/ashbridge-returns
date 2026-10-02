// A01 acceptance tests: the text-layer reading engine (ARC-6, ARC-11, EV-6), card checks 1 to 6.
//
// Public API these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/modules/ocr/textlayer/index.ts
//     createTextLayerEngine(options?: { tempDir?: string }): TextLayerEngine
//       tempDir: the only folder the engine may write to (default: a folder under os.tmpdir()).
//     interface TextLayerEngine extends ReadingEngine {   // ReadingEngine from src/contracts/reading.ts (F09)
//       name: 'textlayer'; isLive: false
//       read(document: ReadingDocument): Promise<ReadingResult>   // document.bytes required; fingerprint = sha256 hex
//       parseCount(): number   // how many times this engine has parsed a PDF with the library; a read answered
//     }                        // from the store (same fingerprint) does not count (ARC-11)
//     const TEXTLAYER_LIBRARY: { readonly name: string; readonly version: string }   // the npm package and its pin
//   Result: F09's ReadingResult. engine = { name: 'textlayer', version: a string containing TEXTLAYER_LIBRARY.version };
//   readAt from the injected clock (src/core/clock.ts) at the time the bytes were parsed; a stored result keeps it.
//   Pages: number, widthPt and heightPt as displayed (rotation applied), hasTextLayer false for a page with no text.
//   Words: one entry per whitespace-separated word, boxes as page fractions (origin top left, rotation applied).
//   Refusals reject with an Error whose message contains "refused" and the reason: "encrypted" for a password-protected
//   file, "broken" for a file the library cannot open as a PDF.
// Fixtures: __fixtures__/make-fixtures.ts writes the PDFs and their *.expected.json (layout rules at its top).
import fs from 'node:fs'
import net from 'node:net'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../../core/clock'
import { ReadingResultSchema, valueInBox, type ReadingResult } from '../../../contracts/reading'
import { createTextLayerEngine, TEXTLAYER_LIBRARY } from './index'
import { buildFixtures, expectedFileName, FIXTURES_DIR } from './__fixtures__/make-fixtures'
import { expected, failure, fixtureBytes, fixtureDoc, sha256, snapshot, tempDir, TOLERANCE, wordProblems } from './__fixtures__/harness'

const T1 = '2026-10-01T12:00:00-04:00'
const T2 = '2026-10-01T15:30:00-04:00'

let saved: Clock
let tmp: { dir: string; cleanup: () => void }

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock(T1))
  tmp = tempDir('textlayer')
})

afterEach(() => {
  vi.restoreAllMocks()
  setClock(saved)
  tmp.cleanup()
})

const engine = (): ReturnType<typeof createTextLayerEngine> => createTextLayerEngine({ tempDir: tmp.dir })

async function read(name: string): Promise<ReadingResult> {
  return engine().read(fixtureDoc(name))
}

describe('A01 fixtures', () => {
  test('ARC-6 the committed fixtures are exactly what make-fixtures.ts builds (no hand edits, deterministic)', () => {
    for (const f of buildFixtures()) {
      expect(sha256(fixtureBytes(f.name)), f.name).toBe(sha256(f.bytes))
      if (f.expected) {
        const onDisk: unknown = JSON.parse(fs.readFileSync(`${FIXTURES_DIR}/${expectedFileName(f.name)}`, 'utf8'))
        expect(onDisk, expectedFileName(f.name)).toEqual(f.expected)
      }
    }
    expect(sha256(buildFixtures()[0]?.bytes ?? new Uint8Array()), 'a second build gives the same bytes').toBe(sha256(fixtureBytes('one-page.pdf')))
  })
})

describe('A01 check 1: words and boxes', () => {
  test('ARC-6 the one-page fixture reads every expected word with its box within one hundredth of the page', async () => {
    const result = await read('one-page.pdf')
    const want = expected('one-page.pdf')
    expect(wordProblems(result, want.words)).toEqual([])
    expect(result.words).toHaveLength(want.words.length)
  })

  test("ARC-6 F09's schema accepts the one-page result, with one page of 612 x 792 points that has a text layer", async () => {
    const result = await read('one-page.pdf')
    const parsed = ReadingResultSchema.safeParse(result)
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
    expect(result.pageCount).toBe(1)
    expect(result.pages).toHaveLength(1)
    const page = result.pages[0]
    expect(page?.number).toBe(1)
    expect(page?.hasTextLayer).toBe(true)
    expect(Math.abs((page?.widthPt ?? 0) - 612)).toBeLessThan(0.01)
    expect(Math.abs((page?.heightPt ?? 0) - 792)).toBeLessThan(0.01)
  })

  test('ARC-6 ARC-10 the result is stamped textlayer with the library version, the fingerprint given and the pinned clock time', async () => {
    const doc = fixtureDoc('one-page.pdf')
    const result = await engine().read(doc)
    expect(result.engine.name).toBe('textlayer')
    expect(TEXTLAYER_LIBRARY.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(result.engine.version).toContain(TEXTLAYER_LIBRARY.version)
    expect(result.documentFingerprint).toBe(doc.fingerprint)
    expect(new Date(result.readAt).getTime()).toBe(new Date(T1).getTime())
  })

  test('ARC-6 every word is one word: never empty, never holding a space', async () => {
    for (const name of ['one-page.pdf', 'two-pages.pdf', 'rotated.pdf', 'image-page.pdf']) {
      const result = await read(name)
      for (const w of result.words) expect(w.text, `${name}: ${JSON.stringify(w.text)}`).toMatch(/^\S+$/)
    }
  })

  test("ARC-6 the two-page fixture reads each page's words, on the right page number, with both pages in the result", async () => {
    const result = await read('two-pages.pdf')
    const want = expected('two-pages.pdf')
    expect(wordProblems(result, want.words)).toEqual([])
    expect(result.pageCount).toBe(2)
    expect(result.pages.map((p) => [p.number, p.hasTextLayer])).toEqual([
      [1, true],
      [2, true],
    ])
    expect(ReadingResultSchema.safeParse(result).success).toBe(true)
  })

  test('ARC-6 planted fault: a box moved by two hundredths, a width that takes in the trailing space, or a word on the wrong page is caught', async () => {
    const result = await read('one-page.pdf')
    const want = expected('one-page.pdf').words
    const at = want.findIndex((w) => w.text === 'Ridge')
    const moved = want.map((w, i) => (i === at ? { ...w, box: { ...w.box, left: w.box.left + 2 * TOLERANCE } } : w))
    const spaced = want.map((w, i) => (i === at ? { ...w, box: { ...w.box, width: w.box.width + 7.2 / 612 } } : w))
    const paged = want.map((w, i) => (i === at ? { ...w, box: { ...w.box, page: 2 } } : w))
    expect(wordProblems(result, moved)).not.toEqual([])
    expect(wordProblems(result, spaced)).not.toEqual([])
    expect(wordProblems(result, paged)).not.toEqual([])
  })
})

describe('A01 check 2: value in box through F09', () => {
  test('EV-6 valueInBox finds 1234.56 in the box the fixture puts "$1,234.56" in', async () => {
    const result = await read('one-page.pdf')
    const box = expected('one-page.pdf').boxes['closingBalance']
    expect(box).toBeDefined()
    if (!box) return
    expect(valueInBox(result, box, '1234.56')).toEqual({ ok: true })
    expect(valueInBox(result, box, '$1,234.56')).toEqual({ ok: true })
  })

  test('EV-6 planted fault: 1234.56 is not found in the date box or the opening balance box, and 1234.57 is not found in its own box', async () => {
    const result = await read('one-page.pdf')
    const { statementDate, openingBalance, closingBalance } = expected('one-page.pdf').boxes
    if (!statementDate || !openingBalance || !closingBalance) throw new Error('fixture boxes missing')
    expect(valueInBox(result, statementDate, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, openingBalance, '1234.56')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, closingBalance, '1234.57')).toEqual({ ok: false, reason: 'value not found' })
    expect(valueInBox(result, statementDate, '2025-12-31')).toEqual({ ok: true })
  })

  test('EV-6 on the two-page fixture 987.65 is found in its box on page 2 and not in the same place on page 1', async () => {
    const result = await read('two-pages.pdf')
    const box = expected('two-pages.pdf').boxes['closingBalance']
    if (!box) throw new Error('fixture box missing')
    expect(box.page).toBe(2)
    expect(valueInBox(result, box, '987.65')).toEqual({ ok: true })
    expect(valueInBox(result, { ...box, page: 1 }, '987.65').ok).toBe(false)
  })
})

describe('A01 check 3: rotation', () => {
  test('ARC-6 a page with /Rotate 90 reads in its upright frame: 612 x 792 and the same boxes as the unrotated fixture', async () => {
    const rotated = await read('rotated.pdf')
    const upright = await read('one-page.pdf')
    expect(wordProblems(rotated, expected('one-page.pdf').words)).toEqual([])
    expect(wordProblems(rotated, upright.words.map((w) => ({ text: w.text, box: w.box })))).toEqual([])
    const page = rotated.pages[0]
    expect(Math.abs((page?.widthPt ?? 0) - 612)).toBeLessThan(0.01)
    expect(Math.abs((page?.heightPt ?? 0) - 792)).toBeLessThan(0.01)
    expect(ReadingResultSchema.safeParse(rotated).success).toBe(true)
  })

  test('EV-6 valueInBox finds 1234.56 on the rotated page in the upright box', async () => {
    const result = await read('rotated.pdf')
    const box = expected('rotated.pdf').boxes['closingBalance']
    if (!box) throw new Error('fixture box missing')
    expect(valueInBox(result, box, '1234.56')).toEqual({ ok: true })
  })
})

describe('A01 check 4: a page with no text layer', () => {
  test('ARC-6 the image-only page 2 is reported as no text layer with its page number; pages 1 and 3 still read', async () => {
    const result = await read('image-page.pdf')
    const want = expected('image-page.pdf')
    expect(result.pageCount).toBe(3)
    expect([...result.pages].sort((a, b) => a.number - b.number).map((p) => [p.number, p.hasTextLayer])).toEqual([
      [1, true],
      [2, false],
      [3, true],
    ])
    expect(result.words.filter((w) => w.box.page === 2)).toEqual([])
    expect(wordProblems(result, want.words)).toEqual([])
    expect(ReadingResultSchema.safeParse(result).success).toBe(true)
  })

  test('ARC-6 a file that is all scan is never an empty success: its one page says no text layer', async () => {
    const result = await read('scan-only.pdf')
    expect(result.pageCount).toBe(1)
    expect(result.pages.map((p) => [p.number, p.hasTextLayer])).toEqual([[1, false]])
    expect(result.words).toEqual([])
    expect(ReadingResultSchema.safeParse(result).success).toBe(true)
  })
})

describe('A01 check 5: encrypted and broken files are refused, nothing written', () => {
  const WRITES = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream', 'mkdirSync', 'mkdir', 'mkdtempSync', 'mkdtemp', 'copyFileSync', 'renameSync'] as const

  function spyWrites(): { calls: () => number } {
    const spies = WRITES.map((m) => vi.spyOn(fs, m))
    const promiseSpies = (['writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'copyFile', 'rename'] as const).map((m) => vi.spyOn(fs.promises, m))
    return { calls: () => [...spies, ...promiseSpies].reduce((n, s) => n + s.mock.calls.length, 0) }
  }

  test('ARC-6 an encrypted PDF is refused with the reason "encrypted"; nothing is written', async () => {
    const before = snapshot(FIXTURES_DIR)
    const writes = spyWrites()
    const err = await failure(() => read('encrypted.pdf'))
    expect(err?.message).toMatch(/refused/i)
    expect(err?.message).toMatch(/encrypted/i)
    expect(writes.calls()).toBe(0)
    expect(snapshot(tmp.dir)).toEqual([])
    expect(snapshot(FIXTURES_DIR)).toEqual(before)
  })

  test('ARC-6 a truncated PDF and a text file named .pdf are refused with the reason "broken"; nothing is written', async () => {
    const before = snapshot(FIXTURES_DIR)
    const writes = spyWrites()
    for (const name of ['truncated.pdf', 'not-a-pdf.pdf']) {
      const err = await failure(() => read(name))
      expect(err?.message, name).toMatch(/refused/i)
      expect(err?.message, name).toMatch(/broken/i)
    }
    expect(writes.calls()).toBe(0)
    expect(snapshot(tmp.dir)).toEqual([])
    expect(snapshot(FIXTURES_DIR)).toEqual(before)
  })

  test('ARC-6 a refusal is not stored: the same engine refuses the same bytes again and still reads a good file after', async () => {
    const e = engine()
    for (let i = 0; i < 2; i++) {
      expect((await failure(() => e.read(fixtureDoc('encrypted.pdf'))))?.message).toMatch(/encrypted/i)
      expect((await failure(() => e.read(fixtureDoc('not-a-pdf.pdf'))))?.message).toMatch(/broken/i)
    }
    const good = await e.read(fixtureDoc('one-page.pdf'))
    expect(wordProblems(good, expected('one-page.pdf').words)).toEqual([])
  })

  test('END-8 reading every fixture makes no network call and writes nothing outside its temp folder', async () => {
    const before = snapshot(FIXTURES_DIR)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const connectSpy = vi.spyOn(net.Socket.prototype, 'connect')
    const e = engine()
    for (const f of buildFixtures()) await failure(() => e.read(fixtureDoc(f.name)))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(connectSpy).not.toHaveBeenCalled()
    expect(snapshot(FIXTURES_DIR)).toEqual(before)
  })
})

describe('A01 check 6: word boxes are computed once per document (ARC-11)', () => {
  test('ARC-11 a second read of the same bytes returns the stored words without parsing again', async () => {
    const e = engine()
    expect(e.parseCount()).toBe(0)
    const first = await e.read(fixtureDoc('one-page.pdf'))
    expect(e.parseCount()).toBe(1)
    setClock(fixedClock(T2))
    // A fresh copy of the same bytes, as a second arrival of the same document would bring.
    const again = fixtureDoc('one-page.pdf')
    const second = await e.read({ fingerprint: again.fingerprint, bytes: Uint8Array.from(again.bytes ?? []) })
    expect(e.parseCount()).toBe(1)
    expect(second.words).toEqual(first.words)
    expect(second.pages).toEqual(first.pages)
    expect(second.engine).toEqual(first.engine)
    expect(second.documentFingerprint).toBe(first.documentFingerprint)
    expect(new Date(second.readAt).getTime(), 'the stored result keeps the time it was read').toBe(new Date(T1).getTime())
  })

  test('ARC-11 planted fault: different bytes are parsed (the store is keyed by fingerprint), and the first document stays stored', async () => {
    const e = engine()
    await e.read(fixtureDoc('one-page.pdf'))
    const two = await e.read(fixtureDoc('two-pages.pdf'))
    expect(e.parseCount()).toBe(2)
    expect(wordProblems(two, expected('two-pages.pdf').words)).toEqual([])
    const one = await e.read(fixtureDoc('one-page.pdf'))
    expect(e.parseCount()).toBe(2)
    expect(wordProblems(one, expected('one-page.pdf').words)).toEqual([])
  })

  test('ARC-11 a caller changing a returned result does not change what the store gives the next caller', async () => {
    const e = engine()
    const first = await e.read(fixtureDoc('one-page.pdf'))
    const firstWord = first.words[0]
    if (firstWord) firstWord.text = 'TAMPERED (Test)'
    first.words.pop()
    const second = await e.read(fixtureDoc('one-page.pdf'))
    expect(e.parseCount()).toBe(1)
    expect(wordProblems(second, expected('one-page.pdf').words)).toEqual([])
  })
})
