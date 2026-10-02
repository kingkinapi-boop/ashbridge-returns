// S01 test harness (spec-writer only; builders never edit). Byte and cell helpers for the fault tests.
// Uses F03's contract only: nothing here imports the simulator or the faults module.
import { readFileSync } from 'node:fs'
import {
  parseCellId,
  parseTaxprepCsv,
  writeTaxprepCsv,
  type CellId,
  type ParsedRow,
  type TaxprepFault,
  type TaxprepHeader,
  type WriteRow,
  type WriteValue,
} from '../../../../contracts/taxprep'

export const SEED = 20261002
export const SEEDS = [0, 1, 7, 42, SEED] as const

const repoUrl = (rel: string): URL => new URL(`../../../../../${rel}`, import.meta.url)
export const repoText = (rel: string): string => readFileSync(repoUrl(rel), 'utf8')

export const asText = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1')
export const fromText = (text: string): Uint8Array => Uint8Array.from(Buffer.from(text, 'latin1'))

export function id(text: string): CellId {
  const r = parseCellId(text)
  if (!r.ok) throw new Error(`test fixture: ${text} should parse: ${r.reason}`)
  return r.id
}

export const amt = (amount: number): WriteValue => ({ kind: 'amount', amount })
export const txt = (text: string): WriteValue => ({ kind: 'text', text })
export const rate = (r: number): WriteValue => ({ kind: 'rate', rate: r })
export const clr: WriteValue = { kind: 'clear' }

/** An import file through F03's writer (the shape T01 will write). */
export function importFile(pairs: readonly (readonly [string, WriteValue])[], header: TaxprepHeader): Uint8Array {
  const rows: WriteRow[] = pairs.map(([cell, current]) => ({ id: id(cell), current }))
  const r = writeTaxprepCsv({ header, rows }, { purpose: 'import' })
  if (!r.ok) throw new Error(`test fixture file refused: ${JSON.stringify(r.problems)}`)
  return r.bytes
}

export function parseOk(bytes: Uint8Array): { header: TaxprepHeader; rows: ParsedRow[] } {
  const r = parseTaxprepCsv(bytes)
  if (!r.ok) throw new Error(`expected the file to parse, got faults: ${JSON.stringify(r.faults)}`)
  return r.file
}

export function faultsOf(bytes: Uint8Array): TaxprepFault[] {
  const r = parseTaxprepCsv(bytes)
  return r.ok ? [] : r.faults
}

/** Identifier to current-year value (after F03's apostrophe strip; a clear is ""). */
export function cellsOf(bytes: Uint8Array): Map<string, string> {
  const out = new Map<string, string>()
  for (const row of parseOk(bytes).rows) out.set(row.id.text, row.current.kind === 'clear' ? '' : row.current.text)
  return out
}

/** The identifiers whose value differs between two files (a missing row counts as ""), sorted. */
export function cellDiff(a: Uint8Array, b: Uint8Array): string[] {
  const ca = cellsOf(a)
  const cb = cellsOf(b)
  const all = new Set([...ca.keys(), ...cb.keys()])
  return [...all].filter((k) => (ca.get(k) ?? '') !== (cb.get(k) ?? '')).sort()
}

/** The lines of a file (CRLF or LF), without the final empty one. */
export function linesOf(bytes: Uint8Array): string[] {
  const lines = asText(bytes).split(/\r\n|\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** The identifier a row line starts with (up to the first separator, quote or space). */
export function lineId(line: string): string {
  const cut = line.search(/[,\t; "]/)
  return cut < 0 ? line : line.slice(0, cut)
}

/** The lines of a file with the header and every row for the given identifiers taken out. */
export function linesWithout(bytes: Uint8Array, identifiers: readonly string[], dropHeader: boolean): string[] {
  const skip = new Set(identifiers)
  const lines = linesOf(bytes)
  return lines.filter((line, i) => !(i === 0 && dropHeader) && !(i > 0 && skip.has(lineId(line))))
}

export const GUID_A = 'aaaaaaaa-1111-4111-8111-111111111111'
export const GUID_B = 'bbbbbbbb-2222-4222-8222-222222222222'
export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ZERO_HEADER: TaxprepHeader = { returnName: 'Anything (Test)', guid: '00000000-0000-0000-0000-000000000000' }

export const CCA = 'CCACat.FD08C'
export const CLASS_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA1`
export const RATE_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA2`
export const UCC_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA5`
export const CLAIMED_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA22`
export const BN_CELL = 'IDENT.Ident7'
export const YEAR_END_CELL = 'IDENT.Ident121'

/** GIFI 1000 to 1007 (reference/sample-clients/lib/taxprep-cells.json). */
export const GIFI = [
  'GFGBA.Ttwgba62',
  'GFGBA.Ttwgba63',
  'GFGBA.Ttwgba64',
  'GFGBA.Ttwgba65',
  'GFGBA.Ttwgba66',
  'GFGBA.Ttwgba67',
  'GFGBA.Ttwgba68',
  'GFGBA.Ttwgba69',
] as const
const g = (i: number): string => GIFI[i] as string

/** The first import: six GIFI cells (one negative, one above 1000), and three S8 copies (classes 8, 10 and 50). */
export const FILE_A_ROWS: readonly (readonly [string, WriteValue])[] = [
  [g(0), amt(125000)],
  [g(1), amt(-1299)],
  [g(2), amt(5000)],
  [g(3), amt(42)],
  [g(4), amt(7)],
  [g(5), amt(31415)],
  [CLASS_CELL(1), txt('8')],
  [RATE_CELL(1), rate(0.2)],
  [UCC_CELL(1), amt(30000)],
  [CLAIMED_CELL(1), amt(6000)],
  [CLASS_CELL(2), txt('10')],
  [RATE_CELL(2), rate(0.3)],
  [UCC_CELL(2), amt(12000)],
  [CLASS_CELL(3), txt('50')],
  [RATE_CELL(3), rate(0.55)],
  [UCC_CELL(3), amt(8000)],
]

/** The second import: one value changed, one the same, one cleared, one new, one copy value changed. */
export const FILE_B_ROWS: readonly (readonly [string, WriteValue])[] = [
  [g(0), amt(130000)],
  [g(1), amt(-1299)],
  [g(2), clr],
  [g(3), amt(42)],
  [g(6), amt(900)],
  [UCC_CELL(2), amt(11000)],
]

/** The cells FILE_B changes on a return that holds FILE_A, worked out by hand. */
export const FILE_B_CHANGES: readonly string[] = [g(0), g(2), g(6), UCC_CELL(2)].sort()
