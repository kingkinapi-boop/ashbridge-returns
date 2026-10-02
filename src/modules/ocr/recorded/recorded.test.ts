import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { fixedClock, getClock, setClock } from '../../../core/clock'
import type { ReadingEngine } from '../../../contracts/reading'
import { createReadingAdapter } from '../index'
import { createRecordedEngine, record } from './index'
import { RECORDED_AT, RECORDINGS_DIR } from './__fixtures__/make-fixtures'
import { failure, snapshot, tempDir } from '../textlayer/__fixtures__/harness'

const FP = (fs.readdirSync(RECORDINGS_DIR)[0] ?? '').replace('.json', '')
const committed = (): Record<string, unknown> & { result: Record<string, unknown> } =>
  JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, `${FP}.json`), 'utf8')) as Record<string, unknown> & { result: Record<string, unknown> }

async function readFrom(planted: string | object, name = FP): Promise<Error | undefined> {
  const t = tempDir('recorded-unit')
  try {
    fs.writeFileSync(path.join(t.dir, `${name}.json`), typeof planted === 'string' ? planted : JSON.stringify(planted))
    return await failure(() => createRecordedEngine({ folder: t.dir }).read({ fingerprint: name }))
  } finally {
    t.cleanup()
  }
}

describe('ARC-16 recorded engine: the fingerprint is a file name, so it must be a sha256', () => {
  const read = (fingerprint: string) => failure(() => createRecordedEngine({ folder: RECORDINGS_DIR }).read({ fingerprint }))

  test('ARC-16 a path-like fingerprint is refused before any file is touched', async () => {
    expect((await read('../../etc/passwd'))?.message).toBe('recording refused: "../../etc/passwd" is not a sha256 fingerprint')
  })

  test.each([
    ['63 characters', FP.slice(1)],
    ['65 characters', `${FP}0`],
    ['upper case', FP.toUpperCase()],
    ['a prefix before a valid one', `x${FP}`],
    ['a suffix after a valid one', `${FP}\n`],
  ])('ARC-16 a fingerprint of %s is refused', async (_title, fp) => {
    expect((await read(fp))?.message).toContain('is not a sha256 fingerprint')
  })

  test('ARC-16 the missing-recording message is exact', async () => {
    const other = 'a'.repeat(64)
    expect((await read(other))?.message).toBe(`no recording for ${other}: re-record`)
  })
})

describe('ARC-16 recorded engine: each refusal says why', () => {
  test('ARC-16 a file that is not JSON', async () => {
    expect((await readFrom('{"fingerprint":'))?.message).toBe(`recording for ${FP} is refused: the file is not JSON`)
  })

  test.each([['an array', '[]'], ['null', 'null'], ['a string', '"x"']])('ARC-16 a file holding %s fails the recording schema', async (_t, text) => {
    expect((await readFrom(text))?.message).toContain(`recording for ${FP} is refused: the file fails the recording schema (`)
  })

  test('ARC-16 a missing source engine is named in the schema reason', async () => {
    const rest = committed()
    delete rest['sourceEngine']
    expect((await readFrom(rest))?.message).toContain('sourceEngine')
  })

  test('ARC-16 a blank source engine name or version is refused', async () => {
    for (const sourceEngine of [{ name: ' ', version: '1' }, { name: 'x', version: '' }]) {
      expect((await readFrom({ ...committed(), sourceEngine }))?.message).toContain('sourceEngine')
    }
  })

  test('ARC-16 every schema problem is listed as path: reason, joined by semicolons', async () => {
    const msg = (await readFrom({ ...committed(), recordedAt: 'yesterday', sourceEngine: { name: ' ', version: '1' } }))?.message ?? ''
    const inside = /\((.*)\)$/.exec(msg)?.[1] ?? ''
    const parts = inside.split('; ')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^recordedAt: .+/)
    expect(parts[1]).toMatch(/^sourceEngine\.name: .+/)
  })

  test('ARC-16 a recordedAt that is not a date-time is refused', async () => {
    expect((await readFrom({ ...committed(), recordedAt: 'yesterday' }))?.message).toContain('recordedAt')
  })

  test('ARC-16 an extra key at the top of the file is refused', async () => {
    expect((await readFrom({ ...committed(), extra: 1 }))?.message).toContain('extra')
  })

  test('ARC-16 a stored fingerprint that differs from the file name', async () => {
    expect((await readFrom({ ...committed(), fingerprint: 'b'.repeat(64) }))?.message).toBe(
      `recording for ${FP} is refused: its stored fingerprint differs from its file name`,
    )
  })

  test('ARC-16 a result for another document', async () => {
    const rec = committed()
    rec.result['documentFingerprint'] = 'a'.repeat(64)
    expect((await readFrom(rec))?.message).toBe(
      `recording for ${FP} is refused: the result's documentFingerprint differs from the fingerprint`,
    )
  })

  test('ARC-16 a recordedAt written with a UTC offset is accepted', async () => {
    expect(await readFrom({ ...committed(), recordedAt: '2026-10-01T12:00:00-04:00' })).toBeUndefined()
  })

  test('ARC-16 a clean copy of the committed recording is accepted', async () => {
    expect(await readFrom(committed())).toBeUndefined()
  })
})

describe('SEC-11 ARC-16 record: refusals write nothing', () => {
  test('ARC-16 record refuses a result that is for another document and writes nothing', async () => {
    const t = tempDir('recorded-unit')
    try {
      const src: ReadingEngine = { name: 's', isLive: false, read: () => Promise.resolve(committed().result as never) }
      const err = await failure(() => record({ fingerprint: 'x', bytes: new Uint8Array([1]) }, src, t.dir, { testWorld: true }))
      expect(err?.message).toBe('record refused: the result is for another document')
      expect(fs.readdirSync(t.dir)).toEqual([])
    } finally {
      t.cleanup()
    }
  })

  const never: ReadingEngine = { name: 'never (Test)', isLive: false, read: () => Promise.reject(new Error('engine ran')) }
  const doc = { fingerprint: FP, bytes: new Uint8Array([1, 2, 3]) }
  const loose = record as unknown as (...args: unknown[]) => Promise<unknown>

  test('SEC-11 record called with no options at all is refused with the test-world message', async () => {
    const t = tempDir('recorded-unit')
    try {
      const before = snapshot(t.dir)
      const err = await failure(() => loose(doc, never, t.dir))
      expect(err?.message).toBe('record is for the test world only: pass testWorld: true for made-up data')
      expect(snapshot(t.dir)).toEqual(before)
    } finally {
      t.cleanup()
    }
  })

  test('ARC-16 record on a document with no bytes is refused', async () => {
    const t = tempDir('recorded-unit')
    try {
      const err = await failure(() => record({ fingerprint: FP }, never, t.dir, { testWorld: true }))
      expect(err?.message).toBe('record needs the document bytes')
      expect(fs.readdirSync(t.dir)).toEqual([])
    } finally {
      t.cleanup()
    }
  })

  test('ARC-16 record creates a missing folder and returns what it wrote', async () => {
    const t = tempDir('recorded-unit')
    const saved = getClock()
    setClock(fixedClock(RECORDED_AT))
    try {
      const folder = path.join(t.dir, 'deeper', 'still')
      const bytes = new Uint8Array([9, 9, 9])
      const fp = createHash('sha256').update(bytes).digest('hex')
      const result = { ...committed().result, documentFingerprint: fp }
      const src: ReadingEngine = { name: 's', isLive: false, read: () => Promise.resolve(result as never) }
      const written = await record({ fingerprint: 'x', bytes }, src, folder, { testWorld: true })
      expect(fs.readdirSync(folder)).toEqual([`${written.fingerprint}.json`])
      expect(written.sourceEngine).toEqual(written.result.engine)
    } finally {
      setClock(saved)
      t.cleanup()
    }
  })
})

describe('ARC-16 the adapter switch needs a folder', () => {
  test('ARC-16 recorded with no recordings folder says what is missing', () => {
    expect(() => createReadingAdapter({ env: { OCR_ENGINE: 'recorded' } })).toThrow('the recorded engine needs a recordings folder: pass recordingsDir')
  })
})
