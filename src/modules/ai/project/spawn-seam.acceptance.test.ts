// A08 round 4 acceptance tests (spec-writer; builders never edit this file). Lead directive A551 (plan/cards/A08.md,
// 4 Oct 04:03Z), findings review 3: the spawn seam. `vi.mock('node:child_process')` is hoisted over this whole file,
// so these rows live in their own file. The mocked `spawn` passes through to the real one (and records its arguments
// and options) unless a row hands it a fake child for one call; every row puts the pass-through back in `finally`.
// S9: a spawn error with no `code` is refused "the Claude program could not be started (error)" (call.ts:55).
// S10: the env handed to spawn holds only string values; a setting given as undefined is not a key (index.ts:266).
// S11: the spawn options are pinned: shell false, windowsHide true, stdio ['pipe', 'pipe', 'ignore'] (call.ts:37).
// S12: with fake timers on a fake child: kill() at the time limit, then kill('SIGKILL') at exactly +5000 ms and not at
//   +4999 ms (call.ts:47).
import { EventEmitter } from 'node:events'
import * as childProcess from 'node:child_process'
import os from 'node:os'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { runClaude } from './call'
import { runAiProjectOnce } from './index'
import { inboxJob, makeWorld, outboxOf, stampFromJob, VALID_OUTPUT, type World } from './__fixtures__/harness'

vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>()
  const spawnReal = real.spawn as unknown as (...a: unknown[]) => unknown
  return { ...real, spawn: vi.fn((...args: unknown[]) => spawnReal(...args)) }
})

type AnyFn = (...a: unknown[]) => unknown
const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
const spawnReal = actual.spawn as unknown as AnyFn
const passThrough: AnyFn = (...args: unknown[]) => spawnReal(...args)
const spawnMock = childProcess.spawn as unknown as Mock<AnyFn>

const SLOW = { timeout: 60_000 }

let worlds: World[] = []
function world(...args: Parameters<typeof makeWorld>): World {
  const w = makeWorld(...args)
  worlds.push(w)
  return w
}

beforeEach(() => {
  spawnMock.mockClear()
  spawnMock.mockImplementation(passThrough)
})

afterEach(() => {
  spawnMock.mockImplementation(passThrough)
  vi.useRealTimers()
  for (const w of worlds) w.cleanup()
  worlds = []
})

interface FakeChild extends EventEmitter {
  stdin: PassThrough
  stdout: PassThrough
  kill: Mock<(signal?: string) => boolean>
  pid: number
}
/** A child that never runs: its streams are in-memory, and its kill is a recorder. */
function fakeChild(): FakeChild {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    kill: vi.fn<(signal?: string) => boolean>(() => true),
    pid: 424_242,
  })
}

/** The options object of each recorded spawn call. */
const spawnOptions = (): Record<string, unknown>[] => spawnMock.mock.calls.map((c) => (c[2] ?? {}) as Record<string, unknown>)

describe('ARC-22 AI-8 SEC-10 A551 S9 to S11 what the launcher hands to spawn, and a spawn that fails', SLOW, () => {
  test('ARC-22 A551 S9 a spawn error with no code is refused at stage run "the Claude program could not be started (error)", and the run ends ok', async () => {
    const w = world(['c01-clean'])
    const child = fakeChild()
    spawnMock.mockImplementation(() => {
      setImmediate(() => child.emit('error', new Error('planted spawn failure with no code (Test)')))
      return child
    })
    let result: unknown
    try {
      result = await runAiProjectOnce({ argv: [], env: w.env, approvedPath: w.approvedPath })
    } finally {
      spawnMock.mockImplementation(passThrough)
    }
    expect(result).toEqual({ ok: true })
    expect(spawnMock, 'the launcher started the program through spawn').toHaveBeenCalledTimes(1)
    expect(outboxOf(w, 'c01-clean')).toEqual({
      jobId: 'c01-clean',
      refusal: { reason: 'the Claude program could not be started (error)', problems: [], stage: 'run' },
    })
  })

  test('ARC-22 A551 S9 runClaude given a spawn error with no code resolves the same reason (the call itself)', async () => {
    const child = fakeChild()
    spawnMock.mockImplementation(() => {
      setImmediate(() => child.emit('error', new Error('planted spawn failure with no code (Test)')))
      return child
    })
    let got: unknown
    try {
      got = await runClaude({ bin: 'claude-seam-test', args: [], cwd: os.tmpdir(), env: {}, stdin: 'prompt (Test)', timeoutMs: 60_000, outputMaxBytes: 1024 })
    } finally {
      spawnMock.mockImplementation(passThrough)
    }
    expect(got).toEqual({ ok: false, reason: 'the Claude program could not be started (error)' })
  })

  test('ARC-22 SEC-10 A551 S10 the env handed to spawn holds only string values: a TZ given as undefined is not a key', async () => {
    const w = world(['c01-clean'])
    const result = await runAiProjectOnce({ argv: [], env: { ...w.env, TZ: undefined }, approvedPath: w.approvedPath })
    expect(result).toEqual({ ok: true })
    expect(outboxOf(w, 'c01-clean')).toEqual({ jobId: 'c01-clean', output: VALID_OUTPUT, stamp: stampFromJob(inboxJob('c01-clean')) })
    const [options] = spawnOptions()
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const env = (options?.['env'] ?? {}) as Record<string, unknown>
    // sentinel: the allowlisted PATH did reach spawn
    expect(Object.keys(env)).toContain('PATH')
    expect(Object.keys(env)).not.toContain('TZ')
    expect(Object.entries(env).filter(([, v]) => typeof v !== 'string')).toEqual([])
  })

  test('AI-8 SEC-10 A551 S11 the spawn options are pinned: shell false, windowsHide true, stdio pipe, pipe, ignore', async () => {
    const w = world(['c01-clean'])
    const result = await runAiProjectOnce({ argv: [], env: w.env, approvedPath: w.approvedPath })
    expect(result).toEqual({ ok: true })
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [options] = spawnOptions()
    expect(options?.['shell']).toBe(false)
    expect(options?.['windowsHide']).toBe(true)
    expect(options?.['stdio']).toEqual(['pipe', 'pipe', 'ignore'])
  })
})

describe('ARC-22 R96 A551 S12 the stop at the time limit, on fake timers and a fake child', () => {
  test("ARC-22 R96 A551 S12 kill() at the limit, then kill('SIGKILL') exactly 5000 ms later and not at 4999 ms; the call resolves for the time limit", async () => {
    const child = fakeChild()
    spawnMock.mockImplementation(() => child)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const done = runClaude({ bin: 'claude-seam-test', args: [], cwd: os.tmpdir(), env: {}, stdin: 'prompt (Test)', timeoutMs: 1000, outputMaxBytes: 1024 })
      expect(spawnMock).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(999)
      expect(child.kill.mock.calls).toEqual([])
      vi.advanceTimersByTime(1)
      expect(child.kill.mock.calls).toEqual([[]])
      vi.advanceTimersByTime(4999)
      expect(child.kill.mock.calls).toEqual([[]])
      vi.advanceTimersByTime(1)
      expect(child.kill.mock.calls).toEqual([[], ['SIGKILL']])
      child.emit('close', null)
      await expect(done).resolves.toEqual({ ok: false, reason: 'the Claude CLI did not finish within the time limit (1 seconds)' })
    } finally {
      vi.useRealTimers()
      spawnMock.mockImplementation(passThrough)
    }
  })
})
