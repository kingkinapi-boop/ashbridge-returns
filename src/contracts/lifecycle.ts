// @mutate
// F02 contracts: guards of the move table (FLOW-2) and the approval fingerprint (FLOW-4).
// T06 computes the fingerprint; F02 only reads it through ApprovalFingerprintSource.
import { z } from 'zod'
import { NonBlankSchema } from './text'
import type { ReturnId } from './ids'
import type { ReturnRecord } from './records'
export type ReturnState = ReturnRecord['state']

export type GuardResult = { ok: true } | { ok: false; reason: string }

export interface GuardContext {
  returnId: ReturnId
  from: ReturnState
  to: ReturnState
  actor: string
}

export type Guard = (ctx: GuardContext) => GuardResult | Promise<GuardResult>

const version = z.number().int().min(1).max(2147483647)
const item = z.object({ id: NonBlankSchema, version })

/** FLOW-4: every lock-export cell (review lines included), and the facts, entries and judgment inputs behind them. */
export const ApprovalFingerprintSchema = z.object({
  cells: z.array(z.object({ cellId: NonBlankSchema, value: z.string().nullable() })),
  facts: z.array(item),
  entries: z.array(item),
  judgmentInputs: z.array(item),
})
export type ApprovalFingerprint = z.infer<typeof ApprovalFingerprintSchema>

export const ChangedItemSchema = z.union([
  z.object({ kind: z.literal('cell'), cellId: z.string() }),
  z.object({ kind: z.literal('fact'), id: z.string() }),
  z.object({ kind: z.literal('entry'), id: z.string() }),
  z.object({ kind: z.literal('judgmentInput'), id: z.string() }),
])
export type ChangedItem = z.infer<typeof ChangedItemSchema>

export interface ApprovalFingerprintSource {
  current(returnId: ReturnId): Promise<{ approvalId: string; fingerprint: ApprovalFingerprint } | null>
}

