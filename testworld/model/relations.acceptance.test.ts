// W00a acceptance tests, part 3 of 3: relations and paths (findings W00 r2 RC2, S7).
//
// Every case comes from a walk over all numbered folders of reference/sample-clients/ (testworld/model/__fixtures__/
// sample-walk.ts), never from a typed list.
//
// What the loader checks (the W00a build adds these):
//   Adjusting entry sources resolve. A transaction source is the id of a transaction in the same answer key.
//   An onboarding source names a top-level key of the client's onboarding.json (the text before any " (note)",
//   as in "prior_year_closing_balances (1200 Prepaid expenses)") or the question_asked id of an entry in its
//   `answers` list (C12: "FL:96", "YE1.vehicle", "BQ2.earn"); a value that merely appears elsewhere is not an id.
//   An unresolved source is an 'adjusting-entry' issue: record the entry id, reason containing the source text.
//   Account files stay inside the client folder: an account's `file` or `qboFile` that is absolute or leads out
//   of the folder ("../<another client>/accounts/x.csv", which exists) is refused before it is read.
//   A file that is not there is a LoadIssue, never a raw ENOENT: the loader throws TestWorldLoadError.
//   Both are check 'file' (new LoadCheck); record or reason names the account key or the path, or the file name
//   ("onboarding.json") for a client file.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import {
  Sandbox,
  expectIssueWith,
  onboardingTarget,
  refusal,
  walkClients,
  type Issue,
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

const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const withTxSources = clients.filter((c) => c.key.adjustingEntries.some((j) => j.source.transactions.length > 0))
const withEntries = clients.filter((c) => c.key.adjustingEntries.length > 0)
const withAccounts = clients.filter((c) => c.key.accounts.length > 0)
const onboardingSources: [string, { c: WalkClient; source: string }][] = clients.flatMap((c) =>
  [...new Set(c.key.adjustingEntries.flatMap((j) => j.source.onboarding))].map((source): [string, { c: WalkClient; source: string }] => [
    `${c.id} "${source}"`,
    { c, source },
  ]),
)

/** Some 'file' issue names the account key or the path. */
function expectFileIssue(issues: Issue[], ...names: string[]): void {
  const hit = issues.some((i) => i.check === 'file' && names.some((n) => `${i.record} ${i.reason}`.includes(n)))
  expect(hit, `expected a "file" issue naming ${names.join(' or ')}; got ${JSON.stringify(issues)}`).toBe(true)
}

describe('W00a S7 the walk', () => {
  test('ARC-8 the walk finds entries with transaction sources, entries with onboarding sources, and every onboarding source resolves in the real data', () => {
    expect(withTxSources.length).toBeGreaterThan(0)
    expect(onboardingSources.length).toBeGreaterThan(0)
    for (const [label, { c, source }] of onboardingSources) expect(onboardingTarget(c.onboarding, source), label).toBeDefined()
    for (const c of clients) {
      const ids = new Set(c.key.transactions.map((t) => t.id))
      for (const j of c.key.adjustingEntries) for (const s of j.source.transactions) expect(ids.has(s), `${c.id} ${j.id} ${s}`).toBe(true)
    }
  })
})

describe('W00a S7 adjusting entry sources resolve', () => {
  test.each(byId(withTxSources))('ARC-8 %s with each entry\'s first transaction source pointing at no transaction is refused, naming the entry and the source', async (_l, c) => {
    const broken = c.key.adjustingEntries
      .filter((j) => j.source.transactions.length > 0)
      .map((j) => ({ id: j.id, source: `${String(j.source.transactions[0])}-GONE` }))
    sb.editKey(c, (k) => {
      for (const j of k.adjustingEntries) {
        const b = broken.find((x) => x.id === j.id)
        if (b !== undefined) j.source.transactions[0] = b.source
      }
    })
    const issues = await refusal(sb, c.id)
    for (const b of broken) expectIssueWith(issues, 'adjusting-entry', [b.id], [b.source])
  })

  test.each(byId(withEntries))('ARC-8 %s with an onboarding source "nope" on its first entry is refused, naming the entry and the source', async (_l, c) => {
    const first = c.key.adjustingEntries[0]
    if (first === undefined) throw new Error('fixture: no entry')
    sb.editKey(c, (k) => {
      k.adjustingEntries[0]?.source.onboarding.push('nope')
    })
    expectIssueWith(await refusal(sb, c.id), 'adjusting-entry', [first.id], ['nope'])
  })

  test.each(onboardingSources)('ARC-8 %s: with what it names taken out of onboarding.json, every entry citing it is refused, naming the entry and the source', async (_l, { c, source }) => {
    const target = onboardingTarget(c.onboarding, source)
    if (target === undefined) throw new Error(`fixture: ${c.id} source "${source}" resolves to nothing (report to the Lead)`)
    sb.editOnboarding(c, (o) => {
      if (target.kind === 'key') {
        // A real removal, so the client's other checks see the same file less one key.
        Reflect.deleteProperty(o, target.key)
      } else {
        const answers = o['answers']
        if (!Array.isArray(answers)) throw new Error('fixture: no answers')
        o['answers'] = answers.filter((x) => (x as { question_asked?: unknown }).question_asked !== target.id)
      }
    })
    const issues = await refusal(sb, c.id)
    const citing = c.key.adjustingEntries.filter((j) => j.source.onboarding.includes(source))
    expect(citing.length).toBeGreaterThan(0)
    for (const j of citing) expectIssueWith(issues, 'adjusting-entry', [j.id], [source])
  })
})

describe('W00a S7 account files stay inside the client folder', () => {
  const fields = ['file', 'qboFile'] as const
  const cases: [string, { c: WalkClient; field: (typeof fields)[number] }][] = withAccounts.flatMap((c) =>
    fields.map((field): [string, { c: WalkClient; field: (typeof fields)[number] }] => [`${c.id} ${field}`, { c, field }]),
  )

  test.each(cases)('ARC-8 %s leading out of the folder to another client\'s real file ("../<folder>/...") is refused for every account', async (_l, { c, field }) => {
    const others = withAccounts.filter((x) => x.id !== c.id)
    const other = others[0]
    const otherAccount = other?.key.accounts[0]
    if (other === undefined || otherAccount === undefined) throw new Error('fixture: no other client with accounts')
    const value = `../${other.folder}/${otherAccount[field]}`
    sb.editKey(c, (k) => {
      for (const a of k.accounts) a[field] = value
    })
    const issues = await refusal(sb, c.id)
    for (const a of c.key.accounts) expectFileIssue(issues, a.key, value)
    expect(issues.filter((i) => i.check === 'file').length).toBeGreaterThanOrEqual(c.key.accounts.length)
  })

  test.each(cases)('ARC-8 %s written as an absolute path to its own real file is refused for every account', async (_l, { c, field }) => {
    const values = new Map(c.key.accounts.map((a) => [a.key, sb.path(c, a[field])]))
    sb.editKey(c, (k) => {
      for (const a of k.accounts) a[field] = values.get(a.key) ?? ''
    })
    const issues = await refusal(sb, c.id)
    for (const a of c.key.accounts) expectFileIssue(issues, a.key, values.get(a.key) ?? a.key)
    expect(issues.filter((i) => i.check === 'file').length).toBeGreaterThanOrEqual(c.key.accounts.length)
  })

  test.each(cases)('ARC-8 %s missing from the folder gives a LoadIssue for every account, never a raw ENOENT', async (_l, { c, field }) => {
    for (const a of c.key.accounts) sb.remove(c, a[field])
    const issues = await refusal(sb, c.id)
    for (const a of c.key.accounts) expectFileIssue(issues, a.key, a[field])
    expect(issues.filter((i) => i.check === 'file').length).toBeGreaterThanOrEqual(c.key.accounts.length)
  })

  test.each(byId(clients))('ARC-8 %s with onboarding.json missing gives a LoadIssue naming the file, never a raw ENOENT', async (_l, c) => {
    sb.remove(c, 'onboarding.json')
    expectFileIssue(await refusal(sb, c.id), 'onboarding.json')
  })
})
