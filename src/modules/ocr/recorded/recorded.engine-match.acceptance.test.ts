// FX11 acceptance tests: a recording's two engine fields agree (R84; AI-10, EV-5). Card plan/cards/FX11.md.
//
// A recording stores the engine that read the page twice: `sourceEngine` and `result.engine`. A03's reader used the
// recording unflagged when they differ, so an OCR text could name an engine (or version) that never read it, and a
// citation resting on it would carry the wrong provenance (AI-10: every AI output records the OCR engine; EV-5: a source
// pointer is to a document page and box).
//
// Spec choices (amber; the builder implements exactly these):
//   createRecordedEngine({ folder }).read(document) rejects when sourceEngine and result.engine differ in name or in
//   version. The message contains the fingerprint, the words "sourceEngine" and "result.engine", and both stamps'
//   names and versions. No result is returned (the promise rejects), and it is a refusal, never "no recording"
//   (no fallback). A recording whose two fields agree reads as before (A03's tests stay unchanged).
//
// Planted forms are copies of the committed recording under __recordings__/ with one engine field changed, written to
// a temp folder (never under a __recordings__/ folder, which R84's file scan reads). The version-mismatch form is the
// one R84's plant uses: result.engine.version "pdfjs-dist 6.3.290" against sourceEngine "pdfjs-dist 6.3.289".
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ReadingDocument, ReadingResult } from '../../../contracts/reading'
import { createReadingAdapter } from '../index'
import { failure, tempDir } from '../textlayer/__fixtures__/harness'
import { createRecordedEngine } from './index'
import { FIXTURES_DIR, RECORDINGS_DIR, sha256 } from './__fixtures__/make-fixtures'

type Stamp = { name: string; version: string }
type Recording = { fingerprint: string; recordedAt: string; result: ReadingResult; sourceEngine: Stamp }

let tmp: { dir: string; cleanup: () => void }

beforeEach(() => {
  tmp = tempDir('fx11')
})

afterEach(() => {
  tmp.cleanup()
})

const ONE_PAGE = (): ReadingDocument => {
  const bytes = Uint8Array.from(fs.readFileSync(path.join(FIXTURES_DIR, 'one-page.pdf')))
  return { fingerprint: sha256(bytes), fileName: 'one-page.pdf', bytes }
}
const ONE_FP = ONE_PAGE().fingerprint

function committedRecording(): Recording {
  return JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, `${ONE_FP}.json`), 'utf8')) as Recording
}

/** Writes a planted recording into the temp folder under the fixture's fingerprint, as `record` lays it out. */
function plant(rec: Recording): void {
  fs.writeFileSync(path.join(tmp.dir, `${ONE_FP}.json`), JSON.stringify(rec, null, 2) + '\n')
}

/** The committed recording with result.engine replaced; sourceEngine left as recorded. */
function withResultEngine(engine: Stamp): Recording {
  const rec = committedRecording()
  return { ...rec, result: { ...rec.result, engine } }
}

/** Reads the fixture from the temp folder; returns what came back and what was thrown. */
async function readPlanted(): Promise<{ result: ReadingResult | undefined; err: Error | undefined }> {
  let result: ReadingResult | undefined
  const err = await failure(async () => {
    result = await createRecordedEngine({ folder: tmp.dir }).read(ONE_PAGE())
  })
  return { result, err }
}

function expectRefusalNaming(err: Error | undefined, source: Stamp, inResult: Stamp): void {
  expect(err, 'the read must be refused').toBeDefined()
  const msg = err?.message ?? ''
  expect(msg).toContain(ONE_FP)
  expect(msg).toContain('sourceEngine')
  expect(msg).toContain('result.engine')
  for (const part of [source.name, source.version, inResult.name, inResult.version]) expect(msg).toContain(part)
  expect(msg).not.toContain('no recording for')
}

describe('FX11 a recording whose result.engine differs from its sourceEngine is refused (R84)', () => {
  test('AI-10 the committed recording carries textlayer in both engine fields (the real form the plants copy)', () => {
    const rec = committedRecording()
    expect(rec.sourceEngine.name).toBe('textlayer')
    expect(rec.result.engine).toEqual(rec.sourceEngine)
  })

  test('AI-10 planted fault: result.engine version pdfjs-dist 6.3.290 against sourceEngine 6.3.289 is refused naming both, no text returned', async () => {
    const source = committedRecording().sourceEngine
    const inResult = { name: source.name, version: 'pdfjs-dist 6.3.290' }
    expect(inResult.version).not.toBe(source.version)
    plant(withResultEngine(inResult))
    const { result, err } = await readPlanted()
    expect(result).toBeUndefined()
    expectRefusalNaming(err, source, inResult)
  })

  test('EV-5 planted fault: result.engine named by another engine at the same version is refused naming both, no text returned', async () => {
    const source = committedRecording().sourceEngine
    const inResult = { name: 'tesseract (Test)', version: source.version }
    plant(withResultEngine(inResult))
    const { result, err } = await readPlanted()
    expect(result).toBeUndefined()
    expectRefusalNaming(err, source, inResult)
  })

  test('EV-5 planted fault: a sourceEngine changed while result.engine is left as recorded is refused naming both', async () => {
    const rec = committedRecording()
    const source = { name: 'tesseract (Test)', version: '5.5.0 (Test)' }
    plant({ ...rec, sourceEngine: source })
    const { result, err } = await readPlanted()
    expect(result).toBeUndefined()
    expectRefusalNaming(err, source, rec.result.engine)
  })

  test('AI-10 planted fault: through the reading adapter (OCR_ENGINE recorded) the mismatched recording is refused, never read by another engine', async () => {
    const source = committedRecording().sourceEngine
    const inResult = { name: source.name, version: 'pdfjs-dist 6.3.290' }
    plant(withResultEngine(inResult))
    const reader = createReadingAdapter({ env: { OCR_ENGINE: 'recorded' }, tempDir: tmp.dir, recordingsDir: tmp.dir })
    let result: ReadingResult | undefined
    const err = await failure(async () => {
      result = await reader.read(ONE_PAGE())
    })
    expect(result).toBeUndefined()
    expectRefusalNaming(err, source, inResult)
  })

  test('AI-10 clean twin: the committed recording, and a copy of it in a temp folder, still read with the source engine stamp', async () => {
    const committed = await createRecordedEngine({ folder: RECORDINGS_DIR }).read(ONE_PAGE())
    expect(committed.engine).toEqual({ name: 'recorded', version: `textlayer@${committedRecording().sourceEngine.version}` })
    plant(committedRecording())
    const { result, err } = await readPlanted()
    expect(err).toBeUndefined()
    expect(result?.words.length).toBeGreaterThan(0)
    expect(result?.words).toEqual(committedRecording().result.words)
  })

  test('EV-5 clean twin: a recording from another engine with both fields agreeing still reads', async () => {
    const rec = committedRecording()
    const stamp = { name: 'tesseract (Test)', version: '5.5.0 (Test)' }
    plant({ ...rec, sourceEngine: stamp, result: { ...rec.result, engine: { ...stamp } } })
    const { result, err } = await readPlanted()
    expect(err).toBeUndefined()
    expect(result?.engine).toEqual({ name: 'recorded', version: 'tesseract (Test)@5.5.0 (Test)' })
  })
})
