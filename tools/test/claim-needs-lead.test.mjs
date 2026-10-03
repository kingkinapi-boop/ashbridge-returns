// CQ2 acceptance tests, rule 6 (ARC-15): a job released twice with no new commit on the card's branch between
// the two releases is held as "needs Lead" (not offered) until the Lead reopens it; `claim.mjs list` shows it
// under that label (Critic 2 Oct evening, proposal 2: the SC build was taken 41 times in 22 runs).
// Written by the spec job (the builder's own three tests for this rule were replaced, reports/CQ2-check.md).
// tools/claim.mjs against a bare remote and a clone, the clock pinned with CLAIMS_NOW. Every child process is
// async (A247). A "commit on the card's branch" is a real push to origin/claude/<card>.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const T0 = '2026-10-02T12:00:00Z'
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

const card = (id, status = 'carded', extra = {}) => ({ id, title: `t ${id}`, status, spec: null, deps: [], paths: [`src/${id.toLowerCase()}/**`], ...extra })

async function world(cards) {
  const remote = mk('nl-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('nl-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.1', cards }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return { remote, work }
}
async function run(w, tool, args) {
  const r = await exec('node', [path.join(w.work, 'tools', tool), ...args], {
    cwd: w.work,
    env: { ...process.env, CLAIMS_NOW: T0, CLAIMS_BACKOFF_MS: '1' },
  })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
const claim = (w, args) => run(w, 'claim.mjs', args)
const nextFor = async (w, worker, roles) => (await claim(w, ['next', '--worker', worker, '--roles', roles])).out
const list = async (w) => (await claim(w, ['list'])).out
const release = (w, id, role, who, note = 'ran out of time') => claim(w, ['update', id, role, 'released', '--worker', who, '--note', note])
// A real commit on origin/claude/<id>; n keeps each tip different.
async function pushCommit(w, id, n) {
  await git(w.work, 'checkout', '-q', '-B', `claude/${id}`, 'origin/main')
  const dir = path.join(w.work, 'src', id.toLowerCase())
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `f${n}.ts`), `export const n = ${n}\n`)
  await git(w.work, 'add', `src/${id.toLowerCase()}/f${n}.ts`)
  await git(w.work, 'commit', '-q', '-m', `c${n}`)
  await git(w.work, 'push', '-q', '-f', 'origin', `claude/${id}`)
  await git(w.work, 'checkout', '-q', 'main')
}
// Each worker in turn takes the job and releases it.
async function takeAndRelease(w, id, role, workers) {
  for (const who of workers) {
    expect(await nextFor(w, who, role), `${who} takes ${id} ${role}`).toBe(`CLAIMED ${id} ${role}`)
    expect((await release(w, id, role, who)).code).toBe(0)
  }
}
// A card with a reported spec (w0) and a reported build (w1): a check can be offered.
async function reportedBuild(id = 'B') {
  const w = await world([card(id)])
  const sha = await git(w.work, 'rev-parse', 'origin/main')
  expect(await nextFor(w, 'w0', 'spec')).toBe(`CLAIMED ${id} spec`)
  await claim(w, ['update', id, 'spec', 'reported', '--worker', 'w0', '--commit', 'abc123', '--validated', sha])
  expect(await nextFor(w, 'w1', 'build')).toBe(`CLAIMED ${id} build`)
  await claim(w, ['update', id, 'build', 'reported', '--worker', 'w1'])
  return w
}

describe('ARC-15 CQ2 rule 6: a job released twice with no new commit is needs Lead', () => {
  test('ARC-15 a build released twice with no commit on the branch is not offered again and list says needs Lead', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    await takeAndRelease(w, 'A', 'build', ['w1', 'w2'])
    expect(await nextFor(w, 'w3', 'build')).toBe('NOTHING')
    expect(await nextFor(w, 'w4', 'check,build,spec')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^A build released \(needs Lead\)/m)
  })

  test('ARC-15 a build released twice at the same branch tip (a commit made before the first release) is needs Lead', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    expect(await nextFor(w, 'w1', 'build')).toBe('CLAIMED A build')
    await pushCommit(w, 'A', 1)
    await release(w, 'A', 'build', 'w1')
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await release(w, 'A', 'build', 'w2')
    expect(await nextFor(w, 'w3', 'build')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^A build released \(needs Lead\)/m)
  })

  test('ARC-15 one release alone does not hold the job: it is offered again and list does not say needs Lead', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    await takeAndRelease(w, 'A', 'build', ['w1'])
    expect(await list(w)).not.toMatch(/needs Lead/)
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
  })

  test('ARC-15 a new commit on the branch between the two releases keeps the job offered', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    expect(await nextFor(w, 'w1', 'build')).toBe('CLAIMED A build')
    await release(w, 'A', 'build', 'w1')
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await pushCommit(w, 'A', 1)
    await release(w, 'A', 'build', 'w2')
    expect(await list(w)).not.toMatch(/needs Lead/)
    expect(await nextFor(w, 'w3', 'build')).toBe('CLAIMED A build')
  })

  test('ARC-15 each release is compared with the one before it: a commit-backed release is followed by a hold at the next release with no commit', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    expect(await nextFor(w, 'w1', 'build')).toBe('CLAIMED A build')
    await release(w, 'A', 'build', 'w1')
    expect(await nextFor(w, 'w2', 'build')).toBe('CLAIMED A build')
    await pushCommit(w, 'A', 1)
    await release(w, 'A', 'build', 'w2')
    expect(await nextFor(w, 'w3', 'build')).toBe('CLAIMED A build')
    await release(w, 'A', 'build', 'w3')
    expect(await nextFor(w, 'w4', 'build')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^A build released \(needs Lead\)/m)
  })

  test('ARC-15 a spec released twice with no commit is needs Lead too (the rule is for any job)', async () => {
    const w = await world([card('A')])
    await takeAndRelease(w, 'A', 'spec', ['w1', 'w2'])
    expect(await nextFor(w, 'w3', 'spec')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^A spec released \(needs Lead\)/m)
  })

  test('ARC-15 a check released twice with no commit is needs Lead: not re-offered although a released check normally is', async () => {
    const w = await reportedBuild('B')
    await takeAndRelease(w, 'B', 'check', ['w2', 'w3'])
    expect(await nextFor(w, 'w4', 'check')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^B check released \(needs Lead\)/m)
  })

  test('ARC-15 a check released once is still re-offered (CQ2 rule 1 stands for a single release)', async () => {
    const w = await reportedBuild('B')
    await takeAndRelease(w, 'B', 'check', ['w2'])
    expect(await nextFor(w, 'w3', 'check')).toBe('CLAIMED B check')
  })

  test('ARC-15 the hold is per card: another card with a build to do is still offered', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' }), card('D', 'carded', { spec: 'abc' })])
    await takeAndRelease(w, 'A', 'build', ['w1', 'w2'])
    expect(await nextFor(w, 'w3', 'build')).toBe('CLAIMED D build')
  })

  test('ARC-15 the Lead reopening the job clears the hold, and the job is then offered again', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    await takeAndRelease(w, 'A', 'build', ['w1', 'w2'])
    expect(await nextFor(w, 'w3', 'build')).toBe('NOTHING')
    expect((await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead', '--note', 'round 2'])).code).toBe(0)
    expect(await list(w)).not.toMatch(/needs Lead/)
    expect(await nextFor(w, 'w3', 'build')).toBe('CLAIMED A build')
  })

  test('ARC-15 after the Lead reopens, the count starts again: one release is no hold, a second at the same tip is', async () => {
    const w = await world([card('A', 'carded', { spec: 'abc' })])
    await takeAndRelease(w, 'A', 'build', ['w1', 'w2'])
    await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead', '--note', 'round 2'])
    expect(await nextFor(w, 'w3', 'build')).toBe('CLAIMED A build')
    await release(w, 'A', 'build', 'w3')
    expect(await list(w)).not.toMatch(/needs Lead/)
    expect(await nextFor(w, 'w4', 'build')).toBe('CLAIMED A build')
    await release(w, 'A', 'build', 'w4')
    expect(await nextFor(w, 'w5', 'build')).toBe('NOTHING')
    expect(await list(w)).toMatch(/^A build released \(needs Lead\)/m)
  })
})
