// Builder unit tests for the made-up data guard (SEC-11): every refusal is planted and its exact reason compared.
import { describe, expect, it } from 'vitest'
import { guardIssues, passesCheckDigit, type GuardFile } from './guard'
import type { LoadIssue } from './schema'

const issue = (record: string, reason: string): LoadIssue => ({ client: 'C01', check: 'made-up-data', record, reason })
const json = (value: unknown, file = 'f.json'): GuardFile => ({ file, kind: 'json', text: JSON.stringify(value) })
const run = (files: GuardFile[], people: string[] = []): LoadIssue[] => guardIssues('C01', files, people)
const text = (kind: 'csv' | 'md', body: string, file = `f.${kind}`): GuardFile => ({ file, kind, text: body })

const NINE = (n: string): string => `the number ${n} passes its check digit; made-up business numbers and SINs must fail it`
const PHONE = (n: string): string => `the phone number ${n} is outside 555-0100 to 555-0199`
const EMAIL = (n: string): string => `the e-mail address ${n} is outside a reserved test domain`

describe('passesCheckDigit', () => {
  it('accepts numbers whose Luhn sum is a multiple of ten', () => {
    for (const d of ['046454286', '79927398713', '000000000', '18', '0', '59']) expect(passesCheckDigit(d)).toBe(true)
  })
  it('refuses numbers whose Luhn sum is not', () => {
    for (const d of ['046454287', '79927398710', '123456789', '1', '11', '19']) expect(passesCheckDigit(d)).toBe(false)
  })
  it('refuses anything that is not all digits, and the empty string', () => {
    for (const d of ['', 'x046454286', '046454286x', '0464 54286', '-046454286', '04645428a6', '19 ', ' 18', '19\t']) expect(passesCheckDigit(d)).toBe(false)
  })
})

describe('nine-digit numbers', () => {
  it('a plain, spaced or hyphenated number that passes the check digit is refused', () => {
    expect(run([text('md', 'sin 046454286 here')])).toEqual([issue('f.md', NINE('046454286'))])
    expect(run([text('md', 'sin 046 454 286 here')])).toEqual([issue('f.md', NINE('046 454 286'))])
    expect(run([text('md', 'sin 046-454-286 here')])).toEqual([issue('f.md', NINE('046-454-286'))])
  })
  it('a program suffix may follow', () => {
    expect(run([text('md', '046454286RT0001')])).toEqual([issue('f.md', NINE('046454286'))])
  })
  it('a number that fails the check digit passes', () => {
    expect(run([text('md', '123456789 and 123 456 789')])).toEqual([])
  })
  // W00b spec: mixed separators ('046-454 286') are a nine-digit number now (findings W00 r2 S3); they left this list.
  it('part of a longer number or a decimal is not a nine-digit number', () => {
    const nines = (t: string): LoadIssue[] => run([text('md', t)]).filter((i) => i.reason.startsWith('the number'))
    for (const t of ['0464542861', '10464542861', '1.046454286', '046454286.50']) expect(nines(t)).toEqual([])
  })
  it('a number at the end of a sentence is still a number', () => {
    expect(run([text('md', 'It was 046454286.')])).toEqual([issue('f.md', NINE('046454286'))])
  })
  it('numbers are found in JSON string values with their path', () => {
    // W00b spec: a classified path (notes[]), since an unclassified one is refused too (findings W00 r2 S1).
    expect(run([json({ notes: ['046454286'] })])).toEqual([issue('f.json notes.0', NINE('046454286'))])
  })
})

describe('e-mail addresses', () => {
  it('an address outside a reserved domain is refused with the whole address', () => {
    expect(run([text('md', 'write to bob@real.org now')])).toEqual([issue('f.md', EMAIL('bob@real.org'))])
    expect(run([text('md', 'write to bob.smith+x@sub.real.org now')])).toEqual([issue('f.md', EMAIL('bob.smith+x@sub.real.org'))])
    expect(run([text('md', 'bob@a-b.c-d.real.org')])).toEqual([issue('f.md', EMAIL('bob@a-b.c-d.real.org'))])
  })
  it('reserved domains pass', () => {
    for (const a of [
      'a@example.com',
      'a@example.org',
      'a@example.net',
      'a@mail.example.com',
      'a@x.test',
      'a@X.TEST',
      'a@x.invalid',
      'a@x.example',
      'a@x.localhost',
      'a@EXAMPLE.COM',
    ]) {
      expect(run([text('md', a)])).toEqual([])
    }
  })
  it('a reserved name only at the start or end of a longer domain does not pass', () => {
    expect(run([text('md', 'a@example.com.evil.org')])).toEqual([issue('f.md', EMAIL('a@example.com.evil.org'))])
    expect(run([text('md', 'a@notexample.com')])).toEqual([issue('f.md', EMAIL('a@notexample.com'))])
    expect(run([text('md', 'a@mytest.org')])).toEqual([issue('f.md', EMAIL('a@mytest.org'))])
  })
})

describe('phone numbers', () => {
  it('a ten-digit number outside 555-0100 to 555-0199 is refused in every written form', () => {
    for (const p of ['4168675309', '416 867 5309', '416-867-5309', '416.867.5309', '+1 416 867 5309', '1-416-867-5309', '+14168675309', '1.416.867.5309']) {
      expect(run([text('md', `call ${p} today`)])).toEqual([issue('f.md', PHONE(p))])
    }
  })
  it('a bracketed area code is read', () => {
    expect(run([text('md', 'call (416) 867-5309 today')])).toEqual([
      issue('f.md', PHONE('(416) 867-5309')),
      issue('f.md', PHONE('867-5309')),
    ])
    expect(run([text('md', 'call +1 (416) 867 5309 today')])).toEqual([issue('f.md', PHONE('+1 (416) 867 5309'))])
  })
  it('a seven-digit number outside the range is refused', () => {
    expect(run([text('md', 'call 867-5309')])).toEqual([issue('f.md', PHONE('867-5309'))])
  })
  it('555-0100 to 555-0199 pass, with or without an area code', () => {
    for (const p of ['555-0100', '555-0199', '555-0123', '(416) 555-0123', '416-555-0150', '+1 416 555 0100', '4165550199']) {
      expect(run([text('md', `call ${p} today`)])).toEqual([])
    }
  })
  it('the exchange must be 555 and the last four must be 01xx', () => {
    expect(run([text('md', '555-0200')])).toEqual([issue('f.md', PHONE('555-0200'))])
    expect(run([text('md', '555-0099')])).toEqual([issue('f.md', PHONE('555-0099'))])
    expect(run([text('md', '556-0123')])).toEqual([issue('f.md', PHONE('556-0123'))])
    expect(run([text('md', '(416) 556-0123')])).toEqual([issue('f.md', PHONE('(416) 556-0123')), issue('f.md', PHONE('556-0123'))])
    expect(run([text('md', '416-867-0123')])).toEqual([issue('f.md', PHONE('416-867-0123'))])
    expect(run([text('md', '4165550200')])).toEqual([issue('f.md', PHONE('4165550200'))])
  })
  it('the last seven of a ten-digit number are not read twice, and decimals or longer numbers are not phones', () => {
    expect(run([text('md', '416-867-5309')])).toHaveLength(1)
    expect(run([text('md', 'amount 416-867-5309.50')])).toEqual([])
    expect(run([text('md', '41686753091')])).toEqual([])
    expect(run([text('md', '.4168675309')])).toEqual([])
    expect(run([text('md', '8675-5309')])).toEqual([])
  })
})

describe('name fields in JSON', () => {
  const reason = (v: string): string => `the name "${v}" does not end with "(Test)"`
  it('a name ending (Test), even with spaces after it, passes; one with text after it does not', () => {
    expect(run([json({ name: 'Alice Smith (Test)' })])).toEqual([])
    expect(run([json({ name: 'Alice Smith (Test)  ' })])).toEqual([])
    expect(run([json({ name: 'Alice (Test) Smith' })])).toEqual([issue('f.json name', reason('Alice (Test) Smith'))])
  })
})

describe('walking JSON', () => {
  it('a file that is not JSON is refused and the next file is still read', () => {
    expect(run([{ file: 'bad.json', kind: 'json', text: '{nope' }, text('md', 'bob@real.org', 'ok.md')])).toEqual([
      issue('bad.json', 'the file is not valid JSON, so it cannot be checked'),
      issue('ok.md', EMAIL('bob@real.org')),
    ])
  })
})

// W00b spec: descriptions sit at a classified path (transactions[].description), since an unclassified path is refused
// too (findings W00 r2 S1).
describe('descriptions that name a person', () => {
  const people = ['Alice Smith (Test)']
  const reason = (t: string, who = 'Alice Smith'): string => `the description names ${who} without the word TEST: ${t}`
  it('a JSON description naming a person without TEST is refused', () => {
    expect(run([json({ transactions: [{ description: 'Payment to ALICE SMITH' }] })], people)).toEqual([
      issue('f.json transactions.0.description', reason('Payment to ALICE SMITH')),
    ])
  })
  it('the word TEST in any case, as a whole word, clears it', () => {
    for (const d of ['alice smith TEST', 'test alice smith', 'Alice Smith (Test)', 'Alice Smith, test.']) {
      expect(run([json({ transactions: [{ description: d }] })], people)).toEqual([])
    }
    expect(run([json({ transactions: [{ description: 'Alice Smith TESTING' }] })], people)).toEqual([issue('f.json transactions.0.description', reason('Alice Smith TESTING'))])
    expect(run([json({ transactions: [{ description: 'Alice Smith attest' }] })], people)).toEqual([issue('f.json transactions.0.description', reason('Alice Smith attest'))])
  })
  it('a description that does not name the person passes', () => {
    expect(run([json({ transactions: [{ description: 'Payment to Bob Jones' }] })], people)).toEqual([])
  })
  it('each person named is a separate issue, and the text is cut at 80 characters', () => {
    const long = `Alice Smith and Bob Jones ${'x'.repeat(100)}`
    expect(run([json({ transactions: [{ description: long }] })], ['Alice Smith (Test)', 'Bob Jones'])).toEqual([
      issue('f.json transactions.0.description', reason(long.slice(0, 80))),
      issue('f.json transactions.0.description', reason(long.slice(0, 80), 'Bob Jones')),
    ])
    expect(long.length).toBeGreaterThan(80)
  })
  it('a name is matched without its (Test) suffix, with spaces or none around it', () => {
    for (const p of ['Alice Smith (Test)', 'Alice Smith(Test)', 'Alice Smith (Test)  ', '  Alice Smith (Test)', 'Alice Smith']) {
      expect(run([json({ transactions: [{ description: 'pay alice smith' }] })], [p])).toEqual([issue('f.json transactions.0.description', reason('pay alice smith'))])
    }
  })
  it('only a trailing (Test) is removed from a person name', () => {
    expect(run([json({ transactions: [{ description: 'pay AliceJr' }] })], ['Alice (Test) Jr'])).toEqual([])
    expect(run([json({ transactions: [{ description: 'pay Alice' }] })], ['Alice (Test)x'])).toEqual([])
    expect(run([json({ transactions: [{ description: 'pay Alice' }] })], ['Alice(Test)'])).toEqual([issue('f.json transactions.0.description', reason('pay Alice', 'Alice'))])
  })
  it('empty or (Test)-only people never match everything', () => {
    expect(run([json({ transactions: [{ description: 'anything at all' }] })], ['', '   ', '(Test)', ' (Test) '])).toEqual([])
  })
  it('CSV lines are scanned one by one, with LF or CRLF line ends', () => {
    const csv = 'date,description\r\n2025-01-01,Cheque Alice Smith\r\n2025-01-02,Cheque Alice Smith TEST\n2025-01-03,Alice Smith again'
    expect(run([text('csv', csv, 'bank.csv')], people)).toEqual([
      issue('bank.csv', reason('2025-01-01,Cheque Alice Smith')),
      issue('bank.csv', reason('2025-01-03,Alice Smith again')),
    ])
  })
  // W00b spec: a markdown file is scanned for names now (findings W00 r2 S2); only the CSV half stays.
  it('a CSV is scanned for numbers', () => {
    expect(run([text('csv', 'a,046454286')], people)).toEqual([issue('f.csv', NINE('046454286'))])
  })
})
