// Spec-owned helpers for the W00a acceptance tests (findings W00 r2 S5 to S7, RC4).
//
// Every case comes from a walk over the numbered folders of reference/sample-clients/ (all 15 today), never
// from a typed list: a folder W14, W15 or a kind card adds is walked with no change here. The walk reads the
// raw files with its own code (no product module), so the expected answers do not come from the code under test.
// A Sandbox holds one temp copy of the whole sample folder per test file; a test plants one fault in it, loads
// through the public loader, and the Sandbox puts every touched file back after the test.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import { faults, loadClient, type FaultEntry } from '../../index'
import { TestWorldLoadError } from '../index'

export const SAMPLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference', 'sample-clients')

/** One month of an answer key's statementBalances (dollars as JSON numbers). */
export interface RawMonth {
  month: string
  opening: number
  closing: number
  rolls: boolean
  exportActivity?: number
  note?: string
}
export interface RawAccount {
  key: string
  role: string
  file: string
  qboFile: string
  openingBalance: number
  closingBalance: number
}
export interface RawTx {
  id: string
  acct: string
  date: string
  amount: number
  account: string
  accountNo: string | null
  missingFromExport?: boolean
  dupOf?: string
  priorYear?: boolean
  flags?: string[]
  [field: string]: unknown
}
export interface RawEntry {
  id: string
  source: { transactions: string[]; onboarding: string[] }
}
export interface RawKey {
  fiscalYear: { start: string; end: string }
  accounts: RawAccount[]
  transactions: RawTx[]
  statementBalances: Record<string, RawMonth[]>
  adjustingEntries: RawEntry[]
  flags: { id: string }[]
}
export type RawOnboarding = Record<string, unknown>

export interface WalkClient {
  /** C01 upward, from the folder's two-digit number. */
  id: string
  folder: string
  key: RawKey
  onboarding: RawOnboarding
}

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8')) as unknown

/** Every numbered sample folder that has an answer key, in folder order. */
export function walkClients(): WalkClient[] {
  return readdirSync(SAMPLE_ROOT)
    .sort()
    .filter((n) => /^\d\d-/.test(n) && existsSync(join(SAMPLE_ROOT, n, 'answer-key.json')))
    .map((folder) => ({
      id: `C${folder.slice(0, 2)}`,
      folder,
      key: readJson(join(SAMPLE_ROOT, folder, 'answer-key.json')) as RawKey,
      onboarding: readJson(join(SAMPLE_ROOT, folder, 'onboarding.json')) as RawOnboarding,
    }))
}

// ---- money and months (cents; never a float sum) ----

export const cents = (dollars: number): number => Math.round(dollars * 100)
export const dollars = (c: number): number => c / 100
/** A card balance goes up with spending: activity is subtracted, as the model's roll does for card and pcard. */
export const sign = (role: string): number => (role === 'card' || role === 'pcard' ? -1 : 1)
export const monthOf = (date: string): string => date.slice(0, 7)
export function addMonth(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${String(yy)}-${String(mm + 1).padStart(2, '0')}`
}

export type MarkerField = 'missingFromExport' | 'dupOf' | 'priorYear'
export const MARKER_FIELDS: readonly MarkerField[] = ['missingFromExport', 'dupOf', 'priorYear']
export function markersOf(t: RawTx): MarkerField[] {
  const out: MarkerField[] = []
  if (t.missingFromExport === true) out.push('missingFromExport')
  if (typeof t.dupOf === 'string') out.push('dupOf')
  if (t.priorYear === true) out.push('priorYear')
  return out
}

/** One (client, marker, account, month) group: what one catalogue marker entry covers. */
export interface MarkerGroup {
  client: string
  field: MarkerField
  account: string
  month: string
}
export const groupLabel = (g: MarkerGroup): string => `${g.client} ${g.field} ${g.account} ${g.month}`

export function markerGroups(c: WalkClient): MarkerGroup[] {
  const seen = new Map<string, MarkerGroup>()
  for (const t of c.key.transactions) {
    for (const field of markersOf(t)) {
      const g = { client: c.id, field, account: t.acct, month: monthOf(t.date) }
      seen.set(groupLabel(g), g)
    }
  }
  return [...seen.values()]
}

/** The two rolls of one account month, computed here from the raw file (findings W00 r2, card decisions). */
export interface MonthRoll {
  client: string
  account: string
  month: string
  /** dupOf and priorYear rows out, missingFromExport rows in: must hold for every month, no waiver. */
  statementRolls: boolean
  /** missingFromExport rows out, dupOf rows in: closing minus (opening plus export activity), in cents. */
  exportGapCents: number
  missingCents: number
  duplicateCents: number
}

export function monthRolls(c: WalkClient): MonthRoll[] {
  const out: MonthRoll[] = []
  for (const a of c.key.accounts) {
    const s = sign(a.role)
    for (const m of c.key.statementBalances[a.key] ?? []) {
      const tx = c.key.transactions.filter((t) => t.acct === a.key && monthOf(t.date) === m.month)
      const total = (xs: RawTx[]): number => xs.reduce((n, t) => n + cents(t.amount), 0)
      const statement = total(tx.filter((t) => typeof t.dupOf !== 'string' && t.priorYear !== true))
      const exported = total(tx.filter((t) => t.missingFromExport !== true))
      out.push({
        client: c.id,
        account: a.key,
        month: m.month,
        statementRolls: cents(m.opening) + s * statement === cents(m.closing),
        exportGapCents: cents(m.closing) - (cents(m.opening) + s * exported),
        missingCents: total(tx.filter((t) => t.missingFromExport === true)),
        duplicateCents: total(tx.filter((t) => typeof t.dupOf === 'string')),
      })
    }
  }
  return out
}

/** The cause a month's export gap has in the raw data: missing rows, duplicated rows, or (undefined) neither. */
export function causeOf(r: MonthRoll): 'missing' | 'duplicate' | undefined {
  if (r.missingCents !== 0 && r.duplicateCents === 0) return 'missing'
  if (r.duplicateCents !== 0 && r.missingCents === 0) return 'duplicate'
  return undefined
}

/** For each account: a month with no marker and no export gap, and its first transaction with a non-zero amount. */
export function plainMonth(c: WalkClient, a: RawAccount): { month: string; tx: RawTx; index: number } {
  const rolls = monthRolls(c).filter((r) => r.account === a.key)
  const months = c.key.statementBalances[a.key] ?? []
  for (const [index, m] of months.entries()) {
    const r = rolls.find((x) => x.month === m.month)
    if (r === undefined || r.exportGapCents !== 0 || r.missingCents !== 0 || r.duplicateCents !== 0) continue
    const tx = c.key.transactions.find((t) => t.acct === a.key && monthOf(t.date) === m.month && t.amount !== 0 && markersOf(t).length === 0)
    if (tx !== undefined) return { month: m.month, tx, index }
  }
  throw new Error(`fixture: ${c.id} ${a.key} has no plain month with a transaction (report to the Lead)`)
}

/** What an adjusting entry's onboarding source points at in onboarding.json (amber, W00a spec): a top-level key
 * (the text before any " (note)"), or the question_asked id of an entry in `answers` (C12: FL:96, YE1.vehicle). */
export function onboardingTarget(o: RawOnboarding, source: string): { kind: 'key'; key: string } | { kind: 'answer'; id: string } | undefined {
  const base = source.replace(/\s*\(.*\)\s*$/, '')
  if (Object.hasOwn(o, base)) return { kind: 'key', key: base }
  const answers = o['answers']
  if (Array.isArray(answers) && answers.some((x) => (x as { question_asked?: unknown }).question_asked === source)) return { kind: 'answer', id: source }
  return undefined
}

// ---- the sandbox ----

export class Sandbox {
  readonly root: string
  private readonly saved = new Map<string, Buffer | null>()

  constructor() {
    this.root = mkdtempSync(join(tmpdir(), 'w00a-samples-'))
    cpSync(SAMPLE_ROOT, this.root, { recursive: true })
  }

  path(c: WalkClient, rel: string): string {
    return join(this.root, c.folder, rel)
  }

  private save(p: string): void {
    if (!this.saved.has(p)) this.saved.set(p, existsSync(p) ? readFileSync(p) : null)
  }

  /** Rewrites the client's answer-key.json in the copy (starting from the copy's current text). */
  editKey(c: WalkClient, edit: (k: RawKey) => void): void {
    this.editJson(c, 'answer-key.json', (j) => {
      edit(j as RawKey)
    })
  }

  editOnboarding(c: WalkClient, edit: (o: RawOnboarding) => void): void {
    this.editJson(c, 'onboarding.json', (j) => {
      edit(j as RawOnboarding)
    })
  }

  private editJson(c: WalkClient, rel: string, edit: (j: unknown) => void): void {
    const p = this.path(c, rel)
    this.save(p)
    const j = JSON.parse(readFileSync(p, 'utf8')) as unknown
    edit(j)
    writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
  }

  remove(c: WalkClient, rel: string): void {
    const p = this.path(c, rel)
    this.save(p)
    rmSync(p, { force: true })
  }

  /** Puts every touched file back byte for byte. */
  restore(): void {
    for (const [p, bytes] of this.saved) {
      if (bytes === null) rmSync(p, { force: true })
      else writeFileSync(p, bytes)
    }
    this.saved.clear()
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true })
  }
}

/** The months of one account in a raw key being edited (the fixture fails when they are not there). */
export function monthsIn(k: RawKey, account: string): RawMonth[] {
  const ms = k.statementBalances[account]
  if (ms === undefined) throw new Error(`fixture: no statement balances for ${account}`)
  return ms
}

export function accountIn(k: RawKey, account: string): RawAccount {
  const a = k.accounts.find((x) => x.key === account)
  if (a === undefined) throw new Error(`fixture: no account ${account}`)
  return a
}

/** Moves the closing of months[from] and every later opening and closing, and the account's closing balance, by d cents. */
export function shiftFrom(k: RawKey, account: string, from: number, d: number, alsoOpeningAtFrom: boolean): void {
  const ms = monthsIn(k, account)
  for (const [i, m] of ms.entries()) {
    if (i < from) continue
    if (i > from || alsoOpeningAtFrom) m.opening = dollars(cents(m.opening) + d)
    m.closing = dollars(cents(m.closing) + d)
  }
  const a = accountIn(k, account)
  a.closingBalance = dollars(cents(a.closingBalance) + d)
}

// ---- the catalogue and the loader, through the public API ----

/**
 * One marked row as the catalogue pins it (W00c round 2, A400): the transaction id, its date, its amount in integer
 * cents as written in the answer key, and (on a dupOf marker only) the id its dupOf names.
 */
export interface PinRow {
  id: string
  date: string
  amountCents: number
  dupOf?: string
}

/** The pin of one marked row, computed from the raw file (dupOf only for a dupOf marker). */
export function pinOf(t: RawTx, field: string): PinRow {
  return { id: t.id, date: t.date, amountCents: cents(t.amount), ...(field === 'dupOf' ? { dupOf: String(t.dupOf) } : {}) }
}

/**
 * A catalogue entry as these tests read and plant it (A353, the W00a decisions roll.cause and marker, and W00c
 * round 2: marker.rows lists every marked row by id, date and amount; `empty: 'accounts'` declares a client with no
 * accounts by design).
 */
export interface CatalogueEntry {
  id: string
  client?: string
  flagId?: string
  planted?: string
  expected?: string
  roll?: { account: string; month: string; cause?: string }
  marker?: { field: string; account: string; month: string; rows?: PinRow[] }
  empty?: string
  [field: string]: unknown
}

/** A deep copy of the hand-written catalogue, so a test can change it and pass it to the loader. */
export function catalogue(): CatalogueEntry[] {
  const copy: unknown = structuredClone(faults())
  return copy as CatalogueEntry[]
}

export type Issue = { client: string; check: string; record: string; reason: string }

const asFaults = (cat: CatalogueEntry[]): FaultEntry[] => cat as unknown as FaultEntry[]

/** Loads through the public loader from the sandbox; resolves to the client or the error it threw. */
async function attempt(sb: Sandbox, id: string, cat?: CatalogueEntry[]): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const opts = cat === undefined ? { root: sb.root } : { root: sb.root, faults: asFaults(cat) }
    await Promise.resolve(loadClient(id as `C${string}`, opts))
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

/** Expects the client to load with no issue. */
export async function expectLoads(sb: Sandbox, id: string, cat?: CatalogueEntry[]): Promise<void> {
  const r = await attempt(sb, id, cat)
  const detail = r.ok ? '' : r.error instanceof TestWorldLoadError ? JSON.stringify(r.error.issues) : String(r.error)
  expect(r.ok, `${id} should load: ${detail}`).toBe(true)
}

/** Expects a TestWorldLoadError (never a raw ENOENT or a TypeError) and returns its issues. */
export async function refusal(sb: Sandbox, id: string, cat?: CatalogueEntry[]): Promise<Issue[]> {
  const r = await attempt(sb, id, cat)
  expect(r.ok, `${id} should have been refused`).toBe(false)
  const error = r.ok ? undefined : r.error
  expect(error, `${id} should be refused with a TestWorldLoadError, got ${String(error)}`).toBeInstanceOf(TestWorldLoadError)
  const issues = (error as TestWorldLoadError).issues as Issue[]
  expect(issues.length).toBeGreaterThan(0)
  for (const i of issues) {
    expect(i.client).toBe(id)
    expect(i.reason.trim().length).toBeGreaterThan(0)
  }
  return issues
}

/** Some issue has this check and its record contains every part. */
export function expectIssue(issues: Issue[], check: string, ...recordParts: string[]): void {
  const hit = issues.some((i) => i.check === check && recordParts.every((p) => i.record.includes(p)))
  expect(hit, `expected a "${check}" issue whose record names ${recordParts.join(' and ')}; got ${JSON.stringify(issues)}`).toBe(true)
}

/** Some issue has this check, its record contains every record part, and its record or reason contains every text part. */
export function expectIssueWith(issues: Issue[], check: string, recordParts: string[], textParts: string[]): void {
  const hit = issues.some(
    (i) => i.check === check && recordParts.every((p) => i.record.includes(p)) && textParts.every((p) => `${i.record} ${i.reason}`.includes(p)),
  )
  expect(
    hit,
    `expected a "${check}" issue whose record names ${recordParts.join(' and ')} and whose text names ${textParts.join(' and ')}; got ${JSON.stringify(issues)}`,
  ).toBe(true)
}
