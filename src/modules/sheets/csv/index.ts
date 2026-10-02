// @mutate
// The CSV reader (A07, EV-14): RFC 4180 records, the encoding and the separator stated, every value kept as stored text.
import { columnLetter, type Cell } from '../../../contracts/sheets'

export type CsvEncoding = 'utf-8' | 'utf-8-bom' | 'windows-1252'
export type CsvSeparator = ',' | ';' | '\t'
export type CsvRead = { ok: true; encoding: CsvEncoding; separator: CsvSeparator; cells: Cell[] } | { ok: false; reason: string }

const BOM = [0xef, 0xbb, 0xbf]

function decode(bytes: Uint8Array): { text: string; encoding: CsvEncoding } {
  if (BOM.every((b, i) => bytes[i] === b)) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(BOM.length)), encoding: 'utf-8-bom' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' }
  }
}

const SEPARATORS: readonly CsvSeparator[] = [',', ';', '\t']

/** The first line's separator when it names exactly one kind outside quotes (every character outside quotes is collected, the separator list picks); otherwise a comma. */
function detectSeparator(text: string): CsvSeparator {
  const found = new Set<string>()
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted) found.add(ch)
  }
  const present = SEPARATORS.filter((s) => found.has(s))
  return present.length === 1 ? (present[0] as CsvSeparator) : ','
}

/** RFC 4180 records. A blank line is a record with one empty field; the end of the last line is not a record. */
export function parseCsv(text: string, separator: CsvSeparator): string[][] | { error: string } {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  let pending = false
  const endField = (): void => {
    record.push(field)
    field = ''
  }
  const endRecord = (): void => {
    endField()
    records.push(record)
    record = []
    pending = false
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    pending = true
    if (quoted) {
      if (ch !== '"') field += ch
      else if (text.charAt(i + 1) === '"') {
        field += '"'
        i++
      } else {
        quoted = false
      }
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === separator) endField()
    else if (ch === '\n') endRecord()
    else if (ch === '\r') {
      if (text.charAt(i + 1) === '\n') i++
      endRecord()
    } else field += ch
  }
  if (quoted) return { error: 'unterminated quoted value' }
  if (pending) endRecord()
  return records
}

export function readCsv(bytes: Uint8Array): CsvRead {
  const { text, encoding } = decode(bytes)
  const separator = detectSeparator(text)
  const records = parseCsv(text, separator)
  if ('error' in records) return { ok: false, reason: records.error }
  const cells: Cell[] = records.flatMap((fields, r) =>
    fields.map((value, c): Cell => ({
      row: r + 1,
      column: { letter: columnLetter(c + 1), number: c + 1 },
      text: value,
      type: value === '' ? 'empty' : 'text',
      hiddenRow: false,
      hiddenColumn: false,
      merged: null,
    })),
  )
  return { ok: true, encoding, separator, cells }
}
