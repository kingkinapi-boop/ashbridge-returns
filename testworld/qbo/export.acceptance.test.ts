// B04 acceptance tests: the test world's QBO stand-in export (TB-1, EV-5), check 10. Spec-writer's file; builders never
// edit it.
//
// The function these tests fix (spec choice, amber):
//   exportQboStandIn(id: ClientId, root: string): Promise<{ realm: string }>
// writes the stand-in folder of sample client `id` to <root>/<realm>/ in the layout the samples engine reads (written out
// at the top of src/modules/qbo/read-books.acceptance.test.ts), from W00's model (loadClient) and never changing the
// sample files. Each qbo/*.csv line is one booked transaction whose txnId is the answer key's id for that line
// (`<nn>-<ACCOUNT KEY>-...`, the answer key's id rule); its row in the file of its bank or card account
// (transactions/<accountId>.json, the account whose number is the model account's glAccount) carries the line's amount in
// debit-positive cents and the answer key's other accounts as otherAccountIds. Adjusting entries are journal entries
// with the memo `AJE <type>: <reason> | source: <source>[; <source>]` (the convention B05 reads), type taken from the
// model as it is. Counts come from the sample files and the model, never written in here (EV-5).
//
// C01's chequing and business card roll from the opening to the adjusted balance by their qbo/*.csv lines alone; C10's
// chequing does not (56 statement lines are missing from its QBO export by design), so the roll is asserted for C01 only.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { QboTrialBalanceRow, QboTransaction } from '../../src/contracts/qbo'
import { createQboReader } from '../../src/modules/qbo/index'
import { allFiles, samplesEnv, tempDir } from '../../src/modules/qbo/__fixtures__/harness'
import { clientFolders, loadClient } from '../index'
import type { ClientId } from '../model/schema'
import { exportQboStandIn } from './export'

const CLIENTS: readonly ClientId[] = ['C01', 'C10']

let tmp: { dir: string; cleanup: () => void }
beforeEach(() => {
  tmp = tempDir('export')
})
afterEach(() => {
  tmp.cleanup()
})

function folderOf(id: ClientId): string {
  const f = clientFolders().get(id)
  if (f === undefined) throw new Error(`no sample folder for ${id}`)
  return f
}

/** The data lines of a CSV file (every non-blank line after the header). */
function csvRows(file: string): number {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim() !== '').length
}

function qboCsvs(id: ClientId): string[] {
  const dir = path.join(folderOf(id), 'qbo')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.csv'))
    .sort()
    .map((f) => path.join(dir, f))
}

function hashTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of allFiles(dir)) out[path.relative(dir, f)] = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  return out
}

/** Every transaction row in the stand-in folder's transactions/*.json files. */
function standInTransactions(folder: string): QboTransaction[] {
  const dir = path.join(folder, 'transactions')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as QboTransaction[])
}

/** accountNumber to accountId, from the folder's chart of accounts (accounts.json). */
function accountIds(folder: string): Map<string, string> {
  const rows = JSON.parse(fs.readFileSync(path.join(folder, 'accounts.json'), 'utf8')) as { accountId: string; accountNumber: string }[]
  return new Map(rows.map((r) => [r.accountNumber, r.accountId]))
}

function transactionsFile(folder: string, accountId: string): QboTransaction[] {
  return JSON.parse(fs.readFileSync(path.join(folder, 'transactions', `${accountId}.json`), 'utf8')) as QboTransaction[]
}

const tbKey = (rows: readonly { account: string; debitCents: number; creditCents: number }[]): [string, number, number][] =>
  rows.map((r): [string, number, number] => [r.account, r.debitCents, r.creditCents]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]))
const fromQbo = (rows: readonly QboTrialBalanceRow[]) => rows.map((r) => ({ account: r.accountNumber, debitCents: r.debitCents, creditCents: r.creditCents }))

async function exported(id: ClientId) {
  const root = path.join(tmp.dir, id)
  fs.mkdirSync(root)
  const { realm } = await exportQboStandIn(id, root)
  const folder = path.join(root, realm)
  const reader = createQboReader({ env: samplesEnv(root) })
  return { realm, folder, reader, client: loadClient(id) }
}

describe('B04 the test world QBO stand-in export (TB-1, check 10)', () => {
  for (const id of CLIENTS) {
    test(`TB-1 ${id}: the exported year-end trial balance equals the answer key's adjusted trial balance in cents, and balances`, async () => {
      const { realm, reader, client } = await exported(id)
      const tb = await reader.trialBalance(realm, client.corporation.yearEnd, 'accrual')
      expect(tbKey(fromQbo(tb))).toEqual(tbKey(client.trialBalance.adjusted.rows))
      expect(tb.reduce((s, r) => s + r.debitCents, 0)).toBe(client.trialBalance.adjusted.totalDebitCents)
      expect(tb.reduce((s, r) => s + r.creditCents, 0)).toBe(client.trialBalance.adjusted.totalCreditCents)
    }, 30_000)

    test(`TB-1 ${id}: the exported trial balance at the day before year start equals the answer key's opening trial balance`, async () => {
      const { realm, reader, client } = await exported(id)
      const start = new Date(`${client.corporation.yearStart}T00:00:00Z`)
      start.setUTCDate(start.getUTCDate() - 1)
      const tb = await reader.trialBalance(realm, start.toISOString().slice(0, 10), 'accrual')
      expect(tbKey(fromQbo(tb))).toEqual(tbKey(client.trialBalance.opening.rows))
    }, 30_000)

    test(`TB-1 EV-5 ${id}: the booked transactions number the data rows of qbo/*.csv, one per line, with the answer key's ids`, async () => {
      const { folder, client } = await exported(id)
      const nn = id.slice(1)
      const rows = standInTransactions(folder)
      const csvTotal = qboCsvs(id).reduce((s, f) => s + csvRows(f), 0)
      expect(csvTotal).toBeGreaterThan(0)
      const booked = new Set(rows.map((r) => r.txnId).filter((t) => client.accounts.some((a) => t.startsWith(`${nn}-${a.key}-`))))
      expect(booked.size).toBe(csvTotal)
      for (const a of client.accounts) {
        const ids = new Set(rows.map((r) => r.txnId).filter((t) => t.startsWith(`${nn}-${a.key}-`)))
        expect(ids.size, a.key).toBe(a.qboRows)
        const want = new Set(client.transactions.filter((t) => t.accountKey === a.key && !t.missingFromExport).map((t) => t.id))
        expect([...ids].sort(), a.key).toEqual([...want].sort())
      }
    }, 30_000)

    test(`TB-1 ${id}: each qbo/*.csv line sits on its bank or card account with its amount in cents and the answer key's other accounts`, async () => {
      const { folder, client } = await exported(id)
      const idOf = accountIds(folder)
      for (const a of client.accounts) {
        const accountId = idOf.get(a.glAccount)
        expect(accountId, `${a.key} ${a.glAccount} in the chart of accounts`).toBeDefined()
        const onAccount = new Map(transactionsFile(folder, accountId ?? '').map((r) => [r.txnId, r]))
        for (const t of client.transactions.filter((x) => x.accountKey === a.key && !x.missingFromExport)) {
          const row = onAccount.get(t.id)
          expect(row, t.id).toBeDefined()
          expect(row?.amountCents, t.id).toBe(t.amountCents)
          expect(row?.date, t.id).toBe(t.date)
          const others = [...new Set(t.postings.map((p) => p.account).filter((n) => n !== a.glAccount))].map((n) => idOf.get(n) ?? `number ${n}`).sort()
          expect([...new Set(row?.otherAccountIds ?? [])].sort(), t.id).toEqual(others)
        }
      }
    }, 30_000)

    test(`TB-1 ${id}: every adjusting entry is a journal entry carrying its type, reason and sources in the memo convention`, async () => {
      const { folder, realm, reader, client } = await exported(id)
      const jes = await reader.journalEntries(realm, client.corporation.yearStart, client.corporation.yearEnd)
      const numberOf = new Map([...accountIds(folder)].map(([n, i]) => [i, n]))
      expect(client.adjustingEntries.length).toBeGreaterThan(0)
      for (const e of client.adjustingEntries) {
        const je = jes.find((j) => j.txnId === e.id)
        expect(je, e.id).toBeDefined()
        expect(je?.memo).toBe(`AJE ${e.type}: ${e.reason} | source: ${e.sources.join('; ')}`)
        expect(je?.date).toBe(e.date)
        expect(je?.lines.map((l) => [numberOf.get(l.accountId) ?? l.accountId, l.debitCents, l.creditCents])).toEqual(e.lines.map((l) => [l.account, l.debitCents, l.creditCents]))
      }
      expect(jes.filter((j) => j.memo.startsWith('AJE '))).toHaveLength(client.adjustingEntries.length)
    }, 30_000)

    test(`TB-1 SEC-11 ${id}: the exported company is the client's made-up corporation, a test company in Canadian dollars`, async () => {
      const { realm, reader, client } = await exported(id)
      const c = await reader.company(realm)
      expect(c.realm).toBe(realm)
      expect(c.legalName).toBe(client.corporation.name)
      expect(c.legalName).toContain('(Test)')
      expect(c.fiscalYearStartMonth).toBe(Number(client.corporation.yearStart.slice(5, 7)))
      expect([c.country, c.homeCurrency, c.isTestCompany]).toEqual(['CA', 'CAD', true])
    }, 30_000)

    test(`TB-1 ${id}: the sample files are read in place and never changed by an export`, async () => {
      const before = hashTree(folderOf(id))
      await exported(id)
      expect(hashTree(folderOf(id))).toEqual(before)
    }, 30_000)
  }

  test('TB-1 C01: chequing and the business card roll from the opening to the adjusted balance by their qbo/*.csv lines', async () => {
    const { folder, client } = await exported('C01')
    const idOf = accountIds(folder)
    const bal = (rows: readonly { account: string; debitCents: number; creditCents: number }[], n: string): number =>
      rows.filter((r) => r.account === n).reduce((s, r) => s + r.debitCents - r.creditCents, 0)
    for (const key of ['CHQ', 'BCD']) {
      const a = client.accounts.find((x) => x.key === key)
      expect(a, key).toBeDefined()
      if (a === undefined) continue
      const moved = transactionsFile(folder, idOf.get(a.glAccount) ?? '')
        .filter((r) => r.txnId.startsWith(`01-${key}-`))
        .reduce((s, r) => s + r.amountCents, 0)
      expect(bal(client.trialBalance.opening.rows, a.glAccount) + moved, key).toBe(bal(client.trialBalance.adjusted.rows, a.glAccount))
    }
  }, 30_000)
})
