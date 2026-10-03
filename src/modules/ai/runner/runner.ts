// @mutate
// The AI runner (A04): one way for any AI step to run. A job goes in; F04-checked output with its stamp,
// or a refusal with the reason, comes out. Nothing here repairs an output (AI-1). No paid API, no key.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { readSettings } from '../../../core/env'
import { makeLogger } from '../../../core/log'
import { validateAiOutput, versionStampSchema, type VersionStamp } from '../../../contracts/ai'
import type { Handler } from '../../../contracts/jobs'
import { aiEngines, type EngineContext } from './engines'
import { AiJobSchema, ApprovedListSchema, inputHashOf, readUtf8, type AiJob, type ApprovedList } from './schemas'

export const AI_JOB_LEASE_MS = 24 * 60 * 60 * 1000
export const AI_SETTING_NAMES = ['AI_EXCHANGE_DIR'] as const
export const DECISION_0008 = 'AI runs only through the Claude project (decision 0008)'
const NOT_APPROVED = 'not approved: run the evaluation set first (AI-11)'
const LIST_UNREADABLE = 'not approved: the approved list cannot be read (AI-11)'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const DEFAULT_APPROVED = path.join(REPO_ROOT, 'data', 'ai', 'approved.json')

export type AiStepResult =
  | { ok: true; output: unknown; stamp: VersionStamp }
  | { ok: false; reason: string; problems: string[] }

export interface AiRunnerOptions {
  recordingsDir: string
  approvedPath?: string
  env?: Record<string, string | undefined>
  sink?: (line: string) => void
  pollMs?: number
}

export interface AiRunner {
  engine(): 'recorded' | 'project'
  useEngine(name: string): { ok: true } | { ok: false; reason: string }
  runAiStep(job: AiJob, ctx?: { jobId?: string }): Promise<AiStepResult>
  refusals(stepType: string): number
}

const refuse = (reason: string, problems: string[] = []): AiStepResult => ({ ok: false, reason, problems })
const blank = (s: string | undefined): boolean => (s ?? '').trim() === ''

/** The approved triples, or null when the list is missing or malformed (AI-11: a flag for a person, not a pass). */
function approvedTriples(approvedPath: string): ApprovedList['triples'] | null {
  try {
    const list = ApprovedListSchema.safeParse(JSON.parse(readUtf8(approvedPath)))
    return list.success ? list.data.triples : null
  } catch {
    return null
  }
}

export function createAiRunner(options: AiRunnerOptions): AiRunner {
  const logger = makeLogger()
  const sink = options.sink ?? ((line: string): void => {
    logger.info(line)
  })
  const approvedPath = options.approvedPath ?? DEFAULT_APPROVED
  const pollMs = options.pollMs ?? 1000
  const waiting = new Set<string>()
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  let current: 'recorded' | 'project' = 'recorded'
  // ARC-20: the folder is read once, when the project engine is switched on, and never again.
  let exchangeDir: string | undefined

  const count = (stepType: string): void => {
    counts.set(stepType, (counts.get(stepType) ?? 0) + 1)
  }

  async function run(job: AiJob, ctx: { jobId?: string }): Promise<AiStepResult> {
    // AI-9: no redaction stamp, no engine.
    const stamp = job.redaction
    if (stamp === undefined || blank(stamp.redactedBy) || blank(stamp.redactorVersion)) {
      return refuse('inputs not redacted (AI-9)')
    }
    // AI-11: only approved triples run.
    const triples = approvedTriples(approvedPath)
    if (triples === null) return refuse(LIST_UNREADABLE)
    if (!triples.some((t) => t.stepType === job.stepType && t.promptVersion === job.promptVersion && t.modelId === job.modelId)) {
      return refuse(NOT_APPROVED)
    }
    const engine = current
    // SEC-11: before go-live only made-up returns go to the project.
    if (engine === 'project' && !job.isTest) {
      return refuse('the project engine runs only made-up returns until go-live (SEC-11)')
    }
    const engineCtx: EngineContext = { jobId: ctx.jobId, recordingsDir: options.recordingsDir, exchangeDir, pollMs, sink, waiting, seen }
    const got = await aiEngines[engine].run(job, engineCtx)
    if (!got.ok) return got
    // AI-1: every output is checked by F04 before anything uses it.
    const checked = validateAiOutput(job.stepType, got.output, got.stamp)
    if (!checked.ok) {
      count(job.stepType)
      return refuse('the answer failed the output check (AI-1)', checked.problems)
    }
    const { version } = checked.data
    // AI-10: the stamp must describe this very job; a late result is accepted only on a matching input hash.
    const expected = {
      modelId: job.modelId,
      promptVersion: job.promptVersion,
      promptHash: job.promptHash,
      inputHash: inputHashOf(job.inputs),
    }
    const wrong = (Object.keys(expected) as (keyof typeof expected)[]).filter((k) => version[k] !== expected[k])
    if (wrong.length > 0) {
      return refuse(`the answer's stamp does not match the job: ${wrong.join(', ')} (AI-10)`)
    }
    return { ok: true, output: checked.data.output, stamp: version }
  }

  return {
    engine: () => current,
    useEngine(name) {
      if (name === 'recorded') {
        current = 'recorded'
        return { ok: true }
      }
      if (name !== 'project') return { ok: false, reason: DECISION_0008 }
      const folder = readSettings(options.env).AI_EXCHANGE_DIR
      if (blank(folder)) {
        return { ok: false, reason: 'the project engine needs the setting AI_EXCHANGE_DIR' }
      }
      exchangeDir = folder
      current = 'project'
      return { ok: true }
    },
    async runAiStep(job, ctx = {}) {
      const result = await run(job, ctx)
      sink(`ai step ${job.stepType}: ${result.ok ? 'ok' : 'refused'}`)
      return result
    },
    refusals: (stepType) => counts.get(stepType) ?? 0,
  }
}

const resultSchema = z.strictObject({ output: z.unknown(), stamp: versionStampSchema })

/** The `ai:<step>` handler F10 registers: a 24-hour lease, the result is { output, stamp }, a refusal throws. */
export function createAiStepHandler(stepType: string, runner: AiRunner): Handler<AiJob, z.infer<typeof resultSchema>> {
  return {
    kind: `ai:${stepType}`,
    input: AiJobSchema,
    result: resultSchema,
    leaseMs: AI_JOB_LEASE_MS,
    versions: { handler: `ai:${stepType}`, runner: 'a04-1' },
    async run(input, ctx) {
      const res = await runner.runAiStep(input, { jobId: ctx.jobId })
      if (!res.ok) throw new Error([res.reason, ...res.problems].join(' '))
      return { output: res.output, stamp: res.stamp }
    },
  }
}
