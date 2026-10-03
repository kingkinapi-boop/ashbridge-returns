// @mutate
// The shapes the AI runner reads and writes: the job, the inbox file, the outbox file and the
// approved list. All strict at runtime (SC R23).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { aiStepTypes } from '../../../contracts/ai'
import { NonBlankSchema, isBlank } from '../../../contracts/text'

/** Keys sorted at every depth; arrays keep their order. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, canonicalize(obj[k])]),
    )
  }
  return value
}

/** AI-10: sha256 hex of the canonical JSON of the inputs (keys sorted at every depth, no whitespace). */
export function inputHashOf(inputs: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(inputs))).digest('hex')
}

/** A file read as text (no encoding name to get wrong: a decoder reads UTF-8). */
export const readUtf8 = (file: string): string => new TextDecoder().decode(fs.readFileSync(file))

/** The repository's root folder: the exchange folder must lie outside it (ARC-22) and the data files sit inside it. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

const positiveInt = z.number().int().positive()

/** data/ai/exchange-limits.json: every cap of the exchange is data (R104). */
export const ExchangeLimitsSchema = z.strictObject({
  /** The most an outbox file may hold (ARC-22): the Claude project's one result is far smaller. */
  outboxMaxBytes: positiveInt,
  /** The most outbox names (and flagged recordings) logged by name per runner; then one line says the rest are not. */
  seenMax: positiveInt,
  /** The most strangers one poll looks at; the next poll carries on from there. */
  strangerBatch: positiveInt,
  /** The most characters of a refusal that reach jobs.last_error. */
  lastErrorMaxChars: positiveInt,
})

export const EXCHANGE_LIMITS = ExchangeLimitsSchema.parse(JSON.parse(readUtf8(path.join(REPO_ROOT, 'data', 'ai', 'exchange-limits.json'))))

/** One identifier grammar for the stamp fields that are not free text: 1 to 128 characters, a letter or digit first, then . _ - + : too. */
export const IdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+:-]{0,127}$/)

/** AI-9: a job carries the redaction stamp, both parts non-blank, or no engine takes it. */
export const isRedacted = (job: AiJob): boolean => {
  const stamp = job.redaction
  return stamp !== undefined && !isBlank(stamp.redactedBy) && !isBlank(stamp.redactorVersion)
}

export const RedactionStampSchema = z.strictObject({ redactedBy: z.string(), redactorVersion: z.string() })

const inputsSchema = z.record(z.string(), z.unknown())

/** What a step hands the runner. The redaction stamp is optional here so a missing one is refused with a reason (AI-9). */
export const AiJobSchema = z.strictObject({
  stepType: z.enum(aiStepTypes),
  promptVersion: NonBlankSchema,
  promptHash: IdentifierSchema,
  modelId: NonBlankSchema,
  inputs: inputsSchema,
  redaction: RedactionStampSchema.optional(),
  isTest: z.boolean(),
  ocrEngine: IdentifierSchema,
  ocrEngineVersion: IdentifierSchema,
  mappingRelease: IdentifierSchema,
})
export type AiJob = z.infer<typeof AiJobSchema>

/** inbox/<job id>.json: exactly what the Claude project reads. */
export const InboxFileSchema = z.strictObject({
  jobId: NonBlankSchema,
  stepType: z.enum(aiStepTypes),
  promptVersion: NonBlankSchema,
  promptHash: IdentifierSchema,
  modelId: NonBlankSchema,
  inputHash: NonBlankSchema,
  schema: z.record(z.string(), z.unknown()),
  redaction: z.strictObject({ redactedBy: NonBlankSchema, redactorVersion: NonBlankSchema }),
  isTest: z.boolean(),
  ocrEngine: IdentifierSchema,
  ocrEngineVersion: IdentifierSchema,
  mappingRelease: IdentifierSchema,
  inputs: inputsSchema,
})
export type InboxFile = z.infer<typeof InboxFileSchema>

/** The most an outbox file may hold (ARC-22); the number lives in data/ai/exchange-limits.json. */
export const OUTBOX_MAX_BYTES = EXCHANGE_LIMITS.outboxMaxBytes

const DEVICE_NAMES: readonly string[] = ['con', 'prn', 'aux', 'nul', ...Array.from({ length: 10 }, (_, i) => `com${String(i)}`), ...Array.from({ length: 10 }, (_, i) => `lpt${String(i)}`)]

/** A job id is a file name in the exchange folder (SEC-10): an allowlist, no regex flags, never a Windows device name. */
export const AiJobIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{2,63}$/)
  .refine((id) => !DEVICE_NAMES.includes(id))

/** outbox/<job id>.json: one result for one job; the output and stamp are checked by F04 afterwards. */
export const OutboxFileSchema = z.strictObject({ jobId: NonBlankSchema, output: z.unknown(), stamp: z.unknown() })

/** outbox/<job id>.json when the Claude project refuses the job (A08 writes it); `stage` says where it stopped. */
export const OutboxRefusalSchema = z.strictObject({
  jobId: NonBlankSchema,
  refusal: z.strictObject({ reason: NonBlankSchema, problems: z.array(z.string()), stage: z.enum(['input', 'run', 'output']) }),
})

export const ApprovedListSchema = z.strictObject({
  triples: z.array(z.strictObject({ stepType: NonBlankSchema, promptVersion: NonBlankSchema, modelId: NonBlankSchema })),
})
export type ApprovedList = z.infer<typeof ApprovedListSchema>

/** A recorded answer (ARC-16): matched on the model id, the prompt hash and the input hash. */
export const RecordingSchema = z.strictObject({
  modelId: z.string(),
  promptHash: z.string(),
  inputHash: z.string(),
  output: z.unknown(),
  stamp: z.unknown(),
})
