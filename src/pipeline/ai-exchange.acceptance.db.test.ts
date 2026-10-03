// A04 acceptance tests: AI exchange jobs through F06's real queue and runner (spec-writer; builders never
// edit this file). This file sits in src/pipeline, the composition root (F10), because a module may not
// import another module (ARC-7): it joins the AI module's handler to the jobs module only through their
// public index files. The API it uses is written out at the top of src/modules/ai/runner/runner.acceptance.test.ts.
// Fixture data is read as JSON from src/modules/ai/runner/__fixtures__ and __recordings__ (never imported).
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { validateAiOutput } from '../contracts/ai'
import type { Clock } from '../core/clock'
import { cloneTestDb } from '../core/db'
import { createAiRunner, createAiStepHandler } from '../modules/ai/index'
import { createJobQueue, createRunner } from '../modules/jobs/index'

const RUNNER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'modules', 'ai', 'runner')
const RECORDINGS_DIR = path.join(RUNNER_DIR, '__recordings__')
const T0 = '2026-10-02T14:00:00.000Z'
const MIN = 60_000
const HOUR = 60 * MIN

type Json = Record<string, unknown>
const readJson = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8')) as Json
const job = (name: string): Json => readJson(path.join(RUNNER_DIR, '__fixtures__', 'jobs.json'))[name] as Json
const recording = (name: string): { output: Json; stamp: Json } =>
  readJson(path.join(RECORDINGS_DIR, `${name}.json`)) as { output: Json; stamp: Json }
const GOOD = recording('finding-c01-good')

const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v !== null && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Json)[k])]))
      : v
const inputHash = (inputs: unknown): string => crypto.createHash('sha256').update(JSON.stringify(canonical(inputs)), 'utf8').digest('hex')

function mutableClock(iso: string): Clock & { advance(ms: number): void } {
  let t = new Date(iso).getTime()
  return { now: () => new Date(t), advance: (ms) => { t += ms } }
}

let tmp: string
let exchange: string
let approvedPath: string
let stops: (() => void)[]

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-db-'))
  exchange = path.join(tmp, 'exchange')
  fs.mkdirSync(exchange)
  approvedPath = path.join(tmp, 'approved.json')
  const j = job('good')
  fs.writeFileSync(approvedPath, JSON.stringify({ triples: [{ stepType: j['stepType'], promptVersion: j['promptVersion'], modelId: j['modelId'] }] }))
  stops = []
})

afterEach(() => {
  for (const stop of stops) stop()
  fs.rmSync(tmp, { recursive: true, force: true })
})

const filesIn = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [])

function writeOutbox(name: string, content: string): void {
  const outbox = path.join(exchange, 'outbox')
  fs.mkdirSync(outbox, { recursive: true })
  const staging = path.join(exchange, `.staging-${name}`)
  fs.writeFileSync(staging, content)
  fs.renameSync(staging, path.join(outbox, name))
}

const result = (jobId: string, output: unknown, stamp: unknown): string => JSON.stringify({ jobId, output, stamp })

/** The fake Claude project: calls `respond` once per new inbox file. */
function fakeProject(respond: (jobId: string, inboxJson: Json) => void | Promise<void>): { seen: string[] } {
  const inbox = path.join(exchange, 'inbox')
  const seen: string[] = []
  let busy = false
  const timer = setInterval(() => {
    if (busy) return
    busy = true
    void (async () => {
      try {
        for (const file of filesIn(inbox)) {
          if (seen.includes(file)) continue
          let json: Json
          try {
            json = JSON.parse(fs.readFileSync(path.join(inbox, file), 'utf8')) as Json
          } catch {
            continue
          }
          seen.push(file)
          await respond(String(json['jobId']), json)
        }
      } finally {
        busy = false
      }
    })()
  }, 5)
  stops.push(() => { clearInterval(timer) })
  return { seen }
}

async function waitFor(check: () => boolean, label: string, ms = 4000): Promise<void> {
  const until = Date.now() + ms
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 5))
  }
}

interface Row {
  id: string
  status: string
  attempts: number
  result: { output?: unknown; stamp?: unknown } | null
  last_error: string | null
}

async function row(db: PGlite, id: string): Promise<Row> {
  const r = await db.query<Row>('select id, status, attempts, result, last_error from returns.jobs where id = $1', [id])
  const found = r.rows[0]
  if (!found) throw new Error(`no job ${id}`)
  return found
}

async function world(sink?: (line: string) => void) {
  const db = await cloneTestDb()
  const clock = mutableClock(T0)
  const queue = createJobQueue(db, clock)
  // Round 5: the runner reads the same pinned clock as the queue, so the wait's deadline (ctx.now + lease - 10 min) is on it.
  const options = { recordingsDir: RECORDINGS_DIR, approvedPath, env: { AI_EXCHANGE_DIR: exchange }, pollMs: 5, now: () => clock.now(), ...(sink ? { sink } : {}) }
  const ai = createAiRunner(options)
  expect(ai.useEngine('project')).toEqual({ ok: true })
  const handler = createAiStepHandler('finding', ai)
  const runner = createRunner({ queue, handlers: { [handler.kind]: handler }, clock, workerId: 'worker (Test)' })
  return { db, clock, queue, handler, runner }
}

describe('ARC-22 a project job runs through the jobs queue', () => {
  test('ARC-22 the job stays running until the outbox file appears, writes exactly one inbox file, then ends done with F04-valid output', async () => {
    const { db, queue, runner } = await world()
    const queued = await queue.enqueue('ai:finding', 'ai-finding-c01-1', job('good'))
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    fakeProject(async (jobId) => {
      await gate
      writeOutbox(`${jobId}.json`, result(jobId, GOOD.output, GOOD.stamp))
    })
    const running = runner.runOnce()
    await waitFor(() => filesIn(path.join(exchange, 'inbox')).length > 0, 'the inbox file')
    expect(filesIn(path.join(exchange, 'inbox'))).toEqual([`${queued.id}.json`])
    expect((await row(db, queued.id)).status).toBe('running')
    const inboxJson = readJson(path.join(exchange, 'inbox', `${queued.id}.json`))
    expect(inboxJson['jobId']).toBe(queued.id)
    expect(inboxJson['inputHash']).toBe(inputHash(job('good')['inputs']))
    release()
    expect(await running).toBe(true)
    const done = await row(db, queued.id)
    expect(done.status).toBe('done')
    expect(done.result?.output).toEqual(GOOD.output)
    expect(done.result?.stamp).toEqual(GOOD.stamp)
    expect(validateAiOutput('finding', done.result?.output, done.result?.stamp).ok).toBe(true)
  })

  test('ARC-22 an outbox file for an unknown job id, and a second file for a job already done, are ignored and logged by file name only', async () => {
    const lines: string[] = []
    const { db, queue, runner } = await world((l) => { lines.push(l) })
    const canary = 'PLANTED-CANARY-SECOND (Test)'
    const stranger = 'job-nobody-is-waiting-on-test.json'
    const a = await queue.enqueue('ai:finding', 'ai-finding-c01-a', job('good'))
    const bJob = job('good')
    bJob['inputs'] = { ...(bJob['inputs'] as Json), variant: 'second job (Test)' }
    const bStamp = { ...GOOD.stamp, inputHash: inputHash(bJob['inputs']) }
    const b = await queue.enqueue('ai:finding', 'ai-finding-c01-b', bJob)
    fakeProject(async (jobId) => {
      if (jobId === a.id) {
        writeOutbox(stranger, result('job-nobody-is-waiting-on-test', { ...GOOD.output, summary: canary }, GOOD.stamp))
        await waitFor(() => lines.some((l) => l.includes(stranger)), 'the unknown outbox file to be logged')
        writeOutbox(`${a.id}.json`, result(a.id, GOOD.output, GOOD.stamp))
      } else {
        // A has finished: a second result for A arrives while B waits
        writeOutbox(`${a.id}.json`, result(a.id, { ...GOOD.output, summary: canary }, GOOD.stamp))
        await waitFor(() => lines.some((l) => l.includes(`${a.id}.json`)), 'the second file for the done job to be logged')
        writeOutbox(`${jobId}.json`, result(jobId, GOOD.output, bStamp))
      }
    })
    expect(await runner.runOnce()).toBe(true)
    expect((await row(db, a.id)).status).toBe('done')
    expect(await runner.runOnce()).toBe(true)
    const doneA = await row(db, a.id)
    const doneB = await row(db, b.id)
    expect(doneB.status).toBe('done')
    expect(doneA.status).toBe('done')
    expect(doneA.result?.output).toEqual(GOOD.output)
    expect(lines.join('\n')).not.toContain(canary)
    expect(lines.join('\n')).not.toContain(exchange)
    const rows = await db.query<{ n: number }>('select count(*)::int as n from returns.jobs')
    expect(rows.rows[0]?.n).toBe(2)
  })

  test('ARC-22 AI-1 an outbox result that fails F04 leaves the job failed with the problems and stores no output', async () => {
    const { db, queue, runner } = await world()
    const queued = await queue.enqueue('ai:finding', 'ai-finding-c01-bad', job('good'))
    fakeProject((jobId) => {
      writeOutbox(`${jobId}.json`, result(jobId, { ...GOOD.output, citations: [] }, GOOD.stamp))
    })
    expect(await runner.runOnce()).toBe(true)
    const r = await row(db, queued.id)
    expect(r.status).not.toBe('done')
    expect(r.result).toBeNull()
    expect(r.last_error).toMatch(/citations/)
  })
})

describe('ARC-22 ARC-5 a result that arrives after the 24-hour lease ran out', () => {
  async function expiredLease() {
    const w = await world()
    const queued = await w.queue.enqueue('ai:finding', 'ai-finding-c01-late', job('good'))
    // a worker claims the job and dies before any result (the lease is the handler's 24 hours)
    const claimed = await w.queue.claim('worker that died (Test)', ['ai:finding'], (k) => (k === w.handler.kind ? w.handler.leaseMs : undefined))
    expect(claimed?.id).toBe(queued.id)
    w.clock.advance(23 * HOUR + 59 * MIN)
    expect(await w.runner.runOnce()).toBe(false)
    w.clock.advance(2 * MIN)
    return { ...w, queued }
  }

  test('ARC-22 a late result whose input hash matches the job is accepted: the job ends done, its attempt count kept', async () => {
    const { db, runner, queued } = await expiredLease()
    writeOutbox(`${queued.id}.json`, result(queued.id, GOOD.output, GOOD.stamp))
    expect(await runner.runOnce()).toBe(true)
    const r = await row(db, queued.id)
    expect(r.status).toBe('done')
    expect(r.attempts).toBe(2)
    expect(r.result?.output).toEqual(GOOD.output)
  })

  // Round 5 (reports/A04-findings-5.md fix 7): the wait ends at the lease minus 10 minutes, so a re-claim never starts a
  // second poller beside one still running; the result that comes later is taken at once by the retry.
  test('ARC-22 ARC-5 no result by lease minus 10 minutes: the attempt fails with the deadline reason, the inbox file stays, and the retry takes the result at once', async () => {
    const { db, clock, queue, runner } = await world()
    const queued = await queue.enqueue('ai:finding', 'ai-finding-c01-deadline', job('good'))
    const state = { ended: false }
    const running = runner.runOnce()
    running.then(
      () => { state.ended = true },
      () => { state.ended = true },
    )
    await waitFor(() => filesIn(path.join(exchange, 'inbox')).length > 0, 'the inbox file')
    expect((await row(db, queued.id)).status).toBe('running')
    clock.advance(24 * HOUR - 10 * MIN)
    await waitFor(() => state.ended, 'the attempt to end at the deadline', 2000)
    expect(await running).toBe(true)
    const failed = await row(db, queued.id)
    expect(failed.status).toBe('queued')
    expect(failed.result).toBeNull()
    expect(failed.last_error).toContain('no result from the Claude project before the lease ends (ARC-22)')
    expect(filesIn(path.join(exchange, 'inbox'))).toEqual([`${queued.id}.json`])
    writeOutbox(`${queued.id}.json`, result(queued.id, GOOD.output, GOOD.stamp))
    clock.advance(HOUR)
    expect(await runner.runOnce()).toBe(true)
    const done = await row(db, queued.id)
    expect(done.status).toBe('done')
    expect(done.attempts).toBe(2)
    expect(done.result?.output).toEqual(GOOD.output)
  })

  test('ARC-22 a late result whose input hash does not match the job is refused with the reason and not stored', async () => {
    const { db, runner, queued } = await expiredLease()
    writeOutbox(`${queued.id}.json`, result(queued.id, GOOD.output, { ...GOOD.stamp, inputHash: 'f'.repeat(64) }))
    expect(await runner.runOnce()).toBe(true)
    const r = await row(db, queued.id)
    expect(r.status).not.toBe('done')
    expect(r.result).toBeNull()
    expect(r.last_error).toMatch(/input ?hash/i)
  })
})
