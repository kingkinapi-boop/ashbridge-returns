// W00d acceptance tests, RC-C: every transaction id and every reference to one follows the id rule (card W00d;
// reports/W00c-check.md item 1; A501).
//
// The id rule (each answer key's idRule): id = <client>-<TAG>-<YYYY>-<MM>-<seq>, where <client> is the folder's two
// digits, TAG is the tag of the transaction's account (accounts[].tag where key is its acct), and YYYY-MM is the month
// of the row's date. W00c's walk checks only that an id has the shape and exists; a transaction renamed together with
// every reference to it still resolved, so all three plants below loaded (load.ts:391 and :589-597 on W00c).
//
// What W00d's build does: the loader refuses a transaction id that disagrees with the rule, and so every reference to
// one, with a LoadIssue whose record or reason names the id. Each plant renames one transaction id AND every reference
// to it (the quoted id, everywhere in answer-key.json), so only the id rule can refuse it.
import { readFileSync, writeFileSync } from 'node:fs'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import { TX_ID, expectSome, load, mentions, refused, show } from '../model/__fixtures__/w00c-r3-walk'
import { tagsOf } from '../model/__fixtures__/w00d-fields'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const SLOW = 120_000

/** Renames one transaction id and every quoted reference to it in the sandbox copy of answer-key.json; returns how many were written. */
function renameEverywhere(c: WalkClient, from: string, to: string): number {
  sb.editKey(c, () => undefined)
  const p = sb.path(c, 'answer-key.json')
  const text = readFileSync(p, 'utf8')
  const parts = text.split(JSON.stringify(from))
  writeFileSync(p, parts.join(JSON.stringify(to)))
  return parts.length - 1
}

/** The three wrong forms of the findings for one id: another folder's number, a tag no account has, a month that is not the row's. */
function wrongForms(c: WalkClient, id: string): { label: string; value: string }[] {
  const m = TX_ID.exec(id)
  if (m === null) throw new Error(`fixture: ${id} is not a transaction id`)
  const [, nn, tag, , , seq] = m as unknown as [string, string, string, string, string, string]
  const other = nn === '05' ? '01' : '05'
  const ids = new Set(c.key.transactions.map((t) => t.id))
  const forms = [
    { label: "another folder's number", value: `${other}-${tag}-${m[3] ?? ''}-${m[4] ?? ''}-${seq}` },
    { label: 'a tag no account of the client has', value: `${nn}-ZZZ-${m[3] ?? ''}-${m[4] ?? ''}-${seq}` },
    { label: "a month that is not the row's", value: `${nn}-${tag}-2031-07-0099` },
  ]
  for (const f of forms) expect(ids.has(f.value), `fixture: ${f.value} is not already an id of ${c.id}`).toBe(false)
  return forms
}

/** Count of quoted references to an id in the parsed answer key (the id itself included). */
function quoted(c: WalkClient, id: string): number {
  return JSON.stringify(c.key).split(JSON.stringify(id)).length - 1
}

describe('W00d RC-C the id rule holds today (no false alarm to raise)', () => {
  test('ARC-8 every transaction id of every folder agrees with its folder number, its account\'s tag and its month, and the tag is not ZZZ', () => {
    let n = 0
    for (const c of clients) {
      const tags = new Map(tagsOf(c).map((a) => [a.key, a.tag]))
      expect([...tags.values()]).not.toContain('ZZZ')
      for (const t of c.key.transactions) {
        const m = TX_ID.exec(t.id)
        expect(m !== null && m[1] === c.id.slice(1) && m[2] === tags.get(t.acct) && `${m[3] ?? ''}-${m[4] ?? ''}` === t.date.slice(0, 7), `${c.id} ${t.id}`).toBe(true)
        n++
      }
    }
    expect(n).toBeGreaterThan(1000)
  })
})

describe("W00d RC-C C01's 01-CHQ-2025-01-0027 renamed with its references is refused by name (reports/W00c-check.md item 1)", () => {
  const c01 = clients.find((c) => c.id === 'C01') as WalkClient
  const ID = '01-CHQ-2025-01-0027'

  test('ARC-8 C01 writes 01-CHQ-2025-01-0027 on a CHQ row of January 2025, with references to it (three quoted copies today)', () => {
    const t = c01.key.transactions.find((x) => x.id === ID)
    expect(t?.acct).toBe('CHQ')
    expect(t?.date.slice(0, 7)).toBe('2025-01')
    expect(quoted(c01, ID)).toBeGreaterThanOrEqual(2)
  })

  test.each([
    ['05-CHQ-2025-01-0027', 'the folder number is not 01'],
    ['01-ZZZ-2025-01-0027', 'ZZZ is not the tag of the CHQ account'],
    ['01-CHQ-2031-07-0099', 'the row is dated January 2025'],
  ])('ARC-8 C01: 01-CHQ-2025-01-0027 and every reference to it renamed %s is refused, naming the id (%s)', (to) => {
    expect(renameEverywhere(c01, ID, to)).toBeGreaterThanOrEqual(2)
    const issues = refused(sb, c01, `${ID} renamed ${to} with its references`)
    expectSome(issues, (i) => mentions(i, to), `an issue naming ${to}`)
  }, SLOW)
})

describe('W00d RC-C by class: in every folder with transactions, a referenced transaction renamed with its references is refused', () => {
  /** The first transaction of the folder that something else in the answer key refers to, else its first transaction. */
  const target = (c: WalkClient): string => {
    const referenced = c.key.transactions.find((t) => quoted(c, t.id) >= 2)
    return (referenced ?? c.key.transactions[0])?.id ?? ''
  }
  const cases = clients.filter((c) => c.key.transactions.length > 0).flatMap((c) => wrongForms(c, target(c)).map((f): [string, string, string, string, WalkClient] => [c.id, target(c), f.value, f.label, c]))

  test('ARC-8 every folder with transactions gives three plants (C12 has none)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(14 * 3)
  })

  test.each(cases)('ARC-8 %s: %s renamed %s (%s) with every reference to it is refused, naming the id', (_id, from, to, _label, c) => {
    expect(renameEverywhere(c, from, to)).toBeGreaterThanOrEqual(1)
    const issues = refused(sb, c, `${from} renamed ${to} with its references`)
    expectSome(issues, (i) => mentions(i, to), `${c.id}: an issue naming ${to}`)
  }, SLOW)

  test.each(clients.filter((c) => c.key.transactions.length > 0).map((c): [string, WalkClient] => [c.id, c]))('ARC-8 %s: the same rename put back to the right id loads (the plant alone is what is refused)', (_id, c) => {
    const from = target(c)
    renameEverywhere(c, from, from)
    const r = load(sb, c)
    expect(r.ok, `${c.id}: ${r.ok ? '' : show(r.issues)}`).toBe(true)
  }, SLOW)
})
