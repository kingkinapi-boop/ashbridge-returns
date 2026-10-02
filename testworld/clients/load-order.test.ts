// Builder unit tests: the loader does not rely on the order the file system lists a folder in (ARC-8, determinism).
// Every directory listing is handed back reversed, so only the loader's own sort can put things in order.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const reversed = (...args: Parameters<typeof actual.readdirSync>): unknown => (actual.readdirSync as (...a: unknown[]) => unknown[])(...args).reverse()
  return { ...actual, default: actual, readdirSync: reversed }
})

const { clientFolders, loadClient } = await import('./load')
const { FOLDERS, SAMPLE_ROOT } = await import('../__fixtures__/sample-copy')
const { TestWorldLoadError } = await import('../model/schema')

const made: string[] = []
afterAll(() => {
  for (const r of made.splice(0)) rmSync(r, { recursive: true, force: true })
})

describe('ARC-8 listing order', () => {
  it('ARC-8 client folders come back in id order whatever order the folder lists them in', () => {
    const root = mkdtempSync(join(tmpdir(), 'w00-order-'))
    made.push(root)
    for (const name of ['03-c', '01-a', '02-b']) {
      mkdirSync(join(root, name))
      writeFileSync(join(root, name, 'answer-key.json'), '{}')
    }
    expect([...clientFolders(root).keys()]).toEqual(['C01', 'C02', 'C03'])
  })

  it('SEC-11 the guard walks a client folder in name order, so its issues come in a fixed order', () => {
    const root = mkdtempSync(join(tmpdir(), 'w00-order-'))
    made.push(root)
    cpSync(join(SAMPLE_ROOT, FOLDERS.C10), join(root, FOLDERS.C10), { recursive: true })
    const dir = join(root, FOLDERS.C10)
    for (const f of ['b.md', 'a.md', 'c.md']) writeFileSync(join(dir, f), `Write to ${f.slice(0, 1)}@real-firm.com\n`)
    let issues: { record: string }[] = []
    try {
      loadClient('C10', { root })
    } catch (e) {
      expect(e).toBeInstanceOf(TestWorldLoadError)
      issues = (e as InstanceType<typeof TestWorldLoadError>).issues
    }
    expect(issues.map((i) => i.record)).toEqual(['a.md', 'b.md', 'c.md'])
  })
})
