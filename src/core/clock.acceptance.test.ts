// F00T (spec job): clock.ts tests by a worker who did not build it, plus the ARC-16 seed rule over src/core.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { fixedClock, getClock, now, setClock, systemClock } from './clock'
import { readOwnSource } from './testing/read-own-source'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CORE = path.join(ROOT, 'src', 'core')
const FIXTURES = path.join(CORE, '__fixtures__', 'core')

afterEach(() => {
  setClock(systemClock)
  vi.useRealTimers()
})

/** Every .ts file under a folder, recursively, skipping node_modules. */
function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...tsFiles(full))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

/** The text of each property-run call in a source, from its name to its closing parenthesis. */
function assertCalls(source: string): { line: number; text: string }[] {
  const calls: { line: number; text: string }[] = []
  const opener = /\bfc\.assert\s*\(/g
  for (let m = opener.exec(source); m !== null; m = opener.exec(source)) {
    let depth = 0
    let end = m.index + m[0].length - 1
    for (let i = end; i < source.length; i++) {
      const ch = source[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    calls.push({ line: source.slice(0, m.index).split('\n').length, text: source.slice(m.index, end + 1) })
  }
  return calls
}

/** A call is seeded when it passes `seed: <number>` itself or through a named options constant of the same file. */
function isSeeded(call: string, source: string): boolean {
  if (/\bseed\s*:\s*\d/.test(call)) return true
  const last = /,\s*([A-Za-z_$][\w$]*)\s*,?\s*\)$/.exec(call)?.[1]
  if (last === undefined) return false
  return new RegExp(`\\bconst\\s+${last}\\s*(?::[^=]+)?=\\s*\\{[^}]*\\bseed\\s*:\\s*\\d`).test(source)
}

function unseeded(source: string): number[] {
  return assertCalls(source)
    .filter((c) => !isSeeded(c.text, source))
    .map((c) => c.line)
}

describe('F00T clock.ts (ARC-16)', () => {
  test('ARC-16 a pinned clock gives the pinned time, and getClock returns the clock that was set', () => {
    const pinned = fixedClock('2026-01-15T12:00:00Z')
    setClock(pinned)
    expect(getClock()).toBe(pinned)
    expect(now().toISOString()).toBe('2026-01-15T12:00:00.000Z')
    expect(now().toISOString()).toBe('2026-01-15T12:00:00.000Z')
  })

  test('ARC-16 a pinned clock hands out a fresh Date each time: changing one does not move the clock', () => {
    setClock(fixedClock('2026-06-30T23:59:59.999Z'))
    const first = now()
    first.setUTCFullYear(1999)
    expect(now().toISOString()).toBe('2026-06-30T23:59:59.999Z')
    expect(now()).not.toBe(now())
  })

  test('ARC-16 systemClock reads the system time (pinned here with fake timers)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'))
    const read = systemClock.now()
    expect(read).toBeInstanceOf(Date)
    expect(read.toISOString()).toBe('2026-05-01T10:00:00.000Z')
    vi.setSystemTime(new Date('2026-05-01T10:00:01.500Z'))
    expect(systemClock.now().toISOString()).toBe('2026-05-01T10:00:01.500Z')
  })

  test('ARC-16 reset: setClock(systemClock) undoes a pin', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-01T08:00:00.000Z'))
    setClock(fixedClock('2020-01-01T00:00:00Z'))
    expect(now().toISOString()).toBe('2020-01-01T00:00:00.000Z')
    setClock(systemClock)
    expect(getClock()).toBe(systemClock)
    expect(now().toISOString()).toBe('2026-07-01T08:00:00.000Z')
  })

  test('ARC-16 a fresh clock module starts on systemClock', async () => {
    vi.resetModules()
    const fresh = await import('./clock')
    expect(fresh.getClock()).toBe(fresh.systemClock)
  })

  test('ARC-16 the seed rule catches a planted property run without a fixed seed, and passes seeded ones', () => {
    expect(unseeded(fs.readFileSync(path.join(FIXTURES, 'unseeded.txt'), 'utf8'))).toEqual([12])
    expect(unseeded(fs.readFileSync(path.join(FIXTURES, 'seeded.txt'), 'utf8'))).toEqual([])
  })

  test('ARC-16 every fc.assert in src/core passes a fixed seed', () => {
    const files = tsFiles(CORE)
    expect(files.length).toBeGreaterThan(5)
    let calls = 0
    const offenders: string[] = []
    for (const file of files) {
      const source = readOwnSource(file)
      calls += assertCalls(source).length
      for (const line of unseeded(source)) offenders.push(`${path.relative(ROOT, file)}:${String(line)}`)
    }
    expect(calls, 'the rule found property runs to check').toBeGreaterThan(0)
    expect(offenders, 'property runs without a fixed seed').toEqual([])
  })

  test('ARC-7 core.test.ts is gone: its content lives in the acceptance files of each core module', () => {
    expect(fs.existsSync(path.join(CORE, 'core.test.ts'))).toBe(false)
  })

  test('ARC-15 clock.ts is a mutation target (// @mutate in its first 5 lines)', () => {
    const head = readOwnSource(path.join(CORE, 'clock.ts')).split('\n').slice(0, 5).join('\n')
    expect(head).toMatch(/\/\/ @mutate/)
  })
})
