// SC2: test-world rules R57 to R61, R75 and R76 (unit project). Card plan/cards/SC2.md; clauses ARC-8, ARC-13, ARC-16.
// From reports/W00a-findings.md ("Rule tests") and reports/W00c-findings.md ("Rule tests for SC2": its R57, R59, R60
// and R61 wording wins), plus R75 and R76 (A403). Each rule is a function over a test world (every numbered folder of
// reference/sample-clients/, every kind folder once one lands, and the fault catalogue `faults()`, which every kind's
// list joins). Each rule is first shown failing on a planted copy of a sample client (plants under
// tools/test/__fixtures__/testworld-rules/plants/, one JSON file each), then passing on the real test world.
//
// Who writes what (card "Build"): the spec writes this file and the plants. The builder writes the planted-fixture
// harness `tools/test/__fixtures__/testworld-rules/harness.mjs`, whose contract is below, and nothing else. Until it
// exists every plant test fails by name at its import; the real-world tests already run.
//
// Harness contract (harness.mjs, plain ESM, no product imports other than testworld/index.ts):
//   export function plantedCopy(plant): { root, dir, id, catalogue, dispose }
//   - plant: { base: 'C01' | ... , edits?: Edit[], catalogue?: CatalogueEdit[] } (a plant file's JSON, or a bare base).
//   - root: a new folder under os.tmpdir() holding exactly one folder, a full copy of the base's numbered folder of
//     reference/sample-clients/ under the same folder name; dir: that copy. id: the base. dispose(): removes root.
//     Nothing under reference/ is ever written.
//   - catalogue: a deep copy of faults() from testworld/index.ts with the catalogue edits applied (faults() itself is
//     never changed).
//   - Edits are applied in order. `file` is a path relative to dir, written with "/". A JSON path is a list of steps:
//     a string is an object key, a number an array index, and an object such as {"id": "10-CHQ-2025-05-0001"} picks
//     the first array element whose fields equal all of its values. A step that finds nothing throws (never a no-op).
//       {op:"set", file, path, value}       parse the file, set the value at path (the parent must exist), write it back
//       {op:"delete", file, path}           remove that key (or array element)
//       {op:"duplicate", file, path}        insert a deep copy of the array element at path right after it
//       {op:"rename", file, path, from, to} rename a key of the object at path, keeping key order
//       {op:"setAll", file, path, where, set}  in the array at path, assign `set` to every element matching `where`
//       {op:"text", file, find, replace}    replace the first occurrence of `find` in the file's text (throws if absent)
//       {op:"write", file, text}            replace the file's text
//       {op:"remove", file}                 delete the file
//       {op:"dir", file}                    replace the file by an empty folder of the same name
//       {op:"copyFile", from, to}           copy a file of the folder to a new name
//       {op:"link", file, target}           replace the file by a symbolic link to `target` (written as given)
//     A JSON op writes the file back as JSON.stringify(value, null, 2) plus a newline.
//   - Catalogue edits, applied to the entry whose id is `id` (a step that finds nothing throws):
//       {op:"set", id, path, value}   {op:"delete", id, path}   {op:"add", entry}   {op:"dropClient", client}
//
// KNOWN (A407, testing.md): an entry names one rule, one file, the exact problem strings (no pattern) and an open
// owner card; any problem not listed fails, and a listed string no longer produced fails as stale. Every scan asserts
// it read at least one item and a named sentinel.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test, vi } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX_REL = 'tools/test/__fixtures__/testworld-rules'
const FIX = path.join(ROOT, ...FIX_REL.split('/'))
const PLANTS = path.join(FIX, 'plants')
const HARNESS_REL = `${FIX_REL}/harness.mjs`
const SAMPLE_REL = 'reference/sample-clients'
const KINDS_REL = 'testworld/kinds'
const LOADER_REL = 'testworld/clients/load.ts'
const SEED = 20261003
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href)
// Slowest test 1.3 s alone (cloud, 3 Oct); 20 s keeps a loaded full run from failing it (testing.md, timeouts).
vi.setConfig({ testTimeout: 20_000 })

const tw = await load('testworld/index.ts')
const { decimalToCents } = await load('src/core/money.ts')
const { repeatedKeys } = await load('testworld/clients/json-keys.ts')

/** The builder's harness, loaded only by the plant tests (so the real-world tests run before it exists). */
let harnessLoad
const harness = () => (harnessLoad ??= import(pathToFileURL(path.join(ROOT, HARNESS_REL)).href))
async function withPlant(plant, fn) {
  const h = await harness()
  const copy = h.plantedCopy(plant)
  try {
    return await fn(copy)
  } finally {
    copy.dispose()
  }
}

// ---------- small helpers, independent of the code under test ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const arr = (v) => (Array.isArray(v) ? v : [])
const objs = (v) => arr(v).filter(isObj)
const posix = (p) => p.split(path.sep).join('/')
/** Is this a real calendar date written YYYY-MM-DD? */
function isCalendarDate(s) {
  const m = typeof s === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null
  if (m === null) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}
const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
const dayNo = (d) => Date.parse(`${d}T00:00:00Z`) / 86_400_000
function dayBefore(d) {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() - 1)
  return x.toISOString().slice(0, 10)
}
const monthIndex = (d) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1
const monthOf = (i) => `${String(Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, '0')}`
/** The months YYYY-MM of a fiscal year, in order; none when the dates are not calendar dates or are out of order. */
function yearMonths(start, end) {
  if (!isCalendarDate(start) || !isCalendarDate(end)) return []
  const out = []
  for (let i = monthIndex(start); i <= monthIndex(end); i++) out.push(monthOf(i))
  return out
}
/** Money from the number's own decimal text, never through x * 100 (ARC-13). Undefined when it is not whole cents. */
function cents(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  const r = decimalToCents(String(v))
  return r.ok ? r.cents : undefined
}
const sumCents = (xs) => xs.reduce((s, x) => (s === undefined || x === undefined ? undefined : s + x), 0)
function repeatedValues(xs) {
  const seen = new Set()
  const again = []
  for (const x of xs) {
    if (seen.has(x) && !again.includes(x)) again.push(x)
    seen.add(x)
  }
  return again
}
const isProtoName = (k) => typeof k === 'string' && k in Object.prototype
const SKIP = new Set(['node_modules', '.git'])
/** Every entry under a folder (lstat, links not followed), as posix paths relative to it. */
function entries(dir, rel = '') {
  const out = []
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (SKIP.has(e.name)) continue
    const r = rel === '' ? e.name : `${rel}/${e.name}`
    out.push({ rel: r, link: e.isSymbolicLink(), dir: e.isDirectory(), file: e.isFile() })
    if (e.isDirectory() && !e.isSymbolicLink()) out.push(...entries(dir, r))
  }
  return out
}
/** Every leaf and key of a JSON value: { path: 'a.0.b', key, value, holder }. */
function leaves(v, at = [], out = []) {
  if (Array.isArray(v)) v.forEach((x, i) => leaves(x, [...at, i], out))
  else if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      out.push({ path: [...at, k].join('.'), key: k, isKey: true, value: k, holder: v })
      leaves(x, [...at, k], out)
    }
  } else out.push({ path: at.join('.'), key: at[at.length - 1], isKey: false, value: v })
  return out
}
function readJson(abs) {
  try {
    if (!fs.lstatSync(abs).isFile()) return undefined
    return JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch {
    return undefined
  }
}

// ---------- the test world ----------
const FOLDER_ID = /^(\d\d)-/
/** A folder of the world: { id, dir, label, key, onb } (key and onb undefined when unreadable; R61 reports that). */
function folderOf(id, dir, label) {
  return { id, dir, label, key: readJson(path.join(dir, 'answer-key.json')), onb: readJson(path.join(dir, 'onboarding.json')) }
}
/** Readers for kind folders (testworld/kinds/<K>/): a kind that lands adds its entry here (KIND_LANDING). */
const KIND_READERS = {}
function realWorld() {
  const root = path.join(ROOT, SAMPLE_REL)
  const folders = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => FOLDER_ID.test(e.name) && (e.isDirectory() || e.isSymbolicLink()))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((e) => folderOf(`C${FOLDER_ID.exec(e.name)[1]}`, path.join(root, e.name), `${SAMPLE_REL}/${e.name}`))
  for (const [k, read] of Object.entries(KIND_READERS)) folders.push(...read())
  return { folders, catalogue: tw.faults() }
}
const plantWorld = (copy) => ({ folders: [folderOf(copy.id, copy.dir, path.basename(copy.dir))], catalogue: copy.catalogue })
const mine = (world, folder) => world.catalogue.filter((f) => f.client === folder.id || f.kind === folder.id)
const KEY = (folder) => `${folder.label}/answer-key.json`
const ONB = (folder) => `${folder.label}/onboarding.json`
const CATALOGUE = 'fault catalogue'

/** Kind folders that landed with no reader here (the rules must run on every kind, not only the sample clients). */
function kindLandingProblems(readers = KIND_READERS, kindsDir = path.join(ROOT, KINDS_REL)) {
  if (!fs.existsSync(kindsDir)) return []
  return fs
    .readdirSync(kindsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !Object.hasOwn(readers, e.name))
    .map((e) => `${KINDS_REL}/${e.name}: a kind landed with no KIND_READERS entry in tools/test/testworld-rules.test.mjs, so R57 to R61, R75 and R76 do not run on it`)
}

// ---------- R57: every marker is pinned row by row (id, date, amount); no aggregate pin; no vacuous proof ----------
const MARKER_FIELDS = ['missingFromExport', 'dupOf', 'priorYear']
const MARKER_KEYS = ['field', 'account', 'month', 'rows']
const ROW_KEYS = ['id', 'date', 'amountCents', 'dupOf']
const carries = (t, field) => Object.hasOwn(t, field) && t[field] !== false
function markerShapeProblems(catalogue) {
  const p = []
  for (const f of catalogue) {
    if (f.marker === undefined) continue
    const at = `${CATALOGUE} ${f.id}`
    const m = f.marker
    if (!isObj(m)) {
      p.push(`${at}: the marker is not an object`)
      continue
    }
    for (const k of Object.keys(m)) if (!MARKER_KEYS.includes(k)) p.push(`${at}: the marker key ${k} is not one of field, account, month, rows (a count or a sum never pins a row)`)
    if (!MARKER_FIELDS.includes(m.field)) p.push(`${at}: the marker field ${String(m.field)} is not one of missingFromExport, dupOf, priorYear`)
    if (typeof f.flagId !== 'string') p.push(`${at}: a marker entry names no flag`)
    if (!Array.isArray(m.rows) || m.rows.length === 0) {
      p.push(`${at}: the marker lists no rows (each marked row is pinned by id, date and amount)`)
      continue
    }
    for (const [i, r] of m.rows.entries()) {
      const rat = `${at} row ${isObj(r) && typeof r.id === 'string' && r.id !== '' ? r.id : `#${String(i)}`}`
      if (!isObj(r)) {
        p.push(`${rat}: it is not an object`)
        continue
      }
      for (const k of Object.keys(r)) if (!ROW_KEYS.includes(k)) p.push(`${rat}: the key ${k} is not one of id, date, amountCents, dupOf`)
      if (typeof r.id !== 'string' || r.id === '') p.push(`${rat}: it has no id`)
      if (!isCalendarDate(r.date)) p.push(`${rat}: its date ${String(r.date)} is not a calendar date`)
      if (!Number.isSafeInteger(r.amountCents)) p.push(`${rat}: its amountCents ${String(r.amountCents)} is not a whole number of cents`)
      if (m.field === 'dupOf' && typeof r.dupOf !== 'string') p.push(`${rat}: a dupOf row pins no original`)
      if (m.field !== 'dupOf' && r.dupOf !== undefined) p.push(`${rat}: only a dupOf row pins an original`)
    }
  }
  return p
}
function r57(world) {
  const problems = markerShapeProblems(world.catalogue)
  const checked = []
  for (const folder of world.folders) {
    if (!isObj(folder.key)) continue
    const where = KEY(folder)
    const entriesOf = mine(world, folder).filter((f) => isObj(f.marker) && Array.isArray(f.marker.rows))
    const txs = objs(folder.key.transactions)
    const byId = new Map()
    for (const t of txs) if (!byId.has(t.id)) byId.set(t.id, t)
    const pins = new Map()
    for (const f of entriesOf) for (const r of objs(f.marker.rows)) pins.set(r.id, (pins.get(r.id) ?? 0) + 1)
    for (const t of txs) {
      for (const k of Object.keys(t)) {
        const want = MARKER_FIELDS.find((x) => x.toLowerCase() === k.toLowerCase())
        if (want !== undefined && want !== k) problems.push(`${where} ${String(t.id)}: it carries ${k}, a misspelled marker field (${want})`)
      }
      for (const field of MARKER_FIELDS) {
        if (carries(t, field) && !entriesOf.some((f) => f.marker.field === field && objs(f.marker.rows).some((r) => r.id === t.id))) {
          problems.push(`${where} ${String(t.id)}: it carries ${field} and no fault catalogue entry pins it by id under that marker`)
        }
      }
    }
    const twice = new Set()
    for (const f of entriesOf) {
      for (const r of objs(f.marker.rows)) {
        const at = `${where} ${String(r.id)} (${f.id})`
        checked.push(String(r.id))
        if ((pins.get(r.id) ?? 0) > 1 && !twice.has(r.id)) {
          twice.add(r.id)
          problems.push(`${where} ${String(r.id)}: the fault catalogue pins it more than once`)
        }
        const t = byId.get(r.id)
        if (t === undefined) {
          problems.push(`${at}: it is not a transaction of this client`)
          continue
        }
        if (t.acct !== f.marker.account) problems.push(`${at}: it is in the account ${String(t.acct)}, not ${String(f.marker.account)}`)
        if (String(t.date).slice(0, 7) !== f.marker.month) problems.push(`${at}: it is dated ${String(t.date)}, not in ${String(f.marker.month)}`)
        const c = cents(t.amount)
        if (t.date !== r.date || c !== r.amountCents) {
          problems.push(`${at}: the answer key has ${String(t.date)} ${String(c)} cents; the catalogue pins ${String(r.date)} ${String(r.amountCents)} cents`)
        }
        if (!carries(t, f.marker.field)) problems.push(`${at}: it does not carry ${String(f.marker.field)}`)
        if (f.marker.field === 'dupOf' && carries(t, 'dupOf') && t.dupOf !== r.dupOf) {
          problems.push(`${at}: the answer key's original is ${String(t.dupOf)}; the catalogue pins ${String(r.dupOf)}`)
        }
      }
    }
  }
  return { problems, checked }
}

// ---------- R58: id-keyed lists refuse repeats; no data key is the name of an Object.prototype member ----------
function r58(world) {
  const problems = []
  const checked = []
  for (const id of repeatedValues(world.catalogue.map((f) => f.id))) problems.push(`${CATALOGUE}: the id ${String(id)} is listed twice`)
  for (const id of world.catalogue.map((f) => f.id)) if (isProtoName(id)) problems.push(`${CATALOGUE}: the id "${id}" is the name of an Object.prototype member`)
  const byOwner = new Map()
  for (const f of world.catalogue) {
    if (f.flagId === undefined) continue
    const o = String(f.client ?? f.kind)
    byOwner.set(o, [...(byOwner.get(o) ?? []), f.flagId])
  }
  for (const [o, flags] of byOwner) for (const fl of repeatedValues(flags)) problems.push(`${CATALOGUE} ${o}: the flag ${String(fl)} is listed twice`)
  checked.push(CATALOGUE)
  for (const folder of world.folders) {
    const k = folder.key
    if (!isObj(k)) continue
    const where = KEY(folder)
    const sb = isObj(k.statementBalances) ? k.statementBalances : {}
    const lists = [
      ['accounts', objs(k.accounts), 'key'],
      ['transactions', objs(k.transactions), 'id'],
      ['adjustingEntries', objs(k.adjustingEntries), 'id'],
      ['flags', objs(k.flags), 'id'],
      ...['opening', 'unadjusted', 'adjusted'].map((n) => [`trialBalance.${n}.rows`, objs(k.trialBalance?.[n]?.rows), 'account']),
      ...Object.keys(sb).map((a) => [`statementBalances.${a}`, objs(sb[a]), 'month']),
    ]
    for (const [name, list, field] of lists) {
      checked.push(`${folder.label} ${name}`)
      const values = list.map((x) => x[field])
      for (const v of repeatedValues(values)) problems.push(`${where} ${name}: the ${field} "${String(v)}" is listed twice`)
      for (const v of new Set(values)) if (isProtoName(v)) problems.push(`${where} ${name}: the ${field} "${v}" is the name of an Object.prototype member`)
    }
    for (const a of Object.keys(sb)) if (isProtoName(a)) problems.push(`${where} statementBalances: the key "${a}" is the name of an Object.prototype member`)
    // Every value the loader looks a record up by.
    const lookups = new Map()
    const note = (name, v) => {
      if (!isProtoName(v)) return
      const key = `${name}\u0000${v}`
      lookups.set(key, (lookups.get(key) ?? 0) + 1)
    }
    for (const t of objs(k.transactions)) {
      note('transactions[].acct', t.acct)
      if (t.dupOf !== undefined) note('transactions[].dupOf', t.dupOf)
      for (const p of objs(t.post)) note('transactions[].post[].a', p.a)
    }
    for (const j of objs(k.adjustingEntries)) {
      for (const s of arr(j.source?.transactions)) note('adjustingEntries[].source.transactions[]', s)
      for (const s of arr(j.source?.onboarding)) note('adjustingEntries[].source.onboarding[]', typeof s === 'string' ? s.replace(/\s*\(.*$/, '') : s)
    }
    for (const [key, n] of lookups) {
      const [name, v] = key.split('\u0000')
      problems.push(`${where} ${name}: "${v}" is the name of an Object.prototype member (${String(n)} ${n === 1 ? 'row' : 'rows'})`)
    }
  }
  return { problems, checked }
}

// ---------- R59: every list that drives a check is non-empty, or declared empty by data ----------
function r59(world) {
  const problems = []
  const checked = []
  for (const f of world.catalogue) {
    if (isObj(f.marker) && Array.isArray(f.marker.rows) && f.marker.rows.length === 0) problems.push(`${CATALOGUE} ${f.id}: the marker lists no rows`)
  }
  for (const folder of world.folders) {
    const k = folder.key
    if (!isObj(k)) continue
    const where = KEY(folder)
    const own = mine(world, folder)
    if (own.length === 0) problems.push(`${folder.label}: the fault catalogue has no entry for this client`)
    const declared = own.some((f) => f.empty === 'accounts')
    const accounts = objs(k.accounts)
    const txs = objs(k.transactions)
    const sb = isObj(k.statementBalances) ? k.statementBalances : {}
    if (accounts.length === 0) {
      if (!declared) problems.push(`${where} accounts: the list is empty and the fault catalogue does not declare it (empty: 'accounts')`)
      else {
        checked.push(`${folder.id} accounts declared empty`)
        if (txs.length > 0) problems.push(`${where} transactions: the client declares no accounts but has ${String(txs.length)} transactions`)
        if (Object.keys(sb).length > 0) problems.push(`${where} statementBalances: the client declares no accounts but has statement balances`)
      }
    } else if (declared) problems.push(`${where} accounts: the fault catalogue declares no accounts but the answer key has ${String(accounts.length)}`)
    const fy = isObj(k.fiscalYear) ? k.fiscalYear : {}
    if (yearMonths(fy.start, fy.end).length === 0) problems.push(`${where} fiscalYear: the year ${String(fy.start)} to ${String(fy.end)} has no months`)
    for (const a of accounts) {
      if (!Object.hasOwn(sb, a.key) || arr(sb[a.key]).length === 0) problems.push(`${where} statementBalances.${String(a.key)}: the account has no statement months`)
    }
    for (const n of ['unadjusted', 'adjusted']) if (objs(k.trialBalance?.[n]?.rows).length === 0) problems.push(`${where} trialBalance.${n}.rows: the list is empty`)
    if (objs(k.trialBalance?.opening?.rows).length === 0) {
      if (folder.onb?.corporation?.incorporation_date === fy.start) checked.push(`${folder.id} opening empty in a first year`)
      else problems.push(`${where} trialBalance.opening.rows: the list is empty and the corporation was not incorporated on the fiscal year start ${String(fy.start)}`)
    }
    if (isObj(folder.onb) && objs(folder.onb.owners).length === 0) problems.push(`${ONB(folder)} owners: the list is empty`)
    checked.push(`${folder.label} lists`)
  }
  return { problems, checked }
}

// ---------- R60: every date-shaped leaf is a date or month; ranges in order; twins agree; file fields fit ----------
const DATE_SHAPED = /^\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
function validDateText(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isCalendarDate(s)
  if (/^\d{4}-\d{2}$/.test(s)) return isMonth(s)
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z$/.exec(s)
  return m !== null && isCalendarDate(m[1]) && Number(m[2]) < 24 && Number(m[3]) < 60 && (m[4] === undefined || Number(m[4]) < 60)
}
const RANGE_PAIRS = [
  [/^start$/, 'end'],
  [/^from$/, 'to'],
  [/^(.+)_start$/, (m) => `${m[1]}_end`],
  [/^(.+)Start$/, (m) => `${m[1]}End`],
]
const MAX_YEAR_DAYS = 371
/** File fields by where they sit: their folder and extension. A file field not listed here is a problem. */
const FILE_FIELDS = {
  'answer-key.json accounts.*.file': { dir: 'accounts', ext: '.csv' },
  'answer-key.json accounts.*.qboFile': { dir: 'qbo', ext: '.csv' },
  'onboarding.json accounts_provided.*.file': { dir: 'accounts', ext: '.csv' },
  'answer-key.json generator.file': { generator: true },
}
const FILE_KEY = /^(?:file|[a-z][A-Za-z0-9]*File|[a-z0-9_]+_file)$/
const isFolderFile = (name, dir, ext) => {
  if (typeof name !== 'string' || !name.startsWith(`${dir}/`) || !name.endsWith(ext)) return false
  const base = name.slice(dir.length + 1)
  return base.length > ext.length && !base.includes('/') && !base.includes('\\') && base !== '..' && !base.startsWith('.')
}
function fileFieldProblems(folder, file, json) {
  const p = []
  for (const l of leaves(json)) {
    if (l.isKey || typeof l.key !== 'string' || !FILE_KEY.test(l.key)) continue
    const pattern = `${file} ${l.path.replace(/\.\d+(?=\.|$)/g, '.*')}`
    const at = `${folder.label}/${file} ${l.path}`
    const spec = FILE_FIELDS[pattern]
    // A flag such as resolution_on_file: true names no file; only a string can.
    if (spec === undefined && typeof l.value !== 'string') continue
    if (spec === undefined) {
      p.push(`${at}: a file field R60 does not know (add it to FILE_FIELDS with its folder and extension)`)
      continue
    }
    const name = l.value
    if (spec.generator) {
      if (typeof name !== 'string' || !/^[\w-]+\.mjs$/.test(name) || !fs.existsSync(path.join(ROOT, SAMPLE_REL, name))) {
        p.push(`${at}: ${JSON.stringify(name)} is not a generator script of ${SAMPLE_REL}`)
      }
      continue
    }
    if (!isFolderFile(name, spec.dir, spec.ext)) {
      p.push(`${at}: ${JSON.stringify(name)} is not ${spec.dir}/<name>${spec.ext}`)
      continue
    }
    const abs = path.join(folder.dir, ...name.split('/'))
    if (!fs.existsSync(abs)) {
      p.push(`${at}: ${name} is not in the client folder`)
      continue
    }
    const real = posix(path.relative(fs.realpathSync(folder.dir), fs.realpathSync(abs)))
    if (!isFolderFile(real, spec.dir, spec.ext)) p.push(`${at}: ${name} resolves to ${real}, not ${spec.dir}/<name>${spec.ext}`)
    else if (!fs.lstatSync(fs.realpathSync(abs)).isFile()) p.push(`${at}: ${name} is not a regular file`)
  }
  return p
}
function jsonFilesOf(folder) {
  return entries(folder.dir).filter((e) => e.file && e.rel.endsWith('.json'))
}
function r60(world) {
  const problems = []
  const checked = []
  for (const folder of world.folders) {
    if (!fs.existsSync(folder.dir)) continue
    for (const e of jsonFilesOf(folder)) {
      const json = readJson(path.join(folder.dir, ...e.rel.split('/')))
      if (json === undefined) continue
      for (const l of leaves(json)) {
        if (typeof l.value !== 'string' || !DATE_SHAPED.test(l.value)) continue
        checked.push(`${folder.label}/${e.rel} ${l.path}`)
        if (!validDateText(l.value)) {
          problems.push(`${folder.label}/${e.rel} ${l.path}${l.isKey ? ' (a key)' : ''}: "${l.value}" is date-shaped but not a calendar date, a month or a UTC time`)
        }
      }
      for (const l of leaves(json)) {
        if (!l.isKey) continue
        for (const [re, other] of RANGE_PAIRS) {
          const m = re.exec(l.key)
          if (m === null) continue
          const endKey = typeof other === 'string' ? other : other(m)
          const s = l.holder[l.key]
          const t = l.holder[endKey]
          const both = (isCalendarDate(s) && isCalendarDate(t)) || (isMonth(s) && isMonth(t))
          if (both && s > t) problems.push(`${folder.label}/${e.rel} ${l.path}: the range starts ${s}, after it ends ${t}`)
        }
      }
      if (e.rel === 'answer-key.json' || e.rel === 'onboarding.json') problems.push(...fileFieldProblems(folder, e.rel, json))
    }
    const k = folder.key
    if (!isObj(k)) continue
    const where = KEY(folder)
    const fy = isObj(k.fiscalYear) ? k.fiscalYear : {}
    const { start, end } = fy
    if (!isCalendarDate(start) || !isCalendarDate(end) || start > end) continue
    const days = dayNo(end) - dayNo(start) + 1
    if (days > MAX_YEAR_DAYS) problems.push(`${where} fiscalYear: the year ${start} to ${end} is ${String(days)} days, longer than ${String(MAX_YEAR_DAYS)}`)
    const earliest = `${monthOf(monthIndex(start) - 12)}-01`
    for (const t of objs(k.transactions)) {
      if (!isCalendarDate(t.date)) continue
      if (t.priorYear === true) {
        if (t.date < earliest || t.date >= start) problems.push(`${where} ${String(t.id)}: it is a priorYear row dated ${t.date}, outside the 12 months before the fiscal year starts on ${start}`)
      } else if (t.date < start) problems.push(`${where} ${String(t.id)}: it is dated ${t.date}, before the fiscal year starts on ${start}`)
      else if (t.date > end) problems.push(`${where} ${String(t.id)}: it is dated ${t.date}, after the fiscal year ends on ${end}`)
    }
    for (const j of objs(k.adjustingEntries)) {
      if (!isCalendarDate(j.date)) continue
      if (j.date < start) problems.push(`${where} ${String(j.id)}: it is dated ${j.date}, before the fiscal year starts on ${start}`)
      else if (j.date > end) problems.push(`${where} ${String(j.id)}: it is dated ${j.date}, after the fiscal year ends on ${end}`)
    }
    const months = yearMonths(start, end)
    const sb = isObj(k.statementBalances) ? k.statementBalances : {}
    for (const a of Object.keys(sb)) {
      for (const m of objs(sb[a])) if (isMonth(m.month) && !months.includes(m.month)) problems.push(`${where} statementBalances.${a} ${m.month}: the month is outside the fiscal year ${start} to ${end}`)
    }
    // Twins across files and inside the answer key.
    const corp = isObj(folder.onb?.corporation) ? folder.onb.corporation : {}
    const twin = (field, value, ok, why) => {
      if (value === undefined || value === null) return
      checked.push(`${folder.id} twin ${field}`)
      if (!ok(value)) problems.push(`${field.startsWith('answer-key') ? where : ONB(folder)} ${field.replace(/^answer-key /, '')}: ${String(value)}, but ${why}`)
    }
    twin('corporation.financial_year_end', corp.financial_year_end, (v) => v === end, `the fiscal year ends ${end}`)
    twin('corporation.fiscal_year_start', corp.fiscal_year_start, (v) => v === start, `the fiscal year starts ${start}`)
    twin('corporation.incorporation_date', corp.incorporation_date, (v) => isCalendarDate(v) && v <= start, `the fiscal year starts ${start}, before it`)
    twin('prior_year_closing_balances.as_of', folder.onb?.prior_year_closing_balances?.as_of, (v) => v === dayBefore(start), `the prior year closes the day before ${start}`)
    const ty = k.t2Inputs?.taxationYear
    if (isObj(ty)) {
      twin('answer-key t2Inputs.taxationYear.start', ty.start, (v) => v === start, `the fiscal year starts ${start}`)
      twin('answer-key t2Inputs.taxationYear.end', ty.end, (v) => v === end, `the fiscal year ends ${end}`)
    }
    const py = k.prior_year?.fiscalYear
    if (isObj(py)) twin('answer-key prior_year.fiscalYear.end', py.end, (v) => v === dayBefore(start), `the prior year ends the day before ${start}`)
    if (isObj(folder.onb) && Array.isArray(folder.onb.accounts_provided)) {
      const given = new Map(objs(folder.onb.accounts_provided).map((x) => [x.file, x]))
      const keyed = new Map(objs(k.accounts).map((a) => [a.file, a]))
      for (const [file, a] of keyed) {
        const g = given.get(file)
        if (g === undefined) problems.push(`${ONB(folder)} accounts_provided: ${String(file)} is a file of the answer key's account ${String(a.key)} but onboarding does not provide it`)
        else if (g.currency !== a.currency) problems.push(`${ONB(folder)} accounts_provided ${String(file)}: the currency ${String(g.currency)} is not the answer key's ${String(a.currency)}`)
      }
      for (const file of given.keys()) if (!keyed.has(file)) problems.push(`${ONB(folder)} accounts_provided: ${String(file)} is provided but no account of the answer key has it`)
    }
  }
  return { problems, checked }
}

// ---------- R61: loaders give a LoadIssue, never a raw error; files are read as what they are; no repeated key ----------
function r61(world) {
  const problems = []
  const checked = []
  for (const folder of world.folders) {
    const st = fs.lstatSync(folder.dir, { throwIfNoEntry: false })
    if (st === undefined || !st.isDirectory()) {
      problems.push(`${folder.label}: the client folder is ${st?.isSymbolicLink() ? 'a link' : 'not a folder'}`)
      continue
    }
    for (const name of ['answer-key.json', 'onboarding.json']) {
      const s = fs.lstatSync(path.join(folder.dir, name), { throwIfNoEntry: false })
      if (s === undefined) problems.push(`${folder.label}/${name}: the file is missing`)
      else if (!s.isFile()) problems.push(`${folder.label}/${name}: it is ${s.isSymbolicLink() ? 'a link' : 'not a regular file'}`)
    }
    for (const e of entries(folder.dir)) {
      checked.push(`${folder.label}/${e.rel}`)
      if (e.link) problems.push(`${folder.label}/${e.rel}: it is a link; a client folder holds only regular files and folders`)
      else if (e.file && e.rel.endsWith('.json')) problems.push(...jsonTextProblems(`${folder.label}/${e.rel}`, fs.readFileSync(path.join(folder.dir, ...e.rel.split('/')), 'utf8')))
    }
  }
  return { problems, checked }
}
function jsonTextProblems(label, text) {
  try {
    JSON.parse(text)
  } catch {
    return [`${label}: it is not valid JSON`]
  }
  return repeatedKeys(text).map((r) => `${label}: the key "${r.key}" is written twice in one object`)
}
/** Every JSON file of a kind folder (the test world reads them too, once kinds land). */
function kindJsonProblems(kindsDir = path.join(ROOT, KINDS_REL)) {
  if (!fs.existsSync(kindsDir)) return []
  return entries(kindsDir)
    .filter((e) => e.file && e.rel.endsWith('.json') && !/(^|\/)__(fixtures|golden)__\//.test(e.rel))
    .flatMap((e) => jsonTextProblems(`${KINDS_REL}/${e.rel}`, fs.readFileSync(path.join(kindsDir, ...e.rel.split('/')), 'utf8')))
}

/**
 * The loaders: every module of testworld/ that reads data files into the model. Each is run on the R61 plants (and
 * the loader plants of the other rules). A testworld module that reads files and is neither here nor in NOT_LOADERS
 * fails the scan.
 */
const LOADERS = [{ name: 'loadClient', file: LOADER_REL, run: (copy) => tw.loadClient(copy.id, { root: copy.root, faults: copy.catalogue }) }]
const NOT_LOADERS = {
  'testworld/generate.ts': 'compares regenerated bytes with the folder; it reads nothing into the model',
  'testworld/clients/json-keys.ts': 'JSON.parse decodes one key string of text the loader already read',
  'testworld/model/guard.ts': 'parses text the loader already read and handed to it',
}
const READS_FILES = /\b(?:readFileSync|readFile|readdirSync|readdir|createReadStream|JSON\.parse)\s*\(/
const isTestOrFixture = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)__(fixtures|golden)__\//.test(f)
function loaderScanProblems(files, read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')) {
  const known = new Set([...LOADERS.map((l) => l.file), ...Object.keys(NOT_LOADERS)])
  return files
    .filter((f) => /\.tsx?$/.test(f) && !isTestOrFixture(f) && READS_FILES.test(read(f)) && !known.has(f))
    .map((f) => `${f}: it reads files but is not in LOADERS (run on the R61 plants) or NOT_LOADERS (with a reason)`)
}
const testworldFiles = () => entries(path.join(ROOT, 'testworld')).filter((e) => e.file).map((e) => `testworld/${e.rel}`)

/** Runs a loader on a planted copy: the problems when it does not refuse with a LoadIssue naming the needle. */
function loaderProblems(loader, plantName, copy, expectRefusal) {
  const at = `${loader.file}: ${loader.name} on the ${plantName} plant`
  try {
    loader.run(copy)
    return [`${at} loads without refusing it`]
  } catch (e) {
    if (!(e instanceof tw.TestWorldLoadError)) return [`${at} throws ${e?.name ?? typeof e} instead of a LoadIssue: ${String(e?.message ?? e).split('\n')[0]}`]
    const hit = e.issues.filter((i) => (expectRefusal.check === undefined || i.check === expectRefusal.check) && `${i.record} ${i.reason}`.includes(expectRefusal.needle))
    return hit.length > 0 ? [] : [`${at} refuses it, but no${expectRefusal.check === undefined ? '' : ` '${expectRefusal.check}'`} issue names ${expectRefusal.needle}${expectRefusal.why === undefined ? '' : ` (${expectRefusal.why})`}`]
  }
}

// ---------- R75: every written derived value equals its computed twin ----------
const exported = (t) => t.missingFromExport !== true
const signOf = (a) => (a.role === 'card' || a.role === 'pcard' ? -1 : 1)
/** The derived fields: where each sits, and how its twin is computed from the data around it. */
const DERIVED = [
  {
    field: 'accounts[].rowsInExport',
    each: (k) => objs(k.accounts).map((a) => ({ at: `accounts[${String(a.key)}].rowsInExport`, has: Object.hasOwn(a, 'rowsInExport'), written: a.rowsInExport, computed: objs(k.transactions).filter((t) => t.acct === a.key && exported(t)).length })),
  },
  {
    field: 'accounts[].rowsMissingFromExport',
    each: (k) => objs(k.accounts).map((a) => ({ at: `accounts[${String(a.key)}].rowsMissingFromExport`, has: Object.hasOwn(a, 'rowsMissingFromExport'), written: a.rowsMissingFromExport, computed: objs(k.transactions).filter((t) => t.acct === a.key && !exported(t)).length })),
  },
  {
    field: 'statementBalances[][].exportActivity',
    each: (k) => months(k).map(({ a, m, activity }) => ({ at: `statementBalances.${String(a.key)}[${String(m.month)}].exportActivity`, has: Object.hasOwn(m, 'exportActivity'), written: cents(m.exportActivity), computed: activity })),
  },
  {
    field: 'statementBalances[][].rolls',
    each: (k) =>
      months(k).map(({ a, m, activity }) => {
        const o = cents(m.opening)
        const c = cents(m.closing)
        return { at: `statementBalances.${String(a.key)}[${String(m.month)}].rolls`, has: Object.hasOwn(m, 'rolls'), written: m.rolls, computed: o !== undefined && c !== undefined && activity !== undefined ? o + signOf(a) * activity === c : undefined }
      }),
  },
  ...['opening', 'unadjusted', 'adjusted'].flatMap((n) =>
    [['totalDebit', 'debit'], ['totalCredit', 'credit']].map(([total, side]) => ({
      field: `trialBalance.${n}.${total}`,
      each: (k) => {
        const tb = k.trialBalance?.[n]
        return isObj(tb) ? [{ at: `trialBalance.${n}.${total}`, has: Object.hasOwn(tb, total), written: cents(tb[total]), computed: sumCents(objs(tb.rows).map((r) => cents(r[side]))) }] : []
      },
    })),
  ),
  {
    field: 'adjustingEntries[].amount',
    each: (k) => objs(k.adjustingEntries).map((j) => ({ at: `adjustingEntries[${String(j.id)}].amount`, has: Object.hasOwn(j, 'amount'), written: cents(j.amount), computed: sumCents(objs(j.lines).map((l) => cents(l.debit))) })),
  },
  {
    field: 'fiscalYear.days',
    each: (k) => (isObj(k.fiscalYear) ? [daysTwin('fiscalYear.days', k.fiscalYear)] : []),
  },
  {
    field: 't2Inputs.taxationYear.days',
    each: (k) => (isObj(k.t2Inputs?.taxationYear) ? [daysTwin('t2Inputs.taxationYear.days', k.t2Inputs.taxationYear)] : []),
  },
]
function daysTwin(at, y) {
  return { at, has: Object.hasOwn(y, 'days'), written: y.days, computed: isCalendarDate(y.start) && isCalendarDate(y.end) ? dayNo(y.end) - dayNo(y.start) + 1 : undefined }
}
function months(k) {
  const sb = isObj(k.statementBalances) ? k.statementBalances : {}
  return objs(k.accounts).flatMap((a) =>
    (Object.hasOwn(sb, a.key) ? objs(sb[a.key]) : []).map((m) => ({
      a,
      m,
      activity: sumCents(objs(k.transactions).filter((t) => t.acct === a.key && exported(t) && String(t.date).slice(0, 7) === m.month).map((t) => cents(t.amount))),
    })),
  )
}
/** The onboarding twin of a derived value: each provided account's months is its count of statement months. */
function onboardingDerived(folder) {
  const k = folder.key
  const sb = isObj(k.statementBalances) ? k.statementBalances : {}
  const byFile = new Map(objs(k.accounts).map((a) => [a.file, a]))
  return objs(folder.onb?.accounts_provided)
    .filter((x) => Object.hasOwn(x, 'months') && byFile.has(x.file))
    .map((x) => {
      const a = byFile.get(x.file)
      return { at: `accounts_provided[${String(x.file)}].months`, has: true, written: x.months, computed: Object.hasOwn(sb, a.key) ? arr(sb[a.key]).length : 0 }
    })
}
const DERIVED_FIELDS = [...DERIVED.map((d) => d.field), 'onboarding accounts_provided[].months']
function r75(world) {
  const problems = []
  const checked = []
  for (const folder of world.folders) {
    const k = folder.key
    if (!isObj(k)) continue
    const all = [...DERIVED.map((d) => ({ field: d.field, file: KEY(folder), twins: d.each(k) })), { field: 'onboarding accounts_provided[].months', file: ONB(folder), twins: isObj(folder.onb) ? onboardingDerived(folder) : [] }]
    for (const { field, file, twins } of all) {
      for (const t of twins) {
        if (!t.has) continue
        checked.push(field)
        if (t.written !== t.computed) problems.push(`${file} ${t.at}: written ${String(t.written)}, computed ${String(t.computed)}`)
      }
    }
  }
  return { problems, checked }
}

// ---------- R76: a posting has exactly one side; a line is never read as 0 when it has neither side ----------
function r76(world) {
  const problems = []
  const checked = []
  for (const folder of world.folders) {
    const k = folder.key
    if (!isObj(k)) continue
    const where = KEY(folder)
    for (const t of objs(k.transactions)) {
      for (const [i, p] of arr(t.post).entries()) {
        checked.push(String(t.id))
        const at = `${where} transactions[${String(t.id)}].post[${String(i)}]`
        if (!isObj(p)) {
          problems.push(`${at}: it is not an object`)
          continue
        }
        const dr = Object.hasOwn(p, 'dr')
        const cr = Object.hasOwn(p, 'cr')
        if (!dr && !cr) problems.push(`${at}: it has neither dr nor cr`)
        else if (dr && cr) problems.push(`${at}: it has both dr and cr`)
        else if (cents(dr ? p.dr : p.cr) === undefined) problems.push(`${at}: its ${dr ? 'dr' : 'cr'} is not an amount in cents`)
        if (typeof p.a !== 'string' || p.a.trim() === '') problems.push(`${at}: it names no account`)
      }
    }
    const lines = [
      ...objs(k.adjustingEntries).flatMap((j) => objs(j.lines).map((l, i) => [`adjustingEntries[${String(j.id)}].lines[${String(i)}]`, l])),
      ...['opening', 'unadjusted', 'adjusted'].flatMap((n) => objs(k.trialBalance?.[n]?.rows).map((l, i) => [`trialBalance.${n}.rows[${String(i)}]`, l])),
    ]
    for (const [name, l] of lines) {
      checked.push(name)
      const at = `${where} ${name}`
      const d = Object.hasOwn(l, 'debit')
      const c = Object.hasOwn(l, 'credit')
      if (!d && !c) problems.push(`${at}: it has neither debit nor credit`)
      else if (!d || !c) problems.push(`${at}: it has ${d ? 'a debit and no credit' : 'a credit and no debit'} (both are written, one of them 0)`)
      else if (cents(l.debit) === undefined || cents(l.credit) === undefined) problems.push(`${at}: its debit or credit is not an amount in cents`)
      else if (cents(l.debit) !== 0 && cents(l.credit) !== 0) problems.push(`${at}: it has both a debit and a credit`)
    }
  }
  return { problems, checked }
}

const RULES = { R57: r57, R58: r58, R59: r59, R60: r60, R61: r61, R75: r75, R76: r76 }

// ---------- KNOWN ----------
const KNOWN = [
  // R76 "never read as 0" (reports/W00c-findings.md RC5): loadClient turns a missing dr or cr into 0 (`p.dr ?? 0`), so
  // the plant is refused only by the trial-balance tie-out, which names an account, never the posting. W00b is the
  // open card whose Paths hold testworld/clients/load.ts (Lead: confirm or reassign; amber in the SC2 spec report).
  {
    rule: 'R76',
    file: LOADER_REL,
    problems: [
      `${LOADER_REL}: loadClient on the r76-neither plant refuses it, but no issue names 10-CHQ-2025-01-0001 (a posting with neither side is read as 0)`,
      `${LOADER_REL}: loadClient on the r76-both plant refuses it, but no issue names 01-CHQ-2025-01-0001 (a posting with both sides is read as their difference)`,
    ],
    owner: 'W00b',
  },
]
const KNOWN_KEYS = ['rule', 'file', 'problems', 'owner', 'why']
/** The KNOWN shape (A407): one rule this file reads KNOWN for, one existing plain file, literal strings naming it, an open owner. */
function knownShapeProblems(known, statuses, fileOk = (f) => fs.existsSync(path.join(ROOT, f))) {
  const p = []
  const seen = new Set()
  for (const [i, k] of known.entries()) {
    const at = `KNOWN[${String(i)}] ${String(k?.rule)} ${String(k?.file)}`
    if (!isObj(k)) {
      p.push(`${at}: the entry is not an object`)
      continue
    }
    for (const key of Object.keys(k)) if (!KNOWN_KEYS.includes(key)) p.push(`${at}: the key ${key} is not one of rule, file, problems, owner, why`)
    if (!Object.hasOwn(RULES, k.rule)) p.push(`${at}: the rule is not one this file checks`)
    if (typeof k.file !== 'string' || /[*?{}[\]()|]/.test(k.file) || k.file.includes(',')) p.push(`${at}: the file is not one plain path`)
    else if (!fileOk(k.file)) p.push(`${at}: the file does not exist`)
    if (!Array.isArray(k.problems) || k.problems.length === 0) p.push(`${at}: problems is not a non-empty list`)
    for (const s of arr(k.problems)) {
      if (typeof s !== 'string') p.push(`${at}: a problem that is not a literal string (${String(s)})`)
      else {
        if (typeof k.file === 'string' && !s.includes(k.file)) p.push(`${at}: the problem ${JSON.stringify(s)} does not name the file`)
        if (seen.has(s)) p.push(`${at}: the problem ${JSON.stringify(s)} is listed twice`)
        seen.add(s)
      }
    }
    const status = statuses[k.owner]
    if (status === undefined) p.push(`${at}: the owner ${JSON.stringify(k.owner)} is not a card in plan/slices.json`)
    else if (status === 'done' || status === 'parked') p.push(`${at}: the owner ${String(k.owner)} is ${status}, so it can never fix the defect`)
  }
  return p
}
function onlyKnown(rule, problems, known = KNOWN) {
  const listed = known.filter((k) => k.rule === rule)
  const strings = listed.flatMap((k) => k.problems)
  const unknown = problems.filter((s) => !strings.includes(s))
  const stale = listed.flatMap((k) => k.problems.filter((s) => !problems.includes(s)).map((s) => `stale KNOWN entry ${k.rule} ${k.file} (owner ${k.owner}): ${JSON.stringify(s)} no longer fails; remove it`))
  return [...unknown, ...stale]
}
const liveStatuses = () => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'slices.json'), 'utf8')).cards.map((c) => [c.id, c.status]))

// ---------- plants ----------
const BASES = ['C01', 'C07', 'C09', 'C10', 'C12']
const PLANT_KEYS = ['rule', 'base', 'what', 'edits', 'catalogue', 'problems', 'contains', 'count', 'loader']
const plantFiles = fs.existsSync(PLANTS) ? fs.readdirSync(PLANTS).filter((f) => f.endsWith('.json')).sort() : []
const plants = plantFiles.map((f) => ({ name: f.slice(0, -'.json'.length), ...JSON.parse(fs.readFileSync(path.join(PLANTS, f), 'utf8')) }))
const plantsOf = (rule) => plants.filter((p) => p.rule === rule)
/** The rule's problems on a plant, checked against the plant's expectation: exact list, or contains plus a count. */
function expectPlant(plant, problems) {
  if (plant.problems !== undefined) expect(problems).toEqual(plant.problems)
  else {
    expect(problems).toEqual(expect.arrayContaining(plant.contains))
    expect(problems.length).toEqual(plant.count)
  }
}

// =====================================================================================================================
describe('SC2 the test world the rules run on: every folder, every kind, the whole catalogue (A407 sentinels)', () => {
  const world = realWorld()
  test('ARC-8 the world scan reads every numbered folder of reference/sample-clients, with C10 and C12 as sentinels', () => {
    const labels = world.folders.map((f) => f.label)
    expect(labels.length).toBeGreaterThan(0)
    expect(labels).toEqual(expect.arrayContaining([`${SAMPLE_REL}/10-danforth-cleaning`, `${SAMPLE_REL}/12-kensington-market-crafts`]))
    const onDisk = fs.readdirSync(path.join(ROOT, SAMPLE_REL)).filter((n) => FOLDER_ID.test(n)).map((n) => `${SAMPLE_REL}/${n}`)
    expect(labels).toEqual(onDisk.sort())
    expect(world.catalogue.map((f) => f.id)).toContain('10-F01')
  })
  test('ARC-8 rule: a kind folder that lands with no KIND_READERS entry is caught; a kind with one is not', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-kinds-'))
    try {
      fs.mkdirSync(path.join(tmp, 'K12'))
      fs.mkdirSync(path.join(tmp, 'K02'))
      expect(kindLandingProblems({ K02: () => [] }, tmp)).toEqual([
        `${KINDS_REL}/K12: a kind landed with no KIND_READERS entry in tools/test/testworld-rules.test.mjs, so R57 to R61, R75 and R76 do not run on it`,
      ])
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
  test('ARC-8 every kind folder under testworld/kinds has a KIND_READERS entry', () => {
    expect(kindLandingProblems()).toEqual([])
  })
  test('ARC-8 every plant names one of the seven rules, a card base (C01, C07, C09, C10, C12) and an expectation; every rule has plants', () => {
    expect(plants.length).toBeGreaterThan(0)
    const bad = plants.flatMap((p) => [
      ...Object.keys(p).filter((k) => k !== 'name' && !PLANT_KEYS.includes(k)).map((k) => `${p.name}: the key ${k} is not a plant key`),
      ...(Object.hasOwn(RULES, p.rule) ? [] : [`${p.name}: the rule ${String(p.rule)} is not one of ${Object.keys(RULES).join(', ')}`]),
      ...(BASES.includes(p.base) ? [] : [`${p.name}: the base ${String(p.base)} is not one of ${BASES.join(', ')}`]),
      ...(typeof p.what === 'string' && p.what !== '' ? [] : [`${p.name}: it does not say what it plants`]),
      ...(Array.isArray(p.problems) || (Array.isArray(p.contains) && Number.isSafeInteger(p.count)) ? [] : [`${p.name}: it has no exact problems and no contains with a count`]),
      ...(p.name.startsWith(`${String(p.rule).toLowerCase()}-`) ? [] : [`${p.name}: the file name does not start with its rule`]),
    ])
    expect(bad).toEqual([])
    for (const rule of Object.keys(RULES)) expect(plantsOf(rule).length, rule).toBeGreaterThan(0)
  })
})

describe('SC2 a clean planted copy is clean: the harness copies faithfully, so every plant failure comes from its edit', () => {
  for (const base of BASES) {
    test(`ARC-8 harness: an unedited copy of ${base} loads through loadClient and passes all seven rules`, async () => {
      await withPlant({ base }, (copy) => {
        expect(fs.realpathSync(copy.dir).startsWith(fs.realpathSync(os.tmpdir()))).toBe(true)
        expect(path.dirname(copy.dir)).toEqual(copy.root)
        expect(copy.id).toEqual(base)
        expect(copy.catalogue).toEqual(tw.faults())
        expect(copy.catalogue).not.toBe(tw.faults())
        expect(() => tw.loadClient(copy.id, { root: copy.root, faults: copy.catalogue })).not.toThrow()
        const world = plantWorld(copy)
        const problems = Object.entries(RULES).flatMap(([rule, fn]) => fn(world).problems.map((s) => `${rule} ${s}`))
        expect(problems).toEqual([])
      })
    })
  }
  test('ARC-8 harness: a step that finds nothing throws instead of planting nothing', async () => {
    const { plantedCopy } = await harness()
    expect(() => plantedCopy({ base: 'C07', edits: [{ op: 'set', file: 'answer-key.json', path: ['transactions', { id: 'no-such-row (Test)' }, 'amount'], value: 1 }] })).toThrow()
    expect(() => plantedCopy({ base: 'C07', edits: [{ op: 'text', file: 'answer-key.json', find: 'no such text (Test)', replace: 'x' }] })).toThrow()
    expect(() => plantedCopy({ base: 'C07', catalogue: [{ op: 'set', id: 'no-such-entry (Test)', path: ['planted'], value: 'x' }] })).toThrow()
    expect(() => plantedCopy({ base: 'C07', catalogue: [{ op: 'dropClient', client: 'C99' }] })).toThrow()
  })
  test('ARC-8 harness: a plant never writes to reference/sample-clients', async () => {
    const real = path.join(ROOT, SAMPLE_REL, '07-riverdale-rentals', 'onboarding.json')
    const before = fs.readFileSync(real, 'utf8')
    await withPlant({ base: 'C07', edits: [{ op: 'set', file: 'onboarding.json', path: ['owners'], value: [] }] }, (copy) => {
      expect(JSON.parse(fs.readFileSync(path.join(copy.dir, 'onboarding.json'), 'utf8')).owners).toEqual([])
    })
    expect(fs.readFileSync(real, 'utf8')).toEqual(before)
  })
})

/** One describe per rule: its plants (each failing as its file says, and the loader refusing it where the plant says so), then the real world. */
function ruleSuite(rule, title, sentinels, extra = () => undefined) {
  describe(`SC2 ${rule} ${title}`, () => {
    for (const plant of plantsOf(rule)) {
      test(`ARC-8 ${rule} rule: the ${plant.name} plant (${plant.base}: ${plant.what}) is caught`, async () => {
        await withPlant(plant, (copy) => {
          expectPlant(plant, RULES[rule](plantWorld(copy)).problems)
          if (plant.loader !== undefined) {
            const problems = LOADERS.flatMap((l) => loaderProblems(l, plant.name, copy, plant.loader))
            const forPlant = KNOWN.map((k) => ({ ...k, problems: k.problems.filter((s) => s.includes(`the ${plant.name} plant`)) })).filter((k) => k.problems.length > 0)
            expect(onlyKnown(rule, problems, forPlant)).toEqual([])
          }
        })
      })
    }
    test(`ARC-8 ${rule} holds on the real test world (KNOWN only), and its scan reached its sentinels`, () => {
      const { problems, checked } = RULES[rule](realWorld())
      // Loader KNOWN strings are produced by the plant tests, never by the world scan.
      expect(onlyKnown(rule, problems, KNOWN.filter((k) => k.file !== LOADER_REL))).toEqual([])
      expect(checked.length).toBeGreaterThan(0)
      expect(checked).toEqual(expect.arrayContaining(sentinels))
    })
    extra()
  })
}

ruleSuite('R57', 'markers: every marked row is pinned by id, date and amount; no count or sum pins; no vacuous proof', ['10-CHQ-2025-05-0001', '10-CHQ-2025-03-0009', '10-CHQ-2024-12-0001'], () => {
  test('ARC-13 R57 property: any non-zero cent change to any pinned row of C10 is caught, naming that row', () => {
    const world = realWorld()
    const c10 = world.folders.find((f) => f.id === 'C10')
    const pinned = world.catalogue.filter((f) => f.client === 'C10' && isObj(f.marker)).flatMap((f) => f.marker.rows.map((r) => r.id))
    expect(pinned).toContain('10-CHQ-2025-05-0001')
    fc.assert(
      fc.property(fc.constantFrom(...pinned), fc.integer({ min: -500_000, max: 500_000 }).filter((d) => d !== 0), (id, delta) => {
        const key = structuredClone(c10.key)
        const t = key.transactions.find((x) => x.id === id)
        t.amount = (cents(t.amount) + delta) / 100
        const { problems } = r57({ folders: [{ ...c10, key }], catalogue: world.catalogue })
        return problems.length === 1 && problems[0].includes(` ${id} (`) && problems[0].includes('the catalogue pins')
      }),
      { seed: SEED, numRuns: 200 },
    )
  })
  test('ARC-13 R57 property: a +k / -k pair on two pinned rows (count and sum unchanged) is caught on both rows', () => {
    const world = realWorld()
    const c10 = world.folders.find((f) => f.id === 'C10')
    const pinned = world.catalogue.filter((f) => f.client === 'C10' && isObj(f.marker)).flatMap((f) => f.marker.rows.map((r) => r.id))
    fc.assert(
      fc.property(fc.uniqueArray(fc.constantFrom(...pinned), { minLength: 2, maxLength: 2 }), fc.integer({ min: 1, max: 100_000 }), ([a, b], k) => {
        const key = structuredClone(c10.key)
        const ta = key.transactions.find((x) => x.id === a)
        const tb = key.transactions.find((x) => x.id === b)
        ta.amount = (cents(ta.amount) + k) / 100
        tb.amount = (cents(tb.amount) - k) / 100
        const { problems } = r57({ folders: [{ ...c10, key }], catalogue: world.catalogue })
        return problems.length === 2 && problems.some((s) => s.includes(` ${a} (`)) && problems.some((s) => s.includes(` ${b} (`))
      }),
      { seed: SEED, numRuns: 100 },
    )
  })
  test('ARC-8 R57 rule: the marker shape refuses an aggregate pin, an empty row list, a row without a date, and a dupOf row without its original', () => {
    const entry = (marker) => ({ id: 'X-F01 (Test)', client: 'C99', flagId: 'X-F01 (Test)', planted: 'p', expected: 'e', marker })
    expect(
      markerShapeProblems([
        entry({ field: 'missingFromExport', account: 'CHQ', month: '2025-05', count: 56, totalCents: 1200 }),
        entry({ field: 'dupOf', account: 'CHQ', month: '2025-03', rows: [{ id: 'r1', amountCents: 5, dupOf: 'r0' }, { id: 'r2', date: '2025-03-02', amountCents: 5 }] }),
        entry({ field: 'priorYear', account: 'CHQ', month: '2024-12', rows: [] }),
      ]),
    ).toEqual([
      `${CATALOGUE} X-F01 (Test): the marker key count is not one of field, account, month, rows (a count or a sum never pins a row)`,
      `${CATALOGUE} X-F01 (Test): the marker key totalCents is not one of field, account, month, rows (a count or a sum never pins a row)`,
      `${CATALOGUE} X-F01 (Test): the marker lists no rows (each marked row is pinned by id, date and amount)`,
      `${CATALOGUE} X-F01 (Test) row r1: its date undefined is not a calendar date`,
      `${CATALOGUE} X-F01 (Test) row r2: a dupOf row pins no original`,
      `${CATALOGUE} X-F01 (Test): the marker lists no rows (each marked row is pinned by id, date and amount)`,
    ])
  })
})
ruleSuite('R58', 'id-keyed lists refuse repeats and no data key is the name of an Object.prototype member', [CATALOGUE, `${SAMPLE_REL}/10-danforth-cleaning transactions`, `${SAMPLE_REL}/12-kensington-market-crafts flags`])
ruleSuite('R59', 'every list that drives a check is non-empty or declared empty by data (accounts, year months, trial-balance rows, marker rows, catalogue entries)', ['C12 accounts declared empty', 'C09 opening empty in a first year', `${SAMPLE_REL}/01-maple-ridge lists`])
ruleSuite('R60', 'every date-shaped leaf of every JSON (a walk, not a field list) is a date or month; ranges in order; twins agree; file fields fit their folder', [
  `${SAMPLE_REL}/10-danforth-cleaning/answer-key.json assets.0.availableForUse`,
  `${SAMPLE_REL}/10-danforth-cleaning/onboarding.json prior_year_closing_balances.as_of`,
  'C09 twin corporation.incorporation_date',
  'C11 twin answer-key prior_year.fiscalYear.end',
])
ruleSuite('R61', 'every loader turns a folder, a missing file, bad JSON, a link or a repeated key into a LoadIssue; files are read as what they are', [`${SAMPLE_REL}/10-danforth-cleaning/answer-key.json`, `${SAMPLE_REL}/12-kensington-market-crafts/onboarding.json`], () => {
  test('ARC-8 R61 rule: a planted testworld module that reads files with no LOADERS or NOT_LOADERS entry is caught; a test file and a registered loader are not', () => {
    const files = ['testworld/kinds/K12/answers (Test).ts', 'testworld/kinds/K12/answers.test.ts', LOADER_REL]
    expect(loaderScanProblems(files, () => "const raw = JSON.parse(readFileSync(p, 'utf8'))")).toEqual([
      'testworld/kinds/K12/answers (Test).ts: it reads files but is not in LOADERS (run on the R61 plants) or NOT_LOADERS (with a reason)',
    ])
  })
  test('ARC-8 R61 every testworld module that reads files is a registered loader or a reasoned exemption (scan reached load.ts)', () => {
    const files = testworldFiles()
    expect(files).toContain(LOADER_REL)
    expect(loaderScanProblems(files)).toEqual([])
    for (const f of Object.keys(NOT_LOADERS)) expect(files, `${f} in NOT_LOADERS no longer exists`).toContain(f)
  })
  test('ARC-8 R61 rule: a planted kind JSON with a repeated key and a malformed one are caught', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-kindjson-'))
    try {
      fs.mkdirSync(path.join(tmp, 'K12'))
      fs.writeFileSync(path.join(tmp, 'K12', 'a.json'), '{"x": 1, "y": {"x": 2}, "x": 3}')
      fs.writeFileSync(path.join(tmp, 'K12', 'b.json'), '{"x": ')
      expect(kindJsonProblems(tmp)).toEqual([`${KINDS_REL}/K12/a.json: the key "x" is written twice in one object`, `${KINDS_REL}/K12/b.json: it is not valid JSON`])
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
  test('ARC-8 R61 every JSON file under testworld/kinds parses and has no repeated key', () => {
    expect(kindJsonProblems()).toEqual([])
  })
})
ruleSuite('R75', 'every written derived value equals its computed twin (rolls, rowsInExport and the rest of DERIVED)', DERIVED_FIELDS, () => {
  test('ARC-13 R75 property: any non-zero cent change to any written exportActivity of C07 or C10 is caught on exactly that month', () => {
    const world = realWorld()
    const folders = world.folders.filter((f) => f.id === 'C07' || f.id === 'C10')
    const spots = folders.flatMap((f) => Object.entries(f.key.statementBalances).flatMap(([a, ms]) => ms.map((m, i) => ({ f, a, i, month: m.month }))))
    expect(spots.length).toBeGreaterThan(0)
    fc.assert(
      fc.property(fc.constantFrom(...spots), fc.integer({ min: -1_000_000, max: 1_000_000 }).filter((d) => d !== 0), ({ f, a, i, month }, delta) => {
        const key = structuredClone(f.key)
        const m = key.statementBalances[a][i]
        m.exportActivity = (cents(m.exportActivity) + delta) / 100
        const { problems } = r75({ folders: [{ ...f, key }], catalogue: world.catalogue })
        return problems.length === 1 && problems[0].startsWith(`${KEY(f)} statementBalances.${a}[${month}].exportActivity: written`)
      }),
      { seed: SEED, numRuns: 200 },
    )
  })
  test('ARC-13 R75 property: the computed trial-balance totals are exact integer sums, whatever the row order', () => {
    const world = realWorld()
    const c01 = world.folders.find((f) => f.id === 'C01')
    const rows = c01.key.trialBalance.adjusted.rows
    fc.assert(
      fc.property(fc.shuffledSubarray(rows, { minLength: rows.length, maxLength: rows.length }), (shuffled) => {
        const key = structuredClone(c01.key)
        key.trialBalance.adjusted.rows = shuffled
        return r75({ folders: [{ ...c01, key }], catalogue: world.catalogue }).problems.length === 0
      }),
      { seed: SEED, numRuns: 50 },
    )
  })
})
ruleSuite('R76', 'a posting has exactly one of dr and cr, and a line has a debit or a credit, never read as 0', ['10-CHQ-2025-01-0001', 'adjustingEntries[12-AJE-01].lines[0]'])

describe('SC2 KNOWN: every exemption is exact, owned by an open card, and alive (A407)', () => {
  const PINNED = { W00b: 'carded', W00c: 'done', SC2: 'carded', A04: 'parked' }
  test('ARC-8 KNOWN shape rule: a planted entry with a pattern, two files, a done or parked owner, an unknown rule, a string that names no file and a repeat is caught', () => {
    const ok = { rule: 'R76', file: LOADER_REL, problems: [`${LOADER_REL}: x (Test)`], owner: 'W00b' }
    const planted = [
      ok,
      { ...ok, problems: [/load\.ts/] },
      { ...ok, file: 'testworld/clients/{load,checks}.ts', problems: ['testworld/clients/{load,checks}.ts: y (Test)'] },
      { ...ok, owner: 'W00c', problems: [`${LOADER_REL}: z (Test)`] },
      { ...ok, owner: 'A04', problems: [`${LOADER_REL}: w (Test)`] },
      { ...ok, rule: 'R99', problems: [`${LOADER_REL}: v (Test)`] },
      { ...ok, problems: ['a problem that names no file (Test)'] },
      { ...ok, owner: 'no-such-card', match: 'x', problems: [`${LOADER_REL}: x (Test)`] },
    ]
    expect(knownShapeProblems(planted, PINNED)).toEqual([
      `KNOWN[1] R76 ${LOADER_REL}: a problem that is not a literal string (/load\\.ts/)`,
      'KNOWN[2] R76 testworld/clients/{load,checks}.ts: the file is not one plain path',
      `KNOWN[3] R76 ${LOADER_REL}: the owner W00c is done, so it can never fix the defect`,
      `KNOWN[4] R76 ${LOADER_REL}: the owner A04 is parked, so it can never fix the defect`,
      `KNOWN[5] R99 ${LOADER_REL}: the rule is not one this file checks`,
      `KNOWN[6] R76 ${LOADER_REL}: the problem "a problem that names no file (Test)" does not name the file`,
      `KNOWN[7] R76 ${LOADER_REL}: the key match is not one of rule, file, problems, owner, why`,
      `KNOWN[7] R76 ${LOADER_REL}: the problem ${JSON.stringify(`${LOADER_REL}: x (Test)`)} is listed twice`,
      `KNOWN[7] R76 ${LOADER_REL}: the owner "no-such-card" is not a card in plan/slices.json`,
    ])
    expect(knownShapeProblems([ok], PINNED)).toEqual([])
  })
  test('ARC-8 KNOWN rule: an unlisted problem fails and a listed string no longer produced fails as stale', () => {
    const known = [{ rule: 'R76', file: LOADER_REL, problems: [`${LOADER_REL}: a (Test)`, `${LOADER_REL}: b (Test)`], owner: 'W00b' }]
    expect(onlyKnown('R76', [`${LOADER_REL}: a (Test)`, `${LOADER_REL}: c (Test)`], known)).toEqual([
      `${LOADER_REL}: c (Test)`,
      `stale KNOWN entry R76 ${LOADER_REL} (owner W00b): ${JSON.stringify(`${LOADER_REL}: b (Test)`)} no longer fails; remove it`,
    ])
    expect(onlyKnown('R57', [`${LOADER_REL}: a (Test)`], known)).toEqual([`${LOADER_REL}: a (Test)`])
  })
  test('ARC-8 the KNOWN list of this file has the KNOWN shape against plan/slices.json', () => {
    expect(knownShapeProblems(KNOWN, liveStatuses())).toEqual([])
  })
  test('ARC-8 every KNOWN loader string is produced by a plant that names it (none is orphaned)', () => {
    const named = KNOWN.flatMap((k) => k.problems).map((s) => /the (\S+) plant/.exec(s)?.[1])
    for (const n of named) expect(plants.map((p) => p.name)).toContain(n)
  })
})
