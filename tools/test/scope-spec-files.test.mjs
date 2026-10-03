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
