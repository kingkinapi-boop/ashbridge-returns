// CQ2 acceptance tests (ARC-15, rule 4): tools/scope.mjs <card> compares origin/claude/<card> with the base,
// whatever the current checkout, and fails loudly (exit 2) when that branch is missing.
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

// main has the tools and a card F (paths src/f/**). Returns the working clone, left on main.
async function world() {
  const remote = mk('cq2-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('cq2-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  put(work, 'plan/slices.json', JSON.stringify({ blueprint: 'x', cards: [{ id: 'F', title: 't F', status: 'checking', spec: 'abc', deps: [], paths: ['src/f/**'] }] }))
  put(work, 'package.json', '{"name":"x"}\n')
  put(work, 'src/other/keep.ts', 'export {}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json', 'src')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return work
}
// Push claude/F with the given files (rel -> text), one commit per entry of `commits`, then return to main.
async function pushBranch(work, commits) {
  await git(work, 'checkout', '-q', '-b', 'claude/F')
  for (const { subject, files } of commits) {
    for (const [rel, text] of Object.entries(files)) put(work, rel, text)
    await git(work, 'add', ...Object.keys(files))
    await git(work, 'commit', '-q', '-m', subject)
  }
  await git(work, 'push', '-q', 'origin', 'claude/F')
  await git(work, 'checkout', '-q', 'main')
  await git(work, 'branch', '-q', '-D', 'claude/F')
}
const scope = async (work, args = ['F']) => {
  const r = await exec('node', [path.join(work, 'tools', 'scope.mjs'), ...args], { cwd: work })
  return { code: r.status, out: (r.out + r.err).trim() }
}
const inside = { subject: 'build F', files: { 'src/f/a.ts': 'a\n', 'src/f/b.ts': 'b\n', 'src/f/c.ts': 'c\n' } }

describe('ARC-15 CQ2 rule 4: scope.mjs reads the card branch, not HEAD', () => {
  test('ARC-15 run from main it reports the real count of changed files on origin/claude/<card>', async () => {
    const w = await world()
    await pushBranch(w, [inside])
    const r = await scope(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/SCOPE OK F: 3 file\(s\) changed/)
  })

  test('ARC-15 a file outside the card paths on the branch fails from main', async () => {
    const w = await world()
    await pushBranch(w, [inside, { subject: 'stray', files: { 'src/other/x.ts': 'x\n' } }])
    const r = await scope(w)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/src\/other\/x\.ts/)
  })

  test('ARC-15 the answer does not depend on the current checkout: an outside file on another HEAD is not counted', async () => {
    const w = await world()
    await pushBranch(w, [inside])
    await git(w, 'checkout', '-q', '-b', 'elsewhere')
    put(w, 'src/other/y.ts', 'y\n')
    await git(w, 'add', 'src/other/y.ts')
    await git(w, 'commit', '-q', '-m', 'unrelated')
    const r = await scope(w)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/SCOPE OK F: 3 file\(s\) changed/)
  })

  test('ARC-15 a missing origin/claude/<card> exits 2 and names the branch, even when HEAD differs from main', async () => {
    const w = await world()
    await git(w, 'checkout', '-q', '-b', 'elsewhere')
    put(w, 'src/f/z.ts', 'z\n')
    await git(w, 'add', 'src/f/z.ts')
    await git(w, 'commit', '-q', '-m', 'on head only')
    const r = await scope(w)
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/claude\/F/)
    expect(r.out).not.toMatch(/SCOPE OK/)
  })

  test('ARC-15 spec files are recognised from main: a spec commit may touch anything, a later build edit of it fails', async () => {
    const w = await world()
    const spec = { subject: 'spec(F): acceptance tests', files: { 'tests/odd.txt': 'one\n' } }
    await pushBranch(w, [spec, inside])
    const ok = await scope(w)
    expect(ok.code).toBe(0)
    expect(ok.out).toMatch(/SCOPE OK F: 4 file\(s\) changed/)
    const w2 = await world()
    await pushBranch(w2, [spec, inside, { subject: 'build touches spec', files: { 'tests/odd.txt': 'two\n' } }])
    const bad = await scope(w2)
    expect(bad.code).toBe(1)
    expect(bad.out).toMatch(/spec file edited by the build: tests\/odd\.txt/)
  })

  test('ARC-15 an explicit base argument still works from main', async () => {
    const w = await world()
    await pushBranch(w, [inside])
    const r = await scope(w, ['F', 'origin/main'])
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/3 file\(s\) changed/)
  })
})
