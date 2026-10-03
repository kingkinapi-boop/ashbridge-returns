// B04 spec harness: temp folders, a manual clock, the stand-in fixture and settings for the QBO acceptance tests.
// Test support only; product code never imports this file.
//
// The fixture company (realm 9130000000000001, "Birchwood Fixture Ltd. (Test)", year 2025) is written twice, once in
// Returns' normalised shapes (standin/9130000000000001, what the samples engine serves) and once as fake Intuit
// responses (../api/__fixtures__/unconfirmed, what the sandbox engine reads through the fake API). Both describe the
// same books: accounts 35 Chequing, 33 Accounts Payable, 80 Common shares, 79 Sales, 55 Utilities; transactions 120
// (2024, opening capital), 130 (deposit), 131 (cheque, attachment 901) and journal entry 182 (attachment 902).
// Realm 9130000000000002 is a company whose legal name lacks "(Test)" (SEC-11), though its file claims a test company.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Clock } from '../../../core/clock'

export const FIXTURES = path.dirname(fileURLToPath(import.meta.url))
export const STANDIN_DIR = path.join(FIXTURES, 'standin')
export const REALM = '9130000000000001'
export const NON_TEST_REALM = '9130000000000002'
export const LEGAL_NAME = 'Birchwood Fixture Ltd. (Test)'
export const NON_TEST_NAME = 'Northgate Supplies Inc.'
export const YEAR_START = '2025-01-01'
export const YEAR_END = '2025-12-31'
export const OPENING_AS_OF = '2024-12-31'
export const ACCOUNT_IDS = ['35', '33', '80', '79', '55'] as const
export const ATTACHMENT_IDS = ['901', '902'] as const
export const RETURN_ID = 'ret-b04-test-0001'

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

/** A fresh temp folder per test; returns the folder and a cleanup. */
export function tempDir(label: string): { dir: string; cleanup: () => void } {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `b04-${label}-`)))
  return {
    dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Copies the stand-in fixture (both realms) into `dest` and returns `dest`, so a test can plant a fault in its copy. */
export function copyStandIn(dest: string): string {
  fs.cpSync(STANDIN_DIR, dest, { recursive: true })
  return dest
}

export function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
}

export function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

/** A clock that moves only when the code under test sleeps on it (or the test moves it). */
export type ManualClock = { clock: Clock; sleep: (ms: number) => Promise<void>; now: () => number; sleeps: number[]; advance: (ms: number) => void }

export function manualClock(iso: string): ManualClock {
  let t = new Date(iso).getTime()
  const sleeps: number[] = []
  return {
    clock: { now: () => new Date(t) },
    sleep: (ms: number) => {
      sleeps.push(ms)
      t += Math.max(0, ms)
      return Promise.resolve()
    },
    now: () => t,
    sleeps,
    advance: (ms: number) => {
      t += ms
    },
  }
}

/** Made-up setting values, built at run time so this file holds no secret-shaped string (SEC-10). */
export function plantedValue(name: string): string {
  return ['PLANTED', 'b04', name.toLowerCase().replace(/_/g, '-'), 'x7Qa9'].join('-')
}

export const SANDBOX_SETTINGS = ['QBO_SANDBOX_CLIENT_ID', 'QBO_SANDBOX_CLIENT_SECRET', 'QBO_SANDBOX_REFRESH_TOKEN'] as const

/** The sandbox engine switched on with every setting present (made-up values). */
export function sandboxEnv(): Record<string, string> {
  const env: Record<string, string> = { QBO_ENGINE: 'sandbox', NODE_ENV: 'test' }
  for (const n of SANDBOX_SETTINGS) env[n] = plantedValue(n)
  return env
}

/** The samples engine reading the stand-in folder `dir`. */
export function samplesEnv(dir: string): Record<string, string> {
  return { QBO_ENGINE: 'samples', QBO_STANDIN_DIR: dir, NODE_ENV: 'test' }
}

/** Runs `fn` and returns the error it throws or rejects with (undefined when it succeeds). */
export async function failure(fn: () => unknown): Promise<Error | undefined> {
  try {
    await fn()
    return undefined
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

/** Every regular file under `dir`, recursive, sorted. */
export function allFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

/** Names on an object and its prototype chain (up to Object.prototype) that are functions. */
export function methodNames(o: object): string[] {
  const names = new Set<string>()
  let p: object | null = o
  while (p !== null && p !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(p)) if (k !== 'constructor' && typeof (o as Record<string, unknown>)[k] === 'function') names.add(k)
    p = Object.getPrototypeOf(p) as object | null
  }
  return [...names].sort()
}

/**
 * Replaces `target` (a file or a folder) with a symbolic link to a copy of it under `elsewhere`, so the link names
 * the same content (R94: a link is refused for what it is, not for what it points at). Returns the copy's path.
 */
export function linkInPlace(target: string, elsewhere: string): string {
  fs.mkdirSync(elsewhere, { recursive: true })
  const copy = path.join(elsewhere, `${path.basename(target)}-${String(fs.readdirSync(elsewhere).length)}`)
  fs.cpSync(target, copy, { recursive: true })
  fs.rmSync(target, { recursive: true, force: true })
  fs.symlinkSync(copy, target)
  return copy
}

/** Changes every string, number, list and byte of a result in place (A07's "returns a copy" probe). */
export function mutateDeep(v: unknown, depth = 0): void {
  if (depth > 8 || v === null || typeof v !== 'object') return
  if (v instanceof Uint8Array) {
    v.fill(0x58)
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) mutateDeep(x, depth + 1)
    v.push('mutated (Test)')
    return
  }
  const o = v as Record<string, unknown>
  for (const k of Object.keys(o)) {
    const x = o[k]
    if (typeof x === 'string') o[k] = 'mutated (Test)'
    else if (typeof x === 'number') o[k] = -12345
    else if (typeof x === 'boolean') o[k] = !x
    else mutateDeep(x, depth + 1)
  }
  o['mutatedTest'] = true
}

/** A plain, comparable copy of a reader result (bytes as hex), taken before the result is mutated. */
export function plain(v: unknown): unknown {
  if (v instanceof Uint8Array) return Buffer.from(v).toString('hex')
  if (Array.isArray(v)) return v.map(plain)
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
  return v
}

/** The day before an ISO date, computed in UTC (the test's own oracle for TB-5's opening trial balance date). */
export function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** OUT-3: a name that reads as a write to QBO. */
export const WRITE_NAME = /write|update|delete|remove|upsert|insert|create|post|put|patch|save|send|upload|void|batch/i
