// A07C unit tests: the zip reader, the sheet XML reader, strict number literals, hyperlink recovery and SUM totals.
import { deflateRawSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import type { Cell } from '../../../contracts/sheets'
import { shapesXlsx } from '../__fixtures__/a07c'
import { numbersXlsx } from '../__fixtures__/harness'
import { decodeXml, NO_RAW, readRaw } from './raw'
import { readXlsx } from './index'
import { openZip } from './zip'

type Part = { name: string; data: string; method?: 0 | 8; localExtra?: number; centralExtra?: number; centralComment?: number }

/** A zip with every record laid out as the format says (CRC left zero: the reader does not check it). */
function zip(parts: Part[], comment = ''): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const p of parts) {
    const raw = Buffer.from(p.data, 'utf8')
    const data = p.method === 8 ? deflateRawSync(raw) : raw
    const name = Buffer.from(p.name, 'utf8')
    const local = Buffer.alloc(30 + name.length + (p.localExtra ?? 0))
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(p.method ?? 0, 8)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(p.localExtra ?? 0, 28)
    name.copy(local, 30)
    const central = Buffer.alloc(46 + name.length + (p.centralExtra ?? 0) + (p.centralComment ?? 0))
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(p.method ?? 0, 10)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(p.centralExtra ?? 0, 30)
    central.writeUInt16LE(p.centralComment ?? 0, 32)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)
    locals.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22 + comment.length)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(parts.length, 8)
  end.writeUInt16LE(parts.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(comment.length, 20)
  end.write(comment, 22)
  return Buffer.concat([...locals, directory, end])
}

describe('EV-14 the zip reader reads stored and deflated parts and nothing else', () => {
  test('EV-14 a stored part and a deflated part read back, with extra fields, comments and utf-8 names in the way', () => {
    const z = openZip(
      zip(
        [
          { name: 'a.txt', data: 'stored text', localExtra: 5, centralExtra: 7, centralComment: 3 },
          { name: 'dir/ü.xml', data: '<x>deflated deflated deflated</x>', method: 8, localExtra: 2 },
          { name: 'last.txt', data: 'last' },
        ],
        'an archive comment',
      ),
    )
    expect(z?.read('a.txt')?.toString()).toBe('stored text')
    expect(z?.read('dir/ü.xml')?.toString()).toBe('<x>deflated deflated deflated</x>')
    expect(z?.read('last.txt')?.toString()).toBe('last')
    expect(z?.read('missing.txt')).toBeUndefined()
  })

  test('EV-14 an empty zip has no parts; the longest allowed archive comment is still found', () => {
    expect(openZip(zip([]))?.read('a')).toBeUndefined()
    expect(openZip(zip([{ name: 'a', data: 'x' }], 'c'.repeat(0xffff)))?.read('a')?.toString()).toBe('x')
  })

  test('EV-14 bytes that are not a well-formed zip give nothing, never a throw', () => {
    expect(openZip(Uint8Array.of(1, 2, 3))).toBeUndefined()
    expect(openZip(new Uint8Array(0))).toBeUndefined()
    const good = zip([{ name: 'a', data: 'hello' }])
    expect(openZip(good.subarray(0, good.length - 1))).toBeUndefined()
    // The record count says one part, the directory holds none.
    const noDirectory = Buffer.from(good)
    noDirectory.writeUInt32LE(0, noDirectory.length - 22 + 16)
    noDirectory.writeUInt32LE(0, 0)
    expect(openZip(noDirectory)).toBeUndefined()
  })

  test('EV-14 a part whose local header is wrong, whose data is cut short, whose method is unknown or whose deflate is damaged reads as nothing', () => {
    const base = zip([{ name: 'a', data: 'hello' }])
    const wrongLocal = Buffer.from(base)
    wrongLocal.writeUInt32LE(0, 0)
    expect(openZip(wrongLocal)?.read('a')).toBeUndefined()
    const unknown = Buffer.from(base)
    unknown.writeUInt16LE(9, base.length - 22 - 47 + 10 + 1)
    expect(openZip(unknown)?.read('a')).toBeUndefined()
    // A size larger than the file holds.
    const oversize = zip([{ name: 'a', data: 'hello' }])
    oversize.writeUInt32LE(5000, oversize.length - 22 - 46 - 1 + 20)
    expect(openZip(oversize)?.read('a')).toBeUndefined()
    // Deflate that is not deflate.
    const damaged = Buffer.from(zip([{ name: 'a', data: 'hello hello hello', method: 8 }]))
    damaged.fill(0xff, 31, 35)
    expect(() => openZip(damaged)?.read('a')).toThrow()
  })
})

describe('EV-14 the sheet XML reader', () => {
  const book = (sheets: string, rels: string, parts: Part[]): Buffer =>
    zip([
      { name: 'xl/workbook.xml', data: `<workbook xmlns:r="r"><sheets>${sheets}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<Relationships>${rels}</Relationships>` },
      ...parts,
    ])

  test('EV-14 cells are found by sheet name (entities decoded) and address, with type, stored value and formula', () => {
    const z = openZip(
      book(
        '<sheet name="A &amp; B" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/>',
        '<Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml" Type="t"/>',
        [
          {
            name: 'xl/worksheets/sheet1.xml',
            data: '<worksheet><cols><col min="1" max="1"/></cols><sheetData><row r="1"><c r="A1" s="1"/><c r="B1" t="n"><v>12.50</v></c><c r="C1" t="str"><f>A1&amp;"x"</f><v>a&lt;b</v></c><c r="D1"><f t="shared" si="0"/><v>3</v></c><c r="E1"><f>1+1</f></c><c s="1"><v>9</v></c><c r="F1" t="inlineStr"><is><t>x</t></is></c><c r="G1"><v>1&#10;2</v></c></row></sheetData></worksheet>',
          },
          { name: 'xl/worksheets/sheet2.xml', data: '<worksheet><sheetData><row><c r="A1" t="b"><v>1</v></c></row></sheetData></worksheet>' },
        ],
      ),
    ) as NonNullable<ReturnType<typeof openZip>>
    const raw = readRaw(z)
    expect([...(raw?.keys() ?? [])]).toEqual(['A & B', 'Second'])
    const first = raw?.get('A & B')
    expect(first?.get('A1')).toEqual({ type: undefined, value: undefined, formula: undefined })
    expect(first?.get('B1')).toEqual({ type: 'n', value: '12.50', formula: undefined })
    expect(first?.get('C1')).toEqual({ type: 'str', value: 'a<b', formula: 'A1&"x"' })
    expect(first?.get('D1')).toEqual({ type: undefined, value: '3', formula: undefined })
    expect(first?.get('E1')).toEqual({ type: undefined, value: undefined, formula: '1+1' })
    expect(first?.get('F1')).toEqual({ type: 'inlineStr', value: undefined, formula: undefined })
    expect(first?.get('G1')).toEqual({ type: undefined, value: '1\n2', formula: undefined })
    expect(first?.size).toBe(7)
    expect(raw?.get('Second')?.get('A1')).toEqual({ type: 'b', value: '1', formula: undefined })
  })

  test('EV-14 a sheet whose part is missing is left out; no workbook part or no relationships gives nothing', () => {
    const only = book('<sheet name="One" r:id="rId1"/><sheet name="Two" r:id="rId9"/><sheet r:id="rId1"/>', '<Relationship Id="rId1" Target="worksheets/s.xml"/><Relationship Target="x.xml"/>', [
      { name: 'xl/worksheets/s.xml', data: '<c r="A1"><v>1</v></c>' },
    ])
    expect([...(readRaw(openZip(only) as NonNullable<ReturnType<typeof openZip>>)?.keys() ?? [])]).toEqual(['One'])
    expect(readRaw(openZip(zip([{ name: 'xl/_rels/workbook.xml.rels', data: '' }])) as NonNullable<ReturnType<typeof openZip>>)).toBeUndefined()
    expect(readRaw(openZip(zip([{ name: 'xl/workbook.xml', data: '' }])) as NonNullable<ReturnType<typeof openZip>>)).toBeUndefined()
    const damaged = Buffer.from(zip([{ name: 'xl/workbook.xml', data: 'abc hello hello', method: 8 }, { name: 'xl/_rels/workbook.xml.rels', data: '' }]))
    damaged.fill(0xff, 46, 50)
    expect(readRaw(openZip(damaged) as NonNullable<ReturnType<typeof openZip>>)).toBeUndefined()
  })

  test('EV-14 XML text decodes the five named entities, decimal and hex references, once only, and leaves other text alone', () => {
    expect(decodeXml('&amp;&lt;&gt;&quot;&apos;')).toBe('&<>"\'')
    expect(decodeXml('&#65;&#x42;&#x63;')).toBe('ABc')
    expect(decodeXml('&amp;lt; &nbsp; &#; &amp')).toBe('&lt; &nbsp; &#; &amp')
    expect(NO_RAW).toEqual({ type: undefined, value: undefined, formula: undefined })
  })
})

const read = async (rows: string[], links?: [string, string][]): Promise<Cell[]> => {
  const out = await readXlsx(shapesXlsx({ rows, ...(links ? { links } : {}) }))
  if (!out.ok) throw new Error(out.reason)
  return out.sheets[0]?.cells ?? []
}
const at = (cells: Cell[], row: number, letter: string): Cell | undefined => cells.find((c) => c.row === row && c.column.letter === letter)

describe('EV-14 a number is one whole number literal', () => {
  test('EV-14 literals read as numbers (sign, point, exponent, leading zeros)', async () => {
    const literals = ['12', '-0.5', '+3', '.5', '5.', '1e3', '1.5E-3', '007', '1E+2']
    const out = await readXlsx(numbersXlsx(literals))
    if (!out.ok) throw new Error(out.reason)
    const cells = out.sheets[0]?.cells ?? []
    expect(cells.map((c) => c.type)).toEqual(literals.map(() => 'number'))
    expect(cells.map((c) => c.text)).toEqual(['12', '-0.5', '3', '0.5', '5', '1000', '0.0015', '7', '100'])
  })

  test('EV-14 anything else reads as an error cell, never another number', async () => {
    const bad = ['x12', '12x', '1e', '1e+', '--1', '.', '+', '1.2.3', ' 12', '12 ', '1 2', '٣', '0x1', '1e5e5']
    const out = await readXlsx(numbersXlsx(bad))
    if (!out.ok) throw new Error(out.reason)
    const cells = out.sheets[0]?.cells ?? []
    expect(cells.map((c) => [c.type, c.text])).toEqual(bad.map(() => ['error', '#NUM!']))
  })

  test('EV-14 only a number-typed cell is judged: text, boolean and error cells keep their stored text', async () => {
    const cells = await read([
      '<c r="A1" t="n"><v>12abc</v></c><c r="B1" t="n"><v>12</v></c><c r="C1" t="str"><f>"x"</f><v>12abc</v></c><c r="D1" t="e"><v>#N/A</v></c><c r="E1" t="b"><v>1</v></c><c r="F1" t="inlineStr"><is><t>12abc</t></is></c>',
    ])
    expect([at(cells, 1, 'A')?.type, at(cells, 1, 'A')?.text]).toEqual(['error', '#NUM!'])
    expect([at(cells, 1, 'B')?.type, at(cells, 1, 'B')?.text]).toEqual(['number', '12'])
    expect(at(cells, 1, 'C')).toMatchObject({ type: 'formula', formula: '"x"', cached: { type: 'text', text: '12abc' } })
    expect(at(cells, 1, 'D')?.text).toBe('#N/A')
    expect(at(cells, 1, 'E')?.text).toBe('TRUE')
    expect(at(cells, 1, 'F')?.text).toBe('12abc')
  })

  test('EV-14 a formula cached as 12abc caches an error; a hyperlinked formula cached as 0x10 does too, with its formula', async () => {
    const cells = await read(['<c r="A1"><f>B1</f><v>12abc</v></c>', '<c r="A2"><f>B1</f><v>0x10</v></c>'], [['A2', 'https://example.invalid/x']])
    expect(at(cells, 1, 'A')).toMatchObject({ type: 'formula', formula: 'B1', text: '#NUM!', cached: { type: 'error', text: '#NUM!' } })
    expect(at(cells, 2, 'A')).toMatchObject({ type: 'formula', formula: 'B1', text: '#NUM!', cached: { type: 'error', text: '#NUM!' } })
  })
})

describe('EV-14 hyperlinks keep the cell as it is', () => {
  test('EV-14 a hyperlinked formula with no cached value caches none and keeps its formula; a hyperlinked text cell has no formula', async () => {
    const cells = await read(['<c r="A1"><f>B1</f></c><c r="B1" t="inlineStr"><is><t>text</t></is></c>'], [
      ['A1', 'https://example.invalid/a'],
      ['B1', 'https://example.invalid/b'],
    ])
    expect(at(cells, 1, 'A')).toMatchObject({ type: 'formula', formula: 'B1', text: '', cached: { type: 'none', text: '' } })
    expect(at(cells, 1, 'B')).toMatchObject({ type: 'text', text: 'text' })
    expect(at(cells, 1, 'B')?.formula).toBeUndefined()
  })
})

