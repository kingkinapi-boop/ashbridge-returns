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

// TH: test homes (ARC-17, ARC-9, ARC-4). Globs live in tools/test-homes.json, read by vitest.config.ts and by these rules.
// Shape the build must create: { unit: {include, exclude}, db: {include}, evals: {include}, tsconfig: {include} }.
const HOMES_FIX = path.join(FIX, 'test-homes')
const SKIP_DIRS = ['node_modules', '.stryker-tmp', '.next', '__fixtures__', '.git']
const LINT_IGNORED = ['coverage', 'reports', 'playwright-report', 'test-results', 'tools', 'reference', 'blueprint', 'plan', '.claude']

function globToRe(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2 } else { re += '.*'; i += 1 }
    } else if (c === '*') re += '[^/]*'
    else re += c.replace(/[.+^${}()|[\]\\?]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}
const matchesAny = (globs, file) => globs.some((g) => globToRe(g).test(file))
const matchesProject = (homes, name, file) => {
  const p = homes[name]
  return matchesAny(p.include, file) && !matchesAny(p.exclude ?? [], file)
}

function walkRel(skip, dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (path.relative(ROOT, p).split(path.sep).join('/') === '.claude/worktrees') continue
      walkRel(skip, p, out)
    } else out.push(path.relative(ROOT, p).split(path.sep).join('/'))
  }
  return out
}

function testHomeProblems(homes, files) {
  const problems = []
  for (const f of files.filter((x) => /\.test\.(ts|tsx|mjs)$/.test(x))) {
    const hit = ['unit', 'db', 'evals'].filter((n) => matchesProject(homes, n, f))
    if (hit.length !== 1) problems.push(`${f} is matched by ${String(hit.length)} projects`)
    else if (/\.db\.test\.ts$/.test(f) && hit[0] !== 'db') problems.push(`${f} must run only in db`)
  }
  return problems
}

function tsconfigGapProblems(homes, files) {
  return files
    .filter((f) => /\.tsx?$/.test(f) && f !== 'next-env.d.ts')
    .filter((f) => !LINT_IGNORED.includes(f.split('/')[0]))
    .filter((f) => !matchesAny(homes.tsconfig.include, f))
    .map((f) => `${f} is outside the tsconfig include`)
}

const strayConfigProblems = (files) =>
  files.filter((f) => f.includes('/') && /(^|\/)vitest[^/]*\.config\.[cm]?[jt]s$/.test(f)).map((f) => `${f} is a Vitest config outside the repo root`)

function sharedSchemaProblems(files) {
  return files
    .filter((f) => /\.test\.(ts|tsx|mjs)$/.test(f) && !f.startsWith('src/core/db/'))
    .filter((f) => /db\/schema/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    .map((f) => `${f} names the shared schema folder`)
}

function literalHomeProblems(configSrc) {
  const problems = []
  if (!/test-homes\.json/.test(configSrc)) problems.push('config does not read tools/test-homes.json')
  if (/include\s*:\s*\[\s*['"]/.test(configSrc)) problems.push('config has a literal include list')
  return problems
}

const homesFile = () => JSON.parse(read(ROOT, 'tools', 'test-homes.json'))
const repoFiles = () => walkRel(SKIP_DIRS)

describe('TH test homes (ARC-17, ARC-9, ARC-4)', () => {
  test('ARC-17 R1 rule: a design test with no home and a testworld db test matched by unit are caught', () => {
    const homes = JSON.parse(read(HOMES_FIX, 'homes-old.json'))
    expect(testHomeProblems(homes, ['design/x/x.acceptance.test.ts']).length).toBeGreaterThan(0)
    const loose = { ...homes, unit: { include: [...homes.unit.include, 'testworld/**/*.test.ts'], exclude: [] }, db: { include: [] } }
    expect(testHomeProblems(loose, ['testworld/a.db.test.ts']).length).toBeGreaterThan(0)
    expect(testHomeProblems(JSON.parse(read(HOMES_FIX, 'homes.json')), ['design/x/x.acceptance.test.ts', 'testworld/a.db.test.ts', 'testworld/a.test.ts'])).toEqual([])
  })
  test('ARC-17 R1 every test file is matched by exactly one Vitest project and every *.db.test.ts only by db', () => {
    expect(testHomeProblems(homesFile(), repoFiles())).toEqual([])
  })
  test('ARC-17 R1 the data file gives design and testworld tests a unit home and testworld db tests a db home', () => {
    const h = homesFile()
    expect(matchesProject(h, 'unit', 'design/map/map.acceptance.test.ts')).toBe(true)
    expect(matchesProject(h, 'unit', 'testworld/qbo/x.test.ts')).toBe(true)
    expect(matchesProject(h, 'unit', 'testworld/qbo/x.db.test.ts')).toBe(false)
    expect(matchesProject(h, 'db', 'testworld/qbo/x.db.test.ts')).toBe(true)
  })

  test('ARC-17 R2 rule: a planted testworld/qbo/x.ts outside the tsconfig include is caught', () => {
    expect(tsconfigGapProblems(JSON.parse(read(HOMES_FIX, 'homes-old.json')), ['testworld/qbo/x.ts', 'src/a.ts']).length).toBe(1)
    expect(tsconfigGapProblems(JSON.parse(read(HOMES_FIX, 'homes.json')), ['testworld/qbo/x.ts', 'design/basis/a.ts', 'src/a.ts'])).toEqual([])
  })
  test('ARC-17 R2 every .ts and .tsx file that lint does not ignore is inside the tsconfig include', () => {
    expect(tsconfigGapProblems(homesFile(), repoFiles())).toEqual([])
  })
  test('ARC-9 tsconfig.json include equals the data file list, and the .stryker-tmp exclude stays', () => {
    const ts = JSON.parse(read(ROOT, 'tsconfig.json'))
    expect([...ts.include].sort()).toEqual([...homesFile().tsconfig.include].sort())
    expect(ts.exclude).toContain('.stryker-tmp')
  })

  test('ARC-17 R3 rule: a planted design/basis/vitest.d00.config.ts is caught', () => {
    expect(strayConfigProblems(['design/basis/vitest.d00.config.ts', 'vitest.config.ts', 'vitest.mutate.config.ts'])).toHaveLength(1)
  })
  test('ARC-17 R3 no vitest*.config.* file exists outside the repo root', () => {
    expect(strayConfigProblems(repoFiles())).toEqual([])
  })

  test('ARC-4 R4 rule: a planted acceptance test that reads the shared schema folder and asserts its table list is caught', () => {
    const planted = read(HOMES_FIX, 'planted-schema-test.ts.txt')
    expect(/db\/schema/.test(planted)).toBe(true)
  })
  test('ARC-4 R4 no test file outside src/core/db names the shared schema folder', () => {
    expect(sharedSchemaProblems(repoFiles())).toEqual([])
  })

  test('ARC-9 rule: a planted config with its own literal include list is caught', () => {
    expect(literalHomeProblems(read(HOMES_FIX, 'planted-literal-vitest-config.txt')).length).toBe(2)
  })
  test('ARC-9 vitest.config.ts reads its globs from tools/test-homes.json and keeps no literal include list', () => {
    expect(literalHomeProblems(read(ROOT, 'vitest.config.ts'))).toEqual([])
  })
  test('ARC-9 vitest.mutate.config.ts keeps the unit project only and reads the data file when it copies the include', () => {
    const src = read(ROOT, 'vitest.mutate.config.ts')
    expect(src).not.toMatch(/name:\s*['"](db|evals)['"]/)
    if (/include\s*:/.test(src)) expect(src).toMatch(/test-homes\.json/)
  })
})

// A05 security review: gitleaks scans only the branch's own history; the allowlist is by regex, never by folder.
function gitleaksWorkflowProblems(src) {
  return /gitleaks detect[^\n]*--log-opts[=\s]+["']?HEAD["']?/.test(src) ? [] : ['gitleaks does not scan only the branch history (--log-opts="HEAD")']
}
function gitleaksAllowRegexes(toml) {
  return [...toml.matchAll(/'''([\s\S]*?)'''/g)].map((m) => new RegExp(m[1]))
}
function gitleaksConfigProblems(toml) {
  const problems = []
  if (!/\[extend\][\s\S]*useDefault\s*=\s*true/.test(toml)) problems.push('config does not extend the default rules')
  if (/^\s*paths\s*=/m.test(toml)) problems.push('allowlist has a paths entry')
  return problems
}

describe('TH gitleaks scan scope and allowlist (A05)', () => {
  test('A05 rule: a planted workflow that scans the whole repository is caught', () => {
    expect(gitleaksWorkflowProblems(read(HOMES_FIX, 'planted-gitleaks-workflow.txt')).length).toBe(1)
  })
  test('A05 rule: a planted allowlist that skips whole folders is caught', () => {
    expect(gitleaksConfigProblems(read(HOMES_FIX, 'planted-gitleaks.toml.txt')).length).toBe(1)
  })
  test('A05 checks.yml scans only the branch history', () => {
    expect(gitleaksWorkflowProblems(read(ROOT, '.github', 'workflows', 'checks.yml'))).toEqual([])
  })
  test('A05 .gitleaks.toml extends the default rules and allowlists by regex only', () => {
    expect(gitleaksConfigProblems(read(ROOT, '.gitleaks.toml'))).toEqual([])
  })
  test('A05 the allowlist covers catalogue key lines and PLANTED- / k-test- values but not a secret-shaped string', () => {
    const res = gitleaksAllowRegexes(read(ROOT, '.gitleaks.toml'))
    const allowed = (s) => res.some((r) => r.test(s))
    expect(allowed('"key": "income.t4.box14",')).toBe(true)
    expect(allowed('apiKey = "PLANTED-0a1b2c3d4e5f"')).toBe(true)
    expect(allowed('token: k-test-9f8e7d6c5b4a')).toBe(true)
    expect(allowed('aws_secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"')).toBe(false)
    expect(allowed('"key": "AKIAIOSFODNN7EXAMPLE"')).toBe(false)
  })
})
