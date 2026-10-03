// SC: schema and contract rules, database side (db project). Card plan/cards/SC.md; clauses SEC-7, EV-1, ARC-10,
// EV-8, EV-10, FLOW-1, EV-5. Each rule reads the catalog of the clone the db project gives (the template built by
// createTemplate from the real schema), first catching a planted bad table created in the test's own clone
// (tools/test/__fixtures__/schema-contract/db/), then applied to every table in schema returns.
//
// Rules that read a contract list load it from src/contracts at run time: records.ts (R15, R42), text.ts
// VALUE_COLUMNS (R13: the text columns where an empty value is a value, each with its reason) and ids.ts
// FUTURE_POINTERS (R43: pointer ids to tables not built yet, each naming the card that builds the table).
// A rule with nothing to check fails: on main before F01 lands there is no schema returns.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { cloneTestDb } from '../core/db'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLANTS = path.join(HERE, '..', '..', 'tools', 'test', '__fixtures__', 'schema-contract', 'db')
const plant = (name: string): string => fs.readFileSync(path.join(PLANTS, name), 'utf8')

type Module = Record<string, unknown>
async function loadContract(file: string): Promise<Module | null> {
  const abs = path.join(HERE, file)
  if (!fs.existsSync(abs)) return null
  return (await import(/* @vite-ignore */ pathToFileURL(abs).href)) as Module
}
function stringRecord(v: unknown): Record<string, string> | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null
  const entries: [string, unknown][] = Object.entries(v)
  const out: Record<string, string> = {}
  for (const [k, x] of entries) {
    if (typeof x !== 'string') return null
    out[k] = x
  }
  return out
}
function stringLists(mod: Module): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {}
  for (const [name, v] of Object.entries(mod)) {
    if (!Array.isArray(v) || v.length === 0) continue
    const items: unknown[] = v
    if (items.every((x): x is string => typeof x === 'string')) out[name] = items
  }
  return out
}

// ---------- known defects on main: tools/test/__fixtures__/schema-contract/known.json, "db" side (A407) ----------
// An entry is { rule, file, problems: [exact strings], owner, why }. For the database rules the file is the one
// subject every problem string leads with (a table, a table.column, or the bound's label for R55). Any problem not
// listed fails, a listed string no longer printed fails as stale, and the owner is an open card in plan/slices.json.
type KnownEntry = { rule: string; file: string; problems: readonly string[]; owner: string; why?: string }
const ROOT = path.join(HERE, '..', '..')
const KNOWN_PATH = path.join(PLANTS, '..', 'known.json')
const readJson = (abs: string): unknown => JSON.parse(fs.readFileSync(abs, 'utf8'))
function knownDb(): unknown[] {
  const all = readJson(KNOWN_PATH)
  const db = all !== null && typeof all === 'object' ? (all as Record<string, unknown>)['db'] : undefined
  return Array.isArray(db) ? (db as unknown[]) : []
}
const KNOWN = knownDb() as readonly KnownEntry[]
const KNOWN_KEYS = new Set(['rule', 'file', 'problems', 'owner', 'why'])
const CLOSED = new Set(['done', 'parked'])
// Only a fix card may own a KNOWN entry (spec review 3 gap 1, A415).
const FIX_CARDS = new Set(['FX3', 'FX4', 'FX5', 'FX6', 'FX7', 'FX8', 'FX9'])
// Plant tests pass these pinned statuses; only the real-data shape test reads plan/slices.json (spec review 3 gap 2).
const PINNED_STATUSES = new Map<string, string>([
  ['FX3', 'carded'], ['FX6', 'done'], ['W16', 'carded'],
])
/** A scan that read nothing, or missed its named sentinel (the same message shape as the file rules' scanProblems). */
function scanProblems(label: string, items: readonly string[], sentinel: string): string[] {
  if (items.length === 0) return [`${label}: the scan read no file`]
  return items.includes(sentinel) ? [] : [`${label}: the scan missed its sentinel ${sentinel}`]
}
function cardStatuses(): Map<string, string> {
  const slices = readJson(path.join(ROOT, 'plan', 'slices.json')) as { cards: { id: string; status: string }[] }
  return new Map(slices.cards.map((c) => [c.id, c.status]))
}
/** The subject a database problem leads with: the text before the first ": " or space. */
const leadingSubject = (p: string): string => /^[^\s:]+/.exec(p)?.[0] ?? ''
const DB_RULES = (): Set<string> => new Set([...fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').matchAll(/onlyKnown\('([^']+)'/g)].map((m) => m[1] ?? ''))
function knownShapeProblems(entries: readonly unknown[], statuses: Map<string, string>, rules: Set<string>): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  entries.forEach((raw, i) => {
    const k = (raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
    const at = `KNOWN[${String(i)}] ${String(k['rule'])} ${String(k['file'])}`
    for (const key of Object.keys(k)) if (!KNOWN_KEYS.has(key)) problems.push(`${at}: the key ${key} is not one of rule, file, problems, owner, why`)
    const rule = k['rule']
    if (typeof rule !== 'string' || !rules.has(rule)) problems.push(`${at}: the rule is not one whose test reads KNOWN`)
    const file = k['file']
    if (typeof file !== 'string' || !/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*){0,2}$/.test(file)) problems.push(`${at}: the file is not one table, table.column or label`)
    const list = k['problems']
    if (!Array.isArray(list) || list.length === 0) problems.push(`${at}: problems is not a non-empty list`)
    for (const p of Array.isArray(list) ? (list as unknown[]) : []) {
      if (typeof p !== 'string' || p === '') {
        problems.push(`${at}: a problem that is not a literal string (${Object.prototype.toString.call(p)})`)
        continue
      }
      if (seen.has(p)) problems.push(`${at}: the problem ${JSON.stringify(p)} is listed twice`)
      seen.add(p)
      if (leadingSubject(p) !== file) problems.push(`${at}: the problem names another subject (${leadingSubject(p)})`)
    }
    const owner = k['owner']
    if (typeof owner !== 'string' || !FIX_CARDS.has(owner)) problems.push(`${at}: the owner ${JSON.stringify(owner)} is not a fix card (FX3 to FX9)`)
    const status = typeof owner === 'string' ? statuses.get(owner) : undefined
    if (status === undefined) problems.push(`${at}: the owner ${JSON.stringify(owner)} is not a card in plan/slices.json`)
    else if (CLOSED.has(status)) problems.push(`${at}: the owner ${String(owner)} is ${status}, so it can never fix the defect`)
  })
  return problems
}
function onlyKnown(rule: string, problems: readonly string[], known: readonly KnownEntry[] = KNOWN): string[] {
  const mine = known.filter((k) => k.rule === rule)
  const listed = new Set(mine.flatMap((k) => k.problems))
  const unknown = problems.filter((p) => !listed.has(p))
  const stale = mine.flatMap((k) =>
    k.problems.filter((s) => !problems.includes(s)).map((s) => `stale KNOWN entry ${k.rule} ${k.file} (owner ${k.owner}): ${JSON.stringify(s)} no longer fails; remove it`),
  )
  return [...new Set(unknown), ...stale]
}

// ---------- the catalog ----------
type Column = { table: string; column: string; type: string; base: string; notnull: boolean; identity: string; num: number }
type Check = { table: string; name: string; def: string; cols: number[] }
type Trigger = { table: string; name: string; type: number; src: string; args: string }
type ForeignKey = { table: string; cols: number[]; target: string }
type Catalog = { tables: string[]; columns: Column[]; checks: Check[]; domainChecks: Map<string, string[]>; triggers: Trigger[]; fks: ForeignKey[] }

async function catalog(db: PGlite): Promise<Catalog> {
  const tables = (
    await db.query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'returns' and c.relkind in ('r', 'p') order by 1`,
    )
  ).rows.map((r) => r.name)
  const columns = (
    await db.query<Column>(
      `select c.relname as table, a.attname as column, format_type(a.atttypid, a.atttypmod) as type,
              bt.typname as base, a.attnotnull as notnull, a.attidentity::text as identity, a.attnum::int as num
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_type t on t.oid = a.atttypid
       join pg_type bt on bt.oid = case when t.typtype = 'd' then t.typbasetype else t.oid end
       where n.nspname = 'returns' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
       order by 1, a.attnum`,
    )
  ).rows
  const checks = (
    await db.query<Check>(
      `select c.relname as table, con.conname as name, pg_get_constraintdef(con.oid) as def,
              array_to_json(con.conkey) as cols
       from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'returns' and con.contype = 'c' order by 1, 2`,
    )
  ).rows
  const domainRows = (
    await db.query<{ type: string; def: string }>(
      `select format_type(t.oid, null) as type, pg_get_constraintdef(con.oid) as def
       from pg_constraint con join pg_type t on t.oid = con.contypid where con.contype = 'c'`,
    )
  ).rows
  const domainChecks = new Map<string, string[]>()
  for (const r of domainRows) domainChecks.set(r.type, [...(domainChecks.get(r.type) ?? []), r.def])
  const triggers = (
    await db.query<Trigger>(
      `select c.relname as table, t.tgname as name, t.tgtype::int as type, p.prosrc as src,
              encode(t.tgargs, 'escape') as args
       from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
       join pg_proc p on p.oid = t.tgfoid
       where n.nspname = 'returns' and not t.tgisinternal order by 1, 2`,
    )
  ).rows
  const fks = (
    await db.query<ForeignKey>(
      `select c.relname as table, array_to_json(con.conkey) as cols, tc.relname as target
       from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
       join pg_class tc on tc.oid = con.confrelid
       where n.nspname = 'returns' and con.contype = 'f'`,
    )
  ).rows
  return { tables, columns, checks, domainChecks, triggers, fks }
}
const only = (cat: Catalog, keep: (table: string) => boolean): Catalog => ({
  ...cat,
  tables: cat.tables.filter(keep),
  columns: cat.columns.filter((c) => keep(c.table)),
  checks: cat.checks.filter((c) => keep(c.table)),
  triggers: cat.triggers.filter((t) => keep(t.table)),
  fks: cat.fks.filter((f) => keep(f.table)),
})
const planted = (t: string): boolean => t.startsWith('planted_')
const real = (t: string): boolean => !t.startsWith('planted_')

// Probe: one temp table per real column, with the column's own type (so a domain's checks come along) and every
// CHECK of the real table that reads that column alone. It answers whether the column accepts a value. Temp tables
// live in the test's clone and go when the clone is closed.
const probes = new WeakMap<PGlite, Map<string, string>>()
let probeNo = 0
const quoteIdent = (s: string): string => `"${s.replace(/"/g, '""')}"`
async function probeFor(db: PGlite, cat: Catalog, col: Column): Promise<string> {
  const mine = probes.get(db) ?? new Map<string, string>()
  probes.set(db, mine)
  const key = `${col.table}.${col.column}`
  const known = mine.get(key)
  if (known !== undefined) return known
  probeNo += 1
  const probe = `sc_probe_${String(probeNo)}`
  await db.exec(`create temp table ${probe} (${quoteIdent(col.column)} ${col.type})`)
  for (const [i, c] of cat.checks.filter((k) => k.table === col.table && k.cols.length === 1 && k.cols[0] === col.num).entries()) {
    await db.exec(`alter table ${probe} add constraint ${probe}_c${String(i)} ${c.def}`)
  }
  mine.set(key, probe)
  return probe
}
async function accepts(db: PGlite, cat: Catalog, col: Column, value: string): Promise<boolean> {
  const probe = await probeFor(db, cat, col)
  try {
    await db.query(`insert into ${probe} values ($1)`, [value])
    return true
  } catch {
    return false
  }
}
const isText = (c: Column): boolean => ['text', 'varchar', 'bpchar'].includes(c.base)

// ---------- R12: a table that refuses UPDATE or DELETE also refuses TRUNCATE ----------
const ROW_DELETE = 8
const ROW_UPDATE = 16
const TRUNCATE = 32
function truncateProblems(cat: Catalog): { checked: number; seen: string[]; problems: string[] } {
  const refusing = cat.tables.filter((t) =>
    cat.triggers.some((g) => g.table === t && (g.type & (ROW_DELETE | ROW_UPDATE)) !== 0 && /raise\s+exception/i.test(g.src)),
  )
  const problems = refusing
    .filter((t) => !cat.triggers.some((g) => g.table === t && (g.type & TRUNCATE) !== 0 && /raise\s+exception/i.test(g.src)))
    .map((t) => `returns.${t}: refuses UPDATE or DELETE but not TRUNCATE`)
  return { checked: refusing.length, seen: refusing.map((t) => `returns.${t}`), problems }
}

// ---------- R13: every text column outside the value allow-list refuses every blank ----------
// The blank sample set of F01 round 3 (findings F01 r2, S2) plus more of the class.
const BLANKS = ['', ' ', '  ', '\t', '\n', '\r\n', ' ', '​', '　', '⠀', '\u0085', '͏', 'ㅤ', '﻿', '⁠', ' ​ ']
async function blankProblems(db: PGlite, cat: Catalog, valueColumns: Record<string, string>): Promise<{ checked: number; seen: string[]; problems: string[] }> {
  const problems: string[] = []
  const textCols = cat.columns.filter(isText)
  for (const [key, reason] of Object.entries(valueColumns)) {
    if (!textCols.some((c) => `${c.table}.${c.column}` === key) && !key.startsWith('planted_')) problems.push(`VALUE_COLUMNS names ${key}, which is not a text column of schema returns`)
    if (reason.trim() === '') problems.push(`VALUE_COLUMNS gives no reason for ${key}`)
  }
  const checked = textCols.filter((c) => !(`${c.table}.${c.column}` in valueColumns))
  for (const col of checked) {
    for (const b of BLANKS) {
      if (await accepts(db, cat, col, b)) {
        problems.push(`returns.${col.table}.${col.column} accepts the blank ${JSON.stringify(b)}`)
        break
      }
    }
  }
  return { checked: checked.length, seen: checked.map((c) => `returns.${c.table}.${c.column}`), problems }
}

// ---------- R14: every version_stamp column refuses {}, {"x":null} and {"x":""} ----------
const STAMP_BAD = ['{}', '{"x":null}', '{"x":""}']
async function stampProblems(db: PGlite, cat: Catalog): Promise<{ checked: number; seen: string[]; problems: string[] }> {
  const cols = cat.columns.filter((c) => c.column === 'version_stamp')
  const problems: string[] = []
  for (const col of cols) {
    for (const v of STAMP_BAD) if (await accepts(db, cat, col, v)) problems.push(`returns.${col.table}.version_stamp accepts ${v}`)
  }
  return { checked: cols.length, seen: cols.map((c) => `returns.${c.table}.${c.column}`), problems }
}

// ---------- R15: every state, *_state, status, origin and entry_type column has a CHECK equal to its records.ts list ----------
const STATE_COLUMN = /^(state|.*_state|status|origin|entry_type)$/
function checkLiterals(def: string): string[] | null {
  if (!/= ANY \(ARRAY\[|\bIN \(/i.test(def)) return null
  return [...def.matchAll(/'((?:[^']|'')*)'/g)].map((m) => (m[1] ?? '').replace(/''/g, "'"))
}
async function stateListProblems(
  db: PGlite,
  cat: Catalog,
  lists: Record<string, readonly string[]>,
): Promise<{ checked: number; seen: string[]; problems: string[] }> {
  const cols = cat.columns.filter((c) => STATE_COLUMN.test(c.column))
  const problems: string[] = []
  for (const col of cols) {
    const where = `returns.${col.table}.${col.column}`
    const defs = [
      ...cat.checks.filter((k) => k.table === col.table && k.cols.length === 1 && k.cols[0] === col.num).map((k) => k.def),
      ...(cat.domainChecks.get(col.type) ?? []),
    ]
    const literal = defs.map(checkLiterals).find((x): x is string[] => x !== null)
    if (literal === undefined) {
      problems.push(`${where}: no CHECK with a list of values`)
      continue
    }
    const match = Object.entries(lists).find(([, l]) => l.length === literal.length && l.every((x) => literal.includes(x)) && new Set(literal).size === literal.length)
    if (match === undefined) {
      problems.push(`${where}: its CHECK list ${JSON.stringify(literal)} equals no list in records.ts`)
      continue
    }
    for (const v of match[1]) if (!(await accepts(db, cat, col, v))) problems.push(`${where}: refuses ${JSON.stringify(v)} of ${match[0]}`)
    if (await accepts(db, cat, col, 'not-a-value (Test)')) problems.push(`${where}: accepts a value outside ${match[0]}`)
  }
  return { checked: cols.length, seen: cols.map((c) => `returns.${c.table}.${c.column}`), problems }
}

// ---------- R41 (SQL side): one blank definition ----------
/** The CHECKs R41 reads, by the label its problems lead with. */
const checkLabels = (cat: Catalog): string[] => cat.checks.map((c) => `returns.${c.table} ${c.name}`)
function blankDefinitionProblems(cat: Catalog): string[] {
  const defs = [...cat.checks.map((c) => ({ where: `returns.${c.table} ${c.name}`, def: c.def }))]
  for (const [type, ds] of cat.domainChecks) for (const def of ds) defs.push({ where: `domain ${type}`, def })
  return defs
    .filter((d) => /\bbtrim\(|\btrim\(|\[\[:space:\]\]|\\s/i.test(d.def))
    .map((d) => `${d.where}: a private blank rule (${d.def.slice(0, 80)}); use returns.is_blank`)
}

// ---------- R42: SQL and zod agree field by field, both ways ----------
type ZodObj = z.ZodObject
const isZodObject = (v: unknown): v is ZodObj => v instanceof z.ZodObject
function tableFor(schemaName: string): string {
  const snake = schemaName
    .replace(/RecordSchema$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
  return snake.endsWith('y') ? `${snake.slice(0, -1)}ies` : snake.endsWith('s') ? `${snake}es` : `${snake}s`
}
async function parityProblems(
  db: PGlite,
  cat: Catalog,
  pairs: readonly { key: string; schema: ZodObj; table: string }[],
  valueColumns: Record<string, string>,
): Promise<{ checked: number; seen: string[]; problems: string[] }> {
  const problems: string[] = []
  const seen: string[] = []
  let checked = 0
  for (const t of cat.tables) if (!pairs.some((p) => p.table === t)) problems.push(`returns.${t}: no record schema`)
  for (const { key, schema, table } of pairs) {
    if (!cat.tables.includes(table)) {
      problems.push(`${key}: no table returns.${table}`)
      continue
    }
    const shape = schema.shape as Record<string, z.ZodType>
    const cols = cat.columns.filter((c) => c.table === table)
    for (const c of cols) if (!(c.column in shape)) problems.push(`${key}: no field for column ${table}.${c.column}`)
    for (const f of Object.keys(shape)) if (!cols.some((c) => c.column === f)) problems.push(`${key}.${f}: no column ${table}.${f}`)
    for (const col of cols) {
      const field = shape[col.column]
      if (field === undefined) continue
      checked += 1
      seen.push(`returns.${table}.${col.column}`)
      const where = `${key}.${col.column}`
      if (field.safeParse(null).success !== !col.notnull) problems.push(`${where}: nullable in ${col.notnull ? 'zod' : 'SQL'} only`)
      if (!isText(col)) continue
      if (`${table}.${col.column}` in valueColumns) {
        if (!field.safeParse('').success) problems.push(`${where}: a value column, but zod refuses ""`)
        continue
      }
      const sqlRefuses = !(await accepts(db, cat, col, ' '))
      for (const b of [' ', '​', '⠀']) {
        if (sqlRefuses && field.safeParse(b).success) {
          problems.push(`${where}: the column refuses blanks, the zod field accepts ${JSON.stringify(b)}`)
          break
        }
      }
    }
  }
  return { checked, seen, problems }
}

// ---------- R43: ids are foreign keys; pointers to unbuilt tables are listed with their card ----------
// The table a pointer names: its stem pluralised, or the stem after one role prefix (source_, current_, from_, to_,
// parent_). A qbo_ pointer names QBO's own record, never one of our tables.
const plural = (stem: string): string => (stem.endsWith('y') ? `${stem.slice(0, -1)}ies` : stem.endsWith('s') ? `${stem}es` : `${stem}s`)
function targetsOf(column: string): string[] {
  const stem = column.replace(/_id$/, '')
  const role = /^(source|current|from|to|parent)_(.+)$/.exec(stem)
  return role?.[2] === undefined ? [plural(stem)] : [plural(stem), plural(role[2])]
}
async function pointerProblems(
  db: PGlite,
  cat: Catalog,
  future: Record<string, string>,
  allTables: readonly string[],
): Promise<{ checked: number; seen: string[]; problems: string[] }> {
  const problems: string[] = []
  const cols = cat.columns.filter((c) => c.column.endsWith('_id'))
  for (const col of cols) {
    const where = `returns.${col.table}.${col.column}`
    const fk = cat.fks.find((f) => f.table === col.table && f.cols.length === 1 && f.cols[0] === col.num)
    const target = col.column === 'return_id' ? 'returns' : targetsOf(col.column).find((t) => allTables.includes(t))
    if (fk !== undefined && (target === undefined || fk.target === target)) continue
    if (target !== undefined) {
      problems.push(`${where}: returns.${target} exists, but it is not a foreign key to it`)
      continue
    }
    const card = future[`${col.table}.${col.column}`]
    if (card === undefined || !/^[A-Z][A-Z0-9]{1,4}\b/.test(card)) {
      problems.push(`${where}: points at no built table and FUTURE_POINTERS does not name the card that builds it`)
    }
    if (await accepts(db, cat, col, ' ')) problems.push(`${where}: a pointer id that accepts a blank`)
  }
  return { checked: cols.length, seen: cols.map((c) => `returns.${c.table}.${c.column}`), problems }
}

// ---------- R44: identity columns refuse OVERRIDING SYSTEM VALUE; version columns refuse a gap or a jump ----------
const BEFORE_INSERT_ROW = (type: number): boolean => (type & 1) !== 0 && (type & 2) !== 0 && (type & 4) !== 0
function guardProblems(cat: Catalog): { checked: number; seen: string[]; problems: string[] } {
  const problems: string[] = []
  const guarded = (table: string, column: string): boolean =>
    cat.triggers.some((g) => g.table === table && BEFORE_INSERT_ROW(g.type) && (g.args.split(/\\000|\0/).includes(column) || new RegExp(`\\b${column}\\b`).test(g.src)))
  const identity = cat.columns.filter((c) => c.identity === 'a' || c.identity === 'd')
  for (const c of identity) {
    if (c.identity !== 'a') problems.push(`returns.${c.table}.${c.column}: identity BY DEFAULT lets a caller set it (use GENERATED ALWAYS and a guard)`)
    if (!guarded(c.table, c.column)) problems.push(`returns.${c.table}.${c.column}: no before-insert guard refuses OVERRIDING SYSTEM VALUE`)
  }
  const versions = cat.columns.filter((c) => /^(version_no|.*_version)$/.test(c.column))
  for (const c of versions) {
    if (!guarded(c.table, c.column)) problems.push(`returns.${c.table}.${c.column}: no before-insert guard refuses a gap or a jump`)
  }
  return { checked: identity.length + versions.length, seen: [...identity, ...versions].map((c) => `returns.${c.table}.${c.column}`), problems }
}

// ---------- R55: a finiteness bound shared by SQL and JS agrees at the double's edge ----------
// The double's round-up midpoint (just under it rounds to MAX_VALUE in JS, while numeric compares it exactly),
// 1e-400 (JS reads 0) and an integer above 2^53 (JS reads its neighbour): each is refused by both sides, or accepted
// by both and read back unchanged.
const R55_NUMBERS = [
  '1', '1.7976931348623157e308', '1.797693134862315807937e308', '-1.797693134862315807937e308', '1e400', '1e-400',
  '9007199254740993',
]
/** A decimal as sign, digits and exponent with no leading or trailing zeros, so two spellings of one number agree. */
function canonDecimal(text: string): string {
  const m = /^(-?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.trim())
  if (m === null) return `not a decimal: ${text}`
  const intPart = m[2] ?? ''
  const frac = m[3] ?? ''
  let digits = `${intPart}${frac}`
  let exp = Number(m[4] ?? '0') - frac.length
  const lead = /^0*/.exec(digits)?.[0].length ?? 0
  digits = digits.slice(lead)
  if (digits === '') return '0'
  const trail = /0*$/.exec(digits)?.[0].length ?? 0
  digits = digits.slice(0, digits.length - trail)
  exp += trail
  return `${m[1] ?? ''}${digits}e${String(exp)}`
}
type BoundPair = { label: string; sql: (n: string) => string; wrap: (n: string) => string; js: (v: unknown) => boolean; read: (v: unknown) => unknown }
async function boundProblems(db: PGlite, pairs: readonly BoundPair[], numbers: readonly string[]): Promise<string[]> {
  const problems: string[] = []
  for (const p of pairs) {
    for (const n of numbers) {
      const text = p.wrap(n)
      const sqlOk = (await db.query<{ ok: boolean | null }>(`select ${p.sql('$1::jsonb')} as ok`, [text])).rows[0]?.ok === true
      const parsed: unknown = JSON.parse(text)
      const jsOk = p.js(parsed)
      if (sqlOk !== jsOk) {
        problems.push(`${p.label}: ${n} is ${sqlOk ? 'accepted' : 'refused'} by SQL and ${jsOk ? 'accepted' : 'refused'} by JS`)
        continue
      }
      if (!jsOk) continue
      const back = p.read(parsed)
      const jsBack = typeof back === 'number' ? String(back) : 'not a number'
      if (canonDecimal(jsBack) !== canonDecimal(n)) problems.push(`${p.label}: ${n} is accepted, but JS reads it back as ${jsBack}`)
      const sqlBack = (await db.query<{ t: string | null }>(`select ($1::jsonb #>> '{x}') as t`, [stampWrap(n)])).rows[0]?.t ?? ''
      if (canonDecimal(sqlBack) !== canonDecimal(n)) problems.push(`${p.label}: ${n} is accepted, but SQL reads it back as ${sqlBack}`)
    }
  }
  return problems
}
const stampWrap = (n: string): string => `{"x":${n}}`
const firstX = (v: unknown): unknown => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>)['x'] : undefined)

async function plantedCatalog(sqlFile: string): Promise<{ db: PGlite; cat: Catalog; all: Catalog }> {
  const db = await cloneTestDb()
  await db.exec(plant(sqlFile))
  const all = await catalog(db)
  return { db, cat: only(all, planted), all }
}
async function realCatalog(): Promise<{ db: PGlite; cat: Catalog }> {
  const db = await cloneTestDb()
  return { db, cat: only(await catalog(db), real) }
}
const NOTHING = 'nothing to check: no table in schema returns (F01 brings the schema)'
/** Every real-data rule reads a catalog that holds returns.returns (spec review 3 gap 4). */
const catalogSentinel = (cat: Catalog): string[] => scanProblems('catalog', cat.tables.map((t) => `returns.${t}`), 'returns.returns')

// =====================================================================================================
describe('SC KNOWN on the database side: every exemption is exact, owned and alive (findings SC RC1, RC4, A407)', () => {
  test('ARC-15 KNOWN shape rule (db): a planted entry with a pattern, two tables, a done owner or a non-card owner is caught; the clean entry is not', () => {
    const clean = { rule: 'R12', file: 'returns.returns', problems: ['returns.returns: refuses UPDATE or DELETE but not TRUNCATE'], owner: 'FX3' }
    const planted: unknown[] = [
      clean,
      { rule: 'R43', file: 'returns.jobs', match: /^returns\.[a-z_]+\.[a-z_]+_id/, problems: ['returns.jobs: planted (Test)'], owner: 'FX3' },
      { rule: 'R13', file: 'returns.jobs.id', problems: ['returns.jobs.id accepts the blank ""', 'returns.jobs.return_id accepts the blank ""'], owner: 'FX3' },
      { rule: 'R42', file: 'returns.(jobs|client_refs)', problems: ['returns.jobs: no record schema'], owner: 'FX3' },
      { rule: 'R44', file: 'returns.client_refs.seq', problems: ['returns.client_refs.seq: planted done owner (Test)'], owner: 'FX6' },
      { rule: 'R44', file: 'returns.bridge_ops_items.seq', problems: ['returns.bridge_ops_items.seq: planted prose owner (Test)'], owner: 'F01 family' },
      { rule: 'R12', file: 'returns.returns', problems: ['returns.returns: refuses UPDATE or DELETE but not TRUNCATE'], owner: 'FX3' },
      { rule: 'R43', file: 'returns.client_handoff.fact_id', problems: ['returns.client_handoff.fact_id: planted open non-fix owner (Test)'], owner: 'W16' },
    ]
    expect(knownShapeProblems(planted, PINNED_STATUSES, DB_RULES())).toEqual([
      'KNOWN[1] R43 returns.jobs: the key match is not one of rule, file, problems, owner, why',
      'KNOWN[2] R13 returns.jobs.id: the problem names another subject (returns.jobs.return_id)',
      'KNOWN[3] R42 returns.(jobs|client_refs): the file is not one table, table.column or label',
      'KNOWN[3] R42 returns.(jobs|client_refs): the problem names another subject (returns.jobs)',
      'KNOWN[4] R44 returns.client_refs.seq: the owner FX6 is done, so it can never fix the defect',
      'KNOWN[5] R44 returns.bridge_ops_items.seq: the owner "F01 family" is not a fix card (FX3 to FX9)',
      'KNOWN[5] R44 returns.bridge_ops_items.seq: the owner "F01 family" is not a card in plan/slices.json',
      'KNOWN[6] R12 returns.returns: the problem "returns.returns: refuses UPDATE or DELETE but not TRUNCATE" is listed twice',
      'KNOWN[7] R43 returns.client_handoff.fact_id: the owner "W16" is not a fix card (FX3 to FX9)',
    ])
    expect(knownShapeProblems([clean], PINNED_STATUSES, DB_RULES())).toEqual([])
  })
  test('ARC-15 scan rule (db): a catalog scan that read nothing, or missed its named table or column, is caught', () => {
    expect(scanProblems('planted', [], 'returns.returns')).toEqual(['planted: the scan read no file'])
    expect(scanProblems('planted', ['returns.facts'], 'returns.returns')).toEqual(['planted: the scan missed its sentinel returns.returns'])
    expect(scanProblems('clean', ['returns.returns'], 'returns.returns')).toEqual([])
  })
  test('ARC-15 KNOWN rule (db): an entry cannot grow and a string the rule no longer prints is stale', () => {
    const known: KnownEntry[] = [{ rule: 'R44', file: 'returns.jobs.seq', problems: ['returns.jobs.seq: planted gone (Test)'], owner: 'FX3' }]
    expect(onlyKnown('R44', ['returns.jobs.seq: planted new (Test)'], known)).toEqual([
      'returns.jobs.seq: planted new (Test)',
      'stale KNOWN entry R44 returns.jobs.seq (owner FX3): "returns.jobs.seq: planted gone (Test)" no longer fails; remove it',
    ])
  })
  test('ARC-15 KNOWN shape: every entry in known.json (db side) has one subject, one rule, exact strings and an open owner', () => {
    expect(knownShapeProblems(KNOWN, cardStatuses(), DB_RULES())).toEqual([])
  })
})

describe('SC R12 to R15: rules over every table in schema returns (SEC-7, EV-1, FLOW-1, ARC-10, EV-8, EV-10)', () => {
  test('SEC-7 EV-1 R12 rule: a planted table with update and delete triggers and no truncate trigger is caught', async () => {
    const { cat } = await plantedCatalog('r12-no-truncate.sql')
    expect(truncateProblems(cat).problems).toEqual(['returns.planted_log: refuses UPDATE or DELETE but not TRUNCATE'])
  })
  test('SEC-7 EV-1 R12 every table in schema returns with an UPDATE or DELETE refusal also refuses TRUNCATE', async () => {
    const { cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const r = truncateProblems(cat)
    expect(r.checked, 'nothing to check: no append-only table').toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R12 append-only tables', r.seen, 'returns.state_events')]).toEqual([])
    expect(onlyKnown('R12', r.problems)).toEqual([])
  })

  test('EV-1 FLOW-1 R13 rule: a planted btrim check that accepts a tab and a column with no check are caught; the control is not', async () => {
    const { db, cat } = await plantedCatalog('r13-blank.sql')
    const r = await blankProblems(db, cat, {})
    expect(r.problems).toContain('returns.planted_events.reason accepts the blank "\\t"')
    expect(r.problems).toContain('returns.planted_events.actor accepts the blank ""')
    expect(r.problems.filter((p) => p.includes('planted_clean_events'))).toEqual([])
    expect(r.problems.filter((p) => p.includes('.id '))).toEqual([])
  })
  test('EV-1 FLOW-1 R13 rule: a column on the value allow-list may hold a blank', async () => {
    const { db, cat } = await plantedCatalog('r13-blank.sql')
    const r = await blankProblems(db, cat, { 'planted_events.actor': 'RT-12 (Test): an empty value is a value', 'planted_events.reason': 'RT-12 (Test)' })
    expect(r.problems).toEqual([])
  })
  test('EV-1 FLOW-1 R13 every text column of schema returns outside text.ts VALUE_COLUMNS refuses every blank of the sample set', async () => {
    const { db, cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const text = await loadContract('text.ts')
    const valueColumns = stringRecord(text?.['VALUE_COLUMNS'])
    expect(valueColumns, 'src/contracts/text.ts exports no VALUE_COLUMNS (table.column to its reason)').not.toBeNull()
    const r = await blankProblems(db, cat, valueColumns ?? {})
    expect(r.checked).toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R13 text columns', r.seen, 'returns.facts.fact_key')]).toEqual([])
    expect(onlyKnown('R13', r.problems)).toEqual([])
  })

  test('ARC-10 R14 rule: a planted stamp check that accepts {"x":null} is caught', async () => {
    const { db, cat } = await plantedCatalog('r14-stamp.sql')
    expect((await stampProblems(db, cat)).problems).toEqual([
      'returns.planted_figures.version_stamp accepts {"x":null}',
      'returns.planted_figures.version_stamp accepts {"x":""}',
    ])
  })
  test('ARC-10 R14 every version_stamp column refuses {}, {"x":null} and {"x":""}', async () => {
    const { db, cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const r = await stampProblems(db, cat)
    expect(r.checked, 'nothing to check: no version_stamp column').toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R14 version_stamp columns', r.seen, 'returns.facts.version_stamp')]).toEqual([])
    expect(onlyKnown('R14', r.problems)).toEqual([])
  })

  test('EV-8 EV-10 FLOW-1 R15 rule: a planted status CHECK with one value missing and an origin with no CHECK are caught', async () => {
    const { db, cat } = await plantedCatalog('r15-status.sql')
    const lists = {
      FACT_STATUSES: ['proposed', 'preparer_verified', 'cpa_accepted'],
      ORIGINS: ['third_party', 'client_filed', 'client_prepared', 'client_said', 'judgment'],
      ENTRY_TYPES: ['reclass', 'accrual', 'allocation', 'estimate', 'correction'],
    }
    const r = await stateListProblems(db, cat, lists)
    expect(r.problems).toEqual([
      'returns.planted_facts.status: its CHECK list ["proposed","preparer_verified"] equals no list in records.ts',
      'returns.planted_facts.origin: no CHECK with a list of values',
    ])
  })
  test('EV-8 EV-10 FLOW-1 R15 every state, *_state, status, origin and entry_type column has a CHECK whose list equals its records.ts list', async () => {
    const { db, cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const records = await loadContract('records.ts')
    expect(records, 'src/contracts/records.ts (F01) is not on main').not.toBeNull()
    const r = await stateListProblems(db, cat, stringLists(records ?? {}))
    expect(r.checked).toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R15 state columns', r.seen, 'returns.facts.status')]).toEqual([])
    expect(onlyKnown('R15', r.problems)).toEqual([])
  })
})

describe('SC R41 to R44: blanks, parity, pointers and sequences (EV-1, FLOW-1, FLOW-4, EV-5)', () => {
  test('EV-1 R41 rule: the planted btrim check is caught as a private blank rule', async () => {
    const { cat } = await plantedCatalog('r13-blank.sql')
    const problems = blankDefinitionProblems(cat)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^returns\.planted_events .*btrim/)
  })
  test('EV-1 R41 no CHECK in schema returns uses btrim(, trim(, [[:space:]] or \\s (one blank definition: returns.is_blank)', async () => {
    const { cat } = await realCatalog()
    expect(cat.checks.length, NOTHING).toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R41 checks', checkLabels(cat), 'returns.facts facts_version_stamp')]).toEqual([])
    expect(onlyKnown('R41-sql', blankDefinitionProblems(cat))).toEqual([])
  })

  test('EV-1 R42 rule: a planted z.string() field over a non-blank column is caught, and a field missing on either side', async () => {
    const { db, cat } = await plantedCatalog('r42-parity.sql')
    const schema = z.strictObject({ id: z.string().regex(/[a-z0-9]/), note: z.string(), extra: z.string() })
    const r = await parityProblems(db, cat, [{ key: 'planted#PlantedNoteRecordSchema', schema, table: 'planted_notes' }], {})
    expect(r.problems).toContain('planted#PlantedNoteRecordSchema.note: the column refuses blanks, the zod field accepts " "')
    expect(r.problems).toContain('planted#PlantedNoteRecordSchema: no field for column planted_notes.remark')
    expect(r.problems).toContain('planted#PlantedNoteRecordSchema.extra: no column planted_notes.extra')
    expect(r.problems.some((p) => p.includes('.id:'))).toBe(false)
  })
  test('EV-1 R42 every records.ts record schema and its table agree field by field, both ways (columns, nullability, non-blank)', async () => {
    const { db, cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const records = await loadContract('records.ts')
    expect(records, 'src/contracts/records.ts (F01) is not on main').not.toBeNull()
    const pairs = Object.entries(records ?? {})
      .filter(([name, v]) => name.endsWith('RecordSchema') && isZodObject(v))
      .map(([name, v]) => ({ key: `records.ts#${name}`, schema: v as ZodObj, table: tableFor(name) }))
    const text = await loadContract('text.ts')
    const r = await parityProblems(db, cat, pairs, stringRecord(text?.['VALUE_COLUMNS']) ?? {})
    expect(r.checked).toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R42 paired columns', r.seen, 'returns.facts.fact_key')]).toEqual([])
    expect(onlyKnown('R42', r.problems)).toEqual([])
  })

  test('EV-5 R43 rule: a planted return_id with no foreign key and an unlisted pointer to an unbuilt table are caught', async () => {
    const { db, cat, all } = await plantedCatalog('r43-pointers.sql')
    const r = await pointerProblems(db, cat, {}, all.tables)
    expect(r.problems).toContain('returns.planted_children.return_id: returns.returns exists, but it is not a foreign key to it')
    expect(r.problems).toContain('returns.planted_children.planted_widget_id: points at no built table and FUTURE_POINTERS does not name the card that builds it')
    expect(r.problems).toContain('returns.planted_children.planted_widget_id: a pointer id that accepts a blank')
    expect(r.problems.filter((p) => p.includes('planted_clean_children'))).toEqual([])
    const listed = await pointerProblems(db, cat, { 'planted_children.planted_widget_id': 'B01 (Test): widgets' }, all.tables)
    expect(listed.problems.some((p) => p.includes('FUTURE_POINTERS'))).toBe(false)
  })
  test('EV-5 R43 every return_id, and every *_id whose table exists, is a foreign key; other pointer ids are non-blank and FUTURE_POINTERS names their card', async () => {
    const { db, cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const ids = await loadContract('ids.ts')
    const r = await pointerProblems(db, cat, stringRecord(ids?.['FUTURE_POINTERS']) ?? {}, cat.tables)
    expect(r.checked).toBeGreaterThan(0)
    expect([...catalogSentinel(cat), ...scanProblems('R43 id columns', r.seen, 'returns.client_handoff.fact_id')]).toEqual([])
    expect(onlyKnown('R43', r.problems)).toEqual([])
  })

  test('FLOW-1 FLOW-4 R44 rule: a planted identity a caller may set and an unguarded version_no are caught', async () => {
    const { cat } = await plantedCatalog('r44-identity.sql')
    expect(guardProblems(cat).problems).toEqual([
      'returns.planted_state_events.seq: identity BY DEFAULT lets a caller set it (use GENERATED ALWAYS and a guard)',
      'returns.planted_state_events.seq: no before-insert guard refuses OVERRIDING SYSTEM VALUE',
      'returns.planted_versions.version_no: no before-insert guard refuses a gap or a jump',
    ])
  })
  test('FLOW-1 FLOW-4 R44 every identity column refuses OVERRIDING SYSTEM VALUE and every version_no or *_version column refuses a gap or a jump', async () => {
    const { cat } = await realCatalog()
    expect(cat.tables.length, NOTHING).toBeGreaterThan(0)
    const r = guardProblems(cat)
    expect(r.checked, 'nothing to check: no identity or version column').toBeGreaterThan(0)
    expect([
      ...catalogSentinel(cat),
      ...scanProblems('R44 identity columns', r.seen, 'returns.state_events.seq'),
      ...scanProblems('R44 version columns', r.seen, 'returns.facts.version_no'),
    ]).toEqual([])
    expect(onlyKnown('R44', r.problems)).toEqual([])
  })
})

describe('SC R55: finiteness bounds shared by SQL and JS (ARC-10)', () => {
  test('ARC-10 R55 rule: a planted SQL stamp check with no bound disagrees with its zod twin at 1e400 and is caught', async () => {
    const db = await cloneTestDb()
    await db.exec(plant('r55-bound.sql'))
    const twin = z.record(z.string(), z.union([z.string(), z.number()]))
    const problems = await boundProblems(db, [
      { label: 'planted', sql: (x) => `returns.planted_is_stamp(${x})`, wrap: stampWrap, js: (v) => twin.safeParse(v).success, read: firstX },
    ], ['1', '1e400'])
    expect(problems).toEqual(['planted: 1e400 is accepted by SQL and refused by JS'])
    expect(canonDecimal('1.50e2')).toBe(canonDecimal('150'))
    expect(canonDecimal('0.0001')).toBe(canonDecimal('1e-4'))
  })
  test('ARC-10 R55 every finiteness bound shared by SQL and JS agrees at the round-up midpoint, 1e-400 and integers above 2^53 (refused, or read back unchanged)', async () => {
    const db = await cloneTestDb()
    const records = await loadContract('records.ts')
    const stamp = records?.['VersionStampSchema'] as z.ZodType | undefined
    const sources = records?.['sourcesAreReal'] as ((s: readonly unknown[]) => boolean) | undefined
    expect(stamp, 'src/contracts/records.ts exports no VersionStampSchema').toBeDefined()
    expect(typeof sources, 'src/contracts/records.ts exports no sourcesAreReal').toBe('function')
    const pairs: BoundPair[] = [
      { label: 'version_stamp', sql: (x) => `returns.is_version_stamp(${x})`, wrap: stampWrap, js: (v) => stamp?.safeParse(v).success === true, read: firstX },
      {
        label: 'sources',
        sql: (x) => `returns.sources_are_real(${x})`,
        wrap: (n) => `[{"x":${n}}]`,
        js: (v) => Array.isArray(v) && sources?.(v) === true,
        read: (v) => (Array.isArray(v) ? firstX(v[0]) : undefined),
      },
    ]
    expect(onlyKnown('R55', await boundProblems(db, pairs, R55_NUMBERS))).toEqual([])
  })
})
