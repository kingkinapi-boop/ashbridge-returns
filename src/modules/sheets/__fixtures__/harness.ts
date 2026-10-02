// A07 test harness (spec-writer): fixture bytes and expected cells, file IO only.
// The fixtures are built by make-fixtures.mjs in this folder; re-run it to rebuild them byte for byte.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(FIXTURES, '../../../..')

/** The bytes of a fixture, by its path under __fixtures__ (for example `c01/lakeview-chequing-4821.csv`). */
export function fixture(rel: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, rel)))
}

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

/** Row 3's payee in the accent copies (make-fixtures.mjs ACCENT_PAYEE). */
export const ACCENT_PAYEE = 'POS PURCHASE CAFÉ DÉPANNEUR – L’ÉTÈ (Test)'
/** Row 3's payee in the quoted copy, as read (RFC 4180 doubled quotes undone, the line break kept). */
export const QUOTED_PAYEE = 'POS PURCHASE "BEST" SMITH, JONES\nAND CO (Test)'

export interface ExpectedCell {
  sheet: string
  row: number
  column: { letter: string; number: number }
  text?: string
  type: string
  formula?: string
  hiddenRow: boolean
  hiddenColumn: boolean
  merged: string | null
}
export interface ExpectedWorkbook {
  file: string
  sheets: { name: string; hidden: boolean }[]
  cells: ExpectedCell[]
}
export interface ExpectedRefusal {
  file: string
  refused: true
  reason: string
}

export function expectedWorkbook(name: string): ExpectedWorkbook {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'xlsx', `${name}.expected.json`), 'utf8')) as ExpectedWorkbook
}
export function expectedRefusal(name: string): ExpectedRefusal {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'xlsx', `${name}.expected.json`), 'utf8')) as ExpectedRefusal
}

export interface AnswerKeyTransaction {
  id: string
  acct: string
  amount: number
  line: number
}
export interface AnswerKeyAccount {
  key: string
  file: string
  closingBalance: number
  rowsInExport: number
}
/** C01's answer key (made-up data, reference/sample-clients). */
export function c01AnswerKey(): { accounts: AnswerKeyAccount[]; transactions: AnswerKeyTransaction[] } {
  const file = path.join(ROOT, 'reference/sample-clients/01-maple-ridge/answer-key.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as { accounts: AnswerKeyAccount[]; transactions: AnswerKeyTransaction[] }
}

/** Every file path under `dir` (relative), sorted, with its sha256: a before/after picture for "nothing is written". */
export function listing(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath, e.name))
    .map((p) => `${path.relative(dir, p)} ${sha256(new Uint8Array(fs.readFileSync(p)))}`)
    .sort()
}
