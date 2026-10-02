// @mutate
// The check contract (F05): one shape for every check (CK-1 to CK-6). Money is integer cents (ARC-13).
// Rounding to whole dollars uses the one rule in src/core/money.ts.
import { z } from 'zod'
import { cents, roundCentsToDollars, type Cents } from '../core/money'

export const CHECK_KINDS = ['tie', 'reconciliation', 'flag', 'ai'] as const
export type CheckKind = (typeof CHECK_KINDS)[number]

export type Validation = { ok: true } | { ok: false; reason: string }

function validate(schema: z.ZodType, x: unknown): Validation {
  const r = schema.safeParse(x)
  if (r.success) return { ok: true }
  const reason = r.error.issues
    .map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
  return { ok: false, reason }
}

const nonBlank = z.string().refine((s) => s.trim().length > 0, 'must not be blank')
const centsSchema = z.number().int()

// ---- CK-1 the check record ----

export type CheckRecord<R = unknown> = {
  /** The clause, for example 'CK-20'. */
  id: string
  kind: CheckKind
  /** When it applies, a function of the return. */
  appliesTo: (ret: R) => boolean
  inputs: readonly string[]
  rule: string
  /** Where the rule comes from; never blank. */
  sourceLink: string
  /** What it raises. */
  raises: string
}

export const CheckRecordSchema = z.object({
  id: nonBlank,
  kind: z.enum(CHECK_KINDS),
  appliesTo: z.custom<(ret: unknown) => boolean>((v) => typeof v === 'function', 'must be a function'),
  inputs: z.array(z.string()),
  rule: nonBlank,
  sourceLink: nonBlank,
  raises: nonBlank,
})

export function validateCheckRecord(x: unknown): Validation {
  return validate(CheckRecordSchema, x)
}

// ---- results (CK-2, CK-5) ----

export type CheckResult =
  | { status: 'pass' }
  | { status: 'fail'; left: Cents; right: Cents }
  | { status: 'not_checked'; label: 'not checked: no evidence' }
  | { status: 'flag'; reason: string }

export const pass = (): CheckResult => Object.freeze({ status: 'pass' as const })
export const fail = (left: Cents, right: Cents): CheckResult =>
  Object.freeze({ status: 'fail' as const, left: cents(left), right: cents(right) })
export const notChecked = (): CheckResult =>
  Object.freeze({ status: 'not_checked' as const, label: 'not checked: no evidence' as const })
export const flag = (reason: string): CheckResult => Object.freeze({ status: 'flag' as const, reason })

export function summarizeResults(results: readonly CheckResult[]) {
  const s = { pass: 0, fail: 0, notChecked: 0, flag: 0, total: results.length }
  for (const r of results) {
    if (r.status === 'pass') s.pass += 1
    else if (r.status === 'fail') s.fail += 1
    else if (r.status === 'flag') s.flag += 1
    else s.notChecked += 1
  }
  return s
}

/** True only for a non-empty list in which every result is a pass (CK-2). */
export function allPassed(results: readonly CheckResult[]): boolean {
  return results.length > 0 && results.every((r) => r.status === 'pass')
}

/** CK-5: a check of kind flag may only flag or say not checked. */
export function validateResultForCheck(record: { id: string; kind: CheckKind }, result: CheckResult): Validation {
  if (record.kind === 'flag' && (result.status === 'pass' || result.status === 'fail')) {
    return { ok: false, reason: `${record.id} is a flag check: it goes to a person and is never passed or failed` }
  }
  return { ok: true }
}

// ---- CK-3 ties ----

/** Agrees to the dollar: a difference under 100 cents passes (amber: not "same rounded dollar"). */
export function tie(left: Cents, right: Cents): CheckResult {
  cents(left)
  cents(right)
  return Math.abs(left - right) < 100 ? pass() : fail(left, right)
}

// ---- CK-4 reconciliations ----

/** The fixed list of reconciling-item types (CK-48, CK-49: stable codes, never renumbered). */
export const RECONCILING_ITEM_CODES: readonly string[] = Array.from(
  { length: 29 },
  (_, i) => `R${String(i + 1).padStart(2, '0')}`,
)

export type ReconcilingItem = { code: string; amount: Cents; source: string; acceptedBy?: string; note?: string }

export const ReconcilingItemSchema = z.object({
  code: z.string().refine((c) => RECONCILING_ITEM_CODES.includes(c), 'type is not on the fixed list'),
  amount: centsSchema,
  source: nonBlank,
  acceptedBy: z.string().optional(),
  note: z.string().optional(),
})

export function validateReconcilingItem(x: unknown): Validation {
  return validate(ReconcilingItemSchema, x)
}

export type Reconciliation = {
  left: Cents
  right: Cents
  difference: Cents
  items: ReconcilingItem[]
  itemsTotal: Cents
  unexplained: Cents
  raisesException: boolean
}

export function reconcile(input: { left: Cents; right: Cents; items: readonly ReconcilingItem[] }): Reconciliation {
  const { left, right } = input
  const difference = cents(cents(left) - cents(right))
  let itemsTotal = 0
  for (const i of input.items) itemsTotal = cents(itemsTotal + cents(i.amount))
  const unexplained = cents(difference - itemsTotal)
  return {
    left,
    right,
    difference,
    items: [...input.items],
    itemsTotal,
    unexplained,
    raisesException: unexplained !== 0,
  }
}

/** A statement rounded line by line either still ties to its rounded total or carries an R21 item (CK-3). */
export function roundStatementToDollars(lines: readonly Cents[]) {
  const rounded = lines.map((c) => roundCentsToDollars(c) * 100)
  const total = rounded.reduce((a, b) => cents(a + b), 0)
  const exactTotal = lines.reduce((a, b) => cents(a + b), 0)
  const roundedExactTotal = roundCentsToDollars(exactTotal) * 100
  const roundingItem: ReconcilingItem | null =
    total === roundedExactTotal
      ? null
      : { code: 'R21', amount: roundedExactTotal - total, source: 'rounding of statement lines to whole dollars' }
  return { lines: rounded, total, exactTotal, roundedExactTotal, roundingItem }
}

// ---- CK-6 exceptions ----

export type CheckException = { checkId: string; amount: Cents; estimatedTaxEffect: Cents }

export const CheckExceptionSchema = z.object({
  checkId: nonBlank,
  amount: centsSchema,
  estimatedTaxEffect: centsSchema,
})

export function validateException(x: unknown): Validation {
  return validate(CheckExceptionSchema, x)
}
