// Writes one card's metrics line from the records, not from memory (lessons
// pattern 23): the queue's history on `claude/claims`, the amber tally and the
// mode. Called by skill merge when a card lands. Never leaves a field empty.
// Usage: node tools/metrics.mjs <card> [--train-fails N] [--red N] [--dry]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, read } from './lib.mjs'

const args = process.argv.slice(2)
const card = args[0]
const num = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) || 0 : 0
}
if (!card) {
  console.error('usage: node tools/metrics.mjs <card> [--train-fails N] [--red N] [--dry]')
  process.exit(2)
}
const git = (a) => {
  try {
    return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}
git(['fetch', '-q', 'origin', '+refs/heads/claude/claims:refs/remotes/origin/claude/claims'])
const subjects = git(['log', '--format=%s', 'refs/remotes/origin/claude/claims']).split('\n').filter(Boolean)
const mine = subjects.filter((s) => s.split(' ')[1] === card)
const count = (state, role) => mine.filter((s) => s.startsWith(`${state} ${card} ${role}`)).length
let mode = 'unknown'
try {
  mode = JSON.parse(read('plan/mode.json')).mode
} catch {}
let amber = 0
try {
  amber = read('plan/AMBER.md').split('\n').filter((l) => l.split('|').map((x) => x.trim())[3] === card).length
} catch {}
const line = {
  card,
  closed: new Date().toISOString().slice(0, 10),
  mode,
  rounds: count('working', 'build'),
  check_fails: count('failed', 'build'),
  train_fails: num('train-fails'),
  jobs: mine.filter((s) => s.startsWith(`working ${card} `)).length,
  amber,
  red: num('red'),
  accepted: true,
}
if (args.includes('--dry')) console.log(JSON.stringify(line))
else {
  fs.appendFileSync(path.join(ROOT, 'plan', 'metrics.jsonl'), JSON.stringify(line) + '\n')
  console.log(`metrics: ${JSON.stringify(line)}`)
}
