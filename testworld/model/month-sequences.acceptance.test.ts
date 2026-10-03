// W00a acceptance tests, part 1 of 3: month sequences over every account (findings W00 r2 RC2, S5).
//
// Every case comes from a walk over all numbered folders of reference/sample-clients/ (testworld/model/__fixtures__/
// sample-walk.ts), never from a typed list. Each plants one fault in a temp copy and loads through the public
// loader, loadClient(id, { root }), which must refuse with a TestWorldLoadError whose issues name the fault.
//
// What the loader checks (the W00a build adds these; the existing checks stay):
//   For every account that has statement balances (one with transactions and none is refused, as before), the
//   list is the months of the fiscal year
//   (yearStart to yearEnd, by YYYY-MM), each once, in order; the first month's opening equals the account's
//   openingBalance; the last month's closing equals its closingBalance; each closing equals the next month's
//   opening; every statementBalances key is a declared account; every transaction falls in a month of its
//   account, except a priorYear row the catalogue lists (part 2).
//   The statement roll: opening plus the month's transactions (dupOf and priorYear rows out, missingFromExport
//   rows in; card and pcard subtract) equals closing, for every month, with no waiver.
//
// Issues (check 'roll' for all of these; the record names what is wrong):
//   a month missing, duplicated, outside the year or out of order     record "<account> <YYYY-MM>" (that month)
//   a closing that is not the next opening                           record "<account> <YYYY-MM>" (the month whose
//                                                                    opening does not equal the previous closing)
//   first opening or last closing not the account's balance          record "<account> <YYYY-MM>" (first or last month)
//   a statementBalances key for an account the key does not declare  record contains that key
//   a transaction dated in no month of its account                   record contains the transaction id
//   a month whose statement roll fails                               record "<account> <YYYY-MM>"
import fc from 'fast-check'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import {
  Sandbox,
  accountIn,
  addMonth,
  cents,
  dollars,
  expectIssue,
  markerGroups,
  markersOf,
  monthOf,
  monthsIn,
  refusal,
  shiftFrom,
  walkClients,
  type RawAccount,
  type RawMonth,
  type WalkClient,
} from './__fixtures__/sample-walk'

const clients = walkClients()
const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

interface AccountCase {
  c: WalkClient
  a: RawAccount
  months: RawMonth[]
}
const accountCases: [string, AccountCase][] = clients.flatMap((c) =>
  c.key.accounts.map((a): [string, AccountCase] => [`${c.id} ${a.key}`, { c, a, months: c.key.statementBalances[a.key] ?? [] }]),
)
const at = (ms: RawMonth[], i: number): RawMonth => {
  const m = ms[i]
  if (m === undefined) throw new Error(`fixture: no month at ${String(i)}`)
  return m
}
const mid = (ms: RawMonth[]): number => Math.floor(ms.length / 2)

describe('W00a the walk (findings W00 r2 RC4: cases from the data, never a typed list)', () => {
  test('ARC-8 the walk finds the numbered sample folders, ids C01 upward with no gap, and accounts with at least three months each', () => {
    expect(clients.length).toBeGreaterThan(0)
    expect(clients.map((c) => c.id)).toEqual(clients.map((_, i) => `C${String(i + 1).padStart(2, '0')}`))
    expect(accountCases.length).toBeGreaterThan(0)
    for (const [label, x] of accountCases) expect(x.months.length, label).toBeGreaterThanOrEqual(3)
  })
})

describe('W00a S5 month sequences: every account of every sample client', () => {
  test.each(accountCases)('ARC-8 %s with its first month dropped is refused, naming the account and that month', async (_l, { c, a, months }) => {
    sb.editKey(c, (k) => monthsIn(k, a.key).splice(0, 1))
    expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, 0).month)
  })

  test.each(accountCases)('ARC-8 %s with a middle month dropped is refused, naming the account and that month', async (_l, { c, a, months }) => {
    sb.editKey(c, (k) => monthsIn(k, a.key).splice(mid(months), 1))
    expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, mid(months)).month)
  })

  test.each(accountCases)('ARC-8 %s with its last month dropped is refused, naming the account and that month', async (_l, { c, a, months }) => {
    sb.editKey(c, (k) => monthsIn(k, a.key).splice(months.length - 1, 1))
    expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, months.length - 1).month)
  })

  test.each(accountCases)('ARC-8 %s with a month listed twice is refused, naming the account and that month', async (_l, { c, a, months }) => {
    const i = mid(months)
    sb.editKey(c, (k) => {
      const ms = monthsIn(k, a.key)
      ms.splice(i + 1, 0, structuredClone(at(ms, i)))
    })
    expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, i).month)
  })

  test.each(accountCases)('ARC-8 %s with a month after the year end appended is refused, naming the account and that month', async (_l, { c, a }) => {
    const after = addMonth(monthOf(c.key.fiscalYear.end), 1)
    expect(c.key.transactions.some((t) => t.acct === a.key && monthOf(t.date) === after), 'fixture: no transaction in the month after year end').toBe(false)
    sb.editKey(c, (k) => {
      const ms = monthsIn(k, a.key)
      const last = at(ms, ms.length - 1)
      // It rolls (no activity) and links (opens at the last closing): only the year bound can refuse it.
      ms.push({ month: after, opening: last.closing, closing: last.closing, rolls: true, exportActivity: 0 })
    })
    expectIssue(await refusal(sb, c.id), 'roll', a.key, after)
  })

  test.each(accountCases)('ARC-8 %s with two neighbouring months swapped is refused, naming the account and one of them', async (_l, { c, a, months }) => {
    const i = mid(months)
    sb.editKey(c, (k) => {
      const ms = monthsIn(k, a.key)
      const [x, y] = [at(ms, i - 1), at(ms, i)]
      ms.splice(i - 1, 2, y, x)
    })
    const issues = await refusal(sb, c.id)
    const names = [at(months, i - 1).month, at(months, i).month]
    expect(
      issues.some((x) => x.check === 'roll' && x.record.includes(a.key) && names.some((m) => x.record.includes(m))),
      JSON.stringify(issues),
    ).toBe(true)
  })

  test.each(accountCases)(
    'ARC-8 %s with a closing that is not the next opening is refused, naming the account and the month that opens wrong (every month still rolls)',
    async (_l, { c, a, months }) => {
      const i = mid(months)
      // From month i on, every opening and closing moves by one cent (each month still rolls), and so does the
      // account's closing balance: only the link from month i-1 to month i is broken.
      sb.editKey(c, (k) => {
        shiftFrom(k, a.key, i, 1, true)
      })
      expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, i).month)
    },
  )

  test.each(accountCases)("ARC-8 %s whose first opening is not the account's opening balance is refused, naming the account and the first month", async (_l, { c, a, months }) => {
    sb.editKey(c, (k) => {
      const acc = accountIn(k, a.key)
      acc.openingBalance = dollars(cents(acc.openingBalance) + 1)
    })
    expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, 0).month)
  })

  test.each(accountCases)("ARC-8 %s whose last closing is not the account's closing balance is refused, naming the account and the last month", async (_l, { c, a, months }) => {
    sb.editKey(c, (k) => {
      const acc = accountIn(k, a.key)
      acc.closingBalance = dollars(cents(acc.closingBalance) - 1)
    })
    expectIssue(await refusal(sb, c.id), 'roll', a.key, at(months, months.length - 1).month)
  })

  test.each(accountCases)('ARC-8 %s with a transaction dated after the year end (no marker) is refused, naming the transaction', async (_l, { c, a }) => {
    const src = c.key.transactions.find((t) => t.acct === a.key && t.amount !== 0 && markersOf(t).length === 0)
    if (src === undefined) throw new Error(`fixture: ${c.id} ${a.key} has no plain transaction`)
    const id = `${src.id}-OUTSIDE`
    sb.editKey(c, (k) => {
      const t = structuredClone(src)
      t.id = id
      t.date = `${addMonth(monthOf(c.key.fiscalYear.end), 1)}-15`
      delete t['post']
      delete t['pair']
      k.transactions.push(t)
    })
    expectIssue(await refusal(sb, c.id), 'roll', id)
  })
})

describe('W00a S5 statement balances name only declared accounts', () => {
  test.each(clients.map((c): [string, WalkClient] => [c.id, c]))(
    'ARC-8 %s with statement balances for an account it does not declare is refused, naming that key',
    async (_l, c) => {
      const first = c.key.fiscalYear.start.slice(0, 7)
      sb.editKey(c, (k) => {
        k.statementBalances['XTEST'] = [{ month: first, opening: 0, closing: 0, rolls: true, exportActivity: 0 }]
      })
      expectIssue(await refusal(sb, c.id), 'roll', 'XTEST')
    },
  )
})

describe('W00a S5 removing a transaction breaks the statement roll for its month', () => {
  // Rows the statement holds: dupOf and priorYear rows are not on the statement, so removing one changes no
  // statement roll. Zero amounts change nothing either.
  const removable = clients.flatMap((c) =>
    c.key.transactions
      .filter((t) => t.amount !== 0 && typeof t.dupOf !== 'string' && t.priorYear !== true)
      .filter((t) => (c.key.statementBalances[t.acct] ?? []).some((m) => m.month === monthOf(t.date)))
      .map((t) => ({ c, t })),
  )

  test('ARC-8 property (fast-check, seed 20261002): removing any one statement transaction of any client is refused for its account and month', async () => {
    expect(removable.length).toBeGreaterThan(100)
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...removable), async ({ c, t }) => {
        sb.restore()
        sb.editKey(c, (k) => {
          k.transactions = k.transactions.filter((x) => x.id !== t.id)
        })
        expectIssue(await refusal(sb, c.id), 'roll', t.acct, monthOf(t.date))
      }),
      { seed: 20261002, numRuns: 30 },
    )
  }, 120_000)

  test('ARC-8 removing a missingFromExport row (it is on the statement, not in the export) is refused for its month, in every marked month the walk finds', async () => {
    const groups = clients.flatMap((c) => markerGroups(c).filter((g) => g.field === 'missingFromExport').map((g) => ({ c, g })))
    expect(groups.length, 'the walk finds at least one month with missing export rows (C10 CHQ 2025-05 today)').toBeGreaterThan(0)
    for (const { c, g } of groups) {
      const victim = c.key.transactions.find((t) => t.acct === g.account && monthOf(t.date) === g.month && t.missingFromExport === true && t.amount !== 0)
      if (victim === undefined) throw new Error(`fixture: no non-zero missing row in ${g.account} ${g.month}`)
      sb.restore()
      sb.editKey(c, (k) => {
        k.transactions = k.transactions.filter((x) => x.id !== victim.id)
      })
      expectIssue(await refusal(sb, c.id), 'roll', g.account, g.month)
    }
  })
})
