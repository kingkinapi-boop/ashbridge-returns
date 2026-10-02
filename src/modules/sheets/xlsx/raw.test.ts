// A07C round 2 unit tests: a shared formula slides to its child's address, and the sheet XML reader's own rules.
import { describe, expect, test } from 'vitest'
import { cellsOf, slide } from './raw'

describe('EV-14 slide: a shared formula moved from its master to a child', () => {
  test.each([
    ['one row down', 'C1*2', 'B1', 'B2', 'C2*2'],
    ['two columns right', 'C1*2', 'B1', 'D1', 'E1*2'],
    ['rows and columns together', 'C1*2', 'B1', 'D4', 'E4*2'],
    ['absolute column and row stay', '$C$1+C$1+$C1', 'B1', 'C2', '$C$1+D$1+$C2'],
    ['a range slides both ends', 'SUM(A1:B2)', 'A1', 'A3', 'SUM(A3:B4)'],
    ['a sheet-qualified reference slides', 'Sheet1!A1+B1', 'A1', 'A2', 'Sheet1!A2+B2'],
    ['a function name with digits is not a reference', 'LOG10(A1)', 'A1', 'A2', 'LOG10(A2)'],
    ['a name longer than three letters is not a reference', 'ABCD1+A1', 'A1', 'A2', 'ABCD1+A2'],
    ['a name with a trailing letter or underscore is not a reference', 'A1B+A1_x+A1', 'A1', 'A2', 'A1B+A1_x+A2'],
    ['a name after an underscore, a letter, a digit or a point is not a reference', '_A1+xA1+1A1+x.A1+A1', 'A1', 'A2', '_A1+xA1+1A1+x.A1+A2'],
    ['a string literal is left alone', '"A1"&A1', 'A1', 'A2', '"A1"&A2'],
    ['a doubled quote does not end the string', '"a""A1"&A1&"B2"', 'A1', 'A2', '"a""A1"&A2&"B2"'],
    ['a letter column rolls over Z to AA', 'Z1', 'A1', 'B1', 'AA1'],
    ['a letter column rolls back from AA to Z', 'AA1', 'B1', 'A1', 'Z1'],
    ['a three-letter column slides', 'AAA10', 'A1', 'B2', 'AAB11'],
    ['the first row is reachable', 'A2', 'B3', 'B2', 'A1'],
    ['the first column is reachable', 'B1', 'C1', 'B1', 'A1'],
    ['a reference sliding above row 1 stays as written', 'A1+B5', 'B5', 'B1', 'A1+B1'],
    ['a reference sliding left of column A stays as written', 'B1+D1', 'C1', 'A1', 'B1+B1'],
    ['a master and a child with two-letter columns and two-digit rows', 'C1', 'AA10', 'AB12', 'D3'],
    ['a master with a one-letter column and a child with two letters', 'A1', 'A1', 'AB12', 'AB12'],
    ['no change when the child is at the master', 'C1*2', 'B1', 'B1', 'C1*2'],
  ])('EV-14 %s', (_name, formula, from, to, expected) => {
    expect(slide(formula, from, to)).toBe(expected)
  })

  test('EV-14 an address that is not a cell address leaves the formula as it is', () => {
    expect(slide('A1', 'x', 'B2')).toBe('A1')
    expect(slide('A1', 'A1', 'y')).toBe('A1')
    expect(slide('A1', '1A', 'B2')).toBe('A1')
    expect(slide('A1', 'A1', '2B')).toBe('A1')
    expect(slide('A1', 'A1', 'B2 ')).toBe('A1')
    expect(slide('A1', ' A1', 'B2')).toBe('A1')
    expect(slide('A1', 'A1x', 'B2')).toBe('A1')
    expect(slide('A1', 'xA1', 'B2')).toBe('A1')
    expect(slide('A1', 'A1', 'B2x')).toBe('A1')
    expect(slide('A1', 'A1', 'xB2')).toBe('A1')
  })
})

describe('EV-14 cellsOf: what the sheet XML stores for each cell', () => {
  const read = (cells: string) => cellsOf(`<sheetData><row r="1">${cells}</row></sheetData>`)

  test('EV-14 a plain cell keeps its type letter, value and formula', () => {
    const c = read('<c r="A1" t="str"><f>B1&amp;"x"</f><v>hi &amp; bye</v></c>')
    expect(c.get('A1')).toEqual({
      type: 'str',
      value: 'hi & bye',
      formula: 'B1&"x"',
    })
  })

  test('EV-14 an empty stored value is no value, as a missing one is', () => {
    const c = read('<c r="A1"><f>B1</f><v></v></c><c r="A2"><f>B1</f><v/></c><c r="A3"><f>B1</f></c><c r="A4"><v>0</v></c>')
    expect(c.get('A1')?.value).toBeUndefined()
    expect(c.get('A2')?.value).toBeUndefined()
    expect(c.get('A3')?.value).toBeUndefined()
    expect(c.get('A4')?.value).toBe('0')
  })

  test('EV-14 a cell with no address is skipped and a self-closed cell holds nothing', () => {
    const c = read('<c><v>1</v></c><c r="A1"/>')
    expect([...c.keys()]).toEqual(['A1'])
    expect(c.get('A1')).toEqual({
      type: undefined,
      value: undefined,
      formula: undefined,
    })
  })

  test('EV-14 a self-closed shared child takes its master formula slid to its own address, whichever way it is written', () => {
    const c = read(
      '<c r="A1"><f t="shared" ref="A1:A3" si="0">C1*2</f><v>2</v></c><c r="A2"><f t="shared" si="0"/><v>4</v></c><c r="A3"><f t="shared" si="0" /><v>6</v></c>',
    )
    expect(c.get('A1')?.formula).toBe('C1*2')
    expect(c.get('A2')).toEqual({
      type: undefined,
      value: '4',
      formula: 'C2*2',
    })
    expect(c.get('A3')).toEqual({
      type: undefined,
      value: '6',
      formula: 'C3*2',
    })
  })

  test('EV-14 two shared groups each give their own formula, whichever order their children come in', () => {
    const c = read(
      '<c r="A1"><f t="shared" ref="A1:A2" si="0">C1</f></c><c r="B1"><f t="shared" ref="B1:B2" si="1">D1+1</f></c><c r="B2"><f t="shared" si="1"/></c><c r="A2"><f t="shared" si="0"/></c>',
    )
    expect(c.get('A2')?.formula).toBe('C2')
    expect(c.get('B2')?.formula).toBe('D2+1')
  })

  test('EV-14 a shared child whose master is not in the sheet has no formula', () => {
    expect(read('<c r="A2"><f t="shared" si="9"/><v>1</v></c>').get('A2')?.formula).toBeUndefined()
  })

  test('EV-14 a self-closed formula that is not shared has no formula, and an array formula is not a shared master', () => {
    const c = read('<c r="A1"><f t="array" ref="A1:A2"/><v>1</v></c><c r="B1"><f t="array" ref="B1:B2">SUM(C1)</f></c><c r="B2"><f t="shared"/></c>')
    expect(c.get('A1')?.formula).toBeUndefined()
    expect(c.get('B1')?.formula).toBe('SUM(C1)')
    expect(c.get('B2')?.formula).toBeUndefined()
  })

  test('EV-14 a shared child with a text formula of its own keeps it', () => {
    const c = read('<c r="A1"><f t="shared" ref="A1:A2" si="0">C1</f></c><c r="A2"><f t="shared" si="0">E7</f></c>')
    expect(c.get('A2')?.formula).toBe('E7')
  })

  test('EV-14 an element whose name only starts with f is not a formula', () => {
    expect(read('<c r="A1"><fx>B1</fx><v>1</v></c>').get('A1')?.formula).toBeUndefined()
  })
})
