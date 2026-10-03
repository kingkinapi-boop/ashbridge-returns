// FX4 acceptance tests, A07D Opus read items 4 and 5 (reports/A07D-opus-read.md; card plan/cards/FX4.md): a shared
// formula's text slid from its master to a child keeps structured-reference escapes, names that only look like
// references, and unquoted 3D sheet ranges. SC4's R67 tokenizer rule (tools/test/reading-rules.test.mjs) runs the same
// inputs on every registered rewriter; these pin them on the reader and by class.
//
// Spec choices (amber, see reports/FX4-spec.md):
//   F5. A token that reads as a cell reference but lies off the grid as written (a column past XFD or a row past 1048576),
//       or whose column runs past three letters (`ABCD1`, `TAXRATE1`), is a name and never changes; A07D's S1 still holds
//       for a reference on the grid that a slide moves off it (#REF!).
//   F6. A name may start with any Unicode letter, "_" or "\", and hold any Unicode letter, combining mark or number after
//       it (astral code points included). A cell-shaped run followed by any of those, or by "_" or ".", is part of a name.
//       Names that start with a combining mark or a digit are not drawn (Excel refuses them; their text is not settled).
//   F7. Inside a structured reference "'" escapes the next character ("[", "]", "#", "'"), as Excel writes `Col'[1]`.
//   F8. A token followed by ":" and then a sheet-qualified part (`Q1:Q4!B1`, `Q1:Dec!B1`) is the first sheet of an
//       unquoted 3D range: the sheet names stay, the reference after "!" slides (a cell or an area, `$` parts kept).
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import type { Cell, SheetResult } from '../../contracts/sheets'
import { SHEET, address, gridXlsx, letters, parseAddress, xmlText } from './__fixtures__/a07d'
import { createSheetsReader } from './index'
import { slide } from './xlsx/raw'

let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-03T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

async function readBytes(bytes: Uint8Array): Promise<SheetResult> {
  const out = await createSheetsReader().read(bytes, 'shared (Test).xlsx')
  if (!out.ok) throw new Error(`refused: ${out.reason}`)
  return out.result
}
const cellAt = (r: SheetResult, at: string): Cell | undefined => {
  const [column, row] = parseAddress(at)
  return r.sheets.find((s) => s.name === SHEET)?.cells.find((c) => c.row === row && c.column.number === column)
}
/** A two-cell shared group: the master at `from` holding `formula`, one self-closed child at `to`; both cache a number. */
function sharedPair(formula: string, from: string, to: string): Map<string, string> {
  const [fc0, fr0] = parseAddress(from)
  const [tc0, tr0] = parseAddress(to)
  const ref = `${address(Math.min(fc0, tc0), Math.min(fr0, tr0))}:${address(Math.max(fc0, tc0), Math.max(fr0, tr0))}`
  return new Map([
    [from, `><f t="shared" ref="${ref}" si="0">${xmlText(formula)}</f><v>1</v></c>`],
    [to, `><f t="shared" si="0"/><v>2</v></c>`],
  ])
}

/** [item, master text, the child's text one row down (C1 to C2)]: the failing inputs of the Opus read. */
const OPUS: [string, string, string][] = [
  ['4', "Table1[Col'[1]+A1", "Table1[Col'[1]+A2"],
  ['5a', 'XYZ100*2', 'XYZ100*2'],
  ['5a', 'A1048577+1', 'A1048577+1'],
  ['5b', 'ÜB1*2', 'ÜB1*2'],
  ['5c', 'SUM(Q1:Q4!B1)', 'SUM(Q1:Q4!B2)'],
  // The spec review's forms (reports/FX4-spec-review.md gaps 1 and 2): a letter after the cell, a combining mark, CJK, astral.
  ['5b', 'B1Ü*2', 'B1Ü*2'],
  ['5b', 'ÉB1*2', 'ÉB1*2'],
  ['5b', '税B1*2', '税B1*2'],
  ['5b', '\u{1D400}B1*2', '\u{1D400}B1*2'],
  ['5c', 'SUM(Q1:Dec!B1)', 'SUM(Q1:Dec!B2)'],
  ['5c', 'Q1!B1+A1', 'Q1!B2+A2'],
]

describe('FX4 items 4 and 5: the Opus read inputs slide right (EV-14, EV-5)', () => {
  test('EV-14 each Opus read input, as a shared formula master at C1 with a child at C2, gives the child the right text and keeps the master', async () => {
    const wrong: string[] = []
    for (const [item, master, child] of OPUS) {
      const r = await readBytes(gridXlsx(sharedPair(master, 'C1', 'C2')))
      expect(cellAt(r, 'C1'), `item ${item}: ${master}`).toMatchObject({ type: 'formula', formula: master, cached: { type: 'number', text: '1' } })
      expect(cellAt(r, 'C2'), `item ${item}: ${master}`).toMatchObject({ type: 'formula', cached: { type: 'number', text: '2' } })
      if (cellAt(r, 'C2')?.formula !== child) wrong.push(`item ${item}: ${master} read ${String(cellAt(r, 'C2')?.formula)}, expected ${child}`)
    }
    expect(wrong).toEqual([])
  })

  test('EV-14 each Opus read input slid by (0, 0) is unchanged (5a: the bounds check never turns a name into #REF!)', () => {
    for (const [item, master] of OPUS) expect(slide(master, 'C3', 'C3'), `item ${item}`).toBe(master)
  })

  test('EV-14 a reference on the grid that a slide moves off it still reads #REF! (A07D S1 kept beside 5a)', () => {
    expect(slide('XFD1+XYZ1', 'A1', 'B1')).toBe('#REF!+XYZ1')
    expect(slide('A1048576*2+A1048577', 'C1', 'C2')).toBe('#REF!*2+A1048577')
  })
})

// ---------------------------------------------------------------------------------------------------- by class

/** An on-grid cell in a small corner, and a move that keeps it there. */
const cell = fc.tuple(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 300 }))
const move = fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }))
const at = ([c, r]: [number, number]): string => `${letters(c)}${String(r)}`
/** Slides `formula + "+" + cell` from C3 by (dc, dr) and expects `kept + "+" + the moved cell`. */
function slidesOnlyTheCell(kept: string, [c, r]: [number, number], [dc, dr]: [number, number]): void {
  const from = 'C3'
  const to = `${letters(3 + dc)}${String(3 + dr)}`
  const formula = `${kept}+${at([c, r])}`
  expect(slide(formula, from, to), formula).toBe(`${kept}+${at([c + dc, r + dr])}`)
  expect(slide(formula, from, from), formula).toBe(formula)
}

describe('FX4 items 4 and 5 by class: escapes, names and 3D ranges never slide (EV-14)', () => {
  test("EV-14 property (seed 20261034): a structured reference whose column name holds '-escaped brackets, hashes or quotes stays whole, and the reference after it slides", () => {
    const piece = fc.constantFrom("'[", "']", "'#", "''", "'@", 'A1', 'Col', ' ', '1', 'B$2')
    const column = fc.array(piece, { minLength: 1, maxLength: 5 }).map((p) => p.join(''))
    fc.assert(
      fc.property(column, cell, move, (name, c, m) => {
        slidesOnlyTheCell(`Table1[${name}]`, c, m)
        slidesOnlyTheCell(`Sales[[#This Row],[${name}]]`, c, m)
      }),
      { seed: 20261034, numRuns: 300 },
    )
  })

  test('EV-14 property (seed 20261035): a token shaped like a reference but off the grid as written (column past XFD, row past 1048576, a column of 4 to 7 letters) or running on into a name (TAX2026A, A1_B, A1.B2) is a name and never changes', () => {
    const pastColumn = fc.tuple(fc.integer({ min: 16_385, max: 18_278 }), fc.integer({ min: 1, max: 1_048_576 })).map(([c, r]) => `${letters(c)}${String(r)}`)
    const pastRow = fc.tuple(fc.integer({ min: 1, max: 16_384 }), fc.integer({ min: 1_048_577, max: 9_999_999 })).map(([c, r]) => `${letters(c)}${String(r)}`)
    const upper = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
    const longColumn = fc.tuple(fc.array(upper, { minLength: 4, maxLength: 7 }), fc.integer({ min: 1, max: 1_048_576 })).map(([l, r]) => `${l.join('')}${String(r)}`)
    const onGrid = fc.tuple(fc.integer({ min: 1, max: 16_384 }), fc.integer({ min: 1, max: 1_048_576 })).map(([c, r]) => `${letters(c)}${String(r)}`)
    const runOn = fc.tuple(onGrid, fc.constantFrom('A', '_B', '.B2', '_', '.x', 'Q1', '_2026')).map(([c, tail]) => `${c}${tail}`)
    const named = fc.constantFrom('ABCD1', 'TAXRATE1', 'TAX2026A', 'A1_B', 'A1.B2')
    fc.assert(
      fc.property(fc.oneof(pastColumn, pastRow, longColumn, runOn, named), cell, move, (name, c, m) => {
        slidesOnlyTheCell(`${name}*2`, c, m)
      }),
      { seed: 20261035, numRuns: 400 },
    )
  })

  test('EV-14 property (seed 20261036): a name with a non-ASCII letter anywhere in it never changes, however much of it looks like a reference', () => {
    const accented = fc.constantFrom('Ü', 'É', 'é', 'Ñ', 'Ø', 'å', 'Ж', 'Ω', 'ß')
    const name = fc
      .tuple(fc.constantFrom('', 'A', 'TAX', 'B'), accented, fc.constantFrom('', 'B', 'AB', 'Q'), fc.integer({ min: 1, max: 999 }))
      .map(([head, mark, tail, n]) => `${head}${mark}${tail}${String(n)}`)
    fc.assert(
      fc.property(name, cell, move, (n, c, m) => {
        slidesOnlyTheCell(`${n}*2`, c, m)
      }),
      { seed: 20261036, numRuns: 300 },
    )
  })

  test('EV-14 property (seed 20261038): a name holding non-ASCII letters, combining marks or numbers (astral ones too) before, inside or after a cell-shaped run never changes', () => {
    const letter = fc.constantFrom('Ü', 'É', 'ß', 'Ж', 'Ω', '税', 'Ｂ', '\u{1D400}', '\u{20000}', 'ñ')
    const mark = fc.constantFrom('́', '̈')
    const number = fc.constantFrom('٣', '²', 'Ⅻ', '３', '\u{1D7CE}')
    const any = fc.oneof(letter, mark, number)
    const column = fc.integer({ min: 1, max: 16_384 }).map(letters)
    const row = fc.integer({ min: 1, max: 1_048_576 }).map(String)
    const core = fc.tuple(column, row).map(([c, r]) => `${c}${r}`)
    const name = fc.oneof(
      fc.tuple(core, any).map(([c, u]) => `${c}${u}`),
      fc.tuple(fc.constantFrom('A', 'E', 'B', 'TAX'), mark, core).map(([l, k, c]) => `${l}${k}${c}`),
      fc.tuple(letter, core).map(([u, c]) => `${u}${c}`),
      fc.tuple(letter, core, any).map(([u, c, v]) => `${u}${c}${v}`),
      fc.tuple(column, any, row).map(([c, u, r]) => `${c}${u}${r}`),
    )
    fc.assert(
      fc.property(name, cell, move, (n, c, m) => {
        slidesOnlyTheCell(`${n}*2`, c, m)
      }),
      { seed: 20261038, numRuns: 500 },
    )
  })

  test('EV-14 property (seed 20261037): an unquoted sheet or 3D range of sheets (names shaped like cells, words, off-grid tokens, four-letter columns) keeps its names; only the reference after "!" slides, cell or area, $ parts kept', () => {
    const sheetName = fc.oneof(cell.map(at), fc.constantFrom('Dec', 'Jan2', 'Sheet', 'Q4FY'), fc.constantFrom('XYZ100', 'XFE1', 'A1048577'), fc.constantFrom('ABCD1', 'TAXRATE1'))
    const end = fc.tuple(cell, fc.boolean(), fc.boolean())
    type End = [[number, number], boolean, boolean]
    const render = ([[c, r], ca, ra]: End, [dc, dr]: [number, number]): string => `${ca ? '$' : ''}${letters(ca ? c : c + dc)}${ra ? '$' : ''}${String(ra ? r : r + dr)}`
    fc.assert(
      fc.property(sheetName, fc.option(sheetName, { nil: undefined }), end, fc.option(end, { nil: undefined }), move, (s1, s2, e1, e2, d) => {
        const sheets = s2 === undefined ? s1 : `${s1}:${s2}`
        const part = (by: [number, number]): string => (e2 === undefined ? render(e1, by) : `${render(e1, by)}:${render(e2, by)}`)
        const formula = `SUM(${sheets}!${part([0, 0])})`
        const to = `${letters(3 + d[0])}${String(3 + d[1])}`
        expect(slide(formula, 'C3', to), formula).toBe(`SUM(${sheets}!${part(d)})`)
        expect(slide(formula, 'C3', 'C3'), formula).toBe(formula)
      }),
      { seed: 20261037, numRuns: 400 },
    )
  })
})
