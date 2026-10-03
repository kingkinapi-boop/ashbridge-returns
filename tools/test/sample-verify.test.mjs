// FX8 acceptance tests, round 2 patch (A493; SEC-11, ARC-8, ARC-16): reference/sample-clients/verify.mjs run in scratch exports.
// The spec job wrote this file; the builder never edits it. Each test builds an export (the sample-clients folder and the contract
// it cites, committed in a fresh git repo with one commit and no remote), plants one fault, and reads verify.mjs's PASS and FAIL lines.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLIENTS = path.join(ROOT, 'reference', 'sample-clients')
const CONTRACT = path.join(ROOT, 'reference', 'onboarding-contract.md')
const OLD_VERIFY = path.join(ROOT, 'tools', 'test', '__fixtures__', 'sample-verify', 'verify-before-w16-round-2.mjs.txt')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fx8-verify-'))
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

let counter = 0
const GIT = ['-c', 'user.name=fx8', '-c', 'user.email=fx8@example.invalid', '-c', 'commit.gpgsign=false']
const git = (cwd, ...args) => spawnSync('git', [...GIT, ...args], { cwd, encoding: 'utf8' })

// An export with no history: copy, git init, one commit, no remote. before() edits the copy before the commit, after() edits it after.
function exportOf({ before, after } = {}) {
  const dir = path.join(tmp, `export-${String(++counter)}`)
  const clients = path.join(dir, 'reference', 'sample-clients')
  fs.cpSync(CLIENTS, clients, { recursive: true })
  fs.copyFileSync(CONTRACT, path.join(dir, 'reference', 'onboarding-contract.md'))
  before?.(clients)
  git(dir, 'init', '-q')
  git(dir, 'add', 'reference')
  git(dir, 'commit', '-q', '-m', 'one')
  after?.(clients)
  return { dir, clients }
}

function runVerify(clients) {
  const r = spawnSync(process.execPath, [path.join(clients, 'verify.mjs')], { cwd: clients, encoding: 'utf8', timeout: 120_000, maxBuffer: 1 << 28 })
  const lines = r.stdout.split('\n').filter((l) => /^(PASS|FAIL) /.test(l))
  return { status: r.status, lines, failed: lines.filter((l) => l.startsWith('FAIL ')) }
}

const readme = (clients) => path.join(clients, 'README.md')
const editReadme = (fn) => (clients) => {
  const text = fs.readFileSync(readme(clients), 'utf8')
  const next = fn(text)
  if (next === text) throw new Error('the plant changed nothing')
  fs.writeFileSync(readme(clients), next)
}

describe('FX8 history-free run (ARC-16)', () => {
  test('ARC-16 verify.mjs passes in an export with no history: git archive, git init, one commit, no remote', () => {
    const { clients } = exportOf()
    const run = runVerify(clients)
    expect(run.failed).toEqual([])
    expect(run.status).toBe(0)
  })

  test('ARC-16 plant: verify.mjs as it was before W16 round 2 fails both of its merge-base lines in a history-free export', () => {
    const { clients } = exportOf({ before: (c) => fs.copyFileSync(OLD_VERIFY, path.join(c, 'verify.mjs')) })
    const run = runVerify(clients)
    const merge = run.failed.filter((l) => /ARC-16 after regeneration, folders 01 to (10|12) are byte-identical/.test(l))
    expect(merge).toHaveLength(2)
    for (const l of merge) expect(l).toContain('origin/main')
  })
})

// The reason an R11 line gives, without the label (the label always says "N known" itself).
const r11Reasons = (run) =>
  run.failed.filter((l) => l.includes('R11')).map((l) => l.replace(/^FAIL R11 ARC-8 [^(:]*(\([^)]*\))?/, ''))

describe('FX8 verify.mjs R11 reads "N known" from the Status line (ARC-8)', () => {
  test('ARC-8 R11 fails when the Status line has no "N known" (a missing count is never 0)', () => {
    const { clients } = exportOf({ before: editReadme((t) => t.replace(/^(- Generated and verified:.*?), 0 known/m, '$1, none known')) })
    const run = runVerify(clients)
    expect(r11Reasons(run).some((r) => /known/.test(r))).toBe(true)
  })

  test('ARC-8 R11 reads the Status line only: a "0 known" elsewhere in the README does not stand in for it', () => {
    const { clients } = exportOf({
      before: editReadme((t) => `${t.replace(/^(- Generated and verified:.*?), 0 known/m, '$1, none known').trimEnd()}\n\nA note further down: 0 known.\n`),
    })
    const run = runVerify(clients)
    expect(r11Reasons(run).some((r) => /known/.test(r))).toBe(true)
  })
})

describe('FX8 verify.mjs reads every list line under "Opening UCC moved" (END-2)', () => {
  const TIE = 'W16 END-2 each opening UCC the README lists as moved'
  const oneCentOff = (line) => line.replace(/ to ([0-9,]+\.[0-9])([0-9])\./, (m, a, b) => ` to ${a}${String((Number(b) + 1) % 10)}.`)
  const plant = (makeLine) =>
    editReadme((t) => {
      const lines = t.split('\n')
      const i = lines.findIndex((l) => /^- 08 class 8: /.test(l))
      if (i < 0) throw new Error('no 08 class 8 bullet')
      lines[i] = makeLine(lines[i])
      return lines.join('\n')
    })

  test('END-2 control: the unchanged README passes the opening UCC tie', () => {
    const run = runVerify(exportOf().clients)
    expect(run.lines.filter((l) => l.includes(TIE))).toHaveLength(1)
    expect(run.lines.filter((l) => l.includes(TIE))[0]).toMatch(/^PASS /)
  })

  test('END-2 a "* " bullet with a wrong figure fails the tie (never skipped silently)', () => {
    const run = runVerify(exportOf({ before: plant((l) => `* ${oneCentOff(l.slice(2))}`) }).clients)
    expect(run.failed.some((l) => l.includes(TIE))).toBe(true)
  })

  test('END-2 an indented "- " bullet with a wrong figure fails the tie (never skipped silently)', () => {
    const run = runVerify(exportOf({ before: plant((l) => `  ${oneCentOff(l)}`) }).clients)
    expect(run.failed.some((l) => l.includes(TIE))).toBe(true)
  })
})

describe('FX8 verify.mjs checks folders outside SPEC (ARC-8, ARC-16)', () => {
  test('ARC-16 an untracked folder 16-planted-extra (no SPEC entry) fails the committed-data line, naming it', () => {
    const { clients } = exportOf({
      after: (c) => {
        const dst = path.join(c, '16-planted-extra')
        fs.cpSync(path.join(c, '01-maple-ridge'), dst, { recursive: true })
      },
    })
    const run = runVerify(clients)
    const committed = run.lines.filter((l) => l.includes('ARC-16 the committed sample data is the generator'))
    expect(committed).toHaveLength(1)
    expect(committed[0]).toMatch(/^FAIL /)
    expect(committed[0]).toContain('16-planted-extra')
  })

  test('ARC-8 a committed folder 16-planted-extra (no SPEC entry) fails a line that names it', () => {
    const { clients } = exportOf({ before: (c) => fs.cpSync(path.join(c, '01-maple-ridge'), path.join(c, '16-planted-extra'), { recursive: true }) })
    const run = runVerify(clients)
    expect(run.failed.some((l) => l.includes('16-planted-extra'))).toBe(true)
  })
})
