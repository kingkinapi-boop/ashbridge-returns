// F00 round 3 (reports/F00-findings-3.md, root cause 2): redaction by the known list of
// personal-data kinds and credentials, matched on whole word parts of a key, never by a guessed regex.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { CIRCULAR, makeLogger, redact, REDACTED, SENSITIVE_KINDS } from './log'
import { readOwnSource } from './testing/read-own-source'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Logs one line with these fields and returns the raw line. */
function logLine(fields: Record<string, unknown>): string {
  const lines: string[] = []
  const log = makeLogger((l) => {
    lines.push(l)
  })
  log.info('event (Test)', fields)
  expect(lines).toHaveLength(1)
  return lines[0] ?? ''
}

/** The fields object as printed, parsed back. */
function printedFields(fields: Record<string, unknown>): unknown {
  const parsed = JSON.parse(logLine(fields)) as { fields?: unknown }
  return parsed.fields
}

type Style = 'camel' | 'pascal' | 'snake' | 'upperSnake' | 'kebab' | 'space'
const STYLES: readonly Style[] = ['camel', 'pascal', 'snake', 'upperSnake', 'kebab', 'space']

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)
function spell(words: readonly string[], style: Style): string {
  switch (style) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? w : cap(w))).join('')
    case 'pascal':
      return words.map(cap).join('')
    case 'snake':
      return words.join('_')
    case 'upperSnake':
      return words.join('_').toUpperCase()
    case 'kebab':
      return words.join('-')
    case 'space':
      return words.join(' ')
  }
}

// Every sensitive name the later cards are known to use (A06, B04, A08, E00, V00), as word parts.
const SENSITIVE_NAMES: readonly (readonly string[])[] = [
  ['sin'],
  ['sin', 'number'],
  ['social', 'insurance', 'number'],
  ['social', 'insurance'],
  ['dob'],
  ['date', 'of', 'birth'],
  ['birth', 'date'],
  ['bank', 'transit'],
  ['transit', 'number'],
  ['bank', 'institution'],
  ['institution', 'number'],
  ['bank', 'account'],
  ['bank', 'account', 'number'],
  ['account', 'number'],
  ['ontario', 'company', 'key'],
  ['password'],
  ['token'],
  ['access', 'token'],
  ['refresh', 'token'],
  ['token', 'hash'],
  ['code', 'hash'],
  ['secret'],
  ['api', 'key'],
  ['authorization'],
]
const PREFIXES: readonly (readonly string[])[] = [[], ['client'], ['spouse'], ['owner']]

/** Wraps a value `depth` times in harmless objects and arrays. */
function nest(inner: unknown, shape: readonly boolean[]): unknown {
  return shape.reduce<unknown>((acc, asArray) => (asArray ? ['harmless (Test)', acc] : { level: acc, note: 'harmless (Test)' }), inner)
}

describe('F00 logger redaction (SEC-5, SEC-10)', () => {
  test('SEC-5 every sensitive kind is redacted in any spelling and depth', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SENSITIVE_NAMES),
        fc.constantFrom(...PREFIXES),
        fc.constantFrom(...STYLES),
        fc.array(fc.boolean(), { maxLength: 15 }),
        fc.stringMatching(/^[a-z]{8,12}$/),
        (name, prefix, style, shape, secret) => {
          const marker = `mk-${secret}`
          const key = spell([...prefix, ...name], style)
          const line = logLine({ wrapper: nest({ [key]: marker, kept: 'visible (Test)' }, shape) })
          expect(line, `key ${key}`).not.toContain(marker)
          expect(line).toContain('visible (Test)')
        },
      ),
      { seed: 20261001, numRuns: 400 },
    )
  })

  test('SEC-5 camel-case acronyms (spouseSIN, clientDOB, ownerSIN) are redacted', () => {
    const line = logLine({ spouseSIN: 'mk-alpha', clientDOB: 'mk-bravo', ownerSIN: 'mk-charlie', SIN: 'mk-delta', DOB: 'mk-echo' })
    for (const m of ['mk-alpha', 'mk-bravo', 'mk-charlie', 'mk-delta', 'mk-echo']) expect(line).not.toContain(m)
  })

  test('SEC-5 every restricted kind in onboarding-contract section 3 is in SENSITIVE_KINDS', () => {
    const contract = fs.readFileSync(path.join(ROOT, 'reference', 'onboarding-contract.md'), 'utf8')
    const section = contract.split(/^## /m).find((s) => s.startsWith('3. Never read')) ?? ''
    const kindsLine = /Kinds:\s*([^(]+)\(/.exec(section)?.[1] ?? ''
    const kinds = kindsLine
      .split(',')
      .map((k) => k.trim().replace(/\.$/, ''))
      .filter(Boolean)
    expect(kinds.length, 'the contract lists its restricted kinds').toBeGreaterThanOrEqual(6)

    const norm = (s: string): string =>
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .join(' ')
    const listed = new Set(SENSITIVE_KINDS.map((k: unknown) => norm(typeof k === 'string' ? k : JSON.stringify(k))))
    for (const kind of kinds) {
      expect(listed.has(norm(kind)), `${kind} is in SENSITIVE_KINDS`).toBe(true)
      // and a key spelled as the contract spells it, or in camel case, never prints
      const words = norm(kind).split(' ')
      for (const style of STYLES) {
        const key = spell(words, style)
        expect(logLine({ [key]: 'mk-contract-kind' }), key).not.toContain('mk-contract-kind')
      }
    }
  })

  test('SEC-10 every credential column in onboarding-contract section 3 never prints', () => {
    const contract = fs.readFileSync(path.join(ROOT, 'reference', 'onboarding-contract.md'), 'utf8')
    const section = contract.split(/^## /m).find((s) => s.startsWith('3. Never read')) ?? ''
    const credLine = section.split('\n').find((l) => l.includes('Credentials and tokens')) ?? ''
    const columns = [...credLine.matchAll(/\b([a-z]+(?:_[a-z]+)*_(?:token|hash)(?:_[a-z]+)*)\b/g)].map((m) => m[1] ?? '')
    expect(columns.length, 'the contract lists its credential columns').toBeGreaterThanOrEqual(4)
    for (const col of columns) {
      const words = col.split('_')
      for (const style of STYLES) {
        const key = spell(words, style)
        expect(logLine({ [key]: 'mk-credential' }), key).not.toContain('mk-credential')
      }
    }
  })

  test('SEC-5 no false alarm: GL account, accountNo 6100, gifi, businessNumber, business_use_percent, since are kept', () => {
    const fields = {
      account: '6100',
      accountNo: '6100',
      account_no: 6100,
      acct: '6100',
      glAccount: '6100',
      GL_ACCOUNT: '5400',
      accountName: 'Office supplies (Test)',
      gifi: '8810',
      gifiCode: '8810',
      gifi_line: 8810,
      businessNumber: '000000000RC0001',
      business_use_percent: 40,
      claims_small_business_deduction: true,
      since: '2019-04-01',
      singleOwner: true,
      dobermanCount: 2,
      using: 'cash (Test)',
      tokenizerVersion: '2 (Test)',
      lines: [{ account: '1000', amountCents: 125000 }],
    }
    const expected = JSON.parse(JSON.stringify(fields)) as unknown
    expect(printedFields(fields)).toEqual(expected)
  })

  test('SEC-5 a number-typed SIN is redacted', () => {
    const line = logLine({ note: 123456789, list: [987654321], nested: { value: 46454286 * 10 + 3 } })
    for (const bad of ['123456789', '987654321', '464542863']) expect(line).not.toContain(bad)
    // an ordinary amount in cents is kept
    expect(printedFields({ amountCents: 12345 })).toEqual({ amountCents: 12345 })
  })

  test('SEC-10 a credential field (password, accessToken, codeHash) never prints', () => {
    const line = logLine({
      password: 'mk-pass-word',
      accessToken: 'mk-access',
      refreshToken: 'mk-refresh',
      codeHash: 'mk-code-hash',
      token_hash: 'mk-token-hash',
      secret: 'mk-secret',
      apiKey: 'mk-api-key',
      headers: { Authorization: 'Bearer mk-bearer' },
      qbo: { connection: { access_token: 'mk-qbo-access', realmId: '9130 (Test)' } },
    })
    for (const m of ['mk-pass-word', 'mk-access', 'mk-refresh', 'mk-code-hash', 'mk-token-hash', 'mk-secret', 'mk-api-key', 'mk-bearer', 'mk-qbo-access']) {
      expect(line).not.toContain(m)
    }
    expect(line).toContain('9130 (Test)')
  })

  test('SEC-5 a cyclic object logs without throwing', () => {
    const a: Record<string, unknown> = { name: 'Maple Ridge (Test)', sin: '046454286' }
    a['self'] = a
    a['children'] = [a, { parent: a, dob: '1980-01-01' }]
    let line = ''
    expect(() => {
      line = logLine(a)
    }).not.toThrow()
    expect(line).toContain('Maple Ridge (Test)')
    expect(line).not.toContain('046454286')
    expect(line).not.toContain('1980-01-01')
  })

  test('SEC-5 a sensitive field below the depth cap still never prints', () => {
    const deep = nest({ clientSin: 'mk-very-deep', bankAccount: 'mk-deep-bank' }, Array.from({ length: 30 }, (_, i) => i % 2 === 0))
    let line = ''
    expect(() => {
      line = logLine({ deep })
    }).not.toThrow()
    expect(line).not.toContain('mk-very-deep')
    expect(line).not.toContain('mk-deep-bank')
  })

  test('ARC-15 log.ts is a mutation target (// @mutate in its first 5 lines)', () => {
    const head = readOwnSource(path.join(ROOT, 'src', 'core', 'log.ts')).split('\n').slice(0, 5).join('\n')
    expect(head).toMatch(/\/\/ @mutate/)
  })
})

// F00T (spec job): the survivors of the log.ts mutation run (reports/F00T-mutants.md), each as a test.
/** Wraps a leaf in `levels` plain objects: the leaf sits at depth `levels`. */
function wrap(levels: number, leaf: unknown): unknown {
  let v = leaf
  for (let i = 0; i < levels; i++) v = { inner: v }
  return v
}

/** Follows `inner` down `levels` times. */
function unwrap(levels: number, value: unknown): unknown {
  let v = value
  for (let i = 0; i < levels; i++) v = (v as { inner: unknown }).inner
  return v
}

describe('F00T log.ts survivors (SEC-5, SEC-10)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('SEC-5 a redacted field prints exactly "[redacted]" and a SIN in text becomes "[redacted]" (survivor log.ts:9)', () => {
    expect(REDACTED).toBe('[redacted]')
    expect(printedFields({ sin: 'mk-x', note: 'ref 046-454-286 (Test)' })).toEqual({ sin: '[redacted]', note: 'ref [redacted] (Test)' })
    expect(redact(123456789)).toBe('[redacted]')
  })

  test('SEC-5 a cycle prints exactly "[circular]" (survivor log.ts:10)', () => {
    expect(CIRCULAR).toBe('[circular]')
    const a: Record<string, unknown> = { name: 'Loop (Test)' }
    a['self'] = a
    expect(redact(a)).toEqual({ name: 'Loop (Test)', self: '[circular]' })
    const list: unknown[] = ['x (Test)']
    list.push(list)
    expect(redact(list)).toEqual(['x (Test)', '[circular]'])
  })

  test('SEC-5 a SIN written without separators, or with one, is redacted in text (survivors log.ts:5)', () => {
    const line = logLine({ a: 'ref 046454286 (Test)', b: 'ref 046-454286 (Test)', c: 'ref 046454 286 (Test)', d: 'ref 046 454 286 (Test)' })
    for (const bad of ['046454286', '046-454286', '046454 286', '046 454 286']) expect(line).not.toContain(bad)
    expect(printedFields({ a: 'ref 046454286 (Test)' })).toEqual({ a: 'ref [redacted] (Test)' })
  })

  test('SEC-5 no false alarm: a 10-digit amount in cents and other numbers are kept (survivors log.ts:6)', () => {
    expect(printedFields({ amountCents: 1234567890, big: 12345678901, small: 12345678, zero: 0, negative: -500 })).toEqual({
      amountCents: 1234567890,
      big: 12345678901,
      small: 12345678,
      zero: 0,
      negative: -500,
    })
  })

  test('SEC-5 null, booleans and undefined pass through without throwing (survivor log.ts:64)', () => {
    expect(redact(null)).toBeNull()
    expect(redact({ a: null, b: [null], c: true, d: undefined })).toEqual({ a: null, b: [null], c: true, d: undefined })
    expect(printedFields({ client: null, flags: [null, false] })).toEqual({ client: null, flags: [null, false] })
  })

  test('SEC-5 the depth cap: a value 19 levels deep is kept, 20 levels deep becomes "[redacted]" (survivors log.ts:65, 68, 70)', () => {
    expect(unwrap(19, redact(wrap(19, 'kept (Test)')))).toBe('kept (Test)')
    expect(unwrap(20, redact(wrap(20, { leaf: 'cut (Test)' })))).toBe('[redacted]')
    expect(unwrap(19, redact(wrap(19, { leaf: 'kept (Test)' })))).toEqual({ leaf: 'kept (Test)' })
    // arrays count as levels too
    let arr: unknown = { leaf: 'cut (Test)' }
    for (let i = 0; i < 20; i++) arr = [arr]
    let out = redact(arr)
    for (let i = 0; i < 20; i++) out = (out as unknown[])[0]
    expect(out).toBe('[redacted]')
  })

  test('SEC-5 a very deep object (100000 levels) logs without throwing and prints none of its leaf', () => {
    const deep = wrap(100_000, { note: 'mk-deepest' })
    let line = ''
    expect(() => {
      line = logLine({ deep })
    }).not.toThrow()
    expect(line).not.toContain('mk-deepest')
    expect(line).toContain('[redacted]')
  })

  test('SEC-5 keys with acronym runs before a word are split (APIKey, SINNumber, DOBValue) (survivors log.ts:41)', () => {
    const line = logLine({ APIKey: 'mk-api', SINNumber: 'mk-sin', DOBValue: 'mk-dob', clientSINNumber: 'mk-client-sin', OWNERBankAccount: 'mk-bank' })
    for (const m of ['mk-api', 'mk-sin', 'mk-dob', 'mk-client-sin', 'mk-bank']) expect(line).not.toContain(m)
    expect(printedFields({ HTMLNote: 'kept (Test)', GSTRate: 13 })).toEqual({ HTMLNote: 'kept (Test)', GSTRate: 13 })
  })

  test('SEC-5 keys with runs of separators or edge separators are matched (bank__account, _sin_, api--key, date  of  birth) (log.ts:39, 42, 43)', () => {
    const line = logLine({ bank__account: 'mk-1', _sin_: 'mk-2', 'api--key': 'mk-3', 'date  of  birth': 'mk-4', '__token': 'mk-5', 'access__token__': 'mk-6' })
    for (const m of ['mk-1', 'mk-2', 'mk-3', 'mk-4', 'mk-5', 'mk-6']) expect(line).not.toContain(m)
  })

  test('SEC-5 word order counts: "account bank" is not the kind "bank account", while "number sin" still holds the kind "sin"', () => {
    expect(printedFields({ accountBank: 'kept (Test)' })).toEqual({ accountBank: 'kept (Test)' })
    expect(printedFields({ numberSin: 'mk-x' })).toEqual({ numberSin: '[redacted]' })
  })

  test('SEC-10 the three log levels print their own level name (survivors log.ts:85, 86, 87)', () => {
    const lines: string[] = []
    const log = makeLogger((l) => {
      lines.push(l)
    })
    log.info('one (Test)')
    log.warn('two (Test)')
    log.error('three (Test)', { n: 3 })
    expect(lines.map((l) => JSON.parse(l) as unknown)).toEqual([
      { level: 'info', message: 'one (Test)' },
      { level: 'warn', message: 'two (Test)' },
      { level: 'error', message: 'three (Test)', fields: { n: 3 } },
    ])
  })

  test('SEC-10 the default sink writes one JSON line ending in a newline to stdout (survivors log.ts:80)', () => {
    const written: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written.push(String(chunk))
      return true
    })
    const log = makeLogger()
    log.warn('stdout (Test)', { sin: 'mk-default-sink' })
    vi.restoreAllMocks()
    expect(written).toEqual([JSON.stringify({ level: 'warn', message: 'stdout (Test)', fields: { sin: '[redacted]' } }) + '\n'])
  })
})
