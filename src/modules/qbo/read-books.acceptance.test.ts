// B04 acceptance tests: readBooks, snapshots and pointers on the samples engine (TB-1, TB-10, EV-5), checks 1 to 3.
// Spec-writer's file; builders never edit it. The contract is written out at the top of src/contracts/qbo.acceptance.test.ts.
//
// Module API these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/modules/qbo/index.ts
//     createQboReader(options: { env?: Record<string, string | undefined>  // default process.env
//                                sink?: (line: string) => void             // log sink, as makeLogger takes
//                                transport?: (req: { method: string; url: string; headers: Record<string, string> })
//                                  => Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>
//                                clock?: Clock; sleep?: (ms: number) => Promise<void> }): QboReader
//       Settings, read by name: QBO_ENGINE ('samples' default | 'sandbox' | 'live'), QBO_STANDIN_DIR (the samples folder),
//       QBO_SANDBOX_CLIENT_ID, QBO_SANDBOX_CLIENT_SECRET, QBO_SANDBOX_REFRESH_TOKEN. A refusal may come from the factory
//       or from the first call: tests accept either.
//     readBooks(returnId: string, realm: string, yearStart: string, yearEnd: string,
//               deps: { reader: QboReader; files: FileStore; store: QboSnapshotStore; clock: Clock })
//       => Promise<{ snapshots: QboSnapshot[]          // in read order: company; trial balance at yearEnd; trial
//                                                      // balance at the day before yearStart; transactions, one per
//                                                      // account in either trial balance; journal entries; one per
//                                                      // distinct attachment id the transactions and entries name
//                    company: QboCompany; trialBalance: QboTrialBalanceRow[]; openingTrialBalance: QboTrialBalanceRow[]
//                    transactions: QboTransaction[]    // every account's rows in the year, as read
//                    journalEntries: QboJournalEntry[] }>
//     pointerFor(snapshot: QboSnapshot, row: QboTrialBalanceRow | QboTransaction): QboPointer
//     pointerFor(snapshot: QboSnapshot, entry: QboJournalEntry, lineNo: number): QboPointer   // throws on a bad pointer
//     createMemorySnapshotStore(): QboSnapshotStore    // list(): Promise<QboSnapshot[]>, in write order, copies
//     createDbSnapshotStore(db: PGlite): QboSnapshotStore   (read-books.acceptance.db.test.ts)
//   Stand-in folder (QBO_STANDIN_DIR/<realm>/): company.json (QboCompany), accounts.json, trial-balance-<date>.json
//   (QboTrialBalanceRow[]), transactions/<account id>.json (QboTransaction[]), journal-entries.json (QboJournalEntry[]),
//   attachments/index.json ([{ attachmentId, name, mimeType, file }]) with the files beside it. Rows are strict: a key the
//   shape does not know is refused, naming the key. See __fixtures__/standin.
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock, type Clock } from '../../core/clock'
import type { FileStore } from '../../contracts/storage'
import { QboPointerSchema, QboSnapshotSchema, type QboSnapshot, type QboTrialBalanceRow } from '../../contracts/qbo'
import { createFileStore } from '../storage'
import { exportQboStandIn } from '../../../testworld/qbo/export'
import { createMemorySnapshotStore, createQboReader, pointerFor, readBooks } from './index'
import {
  ACCOUNT_IDS,
  ATTACHMENT_IDS,
  OPENING_AS_OF,
  REALM,
  RETURN_ID,
  STANDIN_DIR,
  YEAR_END,
  YEAR_START,
  allFiles,
  copyStandIn,
  failure,
  readJson,
  samplesEnv,
  sha256,
  tempDir,
  writeJson,
} from './__fixtures__/harness'

const AT = '2026-10-01T12:00:00-04:00'
const LATER = '2026-10-02T09:30:00-04:00'

let tmp: { dir: string; cleanup: () => void }
let files: FileStore
let storeRoot: string

beforeEach(() => {
  tmp = tempDir('read-books')
  storeRoot = path.join(tmp.dir, 'store')
  fs.mkdirSync(storeRoot)
  files = createFileStore({ root: storeRoot })
})

afterEach(() => {
  tmp.cleanup()
})

function deps(dir: string = STANDIN_DIR, clock: Clock = fixedClock(AT), store = createMemorySnapshotStore()) {
  return { reader: createQboReader({ env: samplesEnv(dir) }), files, store, clock }
}

const sum = (rows: readonly QboTrialBalanceRow[], k: 'debitCents' | 'creditCents'): number => rows.reduce((s, r) => s + r[k], 0)
const ofKind = (snaps: readonly QboSnapshot[], kind: QboSnapshot['kind']): QboSnapshot[] => snaps.filter((s) => s.kind === kind)
function one<T>(xs: readonly T[], what: string): T {
  expect(xs, what).toHaveLength(1)
  return xs[0] as T
}

describe('B04 the year-end trial balance, accrual only (TB-1, check 1)', () => {
  test('TB-1 readBooks on the fixture company stores the year-end accrual trial balance exactly as the stand-in holds it, debits equal to credits in cents', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    const expected = readJson(path.join(STANDIN_DIR, REALM, `trial-balance-${YEAR_END}.json`)) as QboTrialBalanceRow[]
    expect(r.trialBalance).toEqual(expected)
    expect(sum(r.trialBalance, 'debitCents')).toBe(154500)
    expect(sum(r.trialBalance, 'creditCents')).toBe(154500)
    expect(r.openingTrialBalance).toEqual(readJson(path.join(STANDIN_DIR, REALM, `trial-balance-${OPENING_AS_OF}.json`)))
    const tb = ofKind(r.snapshots, 'trial_balance')
    expect(tb.map((s) => [s.asOf, s.basis])).toEqual([
      [YEAR_END, 'accrual'],
      [OPENING_AS_OF, 'accrual'],
    ])
  })

  test('TB-1 planted: asking the samples engine for a cash-basis trial balance is refused with the reason', async () => {
    const reader = createQboReader({ env: samplesEnv(STANDIN_DIR) })
    const e = await failure(() => reader.trialBalance(REALM, YEAR_END, 'cash' as string as 'accrual'))
    expect(e?.message).toMatch(/accrual/i)
    expect(e?.message).toMatch(/cash/i)
    expect(await reader.trialBalance(REALM, YEAR_END, 'accrual')).toHaveLength(5)
  })

  test('TB-1 planted: a stand-in trial balance row with a key the shape does not know is refused naming the key, never dropped', async () => {
    const dir = copyStandIn(path.join(tmp.dir, 'standin'))
    const file = path.join(dir, REALM, `trial-balance-${YEAR_END}.json`)
    const rows = readJson(file) as Record<string, unknown>[]
    rows[1] = { ...rows[1], mysteryCents: 7 }
    writeJson(file, rows)
    const reader = createQboReader({ env: samplesEnv(dir) })
    expect((await failure(() => reader.trialBalance(REALM, YEAR_END, 'accrual')))?.message).toContain('mysteryCents')
  })

  test('TB-1 ARC-13 property: any balanced trial balance in cents comes back from the samples engine to the cent, debits equal to credits', async () => {
    const dir = copyStandIn(path.join(tmp.dir, 'standin'))
    const file = path.join(dir, REALM, `trial-balance-${YEAR_END}.json`)
    const base = readJson(file) as QboTrialBalanceRow[]
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 9_007_199_254_740 }), { minLength: 1, maxLength: 4 }), async (debits) => {
        const total = debits.reduce((s, d) => s + d, 0)
        const rows = [
          ...debits.map((d, i) => ({ ...(base[0] as QboTrialBalanceRow), accountId: `9${String(i)}`, accountNumber: `19${String(i)}0`, debitCents: d, creditCents: 0 })),
          { ...(base[1] as QboTrialBalanceRow), debitCents: 0, creditCents: total },
        ]
        writeJson(file, rows)
        const got = await createQboReader({ env: samplesEnv(dir) }).trialBalance(REALM, YEAR_END, 'accrual')
        expect(got).toEqual(rows)
        expect(sum(got, 'debitCents')).toBe(sum(got, 'creditCents'))
        for (const r of got) expect(Number.isSafeInteger(r.debitCents) && Number.isSafeInteger(r.creditCents)).toBe(true)
      }),
      { seed: 4010, numRuns: 25 },
    )
  })
})

describe('B04 every read is a dated, fingerprinted snapshot (TB-10, check 2)', () => {
  test('TB-10 readBooks makes one snapshot per read, in order: company, two trial balances, transactions per account, journal entries, attachments', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    const kinds = r.snapshots.map((s) => s.kind)
    expect(kinds).toEqual(['company', 'trial_balance', 'trial_balance', ...ACCOUNT_IDS.map(() => 'transactions'), 'journal_entries', ...ATTACHMENT_IDS.map(() => 'attachment')])
    expect(ofKind(r.snapshots, 'transactions').map((s) => s.accountId).sort()).toEqual([...ACCOUNT_IDS].sort())
    expect(ofKind(r.snapshots, 'attachment').map((s) => s.attachmentId).sort()).toEqual([...ATTACHMENT_IDS].sort())
    for (const s of [...ofKind(r.snapshots, 'transactions'), ...ofKind(r.snapshots, 'journal_entries')]) {
      expect([s.periodFrom, s.periodTo, s.asOf]).toEqual([YEAR_START, YEAR_END, null])
    }
    expect(r.company.legalName).toBe('Birchwood Fixture Ltd. (Test)')
  })

  test('TB-10 each snapshot carries every field of the contract shape, read-at from the injected clock, engine and version, and its own id', async () => {
    const reader = createQboReader({ env: samplesEnv(STANDIN_DIR) })
    const store = createMemorySnapshotStore()
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, { reader, files, store, clock: fixedClock(AT) })
    expect(r.snapshots.length).toBeGreaterThan(0)
    for (const s of r.snapshots) {
      expect(QboSnapshotSchema.safeParse(s).success, s.kind).toBe(true)
      for (const k of Object.keys(QboSnapshotSchema.shape)) expect((s as Record<string, unknown>)[k], `${s.kind} ${k}`).not.toBeUndefined()
      expect(s.readAt).toBe(new Date(AT).toISOString())
      expect(s.engine).toBe('samples')
      expect(reader.engine).toBe('samples')
      expect(s.engineVersion).toBe(reader.version)
      expect([s.returnId, s.realm]).toEqual([RETURN_ID, REALM])
    }
    expect(new Set(r.snapshots.map((s) => s.id)).size).toBe(r.snapshots.length)
    expect(await store.list()).toEqual(r.snapshots)
  })

  test('TB-10 the stored bytes of every snapshot hash to its sha256, and attachments are copied byte for byte at read time', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    for (const s of r.snapshots) {
      const bytes = await files.get(s.fileKey)
      expect(sha256(bytes), `${s.kind} ${s.accountId ?? s.attachmentId ?? s.asOf ?? ''}`).toBe(s.sha256)
    }
    const index = readJson(path.join(STANDIN_DIR, REALM, 'attachments', 'index.json')) as { attachmentId: string; file: string }[]
    for (const s of ofKind(r.snapshots, 'attachment')) {
      const entry = index.find((a) => a.attachmentId === s.attachmentId)
      const original = new Uint8Array(fs.readFileSync(path.join(STANDIN_DIR, REALM, 'attachments', entry?.file ?? 'missing')))
      expect(Buffer.from(await files.get(s.fileKey)).equals(Buffer.from(original))).toBe(true)
      expect(s.sha256).toBe(sha256(original))
    }
  })

  test('TB-10 reading again writes new dated snapshot rows that share the stored files', async () => {
    const store = createMemorySnapshotStore()
    const first = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps(STANDIN_DIR, fixedClock(AT), store))
    const filesAfterFirst = allFiles(storeRoot).length
    const second = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps(STANDIN_DIR, fixedClock(LATER), store))
    expect(await store.list()).toHaveLength(first.snapshots.length * 2)
    expect(second.snapshots.map((s) => s.fileKey)).toEqual(first.snapshots.map((s) => s.fileKey))
    expect(second.snapshots.map((s) => s.sha256)).toEqual(first.snapshots.map((s) => s.sha256))
    for (const s of second.snapshots) expect(s.readAt).toBe(new Date(LATER).toISOString())
    expect(new Set([...first.snapshots, ...second.snapshots].map((s) => s.id)).size).toBe(first.snapshots.length * 2)
    expect(allFiles(storeRoot).length).toBe(filesAfterFirst)
  })

  test('TB-10 planted: a stand-in transaction changed between two reads gives the new snapshot a new fingerprint, and the first snapshot still holds the old bytes', async () => {
    const dir = copyStandIn(path.join(tmp.dir, 'standin'))
    const store = createMemorySnapshotStore()
    const first = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps(dir, fixedClock(AT), store))
    const oldSnap = one(ofKind(first.snapshots, 'transactions').filter((s) => s.accountId === '35'), 'chequing snapshot')
    const oldBytes = await files.get(oldSnap.fileKey)
    const file = path.join(dir, REALM, 'transactions', '35.json')
    const rows = readJson(file) as { txnId: string; amountCents: number }[]
    writeJson(file, rows.map((t) => (t.txnId === '130' ? { ...t, amountCents: t.amountCents + 1 } : t)))
    const second = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps(dir, fixedClock(LATER), store))
    const newSnap = one(ofKind(second.snapshots, 'transactions').filter((s) => s.accountId === '35'), 'chequing snapshot')
    expect(newSnap.sha256).not.toBe(oldSnap.sha256)
    expect(newSnap.fileKey).not.toBe(oldSnap.fileKey)
    expect(Buffer.from(await files.get(oldSnap.fileKey)).equals(Buffer.from(oldBytes))).toBe(true)
    expect(second.transactions.find((t) => t.txnId === '130' && t.accountId === '35')?.amountCents).toBe(50001)
  })

  test('TB-10 readBooks reads the year only: the 2024 opening deposit is left out, the 2025 rows and the journal entry are in', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    expect(r.transactions.some((t) => t.txnId === '120')).toBe(false)
    expect(r.transactions.filter((t) => t.accountId === '35').map((t) => t.txnId)).toEqual(['130', '131'])
    expect(r.transactions.filter((t) => t.accountId === '55').map((t) => t.txnId)).toEqual(['131', '182'])
    expect(r.journalEntries.map((e) => e.txnId)).toEqual(['182'])
    for (const t of r.transactions) expect(t.date >= YEAR_START && t.date <= YEAR_END).toBe(true)
  })

  test('TB-1 TB-10 the transactions of the year roll each account from the opening to the year-end trial balance, in cents', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    const bal = (rows: readonly QboTrialBalanceRow[], id: string): number => {
      const row = rows.find((x) => x.accountId === id)
      return row === undefined ? 0 : row.debitCents - row.creditCents
    }
    for (const id of ACCOUNT_IDS) {
      const moved = r.transactions.filter((t) => t.accountId === id).reduce((s, t) => s + t.amountCents, 0)
      expect(bal(r.openingTrialBalance, id) + moved, id).toBe(bal(r.trialBalance, id))
    }
  })
})

describe('B04 QBO source pointers (EV-5, TB-10, check 3)', () => {
  test('EV-5 TB-10 every trial balance pointer names its own snapshot and the account, and no transaction', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    const [end, opening] = ofKind(r.snapshots, 'trial_balance') as [QboSnapshot, QboSnapshot]
    for (const [snap, rows] of [
      [end, r.trialBalance],
      [opening, r.openingTrialBalance],
    ] as const) {
      for (const row of rows) {
        const p = pointerFor(snap, row)
        expect(QboPointerSchema.safeParse(p).success).toBe(true)
        expect(p).toEqual({ kind: 'qbo', snapshotId: snap.id, accountId: row.accountId, idKind: 'account' })
      }
    }
  })

  test('EV-5 TB-10 every transaction pointer names the snapshot of its account, the account and the QBO Transaction ID', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    expect(r.transactions.length).toBeGreaterThan(0)
    for (const t of r.transactions) {
      const snap = one(ofKind(r.snapshots, 'transactions').filter((s) => s.accountId === t.accountId), `snapshot of ${t.accountId}`)
      const p = pointerFor(snap, t)
      expect(QboPointerSchema.safeParse(p).success).toBe(true)
      expect(p).toMatchObject({ kind: 'qbo', snapshotId: snap.id, accountId: t.accountId, txnId: t.txnId, idKind: 'qbo' })
    }
  })

  test('EV-5 TB-10 every journal entry line pointer names the journal entries snapshot, the line account, the entry id and the line', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    const snap = one(ofKind(r.snapshots, 'journal_entries'), 'journal entries snapshot')
    for (const e of r.journalEntries) {
      for (const l of e.lines) {
        const p = pointerFor(snap, e, l.lineNo)
        expect(QboPointerSchema.safeParse(p).success).toBe(true)
        expect(p).toEqual({ kind: 'qbo', snapshotId: snap.id, accountId: l.accountId, txnId: e.txnId, lineNo: l.lineNo, idKind: 'qbo' })
      }
    }
  })

  test('EV-5 planted: pointerFor refuses a snapshot with a blank id, a row with a blank account and a line that does not exist', async () => {
    const r = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, deps())
    const snap = one(ofKind(r.snapshots, 'trial_balance').filter((s) => s.asOf === YEAR_END), 'year-end snapshot')
    const row = r.trialBalance[0] as QboTrialBalanceRow
    expect(await failure(() => pointerFor({ ...snap, id: ' ' }, row))).toBeInstanceOf(Error)
    expect(await failure(() => pointerFor(snap, { ...row, accountId: '' }))).toBeInstanceOf(Error)
    const jeSnap = one(ofKind(r.snapshots, 'journal_entries'), 'journal entries snapshot')
    const entry = r.journalEntries[0]
    expect(entry).toBeDefined()
    if (entry !== undefined) expect(await failure(() => pointerFor(jeSnap, entry, 99))).toBeInstanceOf(Error)
  })
})

describe('B04 sample client C01 through the samples engine (TB-1, golden)', () => {
  test('TB-1 readBooks for C01 stores the year-end accrual trial balance and journal entries of the golden files; debits equal credits', async () => {
    const dir = path.join(tmp.dir, 'c01')
    fs.mkdirSync(dir)
    const { realm } = await exportQboStandIn('C01', dir)
    const r = await readBooks('ret-b04-c01-test', realm, '2025-01-01', '2025-12-31', deps(dir))
    const tb = r.trialBalance.map((x) => ({ accountId: x.accountId, accountNumber: x.accountNumber, accountName: x.accountName, debitCents: x.debitCents, creditCents: x.creditCents }))
    await expect(JSON.stringify(tb, null, 2) + '\n').toMatchFileSnapshot('__golden__/c01-trial-balance.json')
    const je = r.journalEntries.map((e) => ({ txnId: e.txnId, date: e.date, memo: e.memo, lines: e.lines.map((l) => ({ accountId: l.accountId, debitCents: l.debitCents, creditCents: l.creditCents })) }))
    await expect(JSON.stringify(je, null, 2) + '\n').toMatchFileSnapshot('__golden__/c01-journal-entries.json')
    expect(sum(r.trialBalance, 'debitCents')).toBe(sum(r.trialBalance, 'creditCents'))
    expect(ofKind(r.snapshots, 'trial_balance').map((s) => s.basis)).toEqual(['accrual', 'accrual'])
    const accounts = new Set([...r.trialBalance, ...r.openingTrialBalance].map((x) => x.accountId))
    expect(ofKind(r.snapshots, 'transactions')).toHaveLength(accounts.size)
    for (const e of r.journalEntries) {
      expect(e.lines.reduce((s, l) => s + l.debitCents - l.creditCents, 0), e.txnId).toBe(0)
    }
  }, 30_000)
})

// Card note A446 (SC12 R93, R94): the stand-in folder is written by another process, so an id never reaches a path
// without a grammar check and every file is read as a regular file. These are behaviour checks on the samples engine;
// the source rules themselves are SC12's.
describe('B04 the stand-in folder is written by another process (SEC-10, SEC-11, card note A446)', () => {
  test('SEC-10 R93 planted: an account id that climbs out of transactions/ is refused, though the path it names exists', async () => {
    const reader = createQboReader({ env: samplesEnv(STANDIN_DIR) })
    expect(await reader.transactions(REALM, '35', YEAR_START, YEAR_END)).not.toEqual([])
    for (const bad of ['../transactions/35', 'x/../35', '35/', '..', '']) {
      const e = await failure(() => reader.transactions(REALM, bad, YEAR_START, YEAR_END))
      expect(e, JSON.stringify(bad)).toBeInstanceOf(Error)
    }
  })

  test('SEC-10 SEC-11 R93 planted: a realm that climbs from the non-test company into the test company is refused', async () => {
    const reader = createQboReader({ env: samplesEnv(STANDIN_DIR) })
    for (const bad of ['9130000000000002/../9130000000000001', `../${path.basename(STANDIN_DIR)}/${REALM}`, `${REALM}/`, '.']) {
      const e = await failure(() => reader.trialBalance(bad, YEAR_END, 'accrual'))
      expect(e, bad).toBeInstanceOf(Error)
    }
  })

  test('SEC-10 R93 planted: an attachment index entry whose file climbs out of attachments/ is refused, never read', async () => {
    const dir = copyStandIn(path.join(tmp.dir, 'standin'))
    const index = path.join(dir, REALM, 'attachments', 'index.json')
    const entries = readJson(index) as { attachmentId: string; file: string }[]
    writeJson(index, entries.map((a) => (a.attachmentId === '901' ? { ...a, file: '../company.json' } : a)))
    const reader = createQboReader({ env: samplesEnv(dir) })
    expect(await failure(() => reader.attachment(REALM, '901'))).toBeInstanceOf(Error)
    expect((await reader.attachment(REALM, '902')).bytes.length).toBeGreaterThan(0)
  })

  test('SEC-10 R94 planted: a stand-in file that is a link, not a regular file, is refused', async () => {
    const dir = copyStandIn(path.join(tmp.dir, 'standin'))
    const target = path.join(tmp.dir, 'elsewhere-35.json')
    const file = path.join(dir, REALM, 'transactions', '35.json')
    fs.copyFileSync(file, target)
    fs.rmSync(file)
    fs.symlinkSync(target, file)
    const reader = createQboReader({ env: samplesEnv(dir) })
    expect(await failure(() => reader.transactions(REALM, '35', YEAR_START, YEAR_END))).toBeInstanceOf(Error)
    expect(await reader.transactions(REALM, '55', YEAR_START, YEAR_END)).not.toEqual([])
  })
})
