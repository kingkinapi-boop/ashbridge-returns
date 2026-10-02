import { describe, expect, test } from 'vitest'
import { createReadingAdapter } from '../index'
import { createTextLayerEngine, type TextLayerEngine } from './index'
import { sha256 } from './__fixtures__/harness'
import { invisibleTextPdf, NEL } from './__fixtures__/make-fixtures'

/** A one-page Courier 12 PDF (every glyph 7.2 pt wide) with the given content stream and page extras. */
function pdf(content: string, pageExtra = ''): { fingerprint: string; fileName: string; bytes: Uint8Array } {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${pageExtra} /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /FirstChar 32 /LastChar 126 /Widths [${Array(95).fill(600).join(' ')}] >>`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${String(i + 1)} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  const bytes = Uint8Array.from(Buffer.from(out, 'latin1'))
  return { fingerprint: sha256(bytes), fileName: 'made-up.pdf', bytes }
}

describe('A01 text layer geometry', () => {
  test('ARC-6 a word set at 45 degrees gets the box that holds all four corners', async () => {
    const c = Math.SQRT1_2
    const r = await createTextLayerEngine().read(pdf(`BT /F1 12 Tf ${String(c)} ${String(c)} ${String(-c)} ${String(c)} 300 400 Tm (AB) Tj ET`))
    const w = r.words[0]
    if (w === undefined) throw new Error('no word read')
    // corners (pt): (300,400) (300+14.4c,400+14.4c) (300-12c,400+12c) (300+2.4c,400+26.4c)
    const side = (14.4 + 12) * c
    expect(w.text).toBe('AB')
    expect(w.box.left).toBeCloseTo((300 - 12 * c) / 612, 4)
    expect(w.box.width).toBeCloseTo(side / 612, 4)
    expect(w.box.top).toBeCloseTo((792 - (400 + side)) / 792, 4)
    expect(w.box.height).toBeCloseTo(side / 792, 4)
  })

  test('ARC-6 a word set at 135 degrees gets the box that holds all four corners', async () => {
    const c = Math.SQRT1_2
    const r = await createTextLayerEngine().read(pdf(`BT /F1 12 Tf ${String(-c)} ${String(c)} ${String(-c)} ${String(-c)} 300 400 Tm (AB) Tj ET`))
    const w = r.words[0]
    if (w === undefined) throw new Error('no word read')
    // corners (pt): (300,400) (300-14.4c,400+14.4c) (300-26.4c,400+2.4c) (300-12c,400-12c)
    expect(w.box.left).toBeCloseTo((300 - 26.4 * c) / 612, 4)
    expect(w.box.width).toBeCloseTo((26.4 * c) / 612, 4)
    expect(w.box.top).toBeCloseTo((792 - (400 + 14.4 * c)) / 792, 4)
    expect(w.box.height).toBeCloseTo((26.4 * c) / 792, 4)
  })

  test('ARC-6 a page turned 180 degrees gives the box in the upright frame the reader sees', async () => {
    const r = await createTextLayerEngine().read(pdf('BT /F1 12 Tf 72 720 Td (Maple) Tj ET', '/Rotate 180'))
    const w = r.words[0]
    if (w === undefined) throw new Error('no word read')
    expect(w.box.left).toBeCloseTo((612 - 72 - 36) / 612, 4)
    expect(w.box.top).toBeCloseTo(720 / 792, 4)
    expect(w.box.width).toBeCloseTo(36 / 612, 4)
  })

  test('ARC-6 a page holding only spaces has no text layer and no words', async () => {
    const r = await createTextLayerEngine().read(pdf('BT /F1 12 Tf 72 720 Td (   ) Tj ET'))
    expect(r.words).toEqual([])
    expect(r.pages[0]?.hasTextLayer).toBe(false)
  })

  test('ARC-6 an invisible token inside a line of words makes no word of its own', async () => {
    const bytes = invisibleTextPdf([0x61, 0x20, NEL, 0x20, 0xad, 0x20, 0x62])
    const r = await createTextLayerEngine().read({ fingerprint: sha256(bytes), fileName: 'mixed.pdf', bytes })
    expect(r.words.map((w) => w.text)).toEqual(['a', 'b'])
  })

  test('ARC-6 the adapter hands its temp folder to the text layer engine', () => {
    const e = createReadingAdapter({ env: {}, tempDir: '/tmp/a01-x' }) as TextLayerEngine
    expect(e.tempDir).toBe('/tmp/a01-x')
  })
})
