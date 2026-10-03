// SC3: the security-rules harness and its reviewed lists, shared by tools/test/security-rules.test.mjs (unit project)
// and src/contracts/security-rules.db.test.ts (db project), so every rule the db file applies has a unit twin that
// runs the same function on planted input (A391, findings A452). Pure functions and data; the only I/O is the walker.
// Card plan/cards/SC3.md; clauses SEC-11, ARC-6, ARC-20, FLOW-1, ARC-15. Spec-owned (the build changes none of it).
import fs from 'node:fs'
import path from 'node:path'

export interface SourceFile { name: string; text: string }
export interface Problem { file: string; text: string }

// ---------- the walker (item 10: every source extension; `coverage` skipped only at the root) ----------
const SKIP_ANYWHERE = new Set(['node_modules', '.next', '.git', '__fixtures__', '__golden__', '.stryker-tmp'])
const SKIP_AT_ROOT = new Set(['coverage'])
const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const TEST = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/

/** Every product source file under `dir` (absolute paths), `root` being the repo root. */
export function productFiles(root: string, dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_ANYWHERE.has(e.name)) continue
    if (path.resolve(dir) === path.resolve(root) && SKIP_AT_ROOT.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) productFiles(root, p, out)
    else if (SOURCE.test(e.name) && !TEST.test(e.name)) out.push(p)
  }
  return out
}
export function readSources(root: string, dir: string): SourceFile[] {
  return productFiles(root, dir).map((p) => ({ name: path.relative(root, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') }))
}

// ---------- KNOWN (A407, R80 form) ----------
/** One rule, one file, the exact problem strings and an open owner card whose Paths hold the file (or name `fix`). */
export interface Known { rule: string; file: string; problems: string[]; owner: string; fix?: string }

/** The problems no KNOWN entry covers, plus a line per listed string no longer produced (stale). */
export function applyKnown(rule: string, problems: Problem[], known: Known[]): string[] {
  const entries = known.filter((k) => k.rule === rule)
  const listed = new Set(entries.flatMap((k) => k.problems.map((p) => `${k.file}\n${p}`)))
  const seen = new Set(problems.map((p) => `${p.file}\n${p.text}`))
  const unlisted = problems.filter((p) => !listed.has(`${p.file}\n${p.text}`)).map((p) => `${p.file}: ${p.text}`)
  const stale = [...listed].filter((l) => !seen.has(l)).map((l) => `stale KNOWN entry ${rule} ${l.replace('\n', ': ')}: it no longer fails, remove it`)
  return [...unlisted, ...stale]
}

export interface CardInfo { status: string; paths: string[] }
/** `Paths: a, b (note), c/**` from a card's text: the path items, notes dropped. */
export function cardPaths(cardText: string): string[] {
  const m = /^Paths:(.*)$/m.exec(cardText)
  if (!m?.[1]) return []
  return m[1].split(',').map((s) => s.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] ?? '').filter((s) => s.length > 0)
}
export function pathMatches(glob: string, file: string): boolean {
  const re = glob
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*')
  return new RegExp(`^${re}$`).test(file)
}
const POSTPONED = /\b(?:waits? on|until|later|candidates?)\b/i

/** Shape of every KNOWN entry: rule id, a file that exists, exact strings, an open owner whose Paths hold the file or the fix. */
export function knownShapeProblems(known: Known[], cards: Map<string, CardInfo>, exists: (file: string) => boolean): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const k of known) {
    const id = `${k.rule} ${k.file}`
    if (!/^R6[2-6](?:-\w+)?$/.test(k.rule)) out.push(`${id}: the rule is not one of R62 to R66`)
    if (!exists(k.file)) out.push(`${id}: the file does not exist`)
    if (k.problems.length === 0) out.push(`${id}: lists no problem`)
    for (const p of k.problems) {
      if (typeof p !== 'string' || p.trim().length === 0) out.push(`${id}: a problem is not an exact string`)
      if (seen.has(`${k.file}\n${p}`)) out.push(`${id}: "${p}" is listed twice`)
      seen.add(`${k.file}\n${p}`)
    }
    const card = cards.get(k.owner)
    if (!card) out.push(`${id}: owner ${k.owner} is not a card in plan/slices.json`)
    else if (card.status === 'done') out.push(`${id}: owner ${k.owner} is done, so nothing will clear the entry`)
    else {
      const target = k.fix ?? k.file
      if (!card.paths.some((g) => pathMatches(g, target))) out.push(`${id}: ${target} is outside the Paths of owner ${k.owner}`)
    }
  }
  return out
}
/** A reviewed line whose reason postpones the work instead of naming why the value is free (findings A452, M4). */
export function postponedReasonProblems(list: Record<string, string>): string[] {
  const out: string[] = []
  for (const [key, reason] of Object.entries(list)) {
    if (reason.trim().length <= 10) out.push(`${key}: the reason is too short to review`)
    const m = POSTPONED.exec(reason)
    if (m) out.push(`${key}: the reason postpones ("${m[0]}"): a deferred column is a KNOWN entry with an owner card`)
  }
  return out
}

// ---------- R62: engine settings ----------
const ENGINE_TOKEN = /\b([A-Z][A-Z0-9_]*_ENGINE)\b/g
const ENGINE_PART = /_ENGINE\b/g

/** A name read as an engine setting that is not one (reviewed, stale-checked): `file#NAME`. */
export const NOT_SETTINGS: Record<string, string> = {
  'src/modules/sheets/index.ts#CSV_ENGINE': 'the engine stamp constant of the CSV reader (name and version written into every sheet result), not a setting',
}

/** Every `*_ENGINE` token a product file holds, with the names src/core/env.ts declares. */
export function engineSettings(files: SourceFile[], envText: string): { declared: Set<string>; read: { file: string; setting: string }[] } {
  const declared = new Set([...envText.matchAll(/^\s*([A-Z][A-Z0-9_]*_ENGINE)\s*:/gm)].map((m) => m[1] ?? ''))
  const read: { file: string; setting: string }[] = []
  for (const f of files) {
    if (f.name === 'src/core/env.ts') continue
    for (const m of f.text.matchAll(ENGINE_TOKEN)) read.push({ file: f.name, setting: m[1] ?? '' })
  }
  return { declared, read }
}
/** Undeclared settings, names built from parts (a template literal or a concatenation), and stale NOT_SETTINGS lines. */
export function undeclaredProblems(files: SourceFile[], envText: string, notSettings: Record<string, string> = {}): Problem[] {
  const { declared, read } = engineSettings(files, envText)
  const out: Problem[] = []
  const seen = new Set<string>()
  const used = new Set<string>()
  const push = (p: Problem): void => {
    if (seen.has(`${p.file}\n${p.text}`)) return
    seen.add(`${p.file}\n${p.text}`)
    out.push(p)
  }
  for (const r of read) {
    const key = `${r.file}#${r.setting}`
    if (key in notSettings) {
      used.add(key)
      continue
    }
    if (!declared.has(r.setting)) push({ file: r.file, text: `${r.setting} is read but not declared in src/core/env.ts` })
  }
  for (const f of files) {
    if (f.name === 'src/core/env.ts') continue
    for (const m of f.text.matchAll(ENGINE_PART)) {
      const before = f.text.slice(0, m.index)
      if (/[A-Z0-9]$/.test(before) && /\b[A-Z][A-Z0-9_]*$/.test(before)) continue
      const line = (f.text.split('\n')[before.split('\n').length - 1] ?? '').trim()
      push({ file: f.name, text: `an *_ENGINE name is built from parts (${line}): read the setting by its full name` })
    }
  }
  for (const key of Object.keys(notSettings)) {
    if (!used.has(key)) push({ file: key.split('#')[0] ?? key, text: `NOT_SETTINGS ${key} is no longer read there: remove the line` })
  }
  return out
}

/**
 * A registered setting (one with a factory) is read only in its factory's file: a second reader could choose a
 * stand-in by silence the factory test never sees (A458 G5). `factoryFiles` maps each setting to its factory's file.
 */
export function secondReaderProblems(files: SourceFile[], factoryFiles: Record<string, string>, notSettings: Record<string, string> = {}): Problem[] {
  const out: Problem[] = []
  const seen = new Set<string>()
  for (const r of engineSettings(files, '').read) {
    const home = factoryFiles[r.setting]
    if (home === undefined || r.file === home || `${r.file}#${r.setting}` in notSettings) continue
    const text = `${r.setting} is read outside its factory's file (${home}): read it only through the factory`
    if (seen.has(`${r.file}\n${text}`)) continue
    seen.add(`${r.file}\n${text}`)
    out.push({ file: r.file, text })
  }
  return out
}

type Factory = (env: Record<string, string | undefined>) => unknown
/** With NODE_ENV=production and the setting unset, then blank, the factory must refuse naming the setting. */
export async function productionProblems(setting: string, file: string, factory: Factory): Promise<Problem[]> {
  const out: Problem[] = []
  const cases: [string, Record<string, string | undefined>][] = [
    ['unset', { NODE_ENV: 'production' }],
    ['blank', { NODE_ENV: 'production', [setting]: '' }],
  ]
  for (const [how, env] of cases) {
    try {
      await factory(env)
      out.push({ file, text: `${setting}: with NODE_ENV=production and the setting ${how} the factory did not refuse` })
    } catch (e) {
      if (!(e instanceof Error && e.message.includes(setting))) out.push({ file, text: `${setting}: the factory refused production (setting ${how}) without naming the setting` })
    }
  }
  return out
}

// ---------- tags (R63 to R65; item 6: strict) ----------
export type TagKind = 'standin' | 'once' | 'limit'
export interface Tagged { key: string; n?: number }
const STRICT: Record<TagKind, RegExp> = {
  standin: /^\s*\*\s*@standin\s+([A-Za-z_$][\w$]*)\s*$/,
  once: /^\s*\*\s*@once\s+([A-Za-z_$][\w$]*)\s*$/,
  limit: /^\s*\*\s*@limit\s+([1-9]\d*)\s+([A-Za-z_$][\w$]*)\s*$/,
}
const MENTION = /@(standin|once|limit)\b/

/**
 * Every tag line in the sources, and a problem for every line that names @standin, @once or @limit but is not a
 * strict tag line: ` * @tag name` (or ` * @limit N name`) alone on a line inside a multi-line JSDoc block.
 */
export function scanTags(files: SourceFile[]): { tagged: Record<TagKind, Tagged[]>; problems: Problem[] } {
  const tagged: Record<TagKind, Tagged[]> = { standin: [], once: [], limit: [] }
  const problems: Problem[] = []
  for (const f of files) {
    let block: 'none' | 'jsdoc' | 'plain' = 'none'
    for (const line of f.text.split('\n')) {
      const startsIn = block
      // update the block state for the next line
      let rest = line
      for (;;) {
        if (block === 'none') {
          const open = rest.indexOf('/*')
          if (open < 0) break
          const after = rest.slice(open + 2)
          block = after.startsWith('*') && !after.startsWith('*/') ? 'jsdoc' : 'plain'
          rest = block === 'jsdoc' ? after.slice(1) : after
        } else {
          const close = rest.indexOf('*/')
          if (close < 0) break
          block = 'none'
          rest = rest.slice(close + 2)
        }
      }
      const m = MENTION.exec(line)
      if (!m) continue
      const kind = m[1] as TagKind
      const strict = startsIn === 'jsdoc' && block === 'jsdoc' ? STRICT[kind].exec(line) : null
      if (!strict) {
        problems.push({ file: f.name, text: `a @${kind} mention that is not a strict tag line: "${line.trim()}"` })
        continue
      }
      if (kind === 'limit') tagged.limit.push({ key: `${f.name}#${strict[2] ?? ''}`, n: Number(strict[1]) })
      else tagged[kind].push({ key: `${f.name}#${strict[1] ?? ''}` })
    }
  }
  return { tagged, problems }
}
export function taggedExports(tag: TagKind, files: SourceFile[]): Tagged[] {
  return scanTags(files).tagged[tag]
}
export function tagProblems(tagged: Tagged[], registry: Tagged[]): string[] {
  const out: string[] = []
  const reg = new Map(registry.map((r) => [r.key, r.n]))
  for (const t of tagged) {
    if (!reg.has(t.key)) out.push(`${t.key}: tagged but missing from the registry`)
    else if (reg.get(t.key) !== t.n) out.push(`${t.key}: the tag says limit ${String(t.n)} but the registry says ${String(reg.get(t.key))}`)
  }
  for (const r of registry) if (!tagged.some((t) => t.key === r.key)) out.push(`${r.key}: in the registry but its export lacks the tag`)
  return out
}

// ---------- race and stand-in harnesses (R63 to R65); `D` is the database handle (PGlite in the db file, a fake in the unit twin) ----------
export interface Entry<D, T> {
  key: string
  setup: (db: D) => Promise<T>
  /** One attempt; true when it got through. A rejection counts as refused. */
  call: (ctx: T, i: number) => Promise<boolean>
}
export const PARALLEL = 8
async function gotThrough<D, T>(entry: Entry<D, T>, ctx: T, attempts: number): Promise<number> {
  const results = await Promise.allSettled(Array.from({ length: attempts }, (_, i) => entry.call(ctx, i)))
  return results.filter((r) => r.status === 'fulfilled' && r.value).length
}
/** R64: 8 parallel calls on one database; exactly one gets through (none means the entry's setup is wrong). */
export async function onceProblems<D, T>(entry: Entry<D, T>, db: D): Promise<string[]> {
  const n = await gotThrough(entry, await entry.setup(db), PARALLEL)
  if (n > 1) return [`${entry.key}: ${String(n)} of ${String(PARALLEL)} parallel calls got through, at most 1 allowed`]
  if (n === 0) return [`${entry.key}: no call got through, so the entry proves nothing`]
  return []
}
/** R65: 2N parallel attempts; at most N are let through (counted by `count` when given, else by what the calls return). */
export async function limitProblems<D, T>(entry: Entry<D, T>, n: number, db: D, count?: (db: D) => Promise<number>): Promise<string[]> {
  const ctx = await entry.setup(db)
  const returned = await gotThrough(entry, ctx, 2 * n)
  const through = count ? await count(db) : returned
  if (through > n) return [`${entry.key}: ${String(through)} of ${String(2 * n)} parallel attempts got through, at most ${String(n)} allowed`]
  if (through === 0) return [`${entry.key}: no attempt got through, so the entry proves nothing`]
  return []
}
/** R63: with one real row added, the stand-in must refuse to start and write nothing into its table. */
export async function standinProblems(
  key: string,
  table: string,
  db: { addRealRow: () => Promise<void>; count: () => Promise<number> },
  start: () => Promise<unknown>,
): Promise<string[]> {
  await db.addRealRow()
  const before = await db.count()
  let refused = false
  try {
    await start()
  } catch {
    refused = true
  }
  const out: string[] = []
  if (!refused) out.push(`${key}: started on a database holding a real row in ${table}`)
  if ((await db.count()) !== before) out.push(`${key}: wrote rows into ${table} next to a real row`)
  return out
}

/** The registries' keys (the db file holds each entry's harness and asserts its keys equal these). */
const AUTH_FILE = 'src/modules/auth/testusers/engine.ts'
export const REGISTRY: Record<TagKind, Tagged[]> = {
  standin: [{ key: `${AUTH_FILE}#createTestUsersAuth` }],
  once: [{ key: `${AUTH_FILE}#finishSignIn` }],
  limit: [{ key: `${AUTH_FILE}#startSignIn`, n: 5 }],
}

/** Cards that must add a registry entry when their folder lands on main (the reading-rules pattern, item 9). */
export interface Landing { rule: string; card: string; dir: string; what: string }
export const LANDING: Landing[] = [
  { rule: 'R64', card: 'T08', dir: 'src/modules/approval', what: 'approve, tagged @once' },
  { rule: 'R64', card: 'E00', dir: 'src/modules/documents/intake', what: 'intake, tagged @once' },
]
export function landingProblems(landing: Landing[], registry: Tagged[], exists: (dir: string) => boolean): string[] {
  return landing
    .filter((l) => exists(l.dir) && !registry.some((r) => r.key.startsWith(`${l.dir}/`)))
    .map((l) => `${l.card}: landed (${l.dir}, ${l.what}) with no ${l.rule} registry entry under it`)
}
/** Each LANDING folder sits inside its card's Paths, so a renamed folder cannot leave the entry silent (A458 G3). */
export function landingPathProblems(landing: Landing[], cards: Map<string, CardInfo>): string[] {
  const out: string[] = []
  for (const l of landing) {
    const card = cards.get(l.card)
    if (!card) out.push(`${l.card}: not a card in plan/slices.json`)
    else if (!card.paths.some((g) => pathMatches(g, `${l.dir}/x.ts`))) out.push(`${l.card}: ${l.dir} is outside the card's Paths, so its landing would never be seen`)
  }
  return out
}

// ---------- the create* inventory (item 8) ----------
export interface Inventory {
  /** Adapter factories that read an engine setting (R62 applies each). */
  factories: Record<string, string>
  /** Not an adapter: the reason. */
  notAdapter: Record<string, string>
  /** A stand-in reached only through its factory, inside its module folder. */
  behindFactory: Record<string, { factory: string; module: string }>
}
export const INVENTORY: Inventory = {
  factories: {
    createAuth: 'AUTH_ENGINE',
    createReadingAdapter: 'OCR_ENGINE',
    createDriveStandIn: 'STORAGE_DRIVE_ENGINE',
    createFileStore: 'STORAGE_FILES_ENGINE',
  },
  notAdapter: {
    createJobQueue: 'the job queue over the database; no engine to choose (ARC-14)',
    createRunner: 'the job runner; runs handlers, chooses no engine',
    createSyncRunner: 'the in-process job runner for tests and the desk; chooses no engine',
    createLifecycle: 'the return lifecycle over the database; chooses no engine',
    createSheetsReader: 'the CSV and spreadsheet reader; one engine, stamped as CSV_ENGINE, nothing to choose',
    createLiveAuth: 'the live sign-in slot; off and refusing until GL1 turns it on',
  },
  behindFactory: {
    createTestUsersAuth: { factory: 'createAuth', module: 'src/modules/auth' },
    createTextLayerEngine: { factory: 'createReadingAdapter', module: 'src/modules/ocr' },
    createRecordedEngine: { factory: 'createReadingAdapter', module: 'src/modules/ocr' },
  },
}

const CREATE = /^create[A-Z]\w*$/
/** Every exported `create*` name in the given files: declared (`file` is where) or re-exported. */
export function createExports(files: SourceFile[]): { name: string; file: string; declared: boolean }[] {
  const out: { name: string; file: string; declared: boolean }[] = []
  for (const f of files) {
    for (const m of f.text.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) if (CREATE.test(m[1] ?? '')) out.push({ name: m[1] ?? '', file: f.name, declared: true })
    for (const m of f.text.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) if (CREATE.test(m[1] ?? '')) out.push({ name: m[1] ?? '', file: f.name, declared: true })
    for (const m of f.text.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gm)) {
      for (const item of (m[1] ?? '').split(',')) {
        const parts = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)
        const name = (parts[1] ?? parts[0] ?? '').trim()
        if (CREATE.test(name)) out.push({ name, file: f.name, declared: false })
      }
    }
  }
  return out
}
function takesDb(text: string, name: string): boolean {
  // a function declaration, or a const/let/var bound to an arrow or function expression (A458 G4)
  const sig =
    new RegExp(`function\\s*\\*?\\s*${name}\\s*(?:<[^>]*>)?\\s*\\(([^)]*)\\)`).exec(text) ??
    new RegExp(`(?:const|let|var)\\s+${name}\\b[^=]*=\\s*(?:async\\s+)?(?:function\\b\\s*\\*?\\s*[\\w$]*\\s*)?(?:<[^>]*>)?\\s*\\(([^)]*)\\)`).exec(text)
  if (!sig) return false
  const params = sig[1] ?? ''
  if (/\bdb\s*\??\s*:/.test(params)) return true
  const typeName = /:\s*([A-Z]\w*)/.exec(params)?.[1]
  if (!typeName) return false
  const body = new RegExp(`(?:interface\\s+${typeName}\\b[^{]*|type\\s+${typeName}\\s*=\\s*)\\{([\\s\\S]*?)\\n\\}`).exec(text)
  return body ? /^\s*db\s*\??\s*:/m.test(body[1] ?? '') : false
}
/**
 * Every exported create* under src/modules is on exactly one list; a stand-in behind a factory names a listed factory,
 * no product file outside its module folder names it, and one that takes a database carries @standin.
 */
export function inventoryProblems(files: SourceFile[], inv: Inventory = INVENTORY): Problem[] {
  const out: Problem[] = []
  const modules = files.filter((f) => f.name.startsWith('src/modules/'))
  const exported = createExports(modules)
  const names = new Set(exported.map((e) => e.name))
  const lists = (n: string): number => [inv.factories, inv.notAdapter, inv.behindFactory].filter((l) => n in l).length
  for (const e of exported) {
    if (lists(e.name) === 0) out.push({ file: e.file, text: `exports ${e.name}, which is on no list (FACTORY, NOT_ADAPTER or BEHIND_FACTORY)` })
    if (lists(e.name) > 1) out.push({ file: e.file, text: `${e.name} is on more than one list` })
  }
  for (const n of [...Object.keys(inv.factories), ...Object.keys(inv.notAdapter), ...Object.keys(inv.behindFactory)]) {
    if (!names.has(n)) out.push({ file: 'src/modules', text: `${n} is listed but no file under src/modules exports it: remove the line` })
  }
  const standins = new Set(scanTags(files).tagged.standin.map((t) => t.key))
  for (const [name, b] of Object.entries(inv.behindFactory)) {
    if (!(b.factory in inv.factories)) out.push({ file: b.module, text: `${name} names ${b.factory}, which is not a listed factory` })
    for (const f of files) {
      if (f.name.startsWith(`${b.module}/`)) continue
      if (new RegExp(`\\b${name}\\b`).test(f.text)) out.push({ file: f.name, text: `names ${name}, a stand-in reached only through ${b.factory} inside ${b.module}` })
    }
    for (const d of exported.filter((e) => e.name === name && e.declared)) {
      const text = files.find((f) => f.name === d.file)?.text ?? ''
      if (takesDb(text, name) && !standins.has(`${d.file}#${name}`)) out.push({ file: d.file, text: `${name} takes a database but carries no @standin tag` })
    }
  }
  return out
}

// ---------- R66 (items 1 to 5) ----------
/** A snapshot of the catalog: non-internal triggers, functions, columns (text = a string type through domains and arrays), constraints. */
export interface Catalog {
  triggers: { table: string; fn: string; tgtype: number }[]
  functions: { name: string; src: string }[]
  columns: { table: string; col: string; attnum: number; text: boolean }[]
  constraints: { table: string; type: string; cols: number[]; def: string }[]
}
const BEFORE = 2
const DELETE = 8
const TRUNCATE = 32
/**
 * Append-only by behaviour: a BEFORE DELETE trigger (row or statement level, A458 G1) and a BEFORE TRUNCATE trigger,
 * whatever the function.
 */
export function appendOnlyTables(cat: Catalog): string[] {
  const tables = [...new Set(cat.triggers.map((t) => t.table))]
  return tables
    .filter((t) => {
      const ts = cat.triggers.filter((g) => g.table === t)
      return ts.some((g) => (g.tgtype & (BEFORE | DELETE)) === (BEFORE | DELETE)) && ts.some((g) => (g.tgtype & (BEFORE | TRUNCATE)) === (BEFORE | TRUNCATE))
    })
    .sort()
}
/** Sentinel: every trigger whose function raises "append-only" sits on a table of the append-only set. */
export function appendOnlyGuardProblems(cat: Catalog): string[] {
  const set = new Set(appendOnlyTables(cat))
  const guards = new Set(cat.functions.filter((f) => f.src.includes('append-only')).map((f) => f.name))
  const out = [...new Set(cat.triggers.filter((t) => guards.has(t.fn) && !set.has(t.table)).map((t) => `${t.table}: guarded by ${t.fn} but not found append-only (no BEFORE ROW DELETE and BEFORE TRUNCATE pair)`))]
  for (const g of guards) if (!cat.triggers.some((t) => t.fn === g)) out.push(`${g}: raises append-only but guards no table`)
  return out.sort()
}

/** Format functions a CHECK may call on a column (reviewed): each must hold a `~` match or a `= ANY` list, or call one that does. */
export const FORMAT_FUNCTIONS: Record<string, string> = {
  is_handoff_id: 'an id of letters, digits and _ . : - up to 80 characters (ARC-2, F07)',
  handoff_ids_ok: 'every element is_handoff_id (ARC-2, F07)',
}
/** Never a format, whatever their source holds. */
export const NEVER_FORMAT = ['is_blank']

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const WILD = '\u0000'
/**
 * A `~` literal is a format only when it is anchored `^...$`, has no top-level `|` (which would undo the anchors), and
 * repeats no wildcard (`.`, `\S`, `\W`, `\D`) with `*`, `+` or `{`: so `\S`, `.` and `^.+$` (non-blank in other
 * words) are not formats (A458 G2). Bracket expressions, negated ones included, are a fixed set and count as formats.
 */
export function formatPattern(literal: string): boolean {
  const p = literal.replace(/''/g, "'")
  if (!p.startsWith('^') || !p.endsWith('$') || p.endsWith('\\$')) return false
  let out = ''
  let depth = 0
  for (let i = 0; i < p.length; ) {
    const c = p[i] ?? ''
    if (c === '\\') {
      out += /[SWD]/.test(p[i + 1] ?? '') ? WILD : 'x'
      i += 2
    } else if (c === '[') {
      let j = i + 1
      if (p[j] === '^') j += 1
      if (p[j] === ']') j += 1
      while (j < p.length && p[j] !== ']') {
        if (p[j] === '[' && p[j + 1] === ':') {
          const e = p.indexOf(':]', j + 2)
          j = e < 0 ? p.length : e + 2
        } else j += p[j] === '\\' ? 2 : 1
      }
      out += 'x'
      i = j + 1
    } else {
      if (c === '(') depth += 1
      if (c === ')') depth -= 1
      if (c === '|' && depth === 0) return false
      out += c === '.' ? WILD : c
      i += 1
    }
  }
  return !new RegExp(`${WILD}\\)*[*+{]`).test(out)
}
/** The literals of every `~` or `~*` match in a text (not `!~`), as written between quotes. */
function matchLiterals(text: string): string[] {
  return [...text.matchAll(/(?<![!~])~\*?(?![~*])\s*'((?:[^']|'')*)'/g)].map((m) => m[1] ?? '')
}
/**
 * True when the CHECK definition constrains `col` itself: its operand of `= ANY`, `<@` or a `~`/`~*` match whose literal
 * is a format (formatPattern), or the argument of a format function, never negated.
 */
export function checkVouches(def: string, col: string, formatFns: string[] = Object.keys(FORMAT_FUNCTIONS)): boolean {
  const ref = `(?:"${esc(col)}"|\\b${esc(col)}\\b)`
  const cast = `(?:\\s*\\)|::[a-z ]+(?:\\[\\])?)*`
  const notNeg = `(?<!\\bNOT\\s*(?:\\(\\s*)*)`
  const operand = new RegExp(`${notNeg}(?<![\\w."])${ref}${cast}\\s*(=\\s*ANY\\b|~\\*?(?![~*])|<@)`, 'g')
  for (const m of def.matchAll(operand)) {
    if (!(m[1] ?? '').startsWith('~')) return true
    const lit = /^\s*'((?:[^']|'')*)'/.exec(def.slice((m.index ?? 0) + m[0].length))
    if (lit && formatPattern(lit[1] ?? '')) return true
  }
  const fns = formatFns.filter((f) => !NEVER_FORMAT.includes(f)).map(esc)
  if (fns.length === 0) return false
  const call = new RegExp(`${notNeg}(?<![\\w.])(?:returns\\.)?(?:${fns.join('|')})\\(\\s*(?:\\(\\s*)*${ref}${cast}\\s*\\)`)
  return call.test(def)
}
export function formatFunctionProblems(cat: Catalog, formatFns: string[] = Object.keys(FORMAT_FUNCTIONS)): string[] {
  const out: string[] = []
  const ok = new Set<string>()
  // a function holding a match or a list directly, then those calling one of them
  for (const f of formatFns) {
    if (NEVER_FORMAT.includes(f)) out.push(`${f}: never a format function`)
    const src = cat.functions.find((x) => x.name === f)?.src
    if (src === undefined) out.push(`${f}: no such function in the database`)
    // a match counts only when its literal is a format (A458 G2: `s ~ '\S'` is non-blank, not a format)
    else if (matchLiterals(src).some(formatPattern) || /=\s*any\b/i.test(src)) ok.add(f)
  }
  for (const f of formatFns) {
    const src = cat.functions.find((x) => x.name === f)?.src
    if (src === undefined || ok.has(f)) continue
    if ([...ok].some((g) => new RegExp(`\\b${esc(g)}\\(`).test(src))) ok.add(f)
    else out.push(`${f}: its source holds no ~ match or = ANY list and calls no format function that does`)
  }
  return out
}
/** Text columns of append-only tables with no key, no list or format check on the column itself, as `table.col`. */
export function freeText(cat: Catalog, formatFns: string[] = Object.keys(FORMAT_FUNCTIONS)): string[] {
  const set = new Set(appendOnlyTables(cat))
  return cat.columns
    .filter((c) => c.text && set.has(c.table))
    .filter((c) => {
      const ks = cat.constraints.filter((k) => k.table === c.table)
      if (ks.some((k) => k.type === 'f' && k.cols.includes(c.attnum))) return false
      if (ks.some((k) => k.type === 'p' && k.cols.length === 1 && k.cols[0] === c.attnum)) return false
      return !ks.some((k) => k.type === 'c' && k.cols.includes(c.attnum) && checkVouches(k.def, c.col, formatFns))
    })
    .map((c) => `${c.table}.${c.col}`)
    .sort()
}

/** Sentinel: these tables are append-only on main (findings A452 item 1). */
export const APPEND_ONLY_SENTINEL = [
  'events', 'state_events', 'versions', 'version_cells', 'approvals', 'judgment_inputs', 'facts', 'adjusting_entries', 'gifi_mappings', 'client_handoff', 'sign_in_events',
]

// The reviewed free-text list: `table.column` and why free text is right there. Only free-by-nature columns; a column
// that should be keyed or listed later is an R66 KNOWN entry with an open owner card (A452 item 4), never a line here.
// A single-column primary key counts as keyed (amber: ids are generated by code, never typed).
export const FREE_TEXT: Record<string, string> = {
  'adjusting_entries.qbo_txn_id': 'the id QuickBooks gave the transaction; opaque to us and not ours to constrain',
  'adjusting_entries.reason': 'the reason the preparer gave for the adjusting entry (TB-3); free by nature',
  'entry_lines.qbo_account_id': 'the id QuickBooks gave the account; opaque to us and not ours to constrain',
  'events.reason': 'the reason a person or the system gave for the change (FLOW-1); free by nature, non-blank is checked',
  'events.record_id': 'the id of the record the event is about, in the table named beside it; a pointer across tables cannot be one key',
  'facts.source_qbo_account_id': 'the id QuickBooks gave the account the figure came from; opaque to us and not ours to constrain',
  'facts.source_qbo_txn_id': 'the id QuickBooks gave the transaction the figure came from; opaque to us and not ours to constrain',
  'facts.source_reason': 'the reason given as the source of a judgment figure (EV-5); free by nature',
  'facts.source_sheet': 'the sheet name in the client workbook the figure came from (EV-14); the client named it',
  'facts.value': 'the figure as read or entered, an empty value being a value (RT-12, text.ts VALUE_COLUMNS); any text is valid',
  'jobs.idempotency_key': 'built by code from the work it names (ARC-14), never typed; no fixed list',
  'jobs.last_error': 'the error text of the last failed attempt, already redacted by the logger (SEC-10); free by nature',
  'jobs.lease_holder': 'the name of the worker holding the lease, set by code; no fixed list',
  'judgment_inputs.cell_id': 'the Taxprep cell identifier, kept as the export spelled it (RT-13); the cell list lives in data, not in a check',
  'judgment_inputs.reason': 'the reason the preparer gave for the judgment (EV-10); free by nature',
  'judgment_inputs.value': 'the value the preparer entered, kept exactly as typed (RT-12); any text is valid',
  'state_events.reason': 'the reason a person or the system gave for the transition (FLOW-1); free by nature, non-blank is checked',
  'version_cells.cell_id': 'the Taxprep cell identifier, kept as the export spelled it (RT-13); the cell list lives in data, not in a check',
  'version_cells.value': 'the cell value as exported, kept exactly as read (RT-3); any text is valid',
}

/** The R66 problem string for a free-text column (KNOWN entries list these exactly). */
export const r66Problem = (col: string): string => `${col} is text in an append-only table with no key, list or format`

const ACTOR_FIX = 'db/schema/94_actor_keys.sql'
// KNOWN for every rule here (A407, R80 form). R62 is empty since FX2 landed (A443). R66: the deferred columns, each
// with the open card whose Paths hold its schema file (or, for FX17, its fix file). An owner deletes its own entries
// when it lands; tools/test/security-rules.test.mjs pins which columns each owner may hold (A458 G6).
export const KNOWN: Known[] = [
  {
    rule: 'R66',
    file: 'db/schema/20_ledger.sql',
    owner: 'L00',
    problems: [
      'events.record_table', 'facts.fact_key', 'facts.method', 'facts.source_client_answer_id', 'facts.source_column', 'facts.source_cra_capture_id', 'facts.source_prior_return_id', 'facts.source_qbo_snapshot_id',
    ].map(r66Problem),
  },
  { rule: 'R66', file: 'db/schema/30_books.sql', owner: 'B05', problems: ['adjusting_entries.qbo_snapshot_id', 'gifi_mappings.gifi_code'].map(r66Problem) },
  { rule: 'R66', file: 'db/schema/20_ledger.sql', owner: 'FX17', fix: ACTOR_FIX, problems: ['events.actor'].map(r66Problem) },
  { rule: 'R66', file: 'db/schema/50_returns.sql', owner: 'FX17', fix: ACTOR_FIX, problems: ['state_events.actor'].map(r66Problem) },
  { rule: 'R66', file: 'db/schema/60_versions.sql', owner: 'FX17', fix: ACTOR_FIX, problems: ['approvals.approved_by'].map(r66Problem) },
  { rule: 'R66', file: 'db/schema/30_books.sql', owner: 'FX17', fix: ACTOR_FIX, problems: ['adjusting_entries.author', 'judgment_inputs.author'].map(r66Problem) },
  // A458: the three former FREE_TEXT keeps, each a format or a fixed list its owner adds
  { rule: 'R66', file: 'db/schema/15_auth.sql', owner: 'FX17', fix: ACTOR_FIX, problems: ['sign_in_events.reason'].map(r66Problem) },
  { rule: 'R66', file: 'db/schema/60_versions.sql', owner: 'T08', problems: ['approvals.fingerprint'].map(r66Problem) },
]

/** The schema files, named from the repo root (the rule files read them through here, as db-rules does, ARC-4 R4). */
export function readSchema(root: string): SourceFile[] {
  const dir = path.join(root, 'db', 'schema')
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ name: path.relative(root, path.join(dir, f)).split(path.sep).join('/'), text: fs.readFileSync(path.join(dir, f), 'utf8') }))
}
/** Which schema file creates each table (R66 problems are filed there). */
export function tableFiles(schema: SourceFile[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const f of schema) for (const m of f.text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?returns\.(\w+)/gi)) out.set(m[1] ?? '', f.name)
  return out
}
/** R66 problems for the free-text columns not on the reviewed list, filed under their schema file. */
export function r66Problems(free: string[], files: Map<string, string>, freeTextList: Record<string, string> = FREE_TEXT): Problem[] {
  return free.filter((c) => !(c in freeTextList)).map((c) => ({ file: files.get(c.split('.')[0] ?? '') ?? `unknown schema file for ${c}`, text: r66Problem(c) }))
}
