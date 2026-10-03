// W00d acceptance tests, RC-A: every typed field of the raw schema is read into the model or refused, proved by class
// (card W00d; reports/W00c-check.md items 2 to 5; A426, A501).
//
// What W00d's build does (load.ts, json-keys.ts and checks.ts only):
// - exports RAW_SCHEMAS (w00d-fields.ts says how), so the field list here comes from the schema's own shape;
// - every typed field of the raw schemas is on a READ list of w00d-fields.ts (held by the model, checked as a twin,
//   read by the made-up-data guard or resolved by the id walk) or on its carried list; a field on neither fails by path;
// - the four fields W00c neither held nor checked are read: accounts[].tag ("ZZ"), onboarding
//   cra_program_accounts[].account_number, t2Inputs.schedule50[].businessNumber and parties[].kind: each change below
//   refuses the load or changes the model (the model cannot gain fields on this card: schema.ts is outside its Paths);
// - prior_year, which the model holds whole, is parsed through a strict schema at every depth: a renamed or added key
//   anywhere under it is refused, naming the path;
// - every run of carried keys sits under a comment naming its owning card (fix 2 of W00c round 3);
// - all sample folders still load.
//
// Amber (spec W00d): parties[].kind is planted only where another written fact of the client fixes the kind (an
// owner's holder_kind, a Schedule 50 sin or business number, a related entity). A party named nowhere else has no twin
// inside the card's Paths; its kind is read only by the guard's description scan, like a name.
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { z } from 'zod'
import * as loadModule from './load'
import { readOwnSource } from '../../src/core/testing/read-own-source'
import { passesCheckDigit } from '../model/guard'
import { Sandbox, walkClients, type WalkClient } from '../model/__fixtures__/sample-walk'
import {
  SEED,
  addKey,
  expectSome,
  genericOf,
  load,
  mentions,
  namesPath,
  objects,
  oneCharOff,
  pick,
  refused,
  renameKey,
  setLeaf,
  show,
  type JsonFile,
  type Path,
} from '../model/__fixtures__/w00c-r3-walk'
import {
  CARRIED,
  GUARD_NAMES,
  GUARD_NUMBERS,
  MODEL_WHOLE,
  READ_LISTS,
  REFS,
  businessNumberOf,
  craOf,
  fieldProblem,
  kindFixedFor,
  oneDigitOff,
  partiesOf,
  schedule50Of,
  schemaFields,
  tagsOf,
  within,
  withValidCheckDigit,
  type SchemaField,
} from '../model/__fixtures__/w00d-fields'

const sb = new Sandbox()
afterEach(() => {
  sb.restore()
})
afterAll(() => {
  sb.dispose()
})

const clients = walkClients()
const SLOW = 120_000
const FILES: readonly JsonFile[] = ['answer-key.json', 'onboarding.json']

/** RAW_SCHEMAS from load.ts, or undefined while the build has not exported it. */
function rawSchemas(): Record<JsonFile, unknown> | undefined {
  const raw = (loadModule as unknown as Record<string, unknown>)['RAW_SCHEMAS']
  if (raw === null || typeof raw !== 'object') return undefined
  return raw as Record<JsonFile, unknown>
}
function fieldsOrFail(): SchemaField[] {
  const raw = rawSchemas()
  expect(raw, 'load.ts exports RAW_SCHEMAS (the zod schemas of answer-key.json and onboarding.json)').toBeDefined()
  return raw === undefined ? [] : FILES.flatMap((f) => schemaFields(f, raw[f]))
}

/** The model of a clean folder (cached), for "the model changes or the load refuses". */
const cleanModels = new Map<string, string>()
function cleanModel(c: WalkClient): string {
  const hit = cleanModels.get(c.id)
  if (hit !== undefined) return hit
  const r = load(sb, c)
  expect(r.ok, `${c.id} loads clean: ${r.ok ? '' : show(r.issues)}`).toBe(true)
  const model = r.ok ? r.model : ''
  cleanModels.set(c.id, model)
  return model
}
/** Applies one planted change and expects the load refused or the model changed. */
function expectReadOrRefused(c: WalkClient, what: string, plant: () => void): void {
  const before = cleanModel(c)
  plant()
  const r = load(sb, c)
  expect(!r.ok || r.model !== before, `${c.id}: ${what} loaded with no issue and the same model`).toBe(true)
  sb.restore()
}

// ---- the comparison (A426) ----

describe('W00d RC-A the READ and carried lists against the raw schema field list', () => {
  test('ARC-8 load.ts exports RAW_SCHEMAS, and its field list (from the schemas\' shape) reaches the sentinel fields of both files', () => {
    const labels = fieldsOrFail().map((f) => f.label)
    expect(labels.length).toBeGreaterThan(100)
    for (const must of ['answer-key.json transactions[].id', 'answer-key.json accounts[].tag', 'answer-key.json statementBalances.*[].rolls', 'answer-key.json trialBalance.*.rows[].debit', 'onboarding.json owners[].name', 'onboarding.json cra_program_accounts[].account_number']) {
      expect(labels, `the field list reaches ${must}`).toContain(must)
    }
  })

  test.each(FILES.map((f): [JsonFile] => [f]))('ARC-8 %s: every field of the raw schema is on a READ list (and typed) or on the carried list; a field on neither fails by path', (file) => {
    const fields = fieldsOrFail().filter((f) => f.label.startsWith(`${file} `))
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.flatMap((f) => fieldProblem(f) ?? [])).toEqual([])
  })

  test('ARC-8 every list entry is a field of the raw schema: no READ entry, carried entry or whole-model entry names a path the schema does not have', () => {
    const fields = fieldsOrFail()
    const labels = fields.map((f) => f.label)
    const stale = [
      ...Object.entries(READ_LISTS).flatMap(([n, l]) => l.filter((e) => !labels.includes(e)).map((e) => `${n}: ${e}`)),
      ...CARRIED.filter((e) => !labels.some((l) => within(l, e))).map((e) => `carried: ${e}`),
      ...MODEL_WHOLE.filter((e) => !labels.some((l) => within(l, e))).map((e) => `whole: ${e}`),
    ]
    expect(stale).toEqual([])
  })

  test('ARC-13 prior_year, held whole by the model, is described by a schema: fields under it, none declared carried (reports/W00c-check.md item 4)', () => {
    const under = fieldsOrFail().filter((f) => MODEL_WHOLE.some((e) => f.label.startsWith(`${e}.`) || f.label.startsWith(`${e}[]`)))
    expect(under.length, 'prior_year has typed fields under it, not one carried leaf').toBeGreaterThan(10)
    expect(under.filter((f) => f.carried).map((f) => f.label)).toEqual([])
    for (const must of ['answer-key.json prior_year.fiscalYear.start', 'answer-key.json prior_year.balanceOwing.paidBy[]', 'answer-key.json prior_year.losses.nonCapital[].amount']) {
      expect(under.map((f) => f.label), `prior_year's schema reaches ${must}`).toContain(must)
    }
  })

  // The rule itself, planted (step 4): the real form of the accounts[] object (load.ts), with one typed field added
  // that no list names, and one READ field declared carried, must each fail by path.
  test('ARC-8 planted: a typed field on neither list, and a READ field declared carried, each fail by path', () => {
    const u = z.unknown().optional()
    const planted = z.strictObject({
      accounts: z.array(z.strictObject({ key: z.string(), tag: z.string(), role: z.string(), sortCode: z.string(), layout: u })),
      transactions: z.array(z.strictObject({ id: u })),
    })
    const problems = schemaFields('answer-key.json', planted).flatMap((f) => fieldProblem(f) ?? [])
    expect(problems.some((p) => p.includes('answer-key.json accounts[].sortCode') && p.includes('neither'))).toBe(true)
    expect(problems.some((p) => p.includes('answer-key.json transactions[].id') && p.includes('carried'))).toBe(true)
    expect(problems.filter((p) => p.includes('accounts[].key') || p.includes('accounts[].tag') || p.includes('accounts[].layout'))).toEqual([])
  })
})

// ---- the four plants of reports/W00c-check.md items 2 and 3 ----

describe('W00d RC-A accounts[].tag is read (the id rule ties it to every transaction id of the account)', () => {
  const withAccounts = clients.filter((c) => tagsOf(c).length > 0)
  test('ARC-8 every folder with accounts gives a plant (C12 has none)', () => {
    expect(withAccounts.length).toBeGreaterThanOrEqual(14)
  })
  test.each(withAccounts.map((c): [string, WalkClient] => [c.id, c]))('ARC-8 %s: the first account\'s tag set to "ZZ" refuses the load or changes the model', (_id, c) => {
    expectReadOrRefused(c, `accounts.0.tag = "ZZ" (was ${tagsOf(c)[0]?.tag ?? ''})`, () => {
      setLeaf(sb, c, 'answer-key.json', ['accounts', 0, 'tag'], 'ZZ')
    })
  }, SLOW)
})

describe('W00d RC-A cra_program_accounts[].account_number is read', () => {
  const withCra = clients.filter((c) => craOf(c).length > 0)
  test('ARC-8 every folder writes a program account, and each today is its business number, two letters and four digits', () => {
    expect(withCra.length).toBeGreaterThanOrEqual(15)
    for (const c of withCra) for (const a of craOf(c)) expect(a.account_number, c.id).toMatch(new RegExp(`^${businessNumberOf(c)}[A-Z]{2}\\d{4}$`))
  })
  test.each(withCra.map((c): [string, WalkClient] => [c.id, c]))(
    'ARC-8 %s: the first program account number given another folder\'s business number, and cut short by one digit, each refuses the load or changes the model',
    (_id, c) => {
      const first = craOf(c)[0]?.account_number ?? ''
      const other = clients.map(businessNumberOf).find((bn) => bn !== businessNumberOf(c)) ?? ''
      expect(passesCheckDigit(other), `fixture: ${other} fails the check digit like every made-up number`).toBe(false)
      for (const value of [`${other}${first.slice(9)}`, first.slice(0, -1)]) {
        expectReadOrRefused(c, `cra_program_accounts.0.account_number = ${value} (was ${first})`, () => {
          setLeaf(sb, c, 'onboarding.json', ['cra_program_accounts', 0, 'account_number'], value)
        })
      }
    },
    SLOW,
  )
})

describe('W00d RC-A t2Inputs.schedule50[].businessNumber is read', () => {
  const rows = clients.flatMap((c) => schedule50Of(c).flatMap((s, i): [string, number, string, WalkClient][] => (s.businessNumber === undefined ? [] : [[c.id, i, s.businessNumber, c]])))
  test('ARC-8 at least one folder writes a Schedule 50 business number (C06 today)', () => {
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
  test.each(rows)('ARC-8 %s: schedule50.%i businessNumber %s moved one digit (still failing the check digit) and cut to eight digits each refuses the load or changes the model', (_id, i, bn, c) => {
    for (const value of [oneDigitOff(bn), bn.slice(0, -1)]) {
      expectReadOrRefused(c, `t2Inputs.schedule50.${String(i)}.businessNumber = ${value} (was ${bn})`, () => {
        setLeaf(sb, c, 'answer-key.json', ['t2Inputs', 'schedule50', i, 'businessNumber'], value)
      })
    }
  }, SLOW)
})

describe('W00d RC-A parties[].kind is read where another written fact fixes it', () => {
  const cases = clients.flatMap((c) =>
    partiesOf(c).flatMap((p, i): [string, string, string, WalkClient, number, 'person' | 'company'][] => {
      const fixed = kindFixedFor(c, p.name)
      return fixed === undefined ? [] : [[c.id, p.name, fixed === 'person' ? 'company' : 'person', c, i, fixed]]
    }),
  )
  test('ARC-8 the plants include every folder\'s owner and at least one company turned person (C05 and C06 today), and today each party agrees with its twin', () => {
    expect(cases.length).toBeGreaterThanOrEqual(15)
    expect(cases.filter((x) => x[5] === 'company').length).toBeGreaterThanOrEqual(2)
    for (const [id, name, , c, i, fixed] of cases) expect(partiesOf(c)[i]?.kind, `${id} ${name}`).toBe(fixed)
  })
  test.each(cases)('ARC-8 %s: party "%s" written %s refuses the load or changes the model', (_id, _name, flipped, c, i) => {
    expectReadOrRefused(c, `parties.${String(i)}.kind = ${flipped}`, () => {
      setLeaf(sb, c, 'answer-key.json', ['parties', i, 'kind'], flipped)
    })
  }, SLOW)
})

// ---- the other READ lists, proved by behaviour (beside the shape comparison) ----

/** The first folder and concrete path that writes a field of this label (array indexes 0 where the folder has them). */
function firstLeafOf(label: string): { c: WalkClient; file: JsonFile; path: Path; value: unknown } | undefined {
  const [file, generic] = label.split(' ') as [JsonFile, string]
  for (const c of clients) {
    const json = file === 'answer-key.json' ? c.key : c.onboarding
    const walk = (v: unknown, path: (string | number)[]): { path: Path; value: unknown } | undefined => {
      if (Array.isArray(v)) {
        for (const [i, x] of v.entries()) {
          const hit = walk(x, [...path, i])
          if (hit !== undefined) return hit
        }
        return undefined
      }
      if (v !== null && typeof v === 'object') {
        for (const k of Object.keys(v)) {
          const hit = walk((v as Record<string, unknown>)[k], [...path, k])
          if (hit !== undefined) return hit
        }
        return undefined
      }
      return genericOf(path) === generic ? { path, value: v } : undefined
    }
    const hit = walk(json, [])
    if (hit !== undefined) return { c, file, ...hit }
  }
  return undefined
}

describe('W00d RC-A the guard and the id walk read the fields their lists give them', () => {
  test.each(GUARD_NAMES.map((l): [string] => [l]))('SEC-11 %s: in the first folder that writes it, a name without "(Test)" is refused as made-up-data naming the path', (label) => {
    const hit = firstLeafOf(label)
    if (hit === undefined) throw new Error(`fixture: no folder writes ${label}`)
    setLeaf(sb, hit.c, hit.file, hit.path, 'Plain Name Holdings')
    const issues = refused(sb, hit.c, `${label} without "(Test)"`)
    expectSome(issues, (i) => i.check === 'made-up-data' && namesPath(i, hit.file, hit.path), `${hit.c.id}: a made-up-data issue naming ${hit.file} ${hit.path.join('.')}`)
  }, SLOW)

  test.each(GUARD_NUMBERS.map((l): [string] => [l]))('SEC-11 %s: in the first folder that writes it, a number that passes the check digit is refused as made-up-data naming the path', (label) => {
    const hit = firstLeafOf(label)
    if (hit === undefined || typeof hit.value !== 'string') throw new Error(`fixture: no folder writes ${label}`)
    setLeaf(sb, hit.c, hit.file, hit.path, withValidCheckDigit(hit.value))
    const issues = refused(sb, hit.c, `${label} passing the check digit`)
    expectSome(issues, (i) => i.check === 'made-up-data' && namesPath(i, hit.file, hit.path), `${hit.c.id}: a made-up-data issue naming ${hit.file} ${hit.path.join('.')}`)
  }, SLOW)

  test.each(REFS.map((l): [string] => [l]))('ARC-8 %s: in the first folder that writes it, a value that resolves to nothing of the client is refused, naming the value or the path', (label) => {
    const hit = firstLeafOf(label)
    if (hit === undefined || typeof hit.value !== 'string') throw new Error(`fixture: no folder writes ${label}`)
    const nn = hit.c.id.slice(1)
    const value = label.endsWith('onboarding[]') ? 'no_such_onboarding_key_test' : label.endsWith('adjustingEntries[]') ? `${nn}-AJE-99` : `${hit.value.slice(0, -4)}9999`
    setLeaf(sb, hit.c, hit.file, hit.path, value)
    const issues = refused(sb, hit.c, `${label} = ${value}`)
    expectSome(issues, (i) => mentions(i, value) || namesPath(i, hit.file, hit.path), `${hit.c.id}: an issue naming ${value} or ${hit.file} ${hit.path.join('.')}`)
  }, SLOW)

  // reports/W00c-check.md (fresh check, "For W00d"): the own-key walk took an array's own "length" as a field, so an
  // onboarding source "owners.length" resolved. Only an index walks into an array.
  const onboardingRefs = REFS.filter((l) => l.endsWith('onboarding[]'))
  test('ARC-8 the reference lists hold onboarding sources to plant in (flags and add-backs)', () => {
    expect(onboardingRefs.length).toBeGreaterThanOrEqual(2)
  })
  test.each(onboardingRefs.map((l): [string] => [l]))('ARC-8 %s: in the first folder that writes it, a source "<array>.length" naming an array of onboarding.json is refused, naming the value or the path', (label) => {
    const hit = firstLeafOf(label)
    if (hit === undefined || typeof hit.value !== 'string') throw new Error(`fixture: no folder writes ${label}`)
    const onb = hit.c.onboarding as Record<string, unknown>
    const array = Object.keys(onb).find((k) => Array.isArray(onb[k]))
    if (array === undefined) throw new Error(`fixture: ${hit.c.id}'s onboarding.json has no top-level array`)
    const value = `${array}.length`
    setLeaf(sb, hit.c, hit.file, hit.path, value)
    const issues = refused(sb, hit.c, `${label} = ${value}`)
    expectSome(issues, (i) => mentions(i, value) || namesPath(i, hit.file, hit.path), `${hit.c.id}: an issue naming ${value} or ${hit.file} ${hit.path.join('.')}`)
  }, SLOW)
})

// ---- prior_year (reports/W00c-check.md item 4) ----

const withPrior = clients.filter((c) => Object.hasOwn(c.key, 'prior_year'))
/** Each generic object path under prior_year: the first folder whose node there has keys, and every key written at that path. */
function priorNodes(): { generic: string; c: WalkClient; path: Path; keys: string[]; allKeys: Set<string> }[] {
  const out = new Map<string, { generic: string; c: WalkClient; path: Path; keys: string[]; allKeys: Set<string> }>()
  for (const c of withPrior) {
    for (const o of objects(c.key)) {
      const generic = genericOf(o.path)
      if (generic !== 'prior_year' && !generic.startsWith('prior_year.')) continue
      const keys = Object.keys(o.node)
      const seen = out.get(generic)
      if (seen === undefined) {
        if (keys.length > 0) out.set(generic, { generic, c, path: o.path, keys, allKeys: new Set(keys) })
      } else for (const k of keys) seen.allKeys.add(k)
    }
  }
  return [...out.values()].sort((a, b) => (a.generic < b.generic ? -1 : 1))
}
const priors = priorNodes()
const fresh = (all: Set<string>, base: string): string => {
  let n = base
  while (all.has(n)) n = `${n}_`
  return n
}

describe('W00d RC-A prior_year is parsed through a strict schema at every depth', () => {
  test('ARC-8 two folders write a prior year (C11 and C15 today) and the walk finds its object paths', () => {
    expect(withPrior.map((c) => c.id)).toEqual(expect.arrayContaining(['C11', 'C15']))
    expect(priors.length).toBeGreaterThanOrEqual(12)
    expect(priors.map((p) => p.generic)).toEqual(expect.arrayContaining(['prior_year', 'prior_year.fiscalYear', 'prior_year.balanceOwing', 'prior_year.losses.nonCapital[]', 'prior_year.rv2']))
  })

  test('ARC-8 C11: "fiscalYer" added under prior_year is refused as a schema issue naming prior_year and the key', () => {
    const c11 = clients.find((c) => c.id === 'C11') as WalkClient
    addKey(sb, c11, 'answer-key.json', ['prior_year'], 'fiscalYer', { start: '2023-01-01', end: '2023-12-31' })
    const issues = refused(sb, c11, 'prior_year.fiscalYer')
    expectSome(issues, (i) => i.check === 'schema' && namesPath(i, 'answer-key.json', ['prior_year']) && mentions(i, 'fiscalYer'), "a 'schema' issue naming answer-key.json prior_year and fiscalYer")
  }, SLOW)

  test('ARC-8 C11: prior_year.fiscalYear renamed fiscalYer is refused as a schema issue naming prior_year', () => {
    const c11 = clients.find((c) => c.id === 'C11') as WalkClient
    renameKey(sb, c11, 'answer-key.json', ['prior_year'], 'fiscalYear', 'fiscalYer')
    const issues = refused(sb, c11, 'prior_year.fiscalYear written fiscalYer')
    expectSome(issues, (i) => i.check === 'schema' && namesPath(i, 'answer-key.json', ['prior_year']), "a 'schema' issue naming answer-key.json prior_year")
  }, SLOW)

  test.each(priors.map((p, n): [string, string, (typeof priors)[number], number] => [p.generic, p.c.id, p, n]))(
    'ARC-8 %s (first in %s): one key renamed by one character, and one key added, are each refused as a schema issue naming the path and the key',
    (_g, _c, p, n) => {
      const from = p.keys[pick(p.keys.length, SEED + 300 + n)] as string
      const to = fresh(p.allKeys, oneCharOff(from))
      renameKey(sb, p.c, 'answer-key.json', p.path, from, to)
      expectSome(refused(sb, p.c, `${p.path.join('.')} "${from}" written "${to}"`), (i) => i.check === 'schema' && namesPath(i, 'answer-key.json', p.path) && mentions(i, to), `a 'schema' issue naming ${p.path.join('.')} and "${to}"`)
      sb.restore()
      const added = fresh(p.allKeys, 'unread_key_test')
      addKey(sb, p.c, 'answer-key.json', p.path, added, 'made up (Test)')
      expectSome(refused(sb, p.c, `${p.path.join('.')} with "${added}"`), (i) => i.check === 'schema' && namesPath(i, 'answer-key.json', p.path) && mentions(i, added), `a 'schema' issue naming ${p.path.join('.')} and "${added}"`)
    },
    SLOW,
  )

  test.each(withPrior.map((c): [string, WalkClient] => [c.id, c]))('ARC-13 %s: the model still holds the prior year (priorYear is not null) and it names the same fiscal year', (_id, c) => {
    const model = JSON.parse(cleanModel(c)) as { priorYear: { fiscalYear?: { start?: unknown; end?: unknown } } | null }
    const raw = (c.key as unknown as { prior_year: { fiscalYear: { start: string; end: string } } }).prior_year
    expect(model.priorYear?.fiscalYear).toEqual(raw.fiscalYear)
  }, SLOW)
})

// ---- owner comments (fix 2 of W00c round 3) ----

describe('W00d RC-A every run of carried keys names its owning card', () => {
  test('ARC-8 load.ts: each carried key is declared on its own line under a "carried" comment that names a card of plan/slices.json (not W00c or W00d), and every carried field of RAW_SCHEMAS has such a line', () => {
    const src = readOwnSource('testworld/clients/load.ts')
    const consts = [...src.matchAll(/^const (\w+) = z\.unknown\(\)(?:\.optional\(\))?\s*$/gm)].map((m) => m[1] as string)
    expect(consts, 'load.ts declares one carried schema: const <name> = z.unknown().optional()').toHaveLength(1)
    const u = consts[0] as string
    const lines = src.split(/\r?\n/)
    const carriedLine = new RegExp(`^\\s*['"]?([\\w$]+)['"]?: ${u},?\\s*$`)
    const keyLines = lines.flatMap((l, i) => (carriedLine.test(l) ? [i] : []))
    expect(keyLines.length, 'load.ts has carried key lines').toBeGreaterThan(50)
    const uses = (src.match(new RegExp(`:\\s*${u}\\b`, 'g')) ?? []).length
    expect(uses, `every use of ${u} is a key on its own line (no carried key written inline beside other keys)`).toBe(keyLines.length)

    const cards = new Set((JSON.parse(readOwnSource('plan/slices.json')) as { cards: { id: string }[] }).cards.map((c) => c.id))
    cards.delete('W00c')
    cards.delete('W00d')
    expect(cards.size).toBeGreaterThan(100)
    const unowned: string[] = []
    for (const i of keyLines) {
      let j = i - 1
      while (j >= 0 && carriedLine.test(lines[j] ?? '')) j--
      const comment: string[] = []
      while (j >= 0 && /^\s*\/\//.test(lines[j] ?? '')) comment.unshift(lines[j--] ?? '')
      const text = comment.join(' ')
      const named = (text.match(/[A-Za-z0-9]+/g) ?? []).some((t) => cards.has(t))
      if (!/carried/i.test(text) || !named) unowned.push(`load.ts:${String(i + 1)} ${(lines[i] ?? '').trim()}`)
    }
    expect(unowned).toEqual([])

    const declared = new Set(keyLines.map((i) => carriedLine.exec(lines[i] ?? '')?.[1]))
    const carriedFields = fieldsOrFail().filter((f) => f.carried)
    expect(carriedFields.length).toBeGreaterThan(50)
    expect(carriedFields.filter((f) => !declared.has(f.label.split(/[.[\] ]+/).filter(Boolean).pop())).map((f) => f.label)).toEqual([])
  })
})

// ---- every folder still loads ----

describe('W00d every sample folder still loads', () => {
  test('ARC-8 the walk finds all 15 sample folders (a new folder may add more, never fewer)', () => {
    expect(clients.length).toBeGreaterThanOrEqual(15)
  })
  test.each(clients.map((c): [string, WalkClient] => [c.id, c]))('END-9 %s loads with no issue', (_id, c) => {
    const r = load(sb, c)
    expect(r.ok, `${c.id}: ${r.ok ? '' : show(r.issues)}`).toBe(true)
  }, SLOW)
})
