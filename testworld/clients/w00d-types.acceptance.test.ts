// W00d acceptance tests, A511 (from A507, B04's spec review): each adjusting entry's type is TB-2's, written in the
// answer key and read by the loader, never derived (card W00d, Lead directive 3 Oct 19:05Z).
//
// TB-2 (blueprint/03-evidence.md): an adjusting entry counts as explained only when it has a type, one of reclass,
// accrual, allocation, estimate, correction. W00c's loader invents the type from where the sources come from
// ("from-transactions", "from-onboarding", "from-transactions-and-onboarding"; load.ts:618-623 on W00c), which B05
// would refuse.
//
// What W00d's build does (load.ts only): the raw answer-key schema reads adjustingEntries[].type as one of TB-2's five
// types (a missing or other type is refused as a schema issue naming answer-key.json adjustingEntries.<n>.type), and the
// model's type is the answer key's, unchanged.
//
// The data half (every answer key carries the type) is spec-owned (A511). The plants below write their own types into a
// sandbox copy first, so they prove the loader whatever the committed data says.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { loadClient } from './load'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import { expectSome, mentions, namesPath, refused, show } from '../model/__fixtures__/w00c-r3-walk'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const SLOW = 120_000
const BLUEPRINT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'blueprint', '03-evidence.md')

/** TB-2's type list, read from the clause itself (never copied by hand from the code under test; A426). */
function tb2Types(): string[] {
  const text = readFileSync(BLUEPRINT, 'utf8')
  const m = /\*\*TB-2\*\*[^\n]*?has a type \(([^)]+)\)/.exec(text)
  if (m?.[1] === undefined) throw new Error('fixture: TB-2 no longer lists its types in "has a type (...)"')
  return m[1].split(',').map((s) => s.trim())
}
const TYPES = tb2Types()

type KeyEntry = { id: string; type?: unknown }
const entriesOf = (c: WalkClient): KeyEntry[] => c.key.adjustingEntries
const withEntries = clients.filter((c) => entriesOf(c).length > 0)

/** Every problem of the rule "each adjusting entry of each answer key has one of TB-2's types", by client and entry. */
function typeProblems(keys: readonly { client: string; entries: readonly KeyEntry[] }[]): string[] {
  return keys.flatMap(({ client, entries }) =>
    entries.flatMap((j) =>
      typeof j.type === 'string' && TYPES.includes(j.type) ? [] : [`${client} ${j.id}: type ${JSON.stringify(j.type)} is not one of ${TYPES.join(', ')}`],
    ),
  )
}

/** A TB-2 type for entry n of client k, cycling so every type is planted somewhere. */
const plantedType = (k: number, n: number): string => TYPES[(k + n) % TYPES.length] as string

/** Writes a TB-2 type into every adjusting entry of the client's sandbox answer key; returns them by entry id. */
function typeAll(c: WalkClient, k: number): Map<string, string> {
  const want = new Map<string, string>()
  sb.editKey(c, (key) => {
    for (const [n, j] of (key.adjustingEntries as KeyEntry[]).entries()) {
      const type = plantedType(k, n)
      j.type = type
      want.set(j.id, type)
    }
  })
  return want
}

const loaded = (c: WalkClient): [string, string][] =>
  loadClient(c.id as `C${string}`, { root: sb.root }).adjustingEntries.map((j): [string, string] => [j.id, j.type])

describe('W00d A511 the adjusting entry type is TB-2\'s, written in the answer key', () => {
  test('TB-2 the clause lists five types: reclass, accrual, allocation, estimate, correction', () => {
    expect(TYPES).toEqual(['reclass', 'accrual', 'allocation', 'estimate', 'correction'])
  })

  test('TB-2 the rule catches an entry with no type, one with "from-transactions" and one with the old memo "from-transactions-and-onboarding", and passes the five', () => {
    const planted = [
      { client: 'C98 (Test)', entries: [{ id: '98-AJE-01' }, { id: '98-AJE-02', type: 'from-transactions' }, { id: '98-AJE-03', type: 'from-transactions-and-onboarding' }] },
      { client: 'C99 (Test)', entries: TYPES.map((type, n) => ({ id: `99-AJE-0${String(n + 1)}`, type })) },
    ]
    expect(typeProblems(planted)).toEqual([
      `C98 (Test) 98-AJE-01: type undefined is not one of ${TYPES.join(', ')}`,
      `C98 (Test) 98-AJE-02: type "from-transactions" is not one of ${TYPES.join(', ')}`,
      `C98 (Test) 98-AJE-03: type "from-transactions-and-onboarding" is not one of ${TYPES.join(', ')}`,
    ])
  })

  test('TB-2 every adjusting entry of every sample answer key has a type, one of TB-2\'s five', () => {
    expect(withEntries.length, 'sample folders with adjusting entries').toBeGreaterThanOrEqual(10)
    expect(typeProblems(clients.map((c) => ({ client: c.id, entries: entriesOf(c) })))).toEqual([])
  })

  test('TB-2 ARC-8 the loaded type of every adjusting entry of every sample folder equals its answer key\'s, and is one of the five', () => {
    expect(withEntries.length).toBeGreaterThanOrEqual(10)
    for (const c of withEntries) {
      const want = entriesOf(c).map((j): [string, unknown] => [j.id, j.type])
      const got = loadClient(c.id as `C${string}`).adjustingEntries.map((j): [string, string] => [j.id, j.type])
      expect(got, c.id).toEqual(want)
      for (const [id, type] of got) expect(TYPES, `${c.id} ${id}`).toContain(type)
    }
  }, SLOW)

  test.each(withEntries.map((c, k): [string, WalkClient, number] => [c.id, c, k]))(
    'TB-2 ARC-8 %s: types written into its answer key are the model\'s types, entry by entry (read, never derived from the sources)',
    (_id, c, k) => {
      const want = typeAll(c, k)
      expect(want.size).toBeGreaterThan(0)
      expect(loaded(c)).toEqual([...want])
    },
    SLOW,
  )

  test('TB-2 ARC-8 across the sample folders the planted types cover all five, so no type is mapped to another', () => {
    const seen = new Set(withEntries.flatMap((c, k) => entriesOf(c).map((_j, n) => plantedType(k, n))))
    expect([...seen].sort()).toEqual([...TYPES].sort())
  })

  const plants: [string, unknown][] = [
    ['no type', undefined],
    ['type "from-transactions"', 'from-transactions'],
    ['type "from-transactions-and-onboarding" (the old memo)', 'from-transactions-and-onboarding'],
    ['type "Reclass" (a case change)', 'Reclass'],
    ['type ""', ''],
  ]
  const cases = withEntries.flatMap((c, k) => plants.map(([what, value]): [string, string, WalkClient, number, unknown] => [c.id, what, c, k, value]))

  test.each(cases)(
    'TB-2 ARC-8 %s: an adjusting entry with %s, every other entry typed, is refused as a schema issue naming answer-key.json adjustingEntries.<n>.type',
    (_id, what, c, k, value) => {
      typeAll(c, k)
      const n = entriesOf(c).length - 1
      sb.editKey(c, (key) => {
        const j = (key.adjustingEntries as KeyEntry[])[n] as KeyEntry
        if (value === undefined) delete j.type
        else j.type = value
      })
      const issues = refused(sb, c, `${c.id} adjustingEntries.${String(n)} with ${what}`)
      expectSome(
        issues,
        (i) => i.check === 'schema' && namesPath(i, 'answer-key.json', ['adjustingEntries', n, 'type']),
        `a schema issue naming answer-key.json adjustingEntries.${String(n)}.type`,
      )
      expect(issues.filter((i) => mentions(i, 'adjustingEntries.') && !namesPath(i, 'answer-key.json', ['adjustingEntries', n])), show(issues)).toEqual([])
    },
    SLOW,
  )
})
