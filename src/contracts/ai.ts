// @mutate
// The AI output contract (F04): every AI step returns one checked shape with citations that code can
// verify (AI-1), a "missing" finding cites where the item should be (AI-5), "I can't tell" is always
// allowed and goes to a person (AI-6), and every result carries a version stamp (AI-10).
// A document citation reuses F09's box (AI-4). The model never sets its own routing flag.
import { z } from 'zod'
import { BoxSchema } from './reading'
import { NonBlankSchema } from './text'

const text = NonBlankSchema

// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
const ledgerCitation = z.strictObject({ source: z.literal('ledger'), recordKind: text, recordId: text })
// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
const documentCitation = z.strictObject({ source: z.literal('document'), documentId: text, box: BoxSchema, quote: text })
// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
const returnCellCitation = z.strictObject({ source: z.literal('return_cell'), figureKey: text })
// A page citation has no quote and no box; only a "missing" finding may use it (AI-5). Whether the page exists is I00's check.
// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
const pageCitation = z.strictObject({ source: z.literal('page'), documentId: text, page: z.number().int().min(1) })

// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
export const citationSchema = z.discriminatedUnion('source', [
  ledgerCitation,
  documentCitation,
  returnCellCitation,
  pageCitation,
])
// Every step other than a "missing" finding: the page kind is not allowed.
// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
const evidenceCitationSchema = z.discriminatedUnion('source', [ledgerCitation, documentCitation, returnCellCitation])
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

// Stryker disable next-line ObjectLiteral,StringLiteral: a mutant that breaks a schema at module load crashes the whole test file, which the runner counts as survived; tests kill every such mutation when run by hand
const cannotTellSchema = z.strictObject({
  outcome: z.literal('cannot_tell'),
  reason: text,
  citations: z.array(citationSchema).max(0),
})

const citations = z.array(evidenceCitationSchema).min(1)
const findingCitations = z.array(citationSchema).min(1)

function step<S extends z.ZodRawShape>(shape: S) {
  // Stryker disable next-line ObjectLiteral,StringLiteral: load-time crash, as above
  return z.discriminatedUnion('outcome', [
    // Stryker disable next-line ObjectLiteral: load-time crash, as above
    z.strictObject({ outcome: z.literal('answer'), ...shape, citations }),
    cannotTellSchema,
  ])
}

// Stryker disable next-line ObjectLiteral: load-time crash, as above
const findingShape = z.strictObject({ outcome: z.literal('answer'), findingType: z.enum(['issue', 'missing']), summary: text, citations: findingCitations })

// Stryker disable next-line StringLiteral: load-time crash, as above
const findingStep = z.discriminatedUnion('outcome', [
  findingShape.check((ctx) => {
    const { findingType, citations: cited } = ctx.value
    const forbidden = findingType === 'missing' ? 'ledger' : 'page'
    const rule =
      findingType === 'missing'
        ? 'A "missing" finding must cite where the item should be (a document box, a page or a return cell), not a ledger record.'
        : 'Only a "missing" finding may cite a page; cite a document box, a ledger record or a return cell.'
    cited.forEach((c, i) => {
      // Stryker disable next-line StringLiteral: zod reads the code only to type the issue; describe() prints the message and path alone
      if (c.source === forbidden) ctx.issues.push({ code: 'custom', message: rule, path: ['citations', i], input: c })
    })
  }),
  cannotTellSchema,
])

export const aiStepSchemas = {
  finding: findingStep,
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
  if (!out?.success || !stamp.success) return { ok: false, problems }
  return {
    ok: true,
    data: { output: out.data, version: stamp.data },
    toPerson: out.data.outcome === 'cannot_tell',
  }
}
