// A04 round 5 patch, reports/A04-spec-review-5.md G3 (A456; spec-writer, builders never edit this file).
// The engine must read its own outbox file through src/core/safe-read.ts's readRegularFile with the 4 MiB cap: an
// lstat size check followed by a whole-file read passes every other engine test, yet reads a file that grows after the
// look without bound and follows a link swapped in after it. Clause ARC-22 (the Claude project's one way back into
// Returns is its result file, read safely).
//
// The mock below is pass-through: it records each call and hands it to the real readRegularFile, so the engine's
// behaviour is the real one (testing.md: no own module is replaced; the call is only watched).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createAiRunner } from '../index'
import { RECORDINGS_DIR, job, outboxResult, recording, tempDir, tripleOf, writeApproved, writeOutbox } from './__fixtures__/harness'

const seen = vi.hoisted(() => ({ calls: [] as { file: string; maxBytes: number }[] }))

vi.mock('../../../core/safe-read', async (importOriginal) => {
  let real: { readRegularFile?: (file: string, maxBytes: number) => unknown } = {}
  try {
    real = await importOriginal()
  } catch {
    real = {}
  }
  return {
    ...real,
    readRegularFile: (file: string, maxBytes: number): unknown => {
      seen.calls.push({ file, maxBytes })
      if (real.readRegularFile === undefined) throw new Error('src/core/safe-read.ts does not export readRegularFile yet (A04 round 5)')
      return real.readRegularFile(file, maxBytes)
    },
  }
})

const JOB_ID = 'job-c01-finding-test'
const CAP = 4194304 // OUTBOX_MAX_BYTES, 4 MiB, written out (the review's literal)
const T0 = Date.parse('2026-10-03T09:00:00.000Z')
const STRANGER = 'job-plain-stranger-test.json'

let tmp: { dir: string; cleanup: () => void }
let exchange: string
let approvedPath: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  tmp = tempDir('exchange-safe-read')
  exchange = path.join(tmp.dir, 'exchange-canary-value')
  fs.mkdirSync(path.join(exchange, 'outbox'), { recursive: true })
  approvedPath = writeApproved(tmp.dir, [tripleOf(job('good'))])
  seen.calls.length = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  tmp.cleanup()
})

const outbox = (): string => path.resolve(exchange, 'outbox')
const own = (): string => path.resolve(outbox(), `${JOB_ID}.json`)
const GOOD = (): ReturnType<typeof recording> => recording('finding-c01-good')

function projectRunner(): ReturnType<typeof createAiRunner> {
  const r = createAiRunner({
    recordingsDir: RECORDINGS_DIR,
    approvedPath,
    env: { AI_EXCHANGE_DIR: exchange },
    pollMs: 5,
    now: () => new Date(T0),
  } as Parameters<typeof createAiRunner>[0])
  expect(r.useEngine('project')).toEqual({ ok: true })
  return r
}

/** Every path node:fs.readFileSync is asked for from now on (pass-through). */
function watchWholeReads(): string[] {
  const paths: string[] = []
  const readFileSync = fs.readFileSync.bind(fs)
  vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown, ...rest: unknown[]) => {
    if (typeof p === 'string') paths.push(path.resolve(p))
    else if (Buffer.isBuffer(p)) paths.push(path.resolve(p.toString('utf8')))
    return (readFileSync as (...a: unknown[]) => unknown)(p, ...rest)
  }) as typeof fs.readFileSync)
  return paths
}

const inOutbox = (p: string): boolean => p === outbox() || p.startsWith(outbox() + path.sep)
const callsNow = (): { file: string; maxBytes: number }[] => seen.calls.map((c) => ({ file: path.resolve(c.file), maxBytes: c.maxBytes }))

/**
 * Runs the step with a stranger in the outbox for a few polls, then writes the own file and takes one more poll.
 * Returns the step's result, the readRegularFile calls from the moment the own file appeared, and every whole read.
 */
async function runWithOwnFile(content: string): Promise<{ res: unknown; after: { file: string; maxBytes: number }[]; before: { file: string; maxBytes: number }[]; whole: string[] }> {
  fs.writeFileSync(path.join(outbox(), STRANGER), outboxResult('job-plain-stranger-test', { summary: 'PLANTED-CANARY-PLAIN (Test)' }, {}))
  const whole = watchWholeReads()
  const state = { settled: false }
  const step = projectRunner().runAiStep(job('good'), { jobId: JOB_ID })
  step.then(
    () => { state.settled = true },
    () => { state.settled = true },
  )
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(5)
  expect(state.settled, 'the step settled before its file was written').toBe(false)
  const before = callsNow()
  seen.calls.length = 0
  writeOutbox(exchange, `${JOB_ID}.json`, content)
  await vi.advanceTimersByTimeAsync(5)
  if (!state.settled) throw new Error('the step is still waiting one poll after its file was written')
  return { res: await step, after: callsNow(), before, whole }
}

function expectSafeReads(run: Awaited<ReturnType<typeof runWithOwnFile>>): void {
  // the poll that sees the own file reads it exactly once, through readRegularFile, with the cap
  expect(run.after).toEqual([{ file: own(), maxBytes: CAP }])
  // before it was there, nothing else in the outbox went through readRegularFile (the stranger is lstat'd only)
  for (const c of run.before) expect(c).toEqual({ file: own(), maxBytes: CAP })
  // and nothing in the outbox is ever read whole
  expect(run.whole.filter(inOutbox)).toEqual([])
}

describe('ARC-22 the engine reads its own outbox file through readRegularFile with the 4 MiB cap (G3)', () => {
  test('ARC-22 a result: one readRegularFile(<outbox>/<job id>.json, 4194304) on the poll that sees it, and readFileSync never touches the outbox', async () => {
    const run = await runWithOwnFile(outboxResult(JOB_ID, GOOD().output, GOOD().stamp))
    expect(run.res).toMatchObject({ ok: true, output: GOOD().output })
    expectSafeReads(run)
  })

  test('ARC-22 a refusal file: read the same way, once, with the cap', async () => {
    const refusal = JSON.stringify({ jobId: JOB_ID, refusal: { reason: 'inputs not redacted (AI-9)', problems: [], stage: 'input' } })
    const run = await runWithOwnFile(refusal)
    expect(run.res).toMatchObject({ ok: false })
    expectSafeReads(run)
  })

  test('ARC-22 an own file one byte over the cap: refused as too big after one capped read, never read whole', async () => {
    const text = outboxResult(JOB_ID, GOOD().output, GOOD().stamp)
    const run = await runWithOwnFile(text + ' '.repeat(CAP + 1 - Buffer.byteLength(text)))
    expect(run.res).toMatchObject({ ok: false, reason: expect.stringContaining('too big') as unknown })
    expectSafeReads(run)
  })

  test('ARC-22 the pass-through mock is live: readRegularFile called directly here reaches the real one', async () => {
    const specifier = '../../../core/safe-read' // by name, so typecheck stays green before the build
    const mod: unknown = await import(/* @vite-ignore */ specifier).catch(() => ({}))
    const read = (mod as { readRegularFile?: (f: string, m: number) => unknown }).readRegularFile
    expect(read).toBeTypeOf('function')
    fs.writeFileSync(path.join(tmp.dir, 'plain.json'), '{}')
    expect(read?.(path.join(tmp.dir, 'plain.json'), 10)).toEqual({ ok: true, text: '{}' })
    expect(callsNow()).toEqual([{ file: path.resolve(tmp.dir, 'plain.json'), maxBytes: 10 }])
  })
})
