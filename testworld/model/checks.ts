// @mutate
// The model checks that run on every load (ARC-8): each fails with the client, the record and the reason.
// No check takes its pass condition from the data it checks: the roll waiver and the flag list come from the
// hand-written fault catalogue (A353), and an empty collection is a refusal where something must be there.
import { centsToDecimal } from '../../src/core/money'
import type { FaultEntry } from './faults'
import type { Client, ClientId, LoadIssue, TrialBalanceName } from './schema'

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
const usd = (c: number): string => centsToDecimal(c)

/** The keys that appear more than once in a list, each once, in the order their second copy shows. */
function repeated<T>(xs: readonly T[], key: (x: T) => string): string[] {
  const seen = new Set<string>()
  const again = new Set<string>()
  for (const x of xs) {
    const k = key(x)
    if (seen.has(k)) again.add(k)
    seen.add(k)
  }
  return [...again]
}

export function modelIssues(c: Client, catalogue: readonly FaultEntry[]): LoadIssue[] {
  const client = c.id as ClientId
  const issues: LoadIssue[] = []
  const add = (check: LoadIssue['check'], record: string, reason: string): void => {
    issues.push({ client, check, record, reason })
  }

  // Every id-keyed list refuses a repeat, and no account key may be the name of an Object.prototype member (W00c RC2).
  for (const k of repeated(c.accounts, (a) => a.key)) add('schema', k, 'two accounts have this key')
  for (const a of c.accounts) if (a.key in Object.prototype) add('schema', a.key, 'the account key is the name of an Object.prototype member, which a lookup would find without it being declared')
  for (const k of repeated(c.transactions, (t) => t.id)) add('schema', k, 'two transactions have this id')
  for (const k of repeated(c.adjustingEntries, (j) => j.id)) add('adjusting-entry', k, 'two adjusting entries have this id')
  for (const k of repeated(c.flags, (f) => f.id)) add('schema', k, 'two flags have this id')

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
    for (const a of repeated(tb.rows, (r) => r.account)) add('trial-balance', `${name} ${a}`, 'the trial balance has two rows for this account')
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
  const shown = new Map<string, number>()
  for (const r of c.trialBalance[name].rows) shown.set(r.account, (shown.get(r.account) ?? 0) + r.debitCents - r.creditCents)
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
  const index = (d: string): number => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1
  const out: string[] = []
  for (let i = index(start); i <= index(end); i++) out.push(`${String(Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, '0')}`)
  return out
}

/**
 * Month sequences, both rolls and the fault markers (ARC-8, W00a). A marker never changes the statement roll's
 * arithmetic; the export roll may fail only where the hand-written catalogue lists the month and its cause explains the gap.
 */
function rollIssues(c: Client, catalogue: readonly FaultEntry[], add: Add): void {
  const mine = catalogue.filter((f) => f.client === c.id)
  const waivers = mine.flatMap((f) => (f.roll === undefined ? [] : [{ id: f.id, ...f.roll }]))
  const markers = mine.flatMap((f) => (f.marker === undefined ? [] : [{ id: f.id, marker: f.marker, flagId: f.flagId, isRoll: f.roll !== undefined }]))
  const year = yearMonths(c.corporation.yearStart, c.corporation.yearEnd)
  const covered = new Set(markers.filter((f) => f.flagId !== undefined).map((f) => markerKey(f.marker)))

  for (const a of c.accounts) {
    const months = a.months
    const sign = a.role === 'card' || a.role === 'pcard' ? -1 : 1
    const own = c.transactions.filter((t) => t.accountKey === a.key)
    if (months.length === 0 && own.length > 0) add('roll', a.key, 'it has transactions but no statement balances, so there is nothing to roll')
    for (const [i, m] of months.entries()) {
      const where = `${a.key} ${m.month}`
      const prev = months[i - 1]
      if (prev !== undefined && m.month <= prev.month) add('roll', where, m.month === prev.month ? 'the month is listed twice' : 'the months are out of order')
      if (!year.includes(m.month)) add('roll', where, `the month is outside the fiscal year ${c.corporation.yearStart} to ${c.corporation.yearEnd}`)
      if (prev !== undefined && prev.closingCents !== m.openingCents) {
        add('roll', where, `it opens at ${usd(m.openingCents)} but the month before closed at ${usd(prev.closingCents)}`)
      }
      const inMonth = own.filter((t) => t.date.slice(0, 7) === m.month)
      const total = (xs: typeof inMonth): number => sum(xs.map((t) => t.amountCents))
      // The statement holds every real row: duplicates and last year's rows are not on it, missing rows are.
      const statement = m.openingCents + sign * total(inMonth.filter((t) => t.dupOf === undefined && t.priorYear !== true))
      if (statement !== m.closingCents) {
        add('roll', where, `the statement roll: opening ${usd(m.openingCents)} with the month's rows gives ${usd(statement)}, not the closing ${usd(m.closingCents)}; a fault marker never excuses it`)
      }
      const gap = m.closingCents - (m.openingCents + sign * total(inMonth.filter((t) => !t.missingFromExport)))
      const waiver = waivers.find((f) => f.account === a.key && f.month === m.month)
      if (gap === 0) {
        if (waiver !== undefined) add('roll', where, 'the fault catalogue lists it as a planted fault but the month rolls')
      } else if (waiver === undefined) {
        add('roll', where, `the export gives ${usd(m.closingCents - gap)}, not the closing ${usd(m.closingCents)}, and the fault catalogue lists no planted fault for it`)
      } else {
        const cause = waiver.cause
        const explained =
          cause === 'missing'
            ? gap === sign * total(inMonth.filter((t) => t.missingFromExport))
            : cause === 'duplicate' && gap === -sign * total(inMonth.filter((t) => t.dupOf !== undefined))
        if (!explained) add('roll', where, `the export gap ${usd(gap)} is not explained exactly by the catalogue's cause ${String(cause)}`)
      }
    }
    // These run for an account with no months too: first and last are then undefined and every month of the year is missing.
    const first = months[0]
    const last = months[months.length - 1]
    if (first !== undefined && first.openingCents !== a.openingCents) add('roll', `${a.key} ${first.month}`, `the first month opens at ${usd(first.openingCents)} but the account opens at ${usd(a.openingCents)}`)
    if (last !== undefined && last.closingCents !== a.closingCents) add('roll', `${a.key} ${last.month}`, `the last month closes at ${usd(last.closingCents)} but the account closes at ${usd(a.closingCents)}`)
    const listed = new Set(months.map((m) => m.month))
    for (const m of year) if (!listed.has(m)) add('roll', `${a.key} ${m}`, 'the month of the fiscal year has no statement balances')
    const names = new Set(months.map((m) => m.month))
    for (const t of own) {
      const priorListed = t.priorYear === true && t.date < c.corporation.yearStart && covered.has(markerKey({ field: 'priorYear', account: a.key, month: t.date.slice(0, 7) }))
      if (!names.has(t.date.slice(0, 7)) && !priorListed) add('roll', t.id, `it is dated ${t.date}, in no month of ${a.key}`)
    }
  }

  for (const f of waivers) {
    const month = c.accounts.find((a) => a.key === f.account)?.months.some((m) => m.month === f.month)
    if (month !== true) add('fault-catalogue', f.id, `the catalogue waives ${f.account} ${f.month}, which this client does not have`)
  }

  const carried = new Set<string>()
  for (const t of c.transactions) {
    for (const field of fieldsOf(t)) {
      const m = { field, account: t.accountKey, month: t.date.slice(0, 7) }
      carried.add(markerKey(m))
      if (!covered.has(markerKey(m))) {
        add('fault-catalogue', `${m.account} ${m.month}`, `${t.id} carries ${field} and the fault catalogue has no flag entry with that marker for this account and month`)
      }
    }
  }
  const byId = new Map<string, Client['transactions'][number]>()
  for (const t of c.transactions) if (!byId.has(t.id)) byId.set(t.id, t)
  const copyOf = new Map<string, string>()
  for (const t of c.transactions) {
    if (t.dupOf !== undefined) {
      const o = byId.get(t.dupOf)
      const why =
        o === undefined
          ? `its original "${t.dupOf}" is not a transaction of this client`
          : o.id === t.id
            ? 'it is its own original'
            : fieldsOf(o).length > 0
              ? `its original ${o.id} carries a fault marker itself`
              : o.accountKey !== t.accountKey || o.date !== t.date || o.amountCents !== t.amountCents
                ? `it does not match its original ${o.id} in account, date and amount`
                : undefined
      if (why !== undefined) add('fault-catalogue', t.id, why)
      else if (o !== undefined) {
        const other = copyOf.get(o.id)
        if (other !== undefined) add('fault-catalogue', t.id, `its original ${o.id} already has a duplicate, ${other}`)
        else copyOf.set(o.id, t.id)
      }
    }
    if (t.priorYear === true && t.date >= c.corporation.yearStart) add('fault-catalogue', t.id, `it is marked priorYear but dated ${t.date}, not before the fiscal year starts on ${c.corporation.yearStart}`)
  }
  for (const f of markers) {
    const rows = c.transactions.filter((t) => t.accountKey === f.marker.account && t.date.slice(0, 7) === f.marker.month && fieldsOf(t).includes(f.marker.field))
    const total = sum(rows.map((t) => t.amountCents))
    if (f.marker.rows !== rows.length || f.marker.totalCents !== total) {
      add('fault-catalogue', f.id, `its pinned ${String(f.marker.rows)} row(s) totalling ${String(f.marker.totalCents)} cents do not match the answer key's ${String(rows.length)} row(s) totalling ${String(total)} cents`)
    }
    if (f.isRoll) add('fault-catalogue', f.id, 'a roll entry is not a marker entry')
    if (f.flagId === undefined) add('fault-catalogue', f.id, 'a marker entry must be on the entry of the flag the planted fault raises')
    if (!carried.has(markerKey(f.marker))) add('fault-catalogue', f.id, `no transaction carries its marker ${markerKey(f.marker)}`)
  }
}
/** The fault markers a transaction carries. */
const fieldsOf = (t: Client['transactions'][number]): Marker['field'][] => [
  ...(t.missingFromExport ? (['missingFromExport'] as const) : []),
  ...(t.dupOf === undefined ? [] : (['dupOf'] as const)),
  ...(t.priorYear === true ? (['priorYear'] as const) : []),
]
const markerKey = (m: Pick<Marker, 'field' | 'account' | 'month'>): string => `${m.field} ${m.account} ${m.month}`
