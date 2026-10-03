// FX7 acceptance tests: the rule defects SC found in landed contracts (card plan/cards/FX7.md, reports/SC-findings.md
// fix list step 3). SC's rules in tools/test/schema-contract-rules.test.mjs are the card's tests (its FX7 KNOWN entries
// are deleted by this spec); these tests pin the behaviour behind each rule so the fix is made at its source.
//
// Public API these tests fix (all already exported; no new names):
//   src/contracts/facts.ts     factEntrySchema, loadFactCatalogue, sensitiveKindForKey
//   src/contracts/reading.ts   EngineStampSchema, ReadingResultSchema
//   src/contracts/amount-grammar.ts  amountGroups
//   src/contracts/auth.ts      StaffUserSchema, SessionSchema
// Spec choices (amber, FX7 spec 3 Oct):
//   - a stray key is refused at every depth of a catalogue entry (top, repeating, each cite); a cite may carry `note`
//     (the committed catalogue uses it);
//   - bank transit and institution numbers are "bank_account", "dob" is "birth_date" (SEC-4 "banking details",
//     "dates of birth");
//   - blank means src/contracts/text.ts isBlank everywhere in these contracts (label, row key, cite ref, enum option,
//     engine name and version, document fingerprint), and nothing is trimmed: a value is kept exactly as given;
//   - a cra_form cite is "Schedule NNN line NNNN" or "T2 line NNN" (E03 fix round 2: 1 to 3 then 3 or 4 digits; 3
//     digits), exactly, the pattern facts.acceptance.test.ts already holds the committed data to.
// A520 patch (FX7 spec review GAPS, 3 Oct): blank is tested by class (strings drawn from BLANK_RANGES for every field,
// with a visible-character control kept exactly); cra_form meets Unicode and NFKC near misses (a property over valid
// refs, one-edit near misses and binary strings, both answers seen); R45 by class (every sensitive stem under every
// people and bank prefix, and every committed "none" key stays "none"). Spec choice (amber, A520 patch): the one
// normaliser that is not a blank rule is `trimWhitespace` exported from src/contracts/text.ts, exactly
// String.prototype.trim (R41 accepts a call to it and nothing else that trims).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { amountGroups } from './amount-grammar'
import { SessionSchema, StaffUserSchema } from './auth'
import { factEntrySchema, loadFactCatalogue, sensitiveKindForKey } from './facts'
import { EngineStampSchema, ReadingResultSchema, valueInBox, type Word } from './reading'
import * as text from './text'
import { BLANK_RANGES, isBlank } from './text'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEED = 20261003
const STRAY = 'strayKeyTest'

/** Characters that are blank under text.ts but survive String.prototype.trim (so a .trim() rule lets them through). */
const BLANK_PAST_TRIM = { 'U+200B': '​', 'U+2800': '⠀', 'U+3164': 'ㅤ', 'U+034F': '͏', 'U+00AD': '­' } as const

type Entry = Record<string, unknown>
const ENTRY = (over: Entry = {}): Entry => ({
  key: 'corp.identity.legal_name',
  valueType: 'text',
  period: 'instant',
  repeating: 'none',
  sensitive: 'none',
  suppliedBy: ['onboarding'],
  label: 'Legal name (Test)',
  cites: [{ kind: 'onboarding_contract', ref: 'corporations.legal_name' }],
  ...over,
})
const loads = (entry: Entry): boolean => loadFactCatalogue({ entries: [entry] }).ok
const reasons = (entry: Entry): string[] => {
  const r = loadFactCatalogue({ entries: [entry] })
  return r.ok ? [] : r.reasons
}

describe('FX7 facts.ts: a closed entry shape (R23)', () => {
  test('EV-5 R23 a clean catalogue entry loads (the control for every planted fault below)', () => {
    expect(loads(ENTRY())).toBe(true)
    expect(loads(ENTRY({ repeating: { rowKey: 'line' } }))).toBe(true)
    expect(loads(ENTRY({ cites: [{ kind: 'answer_key', ref: 'owners', note: 'made up (Test)' }] }))).toBe(true)
  })
  test('EV-5 R23 factEntrySchema refuses a stray key at the top of an entry', () => {
    expect(factEntrySchema.safeParse(ENTRY()).success).toBe(true)
    expect(factEntrySchema.safeParse(ENTRY({ [STRAY]: 'x' })).success).toBe(false)
  })
  test('EV-5 R23 the loader refuses an entry with a stray key and the reason names the key', () => {
    const r = reasons(ENTRY({ [STRAY]: 'x' }))
    expect(r.length).toBeGreaterThan(0)
    expect(r.some((x) => x.includes(STRAY))).toBe(true)
  })
  test('EV-5 R23 a stray key inside repeating or inside a cite is refused too (every depth)', () => {
    expect(loads(ENTRY({ repeating: { rowKey: 'line', [STRAY]: 'x' } }))).toBe(false)
    expect(loads(ENTRY({ cites: [{ kind: 'onboarding_contract', ref: 'corporations.legal_name', [STRAY]: 'x' }] }))).toBe(false)
  })
  test('EV-5 R23 the committed data/facts/catalogue.json still loads under the closed shape', () => {
    const json: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8'))
    const r = loadFactCatalogue(json)
    expect(r.ok ? [] : r.reasons).toEqual([])
  })
})

describe('FX7 facts.ts: one blank definition (R41)', () => {
  const cases = Object.entries(BLANK_PAST_TRIM)
  test('EV-1 R41 a label made only of a character text.ts calls blank is refused as empty', () => {
    expect(cases.length).toBeGreaterThan(0)
    for (const [name, ch] of cases) expect(loads(ENTRY({ label: ch })), name).toBe(false)
  })
  test('EV-1 R41 a repeating row key made only of a blank character is refused', () => {
    for (const [name, ch] of cases) expect(loads(ENTRY({ repeating: { rowKey: ch } })), name).toBe(false)
  })
  test('EV-1 R41 a cite ref made only of a blank character is refused', () => {
    for (const [name, ch] of cases) expect(loads(ENTRY({ cites: [{ kind: 'answer_key', ref: ch }] })), name).toBe(false)
  })
  test('EV-1 R41 an enum option made only of a blank character is refused', () => {
    const base = { key: 'corp.identity.language', valueType: 'enum' }
    expect(loads(ENTRY({ ...base, options: ['en', 'fr'] }))).toBe(true)
    for (const [name, ch] of cases) expect(loads(ENTRY({ ...base, options: ['en', ch] })), name).toBe(false)
  })
  test('EV-1 R41 blank is text.ts isBlank for any mix of blank characters (property)', () => {
    const blankChar = fc.constantFrom(' ', '\t', ' ', '　', ...Object.values(BLANK_PAST_TRIM))
    fc.assert(
      fc.property(fc.array(blankChar, { minLength: 1, maxLength: 6 }), (chars) => {
        expect(loads(ENTRY({ label: chars.join('') })), JSON.stringify(chars.join(''))).toBe(false)
      }),
      { seed: SEED, numRuns: 200 },
    )
  })
})

describe('FX7 facts.ts: sensitive keys, enum options and cites (R45)', () => {
  test('SEC-4 R45 bank transit and institution numbers are bank_account; dob is birth_date', () => {
    expect(sensitiveKindForKey('corp.bank.bank_transit')).toBe('bank_account')
    expect(sensitiveKindForKey('corp.bank.transit_number')).toBe('bank_account')
    expect(sensitiveKindForKey('corp.bank.institution_no')).toBe('bank_account')
    expect(sensitiveKindForKey('owner.person.dob')).toBe('birth_date')
  })
  test('SEC-4 R45 the keys that were already sensitive keep their kind, and a plain key is none (no false alarm)', () => {
    expect(sensitiveKindForKey('corp.bank.account_number')).toBe('bank_account')
    expect(sensitiveKindForKey('owner.person.date_of_birth')).toBe('birth_date')
    expect(sensitiveKindForKey('owner.person.sin')).toBe('sin')
    expect(sensitiveKindForKey('corp.identity.legal_name')).toBe('none')
    expect(sensitiveKindForKey('corp.tax.net_income')).toBe('none')
  })
  // A520: by class, not by example. Every sensitive stem under every prefix the catalogue uses for people and banks
  // (T4 slips name their person "employee_"), so a build that lists the named keys is caught.
  const R45_STEMS: Readonly<Record<string, 'bank_account' | 'birth_date' | 'sin'>> = {
    bank_transit: 'bank_account',
    transit_number: 'bank_account',
    transit_no: 'bank_account',
    institution_no: 'bank_account',
    institution_number: 'bank_account',
    account_number: 'bank_account',
    card_number: 'bank_account',
    dob: 'birth_date',
    date_of_birth: 'birth_date',
    birth_date: 'birth_date',
    sin: 'sin',
  }
  const R45_PREFIXES = ['bank.statement.', 'owner.person.', 'shareholder.identity.', 'director.identity.', 'corp.bank.', 't4.slip.employee_']
  const R45_TABLE = R45_PREFIXES.flatMap((p) => Object.entries(R45_STEMS).map(([stem, kind]) => ({ key: `${p}${stem}`, kind })))
  test('SEC-4 R45 every sensitive stem under every people and bank prefix gets its kind (table, A520)', () => {
    expect(R45_TABLE).toHaveLength(66)
    const got = R45_TABLE.map(({ key }) => `${key} ${sensitiveKindForKey(key)}`)
    expect(got).toEqual(R45_TABLE.map(({ key, kind }) => `${key} ${kind}`))
  })
  test('SEC-4 R45 planted: every table key marked sensitive none is refused by the loader, naming its kind; marked with its kind it loads', () => {
    expect(R45_TABLE.length).toBeGreaterThan(0)
    for (const { key, kind } of R45_TABLE) {
      const r = reasons(ENTRY({ key, label: 'Sensitive (Test)' }))
      // the reason, past the key it starts with, names the kind
      expect(r.some((x) => new RegExp(`\\b${kind}\\b`).test(x.replace(key, ''))), key).toBe(true)
      expect(loads(ENTRY({ key, label: 'Sensitive (Test)', sensitive: kind })), key).toBe(true)
    }
  })
  test('SEC-4 R45 no false alarm: every committed key marked "none" stays "none" (business numbers included), and every committed sensitive key keeps its kind', () => {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')) as {
      entries: { key: string; sensitive: string }[]
    }
    const none = json.entries.filter((e) => e.sensitive === 'none').map((e) => e.key)
    const marked = json.entries.filter((e) => e.sensitive !== 'none')
    expect(none.length).toBeGreaterThan(100)
    expect(none).toContain('onboarding.corporation.business_number')
    expect(marked.length).toBeGreaterThan(0)
    expect(none.filter((k) => sensitiveKindForKey(k) !== 'none')).toEqual([])
    expect(marked.filter((e) => sensitiveKindForKey(e.key) !== e.sensitive).map((e) => e.key)).toEqual([])
    expect(sensitiveKindForKey('corp.identity.business_number')).toBe('none')
  })
  test('SEC-4 R45 planted: a bank transit key marked sensitive none is refused by the loader, naming bank_account', () => {
    const r = reasons(ENTRY({ key: 'corp.bank.bank_transit', label: 'Bank transit (Test)' }))
    expect(r.some((x) => x.includes('bank_account'))).toBe(true)
    expect(loads(ENTRY({ key: 'corp.bank.bank_transit', label: 'Bank transit (Test)', sensitive: 'bank_account' }))).toBe(true)
  })
  test('EV-5 R45 the loader refuses duplicate enum options and says so', () => {
    const base = { key: 'corp.identity.language', valueType: 'enum' }
    expect(loads(ENTRY({ ...base, options: ['en', 'fr'] }))).toBe(true)
    const r = reasons(ENTRY({ ...base, options: ['en', 'fr', 'en'] }))
    expect(r.some((x) => /duplicate/i.test(x))).toBe(true)
  })
  test('EV-5 R45 a cra_form cite in either pattern loads, and every committed cra_form ref fits one', () => {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')) as {
      entries: { cites: { kind: string; ref: string }[] }[]
    }
    const refs = json.entries.flatMap((e) => e.cites.filter((c) => c.kind === 'cra_form').map((c) => c.ref))
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of ['Schedule 125 line 9999', 'Schedule 1 line 300', 'T2 line 061', ...refs]) {
      expect(loads(ENTRY({ key: 'corp.tax.net_income', valueType: 'money', cites: [{ kind: 'cra_form', ref }] })), ref).toBe(true)
    }
  })
  test('EV-5 R45 planted: a cra_form cite that is free text or a near miss is refused', () => {
    const bad = [
      'the net income line (Test)',
      'Schedule 125',
      'Schedule 125 line',
      'T2 line',
      'line 9999',
      'schedule 125 line 9999',
      ' Schedule 125 line 9999',
      'Schedule 125 line 9999 (Test)',
      'Schedule 125 line 9999\n',
      'T2 line 061, Schedule 1 line 300',
      // A520: Unicode and NFKC near misses (full-width digits, a no-break space, a tab, a zero-width space,
      // Arabic-Indic digits): none of them is the ASCII form, so an NFKC fold, \p{Nd} or \s in the pattern is caught.
      'Schedule １２５ line 9999',
      'T２ line 061',
      'Schedule 125 line 9999',
      'Schedule 125 line 9999',
      'Schedule 125\tline 9999',
      'T2 line 061​',
      'Schedule 125 line ٩٩٩٩',
      'T2 line 𝟎𝟔𝟏',
    ]
    for (const ref of bad) {
      expect(loads(ENTRY({ key: 'corp.tax.net_income', valueType: 'money', cites: [{ kind: 'cra_form', ref }] })), JSON.stringify(ref)).toBe(false)
    }
  })
  test('EV-5 R45 a cra_form ref loads exactly when it is "Schedule NNN line NNNN" or "T2 line NNN" (property, A520: valid refs, one-edit near misses and binary strings, both answers seen)', () => {
    // ASCII digits and one ASCII space only: the oracle has no u flag, so \d is [0-9] and the spaces are literal.
    const shape = /^(?:Schedule [0-9]{1,3} line [0-9]{3,4}|T2 line [0-9]{3})$/
    const digits = (min: number, max: number): fc.Arbitrary<string> =>
      fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: min, maxLength: max }).map((a) => a.join(''))
    const validRef = fc.oneof(
      fc.tuple(digits(1, 3), digits(3, 4)).map(([s, l]) => `Schedule ${s} line ${l}`),
      digits(3, 3).map((l) => `T2 line ${l}`),
    )
    /** Characters one edit away from the ASCII form: full-width, Arabic-Indic and maths digits, odd spaces, case. */
    const NEAR = ['１', '２', '٩', '۵', '𝟗', ' ', ' ', ' ', '　', '\t', '\n', '​', '﻿', ' ', '0', '7', 's', 'S', 'x', '-']
    const oneEditOf = (arb: fc.Arbitrary<string>): fc.Arbitrary<string> =>
      arb.chain((ref) =>
        fc
          .record({
            at: fc.integer({ min: 0, max: ref.length }),
            op: fc.constantFrom('insert', 'delete', 'replace'),
            ch: fc.oneof(fc.constantFrom(...NEAR), fc.string({ unit: 'binary', minLength: 1, maxLength: 1 })),
          })
          .map(({ at, op, ch }) =>
            op === 'insert' ? ref.slice(0, at) + ch + ref.slice(at) : op === 'delete' ? ref.slice(0, at) + ref.slice(at + 1) : ref.slice(0, at) + ch + ref.slice(at + 1),
          ),
      )
    const seen = { loaded: 0, refused: 0 }
    fc.assert(
      fc.property(fc.oneof(validRef, oneEditOf(validRef), fc.string({ unit: 'binary', maxLength: 30 })), (ref) => {
        const ok = loads(ENTRY({ key: 'corp.tax.net_income', valueType: 'money', cites: [{ kind: 'cra_form', ref }] }))
        expect(ok, JSON.stringify(ref)).toBe(shape.test(ref))
        if (ok) seen.loaded += 1
        else seen.refused += 1
      }),
      { seed: SEED, numRuns: 600 },
    )
    expect(seen.loaded, 'the property met no valid ref').toBeGreaterThan(50)
    expect(seen.refused, 'the property met no refused ref').toBeGreaterThan(50)
  })
})

describe('FX7 reading.ts: the engine stamp and fingerprint use the one blank rule and keep the value as given (R41, R49)', () => {
  const RESULT = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    documentFingerprint: 'fp (Test)',
    engine: { name: 'textlayer', version: 'pdfjs-dist 6.3.289' },
    readAt: '2026-10-03T12:00:00-04:00',
    pageCount: 1,
    pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
    words: [],
    ...over,
  })
  test('ARC-10 R41 an engine name or version made only of a blank character is refused', () => {
    expect(EngineStampSchema.safeParse({ name: 'textlayer', version: '1' }).success).toBe(true)
    for (const [name, ch] of Object.entries(BLANK_PAST_TRIM)) {
      expect(EngineStampSchema.safeParse({ name: ch, version: '1' }).success, `name ${name}`).toBe(false)
      expect(EngineStampSchema.safeParse({ name: 'textlayer', version: ch }).success, `version ${name}`).toBe(false)
    }
  })
  test('ARC-10 R49 the engine stamp is stored exactly as given, never trimmed', () => {
    const parsed = EngineStampSchema.parse({ name: ' textlayer ', version: '1.0 ' })
    expect(parsed).toEqual({ name: ' textlayer ', version: '1.0 ' })
  })
  test('EV-1 R41 a document fingerprint that is blank (a space or an invisible character) is refused', () => {
    expect(ReadingResultSchema.safeParse(RESULT()).success).toBe(true)
    for (const fp of [' ', '　', ...Object.values(BLANK_PAST_TRIM)]) {
      expect(ReadingResultSchema.safeParse(RESULT({ documentFingerprint: fp })).success, JSON.stringify(fp)).toBe(false)
    }
  })
})

describe('FX7 amount-grammar.ts: a group never spans two pages (R39)', () => {
  const word = (text: string, page: number, left: number, order: number): Word => ({
    text,
    box: { page, left, top: 0.1, width: 0.05, height: 0.02 },
    confidence: 1,
    order,
  })
  test('EV-6 R39 "1" on page 1 and "234.56" on page 2 are two groups, never 1,234.56', () => {
    const groups = amountGroups([word('1', 1, 0.5, 0), word('234.56', 2, 0.56, 1)])
    expect(groups.map((g) => g.cents).sort((a, b) => a - b)).toEqual([100, 23456])
    for (const g of groups) expect(new Set(g.words.map((w) => w.box.page)).size).toBe(1)
  })
  test('EV-6 R39 control: the same two words on one page still join to 1,234.56', () => {
    expect(amountGroups([word('1', 1, 0.5, 0), word('234.56', 1, 0.56, 1)]).map((g) => g.cents)).toEqual([123456])
  })
  test('EV-6 R39 for any thousands split across two pages, no group holds words of two pages and the cents stay apart (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 40 }),
        (head, group, cents, p1, offset) => {
          const p2 = p1 + offset
          const tail = `${String(group).padStart(3, '0')}.${String(cents).padStart(2, '0')}`
          const groups = amountGroups([word(String(head), p1, 0.5, 0), word(tail, p2, 0.56, 1)])
          const joined = head * 100000 + group * 100 + cents
          for (const g of groups) {
            expect(new Set(g.words.map((w) => w.box.page)).size).toBe(1)
            expect(g.cents).not.toBe(joined)
          }
        },
      ),
      { seed: SEED, numRuns: 300 },
    )
  })
})

describe('FX7 auth.ts: closed staff and session shapes (R23)', () => {
  const USER = { id: 'u-1 (Test)', displayName: 'Pat Preparer (Test)', roles: ['preparer'] }
  const at = new Date('2026-10-03T12:00:00-04:00')
  const SESSION = { sessionId: 's-1 (Test)', userId: 'u-1 (Test)', roles: ['cpa'], signedInAt: at, lastSeenAt: at, expiresAt: at }
  test('EV-5 R23 StaffUserSchema refuses a stray key; the clean user parses', () => {
    expect(StaffUserSchema.safeParse(USER).success).toBe(true)
    expect(StaffUserSchema.safeParse({ ...USER, [STRAY]: 'x' }).success).toBe(false)
  })
  test('EV-5 R23 SessionSchema refuses a stray key; the clean session parses', () => {
    expect(SessionSchema.safeParse(SESSION).success).toBe(true)
    expect(SessionSchema.safeParse({ ...SESSION, [STRAY]: 'x' }).success).toBe(false)
  })
  test('EV-5 R23 planted: a role smuggled in as a stray key (isOwner) is refused, not dropped silently', () => {
    expect(StaffUserSchema.safeParse({ ...USER, isOwner: true }).success).toBe(false)
  })
})

describe('FX7 blank by class: every field refuses any string text.ts calls blank, and keeps a visible one exactly (R41, A520)', () => {
  const RESULT_OF = (fp: string): Record<string, unknown> => ({
    documentFingerprint: fp,
    engine: { name: 'textlayer', version: 'pdfjs-dist 6.3.289' },
    readAt: '2026-10-03T12:00:00-04:00',
    pageCount: 1,
    pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
    words: [],
  })
  const ENUM = { key: 'corp.identity.language', valueType: 'enum' }
  const loaded = (entry: Entry): Entry | undefined => {
    const r = loadFactCatalogue({ entries: [entry] })
    return r.ok ? r.catalogue.get(String(entry['key'])) : undefined
  }
  /** Each field: whether a value s is accepted there, and the value as stored after a load or parse. */
  const FIELDS: Readonly<Record<string, { accepts: (s: string) => boolean; kept: (s: string) => unknown }>> = {
    label: {
      accepts: (s) => loads(ENTRY({ label: s })),
      kept: (s) => loaded(ENTRY({ label: s }))?.['label'],
    },
    'repeating.rowKey': {
      accepts: (s) => loads(ENTRY({ repeating: { rowKey: s } })),
      kept: (s) => (loaded(ENTRY({ repeating: { rowKey: s } }))?.['repeating'] as { rowKey?: unknown } | undefined)?.rowKey,
    },
    'cite ref': {
      accepts: (s) => loads(ENTRY({ cites: [{ kind: 'answer_key', ref: s }] })),
      kept: (s) => (loaded(ENTRY({ cites: [{ kind: 'answer_key', ref: s }] }))?.['cites'] as { ref: unknown }[] | undefined)?.[0]?.ref,
    },
    'enum option': {
      accepts: (s) => loads(ENTRY({ ...ENUM, options: ['en', s] })),
      kept: (s) => (loaded(ENTRY({ ...ENUM, options: ['en', s] }))?.['options'] as unknown[] | undefined)?.[1],
    },
    'engine name': {
      accepts: (s) => EngineStampSchema.safeParse({ name: s, version: '1' }).success,
      kept: (s) => {
        const r = EngineStampSchema.safeParse({ name: s, version: '1' })
        return r.success ? r.data.name : undefined
      },
    },
    'engine version': {
      accepts: (s) => EngineStampSchema.safeParse({ name: 'textlayer', version: s }).success,
      kept: (s) => {
        const r = EngineStampSchema.safeParse({ name: 'textlayer', version: s })
        return r.success ? r.data.version : undefined
      },
    },
    documentFingerprint: {
      accepts: (s) => ReadingResultSchema.safeParse(RESULT_OF(s)).success,
      kept: (s) => {
        const r = ReadingResultSchema.safeParse(RESULT_OF(s))
        return r.success ? r.data.documentFingerprint : undefined
      },
    },
  }
  const fields = Object.entries(FIELDS)

  /** One code point drawn from BLANK_RANGES, each range as likely as any other. */
  const blankChar = fc
    .constantFrom(...BLANK_RANGES)
    .chain(([lo, hi]) => fc.integer({ min: lo, max: hi }))
    .map((cp) => String.fromCodePoint(cp))
  const blankString = fc.array(blankChar, { minLength: 1, maxLength: 6 }).map((a) => a.join(''))
  /** Every range's two ends and middle: the class, table by table. */
  const RANGE_POINTS = BLANK_RANGES.flatMap(([lo, hi]) => [lo, Math.floor((lo + hi) / 2), hi])
  /** Blank under text.ts but neither trimmed by String.prototype.trim nor in the five "past trim" characters. */
  const PLANT_MISSES = { 'U+180E': '᠎', 'U+FEFF': '﻿', 'U+2060': '⁠', 'U+E0001': '\u{e0001}' } as const

  test('EV-1 R41 the class tables are real: seven fields, every range point and every named character is blank under text.ts', () => {
    expect(fields).toHaveLength(7)
    expect(BLANK_RANGES.length).toBeGreaterThan(0)
    expect(RANGE_POINTS.length).toBe(BLANK_RANGES.length * 3)
    for (const cp of RANGE_POINTS) expect(isBlank(String.fromCodePoint(cp)), cp.toString(16)).toBe(true)
    for (const [name, ch] of Object.entries(PLANT_MISSES)) expect(isBlank(ch), name).toBe(true)
  })

  test('EV-1 R41 planted: U+180E, U+FEFF, U+2060 and U+E0001 (blank, but past trim and past the five named characters) are refused in every field', () => {
    for (const [field, { accepts }] of fields) {
      for (const [name, ch] of Object.entries(PLANT_MISSES)) {
        expect(accepts(ch), `${field} ${name}`).toBe(false)
        expect(accepts(`${ch} ${ch}`), `${field} ${name} twice`).toBe(false)
      }
    }
  })

  test('EV-1 R41 every BLANK_RANGES range (both ends and the middle) is refused as a whole value in every field', () => {
    for (const [field, { accepts }] of fields) {
      const passed = RANGE_POINTS.filter((cp) => accepts(String.fromCodePoint(cp))).map((cp) => `U+${cp.toString(16).toUpperCase()}`)
      expect(passed, field).toEqual([])
    }
  })

  test('EV-1 R41 any string drawn from BLANK_RANGES is refused in every field (property)', () => {
    for (const [field, { accepts }] of fields) {
      fc.assert(
        fc.property(blankString, (s) => {
          expect(isBlank(s)).toBe(true)
          expect(accepts(s), `${field} ${JSON.stringify(s)}`).toBe(false)
        }),
        { seed: SEED, numRuns: 150 },
      )
    }
  })

  test('EV-1 R49 control: a visible character between blanks (U+200B x U+3000) is accepted in every field and kept exactly', () => {
    const s = '​x　'
    for (const [field, { accepts, kept }] of fields) {
      expect(accepts(s), field).toBe(true)
      expect(kept(s), field).toBe(s)
    }
  })

  test('EV-1 R49 control: any visible character between blank runs is accepted in every field and kept exactly (property)', () => {
    const visible = fc.constantFrom('x', 'É', '٩', '中', '1', '(Test)')
    for (const [field, { accepts, kept }] of fields) {
      fc.assert(
        fc.property(blankString, visible, blankString, (a, v, b) => {
          const s = `${a}${v}${b}`
          expect(accepts(s), `${field} ${JSON.stringify(s)}`).toBe(true)
          expect(kept(s), field).toBe(s)
        }),
        { seed: SEED, numRuns: 60 },
      )
    }
  })
})

describe('FX7 text.ts: the one trim that is not a blank rule (R41, A520)', () => {
  const TRIM_HELPER = 'trimWhitespace'
  /** Looked up by name, so before the build each test fails with this reason while typecheck stays green. */
  const helper = (): ((s: string) => string) => {
    const f = (text as Record<string, unknown>)[TRIM_HELPER]
    if (typeof f !== 'function') throw new Error(`src/contracts/text.ts does not export ${TRIM_HELPER} yet (FX7, A520)`)
    return f as (s: string) => string
  }
  test('EV-1 R41 trimWhitespace strips leading and trailing white space and line ends, nothing else', () => {
    const trim = helper()
    expect(trim('  Pat Preparer (Test)  ')).toBe('Pat Preparer (Test)')
    expect(trim(' \t1,234.56\n　')).toBe('1,234.56')
    expect(trim('﻿ a  ')).toBe('a')
    expect(trim('a  b')).toBe('a  b')
    expect(trim('')).toBe('')
    // not a blank rule: invisible characters that are not white space stay
    expect(trim('​x​')).toBe('​x​')
    expect(trim(' ⁠ ')).toBe('⁠')
  })
  test('EV-1 R41 trimWhitespace is exactly String.prototype.trim (property)', () => {
    const trim = helper()
    const unit = fc.constantFrom(' ', '\t', '\n', '\r', ' ', ' ', '　', '﻿', ' ', '​', '⁠', 'a', '1', '中')
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit, maxLength: 12 }), fc.string({ unit: 'binary', maxLength: 20 })), (s) => {
        expect(trim(s), JSON.stringify(s)).toBe(s.trim())
      }),
      { seed: SEED, numRuns: 400 },
    )
  })
  test('EV-6 R41 behaviour kept after the move onto the helper: an amount word with white space at its ends still reads, and a padded text value still matches', () => {
    const w = (t: string, left: number, order: number): Word => ({ text: t, box: { page: 1, left, top: 0.1, width: 0.05, height: 0.02 }, confidence: 1, order })
    expect(amountGroups([w(' 1,234.56\t', 0.5, 0)]).map((g) => g.cents)).toEqual([123456])
    const result = {
      documentFingerprint: 'fp (Test)',
      engine: { name: 'textlayer', version: '1' },
      readAt: '2026-10-03T12:00:00-04:00',
      pageCount: 1,
      pages: [{ number: 1, widthPt: 612, heightPt: 792, hasTextLayer: true }],
      words: [w('Pat', 0.1, 1), w('Preparer', 0.16, 2), w('(Test)', 0.22, 3)],
    }
    const box = { page: 1, left: 0, top: 0, width: 1, height: 1 }
    expect(valueInBox(result, box, '  Pat  Preparer (Test)\t')).toEqual({ ok: true })
    expect(valueInBox(result, box, 'Pat Preparer')).toEqual({ ok: true })
  })
})
