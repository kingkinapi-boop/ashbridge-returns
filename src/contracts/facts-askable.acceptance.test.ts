// E03A acceptance tests (spec). The client-askable facts the question bank topics G12 to G17 need.
// Card plan/cards/E03A.md; clauses AI-12, ARC-2, END-7, R27, R28 (blueprint 05 reconciling-item rows).
//
// Amber choices of this spec (each reversible by editing this file in a new spec job):
// - "A key citing a row" is the table below: topic -> blueprint 05 row -> the askable keys that resolve it.
//   The catalogue's own cite kinds stay E03's three (cra_form, onboarding_contract, answer_key; E03's
//   acceptance test pins them), so a blueprint row is not a cite kind and no code change is needed.
// - Rows are the blueprint 05 reconciling-item codes (R..) a client answer can settle; a topic whose checks
//   have no R row (G15 shareholder-loan continuity, G16 vehicle and home office) names its CK clause instead.
// - "Askable" means suppliedBy holds onboarding or qa (card E03A Goal).
// - New keys named from blueprint wording: R27 not_available_for_use -> qa.assets.purchased_not_in_use
//   (money, instant at year end); R28 disposal -> qa.assets.disposed (money, duration over the year);
//   both cite T2 Schedule 8 (CK-44's source). G16 gets qa.vehicle.ownership (enum owned, leased) and
//   qa.home_office.principal_place (boolean), because G11 already owns every vehicle and home key.
// - G10 and G11 key lists are copied from their specs (claude/G10, claude/G11; reports/G1x-spec.md).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue } from './facts'
import { cleanEntry, type FixtureEntry } from './__fixtures__/fact-catalogue'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CATALOGUE_FILE = path.join(ROOT, 'data', 'facts', 'catalogue.json')
const SAMPLES = path.join(ROOT, 'reference', 'sample-clients')
const CONTRACT_FILE = path.join(ROOT, 'reference', 'onboarding-contract.md')

type Cite = { kind: string; ref: string }
type Entry = {
  key: string
  valueType: string
  options?: readonly string[]
  period: string
  repeating: unknown
  sensitive: string
  suppliedBy: readonly string[]
  label: string
  cites: readonly Cite[]
}
type Topic = 'G12' | 'G13' | 'G14' | 'G15' | 'G16' | 'G17'
/** topic -> blueprint 05 row -> the askable keys that resolve it */
type RowTable = Record<string, Record<string, readonly string[]>>

const readJson = (p: string): unknown => JSON.parse(fs.readFileSync(p, 'utf8')) as unknown
const committedRaw = (): { entries: FixtureEntry[] } => readJson(CATALOGUE_FILE) as { entries: FixtureEntry[] }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function committedEntries(): Entry[] {
  const r = loadFactCatalogue(committedRaw())
  if (!r.ok) throw new Error(`the committed catalogue must load, refused with: ${r.reasons.join(' | ')}`)
  return r.catalogue.entries as unknown as Entry[]
}

// ---------------------------------------------------------------------------------------------
// The table (card E03A Spec 1).
const TOPIC_ROWS: Record<Topic, { topic: string; rows: Record<string, readonly string[]> }> = {
  G12: {
    topic: 'assets-cca',
    rows: {
      R27: ['qa.assets.purchased_not_in_use'], // not_available_for_use: an asset bought but not yet available for use
      R28: ['qa.assets.disposed'], // disposal: an asset sold or written off in the year
    },
  },
  G13: {
    topic: 'shareholders-dividends',
    rows: {
      R02: ['onboarding.dividend.declared_on'], // accrued_unpaid: declared by year end, paid after (CK-26)
      R16: ['onboarding.capital_dividend.received'], // capital_dividend: s.83(2), no T5
    },
  },
  G14: {
    topic: 'payroll-bonuses',
    rows: {
      R02: ['onboarding.owner_bonus.paid'], // accrued_unpaid: a bonus accrued at year end, paid after (CK-47)
    },
  },
  G15: {
    topic: 'shareholder-loans',
    rows: {
      'CK-43': ['onboarding.shareholder_loan.balance', 'qa.shareholder.loan_balance'], // loan continuity
    },
  },
  G16: {
    topic: 'vehicle-home-office',
    rows: {
      'CK-42': ['qa.vehicle.ownership', 'qa.home_office.principal_place'], // vehicles and home office items
    },
  },
  G17: {
    topic: 'cra-hst-instalments',
    rows: {
      R07: ['onboarding.corporation.hst_basis'], // tax_in_amount: quick method tax-included (CK-20)
    },
  },
}

/** The keys G10 (revenue) and G11 (expenses) already resolve, from their specs. */
const G10_KEYS = ['qa.revenue.annual_sales', 'onboarding.sales_channels.list', 'onboarding.fx.has_foreign_currency'] as const
const G11_KEYS = [
  'onboarding.expense.personal_card_business_items',
  'onboarding.home_office.claimed',
  'onboarding.vehicle.business_use',
  'qa.home.personal_costs',
  'qa.home.business_use_share',
  'qa.vehicle.business_km',
  'qa.vehicle.total_km',
  'qa.vehicle.cost',
] as const

/** The keys this card adds (card E03A Spec 2). */
const NEW_KEYS = [
  'qa.assets.purchased_not_in_use',
  'qa.assets.disposed',
  'qa.vehicle.ownership',
  'qa.home_office.principal_place',
] as const

function fullTable(): RowTable {
  const t: RowTable = { G10: { revenue: G10_KEYS }, G11: { expenses: G11_KEYS } }
  for (const [id, v] of Object.entries(TOPIC_ROWS)) t[id] = v.rows
  return t
}

// ---------------------------------------------------------------------------------------------
// Helpers under test themselves (planted faults below prove each catches what it should).
const isAskable = (e: Entry): boolean => e.suppliedBy.includes('onboarding') || e.suppliedBy.includes('qa')

/** One finding per topic row with no askable catalogue key, naming topic, row and key. */
function rowGaps(entries: readonly Entry[], rows: Record<string, readonly string[]>, topic: string): string[] {
  const byKey = new Map(entries.map((e) => [e.key, e]))
  const out: string[] = []
  for (const [row, keys] of Object.entries(rows)) {
    if (keys.length === 0) out.push(`${topic} ${row}: no key listed`)
    for (const k of keys) {
      const e = byKey.get(k)
      if (e === undefined) out.push(`${topic} ${row}: ${k} is not in the catalogue`)
      else if (!isAskable(e)) out.push(`${topic} ${row}: ${k} is not askable (suppliedBy ${e.suppliedBy.join(', ')})`)
    }
  }
  return out
}

/** One finding per key listed under more than one topic (the one-fact rule). */
function sharedKeys(table: RowTable): string[] {
  const owner = new Map<string, string>()
  const out: string[] = []
  for (const [topic, rows] of Object.entries(table)) {
    for (const k of new Set(Object.values(rows).flat())) {
      const first = owner.get(k)
      if (first !== undefined) out.push(`${k} is listed under ${first} and ${topic}`)
      else owner.set(k, topic)
    }
  }
  return out
}

// E03's cite rules (E03 fix round 2 and round 3), repeated here for the keys this card names.
const CRA_FORM_REF = /^(?:Schedule \d{1,3} line \d{3,4}|T2 line \d{3})$/
const CONTRACT_REF = /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/

function contractFields(): Set<string> {
  const md = fs.readFileSync(CONTRACT_FILE, 'utf8')
  const start = md.indexOf('## 1.')
  const end = md.indexOf('## 2.')
  if (start < 0 || end < start) throw new Error('onboarding contract: section 1 not found')
  const out = new Set<string>()
  for (const line of md.slice(start, end).split('\n')) {
    const headers = [...line.matchAll(/([a-z][a-z0-9_]*)(?:, [a-z ]+?)?: /g)]
    headers.forEach((h, i) => {
      const from = h.index + h[0].length
      const to = i + 1 < headers.length ? (headers[i + 1]?.index ?? line.length) : line.length
      for (const m of line.slice(from, to).matchAll(/([a-z][a-z0-9_]*) M\d{4}:\d+/g)) out.add(`${h[1] as string}.${m[1] as string}`)
    })
  }
  return out
}

function sampleFields(): Set<string> {
  const out = new Set<string>()
  const dirs = fs.readdirSync(SAMPLES, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d\d-/.test(d.name))
  for (const d of dirs) {
    for (const f of ['onboarding.json', 'answer-key.json']) {
      const json = readJson(path.join(SAMPLES, d.name, f)) as { flags?: Array<{ evidence?: { onboarding?: string[] } }> }
      for (const k of Object.keys(json)) out.add(k)
      for (const fl of json.flags ?? []) for (const n of fl.evidence?.onboarding ?? []) out.add(n)
    }
  }
  return out
}

/** One finding per cite of the given keys that breaks E03's rule for its kind. */
function citeFindings(entries: readonly Entry[], keys: readonly string[]): string[] {
  const fields = contractFields()
  const samples = sampleFields()
  const out: string[] = []
  for (const e of entries.filter((x) => keys.includes(x.key))) {
    if (e.cites.length === 0) out.push(`${e.key}: cites nothing`)
    for (const c of e.cites) {
      if (c.kind === 'cra_form' && !CRA_FORM_REF.test(c.ref)) out.push(`${e.key}: cra_form cite "${c.ref}" is free text`)
      else if (c.kind === 'onboarding_contract' && !(CONTRACT_REF.test(c.ref) && fields.has(c.ref))) {
        out.push(`${e.key}: onboarding_contract cite "${c.ref}" names no contract field`)
      } else if (c.kind === 'answer_key' && !samples.has(c.ref) && !samples.has(c.ref.split(/[.[]/)[0] as string)) {
        out.push(`${e.key}: answer_key cite "${c.ref}" names no field a sample client holds`)
      } else if (!['cra_form', 'onboarding_contract', 'answer_key'].includes(c.kind)) {
        out.push(`${e.key}: unknown cite kind "${c.kind}"`)
      }
    }
  }
  return out
}

/** A label a client would read: a question, an instruction, or one that speaks to "you". */
const CLIENT_SENTENCE = /\?|^(?:did|do|does|have|has|is|are|was|were|please|tell|enter|upload|list)\b|\byou(?:r)?\b/i

/** A made-up catalogue that satisfies the whole table: one askable entry per table key. */
function satisfyingEntries(): Entry[] {
  const keys = [...new Set(Object.values(fullTable()).flatMap((rows) => Object.values(rows).flat()))]
  return keys.map((key) => cleanEntry({ key, suppliedBy: ['qa'], label: 'Askable fact (Test)' }) as unknown as Entry)
}

// ---------------------------------------------------------------------------------------------
describe('AI-12 every question topic G12 to G17 has an askable catalogue key for each blueprint 05 row it resolves', () => {
  test.each(Object.entries(TOPIC_ROWS).map(([id, v]) => [id, v.topic, Object.keys(v.rows).join(', ')] as const))(
    'AI-12 %s (%s): rows %s each resolve to at least one askable key (origin onboarding or qa)',
    (id) => {
      const rows = TOPIC_ROWS[id as Topic].rows
      expect(Object.keys(rows).length).toBeGreaterThan(0)
      expect(rowGaps(committedEntries(), rows, id)).toEqual([])
    },
  )

  test('R27 G12 assets-cca: the not_available_for_use row has its askable key qa.assets.purchased_not_in_use', () => {
    expect(rowGaps(committedEntries(), { R27: TOPIC_ROWS.G12.rows['R27'] ?? [] }, 'G12')).toEqual([])
  })

  test('R28 G12 assets-cca: the disposal row has its askable key qa.assets.disposed', () => {
    expect(rowGaps(committedEntries(), { R28: TOPIC_ROWS.G12.rows['R28'] ?? [] }, 'G12')).toEqual([])
  })

  test('AI-12 the rows named are blueprint 05 rows: every R code is in the reconciling-item table, every CK id is a clause', () => {
    const bp = fs.readFileSync(path.join(ROOT, 'blueprint', '05-checks.md'), 'utf8')
    for (const { rows } of Object.values(TOPIC_ROWS)) {
      for (const row of Object.keys(rows)) {
        if (row.startsWith('R')) expect(bp, row).toMatch(new RegExp(`^\\| ${row} \\| `, 'm'))
        else expect(bp, row).toContain(`**${row}**`)
      }
    }
    expect(TOPIC_ROWS.G12.rows['R27']).toBeDefined()
    expect(TOPIC_ROWS.G12.rows['R28']).toBeDefined()
  })

  test('AI-12 planted fault: a row whose key is missing, or supplied only by a document or QBO, is caught naming topic, row and key', () => {
    const clean = satisfyingEntries()
    expect(rowGaps(clean, TOPIC_ROWS.G12.rows, 'G12')).toEqual([])

    const missing = clean.filter((e) => e.key !== 'qa.assets.disposed')
    expect(rowGaps(missing, TOPIC_ROWS.G12.rows, 'G12')).toEqual(['G12 R28: qa.assets.disposed is not in the catalogue'])

    const notAskable = clone(clean)
    const e = notAskable.find((x) => x.key === 'qa.assets.purchased_not_in_use')
    if (e === undefined) throw new Error('fixture lacks the R27 key')
    e.suppliedBy = ['qbo', 'fs']
    const found = rowGaps(notAskable, TOPIC_ROWS.G12.rows, 'G12')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(/^G12 R27: qa\.assets\.purchased_not_in_use is not askable/)

    expect(rowGaps(clean, { R99: [] }, 'G12')).toEqual(['G12 R99: no key listed'])
  })
})

// ---------------------------------------------------------------------------------------------
describe('ARC-2 the one-fact rule: a fact belongs to exactly one bank topic', () => {
  test('ARC-2 no key is listed under two topics across G10 to G17', () => {
    expect(sharedKeys(fullTable())).toEqual([])
  })

  test('ARC-2 the existing vehicle (and home) keys stay with G11: no G12 to G17 row lists one of G11\'s keys', () => {
    const g12to17 = Object.values(TOPIC_ROWS).flatMap((v) => Object.values(v.rows).flat())
    for (const k of G11_KEYS) expect(g12to17, k).not.toContain(k)
    const vehicle = committedEntries().filter((e) => e.key.startsWith('qa.vehicle.') || e.key.startsWith('onboarding.vehicle.'))
    for (const e of vehicle) {
      if ((G11_KEYS as readonly string[]).includes(e.key)) continue
      expect(TOPIC_ROWS.G16.rows['CK-42'], `${e.key} is a vehicle key outside G11 and must be G16's`).toContain(e.key)
    }
  })

  test('ARC-2 G16 (vehicle, home, office) still has askable keys of its own after G11\'s are excluded', () => {
    const g16 = Object.values(TOPIC_ROWS.G16.rows).flat()
    expect(g16.length).toBeGreaterThan(0)
    expect(rowGaps(committedEntries(), TOPIC_ROWS.G16.rows, 'G16')).toEqual([])
  })

  test('ARC-2 planted fault: a key listed under G11 and G16 is caught, naming the key and both topics', () => {
    const t = fullTable()
    t['G16'] = { 'CK-42': ['qa.vehicle.ownership', 'qa.vehicle.cost'] }
    expect(sharedKeys(t)).toEqual(['qa.vehicle.cost is listed under G11 and G16'])
    const t2 = fullTable()
    t2['G15'] = { 'CK-43': ['onboarding.dividend.declared_on'] }
    expect(sharedKeys(t2)).toEqual(['onboarding.dividend.declared_on is listed under G13 and G15'])
  })

  test('ARC-2 no false alarm: a key listed under two rows of the same topic is not a shared key', () => {
    const t = fullTable()
    t['G13'] = { R02: ['onboarding.dividend.declared_on'], R16: ['onboarding.dividend.declared_on'] }
    expect(sharedKeys(t)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
describe('R27 R28 the new keys carry value type, sensitivity and cites per E03', () => {
  const get = (key: string): Entry => {
    const e = committedEntries().find((x) => x.key === key)
    if (e === undefined) throw new Error(`${key} is not in the catalogue`)
    return e
  }

  test('R27 qa.assets.purchased_not_in_use: money, an instant at year end, not sensitive, asked of the client, cites T2 Schedule 8', () => {
    const e = get('qa.assets.purchased_not_in_use')
    expect(e.valueType).toBe('money')
    expect(e.period).toBe('instant')
    expect(e.sensitive).toBe('none')
    expect(e.suppliedBy).toContain('qa')
    expect(e.cites.some((c) => c.kind === 'cra_form' && /^Schedule 8 line \d{3}$/.test(c.ref))).toBe(true)
  })

  test('R28 qa.assets.disposed: money, a duration over the year, not sensitive, asked of the client, cites T2 Schedule 8', () => {
    const e = get('qa.assets.disposed')
    expect(e.valueType).toBe('money')
    expect(e.period).toBe('duration')
    expect(e.sensitive).toBe('none')
    expect(e.suppliedBy).toContain('qa')
    expect(e.cites.some((c) => c.kind === 'cra_form' && /^Schedule 8 line \d{3}$/.test(c.ref))).toBe(true)
  })

  test('AI-12 G16 qa.vehicle.ownership is an enum with owned and leased; qa.home_office.principal_place is a boolean; both asked, not sensitive', () => {
    const v = get('qa.vehicle.ownership')
    expect(v.valueType).toBe('enum')
    expect([...(v.options ?? [])].sort()).toEqual(['leased', 'owned'])
    const h = get('qa.home_office.principal_place')
    expect(h.valueType).toBe('boolean')
    for (const e of [v, h]) {
      expect(e.sensitive, e.key).toBe('none')
      expect(e.suppliedBy, e.key).toContain('qa')
    }
  })

  test('AI-12 every key the table names cites per E03\'s rules (Schedule or T2 line, a contract field, or a sample-client field)', () => {
    const keys = [...new Set(Object.values(TOPIC_ROWS).flatMap((v) => Object.values(v.rows).flat()))]
    const entries = committedEntries()
    for (const k of NEW_KEYS) expect(entries.map((e) => e.key), k).toContain(k)
    expect(citeFindings(entries, keys)).toEqual([])
  })

  test('AI-12 planted fault: a free-text Schedule 8 cite, an unknown contract field and an unheld answer field are each caught', () => {
    const base = cleanEntry({ key: 'qa.assets.disposed', suppliedBy: ['qa'], cites: [] }) as unknown as Entry
    const planted = (cite: Cite): string[] => citeFindings([{ ...base, cites: [cite] }], ['qa.assets.disposed'])
    expect(planted({ kind: 'cra_form', ref: 'Schedule 8 proceeds of disposition' })).toHaveLength(1)
    expect(planted({ kind: 'onboarding_contract', ref: 'corporations.no_such_field_test' })).toHaveLength(1)
    expect(planted({ kind: 'answer_key', ref: 'zz_no_such_field_test' })).toHaveLength(1)
    expect(citeFindings([base], ['qa.assets.disposed'])).toEqual(['qa.assets.disposed: cites nothing'])
    // no false alarm on good cites
    expect(planted({ kind: 'cra_form', ref: 'Schedule 8 line 207' })).toEqual([])
    expect(planted({ kind: 'answer_key', ref: 'assets' })).toEqual([])
    expect(planted({ kind: 'onboarding_contract', ref: 'corporations.legal_name' })).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
describe('END-7 the new keys hold no client sentence: their labels are staff labels', () => {
  test('END-7 each new key has a staff label: no question, no instruction, no "you", at most 60 characters, no full stop', () => {
    const entries = committedEntries()
    for (const k of NEW_KEYS) {
      const e = entries.find((x) => x.key === k)
      expect(e, `${k} is not in the catalogue`).toBeDefined()
      if (e === undefined) continue
      expect(e.label, k).not.toMatch(CLIENT_SENTENCE)
      expect(e.label.length, k).toBeLessThanOrEqual(60)
      expect(e.label.endsWith('.'), k).toBe(false)
    }
  })

  test('END-7 planted fault: a client question as a label is caught; a staff label is not', () => {
    expect('Did you sell any equipment this year?').toMatch(CLIENT_SENTENCE)
    expect('Your vehicle: owned or leased').toMatch(CLIENT_SENTENCE)
    expect('Please list assets not yet in use').toMatch(CLIENT_SENTENCE)
    expect('Assets bought, not available for use at year end').not.toMatch(CLIENT_SENTENCE)
    expect('Asset disposals in the year (proceeds)').not.toMatch(CLIENT_SENTENCE)
  })
})
