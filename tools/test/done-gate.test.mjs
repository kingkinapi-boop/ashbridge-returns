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
  for (const c of ['DGC', 'DGP']) put(`plan/cards/${c}.md`, fixture(`cards/${c}.md`))
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

  test('R20 ARC-15: "no mutation targets changed" is exit 0 only when the card changed no src file at all', () => {
    const w = world('DGC')
    w.commit('reports only', { 'reports/DGC-build.md': '# report\n' })
    const r = mutate(w, 'DGC', 'main')
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

describe('ARC-9 the gate tests name their rule and .gitattributes keeps the ledger merge rule', () => {
  test('R19 ARC-9: every test in this file names its rule (R19 to R22) and a clause', () => {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
    const titles = [...src.matchAll(/^\s*test\('((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]).concat([...src.matchAll(/^\s*test\("((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]))
    expect(titles.length).toBeGreaterThanOrEqual(24)
    const unnamed = titles.filter((t) => !/^R(19|20|21|22) ARC-\d+/.test(t))
    expect(unnamed).toEqual([])
  })

  test('R19 ARC-9: .gitattributes holds plan/ledger.jsonl merge=union', () => {
    const attrs = fs.readFileSync(path.join(REPO_ROOT, '.gitattributes'), 'utf8').split(/\r?\n/)
    expect(attrs.some((l) => /^plan\/ledger\.jsonl\s+merge=union\s*$/.test(l))).toBe(true)
  })
})
