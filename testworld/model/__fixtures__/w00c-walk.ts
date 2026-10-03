// Spec-owned helpers for the W00c acceptance tests (reports/W00a-findings.md, "Tests to add", RC1 to RC4).
//
// Round 2 (reports/W00c-findings.md): marker pins are lists of row ids with date and amount (A400), and the
// Planter also makes symbolic links, swaps a folder for a link to it, and puts copies outside the client folder.
//
// Every case comes from the walk over the numbered folders of reference/sample-clients/ in sample-walk.ts (all 15
// today), never from a typed list. Expected values (marked rows and their pins, fiscal months, the roles in use)
// are computed here from the raw files with this file's own code, never by the module under test.
// Planter adds what Sandbox cannot: a new file, a directory in place of a file, a file's text replaced, and links.
import { copyFileSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect } from 'vitest'
import {
  cents,
  markerGroups,
  pinOf,
  markersOf,
  monthOf,
  type CatalogueEntry,
  type Issue,
  type MarkerField,
  type MarkerGroup,
  type PinRow,
  type RawKey,
  type RawTx,
  type Sandbox,
  type WalkClient,
} from './sample-walk'

/** The parts of a raw answer key the W00c cases plant into, on top of sample-walk's RawKey. */
export interface TbRow {
  account: string
  debit: number
  credit: number
  [field: string]: unknown
}
export interface FullEntry {
  id: string
  date: string
  lines: TbRow[]
  source: { transactions: string[]; onboarding: string[] }
  [field: string]: unknown
}
export type TbName = 'opening' | 'unadjusted' | 'adjusted'
export const TB_NAMES: readonly TbName[] = ['opening', 'unadjusted', 'adjusted']
export interface FullKey extends RawKey {
  adjustingEntries: FullEntry[]
  trialBalance: Record<TbName, { rows: TbRow[] }>
  flags: { id: string; [field: string]: unknown }[]
}
export const full = (k: RawKey): FullKey => k as FullKey

/** A catalogue marker entry as W00c round 2 pins it (A400): the group it covers plus every marked row by id. */
export interface PinnedMarker {
  field: string
  account: string
  month: string
  rows?: PinRow[]
}
export const pinned = (e: CatalogueEntry): PinnedMarker | undefined => e.marker

// ---- marked rows (RC1) ----

export interface MarkedRow {
  c: WalkClient
  t: RawTx
  field: MarkerField
  group: MarkerGroup
}

/** Every marked row of every client, once per marker it carries. */
export function markedRows(clients: WalkClient[]): MarkedRow[] {
  return clients.flatMap((c) =>
    c.key.transactions.flatMap((t) => markersOf(t).map((field): MarkedRow => ({ c, t, field, group: { client: c.id, field, account: t.acct, month: monthOf(t.date) } }))),
  )
}

/** The rows of one marker group in the raw data, with their count and signed cent total (as written in the file). */
export function groupRows(c: WalkClient, g: MarkerGroup): { rows: RawTx[]; count: number; totalCents: number } {
  const rows = c.key.transactions.filter((t) => t.acct === g.account && monthOf(t.date) === g.month && markersOf(t).includes(g.field))
  return { rows, count: rows.length, totalCents: rows.reduce((n, t) => n + cents(t.amount), 0) }
}

export const sameGroup = (e: CatalogueEntry, g: MarkerGroup): boolean =>
  e.client === g.client && e.marker?.field === g.field && e.marker.account === g.account && e.marker.month === g.month

/** The one catalogue entry carrying this group's marker (the fixture fails when there is not exactly one). */
export function entryFor(cat: CatalogueEntry[], g: MarkerGroup): CatalogueEntry & { marker: PinnedMarker } {
  const hits = cat.filter((e) => sameGroup(e, g))
  const e = hits[0]
  if (hits.length !== 1 || e?.marker === undefined) throw new Error(`fixture: the catalogue has ${String(hits.length)} entries for ${g.client} ${g.field} ${g.account} ${g.month}`)
  return e as CatalogueEntry & { marker: PinnedMarker }
}

/** The pins the catalogue must hold for one marker group: its marked rows in answer-key order (computed here). */
export function groupPins(c: WalkClient, g: MarkerGroup): PinRow[] {
  return groupRows(c, g).rows.map((t) => pinOf(t, g.field))
}

/** The pinned rows of a marker entry (the fixture fails when the entry has no list). */
export function pinsOf(e: CatalogueEntry): PinRow[] {
  const rows = e.marker?.rows
  if (!Array.isArray(rows)) throw new Error(`the catalogue entry ${e.id} lists no marker rows (W00c round 2: marker.rows lists every marked row by id, date and amountCents)`)
  return rows
}

/** Changes one pinned row of the entry in place (the fixture fails when the id is not pinned there). */
export function editPin(e: CatalogueEntry, id: string, change: (p: PinRow) => void): void {
  const p = pinsOf(e).find((x) => x.id === id)
  if (p === undefined) throw new Error(`fixture: ${e.id} does not pin ${id}`)
  change(p)
}

/** Adds a pinned row to the entry's list. */
export function addPin(e: CatalogueEntry, pin: PinRow): void {
  pinsOf(e).push(pin)
}

/** Takes a pinned row off the entry; when it was the last, the marker goes too (an empty list is itself refused). */
export function dropPin(e: CatalogueEntry, id: string): void {
  const rows = pinsOf(e)
  const i = rows.findIndex((x) => x.id === id)
  if (i < 0) throw new Error(`fixture: ${e.id} does not pin ${id}`)
  rows.splice(i, 1)
  if (rows.length === 0) Reflect.deleteProperty(e, 'marker')
}

/** A flag entry of this client that carries no marker yet (to hold a planted marker). */
export function freeFlagEntry(cat: CatalogueEntry[], client: string): CatalogueEntry {
  const e = cat.find((x) => x.client === client && x.flagId !== undefined && x.marker === undefined && x.roll === undefined)
  if (e === undefined) throw new Error(`fixture: ${client} has no flag entry free to carry a marker`)
  return e
}

/** Every client's marker groups. */
export const allGroups = (clients: WalkClient[]): { c: WalkClient; g: MarkerGroup }[] => clients.flatMap((c) => markerGroups(c).map((g) => ({ c, g })))

/** A copy of row t with a new id and no postings (a planted row posts nothing, so the trial balances are untouched). */
export function plantRow(t: RawTx, id: string, changes: Partial<RawTx>): RawTx {
  const r = structuredClone(t)
  delete r['post']
  delete r['pair']
  delete r['flags']
  return { ...r, ...changes, id }
}

export function txIn(k: RawKey, id: string): RawTx {
  const t = k.transactions.find((x) => x.id === id)
  if (t === undefined) throw new Error(`fixture: no transaction ${id}`)
  return t
}

// ---- dates (RC4) ----

/** Days in a YYYY-MM month (Gregorian, UTC). */
export function daysIn(ym: string): number {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()
}

/** The three bad dates of the findings, built on a real date's month: day 99, the day after the month's last, and no day. */
export function badDates(date: string): { label: string; value: string }[] {
  const ym = monthOf(date)
  return [
    { label: 'day 99', value: `${ym}-99` },
    { label: `day ${String(daysIn(ym) + 1)} (one past the month's last)`, value: `${ym}-${String(daysIn(ym) + 1)}` },
    { label: 'no day', value: ym },
  ]
}

/** The YYYY-MM months of the fiscal year, start to end, computed from the raw key. */
export function fiscalMonths(k: RawKey): string[] {
  const index = (d: string): number => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1
  const out: string[] = []
  for (let i = index(k.fiscalYear.start); i <= index(k.fiscalYear.end); i++) out.push(`${String(Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, '0')}`)
  return out
}

// ---- issues ----

const text = (i: Issue): string => `${i.record} ${i.reason}`

/** Some issue (of this check, when given) whose record or reason contains every part. */
export function expectNamed(issues: Issue[], check: string | undefined, parts: string[]): void {
  const hit = issues.some((i) => (check === undefined || i.check === check) && parts.every((p) => text(i).includes(p)))
  expect(hit, `expected a ${check === undefined ? 'LoadIssue' : `"${check}" issue`} naming ${parts.join(' and ')}; got ${JSON.stringify(issues)}`).toBe(true)
}

/** Some issue (any check) whose record or reason contains every part of `all` and at least one of `any`. */
export function expectNamedOneOf(issues: Issue[], all: string[], any: string[]): void {
  const hit = issues.some((i) => all.every((p) => text(i).includes(p)) && any.some((p) => text(i).includes(p)))
  expect(hit, `expected a LoadIssue naming ${all.join(' and ')} and one of ${any.join(', ')}; got ${JSON.stringify(issues)}`).toBe(true)
}

// ---- the planter ----

/** File-system plants beyond Sandbox's JSON edits; undo() removes what it made. Call undo() before Sandbox.restore(). */
export class Planter {
  private readonly made: string[] = []
  constructor(private readonly sb: Sandbox) {}

  /** A new regular file in the client folder (it must not be there yet). */
  newFile(c: WalkClient, rel: string, body: string): void {
    const p = this.sb.path(c, rel)
    writeFileSync(p, body, { flag: 'wx' })
    this.made.push(p)
  }

  /** The client file replaced by an empty directory of the same name. */
  directoryFor(c: WalkClient, rel: string): void {
    this.sb.remove(c, rel)
    const p = this.sb.path(c, rel)
    mkdirSync(p)
    this.made.push(p)
  }

  /** The client file's text replaced (Sandbox puts the original bytes back). */
  replaceText(c: WalkClient, rel: string, body: string): void {
    this.sb.remove(c, rel)
    writeFileSync(this.sb.path(c, rel), body)
  }

  /** A symbolic link at rel in the client folder pointing at target (written as given: relative to the link's folder, or absolute). */
  link(c: WalkClient, rel: string, target: string): void {
    const p = this.sb.path(c, rel)
    symlinkSync(target, p)
    this.made.push(p)
  }

  /** The client file replaced by a link to a byte-for-byte copy outside every client folder (in the sandbox root). */
  linkToOutsideCopy(c: WalkClient, rel: string): void {
    const dir = join(this.sb.root, 'links-(Test)', c.folder)
    mkdirSync(dir, { recursive: true })
    const copy = join(dir, rel)
    mkdirSync(dirname(copy), { recursive: true })
    copyFileSync(this.sb.path(c, rel), copy)
    this.sb.remove(c, rel)
    symlinkSync(copy, this.sb.path(c, rel))
    this.made.push(this.sb.path(c, rel), join(this.sb.root, 'links-(Test)'))
  }

  /** The client subfolder dir renamed to "<dir>-real-(Test)" and dir made a link to it (relative, inside the folder). */
  folderAsLink(c: WalkClient, dir: string): void {
    const p = this.sb.path(c, dir)
    const real = `${p}-real-(Test)`
    renameSync(p, real)
    symlinkSync(`${dir}-real-(Test)`, p)
    this.undos.push(() => {
      rmSync(p, { force: true })
      renameSync(real, p)
    })
  }

  private readonly undos: (() => void)[] = []

  undo(): void {
    for (const p of this.made.splice(0)) rmSync(p, { recursive: true, force: true })
    for (const u of this.undos.splice(0).reverse()) u()
  }
}
