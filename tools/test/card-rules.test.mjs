// SC10: card rules R85, R86, R87 and R89 (unit project). Card plan/cards/SC10.md; clauses ARC-15, ARC-16, FLOW-2.
// From reports/DB16-findings.md and reports/CQ4-findings.md (A430), C1 of reports/phase3-card-review-2026-10-03b.md
// (A437, A438) and SC10's findings review 1 (A502: round 2, items P1 to P8). Each rule is a pure function over a
// "world" (the cards of plan/slices.json, their card text, the harness list, the lifecycle MOVES and deps.ts source). It
// is first shown catching a planted bad example (real forms copied from main under tools/test/__fixtures__/card-rules/)
// with pinned statuses (never the live plan/slices.json statuses), then applied to the repo.
//
// The closed forms (A502 item 2: each rule takes exactly these forms and nothing that merely looks right):
//
// Reading cards (P3). A card's text is its own plan/cards/<id>.md; a card with a family in slices.json and no own file
// reads its family template with every {param} replaced by the card's param (as CQ6's mutation gate reads it). The
// floors and the sentinel come from every card, whatever its status: at least 300 cards read, at least one family card
// read through its template with one of its own {param} placeholders put in, and SC10's own card read with the Tags word
// core. Then R85, R86 and R87 judge open cards only (status neither done nor parked), and an open card with no text
// fails by id under each rule, never a silent skip. A done card is never judged, so setting a card done never fails it.
//
// R85, the Tags line (P4). The card has exactly one line that starts with the word Tags, a colon and a space, and the
// label (Tags followed by a colon) appears nowhere else in the card. What follows the label is either the form
// "as <ID>." (a card id in plan/slices.json, then a full stop), and the card takes that card's words (a chain is
// followed; a loop or an id with no card text fails), or a list that ends with a full stop: the text before the
// full stop, split at commas outside parentheses, gives parts that are each, once trimmed, one word of none, core,
// security or screens, optionally followed by one space and a "(reason)" whose parentheses balance and close at the
// end of the part. none stands alone; no word appears twice; the word core (as a token, the way CQ6's mutation gate
// splits the line) appears inside a reason only on a card whose words hold core. Then the slices.json flags core,
// security and screens each equal the presence of that word. Anything else fails naming the card.
//
// R86, the Harness line (P5). R86 reads only lines that start with the word Harness and a colon. At most one; it is
// the label, a colon, a space, then full repo paths (folders and a file name, no glob, no space) separated by a comma
// and a space, and nothing else. Each listed file is on CQ6's harness list (tools/test-homes.json) and in the card's
// Paths (slices.json, globs matched). A core card (the slices.json core flag or the word core on its closed Tags line;
// R85 makes the two agree) whose Paths hold a file on the harness list passes only when its Harness line lists that
// file. Prose anywhere else (a Paths line, a sentence naming a file and the word harness, a quoted failure message)
// never counts, either way.
//
// R87 (P7). The R82 set comes from tools/lib.mjs's specOwnedFiles (CQ4's reader of the Spec and Build sections, the one
// CQ11 moves); it is judged after the floor, on open cards only.
//
// R89 (P6). Guard names come from the imported MOVES[].guard of src/modules/lifecycle/moves.ts, never from its text.
// The guards registered are those passed to createLifecycle in src/pipeline/deps.ts (a missing file registers none),
// read in this reach only: a direct call (an optional type argument allowed) whose first argument is an object literal;
// in it, a "guards" option that is an object literal (optionally followed by "as" or "satisfies" and a type), the name
// of an object literal declared with const in the same file, or the shorthand "guards" for such a const; inside those
// objects, literal keys (a bare or quoted name then a colon), shorthand names, and spreads of a same-file const object
// literal. Any other part fails naming it ("src/pipeline/deps.ts passes guards R89 cannot read: <part>"): a spread from
// another file or of a call, a computed key, a method, a call or other value for guards, a spread or computed key in
// the options, options that are not an object literal, an import alias of createLifecycle, and any use of the name
// createLifecycle that is not an import or a direct call. Comments and plain strings never register. Every guard in
// neither deps.ts nor data/lifecycle/unbuilt-guards.json fails; a listed guard that deps.ts registers fails as stale;
// an owner that is not a card, is parked, or is done with its guard unregistered fails; every list owner, and every open
// card whose Paths cover moves.ts, lists data/lifecycle/unbuilt-guards.json in its Paths (an owner also
// src/pipeline/deps.ts); the list is empty at the phase 4 gate.
//
// KNOWN (P2) lands empty. An entry names one rule, one subject, the exact problem strings and an owner card that is
// open (neither done nor parked) and whose Paths hold this file; an entry that no longer fails is stale and fails.
// A rule that fails on main is a defect of the card that owns it, fixed by a card edit, never a looser rule (A329).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'
import { globToRegExp, isExpectationFile, sectionNames, specOwnedFiles } from '../lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX_REL = 'tools/test/__fixtures__/card-rules'
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))
const fix = (name) => read(`${FIX_REL}/${name}`)
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href)

const SELF_REL = 'tools/test/card-rules.test.mjs'
const MOVES_REL = 'src/modules/lifecycle/moves.ts'
const DEPS_REL = 'src/pipeline/deps.ts'
const LIST_REL = 'data/lifecycle/unbuilt-guards.json'
const HOMES_REL = 'tools/test-homes.json'
// CQ6's harness list as its spec pins it after A464 (the real setup file, src/core/db/vitest-setup.ts). Plants only.
const PINNED_HARNESS = [
  'src/core/db/index.ts',
  'src/core/db/global-setup.ts',
  'src/core/db/vitest-setup.ts',
  'src/core/test-no-network.ts',
  'src/core/testing/read-own-source.ts',
]
const { MOVES } = await load(MOVES_REL)

// ---------- reading cards (P3) ----------

const isOpen = (card) => card.status !== 'done' && card.status !== 'parked'
const covers = (card, file) => (card.paths ?? []).some((p) => globToRegExp(p).test(file))

/** A card's text: its own card file, else its family template with the card's params put in. Undefined when none. */
function cardText(world, card) {
  const own = world.card(card.id)
  if (own !== undefined || !card.family) return own
  const template = world.family(card.family)
  if (template === undefined) return undefined
  let text = template
  for (const [k, v] of Object.entries(card.params ?? {})) text = text.split(`{${k}}`).join(String(v))
  return text
}

/** The open cards with their text; an open card with no text is a problem under `rule`, by id. */
function openCards(world, rule) {
  const problems = []
  const cards = []
  for (const card of world.cards.filter(isOpen)) {
    const text = cardText(world, card)
    if (text === undefined) {
      const where = card.family ? `plan/cards/${card.id}.md or family template ${card.family}` : `plan/cards/${card.id}.md`
      problems.push(`${rule} ${card.id}: an open card with no card text (no ${where})`)
    } else cards.push({ card, text })
  }
  return { problems, cards }
}

const FLOOR = 300

/** The floor and sentinels, from every card whatever its status (never only the open ones: a landing trap, A502). */
function floors(world) {
  const problems = []
  const all = world.cards.map((card) => ({ card, text: cardText(world, card) }))
  const n = all.filter((c) => c.text !== undefined).length
  if (n < FLOOR) problems.push(`floor: ${String(n)} cards read, fewer than ${String(FLOOR)}`)
  const family = all.filter((c) => c.card.family && c.text !== undefined && world.card(c.card.id) === undefined)
  if (family.length === 0) problems.push('floor: no family card read through its template')
  const filled = family.filter(({ card }) => Object.keys(card.params ?? {}).some((k) => world.family(card.family).includes(`{${k}}`)))
  if (family.length > 0 && filled.length === 0) problems.push('floor: no family card read with one of its own params put in')
  const sc10 = world.cards.find((c) => c.id === 'SC10')
  const words = sc10 && cardText(world, sc10) !== undefined ? resolveTags(world, sc10, cardText(world, sc10)).words : undefined
  if (!words?.includes('core')) problems.push('sentinel: SC10 is not read with the Tags word core')
  return problems
}

// ---------- R85: the closed Tags line; slices.json core, security and screens equal its words ----------

const TAG_WORDS = ['none', 'core', 'security', 'screens']
const FLAG_WORDS = ['core', 'security', 'screens']

/** Parts of `text` split at commas outside parentheses. */
function splitOutside(text) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts
}

/** True when the parentheses of `text` balance and never close below zero. */
function balances(text) {
  let depth = 0
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')' && --depth < 0) return false
  }
  return depth === 0
}

/** Tokens the way CQ6's mutation gate splits the Tags line (tools/mutate-changed.mjs). */
const gateTokens = (text) => text.toLowerCase().split(/[^a-z0-9-]+/)

/** One card's Tags line read by the closed form: { words } or { as } or { problems } (problems without the card id). */
function readTags(text) {
  const labels = (text.match(/Tags:/g) ?? []).length
  const lines = text.split(/\r?\n/).filter((l) => l.startsWith('Tags: '))
  if (lines.length === 0) return { problems: ['no Tags line (a line that starts with "Tags" and a colon and a space)'] }
  if (labels > 1) return { problems: [`the label "Tags:" appears ${String(labels)} times; a card has exactly one Tags line`] }
  const body = lines[0].slice('Tags: '.length)
  const as = /^as ([A-Z][A-Z0-9]*)\.$/.exec(body)
  if (as) return { as: as[1], problems: [] }
  if (!body.endsWith('.')) return { problems: ['the Tags line does not end with a full stop'] }
  const problems = []
  const words = []
  const reasons = []
  for (const raw of splitOutside(body.slice(0, -1))) {
    const part = raw.trim()
    const m = /^([a-z]+)(?: \((.+)\))?$/s.exec(part)
    if (!m || !TAG_WORDS.includes(m[1]) || (m[2] !== undefined && !balances(m[2]))) {
      problems.push(`the Tags part "${part}" is not one of none, core, security or screens with an optional "(reason)"`)
      continue
    }
    if (words.includes(m[1])) problems.push(`the Tags line says ${m[1]} twice`)
    words.push(m[1])
    if (m[2] !== undefined) reasons.push(m[2])
  }
  if (words.includes('none') && words.length > 1) problems.push('none stands alone on the Tags line')
  if (!words.includes('core') && reasons.some((r) => gateTokens(r).includes('core'))) {
    problems.push('the word core is inside a reason on a card not tagged core (CQ6\'s mutation gate reads it as core)')
  }
  return problems.length > 0 ? { problems } : { words, problems }
}

/** The card's words, following "as <ID>." to the named card. */
function resolveTags(world, card, text, seen = new Set([card.id])) {
  const t = readTags(text)
  if (t.as === undefined) return t
  if (seen.has(t.as)) return { problems: [`the form "as ${t.as}." loops back to ${t.as}`] }
  const parent = world.cards.find((c) => c.id === t.as)
  const parentText = parent ? cardText(world, parent) : undefined
  if (parentText === undefined) return { problems: [`the form "as ${t.as}." names no card with a text in plan/slices.json`] }
  seen.add(t.as)
  const r = resolveTags(world, parent, parentText, seen)
  return r.problems.length > 0 ? { problems: [`the form "as ${t.as}." follows a card whose Tags line is not in the closed form`] } : r
}

function r85(world) {
  const { problems, cards } = openCards(world, 'R85')
  for (const { card, text } of cards) {
    const t = resolveTags(world, card, text)
    if (t.problems.length > 0) {
      problems.push(...t.problems.map((p) => `R85 ${card.id}: ${p}`))
      continue
    }
    for (const word of FLAG_WORDS) {
      const flag = card[word] === true
      const said = t.words.includes(word)
      if (flag !== said) {
        problems.push(`R85 ${card.id}: slices.json ${word} is ${String(flag)} but the Tags line ${said ? 'says' : 'does not say'} ${word}`)
      }
    }
  }
  return problems
}

/**
 * Core, read one way: the slices.json flag or the word core on the closed Tags line. R85 holds the two equal and
 * forbids core inside a non-core card's reason, so CQ6's mutation gate (the flag, or a core token anywhere on the Tags
 * line) reads the same answer.
 */
const isCore = (world, card, text) => card.core === true || (resolveTags(world, card, text).words ?? []).includes('core')

// ---------- R86: harness files in a core card's Paths are listed on its Harness line ----------

const REPO_PATH = /^[\w.-]+(?:\/[\w.-]+)+$/

/** The Harness line read by the closed form: { files, problems } (problems without the card id). */
function readHarness(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.startsWith('Harness:'))
  if (lines.length === 0) return { files: [], problems: [] }
  if (lines.length > 1) return { files: [], problems: [`${String(lines.length)} Harness lines; a card has at most one`] }
  const m = /^Harness: (.+)$/.exec(lines[0])
  const files = m ? m[1].split(', ') : []
  if (!m || files.some((f) => !REPO_PATH.test(f))) {
    return { files: [], problems: ['the Harness line is not "Harness: " then full repo paths separated by a comma and a space'] }
  }
  return { files, problems: [] }
}

function r86(world) {
  if (!Array.isArray(world.harness)) return [`R86: ${HOMES_REL} has no harness list (CQ6 adds it), so nothing can be checked`]
  if (world.harness.length === 0) return [`R86: the harness list in ${HOMES_REL} is empty, so nothing can be checked`]
  const { problems, cards } = openCards(world, 'R86')
  for (const { card, text } of cards) {
    const h = readHarness(text)
    problems.push(...h.problems.map((p) => `R86 ${card.id}: ${p}`))
    for (const file of h.files) {
      if (!world.harness.includes(file)) problems.push(`R86 ${card.id}: the Harness line lists ${file}, which is not on the harness list in ${HOMES_REL}`)
      if (!covers(card, file)) problems.push(`R86 ${card.id}: the Harness line lists ${file}, which is not in the card's Paths`)
    }
    if (!isCore(world, card, text)) continue
    for (const file of world.harness) {
      const entry = (card.paths ?? []).find((p) => globToRegExp(p).test(file))
      if (entry && !h.files.includes(file)) {
        problems.push(`R86 ${card.id}: ${file} is on the harness list and in this core card's Paths (${entry}) but the card's Harness line does not list it`)
      }
    }
  }
  return problems
}

// ---------- R87: CQ4's R82 set holds only expectation-class files and no file the Build section names ----------

const named = (names, file) => names.some((n) => file === n || file.endsWith(`/${n}`))

/** The files R87 asks about for a card: its literal Paths and every path-like name its Spec section gives. */
function r87Candidates(text, card) {
  const literal = (card.paths ?? []).filter((p) => !p.includes('*'))
  const specPaths = sectionNames(text, 'Spec').filter((n) => n.includes('/'))
  return [...new Set([...literal, ...specPaths])]
}

/** `impl` is the module whose `specOwnedFiles` is judged: tools/lib.mjs on the repo, a planted one in the plant tests. */
function r87(world, impl) {
  const { problems, cards } = openCards(world, 'R87')
  for (const { card, text } of cards) {
    const build = sectionNames(text, 'Build')
    for (const file of impl.specOwnedFiles(text, r87Candidates(text, card))) {
      if (!isExpectationFile(file)) problems.push(`R87 ${card.id}: the R82 set holds ${file}, which is not an expectation file`)
      if (named(build, file)) problems.push(`R87 ${card.id}: the R82 set holds ${file}, which the Build section names`)
    }
  }
  return problems
}

const r82Set = (world, impl, id) => {
  const card = world.cards.find((c) => c.id === id)
  const text = cardText(world, card)
  return impl.specOwnedFiles(text, r87Candidates(text, card))
}

// ---------- R89: every guard in MOVES is registered in deps.ts or listed with an owner card ----------

/** TypeScript source with comments removed and every string literal emptied (quotes kept), so neither can register. */
function codeOnly(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (ch === '/' && next === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
    } else if (ch === "'" || ch === '"' || ch === '`') {
      let body = ''
      i++
      while (i < src.length && src[i] !== ch) {
        if (src[i] === '\\') {
          body += src[i]
          i++
        }
        body += src[i]
        i++
      }
      i++
      // A quoted object key ('review_to_rework': ...) keeps its text; any other string is emptied.
      const key = /^\s*:/.test(src.slice(i)) && /^[a-z]+(?:_[a-z]+)*$/.test(body)
      out += `${ch}${key ? body : ''}${ch}`
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** The text between the bracket at `open` and its partner (exclusive), or undefined when it never closes. */
function balanced(text, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' }
  const stack = []
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (pairs[ch]) stack.push(pairs[ch])
    else if (ch === stack[stack.length - 1]) {
      stack.pop()
      if (stack.length === 0) return text.slice(open + 1, i)
    }
  }
  return undefined
}

/** Top-level comma parts of an object or argument body. */
function topLevelParts(body) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of body) {
    if ('({['.includes(ch)) depth++
    else if (')}]'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** The body of the object literal in `const name = { ... }` (a type annotation allowed) in `code`, or undefined. */
function objectOf(code, name) {
  const m = new RegExp(`\\bconst\\s+${name}\\b(?:\\s*:[^=]*)?\\s*=\\s*\\{`).exec(code)
  return m ? balanced(code, m.index + m[0].length - 1) : undefined
}

/** An object literal value: its body when `value` is `{ ... }`, optionally followed by `as` or `satisfies` and a type. */
function literalBody(value) {
  if (!value.startsWith('{')) return undefined
  const body = balanced(value, 0)
  if (body === undefined) return undefined
  const rest = value.slice(body.length + 2).trim()
  return rest === '' || /^(?:as|satisfies)\s+[\w$.<>, [\]|]+$/.test(rest) ? body : undefined
}

const IDENT = /^[A-Za-z_$][\w$]*$/

/** The guard names passed to `createLifecycle` in deps.ts source, and every part R89 cannot read. */
function registeredGuards(depsSource) {
  if (depsSource === undefined) return { guards: [], unreadable: [] }
  const code = codeOnly(depsSource)
  const guards = []
  const unreadable = []
  const keysOf = (body, seen) => {
    for (const part of topLevelParts(body)) {
      const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)$/.exec(part)
      if (spread) {
        const inner = objectOf(code, spread[1])
        if (inner === undefined) unreadable.push(part)
        else if (!seen.has(spread[1])) keysOf(inner, new Set([...seen, spread[1]]))
        continue
      }
      const keyed = /^(['"]?)([A-Za-z_$][\w$]*)\1\s*:/.exec(part)
      if (keyed) guards.push(keyed[2])
      else if (IDENT.test(part)) guards.push(part)
      else unreadable.push(part)
    }
  }
  const imports = /\bimport\b[^;]*?\bfrom\s*['"]['"]/g
  for (const m of code.matchAll(imports)) {
    if (/\bcreateLifecycle\s+as\b/.test(m[0])) unreadable.push(m[0].replace(/\s+/g, ' '))
  }
  const rest = code.replace(imports, '')
  const calls = [...rest.matchAll(/\bcreateLifecycle\s*(?:<[^>()]*>)?\s*\(/g)]
  const mentions = [...rest.matchAll(/\bcreateLifecycle\b/g)].length
  if (mentions !== calls.length) unreadable.push('createLifecycle used other than in an import or a direct call')
  for (const m of calls) {
    const args = balanced(rest, m.index + m[0].length - 1)
    const first = args === undefined ? undefined : topLevelParts(args)[0]
    const opts = first === undefined ? undefined : literalBody(first)
    if (opts === undefined) {
      unreadable.push(`createLifecycle(${String(first ?? '')})`)
      continue
    }
    for (const part of topLevelParts(opts)) {
      const option = /^(['"]?)guards\1\s*:\s*([\s\S]*)$/.exec(part)
      if (option) {
        const value = option[2].trim()
        const body = literalBody(value) ?? (IDENT.test(value) ? objectOf(code, value) : undefined)
        if (body === undefined) unreadable.push(part)
        else keysOf(body, new Set(IDENT.test(value) ? [value] : []))
      } else if (part === 'guards') {
        const body = objectOf(code, 'guards')
        if (body === undefined) unreadable.push(part)
        else keysOf(body, new Set(['guards']))
      } else if (part.startsWith('...') || part.startsWith('[')) unreadable.push(part)
    }
  }
  return { guards: [...new Set(guards)], unreadable }
}

const PHASE_GATE = 4

/**
 * R89 over a world: `moves` (the imported MOVES), `deps` (deps.ts source or undefined), `list` (the parsed
 * unbuilt-guards.json) and `cards`.
 */
function r89(world) {
  const problems = []
  const guards = Array.isArray(world.moves) ? world.moves.map((m) => m?.guard) : []
  if (guards.length === 0 || guards.some((g) => typeof g !== 'string')) return [`R89: the imported MOVES of ${MOVES_REL} gives no guard names`]
  const reg = registeredGuards(world.deps)
  problems.push(...reg.unreadable.map((p) => `R89 ${DEPS_REL} passes guards R89 cannot read: ${p}`))
  const registered = new Set(reg.guards)
  const entries = Array.isArray(world.list?.guards) ? world.list.guards : undefined
  if (!entries) return [...problems, `R89: ${LIST_REL} has no "guards" list`]
  const byId = new Map(world.cards.map((c) => [c.id, c]))
  const listed = new Map()
  entries.forEach((e, i) => {
    const keys = Object.keys(e ?? {}).sort().join(',')
    if (keys !== 'guard,owner' || typeof e.guard !== 'string' || typeof e.owner !== 'string') {
      problems.push(`R89 ${LIST_REL} entry ${String(i)}: each entry is exactly { guard, owner } with two strings`)
      return
    }
    if (listed.has(e.guard)) problems.push(`R89 guard ${e.guard}: listed twice in ${LIST_REL}`)
    listed.set(e.guard, e.owner)
  })
  for (const guard of guards) {
    if (!registered.has(guard) && !listed.has(guard)) {
      problems.push(`R89 guard ${guard}: in MOVES but neither registered in ${DEPS_REL} nor listed in ${LIST_REL}`)
    }
  }
  for (const [guard, owner] of listed) {
    if (!guards.includes(guard)) {
      problems.push(`R89 guard ${guard}: listed in ${LIST_REL} but not a guard in MOVES`)
      continue
    }
    if (registered.has(guard)) problems.push(`R89 guard ${guard}: listed in ${LIST_REL} but already registered in ${DEPS_REL} (stale; remove the entry)`)
    const card = byId.get(owner)
    if (!card) {
      problems.push(`R89 guard ${guard}: owner ${owner} is not a card in plan/slices.json`)
      continue
    }
    if (registered.has(guard)) continue
    if (card.status === 'parked') problems.push(`R89 guard ${guard}: owner ${owner} is parked, so it can never register the guard`)
    if (card.status === 'done') problems.push(`R89 guard ${guard}: owner ${owner} is done but the guard is still not registered`)
    if (!covers(card, DEPS_REL)) problems.push(`R89 guard ${guard}: owner ${owner} does not list ${DEPS_REL} in its Paths, so it can never register the guard`)
    if (!covers(card, LIST_REL)) problems.push(`R89 guard ${guard}: owner ${owner} does not list ${LIST_REL} in its Paths, so it can never remove its row`)
  }
  for (const card of world.cards.filter(isOpen)) {
    if (covers(card, MOVES_REL) && !covers(card, LIST_REL)) {
      problems.push(`R89 ${card.id}: its Paths cover ${MOVES_REL} but do not list ${LIST_REL}, so a move it adds can never be listed`)
    }
  }
  const gate = world.cards.filter((c) => typeof c.phase === 'number' && c.phase <= PHASE_GATE)
  if (gate.length > 0 && gate.every((c) => !isOpen(c)) && listed.size > 0) {
    problems.push(`R89: ${LIST_REL} must be empty at the phase ${String(PHASE_GATE)} gate but lists ${[...listed.keys()].join(', ')}`)
  }
  return problems
}

// ---------- KNOWN: lands empty (A502); its shape check still guards any future entry ----------

const KNOWN_KEYS = ['owner', 'problems', 'rule', 'subject']
const KNOWN = []
const RULES = ['R85', 'R86', 'R87', 'R89']

/** KNOWN's shape: exact keys, a rule of this file, literal problems naming the subject, an open owner holding this file. */
function knownShape(known, cards) {
  const problems = []
  const byId = new Map(cards.map((c) => [c.id, c]))
  const seen = new Set()
  known.forEach((k, i) => {
    const at = `KNOWN[${String(i)}] ${String(k?.rule)} ${String(k?.subject)}`
    const keys = Object.keys(k ?? {}).sort()
    if (keys.join(',') !== KNOWN_KEYS.join(',')) problems.push(`${at}: the keys are not exactly ${KNOWN_KEYS.join(', ')}`)
    if (!RULES.includes(k?.rule)) problems.push(`${at}: the rule is not one of ${RULES.join(', ')}`)
    const owner = byId.get(k?.owner)
    if (!owner) problems.push(`${at}: the owner ${String(k?.owner)} is not a card in plan/slices.json`)
    else {
      if (!isOpen(owner)) problems.push(`${at}: the owner ${owner.id} is ${String(owner.status)}, so it can never clear the entry`)
      if (!covers(owner, SELF_REL)) problems.push(`${at}: the owner ${owner.id} does not list ${SELF_REL} in its Paths, so it can never remove the entry`)
    }
    if (!Array.isArray(k?.problems) || k.problems.length === 0) problems.push(`${at}: no problem strings`)
    for (const p of Array.isArray(k?.problems) ? k.problems : []) {
      if (typeof p !== 'string') problems.push(`${at}: a problem that is not a literal string (${String(p)})`)
      else {
        if (!p.startsWith(`${k.rule} `) || !p.includes(String(k.subject))) problems.push(`${at}: the problem ${JSON.stringify(p)} is not this entry's rule and subject`)
        if (seen.has(p)) problems.push(`${at}: the problem ${JSON.stringify(p)} is listed twice`)
        seen.add(p)
      }
    }
  })
  return problems
}

function onlyKnown(rule, problems, known = KNOWN) {
  const mine = known.filter((k) => k.rule === rule)
  const excused = new Set(mine.flatMap((k) => k.problems))
  return [
    ...problems.filter((p) => !excused.has(p)),
    ...mine.flatMap((k) =>
      k.problems.filter((p) => !problems.includes(p)).map((p) => `stale KNOWN entry ${k.rule} ${k.subject} (owner ${k.owner}): ${JSON.stringify(p)} no longer fails; remove it`),
    ),
  ]
}

// ---------- worlds ----------

function liveWorld() {
  const cards = JSON.parse(read('plan/slices.json')).cards
  const homes = JSON.parse(read(HOMES_REL))
  return {
    cards,
    card: (id) => (exists(`plan/cards/${id}.md`) ? read(`plan/cards/${id}.md`) : undefined),
    family: (name) => (exists(`plan/cards/families/${name}.md`) ? read(`plan/cards/families/${name}.md`) : undefined),
    harness: homes.harness,
    moves: MOVES,
    deps: exists(DEPS_REL) ? read(DEPS_REL) : undefined,
    list: JSON.parse(read(LIST_REL)),
  }
}

/** The live world with some statuses pinned: `set(card)` gives the status a card takes (undefined keeps its own). */
function withStatuses(world, set) {
  return { ...world, cards: world.cards.map((c) => ({ ...c, status: set(c) ?? c.status })) }
}

/** A pinned world: small typed card entries and card texts by id, never live statuses (ARC-16). */
function pinnedWorld(opts) {
  const { cards, texts = {}, families = {}, moves = MOVES, deps, list } = opts
  const harness = 'harness' in opts ? opts.harness : PINNED_HARNESS
  return { cards, card: (id) => texts[id], family: (name) => families[name], harness, moves, deps, list }
}

const entry = (id, extra = {}) => ({ id, status: 'carded', phase: 1, deps: [], paths: [], ...extra })

// ---------- reading cards (P3) ----------

describe('SC10 floors and sentinels come from every card; the rules judge open cards only (A502 P3)', () => {
  test('ARC-16 the floor and the SC10 sentinel hold on main from every card, whatever its status', () => {
    const w = liveWorld()
    expect(w.cards.length).toBeGreaterThan(0)
    expect(floors(w)).toEqual([])
  })
  test('ARC-16 plant: pinned statuses with SC10 done pass every rule, the floor and the sentinel', () => {
    const w = withStatuses(liveWorld(), (c) => (c.id === 'SC10' ? 'done' : undefined))
    expect(w.cards.find((c) => c.id === 'SC10').status).toBe('done')
    expect(floors(w)).toEqual([])
    expect(r85(w)).toEqual([])
    expect(r86(w)).toEqual([])
    expect(r87(w, { specOwnedFiles })).toEqual([])
    expect(r89(w)).toEqual([])
  })
  test('ARC-16 plant: every card set done still meets the floor and the sentinel, and R85 to R87 judge nothing', () => {
    const w = withStatuses(liveWorld(), () => 'done')
    expect(floors(w)).toEqual([])
    expect(r85(w)).toEqual([])
    expect(r86(w)).toEqual([])
    expect(r87(w, { specOwnedFiles })).toEqual([])
  })
  test('ARC-16 plant: a pinned open card with no file fails by id under R85, R86 and R87; done or parked it is skipped', () => {
    const cards = [entry('Z1 (Test)', { core: true }), entry('Z2 (Test)', { status: 'done' }), entry('Z3 (Test)', { status: 'parked' }), entry('K9 (Test)', { family: 'gone (Test)' })]
    const w = pinnedWorld({ cards })
    const why = {
      'Z1 (Test)': 'an open card with no card text (no plan/cards/Z1 (Test).md)',
      'K9 (Test)': 'an open card with no card text (no plan/cards/K9 (Test).md or family template gone (Test))',
    }
    expect(r85(w)).toEqual([`R85 Z1 (Test): ${why['Z1 (Test)']}`, `R85 K9 (Test): ${why['K9 (Test)']}`])
    expect(r86(w)).toEqual([`R86 Z1 (Test): ${why['Z1 (Test)']}`, `R86 K9 (Test): ${why['K9 (Test)']}`])
    expect(r87(w, { specOwnedFiles })).toEqual([`R87 Z1 (Test): ${why['Z1 (Test)']}`, `R87 K9 (Test): ${why['K9 (Test)']}`])
  })
  test('ARC-16 plant: a floor short of cards, no family card and SC10 without core each fail by name', () => {
    const w = pinnedWorld({ cards: [entry('SC10', { status: 'done' })], texts: { SC10: 'Tags: none.\n' } })
    expect(floors(w)).toEqual([
      'floor: 1 cards read, fewer than 300',
      'floor: no family card read through its template',
      'sentinel: SC10 is not read with the Tags word core',
    ])
    const unfilled = pinnedWorld({ cards: [entry('K1', { family: 'kind', params: { kind: 'K1' } })], families: { kind: 'Tags: none.\n{other}\n' } })
    expect(floors(unfilled)).toContain('floor: no family card read with one of its own params put in')
    const filledIn = pinnedWorld({ cards: [entry('K1', { family: 'kind', params: { kind: 'K1' } })], families: { kind: 'Tags: none.\n{kind}\n' } })
    expect(floors(filledIn)).not.toContain('floor: no family card read with one of its own params put in')
  })
})

// ---------- R85 ----------

describe('SC10 R85 the Tags line in its closed form; slices.json flags equal its words (A430, A502 P4)', () => {
  const b04 = fix('B04.md')
  test('ARC-15 R85 plant: B04 tagged "security, core" with core false in slices.json fails naming B04 and core', () => {
    const world = pinnedWorld({ cards: [entry('B04', { core: false, security: true })], texts: { B04: b04 } })
    expect(r85(world)).toEqual(['R85 B04: slices.json core is false but the Tags line says core'])
  })
  test('ARC-15 R85 B04\'s line passes with core and security true; security dropped fails naming security', () => {
    expect(r85(pinnedWorld({ cards: [entry('B04', { core: true, security: true })], texts: { B04: b04 } }))).toEqual([])
    expect(r85(pinnedWorld({ cards: [entry('B04', { core: true })], texts: { B04: b04 } }))).toEqual([
      'R85 B04: slices.json security is false but the Tags line says security',
    ])
  })
  test('ARC-15 R85 plant: F03R\'s one-line form (Tags inside the Phase line) fails as no Tags line', () => {
    const f03r =
      '# F03R (Test)\n\nPhase 0. Size S. Tags: core. Deps: F03 (landed a89d508). Paths: `src/contracts/taxprep.ts`, `src/contracts/taxprep.test.ts`, `src/contracts/taxprep.acceptance.test.ts`, `src/contracts/__golden__/**`. Clauses: RT-3, RT-9, RT-13, RT-21.\n'
    expect(r85(pinnedWorld({ cards: [entry('F03R', { core: true })], texts: { F03R: f03r } }))).toEqual([
      'R85 F03R: no Tags line (a line that starts with "Tags" and a colon and a space)',
    ])
    expect(r85(pinnedWorld({ cards: [entry('F03R')], texts: { F03R: f03r } }))).toEqual([
      'R85 F03R: no Tags line (a line that starts with "Tags" and a colon and a space)',
    ])
  })
  test('ARC-15 R85 plant: SK0 with no Tags line (as before A502) fails; a family template with no Tags line fails each of its cards', () => {
    expect(r85(pinnedWorld({ cards: [entry('SK0', { phase: 0 })], texts: { SK0: fix('SK0-before-A502.md') } }))).toEqual([
      'R85 SK0: no Tags line (a line that starts with "Tags" and a colon and a space)',
    ])
    const cards = [entry('W01', { family: 'kind', params: { kind: 'W01' } }), entry('W02', { family: 'kind', params: { kind: 'W02' } })]
    expect(r85(pinnedWorld({ cards, families: { kind: fix('kind-before-A502.md') } }))).toEqual([
      'R85 W01: no Tags line (a line that starts with "Tags" and a colon and a space)',
      'R85 W02: no Tags line (a line that starts with "Tags" and a colon and a space)',
    ])
  })
  test('ARC-15 R85 plant: A04C\'s and SC3\'s Tags lines before A502 fail; their lines after A502 pass', () => {
    const a04cBefore = 'Tags: none (tests of A04\'s runner; reviewed as core by directive: an Opus check).\n'
    const sc3Before = 'Tags: security; reviewed as core by directive (A461) (stand-ins in production, once-only and at-most-N rules, append-only text).\n'
    const before = pinnedWorld({ cards: [entry('A04C', { core: false }), entry('SC3', { security: true })], texts: { A04C: a04cBefore, SC3: sc3Before } })
    expect(r85(before)).toEqual([
      "R85 A04C: the word core is inside a reason on a card not tagged core (CQ6's mutation gate reads it as core)",
      'R85 SC3: the Tags part "security; reviewed as core by directive (A461) (stand-ins in production, once-only and at-most-N rules, append-only text)" is not one of none, core, security or screens with an optional "(reason)"',
    ])
    const after = pinnedWorld({
      cards: [entry('A04C', { core: false }), entry('SC3', { security: true })],
      texts: {
        A04C: "Tags: none (tests of A04's runner; an Opus check by directive).\n",
        SC3: 'Tags: security (stand-ins in production, once-only and at-most-N rules, append-only text; an Opus check by directive, A461).\n',
      },
    })
    expect(r85(after)).toEqual([])
  })
  test('ARC-15 R85 plant: core inside a non-core card\'s reason fails; the same reason on a core card passes', () => {
    const text = 'Tags: none (the rules keep core money and security checks honest).\n'
    expect(r85(pinnedWorld({ cards: [entry('A1 (Test)')], texts: { 'A1 (Test)': text } }))).toEqual([
      "R85 A1 (Test): the word core is inside a reason on a card not tagged core (CQ6's mutation gate reads it as core)",
    ])
    const onCore = 'Tags: security (keeps core money safe), core (money).\n'
    expect(r85(pinnedWorld({ cards: [entry('A2 (Test)', { core: true, security: true })], texts: { 'A2 (Test)': onCore } }))).toEqual([])
  })
  test.each([
    ['a second Tags label in prose', 'Tags: none.\n\nThe old **Tags:** line said core.\n', 'the label "Tags:" appears 2 times; a card has exactly one Tags line'],
    ['two Tags lines', 'Tags: none.\nTags: core.\n', 'the label "Tags:" appears 2 times; a card has exactly one Tags line'],
    ['no space after the colon', 'Tags:none.\n', 'no Tags line (a line that starts with "Tags" and a colon and a space)'],
    ['no closing full stop', 'Tags: none\n', 'the Tags line does not end with a full stop'],
    ['a semicolon list', 'Tags: security; core.\n', 'the Tags part "security; core" is not one of none, core, security or screens with an optional "(reason)"'],
    ['a word outside the four', 'Tags: money.\n', 'the Tags part "money" is not one of none, core, security or screens with an optional "(reason)"'],
    ['a capital word', 'Tags: Core.\n', 'the Tags part "Core" is not one of none, core, security or screens with an optional "(reason)"'],
    ['text after the reason', 'Tags: security (a) by directive.\n', 'the Tags part "security (a) by directive" is not one of none, core, security or screens with an optional "(reason)"'],
    ['an empty part', 'Tags: security, .\n', 'the Tags part "" is not one of none, core, security or screens with an optional "(reason)"'],
    ['none with another word', 'Tags: none, security.\n', 'none stands alone on the Tags line'],
    ['a word twice', 'Tags: security (a), security (b).\n', 'the Tags line says security twice'],
    ['as with no full stop', 'Tags: as B04\n', 'the Tags line does not end with a full stop'],
    ['as naming no card', 'Tags: as Z99.\n', 'the form "as Z99." names no card with a text in plan/slices.json'],
  ])('ARC-15 R85 plant: %s fails by name', (_name, text, problem) => {
    const w = pinnedWorld({ cards: [entry('X1 (Test)', { security: true }), entry('B04', { core: true, security: true })], texts: { 'X1 (Test)': text, B04: b04 } })
    expect(r85(w)).toContain(`R85 X1 (Test): ${problem}`)
  })
  test('ARC-15 R85 nested parentheses, screens and commas inside a reason are read by the form', () => {
    const cards = [entry('N1 (Test)', { security: true, screens: true })]
    const texts = { 'N1 (Test)': 'Tags: security (stand-ins, (nested) text, A461), screens.\n' }
    expect(r85(pinnedWorld({ cards, texts }))).toEqual([])
    expect(r85(pinnedWorld({ cards: [entry('N1 (Test)', { security: true })], texts }))).toEqual([
      'R85 N1 (Test): slices.json screens is false but the Tags line says screens',
    ])
  })
  test('ARC-15 R85 "Tags: as <ID>." takes the named card\'s words; a loop fails; a family card reads its template; done and parked cards are skipped', () => {
    const texts = { P1: 'Tags: core (money).\n', P2: 'Tags: as P1.\n', P3: 'Tags: security.\n', P4: 'Tags: as P5.\n', P5: 'Tags: as P4.\n', P6: 'Tags core.\n' }
    const cards = [
      entry('P1', { core: true }),
      entry('P2', { core: true }),
      entry('P3', { status: 'parked' }),
      entry('P6', { status: 'done' }),
      entry('K1', { family: 'kind', params: { kind: 'K1' } }),
    ]
    expect(r85(pinnedWorld({ cards, texts, families: { kind: '# Family: kind {kind}\nTags: none.\n' } }))).toEqual([])
    expect(r85(pinnedWorld({ cards: [entry('P1', { core: true }), entry('P2')], texts }))).toEqual(['R85 P2: slices.json core is false but the Tags line says core'])
    expect(r85(pinnedWorld({ cards: [entry('P4'), entry('P5', { status: 'done' })], texts }))).toEqual(['R85 P4: the form "as P5." follows a card whose Tags line is not in the closed form'])
    const famCore = pinnedWorld({ cards: [cards[4]], families: { kind: 'Tags: core ({kind} money).\n' } })
    expect(r85(famCore)).toEqual(['R85 K1: slices.json core is false but the Tags line says core'])
  })
  test('ARC-15 R85 on every open card in plan/slices.json (family templates with their params): no problem', () => {
    const w = liveWorld()
    expect(w.cards.filter(isOpen).length).toBeGreaterThan(0)
    expect(onlyKnown('R85', r85(w))).toEqual([])
  })
})

// ---------- R86 ----------

describe('SC10 R86 harness files in a core card\'s Paths are listed on its Harness line (DB16 findings RC1, A502 P5)', () => {
  const db16 = fix('DB16-first-carded.md')
  const db16Entry = (extra = {}) =>
    entry('DB16', {
      phase: 0,
      core: true,
      security: true,
      paths: ['src/core/db/global-setup.ts', 'src/core/db/index.ts', 'src/core/db/pg16.test.ts', 'vitest.config.ts', 'package.json'],
      ...extra,
    })
  const missing = (id, file, entryText = file) =>
    `R86 ${id}: ${file} is on the harness list and in this core card's Paths (${entryText}) but the card's Harness line does not list it`
  const fx7Paths = [
    'src/contracts/facts.ts',
    'src/contracts/reading.ts',
    'src/contracts/amount-grammar.ts',
    'src/modules/ocr/textlayer/**',
    'src/modules/storage/**',
    'src/core/test-no-network.ts',
    'src/contracts/auth.ts',
    'tools/test/__fixtures__/planted-interpolated-log.ts.txt',
    'tools/test/__fixtures__/schema-contract/known.json',
    'src/core/safe-read.ts',
    'tools/test/schema-contract-rules.test.mjs',
  ]
  const fx7 = (text) => pinnedWorld({ cards: [entry('FX7', { phase: 0, core: true, paths: fx7Paths })], texts: { FX7: text } })
  test('ARC-15 R86 plant: DB16 as first carded (core, global-setup.ts and index.ts in Paths) fails naming both files', () => {
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: db16 } }))).toEqual([
      missing('DB16', 'src/core/db/index.ts'),
      missing('DB16', 'src/core/db/global-setup.ts'),
    ])
  })
  test('ARC-15 R86 plant: DB16.md line 33\'s base names ("index.ts and global-setup.ts stay unmarked harness") never name a file', () => {
    const line33 = `${db16}\nA checker who did neither: target.ts marked, 100 per file; index.ts and global-setup.ts stay unmarked harness; /security-review before boarding.\n`
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: line33 } }))).toEqual([
      missing('DB16', 'src/core/db/index.ts'),
      missing('DB16', 'src/core/db/global-setup.ts'),
    ])
  })
  test('ARC-15 R86 plant: full paths and the word harness in prose never count; only the Harness line does', () => {
    const prose = `${db16}\n- src/core/db/index.ts and src/core/db/global-setup.ts stay unmarked harness.\n`
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: prose } }))).toEqual([
      missing('DB16', 'src/core/db/index.ts'),
      missing('DB16', 'src/core/db/global-setup.ts'),
    ])
    const line = db16.replace(/^(Paths: .*)$/m, '$1\nHarness: src/core/db/global-setup.ts, src/core/db/index.ts')
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: line } }))).toEqual([])
    const asOnMain = db16.replace(/^Tags:.*$/m, 'Tags: security (the switch refuses any live or non-local database).')
    expect(r86(pinnedWorld({ cards: [db16Entry({ core: false })], texts: { DB16: asOnMain } }))).toEqual([])
  })
  test('ARC-15 R86 plant: FX7 as before A502 (the file in Paths and in its Paths line, no Harness line) fails; with a prose line naming it as harness it still fails', () => {
    const before = fix('FX7-before-A502.md')
    expect(r86(fx7(before))).toEqual([missing('FX7', 'src/core/test-no-network.ts')])
    const named = `${before}\nsrc/core/test-no-network.ts is harness: FX7 edits it and it stays unmarked.\n`
    expect(r86(fx7(named))).toEqual([missing('FX7', 'src/core/test-no-network.ts')])
  })
  test('ARC-15 R86 FX7 as after A502 (its Harness line) passes', () => {
    expect(r86(fx7(fix('FX7-after-A502.md')))).toEqual([])
  })
  test('ARC-15 R86 plant: a card quoting R86\'s own failure message names no harness', () => {
    const quote = `${fix('FX7-before-A502.md')}\nThe card rules said: "${missing('FX7', 'src/core/test-no-network.ts')}".\n`
    expect(r86(fx7(quote))).toEqual([missing('FX7', 'src/core/test-no-network.ts')])
  })
  test('ARC-15 R86 plant: a Harness line listing a file outside Paths or off the harness list fails, on any open card', () => {
    const after = fix('FX7-after-A502.md')
    const outside = after.replace('Harness: src/core/test-no-network.ts', 'Harness: src/core/test-no-network.ts, src/core/db/index.ts')
    expect(r86(fx7(outside))).toEqual(["R86 FX7: the Harness line lists src/core/db/index.ts, which is not in the card's Paths"])
    const off = after.replace('Harness: src/core/test-no-network.ts', 'Harness: src/core/test-no-network.ts, src/contracts/facts.ts')
    expect(r86(fx7(off))).toEqual(['R86 FX7: the Harness line lists src/contracts/facts.ts, which is not on the harness list in tools/test-homes.json'])
    const nonCore = pinnedWorld({ cards: [entry('N2 (Test)', { paths: ['src/core/db/**'] })], texts: { 'N2 (Test)': 'Tags: none.\nHarness: src/core/clock.ts\n' } })
    expect(r86(nonCore)).toEqual([
      'R86 N2 (Test): the Harness line lists src/core/clock.ts, which is not on the harness list in tools/test-homes.json',
      "R86 N2 (Test): the Harness line lists src/core/clock.ts, which is not in the card's Paths",
    ])
  })
  test.each([
    ['base names', 'Harness: index.ts, global-setup.ts'],
    ['a glob', 'Harness: src/core/db/**'],
    ['and instead of a comma', 'Harness: src/core/db/index.ts and src/core/db/global-setup.ts'],
    ['a comma with no space', 'Harness: src/core/db/index.ts,src/core/db/global-setup.ts'],
    ['backticks', 'Harness: `src/core/db/index.ts`, `src/core/db/global-setup.ts`'],
    ['no space after the colon', 'Harness:src/core/db/index.ts, src/core/db/global-setup.ts'],
    ['a trailing note', 'Harness: src/core/db/index.ts, src/core/db/global-setup.ts (A464)'],
  ])('ARC-15 R86 plant: a Harness line with %s is not the form and lists nothing', (_name, line) => {
    const text = db16.replace(/^(Paths: .*)$/m, `$1\n${line}`)
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: text } }))).toEqual([
      'R86 DB16: the Harness line is not "Harness: " then full repo paths separated by a comma and a space',
      missing('DB16', 'src/core/db/index.ts'),
      missing('DB16', 'src/core/db/global-setup.ts'),
    ])
  })
  test('ARC-15 R86 plant: two Harness lines fail; a glob in Paths counts; core from the Tags line alone counts', () => {
    const two = db16.replace(/^(Paths: .*)$/m, '$1\nHarness: src/core/db/index.ts\nHarness: src/core/db/global-setup.ts')
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: two } }))).toEqual([
      'R86 DB16: 2 Harness lines; a card has at most one',
      missing('DB16', 'src/core/db/index.ts'),
      missing('DB16', 'src/core/db/global-setup.ts'),
    ])
    const cards = [entry('G1 (Test)', { paths: ['src/core/db/**'] })]
    const texts = { 'G1 (Test)': 'Tags: security, core (money).\n\nindex.ts is harness.\n' }
    expect(r86(pinnedWorld({ cards, texts, harness: ['src/core/db/index.ts'] }))).toEqual([missing('G1 (Test)', 'src/core/db/index.ts', 'src/core/db/**')])
  })
  test('ARC-15 R86 a missing or empty harness list fails, never passes with nothing checked', () => {
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: db16 }, harness: undefined }))).toEqual([
      'R86: tools/test-homes.json has no harness list (CQ6 adds it), so nothing can be checked',
    ])
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: db16 }, harness: [] }))).toEqual([
      'R86: the harness list in tools/test-homes.json is empty, so nothing can be checked',
    ])
  })
  test('ARC-15 R86 on every open card in plan/slices.json with CQ6\'s harness list: no problem', () => {
    const w = liveWorld()
    expect(w.harness.length).toBeGreaterThan(0)
    expect(onlyKnown('R86', r86(w))).toEqual([])
  })
})

// ---------- R87 ----------

describe('SC10 R87 the R82 set from tools/lib.mjs holds only expectation files the Build does not name (CQ4 findings, A502 P7)', () => {
  const lib = { specOwnedFiles }
  const plantWorld = () =>
    pinnedWorld({
      cards: [
        entry('CQ4', { phase: 0, paths: ['tools/scope.mjs', 'tools/lib.mjs', 'tools/test/scope-spec-files.test.mjs'] }),
        entry('FX2', {
          phase: 0,
          paths: ['src/core/env.ts', 'src/modules/ocr/index.ts', 'src/modules/ocr/engine-setting.test.ts', 'src/modules/storage/engine-setting.test.ts'],
        }),
        entry('FX8', {
          phase: 0,
          paths: ['reference/sample-clients/clients/c07_08.mjs', 'reference/sample-clients/verify.mjs', 'reference/sample-clients/README.md', 'tools/test/sample-names.test.mjs'],
        }),
      ],
      texts: { CQ4: fix('CQ4.md'), FX2: fix('FX2.md'), FX8: fix('FX8.md') },
    })
  test('ARC-15 R87 plant: an R82 set with no class and no Build check yields scope.mjs for CQ4 and env.ts for FX2, and is caught', async () => {
    const naive = await load(`${FIX_REL}/naive-spec-owned.mjs`)
    expect(r87(plantWorld(), naive)).toEqual([
      'R87 CQ4: the R82 set holds tools/scope.mjs, which is not an expectation file',
      'R87 CQ4: the R82 set holds tools/scope.mjs, which the Build section names',
      'R87 FX2: the R82 set holds src/core/env.ts, which is not an expectation file',
      'R87 FX2: the R82 set holds src/core/env.ts, which the Build section names',
    ])
  })
  test('ARC-15 R87 tools/lib.mjs on CQ4.md and FX2.md as on main yields neither scope.mjs nor env.ts; FX8.md still yields verify.mjs', () => {
    const world = plantWorld()
    expect(r87(world, lib)).toEqual([])
    expect(r82Set(world, lib, 'CQ4')).not.toContain('tools/scope.mjs')
    expect(r82Set(world, lib, 'FX2')).not.toContain('src/core/env.ts')
    expect(r82Set(world, lib, 'FX8')).toContain('reference/sample-clients/verify.mjs')
  })
  test('ARC-15 R87 plant: an always-empty R82 set passes the rule but loses FX8\'s verify.mjs, so the sentinel catches it', async () => {
    const empty = await load(`${FIX_REL}/empty-spec-owned.mjs`)
    const world = plantWorld()
    expect(r87(world, empty)).toEqual([])
    expect(r82Set(world, empty, 'FX8')).not.toContain('reference/sample-clients/verify.mjs')
  })
  test('ARC-15 R87 plant: the naive set with CQ4 set done judges only the open FX2', async () => {
    const naive = await load(`${FIX_REL}/naive-spec-owned.mjs`)
    const w = plantWorld()
    w.cards[0].status = 'done'
    expect(r87(w, naive)).toEqual([
      'R87 FX2: the R82 set holds src/core/env.ts, which is not an expectation file',
      'R87 FX2: the R82 set holds src/core/env.ts, which the Build section names',
    ])
  })
  test('ARC-15 R87 on every open card in plan/slices.json (family templates with their params), after the floor: no problem', () => {
    const world = liveWorld()
    expect(floors(world)).toEqual([])
    expect(onlyKnown('R87', r87(world, lib))).toEqual([])
  })
})

// ---------- R89 ----------

describe('SC10 R89 every guard in MOVES has a registration or an owner card (C1, phase 3 card review b, A502 P6)', () => {
  const owners = [
    ['intake_to_evidence', 'E00'],
    ['evidence_to_gaps', 'E01'],
    ['gaps_to_qa', 'G00'],
    ['gaps_to_build', 'G00'],
    ['qa_to_build', 'Q00'],
    ['build_to_prepare', 'T01'],
    ['prepare_to_trace', 'T12'],
    ['trace_to_respond', 'T12'],
    ['respond_to_review', 'V09'],
    ['review_to_approved', 'T08'],
    ['review_to_rework', 'V04'],
    ['rework_to_review', 'V04'],
    ['approved_to_client_sign', 'T11'],
    ['client_sign_to_ready_to_file', 'T11'],
    ['ready_to_file_to_filed', 'T09'],
    ['filed_to_assessed', 'T13'],
    ['assessed_to_closed', 'T10'],
  ]
  const fullList = () => ({ guards: owners.map(([guard, owner]) => ({ guard, owner })) })
  const ownerCards = () => [...new Set(owners.map(([, o]) => o))].map((id) => entry(id, { phase: 3, paths: [DEPS_REL, LIST_REL] }))
  const world = (extra = {}) => pinnedWorld({ cards: ownerCards(), deps: undefined, list: fullList(), ...extra })
  const cannot = (part) => `R89 src/pipeline/deps.ts passes guards R89 cannot read: ${part}`

  test('FLOW-2 R89 reads the guard names from the imported MOVES, never from the text of moves.ts', () => {
    expect(MOVES.length).toBeGreaterThan(0)
    expect(MOVES.map((m) => m.guard)).toContain('review_to_approved')
    expect(liveWorld().moves).toBe(MOVES)
    expect(r89(world({ moves: [] }))).toEqual(['R89: the imported MOVES of src/modules/lifecycle/moves.ts gives no guard names'])
  })
  test('FLOW-2 R89 plant: MOVES with one extra move whose guard is neither registered nor listed fails naming it', () => {
    const moves = [...MOVES, { from: 'closed', to: 'reopened', guard: 'closed_to_reopened' }]
    expect(r89(world({ moves }))).toEqual([
      'R89 guard closed_to_reopened: in MOVES but neither registered in src/pipeline/deps.ts nor listed in data/lifecycle/unbuilt-guards.json',
    ])
  })
  test('FLOW-2 R89 a missing deps.ts registers none: the full owned list passes; one row dropped fails naming that guard', () => {
    expect(r89(world())).toEqual([])
    const list = fullList()
    list.guards = list.guards.filter((g) => g.guard !== 'review_to_approved')
    expect(r89(world({ list }))).toEqual([
      'R89 guard review_to_approved: in MOVES but neither registered in src/pipeline/deps.ts nor listed in data/lifecycle/unbuilt-guards.json',
    ])
  })
  test('FLOW-2 R89 the deps.ts scan reads literal keys, quoted keys and same-file spreads passed to createLifecycle, never comments or strings', () => {
    expect(registeredGuards(fix('deps-registers.ts.txt'))).toEqual({ guards: ['review_to_approved', 'review_to_rework', 'rework_to_review'], unreadable: [] })
    expect(registeredGuards(undefined)).toEqual({ guards: [], unreadable: [] })
    expect(registeredGuards('export const x = { review_to_approved: g }\n')).toEqual({ guards: [], unreadable: [] })
  })
  test('FLOW-2 R89 the deps.ts scan follows a same-file named object, the guards shorthand and a type argument', () => {
    const namedObj = "import { createLifecycle } from '../modules/lifecycle'\nconst lifecycleGuards: Record<string, Guard> = { prepare_to_trace: a, trace_to_respond }\nexport const l = createLifecycle({ db, guards: lifecycleGuards })\n"
    expect(registeredGuards(namedObj)).toEqual({ guards: ['prepare_to_trace', 'trace_to_respond'], unreadable: [] })
    const shorthand = 'const guards = { review_to_approved: a } satisfies Guards\nexport const l = createLifecycle<Deps>({ guards })\n'
    expect(registeredGuards(shorthand)).toEqual({ guards: ['review_to_approved'], unreadable: [] })
  })
  test.each([
    ['a spread from another file', "import { traceGuards } from './trace'\ncreateLifecycle({ guards: { ...traceGuards, review_to_approved: a } })\n", '...traceGuards'],
    ['a helper call as the guards value', "import { makeGuards } from './guards'\ncreateLifecycle({ guards: makeGuards(deps) })\n", 'guards: makeGuards(deps)'],
    ['a spread of a helper call', 'createLifecycle({ guards: { ...makeGuards(deps) } })\n', '...makeGuards(deps)'],
    ['an imported object as the guards value', "import { allGuards } from './guards'\ncreateLifecycle({ guards: allGuards })\n", 'guards: allGuards'],
    ['a computed key', 'createLifecycle({ guards: { [name]: a } })\n', '[name]: a'],
    ['a method', 'createLifecycle({ guards: { review_to_approved() { return ok } } })\n', 'review_to_approved() { return ok }'],
    ['a spread in the options', 'createLifecycle({ db, ...lifecycleOptions })\n', '...lifecycleOptions'],
    ['options that are not an object literal', 'createLifecycle(lifecycleOptions)\n', 'createLifecycle(lifecycleOptions)'],
    ['an import alias', "import { createLifecycle as make } from '../modules/lifecycle'\nmake({ guards: { review_to_approved: a } })\n", "import { createLifecycle as make } from ''"],
    ['a use other than a call', "import { createLifecycle } from '../modules/lifecycle'\nconst make = createLifecycle\nmake({ guards: { review_to_approved: a } })\n", 'createLifecycle used other than in an import or a direct call'],
  ])('FLOW-2 R89 plant: %s fails naming the part', (_name, deps, part) => {
    expect(r89(world({ deps }))).toContain(cannot(part))
  })
  test('FLOW-2 R89 plant: a spread from another file fails with the message the card gives, and its guards count as unregistered', () => {
    const deps = "import { traceGuards } from './trace'\ncreateLifecycle({ guards: { ...traceGuards } })\n"
    const list = fullList()
    list.guards = list.guards.filter((g) => g.owner !== 'T12')
    const problems = r89(world({ deps, list }))
    expect(problems[0]).toContain('deps.ts passes guards R89 cannot read: ...traceGuards')
    expect(problems).toEqual([
      cannot('...traceGuards'),
      'R89 guard prepare_to_trace: in MOVES but neither registered in src/pipeline/deps.ts nor listed in data/lifecycle/unbuilt-guards.json',
      'R89 guard trace_to_respond: in MOVES but neither registered in src/pipeline/deps.ts nor listed in data/lifecycle/unbuilt-guards.json',
    ])
  })
  test('FLOW-2 R89 plant: T12 registering its two guards by literal keys with its rows deleted, then set done, passes', () => {
    const deps = "import { createLifecycle } from '../modules/lifecycle'\nexport const lifecycle = createLifecycle({ db, clock, guards: { prepare_to_trace: prepareToTrace, trace_to_respond: traceToRespond } })\n"
    const list = fullList()
    list.guards = list.guards.filter((g) => g.owner !== 'T12')
    const cards = ownerCards()
    cards.find((c) => c.id === 'T12').status = 'done'
    expect(r89(world({ deps, list, cards }))).toEqual([])
    expect(r89(world({ deps, cards }))).toEqual([
      'R89 guard prepare_to_trace: listed in data/lifecycle/unbuilt-guards.json but already registered in src/pipeline/deps.ts (stale; remove the entry)',
      'R89 guard trace_to_respond: listed in data/lifecycle/unbuilt-guards.json but already registered in src/pipeline/deps.ts (stale; remove the entry)',
    ])
  })
  test('FLOW-2 R89 plant: an entry whose guard deps.ts also registers fails as stale; the registered guards need no row', () => {
    const deps = fix('deps-registers.ts.txt')
    expect(r89(world({ deps }))).toEqual([
      'R89 guard review_to_approved: listed in data/lifecycle/unbuilt-guards.json but already registered in src/pipeline/deps.ts (stale; remove the entry)',
      'R89 guard review_to_rework: listed in data/lifecycle/unbuilt-guards.json but already registered in src/pipeline/deps.ts (stale; remove the entry)',
      'R89 guard rework_to_review: listed in data/lifecycle/unbuilt-guards.json but already registered in src/pipeline/deps.ts (stale; remove the entry)',
    ])
    const list = fullList()
    list.guards = list.guards.filter((g) => !['review_to_approved', 'review_to_rework', 'rework_to_review'].includes(g.guard))
    expect(r89(world({ deps, list }))).toEqual([])
  })
  test('FLOW-2 R89 plant: an owner that is not a card fails; so do a parked owner, a done owner and an owner without deps.ts in Paths', () => {
    const list = fullList()
    list.guards[0].owner = 'Z99 (Test)'
    expect(r89(world({ list }))).toEqual(['R89 guard intake_to_evidence: owner Z99 (Test) is not a card in plan/slices.json'])
    const cards = ownerCards()
    cards.find((c) => c.id === 'T08').status = 'parked'
    cards.find((c) => c.id === 'T10').status = 'done'
    cards.find((c) => c.id === 'E00').paths = ['src/pipeline/steps/intake.ts', LIST_REL]
    expect(r89(world({ cards }))).toEqual([
      'R89 guard intake_to_evidence: owner E00 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard',
      'R89 guard review_to_approved: owner T08 is parked, so it can never register the guard',
      'R89 guard assessed_to_closed: owner T10 is done but the guard is still not registered',
    ])
  })
  test('FLOW-2 R89 plant: an owner without the list file in Paths, and FX5 (Paths cover moves.ts) without it, fail by name', () => {
    const cards = ownerCards()
    cards.find((c) => c.id === 'G00').paths = [DEPS_REL]
    const fx5 = entry('FX5', { phase: 3, core: true, paths: ['src/contracts/lifecycle.ts', 'src/modules/lifecycle/**', 'tools/test/__fixtures__/schema-contract/known.json'] })
    expect(r89(world({ cards: [...cards, fx5] }))).toEqual([
      'R89 guard gaps_to_qa: owner G00 does not list data/lifecycle/unbuilt-guards.json in its Paths, so it can never remove its row',
      'R89 guard gaps_to_build: owner G00 does not list data/lifecycle/unbuilt-guards.json in its Paths, so it can never remove its row',
      'R89 FX5: its Paths cover src/modules/lifecycle/moves.ts but do not list data/lifecycle/unbuilt-guards.json, so a move it adds can never be listed',
    ])
    const fx5Fixed = { ...fx5, paths: [...fx5.paths, LIST_REL] }
    expect(r89(world({ cards: [...ownerCards(), fx5Fixed] }))).toEqual([])
    expect(r89(world({ cards: [...ownerCards(), { ...fx5, status: 'done' }] }))).toEqual([])
  })
  test('FLOW-2 R89 plant: a row twice, a row for no move and a malformed row each fail by name', () => {
    const list = fullList()
    list.guards.push({ guard: 'gaps_to_qa', owner: 'G00' }, { guard: 'filed_to_closed', owner: 'T09' }, { guard: 'qa_to_build' })
    expect(r89(world({ list }))).toEqual([
      'R89 guard gaps_to_qa: listed twice in data/lifecycle/unbuilt-guards.json',
      'R89 data/lifecycle/unbuilt-guards.json entry 19: each entry is exactly { guard, owner } with two strings',
      'R89 guard filed_to_closed: listed in data/lifecycle/unbuilt-guards.json but not a guard in MOVES',
    ])
  })
  test('FLOW-2 R89 plant: at the phase 4 gate (every card of phases 0 to 4 done or parked) a non-empty list fails', () => {
    const cards = [entry('T13', { phase: 4, status: 'done', paths: [DEPS_REL, LIST_REL] }), entry('X9 (Test)', { phase: 5 })]
    const list = { guards: [{ guard: 'filed_to_assessed', owner: 'T13' }] }
    const deps = `createLifecycle({ guards: { ${owners.filter(([g]) => g !== 'filed_to_assessed').map(([g]) => `${g}: ok`).join(', ')} } })\n`
    expect(r89(world({ cards, list, deps }))).toEqual([
      'R89 guard filed_to_assessed: owner T13 is done but the guard is still not registered',
      'R89: data/lifecycle/unbuilt-guards.json must be empty at the phase 4 gate but lists filed_to_assessed',
    ])
    const allIn = `createLifecycle({ guards: { ${owners.map(([g]) => `${g}: ok`).join(', ')} } })\n`
    expect(r89(world({ cards, list: { guards: [] }, deps: allIn }))).toEqual([])
  })
  test('FLOW-2 R89 the list equals the guards no deps.ts registers, each with the owner the cards name (A438)', () => {
    const w = liveWorld()
    const reg = registeredGuards(w.deps)
    expect(reg.unreadable).toEqual([])
    const unregistered = MOVES.map((m) => m.guard).filter((g) => !reg.guards.includes(g))
    expect(w.list.guards.map((g) => g.guard).sort()).toEqual([...unregistered].sort())
    if (w.deps === undefined) expect(w.list.guards.map((g) => [g.guard, g.owner])).toEqual(owners)
  })
  test('FLOW-2 R89 on main, and with each owner set done in turn, only that owner\'s rows fail', () => {
    const w = liveWorld()
    expect(onlyKnown('R89', r89(w))).toEqual([])
    const ownerIds = [...new Set(w.list.guards.map((g) => g.owner))]
    for (const id of ownerIds) {
      const problems = r89(withStatuses(w, (c) => (c.id === id ? 'done' : undefined)))
      const rows = w.list.guards.filter((g) => g.owner === id).map((g) => `R89 guard ${g.guard}: owner ${id} is done but the guard is still not registered`)
      expect(rows.length).toBeGreaterThan(0)
      expect(problems).toEqual(rows)
    }
  })
})

// ---------- KNOWN ----------

describe('SC10 KNOWN lands empty and any entry is exact, owned and alive (A502 P2)', () => {
  test('ARC-16 KNOWN shape plant: wrong keys, an unknown rule, a non-card owner, a problem for another subject and a repeat are caught', () => {
    const cards = [entry('V10', { paths: [SELF_REL] })]
    const bad = [
      { rule: 'R85', subject: 'V10', owner: 'V10', problems: ['R85 V10: x'], match: 'y' },
      { rule: 'R99', subject: 'V10', owner: 'V10', problems: ['R99 V10: x'] },
      { rule: 'R85', subject: 'V10', owner: 'Z99 (Test)', problems: ['R85 V10: z'] },
      { rule: 'R86', subject: 'FX7', owner: 'V10', problems: ['R86 V10: w'] },
      { rule: 'R85', subject: 'V10', owner: 'V10', problems: ['R85 V10: z'] },
    ]
    expect(knownShape(bad, cards)).toEqual([
      'KNOWN[0] R85 V10: the keys are not exactly owner, problems, rule, subject',
      'KNOWN[1] R99 V10: the rule is not one of R85, R86, R87, R89',
      'KNOWN[2] R85 V10: the owner Z99 (Test) is not a card in plan/slices.json',
      'KNOWN[3] R86 FX7: the problem "R86 V10: w" is not this entry\'s rule and subject',
      'KNOWN[4] R85 V10: the problem "R85 V10: z" is listed twice',
    ])
  })
  test('ARC-16 KNOWN shape plant: FX7 pinned done owning an entry fails; so does an open owner whose Paths lack this file', () => {
    const problem = "R86 FX7: src/core/test-no-network.ts is on the harness list and in this core card's Paths (src/core/test-no-network.ts) but the card does not name it as harness"
    const known = [{ rule: 'R86', subject: 'FX7', owner: 'FX7', problems: [problem] }]
    expect(knownShape(known, [entry('FX7', { status: 'done', paths: [SELF_REL] })])).toEqual([
      'KNOWN[0] R86 FX7: the owner FX7 is done, so it can never clear the entry',
    ])
    expect(knownShape(known, [entry('FX7', { status: 'parked', paths: [SELF_REL] })])).toEqual([
      'KNOWN[0] R86 FX7: the owner FX7 is parked, so it can never clear the entry',
    ])
    expect(knownShape(known, [entry('FX7', { paths: ['src/core/test-no-network.ts'] })])).toEqual([
      'KNOWN[0] R86 FX7: the owner FX7 does not list tools/test/card-rules.test.mjs in its Paths, so it can never remove the entry',
    ])
    expect(knownShape(known, [entry('FX7', { paths: ['tools/test/**'] })])).toEqual([])
  })
  test('ARC-16 KNOWN shape plant: the six entries as at 73fe6af4 fail, each owner lacking this file in its Paths', () => {
    const r89Row = (guard, owner) => ({
      rule: 'R89',
      subject: guard,
      owner,
      problems: [`R89 guard ${guard}: owner ${owner} does not list src/pipeline/deps.ts in its Paths, so it can never register the guard`],
    })
    const six = [
      {
        rule: 'R86',
        subject: 'FX7',
        owner: 'FX7',
        problems: ["R86 FX7: src/core/test-no-network.ts is on the harness list and in this core card's Paths (src/core/test-no-network.ts) but the card does not name it as harness"],
      },
      r89Row('intake_to_evidence', 'E00'),
      r89Row('evidence_to_gaps', 'E01'),
      r89Row('gaps_to_qa', 'G00'),
      r89Row('gaps_to_build', 'G00'),
      r89Row('qa_to_build', 'Q00'),
    ]
    const cards = [
      entry('FX7', { phase: 0, core: true, paths: ['src/core/test-no-network.ts', 'src/contracts/facts.ts'] }),
      ...['E00', 'E01', 'G00', 'Q00'].map((id) => entry(id, { paths: [DEPS_REL, LIST_REL] })),
    ]
    const shape = knownShape(six, cards)
    expect(shape).toEqual(six.map((k, i) => `KNOWN[${String(i)}] ${k.rule} ${k.subject}: the owner ${k.owner} does not list tools/test/card-rules.test.mjs in its Paths, so it can never remove the entry`))
  })
  test('ARC-16 a KNOWN entry that no longer fails is stale and fails by name', () => {
    const known = [{ rule: 'R85', subject: 'V10', owner: 'V10', problems: ['R85 V10: slices.json core is true but the Tags line does not say core'] }]
    expect(onlyKnown('R85', [], known)).toEqual([
      'stale KNOWN entry R85 V10 (owner V10): "R85 V10: slices.json core is true but the Tags line does not say core" no longer fails; remove it',
    ])
  })
  test('ARC-16 KNOWN lands empty and its shape holds against plan/slices.json', () => {
    expect(KNOWN).toEqual([])
    expect(knownShape(KNOWN, JSON.parse(read('plan/slices.json')).cards)).toEqual([])
  })
})
