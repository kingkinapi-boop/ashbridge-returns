// Does a branch touch only its card's paths? Exit 0 clean, 1 outside, 2 usage.
// It reads origin/claude/<card> (or origin/<name> with --branch <name>), never HEAD (exit 2 when that branch is missing).
// Usage: node tools/scope.mjs <card> [base, default origin/main or main] [--board] [--branch <name>]
// Also allowed without counting as outside: every file a `spec(<card>):` commit touched (spec-writer step 7),
// the name patterns (*.acceptance.test.ts, __golden__/) and any test or golden paths the card file lists.
// A spec file that a later build commit changes fails as "spec file edited by the build"; when a later spec(<card>):
// commit rewrote it, the edit is printed as "note: superseded by <sha>" and does not fail. Commits to reports/** and
// plan/** never count as spec edits.
// CQ4 (R82): the card is read from the base ref. A changed file its Spec section names, in the expectation class
// (tools/lib.mjs isExpectationFile) and not named by its Build section, is the spec job's from the start; a merge commit
// that holds content from neither parent (a hand edit or a hand-resolved conflict) in a spec file fails by name.
// plan/ledger.jsonl (the budget hook's rows) is never outside; it is listed, and fails with --board.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex, globToRegExp, specOwnedFiles, ROOT } from './lib.mjs'

const argv = process.argv.slice(2)
const board = argv.includes('--board')
const branchAt = argv.indexOf('--branch')
const branchName = branchAt >= 0 ? argv[branchAt + 1] : undefined
if (branchAt >= 0 && (!branchName || branchName.startsWith('--'))) {
  console.error('usage: node tools/scope.mjs <card> [base] [--board] [--branch <name>]')
  process.exit(2)
}
const positional = argv.filter((a, i) => a !== '--board' && i !== branchAt && !(branchAt >= 0 && i === branchAt + 1))
const [id, baseArg] = positional
if (!id) {
  console.error('usage: node tools/scope.mjs <card> [base] [--board] [--branch <name>]')
  process.exit(2)
}
const card = loadIndex().cards.find((c) => c.id === id)
if (!card) {
  console.error(`no card ${id} in plan/slices.json`)
  process.exit(2)
}
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const isAncestor = (a, b) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
let base = baseArg
if (!base) {
  try {
    git('rev-parse', '--verify', 'origin/main')
    base = 'origin/main'
  } catch {
    base = 'main'
  }
}
// CQ2 rule 4: the card's own branch (or the one --branch names), whatever the current checkout.
const branch = branchName ?? `claude/${id}`
const ref = `origin/${branch}`
try {
  git('fetch', '-q', 'origin', `+refs/heads/${branch}:refs/remotes/${ref}`)
} catch {}
try {
  git('rev-parse', '--verify', '-q', `refs/remotes/${ref}`)
} catch {
  console.error(`branch ${ref} is missing: push ${branch} first`)
  process.exit(2)
}
let files
try {
  files = git('diff', '--name-only', `${base}...${ref}`).split('\n').filter(Boolean)
} catch {
  console.error(`git diff against ${base} failed`)
  process.exit(2)
}

// The card as the base ref has it, so a branch cannot unname a file; the checkout's copy only when base has none.
function cardText() {
  try {
    return git('show', `${base}:plan/cards/${id}.md`)
  } catch {}
  try {
    const text = fs.readFileSync(path.join(ROOT, 'plan', 'cards', `${id}.md`), 'utf8')
    console.log(`card read from the checkout: ${base} has no plan/cards/${id}.md`)
    return text
  } catch {
    return ''
  }
}
const cardSource = cardText()

// Test and golden files the card lists: a "Tests:" or "Golden:" line (comma separated), or
// paths in a bullet list or backticks under a heading that names tests or golden files.
function listedTestPaths() {
  const found = []
  const add = (chunk) => {
    for (const m of chunk.matchAll(/`([^`]+)`/g)) found.push(m[1].trim())
    for (const x of chunk.replace(/`[^`]*`/g, '').split(',')) {
      const t = x.replace(/^[-*\s]+/, '').trim()
      if (!/\s/.test(t) && t.length > 2 && (t.includes('/') || /\.\w+$/.test(t))) found.push(t)
    }
  }
  let inSection = false
  for (const line of cardSource.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      inSection = /\b(tests?|golden)\b/i.test(heading[1])
      continue
    }
    const labelled = line.match(/^\s*(?:[-*]\s*)?(?:Acceptance )?(?:Tests?|Golden(?: files)?)\s*:\s*(.*)$/i)
    if (labelled) add(labelled[1])
    else if (inSection && /^\s*[-*]\s/.test(line)) add(line)
  }
  return found
}

// R82: the changed files the Spec section owns from the start (tools/lib.mjs).
const specNamedFiles = new Set(specOwnedFiles(cardSource, files))
/** Reports and plan files are never spec edits: the spec job's own report and Spec commit line live there. */
const neverSpec = (f) => /^(reports|plan)\//.test(f)

const testGlobs = ['**/*.acceptance.test.ts', '**/__golden__/**', ...listedTestPaths()]
// Spec files by commit: walk the branch's own commits oldest first.
const touchedBy = (sha) => git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha).split('\n').filter(Boolean)
const commits = git('log', '--no-merges', '--reverse', '--format=%H%x09%s', `${base}..${ref}`)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [sha, ...rest] = l.split('\t')
    const subject = rest.join('\t')
    return { sha, spec: subject.startsWith(`spec(${id}):`), touched: touchedBy(sha) }
  })
const specCommits = commits.filter((c) => c.spec)
/** Every file a spec commit touched: allowed wherever it lies. */
const specFiles = new Set(specCommits.flatMap((c) => c.touched))
/** The spec commit after `index` (in the walk) that rewrote `file`, if any. */
const rewroteLater = (file, index) => commits.slice(index + 1).find((c) => c.spec && c.touched.includes(file))

const edited = []
const superseded = []
const owned = new Set()
commits.forEach((c, i) => {
  if (c.spec) {
    for (const f of c.touched) if (!neverSpec(f)) owned.add(f)
    return
  }
  for (const f of c.touched) {
    if (neverSpec(f) || !(owned.has(f) || specNamedFiles.has(f))) continue
    const later = rewroteLater(f, i)
    if (later) superseded.push(`${f} in ${c.sha.slice(0, 7)}: note: superseded by ${later.sha.slice(0, 7)}`)
    else edited.push(`${f} in ${c.sha.slice(0, 7)}`)
  }
})
// R82: --cc lists only files whose merged content differs from every parent.
const handMerged = []
for (const sha of git('log', '--merges', '--format=%H', `${base}..${ref}`).split('\n').filter(Boolean)) {
  const before = new Set(specCommits.filter((c) => isAncestor(c.sha, sha)).flatMap((c) => c.touched))
  for (const f of git('diff-tree', '--cc', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean)) {
    if (neverSpec(f) || !(before.has(f) || specNamedFiles.has(f))) continue
    const later = specCommits.find((c) => c.touched.includes(f) && c.sha !== sha && isAncestor(sha, c.sha))
    if (later) superseded.push(`${f} in merge ${sha.slice(0, 7)}: note: superseded by ${later.sha.slice(0, 7)}`)
    else handMerged.push(`${f} in merge ${sha.slice(0, 7)}`)
  }
}

const LEDGER = 'plan/ledger.jsonl'
const allowed = [...(card.paths || []), ...testGlobs, 'reports/**', `plan/cards/${id}.md`].map(globToRegExp)
const outside = files.filter((f) => f !== LEDGER && !specFiles.has(f) && !allowed.some((re) => re.test(f)))
const hasLedger = files.includes(LEDGER)
let failed = false
if (outside.length) {
  console.log(`SCOPE FAIL ${id}: ${outside.length} file(s) outside the card's paths:`)
  for (const f of outside.slice(0, 20)) console.log(`  ${f}`)
  failed = true
}
if (edited.length) {
  console.log(`SCOPE FAIL ${id}: spec file edited by the build:`)
  for (const e of edited) console.log(`  spec file edited by the build: ${e}`)
  failed = true
}
if (handMerged.length) {
  console.log(`SCOPE FAIL ${id}: spec file edited by hand in a merge commit:`)
  for (const e of handMerged) console.log(`  spec file edited by hand in a merge: ${e}`)
  failed = true
}
for (const s of superseded) console.log(`  ${s}`)
if (hasLedger) {
  console.log('ledger rows on this branch: revert before boarding')
  if (board) {
    console.log(`SCOPE FAIL ${id}: ledger on a card branch: ${LEDGER}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log(`SCOPE OK ${id}: ${files.length} file(s) changed, all inside the card's paths${branchName ? ` (${ref})` : ''}`)
