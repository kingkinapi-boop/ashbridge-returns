// A05 acceptance tests: engine switches and settings by name (ARC-6, END-8, SEC-10), checks 6 and 7.
// The public API these tests fix is written out at the top of files.acceptance.test.ts.
// Settings: STORAGE_FILES_ENGINE, STORAGE_FILES_LIVE_KEY, STORAGE_DRIVE_ENGINE, STORAGE_DRIVE_LIVE_KEY.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import { createDriveStandIn, createFileStore } from './index'
import { C01, C01_YEAR, copyFixture, failure, sha256, tempDir } from './__fixtures__/harness'

const OFF = /live storage is off until go-live/
const META = { name: 'switch (Test).txt', mimeType: 'text/plain' }
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

let tmp: { dir: string; cleanup: () => void }
let root: string
let drive: string
let saved: Clock

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-01T12:00:00-04:00'))
  tmp = tempDir('settings')
  root = path.join(tmp.dir, 'store')
  fs.mkdirSync(root)
  drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
})

afterEach(() => {
  vi.restoreAllMocks()
  setClock(saved)
  tmp.cleanup()
})

/** A file store made with `env` puts and gets one file. */
async function filesWork(env: Record<string, string | undefined>): Promise<void> {
  const store = createFileStore({ root, env })
  const bytes = enc(`works ${JSON.stringify(env)} (Test)`)
  const ref = await store.put(bytes, META)
  expect(ref.sha256).toBe(sha256(bytes))
  expect(Buffer.from(await store.get(ref.key)).equals(Buffer.from(bytes))).toBe(true)
}

/** A Drive stand-in made with `env` lists C01. */
async function driveWorks(env: Record<string, string | undefined>): Promise<void> {
  const docs = createDriveStandIn({ root: drive, env })
  expect(await docs.listFolder(C01, C01_YEAR)).toHaveLength(2)
}

const filesFailure = (env: Record<string, string | undefined>, sink?: (l: string) => void): Promise<Error | undefined> =>
  failure(async () => {
    const store = createFileStore(sink ? { root, env, sink } : { root, env })
    await store.put(enc('should not land (Test)'), META)
  })

const driveFailure = (env: Record<string, string | undefined>, sink?: (l: string) => void): Promise<Error | undefined> =>
  failure(async () => {
    const docs = createDriveStandIn(sink ? { root: drive, env, sink } : { root: drive, env })
    await docs.listFolder(C01, C01_YEAR)
  })

describe('A05 engine switch', () => {
  test('ARC-6 END-8 both adapters default to local when no engine setting is given', async () => {
    await filesWork({})
    await driveWorks({})
  })

  test('ARC-6 END-8 file store: local, then live with no key fails with "live storage is off until go-live", then local works again', async () => {
    await filesWork({ STORAGE_FILES_ENGINE: 'local' })
    const before = fs.readdirSync(root, { recursive: true }).length
    expect((await filesFailure({ STORAGE_FILES_ENGINE: 'live' }))?.message).toMatch(OFF)
    expect(fs.readdirSync(root, { recursive: true }).length, 'a refused live store writes nothing locally').toBe(before)
    await filesWork({ STORAGE_FILES_ENGINE: 'local' })
  })

  test('ARC-6 END-8 file store: live first, then local works, then live still fails (other direction)', async () => {
    expect((await filesFailure({ STORAGE_FILES_ENGINE: 'live' }))?.message).toMatch(OFF)
    await filesWork({ STORAGE_FILES_ENGINE: 'local' })
    expect((await filesFailure({ STORAGE_FILES_ENGINE: 'live' }))?.message).toMatch(OFF)
  })

  test('ARC-6 END-8 Drive stand-in: local, then live with no key fails with "live storage is off until go-live", then local works again', async () => {
    await driveWorks({ STORAGE_DRIVE_ENGINE: 'local' })
    expect((await driveFailure({ STORAGE_DRIVE_ENGINE: 'live' }))?.message).toMatch(OFF)
    await driveWorks({ STORAGE_DRIVE_ENGINE: 'local' })
  })

  test('ARC-6 END-8 Drive stand-in: live first, then local works, then live still fails (other direction)', async () => {
    expect((await driveFailure({ STORAGE_DRIVE_ENGINE: 'live' }))?.message).toMatch(OFF)
    await driveWorks({ STORAGE_DRIVE_ENGINE: 'local' })
    expect((await driveFailure({ STORAGE_DRIVE_ENGINE: 'live' }))?.message).toMatch(OFF)
  })

  test('ARC-6 the two switches are separate: live files does not switch the Drive stand-in, and live Drive does not switch files', async () => {
    await driveWorks({ STORAGE_FILES_ENGINE: 'live' })
    await filesWork({ STORAGE_DRIVE_ENGINE: 'live' })
  })

  test('ARC-6 planted fault: even with a live key present the live slot stays off', async () => {
    expect((await filesFailure({ STORAGE_FILES_ENGINE: 'live', STORAGE_FILES_LIVE_KEY: 'k-test-files' }))?.message).toMatch(OFF)
    expect((await driveFailure({ STORAGE_DRIVE_ENGINE: 'live', STORAGE_DRIVE_LIVE_KEY: 'k-test-drive' }))?.message).toMatch(OFF)
  })
})

describe('A05 settings are logged by name only', () => {
  test('SEC-10 planted setting values never appear in log lines, stdout, stderr or error messages; the setting is named instead', async () => {
    const planted = {
      filesKey: 'PLANTED-files-key-7f3a91 (Test)',
      driveKey: 'PLANTED-drive-key-c4e2b8 (Test)',
      filesEngine: 'PLANTED-engine-5d1e0c',
      driveEngine: 'PLANTED-engine-9b7a24',
    }
    const lines: string[] = []
    const sink = (l: string): void => {
      lines.push(l)
    }
    const printed: string[] = []
    const grab = (chunk: unknown): boolean => {
      printed.push(String(chunk))
      return true
    }
    vi.spyOn(process.stdout, 'write').mockImplementation(grab)
    vi.spyOn(process.stderr, 'write').mockImplementation(grab)
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...a: unknown[]) => {
        printed.push(a.map(String).join(' '))
      })
    }

    const errors: (Error | undefined)[] = []
    // Live with a planted key: refused as off, key never shown.
    errors.push(await filesFailure({ STORAGE_FILES_ENGINE: 'live', STORAGE_FILES_LIVE_KEY: planted.filesKey }, sink))
    errors.push(await driveFailure({ STORAGE_DRIVE_ENGINE: 'live', STORAGE_DRIVE_LIVE_KEY: planted.driveKey }, sink))
    // An engine value that is neither local nor live: refused naming the setting, never its value.
    const badFiles = await filesFailure({ STORAGE_FILES_ENGINE: planted.filesEngine, STORAGE_FILES_LIVE_KEY: planted.filesKey }, sink)
    const badDrive = await driveFailure({ STORAGE_DRIVE_ENGINE: planted.driveEngine, STORAGE_DRIVE_LIVE_KEY: planted.driveKey }, sink)
    errors.push(badFiles, badDrive)
    // Local with a planted key lying around: works, key never shown.
    const store = createFileStore({ root, env: { STORAGE_FILES_LIVE_KEY: planted.filesKey }, sink })
    await store.put(enc('local with key set (Test)'), META)
    const docs = createDriveStandIn({ root: drive, env: { STORAGE_DRIVE_LIVE_KEY: planted.driveKey }, sink })
    await docs.listFolder(C01, C01_YEAR)

    vi.restoreAllMocks()
    expect(errors.every((e) => e !== undefined)).toBe(true)
    expect(badFiles?.message).toMatch(/STORAGE_FILES_ENGINE/)
    expect(badDrive?.message).toMatch(/STORAGE_DRIVE_ENGINE/)
    const everything = [...lines, ...printed, ...errors.map((e) => `${e?.message ?? ''} ${e?.stack ?? ''}`)].join('\n')
    for (const value of Object.values(planted)) expect(everything).not.toContain(value)
    // Not even a fragment of a key: the distinctive hex tails.
    for (const tail of ['7f3a91', 'c4e2b8', '5d1e0c', '9b7a24']) expect(everything).not.toContain(tail)
  })
})
