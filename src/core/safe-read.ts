// @mutate
// One safe way to read a file another process may have planted (ARC-22): look first, open only a regular
// file, check the opened descriptor is the file that was looked at, read at most maxBytes + 1 bytes.
// A reason is one of three words, never content or a path.
import fs from 'node:fs'

export type SafeRead = { ok: true; text: string } | { ok: false; reason: 'not-a-file' | 'too-big' | 'gone' }

const GONE: SafeRead = { ok: false, reason: 'gone' }
const NOT_A_FILE: SafeRead = { ok: false, reason: 'not-a-file' }
const TOO_BIG: SafeRead = { ok: false, reason: 'too-big' }

/** O_NONBLOCK where the platform defines it, so an open can never wait on a writer. */
const NON_BLOCK: number = (fs.constants as Readonly<Record<string, number | undefined>>)['O_NONBLOCK'] ?? 0

export function readRegularFile(file: string, maxBytes: number): SafeRead {
  let looked: fs.Stats
  try {
    looked = fs.lstatSync(file)
  } catch {
    return GONE
  }
  if (!looked.isFile()) return NOT_A_FILE
  let fd: number
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | NON_BLOCK)
  } catch {
    return GONE
  }
  try {
    const opened = fs.fstatSync(fd)
    if (opened.dev !== looked.dev || opened.ino !== looked.ino) return GONE
    if (!opened.isFile()) return NOT_A_FILE
    const buffer = Buffer.alloc(maxBytes + 1)
    let total = 0
    while (total < buffer.length) {
      const n = fs.readSync(fd, buffer, total, buffer.length - total, null)
      if (n === 0) break
      total += n
    }
    if (total > maxBytes) return TOO_BIG
    return { ok: true, text: new TextDecoder().decode(buffer.subarray(0, total)) }
  } finally {
    fs.closeSync(fd)
  }
}
