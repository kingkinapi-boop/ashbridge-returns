// FX4 acceptance tests, ARC-10 (card plan/cards/FX4.md, Lead directive A434; spec review reports/FX4-spec-review.md gap 11):
// FX4 changes the text the reader derives (slid shared formulas, cycle members, skipped SUMs) while the library stays
// exceljs 4.4.0, so the engine stamp gains the reader's rules number. A pointer read before FX4 and one read after can
// then be told apart.
//
// Public API this file needs from src/modules/sheets/xlsx/index.ts:
//   READER_RULES: number   a whole number from 1, raised whenever the reader's derived text changes
// and every .xlsx result's engine is { name: 'exceljs', version: `4.4.0+rules.${READER_RULES}` } (XLSX_LIBRARY unchanged).
//
// Spec choices (amber, see reports/FX4-spec.md):
//   F11. "Bumped when derived text changes" is held by a golden per rules number: src/modules/sheets/__golden__/
//        reader-rules.<N>.json holds what a fixed corpus reads. A change to derived text fails it; the fix is a new rules
//        number and a new golden from a spec job, never an edit to an old golden. The corpus holds only cells whose text
//        other tests pin exactly (the item 1 totals, which may read exact or own, are left out).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import type { SheetResult } from '../../contracts/sheets'
import { address, gridXlsx, parseAddress, xmlText } from './__fixtures__/a07d'
import { PLANTED, floatSum, formulaBody, numberBody, sparseXlsx } from './__fixtures__/fx4'
import { createSheetsReader } from './index'
import * as xlsx from './xlsx/index'
import { XLSX_LIBRARY } from './xlsx/index'

const api = xlsx as unknown as { READER_RULES?: number }
function readerRules(): number {
  if (typeof api.READER_RULES !== 'number') throw new Error('src/modules/sheets/xlsx/index.ts does not export READER_RULES')
  return api.READER_RULES
}
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), '__golden__')

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-03T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, 'rules (Test).xlsx')
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}

/** A two-cell shared group: the master at C1 holding `formula`, one self-closed child at C2; both cache a number. */
const sharedPair = (formula: string): Map<string, string> =>
  new Map([
    ['C1', `><f t="shared" ref="C1:C2" si="0">${xmlText(formula)}</f><v>1</v></c>`],
    ['C2', `><f t="shared" si="0"/><v>2</v></c>`],
  ])

/** Masters whose slid child FX4 changes or must keep: the A07D Opus read inputs, the spec review's Unicode and 3D forms. */
const SHARED = [
  "Table1[Col'[1]+A1",
  'XYZ100*2',
  'A1048577+1',
  'ÜB1*2',
  'B1Ü*2',
  'ÉB1*2',
  '税B1*2',
  '\u{1D400}B1*2',
  'SUM(Q1:Q4!B1)',
  'SUM(Q1:Dec!B1)',
  'Q1!B1+A1',
  'TAXRATE1*A1',
]

/** The corpus: name and bytes. */
function corpus(): [string, Uint8Array][] {
  const out: [string, Uint8Array][] = SHARED.map((f) => [`shared ${f}`, gridXlsx(sharedPair(f))])
  const planted = (cells: Map<string, string>, row: number): Map<string, string> => {
    PLANTED.forEach((x, i) => cells.set(address(2 + i, row), numberBody(x)))
    return cells
  }
  out.push([
    'cycle joined through a finished node',
    sparseXlsx(
      planted(
        new Map([
          ['A1', formulaBody('SUM(A2:A3)', 0)],
          ['A2', formulaBody('SUM(A1:A1)', 0)],
          ['A3', formulaBody('SUM(A2:G2)', floatSum([0, ...PLANTED]))],
        ]),
        2,
      ),
    ),
  ])
  out.push([
    'cycle through A2 = A1*1, and a total beside it',
    sparseXlsx(
      planted(
        planted(
          new Map([
            ['A1', formulaBody('SUM(A2:G2)', floatSum([0, ...PLANTED]))],
            ['A2', formulaBody('A1*1', 0)],
            ['A4', formulaBody('SUM(B4:G4)', floatSum(PLANTED))],
          ]),
          2,
        ),
        4,
      ),
    ),
  ])
  return out
}

/** What the corpus reads: every cell's address, type, text and formula, by workbook and sheet. */
async function derived(): Promise<Record<string, Record<string, [string, string, string, string | null][]>>> {
  const view: Record<string, Record<string, [string, string, string, string | null][]>> = {}
  for (const [name, bytes] of corpus()) {
    const r = await readBytes(bytes)
    view[name] = Object.fromEntries(
      r.sheets.map((s) => [
        s.name,
        [...s.cells]
          .sort((a, b) => a.row - b.row || a.column.number - b.column.number)
          .map((c): [string, string, string, string | null] => [address(c.column.number, c.row), c.type, c.text, c.formula ?? null]),
      ]),
    )
  }
  return view
}

describe('FX4 ARC-10: the reader stamps its rules number beside the library version', () => {
  test('ARC-10 READER_RULES is a whole number from 1 and every .xlsx result is stamped exceljs 4.4.0+rules.<READER_RULES>, never the bare library version', async () => {
    const rules = readerRules()
    expect(Number.isInteger(rules) && rules >= 1, String(rules)).toBe(true)
    expect(XLSX_LIBRARY).toEqual({ name: 'exceljs', version: '4.4.0' })
    const [, bytes] = corpus()[0] as [string, Uint8Array]
    const r = await readBytes(bytes)
    expect(r.engine).toEqual({ name: 'exceljs', version: `4.4.0+rules.${String(rules)}` })
    expect(r.engine.version).not.toBe(XLSX_LIBRARY.version)
  })

  test('ARC-10 the derived text of a fixed corpus (slid shared formulas, cycle members, snapped totals) matches the golden of this rules number, so a change to derived text needs a new rules number', async () => {
    const file = path.join(GOLDEN, `reader-rules.${String(readerRules())}.json`)
    expect(fs.existsSync(file), `${path.relative(process.cwd(), file)} is missing: a new rules number needs its golden from a spec job`).toBe(true)
    await expect(`${JSON.stringify(await derived(), null, 2)}\n`).toMatchFileSnapshot(file)
  })

  test('ARC-10 the corpus covers the FX4 changes: each shared master gives its child, each cycle keeps its own text (the golden is checked against them)', async () => {
    const view = await derived()
    const child = (f: string): string | null | undefined => view[`shared ${f}`]?.['Shapes (Test)']?.find((c) => c[0] === 'C2')?.[3]
    expect(SHARED.map((f) => [f, child(f)])).toEqual([
      ["Table1[Col'[1]+A1", "Table1[Col'[1]+A2"],
      ['XYZ100*2', 'XYZ100*2'],
      ['A1048577+1', 'A1048577+1'],
      ['ÜB1*2', 'ÜB1*2'],
      ['B1Ü*2', 'B1Ü*2'],
      ['ÉB1*2', 'ÉB1*2'],
      ['税B1*2', '税B1*2'],
      ['\u{1D400}B1*2', '\u{1D400}B1*2'],
      ['SUM(Q1:Q4!B1)', 'SUM(Q1:Q4!B2)'],
      ['SUM(Q1:Dec!B1)', 'SUM(Q1:Dec!B2)'],
      ['Q1!B1+A1', 'Q1!B2+A2'],
      ['TAXRATE1*A1', 'TAXRATE1*A2'],
    ])
    const cell = (name: string, at: string): string | undefined => {
      const [column, row] = parseAddress(at)
      return view[name]?.['Cells (Test)']?.find((c) => c[0] === address(column, row))?.[2]
    }
    const noisy = String(floatSum(PLANTED))
    expect(['A1', 'A2', 'A3'].map((a) => cell('cycle joined through a finished node', a))).toEqual(['0', '0', noisy])
    expect(['A1', 'A2', 'A4'].map((a) => cell('cycle through A2 = A1*1, and a total beside it', a))).toEqual([noisy, '0', '253914.88'])
  })
})
