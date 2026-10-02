// A07 acceptance tests: the .xlsx library needs no account, key or payment (END-8), card check 10.
//
// Public API: XLSX_LIBRARY from src/modules/sheets/xlsx/index.ts, { name, version }: the npm package that reads .xlsx
// and its exact pinned version. `npm audit --audit-level=high` needs the registry, so tests cannot run it (no network
// in tests): the checker runs it on the build. These tests hold what can be checked offline: the pin, the lock, no
// paid licence, no install script, not the npm `xlsx` package, and that the sheets module's own source reads no
// setting, holds no key and names no network address.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../../core/testing/read-own-source'
import { XLSX_LIBRARY } from './xlsx/index'
import { ROOT } from './__fixtures__/harness'

const MODULE = 'src/modules/sheets'

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

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))

/** A licence that means "pay or ask first": npm's UNLICENSED (proprietary), a pointer to a private licence file, commercial terms. */
const PAID = /UNLICENSED|SEE LICEN[CS]E IN|commercial|proprietary/i

/** Problems with `name` and everything it pulls in, as the lock records them (hoisted top-level layout). */
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
      continue
    }
    if (entry.license !== undefined && PAID.test(entry.license)) problems.push(`${pkg} has licence ${entry.license}`)
    if (entry.hasInstallScript) problems.push(`${pkg} runs an install script`)
    queue.push(...Object.keys(entry.dependencies ?? {}), ...Object.keys(entry.optionalDependencies ?? {}))
  }
  return problems
}

/** Module source files (not tests, not fixtures), relative to the repo root. */
function sourceFiles(): string[] {
  return fs
    .readdirSync(path.join(ROOT, MODULE), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|mts|js|mjs)$/.test(e.name) && !/\.test\.ts$/.test(e.name))
    .map((e) => path.relative(ROOT, path.join(e.parentPath, e.name)))
    .filter((p) => !p.split(path.sep).includes('__fixtures__'))
}

/** Problems in source text: reading settings or keys, naming a network address, or importing a network client. */
function sourceProblems(file: string, text: string): string[] {
  const problems: string[] = []
  if (/process\.env|import\.meta\.env/.test(text)) problems.push(`${file} reads a setting`)
  // XML namespace names (schemas.openxmlformats.org, schemas.microsoft.com) are identifiers, not addresses.
  if (/\b(?:https?|wss?):\/\/(?!schemas\.(?:openxmlformats\.org|microsoft\.com)\/)/i.test(text)) problems.push(`${file} names a network address`)
  if (/\bapi[_-]?key\b|\bsecret\b|\blicen[cs]e[_-]?key\b/i.test(text)) problems.push(`${file} mentions a key`)
  if (/from\s+['"](?:node:)?(?:https?|net|tls|dgram)['"]|\bfetch\s*\(/.test(text)) problems.push(`${file} uses the network`)
  return problems
}

describe('A07 check 10: the .xlsx library is free (END-8)', () => {
  test('END-8 the library is a runtime dependency pinned to one exact version, the same in the lock and installed', () => {
    const manifest = readJson('package.json') as Manifest
    const lock = readJson('package-lock.json') as Lock
    const { name, version } = XLSX_LIBRARY
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(manifest.dependencies?.[name], `${name} in dependencies, pinned exactly`).toBe(version)
    expect(manifest.devDependencies?.[name], 'not also a dev dependency').toBeUndefined()
    expect(lock.packages['']?.dependencies?.[name]).toBe(version)
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(version)
    expect((readJson(`node_modules/${name}/package.json`) as { version: string }).version).toBe(version)
  })

  test('END-8 it is not the npm "xlsx" package (its npm release carries known high advisories), and that package is not installed as a dependency', () => {
    const manifest = readJson('package.json') as Manifest
    expect(XLSX_LIBRARY.name).not.toBe('xlsx')
    expect(manifest.dependencies?.['xlsx']).toBeUndefined()
    expect(manifest.devDependencies?.['xlsx']).toBeUndefined()
  })

  test('END-8 the library and everything it pulls in carry no paid licence and run no install script', () => {
    expect(lockProblems(readJson('package-lock.json') as Lock, XLSX_LIBRARY.name)).toEqual([])
  })

  test('END-8 planted fault: a proprietary licence, an install script, a missing lock entry or a paid sub-package is caught', () => {
    const lib = 'reader-lib-test'
    const base = (over: Partial<LockEntry>, sub: Partial<LockEntry> = {}): Lock => ({
      packages: {
        [`node_modules/${lib}`]: { version: '1.0.0', license: 'MIT', dependencies: { 'sub-test': '1.0.0' }, ...over },
        'node_modules/sub-test': { version: '1.0.0', license: 'MIT', ...sub },
      },
    })
    expect(lockProblems(base({}), lib)).toEqual([])
    expect(lockProblems(base({ license: 'SEE LICENSE IN EULA.txt' }), lib)).toHaveLength(1)
    expect(lockProblems(base({ license: 'UNLICENSED' }), lib)).toHaveLength(1)
    expect(lockProblems(base({ hasInstallScript: true }), lib)).toHaveLength(1)
    expect(lockProblems(base({}, { license: 'Commercial' }), lib)).toHaveLength(1)
    expect(lockProblems({ packages: {} }, lib)).toHaveLength(1)
    expect(lockProblems(base({ license: '(MIT OR GPL-3.0-or-later)' }, { license: 'Unlicense' }), lib)).toEqual([])
  })

  test("END-8 the sheets module's own source reads no setting, holds no key and uses no network", () => {
    const files = sourceFiles()
    expect(files.length, 'the module has source files').toBeGreaterThan(0)
    expect(files.flatMap((f) => sourceProblems(f, readOwnSource(f)))).toEqual([])
  })

  test('END-8 planted fault: source reading process.env, a vendor URL, an API key or fetch is caught', () => {
    expect(sourceProblems('a.ts', 'const k = process.env.SHEETS_VENDOR_KEY')).toHaveLength(1)
    expect(sourceProblems('b.ts', "const u = 'https://sheets.example.test/v1'")).toHaveLength(1)
    expect(sourceProblems('c.ts', "const apiKey = 'k'; const api_key = apiKey")).toHaveLength(1)
    expect(sourceProblems('d.ts', 'await fetch(u)')).toHaveLength(1)
    expect(sourceProblems('e.ts', "import https from 'node:https'")).toHaveLength(1)
    expect(sourceProblems('f.ts', 'export const x = 1')).toEqual([])
    expect(sourceProblems('g.ts', "const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'")).toEqual([])
  })
})
