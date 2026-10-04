// FX2 acceptance tests: OCR_ENGINE is declared in src/core/env.ts and a production deploy that forgets it refuses (SEC-11, ARC-6, ARC-20).
// Same pattern as A06's AUTH_ENGINE: the stand-in is the default outside production; NODE_ENV=production with the setting unset throws a message naming the setting.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { readSettings } from '../../core/env'
import { createReadingAdapter } from './index'
import { expected, failure, fixtureDoc, tempDir, wordProblems } from './textlayer/__fixtures__/harness'

let saved: Clock
let tmp: { dir: string; cleanup: () => void }

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-01T12:00:00-04:00'))
  tmp = tempDir('fx2-ocr')
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

async function textlayerWorks(env: Record<string, string | undefined>): Promise<void> {
  const reader = createReadingAdapter({ env, tempDir: tmp.dir })
  expect(reader.name).toBe('textlayer')
  expect(reader.isLive).toBe(false)
  const result = await reader.read(fixtureDoc('one-page.pdf'))
  expect(wordProblems(result, expected('one-page.pdf').words)).toEqual([])
}

const refusal = (env: Record<string, string | undefined>): Promise<Error | undefined> =>
  failure(() => {
    createReadingAdapter({ env, tempDir: tmp.dir })
    return Promise.resolve()
  })

describe('FX2 OCR_ENGINE in production', () => {
  test('SEC-11 ARC-6 production with OCR_ENGINE unset refuses, naming the setting', async () => {
    const err = await refusal({ NODE_ENV: 'production' })
    expect(err, 'the factory must refuse').toBeDefined()
    expect(err?.message).toMatch(/OCR_ENGINE/)
  })

  test('SEC-11 production with OCR_ENGINE blank refuses like unset', async () => {
    expect((await refusal({ NODE_ENV: 'production', OCR_ENGINE: '' }))?.message).toMatch(/OCR_ENGINE/)
  })

  test('SEC-11 ARC-6 production with OCR_ENGINE=textlayer works (set on purpose)', async () => {
    await textlayerWorks({ NODE_ENV: 'production', OCR_ENGINE: 'textlayer' })
  })

  test('SEC-11 ARC-6 production with OCR_ENGINE=live still fails as off, not as a missing setting', async () => {
    const err = await refusal({ NODE_ENV: 'production', OCR_ENGINE: 'live' })
    expect(err?.message).toMatch(/live reading is off until go-live/)
  })

  test('ARC-6 development and test with OCR_ENGINE unset use the textlayer stand-in', async () => {
    await textlayerWorks({ NODE_ENV: 'development' })
    await textlayerWorks({ NODE_ENV: 'test' })
    await textlayerWorks({})
  })

  test('SEC-11 both directions in one process: refuse, work, refuse again', async () => {
    expect((await refusal({ NODE_ENV: 'production' }))?.message).toMatch(/OCR_ENGINE/)
    await textlayerWorks({ NODE_ENV: 'production', OCR_ENGINE: 'textlayer' })
    expect((await refusal({ NODE_ENV: 'production' }))?.message).toMatch(/OCR_ENGINE/)
  })

  test('SEC-10 planted fault: the refusal never shows a planted value of another setting', async () => {
    const err = await refusal({ NODE_ENV: 'production', OCR_LIVE_KEY: 'PLANTED-ocr-key-91ab (Test)' })
    expect(err?.message).toMatch(/OCR_ENGINE/)
    expect(err?.message).not.toMatch(/PLANTED/)
  })
})

describe('FX2 env.ts declares the engine settings', () => {
  test('ARC-6 ARC-20 readSettings carries OCR_ENGINE, with blank read as unset', () => {
    const read = (env: Record<string, string>): unknown => (readSettings(env) as Record<string, unknown>)['OCR_ENGINE']
    expect(read({ OCR_ENGINE: 'textlayer' })).toBe('textlayer')
    expect(read({ OCR_ENGINE: '' })).toBeUndefined()
    expect(read({})).toBeUndefined()
  })

  test('ARC-20 no module reads process.env for an engine (reads go through env.ts)', () => {
    const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8')
    expect(src).not.toMatch(/env\[\s*['"]OCR_ENGINE['"]\s*\]/)
    expect(src).not.toMatch(/process\.env/)
  })
})
