// @mutate
// The spreadsheet and CSV reading contract (A07, EV-5, EV-6, EV-14): every cell with its sheet, row and column,
// and the one code check that a value sits in a cell (cellValueMatches), the cell twin of valueInBox.
import { z } from 'zod'
import { normaliseAmount } from './amount-grammar'

const fingerprint = z.string().regex(/^[0-9a-f]{64}$/)
const columnLetters = z.string().regex(/^[A-Z]{1,3}$/)

export const CellSchema = z.strictObject({
  /** 1-based. For a CSV, the record number (header = 1). */
  row: z.number().int().min(1),
  column: z.strictObject({ letter: columnLetters, number: z.number().int().min(1) }),
  /** Exactly as stored; ISO for a date; the cached value for a formula. */
  text: z.string(),
  type: z.enum(['text', 'number', 'date', 'boolean', 'formula', 'empty']),
  /** The formula without its "=", on formula cells only. */
  formula: z.string().optional(),
  hiddenRow: z.boolean(),
  hiddenColumn: z.boolean(),
  /** The merged range this cell belongs to, for example "A1:C1". */
  merged: z.string().nullable(),
})
export type Cell = z.infer<typeof CellSchema>

export const SheetSchema = z.strictObject({
  name: z.string().trim().min(1),
  hidden: z.boolean(),
  cells: z.array(CellSchema),
})

/** ARC-10: the engine name and version are on every result and never blank. */
export const SheetEngineSchema = z.strictObject({
  name: z.string().trim().min(1),
  version: z.string().trim().min(1),
})

export const SheetResultSchema = z.strictObject({
  fileFingerprint: fingerprint,
  engine: SheetEngineSchema,
  /** From the injected clock (src/core/clock.ts). */
  readAt: z.iso.datetime({ offset: true }),
  /** CSV only. */
  encoding: z.enum(['utf-8', 'utf-8-bom', 'windows-1252']).optional(),
  /** CSV only. */
  separator: z.enum([',', ';', '\t']).optional(),
  sheets: z.array(SheetSchema),
})
export type SheetResult = z.infer<typeof SheetResultSchema>

/** EV-5: file fingerprint, sheet, row and column. A CSV's sheet is the fixed name "csv". */
export const CellPointerSchema = z.strictObject({
  fileFingerprint: fingerprint,
  sheet: z.string().trim().min(1),
  row: z.number().int().min(1),
  column: columnLetters,
})
export type CellPointer = z.infer<typeof CellPointerSchema>

export type CellMatch =
  | { ok: true }
  | { ok: false; reason: 'no such cell' | 'empty cell' | 'value differs' | 'formula cell: cached value differs' }

/** Column number to letters: 1 is A, 26 is Z, 27 is AA. */
export function columnLetter(number: number): string {
  let n = number
  let letters = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    n = (n - rest - 1) / 26
  }
  return letters
}

const fold = (s: string): string => s.trim().toLowerCase()

/** Money compares as cents through F09A's grammar when both sides read as an amount; anything else compares as trimmed, case-folded text. */
function sameValue(stored: string, value: string): boolean {
  const a = normaliseAmount(stored)
  const b = normaliseAmount(value)
  if (a.ok && b.ok) return a.cents === b.cents
  return fold(stored) === fold(value)
}

/** EV-6 for cells: true only when the value equals what the pointed-to cell stores. */
export function cellValueMatches(result: SheetResult, pointer: CellPointer, value: string): CellMatch {
  if (pointer.fileFingerprint !== result.fileFingerprint) return { ok: false, reason: 'no such cell' }
  const sheet = result.sheets.find((s) => s.name === pointer.sheet)
  const cell = sheet?.cells.find((c) => c.row === pointer.row && c.column.letter === pointer.column)
  if (!cell) return { ok: false, reason: 'no such cell' }
  if (cell.type === 'empty') return { ok: false, reason: 'empty cell' }
  if (sameValue(cell.text, value)) return { ok: true }
  return { ok: false, reason: cell.type === 'formula' ? 'formula cell: cached value differs' : 'value differs' }
}
