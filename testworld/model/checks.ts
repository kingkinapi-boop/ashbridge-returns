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

  rollIssues(c, catalogue, add)

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

  // Stryker disable next-line ConditionalExpression: an undefined flag id kept in the set is skipped by the guard in the loop below, so the filter test is redundant
  const listed = new Set(catalogue.filter((f) => f.client === c.id && f.flagId !== undefined).map((f) => f.flagId))
  const real = new Set(c.flags.map((f) => f.id))
  for (const id of real) if (!listed.has(id)) add('fault-catalogue', id, 'the answer key has this flag and the fault catalogue does not list it')
  for (const id of listed) {
    // Stryker disable next-line ConditionalExpression: the set is built without undefined ids (see its filter), so the guard cannot change a result
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

type Add = (check: LoadIssue['check'], record: string, reason: string) => void
type Marker = NonNullable<FaultEntry['marker']>

/** The months of a fiscal year, YYYY-MM from the start's month to the end's, in order. */
function yearMonths(start: string, end: string): string[] {
  const out: string[] = []
  for (let m = start.slice(0, 7); m <= end.slice(0, 7); m = nextMonth(m)) out.push(m)
  return out
}
const nextMonth = (ym: string): string => {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  return m === 12 ? `${String(y + 1)}-01` : `${String(y)}-${String(m + 1).padStart(2, '0')}`
}

/**
 * Month sequences, both rolls and the fault markers (ARC-8, W00a). A marker never changes the statement roll's
 * arithmetic; the export roll may fail only where the hand-written catalogue lists the month and its cause explains the gap.
 */
function rollIssues(c: Client, catalogue: readonly FaultEntry[], add: Add): void {
  const mine = catalogue.filter((f) => f.client === c.id)
  const waivers = mine.filter((f) => f.roll !== undefined)
  const markers = mine.filter((f) => f.marker !== undefined)
  const year = yearMonths(c.corporation.yearStart, c.corporation.yearEnd)
  const covered = new Set(markers.filter((f) => f.flagId !== undefined).map((f) => markerKey(f.marker as Marker)))

  for (const a of c.accounts) {
    const months = a.months
    const sign = a.role === 'card' || a.role === 'pcard' ? -1 : 1
    const own = c.transactions.filter((t) => t.accountKey === a.key)
    if (months.length === 0) {
      if (own.length > 0) add('roll', a.key, 'it has transactions but no statement balances, so there is nothing to roll')
    } else {
      const seen = new Set<string>()
      for (const [i, m] of months.entries()) {
        const where = `${a.key} ${m.month}`
        const prev = months[i - 1]
        if (seen.has(m.month)) add('roll', where, 'the month is listed twice')
        else if (prev !== undefined && m.month < prev.month) add('roll', where, 'the months are out of order')
        seen.add(m.month)
        if (!year.includes(m.month)) add('roll', where, `the month is outside the fiscal year ${c.corporation.yearStart} to ${c.corporation.yearEnd}`)
        if (prev !== undefined && prev.closingCents !== m.openingCents) {
          add('roll', where, `it opens at ${usd(m.openingCents)} but the month before closed at ${usd(prev.closingCents)}`)
        }
        const inMonth = own.filter((t) => t.date.startsWith(m.month))
        const total = (xs: typeof inMonth): number => sum(xs.map((t) => t.amountCents))
        // The statement holds every real row: duplicates and last year's rows are not on it, missing rows are.
        const statement = m.openingCents + sign * total(inMonth.filter((t) => t.dupOf === undefined && t.priorYear !== true))
        if (statement !== m.closingCents) {
          add('roll', where, `the statement roll: opening ${usd(m.openingCents)} with the month's rows gives ${usd(statement)}, not the closing ${usd(m.closingCents)}; a fault marker never excuses it`)
        }
        const gap = m.closingCents - (m.openingCents + sign * total(inMonth.filter((t) => !t.missingFromExport)))
        const waiver = waivers.find((f) => f.roll?.account === a.key && f.roll.month === m.month)
        if (gap === 0) {
          if (waiver !== undefined) add('roll', where, 'the fault catalogue lists it as a planted fault but the month rolls')
        } else if (waiver === undefined) {
          add('roll', where, `the export gives ${usd(m.closingCents - gap)}, not the closing ${usd(m.closingCents)}, and the fault catalogue lists no planted fault for it`)
        } else {
          const cause = waiver.roll?.cause
          const explained =
            cause === 'missing'
              ? gap === sign * total(inMonth.filter((t) => t.missingFromExport))
              : cause === 'duplicate' && gap === -sign * total(inMonth.filter((t) => t.dupOf !== undefined))
          if (!explained) add('roll', where, `the export gap ${usd(gap)} is not explained exactly by the catalogue's cause ${String(cause)}`)
        }
      }
      const first = months[0]
      const last = months[months.length - 1]
      if (first !== undefined && first.openingCents !== a.openingCents) add('roll', `${a.key} ${first.month}`, `the first month opens at ${usd(first.openingCents)} but the account opens at ${usd(a.openingCents)}`)
      if (last !== undefined && last.closingCents !== a.closingCents) add('roll', `${a.key} ${last.month}`, `the last month closes at ${usd(last.closingCents)} but the account closes at ${usd(a.closingCents)}`)
      const listed = new Set(months.map((m) => m.month))
      for (const m of year) if (!listed.has(m)) add('roll', `${a.key} ${m}`, 'the month of the fiscal year has no statement balances')
    }
    const names = new Set(months.map((m) => m.month))
    for (const t of own) {
      const priorListed = t.priorYear === true && covered.has(markerKey({ field: 'priorYear', account: a.key, month: t.date.slice(0, 7) }))
      if (!names.has(t.date.slice(0, 7)) && !priorListed) add('roll', t.id, `it is dated ${t.date}, in no month of ${a.key}`)
    }
  }

  for (const f of waivers) {
    const month = c.accounts.find((a) => a.key === f.roll?.account)?.months.some((m) => m.month === f.roll?.month)
    if (month !== true) add('fault-catalogue', f.id, `the catalogue waives ${String(f.roll?.account)} ${String(f.roll?.month)}, which this client does not have`)
  }

  const carried = new Set<string>()
  for (const t of c.transactions) {
    const fields = [t.missingFromExport ? 'missingFromExport' : '', t.dupOf === undefined ? '' : 'dupOf', t.priorYear === true ? 'priorYear' : ''] as const
    for (const field of fields) {
      if (field === '') continue
      const m = { field, account: t.accountKey, month: t.date.slice(0, 7) }
      carried.add(markerKey(m))
      if (!covered.has(markerKey(m))) {
        add('fault-catalogue', `${m.account} ${m.month}`, `${t.id} carries ${field} and the fault catalogue has no flag entry with that marker for this account and month`)
      }
    }
  }
  for (const f of markers) {
    if (f.roll !== undefined) add('fault-catalogue', f.id, 'a roll entry is not a marker entry')
    if (f.flagId === undefined) add('fault-catalogue', f.id, 'a marker entry must be on the entry of the flag the planted fault raises')
    if (!carried.has(markerKey(f.marker as Marker))) add('fault-catalogue', f.id, `no transaction carries its marker ${markerKey(f.marker as Marker)}`)
  }
}
const markerKey = (m: Marker): string => `${m.field} ${m.account} ${m.month}`
