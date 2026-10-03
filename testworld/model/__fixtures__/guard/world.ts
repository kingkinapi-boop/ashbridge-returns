// Spec-owned helpers for the W00b acceptance tests (findings W00 r2 RC1, RC4, S1 to S4, S8).
//
// Every case comes from a walk over the numbered folders of reference/sample-clients/ (all 15 today), never from a
// typed list: a folder or a kind a later card adds is walked with no change here. The walk and the Luhn check are
// written here on purpose (no product module), so the expected answers never come from the code under test.
// No real-looking number is written in this file: every number that passes its check digit is computed at run time.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
export const MODEL_DIR = resolve(HERE, '..', '..')
export const SAMPLE_ROOT = resolve(MODEL_DIR, '..', '..', 'reference', 'sample-clients')

// ---- the walk ----

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type Step = string | number

/** One leaf of a JSON document: its pattern path (array indices written "[]") and its concrete steps. */
export interface Leaf {
  pattern: string
  steps: Step[]
  value: null | boolean | number | string
}

/** The pattern path of a list of steps: keys joined by ".", each array index written "[]" after its key. */
export function patternOf(steps: readonly Step[]): string {
  let out = ''
  for (const s of steps) {
    if (typeof s === 'number') out += '[]'
    else out += out === '' ? s : `.${s}`
  }
  return out
}

export function leaves(doc: Json): Leaf[] {
  const out: Leaf[] = []
  const walk = (v: Json, steps: Step[]): void => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        walk(x, [...steps, i])
      })
    } else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, [...steps, k])
    } else out.push({ pattern: patternOf(steps), steps, value: v })
  }
  walk(doc, [])
  return out
}

export interface SampleFolder {
  /** C01 upward, from the folder's two-digit number. */
  id: string
  /** The folder name, for example "01-maple-ridge". */
  name: string
  dir: string
}

/** Every numbered sample folder that has an answer key, in folder order. */
export function sampleFolders(): SampleFolder[] {
  return readdirSync(SAMPLE_ROOT)
    .sort()
    .filter((n) => /^\d\d-/.test(n) && existsSync(join(SAMPLE_ROOT, n, 'answer-key.json')))
    .map((name) => ({ id: `C${name.slice(0, 2)}`, name, dir: join(SAMPLE_ROOT, name) }))
}

/** Every file of a folder, relative with "/" separators, in sorted order. */
export function filesIn(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else out.push(relative(dir, full).split(sep).join('/'))
    }
  }
  walk(dir)
  return out
}

export const readJson = (path: string): Json => JSON.parse(readFileSync(path, 'utf8')) as Json

/** One JSON leaf as found in a sample folder. */
export interface SampleLeaf extends Leaf {
  folder: SampleFolder
  file: string
}

let walked: SampleLeaf[] | undefined

/** Every leaf of every JSON file of every sample folder (walked once per test file; the samples never change). */
export function sampleLeaves(): SampleLeaf[] {
  if (walked !== undefined) return walked
  const out: SampleLeaf[] = []
  for (const folder of sampleFolders()) {
    for (const file of filesIn(folder.dir).filter((f) => f.endsWith('.json'))) {
      for (const leaf of leaves(readJson(join(folder.dir, file)))) out.push({ ...leaf, folder, file })
    }
  }
  walked = out
  return out
}

/** The distinct pattern paths of the samples, sorted. */
export function samplePatterns(): string[] {
  return [...new Set(sampleLeaves().map((l) => l.pattern))].sort()
}

const endsTest = (v: unknown): v is string => typeof v === 'string' && /\(Test\)$/.test(v)

/**
 * Name paths, by the walk: a pattern whose every sample value is a string ending "(Test)". For each, the first
 * leaf found (folder order, then file, then document order), where a test plants the bare name.
 */
export function namePathPlants(): SampleLeaf[] {
  const all = sampleLeaves()
  const byPattern = new Map<string, SampleLeaf[]>()
  for (const l of all) {
    const list = byPattern.get(l.pattern)
    if (list === undefined) byPattern.set(l.pattern, [l])
    else list.push(l)
  }
  const out: SampleLeaf[] = []
  for (const [, ls] of [...byPattern].sort(([a], [b]) => a.localeCompare(b))) {
    const first = ls[0]
    if (first !== undefined && ls.every((l) => endsTest(l.value))) out.push(first)
  }
  return out
}

export const bare = (name: string): string => name.replace(/\s*\(Test\)$/, '')

/** The persons a sample folder declares: answer-key parties of kind "person", as written (with "(Test)"). */
export function declaredPersons(folder: SampleFolder): string[] {
  const key = readJson(join(folder.dir, 'answer-key.json')) as { parties?: { name: string; kind?: string }[] }
  return (key.parties ?? []).filter((p) => p.kind === 'person').map((p) => p.name)
}

// ---- JSON edits ----

export function setAt(doc: Json, steps: readonly Step[], value: Json): void {
  let cur: Json = doc
  for (const s of steps.slice(0, -1)) {
    const next: Json | undefined = Array.isArray(cur) ? cur[Number(s)] : cur !== null && typeof cur === 'object' ? cur[String(s)] : undefined
    if (next === undefined) throw new Error(`fixture: no ${patternOf(steps)}`)
    cur = next
  }
  const last = steps.at(-1)
  if (Array.isArray(cur) && typeof last === 'number') cur[last] = value
  else if (cur !== null && typeof cur === 'object' && !Array.isArray(cur) && typeof last === 'string') cur[last] = value
  else throw new Error(`fixture: cannot set ${patternOf(steps)}`)
}

/**
 * The smallest document that still holds one leaf at the same pattern path: every object keeps only the key on the
 * way, every array only the element on the way (moved to index 0). Returns the document and the leaf's new steps.
 */
export function pruneTo(doc: Json, steps: readonly Step[]): { doc: Json; steps: Step[] } {
  const build = (v: Json, i: number): Json => {
    if (i === steps.length) return v
    const s = steps[i]
    if (Array.isArray(v) && typeof s === 'number') {
      const x = v[s]
      if (x === undefined) throw new Error(`fixture: no ${patternOf(steps)}`)
      return [build(x, i + 1)]
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof s === 'string') {
      const x = v[s]
      if (x === undefined) throw new Error(`fixture: no ${patternOf(steps)}`)
      return { [s]: build(x, i + 1) }
    }
    throw new Error(`fixture: cannot follow ${patternOf(steps)}`)
  }
  return { doc: build(doc, 0), steps: steps.map((s) => (typeof s === 'number' ? 0 : s)) }
}

/** Rewrites one JSON file in place (a temp copy, never the samples). */
export function editJson(path: string, edit: (doc: Json) => void): void {
  const doc = readJson(path)
  edit(doc)
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n')
}

// ---- temp folders ----

const made: string[] = []

/** A fresh temp folder holding the given files (relative paths, nested folders made as needed). */
export function tempFolder(files: Record<string, string | Uint8Array>): string {
  const dir = mkdtempSync(join(tmpdir(), 'w00b-guard-'))
  made.push(dir)
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, body)
  }
  return dir
}

/** A temp copy of one sample folder, as `<temp>/<folder name>`; returns the temp root and the copy. */
export function copyFolder(folder: SampleFolder): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), 'w00b-sample-'))
  made.push(root)
  const dir = join(root, folder.name)
  cpSync(folder.dir, dir, { recursive: true })
  return { root, dir }
}

export function removeTemps(): void {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true })
}

// ---- check digits and shapes (all computed, never written) ----

/** Independent Luhn check (the business-number and SIN check digit). */
export function luhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

/** Eight digits plus the check digit that makes them pass (a real-looking number). */
export function withCheckDigit(first8: string): string {
  for (let k = 0; k < 10; k++) if (luhnValid(first8 + String(k))) return first8 + String(k)
  throw new Error('fixture: no check digit')
}

/** Eight digits plus a check digit that makes them fail (a made-up number). */
export function withWrongDigit(first8: string): string {
  const good = withCheckDigit(first8)
  return first8 + String((Number(good.slice(8)) + 1) % 10)
}

export const NBSP = String.fromCharCode(0xa0)
export const EN_DASH = String.fromCharCode(0x2013)

/** The separators one gap of a nine-digit number may hold: none, space, hyphen, dot, slash, NBSP, en dash, comma. */
export const NINE_SEPARATORS = ['', ' ', '-', '.', '/', NBSP, EN_DASH, ','] as const
export const NINE_PREFIXES = ['', 'BN.', 'BN ', 'BN', 'SIN:', 'SIN: ', '#'] as const
export const NINE_SUFFIXES = ['', 'RT0001', ' RT0001', 'RC0001', '.'] as const

/** Digits 0 to 9 written full width (U+FF10 to U+FF19); NFKC turns them back into ASCII digits. */
export const fullWidth = (s: string): string => s.replace(/\d/g, (d) => String.fromCodePoint(0xff10 + Number(d)))

export interface NineShape {
  sep1: string
  sep2: string
  prefix: string
  suffix: string
  wide: boolean
}

export function writeNine(digits: string, s: NineShape): string {
  const body = `${digits.slice(0, 3)}${s.sep1}${digits.slice(3, 6)}${s.sep2}${digits.slice(6, 9)}`
  return `${s.prefix}${s.wide ? fullWidth(body) : body}${s.suffix}`
}

// ---- the product API, read loosely so a missing export fails by name ----

export interface Finding {
  record: string
  reason: string
}

export type FieldClass = 'name' | 'id-number' | 'free-text' | 'code' | 'money' | 'other'
/** 'money' (round 3, card decision): a JSON number at a money path is not a nine-digit candidate; a string there is. */
export const FIELD_CLASSES: readonly FieldClass[] = ['name', 'id-number', 'free-text', 'code', 'money', 'other']

interface GuardApi {
  guardFolder: (folder: string) => unknown
  guardValue: (value: unknown) => unknown
}

/** The W00b exports of testworld/model/guard.ts; a missing one throws naming it. */
export async function guardApi(): Promise<GuardApi> {
  const mod = (await import('../../guard')) as Record<string, unknown>
  const pick = (name: keyof GuardApi): ((x: unknown) => unknown) => {
    const f = mod[name]
    if (typeof f !== 'function') throw new Error(`${name} is not exported from testworld/model/guard.ts (W00b not built)`)
    return f as (x: unknown) => unknown
  }
  return { guardFolder: pick('guardFolder'), guardValue: pick('guardValue') }
}

/** classOf from testworld/model/guard-fields.ts (the closed field table); a missing module or export fails by name. */
export async function classOfApi(): Promise<(pattern: string) => unknown> {
  const url = pathToFileURL(join(MODEL_DIR, 'guard-fields.ts')).href
  const mod = (await import(/* @vite-ignore */ url)) as Record<string, unknown>
  const f = mod['classOf']
  if (typeof f !== 'function') throw new Error('classOf is not exported from testworld/model/guard-fields.ts (W00b not built)')
  return f as (pattern: string) => unknown
}

/** A guard result as a list of findings (sync or async); anything else fails here. */
export async function asFindings(result: unknown): Promise<Finding[]> {
  const r: unknown = await Promise.resolve(result)
  expect(Array.isArray(r), `the guard should return a list of findings, got ${JSON.stringify(r)}`).toBe(true)
  const list = r as unknown[]
  for (const f of list) {
    const x = f as Partial<Finding>
    expect(typeof x.record === 'string' && typeof x.reason === 'string', `a finding has a record and a reason: ${JSON.stringify(f)}`).toBe(true)
    expect((x.reason ?? '').trim().length, `a finding gives its reason: ${JSON.stringify(f)}`).toBeGreaterThan(0)
  }
  return list as Finding[]
}

export async function folderFindings(dir: string): Promise<Finding[]> {
  const g = await guardApi()
  return asFindings(g.guardFolder(dir))
}

export async function valueFindings(value: unknown): Promise<Finding[]> {
  const g = await guardApi()
  return asFindings(g.guardValue(value))
}

const label = (f: Finding): string => `${f.record} ${f.reason}`

/** Some finding's reason matches and its record or reason holds every hint (one of each alternative list). */
export function expectFinding(findings: Finding[], reason: RegExp, ...hints: (string | string[])[]): void {
  const hit = findings.some(
    (f) => reason.test(f.reason) && hints.every((h) => (Array.isArray(h) ? h : [h]).some((x) => label(f).includes(x))),
  )
  expect(hit, `expected a finding matching ${String(reason)} naming ${JSON.stringify(hints)}; got ${JSON.stringify(findings)}`).toBe(true)
}

/** As expectFinding, among the findings that were not there before the plant (a sample may already fail). */
export function expectNewFinding(before: Finding[], after: Finding[], reason: RegExp, ...hints: (string | string[])[]): void {
  const old = new Set(before.map((f) => JSON.stringify([f.record, f.reason])))
  expectFinding(
    after.filter((f) => !old.has(JSON.stringify([f.record, f.reason]))),
    reason,
    ...hints,
  )
}

export function expectNoFinding(findings: Finding[], reason: RegExp): void {
  const hits = findings.filter((f) => reason.test(f.reason))
  expect(hits, `expected no finding matching ${String(reason)}`).toEqual([])
}

export const CHECK_DIGIT = /check digit/i
export const PHONE = /phone/i
export const NAME_TEST = /\(Test\)/
export const PERSON_IN_TEXT = /\(Test\)|TEST/
export const UNCLASSIFIED = /unclassified/i
export const CANNOT_CHECK = /cannot be checked/i
export const NOT_UTF8 = /UTF-8|cannot be checked/i

// ---- round 3 (reports/W00b-spec-review.md gaps 1 to 10) ----

export const REPEATED = /repeat|duplicate|twice|more than once/i
export const LINK = /link|outside/i
export const EMAIL = /e-?mail/i
export const CARD = /check digit|card/i

/** Every JSON node the samples hold, by pattern: object nodes with the keys seen, and lists that hold a scalar. */
export interface SampleNodes {
  objects: Map<string, Set<string>>
  scalarLists: Set<string>
}

export function sampleNodes(): SampleNodes {
  const objects = new Map<string, Set<string>>()
  const scalarLists = new Set<string>()
  const walk = (v: Json, steps: Step[]): void => {
    if (Array.isArray(v)) {
      if (v.some((x) => x === null || typeof x !== 'object')) scalarLists.add(patternOf(steps))
      v.forEach((x, i) => {
        walk(x, [...steps, i])
      })
    } else if (v !== null && typeof v === 'object') {
      const p = patternOf(steps)
      const keys = objects.get(p) ?? new Set<string>()
      objects.set(p, keys)
      for (const [k, x] of Object.entries(v)) {
        keys.add(k)
        walk(x, [...steps, k])
      }
    }
  }
  for (const folder of sampleFolders()) {
    for (const file of filesIn(folder.dir).filter((f) => f.endsWith('.json'))) walk(readJson(join(folder.dir, file)), [])
  }
  return { objects, scalarLists }
}

/** A key that is data, not a field name: it holds a digit or is all capitals (months, account keys such as CHQ). */
export const isDataKey = (k: string): boolean => /\d/.test(k) || /^[A-Z][A-Z0-9_-]*$/.test(k)

/** A pattern one key deeper. */
export const under = (pattern: string, key: string): string => (pattern === '' ? key : `${pattern}.${key}`)

/** Every code point that is a space separator (Zs) or a dash (Pd), computed by the engine, never typed. */
export function spaceAndDashCodePoints(): string[] {
  const out: string[] = []
  const re = /^[\p{Zs}\p{Pd}]$/u
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue
    const ch = String.fromCodePoint(cp)
    if (re.test(ch)) out.push(ch)
  }
  return out
}

/** Nine digits with a separator (or none) in each of the 8 gaps. */
export function joinNine(digits: string, gaps: readonly string[]): string {
  let out = ''
  for (let i = 0; i < 9; i++) out += `${digits[i] ?? ''}${i < 8 ? (gaps[i] ?? '') : ''}`
  return out
}

/** An ISO date or month written with ASCII hyphens (after NFKC): a shape the guard reads as a date, not a number. */
export const ISO_DATE_SHAPE = /(?:19|20)\d\d-(?:0[1-9]|1[0-2])/

/** Any ASCII from "!" to "~" written full width (U+FF01 to U+FF5E); NFKC turns it back. */
export const fullWidthAscii = (s: string): string => s.replace(/[!-~]/g, (c) => String.fromCodePoint((c.codePointAt(0) ?? 0) + 0xfee0))

/** A number of any length plus the Luhn digit that makes it pass, or one that makes it fail. */
export function luhnComplete(body: string): string {
  for (let k = 0; k < 10; k++) if (luhnValid(body + String(k))) return body + String(k)
  throw new Error('fixture: no check digit')
}
export function luhnBroken(body: string): string {
  const good = luhnComplete(body)
  return body + String((Number(good.slice(-1)) + 1) % 10)
}

/** A symbolic link (file or folder); `target` is absolute or relative to the link's folder. */
export function link(target: string, at: string, kind: 'file' | 'dir' = 'file'): void {
  mkdirSync(dirname(at), { recursive: true })
  symlinkSync(target, at, kind)
}

/** The outcome of asking for something that must be refused: the error it threw, or the findings it gave. */
export type Refusal = { threw: unknown; findings: Finding[] | undefined }

/** Calls the guard and keeps a throw as a refusal (fail closed); a returned result must be a list of findings. */
export async function attempt(call: () => unknown): Promise<Refusal> {
  let result: unknown
  try {
    result = await Promise.resolve().then(call)
  } catch (e) {
    return { threw: e, findings: undefined }
  }
  return { threw: undefined, findings: await asFindings(result) }
}

/** Refused: it threw (not a stack overflow), or it gave at least one finding, naming each hint when hints are given. */
export function expectRefused(r: Refusal, ...hints: string[]): void {
  if (r.findings === undefined) {
    expect(r.threw instanceof RangeError, `a refusal, not a stack overflow: ${String(r.threw)}`).toBe(false)
    return
  }
  expect(r.findings.length, 'a refusal gives at least one finding (never [])').toBeGreaterThan(0)
  for (const h of hints) {
    expect(
      r.findings.some((f) => label(f).includes(h)),
      `a finding names ${h}: ${JSON.stringify(r.findings)}`,
    ).toBe(true)
  }
}
