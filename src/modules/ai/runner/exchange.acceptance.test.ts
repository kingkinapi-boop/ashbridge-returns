// A04 round 5 acceptance tests: the exchange folder belongs to another process (spec-writer; builders never edit
// this file). reports/A04-findings-5.md, fix list items 2 to 7 and "Tests to add"; reports/A04-spec-review-5.md G1, G2
// and G5 (A456). Clauses ARC-22 and AI-1 lead; SEC-10 is cited only where a test asserts something is never printed
// or logged.
// FIFO, symlink and newline-name cases need Linux: on win32 they show as skipped by name, and the check quotes them
// passing on the cloud box. Clocks are pinned (the runner's `now` option) and polls run on fake timers.
//
// The shape these tests fix, beside the one at the top of runner.acceptance.test.ts:
//   src/modules/ai/index.ts also exports
//     AiJobIdSchema: a zod string schema, /^[a-z0-9][a-z0-9-]{2,63}$/ and not a Windows device name (con, prn, aux,
//       nul, com0 to com9, lpt0 to lpt9; amber R5-1 as amended by G5). The project engine checks the job id before it writes or makes anything:
//       a blank id keeps "the project engine needs a job id (the inbox file is named by it)"; any other id outside the
//       grammar is refused with exactly "the job id is not a safe file name (SEC-10)". The id is never printed.
//     OUTBOX_MAX_BYTES = 4 MiB (4194304).
//     OutboxRefusalSchema: { jobId, refusal: { reason (non-blank), problems: string[], stage: 'input' | 'run' |
//       'output' } }, strict at every depth (A08 writes it; `stage` is new).
//   createAiRunner options gain `now?: () => Date` (default: `now` from src/core/clock.ts, read at each call, so
//     setClock moves it; never `new Date()` here). runAiStep's ctx gains `deadline?: Date` (default: now() at the call
//     + AI_JOB_LEASE_MS - 10 minutes). Round 5c (A469, reports/A04-findings-6.md): one deadline, one clock. The
//     ai:<step> handler passes only { jobId: ctx.jobId }, so its wait ends at the runner's now() at the call +
//     AI_JOB_LEASE_MS - 10 minutes whatever ctx.now holds (F10 gives the queue and the runner one Clock).
//     Before every outbox read the engine compares now() with the deadline;
//     at or after it the step is refused with exactly DEADLINE below, problems [], not counted; the inbox file stays,
//     and a later attempt takes a result already in the outbox at once.
//   Once a step settles (a result, a refusal, an own-file failure, the deadline) its poll loop has stopped: no timer is
//     left and the outbox is never listed or looked at again for it (G1).
//   node:fs is imported only as `import fs from 'node:fs'` in the runner folder and in src/core/safe-read.ts, so the
//     pass-through spies here see every open and read (G2).
//   EngineContext gains `now: () => Date` and `deadline: Date`; `waiting` becomes a Map<string, number> (pollers per
//     job id), so one poller ending never lifts another's stranger suppression.
//   inbox/ and outbox/ must be real folders (lstat, inside the exchange folder's real path), else the step is refused
//     with a reason naming the folder ("inbox" or "outbox") and "is not a real folder", and nothing is written. The
//     inbox file is staged as `.staging-<job id>-<random>.json`, opened with flag `wx`, then renamed in.
//   The outbox: every entry but <job id>.json is lstat'd only, never opened, and logged once per name, size and mtime
//     as exactly `ai exchange: ignored outbox file ${JSON.stringify(name)}` (unless it is named for a job this runner
//     waits on). <job id>.json is read with readRegularFile(file, OUTBOX_MAX_BYTES) (src/core/safe-read.ts):
//       { jobId, output, stamp } for this job: checked as before (AI-1, AI-10);
//       { jobId, refusal } for this job: refused at once with `the Claude project refused the job: ${refusal.reason}`
//         and the file's problems, counted against the step only when stage is 'output' (AI-1);
//       anything else fails at once, problems [], not counted, the reason naming the file, "ARC-22" and its cause:
//         'not a file', 'too big' (with OUTBOX_MAX_BYTES in bytes), 'not JSON', 'not one result or refusal',
//         'another job'; never the file's content, another job's id or the exchange folder.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { z } from 'zod'
import * as aiIndex from '../index'
import { setClock, systemClock } from '../../../core/clock'
import { readOwnSource } from '../../../core/testing/read-own-source'
import { AI_JOB_LEASE_MS, createAiRunner, createAiStepHandler } from '../index'
import { RECORDINGS_DIR, collectLines, filesIn, job, outboxResult, recording, tempDir, tripleOf, writeApproved, writeOutbox } from './__fixtures__/harness'

const JOB_ID = 'job-c01-finding-test'
const NEEDS_JOB_ID = 'the project engine needs a job id (the inbox file is named by it)'
const UNSAFE_ID = 'the job id is not a safe file name (SEC-10)'
const DEADLINE = 'no result from the Claude project before the lease ends (ARC-22)'
const REFUSED_BY_PROJECT = 'the Claude project refused the job: '
const MIB_4 = 4 * 1024 * 1024
const MARGIN_MS = 10 * 60_000
const T0 = Date.parse('2026-10-03T09:00:00.000Z')
const HOUR = 60 * 60_000
/** True on Windows, where the FIFO, symlink and newline-name cases are skipped by name (they run on the Linux cloud box). */
const onWin32 = process.platform === 'win32'

/** Round 5 exports, read by name so a missing one fails its tests with this reason (typecheck stays green before the build). */
function exported(name: string): unknown {
  const all: Readonly<Record<string, unknown>> = aiIndex
  const value = all[name]
  if (value === undefined) throw new Error(`src/modules/ai/index.ts does not export ${name} yet (A04 round 5)`)
  return value
}
const idSchema = (): z.ZodType<string> => exported('AiJobIdSchema') as z.ZodType<string>
const outboxMax = (): number => exported('OUTBOX_MAX_BYTES') as number
const refusalSchema = (): z.ZodType => exported('OutboxRefusalSchema') as z.ZodType

const GOOD = (): ReturnType<typeof recording> => recording('finding-c01-good')

let tmp: { dir: string; cleanup: () => void }
let exchange: string
let approvedPath: string
let clockMs: number
const now = (): Date => new Date(clockMs)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  tmp = tempDir('exchange')
  exchange = path.join(tmp.dir, 'exchange-canary-value')
  fs.mkdirSync(exchange)
  approvedPath = writeApproved(tmp.dir, [tripleOf(job('good'))])
  clockMs = T0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  tmp.cleanup()
})

type RunnerOptions = Parameters<typeof createAiRunner>[0]
type Runner = ReturnType<typeof createAiRunner>
type StepResult = Awaited<ReturnType<Runner['runAiStep']>>

/** A runner on the project engine against the temp exchange folder, its clock pinned to `clockMs`. */
function projectRunner(extra: Partial<RunnerOptions> = {}): Runner {
  const options = { recordingsDir: RECORDINGS_DIR, approvedPath, env: { AI_EXCHANGE_DIR: exchange }, pollMs: 5, now, ...extra }
  const r = createAiRunner(options)
  expect(r.useEngine('project')).toEqual({ ok: true })
  return r
}

/** Starts a step with an optional deadline (the round 5 ctx field). */
function start(r: Runner, jobId: string | undefined, deadline?: Date): Promise<StepResult> {
  const ctx = { ...(jobId === undefined ? {} : { jobId }), ...(deadline === undefined ? {} : { deadline }) }
  return r.runAiStep(job('good'), ctx)
}

interface Tracked<T> {
  promise: Promise<T>
  settled: () => boolean
}
function track<T>(promise: Promise<T>): Tracked<T> {
  let done = false
  promise.then(
    () => { done = true },
    () => { done = true },
  )
  return { promise, settled: () => done }
}

async function polls(n: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(5)
}

/** The step's result once it settles within `n` polls; a step still waiting fails here by name. */
async function within<T>(promise: Promise<T>, n: number): Promise<T> {
  const t = track(promise)
  await polls(0)
  for (let i = 0; i < n && !t.settled(); i++) await vi.advanceTimersByTimeAsync(5)
  if (!t.settled()) throw new Error(`the step is still waiting after ${String(n)} polls`)
  return promise
}

const outbox = (): string => path.join(exchange, 'outbox')
const inbox = (): string[] => filesIn(path.join(exchange, 'inbox'))
const own = (id = JOB_ID): string => path.join(outbox(), `${id}.json`)
const goodResult = (id = JOB_ID): string => outboxResult(id, GOOD().output, GOOD().stamp)

function mkfifo(file: string): void {
  execFileSync('mkfifo', [file], { timeout: 5000 })
}

/** Every file and folder under `root`, with its kind and size (a before-and-after listing). */
function listing(root: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name)
      const st = fs.lstatSync(p)
      out.push(`${path.relative(root, p)} ${st.isDirectory() ? 'dir' : st.isSymbolicLink() ? 'link' : 'file'} ${String(st.isDirectory() ? 0 : st.size)}`)
      if (st.isDirectory()) walk(p)
    }
  }
  walk(root)
  return out
}

/** Pass-through spies on every node:fs call that writes or makes something. */
function watchWrites(): { calls: () => number } {
  const names = ['writeFileSync', 'mkdirSync', 'renameSync', 'writeSync', 'symlinkSync', 'copyFileSync', 'appendFileSync'] as const
  const spies = names.map((n) => vi.spyOn(fs, n))
  return { calls: () => spies.reduce((sum, s) => sum + s.mock.calls.length, 0) }
}

/**
 * Every path node:fs is asked to open or read whole from now on (pass-through). One guard: opening a FIFO would block
 * the test worker for good on Linux, so such a call is noted and then refused with a planted error; a build that opens
 * one fails its "never opened" assertion by name instead of hanging the run.
 */
function watchOpens(): { paths: string[] } {
  const paths: string[] = []
  const lstatSync = fs.lstatSync.bind(fs)
  const note = (p: unknown): void => {
    const text = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString('utf8') : undefined
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
  const openSync = fs.openSync.bind(fs)
  vi.spyOn(fs, 'openSync').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
    note(p)
    return (openSync as (...a: unknown[]) => number)(p, ...rest)
  }))
  const readFileSync = fs.readFileSync.bind(fs)
  vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown, ...rest: unknown[]) => {
    note(p)
    return (readFileSync as (...a: unknown[]) => unknown)(p, ...rest)
  }) as typeof fs.readFileSync)
  const promisesOpen = fs.promises.open.bind(fs.promises)
  vi.spyOn(fs.promises, 'open').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
    note(p)
    return (promisesOpen as (...a: unknown[]) => unknown)(p, ...rest)
  }) as typeof fs.promises.open)
  const promisesReadFile = fs.promises.readFile.bind(fs.promises)
  vi.spyOn(fs.promises, 'readFile').mockImplementation(((p: unknown, ...rest: unknown[]) => {
    note(p)
    return (promisesReadFile as (...a: unknown[]) => unknown)(p, ...rest)
  }) as typeof fs.promises.readFile)
  // G2: the callback and stream forms too, so a read by any of them is seen (pass-through).
  const open = fs.open.bind(fs)
  vi.spyOn(fs, 'open').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
    note(p)
    ;(open as (...a: unknown[]) => void)(p, ...rest)
  }))
  const readFile = fs.readFile.bind(fs)
  vi.spyOn(fs, 'readFile').mockImplementation(((p: unknown, ...rest: unknown[]) => {
    note(p)
    ;(readFile as (...a: unknown[]) => void)(p, ...rest)
  }))
  const createReadStream = fs.createReadStream.bind(fs)
  vi.spyOn(fs, 'createReadStream').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
    note(p)
    return (createReadStream as (...a: unknown[]) => fs.ReadStream)(p, ...rest)
  }))
  return { paths }
}

/** True when `p` names the outbox folder or something in it. */
function inOutbox(p: unknown): boolean {
  const text = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString('utf8') : p instanceof URL ? p.pathname : undefined
  if (text === undefined) return false
  const abs = path.resolve(text)
  const root = path.resolve(outbox())
  return abs === root || abs.startsWith(root + path.sep)
}

/** Counts every listing or look at the outbox from now on (pass-through). */
function watchOutboxLooks(): { calls: () => number } {
  let n = 0
  const sync = ['readdirSync', 'lstatSync', 'statSync', 'opendirSync', 'existsSync'] as const
  for (const name of sync) {
    const real = (fs[name] as (...a: unknown[]) => unknown).bind(fs)
    vi.spyOn(fs, name).mockImplementation(((p: unknown, ...rest: unknown[]) => {
      if (inOutbox(p)) n++
      return real(p, ...rest)
    }) as never)
  }
  const later = ['readdir', 'lstat', 'stat', 'opendir'] as const
  for (const name of later) {
    const real = (fs.promises[name] as (...a: unknown[]) => unknown).bind(fs.promises)
    vi.spyOn(fs.promises, name).mockImplementation(((p: unknown, ...rest: unknown[]) => {
      if (inOutbox(p)) n++
      return real(p, ...rest)
    }) as never)
  }
  return { calls: () => n }
}

/** G1: a settled step has stopped polling: ten more polls leave no timer and never list or look at the outbox again. */
async function expectStopped(): Promise<void> {
  const looks = watchOutboxLooks()
  await polls(10)
  expect(vi.getTimerCount(), 'timers left after the step settled').toBe(0)
  expect(looks.calls(), 'outbox listings or looks after the step settled').toBe(0)
}

/** An own-file failure: the file and the cause named, ARC-22, no problems, nothing counted, nothing leaked, polling stopped (G1). */
async function expectOwnFileFails(r: Runner, res: StepResult, cause: string, secrets: readonly string[] = []): Promise<void> {
  expect(res.ok).toBe(false)
  if (res.ok) return
  expect(res.reason).toContain(`${JOB_ID}.json`)
  expect(res.reason).toContain(cause)
  expect(res.reason).toMatch(/\bARC-22\b/)
  expect(res.problems).toEqual([])
  expect(res.reason).not.toContain(exchange)
  for (const s of secrets) expect(res.reason).not.toContain(s)
  expect(r.refusals('finding')).toBe(0)
  await expectStopped()
}

// ---------- ARC-22: the job id is a safe file name before anything is written (fix 2; G5 the grammar as a class) ----------

const BLANK_IDS: readonly string[] = ['', '  ']
const UNSAFE_IDS: readonly string[] = [
  '../x',
  'a/b',
  'a\\b',
  'C:x',
  '/abs',
  '.x',
  'Job-1',
  'a.b',
  'a b',
  'a\nb',
  'a'.repeat(65),
  'ab',
  '-ab',
  'nul',
  'con',
  'aux',
  'prn',
  'com1',
  'lpt9',
  // G5 (reports/A04-spec-review-5.md): a regex with the m flag accepts the two newline ids; the rest are lookalikes.
  'abc\n',
  'abc\nxyz',
  'a\u0000bc',
  '\uff41bc', // a full-width "a"
  'abc.',
  'abc ',
]
/** Windows device names (Microsoft's current reserved list, com0 and lpt0 included; R5-1 as amended by G5). */
const ID_ALPHABET: readonly string[] = Array.from('abcdefghijklmnopqrstuvwxyz0123456789-')
const DEVICE_NAMES: readonly string[] = [
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 10 }, (_, i) => `com${String(i)}`),
  ...Array.from({ length: 10 }, (_, i) => `lpt${String(i)}`),
]
/** Every id the engine must refuse, each once (the round 5 rows keep their test names). */
const REFUSED_IDS: readonly string[] = [...new Set([...BLANK_IDS, ...UNSAFE_IDS, ...DEVICE_NAMES])]
/** Every job id an A04 test uses, and every A08 fixture id but dotdot-escape.json's "../escape" (A08's own refusal case). */
const FIXTURE_IDS: readonly string[] = [
  JOB_ID,
  'job-c01-after-switch-test',
  'job-c01-handler-stamp-test',
  'job-c01-first-test',
  'job-c01-second-test',
  'job-c01-done-first-test',
  'job-c01-after-it-test',
  'job-folder-entry-test',
  'job-stranger-rewritten-test',
  'job-nobody-is-waiting-on-test',
  'job-someone-else-test',
  'job-c01-two-pollers-test',
  'job-c01-bystander-test',
  'c01-answer-no-model',
  'c01-answer-not-json',
  'c01-answer-other-model',
  'c01-answer-schema',
  'c01-bank',
  'c01-clean',
  'c01-dob',
  'c01-injected',
  'c01-not-test',
  'c01-planted-sin',
  'c01-unapproved',
  'c01-unredacted',
]
const HEX_ID = '0192a3b4c5d6000a1b2c3d4e' // the shape of core newId(): 12 + 4 + 8 hex digits

describe('ARC-22 the job id is a safe file name, checked before anything is written', () => {
  for (const id of REFUSED_IDS) {
    test(`ARC-22 SEC-10 the job id ${JSON.stringify(id)} is refused, nothing is written anywhere and the id is never printed`, async () => {
      const { lines, sink } = collectLines()
      const r = projectRunner({ sink })
      const before = listing(tmp.dir)
      const writes = watchWrites()
      const res = await within(start(r, id), 0)
      expect(res).toEqual({ ok: false, reason: BLANK_IDS.includes(id) ? NEEDS_JOB_ID : UNSAFE_ID, problems: [] })
      expect(writes.calls()).toBe(0)
      expect(listing(tmp.dir)).toEqual(before)
      expect(fs.existsSync(path.join(process.cwd(), 'inbox'))).toBe(false)
      if (id.trim() !== '') {
        expect(res.ok ? '' : res.reason).not.toContain(id)
        expect(lines.join('\n')).not.toContain(id)
      }
      expect(lines).toEqual(['ai step finding: refused'])
    })
  }

  test('ARC-22 AiJobIdSchema refuses every unsafe, blank and device-name id in the table', () => {
    const schema = idSchema()
    for (const id of REFUSED_IDS) expect(schema.safeParse(id).success, JSON.stringify(id)).toBe(false)
  })

  test('ARC-22 AiJobIdSchema accepts a core newId() shape, every fixture id, and the edges of the grammar (3 and 64 characters)', () => {
    const schema = idSchema()
    for (const id of [HEX_ID, ...FIXTURE_IDS, 'abc', '0-0', 'a'.repeat(64), 'nul1', 'com10', 'lpt10', 'console', 'com0-test']) {
      expect(schema.safeParse(id).success, id).toBe(true)
    }
  })

  test('ARC-22 a job named with a core newId() runs end to end: the inbox file is named by it and the result read', async () => {
    writeOutbox(exchange, `${HEX_ID}.json`, goodResult(HEX_ID))
    const res = await within(start(projectRunner(), HEX_ID), 1)
    expect(res).toMatchObject({ ok: true, output: GOOD().output })
    expect(inbox()).toEqual([`${HEX_ID}.json`])
  })

  /** The reference the schema must equal: the allowlist with no regex flags, minus the device names. */
  const GRAMMAR = /^[a-z0-9][a-z0-9-]{2,63}$/
  const accepts = (id: string): boolean => GRAMMAR.test(id) && !DEVICE_NAMES.includes(id)

  test('ARC-22 the reference itself: no flags on the grammar, and it refuses the G5 rows (a planted m flag would accept two)', () => {
    expect(GRAMMAR.flags).toBe('')
    for (const id of REFUSED_IDS) expect(accepts(id), JSON.stringify(id)).toBe(false)
    const planted = new RegExp(GRAMMAR.source, 'm')
    expect(['abc\n', 'abc\nxyz'].filter((id) => planted.test(id))).toEqual(['abc\n', 'abc\nxyz'])
  })

  test('ARC-22 AiJobIdSchema accepts an id exactly when the reference grammar does (fast-check, seed pinned)', () => {
    const schema = idSchema()
    const tricky = [...ID_ALPHABET, '.', '/', '\\', ':', ' ', '\n', '\u0000', 'A', 'Z', '\u00e9']
    const ids = fc.oneof(
      fc.string({ unit: 'binary', maxLength: 70 }),
      fc.string({ unit: fc.constantFrom(...tricky), maxLength: 70 }),
      fc.string({ unit: fc.constantFrom(...ID_ALPHABET), minLength: 1, maxLength: 70 }),
      fc.constantFrom(...DEVICE_NAMES, 'nul1', 'com10', 'lpt10', 'console'),
    )
    fc.assert(
      fc.property(ids, (id) => {
        expect(schema.safeParse(id).success, JSON.stringify(id)).toBe(accepts(id))
      }),
      { seed: 20261003, numRuns: 2000 },
    )
  })

  test('ARC-22 every accepted id, joined as <id>.json, stays one file name inside the folder under path.posix and path.win32 (fast-check, seed pinned)', () => {
    const schema = idSchema()
    const ids = fc.string({ unit: fc.constantFrom(...ID_ALPHABET), minLength: 3, maxLength: 64 })
    let accepted = 0
    fc.assert(
      fc.property(ids, (id) => {
        if (!schema.safeParse(id).success) return
        accepted++
        const posixDir = '/exchange/outbox'
        const winDir = 'C:\\exchange\\outbox'
        const posixFile = path.posix.join(posixDir, `${id}.json`)
        const winFile = path.win32.join(winDir, `${id}.json`)
        expect(path.posix.dirname(posixFile)).toBe(posixDir)
        expect(path.posix.basename(posixFile)).toBe(`${id}.json`)
        expect(path.win32.dirname(winFile)).toBe(winDir)
        expect(path.win32.basename(winFile)).toBe(`${id}.json`)
      }),
      { seed: 20261003, numRuns: 1000 },
    )
    expect(accepted).toBeGreaterThan(500)
  })
})

// ---------- ARC-22: the own outbox file is read safely; anything but a result or a refusal fails at once (fixes 4 to 6) ----------

describe('ARC-22 the own outbox file is read safely and anything but a result or a refusal fails at once', () => {
  beforeEach(() => {
    fs.mkdirSync(outbox(), { recursive: true })
  })

  test('ARC-22 OUTBOX_MAX_BYTES is 4 MiB', () => {
    expect(outboxMax()).toBe(MIB_4)
  })

  test('ARC-22 a folder at the own name fails within one poll as not a file (restates engines.build.test.ts:50)', async () => {
    fs.mkdirSync(own())
    const r = projectRunner()
    await expectOwnFileFails(r, await within(start(r, JOB_ID), 1), 'not a file')
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a symlink at the own name to a valid result outside fails as not a file, and the target is never opened', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-outside-'))
    try {
      const target = path.join(outside, 'result.json')
      fs.writeFileSync(target, goodResult())
      fs.symlinkSync(target, own())
      const opens = watchOpens()
      const r = projectRunner()
      await expectOwnFileFails(r, await within(start(r, JOB_ID), 1), 'not a file')
      expect(opens.paths).not.toContain(path.resolve(target))
      expect(opens.paths).not.toContain(path.resolve(own()))
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a FIFO at the own name fails within one poll as not a file and is never opened', async () => {
    mkfifo(own())
    const opens = watchOpens()
    const r = projectRunner()
    await expectOwnFileFails(r, await within(start(r, JOB_ID), 1), 'not a file')
    expect(opens.paths).not.toContain(path.resolve(own()))
  }, 30_000) // mkfifo is a child process (testing.md: 30 s or more)

  test('ARC-22 an own file of OUTBOX_MAX_BYTES + 1 bytes fails as too big, naming the cap in bytes, never its content', async () => {
    const canary = 'PLANTED-CANARY-TOO-BIG (Test)'
    const text = outboxResult(JOB_ID, { ...GOOD().output, summary: canary }, GOOD().stamp)
    fs.writeFileSync(own(), text + ' '.repeat(MIB_4 + 1 - Buffer.byteLength(text)))
    expect(fs.statSync(own()).size).toBe(MIB_4 + 1)
    const r = projectRunner()
    const res = await within(start(r, JOB_ID), 1)
    await expectOwnFileFails(r, res, 'too big', [canary])
    expect(res.ok ? '' : res.reason).toContain(String(MIB_4))
  })

  test('ARC-22 an own file of exactly OUTBOX_MAX_BYTES bytes (a valid result padded with spaces) is read', async () => {
    const text = goodResult()
    fs.writeFileSync(own(), text + ' '.repeat(MIB_4 - Buffer.byteLength(text)))
    expect(fs.statSync(own()).size).toBe(MIB_4)
    const res = await within(start(projectRunner(), JOB_ID), 1)
    expect(res).toMatchObject({ ok: true, output: GOOD().output })
  })

  const NEITHER: readonly (readonly [string, (canary: string) => unknown])[] = [
    ['an object of neither shape', (canary) => ({ jobId: JOB_ID, answer: { summary: canary } })],
    ['a refusal without a stage (A08 round 1)', (canary) => ({ jobId: JOB_ID, refusal: { reason: canary, problems: [] } })],
    ['a refusal with an unknown stage', (canary) => ({ jobId: JOB_ID, refusal: { reason: canary, problems: [], stage: 'later' } })],
    ['a refusal with a stray key', (canary) => ({ jobId: JOB_ID, refusal: { reason: canary, problems: [], stage: 'input', extra: 1 } })],
    ['a result with a stray key', (canary) => ({ jobId: JOB_ID, output: GOOD().output, stamp: GOOD().stamp, note: canary })],
  ]
  for (const [label, body] of NEITHER) {
    test(`ARC-22 ${label} at the own name fails at once as not one result or refusal, by name only`, async () => {
      const canary = 'PLANTED-CANARY-NEITHER (Test)'
      writeOutbox(exchange, `${JOB_ID}.json`, JSON.stringify(body(canary)))
      const { lines, sink } = collectLines()
      const r = projectRunner({ sink })
      await expectOwnFileFails(r, await within(start(r, JOB_ID), 1), 'not one result or refusal', [canary])
      expect(lines.join('\n')).not.toContain(canary)
    })
  }

  const OTHER_JOB: readonly (readonly [string, (other: string) => string])[] = [
    ['a result', (other) => outboxResult(other, GOOD().output, GOOD().stamp)],
    ['a refusal', (other) => JSON.stringify({ jobId: other, refusal: { reason: 'inputs not redacted (AI-9)', problems: [], stage: 'input' } })],
  ]
  for (const [label, body] of OTHER_JOB) {
    test(`ARC-22 ${label} for another job at the own name fails at once as for another job, never naming that job`, async () => {
      const other = 'job-someone-else-test'
      writeOutbox(exchange, `${JOB_ID}.json`, body(other))
      const { lines, sink } = collectLines()
      const r = projectRunner({ sink })
      await expectOwnFileFails(r, await within(start(r, JOB_ID), 1), 'another job', [other])
      expect(lines.join('\n')).not.toContain(other)
    })
  }
})

// ---------- ARC-22 AI-1: a refusal file from the Claude project ends the step at once (fix 6) ----------

describe('ARC-22 AI-1 a refusal file from the Claude project ends the step at once', () => {
  const refusal = (stage: string, reason: string, problems: readonly string[]): string =>
    JSON.stringify({ jobId: JOB_ID, refusal: { reason, problems, stage } }, null, 2) + '\n'

  test('AI-1 a refusal at stage output fails at once with the project reason and every problem, and is counted against the step', async () => {
    const problems = ['citations: at least one is required (Test)', 'summary: too long (Test)']
    writeOutbox(exchange, `${JOB_ID}.json`, refusal('output', 'the answer failed the output check (AI-1)', problems))
    const r = projectRunner()
    const res = await within(start(r, JOB_ID), 1)
    expect(res).toEqual({ ok: false, reason: `${REFUSED_BY_PROJECT}the answer failed the output check (AI-1)`, problems })
    expect(r.refusals('finding')).toBe(1)
    await expectStopped()
  })

  for (const stage of ['input', 'run'] as const) {
    test(`ARC-22 a refusal at stage ${stage} fails at once with the project reason and is not counted against the step`, async () => {
      const reason = stage === 'input' ? 'inputs not redacted (AI-9)' : 'the claude program did not finish in time (Test)'
      writeOutbox(exchange, `${JOB_ID}.json`, refusal(stage, reason, []))
      const r = projectRunner()
      const res = await within(start(r, JOB_ID), 1)
      expect(res).toEqual({ ok: false, reason: `${REFUSED_BY_PROJECT}${reason}`, problems: [] })
      expect(r.refusals('finding')).toBe(0)
      await expectStopped()
    })
  }

  test('ARC-22 a refusal that arrives while the step waits ends it on the next poll, and the inbox file stays', async () => {
    const r = projectRunner()
    const t = track(start(r, JOB_ID))
    await polls(4)
    expect(t.settled()).toBe(false)
    writeOutbox(exchange, `${JOB_ID}.json`, refusal('input', 'not approved: run the evaluation set first (AI-11)', []))
    await polls(1)
    expect(t.settled()).toBe(true)
    expect(await t.promise).toEqual({ ok: false, reason: `${REFUSED_BY_PROJECT}not approved: run the evaluation set first (AI-11)`, problems: [] })
    expect(inbox()).toEqual([`${JOB_ID}.json`])
    await expectStopped()
  })

  test('ARC-22 through the handler a refusal throws a message holding the project reason and each problem', async () => {
    const problem = 'citations: at least one is required (Test)'
    writeOutbox(exchange, `${JOB_ID}.json`, refusal('output', 'the answer failed the output check (AI-1)', [problem]))
    const h = createAiStepHandler('finding', projectRunner())
    const run = Promise.resolve().then(() => h.run(job('good'), { jobId: JOB_ID, attempt: 1, now: new Date(T0), returnId: null }))
    const t = track(run)
    await polls(1)
    expect(t.settled()).toBe(true)
    const message = await run.then(
      () => '',
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    )
    expect(message).toContain(`${REFUSED_BY_PROJECT}the answer failed the output check (AI-1)`)
    expect(message).toContain(problem)
    await expectStopped()
  })

  test('ARC-22 OutboxRefusalSchema is strict: the A08 shape with a stage parses; a stray key at either level, a blank reason or an unknown stage does not', () => {
    const schema = refusalSchema()
    const good = { jobId: JOB_ID, refusal: { reason: 'inputs not redacted (AI-9)', problems: [], stage: 'input' } }
    expect(schema.safeParse(good).success).toBe(true)
    for (const stage of ['input', 'run', 'output']) expect(schema.safeParse({ ...good, refusal: { ...good.refusal, stage } }).success, stage).toBe(true)
    expect(schema.safeParse({ ...good, extra: 1 }).success).toBe(false)
    expect(schema.safeParse({ ...good, refusal: { ...good.refusal, extra: 1 } }).success).toBe(false)
    expect(schema.safeParse({ ...good, refusal: { ...good.refusal, reason: '  ' } }).success).toBe(false)
    expect(schema.safeParse({ ...good, refusal: { ...good.refusal, stage: 'later' } }).success).toBe(false)
    expect(schema.safeParse({ jobId: JOB_ID, refusal: { reason: 'x', problems: [] } }).success).toBe(false)
  })
})

// ---------- ARC-22: strangers in the outbox are looked at, never opened (fix 5) ----------

describe('ARC-22 strangers in the outbox are looked at, never opened, and logged quoted', () => {
  beforeEach(() => {
    fs.mkdirSync(outbox(), { recursive: true })
  })

  const ignoredLine = (name: string): string => `ai exchange: ignored outbox file ${JSON.stringify(name)}`

  /** Plants a stranger, runs the step over several polls, then answers it; returns the log lines and the opened paths. */
  async function runBeside(plant: () => void): Promise<{ lines: string[]; opened: string[] }> {
    plant()
    const { lines, sink } = collectLines()
    const opens = watchOpens()
    const t = track(start(projectRunner({ sink }), JOB_ID))
    await polls(6)
    expect(t.settled()).toBe(false)
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult())
    await polls(1)
    expect(t.settled()).toBe(true)
    expect(await t.promise).toMatchObject({ ok: true, output: GOOD().output })
    // G2 liveness: the own file is seen opening, so "never opened" below cannot pass on a blind spy.
    expect(opens.paths).toContain(path.resolve(own()))
    return { lines, opened: opens.paths }
  }

  test('ARC-22 an oversized stranger (OUTBOX_MAX_BYTES + 1) is logged once, quoted, and never opened', async () => {
    const name = 'job-big-stranger-test.json'
    const { lines, opened } = await runBeside(() => {
      fs.writeFileSync(path.join(outbox(), name), Buffer.alloc(MIB_4 + 1, 0x20))
    })
    expect(lines.filter((l) => l.includes(name))).toEqual([ignoredLine(name)])
    expect(opened).not.toContain(path.resolve(outbox(), name))
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a FIFO stranger is logged once, quoted, and never opened (an open would block)', async () => {
    const name = 'job-fifo-stranger-test.json'
    const { lines, opened } = await runBeside(() => {
      mkfifo(path.join(outbox(), name))
    })
    expect(lines.filter((l) => l.includes(name))).toEqual([ignoredLine(name)])
    expect(opened).not.toContain(path.resolve(outbox(), name))
  }, 30_000) // mkfifo is a child process (testing.md: 30 s or more)

  test.skipIf(onWin32)('ARC-22 (Linux) a symlink stranger is logged once, quoted, and neither it nor its target is opened', async () => {
    const name = 'job-link-stranger-test.json'
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-outside-'))
    try {
      const target = path.join(outside, 'secret.json')
      fs.writeFileSync(target, '{"planted":"PLANTED-CANARY-LINK-TARGET (Test)"}')
      const { lines, opened } = await runBeside(() => {
        fs.symlinkSync(target, path.join(outbox(), name))
      })
      expect(lines.filter((l) => l.includes(name))).toEqual([ignoredLine(name)])
      expect(opened).not.toContain(path.resolve(outbox(), name))
      expect(opened).not.toContain(path.resolve(target))
      expect(lines.join('\n')).not.toContain('PLANTED-CANARY-LINK-TARGET')
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a stranger whose name holds a newline is logged once, quoted on one line, so it cannot forge a log line', async () => {
    const name = 'evil\nai step finding: ok.json'
    const { lines, opened } = await runBeside(() => {
      fs.writeFileSync(path.join(outbox(), name), '{}')
    })
    expect(lines.filter((l) => l.includes(JSON.stringify(name)))).toEqual([ignoredLine(name)])
    expect(lines.every((l) => !l.includes('\n'))).toBe(true)
    expect(lines.filter((l) => l === 'ai step finding: ok')).toHaveLength(1)
    expect(opened).not.toContain(path.resolve(outbox(), name))
  })

  test('ARC-22 a regular stranger is never opened either: its size and time are enough to log it once', async () => {
    const name = 'job-plain-stranger-test.json'
    const { lines, opened } = await runBeside(() => {
      fs.writeFileSync(path.join(outbox(), name), outboxResult('job-plain-stranger-test', { summary: 'PLANTED-CANARY-PLAIN (Test)' }, {}))
    })
    expect(lines.filter((l) => l.includes(name))).toEqual([ignoredLine(name)])
    expect(opened).not.toContain(path.resolve(outbox(), name))
  })
})

// ---------- ARC-22: the inbox write cannot be steered by what is in the folder (fix 3) ----------

describe('ARC-22 the inbox write cannot be steered by the exchange folder', () => {
  const oldStaging = (): string => path.join(exchange, `.staging-${JOB_ID}.json`)

  test('ARC-22 a file planted at the old staging name is left alone; the inbox file is the job; no staging file is left behind', async () => {
    const planted = '{"planted":"PLANTED-CANARY-STAGING (Test)"}'
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult()) // first: the harness stages through the same old name
    fs.writeFileSync(oldStaging(), planted)
    const res = await within(start(projectRunner(), JOB_ID), 1)
    expect(res.ok).toBe(true)
    expect(fs.readFileSync(oldStaging(), 'utf8')).toBe(planted)
    const written = JSON.parse(fs.readFileSync(path.join(exchange, 'inbox', `${JOB_ID}.json`), 'utf8')) as Record<string, unknown>
    expect(written['jobId']).toBe(JOB_ID)
    expect(fs.readdirSync(exchange).filter((n) => n.startsWith('.staging-'))).toEqual([path.basename(oldStaging())])
  })

  test.skipIf(onWin32)('ARC-22 (Linux) a symlink planted at the old staging name is not followed: the file it points to is unchanged', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-outside-'))
    try {
      const target = path.join(outside, 'victim.txt')
      fs.writeFileSync(target, 'PLANTED-VICTIM (Test)')
      writeOutbox(exchange, `${JOB_ID}.json`, goodResult()) // first: the harness stages through the same old name
      fs.symlinkSync(target, oldStaging())
      const res = await within(start(projectRunner(), JOB_ID), 1)
      expect(res.ok).toBe(true)
      expect(fs.readFileSync(target, 'utf8')).toBe('PLANTED-VICTIM (Test)')
      expect(fs.readdirSync(outside)).toEqual(['victim.txt'])
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  test('ARC-22 the staging file is .staging-<job id>-<random>.json opened with flag wx, a new name each time', async () => {
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult())
    const staged: { name: string; flag: unknown }[] = []
    const isStaging = (p: unknown): boolean => typeof p === 'string' && path.basename(p).startsWith('.staging-')
    const writeFileSync = fs.writeFileSync.bind(fs)
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((p: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, o?: fs.WriteFileOptions) => {
      if (isStaging(p)) staged.push({ name: path.basename(String(p)), flag: typeof o === 'object' && o !== null ? (o as { flag?: unknown }).flag : undefined })
      writeFileSync(p, data, o)
    }))
    const openSync = fs.openSync.bind(fs)
    vi.spyOn(fs, 'openSync').mockImplementation(((p: fs.PathLike, f?: fs.OpenMode, m?: fs.Mode) => {
      if (isStaging(p)) staged.push({ name: path.basename(String(p)), flag: f })
      return (openSync as (...a: unknown[]) => number)(p, f, m)
    }) as typeof fs.openSync)
    const r = projectRunner()
    expect((await within(start(r, JOB_ID), 1)).ok).toBe(true)
    expect((await within(start(r, JOB_ID), 1)).ok).toBe(true)
    const names = [...new Set(staged.map((s) => s.name))]
    expect(names).toHaveLength(2)
    for (const n of names) expect(n).toMatch(/^\.staging-job-c01-finding-test-[A-Za-z0-9_-]+\.json$/)
    const { O_CREAT, O_EXCL } = fs.constants
    for (const s of staged) {
      const exclusive = s.flag === 'wx' || (typeof s.flag === 'number' && (s.flag & (O_CREAT | O_EXCL)) === (O_CREAT | O_EXCL))
      expect(exclusive, `${s.name} opened with ${String(s.flag)}`).toBe(true)
    }
  })

  for (const folder of ['inbox', 'outbox'] as const) {
    test(`ARC-22 an ${folder} folder that is a link to a folder outside is refused naming it, and nothing is written there or in the inbox`, async () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-outside-'))
      try {
        fs.writeFileSync(path.join(outside, `${JOB_ID}.json`), goodResult())
        fs.symlinkSync(outside, path.join(exchange, folder), process.platform === 'win32' ? 'junction' : 'dir')
        const before = listing(outside)
        const r = projectRunner()
        const res = await within(start(r, JOB_ID), 1)
        expect(res.ok).toBe(false)
        if (!res.ok) {
          expect(res.reason).toContain(folder)
          expect(res.reason).toContain('is not a real folder')
          expect(res.reason).not.toContain(exchange)
          expect(res.reason).not.toContain(outside)
        }
        expect(listing(outside)).toEqual(before)
        if (folder === 'outbox') expect(inbox()).toEqual([])
      } finally {
        fs.rmSync(outside, { recursive: true, force: true })
      }
    })
  }
})

// ---------- ARC-22: the deadline is the lease minus 10 minutes (fix 7) ----------

describe('ARC-22 the wait ends at the lease minus 10 minutes, on the pinned clock', () => {
  test('ARC-22 at the deadline nothing more is read: a result already there is not taken, the reason is given and the inbox file stays', async () => {
    const r = projectRunner()
    const t = track(start(r, JOB_ID, new Date(T0 + 60_000)))
    await polls(3)
    expect(t.settled()).toBe(false)
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult())
    const opens = watchOpens()
    clockMs = T0 + 60_000
    await polls(1)
    expect(t.settled()).toBe(true)
    expect(await t.promise).toEqual({ ok: false, reason: DEADLINE, problems: [] })
    expect(inbox()).toEqual([`${JOB_ID}.json`])
    expect(r.refusals('finding')).toBe(0)
    expect(opens.paths).not.toContain(path.resolve(own()))
    await expectStopped()
  })

  test('ARC-22 one millisecond before the deadline a result is still read', async () => {
    const t = track(start(projectRunner(), JOB_ID, new Date(T0 + 60_000)))
    await polls(3)
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult())
    clockMs = T0 + 60_000 - 1
    await polls(1)
    expect(t.settled()).toBe(true)
    expect(await t.promise).toMatchObject({ ok: true, output: GOOD().output })
    await expectStopped()
  })

  test('ARC-22 a deadline already passed when the step starts: refused at once, the result present is not read', async () => {
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult())
    const r = projectRunner()
    const opens = watchOpens()
    const res = await within(start(r, JOB_ID, new Date(T0 - 1)), 0)
    expect(res).toEqual({ ok: false, reason: DEADLINE, problems: [] })
    expect(opens.paths).not.toContain(path.resolve(own()))
    await expectStopped()
  })

  test('ARC-22 a direct call with no deadline waits until its start + AI_JOB_LEASE_MS - 10 minutes, and no longer', async () => {
    const t = track(start(projectRunner(), JOB_ID))
    await polls(2)
    clockMs = T0 + AI_JOB_LEASE_MS - MARGIN_MS - 1
    await polls(2)
    expect(t.settled()).toBe(false)
    clockMs = T0 + AI_JOB_LEASE_MS - MARGIN_MS
    await polls(1)
    expect(t.settled()).toBe(true)
    expect(await t.promise).toEqual({ ok: false, reason: DEADLINE, problems: [] })
    await expectStopped()
  })

  // Round 5c (A469): ctx.now is the queue's snapshot at the claim; the wait runs on the runner's clock alone. The old
  // case (ctx.now 2 hours earlier), the train 25ea2736 failure (2 days earlier) and a later ctx.now all wait the same.
  for (const [label, offset] of [['2 hours before', -2 * HOUR], ['2 days before', -48 * HOUR], ['2 hours after', 2 * HOUR]] as const) {
    test(`ARC-22 the handler waits on the runner's clock: with ctx.now ${label} it, the wait still ends at the runner's start + AI_JOB_LEASE_MS - 10 minutes`, async () => {
      const h = createAiStepHandler('finding', projectRunner())
      const run = Promise.resolve().then(() => h.run(job('good'), { jobId: JOB_ID, attempt: 1, now: new Date(T0 + offset), returnId: null }))
      const t = track(run)
      await polls(2)
      expect(t.settled(), 'the step ended before the runner-clock deadline').toBe(false)
      clockMs = T0 + AI_JOB_LEASE_MS - MARGIN_MS - 1
      await polls(2)
      expect(t.settled(), 'the step ended 1 ms before the runner-clock deadline').toBe(false)
      clockMs = T0 + AI_JOB_LEASE_MS - MARGIN_MS
      await polls(1)
      expect(t.settled()).toBe(true)
      await expect(run).rejects.toThrow(DEADLINE)
      await expectStopped()
    })
  }

  test('ARC-22 with no `now` option the runner reads src/core/clock.ts: the default deadline follows setClock', async () => {
    const T1 = Date.parse('2031-05-17T06:30:00.000Z') // far from any real date, so the system clock cannot stand in
    let coreMs = T1
    setClock({ now: () => new Date(coreMs) })
    try {
      // R106 exception: the default clock is what this test proves.
      const r = createAiRunner({ recordingsDir: RECORDINGS_DIR, approvedPath, env: { AI_EXCHANGE_DIR: exchange }, pollMs: 5 })
      expect(r.useEngine('project')).toEqual({ ok: true })
      const t = track(start(r, JOB_ID))
      await polls(2)
      expect(t.settled()).toBe(false)
      coreMs = T1 + AI_JOB_LEASE_MS - MARGIN_MS - 1
      await polls(2)
      expect(t.settled(), 'the step ended 1 ms before the core-clock deadline').toBe(false)
      coreMs = T1 + AI_JOB_LEASE_MS - MARGIN_MS
      await polls(1)
      expect(t.settled(), 'the default deadline does not follow src/core/clock.ts').toBe(true)
      expect(await t.promise).toEqual({ ok: false, reason: DEADLINE, problems: [] })
      await expectStopped()
    } finally {
      setClock(systemClock)
    }
  })

  test('ARC-22 the retry takes a result already in the outbox at once (unit twin of the db test): first attempt out of time, second done', async () => {
    const h = createAiStepHandler('finding', projectRunner())
    const first = Promise.resolve().then(() => h.run(job('good'), { jobId: JOB_ID, attempt: 1, now: new Date(T0), returnId: null }))
    const t1 = track(first)
    await polls(2)
    clockMs = T0 + AI_JOB_LEASE_MS - MARGIN_MS
    await polls(1)
    expect(t1.settled()).toBe(true)
    await expect(first).rejects.toThrow(DEADLINE)
    expect(inbox()).toEqual([`${JOB_ID}.json`])
    writeOutbox(exchange, `${JOB_ID}.json`, goodResult())
    clockMs += HOUR
    const second = h.run(job('good'), { jobId: JOB_ID, attempt: 2, now: new Date(clockMs), returnId: null })
    const done = await within(Promise.resolve(second), 0)
    expect(done).toEqual({ output: GOOD().output, stamp: GOOD().stamp })
    await expectStopped()
  })

  for (const ending of ['first', 'second'] as const) {
    test(`ARC-22 two pollers on one job id: when the ${ending} one runs out of time, the other job still does not log the id's file`, async () => {
      const A = 'job-c01-two-pollers-test'
      const B = 'job-c01-bystander-test'
      const { lines, sink } = collectLines()
      const r = projectRunner({ sink })
      const short = new Date(T0 + 20)
      // B polls before the A poller that stays, so B sees A's file first.
      const order: readonly ('a1' | 'a2' | 'b')[] = ending === 'first' ? ['a1', 'b', 'a2'] : ['b', 'a1', 'a2']
      const tracked: Partial<Record<'a1' | 'a2' | 'b', Tracked<StepResult>>> = {}
      for (const who of order) {
        const endsEarly = (who === 'a1' && ending === 'first') || (who === 'a2' && ending === 'second')
        tracked[who] = track(start(r, who === 'b' ? B : A, endsEarly ? short : undefined))
        await polls(0)
      }
      const get = (who: 'a1' | 'a2' | 'b'): Tracked<StepResult> => {
        const t = tracked[who]
        if (t === undefined) throw new Error(`no step ${who}`)
        return t
      }
      const ended = get(ending === 'first' ? 'a1' : 'a2')
      const stays = get(ending === 'first' ? 'a2' : 'a1')
      clockMs = T0 + 20
      await polls(1)
      expect(ended.settled()).toBe(true)
      expect(await ended.promise).toEqual({ ok: false, reason: DEADLINE, problems: [] })
      expect(stays.settled()).toBe(false)
      expect(get('b').settled()).toBe(false)
      writeOutbox(exchange, `${A}.json`, goodResult(A))
      writeOutbox(exchange, `${B}.json`, goodResult(B))
      await polls(1)
      expect(await get('b').promise).toMatchObject({ ok: true, output: GOOD().output })
      expect(await stays.promise).toMatchObject({ ok: true, output: GOOD().output })
      expect(lines.filter((l) => l.includes(`${A}.json`))).toEqual([])
    })
  }
})

// ---------- ARC-22: every open and read goes through node:fs's default export, so the spies above see it (G2) ----------

/** The problems with how one source text imports node:fs: only `import fs from 'node:fs'` is allowed. */
function fsImportProblems(text: string): string[] {
  const problems: string[] = []
  const fromFs = /\bfrom\s+['"](?:node:)?fs(?:\/promises)?['"]/g
  let allowed = 0
  // each import statement up to its own from-clause (lazy, so it never runs into the next statement)
  for (const m of text.matchAll(/^import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const [, what, spec] = m
    if (spec === undefined || !/^(?:node:)?fs(?:\/promises)?$/.test(spec)) continue
    if (what?.startsWith('type ') === true || (what === 'fs' && spec === 'node:fs')) {
      allowed++ // a type-only import has no runtime reads
      continue
    }
    problems.push(`import ${String(what)} from '${spec}'`)
  }
  const plainImports = allowed
  const allFsFroms = [...text.matchAll(fromFs)].length
  if (allFsFroms !== plainImports && problems.length === 0) problems.push('another import or export from node:fs')
  if (/\bcreateRequire\b/.test(text)) problems.push('createRequire')
  if (/\brequire\s*\(\s*['"](?:node:)?fs/.test(text)) problems.push('require of fs')
  if (/\bimport\s*\(\s*['"](?:node:)?fs/.test(text)) problems.push('dynamic import of fs')
  return problems
}

describe('ARC-22 node:fs is imported only as its default export where the exchange is read', () => {
  const FILES = ['src/modules/ai/runner/engines.ts', 'src/modules/ai/runner/runner.ts', 'src/modules/ai/runner/schemas.ts', 'src/modules/ai/index.ts', 'src/core/safe-read.ts']

  test('ARC-22 the scan catches each planted way round the spies, and passes the one allowed form', () => {
    expect(fsImportProblems("import fs from 'node:fs'\nfs.openSync('x', 'r')\n")).toEqual([])
    expect(fsImportProblems("import fs from 'node:fs'\nimport type { Stats } from 'node:fs'\n")).toEqual([])
    expect(fsImportProblems("import crypto from 'node:crypto'\nimport fs from 'node:fs'\nimport path from 'node:path'\n")).toEqual([])
    expect(fsImportProblems("import crypto from 'node:crypto'\nimport {\n  openSync,\n} from 'node:fs'\n")).toEqual(["import {\n  openSync,\n} from 'node:fs'"])
    expect(fsImportProblems("import { openSync } from 'node:fs'\n")).toEqual(["import { openSync } from 'node:fs'"])
    expect(fsImportProblems("import fs, { readSync } from 'node:fs'\n")).toEqual(["import fs, { readSync } from 'node:fs'"])
    expect(fsImportProblems("import * as fs from 'node:fs'\n")).toEqual(["import * as fs from 'node:fs'"])
    expect(fsImportProblems("import fsp from 'node:fs/promises'\n")).toEqual(["import fsp from 'node:fs/promises'"])
    expect(fsImportProblems("import fs from 'fs'\n")).toEqual(["import fs from 'fs'"])
    expect(fsImportProblems("export { openSync } from 'node:fs'\n")).toEqual(['another import or export from node:fs'])
    expect(fsImportProblems("const r = createRequire(import.meta.url)\n")).toEqual(['createRequire'])
    expect(fsImportProblems("const f = require('fs')\n")).toEqual(['require of fs'])
    expect(fsImportProblems("const f = await import('node:fs')\n")).toEqual(['dynamic import of fs'])
  })

  test('ARC-22 engines.ts, runner.ts, schemas.ts, the AI index and src/core/safe-read.ts import node:fs only as `import fs from \'node:fs\'`', () => {
    const found: Record<string, string[]> = {}
    for (const file of FILES) {
      let text: string
      try {
        text = readOwnSource(file)
      } catch {
        found[file] = ['missing']
        continue
      }
      const problems = fsImportProblems(text)
      if (problems.length > 0) found[file] = problems
    }
    expect(found).toEqual({})
    // sentinel: the engine reads the exchange, so it imports node:fs in the allowed form
    expect(readOwnSource('src/modules/ai/runner/engines.ts')).toMatch(/^import fs from 'node:fs'$/m)
  })
})
