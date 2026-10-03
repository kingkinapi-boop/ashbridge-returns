// A03 spec fixtures: copies of A01's made-up PDFs (copied byte for byte, never edited) and the folder names the
// recorded-engine acceptance tests use. Test support only; product code never imports this file.
//
// Regenerate (spec-writer only):  node src/modules/ocr/recorded/__fixtures__/make-fixtures.ts
//   one-page.pdf    = A01's textlayer/__fixtures__/one-page.pdf   (it has a recording in ../__recordings__/)
//   unrecorded.pdf  = A01's textlayer/__fixtures__/two-pages.pdf  (made up; it never gets a recording)
// The recording in ../__recordings__/<sha256 of one-page.pdf>.json and the golden ../__golden__/one-page.recording.json
// are the same bytes: the spec's definition of a recording file (sorted keys at every level, two-space indent, LF
// line ends, one final LF). They were made by reading one-page.pdf with `textlayer` with the clock pinned at
// RECORDED_AT; once A03 is built, `record` must write exactly these bytes (card check 5).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url))
export const RECORDED_DIR = path.dirname(FIXTURES_DIR)
export const RECORDINGS_DIR = path.join(RECORDED_DIR, '__recordings__')
export const GOLDEN_DIR = path.join(RECORDED_DIR, '__golden__')
export const A01_FIXTURES_DIR = path.join(RECORDED_DIR, '..', 'textlayer', '__fixtures__')

/** The pinned clock reading the committed recording was made at (and `record` runs at in check 5). */
export const RECORDED_AT = '2026-10-01T12:00:00-04:00'

/** Each copy: its name here and the A01 fixture it copies. */
export const COPIES: readonly { name: string; from: string }[] = [
  { name: 'one-page.pdf', from: 'one-page.pdf' },
  { name: 'unrecorded.pdf', from: 'two-pages.pdf' },
]

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

export function writeFixtures(dir: string = FIXTURES_DIR): void {
  for (const c of COPIES) fs.copyFileSync(path.join(A01_FIXTURES_DIR, c.from), path.join(dir, c.name))
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) writeFixtures()
