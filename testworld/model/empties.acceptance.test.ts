// W00c acceptance tests (round 2), RC2: a check whose driving collection is empty never passes vacuously
// (reports/W00c-findings.md, fix 2 and "Acceptance tests for the spec writer"; card correction: the W00a rule
// "refuse a client with no accounts" becomes "empty only where the catalogue declares it").
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plants one fault in a temp copy and loads through the public loader.
//
// Each plant is made vacuous on purpose: the books are emptied or zeroed so that every existing check (rolls, the
// trial-balance tie-out, adjusting-entry sources, the catalogue's markers and waivers) has nothing left to object to.
// Only the new rule can refuse it, so the test fails until the build adds the rule and never passes by accident.
//
// What the W00c round 2 build does (in the checks, not ClientSchema, so C12 still loads):
//   `accounts: []` is refused unless the client's catalogue has an entry with `empty: 'accounts'` (hand-written on
//   12-F02), and then transactions and statementBalances must be empty too. The issue names "accounts".
//   The unadjusted and the adjusted trial balance need at least one row (TB-3); the issue names the trial balance.
//   The opening trial balance may be empty only when onboarding corporation.incorporation_date equals the fiscal
//   year start (a first year: C09); otherwise the issue names "opening".
//   owners (onboarding.json) needs at least one; the issue names "owners".
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, catalogue, expectLoads, refusal, walkClients, type CatalogueEntry, type RawKey, type WalkClient } from './__fixtures__/sample-walk'
import { expectNamed, full, type TbRow } from './__fixtures__/w00c-walk'

const clients = walkClients()
const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const withAccounts = clients.filter((c) => c.key.accounts.length > 0)
const withoutAccounts = clients.filter((c) => c.key.accounts.length === 0)
const corporation = (c: WalkClient): Record<string, unknown> => c.onboarding['corporation'] as Record<string, unknown>
const firstYear = (c: WalkClient): boolean => corporation(c)['incorporation_date'] === c.key.fiscalYear.start

/** The unadjusted rows with every amount set to zero: a trial balance that ties to empty books. */
const zeroRows = (k: RawKey): TbRow[] => full(k).trialBalance.unadjusted.rows.map((r) => ({ ...structuredClone(r), debit: 0, credit: 0 }))

/** No postings and no adjusting entries, so every trial balance ties to its opening alone. */
function noPostings(k: RawKey): void {
  for (const t of k.transactions) Reflect.deleteProperty(t, 'post')
  k.adjustingEntries = []
}

/** The catalogue with this client's roll waivers and marker entries taken off (they would name rows that are gone). */
function catalogueWithoutRowFaults(id: string): CatalogueEntry[] {
  const cat = catalogue().filter((e) => !(e.client === id && e.roll !== undefined))
  for (const e of cat) if (e.client === id) Reflect.deleteProperty(e, 'marker')
  return cat
}

describe('W00c RC2 the walk', () => {
  test('TB-3 the walk finds clients with no accounts (C12 today), a first-year client with an empty opening trial balance (C09 today), and both kinds of client otherwise', () => {
    expect(withoutAccounts.length).toBeGreaterThan(0)
    expect(withAccounts.length).toBeGreaterThan(0)
    const emptyOpening = clients.filter((c) => full(c.key).trialBalance.opening.rows.length === 0)
    expect(emptyOpening.length).toBeGreaterThan(0)
    for (const c of emptyOpening) expect(firstYear(c), `${c.id} has an empty opening trial balance only as a first year`).toBe(true)
    for (const c of clients) {
      expect(full(c.key).trialBalance.unadjusted.rows.length, c.id).toBeGreaterThan(0)
      expect(full(c.key).trialBalance.adjusted.rows.length, c.id).toBeGreaterThan(0)
      expect((c.onboarding['owners'] as unknown[]).length, c.id).toBeGreaterThan(0)
    }
  })

  test.each(byId(clients))('END-9 %s loads unchanged under the empty-collection rules', async (_l, c) => {
    await expectLoads(sb, c.id)
  })
})

describe("W00c RC2 no accounts only where the catalogue declares it ('empty: accounts')", () => {
  test.each(byId(withAccounts))(
    "ARC-8 %s with accounts, transactions and statement balances emptied (books zeroed so every other check holds) is refused, naming accounts",
    async (_l, c) => {
      sb.editKey(c, (k) => {
        const zero = zeroRows(k)
        k.accounts = []
        k.transactions = []
        k.statementBalances = {}
        k.adjustingEntries = []
        full(k).trialBalance = { opening: { rows: zero }, unadjusted: { rows: structuredClone(zero) }, adjusted: { rows: structuredClone(zero) } }
      })
      expectNamed(await refusal(sb, c.id, catalogueWithoutRowFaults(c.id)), undefined, ['accounts'])
    },
  )

  test.each(byId(withoutAccounts))("ARC-8 %s (no accounts by design) loads with the real catalogue, which declares it 'empty: accounts'", async (_l, c) => {
    expect(catalogue().some((e) => e.client === c.id && e.empty === 'accounts')).toBe(true)
    await expectLoads(sb, c.id)
  })

  test.each(byId(withoutAccounts))("ARC-8 %s with the catalogue's 'empty: accounts' declaration taken off is refused, naming accounts", async (_l, c) => {
    const cat = catalogue()
    const declared = cat.filter((e) => e.client === c.id && e.empty !== undefined)
    expect(declared.length).toBeGreaterThan(0)
    for (const e of declared) Reflect.deleteProperty(e, 'empty')
    expectNamed(await refusal(sb, c.id, cat), undefined, ['accounts'])
  })
})

describe('W00c RC2 the unadjusted and adjusted trial balances need a row (every folder)', () => {
  const cases = clients.flatMap((c) => (['unadjusted', 'adjusted'] as const).map((name): [string, 'unadjusted' | 'adjusted', WalkClient] => [c.id, name, c]))

  test.each(cases)('TB-3 %s with the %s trial balance emptied (no postings, no adjusting entries, opening zeroed, so it still ties) is refused, naming it', async (_l, name, c) => {
    sb.editKey(c, (k) => {
      noPostings(k)
      const tb = full(k).trialBalance
      const zero = zeroRows(k)
      tb.opening = { rows: tb.opening.rows.length === 0 ? [] : tb.opening.rows.map((r) => ({ ...r, debit: 0, credit: 0 })) }
      tb.unadjusted = { rows: name === 'unadjusted' ? [] : zero }
      tb.adjusted = { rows: name === 'adjusted' ? [] : structuredClone(zero) }
    })
    // "adjusted" must be named as itself, not only inside "unadjusted".
    const issues = await refusal(sb, c.id)
    const word = new RegExp(`(^|[^A-Za-z])${name}`)
    expect(issues.some((i) => word.test(`${i.record} ${i.reason}`)), `expected an issue naming ${name}; got ${JSON.stringify(issues)}`).toBe(true)
  })
})

describe('W00c RC2 the opening trial balance is empty only in a first year (incorporation on the fiscal year start)', () => {
  /** Opening emptied, no postings and no adjusting entries, the other two trial balances zeroed: everything still ties. */
  const emptyOpening = (k: RawKey): void => {
    noPostings(k)
    const zero = zeroRows(k)
    full(k).trialBalance = { opening: { rows: [] }, unadjusted: { rows: zero }, adjusted: { rows: structuredClone(zero) } }
  }

  test.each(byId(clients.filter((c) => !firstYear(c))))('TB-3 %s (incorporated before its fiscal year) with its opening trial balance emptied is refused, naming opening', async (_l, c) => {
    sb.editKey(c, emptyOpening)
    expectNamed(await refusal(sb, c.id), undefined, ['opening'])
  })

  test.each(byId(clients.filter(firstYear)))('TB-3 %s (incorporated on its fiscal year start) with its opening trial balance empty and the books zeroed still loads', async (_l, c) => {
    sb.editKey(c, emptyOpening)
    await expectLoads(sb, c.id)
  })

  test.each(byId(clients.filter(firstYear)))('TB-3 %s with its incorporation date moved one day earlier and its opening trial balance empty is refused, naming opening', async (_l, c) => {
    sb.editKey(c, emptyOpening)
    sb.editOnboarding(c, (o) => {
      const corp = o['corporation'] as Record<string, unknown>
      corp['incorporation_date'] = dayBefore(String(corp['incorporation_date']))
    })
    expectNamed(await refusal(sb, c.id), undefined, ['opening'])
  })
})

describe('W00c RC2 a client has at least one owner (every folder)', () => {
  test.each(byId(clients))('ARC-8 %s with owners: [] in onboarding.json is refused, naming owners', async (_l, c) => {
    sb.editOnboarding(c, (o) => {
      o['owners'] = []
    })
    expectNamed(await refusal(sb, c.id), undefined, ['owners'])
  })
})

/** The calendar day before a YYYY-MM-DD date (UTC arithmetic, so no clock and no time zone is involved). */
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
