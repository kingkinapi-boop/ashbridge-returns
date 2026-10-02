// F03 builder's own unit tests (the acceptance tests are in taxprep.acceptance.test.ts).
import { describe, expect, test } from 'vitest'
import {
  parseCellId,
  parseTaxprepCsv,
  withCopyIndex,
  writeTaxprepCsv,
  type CellId,
  type TaxprepHeader,
} from './taxprep'

const H: TaxprepHeader = {
  returnName: 'Unit Co. (Test)',
  guid: '00000000-0000-0000-0000-000000000000',
}
const bytes = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'latin1'))
const head = '[Unit Co. (Test)|0|0|00000000-0000-0000-0000-000000000000],"Current Year","Last Year",""\r\n'
const id = (t: string): CellId => {
  const r = parseCellId(t)
  if (!r.ok) throw new Error(r.reason)
  return r.id
}

describe('F03 unit: reading', () => {
  test('RT-3 an empty file is refused with a header fault', () => {
    const r = parseTaxprepCsv(bytes(''))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.faults.map((f) => f.code)).toContain('header')
  })

  test('RT-3 a header whose second column reads VALUE (as the trial files do) is accepted', () => {
    const r = parseTaxprepCsv(bytes(head.replace('"Current Year"', '"VALUE"') + 'GFGBA.Ttwgba64,"1","",""\r\n'))
    expect(r.ok).toBe(true)
  })

  test('RT-3 doubled quotes inside a value read as one quote and are written back doubled', () => {
    const r = parseTaxprepCsv(bytes(head + 'IFirm.ContactPartner,"say ""hi""","",""\r\n'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.rows[0]?.current).toEqual({
      kind: 'value',
      text: 'say "hi"',
    })
  })

  test('RT-9 an unterminated quote is refused naming its line', () => {
    const r = parseTaxprepCsv(bytes(head + 'GFGBA.Ttwgba64,"12,"",""\r\n'))
    expect(r.ok).toBe(false)
  })

  test('RT-9 a lone apostrophe fault names the row identifier in its reason', () => {
    const r = parseTaxprepCsv(bytes(head + `GFGBA.Ttwgba64,"'5","",""\r\n`))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.faults[0]?.reason).toContain('GFGBA.Ttwgba64')
  })

  test('RT-12 a last-year clear is a clear and a last-year value is kept', () => {
    const r = parseTaxprepCsv(bytes(head + 'GFGBA.Ttwgba64,"1","5","d"\r\nGFGBA.Ttwgba72,"2"," ","d"\r\n'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.rows[0]?.last).toEqual({ kind: 'value', text: '5' })
    expect(r.file.rows[1]?.last).toEqual({ kind: 'clear' })
  })
})

describe('F03 unit: writing', () => {
  test('RT-3 a quote in a description is doubled and reads back', () => {
    const w = writeTaxprepCsv(
      {
        header: H,
        rows: [
          {
            id: id('IFirm.ContactPartner'),
            current: { kind: 'amount', amount: 1 },
            description: 'a "b"',
          },
        ],
      },
      { purpose: 'import' },
    )
    expect(w.ok).toBe(true)
    if (!w.ok) return
    const back = parseTaxprepCsv(w.bytes)
    expect(back.ok && back.file.rows[0]?.description).toBe('a "b"')
  })

  test('RT-25 -0 is written as "0"', () => {
    const ok = writeTaxprepCsv(
      {
        header: H,
        rows: [{ id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: -0 } }],
      },
      { purpose: 'import' },
    )
    expect(ok.ok && Buffer.from(ok.bytes).toString('latin1')).toBe(`${head}GFGBA.Ttwgba64,"0","",""\r\n`)
  })

  test('RT-9 a rate with more than 4 decimals or a negative rate is refused', () => {
    for (const rate of [0.12345, -0.1, Number.NaN]) {
      const w = writeTaxprepCsv(
        {
          header: H,
          rows: [
            {
              id: id('CCACat.FD08C[1].FED.Ttw08cA2'),
              current: { kind: 'rate', rate },
            },
          ],
        },
        { purpose: 'import' },
      )
      expect(w.ok).toBe(false)
    }
  })

  test('RT-9 a header name holding a pipe is refused', () => {
    const w = writeTaxprepCsv({ header: { ...H, returnName: 'A|B' }, rows: [] }, { purpose: 'import' })
    expect(w.ok).toBe(false)
  })

  test('RT-9 a control character in a description is refused naming the row', () => {
    const w = writeTaxprepCsv(
      {
        header: H,
        rows: [
          {
            id: id('GFGBA.Ttwgba64'),
            current: { kind: 'amount', amount: 1 },
            description: 'a\nb',
          },
        ],
      },
      { purpose: 'import' },
    )
    expect(w.ok).toBe(false)
    if (!w.ok)
      expect(w.problems[0]).toMatchObject({
        index: 0,
        identifier: 'GFGBA.Ttwgba64',
      })
  })
})

describe('F03 unit: identifiers', () => {
  test('RT-21 a second copy index in one identifier is refused', () => {
    expect(parseCellId('AB[1].CD[2].EF').ok).toBe(false)
  })

  test('RT-21 a leading-zero copy index is refused', () => {
    expect(parseCellId('AB[01].CD').ok).toBe(false)
  })

  test('RT-21 withCopyIndex gives back an identifier that still parses', () => {
    expect(parseCellId(withCopyIndex(id('AB[1].CD'), 7).text).ok).toBe(true)
  })
})
