// Builder unit tests for the client schema and the load error: anchors, shapes and exact messages.
import { describe, expect, test } from 'vitest'
import { CLIENT_ID, ClientSchema, TestWorldLoadError, type LoadIssue } from './schema'

const tb = { rows: [], totalDebitCents: 0, totalCreditCents: 0 }

function client(over: { id?: string; yearStart?: string; yearEnd?: string; month?: string } = {}): unknown {
  return {
    id: over.id ?? 'C01',
    corporation: {
      name: 'Alpha (Test)',
      businessNumber: '000000000',
      yearStart: over.yearStart ?? '2025-01-01',
      yearEnd: over.yearEnd ?? '2025-12-31',
    },
    owners: [{ name: 'Owner One (Test)' }],
    accounts: [
      {
        key: 'CHQ',
        role: 'bank',
        currency: 'CAD',
        glAccount: '1000',
        openingCents: 0,
        closingCents: 0,
        exportRows: 0,
        qboRows: 0,
        months: [{ month: over.month ?? '2025-01', openingCents: 0, closingCents: 0, activityCents: 0, rolls: true }],
      },
    ],
    transactions: [],
    adjustingEntries: [],
    trialBalance: { opening: tb, unadjusted: tb, adjusted: tb },
    flags: [],
    priorYear: null,
  }
}

describe('ClientSchema', () => {
  test('END-9 a well-formed client parses unchanged, owners keep their names', () => {
    const input = client()
    const parsed = ClientSchema.safeParse(input)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(input)
  })

  test('END-9 an owner needs a non-empty name', () => {
    const input = client() as { owners: unknown[] }
    input.owners = [{ name: '' }]
    expect(ClientSchema.safeParse(input).success).toBe(false)
  })

  test('END-9 the client id is C and two digits, anchored at both ends', () => {
    expect(ClientSchema.safeParse(client({ id: 'C10' })).success).toBe(true)
    for (const id of ['C1', 'C123', 'XC01', 'C01X', 'c01', '']) {
      expect(ClientSchema.safeParse(client({ id })).success, id).toBe(false)
    }
    expect(CLIENT_ID.test('C01')).toBe(true)
    expect(CLIENT_ID.test('C011')).toBe(false)
  })

  test('END-9 the year start and end are full dates, anchored at both ends', () => {
    for (const bad of ['2025-1-01', '2025-01-011', 'x2025-01-01', '2025-01-01x', '01-01-2025']) {
      expect(ClientSchema.safeParse(client({ yearStart: bad })).success, `start ${bad}`).toBe(false)
      expect(ClientSchema.safeParse(client({ yearEnd: bad })).success, `end ${bad}`).toBe(false)
    }
  })

  test('END-9 a month is YYYY-MM, anchored at both ends', () => {
    for (const bad of ['2025-1', '2025-011', 'x2025-01', '2025-01x', '2025']) {
      expect(ClientSchema.safeParse(client({ month: bad })).success, bad).toBe(false)
    }
  })
})

describe('TestWorldLoadError', () => {
  const issue = (check: LoadIssue['check'], record: string, reason: string): LoadIssue => ({
    client: 'C03',
    check,
    record,
    reason,
  })

  test('END-9 the message names the client, the count and the first issue', () => {
    const e = new TestWorldLoadError('C03', [issue('gifi', 'acct 1', 'no code'), issue('money', 'tx 2', 'not whole')])
    expect(e.message).toBe('test-world client C03 refused with 2 issue(s); first: gifi acct 1: no code')
    expect(e.name).toBe('TestWorldLoadError')
    expect(e.issues).toHaveLength(2)
    expect(e).toBeInstanceOf(Error)
  })

  test('END-9 with no issues the message has no first-issue part', () => {
    const e = new TestWorldLoadError('C03', [])
    expect(e.message).toBe('test-world client C03 refused with 0 issue(s)')
    expect(e.issues).toEqual([])
  })
})
