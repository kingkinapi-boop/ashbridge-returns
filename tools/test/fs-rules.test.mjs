// SC12: exchange and file-system rules R93 to R97, plus R104 (caps, A466) and R105, R106 (one clock, tests pin it;
// A469, A472, A474) (unit project). Card plan/cards/SC12.md; clauses SEC-10, SEC-11, ARC-22, ARC-15. From
// reports/A04-findings-5.md and -6.md ("Rule tests"): another process writes the exchange folders, ids go into paths,
// loops wait for ever, child processes hang, a flag a gate trusts is set by whoever builds the job, memory grows per
// poll, and one deadline is read from two clocks.
// Each rule is first shown catching a planted example under tools/test/__fixtures__/fs-rules/ (and passing a clean
// one), then applied to every product file under src/. A rule that fails on landed code is a KNOWN entry: one rule,
// one file, the exact problem string (no regex) and an open owner card. An unlisted problem fails; a listed string no
// longer produced fails as stale. Every scan asserts it read files and a named sentinel (A407).
//
// How the scan reads code: comments and string-free text are blanked, braces are matched to find each function body, and
// an operation belongs to the innermost function around it. A deliberate exception is a line comment
// `// fs-safe: <reason>` on the line before the operation (R93 only); it needs a reason.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__', 'fs-rules')
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

// ---------- known defects on main, each owned by an open card ----------
const FX7 = 'FX7 (rule defects in landed code)'
const KNOWN = [
  { rule: 'R93', owner: FX7, problem: 'src/modules/storage/files/index.ts put: fs.mkdirSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)' },
  { rule: 'R93', owner: FX7, problem: 'src/modules/storage/files/index.ts put: fs.writeFileSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)' },
  { rule: 'R93', owner: FX7, problem: 'src/modules/storage/files/index.ts put: fs.renameSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)' },
  { rule: 'R93', owner: FX7, problem: 'src/modules/storage/files/index.ts put: fs.rmSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)' },
  { rule: 'R93', owner: FX7, problem: 'src/modules/storage/files/index.ts (anonymous): fs.readFileSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)' },
  { rule: 'R93', owner: 'FX11 (ocr recorded writes)', problem: 'src/modules/ocr/recorded/index.ts (anonymous): fs.writeFileSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)' },
  { rule: 'R94', owner: FX7, problem: 'src/modules/storage/drive/index.ts readIndex: fs.readFileSync reads a file without readRegularFile (R94)' },
  { rule: 'R94', owner: FX7, problem: 'src/modules/storage/drive/index.ts createDriveStandIn: fs.readFileSync reads a file without readRegularFile (R94)' },
  { rule: 'R94', owner: FX7, problem: 'src/modules/storage/files/index.ts (anonymous): fs.readFileSync reads a file without readRegularFile (R94)' },
  // R104 (A466): containers that grow across calls with no cap from data. A container bounded another way takes the
  // marker `// R104 bounded: <reason>` from its owner (for example counts: one entry per approved step type).
  { rule: 'R104', owner: 'FX18 (seen capped, A04 security L4)', problem: 'src/modules/ai/runner/engines.ts seen: a Set that grows in logOnce has no cap from data (R104)' },
  { rule: 'R104', owner: 'FX18 (runner counts)', problem: 'src/modules/ai/runner/runner.ts counts: a Map that grows in count has no cap from data (R104)' },
  { rule: 'R104', owner: 'FX7 (textlayer store)', problem: 'src/modules/ocr/textlayer/index.ts store: a Map that grows in read has no cap from data (R104)' },
  { rule: 'R104', owner: 'FX4 (sheets cache)', problem: 'src/modules/sheets/index.ts cache: a Map that grows in read has no cap from data (R104)' },
  { rule: 'R104', owner: 'SC3 (testusers hash cache)', problem: 'src/modules/auth/testusers/engine.ts expectedHashes: a Map that grows in passwordMatches has no cap from data (R104)' },
  { rule: 'R104', owner: 'SC11 (db handle bookkeeping)', problem: 'src/core/db/index.ts ownedRoles: a Set that grows in tracked has no cap from data (R104)' },
  { rule: 'R104', owner: 'SC11 (db handle bookkeeping)', problem: 'src/core/db/index.ts customSettings: a Set that grows in tracked has no cap from data (R104)' },
  // R106 (A469, A472, A474): factory calls in tests with no clock and no reasoned marker.
  { rule: 'R106', owner: 'A04C (G4 pins the three runners)', problem: 'src/modules/ai/runner/runner.acceptance.test.ts:604 createAiRunner(...) with no AiRunnerOptions.now (R106)' },
  { rule: 'R106', owner: 'A04C (G4 pins the three runners)', problem: 'src/modules/ai/runner/runner.acceptance.test.ts:1225 createAiRunner(...) with no AiRunnerOptions.now (R106)' },
  { rule: 'R106', owner: 'A04C (G4 pins the three runners)', problem: 'src/modules/ai/runner/runner.acceptance.test.ts:1238 createAiRunner(...) with no AiRunnerOptions.now (R106)' },
  ...[489, 497, 504, 512, 523, 627, 649, 655].map((line) => ({
    rule: 'R106',
    owner: 'SC3 (auth tests, provisional: the Lead re-homes)',
    problem: `src/modules/auth/auth.acceptance.db.test.ts:${String(line)} createAuth(...) with no AuthOptions.clock (R106)`,
  })),
]

function onlyKnown(rule, problems) {
  const known = KNOWN.filter((k) => k.rule === rule)
  const unknown = problems.filter((p) => !known.some((k) => k.problem === p))
  const stale = known
    .filter((k) => !problems.includes(k.problem))
    .map((k) => `stale KNOWN entry ${k.rule} (owner ${k.owner}): "${k.problem}" is no longer produced, remove it`)
  return [...unknown, ...stale]
}

// ---------- files ----------
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.stryker-tmp', 'coverage', 'test-results', 'playwright-report'])
function walk(dirRel, out = []) {
  const abs = path.join(ROOT, dirRel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const r = `${dirRel}/${e.name}`
    if (e.isDirectory()) walk(r, out)
    else out.push(r)
  }
  return out
}
const isTestFile = (f) => /\.(test|spec|acceptance\.test)\.[cm]?[jt]sx?$/.test(f) || /\.db\.test\./.test(f)
const isSupport = (f) => /(^|\/)(__fixtures__|__golden__|__recordings__|testing)\//.test(f)
/** Every product file under src/: no tests, fixtures, goldens or test helpers. */
const productFiles = () =>
  walk('src')
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !isTestFile(f) && !isSupport(f))
    .map((rel) => ({ rel, text: read(rel) }))

// ---------- reading code ----------
/** Comments and string literals blanked (same length, newlines kept), so scans see only code. Template text is blanked except `${...}` holes.
 * With `keepStrings`, only comments are blanked (R105 looks for SQL clock words inside query strings). */
function blank(src, keepStrings = false) {
  let out = ''
  let i = 0
  const keepNl = (s) => s.replace(/[^\n]/g, ' ')
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += keepNl(src.slice(i, stop))
      i = stop
    } else if (c === '/' && n === '/' && (i === 0 || /[\s;{}()]/.test(src[i - 1]))) {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      out += ' '.repeat(stop - i)
      i = stop
    } else if (c === "'" || c === '"') {
      let j = i + 1
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      out += keepStrings ? src.slice(i, src[j] === c ? j + 1 : j) : c + ' '.repeat(Math.max(0, j - i - 1)) + (src[j] === c ? c : '')
      i = j + 1
    } else if (c === '`') {
      let j = i + 1
      out += '`'
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') {
          out += keepStrings ? src.slice(j, j + 2) : '  '
          j += 2
        } else if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1
          let k = j + 2
          while (k < src.length && depth > 0) {
            if (src[k] === '{') depth++
            else if (src[k] === '}') depth--
            k++
          }
          out += src.slice(j, k)
          j = k
        } else {
          out += src[j] === '\n' || keepStrings ? src[j] : ' '
          j++
        }
      }
      out += '`'
      i = j + 1
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Function bodies in blanked code: `{ name, start, end }` (start at the `{`, end after the `}`), innermost findable by range. */
function functions(code) {
  const out = []
  const stack = []
  let headerStart = 0
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (c === '{') {
      let header = code.slice(headerStart, i)
      // braces of a type annotation earlier in the header do not count
      while (/\{[^{}]*\}/.test(header)) header = header.replace(/\{[^{}]*\}/g, ' T ')
      // a brace right after a colon is a type (a parameter or return type), not a body
      const isType = /:\s*$/.test(header)
      const control = /^\s*(?:\}\s*)?(?:else\s+)?(?:if|for|while|switch|catch|try|do|finally|else)\b/.test(header)
      const isFn = !isType && !control && (/=>\s*$/.test(header) || /\bfunction\b/.test(header) || /\)\s*(?::\s*[^;={}]+)?$/.test(header))
      const name = /(?:function\s*\*?\s*|(?:const|let|var)\s+|^\s*(?:async\s+|static\s+|public\s+|private\s+)*)([A-Za-z_$][\w$]*)\s*(?:[:=(<]|$)/.exec(header.trim().split('\n').pop() ?? '')?.[1]
      stack.push({ isFn, isType, name: name ?? '(anonymous)', start: i, headerStart })
      headerStart = i + 1
    } else if (c === '}') {
      const top = stack.pop()
      if (top?.isFn) out.push({ name: top.name, start: top.start, end: i + 1 })
      // after a type the body's header continues; keep the text before the type
      if (top?.isType) headerStart = top.headerStart ?? headerStart
      else headerStart = i + 1
    } else if (c === ';') {
      headerStart = i + 1
    }
  }
  return out
}
/** The innermost function containing `index` (or a module-level pseudo function). */
function enclosing(fns, index, codeLength) {
  const around = fns.filter((f) => f.start <= index && index < f.end).sort((a, b) => b.start - a.start)
  return around[0] ?? { name: '(module)', start: 0, end: codeLength }
}
/** The text of a call's arguments starting at the `(` at `open`, up to its matching `)`. */
function callArgs(code, open) {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '(') depth++
    else if (code[i] === ')') {
      depth--
      if (depth === 0) return code.slice(open + 1, i)
    }
  }
  return code.slice(open + 1)
}
const firstArg = (args) => {
  let depth = 0
  for (let i = 0; i < args.length; i++) {
    const c = args[i]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (c === ',' && depth === 0) return args.slice(0, i)
  }
  return args
}
const lineOf = (text, index) => text.slice(0, index).split('\n').length

// ---------- R93: an id in a path is checked first ----------
const FS_PATH_OPS = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'renameSync', 'rename', 'mkdirSync', 'mkdir', 'openSync', 'open', 'readFileSync', 'readFile', 'createReadStream', 'createWriteStream', 'copyFileSync', 'copyFile', 'symlinkSync', 'unlinkSync', 'unlink', 'rmSync', 'rm', 'readdirSync', 'readdir']
const GRAMMAR_CHECKS = ['AiJobIdSchema', 'KEY', 'assertSafe', 'realInside']
const ID_LIKE = /\b(?:id|jobId|name|key|file|fileName|filename|fingerprint|rel|tmp|staging|d|f|n)\b/i
const READ_OPS = new Set(['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open', 'readdirSync', 'readdir'])
const FS_CALL = new RegExp(`\\b(?:fs|fsp|fsPromises|fs\\.promises)\\.(${FS_PATH_OPS.join('|')})\\s*\\(`, 'g')

/** R93 problems for one file. */
function r93(file) {
  const code = blank(file.text)
  const fns = functions(code)
  const raw = file.text.split('\n')
  const problems = new Set()
  for (const m of code.matchAll(FS_CALL)) {
    const open = m.index + m[0].length - 1
    const arg = firstArg(callArgs(code, open)).trim()
    // a path with no id-like variable in it (a folder from config, a literal) carries no id
    if (!ID_LIKE.test(arg.replace(/(['"`])(?:(?!\1).)*\1/g, (q) => (q.includes('${') ? q : '')))) continue
    // the safe reader is the grammar's own seat; repo data files are never another process's ids
    if (file.rel === 'src/core/safe-read.ts') continue
    if (READ_OPS.has(m[1]) && REPO_DATA.some((a) => a.file === file.rel)) continue
    const line = lineOf(code, m.index)
    const note = /\/\/\s*fs-safe:\s*\S/.test(raw[line - 2] ?? '')
    if (note) continue
    const fn = enclosing(fns, m.index, code.length)
    const before = code.slice(fn.start, m.index)
    const checked = GRAMMAR_CHECKS.some((g) => new RegExp(`\\b${g}\\b`).test(before))
    if (!checked) problems.add(`${file.rel} ${fn.name}: fs.${m[1]} with a non-literal path and no grammar check (${GRAMMAR_CHECKS.join(', ')}) first (R93)`)
  }
  return [...problems]
}

// ---------- R94: file reads go through readRegularFile; names from a folder are logged quoted ----------
const READS = ['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open']
const READ_CALL = new RegExp(`\\b(?:fs|fsp|fsPromises|fs\\.promises)\\.(${READS.join('|')})\\s*\\(`, 'g')
/** Files that read repo data (never another process's folder), each with its reason. */
const REPO_DATA = [
  { file: 'src/core/db/index.ts', why: 'the committed SQL files of the schema folder' },
  { file: 'src/modules/ocr/recorded/index.ts', why: '__recordings__ (committed recorded answers)' },
  { file: 'src/modules/gaps/bank/index.ts', why: 'the gaps bank under data/ (committed)' },
  { file: 'src/modules/ai/runner/schemas.ts', why: 'readUtf8: __recordings__ and data/ai/approved.json (committed)' },
  { file: 'src/core/safe-read.ts', why: 'the safe reader itself' },
]
const LOG_CALL = /\b(?:sink|log|logger\.\w+|console\.\w+|logOnce)\s*\(|\bnew Error\s*\(|\bthrow\s/

/** R94 problems for one file. */
function r94(file) {
  const code = blank(file.text)
  const fns = functions(code)
  const problems = new Set()
  if (!REPO_DATA.some((a) => a.file === file.rel)) {
    for (const m of code.matchAll(READ_CALL)) {
      const fn = enclosing(fns, m.index, code.length)
      problems.add(`${file.rel} ${fn.name}: fs.${m[1]} reads a file without readRegularFile (R94)`)
    }
  }
  // a name taken from a folder listing must be quoted (JSON.stringify) where it is logged
  for (const m of code.matchAll(/for\s*\(\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s+of\s+[^)]*\breaddir(?:Sync)?\s*\(/g)) {
    const open = code.indexOf('{', m.index + m[0].length)
    const close = matchBrace(code, open)
    const body = code.slice(open, close)
    const v = m[1]
    for (const t of body.matchAll(/`[^`]*\$\{([^}]*)\}[^`]*`/g)) {
      const hole = t[1].trim()
      if (hole !== v) continue
      const around = body.slice(Math.max(0, t.index - 80), t.index)
      if (LOG_CALL.test(around)) problems.add(`${file.rel}: a name from a folder listing (${v}) is logged without JSON.stringify (R94)`)
    }
  }
  return [...problems]
}
function matchBrace(code, open) {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return code.length
}

// ---------- R95: a loop that sleeps checks a deadline or abort signal inside the loop ----------
const LOOP_HEAD = /\b(?:for\s*\([^)]*\)|while\s*\([^)]*\)|do)\s*\{/g
const SLEEPS = /\bawait\s+(?:[\w.]*sleep|[\w.]*delay|[\w.]*wait)\s*\(|\bawait\s+new Promise|\bsetTimeout\s*\(|\bawait\s+(?:timers\/promises|setTimeoutPromise)\b/
const BOUNDS = /\b(?:deadline|signal|aborted|abort|timeout|expires?|expiry|until|maxWait|maxPolls|attempts?)\b/i

/** R95 problems for one file. */
function r95(file) {
  const code = blank(file.text)
  const fns = functions(code)
  const problems = new Set()
  for (const m of code.matchAll(LOOP_HEAD)) {
    const open = m.index + m[0].length - 1
    const body = code.slice(m.index, matchBrace(code, open))
    if (!SLEEPS.test(code.slice(open, matchBrace(code, open)))) continue
    if (BOUNDS.test(body)) continue
    const fn = enclosing(fns, m.index, code.length)
    problems.add(`${file.rel} ${fn.name}: a loop that waits has no deadline or abort check inside it (R95)`)
  }
  return [...problems]
}

// ---------- R96: a child process has a timeout and is stopped by its own PID ----------
const SPAWNS = /\b(spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\s*\(/g
const HAS_CHILD = /\bchild_process\b/
const BY_NAME = /\b(?:pkill|killall|taskkill)\b/

/** R96 problems for one file. */
function r96(file) {
  const problems = new Set()
  const withStrings = file.text
  if (!HAS_CHILD.test(withStrings)) return []
  const code = blank(withStrings)
  const fns = functions(code)
  for (const m of code.matchAll(SPAWNS)) {
    const open = m.index + m[0].length - 1
    const args = callArgs(code, open)
    const fn = enclosing(fns, m.index, code.length)
    if (!/\btimeout\b/.test(args)) problems.add(`${file.rel} ${fn.name}: ${m[1]} with no timeout option (R96)`)
  }
  if (BY_NAME.test(withStrings)) problems.add(`${file.rel}: a process is stopped by name (pkill, killall or taskkill) (R96)`)
  return [...problems]
}

// ---------- R97: isTest or is_test is written into a job only in src/pipeline/** ----------
const FLAG_KEY = /(?<![\w$.])(isTest|is_test)\s*:\s*([^,};\n]*)/g
const FLAG_ASSIGN = /\.(isTest|is_test)\s*=(?!=)/g

/** R97 problems for one file. */
function r97(file) {
  if (file.rel.startsWith('src/pipeline/') || file.rel.startsWith('src/contracts/')) return []
  const code = blank(file.text)
  const fns = functions(code)
  const problems = new Set()
  for (const m of code.matchAll(FLAG_KEY)) {
    const value = m[2].trim()
    // a schema names the key; a copy of another object's own flag does not set it
    if (value.startsWith('z.') || value === 'boolean' || /^[\w$]+\.(?:isTest|is_test)$/.test(value)) continue
    const fn = enclosing(fns, m.index, code.length)
    problems.add(`${file.rel} ${fn.name}: ${m[1]} is written outside src/pipeline (R97)`)
  }
  for (const m of code.matchAll(FLAG_ASSIGN)) {
    const fn = enclosing(fns, m.index, code.length)
    problems.add(`${file.rel} ${fn.name}: ${m[1]} is assigned outside src/pipeline (R97)`)
  }
  return [...problems]
}

// ---------- functions, strictly (R104 to R106) ----------
// `functions` above misses a body after an object-type return (`): { ok: true } | { ok: false } {`) and counts some
// control blocks in code without semicolons. These rules find bodies from the other end: a `{` straight after `=>`, or
// after a parameter list `name(...)` (name not a keyword) and its optional return type.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'await', 'else', 'do', 'try', 'finally', 'new', 'in', 'of', 'yield', 'void'])
const ITERATES = /\.(?:forEach|map|flatMap|filter|reduce|some|every|find|findIndex|sort)\s*\(\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]*)?$/
function matchParen(code, open) {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '(') depth++
    else if (code[i] === ')' && --depth === 0) return i + 1
  }
  return code.length
}
/** From just after a return type's colon: the index of the body's `{`, or -1 when this is no function body. */
function bodyAfterType(code, from) {
  let depth = 0
  let prev = ':'
  for (let j = from; j < code.length; j++) {
    const c = code[j]
    if (/\s/.test(c)) continue
    if (c === '=' && code[j + 1] === '>') {
      if (depth === 0) return -1
      j++
      prev = '>'
      continue
    }
    if ('([<'.includes(c)) depth++
    else if (')]>'.includes(c)) depth--
    else if (c === '{') {
      if (depth === 0 && /[\w$\])}>]/.test(prev)) return j
      j = matchBrace(code, j) - 1
      prev = '}'
      continue
    } else if (depth === 0 && ';,=}'.includes(c)) return -1
    if (depth < 0) return -1
    prev = c
  }
  return -1
}
/** Function bodies: `{ name, start, end, iterates }`; `iterates` marks an arrow passed straight to forEach, map and the like. */
function realFunctions(code) {
  const out = new Map()
  for (const m of code.matchAll(/=>\s*\{/g)) {
    const start = m.index + m[0].length - 1
    const lineText = code.slice(code.lastIndexOf('\n', m.index) + 1, m.index)
    const name = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(lineText)?.[1] ?? /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*:/.exec(lineText)?.[1] ?? '(anonymous)'
    // the arrow's own parameter list, then what it is passed to
    const before = code.slice(Math.max(0, m.index - 300), m.index)
    out.set(start, { name, start, end: matchBrace(code, start), iterates: ITERATES.test(before.trimEnd()) })
  }
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*\(/g)) {
    // a keyword's parentheses, or a method called on something (`x.matchAll(`), never open a body
    if (KEYWORDS.has(m[1]) || /\.\s*$/.test(code.slice(Math.max(0, m.index - 4), m.index))) continue
    const close = matchParen(code, m.index + m[0].length - 1)
    let k = close
    while (k < code.length && /\s/.test(code[k])) k++
    const start = code[k] === '{' ? k : code[k] === ':' ? bodyAfterType(code, k + 1) : -1
    if (start === -1 || out.has(start)) continue
    out.set(start, { name: m[1] === 'function' ? '(anonymous)' : m[1], start, end: matchBrace(code, start), iterates: false })
  }
  return [...out.values()]
}

// ---------- R104: a set, map or log that grows across calls has a cap from data ----------
// Long-lived means it outlives the call that grows it: declared at module level, as a class field, inside a factory
// (create* or make*) and grown in a function the factory returns, or a Set or Map field of an interface or type that a
// function grows (a container handed in from outside, as the runner hands `seen` to the engines). Capped means the file
// compares its size or length with a named limit, or evicts from it (delete, clear, shift, pop, splice). A container
// bounded some other way carries `// R104 bounded: <reason>` on its declaration line or the line before.
const GROWS = 'add|set|push|unshift'
const EVICTS = 'delete|clear|shift|pop|splice'
const R104_MARK = /\/\/\s*R104 bounded:\s*\w\w/
const reEsc = (s) => s.replace(/[$]/g, '\\$')

/** Long-lived containers declared in one file: `{ name, kind, at, owner, receiver }`. */
function containers(code) {
  const fns = realFunctions(code)
  const out = []
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(new\s+(Set|Map)\b|\[\s*\])/g)) {
    const owner = enclosing(fns, m.index, code.length)
    if (owner.name !== '(module)' && !/^(?:create|make)[A-Z]/.test(owner.name)) continue
    out.push({ name: m[1], kind: m[3] ?? 'array', at: m.index, owner, receiver: 'bare' })
  }
  for (const m of code.matchAll(/^[ \t]*(?:(?:private|public|protected|readonly|static)\s+)+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(new\s+(Set|Map)\b|\[\s*\])/gm)) {
    out.push({ name: m[1], kind: m[3] ?? 'array', at: m.index, owner: { name: '(class)', start: -1, end: -1 }, receiver: 'this' })
  }
  for (const t of code.matchAll(/\b(?:interface\s+[A-Za-z_$][\w$]*(?:\s+extends[^{]*)?|type\s+[A-Za-z_$][\w$]*\s*=)\s*\{/g)) {
    const open = t.index + t[0].length - 1
    const body = code.slice(open, matchBrace(code, open))
    for (const f of body.matchAll(/^[ \t]*([A-Za-z_$][\w$]*)\??\s*:\s*(Set|Map)</gm)) {
      out.push({ name: f[1], kind: f[2], at: open + f.index, owner: { name: '(type)', start: -1, end: -1 }, receiver: 'field' })
    }
  }
  return out
}

/** R104 problems for one file. */
function r104(file) {
  const code = blank(file.text)
  const fns = realFunctions(code)
  const raw = file.text.split('\n')
  const problems = new Set()
  for (const c of containers(code)) {
    const n = reEsc(c.name)
    const ref = c.receiver === 'bare' ? `(?<![\\w$.])${n}` : c.receiver === 'this' ? `\\bthis\\.${n}` : `\\.${n}`
    // growth counts when it sits in a function that runs later (per poll, per file, per call): not in the declaring
    // call itself, not at module level, and not only in a callback handed straight to forEach, map and the like
    const grows = [...code.matchAll(new RegExp(`${ref}\\.(?:${GROWS})\\s*\\(`, 'g'))]
      .map((g) => fns.filter((f) => f.start <= g.index && g.index < f.end && f.start > c.owner.start).sort((x, y) => y.start - x.start))
      .map((chain) => chain.find((f) => !f.iterates))
      .filter((fn) => fn !== undefined)
    if (grows.length === 0) continue
    const sized = new RegExp(`${ref}\\.(?:size|length)\\s*(?:>=|>|<=|<|===|!==)\\s*[A-Za-z_$]|[A-Za-z_$][\\w$.]*\\s*(?:>=|>|<=|<)\\s*${ref.replace('(?<![\\w$.])', '\\b')}\\.(?:size|length)\\b`)
    const evicted = new RegExp(`${ref}\\.(?:${EVICTS})\\s*\\(`)
    if (sized.test(code) || evicted.test(code)) continue
    const line = lineOf(code, c.at)
    if (R104_MARK.test(raw[line - 1] ?? '') || R104_MARK.test(raw[line - 2] ?? '')) continue
    problems.add(`${file.rel} ${c.name}: ${c.kind === 'array' ? 'an array' : `a ${c.kind}`} that grows in ${grows[0].name} has no cap from data (R104)`)
  }
  return [...problems]
}

// ---------- R105: one clock in src (src/core/clock.ts) ----------
const CLOCK_HOME = 'src/core/clock.ts'
const SQL_CLOCK = /\b(now\s*\(\s*\)|current_timestamp|localtimestamp|clock_timestamp\s*\(\s*\)|statement_timestamp\s*\(\s*\)|transaction_timestamp\s*\(\s*\))/gi
const CTX_NOW = /\bctx\.now\b(?!\s*\()/
const OTHER_CLOCK = /(?<![\w$.])now\s*\(\s*\)|\b(?!ctx\b)[A-Za-z_$][\w$]*\.now\s*\(\s*\)|\bnew\s+Date\s*\(\s*\)|\bgetClock\s*\(/

/** R105 problems for one file. */
function r105(file) {
  if (file.rel === CLOCK_HOME) return []
  const code = blank(file.text)
  const strs = blank(file.text, true)
  const fns = realFunctions(code)
  const problems = new Set()
  const at = (i) => `${file.rel} ${enclosing(fns, i, code.length).name}`
  for (const m of code.matchAll(/\bnew\s+Date\s*\(\s*\)/g)) problems.add(`${at(m.index)}: new Date() with no argument reads the system clock outside ${CLOCK_HOME} (R105)`)
  for (const m of code.matchAll(/\bDate\.now\s*\(\s*\)/g)) problems.add(`${at(m.index)}: Date.now() reads the system clock outside ${CLOCK_HOME} (R105)`)
  for (const m of strs.matchAll(SQL_CLOCK)) {
    // only inside a string or template literal: code there is blanked to spaces
    if (code[m.index] !== ' ') continue
    problems.add(`${at(m.index)}: SQL ${m[1].replace(/\s+/g, '').toLowerCase()} in a query reads the database clock (R105)`)
  }
  // a function that reads ctx.now (the queue's snapshot) and another clock compares two clocks
  const mixed = fns.filter((f) => {
    const body = code.slice(f.start, f.end)
    const other = body.replace(new RegExp(CTX_NOW.source, 'g'), ' ')
    return CTX_NOW.test(body) && OTHER_CLOCK.test(other)
  })
  for (const f of mixed) {
    if (mixed.some((g) => g !== f && g.start > f.start && g.end <= f.end)) continue
    problems.add(`${file.rel} ${f.name}: reads ctx.now and another clock in one function (R105)`)
  }
  // a deadline built from ctx.now is compared later with a clock that ticks
  const lines = code.split('\n')
  lines.forEach((l, i) => {
    if (CTX_NOW.test(l) && /deadline/i.test(l)) {
      const index = lines.slice(0, i).join('\n').length + 1 + l.search(CTX_NOW)
      problems.add(`${at(index)}: builds a deadline from ctx.now, a snapshot that cannot tick (R105)`)
    }
  })
  return [...problems]
}

// ---------- R106: every clock-taking factory called in a test gets a clock ----------
const R106_MARK = /R106 exception:\s*\w\w/
const splitTop = (args) => {
  const parts = []
  let depth = 0
  let from = 0
  for (let i = 0; i < args.length; i++) {
    const c = args[i]
    if ('([{<'.includes(c)) depth++
    else if (')]}>'.includes(c) && args[i - 1] !== '=') depth--
    else if (c === ',' && depth === 0) {
      parts.push(args.slice(from, i))
      from = i + 1
    }
  }
  parts.push(args.slice(from))
  return parts.map((p) => p.trim()).filter((p) => p !== '')
}

/** Clock-taking factories, derived from the product code (never a hand list): an exported create* or make* function
 *  with a parameter named clock or now, or whose parameter's interface or type (same file) has a now or clock field. */
function clockFactories(files) {
  const out = new Map()
  for (const f of files) {
    const code = blank(f.text)
    for (const m of code.matchAll(/export\s+(?:async\s+)?function\s+((?:create|make)[A-Z][\w$]*)\s*(?:<[^>(]*>)?\s*\(/g)) {
      const open = m.index + m[0].length - 1
      splitTop(callArgs(code, open)).forEach((p, index) => {
        const pm = /^([A-Za-z_$][\w$]*)\??\s*(?::\s*([A-Za-z_$][\w$]*))?/.exec(p)
        if (!pm) return
        if (/^(?:clock|now)$/.test(pm[1])) {
          out.set(m[1], { file: f.rel, index, param: pm[1] })
          return
        }
        if (!pm[2]) return
        const decl = new RegExp(`\\b(?:interface\\s+${reEsc(pm[2])}(?:\\s+extends[^{]*)?|type\\s+${reEsc(pm[2])}\\s*=)\\s*\\{`).exec(code)
        if (!decl) return
        const bodyOpen = decl.index + decl[0].length - 1
        const field = /^[ \t]*(?:readonly\s+)?(now|clock)\??\s*:/m.exec(code.slice(bodyOpen, matchBrace(code, bodyOpen)))
        if (field) out.set(m[1], { file: f.rel, index, param: `${pm[2]}.${field[1]}` })
      })
    }
  }
  return out
}

const testFiles = () =>
  walk('src')
    .filter((f) => /\.test\.tsx?$/.test(f))
    .map((rel) => ({ rel, text: read(rel) }))

/** The object literal text an options argument stands for (a literal, or a `const` of one earlier in the file). */
function optionsText(code, arg, before) {
  if (arg.startsWith('{')) return arg
  if (!/^[A-Za-z_$][\w$]*$/.test(arg)) return arg
  const decls = [...code.slice(0, before).matchAll(new RegExp(`\\b(?:const|let)\\s+${reEsc(arg)}\\s*(?::[^=;]+)?=\\s*\\{`, 'g'))]
  const d = decls.at(-1)
  if (!d) return arg
  const open = d.index + d[0].length - 1
  return code.slice(open, matchBrace(code, open))
}
/** Contiguous comment lines straight above line `n` (1-based). */
function commentAbove(raw, n) {
  const out = []
  for (let i = n - 2; i >= 0 && /^\s*(?:\/\/|\/\*|\*)/.test(raw[i]); i--) out.push(raw[i])
  return out.join('\n')
}

/** R106 problems for one test file, given the factories. */
function r106(file, factories) {
  const code = blank(file.text)
  const fns = realFunctions(code)
  const raw = file.text.split('\n')
  const problems = new Set()
  for (const [name, fac] of factories) {
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${reEsc(name)}\\s*\\(`, 'g'))) {
      if (/\bfunction\s+$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue
      const open = m.index + m[0].length - 1
      const args = splitTop(callArgs(code, open))
      const arg = args[fac.index]
      const pinned = arg !== undefined && (/^(?:clock|now)$/.test(fac.param) || /\b(?:now|clock)\b/.test(optionsText(code, arg, m.index)))
      if (pinned) continue
      const line = lineOf(code, m.index)
      const fn = enclosing(fns, m.index, code.length)
      const marked = R106_MARK.test(raw[line - 1]) || R106_MARK.test(commentAbove(raw, line)) || (fn.name !== '(module)' && R106_MARK.test(commentAbove(raw, lineOf(code, fn.start))))
      if (marked) continue
      problems.add(`${file.rel}:${String(line)} ${name}(...) with no ${fac.param} (R106)`)
    }
  }
  return [...problems]
}

// ---------- the tests ----------
const planted = (rel, text) => ({ rel, text })
const SENTINELS = ['src/modules/ai/runner/engines.ts', 'src/core/safe-read.ts', 'src/modules/storage/files/index.ts']

function scan(rule, fn) {
  const files = productFiles()
  const rels = files.map((f) => f.rel)
  expect(files.length, `${rule}: no product file read`).toBeGreaterThan(20)
  for (const s of SENTINELS) expect(rels, `${rule}: sentinel ${s} not scanned`).toContain(s)
  return onlyKnown(rule, files.flatMap((f) => fn(f)))
}

describe('R93 an id in a path is checked by a named grammar first', () => {
  test('R93 SEC-10 the planted unchecked write to inbox/<id>.json is caught, by function and call', () => {
    expect(r93(planted('src/x/queue.ts', fix('planted-r93-unchecked-write.ts.txt')))).toEqual([
      'src/x/queue.ts queueJob: fs.writeFileSync with a non-literal path and no grammar check (AiJobIdSchema, KEY, assertSafe, realInside) first (R93)',
    ])
  })
  test('R93 SEC-10 a check that comes after the write does not count', () => {
    expect(r93(planted('src/x/store.ts', fix('planted-r93-late-check.ts.txt')))).toHaveLength(1)
  })
  test('R93 the clean example (checked id, literal path) has no problem', () => {
    expect(r93(planted('src/x/queue.ts', fix('clean-r93-checked-write.ts.txt')))).toEqual([])
  })
  test('R93 a line comment "fs-safe: reason" on the line before excuses one call, and a bare one does not', () => {
    const base = "import fs from 'node:fs'\nexport function a(name: string): void {\n"
    expect(r93(planted('src/x/a.ts', `${base}  // fs-safe: name is a literal from our config\n  fs.mkdirSync(name)\n}\n`))).toEqual([])
    expect(r93(planted('src/x/a.ts', `${base}  // fs-safe:\n  fs.mkdirSync(name)\n}\n`))).toHaveLength(1)
  })
  test('R93 every product file on main: only KNOWN problems', () => {
    expect(scan('R93', r93)).toEqual([])
  })
})

describe('R94 every file read goes through readRegularFile and listing names are logged quoted', () => {
  test('R94 ARC-22 the planted raw read of an outbox path is caught', () => {
    expect(r94(planted('src/x/read.ts', fix('planted-r94-raw-read.ts.txt')))).toEqual(['src/x/read.ts readResult: fs.readFileSync reads a file without readRegularFile (R94)'])
  })
  test('R94 SEC-10 the planted unquoted name from a folder listing is caught', () => {
    expect(r94(planted('src/x/scan.ts', fix('planted-r94-unquoted-name.ts.txt')))).toEqual(['src/x/scan.ts: a name from a folder listing (name) is logged without JSON.stringify (R94)'])
  })
  test('R94 the clean example (readRegularFile, quoted name) has no problem', () => {
    expect(r94(planted('src/x/scan.ts', fix('clean-r94-safe-read.ts.txt')))).toEqual([])
  })
  test('R94 a read in an allowlisted repo-data file is not a problem, and the allowlist names its reasons', () => {
    expect(r94(planted('src/core/db/index.ts', fix('planted-r94-raw-read.ts.txt')))).toEqual([])
    for (const a of REPO_DATA) {
      expect(a.why.length, a.file).toBeGreaterThan(8)
      expect(fs.existsSync(path.join(ROOT, a.file)), `${a.file} is on the allowlist but missing`).toBe(true)
    }
  })
  test('R94 every product file on main: only KNOWN problems', () => {
    expect(scan('R94', r94)).toEqual([])
  })
})

describe('R95 a loop that waits checks a deadline or abort signal inside the loop', () => {
  test('R95 ARC-22 the planted endless wait is caught', () => {
    expect(r95(planted('src/x/wait.ts', fix('planted-r95-endless-wait.ts.txt')))).toEqual(['src/x/wait.ts waitFor: a loop that waits has no deadline or abort check inside it (R95)'])
  })
  test('R95 the clean example (deadline in the loop; a loop that never waits) has no problem', () => {
    expect(r95(planted('src/x/wait.ts', fix('clean-r95-deadline.ts.txt')))).toEqual([])
  })
  test('R95 a deadline named only outside the loop does not count', () => {
    const text = 'export async function f(deadline: number): Promise<void> {\n  console.log(deadline)\n  while (true) {\n    await sleep(5)\n  }\n}\n'
    expect(r95(planted('src/x/w.ts', text))).toHaveLength(1)
  })
  test('R95 every product file on main: only KNOWN problems', () => {
    expect(scan('R95', r95)).toEqual([])
  })
})

describe('R96 a child process has a timeout and is stopped by its own PID, never by name', () => {
  test('R96 the planted spawn with no timeout and the stop by name are both caught', () => {
    expect(r96(planted('src/x/launch.ts', fix('planted-r96-spawn.ts.txt')))).toEqual([
      'src/x/launch.ts launch: spawn with no timeout option (R96)',
      'src/x/launch.ts stop: execSync with no timeout option (R96)',
      'src/x/launch.ts: a process is stopped by name (pkill, killall or taskkill) (R96)',
    ])
  })
  test('R96 the clean example (timeout, own PID) has no problem', () => {
    expect(r96(planted('src/x/launch.ts', fix('clean-r96-spawn.ts.txt')))).toEqual([])
  })
  test('R96 every product file on main: only KNOWN problems', () => {
    expect(scan('R96', r96)).toEqual([])
  })
})

describe('R97 isTest and is_test are written into a job only in src/pipeline', () => {
  test('R97 SEC-11 the planted step module that builds { isTest: true } is caught, and so is a row key', () => {
    expect(r97(planted('src/modules/x/step.ts', fix('planted-r97-set-is-test.ts.txt')))).toEqual([
      'src/modules/x/step.ts buildJob: isTest is written outside src/pipeline (R97)',
      'src/modules/x/step.ts buildRow: is_test is written outside src/pipeline (R97)',
    ])
  })
  test('R97 the same text under src/pipeline is allowed', () => {
    expect(r97(planted('src/pipeline/step.ts', fix('planted-r97-set-is-test.ts.txt')))).toEqual([])
  })
  test('R97 a schema key and a copy of a job\'s own flag are not setting it', () => {
    expect(r97(planted('src/modules/x/y.ts', fix('clean-r97-copy-is-test.ts.txt')))).toEqual([])
  })
  test('R97 an assignment to the flag is caught', () => {
    expect(r97(planted('src/modules/x/y.ts', 'export function f(job: { isTest: boolean }): void {\n  job.isTest = true\n}\n'))).toHaveLength(1)
  })
  test('R97 every product file on main: only KNOWN problems', () => {
    expect(scan('R97', r97)).toEqual([])
  })
})

describe('R104 a set, map or log that grows per poll or per file has a cap from data', () => {
  test('R104 SEC-10 the planted uncapped containers are caught: a factory seen Set, a handed-in seen field, a module log, a class cache', () => {
    expect(r104(planted('src/x/watch.ts', fix('planted-r104-growing.ts.txt')))).toEqual([
      'src/x/watch.ts lines: an array that grows in remember has no cap from data (R104)',
      'src/x/watch.ts seen: a Set that grows in poll has no cap from data (R104)',
      'src/x/watch.ts byFingerprint: a Map that grows in read has no cap from data (R104)',
      'src/x/watch.ts seen: a Set that grows in logOnce has no cap from data (R104)',
    ])
  })
  test('R104 the clean example (a cap from data, eviction, filled once, a reasoned marker, a local list) has no problem', () => {
    expect(r104(planted('src/x/watch.ts', fix('clean-r104-capped.ts.txt')))).toEqual([])
  })
  test('R104 a cap written as a bare number is not a cap from data, and a marker with no reason does not count', () => {
    const grow = (head) => `export function createW() {\n${head}\n  return { poll(n: string): void {\n    if (seen.size >= 1000) return\n    seen.add(n)\n  } }\n}\n`
    expect(r104(planted('src/x/w.ts', grow('  const seen = new Set<string>()')))).toEqual(['src/x/w.ts seen: a Set that grows in poll has no cap from data (R104)'])
    expect(r104(planted('src/x/w.ts', grow('  // R104 bounded:\n  const seen = new Set<string>()')))).toHaveLength(1)
    expect(r104(planted('src/x/w.ts', grow('  // R104 bounded: names come from a fixed list of three\n  const seen = new Set<string>()')))).toEqual([])
  })
  test('R104 a function body after an object-type return is still a function (A04 round 5: the factory owns its containers)', () => {
    const text = 'export function createW(): { poll(n: string): void } | { off: true } {\n  const seen = new Set<string>()\n  return { poll(n: string): void {\n    seen.add(n)\n  } }\n}\n'
    expect(r104(planted('src/x/w.ts', text))).toEqual(['src/x/w.ts seen: a Set that grows in poll has no cap from data (R104)'])
  })
  test('R104 every product file on main: only KNOWN problems', () => {
    expect(scan('R104', r104)).toEqual([])
  })
})

describe('R105 one clock in src: src/core/clock.ts', () => {
  test('R105 ARC-22 the planted handler that builds a deadline from ctx.now and waits on Date.now() is caught three ways', () => {
    expect(r105(planted('src/x/handler.ts', fix('planted-r105-two-clocks.ts.txt')))).toEqual([
      'src/x/handler.ts run: Date.now() reads the system clock outside src/core/clock.ts (R105)',
      'src/x/handler.ts run: reads ctx.now and another clock in one function (R105)',
      'src/x/handler.ts run: builds a deadline from ctx.now, a snapshot that cannot tick (R105)',
    ])
  })
  test('R105 ARC-22 A04 round 5\'s handler, a deadline from ctx.now handed to a runner on its own clock, is caught', () => {
    expect(r105(planted('src/x/handler.ts', fix('planted-r105-ctx-deadline.ts.txt')))).toEqual([
      'src/x/handler.ts run: builds a deadline from ctx.now, a snapshot that cannot tick (R105)',
    ])
  })
  test('R105 A04 round 5\'s factory default to the system clock (options.now ?? (() => new Date())) is caught', () => {
    expect(r105(planted('src/x/poller.ts', fix('planted-r105-default-clock.ts.txt')))).toEqual([
      'src/x/poller.ts createPoller: new Date() with no argument reads the system clock outside src/core/clock.ts (R105)',
    ])
  })
  test('R105 SQL now() and current_timestamp in a query are caught, in quotes and in a template', () => {
    expect(r105(planted('src/x/jobs.ts', fix('planted-r105-sql-now.ts.txt')))).toEqual([
      'src/x/jobs.ts dueJobs: SQL now() in a query reads the database clock (R105)',
      'src/x/jobs.ts touch: SQL current_timestamp in a query reads the database clock (R105)',
    ])
  })
  test('R105 the clean example (core now(), dated new Date(x), the engines\' one-clock check, a passed time) has no problem', () => {
    expect(r105(planted('src/x/clean.ts', fix('clean-r105-one-clock.ts.txt')))).toEqual([])
  })
  test('R105 src/core/clock.ts itself may read the system clock, and nowhere else may', () => {
    const text = 'export const systemClock = { now: () => new Date() }\nexport const ms = (): number => Date.now()\n'
    expect(r105(planted('src/core/clock.ts', text))).toEqual([])
    expect(r105(planted('src/core/other.ts', text))).toEqual([
      'src/core/other.ts (module): new Date() with no argument reads the system clock outside src/core/clock.ts (R105)',
      'src/core/other.ts (module): Date.now() reads the system clock outside src/core/clock.ts (R105)',
    ])
  })
  test('R105 every product file on main: only KNOWN problems (none once A04 round 5c lands)', () => {
    expect(scan('R105', r105)).toEqual([])
  })
})

describe('R106 every clock-taking factory called in a test gets a clock', () => {
  const factories = () => clockFactories(productFiles())
  test('R106 the clock-taking factories come from the product code, the runner and the queue among them', () => {
    const got = factories()
    expect(got.get('createAiRunner')).toEqual({ file: 'src/modules/ai/runner/runner.ts', index: 0, param: 'AiRunnerOptions.now' })
    expect(got.get('createJobQueue')).toEqual({ file: 'src/modules/jobs/queue.ts', index: 1, param: 'clock' })
    expect(got.get('createRunner')?.param).toBe('RunnerOptions.clock')
    expect(got.get('createLifecycle')?.param).toBe('LifecycleOptions.clock')
    expect(got.get('createTestUsersAuth')?.param).toBe('TestUsersOptions.clock')
  })
  test('R106 ARC-15 the planted round 4 helper (no now beside a fixed ctx.now), a queue with no clock and a bare marker are caught', () => {
    expect(r106(planted('src/x/plant.test.ts', fix('planted-r106-unpinned.test.ts.txt')), factories()).sort()).toEqual([
      'src/x/plant.test.ts:12 createJobQueue(...) with no clock (R106)',
      'src/x/plant.test.ts:14 createAiRunner(...) with no AiRunnerOptions.now (R106)',
      'src/x/plant.test.ts:8 createAiRunner(...) with no AiRunnerOptions.now (R106)',
    ])
  })
  test('R106 the clean example (now or clock passed, by key, shorthand or options const; a reasoned marker on the call line, above the call or on the helper) has no problem', () => {
    expect(r106(planted('src/x/clean.test.ts', fix('clean-r106-pinned.test.ts.txt')), factories())).toEqual([])
  })
  test('R106 a marker two lines up with code between does not count (A472: the marker sits on the call or its helper)', () => {
    const text = "test('x', () => {\n  // R106 exception: the default clock\n  const a = 1\n  const r = createAiRunner({ recordingsDir: 'r' })\n  expect([a, r]).toHaveLength(2)\n})\n"
    expect(r106(planted('src/x/m.test.ts', text), factories())).toEqual(['src/x/m.test.ts:4 createAiRunner(...) with no AiRunnerOptions.now (R106)'])
  })
  test('R106 every test file under src on main: only KNOWN problems', () => {
    const files = testFiles()
    expect(files.length, 'R106: no test file read').toBeGreaterThan(20)
    expect(files.map((f) => f.rel)).toContain('src/modules/ai/runner/runner.acceptance.test.ts')
    const got = factories()
    expect(got.size, 'R106: no clock-taking factory found').toBeGreaterThan(4)
    expect(onlyKnown('R106', files.flatMap((f) => r106(f, got)))).toEqual([])
  })
})

describe('the KNOWN table', () => {
  test('every KNOWN entry names a rule, a problem and an owner card that exists and is not done', () => {
    const index = JSON.parse(read('plan/slices.json'))
    const cards = new Map((index.cards ?? index.slices ?? []).map((c) => [c.id, c]))
    for (const k of KNOWN) {
      const id = /^([A-Z]+\d*[A-Za-z]*)\b/.exec(k.owner)?.[1] ?? ''
      expect(cards.has(id), `${k.rule} owner ${k.owner}: no card ${id}`).toBe(true)
      expect(cards.get(id)?.status, `${k.rule} owner ${id} is done, so the entry should be gone`).not.toBe('done')
      expect(k.problem.length).toBeGreaterThan(10)
    }
  })
})
