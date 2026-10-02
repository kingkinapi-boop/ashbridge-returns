// CQ2 builder tests (ARC-15, rule 6): a job released twice with no new commit on the card branch between the
// two releases is held as "needs Lead" until the Lead reopens it.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })
const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dirs = []
const mk = (p) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `${p}-`))
  dirs.push(d)
  return d.replace(/\\/g, '/')
}
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))
const G = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', '-c', 'commit.gpgsign=false']
const exec = (cmd, a, opts = {}) =>
  new Promise((resolve, reject) => {
    const c = spawn(cmd, a, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (out += d))
    c.on('error', reject)
    c.on('close', (code) => resolve({ code, out: out.trim() }))
  })
const git = async (cwd, ...a) => {
  const r = await exec('git', [...G, ...a], { cwd })
  if (r.code !== 0) throw new Error(r.out)
  return r.out
}

async function world() {
  const remote = mk('nl-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('nl-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'x', cards: [{ id: 'A', title: 't', status: 'carded', spec: 'abc', deps: [], paths: ['src/a/**'] }] }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  return work
}
const claim = (w, a) => exec('node', [path.join(w, 'tools', 'claim.mjs'), ...a], { cwd: w, env: { ...process.env, CLAIMS_BACKOFF_MS: '5' } })
const take = async (w, who) => (await claim(w, ['next', '--worker', who, '--roles', 'build'])).out
const release = (w, who, note = 'ran out') => claim(w, ['update', 'A', 'build', 'released', '--worker', who, '--note', note])
async function pushCommit(w, n) {
  await git(w, 'checkout', '-q', '-B', 'claude/A', 'main')
  fs.mkdirSync(path.join(w, 'src/a'), { recursive: true })
  fs.writeFileSync(path.join(w, `src/a/${n}.ts`), 'x\n')
  await git(w, 'add', `src/a/${n}.ts`)
  await git(w, 'commit', '-q', '-m', `c${n}`)
  await git(w, 'push', '-q', '-f', 'origin', 'claude/A')
  await git(w, 'checkout', '-q', 'main')
}

describe('ARC-15 CQ2 rule 6: released twice with no new commit is needs Lead', () => {
  test('ARC-15 a second release at the same branch tip holds the job until the Lead reopens it', async () => {
    const w = await world()
    expect(await take(w, 'w1')).toBe('CLAIMED A build')
    await release(w, 'w1')
    expect(await take(w, 'w2')).toBe('CLAIMED A build')
    await release(w, 'w2')
    expect(await take(w, 'w3')).toBe('NOTHING')
    expect((await claim(w, ['list'])).out).toMatch(/A build released \(needs Lead\)/)
  })

  test('ARC-15 a new commit between two releases keeps the job offered', async () => {
    const w = await world()
    expect(await take(w, 'w1')).toBe('CLAIMED A build')
    await release(w, 'w1')
    expect(await take(w, 'w2')).toBe('CLAIMED A build')
    await pushCommit(w, 1)
    await release(w, 'w2')
    expect(await take(w, 'w3')).toBe('CLAIMED A build')
  })

  test('ARC-15 the Lead reopening clears the hold', async () => {
    const w = await world()
    for (const who of ['w1', 'w2']) {
      expect(await take(w, who)).toBe('CLAIMED A build')
      await release(w, who)
    }
    expect(await take(w, 'w3')).toBe('NOTHING')
    await claim(w, ['update', 'A', 'build', 'reopened', '--worker', 'lead'])
    expect(await take(w, 'w3')).toBe('CLAIMED A build')
  })
})
