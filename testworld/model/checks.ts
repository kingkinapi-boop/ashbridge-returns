// The model checks that run on every load (ARC-8): each fails with the client, the record and the reason.
import { centsToDecimal } from './money'
import type { Client, ClientId, LoadIssue, TrialBalanceName } from './schema'

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
const usd = (c: number): string => centsToDecimal(c)

export function modelIssues(c: Client): LoadIssue[] {
  const client = c.id as ClientId
  const issues: LoadIssue[] = []
  const add = (check: LoadIssue['check'], record: string, reason: string): void => {
    issues.push({ client, check, record, reason })
  }

  for (const j of c.adjustingEntries) {
    const dr = sum(j.lines.map((l) => l.debitCents))
    const cr = sum(j.lines.map((l) => l.creditCents))
    if (dr !== cr) add('nets-to-zero', j.id, `debits ${usd(dr)} and credits ${usd(cr)} differ`)
    if (j.reason.trim() === '') add('adjusting-entry', j.id, 'it has no reason')
    if (j.sources.length === 0) add('adjusting-entry', j.id, 'it has no source')
  }

  for (const name of ['opening', 'unadjusted', 'adjusted'] as const) {
    const tb = c.trialBalance[name]
    const dr = sum(tb.rows.map((r) => r.debitCents))
    const cr = sum(tb.rows.map((r) => r.creditCents))
    if (dr !== cr) add('trial-balance', name, `debits ${usd(dr)} and credits ${usd(cr)} differ`)
  }
  tieOut(c, 'unadjusted', false, add)
  tieOut(c, 'adjusted', true, add)

  for (const a of c.accounts) {
    for (const m of a.months) {
      const expected = a.role === 'card' || a.role === 'pcard' ? m.openingCents - m.activityCents : m.openingCents + m.activityCents
      const rolls = expected === m.closingCents
      if (rolls && !m.rolls) add('roll', `${a.key} ${m.month}`, `it is listed as a planted fault but the month rolls`)
      if (!rolls && m.rolls) {
        add(
          'roll',
          `${a.key} ${m.month}`,
          `opening ${usd(m.openingCents)} with activity ${usd(m.activityCents)} gives ${usd(expected)}, not the closing ${usd(m.closingCents)}, and no planted fault says so`,
        )
      }
    }
  }

  for (const t of c.transactions) {
    if (t.account.trim() === '') add('transaction-account', t.id, 'it has no account')
  }

  const lines = [
    ...(['opening', 'unadjusted', 'adjusted'] as const).flatMap((n) => c.trialBalance[n].rows),
    ...c.adjustingEntries.flatMap((j) => j.lines),
  ]
  for (const l of lines) {
    if (l.gifi !== null && !/^\d{4}$/.test(String(l.gifi))) add('gifi', l.account, `the GIFI code ${String(l.gifi)} is not four digits`)
  }
  return issues
}

/** Opening balances plus the postings (plus the adjusting entries for 'adjusted') equal each trial balance line. */
function tieOut(
  c: Client,
  name: TrialBalanceName,
  withAdjustments: boolean,
  add: (check: 'trial-balance', record: string, reason: string) => void,
): void {
  const net = new Map<string, number>()
  const bump = (a: string, v: number): void => {
    net.set(a, (net.get(a) ?? 0) + v)
  }
  for (const r of c.trialBalance.opening.rows) bump(r.account, r.debitCents - r.creditCents)
  for (const t of c.transactions) for (const p of t.postings) bump(p.account, p.debitCents - p.creditCents)
  if (withAdjustments) for (const j of c.adjustingEntries) for (const l of j.lines) bump(l.account, l.debitCents - l.creditCents)
  const shown = new Map(c.trialBalance[name].rows.map((r) => [r.account, r.debitCents - r.creditCents]))
  for (const a of new Set([...net.keys(), ...shown.keys()])) {
    const want = net.get(a) ?? 0
    const have = shown.get(a) ?? 0
    if (want !== have) add('trial-balance', `${name} ${a}`, `the line is ${usd(have)} but the books give ${usd(want)}`)
  }
}
