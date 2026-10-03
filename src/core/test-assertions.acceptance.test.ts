// CQ12 (ARC-15): no test passes without asserting. src/core/test-assertions.ts is a setup file that
// calls expect.hasAssertions() before each test; vitest.config.ts lists it in every project's setupFiles.
// These tests run the fixtures in src/core/__fixtures__/assertions/ under each project's own setup list
// (read from the real config) and check the floor holds: no assertion fails, one assertion passes.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import config from '../../vitest.config'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FLOOR = 'src/core/test-assertions.ts'
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs')

type ProjectConfig = { test?: { name?: string; setupFiles?: string[] } }
const projects = (config.test?.projects ?? []) as ProjectConfig[]
const NAMES = ['unit', 'db', 'evals'] as const
const setupOf = (name: string): string[] => projects.find((p) => p.test?.name === name)?.test?.setupFiles ?? []

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cq12-'))
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

interface Outcome {
  passed: number
  failed: number
  messages: string[]
}

/** Runs one fixture file under a project's setup files (the database boot files left out) and reads the JSON report. */
function runFixture(project: string, fixture: string): Outcome {
  const setupFiles = setupOf(project)
    .filter((f) => !f.startsWith('src/core/db/'))
    .map((f) => path.join(ROOT, f))
  const cfg = path.join(tmp, `${project}-${fixture}.config.mjs`)
  const out = path.join(tmp, `${project}-${fixture}.json`)
  const body = {
    root: ROOT,
    cacheDir: path.join(tmp, 'cache'),
    test: { include: [`src/core/__fixtures__/assertions/${fixture}.fixture.ts`], setupFiles, env: { TZ: 'America/Toronto' } },
  }
  fs.writeFileSync(cfg, `export default ${JSON.stringify(body)}\n`)
  spawnSync(process.execPath, [VITEST_BIN, 'run', '--config', cfg, '--reporter=json', `--outputFile=${out}`], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90_000,
  })
  const report = JSON.parse(fs.readFileSync(out, 'utf8')) as {
    numPassedTests: number
    numFailedTests: number
    testResults: { assertionResults: { failureMessages: string[] }[] }[]
  }
  return {
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    messages: report.testResults.flatMap((f) => f.assertionResults.flatMap((a) => a.failureMessages)),
  }
}

describe('CQ12 ARC-15 the assertion floor is in every project', () => {
  test('ARC-15 the floor file calls expect.hasAssertions before each test', () => {
    const src = fs.readFileSync(path.join(ROOT, FLOOR), 'utf8')
    expect(src).toMatch(/beforeEach\s*\(/)
    expect(src).toMatch(/expect\.hasAssertions\s*\(\s*\)/)
  })

  test.each(NAMES)('ARC-15 the %s project lists the floor in its setupFiles', (name) => {
    expect(projects.some((p) => p.test?.name === name), `project ${name} exists`).toBe(true)
    expect(setupOf(name)).toContain(FLOOR)
  })

  test.each(NAMES)('ARC-15 under the %s setup, a test with no assertion fails with an assertion message', (name) => {
    const r = runFixture(name, 'no-assertion')
    expect(r.passed, 'no assertion-free test may pass').toBe(0)
    expect(r.failed).toBe(4)
    for (const m of r.messages) expect(m).toMatch(/assertion/i)
  })

  test.each(NAMES)('ARC-15 under the %s setup, a test with one assertion passes', (name) => {
    const r = runFixture(name, 'one-assertion')
    expect(r.failed).toBe(0)
    expect(r.passed).toBe(3)
  })
})
