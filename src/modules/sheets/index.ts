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
/** The compound file header Excel uses for old .xls files and for password-protected workbooks. */
const COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
/** "EncryptedPackage" in UTF-16LE: the stream name inside a password-protected workbook. */
const ENCRYPTED_STREAM = Buffer.from('EncryptedPackage', 'utf16le')

const startsWith = (bytes: Uint8Array, magic: number[]): boolean => magic.every((b, i) => bytes[i] === b)
/** A zip container starts with a local file header ("PK\x03\x04") or, when empty, the end record ("PK\x05\x06"). Text that only starts "PK" is not one. */
const ZIP_HEADERS = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
]
const isZip = (bytes: Uint8Array): boolean => ZIP_HEADERS.some((magic) => startsWith(bytes, magic))
/** Any bytes that start "PK" under a name that is not a CSV name are taken for a workbook, so a damaged one says "not a workbook". */
const startsPK = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b
const CSV_NAME = /\.(?:csv|tsv|txt)$/i

/** The one way these bytes are read (numbers, so the cache key needs no label). */
const ROUTE = { compound: 0, zip: 1, csv: 2, unsupported: 3 } as const
type Route = (typeof ROUTE)[keyof typeof ROUTE]

/** A container is judged by its bytes under every name; only bytes that are not a container go by the name. */
function routeOf(bytes: Uint8Array, fileName: string): Route {
  if (startsWith(bytes, COMPOUND)) return ROUTE.compound
  if (isZip(bytes)) return ROUTE.zip
  if (CSV_NAME.test(fileName)) return ROUTE.csv
  return startsPK(bytes) ? ROUTE.zip : ROUTE.unsupported
}

async function build(bytes: Uint8Array, route: Route, fingerprint: string): Promise<SheetsOutcome> {
  if (route === ROUTE.compound) {
    const encrypted = Buffer.from(bytes).includes(ENCRYPTED_STREAM)
    return { ok: false, reason: encrypted ? 'password-protected' : 'old .xls format' }
  }
  const stamp = { fileFingerprint: fingerprint, readAt: now().toISOString() }
  if (route === ROUTE.csv) {
    const read = readCsv(bytes)
    if (!read.ok) return read
    const sheets = [{ name: 'csv', hidden: false, hiddenRows: [], hiddenColumns: [], cells: read.cells }]
    return { ok: true, result: SheetResultSchema.parse({ ...stamp, engine: CSV_ENGINE, encoding: read.encoding, separator: read.separator, sheets }) }
  }
  if (route === ROUTE.unsupported) return { ok: false, reason: 'unsupported file type' }
  const read = await readXlsx(bytes)
  if (!read.ok) return read
  const engine = { name: XLSX_LIBRARY.name, version: XLSX_LIBRARY.version }
  return { ok: true, result: SheetResultSchema.parse({ ...stamp, engine, sheets: read.sheets }) }
}

export function createSheetsReader(): SheetsReader {
  const cache = new Map<string, SheetsOutcome>()
  return {
    name: 'sheets',
    isLive: false,
    async read(bytes, fileName) {
      const fingerprint = crypto.createHash('sha256').update(bytes).digest('hex')
      const route = routeOf(bytes, fileName)
      const key = `${fingerprint}:${String(route)}`
      const cached = cache.get(key)
      if (cached) return structuredClone(cached)
      const outcome = await build(bytes, route, fingerprint)
      // A refusal is remembered too: the same bytes are refused for the same reason. Every caller gets its own copy.
      cache.set(key, structuredClone(outcome))
      return outcome
    },
  }
}
