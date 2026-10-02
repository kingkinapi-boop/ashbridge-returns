// @mutate
// The free reading engine for born-digital PDFs (A01): every word on every page with its box, in F09's shape.
// Reads the PDF's own text layer through pdfjs-dist (no account, no key, no network). A page without a text
// layer is reported as such, never as an empty success (ARC-6). Results are stored per fingerprint (ARC-11).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { now } from '../../../core/clock'
import { ReadingResultSchema, type ReadingDocument, type ReadingEngine, type ReadingResult, type Word } from '../../../contracts/reading'

export const TEXTLAYER_LIBRARY = { name: 'pdfjs-dist', version: '6.3.289' } as const

export interface TextLayerEngine extends ReadingEngine {
  name: 'textlayer'
  isLive: false
  /** The folder the engine may write to; it writes nothing, so it stays empty. */
  tempDir: string | null
  /** How many times this engine has parsed a PDF with the library; a read answered from the store does not count. */
  parseCount(): number
}

export type TextLayerOptions = {
  /** The only folder the engine may write to. The engine writes nothing, so it is accepted and never touched. */
  tempDir?: string
}

type Corner = readonly [number, number]

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

function refused(reason: 'encrypted' | 'broken'): Error {
  return new Error(`Reading refused: the PDF is ${reason}.`)
}

/** The box of one word, from its corners in the upright page frame (points, origin top left). */
function boxOf(page: number, corners: Corner[], widthPt: number, heightPt: number): Word['box'] {
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const left = clamp01(Math.min(...xs) / widthPt)
  const top = clamp01(Math.min(...ys) / heightPt)
  const right = clamp01(Math.max(...xs) / widthPt)
  const bottom = clamp01(Math.max(...ys) / heightPt)
  return { page, left, top, width: right - left, height: bottom - top }
}

async function parse(bytes: Uint8Array, fingerprint: string): Promise<ReadingResult> {
  const task = pdfjs.getDocument({
    data: Uint8Array.from(bytes),
    // Stryker disable next-line BooleanLiteral: the fonts only matter for drawing; word widths come from the PDF itself.
    useSystemFonts: false,
    verbosity: 0,
  })
  let doc: pdfjs.PDFDocumentProxy
  try {
    doc = await task.promise
  } catch (e) {
    await task.destroy()
    throw refused(e instanceof Error && e.name === 'PasswordException' ? 'encrypted' : 'broken')
  }
  try {
    const pages: ReadingResult['pages'] = []
    const words: Word[] = []
    let order = 0
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n)
      const view = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      let any = false
      for (const item of content.items) {
        // Stryker disable next-line ConditionalExpression,LogicalOperator: a type guard only; without includeMarkedContent every item has a str.
        if (!('str' in item)) continue
        // Stryker disable next-line ConditionalExpression,MethodExpression,StringLiteral: pdfjs only emits a blank item between two words, so `any` is already set and a blank item makes no word.
        if (item.str.trim() === '') continue
        any = true
        const t = item.transform as number[]
        const [a = 1, b = 0] = t
        const e = t[4] ?? 0
        const f = t[5] ?? 0
        const len = Math.hypot(a, b) || 1
        const along: Corner = [a / len, b / len]
        const up: Corner = [-along[1], along[0]]
        const chars = item.str.length
        for (const m of item.str.matchAll(/\S+/g)) {
          const s = (m.index / chars) * item.width
          const w = (m[0].length / chars) * item.width
          const quad: Corner[] = [
            [e + along[0] * s, f + along[1] * s],
            [e + along[0] * (s + w), f + along[1] * (s + w)],
            [e + along[0] * (s + w) + up[0] * item.height, f + along[1] * (s + w) + up[1] * item.height],
            [e + along[0] * s + up[0] * item.height, f + along[1] * s + up[1] * item.height],
          ]
          const [va = 1, vb = 0, vc = 0, vd = 1, ve = 0, vf = 0] = view.transform
          const viewCorners = quad.map((p): Corner => [p[0] * va + p[1] * vc + ve, p[0] * vb + p[1] * vd + vf])
          order += 1
          words.push({ text: m[0], box: boxOf(n, viewCorners, view.width, view.height), confidence: 1, order })
        }
      }
      pages.push({ number: n, widthPt: view.width, heightPt: view.height, hasTextLayer: any })
    }
    return ReadingResultSchema.parse({
      documentFingerprint: fingerprint,
      engine: { name: 'textlayer', version: `${TEXTLAYER_LIBRARY.name} ${TEXTLAYER_LIBRARY.version}` },
      readAt: now().toISOString(),
      pageCount: doc.numPages,
      pages,
      words,
    })
  } finally {
    await task.destroy()
  }
}

export function createTextLayerEngine(options: TextLayerOptions = {}): TextLayerEngine {
  const store = new Map<string, ReadingResult>()
  let parses = 0
  return {
    name: 'textlayer',
    isLive: false,
    tempDir: options.tempDir ?? null,
    parseCount: () => parses,
    async read(document: ReadingDocument): Promise<ReadingResult> {
      const stored = store.get(document.fingerprint)
      if (stored !== undefined) return structuredClone(stored)
      if (document.bytes === undefined) throw refused('broken')
      parses += 1
      const result = await parse(document.bytes, document.fingerprint)
      store.set(document.fingerprint, result)
      return structuredClone(result)
    },
  }
}
