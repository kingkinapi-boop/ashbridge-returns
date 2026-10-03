/**
 * PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit. Makes the
 * spec-writer's acceptance tests and golden files read-only for whoever is
 * building a card, and makes a checker read-only except for its report
 * (decision 0001 R-3; reference/build-practices.md 1.4, 2.11).
 *
 * Why: nobody grades their own work. Research (ImpossibleBench, 2026) found
 * read-only tests stop agents from editing tests to pass; the checker's diff
 * catches it after the fact, this stops it before.
 *
 * How it knows the role: `tools/claim.mjs` writes `<git dir>/current-job.json`
 * ({card, role}) when a worker claims a job, and removes it when the job is
 * reported, failed or released. No file (the Lead, the Reviewer, ad hoc work):
 * allow. The file lives inside the git dir, so it is never committed and each
 * worktree has its own.
 *
 * Contract (code.claude.com/docs/en/hooks): stdin is JSON with tool_name,
 * tool_input and cwd. Exit 2 blocks the call and shows stderr to Claude.
 * Any error: allow (the checker's diff still catches edits).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// A451: also `.acceptance.db.test.ts` (and any one-word project infix)
const ACCEPTANCE = /\.acceptance\.([a-z0-9]+\.)?test\.[cm]?[jt]sx?$/
const GOLDEN = /(^|[\\/])__golden__[\\/]/

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let data = {}
  try {
    data = JSON.parse(input || '{}')
  } catch {
    process.exit(0)
  }
  const ti = data.tool_input || {}
  const target = String(ti.file_path || ti.notebook_path || '')
  if (!target) process.exit(0)
  const cwd = data.cwd || process.cwd()
  let job = null
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    job = JSON.parse(fs.readFileSync(path.resolve(cwd, gitDir, 'current-job.json'), 'utf8'))
  } catch {
    process.exit(0)
  }
  const rel = path.relative(cwd, path.resolve(cwd, target)).split(path.sep).join('/')
  if (job.role === 'build' && (ACCEPTANCE.test(rel) || GOLDEN.test(rel))) {
    process.stderr.write(
      `Refused: ${rel} belongs to the spec-writer of ${job.card}. Builders make acceptance tests and golden files pass; they never edit them. ` +
        'If the test is wrong, stop and say why in your report.\n',
    )
    process.exit(2)
  }
  if (job.role === 'check' && !rel.startsWith('reports/')) {
    process.stderr.write(`Refused: a checker edits nothing except its report under reports/ (job ${job.card} check).\n`)
    process.exit(2)
  }
  process.exit(0)
})
