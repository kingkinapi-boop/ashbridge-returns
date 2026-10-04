// A08 round 2 acceptance tests (spec-writer; builders never edit this file): the sensitive-value scan's edges.
// Lead directive A529, fix list S4 (RC3: the check digit and the regex edges had one example each). The scan is
// `sensitiveKinds(inputs, markedKeys)` from src/modules/ai/project/scan.ts: the kinds of sensitive value it finds,
// each a plain phrase, never a value. The kinds' exact words are pinned here (S3, RC2):
//   'a SIN', 'a date of birth', 'a bank account', 'text after the restricted-provided marker',
//   'a value of a fact marked sensitive'.
// Luhn (Lead ruling A529): scan.ts keeps its own check digit until W00b lands; the property below pins it to the one
// reference Luhn (reference/sample-clients/lib/util.mjs, SC rule R50), so W00b can move both onto one shared Luhn.
// Made-up numbers only: the one check-digit-valid nine-digit number is built from the harness's three groups.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { sensitiveKinds } from './scan'
import { REPO_ROOT, SIN_GROUPS, type Json } from './__fixtures__/harness'

const SIN = 'a SIN'
const BIRTH = 'a date of birth'
const BANK = 'a bank account'
const MARKER = 'text after the restricted-provided marker'
const FACT = 'a value of a fact marked sensitive'

/** The reference Luhn (R50: one Luhn in the repo, never a copy in a test). */
const { luhnValid } = (await import(pathToFileURL(path.join(REPO_ROOT, 'reference', 'sample-clients', 'lib', 'util.mjs')).href)) as {
  luhnValid: (digits: string) => boolean
}
const VALID_NINE = SIN_GROUPS.join('')
const NO_MARKS: ReadonlySet<string> = new Set()
const kindsOf = (inputs: unknown, marked: ReadonlySet<string> = NO_MARKS): string[] => sensitiveKinds(inputs, marked)
/** fast-check runs are seeded (testing.md: random data uses a fixed seed). */
const SEEDED = { seed: 20261003, numRuns: 2000 }

describe('AI-9 SEC-5 A529 S4 the SIN check digit is the reference Luhn', () => {
  test('AI-9 SEC-5 A529 the reference Luhn holds for the harness SIN and fails when its check digit moves (sentinel)', () => {
    expect(luhnValid(VALID_NINE)).toBe(true)
    expect(luhnValid(VALID_NINE.slice(0, 8) + String((Number(VALID_NINE[8]) + 1) % 10))).toBe(false)
  })

  test('AI-9 SEC-5 A529 property: for any nine-digit string the scan reports a SIN exactly when the reference Luhn holds', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(...'0123456789'.split('')), minLength: 9, maxLength: 9 }), (digits) => {
        expect(kindsOf({ memo: `Reference (Test) ${digits} on the slip` }).includes(SIN)).toBe(luhnValid(digits))
      }),
      SEEDED,
    )
  })

  test('AI-9 SEC-5 A529 property: written in three groups with a space, dash or dot, the answer is the same', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(...'0123456789'.split('')), minLength: 9, maxLength: 9 }), fc.constantFrom(' ', '-', '.'), (digits, sep) => {
        const text = `${digits.slice(0, 3)}${sep}${digits.slice(3, 6)}${sep}${digits.slice(6)}`
        expect(kindsOf({ memo: text }).includes(SIN)).toBe(luhnValid(digits))
      }),
      SEEDED,
    )
  })

  test('AI-9 SEC-5 A529 property: a nine-digit number given as a JSON number is read the same way', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100_000_000, max: 999_999_999 }), (n) => {
        expect(kindsOf({ ledger: [{ memo: n }] }).includes(SIN)).toBe(luhnValid(String(n)))
      }),
      SEEDED,
    )
  })

  test('AI-9 SEC-5 A529 property: a valid nine-digit window inside a longer run of digits is not a SIN', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(...'0123456789'.split('')), minLength: 1, maxLength: 3 }), fc.boolean(), (extra, before) => {
        const run = before ? `${extra}${VALID_NINE}` : `${VALID_NINE}${extra}`
        expect(kindsOf({ memo: `Reference (Test) ${run}` })).toEqual([])
      }),
      SEEDED,
    )
  })
})

/** Rows: a label, the inputs, and the exact kinds the scan reports (in the order it finds them). */
type Row = readonly [label: string, inputs: Json, kinds: readonly string[]]

const NO_ALARM: readonly Row[] = [
  ['a 12-digit run whose last nine digits hold a valid SIN', { memo: `Reference (Test) 000${VALID_NINE}` }, []],
  ['a 12-digit run whose first nine digits hold a valid SIN', { memo: `Reference (Test) ${VALID_NINE}000` }, []],
  ['a bank shape with a 6-digit account', { memo: 'Deposit (Test) to 00123 004 765432' }, []],
  ['a bank shape with a 13-digit account', { memo: 'Deposit (Test) to 00123 004 7654321098765' }, []],
  ['a bank shape written with dots', { memo: 'Deposit (Test) to 00123.004.7654321' }, []],
  ['the word adobe (dob inside a word)', { memo: 'Adobe (Test) licence renewal' }, []],
  ['the word newborn (born inside a word)', { memo: 'Newborn photography (Test) invoice' }, []],
  ['restricted-provided with nothing after it', { answer: 'restricted-provided' }, []],
  ['restricted-provided followed by punctuation only', { answer: 'restricted-provided: -- !' }, []],
  ['restricted-provided followed by a full stop', { answer: 'restricted-provided.' }, []],
  ['a dob key whose value is null', { dob: null }, []],
  ['a dob key whose value is empty', { dob: '' }, []],
  ['a dob key whose value is blank', { dob: '  ' }, []],
  ['an accountNumber key whose value is null', { accountNumber: null }, []],
]

const ALARM: readonly Row[] = [
  ['a bank shape with a 7-digit account', { memo: 'Deposit (Test) to 00123-004-7654321' }, [BANK]],
  ['a bank shape with a 12-digit account', { memo: 'Deposit (Test) to 00123 004 765432109876' }, [BANK]],
  ['the label birthday', { memo: 'Birthday (Test): 1971-04-12' }, [BIRTH]],
  ['the label date de naïssance', { memo: 'Date de naïssance (Test) : 1971-04-12' }, [BIRTH]],
  ['the label date of birth', { memo: 'Date of birth (Test) 1971-04-12' }, [BIRTH]],
  ['the label date of birth with two spaces between its words', { memo: 'Date  of  birth (Test) 1971-04-12' }, [BIRTH]],
  ['the label date de naissance with two spaces between its words', { memo: 'Date  de  naissance (Test) 1971-04-12' }, [BIRTH]],
  ['the label birthdate written as one word', { memo: 'Birthdate (Test): 1971-04-12' }, [BIRTH]],
  ['the label born', { memo: 'Born (Test) 1971-04-12' }, [BIRTH]],
  ['the label DOB with zero-width spaces inside it', { memo: `D${String.fromCharCode(0x200b)}O${String.fromCharCode(0x200b)}B (Test) 1971-04-12` }, [BIRTH]],
  ['the label DOB in full-width letters', { memo: 'ＤＯＢ (Test) 1971-04-12' }, [BIRTH]],
  ['the key date_of_birth', { date_of_birth: '1971-04-12' }, [BIRTH]],
  ['the key dateDeNaissance', { dateDeNaissance: '1971-04-12' }, [BIRTH]],
  ['the key birthday', { birthday: '1971-04-12' }, [BIRTH]],
  ['the key Birth-Date', { 'Birth-Date': '1971-04-12' }, [BIRTH]],
  ['the key dob in full-width letters', { 'ｄｏｂ': '1971-04-12' }, [BIRTH]],
  ['the key bank_account', { bank_account: '7654321' }, [BANK]],
  ['the key bankAccountNumber', { bankAccountNumber: '7654321' }, [BANK]],
  ['a dob key whose value is the number 0', { dob: 0 }, [BIRTH]],
  ['restricted-provided followed by a letter', { answer: 'restricted-provided x' }, [MARKER]],
  ['the SIN as a bare nine digits', { memo: `Reference (Test) ${VALID_NINE}` }, [SIN]],
  ['a nine-digit SIN after a longer run and a space', { memo: `Reference (Test) 999 ${SIN_GROUPS.join(' ')}` }, [SIN]],
]

describe('AI-9 SEC-5 A529 S4 the scan edges: no alarm where nothing is sensitive, the exact kind where something is', () => {
  test('AI-9 A529 the edge tables are not empty (sentinel)', () => {
    expect(NO_ALARM.length).toBeGreaterThan(10)
    expect(ALARM.length).toBeGreaterThan(10)
  })

  test.each(NO_ALARM)('AI-9 SEC-5 A529 no false alarm: %s', (_label, inputs, kinds) => {
    expect(kindsOf(inputs)).toEqual(kinds)
  })

  test.each(ALARM)('AI-9 SEC-5 A529 %s is reported as exactly its kind', (_label, inputs, kinds) => {
    expect(kindsOf(inputs)).toEqual(kinds)
  })

  test('AI-9 SEC-5 A529 a marked fact is reported by key and by { key, value } and { factKey, value }, only when a value is present', () => {
    const marked = new Set(['shareholder.identity.sin'])
    expect(kindsOf({ 'shareholder.identity.sin': 'x (Test)' }, marked)).toEqual([FACT])
    expect(kindsOf({ facts: [{ key: 'shareholder.identity.sin', value: 'x (Test)' }] }, marked)).toEqual([FACT])
    expect(kindsOf({ facts: [{ factKey: 'shareholder.identity.sin', value: 'x (Test)' }] }, marked)).toEqual([FACT])
    expect(kindsOf({ facts: [{ key: 'shareholder.identity.sin', value: null }] }, marked)).toEqual([])
    expect(kindsOf({ facts: [{ key: 'shareholder.identity.sin', value: ' ' }] }, marked)).toEqual([])
    expect(kindsOf({ 'shareholder.identity.sin': '' }, marked)).toEqual([])
    // a key that is not marked is not a fact alarm
    expect(kindsOf({ facts: [{ key: 'shareholder.identity.name', value: 'x (Test)' }] }, marked)).toEqual([])
  })

  test('AI-9 SEC-5 A529 B3 several kinds are reported in the order the scan finds them (no sort): a dob key before an accountNumber key', () => {
    expect(kindsOf({ owner: { dob: '1971-04-12', accountNumber: '7654321' } })).toEqual([BIRTH, BANK])
    expect(kindsOf({ owner: { accountNumber: '7654321', dob: '1971-04-12' } })).toEqual([BANK, BIRTH])
  })

  test('AI-9 SEC-5 A529 S0 only null, a missing value and blank text count as no value: a dob key holding undefined is quiet, one holding an empty list is reported', () => {
    expect(kindsOf({ dob: undefined })).toEqual([])
    expect(kindsOf({ owner: { accountNumber: undefined } })).toEqual([])
    expect(kindsOf({ dob: [] })).toEqual([BIRTH])
    expect(kindsOf({ accountNumber: [] })).toEqual([BANK])
  })

  test('AI-9 SEC-5 A529 a kind found twice is reported once', () => {
    expect(kindsOf({ a: { dob: '1971-04-12' }, b: { birthDate: '1971-04-12' }, memo: 'DOB 1971-04-12' })).toEqual([BIRTH])
  })
})
