import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { createRecordedEngine } from './index'
import { RECORDINGS_DIR } from './__fixtures__/make-fixtures'
import { failure, tempDir } from '../textlayer/__fixtures__/harness'

const FP = fs.readdirSync(RECORDINGS_DIR)[0]?.replace('.json', '') ?? ''

describe('ARC-16 recorded engine refusals', () => {
  test('ARC-16 a fingerprint that is not a sha256 is refused before any file is touched', async () => {
    const err = await failure(() => createRecordedEngine({ folder: RECORDINGS_DIR }).read({ fingerprint: '../../etc/passwd' }))
    expect(err?.message).toContain('not a sha256 fingerprint')
  })

  test('ARC-16 a result for another document is refused, naming documentFingerprint', async () => {
    const t = tempDir('recorded-unit')
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, `${FP}.json`), 'utf8')) as { result: Record<string, unknown> }
      rec.result['documentFingerprint'] = 'a'.repeat(64)
      fs.writeFileSync(path.join(t.dir, `${FP}.json`), JSON.stringify(rec))
      const err = await failure(() => createRecordedEngine({ folder: t.dir }).read({ fingerprint: FP }))
      expect(err?.message).toContain('documentFingerprint')
    } finally {
      t.cleanup()
    }
  })

  test('ARC-16 a recording that is a JSON array is refused', async () => {
    const t = tempDir('recorded-unit')
    try {
      fs.writeFileSync(path.join(t.dir, `${FP}.json`), '[]')
      const err = await failure(() => createRecordedEngine({ folder: t.dir }).read({ fingerprint: FP }))
      expect(err?.message).toContain('not a recording')
    } finally {
      t.cleanup()
    }
  })
})
