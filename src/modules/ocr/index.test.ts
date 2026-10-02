import { describe, expect, test } from 'vitest'
import { createReadingAdapter, LIVE_OFF_MESSAGE } from './index'

describe('A01 adapter unit', () => {
  test('END-8 the live message is exact', () => {
    expect(LIVE_OFF_MESSAGE).toBe('live reading is off until go-live')
    expect(() => createReadingAdapter({ env: { OCR_ENGINE: 'live' } })).toThrow(LIVE_OFF_MESSAGE)
  })

  test('ARC-6 an engine not built yet is refused by name', () => {
    expect(() => createReadingAdapter({ env: { OCR_ENGINE: 'tesseract' } })).toThrow(
      'reading engine "tesseract" is not available yet',
    )
  })

  test('ARC-6 a temp folder is passed to the text-layer engine', () => {
    const e = createReadingAdapter({ env: {}, tempDir: '/tmp/y' })
    expect(e).toMatchObject({ name: 'textlayer', tempDir: '/tmp/y' })
    expect(createReadingAdapter({ env: {} })).toMatchObject({ tempDir: null })
  })
})
