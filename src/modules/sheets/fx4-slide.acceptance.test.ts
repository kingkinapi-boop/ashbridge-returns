// FX4 acceptance tests, A07D Opus read items 4 and 5 (reports/A07D-opus-read.md; card plan/cards/FX4.md): a shared
// formula's text slid from its master to a child keeps structured-reference escapes, names that only look like
// references, and unquoted 3D sheet ranges. SC4's R67 tokenizer rule (tools/test/reading-rules.test.mjs) runs the same
// inputs on every registered rewriter; these pin them on the reader and by class.
//
// Spec choices (amber, see reports/FX4-spec.md):
//   F5. A token that reads as a cell reference but lies off the grid as written (a column past XFD or a row past 1048576)
//       is a name and never changes; A07D's S1 still holds for a reference on the grid that a slide moves off it (#REF!).
//   F6. A name may hold any Unicode letter or digit after its first character, and start with any Unicode letter, "_" or "\".
//   F7. Inside a structured reference "'" escapes the next character ("[", "]", "#", "'"), as Excel writes `Col'[1]`.
//   F8. A cell-shaped token followed by ":" and then a sheet-qualified part (`Q1:Q4!B1`) is the first sheet of an unquoted
//       3D range: the sheet names stay, the cell after "!" slides.
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

  test('EV-14 property (seed 20261035): a token shaped like a reference but off the grid as written (column past XFD or row past 1048576) is a name and never changes', () => {
    const pastColumn = fc.tuple(fc.integer({ min: 16_385, max: 18_278 }), fc.integer({ min: 1, max: 1_048_576 })).map(([c, r]) => `${letters(c)}${String(r)}`)
    const pastRow = fc.tuple(fc.integer({ min: 1, max: 16_384 }), fc.integer({ min: 1_048_577, max: 9_999_999 })).map(([c, r]) => `${letters(c)}${String(r)}`)
    fc.assert(
      fc.property(fc.oneof(pastColumn, pastRow), cell, move, (name, c, m) => {
        slidesOnlyTheCell(`${name}*2`, c, m)
      }),
      { seed: 20261035, numRuns: 300 },
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

  test('EV-14 property (seed 20261037): an unquoted 3D range of sheets whose names look like cells keeps both names; only the cell after "!" slides', () => {
    const sheetName = cell.map(at)
    fc.assert(
      fc.property(sheetName, sheetName, cell, move, (s1, s2, [c, r], [dc, dr]) => {
        const formula = `SUM(${s1}:${s2}!${at([c, r])})`
        const to = `${letters(3 + dc)}${String(3 + dr)}`
        expect(slide(formula, 'C3', to), formula).toBe(`SUM(${s1}:${s2}!${at([c + dc, r + dr])})`)
      }),
      { seed: 20261037, numRuns: 300 },
    )
  })
})
