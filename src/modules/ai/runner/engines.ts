// @mutate
// The two engines (ARC-6): `recorded` replays stored answers and is the default; `project` hands the job
// to the Claude project through the exchange folder (ARC-22). There is no API engine (decision 0008).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { aiStepSchemas, validateAiOutput } from '../../../contracts/ai'
import { readRegularFile } from '../../../core/safe-read'
import { isBlank } from '../../../contracts/text'
import {
  AiJobIdSchema,
  EXCHANGE_LIMITS,
  InboxFileSchema,
  OUTBOX_MAX_BYTES,
  OutboxFileSchema,
  OutboxRefusalSchema,
  REPO_ROOT,
  RecordingSchema,
  inputHashOf,
  isRedacted,
  readUtf8,
  type AiJob,
  type InboxFile,
} from './schemas'

export type EngineResult =
  | { ok: true; output: unknown; stamp: unknown }
  | { ok: false; reason: string; problems: string[]; /** a refusal at the output stage counts against the step (AI-1) */ counted?: boolean }

export interface EngineContext {
  jobId?: string | undefined
  recordingsDir: string
  exchangeDir?: string | undefined
  pollMs: number
  sink: (line: string) => void
  /** Pollers per job id this runner is waiting on, so a file for another waiting job is not logged as a stranger. */
  waiting: Map<string, number>
  /** The runner's clock (pinned in tests). */
  now: () => Date
  /** The wait ends here: the lease minus a margin (ARC-22). */
  deadline: Date
  /** Outbox files already seen, by name and content, so each is logged once. */
  seen: Set<string>
}

const refuse = (reason: string, problems: string[] = []): EngineResult => ({ ok: false, reason, problems })

type Read = { ok: true; text: string } | { ok: false; code: string | undefined }

/** A file read, or why not (the error code only, never a path). */
function tryRead(file: string): Read {
  try {
    return { ok: true, text: readUtf8(file) }
  } catch (e) {
    return { ok: false, code: (e as NodeJS.ErrnoException).code }
  }
}

/**
 * Logs a flagged file once per name and content (an unreadable entry: per name and error code). Names only, never content.
 * At most seenMax are held and logged by name (R104); the first one over is answered with one line saying the rest are not.
 */
function logOnce(ctx: EngineContext, line: string, detail: string | undefined, what: 'recordings' | 'outbox files'): void {
  const key = JSON.stringify([line, detail])
  if (ctx.seen.has(key)) return
  if (ctx.seen.size >= EXCHANGE_LIMITS.seenMax) {
    const more = `ai exchange: more than ${String(EXCHANGE_LIMITS.seenMax)} ${what} ignored; the rest are not logged by name (ARC-22)`
    const moreKey = JSON.stringify([more])
    if (ctx.seen.has(moreKey)) return
    ctx.seen.add(moreKey)
    ctx.sink(more)
    return
  }
  ctx.seen.add(key)
  ctx.sink(line)
}

type Json = { ok: true; value: unknown } | { ok: false }

function tryParse(text: string): Json {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    // Stryker disable next-line ObjectLiteral: callers read only `ok`, which is falsy on an empty object too
    return { ok: false }
  }
}

type Recording = z.infer<typeof RecordingSchema>

/** One recording file, or undefined when it is not one (fail closed; the file is logged once by name with the reason). */
function readRecording(ctx: EngineContext, name: string): Recording | undefined {
  const read = tryRead(path.join(ctx.recordingsDir, name))
  const flag = (reason: string, detail: string | undefined): void => {
    logOnce(ctx, `ai exchange: ignored recording ${name}: ${reason}`, detail, 'recordings')
  }
  if (!read.ok) {
    flag(String(read.code), read.code)
    return undefined
  }
  const json = tryParse(read.text)
  if (!json.ok) {
    flag('unparseable', read.text)
    return undefined
  }
  const parsed = RecordingSchema.safeParse(json.value)
  if (!parsed.success) {
    flag('not one recording', read.text)
    return undefined
  }
  return parsed.data
}

function recordedRun(job: AiJob, ctx: EngineContext): EngineResult {
  const inputHash = inputHashOf(job.inputs)
  const names = fs.existsSync(ctx.recordingsDir) ? fs.readdirSync(ctx.recordingsDir).filter((n) => n.endsWith('.json')).sort() : []
  const hits: { name: string; rec: Recording }[] = []
  for (const name of names) {
    const rec = readRecording(ctx, name)
    if (rec?.modelId === job.modelId && rec.promptHash === job.promptHash && rec.inputHash === inputHash) hits.push({ name, rec })
  }
  const [hit, ...more] = hits
  if (hit === undefined) {
    return refuse(`no recorded answer: re-record (model id ${job.modelId}, prompt hash ${job.promptHash}, input hash ${inputHash})`)
  }
  if (more.length > 0) {
    return refuse(`two recordings for one key (ARC-16): ${hits.map((h) => h.name).join(' and ')}; delete one`)
  }
  return { ok: true, output: hit.rec.output, stamp: hit.rec.stamp }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export const DEADLINE_REASON = 'no result from the Claude project before the lease ends (ARC-22)'
/** AI-1: the one sentence for an answer that fails the output check; the runner uses it for every engine. */
export const OUTPUT_CHECK_REASON = 'the answer failed the output check (AI-1)'
const REFUSED_BY_PROJECT = 'the Claude project refused the job: '
const NOT_REDACTED = 'inputs not redacted (AI-9)'
const MKDIR_FAILED = 'the exchange folder could not be made (ARC-22)'
const INBOX_WRITE_FAILED = 'the inbox file could not be written (ARC-22)'
const OUTBOX_READ_FAILED = 'the exchange outbox could not be read (ARC-22)'
const INBOX_NOT_REAL = 'the exchange inbox folder is not a real folder (ARC-22)'
const OUTBOX_NOT_REAL = 'the exchange outbox folder is not a real folder (ARC-22)'
const INSIDE_REPO = 'the exchange folder is inside the repository (ARC-22)'
const NOT_AN_INBOX_FILE = 'the job does not fit the inbox file (ARC-22)'

/** The own file is not what a result looks like: the job fails at once, naming the file and the cause (never content). */
const ownFails = (jobId: string, cause: string): EngineResult => refuse(`the outbox file ${jobId}.json ${cause} (ARC-22)`)

/** This job's own outbox file: a result or a refusal ends the wait; anything else at that name fails the job; none yet is undefined. */
function readOwn(jobId: string, outbox: string): EngineResult | undefined {
  const read = readRegularFile(path.join(outbox, `${jobId}.json`), OUTBOX_MAX_BYTES)
  if (!read.ok) {
    if (read.reason === 'gone') return undefined
    if (read.reason === 'many-links') return ownFails(jobId, 'has more than one link')
    return ownFails(jobId, read.reason === 'too-big' ? `is too big (more than ${String(OUTBOX_MAX_BYTES)} bytes)` : 'is not a file')
  }
  const json = tryParse(read.text)
  if (!json.ok) return ownFails(jobId, 'is not JSON')
  const result = OutboxFileSchema.safeParse(json.value)
  if (result.success) {
    if (result.data.jobId !== jobId) return ownFails(jobId, 'is for another job')
    return { ok: true, output: result.data.output, stamp: result.data.stamp }
  }
  const refusal = OutboxRefusalSchema.safeParse(json.value)
  if (!refusal.success) return ownFails(jobId, 'is not one result or refusal')
  if (refusal.data.jobId !== jobId) return ownFails(jobId, 'is for another job')
  const { reason, problems, stage } = refusal.data.refusal
  return { ok: false, reason: `${REFUSED_BY_PROJECT}${reason}`, problems, counted: stage === 'output' }
}

/** SEC-11: the project engine checks what it gets back against the step's schema itself, so it is safe to call on its own. */
function checkedOutput(job: AiJob, got: { output: unknown; stamp: unknown }): EngineResult {
  const checked = validateAiOutput(job.stepType, got.output, got.stamp)
  if (!checked.ok) return { ok: false, reason: OUTPUT_CHECK_REASON, problems: checked.problems, counted: true }
  return { ok: true, output: checked.data.output, stamp: checked.data.version }
}

/** An entry named for a job this runner waits on (its own `<id>.json`): never a stranger, whoever is waiting for it. */
const isWaitedJsonFile = (ctx: EngineContext, name: string): boolean => name.endsWith('.json') && ctx.waiting.has(name.slice(0, -'.json'.length))

/**
 * What `fn` returns, or undefined when it throws: the error is dropped, because the system's message carries the exchange path.
 * The one place a failed look is turned into "nothing there".
 */
function attempt<T>(fn: () => T): T | undefined {
  // Stryker disable next-line BlockStatement: the catch block returns what an empty one would fall through to; an emptied try block returns the same undefined
  try { return fn() } catch { return undefined }
}

/** One other entry of the outbox: looked at, never opened, and logged once by quoted name, size and time. */
function lookAtStranger(ctx: EngineContext, outbox: string, name: string): void {
  const looked = attempt(() => fs.lstatSync(path.join(outbox, name)))
  if (looked === undefined) return
  logOnce(ctx, `ai exchange: ignored outbox file ${JSON.stringify(name)}`, `${String(looked.size)}:${String(looked.mtimeMs)}`, 'outbox files')
}

/**
 * One poll's look at the other entries of the outbox, in a bounded batch (R104): at most strangerBatch are looked at, and
 * the next poll carries on after them (the cursor); the listing is read in buffers of the same size. 'unreadable' when it cannot be read.
 */
function logStrangers(ctx: EngineContext, outbox: string, cursor: { passed: number }): 'unreadable' | undefined {
  const { strangerBatch } = EXCHANGE_LIMITS
  const dir = attempt(() => fs.opendirSync(outbox, { bufferSize: strangerBatch }))
  if (dir === undefined) return 'unreadable'
  try {
    let met = 0
    let looked = 0
    for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
      if (isWaitedJsonFile(ctx, entry.name)) continue
      met++
      if (met <= cursor.passed) continue
      if (looked === strangerBatch) {
        cursor.passed += looked
        return undefined
      }
      lookAtStranger(ctx, outbox, entry.name)
      looked++
    }
    cursor.passed = 0
    return undefined
  } catch {
    return 'unreadable'
  } finally {
    dir.closeSync()
  }
}

/** The real path a folder has, or would have: the nearest folder that exists, resolved, with the missing names put back. */
function realPathOrAncestor(folder: string): string {
  const real = attempt(() => fs.realpathSync(folder))
  if (real !== undefined) return real
  const up = path.dirname(folder)
  return up === folder ? folder : path.join(realPathOrAncestor(up), path.basename(folder))
}

/** N6: the exchange folder (by real path) lies inside the repository, where a commit could pick it up. */
export function insideRepo(exchangeDir: string, repoRoot: string = REPO_ROOT): boolean {
  const rel = path.relative(realPathOrAncestor(repoRoot), realPathOrAncestor(path.resolve(exchangeDir)))
  // Stryker disable next-line ConditionalExpression,BooleanLiteral: path.relative gives an absolute path only across Windows drives, which a posix run cannot reach
  if (path.isAbsolute(rel)) return false
  return !(rel === '..' || rel.startsWith(`..${path.sep}`))
}

/**
 * A folder of the exchange that must be a real folder inside the exchange folder's real path. Made first when `make` is set
 * (mode 0700); a poll or a rename only looks, so a folder that has gone is refused, never made again (L3).
 */
function realFolder(root: string, name: 'inbox' | 'outbox', make: boolean): string | undefined {
  const dir = path.join(root, name)
  const real = attempt(() => {
    if (make) fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    return fs.realpathSync(dir) === path.join(fs.realpathSync(root), name)
  })
  return real === true ? dir : undefined
}

async function projectRun(job: AiJob, ctx: EngineContext): Promise<EngineResult> {
  const { jobId, exchangeDir } = ctx
  // AI-9, SEC-11: no redaction stamp, no exchange file, whoever calls the engine.
  if (!isRedacted(job)) return refuse(NOT_REDACTED)
  if (jobId === undefined || isBlank(jobId)) return refuse('the project engine needs a job id (the inbox file is named by it)')
  if (exchangeDir === undefined || isBlank(exchangeDir)) return refuse('the project engine is off: AI_EXCHANGE_DIR is not set')
  // SEC-10: the id becomes a file name in a folder another process writes; it is never printed.
  if (!AiJobIdSchema.safeParse(jobId).success) return refuse('the job id is not a safe file name (SEC-10)')
  if (insideRepo(exchangeDir)) return refuse(INSIDE_REPO)
  const inboxText = InboxFileSchema.safeParse({
    jobId,
    stepType: job.stepType,
    promptVersion: job.promptVersion,
    promptHash: job.promptHash,
    modelId: job.modelId,
    inputHash: inputHashOf(job.inputs),
    schema: z.toJSONSchema(aiStepSchemas[job.stepType]),
    redaction: job.redaction,
    isTest: job.isTest,
    ocrEngine: job.ocrEngine,
    ocrEngineVersion: job.ocrEngineVersion,
    mappingRelease: job.mappingRelease,
    inputs: job.inputs,
  })
  if (!inboxText.success) return refuse(NOT_AN_INBOX_FILE)
  const inboxFile: InboxFile = inboxText.data
  // the system's own errors carry the exchange path, so each step answers with a fixed sentence naming the step, never the error
  try {
    fs.mkdirSync(exchangeDir, { recursive: true, mode: 0o700 })
  } catch {
    return refuse(MKDIR_FAILED)
  }
  const inbox = realFolder(exchangeDir, 'inbox', true)
  if (inbox === undefined) return refuse(INBOX_NOT_REAL)
  const outbox = realFolder(exchangeDir, 'outbox', true)
  if (outbox === undefined) return refuse(OUTBOX_NOT_REAL)
  // written beside the inbox under a name nobody can predict (flag wx: never into an existing file or link), then renamed in
  const staging = path.join(exchangeDir, `.staging-${jobId}-${crypto.randomBytes(8).toString('hex')}.json`)
  try {
    fs.writeFileSync(staging, JSON.stringify(inboxFile, null, 2), { flag: 'wx', mode: 0o600 })
  } catch {
    return refuse(INBOX_WRITE_FAILED)
  }
  // L3: both folders are looked at again just before the rename, in case one was swapped for a link since the first look
  if (realFolder(exchangeDir, 'inbox', false) === undefined) return refuse(INBOX_NOT_REAL)
  if (realFolder(exchangeDir, 'outbox', false) === undefined) return refuse(OUTBOX_NOT_REAL)
  try {
    fs.renameSync(staging, path.join(inbox, `${jobId}.json`))
  } catch {
    return refuse(INBOX_WRITE_FAILED)
  }
  const pollers = (by: 1 | -1): void => {
    const n = (ctx.waiting.get(jobId) ?? 0) + by
    if (n > 0) ctx.waiting.set(jobId, n)
    else ctx.waiting.delete(jobId)
  }
  const cursor = { passed: 0 }
  pollers(1)
  try {
    for (;;) {
      // N3: a deadline or clock that is not a valid date compares false, so the wait ends as expired
      if (!(ctx.now().getTime() < ctx.deadline.getTime())) return refuse(DEADLINE_REASON)
      if (realFolder(exchangeDir, 'outbox', false) === undefined) return refuse(OUTBOX_NOT_REAL)
      const own = readOwn(jobId, outbox)
      if (own !== undefined) return own.ok ? checkedOutput(job, own) : own
      if (logStrangers(ctx, outbox, cursor) === 'unreadable') return refuse(OUTBOX_READ_FAILED)
      await sleep(ctx.pollMs)
    }
  } finally {
    pollers(-1)
  }
}

/** The runner calls these at call time (`aiEngines[name].run`), so a spy on either counts the calls. */
export const aiEngines = {
  recorded: { run: (job: AiJob, ctx: EngineContext): Promise<EngineResult> => Promise.resolve(recordedRun(job, ctx)) },
  project: { run: (job: AiJob, ctx: EngineContext): Promise<EngineResult> => projectRun(job, ctx) },
}
