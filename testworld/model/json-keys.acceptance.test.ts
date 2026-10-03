// W00c acceptance tests (round 2), RC5: a repeated JSON key is refused, never silently resolved last-wins
// (reports/W00c-findings.md, fix 5 and "Acceptance tests for the spec writer").
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts and
// w00c-walk.ts), never from a typed list. Each plant writes the file's text by hand so that the first copy of the
// key is a harmless decoy and the last copy is the real value: JSON.parse (last wins) loads it today.
//
// What the W00c round 2 build does: answer-key.json and onboarding.json are scanned before JSON.parse for a key
// that appears twice in any one object (keys compared after JSON string escapes are decoded); a repeat is a 'file'
// issue naming the file and the key. Equal keys in different objects are fine, and text inside a string value is
// never a key.
//
// Spec review 3, gap 3: the repeat is refused at any depth, not only at the three typed positions. The scanner itself is
// a pure function exported from testworld/clients/json-keys.ts (W00b imports it); its own walk over every object node
// is in testworld/clients/json-keys.acceptance.test.ts. Here the loader is driven on a pinned-seed sample: in every
// folder, for both files, one object node per depth present (fast-check seed 20261003).
import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, expectLoads, markersOf, refusal, walkClients, type RawTx, type WalkClient } from './__fixtures__/sample-walk'
import { Planter, expectNamed, objectNodes, repeatFirstKey, sampleNodes, type ObjectNode } from './__fixtures__/w00c-walk'

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

const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const HOLE = '"__W00C_HOLE_(Test)__"'
const readJson = (c: WalkClient, name: string): Record<string, unknown> => JSON.parse(readFileSync(sb.path(c, name), 'utf8')) as Record<string, unknown>

/**
 * Writes the file with one value replaced by hand-written JSON text: `place` swaps the value for a marker string in the
 * parsed copy, and the marker in the serialised text is then replaced by `text`.
 */
function writeWith(c: WalkClient, name: string, place: (j: Record<string, unknown>) => string): void {
  const j = readJson(c, name)
  const text = place(j)
  const out = JSON.stringify(j, null, 2).replace(HOLE, () => text)
  if (out === JSON.stringify(j, null, 2)) throw new Error('fixture: the hole was not placed')
  planter.replaceText(c, name, out + '\n')
}

/** An object's JSON text with `prefix` (a hand-written `"key": value` pair) written before its own keys. */
const withLeading = (o: unknown, prefix: string): string => `{${prefix}, ${JSON.stringify(o).slice(1)}`

const plainTx = (c: WalkClient): { tx: RawTx; index: number } => {
  const index = c.key.transactions.findIndex((t) => markersOf(t).length === 0)
  const tx = c.key.transactions[index]
  if (tx === undefined) throw new Error(`fixture: ${c.id} has no unmarked transaction`)
  return { tx, index }
}
const withStatements = clients.filter((c) => Object.keys(c.key.statementBalances).length > 0)
const withTransactions = clients.filter((c) => c.key.transactions.length > 0)

describe('W00c RC5 the walk', () => {
  test('ARC-8 the walk finds statement balances, transactions and a first onboarding key to repeat', () => {
    expect(withStatements.length).toBeGreaterThan(0)
    expect(withTransactions.length).toBeGreaterThan(0)
    for (const c of clients) expect(Object.keys(c.onboarding).length, c.id).toBeGreaterThan(0)
  })

  test.each(byId(clients))('END-9 %s loads unchanged (equal keys in different objects are not repeats)', async (_l, c) => {
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC5 a repeated key in one object is refused (every folder)', () => {
  test.each(byId(withStatements))("ARC-8 %s with its first statementBalances key written twice (an empty decoy first) is refused with a 'file' issue naming answer-key.json and the key", async (_l, c) => {
    const key = Object.keys(c.key.statementBalances)[0] ?? ''
    writeWith(c, 'answer-key.json', (j) => {
      const sbs = j['statementBalances']
      j['statementBalances'] = HOLE.slice(1, -1)
      return withLeading(sbs, `${JSON.stringify(key)}: []`)
    })
    expectNamed(await refusal(sb, c.id), 'file', ['answer-key.json', key])
  })

  test.each(byId(withTransactions))("ARC-8 %s with one transaction's amount written twice (a zero decoy first) is refused with a 'file' issue naming answer-key.json and amount", async (_l, c) => {
    const { index } = plainTx(c)
    writeWith(c, 'answer-key.json', (j) => {
      const txs = j['transactions'] as unknown[]
      const t = txs[index]
      txs[index] = HOLE.slice(1, -1)
      return withLeading(t, '"amount": 0')
    })
    expectNamed(await refusal(sb, c.id), 'file', ['answer-key.json', 'amount'])
  })

  test.each(byId(withTransactions))("ARC-8 %s with a repeated transaction key written with a unicode escape (\"am\\u006funt\") is refused with a 'file' issue naming answer-key.json and amount", async (_l, c) => {
    const { index } = plainTx(c)
    writeWith(c, 'answer-key.json', (j) => {
      const txs = j['transactions'] as unknown[]
      const t = txs[index]
      txs[index] = HOLE.slice(1, -1)
      return withLeading(t, '"am\\u006funt": 0')
    })
    expectNamed(await refusal(sb, c.id), 'file', ['answer-key.json', 'amount'])
  })

  test.each(byId(clients))("ARC-8 %s with the first top-level key of onboarding.json written twice (an empty decoy first) is refused with a 'file' issue naming onboarding.json and the key", async (_l, c) => {
    const key = Object.keys(c.onboarding)[0] ?? ''
    const o = readJson(c, 'onboarding.json')
    const decoy = Array.isArray(o[key]) ? '[]' : typeof o[key] === 'object' && o[key] !== null ? '{}' : '""'
    planter.replaceText(c, 'onboarding.json', withLeading(o, `${JSON.stringify(key)}: ${decoy}`) + '\n')
    expectNamed(await refusal(sb, c.id), 'file', ['onboarding.json', key])
  })
})

describe('W00c RC5 text inside a string value is never a key (every folder with transactions)', () => {
  test.each(byId(withTransactions))('ARC-8 %s with a description holding escaped quotes around a key name and a trailing backslash still loads', async (_l, c) => {
    const { index } = plainTx(c)
    writeWith(c, 'answer-key.json', (j) => {
      const txs = j['transactions'] as Record<string, unknown>[]
      const t = txs[index]
      if (t === undefined) throw new Error('fixture: no transaction')
      t['description'] = 'x", "amount": 1, "id": "y (Test)'
      t['notes'] = ['a\\', '"amount": 2 \\" "id": 3 (Test)']
      txs[index] = HOLE.slice(1, -1) as unknown as Record<string, unknown>
      return JSON.stringify(t)
    })
    await expectLoads(sb, c.id)
  })
})

describe('W00c RC5 a repeated key at any depth is refused by the loader (spec review 3, gap 3: every folder, both files, one node per depth)', () => {
  const SEED = 20261003
  const pick = (n: number, seed: number): number => fc.sample(fc.integer({ min: 0, max: n - 1 }), { seed, numRuns: 1 })[0] ?? 0
  const FILES = ['answer-key.json', 'onboarding.json'] as const
  const raw = (c: WalkClient, name: string): unknown => JSON.parse(readFileSync(sb.path(c, name), 'utf8')) as unknown
  const cases = clients.flatMap((c, ci) =>
    FILES.flatMap((name) =>
      sampleNodes(objectNodes(raw(c, name)), SEED + ci * 100, 0, pick).map((n): [string, string, number, string, { c: WalkClient; n: ObjectNode }] => [
        c.id,
        name,
        n.depth,
        n.path.join('.') || '(root)',
        { c, n },
      ]),
    ),
  )

  test('ARC-8 the sample takes one node per depth present in each file of each folder, the root included', () => {
    for (const c of clients) {
      for (const name of FILES) {
        const depths = new Set(objectNodes(raw(c, name)).map((n) => n.depth))
        const sampled = cases.filter(([id, file]) => id === c.id && file === name).map(([, , d]) => d)
        expect(new Set(sampled), `${c.id} ${name}`).toEqual(depths)
        expect(sampled, `${c.id} ${name}`).toContain(0)
      }
    }
  })

  test.each(cases)("ARC-8 %s %s at depth %i, the object at %s written with its first key twice (a decoy first), is refused with a 'file' issue naming the file and the key", async (_l, name, _d, _p, { c, n }) => {
    const { text, key } = repeatFirstKey(raw(c, name), n.path)
    expect(key).toBe(n.firstKey)
    planter.replaceText(c, name, text)
    expectNamed(await refusal(sb, c.id), 'file', [name, key])
  })
})
