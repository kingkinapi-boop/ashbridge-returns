// A05 acceptance tests: the local-folder file store (ARC-6), checks 1, 2, 3 and 8.
//
// Public API these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/modules/storage/index.ts
//     createFileStore(options: { root: string; env?: Record<string, string | undefined>;
//                                sink?: (line: string) => void;              // log sink, as makeLogger takes
//                                testHooks?: { beforeRename?: () => void } }): FileStore
//     createDriveStandIn(options: { root: string; env?: Record<string, string | undefined>;
//                                   sink?: (line: string) => void }): ClientDocuments
//   src/contracts/storage.ts
//     interface FileStore {        // exactly these four keys, no delete, no overwrite
//       put(bytes: Uint8Array, meta: { name: string; mimeType: string }): Promise<{ key: string; sha256: string }>
//       get(key: string): Promise<Uint8Array>; has(key: string): Promise<boolean>; list(prefix: string): Promise<string[]> }
//     interface ClientDocuments {  // exactly these two keys, read-only
//       listFolder(corporation: { id: string; legalName: string }, taxYear: number):
//         Promise<{ driveFileId: string; name: string; mimeType: string; sha256: string }[]>
//       getFile(driveFileId: string): Promise<{ bytes: Uint8Array; name: string; mimeType: string; sha256: string }> }
//   Settings, read by name (env option, default process.env): STORAGE_FILES_ENGINE and STORAGE_DRIVE_ENGINE
//   ('local' default | 'live'); STORAGE_FILES_LIVE_KEY and STORAGE_DRIVE_LIVE_KEY (the live slots' keys; live stays off
//   with or without one). Errors may be thrown by the factory or by the first call: tests accept either.
//   A refused key or file id rejects with a message containing "refused" and the reason; has() and list() refuse too.
//   Keys are `sha256/<first two hex>/<sha256>`; on disk a key's file sits in a folder under the root (not the root itself).
//   Drive stand-in index: <root>/index.json, { files: [{ drive_file_id, path, mime_type }] } (see __fixtures__/drive-c01).
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import type { FileStore } from '../../contracts/storage'
import { createFileStore } from './index'
import { allFiles, failure, linkDir, methodNames, sha256, snapshot, tempDir } from './__fixtures__/harness'

const META = { name: 'statement (Test).txt', mimeType: 'text/plain' }
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
const same = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b))

let tmp: { dir: string; cleanup: () => void }
let root: string
let outside: string
let saved: Clock

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-01T12:00:00-04:00'))
  tmp = tempDir('files')
  root = path.join(tmp.dir, 'store')
  outside = path.join(tmp.dir, 'outside')
  fs.mkdirSync(root)
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(outside, 'secret (Test).txt'), 'outside the root (Test)')
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

/** The on-disk file holding a stored key: the one regular file under the root whose name contains its sha256. */
function diskFileFor(sha: string): string {
  const hits = allFiles(root).filter((f) => path.basename(f).includes(sha))
  expect(hits, 'exactly one stored file per sha256').toHaveLength(1)
  return hits[0] ?? ''
}

describe('A05 file store', () => {
  test('ARC-6 put returns the content-addressed key and the sha256; get returns the same bytes; has and list see it', async () => {
    const store = createFileStore({ root, env: {} })
    const bytes = enc('Maple Ridge Consulting Inc. (Test) bank statement, January 2025\n')
    const want = sha256(bytes)
    const ref = await store.put(bytes, META)
    expect(ref.sha256).toBe(want)
    expect(ref.key).toBe(`sha256/${want.slice(0, 2)}/${want}`)
    expect(same(await store.get(ref.key), bytes)).toBe(true)
    expect(await store.has(ref.key)).toBe(true)
    const otherSha = sha256(enc('never stored (Test)'))
    expect(await store.has(`sha256/${otherSha.slice(0, 2)}/${otherSha}`)).toBe(false)
    expect(await store.list('sha256/')).toContain(ref.key)
    expect(await store.list(`sha256/${want.slice(0, 2)}/`)).toEqual([ref.key])
  })

  test('ARC-6 putting the same bytes again returns the same key and writes no new file (file count and mtime unchanged)', async () => {
    const store = createFileStore({ root, env: {} })
    const bytes = enc('same bytes twice (Test)')
    const first = await store.put(bytes, META)
    const countAfterFirst = allFiles(root).length
    const before = snapshot(root)
    const second = await store.put(bytes, { name: 'another name (Test).txt', mimeType: 'text/plain' })
    expect(second).toEqual(first)
    expect(allFiles(root).length).toBe(countAfterFirst)
    expect(snapshot(root)).toEqual(before)
    const third = await store.put(enc('different bytes (Test)'), META)
    expect(third.key).not.toBe(first.key)
    expect(allFiles(root).length).toBe(countAfterFirst + 1)
  })

  test('ARC-6 the file store has no way to overwrite or delete a stored key (type and runtime)', async () => {
    expectTypeOf<keyof FileStore>().toEqualTypeOf<'put' | 'get' | 'has' | 'list'>()
    const store = createFileStore({ root, env: {} })
    expect(methodNames(store)).toEqual(['get', 'has', 'list', 'put'])
    const bytes = enc('write once (Test)')
    const ref = await store.put(bytes, META)
    // Putting other bytes can never land under an existing key: the key is their own hash.
    const other = await store.put(enc('write once, changed (Test)'), META)
    expect(other.key).not.toBe(ref.key)
    expect(same(await store.get(ref.key), bytes)).toBe(true)
  })

  test('ARC-6 planted fault: bytes changed on disk behind a key make get refuse with "stored file changed"', async () => {
    const store = createFileStore({ root, env: {} })
    const ref = await store.put(enc('original bytes (Test)'), META)
    const file = diskFileFor(ref.sha256)
    fs.chmodSync(file, 0o644)
    fs.writeFileSync(file, 'tampered bytes (Test)')
    const err = await failure(() => store.get(ref.key))
    expect(err?.message).toMatch(/stored file changed/)
  })

  test('ARC-6 keys holding .., an absolute path or a drive letter are refused with the reason; nothing outside the root is read or written', async () => {
    const store = createFileStore({ root, env: {} })
    await store.put(enc('inside (Test)'), META)
    const outsideBefore = [...snapshot(outside), ...fs.readdirSync(tmp.dir).sort()]
    const bad = [
      '../outside/secret (Test).txt',
      'sha256/../../outside/secret (Test).txt',
      '..\\outside\\secret (Test).txt',
      path.join(outside, 'secret (Test).txt'),
      '/etc/hosts',
      'C:\\Windows\\win.ini',
      'c:/outside/secret (Test).txt',
      'D:secret (Test).txt',
    ]
    for (const key of bad) {
      for (const call of [() => store.get(key), () => store.has(key), () => store.list(key)]) {
        const err = await failure(call)
        expect(err, `refused: ${key}`).toBeDefined()
        expect(err?.message, `reason for ${key}`).toMatch(/refused/i)
        expect((err as NodeJS.ErrnoException | undefined)?.code, `refused before touching the disk: ${key}`).toBeUndefined()
      }
    }
    const outsideAfter = [...snapshot(outside), ...fs.readdirSync(tmp.dir).sort()]
    expect(outsideAfter).toEqual(outsideBefore)
  })

  test('ARC-6 planted fault: a stored key whose folder is a symlink out of the root is refused, even when the bytes match', async () => {
    const store = createFileStore({ root, env: {} })
    const bytes = enc('linked out (Test)')
    const ref = await store.put(bytes, META)
    const file = diskFileFor(ref.sha256)
    const folder = path.dirname(file)
    expect(folder, 'a key file sits in a folder under the root').not.toBe(root)
    const elsewhere = path.join(outside, 'linked')
    fs.mkdirSync(elsewhere)
    fs.writeFileSync(path.join(elsewhere, path.basename(file)), bytes)
    fs.rmSync(folder, { recursive: true, force: true })
    linkDir(elsewhere, folder)
    const err = await failure(() => store.get(ref.key))
    expect(err?.message).toMatch(/refused/i)
  })

  test('ARC-6 property: any key with a .. segment, a leading slash or backslash, or a drive letter is refused by get, has and list', async () => {
    const store = createFileStore({ root, env: {} })
    const seg = fc.stringMatching(/^[A-Za-z0-9_ ().-]{1,12}$/).filter((s) => s !== '.' && s !== '..')
    const sep = fc.constantFrom('/', '\\')
    const dotdot = fc.tuple(fc.array(seg, { maxLength: 3 }), fc.array(seg, { maxLength: 3 }), sep).map(([a, b, s]) => [...a, '..', ...b].join(s))
    const absolute = fc.tuple(fc.array(seg, { minLength: 1, maxLength: 4 }), sep).map(([a, s]) => s + a.join(s))
    const driveLetter = fc
      .tuple(fc.stringMatching(/^[A-Za-z]$/), fc.constantFrom(':', ':/', ':\\'), fc.array(seg, { maxLength: 3 }), sep)
      .map(([l, c, a, s]) => l + c + a.join(s))
    const badKey = fc.oneof(dotdot, absolute, driveLetter)
    await fc.assert(
      fc.asyncProperty(badKey, fc.constantFrom('get', 'has', 'list'), async (key, method) => {
        const err = await failure(() => store[method](key))
        expect(err?.message).toMatch(/refused/i)
      }),
      { seed: 20261001, numRuns: 150 },
    )
    // Positive control: keys the store itself returns are always accepted.
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 64 }), async (bytes) => {
        const ref = await store.put(bytes, META)
        expect(same(await store.get(ref.key), bytes)).toBe(true)
      }),
      { seed: 20261001, numRuns: 25 },
    )
  })

  test('ARC-6 a write interrupted after the temp file is written leaves no file under the real key, and the next put succeeds', async () => {
    const bytes = enc('interrupted write (Test)')
    const want = sha256(bytes)
    const key = `sha256/${want.slice(0, 2)}/${want}`
    let hookRan = false
    const crashing = createFileStore({
      root,
      env: {},
      testHooks: {
        beforeRename: () => {
          hookRan = true
          throw new Error('simulated crash before rename (Test)')
        },
      },
    })
    const err = await failure(() => crashing.put(bytes, META))
    expect(hookRan).toBe(true)
    expect(err).toBeDefined()
    const store = createFileStore({ root, env: {} })
    expect(await store.has(key)).toBe(false)
    expect(await store.list('sha256/')).toEqual([])
    expect(allFiles(root).filter((f) => path.basename(f) === want)).toEqual([])
    const ref = await store.put(bytes, META)
    expect(ref.key).toBe(key)
    expect(same(await store.get(key), bytes)).toBe(true)
    expect(await store.list('sha256/')).toEqual([key])
  })
})
