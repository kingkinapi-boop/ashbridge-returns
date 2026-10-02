// @mutate
// The two engines (ARC-6): `recorded` replays stored answers and is the default; `project` hands the job
// to the Claude project through the exchange folder (ARC-22). There is no API engine (decision 0008).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { aiStepSchemas } from '../../../contracts/ai'
import {
  InboxFileSchema,
  OutboxFileSchema,
  RecordingSchema,
  inputHashOf,
  type AiJob,
  type InboxFile,
} from './schemas'

export type EngineResult =
  | { ok: true; output: unknown; stamp: unknown }
  | { ok: false; reason: string; problems: string[] }

export interface EngineContext {
  jobId?: string
  recordingsDir: string
  exchangeDir?: string
  pollMs: number
  sink: (line: string) => void
  /** Job ids this runner is waiting on, so a file for another waiting job is not logged as a stranger. */
  waiting: Set<string>
  /** Outbox files already seen, by name and content, so each is logged once. */
  seen: Set<string>
}

const refuse = (reason: string, problems: string[] = []): EngineResult => ({ ok: false, reason, problems })

function recordedRun(job: AiJob, ctx: EngineContext): EngineResult {
  const inputHash = inputHashOf(job.inputs)
  const files = fs.existsSync(ctx.recordingsDir) ? fs.readdirSync(ctx.recordingsDir).filter((n) => n.endsWith('.json')).sort() : []
  for (const name of files) {
    const parsed = RecordingSchema.safeParse(JSON.parse(fs.readFileSync(path.join(ctx.recordingsDir, name), 'utf8')))
    if (!parsed.success) continue
    const rec = parsed.data
    if (rec.modelId === job.modelId && rec.promptHash === job.promptHash && rec.inputHash === inputHash) {
      return { ok: true, output: rec.output, stamp: rec.stamp }
    }
  }
  return refuse(`no recorded answer: re-record (model id ${job.modelId}, prompt hash ${job.promptHash}, input hash ${inputHash})`)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function logOnce(ctx: EngineContext, name: string, text: string): void {
  const signature = `${name}:${crypto.createHash('sha256').update(text).digest('hex')}`
  if (ctx.seen.has(signature)) return
  ctx.seen.add(signature)
  ctx.sink(`ai exchange: ignored outbox file ${name}`)
}

/** Reads the outbox for this job's file; returns its result once there is one valid JSON object for it. */
function readOutbox(jobId: string, ctx: EngineContext, outbox: string): { output: unknown; stamp: unknown } | undefined {
  if (!fs.existsSync(outbox)) return undefined
  let found: { output: unknown; stamp: unknown } | undefined
  for (const name of fs.readdirSync(outbox).filter((n) => n.endsWith('.json')).sort()) {
    let text: string
    try {
      text = fs.readFileSync(path.join(outbox, name), 'utf8')
    } catch {
      continue
    }
    const mine = name === `${jobId}.json`
    if (!mine) {
      if (!ctx.waiting.has(name.slice(0, -'.json'.length))) logOnce(ctx, name, text)
      continue
    }
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      logOnce(ctx, name, text)
      continue
    }
    const result = OutboxFileSchema.safeParse(value)
    if (!result.success || result.data.jobId !== jobId) {
      logOnce(ctx, name, text)
      continue
    }
    found = { output: result.data.output, stamp: result.data.stamp }
  }
  return found
}

async function projectRun(job: AiJob, ctx: EngineContext): Promise<EngineResult> {
  if (ctx.jobId === undefined || ctx.jobId.trim() === '') return refuse('the project engine needs a job id (the inbox file is named by it)')
  if (ctx.exchangeDir === undefined) return refuse('the project engine is off: AI_EXCHANGE_DIR is not set')
  const { jobId } = ctx
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
  const inbox = path.join(ctx.exchangeDir, 'inbox')
  const outbox = path.join(ctx.exchangeDir, 'outbox')
  fs.mkdirSync(inbox, { recursive: true })
  fs.mkdirSync(outbox, { recursive: true })
  // written beside the inbox, then renamed in, so the project never reads half a file
  const staging = path.join(ctx.exchangeDir, `.staging-${jobId}.json`)
  fs.writeFileSync(staging, JSON.stringify(inboxFile, null, 2) + '\n')
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
