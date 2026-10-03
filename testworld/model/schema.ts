// @mutate
// The typed model of a test-world client (END-9, ARC-8). Money is integer cents everywhere (ARC-13).
import { z } from 'zod'

export const CLIENT_ID = /^C\d{2}$/

/** The roles an account can have; the role decides the sign of its roll, so it is never free text. */
export const ACCOUNT_ROLES = ['bank', 'card', 'pcard', 'broker'] as const

/** Is this a real calendar date written YYYY-MM-DD (it round-trips, so 2025-02-30 and 2025-03-99 are not)? */
export function isCalendarDate(s: string): boolean {
  // Stryker disable next-line Regex: the round trip below refuses any text around the date, so the two anchors cannot change the answer
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m === null) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === s
}
export const calendarDate = z.string().refine(isCalendarDate, { message: 'it is not a calendar date written YYYY-MM-DD' })

const cents = z.number().int()
const gifi = z.number().int().nullable()

const PostingSchema = z.object({ account: z.string(), debitCents: cents, creditCents: cents })
const LineSchema = z.object({ account: z.string(), gifi, gifiStatus: z.string().nullable(), debitCents: cents, creditCents: cents })
const TrialBalanceSchema = z.object({
  rows: z.array(LineSchema),
  totalDebitCents: cents,
  totalCreditCents: cents,
})

export const ClientSchema = z.object({
  id: z.string().regex(CLIENT_ID),
  corporation: z.object({
    name: z.string().min(1),
    businessNumber: z.string(),
    yearStart: calendarDate,
    yearEnd: calendarDate,
  }),
  owners: z.array(z.object({ name: z.string().min(1) })),
  accounts: z.array(
    z.object({
      key: z.string().min(1),
      role: z.string(),
      currency: z.string(),
      glAccount: z.string(),
      openingCents: cents,
      closingCents: cents,
      exportRows: cents,
      qboRows: cents,
      months: z.array(
        z.object({
          month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          openingCents: cents,
          closingCents: cents,
          activityCents: cents,
          rolls: z.boolean(),
        }),
      ),
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string().min(1),
      accountKey: z.string(),
      date: calendarDate,
      amountCents: cents,
      account: z.string(),
      glAccount: z.string(),
      missingFromExport: z.boolean(),
      // Fault markers (W00a): a duplicate's original id and a row that belongs to last year; absent on a clean row.
      dupOf: z.string().optional(),
      priorYear: z.boolean().optional(),
      postings: z.array(PostingSchema),
    }),
  ),
  adjustingEntries: z.array(
    z.object({
      id: z.string().min(1),
      date: calendarDate,
      type: z.string().min(1),
      reason: z.string(),
      sources: z.array(z.string()),
      lines: z.array(LineSchema),
    }),
  ),
  trialBalance: z.object({ opening: TrialBalanceSchema, unadjusted: TrialBalanceSchema, adjusted: TrialBalanceSchema }),
  flags: z.array(
    z.object({
      id: z.string().min(1),
      rule: z.string(),
      detail: z.string(),
      severity: z.string().nullable(),
      action: z.string().nullable(),
    }),
  ),
  priorYear: z.unknown(),
})

export type Client = z.infer<typeof ClientSchema>
export type ClientId = `C${string}`
export type TrialBalanceName = 'opening' | 'unadjusted' | 'adjusted'

export type LoadCheck =
  | 'schema'
  | 'nets-to-zero'
  | 'trial-balance'
  | 'roll'
  | 'transaction-account'
  | 'gifi'
  | 'adjusting-entry'
  | 'fault-catalogue'
  | 'money'
  | 'file'
  | 'made-up-data'

export type LoadIssue = { client: ClientId; check: LoadCheck; record: string; reason: string }

/** A client the loader refuses: it fails a model check or the made-up-data guard. The message names the client. */
export class TestWorldLoadError extends Error {
  readonly issues: LoadIssue[]
  constructor(client: ClientId, issues: LoadIssue[]) {
    const first = issues[0]
    super(
      `test-world client ${client} refused with ${String(issues.length)} issue(s)${first === undefined ? '' : `; first: ${first.check} ${first.record}: ${first.reason}`}`,
    )
    this.name = 'TestWorldLoadError'
    this.issues = issues
  }
}
