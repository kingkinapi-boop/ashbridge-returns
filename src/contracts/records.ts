// Records of blueprint 03 as zod schemas (F01). Property names are the column names in
// db/schema/*.sql, so a row read from the database is the record. Money is integer cents.
import { z } from 'zod'
import {
  AccountIdSchema,
  AdjustingEntryIdSchema,
  AnswerIdSchema,
  ApprovalIdSchema,
  CheckResultIdSchema,
  DifferenceIdSchema,
  DocumentIdSchema,
  EntryLineIdSchema,
  EventIdSchema,
  ExceptionIdSchema,
  FactIdSchema,
  FigureIdSchema,
  GifiMappingIdSchema,
  HoldIdSchema,
  JudgmentInputIdSchema,
  LessonIdSchema,
  LinkIdSchema,
  ReturnIdSchema,
  StateEventIdSchema,
  VersionCellIdSchema,
  VersionIdSchema,
} from './ids'

const common = { created_at: z.date(), is_test: z.boolean() }
const cents = z.number().int()
/** ARC-10: the versions that made a derived record; never empty. */
export const VersionStampSchema = z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0)

/** Blueprint 02: the states of a return (FLOW-1). */
export const RETURN_STATES = [
  'intake', 'evidence', 'gaps', 'qa', 'build', 'prepare', 'trace', 'respond', 'review',
  'rework', 'approved', 'client_sign', 'ready_to_file', 'filed', 'assessed', 'closed',
] as const
export const ReturnStateSchema = z.enum(RETURN_STATES)
/** EV-10 */
export const ORIGINS = ['third_party', 'client_filed', 'client_prepared', 'client_said', 'judgment'] as const
export const OriginSchema = z.enum(ORIGINS)
/** EV-8 */
export const FACT_STATUSES = ['proposed', 'preparer_verified', 'cpa_accepted'] as const
export const FactStatusSchema = z.enum(FACT_STATUSES)
/** TB-2 */
export const ENTRY_TYPES = ['reclass', 'accrual', 'allocation', 'estimate', 'correction'] as const
export const EntryTypeSchema = z.enum(ENTRY_TYPES)

export const ReturnRecordSchema = z.object({
  id: ReturnIdSchema, ...common,
  entity_name: z.string(), year_end: z.date(), state: ReturnStateSchema,
})
export type ReturnRecord = z.infer<typeof ReturnRecordSchema>

export const DocumentRecordSchema = z.object({
  id: DocumentIdSchema, ...common,
  return_id: ReturnIdSchema, fingerprint: z.string(), file_name: z.string(),
})
export type DocumentRecord = z.infer<typeof DocumentRecordSchema>

export const VersionRecordSchema = z.object({
  id: VersionIdSchema, ...common, return_id: ReturnIdSchema, version_no: z.number().int(),
})
export type VersionRecord = z.infer<typeof VersionRecordSchema>

export const VersionCellRecordSchema = z.object({
  id: VersionCellIdSchema, ...common,
  version_id: VersionIdSchema, cell_id: z.string(), value: z.string().nullable(),
})
export type VersionCellRecord = z.infer<typeof VersionCellRecordSchema>

export const ApprovalRecordSchema = z.object({
  id: ApprovalIdSchema, ...common,
  return_id: ReturnIdSchema, version_id: VersionIdSchema,
  approved_by: z.string(), fingerprint: z.string(),
})
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>

export const EventRecordSchema = z.object({
  id: EventIdSchema, ...common,
  record_table: z.string(), record_id: z.string(), actor: z.string(), occurred_at: z.date(),
  from_value: z.unknown().nullable(), to_value: z.unknown().nullable(), reason: z.string(),
})
export type EventRecord = z.infer<typeof EventRecordSchema>

export const SourceBoxSchema = z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() })
export const FactRecordSchema = z.object({
  id: FactIdSchema, ...common,
  return_id: ReturnIdSchema, fact_key: z.string(), version_no: z.number().int(), value: z.string().nullable(),
  // EV-5: exactly one of these six pointers is set
  source_document_id: DocumentIdSchema.nullable(),
  source_page: z.number().int().nullable(),
  source_box: SourceBoxSchema.nullable(),
  source_qbo_snapshot_id: z.string().nullable(),
  source_client_answer_id: z.string().nullable(),
  source_cra_capture_id: z.string().nullable(),
  source_prior_return_id: z.string().nullable(),
  source_reason: z.string().nullable(),
  origin: OriginSchema, method: z.string().nullable(), status: FactStatusSchema,
  version_stamp: VersionStampSchema,
})
export type FactRecord = z.infer<typeof FactRecordSchema>

export const LinkRecordSchema = z.object({
  id: LinkIdSchema, ...common,
  kind: z.string(), from_table: z.string(), from_id: z.string(), to_table: z.string(), to_id: z.string(),
})
export type LinkRecord = z.infer<typeof LinkRecordSchema>

export const AccountRecordSchema = z.object({
  id: AccountIdSchema, ...common,
  return_id: ReturnIdSchema, qbo_snapshot_id: z.string(), qbo_account_id: z.string(),
  name: z.string(), balance_cents: cents.nullable(),
})
export type AccountRecord = z.infer<typeof AccountRecordSchema>

export const GifiMappingRecordSchema = z.object({
  id: GifiMappingIdSchema, ...common,
  return_id: ReturnIdSchema, account_id: AccountIdSchema, mapping_version: z.number().int(), gifi_code: z.string(),
})
export type GifiMappingRecord = z.infer<typeof GifiMappingRecordSchema>

export const AdjustingEntryRecordSchema = z.object({
  id: AdjustingEntryIdSchema, ...common,
  return_id: ReturnIdSchema, qbo_snapshot_id: z.string(), qbo_txn_id: z.string(),
  entry_type: EntryTypeSchema.nullable(), reason: z.string().nullable(),
  sources: z.array(z.unknown()), author: z.string().nullable(), explained: z.boolean(),
})
export type AdjustingEntryRecord = z.infer<typeof AdjustingEntryRecordSchema>

export const EntryLineRecordSchema = z.object({
  id: EntryLineIdSchema, ...common,
  entry_id: AdjustingEntryIdSchema, qbo_account_id: z.string(), amount_cents: cents,
})
export type EntryLineRecord = z.infer<typeof EntryLineRecordSchema>

export const JudgmentInputRecordSchema = z.object({
  id: JudgmentInputIdSchema, ...common,
  return_id: ReturnIdSchema, cell_id: z.string(), value: z.string().nullable(),
  author: z.string(), reason: z.string(),
})
export type JudgmentInputRecord = z.infer<typeof JudgmentInputRecordSchema>

export const FigureRecordSchema = z.object({
  id: FigureIdSchema, ...common,
  return_id: ReturnIdSchema, figure_key: z.string(), cell_id: z.string().nullable(),
  value: z.string().nullable(), version_stamp: VersionStampSchema,
})
export type FigureRecord = z.infer<typeof FigureRecordSchema>

export const StateEventRecordSchema = z.object({
  id: StateEventIdSchema, ...common,
  return_id: ReturnIdSchema, from_state: ReturnStateSchema, to_state: ReturnStateSchema,
  actor: z.string(), occurred_at: z.date(), reason: z.string(),
})
export type StateEventRecord = z.infer<typeof StateEventRecordSchema>

export const HoldRecordSchema = z.object({
  id: HoldIdSchema, ...common,
  return_id: ReturnIdSchema, holder: z.string(), taken_at: z.date(),
  released_at: z.date().nullable(), reason: z.string().nullable(),
})
export type HoldRecord = z.infer<typeof HoldRecordSchema>

export const CheckResultRecordSchema = z.object({
  id: CheckResultIdSchema, ...common,
  return_id: ReturnIdSchema, check_id: z.string(), outcome: z.enum(['pass', 'fail', 'flag']),
  version_stamp: VersionStampSchema,
})
export type CheckResultRecord = z.infer<typeof CheckResultRecordSchema>

export const ExceptionRecordSchema = z.object({
  id: ExceptionIdSchema, ...common,
  return_id: ReturnIdSchema, check_result_id: CheckResultIdSchema,
  amount_cents: cents.nullable(), tax_effect_cents: cents.nullable(), status: z.string(),
})
export type ExceptionRecord = z.infer<typeof ExceptionRecordSchema>

export const AnswerRecordSchema = z.object({
  id: AnswerIdSchema, ...common,
  exception_id: ExceptionIdSchema, author: z.string(), answer: z.string(),
})
export type AnswerRecord = z.infer<typeof AnswerRecordSchema>

export const DifferenceRecordSchema = z.object({
  id: DifferenceIdSchema, ...common,
  return_id: ReturnIdSchema, cell_id: z.string(),
  before_value: z.string().nullable(), after_value: z.string().nullable(),
})
export type DifferenceRecord = z.infer<typeof DifferenceRecordSchema>

export const LessonRecordSchema = z.object({
  id: LessonIdSchema, ...common, difference_id: DifferenceIdSchema, summary: z.string(),
})
export type LessonRecord = z.infer<typeof LessonRecordSchema>
