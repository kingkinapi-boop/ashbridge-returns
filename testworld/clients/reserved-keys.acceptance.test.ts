// W00c acceptance tests (round 3), RC-A fix 1: a prototype name written as a JSON key is found by a pure scanner
// exported from testworld/clients/json-keys.ts, beside repeatedKeys (reports/W00c-findings-3.md; W00b imports both).
//
// What the W00c round 3 build provides:
//   `reservedKeys(text: string): readonly { key: string }[]` (more fields allowed): every key of any object, at any
//   depth, that is "__proto__", "constructor" or "prototype" after JSON string escapes are decoded, once per
//   occurrence, in the order they are written; [] when there is none. Text inside a string value is never a key, and a
//   key that only contains one of the names is not one. `repeatedKeys` keeps its signature. The loader turns each one
//   into a 'file' issue (strict-read.acceptance.test.ts).
//
// The sample cases come from the walk over every numbered folder (sample-walk.ts). The module is loaded by a dynamic
// import so the suite type-checks before the build; until then each test fails with "exports reservedKeys".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { SAMPLE_ROOT, walkClients } from '../model/__fixtures__/sample-walk'
import { objectNodes } from '../model/__fixtures__/w00c-walk'

type Scan = (text: string) => readonly { key: string }[]
async function scanners(): Promise<{ reservedKeys: Scan; repeatedKeys: Scan }> {
  const specifier = './json-keys'
  const mod = (await import(/* @vite-ignore */ specifier)) as { reservedKeys?: unknown; repeatedKeys?: unknown }
  expect(typeof mod.reservedKeys, 'testworld/clients/json-keys.ts exports reservedKeys').toBe('function')
  expect(typeof mod.repeatedKeys, 'testworld/clients/json-keys.ts still exports repeatedKeys').toBe('function')
  return { reservedKeys: mod.reservedKeys as Scan, repeatedKeys: mod.repeatedKeys as Scan }
}
const keysOf = (found: readonly { key: string }[]): string[] => found.map((r) => r.key)
const clients = walkClients()
const NAMES = ['__proto__', 'constructor', 'prototype'] as const

describe('W00c RC-A reservedKeys', () => {
  test.each(clients.map((c): [string, string] => [c.id, c.folder]))('END-9 %s: neither sample file has a reserved key', async (_id, folder) => {
    const { reservedKeys } = await scanners()
    for (const f of ['answer-key.json', 'onboarding.json']) expect(reservedKeys(readFileSync(join(SAMPLE_ROOT, folder, f), 'utf8')), `${folder} ${f}`).toEqual([])
  })

  test('ARC-8 each name is found at the root, in a nested object and in an object inside an array, in written order', async () => {
    const { reservedKeys } = await scanners()
    for (const name of NAMES) {
      const k = JSON.stringify(name)
      expect(keysOf(reservedKeys(`{${k}: 1}`)), `${name} at the root`).toEqual([name])
      expect(keysOf(reservedKeys(`{"a": {"b": {${k}: {}}}}`)), `${name} nested`).toEqual([name])
      expect(keysOf(reservedKeys(`{"a": [1, {"x": 2, ${k}: [3]}]}`)), `${name} in an array`).toEqual([name])
    }
    expect(keysOf(reservedKeys('{"prototype": 1, "a": {"__proto__": 2}, "b": [{"constructor": 3}], "c": {"constructor": 4}}'))).toEqual(['prototype', '__proto__', 'constructor', 'constructor'])
  })

  test('ARC-8 an escaped spelling is the same key; a value, a longer key and a repeated ordinary key are not reserved', async () => {
    const { reservedKeys, repeatedKeys } = await scanners()
    expect(keysOf(reservedKeys('{"\\u005f\\u005fproto\\u005f\\u005f": 1}'))).toEqual(['__proto__'])
    expect(keysOf(reservedKeys('{"\\u0063onstructor": 1}'))).toEqual(['constructor'])
    expect(reservedKeys('{"a": "__proto__", "b": ["constructor", "prototype"], "c": "{\\"__proto__\\": 1}"}')).toEqual([])
    expect(reservedKeys('{"__proto__x": 1, "my_constructor": 2, "prototypes": 3, "Constructor": 4}')).toEqual([])
    expect(reservedKeys('{"a": 1, "a": 2}')).toEqual([])
    expect(keysOf(repeatedKeys('{"__proto__": 1, "__proto__": 2}')), 'repeatedKeys still finds a repeat of any key').toEqual(['__proto__'])
  })

  test('ARC-8 every object node of every onboarding.json, given a "constructor" key first, is found once', async () => {
    const { reservedKeys } = await scanners()
    for (const c of clients) {
      const text = readFileSync(join(SAMPLE_ROOT, c.folder, 'onboarding.json'), 'utf8')
      const json = JSON.parse(text) as unknown
      for (const n of objectNodes(json)) {
        const copy = structuredClone(json)
        let node: unknown = copy
        for (const s of n.path) node = (node as Record<string | number, unknown>)[s]
        const hole = 'w00c_reserved_hole_(Test)'
        ;(node as Record<string, unknown>)[hole] = 0
        const planted = JSON.stringify(copy).replace(JSON.stringify(hole), '"constructor"')
        expect(keysOf(reservedKeys(planted)), `${c.id} onboarding.json at ${n.path.join('.') || '(root)'}`).toEqual(['constructor'])
      }
    }
  })
})
