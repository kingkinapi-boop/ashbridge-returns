// F03 builder's own unit tests (the acceptance tests are in taxprep.acceptance.test.ts).
import { describe, expect, test } from 'vitest'
import {
  copiesByNaturalKey,
  isCellClass,
  parseCellId,
  parseTaxprepCsv,
  withCopyIndex,
  writeTaxprepCsv,
  type CellId,
  type TaxprepHeader,
  type WriteRow,
  type WriteValue,
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

// ---------- round 2: wording, grammar edges and row shapes that the mutation run found untested ----------

const row = (body: string) => parseTaxprepCsv(bytes(head + body))
const faultOf = (body: string) => {
  const r = row(body)
  if (r.ok) throw new Error('expected a fault for ' + body)
  return r.faults
}
const writeOne = (current: WriteValue, extra: Partial<WriteRow> = {}, purpose: 'import' | 'export' = 'import') =>
  writeTaxprepCsv({ header: H, rows: [{ id: id('GFGBA.Ttwgba64'), current, ...extra }] }, { purpose })
const problemOf = (w: ReturnType<typeof writeTaxprepCsv>) => {
  if (w.ok) throw new Error('expected a refusal')
  return w.problems
}

describe('F03 unit round 2: identifier reasons and copy paths', () => {
  const reasonOf = (t: string): string => {
    const r = parseCellId(t)
    if (r.ok) throw new Error('expected a refusal for ' + t)
    return r.reason
  }
  test('RT-21 each refusal says why', () => {
    expect(reasonOf('')).toBe('identifier "" is refused: it is empty')
    expect(reasonOf('A.B C')).toBe('identifier "A.B C" is refused: it holds a space')
    expect(reasonOf('AB')).toBe('identifier "AB" is refused: it needs two or more parts separated by dots')
    expect(reasonOf('A..B')).toBe('identifier "A..B" is refused: it has an empty part')
    expect(reasonOf('A.b')).toContain('part "b" must be capital-letter first, then letters and digits')
    expect(reasonOf('A[1].B[2].C')).toBe('identifier "A[1].B[2].C" is refused: it has more than one copy index')
    expect(reasonOf('A.B[0]')).toBe('identifier "A.B[0]" is refused: the copy index [0] must be a whole number from 1')
    expect(reasonOf('A.B[x]')).toContain('the copy index [x] must be a whole number from 1')
    expect(reasonOf('A.B[99999999999999999999]')).toContain('must be a whole number from 1')
  })
  test('RT-21 the copy path ends at the part that carries the index', () => {
    const at = (t: string) => {
      const i = id(t)
      return [i.copyPath, i.copyIndex]
    }
    expect(at('A[2].B.C')).toEqual(['A', 2])
    expect(at('A.B[3].C')).toEqual(['A.B', 3])
    expect(at('A.B.C[4]')).toEqual(['A.B.C', 4])
    expect(at('A.B')).toEqual([null, null])
  })
  test('RT-21 a copy index is anchored at both ends', () => {
    expect(parseCellId('A.B[1]x').ok).toBe(false)
    expect(parseCellId('A.B[1]]').ok).toBe(false)
    expect(parseCellId('A.B[1x]').ok).toBe(false)
  })
  test('RT-21 withCopyIndex changes only the index and refuses bad ones with the reason', () => {
    const w = withCopyIndex(id('A.B[1].C'), 12)
    expect(w.text).toBe('A.B[12].C')
    expect(w.copyIndex).toBe(12)
    expect(w.copyPath).toBe('A.B')
    expect(() => withCopyIndex(id('A.B'), 2)).toThrow('identifier "A.B" has no copy index')
    for (const n of [0, 1.5, Number.NaN, 2 ** 60, -3]) {
      expect(() => withCopyIndex(id('A.B[1].C'), n)).toThrow('must be a whole number from 1')
    }
  })
  test('RT-14 isCellClass accepts only the six names', () => {
    expect(isCellClass('traced')).toBe(true)
    expect(isCellClass('rolled-forward')).toBe(true)
    expect(isCellClass('other')).toBe(false)
    expect(isCellClass(5)).toBe(false)
    expect(isCellClass(null)).toBe(false)
  })
})

describe('F03 unit round 2: read faults say why, on the row', () => {
  const cases: [string, string, string][] = [
    [`"'-0"`, 'apostrophe', 'has an apostrophe that is not the single one Taxprep puts before a negative number'],
    [`"'-05"`, 'apostrophe', 'has an apostrophe that is not'],
    [`"'-5'"`, 'apostrophe', 'has an apostrophe that is not'],
    [`"''-5"`, 'apostrophe', 'has an apostrophe that is not'],
    [`"'5"`, 'apostrophe', 'has an apostrophe that is not'],
    [`"(1,234)"`, 'negative-parens', 'is a negative written in brackets'],
    [`"48,600"`, 'thousands', 'has a thousands separator'],
    [`"48 600"`, 'thousands', 'has a thousands separator'],
    [`"1,5"`, 'decimal-comma', 'uses a decimal comma'],
    [`"1e5"`, 'scientific', 'is in scientific notation'],
    [`"01/10/2026"`, 'date-format', 'is a reformatted date'],
    [`"2026/10/01"`, 'date-format', 'is a reformatted date'],
  ]
  test.each(cases)('RT-9 %s is refused as %s', (value, code, phrase) => {
    const f = faultOf(`GFGBA.Ttwgba64,${value},"",""\r\n`)
    expect(f).toHaveLength(1)
    expect(f[0]?.code).toBe(code)
    expect(f[0]?.reason).toContain(phrase)
    expect(f[0]?.reason).toContain('(GFGBA.Ttwgba64)')
    expect(f[0]?.line).toBe(2)
  })
  test('RT-9 the same fault in the last-year column is found too', () => {
    expect(faultOf(`GFGBA.Ttwgba64,"1","48,600",""\r\n`)[0]?.code).toBe('thousands')
  })
  test('RT-9 a negative with one leading apostrophe is read, and the row says so', () => {
    const r = row(`GFGBA.Ttwgba64,"'-1356","",""\r\nGFGBA.Ttwgba72,"-1","",""\r\n`)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.rows.map((x) => x.apostrophe)).toEqual([true, false])
    expect(r.file.rows[0]?.current).toEqual({ kind: 'value', text: '-1356' })
  })

  test('RT-9 unquoted values are refused naming the value', () => {
    expect(faultOf('GFGBA.Ttwgba64,12,"x",""\r\n')[0]).toMatchObject({
      code: 'unquoted',
      reason: 'a value "12" is not in double quotes; every value is quoted (GFGBA.Ttwgba64)',
    })
    expect(faultOf('GFGBA.Ttwgba64,"1",5\r\n')[0]?.reason).toContain('a value "5" is not in double quotes')
    expect(faultOf('GFGBA.Ttwgba64,,"x"\r\n')[0]?.reason).toContain('a value "" is not in double quotes')
    expect(faultOf('GFGBA.Ttwgba64,"1",5,"x"\r\n')[0]?.reason).toContain('a value "5" is not in double quotes')
  })
  test('RT-9 an unclosed quote, a wrong separator after a quote and trailing text are each named', () => {
    expect(faultOf('GFGBA.Ttwgba64,"1\r\n')[0]?.reason).toBe('a quoted value is not closed (GFGBA.Ttwgba64)')
    expect(faultOf('GFGBA.Ttwgba64,"1";"2"\r\n')[0]).toMatchObject({ code: 'separator' })
    expect(faultOf('GFGBA.Ttwgba64,"1";"2"\r\n')[0]?.reason).toContain('values are separated by ";"')
    expect(faultOf('GFGBA.Ttwgba64,"1"\t"2"\r\n')[0]?.reason).toContain('values are separated by "\\t"')
    expect(faultOf('GFGBA.Ttwgba64,"1"x\r\n')[0]).toMatchObject({
      code: 'unquoted',
      reason: 'text follows a closing quote (GFGBA.Ttwgba64)',
    })
  })
  test('RT-9 a row with nothing after its identifier, or a quote straight after it, is refused', () => {
    for (const body of ['GFGBA.Ttwgba64\r\n', 'GFGBA.Ttwgba64"1"\r\n']) {
      const f = faultOf(body)
      expect(f[0]).toMatchObject({ code: 'unquoted', reason: 'the row has no value after its identifier', line: 2 })
    }
  })
  test('RT-9 a tab, semicolon or space after the identifier is the wrong separator', () => {
    for (const sep of ['\t', ';', ' ']) {
      const f = faultOf(`GFGBA.Ttwgba64${sep}"1"\r\n`)
      expect(f[0]?.code).toBe('separator')
      expect(f[0]?.reason).toContain(`values are separated by ${JSON.stringify(sep)}; the separator is a comma`)
    }
  })
  test('RT-21 a refused identifier on a row is reported on that row and the rest still read', () => {
    const f = faultOf('gfgba.x,"1","",""\r\nGFGBA.Ttwgba64,"1","",""\r\n')
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ code: 'identifier', line: 2 })
  })
  test('RT-9 quotes doubled inside a value read as one quote', () => {
    const r = row('IFirm.ContactPartner,"x""","""",""\r\n')
    expect(r.ok && r.file.rows[0]?.current).toEqual({ kind: 'value', text: 'x"' })
    expect(r.ok && r.file.rows[0]?.last).toEqual({ kind: 'value', text: '"' })
  })
  test('RT-9 a header that is not in brackets, or has text before them, is refused as a header fault', () => {
    for (const first of ['Name|0|0|G,"Current Year","Last Year",""', 'x[N|0|0|G],"Current Year","Last Year",""']) {
      const r = parseTaxprepCsv(bytes(first + '\r\n'))
      expect(r.ok).toBe(false)
      if (!r.ok)
        expect(r.faults[0]).toMatchObject({
          code: 'header',
          line: 1,
          reason: 'the first line must be the header in square brackets: [name|0|0|GUID]',
        })
    }
  })
  test('RT-21 a row that starts with a separator has an empty identifier; a bare short identifier is named', () => {
    expect(faultOf(',"1","",""\r\n')[0]?.reason).toBe('identifier "" is refused: it is empty')
    expect(faultOf('A.B\r\n')[0]).toMatchObject({ code: 'unquoted', reason: 'the row has no value after its identifier' })
  })
  test('RT-3 only the two value columns are checked as values; a description may look like anything', () => {
    const r = row('A.One,"1","2","48,600"\r\nA.Two,"3","4","5","(1)"\r\n')
    expect(r.ok && r.file.rows.map((x) => x.description)).toEqual(['48,600', '5'])
  })
  test('RT-9 a header with a wrong tail or a wrong separator is named', () => {
    const tail = parseTaxprepCsv(bytes('[N|0|0|G],"Current Year"\r\n'))
    expect(tail.ok).toBe(false)
    if (!tail.ok) expect(tail.faults[0]?.reason).toContain('"Current Year","Last Year",""')
    const sep = parseTaxprepCsv(bytes('[N|0|0|G];"Current Year","Last Year",""\r\n'))
    expect(sep.ok).toBe(false)
    if (!sep.ok)
      expect(sep.faults[0]).toMatchObject({
        code: 'separator',
        reason: 'the header uses ";" as a separator; it is a comma',
      })
  })
  test('RT-3 a header with other middle fields still reads its name and GUID', () => {
    const r = parseTaxprepCsv(bytes('[Name (Test)|12|34|ABC-1],"Current Year","Last Year",""\r\n'))
    expect(r.ok && r.file.header).toEqual({ returnName: 'Name (Test)', guid: 'ABC-1' })
  })
  test('RT-3 each row says which shape it had and keeps its columns', () => {
    const r = row(
      'A.One,"1"\r\nA.Two,"2","3"\r\nA.Three,"4","5","d"\r\nA.Four,"6","7","e","x","y"\r\nA.Five,"8","","",""\r\n',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.rows.map((x) => [x.shape, x.last, x.description])).toEqual([
      ['current-only', null, null],
      ['current-only', { kind: 'value', text: '3' }, null],
      ['standard', { kind: 'value', text: '5' }, 'd'],
      ['extra-columns', { kind: 'value', text: '7' }, 'e'],
      ['extra-columns', { kind: 'clear' }, ''],
    ])
    expect(r.file.rows.map((x) => x.line)).toEqual([2, 3, 4, 5, 6])
  })
  test('RT-3 an empty-description standard row keeps an empty string, not null', () => {
    const r = row('A.One,"1","2",""\r\n')
    expect(r.ok && r.file.rows[0]?.description).toBe('')
  })
})

describe('F03 unit round 2: natural keys', () => {
  const rowsOf = (body: string) => {
    const r = row(body)
    if (!r.ok) throw new Error('bad fixture')
    return r.file.rows
  }
  const KEY = 'CCACat.FD08C'
  test('RT-7 an unregistered path says so', () => {
    const r = copiesByNaturalKey([], 'Other.Path')
    expect(r).toEqual({ ok: false, reason: 'no natural-key cell is registered for the copy path Other.Path' })
  })
  test('RT-7 duplicates are named with both copies', () => {
    const r = copiesByNaturalKey(
      rowsOf('CCACat.FD08C[1].FED.Ttw08cA1,"8","",""\r\nCCACat.FD08C[2].FED.Ttw08cA1,"8","",""\r\n'),
      KEY,
    )
    expect(r).toEqual({ ok: false, reason: 'duplicate natural key 8 under CCACat.FD08C: copies 1 and 2' })
  })
  test('RT-7 the same row twice in one copy is not a duplicate', () => {
    const r = copiesByNaturalKey(
      rowsOf('CCACat.FD08C[1].FED.Ttw08cA1,"8","",""\r\nCCACat.FD08C[1].FED.Ttw08cA1,"8","",""\r\n'),
      KEY,
    )
    expect(r.ok && [...r.copies]).toEqual([['8', 1]])
  })
  test('RT-7 other cells, other paths and cleared keys are skipped', () => {
    const r = copiesByNaturalKey(
      rowsOf(
        'CCACat.FD08C[1].FED.Ttw08cA2,"8","",""\r\n' +
          'CCACat.FD09C[2].FED.Ttw08cA1,"8","",""\r\n' +
          'CCACat.FD08C[3].FED.Ttw08cA1,"","",""\r\n' +
          'CCACat.FD08C[4].FED.Ttw08cA1,"10","",""\r\n' +
          'IDENT.Ident1,"x","",""\r\n',
      ),
      KEY,
    )
    expect(r.ok && [...r.copies]).toEqual([['10', 4]])
  })
})

describe('F03 unit round 2: write refusals say why', () => {
  const reasonOf = (w: ReturnType<typeof writeTaxprepCsv>): string => problemOf(w)[0]?.reason ?? ''
  test('RT-25 amounts', () => {
    expect(reasonOf(writeOne({ kind: 'amount', amount: Number.NaN }))).toBe(
      'GFGBA.Ttwgba64: the amount NaN is not a number',
    )
    expect(reasonOf(writeOne({ kind: 'amount', amount: Infinity }))).toContain('is not a number')
    expect(reasonOf(writeOne({ kind: 'amount', amount: 7693.52 }))).toBe(
      'GFGBA.Ttwgba64: the amount 7693.52 has cents; amounts are whole dollars',
    )
    expect(reasonOf(writeOne({ kind: 'amount', amount: 2 ** 60 }))).toContain('is too large to be exact')
    const p = problemOf(writeOne({ kind: 'amount', amount: 1.5 }))[0]
    expect(p).toEqual({ index: 0, identifier: 'GFGBA.Ttwgba64', reason: p?.reason })
  })
  test('RT-8 blank text and text starting with an apostrophe', () => {
    expect(reasonOf(writeOne({ kind: 'text', text: '  ' }))).toContain('a blank text value would be read as a clear')
    expect(reasonOf(writeOne({ kind: 'text', text: "'x" }))).toContain('must not start with an apostrophe')
  })
  test('RT-9 a character Windows-1252 cannot hold is named, with its row, in the text and the description', () => {
    const p = problemOf(writeOne({ kind: 'text', text: 'a≥b' }))[0]
    expect(p).toMatchObject({ index: 0, identifier: 'GFGBA.Ttwgba64', character: '≥' })
    expect(p?.reason).toContain('the text value holds the character ≥')
    const d = problemOf(writeOne({ kind: 'amount', amount: 1 }, { description: 'x≥' }))[0]
    expect(d?.reason).toContain('the description holds the character ≥')
    expect(d?.character).toBe('≥')
  })
  test('RT-9 the five undefined Windows-1252 code points are refused, the neighbours are written', () => {
    for (const cp of [0x81, 0x8d, 0x8f, 0x90, 0x9d]) {
      expect(writeOne({ kind: 'text', text: String.fromCodePoint(cp) }).ok).toBe(false)
    }
    for (const cp of [0x20ac, 0x201a, 0x178, 0xa1, 0xff]) {
      expect(writeOne({ kind: 'text', text: String.fromCodePoint(cp) }).ok).toBe(true)
    }
    expect(writeOne({ kind: 'text', text: '€' }).ok).toBe(true)
    expect(writeOne({ kind: 'text', text: '\u007f' }).ok).toBe(false)
    expect(writeOne({ kind: 'text', text: '\u001f' }).ok).toBe(false)
  })
  test('RT-9 bytes 0x80 to 0x9f read back as their characters and the rest as themselves', () => {
    const r = parseTaxprepCsv(bytes(head + 'IFirm.ContactPartner,"\x80\x9f\xe9a","",""\r\n'))
    expect(r.ok && r.file.rows[0]?.current).toEqual({ kind: 'value', text: '€Ÿéa' })
    const u = parseTaxprepCsv(bytes(head + 'IFirm.ContactPartner,"\x81\x8d","",""\r\n'))
    expect(u.ok && u.file.rows[0]?.current).toEqual({ kind: 'value', text: '\x81\x8d' })
  })
  test('RT-9 dates', () => {
    const bad = ['2026-02-30', '2026-13-01', '2026-00-10', '2026-01-00', '0099-01-01', '2026-1-5']
    for (const date of [...bad, 'x2026-01-01', '2026-01-01x', '2026-02-29']) {
      expect(reasonOf(writeOne({ kind: 'date', date }))).toBe(
        `GFGBA.Ttwgba64: the date ${date} is not a real date written YYYY-MM-DD`,
      )
    }
    for (const date of ['2026-02-28', '2024-02-29', '2026-12-31', '2026-01-01']) {
      expect(writeOne({ kind: 'date', date }).ok).toBe(true)
    }
  })
  test('RT-3 rates', () => {
    expect(reasonOf(writeOne({ kind: 'rate', rate: -0.1 }))).toContain('the rate -0.1 must be a number from 0')
    expect(reasonOf(writeOne({ kind: 'rate', rate: Number.NaN }))).toContain('must be a number from 0')
    expect(reasonOf(writeOne({ kind: 'rate', rate: Infinity }))).toContain('must be a number from 0')
    expect(reasonOf(writeOne({ kind: 'rate', rate: 0.12345 }))).toContain('the rate 0.12345 has more than 4 decimals')
    const good = [
      [0.1 + 0.2, '0.3000'],
      [0.1234, '0.1234'],
      [0, '0.0000'],
      [1, '1.0000'],
    ] as const
    for (const [rate, text] of good) {
      const w = writeOne({ kind: 'rate', rate })
      expect(w.ok && Buffer.from(w.bytes).toString('latin1')).toBe(`${head}GFGBA.Ttwgba64,"${text}","",""\r\n`)
    }
  })
  test('RT-8 yes, no and an explicit clear are written as Y, N and an empty quoted value', () => {
    const lines: WriteValue[] = [{ kind: 'yesNo', yes: true }, { kind: 'yesNo', yes: false }, { kind: 'clear' }]
    const w = writeTaxprepCsv(
      { header: H, rows: lines.map((current) => ({ id: id('GFGBA.Ttwgba64'), current })) },
      { purpose: 'import' },
    )
    expect(w.ok && Buffer.from(w.bytes).toString('latin1')).toBe(
      `${head}GFGBA.Ttwgba64,"Y","",""\r\nGFGBA.Ttwgba64,"N","",""\r\nGFGBA.Ttwgba64,"","",""\r\n`,
    )
  })
  test('RT-3 a last-year value and a description are written in their columns', () => {
    const w = writeOne({ kind: 'amount', amount: 5 }, { last: { kind: 'amount', amount: -6 }, description: 'é' })
    expect(w.ok && Buffer.from(w.bytes).toString('latin1')).toBe(`${head}GFGBA.Ttwgba64,"5","-6","\xe9"\r\n`)
  })
  test('RT-13 the ignored cells are refused on import and allowed on export', () => {
    const date: WriteValue = { kind: 'date', date: '2026-01-01' }
    const ignored = writeTaxprepCsv(
      { header: H, rows: [{ id: id('IDENT.Ident120'), current: date }] },
      { purpose: 'import' },
    )
    expect(problemOf(ignored)[0]).toMatchObject({ index: 0, identifier: 'IDENT.Ident120' })
    expect(problemOf(ignored)[0]?.reason).toBe(
      'IDENT.Ident120: IDENT.Ident120 is skipped by Taxprep on import, so no row may be written for it',
    )
    const exported = writeTaxprepCsv(
      { header: H, rows: [{ id: id('IDENT.Ident120'), current: date }] },
      { purpose: 'export' },
    )
    expect(exported.ok).toBe(true)
  })
  test('RT-9 header problems carry index -1 and the identifier header', () => {
    const bad = (header: TaxprepHeader) => problemOf(writeTaxprepCsv({ header, rows: [] }, { purpose: 'import' }))
    expect(bad({ ...H, returnName: 'A≥B' })[0]).toMatchObject({ index: -1, identifier: 'header' })
    expect(bad({ ...H, returnName: 'A≥B' })[0]?.reason).toContain('the return name holds the character ≥')
    for (const header of [
      { ...H, returnName: 'A|B' },
      { ...H, returnName: 'A]B' },
      { ...H, guid: 'a|b' },
      { ...H, guid: 'a]b' },
      { ...H, guid: 'éabc' },
      { ...H, guid: 'abcé' },
      { ...H, guid: 'ab\ncd' },
    ]) {
      expect(bad(header)[0]?.reason).toBe('the header must not hold | or ] and the GUID must be plain ASCII')
      expect(bad(header)[0]).toMatchObject({ index: -1, identifier: 'header' })
    }
    expect(writeTaxprepCsv({ header: { ...H, guid: ' ~' }, rows: [] }, { purpose: 'import' }).ok).toBe(true)
  })
  test('RT-9 a header problem and row problems are all reported together', () => {
    const w = writeTaxprepCsv(
      {
        header: { ...H, returnName: 'A|B' },
        rows: [
          { id: id('GFGBA.Ttwgba64'), current: { kind: 'amount', amount: 1 } },
          { id: id('GFGBA.Ttwgba72'), current: { kind: 'amount', amount: 1.5 } },
        ],
      },
      { purpose: 'import' },
    )
    expect(problemOf(w).map((p) => p.index)).toEqual([-1, 1])
  })
  test('RT-3 an error that is not a refusal is not swallowed', () => {
    const broken = { id: id('GFGBA.Ttwgba64') } as unknown as WriteRow
    expect(() => writeTaxprepCsv({ header: H, rows: [broken] }, { purpose: 'import' })).toThrow(TypeError)
  })
})

describe('F03R unit: writer refusals say why', () => {
  test('RT-9 a text value the reader would refuse is refused with the reader reason', () => {
    const w = writeTaxprepCsv(
      {
        header: H,
        rows: [{ id: id('GFGBA.Ttwgba64'), current: { kind: 'text', text: '1,234' } }],
      },
      { purpose: 'import' },
    )
    expect(problemOf(w)[0]?.reason).toMatch(/would be refused on reading.*thousands separator/)
  })
  test('RT-21 a forged identifier is refused and names itself', () => {
    const forged = { text: 'A"\r\nB' } as unknown as CellId
    const w = writeTaxprepCsv(
      { header: H, rows: [{ id: forged, current: { kind: 'amount', amount: 1 } }] },
      { purpose: 'import' },
    )
    expect(problemOf(w)[0]?.reason).toMatch(/is not a valid cell identifier/)
  })
})
