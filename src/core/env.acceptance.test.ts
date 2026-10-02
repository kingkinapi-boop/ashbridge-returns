// F00T (spec job): env.ts tests by a worker who did not build it. Settings are read by name and never printed (SEC-10).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readSettings } from './env'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLANTED = 'mk-planted-setting-value-7f3a (Test)'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Runs `fn`, capturing everything written to stdout, stderr and the console. */
function captureOutput(fn: () => void): string {
  const seen: string[] = []
  const keep = (...args: unknown[]): boolean => {
    seen.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    return true
  }
  vi.spyOn(process.stdout, 'write').mockImplementation(keep)
  vi.spyOn(process.stderr, 'write').mockImplementation(keep)
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation(keep)
  try {
    fn()
  } catch {
    // the refusal itself is checked elsewhere
  }
  return seen.join('\n')
}

describe('F00T env.ts (SEC-10)', () => {
  test('SEC-10 each allowed NODE_ENV is read back as given', () => {
    expect(readSettings({ NODE_ENV: 'development' }).NODE_ENV).toBe('development')
    expect(readSettings({ NODE_ENV: 'test' }).NODE_ENV).toBe('test')
    expect(readSettings({ NODE_ENV: 'production' }).NODE_ENV).toBe('production')
  })

  test('SEC-10 a missing NODE_ENV defaults to development', () => {
    expect(readSettings({}).NODE_ENV).toBe('development')
    expect(readSettings({ NODE_ENV: undefined }).NODE_ENV).toBe('development')
  })

  test('SEC-10 settings come from the source passed in, not from the process', () => {
    expect(readSettings({ NODE_ENV: 'production' })).toEqual({ NODE_ENV: 'production' })
  })

  test('SEC-10 a bad setting is refused by name, exactly "Invalid settings: NODE_ENV"', () => {
    expect(() => readSettings({ NODE_ENV: PLANTED })).toThrow(new Error('Invalid settings: NODE_ENV'))
    expect(() => readSettings({ NODE_ENV: '' })).toThrow(new Error('Invalid settings: NODE_ENV'))
  })

  test('SEC-10 env.ts never prints a value: not in the error, its stack, its fields or any output', () => {
    let caught: unknown
    const printed = captureOutput(() => {
      try {
        readSettings({ NODE_ENV: PLANTED })
      } catch (e) {
        caught = e
        throw e
      }
    })
    expect(caught).toBeInstanceOf(Error)
    const err = caught as Error
    const everything = [err.message, String(err.stack), String(err), JSON.stringify(err, Object.getOwnPropertyNames(err)), String((err as { cause?: unknown }).cause)].join('\n')
    expect(everything).not.toContain(PLANTED)
    expect(everything).not.toContain('mk-planted')
    expect(printed).not.toContain('mk-planted')
  })

  test('SEC-10 a good read prints nothing', () => {
    expect(captureOutput(() => readSettings({ NODE_ENV: 'test', OTHER_SECRET: PLANTED }))).toBe('')
  })

  test('ARC-15 env.ts is a mutation target (// @mutate in its first 5 lines)', () => {
    const head = fs.readFileSync(path.join(ROOT, 'src', 'core', 'env.ts'), 'utf8').split('\n').slice(0, 5).join('\n')
    expect(head).toMatch(/\/\/ @mutate/)
  })
})
