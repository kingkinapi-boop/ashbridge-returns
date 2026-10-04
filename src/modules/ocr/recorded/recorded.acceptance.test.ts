// A03 acceptance tests: the recorded reading engine (ARC-6, ARC-10, ARC-16, SEC-11), card checks 1, 2, 3, 5, 6, 7
// and the refusals of check 4 (its no-fallback spies are in recorded.no-fallback.acceptance.test.ts).
//
// Public API these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/modules/ocr/recorded/index.ts
//     createRecordedEngine(options: { folder: string }): RecordedEngine
//       folder: where the recordings live (each card keeps its own under its __recordings__/).
//     interface RecordedEngine extends ReadingEngine {   // ReadingEngine from src/contracts/reading.ts (F09)
//       name: 'recorded'; isLive: false
//       read(document: ReadingDocument): Promise<ReadingResult>
//     }   // finds <folder>/<document.fingerprint>.json; needs no bytes (the fingerprint is the key)
//     record(document: ReadingDocument, engine: ReadingEngine, folder: string, options: { testWorld: true }): Promise<unknown>
//       runs engine.read(document) once and writes <folder>/<sha256 hex of document.bytes>.json.
//       Without testWorld exactly true it rejects (message names the test world or made-up data), runs no engine
//       and writes nothing (SEC-11).
//   A recording file (the golden __golden__/one-page.recording.json is the definition, byte for byte):
//     { fingerprint, recordedAt, result, sourceEngine: { name, version } }, keys sorted at every level,
//     JSON with a two-space indent, LF line ends and one final LF; recordedAt is the injected clock's now() as
//     toISOString(); result is the source engine's F09 ReadingResult as it returned it.
//   Replay: the stored result, validated by F09's ReadingResultSchema, with engine
//     { name: 'recorded', version: `${sourceEngine.name}@${sourceEngine.version}` } (ARC-10). readAt is not pinned.
//   Refusals (rejected promises, never a fallback to another engine):
//     no file for the fingerprint: message contains `no recording for <fingerprint>: re-record`;
//     stored fingerprint differs from the file name: message contains "fingerprint";
//     stored result fails F09's schema: message carries the schema's reason (for example the field path);
//     no source engine stamp, or a file that is not JSON: refused.
//   src/modules/ocr/index.ts
//     createReadingAdapter({ env: { OCR_ENGINE: 'recorded' }, recordingsDir }) returns the recorded engine reading
//     from recordingsDir; 'textlayer' stays the default. ReadingAdapterOptions gains recordingsDir?: string.
//     'recorded' with no recordingsDir fails (from the factory or the first read), never reads with textlayer.
// Fixtures: __fixtures__/make-fixtures.ts (copies of A01's PDFs; how the recording and golden were made).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../../core/clock'
import { ReadingResultSchema, type ReadingDocument, type ReadingEngine, type ReadingResult } from '../../../contracts/reading'
import { createReadingAdapter } from '../index'
import { createTextLayerEngine } from '../textlayer'
import { failure, snapshot, tempDir } from '../textlayer/__fixtures__/harness'
import { createRecordedEngine, record } from './index'
import {
  A01_FIXTURES_DIR,
  COPIES,
  FIXTURES_DIR,
  GOLDEN_DIR,
  RECORDED_AT,
  RECORDINGS_DIR,
  sha256,
} from './__fixtures__/make-fixtures'

const LATER = '2026-10-01T15:30:00-04:00'
const GOLDEN = path.join(GOLDEN_DIR, 'one-page.recording.json')

let saved: Clock
let tmp: { dir: string; cleanup: () => void }

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock(RECORDED_AT))
  tmp = tempDir('recorded')
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

function bytesOf(name: string): Uint8Array {
  return Uint8Array.from(fs.readFileSync(path.join(FIXTURES_DIR, name)))
}

function docOf(bytes: Uint8Array, fileName: string): ReadingDocument {
  return { fingerprint: sha256(bytes), fileName, bytes }
}

const ONE_PAGE = (): ReadingDocument => docOf(bytesOf('one-page.pdf'), 'one-page.pdf')
const UNRECORDED = (): ReadingDocument => docOf(bytesOf('unrecorded.pdf'), 'unrecorded.pdf')
const ONE_FP = sha256(bytesOf('one-page.pdf'))

const replay = (folder = RECORDINGS_DIR): ReadingEngine => createRecordedEngine({ folder })

async function textlayerRead(doc: ReadingDocument): Promise<ReadingResult> {
  return createTextLayerEngine({ tempDir: tmp.dir }).read(doc)
}

type Recording = { fingerprint: string; recordedAt: string; result: ReadingResult; sourceEngine: { name: string; version: string } }

function committedRecording(): Recording {
  return JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, `${ONE_FP}.json`), 'utf8')) as Recording
}

/** Writes a planted recording under `name` (default: its own fingerprint) into the temp folder. */
function plant(rec: unknown, name: string): void {
  fs.writeFileSync(path.join(tmp.dir, `${name}.json`), JSON.stringify(rec, null, 2) + '\n')
}

/** `record` called with any argument list, so the refusal tests do not depend on how the builder types `options`. */
const recordLoose = record as unknown as (...args: unknown[]) => Promise<unknown>

/** A test double for a source engine: counts its reads and answers with the given result. */
function countingEngine(result: ReadingResult): ReadingEngine & { reads: number } {
  const e = {
    name: 'counting (Test)',
    isLive: false,
    reads: 0,
    read(): Promise<ReadingResult> {
      e.reads += 1
      return Promise.resolve(structuredClone(result))
    },
  }
  return e
}

describe('A03 fixtures', () => {
  test('ARC-16 the fixture PDFs are byte copies of A01 fixtures (copied by make-fixtures.ts, never edited)', () => {
    for (const c of COPIES) {
      const a01 = Uint8Array.from(fs.readFileSync(path.join(A01_FIXTURES_DIR, c.from)))
      expect(sha256(bytesOf(c.name)), c.name).toBe(sha256(a01))
    }
  })

  test('ARC-16 the committed recording is the golden byte for byte, is named by its fingerprint and only one-page.pdf has one', () => {
    expect(fs.readdirSync(RECORDINGS_DIR).sort()).toEqual([`${ONE_FP}.json`])
    expect(fs.readFileSync(path.join(RECORDINGS_DIR, `${ONE_FP}.json`))).toEqual(fs.readFileSync(GOLDEN))
    expect(committedRecording().fingerprint).toBe(ONE_FP)
    expect(committedRecording().sourceEngine.name).toBe('textlayer')
  })
})

describe('A03 check 1: replay equals the source engine (ARC-6)', () => {
  test('ARC-6 reading the fixture with recorded returns words deep-equal to reading it with textlayer', async () => {
    const live = await textlayerRead(ONE_PAGE())
    const replayed = await replay().read(ONE_PAGE())
    expect(live.words.length).toBeGreaterThan(0)
    expect(replayed.words).toEqual(live.words)
    expect(replayed.pages).toEqual(live.pages)
    expect(replayed.pageCount).toBe(live.pageCount)
    expect(replayed.documentFingerprint).toBe(ONE_FP)
  })

  test("ARC-6 F09's strict schema accepts the replayed result", async () => {
    const replayed = await replay().read(ONE_PAGE())
    const parsed = ReadingResultSchema.safeParse(replayed)
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  test('ARC-6 the recording is found by fingerprint alone: a document with no bytes replays the same words', async () => {
    const replayed = await replay().read({ fingerprint: ONE_FP })
    expect(replayed.words).toEqual(committedRecording().result.words)
  })

  test('ARC-6 replay is the same every time and a caller changing a returned result does not change the next replay', async () => {
    const engine = replay()
    const first = await engine.read(ONE_PAGE())
    const want = structuredClone(first)
    const w0 = first.words[0]
    if (w0 === undefined) throw new Error('fixture has no words')
    w0.text = 'TAMPERED (Test)'
    const second = await engine.read(ONE_PAGE())
    expect(second).toEqual(want)
  })
})

describe('A03 check 2: the replay says which engine really read the page (ARC-10)', () => {
  test("ARC-10 the replayed result's engine is recorded and its version is <source engine>@<source version>", async () => {
    const live = await textlayerRead(ONE_PAGE())
    const replayed = await replay().read(ONE_PAGE())
    expect(replayed.engine.name).toBe('recorded')
    expect(replayed.engine.version).toBe(`textlayer@${live.engine.version}`)
  })

  test('ARC-10 the engine is named recorded and is not live', () => {
    const engine = replay()
    expect(engine.name).toBe('recorded')
    expect(engine.isLive).toBe(false)
  })

  test('ARC-10 planted fault: a recording made by another engine replays with that engine and version, not a fixed one', async () => {
    const rec = committedRecording()
    const stamp = { name: 'tesseract', version: '5.5.0 (Test)' }
    plant({ ...rec, sourceEngine: stamp, result: { ...rec.result, engine: stamp } }, ONE_FP)
    const replayed = await replay(tmp.dir).read(ONE_PAGE())
    expect(replayed.engine).toEqual({ name: 'recorded', version: 'tesseract@5.5.0 (Test)' })
  })
})

describe('A03 check 3: a missing recording fails loudly (ARC-16)', () => {
  test('ARC-16 reading a PDF with no recording fails with "re-record" and its fingerprint', async () => {
    const doc = UNRECORDED()
    const err = await failure(() => replay().read(doc))
    expect(err?.message).toContain(`no recording for ${doc.fingerprint}: re-record`)
  })

  test('ARC-16 planted fault: one byte of the fixture PDF changed fails the same way, with the new fingerprint', async () => {
    const bytes = bytesOf('one-page.pdf')
    const at = bytes.length - 2
    bytes[at] = (bytes[at] ?? 0) ^ 0x01
    const doc = docOf(bytes, 'one-page.pdf')
    expect(doc.fingerprint).not.toBe(ONE_FP)
    const err = await failure(() => replay().read(doc))
    expect(err?.message).toContain(`no recording for ${doc.fingerprint}: re-record`)
  })

  test('ARC-16 an empty recordings folder fails with "re-record", not with an empty result', async () => {
    const err = await failure(() => replay(tmp.dir).read(ONE_PAGE()))
    expect(err?.message).toContain(`no recording for ${ONE_FP}: re-record`)
  })
})

describe('A03 check 4: a bad recording is refused with the reason (ARC-16)', () => {
  test('ARC-16 planted fault: a recording whose stored fingerprint differs from its file name is refused, naming the fingerprint', async () => {
    const other = UNRECORDED()
    plant(committedRecording(), other.fingerprint)
    const err = await failure(() => replay(tmp.dir).read(other))
    expect(err).toBeDefined()
    expect(err?.message).toMatch(/fingerprint/i)
    expect(err?.message).not.toContain('no recording for')
  })

  test("ARC-16 planted fault: a recording whose result fails F09's schema (confidence 2) is refused with the reason", async () => {
    const rec = committedRecording()
    const [first, ...rest] = rec.result.words
    if (first === undefined) throw new Error('fixture has no words')
    plant({ ...rec, result: { ...rec.result, words: [{ ...first, confidence: 2 }, ...rest] } }, ONE_FP)
    const err = await failure(() => replay(tmp.dir).read(ONE_PAGE()))
    expect(err).toBeDefined()
    expect(err?.message).toContain('confidence')
  })

  test("ARC-16 planted fault: a result with a key F09's strict schema does not know is refused", async () => {
    const rec = committedRecording()
    plant({ ...rec, result: { ...rec.result, plantedKey: 'smuggled (Test)' } }, ONE_FP)
    const err = await failure(() => replay(tmp.dir).read(ONE_PAGE()))
    expect(err).toBeDefined()
    expect(err?.message).toContain('plantedKey')
  })

  test('ARC-10 planted fault: a recording with no source engine stamp is refused', async () => {
    const rest: Partial<Recording> = committedRecording()
    delete rest.sourceEngine
    plant(rest, ONE_FP)
    expect(await failure(() => replay(tmp.dir).read(ONE_PAGE()))).toBeDefined()
  })

  test('ARC-16 planted fault: a recording file that is not JSON is refused', async () => {
    fs.writeFileSync(path.join(tmp.dir, `${ONE_FP}.json`), '{"fingerprint": "f20b97')
    expect(await failure(() => replay(tmp.dir).read(ONE_PAGE()))).toBeDefined()
  })

  test('ARC-16 the clean committed recording raises no false alarm', async () => {
    expect(await failure(() => replay().read(ONE_PAGE()))).toBeUndefined()
  })
})

describe('A03 check 5: record writes the same bytes every time (ARC-16)', () => {
  const recordedPath = (dir: string): string => path.join(dir, `${ONE_FP}.json`)

  test('ARC-16 record on the fixture writes a file byte-identical to the golden recording, twice in a row', async () => {
    await record(ONE_PAGE(), createTextLayerEngine({ tempDir: tmp.dir }), tmp.dir, { testWorld: true })
    const first = fs.readFileSync(recordedPath(tmp.dir), 'utf8')
    await expect(first).toMatchFileSnapshot('./__golden__/one-page.recording.json')
    await record(ONE_PAGE(), createTextLayerEngine({ tempDir: tmp.dir }), tmp.dir, { testWorld: true })
    const second = fs.readFileSync(recordedPath(tmp.dir))
    expect(second).toEqual(fs.readFileSync(GOLDEN))
    expect(fs.readdirSync(tmp.dir)).toEqual([`${ONE_FP}.json`])
  })

  test('ARC-16 the recording has sorted keys at every level, LF line ends only and one final LF', async () => {
    await record(ONE_PAGE(), createTextLayerEngine({ tempDir: tmp.dir }), tmp.dir, { testWorld: true })
    const text = fs.readFileSync(recordedPath(tmp.dir), 'utf8')
    expect(text).not.toContain('\r')
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
    const unsorted: string[] = []
    const walk = (v: unknown, at: string): void => {
      if (Array.isArray(v)) v.forEach((x, i) => { walk(x, `${at}[${String(i)}]`) })
      else if (v !== null && typeof v === 'object') {
        const keys = Object.keys(v)
        if (keys.join() !== [...keys].sort().join()) unsorted.push(at)
        for (const k of keys) walk((v as Record<string, unknown>)[k], `${at}.${k}`)
      }
    }
    walk(JSON.parse(text), '$')
    expect(unsorted).toEqual([])
  })

  test('ARC-16 recordedAt comes from the injected clock (a later pinned time is what the file says)', async () => {
    setClock(fixedClock(LATER))
    await record(ONE_PAGE(), createTextLayerEngine({ tempDir: tmp.dir }), tmp.dir, { testWorld: true })
    const rec = JSON.parse(fs.readFileSync(recordedPath(tmp.dir), 'utf8')) as Recording
    expect(rec.recordedAt).toBe(new Date(LATER).toISOString())
    expect(rec.fingerprint).toBe(ONE_FP)
    expect(rec.sourceEngine).toEqual(rec.result.engine)
  })

  test('ARC-16 record runs the given engine exactly once and stores what it returned, and the file then replays', async () => {
    const live = await textlayerRead(ONE_PAGE())
    const src = countingEngine(live)
    await record(ONE_PAGE(), src, tmp.dir, { testWorld: true })
    expect(src.reads).toBe(1)
    const rec = JSON.parse(fs.readFileSync(recordedPath(tmp.dir), 'utf8')) as Recording
    expect(rec.result).toEqual(live)
    const replayed = await replay(tmp.dir).read(ONE_PAGE())
    expect(replayed.words).toEqual(live.words)
  })
})

describe('A03 check 6: record is test world only (SEC-11)', () => {
  const MADE_UP = /test.?world|made.?up/i

  test('SEC-11 record without testWorld is refused, runs no engine and writes nothing', async () => {
    const src = countingEngine(await textlayerRead(ONE_PAGE()))
    const before = snapshot(tmp.dir)
    const err = await failure(() => recordLoose(ONE_PAGE(), src, tmp.dir))
    expect(err?.message).toMatch(MADE_UP)
    expect(src.reads).toBe(0)
    expect(snapshot(tmp.dir)).toEqual(before)
  })

  test('SEC-11 planted fault: testWorld false, a truthy string "true" or 1 is refused and writes nothing', async () => {
    const src = countingEngine(await textlayerRead(ONE_PAGE()))
    const before = snapshot(tmp.dir)
    for (const testWorld of [false, 'true', 1]) {
      const err = await failure(() => recordLoose(ONE_PAGE(), src, tmp.dir, { testWorld }))
      expect(err?.message, String(testWorld)).toMatch(MADE_UP)
    }
    expect(src.reads).toBe(0)
    expect(snapshot(tmp.dir)).toEqual(before)
  })

  test('SEC-11 with testWorld true the same call writes the recording (no false alarm)', async () => {
    const src = countingEngine(await textlayerRead(ONE_PAGE()))
    await record(ONE_PAGE(), src, tmp.dir, { testWorld: true })
    expect(fs.readdirSync(tmp.dir)).toEqual([`${ONE_FP}.json`])
  })
})

describe('A03 check 7: the adapter switch (ARC-6)', () => {
  async function adapterReads(engine: 'recorded' | 'textlayer'): Promise<ReadingResult> {
    const reader = createReadingAdapter({ env: { OCR_ENGINE: engine }, tempDir: tmp.dir, recordingsDir: RECORDINGS_DIR })
    expect(reader.name).toBe(engine)
    expect(reader.isLive).toBe(false)
    const result = await reader.read(ONE_PAGE())
    expect(result.engine.name).toBe(engine)
    return result
  }

  test('ARC-6 textlayer, then recorded, then textlayer again: each reads the fixture with the same words', async () => {
    const a = await adapterReads('textlayer')
    const b = await adapterReads('recorded')
    const c = await adapterReads('textlayer')
    expect(b.words).toEqual(a.words)
    expect(c.words).toEqual(a.words)
  })

  test('ARC-6 recorded, then textlayer, then recorded again (other direction)', async () => {
    const a = await adapterReads('recorded')
    const b = await adapterReads('textlayer')
    const c = await adapterReads('recorded')
    expect(b.words).toEqual(a.words)
    expect(c).toEqual(a)
  })

  test('ARC-6 the default stays textlayer when a recordings folder is given but no engine is chosen', async () => {
    const reader = createReadingAdapter({ env: {}, tempDir: tmp.dir, recordingsDir: RECORDINGS_DIR })
    expect(reader.name).toBe('textlayer')
    expect((await reader.read(ONE_PAGE())).engine.name).toBe('textlayer')
  })

  test('ARC-16 planted fault: the recorded adapter refuses a PDF with no recording instead of reading it with textlayer', async () => {
    const reader = createReadingAdapter({ env: { OCR_ENGINE: 'recorded' }, tempDir: tmp.dir, recordingsDir: RECORDINGS_DIR })
    const doc = UNRECORDED()
    const err = await failure(() => reader.read(doc))
    expect(err?.message).toContain(`no recording for ${doc.fingerprint}: re-record`)
  })

  test('ARC-16 planted fault: recorded with no recordings folder fails and never answers as textlayer', async () => {
    let answered: ReadingResult | undefined
    const err = await failure(async () => {
      const reader = createReadingAdapter({ env: { OCR_ENGINE: 'recorded' }, tempDir: tmp.dir })
      answered = await reader.read(ONE_PAGE())
    })
    expect(err).toBeDefined()
    expect(answered).toBeUndefined()
  })
})
