// Does a branch touch only its card's paths? Exit 0 clean, 1 outside, 2 usage.
// Usage: node tools/scope.mjs <card> [base, default origin/main or main]
// Also allowed without counting as outside: the spec-writer's own files
// (*.acceptance.test.ts, __golden__/) and any test or golden paths the card file lists.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex, globToRegExp, ROOT } from './lib.mjs'

const [id, baseArg] = process.argv.slice(2)
if (!id) {
  console.error('usage: node tools/scope.mjs <card> [base]')
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
let files
try {
  files = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
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

const testGlobs = ['**/*.acceptance.test.ts', '**/__golden__/**', ...listedTestPaths()]
const allowed = [...(card.paths || []), ...testGlobs, 'reports/**', `plan/cards/${id}.md`].map(globToRegExp)
const outside = files.filter((f) => !allowed.some((re) => re.test(f)))
if (outside.length) {
  console.log(`SCOPE FAIL ${id}: ${outside.length} file(s) outside the card's paths:`)
  for (const f of outside.slice(0, 20)) console.log(`  ${f}`)
  process.exit(1)
}
console.log(`SCOPE OK ${id}: ${files.length} file(s) changed, all inside the card's paths`)
