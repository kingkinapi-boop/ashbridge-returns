// CQ4 acceptance tests (ARC-15, R82): a file the card's Spec section names belongs to the spec job from the start;
// a build commit, or a merge commit whose content came from neither parent, that edits one is flagged by name.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmpDirs = []
const mk = (p) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `${p}-`))
  tmpDirs.push(d)
  return d.replace(/\\/g, '/')
}
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


const CARD = [
  '# F card',
  '',
  'Paths: src/f/**, check/verify.mjs, README.md',
  '',
  '## Spec',
  '- The verify line lives in `check/verify.mjs` and the count sentence in `README.md`.',
  '',
  '## Build',
  'The code under src/f.',
  ''
].join('\n')

// main has the tools, card F (Spec names check/verify.mjs and README.md) and the two files.
async function world() {
  const remote = mk('cq4-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('cq4-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  put(work, 'plan/slices.json', JSON.stringify({ blueprint: 'x', cards: [{ id: 'F', title: 't F', status: 'checking', spec: 'abc', deps: [], paths: ['src/f/**', 'check/verify.mjs', 'README.md'] }] }))
  put(work, 'plan/cards/F.md', CARD)
  put(work, 'package.json', '{"name":"x"}\n')
  put(work, 'check/verify.mjs', 'v1\n')
  put(work, 'README.md', 'passes 10\n')
  put(work, 'src/other/keep.ts', 'export {}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json', 'src', 'check', 'README.md')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return work
}
async function commit(w, subject, files) {
  for (const [rel, text] of Object.entries(files)) put(w, rel, text)
  await git(w, 'add', ...Object.keys(files))
  await git(w, 'commit', '-q', '-m', subject)
}
const scope = async (work) => {
  const r = await exec('node', [path.join(work, 'tools', 'scope.mjs'), 'F'], { cwd: work })
  return { code: r.status, out: (r.out + r.err).trim() }
}
const code = { 'src/f/a.ts': 'a\n' }
// Push claude/F built from `steps` (each a function run on the branch), then return to main.
async function branch(w, steps) {
  await git(w, 'checkout', '-q', '-b', 'claude/F')
  for (const s of steps) await s()
  await git(w, 'push', '-q', 'origin', 'claude/F')
  await git(w, 'checkout', '-q', 'main')
  await git(w, 'branch', '-q', '-D', 'claude/F')
}

describe('ARC-15 CQ4 R82: files the Spec names belong to the spec job', () => {
  test('ARC-15 R82 a build commit that edits a file the Spec names fails by name, with no spec commit on the branch', async () => {
    const w = await world()
    await branch(w, [() => commit(w, 'build(F): code and count', { ...code, 'README.md': 'passes 11\n' })])
    const r = await scope(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/README\.md/)
    expect(r.out).not.toMatch(/src\/f\/a\.ts/)
    expect(r.out).not.toMatch(/SCOPE OK/)
  })

  test('ARC-15 R82 the same edit in a spec(F): commit passes, and a build commit on other files passes', async () => {
    const w = await world()
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'check/verify.mjs': 'v2\n', 'README.md': 'passes 11\n' }),
      () => commit(w, 'build(F): code', code)
    ])
    const r = await scope(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/SCOPE OK F: 3 file\(s\) changed/)
  })

  test('ARC-15 R82 a build commit after the spec commit that touches a Spec-named file fails (check/verify.mjs)', async () => {
    const w = await world()
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'README.md': 'passes 11\n' }),
      () => commit(w, 'build(F): code and verify line', { ...code, 'check/verify.mjs': 'v-build\n' })
    ])
    const r = await scope(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/check\/verify\.mjs/)
  })

  test('ARC-15 R82 a merge commit whose content was edited by hand in a Spec-named file is flagged by name', async () => {
    const w = await world()
    await commit(w, 'main moves', { 'src/other/m.ts': 'm\n' })
    await git(w, 'push', '-q', 'origin', 'main')
    await git(w, 'reset', '-q', '--hard', 'HEAD~1')
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'check/verify.mjs': 'v2\n' }),
      () => commit(w, 'build(F): code', code),
      async () => {
        await git(w, 'merge', '-q', '--no-commit', '--no-ff', 'origin/main')
        put(w, 'README.md', 'passes 99 by hand\n')
        await git(w, 'add', 'README.md')
        await git(w, 'commit', '-q', '-m', 'Merge origin/main into claude/F')
      }
    ])
    const r = await scope(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/README\.md/)
    expect(r.out).toMatch(/merge/i)
  })

  test('ARC-15 R82 a clean merge of main into the build branch is not flagged, even when main changed a Spec-named file', async () => {
    const w = await world()
    await commit(w, 'main moves', { 'src/other/m.ts': 'm\n', 'README.md': 'passes 12\n' })
    await git(w, 'push', '-q', 'origin', 'main')
    await git(w, 'reset', '-q', '--hard', 'HEAD~1')
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'check/verify.mjs': 'v2\n' }),
      () => commit(w, 'build(F): code', code),
      () => git(w, 'merge', '-q', '--no-edit', 'origin/main')
    ])
    const r = await scope(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/SCOPE OK F/)
  })

  test('ARC-15 R82 a hand-resolved merge conflict in a Spec-named file is flagged', async () => {
    const w = await world()
    await commit(w, 'main moves README', { 'README.md': 'passes 12\n' })
    await git(w, 'push', '-q', 'origin', 'main')
    await git(w, 'reset', '-q', '--hard', 'HEAD~1')
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'README.md': 'passes 11\n' }),
      () => commit(w, 'build(F): code', code),
      async () => {
        await exec('git', [...G, 'merge', '--no-edit', 'origin/main'], { cwd: w })
        put(w, 'README.md', 'passes 13 resolved by hand\n')
        await git(w, 'add', 'README.md')
        await git(w, 'commit', '-q', '-m', 'Merge origin/main into claude/F')
      }
    ])
    const r = await scope(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/README\.md/)
  })

  test('ARC-15 R82 a card whose Spec names no file keeps the old behaviour: only files outside Paths fail', async () => {
    const w = await world()
    put(w, 'plan/cards/F.md', '# F card\n\nPaths: src/f/**\n\n## Spec\nNo file named.\n')
    await git(w, 'add', 'plan/cards/F.md')
    await git(w, 'commit', '-q', '-m', 'card without named files')
    await git(w, 'push', '-q', 'origin', 'main')
    await branch(w, [() => commit(w, 'build(F): code', { ...code, 'README.md': 'passes 11\n' })])
    const r = await scope(w)
    expect(r.code).toBe(0)
  })
})

// CQ4 round 2 (A430, findings items 3 and 4): the Spec's prose names the build's own code files without owning them,
// the card is read from the base ref, `--branch` picks the branch, and report, plan and superseded edits are not flagged.
const CARD2 = [
  '# F card',
  '',
  'Paths: src/f/**, check/verify.mjs, README.md',
  '',
  '## Spec',
  '- The build keeps its logic in `src/f/a.ts` and calls src/f/b.ts for the rest.',
  '- The verify line lives in `check/verify.mjs`.',
  '',
  '## Build',
  'The code under src/f.',
  ''
].join('\n')

async function world2(card) {
  const w = await world()
  put(w, 'plan/cards/F.md', card)
  put(w, 'src/f/a.ts', 'a0\n')
  put(w, 'src/f/b.ts', 'b0\n')
  put(w, 'tests/f.test.mjs', 't0\n')
  await git(w, 'add', 'plan/cards/F.md', 'src/f', 'tests')
  await git(w, 'commit', '-q', '-m', 'card and base files')
  await git(w, 'push', '-q', 'origin', 'main')
  return w
}
const scopeArgs = async (work, ...a) => {
  const r = await exec('node', [path.join(work, 'tools', 'scope.mjs'), 'F', ...a], { cwd: work })
  return { code: r.status, out: (r.out + r.err).trim() }
}
const head7 = async (w) => (await git(w, 'rev-parse', 'HEAD')).slice(0, 7)

describe('ARC-15 CQ4 R82 round 2: the expectation class, the base card, --branch', () => {
  test('ARC-15 R82 Spec prose naming the build code file (bare and backticked) is not flagged, and verify.mjs still is', async () => {
    const w = await world2(CARD2)
    await branch(w, [() => commit(w, 'build(F): code', { 'src/f/a.ts': 'a1\n', 'src/f/b.ts': 'b1\n' })])
    const ok = await scopeArgs(w)
    expect(ok.code).toBe(0)
    expect(ok.out).toMatch(/SCOPE OK F/)
    await git(w, 'push', '-q', 'origin', '--delete', 'claude/F')
    await branch(w, [() => commit(w, 'build(F): code and verify line', { 'src/f/a.ts': 'a1\n', 'check/verify.mjs': 'v-build\n' })])
    const bad = await scopeArgs(w)
    expect(bad.code).toBe(1)
    expect(bad.out).toMatch(/check\/verify\.mjs/)
    expect(bad.out).not.toMatch(/src\/f\/a\.ts/)
  })

  test('ARC-15 R82 a hand-resolved merge in a file a spec commit touched, not named in the Spec, fails', async () => {
    const w = await world2(CARD2)
    await commit(w, 'main moves', { 'src/other/m.ts': 'm\n' })
    await git(w, 'push', '-q', 'origin', 'main')
    await git(w, 'reset', '-q', '--hard', 'HEAD~1')
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'tests/f.test.mjs': 't1\n' }),
      () => commit(w, 'build(F): code', { 'src/f/c.ts': 'c1\n' }),
      async () => {
        await git(w, 'merge', '-q', '--no-commit', '--no-ff', 'origin/main')
        put(w, 'tests/f.test.mjs', 't-by-hand\n')
        await git(w, 'add', 'tests/f.test.mjs')
        await git(w, 'commit', '-q', '-m', 'Merge origin/main into claude/F')
      }
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/tests\/f\.test\.mjs/)
    expect(r.out).toMatch(/merge/i)
  })

  test('ARC-15 R82 the card is read from the base ref: a branch edit that unnames verify.mjs does not clear the flag', async () => {
    const w = await world2(CARD2)
    await git(w, 'checkout', '-q', '-b', 'claude/F')
    await commit(w, 'build(F): code, verify line and an unnaming card edit', {
      'src/f/c.ts': 'c1\n',
      'check/verify.mjs': 'v-build\n',
      'plan/cards/F.md': CARD2.replace('`check/verify.mjs`', 'the verify script')
    })
    await git(w, 'push', '-q', 'origin', 'claude/F')
    const r = await scopeArgs(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/check\/verify\.mjs/)
  })

  test('ARC-15 R82 --branch <name> judges that branch, and the default still judges claude/<card>', async () => {
    const w = await world2(CARD2)
    await branch(w, [() => commit(w, 'build(F): code', { 'src/f/c.ts': 'c1\n' })])
    await git(w, 'checkout', '-q', '-b', 'claude/F-r2')
    await commit(w, 'build(F): round 2 edits the verify line', { 'src/f/c.ts': 'c2\n', 'check/verify.mjs': 'v-r2\n' })
    await git(w, 'push', '-q', 'origin', 'claude/F-r2')
    await git(w, 'checkout', '-q', 'main')
    const r2 = await scopeArgs(w, '--branch', 'claude/F-r2')
    expect(r2.code).toBe(1)
    expect(r2.out).toMatch(/check\/verify\.mjs/)
    const dflt = await scopeArgs(w)
    expect(dflt.code).toBe(0)
    expect(dflt.out).toMatch(/SCOPE OK F/)
  })

  test('ARC-15 R82 a later commit to reports/** or plan/** is never "spec file edited by the build"', async () => {
    const w = await world2(CARD2)
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'tests/f.test.mjs': 't1\n', 'reports/F-spec.md': 'r1\n', 'plan/notes/F.md': 'n1\n' }),
      () => commit(w, 'F: spec report update', { 'reports/F-spec.md': 'r2\n' }),
      () => commit(w, 'build(F): code, plan note', { 'src/f/c.ts': 'c1\n', 'plan/notes/F.md': 'n2\n' })
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/SCOPE OK F/)
    expect(r.out).not.toMatch(/edited by the build/)
  })

  test('ARC-15 R82 a file a later spec(F): commit rewrote prints "note: superseded by <sha>" and does not fail', async () => {
    const w = await world2(CARD2)
    let s2 = ''
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'tests/f.test.mjs': 't1\n' }),
      () => commit(w, 'wip: touch the test', { 'tests/f.test.mjs': 't-wip\n' }),
      async () => {
        await commit(w, 'spec(F): acceptance tests, patch', { 'tests/f.test.mjs': 't2\n' })
        s2 = await head7(w)
      },
      () => commit(w, 'build(F): code', { 'src/f/c.ts': 'c1\n' })
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(new RegExp(`note: superseded by ${s2}`))
    expect(r.out).toMatch(/tests\/f\.test\.mjs/)
    expect(r.out).not.toMatch(/SCOPE FAIL/)
  })

  test('ARC-15 R82 a build commit after the file’s last spec commit still fails, with no superseded note', async () => {
    const w = await world2(CARD2)
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'tests/f.test.mjs': 't1\n' }),
      () => commit(w, 'build(F): code and edits the test', { 'src/f/c.ts': 'c1\n', 'tests/f.test.mjs': 't-build\n' })
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/tests\/f\.test\.mjs/)
    expect(r.out).toMatch(/spec file edited by the build/)
    expect(r.out).not.toMatch(/superseded/)
  })
})

// CQ11 (A465, A490): a build-owned test (`*.build.test.ts`, `*.build.db.test.ts`) is not a spec file. A spec commit may have
// touched it (a restated test) and the build may still edit it; the build's edits to it are never "spec file edited".
const BUILD_TEST = 'src/f/e.build.test.ts'
const CARD3 = [
  '# F card',
  '',
  'Paths: src/f/**',
  '',
  '## Spec',
  '- Tests: `src/f/e.build.test.ts` line 50 restated; `tests/f.test.mjs` is the spec file.',
  '',
  '## Build',
  'The code under src/f.',
  ''
].join('\n')

describe('ARC-15 CQ11 A465: scope tells a build-owned test from a spec file', () => {
  test('ARC-15 A465 a build commit that edits a *.build.test.ts file a spec commit also touched is not flagged', async () => {
    const w = await world2(CARD3)
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { [BUILD_TEST]: 'e1\n', 'tests/f.test.mjs': 't1\n' }),
      () => commit(w, 'build(F): code and own test', { 'src/f/c.ts': 'c1\n', [BUILD_TEST]: 'e-build\n' })
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/SCOPE OK F/)
    expect(r.out).not.toMatch(/spec file edited/)
  })

  test('ARC-15 A465 a *.build.db.test.ts file edited by the build is not flagged either', async () => {
    const w = await world2(CARD3)
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { 'src/f/d.build.db.test.ts': 'd1\n' }),
      () => commit(w, 'build(F): code and own db test', { 'src/f/c.ts': 'c1\n', 'src/f/d.build.db.test.ts': 'd-build\n' })
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(0)
    expect(r.out).not.toMatch(/spec file edited/)
  })

  test('ARC-15 A465 plant: the build editing a spec-owned file next to it (acceptance test, plain test) still fails by name', async () => {
    const w = await world2(CARD3)
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { [BUILD_TEST]: 'e1\n', 'src/f/g.acceptance.test.ts': 'g1\n', 'tests/f.test.mjs': 't1\n' }),
      () => commit(w, 'build(F): code, own test, and a spec edit', { 'src/f/c.ts': 'c1\n', [BUILD_TEST]: 'e-build\n', 'src/f/g.acceptance.test.ts': 'g-build\n', 'tests/f.test.mjs': 't-build\n' })
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/g\.acceptance\.test\.ts/)
    expect(r.out).toMatch(/tests\/f\.test\.mjs/)
    expect(r.out).not.toMatch(/e\.build\.test\.ts in/)
  })

  test('ARC-15 A465 a hand-edited merge in a *.build.test.ts file is not flagged', async () => {
    const w = await world2(CARD3)
    await commit(w, 'main moves', { 'src/other/m.ts': 'm\n' })
    await git(w, 'push', '-q', 'origin', 'main')
    await git(w, 'reset', '-q', '--hard', 'HEAD~1')
    await branch(w, [
      () => commit(w, 'spec(F): acceptance tests', { [BUILD_TEST]: 'e1\n' }),
      () => commit(w, 'build(F): code', { 'src/f/c.ts': 'c1\n' }),
      async () => {
        await git(w, 'merge', '-q', '--no-commit', '--no-ff', 'origin/main')
        put(w, BUILD_TEST, 'e-by-hand\n')
        await git(w, 'add', BUILD_TEST)
        await git(w, 'commit', '-q', '-m', 'Merge origin/main into claude/F')
      }
    ])
    const r = await scopeArgs(w)
    expect(r.code).toBe(0)
    expect(r.out).not.toMatch(/merge:/)
  })

  test('ARC-15 A465 being build-owned does not put a file outside Paths: a *.build.test.ts outside the card still fails', async () => {
    const w = await world2(CARD3)
    await branch(w, [() => commit(w, 'build(F): code and a test outside', { 'src/f/c.ts': 'c1\n', 'src/elsewhere/z.build.test.ts': 'z\n' })])
    const r = await scopeArgs(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/src\/elsewhere\/z\.build\.test\.ts/)
  })
})
