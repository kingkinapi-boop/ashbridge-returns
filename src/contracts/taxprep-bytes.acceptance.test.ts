// W00 round 2 (findings W00 r1 S1 and its re-test): the shared fixture that turns a committed CSV into the bytes
// Taxprep wrote (src/contracts/__fixtures__/taxprep-bytes.ts). The files it reads are stored CRLF (`-text`, the
// sample clients' taxprep/import.csv, A347) or LF (the older trial exports under reference/taxprep/); a mixed
// file is refused, never repaired. Spec-writer owned: builders never edit this file.
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { lineEnds, taxprepBytes, toTaxprepBytes } from './__fixtures__/taxprep-bytes'

const repoUrl = (rel: string): URL => new URL(`../../${rel}`, import.meta.url)
const RT07 = 'reference/taxprep/2026-10-02-day2/exports/rt-07-imported-default.csv'
const MAPLE = 'reference/sample-clients/01-maple-ridge/taxprep/import.csv'
const latin1 = (s: string): Buffer => Buffer.from(s, 'latin1')

describe('W00 round 2: Taxprep bytes from committed CSVs, whatever their stored line ends (RT-3, ARC-14)', () => {
  test('RT-3 a file stored CRLF (the sample client 01 import, -text) is returned byte for byte as stored', () => {
    const raw = readFileSync(repoUrl(MAPLE))
    expect(lineEnds(raw, MAPLE)).toBe('crlf')
    const bytes = taxprepBytes(repoUrl(MAPLE), MAPLE)
    expect(bytes.equals(raw)).toBe(true)
  })

  test('RT-3 a file stored LF (the trial export rt-07) gets CRLF on every line and nothing else changes', () => {
    const raw = readFileSync(repoUrl(RT07))
    expect(lineEnds(raw, RT07)).toBe('lf')
    const bytes = taxprepBytes(repoUrl(RT07), RT07)
    const lfCount = raw.filter((b) => b === 0x0a).length
    expect(lfCount).toBeGreaterThan(0)
    expect(bytes.length).toBe(raw.length + lfCount)
    expect(lineEnds(bytes, RT07)).toBe('crlf')
    expect(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1').equals(raw)).toBe(true)
  })

  test('RT-3 both stored forms of the same text give the same Taxprep bytes', () => {
    const crlf = latin1('"A (Test)|0|0|g"\r\n"IFirm.ContactPartner","x"\r\n')
    const lf = latin1('"A (Test)|0|0|g"\n"IFirm.ContactPartner","x"\n')
    expect(toTaxprepBytes(crlf, 'crlf').equals(crlf)).toBe(true)
    expect(toTaxprepBytes(lf, 'lf').equals(crlf)).toBe(true)
  })

  test('RT-3 a planted file with mixed line ends is refused, naming the file, never repaired', () => {
    const mixed = latin1('"A (Test)|0|0|g"\r\n"IFirm.ContactPartner","x"\n')
    expect(() => toTaxprepBytes(mixed, 'planted-mixed.csv')).toThrow(/planted-mixed\.csv.*mixed/)
    const fromMaple = Buffer.concat([readFileSync(repoUrl(MAPLE)), latin1('"IFirm.ContactPartner","x"\n')])
    expect(() => toTaxprepBytes(fromMaple, MAPLE)).toThrow(/mixed/)
  })

  test('RT-3 a CR that does not end a line is refused, naming the file', () => {
    expect(() => toTaxprepBytes(latin1('"a"\r"b"\r\n'), 'stray-cr.csv')).toThrow(/stray-cr\.csv/)
  })
})
