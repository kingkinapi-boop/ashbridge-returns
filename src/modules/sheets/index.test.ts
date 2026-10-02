import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { createSheetsReader } from './index'

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
let saved: Clock
beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T09:00:00-04:00'))
})
afterEach(() => {
  setClock(saved)
})

describe('EV-14 which reader a file gets', () => {
  test('EV-14 .csv, .tsv and .txt in any case are read as CSV', async () => {
    for (const name of ['a.csv', 'A.CSV', 'b.tsv', 'c.txt', 'dir.v2/d.Csv']) {
      const out = await createSheetsReader().read(enc('a,b\n'), name)
      expect(out.ok, name).toBe(true)
    }
  })
  test('EV-14 any other name is refused by name: no extension, a longer one, a lookalike or none at all', async () => {
    for (const name of ['noext', 'x.csv.bak', 'xcsv', 'x.csvx', 'a.pdf', 'file.', '']) {
      const out = await createSheetsReader().read(enc('a,b\n'), name)
      expect(out, name).toEqual({ ok: false, reason: `unsupported file type: ${name}` })
    }
  })
  test('EV-14 a CSV with an unterminated quote and a broken zip come back as refusals, not as results', async () => {
    const reader = createSheetsReader()
    expect(await reader.read(enc('a,"b'), 'a.csv')).toEqual({ ok: false, reason: 'unterminated quoted value' })
    const zip = await reader.read(Uint8Array.of(0x50, 0x4b, 3, 4, 9), 'a.xlsx')
    expect(zip.ok).toBe(false)
  })
  test('EV-14 a compound file is old .xls unless it holds an encrypted package, whatever its name', async () => {
    const head = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    const encrypted = Uint8Array.from([...head, ...Buffer.from('EncryptedPackage', 'utf16le')])
    const plain = Uint8Array.from([...head, ...Buffer.from('Workbook', 'utf16le')])
    expect(await createSheetsReader().read(encrypted, 'a.csv')).toEqual({ ok: false, reason: 'password-protected' })
    expect(await createSheetsReader().read(plain, 'a.xlsx')).toEqual({ ok: false, reason: 'old .xls format' })
  })
})

describe('EV-14 same bytes, same answer', () => {
  test('EV-14 a refusal is remembered too: the second read hands back the first answer', async () => {
    const reader = createSheetsReader()
    const first = await reader.read(enc('a,"b'), 'a.csv')
    setClock(fixedClock('2026-10-03T09:00:00-04:00'))
    expect(await reader.read(enc('a,"b'), 'a.csv')).toBe(first)
  })
  test('EV-14 the same bytes under a name that is read differently are read again, not taken from the cache', async () => {
    const reader = createSheetsReader()
    const asCsv = await reader.read(enc('a,b\n'), 'a.csv')
    const asOther = await reader.read(enc('a,b\n'), 'a.pdf')
    expect(asCsv.ok).toBe(true)
    expect(asOther.ok).toBe(false)
  })
})
