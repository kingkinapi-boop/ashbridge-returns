// W00d acceptance tests, RC-B: the date walk covers object keys and the timestamp forms W00c let through (card W00d;
// reports/W00c-check.md "Suspicions (unproven)"; A501).
//
// The card lets each suspicion be refused or proved harmless. This spec takes refusal for all four (amber, spec W00d:
// a flag over a silent pass, tie-breaker 4): nothing in the sample files is written that way today, and a key such as
// fx.monthly's "2025-13" is a month the FX cards would look up.
//
// What W00d's build does: the date walk of W00c (every string leaf of both files, carried parts included) also
// visits every object key, and its timestamp rule covers a date part written before "T" or a space. A date-shaped key
// or value that is not a strict YYYY-MM-DD date or YYYY-MM month (or whose date part is not) is a 'schema' issue whose
// record is "<file> <dotted path>" (the object's path for a key, alone or followed by the key or more words).
// "2025.13" (two numbers split by one dot) stays a decimal, on purpose: it loads.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import {
  JSON_FILES,
  SEED,
  addKey,
  expectSome,
  genericOf,
  isDateLeaf,
  isMadeUpName,
  isRead,
  jsonOf,
  leaves,
  load,
  namesPath,
  objects,
  pattern,
  pick,
  refused,
  renameKey,
  setLeaf,
  show,
  type JsonFile,
  type Leaf,
  type Path,
} from '../model/__fixtures__/w00c-r3-walk'
import { CARRIED, READ_LISTS, within } from '../model/__fixtures__/w00d-fields'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const SLOW = 120_000
const DATE_KEY = /^\d{4}-\d{2}(?:-\d{2})?$/
/** Is this path inside a carried part: at or under an entry of the carried list (w00d-fields.ts)? */
const carriedSeen = new Map<string, boolean>()
function inCarried(file: JsonFile, path: Path): boolean {
  const label = `${file} ${pattern(genericOf(path))}`
  const hit = carriedSeen.get(label)
  if (hit !== undefined) return hit
  const is = CARRIED.some((e) => within(label, e))
  carriedSeen.set(label, is)
  return is
}
const underPrior = (file: JsonFile, path: Path): boolean => file === 'answer-key.json' && path[0] === 'prior_year'
/** Typed fields some READ list of W00d gives a meaning (a plant there could be refused for that meaning, not the date). */
const readByW00d = (l: Leaf): boolean => Object.values(READ_LISTS).some((list) => list.includes(`${l.file} ${pattern(l.generic)}`))

// ---- date-shaped object keys ----

/** Each generic object path whose keys are dates or months today: the first folder and node that has one. */
function dateKeyed(): { label: string; c: WalkClient; file: JsonFile; path: Path; key: string; keys: string[] }[] {
  const out = new Map<string, { label: string; c: WalkClient; file: JsonFile; path: Path; key: string; keys: string[] }>()
  for (const c of clients) {
    for (const file of JSON_FILES) {
      for (const o of objects(jsonOf(c, file))) {
        const key = Object.keys(o.node).find((k) => DATE_KEY.test(k))
        const label = `${file} ${genericOf(o.path)}`
        if (key !== undefined && !out.has(label)) out.set(label, { label, c, file, path: o.path, key, keys: Object.keys(o.node) })
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.label < b.label ? -1 : 1))
}
const keyed = dateKeyed()

describe('W00d RC-B date-shaped object keys are calendar dates or months', () => {
  test('ARC-8 the walk finds the date-keyed objects (fx.monthly of C06 and C08 today)', () => {
    expect(keyed.map((k) => k.label)).toContain('answer-key.json fx.monthly')
  })

  test.each(keyed.map((k): [string, string, (typeof keyed)[number]] => [k.label, k.c.id, k]))(
    'ARC-8 %s (first in %s): its first key renamed 2025-13 and 2025-02-30 is each refused as a schema issue naming the path',
    (_l, _c, k) => {
      for (const bad of ['2025-13', '2025-02-30']) {
        expect(k.keys, `fixture: ${k.c.id} ${k.label} has no key ${bad}`).not.toContain(bad)
        renameKey(sb, k.c, k.file, k.path, k.key, bad)
        const issues = refused(sb, k.c, `${k.file} ${k.path.join('.')} key ${k.key} written ${bad}`)
        expectSome(issues, (i) => i.check === 'schema' && namesPath(i, k.file, k.path), `${k.c.id}: a 'schema' issue naming ${k.file} ${k.path.join('.')}`)
        sb.restore()
      }
    },
    SLOW,
  )

  /** Object nodes inside a carried part (the carried list; never prior_year, which W00d describes), seeded per folder. */
  const carriedObjects = (c: WalkClient): { file: JsonFile; path: Path }[] =>
    JSON_FILES.flatMap((file) =>
      objects(jsonOf(c, file))
        .filter((o) => o.path.length > 0 && inCarried(file, o.path) && !underPrior(file, o.path))
        .map((o) => ({ file, path: o.path })),
    )
  const cases = clients.map((c, n): [string, WalkClient, { file: JsonFile; path: Path }] => {
    const all = carriedObjects(c)
    if (all.length === 0) throw new Error(`fixture: ${c.id} has no object inside a carried part`)
    return [c.id, c, all[pick(all.length, SEED + 400 + n)] as { file: JsonFile; path: Path }]
  })

  test.each(cases.map(([id, c, o]): [string, string, WalkClient, { file: JsonFile; path: Path }] => [id, `${o.file} ${o.path.join('.')}`, c, o]))(
    'ARC-8 %s: a key 2025-02-30 added to a seeded object inside a carried part (%s), where no date key is written today, is refused as a schema issue naming the path',
    (_id, _where, c, o) => {
      addKey(sb, c, o.file, o.path, '2025-02-30', 'made up (Test)')
      const issues = refused(sb, c, `${o.file} ${o.path.join('.')} key 2025-02-30`)
      expectSome(issues, (i) => i.check === 'schema' && namesPath(i, o.file, o.path), `${c.id}: a 'schema' issue naming ${o.file} ${o.path.join('.')}`)
    },
    SLOW,
  )
})

// ---- timestamp forms ----

/** String leaves inside a carried part that hold no date today, that no list reads and that are no made-up name. */
const quietCarried = (c: WalkClient): Leaf[] =>
  JSON_FILES.flatMap((f) => leaves(f, jsonOf(c, f))).filter(
    (l) => typeof l.value === 'string' && inCarried(l.file, l.path) && !underPrior(l.file, l.path) && !isDateLeaf(l) && !isRead(l) && !readByW00d(l) && !isMadeUpName(l),
  )
const FORMS = ['2025-2-30T00:00Z', '2025-02-30 10:00'] as const
const stampCases = clients.map((c, n): [string, WalkClient, Leaf] => {
  const all = quietCarried(c)
  if (all.length === 0) throw new Error(`fixture: ${c.id} has no quiet string leaf inside a carried part`)
  return [c.id, c, all[pick(all.length, SEED + 500 + n)] as Leaf]
})

describe('W00d RC-B timestamp forms with a bad date part are refused', () => {
  test.each(stampCases.map(([id, c, l]): [string, string, WalkClient, Leaf] => [id, `${l.file} ${l.path.join('.')}`, c, l]))(
    'ARC-8 %s: a seeded string leaf inside a carried part (%s) set to 2025-2-30T00:00Z and to 2025-02-30 10:00 is each refused as a schema issue naming the path',
    (_id, _where, c, leaf) => {
      for (const bad of FORMS) {
        setLeaf(sb, c, leaf.file, leaf.path, bad)
        const issues = refused(sb, c, `${leaf.file} ${leaf.path.join('.')} = ${bad}`)
        expectSome(issues, (i) => i.check === 'schema' && namesPath(i, leaf.file, leaf.path), `${c.id}: a 'schema' issue naming ${leaf.file} ${leaf.path.join('.')}`)
        sb.restore()
      }
    },
    SLOW,
  )

  test('ARC-8 C10: the first transaction date written 2025-2-30T00:00Z or 2025-02-30 10:00 is refused naming the path (a read date field too)', () => {
    const c10 = clients.find((c) => c.id === 'C10') as WalkClient
    for (const bad of FORMS) {
      setLeaf(sb, c10, 'answer-key.json', ['transactions', 0, 'date'], bad)
      const issues = refused(sb, c10, `transactions.0.date = ${bad}`)
      expectSome(issues, (i) => i.check === 'schema' && namesPath(i, 'answer-key.json', ['transactions', 0, 'date']), "a 'schema' issue naming answer-key.json transactions.0.date")
      sb.restore()
    }
  }, SLOW)
})

// ---- "2025.13" stays a decimal ----

describe('W00d RC-B "2025.13" stays a decimal on purpose', () => {
  /** Free-text note leaves (key "note" or "notes") inside a carried part: a value there is never looked up by any check. */
  const notes = (c: WalkClient): Leaf[] => quietCarried(c).filter((l) => l.path[l.path.length - 1] === 'note' || l.path[l.path.length - 1] === 'notes')
  const cases = clients.flatMap((c, n): [string, WalkClient, Leaf][] => {
    const all = notes(c)
    return all.length === 0 ? [] : [[c.id, c, all[pick(all.length, SEED + 600 + n)] as Leaf]]
  })

  test('ARC-8 most folders write a carried note to plant in', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10)
  })

  test.each(cases.map(([id, c, l]): [string, string, WalkClient, Leaf] => [id, `${l.file} ${l.path.join('.')}`, c, l]))('ARC-8 %s: a carried note (%s) set to 2025.13 still loads', (_id, _where, c, leaf) => {
    setLeaf(sb, c, leaf.file, leaf.path, '2025.13')
    const r = load(sb, c)
    expect(r.ok, `${c.id} ${leaf.file} ${leaf.path.join('.')} = 2025.13: ${r.ok ? '' : show(r.issues)}`).toBe(true)
  }, SLOW)
})

// ---- the seeded picks ----

describe('W00d the plants are pinned', () => {
  test('ARC-16 every seeded pick of this file is the same on a second run (fixed seeds, no clock)', () => {
    const again = clients.map((c, n) => {
      const all = quietCarried(c)
      return `${c.id} ${(all[pick(all.length, SEED + 500 + n)] as Leaf).path.join('.')}`
    })
    expect(again).toEqual(stampCases.map(([id, , l]) => `${id} ${l.path.join('.')}`))
  }, SLOW)
})
