// A05 fix round 2 acceptance tests (reports/A05-security.md, lows 1 to 3; amber A267).
// Rule: every adapter path that writes or answers about a stored key (put, has, get, list) and the Drive stand-in's
// index read check the REAL parent folder sits inside the root, the same way reads already do. Each case plants a
// symlinked (junction on Windows) prefix folder or index file that points outside the root.
// The public API is the one written out at the top of files.acceptance.test.ts.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { createDriveStandIn, createFileStore } from './index'
import { C01, C01_YEAR, allFiles, copyFixture, failure, linkDir, sha256, snapshot, tempDir } from './__fixtures__/harness'

const META = { name: 'statement (Test).txt', mimeType: 'text/plain' }
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

let tmp: { dir: string; cleanup: () => void }
let root: string
let outside: string
let saved: Clock

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-02T12:00:00-04:00'))
  tmp = tempDir('real-parent')
  root = path.join(tmp.dir, 'store')
  outside = path.join(tmp.dir, 'outside')
  fs.mkdirSync(root)
  fs.mkdirSync(outside)
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

/** Which prefix folder is planted as a link out of the root: the whole `sha256` folder or one `sha256/<xx>` folder. */
const LEVELS = ['sha256', 'sha256/<xx>'] as const
type Level = (typeof LEVELS)[number]

/**
 * Plants the link for `bytes` at `level` and returns the key those bytes would get and the outside folder that now
 * stands where the key's folder should be. When `alsoOutside` is true, the bytes are already sitting outside under
 * the key's file name, so a store that follows the link would find them.
 */
function plant(level: Level, bytes: Uint8Array, alsoOutside: boolean): { key: string; keyFolderOutside: string } {
  const hash = sha256(bytes)
  const xx = hash.slice(0, 2)
  const key = `sha256/${xx}/${hash}`
  const target = path.join(outside, 'linked')
  fs.mkdirSync(target)
  let keyFolderOutside: string
  if (level === 'sha256') {
    linkDir(target, path.join(root, 'sha256'))
    keyFolderOutside = path.join(target, xx)
  } else {
    fs.mkdirSync(path.join(root, 'sha256'))
    linkDir(target, path.join(root, 'sha256', xx))
    keyFolderOutside = target
  }
  if (alsoOutside) {
    fs.mkdirSync(keyFolderOutside, { recursive: true })
    fs.writeFileSync(path.join(keyFolderOutside, hash), bytes)
  }
  return { key, keyFolderOutside }
}

describe('A05 fix round 2: the file store checks the real parent folder on every path (ARC-6)', () => {
  for (const level of LEVELS) {
    test(`ARC-6 planted fault (${level} linked out): put refuses and writes no file outside the root`, async () => {
      const store = createFileStore({ root, env: {} })
      const bytes = enc(`put through a linked ${level} folder (Test)`)
      plant(level, bytes, false)
      const err = await failure(() => store.put(bytes, META))
      expect(err?.message ?? 'no error: the call succeeded', 'put must refuse a key folder that resolves outside the root').toMatch(/refused/i)
      expect(err?.message).toMatch(/outside the storage root/i)
      expect(allFiles(outside), 'no bytes (and no temp file) may land outside the root').toEqual([])
    })

    test(`ARC-6 planted fault (${level} linked out): put does not report as stored bytes that sit outside the root`, async () => {
      const store = createFileStore({ root, env: {} })
      const bytes = enc(`already outside behind a linked ${level} folder (Test)`)
      plant(level, bytes, true)
      const before = snapshot(outside)
      const err = await failure(() => store.put(bytes, META))
      expect(err?.message ?? 'no error: the call succeeded', 'put must not answer "stored" for a file outside the root').toMatch(/refused/i)
      expect(snapshot(outside)).toEqual(before)
    })

    test(`ARC-6 planted fault (${level} linked out): has does not answer true for a file outside the root`, async () => {
      const store = createFileStore({ root, env: {} })
      const bytes = enc(`has through a linked ${level} folder (Test)`)
      const { key } = plant(level, bytes, true)
      let answer: boolean | undefined
      const err = await failure(async () => {
        answer = await store.has(key)
      })
      if (err) expect(err.message).toMatch(/refused/i)
      else expect(answer, 'has must be false (or refuse) when the key folder resolves outside the root').toBe(false)
    })

    test(`ARC-6 planted fault (${level} linked out): get refuses a file outside the root, even when the bytes match`, async () => {
      const store = createFileStore({ root, env: {} })
      const bytes = enc(`get through a linked ${level} folder (Test)`)
      const { key } = plant(level, bytes, true)
      expect((await failure(() => store.get(key)))?.message).toMatch(/refused/i)
    })

    test(`ARC-6 planted fault (${level} linked out): list never names a key whose file sits outside the root`, async () => {
      const store = createFileStore({ root, env: {} })
      const bytes = enc(`list through a linked ${level} folder (Test)`)
      const { key } = plant(level, bytes, true)
      let keys: string[] = []
      const err = await failure(async () => {
        keys = await store.list('sha256/')
      })
      if (err) expect(err.message).toMatch(/refused/i)
      else expect(keys).not.toContain(key)
    })
  }

  test('ARC-6 control: with no link planted, put, has, get and list still work under a real root', async () => {
    const store = createFileStore({ root, env: {} })
    const bytes = enc('plain put (Test)')
    const ref = await store.put(bytes, META)
    expect(await store.has(ref.key)).toBe(true)
    expect(Buffer.from(await store.get(ref.key)).equals(Buffer.from(bytes))).toBe(true)
    expect(await store.list('sha256/')).toEqual([ref.key])
  })
})

describe('A05 fix round 2: the Drive stand-in reads its index only from inside the root (ARC-6)', () => {
  let drive: string

  beforeEach(() => {
    drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
  })

  /** Moves index.json outside the root (contents unchanged, so every entry still points inside) and links it back. */
  function linkIndexOut(): void {
    const index = path.join(drive, 'index.json')
    const moved = path.join(outside, 'index.json')
    fs.copyFileSync(index, moved)
    fs.rmSync(index)
    fs.symlinkSync(moved, index, 'file')
  }

  test('ARC-6 planted fault: an index.json that is a link out of the root makes getFile refuse', async () => {
    linkIndexOut()
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.getFile('drv-test-c01-0001'))
    expect(err?.message ?? 'no error: the call succeeded', 'the index must be read only from inside the root').toMatch(/refused/i)
  })

  test('ARC-6 planted fault: an index.json that is a link out of the root makes listFolder refuse', async () => {
    linkIndexOut()
    const docs = createDriveStandIn({ root: drive, env: {} })
    const err = await failure(() => docs.listFolder(C01, C01_YEAR))
    expect(err?.message ?? 'no error: the call succeeded', 'the index must be read only from inside the root').toMatch(/refused/i)
  })

  test('ARC-6 control: with the real index in place, getFile and listFolder still answer', async () => {
    const docs = createDriveStandIn({ root: drive, env: {} })
    expect((await docs.getFile('drv-test-c01-0001')).driveFileId).toBe('drv-test-c01-0001')
    expect((await docs.listFolder(C01, C01_YEAR)).length).toBeGreaterThan(0)
  })
})
