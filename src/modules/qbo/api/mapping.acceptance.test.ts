// B04 acceptance tests: the one mapping file from Intuit's report JSON to Returns' shapes (TB-10, TB-13), check 4.
// Spec-writer's file; builders never edit it. Tested only against the fake responses in __fixtures__/unconfirmed,
// each marked "confirmed": false (the API was not reached; reference/research/2026-10-01-qbo-reconciled.md).
//
// API these tests fix (spec choices, amber):
//   src/modules/qbo/api/mapping.ts
//     mapGeneralLedger(generalLedger: unknown, transactionList: unknown): QboTransaction[]
//       One row per GL line, in report order (sections in order, lines in order). accountId is the section header's id;
//       amountCents the line amount in cents (debit-positive, as the fixture note says); entityType the txn_type cell;
//       number the doc_num cell; date the tx_date cell; memo the transaction's memo from the TransactionList (the GL's
//       memo cell is the line description); otherAccountIds the split_acc cell's id; attachmentIds [] (attachments come
//       from Attachable, not the GL).
//       Transaction ID: from the GL's txn_id column when it has one; otherwise from the one TransactionList row with the
//       same txn_type and a non-blank, equal doc_num (idKind 'qbo'). No such row, a blank number, or two rows that
//       match: the composite key `${date}|${type}|${number}|${accountId}|${amountCents}` (idKind 'composite').
//     A column is known by its MetaData ColKey. A report with a column the mapping does not know, or a TransactionList
//     without its txn_id (Transaction ID) or memo (Memo) column, is refused naming the column (key or title).
//   The sandbox engine reads every report through this file, so a trial balance with an unknown column, or on another
//   basis than Accrual, is refused by reader.trialBalance too.
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import type { QboSnapshot, QboTransaction } from '../../../contracts/qbo'
import { createQboReader, pointerFor } from '../index'
import { REALM, STANDIN_DIR, YEAR_END, YEAR_START, failure, manualClock, readJson, sandboxEnv, sha256 } from '../__fixtures__/harness'
import { UNCONFIRMED, createFakeQboApi, readUnconfirmed, type RouteName } from './__fixtures__/fake-api'
import { mapGeneralLedger } from './mapping'

type Cell = { value: string; id?: string }
type Col = { ColTitle: string; ColType: string; MetaData: { Name: string; Value: string }[] }
type DataRow = { type?: string; ColData: Cell[] }
type Section = { type: string; Header: { ColData: Cell[] }; Rows: { Row: DataRow[] }; Summary?: unknown }
type GL = { Columns: { Column: Col[] }; Rows: { Row: Section[] } }
type TL = { Columns: { Column: Col[] }; Rows: { Row: DataRow[] } }
type TB = { Header: Record<string, unknown>; Columns: { Column: Col[] }; Rows: { Row: { ColData?: Cell[] }[] } }

const gl = (): GL => structuredClone(readUnconfirmed('general-ledger.json')) as GL
const glWithId = (): GL => structuredClone(readUnconfirmed('general-ledger-with-id.json')) as GL
const tl = (): TL => structuredClone(readUnconfirmed('transaction-list.json')) as TL
const at = (cols: Col[], key: string): number => cols.findIndex((c) => c.MetaData.some((m) => m.Value === key))
const glLines = (r: GL): { section: Section; row: DataRow }[] => r.Rows.Row.flatMap((section) => section.Rows.Row.map((row) => ({ section, row })))
const cell = (r: GL, row: DataRow, key: string): Cell => row.ColData[at(r.Columns.Column, key)] as Cell

/** Sets a GL cell on every line of transaction `num` (all sections). */
function setGl(r: GL, num: string, key: string, value: string): void {
  for (const { row } of glLines(r)) if (cell(r, row, 'doc_num').value === num) cell(r, row, key).value = value
}
function setTl(r: TL, num: string, key: string, value: string): void {
  for (const row of r.Rows.Row) if (row.ColData[at(r.Columns.Column, 'doc_num')]?.value === num) (row.ColData[at(r.Columns.Column, key)] as Cell).value = value
}
function dropColumn<R extends { Columns: { Column: Col[] } }>(r: R, key: string, rows: DataRow[]): R {
  const i = at(r.Columns.Column, key)
  expect(i, key).toBeGreaterThanOrEqual(0)
  r.Columns.Column.splice(i, 1)
  for (const row of rows) row.ColData.splice(i, 1)
  return r
}

/** The stand-in's normalised rows for every account, in the GL's section order: what the GL maps to. */
function standInRows(): QboTransaction[] {
  return ['35', '33', '80', '79', '55'].flatMap((id) => readJson(path.join(STANDIN_DIR, REALM, 'transactions', `${id}.json`)) as QboTransaction[])
}
const keyFields = (t: QboTransaction) => ({ txnId: t.txnId, idKind: t.idKind, entityType: t.entityType, date: t.date, number: t.number, accountId: t.accountId, amountCents: t.amountCents, memo: t.memo, otherAccountIds: t.otherAccountIds })

const SNAP: QboSnapshot = {
  id: 'snap-b04-gl-0001', returnId: 'ret-b04-test-0001', realm: REALM, kind: 'transactions', asOf: null, periodFrom: YEAR_START, periodTo: YEAR_END,
  // A507 item 9: a real-length fingerprint (64 lower-case hex), built at run time so no file here holds a long hex literal.
  basis: null, accountId: '35', attachmentId: null, engine: 'sandbox', engineVersion: 'fake', readAt: '2026-10-01T16:00:00.000Z', sha256: sha256(new TextEncoder().encode('b04 general ledger fixture (Test)')), fileKey: 'sha256/ff/fixture',
}

/** Drops a GL column from the column list and every line; a section header keeps its first cell (the account). */
function dropGlColumn(r: GL, key: string): GL {
  const i = at(r.Columns.Column, key)
  expect(i, key).toBeGreaterThanOrEqual(0)
  r.Columns.Column.splice(i, 1)
  for (const s of r.Rows.Row) {
    s.Header.ColData.pop()
    for (const row of s.Rows.Row) row.ColData.splice(i, 1)
  }
  return r
}

describe('B04 the fake responses are marked unconfirmed (TB-13)', () => {
  test('TB-13 every fixture under api/__fixtures__/unconfirmed says "confirmed": false and carries a note', () => {
    const names = fs.readdirSync(UNCONFIRMED).filter((f) => f.endsWith('.json'))
    for (const want of ['trial-balance-2025-12-31.json', 'general-ledger.json', 'general-ledger-with-id.json', 'transaction-list.json', 'journal-entries.json', 'attachables.json', 'rate-limited-429.json']) {
      expect(names).toContain(want)
    }
    for (const n of names) {
      const v = readUnconfirmed(n) as { confirmed?: unknown; note?: unknown }
      expect(v.confirmed, n).toBe(false)
      expect(typeof v.note === 'string' && v.note.length > 20, n).toBe(true)
    }
  })
})

describe('B04 a General Ledger line gets its Transaction ID from the Transaction List (TB-13, TB-10, check 4)', () => {
  test('TB-13 a GeneralLedger with no id column gets each line its Transaction ID by type and number from the TransactionList', () => {
    const got = mapGeneralLedger(gl(), tl())
    expect(got.map(keyFields)).toEqual(standInRows().map(keyFields))
    expect(got.every((t) => t.idKind === 'qbo')).toBe(true)
  })

  test('TB-13 the memo comes from the TransactionList in full; the GL line description is not the memo', () => {
    const got = mapGeneralLedger(gl(), tl())
    const je = got.filter((t) => t.txnId === '182')
    expect(je).toHaveLength(2)
    for (const t of je) expect(t.memo).toBe('AJE accrual: hydro owed at year end (Test) | source: hydro bill (Test)')
  })

  test('TB-13 a GeneralLedger with a Transaction ID column takes the id from it, even when the TransactionList has no rows', () => {
    const list = tl()
    list.Rows.Row = []
    const got = mapGeneralLedger(glWithId(), list)
    expect(got.map((t) => [t.accountId, t.txnId, t.idKind])).toEqual(standInRows().map((t) => [t.accountId, t.txnId, 'qbo']))
  })

  test('TB-13 planted: a line whose type and number are not in the TransactionList gets a composite key marked composite, and so does its pointer', () => {
    const r = gl()
    setGl(r, '2020', 'doc_num', '9999')
    const got = mapGeneralLedger(r, tl())
    const bank = got.find((t) => t.accountId === '35' && t.number === '9999')
    expect(bank).toMatchObject({ idKind: 'composite', txnId: '2025-04-10|Cheque|9999|35|-12000' })
    const util = got.find((t) => t.accountId === '55' && t.number === '9999')
    expect(util).toMatchObject({ idKind: 'composite', txnId: '2025-04-10|Cheque|9999|55|12000' })
    expect(got.filter((t) => t.number !== '9999').every((t) => t.idKind === 'qbo')).toBe(true)
    if (bank !== undefined) expect(pointerFor(SNAP, bank)).toEqual({ kind: 'qbo', snapshotId: SNAP.id, accountId: '35', txnId: '2025-04-10|Cheque|9999|35|-12000', idKind: 'composite' })
  })

  test('TB-13 planted: a blank number never joins, even to a TransactionList row with the same type and a blank number', () => {
    const r = gl()
    const list = tl()
    setGl(r, 'D-1', 'doc_num', '')
    setTl(list, 'D-1', 'doc_num', '')
    const got = mapGeneralLedger(r, list)
    expect(got.find((t) => t.accountId === '35' && t.date === '2025-03-14')).toMatchObject({ idKind: 'composite', txnId: '2025-03-14|Deposit||35|50000' })
  })

  test('TB-13 planted: the same number on another type does not join', () => {
    const list = tl()
    setTl(list, '2020', 'txn_type', 'Expense')
    const got = mapGeneralLedger(gl(), list)
    for (const t of got.filter((x) => x.number === '2020')) expect(t.idKind, t.accountId).toBe('composite')
  })

  test('TB-13 planted (amber): two TransactionList rows with the same type and number make the line composite, never a guess', () => {
    const list = tl()
    const twin = structuredClone(list.Rows.Row.find((row) => row.ColData[at(list.Columns.Column, 'doc_num')]?.value === '2020')) as DataRow
    ;(twin.ColData[at(list.Columns.Column, 'txn_id')] as Cell).value = '999'
    list.Rows.Row.push(twin)
    const got = mapGeneralLedger(gl(), list)
    for (const t of got.filter((x) => x.number === '2020')) expect(t.idKind, t.accountId).toBe('composite')
    expect(got.some((t) => t.txnId === '999')).toBe(false)
  })

  test('TB-13 planted: a GeneralLedger with a column the mapping does not know is refused naming the column, never dropped', async () => {
    const r = gl()
    r.Columns.Column.push({ ColTitle: 'Mystery (Test)', ColType: 'String', MetaData: [{ Name: 'ColKey', Value: 'mystery_test' }] })
    for (const s of r.Rows.Row) {
      s.Header.ColData.push({ value: '' })
      for (const row of s.Rows.Row) row.ColData.push({ value: 'x' })
    }
    expect((await failure(() => mapGeneralLedger(r, tl())))?.message).toMatch(/mystery_test|Mystery \(Test\)/)
  })

  test('TB-13 planted: a TransactionList without its Transaction ID column is refused naming it', async () => {
    const list = tl()
    dropColumn(list, 'txn_id', list.Rows.Row)
    expect((await failure(() => mapGeneralLedger(gl(), list)))?.message).toMatch(/txn_id|Transaction ID/)
  })

  test('TB-13 planted: a TransactionList without its Memo column is refused naming it', async () => {
    const list = tl()
    dropColumn(list, 'memo', list.Rows.Row)
    expect((await failure(() => mapGeneralLedger(gl(), list)))?.message).toMatch(/\bmemo\b|\bMemo\b/)
  })

  test('TB-13 planted: a TransactionList with a column the mapping does not know is refused naming it', async () => {
    const list = tl()
    list.Columns.Column.push({ ColTitle: 'Mystery (Test)', ColType: 'String', MetaData: [{ Name: 'ColKey', Value: 'mystery_test' }] })
    for (const row of list.Rows.Row) row.ColData.push({ value: 'x' })
    expect((await failure(() => mapGeneralLedger(gl(), list)))?.message).toMatch(/mystery_test|Mystery \(Test\)/)
  })

  // A507 item 2 (TB-13 by class): every column the mapping needs, missing from any report, is refused naming it.
  const nameOf = (cols: Col[], key: string): RegExp => {
    const title = cols[at(cols, key)]?.ColTitle ?? ''
    const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(title.trim() === '' ? `\\b${esc(key)}\\b` : `\\b${esc(key)}\\b|\\b${esc(title)}\\b`)
  }
  const GL_NEEDS = ['tx_date', 'txn_type', 'doc_num', 'split_acc', 'subt_nat_amount'] as const
  for (const key of GL_NEEDS) {
    test(`TB-13 planted: a GeneralLedger without its ${key} column is refused naming it, never read around`, async () => {
      const r = gl()
      const want = nameOf(r.Columns.Column, key)
      dropGlColumn(r, key)
      const e = await failure(() => mapGeneralLedger(r, tl()))
      expect(e, key).toBeInstanceOf(Error)
      expect(e?.message).toMatch(want)
    })
  }

  for (const key of ['txn_type', 'doc_num'] as const) {
    test(`TB-13 planted: a TransactionList without its ${key} column (the join needs it) is refused naming it, never turned composite`, async () => {
      const list = tl()
      const want = nameOf(list.Columns.Column, key)
      dropColumn(list, key, list.Rows.Row)
      const e = await failure(() => mapGeneralLedger(gl(), list))
      expect(e, key).toBeInstanceOf(Error)
      expect(e?.message).toMatch(want)
    })
  }

  test('TB-13 the needed-column plants start from a clean report: the unchanged GeneralLedger and TransactionList map with no refusal', () => {
    expect(mapGeneralLedger(gl(), tl()).length).toBe(standInRows().length)
  })

  // A507 item 6: two identical transactions with a blank number on one account are both kept (a key on the visible
  // fields would drop one); they come back in report order, both composite.
  test('TB-10 TB-13 planted: two identical General Ledger lines with a blank number on one account are both kept', () => {
    const r = gl()
    const list = tl()
    for (const s of r.Rows.Row) {
      const i = s.Rows.Row.findIndex((row) => cell(r, row, 'doc_num').value === 'D-1')
      if (i >= 0) s.Rows.Row.splice(i + 1, 0, structuredClone(s.Rows.Row[i] as DataRow))
    }
    setGl(r, 'D-1', 'doc_num', '')
    setTl(list, 'D-1', 'doc_num', '')
    const got = mapGeneralLedger(r, list)
    expect(got).toHaveLength(standInRows().length + 2)
    const twins = got.filter((t) => t.accountId === '35' && t.date === '2025-03-14')
    expect(twins).toHaveLength(2)
    expect(twins[0]).toEqual(twins[1])
    expect(twins[0]).toMatchObject({ idKind: 'composite', txnId: '2025-03-14|Deposit||35|50000', number: '' })
    expect(got.filter((t) => t.accountId === '79' && t.date === '2025-03-14')).toHaveLength(2)
  })

  test('TB-10 ARC-13 property: any amount in cents written as Intuit writes it maps back to the same cents', () => {
    fc.assert(
      fc.property(fc.integer({ min: -99_999_999_999, max: 99_999_999_999 }), (c) => {
        const abs = Math.abs(c)
        const text = `${c < 0 ? '-' : ''}${String(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`
        const r = gl()
        setGl(r, 'D-1', 'subt_nat_amount', text)
        const got = mapGeneralLedger(r, tl()).filter((t) => t.number === 'D-1')
        expect(got.length).toBe(2)
        for (const t of got) {
          expect(t.amountCents).toBe(c)
          expect(Number.isSafeInteger(t.amountCents)).toBe(true)
        }
      }),
      { seed: 4013, numRuns: 200 },
    )
  })
})

describe('B04 the sandbox engine reads every report through the mapping (TB-1, TB-13)', () => {
  function sandboxWith(overrides: Partial<Record<RouteName, unknown>>) {
    const mc = manualClock('2026-10-01T12:00:00-04:00')
    const fake = createFakeQboApi({ now: mc.now, overrides })
    return createQboReader({ env: sandboxEnv(), transport: fake.transport, clock: mc.clock, sleep: mc.sleep })
  }

  test('TB-13 planted: a TrialBalance response with a column the mapping does not know is refused naming the column', async () => {
    const tb = structuredClone(readUnconfirmed('trial-balance-2025-12-31.json')) as TB
    tb.Columns.Column.push({ ColTitle: 'Mystery (Test)', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'mystery_test' }] })
    for (const row of tb.Rows.Row) row.ColData?.push({ value: '1.00' })
    const e = await failure(() => sandboxWith({ 'trial-balance-2025-12-31': tb }).trialBalance(REALM, YEAR_END, 'accrual'))
    expect(e?.message).toMatch(/mystery_test|Mystery \(Test\)/)
  })

  for (const key of ['account_name', 'debt_amt', 'credit_amt'] as const) {
    test(`TB-13 planted: a TrialBalance response without its ${key} column is refused naming it (A507 item 2)`, async () => {
      const tb = structuredClone(readUnconfirmed('trial-balance-2025-12-31.json')) as TB
      const i = at(tb.Columns.Column, key)
      expect(i, key).toBeGreaterThanOrEqual(0)
      const title = tb.Columns.Column[i]?.ColTitle ?? ''
      tb.Columns.Column.splice(i, 1)
      for (const row of tb.Rows.Row) row.ColData?.splice(i, 1)
      const e = await failure(() => sandboxWith({ 'trial-balance-2025-12-31': tb }).trialBalance(REALM, YEAR_END, 'accrual'))
      expect(e, key).toBeInstanceOf(Error)
      expect(e?.message).toMatch(title.trim() === '' ? new RegExp(`\\b${key}\\b`) : new RegExp(`\\b${key}\\b|\\b${title}\\b`))
    })
  }

  test('TB-13 the TrialBalance column plants start from a clean response: the unchanged one reads through the sandbox engine', async () => {
    expect(await sandboxWith({}).trialBalance(REALM, YEAR_END, 'accrual')).toEqual(readJson(path.join(STANDIN_DIR, REALM, `trial-balance-${YEAR_END}.json`)))
  })

  test('TB-1 planted: a TrialBalance response on the cash basis is refused with the reason', async () => {
    const tb = structuredClone(readUnconfirmed('trial-balance-2025-12-31.json')) as TB
    tb.Header['ReportBasis'] = 'Cash'
    const e = await failure(() => sandboxWith({ 'trial-balance-2025-12-31': tb }).trialBalance(REALM, YEAR_END, 'accrual'))
    expect(e?.message).toMatch(/accrual|cash/i)
  })

  test('TB-13 planted: a TransactionList with no Transaction ID column makes the sandbox engine refuse transactions, naming it', async () => {
    const list = tl()
    dropColumn(list, 'txn_id', list.Rows.Row)
    const e = await failure(() => sandboxWith({ 'transaction-list': list }).transactions(REALM, '35', YEAR_START, YEAR_END))
    expect(e?.message).toMatch(/txn_id|Transaction ID/)
  })

  test('TB-10 ARC-13 property: any journal entry amount Intuit sends as a JSON number in dollars comes back as the same cents, debit and credit equal', async () => {
    const base = readUnconfirmed('journal-entries.json') as { QueryResponse: { JournalEntry: { Line: { Amount: number }[] }[] } }
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 99_999_999_999 }), async (c) => {
        const je = structuredClone(base)
        for (const l of je.QueryResponse.JournalEntry[0]?.Line ?? []) l.Amount = c / 100
        const got = await sandboxWith({ 'journal-entries': je }).journalEntries(REALM, YEAR_START, YEAR_END)
        const lines = got[0]?.lines ?? []
        expect(lines.map((l) => [l.debitCents, l.creditCents])).toEqual([
          [c, 0],
          [0, c],
        ])
      }),
      { seed: 4014, numRuns: 40 },
    )
  }, 30_000)

  test('TB-2 TB-10 a journal entry with no Adjustment field reads as "not given"; one with Adjustment false reads as false', async () => {
    const je = structuredClone(readUnconfirmed('journal-entries.json')) as { QueryResponse: { JournalEntry: Record<string, unknown>[] } }
    expect((await sandboxWith({}).journalEntries(REALM, YEAR_START, YEAR_END))[0]?.adjustment).toBe('not given')
    const first = je.QueryResponse.JournalEntry[0]
    if (first !== undefined) first['Adjustment'] = false
    expect((await sandboxWith({ 'journal-entries': je }).journalEntries(REALM, YEAR_START, YEAR_END))[0]?.adjustment).toBe(false)
  })
})
