// A08 round 3 acceptance tests: the launcher's side of the exchange folder, after A04 round 5 (spec-writer; builders
// never edit this file). Lead directive A446 (reports/A04-findings-5.md fix 9 and R96) and card note A498 (GL3's
// findings review 2). The shape fixed at the top of project.acceptance.test.ts holds here too; this file adds:
//
// Job ids: the id is the inbox file's stem and must pass A04's AiJobIdSchema (src/modules/ai/index.ts). A stem outside
//   it is never used as a file name: no outbox file, no per-job folder, no call (the rest of the pass goes on). A
//   content `jobId` that differs from the stem is refused at `outbox/<stem>.json`, stage 'input', the reason naming the
//   job id. A 24-hex id (core newId's shape, what F06 queues) is accepted.
// Inbox reads: each `inbox/<id>.json` is read with readRegularFile (src/core/safe-read.ts); an entry that is not a
//   regular file (a symlink, a FIFO, a folder) is never opened and is refused at stage 'input' with a reason holding
//   "not a file". node:fs is imported only as `import fs from 'node:fs'` in src/modules/ai/project/, so the
//   pass-through spies here see every open, read and write the launcher makes.
// Files the launcher makes (temp files, the per-job input copies, anything else under the exchange folder) are created
//   exclusively: flag 'wx' (or 'wx+', 'ax'), O_CREAT|O_EXCL, or COPYFILE_EXCL; never into an existing file or link.
// The `claude` child (R96): runAiProjectOnce's options gain `claudeTimeoutMs?: number` (default CLAUDE_TIMEOUT_MS,
//   exported from src/modules/ai/project/index.ts: positive, finite, and short enough that A04's wait, the lease minus
//   its 10-minute margin, outlives it). A call still running at the timeout is stopped through its own handle (its own
//   PID), never by a program name (no pkill, killall or taskkill /IM), and its job is refused at stage 'run' with a
//   reason naming the time limit; the pass goes on to the next job.
//   Write the time limit as one number (for example 900_000): `15 * 60 * 1000` reads as a five-field cron string to
//   project.acceptance.test.ts's decision 0010 timer rule.
// A498: before any call the launcher refuses (stage 'input', a reason naming AI-9) a job carrying a value of a fact
//   that E03's catalogue (data/facts/catalogue.json) marks `sin` or `birth_date`, in any of these forms: an object
//   `{ key, value }` or `{ factKey, value }` anywhere in the inputs, or an input field named by the fact key; and a job
//   holding any text after `restricted-provided` (the onboarding marker answers PY3.sin, PY3.dob, PY3.bank, BQ7.sin).
//   The launcher never masks or repairs a job: it refuses (I00 masks). The planted value reaches no call, no log line
//   and no refusal.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SENSITIVE_KINDS, loadFactCatalogue } from '../../../contracts/facts'
import { readOwnSource } from '../../../core/testing/read-own-source'
import { AI_JOB_LEASE_MS, AiJobIdSchema, OutboxRefusalSchema } from '../index'
import { AI_LEASE_MARGIN_MS } from '../runner/runner'
import { CLAUDE_TIMEOUT_MS, runAiProjectOnce } from './index'
import {
  FIXTURES_DIR,
  REPO_ROOT,
  SIN_GROUPS,
  VALID_OUTPUT,
  VALID_TEXT,
  callsFor,
  inboxJob,
  inputHashOf,
  listTree,
  makeWorld,
  markerOf,
  outboxOf,
  watchNames,
  type FakeControl,
  type FakeFailure,
  type Json,
  type World,
} from './__fixtures__/harness'

const SLOW = { timeout: 60_000 }
/** True on Windows, where the FIFO and symlink cases are skipped by name (they run on the Linux cloud box). */
const onWin32 = process.platform === 'win32'

let worlds: World[] = []
const started: ChildProcess[] = []

/** True while a process with this id exists (EPERM: it exists but is not ours to signal). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  // Stop, by their own ids, the processes these tests started (the decoys) and any fake the launcher left running.
  for (const child of started.splice(0)) if (child.pid !== undefined && alive(child.pid)) child.kill()
  for (const w of worlds) {
    for (const c of w.calls()) if (alive(c.pid)) process.kill(c.pid)
    w.cleanup()
  }
  worlds = []
})

function world(...args: Parameters<typeof makeWorld>): World {
  const w = makeWorld(...args)
  worlds.push(w)
  return w
}

interface Run {
  result: { ok: boolean; reason?: string }
  lines: string[]
}

async function runOnce(w: World, extra: { claudeTimeoutMs?: number; env?: Record<string, string | undefined> } = {}): Promise<Run> {
  const lines: string[] = []
  const result = (await runAiProjectOnce({
    argv: [],
    env: w.env,
    approvedPath: w.approvedPath,
    sink: (line: string) => {
      lines.push(line)
    },
    ...extra,
  })) as { ok: boolean; reason?: string }
  return { result, lines }
}

async function within<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out: ${label}`))
    }, ms)
  })
  try {
    return await Promise.race([p, late])
  } finally {
    clearTimeout(timer)
  }
}

type Stage = 'input' | 'run' | 'output'
/** A job's outbox refusal: exactly A04's OutboxRefusalSchema, for this file's own job id. */
function refusalOf(w: World, stem: string): { reason: string; problems: string[]; stage: Stage } {
  const file = outboxOf(w, stem)
  const parsed = OutboxRefusalSchema.safeParse(file)
  expect(parsed.success, `${stem}: not A04's refusal shape: ${JSON.stringify(file)}`).toBe(true)
  expect(file['jobId'], `${stem}: the refusal names the file's own job id`).toBe(stem)
  return file['refusal'] as { reason: string; problems: string[]; stage: Stage }
}

/** A clean job (from c01-clean) with its own marker and id, its input hash recomputed. */
function cleanJob(variant: string, jobId: string, change: (j: Json) => void = () => undefined): Json {
  const j = inboxJob('c01-clean')
  const inputs = j['inputs'] as { documents: { text: string }[]; variant: string }
  const doc = inputs.documents[0]
  if (doc) doc.text = `Aurora Card (Test) statement, meals total 1,850.00 (${variant})`
  inputs.variant = variant
  j['jobId'] = jobId
  change(j)
  j['inputHash'] = inputHashOf(j['inputs'])
  return j
}

const writeJob = (dir: string, fileName: string, j: Json): void => {
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(j, null, 2) + '\n')
}
const callsHolding = (w: World, needle: string): number => w.calls().filter((c) => JSON.stringify(c).includes(needle)).length
const outboxNames = (w: World): string[] => (fs.existsSync(w.outbox) ? fs.readdirSync(w.outbox).sort() : [])

// ---------- SEC-10: the job id is A04's, and it is the file name's ----------

describe("SEC-10 job ids are A04's AiJobIdSchema and come from the inbox file name", SLOW, () => {
  const BAD_STEMS: readonly (readonly [string, string])[] = [
    ['an upper-case letter', 'Job-1'],
    ['a dot', 'a.b'],
    ['a space', 'a b'],
    ['two characters', 'ab'],
    ['65 characters', 'a'.repeat(65)],
    ['a leading dash', '-abc'],
    ['a leading dot', '.hidden'],
  ]

  test('SEC-10 the bad-stem table is not empty and every row is refused by A04 AiJobIdSchema (sentinel)', () => {
    expect(BAD_STEMS.length).toBeGreaterThan(0)
    for (const [, stem] of BAD_STEMS) expect(AiJobIdSchema.safeParse(stem).success, stem).toBe(false)
  })

  test.each(BAD_STEMS)('SEC-10 an inbox file whose name has %s is never used: no call, no outbox file, and the pass goes on', async (_label, stem) => {
    const w = world(['c01-clean'])
    writeJob(w.inbox, `${stem}.json`, cleanJob('a08-bad-stem', stem))
    const { result } = await runOnce(w)
    expect(result).toEqual({ ok: true })
    expect(callsHolding(w, 'a08-bad-stem')).toBe(0)
    expect(outboxNames(w)).toEqual(['c01-clean.json'])
    expect(outboxOf(w, 'c01-clean')).toHaveProperty('output')
  })

  test('SEC-10 a 24-hex job id (the shape F06 queues) is accepted and answered under its own name', async () => {
    const id = '0123456789abcdef01234567'
    expect(AiJobIdSchema.safeParse(id).success).toBe(true)
    const w = world([])
    const j = cleanJob('a08-hex-id', id)
    writeJob(w.inbox, `${id}.json`, j)
    await runOnce(w)
    expect(outboxOf(w, id)).toMatchObject({ jobId: id, output: VALID_OUTPUT })
    expect(callsHolding(w, 'a08-hex-id')).toBe(1)
  })

  test("SEC-10 a content jobId that differs from the file name's id is refused under the file name's id at stage input, and nothing is written under the other id", async () => {
    const w = world([])
    writeJob(w.inbox, 'c01-mismatch.json', cleanJob('a08-mismatch', 'c01-other'))
    await runOnce(w)
    const r = refusalOf(w, 'c01-mismatch')
    expect(r.reason).toMatch(/job id/i)
    expect(r.stage).toBe('input')
    expect(fs.existsSync(path.join(w.outbox, 'c01-other.json'))).toBe(false)
    expect(outboxNames(w)).toEqual(['c01-mismatch.json'])
    expect(w.calls()).toEqual([])
  })
})

// ---------- ARC-22 SEC-10: the inbox is read through readRegularFile ----------

/**
 * Every path node:fs is asked to open or read whole from now on (pass-through). Opening a FIFO would block the worker
 * for good, so such a call is noted and then refused with a planted error; a launcher that opens one fails by name.
 */
function watchOpens(): { paths: string[] } {
  const paths: string[] = []
  const lstatSync = fs.lstatSync.bind(fs)
  const note = (p: unknown): void => {
    const text = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString('utf8') : p instanceof URL ? p.pathname : undefined
    if (text === undefined) return
    paths.push(path.resolve(text))
    let fifo: boolean
    try {
      fifo = lstatSync(text).isFIFO()
    } catch {
      fifo = false
    }
    if (fifo) throw new Error('PLANTED: a FIFO was opened (it would block)')
  }
  const wrap = (target: Record<string, unknown>, name: string): void => {
    const real = (target[name] as (...a: unknown[]) => unknown).bind(target)
    vi.spyOn(target as Record<string, (...a: unknown[]) => unknown>, name).mockImplementation((...args: unknown[]) => {
      note(args[0])
      return real(...args)
    })
  }
  const sync = fs as unknown as Record<string, unknown>
  for (const name of ['openSync', 'readFileSync', 'open', 'readFile', 'createReadStream', 'copyFileSync', 'copyFile', 'cpSync']) wrap(sync, name)
  const later = fs.promises as unknown as Record<string, unknown>
  for (const name of ['open', 'readFile', 'copyFile', 'cp']) wrap(later, name)
  return { paths }
}

describe('ARC-22 SEC-10 an inbox entry that is not a regular file is never opened and is refused', SLOW, () => {
  test.skipIf(onWin32)('ARC-22 SEC-10 a symlink in the inbox to a valid job outside is refused "not a file" at stage input; neither the link nor its target is opened, and the target never reaches the model', async () => {
    const w = world(['c01-clean'])
    const outside = path.join(w.root, 'outside')
    fs.mkdirSync(outside)
    const target = path.join(outside, 'c01-link.json')
    writeJob(outside, 'c01-link.json', cleanJob('a08-linked-outside', 'c01-link'))
    const link = path.join(w.inbox, 'c01-link.json')
    fs.symlinkSync(target, link)
    const opens = watchOpens()
    await runOnce(w)
    vi.restoreAllMocks()
    const r = refusalOf(w, 'c01-link')
    expect(r.reason).toMatch(/not a file/)
    expect(r.stage).toBe('input')
    expect(callsHolding(w, 'a08-linked-outside')).toBe(0)
    // sentinel: the spies saw the launcher read something
    expect(opens.paths.length).toBeGreaterThan(0)
    expect(opens.paths.filter((p) => p === path.resolve(link) || p === path.resolve(target))).toEqual([])
    expect(outboxOf(w, 'c01-clean')).toHaveProperty('output')
  })

  test.skipIf(onWin32)('ARC-22 SEC-10 a FIFO in the inbox is refused "not a file" at stage input without being opened, and the run ends on its own', async () => {
    const w = world(['c01-clean'])
    const fifo = path.join(w.inbox, 'c01-fifo.json')
    execFileSync('mkfifo', [fifo], { timeout: 5000 })
    const opens = watchOpens()
    const { result } = await within(runOnce(w), 30_000, 'the launcher waited on the FIFO')
    vi.restoreAllMocks()
    expect(result).toEqual({ ok: true })
    const r = refusalOf(w, 'c01-fifo')
    expect(r.reason).toMatch(/not a file/)
    expect(r.stage).toBe('input')
    expect(opens.paths.filter((p) => p === path.resolve(fifo))).toEqual([])
    expect(outboxOf(w, 'c01-clean')).toHaveProperty('output')
  })

  test('ARC-22 SEC-10 a folder named like an inbox job is refused "not a file" at stage input and the pass goes on', async () => {
    const w = world(['c01-clean'])
    fs.mkdirSync(path.join(w.inbox, 'c01-folder.json'))
    const { result } = await runOnce(w)
    expect(result).toEqual({ ok: true })
    const r = refusalOf(w, 'c01-folder')
    expect(r.reason).toMatch(/not a file/)
    expect(r.stage).toBe('input')
    expect(outboxOf(w, 'c01-clean')).toHaveProperty('output')
  })
})

// ---------- SEC-10: every file the launcher makes is created exclusively ----------

type Make = { fn: string; file: string; exclusive: boolean }

/** True when open flags (a string or numbers) create or write; `exclusive` when they also refuse an existing file. */
function flagsOf(flags: unknown): { writes: boolean; exclusive: boolean } {
  if (flags === undefined || flags === null) return { writes: false, exclusive: false }
  if (typeof flags === 'string') return { writes: /[wa+]/.test(flags), exclusive: flags.includes('x') }
  if (typeof flags === 'number') {
    const c = fs.constants
    const writes = (flags & (c.O_WRONLY | c.O_RDWR | c.O_CREAT | c.O_APPEND)) !== 0
    return { writes, exclusive: (flags & c.O_EXCL) !== 0 && (flags & c.O_CREAT) !== 0 }
  }
  return { writes: true, exclusive: false }
}

/** What one fs call makes, or undefined when it makes nothing (a read, or a write to an already-open descriptor). */
function makeOf(fn: string, args: readonly unknown[]): Make | undefined {
  const pathText = (p: unknown): string | undefined =>
    typeof p === 'string' ? path.resolve(p) : Buffer.isBuffer(p) ? path.resolve(p.toString('utf8')) : p instanceof URL ? path.resolve(p.pathname) : undefined
  const optFlag = (o: unknown, key: 'flag' | 'flags', fallback: string): unknown =>
    o !== null && typeof o === 'object' && key in o ? (o as Record<string, unknown>)[key] : fallback
  const name = fn.replace(/^promises\./, '').replace(/Sync$/, '')
  if (name === 'writeFile' || name === 'appendFile') {
    const file = pathText(args[0])
    if (file === undefined) return undefined
    return { fn, file, exclusive: flagsOf(optFlag(args[2], 'flag', name === 'writeFile' ? 'w' : 'a')).exclusive }
  }
  if (name === 'open') {
    const file = pathText(args[0])
    const flags = typeof args[1] === 'function' ? undefined : args[1]
    const f = flagsOf(flags)
    if (file === undefined || !f.writes) return undefined
    return { fn, file, exclusive: f.exclusive }
  }
  if (name === 'createWriteStream') {
    const file = pathText(args[0])
    if (file === undefined) return undefined
    return { fn, file, exclusive: flagsOf(optFlag(args[1], 'flags', 'w')).exclusive }
  }
  if (name === 'copyFile') {
    const file = pathText(args[1])
    if (file === undefined) return undefined
    const mode = typeof args[2] === 'number' ? args[2] : 0
    return { fn, file, exclusive: (mode & fs.constants.COPYFILE_EXCL) !== 0 }
  }
  if (name === 'cp') {
    const file = pathText(args[1])
    if (file === undefined) return undefined
    const o = args[2]
    const strict = o !== null && typeof o === 'object' && (o as Record<string, unknown>)['force'] === false && (o as Record<string, unknown>)['errorOnExist'] === true
    return { fn, file, exclusive: strict }
  }
  return undefined
}

/** Pass-through spies that note every file node:fs is asked to make from now on. */
function watchMakes(): { makes: Make[] } {
  const makes: Make[] = []
  const wrap = (target: Record<string, unknown>, name: string, label: string): void => {
    const real = (target[name] as (...a: unknown[]) => unknown).bind(target)
    vi.spyOn(target as Record<string, (...a: unknown[]) => unknown>, name).mockImplementation((...args: unknown[]) => {
      const m = makeOf(label, args)
      if (m !== undefined) makes.push(m)
      return real(...args)
    })
  }
  const sync = fs as unknown as Record<string, unknown>
  for (const name of ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'openSync', 'open', 'createWriteStream', 'copyFileSync', 'copyFile', 'cpSync', 'cp']) {
    wrap(sync, name, name)
  }
  const later = fs.promises as unknown as Record<string, unknown>
  for (const name of ['writeFile', 'appendFile', 'open', 'copyFile', 'cp']) wrap(later, name, `promises.${name}`)
  return { makes }
}

describe('SEC-10 every file the launcher makes under the exchange folder is created exclusively (wx)', SLOW, () => {
  test('SEC-10 a run over a clean job, an unredacted job and a not-JSON answer creates every file with wx (or O_EXCL, COPYFILE_EXCL), never into an existing file or link', async () => {
    const w = world(['c01-clean', 'c01-unredacted', 'c01-answer-not-json'])
    const watch = watchMakes()
    await runOnce(w)
    vi.restoreAllMocks()
    const root = w.exchange + path.sep
    const mine = watch.makes.filter((m) => m.file.startsWith(root))
    // sentinel: three outbox files were written as temp files and renamed, so at least three makes were seen
    expect(outboxNames(w)).toEqual(['c01-answer-not-json.json', 'c01-clean.json', 'c01-unredacted.json'])
    expect(mine.length).toBeGreaterThanOrEqual(3)
    expect(mine.filter((m) => !m.exclusive).map((m) => `${m.fn} ${path.relative(w.exchange, m.file)}`)).toEqual([])
  })

  test('SEC-10 rule: the make classifier flags planted non-exclusive writes and passes the exclusive forms', () => {
    const f = path.resolve('exchange', 'job.tmp')
    const planted: [string, unknown[]][] = [
      ['writeFileSync', [f, 'x']],
      ['writeFileSync', [f, 'x', 'utf8']],
      ['writeFileSync', [f, 'x', { flag: 'w' }]],
      ['promises.writeFile', [f, 'x']],
      ['appendFileSync', [f, 'x']],
      ['openSync', [f, 'w']],
      ['openSync', [f, fs.constants.O_WRONLY | fs.constants.O_CREAT]],
      ['createWriteStream', [f]],
      ['copyFileSync', ['a', f]],
      ['cpSync', ['a', f]],
    ]
    for (const [fn, args] of planted) expect(makeOf(fn, args), `${fn} ${JSON.stringify(args)}`).toMatchObject({ exclusive: false })
    const good: [string, unknown[]][] = [
      ['writeFileSync', [f, 'x', { flag: 'wx' }]],
      ['promises.writeFile', [f, 'x', { flag: 'wx', mode: 0o600 }]],
      ['openSync', [f, 'wx']],
      ['openSync', [f, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL]],
      ['createWriteStream', [f, { flags: 'wx' }]],
      ['copyFileSync', ['a', f, fs.constants.COPYFILE_EXCL]],
    ]
    for (const [fn, args] of good) expect(makeOf(fn, args), `${fn} ${JSON.stringify(args)}`).toMatchObject({ exclusive: true })
    // reads make nothing
    expect(makeOf('openSync', [f, 'r'])).toBeUndefined()
    expect(makeOf('openSync', [f])).toBeUndefined()
    expect(makeOf('readFileSync', [f])).toBeUndefined()
  })
})

// ---------- ARC-22 R96: the claude child has a timeout and is stopped by its own PID ----------

/** A decoy: the same fake program, from its own folder, hanging; a launcher that stops processes by name would stop it too. */
function startDecoy(w: World): ChildProcess {
  const dir = path.join(w.root, 'decoy')
  fs.mkdirSync(dir)
  const bin = path.join(dir, 'fake-claude.mjs')
  fs.copyFileSync(path.join(FIXTURES_DIR, 'fake-claude.mjs'), bin)
  const control: FakeControl = { rules: [], defaultResult: VALID_TEXT, hangMs: 120_000 }
  fs.writeFileSync(path.join(dir, 'fake-claude.control.json'), JSON.stringify(control))
  const child = spawn(process.execPath, [bin], { stdio: 'ignore' })
  started.push(child)
  return child
}

async function gone(pid: number, ms: number): Promise<boolean> {
  const until = Date.now() + ms
  while (alive(pid)) {
    if (Date.now() > until) return false
    await new Promise((r) => setTimeout(r, 20))
  }
  return true
}

describe('ARC-22 R96 the claude call has a time limit and is stopped by its own PID', SLOW, () => {
  test("ARC-22 CLAUDE_TIMEOUT_MS is a positive finite time that ends before A04's wait does (the lease minus its margin)", () => {
    expect(typeof CLAUDE_TIMEOUT_MS).toBe('number')
    expect(Number.isFinite(CLAUDE_TIMEOUT_MS)).toBe(true)
    expect(CLAUDE_TIMEOUT_MS).toBeGreaterThan(0)
    expect(CLAUDE_TIMEOUT_MS).toBeLessThan(AI_JOB_LEASE_MS - AI_LEASE_MARGIN_MS)
  })

  test('ARC-22 R96 a call still running at the time limit is stopped (that process only, not a decoy of the same program), its job refused at stage run naming the time limit, and the next job answered', async () => {
    const w = world(['c01-clean', 'c01-injected'], {
      rules: [{ match: markerOf('c01-clean'), result: VALID_TEXT, hangMs: 120_000 }],
      defaultResult: VALID_TEXT,
    })
    const decoy = startDecoy(w)
    expect(decoy.pid).toBeDefined()
    const { result } = await within(runOnce(w, { claudeTimeoutMs: 4000 }), 40_000, 'the launcher never stopped the hung claude call')
    expect(result).toEqual({ ok: true })
    const r = refusalOf(w, 'c01-clean')
    expect(r.stage).toBe('run')
    expect(r.reason).toMatch(/time/i)
    expect(outboxOf(w, 'c01-injected')).toMatchObject({ jobId: 'c01-injected', output: VALID_OUTPUT })
    const [hung] = callsFor(w, 'c01-clean')
    expect(hung, 'the hung call was logged').toBeDefined()
    if (hung === undefined) return
    expect(await gone(hung.pid, 5000), 'the hung claude process is still running').toBe(true)
    expect(alive(decoy.pid ?? -1), 'the decoy (same program, not the launcher child) was stopped too').toBe(true)
  })
})

// ---------- AI-9 SEC-5 A498: sensitive facts and marker answers ----------

const CATALOGUE = (() => {
  const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
  if (!loaded.ok) throw new Error(`data/facts/catalogue.json does not load: ${loaded.reasons.join('; ')}`)
  return loaded.catalogue
})()
type Entry = { key: string; sensitive: string }
/**
 * A509 gap 6: fact keys exempt from the marked-key rule, each with its reason. Empty: the Lead's ruling (amber A509) is
 * that an account's last digits count as masked only inside the restricted-provided marker form, which A498 refuses
 * anyway, so every other tail of a bank_account fact is refused like a SIN or a birth date.
 */
const EXEMPT: Readonly<Record<string, string>> = {}
/** Every key E03 marks sensitive (any kind but none), minus the reasoned exemptions: never a closed list of kinds. */
const markedKeysOf = (entries: readonly Entry[], exempt: Readonly<Record<string, string>>): string[] =>
  entries.filter((e) => e.sensitive !== 'none' && !Object.hasOwn(exempt, e.key)).map((e) => e.key)
/** An exemption whose key is gone from the catalogue, or no longer sensitive, is stale. */
const staleExemptions = (entries: readonly Entry[], exempt: Readonly<Record<string, string>>): string[] =>
  Object.keys(exempt)
    .filter((k) => !entries.some((e) => e.key === k && e.sensitive !== 'none'))
    .map((k) => `stale exemption: ${k}`)
/** A498, A509 gap 6: every fact key E03 marks sensitive, from the catalogue (never a hand list). */
const MARKED_KEYS = markedKeysOf(CATALOGUE.entries, EXEMPT)
/** A fact E03 marks not sensitive, whose name says nothing of a SIN, birth, bank, account or card. */
const PLAIN_KEY = CATALOGUE.entries.find((e) => e.sensitive === 'none' && !/sin|birth|bank|account|card|transit/.test(e.key))?.key
/** A value the nine-digit SIN scan and the date scan both miss (a marker's last digits). */
const TAIL = 'last four 4821 (Test)'

type Plant = (inputs: Json, key: string, value: string) => void
const FORMS: readonly (readonly [string, Plant])[] = [
  ['an object { key, value } in inputs.facts', (inputs, key, value) => { inputs['facts'] = [{ key, value }] }],
  ['an object { factKey, value } nested in a document', (inputs, key, value) => {
    const docs = inputs['documents'] as Json[]
    if (docs[0]) docs[0]['facts'] = [{ factKey: key, value }]
  }],
  ['an input field named by the fact key', (inputs, key, value) => { inputs[key] = value }],
]
const ROWS = MARKED_KEYS.flatMap((key) => FORMS.map(([label, plant]) => [key, label, plant] as const))

describe('AI-9 SEC-5 A498 a value of a fact E03 marks sensitive, or text after restricted-provided, never reaches the model', SLOW, () => {
  test('AI-9 A498 the marked keys come from E03 catalogue and hold the shareholder SIN, the T4 SIN and the director birth date (sentinels)', () => {
    expect(MARKED_KEYS.length).toBeGreaterThan(0)
    expect(MARKED_KEYS).toEqual(expect.arrayContaining(['shareholder.identity.sin', 't4.slip.employee_sin', 'director.identity.birth_date']))
    expect(ROWS.length).toBe(MARKED_KEYS.length * FORMS.length)
    expect(PLAIN_KEY).toBeDefined()
  })

  test('AI-9 A509 the marked keys are every key E03 marks sensitive: the bank account keys too, every sensitive kind of the contract has a row, and no exemption is stale', () => {
    expect(MARKED_KEYS).toEqual(expect.arrayContaining(['bank.statement.account_number', 'card.statement.card_number', 'loan.statement.account_number']))
    const kinds = SENSITIVE_KINDS.filter((k) => k !== 'none')
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) {
      const keys = CATALOGUE.entries.filter((e) => e.sensitive === kind).map((e) => e.key)
      expect(keys.length, `no catalogue key of kind ${kind}`).toBeGreaterThan(0)
      expect(keys.every((k) => MARKED_KEYS.includes(k) || Object.hasOwn(EXEMPT, k)), kind).toBe(true)
    }
    expect(staleExemptions(CATALOGUE.entries, EXEMPT)).toEqual([])
  })

  test('AI-9 A509 rule: a copied catalogue with a new sensitive kind is covered by the derivation (a closed sin and birth_date list misses it), and a planted stale exemption is caught', () => {
    const copy: Entry[] = [...CATALOGUE.entries.map((e) => ({ key: e.key, sensitive: e.sensitive })), { key: 'owner.identity.passport_number', sensitive: 'passport' }]
    expect(markedKeysOf(copy, EXEMPT)).toContain('owner.identity.passport_number')
    const closed = copy.filter((e) => e.sensitive === 'sin' || e.sensitive === 'birth_date').map((e) => e.key)
    expect(closed).not.toContain('owner.identity.passport_number')
    expect(staleExemptions(copy, { 'owner.identity.gone_number': 'planted (Test)' })).toEqual(['stale exemption: owner.identity.gone_number'])
    expect(staleExemptions(copy, { [PLAIN_KEY ?? '']: 'planted (Test)' })).toEqual([`stale exemption: ${PLAIN_KEY ?? ''}`])
    expect(staleExemptions(copy, { 'owner.identity.passport_number': 'reason (Test)' })).toEqual([])
  })

  test.each(ROWS)('AI-9 SEC-5 A498 a value of the E03-marked fact %s, as %s, is refused at stage input before any call', async (key, _label, plant) => {
    const w = world([])
    writeJob(w.inbox, 'c01-marked-fact.json', cleanJob('a08-marked-fact', 'c01-marked-fact', (j) => { plant(j['inputs'] as Json, key, TAIL) }))
    const { lines } = await runOnce(w)
    const r = refusalOf(w, 'c01-marked-fact')
    expect(r.reason).toMatch(/AI-9/)
    expect(r.stage).toBe('input')
    // A529 S3: the exact problems: the fact kind alone (the tail holds no SIN, date or bank shape)
    expect(r.problems).toEqual(['a value of a fact marked sensitive'])
    expect(w.calls()).toEqual([])
    expect(JSON.stringify(r)).not.toContain('4821')
    expect(lines.join('\n')).not.toContain(TAIL)
  })

  test('AI-9 A498 no false alarm: the same value on a fact E03 marks not sensitive is answered', async () => {
    const w = world([])
    writeJob(w.inbox, 'c01-plain-fact.json', cleanJob('a08-plain-fact', 'c01-plain-fact', (j) => { (j['inputs'] as Json)['facts'] = [{ key: PLAIN_KEY, value: TAIL }] }))
    await runOnce(w)
    expect(outboxOf(w, 'c01-plain-fact')).toMatchObject({ jobId: 'c01-plain-fact', output: VALID_OUTPUT })
    expect(callsHolding(w, 'a08-plain-fact')).toBe(1)
  })

  test.each([
    ['in document text', (inputs: Json) => {
      const docs = inputs['documents'] as Json[]
      if (docs[0]) docs[0]['text'] = 'Onboarding answer PY3.sin (Test): restricted-provided 4821'
    }],
    ['as an answer value', (inputs: Json) => { inputs['answers'] = [{ questionId: 'PY3.dob', answer: 'restricted-provided 4821' }] }],
    ['with no space before the digits', (inputs: Json) => { inputs['answers'] = [{ questionId: 'BQ7.sin', answer: 'restricted-provided4821' }] }],
  ] as const)('AI-9 SEC-5 A498 text after restricted-provided %s is refused at stage input before any call', async (label, plant) => {
    const w = world([])
    writeJob(w.inbox, 'c01-marker.json', cleanJob('a08-marker', 'c01-marker', (j) => { plant(j['inputs'] as Json) }))
    const { lines } = await runOnce(w)
    const r = refusalOf(w, 'c01-marker')
    expect(r.reason).toMatch(/AI-9/)
    expect(r.stage).toBe('input')
    // A529 S3: the exact problems; the answer row's question id PY3.dob also reads as a date-of-birth label
    expect(r.problems).toEqual(label === 'as an answer value' ? ['a date of birth', 'text after the restricted-provided marker'] : ['text after the restricted-provided marker'])
    expect(w.calls()).toEqual([])
    expect(JSON.stringify(r)).not.toContain('4821')
    expect(lines.join('\n')).not.toMatch(/restricted-provided\s*4821/)
  })
})

// ---------- ARC-22 SEC-10 A509 gap 3: the claude child's environment is an allowlist ----------

/**
 * The only setting names the claude child may see (A509 gap 3): what a program needs to start on Windows or Linux,
 * the subscription's own token (gap 4) and the fresh config folder (gap 2). Compared without case (Windows' Path).
 */
const CHILD_ENV_BASE = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'SystemRoot', 'TEMP', 'TMP', 'TZ', 'LANG', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR']
/**
 * A529 S5 (RC5a): on Windows, libuv adds these to every child's environment whatever the launcher passes (seen on Zo's
 * laptop: the allowlist row failed there only). They are allowed on win32 only, so Linux still holds the launcher to
 * the base list.
 */
const LIBUV_WINDOWS_NAMES = ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'WINDIR']
const CHILD_ENV_ALLOWLIST = [...CHILD_ENV_BASE, ...(onWin32 ? LIBUV_WINDOWS_NAMES : [])]
const notAllowed = (names: readonly string[]): string[] => {
  const ok = new Set(CHILD_ENV_ALLOWLIST.map((n) => n.toUpperCase()))
  return names.filter((n) => !ok.has(n.toUpperCase()))
}

describe('ARC-22 SEC-10 A509 the claude child sees only allowlisted settings', SLOW, () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('ARC-22 SEC-10 A509 settings planted in the process (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY) and in options.env (an extra name, NODE_OPTIONS, the exchange settings) never reach the child: its names are a subset of the allowlist', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://planted-a08-test@localhost/none')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'planted-a08-test-not-a-key')
    const w = world(['c01-clean'])
    const { result, lines } = await runOnce(w, { env: { ...w.env, A08_PLANTED_EXTRA_SETTING: 'planted (Test)', NODE_OPTIONS: '--max-old-space-size=4096' } })
    expect(result).toEqual({ ok: true })
    const [call] = w.calls()
    expect(call, 'the clean job was not called').toBeDefined()
    if (call === undefined) return
    // sentinel: the child got a working environment (PATH at least), so an empty list cannot pass by accident
    expect(call.envNames.map((n) => n.toUpperCase())).toContain('PATH')
    expect(notAllowed(call.envNames)).toEqual([])
    expect(lines.join('\n')).not.toContain('planted-a08-test')
  })

  test('ARC-22 A529 S5 the libuv Windows names are allowed on win32 only: on Linux the allowlist is the base list', () => {
    expect(LIBUV_WINDOWS_NAMES).toHaveLength(7)
    expect(notAllowed(LIBUV_WINDOWS_NAMES)).toEqual(onWin32 ? [] : LIBUV_WINDOWS_NAMES)
    expect(notAllowed(CHILD_ENV_BASE)).toEqual([])
  })

  test('ARC-22 A509 rule: the allowlist check catches the pass-through launcher (spawn with env: process.env) and passes the allowlisted names', () => {
    expect(notAllowed(['PATH', 'HOME', 'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_EXCHANGE_DIR', 'NODE_OPTIONS'])).toEqual([
      'DATABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AI_EXCHANGE_DIR',
      'NODE_OPTIONS',
    ])
    expect(notAllowed(['Path', 'SystemRoot', 'TEMP', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR'])).toEqual([])
  })
})

// ---------- AI-9 SEC-5 A509 gap 5: the code scan beyond ASCII ----------

/** The planted SIN's three groups (from the harness; no test-data file holds the nine digits, SC R34). */
const [G1, G2, G3] = SIN_GROUPS
const SIN_DIGITS = `${G1}${G2}${G3}`
const fullWidth = (digits: string): string => digits.split('').map((d) => String.fromCharCode(0xff10 + Number(d))).join('')
/** The separators SC rule R34 already knows: a dot, the no-break and thin spaces, and the Unicode hyphens and dashes. */
const SEPARATORS: readonly (readonly [string, string])[] = [
  ['a dot', '.'],
  ['U+00A0', ' '],
  ['U+2009', ' '],
  ['U+202F', ' '],
  ['U+2010', '‐'],
  ['U+2011', '‑'],
  ['U+2012', '‒'],
  ['U+2013', '–'],
  ['U+2014', '—'],
  ['U+2015', '―'],
]
const setText = (text: string) => (inputs: Json): void => {
  const docs = inputs['documents'] as Json[]
  if (docs[0]) docs[0]['text'] = text
}
const DOB = '1971-04-12'

/** One row: what is planted in the job's inputs, and the strings that must reach no log line and no refusal. */
type ScanRow = readonly [label: string, plant: (inputs: Json) => void, secrets: readonly string[]]
const SCAN_ROWS: readonly ScanRow[] = [
  ...SEPARATORS.map(([label, sep]): ScanRow => [`a SIN separated by ${label}`, setText(`Payroll slip (Test), reference ${G1}${sep}${G2}${sep}${G3}`), [`${G1}${sep}${G2}${sep}${G3}`, SIN_DIGITS]]),
  ['a SIN in full-width digits (NFKC)', setText(`Payroll slip (Test), reference ${fullWidth(SIN_DIGITS)}`), [fullWidth(SIN_DIGITS), SIN_DIGITS]],
  ['a SIN in spaced full-width digits', setText(`Payroll slip (Test), reference ${fullWidth(G1)} ${fullWidth(G2)} ${fullWidth(G3)}`), [fullWidth(G1), SIN_DIGITS]],
  [
    'a SIN as a JSON number nested three deep (ledger[0].memo)',
    (inputs) => {
      const ledger = inputs['ledger'] as Json[]
      if (ledger[0]) ledger[0]['memo'] = Number(SIN_DIGITS)
    },
    [SIN_DIGITS],
  ],
  ['a DOB label', setText(`Owner profile (Test). DOB: ${DOB}`), [DOB]],
  ['a D.O.B. label', setText(`Owner profile (Test). D.O.B. ${DOB}`), [DOB]],
  ['a born label', setText(`Owner profile (Test), born ${DOB}`), [DOB]],
  ['a birth date label', setText(`Owner profile (Test). Birth date: ${DOB}`), [DOB]],
  ['a date de naissance label', setText(`Profil du propriétaire (Test). Date de naissance : ${DOB}`), [DOB]],
  ['a dob key', (inputs) => { inputs['dob'] = DOB }, [DOB]],
  [
    'a birth_date key nested in a document',
    (inputs) => {
      const docs = inputs['documents'] as Json[]
      if (docs[0]) docs[0]['birth_date'] = DOB
    },
    [DOB],
  ],
  ['a birthDate key nested in an owner object', (inputs) => { inputs['owner'] = { name: 'Jordan Lee (Test)', birthDate: DOB } }, [DOB]],
  ['an accountNumber key', (inputs) => { inputs['payee'] = { accountNumber: '7654321' } }, ['7654321']],
  ['a transitNumber key', (inputs) => { inputs['payee'] = { transitNumber: '00123' } }, []],
  ['an institutionNumber key', (inputs) => { inputs['payee'] = { institutionNumber: '004' } }, []],
  ['a bank account shape with spaces', setText('Direct deposit (Test) to account 00123 004 7654321'), ['7654321']],
  ['the marker written RESTRICTED-PROVIDED', (inputs) => { inputs['answers'] = [{ questionId: 'PY3.bank', answer: 'RESTRICTED-PROVIDED 4821' }] }, ['4821']],
  ['the marker written with a U+2011 hyphen', (inputs) => { inputs['answers'] = [{ questionId: 'PY3.sin', answer: 'restricted‑provided 4821' }] }, ['4821']],
]

/** A529 S3 (RC2): the exact problems list each scan row's refusal carries (the scan's kinds, pinned whole). */
const K_SIN = 'a SIN'
const K_BIRTH = 'a date of birth'
const K_BANK = 'a bank account'
const K_MARKER = 'text after the restricted-provided marker'
const SCAN_KINDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries<readonly string[]>([
  ...SEPARATORS.map(([label]) => [`a SIN separated by ${label}`, [K_SIN]] as const),
  ['a SIN in full-width digits (NFKC)', [K_SIN]],
  ['a SIN in spaced full-width digits', [K_SIN]],
  ['a SIN as a JSON number nested three deep (ledger[0].memo)', [K_SIN]],
  ['a DOB label', [K_BIRTH]],
  ['a D.O.B. label', [K_BIRTH]],
  ['a born label', [K_BIRTH]],
  ['a birth date label', [K_BIRTH]],
  ['a date de naissance label', [K_BIRTH]],
  ['a dob key', [K_BIRTH]],
  ['a birth_date key nested in a document', [K_BIRTH]],
  ['a birthDate key nested in an owner object', [K_BIRTH]],
  ['an accountNumber key', [K_BANK]],
  ['a transitNumber key', [K_BANK]],
  ['an institutionNumber key', [K_BANK]],
  ['a bank account shape with spaces', [K_BANK]],
  ['the marker written RESTRICTED-PROVIDED', [K_MARKER]],
  ['the marker written with a U+2011 hyphen', [K_MARKER]],
])

/** No false alarm, one row per kind: values a correct scan leaves alone. */
const CLEAN_ROWS: readonly (readonly [string, (inputs: Json) => void])[] = [
  [
    'SIN kind: amountCents a nine-digit number that fails the check digit, as a JSON number',
    (inputs) => {
      const ledger = inputs['ledger'] as Json[]
      if (ledger[0]) ledger[0]['amountCents'] = Number(SIN_DIGITS) + 1
    },
  ],
  ['birth date kind: yearEnd a date under a key that is not a birth date', (inputs) => { inputs['yearEnd'] = DOB }],
  [
    'bank kind: recordId with digit groups that are not a bank shape',
    (inputs) => {
      const ledger = inputs['ledger'] as Json[]
      if (ledger[0]) ledger[0]['recordId'] = 'txn-2025-004-0042'
    },
  ],
  ['marker kind: the words restricted and provided apart', setText('Statement provided by the owner (Test); access restricted to staff')],
]

describe('AI-9 SEC-5 A509 the sensitive-value scan reads Unicode, numbers, nesting and escapes, not ASCII text only', SLOW, () => {
  test('AI-9 A509 the scan tables are not empty and cover every R34 separator (sentinel)', () => {
    expect(SCAN_ROWS.length).toBeGreaterThan(SEPARATORS.length)
    expect(SEPARATORS.map(([, sep]) => sep).join('')).toBe('.   ‐‑‒–—―')
    expect(CLEAN_ROWS.length).toBe(4)
    expect(Number(SIN_DIGITS) + 1).not.toBe(Number(SIN_DIGITS))
    // A529 S3: every row has its exact problems list, and no list is left over
    expect(Object.keys(SCAN_KINDS).sort()).toEqual(SCAN_ROWS.map(([label]) => label).sort())
  })

  test.each(SCAN_ROWS)('AI-9 SEC-5 A509 %s is refused at stage input before any call, the value in no log line and no refusal', async (label, plant, secrets) => {
    const w = world([])
    writeJob(w.inbox, 'c01-scan.json', cleanJob('a08-scan', 'c01-scan', (j) => { plant(j['inputs'] as Json) }))
    const { lines } = await runOnce(w)
    const r = refusalOf(w, 'c01-scan')
    expect(r.reason).toMatch(/AI-9/)
    expect(r.stage).toBe('input')
    // A529 S3: the exact problems, not just "some"
    expect(r.problems).toEqual(SCAN_KINDS[label])
    expect(w.calls()).toEqual([])
    const told = `${JSON.stringify(r)}\n${lines.join('\n')}`
    for (const secret of secrets) expect(told).not.toContain(secret)
  })

  test('AI-9 SEC-5 A509 a SIN written with \\u escapes in the raw inbox file is refused at stage input before any call', async () => {
    const w = world([])
    const j = cleanJob('a08-scan-escaped', 'c01-scan-escaped', (job) => { setText(`Payroll slip (Test), reference ${SIN_DIGITS}`)(job['inputs'] as Json) })
    const escaped = SIN_DIGITS.split('').map((d) => `\\u00${d.charCodeAt(0).toString(16)}`).join('')
    const raw = JSON.stringify(j, null, 2).replace(SIN_DIGITS, escaped)
    // sentinel: the raw file holds no plain digits, and it still parses to the same job
    expect(raw).not.toContain(SIN_DIGITS)
    expect(JSON.parse(raw)).toEqual(j)
    fs.writeFileSync(path.join(w.inbox, 'c01-scan-escaped.json'), raw + '\n')
    const { lines } = await runOnce(w)
    const r = refusalOf(w, 'c01-scan-escaped')
    expect(r.reason).toMatch(/AI-9/)
    expect(r.stage).toBe('input')
    expect(r.problems).toEqual([K_SIN])
    expect(w.calls()).toEqual([])
    expect(`${JSON.stringify(r)}\n${lines.join('\n')}`).not.toContain(SIN_DIGITS)
  })

  test.each(CLEAN_ROWS)('AI-9 A509 no false alarm (%s): the job is answered', async (_label, plant) => {
    const w = world([])
    writeJob(w.inbox, 'c01-scan-clean.json', cleanJob('a08-scan-clean', 'c01-scan-clean', (j) => { plant(j['inputs'] as Json) }))
    await runOnce(w)
    expect(outboxOf(w, 'c01-scan-clean')).toMatchObject({ jobId: 'c01-scan-clean', output: VALID_OUTPUT })
    expect(callsHolding(w, 'a08-scan-clean')).toBe(1)
  })
})

// ---------- AI-1 A509 gap 8: the CLI's failure envelope ----------

const FAILURES: readonly (readonly [string, FakeFailure])[] = [
  ['is_error true (the result text still a valid answer)', { isError: true }],
  ['subtype error_max_turns', { subtype: 'error_max_turns' }],
  ['subtype error_during_execution with is_error true', { subtype: 'error_during_execution', isError: true }],
  ['exit code 1 after a success envelope', { exitCode: 1 }],
  ['empty stdout with exit code 0', { emptyStdout: true }],
  ['exit code 2, an error on stderr and empty stdout', { exitCode: 2, emptyStdout: true, stderr: 'Error: not logged in (Test)' }],
]

describe('AI-1 A509 a failed CLI run is a refusal at stage run, never an answer', SLOW, () => {
  test.each(FAILURES)('AI-1 A509 %s becomes a refusal at stage run, with no output and no stamp, and the next job is answered', async (_label, failure) => {
    const w = world(['c01-clean', 'c01-injected'], {
      rules: [{ match: markerOf('c01-clean'), result: VALID_TEXT, ...failure }],
      defaultResult: VALID_TEXT,
    })
    const { result } = await runOnce(w)
    expect(result).toEqual({ ok: true })
    const r = refusalOf(w, 'c01-clean')
    expect(r.stage).toBe('run')
    expect(outboxOf(w, 'c01-clean')).not.toHaveProperty('output')
    expect(outboxOf(w, 'c01-clean')).not.toHaveProperty('stamp')
    expect(callsFor(w, 'c01-clean')).toHaveLength(1)
    expect(outboxOf(w, 'c01-injected')).toMatchObject({ jobId: 'c01-injected', output: VALID_OUTPUT })
  })
})

// ---------- AI-8 SEC-10 A509 gap 9: no shell between the launcher and the CLI ----------

/** Shell metacharacters, a %VAR%, a $(...) and a backtick, made up. */
const SHELL_TEXT = 'Memo (Test): " & | < > %PATH% $(echo planted) `echo planted` \' ; end'

/** Every string a data block's content can stand for: the raw text, HTML-unescaped, and any JSON it parses to. */
function dataStrings(content: string): string[] {
  const out: string[] = []
  const html = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const collect = (v: unknown): void => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(collect)
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(collect)
  }
  for (const text of [content, html]) {
    out.push(text)
    for (const candidate of [text.trim(), `"${text}"`]) {
      try {
        collect(JSON.parse(candidate))
      } catch {
        // not JSON
      }
    }
  }
  return out
}

describe('AI-8 SEC-10 A509 document text reaches the CLI byte for byte, with no shell on the way', SLOW, () => {
  test('AI-8 SEC-10 A509 document text holding quotes, & | < >, %PATH%, $(...) and a backtick reaches the fake unchanged, inside the data wrapper only', async () => {
    const w = world([])
    writeJob(w.inbox, 'c01-shell.json', cleanJob('a08-shell', 'c01-shell', (j) => { setText(SHELL_TEXT)(j['inputs'] as Json) }))
    await runOnce(w)
    const [call] = w.calls()
    expect(call, 'the job was not called').toBeDefined()
    if (call === undefined) return
    const texts = [...call.argv, call.stdin]
    const inside = texts.flatMap((t) => [...t.matchAll(/<data\b[^>]*>([\s\S]*?)<\/data>/g)].map((m) => m[1] ?? ''))
    expect(inside.length, 'no data wrapper').toBeGreaterThan(0)
    expect(inside.flatMap(dataStrings).some((t) => t.includes(SHELL_TEXT)), 'the text was changed on the way').toBe(true)
    const outside = texts.map((t) => t.replace(/<data\b[^>]*>[\s\S]*?<\/data>/g, '')).join('\n')
    expect(outside).not.toContain('%PATH%')
    expect(outside).not.toContain('$(echo planted)')
    expect(outboxOf(w, 'c01-shell')).toMatchObject({ jobId: 'c01-shell', output: VALID_OUTPUT })
  })

  test('AI-8 A509 rule: the decoder finds the text in JSON-escaped and HTML-escaped data, and not in a shell-mangled copy', () => {
    expect(dataStrings(JSON.stringify({ text: SHELL_TEXT }).replace(/</g, '\\u003c')).some((t) => t.includes(SHELL_TEXT))).toBe(true)
    expect(dataStrings(SHELL_TEXT.replace(/&/g, '&amp;').replace(/</g, '&lt;')).some((t) => t.includes(SHELL_TEXT))).toBe(true)
    const mangled = SHELL_TEXT.replace('%PATH%', '/usr/bin').replace('$(echo planted)', 'planted')
    expect(dataStrings(JSON.stringify({ text: mangled })).some((t) => t.includes(SHELL_TEXT))).toBe(false)
  })
})

// ---------- ARC-22 A509 gap 10: one run at a time ----------

describe('ARC-22 A509 one run at a time: a second run on the same exchange folder calls nothing', SLOW, () => {
  test('ARC-22 A509 a run started while another is answering refuses "a run is already going" and calls nothing; the first run answers each job once', async () => {
    const w = world(['c01-clean', 'c01-injected'], {
      rules: [{ match: markerOf('c01-clean'), result: VALID_TEXT, hangMs: 2500 }],
      defaultResult: VALID_TEXT,
    })
    const first = runOnce(w)
    const until = Date.now() + 20_000
    while (w.calls().length === 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 20))
    expect(w.calls().length, 'the first run never called the fake').toBeGreaterThan(0)
    const second = await within(runOnce(w), 20_000, 'the second run waited')
    expect(second.result.ok).toBe(false)
    expect(second.result.reason).toContain('a run is already going')
    const { result } = await within(first, 30_000, 'the first run never ended')
    expect(result).toEqual({ ok: true })
    expect(callsFor(w, 'c01-clean')).toHaveLength(1)
    expect(callsFor(w, 'c01-injected')).toHaveLength(1)
    expect(outboxNames(w)).toEqual(['c01-clean.json', 'c01-injected.json'])
  })

  test('ARC-22 A509 two runs started at the same moment: one runs, the other refuses "a run is already going"; each job is called once and each outbox file written once', async () => {
    const w = world(['c01-clean', 'c01-injected'])
    fs.mkdirSync(w.outbox, { recursive: true })
    const watch = watchNames(w.outbox)
    const runs = await within(Promise.all([runOnce(w), runOnce(w)]), 45_000, 'the two runs never ended')
    const seen = await watch.stop()
    const oks = runs.filter((r) => r.result.ok)
    const refused = runs.filter((r) => !r.result.ok)
    expect(oks).toHaveLength(1)
    expect(refused).toHaveLength(1)
    expect(refused[0]?.result.reason).toContain('a run is already going')
    expect(callsFor(w, 'c01-clean')).toHaveLength(1)
    expect(callsFor(w, 'c01-injected')).toHaveLength(1)
    expect(outboxNames(w)).toEqual(['c01-clean.json', 'c01-injected.json'])
    expect(seen).toEqual(expect.arrayContaining(['c01-clean.json', 'c01-injected.json']))
  })

  test('ARC-22 A509 the run lock is released: after a run ends, the next run goes ahead', async () => {
    const w = world(['c01-clean'])
    expect((await runOnce(w)).result).toEqual({ ok: true })
    fs.rmSync(path.join(w.outbox, 'c01-clean.json'))
    expect((await runOnce(w)).result).toEqual({ ok: true })
    expect(callsFor(w, 'c01-clean')).toHaveLength(2)
  })
})

// ---------- source rules (shape only; the spies and the decoy above prove the behaviour) ----------

/** Problems in a launcher source: node:fs imported any way but the default import, or a process stopped by name. */
function sourceProblems(text: string): string[] {
  const problems: string[] = []
  if (/from\s+['"](?:node:)?fs\/promises['"]|require\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/.test(text)) problems.push('fs/promises or require')
  if (/import\s*(?:type\s+)?\{[^}]*\}\s*from\s*['"](?:node:)?fs['"]/.test(text) && !/import\s+type\s*\{[^}]*\}\s*from\s*['"](?:node:)?fs['"]/.test(text)) problems.push('a named fs import')
  if (/import\s+\*\s+as\s+\w+\s+from\s*['"](?:node:)?fs['"]/.test(text)) problems.push('a namespace fs import')
  if (/import\s+\w+\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]fs['"]/.test(text)) problems.push("fs without the node: prefix")
  if (/import\s+\w+\s*,\s*\{[^}]*\}\s*from\s*['"]node:fs['"]/.test(text)) problems.push('a named fs import')
  if (/\b(?:pkill|killall|taskkill)\b/i.test(text)) problems.push('a process stopped by name')
  // A509 gap 9 (the same forms as tools/shell-rules.mjs): a shell option other than false, or exec/execSync
  if (/\bshell\s*:(?!\s*false\b)/.test(text)) problems.push('a shell option other than false')
  if (/import\s*\{[^}]*\b(?:exec|execSync)\b[^}]*\}\s*from\s*['"](?:node:)?child_process['"]/.test(text) || /(?<![.\w])(?:exec|execSync)\s*\(|\b(?:child_process|childProcess|cp)\.(?:exec|execSync)\s*\(/.test(text)) {
    problems.push('exec or execSync (always a shell)')
  }
  return problems
}

describe('ARC-22 R96 SEC-10 the launcher sources: node:fs by its default import only, no process stopped by name, no shell', () => {
  test('ARC-22 rule: planted sources are each caught; the default import alone is not', () => {
    expect(sourceProblems("import { readFileSync } from 'node:fs'")).toContain('a named fs import')
    expect(sourceProblems("import fs, { readFileSync } from 'node:fs'")).toContain('a named fs import')
    expect(sourceProblems("import * as fs from 'node:fs'")).toContain('a namespace fs import')
    expect(sourceProblems("import { writeFile } from 'node:fs/promises'")).toContain('fs/promises or require')
    expect(sourceProblems("import fs from 'fs'")).toContain('fs without the node: prefix')
    expect(sourceProblems("execFileSync('pkill', ['-f', 'claude'])")).toContain('a process stopped by name')
    expect(sourceProblems("spawnSync('taskkill', ['/IM', 'claude.exe'])")).toContain('a process stopped by name')
    expect(sourceProblems("import fs from 'node:fs'\nchild.kill()")).toEqual([])
  })

  test('SEC-10 A509 rule: a truthy shell option and exec or execSync are each caught; shell false, execFile and RegExp exec are not', () => {
    const opt = (value: string): string => `spawn(bin, args, { ${'sh' + 'ell'}: ${value} })`
    expect(sourceProblems(opt("process.platform === 'win32'"))).toContain('a shell option other than false')
    expect(sourceProblems(opt('true'))).toContain('a shell option other than false')
    expect(sourceProblems(`import { ${'exec' + 'Sync'} } from 'node:child_process'`)).toContain('exec or execSync (always a shell)')
    expect(sourceProblems(`import { exec } from 'node:child_process'`)).toContain('exec or execSync (always a shell)')
    expect(sourceProblems(`child_process.${'exec' + 'Sync'}('claude -p')`)).toContain('exec or execSync (always a shell)')
    expect(sourceProblems(opt('false'))).toEqual([])
    expect(sourceProblems("import { spawn, execFile } from 'node:child_process'\nconst m = /x/.exec(text)\nexecFile(bin, args)")).toEqual([])
  })

  test('ARC-22 R96 SEC-10 no source under src/modules/ai/project/ imports node:fs except as its default import, stops a process by name, or uses a shell', () => {
    const dir = path.join(REPO_ROOT, 'src', 'modules', 'ai', 'project')
    const files = listTree(dir).filter((f) => /\.(?:ts|mts|mjs|js)$/.test(f) && !/\.test\.ts$/.test(f) && !f.split('/').some((p) => p.startsWith('__')))
    expect(files).toContain('index.ts')
    const found = files.flatMap((f) => sourceProblems(readOwnSource(path.relative(process.cwd(), path.join(dir, f)))).map((p) => `${f}: ${p}`))
    expect(found).toEqual([])
  })
})

test('SEC-10 every inbox fixture file name is a valid A04 job id, so the launcher reads each by its name', () => {
  const names = fs.readdirSync(path.join(FIXTURES_DIR, 'inbox'))
  expect(names).toContain('dotdot-escape.json')
  for (const n of names) expect(AiJobIdSchema.safeParse(path.parse(n).name).success, n).toBe(true)
})
