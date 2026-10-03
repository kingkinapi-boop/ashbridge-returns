// CQ9 acceptance tests (ARC-15): stryker.config.mjs allows a long dry run (45 minutes) with incremental on,
// tools/mutate-changed.mjs passes extra arguments after `--` through to Stryker, a core card with no product
// code in its Paths prints "no product code to mutate" and exits 0, family cards are gated by their own Tags,
// and the per-file score of 100 (Survived plus NoCoverage equal 0) is unchanged.
// A fake Stryker (written into the temp world) records its command line and writes mutation.json.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(TOOLS, '..')
const tmpDirs = []
afterAll(() => tmpDirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

const G = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', '-c', 'commit.gpgsign=false']
function exec(cmd, a, opts = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, a, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (err += d))
    c.on('error', reject)
    c.on('close', (status) => resolve({ status, out, err }))
  })
}
async function git(cwd, ...a) {
  const r = await exec('git', [...G, ...a], { cwd })
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.err}`)
  return r.out.trim()
}
const put = (w, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(w, rel)), { recursive: true })
  fs.writeFileSync(path.join(w, rel), text)
}

// The fake Stryker: appends its argv to reports/argv.json and writes reports/mutation.json from FAKE_MUTANTS
// (a JSON map of file to a list of statuses; default every target Killed).
const FAKE_STRYKER = `
const fs = require('node:fs')
fs.mkdirSync('reports/mutation', { recursive: true })
fs.writeFileSync('reports/argv.json', JSON.stringify(process.argv.slice(2)))
const plan = JSON.parse(process.env.FAKE_MUTANTS || '{}')
const mutate = process.argv[process.argv.indexOf('--mutate') + 1] || ''
const files = {}
for (const f of mutate.split(',').filter(Boolean)) {
  const statuses = plan[f] || ['Killed', 'Killed']
  files[f] = { mutants: statuses.map((status, i) => ({ status, mutatorName: 'Fake', location: { start: { line: i + 1 } } })) }
}
fs.writeFileSync('reports/mutation/mutation.json', JSON.stringify({ files }))
`

async function world({ tags = 'Tags: core', core = false, family = null, familyTags = null, paths = ['src/**'], branch = {} } = {}) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'cq9-'))
  tmpDirs.push(w)
  await git(w, 'init', '-q', '-b', 'main')
  fs.cpSync(TOOLS, path.join(w, 'tools'), {
    recursive: true,
    filter: (s) => s !== path.join(TOOLS, 'test') && !s.includes(`${path.sep}__fixtures__`) && !s.includes('node_modules'),
  })
  const entry = { id: 'K', title: 't K', status: 'checking', spec: 'abc', deps: [], core, paths }
  if (family) Object.assign(entry, { family, params: {} })
  put(w, 'plan/slices.json', JSON.stringify({ blueprint: 'x', cards: [entry] }))
  if (family) put(w, `plan/cards/families/${family}.md`, `# ${family} family\n\nPhase 0. Size S.\n${familyTags}\nPaths: ${paths.join(', ')}\n`)
  else put(w, 'plan/cards/K.md', `# K card\n\nPhase 0. Size S.\n${tags}\nPaths: ${paths.join(', ')}\n`)
  put(w, 'package.json', '{"name":"x"}\n')
  put(w, 'node_modules/@stryker-mutator/core/bin/stryker.js', FAKE_STRYKER)
  put(w, '.gitignore', 'node_modules\nreports\n')
  await git(w, 'add', '-A')
  await git(w, 'commit', '-q', '-m', 'main')
  await git(w, 'checkout', '-q', '-b', 'claude/K')
  for (const [f, t] of Object.entries(branch)) put(w, f, t)
  await git(w, 'add', '-A')
  await git(w, 'commit', '-q', '-m', 'build K')
  return w
}
const run = async (w, extra = [], env = {}) => {
  const r = await exec('node', [path.join(w, 'tools', 'mutate-changed.mjs'), 'K', 'main', ...extra], { cwd: w, env: { ...process.env, ...env } })
  return { code: r.status, out: r.out, err: r.err }
}
const argvOf = (w) => JSON.parse(fs.readFileSync(path.join(w, 'reports', 'argv.json'), 'utf8'))
const marked = '// @mutate\nexport const x = 1\n'
const unmarked = 'export const x = 1\n'

describe('ARC-15 CQ9 rule 1: stryker.config.mjs allows a long dry run and runs incrementally', () => {
  test('ARC-15 the Stryker config sets dryRunTimeoutMinutes to 45', async () => {
    const cfg = (await import(path.join(ROOT, 'stryker.config.mjs'))).default
    expect(cfg.dryRunTimeoutMinutes).toBe(45)
  })

  test('ARC-15 the Stryker config keeps incremental on, with its report file under reports/mutation', async () => {
    const cfg = (await import(path.join(ROOT, 'stryker.config.mjs'))).default
    expect(cfg.incremental).toBe(true)
    expect(cfg.incrementalFile).toMatch(/^reports\/mutation\//)
  })
})

describe('ARC-15 CQ9 rule 2: arguments after -- reach Stryker', () => {
  test('ARC-15 planted: `-- --concurrency 4` is on the Stryker command line, with the target and incremental still there', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const r = await run(w, ['--', '--concurrency', '4'])
    expect(r.code, r.err).toBe(0)
    const argv = argvOf(w)
    const i = argv.indexOf('--concurrency')
    expect(i).toBeGreaterThan(-1)
    expect(argv[i + 1]).toBe('4')
    expect(argv).toContain('--incremental')
    expect(argv[argv.indexOf('--mutate') + 1]).toBe('src/core/money.ts')
  })

  test('ARC-15 without -- the command line carries no extra argument', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const r = await run(w)
    expect(r.code, r.err).toBe(0)
    expect(argvOf(w)).toEqual(['run', '--incremental', '--mutate', 'src/core/money.ts'])
  })

  test('ARC-15 the base argument still works with extra arguments (card, base, then --)', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const r = await run(w, ['--', '--timeoutMS', '90000'])
    expect(r.code, r.err).toBe(0)
    expect(argvOf(w)).toContain('--timeoutMS')
  })

  test('ARC-15 a pass-through argument is not run through a shell (a ; or $() stays one argument)', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const evil = '4; touch pwned'
    const r = await run(w, ['--', '--concurrency', evil])
    expect(r.code, r.err).toBe(0)
    expect(argvOf(w)).toContain(evil)
    expect(fs.existsSync(path.join(w, 'pwned'))).toBe(false)
  })
})

describe('ARC-15 CQ9 rule 3: the per-file score of 100 is unchanged', () => {
  test('ARC-15 a Survived mutant in a target fails the gate and names the file and line', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const r = await run(w, [], { FAKE_MUTANTS: JSON.stringify({ 'src/core/money.ts': ['Killed', 'Survived'] }) })
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/src\/core\/money\.ts: score 50, must be 100/)
    expect(r.err).toMatch(/line 2 Fake \(Survived\)/)
  })

  test('ARC-15 a NoCoverage mutant fails the gate the same way', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const r = await run(w, [], { FAKE_MUTANTS: JSON.stringify({ 'src/core/money.ts': ['Killed', 'NoCoverage'] }) })
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/NoCoverage/)
  })

  test('ARC-15 Killed and Timeout mutants only: the gate passes', async () => {
    const w = await world({ branch: { 'src/core/money.ts': marked } })
    const r = await run(w, [], { FAKE_MUTANTS: JSON.stringify({ 'src/core/money.ts': ['Killed', 'Timeout'] }) })
    expect(r.code, r.err).toBe(0)
  })

  test('ARC-15 one clean file does not hide a failing one', async () => {
    const w = await world({ branch: { 'src/core/a.ts': marked, 'src/core/b.ts': marked } })
    const r = await run(w, [], { FAKE_MUTANTS: JSON.stringify({ 'src/core/b.ts': ['Survived'] }) })
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/src\/core\/b\.ts/)
    expect(r.err).not.toMatch(/src\/core\/a\.ts: score/)
  })
})

describe('ARC-15 CQ9 also (A460): a core card with no product code in its Paths', () => {
  test('ARC-15 planted (SC Paths: tests, tools and fixtures only): prints "no product code to mutate" and exits 0', async () => {
    const w = await world({
      paths: ['tools/**', 'src/**/__fixtures__/**', 'src/**/*.test.ts'],
      branch: { 'tools/check.mjs': 'export const c = 1\n', 'src/modules/m/__fixtures__/f.ts': unmarked, 'src/modules/m/a.test.ts': 'export {}\n' },
    })
    const r = await run(w)
    expect(r.code, r.err).toBe(0)
    expect(r.out).toMatch(/no product code to mutate/)
    expect(r.err).not.toMatch(/no marked mutation target/)
  })

  test('ARC-15 a core card whose Paths hold a product glob and whose changed product file is unmarked still fails', async () => {
    const w = await world({ paths: ['src/**'], branch: { 'src/core/money.ts': unmarked, 'tools/x.mjs': 'export {}\n' } })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/core file without @mutate.*src\/core\/money\.ts/)
  })
})

describe('ARC-15 CQ9 also (A464): family cards are gated by their own Tags', () => {
  test('ARC-15 planted: a family card tagged core with an unmarked src file fails', async () => {
    const w = await world({ family: 'kind', familyTags: 'Tags: core', branch: { 'src/modules/m/calc.ts': unmarked } })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/core file without @mutate.*src\/modules\/m\/calc\.ts/)
  })

  test('ARC-15 a family card tagged core with a marked src file runs Stryker on it', async () => {
    const w = await world({ family: 'kind', familyTags: 'Tags: core', branch: { 'src/modules/m/calc.ts': marked } })
    const r = await run(w)
    expect(r.code, r.err).toBe(0)
    expect(r.out).toMatch(/mutating: src\/modules\/m\/calc\.ts/)
  })

  test('ARC-15 a family card not tagged core is not gated', async () => {
    const w = await world({ family: 'kind', familyTags: 'Tags: none.', branch: { 'src/modules/m/calc.ts': unmarked } })
    const r = await run(w)
    expect(r.code, r.err).toBe(0)
  })
})
