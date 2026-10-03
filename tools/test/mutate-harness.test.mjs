// CQ6 acceptance tests (ARC-15): tools/mutate-changed.mjs takes "core" from plan/slices.json or from anywhere
// in the card's Tags line, skips a Lead-kept harness list (tools/test-homes.json) and prints "harness, not
// mutated", and fails when a non-test module outside the list imports a listed file.
// Everything here stops before Stryker (the temp world has no node_modules), so the gates are what is tested.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HARNESS = [
  'src/core/db/index.ts',
  'src/core/db/global-setup.ts',
  'vitest-setup.ts',
  'src/core/test-no-network.ts',
  'src/core/testing/read-own-source.ts',
]
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

// main holds the tools (with the real tools/test-homes.json), card K and `base` files; the checkout then
// moves to branch claude/K with `branch` files committed on top. The base ref is the local `main`.
async function world({ tags = 'Tags: core', core = false, paths = ['src/**'], base = {}, branch = {} } = {}) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'cq6-'))
  tmpDirs.push(w)
  await git(w, 'init', '-q', '-b', 'main')
  fs.cpSync(TOOLS, path.join(w, 'tools'), {
    recursive: true,
    filter: (s) => s !== path.join(TOOLS, 'test') && !s.includes(`${path.sep}__fixtures__`) && !s.includes('node_modules'),
  })
  put(w, 'plan/slices.json', JSON.stringify({ blueprint: 'x', cards: [{ id: 'K', title: 't K', status: 'checking', spec: 'abc', deps: [], core, paths }] }))
  put(w, 'plan/cards/K.md', `# K card\n\nPhase 0. Size S.\n${tags}\nPaths: ${paths.join(', ')}\n`)
  put(w, 'package.json', '{"name":"x"}\n')
  for (const [f, t] of Object.entries(base)) put(w, f, t)
  await git(w, 'add', '-A')
  await git(w, 'commit', '-q', '-m', 'main')
  await git(w, 'checkout', '-q', '-b', 'claude/K')
  for (const [f, t] of Object.entries(branch)) put(w, f, t)
  await git(w, 'add', '-A')
  await git(w, 'commit', '-q', '-m', 'build K')
  return w
}
const run = async (w) => {
  const r = await exec('node', [path.join(w, 'tools', 'mutate-changed.mjs'), 'K', 'main'], { cwd: w })
  return { code: r.status, out: r.out, err: r.err }
}
const unmarked = 'export const x = 1\n'
const marked = '// @mutate\nexport const x = 1\n'

describe('ARC-15 CQ6 rule 1: core comes from slices.json or anywhere in the Tags line', () => {
  test('ARC-15 a card tagged "security, core" is gated: an unmarked changed file inside its paths fails', async () => {
    const w = await world({ tags: 'Tags: security, core', branch: { 'src/modules/m/calc.ts': unmarked } })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/core file without @mutate.*src\/modules\/m\/calc\.ts/)
  })

  test('ARC-15 core: true in plan/slices.json gates a card whose Tags line says none', async () => {
    const w = await world({ tags: 'Tags: none (queue tooling).', core: true, branch: { 'src/modules/m/calc.ts': unmarked } })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/core file without @mutate.*src\/modules\/m\/calc\.ts/)
  })

  test('ARC-15 a card that is neither (Tags none, core false) is not gated', async () => {
    const w = await world({ tags: 'Tags: security.', core: false, branch: { 'src/modules/m/calc.ts': unmarked } })
    const r = await run(w)
    expect(r.code).toBe(0)
    expect(r.err).not.toMatch(/core file without @mutate/)
  })

  test('ARC-15 the word core inside another word (a "hardcore" or "core-adjacent" tag) does not make a card core', async () => {
    const w = await world({ tags: 'Tags: hardcore, scorecard.', core: false, branch: { 'src/modules/m/calc.ts': unmarked } })
    const r = await run(w)
    expect(r.code).toBe(0)
  })
})

describe('ARC-15 CQ6 rule 2: the Lead-kept harness list is skipped and printed', () => {
  test('ARC-15 tools/test-homes.json carries a harness list of exactly the five Lead-named files', () => {
    const homes = JSON.parse(fs.readFileSync(path.join(TOOLS, 'test-homes.json'), 'utf8'))
    expect([...homes.harness].sort()).toEqual([...HARNESS].sort())
  })

  test('ARC-15 an unmarked harness file on a core card is not "core file without @mutate" and is printed "harness, not mutated"', async () => {
    const w = await world({
      branch: { 'src/core/db/global-setup.ts': unmarked, 'src/core/db/index.ts': unmarked, 'src/core/money.ts': marked },
    })
    const r = await run(w)
    expect(r.err).not.toMatch(/core file without @mutate/)
    expect(r.out).toMatch(/src\/core\/db\/global-setup\.ts.*harness, not mutated/)
    expect(r.out).toMatch(/src\/core\/db\/index\.ts.*harness, not mutated/)
    // it got past the gates to Stryker, which this world does not have; the harness files are not its targets
    expect(r.out).toMatch(/mutating: src\/core\/money\.ts\s*$/m)
  })

  test('ARC-15 every one of the five listed files is skipped, wherever it sits (root vitest-setup.ts included)', async () => {
    const files = Object.fromEntries(HARNESS.filter((f) => f.startsWith('src/')).map((f) => [f, unmarked]))
    const w = await world({ branch: { ...files, 'src/core/money.ts': marked } })
    const r = await run(w)
    expect(r.err).not.toMatch(/core file without @mutate/)
    for (const f of HARNESS.filter((x) => x.startsWith('src/'))) expect(r.out).toContain(`${f}`)
    expect(r.out.match(/harness, not mutated/g)).toHaveLength(4)
  })

  test('ARC-15 a file that only looks like a harness file (same name in another folder) is still gated', async () => {
    const w = await world({ branch: { 'src/modules/m/global-setup.ts': unmarked, 'src/core/money.ts': marked } })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/core file without @mutate.*src\/modules\/m\/global-setup\.ts/)
  })
})

describe('ARC-15 CQ6 rule 3: a product module importing a harness file fails', () => {
  test('ARC-15 planted: a product module importing global-setup.ts fails and names importer and imported file', async () => {
    const w = await world({
      branch: { 'src/core/money.ts': marked, 'src/modules/m/thing.ts': "import { setup } from '../../core/db/global-setup'\nexport const t = setup\n" },
    })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/src\/modules\/m\/thing\.ts/)
    expect(r.err).toMatch(/src\/core\/db\/global-setup/)
  })

  test('ARC-15 the importer need not be a changed file: one already on main still fails the gate', async () => {
    const w = await world({
      base: { 'src/modules/m/old.ts': "import '../../core/test-no-network'\n" },
      branch: { 'src/core/money.ts': marked },
    })
    const r = await run(w)
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/src\/modules\/m\/old\.ts/)
  })

  test('ARC-15 the import is caught with a .js or .ts extension, as export-from, and as a dynamic import', async () => {
    for (const line of [
      "import { a } from '../../core/db/index.js'\n",
      "export * from '../../core/testing/read-own-source.ts'\n",
      "export const l = () => import('../../core/db/global-setup')\n",
    ]) {
      const w = await world({ branch: { 'src/core/money.ts': marked, 'src/modules/m/thing.ts': line } })
      const r = await run(w)
      expect(r.code, line).toBe(1)
      expect(r.err, line).toMatch(/src\/modules\/m\/thing\.ts/)
    }
  })

  test('ARC-15 test files and the listed files themselves may import a harness file', async () => {
    const w = await world({
      branch: {
        'src/core/money.ts': marked,
        'src/core/db/index.ts': "import './global-setup'\n",
        'src/core/db/global-setup.ts': unmarked,
        'src/modules/m/thing.test.ts': "import '../../core/db/global-setup'\n",
        'src/modules/m/thing.db.test.ts': "import '../../core/db/index'\n",
        'src/modules/m/thing.acceptance.test.ts': "import '../../core/test-no-network'\n",
      },
    })
    const r = await run(w)
    expect(r.err).not.toMatch(/imports? .*(global-setup|test-no-network|db\/index)/i)
    expect(r.out).toMatch(/mutating: .*src\/core\/money\.ts/)
  })

  test('ARC-15 a product module importing an ordinary module (or a lookalike name) passes the import gate', async () => {
    const w = await world({
      branch: {
        'src/core/money.ts': marked,
        'src/core/db/index-helpers.ts': marked,
        'src/modules/m/thing.ts': "// @mutate\nimport { x } from '../../core/db/index-helpers'\nexport const y = x\n",
      },
    })
    const r = await run(w)
    expect(r.out).toMatch(/mutating: .*src\/core\/money\.ts/)
  })
})
