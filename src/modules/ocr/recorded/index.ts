// @mutate
// The recorded reading engine (A03, ARC-6, ARC-10, ARC-16, SEC-11): replays a stored F09 reading result for a known
// document so tests that only need words run fast and the same every time. The recording is found by the document's
// fingerprint. A missing or bad recording is refused with the reason; nothing falls back to another engine.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { now } from '../../../core/clock'
import { z } from 'zod'
import { EngineStampSchema, ReadingResultSchema, type ReadingDocument, type ReadingEngine, type ReadingResult } from '../../../contracts/reading'

export interface RecordedEngine extends ReadingEngine {
  name: 'recorded'
  isLive: false
}

export type RecordedOptions = {
  /** The folder the recordings live in (each card keeps its own under its __recordings__/). */
  folder: string
}

type Recording = z.infer<ReturnType<typeof recordingSchema>>

function fileFor(folder: string, fingerprint: string): string {
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) throw new Error(`recording refused: "${fingerprint}" is not a sha256 fingerprint`)
  return path.join(folder, `${fingerprint}.json`)
}

// A function, not a constant, so each use is a run the tests can see.
const recordingSchema = () =>
  z.strictObject({
    fingerprint: z.string(),
    recordedAt: z.iso.datetime({ offset: true }),
    sourceEngine: EngineStampSchema,
    result: ReadingResultSchema,
  })

const refused = (fingerprint: string, why: string): Error => new Error(`recording for ${fingerprint} is refused: ${why}`)

function isObject(v: unknown): v is Record<string, unknown> {
  // Stryker disable next-line ConditionalExpression: the recorded result passed a strict schema, so it holds no null
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Reads and checks one recording file; the whole file is validated, the result by F09's schema. */
function load(folder: string, fingerprint: string): Recording {
  const file = fileFor(folder, fingerprint)
  let text: string
  try {
    // Stryker disable next-line StringLiteral: JSON.parse turns a Buffer into the same text, so the encoding changes nothing
    text = fs.readFileSync(file, 'utf8')
  } catch {
    throw new Error(`no recording for ${fingerprint}: re-record`)
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw refused(fingerprint, 'the file is not JSON')
  }
  const parsed = recordingSchema().safeParse(raw)
  if (!parsed.success) {
    const why = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw refused(fingerprint, `the file fails the recording schema (${why})`)
  }
  const rec = parsed.data
  if (rec.fingerprint !== fingerprint) throw refused(fingerprint, 'its stored fingerprint differs from its file name')
  if (rec.result.documentFingerprint !== fingerprint) throw refused(fingerprint, "the result's documentFingerprint differs from the fingerprint")
  return rec
}

export function createRecordedEngine(options: RecordedOptions): RecordedEngine {
  return {
    name: 'recorded',
    isLive: false,
    read(document: ReadingDocument): Promise<ReadingResult> {
      try {
        const rec = load(options.folder, document.fingerprint)
        // ARC-10: say which engine really read the page.
        return Promise.resolve({
          ...rec.result,
          engine: { name: 'recorded', version: `${rec.sourceEngine.name}@${rec.sourceEngine.version}` },
        })
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)))
      }
    },
  }
}

function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted)
  if (isObject(v)) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sorted(v[k])]),
    )
  }
  return v
}

/**
 * Runs `engine` once on a test-world document and writes the recording (sorted keys, LF line ends, one final LF).
 * SEC-11: refused unless the caller passes `testWorld: true`; nothing is read or written otherwise.
 */
export async function record(
  document: ReadingDocument,
  engine: ReadingEngine,
  folder: string,
  options: { testWorld: true },
): Promise<Recording> {
  if ((options as { testWorld?: unknown } | undefined)?.testWorld !== true) {
    throw new Error('record is for the test world only: pass testWorld: true for made-up data')
  }
  if (document.bytes === undefined) throw new Error('record needs the document bytes')
  const fingerprint = createHash('sha256').update(document.bytes).digest('hex')
  const result = ReadingResultSchema.parse(await engine.read(document))
  if (result.documentFingerprint !== fingerprint) throw new Error('record refused: the result is for another document')
  const recording: Recording = {
    fingerprint,
    recordedAt: now().toISOString(),
    result,
    sourceEngine: { name: result.engine.name, version: result.engine.version },
  }
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(fileFor(folder, fingerprint), `${JSON.stringify(sorted(recording), null, 2)}\n`)
  return recording
}
