// Id kinds for every record in schema returns (F01). Ids are text; each kind is branded so a
// fact id cannot be passed where a return id is wanted.
import { z } from 'zod'

export const ReturnIdSchema = z.string().min(1).brand<'ReturnId'>()
export type ReturnId = z.infer<typeof ReturnIdSchema>
export const DocumentIdSchema = z.string().min(1).brand<'DocumentId'>()
export type DocumentId = z.infer<typeof DocumentIdSchema>
export const VersionIdSchema = z.string().min(1).brand<'VersionId'>()
export type VersionId = z.infer<typeof VersionIdSchema>
export const VersionCellIdSchema = z.string().min(1).brand<'VersionCellId'>()
export type VersionCellId = z.infer<typeof VersionCellIdSchema>
export const ApprovalIdSchema = z.string().min(1).brand<'ApprovalId'>()
export type ApprovalId = z.infer<typeof ApprovalIdSchema>
export const EventIdSchema = z.string().min(1).brand<'EventId'>()
export type EventId = z.infer<typeof EventIdSchema>
export const FactIdSchema = z.string().min(1).brand<'FactId'>()
export type FactId = z.infer<typeof FactIdSchema>
export const LinkIdSchema = z.string().min(1).brand<'LinkId'>()
export type LinkId = z.infer<typeof LinkIdSchema>
export const AccountIdSchema = z.string().min(1).brand<'AccountId'>()
export type AccountId = z.infer<typeof AccountIdSchema>
export const GifiMappingIdSchema = z.string().min(1).brand<'GifiMappingId'>()
export type GifiMappingId = z.infer<typeof GifiMappingIdSchema>
export const AdjustingEntryIdSchema = z.string().min(1).brand<'AdjustingEntryId'>()
export type AdjustingEntryId = z.infer<typeof AdjustingEntryIdSchema>
export const EntryLineIdSchema = z.string().min(1).brand<'EntryLineId'>()
export type EntryLineId = z.infer<typeof EntryLineIdSchema>
export const JudgmentInputIdSchema = z.string().min(1).brand<'JudgmentInputId'>()
export type JudgmentInputId = z.infer<typeof JudgmentInputIdSchema>
export const FigureIdSchema = z.string().min(1).brand<'FigureId'>()
export type FigureId = z.infer<typeof FigureIdSchema>
export const StateEventIdSchema = z.string().min(1).brand<'StateEventId'>()
export type StateEventId = z.infer<typeof StateEventIdSchema>
export const HoldIdSchema = z.string().min(1).brand<'HoldId'>()
export type HoldId = z.infer<typeof HoldIdSchema>
export const CheckResultIdSchema = z.string().min(1).brand<'CheckResultId'>()
export type CheckResultId = z.infer<typeof CheckResultIdSchema>
export const ExceptionIdSchema = z.string().min(1).brand<'ExceptionId'>()
export type ExceptionId = z.infer<typeof ExceptionIdSchema>
export const AnswerIdSchema = z.string().min(1).brand<'AnswerId'>()
export type AnswerId = z.infer<typeof AnswerIdSchema>
export const DifferenceIdSchema = z.string().min(1).brand<'DifferenceId'>()
export type DifferenceId = z.infer<typeof DifferenceIdSchema>
export const LessonIdSchema = z.string().min(1).brand<'LessonId'>()
export type LessonId = z.infer<typeof LessonIdSchema>
