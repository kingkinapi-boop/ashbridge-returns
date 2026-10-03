// Spec-owned helpers for the W00c round 3 acceptance tests (reports/W00c-findings-3.md, RC-A, RC-B, RC-C).
//
// Every case comes from a walk over the parsed sample files of every numbered folder (walkClients in sample-walk.ts),
// never from a typed list of values: the leaf walk below finds every date-shaped and id-shaped string, and every object
// node at a described path, with this file's own code. Nothing here imports the module under test except through the
// public loader in sample-walk.ts.
import { readFileSync, writeFileSync } from 'node:fs'
import fc from 'fast-check'
import { expect } from 'vitest'
import { TestWorldLoadError } from '../index'
import { loadClient } from '../../index'
import type { Issue, Sandbox, WalkClient } from './sample-walk'

export type JsonFile = 'answer-key.json' | 'onboarding.json'
export const JSON_FILES: readonly JsonFile[] = ['answer-key.json', 'onboarding.json']
export type Step = string | number
export type Path = readonly Step[]

/** A leaf (string, number, boolean or null) of a parsed file, with its concrete path and its generic path. */
export interface Leaf {
  file: JsonFile
  path: Path
  /** Array indexes written as [], dots between keys: "transactions[].post[].a". Record keys stay literal. */
  generic: string
  value: unknown
}

/** "transactions.0.post.1.a": the path as the loader names it (zod paths joined with dots, load.ts convention). */
export const dotted = (path: Path): string => path.map(String).join('.')

/** Generic path of a concrete path: indexes become [] on the key before them. */
export function genericOf(path: Path): string {
  let out = ''
  for (const s of path) {
    if (typeof s === 'number') out += '[]'
    else out += out === '' ? s : `.${s}`
  }
  return out
}

export function jsonOf(c: WalkClient, file: JsonFile): unknown {
  return file === 'answer-key.json' ? c.key : c.onboarding
}

/** Every leaf of a parsed file, in document order. */
export function leaves(file: JsonFile, json: unknown): Leaf[] {
  const out: Leaf[] = []
  const walk = (v: unknown, path: Step[]): void => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        walk(x, [...path, i])
      })
      return
    }
    if (v !== null && typeof v === 'object') {
      for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], [...path, k])
      return
    }
    out.push({ file, path, generic: genericOf(path), value: v })
  }
  walk(json, [])
  return out
}

/** Every object node (not an array) of a parsed file, in document order, with its concrete path. */
export function objects(json: unknown): { path: Path; node: Record<string, unknown> }[] {
  const out: { path: Path; node: Record<string, unknown> }[] = []
  const walk = (v: unknown, path: Step[]): void => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        walk(x, [...path, i])
      })
      return
    }
    if (v === null || typeof v !== 'object') return
    out.push({ path, node: v as Record<string, unknown> })
    for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], [...path, k])
  }
  walk(json, [])
  return out
}

// ---- dates (RC-B) ----

/** A strict calendar date written YYYY-MM-DD (this file's own round trip, not the product's). */
export function isDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m === null) return false
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().slice(0, 10) === s
}
export const isMonth = (s: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
/** A timestamp whose first ten characters are a calendar date. */
export const isTimestamp = (s: string): boolean => /^\d{4}-\d{2}-\d{2}T/.test(s) && isDate(s.slice(0, 10))

/** A leaf that holds a date, a month or a timestamp today: the leaves the date walk must guard. */
export const isDateLeaf = (l: Leaf): l is Leaf & { value: string } =>
  typeof l.value === 'string' && (isDate(l.value) || isMonth(l.value) || isTimestamp(l.value))

/**
 * The bad values of the findings (RC-B): a day past the month, month 13, no zero padding, day/month/year, and (spec
 * review 4, gap 1) a day past the month written with dots, which the fix 4 shape takes as a three-part date.
 */
export const BAD_DATES: readonly string[] = ['2025-02-30', '2025-13', '2025-2-3', '03/02/2025', '2025.02.30']
/** The two values spec review 4 (gap 1) plants at leaves that hold no date today. */
export const NEW_DATES: readonly string[] = ['2025-02-30', '2025.02.30']

// ---- ids (RC-C) ----

/** The id shape of the findings: a two-digit client number, a tag of two to four capitals, a dash. */
export const ID_SHAPED = /^\d\d-[A-Z]{2,4}-/
export const TX_ID = /^(\d\d)-([A-Z]{2,4})-(\d{4})-(\d{2})-(\d{4})$/
export const AJE_ID = /^(\d\d)-AJE-(\d\d)$/
/** A reference leaf: id-shaped, in the answer key, and not an id a record declares for itself. */
export const isReference = (l: Leaf): l is Leaf & { value: string } =>
  l.file === 'answer-key.json' &&
  typeof l.value === 'string' &&
  ID_SHAPED.test(l.value) &&
  l.generic !== 'transactions[].id' &&
  l.generic !== 'adjustingEntries[].id'

// ---- described objects and read leaves (shared by strict-read, date-walk and id-walk) ----

export const SEED = 20261003
/** A seeded index in [0, n) (fast-check, so the pick is pinned and reproducible). */
export const pick = (n: number, seed: number): number => fc.sample(fc.integer({ min: 0, max: n - 1 }), { seed, numRuns: 1 })[0] ?? 0

/** A generic path with each statementBalances account key and each trial balance name written as "*". */
export const pattern = (generic: string): string =>
  generic.replace(/^statementBalances\.[^.[]+/, 'statementBalances.*').replace(/^trialBalance\.(opening|unadjusted|adjusted)(?=\.rows|\.total)/, 'trialBalance.*')

/**
 * The objects the loader describes (amber, spec round 3): the objects holding a key the Client model is built from,
 * a fix 3 twin, or a name the made-up-data guard reads; t2Inputs and trialBalance because fix 2 names their carried
 * parts. Spec review 4 (gap 4) adds the evidence objects round 3 starts reading (fix 5): flags[].evidence,
 * t2Inputs.schedule1, its addBacks[] and their source. New entries go last, so the seeded picks of the others keep
 * their index.
 */
export const DESCRIBED: readonly { file: JsonFile; generic: string }[] = [
  ...['', 'fiscalYear', 'accounts[]', 'transactions[]', 'transactions[].post[]', 'statementBalances.*[]', 'adjustingEntries[]', 'adjustingEntries[].lines[]'].map((g) => ({ file: 'answer-key.json' as const, generic: g })),
  ...['adjustingEntries[].source', 'trialBalance', 'trialBalance.opening', 'trialBalance.unadjusted', 'trialBalance.adjusted', 'trialBalance.*.rows[]', 'flags[]', 'parties[]', 't2Inputs'].map((g) => ({ file: 'answer-key.json' as const, generic: g })),
  ...['', 'corporation', 'prior_year_closing_balances', 'owners[]', 'shares', 'shares.holders[]', 'shareholder_loans[]', 'spouse'].map((g) => ({ file: 'onboarding.json' as const, generic: g })),
  ...['flags[].evidence', 't2Inputs.schedule1', 't2Inputs.schedule1.addBacks[]', 't2Inputs.schedule1.addBacks[].source'].map((g) => ({ file: 'answer-key.json' as const, generic: g })),
]
const DESCRIBED_LABELS: ReadonlySet<string> = new Set(DESCRIBED.map((d) => `${d.file} ${d.generic}`))

/**
 * The leaves the loader reads (amber, spec round 3): each one is held by the Client model or checked as a fix 3 twin
 * or a fiscal-year twin, so changing it must either refuse the load or change the model. Leaves only the guard reads
 * (names) are left out: changing a name need not change either.
 */
export const READ: ReadonlySet<string> = new Set([
  ...['name', 'fiscalYear.start', 'fiscalYear.end', 'fiscalYear.days'],
  ...['key', 'role', 'currency', 'file', 'qboFile', 'glAccount', 'openingBalance', 'closingBalance', 'rowsInExport', 'rowsMissingFromExport'].map((f) => `accounts[].${f}`),
  ...['id', 'acct', 'date', 'amount', 'account', 'accountNo', 'missingFromExport', 'dupOf', 'priorYear', 'post[].a', 'post[].dr', 'post[].cr'].map((f) => `transactions[].${f}`),
  ...['month', 'opening', 'closing', 'rolls', 'exportActivity'].map((f) => `statementBalances.*[].${f}`),
  ...['id', 'date', 'reason', 'amount', 'source.transactions[]', 'source.onboarding[]'].map((f) => `adjustingEntries[].${f}`),
  ...['account', 'gifi', 'gifiStatus', 'debit', 'credit'].flatMap((f) => [`adjustingEntries[].lines[].${f}`, `trialBalance.*.rows[].${f}`]),
  ...['trialBalance.*.totalDebit', 'trialBalance.*.totalCredit'],
  ...['id', 'rule', 'detail', 'severity', 'action'].map((f) => `flags[].${f}`),
].map((g) => `answer-key.json ${g}`))
export const READ_ONBOARDING: ReadonlySet<string> = new Set(
  ['corporation.business_number', 'corporation.financial_year_end', 'corporation.fiscal_year_start', 'corporation.incorporation_date', 'prior_year_closing_balances.as_of', 'owners[].name'].map((g) => `onboarding.json ${g}`),
)
/** Is this leaf one the loader reads (READ or READ_ONBOARDING)? */
export const isRead = (l: Leaf): boolean => {
  const label = `${l.file} ${pattern(l.generic)}`
  return READ.has(label) || READ_ONBOARDING.has(label)
}

/**
 * Does the made-up-data guard read this leaf: a made-up name, written ending in "(Test)" (SEC-11)? A change there is
 * refused by the guard whatever the date or id walks do, so the walk plants of spec review 4 leave these leaves out.
 */
export const isMadeUpName = (l: Leaf): boolean => typeof l.value === 'string' && l.value.endsWith('(Test)')

/** The concrete path of the object that holds a leaf: trailing array indexes dropped, then the leaf's own key. */
export function holderPath(path: Path): Path {
  let end = path.length
  while (end > 0 && typeof path[end - 1] === 'number') end--
  return path.slice(0, Math.max(0, end - 1))
}
/**
 * Is this leaf inside a carried block: the object that holds it is not one the loader describes (hst, ohip, loan,
 * t2Inputs.schedule8, prior_year and so on, whose whole subtree round 3 carries unread)?
 */
export const inCarriedBlock = (l: Leaf): boolean => !DESCRIBED_LABELS.has(`${l.file} ${pattern(genericOf(holderPath(l.path)))}`)

// ---- first occurrences ----

/** For each generic path: the first folder (folder order) that has it and its first leaf there, in document order. */
export function firstByGeneric(clients: WalkClient[], keep: (l: Leaf) => boolean): Map<string, { c: WalkClient; leaf: Leaf }> {
  const out = new Map<string, { c: WalkClient; leaf: Leaf }>()
  for (const c of clients) {
    for (const file of JSON_FILES) {
      for (const l of leaves(file, jsonOf(c, file))) {
        const label = `${file} ${l.generic}`
        if (keep(l) && !out.has(label)) out.set(label, { c, leaf: l })
      }
    }
  }
  return out
}

// ---- edits in the sandbox ----

type Holder = Record<string | number, unknown>

/** The holder of the last step of a path in a parsed copy (the fixture fails when the path is not there). */
function holderAt(json: unknown, path: Path): { holder: Holder; last: Step } {
  const last = path[path.length - 1]
  if (last === undefined) throw new Error('fixture: empty path')
  let cur: unknown = json
  for (const s of path.slice(0, -1)) {
    if (cur === null || typeof cur !== 'object') throw new Error(`fixture: no ${dotted(path)}`)
    cur = (cur as Holder)[s]
  }
  if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, last)) throw new Error(`fixture: no ${dotted(path)}`)
  return { holder: cur as Holder, last }
}

export function valueAt(json: unknown, path: Path): unknown {
  const { holder, last } = holderAt(json, path)
  return holder[last]
}

/** Sets one existing leaf of a client file in the sandbox (Sandbox.restore puts the bytes back). */
export function setLeaf(sb: Sandbox, c: WalkClient, file: JsonFile, path: Path, value: unknown): void {
  const edit = (j: unknown): void => {
    const { holder, last } = holderAt(j, path)
    holder[last] = value
  }
  if (file === 'answer-key.json') sb.editKey(c, edit)
  else sb.editOnboarding(c, edit)
}

/** The object node at path in a parsed copy (root for []). */
function nodeAt(json: unknown, path: Path): Record<string, unknown> {
  let cur: unknown = json
  for (const s of path) cur = (cur as Holder)[s]
  if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) throw new Error(`fixture: no object at ${dotted(path)}`)
  return cur as Record<string, unknown>
}

/** Renames one key of the object at path in place, keeping the key order. */
export function renameKey(sb: Sandbox, c: WalkClient, file: JsonFile, path: Path, from: string, to: string): void {
  const edit = (j: unknown): void => {
    const node = nodeAt(j, path)
    const entries = Object.entries(node).map(([k, v]): [string, unknown] => [k === from ? to : k, v])
    for (const k of Object.keys(node)) Reflect.deleteProperty(node, k)
    for (const [k, v] of entries) node[k] = v
  }
  if (file === 'answer-key.json') sb.editKey(c, edit)
  else sb.editOnboarding(c, edit)
}

/** Adds one key (last) to the object at path. */
export function addKey(sb: Sandbox, c: WalkClient, file: JsonFile, path: Path, key: string, value: unknown): void {
  const edit = (j: unknown): void => {
    nodeAt(j, path)[key] = value
  }
  if (file === 'answer-key.json') sb.editKey(c, edit)
  else sb.editOnboarding(c, edit)
}

const HOLE = 'w00c_r3_key_hole_(Test)'

/**
 * Writes `"<name>": {...}` as the first key of the object at path, as raw JSON text (so a prototype name such as
 * __proto__ reaches the file as written; an object literal could not carry it). The rest of the file is unchanged.
 */
export function writeRawKey(sb: Sandbox, c: WalkClient, file: JsonFile, path: Path, name: string): void {
  addKey(sb, c, file, path, HOLE, { 'polluted(Test)': true })
  const p = sb.path(c, file)
  const text = readFileSync(p, 'utf8')
  const out = text.replace(JSON.stringify(HOLE), JSON.stringify(name))
  if (out === text) throw new Error('fixture: the key hole was not written')
  writeFileSync(p, out)
}

// ---- one-character renames (RC-A) ----

/** The key with its last character changed to the next letter (z to y), or "_" added when it does not end in a letter. */
export function oneCharOff(key: string): string {
  const last = key.slice(-1)
  if (!/[a-zA-Z]/.test(last)) return `${key}_`
  const next = last === 'z' ? 'y' : last === 'Z' ? 'Y' : String.fromCharCode(last.charCodeAt(0) + 1)
  return key.slice(0, -1) + next
}

// ---- loading ----

export type Outcome = { ok: true; model: string } | { ok: false; issues: Issue[] }

/** Loads through the public loader from the sandbox root; a refusal must be a TestWorldLoadError (never a raw error). */
export function load(sb: Sandbox, c: WalkClient): Outcome {
  try {
    return { ok: true, model: JSON.stringify(loadClient(c.id as `C${string}`, { root: sb.root })) }
  } catch (e) {
    expect(e, `${c.id}: a refusal is a TestWorldLoadError, got ${String(e)}`).toBeInstanceOf(TestWorldLoadError)
    return { ok: false, issues: (e as TestWorldLoadError).issues }
  }
}

export function refused(sb: Sandbox, c: WalkClient, what: string): Issue[] {
  const r = load(sb, c)
  expect(r.ok, `${c.id}: ${what} should be refused`).toBe(false)
  return r.ok ? [] : r.issues
}

const text = (i: Issue): string => `${i.record} ${i.reason}`
export const show = (issues: Issue[]): string => JSON.stringify(issues.slice(0, 6))

/** The record names this path of this file: "<file> <dotted path>", alone or followed by more words. */
export function namesPath(i: Issue, file: JsonFile, path: Path): boolean {
  const p = path.length === 0 ? file : `${file} ${dotted(path)}`
  return i.record === p || i.record.startsWith(`${p} `) || i.record.startsWith(`${p}.`)
}

export function expectSome(issues: Issue[], hit: (i: Issue) => boolean, what: string): void {
  expect(issues.some(hit), `${what}; got ${show(issues)}`).toBe(true)
}

export const mentions = (i: Issue, part: string): boolean => text(i).includes(part)
