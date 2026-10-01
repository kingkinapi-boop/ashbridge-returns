// npm run mutate:changed [base]: mutation-test the changed src/**/*.ts files marked `// @mutate` in their first 5 lines.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const base = process.argv[2] ?? 'origin/main'
const git = (args) => spawnSync('git', args, { encoding: 'utf8' })

// A shallow cloud clone may not have the base yet.
const branch = base.startsWith('origin/') ? base.slice('origin/'.length) : null
if (branch) git(['fetch', '-q', 'origin', branch])

const diff = git(['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`])
if (diff.status !== 0) {
  console.error(`git diff against ${base} failed: ${diff.stderr.trim()}`)
  process.exit(1)
}
const targets = diff.stdout
  .split('\n')
  .filter((f) => /^src\/.*\.ts$/.test(f) && !/\.(test|acceptance)\.ts$|\.db\.test\.ts$|\.eval\.test\.ts$/.test(f))
  .filter((f) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').split('\n').slice(0, 5).some((l) => l.includes('// @mutate')))

if (targets.length === 0) {
  console.log('no mutation targets changed')
  process.exit(0)
}
console.log(`mutating: ${targets.join(', ')}`)
const r = spawnSync('npx', ['stryker', 'run', '--incremental', '--mutate', targets.join(',')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(r.status ?? 1)
