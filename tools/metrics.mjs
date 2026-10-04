// Writes one card's metrics line from the records, not from memory (lessons
// pattern 23): the queue's history on `claude/claims`, the amber tally and the
// mode. Called by skill merge when a card lands. Never leaves a field empty.
// CQ11: jobs and rounds count claims (a beat is not one); check_fails counts failed checks (and old failed builds);
// minutes runs from the first claim to now; tokens adds the --tokens values workers passed; train_fails counts the Lead's
// reopens whose note starts "train red:". The commit body written by tools/claim.mjs carries the time, note and tokens.
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
const nowMs = process.env.CLAIMS_NOW ? Date.parse(process.env.CLAIMS_NOW) : Date.now()
const entries = git(['log', '--reverse', '--format=%x1e%s%x1f%cI%x1f%b', 'refs/remotes/origin/claude/claims'])
  .split('\x1e')
  .filter(Boolean)
  .map((e) => {
    const [subject, committed, body = ''] = e.split('\x1f')
    const m = /^(\S+) (\S+) (\S+) \((.*)\)$/.exec(subject.trim())
    const field = (name) => (new RegExp(`^${name}: (.*)$`, 'm').exec(body) || [])[1]
    return m && m[2] === card ? { state: m[1], role: m[3], worker: m[4], at: Date.parse(field('at') || committed), note: field('note') || '', tokens: Number(field('tokens')) || 0 } : null
  })
  .filter(Boolean)
// A job starts at a "working" claim; a beat is "working" again by the same worker straight after "working".
const last = {}
const claims = []
for (const e of entries) {
  const prev = last[e.role]
  if (e.state === 'working' && !(prev && prev.state === 'working' && prev.worker === e.worker)) claims.push(e)
  last[e.role] = e
}
const count = (state, role) => entries.filter((e) => e.state === state && e.role === role).length
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
  rounds: claims.filter((e) => e.role === 'build').length,
  check_fails: count('failed', 'check') + count('failed', 'build'),
  train_fails: args.includes('--train-fails') ? num('train-fails') : entries.filter((e) => e.state === 'reopened' && /^train red:/i.test(e.note)).length,
  jobs: claims.length,
  minutes: claims.length ? Math.max(0, Math.round((nowMs - claims[0].at) / 60000)) : 0,
  tokens: entries.reduce((n, e) => n + e.tokens, 0),
  amber,
  red: num('red'),
  accepted: true,
}
if (args.includes('--dry')) console.log(JSON.stringify(line))
else {
  fs.appendFileSync(path.join(ROOT, 'plan', 'metrics.jsonl'), JSON.stringify(line) + '\n')
  console.log(`metrics: ${JSON.stringify(line)}`)
}
