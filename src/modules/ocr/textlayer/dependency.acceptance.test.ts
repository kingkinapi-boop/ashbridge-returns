// A01 acceptance tests: the text-layer library needs no account, key, payment or network (END-8), card check 8.
//
// Public API these tests fix: TEXTLAYER_LIBRARY from src/modules/ocr/textlayer/index.ts, { name, version }: the npm
// package the engine reads PDFs with and its exact pinned version.
// `npm audit --audit-level=high` needs the registry, so tests cannot run it (no network in tests): the checker runs
// it on the build. These tests hold what can be checked offline: the pin, the lock, licences, install scripts,
// and that the engine's own source reads no setting and names no address. The engine's source is read through
// readOwnSource (DG round 3), so inside Stryker's sandbox the committed text is scanned, not the instrumented copy.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../../../core/testing/read-own-source'
import { TEXTLAYER_LIBRARY } from './index'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const HERE = path.dirname(fileURLToPath(import.meta.url))

interface LockEntry {
  version?: string
  license?: string
  hasInstallScript?: boolean
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}
interface Lock {
  packages: Record<string, LockEntry>
}
interface Manifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'))

/** Open-source licences that need no account, key or payment. */
const FREE_LICENCES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'BlueOak-1.0.0', 'MPL-2.0'])

/** Problems with `name` and everything it pulls in, as the lock records them (top-level node_modules layout). */
function lockProblems(lock: Lock, name: string): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const queue = [name]
  while (queue.length > 0) {
    const pkg = queue.shift()
    if (pkg === undefined || seen.has(pkg)) continue
    seen.add(pkg)
    const entry = lock.packages[`node_modules/${pkg}`]
    if (!entry) {
      if (pkg === name) problems.push(`${pkg} is not in package-lock.json`)
      continue // an optional platform package for another machine may be absent from a nested path; the root is required
    }
    if (!entry.license || !FREE_LICENCES.has(entry.license)) problems.push(`${pkg} has licence ${String(entry.license)}`)
    if (entry.hasInstallScript) problems.push(`${pkg} runs an install script`)
    queue.push(...Object.keys(entry.dependencies ?? {}), ...Object.keys(entry.optionalDependencies ?? {}))
  }
  return problems
}

/** Engine source files (not tests, not fixtures) under `dir`. */
function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|mts|js|mjs)$/.test(e.name) && !/\.test\.ts$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .filter((p) => !p.split(path.sep).includes('__fixtures__'))
}

/** Problems in engine source text: reading settings or keys, or naming a network address. */
function sourceProblems(file: string, text: string): string[] {
  const problems: string[] = []
  if (/process\.env|import\.meta\.env/.test(text)) problems.push(`${file} reads a setting`)
  if (/\b(?:https?|wss?):\/\//i.test(text)) problems.push(`${file} names a network address`)
  if (/\bapi[_-]?key\b|\bsecret\b/i.test(text)) problems.push(`${file} mentions a key`)
  return problems
}

describe('A01 check 8: the dependency needs no account, key or payment', () => {
  test('END-8 the library is a runtime dependency pinned to one exact version, the same in the lock and installed', () => {
    const manifest = readJson(path.join(ROOT, 'package.json')) as Manifest
    const lock = readJson(path.join(ROOT, 'package-lock.json')) as Lock
    const { name, version } = TEXTLAYER_LIBRARY
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(manifest.dependencies?.[name], `${name} in dependencies, pinned exactly`).toBe(version)
    expect(manifest.devDependencies?.[name], 'not also a dev dependency').toBeUndefined()
    expect(lock.packages['']?.dependencies?.[name]).toBe(version)
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(version)
    expect((readJson(path.join(ROOT, 'node_modules', name, 'package.json')) as { version: string }).version).toBe(version)
  })

  test('END-8 the library and everything it pulls in carry an open-source licence and run no install script', () => {
    const lock = readJson(path.join(ROOT, 'package-lock.json')) as Lock
    expect(lockProblems(lock, TEXTLAYER_LIBRARY.name)).toEqual([])
  })

  test('END-8 planted fault: a paid licence, an install script, a missing lock entry or an unlicensed sub-package is caught', () => {
    const lib = 'reader-lib-test'
    const base = (over: Partial<LockEntry>, sub: Partial<LockEntry> = {}): Lock => ({
      packages: {
        [`node_modules/${lib}`]: { version: '1.0.0', license: 'MIT', dependencies: { 'sub-test': '1.0.0' }, ...over },
        'node_modules/sub-test': { version: '1.0.0', license: 'MIT', ...sub },
      },
    })
    expect(lockProblems(base({}), lib)).toEqual([])
    expect(lockProblems(base({ license: 'SEE LICENSE IN EULA.txt' }), lib)).toHaveLength(1)
    expect(lockProblems(base({ hasInstallScript: true }), lib)).toHaveLength(1)
    expect(lockProblems(base({}, { license: 'UNLICENSED' }), lib)).toHaveLength(1)
    expect(lockProblems({ packages: {} }, lib)).toHaveLength(1)
  })

  test("END-8 the text-layer engine's own source reads no setting, holds no key and names no network address", () => {
    const files = sourceFiles(HERE)
    expect(files.length, 'the engine has source files').toBeGreaterThan(0)
    const problems = files.flatMap((f) => sourceProblems(path.relative(ROOT, f), readOwnSource(f)))
    expect(problems).toEqual([])
  })

  test('END-8 planted fault: source reading process.env, a vendor URL or an API key is caught', () => {
    expect(sourceProblems('a.ts', 'const k = process.env.PDF_VENDOR_KEY')).toHaveLength(1)
    expect(sourceProblems('b.ts', "await fetch('https://ocr.example.test/v1')")).toHaveLength(1)
    expect(sourceProblems('c.ts', "const apiKey = 'k'; const api_key = apiKey")).toHaveLength(1)
    expect(sourceProblems('d.ts', 'export const x = 1')).toEqual([])
  })
})
