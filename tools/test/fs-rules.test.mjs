// SC12: exchange and file-system rules R93 to R97 (unit project). Card plan/cards/SC12.md; clauses SEC-10, SEC-11,
// ARC-22, ARC-15. From reports/A04-findings-5.md ("Rule tests"): another process writes the exchange folders, ids go
// into paths, loops wait for ever, child processes hang, and a flag a gate trusts is set by whoever builds the job.
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
/** Comments and string literals blanked (same length, newlines kept), so scans see only code. Template text is blanked except `${...}` holes. */
function blank(src) {
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
      out += c + ' '.repeat(Math.max(0, j - i - 1)) + (src[j] === c ? c : '')
      i = j + 1
    } else if (c === '`') {
      let j = i + 1
      out += '`'
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') {
          out += '  '
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
          out += src[j] === '\n' ? '\n' : ' '
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
