// @mutate
// A small zip reader (A07C): the parts of a workbook as the file stores them, so the reader sees every cell's own stored text
// (ExcelJS drops a hyperlinked cell's formula and reads "12abc" as 12). Stored and deflated parts only; no network, no library.
import { inflateRawSync } from 'node:zlib'

export type Zip = { read(name: string): Buffer | undefined }

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const EOCD_SIZE = 22
const MAX_COMMENT = 0xffff
const STORED = 0
const DEFLATED = 8

type Entry = { method: number; size: number; offset: number }

/** The end-of-central-directory record, searched from the end (a comment may follow it). */
function findEnd(buf: Buffer): number {
  const lowest = Math.max(0, buf.length - EOCD_SIZE - MAX_COMMENT)
  for (let at = buf.length - EOCD_SIZE; at >= lowest; at--) if (buf.readUInt32LE(at) === EOCD_SIGNATURE) return at
  return -1
}

/** The central directory: each part's name, method, size and where it starts. */
function directory(buf: Buffer): Map<string, Entry> | undefined {
  const end = findEnd(buf)
  if (end < 0) return undefined
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  const entries = new Map<string, Entry>()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== CENTRAL_SIGNATURE) return undefined
    const nameLength = buf.readUInt16LE(at + 28)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLength)
    entries.set(name, { method: buf.readUInt16LE(at + 10), size: buf.readUInt32LE(at + 20), offset: buf.readUInt32LE(at + 42) })
    at += 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32)
  }
  return entries
}

/** The parts of a zip, or undefined when the bytes are not a well-formed zip (truncated, damaged, or an unsupported kind). */
export function openZip(bytes: Uint8Array): Zip | undefined {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const found: { entries: Map<string, Entry> | undefined } = { entries: new Map() }
  try {
    found.entries = directory(buf)
  } catch {
    // A directory that points outside the file is no directory.
    found.entries = undefined
  }
  const parts = found.entries
  if (!parts) return undefined
  return {
    read(name) {
      const entry = parts.get(name)
      if (!entry || buf.readUInt32LE(entry.offset) !== LOCAL_SIGNATURE) return undefined
      const start = entry.offset + 30 + buf.readUInt16LE(entry.offset + 26) + buf.readUInt16LE(entry.offset + 28)
      const data = buf.subarray(start, start + entry.size)
      if (data.length !== entry.size) return undefined
      if (entry.method === STORED) return data
      return entry.method === DEFLATED ? inflateRawSync(data) : undefined
    },
  }
}
