// W00c acceptance tests, part 3 of 3: RC3 (checks run when a list is empty) and RC4 (the loader boundary trusts
// no shape and no file system entry) (reports/W00a-findings.md, fixes 4 and 5 and "Tests to add"; W00a check
// classes 2, 4, 5a and 6a).
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plants one fault in a temp copy and loads through the public loader.
//
// What the W00c build adds (the W00a rules stay):
//   Empty lists. The fiscal-year coverage check runs for every account, also one with no statement balances: each
//   fiscal month it lacks is a 'roll' issue with record "<key> <YYYY-MM>". (Fix 4 also says "refuse a client with no
//   accounts"; C12 has none by design and must load, so no test here asks for that: amber, see the report.)
//   Roles. An account's role is one of the roles the sample clients use (bank, card, pcard, broker); any other is
//   refused with an issue naming the role field.
//   Dates. Every transaction date, adjusting-entry date and fiscal-year start and end is a calendar date YYYY-MM-DD
//   that round-trips ("2025-03-99", "2025-02-29" and "2025-03" are refused); the issue names the date field and the
//   record (its id, or its schema path such as "transactions.12").
//   Account files. `file` is a regular file accounts/<name>.csv and `qboFile` a regular file qbo/<name>.csv, in the
//   client folder. Anything else ("", a directory, another JSON file, a .txt, the other folder's CSV) is a 'file'
//   issue naming the account key and the field.
//   Client files. answer-key.json or onboarding.json that is a directory or is not valid JSON is a 'file' issue
//   naming the file, never a raw EISDIR or SyntaxError.
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, expectIssue, expectLoads, plainMonth, refusal, walkClients, type RawAccount, type WalkClient } from './__fixtures__/sample-walk'
import { Planter, badDates, expectNamed, expectNamedOneOf, fiscalMonths, full } from './__fixtures__/w00c-walk'

const clients = walkClients()
const sb = new Sandbox()
const planter = new Planter(sb)
afterEach(() => {
  planter.undo()
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

type AccountCase = { c: WalkClient; a: RawAccount; i: number }
const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const withAccounts = clients.filter((c) => c.key.accounts.length > 0)
const accountCases: [string, AccountCase][] = withAccounts.flatMap((c) => c.key.accounts.map((a, i): [string, AccountCase] => [`${c.id} ${a.key}`, { c, a, i }]))
const roles = [...new Set(withAccounts.flatMap((c) => c.key.accounts.map((a) => a.role)))].sort()
const withEntries = clients.filter((c) => c.key.adjustingEntries.length > 0)

describe('W00c RC3 RC4 the walk', () => {
  test('ARC-8 the walk finds accounts with statement months, the four roles in use, adjusting entries, and account files under accounts/ and qbo/', () => {
    expect(accountCases.length).toBeGreaterThan(0)
    expect(roles).toEqual(['bank', 'broker', 'card', 'pcard'])
    expect(withEntries.length).toBeGreaterThan(0)
    for (const [label, { c, a }] of accountCases) {
      expect(fiscalMonths(c.key).length, label).toBeGreaterThan(0)
      expect(a.file, label).toMatch(/^accounts\/[^/]+\.csv$/)
      expect(a.qboFile, label).toMatch(/^qbo\/[^/]+\.csv$/)
    }
  })

  test.each(byId(clients))('ARC-8 %s loads unchanged (every date is a calendar date, every role and account file is accepted)', async (_l, c) => {
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC3 an account with no months and no rows is still checked (every account of every folder)', () => {
  test.each(accountCases)("ARC-8 %s with its statement balances and its transactions taken out is refused with a 'roll' issue for every month of the fiscal year", async (_l, { c, a }) => {
    sb.editKey(c, (k) => {
      Reflect.deleteProperty(k.statementBalances, a.key)
      k.transactions = k.transactions.filter((t) => t.acct !== a.key)
    })
    const issues = await refusal(sb, c.id)
    for (const m of fiscalMonths(c.key)) expectIssue(issues, 'roll', `${a.key} ${m}`)
  })
})

describe('W00c RC4 the role decides the sign, so it is one of the known roles (every account of every folder)', () => {
  test.each(accountCases)('ARC-8 %s with role "savings (Test)" is refused, naming the role field', async (_l, { c, a, i }) => {
    sb.editKey(c, (k) => {
      const acc = k.accounts[i]
      if (acc === undefined) throw new Error('fixture: no account')
      acc.role = 'savings (Test)'
    })
    expectNamedOneOf(await refusal(sb, c.id), ['role'], [a.key, `accounts.${String(i)}`])
  })
})

describe('W00c RC4 every date is a calendar date', () => {
  const txCases = accountCases.flatMap(([label, x]) => {
    const { tx } = plainMonth(x.c, x.a)
    const index = x.c.key.transactions.indexOf(tx)
    return badDates(tx.date).map((d): [string, string, string, { c: WalkClient; id: string; index: number; value: string }] => [label, tx.id, d.label, { c: x.c, id: tx.id, index, value: d.value }])
  })
  test.each(txCases)('ARC-8 %s transaction %s dated with %s is refused, naming the date and the transaction', async (_l, _id, _d, { c, id, index, value }) => {
    sb.editKey(c, (k) => {
      const t = k.transactions[index]
      if (t?.id !== id) throw new Error(`fixture: transaction ${id} moved`)
      t.date = value
    })
    expectNamedOneOf(await refusal(sb, c.id), ['date'], [id, `transactions.${String(index)}`])
  })

  const entryCases = withEntries.flatMap((c) =>
    full(c.key).adjustingEntries.flatMap((j, index) =>
      badDates(j.date).map((d): [string, string, string, { c: WalkClient; id: string; index: number; value: string }] => [c.id, j.id, d.label, { c, id: j.id, index, value: d.value }]),
    ),
  )
  test.each(entryCases)('ARC-8 %s adjusting entry %s dated with %s is refused, naming the date and the entry', async (_l, _id, _d, { c, id, index, value }) => {
    sb.editKey(c, (k) => {
      const j = full(k).adjustingEntries[index]
      if (j?.id !== id) throw new Error(`fixture: entry ${id} moved`)
      j.date = value
    })
    expectNamedOneOf(await refusal(sb, c.id), ['date'], [id, `adjustingEntries.${String(index)}`])
  })

  const yearCases = clients.flatMap((c) =>
    (['start', 'end'] as const).flatMap((field) =>
      badDates(c.key.fiscalYear[field]).map((d): [string, string, string, { c: WalkClient; field: 'start' | 'end'; value: string }] => [c.id, field, d.label, { c, field, value: d.value }]),
    ),
  )
  test.each(yearCases)('ARC-8 %s fiscal year %s written with %s is refused, naming the fiscal year date', async (_l, _f, _d, { c, field, value }) => {
    sb.editKey(c, (k) => {
      k.fiscalYear[field] = value
    })
    expectNamedOneOf(await refusal(sb, c.id), [], [`fiscalYear.${field}`, field === 'start' ? 'yearStart' : 'yearEnd'])
  })
})

describe('W00c RC4 an account file is a regular CSV file in its own subfolder (every account of every folder)', () => {
  type FileCase = { c: WalkClient; a: RawAccount; i: number; field: 'file' | 'qboFile'; value: string; plant?: string }
  const fileCases: [string, string, string, FileCase][] = accountCases.flatMap(([label, x]) => {
    const own = { file: 'accounts', qboFile: 'qbo' } as const
    return (['file', 'qboFile'] as const).flatMap((field) => {
      const other = field === 'file' ? x.a.qboFile : x.a.file
      const txt = `${own[field]}/x-(Test).txt`
      const values: { what: string; value: string; plant?: string }[] = [
        { what: 'empty', value: '' },
        { what: `the folder "${own[field]}"`, value: own[field] },
        { what: 'answer-key.json', value: 'answer-key.json' },
        { what: `a text file "${txt}"`, value: txt, plant: txt },
        { what: `the ${field === 'file' ? 'qboFile' : 'file'} CSV "${other}"`, value: other },
      ]
      return values.map((v): [string, string, string, FileCase] => [label, field, v.what, { ...x, field, value: v.value, ...(v.plant === undefined ? {} : { plant: v.plant }) }])
    })
  })

  test.each(fileCases)("ARC-8 %s %s set to %s is refused with a 'file' issue naming the account and the field", async (_l, _f, _w, { c, a, i, field, value, plant }) => {
    if (plant !== undefined) planter.newFile(c, plant, 'Date,Description,Amount\n')
    sb.editKey(c, (k) => {
      const acc = k.accounts[i]
      if (acc?.key !== a.key) throw new Error(`fixture: account ${a.key} moved`)
      acc[field] = value
    })
    expectNamed(await refusal(sb, c.id), 'file', [a.key, field])
  })
})

describe('W00c RC4 a client JSON file that is a directory or not JSON is a LoadIssue (every folder)', () => {
  const names = ['answer-key.json', 'onboarding.json'] as const
  const cases = clients.flatMap((c) => names.map((name): [string, string, WalkClient] => [c.id, name, c]))

  test.each(cases)("ARC-8 %s with %s replaced by a directory is refused with a 'file' issue naming the file, never a raw EISDIR", async (_l, name, c) => {
    planter.directoryFor(c, name)
    expectNamed(await refusal(sb, c.id), 'file', [name])
  })

  test.each(cases)("ARC-8 %s with %s cut to its first half (malformed JSON) is refused with a 'file' issue naming the file, never a raw SyntaxError", async (_l, name, c) => {
    const text = readFileSync(sb.path(c, name), 'utf8')
    planter.replaceText(c, name, text.slice(0, Math.floor(text.length / 2)))
    expectNamed(await refusal(sb, c.id), 'file', [name])
  })
})
