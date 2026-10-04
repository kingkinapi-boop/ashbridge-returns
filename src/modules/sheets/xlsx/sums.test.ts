// A07C unit tests: a SUM cached as a floating-point total reads as the exact cent total (EV-14).
import { describe, expect, test } from 'vitest'
import type { Cell } from '../../../contracts/sheets'
import { shapesXlsx, SHEET } from '../__fixtures__/a07c'
import { readXlsx } from './index'

const read = async (rows: string[]): Promise<Cell[]> => {
  const out = await readXlsx(shapesXlsx({ rows }))
  if (!out.ok) throw new Error(out.reason)
  return out.sheets[0]?.cells ?? []
}
const at = (cells: Cell[], row: number, letter: string): Cell | undefined => cells.find((c) => c.row === row && c.column.letter === letter)

describe('EV-14 a SUM cached as a floating-point total reads as the exact cent total', () => {
  const run = async (rows: string[], cached: string, formula: string): Promise<Cell | undefined> => {
    const cells = await read(rows.map((r) => r.replace('CACHED', cached)))
    return cells.find((c) => c.type === 'formula' && c.formula === formula)
  }
  const col = (values: string[], letter = 'A', from = 1): string[] => values.map((v, i) => `<c r="${letter}${String(from + i)}"><v>${v}</v></c>`)
  const total = (formula: string, address: string): string => `<c r="${address}"><f>${formula}</f><v>CACHED</v></c>`
  /** Eight terms near a billion whose exact total is 8000000000.12; noise of 5e-6 is past the number rule's own band and inside the sum's. */
  const EIGHT = ['1000000000.01', '1000000000.01', '1000000000.01', '1000000000.01', '1000000000.02', '1000000000.02', '1000000000.02', '1000000000.02']
  const NOISY = '8000000000.120005'
  const sumRows = (formula: string, terms = EIGHT): string[] => [...col(terms), total(formula, `A${String(terms.length + 1)}`)]

  test('EV-14 a cached total with noise beyond the number rule snaps to the cent total; a stale total never does', async () => {
    const rows = sumRows('SUM(A1:A8)')
    const snapped = await run(rows, NOISY, 'SUM(A1:A8)')
    expect(snapped?.cached).toEqual({ type: 'number', text: '8000000000.12' })
    expect(snapped?.text).toBe('8000000000.12')
    expect((await run(rows, '8000000000.13', 'SUM(A1:A8)'))?.cached).toEqual({ type: 'number', text: '8000000000.13' })
    expect((await run(rows, '8000000000.1201', 'SUM(A1:A8)'))?.cached).toEqual({ type: 'number', text: '8000000000.1201' })
    expect((await run(rows, '8000000000.11', 'SUM(A1:A8)'))?.cached).toEqual({ type: 'number', text: '8000000000.11' })
  })

  test('EV-14 the allowed noise is the sum bound: nine steps of a double at this size (8.6e-6) snap, thirty do not', async () => {
    const step = 2 ** -20 // one step of a double between 4.3e9 and 8.6e9
    const rows = sumRows('SUM(A1:A8)')
    const exact = Number('8000000000.12')
    expect((await run(rows, String(exact + 9 * step), 'SUM(A1:A8)'))?.cached).toEqual({ type: 'number', text: '8000000000.12' })
    expect((await run(rows, String(exact + 30 * step), 'SUM(A1:A8)'))?.cached?.text).toBe(String(exact + 30 * step))
  })

  test('EV-14 the formula is read as written: other formulas, other text around SUM and non-ranges are never snapped', async () => {
    for (const formula of ['SUM(A1:A8)+0', 'XSUM(A1:A8)', 'AVERAGE(A1:A8)', 'SUM(A1)', 'SUM(A1:A8,A1)', 'SUM(1A:A8)']) {
      expect((await run(sumRows(formula), NOISY, formula))?.cached, formula).toEqual({ type: 'number', text: NOISY })
    }
  })

  test('EV-14 absolute references, two-digit rows and two-letter columns are ranges too', async () => {
    const rows = Array.from({ length: 9 }, () => '')
    const block = EIGHT.slice(0, 4).map((v, i) => `<c r="AA${String(10 + i)}"><v>${v}</v></c><c r="AB${String(10 + i)}"><v>${EIGHT[4 + i] as string}</v></c>`)
    rows.push(...block, total('SUM($AA$10:$AB$13)', 'AC14'))
    expect((await run(rows, NOISY, 'SUM($AA$10:$AB$13)'))?.cached).toEqual({ type: 'number', text: '8000000000.12' })
    // A range one column short or one column wide does not add up to the cache.
    const short = rows.slice(0, 13).concat(total('SUM(AA10:AA13)', 'AC14'))
    expect((await run(short, NOISY, 'SUM(AA10:AA13)'))?.cached).toEqual({ type: 'number', text: NOISY })
    const wide = rows.slice(0, 13).concat(total('SUM(AA10:AC13)', 'AC14'))
    expect((await run(wide, NOISY, 'SUM(AA10:AC13)'))?.cached).toEqual({ type: 'number', text: '8000000000.12' })
  })

  test('EV-14 blank cells, text cells and formula terms inside the range: only numbers add up, a formula term adds its cached number', async () => {
    const rows = [
      '<c r="A1"><v>1000000000.01</v></c>',
      '<c r="A2" t="inlineStr"><is><t>note</t></is></c>',
      '',
      '<c r="A4"><f>A1+0</f><v>1000000000.01</v></c>',
      '<c r="A5" t="str"><f>"x"</f><v>x</v></c>',
      '<c r="A6" t="b"><v>1</v></c>',
      ...col(['1000000000.01', '1000000000.02', '1000000000.02', '1000000000.02', '1000000000.02', '1000000000.01'], 'A', 7),
      total('SUM(A1:A12)', 'A13'),
    ]
    expect((await run(rows, '8000000000.120005', 'SUM(A1:A12)'))?.cached).toEqual({ type: 'number', text: '8000000000.12' })
  })

  test('EV-14 a range holding an error, or a term that is not a cent amount, is never snapped', async () => {
    const withError = [...col(EIGHT.slice(0, 7)), '<c r="A8" t="e"><v>#N/A</v></c>', total('SUM(A1:A8)', 'A9')]
    // Without the error cell this cache is the seven terms' sum plus noise and would snap to 7000000000.1.
    expect((await run(withError, '7000000000.100005', 'SUM(A1:A8)'))?.cached).toEqual({ type: 'number', text: '7000000000.100005' })
    const clean = [...col(EIGHT.slice(0, 7)), total('SUM(A1:A7)', 'A8')]
    expect((await run(clean, '7000000000.100005', 'SUM(A1:A7)'))?.cached).toEqual({ type: 'number', text: '7000000000.1' })
    // A three-decimal term "1000000000.005" and zeros: not a cent amount, so the cache (1e9 plus noise) is kept.
    const rows = sumRows('SUM(A1:A9)', ['1000000000.005', '0', '0', '0', '0', '0', '0', '0', '0'])
    expect((await run(rows, '1000000000.000001', 'SUM(A1:A9)'))?.cached).toEqual({ type: 'number', text: '1000000000.000001' })
    // Exponent text is no cent amount either.
    // Read as a cent amount from its tail (-7), the term would pull the total to 999999993.01, which this cache matches.
    const tiny = sumRows('SUM(A1:A9)', ['1E-7', '0', '0', '0', '0', '0', '0', '0', '1000000000.01'])
    expect((await run(tiny, '999999993.010005', 'SUM(A1:A9)'))?.cached).toEqual({ type: 'number', text: '999999993.010005' })
  })

  test('EV-14 a total that is not a number is not snapped, and a sum over no terms stays 0', async () => {
    const text = [...col(['1000000000.01']), '<c r="A2" t="str"><f>SUM(A1:A1)</f><v>1000000000.01</v></c>']
    expect(at(await read(text), 2, 'A')).toMatchObject({ type: 'formula', cached: { type: 'text', text: '1000000000.01' } })
    expect((await run([total('SUM(B1:B3)', 'A1')], '0', 'SUM(B1:B3)'))?.cached).toEqual({ type: 'number', text: '0' })
  })

  test('EV-14 a sum whose own rounding bound exceeds half a cent still never moves a total by a cent', async () => {
    const rows = sumRows('SUM(A1:A50)', Array.from({ length: 50 }, () => '1000000000000'))
    expect((await run(rows, '50000000000000', 'SUM(A1:A50)'))?.cached).toEqual({ type: 'number', text: '50000000000000' })
    // 5e13 + 0.0078 (one step of a double there) is not the total and is past half a cent of it: the cache keeps its own text.
    expect((await run(rows, '50000000000000.0078', 'SUM(A1:A50)'))?.cached?.text).not.toBe('50000000000000')
  })

  test('EV-14 the sum rule reads the sheet it is on and keeps its name', async () => {
    const out = await readXlsx(shapesXlsx({ rows: sumRows('SUM(A1:A8)').map((r) => r.replace('CACHED', NOISY)) }))
    if (!out.ok) throw new Error(out.reason)
    expect(out.sheets[0]?.name).toBe(SHEET)
    expect(at(out.sheets[0]?.cells ?? [], 9, 'A')?.cached).toEqual({ type: 'number', text: '8000000000.12' })
  })
})
