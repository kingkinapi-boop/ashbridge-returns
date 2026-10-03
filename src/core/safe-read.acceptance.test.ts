// A04 round 5 acceptance tests: one safe way to read a file another process may have planted (spec-writer;
// builders never edit this file). reports/A04-findings-5.md fix 4 and "Tests to add"; reports/A04-spec-review-5.md G4
// (A456). Clause ARC-22 (the Claude project has no other way into Returns than its one result file).
// FIFO and symlink cases need Linux: on win32 they show as skipped by name, and the check quotes them passing on
// the cloud box.
//
// The shape these tests fix (src/core/safe-read.ts, `@mutate`):
//   readRegularFile(file: string, maxBytes: number):
//     { ok: true; text: string } | { ok: false; reason: 'not-a-file' | 'too-big' | 'gone' }
//   Synchronous. In order: fs.lstatSync (a link, folder, FIFO, socket or device is 'not-a-file', never opened; a
//   missing file is 'gone'); fs.openSync read-only, with O_NONBLOCK where the platform defines it; fs.fstatSync on the
//   descriptor (another dev or ino than the lstat saw is 'gone': the file was swapped; not a regular file is
//   'not-a-file'); fs.readSync reads at most maxBytes + 1 bytes in all, and more than maxBytes is 'too-big'; the
//   descriptor is always closed (fs.closeSync). The text is UTF-8. A reason is one of the three words, never content
//   or a path. Every call goes through node:fs's default export, so the spies below see it.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type SafeRead =
  | { ok: true; text: string }
  | { ok: false; reason: 'not-a-file' | 'too-big' | 'gone' }
interface SafeReadModule {
  readRegularFile: (file: string, maxBytes: number) => SafeRead
}

/** Loaded by name, so a missing module fails each test with this reason (typecheck stays green before the build). */
async function safeRead(): Promise<SafeReadModule> {
  const specifier = './safe-read'
  const mod = (await import(/* @vite-ignore */ specifier).catch(() => null)) as Partial<SafeReadModule> | null
  if (mod?.readRegularFile === undefined) throw new Error('src/core/safe-read.ts does not export readRegularFile yet (A04 round 5)')
  return mod as SafeReadModule
}

/** True on Windows, where the FIFO and symlink cases are skipped by name (they run on the Linux cloud box). */
const onWin32 = process.platform === 'win32'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-safe-read-'))
})
afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

const at = (name: string): string => path.join(dir, name)

function mkfifo(file: string): void {
  execFileSync('mkfifo', [file], { timeout: 5000 })
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
  vi.spyOn(fs, 'createReadStream').mockImplementation(((p: unknown) => {
    note(p)
    throw new Error('PLANTED: createReadStream is not how readRegularFile reads')
  }))
  return { paths }
}

/** Counts descriptors opened and closed, and the bytes read through fs.readSync. */
function watchDescriptors(): { opened: number[]; closed: number[]; bytesRead: () => number } {
  const opened: number[] = []
  const closed: number[] = []
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
  return { opened, closed, bytesRead: () => bytes }
}

/** G4: the descriptor openSync returned, every fd fstatSync was asked about, and how often a path stat was taken. */
function watchStats(): { fds: number[]; fstatFds: number[]; pathStats: () => number } {
  const fds: number[] = []
  const fstatFds: number[] = []
  let pathStats = 0
  const openSync = fs.openSync.bind(fs)
  vi.spyOn(fs, 'openSync').mockImplementation(((...a: unknown[]) => {
    const fd = (openSync as (...b: unknown[]) => number)(...a)
    fds.push(fd)
    return fd
  }))
  const fstatSync = fs.fstatSync.bind(fs)
  vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number, o?: unknown) => {
    fstatFds.push(fd)
    return (fstatSync as (f: number, p?: unknown) => fs.Stats)(fd, o)
  }))
  const statSync = fs.statSync.bind(fs)
  vi.spyOn(fs, 'statSync').mockImplementation(((...a: unknown[]) => {
    pathStats++
    return (statSync as (...b: unknown[]) => unknown)(...a)
  }) as typeof fs.statSync)
  return { fds, fstatFds, pathStats: () => pathStats }
}

/** G4: the swap was found by fstat on the opened descriptor, never by a second look at the path. */
function expectFstatOnTheDescriptor(w: ReturnType<typeof watchStats>): void {
  expect(w.fds).toHaveLength(1)
  expect(w.fstatFds).toEqual(w.fds)
  expect(w.pathStats()).toBe(0)
}

/** A copy of real stats with one field changed (the prototype keeps isFile() and the rest). */
function statsWith(file: string, change: Partial<Pick<fs.Stats, 'dev' | 'ino'>>): fs.Stats {
  const st = fs.lstatSync(file)
  return Object.assign(Object.create(Object.getPrototypeOf(st) as object) as fs.Stats, st, change)
}

/** From now on fs.lstatSync reports `fake` for `file` (the fake is made before the spy, so it never calls itself). */
function pretendLstat(file: string, fake: fs.Stats): void {
  const lstatSync = fs.lstatSync.bind(fs)
  vi.spyOn(fs, 'lstatSync').mockImplementation(((p: fs.PathLike, o?: unknown) =>
    path.resolve(String(p)) === path.resolve(file) ? fake : (lstatSync as (q: fs.PathLike, r?: unknown) => fs.Stats)(p, o)))
}

describe('ARC-22 readRegularFile reads a regular file as UTF-8 text, up to the cap', () => {
  test('ARC-22 a regular file under the cap comes back as its UTF-8 text', async () => {
    const { readRegularFile } = await safeRead()
    const text = '{"summary":"Café Érable (Test)"}\n'
    fs.writeFileSync(at('a.json'), text, 'utf8')
    expect(readRegularFile(at('a.json'), 1024)).toEqual({ ok: true, text })
  })

  test('ARC-22 the result is a value, never a promise (the outbox poll reads synchronously)', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{}')
    const got: unknown = readRegularFile(at('a.json'), 10)
    expect(got instanceof Promise).toBe(false)
    expect(got).toEqual({ ok: true, text: '{}' })
  })

  test('ARC-22 exactly maxBytes bytes is read; maxBytes + 1 is too-big', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('ten.json'), 'x'.repeat(10))
    fs.writeFileSync(at('eleven.json'), 'x'.repeat(11))
    expect(readRegularFile(at('ten.json'), 10)).toEqual({ ok: true, text: 'x'.repeat(10) })
    expect(readRegularFile(at('eleven.json'), 10)).toEqual({ ok: false, reason: 'too-big' })
  })

  test('ARC-22 the cap counts bytes, not characters: "éé" is 4 bytes', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('e.json'), 'éé', 'utf8')
    expect(readRegularFile(at('e.json'), 3)).toEqual({ ok: false, reason: 'too-big' })
    expect(readRegularFile(at('e.json'), 4)).toEqual({ ok: true, text: 'éé' })
  })

  test('ARC-22 an empty file reads as empty text, even with a cap of 0; one byte over a cap of 0 is too-big', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('empty.json'), '')
    fs.writeFileSync(at('one.json'), 'x')
    expect(readRegularFile(at('empty.json'), 0)).toEqual({ ok: true, text: '' })
    expect(readRegularFile(at('one.json'), 0)).toEqual({ ok: false, reason: 'too-big' })
  })

  test('ARC-22 a big file is never read whole: at most maxBytes + 1 bytes are read, and never by readFileSync', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('big.json'), Buffer.alloc(1024 * 1024, 0x20))
    const whole = vi.spyOn(fs, 'readFileSync')
    const fds = watchDescriptors()
    expect(readRegularFile(at('big.json'), 10)).toEqual({ ok: false, reason: 'too-big' })
    expect(fds.opened).toHaveLength(1)
    expect(fds.bytesRead()).toBeGreaterThan(10)
    expect(fds.bytesRead()).toBeLessThanOrEqual(11)
    expect(whole).not.toHaveBeenCalled()
  })

  test('ARC-22 a file that grows past what fstat saw is still cut at maxBytes + 1 (the read, not the size, decides)', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('grows.json'), 'x'.repeat(5))
    const fstatSync = fs.fstatSync.bind(fs)
    vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number, o?: unknown) => {
      const st = (fstatSync as (f: number, p?: unknown) => fs.Stats)(fd, o)
      fs.appendFileSync(at('grows.json'), 'y'.repeat(20)) // the writer goes on after the look
      return st
    }))
    const fds = watchDescriptors()
    expect(readRegularFile(at('grows.json'), 10)).toEqual({ ok: false, reason: 'too-big' })
    expect(fds.bytesRead()).toBeLessThanOrEqual(11)
  })
})

describe('ARC-22 readRegularFile opens only a regular file it has looked at', () => {
  test('ARC-22 a missing file is gone', async () => {
    const { readRegularFile } = await safeRead()
    expect(readRegularFile(at('missing.json'), 10)).toEqual({ ok: false, reason: 'gone' })
  })

  test('ARC-22 a folder is not-a-file and is never opened', async () => {
    const { readRegularFile } = await safeRead()
    fs.mkdirSync(at('a-dir.json'))
    const opens = watchOpens()
    expect(readRegularFile(at('a-dir.json'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(opens.paths).not.toContain(path.resolve(at('a-dir.json')))
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a symlink to a regular file is not-a-file, and neither the link nor its target is opened', async () => {
    const { readRegularFile } = await safeRead()
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-safe-read-outside-'))
    try {
      const target = path.join(outside, 'secret.json')
      fs.writeFileSync(target, '{"planted":"PLANTED-CANARY-TARGET (Test)"}')
      fs.symlinkSync(target, at('link.json'))
      const opens = watchOpens()
      const got = readRegularFile(at('link.json'), 1024)
      expect(got).toEqual({ ok: false, reason: 'not-a-file' })
      expect(opens.paths).not.toContain(path.resolve(at('link.json')))
      expect(opens.paths).not.toContain(path.resolve(target))
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a FIFO is not-a-file at once and is never opened (an open would block)', async () => {
    const { readRegularFile } = await safeRead()
    mkfifo(at('pipe.json'))
    const opens = watchOpens()
    expect(readRegularFile(at('pipe.json'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(opens.paths).not.toContain(path.resolve(at('pipe.json')))
  }, 30_000) // mkfifo is a child process (testing.md: 30 s or more)

  test('ARC-22 the file is opened read-only, with O_NONBLOCK where the platform defines it', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{}')
    const flags: unknown[] = []
    const openSync = fs.openSync.bind(fs)
    vi.spyOn(fs, 'openSync').mockImplementation(((p: fs.PathLike, f?: unknown, m?: unknown) => {
      flags.push(f)
      return (openSync as (...a: unknown[]) => number)(p, f, m)
    }))
    expect(readRegularFile(at('a.json'), 10)).toEqual({ ok: true, text: '{}' })
    expect(flags).toHaveLength(1)
    const [f] = flags
    expect(typeof f).toBe('number')
    const n = f as number
    const { O_WRONLY, O_RDWR } = fs.constants
    expect(n & (O_WRONLY | O_RDWR)).toBe(0)
    const nonBlock: unknown = (fs.constants as Readonly<Record<string, unknown>>)['O_NONBLOCK']
    if (typeof nonBlock === 'number') expect(n & nonBlock).toBe(nonBlock)
  })

  test('ARC-22 a file swapped between the look and the open (another inode) is gone', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{"swapped":"PLANTED (Test)"}')
    fs.writeFileSync(at('b.json'), '{}')
    const otherIno = fs.lstatSync(at('b.json')).ino
    pretendLstat(at('a.json'), statsWith(at('a.json'), { ino: otherIno }))
    const w = watchStats()
    expect(readRegularFile(at('a.json'), 1024)).toEqual({ ok: false, reason: 'gone' })
    expectFstatOnTheDescriptor(w)
  })

  test('ARC-22 a file swapped for one on another device (same inode number, another dev) is gone', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{}')
    const real = fs.lstatSync(at('a.json'))
    pretendLstat(at('a.json'), statsWith(at('a.json'), { dev: real.dev + 1 }))
    const w = watchStats()
    expect(readRegularFile(at('a.json'), 1024)).toEqual({ ok: false, reason: 'gone' })
    expectFstatOnTheDescriptor(w)
  })

  test('ARC-22 a plain read also checks the opened descriptor with fstat, never the path with stat (G4 liveness)', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{}')
    const w = watchStats()
    expect(readRegularFile(at('a.json'), 10)).toEqual({ ok: true, text: '{}' })
    expectFstatOnTheDescriptor(w)
  })

  test('ARC-22 a file removed between the look and the open is gone', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('a.json'), '{}')
    vi.spyOn(fs, 'openSync').mockImplementation((() => {
      const e = new Error('ENOENT: planted') as NodeJS.ErrnoException
      e.code = 'ENOENT'
      throw e
    }))
    expect(readRegularFile(at('a.json'), 1024)).toEqual({ ok: false, reason: 'gone' })
  })

  test('ARC-22 every descriptor opened is closed: after a read, a too-big file and a swapped file', async () => {
    const { readRegularFile } = await safeRead()
    fs.writeFileSync(at('ok.json'), '{}')
    fs.writeFileSync(at('big.json'), 'x'.repeat(50))
    fs.writeFileSync(at('b.json'), '{}')
    const otherIno = fs.lstatSync(at('b.json')).ino
    const fds = watchDescriptors()
    expect(readRegularFile(at('ok.json'), 10).ok).toBe(true)
    expect(readRegularFile(at('big.json'), 10)).toEqual({ ok: false, reason: 'too-big' })
    pretendLstat(at('ok.json'), statsWith(at('ok.json'), { ino: otherIno }))
    expect(readRegularFile(at('ok.json'), 10)).toEqual({ ok: false, reason: 'gone' })
    expect(fds.opened).toHaveLength(3)
    expect([...fds.closed].sort()).toEqual([...fds.opened].sort())
  })
})
