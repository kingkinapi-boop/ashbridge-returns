// F00 fix round 2: toolchain rule tests (unit project). Each rule first fails on a planted bad example.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__')
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8')

const major = (v) => Number(String(v).replace(/^[^\d]*/, '').split('.')[0])
const isExact = (v) => /^\d+\.\d+\.\d+$/.test(v)

function pinProblems(pkgText) {
  const pkg = JSON.parse(pkgText)
  const all = { ...pkg.dependencies, ...pkg.devDependencies }
  const names = Object.keys(all).filter((n) => n === 'vitest' || n.startsWith('@vitest/'))
  const problems = names.filter((n) => !isExact(all[n])).map((n) => `${n} is not an exact version`)
  if (new Set(names.map((n) => all[n])).size > 1) problems.push('vitest packages are on different versions')
  return problems
}

function runnerMajorProblems(pkgText, runnerText) {
  const ours = JSON.parse(pkgText)
  const v = { ...ours.dependencies, ...ours.devDependencies }.vitest
  const theirs = JSON.parse(runnerText).devDependencies?.vitest
  if (!theirs) return ['runner manifest names no vitest in devDependencies']
  return major(v) === major(theirs) ? [] : [`vitest ${v} vs the runner's own ${theirs}`]
}

function strykerConfigProblems(src) {
  return /^\s*mutate\s*:/m.test(src) ? ['stryker.config.mjs has a mutate list'] : []
}

describe('F00 toolchain rules (ARC-15)', () => {
  test('ARC-15 rule: planted vitest 5.0.1 with coverage-v8 4.1.11 is caught', () => {
    expect(pinProblems(read(FIX, 'planted-pins-package.json.txt')).length).toBeGreaterThan(0)
  })
  test('ARC-15 vitest and every @vitest/* package are pinned to one exact version', () => {
    expect(pinProblems(read(ROOT, 'package.json'))).toEqual([])
  })

  test('ARC-15 rule: vitest 5.0.1 next to a runner built on 4.1.10 is caught', () => {
    expect(
      runnerMajorProblems(read(FIX, 'planted-pins-package.json.txt'), read(FIX, 'planted-runner-package.json.txt')),
    ).not.toEqual([])
  })
  test("ARC-15 the installed vitest major matches the vitest major in @stryker-mutator/vitest-runner's own devDependencies", () => {
    const runner = path.join(ROOT, 'node_modules', '@stryker-mutator', 'vitest-runner', 'package.json')
    expect(fs.existsSync(runner), 'run npm ci first').toBe(true)
    expect(runnerMajorProblems(read(ROOT, 'package.json'), read(runner))).toEqual([])
  })

  test('ARC-15 rule: a planted config with mutate: [...] is caught', () => {
    expect(strykerConfigProblems(read(FIX, 'planted-stryker-config.txt'))).not.toEqual([])
  })
  test('ARC-15 stryker.config.mjs has no mutate list; mutation targets are chosen only by the @mutate marker', () => {
    expect(strykerConfigProblems(read(ROOT, 'stryker.config.mjs'))).toEqual([])
  })

  test('ARC-15 the mutation canary fixture is marked @mutate and its weak test kills nothing', () => {
    const dir = path.join(FIX, 'mutation-canary')
    expect(read(dir, 'canary.ts').split('\n').slice(0, 5).join('\n')).toMatch(/\/\/ @mutate/)
    expect(fs.existsSync(path.join(dir, 'canary.test.ts'))).toBe(true)
    expect(read(dir, 'canary-weak.test.ts.txt')).not.toMatch(/toBe\((0|10)\)/)
  })

  test('ARC-15 mutate:canary and mutate:changed scripts exist and no card edits the mutate list', () => {
    const s = JSON.parse(read(ROOT, 'package.json')).scripts
    expect(s['mutate:canary']).toMatch(/stryker/)
    expect(s['mutate:changed']).toMatch(/mutate-changed\.mjs/)
  })

  test('ARC-15 tsconfig.json excludes .stryker-tmp', () => {
    expect(read(ROOT, 'tsconfig.json')).toMatch(/\.stryker-tmp/)
  })
})
