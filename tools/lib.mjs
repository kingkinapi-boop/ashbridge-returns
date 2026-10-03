// Shared helpers for the Lead's tools. No dependencies: runs before `npm ci`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

export function loadIndex() {
  try {
    return JSON.parse(read('plan/slices.json'))
  } catch (e) {
    throw new Error(`plan/slices.json: ${e.message}`)
  }
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

// CQ4 (R82): the expectation class, the files a spec job owns from the start when its card's Spec section names them.
// Tests, fixtures, goldens, verify scripts and README counts; never a code file the build writes. The class grows by
// this one list, never by prose.
export function isExpectationFile(file) {
  const base = file.split('/').pop()
  return (
    /\.test\./.test(base) ||
    /\.acceptance\./.test(base) ||
    /(^|\/)__fixtures__\//.test(file) ||
    /(^|\/)__golden__\//.test(file) ||
    /^verify[^/]*\.mjs$/.test(base) ||
    base === 'README.md'
  )
}

// The text of a card's "## <heading>" section (up to the next "## " heading), or undefined when it has none.
export function cardSection(cardText, heading) {
  const lines = cardText.split(/\r?\n/)
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${heading}\\b`).test(l))
  if (start < 0) return undefined
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##\s/.test(l))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

// The file names a section mentions: backticked tokens with no space, and bare tokens with an extension.
export function sectionNames(cardText, heading) {
  const section = cardSection(cardText, heading)
  if (section === undefined) return []
  const names = new Set()
  for (const m of section.matchAll(/`([^`\s]+)`/g)) names.add(m[1])
  for (const m of section.replace(/`[^`]*`/g, ' ').matchAll(/[\w./-]+\.\w{1,5}(?![\w/])/g)) names.add(m[0])
  return [...names]
}

const namesFile = (names, file) => names.some((n) => file === n || file.endsWith(`/${n}`))

// The R82 set among `files`: those the Spec section names that are in the expectation class and that the Build section
// does not name as its own (a file both name is R77's lint, SC6).
export function specOwnedFiles(cardText, files) {
  const spec = sectionNames(cardText, 'Spec')
  const build = sectionNames(cardText, 'Build')
  return files.filter((f) => isExpectationFile(f) && namesFile(spec, f) && !namesFile(build, f))
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}
