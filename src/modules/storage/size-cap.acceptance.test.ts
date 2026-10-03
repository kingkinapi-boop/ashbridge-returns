// FX7 acceptance tests, the A446 "Also" section (reports/A04-findings-5.md RC1): the Drive stand-in reads only a
// regular file, with a size cap, the way src/core/safe-read.ts reads (lstat first, regular files only, never more than
// the cap plus one byte); the local file store gains the same cap on put and get.
//
// Public API these tests fix (spec choices, amber, FX7 spec 3 Oct; the builder implements exactly these names):
//   src/modules/storage/index.ts
//     STORAGE_MAX_BYTES: number   // 64 MiB (67108864): the one cap for both adapters, in bytes
//   Drive stand-in (getFile, listFolder): a file or index.json that is not a regular file rejects with a message that
//   starts "refused: " and says "not a plain file"; a file over the cap rejects "refused: " ... "too big" with the cap
//   in bytes. Bytes are returned exactly as on disk (binary safe), so a text read cannot stand in.
//   File store: put of more than the cap rejects "refused: " ... "too big" (cap in bytes) and writes nothing; get of a
//   stored file over the cap rejects the same way before hashing it (never "stored file changed").
//   No message carries a path under the storage root or any file content.
// One reader (Lead ruling A511 (2), 3 Oct): the Drive stand-in reads a PDF's bytes through readRegularFileBytes in
// src/core/safe-read.ts (its own tests: src/core/safe-read-bytes.acceptance.test.ts) with STORAGE_MAX_BYTES as the
// cap, and no file under src/modules/storage reads file content with node:fs itself (no second reader inside
// storage; the index.json and the file store's get go through the core reader too). Spec choice (amber): the core
// reader's refusal words map to the messages above ("not-a-file" and "gone" for a vanished file are the adapters'
// to word; "too-big" is "too big" with the cap).
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { readOwnSource } from '../../core/testing/read-own-source'
import * as storage from './index'
import { createDriveStandIn, createFileStore } from './index'
import { C01, C01_FOLDER, C01_YEAR, copyFixture, failure, readIndex, sha256, tempDir, writeIndex } from './__fixtures__/harness'

// The core reader, watched (not replaced): every call goes to the real src/core/safe-read.ts. The bytes form is looked up
// at call time, so before the build (no export yet) nothing here throws and the "one reader" tests fail by their
// assertions.
const coreReads = vi.hoisted(() => ({ bytes: [] as { file: string; maxBytes: number }[], text: [] as { file: string; maxBytes: number }[] }))
vi.mock('../../core/safe-read', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const watch = (name: string, into: { file: string; maxBytes: number }[]) => (file: string, maxBytes: number): unknown => {
    into.push({ file, maxBytes })
    const fn = real[name]
    if (typeof fn !== 'function') throw new Error(`src/core/safe-read.ts does not export ${name} yet (FX7, A511)`)
    return (fn as (f: string, m: number) => unknown)(file, maxBytes)
  }
  return { ...real, readRegularFile: watch('readRegularFile', coreReads.text), readRegularFileBytes: watch('readRegularFileBytes', coreReads.bytes) }
})

const MIB64 = 64 * 1024 * 1024
const cap = (): number => {
  const v = (storage as Record<string, unknown>)['STORAGE_MAX_BYTES']
  if (typeof v !== 'number') throw new Error('src/modules/storage/index.ts does not export STORAGE_MAX_BYTES (FX7)')
  return v
}

let tmp: { dir: string; cleanup: () => void }
let saved: Clock
let writers: ChildProcess[] = []

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-03T12:00:00-04:00'))
  tmp = tempDir('fx7-cap')
  writers = []
})

afterEach(() => {
  for (const w of writers) if (w.exitCode === null && w.pid !== undefined) w.kill()
  setClock(saved)
  tmp.cleanup()
})

/** A file of exactly `size` bytes: a few non-UTF-8 bytes, then zeros (sparse, so it costs no disk). */
function plantFile(file: string, size: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Uint8Array.from([0xff, 0xfe, 0x80, 0xc3, 0x28, 0x00, 0x9f]))
  fs.truncateSync(file, size)
}

function noLeak(err: Error | undefined): void {
  expect(err).toBeDefined()
  expect(err?.message).not.toContain(tmp.dir)
}

describe('FX7 storage: the cap', () => {
  test('ARC-6 STORAGE_MAX_BYTES is 64 MiB', () => {
    expect(cap()).toBe(MIB64)
  })
})

describe('FX7 Drive stand-in: regular files only, capped', () => {
  let drive: string
  const yearFolder = (): string => path.join(drive, C01_FOLDER, String(C01_YEAR))
  const addEntry = (id: string, name: string): string => {
    const entries = readIndex(drive)
    writeIndex(drive, [...entries, { drive_file_id: id, path: `${C01_FOLDER}/${String(C01_YEAR)}/${name}`, mime_type: 'application/pdf' }])
    return path.join(yearFolder(), name)
  }
  beforeEach(() => {
    drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
  })

  test('ARC-6 a file of exactly the cap is read whole, byte for byte (binary safe)', async () => {
    const file = addEntry('drv-cap-0001', 'at-cap (Test).pdf')
    plantFile(file, cap())
    const docs = createDriveStandIn({ root: drive, env: {} })
    const got = await docs.getFile('drv-cap-0001')
    expect(got.bytes.length).toBe(cap())
    expect(Array.from(got.bytes.subarray(0, 7))).toEqual([0xff, 0xfe, 0x80, 0xc3, 0x28, 0x00, 0x9f])
    expect(got.sha256).toBe(sha256(fs.readFileSync(file)))
  })

  test('ARC-6 planted: a file one byte over the cap is refused as too big, naming the cap', async () => {
    plantFile(addEntry('drv-cap-0002', 'over-cap (Test).pdf'), cap() + 1)
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.getFile('drv-cap-0002'))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: /)
    expect(err?.message).toContain('too big')
    expect(err?.message).toContain(String(cap()))
  })

  test('ARC-6 planted: listFolder refuses a folder that holds a file over the cap', async () => {
    plantFile(addEntry('drv-cap-0003', 'over-cap (Test).pdf'), cap() + 1)
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.listFolder(C01, C01_YEAR))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*too big/)
  })

  test('ARC-6 planted: a folder where an indexed file should be is refused as not a plain file', async () => {
    fs.mkdirSync(addEntry('drv-dir-0001', 'a folder (Test).pdf'))
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.getFile('drv-dir-0001'))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*not a plain file/)
  })

  test('ARC-6 planted: an index.json that is a folder is refused as not a plain file', async () => {
    fs.rmSync(path.join(drive, 'index.json'))
    fs.mkdirSync(path.join(drive, 'index.json'))
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.getFile('drv-test-c01-0001'))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*not a plain file/)
  })

  test('ARC-6 planted: an index.json over the cap is refused as too big', async () => {
    plantFile(path.join(drive, 'index.json'), cap() + 1)
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.getFile('drv-test-c01-0001'))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*too big/)
  })

  // A FIFO is the file another process can plant to hang a reader. Before the fix the read opens it and waits for a
  // writer, so a writer child (stopped by its own PID, with a timeout) ends that wait and the test fails instead of
  // hanging. After the fix the FIFO is never opened.
  test.skipIf(process.platform === 'win32')('ARC-6 planted: a FIFO at an indexed file is refused as not a plain file and never opened', async () => {
    const fifo = addEntry('drv-fifo-0001', 'a pipe (Test).pdf')
    execFileSync('mkfifo', [fifo])
    const writer = spawn(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(fifo)}, 'opened (Test)')`], {
      timeout: 10_000,
      stdio: 'ignore',
    })
    writers.push(writer)
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.getFile('drv-fifo-0001'))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*not a plain file/)
    expect(writer.exitCode).toBeNull()
  }, 30_000)
})

describe('FX7 file store: the same cap on put and get', () => {
  let root: string
  beforeEach(() => {
    root = path.join(tmp.dir, 'store')
    fs.mkdirSync(root)
  })

  test('ARC-6 put of exactly the cap stores it and get returns the same bytes', async () => {
    const bytes = new Uint8Array(cap())
    bytes.set([0xff, 0xfe, 0x80], 0)
    const store = createFileStore({ root, env: {} })
    const { key } = await store.put(bytes, { name: 'at-cap (Test).pdf', mimeType: 'application/pdf' })
    const back = await store.get(key)
    expect(back.length).toBe(cap())
    expect(sha256(back)).toBe(sha256(bytes))
  })

  test('ARC-6 planted: put of one byte over the cap is refused as too big and writes nothing', async () => {
    const store = createFileStore({ root, env: {} })
    const err = await failure(() => store.put(new Uint8Array(cap() + 1), { name: 'over-cap (Test).pdf', mimeType: 'application/pdf' }))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*too big/)
    expect(err?.message).toContain(String(cap()))
    expect(await store.list('')).toEqual([])
  })

  test('ARC-6 planted: get of a stored file grown past the cap is refused as too big, before any hash', async () => {
    const hash = 'ab'.repeat(32)
    const key = `sha256/ab/${hash}`
    plantFile(path.join(root, 'sha256', 'ab', hash), cap() + 1)
    const store = createFileStore({ root, env: {} })
    const err = await failure(() => store.get(key))
    noLeak(err)
    expect(err?.message).toMatch(/^refused: .*too big/)
    expect(err?.message).not.toContain('stored file changed')
  })
})

// A511 (2): one reader. The scan below proves the shape (no direct read of file content in storage); the runtime test
// after it proves the behaviour (getFile's bytes come through readRegularFileBytes with the storage cap).
const STORAGE_DIR = path.dirname(fileURLToPath(import.meta.url))
const isTest = (f: string): boolean => /\.test\.ts$/.test(f) || f.includes(`${path.sep}__fixtures__${path.sep}`)
function storageProductFiles(): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && p.endsWith('.ts') && !isTest(p)) out.push(p)
    }
  }
  walk(STORAGE_DIR)
  return out.sort()
}

/** Ways node:fs reads file content (or opens a file to read it). A path check (lstat, realpath, exists) is not a read. */
const DIRECT_READS: readonly [string, RegExp][] = [
  ['readFileSync', /\breadFileSync\s*\(/],
  ['readFile', /\breadFile\s*\(/],
  ['readSync', /\breadSync\s*\(/],
  ['read', /\b(?:fs|fsp|promises|fd|handle)\s*\.\s*read\s*\(/],
  ['createReadStream', /\bcreateReadStream\s*\(/],
  ['openSync', /\bopenSync\s*\(/],
  ['open', /\b(?:fs|fsp|promises)\s*\.\s*open\s*\(/],
  ['openAsBlob', /\bopenAsBlob\s*\(/],
  ['node:fs/promises', /from\s+['"](?:node:)?fs\/promises['"]/],
]

/** Code without comments (a mention of readFileSync in a comment is not a read). */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function directReads(name: string, text: string): string[] {
  const body = code(text)
  return DIRECT_READS.filter(([, re]) => re.test(body)).map(([what]) => `${name}: reads file content with node:fs (${what}); go through src/core/safe-read.ts`)
}

describe('FX7 A511 one reader: no second file reader inside storage', () => {
  test('SEC-11 ARC-10 rule: planted direct reads in a storage file are caught, each by name; core-reader calls, writes and path checks are not', () => {
    const planted = [
      "import fs from 'node:fs'",
      'const bytes = new Uint8Array(fs.readFileSync(real))',
      "import { readFile } from 'node:fs/promises'",
      'const pdf = await readFile(file)',
      "const fd = fs.openSync(file, 'r')",
      'fs.readSync(fd, buf, 0, n, null)',
      'const s = fs.createReadStream(file)',
      'await fs.promises.open(file)',
    ].join('\n')
    expect(directReads('planted.ts', planted)).toEqual([
      'planted.ts: reads file content with node:fs (readFileSync); go through src/core/safe-read.ts',
      'planted.ts: reads file content with node:fs (readFile); go through src/core/safe-read.ts',
      'planted.ts: reads file content with node:fs (readSync); go through src/core/safe-read.ts',
      'planted.ts: reads file content with node:fs (createReadStream); go through src/core/safe-read.ts',
      'planted.ts: reads file content with node:fs (openSync); go through src/core/safe-read.ts',
      'planted.ts: reads file content with node:fs (open); go through src/core/safe-read.ts',
      'planted.ts: reads file content with node:fs (node:fs/promises); go through src/core/safe-read.ts',
    ])
    const clean = [
      "import fs from 'node:fs'",
      "import { readRegularFile, readRegularFileBytes } from '../../../core/safe-read'",
      '// a comment may say fs.readFileSync(file) without reading anything',
      'const got = readRegularFileBytes(real, STORAGE_MAX_BYTES)',
      'const idx = readRegularFile(indexPath, STORAGE_MAX_BYTES)',
      "fs.writeFileSync(tmp, bytes, { mode: 0o444, flag: 'wx' })",
      'if (!fs.lstatSync(file).isFile()) throw new Error("refused")',
      'const real = fs.realpathSync(p)',
    ].join('\n')
    expect(directReads('clean.ts', clean)).toEqual([])
  })

  test('SEC-11 ARC-10 no file under src/modules/storage reads file content with node:fs; drive/index.ts and files/index.ts are scanned', () => {
    const files = storageProductFiles()
    const rel = files.map((f) => path.relative(STORAGE_DIR, f).split(path.sep).join('/'))
    expect(files.length).toBeGreaterThan(0)
    expect(rel).toContain('drive/index.ts')
    expect(rel).toContain('files/index.ts')
    expect(files.flatMap((f, i) => directReads(rel[i] ?? f, readOwnSource(f)))).toEqual([])
  })

  test('ARC-6 SEC-11 getFile reads the PDF through readRegularFileBytes with STORAGE_MAX_BYTES, and returns exactly those bytes', async () => {
    const drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
    const name = 'binary (Test).pdf'
    const file = path.join(drive, C01_FOLDER, String(C01_YEAR), name)
    writeIndex(drive, [...readIndex(drive), { drive_file_id: 'drv-one-0001', path: `${C01_FOLDER}/${String(C01_YEAR)}/${name}`, mime_type: 'application/pdf' }])
    const content = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x80, 0xc3, 0x28, 0x00, 0x9f])
    fs.writeFileSync(file, content)
    coreReads.bytes.length = 0
    coreReads.text.length = 0
    const docs = createDriveStandIn({ root: drive, env: {} })
    const got = await docs.getFile('drv-one-0001')
    expect(Array.from(got.bytes)).toEqual(Array.from(content))
    const real = fs.realpathSync(file)
    const pdfReads = coreReads.bytes.filter((c) => c.file === real || c.file === file)
    expect(pdfReads).toHaveLength(1)
    expect(pdfReads[0]?.maxBytes).toBe(cap())
    expect(coreReads.bytes.every((c) => c.maxBytes === cap())).toBe(true)
    expect(coreReads.text.every((c) => c.maxBytes === cap())).toBe(true)
  })

  test('ARC-6 SEC-11 listFolder also reads each PDF through readRegularFileBytes (one call per file in the folder)', async () => {
    const drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
    const folder = `${C01_FOLDER}/${String(C01_YEAR)}`
    const inFolder = readIndex(drive).filter((e) => path.posix.dirname(e.path) === folder)
    expect(inFolder.length).toBeGreaterThan(0)
    coreReads.bytes.length = 0
    const docs = createDriveStandIn({ root: drive, env: {} })
    const listed = await docs.listFolder(C01, C01_YEAR)
    expect(listed).toHaveLength(inFolder.length)
    const pdfReads = coreReads.bytes.filter((c) => !c.file.endsWith('index.json'))
    expect(pdfReads).toHaveLength(inFolder.length)
    expect(pdfReads.every((c) => c.maxBytes === cap())).toBe(true)
  })
})
