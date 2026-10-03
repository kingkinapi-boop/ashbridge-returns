// W00c acceptance tests (round 2), RC4: file checks look at what a name resolves to, not at the written name
// (reports/W00c-findings.md, fix 4 and "Acceptance tests for the spec writer").
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plants one link in a temp copy and loads through the public loader.
//
// What the W00c round 2 build does (guardFiles, W00b's region, is not touched):
//   answer-key.json and onboarding.json are read only when they are regular files themselves (lstat): a link is a
//   'file' issue naming the file, even when it leads to a valid copy.
//   An account file: its real path, relative to the client folder's real path, must itself be `<dir>/<name>.csv`
//   (accounts/ for `file`, qbo/ for `qboFile`) and a regular file; otherwise a 'file' issue naming the account key
//   and the field. A link inside the same subfolder to one of its own CSVs is still fine (load-files.test.ts).
//   A client folder that is itself a link (lstat) is not listed by clientFolders, and loading its id is a
//   TestWorldLoadError with a 'file' issue naming the folder (spec review 3, gap 2; amber: "refused by clientFolders"
//   read as "not listed", since the other folders must still list); every other folder still lists and loads.
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { clientFolders } from '../index'
import { Sandbox, expectLoads, refusal, walkClients, type RawAccount, type WalkClient } from './__fixtures__/sample-walk'
import { Planter, expectNamed } from './__fixtures__/w00c-walk'

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
const base = (rel: string): string => rel.slice(rel.lastIndexOf('/') + 1)

/** Points the account's field at a new name in the copy's answer key. */
function point(c: WalkClient, a: RawAccount, i: number, field: 'file' | 'qboFile', name: string): void {
  sb.editKey(c, (k) => {
    const acc = k.accounts[i]
    if (acc?.key !== a.key) throw new Error(`fixture: account ${a.key} moved`)
    acc[field] = name
  })
}

describe('W00c RC4 the walk', () => {
  test('ARC-8 the walk finds account files under accounts/ and qbo/ in every folder with accounts', () => {
    expect(accountCases.length).toBeGreaterThan(0)
    for (const [label, { a }] of accountCases) {
      expect(a.file, label).toMatch(/^accounts\/[^/]+\.csv$/)
      expect(a.qboFile, label).toMatch(/^qbo\/[^/]+\.csv$/)
    }
  })
})

describe('W00c RC4 an account file is checked where it resolves (every account of every folder)', () => {
  test.each(accountCases)("ARC-8 %s file set to accounts/zz-(Test).csv, a link to ../answer-key.json, is refused with a 'file' issue naming the account and the field", async (_l, { c, a, i }) => {
    planter.link(c, 'accounts/zz-(Test).csv', '../answer-key.json')
    point(c, a, i, 'file', 'accounts/zz-(Test).csv')
    expectNamed(await refusal(sb, c.id), 'file', [a.key, 'file'])
  })

  test.each(accountCases)("ARC-8 %s file set to accounts/x-(Test).csv, a link to its own qbo CSV, is refused with a 'file' issue naming the account and the field", async (_l, { c, a, i }) => {
    planter.link(c, 'accounts/x-(Test).csv', `../${a.qboFile}`)
    point(c, a, i, 'file', 'accounts/x-(Test).csv')
    expectNamed(await refusal(sb, c.id), 'file', [a.key, 'file'])
  })

  test.each(accountCases)("ARC-8 %s qboFile set to qbo/x-(Test).csv, a link to its own accounts CSV, is refused with a 'file' issue naming the account and the field", async (_l, { c, a, i }) => {
    planter.link(c, 'qbo/x-(Test).csv', `../${a.file}`)
    point(c, a, i, 'qboFile', 'qbo/x-(Test).csv')
    expectNamed(await refusal(sb, c.id), 'file', [a.key, 'qboFile'])
  })

  test.each(accountCases)('ARC-8 %s file set to accounts/inside-(Test).csv, a link to its own CSV in the same folder, still loads', async (_l, { c, a, i }) => {
    planter.link(c, 'accounts/inside-(Test).csv', base(a.file))
    point(c, a, i, 'file', 'accounts/inside-(Test).csv')
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC4 a subfolder that is itself a link is refused for every account file in it (every folder with accounts)', () => {
  const cases = withAccounts.flatMap((c) => (['accounts', 'qbo'] as const).map((dir): [string, 'accounts' | 'qbo', WalkClient] => [c.id, dir, c]))

  test.each(cases)("ARC-8 %s with %s/ a link to a renamed copy of itself is refused with a 'file' issue for every account, naming the field", async (_l, dir, c) => {
    planter.folderAsLink(c, dir)
    const issues = await refusal(sb, c.id)
    const field = dir === 'accounts' ? 'file' : 'qboFile'
    for (const a of c.key.accounts) expectNamed(issues, 'file', [a.key, field])
  })
})

describe('W00c RC4 the client JSON files are regular files, never links (every folder)', () => {
  const cases = clients.flatMap((c) => (['answer-key.json', 'onboarding.json'] as const).map((name): [string, string, WalkClient] => [c.id, name, c]))

  test.each(cases)("ARC-8 %s with %s a link to a byte-for-byte copy outside the folder is refused with a 'file' issue naming the file", async (_l, name, c) => {
    planter.linkToOutsideCopy(c, name)
    expectNamed(await refusal(sb, c.id), 'file', [name])
  })

  test.each(byId(clients))('END-9 %s loads unchanged (no link anywhere in the sample folders)', async (_l, c) => {
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC4 a client folder that is itself a link is refused (spec review 3, gap 2: every folder)', () => {
  test.each(byId(clients))("ARC-8 %s with its client folder a link to a renamed copy beside it is not listed by clientFolders, and its load is refused with a 'file' issue naming the folder", async (_l, c) => {
    planter.clientFolderAsLink(c)
    const listed = clientFolders(sb.root)
    expect(listed.has(c.id as `C${string}`), `${c.id} is a link and must not be listed`).toBe(false)
    expect(listed.size).toBe(clients.length - 1)
    for (const o of clients.filter((x) => x !== c)) expect(listed.get(o.id as `C${string}`), o.id).toBe(join(sb.root, o.folder))
    expectNamed(await refusal(sb, c.id), 'file', [c.folder])
  })

  test.each(byId(clients))('END-9 with %s a linked client folder, every other folder still loads', async (_l, c) => {
    planter.clientFolderAsLink(c)
    for (const o of clients.filter((x) => x !== c)) await expectLoads(sb, o.id)
   }, 30_000)
})
