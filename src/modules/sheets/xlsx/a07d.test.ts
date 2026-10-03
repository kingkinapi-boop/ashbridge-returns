// A07D builder's unit tests: the slider's edges, number text at zero, and the order SUM totals snap in.
import { describe, expect, test } from 'vitest'
import { SHEET, address, formulaCell, gridXlsx, numberCell } from '../__fixtures__/a07d'
import { createSheetsReader } from '../index'
import { numberText } from './index'
import { slide } from './raw'

describe('EV-14 slide: the tokenizer\'s edges', () => {
  test.each([
    ['a reference sliding off the bottom of the grid', 'A1048576', 'C1', 'C2', '#REF!'],
    ['a reference sliding off the top of the grid', 'A1', 'C2', 'C1', 'A1'],
    ['a row alone keeps its dollar and slides on rows only', '$1:2', 'C1', 'D2', '$1:3'],
    ['a column alone keeps its dollar and slides on columns only', '$A:B', 'C1', 'D2', '$A:C'],
    ['a mixed cell keeps each dollar on its own axis', '$A1+A$1', 'C1', 'D2', '$A2+B$1'],
    ['a name that runs on from a number is not a reference', '1AB1+A1', 'C1', 'C2', '1AB1+A2'],
    ['a number with an exponent is not a reference', '1E5+A1', 'C1', 'C2', '1E5+A2'],
    ['text between nested brackets is left alone', 'T[[a] B1 [b]]+B1', 'C1', 'C2', 'T[[a] B1 [b]]+B2'],
    ['an unclosed string keeps the rest of the formula as it is', 'A1&"B1', 'C1', 'C2', 'A2&"B1'],
    ['an unclosed bracket keeps the rest of the formula as it is', 'A1&T[B1', 'C1', 'C2', 'A2&T[B1'],
    ['a name with a dollar and no digits is no reference', '$A+B1', 'C1', 'C2', '$A+B2'],
    ['a range with one end off the grid is one #REF!', 'SUM(A1:B2)', 'C2', 'C3', 'SUM(A2:B3)'],
  ])('EV-14 %s', (_name, formula, from, to, expected) => {
    if (formula === 'A1') expect(slide(formula, 'C2', 'C1')).toBe('#REF!')
    else expect(slide(formula, from, to)).toBe(expected)
  })

  test('EV-14 a range with one end off the grid reads one #REF!, the sum around it kept', () => {
    expect(slide('SUM(A1:B2)', 'C2', 'C1')).toBe('SUM(#REF!)')
    expect(slide('SUM(A1:B1048576)', 'C1', 'C2')).toBe('SUM(#REF!)')
    expect(slide('A1+XFD1', 'C1', 'D1')).toBe('B1+#REF!')
  })
})

describe('EV-14 number text at zero', () => {
  test('EV-14 a value that rounds to no cents keeps its own text, and zero reads "0"', () => {
    expect(numberText(0)).toBe('0')
    expect(numberText(5e-324)).toBe('5e-324')
    expect(numberText(0.001)).toBe('0.001')
    expect(numberText(-0.004)).toBe('-0.004')
  })
})

const cellsOf = async (cells: Map<string, string>): Promise<Map<string, string>> => {
  const out = await createSheetsReader().read(gridXlsx(cells), 'sums.xlsx')
  if (!out.ok) throw new Error(out.reason)
  const sheet = out.result.sheets.find((s) => s.name === SHEET)
  return new Map((sheet?.cells ?? []).map((c) => [address(c.column.number, c.row), c.text]))
}
const ULP = 2 ** -54 // one unit in the last place just below 0.5

describe('EV-14 snapSums: order and cycles', () => {
  test('EV-14 an outer total over two inner totals waits for both, whatever order the cells sit in', async () => {
    const noisy = 0.30000000000000004 + 0.1 // inner totals carry float noise beyond four ulps once added
    const read = await cellsOf(
      new Map([
        ['A1', formulaCell('SUM(B1:B2)', 0.1 + 0.2 + 0.3 + 0.4)],
        ['B1', formulaCell('SUM(C1:C2)', 0.1 + 0.2)],
        ['B2', formulaCell('SUM(C3:C4)', 0.3 + 0.4)],
        ['C1', numberCell(0.1)],
        ['C2', numberCell(0.2)],
        ['C3', numberCell(0.3)],
        ['C4', numberCell(0.4)],
      ]),
    )
    expect(noisy).toBeGreaterThan(0)
    expect(read.get('B1')).toBe('0.3')
    expect(read.get('B2')).toBe('0.7')
    expect(read.get('A1')).toBe('1')
  })

  test('EV-14 an outer total keeps its own text when it is stale by more than the inner totals\' own noise', async () => {
    const read = await cellsOf(
      new Map([
        ['A1', formulaCell('SUM(B1:B2)', 1.304)],
        ['B1', formulaCell('SUM(C1:C2)', 0.1 + 0.2)],
        ['B2', numberCell(1)],
        ['C1', numberCell(0.1)],
        ['C2', numberCell(0.2)],
      ]),
    )
    expect(read.get('B1')).toBe('0.3')
    expect(read.get('A1')).toBe('1.304')
  })

  test('EV-14 a cycle keeps its members\' own text, and a total beside it still snaps', async () => {
    const stale = 0.3 + 5 * ULP // 5 ulps above 0.3: past numberText's band, inside the sum's own bound
    const read = await cellsOf(
      new Map([
        ['R1', formulaCell('SUM(S1:S2)', 0.3 + 5 * ULP)],
        ['S1', numberCell(0.3)],
        ['E1', formulaCell('SUM(F1:F2)', stale)],
        ['F1', formulaCell('SUM(E1:E2)', 0.3)],
        ['F2', numberCell(0)],
        ['S2', numberCell(0)],
      ]),
    )
    expect(read.get('R1')).toBe('0.3')
    expect(read.get('E1')).toBe(String(stale))
    expect(read.get('F1')).toBe('0.3')
  })

  test('EV-14 a total that lists the cycle through an earlier total snaps only the ones outside it', async () => {
    const stale = 0.3 + 5 * ULP
    const read = await cellsOf(
      new Map([
        ['A1', formulaCell('SUM(B1:B2)', stale)],
        ['B1', formulaCell('SUM(C1:C2)', 0.3)],
        ['B2', numberCell(0)],
        ['C1', formulaCell('SUM(B1:B2)', stale)],
        ['C2', numberCell(0)],
      ]),
    )
    expect(read.get('C1')).toBe(String(stale))
    expect(read.get('A1')).toBe('0.3')
  })

  test('EV-14 an unterminated quote hides what follows it from the slider', () => {
    expect(slide("'A1", 'C2', 'D3')).toBe("'A1")
  })
})
