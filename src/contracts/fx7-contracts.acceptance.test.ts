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
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { amountGroups } from './amount-grammar'
import { SessionSchema, StaffUserSchema } from './auth'
import { factEntrySchema, loadFactCatalogue, sensitiveKindForKey } from './facts'
import { EngineStampSchema, ReadingResultSchema, type Word } from './reading'

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
    ]
    for (const ref of bad) {
      expect(loads(ENTRY({ key: 'corp.tax.net_income', valueType: 'money', cites: [{ kind: 'cra_form', ref }] })), JSON.stringify(ref)).toBe(false)
    }
  })
  test('EV-5 R45 a cra_form ref loads exactly when it is "Schedule NNN line NNNN" or "T2 line NNN" (property)', () => {
    const shape = /^(?:Schedule \d{1,3} line \d{3,4}|T2 line \d{3})$/
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (ref) => {
        const ok = loads(ENTRY({ key: 'corp.tax.net_income', valueType: 'money', cites: [{ kind: 'cra_form', ref }] }))
        expect(ok, JSON.stringify(ref)).toBe(shape.test(ref))
      }),
      { seed: SEED, numRuns: 300 },
    )
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
