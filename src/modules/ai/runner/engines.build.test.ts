// A04 build tests (the builder's own; the acceptance file is not touched). They pin what mutation found the
// acceptance tests leave open: the reason words for an unreadable entry, an outbox entry named for the job that
// is a folder, and the order recordings are read in.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { aiEngines } from './engines'
import { collectLines, job, recording, tempDir } from './__fixtures__/harness'

let tmp: { dir: string; cleanup: () => void }
beforeEach(() => {
  tmp = tempDir('engines-build')
})
afterEach(() => {
  vi.restoreAllMocks()
  tmp.cleanup()
})

const recordingText = (value: unknown): string => JSON.stringify(value)

describe('ARC-16 an unreadable .json entry in the recordings folder is logged once, by name and error code', () => {
  test('ARC-16 a folder named like a recording: the reason is the error code', async () => {
    fs.mkdirSync(path.join(tmp.dir, 'a-dir.json'))
    fs.writeFileSync(path.join(tmp.dir, 'b-good.json'), recordingText(recording('finding-c01-good')))
    const { lines, sink } = collectLines()
    const ctx = { recordingsDir: tmp.dir, pollMs: 5, sink, waiting: new Map<string, number>(), seen: new Set<string>(), now: () => new Date(0), deadline: new Date(1) }
    const res = await aiEngines.recorded.run(job('good'), ctx)
    expect(res.ok).toBe(true)
    expect(lines).toEqual(['ai exchange: ignored recording a-dir.json: EISDIR'])
  })
})

describe('ARC-16 recordings are read in name order, so the duplicate message lists names in order', () => {
  test('ARC-16 two recordings for one key list the earlier name first whatever order the folder lists them', async () => {
    const text = recordingText(recording('finding-c01-good'))
    fs.writeFileSync(path.join(tmp.dir, 'a-first.json'), text)
    fs.writeFileSync(path.join(tmp.dir, 'b-second.json'), text)
    const real = fs.readdirSync.bind(fs)
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: fs.PathLike, o?: unknown) => {
      return [...(real(p, o as never))].reverse()
    }) as typeof fs.readdirSync)
    const ctx = { recordingsDir: tmp.dir, pollMs: 5, sink: () => undefined, waiting: new Map<string, number>(), seen: new Set<string>(), now: () => new Date(0), deadline: new Date(1) }
    const res = await aiEngines.recorded.run(job('good'), ctx)
    expect(res).toMatchObject({ ok: false })
    if (!res.ok) expect(res.reason).toContain('a-first.json and b-second.json')
  })
})

// Round 5 spec patch (reports/A04-findings-5.md, RC2): the test that pinned "an outbox entry named for this job that
// is a folder is ignored and the job keeps waiting" is retired here; exchange.acceptance.test.ts restates it as
// "a folder at the own name fails within one poll as not a file".

// Round 5 build tests: what mutation found the acceptance tests leave open in the exchange seam.
describe('ARC-22 the exchange seam (round 5)', () => {
  const ID = 'job-build-seam-test'
  const T0 = new Date('2026-10-03T09:00:00.000Z')
  let exchange: string
  let clock: number
  beforeEach(() => {
    clock = T0.getTime()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    exchange = path.join(tmp.dir, 'exchange')
    fs.mkdirSync(path.join(exchange, 'outbox'), { recursive: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function ctxFor(over: Record<string, unknown> = {}): Parameters<typeof aiEngines.project.run>[1] {
    return {
      jobId: ID,
      recordingsDir: tmp.dir,
      exchangeDir: exchange,
      pollMs: 5,
      sink: () => undefined,
      waiting: new Map<string, number>(),
      seen: new Set<string>(),
      now: () => new Date(clock),
      deadline: new Date(T0.getTime() + 60_000),
      ...over,
    }
  }

  test('ARC-22 a file named inbox (not a folder) is refused as not a real folder, nothing written', async () => {
    fs.writeFileSync(path.join(exchange, 'inbox'), 'x')
    const res = await aiEngines.project.run(job('good'), ctxFor())
    expect(res).toMatchObject({ ok: false, reason: expect.stringContaining('inbox folder is not a real folder') as unknown })
    expect(fs.readdirSync(exchange).sort()).toEqual(['inbox', 'outbox'])
  })

  test('ARC-22 a stranger that vanishes between the listing and the look is skipped, not logged, and the wait goes on', async () => {
    fs.writeFileSync(path.join(exchange, 'outbox', 'gone-by-then.json'), '{}')
    const lines: string[] = []
    const lstat = fs.lstatSync.bind(fs)
    vi.spyOn(fs, 'lstatSync').mockImplementation(((p: fs.PathLike, o?: unknown) => {
      if (String(p).endsWith('gone-by-then.json')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return (lstat as (q: fs.PathLike, r?: unknown) => fs.Stats)(p, o)
    }))
    const pending = aiEngines.project.run(job('good'), ctxFor({ sink: (l: string) => lines.push(l) }))
    await vi.advanceTimersByTimeAsync(20)
    expect(lines).toEqual([])
    clock = T0.getTime() + 60_000
    await vi.advanceTimersByTimeAsync(5)
    await expect(pending).resolves.toMatchObject({ ok: false })
  })

  test('ARC-22 waiting counts the pollers on one job id and is empty once all have ended', async () => {
    const waiting = new Map<string, number>()
    const one = aiEngines.project.run(job('good'), ctxFor({ waiting, deadline: new Date(T0.getTime() + 10) }))
    const two = aiEngines.project.run(job('good'), ctxFor({ waiting, deadline: new Date(T0.getTime() + 60_000) }))
    await vi.advanceTimersByTimeAsync(0)
    expect(waiting.get(ID)).toBe(2)
    clock = T0.getTime() + 10
    await vi.advanceTimersByTimeAsync(5)
    await expect(one).resolves.toMatchObject({ ok: false })
    expect(waiting.get(ID)).toBe(1)
    fs.writeFileSync(path.join(exchange, 'outbox', `${ID}.json`), JSON.stringify({ jobId: ID, refusal: { reason: 'r', problems: [], stage: 'run' } }))
    await vi.advanceTimersByTimeAsync(5)
    await expect(two).resolves.toMatchObject({ ok: false })
    expect(waiting.size).toBe(0)
  })
})
