import { describe, expect, test } from 'vitest'
import { createTextLayerEngine, TEXTLAYER_LIBRARY } from './index'
import { expected, fixtureDoc } from './__fixtures__/harness'

describe('A01 text layer unit', () => {
  test('ARC-6 a word box is as tall as the font (12 of 792 points), upright and rotated', async () => {
    for (const name of ['one-page.pdf', 'rotated.pdf']) {
      const result = await createTextLayerEngine().read(fixtureDoc(name))
      for (const w of result.words) {
        expect(Math.abs(w.box.height - 12 / 792), `${name} ${w.text}`).toBeLessThan(0.002)
        expect(w.box.width).toBeGreaterThan(0)
      }
    }
  })

  test('ARC-6 box positions on the rotated page agree with the upright page to a thousandth', async () => {
    const a = await createTextLayerEngine().read(fixtureDoc('one-page.pdf'))
    const b = await createTextLayerEngine().read(fixtureDoc('rotated.pdf'))
    a.words.forEach((w, i) => {
      expect(Math.abs(w.box.left - (b.words[i]?.box.left ?? 9))).toBeLessThan(0.001)
      expect(Math.abs(w.box.top - (b.words[i]?.box.top ?? 9))).toBeLessThan(0.001)
    })
  })

  test('ARC-6 words are numbered in reading order from 1 and every confidence is 1', async () => {
    const result = await createTextLayerEngine().read(fixtureDoc('two-pages.pdf'))
    expect(result.words.map((w) => w.order)).toEqual(result.words.map((_, i) => i + 1))
    expect(result.words.every((w) => w.confidence === 1)).toBe(true)
    expect(result.words.length).toBe(expected('two-pages.pdf').words.length)
  })

  test('ARC-6 the engine names itself, keeps the folder it was given, and states the library and version', async () => {
    const e = createTextLayerEngine({ tempDir: '/tmp/x' })
    expect([e.name, e.isLive, e.tempDir]).toEqual(['textlayer', false, '/tmp/x'])
    expect(createTextLayerEngine().tempDir).toBeNull()
    const r = await e.read(fixtureDoc('one-page.pdf'))
    expect(r.engine).toEqual({ name: 'textlayer', version: `${TEXTLAYER_LIBRARY.name} ${TEXTLAYER_LIBRARY.version}` })
  })

  test('ARC-6 a read with no bytes and nothing stored is refused as broken', async () => {
    const doc = fixtureDoc('one-page.pdf')
    await expect(createTextLayerEngine().read({ fingerprint: doc.fingerprint })).rejects.toThrow(
      'Reading refused: the PDF is broken.',
    )
  })

  test('ARC-6 a refusal reads exactly "Reading refused: the PDF is encrypted."', async () => {
    await expect(createTextLayerEngine().read(fixtureDoc('encrypted.pdf'))).rejects.toThrow(
      'Reading refused: the PDF is encrypted.',
    )
  })
})
