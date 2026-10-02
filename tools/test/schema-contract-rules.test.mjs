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
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { luhnValid } from '../../reference/sample-clients/lib/util.mjs'

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
  { rule: 'R41', match: /^src\/contracts\/(reading|facts|checks|taxprep|amount-grammar)\.ts: /, owner: 'the file owner (F09B reading, E03 facts, F05M checks, F03R taxprep, F09A amount-grammar); F01 brings text.ts' },
  { rule: 'R45', match: /^sensitiveKindForKey\("[^"]+"\) is "none"/, owner: 'E03' },
  { rule: 'R45-enum', match: /^loadFactCatalogue accepts duplicate enum options/, owner: 'E03' },
  // Found when the spec was refitted on main 6d8efd6 (2 Oct, cloud-18d04e); each is added to its owner card.
  { rule: 'R15', match: /^src\/contracts\/records\.ts#ExceptionRecordSchema\.status: /, owner: 'F01 family (records.ts and 70_checks.sql: exceptions.status has no list)' },
  { rule: 'R16', match: /^src\/modules\/lifecycle\/index\.ts: "order by occurred_at, id/, owner: 'F02 (order waits by the events identity seq)' },
  { rule: 'R18', match: /^src\/modules\/gaps\/index\.ts: /, owner: 'G00 or G02 (core cards that list gaps/index.ts; G01 landed it unmarked)' },
  { rule: 'R23', match: /^src\/contracts\/records\.ts#\w+RecordSchema: a stray key is accepted at \(top\)$/, owner: 'F01 family (records.ts record schemas use plain z.object)' },
  { rule: 'R23', match: /^src\/contracts\/lifecycle\.ts#(ApprovalFingerprintSchema|ChangedItemSchema): a stray key is accepted at /, owner: 'F02' },
  { rule: 'R41', match: /^src\/modules\/gaps\/bank\/index\.ts: /, owner: 'G01 (.trim() and z.string().min(1) in the question bank loader)' },
  { rule: 'R49', match: /^src\/contracts\/reading\.ts: a z\.string\(\)\.trim\(\) transform/, owner: 'F09B (engine name and version, reading.ts:48-49)' },
  { rule: 'R45-cite', match: /^loadFactCatalogue accepts a cra_form cite that is free text/, owner: 'E03 (the loader does not enforce the cite patterns; only tests do)' },
  // Found by the SC build on main fae1588 and later (2 Oct 20:45Z, reports/SC-build.md); owner FX3 fixes each and deletes its entry.
  { rule: 'R16', match: /^src\/modules\/jobs\/queue\.ts: "order by created_at, id/, owner: 'FX3 (F06 queue.ts: order by the identity seq first)' },
  { rule: 'R18', match: /^src\/(contracts\/jobs\.ts|modules\/bridge\/run\.ts|modules\/gaps\/bank\/index\.ts|modules\/jobs\/queue\.ts): a core card lists it, but it has no \/\/ @mutate/, owner: 'FX3 (F06 jobs.ts and queue.ts, F07 run.ts, G01 gaps/bank/index.ts: add the marker)' },
  { rule: 'R23', match: /^src\/contracts\/jobs\.ts#JobSchema: a stray key is accepted at \(top\)$/, owner: 'FX3 (F06 jobs.ts: .strict())' },
  { rule: 'R41', match: /^src\/modules\/bridge\/run\.ts: a \.trim\(\) blank rule/, owner: 'FX3 (F07 run.ts: go through src/contracts/text.ts)' },
  { rule: 'R54', match: /^A01: a zero-size MediaBox under statement \(Test\)\.pdf was not refused with a reason/, owner: 'A01 successor (A01-check-r3 note: a raw ZodError from ReadingResultSchema)' },
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
const AT = new Date(Date.UTC(2026, 9, 2, 16))
const RECORD = { created_at: AT, is_test: true, return_id: 'r-1' }
const R23_SAMPLES = {
  'src/contracts/records.ts#FactRecordSchema': [
    {
      id: 'f-1', ...RECORD, fact_key: 'corp.identity.legal_name', version_no: 1, value: 'Riverdale Rentals Inc. (Test)',
      source_document_id: 'd-1', source_page: 1, source_box: { left: 0.1, top: 0.1, width: 0.2, height: 0.02 },
      source_sheet: null, source_row: null, source_column: null, source_qbo_snapshot_id: null, source_qbo_account_id: null,
      source_qbo_txn_id: null, source_client_answer_id: null, source_cra_capture_id: null, source_prior_return_id: null,
      source_reason: null, origin: 'third_party', method: null, status: 'proposed', version_stamp: { catalogue: 'v1' },
    },
  ],
  'src/contracts/records.ts#AdjustingEntryRecordSchema': [
    {
      id: 'a-1', ...RECORD, qbo_snapshot_id: 's-1', qbo_txn_id: 't-1', entry_type: 'reclass', reason: 'reclass (Test)',
      sources: ['statement page 1 (Test)'], author: 'preparer (Test)', explained: true, version_no: 1,
    },
  ],
  'src/contracts/records.ts#FigureRecordSchema': [
    { id: 'g-1', ...RECORD, figure_key: 'net_income', cell_id: null, value: '1', version_stamp: { catalogue: 'v1' } },
  ],
  'src/contracts/records.ts#CheckResultRecordSchema': [
    { id: 'c-1', ...RECORD, check_id: 'CK-1', outcome: 'pass', version_stamp: { catalogue: 'v1' } },
  ],
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
// One Luhn (R50): the check digit comes from reference/sample-clients/lib/util.mjs, never a copy here.
const SEP = '[ \\-.\\u00A0\\u2009\\u202F\\u2010-\\u2015]?'
const NINE_DIGITS = new RegExp(`(?<![\\w-])(?<!\\d[.,])(\\d{3})${SEP}(\\d{3})${SEP}(\\d{3})(?:\\s?RT\\s?\\d{4})?(?![\\w-])(?![.,]\\d)`, 'g')
const NINE_EXPONENT = /(?<![\w.])(\d)\.(\d{1,8})[eE]\+?8(?![\w.])/g
const RESERVED_DOMAIN = /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/i
function piiProblems(file, text, check = luhnValid) {
  const problems = []
  for (const m of text.matchAll(NINE_DIGITS)) {
    const digits = m[1] + m[2] + m[3]
    if (/^0+$/.test(digits)) continue
    if (check(digits)) problems.push(`${file}: a Luhn-valid nine-digit number ${JSON.stringify(m[0])} (a SIN or business number shape)`)
  }
  for (const m of text.matchAll(NINE_EXPONENT)) {
    const digits = m[1] + m[2].padEnd(8, '0')
    if (check(digits)) problems.push(`${file}: a Luhn-valid nine-digit number in exponent form ${JSON.stringify(m[0])}`)
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
// Binary fixtures are allowed only on this reasoned list (findings W00 r2); they are still scanned as Latin-1 text.
const BINARY_FIXTURES = [
  { match: /^src\/modules\/ocr\/textlayer\/__fixtures__\/[a-z-]+\.pdf$/, reason: 'A01: PDFs written by make-fixtures.ts in raw PDF syntax from made-up lines' },
  { match: /^src\/modules\/storage\/__fixtures__\/drive-[a-z0-9-]+\/.+\.pdf$/, reason: 'A05: placeholder PDFs of under 100 bytes holding one made-up comment line' },
]
function testDataFiles() {
  return [
    ...walk('reference/sample-clients'),
    ...walk('testworld'),
    ...walk('').filter((f) => isFixture(f) && !f.startsWith('reference/sample-clients/')),
  ].filter((f) => !f.startsWith(`${FIX_REL}/`))
}
function binaryListProblems(files) {
  return files
    .filter((f) => !TEXT_EXT.test(f) && !BINARY_FIXTURES.some((b) => b.match.test(f)))
    .map((f) => `${f}: a binary test-data file not on the reasoned BINARY_FIXTURES list`)
}
const readLatin1 = (rel) => fs.readFileSync(path.join(ROOT, rel), 'latin1')
const dataText = (f) => (TEXT_EXT.test(f) ? read(f) : readLatin1(f))
/** R34 widened: W00b's guardFolder, once it is on main, refuses each folder of test data. */
function guardOutcome(guardFolder, absDir) {
  try {
    const r = guardFolder(absDir)
    if (Array.isArray(r)) return r.length === 0 ? null : JSON.stringify(r).slice(0, 300)
    if (r && typeof r === 'object' && r.ok === false) return JSON.stringify(r).slice(0, 300)
    return null
  } catch (e) {
    return String(e?.message ?? e).slice(0, 300)
  }
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

// ---------- subjects not on main yet (R35: "nothing to check" unless declared) ----------
// A rule whose subject is not built yet is declared here with the card that brings it. When the subject lands the
// rule runs on it at once (the entry then has no effect and the Lead may drop it); a missing subject with no entry
// fails with "nothing to check".
const PENDING = [
  { rule: 'R34-guard', subject: 'testworld/model/guard.ts', owner: 'W00b (guardFolder, guardValue)' },
  { rule: 'R35', subject: 'testworld/model/checks.ts', owner: 'W00c (the model checks)' },
  { rule: 'R50-guard', subject: 'testworld/model/guard.ts', owner: 'W00b (the guard Luhn)' },
  { rule: 'R51', subject: 'testworld', owner: 'W00c and W00b (the test-world loaders)' },
  { rule: 'R52-catalogue', subject: 'testworld/model/faults.ts', owner: 'W00c (the fault catalogue)' },
  { rule: 'R47', subject: 'src/modules/ocr/tesseract', owner: 'A02' },
  { rule: 'R47', subject: 'src/modules/ocr/recorded', owner: 'A03' },
  { rule: 'R47', subject: 'src/modules/sheets', owner: 'A07 (A07C)' },
  { rule: 'R47', subject: 'src/modules/qbo', owner: 'B04' },
  { rule: 'R54', subject: 'src/modules/sheets', owner: 'A07 (A07C: gzip, %PDF, MZ and spanned zip under a .csv name; large-magnitude number noise)' },
  { rule: 'R54', subject: 'src/modules/documents/intake', owner: 'E00' },
]
function pendingOrNothing(rule, subject) {
  const p = PENDING.find((x) => x.rule === rule && x.subject === subject)
  return p === undefined ? `nothing to check: ${subject} is not on main and PENDING declares no card for ${rule}` : null
}

// ---------- R35: every model or kind check has a planted failing test, and says "nothing to check" when empty ----------
function exportedFunctionNames(src) {
  return [...src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)].map(
    (m) => m[1] ?? m[2],
  )
}
/** Test blocks: [{ title, body }] from test( or it( calls. */
function testBlocks(text) {
  const out = []
  const re = /\b(?:test|it)(?:\.each\([^)]*\))?\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g
  const starts = [...text.matchAll(re)]
  starts.forEach((m, i) => out.push({ title: m[2], body: text.slice(m.index, starts[i + 1]?.index ?? text.length) }))
  return out
}
async function checkCoverageProblems(where, mod, src, testTexts) {
  const problems = []
  const names = exportedFunctionNames(src).filter((n) => typeof mod[n] === 'function')
  const declared = Array.isArray(mod.EMPTY_IS_FINE) ? mod.EMPTY_IS_FINE : []
  for (const name of names) {
    const call = new RegExp(`\\b${name}\\s*\\(`)
    const planted = testTexts.some((t) => testBlocks(t).some((b) => /plant/i.test(b.title) && call.test(b.body)))
    if (!planted) problems.push(`${where}#${name}: no test titled "planted ..." calls it (every model or kind check has a planted failing test)`)
    if (declared.includes(name)) continue
    let said
    try {
      said = JSON.stringify(await mod[name]([]))
    } catch (e) {
      said = String(e?.message ?? e)
    }
    if (!/nothing to check/i.test(said ?? '')) problems.push(`${where}#${name}: over an empty collection it does not say "nothing to check" (got ${String(said).slice(0, 80)}); declare it in EMPTY_IS_FINE if that is meant`)
  }
  return { checked: names.length, problems }
}

// ---------- R46: library values become text through a typed switch, never .text or String(x) ----------
const LIB_VALUE = '(?:cell|c|v|value|raw|item|node)'
function libraryTextProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    const libs = [...src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]).filter((s) => !/^(\.|node:|zod$|@\/)/.test(s))
    if (libs.length === 0) continue
    if (new RegExp(`\\b${LIB_VALUE}\\.text\\b`).test(src)) problems.push(`${f}: reads a library value's display text (.text); build the text from the typed value`)
    const typedSwitch = /switch\s*\(\s*typeof\b/.test(src) || /switch\s*\(\s*[\w.]+\.(type|kind)\s*\)/.test(src)
    const untyped = new RegExp(`String\\(\\s*${LIB_VALUE}(?:\\.\\w+)*\\s*\\)|\\$\\{\\s*${LIB_VALUE}(?:\\.\\w+)*\\s*\\}`).exec(src)
    if (untyped && !typedSwitch) problems.push(`${f}: turns a library value into text with ${untyped[0]} and no typed switch`)
  }
  return problems
}

// ---------- R47, R48, R54: reader adapters ----------
const outcomeOf = async (fn) => {
  try {
    return { value: await fn() }
  } catch (e) {
    return { threw: e }
  }
}
const textOf = (o) => (o.threw !== undefined ? `${o.threw?.name ?? ''}: ${String(o.threw?.message ?? o.threw)}` : JSON.stringify(o.value))
function mutateDeep(v, depth = 0) {
  if (depth > 6 || v === null || typeof v !== 'object') return
  if (Array.isArray(v)) {
    v.forEach((x) => mutateDeep(x, depth + 1))
    v.push('mutated (Test)')
    return
  }
  for (const k of Object.keys(v)) {
    if (typeof v[k] === 'string') v[k] = 'mutated (Test)'
    else if (typeof v[k] === 'number') v[k] = -12345
    else mutateDeep(v[k], depth + 1)
  }
  v.mutatedTest = true
}
/** R47: the cache returns a copy, its key covers every input the result depends on, and no reason names the file. */
async function cacheProblems(label, makeReader, bytes, names, routes) {
  const problems = []
  const fp = `r47-${label} (Test)`
  const named = await makeReader()
  const outcomes = []
  for (const name of names) outcomes.push([name, textOf(await outcomeOf(() => named.read({ fingerprint: fp, fileName: name, bytes })))])
  for (const [name, t] of outcomes) {
    for (const n of names) if (t.includes(n)) problems.push(`${label}: read as ${name}, the outcome names the file ${n}`)
    if (t !== outcomes[0][1] && routes.length === 0) problems.push(`${label}: the same bytes read as ${name} gave a different outcome from ${names[0]} with no route between them`)
  }
  const reader = await makeReader()
  const first = await outcomeOf(() => reader.read({ fingerprint: fp, fileName: names[0], bytes }))
  const before = textOf(first)
  if (first.value !== undefined) mutateDeep(first.value)
  const again = await outcomeOf(() => reader.read({ fingerprint: fp, fileName: names[0], bytes }))
  if (textOf(again) !== before) problems.push(`${label}: changing a returned result changed the next read (the cache hands out its own object)`)
  for (const [a, b] of routes) {
    const r = await makeReader()
    const oa = textOf(await outcomeOf(() => r.read({ fingerprint: `${fp}-route`, fileName: a, bytes })))
    const ob = textOf(await outcomeOf(() => r.read({ fingerprint: `${fp}-route`, fileName: b, bytes })))
    const fresh = textOf(await outcomeOf(async () => (await makeReader()).read({ fingerprint: `${fp}-route`, fileName: b, bytes })))
    if (ob !== fresh) problems.push(`${label}: read as ${a} then ${b}, the second outcome came from the cache of the first (the key misses the route)`)
    if (oa === ob) problems.push(`${label}: ${a} and ${b} take different routes but gave the same outcome`)
  }
  return problems
}
/** R48: an empty instance (a blank page, an empty hidden row or column) is kept, never dropped. */
async function emptyInstanceProblems(label, makeReader, bytes, keeps) {
  const reader = await makeReader()
  const o = await outcomeOf(() => reader.read({ fingerprint: `r48-${label} (Test)`, fileName: 'blank (Test).pdf', bytes }))
  if (o.threw !== undefined) return [`${label}: the empty instance was refused: ${textOf(o)}`]
  const why = keeps(o.value)
  return why === null ? [] : [`${label}: ${why}`]
}
/** R54: a wrong-kind container is refused with a reason that carries no library message or URL, and never throws raw. */
const LIBRARY_TRACE = /https?:|node_modules|\bat \S+ \(|Exception\b|ZodError|TypeError|RangeError|pdf\.js|pdfjs|exceljs|unzip|inflate|\[object /i
async function wrongKindProblems(label, makeReader, cases, refusalReason) {
  const problems = []
  for (const [what, name, bytes] of cases) {
    const reader = await makeReader()
    const o = await outcomeOf(() => reader.read({ fingerprint: `r54-${label}-${what} (Test)`, fileName: name, bytes }))
    const reason = refusalReason(o)
    if (reason === null) {
      problems.push(`${label}: ${what} under ${name} was not refused with a reason (${textOf(o).slice(0, 120)})`)
      continue
    }
    if (LIBRARY_TRACE.test(reason)) problems.push(`${label}: ${what}: the reason carries a library message or URL (${reason.slice(0, 120)})`)
    if (reason.includes(name)) problems.push(`${label}: ${what}: the reason names the file`)
  }
  return problems
}
const bytesOf = (s) => Uint8Array.from(Buffer.from(s, 'latin1'))
const WRONG_KIND = {
  gzip: bytesOf('\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\x03made up (Test)'),
  mz: bytesOf('MZ\x90\x00\x03\x00\x00\x00made up (Test)'),
  zip: bytesOf('PK\x03\x04\x14\x00\x00\x00\x08\x00made up (Test)'),
  spannedZip: bytesOf('PK\x07\x08PK\x03\x04\x14\x00made up (Test)'),
  csv: bytesOf('Date,Description,Amount\r\n2025-01-02,SALE (Test),10.00\r\n'),
  pdf: bytesOf('%PDF-1.4\n%made up (Test)\n'),
  empty: new Uint8Array(0),
}
/** A small PDF in raw syntax: one page of Courier text per entry (null: an empty page), offsets exact. */
function rawPdf(pages, mediaBox = [0, 0, 612, 792]) {
  const objs = []
  const kids = pages.map((_, i) => `${String(4 + i * 2)} 0 R`).join(' ')
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${String(pages.length)} >>`)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')
  pages.forEach((text, i) => {
    const content = text === null ? '' : `BT /F1 12 Tf 72 700 Td (${text}) Tj ET`
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [${mediaBox.join(' ')}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${String(5 + i * 2)} 0 R >>`)
    objs.push(`<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`)
  })
  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${String(i + 1)} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return bytesOf(out)
}
/** The A01 reading contract signals a refusal by rejecting with its own "Reading refused: ..." error (amber, SC spec). */
const a01Refusal = (o) => (o.threw instanceof Error && o.threw.constructor === Error && /^Reading refused: /.test(o.threw.message) ? o.threw.message : null)
const READERS = {
  A01: {
    dir: 'src/modules/ocr/textlayer',
    make: async () => (await load('src/modules/ocr/textlayer/index.ts')).createTextLayerEngine(),
    good: () => fs.readFileSync(path.join(ROOT, 'src/modules/ocr/textlayer/__fixtures__/one-page.pdf')),
    names: ['statement (Test).pdf', 'statement (Test).doc'],
    routes: [],
    blank: () => rawPdf(['SALE 10.00 (Test)', null]),
    keeps: (r) =>
      r.pageCount !== 2 || r.pages.length !== 2
        ? `a blank page was dropped: ${String(r.pages.length)} pages of ${String(r.pageCount)}`
        : r.pages[1].hasTextLayer !== false
          ? 'the blank page is not reported as having no text layer'
          : null,
    wrongKind: [
      ['gzip bytes', 'statement (Test).pdf', WRONG_KIND.gzip],
      ['MZ bytes', 'statement (Test).pdf', WRONG_KIND.mz],
      ['zip bytes', 'statement (Test).pdf', WRONG_KIND.zip],
      ['spanned-zip bytes', 'statement (Test).pdf', WRONG_KIND.spannedZip],
      ['CSV text', 'statement (Test).pdf', WRONG_KIND.csv],
      ['empty bytes', 'statement (Test).pdf', WRONG_KIND.empty],
      ['a PDF header and nothing else', 'statement (Test).pdf', WRONG_KIND.pdf],
      ['a zero-size MediaBox', 'statement (Test).pdf', rawPdf(['SALE (Test)'], [0, 0, 0, 0])],
    ],
    refusal: a01Refusal,
  },
}
const READER_DIRS = ['src/modules/ocr/textlayer', 'src/modules/ocr/tesseract', 'src/modules/ocr/recorded', 'src/modules/sheets', 'src/modules/qbo']

// ---------- R49: no zod .trim() transform ----------
function trimTransformProblems(files, readFile) {
  return files
    .filter((f) => /z\s*\.\s*string\(\)(?:\s*\.\s*\w+\([^()]*\))*?\s*\.\s*trim\(\)/.test(readFile(f)))
    .map((f) => `${f}: a z.string().trim() transform rewrites the stored value (non-blank goes through text.ts)`)
}

// ---------- R50: one Luhn ----------
const LUHN_HOMES = ['testworld/model/guard.ts', 'reference/sample-clients/lib/util.mjs']
const LUHN_SHAPE = /\*=?\s*2\b[\s\S]{0,120}?>\s*9\b[\s\S]{0,120}?(?:-=?\s*9\b|%\s*10\b)|\bfunction\s+\w*luhn\w*\s*\(|\b(?:const|let)\s+\w*luhn\w*\s*=\s*(?:\(|function|async|[A-Za-z_$][\w$]*\s*=>)/i
function oneCheckDigitProblems(files, readFile) {
  return files.filter((f) => !LUHN_HOMES.includes(f) && LUHN_SHAPE.test(readFile(f))).map((f) => `${f}: its own Luhn check (one Luhn: guard.ts and lib/util.mjs)`)
}
const codeFiles = () =>
  ['src', 'testworld', 'e2e', 'tools', 'reference/sample-clients', 'design', 'db']
    .flatMap((d) => walk(d))
    .filter((f) => /\.(ts|tsx|mts|mjs|js|cjs)$/.test(f) && !f.startsWith(`${FIX_REL}/`))

// ---------- R51: every test-world loader is guarded ----------
const READS_DATA = /\b(readFileSync|readFile|readdirSync|readdir|createReadStream|opendir)\s*\(/
function loaderProblems(files, readFile) {
  return files
    .filter((f) => !/\/guard(-fields)?\.ts$/.test(f))
    .filter((f) => READS_DATA.test(readFile(f)) && !/\bguard(Folder|Value)\s*\(/.test(readFile(f)))
    .map((f) => `${f}: reads data files without guardFolder or guardValue (SEC-11)`)
}

// ---------- R52 and R53: fault markers and statement sequences in the answer keys ----------
class Num {
  constructor(src) {
    this.src = src
  }
}
const parseKey = (text) => JSON.parse(text, (_k, v, ctx) => (typeof v === 'number' ? new Num(ctx.source) : v))
/** Cents from the number's own text (R36: money from text only); NaN when it is not a plain amount. */
function centsOfText(src) {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(src)
  if (!m) return Number.NaN
  const c = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'))
  return m[1] === '-' ? -c : c
}
const BASE_TX_FIELDS = new Set([
  'id', 'acct', 'date', 'description', 'amount', 'currency', 'kind', 'line', 'qboLine', 'account', 'accountNo', 'gifi',
  'gifiStatus', 'post', 'flags', 'notes', 'hstItc', 'hstCollected', 'pair', 'mirror', 'postedVia', 'personal', 'external',
  'business', 'suggestedPost', 'payroll', 'parts',
])
// The marker catalogue until W00c's testworld/model/faults.ts lands (then each marker must also be named there).
const MARKER_CATALOGUE = {
  dupOf: 'a second copy of an export line: its original is in the key with the same account, date, words and amount; post nothing',
  priorYear: "last year's row mixed into the export: dated before the year starts; post nothing",
  missingFromExport: 'a real row the export lacks: counted in the account rowsMissingFromExport, and in the statement roll',
}
const sign = (account) => (/owing/i.test(account.balanceMeaning ?? '') ? -1 : 1)
function markerProblems(where, key, catalogue) {
  const problems = []
  const tx = key.transactions ?? []
  const byId = new Map(tx.map((t) => [t.id, t]))
  for (const t of tx) {
    for (const f of Object.keys(t)) {
      if (!BASE_TX_FIELDS.has(f) && !(f in catalogue)) problems.push(`${where}: ${t.id} carries the field ${f}, which no catalogue entry names`)
    }
    if (t.dupOf !== undefined) {
      const o = byId.get(t.dupOf)
      if (o === undefined) problems.push(`${where}: ${t.id} is dupOf ${t.dupOf}, which is not in the key`)
      else if (o.acct !== t.acct || o.date !== t.date || o.description !== t.description || o.amount?.src !== t.amount?.src || o.dupOf !== undefined) {
        problems.push(`${where}: ${t.id} is dupOf ${t.dupOf}, but the two differ (account, date, words or amount) or the original is itself a copy`)
      }
    }
    if (t.priorYear !== undefined && !(t.priorYear === true && t.date < key.fiscalYear.start)) problems.push(`${where}: ${t.id} is marked priorYear but is dated ${t.date}, inside the year`)
    if (t.missingFromExport !== undefined && t.missingFromExport !== true) problems.push(`${where}: ${t.id} has missingFromExport ${JSON.stringify(t.missingFromExport)}`)
  }
  for (const a of key.accounts ?? []) {
    const rows = tx.filter((t) => t.acct === a.key)
    const missing = rows.filter((t) => t.missingFromExport === true).length
    if (missing !== Number(a.rowsMissingFromExport?.src)) problems.push(`${where}: ${a.key} has ${String(missing)} rows marked missingFromExport, the account says ${String(a.rowsMissingFromExport?.src)}`)
    if (rows.length - missing !== Number(a.rowsInExport?.src)) problems.push(`${where}: ${a.key} has ${String(rows.length - missing)} rows in the export, the account says ${String(a.rowsInExport?.src)}`)
    for (const m of key.statementBalances?.[a.key] ?? []) {
      const activity = rows
        .filter((t) => t.date.startsWith(m.month) && t.dupOf === undefined && t.priorYear === undefined)
        .reduce((s, t) => s + centsOfText(t.amount.src), 0)
      const open = centsOfText(m.opening.src)
      const close = centsOfText(m.closing.src)
      if (!(open + sign(a) * activity === close)) problems.push(`${where}: ${a.key} ${m.month} does not roll: ${m.opening.src} and the month's rows (copies and last year's rows left out) do not make ${m.closing.src}`)
    }
  }
  return problems
}
const monthAfter = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${String(y + 1)}-01` : `${String(y)}-${String(m + 1).padStart(2, '0')}`
}
function sequenceProblems(where, key) {
  const problems = []
  for (const a of key.accounts ?? []) {
    const months = key.statementBalances?.[a.key]
    if (months === undefined || months.length === 0) continue
    if (months[0].month !== key.fiscalYear.start.slice(0, 7)) problems.push(`${where}: ${a.key} starts at ${months[0].month}, not the first month of the year`)
    if (months.at(-1).month !== key.fiscalYear.end.slice(0, 7)) problems.push(`${where}: ${a.key} ends at ${months.at(-1).month}, not the last month of the year`)
    if (months[0].opening.src !== a.openingBalance?.src) problems.push(`${where}: ${a.key} opens at ${months[0].opening.src}, the account says ${String(a.openingBalance?.src)}`)
    if (months.at(-1).closing.src !== a.closingBalance?.src) problems.push(`${where}: ${a.key} closes at ${months.at(-1).closing.src}, the account says ${String(a.closingBalance?.src)}`)
    for (let i = 1; i < months.length; i++) {
      if (months[i].month !== monthAfter(months[i - 1].month)) problems.push(`${where}: ${a.key} goes from ${months[i - 1].month} to ${months[i].month} (a gap or a repeat)`)
      if (months[i].opening.src !== months[i - 1].closing.src) problems.push(`${where}: ${a.key} ${months[i].month} opens at ${months[i].opening.src}, but ${months[i - 1].month} closed at ${months[i - 1].closing.src}`)
    }
  }
  return problems
}
/** A client kept over two years (folders NN-name-YYYY): each account's last closing is the next year's first opening. */
function yearLinkProblems(keys) {
  const problems = []
  for (const [dir, key] of keys) {
    const m = /^(\d\d)-(.+)-(\d{4})$/.exec(dir)
    if (!m) continue
    const next = keys.find(([d]) => new RegExp(`^\\d\\d-${m[2]}-${String(Number(m[3]) + 1)}$`).test(d))
    if (!next) continue
    for (const a of key.accounts ?? []) {
      const b = (next[1].accounts ?? []).find((x) => x.key === a.key)
      if (b === undefined) problems.push(`${dir}: account ${a.key} does not continue into ${next[0]}`)
      else if (a.closingBalance?.src !== b.openingBalance?.src) problems.push(`${dir}: ${a.key} closes at ${String(a.closingBalance?.src)}, ${next[0]} opens at ${String(b.openingBalance?.src)}`)
    }
  }
  return problems
}
const answerKeys = () =>
  fs
    .readdirSync(path.join(ROOT, 'reference/sample-clients'))
    .filter((d) => /^\d\d-/.test(d) && exists(`reference/sample-clients/${d}/answer-key.json`))
    .map((d) => [d, parseKey(read(`reference/sample-clients/${d}/answer-key.json`))])

// ---------- R56: raw-XML regexes handle self-closed elements; tolerances scale with magnitude ----------
function xmlAndToleranceProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    for (const m of src.matchAll(/\/((?:[^/\\\n]|\\.)*<\/?(?:c|row|col|sheet|cell|v|f|is|si|t)\b(?:[^/\\\n]|\\.)*)\/[dgimsuy]*/g)) {
      const body = m[1]
      if (/<\\?\/(?:c|row|sheet|cell|v|si|is|t)\b/.test(body) && !/\\?\/>/.test(body.replace(/<\\?\/\w+/g, ''))) {
        problems.push(`${f}: a regex over raw XML that misses a self-closed element (${body.slice(0, 50)})`)
      }
    }
    const consts = new Map([...src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([\d.]+(?:e-?\d+)?|Number\.EPSILON)\s*$/gm)].map((m) => [m[1], m[2]]))
    for (const m of src.matchAll(/Math\.abs\(((?:[^()]|\([^()]*\))*)\)\s*<=?\s*([^\n;,)]+)/g)) {
      const bound = m[2].trim()
      const absolute = /^[\d.]+(?:e-?\d+)?$|^Number\.EPSILON$/.test(bound) || (consts.has(bound) && !/\*/.test(bound))
      if (absolute) problems.push(`${f}: an absolute tolerance (Math.abs(...) < ${bound}); scale it with the magnitude`)
    }
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
    expect(onlyKnown('R34', [...files.flatMap((f) => piiProblems(f, dataText(f))), ...binaryListProblems(files)])).toEqual([])
  })
  test('SEC-11 R34 rule (widened): a SIN as a JSON number, in exponent form, with mixed, dotted or no-break separators is caught; box fractions and money are not', () => {
    const json = piiProblems('planted.json', fix('planted-r34-pii.json'))
    expect(json).toEqual([
      'planted.json: a Luhn-valid nine-digit number "271000002" (a SIN or business number shape)',
      'planted.json: a Luhn-valid nine-digit number "271 000-002" (a SIN or business number shape)',
      'planted.json: a Luhn-valid nine-digit number in exponent form "2.71000002e8"',
    ])
    const txt = piiProblems('planted.txt', fix('planted-r34-pii-dotted.txt'))
    expect(txt).toEqual([
      'planted.txt: a Luhn-valid nine-digit number "271.000.002" (a SIN or business number shape)',
      'planted.txt: a Luhn-valid nine-digit number "271\u00a0000\u00a0002" (a SIN or business number shape)',
    ])
  })
  test('SEC-11 R34 rule (widened): a binary test-data file off the reasoned list is caught; the A01 PDFs are on it', () => {
    expect(binaryListProblems(['testworld/clients/c01/statement.xlsx', 'src/modules/ocr/textlayer/__fixtures__/one-page.pdf'])).toEqual([
      'testworld/clients/c01/statement.xlsx: a binary test-data file not on the reasoned BINARY_FIXTURES list',
    ])
    expect(BINARY_FIXTURES.every((b) => b.reason.trim().length > 20)).toBe(true)
  })
  test('SEC-11 R34 (widened) W00b guardFolder refuses the planted folder and passes sample clients, testworld, every __fixtures__ and __golden__', async () => {
    const subject = 'testworld/model/guard.ts'
    if (!exists(subject)) {
      expect(pendingOrNothing('R34-guard', subject)).toBeNull()
      return
    }
    const { guardFolder } = await load(subject)
    expect(typeof guardFolder, 'guard.ts exports no guardFolder').toBe('function')
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-r34-'))
    try {
      fs.copyFileSync(path.join(FIX, 'planted-r34-pii.json'), path.join(tmp, 'planted.json'))
      expect(guardOutcome(guardFolder, tmp), 'guardFolder passed a folder holding a Luhn-valid SIN').not.toBeNull()
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
    const dirs = [...new Set(['reference/sample-clients', 'testworld', ...testDataFiles().filter(isFixture).map((f) => f.replace(/(__fixtures__|__golden__)\/.*$/, '$1'))])]
    const problems = dirs.map((d) => [d, guardOutcome(guardFolder, path.join(ROOT, d))]).filter(([, o]) => o !== null).map(([d, o]) => `${d}: ${String(o)}`)
    expect(onlyKnown('R34-guard', problems)).toEqual([])
  }, 60_000)

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
  }, 60_000)

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

describe('SC R35, R45 and R50 to R53: test-world checks, cites, one Luhn, loaders, markers and sequences (ARC-8, SEC-11, EV-5, END-2)', () => {
  test('ARC-8 R35 rule: a check with no planted test and a silent pass over an empty collection is caught; the other is not', async () => {
    const mod = await import(pathToFileURL(path.join(FIX, 'planted-r35-checks.mjs')).href)
    const r = await checkCoverageProblems('planted', mod, fix('planted-r35-checks.mjs'), [fix('r35/planted-r35-checks.test.mjs.txt')])
    expect(r.checked).toBe(2)
    expect(r.problems).toEqual([
      'planted#checkMarkers: no test titled "planted ..." calls it (every model or kind check has a planted failing test)',
      'planted#checkMarkers: over an empty collection it does not say "nothing to check" (got {"ok":true,"issues":[]}); declare it in EMPTY_IS_FINE if that is meant',
    ])
  })
  test('ARC-8 R35 every exported model or kind check has a planted failing test and says "nothing to check" over an empty collection unless declared', async () => {
    const subject = 'testworld/model/checks.ts'
    if (!exists(subject)) {
      expect(pendingOrNothing('R35', subject)).toBeNull()
      return
    }
    const tests = walk('testworld').filter(isTest).map(read)
    const files = productTs(['testworld']).filter((f) => /(^|\/)checks?\.ts$|\/kinds?\//.test(f))
    const problems = []
    let checked = 0
    for (const f of files) {
      const r = await checkCoverageProblems(f, await load(f), read(f), tests)
      checked += r.checked
      problems.push(...r.problems)
    }
    expect(checked, 'nothing to check: no exported check in testworld').toBeGreaterThan(0)
    expect(onlyKnown('R35', problems)).toEqual([])
  })

  test('EV-5 R45 the fact catalogue loader refuses a cra_form cite that is free text (each key\'s cite pattern)', async () => {
    const { loadFactCatalogue } = await load('src/contracts/facts.ts')
    const base = R23_SAMPLES['src/contracts/facts.ts#factEntrySchema'][0]
    const good = { ...base, key: 'corp.tax.net_income', valueType: 'money', cites: [{ kind: 'cra_form', ref: 'Schedule 125 line 9999' }] }
    expect(loadFactCatalogue({ entries: [good] }).ok).toBe(true)
    const bad = { ...good, cites: [{ kind: 'cra_form', ref: 'the net income line (Test)' }] }
    const problems = loadFactCatalogue({ entries: [bad] }).ok ? ['loadFactCatalogue accepts a cra_form cite that is free text'] : []
    expect(onlyKnown('R45-cite', problems)).toEqual([])
  })

  test('SEC-11 R50 rule: a planted second Luhn is caught; the two homes are not', () => {
    const files = ['tools/planted/check-digit.mjs', 'reference/sample-clients/lib/util.mjs']
    const text = (f) => (f === 'tools/planted/check-digit.mjs' ? fix('planted-r50-luhn.mjs.txt') : read(f))
    expect(oneCheckDigitProblems(files, text)).toEqual(['tools/planted/check-digit.mjs: its own Luhn check (one Luhn: guard.ts and lib/util.mjs)'])
  })
  test('SEC-11 R50 one Luhn: no Luhn check outside guard.ts and reference/sample-clients/lib/util.mjs', () => {
    const files = codeFiles()
    expect(files.length).toBeGreaterThan(100)
    expect(onlyKnown('R50', oneCheckDigitProblems(files, read))).toEqual([])
  }, 60_000)
  test('SEC-11 R50 the guard Luhn and lib/util.mjs agree on every nine-digit shape (fixed seed)', async () => {
    const subject = 'testworld/model/guard.ts'
    if (!exists(subject)) {
      expect(pendingOrNothing('R50-guard', subject)).toBeNull()
      return
    }
    const guard = await load(subject)
    const name = Object.keys(guard).find((k) => /luhn/i.test(k) && typeof guard[k] === 'function')
    expect(name, 'guard.ts exports no Luhn check').toBeDefined()
    const digits = fc.stringMatching(/^\d{9}$/)
    fc.assert(fc.property(digits, (d) => Boolean(guard[name](d)) === luhnValid(d)), { seed: SEED, numRuns: 2000 })
  })

  test('SEC-11 ARC-8 R51 rule: a planted loader that reads data files without the guard is caught; the guarded one is not', () => {
    const files = ['testworld/planted/loader.ts', 'testworld/planted/clean.ts']
    const text = (f) => fix(f.endsWith('loader.ts') ? 'r51/planted-loader.ts.txt' : 'r51/clean-loader.ts.txt')
    expect(loaderProblems(files, text)).toEqual(['testworld/planted/loader.ts: reads data files without guardFolder or guardValue (SEC-11)'])
  })
  test('SEC-11 ARC-8 R51 every module in testworld and e2e/_harness that reads data files goes through guardFolder or guardValue', () => {
    const files = [...productTs(['testworld']), ...walk('e2e/_harness').filter((f) => /\.[cm]?[jt]sx?$/.test(f) && !isTest(f))]
    const readers = files.filter((f) => READS_DATA.test(read(f)))
    if (readers.length === 0) {
      expect(pendingOrNothing('R51', 'testworld')).toBeNull()
      return
    }
    expect(onlyKnown('R51', loaderProblems(files, read))).toEqual([])
  })

  test('ARC-8 END-2 R52 rule: an uncatalogued marker, a duplicate of nothing, a last-year row inside the year, a wrong missing count and a month that does not roll are caught', () => {
    const problems = markerProblems('planted', parseKey(fix('planted-r52-r53-key.json')), MARKER_CATALOGUE)
    expect(problems).toEqual([
      'planted: T-3 is dupOf T-9, which is not in the key',
      'planted: T-4 is marked priorYear but is dated 2025-04-03, inside the year',
      'planted: T-6 carries the field fudged, which no catalogue entry names',
      'planted: CHQ has 1 rows marked missingFromExport, the account says 0',
      'planted: CHQ has 5 rows in the export, the account says 4',
      'planted: CHQ 2025-04 does not roll: 125.00 and the month\'s rows (copies and last year\'s rows left out) do not make 140.00',
    ])
    expect(markerProblems('clean', parseKey(fix('clean-r52-r53-key.json')), MARKER_CATALOGUE)).toEqual([])
  })
  test('ARC-8 END-2 R52 every fault-marker field in every answer key has a catalogue entry and its arithmetic proof holds', async () => {
    const keys = answerKeys()
    expect(keys.length).toBeGreaterThanOrEqual(10)
    const marked = keys.flatMap(([, k]) => (k.transactions ?? []).filter((t) => Object.keys(MARKER_CATALOGUE).some((m) => m in t)))
    expect(marked.length, 'nothing to check: no marked row in any answer key').toBeGreaterThan(0)
    const problems = keys.flatMap(([d, k]) => markerProblems(d, k, MARKER_CATALOGUE))
    const faults = 'testworld/model/faults.ts'
    if (exists(faults)) {
      const text = read(faults)
      for (const m of Object.keys(MARKER_CATALOGUE)) if (!text.includes(m)) problems.push(`${faults}: the fault catalogue does not name the marker ${m}`)
    } else expect(pendingOrNothing('R52-catalogue', faults)).toBeNull()
    expect(onlyKnown('R52', problems)).toEqual([])
  })

  test('ARC-8 R53 rule: a missing month and a month that does not open at the last closing are caught', () => {
    expect(sequenceProblems('planted', parseKey(fix('planted-r52-r53-key.json')))).toEqual([
      'planted: CHQ goes from 2025-02 to 2025-04 (a gap or a repeat)',
      'planted: CHQ 2025-04 opens at 125.00, but 2025-02 closed at 120.00',
    ])
    expect(sequenceProblems('clean', parseKey(fix('clean-r52-r53-key.json')))).toEqual([])
    const k = parseKey(fix('clean-r52-r53-key.json'))
    const next = parseKey(fix('clean-r52-r53-key.json').replace('"openingBalance": 100.00', '"openingBalance": 135.01').replace('"openingBalance": 50.00', '"openingBalance": 40.00'))
    expect(yearLinkProblems([['98-planted-2024', k], ['99-planted-2025', next]])).toEqual(['98-planted-2024: CHQ closes at 135.00, 99-planted-2025 opens at 135.01'])
  })
  test('ARC-8 R53 every month sequence in every answer key is complete, each closing is the next opening, and a two-year client links its years', () => {
    const keys = answerKeys()
    const withMonths = keys.filter(([, k]) => Object.keys(k.statementBalances ?? {}).length > 0)
    expect(withMonths.length, 'nothing to check: no statement months').toBeGreaterThan(5)
    expect(onlyKnown('R53', [...keys.flatMap(([d, k]) => sequenceProblems(d, k)), ...yearLinkProblems(keys)])).toEqual([])
  })
})

describe('SC R46 to R49, R54 and R56: readers, caches, empty instances, wrong kinds and raw XML (EV-14, ARC-11, ARC-6, EV-1)', () => {
  test('EV-14 R46 rule: a planted cell.text and String(cell.value) are caught; a typed switch is not', () => {
    expect(libraryTextProblems(['planted-r46-reader.ts.txt'], fix)).toEqual([
      "planted-r46-reader.ts.txt: reads a library value's display text (.text); build the text from the typed value",
      'planted-r46-reader.ts.txt: turns a library value into text with String(cell.value) and no typed switch',
    ])
    expect(libraryTextProblems(['clean-r46-reader.ts.txt'], fix)).toEqual([])
  })
  test('EV-14 R46 no module turns a library value into text through .text, String(x) or a template without a typed switch', () => {
    const files = productTs(['src/modules'])
    expect(files.length).toBeGreaterThan(0)
    expect(onlyKnown('R46', libraryTextProblems(files, read))).toEqual([])
  })

  test('ARC-11 R47 rule: a cache keyed on the fingerprint alone that hands out its own object and names the file is caught', async () => {
    const { createPlantedReader } = await import(pathToFileURL(path.join(FIX, 'planted-r47-reader.mjs')).href)
    const problems = await cacheProblems('planted', createPlantedReader, WRONG_KIND.csv, ['b (Test).pdf', 'a (Test).csv'], [['a (Test).csv', 'b (Test).pdf']])
    expect(problems).toContain('planted: changing a returned result changed the next read (the cache hands out its own object)')
    expect(problems).toContain('planted: read as b (Test).pdf, the outcome names the file b (Test).pdf')
    expect(problems).toContain('planted: read as a (Test).csv then b (Test).pdf, the second outcome came from the cache of the first (the key misses the route)')
  })
  test('ARC-11 R47 every reader adapter keys its cache on every input its result depends on and returns a copy (A01 now; A02, A03, A07, B04 as they land)', async () => {
    const problems = []
    for (const dir of READER_DIRS) {
      const entry = Object.entries(READERS).find(([, r]) => r.dir === dir)
      if (!exists(dir)) {
        const p = pendingOrNothing('R47', dir)
        if (p !== null && entry === undefined && dir !== 'src/modules/ocr/textlayer') problems.push(p)
        continue
      }
      if (entry === undefined) {
        problems.push(`${dir}: a reader adapter with no entry in the SC READERS registry (a spec job adds it)`)
        continue
      }
      const [label, r] = entry
      problems.push(...(await cacheProblems(label, r.make, r.good(), r.names, r.routes)))
    }
    expect(Object.keys(READERS).length).toBeGreaterThan(0)
    expect(onlyKnown('R47', problems)).toEqual([])
  }, 60_000)

  test('EV-14 ARC-6 R48 rule: a reader that drops an empty page is caught', async () => {
    const { createDroppingReader } = await import(pathToFileURL(path.join(FIX, 'planted-r47-reader.mjs')).href)
    expect(await emptyInstanceProblems('planted', createDroppingReader, new Uint8Array(0), READERS.A01.keeps)).toEqual(['planted: a blank page was dropped: 1 pages of 2'])
  })
  test('EV-14 ARC-6 R48 every reader whose contract says hidden or never dropped keeps an empty instance (a blank page, an empty hidden row or column)', async () => {
    const problems = []
    for (const [label, r] of Object.entries(READERS)) {
      if (r.blank === undefined) {
        problems.push(`${label}: no empty instance in the SC READERS registry`)
        continue
      }
      problems.push(...(await emptyInstanceProblems(label, r.make, r.blank(), r.keeps)))
    }
    for (const dir of READER_DIRS.filter(exists)) {
      const says = productTs([dir]).some((f) => /\bhidden\b|never dropped|without a text layer/i.test(read(f)))
      if (says && !Object.values(READERS).some((r) => r.dir === dir && r.blank !== undefined)) problems.push(`${dir}: its contract says hidden or never dropped, and no empty instance tests it`)
    }
    expect(onlyKnown('R48', problems)).toEqual([])
  }, 60_000)

  test('EV-1 EV-14 R49 rule: a planted z.string().trim() transform is caught', () => {
    expect(trimTransformProblems(['planted-r49-trim.ts.txt'], fix)).toEqual([
      'planted-r49-trim.ts.txt: a z.string().trim() transform rewrites the stored value (non-blank goes through text.ts)',
    ])
  })
  test('EV-1 EV-14 R49 no z.string().trim() transform in src/contracts or src/modules', () => {
    expect(onlyKnown('R49', trimTransformProblems(CONTRACT_AND_MODULE_FILES(), read))).toEqual([])
  })

  test('ARC-6 EV-14 R54 rule: a reader that lets a library error out with its URL is caught', async () => {
    const { createThrowingReader } = await import(pathToFileURL(path.join(FIX, 'planted-r47-reader.mjs')).href)
    const problems = await wrongKindProblems('planted', createThrowingReader, [['gzip bytes', 'data (Test).csv', WRONG_KIND.gzip]], a01Refusal)
    expect(problems).toEqual(['planted: gzip bytes under data (Test).csv was not refused with a reason (TypeError: InvalidPDFException: Invalid PDF structure, see https://example.com/pdfjs (Test))'])
    const lax = await wrongKindProblems('lax', createThrowingReader, [['gzip bytes', 'data (Test).csv', WRONG_KIND.gzip]], (o) => String(o.threw.message))
    expect(lax).toEqual(['lax: gzip bytes: the reason carries a library message or URL (InvalidPDFException: Invalid PDF structure, see https://example.com/pdfjs (Test))'])
  })
  test('ARC-6 EV-14 R54 every reader refuses a wrong-kind container (gzip, MZ, zip, spanned zip, CSV, empty, a bare header, a zero-size page) with a reason and never throws raw', async () => {
    const problems = []
    for (const [label, r] of Object.entries(READERS)) problems.push(...(await wrongKindProblems(label, r.make, r.wrongKind, r.refusal)))
    for (const dir of ['src/modules/sheets', 'src/modules/documents/intake']) {
      if (exists(dir) && !Object.values(READERS).some((r) => r.dir === dir)) problems.push(`${dir}: a reader with no entry in the SC READERS registry (R54)`)
      else if (!exists(dir)) {
        const p = pendingOrNothing('R54', dir)
        if (p !== null) problems.push(p)
      }
    }
    expect(onlyKnown('R54', problems)).toEqual([])
  }, 60_000)

  test('EV-14 R56 rule: a raw-XML regex that misses a self-closed element and an absolute snap tolerance are caught; the clean versions are not', () => {
    expect(xmlAndToleranceProblems(['planted-r56-xml.ts.txt'], fix)).toEqual([
      'planted-r56-xml.ts.txt: a regex over raw XML that misses a self-closed element (<c r="([A-Z]+\\d+)"[^>]*>(.*?)<\\/c>)',
      'planted-r56-xml.ts.txt: an absolute tolerance (Math.abs(...) < SNAP); scale it with the magnitude',
    ])
    expect(xmlAndToleranceProblems(['clean-r56-xml.ts.txt'], fix)).toEqual([])
  })
  test('EV-14 R56 every regex over raw sheet XML handles self-closed elements and every snap tolerance is relative to magnitude', () => {
    expect(onlyKnown('R56', xmlAndToleranceProblems(CONTRACT_AND_MODULE_FILES(), read))).toEqual([])
  })
})
