// @mutate
// The Taxprep CSV contract (F03): the one parser and the one writer for Taxprep's CSV files.
// Follows reference/taxprep/FINDINGS.md (release CCH iFirm 2026.20.198267), not CCH's help page.
// Amounts are whole-dollar integers (RT-25): no float arithmetic is done on them, only integer checks and String().

// ---------- constants ----------

/** The fixed settings of RT-9: the Export dialog's defaults, and the shape of every file we read or write. */
export const TAXPREP_SETTINGS = {
  separator: ',',
  negatives: '-123',
  decimal: '.',
  thousands: 'none',
  encoding: 'windows-1252',
  lineEnd: '\r\n',
  quoteValues: true,
  byteOrderMark: false,
} as const

/** Cells Taxprep skips on import without a report line (RT-13), each with the finding it rests on. */
export const IGNORED_ON_IMPORT: readonly {
  readonly identifier: string
  readonly finding: string
}[] = [
  {
    identifier: 'IDENT.Ident120',
    finding:
      'FINDINGS.md, silent skips (item 5): the year-start cell (line 060) is skipped on import with no report line',
  },
  {
    identifier: 'IDENT.Ident121',
    finding:
      'FINDINGS.md, silent skips (item 5): the year-end cell (line 061) is skipped on import with no report line',
  },
  {
    identifier: 'IDENT.Ident311',
    finding:
      'FINDINGS.md, silent skips: the contact-synchronised name cell was not changed by an import, nothing reported',
  },
  {
    identifier: 'IDENT.Ident492',
    finding: 'FINDINGS.md, silent skips: skipped like the contact cells, the reason is unknown (still open)',
  },
]

/** The six cell classes of RT-14. */
export const CELL_CLASSES = ['traced', 'overridden', 'dropped', 'rolled-forward', 'orphan', 'calculated'] as const
export type CellClass = (typeof CELL_CLASSES)[number]
export function isCellClass(value: unknown): value is CellClass {
  return (CELL_CLASSES as readonly unknown[]).includes(value)
}

/** RT-7: for each repeating group path, the cell under the copy that holds the row's natural key. */
export type NaturalKeyRegistry = Readonly<Record<string, string>>
export const NATURAL_KEYS: NaturalKeyRegistry = Object.freeze({
  'CCACat.FD08C': 'FED.Ttw08cA1',
})

// ---------- Windows-1252 ----------

const CP1252_HIGH: readonly number[] = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d,
  0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d,
  0x017e, 0x0178,
]
/** Code points that cp1252 leaves undefined in 0x80 to 0x9F (kept as themselves when reading, refused when writing). */
const CP1252_UNDEFINED = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d])
const FROM_UNICODE = new Map<number, number>()
const TO_UNICODE = new Map<number, number>()
CP1252_HIGH.forEach((cp, i) => {
  TO_UNICODE.set(0x80 + i, cp)
  if (!CP1252_UNDEFINED.has(cp)) FROM_UNICODE.set(cp, 0x80 + i)
})

/** A byte-faithful string (one char per byte) to real text. */
function decode1252(raw: string): string {
  return Array.from(raw, (ch) => {
    const c = ch.charCodeAt(0)
    return String.fromCharCode(TO_UNICODE.get(c) ?? c)
  }).join('')
}

/** One character to its Windows-1252 byte, or null when it has none (or is a control character). */
function byteFor1252(cp: number): number | null {
  if (cp < 0x20 || cp === 0x7f) return null
  if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) return cp
  return FROM_UNICODE.get(cp) ?? null
}

function bytesToLatin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('')
}

// ---------- the identifier grammar (RT-21) ----------

declare const cellIdBrand: unique symbol
export type CellId = {
  readonly text: string
  readonly copyPath: string | null
  readonly copyIndex: number | null
  readonly [cellIdBrand]: true
}

const PART = /^([A-Z][A-Za-z0-9]*)(?:\[([^\]]*)\])?$/

export function parseCellId(text: string): { ok: true; id: CellId } | { ok: false; reason: string } {
  const refuse = (why: string) => ({
    ok: false as const,
    reason: `identifier "${text}" is refused: ${why}`,
  })
  if (text === '') return refuse('it is empty')
  if (/\s/.test(text)) return refuse('it holds a space')
  const parts = text.split('.')
  if (parts.length < 2) return refuse('it needs two or more parts separated by dots')
  let copyPath: string | null = null
  let copyIndex: number | null = null
  const names: string[] = []
  for (const part of parts) {
    const m = PART.exec(part)
    if (m === null) {
      return refuse(
        part === ''
          ? 'it has an empty part'
          : `part "${part}" must be capital-letter first, then letters and digits, with an optional [n] copy index`,
      )
    }
    names.push(m[1] as string)
    if (m[2] !== undefined) {
      if (copyIndex !== null) return refuse('it has more than one copy index')
      if (!/^[1-9]\d*$/.test(m[2]) || !Number.isSafeInteger(Number(m[2]))) {
        return refuse(`the copy index [${m[2]}] must be a whole number from 1`)
      }
      copyIndex = Number(m[2])
      copyPath = names.join('.')
    }
  }
  const id = { text, copyPath, copyIndex } as CellId
  return { ok: true, id }
}

/** The same identifier with another copy index. Throws when it has no copy index or n is not a whole number from 1. */
export function withCopyIndex(id: CellId, n: number): CellId {
  if (id.copyIndex === null) throw new Error(`identifier "${id.text}" has no copy index`)
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`copy index ${String(n)} must be a whole number from 1`)
  return { ...id, text: id.text.replace(`[${String(id.copyIndex)}]`, `[${String(n)}]`), copyIndex: n }
}

// ---------- reading ----------

export type CellValue = { kind: 'clear' } | { kind: 'value'; text: string }
export type RowShape = 'current-only' | 'standard' | 'extra-columns'
export type ParsedRow = {
  line: number
  id: CellId
  current: CellValue
  last: CellValue | null
  description: string | null
  shape: RowShape
  apostrophe: boolean
}
export type TaxprepHeader = { returnName: string; guid: string }
export type TaxprepFaultCode =
  | 'bom'
  | 'line-ends'
  | 'separator'
  | 'unquoted'
  | 'negative-parens'
  | 'thousands'
  | 'decimal-comma'
  | 'scientific'
  | 'date-format'
  | 'utf8'
  | 'header'
  | 'identifier'
  | 'apostrophe'
export type TaxprepFault = {
  code: TaxprepFaultCode
  reason: string
  line: number | null
}

const WRONG_SEPARATORS = new Set(['\t', ';', ' '])

function classifyValue(
  raw: string,
): { ok: true; value: CellValue; apostrophe: boolean } | { ok: false; code: TaxprepFaultCode; reason: string } {
  const shown = JSON.stringify(decode1252(raw))
  if (raw === '' || raw === ' ') return { ok: true, value: { kind: 'clear' }, apostrophe: false }
  if (raw.startsWith("'") || (raw.includes("'") && /^-?\d+$/.test(raw.replace(/'/g, '')))) {
    if (/^'-[1-9]\d*$/.test(raw)) {
      return {
        ok: true,
        value: { kind: 'value', text: raw.slice(1) },
        apostrophe: true,
      }
    }
    return {
      ok: false,
      code: 'apostrophe',
      reason: `the value ${shown} has an apostrophe that is not the single one Taxprep puts before a negative number`,
    }
  }
  if (/^\(\s*-?[\d.,]+\s*\)$/.test(raw)) {
    return {
      ok: false,
      code: 'negative-parens',
      reason: `the value ${shown} is a negative written in brackets; Taxprep's file uses -123`,
    }
  }
  if (/^-?\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?$/.test(raw)) {
    return {
      ok: false,
      code: 'thousands',
      reason: `the value ${shown} has a thousands separator; numbers carry no separators`,
    }
  }
  if (/^-?\d+,\d+$/.test(raw)) {
    return {
      ok: false,
      code: 'decimal-comma',
      reason: `the value ${shown} uses a decimal comma; the decimal mark is a point`,
    }
  }
  if (/^-?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(raw)) {
    return {
      ok: false,
      code: 'scientific',
      reason: `the value ${shown} is in scientific notation; numbers are written in full`,
    }
  }
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(raw) || /^\d{4}[/.]\d{1,2}[/.]\d{1,2}$/.test(raw)) {
    return {
      ok: false,
      code: 'date-format',
      reason: `the value ${shown} is a reformatted date; dates are YYYY-MM-DD`,
    }
  }
  return {
    ok: true,
    value: { kind: 'value', text: decode1252(raw) },
    apostrophe: false,
  }
}

type Tokens = { ok: true; fields: string[] } | { ok: false; code: TaxprepFaultCode; reason: string }

/** Splits the part of a row after the identifier's comma into quoted fields. */
function tokenize(rest: string): Tokens {
  const fields: string[] = []
  let pos = 0
  for (;;) {
    if (rest[pos] !== '"') {
      const shown = JSON.stringify(
        decode1252(rest.slice(pos, rest.indexOf(',', pos) < 0 ? undefined : rest.indexOf(',', pos))),
      )
      return {
        ok: false,
        code: 'unquoted',
        reason: `a value ${shown} is not in double quotes; every value is quoted`,
      }
    }
    const start = pos + 1
    let close = start - 1
    for (;;) {
      close = rest.indexOf('"', close + 1)
      if (close === -1) return { ok: false, code: 'unquoted', reason: 'a quoted value is not closed' }
      // a doubled quote inside a value is one quote: step over both and look for the real closing quote
      if (rest.charAt(close + 1) !== '"') break
      close += 1
    }
    fields.push(rest.slice(start, close).replace(/""/g, '"'))
    pos = close + 1
    if (pos >= rest.length) return { ok: true, fields }
    const next = rest.charAt(pos)
    if (next === ',') {
      pos += 1
      continue
    }
    if (WRONG_SEPARATORS.has(next)) {
      return {
        ok: false,
        code: 'separator',
        reason: `values are separated by ${JSON.stringify(next)}; the separator is a comma`,
      }
    }
    return {
      ok: false,
      code: 'unquoted',
      reason: 'text follows a closing quote',
    }
  }
}

export function parseTaxprepCsv(
  bytes: Uint8Array,
): { ok: true; file: { header: TaxprepHeader; rows: ParsedRow[] } } | { ok: false; faults: TaxprepFault[] } {
  const faults: TaxprepFault[] = []
  let raw = bytesToLatin1(bytes)
  if (raw.startsWith('\xef\xbb\xbf')) {
    faults.push({
      code: 'bom',
      reason: 'the file starts with a byte-order mark; Taxprep writes none',
      line: null,
    })
    raw = raw.slice(3)
  }
  const lineAt = (offset: number): number => raw.slice(0, offset).split('\n').length
  const utf8 = /[\xc2-\xdf][\x80-\xbf]|[\xe0-\xef][\x80-\xbf]{2}|[\xf0-\xf4][\x80-\xbf]{3}/.exec(raw)
  if (utf8 !== null) {
    faults.push({
      code: 'utf8',
      reason:
        'the file holds UTF-8 byte sequences (an accent written as two bytes); Taxprep writes Windows-1252, one byte per letter',
      line: lineAt(utf8.index),
    })
  }
  if (/(?<!\r)\n/.test(raw) || /\r(?!\n)/.test(raw) || !raw.endsWith('\r\n')) {
    faults.push({
      code: 'line-ends',
      reason: 'every line, the last included, must end in CR LF',
      line: null,
    })
  }
  const lines = raw.split(/\r\n|\n/)
  if (lines[lines.length - 1] === '') lines.pop()

  // header
  const headerLine = lines.slice(0, 1).toString()
  let header: TaxprepHeader | null = null
  const hm = /^\[(.*)\|([^|]*)\|([^|]*)\|([^|\]]*)\]/.exec(headerLine)
  if (hm === null) {
    faults.push({
      code: 'header',
      reason: 'the first line must be the header in square brackets: [name|0|0|GUID]',
      line: 1,
    })
  } else {
    header = { returnName: decode1252(hm[1] as string), guid: hm[4] as string }
    const rest = headerLine.slice(hm[0].length)
    if (WRONG_SEPARATORS.has(rest.charAt(0))) {
      faults.push({
        code: 'separator',
        reason: `the header uses ${JSON.stringify(rest.charAt(0))} as a separator; it is a comma`,
        line: 1,
      })
    } else if (!/^,"[^"]*","[^"]*",""$/.test(rest)) {
      faults.push({
        code: 'header',
        reason: 'the header line must end with the quoted column names "Current Year","Last Year",""',
        line: 1,
      })
    }
  }

  // rows
  const rows: ParsedRow[] = []
  rowLoop: for (let i = 1; i < lines.length; i++) {
    const line = i + 1
    const text = lines[i] as string
    const cut = text.search(/[,\t; "]/)
    const idText = cut < 0 ? text : text.slice(0, cut)
    const sep = text.charAt(idText.length)
    const idResult = parseCellId(decode1252(idText))
    if (!idResult.ok) {
      faults.push({ code: 'identifier', reason: idResult.reason, line })
      continue
    }
    if (WRONG_SEPARATORS.has(sep)) {
      faults.push({
        code: 'separator',
        reason: `values are separated by ${JSON.stringify(sep)}; the separator is a comma`,
        line,
      })
      continue
    }
    if (sep !== ',') {
      faults.push({
        code: 'unquoted',
        reason: 'the row has no value after its identifier',
        line,
      })
      continue
    }
    const tokens = tokenize(text.slice(idText.length + 1))
    if (!tokens.ok) {
      faults.push({
        code: tokens.code,
        reason: `${tokens.reason} (${idResult.id.text})`,
        line,
      })
      continue
    }
    const n = tokens.fields.length
    let apostrophe = false
    const values: CellValue[] = []
    for (const f of tokens.fields.slice(0, 2)) {
      const c = classifyValue(f)
      if (!c.ok) {
        faults.push({
          code: c.code,
          reason: `${c.reason} (${idResult.id.text})`,
          line,
        })
        continue rowLoop
      }
      apostrophe = apostrophe || c.apostrophe
      values.push(c.value)
    }
    const description = tokens.fields[2]
    rows.push({
      line,
      id: idResult.id,
      current: values[0] as CellValue,
      last: values[1] ?? null,
      description: description === undefined ? null : decode1252(description),
      shape: n > 3 ? 'extra-columns' : n === 3 ? 'standard' : 'current-only',
      apostrophe,
    })
  }
  if (faults.length > 0) return { ok: false, faults }
  return { ok: true, file: { header: header as TaxprepHeader, rows } }
}

// ---------- natural keys (RT-7) ----------

/** Maps each natural key (for example the CCA class) to the copy index it sits in now. */
export function copiesByNaturalKey(
  rows: readonly ParsedRow[],
  copyPath: string,
  registry: NaturalKeyRegistry = NATURAL_KEYS,
): { ok: true; copies: ReadonlyMap<string, number> } | { ok: false; reason: string } {
  const keyCell = registry[copyPath]
  if (keyCell === undefined) {
    return {
      ok: false,
      reason: `no natural-key cell is registered for the copy path ${copyPath}`,
    }
  }
  const copies = new Map<string, number>()
  for (const row of rows) {
    if (row.id.copyPath !== copyPath) continue
    const copyIndex = row.id.copyIndex as number
    if (row.id.text.replace(`[${String(copyIndex)}]`, '') !== `${copyPath}.${keyCell}`) continue
    if (row.current.kind !== 'value') continue
    const key = row.current.text
    const seen = copies.get(key)
    if (seen !== undefined && seen !== copyIndex) {
      return {
        ok: false,
        reason: `duplicate natural key ${key} under ${copyPath}: copies ${String(seen)} and ${String(copyIndex)}`,
      }
    }
    copies.set(key, copyIndex)
  }
  return { ok: true, copies }
}

// ---------- writing ----------

export type WriteValue =
  | { kind: 'amount'; amount: number }
  | { kind: 'text'; text: string }
  | { kind: 'date'; date: string }
  | { kind: 'yesNo'; yes: boolean }
  | { kind: 'rate'; rate: number }
  | { kind: 'clear' }
export type WriteRow = {
  id: CellId
  current: WriteValue
  last?: WriteValue
  description?: string
}
export type WriteProblem = {
  index: number
  identifier: string
  reason: string
  character?: string
}

class Refusal extends Error {
  constructor(
    message: string,
    readonly character?: string,
  ) {
    super(message)
  }
}

/** Text to Windows-1252 bytes (as a latin1 string), refusing the first character it cannot hold. */
function encode1252(text: string, what: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    const b = byteFor1252(cp)
    if (b === null) throw new Refusal(`${what} holds the character ${ch}, which Windows-1252 cannot write`, ch)
    out += String.fromCharCode(b)
  }
  return out
}

function validDate(s: string): boolean {
  const [y, mo, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y as number, (mo as number) - 1, d))
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s
}

/** A value to its cell text (as a latin1 string), or a Refusal. */
function formatValue(v: WriteValue): string {
  switch (v.kind) {
    case 'clear':
      return ''
    case 'amount': {
      if (!Number.isFinite(v.amount)) throw new Refusal(`the amount ${String(v.amount)} is not a number`)
      if (!Number.isInteger(v.amount))
        throw new Refusal(`the amount ${String(v.amount)} has cents; amounts are whole dollars`)
      if (!Number.isSafeInteger(v.amount)) throw new Refusal(`the amount ${String(v.amount)} is too large to be exact`)
      return String(v.amount)
    }
    case 'text': {
      if (v.text.trim() === '') throw new Refusal('a blank text value would be read as a clear; use the explicit clear')
      if (v.text.startsWith("'")) throw new Refusal('a text value must not start with an apostrophe')
      const written = encode1252(v.text, 'the text value')
      const reread = classifyValue(written)
      if (!reread.ok) throw new Refusal(`the text value would be refused on reading: ${reread.reason}`)
      return written
    }
    case 'date':
      if (!validDate(v.date)) throw new Refusal(`the date ${v.date} is not a real date written YYYY-MM-DD`)
      return v.date
    case 'yesNo':
      return v.yes ? 'Y' : 'N'
    case 'rate': {
      if (!Number.isFinite(v.rate) || v.rate < 0)
        throw new Refusal(`the rate ${String(v.rate)} must be a number from 0`)
      const text = v.rate.toFixed(4)
      if (Number(text) !== Number(v.rate.toPrecision(12)))
        throw new Refusal(`the rate ${String(v.rate)} has more than 4 decimals`)
      return text
    }
  }
}

const quote = (s: string): string => `"${s.replace(/"/g, '""')}"`

/**
 * The bytes of a Taxprep file. 'import' refuses the cells Taxprep ignores on import (RT-13); 'export' writes the shape
 * Taxprep's export writes (for the simulator) and allows them. A clear is written only from an explicit `clear` value.
 */
export function writeTaxprepCsv(
  file: { header: TaxprepHeader; rows: readonly WriteRow[] },
  options: { purpose: 'import' | 'export' },
): { ok: true; bytes: Uint8Array } | { ok: false; problems: WriteProblem[] } {
  const problems: WriteProblem[] = []
  let out = ''
  try {
    const name = encode1252(file.header.returnName, 'the return name')
    if (/[|\]]/.test(name) || /[|\]]/.test(file.header.guid) || !/^[\x20-\x7e]*$/.test(file.header.guid)) {
      throw new Refusal('the header must not hold | or ] and the GUID must be plain ASCII')
    }
    out += `[${name}|0|0|${file.header.guid}],"Current Year","Last Year",""\r\n`
  } catch (e) {
    problems.push({
      index: -1,
      identifier: 'header',
      reason: e instanceof Error ? e.message : String(e),
    })
  }
  const ignored = new Set(IGNORED_ON_IMPORT.map((e) => e.identifier))
  file.rows.forEach((row, index) => {
    try {
      const identifier = row.id.text
      if (!parseCellId(identifier).ok) throw new Refusal(`${JSON.stringify(identifier)} is not a valid cell identifier`)
      if (options.purpose === 'import' && ignored.has(identifier)) {
        throw new Refusal(`${identifier} is skipped by Taxprep on import, so no row may be written for it`)
      }
      const cur = formatValue(row.current)
      const last = row.last === undefined ? '' : formatValue(row.last)
      const desc = row.description === undefined ? '' : encode1252(row.description, 'the description')
      out += `${identifier},${quote(cur)},${quote(last)},${quote(desc)}\r\n`
    } catch (e) {
      if (!(e instanceof Refusal)) throw e
      const p: WriteProblem = {
        index,
        identifier: row.id.text,
        reason: `${row.id.text}: ${e.message}`,
      }
      if (e.character !== undefined) p.character = e.character
      problems.push(p)
    }
  })
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, bytes: Uint8Array.from(out, (ch) => ch.charCodeAt(0)) }
}
