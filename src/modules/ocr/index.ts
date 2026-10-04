// @mutate
// The reading adapter (A01, ARC-6): one switch over the reading engines. `textlayer` is the default;
// `tesseract` (A02) and `recorded` (A03) slot in later. `live` is a named slot that is off: it holds no key
// and refuses to run until go-live (END-8, GL1).
import { readSettings } from '../../core/env'
import type { ReadingDocument, ReadingEngine, ReadingResult } from '../../contracts/reading'
import { createRecordedEngine } from './recorded'
import { createTextLayerEngine } from './textlayer'

export type ReadingAdapterOptions = {
  env?: Record<string, string | undefined>
  tempDir?: string
  /** Where the `recorded` engine finds its recordings (A03). */
  recordingsDir?: string
}

export const LIVE_OFF_MESSAGE = 'live reading is off until go-live'

export function createReadingAdapter(options: ReadingAdapterOptions = {}): ReadingEngine {
  const settings = readSettings(options.env)
  if (settings.NODE_ENV === 'production' && settings.OCR_ENGINE === undefined) throw new Error('OCR_ENGINE must be set in production')
  const engine = settings.OCR_ENGINE ?? 'textlayer'
  switch (engine) {
    case 'textlayer':
      return createTextLayerEngine(options)
    case 'recorded':
      // Never a silent fallback to another engine: no folder, no engine (ARC-16).
      if (options.recordingsDir === undefined) throw new Error('the recorded engine needs a recordings folder: pass recordingsDir')
      return createRecordedEngine({ folder: options.recordingsDir })
    case 'live':
      // The key setting is never read: the slot stays off with or without one.
      throw new Error(LIVE_OFF_MESSAGE)
    default:
      throw new Error(`reading engine "${engine}" is not available yet`)
  }
}

export type { ReadingDocument, ReadingEngine, ReadingResult }
export { createTextLayerEngine, TEXTLAYER_LIBRARY } from './textlayer'
export type { TextLayerEngine } from './textlayer'
export { createRecordedEngine, record } from './recorded'
export type { RecordedEngine } from './recorded'
