// @mutate
// The model checks that run on every load (ARC-8): each fails with the client, the record and the reason.
// No check takes its pass condition from the data it checks: the roll waiver and the flag list come from the
// hand-written fault catalogue (A353), and an empty collection is a refusal where something must be there.
import { centsToDecimal } from '../../src/core/money'
import type { FaultEntry } from './faults'
import type { Client, ClientId, LoadIssue, TrialBalanceName } from './schema'

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
const usd = (c: number): string => centsToDecimal(c)

export function modelIssues(c: Client, catalogue: readonly FaultEntry[]): LoadIssue[] {
  const client = c.id as ClientId
  const issues: LoadIssue[] = []
  const add = (check: LoadIssue['check'], record: string, reason: string): void => {
    issues.push({ client, check, record, reason })
  }

  for (const j of c.adjustingEntries) {
    if (j.lines.length === 0) add('adjusting-entry', j.id, 'it has no lines')
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

  const waivers = catalogue.filter((f) => f.client === c.id && f.roll !== undefined)
  const waived = (account: string, month: string): boolean =>
    waivers.some((f) => f.roll?.account === account && f.roll.month === month)
  for (const a of c.accounts) {
    if (a.months.length === 0 && c.transactions.some((t) => t.accountKey === a.key)) {
      add('roll', a.key, 'it has transactions but no statement balances, so there is nothing to roll')
    }
    for (const m of a.months) {
      const expected = a.role === 'card' || a.role === 'pcard' ? m.openingCents - m.activityCents : m.openingCents + m.activityCents
      const rolls = expected === m.closingCents
      const listed = waived(a.key, m.month)
      if (rolls && listed) add('roll', `${a.key} ${m.month}`, 'the fault catalogue lists it as a planted fault but the month rolls')
      if (!rolls && !listed) {
        add(
          'roll',
          `${a.key} ${m.month}`,
          `opening ${usd(m.openingCents)} with activity ${usd(m.activityCents)} gives ${usd(expected)}, not the closing ${usd(m.closingCents)}, and the fault catalogue lists no planted fault for it`,
        )
      }
    }
  }
  for (const f of waivers) {
    const month = c.accounts.find((a) => a.key === f.roll?.account)?.months.some((m) => m.month === f.roll?.month)
    if (month !== true) add('fault-catalogue', f.id, `the catalogue waives ${String(f.roll?.account)} ${String(f.roll?.month)}, which this client does not have`)
  }

  const declared = new Set(c.accounts.map((a) => a.key))
  for (const t of c.transactions) {
    if (t.account.trim() === '') add('transaction-account', t.id, 'it has no account')
    if (!declared.has(t.accountKey)) add('transaction-account', t.id, `its account "${t.accountKey}" is not one the client declares`)
  }

  const lines = [
    ...(['opening', 'unadjusted', 'adjusted'] as const).flatMap((n) => c.trialBalance[n].rows),
    ...c.adjustingEntries.flatMap((j) => j.lines),
  ]
  for (const l of lines) {
    if (l.gifi === null) {
      // A suspense line has no GIFI code until a person decides it, and says so.
      if (l.gifiStatus !== 'confirm') add('gifi', l.account, 'it has no GIFI code and is not marked "confirm" for a person to decide')
    } else if (!/^\d{4}$/.test(String(l.gifi))) add('gifi', l.account, `the GIFI code ${String(l.gifi)} is not four digits`)
  }

  const listed = new Set(catalogue.filter((f) => f.client === c.id && f.flagId !== undefined).map((f) => f.flagId))
  const real = new Set(c.flags.map((f) => f.id))
  for (const id of real) if (!listed.has(id)) add('fault-catalogue', id, 'the answer key has this flag and the fault catalogue does not list it')
  for (const id of listed) {
    if (id !== undefined && !real.has(id)) add('fault-catalogue', id, 'the fault catalogue lists this flag and the answer key does not have it')
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
