// @mutate
// The made-up data guard (SEC-11): nothing real can enter the test world. It reads every file of a client folder,
// not a hand-picked field list (findings W00 r1 RC5): every name field, every nine-digit number, every e-mail
// address, every phone number, and every bank description that names one of the client's people.
import type { ClientId, LoadIssue } from './schema'

/** One file of a client folder, as text, with its kind. */
export type GuardFile = { file: string; kind: 'json' | 'csv' | 'md'; text: string }

/** The Luhn check digit that real business numbers and SINs pass. */
export function passesCheckDigit(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g
// Nine digits, written plain, spaced or hyphenated; a program suffix such as RT0001 may follow. Not part of a longer number.
const NINE_DIGITS = /(?<![\d.])(\d{3})([ -]?)(\d{3})\2(\d{3})(?!\d|\.\d)/g
// Ten digits with an optional +1 and bracketed area code, or seven digits written 867-5309.
const PHONE10 = /(?<![\d.])(?:\+?1[\s.-]?)?(?:\((\d{3})\)|(\d{3}))[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d|\.\d)/g
const PHONE7 = /(?<![\d.-])(\d{3})-(\d{4})(?!\d)/g
const RESERVED_DOMAIN = /(^|\.)(example\.(com|org|net)|test|invalid|example|localhost)$/i
const NAME_KEYS = new Set(['name', 'legal_name', 'entity_name', 'lender', 'recipient', 'employee'])

type Walk = (path: string, key: string, value: string, holder: Record<string, unknown>) => void

function walkStrings(v: unknown, path: string, key: string, holder: Record<string, unknown>, visit: Walk): void {
  if (typeof v === 'string') visit(path, key, v, holder)
  else if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) walkStrings(x, `${path}.${String(i)}`, String(i), holder, visit)
  }
  else if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const [k, x] of Object.entries(o)) walkStrings(x, path === '' ? k : `${path}.${k}`, k, o, visit)
  }
}

/** A name in the test world ends "(Test)"; an account's own name (a ledger line) is not a person or company. */
function isNameField(key: string, holder: Record<string, unknown>): boolean {
  if (!NAME_KEYS.has(key)) return false
  return !('account' in holder) && !('gifiName' in holder) && !('key' in holder)
}

const isPhoneOk = (exchange: string, last: string): boolean => exchange === '555' && /^01\d\d$/.test(last)

/** Checks one chunk of text (a JSON string value, a CSV file, a profile) for numbers, e-mail addresses and phone numbers. */
function scanText(text: string, where: string, add: (record: string, reason: string) => void): void {
  for (const m of text.matchAll(NINE_DIGITS)) {
    if (passesCheckDigit(`${m[1] ?? ''}${m[3] ?? ''}${m[4] ?? ''}`)) {
      add(where, `the number ${m[0]} passes its check digit; made-up business numbers and SINs must fail it`)
    }
  }
  for (const m of text.matchAll(EMAIL)) {
    if (!RESERVED_DOMAIN.test(m[1] ?? '')) add(where, `the e-mail address ${m[0]} is outside a reserved test domain`)
  }
  for (const m of text.matchAll(PHONE10)) {
    if (!isPhoneOk(m[3] ?? '', m[4] ?? '')) add(where, `the phone number ${m[0]} is outside 555-0100 to 555-0199`)
  }
  for (const m of text.matchAll(PHONE7)) {
    if (!isPhoneOk(m[1] ?? '', m[2] ?? '')) add(where, `the phone number ${m[0]} is outside 555-0100 to 555-0199`)
  }
}

const bare = (name: string): string => name.replace(/\s*\(Test\)\s*$/, '').trim()

/** A bank or QBO description that holds the name of one of the client's people carries the word TEST (the README rule). */
function scanDescription(text: string, where: string, people: string[], add: (record: string, reason: string) => void): void {
  const upper = text.toUpperCase()
  for (const p of people) {
    if (upper.includes(p.toUpperCase()) && !/\bTEST\b/i.test(text)) {
      add(where, `the description names ${p} without the word TEST: ${text.slice(0, 80)}`)
    }
  }
}

/**
 * The SEC-11 issues in a client's files. `people` are the names of its persons (owners, holders, the spouse, person
 * parties) with or without "(Test)"; a description naming one must carry TEST.
 */
export function guardIssues(client: ClientId, files: GuardFile[], people: string[]): LoadIssue[] {
  const issues: LoadIssue[] = []
  const add = (record: string, reason: string): void => {
    issues.push({ client, check: 'made-up-data', record, reason })
  }
  const names = people.map(bare).filter((n) => n !== '')
  for (const f of files) {
    if (f.kind === 'json') {
      let parsed: unknown
      try {
        parsed = JSON.parse(f.text)
      } catch {
        add(f.file, 'the file is not valid JSON, so it cannot be checked')
        continue
      }
      walkStrings(parsed, '', '', {}, (path, key, value, holder) => {
        const where = `${f.file} ${path}`
        if (isNameField(key, holder) && !value.trim().endsWith('(Test)')) add(where, `the name "${value}" does not end with "(Test)"`)
        scanText(value, where, add)
        if (key === 'description') scanDescription(value, where, names, add)
      })
    } else {
      scanText(f.text, f.file, add)
      if (f.kind === 'csv') {
        for (const line of f.text.split(/\r?\n/)) scanDescription(line, f.file, names, add)
      }
    }
  }
  return issues
}
