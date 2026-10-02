import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { createFileStore } from './index'

test('ARC-6 an engine setting that is neither local nor live is refused naming the setting, not the value', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a05-unit-'))
  try {
    expect(() => createFileStore({ root, env: { STORAGE_FILES_ENGINE: 'zzz-secret-value' } })).toThrow(
      /STORAGE_FILES_ENGINE must be local or live$/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
