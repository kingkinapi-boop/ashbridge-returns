// @mutate
// The two engines (ARC-6): `recorded` replays stored answers and is the default; `project` hands the job
// to the Claude project through the exchange folder (ARC-22). There is no API engine (decision 0008).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { aiStepSchemas } from '../../../contracts/ai'
import { readRegularFile } from '../../../core/safe-read'
import {
  AiJobIdSchema,
  InboxFileSchema,
  OUTBOX_MAX_BYTES,
  OutboxFileSchema,
  OutboxRefusalSchema,
  RecordingSchema,
  inputHashOf,
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

/** Logs a flagged file once per name and content (an unreadable entry: per name and error code). Names only, never content. */
function logOnce(ctx: EngineContext, line: string, detail: string | undefined): void {
  const key = JSON.stringify([line, detail])
  if (ctx.seen.has(key)) return
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
    logOnce(ctx, `ai exchange: ignored recording ${name}: ${reason}`, detail)
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
const REFUSED_BY_PROJECT = 'the Claude project refused the job: '

type Own = { done: true; result: EngineResult } | { done: false }

/** The own file is not what a result looks like: the job fails at once, naming the file and the cause (never content). */
const ownFails = (jobId: string, cause: string): Own => ({
  done: true,
  result: refuse(`the outbox file ${jobId}.json is ${cause} (ARC-22)`),
})

/** This job's own outbox file: a result or a refusal ends the wait; anything else at that name fails the job. */
function readOwn(jobId: string, outbox: string): Own {
  const read = readRegularFile(path.join(outbox, `${jobId}.json`), OUTBOX_MAX_BYTES)
  if (!read.ok) {
    if (read.reason === 'gone') return { done: false }
    return ownFails(jobId, read.reason === 'too-big' ? `too big (more than ${String(OUTBOX_MAX_BYTES)} bytes)` : 'not a file')
  }
  const json = tryParse(read.text)
  if (!json.ok) return ownFails(jobId, 'not JSON')
  const result = OutboxFileSchema.safeParse(json.value)
  if (result.success) {
    if (result.data.jobId !== jobId) return ownFails(jobId, 'for another job')
    return { done: true, result: { ok: true, output: result.data.output, stamp: result.data.stamp } }
  }
  const refusal = OutboxRefusalSchema.safeParse(json.value)
  if (!refusal.success) return ownFails(jobId, 'not one result or refusal')
  if (refusal.data.jobId !== jobId) return ownFails(jobId, 'for another job')
  const { reason, problems, stage } = refusal.data.refusal
  return { done: true, result: { ok: false, reason: `${REFUSED_BY_PROJECT}${reason}`, problems, counted: stage === 'output' } }
}

/** Every other entry in the outbox is looked at, never opened, and logged once by quoted name, size and time. */
function logStrangers(jobId: string, ctx: EngineContext, outbox: string): void {
  for (const name of fs.readdirSync(outbox)) {
    if (name === `${jobId}.json` || (ctx.waiting.get(path.parse(name).name) ?? 0) > 0) continue
    let looked: fs.Stats
    try {
      looked = fs.lstatSync(path.join(outbox, name))
    } catch {
      continue
    }
    logOnce(ctx, `ai exchange: ignored outbox file ${JSON.stringify(name)}`, `${String(looked.size)}:${String(looked.mtimeMs)}`)
  }
}

/** A folder of the exchange that must be a real folder inside the exchange folder's real path (made when missing). */
function realFolder(root: string, name: 'inbox' | 'outbox'): string | undefined {
  const dir = path.join(root, name)
  try {
    fs.mkdirSync(dir, { recursive: true })
    const looked = fs.lstatSync(dir)
    if (looked.isDirectory() && fs.realpathSync(dir) === path.join(fs.realpathSync(root), name)) return dir
  } catch {
    return undefined
  }
  return undefined
}

async function projectRun(job: AiJob, ctx: EngineContext): Promise<EngineResult> {
  const { jobId, exchangeDir } = ctx
  if (jobId === undefined || jobId.trim() === '') return refuse('the project engine needs a job id (the inbox file is named by it)')
  if (exchangeDir === undefined || exchangeDir.trim() === '') return refuse('the project engine is off: AI_EXCHANGE_DIR is not set')
  // SEC-10: the id becomes a file name in a folder another process writes; it is never printed.
  if (!AiJobIdSchema.safeParse(jobId).success) return refuse('the job id is not a safe file name (SEC-10)')
  const inboxFile: InboxFile = InboxFileSchema.parse({
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
  fs.mkdirSync(exchangeDir, { recursive: true })
  const inbox = realFolder(exchangeDir, 'inbox')
  if (inbox === undefined) return refuse('the exchange inbox folder is not a real folder (ARC-22)')
  const outbox = realFolder(exchangeDir, 'outbox')
  if (outbox === undefined) return refuse('the exchange outbox folder is not a real folder (ARC-22)')
  // written beside the inbox under a name nobody can predict (flag wx: never into an existing file or link), then renamed in
  const staging = path.join(exchangeDir, `.staging-${jobId}-${crypto.randomBytes(8).toString('hex')}.json`)
  fs.writeFileSync(staging, JSON.stringify(inboxFile, null, 2), { flag: 'wx' })
  fs.renameSync(staging, path.join(inbox, `${jobId}.json`))
  ctx.waiting.set(jobId, (ctx.waiting.get(jobId) ?? 0) + 1)
  try {
    for (;;) {
      if (ctx.now().getTime() >= ctx.deadline.getTime()) return refuse(DEADLINE_REASON)
      const own = readOwn(jobId, outbox)
      if (own.done) return own.result
      logStrangers(jobId, ctx, outbox)
      await sleep(ctx.pollMs)
    }
  } finally {
    const left = (ctx.waiting.get(jobId) ?? 1) - 1
    if (left > 0) ctx.waiting.set(jobId, left)
    else ctx.waiting.delete(jobId)
  }
}

/** The runner calls these at call time (`aiEngines[name].run`), so a spy on either counts the calls. */
export const aiEngines = {
  recorded: { run: (job: AiJob, ctx: EngineContext): Promise<EngineResult> => Promise.resolve(recordedRun(job, ctx)) },
  project: { run: (job: AiJob, ctx: EngineContext): Promise<EngineResult> => projectRun(job, ctx) },
}
