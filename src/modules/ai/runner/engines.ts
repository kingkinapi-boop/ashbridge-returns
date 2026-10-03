// @mutate
// The two engines (ARC-6): `recorded` replays stored answers and is the default; `project` hands the job
// to the Claude project through the exchange folder (ARC-22). There is no API engine (decision 0008).
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { aiStepSchemas } from '../../../contracts/ai'
import {
  InboxFileSchema,
  OutboxFileSchema,
  RecordingSchema,
  inputHashOf,
  readUtf8,
  type AiJob,
  type InboxFile,
} from './schemas'

export type EngineResult =
  | { ok: true; output: unknown; stamp: unknown }
  | { ok: false; reason: string; problems: string[] }

export interface EngineContext {
  jobId?: string | undefined
  recordingsDir: string
  exchangeDir?: string | undefined
  pollMs: number
  sink: (line: string) => void
  /** Job ids this runner is waiting on, so a file for another waiting job is not logged as a stranger. */
  waiting: Set<string>
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

/** Reads the outbox for this job's file; returns its result once there is one valid JSON object for it. */
function readOutbox(jobId: string, ctx: EngineContext, outbox: string): { output: unknown; stamp: unknown } | undefined {
  let found: { output: unknown; stamp: unknown } | undefined
  for (const name of fs.readdirSync(outbox)) {
    const ignore = (detail: string | undefined): void => {
      logOnce(ctx, `ai exchange: ignored outbox file ${name}`, detail)
    }
    const read = tryRead(path.join(outbox, name))
    const detail = read.ok ? read.text : read.code
    if (name !== `${jobId}.json`) {
      if (!ctx.waiting.has(path.parse(name).name)) ignore(detail)
      continue
    }
    // Stryker disable next-line ConditionalExpression,BlockStatement: an unreadable file and one that is not JSON are ignored and logged the same way (the folder case is pinned by engines.build.test.ts)
    if (!read.ok) {
      ignore(detail)
      continue
    }
    const json = tryParse(read.text)
    const result = json.ok ? OutboxFileSchema.safeParse(json.value) : undefined
    if (result?.success !== true || result.data.jobId !== jobId) {
      ignore(detail)
      continue
    }
    found = { output: result.data.output, stamp: result.data.stamp }
  }
  return found
}

async function projectRun(job: AiJob, ctx: EngineContext): Promise<EngineResult> {
  const { jobId, exchangeDir } = ctx
  if (jobId === undefined || jobId.trim() === '') return refuse('the project engine needs a job id (the inbox file is named by it)')
  if (exchangeDir === undefined || exchangeDir.trim() === '') return refuse('the project engine is off: AI_EXCHANGE_DIR is not set')
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
  const inbox = path.join(exchangeDir, 'inbox')
  const outbox = path.join(exchangeDir, 'outbox')
  fs.mkdirSync(inbox, { recursive: true })
  fs.mkdirSync(outbox, { recursive: true })
  // written beside the inbox, then renamed in, so the project never reads half a file
  const staging = path.join(exchangeDir, `.staging-${jobId}.json`)
  fs.writeFileSync(staging, JSON.stringify(inboxFile, null, 2))
  fs.renameSync(staging, path.join(inbox, `${jobId}.json`))
  ctx.waiting.add(jobId)
  try {
    for (;;) {
      const got = readOutbox(jobId, ctx, outbox)
      if (got) return { ok: true, ...got }
      await sleep(ctx.pollMs)
    }
  } finally {
    ctx.waiting.delete(jobId)
  }
}

/** The runner calls these at call time (`aiEngines[name].run`), so a spy on either counts the calls. */
export const aiEngines = {
  recorded: { run: (job: AiJob, ctx: EngineContext): Promise<EngineResult> => Promise.resolve(recordedRun(job, ctx)) },
  project: { run: (job: AiJob, ctx: EngineContext): Promise<EngineResult> => projectRun(job, ctx) },
}
