// W00c acceptance tests (round 3), RC-C: every reference resolves, not only the ones someone listed
// (reports/W00c-findings-3.md, fix 5; Lead directive A450).
//
// The reference paths come from this file's walk over every string leaf of every answer key: an id-shaped value
// (two-digit client number, a tag of two to four capitals, a dash) outside transactions[].id and adjustingEntries[].id,
// carried subtrees included. For each path the first folder that has it and its first leaf there are planted.
//
// What the W00c round 3 build does: one walk over every string leaf of the answer key. A value starting
// ^\d\d-[A-Z]{2,4}- (outside transactions[].id) must be a whole id, agree with the idRule (folder number, account tag,
// month) and resolve to a transaction of this client; ^\d\d-AJE- resolves to an adjusting entry of this client. Every
// onboarding evidence path (flags, Schedule 1 add-backs, adjusting entries) goes through one resolves() that walks a
// dotted path own key by own key ("corporation.financial_year_end"), beside the "(...)" qualifier and the answers'
// question_asked ids it reads today. Each refusal is a LoadIssue whose record or reason names the planted value or
// the JSON path of the leaf ("answer-key.json flags.0.evidence.transactions.0").
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import {
  AJE_ID,
  TX_ID,
  dotted,
  expectSome,
  firstByGeneric,
  isReference,
  load,
  mentions,
  refused,
  setLeaf,
  show,
  type Leaf,
} from '../model/__fixtures__/w00c-r3-walk'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const firsts = [...firstByGeneric(clients, isReference)].sort(([a], [b]) => (a < b ? -1 : 1))
const txIdsOf = (c: WalkClient): Set<string> => new Set(c.key.transactions.map((t) => t.id))
const ajeIdsOf = (c: WalkClient): Set<string> => new Set(c.key.adjustingEntries.map((j) => j.id))

/** The three wrong values for one reference: an unknown id of the right shape, another client's id, a broken id. */
function wrongValues(c: WalkClient, value: string): { label: string; value: string }[] {
  const tx = TX_ID.exec(value)
  const aje = AJE_ID.exec(value)
  if (tx === null && aje === null) throw new Error(`fixture: ${c.id} reference "${value}" is not a whole id today`)
  const other = clients.find((o) => o.id !== c.id && (aje === null ? o.key.transactions.length > 0 : o.key.adjustingEntries.length > 0)) as WalkClient
  if (tx !== null) {
    const unknown = `${tx[1] ?? ''}-${tx[2] ?? ''}-${tx[3] ?? ''}-${tx[4] ?? ''}-9999`
    expect(txIdsOf(c).has(unknown), `fixture: ${unknown} is not a transaction of ${c.id}`).toBe(false)
    return [
      { label: 'an unknown id of the right shape', value: unknown },
      { label: "another client's id", value: (other.key.transactions[0] as { id: string }).id },
      { label: 'a broken id', value: `${value}x` },
    ]
  }
  const unknown = `${aje?.[1] ?? ''}-AJE-99`
  expect(ajeIdsOf(c).has(unknown), `fixture: ${unknown} is not an adjusting entry of ${c.id}`).toBe(false)
  return [
    { label: 'an unknown id of the right shape', value: unknown },
    { label: "another client's id", value: (other.key.adjustingEntries[0] as { id: string }).id },
    { label: 'a broken id', value: `${value}x` },
  ]
}

describe('W00c RC-C the id walk finds the reference paths', () => {
  test('ARC-8 the walk finds the reference paths (16 on the spec probe: 13 to transactions, 3 to adjusting entries)', () => {
    expect(firsts.length).toBeGreaterThanOrEqual(16)
    const labels = firsts.map(([l]) => l)
    for (const must of ['answer-key.json transactions[].pair', 'answer-key.json transactions[].postedVia', 'answer-key.json transactions[].dupOf', 'answer-key.json flags[].evidence.transactions[]', 'answer-key.json ohip.raStatements[].depositTransaction', 'answer-key.json prior_year.balanceOwing.paidBy[]', 'answer-key.json ohip.accruedReceivable.adjustingEntry']) {
      expect(labels, `the walk reaches ${must}`).toContain(must)
    }
  })

  test('ARC-8 every reference and every transaction id agrees with the idRule and resolves in its own client today (the walk has no false alarm to raise)', () => {
    for (const c of clients) {
      const nn = c.id.slice(1)
      const tags = new Map((c.key.accounts as unknown as { key: string; tag: string }[]).map((a) => [a.key, a.tag]))
      for (const t of c.key.transactions) {
        const m = TX_ID.exec(t.id)
        expect(m !== null && m[1] === nn && m[2] === tags.get(t.acct) && `${m[3] ?? ''}-${m[4] ?? ''}` === t.date.slice(0, 7), `${c.id} ${t.id}`).toBe(true)
      }
    }
  })
})

describe('W00c RC-C each reference path refuses a wrong id', () => {
  test.each(firsts.map(([label, f]): [string, string, WalkClient, Leaf & { value: string }] => [label, f.c.id, f.c, f.leaf as Leaf & { value: string }]))(
    'ARC-8 %s (first in %s): an unknown id of the right shape, another client\'s id and a broken id are each refused',
    (_l, _c, c, leaf) => {
      for (const w of wrongValues(c, leaf.value)) {
        setLeaf(sb, c, leaf.file, leaf.path, w.value)
        const where = `${leaf.file} ${dotted(leaf.path)}`
        const issues = refused(sb, c, `${where} = ${w.value} (${w.label})`)
        expectSome(issues, (i) => mentions(i, w.value) || mentions(i, where), `${c.id} ${where} = ${w.value} (${w.label}): an issue naming the value or the path`)
        sb.restore()
      }
    },
    60_000,
  )
})

// ---- onboarding evidence paths ----

/** Onboarding evidence leaves of the answer key, by where they sit. */
function evidenceAt(c: WalkClient, where: 'flags' | 'addBacks' | 'adjustingEntries'): { path: (string | number)[]; value: string }[] {
  const out: { path: (string | number)[]; value: string }[] = []
  const k = c.key as unknown as {
    flags: { evidence?: { onboarding?: string[] } }[]
    adjustingEntries: { source: { onboarding: string[] } }[]
    t2Inputs?: { schedule1?: { addBacks?: { source?: { onboarding?: string[] } }[] } }
  }
  const add = (path: (string | number)[], vs: string[] | undefined): void => {
    for (const [j, v] of (vs ?? []).entries()) out.push({ path: [...path, j], value: v })
  }
  if (where === 'flags') for (const [i, f] of k.flags.entries()) add(['flags', i, 'evidence', 'onboarding'], f.evidence?.onboarding)
  if (where === 'adjustingEntries') for (const [i, e] of k.adjustingEntries.entries()) add(['adjustingEntries', i, 'source', 'onboarding'], e.source.onboarding)
  if (where === 'addBacks') for (const [i, a] of (k.t2Inputs?.schedule1?.addBacks ?? []).entries()) add(['t2Inputs', 'schedule1', 'addBacks', i, 'source', 'onboarding'], a.source?.onboarding)
  return out
}

const isAnswerId = (c: WalkClient, v: string): boolean => {
  const answers = c.onboarding['answers']
  return Array.isArray(answers) && answers.some((a) => (a as { question_asked?: unknown }).question_asked === v)
}
/** This file's own own-key walk of a dotted onboarding path. */
function walksTo(o: unknown, dottedPath: string): boolean {
  let cur: unknown = o
  for (const k of dottedPath.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, k)) return false
    cur = (cur as Record<string, unknown>)[k]
  }
  return true
}

describe('W00c RC-C onboarding evidence paths resolve own key by own key', () => {
  test('END-9 the dotted evidence paths of C14 and C15 (8 on the spec probe) each walk to an onboarding key, and both folders load', () => {
    const dottedRefs = clients
      .filter((c) => c.id === 'C14' || c.id === 'C15')
      .flatMap((c) => (['flags', 'addBacks', 'adjustingEntries'] as const).flatMap((w) => evidenceAt(c, w).map((e) => ({ c, ...e }))))
      .filter((e) => e.value.includes('.') && !e.value.includes('(') && !isAnswerId(e.c, e.value))
    expect(dottedRefs).toHaveLength(8)
    for (const e of dottedRefs) expect(walksTo(e.c.onboarding, e.value), `${e.c.id} ${e.value}`).toBe(true)
    for (const c of clients.filter((x) => x.id === 'C14' || x.id === 'C15')) {
      const r = load(sb, c)
      expect(r.ok, `${c.id} loads: ${r.ok ? '' : show(r.issues)}`).toBe(true)
    }
  })

  test('ARC-8 C14: a dotted evidence path to a missing key, to an inherited key and under a missing top key is each refused, naming the path', () => {
    const c14 = clients.find((c) => c.id === 'C14') as WalkClient
    const first = evidenceAt(c14, 'flags').find((e) => e.value.includes('.') && !e.value.includes('('))
    if (first === undefined) throw new Error('fixture: C14 has no dotted evidence path')
    for (const bad of ['corporation.no_such_key_test', 'corporation.toString', 'no_such_top_test.financial_year_end']) {
      setLeaf(sb, c14, 'answer-key.json', first.path, bad)
      expectSome(refused(sb, c14, `evidence "${bad}"`), (i) => mentions(i, bad), `an issue naming "${bad}"`)
      sb.restore()
    }
  })

  test.each([['flags'], ['addBacks'], ['adjustingEntries']] as const)(
    'ARC-8 the first onboarding evidence path of %s in the first folder that has one, pointed at a key onboarding.json does not have, is refused naming it',
    (where) => {
      const hit = clients.map((c) => ({ c, e: evidenceAt(c, where)[0] })).find((x) => x.e !== undefined)
      if (hit?.e === undefined) throw new Error(`fixture: no folder has onboarding evidence in ${where}`)
      const bad = 'no_such_onboarding_key_test'
      setLeaf(sb, hit.c, 'answer-key.json', hit.e.path, bad)
      expectSome(refused(sb, hit.c, `${where} evidence "${bad}"`), (i) => mentions(i, bad), `an issue naming "${bad}"`)
    },
  )
})
