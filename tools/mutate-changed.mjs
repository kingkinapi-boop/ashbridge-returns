// npm run mutate:changed -- <card> [base]: mutation-test the changed src/**/*.ts files marked `// @mutate` in their first 5 lines.
// On a core card (its card file's Tags line starts with `core`) a changed src file inside the card's Paths with no marker fails first.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex, globToRegExp, ROOT } from './lib.mjs'

const [id, baseArg] = process.argv.slice(2)
if (!id) {
  console.error('usage: node tools/mutate-changed.mjs <card> [base]')
  process.exit(2)
}
const card = loadIndex().cards.find((c) => c.id === id)
const cardFile = path.join(ROOT, 'plan', 'cards', `${id}.md`)
if (!card || !fs.existsSync(cardFile)) {
  console.error(`no card ${id} (plan/slices.json and plan/cards/${id}.md)`)
  process.exit(2)
}
const core = /^Tags:\s*core\b/m.test(fs.readFileSync(cardFile, 'utf8'))

const base = baseArg ?? 'origin/main'
const git = (args) => spawnSync('git', args, { encoding: 'utf8' })

// A shallow cloud clone may not have the base yet.
const branch = base.startsWith('origin/') ? base.slice('origin/'.length) : null
if (branch) git(['fetch', '-q', 'origin', branch])

const diff = git(['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`])
if (diff.status !== 0) {
  console.error(`git diff against ${base} failed: ${diff.stderr.trim()}`)
  process.exit(1)
}
const changed = diff.stdout
  .split('\n')
  .filter((f) => /^src\/.*\.ts$/.test(f) && !/\.(test|acceptance)\.ts$|\.db\.test\.ts$|\.eval\.test\.ts$/.test(f))
  .filter((f) => fs.existsSync(f))
const marked = (f) => fs.readFileSync(f, 'utf8').split('\n').slice(0, 5).some((l) => l.includes('// @mutate'))

if (core) {
  const inPaths = (card.paths || []).map(globToRegExp)
  const missing = changed.filter((f) => inPaths.some((re) => re.test(f)) && !marked(f))
  if (missing.length > 0) {
    console.error(`core file without @mutate (first 5 lines): ${missing.join(', ')}`)
    process.exit(1)
  }
}

if (changed.length === 0) {
  console.log('no mutation targets changed')
  process.exit(0)
}
const targets = changed.filter(marked)
if (targets.length === 0) {
  console.log('no marked mutation targets among the changed src files')
  process.exit(0)
}
const bad = targets.filter((f) => !/^[\w./-]+$/.test(f))
if (bad.length > 0) {
  console.error(`refusing mutation target with unsafe characters: ${bad.join(', ')}`)
  process.exit(1)
}
console.log(`mutating: ${targets.join(', ')}`)
const stryker = 'node_modules/@stryker-mutator/core/bin/stryker.js'
const r = spawnSync(process.execPath, [stryker, 'run', '--incremental', '--mutate', targets.join(',')], {
  stdio: 'inherit',
  shell:false,
})
process.exit(r.status ?? 1)
