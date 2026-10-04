// Card DG round 3, R20 (ARC-15): source-scan tests read their module's text as committed, even inside Stryker's sandbox.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'
import { readOwnSource } from './read-own-source'

const dirs: string[] = []
afterAll(() => {
  dirs.forEach((d) => {
    fs.rmSync(d, { recursive: true, force: true })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

const ORIGINAL = '// planted module\n// header line\n// @mutate\nexport const add = (a: number, b: number): number => a + b\n'
const BROKEN = 'export const add = (a: number, b: number): number => a + b\nimport http from "node:http"\nexport { http }\n'
// A real sandbox copy (card SC8; FX2 findings RC2): ORIGINAL as @stryker-mutator/instrumenter 10.0.0 writes it into
// the sandbox (instrument, then disableTypeChecks), captured 3 Oct 2026. Its preamble reads
// `g.process.env.__STRYKER_ACTIVE_MUTANT__`, which a made-up preamble never modelled.
const CAPTURED = fs.readFileSync(path.join(import.meta.dirname, '..', '..', '..', 'tools', 'test', '__fixtures__', 'source-read-rules', 'stryker-sandbox-mod.ts.txt'), 'utf8')
const PREAMBLE = CAPTURED.slice(CAPTURED.indexOf('function stryNS_9fa48'), CAPTURED.indexOf('export const add'))
// Stryker's layout on any module: the type-check opt-out, the module's leading comments, the real preamble, the body.
const instrument = (src: string): string => {
  const lines = src.split('\n')
  const lead = lines.findIndex((l) => !l.startsWith('//'))
  const head = lines.slice(0, lead).map((l) => `${l}\n`).join('')
  const body = lines.slice(lead).join('\n').replace('a + b', 'stryMutAct_9fa48("1") ? a - b : (stryCov_9fa48("1"), a + b)')
  return `// @ts-nocheck\n${head}${PREAMBLE}${body}`
}

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
    // SC8: real Stryker keeps the module's leading comments above its preamble, so the marker stays within 5 lines
    expect(onDisk.split('\n').slice(0, 5)).toEqual(['// @ts-nocheck', '// planted module', '// header line', '// @mutate', 'function stryNS_9fa48() {'])
    vi.spyOn(process, 'cwd').mockReturnValue(sandbox)
    expect(carriesMarker(readOwnSource('src/mod.ts'))).toBe(true)
  })

  test('R20 ARC-15 SC8: the planted sandbox preamble is the real captured one, with process.env', () => {
    expect(CAPTURED).toContain('g.process.env.__STRYKER_ACTIVE_MUTANT__')
    expect(PREAMBLE).toMatch(/^function stryNS_9fa48\(\) \{\n/)
    expect(PREAMBLE).toContain('function stryMutAct_9fa48(id)')
    expect(instrument(ORIGINAL).slice(0, instrument(ORIGINAL).indexOf('export const add'))).toBe(CAPTURED.slice(0, CAPTURED.indexOf('export const add')))
  })

  test('R20 ARC-15 SC8: a "no process.env" scan (as ocr/engine-setting.test.ts runs) fails on the raw sandbox copy and passes through the helper', () => {
    const { root, sandbox } = repo(ORIGINAL)
    expect(fs.readFileSync(`${sandbox}/src/mod.ts`, 'utf8')).toMatch(/process\.env/) // FX2's dry-run failure
    vi.spyOn(process, 'cwd').mockReturnValue(sandbox)
    for (const p of ['src/mod.ts', `${sandbox}/src/mod.ts`]) {
      expect(readOwnSource(p)).toBe(ORIGINAL)
      expect(readOwnSource(p)).not.toMatch(/process\.env/)
    }
    expect(fs.readFileSync(`${root}/src/mod.ts`, 'utf8')).toBe(ORIGINAL)
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
