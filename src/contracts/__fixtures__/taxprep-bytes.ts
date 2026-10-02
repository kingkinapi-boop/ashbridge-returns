// Test fixture (spec-writer owned; W00 round 2, findings W00 r1 S1): the bytes Taxprep wrote, from a committed CSV.
//
// Taxprep writes CRLF line ends. A committed CSV is either stored as is (`-text` in .gitattributes, so its
// CRLF bytes are in git: reference/sample-clients/**/taxprep/*.csv, A347) or stored LF by `* text=auto eol=lf`
// (the older trial exports under reference/taxprep/). This helper returns Taxprep's bytes either way:
//   - every line end already CRLF: the bytes as stored, unchanged;
//   - every line end LF only: each LF becomes CRLF;
//   - a mix of the two, or a CR that does not end a line: refused, naming the file (never repaired).
// S00's harness adopts the same helper next round, so every reader of these files agrees on their bytes.
import { readFileSync } from 'node:fs'

export type LineEnds = 'crlf' | 'lf' | 'none'

/** The line ends a byte buffer holds; throws, naming `label`, on a mix or on a stray CR. */
export function lineEnds(raw: Uint8Array, label: string): LineEnds {
  let crlf = 0
  let lf = 0
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i]
    if (b === 0x0d) {
      if (raw[i + 1] !== 0x0a) throw new Error(`${label}: a CR at byte ${String(i)} does not end a line`)
      crlf++
      i++
    } else if (b === 0x0a) {
      lf++
    }
  }
  if (crlf > 0 && lf > 0) throw new Error(`${label}: mixed line ends (${String(crlf)} CRLF, ${String(lf)} LF only)`)
  return crlf > 0 ? 'crlf' : lf > 0 ? 'lf' : 'none'
}

/** Taxprep's CRLF bytes from the bytes as committed (see the header). */
export function toTaxprepBytes(raw: Uint8Array, label: string): Buffer {
  const ends = lineEnds(raw, label)
  const buf = Buffer.from(raw)
  if (ends !== 'lf') return buf
  return Buffer.from(buf.toString('latin1').replace(/\n/g, '\r\n'), 'latin1')
}

/** Reads a committed CSV and returns Taxprep's CRLF bytes (see the header). */
export function taxprepBytes(file: URL | string, label: string = String(file)): Buffer {
  return toTaxprepBytes(readFileSync(file), label)
}
