// SC10: card rules R85, R86, R87 and R89 (unit project). Card plan/cards/SC10.md; clauses ARC-15, ARC-16, FLOW-2.
// From reports/DB16-findings.md and reports/CQ4-findings.md (A430) and C1 of reports/phase3-card-review-2026-10-03b.md
// (A437, A438). Each rule is a pure function over a "world" (the cards of plan/slices.json, their card text, the
// harness list, the lifecycle sources). It is first shown catching a planted bad example under
// tools/test/__fixtures__/card-rules/ with pinned statuses (never the live plan/slices.json), then applied to the repo.
//
// A rule that fails on main is a defect of the card that owns it, never fixed here (A329: never weaken a rule): it sits
// in KNOWN with its exact problem strings and its owner card. An entry that no longer fails is stale and fails too, so
// the list only shrinks.
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

// ---------- reading cards ----------

/** Text with every parenthesised part removed (nested parentheses included). */
function outsideParens(text) {
  let depth = 0
  let out = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0) out += ch
  }
  return out
}

/** The raw tag words of a card's `Tags:` line: the first word of each comma or semicolon part outside parentheses. */
function rawTags(cardText) {
  const m = /^Tags:(.*)$/m.exec(cardText ?? '')
  if (!m) return []
  return outsideParens(m[1])
    .split(/[,;]/)
    .map((part) => (part.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
}

/**
 * The card's tag words. "Tags: as A07." (A07B, A07C) takes the named card's tags (amber: a split card keeps its
 * parent's tags); a chain is followed, a loop ends with no tags.
 */
function tagsOf(world, card, seen = new Set()) {
  const text = cardText(world, card)
  const m = /^Tags:\s*as\s+([A-Z][A-Z0-9]*)\b/m.exec(text ?? '')
  if (m) {
    if (seen.has(m[1])) return []
    seen.add(card.id)
    const parent = world.cards.find((c) => c.id === m[1])
    return parent ? tagsOf(world, parent, seen) : []
  }
  return rawTags(text)
}

/** A card's text: its own card file, or its family template with the card's params put in. Undefined when none. */
function cardText(world, card) {
  if (card.family) {
    const template = world.family(card.family)
    if (template === undefined) return undefined
    let text = template
    for (const [k, v] of Object.entries(card.params ?? {})) text = text.split(`{${k}}`).join(String(v))
    return text
  }
  return world.card(card.id)
}

/** Core as CQ6's mutation gate reads it: slices.json `core`, or `core` as a word of the Tags line. */
const isCore = (world, card) => card.core === true || tagsOf(world, card).includes('core')
const live = (card) => card.status !== 'parked'

// ---------- R85: slices.json core and security match the Tags line ----------

function r85(world) {
  const problems = []
  for (const card of world.cards.filter(live)) {
    const tags = tagsOf(world, card)
    for (const word of ['core', 'security']) {
      const flag = card[word] === true
      const said = tags.includes(word)
      if (flag !== said) {
        problems.push(`R85 ${card.id}: slices.json ${word} is ${String(flag)} but the Tags line ${said ? 'says' : 'does not say'} ${word}`)
      }
    }
  }
  return problems
}

// ---------- R86: no harness file in a core card's Paths unless the card names it as harness ----------

/** The card names `file` as harness when one line of its text holds the full path and the word "harness". */
const namesAsHarness = (text, file) => (text ?? '').split(/\r?\n/).some((l) => l.includes(file) && /\bharness\b/i.test(l))

function r86(world) {
  if (!Array.isArray(world.harness)) return [`R86: ${HOMES_REL} has no harness list (CQ6 adds it), so nothing can be checked`]
  if (world.harness.length === 0) return [`R86: the harness list in ${HOMES_REL} is empty, so nothing can be checked`]
  const problems = []
  for (const card of world.cards.filter(live).filter((c) => isCore(world, c))) {
    const text = cardText(world, card)
    for (const file of world.harness) {
      const entry = (card.paths ?? []).find((p) => globToRegExp(p).test(file))
      if (entry && !namesAsHarness(text, file)) {
        problems.push(`R86 ${card.id}: ${file} is on the harness list and in this core card's Paths (${entry}) but the card does not name it as harness`)
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
  const problems = []
  for (const card of world.cards.filter(live)) {
    const text = cardText(world, card)
    if (text === undefined) continue
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

/** The object literal assigned to `const name = { ... }` in `code`, or undefined. */
function objectOf(code, name) {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\b[^=]*=\\s*\\{`).exec(code)
  return m ? balanced(code, m.index + m[0].length - 1) : undefined
}

/** The keys of an object body, following `...name` spreads and shorthand to variables in the same file. */
function keysOf(code, body, seen = new Set()) {
  const keys = []
  for (const part of topLevelParts(body)) {
    const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)$/.exec(part)
    if (spread) {
      if (seen.has(spread[1])) continue
      seen.add(spread[1])
      const inner = objectOf(code, spread[1])
      if (inner !== undefined) keys.push(...keysOf(code, inner, seen))
      continue
    }
    const keyed = /^(['"]?)([A-Za-z_$][\w$]*)\1\s*:/.exec(part)
    if (keyed) keys.push(keyed[2])
    else if (/^[A-Za-z_$][\w$]*$/.test(part)) keys.push(part)
  }
  return keys
}

/** The guard names passed to `createLifecycle` in deps.ts source; a missing file (undefined) registers none. */
function registeredGuards(depsSource) {
  if (depsSource === undefined) return []
  const code = codeOnly(depsSource)
  const found = []
  for (const m of code.matchAll(/\bcreateLifecycle\s*\(/g)) {
    const args = balanced(code, m.index + m[0].length - 1)
    if (args === undefined) continue
    const objStart = args.indexOf('{')
    if (objStart < 0) continue
    const opts = balanced(args, objStart) ?? ''
    for (const part of topLevelParts(opts)) {
      const inline = /^guards\s*:\s*\{/.exec(part)
      const named = /^guards\s*:\s*([A-Za-z_$][\w$]*)$/.exec(part)
      if (inline) found.push(...keysOf(code, balanced(part, inline[0].length - 1) ?? ''))
      else if (named) found.push(...keysOf(code, objectOf(code, named[1]) ?? ''))
      else if (part === 'guards') found.push(...keysOf(code, objectOf(code, 'guards') ?? ''))
    }
  }
  return [...new Set(found)]
}

/**
 * The guard names of MOVES read from moves.ts source: the PAIRS table, named `${from}_to_${to}`. Throws when the
 * source no longer has that shape, so the scan can never go silently empty.
 */
function movesGuards(movesSource) {
  if (!movesSource.includes('guard: `${from}_to_${to}`')) {
    throw new Error(`R89: ${MOVES_REL} no longer names each guard \`\${from}_to_\${to}\`; the scan needs the new shape`)
  }
  const start = movesSource.indexOf('const PAIRS')
  const open = start < 0 ? -1 : movesSource.indexOf('= [', start) + 2
  const table = open > 1 ? balanced(movesSource, open) : undefined
  if (table === undefined) throw new Error(`R89: ${MOVES_REL} has no PAIRS table; the scan needs the new shape`)
  const noComments = table.replace(/\/\/[^\n]*/g, '')
  const guards = [...noComments.matchAll(/\[\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*\]/g)].map((m) => `${m[1]}_to_${m[2]}`)
  if (guards.length === 0) throw new Error(`R89: the PAIRS table in ${MOVES_REL} yields no move`)
  return guards
}

const PHASE_GATE = 4

/**
 * R89 over a world: `moves` (moves.ts source), `deps` (deps.ts source or undefined), `list` (the parsed
 * unbuilt-guards.json) and `cards`.
 */
function r89(world) {
  const problems = []
  const guards = movesGuards(world.moves)
  const registered = new Set(registeredGuards(world.deps))
  const entries = Array.isArray(world.list?.guards) ? world.list.guards : undefined
  if (!entries) return [`R89: ${LIST_REL} has no "guards" list`]
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
    if (!(card.paths ?? []).some((p) => globToRegExp(p).test(DEPS_REL))) {
      problems.push(`R89 guard ${guard}: owner ${owner} does not list ${DEPS_REL} in its Paths, so it can never register the guard`)
    }
  }
  const gate = world.cards.filter((c) => typeof c.phase === 'number' && c.phase <= PHASE_GATE)
  if (gate.length > 0 && gate.every((c) => c.status === 'done' || c.status === 'parked') && listed.size > 0) {
    problems.push(`R89: ${LIST_REL} must be empty at the phase ${String(PHASE_GATE)} gate but lists ${[...listed.keys()].join(', ')}`)
  }
  return problems
}

// ---------- known defects on main, each owned by a card ----------

const KNOWN_KEYS = ['owner', 'problems', 'rule', 'subject']
const KNOWN = [
  // R85: F00T's Tags say core (money: cents and rounding) but slices.json has no core flag.
  { rule: 'R85', subject: 'F00T', owner: 'F00T', problems: ['R85 F00T: slices.json core is false but the Tags line says core'] },
  // R85: V10's Tags say security and screens; slices.json marks it core.
  { rule: 'R85', subject: 'V10', owner: 'V10', problems: ['R85 V10: slices.json core is true but the Tags line does not say core'] },
  // R85: SC3 is "security; reviewed as core by directive (A461)"; slices.json marks it core.
  { rule: 'R85', subject: 'SC3', owner: 'SC3', problems: ['R85 SC3: slices.json core is true but the Tags line does not say core'] },
  // R86: FX7 (core) lists the unit setup file it edits; the card never names it as harness (DB16 findings RC1).
  {
    rule: 'R86',
    subject: 'FX7',
    owner: 'FX7',
    problems: [
      'R86 FX7: src/core/test-no-network.ts is on the harness list and in this core card\'s Paths (src/core/test-no-network.ts) but the card does not name it as harness',
    ],
  },
  // R89 (A438): each owner registers its guard in src/pipeline/deps.ts, which its Paths do not list yet; until each lands.
  {
    rule: 'R89',
    subject: 'intake_to_evidence',
    owner: 'E00',
    problems: ['R89 guard intake_to_evidence: owner E00 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard'],
  },
  {
    rule: 'R89',
    subject: 'evidence_to_gaps',
    owner: 'E01',
    problems: ['R89 guard evidence_to_gaps: owner E01 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard'],
  },
  {
    rule: 'R89',
    subject: 'gaps_to_qa',
    owner: 'G00',
    problems: ['R89 guard gaps_to_qa: owner G00 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard'],
  },
  {
    rule: 'R89',
    subject: 'gaps_to_build',
    owner: 'G00',
    problems: ['R89 guard gaps_to_build: owner G00 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard'],
  },
  {
    rule: 'R89',
    subject: 'qa_to_build',
    owner: 'Q00',
    problems: ['R89 guard qa_to_build: owner Q00 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard'],
  },
]
const RULES = ['R85', 'R86', 'R87', 'R89']

/** KNOWN's shape: exact keys, a rule this file reads KNOWN for, literal problems naming the subject, a card owner. */
function knownShape(known, cards) {
  const problems = []
  const ids = new Set(cards.map((c) => c.id))
  const seen = new Set()
  known.forEach((k, i) => {
    const at = `KNOWN[${String(i)}] ${String(k?.rule)} ${String(k?.subject)}`
    const keys = Object.keys(k ?? {}).sort()
    if (keys.join(',') !== KNOWN_KEYS.join(',')) problems.push(`${at}: the keys are not exactly ${KNOWN_KEYS.join(', ')}`)
    if (!RULES.includes(k?.rule)) problems.push(`${at}: the rule is not one of ${RULES.join(', ')}`)
    if (!ids.has(k?.owner)) problems.push(`${at}: the owner ${String(k?.owner)} is not a card in plan/slices.json`)
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
    moves: read(MOVES_REL),
    deps: exists(DEPS_REL) ? read(DEPS_REL) : undefined,
    list: JSON.parse(read(LIST_REL)),
  }
}

/** A pinned world: small typed card entries and card texts by id, never live statuses (ARC-16). */
function pinnedWorld(opts) {
  const { cards, texts = {}, families = {}, moves, deps, list } = opts
  const harness = 'harness' in opts ? opts.harness : PINNED_HARNESS
  return { cards, card: (id) => texts[id], family: (name) => families[name], harness, moves, deps, list }
}

const entry = (id, extra = {}) => ({ id, status: 'carded', phase: 1, deps: [], paths: [], ...extra })

// ---------- R85 ----------

describe('SC10 R85 slices.json core and security match the Tags line (A430)', () => {
  const b04 = fix('B04.md')
  test('ARC-15 R85 plant: B04 tagged "security, core" with core false in slices.json fails naming B04 and core', () => {
    const world = pinnedWorld({ cards: [entry('B04', { core: false, security: true })], texts: { B04: b04 } })
    expect(r85(world)).toEqual(['R85 B04: slices.json core is false but the Tags line says core'])
  })
  test('ARC-15 R85 the same B04 with core and security true passes; security dropped fails naming security', () => {
    expect(r85(pinnedWorld({ cards: [entry('B04', { core: true, security: true })], texts: { B04: b04 } }))).toEqual([])
    expect(r85(pinnedWorld({ cards: [entry('B04', { core: true })], texts: { B04: b04 } }))).toEqual([
      'R85 B04: slices.json security is false but the Tags line says security',
    ])
  })
  test('ARC-15 R85 words inside parentheses or after "reviewed as" never count; a flag the Tags line lacks fails', () => {
    const texts = {
      'A1 (Test)': 'Tags: none (the rules keep core money and security checks honest).\n',
      'A2 (Test)': 'Tags: security; reviewed as core by directive (A461) (stand-ins, (nested) text).\n',
      'A3 (Test)': '# no tags line\n',
    }
    const cards = [entry('A1 (Test)', { core: true }), entry('A2 (Test)', { security: true }), entry('A3 (Test)', { security: true })]
    expect(r85(pinnedWorld({ cards, texts }))).toEqual([
      'R85 A1 (Test): slices.json core is true but the Tags line does not say core',
      'R85 A3 (Test): slices.json security is true but the Tags line does not say security',
    ])
  })
  test('ARC-15 R85 "Tags: as A07" takes the named card\'s tags; a family card reads its template; a parked card is skipped', () => {
    const cards = [
      entry('P1', { core: true }),
      entry('P2', { core: true }),
      entry('P3', { status: 'parked' }),
      entry('K1', { family: 'kind', params: { kind: 'K1' } }),
    ]
    const texts = { P1: 'Tags: core (money).\n', P2: 'Tags: as P1.\n', P3: 'Tags: security.\n' }
    const families = { kind: '# Family: kind {kind}\n' }
    expect(r85(pinnedWorld({ cards, texts, families }))).toEqual([])
    const asParent = pinnedWorld({ cards: [entry('P1', { core: true }), entry('P2')], texts })
    expect(r85(asParent)).toEqual(['R85 P2: slices.json core is false but the Tags line says core'])
    const famCore = pinnedWorld({ cards: [cards[3]], families: { kind: 'Tags: core ({kind} money).\n' } })
    expect(r85(famCore)).toEqual(['R85 K1: slices.json core is false but the Tags line says core'])
  })
  test('ARC-15 R85 on every card in plan/slices.json: only the KNOWN mismatches, each with its owner card', () => {
    const problems = r85(liveWorld())
    expect(onlyKnown('R85', problems)).toEqual([])
  })
})

// ---------- R86 ----------

describe('SC10 R86 no harness file in a core card\'s Paths unless the card names it as harness (DB16 findings RC1)', () => {
  const db16 = fix('DB16-first-carded.md')
  const db16Entry = (extra = {}) =>
    entry('DB16', {
      phase: 0,
      core: true,
      security: true,
      paths: ['src/core/db/global-setup.ts', 'src/core/db/index.ts', 'src/core/db/pg16.test.ts', 'vitest.config.ts', 'package.json'],
      ...extra,
    })
  test('ARC-15 R86 plant: DB16 as first carded (core, global-setup.ts and index.ts in Paths) fails naming both files', () => {
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: db16 } }))).toEqual([
      "R86 DB16: src/core/db/index.ts is on the harness list and in this core card's Paths (src/core/db/index.ts) but the card does not name it as harness",
      "R86 DB16: src/core/db/global-setup.ts is on the harness list and in this core card's Paths (src/core/db/global-setup.ts) but the card does not name it as harness",
    ])
  })
  test('ARC-15 R86 the same card naming both as harness passes; as tagged on main (security, core false) it passes', () => {
    const named = `${db16}\n- src/core/db/index.ts and src/core/db/global-setup.ts stay unmarked harness.\n`
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: named } }))).toEqual([])
    const asOnMain = db16.replace(/^Tags:.*$/m, 'Tags: security (the switch refuses any live or non-local database).')
    expect(r86(pinnedWorld({ cards: [db16Entry({ core: false })], texts: { DB16: asOnMain } }))).toEqual([])
  })
  test('ARC-15 R86 a glob in Paths counts; core from the Tags line alone counts; a basename alone never names a file', () => {
    const cards = [entry('G1 (Test)', { paths: ['src/core/db/**'] })]
    const texts = { 'G1 (Test)': 'Tags: security, core (money).\n\nindex.ts is harness.\n' }
    expect(r86(pinnedWorld({ cards, texts, harness: ['src/core/db/index.ts'] }))).toEqual([
      "R86 G1 (Test): src/core/db/index.ts is on the harness list and in this core card's Paths (src/core/db/**) but the card does not name it as harness",
    ])
  })
  test('ARC-15 R86 a missing or empty harness list fails, never passes with nothing checked', () => {
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: db16 }, harness: undefined }))).toEqual([
      'R86: tools/test-homes.json has no harness list (CQ6 adds it), so nothing can be checked',
    ])
    expect(r86(pinnedWorld({ cards: [db16Entry()], texts: { DB16: db16 }, harness: [] }))).toEqual([
      'R86: the harness list in tools/test-homes.json is empty, so nothing can be checked',
    ])
  })
  test('ARC-15 R86 on every card in plan/slices.json with CQ6\'s harness list: only the KNOWN entries', () => {
    expect(onlyKnown('R86', r86(liveWorld()))).toEqual([])
  })
})

// ---------- R87 ----------

describe('SC10 R87 the R82 set from tools/lib.mjs holds only expectation files the Build does not name (CQ4 findings)', () => {
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
  test('ARC-15 R87 on every card in plan/slices.json (family templates with their params): only the KNOWN entries', () => {
    const world = liveWorld()
    expect(world.cards.filter(live).filter((c) => cardText(world, c) !== undefined).length).toBeGreaterThan(100)
    expect(onlyKnown('R87', r87(world, lib))).toEqual([])
  })
})

// ---------- R89 ----------

describe('SC10 R89 every guard in MOVES has a registration or an owner card (C1, phase 3 card review b)', () => {
  const movesMain = read(MOVES_REL)
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
  const ownerCards = () => [...new Set(owners.map(([, o]) => o))].map((id) => entry(id, { phase: 3, paths: ['src/pipeline/deps.ts'] }))
  const world = (extra = {}) => pinnedWorld({ cards: ownerCards(), moves: movesMain, deps: undefined, list: fullList(), ...extra })

  test('FLOW-2 R89 the scan of moves.ts gives exactly the guards of the imported MOVES, in order', async () => {
    const { MOVES } = await load(MOVES_REL)
    expect(MOVES.length).toBeGreaterThan(0)
    expect(movesGuards(movesMain)).toEqual(MOVES.map((m) => m.guard))
    expect(movesGuards(movesMain)).toContain('review_to_approved')
  })
  test('FLOW-2 R89 plant: a copy of moves.ts with one extra move whose guard is neither registered nor listed fails naming it', () => {
    expect(r89(world({ moves: fix('moves-extra-move.ts.txt') }))).toEqual([
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
  test('FLOW-2 R89 the deps.ts scan reads the guards passed to createLifecycle (keys, quoted keys, spreads), never comments or strings', () => {
    expect(registeredGuards(fix('deps-registers.ts.txt')).sort()).toEqual(['review_to_approved', 'review_to_rework', 'rework_to_review'])
    expect(registeredGuards(undefined)).toEqual([])
    expect(registeredGuards('export const x = { review_to_approved: g }\n')).toEqual([])
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
  test('FLOW-2 R89 plant: an owner that is not a card in slices.json fails; so do a parked owner, a done owner and an owner without deps.ts in Paths', () => {
    const list = fullList()
    list.guards[0].owner = 'Z99 (Test)'
    expect(r89(world({ list }))).toEqual(['R89 guard intake_to_evidence: owner Z99 (Test) is not a card in plan/slices.json'])
    const cards = ownerCards()
    cards.find((c) => c.id === 'T08').status = 'parked'
    cards.find((c) => c.id === 'T10').status = 'done'
    cards.find((c) => c.id === 'E00').paths = ['src/pipeline/steps/intake.ts']
    expect(r89(world({ cards }))).toEqual([
      'R89 guard intake_to_evidence: owner E00 does not list src/pipeline/deps.ts in its Paths, so it can never register the guard',
      'R89 guard review_to_approved: owner T08 is parked, so it can never register the guard',
      'R89 guard assessed_to_closed: owner T10 is done but the guard is still not registered',
    ])
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
    const cards = [entry('T13', { phase: 4, status: 'done', paths: ['src/pipeline/deps.ts'] }), entry('X9 (Test)', { phase: 5 })]
    const list = { guards: [{ guard: 'filed_to_assessed', owner: 'T13' }] }
    const deps = `createLifecycle({ guards: { ${owners.filter(([g]) => g !== 'filed_to_assessed').map(([g]) => `${g}: ok`).join(', ')} } })\n`
    expect(r89(world({ cards, list, deps }))).toEqual([
      'R89 guard filed_to_assessed: owner T13 is done but the guard is still not registered',
      'R89: data/lifecycle/unbuilt-guards.json must be empty at the phase 4 gate but lists filed_to_assessed',
    ])
    const allIn = `createLifecycle({ guards: { ${owners.map(([g]) => `${g}: ok`).join(', ')} } })\n`
    expect(r89(world({ cards, list: { guards: [] }, deps: allIn }))).toEqual([])
  })
  test('FLOW-2 R89 the starting list equals the guards no deps.ts registers, each with the owner the cards name (A438)', () => {
    const w = liveWorld()
    const unregistered = movesGuards(w.moves).filter((g) => !registeredGuards(w.deps).includes(g))
    expect(w.list.guards.map((g) => g.guard).sort()).toEqual([...unregistered].sort())
    if (w.deps === undefined) expect(w.list.guards.map((g) => [g.guard, g.owner])).toEqual(owners)
  })
  test('FLOW-2 R89 on main (moves.ts, deps.ts, the list, plan/slices.json): only the KNOWN entries', () => {
    expect(onlyKnown('R89', r89(liveWorld()))).toEqual([])
  })
})

// ---------- KNOWN ----------

describe('SC10 KNOWN is exact, owned and alive', () => {
  test('ARC-16 KNOWN shape plant: wrong keys, an unknown rule, a non-card owner, a problem for another subject and a repeat are caught', () => {
    const cards = [entry('V10')]
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
  test('ARC-16 a KNOWN entry that no longer fails is stale and fails by name', () => {
    const known = [{ rule: 'R85', subject: 'V10', owner: 'V10', problems: ['R85 V10: slices.json core is true but the Tags line does not say core'] }]
    expect(onlyKnown('R85', [], known)).toEqual([
      'stale KNOWN entry R85 V10 (owner V10): "R85 V10: slices.json core is true but the Tags line does not say core" no longer fails; remove it',
    ])
  })
  test('ARC-16 KNOWN on main has the right shape and the exact entries the card expects on landing', () => {
    expect(knownShape(KNOWN, JSON.parse(read('plan/slices.json')).cards)).toEqual([])
    expect(KNOWN.map((k) => `${k.rule} ${k.subject} ${k.owner}`)).toEqual([
      'R85 F00T F00T',
      'R85 V10 V10',
      'R85 SC3 SC3',
      'R86 FX7 FX7',
      'R89 intake_to_evidence E00',
      'R89 evidence_to_gaps E01',
      'R89 gaps_to_qa G00',
      'R89 gaps_to_build G00',
      'R89 qa_to_build Q00',
    ])
  })
})
