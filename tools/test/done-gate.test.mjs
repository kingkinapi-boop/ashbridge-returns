// Rule tests R19 to R22 (card DG, findings review E03-F03): the done gate reads what the jobs actually did.
//   R19 scope.mjs: spec files by commit, spec files edited by the build, the ledger rows.
//   R20 mutate-changed.mjs: a core card's changed src file must carry // @mutate, no card id is a usage error.
//   R21 scope.mjs --board: a card branch carrying plan/ledger.jsonl does not board.
//   R22 mutate-changed.mjs per-file break: every // @mutate file scores 100 in the Stryker JSON report; a disable comment needs a reason.
// Every case runs the real tools against a temp git repo built from tools/test/__fixtures__/done-gate/ (a base commit on
// main, then the commits a spec job and a build job would make). No real repo history is read. Node built-ins only.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

// Each case spawns several node and git processes; Windows is slow at that.
vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = path.resolve(TOOLS, '..')
const FIX = path.join(TOOLS, 'test', '__fixtures__', 'done-gate')
const tmpDirs = []
afterAll(() => tmpDirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

const G = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', '-c', 'commit.gpgsign=false']
const git = (cwd, ...a) => execFileSync('git', [...G, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const fixture = (rel) => fs.readFileSync(path.join(FIX, rel), 'utf8')
// a tree body from the fixtures: the .txt suffix keeps code-shaped files out of tsc and eslint
const tree = (name) => fixture(`trees/${name}`)

// A temp repo: main holds a copy of tools/ (the tools find their root from their own location), the fixture slices
// file, the two fixture cards and the Stryker stub. HEAD ends on branch claude/<card>.
function world(card) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'done-gate-')).replace(/\\/g, '/')
  tmpDirs.push(root)
  git(root, 'init', '-q', '-b', 'main')
  fs.cpSync(TOOLS, path.join(root, 'tools'), { recursive: true, filter: (s) => !s.startsWith(path.join(TOOLS, 'test')) })
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  put('plan/slices.json', fixture('slices.json'))
  for (const c of ['DGC', 'DGP', 'DGT']) put(`plan/cards/${c}.md`, fixture(`cards/${c}.md`))
  put('node_modules/@stryker-mutator/core/bin/stryker.js', tree('stryker-stub.js.txt'))
  put('README.md', 'base\n')
  git(root, 'add', '-f', '.')
  git(root, 'commit', '-q', '-m', 'main')
  git(root, 'checkout', '-q', '-b', `claude/${card}`)
  const commit = (subject, files) => {
    for (const [rel, body] of Object.entries(files)) put(rel, body)
    git(root, 'add', '-f', ...Object.keys(files))
    git(root, 'commit', '-q', '-m', subject)
    return git(root, 'rev-parse', 'HEAD')
  }
  return { root, put, commit, head: () => git(root, 'rev-parse', 'HEAD') }
}

function tool(w, name, args) {
  const r = spawnSync('node', [path.join(w.root, 'tools', name), ...args], { cwd: w.root, encoding: 'utf8' })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}
const scope = (w, card, ...extra) => tool(w, 'scope.mjs', [card, 'main', ...extra])
const mutate = (w, ...args) => tool(w, 'mutate-changed.mjs', args)
const strykerArgs = (w) => {
  try {
    return fs.readFileSync(path.join(w.root, 'stryker-called.txt'), 'utf8')
  } catch {
    return null
  }
}

// What a spec job commits (spec-writer step 7): an acceptance test, a golden, and a fixture outside the card's Paths.
const SPEC_FILES = {
  'src/gate/gate.acceptance.test.ts': tree('acceptance.test.ts.txt'),
  'src/gate/__golden__/out.txt': tree('golden.txt'),
  'src/shared/__fixtures__/catalogue.ts': tree('fixture.ts.txt'),
}
const specCommit = (w, card = 'DGC') => w.commit(`spec(${card}): acceptance tests`, SPEC_FILES)

describe('R19 scope: the spec files are found by commit, the build cannot edit them, the ledger is not outside', () => {
  test('R19 ARC-12: a branch whose only extra file is a plan/ledger.jsonl row passes and the ledger line is printed', () => {
    const w = world('DGC')
    w.commit('budget hook row', { 'plan/ledger.jsonl': tree('ledger-row.txt') })
    const r = scope(w, 'DGC')
    expect(r.code).toBe(0)
    expect(r.out).toContain('ledger rows on this branch: revert before boarding')
    expect(r.out).not.toMatch(/outside the card's paths/)
  })

  test('R19 ARC-12: a ledger row next to a file outside the paths fails naming only the outside file', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'plan/ledger.jsonl': tree('ledger-row.txt'), 'src/other/oops.ts': tree('impl-unmarked.ts.txt') })
    const r = scope(w, 'DGC')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/other/oops.ts')
    expect(r.out).not.toMatch(/^\s+plan\/ledger\.jsonl/m)
  })

  test("R19 ARC-12: a spec(<card>) commit's __fixtures__ file outside the card's Paths passes", () => {
    const w = world('DGC')
    specCommit(w)
    const r = scope(w, 'DGC')
    expect(r.code).toBe(0)
    expect(r.out).toContain('SCOPE OK')
  })

  test('R19 ARC-12: a file outside the card paths in a build commit fails naming it', () => {
    const w = world('DGC')
    specCommit(w)
    w.commit('build DGC: first cut', { 'src/gate/add.ts': tree('impl-marked.ts.txt'), 'src/other/oops.ts': tree('impl-unmarked.ts.txt') })
    const r = scope(w, 'DGC')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/other/oops.ts')
    expect(r.out).not.toContain('src/gate/add.ts')
  })

  test('R19 ARC-19: a build commit that edits the spec commit fixture fails as "spec file edited by the build" naming the file and the commit', () => {
    const w = world('DGC')
    specCommit(w)
    const sha = w.commit('build DGC: tidy the catalogue', { 'src/shared/__fixtures__/catalogue.ts': `${tree('fixture.ts.txt')}// edited by the build\n` })
    const r = scope(w, 'DGC')
    expect(r.code).toBe(1)
    expect(r.out).toContain('spec file edited by the build')
    expect(r.out).toContain('src/shared/__fixtures__/catalogue.ts')
    expect(r.out).toContain(sha.slice(0, 7))
  })

  test('R19 ARC-19: a build edit to a golden file or an acceptance test fails the same way', () => {
    const golden = world('DGC')
    specCommit(golden)
    const g = golden.commit('build DGC: make the golden pass', { 'src/gate/__golden__/out.txt': 'changed by the build\n' })
    const rg = scope(golden, 'DGC')
    expect(rg.code).toBe(1)
    expect(rg.out).toContain('spec file edited by the build')
    expect(rg.out).toContain('src/gate/__golden__/out.txt')
    expect(rg.out).toContain(g.slice(0, 7))

    const test = world('DGC')
    specCommit(test)
    const t = test.commit('build DGC: relax the test', { 'src/gate/gate.acceptance.test.ts': '// emptied by the build\n' })
    const rt = scope(test, 'DGC')
    expect(rt.code).toBe(1)
    expect(rt.out).toContain('spec file edited by the build')
    expect(rt.out).toContain('src/gate/gate.acceptance.test.ts')
    expect(rt.out).toContain(t.slice(0, 7))
  })

  test('R19 ARC-19: a later spec(<card>) commit may edit its own spec files, and the build may add files of its own', () => {
    const w = world('DGC')
    specCommit(w)
    w.commit('build DGC: first cut', { 'src/gate/add.ts': tree('impl-marked.ts.txt') })
    w.commit('spec(DGC): fix round 2', { 'src/shared/__fixtures__/catalogue.ts': `${tree('fixture.ts.txt')}// round 2\n` })
    const r = scope(w, 'DGC')
    expect(r.code).toBe(0)
    expect(r.out).toContain('SCOPE OK')
  })

  test('R19 ARC-12: only the commits subjected spec(<this card>): count, another card spec commit does not open its files', () => {
    const w = world('DGC')
    w.commit('spec(DGP): acceptance tests', { 'src/shared/__fixtures__/other.ts': tree('fixture.ts.txt') })
    const r = scope(w, 'DGC')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/shared/__fixtures__/other.ts')
  })
})

describe('R20 mutate-changed: a core file with no marker is a failure, not a silent pass', () => {
  test('R20 ARC-15: a core card with an unmarked changed src file fails naming the file before Stryker runs', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('core file without @mutate')
    expect(r.out).toContain('src/gate/add.ts')
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: a marker below the first 5 lines does not count', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-marker-late.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/gate/add.ts')
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: the same unmarked file on a non-core card passes the marker gate', () => {
    const w = world('DGP')
    w.commit('build DGP', { 'src/plain/add.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGP', 'main')
    expect(r.code).toBe(0)
    expect(r.out).not.toContain('core file without @mutate')
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: a marked core file goes to Stryker, with the file named in its arguments', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-marked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(r.out).not.toContain('core file without @mutate')
    const args = strykerArgs(w)
    expect(args).not.toBeNull()
    expect(args).toContain('--mutate')
    expect(args).toContain('src/gate/add.ts')
  })

  test('R20 ARC-15: test files, and src files outside the card Paths, need no marker', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-marked.ts.txt'), 'src/gate/add.test.ts': tree('impl-test.test.ts.txt'), 'src/elsewhere/util.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(r.out).not.toContain('core file without @mutate')
    expect(strykerArgs(w)).toContain('src/gate/add.ts')
    expect(strykerArgs(w)).not.toContain('util.ts')
    expect(strykerArgs(w)).not.toContain('add.test.ts')
  })

  test('R20 ARC-15: a non-core card that changed no src file at all exits 0 with "no mutation targets changed" (DG2 retires the core case, see below)', () => {
    const w = world('DGP')
    w.commit('reports only', { 'reports/DGP-build.md': '# report\n' })
    const r = mutate(w, 'DGP', 'main')
    expect(r.code).toBe(0)
    expect(r.out).toContain('no mutation targets changed')
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: no card id exits 2 with the usage line, so a missing argument cannot pass', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w)
    expect(r.code).toBe(2)
    expect(r.out).toContain('usage: node tools/mutate-changed.mjs <card> [base]')
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: a card id with no card file is a usage error', () => {
    const w = world('DGC')
    const r = mutate(w, 'NOPE', 'main')
    expect(r.code).toBe(2)
    expect(strykerArgs(w)).toBeNull()
  })
})

// DG2 (findings W00 r1 RC2): the gate covers testworld/ and a core card never passes with nothing to score.
const TW_MONEY = 'testworld/model/money.ts'
describe('R20 DG2 mutate-changed: testworld code is mutation-tested and a core card needs a marked target', () => {
  test('R20 ARC-15: a core card with Paths only under testworld/ and an unmarked changed testworld file fails naming the file, before Stryker runs', () => {
    const w = world('DGT')
    w.commit('build DGT', { [TW_MONEY]: tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGT', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('core file without @mutate')
    expect(r.out).toContain(TW_MONEY)
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: a marked testworld file goes to Stryker with the file named in its arguments', () => {
    const w = world('DGT')
    w.commit('build DGT', { [TW_MONEY]: tree('impl-marked.ts.txt'), 'testworld/model/guard.ts': tree('impl-sub-marked.ts.txt') })
    const r = mutate(w, 'DGT', 'main')
    expect(r.code).toBe(0)
    const args = strykerArgs(w)
    expect(args).toContain('--mutate')
    expect(args).toContain(TW_MONEY)
    expect(args).toContain('testworld/model/guard.ts')
  })

  test('R20 ARC-15: testworld test files, fixtures and goldens are never targets and need no marker', () => {
    const w = world('DGT')
    w.commit('build DGT', {
      [TW_MONEY]: tree('impl-marked.ts.txt'),
      'testworld/model/money.test.ts': tree('impl-test.test.ts.txt'),
      'testworld/model/money.acceptance.test.ts': tree('impl-test.test.ts.txt'),
      'testworld/model/__fixtures__/rows.ts': tree('impl-unmarked.ts.txt'),
      'testworld/model/__golden__/rows.ts': tree('impl-unmarked.ts.txt'),
    })
    const r = mutate(w, 'DGT', 'main')
    expect(r.code).toBe(0)
    expect(r.out).not.toContain('core file without @mutate')
    const args = strykerArgs(w)
    expect(args).toContain(TW_MONEY)
    expect(args).not.toContain('.test.ts')
    expect(args).not.toContain('__fixtures__')
    expect(args).not.toContain('__golden__')
  })

  test('R20 ARC-15: a changed testworld file outside the card Paths needs no marker and is not mutated unless marked', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-marked.ts.txt'), 'testworld/model/other.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(strykerArgs(w)).toContain('src/gate/add.ts')
    expect(strykerArgs(w)).not.toContain('other.ts')
  })

  test('R20 ARC-15: a core card that changed no file at all fails: no marked target in its Paths, never "no mutation targets"', () => {
    const w = world('DGC')
    w.commit('reports only', { 'reports/DGC-build.md': '# report\n' })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).not.toContain('no mutation targets changed')
    expect(r.out).toMatch(/no marked mutation target/i)
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: a core card whose only marked file sits outside its Paths fails the same way', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/elsewhere/util.ts': tree('impl-marked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/no marked mutation target/i)
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: a core card whose only changed file in its Paths is a test file fails: nothing to score', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.test.ts': tree('impl-test.test.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/no marked mutation target/i)
  })

  test('R20 ARC-15: vitest.mutate.config.ts runs the testworld tests, and only globs the unit home also has', async () => {
    const homes = JSON.parse(fs.readFileSync(path.join(TOOLS, 'test-homes.json'), 'utf8'))
    const config = (await import(path.join(REPO_ROOT, 'vitest.mutate.config.ts'))).default
    const include = config.test.include
    const tw = include.filter((g) => g.startsWith('testworld/'))
    expect(tw.length).toBeGreaterThan(0)
    expect(include).toContain('src/**/*.test.ts')
    for (const g of include) expect(homes.unit.include).toContain(g)
    expect(config.test.exclude).toContain('**/*.db.test.ts')
  })
})

describe('R21 scope --board: a ledger on a card branch does not board the train', () => {
  test('R21 ARC-19: --board fails on a branch whose diff against base holds plan/ledger.jsonl, and passes once it is reverted', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-marked.ts.txt') })
    w.commit('budget hook row', { 'plan/ledger.jsonl': tree('ledger-row.txt') })
    const bad = scope(w, 'DGC', '--board')
    expect(bad.code).toBe(1)
    expect(bad.out).toContain('ledger on a card branch')
    expect(bad.out).toContain('plan/ledger.jsonl')

    git(w.root, 'rm', '-q', '-f', 'plan/ledger.jsonl')
    git(w.root, 'commit', '-q', '-m', 'revert the ledger rows')
    const good = scope(w, 'DGC', '--board')
    expect(good.code).toBe(0)
    expect(good.out).toContain('SCOPE OK')
  })

  test('R21 ARC-19: --board passes a clean branch', () => {
    const w = world('DGC')
    specCommit(w)
    w.commit('build DGC', { 'src/gate/add.ts': tree('impl-marked.ts.txt') })
    const r = scope(w, 'DGC', '--board')
    expect(r.code).toBe(0)
    expect(r.out).toContain('SCOPE OK')
  })

  test('R21 ARC-19: without --board the same ledger branch passes (the row is only listed)', () => {
    const w = world('DGC')
    w.commit('budget hook row', { 'plan/ledger.jsonl': tree('ledger-row.txt') })
    expect(scope(w, 'DGC').code).toBe(0)
  })
})

describe('R22 mutate-changed: every marked file scores 100, whatever the aggregate says', () => {
  // The Stryker stub copies a planted stryker-report.json (the JSON the real tool writes to reports/mutation/mutation.json).
  const withReport = (reportTree, files) => {
    const w = world('DGC')
    w.commit('build DGC', files)
    w.put('stryker-report.json', tree(reportTree))
    return w
  }
  const TWO = { 'src/gate/add.ts': tree('impl-marked.ts.txt'), 'src/gate/sub.ts': tree('impl-sub-marked.ts.txt') }

  test('R22 ARC-15: two marked files at 100 and 97.5 fail naming the second, its score and its survivor line and mutator', () => {
    const r = mutate(withReport('report-97.json.txt', TWO), 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/gate/sub.ts')
    expect(r.out).toContain('97.5')
    expect(r.out).toContain('ConditionalExpression')
    expect(r.out).toMatch(/\b7\b/)
    expect(r.out).not.toMatch(/src\/gate\/add\.ts[^\n]*(97|below)/)
  })

  test('R22 ARC-15: a no-coverage mutant counts as a survivor', () => {
    const r = mutate(withReport('report-nocov.json.txt', TWO), 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/gate/sub.ts')
    expect(r.out).toContain('BlockStatement')
  })

  test('R22 ARC-15: an aggregate far above 70 with one file below 100 still fails', () => {
    const r = mutate(withReport('report-aggregate.json.txt', TWO), 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/gate/sub.ts')
    expect(r.out).toContain('EqualityOperator')
  })

  test('R22 ARC-15: every marked file at 100 passes', () => {
    const w = withReport('report-100.json.txt', TWO)
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(strykerArgs(w)).toContain('src/gate/sub.ts')
  })

  test('R22 ARC-15: a Stryker disable comment with no reason fails naming the file and line', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/label.ts': tree('impl-disable-noreason.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/gate/label.ts')
    expect(r.out).toMatch(/label\.ts:?\s*(line\s*)?2\b/)
    expect(r.out).toContain('disable')
  })

  test('R22 ARC-15: a Stryker disable comment with a reason passes', () => {
    const w = world('DGC')
    w.commit('build DGC', { 'src/gate/label.ts': tree('impl-disable-reason.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(strykerArgs(w)).toContain('src/gate/label.ts')
  })
})

describe('R20 round 3 mutate-changed: spec-owned fixtures and goldens are not product code', () => {
  const FIXTURE_FILES = {
    'src/gate/add.ts': tree('impl-marked.ts.txt'),
    'src/gate/__fixtures__/table.ts': tree('impl-unmarked.ts.txt'),
    'src/gate/__golden__/expected.ts': tree('impl-unmarked.ts.txt'),
  }

  test('R20 ARC-15: unmarked __fixtures__ and __golden__ files beside a marked core file pass the marker gate', () => {
    const w = world('DGC')
    w.commit('build DGC', FIXTURE_FILES)
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(r.out).not.toContain('core file without @mutate')
    expect(strykerArgs(w)).toContain('src/gate/add.ts')
  })

  test('R20 ARC-15: a __fixtures__ or __golden__ file is never a Stryker target, even when it carries the marker', () => {
    const w = world('DGC')
    w.commit('build DGC', {
      'src/gate/add.ts': tree('impl-marked.ts.txt'),
      'src/gate/__fixtures__/marked.ts': tree('impl-marked.ts.txt'),
      'src/gate/__golden__/marked.ts': tree('impl-marked.ts.txt'),
    })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    const args = strykerArgs(w)
    expect(args).toContain('src/gate/add.ts')
    expect(args).not.toContain('__fixtures__')
    expect(args).not.toContain('__golden__')
  })

  test('R20 ARC-15: a card that changed only fixtures and goldens has no mutation targets and exits 0', () => {
    const w = world('DGC')
    w.commit('spec DGC data', { 'src/gate/__fixtures__/table.ts': tree('impl-unmarked.ts.txt'), 'src/gate/__golden__/expected.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(0)
    expect(r.out).not.toContain('core file without @mutate')
    expect(strykerArgs(w)).toBeNull()
  })

  test('R20 ARC-15: an unmarked product file beside the fixtures still fails naming only the product file', () => {
    const w = world('DGC')
    w.commit('build DGC', { ...FIXTURE_FILES, 'src/gate/sub.ts': tree('impl-unmarked.ts.txt') })
    const r = mutate(w, 'DGC', 'main')
    expect(r.code).toBe(1)
    expect(r.out).toContain('core file without @mutate')
    expect(r.out).toContain('src/gate/sub.ts')
    expect(r.out).not.toContain('__fixtures__')
    expect(r.out).not.toContain('__golden__')
    expect(strykerArgs(w)).toBeNull()
  })
})

describe('R22 round 3 mutation config: nothing dropped from the unit tests that kill mutants', () => {
  // Stryker's vitest run (vitest.mutate.config.ts) must run every unit-project test file under src/ with the same
  // setup and environment. The tools/test rule tests exercise tools/, not src/, so they are not part of the mutant run.
  const resolveSrcTests = (inc, exc) => {
    const rx = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`)
    const files = []
    const walk = (d) => {
      for (const e of fs.readdirSync(path.join(REPO_ROOT, d), { withFileTypes: true })) {
        const rel = `${d}/${e.name}`
        if (e.isDirectory()) walk(rel)
        else files.push(rel)
      }
    }
    walk('src')
    return files.filter((f) => inc.some((g) => rx(g).test(f)) && !exc.some((g) => rx(g).test(f))).sort()
  }

  test('R22 ARC-15: vitest.mutate.config.ts runs the same src test files, setup files and env as the unit project', async () => {
    const mutate = (await import(path.join(REPO_ROOT, 'vitest.mutate.config.ts'))).default.test
    const main = (await import(path.join(REPO_ROOT, 'vitest.config.ts'))).default.test.projects.find((p) => p.test.name === 'unit').test
    const srcOnly = (inc) => inc.filter((g) => g.startsWith('src/'))
    const mutateFiles = resolveSrcTests(srcOnly(mutate.include), mutate.exclude)
    const unitFiles = resolveSrcTests(srcOnly(main.include), main.exclude)
    expect(unitFiles.length).toBeGreaterThan(0)
    expect(mutateFiles).toEqual(unitFiles)
    expect(mutate.setupFiles).toEqual(main.setupFiles)
    expect(mutate.env).toEqual(main.env)
  })

  test('R22 ARC-15: Stryker keeps the sandbox directory the readOwnSource helper relies on', () => {
    const cfg = fs.readFileSync(path.join(REPO_ROOT, 'stryker.config.mjs'), 'utf8')
    expect(cfg).toMatch(/tempDirName:\s*'\.stryker-tmp'/)
    const helper = fs.readFileSync(path.join(REPO_ROOT, 'src/core/testing/read-own-source.ts'), 'utf8')
    expect(helper).toContain('.stryker-tmp')
  })
})

describe('ARC-9 the gate tests name their rule and .gitattributes keeps the ledger merge rule', () => {
  test('R19 ARC-9: every test in this file names its rule (R19 to R22) and a clause', () => {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
    const titles = [...src.matchAll(/^\s*test\('((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]).concat([...src.matchAll(/^\s*test\("((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]))
    expect(titles.length).toBeGreaterThanOrEqual(32)
    const unnamed = titles.filter((t) => !/^R(19|20|21|22) ARC-\d+/.test(t))
    expect(unnamed).toEqual([])
  })

  test('R19 ARC-9: .gitattributes holds plan/ledger.jsonl merge=union', () => {
    const attrs = fs.readFileSync(path.join(REPO_ROOT, '.gitattributes'), 'utf8').split(/\r?\n/)
    expect(attrs.some((l) => /^plan\/ledger\.jsonl\s+merge=union\s*$/.test(l))).toBe(true)
  })
})
