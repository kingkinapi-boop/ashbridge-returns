// B04 acceptance tests: engines, settings, read-only and made-up companies only (ARC-6, ARC-20, OUT-3, SEC-10, SEC-11),
// checks 5, 6, 8 and 9. Spec-writer's file; builders never edit it. The module API is written out at the top of
// read-books.acceptance.test.ts; the fake Intuit API and its routes at the top of api/__fixtures__/fake-api.ts.
//
// Spec choices (amber): the sandbox engine is "on" when QBO_ENGINE is 'sandbox' and its three settings
// (QBO_SANDBOX_CLIENT_ID, QBO_SANDBOX_CLIENT_SECRET, QBO_SANDBOX_REFRESH_TOKEN) are present; it then talks only to
// https://sandbox-quickbooks.api.intuit.com/v3/company/<realm>/ through the injected transport, with GET only (the one
// exception is the OAuth token exchange, a POST to https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer, which
// is Intuit's sign-in, not a write to the books). The live engine refuses whatever settings are present.
// Every engine refuses a company whose legal name lacks "(Test)" before it reads anything else of it (SEC-11).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { fixedClock } from '../../core/clock'
import { readSettings } from '../../core/env'
import type { QboReader } from '../../contracts/qbo'
import { readOwnSource } from '../../core/testing/read-own-source'
import { createFileStore } from '../storage'
import * as qbo from './index'
import { createMemorySnapshotStore, createQboReader, readBooks } from './index'
import { SANDBOX_HOST, TOKEN_URL, createFakeQboApi, type Recorded } from './api/__fixtures__/fake-api'
import {
  ATTACHMENT_IDS,
  ACCOUNT_IDS,
  NON_TEST_NAME,
  NON_TEST_REALM,
  OPENING_AS_OF,
  REALM,
  RETURN_ID,
  SANDBOX_SETTINGS,
  STANDIN_DIR,
  WRITE_NAME,
  YEAR_END,
  YEAR_START,
  allFiles,
  failure,
  manualClock,
  methodNames,
  plantedValue,
  samplesEnv,
  sandboxEnv,
  tempDir,
} from './__fixtures__/harness'

const SANDBOX_OFF = /QBO sandbox engine is off/
const LIVE_OFF = /live QBO is off until go-live/
const AT = '2026-10-01T12:00:00-04:00'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const QBO_DIR = path.join(ROOT, 'src', 'modules', 'qbo')

let tmp: { dir: string; cleanup: () => void }
beforeEach(() => {
  tmp = tempDir('engines')
})
afterEach(() => {
  tmp.cleanup()
})

/** A fresh file-store root in this test's temp folder. */
function storeAt(name: string): string {
  const root = path.join(tmp.dir, name)
  fs.mkdirSync(root, { recursive: true })
  return root
}

/** A sandbox reader on the fake API, with its request log. */
function sandbox(opts: { legalName?: string; realm?: string; env?: Record<string, string>; sink?: (l: string) => void } = {}) {
  const mc = manualClock(AT)
  const fake = createFakeQboApi({ now: mc.now, ...(opts.realm === undefined ? {} : { realm: opts.realm }), ...(opts.legalName === undefined ? {} : { legalName: opts.legalName }) })
  const reader = createQboReader({ env: opts.env ?? sandboxEnv(), transport: fake.transport, clock: mc.clock, sleep: mc.sleep, ...(opts.sink ? { sink: opts.sink } : {}) })
  return { reader, requests: fake.requests, mc }
}

/** Every read the reader offers, on the fixture company, gathered into one object for comparison. */
async function readAll(reader: QboReader, realm: string = REALM) {
  return {
    company: await reader.company(realm),
    trialBalance: await reader.trialBalance(realm, YEAR_END, 'accrual'),
    openingTrialBalance: await reader.trialBalance(realm, OPENING_AS_OF, 'accrual'),
    transactions: await Promise.all(ACCOUNT_IDS.map((id) => reader.transactions(realm, id, YEAR_START, YEAR_END))),
    journalEntries: await reader.journalEntries(realm, YEAR_START, YEAR_END),
    attachments: await Promise.all(
      ATTACHMENT_IDS.map(async (id) => {
        const a = await reader.attachment(realm, id)
        return { ...a, bytes: Buffer.from(a.bytes).toString('hex') }
      }),
    ),
  }
}

/** Calls one reader method and returns the error (or undefined). */
const tryRead = (reader: () => QboReader): Promise<Error | undefined> => failure(async () => reader().trialBalance(REALM, YEAR_END, 'accrual'))

const companyRequests = (reqs: readonly Recorded[]): Recorded[] => reqs.filter((r) => r.url !== TOKEN_URL)

describe('B04 engine switch (ARC-6, ARC-20, check 6)', () => {
  test('ARC-6 QBO_ENGINE defaults to samples: with no engine setting the reader serves the stand-in folder', async () => {
    const reader = createQboReader({ env: { QBO_STANDIN_DIR: STANDIN_DIR } })
    expect(reader.engine).toBe('samples')
    expect(await reader.company(REALM)).toMatchObject({ realm: REALM, legalName: 'Birchwood Fixture Ltd. (Test)', isTestCompany: true })
  })

  test('ARC-6 SEC-10 QBO_ENGINE and QBO_STANDIN_DIR are read by name through src/core/env.ts', () => {
    const s = readSettings({ QBO_ENGINE: 'sandbox', QBO_STANDIN_DIR: '/tmp/standin (Test)' }) as Record<string, unknown>
    expect([s['QBO_ENGINE'], s['QBO_STANDIN_DIR']]).toEqual(['sandbox', '/tmp/standin (Test)'])
    expect(readOwnSource('src/core/env.ts')).toMatch(/^\s*QBO_ENGINE\s*:/m)
  })

  test('ARC-6 SEC-11 production with QBO_ENGINE unset refuses, naming QBO_ENGINE (SC3 R62)', async () => {
    const e = await tryRead(() => createQboReader({ env: { NODE_ENV: 'production', QBO_STANDIN_DIR: STANDIN_DIR } }))
    expect(e?.message).toContain('QBO_ENGINE')
  })

  test('ARC-6 SEC-10 an unknown engine is refused naming QBO_ENGINE, never its value', async () => {
    const value = plantedValue('QBO_ENGINE')
    const e = await tryRead(() => createQboReader({ env: { QBO_ENGINE: value, QBO_STANDIN_DIR: STANDIN_DIR } }))
    expect(e?.message).toContain('QBO_ENGINE')
    expect(`${e?.message ?? ''} ${e?.stack ?? ''}`).not.toContain(value)
  })

  test('ARC-6 the samples engine with no QBO_STANDIN_DIR refuses, naming the setting', async () => {
    const e = await tryRead(() => createQboReader({ env: { QBO_ENGINE: 'samples' } }))
    expect(e?.message).toContain('QBO_STANDIN_DIR')
  })

  test('ARC-6 ARC-20 sandbox without its settings refuses with "QBO sandbox engine is off" and makes no request', async () => {
    for (const env of [{ QBO_ENGINE: 'sandbox' }, { ...sandboxEnv(), QBO_SANDBOX_REFRESH_TOKEN: '' }, { QBO_ENGINE: 'sandbox', QBO_SANDBOX_CLIENT_ID: plantedValue('QBO_SANDBOX_CLIENT_ID') }]) {
      const s = sandbox({ env })
      const e = await failure(() => s.reader.trialBalance(REALM, YEAR_END, 'accrual'))
      expect(e?.message, JSON.stringify(Object.keys(env))).toMatch(SANDBOX_OFF)
      expect(s.requests).toEqual([])
    }
  })

  test('ARC-6 ARC-20 live refuses with "live QBO is off until go-live" and makes no request, with or without settings', async () => {
    for (const env of [{ QBO_ENGINE: 'live' }, { ...sandboxEnv(), QBO_ENGINE: 'live', QBO_LIVE_CLIENT_ID: plantedValue('QBO_LIVE_CLIENT_ID'), QBO_LIVE_CLIENT_SECRET: plantedValue('QBO_LIVE_CLIENT_SECRET') }]) {
      const s = sandbox({ env })
      const e = await failure(async () => {
        await s.reader.company(REALM)
        await s.reader.trialBalance(REALM, YEAR_END, 'accrual')
      })
      expect(e?.message).toMatch(LIVE_OFF)
      expect(s.requests).toEqual([])
    }
  })

  test('ARC-20 sandbox switched on with made-up settings returns, through the fake API, exactly what samples returns for the same fixture company', async () => {
    const fromSamples = await readAll(createQboReader({ env: samplesEnv(STANDIN_DIR) }))
    const s = sandbox()
    expect(s.reader.engine).toBe('sandbox')
    const fromSandbox = await readAll(s.reader)
    expect(fromSandbox).toEqual(fromSamples)
    expect(companyRequests(s.requests).length).toBeGreaterThan(0)
  }, 30_000)

  test('ARC-20 the switch works both ways: samples, sandbox, samples again; and sandbox, samples, sandbox again', async () => {
    const samplesTb = async () => createQboReader({ env: samplesEnv(STANDIN_DIR) }).trialBalance(REALM, YEAR_END, 'accrual')
    const sandboxTb = async () => sandbox().reader.trialBalance(REALM, YEAR_END, 'accrual')
    const a = await samplesTb()
    expect(await sandboxTb()).toEqual(a)
    expect(await samplesTb()).toEqual(a)
    const b = await sandboxTb()
    expect(await samplesTb()).toEqual(b)
    expect(await sandboxTb()).toEqual(b)
    const off = sandbox({ env: { QBO_ENGINE: 'sandbox' } })
    expect((await failure(() => off.reader.trialBalance(REALM, YEAR_END, 'accrual')))?.message).toMatch(SANDBOX_OFF)
    expect(await sandboxTb()).toEqual(a)
  }, 30_000)

  test('ARC-20 TB-1 planted: the sandbox engine refuses a cash-basis trial balance with the reason and asks the API for nothing', async () => {
    const s = sandbox()
    const e = await failure(() => s.reader.trialBalance(REALM, YEAR_END, 'cash' as string as 'accrual'))
    expect(e?.message).toMatch(/accrual/i)
    expect(companyRequests(s.requests).filter((r) => r.url.includes('/reports/'))).toEqual([])
  })

  test('ARC-20 readBooks through the sandbox engine stores the same rows as through samples', async () => {
    const files = createFileStore({ root: storeAt('store') })
    const viaSamples = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, { reader: createQboReader({ env: samplesEnv(STANDIN_DIR) }), files, store: createMemorySnapshotStore(), clock: fixedClock(AT) })
    const s = sandbox()
    const viaSandbox = await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, { reader: s.reader, files, store: createMemorySnapshotStore(), clock: fixedClock(AT) })
    expect([viaSandbox.trialBalance, viaSandbox.openingTrialBalance, viaSandbox.transactions, viaSandbox.journalEntries]).toEqual([
      viaSamples.trialBalance,
      viaSamples.openingTrialBalance,
      viaSamples.transactions,
      viaSamples.journalEntries,
    ])
    expect(viaSandbox.snapshots.map((x) => [x.kind, x.engine])).toEqual(viaSamples.snapshots.map((x) => [x.kind, 'sandbox']))
  }, 30_000)
})

describe('B04 read only, ever (OUT-3, check 5)', () => {
  test('OUT-3 no engine object offers a write, update or delete method', () => {
    const readers = [createQboReader({ env: samplesEnv(STANDIN_DIR) }), sandbox().reader]
    for (const r of readers) {
      expect(methodNames(r).filter((n) => WRITE_NAME.test(n)), r.engine).toEqual([])
      expect(methodNames(r).sort()).toEqual(['attachment', 'company', 'journalEntries', 'transactions', 'trialBalance'])
    }
  })

  test('OUT-3 planted: an engine object with an updateJournalEntry method is caught by the name rule', () => {
    const planted = { company: () => 1, updateJournalEntry: () => 2 }
    expect(methodNames(planted).filter((n) => WRITE_NAME.test(n))).toEqual(['updateJournalEntry'])
  })

  test('OUT-3 the qbo module exports no write, update or delete function', () => {
    const names = Object.keys(qbo).filter((n) => !/^create(QboReader|MemorySnapshotStore|DbSnapshotStore)$/.test(n))
    expect(names).toContain('readBooks')
    expect(names.filter((n) => WRITE_NAME.test(n))).toEqual([])
  })

  test('OUT-3 every read, and readBooks, sends only GET requests to the sandbox company host (spy transport)', async () => {
    const s = sandbox()
    await readAll(s.reader)
    const files = createFileStore({ root: storeAt('store') })
    await readBooks(RETURN_ID, REALM, YEAR_START, YEAR_END, { reader: s.reader, files, store: createMemorySnapshotStore(), clock: fixedClock(AT) })
    const company = companyRequests(s.requests)
    expect(company.length).toBeGreaterThan(5)
    for (const r of company) {
      expect(r.method, r.url).toBe('GET')
      expect(r.url.startsWith(`${SANDBOX_HOST}/v3/company/${REALM}/`), r.url).toBe(true)
    }
    for (const r of s.requests.filter((x) => x.url === TOKEN_URL)) expect(r.method).toBe('POST')
  }, 30_000)
})

describe('B04 made-up companies only (SEC-11, check 8)', () => {
  test('SEC-11 planted: the samples engine refuses the company named without "(Test)" before any read, though its file claims a test company', async () => {
    const reader = createQboReader({ env: samplesEnv(STANDIN_DIR) })
    for (const call of [
      () => reader.company(NON_TEST_REALM),
      () => reader.trialBalance(NON_TEST_REALM, YEAR_END, 'accrual'),
      () => reader.transactions(NON_TEST_REALM, '35', YEAR_START, YEAR_END),
      () => reader.journalEntries(NON_TEST_REALM, YEAR_START, YEAR_END),
    ]) {
      const e = await failure(call)
      expect(e?.message).toContain('(Test)')
    }
  })

  test('SEC-11 planted: the sandbox engine refuses the company named without "(Test)" and asks for nothing but its company record', async () => {
    const s = sandbox({ realm: NON_TEST_REALM, legalName: NON_TEST_NAME })
    for (const call of [
      () => s.reader.trialBalance(NON_TEST_REALM, YEAR_END, 'accrual'),
      () => s.reader.transactions(NON_TEST_REALM, '35', YEAR_START, YEAR_END),
      () => s.reader.journalEntries(NON_TEST_REALM, YEAR_START, YEAR_END),
      () => s.reader.attachment(NON_TEST_REALM, '901'),
    ]) {
      expect((await failure(call))?.message).toContain('(Test)')
    }
    const other = companyRequests(s.requests).filter((r) => !/\/companyinfo\/|\/preferences/.test(r.url))
    expect(other).toEqual([])
  })

  test('SEC-11 the live engine refuses always, so it refuses the company named without "(Test)" too', async () => {
    const s = sandbox({ env: { QBO_ENGINE: 'live' }, realm: NON_TEST_REALM, legalName: NON_TEST_NAME })
    expect((await failure(() => s.reader.company(NON_TEST_REALM)))?.message).toMatch(LIVE_OFF)
    expect(s.requests).toEqual([])
  })

  test('SEC-11 readBooks on the company named without "(Test)" stores no snapshot and no file, on samples and on sandbox', async () => {
    for (const reader of [createQboReader({ env: samplesEnv(STANDIN_DIR) }), sandbox({ realm: NON_TEST_REALM, legalName: NON_TEST_NAME }).reader]) {
      const root = storeAt(`store-${reader.engine}`)
      const store = createMemorySnapshotStore()
      const e = await failure(() => readBooks(RETURN_ID, NON_TEST_REALM, YEAR_START, YEAR_END, { reader, files: createFileStore({ root }), store, clock: fixedClock(AT) }))
      expect(e?.message, reader.engine).toContain('(Test)')
      expect(await store.list()).toEqual([])
      expect(allFiles(root)).toEqual([])
    }
  })
})

describe('B04 no secret in logs or files (SEC-10, check 9)', () => {
  test('SEC-10 settings are logged by name only: the planted setting values never appear in the captured log or in any error', async () => {
    const lines: string[] = []
    const sink = (l: string): void => {
      lines.push(l)
    }
    const s = sandbox({ sink })
    await readAll(s.reader)
    const errors: string[] = []
    for (const env of [{ QBO_ENGINE: 'sandbox', QBO_SANDBOX_CLIENT_SECRET: plantedValue('QBO_SANDBOX_CLIENT_SECRET') }, { ...sandboxEnv(), QBO_ENGINE: 'live' }]) {
      const e = await failure(() => sandbox({ env, sink }).reader.trialBalance(REALM, YEAR_END, 'accrual'))
      errors.push(`${e?.message ?? ''}\n${e?.stack ?? ''}`)
    }
    const text = [...lines, ...errors].join('\n')
    expect(lines.join('\n')).toContain('QBO_ENGINE')
    for (const n of SANDBOX_SETTINGS) expect(text, n).not.toContain(plantedValue(n))
  }, 30_000)

  // A secret-shaped value scan over every file under src/modules/qbo (fixtures and goldens included). The planted values
  // are built at run time so this file holds no secret-shaped string itself.
  const RULES: [string, RegExp][] = [
    ['assigned secret', /(password|passwd|secret|api[_-]?key|token|client[_-]?id)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i],
    ['long hex', /\b[0-9a-f]{32,}\b/i],
    ['long base64', /[A-Za-z0-9+/]{40,}={0,2}/],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['bearer token', /Bearer\s+[A-Za-z0-9._~+/-]{20,}/],
    ['aws key id', /\bAKIA[0-9A-Z]{16}\b/],
  ]
  // Web addresses are taken out first: an endpoint constant (a token URL, a report path) is not a secret, and a long
  // path reads like base64. Gitleaks, run below where it is installed, scans the whole text.
  const scan = (text: string): string[] => {
    const bare = text.replace(/https?:\/\/[^\s'"`]*/g, '')
    return RULES.filter(([, re]) => re.test(bare)).map(([n]) => n)
  }

  test('SEC-10 rule: each planted secret shape is caught, and the module and fixture wording is not', () => {
    expect(scan('const clientSecret = "' + 'x7Qa'.repeat(3) + '"')).toContain('assigned secret')
    expect(scan('0'.repeat(10) + 'ab12'.repeat(8))).toContain('long hex')
    expect(scan('Zm9v'.repeat(12))).toContain('long base64')
    expect(scan('-----BEGIN RSA ' + 'PRIVATE KEY-----')).toContain('private key')
    expect(scan('Authorization: Bearer ' + 'eyJhbGciOi'.repeat(3))).toContain('bearer token')
    expect(scan("const OFF = 'QBO sandbox engine is off'\nconst url = `${HOST}/v3/company/${realm}/reports/TrialBalance`")).toEqual([])
    expect(scan("export const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'")).toEqual([])
    expect(scan('"TempDownloadUri": "https://sandbox-quickbooks.api.intuit.com/v3/company/9130000000000001/download/901"')).toEqual([])
    expect(scan("const url = 'https://example.test/x'\nconst refreshToken = '" + 'x7Qa'.repeat(3) + "'")).toContain('assigned secret')
  })

  test('SEC-10 no file under src/modules/qbo (code, fixtures, goldens) holds a secret-shaped value', () => {
    const files = allFiles(QBO_DIR).filter((f) => !f.endsWith('engines.acceptance.test.ts'))
    expect(files.length).toBeGreaterThanOrEqual(10)
    expect(files.some((f) => f.endsWith(path.join('qbo', 'index.ts')))).toBe(true)
    const hits = files.flatMap((f) => scan(fs.readFileSync(f, 'utf8')).map((n) => `${path.relative(ROOT, f)}: ${n}`))
    expect(hits).toEqual([])
  })

  test('SEC-10 gitleaks, when installed, finds nothing under src/modules/qbo', () => {
    const r = spawnSync('gitleaks', ['detect', '--no-git', '--source', QBO_DIR, '--config', path.join(ROOT, '.gitleaks.toml')], { encoding: 'utf8', timeout: 60_000 })
    if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return
    expect(r.status, r.stdout + r.stderr).toBe(0)
  }, 90_000)

  test('ARC-6 nothing under src/ imports testworld/ (the samples engine reads a folder, never the test world)', () => {
    const product = allFiles(path.join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes(`${path.sep}__fixtures__${path.sep}`))
    expect(product.some((f) => f.endsWith(path.join('qbo', 'index.ts')))).toBe(true)
    const hits = product.filter((f) => /from\s+['"][^'"]*testworld\/|import\(\s*['"][^'"]*testworld\//.test(fs.readFileSync(f, 'utf8')))
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([])
  })
})
