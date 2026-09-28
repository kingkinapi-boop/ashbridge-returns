// Five-line picture of the build for the Lead and the Reviewer.
// Usage: node tools/status.mjs
import { loadIndex, read, IN_FLIGHT, todayUtc } from './lib.mjs'

const { cards, blueprint } = loadIndex()
const tryRead = (p, fallback) => {
  try {
    return read(p)
  } catch {
    return fallback
  }
}

let mode = '?'
try {
  const m = JSON.parse(tryRead('plan/mode.json', '{}'))
  mode = m.mode + (m.resume_to ? ` (resume to ${m.resume_to})` : '')
} catch {}

const day = todayUtc()
const ledger = tryRead('plan/ledger.jsonl', '').split('\n')
const dispatched = ledger.filter((l) => l.includes(`"day":"${day}"`) && l.includes('"allowed":true')).length
const refused = ledger.filter((l) => l.includes(`"day":"${day}"`) && l.includes('"allowed":false')).length

let usage = ''
try {
  const u = JSON.parse(tryRead('plan/usage-now.json', '{}'))
  const rl = u.rate_limits || {}
  const pct = (x) => (x && typeof x.used_percentage === 'number' ? `${Math.round(x.used_percentage)}%` : null)
  const five = pct(rl.five_hour)
  const week = pct(rl.seven_day || rl.weekly)
  if (five || week) usage = ` | plan use: 5h ${five ?? '?'}, week ${week ?? '?'} (at ${String(u.at).slice(11, 16)}Z)`
} catch {}

const by = (s) => cards.filter((c) => c.status === s).length
const flying = cards.filter((c) => IN_FLIGHT.has(c.status))
const ambers = (tryRead('plan/AMBER.md', '').match(/\|\s*open\s*\|\s*$/gm) || []).length
const matrix = tryRead('plan/MATRIX.md', '').split('\n').find((l) => l.startsWith('Clauses')) || 'matrix not run yet'

console.log(`mode ${mode} | blueprint ${blueprint} | dispatches today ${dispatched}${refused ? `, refused ${refused}` : ''}${usage}`)
console.log(`cards: done ${by('done')}, in flight ${flying.length}, carded ${by('carded')}, to write ${by('todo')}, parked ${by('parked')} (of ${cards.length})`)
for (const c of flying) console.log(`  ${c.id} ${c.status} | ${c.title}`)
console.log(`${matrix} | open ambers ${ambers}`)
