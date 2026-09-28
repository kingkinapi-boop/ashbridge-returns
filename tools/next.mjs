// Which cards may start now: status "carded", every dependency "done", and no
// path overlap with a card in flight or with another card picked in this run.
// Usage: node tools/next.mjs [free slots, default 3]
import { loadIndex, IN_FLIGHT, pathsOverlap } from './lib.mjs'

const slots = Math.max(0, Number(process.argv[2] ?? 3))
const { cards } = loadIndex()
const status = Object.fromEntries(cards.map((c) => [c.id, c.status]))
const depsDone = (c) => (c.deps || []).every((d) => status[d] === 'done')
const inFlight = cards.filter((c) => IN_FLIGHT.has(c.status))

let taken = inFlight.flatMap((c) => c.paths || [])
const picked = []
const blockedByPaths = []
for (const c of cards) {
  if (picked.length >= slots) break
  if (c.status !== 'carded' || !depsDone(c)) continue
  if (pathsOverlap(c.paths || [], taken)) {
    blockedByPaths.push(c.id)
    continue
  }
  picked.push(c)
  taken = taken.concat(c.paths || [])
}

const count = (s) => cards.filter((c) => c.status === s).length
console.log(
  `in flight ${inFlight.length} | can start ${picked.length} of ${slots} | carded ${count('carded')} | to write ${count('todo')} | parked ${count('parked')} | done ${count('done')}/${cards.length}`,
)
for (const c of picked) {
  const tags = [c.size, c.hard ? 'hard' : '', c.screens ? 'screens' : '', c.where || ''].filter(Boolean).join(' ')
  const spec = c.spec ? (c.spec === 'n/a' ? 'no spec needed' : `spec ${c.spec}`) : 'NEEDS SPEC FIRST'
  console.log(`START ${c.id} [${tags}] ${spec} | ${c.title}`)
}
if (blockedByPaths.length) console.log(`waiting on paths in use: ${blockedByPaths.join(' ')}`)
const toWrite = cards.filter((c) => c.status === 'todo').slice(0, 6)
if (toWrite.length) console.log(`next cards to write: ${toWrite.map((c) => c.id).join(' ')}`)
