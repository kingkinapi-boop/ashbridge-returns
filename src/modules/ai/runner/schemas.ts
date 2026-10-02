// @mutate
// The shapes the AI runner reads and writes: the job, the inbox file, the outbox file and the
// approved list. All strict at runtime (SC R23).
import crypto from 'node:crypto'
import { z } from 'zod'
import { aiStepTypes } from '../../../contracts/ai'
import { NonBlankSchema } from '../../../contracts/text'

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
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(inputs)), 'utf8').digest('hex')
}

export const RedactionStampSchema = z.strictObject({ redactedBy: z.string(), redactorVersion: z.string() })

const inputsSchema = z.record(z.string(), z.unknown())

/** What a step hands the runner. The redaction stamp is optional here so a missing one is refused with a reason (AI-9). */
export const AiJobSchema = z.strictObject({
  stepType: z.enum(aiStepTypes),
  promptVersion: NonBlankSchema,
  promptHash: NonBlankSchema,
  modelId: NonBlankSchema,
  inputs: inputsSchema,
  redaction: RedactionStampSchema.optional(),
  isTest: z.boolean(),
  ocrEngine: NonBlankSchema,
  ocrEngineVersion: NonBlankSchema,
  mappingRelease: NonBlankSchema,
})
export type AiJob = z.infer<typeof AiJobSchema>

/** inbox/<job id>.json: exactly what the Claude project reads. */
export const InboxFileSchema = z.strictObject({
  jobId: NonBlankSchema,
  stepType: z.enum(aiStepTypes),
  promptVersion: NonBlankSchema,
  promptHash: NonBlankSchema,
  modelId: NonBlankSchema,
  inputHash: NonBlankSchema,
  schema: z.record(z.string(), z.unknown()),
  redaction: z.strictObject({ redactedBy: NonBlankSchema, redactorVersion: NonBlankSchema }),
  isTest: z.boolean(),
  ocrEngine: NonBlankSchema,
  ocrEngineVersion: NonBlankSchema,
  mappingRelease: NonBlankSchema,
  inputs: inputsSchema,
})
export type InboxFile = z.infer<typeof InboxFileSchema>

/** outbox/<job id>.json: one result for one job; the output and stamp are checked by F04 afterwards. */
export const OutboxFileSchema = z.strictObject({ jobId: NonBlankSchema, output: z.unknown(), stamp: z.unknown() })

export const ApprovedListSchema = z.strictObject({
  triples: z.array(z.strictObject({ stepType: NonBlankSchema, promptVersion: NonBlankSchema, modelId: NonBlankSchema })),
})
export type ApprovedList = z.infer<typeof ApprovedListSchema>

/** A recorded answer (ARC-16): matched on the model id, the prompt hash and the input hash. */
export const RecordingSchema = z.object({
  modelId: z.string(),
  promptHash: z.string(),
  inputHash: z.string(),
  output: z.unknown(),
  stamp: z.unknown(),
})
