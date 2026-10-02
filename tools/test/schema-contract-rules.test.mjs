// SC: schema and contract rules, file side (unit project). Card plan/cards/SC.md; clauses SEC-7, EV-1, ARC-10,
// EV-5, EV-8, EV-10, FLOW-1, ARC-15 and the clauses each rule names. Each rule is first shown catching a planted bad
// example under tools/test/__fixtures__/schema-contract/, then applied to the repo. The database half (R12 to R15 on
// the catalog, R41's SQL side, R42 to R44) is src/contracts/schema-rules.db.test.ts.
//
// A rule that fails on main is a defect of the card that owns the file (card SC: "added to that card, never fixed
// here"). Those found when the spec was validated are listed in KNOWN with their owner; an entry that no longer
// matches fails too, so the list only shrinks. A rule that has nothing to check fails ("a pass with zero tests is a
// failure"): on main before F01 lands, the rules that need records.ts fail by name for that reason.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX_REL = 'tools/test/__fixtures__/schema-contract'
const FIX = path.join(ROOT, ...FIX_REL.split('/'))
const SEED = 20261002
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href)

// ---------- known defects on main (validated 2 Oct), each owned by another card ----------
const KNOWN = [
  { rule: 'R23', match: /^src\/contracts\/checks\.ts#CheckRecordSchema: /, owner: 'F05M (next round; card SC check 10a)' },
  { rule: 'R23', match: /^src\/contracts\/checks\.ts#ReconcilingItemSchema: /, owner: 'F05M (next round; card SC check 10a)' },
  { rule: 'R23', match: /^src\/contracts\/checks\.ts#CheckExceptionSchema: /, owner: 'F05M (next round; card SC check 10a)' },
  { rule: 'R23', match: /^src\/contracts\/facts\.ts#factEntrySchema: /, owner: 'E03' },
  { rule: 'R30', match: /^src\/contracts\/taxprep\.ts#readBackMatches: a rate of 0\.5 read back as /, owner: 'F03R (R33: rates compare exact text against toFixed(4), not Number())' },
  { rule: 'R28', match: /^src\/contracts\/taxprep\.ts: defines its own amount pattern/, owner: 'F03R (the thousands-separator fault pattern; the Lead may exempt the Taxprep grammar instead)' },
  { rule: 'R32', match: /^"(\+1'234|\(1'234\)| 1'234|1'234 |1'234e3|--'12|1\u2019234)": passes as plain text/, owner: 'F03R (B1 apostrophe rule)' },
  { rule: 'R34', match: /^tools\/test\/__fixtures__\/planted-interpolated-log\.ts\.txt: a Luhn-valid/, owner: 'A05 (the log-redaction plant uses the published specimen SIN; give it a non-Luhn number)' },
  { rule: 'R37', match: /^reference\/sample-clients\/[^ ]+\/taxprep\/import\.csv: /, owner: 'W00 (A347: the .gitattributes line and the taxprep CSVs)' },
  { rule: 'R37', match: /^reference\/taxprep\/[^ ]+\.csv: /, owner: 'W00 (A347)' },
  { rule: 'R38', match: /^src\/contracts\/taxprep\.acceptance\.test\.ts: /, owner: 'F03R (spec refit; findings W00 r1)' },
  { rule: 'R38', match: /^no Vitest setup file refuses a Node major below 24/, owner: 'TH (was TH R6)' },
  { rule: 'R39', match: /^amountGroups joins words from two pages/, owner: 'F09B' },
  { rule: 'R40', match: /^src\/contracts\/reading\.ts#WordSchema accepts /, owner: 'F09B' },
  { rule: 'R41', match: /^src\/contracts\/(reading|facts|checks|taxprep|amount-grammar)\.ts: /, owner: 'the file owner (F09B reading, E03 facts, F05M checks, F03R taxprep, F09A amount-grammar); F01 brings text.ts' },
  { rule: 'R45', match: /^sensitiveKindForKey\("[^"]+"\) is "none"/, owner: 'E03' },
  { rule: 'R45-enum', match: /^loadFactCatalogue accepts duplicate enum options/, owner: 'E03' },
]

function onlyKnown(rule, problems) {
  const known = KNOWN.filter((k) => k.rule === rule)
  const unknown = problems.filter((p) => !known.some((k) => k.match.test(p)))
  const stale = known
    .filter((k) => !problems.some((p) => k.match.test(p)))
    .map((k) => `stale KNOWN entry ${k.rule} ${String(k.match)} (owner ${k.owner}): it no longer fails, remove it`)
  return [...unknown, ...stale]
}

// ---------- files ----------
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.stryker-tmp', 'coverage', 'test-results', 'playwright-report'])
function walk(dirRel, out = []) {
  const abs = path.join(ROOT, dirRel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const r = dirRel === '' ? e.name : `${dirRel}/${e.name}`
    if (r === '.claude/worktrees') continue
    if (e.isDirectory()) walk(r, out)
    else out.push(r)
  }
  return out
}
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f)
const isFixture = (f) => /(^|\/)(__fixtures__|__golden__)\//.test(f)
const productTs = (dirs) =>
  dirs.flatMap((d) => walk(d)).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !isTest(f) && !isFixture(f))
const CONTRACT_AND_MODULE_FILES = () => productTs(['src/contracts', 'src/modules'])

// ---------- JSDoc tags on exports ----------
function taggedExports(src) {
  const out = []
  const re = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*export\s+(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*))/g
  for (const m of src.matchAll(re)) {
    const tags = {}
    for (const t of m[1].matchAll(/@(money|converter|writes)\b(?:[ \t]+([A-Za-z_$][\w$]*))?/g)) tags[t[1]] = t[2] ?? true
    out.push({ name: m[2] ?? m[3], tags })
  }
  return out
}
function tagged(files, tag) {
  return files.flatMap((file) =>
    taggedExports(read(file))
      .filter((e) => e.tags[tag] !== undefined)
      .map((e) => ({ file, name: e.name, key: `${file}#${e.name}`, arg: e.tags[tag] })),
  )
}
async function exportOf(key) {
  const [file, name] = key.split('#')
  return { mod: await load(file), fn: (await load(file))[name] }
}

// ---------- zod introspection (zod 4) ----------
const isZod = (v) => v !== null && typeof v === 'object' && '_zod' in v && typeof v.safeParse === 'function'
const zdef = (s) => s._zod.def
const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault', 'readonly', 'nonoptional', 'catch'])
function unwrap(s) {
  let x = s
  for (let i = 0; i < 20; i++) {
    const d = zdef(x)
    if (WRAPPERS.has(d.type)) x = d.innerType
    else if (d.type === 'pipe') x = d.in
    else if (d.type === 'lazy') x = d.getter()
    else break
  }
  return x
}
const STRING_CANDIDATES = [
  'sample (Test)', 'a', 'A', 'x1', 'A1', 'ABC', 'a.b.c', 'IDENT.Ident120', 'r-1', 'r_1', '2026-10-02', '2026-10-02T12:00:00Z',
  '2026-10-02T12:00:00.000Z', '2026-10-02T12:00:00-04:00', '00000000-0000-4000-8000-000000000000', 'test@example.com',
  'https://example.com/', '0aad6c0c-6444-466e-a247-ed6d63078cd2', 'T2', '1',
]
const NUMBER_CANDIDATES = [0, 1, 0.5, 2, 10, 100, 0.25, -1]
const firstPassing = (s, cands) => cands.filter((c) => s.safeParse(c).success).slice(0, 1)
const CAP = 40

/** Valid sample values for a schema: one base value plus variants that switch one field at a time. */
function samples(s, depth = 0) {
  if (depth > 10) return []
  const d = zdef(s)
  let out
  switch (d.type) {
    case 'string':
    case 'template_literal':
      return firstPassing(s, STRING_CANDIDATES)
    case 'number':
      return firstPassing(s, NUMBER_CANDIDATES)
    case 'bigint':
      return firstPassing(s, [0n, 1n])
    case 'boolean':
      return [true]
    case 'date':
      return firstPassing(s, [new Date(Date.UTC(2026, 9, 2, 16))])
    case 'null':
      return [null]
    case 'undefined':
    case 'void':
      return [undefined]
    case 'literal':
      return d.values.slice(0, 1)
    case 'enum':
      return Object.values(d.entries).slice(0, 1)
    case 'unknown':
    case 'any':
      return [null]
    case 'nullable':
      out = [...samples(d.innerType, depth + 1), null]
      break
    case 'optional':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'nonoptional':
    case 'catch':
      out = samples(d.innerType, depth + 1)
      break
    case 'pipe':
      out = samples(d.in, depth + 1)
      break
    case 'lazy':
      out = samples(d.getter(), depth + 1)
      break
    case 'array':
      out = samples(d.element, depth + 1).map((v) => [v])
      if (out.length === 0) out = [[]]
      break
    case 'tuple': {
      const items = d.items.map((it) => samples(it, depth + 1)[0])
      out = [items]
      break
    }
    case 'record': {
      const key = firstPassing(d.keyType, ['k', ...STRING_CANDIDATES])[0] ?? Object.values(zdef(d.keyType).entries ?? {})[0]
      out = key === undefined ? [] : samples(d.valueType, depth + 1).map((v) => ({ [key]: v }))
      break
    }
    case 'union':
      out = d.options.flatMap((o) => samples(o, depth + 1))
      break
    case 'intersection': {
      const l = samples(d.left, depth + 1)[0]
      const r = samples(d.right, depth + 1)[0]
      out = l && r && typeof l === 'object' ? [{ ...l, ...r }] : []
      break
    }
    case 'object': {
      const shape = d.shape
      const keys = Object.keys(shape)
      const vars = keys.map((k) => samples(shape[k], depth + 1))
      const loose = (k) => ['nullable', 'optional'].includes(zdef(shape[k]).type)
      if (keys.some((k, i) => vars[i].length === 0 && !loose(k))) return []
      const pick = (i) => vars[i][0]
      const base = {}
      const allNull = {}
      keys.forEach((k, i) => {
        if (vars[i].length > 0) base[k] = pick(i)
        const t = zdef(shape[k]).type
        if (t === 'nullable') allNull[k] = null
        else if (t !== 'optional' && vars[i].length > 0) allNull[k] = pick(i)
      })
      out = [base, allNull]
      keys.forEach((k, i) => {
        for (const v of vars[i].slice(1)) out.push({ ...base, [k]: v })
        if (loose(k)) for (const v of vars[i].filter((x) => x !== null)) out.push({ ...allNull, [k]: v })
      })
      break
    }
    default:
      return []
  }
  return out.filter((v) => s.safeParse(v).success).slice(0, CAP)
}

/** Every object node of a schema, by schema path. */
function objectNodes(s, p = '', out = new Set(), depth = 0) {
  if (depth > 10) return out
  const d = zdef(s)
  if (WRAPPERS.has(d.type)) return objectNodes(d.innerType, p, out, depth + 1)
  if (d.type === 'pipe') return objectNodes(d.in, p, out, depth + 1)
  if (d.type === 'lazy') return objectNodes(d.getter(), p, out, depth + 1)
  if (d.type === 'object') {
    out.add(p || '(top)')
    for (const [k, v] of Object.entries(d.shape)) objectNodes(v, `${p}.${k}`, out, depth + 1)
  } else if (d.type === 'array') objectNodes(d.element, `${p}[]`, out, depth + 1)
  else if (d.type === 'tuple') d.items.forEach((it, i) => objectNodes(it, `${p}[${String(i)}]`, out, depth + 1))
  else if (d.type === 'record') objectNodes(d.valueType, `${p}{}`, out, depth + 1)
  else if (d.type === 'union') d.options.forEach((o, i) => objectNodes(o, `${p}|${String(i)}`, out, depth + 1))
  else if (d.type === 'intersection') {
    objectNodes(d.left, p, out, depth + 1)
    objectNodes(d.right, p, out, depth + 1)
  }
  return out
}

/** The object nodes a value reaches: [{ node: schema path, at: value path }]. */
function objectPaths(s, value, p = '', at = [], out = [], depth = 0) {
  if (depth > 10 || value === null || value === undefined) return out
  const d = zdef(s)
  if (WRAPPERS.has(d.type)) return objectPaths(d.innerType, value, p, at, out, depth + 1)
  if (d.type === 'pipe') return objectPaths(d.in, value, p, at, out, depth + 1)
  if (d.type === 'lazy') return objectPaths(d.getter(), value, p, at, out, depth + 1)
  if (d.type === 'object' && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    out.push({ node: p || '(top)', at })
    for (const [k, v] of Object.entries(d.shape)) if (k in value) objectPaths(v, value[k], `${p}.${k}`, [...at, k], out, depth + 1)
  } else if (d.type === 'array' && Array.isArray(value)) {
    value.forEach((v, i) => objectPaths(d.element, v, `${p}[]`, [...at, i], out, depth + 1))
  } else if (d.type === 'tuple' && Array.isArray(value)) {
    d.items.forEach((it, i) => objectPaths(it, value[i], `${p}[${String(i)}]`, [...at, i], out, depth + 1))
  } else if (d.type === 'record' && typeof value === 'object') {
    for (const k of Object.keys(value)) objectPaths(d.valueType, value[k], `${p}{}`, [...at, k], out, depth + 1)
  } else if (d.type === 'union') {
    const i = d.options.findIndex((o) => o.safeParse(value).success)
    if (i >= 0) objectPaths(d.options[i], value, `${p}|${String(i)}`, at, out, depth + 1)
  } else if (d.type === 'intersection') {
    objectPaths(d.left, value, p, at, out, depth + 1)
    objectPaths(d.right, value, p, at, out, depth + 1)
  }
  return out
}

function clone(v) {
  return structuredClone(v)
}
function getIn(v, at) {
  return at.reduce((x, k) => x[k], v)
}

/** Exported zod schemas of some modules: [{ key, schema }], one entry per schema object (the defining file first). */
async function exportedSchemas(files) {
  const seen = new Map()
  const ordered = [...files].sort((a, b) => Number(a.endsWith('/index.ts')) - Number(b.endsWith('/index.ts')) || a.localeCompare(b))
  for (const file of ordered) {
    const mod = await load(file)
    for (const [name, v] of Object.entries(mod)) if (isZod(v) && !seen.has(v)) seen.set(v, `${file}#${name}`)
  }
  return [...seen].map(([schema, key]) => ({ key, schema }))
}
const contractFiles = () => productTs(['src/contracts']).filter((f) => !f.endsWith('/env.ts'))

// ---------- R23: every contract refuses a stray key at every depth ----------
// Samples are generated from each schema; a schema whose objects the generator cannot reach gets a sample here.
const R23_SAMPLES = {
  'src/contracts/facts.ts#factEntrySchema': [
    {
      key: 'corp.identity.legal_name',
      valueType: 'text',
      period: 'instant',
      repeating: 'none',
      sensitive: 'none',
      suppliedBy: ['onboarding'],
      label: 'Legal name (Test)',
      cites: [{ kind: 'onboarding_contract', ref: 'corporation.legalName' }],
    },
  ],
}
const STRAY = 'strayKeyTest'

function strayKeyProblems(entries, overrides = {}) {
  const problems = []
  for (const { key, schema } of entries) {
    const nodes = objectNodes(schema)
    if (nodes.size === 0) continue
    const given = overrides[key]
    const all = [...(given ?? []), ...(given ? [] : samples(schema))]
    for (const sample of given ?? []) {
      if (!schema.safeParse(sample).success) problems.push(`${key}: the R23 sample does not parse; fix the sample`)
    }
    const covered = new Set()
    const tried = new Set()
    for (const sample of all.filter((x) => schema.safeParse(x).success)) {
      for (const { node, at } of objectPaths(schema, sample)) {
        covered.add(node)
        const id = at.join('.')
        if (tried.has(id)) continue
        tried.add(id)
        const bad = clone(sample)
        getIn(bad, at)[STRAY] = 'x'
        if (schema.safeParse(bad).success) problems.push(`${key}: a stray key is accepted at ${id === '' ? '(top)' : id}`)
      }
    }
    for (const n of nodes) {
      if (!covered.has(n)) problems.push(`${key}: no valid sample reaches the object at ${n}; add one to R23_SAMPLES`)
    }
  }
  return problems
}

// ---------- R17: one box shape ----------
// A derived box (F01's SourceBoxSchema: F09's Box without the page, the page is source_page, EV-5) is named here.
const DERIVED_BOXES = new Set(['src/contracts/records.ts#SourceBoxSchema'])
const BOX_FIELD = /^(box|.*_box|.*Box)$/
function boxProblems(entries, BoxSchema) {
  const keyOf = new Map(entries.map((e) => [e.schema, e.key]))
  const problems = []
  const visit = (s, where, depth, seen) => {
    if (depth > 10 || seen.has(s)) return
    seen.add(s)
    const d = zdef(s)
    if (WRAPPERS.has(d.type)) return visit(d.innerType, where, depth + 1, seen)
    if (d.type === 'pipe') return visit(d.in, where, depth + 1, seen)
    if (d.type === 'lazy') return visit(d.getter(), where, depth + 1, seen)
    if (d.type === 'object') {
      const keys = Object.keys(d.shape)
      if (['x0', 'y0', 'x1', 'y1'].every((k) => keys.includes(k))) problems.push(`${where}: an object with x0, y0, x1, y1 (use F09's BoxSchema)`)
      for (const [k, v] of Object.entries(d.shape)) {
        if (BOX_FIELD.test(k)) {
          const inner = unwrap(v)
          if (inner !== BoxSchema && !DERIVED_BOXES.has(keyOf.get(inner) ?? '')) problems.push(`${where}.${k}: a box field that is not F09's BoxSchema`)
        }
        visit(v, `${where}.${k}`, depth + 1, seen)
      }
    } else if (d.type === 'array') visit(d.element, `${where}[]`, depth + 1, seen)
    else if (d.type === 'record') visit(d.valueType, `${where}{}`, depth + 1, seen)
    else if (d.type === 'union') d.options.forEach((o) => visit(o, where, depth + 1, seen))
    else if (d.type === 'intersection') {
      visit(d.left, where, depth + 1, seen)
      visit(d.right, where, depth + 1, seen)
    }
  }
  for (const { key, schema } of entries) visit(schema, key, 0, new Set())
  return problems
}
function boxTextProblems(files, readFile) {
  return files
    .filter((f) => /\bx0\s*:[\s\S]{0,300}?\by0\s*:[\s\S]{0,300}?\bx1\s*:[\s\S]{0,300}?\by1\s*:/.test(readFile(f)))
    .map((f) => `${f}: declares its own {x0, y0, x1, y1} box`)
}

// ---------- R14 (zod side) and R15 (list side) ----------
const STAMP_BAD = [{}, { x: null }, { x: '' }]
function stampProblems(entries) {
  const stamps = entries.filter((e) => e.key.endsWith('#VersionStampSchema'))
  const problems = stamps.flatMap(({ key, schema }) =>
    STAMP_BAD.filter((v) => schema.safeParse(v).success).map((v) => `${key} accepts ${JSON.stringify(v)}`),
  )
  return { checked: stamps.length, problems }
}

const STATE_FIELD = /^(state|.*_state|status|origin|entry_type)$/
const sameSet = (a, b) => a.length === b.length && new Set(a).size === new Set(b).size && a.every((x) => b.includes(x))
function listSideProblems(mod, where) {
  const lists = Object.entries(mod).filter(([, v]) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string'))
  const problems = []
  let checked = 0
  for (const [name, schema] of Object.entries(mod).filter(([, v]) => isZod(v))) {
    const base = unwrap(schema)
    if (zdef(base).type !== 'object') continue
    for (const [field, fs_] of Object.entries(zdef(base).shape)) {
      if (!STATE_FIELD.test(field)) continue
      checked += 1
      const inner = unwrap(fs_)
      if (zdef(inner).type !== 'enum') {
        problems.push(`${where}#${name}.${field}: not an enum of a list in ${where}`)
        continue
      }
      const options = Object.values(zdef(inner).entries)
      if (!lists.some(([, l]) => sameSet(l, options))) problems.push(`${where}#${name}.${field}: its options ${JSON.stringify(options)} equal no list in ${where}`)
    }
  }
  return { checked, problems }
}

// ---------- R16: no order by created_at or id before an identity seq ----------
function orderByProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    for (const m of src.matchAll(/\border\s+by\s+([^;)]*)/gi)) {
      const terms = m[1].split(',').map((t) => t.trim().replace(/\s+(asc|desc|nulls\s+(first|last)|limit\b.*)$/gi, '').trim())
      const bad = terms.findIndex((t) => /(^|\.)(created_at|id)\b/i.test(t))
      if (bad < 0) continue
      const seqFirst = /(^|\.)(\w*_)?seq\b/i.test(terms[0] ?? '')
      if (!seqFirst) problems.push(`${f}: "order by ${m[1].trim().slice(0, 60)}" orders by created_at or id with no identity seq first`)
    }
  }
  return problems
}

// ---------- R18: every core file carries // @mutate ----------
function globToRe(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else re += c.replace(/[.+^${}()|[\]\\?]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}
function cardMeta(text) {
  const tags = /(?:^|\s)Tags:\s*([^\n]*)/.exec(text)?.[1] ?? ''
  const pathsRaw = /(?:^|\s)Paths:\s*([^\n]*)/.exec(text)?.[1] ?? ''
  const paths = pathsRaw
    .replace(/\.\s+(Clauses|Deps|Where|Size|Tags):.*$/, '')
    .split(',')
    .map((p) => p.replace(/[`]/g, '').trim().replace(/\.$/, ''))
    .filter((p) => /^[\w.*/[\]-]+$/.test(p) && p.includes('/'))
  return { core: /^core\b/.test(tags.trim()), paths }
}
function coreUnmarkedProblems(cards, files, head) {
  const coreGlobs = cards.filter((c) => c.core).flatMap((c) => c.paths)
  return files
    .filter((f) => /^src\/(contracts|modules)\//.test(f) && /\.tsx?$/.test(f) && !isTest(f) && !isFixture(f))
    .filter((f) => coreGlobs.some((g) => globToRe(g).test(f)))
    .filter((f) => !/\/\/ @mutate\b/.test(head(f).split('\n').slice(0, 5).join('\n')))
    .map((f) => `${f}: a core card lists it, but it has no // @mutate in its first 5 lines`)
}

// ---------- R26: no money function returns -0 ----------
function negZeroIn(out, depth = 0) {
  if (typeof out === 'number') return Object.is(out, -0)
  if (depth > 4 || out === null || typeof out !== 'object') return false
  return Object.entries(out).some(([k, v]) =>
    typeof v === 'number' ? /cents|amount/i.test(k) && Object.is(v, -0) : typeof v === 'object' && negZeroIn(v, depth + 1),
  )
}
async function moneyProblems(files, registry) {
  const problems = []
  const keys = new Set(tagged(files, 'money').map((t) => t.key))
  for (const k of keys) if (!(k in registry)) problems.push(`${k}: a @money export missing from the R26 registry`)
  for (const k of Object.keys(registry)) {
    if (files.includes(k.split('#')[0]) && !keys.has(k)) problems.push(`${k}: in the R26 registry but its export has no @money tag`)
  }
  for (const k of [...keys].filter((x) => x in registry)) {
    const { mod, fn } = await exportOf(k)
    if (typeof fn !== 'function') {
      problems.push(`${k}: not an exported function`)
      continue
    }
    const r = fc.check(
      fc.property(registry[k](mod), (args) => {
        let out
        try {
          out = fn(...args)
        } catch {
          return true
        }
        return !negZeroIn(out)
      }),
      { seed: SEED, numRuns: 300 },
    )
    if (r.failed) problems.push(`${k}: returns -0 for ${fc.stringify(r.counterexample?.[0])}`)
  }
  return { checked: keys.size, problems }
}
const ZERO_TEXTS = ['(0.00)', '-0.00', '0.00-', '0.00 DR', '0.00 CR', '$(0.00)', '−0.00', '-$0.00', '(0)', '-0', '($0.00)', '- 0.00', '0']
const amountText = (m) =>
  fc.oneof(
    fc.constantFrom(...ZERO_TEXTS),
    fc
      .tuple(fc.integer({ min: -(10 ** 11), max: 10 ** 11 }), fc.constantFrom(...Object.values(m.AMOUNT_FORMATS)))
      .map(([c, f]) => m.formatAmount(c, f)),
  )
const wordsOf = (texts) =>
  texts.flatMap((t) => t.match(/\S+/g) ?? []).slice(0, 10).map((text, k) => ({
    text,
    box: { page: 1, left: 0.02 + k * 0.09, top: 0.1, width: 0.06, height: 0.02 },
    confidence: 1,
    order: k,
  }))
const MONEY_REGISTRY = {
  'src/contracts/amount-grammar.ts#normaliseAmount': (m) => fc.tuple(amountText(m)),
  'src/contracts/amount-grammar.ts#amountGroups': (m) => fc.array(amountText(m), { minLength: 1, maxLength: 2 }).map((ts) => [wordsOf(ts)]),
  'src/contracts/amount-grammar.ts#formatAmount': (m) =>
    fc.tuple(fc.oneof(fc.constant(-0), fc.integer({ min: -(10 ** 12), max: 10 ** 12 })), fc.constantFrom(...Object.values(m.AMOUNT_FORMATS))),
}

// ---------- R27: converters refuse non-finite numbers with RangeError ----------
const CONVERTERS_NAMED = ['src/contracts/reading.ts#pointsToBox', 'src/contracts/reading.ts#pixelsToBox']
const CONVERTER_ARGS = {
  'src/contracts/reading.ts#pointsToBox': [1, { x: 72, y: 72, width: 144, height: 36 }, 612, 792],
  'src/contracts/reading.ts#pixelsToBox': [1, { x: 100, y: 100, width: 200, height: 50 }, 1700, 2200],
}
function numericSlots(args) {
  const slots = []
  args.forEach((a, i) => {
    if (typeof a === 'number') slots.push({ name: `argument ${String(i)}`, set: (xs, v) => (xs[i] = v) })
    else if (a && typeof a === 'object') {
      for (const [k, v] of Object.entries(a)) if (typeof v === 'number') slots.push({ name: `argument ${String(i)}.${k}`, set: (xs, val) => (xs[i][k] = val) })
    }
  })
  return slots
}
async function converterProblems(files, registry, named) {
  const problems = []
  const keys = new Set(tagged(files, 'converter').map((t) => t.key))
  for (const k of named) if (!keys.has(k)) problems.push(`${k}: a converter named by card SC without the @converter tag`)
  for (const k of keys) {
    if (!(k in registry)) {
      problems.push(`${k}: a @converter export missing from the R27 registry`)
      continue
    }
    const { fn } = await exportOf(k)
    try {
      fn(...clone(registry[k]))
    } catch (e) {
      problems.push(`${k}: the R27 base arguments throw (${String(e)}); fix the registry`)
      continue
    }
    for (const slot of numericSlots(registry[k])) {
      for (const v of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const args = clone(registry[k])
        slot.set(args, v)
        try {
          fn(...args)
          problems.push(`${k}: ${slot.name} = ${String(v)} gave a value, not a RangeError`)
        } catch (e) {
          if (!(e instanceof RangeError)) problems.push(`${k}: ${slot.name} = ${String(v)} threw ${e?.constructor?.name ?? typeof e}, not RangeError`)
        }
      }
    }
  }
  return { checked: keys.size, problems }
}

// ---------- R24 and R30: writers read back what they were given ----------
const HEADER = { returnName: 'Riverdale Rentals Inc. (Test)', guid: '0aad6c0c-6444-466e-a247-ed6d63078cd2' }
const EXTREME_TEXT = fc.oneof(
  fc.constantFrom(`O'Brien (Test)`, 'say "hi" (Test)', `it's "quoted", isn't it`, "1'234", "12'", '-5', '1e+21', 'Café (Test)', 'a,b', 'x'),
  fc.string({ unit: fc.constantFrom('a', 'Z', ' ', "'", '"', ',', '.', '-', '1', 'é'), minLength: 1, maxLength: 12 }),
)
const writeValue = fc.oneof(
  fc.oneof(
    fc.constantFrom(Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 0, -0, 1e21, 1.5),
    fc.integer({ min: -(10 ** 15), max: 10 ** 15 }),
  ).map((amount) => ({ kind: 'amount', amount })),
  EXTREME_TEXT.map((text) => ({ kind: 'text', text })),
  fc.constantFrom('2026-10-02', '2024-02-29', '2025-02-29', '1999-12-31').map((date) => ({ kind: 'date', date })),
  fc.boolean().map((yes) => ({ kind: 'yesNo', yes })),
  fc.oneof(fc.constantFrom(0, 0.5, 0.1234, 0.12345, 1e21, 123456789012.3456, 15, 0.0001), fc.double({ min: 0, max: 1000, noNaN: true })).map((rate) => ({ kind: 'rate', rate })),
  fc.constant({ kind: 'clear' }),
)
function backEquals(v, back) {
  if (v === undefined) return back === null || back?.kind === 'clear'
  if (v.kind === 'clear') return back?.kind === 'clear'
  if (back?.kind !== 'value') return false
  if (v.kind === 'amount') return back.text === String(v.amount)
  if (v.kind === 'text') return back.text === v.text
  if (v.kind === 'date') return back.text === v.date
  if (v.kind === 'yesNo') return back.text === (v.yes ? 'Y' : 'N')
  return back.text === v.rate.toFixed(4)
}
const WRITES_REGISTRY = {
  'src/contracts/taxprep.ts#writeTaxprepCsv': {
    reader: 'parseTaxprepCsv',
    input: (m) =>
      fc.array(fc.tuple(fc.constantFrom('GFGBA.Ttwgba64', 'GFGBB.Ttwgbb1', 'CCACat.FD08C[1].Ttw08cA1'), writeValue, fc.option(writeValue, { nil: undefined })), { minLength: 1, maxLength: 4 }).map((rows) => ({
        header: HEADER,
        rows: rows.map(([id, current, last]) => {
          const parsed = m.parseCellId(id)
          return last === undefined ? { id: parsed.id, current } : { id: parsed.id, current, last }
        }),
      })),
    write: (m, file) => {
      const r = m.writeTaxprepCsv(file, { purpose: 'import' })
      return r.ok ? { ok: true, out: r.bytes } : { ok: false }
    },
    readBack: (m, file, bytes) => {
      const r = m.parseTaxprepCsv(bytes)
      if (!r.ok) return `the reader refused what was written: ${JSON.stringify(r.faults.map((f) => f.reason))}`
      if (r.file.rows.length !== file.rows.length) return 'the row count changed'
      for (const [i, row] of file.rows.entries()) {
        const b = r.file.rows[i]
        if (b.id.text !== row.id.text) return `row ${String(i)}: identifier ${b.id.text}`
        if (b.apostrophe) return `row ${String(i)}: read back with an apostrophe`
        if (!backEquals(row.current, b.current)) return `row ${String(i)}: ${JSON.stringify(row.current)} read back as ${JSON.stringify(b.current)}`
        if (!backEquals(row.last, b.last)) return `row ${String(i)}: last ${JSON.stringify(row.last)} read back as ${JSON.stringify(b.last)}`
      }
      return null
    },
    // R30: the module's read-back check, and planted mismatches it must refuse (R33: rates compare exact text).
    check: 'readBackMatches',
    mismatches: [
      ['an amount of 5 read back as "6"', { kind: 'amount', amount: 5 }, { ok: true, value: { kind: 'value', text: '6' }, apostrophe: false }],
      ['a text read back with an apostrophe', { kind: 'text', text: 'abc' }, { ok: true, value: { kind: 'value', text: 'abc' }, apostrophe: true }],
      ['a clear read back as a value', { kind: 'clear' }, { ok: true, value: { kind: 'value', text: '0' }, apostrophe: false }],
      ['a rate of 0.5 read back as "0.50"', { kind: 'rate', rate: 0.5 }, { ok: true, value: { kind: 'value', text: '0.50' }, apostrophe: false }],
      ['a rate of 0.5 read back as "5e-1"', { kind: 'rate', rate: 0.5 }, { ok: true, value: { kind: 'value', text: '5e-1' }, apostrophe: false }],
      ['an amount of 1 read back as "1.0"', { kind: 'amount', amount: 1 }, { ok: true, value: { kind: 'value', text: '1.0' }, apostrophe: false }],
    ],
  },
}
async function writesProblems(files, registry) {
  const problems = []
  const list = tagged(files, 'writes')
  for (const t of list) {
    const entry = registry[t.key]
    if (!entry) {
      problems.push(`${t.key}: a @writes export missing from the R24 registry`)
      continue
    }
    if (entry.reader !== t.arg) problems.push(`${t.key}: tagged @writes ${String(t.arg)}, registry says ${entry.reader}`)
    const mod = await load(t.file)
    const r = fc.check(
      fc.property(entry.input(mod), (input) => {
        const w = entry.write(mod, input)
        if (!w.ok) return true
        const why = entry.readBack(mod, input, w.out)
        if (why !== null) throw new Error(why)
        return true
      }),
      { seed: SEED, numRuns: 300 },
    )
    if (r.failed) problems.push(`${t.key}: read-back differs: ${String(r.errorInstance?.message ?? r.error)} for ${fc.stringify(r.counterexample?.[0])}`)
  }
  return { checked: list.length, problems }
}
async function readBackCheckProblems(files, registry) {
  const problems = []
  const list = tagged(files, 'writes')
  for (const t of list) {
    const entry = registry[t.key]
    const mod = await load(t.file)
    const checkName = entry?.check ?? Object.keys(mod).find((n) => /^readBack/.test(n))
    if (typeof mod[checkName] !== 'function') {
      problems.push(`${t.file}: a @writes module that exports no read-back check (readBack...)`)
      continue
    }
    if (!entry?.mismatches?.length) {
      problems.push(`${t.key}: no planted mismatch for its read-back check in the R30 registry`)
      continue
    }
    for (const [what, given, back] of entry.mismatches) {
      if (mod[checkName](given, back) !== false) problems.push(`${t.file}#${checkName}: ${what} is accepted`)
    }
  }
  return { checked: list.length, problems }
}

// ---------- R25: one home for Taxprep cell lists and descriptions ----------
function day2Descriptions() {
  const dir = 'reference/taxprep/2026-10-02-day2/exports'
  const out = new Set()
  for (const f of walk(dir).filter((x) => x.endsWith('.csv'))) {
    for (const line of fs.readFileSync(path.join(ROOT, f), 'latin1').split(/\r?\n/).slice(1)) {
      const m = /,"((?:[^"]|"")*)"\s*$/.exec(line)
      const d = m?.[1].replace(/""/g, '"') ?? ''
      if (d.length >= 8 && /[A-Za-z]{3}/.test(d) && /\s/.test(d)) out.add(d)
    }
  }
  return out
}
function taxprepListProblems(files, readFile, descriptions) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    const ids = new Set([...src.matchAll(/(['"`])((?:IDENT|IFirm)\.[A-Za-z0-9_.[\]]+)\1/g)].map((m) => m[2]))
    if (ids.size >= 2) problems.push(`${f}: holds a literal list of ${String(ids.size)} IDENT./IFirm. cell identifiers (they live in src/contracts/taxprep.ts)`)
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.){8,})'|"((?:[^"\\\n]|\\.){8,})"|`([^`\\]{8,})`/g)) {
      const s = m[1] ?? m[2] ?? m[3]
      if (descriptions.has(s)) problems.push(`${f}: holds the Taxprep description ${JSON.stringify(s)}`)
    }
  }
  return problems
}

// ---------- R28: one amount-format table ----------
const AMOUNT_PATTERNS = [
  /,\\{1,2}d\{3\}/, // ,\d{3}
  /\(\\{1,2}d\{3\}\)/, // (\d{3})
  /\\{1,2}d\{1,3\}/, // \d{1,3}
  /\[,? ?\]\\{1,2}d\{3\}/, // [, ]\d{3}
  /\\{1,2}\.\\{1,2}d\{2\}/, // \.\d{2}
  /\\{1,2}\.\\{1,2}d\\{1,2}d/, // \.\d\d
  /\\{1,2}\.\[0-9\]\{2\}/, // \.[0-9]{2}
]
function amountFormatProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    const hit = AMOUNT_PATTERNS.find((re) => re.test(src))
    if (hit) problems.push(`${f}: defines its own amount pattern (${String(hit)}); import from src/contracts/amount-grammar.ts`)
    const list = /export\s+const\s+(\w*FORMATS?\w*)\s*(?::[^=]*)?=\s*[[{][\s\S]{0,800}?\b(negative|thousands|brackets|trailing)\b/i.exec(src)
    if (list) problems.push(`${f}: exports its own amount format list ${list[1]}; use AMOUNT_FORMATS`)
  }
  return problems
}

// ---------- R29: the refusal ratchet ----------
const R29_RETIRED = { 'amount-grammar': [], taxprep: [], reading: [] }
function ratchetProblems(parser, inputs, isRefused, retired) {
  return inputs
    .filter((x) => !retired.includes(x.name))
    .filter((x) => !isRefused(x))
    .map((x) => `${parser}: ${JSON.stringify(x.name)} is no longer refused (name it in R29_RETIRED if that is meant)`)
}
const golden = (name) => JSON.parse(fix(`__golden__/${name}`))
const latin1Bytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0))

// ---------- R31: finding lists ----------
const anchorOf = (finding) => /^FINDINGS\.md, ([^:(]+?)\s*[:(]/.exec(finding)?.[1] ?? null
function findingListProblems(modules) {
  const lists = []
  for (const [file, mod] of modules) {
    for (const [name, v] of Object.entries(mod)) {
      if (Array.isArray(v) && v.length > 0 && v.every((e) => e && typeof e === 'object' && typeof e.finding === 'string')) lists.push({ key: `${file}#${name}`, list: v })
    }
  }
  const problems = []
  for (const { key, list } of lists) {
    const anchors = new Set(list.map((e) => anchorOf(e.finding)))
    if (anchors.has(null)) problems.push(`${key}: a finding with no "FINDINGS.md, <section>:" anchor`)
    if (anchors.size > 1) problems.push(`${key}: findings carry more than one anchor (${[...anchors].join(' | ')})`)
    if (new Set(list.map((e) => e.finding)).size !== list.length) problems.push(`${key}: the same finding string twice`)
  }
  for (let i = 0; i < lists.length; i++) {
    for (let j = i + 1; j < lists.length; j++) {
      const a = lists[i]
      const b = lists[j]
      if (a.list.some((e) => b.list.includes(e))) problems.push(`${a.key} and ${b.key} share an entry`)
      const fa = new Set(a.list.map((e) => e.finding))
      if (b.list.some((e) => fa.has(e.finding))) problems.push(`${a.key} and ${b.key} share a finding string`)
    }
  }
  return { checked: lists.length, problems }
}

// ---------- R32: the apostrophe rule is total over number-like text ----------
const R32_INPUTS = ["+1'234", "(1'234)", " 1'234", "1'234 ", "1'234e3", "--'12", '1’234', "1'234", "12'", "-12'", "1'2'3", "'1234"]
const CSV_HEAD = '[Riverdale Rentals Inc. (Test)|0|0|0aad6c0c-6444-466e-a247-ed6d63078cd2],"Current Year","Last Year",""\r\n'
const to1252 = (s) => s.replace(/’/g, '\x92')
function apostropheProblems(parse, inputs) {
  const problems = []
  for (const v of inputs) {
    const r = parse(latin1Bytes(`${CSV_HEAD}GFGBA.Ttwgba64,"${to1252(v)}","",""\r\n`))
    if (!r.ok) {
      if (!r.faults.every((f) => typeof f.code === 'string' && f.code !== '')) problems.push(`${JSON.stringify(v)}: refused without a named fault`)
      continue
    }
    const cur = r.file.rows[0]?.current
    if (cur?.kind === 'value' && /['’\x92]/.test(cur.text)) problems.push(`${JSON.stringify(v)}: passes as plain text ${JSON.stringify(cur.text)} (neither a number nor a named fault)`)
  }
  return problems
}

// ---------- R34: no real-looking personal data in test data (SEC-11) ----------
const luhn = (digits) =>
  [...digits].reverse().reduce((sum, c, i) => {
    let d = Number(c)
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    return sum + d
  }, 0) %
    10 ===
  0
const RESERVED_DOMAIN = /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/i
function piiProblems(file, text) {
  const problems = []
  for (const m of text.matchAll(/(?<![\w-])(\d{3})([ -]?)(\d{3})\2(\d{3})(?:\s?RT\s?\d{4})?(?![\w-])/g)) {
    const digits = m[1] + m[3] + m[4]
    if (/^0+$/.test(digits)) continue
    if (luhn(digits)) problems.push(`${file}: a Luhn-valid nine-digit number ${JSON.stringify(m[0])} (a SIN or business number shape)`)
  }
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g)) {
    if (!RESERVED_DOMAIN.test(m[1])) problems.push(`${file}: an e-mail outside the reserved domains ${JSON.stringify(m[0])}`)
  }
  for (const m of text.matchAll(/(?<![\d-])(?:\+?1[ .-]?)?\(?([2-9]\d{2})\)?[ .-]?(\d{3})[ .-](\d{4})(?![\d-])/g)) {
    if (!(m[2] === '555' && /^01\d\d$/.test(m[3]))) problems.push(`${file}: a phone number outside 555-01xx ${JSON.stringify(m[0])}`)
  }
  return problems
}
const TEXT_EXT = /\.(csv|json|md|txt|ts|tsx|mjs|js|sql|yml|yaml|html|xml|tsv)$/i
function testDataFiles() {
  return [
    ...walk('reference/sample-clients'),
    ...walk('testworld'),
    ...walk('').filter((f) => isFixture(f) && !f.startsWith('reference/sample-clients/')),
  ].filter((f) => TEXT_EXT.test(f) && !f.startsWith(`${FIX_REL}/`))
}

// ---------- R36: money is read from text ----------
function moneyFromNumberProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    if (/function\s+\w*[Dd]ollars?To\w*\s*\(\s*\w+\s*:\s*number\b/.test(src) || /\w*[Dd]ollars?ToCents\s*=\s*\(\s*\w+\s*:\s*number\b/.test(src)) {
      problems.push(`${f}: converts dollars held as a number to cents (read money from text)`)
    }
    if (/Math\.round\([^)]*\*\s*100\b/.test(src) || /parseFloat\(/.test(src)) problems.push(`${f}: float dollars to cents (Math.round(x * 100) or parseFloat)`)
  }
  return problems
}

// ---------- R37: byte-compared files are not normalised by git ----------
const BYTE_COMPARED = (f) => isFixture(f) || /(^|\/)taxprep\/.*\.csv$/.test(f)
function eolProblems(lines) {
  const problems = []
  for (const line of lines) {
    const m = /^i\/(\S*)\s+w\/(\S*)\s+attr\/(.*?)\s*\t(.+)$/.exec(line)
    if (!m) continue
    const [, index, , attr, file] = m
    if (!BYTE_COMPARED(file)) continue
    const raw = /(^|\s)-text\b/.test(attr) || /\bbinary\b/.test(attr)
    if (!raw) problems.push(`${file}: byte-compared but git may rewrite its line ends (attr ${attr.trim() || 'none'}; make it -text or binary)`)
    else if (/eol=/.test(attr)) problems.push(`${file}: -text with an eol setting`)
    if (!raw && index.includes('crlf') && /eol=lf|text=auto|(^|\s)text\b/.test(attr)) problems.push(`${file}: CRLF in the index under ${attr.trim()}`)
  }
  return problems
}

// ---------- R38: no non-UTF-8 decoders building expected bytes; Node 24 at setup ----------
function decoderProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    for (const m of src.matchAll(/new\s+TextDecoder\s*\(\s*(['"`])([^'"`]+)\1/g)) {
      if (!/^utf-?8$/i.test(m[2])) problems.push(`${f}: a TextDecoder for ${m[2]} (its table differs between Node versions)`)
    }
    if (/new\s+TextEncoder\s*\(\s*['"`]/.test(src)) problems.push(`${f}: new TextEncoder with an encoding argument`)
  }
  return problems
}

// ---------- R41: one blank definition (file side) ----------
function blankRuleProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    if (f.endsWith('src/contracts/text.ts')) continue
    const src = readFile(f)
    if (/\.trim\(\)/.test(src)) problems.push(`${f}: a .trim() blank rule (non-blank goes through src/contracts/text.ts)`)
    if (/z\s*\.\s*string\(\)(?:\s*\.\s*\w+\([^)]*\))*?\s*\.\s*min\(\s*1\s*[,)]/.test(src)) problems.push(`${f}: a z.string().min(1) non-blank rule (use NonBlankSchema)`)
  }
  return problems
}

// =====================================================================================================
describe('SC R15 to R18: schema and contract rules on files (EV-8, EV-10, FLOW-1, EV-5, ARC-15)', () => {
  test('EV-8 EV-10 FLOW-1 R15 rule: a planted status enum with one value missing is caught (list side)', async () => {
    const mod = await import(pathToFileURL(path.join(FIX, 'planted-r15-lists.mjs')).href)
    const r = listSideProblems(mod, 'planted-r15-lists.mjs')
    expect(r.problems.some((p) => p.includes('PlantRecordSchema.status'))).toBe(true)
    expect(r.problems.some((p) => p.includes('PlantRecordSchema.origin'))).toBe(false)
    expect(r.problems.some((p) => p.includes('PlantFreeTextSchema.state'))).toBe(true)
  })
  test('EV-8 EV-10 FLOW-1 R15 every state, *_state, status, origin and entry_type field in records.ts is an enum equal to a records.ts list', async () => {
    expect(exists('src/contracts/records.ts'), 'nothing to check: src/contracts/records.ts (F01) is not on main').toBe(true)
    const r = listSideProblems(await load('src/contracts/records.ts'), 'src/contracts/records.ts')
    expect(r.checked, 'nothing to check: no state, status, origin or entry_type field in records.ts').toBeGreaterThan(0)
    expect(onlyKnown('R15', r.problems)).toEqual([])
  })

  test('FLOW-1 R16 rule: a planted view ordering state events by created_at then id is caught; seq first passes', () => {
    expect(orderByProblems(['planted-r16-view.sql.txt'], fix)).toHaveLength(1)
    expect(orderByProblems(['clean-r16-view.sql.txt'], fix)).toEqual([])
  })
  test('FLOW-1 R16 no order by created_at or id in the schema folder or src/modules unless an identity seq comes first', () => {
    const schemaFiles = walk(['db', 'schema'].join('/')).filter((f) => f.endsWith('.sql'))
    const files = [...schemaFiles, ...productTs(['src/modules'])]
    expect(onlyKnown('R16', orderByProblems(files, read))).toEqual([])
  })

  test('EV-5 R17 rule: a planted contract with its own {x0,y0,x1,y1} box is caught, in the schema and in the text', async () => {
    const { BoxSchema } = await load('src/contracts/reading.ts')
    const mod = await import(pathToFileURL(path.join(FIX, 'planted-r17-box.mjs')).href)
    const entries = Object.entries(mod).map(([name, schema]) => ({ key: `planted-r17-box.mjs#${name}`, schema }))
    const problems = boxProblems(entries, BoxSchema)
    expect(problems.some((p) => p.includes('x0, y0, x1, y1'))).toBe(true)
    expect(problems.some((p) => p.includes('CitationSchema.box'))).toBe(true)
    expect(boxTextProblems(['planted-r17-box.mjs'], fix)).toHaveLength(1)
    expect(boxProblems([{ key: 'reading#WordSchema', schema: (await load('src/contracts/reading.ts')).WordSchema }], BoxSchema)).toEqual([])
  })
  test('EV-5 R17 one box shape: no x0/y0/x1/y1 object in src/contracts and every box field is F09\'s BoxSchema', async () => {
    const { BoxSchema } = await load('src/contracts/reading.ts')
    const entries = await exportedSchemas(contractFiles())
    const problems = [...boxProblems(entries, BoxSchema), ...boxTextProblems(productTs(['src/contracts']), read)]
    expect(onlyKnown('R17', problems)).toEqual([])
  })

  test('ARC-15 R18 rule: a core card\'s unmarked file fails; the same file under a non-core card passes', () => {
    const files = ['src/contracts/planted-unmarked.ts', 'src/contracts/planted-unmarked.test.ts']
    const head = () => fix('planted-r18-unmarked.ts.txt')
    const core = cardMeta(fix('planted-r18-core-card.md.txt'))
    const noncore = cardMeta(fix('planted-r18-noncore-card.md.txt'))
    expect(core.core).toBe(true)
    expect(noncore.core).toBe(false)
    expect(coreUnmarkedProblems([core], files, head)).toEqual([
      'src/contracts/planted-unmarked.ts: a core card lists it, but it has no // @mutate in its first 5 lines',
    ])
    expect(coreUnmarkedProblems([noncore], files, head)).toEqual([])
    expect(coreUnmarkedProblems([core], files, () => `// @mutate\n${head()}`)).toEqual([])
  })
  test('ARC-15 R18 every core file under src/contracts and src/modules carries // @mutate in its first 5 lines (cards, not slices.json)', () => {
    const cards = walk('plan/cards').filter((f) => f.endsWith('.md')).map((f) => cardMeta(read(f)))
    expect(cards.filter((c) => c.core).length, 'no core card found').toBeGreaterThan(0)
    const files = walk('src')
    expect(onlyKnown('R18', coreUnmarkedProblems(cards, files, read))).toEqual([])
  })
})

describe('SC R14 and R23: contract schemas (ARC-10, EV-5, AI-1)', () => {
  test('ARC-10 R14 rule: a planted VersionStampSchema that accepts {"x":null} is caught', async () => {
    const mod = await import(pathToFileURL(path.join(FIX, 'planted-r14-stamp.mjs')).href)
    const r = stampProblems([{ key: 'planted#VersionStampSchema', schema: mod.VersionStampSchema }])
    expect(r.problems).toEqual(['planted#VersionStampSchema accepts {"x":null}', 'planted#VersionStampSchema accepts {"x":""}'])
  })
  test('ARC-10 R14 every zod VersionStampSchema in src/contracts refuses {}, {"x":null} and {"x":""}', async () => {
    const r = stampProblems(await exportedSchemas(contractFiles()))
    expect(r.checked, 'nothing to check: no VersionStampSchema in src/contracts (F01 brings records.ts)').toBeGreaterThan(0)
    expect(onlyKnown('R14', r.problems)).toEqual([])
  })

  test('EV-5 AI-1 R23 rule: a planted contract whose nested object is plain z.object is caught at that depth only', async () => {
    const mod = await import(pathToFileURL(path.join(FIX, 'planted-r23-loose.mjs')).href)
    const problems = strayKeyProblems([
      { key: 'planted#PlantedEnvelopeSchema', schema: mod.PlantedEnvelopeSchema },
      { key: 'planted#PlantedStrictSchema', schema: mod.PlantedStrictSchema },
    ])
    expect(problems).toEqual(['planted#PlantedEnvelopeSchema: a stray key is accepted at inner'])
  })
  test('EV-5 AI-1 R23 rule: a schema whose nested object no sample reaches is reported, never passed', async () => {
    const { z } = await import('zod')
    const s = z.strictObject({ a: z.string() }).refine(() => false)
    expect(strayKeyProblems([{ key: 'planted#Unreachable', schema: s }])).toEqual([
      'planted#Unreachable: no valid sample reaches the object at (top); add one to R23_SAMPLES',
    ])
  })
  test('EV-5 AI-1 R23 every exported zod schema in src/contracts (env.ts excluded) refuses a stray key at every depth at runtime', async () => {
    const entries = await exportedSchemas(contractFiles())
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((e) => e.key === 'src/contracts/reading.ts#ReadingResultSchema')).toBe(true)
    expect(onlyKnown('R23', strayKeyProblems(entries, R23_SAMPLES))).toEqual([])
  })
})

describe('SC R24 to R28: money, converters, writers and the Taxprep tables (EV-6, EV-5, RT-3, ARC-14, RT-13, RT-23, ARC-8)', () => {
  test('EV-6 R26 rule: a planted @money function that returns -0 for "(0.00)" is caught', async () => {
    const key = `${FIX_REL}/planted-r26-money.mjs#plantedReadAmount`
    const r = await moneyProblems([`${FIX_REL}/planted-r26-money.mjs`], {
      [key]: () => fc.tuple(fc.constantFrom('1.00', '(1.00)', '(0.00)', '0.00')),
    })
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toMatch(/plantedReadAmount: returns -0 for \[\s*"\(0\.00\)"\s*\]/)
  })
  test('EV-6 R26 rule: a @money export missing from the registry fails, and so does a registry entry whose export lacks the tag', async () => {
    const file = `${FIX_REL}/planted-r26-money.mjs`
    const r = await moneyProblems([file], { [`${file}#plantedUntagged`]: () => fc.tuple(fc.string()) })
    expect(r.problems).toContain(`${file}#plantedReadAmount: a @money export missing from the R26 registry`)
    expect(r.problems).toContain(`${file}#plantedUntagged: in the R26 registry but its export has no @money tag`)
  })
  test('EV-6 R26 no @money function under src/contracts and src/modules returns -0 (fixed seed), and the tag set is never empty', async () => {
    const r = await moneyProblems(CONTRACT_AND_MODULE_FILES(), MONEY_REGISTRY)
    expect(r.checked).toBeGreaterThan(0)
    expect(tagged(CONTRACT_AND_MODULE_FILES(), 'money').map((t) => t.key)).toContain('src/contracts/amount-grammar.ts#normaliseAmount')
    expect(onlyKnown('R26', r.problems)).toEqual([])
  })

  test('EV-5 R27 rule: a planted converter that passes NaN through to a schema is caught', async () => {
    const file = `${FIX_REL}/planted-r27-converter.mjs`
    const r = await converterProblems([file], { [`${file}#plantedPixelsToBox`]: [1, { x: 10, y: 10, width: 20, height: 20 }, 100, 100] }, [])
    expect(r.problems.some((p) => /argument 1\.x = NaN threw ZodError, not RangeError/.test(p))).toBe(true)
    expect(r.problems.some((p) => /argument 2 = Infinity gave a value, not a RangeError/.test(p))).toBe(true)
  })
  test('EV-5 R27 every @converter in src/contracts throws RangeError for NaN, Infinity and -Infinity in each numeric field; F09\'s two converters carry the tag', async () => {
    const r = await converterProblems(productTs(['src/contracts']), CONVERTER_ARGS, CONVERTERS_NAMED)
    expect(r.checked).toBeGreaterThanOrEqual(2)
    expect(onlyKnown('R27', r.problems)).toEqual([])
  })

  test('RT-3 ARC-14 R24 rule: a planted writer that prints 1e+21 is caught by the read-back property', async () => {
    const file = `${FIX_REL}/planted-r24-writer.mjs`
    const registry = {
      [`${file}#plantedWrite`]: {
        reader: 'plantedRead',
        input: () => fc.oneof(fc.constantFrom(1e21, 0, 12), fc.integer()),
        write: (m, n) => ({ ok: true, out: m.plantedWrite(n) }),
        readBack: (m, n, text) => (m.plantedRead(text) === n ? null : `${String(n)} read back as ${String(m.plantedRead(text))}`),
      },
    }
    const r = await writesProblems([file], registry)
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toMatch(/1e\+21 read back as null/)
    expect((await writesProblems([file], {})).problems).toEqual([`${file}#plantedWrite: a @writes export missing from the R24 registry`])
  })
  test('RT-3 ARC-14 R24 every @writes export reads back what it was given (fixed seed, extreme values)', async () => {
    const r = await writesProblems(CONTRACT_AND_MODULE_FILES(), WRITES_REGISTRY)
    expect(r.checked, 'no @writes export found (F03R tags writeTaxprepCsv first)').toBeGreaterThan(0)
    expect(onlyKnown('R24', r.problems)).toEqual([])
  })
  test('RT-3 ARC-14 R30 rule: a planted read-back check that always returns true is caught', async () => {
    const file = `${FIX_REL}/planted-r24-writer.mjs`
    const r = await readBackCheckProblems([file], {
      [`${file}#plantedWrite`]: { check: 'readBackPlanted', mismatches: [['12 read back as 13', 12, 13]] },
    })
    expect(r.problems).toEqual([`${file}#readBackPlanted: 12 read back as 13 is accepted`])
  })
  test('RT-3 ARC-14 R30 R33 every @writes module exports its read-back check and refuses each planted mismatch (rates compare exact text against toFixed(4))', async () => {
    const r = await readBackCheckProblems(CONTRACT_AND_MODULE_FILES(), WRITES_REGISTRY)
    expect(r.checked).toBeGreaterThan(0)
    expect(onlyKnown('R30', r.problems)).toEqual([])
  })

  test('RT-13 RT-23 R25 rule: a planted simulator with its own list of the eight creation cells and a day 2 description is caught', () => {
    const problems = taxprepListProblems(['planted-r25-sim.ts.txt'], fix, day2Descriptions())
    expect(problems.some((p) => p.includes('literal list of 8 IDENT./IFirm.'))).toBe(true)
    expect(problems.some((p) => p.includes('"Account - Land improvements"'))).toBe(true)
  })
  test('RT-13 RT-23 R25 no product .ts under src other than taxprep.ts holds a literal cell list or a day 2 description', () => {
    const d = day2Descriptions()
    expect(d.size).toBeGreaterThan(50)
    const files = productTs(['src']).filter((f) => f !== 'src/contracts/taxprep.ts')
    expect(onlyKnown('R25', taxprepListProblems(files, read, d))).toEqual([])
  })

  test('ARC-8 EV-6 R28 rule: a planted renderer with its own format list and its own amount regex is caught', () => {
    const problems = amountFormatProblems(['planted-r28-renderer.ts.txt'], fix)
    expect(problems.some((p) => p.includes('own amount pattern'))).toBe(true)
    expect(problems.some((p) => p.includes('STATEMENT_FORMATS'))).toBe(true)
  })
  test('ARC-8 EV-6 R28 one amount-format table: no product file under src, testworld or e2e except amount-grammar.ts defines an amount pattern or format list', () => {
    const files = ['src', 'testworld', 'e2e']
      .flatMap((d) => walk(d))
      .filter((f) => /\.(ts|tsx|mts|mjs|js)$/.test(f) && !isFixture(f) && !isTest(f) && f !== 'src/contracts/amount-grammar.ts')
    expect(onlyKnown('R28', amountFormatProblems(files, read))).toEqual([])
  })
})

describe('SC R29 to R33: parsers and finding lists (RT-3, RT-9, EV-6, RT-13, RT-23)', () => {
  test('RT-9 R29 rule: a parser with a deleted branch is caught by the ratchet', async () => {
    const { normaliseAmount } = await load('src/contracts/amount-grammar.ts')
    const weakened = (t) => (t === '1.2E3' ? { ok: true, cents: 120000 } : normaliseAmount(t))
    const inputs = golden('refused-amount-grammar.json').inputs.map((t) => ({ name: t }))
    expect(ratchetProblems('normaliseAmount', inputs, (x) => !weakened(x.name).ok, [])).toEqual([
      'normaliseAmount: "1.2E3" is no longer refused (name it in R29_RETIRED if that is meant)',
    ])
    expect(ratchetProblems('normaliseAmount', inputs, (x) => !weakened(x.name).ok, ['1.2E3'])).toEqual([])
  })
  test('EV-6 R29 amount-grammar: every input in the refusal golden is still refused', async () => {
    const { normaliseAmount } = await load('src/contracts/amount-grammar.ts')
    const inputs = golden('refused-amount-grammar.json').inputs.map((t) => ({ name: t }))
    expect(inputs.length).toBeGreaterThan(40)
    expect(ratchetProblems('normaliseAmount', inputs, (x) => !normaliseAmount(x.name).ok, R29_RETIRED['amount-grammar'])).toEqual([])
  })
  test('RT-9 R29 taxprep: every file in the refusal golden is still refused', async () => {
    const { parseTaxprepCsv } = await load('src/contracts/taxprep.ts')
    const inputs = golden('refused-taxprep.json').inputs
    expect(inputs.length).toBeGreaterThan(20)
    expect(ratchetProblems('parseTaxprepCsv', inputs, (x) => !parseTaxprepCsv(latin1Bytes(x.latin1)).ok, R29_RETIRED.taxprep)).toEqual([])
  })
  test('EV-5 R29 reading: every value in the refusal golden is still refused by its schema', async () => {
    const reading = await load('src/contracts/reading.ts')
    const inputs = golden('refused-reading.json').inputs
    expect(inputs.length).toBeGreaterThan(30)
    expect(ratchetProblems('reading', inputs, (x) => !reading[x.schema].safeParse(x.value).success, R29_RETIRED.reading)).toEqual([])
  })

  test('RT-13 RT-23 R31 rule: a planted finding list built by spreading another is caught', async () => {
    const mod = await import(pathToFileURL(path.join(FIX, 'planted-r31-lists.mjs')).href)
    const r = findingListProblems([['planted', mod]])
    expect(r.problems).toContain('planted#PLANT_SKIPPED and planted#PLANT_LISTED share an entry')
    expect(r.problems).toContain('planted#PLANT_SKIPPED and planted#PLANT_LISTED share a finding string')
    expect(r.problems.some((p) => p.startsWith('planted#PLANT_LISTED: findings carry more than one anchor'))).toBe(true)
  })
  test('RT-13 RT-23 R31 no two exported finding lists share an entry or a finding string, and each list carries one anchor', async () => {
    const modules = []
    for (const f of CONTRACT_AND_MODULE_FILES()) modules.push([f, await load(f)])
    const r = findingListProblems(modules)
    expect(r.checked).toBeGreaterThanOrEqual(2)
    expect(onlyKnown('R31', r.problems)).toEqual([])
  })

  test('RT-3 R32 rule: a parser that passes number-like text with an apostrophe as plain text is caught', () => {
    const lax = (bytes) => ({ ok: true, file: { rows: [{ current: { kind: 'value', text: Buffer.from(bytes).toString('latin1').split('\r\n')[1].split(',')[1].slice(1, -1) } }] } })
    expect(apostropheProblems(lax, ["+1'234"])).toEqual([`"+1'234": passes as plain text "+1'234" (neither a number nor a named fault)`])
  })
  test("RT-3 R32 the apostrophe rule is total over number-like text: +1'234, (1'234), spaced, 1'234e3, --'12 and 1’234 read as a number or raise a named fault", async () => {
    const { parseTaxprepCsv } = await load('src/contracts/taxprep.ts')
    expect(onlyKnown('R32', apostropheProblems(parseTaxprepCsv, R32_INPUTS))).toEqual([])
  })
})

describe('SC R34 to R45: test data, money from text, line ends, blanks, pages and sensitive keys (SEC-11, EV-6, EV-1, SEC-4)', () => {
  test('SEC-11 R34 rule: a planted SIN (plain, spaced, hyphenated), business number, e-mail and phone are caught; the clean line is not', () => {
    const problems = piiProblems('planted', fix('planted-r34-pii.txt'))
    expect(problems.filter((p) => p.includes('Luhn-valid'))).toHaveLength(4)
    expect(problems.filter((p) => p.includes('e-mail'))).toEqual(['planted: an e-mail outside the reserved domains "jordan.lee@realmail.ca"'])
    expect(problems.filter((p) => p.includes('phone'))).toEqual(['planted: a phone number outside 555-01xx "(416) 555-2368"'])
  })
  test('SEC-11 R34 sample clients, testworld, fixtures and goldens hold no Luhn-valid nine digits, real e-mail or real phone', () => {
    const files = testDataFiles()
    expect(files.length).toBeGreaterThan(50)
    expect(onlyKnown('R34', files.flatMap((f) => piiProblems(f, read(f))))).toEqual([])
  })

  test('EV-6 R36 rule: a planted dollarsToCents(number) with Math.round(x * 100) is caught', () => {
    expect(moneyFromNumberProblems(['planted-r36-money.ts.txt'], fix)).toHaveLength(2)
  })
  test('EV-6 R36 money is read from text only: no dollarsToCents(number) and no float dollars to cents in src', () => {
    expect(onlyKnown('R36', moneyFromNumberProblems(productTs(['src', 'testworld']), read))).toEqual([])
  })

  test('RT-9 R37 rule: a planted CRLF CSV under eol=lf is caught; a -text golden is not', () => {
    const lines = [
      'i/crlf  w/crlf  attr/text=auto eol=lf \treference/sample-clients/99-planted/taxprep/import.csv',
      'i/crlf  w/crlf  attr/-text            \tsrc/contracts/__golden__/made-up-return.csv',
      'i/lf    w/lf    attr/text=auto eol=lf \tREADME.md',
    ]
    const problems = eolProblems(lines)
    expect(problems.some((p) => p.startsWith('reference/sample-clients/99-planted/taxprep/import.csv: CRLF in the index'))).toBe(true)
    expect(problems.every((p) => p.startsWith('reference/sample-clients/99-planted/'))).toBe(true)
  })
  test('RT-9 R37 every byte-compared file (taxprep CSVs, goldens, fixtures) is -text or binary and git ls-files --eol agrees', () => {
    const out = execFileSync('git', ['ls-files', '--eol'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const lines = out.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(100)
    expect(onlyKnown('R37', eolProblems(lines))).toEqual([])
  })

  test('RT-9 R38 rule: the planted old ALPHABET loop with TextDecoder(windows-1252) is caught', () => {
    expect(decoderProblems(['planted-r38-decoder.test.ts.txt'], fix)).toHaveLength(1)
  })
  test('RT-9 R38 no test builds expected bytes with a non-UTF-8 TextDecoder or TextEncoder, and setup fails below Node 24', () => {
    const tests = ['src', 'tools', 'testworld', 'e2e', 'design'].flatMap((d) => walk(d)).filter((f) => isTest(f) && !isFixture(f))
    const problems = decoderProblems(tests, read)
    const config = read('vitest.config.ts')
    const setups = [...config.matchAll(/setupFiles:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]))
    const guarded = setups.some((s) => exists(s) && /process\.versions\.node/.test(read(s)) && /24/.test(read(s)))
    if (!guarded) problems.push('no Vitest setup file refuses a Node major below 24')
    expect(onlyKnown('R38', problems)).toEqual([])
  })

  test('EV-6 R39 amountGroups never joins words from two pages ("1" on page 1, "234.56" on page 2)', async () => {
    const { amountGroups } = await load('src/contracts/amount-grammar.ts')
    const w = (text, page, left, order) => ({ text, box: { page, left, top: 0.1, width: 0.05, height: 0.02 }, confidence: 1, order })
    const groups = amountGroups([w('1', 1, 0.5, 0), w('234.56', 2, 0.56, 1)])
    const problems = groups.some((g) => g.cents === 123456 || new Set(g.words.map((x) => x.box.page)).size > 1)
      ? [`amountGroups joins words from two pages: ${JSON.stringify(groups.map((g) => g.cents))}`]
      : []
    expect(onlyKnown('R39', problems)).toEqual([])
  })

  test('EV-6 AI-4 R40 a word made only of invisible characters is blank everywhere WordSchema is used', async () => {
    const { WordSchema, ReadingResultSchema } = await load('src/contracts/reading.ts')
    const INVISIBLE = { Cf: '​', Cc: '\u0001', 'U+034F': '͏', 'U+3164': 'ㅤ', 'U+2800': '⠀', NBSP: ' ', 'U+3000': '　', 'Cf and space': ' ⁠ ' }
    const box = { page: 1, left: 0.1, top: 0.1, width: 0.1, height: 0.02 }
    const problems = []
    for (const [name, text] of Object.entries(INVISIBLE)) {
      const word = { text, box, confidence: 1, order: 0 }
      if (WordSchema.safeParse(word).success) problems.push(`src/contracts/reading.ts#WordSchema accepts a word of ${name}`)
      const result = { documentFingerprint: 'fp (Test)', engine: { name: 'e', version: '1' }, readAt: '2026-10-02T12:00:00-04:00', pageCount: 1, pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }], words: [word] }
      if (ReadingResultSchema.safeParse(result).success) problems.push(`src/contracts/reading.ts#WordSchema accepts ${name} inside ReadingResultSchema`)
    }
    expect(onlyKnown('R40', problems)).toEqual([])
  })

  test('EV-1 R41 rule: a planted .trim() blank rule and z.string().trim().min(1) are caught', () => {
    expect(blankRuleProblems(['planted-r41-blank.ts.txt'], fix)).toHaveLength(2)
  })
  test('EV-1 R41 one blank definition: no .trim() or z.string().min(1) non-blank rule in src/contracts or src/modules (text.ts is the one)', () => {
    expect(onlyKnown('R41', blankRuleProblems(CONTRACT_AND_MODULE_FILES(), read))).toEqual([])
  })

  test('SEC-4 R45 the sensitive-key name rule covers bank transit, institution and account numbers, date of birth, SIN and business number', async () => {
    const { sensitiveKindForKey } = await load('src/contracts/facts.ts')
    const keys = [
      'corp.bank.bank_transit', 'corp.bank.institution_no', 'corp.bank.account_number', 'owner.person.dob',
      'owner.person.date_of_birth', 'owner.person.sin', 'corp.identity.business_number', 'corp.bank.transit_number',
    ]
    const problems = keys.filter((k) => sensitiveKindForKey(k) === 'none').map((k) => `sensitiveKindForKey("${k}") is "none"`)
    expect(sensitiveKindForKey('corp.identity.legal_name')).toBe('none')
    expect(onlyKnown('R45', problems)).toEqual([])
  })
  test('SEC-4 R45 the fact catalogue loader refuses duplicate enum options', async () => {
    const { loadFactCatalogue } = await load('src/contracts/facts.ts')
    const entry = {
      ...R23_SAMPLES['src/contracts/facts.ts#factEntrySchema'][0],
      key: 'corp.identity.language',
      valueType: 'enum',
      options: ['en', 'fr', 'en'],
    }
    expect(loadFactCatalogue({ entries: [{ ...entry, options: ['en', 'fr'] }] }).ok).toBe(true)
    const problems = loadFactCatalogue({ entries: [entry] }).ok ? ['loadFactCatalogue accepts duplicate enum options'] : []
    expect(onlyKnown('R45-enum', problems)).toEqual([])
  })
})
