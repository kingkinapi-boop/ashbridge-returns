// CQ5 acceptance tests (ARC-15 queue repairs): a claim is written on the tip it was decided on.
// On 3 Oct 05:56Z local-3's W16 spec claim (0ec70d0a) overwrote cloud-03268d's claim made 7 seconds
// earlier (3ba6da28): `next` picked from one claims tip, then `writeClaims` re-read
// refs/remotes/origin/claude/claims, which another worker sharing the same refs had moved (A428).
//
// The race is planted, never left to timing: worker A runs claim.mjs with a preload (node --import)
// that wraps child_process.execFileSync. Right after A's `next` has read the claims tree it decides on
// (its first `git ls-tree`), the preload runs a rival worker B to completion from the SAME checkout, so
// B's claim moves the shared refs/remotes/origin/claude/claims under A, exactly as in the 05:56Z case.
// No product module is mocked: both workers are the real tools/claim.mjs against a bare remote.
// Every child process of the test itself is async (A247).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

vi.setConfig({ testTimeout: 120000 })

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const T0 = '2026-10-03T05:56:00Z'
const CLAIMS_REF = 'refs/remotes/origin/claude/claims'
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

// The preload that plants the race. It fires once, in the armed process only (the rival is started
// without it), after the first `git ls-tree` of a `next` run: the claims tree A decides on is read.
const PRELOAD = `
import cp from 'node:child_process'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
const orig = cp.execFileSync
let fired = false
cp.execFileSync = function (file, args, opts) {
  const r = orig.apply(this, arguments)
  if (!fired && process.env.RACE_ARMED === '1' && process.argv[2] === 'next' && file === 'git' && Array.isArray(args) && args[0] === 'ls-tree') {
    fired = true
    const cwd = opts && opts.cwd
    const ref = () => { try { return orig('git', ['rev-parse', '--verify', '-q', '${CLAIMS_REF}'], { cwd, encoding: 'utf8' }).trim() } catch { return null } }
    const before = ref()
    const env = { ...process.env }
    delete env.RACE_ARMED
    delete env.NODE_OPTIONS
    const res = cp.spawnSync(process.execPath, [process.argv[1], ...JSON.parse(process.env.RACE_RIVAL)], { cwd, env, encoding: 'utf8' })
    fs.writeFileSync(process.env.RACE_MARKER, JSON.stringify({ before, after: ref(), status: res.status, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() }))
  }
  return r
}
syncBuiltinESMExports()
`

async function world(cards) {
  const remote = mk('cq5-remote')
  await git(remote, 'init', '-q', '--bare', '-b', 'main')
  const work = mk('cq5-work')
  await git(work, 'init', '-q', '-b', 'main')
  await git(work, 'remote', 'add', 'origin', remote)
  fs.cpSync(TOOLS, path.join(work, 'tools'), { recursive: true, filter: (s) => !s.includes(`${path.sep}test`) })
  fs.mkdirSync(path.join(work, 'plan'), { recursive: true })
  fs.writeFileSync(path.join(work, 'plan', 'mode.json'), JSON.stringify({ mode: 'turbo', max_workers: 12 }))
  fs.writeFileSync(path.join(work, 'plan', 'slices.json'), JSON.stringify({ blueprint: 'v1.2', cards: [card('Z', 'done', { spec: 'n/a' }), ...cards] }))
  fs.writeFileSync(path.join(work, 'package.json'), '{"name":"x"}\n')
  await git(work, 'add', 'tools', 'plan', 'package.json')
  await git(work, 'commit', '-q', '-m', 'main')
  await git(work, 'push', '-q', 'origin', 'main')
  const aux = mk('cq5-aux')
  const preload = path.join(aux, 'race-preload.mjs')
  fs.writeFileSync(preload, PRELOAD)
  const w = { remote, work, preload, marker: path.join(aux, 'race.json') }
  // An older claim on a done card, so the claims branch exists before the race (as on 3 Oct).
  expect((await claim(w, ['update', 'Z', 'build', 'reported', '--worker', 'w0'])).code).toBe(0)
  return w
}
const ENV = { CLAIMS_NOW: T0, CLAIMS_BACKOFF_MS: '1' }
async function claim(w, args) {
  const r = await exec('node', [path.join(w.work, 'tools', 'claim.mjs'), ...args], { cwd: w.work, env: { ...process.env, ...ENV } })
  return { code: r.status, out: r.out.trim(), err: r.err.trim() }
}
// Worker A runs `next`; the rival B runs `rival` (claim.mjs arguments) in between A's read and A's write.
async function raced(w, aArgs, rival) {
  const r = await exec('node', ['--import', pathToFileURL(w.preload).href, path.join(w.work, 'tools', 'claim.mjs'), ...aArgs], {
    cwd: w.work,
    env: { ...process.env, ...ENV, RACE_ARMED: '1', RACE_RIVAL: JSON.stringify(rival), RACE_MARKER: w.marker },
  })
  // The race must really have been planted: B ran, and B's claim moved the ref A and B share.
  expect(fs.existsSync(w.marker), 'the rival never ran: the race was not planted').toBe(true)
  const b = JSON.parse(fs.readFileSync(w.marker, 'utf8'))
  expect(b.before).toMatch(/^[0-9a-f]{40}$/)
  expect(b.after).toMatch(/^[0-9a-f]{40}$/)
  expect(b.after).not.toBe(b.before)
  return { a: { code: r.status, out: r.out.trim(), err: r.err.trim() }, b }
}
// The claim files on the remote's claims branch (what every other worker will read).
async function remoteClaims(w) {
  const tip = await git(w.remote, 'rev-parse', 'refs/heads/claude/claims')
  const names = (await git(w.remote, 'ls-tree', '--name-only', tip, 'claims/')).split('\n').filter(Boolean)
  const out = {}
  for (const n of names) out[path.basename(n)] = JSON.parse(await git(w.remote, 'show', `${tip}:${n}`))
  return { tip, files: out }
}
const isAncestor = async (w, a, b) => (await exec('git', ['merge-base', '--is-ancestor', a, b], { cwd: w.remote })).status === 0

describe('ARC-15 CQ5: a claim is written on the tip it was decided on', () => {
  test('ARC-15 a claim decided on tip T is refused when another worker claimed the same job before the write, and the worker picks again', async () => {
    const w = await world([card('X'), card('Y')])
    const { a, b } = await raced(w, ['next', '--worker', 'wA', '--roles', 'spec'], ['next', '--worker', 'wB', '--roles', 'spec'])
    // B decided and wrote first: X is B's.
    expect(b.status).toBe(0)
    expect(b.out).toBe('CLAIMED X spec')
    // A decided X on the old tip; its write must not land over B's claim. A picks again and gets Y.
    expect(a.out).toBe('CLAIMED Y spec')
    expect(a.code).toBe(0)
    const { tip, files } = await remoteClaims(w)
    expect(files['X.spec.json']).toMatchObject({ card: 'X', role: 'spec', state: 'working', worker: 'wB' })
    expect(files['Y.spec.json']).toMatchObject({ card: 'Y', role: 'spec', state: 'working', worker: 'wA' })
    // Nothing was overwritten or rewound: B's claim commit is in the history of the final tip.
    expect(await isAncestor(w, b.after, tip)).toBe(true)
    // The queue now shows one holder per job.
    const list = (await claim(w, ['list'])).out
    expect(list).toMatch(/^X spec working \| wB \|/m)
    expect(list).toMatch(/^Y spec working \| wA \|/m)
  })

  test('ARC-15 with only the raced job open, the losing worker gets NOTHING and the winner keeps the job', async () => {
    const w = await world([card('X')])
    const { a, b } = await raced(w, ['next', '--worker', 'wA', '--roles', 'spec'], ['next', '--worker', 'wB', '--roles', 'spec'])
    expect(b.out).toBe('CLAIMED X spec')
    expect(a.out).toBe('NOTHING')
    expect(a.code).toBe(4)
    const { tip, files } = await remoteClaims(w)
    expect(files['X.spec.json']).toMatchObject({ state: 'working', worker: 'wB' })
    expect(await isAncestor(w, b.after, tip)).toBe(true)
    // B still holds X: B may beat it, A may not.
    expect((await claim(w, ['beat', 'X', 'spec', '--worker', 'wB'])).code).toBe(0)
    expect((await claim(w, ['beat', 'X', 'spec', '--worker', 'wA'])).code).toBe(6)
  })

  test('ARC-15 a claim on a different job made between T and the write is kept, and the new claim lands on top of it', async () => {
    // X: a spec job (A's pick). Y: a build job with its spec on the card (B's pick).
    const w = await world([card('X'), card('Y', 'carded', { spec: 'abc1234' })])
    const { a, b } = await raced(w, ['next', '--worker', 'wA', '--roles', 'spec'], ['next', '--worker', 'wB', '--roles', 'build'])
    expect(b.out).toBe('CLAIMED Y build')
    expect(a.out).toBe('CLAIMED X spec')
    expect(a.code).toBe(0)
    const { tip, files } = await remoteClaims(w)
    expect(files['Y.build.json']).toMatchObject({ card: 'Y', role: 'build', state: 'working', worker: 'wB' })
    expect(files['X.spec.json']).toMatchObject({ card: 'X', role: 'spec', state: 'working', worker: 'wA' })
    expect(files['Z.build.json']).toMatchObject({ state: 'reported', worker: 'w0' })
    // A's claim is a new commit on top of B's (no force, no rewind), and it is the remote tip.
    expect(tip).not.toBe(b.after)
    expect(await isAncestor(w, b.after, tip)).toBe(true)
    expect(await git(w.remote, 'log', '-1', '--format=%s', tip)).toBe('working X spec (wA)')
  })
})
