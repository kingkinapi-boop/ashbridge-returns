// @mutate
// The AI output contract (F04): every AI step returns one checked shape with citations that code can
// verify (AI-1), a "missing" finding cites where the item should be (AI-5), "I can't tell" is always
// allowed and goes to a person (AI-6), and every result carries a version stamp (AI-10).
// A document citation reuses F09's box (AI-4). The model never sets its own routing flag.
import { z } from 'zod'
import { BoxSchema } from './reading'

const text = z.string().trim().min(1)

export const citationSchema = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('ledger'), recordKind: text, recordId: text }),
  z.strictObject({ source: z.literal('document'), documentId: text, box: BoxSchema, quote: text }),
  z.strictObject({ source: z.literal('return_cell'), figureKey: text }),
])
export type Citation = z.infer<typeof citationSchema>

export const versionStampSchema = z.strictObject({
  modelId: text,
  promptVersion: text,
  promptHash: text,
  inputHash: text,
  ocrEngine: text,
  ocrEngineVersion: text,
  mappingRelease: text,
})
export type VersionStamp = z.infer<typeof versionStampSchema>

export const aiStepTypes = [
  'finding',
  'extraction',
  'category_proposal',
  'gifi_mapping_proposal',
  'question_slot_fill',
  'cause_tag',
  'red_team_item',
] as const
export type AiStepType = (typeof aiStepTypes)[number]

const cannotTellSchema = z.strictObject({
  outcome: z.literal('cannot_tell'),
  reason: text,
  citations: z.array(citationSchema).max(0),
})

const citations = z.array(citationSchema).min(1)

function step<S extends z.ZodRawShape>(shape: S) {
  return z.discriminatedUnion('outcome', [
    z.strictObject({ outcome: z.literal('answer'), ...shape, citations }),
    cannotTellSchema,
  ])
}

export const aiStepSchemas = {
  finding: step({ findingType: z.enum(['issue', 'missing']), summary: text }),
  extraction: step({
    fields: z.array(z.strictObject({ name: text, value: z.string() })),
  }),
  category_proposal: step({ category: text }),
  gifi_mapping_proposal: step({ gifiCode: text }),
  question_slot_fill: step({ slot: text, value: z.string() }),
  cause_tag: step({ tag: text }),
  red_team_item: step({ concern: text }),
} satisfies Record<AiStepType, z.ZodType>

export type ValidatedAiOutput =
  | { ok: true; data: { output: unknown; version: VersionStamp }; toPerson: boolean }
  | { ok: false; problems: string[] }

function describe(prefix: string, issues: readonly z.core.$ZodIssue[]): string[] {
  return issues.map((i) => {
    const path = [prefix, ...i.path.map(String)].filter((p) => p !== '').join('.')
    const where = path === '' ? 'The output' : `The field "${path}"`
    return `${where} is missing or not valid: ${i.message}.`
  })
}

/** Checks raw model output and its version stamp; returns the data or every problem, in plain sentences. */
export function validateAiOutput(stepType: AiStepType, raw: unknown, version: unknown): ValidatedAiOutput {
  const problems: string[] = []
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    problems.push('The model output must be a JSON object.')
  }
  const out = problems.length === 0 ? aiStepSchemas[stepType].safeParse(raw) : undefined
  if (out && !out.success) problems.push(...describe('', out.error.issues))
  const stamp = versionStampSchema.safeParse(version)
  if (!stamp.success) {
    if (version === undefined || version === null) problems.push('The version stamp ("version") is missing.')
    else problems.push(...describe('version', stamp.error.issues))
  }
  if (problems.length > 0 || !out?.success || !stamp.success) return { ok: false, problems }
  return {
    ok: true,
    data: { output: out.data, version: stamp.data },
    toPerson: out.data.outcome === 'cannot_tell',
  }
}
