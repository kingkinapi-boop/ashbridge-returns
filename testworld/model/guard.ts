// The made-up data guard (SEC-11): nothing real can enter the test world.
import type { ClientId, LoadIssue } from './schema'

/** What the guard looks at: the names, numbers and free text a client brings. */
export type GuardInput = {
  names: { where: string; name: string }[]
  numbers: { where: string; value: string; kind: 'business number' | 'SIN' }[]
  text: { where: string; text: string }[]
}

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
const PHONE = /(?<!\d)(?:\+?1[\s.-])?\(?(\d{3})\)?[\s.-](\d{3})[\s.-](\d{4})(?!\d)/g
const RESERVED_DOMAIN = /(^|\.)(example\.(com|org|net)|test|invalid|example|localhost)$/i

export function guardIssues(client: ClientId, input: GuardInput): LoadIssue[] {
  const issues: LoadIssue[] = []
  const add = (record: string, reason: string): void => {
    issues.push({ client, check: 'made-up-data', record, reason })
  }
  for (const { where, name } of input.names) {
    if (!name.trim().endsWith('(Test)')) add(where, `the name "${name}" does not end with "(Test)"`)
  }
  for (const { where, value, kind } of input.numbers) {
    if (passesCheckDigit(value)) add(where, `the ${kind} ${value} passes its check digit; made-up numbers must fail it`)
  }
  for (const { where, text } of input.text) {
    for (const m of text.matchAll(EMAIL)) {
      if (!RESERVED_DOMAIN.test(m[1] ?? '')) add(where, `the e-mail address ${m[0]} is outside a reserved test domain`)
    }
    for (const m of text.matchAll(PHONE)) {
      if (m[2] !== '555' || !/^01\d\d$/.test(m[3] ?? '')) add(where, `the phone number ${m[0]} is outside 555-0100 to 555-0199`)
    }
  }
  return issues
}
