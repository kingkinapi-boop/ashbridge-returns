// F00 fix round 1: rule tests that run everywhere (unit project). Each rule is first shown
// failing on a planted bad example, then applied to the real repo.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__')
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8')

// Rule 1: only src/core/db/ may construct PGlite.
function filesConstructingPglite(files) {
  return files.filter((f) => /new\s+PGlite\s*\(/.test(read(f)))
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '__fixtures__', 'coverage', 'test-results'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(e.name)) out.push(p)
  }
  return out
}

// Rule 2: the db project config is explicit and every number is measured.
function dbConfigProblems(src) {
  const m = /name:\s*['"]db['"][\s\S]*?(?=\n\s{6}\},?\n\s{4}\}|name:\s*['"]evals['"]|$)/.exec(src)
  const block = m ? m[0] : ''
  const problems = []
  for (const key of ['globalSetup', 'setupFiles', 'hookTimeout', 'testTimeout']) {
    if (!new RegExp(`\\b${key}\\s*:`).test(block)) problems.push(`db project has no ${key}`)
  }
  for (const key of ['hookTimeout', 'testTimeout']) {
    const lines = src.split('\n')
    const i = lines.findIndex((l) => new RegExp(`\\b${key}\\s*:\\s*[\\d_]+`).test(l))
    if (i >= 0 && !/measured/i.test(lines.slice(Math.max(0, i - 3), i + 1).join('\n') + (lines[i + 1] ?? ''))) {
      problems.push(`${key} has no "measured" comment`)
    }
  }
  return problems
}

// Rule 3: npm test runs unit and db one after the other, never in one command.
function testScriptProblems(pkg) {
  const s = JSON.parse(pkg).scripts?.test ?? ''
  const problems = []
  if (/--project\s+unit[^&]*--project\s+db|--project\s+db[^&]*--project\s+unit/.test(s)) {
    problems.push('test runs unit and db in one command')
  }
  if (!/--project\s+unit/.test(s) || !/--project\s+db/.test(s)) problems.push('test must run unit and db')
  if (!/&&/.test(s)) problems.push('test must chain unit then db with &&')
  return problems
}

describe('F00 database rules (ARC-4)', () => {
  test('ARC-4 rule: a planted file with new PGlite() outside src/core/db is caught', () => {
    expect(filesConstructingPglite([path.join(FIX, 'planted-new-pglite.txt')])).toHaveLength(1)
  })
  test('ARC-4 rule: no file outside src/core/db constructs PGlite', () => {
    const dbDir = path.join(ROOT, 'src', 'core', 'db') + path.sep
    const files = ['src', 'e2e', 'tools', 'scripts']
      .map((d) => path.join(ROOT, d))
      .filter((d) => fs.existsSync(d))
      .flatMap((d) => walk(d))
      .filter((f) => !f.startsWith(dbDir))
      .filter((f) => !f.endsWith('db-rules.test.mjs'))
    expect(filesConstructingPglite(files)).toEqual([])
  })

  test('ARC-4 rule: a planted vitest config without the db settings is caught', () => {
    expect(dbConfigProblems(read(FIX, 'planted-vitest-config.txt')).length).toBeGreaterThanOrEqual(4)
  })
  test('ARC-4 rule: the db project sets globalSetup, setupFiles, hookTimeout and testTimeout, each timeout measured', () => {
    expect(dbConfigProblems(read(ROOT, 'vitest.config.ts'))).toEqual([])
  })

  test('ARC-4 rule: a planted test script running both projects in one command is caught', () => {
    expect(testScriptProblems(read(FIX, 'planted-package.json.txt'))).not.toEqual([])
  })
  test('ARC-4 rule: npm test runs unit and db one after the other', () => {
    expect(testScriptProblems(read(ROOT, 'package.json'))).toEqual([])
  })
})
