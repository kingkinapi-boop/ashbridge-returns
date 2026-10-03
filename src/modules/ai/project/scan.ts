// @mutate
// The code scan that refuses a job still holding a sensitive value (AI-9, SEC-5, A498). It reads the parsed inputs
// (so a \u escape in the file is already a letter), never the raw file, and never returns a value: only the kind.
// Text is read as NFKC with format characters removed, so full-width digits and odd spaces count.
import { isBlank } from '../../../contracts/text'

/** The kinds the scan reports; each is a plain phrase, never a value. */
export const KIND_SIN = 'a SIN'
export const KIND_BIRTH = 'a date of birth'
export const KIND_BANK = 'a bank account'
export const KIND_MARKER = 'text after the restricted-provided marker'
export const KIND_FACT = 'a value of a fact marked sensitive'

// Whitespace (no-break, thin and narrow no-break spaces included), a dot, a hyphen and the Unicode hyphens and dashes.
const DASHES = String.fromCharCode(0x2010) + '-' + String.fromCharCode(0x2015)
const SEP = `[\\s.${DASHES}-]`
const SEP_NO_DOT = `[\\s${DASHES}-]`
// every start position is tried (lookahead), so "999 729 458 133" still finds the SIN inside it
const SIN_SHAPE = new RegExp(`(?<!\\d)(?=(\\d{3}${SEP}?\\d{3}${SEP}?\\d{3})(?!\\d))`, 'gu')
// transit (5), institution (3), account (7 to 12), written with separators
const BANK_SHAPE = new RegExp(`(?<!\\d)\\d{5}${SEP_NO_DOT}\\d{3}${SEP_NO_DOT}\\d{7,12}(?!\\d)`, 'u')
const BIRTH_LABEL = /(?<![\p{L}\p{N}])(?:d\.?o\.?b\.?|born|birth\s*date|date\s+of\s+birth|date\s+de\s+na[iï]ssance|birthday)(?![\p{L}\p{N}])/iu
const MARKER = new RegExp(`restricted${SEP_NO_DOT}*provided`, 'giu')

/** Field names (letters and digits only, lower case) that name a date of birth or a bank detail. */
const BIRTH_KEYS: ReadonlySet<string> = new Set(['dob', 'birthdate', 'dateofbirth', 'datedenaissance', 'birthday'])
const BANK_KEYS: ReadonlySet<string> = new Set(['accountnumber', 'transitnumber', 'institutionnumber', 'bankaccount', 'bankaccountnumber'])

// the doubled value of each digit, summed as digits (0 2 4 6 8 1 3 5 7 9)
const doubledDigitSum = (d: number): number => Math.trunc(d / 5) + ((d + d) % 10)

/** True when the digits pass the SIN check digit (the Luhn sum, written as a table of digit sums). */
function checkDigitHolds(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = digits.charCodeAt(digits.length - 1 - i) - 48
    sum += i % 2 === 1 ? doubledDigitSum(d) : d
  }
  return sum % 10 === 0
}

const readable = (text: string): string => text.normalize('NFKC').replace(/\p{Cf}/gu, '')

function scanText(raw: string, found: Set<string>): void {
  const text = readable(raw)
  for (const m of text.matchAll(SIN_SHAPE)) {
    if (checkDigitHolds((m[1] ?? '').replace(/\D/g, ''))) found.add(KIND_SIN)
  }
  if (BANK_SHAPE.test(text)) found.add(KIND_BANK)
  if (BIRTH_LABEL.test(text)) found.add(KIND_BIRTH)
  for (const m of text.matchAll(MARKER)) {
    if (/[\p{L}\p{N}]/u.test(text.slice(m.index + m[0].length))) found.add(KIND_MARKER)
  }
}

const present = (v: unknown): boolean => v !== null && v !== undefined && !(typeof v === 'string' && isBlank(v))
const keyForm = (key: string): string => readable(key).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

function walk(value: unknown, markedKeys: ReadonlySet<string>, found: Set<string>): void {
  if (typeof value === 'string') scanText(value, found)
  else if (typeof value === 'number') scanText(String(value), found)
  else if (Array.isArray(value)) for (const v of value) walk(v, markedKeys, found)
  else if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // an object { key, value } or { factKey, value } naming a marked fact
    for (const name of ['key', 'factKey']) {
      const fact = obj[name]
      if (typeof fact === 'string' && markedKeys.has(fact) && present(obj['value'])) found.add(KIND_FACT)
    }
    for (const [k, v] of Object.entries(obj)) {
      if (markedKeys.has(k) && present(v)) found.add(KIND_FACT)
      if (BIRTH_KEYS.has(keyForm(k)) && present(v)) found.add(KIND_BIRTH)
      if (BANK_KEYS.has(keyForm(k)) && present(v)) found.add(KIND_BANK)
      walk(v, markedKeys, found)
    }
  }
}

/** The kinds of sensitive value found anywhere in the inputs (none: an empty list). `markedKeys` are E03's sensitive fact keys. */
export function sensitiveKinds(inputs: unknown, markedKeys: ReadonlySet<string>): string[] {
  const found = new Set<string>()
  walk(inputs, markedKeys, found)
  return [...found].sort()
}
