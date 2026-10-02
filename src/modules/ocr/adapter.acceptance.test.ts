// A01 acceptance tests: the reading adapter's engine switch (ARC-6, END-8), card check 7.
//
// Public API these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/modules/ocr/index.ts
//     createReadingAdapter(options?: { env?: Record<string, string | undefined>; tempDir?: string }): ReadingEngine
//       env: the settings, read by name (default process.env):
//         OCR_ENGINE    'textlayer' (the default when unset) | 'tesseract' (A02) | 'recorded' (A03) | 'live' (GL1, off)
//         OCR_LIVE_KEY  the live slot's key; live stays off with or without one, and the key is never shown
//       The textlayer adapter has name 'textlayer' and isLive false and reads as createTextLayerEngine does.
//       Choosing 'live' fails with "live reading is off until go-live", from the factory or from the first read
//       (these tests accept either).
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { ReadingResultSchema } from '../../contracts/reading'
import { createReadingAdapter } from './index'
import { expected, failure, fixtureDoc, tempDir, wordProblems } from './textlayer/__fixtures__/harness'

const OFF = /live reading is off until go-live/
const LIVE_KEY = 'PLANTED-ocr-live-key-3c9e71 (Test)'

let saved: Clock
let tmp: { dir: string; cleanup: () => void }

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-01T12:00:00-04:00'))
  tmp = tempDir('adapter')
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

/** An adapter made with `env` reads the one-page fixture with every expected word, as textlayer. */
async function textlayerWorks(env: Record<string, string | undefined>): Promise<void> {
  const reader = createReadingAdapter({ env, tempDir: tmp.dir })
  expect(reader.name).toBe('textlayer')
  expect(reader.isLive).toBe(false)
  const result = await reader.read(fixtureDoc('one-page.pdf'))
  expect(result.engine.name).toBe('textlayer')
  expect(ReadingResultSchema.safeParse(result).success).toBe(true)
  expect(wordProblems(result, expected('one-page.pdf').words)).toEqual([])
}

const liveFailure = (env: Record<string, string | undefined>): Promise<Error | undefined> =>
  failure(async () => {
    const reader = createReadingAdapter({ env, tempDir: tmp.dir })
    await reader.read(fixtureDoc('one-page.pdf'))
  })

describe('A01 check 7: the engine switch', () => {
  test('ARC-6 END-8 the default engine is textlayer, not live, when no engine setting is given', async () => {
    await textlayerWorks({})
  })

  test('ARC-6 END-8 textlayer, then live with no key fails with "live reading is off until go-live", then textlayer works again', async () => {
    await textlayerWorks({ OCR_ENGINE: 'textlayer' })
    expect((await liveFailure({ OCR_ENGINE: 'live' }))?.message).toMatch(OFF)
    await textlayerWorks({ OCR_ENGINE: 'textlayer' })
  })

  test('ARC-6 END-8 live first fails, then textlayer works, then live still fails (other direction)', async () => {
    expect((await liveFailure({ OCR_ENGINE: 'live' }))?.message).toMatch(OFF)
    await textlayerWorks({ OCR_ENGINE: 'textlayer' })
    expect((await liveFailure({ OCR_ENGINE: 'live' }))?.message).toMatch(OFF)
  })

  test('END-8 planted fault: with a live key present the live slot stays off, and the key never appears in the error', async () => {
    const err = await liveFailure({ OCR_ENGINE: 'live', OCR_LIVE_KEY: LIVE_KEY })
    expect(err?.message).toMatch(OFF)
    expect(`${String(err?.message)} ${String(err?.stack)}`).not.toContain(LIVE_KEY)
  })

  test('END-8 a live key lying around does not switch the default away from textlayer', async () => {
    await textlayerWorks({ OCR_LIVE_KEY: LIVE_KEY })
  })
})
