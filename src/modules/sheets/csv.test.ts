import { describe, expect, test } from 'vitest'
import { parseCsv, readCsv } from './csv/index'

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
const ok = (bytes: Uint8Array) => {
  const r = readCsv(bytes)
  if (!r.ok) throw new Error(r.reason)
  return r
}
const grid = (bytes: Uint8Array): string[][] => {
  const rows = new Map<number, string[]>()
  for (const c of ok(bytes).cells) rows.set(c.row, [...(rows.get(c.row) ?? []), c.text])
  return [...rows.values()]
}

describe('EV-14 csv encodings', () => {
  test('EV-14 a byte-order mark is stripped; a lone first byte of it is not a mark', () => {
    expect(ok(Uint8Array.of(0xef, 0xbb, 0xbf, 0x41)).encoding).toBe('utf-8-bom')
    expect(grid(Uint8Array.of(0xef, 0xbb, 0xbf, 0x41))).toEqual([['A']])
    const notBom = ok(Uint8Array.of(0xef, 0x41, 0x42))
    expect(notBom.encoding).toBe('windows-1252')
    expect(grid(Uint8Array.of(0xef, 0x41, 0x42))).toEqual([['ïAB']])
  })
  test('EV-14 an empty file has no cells, in every encoding it could be taken for', () => {
    expect(ok(new Uint8Array()).cells).toEqual([])
    expect(ok(Uint8Array.of(0xef, 0xbb, 0xbf)).cells).toEqual([])
  })
})

describe('EV-14 csv separators', () => {
  const sep = (s: string) => ok(enc(s)).separator
  test('EV-14 a first line with no separator at all is a comma file', () => {
    expect(sep('abc\n')).toBe(',')
  })
  test('EV-14 a separator inside quotes on the first line does not count', () => {
    expect(sep('"a,b";"c"\n1;2\n')).toBe(';')
    expect(sep('"a;b",c\n1,2\n')).toBe(',')
  })
  test('EV-14 only the first line decides, whether it ends in LF, CRLF, a lone CR or sits inside a quoted line break', () => {
    expect(sep('a;b\nc,d\n')).toBe(';')
    expect(sep('a;b\r\nc,d\r\n')).toBe(';')
    expect(sep('a;b\rc,d\r')).toBe(';')
    expect(sep('"x\ny,z";q\n1;2\n')).toBe(';')
  })
  test('EV-14 two kinds on the first line stay comma, three kinds too', () => {
    expect(sep('a,b;c\n')).toBe(',')
    expect(sep('a\tb;c\n')).toBe(',')
    expect(sep('a\tb;c,d\n')).toBe(',')
  })
})

describe('EV-14 csv records', () => {
  test('EV-14 a quote inside an unquoted value is kept as it is', () => {
    expect(grid(enc('ab"c,d\n'))).toEqual([['ab"c', 'd']])
  })
  test('EV-14 a lone CR ends a record; CRLF ends only one; a CR inside quotes stays', () => {
    expect(grid(enc('a,b\rc,d'))).toEqual([['a', 'b'], ['c', 'd']])
    expect(grid(enc('a,b\r\nc,d\r\n'))).toEqual([['a', 'b'], ['c', 'd']])
    expect(grid(enc('"a\rb",c'))).toEqual([['a\rb', 'c']])
    expect(grid(enc('a\r\rb'))).toEqual([['a'], [''], ['b']])
  })
  test('EV-14 a blank line is a row with one empty cell and the end of the last line is not a row', () => {
    const r = ok(enc('a\n\nb\n'))
    expect(r.cells.map((c) => [c.row, c.type])).toEqual([[1, 'text'], [2, 'empty'], [3, 'text']])
    expect(grid(enc('a\n\n'))).toEqual([['a'], ['']])
    expect(grid(enc('a'))).toEqual([['a']])
  })
  test('EV-14 an unterminated quote is refused, not guessed', () => {
    expect(readCsv(enc('a,"b\nc'))).toEqual({ ok: false, reason: 'unterminated quoted value' })
    expect(parseCsv('"x', ',')).toEqual({ error: 'unterminated quoted value' })
  })
  test('EV-14 an empty quoted value is an empty cell and a quote after it opens nothing', () => {
    expect(ok(enc('"",a\n')).cells.map((c) => c.type)).toEqual(['empty', 'text'])
    expect(grid(enc('"a"b,c'))).toEqual([['ab', 'c']])
  })
})
