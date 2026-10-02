// @mutate
// Id kinds for every record in schema returns (F01). Ids are text; each kind is branded so a
// fact id cannot be passed where a return id is wanted.
import { z } from 'zod'

const id = z.string().min(1)

// Stryker disable MethodExpression: .brand() changes only the TypeScript type, never the parsed value
export const ReturnIdSchema = id.brand<'ReturnId'>()
export type ReturnId = z.infer<typeof ReturnIdSchema>
export const DocumentIdSchema = id.brand<'DocumentId'>()
export type DocumentId = z.infer<typeof DocumentIdSchema>
export const VersionIdSchema = id.brand<'VersionId'>()
export type VersionId = z.infer<typeof VersionIdSchema>
export const VersionCellIdSchema = id.brand<'VersionCellId'>()
export type VersionCellId = z.infer<typeof VersionCellIdSchema>
export const ApprovalIdSchema = id.brand<'ApprovalId'>()
export type ApprovalId = z.infer<typeof ApprovalIdSchema>
export const EventIdSchema = id.brand<'EventId'>()
export type EventId = z.infer<typeof EventIdSchema>
export const FactIdSchema = id.brand<'FactId'>()
export type FactId = z.infer<typeof FactIdSchema>
export const LinkIdSchema = id.brand<'LinkId'>()
export type LinkId = z.infer<typeof LinkIdSchema>
export const AccountIdSchema = id.brand<'AccountId'>()
export type AccountId = z.infer<typeof AccountIdSchema>
export const GifiMappingIdSchema = id.brand<'GifiMappingId'>()
export type GifiMappingId = z.infer<typeof GifiMappingIdSchema>
export const AdjustingEntryIdSchema = id.brand<'AdjustingEntryId'>()
export type AdjustingEntryId = z.infer<typeof AdjustingEntryIdSchema>
export const EntryLineIdSchema = id.brand<'EntryLineId'>()
export type EntryLineId = z.infer<typeof EntryLineIdSchema>
export const JudgmentInputIdSchema = id.brand<'JudgmentInputId'>()
export type JudgmentInputId = z.infer<typeof JudgmentInputIdSchema>
export const FigureIdSchema = id.brand<'FigureId'>()
export type FigureId = z.infer<typeof FigureIdSchema>
export const StateEventIdSchema = id.brand<'StateEventId'>()
export type StateEventId = z.infer<typeof StateEventIdSchema>
export const HoldIdSchema = id.brand<'HoldId'>()
export type HoldId = z.infer<typeof HoldIdSchema>
export const CheckResultIdSchema = id.brand<'CheckResultId'>()
export type CheckResultId = z.infer<typeof CheckResultIdSchema>
export const ExceptionIdSchema = id.brand<'ExceptionId'>()
export type ExceptionId = z.infer<typeof ExceptionIdSchema>
export const AnswerIdSchema = id.brand<'AnswerId'>()
export type AnswerId = z.infer<typeof AnswerIdSchema>
export const DifferenceIdSchema = id.brand<'DifferenceId'>()
export type DifferenceId = z.infer<typeof DifferenceIdSchema>
export const LessonIdSchema = id.brand<'LessonId'>()
export type LessonId = z.infer<typeof LessonIdSchema>
// Stryker restore MethodExpression
