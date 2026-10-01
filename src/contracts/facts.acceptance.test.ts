// E03 acceptance tests (spec). The fact catalogue: fact keys, value types, sensitive keys.
// Public surface these tests fix (card E03, Build; shapes are amber choices of the spec):
//   DOCUMENT_KINDS: readonly string[]
//   loadFactCatalogue(json: unknown):
//     { ok: true, catalogue: { version: string, entries: readonly Entry[], get(key): Entry | undefined } }
//     | { ok: false, reasons: string[] }        (each reason names the key and what is wrong)
// The entry shape is described in ./__fixtures__/fact-catalogue.ts.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { DOCUMENT_KINDS, loadFactCatalogue } from './facts'
import {
  EXTRACTOR_DOC_KINDS,
  NON_DOCUMENT_SOURCES,
  cleanCatalogue,
  cleanEntry,
  withExtra,
  type FixtureEntry,
} from './__fixtures__/fact-catalogue'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CATALOGUE_FILE = path.join(ROOT, 'data', 'facts', 'catalogue.json')
const SAMPLES = path.join(ROOT, 'reference', 'sample-clients')
const CONTRACT_FILE = path.join(ROOT, 'reference', 'onboarding-contract.md')
const FC = { seed: 20261001, numRuns: 100 } as const

type Cite = { kind: string; ref: string }
type Entry = {
  key: string
  valueType: string
  options?: readonly string[]
  period: string
  repeating: 'none' | { rowKey: string }
  sensitive: string
  suppliedBy: readonly string[]
  label: string
  cites: readonly Cite[]
}
type Catalogue = { version: string; entries: readonly Entry[]; get(key: string): Entry | undefined }

const readJson = (p: string): unknown => JSON.parse(fs.readFileSync(p, 'utf8')) as unknown
const committedRaw = (): { entries: FixtureEntry[] } => readJson(CATALOGUE_FILE) as { entries: FixtureEntry[] }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function loaded(json: unknown): Catalogue {
  const r = loadFactCatalogue(json) as { ok: true; catalogue: Catalogue } | { ok: false; reasons: string[] }
  if (!r.ok) throw new Error(`expected the catalogue to load, refused with: ${r.reasons.join(' | ')}`)
  return r.catalogue
}
function refusal(json: unknown): string {
  const r = loadFactCatalogue(json) as { ok: true; catalogue: Catalogue } | { ok: false; reasons: string[] }
  expect(r.ok).toBe(false)
  if (r.ok) return ''
  expect(r.reasons.length).toBeGreaterThan(0)
  for (const reason of r.reasons) expect(reason.trim()).not.toBe('')
  return r.reasons.join('\n')
}

// The sensitive-name rule as the card states it (check 3): the key "says" sin, birth or account_number.
// Token match on '.' and '_' so "business" (which holds the letters s-i-n) is not a SIN.
function sensitiveKindByName(key: string): 'sin' | 'birth_date' | 'bank_account' | null {
  const tokens = key.split(/[._]/)
  if (key.includes('account_number')) return 'bank_account'
  if (tokens.includes('sin')) return 'sin'
  if (tokens.includes('birth')) return 'birth_date'
  return null
}

// ---------------------------------------------------------------------------------------------
describe('EV-5 the catalogue loads and refuses malformed entries, each with the reason', () => {
  test('EV-5 the committed data/facts/catalogue.json loads with no refusal and holds entries', () => {
    const cat = loaded(committedRaw())
    expect(cat.entries.length).toBeGreaterThan(0)
    expect(cat.entries.length).toBe(committedRaw().entries.length)
    for (const e of cat.entries) expect(cat.get(e.key)).toEqual(e)
    expect(cat.get('no.such.key_test')).toBeUndefined()
  })

  test('EV-5 every committed key is dotted lower case <area>.<subject>.<measure>, named once', () => {
    const keys = committedRaw().entries.map((e) => e['key'] as string)
    for (const k of keys) expect(k).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('EV-5 every committed label is a staff label: at most 60 characters, no final full stop', () => {
    for (const e of committedRaw().entries) {
      const label = e['label'] as string
      expect(label.trim().length, e['key'] as string).toBeGreaterThan(0)
      expect(label.length, e['key'] as string).toBeLessThanOrEqual(60)
      expect(label.endsWith('.'), e['key'] as string).toBe(false)
    }
  })

  test('EV-5 the clean fixture catalogue loads (no false alarm on any value type, period or repeating form)', () => {
    const cat = loaded(cleanCatalogue())
    expect(cat.entries.map((e) => e.valueType).sort()).toEqual(
      ['boolean', 'count', 'date', 'enum', 'money', 'money', 'percent', 'text', 'text'].sort(),
    )
    expect(cat.get('testarea.gadget_test.kind')?.options).toEqual(['alpha', 'beta'])
    expect(cat.get('testarea.slip_test.amount')?.repeating).toEqual({ rowKey: 'slip_number' })
  })

  test('EV-5 planted fault: a duplicate key is refused, naming the key', () => {
    const dup = cleanEntry({ label: 'Second widget (Test)' })
    const why = refusal(withExtra(dup))
    expect(why).toMatch(/duplicate/i)
    expect(why).toContain('testarea.widget_test.closing_amount')
  })

  test.each([
    ['two segments', 'bank.closing_balance'],
    ['four segments', 'bank.statement.closing.balance'],
    ['upper case', 'Bank.statement.closing_balance'],
    ['a space', 'bank.statement.closing balance'],
    ['an empty segment', 'bank..closing_balance'],
    ['a leading digit', '1bank.statement.closing_balance'],
  ])('EV-5 planted fault: a key with %s is refused as not in the dotted pattern', (_what, badKey) => {
    const why = refusal(withExtra(cleanEntry({ key: badKey, label: 'Bad key (Test)' })))
    expect(why).toContain(badKey)
    expect(why).toMatch(/key|pattern|dotted/i)
  })

  test('EV-5 planted fault: an unknown value type is refused, naming the type', () => {
    const why = refusal(withExtra(cleanEntry({ key: 'testarea.bad_test.amount', valueType: 'currency' })))
    expect(why).toContain('testarea.bad_test.amount')
    expect(why).toMatch(/value ?type/i)
    expect(why).toContain('currency')
  })

  test.each([
    ['an empty row key', { rowKey: '' }],
    ['no row key at all', {}],
    ['repeating set to true', true],
  ])('EV-5 planted fault: a repeating key with %s is refused', (_what, repeating) => {
    const why = refusal(withExtra(cleanEntry({ key: 'testarea.rows_test.amount', repeating })))
    expect(why).toContain('testarea.rows_test.amount')
    expect(why).toMatch(/row ?key|repeating/i)
  })

  test('EV-5 planted fault: a label ending in a full stop is refused', () => {
    const why = refusal(withExtra(cleanEntry({ key: 'testarea.stop_test.amount', label: 'Closing amount (Test).' })))
    expect(why).toContain('testarea.stop_test.amount')
    expect(why).toMatch(/label/i)
  })

  test('EV-5 planted fault: a label of 61 characters is refused; 60 characters is accepted', () => {
    const sixty = 'L'.repeat(53) + ' (Test)'
    expect(sixty.length).toBe(60)
    loaded(withExtra(cleanEntry({ key: 'testarea.long_test.amount', label: sixty })))
    const why = refusal(withExtra(cleanEntry({ key: 'testarea.long_test.amount', label: sixty + 'x' })))
    expect(why).toContain('testarea.long_test.amount')
    expect(why).toMatch(/label/i)
  })

  test('EV-5 property: a label is accepted exactly when it is 1 to 60 characters with no final full stop', () => {
    const labelArb = fc.string({ minLength: 1, maxLength: 90 }).filter((s) => s.trim().length > 0 && s === s.trim())
    fc.assert(
      fc.property(labelArb, (label) => {
        const r = loadFactCatalogue(withExtra(cleanEntry({ key: 'testarea.prop_test.amount', label }))) as {
          ok: boolean
        }
        const shouldPass = label.length <= 60 && !label.endsWith('.')
        expect(r.ok).toBe(shouldPass)
      }),
      FC,
    )
  })

  test('EV-5 planted fault: an entry that cites nothing is refused', () => {
    const why = refusal(withExtra(cleanEntry({ key: 'testarea.nocite_test.amount', cites: [] })))
    expect(why).toContain('testarea.nocite_test.amount')
    expect(why).toMatch(/cite/i)
  })

  test('EV-5 several faults in one file: every one is reported, not just the first', () => {
    const why = refusal(
      withExtra(
        cleanEntry({ key: 'testarea.many_test.one', valueType: 'currency' }),
        cleanEntry({ key: 'testarea.many_test.two', label: 'Ends with a stop (Test).' }),
      ),
    )
    expect(why).toContain('testarea.many_test.one')
    expect(why).toContain('testarea.many_test.two')
  })
})

// ---------------------------------------------------------------------------------------------
describe('EV-10 suppliedBy names only document kinds or the named non-document sources', () => {
  test('EV-10 DOCUMENT_KINDS is one list of unique ids, disjoint from the non-document sources', () => {
    expect(Array.isArray(DOCUMENT_KINDS)).toBe(true)
    expect(new Set(DOCUMENT_KINDS).size).toBe(DOCUMENT_KINDS.length)
    for (const k of DOCUMENT_KINDS) expect(k).toMatch(/^[a-z][a-z0-9_-]*$/)
    for (const s of NON_DOCUMENT_SOURCES) expect(DOCUMENT_KINDS).not.toContain(s)
  })

  test('EV-10 DOCUMENT_KINDS holds one kind per extractor family E10 to E25 (their {doc} ids)', () => {
    for (const k of EXTRACTOR_DOC_KINDS) expect(DOCUMENT_KINDS, k).toContain(k)
  })

  test('EV-10 every committed suppliedBy entry is a document kind or a named non-document source', () => {
    const allowed = new Set<string>([...DOCUMENT_KINDS, ...NON_DOCUMENT_SOURCES])
    for (const e of committedRaw().entries) {
      const by = e['suppliedBy'] as string[]
      expect(by.length, e['key'] as string).toBeGreaterThan(0)
      for (const s of by) expect(allowed.has(s), `${e['key'] as string} suppliedBy ${s}`).toBe(true)
    }
  })

  test('EV-10 every extractor family E10 to E25 supplies at least one committed key', () => {
    const suppliers = new Set(committedRaw().entries.flatMap((e) => e['suppliedBy'] as string[]))
    for (const k of EXTRACTOR_DOC_KINDS) expect(suppliers.has(k), k).toBe(true)
  })

  test('EV-10 each named non-document source and each document kind is accepted in suppliedBy', () => {
    for (const s of [...NON_DOCUMENT_SOURCES, ...DOCUMENT_KINDS]) {
      loaded(withExtra(cleanEntry({ key: 'testarea.supplier_test.amount', suppliedBy: [s] })))
    }
  })

  test.each([['bank_statement_typo'], ['client_app'], ['Onboarding'], ['']])(
    'EV-10 planted fault: an unknown supplier %j is refused, naming it',
    (bad) => {
      const why = refusal(
        withExtra(cleanEntry({ key: 'testarea.supplier_test.amount', suppliedBy: ['qbo', bad] })),
      )
      expect(why).toContain('testarea.supplier_test.amount')
      expect(why).toMatch(/supplied ?by|supplier|source/i)
      if (bad !== '') expect(why).toContain(bad)
    },
  )
})

// ---------------------------------------------------------------------------------------------
describe('SEC-4 AI-9 sensitive keys are marked with their kind', () => {
  // The known sensitive facts (card E03, check 3). Keys fixed here so I00 and U02 can name them.
  const KNOWN: ReadonlyArray<readonly [string, string]> = [
    ['shareholder.identity.sin', 'sin'],
    ['director.identity.birth_date', 'birth_date'],
    ['bank.statement.account_number', 'bank_account'],
    ['card.statement.card_number', 'bank_account'],
  ]

  test.each(KNOWN)('SEC-4 AI-9 the known sensitive fact %s is in the catalogue marked %s', (key, kind) => {
    const cat = loaded(committedRaw())
    expect(cat.get(key)?.sensitive).toBe(kind)
  })

  test('SEC-4 AI-9 every committed key whose name says sin, birth or account_number carries that sensitive kind', () => {
    for (const e of committedRaw().entries) {
      const key = e['key'] as string
      const kind = sensitiveKindByName(key)
      if (kind !== null) expect(e['sensitive'], key).toBe(kind)
    }
  })

  test('SEC-4 AI-9 every committed sensitive value is one of none, sin, birth_date, bank_account', () => {
    for (const e of committedRaw().entries) {
      expect(['none', 'sin', 'birth_date', 'bank_account'], e['key'] as string).toContain(e['sensitive'])
    }
  })

  test.each([
    ['shareholder.identity.sin'],
    ['t4.slip.employee_sin'],
    ['director.identity.birth_date'],
    ['onboarding.owner.birth_year'],
    ['bank.statement.account_number'],
    ['loan.statement.account_number'],
  ])('SEC-4 AI-9 planted fault: %s with sensitive none is refused', (key) => {
    const why = refusal(withExtra(cleanEntry({ key, sensitive: 'none', label: 'Planted (Test)' })))
    expect(why).toContain(key)
    expect(why).toMatch(/sensitive/i)
  })

  test('SEC-4 AI-9 planted fault: an unknown sensitive kind is refused', () => {
    const why = refusal(withExtra(cleanEntry({ key: 'testarea.secret_test.value', sensitive: 'secret' })))
    expect(why).toContain('testarea.secret_test.value')
    expect(why).toMatch(/sensitive/i)
  })

  test('SEC-4 AI-9 no false alarm: business_number (letters s-i-n inside a word) with sensitive none loads', () => {
    const cat = loaded(cleanCatalogue())
    expect(cat.get('corporation.identity_test.business_number')?.sensitive).toBe('none')
  })

  test('SEC-4 AI-9 a correctly marked sensitive key loads with its kind', () => {
    const cat = loaded(
      withExtra(
        cleanEntry({ key: 'testarea.person_test.sin', sensitive: 'sin', valueType: 'text', label: 'SIN (Test)' }),
        cleanEntry({
          key: 'testarea.person_test.birth_date',
          sensitive: 'birth_date',
          valueType: 'date',
          label: 'Birth date (Test)',
        }),
      ),
    )
    expect(cat.get('testarea.person_test.sin')?.sensitive).toBe('sin')
    expect(cat.get('testarea.person_test.birth_date')?.sensitive).toBe('birth_date')
  })
})

// ---------------------------------------------------------------------------------------------
// Check 4 reads both lists from the repo.
function sampleClientDirs(): string[] {
  return fs
    .readdirSync(SAMPLES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name))
    .map((d) => path.join(SAMPLES, d.name))
    .sort()
}

/** Every onboarding field named in the ten answer keys' flags (flags[].evidence.onboarding). */
function answerKeyOnboardingFields(): string[] {
  const out = new Set<string>()
  for (const dir of sampleClientDirs()) {
    const key = readJson(path.join(dir, 'answer-key.json')) as {
      flags: Array<{ evidence?: { onboarding?: string[] } }>
    }
    for (const f of key.flags) for (const n of f.evidence?.onboarding ?? []) out.add(n)
  }
  return [...out].sort()
}

/** The top-level fields of every sample client's onboarding.json and answer-key.json. */
function sampleTopLevelFields(): Set<string> {
  const out = new Set<string>()
  for (const dir of sampleClientDirs()) {
    for (const f of ['onboarding.json', 'answer-key.json']) {
      for (const k of Object.keys(readJson(path.join(dir, f)) as object)) out.add(k)
    }
  }
  return out
}

/**
 * The client-app columns the bridge reads into facts, from reference/onboarding-contract.md:
 * bridge.corporation (corporations; corporations, facts and switches) and the v1 shareholders and
 * declared_dividends tables. Row ids, is_test and the Drive folder link are pointers, not facts.
 */
function bridgeFactFields(): string[] {
  const md = fs.readFileSync(CONTRACT_FILE, 'utf8')
  const cols = (s: string): string[] => [...s.matchAll(/([a-z_]+) M\d{4}:\d+/g)].map((m) => m[1] as string)
  const segment = (table: string): string => {
    const i = md.indexOf(`${table}: `)
    if (i < 0) throw new Error(`onboarding contract: no "${table}:" list`)
    const rest = md.slice(i + table.length + 2)
    const end = rest.search(/\.\s|\n/)
    return end < 0 ? rest : rest.slice(0, end)
  }
  const fields = [
    ...cols(segment('- corporations')),
    ...cols(segment('corporations, facts and switches')),
    ...cols(segment('shareholders')),
    ...cols(segment('declared_dividends')),
  ]
  const notFacts = new Set(['id', 'is_test', 'drive_folder_url'])
  return [...new Set(fields.filter((f) => !notFacts.has(f)))].sort()
}

describe('EV-5 every fact the sample clients and the bridge rely on is in the catalogue', () => {
  test('EV-5 the lists read from the repo are the ones expected (guard against a silent empty read)', () => {
    const flagFields = answerKeyOnboardingFields()
    expect(sampleClientDirs()).toHaveLength(10)
    for (const f of ['client_notes', 'owners', 'home_office', 'declared_dividends', 'vehicle']) {
      expect(flagFields).toContain(f)
    }
    const bridge = bridgeFactFields()
    for (const f of [
      'legal_name', 'business_number', 'financial_year_end', 'incorporation_date', 'has_cra_login',
      'claims_small_business_deduction', 'hst_filing_frequency', 'books_kept_by',
      'approximate_share_percent', 'share_class', 'declared_on', 'amount_cents',
    ]) {
      expect(bridge).toContain(f)
    }
    expect(bridge).not.toContain('is_test')
    expect(bridge).not.toContain('firm_name')
  })

  test('EV-5 every committed entry cites where its meaning comes from (CRA form line, contract field or answer key field)', () => {
    for (const e of committedRaw().entries) {
      const cites = e['cites'] as Cite[]
      expect(cites.length, e['key'] as string).toBeGreaterThan(0)
      for (const c of cites) {
        expect(['cra_form', 'onboarding_contract', 'answer_key'], e['key'] as string).toContain(c.kind)
        expect(c.ref.trim().length, e['key'] as string).toBeGreaterThan(0)
      }
    }
  })

  test('EV-5 every answer_key citation names a field the sample clients really hold', () => {
    const top = sampleTopLevelFields()
    for (const e of committedRaw().entries) {
      for (const c of e['cites'] as Cite[]) {
        if (c.kind !== 'answer_key') continue
        const head = c.ref.split(/[.[]/)[0] as string
        expect(top.has(head), `${e['key'] as string} cites ${c.ref}`).toBe(true)
      }
    }
  })

  test.each(answerKeyOnboardingFields())(
    'EV-5 the onboarding field %s that an answer-key flag relies on is cited by a catalogue key',
    (field) => {
      const hit = committedRaw().entries.some((e) =>
        (e['cites'] as Cite[]).some(
          (c) => c.kind === 'answer_key' && (c.ref === field || c.ref.startsWith(`${field}.`) || c.ref.startsWith(`${field}[`)),
        ),
      )
      expect(hit, `no catalogue key cites answer-key field ${field}`).toBe(true)
    },
  )

  test.each(bridgeFactFields())(
    'EV-5 the bridge field %s from the onboarding contract is cited by a catalogue key supplied by onboarding',
    (field) => {
      const hit = committedRaw().entries.some(
        (e) =>
          (e['suppliedBy'] as string[]).includes('onboarding') &&
          (e['cites'] as Cite[]).some(
            (c) => c.kind === 'onboarding_contract' && (c.ref === field || c.ref.endsWith(`.${field}`)),
          ),
      )
      expect(hit, `no onboarding-supplied key cites contract field ${field}`).toBe(true)
    },
  )

  test('EV-5 the reorganisation facts B03 reads are judgment facts with the agreed values', () => {
    const cat = loaded(committedRaw())
    const kind = cat.get('corporation.reorganisation.kind')
    expect(kind?.valueType).toBe('enum')
    expect([...(kind?.options ?? [])].sort()).toEqual(['amalgamation', 'none', 'wind-up'])
    expect(kind?.suppliedBy).toEqual(['judgment'])
    const date = cat.get('corporation.reorganisation.effective_date')
    expect(date?.valueType).toBe('date')
    expect(date?.suppliedBy).toEqual(['judgment'])
  })
})

// ---------------------------------------------------------------------------------------------
describe('EV-5 the catalogue version is a hash of its content', () => {
  test('EV-5 the version is a non-empty hex hash and the same on every load of the same file', () => {
    const a = loaded(committedRaw()).version
    const b = loaded(committedRaw()).version
    expect(a).toMatch(/^[0-9a-f]{16,128}$/)
    expect(b).toBe(a)
  })

  test('EV-5 re-saving with the same content keeps the version (other indentation, other key order)', () => {
    const raw = committedRaw()
    const base = loaded(raw).version
    const reindented = JSON.parse(JSON.stringify(raw, null, 7)) as unknown
    expect(loaded(reindented).version).toBe(base)
    const reordered = {
      entries: raw.entries.map((e) => Object.fromEntries(Object.entries(e).reverse())),
    }
    expect(loaded(reordered).version).toBe(base)
  })

  test.each([
    ['label', (e: FixtureEntry) => ({ ...e, label: 'Changed label (Test)' })],
    ['sensitive', (e: FixtureEntry) => ({ ...e, sensitive: 'bank_account' })],
    ['valueType', (e: FixtureEntry) => ({ ...e, valueType: 'count' })],
    ['period', (e: FixtureEntry) => ({ ...e, period: 'duration' })],
    ['repeating', (e: FixtureEntry) => ({ ...e, repeating: { rowKey: 'account' } })],
    ['suppliedBy', (e: FixtureEntry) => ({ ...e, suppliedBy: ['qbo', 'judgment'] })],
    ['cites', (e: FixtureEntry) => ({ ...e, cites: [{ kind: 'cra_form', ref: 'GIFI 1002 (Test)' }] })],
  ])('EV-5 changing an entry\'s %s changes the version', (_field, change) => {
    const raw = cleanCatalogue()
    const before = loaded(raw).version
    const changed = clone(raw)
    changed.entries[0] = change(changed.entries[0] as FixtureEntry)
    expect(loaded(changed).version).not.toBe(before)
  })

  test('EV-5 adding or removing an entry changes the version', () => {
    const raw = cleanCatalogue()
    const before = loaded(raw).version
    expect(loaded(withExtra(cleanEntry({ key: 'testarea.extra_test.amount' }))).version).not.toBe(before)
    expect(loaded({ entries: raw.entries.slice(1) }).version).not.toBe(before)
  })

  test('EV-5 property: any change to any committed entry\'s label changes the version; restoring it restores the version', () => {
    const raw = committedRaw()
    const base = loaded(raw).version
    const n = raw.entries.length
    const labelArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .map((s) => s.replace(/\.+$/, '').trim())
      .filter((s) => s.length > 0)
    fc.assert(
      fc.property(fc.nat({ max: Math.max(0, n - 1) }), labelArb, (i, label) => {
        const changed = clone(raw)
        const entry = changed.entries[i] as FixtureEntry
        fc.pre(entry['label'] !== label)
        entry['label'] = label
        expect(loaded(changed).version).not.toBe(base)
        expect(loaded(clone(raw)).version).toBe(base)
      }),
      { ...FC, numRuns: 50 },
    )
  })
})
