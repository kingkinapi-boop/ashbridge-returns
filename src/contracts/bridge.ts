// F07 (ARC-2, END-1): the shapes the bridge reads from the client app, and the hand-off table it writes.
// Names come from reference/onboarding-contract.md; nothing from its section 3 ("never read") is in
// any shape, and every object is strict, so a never-read field in a snapshot is refused, not stripped.
import { z } from 'zod'
import { NonBlankSchema } from './text'

/** The client-app commit and last migration number the contract was written against (P01). */
export const BRIDGE_CONTRACT = Object.freeze({ clientAppCommit: 'f87a0043', lastMigration: 34 })

function isCalendarDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m === null) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const at = new Date(Date.UTC(y, mo - 1, d))
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d
}

export const IsoDateSchema = z.string().refine(isCalendarDate, { message: 'must be a calendar date, YYYY-MM-DD' })

/** Nine plain digits (corporations.business_number, M0002:55) or null. */
export const BusinessNumberSchema = z
  .string()
  .regex(/^\d{9}$/, { message: 'must be nine plain digits' })
  .nullable()

/** yes_no_unsure columns: null means never asked (M0001:48-51). */
export const YesNoUnsureSchema = z.enum(['yes', 'no', 'unsure']).nullable()

/** bridge.t2_return: one engagement row (M0003). */
export const BridgeEngagementSchema = z.strictObject({
  id: z.uuid(),
  service: NonBlankSchema,
  tax_year: z.number().int().min(1900).max(2200).nullable(),
  current_state: NonBlankSchema,
  created_at: z.iso.datetime({ offset: true }),
  is_test: z.literal(true),
})

/** bridge.corporation: one corporation (M0002, M0012) with what the bridge needs of it. */
export const BridgeCorporationSchema = z.strictObject({
  id: z.uuid(),
  legal_name: NonBlankSchema,
  business_number: BusinessNumberSchema,
  financial_year_end: IsoDateSchema.nullable(),
  financial_year_end_confirmed: z.boolean(),
  incorporation_date: IsoDateSchema.nullable(),
  all_prior_years_filed: YesNoUnsureSchema,
  outstanding_years: z.string().nullable(),
  /** null: the client app does not say (never guessed, END-1) */
  services: z.array(NonBlankSchema).nullable(),
  associated_corporation_ids: z.array(z.uuid()),
  is_test: z.literal(true),
})

/** bridge.client: an entity a person acts for, a company with its corporation or a personal return. */
export const BridgeEntitySchema = z
  .strictObject({
    id: z.uuid(),
    kind: z.enum(['company', 'personal']),
    corporation: BridgeCorporationSchema.nullable(),
    engagements: z.array(BridgeEngagementSchema),
  })
  .refine((e) => (e.kind === 'company') === (e.corporation !== null), {
    message: 'a company entity has a corporation and a personal entity has none',
  })

/** One made-up snapshot of the bridge views. Made-up data only until go-live (is_test true). */
export const BridgeSnapshotSchema = z.strictObject({
  is_test: z.literal(true),
  entities: z.array(BridgeEntitySchema),
})

export const OPS_ITEM_KINDS = [
  'year_end_unconfirmed',
  'unfiled_years_text',
  'duplicate_year',
  'books_source_unclear',
  'tax_year_missing',
] as const
export const OpsItemKindSchema = z.enum(OPS_ITEM_KINDS)

/** An id the hand-off table accepts in an id column: no spaces, so no sentence. */
export const HANDOFF_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,79}$/
const HandoffIdSchema = z.string().regex(HANDOFF_ID_PATTERN)
/** A slot value: an id, a number, cents, a percent, an ISO date, or a label of 60 characters at most. */
const SlotValueSchema = z.union([z.number(), z.string().max(60)])

export const APPROVAL_ITEM_IDS = [
  'net_income',
  'taxable_income',
  'federal_tax',
  'ontario_tax',
  'instalments',
  'balance_or_refund',
  'assumption',
] as const

/** returns.client_handoff (contract section 4): ids, slot values and numbers, never a sentence. */
export const BridgeHandoffRowSchema = z.strictObject({
  id: z.uuid(),
  corporation_id: z.uuid(),
  engagement_id: z.uuid(),
  tax_year: z.number().int(),
  list_kind: z.enum(['questions', 'approval']),
  list_version: z.number().int().min(1),
  position: z.number().int().min(1),
  status: z.enum(['draft', 'sent', 'withdrawn', 'closed']),
  sent_at: z.iso.datetime({ offset: true }).nullable(),
  is_test: z.boolean(),
  item_id: HandoffIdSchema,
  primitive: z.enum(['ask', 'confirm', 'decide']).nullable(),
  fact_id: HandoffIdSchema.nullable(),
  answer_shape: z.enum(['free_text', 'number', 'choice', 'date', 'percentage', 'document']).nullable(),
  choice_ids: z.array(HandoffIdSchema),
  slots: z.record(HandoffIdSchema, SlotValueSchema),
  recommendation_id: HandoffIdSchema.nullable(),
  reason_id: HandoffIdSchema.nullable(),
  value_cents: z.bigint().nullable(),
  prior_value_cents: z.bigint().nullable(),
})

/** Every shape the bridge reads or writes, by contract name. */
export const BRIDGE_SHAPES = {
  snapshot: BridgeSnapshotSchema,
  entity: BridgeEntitySchema,
  corporation: BridgeCorporationSchema,
  t2_return: BridgeEngagementSchema,
  client_handoff: BridgeHandoffRowSchema,
} as const

export type BridgeEngagement = z.infer<typeof BridgeEngagementSchema>
export type BridgeCorporation = z.infer<typeof BridgeCorporationSchema>
export type BridgeEntity = z.infer<typeof BridgeEntitySchema>
export type BridgeSnapshot = z.infer<typeof BridgeSnapshotSchema>
export type OpsItemKind = z.infer<typeof OpsItemKindSchema>
