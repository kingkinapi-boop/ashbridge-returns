// FX7 acceptance tests, Lead ruling A511 (2), 3 Oct: one reader. src/core/safe-read.ts gains a bytes form beside
// readRegularFile (regular files only, capped, binary safe), and the Drive stand-in reads PDFs through it (the storage
// side is proved in src/modules/storage/size-cap.acceptance.test.ts). Spec-writer's file; builders never edit it.
// Clauses: ARC-22 (the safe read of a planted file), ARC-6 and SEC-11 (the Drive stand-in reads only plain files).
// FIFO and symlink cases need Linux: on win32 they show as skipped by name.
//
// The shape these tests fix (spec choice, amber, FX7 A511 patch):
//   readRegularFileBytes(file: string, maxBytes: number):
//     { ok: true; bytes: Uint8Array } | { ok: false; reason: 'not-a-file' | 'too-big' | 'gone' }
//   Exactly readRegularFile's steps and refusals (lstat first, a link, folder or FIFO is 'not-a-file' and never opened;
//   a missing file is 'gone'; open read-only with O_NONBLOCK where defined; fstat on the descriptor, another dev or ino
//   is 'gone'; at most maxBytes + 1 bytes read; more than maxBytes is 'too-big'; the descriptor is always closed), but
//   the bytes come back exactly as on disk, never decoded. Synchronous. A reason is one of the three words.
//   readRegularFile keeps its shape; for the same file and cap both forms give the same refusal, and the text form's
//   text is the UTF-8 decoding of the bytes form's bytes.
// Every call goes through node:fs's default export, so the spies below see it. The module is loaded by name, so a
// missing export fails each test with its reason while typecheck stays green before the build.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type Refusal = { ok: false; reason: 'not-a-file' | 'too-big' | 'gone' }
type SafeReadBytes = { ok: true; bytes: Uint8Array } | Refusal
type SafeRead = { ok: true; text: string } | Refusal
interface SafeReadModule {
  readRegularFile: (file: string, maxBytes: number) => SafeRead
  readRegularFileBytes: (file: string, maxBytes: number) => SafeReadBytes
}

async function safeRead(): Promise<SafeReadModule> {
  const specifier = './safe-read'
  const mod = (await import(/* @vite-ignore */ specifier).catch(() => null)) as Partial<SafeReadModule> | null
  if (mod?.readRegularFileBytes === undefined) throw new Error('src/core/safe-read.ts does not export readRegularFileBytes yet (FX7, A511)')
  if (mod.readRegularFile === undefined) throw new Error('src/core/safe-read.ts lost readRegularFile (FX7, A511 keeps it)')
  return mod as SafeReadModule
}

const onWin32 = process.platform === 'win32'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fx7-safe-read-bytes-'))
})
afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})
const at = (name: string): string => path.join(dir, name)

/** Bytes that are not UTF-8: a lone continuation byte, an overlong form, a cut sequence, a BOM pair, a NUL. */
const NOT_UTF8 = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0xfe, 0x80, 0xc0, 0xaf, 0xc3, 0x28, 0xe2, 0x82, 0x00, 0x9f, 0xed, 0xa0, 0x80])
/** Every byte value once, 0x00 to 0xff. */
const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i)

function okBytes(got: SafeReadBytes): Uint8Array {
  expect(got.ok).toBe(true)
  if (!got.ok) throw new Error(`refused: ${got.reason}`)
  expect(got.bytes).toBeInstanceOf(Uint8Array)
  return got.bytes
}

/** Every path node:fs was asked to open or read whole, from now on. */
function watchOpens(): { paths: string[] } {
  const paths: string[] = []
  const note = (p: unknown): void => {
    if (typeof p === 'string') paths.push(path.resolve(p))
    else if (Buffer.isBuffer(p)) paths.push(path.resolve(p.toString('utf8')))
    else if (p instanceof URL) paths.push(path.resolve(p.pathname))
  }
  const openSync = fs.openSync.bind(fs)
  vi.spyOn(fs, 'openSync').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
    note(p)
    return (openSync as (...a: unknown[]) => number)(p, ...rest)
  }))
  const readFileSync = fs.readFileSync.bind(fs)
  vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown, ...rest: unknown[]) => {
    note(p)
    return (readFileSync as (...a: unknown[]) => unknown)(p, ...rest)
  }) as typeof fs.readFileSync)
  return { paths }
}

/** Descriptors opened and closed, the bytes read through fs.readSync, and the fds fstat was asked about. */
function watchDescriptors(): { opened: number[]; closed: number[]; fstatFds: number[]; bytesRead: () => number } {
  const opened: number[] = []
  const closed: number[] = []
  const fstatFds: number[] = []
  let bytes = 0
  const openSync = fs.openSync.bind(fs)
  vi.spyOn(fs, 'openSync').mockImplementation(((...a: unknown[]) => {
    const fd = (openSync as (...b: unknown[]) => number)(...a)
    opened.push(fd)
    return fd
  }))
  const closeSync = fs.closeSync.bind(fs)
  vi.spyOn(fs, 'closeSync').mockImplementation(((fd: number) => {
    closed.push(fd)
    closeSync(fd)
  }))
  const readSync = fs.readSync.bind(fs)
  vi.spyOn(fs, 'readSync').mockImplementation(((...a: unknown[]) => {
    const n = (readSync as (...b: unknown[]) => number)(...a)
    bytes += n
    return n
  }))
  const fstatSync = fs.fstatSync.bind(fs)
  vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number, o?: unknown) => {
    fstatFds.push(fd)
    return (fstatSync as (f: number, p?: unknown) => fs.Stats)(fd, o)
  }))
  return { opened, closed, fstatFds, bytesRead: () => bytes }
}

/** From now on fs.lstatSync reports `file` with one field changed (made before the spy, so it never calls itself). */
function pretendLstat(file: string, change: Partial<Pick<fs.Stats, 'dev' | 'ino'>>): void {
  const st = fs.lstatSync(file)
  const fake = Object.assign(Object.create(Object.getPrototypeOf(st) as object) as fs.Stats, st, change)
  const lstatSync = fs.lstatSync.bind(fs)
  vi.spyOn(fs, 'lstatSync').mockImplementation(((p: fs.PathLike, o?: unknown) =>
    path.resolve(String(p)) === path.resolve(file) ? fake : (lstatSync as (q: fs.PathLike, r?: unknown) => fs.Stats)(p, o)))
}

describe('ARC-22 readRegularFileBytes returns a regular file\'s bytes exactly, up to the cap (FX7, A511)', () => {
  test('ARC-22 non-UTF-8 bytes round-trip exactly (a text read cannot stand in)', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('a (Test).pdf'), NOT_UTF8)
    const bytes = okBytes(readRegularFileBytes(at('a (Test).pdf'), 1024))
    expect(Array.from(bytes)).toEqual(Array.from(NOT_UTF8))
  })

  test('ARC-22 every byte value 0x00 to 0xff comes back in order, and nothing more', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('all (Test).bin'), ALL_BYTES)
    const bytes = okBytes(readRegularFileBytes(at('all (Test).bin'), 256))
    expect(bytes.length).toBe(256)
    expect(Array.from(bytes)).toEqual(Array.from(ALL_BYTES))
  })

  test('ARC-22 the result is a value, never a promise', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('a.bin'), NOT_UTF8)
    const got: unknown = readRegularFileBytes(at('a.bin'), 1024)
    expect(got instanceof Promise).toBe(false)
  })

  test('ARC-22 planted: exactly maxBytes bytes are read; maxBytes + 1 is too-big, the same word the text form uses', async () => {
    const { readRegularFileBytes, readRegularFile } = await safeRead()
    fs.writeFileSync(at('ten.bin'), ALL_BYTES.subarray(246))
    fs.writeFileSync(at('eleven.bin'), ALL_BYTES.subarray(245))
    expect(Array.from(okBytes(readRegularFileBytes(at('ten.bin'), 10)))).toEqual(Array.from(ALL_BYTES.subarray(246)))
    expect(readRegularFileBytes(at('eleven.bin'), 10)).toEqual({ ok: false, reason: 'too-big' })
    expect(readRegularFileBytes(at('eleven.bin'), 10)).toEqual(readRegularFile(at('eleven.bin'), 10))
  })

  test('ARC-22 an empty file reads as no bytes even with a cap of 0; one byte over a cap of 0 is too-big', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('empty.bin'), '')
    fs.writeFileSync(at('one.bin'), Uint8Array.from([0xff]))
    expect(okBytes(readRegularFileBytes(at('empty.bin'), 0)).length).toBe(0)
    expect(readRegularFileBytes(at('one.bin'), 0)).toEqual({ ok: false, reason: 'too-big' })
  })

  test('ARC-22 a big file is never read whole: at most maxBytes + 1 bytes, never by readFileSync, one descriptor, closed', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('big.bin'), Buffer.alloc(1024 * 1024, 0xff))
    const whole = vi.spyOn(fs, 'readFileSync')
    const fds = watchDescriptors()
    expect(readRegularFileBytes(at('big.bin'), 10)).toEqual({ ok: false, reason: 'too-big' })
    expect(fds.opened).toHaveLength(1)
    expect(fds.bytesRead()).toBeGreaterThan(10)
    expect(fds.bytesRead()).toBeLessThanOrEqual(11)
    expect(fds.closed).toEqual(fds.opened)
    expect(whole).not.toHaveBeenCalled()
  })

  test('ARC-22 a file that grows past what fstat saw is still cut at maxBytes + 1', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('grows.bin'), Buffer.alloc(5, 0xfe))
    const fstatSync = fs.fstatSync.bind(fs)
    vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number, o?: unknown) => {
      const st = (fstatSync as (f: number, p?: unknown) => fs.Stats)(fd, o)
      fs.appendFileSync(at('grows.bin'), Buffer.alloc(20, 0xfd))
      return st
    }))
    let bytes = 0
    const readSync = fs.readSync.bind(fs)
    vi.spyOn(fs, 'readSync').mockImplementation(((...a: unknown[]) => {
      const n = (readSync as (...b: unknown[]) => number)(...a)
      bytes += n
      return n
    }))
    expect(readRegularFileBytes(at('grows.bin'), 10)).toEqual({ ok: false, reason: 'too-big' })
    expect(bytes).toBeLessThanOrEqual(11)
  })
})

describe('ARC-22 readRegularFileBytes refuses what readRegularFile refuses, the same way (FX7, A511)', () => {
  test('ARC-22 planted: a missing file is gone', async () => {
    const { readRegularFileBytes } = await safeRead()
    expect(readRegularFileBytes(at('missing.pdf'), 10)).toEqual({ ok: false, reason: 'gone' })
  })

  test('ARC-22 planted: a directory is not-a-file and is never opened', async () => {
    const { readRegularFileBytes, readRegularFile } = await safeRead()
    fs.mkdirSync(at('a-dir.pdf'))
    const opens = watchOpens()
    expect(readRegularFileBytes(at('a-dir.pdf'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(readRegularFile(at('a-dir.pdf'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(opens.paths).not.toContain(path.resolve(at('a-dir.pdf')))
  })

  test.skipIf(onWin32)('ARC-22 (Linux) planted: a symlink to a regular file is not-a-file; neither the link nor its target is opened', async () => {
    const { readRegularFileBytes } = await safeRead()
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fx7-safe-read-bytes-outside-'))
    try {
      const target = path.join(outside, 'secret (Test).pdf')
      fs.writeFileSync(target, NOT_UTF8)
      fs.symlinkSync(target, at('link.pdf'))
      const opens = watchOpens()
      expect(readRegularFileBytes(at('link.pdf'), 1024)).toEqual({ ok: false, reason: 'not-a-file' })
      expect(opens.paths).not.toContain(path.resolve(at('link.pdf')))
      expect(opens.paths).not.toContain(path.resolve(target))
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  test.skipIf(onWin32)('ARC-22 (Linux) planted: a FIFO is not-a-file at once and is never opened (an open would block)', async () => {
    const { readRegularFileBytes } = await safeRead()
    execFileSync('mkfifo', [at('pipe.pdf')], { timeout: 5000 })
    const opens = watchOpens()
    expect(readRegularFileBytes(at('pipe.pdf'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(opens.paths).not.toContain(path.resolve(at('pipe.pdf')))
  }, 30_000)

  test('ARC-22 the file is opened read-only, with O_NONBLOCK where the platform defines it', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('a.pdf'), NOT_UTF8)
    const flags: unknown[] = []
    const openSync = fs.openSync.bind(fs)
    vi.spyOn(fs, 'openSync').mockImplementation(((p: fs.PathLike, f?: unknown, m?: unknown) => {
      flags.push(f)
      return (openSync as (...a: unknown[]) => number)(p, f, m)
    }))
    okBytes(readRegularFileBytes(at('a.pdf'), 1024))
    expect(flags).toHaveLength(1)
    const n = flags[0] as number
    expect(typeof n).toBe('number')
    expect(n & (fs.constants.O_WRONLY | fs.constants.O_RDWR)).toBe(0)
    const nonBlock: unknown = (fs.constants as Readonly<Record<string, unknown>>)['O_NONBLOCK']
    if (typeof nonBlock === 'number') expect(n & nonBlock).toBe(nonBlock)
  })

  test('ARC-22 planted: a file swapped between the look and the open (another inode, or another device) is gone, found by fstat on the descriptor', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('a.pdf'), NOT_UTF8)
    fs.writeFileSync(at('b.pdf'), '')
    const real = fs.lstatSync(at('a.pdf'))
    for (const change of [{ ino: fs.lstatSync(at('b.pdf')).ino }, { dev: real.dev + 1 }]) {
      pretendLstat(at('a.pdf'), change)
      const fds = watchDescriptors()
      expect(readRegularFileBytes(at('a.pdf'), 1024)).toEqual({ ok: false, reason: 'gone' })
      expect(fds.opened).toHaveLength(1)
      expect(fds.fstatFds).toEqual(fds.opened)
      expect(fds.closed).toEqual(fds.opened)
      vi.restoreAllMocks()
    }
  })

  test('ARC-22 planted: a file removed between the look and the open is gone, and nothing is closed', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('a.pdf'), NOT_UTF8)
    vi.spyOn(fs, 'openSync').mockImplementation((() => {
      const e = new Error('ENOENT: planted') as NodeJS.ErrnoException
      e.code = 'ENOENT'
      throw e
    }))
    const close = vi.spyOn(fs, 'closeSync')
    expect(readRegularFileBytes(at('a.pdf'), 1024)).toEqual({ ok: false, reason: 'gone' })
    expect(close).not.toHaveBeenCalled()
  })

  test('ARC-22 planted: a descriptor that is not a regular file is not-a-file, closed, and nothing is read', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('a.pdf'), NOT_UTF8)
    const real = fs.fstatSync.bind(fs)
    vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number) => {
      const st = real(fd)
      return Object.assign(Object.create(Object.getPrototypeOf(st) as object) as fs.Stats, st, { isFile: () => false })
    }))
    const close = vi.spyOn(fs, 'closeSync')
    const read = vi.spyOn(fs, 'readSync')
    expect(readRegularFileBytes(at('a.pdf'), 1024)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(read).not.toHaveBeenCalled()
  })

  test('ARC-22 a refusal carries the reason word only: no path, no byte of content', async () => {
    const { readRegularFileBytes } = await safeRead()
    fs.writeFileSync(at('big (Test).pdf'), NOT_UTF8)
    fs.mkdirSync(at('dir (Test).pdf'))
    for (const [file, cap] of [[at('big (Test).pdf'), 3], [at('dir (Test).pdf'), 10], [at('none (Test).pdf'), 10]] as const) {
      const got = readRegularFileBytes(file, cap)
      expect(got.ok).toBe(false)
      expect(Object.keys(got).sort()).toEqual(['ok', 'reason'])
    }
  })

  test('ARC-22 property (seed 20261003): for any bytes and cap, the bytes form gives the bytes exactly or too-big, and the text form agrees', async () => {
    const { readRegularFileBytes, readRegularFile } = await safeRead()
    let n = 0
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), fc.integer({ min: 0, max: 80 }), (content, cap) => {
        const file = at(`p${String(n++)}.bin`)
        fs.writeFileSync(file, content)
        const bytes = readRegularFileBytes(file, cap)
        const text = readRegularFile(file, cap)
        if (content.length > cap) {
          expect(bytes).toEqual({ ok: false, reason: 'too-big' })
          expect(text).toEqual({ ok: false, reason: 'too-big' })
        } else {
          expect(Array.from(okBytes(bytes))).toEqual(Array.from(content))
          expect(text).toEqual({ ok: true, text: new TextDecoder().decode(content) })
        }
      }),
      { seed: 20261003, numRuns: 150 },
    )
  })
})

describe('ARC-22 one reader: the text form is the bytes form decoded (FX7, A511)', () => {
  test('ARC-22 for one file and cap, readRegularFile reads through the same steps: one open, one fstat, the same bytes read', async () => {
    const { readRegularFileBytes, readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{"name":"Café Érable (Test)"}')
    const a = watchDescriptors()
    const bytes = okBytes(readRegularFileBytes(at('a.json'), 1024))
    const viaBytes = { opened: a.opened.length, fstat: a.fstatFds.length, read: a.bytesRead() }
    vi.restoreAllMocks()
    const b = watchDescriptors()
    expect(readRegularFile(at('a.json'), 1024)).toEqual({ ok: true, text: new TextDecoder().decode(bytes) })
    expect({ opened: b.opened.length, fstat: b.fstatFds.length, read: b.bytesRead() }).toEqual(viaBytes)
  })
})
