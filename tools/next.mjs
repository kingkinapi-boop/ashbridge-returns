// Which cards may start now: status "carded", the dependency gate open (see depGate), and no
// path overlap with a card in flight or with another card picked in this run.
// Usage: node tools/next.mjs [free slots, default 3]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex, IN_FLIGHT, pathsOverlap, depGate, cloudOnlyText, whereOf, newFileHolders, ROOT } from './lib.mjs'

const slots = Math.max(0, Number(process.argv[2] ?? 3))
const { cards } = loadIndex()
const status = Object.fromEntries(cards.map((c) => [c.id, c.status]))
const inFlight = cards.filter((c) => IN_FLIGHT.has(c.status))

// The same gate as the queue (tools/claim.mjs): a spec waits for every dep to have a
// reported build, a build for every dep to be merged. Reported builds come from `claim.mjs list`.
const reportedBuilds = new Set()
const reportedSpecs = new Set()
// CQ11 (A493): every card whose spec has reported (a refit one too) holds the new files its Paths name.
const specHolders = new Set()
const heldCards = new Set()
// CQ2 rule 3: in flight, waiting on check and ready to board all come from the claims.
const workingCards = new Set()
const workingJobs = []
const checkPending = new Set()
const readyToBoard = new Set()
const blockedBuild = new Set()
// CQ8 rule 1: the same path holds as the queue (claim.mjs busyFor): a working or reported build, or a
// working spec, holds its card's Paths; a build-ready card that overlaps them waits.
const pathHolders = new Set()
try {
  const listing = execFileSync('node', [path.join(ROOT, 'tools', 'claim.mjs'), 'list'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  for (const m of listing.matchAll(/^(\S+) build reported/gm)) reportedBuilds.add(m[1])
  // A reported spec (a reopened one is listed as "reopened", so it is not here).
  // A spec that needs a toolchain refit is listed with that tag and counts as not reported.
  for (const m of listing.matchAll(/^(\S+) spec reported(?! \(toolchain refit\))/gm)) reportedSpecs.add(m[1])
  for (const m of listing.matchAll(/^(\S+) spec reported/gm)) specHolders.add(m[1])
  // CQ1 rule 2: a job released with "wait:" and not yet lifted is listed as waiting, never started.
  for (const m of listing.matchAll(/^(\S+) (?:spec|build) released \(waiting\)/gm)) heldCards.add(m[1])
  for (const m of listing.matchAll(/^(\S+) (spec|build|check) working(?! \((?:stale|inactive)\))/gm)) {
    workingCards.add(m[1])
    workingJobs.push(m[1])
  }
  for (const m of listing.matchAll(/^(\S+) build (reported|hold-findings)/gm)) blockedBuild.add(m[1])
  for (const m of listing.matchAll(/^(\S+) build reported/gm)) checkPending.add(m[1])
  for (const m of listing.matchAll(/^(\S+) check reported(?! \(old build\))[^\n]*\| PASS\b/gm)) if (checkPending.has(m[1])) readyToBoard.add(m[1])
  for (const id of readyToBoard) checkPending.delete(id)
  // Active claims carry no tag in the listing (a stale or inactive one does).
  for (const m of listing.matchAll(/^(\S+) (?:build (?:working|reported)|spec working) \|/gm)) pathHolders.add(m[1])
} catch {}

// CQ8 rule 3, CQ11 (A482): the card's Where line says only "cloud" in every role (the reader is in lib.mjs).
function cloudOnly(c) {
  const text = (rel) => {
    try {
      return fs.readFileSync(path.join(ROOT, rel), 'utf8')
    } catch {
      return ''
    }
  }
  return cloudOnlyText(whereOf(text(`plan/cards/${c.id}.md`), c.family ? text(`plan/cards/families/${c.family}.md`) : '', c.where))
}
// CQ11 (A478 c): a card on a requested or checking train is never started.
let trainCards = new Set()
try {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'train.json'), 'utf8'))
  if (['requested', 'checking'].includes(t.status)) trainCards = new Set(t.cards || [])
} catch {}

let taken = inFlight.flatMap((c) => c.paths || [])
const picked = []
const blockedByPaths = []
const waitingOnDeps = []
const waitingHeld = []
const heldByPaths = []
for (const c of cards) {
  if (picked.length >= slots) break
  if (c.status !== 'carded') continue
  if (c.lane === 'design') continue // CQ1 rule 3: the design lane has no spec or build job
  if (workingCards.has(c.id) || blockedBuild.has(c.id)) continue // CQ2 rule 3: already being worked, or its build has reported
  if (trainCards.has(c.id)) continue
  if (heldCards.has(c.id)) {
    waitingHeld.push(c.id)
    continue
  }
  const specReported = !c.spec && reportedSpecs.has(c.id)
  const gate = depGate(c, c.spec || specReported ? 'build' : 'spec', status, reportedBuilds)
  if (!gate.ok) {
    if (gate.why !== 'parked' || gate.waiting.length) waitingOnDeps.push(`${c.id} (${gate.waiting.join(' ')}${gate.why === 'parked' ? ' parked' : ''})`)
    continue
  }
  const fileHolders = newFileHolders(c, cards, c.spec || specReported ? new Set([...specHolders, ...cards.filter((k) => k.spec && k.spec !== 'n/a').map((k) => k.id)]) : specHolders)
  if (fileHolders.length) {
    heldByPaths.push(`${c.id} waiting on paths: ${fileHolders.join(' ')}`)
    continue
  }
  if (c.spec || specReported) {
    const holders = cards.filter((k) => k.id !== c.id && pathHolders.has(k.id) && pathsOverlap(c.paths || [], k.paths || [])).map((k) => k.id)
    if (holders.length) {
      heldByPaths.push(`${c.id} waiting on paths: ${holders.join(' ')}`)
      continue
    }
  }
  if (pathsOverlap(c.paths || [], taken)) {
    blockedByPaths.push(c.id)
    continue
  }
  picked.push(c)
  taken = taken.concat(c.paths || [])
}

const count = (s) => cards.filter((c) => c.status === s).length
console.log(
  `in flight ${workingJobs.length} | can start ${picked.length} of ${slots} | carded ${count('carded')} | to write ${count('todo')} | parked ${count('parked')} | done ${count('done')}/${cards.length}`,
)
for (const c of picked) {
  const tags = [c.size, c.hard ? 'hard' : '', c.screens ? 'screens' : '', cloudOnly(c) ? 'cloud only' : c.where || ''].filter(Boolean).join(' ')
  const spec = c.spec ? (c.spec === 'n/a' ? 'no spec needed' : `spec ${c.spec}`) : reportedSpecs.has(c.id) ? 'spec reported (commit in the claim)' : 'NEEDS SPEC FIRST'
  console.log(`START ${c.id} [${tags}] ${spec} | ${c.title}`)
}
if (checkPending.size) console.log(`waiting on check: ${[...checkPending].join(' ')}`)
if (readyToBoard.size) console.log(`ready to board: ${[...readyToBoard].join(' ')}`)
if (waitingHeld.length) console.log(`waiting (released with wait:): ${waitingHeld.join(' ')}`)
if (waitingOnDeps.length) console.log(`waiting on deps: ${waitingOnDeps.join(', ')}`)
if (blockedByPaths.length) console.log(`waiting on paths in use: ${blockedByPaths.join(' ')}`)
for (const line of heldByPaths) console.log(line)
const toWrite = cards.filter((c) => c.status === 'todo').slice(0, 6)
if (toWrite.length) console.log(`next cards to write: ${toWrite.map((c) => c.id).join(' ')}`)
