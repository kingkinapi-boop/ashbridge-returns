// W00c acceptance tests, part 2 of 3: RC2, lookups refuse duplicates and inherited keys, and a reference resolves
// in full (reports/W00a-findings.md, fix 3 and "Tests to add"; W00a check classes 3, 5b and 6b).
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plant is otherwise clean (rolls, trial balances and the catalogue
// still hold), so the only thing wrong with the copy is the fault under test.
//
// What the W00c build adds (the W00a rules stay):
//   Duplicates. Two accounts with one key, two transactions with one id, two adjusting entries with one id, two
//   flags with one id, or two rows of one trial balance for one account are refused. The issue (any check) names
//   the repeated key or id; for a trial-balance row it names the account and the trial balance (opening,
//   unadjusted or adjusted).
//   Inherited keys. Every lookup by a key taken from the data uses own properties only (Object.hasOwn): an account
//   key "toString", "__proto__" or "constructor" is refused, with an issue naming the key, never a raw TypeError.
//   Qualifiers. An onboarding source "<key> (<qualifier>)" resolves only when the qualifier names a record of that
//   key: "(NNNN Name)" must match an item of onboarding[key].accounts with that account number and name (C07, C08:
//   "prior_year_closing_balances (1200 Prepaid expenses)"). Any other qualifier ("tenants (x)") or a mismatch is an
//   'adjusting-entry' issue: record the entry id, text naming the source.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import {
  Sandbox,
  catalogue,
  cents,
  expectIssueWith,
  expectLoads,
  onboardingTarget,
  plainMonth,
  refusal,
  shiftFrom,
  sign,
  walkClients,
  type RawAccount,
  type RawKey,
  type RawOnboarding,
  type WalkClient,
} from './__fixtures__/sample-walk'
import { TB_NAMES, expectNamed, full, plantRow, type TbName } from './__fixtures__/w00c-walk'

const clients = walkClients()
const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

type AccountCase = { c: WalkClient; a: RawAccount }
const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const withAccounts = clients.filter((c) => c.key.accounts.length > 0)
const accountCases: [string, AccountCase][] = withAccounts.flatMap((c) => c.key.accounts.map((a): [string, AccountCase] => [`${c.id} ${a.key}`, { c, a }]))
const withEntries = clients.filter((c) => c.key.adjustingEntries.length > 0)
const withFlags = clients.filter((c) => c.key.flags.length > 0)
const tbCases: [string, { c: WalkClient; name: TbName }][] = clients.flatMap((c) =>
  TB_NAMES.filter((name) => full(c.key).trialBalance[name].rows.length > 0).map((name): [string, { c: WalkClient; name: TbName }] => [`${c.id} ${name}`, { c, name }]),
)

const PROTO_KEYS = ['toString', '__proto__', 'constructor'] as const
type ProtoKey = (typeof PROTO_KEYS)[number]

/** Sets an own property, even for "__proto__" (a plain assignment would change the prototype instead). */
function setOwn(o: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(o, key, { value, enumerable: true, writable: true, configurable: true })
}

/** Renames an account everywhere the answer key uses its key: the account, its statement balances, its transactions. */
function renameAccount(k: RawKey, from: string, to: string): void {
  for (const a of k.accounts) if (a.key === from) a.key = to
  const months = k.statementBalances[from]
  Reflect.deleteProperty(k.statementBalances, from)
  setOwn(k.statementBalances, to, months)
  for (const t of k.transactions) if (t.acct === from) t.acct = to
}

// ---- qualifiers, from the walk ----

const QUALIFIED = /^(.*?)\s*\((\d+) (.+)\)$/
interface SourceCase {
  c: WalkClient
  source: string
}
const onboardingSources: [string, SourceCase][] = clients.flatMap((c) =>
  [...new Set(c.key.adjustingEntries.flatMap((j) => j.source.onboarding))].map((source): [string, SourceCase] => [`${c.id} "${source}"`, { c, source }]),
)
const qualifiedSources = onboardingSources.filter(([, s]) => QUALIFIED.test(s.source))
const citing = (c: WalkClient, source: string): string[] => c.key.adjustingEntries.filter((j) => j.source.onboarding.includes(source)).map((j) => j.id)

/** The account rows a qualified source's key holds in onboarding.json ({account, name} items), read here. */
function recordAccounts(o: RawOnboarding, base: string): { account: string; name: string }[] {
  const v = o[base]
  const list = v !== null && typeof v === 'object' ? (v as { accounts?: unknown }).accounts : undefined
  if (!Array.isArray(list)) return []
  return list.map((x) => ({ account: String((x as { account?: unknown }).account), name: String((x as { name?: unknown }).name) }))
}
function parts(source: string): { base: string; account: string; name: string } {
  const m = QUALIFIED.exec(source)
  if (m === null) throw new Error(`fixture: "${source}" has no "(NNNN Name)" qualifier`)
  return { base: m[1] ?? '', account: m[2] ?? '', name: m[3] ?? '' }
}

/** Replaces one onboarding source by another in every entry citing it. */
function swapSource(k: RawKey, from: string, to: string): void {
  for (const j of k.adjustingEntries) j.source.onboarding = j.source.onboarding.map((s) => (s === from ? to : s))
}

describe('W00c RC2 the walk', () => {
  test('ARC-8 the walk finds accounts, entries, flags, trial-balance rows, onboarding sources, and qualified sources whose "(NNNN Name)" matches a real record', () => {
    expect(accountCases.length).toBeGreaterThan(0)
    expect(withEntries.length).toBeGreaterThan(0)
    expect(withFlags.length).toBeGreaterThan(0)
    expect(tbCases.length).toBeGreaterThan(0)
    expect(onboardingSources.length).toBeGreaterThan(0)
    expect(qualifiedSources.length).toBeGreaterThan(0)
    for (const [label, { c, source }] of qualifiedSources) {
      const p = parts(source)
      expect(recordAccounts(c.onboarding, p.base), label).toContainEqual({ account: p.account, name: p.name })
    }
  })

  test.each(byId(clients))('ARC-8 %s loads unchanged (no real key is a duplicate, an inherited name or a mismatched qualifier)', async (_l, c) => {
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC2 a duplicate of each id kind is refused, naming the repeated key (every record of its kind in every folder)', () => {
  test.each(accountCases)('ARC-8 %s: a second account with the same key is refused, naming the key', async (_l, { c, a }) => {
    sb.editKey(c, (k) => {
      k.accounts.push(structuredClone(a))
    })
    expectNamed(await refusal(sb, c.id), undefined, [a.key])
  })

  test.each(accountCases)("ARC-8 %s: a second transaction with the id of the account's first plain-month row (no postings, statement moved to match) is refused, naming the id", async (_l, { c, a }) => {
    const { tx, index } = plainMonth(c, a)
    sb.editKey(c, (k) => {
      k.transactions.push(plantRow(tx, tx.id, {}))
      shiftFrom(k, a.key, index, sign(a.role) * cents(tx.amount), false)
    })
    expectNamed(await refusal(sb, c.id), undefined, [tx.id])
  })

  test.each(byId(withEntries))('ARC-8 %s: a second adjusting entry with the id of each entry (its lines zeroed) is refused, naming the id', async (_l, c) => {
    for (const j of c.key.adjustingEntries) {
      sb.restore()
      sb.editKey(c, (k) => {
        const copy = structuredClone(full(k).adjustingEntries.find((x) => x.id === j.id))
        if (copy === undefined) throw new Error(`fixture: no entry ${j.id}`)
        for (const l of copy.lines) {
          l.debit = 0
          l.credit = 0
        }
        full(k).adjustingEntries.push(copy)
      })
      expectNamed(await refusal(sb, c.id), undefined, [j.id])
    }
  })

  test.each(byId(withFlags))('ARC-8 %s: a second flag with the id of each flag is refused, naming the id', async (_l, c) => {
    for (const f of c.key.flags) {
      sb.restore()
      sb.editKey(c, (k) => {
        k.flags.push(structuredClone(f))
      })
      expectNamed(await refusal(sb, c.id), undefined, [f.id])
    }
  })

  test.each(tbCases)('TB-3 %s: a zero row for the account of each row, put before it, is refused, naming the account and the trial balance', async (_l, { c, name }) => {
    for (const [i, row] of full(c.key).trialBalance[name].rows.entries()) {
      sb.restore()
      sb.editKey(c, (k) => {
        const rows = full(k).trialBalance[name].rows
        rows.splice(i, 0, { ...structuredClone(row), debit: 0, credit: 0 })
      })
      expectNamed(await refusal(sb, c.id), undefined, [row.account, name])
    }
  })
})

describe('W00c RC2 a key named after an Object.prototype member is refused, never looked up through the prototype', () => {
  const renameCases = accountCases.flatMap(([label, x]) => PROTO_KEYS.map((key): [string, ProtoKey, AccountCase] => [label, key, x]))
  const extraCases = withAccounts.flatMap((c) => PROTO_KEYS.map((key): [string, ProtoKey, WalkClient] => [c.id, key, c]))

  test.each(renameCases)('ARC-8 %s renamed "%s" everywhere (account, statement balances, transactions, catalogue) is refused, naming the key', async (_l, key, { c, a }) => {
    const cat = catalogue()
    for (const e of cat) {
      if (e.client !== c.id) continue
      if (e.roll?.account === a.key) e.roll.account = key
      if (e.marker?.account === a.key) e.marker.account = key
    }
    sb.editKey(c, (k) => {
      renameAccount(k, a.key, key)
    })
    expectNamed(await refusal(sb, c.id, cat), undefined, [key])
  })

  test.each(extraCases)('ARC-8 %s with an extra account keyed "%s" and no statement balances is refused with a LoadIssue naming the key, never a raw TypeError', async (_l, key, c) => {
    const first = c.key.accounts[0]
    if (first === undefined) throw new Error('fixture: no account')
    sb.editKey(c, (k) => {
      k.accounts.push({ ...structuredClone(first), key, openingBalance: 0, closingBalance: 0 })
    })
    expectNamed(await refusal(sb, c.id), undefined, [key])
  })
})

describe('W00c RC2 a "(...)" qualifier on an onboarding source must name the record it points at', () => {
  test.each(onboardingSources)('ARC-8 %s with its qualifier replaced by "(x)" is refused for every entry citing it, naming the entry and the source', async (_l, { c, source }) => {
    const target = onboardingTarget(c.onboarding, source)
    if (target === undefined) throw new Error(`fixture: ${c.id} "${source}" resolves to nothing`)
    const planted = `${target.kind === 'key' ? target.key : target.id} (x)`
    sb.editKey(c, (k) => {
      swapSource(k, source, planted)
    })
    const issues = await refusal(sb, c.id)
    for (const id of citing(c, source)) expectIssueWith(issues, 'adjusting-entry', [id], [planted])
  })

  test.each(qualifiedSources)('ARC-8 %s naming the right account number with a wrong name is refused for every entry citing it', async (_l, { c, source }) => {
    const p = parts(source)
    const planted = `${p.base} (${p.account} Wrong)`
    sb.editKey(c, (k) => {
      swapSource(k, source, planted)
    })
    const issues = await refusal(sb, c.id)
    for (const id of citing(c, source)) expectIssueWith(issues, 'adjusting-entry', [id], [planted])
  })

  test.each(qualifiedSources)('ARC-8 %s naming the right name with an account number the record does not have is refused for every entry citing it', async (_l, { c, source }) => {
    const p = parts(source)
    const numbers = new Set(recordAccounts(c.onboarding, p.base).map((r) => r.account))
    let n = 9999
    while (numbers.has(String(n))) n--
    const planted = `${p.base} (${String(n)} ${p.name})`
    sb.editKey(c, (k) => {
      swapSource(k, source, planted)
    })
    const issues = await refusal(sb, c.id)
    for (const id of citing(c, source)) expectIssueWith(issues, 'adjusting-entry', [id], [planted])
  })
})
