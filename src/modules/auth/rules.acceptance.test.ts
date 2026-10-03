// A06 acceptance tests that need no database: the one-time code, the made-up users, what may import the
// test credentials, and the no-secret scan (SEC-1, SEC-10, END-8, ARC-6).
// Written by the spec-writer; builders never edit this file.
//
// Files the build creates (names fixed here):
// - src/modules/auth/totp.ts: `totp(secret: Uint8Array, at: Date): string`, RFC 6238, SHA-1, 30 s steps, 6 digits.
// - src/modules/auth/testing.ts (not exported by index.ts):
//     `listTestUsers(): { id: string; displayName: string; roles: Role[] }[]`
//     `testCredentials(userId: string): { password: string; secret: Uint8Array; codeAt(at: Date): string }`
//   Both are derived at run time from the user id and a fixed public string; any user id gets credentials.
// - src/modules/auth/testusers/**: the stand-in engine. src/modules/auth/index.ts: the public exports.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'
import { readOwnSource } from '../../core/testing/read-own-source'
import * as publicApi from './index'
import { listTestUsers, testCredentials } from './testing'
import { totp } from './totp'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const AUTH_DIR = path.join(ROOT, 'src', 'modules', 'auth')

describe('A06 one-time code (SEC-1)', () => {
  // RFC 6238 appendix B, SHA-1, secret "12345678901234567890", last six digits of the 8-digit values.
  const secret = new TextEncoder().encode('12345678901234567890')
  const vectors: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ]
  test.each(vectors)('SEC-1 RFC 6238 vector at %i seconds is %s', (seconds, expected) => {
    expect(totp(secret, new Date(seconds * 1000))).toBe(expected)
  })

  test('SEC-1 a code is six digits, the same for the whole 30-second step, different in the next', () => {
    const start = new Date('2026-10-02T10:00:00-04:00').getTime()
    const a = totp(secret, new Date(start))
    expect(a).toMatch(/^\d{6}$/)
    expect(totp(secret, new Date(start + 29_999))).toBe(a)
    expect(totp(secret, new Date(start + 30_000))).not.toBe(a)
  })
})

describe('A06 made-up users (SEC-1, SEC-11)', () => {
  test('SEC-1 nine users: two per role on their own and one who is cpa and owner, all named (Test)', () => {
    const users = listTestUsers()
    expect(users).toHaveLength(9)
    for (const u of users) expect(u.displayName, u.id).toMatch(/\(Test\)$/)
    expect(new Set(users.map((u) => u.id)).size).toBe(9)
    for (const role of ['preparer', 'ops', 'cpa', 'owner']) {
      expect(users.filter((u) => u.roles.length === 1 && u.roles[0] === role), role).toHaveLength(2)
    }
    const dual = users.filter((u) => u.roles.length === 2)
    expect(dual).toHaveLength(1)
    expect([...(dual[0]?.roles ?? [])].sort()).toEqual(['cpa', 'owner'])
  })

  test('SEC-1 credentials are derived: the same every time, different per user, and the code matches RFC 6238', () => {
    const [a, b] = listTestUsers()
    expect(a && b).toBeTruthy()
    const ca = testCredentials(a?.id ?? '')
    const cb = testCredentials(b?.id ?? '')
    expect(testCredentials(a?.id ?? '').password).toBe(ca.password)
    expect(ca.password).not.toBe(cb.password)
    expect(Buffer.from(ca.secret).equals(Buffer.from(cb.secret))).toBe(false)
    expect(ca.password.length).toBeGreaterThanOrEqual(12)
    const at = new Date('2026-10-02T10:00:05-04:00')
    expect(ca.codeAt(at)).toBe(totp(ca.secret, at))
  })
})

describe('A06 test credentials stay out of product code (SEC-10)', () => {
  const importsTesting = (text: string): boolean => /from\s+['"][^'"]*auth\/testing['"]|from\s+['"]\.\/testing['"]|require\(['"][^'"]*auth\/testing['"]\)/.test(text)
  const mayImport = (file: string): boolean => /^e2e\//.test(file) || /\.test\.tsx?$/.test(file) || /(^|\/)__fixtures__\//.test(file) || file === 'src/modules/auth/testing.ts'

  function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : /\.(ts|tsx|mjs)$/.test(e.name) ? [p] : []
    })
  }

  test('SEC-10 rule: a planted product file importing the test credentials is caught, an e2e file is not', () => {
    const planted = "import { testCredentials } from '../auth/testing'"
    expect(importsTesting(planted) && !mayImport('src/app/page.ts')).toBe(true)
    expect(importsTesting(planted) && !mayImport('e2e/sign-in.spec.ts')).toBe(false)
  })

  test('SEC-10 only e2e, tests and fixtures import auth/testing', () => {
    const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'e2e'))].map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
    const bad = files.filter((f) => !mayImport(f) && importsTesting(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    expect(bad).toEqual([])
  })

  test('SEC-10 the public exports do not include the test credentials', () => {
    expect(Object.keys(publicApi)).not.toContain('testCredentials')
    expect(Object.keys(publicApi)).not.toContain('listTestUsers')
    expect(typeof publicApi.createAuth).toBe('function')
  })
})

describe('A06 the stand-in checks passwords with scrypt (SEC-1)', () => {
  test('SEC-1 the testusers engine uses scrypt from node:crypto and no extra dependency', () => {
    const dir = path.join(AUTH_DIR, 'testusers')
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f)) : []
    expect(files.length).toBeGreaterThan(0)
    const text = files.map((f) => readOwnSource(path.join('src', 'modules', 'auth', 'testusers', f))).join('\n')
    expect(text).toMatch(/scrypt/)
    expect(text).toMatch(/node:crypto/)
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => /otp|totp|speakeasy|passport|bcrypt|argon|jose|jsonwebtoken|next-auth|lucia/i.test(d))).toEqual([])
  })
})

// A secret-shaped value scan over the auth files (the planted values are built at run time so this file
// holds no secret-shaped string itself).
const RULES: [string, RegExp][] = [
  ['assigned secret', /(password|passwd|secret|api[_-]?key|token)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i],
  ['long hex', /\b[0-9a-f]{32,}\b/i],
  ['long base64', /[A-Za-z0-9+/]{40,}={0,2}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['aws key id', /\bAKIA[0-9A-Z]{16}\b/],
]
const scan = (text: string): string[] => RULES.filter(([, re]) => re.test(text)).map(([n]) => n)

describe('A06 no secret in the auth files (SEC-10, END-8)', () => {
  test('SEC-10 rule: each planted secret shape is caught and clean code is not', () => {
    expect(scan('const password = "' + 'x7Qa'.repeat(3) + '"')).toContain('assigned secret')
    expect(scan('0'.repeat(10) + 'ab12'.repeat(8))).toContain('long hex')
    expect(scan('Zm9v'.repeat(12))).toContain('long base64')
    expect(scan('-----BEGIN RSA ' + 'PRIVATE KEY-----')).toContain('private key')
    expect(scan('AKIA' + 'IOSFODNN7EXAMPLE')).toContain('aws key id')
    expect(scan("const LIVE_OFF = 'live sign-in is off until go-live'\nconst x = derive(userId, PUBLIC_STRING)")).toEqual([])
  })

  function productFiles(): string[] {
    const out: string[] = []
    const visit = (p: string): void => {
      if (!fs.existsSync(p)) return
      if (fs.statSync(p).isDirectory()) {
        for (const n of fs.readdirSync(p)) if (n !== '__fixtures__') visit(path.join(p, n))
      } else if (!/\.test\.tsx?$/.test(p)) out.push(p)
    }
    visit(AUTH_DIR)
    visit(path.join(ROOT, 'src', 'contracts', 'auth.ts'))
    visit(path.join(ROOT, 'db', 'schema', '15_auth.sql'))
    return out
  }

  test('SEC-10 no auth file (module, contract, schema) holds a secret-shaped value', () => {
    const files = productFiles()
    expect(files.length).toBeGreaterThanOrEqual(5)
    const hits = files.flatMap((f) => scan(fs.readFileSync(f, 'utf8')).map((n) => `${path.relative(ROOT, f)}: ${n}`))
    expect(hits).toEqual([])
  })

  test('SEC-10 gitleaks, when installed, finds nothing under src/modules/auth', () => {
    const r = spawnSync('gitleaks', ['detect', '--no-git', '--source', AUTH_DIR, '--config', path.join(ROOT, '.gitleaks.toml')], { encoding: 'utf8', timeout: 60_000 })
    if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return
    expect(r.status, r.stdout + r.stderr).toBe(0)
  }, 90_000)
})
