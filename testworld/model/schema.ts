// @mutate
// The typed model of a test-world client (END-9, ARC-8). Money is integer cents everywhere (ARC-13).
import { z } from 'zod'

export const CLIENT_ID = /^C\d{2}$/

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
    yearStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    yearEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
          month: z.string().regex(/^\d{4}-\d{2}$/),
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
      date: z.string(),
      amountCents: cents,
      account: z.string(),
      glAccount: z.string(),
      missingFromExport: z.boolean(),
      postings: z.array(PostingSchema),
    }),
  ),
  adjustingEntries: z.array(
    z.object({
      id: z.string().min(1),
      date: z.string(),
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
