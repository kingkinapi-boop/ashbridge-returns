// A03 acceptance tests, card check 4 (ARC-16): a missing or bad recording never falls back to another engine.
// Public API: see the header of recorded.acceptance.test.ts.
//
// The spies are pass-through wrappers (they call the real code and only count): one on A01's textlayer engine
// factory and every engine it makes, and one on the PDF library's getDocument, so a fallback that builds a text-layer
// engine or parses the PDF itself is seen. tesseract (A02) is not built yet; nothing here can reach it.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../../core/clock'
import type { ReadingDocument, ReadingEngine, ReadingResult } from '../../../contracts/reading'
import { createReadingAdapter } from '../index'
import { createTextLayerEngine } from '../textlayer'
import { failure, tempDir } from '../textlayer/__fixtures__/harness'
import { createRecordedEngine } from './index'
import { FIXTURES_DIR, RECORDED_AT, RECORDINGS_DIR, sha256 } from './__fixtures__/make-fixtures'

const calls = vi.hoisted(() => ({ factory: 0, reads: 0, getDocument: 0 }))

vi.mock('../textlayer/index', async (importOriginal) => {
  const real = await importOriginal<typeof import('../textlayer/index')>()
  return {
    ...real,
    createTextLayerEngine: (...args: Parameters<typeof real.createTextLayerEngine>) => {
      calls.factory += 1
      const engine = real.createTextLayerEngine(...args)
      const read = engine.read.bind(engine)
      engine.read = (doc: ReadingDocument): Promise<ReadingResult> => {
        calls.reads += 1
        return read(doc)
      }
      return engine
    },
  }
})

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async (importOriginal) => {
  const real = await importOriginal<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>()
  return {
    ...real,
    getDocument: (...args: Parameters<typeof real.getDocument>) => {
      calls.getDocument += 1
      return real.getDocument(...args)
    },
  }
})

let saved: Clock
let tmp: { dir: string; cleanup: () => void }

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock(RECORDED_AT))
  tmp = tempDir('recorded-nofallback')
  calls.factory = 0
  calls.reads = 0
  calls.getDocument = 0
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

function docOf(name: string): ReadingDocument {
  const bytes = Uint8Array.from(fs.readFileSync(path.join(FIXTURES_DIR, name)))
  return { fingerprint: sha256(bytes), fileName: name, bytes }
}

const ONE_FP = docOf('one-page.pdf').fingerprint

function committed(): Record<string, unknown> & { result: Record<string, unknown> } {
  return JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, `${ONE_FP}.json`), 'utf8')) as Record<string, unknown> & {
    result: Record<string, unknown>
  }
}

function plant(rec: unknown, name: string): void {
  fs.writeFileSync(path.join(tmp.dir, `${name}.json`), JSON.stringify(rec, null, 2) + '\n')
}

const noFallback = (): void => {
  expect(calls).toEqual({ factory: 0, reads: 0, getDocument: 0 })
}

/** Each way a read must fail: the engine it runs on, the document, and a planted folder state. */
const cases: { title: string; setUp: () => { engine: ReadingEngine; doc: ReadingDocument } }[] = [
  {
    title: 'no recording for the PDF',
    setUp: () => ({ engine: createRecordedEngine({ folder: RECORDINGS_DIR }), doc: docOf('unrecorded.pdf') }),
  },
  {
    title: 'the stored fingerprint differs from the file name',
    setUp: () => {
      const doc = docOf('unrecorded.pdf')
      plant(committed(), doc.fingerprint)
      return { engine: createRecordedEngine({ folder: tmp.dir }), doc }
    },
  },
  {
    title: "the result fails F09's schema",
    setUp: () => {
      const rec = committed()
      plant({ ...rec, result: { ...rec.result, pageCount: 0 } }, ONE_FP)
      return { engine: createRecordedEngine({ folder: tmp.dir }), doc: docOf('one-page.pdf') }
    },
  },
  {
    title: 'the file is not JSON',
    setUp: () => {
      fs.writeFileSync(path.join(tmp.dir, `${ONE_FP}.json`), 'not json (Test)')
      return { engine: createRecordedEngine({ folder: tmp.dir }), doc: docOf('one-page.pdf') }
    },
  },
  {
    title: 'no recording, through the adapter switched to recorded',
    setUp: () => ({
      engine: createReadingAdapter({ env: { OCR_ENGINE: 'recorded' }, tempDir: tmp.dir, recordingsDir: RECORDINGS_DIR }),
      doc: docOf('unrecorded.pdf'),
    }),
  },
]

describe('A03 check 4: nothing falls back to another engine (ARC-16)', () => {
  for (const c of cases) {
    test(`ARC-16 planted fault: ${c.title} is refused and textlayer and the PDF library are never called`, async () => {
      const { engine, doc } = c.setUp()
      const err = await failure(() => engine.read(doc))
      expect(err).toBeDefined()
      noFallback()
    })
  }

  test('ARC-16 a clean replay also calls neither textlayer nor the PDF library', async () => {
    const result = await createRecordedEngine({ folder: RECORDINGS_DIR }).read(docOf('one-page.pdf'))
    expect(result.engine.name).toBe('recorded')
    noFallback()
  })

  test('ARC-16 the spies see a real textlayer read (so zero calls above means none happened)', async () => {
    await createTextLayerEngine({ tempDir: tmp.dir }).read(docOf('one-page.pdf'))
    expect(calls).toEqual({ factory: 1, reads: 1, getDocument: 1 })
  })
})
