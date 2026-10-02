// Shared helpers for the Lead's tools. No dependencies: runs before `npm ci`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

export function loadIndex() {
  return JSON.parse(read('plan/slices.json'))
}

// Card statuses that hold their paths (tools/next.mjs never starts an overlapping card).
export const IN_FLIGHT = new Set(['speccing', 'building', 'checking', 'merging'])

// "src/**" matches everything under src/; "*" matches within one folder.
export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else re += '[^/]*'
    } else if ('\\^$+?.()|{}[]'.includes(ch)) re += '\\' + ch
    else re += ch
  }
  return new RegExp('^' + re + '$')
}

// Two path lists overlap when the literal start of one glob (up to its first *)
// is a start of the other: "src/modules/ai/**" overlaps "src/modules/ai/runner/x.ts".
export function pathsOverlap(a, b) {
  const lit = (g) => g.split('*')[0]
  return a.some((x) => b.some((y) => lit(x).startsWith(lit(y)) || lit(y).startsWith(lit(x))))
}

// The dependency gate shared by tools/claim.mjs and tools/next.mjs (one implementation).
// A card is never offered if it or any dep is parked. Its spec is offered only when
// every dep is done or has a reported build; its build only when every dep is done.
// Checks are not gated by deps. Returns { ok: true } or { ok: false, why, waiting: [dep ids] }.
export function depGate(card, role, status, reportedBuilds) {
  const deps = card.deps || []
  const parked = deps.filter((d) => status[d] === 'parked')
  if (status[card.id] === 'parked' || parked.length) return { ok: false, why: 'parked', waiting: parked }
  if (role === 'check') return { ok: true }
  const waiting =
    role === 'spec'
      ? deps.filter((d) => status[d] !== 'done' && !reportedBuilds.has(d))
      : deps.filter((d) => status[d] !== 'done')
  return waiting.length ? { ok: false, why: role === 'spec' ? 'deps unbuilt' : 'deps unmerged', waiting } : { ok: true }
}

// Files whose change on main can break a spec written earlier (findings W14-D01, RC1): the test,
// type and lint config, the manifest, and the toolchain rule tests.
const TOOLCHAIN_FILES = ['vitest.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'package.json']
export const toolchainChanged = (files) => files.some((f) => TOOLCHAIN_FILES.includes(f) || /^tools\/test\/[^/]*-rules\.test\.mjs$/.test(f))

export function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}
