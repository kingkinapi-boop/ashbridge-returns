// A05 acceptance tests: the Drive stand-in for client documents (ARC-6, SEC-11), checks 3 (file ids), 4 and 5.
// The public API these tests fix is written out at the top of files.acceptance.test.ts.
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from 'vitest'
import { fixedClock, getClock, setClock, type Clock } from '../../core/clock'
import type { ClientDocuments } from '../../contracts/storage'
import * as storage from './index'
import { createDriveStandIn } from './index'
import {
  C01,
  C01_FOLDER,
  C01_YEAR,
  NON_TEST,
  NON_TEST_FILE_ID,
  copyFixture,
  failure,
  linkDir,
  methodNames,
  readIndex,
  sha256,
  snapshot,
  tempDir,
  writeIndex,
} from './__fixtures__/harness'

let tmp: { dir: string; cleanup: () => void }
let drive: string
let saved: Clock

beforeEach(() => {
  saved = getClock()
  setClock(fixedClock('2026-10-01T12:00:00-04:00'))
  tmp = tempDir('drive')
  drive = copyFixture('drive-c01', path.join(tmp.dir, 'drive'))
})

afterEach(() => {
  setClock(saved)
  tmp.cleanup()
})

const yearFolder = (): string => path.join(drive, C01_FOLDER, String(C01_YEAR))

/** Expects "nothing for this corporation": either a refusal or an empty list. */
async function expectNothing(docs: ClientDocuments, corp: { id: string; legalName: string }, year: number): Promise<void> {
  let files: unknown
  try {
    files = await docs.listFolder(corp, year)
  } catch {
    return
  }
  expect(files).toEqual([])
}

describe('A05 Drive stand-in', () => {
  test("ARC-6 lists C01's folder for its tax year in the client app's folder shape, with name, type and sha256 of each file", async () => {
    const docs = createDriveStandIn({ root: drive, env: {} })
    const files = await docs.listFolder(C01, C01_YEAR)
    const want = readIndex(drive).map((e) => ({
      driveFileId: e.drive_file_id,
      name: path.basename(e.path),
      mimeType: e.mime_type,
      sha256: sha256(fs.readFileSync(path.join(drive, e.path))),
    }))
    expect(want).toHaveLength(2)
    const byId = (a: { driveFileId: string }, b: { driveFileId: string }): number => a.driveFileId.localeCompare(b.driveFileId)
    expect([...files].sort(byId)).toEqual([...want].sort(byId))
  })

  test('ARC-6 getFile returns the bytes, name, type and sha256 of each indexed C01 file', async () => {
    const docs = createDriveStandIn({ root: drive, env: {} })
    for (const e of readIndex(drive)) {
      const bytes = fs.readFileSync(path.join(drive, e.path))
      const got = await docs.getFile(e.drive_file_id)
      expect(Buffer.from(got.bytes).equals(bytes)).toBe(true)
      expect(got.name).toBe(path.basename(e.path))
      expect(got.mimeType).toBe(e.mime_type)
      expect(got.sha256).toBe(sha256(bytes))
    }
    expect((await failure(() => docs.getFile('drv-test-unknown-9999')))?.message).toBeTruthy()
  })

  test('ARC-6 planted fault: only the <legal name> (<first 8 hex of id>)/<tax year> folder counts (wrong year, wrong id, wrong name)', async () => {
    // A decoy in the prior year folder, indexed, must not appear in the 2025 listing.
    const prior = path.join(drive, C01_FOLDER, '2024')
    fs.mkdirSync(prior)
    fs.writeFileSync(path.join(prior, 'prior-year-t2 (Test).pdf'), '%PDF-1.4\n% prior year (Test)\n')
    writeIndex(drive, [
      ...readIndex(drive),
      { drive_file_id: 'drv-test-c01-2024', path: `${C01_FOLDER}/2024/prior-year-t2 (Test).pdf`, mime_type: 'application/pdf' },
    ])
    const docs = createDriveStandIn({ root: drive, env: {} })
    const ids2025 = (await docs.listFolder(C01, C01_YEAR)).map((f) => f.driveFileId).sort()
    expect(ids2025).toEqual(['drv-test-c01-0001', 'drv-test-c01-0002'])
    expect((await docs.listFolder(C01, 2024)).map((f) => f.driveFileId)).toEqual(['drv-test-c01-2024'])
    await expectNothing(docs, C01, 2023)
    await expectNothing(docs, { id: 'c01a0001-0000-4000-8000-000000000001', legalName: C01.legalName }, C01_YEAR)
    await expectNothing(docs, { id: C01.id, legalName: 'Maple Ridge Consulting Ltd. (Test)' }, C01_YEAR)
  })

  test('ARC-6 the Drive stand-in has no write method (the type has none; at runtime only listFolder and getFile)', () => {
    expectTypeOf<keyof ClientDocuments>().toEqualTypeOf<'listFolder' | 'getFile'>()
    const docs = createDriveStandIn({ root: drive, env: {} })
    expect(methodNames(docs)).toEqual(['getFile', 'listFolder'])
  })

  test('ARC-6 calling every exported function of the module (bar the file store) and every Drive method writes nothing under the Drive root', async () => {
    const before = snapshot(drive)
    const exported = Object.entries(storage).filter(([name, v]) => typeof v === 'function' && name !== 'createFileStore')
    expect(exported.map(([n]) => n)).toContain('createDriveStandIn')
    for (const [, fn] of exported) {
      await failure(async () => {
        const out: unknown = await (fn as (o: unknown) => unknown)({ root: drive, env: {} })
        if (out !== null && typeof out === 'object') {
          const obj = out as Record<string, unknown>
          for (const m of methodNames(obj)) {
            const call = obj[m] as (...a: unknown[]) => unknown
            await failure(() => call.call(obj, C01, C01_YEAR))
            for (const e of readIndex(drive)) await failure(() => call.call(obj, e.drive_file_id))
          }
        }
      })
    }
    expect(snapshot(drive)).toEqual(before)
  })

  test('SEC-11 the folder for a company without "(Test)" is refused with the reason, by listFolder and by getFile', async () => {
    const other = copyFixture('drive-no-test', path.join(tmp.dir, 'drive-no-test'))
    const docs = createDriveStandIn({ root: other, env: {} })
    const listErr = await failure(() => docs.listFolder(NON_TEST, C01_YEAR))
    expect(listErr?.message).toMatch(/\(Test\)/)
    const getErr = await failure(() => docs.getFile(NON_TEST_FILE_ID))
    expect(getErr?.message).toMatch(/\(Test\)/)
  })

  test('SEC-11 planted fault: a near miss such as "(Testing)" or "Test" without brackets is refused too', async () => {
    for (const legalName of ['Northgate Supplies Inc. (Testing)', 'Northgate Supplies Inc. Test']) {
      const id = 'c03c0000-0000-4000-8000-000000000003'
      const folder = `${legalName} (c03c0000)`
      fs.mkdirSync(path.join(drive, folder, '2025'), { recursive: true })
      fs.writeFileSync(path.join(drive, folder, '2025', 'invoice.pdf'), '%PDF-1.4\n% near miss\n')
      writeIndex(drive, [...readIndex(drive), { drive_file_id: `drv-near-${String(legalName.length)}`, path: `${folder}/2025/invoice.pdf`, mime_type: 'application/pdf' }])
      const docs = createDriveStandIn({ root: drive, env: {} })
      expect((await failure(() => docs.listFolder({ id, legalName }, 2025)))?.message).toMatch(/\(Test\)/)
      expect((await failure(() => docs.getFile(`drv-near-${String(legalName.length)}`)))?.message).toMatch(/\(Test\)/)
    }
  })

  test('ARC-6 file ids holding .., an absolute path or a drive letter are refused with the reason and nothing outside the root is read', async () => {
    const outside = path.join(tmp.dir, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'secret (Test).txt'), 'outside the root (Test)')
    const docs = createDriveStandIn({ root: drive, env: {} })
    for (const id of ['../outside/secret (Test).txt', '..\\outside\\secret (Test).txt', path.join(outside, 'secret (Test).txt'), '/etc/hosts', 'C:\\Windows\\win.ini', 'c:/x']) {
      const err = await failure(() => docs.getFile(id))
      expect(err?.message, `reason for ${id}`).toMatch(/refused/i)
      expect((err as NodeJS.ErrnoException | undefined)?.code).toBeUndefined()
    }
  })

  test('ARC-6 planted fault: an index entry whose path climbs out of the root is refused, and its bytes are never returned', async () => {
    const outside = path.join(tmp.dir, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'secret (Test).txt'), 'outside the root (Test)')
    writeIndex(drive, [
      ...readIndex(drive),
      { drive_file_id: 'drv-test-climb', path: `${C01_FOLDER}/2025/../../../outside/secret (Test).txt`, mime_type: 'text/plain' },
      { drive_file_id: 'drv-test-abs', path: path.join(outside, 'secret (Test).txt'), mime_type: 'text/plain' },
    ])
    const docs = createDriveStandIn({ root: drive, env: {} })
    for (const id of ['drv-test-climb', 'drv-test-abs']) {
      expect((await failure(() => docs.getFile(id)))?.message).toMatch(/refused/i)
    }
  })

  test('ARC-6 planted fault: a tax-year folder that is a symlink out of the root is refused', async () => {
    const outside = path.join(tmp.dir, 'outside-year')
    fs.cpSync(yearFolder(), outside, { recursive: true })
    fs.rmSync(yearFolder(), { recursive: true, force: true })
    linkDir(outside, yearFolder())
    const docs = createDriveStandIn({ root: drive, env: {} })
    expect((await failure(() => docs.getFile('drv-test-c01-0001')))?.message).toMatch(/refused/i)
    expect((await failure(() => docs.listFolder(C01, C01_YEAR)))?.message).toMatch(/refused/i)
  })

  test('ARC-6 property: any file id with a .. segment, a leading slash or backslash, or a drive letter is refused', async () => {
    const docs = createDriveStandIn({ root: drive, env: {} })
    const seg = fc.stringMatching(/^[A-Za-z0-9_ ().-]{1,12}$/).filter((s) => s !== '.' && s !== '..')
    const sep = fc.constantFrom('/', '\\')
    const bad = fc.oneof(
      fc.tuple(fc.array(seg, { maxLength: 3 }), fc.array(seg, { maxLength: 3 }), sep).map(([a, b, s]) => [...a, '..', ...b].join(s)),
      fc.tuple(fc.array(seg, { minLength: 1, maxLength: 4 }), sep).map(([a, s]) => s + a.join(s)),
      fc.tuple(fc.stringMatching(/^[A-Za-z]$/), fc.constantFrom(':', ':/', ':\\'), fc.array(seg, { maxLength: 3 }), sep).map(([l, c, a, s]) => l + c + a.join(s)),
    )
    await fc.assert(
      fc.asyncProperty(bad, async (id) => {
        expect((await failure(() => docs.getFile(id)))?.message).toMatch(/refused/i)
      }),
      { seed: 20261001, numRuns: 150 },
    )
  })
})
