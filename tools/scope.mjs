// Does a branch touch only its card's paths? Exit 0 clean, 1 outside, 2 usage.
// It reads origin/claude/<card>, never HEAD (exit 2 when that branch is missing).
// Usage: node tools/scope.mjs <card> [base, default origin/main or main] [--board]
// Also allowed without counting as outside: every file a `spec(<card>):` commit touched (spec-writer step 7),
// the name patterns (*.acceptance.test.ts, __golden__/) and any test or golden paths the card file lists.
// A spec file that a later build commit changes fails as "spec file edited by the build".
// CQ4 (R82): a changed file the card's Spec section names is the spec job's from the start, and a merge commit
// that holds content from neither parent (a hand edit or a hand-resolved conflict) in one fails by name.
// plan/ledger.jsonl (the budget hook's rows) is never outside; it is listed, and fails with --board.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex, globToRegExp, ROOT } from './lib.mjs'

const argv = process.argv.slice(2)
const board = argv.includes('--board')
const [id, baseArg] = argv.filter((a) => a !== '--board')
if (!id) {
  console.error('usage: node tools/scope.mjs <card> [base] [--board]')
  process.exit(2)
}
const card = loadIndex().cards.find((c) => c.id === id)
if (!card) {
  console.error(`no card ${id} in plan/slices.json`)
  process.exit(2)
}
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
let base = baseArg
if (!base) {
  try {
    git('rev-parse', '--verify', 'origin/main')
    base = 'origin/main'
  } catch {
    base = 'main'
  }
}
// CQ2 rule 4: the card's own branch, whatever the current checkout.
const ref = `origin/claude/${id}`
try {
  git('fetch', '-q', 'origin', `+refs/heads/claude/${id}:refs/remotes/${ref}`)
} catch {}
try {
  git('rev-parse', '--verify', '-q', `refs/remotes/${ref}`)
} catch {
  console.error(`branch ${ref} is missing: push claude/${id} first`)
  process.exit(2)
}
let files
try {
  files = git('diff', '--name-only', `${base}...${ref}`).split('\n').filter(Boolean)
} catch {
  console.error(`git diff against ${base} failed`)
  process.exit(2)
}

// Test and golden files the card lists: a "Tests:" or "Golden:" line (comma separated), or
// paths in a bullet list or backticks under a heading that names tests or golden files.
function listedTestPaths() {
  let text = ''
  try {
    text = fs.readFileSync(path.join(ROOT, 'plan', 'cards', `${id}.md`), 'utf8')
  } catch {
    return []
  }
  const found = []
  const add = (chunk) => {
    for (const m of chunk.matchAll(/`([^`]+)`/g)) found.push(m[1].trim())
    for (const x of chunk.replace(/`[^`]*`/g, '').split(',')) {
      const t = x.replace(/^[-*\s]+/, '').trim()
      if (!/\s/.test(t) && t.length > 2 && (t.includes('/') || /\.\w+$/.test(t))) found.push(t)
    }
  }
  let inSection = false
  for (const line of text.split(/\r?\n/)) {
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

// Files the card's Spec section names (backticked, or a bare token with an extension), matched to changed files by
// full path or by trailing path.
function specNamed() {
  let text = ''
  try {
    text = fs.readFileSync(path.join(ROOT, 'plan', 'cards', `${id}.md`), 'utf8')
  } catch {
    return new Set()
  }
  const section = text.match(/^##\s+Spec\b[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m)
  if (!section) return new Set()
  const names = new Set()
  for (const m of section[1].matchAll(/`([^`\s]+)`/g)) names.add(m[1])
  for (const m of section[1].replace(/`[^`]*`/g, ' ').matchAll(/[\w./-]+\.\w{1,5}(?![\w/])/g)) names.add(m[0])
  return new Set(files.filter((f) => [...names].some((n) => f === n || f.endsWith(`/${n}`))))
}
const specNamedFiles = specNamed()

const testGlobs = ['**/*.acceptance.test.ts', '**/__golden__/**', ...listedTestPaths()]
// Spec files by commit: walk the branch's own commits oldest first.
const specFiles = new Set()
const edited = []
const commits = git('log', '--no-merges', '--reverse', '--format=%H%x09%s', `${base}..${ref}`)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [sha, ...rest] = l.split('\t')
    return { sha, subject: rest.join('\t') }
  })
for (const { sha, subject } of commits) {
  const touched = git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha).split('\n').filter(Boolean)
  if (subject.startsWith(`spec(${id}):`)) {
    for (const f of touched) specFiles.add(f)
  } else {
    for (const f of touched) if (specFiles.has(f) || specNamedFiles.has(f)) edited.push(`${f} in ${sha.slice(0, 7)}`)
  }
}
// R82: --cc lists only files whose merged content differs from every parent.
const handMerged = []
for (const sha of git('log', '--merges', '--format=%H', `${base}..${ref}`).split('\n').filter(Boolean)) {
  for (const f of git('diff-tree', '--cc', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean)) {
    if (specNamedFiles.has(f)) handMerged.push(`${f} in merge ${sha.slice(0, 7)}`)
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
if (hasLedger) {
  console.log('ledger rows on this branch: revert before boarding')
  if (board) {
    console.log(`SCOPE FAIL ${id}: ledger on a card branch: ${LEDGER}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log(`SCOPE OK ${id}: ${files.length} file(s) changed, all inside the card's paths`)
