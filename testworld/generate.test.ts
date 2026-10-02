// Builder unit tests for checkRegeneration (ARC-16) against a small made-up sample folder with two fake generator scripts.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

const fake = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('node:os') as typeof import('node:os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path')
  return { base: fs.mkdtempSync(path.join(os.tmpdir(), 'gen-test-')) }
})

vi.mock('./clients/load', () => ({ SAMPLE_ROOT: fake.base + '/sample' }))

import { checkRegeneration } from './generate'

const SAMPLE = join(fake.base, 'sample')
const TMP = join(fake.base, 'tmp')

const GENERATE = `import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
const cwd = process.cwd()
if (!basename(cwd).startsWith('w00-regen-')) process.exit(3)
mkdirSync(join(cwd, '01-a'), { recursive: true })
writeFileSync(join(cwd, '01-a', 'gen.txt'), 'gen v1')
`
const MAKE_CSV = `import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
mkdirSync(join(process.cwd(), '02-b'), { recursive: true })
writeFileSync(join(process.cwd(), '02-b', 'data.csv'), 'a,b')
`

function put(rel: string, text: string): void {
  const p = join(SAMPLE, rel)
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, text)
}

beforeEach(() => {
  rmSync(SAMPLE, { recursive: true, force: true })
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  process.env['TMPDIR'] = TMP
  put('generate.mjs', GENERATE)
  put('make-csv.mjs', MAKE_CSV)
  put('01-a/gen.txt', 'gen v1')
  put('02-b/data.csv', 'a,b')
  // Things the checker must ignore: a numbered file, and a folder whose number is not at the start of its name.
  put('01-notes.txt', 'note')
  put('x01-extra/f.txt', 'extra')
})

afterAll(() => {
  rmSync(fake.base, { recursive: true, force: true })
})

describe('checkRegeneration', () => {
  test('ARC-16 identical output is reported identical; ignored names are not compared; the temp folder is removed', async () => {
    expect(await checkRegeneration()).toEqual({ identical: true, differing: [] })
    expect(readdirSync(TMP)).toEqual([])
    expect(tmpdir()).toBe(TMP)
  })

  test('ARC-16 changed, stale and missing files are listed, sorted, relative to the root', async () => {
    put('01-a/gen.txt', 'old')
    put('01-a/stale.txt', 'stale')
    rmSync(join(SAMPLE, '02-b', 'data.csv'))
    expect(await checkRegeneration()).toEqual({
      identical: false,
      differing: ['01-a/gen.txt', '01-a/stale.txt', '02-b/data.csv'],
    })
  })

  test('ARC-16 the list is sorted even when the missing file sorts before the stale one', async () => {
    rmSync(join(SAMPLE, '01-a', 'gen.txt'))
    put('02-b/zzz.txt', 'z')
    expect((await checkRegeneration()).differing).toEqual(['01-a/gen.txt', '02-b/zzz.txt'])
  })

  test('ARC-16 a backslash in a name is written as a slash in the list', async () => {
    put('01-a/odd\\name.txt', 'x')
    expect((await checkRegeneration()).differing).toEqual(['01-a/odd/name.txt'])
  })

  test('ARC-16 an explicit root is compared instead of the sample folder', async () => {
    const other = join(fake.base, 'other')
    rmSync(other, { recursive: true, force: true })
    cpSync(SAMPLE, other, { recursive: true })
    writeFileSync(join(other, '02-b', 'data.csv'), 'changed')
    expect(await checkRegeneration()).toEqual({ identical: true, differing: [] })
    expect(await checkRegeneration({ root: other })).toEqual({ identical: false, differing: ['02-b/data.csv'] })
  })

  test('ARC-16 a failing generator rejects and still removes the temp folder', async () => {
    put('generate.mjs', 'process.exit(1)\n')
    await expect(checkRegeneration()).rejects.toThrow()
    expect(readdirSync(TMP)).toEqual([])
  })
})
