// @mutate
// The reading adapter (A01, ARC-6): one switch over the reading engines. `textlayer` is the default;
// `tesseract` (A02) and `recorded` (A03) slot in later. `live` is a named slot that is off: it holds no key
// and refuses to run until go-live (END-8, GL1).
import type { ReadingDocument, ReadingEngine, ReadingResult } from '../../contracts/reading'
import { createTextLayerEngine } from './textlayer'

export type ReadingAdapterOptions = {
  env?: Record<string, string | undefined>
  tempDir?: string
}

export const LIVE_OFF_MESSAGE = 'live reading is off until go-live'

export function createReadingAdapter(options: ReadingAdapterOptions = {}): ReadingEngine {
  const env = options.env ?? process.env
  const engine = env['OCR_ENGINE'] ?? 'textlayer'
  switch (engine) {
    case 'textlayer':
      return createTextLayerEngine(options)
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
