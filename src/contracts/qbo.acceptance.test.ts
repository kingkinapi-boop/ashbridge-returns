// B04 acceptance tests: the QBO contract (src/contracts/qbo.ts). Card plan/cards/B04.md, checks 3 and 5 (contract side).
// Spec-writer's file; builders never edit it.
//
// The contract these tests fix (spec choices, amber; the builder implements exactly these names):
//   src/contracts/qbo.ts, with a header comment saying the mapping from Intuit's report JSON is unconfirmed, giving the
//   date 2026-10-01 and the file reference/research/2026-10-01-qbo-reconciled.md. Zod 4 objects (so `.shape` exists):
//     QboCompanySchema          { realm, legalName, fiscalYearStartMonth (1 to 12), country, homeCurrency, isTestCompany }
//     QboTrialBalanceRowSchema  { accountId, accountNumber, accountName, accountType, accountSubType, debitCents, creditCents }
//     QboTransactionSchema      { txnId, idKind: 'qbo' | 'composite', entityType, date, number, memo, accountId,
//                                 amountCents (debit-positive effect on accountId), otherAccountIds, attachmentIds }
//     QboJournalEntrySchema     { txnId, date, number, memo, adjustment: boolean | 'not given',
//                                 lines: { lineNo (from 1), accountId, debitCents, creditCents, description }[], attachmentIds }
//     QboPointerSchema          { kind: 'qbo', snapshotId, accountId, txnId?, lineNo?, idKind: 'account' | 'qbo' | 'composite' }
//     QboSnapshotSchema         { id, returnId, realm, kind: 'company' | 'trial_balance' | 'transactions' | 'journal_entries'
//                                 | 'attachment', asOf, periodFrom, periodTo, basis: 'accrual' | null, accountId, attachmentId,
//                                 engine: 'samples' | 'sandbox' | 'live', engineVersion, readAt (ISO text), sha256, fileKey }
//                               (asOf, periodFrom, periodTo, accountId and attachmentId are null where they do not apply)
//   Cents are integers. Ids and names are non-blank text.
//   interface QboReader {       // exactly these keys: read only (OUT-3)
//     readonly engine: 'samples' | 'sandbox' | 'live'; readonly version: string
//     company(realm): Promise<QboCompany>
//     trialBalance(realm, asOf, basis): Promise<QboTrialBalanceRow[]>      // basis other than 'accrual' is refused (TB-1)
//     transactions(realm, accountId, from, to): Promise<QboTransaction[]>
//     journalEntries(realm, from, to): Promise<QboJournalEntry[]>
//     attachment(realm, attachmentId): Promise<{ attachmentId, name, mimeType, bytes: Uint8Array }> }
//   Types QboCompany, QboTrialBalanceRow, QboTransaction, QboJournalEntry, QboPointer, QboSnapshot are z.infer of the schemas.
import fc from 'fast-check'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { readOwnSource } from '../core/testing/read-own-source'
import {
  QboCompanySchema,
  QboJournalEntrySchema,
  QboPointerSchema,
  QboSnapshotSchema,
  QboTransactionSchema,
  QboTrialBalanceRowSchema,
  type QboReader,
} from './qbo'

const SNAPSHOT = {
  id: 'snap-b04-0001',
  returnId: 'ret-b04-test-0001',
  realm: '9130000000000001',
  kind: 'trial_balance',
  asOf: '2025-12-31',
  periodFrom: null,
  periodTo: null,
  basis: 'accrual',
  accountId: null,
  attachmentId: null,
  engine: 'samples',
  engineVersion: 'samples-1',
  readAt: '2026-10-01T16:00:00.000Z',
  sha256: 'ab'.repeat(16) + 'cd'.repeat(16),
  fileKey: 'sha256/ab/' + 'ab'.repeat(16) + 'cd'.repeat(16),
} as const

const TB_ROW = { accountId: '35', accountNumber: '1010', accountName: 'Chequing', accountType: 'Bank', accountSubType: 'Checking', debitCents: 138000, creditCents: 0 }

describe('B04 the contract says what is not confirmed (TB-13)', () => {
  test('TB-13 src/contracts/qbo.ts states in its header that the mapping from Intuit report JSON is unconfirmed, with the date and the research file', () => {
    const text = readOwnSource('src/contracts/qbo.ts')
    const header = text.split('\n').slice(0, 30).join('\n')
    expect(header).toMatch(/unconfirmed|not confirmed/i)
    expect(header).toContain('2026-10-01')
    expect(header).toContain('reference/research/2026-10-01-qbo-reconciled.md')
  })
})

describe('B04 the reader interface is read only (OUT-3)', () => {
  test('OUT-3 QboReader has exactly engine, version and the five read methods: no write, update or delete', () => {
    expectTypeOf<keyof QboReader>().toEqualTypeOf<'engine' | 'version' | 'company' | 'trialBalance' | 'transactions' | 'journalEntries' | 'attachment'>()
    expectTypeOf<QboReader['trialBalance']>().returns.resolves.items.toHaveProperty('debitCents')
    expectTypeOf<QboReader['attachment']>().returns.resolves.toHaveProperty('bytes').toEqualTypeOf<Uint8Array>()
    // A runtime twin, so the test holds an assertion under the suite's expect.hasAssertions() (type checks count none).
    const keys = ['engine', 'version', 'company', 'trialBalance', 'transactions', 'journalEntries', 'attachment'] as const satisfies readonly (keyof QboReader)[]
    expect(keys.filter((k) => /write|update|delete|create|post|put|patch|save/i.test(k))).toEqual([])
  })
})

describe('B04 source pointers (EV-5, TB-10)', () => {
  test('EV-5 TB-10 a trial balance pointer names the snapshot and the account, with no transaction', () => {
    const p = QboPointerSchema.parse({ kind: 'qbo', snapshotId: 'snap-b04-0001', accountId: '35', idKind: 'account' })
    expect(p).toEqual({ kind: 'qbo', snapshotId: 'snap-b04-0001', accountId: '35', idKind: 'account' })
  })

  test('EV-5 TB-10 a transaction pointer names the snapshot, the account and the QBO Transaction ID', () => {
    const p = QboPointerSchema.parse({ kind: 'qbo', snapshotId: 'snap-b04-0002', accountId: '55', txnId: '182', lineNo: 1, idKind: 'qbo' })
    expect(p.txnId).toBe('182')
    expect(p.lineNo).toBe(1)
  })

  test('EV-5 TB-13 a composite-key pointer is accepted and says so', () => {
    const p = QboPointerSchema.parse({ kind: 'qbo', snapshotId: 'snap-b04-0002', accountId: '35', txnId: '2025-06-30|Expense||35|-3000', idKind: 'composite' })
    expect(p.idKind).toBe('composite')
  })

  const BAD: [string, Record<string, unknown>][] = [
    ['no snapshot', { kind: 'qbo', accountId: '35', idKind: 'account' }],
    ['a blank snapshot', { kind: 'qbo', snapshotId: '  ', accountId: '35', idKind: 'account' }],
    ['a null snapshot', { kind: 'qbo', snapshotId: null, accountId: '35', idKind: 'account' }],
    ['no account', { kind: 'qbo', snapshotId: 'snap-b04-0001', idKind: 'account' }],
    ['a blank account', { kind: 'qbo', snapshotId: 'snap-b04-0001', accountId: '', idKind: 'account' }],
    ['another pointer kind', { kind: 'document', snapshotId: 'snap-b04-0001', accountId: '35', idKind: 'account' }],
    ['an unknown id kind', { kind: 'qbo', snapshotId: 'snap-b04-0001', accountId: '35', idKind: 'guess' }],
    ['a blank transaction id', { kind: 'qbo', snapshotId: 'snap-b04-0001', accountId: '35', txnId: ' ', idKind: 'qbo' }],
    ['a line number of 0', { kind: 'qbo', snapshotId: 'snap-b04-0001', accountId: '35', txnId: '182', lineNo: 0, idKind: 'qbo' }],
  ]
  for (const [label, value] of BAD) {
    test(`EV-5 TB-10 planted: a QBO pointer with ${label} is refused by the schema`, () => {
      expect(QboPointerSchema.safeParse(value).success).toBe(false)
    })
  }

  test('EV-5 TB-10 a refused pointer names the missing field (snapshotId, accountId)', () => {
    const noSnap = QboPointerSchema.safeParse({ kind: 'qbo', accountId: '35', idKind: 'account' })
    const noAcct = QboPointerSchema.safeParse({ kind: 'qbo', snapshotId: 'snap-b04-0001', idKind: 'account' })
    expect(noSnap.success ? [] : noSnap.error.issues.map((i) => i.path.join('.'))).toContain('snapshotId')
    expect(noAcct.success ? [] : noAcct.error.issues.map((i) => i.path.join('.'))).toContain('accountId')
  })
})

describe('B04 snapshots are dated and fingerprinted (TB-10)', () => {
  test('TB-10 the snapshot shape holds the realm, kind, as-of or period, basis, engine and version, read-at, sha256 and file key', () => {
    const keys = Object.keys(QboSnapshotSchema.shape)
    for (const k of ['realm', 'kind', 'asOf', 'periodFrom', 'periodTo', 'basis', 'engine', 'engineVersion', 'readAt', 'sha256', 'fileKey', 'returnId', 'id']) {
      expect(keys, k).toContain(k)
    }
    expect(QboSnapshotSchema.parse(SNAPSHOT)).toEqual(SNAPSHOT)
  })

  for (const k of Object.keys(QboSnapshotSchema.shape).filter((k) => !['asOf', 'periodFrom', 'periodTo', 'basis', 'accountId', 'attachmentId'].includes(k))) {
    test(`TB-10 planted: a snapshot with no ${k} is refused`, () => {
      const copy = Object.fromEntries(Object.entries(SNAPSHOT).filter(([key]) => key !== k))
      expect(QboSnapshotSchema.safeParse(copy).success).toBe(false)
    })
  }

  test('TB-1 TB-10 planted: a snapshot on the cash basis is refused; accrual and none are accepted', () => {
    expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, basis: 'cash' }).success).toBe(false)
    expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, basis: 'accrual' }).success).toBe(true)
    expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, kind: 'company', asOf: null, basis: null }).success).toBe(true)
  })

  test('TB-10 planted: a blank sha256 or file key, or an engine that is not samples, sandbox or live, is refused', () => {
    expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, sha256: '' }).success).toBe(false)
    expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, fileKey: ' ' }).success).toBe(false)
    expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, engine: 'csv' }).success).toBe(false)
  })

  // A507 item 9: the fingerprint is a sha256 in its one written form, 64 lower-case hex characters.
  const HEX64 = 'ab'.repeat(16) + 'cd'.repeat(16)
  const BAD_SHA: [string, string][] = [
    ['upper-case hex', HEX64.toUpperCase()],
    ['63 characters', HEX64.slice(1)],
    ['65 characters', HEX64 + 'a'],
    ['a letter past f', 'g' + HEX64.slice(1)],
    ['a prefix', 'sha256:' + HEX64],
    ['a trailing newline', HEX64 + '\n'],
    ['a leading space', ' ' + HEX64.slice(1)],
    ['8 characters', 'f'.repeat(8)],
    ['base64 of the digest', Buffer.from(HEX64, 'hex').toString('base64')],
  ]
  for (const [label, value] of BAD_SHA) {
    test(`TB-10 planted: a snapshot whose sha256 is ${label} is refused (64 lower-case hex only)`, () => {
      expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, sha256: value }).success).toBe(false)
    })
  }

  test('TB-10 property: any 64 lower-case hex sha256 is accepted; any other text is refused', () => {
    const hex = fc.constantFrom(...'0123456789abcdef'.split(''))
    fc.assert(
      fc.property(fc.string({ unit: hex, minLength: 64, maxLength: 64 }), (s) => {
        expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, sha256: s }).success).toBe(true)
      }),
      { seed: 4021, numRuns: 200 },
    )
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ maxLength: 80 }), fc.string({ unit: fc.constantFrom(...'0123456789abcdefABCDEF'.split('')), minLength: 60, maxLength: 68 })).filter((s) => !/^[0-9a-f]{64}$/.test(s)),
        (s) => {
          expect(QboSnapshotSchema.safeParse({ ...SNAPSHOT, sha256: s }).success).toBe(false)
        },
      ),
      { seed: 4022, numRuns: 300 },
    )
  })
})

describe('B04 normalised rows hold money in integer cents (TB-1, ARC-13)', () => {
  test('TB-1 a trial balance row parses and keeps every field', () => {
    expect(QboTrialBalanceRowSchema.parse(TB_ROW)).toEqual(TB_ROW)
    expect(Object.keys(QboTrialBalanceRowSchema.shape).sort()).toEqual(Object.keys(TB_ROW).sort())
  })

  test('TB-1 property: any safe-integer debit and credit in cents is accepted; any fraction of a cent is refused', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (d, c) => {
        expect(QboTrialBalanceRowSchema.safeParse({ ...TB_ROW, debitCents: d, creditCents: c }).success).toBe(true)
      }),
      { seed: 4004, numRuns: 200 },
    )
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e12, noNaN: true }).filter((x) => !Number.isInteger(x)), (x) => {
        expect(QboTrialBalanceRowSchema.safeParse({ ...TB_ROW, debitCents: x }).success).toBe(false)
      }),
      { seed: 4005, numRuns: 200 },
    )
  })

  test('TB-10 a transaction row and a journal entry parse; a transaction with a fraction of a cent or an unknown id kind is refused', () => {
    const txn = { txnId: '131', idKind: 'qbo', entityType: 'Cheque', date: '2025-04-10', number: '2020', memo: 'Hydro bill (Test)', accountId: '35', amountCents: -12000, otherAccountIds: ['55'], attachmentIds: ['901'] }
    expect(QboTransactionSchema.parse(txn)).toEqual(txn)
    expect(QboTransactionSchema.safeParse({ ...txn, amountCents: -120.5 }).success).toBe(false)
    expect(QboTransactionSchema.safeParse({ ...txn, idKind: 'account' }).success).toBe(false)
    const je = {
      txnId: '182', date: '2025-12-31', number: '15', memo: 'AJE accrual: hydro owed at year end (Test) | source: hydro bill (Test)', adjustment: 'not given',
      lines: [
        { lineNo: 1, accountId: '55', debitCents: 4500, creditCents: 0, description: 'line one (Test)' },
        { lineNo: 2, accountId: '33', debitCents: 0, creditCents: 4500, description: 'line two (Test)' },
      ],
      attachmentIds: ['902'],
    }
    expect(QboJournalEntrySchema.parse(je)).toEqual(je)
    expect(QboJournalEntrySchema.safeParse({ ...je, adjustment: false }).success).toBe(true)
    expect(QboJournalEntrySchema.safeParse({ ...je, adjustment: 'maybe' }).success).toBe(false)
  })

  test('TB-1 a company parses; a fiscal year start month outside 1 to 12 is refused', () => {
    const co = { realm: '9130000000000001', legalName: 'Birchwood Fixture Ltd. (Test)', fiscalYearStartMonth: 1, country: 'CA', homeCurrency: 'CAD', isTestCompany: true }
    expect(QboCompanySchema.parse(co)).toEqual(co)
    expect(QboCompanySchema.safeParse({ ...co, fiscalYearStartMonth: 13 }).success).toBe(false)
    expect(QboCompanySchema.safeParse({ ...co, fiscalYearStartMonth: 0 }).success).toBe(false)
  })
})
