// Shared helpers for the Lead's tools. No dependencies: runs before `npm ci`.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
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
    /\.spec\./.test(base) ||
    /\.acceptance\./.test(base) ||
    /(^|\/)__fixtures__\//.test(file) ||
    /(^|\/)__golden__\//.test(file) ||
    /^verify[^/]*\.mjs$/i.test(base) ||
    /^readme\.md$/i.test(base)
  )
}

// CQ11 (A465): a test the build writes itself (`*.build.test.ts`, `*.build.db.test.ts`) is in the expectation class but
// belongs to the build: a spec commit may have touched it and the build may still edit it.
export const isBuildOwnedTest = (file) => /\.build\.(?:db\.)?test\.[a-z]+$/.test(file.split('/').pop())

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

// ---- CQ11 (A482): the Where line, read in one place -------------------------------------------------------------
// A card's header line is the first line starting "Phase" (else the first line starting "Where:"); only that line counts.
// parseWhere answers { spec, build, check }, each 'cloud' (only a cloud-* worker may take that role) or 'any', or null
// when there is no Where text or it is outside the vocabulary: cloud, cloud only, local, local or cloud, local or cloud;
// check: cloud, local for unit tests; cloud for the journeys, local or cloud (...); cloud (...) for the check.
export function headerLine(text) {
  const lines = String(text || '').split(/\r?\n/)
  return lines.find((l) => /^Phase\b/.test(l)) ?? lines.find((l) => /^\s*Where:/.test(l)) ?? ''
}
const hasWhere = (text) => /\bWhere:/.test(headerLine(text))

export function parseWhere(text) {
  const line = headerLine(text)
  const at = line.indexOf('Where:')
  if (at < 0) return null
  let rest = line.slice(at + 'Where:'.length).replace(/\([^)]*\)/g, ' ')
  const dot = rest.indexOf('.')
  if (dot >= 0) rest = rest.slice(0, dot)
  const parts = rest.split(';').map((x) => x.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean)
  if (!parts.length) return null
  const out = {}
  const [first, ...more] = parts
  if (/^cloud(?: only)?$/.test(first)) out.spec = out.build = out.check = 'cloud'
  else if (/^local(?: or cloud| for .+)?$/.test(first)) out.spec = out.build = out.check = 'any'
  else return null
  for (const seg of more) {
    let m
    if ((m = /^(spec|build|check):\s*(cloud|local or cloud|local)(?: only)?$/.exec(seg))) out[m[1]] = m[2] === 'cloud' ? 'cloud' : 'any'
    else if ((m = /^cloud for the (spec|build|check)$/.exec(seg))) out[m[1]] = 'cloud'
    else if (/^cloud for the journeys$/.test(seg)) out.check = 'cloud'
    else if (/^[a-z]+:/.test(seg)) continue // Deps: and the like
    else return null
  }
  return out
}
export const whereFor = (text, role) => parseWhere(text)?.[role] ?? 'any'
export const cloudOnlyText = (text) => {
  const w = parseWhere(text)
  return Boolean(w && w.spec === 'cloud' && w.build === 'cloud' && w.check === 'cloud')
}
// The text the reader reads for a card: slices.json `where` first, then the card's own header line, then its family's.
export function whereOf(cardText, familyText, whereField) {
  if (typeof whereField === 'string') return `Where: ${whereField}`
  if (hasWhere(cardText)) return headerLine(cardText)
  return hasWhere(familyText) ? headerLine(familyText) : ''
}
// R1: cards [{ id, text, family, familyText, where }] whose Where line is missing or outside the vocabulary.
export function whereLines(cards) {
  const bad = []
  for (const c of cards) {
    const text = whereOf(c.text, c.familyText, c.where)
    if (!text) bad.push({ id: c.id, why: c.family ? `no Where line in the card or in family ${c.family}` : 'no Where line' })
    else if (!parseWhere(text)) bad.push({ id: c.id, why: `Where line outside the vocabulary: ${text.trim().slice(0, 100)}` })
  }
  return bad
}

// ---- CQ11 (A493): a new file a reported spec names holds every other card that names it ---------------------------
export function existsOnMain(rel) {
  for (const ref of ['origin/main', 'main']) {
    try {
      execFileSync('git', ['cat-file', '-e', `${ref}:${rel}`], { cwd: ROOT, stdio: 'ignore' })
      return true
    } catch {}
  }
  return false
}
// The cards (not done) other than `card` whose spec has reported (`specHolders`: their ids, from the claims and from slices
// `spec`) and whose Paths name a new file of the expectation class (a test or fixture the spec job writes, not on main) that
// `card` names too. Two cards that both qualify hold each other, which next.mjs prints, so the Lead splits their Paths.
export function newFileHolders(card, cards, specHolders) {
  const mine = (card.paths || []).filter((p) => !p.includes('*') && isExpectationFile(p))
  if (!mine.length) return []
  return cards
    .filter((k) => k.id !== card.id && k.status !== 'done' && specHolders.has(k.id))
    .filter((k) => (k.paths || []).some((p) => mine.includes(p) && !existsOnMain(p)))
    .map((k) => k.id)
}
