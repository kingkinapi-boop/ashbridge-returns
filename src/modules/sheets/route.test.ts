import { describe, expect, test } from 'vitest'
import { createSheetsReader } from './index'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe('EV-14 routing by first bytes and name', () => {
  test('EV-14 bytes that only share one letter with "PK" are not a zip: a non-CSV name is unsupported', async () => {
    const reader = createSheetsReader()
    expect(await reader.read(utf8('Px,1\n'), 'a.pdf')).toEqual({ ok: false, reason: 'unsupported file type' })
    expect(await reader.read(utf8('xK,1\n'), 'a.pdf')).toEqual({ ok: false, reason: 'unsupported file type' })
  })

  test('EV-14 plain text under a CSV name reads as CSV, text under another name is unsupported', async () => {
    const reader = createSheetsReader()
    const csv = await reader.read(utf8('a,1\n'), 'a.csv')
    expect(csv.ok && csv.result.engine.name).toBe('ashbridge-csv')
    expect(await reader.read(utf8('a,1\n'), 'a.bin')).toEqual({ ok: false, reason: 'unsupported file type' })
  })

  test('EV-14 "PK" text named .xlsx is refused as not a workbook; named .csv it is CSV', async () => {
    const reader = createSheetsReader()
    expect(await reader.read(utf8('PKey,1\n'), 'a.xlsx')).toEqual({ ok: false, reason: 'not a workbook (not a readable .xlsx file)' })
    const csv = await reader.read(utf8('PKey,1\n'), 'a.csv')
    expect(csv.ok && csv.result.engine.name).toBe('ashbridge-csv')
  })
})
