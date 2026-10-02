// @mutate
// The spreadsheet and CSV reading adapter (A07, ARC-6 shape, EV-14): one reader for .csv and .xlsx, local work with
// no live side. Same bytes, same result (the fingerprint cache, as A01's ARC-11 rule).
import crypto from 'node:crypto'
import { now } from '../../core/clock'
import { SheetResultSchema, type SheetResult } from '../../contracts/sheets'
import { readCsv } from './csv/index'
import { XLSX_LIBRARY, readXlsx } from './xlsx/index'

export type SheetsOutcome = { ok: true; result: SheetResult } | { ok: false; reason: string }

export interface SheetsReader {
  name: string
  isLive: boolean
  read(fileBytes: Uint8Array, fileName: string): Promise<SheetsOutcome>
}

const CSV_ENGINE = { name: 'ashbridge-csv', version: '1.0.0' }
const ZIP = [0x50, 0x4b]
/** The compound file header Excel uses for old .xls files and for password-protected workbooks. */
const COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
/** "EncryptedPackage" in UTF-16LE: the stream name inside a password-protected workbook. */
const ENCRYPTED_STREAM = Buffer.from('EncryptedPackage', 'utf16le')

const startsWith = (bytes: Uint8Array, magic: number[]): boolean => magic.every((b, i) => bytes[i] === b)
const CSV_NAME = /\.(?:csv|tsv|txt)$/i

async function build(bytes: Uint8Array, fileName: string, fingerprint: string): Promise<SheetsOutcome> {
  if (startsWith(bytes, COMPOUND)) {
    const encrypted = Buffer.from(bytes).includes(ENCRYPTED_STREAM)
    return { ok: false, reason: encrypted ? 'password-protected' : 'old .xls format' }
  }
  const stamp = { fileFingerprint: fingerprint, readAt: now().toISOString() }
  if (startsWith(bytes, ZIP)) {
    const read = await readXlsx(bytes)
    if (!read.ok) return read
    const engine = { name: XLSX_LIBRARY.name, version: XLSX_LIBRARY.version }
    return { ok: true, result: SheetResultSchema.parse({ ...stamp, engine, sheets: read.sheets }) }
  }
  if (CSV_NAME.test(fileName)) {
    const read = readCsv(bytes)
    if (!read.ok) return read
    const sheets = [{ name: 'csv', hidden: false, cells: read.cells }]
    return { ok: true, result: SheetResultSchema.parse({ ...stamp, engine: CSV_ENGINE, encoding: read.encoding, separator: read.separator, sheets }) }
  }
  return { ok: false, reason: `unsupported file type: ${fileName}` }
}

export function createSheetsReader(): SheetsReader {
  const cache = new Map<string, SheetsOutcome>()
  return {
    name: 'sheets',
    isLive: false,
    async read(bytes, fileName) {
      const fingerprint = crypto.createHash('sha256').update(bytes).digest('hex')
      const key = `${fingerprint}:${String(CSV_NAME.test(fileName))}`
      const cached = cache.get(key)
      if (cached) return cached
      const outcome = await build(bytes, fileName, fingerprint)
      // A refusal is remembered too: the same bytes are refused for the same reason.
      cache.set(key, outcome)
      return outcome
    },
  }
}
