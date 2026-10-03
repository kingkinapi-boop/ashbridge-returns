// SC5: settings and strictness rules R71 to R73, R83, R84, R88 and R101 (unit project). Card plan/cards/SC5.md;
// clauses ARC-20, ARC-15, ARC-22, SEC-11 and the clauses each rule names. From reports/A04-findings.md ("Rule tests
// for everywhere": its R74 and R75 are R83 and R84 here), reports/FX2-security.md (R88) and W00c's findings review 3
// (R101). Each rule is first shown catching a planted bad example under tools/test/__fixtures__/settings-rules/, then
// applied to the repo.
//
// A rule that fails on landed code is a defect of the card that owns the file (card SC5: "a KNOWN entry, never a
// product fix here"). Those found when the spec was validated are in known.json beside the plants, each with one rule,
// one file, the exact problem strings (no pattern) and an open owner card; a problem not listed fails, and a listed
// string no longer printed fails as stale, so the list only shrinks (A407). Every file scan asserts it read at least
// one file and a named sentinel. A rule with nothing to check fails ("a pass with zero tests is a failure").
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX_REL = 'tools/test/__fixtures__/settings-rules'
const FIX = path.join(ROOT, ...FIX_REL.split('/'))
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href)
const loadFix = (name) => import(pathToFileURL(path.join(FIX, name)).href)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const tmpRoots = []
function tmpDir(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `sc5-${tag}-`))
  tmpRoots.push(d)
  return d
}
afterAll(() => {
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true })
})

// ---------- known defects on main: tools/test/__fixtures__/settings-rules/known.json (A407) ----------
const KNOWN_REL = `${FIX_REL}/known.json`
const KNOWN = JSON.parse(read(KNOWN_REL)).entries
const KNOWN_KEYS = new Set(['rule', 'file', 'problems', 'owner', 'why'])
const CLOSED = new Set(['done', 'parked'])
const RULES = new Set([
  'R71', 'R71-harness', 'R71-names', 'R72', 'R73', 'R73-run', 'R83', 'R84', 'R84-run', 'R88', 'R88-run', 'R101-record', 'R101-json', 'R101-run',
])
// Only the real-data tests read plan/slices.json; every plant test passes these pinned statuses (SC spec review 3 gap 2).
const cardStatuses = () => new Map(JSON.parse(read('plan/slices.json')).cards.map((c) => [c.id, c.status]))
const PINNED_STATUSES = new Map([
  ['FX2', 'done'], ['FX7', 'carded'], ['FX11', 'carded'], ['FX13', 'carded'], ['FX16', 'carded'], ['SC5', 'carded'], ['A04', 'done'],
])
/** The path a problem string leads with (up to "#" or ": "). */
const leadingPath = (p) => /^([^\s:#"]+\/[^:#"]*?)(?:#|: )/.exec(p)?.[1] ?? null

/**
 * The KNOWN shape (A407): one rule this file reads KNOWN for, one plain path that is a real file, a non-empty list of
 * literal strings each leading with that path, no string twice, and an open owner card that is not SC5 itself.
 */
function knownShapeProblems(entries, { statuses, fileOk }) {
  const problems = []
  const seen = new Set()
  entries.forEach((k, i) => {
    const at = `KNOWN[${String(i)}] ${String(k?.rule)} ${String(k?.file)}`
    if (k === null || typeof k !== 'object' || Array.isArray(k)) {
      problems.push(`${at}: not an object`)
      return
    }
    for (const key of Object.keys(k)) if (!KNOWN_KEYS.has(key)) problems.push(`${at}: the key ${key} is not one of rule, file, problems, owner, why`)
    if (typeof k.rule !== 'string' || !RULES.has(k.rule)) problems.push(`${at}: the rule is not one whose test reads KNOWN`)
    if (typeof k.file !== 'string' || k.file === '' || /[*?|,{}[\]\\^$]/.test(k.file)) problems.push(`${at}: the file is not one plain path`)
    else if (!fileOk(k.file)) problems.push(`${at}: the file does not exist`)
    if (!Array.isArray(k.problems) || k.problems.length === 0) problems.push(`${at}: problems is not a non-empty list`)
    for (const p of Array.isArray(k.problems) ? k.problems : []) {
      if (typeof p !== 'string' || p === '') {
        problems.push(`${at}: a problem that is not a literal string (${Object.prototype.toString.call(p)})`)
        continue
      }
      if (seen.has(p)) problems.push(`${at}: the problem ${JSON.stringify(p)} is listed twice`)
      seen.add(p)
      const subject = leadingPath(p)
      if (subject === null) problems.push(`${at}: the problem names no file`)
      else if (subject !== k.file) problems.push(`${at}: the problem names another file (${subject})`)
    }
    if (typeof k.why !== 'string' || k.why.trim() === '') problems.push(`${at}: no why`)
    if (k.owner === 'SC5') problems.push(`${at}: SC5 cannot own a defect it lands with`)
    const status = typeof k.owner === 'string' ? statuses.get(k.owner) : undefined
    if (status === undefined) problems.push(`${at}: the owner ${JSON.stringify(k.owner)} is not a card in plan/slices.json`)
    else if (CLOSED.has(status)) problems.push(`${at}: the owner ${String(k.owner)} is ${String(status)}, so it can never fix the defect`)
  })
  return problems
}
/** The problems a rule prints that KNOWN does not list, and every listed string it no longer prints (stale). */
function onlyKnown(rule, problems, known = KNOWN) {
  const mine = known.filter((k) => k.rule === rule)
  const listed = new Set(mine.flatMap((k) => k.problems))
  const unknown = problems.filter((p) => !listed.has(p))
  const stale = mine.flatMap((k) =>
    k.problems.filter((s) => !problems.includes(s)).map((s) => `stale KNOWN entry ${k.rule} ${k.file} (owner ${k.owner}): ${JSON.stringify(s)} no longer fails; remove it`),
  )
  return [...new Set(unknown), ...stale]
}
function scanProblems(label, files, sentinel) {
  if (files.length === 0) return [`${label}: the scan read no file`]
  return files.includes(sentinel) ? [] : [`${label}: the scan missed its sentinel ${sentinel}`]
}

// ---------- files ----------
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.stryker-tmp', 'coverage', 'test-results', 'playwright-report', 'reports'])
function walk(dirRel, out = []) {
  const abs = path.join(ROOT, dirRel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) && dirRel === '') continue
    if (['node_modules', '.git', '.stryker-tmp'].includes(e.name)) continue
    const r = dirRel === '' ? e.name : `${dirRel}/${e.name}`
    if (e.isDirectory()) walk(r, out)
    else out.push(r)
  }
  return out
}
let walked
const walkedFileOk = (f) => (walked ??= new Set([...walk('src'), ...walk('testworld'), ...walk('tools'), ...walk('data')])).has(f)
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f)
const isFixture = (f) => /(^|\/)(__fixtures__|__golden__|__recordings__)\//.test(f)
const CODE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const productCode = (dirs) => dirs.flatMap((d) => walk(d)).filter((f) => CODE.test(f) && !f.endsWith('.d.ts') && !isTest(f) && !isFixture(f)).sort()

/** The file a relative import names, among `fileSet`, or null. */
function resolveRel(from, spec, fileSet) {
  if (!spec.startsWith('.')) return null
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
  const cands = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}/index.ts`, base.replace(/\.js$/, '.ts')]
  return cands.find((c) => fileSet.has(c)) ?? null
}
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
const importsOf = (src) => [...src.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3])

// ---------- the test harness: tools/test-homes.json's "harness" list and what it imports ----------
// Harness files run only under Vitest (setup files, the test database); they may read process.env (FX2's security
// review counts them as tests). R71-harness proves no product file reaches one, so the exemption cannot hide a read.
const HARNESS = JSON.parse(read('tools/test-homes.json')).harness
/**
 * The harness: the listed files, plus what they import that only harness files import (DB16's target.ts). A file
 * product code also imports (the clock) is product code, so it never joins.
 */
function harnessClosure(roots, readFile, fileSet) {
  const out = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const f = queue.shift()
    if (out.has(f) || !fileSet.has(f)) continue
    out.add(f)
    for (const spec of importsOf(readFile(f))) {
      const r = resolveRel(f, spec, fileSet)
      if (r !== null) queue.push(r)
    }
  }
  const importers = (c) => [...fileSet].filter((g) => g !== c && importsOf(readFile(g)).some((spec) => resolveRel(g, spec, fileSet) === c))
  for (let changed = true; changed; ) {
    changed = false
    for (const c of [...out]) {
      if (roots.includes(c)) continue
      if (importers(c).some((g) => !out.has(g))) {
        out.delete(c)
        changed = true
      }
    }
  }
  return out
}
function harnessImportProblems(files, readFile, harness) {
  const problems = []
  for (const f of files) {
    if (harness.has(f)) continue
    for (const spec of importsOf(readFile(f))) {
      const r = resolveRel(f, spec, new Set([...files, ...harness]))
      if (r !== null && harness.has(r)) problems.push(`${f}: imports the test harness file ${r} (product code never reaches the harness)`)
    }
  }
  return problems
}

// ---------- R71: settings are read only through src/core/env.ts ----------
const ENV_FILE = 'src/core/env.ts'
const PROCESS_ENV_FORMS = [
  /\bprocess\s*(?:\?\.|\.)\s*env\b/,
  /\bprocess\s*\[\s*['"`]env['"`]\s*\]/,
  /\{[^}]*\benv\b[^}]*\}\s*=\s*process\b/,
  /\bimport\s*\{[^}]*\benv\b[^}]*\}\s*from\s*['"](?:node:)?process['"]/,
  /\bimport\.meta\.env\b/,
]
function processEnvProblems(files, readFile, exempt) {
  return files
    .filter((f) => !exempt.has(f) && PROCESS_ENV_FORMS.some((re) => re.test(readFile(f))))
    .map((f) => `${f}: reads process.env outside ${ENV_FILE} (read settings through readSettings)`)
}

const SETTING_NAME = '[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+'
/** Variables that hold the whole settings object: `const settings = readSettings(env)`. */
function settingsObjects(src) {
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*readSettings\s*\([^()]*\)\s*(?:;|\n|$)/g
  return new Set([...src.matchAll(re)].map((m) => m[1]))
}
/** Every setting name a file reads: a quoted setting-shaped literal, a property of the settings object, a destructured name. */
function settingReads(src) {
  const names = []
  for (const m of src.matchAll(new RegExp(`(['"\`])(${SETTING_NAME})\\1`, 'g'))) names.push(m[2])
  const recv = ['readSettings\\s*\\([^()]*\\)', ...[...settingsObjects(src)].map(escapeRe)].join('|')
  for (const m of src.matchAll(new RegExp(`(?<![\\w$.])(?:${recv})\\s*(?:\\?\\.|\\.)\\s*([A-Z][A-Z0-9_]*)\\b`, 'g'))) names.push(m[1])
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*readSettings\s*\(/g)) {
    for (const part of m[1].split(',')) {
      const key = part.split(':')[0].split('=')[0].trim()
      if (key !== '') names.push(key)
    }
  }
  return [...new Set(names)]
}
// Quoted setting-shaped literals that are not settings, each reviewed (a listed name the file no longer holds is stale).
const NOT_SETTINGS = [{ file: 'src/core/safe-read.ts', names: ['O_NONBLOCK'], why: 'an fs open flag read from fs.constants, not a setting' }]
/** Whether `name` is a key of env.ts's schema, asked of readSettings itself (the schema is not exported). */
function isSettingKey(readSettings, name) {
  try {
    const data = readSettings({ [name]: 'probe-value-not-a-key-Test' })
    return Object.prototype.hasOwnProperty.call(data, name)
  } catch (e) {
    const named = /^Invalid settings: (.*)$/.exec(String(e?.message ?? ''))?.[1]
    return named?.split(', ').includes(name) ?? false
  }
}
function settingNameProblems(files, readFile, isKey, notSettings = NOT_SETTINGS) {
  const problems = []
  for (const f of files) {
    const allowed = new Set(notSettings.find((n) => n.file === f)?.names ?? [])
    for (const name of settingReads(readFile(f))) {
      if (allowed.has(name)) continue
      if (!isKey(name)) problems.push(`${f}: reads the setting ${name}, which is not a key of ${ENV_FILE}'s schema`)
    }
  }
  for (const n of notSettings) {
    const reads = files.includes(n.file) ? settingReads(readFile(n.file)) : []
    for (const name of n.names) if (!reads.includes(name)) problems.push(`NOT_SETTINGS ${n.file}: ${name} is no longer there; remove it`)
  }
  return problems
}
const SETTING_NAMES_EXPORT = /\bexport\s+const\s+([A-Za-z_$][\w$]*_SETTING_NAMES)\b/g
function settingNamesExportProblems(file, mod, src, isKey) {
  const problems = []
  for (const m of src.matchAll(SETTING_NAMES_EXPORT)) {
    const list = mod[m[1]]
    if (!Array.isArray(list) || list.length === 0 || !list.every((x) => typeof x === 'string')) {
      problems.push(`${file}#${m[1]}: is not a non-empty list of setting names`)
      continue
    }
    for (const name of list) if (!isKey(name)) problems.push(`${file}#${m[1]}: names the setting ${name}, which is not a key of ${ENV_FILE}'s schema`)
  }
  return problems
}
/** The keys env.ts's schema object spells out (read from its source, then each confirmed by readSettings). */
function envSchemaKeys(src) {
  const body = /const\s+schema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/.exec(src)?.[1] ?? ''
  return [...body.matchAll(/^\s{2}([A-Z][A-Z0-9_]*)\s*:/gm)].map((m) => m[1])
}

// ---------- R72: no boolean literal constant gates a branch ----------
const BOOL_CONST = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*boolean\s*)?=\s*\(?\s*(true|false|!0|!1)\s*\)?\s*(?:as\s+(?:boolean|const)\s*)?(?=[;\n,)])/g
function gates(text, name) {
  const re = new RegExp(`(?<![\\w$.])${escapeRe(name)}(?![\\w$])`, 'g')
  for (const m of text.matchAll(re)) {
    const before = text.slice(0, m.index)
    const after = text.slice(m.index + name.length)
    if (/\b(?:const|let|var)\s+$/.test(before)) continue
    const line = before.slice(before.lastIndexOf('\n') + 1)
    if (/(?:!|&&|\|\|)\s*$/.test(before)) return true
    if (/^\s*(?:&&|\|\||\?(?![?.]))/.test(after)) return true
    if (/\b(?:if|while|switch)\s*\([^{]*$/.test(line)) return true
  }
  return false
}
function boolConstProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    for (const m of src.matchAll(BOOL_CONST)) {
      const [, name, value] = m
      if (gates(src, name)) problems.push(`${f}: the boolean constant ${name} (${value}) gates a branch`)
      for (const g of files) {
        if (g === f) continue
        const other = readFile(g)
        const imported = importsOf(other).some((spec) => resolveRel(g, spec, new Set(files)) === f) && new RegExp(`\\b${escapeRe(name)}\\b`).test(other)
        if (imported && gates(other, name)) problems.push(`${f}: the boolean constant ${name} (${value}) gates a branch in ${g}`)
      }
    }
  }
  return problems
}

// ---------- R73: every schema in src/modules that parses a file read from disk is strict at every depth ----------
const DISK_READ = /\b(?:readFileSync|readFile|readUtf8|readRegularFile|tryRead|createReadStream)\s*\(/
const PARSE_CALL = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*(\(\s*\))?\s*\.\s*(?:safeParse|parse|safeParseAsync|parseAsync)\s*\(/g
const LOOSE_FORMS = [
  [/\bz\s*\.\s*object\s*\(/g, 'z.object('],
  [/\bz\s*\.\s*looseObject\s*\(/g, 'z.looseObject('],
  [/\.\s*passthrough\s*\(/g, '.passthrough('],
  [/\.\s*loose\s*\(/g, '.loose('],
  [/\.\s*catchall\s*\(/g, '.catchall('],
  [/\.\s*strip\s*\(/g, '.strip('],
]
function skipString(src, i) {
  const q = src[i]
  let j = i + 1
  while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1
  return j + 1
}
/** The text of one expression from `start` (just after "="), across chained lines, to its end. */
function exprAt(src, start) {
  let depth = 0
  let seen = false
  let i = start
  while (i < src.length) {
    const c = src[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i)
      seen = true
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      i = nl < 0 ? src.length : nl
      continue
    }
    if ('([{'.includes(c)) {
      depth += 1
      seen = true
    } else if (')]}'.includes(c)) {
      depth -= 1
      if (depth < 0) return src.slice(start, i)
    } else if (c === ';' && depth === 0) return src.slice(start, i)
    else if (c === '\n' && depth === 0 && seen) {
      const before = src.slice(start, i).trimEnd()
      const next = /^\s*(\S)/.exec(src.slice(i + 1))?.[1] ?? ''
      if (!/[=>(,?:.+\-*&|]$/.test(before) && !['.', '?', ':', ')', ']', '}'].includes(next)) return src.slice(start, i)
    } else if (!/\s/.test(c)) seen = true
    i += 1
  }
  return src.slice(start)
}
/** The definition text of a const in a file, or null. */
function defText(src, name) {
  const m = new RegExp(`(?:^|\\n)[ \\t]*(?:export\\s+)?(?:const|let|var)\\s+${escapeRe(name)}\\b[^=\\n]*=(?!=)`).exec(src)
  return m === null ? null : exprAt(src, m.index + m[0].length)
}
/** Where a name used in `file` is defined: this file, a relative import, or null (a library or a global). */
function definedIn(file, name, readFile, fileSet) {
  const src = readFile(file)
  if (defText(src, name) !== null) return file
  for (const m of src.matchAll(/\bimport\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].split(',').map((p) => p.trim().replace(/^type\s+/, '').split(/\s+as\s+/))
    const hit = names.find((n) => (n[1] ?? n[0]).trim() === name)
    if (hit === undefined) continue
    const r = resolveRel(file, m[2], fileSet)
    return r === null ? null : { file: r, name: hit[0].trim() }
  }
  return null
}
/** The non-strict builders a schema's definition reaches, following consts in src/modules (contracts are R23's). */
function looseIn(file, name, readFile, fileSet, seen = new Set()) {
  const key = `${file}#${name}`
  if (seen.has(key)) return []
  seen.add(key)
  const text = defText(readFile(file), name)
  if (text === null) return []
  const found = []
  for (const [re, label] of LOOSE_FORMS) if (new RegExp(re.source).test(text)) found.push({ form: label, in: name })
  for (const id of new Set([...text.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\b/g)].map((x) => x[1]))) {
    if (id === name || id === 'z') continue
    const where = definedIn(file, id, readFile, fileSet)
    if (where === file) found.push(...looseIn(file, id, readFile, fileSet, seen))
    else if (where !== null && where.file.startsWith('src/modules/')) found.push(...looseIn(where.file, where.name, readFile, fileSet, seen))
  }
  return found
}
/** Every schema in src/modules a disk-reading module parses: [{ file, name, reader }]. */
function diskSchemas(files, readFile) {
  const fileSet = new Set(files)
  const out = new Map()
  for (const f of files.filter((x) => x.startsWith('src/modules/'))) {
    const src = readFile(f)
    if (!DISK_READ.test(src)) continue
    for (const m of src.matchAll(PARSE_CALL)) {
      const name = m[1]
      if (name === 'JSON') continue
      const where = definedIn(f, name, readFile, fileSet)
      const at = where === f ? { file: f, name } : where
      if (at === null || !at.file.startsWith('src/modules/')) continue
      const text = defText(readFile(at.file), at.name)
      if (text === null || !/\bz\s*[.\n]/.test(text)) continue
      const key = `${at.file}#${at.name}`
      if (!out.has(key)) out.set(key, { file: at.file, name: at.name, key, reader: f })
    }
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key))
}
function diskSchemaProblems(files, readFile) {
  const fileSet = new Set(files)
  const problems = []
  for (const s of diskSchemas(files, readFile)) {
    const forms = looseIn(s.file, s.name, readFile, fileSet)
    for (const x of forms) problems.push(`${s.file}: ${s.name} parses a file read from disk and is not strict (${x.form} in ${x.in})`)
  }
  return [...new Set(problems)]
}

// ---------- zod introspection (zod 4) ----------
const isZod = (v) => v !== null && typeof v === 'object' && '_zod' in v && typeof v.safeParse === 'function'
const zdef = (s) => s._zod.def
/** Every node of a schema with its path: [{ node, path }], each schema object once. */
function nodes(s, p = '', out = [], seen = new Set(), depth = 0) {
  if (depth > 30 || seen.has(s)) return out
  seen.add(s)
  out.push({ node: s, path: p })
  const d = zdef(s)
  const go = (x, q) => isZod(x) && nodes(x, q, out, seen, depth + 1)
  switch (d.type) {
    case 'object':
      for (const [k, v] of Object.entries(d.shape)) go(v, `${p}.${k}`)
      if (d.catchall) go(d.catchall, `${p}.*`)
      break
    case 'array':
      go(d.element, `${p}[]`)
      break
    case 'tuple':
      d.items.forEach((it, i) => go(it, `${p}[${String(i)}]`))
      if (d.rest) go(d.rest, `${p}[...]`)
      break
    case 'record':
      go(d.valueType, `${p}{}`)
      break
    case 'map':
      go(d.valueType, `${p}{}`)
      break
    case 'union':
      d.options.forEach((o, i) => go(o, `${p}|${String(i)}`))
      break
    case 'intersection':
      go(d.left, p)
      go(d.right, p)
      break
    case 'pipe':
      go(d.in, p)
      go(d.out, p)
      break
    case 'lazy':
      go(d.getter(), p)
      break
    default:
      if (d.innerType) go(d.innerType, p)
  }
  return out
}
function looseObjectPaths(schema) {
  return nodes(schema)
    .filter(({ node }) => zdef(node).type === 'object' && zdef(node).catchall?._zod?.def?.type !== 'never')
    .map(({ path: p }) => p || '(top)')
}

// ---------- R83: a recording's stamp agrees with its job on every part the job sets ----------
const readJson = (abs) => JSON.parse(fs.readFileSync(abs, 'utf8'))
/** Job-shaped objects in the __fixtures__ folder beside a __recordings__ folder: [{ name, job }]. */
function jobsBeside(recDirAbs) {
  const dir = path.join(path.dirname(recDirAbs), '__fixtures__')
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'planted-mismatch.json').sort()) {
    const json = readJson(path.join(dir, f))
    const entries = Array.isArray(json) ? json.map((j, i) => [String(i), j]) : typeof json === 'object' && json !== null ? Object.entries(json) : []
    for (const [name, j] of entries) {
      if (j && typeof j === 'object' && typeof j.modelId === 'string' && typeof j.promptHash === 'string' && j.inputs && typeof j.inputs === 'object') out.push({ name, job: j })
    }
  }
  return out
}
/** That folder's planted-mismatch list: `../__fixtures__/planted-mismatch.json`, a list of recording file names. */
function plantedMismatchList(recDirAbs) {
  const file = path.join(path.dirname(recDirAbs), '__fixtures__', 'planted-mismatch.json')
  return fs.existsSync(file) ? readJson(file) : []
}
function recordingStampProblems(recDirRel, { stampSchema, partsFromJob, inputHashOf, planted = plantedMismatchList(path.join(ROOT, recDirRel)) }) {
  const recDirAbs = path.join(ROOT, recDirRel)
  const jobs = jobsBeside(recDirAbs)
  const problems = []
  const matched = []
  const listRel = `${path.posix.dirname(recDirRel)}/__fixtures__/planted-mismatch.json`
  if (!Array.isArray(planted) || !planted.every((n) => typeof n === 'string')) return { problems: [`${listRel}: is not a list of file names`], matched }
  const seenListed = new Set()
  for (const name of fs.readdirSync(recDirAbs).filter((n) => n.endsWith('.json')).sort()) {
    const rel = `${recDirRel}/${name}`
    const rec = readJson(path.join(recDirAbs, name))
    if (rec === null || typeof rec !== 'object' || !stampSchema.safeParse(rec.stamp).success) continue
    const hit = jobs.find(({ job }) => job.modelId === rec.modelId && job.promptHash === rec.promptHash && inputHashOf(job.inputs) === rec.inputHash)
    if (hit === undefined) continue
    matched.push(rel)
    const expected = (p) => (p === 'inputHash' ? inputHashOf(hit.job.inputs) : hit.job[p])
    const wrong = partsFromJob.filter((p) => rec.stamp[p] !== expected(p))
    const listed = planted.includes(name)
    if (listed) seenListed.add(name)
    if (wrong.length > 0 && !listed) problems.push(`${rel}: its stamp differs from job ${hit.name} at ${wrong.join(', ')}`)
    if (wrong.length === 0 && listed) problems.push(`${rel}: is on the planted-mismatch list but agrees with job ${hit.name}; remove it from the list`)
  }
  for (const n of planted) if (!seenListed.has(n)) problems.push(`${listRel}: names ${n}, which is no recording here that matches a job`)
  return { problems, matched }
}

// ---------- R84: two provenance fields for one fact agree ----------
function engineProvenanceProblems(rel, rec) {
  const a = rec?.sourceEngine
  const b = rec?.result?.engine
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return null
  return a.name === b.name && a.version === b.version ? [] : [`${rel}: sourceEngine ${String(a.name)}@${String(a.version)} differs from result.engine ${String(b.name)}@${String(b.version)}`]
}

// ---------- R88: no thrown or logged message prints a setting's value ----------
const MESSAGE_CONTEXT = /(?:\bError\s*\(|\bthrow\b|\breason\s*:|\b(?:info|warn|error|debug|log|sink|flag|refuse|refused|logOnce|fail)\s*\()[^;{}]*$/
/** The file cut at each top-level declaration, so a name in one function never taints the same name in another. */
const topLevelChunks = (src) => src.split(/\n(?=(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\b)/)
function settingValueVars(src, seed = { objs: new Set(), tainted: new Set() }) {
  const objs = new Set([...seed.objs, ...settingsObjects(src)])
  const tainted = new Set(seed.tainted)
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*readSettings\s*\(/g)) {
    for (const part of m[1].split(',')) {
      const local = (part.split(':')[1] ?? part.split(':')[0]).split('=')[0].trim()
      if (local !== '') tainted.add(local)
    }
  }
  const assigns = [...src.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?::\s*[^=\n]+?)?\s*=(?![=>])\s*([^\n;]+)/g)]
  const reads = (rhs) =>
    /\breadSettings\s*\([^()]*\)\s*(?:\?\.|\.|\[)/.test(rhs) ||
    [...objs].some((o) => new RegExp(`(?<![\\w$.])${escapeRe(o)}\\s*(?:\\?\\.|\\.|\\[)`).test(rhs)) ||
    [...tainted].some((t) => new RegExp(`(?<![\\w$.])${escapeRe(t)}(?![\\w$])`).test(rhs))
  for (let round = 0; round < 10; round += 1) {
    const before = tainted.size
    for (const [, lhs, rhs] of assigns) if (!objs.has(lhs) && !tainted.has(lhs) && reads(rhs)) tainted.add(lhs)
    if (tainted.size === before) break
  }
  return { objs, tainted }
}
function settingMessageProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    if (!/\breadSettings\b/.test(src)) continue
    const chunks = topLevelChunks(src)
    // A top-level const that reads a setting is seen in every chunk; anything else stays inside its own chunk.
    const seed = { objs: new Set(), tainted: new Set() }
    for (let round = 0; round < 10; round += 1) {
      const before = seed.objs.size + seed.tainted.size
      for (const c of chunks) {
        const top = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(c)?.[1]
        if (top === undefined) continue
        const v = settingValueVars(c, seed)
        if (v.objs.has(top)) seed.objs.add(top)
        if (v.tainted.has(top)) seed.tainted.add(top)
      }
      if (seed.objs.size + seed.tainted.size === before) break
    }
    for (const chunk of chunks) {
      const { objs, tainted } = settingValueVars(chunk, seed)
      for (const m of chunk.matchAll(/`(?:[^`\\]|\\.)*`/g)) {
        if (!MESSAGE_CONTEXT.test(chunk.slice(Math.max(0, m.index - 160), m.index))) continue
        for (const e of m[0].matchAll(/\$\{([^}]*)\}/g)) {
          const ids = [...e[1].matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)/g)].map((x) => x[1])
          if (/\breadSettings\s*\(/.test(e[1]) || ids.some((id) => tainted.has(id) || objs.has(id))) {
            problems.push(`${f}: a thrown or logged message interpolates \${${e[1].trim()}}, a value read from a setting (name the setting, never its value)`)
          }
        }
      }
    }
  }
  return [...new Set(problems)]
}
const PLANTED_VALUE = 'planted-value-not-a-key-Test'
async function outcomeOf(fn) {
  try {
    const value = await fn()
    return { threw: false, value }
  } catch (e) {
    return { threw: true, message: String(e?.message ?? e) }
  }
}
function refusalProblems(file, name, o) {
  if (!o.threw) return [`${file}: setting ${name} to a made-up value is not refused`]
  const problems = []
  if (o.message.includes(PLANTED_VALUE)) problems.push(`${file}: setting ${name} to a made-up value prints the value in the refusal`)
  if (!o.message.includes(name)) problems.push(`${file}: the refusal for a made-up ${name} does not name the setting`)
  return problems
}
// One driver per engine setting in env.ts's schema: it builds the adapter that reads the setting with the planted value.
const R88_DRIVERS = {
  OCR_ENGINE: {
    file: 'src/modules/ocr/index.ts',
    run: async (env) => (await load('src/modules/ocr/index.ts')).createReadingAdapter({ env }),
  },
  STORAGE_FILES_ENGINE: {
    file: 'src/modules/storage/files/index.ts',
    run: async (env) => (await load('src/modules/storage/files/index.ts')).createFileStore({ root: tmpDir('files'), env }),
  },
  STORAGE_DRIVE_ENGINE: {
    file: 'src/modules/storage/drive/index.ts',
    run: async (env) => (await load('src/modules/storage/drive/index.ts')).createDriveStandIn({ root: tmpDir('drive'), env }),
  },
  AUTH_ENGINE: {
    file: 'src/modules/auth/index.ts',
    run: async (env) => (await load('src/modules/auth/index.ts')).createAuth({ env }),
  },
}

// ---------- R101: prototype names as keys, and repeated or reserved keys in JSON read from disk ----------
const PROTOTYPE_NAMES = ['__proto__', 'constructor', 'prototype']
async function exportedZod(files, loader) {
  const out = []
  for (const f of files) {
    const mod = await loader(f)
    for (const name of Object.keys(mod).sort()) if (isZod(mod[name])) out.push({ file: f, name, schema: mod[name] })
  }
  return out
}
/** Every z.record node the exports reach, attributed to the nearest export (then file order), with the keys it takes. */
function recordKeyProblems(exportsList, files, readFile) {
  const best = new Map()
  for (const { file, name, schema } of exportsList) {
    for (const { node, path: p } of nodes(schema)) {
      if (zdef(node).type !== 'record') continue
      const depth = (p.match(/[.[{|]/g) ?? []).length
      const cur = best.get(node)
      const ownsRecord = /\bz\s*\.\s*record\s*\(/.test(readFile(file))
      const rank = [ownsRecord ? 0 : 1, depth]
      if (cur === undefined || rank[0] < cur.rank[0] || (rank[0] === cur.rank[0] && rank[1] < cur.rank[1])) best.set(node, { file, name, path: p, rank })
    }
  }
  const problems = []
  const perFile = new Map()
  for (const [node, at] of best) {
    perFile.set(at.file, (perFile.get(at.file) ?? 0) + 1)
    const taken = PROTOTYPE_NAMES.filter((k) => zdef(node).keyType.safeParse(k).success)
    if (taken.length > 0) problems.push(`${at.file}: the z.record at ${at.name}${at.path} takes the prototype names ${taken.map((k) => JSON.stringify(k)).join(', ')} as keys`)
  }
  for (const f of files) {
    const calls = (readFile(f).match(/\bz\s*\.\s*record\s*\(/g) ?? []).length
    const reached = perFile.get(f) ?? 0
    if (calls > reached) problems.push(`${f}: holds ${String(calls)} z.record calls and its exports reach ${String(reached)} (export the schema, so R101 can check its keys)`)
  }
  return problems.sort()
}
function jsonScanProblems(files, readFile) {
  const problems = []
  for (const f of files) {
    const src = readFile(f)
    if (!/\bJSON\s*\.\s*parse\s*\(/.test(src)) continue
    if (!/\brepeatedKeys\s*\(/.test(src)) problems.push(`${f}: parses JSON with no repeatedKeys( scan for a repeated key`)
    if (!/\breservedKeys\s*\(/.test(src)) problems.push(`${f}: parses JSON with no reservedKeys( scan for a prototype-name key`)
  }
  return problems
}

// ---------- reader drivers (R73-run, R84-run, R101-run): a file on disk, then the module's public reader ----------
const OCR_REC_DIR = 'src/modules/ocr/recorded/__recordings__'
const ocrRecordingName = () => fs.readdirSync(path.join(ROOT, OCR_REC_DIR)).filter((n) => n.endsWith('.json')).sort()[0]
const ocrRecordingText = () => read(`${OCR_REC_DIR}/${ocrRecordingName()}`)
const DRIVE_COMPANY = 'Maple Ridge Consulting Inc. (Test) (0aad6c0c)'
const DRIVE_INDEX = `{\n  "files": [\n    {\n      "drive_file_id": "drv-0001-test",\n      "path": "${DRIVE_COMPANY}/2025/statement (Test).pdf",\n      "mime_type": "application/pdf"\n    }\n  ]\n}\n`
const BANK_FIXTURE = 'src/modules/gaps/bank/__fixtures__/valid'

/** Each reader: `ok(text)` writes the text where the reader looks and resolves true when the reader reads it. */
const READERS = {
  'src/modules/ocr/recorded/index.ts': {
    clean: ocrRecordingText,
    ok: async (text) => {
      const dir = tmpDir('ocr')
      const name = ocrRecordingName()
      fs.writeFileSync(path.join(dir, name), text)
      const { createRecordedEngine } = await load('src/modules/ocr/recorded/index.ts')
      const o = await outcomeOf(() => createRecordedEngine({ folder: dir }).read({ fingerprint: name.replace(/\.json$/, '') }))
      return !o.threw
    },
    // A key in one nested object of this reader's file, and the key written twice there.
    nestedAt: '"sourceEngine": {',
    repeat: ['"recordedAt": ', '"recordedAt": "2026-10-01T16:00:00.000Z",\n  "recordedAt": '],
  },
  'src/modules/storage/drive/index.ts': {
    clean: () => DRIVE_INDEX,
    ok: async (text) => {
      const root = tmpDir('drive')
      fs.mkdirSync(path.join(root, DRIVE_COMPANY, '2025'), { recursive: true })
      fs.writeFileSync(path.join(root, DRIVE_COMPANY, '2025', 'statement (Test).pdf'), '%PDF-1.4 made up (Test)\n')
      fs.writeFileSync(path.join(root, 'index.json'), text)
      const { createDriveStandIn } = await load('src/modules/storage/drive/index.ts')
      const o = await outcomeOf(() => createDriveStandIn({ root, env: {} }).getFile('drv-0001-test'))
      return !o.threw
    },
    nestedAt: '"drive_file_id": "drv-0001-test",',
    repeat: ['"mime_type": ', '"mime_type": "text/plain",\n      "mime_type": '],
  },
  'src/modules/gaps/bank/index.ts': {
    clean: () => read(`${BANK_FIXTURE}/${bankFirstFile()}`),
    ok: async (text) => {
      const dir = tmpDir('bank')
      fs.cpSync(path.join(ROOT, BANK_FIXTURE), dir, { recursive: true })
      fs.writeFileSync(path.join(dir, bankFirstFile()), text)
      const { loadBank } = await load('src/modules/gaps/bank/index.ts')
      const { loadFactCatalogue } = await load('src/contracts/facts.ts')
      const loaded = loadFactCatalogue(JSON.parse(read('data/facts/catalogue.json')))
      if (!loaded.ok) throw new Error('the fact catalogue does not load')
      return loadBank(dir, loaded.catalogue).ok === true
    },
    nestedAt: '"items": [\n    {',
    repeat: ['"retired": ', '"retired": true,\n      "retired": '],
  },
}
const bankFirstFile = () => fs.readdirSync(path.join(ROOT, BANK_FIXTURE)).filter((n) => n.endsWith('.json') && n !== '_schema.json').sort()[0]
/** The clean text with `insert` added just inside the first "{" (top) or just after `nestedAt` (nested). */
function withKey(text, insert, where, nestedAt) {
  if (where === 'top') return text.replace('{', `{\n  ${insert},`)
  if (!text.includes(nestedAt)) throw new Error(`the driver's nested anchor ${JSON.stringify(nestedAt)} is not in the clean text`)
  return text.replace(nestedAt, `${nestedAt}\n      ${insert},`)
}
async function strayKeyRunProblems(file, r) {
  if (!(await r.ok(r.clean()))) return [`${file}: the driver's clean file is not read; fix the driver`]
  const problems = []
  for (const where of ['top', 'nested']) {
    if (await r.ok(withKey(r.clean(), '"strayKeyTest": "x (Test)"', where, r.nestedAt))) problems.push(`${file}: a file with a stray key at the ${where} level is read, not refused`)
  }
  return problems
}
async function jsonKeyRunProblems(file, r) {
  if (!(await r.ok(r.clean()))) return [`${file}: the driver's clean file is not read; fix the driver`]
  const problems = []
  const [from, to] = r.repeat
  if (!r.clean().includes(from)) return [`${file}: the driver's repeat anchor ${JSON.stringify(from)} is not in the clean text; fix the driver`]
  if (await r.ok(r.clean().replace(from, to))) problems.push(`${file}: a JSON file with a key written twice in one object is read, not refused`)
  if (await r.ok(withKey(r.clean(), '"__proto__": {}', 'top', r.nestedAt))) problems.push(`${file}: a JSON file with the key "__proto__" at the top level is read, not refused`)
  if (await r.ok(withKey(r.clean(), '"constructor": "x (Test)"', 'nested', r.nestedAt))) problems.push(`${file}: a JSON file with the key "constructor" in a nested object is read, not refused`)
  return problems
}

// ======================================================================================================================
const SRC = () => productCode(['src'])
const SRC_TW = () => productCode(['src', 'testworld'])
let envMod
const readSettingsFn = async () => (envMod ??= await load(ENV_FILE)).readSettings

describe('SC5 KNOWN: every exemption is exact, owned and alive (A407)', () => {
  const PLANT_SHAPE = { statuses: PINNED_STATUSES, fileOk: walkedFileOk }
  test('ARC-15 KNOWN shape rule: a planted entry with a pattern, two files, a done owner, SC5 as owner or a non-card owner is caught; the clean entry is not', () => {
    const clean = { rule: 'R88', file: 'src/modules/ocr/index.ts', problems: ['src/modules/ocr/index.ts: planted (Test)'], owner: 'FX13', why: 'clean control (Test)' }
    const planted = [
      clean,
      { rule: 'R88', match: /^src\/modules\/.*/, file: 'src/modules/ocr/index.ts', problems: ['src/modules/ocr/index.ts: planted two (Test)'], owner: 'FX13', why: 'x' },
      { rule: 'R88', file: 'src/modules/ocr/index.ts', problems: [/^src\/modules\/ocr\/index\.ts: /], owner: 'FX13', why: 'x' },
      { rule: 'R73', file: 'src/modules/storage/drive/index.ts', problems: ['src/modules/storage/files/index.ts: planted (Test)'], owner: 'FX7', why: 'x' },
      { rule: 'R73', file: 'src/modules/storage/(drive|files)/index.ts', problems: ['planted no file (Test)'], owner: 'FX7', why: 'x' },
      { rule: 'R71', file: 'src/core/env.ts', problems: ['src/core/env.ts: planted done owner (Test)'], owner: 'FX2', why: 'x' },
      { rule: 'R72', file: 'src/core/env.ts', problems: ['src/core/env.ts: planted self owner (Test)'], owner: 'SC5', why: 'x' },
      { rule: 'R84-run', file: 'src/modules/ocr/recorded/index.ts', problems: ['src/modules/ocr/recorded/index.ts: planted prose owner (Test)'], owner: 'FX11 spec job', why: 'x' },
      { rule: 'R99', file: 'src/modules/no-such-file (Test).ts', problems: [], owner: 'FX16' },
      clean,
    ]
    expect(knownShapeProblems(planted, PLANT_SHAPE)).toEqual([
      'KNOWN[1] R88 src/modules/ocr/index.ts: the key match is not one of rule, file, problems, owner, why',
      'KNOWN[2] R88 src/modules/ocr/index.ts: a problem that is not a literal string ([object RegExp])',
      'KNOWN[3] R73 src/modules/storage/drive/index.ts: the problem names another file (src/modules/storage/files/index.ts)',
      'KNOWN[4] R73 src/modules/storage/(drive|files)/index.ts: the file is not one plain path',
      'KNOWN[4] R73 src/modules/storage/(drive|files)/index.ts: the problem names no file',
      'KNOWN[5] R71 src/core/env.ts: the owner FX2 is done, so it can never fix the defect',
      'KNOWN[6] R72 src/core/env.ts: SC5 cannot own a defect it lands with',
      'KNOWN[7] R84-run src/modules/ocr/recorded/index.ts: the owner "FX11 spec job" is not a card in plan/slices.json',
      'KNOWN[8] R99 src/modules/no-such-file (Test).ts: the rule is not one whose test reads KNOWN',
      'KNOWN[8] R99 src/modules/no-such-file (Test).ts: the file does not exist',
      'KNOWN[8] R99 src/modules/no-such-file (Test).ts: problems is not a non-empty list',
      'KNOWN[8] R99 src/modules/no-such-file (Test).ts: no why',
      'KNOWN[9] R88 src/modules/ocr/index.ts: the problem "src/modules/ocr/index.ts: planted (Test)" is listed twice',
    ])
    expect(knownShapeProblems([clean], PLANT_SHAPE)).toEqual([])
  })
  test('ARC-15 KNOWN rule: an entry cannot grow (a new problem in its file fails) and a string the rule no longer prints is stale', () => {
    const known = [{ rule: 'R88', file: 'src/modules/ocr/index.ts', problems: ['src/modules/ocr/index.ts: a (Test)', 'src/modules/ocr/index.ts: gone (Test)'], owner: 'FX13', why: 'x' }]
    expect(onlyKnown('R88', ['src/modules/ocr/index.ts: a (Test)', 'src/modules/ocr/index.ts: new (Test)'], known)).toEqual([
      'src/modules/ocr/index.ts: new (Test)',
      'stale KNOWN entry R88 src/modules/ocr/index.ts (owner FX13): "src/modules/ocr/index.ts: gone (Test)" no longer fails; remove it',
    ])
    expect(onlyKnown('R88', ['src/modules/ocr/index.ts: a (Test)', 'src/modules/ocr/index.ts: gone (Test)'], known)).toEqual([])
  })
  test('ARC-15 KNOWN file rule: the real-data check reads the walked file list in exact case', () => {
    expect(walkedFileOk('src/core/env.ts')).toBe(true)
    expect(walkedFileOk('src/core/Env.ts')).toBe(false)
    expect(walkedFileOk('src/core')).toBe(false)
  })
  test('ARC-15 KNOWN shape: every entry in known.json has one rule, one file, exact strings and an open owner card in plan/slices.json', () => {
    expect(KNOWN.length).toBeGreaterThan(0)
    expect(knownShapeProblems(KNOWN, { statuses: cardStatuses(), fileOk: walkedFileOk })).toEqual([])
  })
  test('ARC-15 KNOWN owners named by the card are open cards in plan/slices.json (FX7, FX11, FX13, FX16)', () => {
    const statuses = cardStatuses()
    for (const owner of ['FX7', 'FX11', 'FX13', 'FX16']) {
      expect(statuses.has(owner), owner).toBe(true)
      expect(CLOSED.has(statuses.get(owner)), owner).toBe(false)
    }
    expect([...new Set(KNOWN.map((k) => k.owner))].sort()).toEqual(['FX11', 'FX13', 'FX16', 'FX7'])
  })
})

describe('R71 settings are read only through src/core/env.ts (ARC-20, SEC-11)', () => {
  test('SEC-11 R71 plant: `options.env ?? process.env` in a module is caught, and so is every other process.env form', () => {
    const files = ['src/modules/qbo/index.ts']
    expect(processEnvProblems(files, () => fix('planted-r71-env.ts.txt'), new Set())).toEqual([
      'src/modules/qbo/index.ts: reads process.env outside src/core/env.ts (read settings through readSettings)',
    ])
    for (const form of ["process['env'].OCR_ENGINE", 'const { env } = process', "import { env } from 'node:process'", 'import.meta.env.MODE', 'process?.env']) {
      expect(processEnvProblems(files, () => `export const x = () => ${form}\n`, new Set()), form).toHaveLength(1)
    }
    expect(processEnvProblems(files, () => 'export const x = (options) => readSettings(options.env)\n', new Set())).toEqual([])
  })
  test('SEC-11 R71 the scan sees env.ts\'s own read when env.ts is not exempt (the matcher is live on a real file)', () => {
    expect(processEnvProblems([ENV_FILE], read, new Set())).toEqual([`${ENV_FILE}: reads process.env outside src/core/env.ts (read settings through readSettings)`])
  })
  test('SEC-11 R71 no src file outside env.ts and the test harness reads process.env', () => {
    const files = SRC()
    expect(scanProblems('R71', files, 'src/modules/ocr/index.ts')).toEqual([])
    const harness = harnessClosure(HARNESS, read, new Set(files))
    expect(onlyKnown('R71', processEnvProblems(files, read, new Set([ENV_FILE, ...harness])))).toEqual([])
  })
  test('SEC-11 R71-harness plant: a product module importing the test database is caught; the harness itself and tests are not', () => {
    const files = ['src/modules/planted/index.ts', 'src/core/db/index.ts', 'src/core/db/target.ts']
    const text = {
      'src/modules/planted/index.ts': "import { createTemplate } from '../../core/db'\nexport const t = createTemplate\n",
      'src/core/db/index.ts': "import { testDbTarget } from './target'\n",
      'src/core/db/target.ts': 'export const testDbTarget = () => null\n',
    }
    const harness = harnessClosure(['src/core/db/index.ts'], (f) => text[f], new Set(files))
    expect([...harness].sort()).toEqual(['src/core/db/index.ts', 'src/core/db/target.ts'])
    expect(harnessImportProblems(files, (f) => text[f], harness)).toEqual([
      'src/modules/planted/index.ts: imports the test harness file src/core/db/index.ts (product code never reaches the harness)',
    ])
  })
  test('SEC-11 R71-harness the harness list is real and no product file imports a harness file', () => {
    const files = SRC()
    expect(HARNESS.length).toBeGreaterThan(0)
    for (const h of HARNESS) expect(walkedFileOk(h), h).toBe(true)
    const harness = harnessClosure(HARNESS, read, new Set(files))
    expect(harness.has('src/core/db/target.ts')).toBe(true)
    expect(onlyKnown('R71-harness', harnessImportProblems(files, read, harness))).toEqual([])
  })
  test('ARC-20 R71-names the probe asks readSettings itself: every key env.ts spells out is a key, and a misspelt name is not', async () => {
    const readSettings = await readSettingsFn()
    const keys = envSchemaKeys(read(ENV_FILE))
    expect(keys).toEqual(expect.arrayContaining(['NODE_ENV', 'AUTH_ENGINE', 'AI_EXCHANGE_DIR', 'OCR_ENGINE', 'STORAGE_FILES_ENGINE', 'STORAGE_DRIVE_ENGINE']))
    for (const k of keys) expect(isSettingKey(readSettings, k), k).toBe(true)
    for (const k of ['AI_EXCHANGE_FOLDER', 'STORAGE_DRIVE_ENGIN', 'OCR_ENGIN', 'QBO_ENGINE_TEST']) expect(isSettingKey(readSettings, k), k).toBe(false)
  })
  test('ARC-20 R71-names plant: a setting read by property, by literal name, by destructuring or listed in *_SETTING_NAMES that env.ts lacks is caught', async () => {
    const readSettings = await readSettingsFn()
    const isKey = (n) => isSettingKey(readSettings, n)
    const f = 'src/modules/planted/index.ts'
    expect(settingNameProblems([f], () => fix('planted-r71-names.ts.txt'), isKey, [])).toEqual([
      `${f}: reads the setting AI_EXCHANGE_FOLDER, which is not a key of src/core/env.ts's schema`,
      `${f}: reads the setting STORAGE_DRIVE_ENGIN, which is not a key of src/core/env.ts's schema`,
      `${f}: reads the setting OCR_ENGIN, which is not a key of src/core/env.ts's schema`,
      `${f}: reads the setting QBO_ENGINE, which is not a key of src/core/env.ts's schema`,
    ])
    expect(settingNameProblems([f], () => fix('clean-r71-names.ts.txt'), isKey, [])).toEqual([])
    const mod = { AI_SETTING_NAMES: ['AI_EXCHANGE_FOLDER'] }
    expect(settingNamesExportProblems(f, mod, fix('planted-r71-names.ts.txt'), isKey)).toEqual([
      `${f}#AI_SETTING_NAMES: names the setting AI_EXCHANGE_FOLDER, which is not a key of src/core/env.ts's schema`,
    ])
    expect(settingNamesExportProblems(f, { AI_SETTING_NAMES: [] }, fix('planted-r71-names.ts.txt'), isKey)).toEqual([`${f}#AI_SETTING_NAMES: is not a non-empty list of setting names`])
  })
  test('ARC-20 R71-names plant: a NOT_SETTINGS row whose name is gone is stale', async () => {
    const readSettings = await readSettingsFn()
    const rows = [{ file: 'src/core/planted.ts', names: ['O_NONBLOCK'], why: 'planted (Test)' }]
    expect(settingNameProblems(['src/core/planted.ts'], () => 'export const x = 1\n', (n) => isSettingKey(readSettings, n), rows)).toEqual([
      'NOT_SETTINGS src/core/planted.ts: O_NONBLOCK is no longer there; remove it',
    ])
  })
  test('ARC-20 R71-names every setting a src module reads or lists in *_SETTING_NAMES is a key of env.ts\'s schema', async () => {
    const readSettings = await readSettingsFn()
    const isKey = (n) => isSettingKey(readSettings, n)
    const files = SRC()
    const harness = harnessClosure(HARNESS, read, new Set(files))
    const scanned = files.filter((f) => !harness.has(f) && f !== ENV_FILE)
    const readers = scanned.filter((f) => settingReads(read(f)).length > 0)
    expect(scanProblems('R71-names', readers, 'src/modules/ocr/index.ts')).toEqual([])
    expect(readers).toEqual(expect.arrayContaining(['src/modules/storage/files/index.ts', 'src/modules/auth/index.ts', 'src/modules/ai/runner/runner.ts']))
    const problems = settingNameProblems(scanned, read, isKey)
    const exporters = scanned.filter((f) => new RegExp(SETTING_NAMES_EXPORT.source).test(read(f)))
    expect(scanProblems('R71-names exports', exporters, 'src/modules/ai/runner/runner.ts')).toEqual([])
    for (const f of exporters) problems.push(...settingNamesExportProblems(f, await load(f), read(f), isKey))
    expect(onlyKnown('R71-names', problems)).toEqual([])
  })
})

describe('R72 no boolean literal constant gates a branch in src/modules or src/core (ARC-20)', () => {
  test('ARC-20 R72 plant: a GO_LIVE_ON constant that hides the live branch is caught; state flags and value constants are not', () => {
    const f = 'src/modules/qbo/index.ts'
    expect(boolConstProblems([f], () => fix('planted-r72-golive.ts.txt'))).toEqual([`${f}: the boolean constant GO_LIVE_ON (false) gates a branch`])
    expect(boolConstProblems([f], () => fix('clean-r72-flags.ts.txt'))).toEqual([])
  })
  test('ARC-20 R72 plant: every gate form is caught (annotated, ternary, &&, while, and a constant exported to another file)', () => {
    const f = 'src/core/planted.ts'
    const forms = [
      'const LIVE: boolean = true\nexport const pick = () => (LIVE ? 1 : 2)\n',
      'const LIVE = true as const\nexport const go = (x) => LIVE && x\n',
      'const OFF = (false)\nexport function f() { while (OFF) { return 1 } return 0 }\n',
      'const ON = !0\nexport function f(x) { if (x === 1 || ON) return 1; return 0 }\n',
    ]
    for (const text of forms) expect(boolConstProblems([f], () => text), text).toHaveLength(1)
    const files = ['src/core/flags.ts', 'src/modules/qbo/index.ts']
    const text = {
      'src/core/flags.ts': 'export const GO_LIVE_ON = false\n',
      'src/modules/qbo/index.ts': "import { GO_LIVE_ON } from '../../core/flags'\nexport const pick = () => { if (GO_LIVE_ON) return 'live'; return 'stand-in' }\n",
    }
    expect(boolConstProblems(files, (x) => text[x])).toEqual(['src/core/flags.ts: the boolean constant GO_LIVE_ON (false) gates a branch in src/modules/qbo/index.ts'])
  })
  test('ARC-20 R72 no boolean literal constant gates a branch in src/modules or src/core', () => {
    const files = productCode(['src/modules', 'src/core'])
    expect(scanProblems('R72', files, 'src/modules/ocr/index.ts')).toEqual([])
    expect(onlyKnown('R72', boolConstProblems(files, read))).toEqual([])
  })
})

describe('R73 every schema in src/modules that parses a file read from disk is strict at every depth (R23 extended; ARC-15)', () => {
  test('ARC-15 R73 plant: a recording schema built with z.object is caught; the strict twin with a chained refine is not', () => {
    const f = 'src/modules/ocr/recorded/index.ts'
    expect(diskSchemaProblems([f], () => fix('planted-r73-recording.ts.txt'))).toEqual([
      `${f}: recordingSchema parses a file read from disk and is not strict (z.object( in recordingSchema)`,
    ])
    expect(diskSchemas([f], () => fix('clean-r73-recording.ts.txt')).map((s) => s.key)).toEqual([`${f}#recordingSchema`])
    expect(diskSchemaProblems([f], () => fix('clean-r73-recording.ts.txt'))).toEqual([])
  })
  test('ARC-15 R73 plant: a loose helper two files away (an imported schema, a nested const, .passthrough) is caught; a loose schema no reader parses is not', () => {
    const files = ['src/modules/planted/reader.ts', 'src/modules/planted/schemas.ts']
    const text = { 'src/modules/planted/reader.ts': fix('planted-r73-reader.ts.txt'), 'src/modules/planted/schemas.ts': fix('planted-r73-schemas.ts.txt') }
    expect(diskSchemaProblems(files, (x) => text[x])).toEqual([
      'src/modules/planted/schemas.ts: ApprovedListSchema parses a file read from disk and is not strict (.passthrough( in ApprovedListSchema)',
      'src/modules/planted/schemas.ts: ApprovedListSchema parses a file read from disk and is not strict (z.object( in tripleSchema)',
    ])
  })
  test('ARC-15 R73-run plant: a schema strict at the top whose nested object, array item, record value or piped part is loose is caught at each path', async () => {
    const mod = await loadFix('planted-r73-schemas.mjs')
    expect(looseObjectPaths(mod.RecordingSchema)).toEqual(['.sourceEngine', '.pages[]', '.notes{}'])
    expect(looseObjectPaths(mod.CleanRecordingSchema)).toEqual([])
  })
  test('ARC-15 R73 every schema in src/modules that parses a file read from disk is strict at every depth', () => {
    const files = SRC()
    const schemas = diskSchemas(files, read)
    const keys = schemas.map((s) => s.key)
    expect(scanProblems('R73', keys, 'src/modules/ocr/recorded/index.ts#recordingSchema')).toEqual([])
    expect(keys).toEqual(expect.arrayContaining(['src/modules/ai/runner/schemas.ts#RecordingSchema', 'src/modules/storage/drive/index.ts#Index', 'src/modules/gaps/bank/index.ts#itemSchema']))
    expect(onlyKnown('R73', diskSchemaProblems(files, read))).toEqual([])
  })
  test('ARC-15 R73-run every exported disk schema accepts no stray key at any depth, and each unexported one is driven through its reader', async () => {
    const files = SRC()
    const problems = []
    const unexported = []
    for (const s of diskSchemas(files, read)) {
      const mod = await load(s.file)
      if (isZod(mod[s.name])) for (const p of looseObjectPaths(mod[s.name])) problems.push(`${s.file}: ${s.name} accepts a stray key at ${p}`)
      else unexported.push(s)
    }
    expect(unexported.map((s) => s.key)).toEqual(expect.arrayContaining(['src/modules/storage/drive/index.ts#Index']))
    for (const s of unexported) {
      if (READERS[s.file] === undefined) problems.push(`${s.file}: ${s.name} is not exported and has no R73 reader driver`)
      else problems.push(...(await strayKeyRunProblems(s.file, READERS[s.file])))
    }
    expect(onlyKnown('R73-run', problems)).toEqual([])
  }, 30_000)
})

describe('R83 a recording\'s stamp agrees with its job on every part the job sets (AI-10, ARC-22; A426)', () => {
  const contract = async () => {
    const { versionStampSchema } = await load('src/contracts/ai.ts')
    const { STAMP_PARTS_FROM_JOB, STAMP_PARTS_FROM_ANSWER } = await load('src/modules/ai/runner/runner.ts')
    const { inputHashOf } = await load('src/modules/ai/runner/schemas.ts')
    return { stampSchema: versionStampSchema, partsFromJob: STAMP_PARTS_FROM_JOB, partsFromAnswer: STAMP_PARTS_FROM_ANSWER, inputHashOf }
  }
  test('ARC-22 R83 the parts it compares are A04\'s STAMP_PARTS_FROM_JOB, and with STAMP_PARTS_FROM_ANSWER they are exactly the stamp contract\'s keys', async () => {
    const c = await contract()
    const shape = Object.keys(c.stampSchema.shape)
    expect(shape.length).toBeGreaterThan(0)
    expect([...c.partsFromJob, ...c.partsFromAnswer].sort()).toEqual([...shape].sort())
    expect(c.partsFromJob.filter((p) => c.partsFromAnswer.includes(p))).toEqual([])
  })
  test('ARC-22 R83 plant: a copy of finding-c01-good with ocrEngine "other-ocr" is caught naming exactly that part', async () => {
    const c = await contract()
    const { problems, matched } = recordingStampProblems(`${FIX_REL}/r83/__recordings__`, { ...c, planted: [] })
    expect(matched).toEqual([`${FIX_REL}/r83/__recordings__/finding-c01-good.json`])
    expect(problems).toEqual([`${FIX_REL}/r83/__recordings__/finding-c01-good.json: its stamp differs from job good at ocrEngine`])
  })
  test('ARC-22 R83 plant: the planted-mismatch list excuses a listed plant, and a listed name that agrees or is missing is stale', async () => {
    const c = await contract()
    expect(recordingStampProblems(`${FIX_REL}/r83/__recordings__`, { ...c, planted: ['finding-c01-good.json'] }).problems).toEqual([])
    expect(recordingStampProblems('src/modules/ai/runner/__recordings__', { ...c, planted: ['finding-c01-good.json', 'gone (Test).json'] }).problems).toEqual([
      'src/modules/ai/runner/__recordings__/finding-c01-good.json: is on the planted-mismatch list but agrees with job good; remove it from the list',
      'src/modules/ai/runner/__fixtures__/planted-mismatch.json: names gone (Test).json, which is no recording here that matches a job',
    ])
  })
  test('ARC-22 R83 every src/**/__recordings__ recording whose stamp parses and whose key matches a job agrees with that job', async () => {
    const c = await contract()
    const dirs = [...new Set(walk('src').filter((f) => /\/__recordings__\/[^/]+\.json$/.test(f)).map((f) => path.posix.dirname(f)))].sort()
    expect(dirs).toEqual(expect.arrayContaining(['src/modules/ai/runner/__recordings__']))
    const problems = []
    const matched = []
    for (const d of dirs) {
      const r = recordingStampProblems(d, c)
      problems.push(...r.problems)
      matched.push(...r.matched)
    }
    expect(scanProblems('R83', matched, 'src/modules/ai/runner/__recordings__/finding-c01-good.json')).toEqual([])
    expect(onlyKnown('R83', problems)).toEqual([])
  })
})

describe('R84 two provenance fields for one fact agree (AI-10, EV-5; A426)', () => {
  test('ARC-15 R84 plant: a C01 OCR recording with a different result.engine.version is caught; the recording on main agrees', () => {
    const name = ocrRecordingName()
    const rel = `${FIX_REL}/r84/__recordings__/${name}`
    expect(engineProvenanceProblems(rel, readJson(path.join(ROOT, rel)))).toEqual([
      `${rel}: sourceEngine textlayer@pdfjs-dist 6.3.289 differs from result.engine textlayer@pdfjs-dist 6.3.290`,
    ])
    expect(engineProvenanceProblems(`${OCR_REC_DIR}/${name}`, readJson(path.join(ROOT, OCR_REC_DIR, name)))).toEqual([])
  })
  test('ARC-15 R84 every recording file in src carrying both sourceEngine and result.engine agrees on both', () => {
    const files = walk('src').filter((f) => /\/__recordings__\/[^/]+\.json$/.test(f))
    const problems = []
    const checked = []
    for (const f of files) {
      const p = engineProvenanceProblems(f, readJson(path.join(ROOT, f)))
      if (p === null) continue
      checked.push(f)
      problems.push(...p)
    }
    expect(scanProblems('R84', checked, `${OCR_REC_DIR}/${ocrRecordingName()}`)).toEqual([])
    expect(onlyKnown('R84', problems)).toEqual([])
  })
  test('ARC-15 R84-run every reader of a recording with two engine fields refuses one whose fields differ (the plant through the reader)', async () => {
    const readers = SRC().filter((f) => /\bsourceEngine\b/.test(read(f)))
    expect(scanProblems('R84-run', readers, 'src/modules/ocr/recorded/index.ts')).toEqual([])
    const problems = []
    for (const f of readers) {
      const r = READERS[f]
      if (r === undefined) {
        problems.push(`${f}: reads sourceEngine and has no R84 reader driver`)
        continue
      }
      if (!(await r.ok(r.clean()))) {
        problems.push(`${f}: the driver's clean file is not read; fix the driver`)
        continue
      }
      if (await r.ok(fix(`r84/__recordings__/${ocrRecordingName()}`))) problems.push(`${f}: a recording whose result.engine differs from its sourceEngine is read, not refused`)
    }
    expect(onlyKnown('R84-run', problems)).toEqual([])
  })
})

describe('R88 no thrown or logged message in src interpolates the value of a setting (SEC-10, SEC-11; A435)', () => {
  test('SEC-11 R88 plant: a refusal built with ${engine} from a setting, and a log line with the folder setting, are caught; refusals naming the setting are not', () => {
    const f = 'src/modules/ocr/index.ts'
    expect(settingMessageProblems([f], () => fix('planted-r88-refusal.ts.txt'))).toEqual([
      `${f}: a thrown or logged message interpolates \${folder}, a value read from a setting (name the setting, never its value)`,
      `${f}: a thrown or logged message interpolates \${engine}, a value read from a setting (name the setting, never its value)`,
    ])
    expect(settingMessageProblems([f], () => fix('clean-r88-refusal.ts.txt'))).toEqual([])
  })
  test('SEC-11 R88 plant: a value carried through a second variable, a destructured setting and a direct read are caught', () => {
    const f = 'src/modules/planted.ts'
    const forms = [
      "const s = readSettings(env)\nconst raw = s.OCR_ENGINE\nconst engine = raw ?? 'x'\nthrow new Error(`engine ${engine} (Test)`)\n",
      'const { OCR_ENGINE } = readSettings(env)\nthrow new Error(`engine ${OCR_ENGINE} (Test)`)\n',
      'sink(`folder ${readSettings(env).AI_EXCHANGE_DIR} (Test)`)\n',
    ]
    for (const text of forms) expect(settingMessageProblems([f], () => text), text).toHaveLength(1)
  })
  test('SEC-11 R88 plant: a parameter that shares its name with a setting value in another function is not a setting value (storage/safe.ts\'s refuse and readEngine)', () => {
    const f = 'src/modules/storage/safe.ts'
    const text = [
      'export function refuse(what: string, value: string): Error {',
      '  const reason = unsafeReason(value)',
      "  return new Error(`refused: ${what} is not allowed (${reason ?? 'unsafe'})`)",
      '}',
      'export function readEngine(env, name) {',
      '  const settings = readSettings(env)',
      '  const value = settings[name]',
      '  throw new Error(`${name} must be local or live, not ${value}`)',
      '}',
      '',
    ].join('\n')
    expect(settingMessageProblems([f], () => text)).toEqual([
      `${f}: a thrown or logged message interpolates \${value}, a value read from a setting (name the setting, never its value)`,
    ])
  })
  test('SEC-11 R88 no thrown or logged message in src interpolates a value read from a setting', () => {
    const files = SRC()
    const readers = files.filter((f) => /\breadSettings\b/.test(read(f)) && f !== ENV_FILE)
    expect(scanProblems('R88', readers, 'src/modules/storage/safe.ts')).toEqual([])
    expect(onlyKnown('R88', settingMessageProblems(files, read))).toEqual([])
  })
  test('SEC-11 R88-run every engine setting in env.ts set to a made-up value is refused naming the setting, never printing the value', async () => {
    const engines = envSchemaKeys(read(ENV_FILE)).filter((k) => k.endsWith('_ENGINE'))
    expect(engines).toEqual(expect.arrayContaining(['AUTH_ENGINE', 'OCR_ENGINE', 'STORAGE_FILES_ENGINE', 'STORAGE_DRIVE_ENGINE']))
    const problems = []
    for (const name of engines) {
      const d = R88_DRIVERS[name]
      if (d === undefined) {
        problems.push(`${ENV_FILE}: the engine setting ${name} has no R88 driver`)
        continue
      }
      problems.push(...refusalProblems(d.file, name, await outcomeOf(() => d.run({ [name]: PLANTED_VALUE }))))
    }
    expect(onlyKnown('R88-run', problems)).toEqual([])
  })
  test('SEC-11 R88-run plant: a refusal that prints the value, one that names nothing and no refusal are each caught', () => {
    const f = 'src/modules/planted.ts'
    expect(refusalProblems(f, 'OCR_ENGINE', { threw: true, message: `reading engine "${PLANTED_VALUE}" is not available yet` })).toEqual([
      `${f}: setting OCR_ENGINE to a made-up value prints the value in the refusal`,
      `${f}: the refusal for a made-up OCR_ENGINE does not name the setting`,
    ])
    expect(refusalProblems(f, 'OCR_ENGINE', { threw: false })).toEqual([`${f}: setting OCR_ENGINE to a made-up value is not refused`])
    expect(refusalProblems(f, 'OCR_ENGINE', { threw: true, message: 'OCR_ENGINE names a reading engine that is not available yet' })).toEqual([])
  })
})

describe('R101 prototype names never become keys, and JSON read from disk is scanned for repeated and reserved keys (SEC-10, ARC-15; A450)', () => {
  test('SEC-10 R101-record plant: F01\'s stamp record keyed by a non-blank string, and a handoff-id keyed record, are caught; a key schema refusing the names is not', async () => {
    const mod = await loadFix('planted-r101-records.mjs')
    const f = `${FIX_REL}/planted-r101-records.mjs`
    const exportsList = Object.keys(mod).sort().map((name) => ({ file: f, name, schema: mod[name] }))
    expect(recordKeyProblems(exportsList, [f], () => fix('planted-r101-records.mjs'))).toEqual([
      `${f}: the z.record at SlotsSchema.slots takes the prototype names "__proto__", "constructor", "prototype" as keys`,
      `${f}: the z.record at StampSchema takes the prototype names "__proto__", "constructor", "prototype" as keys`,
    ])
    const clean = exportsList.filter((e) => e.name === 'CleanStampSchema')
    expect(recordKeyProblems(clean, [], () => '')).toEqual([])
  })
  test('SEC-10 R101-record plant: a z.record no export reaches is reported, so a private record cannot hide', () => {
    expect(recordKeyProblems([], ['src/modules/planted.ts'], () => 'const r = z.record(z.string(), z.string())\n')).toEqual([
      'src/modules/planted.ts: holds 1 z.record calls and its exports reach 0 (export the schema, so R101 can check its keys)',
    ])
  })
  test('SEC-10 R101-record every z.record in src and testworld has keys that refuse prototype names', async () => {
    const files = SRC_TW().filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f) && /from\s*['"]zod['"]/.test(read(f)))
    const withRecord = files.filter((f) => /\bz\s*\.\s*record\s*\(/.test(read(f)))
    expect(scanProblems('R101-record', withRecord, 'src/contracts/records.ts')).toEqual([])
    const exportsList = await exportedZod(files, load)
    expect(exportsList.length).toBeGreaterThan(0)
    expect(onlyKnown('R101-record', recordKeyProblems(exportsList, withRecord, read))).toEqual([])
  }, 30_000)
  test('SEC-10 R101-json plant: G01\'s JSON.parse of a bank file with no key scan is caught; the same reader with repeatedKeys and reservedKeys is not', () => {
    const f = 'src/modules/gaps/bank/index.ts'
    expect(jsonScanProblems([f], () => fix('planted-r101-reader.ts.txt'))).toEqual([
      `${f}: parses JSON with no repeatedKeys( scan for a repeated key`,
      `${f}: parses JSON with no reservedKeys( scan for a prototype-name key`,
    ])
    expect(jsonScanProblems([f], () => fix('clean-r101-reader.ts.txt'))).toEqual([])
  })
  test('SEC-10 R101-json every src and testworld module that parses JSON scans it for repeated and reserved keys', () => {
    const files = SRC_TW()
    const parsers = files.filter((f) => /\bJSON\s*\.\s*parse\s*\(/.test(read(f)))
    expect(scanProblems('R101-json', parsers, 'src/modules/gaps/bank/index.ts')).toEqual([])
    expect(onlyKnown('R101-json', jsonScanProblems(files, read))).toEqual([])
  })
  test('SEC-10 R101-run plant: the drivers\' planted texts carry a repeated key and the reserved keys where the reader looks', () => {
    for (const [file, r] of Object.entries(READERS)) {
      const clean = r.clean()
      expect(clean.includes(r.repeat[0]), file).toBe(true)
      expect(clean.includes(r.nestedAt), file).toBe(true)
      const repeated = clean.replace(r.repeat[0], r.repeat[1])
      const key = r.repeat[0].slice(1, r.repeat[0].indexOf('"', 1))
      expect(repeated.split(`"${key}":`).length - 1, file).toBe(clean.split(`"${key}":`).length)
      expect(withKey(clean, '"__proto__": {}', 'top', r.nestedAt)).toContain('"__proto__": {}')
      expect(Object.prototype.hasOwnProperty.call(JSON.parse(withKey(clean, '"__proto__": {}', 'top', r.nestedAt)), '__proto__'), file).toBe(true)
    }
  })
  test('SEC-10 R101-run each disk JSON reader with a driver refuses a key written twice and a prototype-name key', async () => {
    const problems = []
    for (const [file, r] of Object.entries(READERS).sort()) problems.push(...(await jsonKeyRunProblems(file, r)))
    expect(onlyKnown('R101-run', problems)).toEqual([])
  }, 30_000)
})
