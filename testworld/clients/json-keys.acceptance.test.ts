// W00c acceptance tests (round 2 spec patch, reports/W00c-spec-review-3.md gap 3): the repeated-key scanner is a pure
// function exported from testworld/clients/json-keys.ts, so W00b (kind .json files) imports the same one.
//
// What the W00c round 2 build provides:
//   `repeatedKeys(text: string): readonly { key: string }[]` (more fields allowed): every key written twice in one
//   object of the JSON text, at any depth, compared after JSON string escapes are decoded; [] when there is none. Equal
//   keys in different objects are not repeats, and text inside a string value is never a key. The loader turns each one
//   into a 'file' issue naming the file and the key (testworld/model/json-keys.acceptance.test.ts).
//
// Every case comes from the walk over all numbered folders of reference/sample-clients/ (sample-walk.ts), never from a
// typed list: every object node of every onboarding.json, and in every answer-key.json one node per depth present plus
// 30 more, picked with fast-check seed 20261003. The module is loaded by a dynamic import so the suite type-checks before
// the build; until then each test fails with "Cannot find module".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { SAMPLE_ROOT, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import { objectNodes, repeatFirstKey, sampleNodes, type ObjectNode } from '../model/__fixtures__/w00c-walk'

type RepeatedKeys = (text: string) => readonly { key: string }[]
async function scanner(): Promise<RepeatedKeys> {
  const specifier = './json-keys'
  const mod = (await import(/* @vite-ignore */ specifier)) as { repeatedKeys?: unknown }
  expect(typeof mod.repeatedKeys, 'testworld/clients/json-keys.ts exports repeatedKeys').toBe('function')
  return mod.repeatedKeys as RepeatedKeys
}

const SEED = 20261003
const pick = (n: number, seed: number): number => fc.sample(fc.integer({ min: 0, max: n - 1 }), { seed, numRuns: 1 })[0] ?? 0
const clients = walkClients()
const FILES = ['answer-key.json', 'onboarding.json'] as const
const textOf = (c: WalkClient, name: string): string => readFileSync(join(SAMPLE_ROOT, c.folder, name), 'utf8')
const byId = (cs: WalkClient[]): [string, WalkClient][] => cs.map((c): [string, WalkClient] => [c.id, c])
const keysOf = (found: readonly { key: string }[]): string[] => found.map((r) => r.key)

describe('W00c RC5 the scanner on the sample files as written', () => {
  test.each(byId(clients))('END-9 %s has no repeated key in answer-key.json or onboarding.json', async (_l, c) => {
    const repeatedKeys = await scanner()
    for (const name of FILES) expect(repeatedKeys(textOf(c, name)), `${c.id} ${name}`).toEqual([])
  })
})

describe('W00c RC5 the scanner finds a repeated key in every object of every onboarding.json', () => {
  const cases = clients.map((c): [string, number, { c: WalkClient; nodes: ObjectNode[] }] => {
    const nodes = objectNodes(JSON.parse(textOf(c, 'onboarding.json')) as unknown)
    return [c.id, nodes.length, { c, nodes }]
  })

  test.each(cases)('ARC-8 %s: each of its %i object nodes, written with its first key twice (a decoy first), is found with that key', async (_l, _n, { c, nodes }) => {
    const repeatedKeys = await scanner()
    expect(nodes.length).toBeGreaterThan(0)
    const json = JSON.parse(textOf(c, 'onboarding.json')) as unknown
    for (const n of nodes) {
      const { text, key } = repeatFirstKey(json, n.path)
      expect(JSON.parse(text), 'fixture: a last-wins parse gives back the original').toEqual(json)
      expect(keysOf(repeatedKeys(text)), `${c.id} onboarding.json at ${n.path.join('.') || '(root)'}`).toContain(key)
    }
  })
})

describe('W00c RC5 the scanner finds a repeated key at every depth of every answer-key.json (pinned-seed sample)', () => {
  const cases = clients.map((c, ci): [string, { c: WalkClient; nodes: ObjectNode[]; all: ObjectNode[] }] => {
    const all = objectNodes(JSON.parse(textOf(c, 'answer-key.json')) as unknown)
    return [c.id, { c, all, nodes: sampleNodes(all, SEED + ci * 100, 30, pick) }]
  })

  test.each(cases)('ARC-8 %s: one object node per depth present and 30 more, each written with its first key twice (a decoy first), is found with that key', async (_l, { c, nodes, all }) => {
    const repeatedKeys = await scanner()
    expect(new Set(nodes.map((n) => n.depth))).toEqual(new Set(all.map((n) => n.depth)))
    const json = JSON.parse(textOf(c, 'answer-key.json')) as unknown
    for (const n of nodes) {
      const { text, key } = repeatFirstKey(json, n.path)
      expect(keysOf(repeatedKeys(text)), `${c.id} answer-key.json at ${n.path.join('.') || '(root)'}`).toContain(key)
    }
  }, 30_000)
})

describe('W00c RC5 what the scanner must not call a repeat, and escapes', () => {
  test('ARC-8 equal keys in sibling and nested objects are not repeats', async () => {
    const repeatedKeys = await scanner()
    expect(repeatedKeys('{"a": {"a": 1, "b": {"a": 2}}, "b": [{"a": 1}, {"a": 2}]}')).toEqual([])
  })

  test('ARC-8 text inside a string value is never a key, even with escaped quotes and a trailing backslash', async () => {
    const repeatedKeys = await scanner()
    expect(repeatedKeys(JSON.stringify({ a: 'x", "a": 1, "b": "y (Test)', b: ['c\\', '"a": 2 \\" "a": 3 (Test)'] }))).toEqual([])
  })

  test('ARC-8 a key written once plain and once with a unicode escape is a repeat, named decoded', async () => {
    const repeatedKeys = await scanner()
    expect(keysOf(repeatedKeys('{"x": [{"amount": 0, "am\\u006funt": 1}]}'))).toEqual(['amount'])
  })

  test('ARC-8 a repeat deep inside arrays of objects is found with its key', async () => {
    const repeatedKeys = await scanner()
    expect(keysOf(repeatedKeys('{"t": [[{"lines": [{"debit": 0, "credit": 1, "debit": 2}]}]]}'))).toEqual(['debit'])
  })
})
