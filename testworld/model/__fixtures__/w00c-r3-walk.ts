// Spec-owned helpers for the W00c round 3 acceptance tests (reports/W00c-findings-3.md, RC-A, RC-B, RC-C).
//
// Every case comes from a walk over the parsed sample files of every numbered folder (walkClients in sample-walk.ts),
// never from a typed list of values: the leaf walk below finds every date-shaped and id-shaped string, and every object
// node at a described path, with this file's own code. Nothing here imports the module under test except through the
// public loader in sample-walk.ts.
import { readFileSync, writeFileSync } from 'node:fs'
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

/** The four bad values of the findings (RC-B): a day past the month, month 13, no zero padding, and day/month/year. */
export const BAD_DATES: readonly string[] = ['2025-02-30', '2025-13', '2025-2-3', '03/02/2025']

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
