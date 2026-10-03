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
import { loadFactCatalogue } from '../../../contracts/facts'
import { readOwnSource } from '../../../core/testing/read-own-source'
import { AI_JOB_LEASE_MS, AiJobIdSchema, OutboxRefusalSchema } from '../index'
import { AI_LEASE_MARGIN_MS } from '../runner/runner'
import { CLAUDE_TIMEOUT_MS, runAiProjectOnce } from './index'
import {
  FIXTURES_DIR,
  REPO_ROOT,
  VALID_OUTPUT,
  VALID_TEXT,
  callsFor,
  inboxJob,
  inputHashOf,
  listTree,
  makeWorld,
  markerOf,
  outboxOf,
  type FakeControl,
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

async function runOnce(w: World, extra: { claudeTimeoutMs?: number } = {}): Promise<Run> {
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
/** A498: every fact key E03 marks sin or birth_date, from the catalogue (never a hand list). */
const MARKED_KEYS = CATALOGUE.entries.filter((e) => e.sensitive === 'sin' || e.sensitive === 'birth_date').map((e) => e.key)
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

describe('AI-9 SEC-5 A498 a value of a fact E03 marks sin or birth_date, or text after restricted-provided, never reaches the model', SLOW, () => {
  test('AI-9 A498 the marked keys come from E03 catalogue and hold the shareholder SIN, the T4 SIN and the director birth date (sentinels)', () => {
    expect(MARKED_KEYS.length).toBeGreaterThan(0)
    expect(MARKED_KEYS).toEqual(expect.arrayContaining(['shareholder.identity.sin', 't4.slip.employee_sin', 'director.identity.birth_date']))
    expect(ROWS.length).toBe(MARKED_KEYS.length * FORMS.length)
    expect(PLAIN_KEY).toBeDefined()
  })

  test.each(ROWS)('AI-9 SEC-5 A498 a value of the E03-marked fact %s, as %s, is refused at stage input before any call', async (key, _label, plant) => {
    const w = world([])
    writeJob(w.inbox, 'c01-marked-fact.json', cleanJob('a08-marked-fact', 'c01-marked-fact', (j) => { plant(j['inputs'] as Json, key, TAIL) }))
    const { lines } = await runOnce(w)
    const r = refusalOf(w, 'c01-marked-fact')
    expect(r.reason).toMatch(/AI-9/)
    expect(r.stage).toBe('input')
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
  ] as const)('AI-9 SEC-5 A498 text after restricted-provided %s is refused at stage input before any call', async (_label, plant) => {
    const w = world([])
    writeJob(w.inbox, 'c01-marker.json', cleanJob('a08-marker', 'c01-marker', (j) => { plant(j['inputs'] as Json) }))
    const { lines } = await runOnce(w)
    const r = refusalOf(w, 'c01-marker')
    expect(r.reason).toMatch(/AI-9/)
    expect(r.stage).toBe('input')
    expect(w.calls()).toEqual([])
    expect(JSON.stringify(r)).not.toContain('4821')
    expect(lines.join('\n')).not.toMatch(/restricted-provided\s*4821/)
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
  return problems
}

describe('ARC-22 R96 the launcher sources: node:fs by its default import only, no process stopped by name', () => {
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

  test('ARC-22 R96 no source under src/modules/ai/project/ imports node:fs except as its default import, or stops a process by name', () => {
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
