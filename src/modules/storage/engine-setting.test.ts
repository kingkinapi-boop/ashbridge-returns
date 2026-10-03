// FX2 acceptance tests: STORAGE_FILES_ENGINE and STORAGE_DRIVE_ENGINE are declared in src/core/env.ts and a production deploy that forgets either refuses (SEC-11, ARC-6, ARC-20).
// Same pattern as A06's AUTH_ENGINE: the stand-in is the default outside production; NODE_ENV=production with the setting unset throws a message naming the setting.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { readSettings } from '../../core/env'
import { readOwnSource } from '../../core/testing/read-own-source'
import { createDriveStandIn, createFileStore } from './index'
import { C01, C01_YEAR, copyFixture, failure, tempDir } from './__fixtures__/harness'

const META = { name: 'fx2 (Test).txt', mimeType: 'text/plain' }
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

let tmp: { dir: string; cleanup: () => void }
let root: string
let drive: string

beforeEach(() => {
  tmp = tempDir('fx2-storage')
  root = path.join(tmp.dir, 'store')
  fs.mkdirSync(root)
  drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
})

afterEach(() => {
  tmp.cleanup()
})

type Env = Record<string, string | undefined>

async function filesWork(env: Env): Promise<void> {
  const store = createFileStore({ root, env })
  const ref = await store.put(enc('fx2 works (Test)'), META)
  expect(Buffer.from(await store.get(ref.key)).toString()).toBe('fx2 works (Test)')
}

async function driveWorks(env: Env): Promise<void> {
  const docs = createDriveStandIn({ root: drive, env })
  expect(await docs.listFolder(C01, C01_YEAR)).toHaveLength(2)
}

const filesRefusal = (env: Env): Promise<Error | undefined> =>
  failure(async () => {
    const store = createFileStore({ root, env })
    await store.put(enc('should not land (Test)'), META)
  })

const driveRefusal = (env: Env): Promise<Error | undefined> =>
  failure(async () => {
    const docs = createDriveStandIn({ root: drive, env })
    await docs.listFolder(C01, C01_YEAR)
  })

describe('FX2 STORAGE_FILES_ENGINE in production', () => {
  test('SEC-11 ARC-6 production with STORAGE_FILES_ENGINE unset refuses, naming the setting, and writes nothing', async () => {
    const err = await filesRefusal({ NODE_ENV: 'production' })
    expect(err, 'the file store must refuse').toBeDefined()
    expect(err?.message).toMatch(/STORAGE_FILES_ENGINE/)
    expect(fs.readdirSync(root, { recursive: true })).toHaveLength(0)
  })

  test('SEC-11 production with STORAGE_FILES_ENGINE blank refuses like unset', async () => {
    expect((await filesRefusal({ NODE_ENV: 'production', STORAGE_FILES_ENGINE: '' }))?.message).toMatch(/STORAGE_FILES_ENGINE/)
  })

  test('SEC-11 ARC-6 production with STORAGE_FILES_ENGINE=local works (set on purpose)', async () => {
    await filesWork({ NODE_ENV: 'production', STORAGE_FILES_ENGINE: 'local' })
  })

  test('SEC-11 production with STORAGE_FILES_ENGINE=live still fails as off', async () => {
    expect((await filesRefusal({ NODE_ENV: 'production', STORAGE_FILES_ENGINE: 'live' }))?.message).toMatch(/live storage is off until go-live/)
  })

  test('ARC-6 development and test with it unset use the local stand-in', async () => {
    await filesWork({ NODE_ENV: 'development' })
    await filesWork({ NODE_ENV: 'test' })
    await filesWork({})
  })

  test('SEC-11 both directions: refuse, work, refuse again', async () => {
    expect((await filesRefusal({ NODE_ENV: 'production' }))?.message).toMatch(/STORAGE_FILES_ENGINE/)
    await filesWork({ NODE_ENV: 'production', STORAGE_FILES_ENGINE: 'local' })
    expect((await filesRefusal({ NODE_ENV: 'production' }))?.message).toMatch(/STORAGE_FILES_ENGINE/)
  })
})

describe('FX2 STORAGE_DRIVE_ENGINE in production', () => {
  test('SEC-11 ARC-6 production with STORAGE_DRIVE_ENGINE unset refuses, naming the setting', async () => {
    const err = await driveRefusal({ NODE_ENV: 'production' })
    expect(err, 'the Drive stand-in must refuse').toBeDefined()
    expect(err?.message).toMatch(/STORAGE_DRIVE_ENGINE/)
  })

  test('SEC-11 production with STORAGE_DRIVE_ENGINE blank refuses like unset', async () => {
    expect((await driveRefusal({ NODE_ENV: 'production', STORAGE_DRIVE_ENGINE: '' }))?.message).toMatch(/STORAGE_DRIVE_ENGINE/)
  })

  test('SEC-11 ARC-6 production with STORAGE_DRIVE_ENGINE=local works', async () => {
    await driveWorks({ NODE_ENV: 'production', STORAGE_DRIVE_ENGINE: 'local' })
  })

  test('SEC-11 production with STORAGE_DRIVE_ENGINE=live still fails as off', async () => {
    expect((await driveRefusal({ NODE_ENV: 'production', STORAGE_DRIVE_ENGINE: 'live' }))?.message).toMatch(/live storage is off until go-live/)
  })

  test('ARC-6 development and test with it unset use the stand-in', async () => {
    await driveWorks({ NODE_ENV: 'development' })
    await driveWorks({ NODE_ENV: 'test' })
    await driveWorks({})
  })

  test('SEC-11 the two settings are separate: setting files does not satisfy Drive in production, and the reverse', async () => {
    expect((await driveRefusal({ NODE_ENV: 'production', STORAGE_FILES_ENGINE: 'local' }))?.message).toMatch(/STORAGE_DRIVE_ENGINE/)
    expect((await filesRefusal({ NODE_ENV: 'production', STORAGE_DRIVE_ENGINE: 'local' }))?.message).toMatch(/STORAGE_FILES_ENGINE/)
  })
})

describe('FX2 env.ts declares the storage settings', () => {
  test('ARC-6 ARC-20 readSettings carries both, with blank read as unset', () => {
    const s: Record<string, unknown> = readSettings({ STORAGE_FILES_ENGINE: 'local', STORAGE_DRIVE_ENGINE: 'local' })
    expect(s['STORAGE_FILES_ENGINE']).toBe('local')
    expect(s['STORAGE_DRIVE_ENGINE']).toBe('local')
    const blank: Record<string, unknown> = readSettings({ STORAGE_FILES_ENGINE: '', STORAGE_DRIVE_ENGINE: '' })
    expect(blank['STORAGE_FILES_ENGINE']).toBeUndefined()
    expect(blank['STORAGE_DRIVE_ENGINE']).toBeUndefined()
  })

  // Through readOwnSource, so the scan holds inside Stryker's sandbox (testing.md, FX2 findings RC2).
  // Round 2 (A414): the auth factory is scanned too; it read AUTH_ENGINE through `opts.env ?? process.env`.
  test('ARC-20 no storage or auth module reads process.env or env[...] for an engine (reads go through env.ts)', () => {
    const files = [
      'src/modules/storage/files/index.ts',
      'src/modules/storage/drive/index.ts',
      'src/modules/storage/safe.ts',
      'src/modules/auth/index.ts',
    ]
    const read = files.map((f) => [f, readOwnSource(f)] as const)
    expect(read.map(([f]) => f), 'every file read').toHaveLength(4)
    expect(read.find(([f]) => f === 'src/modules/auth/index.ts')?.[1], 'read the auth factory itself').toMatch(/export async function createAuth\b/)
    const problems = read.filter(([, src]) => /env\[\s*name\s*\]|process\.env/.test(src)).map(([f]) => f)
    expect(problems).toEqual([])
  })
})
