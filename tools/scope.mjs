// Does a branch touch only its card's paths? Exit 0 clean, 1 outside, 2 usage.
// Usage: node tools/scope.mjs <card> [base, default origin/main or main]
import { execFileSync } from 'node:child_process'
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
const allowed = [...(card.paths || []), 'reports/**', `plan/cards/${id}.md`].map(globToRegExp)
const outside = files.filter((f) => !allowed.some((re) => re.test(f)))
if (outside.length) {
  console.log(`SCOPE FAIL ${id}: ${outside.length} file(s) outside the card's paths:`)
  for (const f of outside.slice(0, 20)) console.log(`  ${f}`)
  process.exit(1)
}
console.log(`SCOPE OK ${id}: ${files.length} file(s) changed, all inside the card's paths`)
