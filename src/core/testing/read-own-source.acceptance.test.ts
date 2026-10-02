// Card DG round 3, R20 (ARC-15): source-scan tests read their module's text as committed, even inside Stryker's sandbox.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'
import { readOwnSource } from './read-own-source.ts'

const dirs: string[] = []
afterAll(() => {
  dirs.forEach((d) => {
    fs.rmSync(d, { recursive: true, force: true })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

const ORIGINAL = '// @mutate\nexport const add = (a: number, b: number): number => a + b\n'
const BROKEN = 'export const add = (a: number, b: number): number => a + b\nimport http from "node:http"\nexport { http }\n'
const instrument = (src: string): string =>
  `// @ts-nocheck\nfunction stryNS_9fa48() { return globalThis.__stryker__ ?? (globalThis.__stryker__ = {}) }\nconst __STRYKER_ACTIVE_MUTANT__ = stryNS_9fa48().activeMutant\n${src.replace('a + b', '__STRYKER_ACTIVE_MUTANT__ === 1 ? a - b : a + b')}`

// A temp repo with src/mod.ts, and a Stryker sandbox beside it holding an instrumented copy of the same relative path.
function repo(original: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'own-source-')).replace(/\\/g, '/')
  dirs.push(root)
  const sandbox = `${root}/.stryker-tmp/sandbox-abc123`
  for (const [base, body] of [[root, original], [sandbox, instrument(original)]] as const) {
    fs.mkdirSync(`${base}/src`, { recursive: true })
    fs.writeFileSync(`${base}/src/mod.ts`, body)
  }
  return { root, sandbox }
}

// the two source scans a card's own test would run
const carriesMarker = (src: string): boolean => src.split('\n').slice(0, 5).some((l) => l.includes('// @mutate'))
const importsNetwork = (src: string): boolean => /from\s+['"](?:node:)?(?:http|https|net|dns)['"]/.test(src)

describe('R20 readOwnSource: the committed text of a module, in and out of the Stryker sandbox', () => {
  test('R20 ARC-15: outside the sandbox it reads the path as given', () => {
    const { root } = repo(ORIGINAL)
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    expect(readOwnSource('src/mod.ts')).toBe(ORIGINAL)
    expect(readOwnSource(`${root}/src/mod.ts`)).toBe(ORIGINAL)
  })

  test('R20 ARC-15: inside the sandbox it returns the original text, not the instrumented copy, for a relative and an absolute path', () => {
    const { root, sandbox } = repo(ORIGINAL)
    vi.spyOn(process, 'cwd').mockReturnValue(sandbox)
    for (const p of ['src/mod.ts', `${sandbox}/src/mod.ts`]) {
      const text = readOwnSource(p)
      expect(text).toBe(ORIGINAL)
      expect(text).not.toContain('__STRYKER_ACTIVE_MUTANT__')
      expect(text).not.toContain('@ts-nocheck')
    }
    // the sandbox copy on disk really is instrumented, so a plain fs read would have been wrong
    expect(fs.readFileSync(`${sandbox}/src/mod.ts`, 'utf8')).toContain('__STRYKER_ACTIVE_MUTANT__')
    expect(root).not.toContain('.stryker-tmp')
  })

  test('R20 ARC-15: a "first 5 lines carry // @mutate" scan passes through the helper on the instrumented sandbox copy', () => {
    const { sandbox } = repo(ORIGINAL)
    const onDisk = fs.readFileSync(`${sandbox}/src/mod.ts`, 'utf8')
    expect(carriesMarker(onDisk)).toBe(false) // the sandbox header pushes the marker out of the first 5 lines
    vi.spyOn(process, 'cwd').mockReturnValue(sandbox)
    expect(carriesMarker(readOwnSource('src/mod.ts'))).toBe(true)
  })

  test('R20 ARC-15: a "no network import" scan passes on a clean module and still fails on a planted real violation, in the sandbox too', () => {
    const clean = repo(ORIGINAL)
    vi.spyOn(process, 'cwd').mockReturnValue(clean.sandbox)
    expect(importsNetwork(readOwnSource('src/mod.ts'))).toBe(false)

    const broken = repo(BROKEN)
    vi.spyOn(process, 'cwd').mockReturnValue(broken.sandbox)
    expect(importsNetwork(readOwnSource('src/mod.ts'))).toBe(true)
    expect(carriesMarker(readOwnSource('src/mod.ts'))).toBe(false)
  })

  test('R20 ARC-15: a missing file throws, it is not read as empty text', () => {
    const { sandbox } = repo(ORIGINAL)
    vi.spyOn(process, 'cwd').mockReturnValue(sandbox)
    expect(() => readOwnSource('src/nope.ts')).toThrow()
  })
})
