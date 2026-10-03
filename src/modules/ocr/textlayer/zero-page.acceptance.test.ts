// FX7 acceptance tests for SC's R54 on A01: a PDF whose page has zero width or zero height (a zero-size MediaBox) is
// a wrong-kind container. The text-layer engine refuses it with its own "Reading refused: " error, never a result
// read on a page size the library made up (pdfjs falls back to Letter for an empty MediaBox), and never a raw library
// error. The reason names no file and carries no library message or URL (SC's LIBRARY_TRACE).
// Spec choice (amber, FX7 spec 3 Oct): every page is checked, so a zero-size second page refuses the whole document.
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../../core/clock'
import { createTextLayerEngine } from './index'
import { fixtureDoc, sha256 } from './__fixtures__/harness'

const LIBRARY_TRACE = /https?:|node_modules|\bat \S+ \(|Exception\b|ZodError|TypeError|RangeError|pdf\.js|pdfjs|exceljs|unzip|inflate|\[object /i
const NAME = 'statement (Test).pdf'

/** A small PDF in raw syntax: one page of Courier text per entry, each with its own MediaBox; offsets exact. */
function rawPdf(pages: readonly { text: string; box: readonly number[] }[]): Uint8Array {
  const objs: string[] = []
  const kids = pages.map((_, i) => `${String(4 + i * 2)} 0 R`).join(' ')
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${String(pages.length)} >>`)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')
  pages.forEach((p, i) => {
    const content = `BT /F1 12 Tf 72 700 Td (${p.text}) Tj ET`
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [${p.box.join(' ')}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${String(5 + i * 2)} 0 R >>`)
    objs.push(`<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`)
  })
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${String(i + 1)} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Uint8Array.from(Buffer.from(out, 'latin1'))
}

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-03T12:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function outcome(bytes: Uint8Array): Promise<{ value?: unknown; threw?: unknown }> {
  const engine = createTextLayerEngine()
  try {
    return { value: await engine.read({ fingerprint: sha256(bytes), fileName: NAME, bytes }) }
  } catch (e) {
    return { threw: e }
  }
}

function expectRefused(o: { value?: unknown; threw?: unknown }): void {
  expect(o.value, 'a result was returned for a zero-size page').toBeUndefined()
  expect(o.threw).toBeInstanceOf(Error)
  const err = o.threw as Error
  expect(err.constructor).toBe(Error)
  expect(err.message).toMatch(/^Reading refused: /)
  expect(err.message).not.toMatch(LIBRARY_TRACE)
  expect(err.message).not.toContain(NAME)
}

describe('FX7 A01 refuses a zero-size page (R54)', () => {
  test('ARC-6 control: the same raw PDF with a Letter MediaBox reads, with its word', async () => {
    const o = await outcome(rawPdf([{ text: 'SALE (Test)', box: [0, 0, 612, 792] }]))
    expect(o.threw).toBeUndefined()
    const r = o.value as { pageCount: number; words: { text: string }[] }
    expect(r.pageCount).toBe(1)
    expect(r.words.map((w) => w.text)).toEqual(['SALE', '(Test)'])
  })
  test('ARC-6 control: the committed one-page fixture still reads', async () => {
    const engine = createTextLayerEngine()
    const r = await engine.read(fixtureDoc('one-page.pdf'))
    expect(r.pageCount).toBe(1)
    expect(r.words.length).toBeGreaterThan(0)
  })
  test('ARC-6 R54 planted: a MediaBox of [0 0 0 0] is refused with a reason, never read as Letter', async () => {
    expectRefused(await outcome(rawPdf([{ text: 'SALE (Test)', box: [0, 0, 0, 0] }])))
  })
  test('ARC-6 R54 planted: a page of zero width or zero height is refused', async () => {
    expectRefused(await outcome(rawPdf([{ text: 'SALE (Test)', box: [0, 0, 0, 792] }])))
    expectRefused(await outcome(rawPdf([{ text: 'SALE (Test)', box: [0, 0, 612, 0] }])))
  })
  test('ARC-6 R54 planted: a zero-size second page refuses the whole document', async () => {
    expectRefused(
      await outcome(
        rawPdf([
          { text: 'SALE (Test)', box: [0, 0, 612, 792] },
          { text: 'FEE (Test)', box: [0, 0, 0, 0] },
        ]),
      ),
    )
  })
})
