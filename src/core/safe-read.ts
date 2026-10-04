// @mutate
// One safe way to read a file another process may have planted (ARC-22): look first, open only a regular
// file with one link and no link followed, check the opened descriptor is the file that was looked at, read at
// most maxBytes + 1 bytes. A reason is one of four words, never content or a path.
import fs from 'node:fs'

export type SafeRead = { ok: true; text: string } | { ok: false; reason: 'not-a-file' | 'too-big' | 'gone' | 'many-links' }

export function readRegularFile(file: string, maxBytes: number): SafeRead {
  let looked: fs.Stats
  try {
    looked = fs.lstatSync(file)
  } catch {
    return { ok: false, reason: 'gone' }
  }
  if (!looked.isFile()) return { ok: false, reason: 'not-a-file' }
  if (looked.nlink > 1) return { ok: false, reason: 'many-links' }
  // O_NONBLOCK so an open can never wait on a writer, O_NOFOLLOW so a link swapped in after the look is refused (both where the platform defines them)
  const constants = fs.constants as Readonly<Record<string, number | undefined>>
  const nonBlock = constants['O_NONBLOCK'] ?? 0
  const noFollow = constants['O_NOFOLLOW'] ?? 0
  let fd: number
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | nonBlock | noFollow)
  } catch (e) {
    return { ok: false, reason: (e as NodeJS.ErrnoException).code === 'ELOOP' ? 'not-a-file' : 'gone' }
  }
  try {
    const opened = fs.fstatSync(fd)
    if (opened.dev !== looked.dev || opened.ino !== looked.ino) return { ok: false, reason: 'gone' }
    if (!opened.isFile()) return { ok: false, reason: 'not-a-file' }
    if (opened.nlink > 1) return { ok: false, reason: 'many-links' }
    const buffer = Buffer.alloc(maxBytes + 1)
    let total = 0
    while (total < buffer.length) {
      const n = fs.readSync(fd, buffer, total, buffer.length - total, null)
      if (n === 0) break
      total += n
    }
    if (total > maxBytes) return { ok: false, reason: 'too-big' }
    return { ok: true, text: new TextDecoder().decode(buffer.subarray(0, total)) }
  } finally {
    fs.closeSync(fd)
  }
}
