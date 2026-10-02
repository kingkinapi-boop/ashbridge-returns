// A08 acceptance test, check 11: A04's runner with the `project` engine and A08's run-once launcher, together on
// one temp exchange folder, through F06's real queue and runner (spec-writer; builders never edit this file).
// It sits in src/pipeline, the composition root (F10), as A04's queue tests do (ARC-7). The launcher's API is
// written out at the top of src/modules/ai/project/project.acceptance.test.ts. No real `claude`: the launcher
// runs the fake program from src/modules/ai/project/__fixtures__/fake-claude.mjs (installed in a temp folder).
import fs from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, test } from 'vitest'
import { validateAiOutput } from '../contracts/ai'
import type { Clock } from '../core/clock'
import { cloneTestDb } from '../core/db'
import { createAiRunner, createAiStepHandler } from '../modules/ai/index'
import { runAiProjectOnce } from '../modules/ai/project/index'
import { createJobQueue, createRunner } from '../modules/jobs/index'
import {
  VALID_OUTPUT,
  inboxJob,
  makeWorld,
  type FixtureName,
  type Json,
  type World,
} from '../modules/ai/project/__fixtures__/harness'

const T0 = '2026-10-02T14:00:00.000Z'
const SLOW = { timeout: 60_000 }

function fixedClock(iso: string): Clock {
  const t = new Date(iso).getTime()
  return { now: () => new Date(t) }
}

/** An A04 AI job (what F06 queues) from an A08 inbox fixture: the inbox file minus what the runner adds. */
function aiJob(name: FixtureName): Json {
  const j = inboxJob(name)
  delete j['jobId']
  delete j['schema']
  delete j['inputHash']
  return j
}

interface Row {
  id: string
  status: string
  result: { output?: unknown; stamp?: unknown } | null
  last_error: string | null
}

async function row(db: PGlite, id: string): Promise<Row> {
  const r = await db.query<Row>('select id, status, result, last_error from returns.jobs where id = $1', [id])
  const found = r.rows[0]
  if (!found) throw new Error(`no job ${id}`)
  return found
}

const filesIn = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [])

async function waitFor(check: () => boolean, label: string, ms = 10_000): Promise<void> {
  const until = Date.now() + ms
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 5))
  }
}

let worlds: World[] = []
afterEach(() => {
  for (const w of worlds) w.cleanup()
  worlds = []
})

async function setup() {
  const w = makeWorld([])
  worlds.push(w)
  const lines: string[] = []
  const db = await cloneTestDb()
  const clock = fixedClock(T0)
  const queue = createJobQueue(db, clock)
  const ai = createAiRunner({
    recordingsDir: path.join(w.root, 'no-recordings'),
    approvedPath: w.approvedPath,
    env: { AI_EXCHANGE_DIR: w.exchange },
    pollMs: 5,
    sink: (l) => { lines.push(l) },
  })
  expect(ai.useEngine('project')).toEqual({ ok: true })
  const handler = createAiStepHandler('finding', ai)
  const runner = createRunner({ queue, handlers: { [handler.kind]: handler }, clock, workerId: 'worker (Test)' })
  const launch = () =>
    runAiProjectOnce({ env: w.env, approvedPath: w.approvedPath, sink: (l: string) => { lines.push(l) } })
  return { w, db, queue, runner, launch, lines }
}

describe('ARC-22 A04 runner and the A08 launcher together on one exchange folder', SLOW, () => {
  test('ARC-22 AI-10 the clean job ends done in Returns with F04-valid output that the launcher answered', async () => {
    const { w, db, queue, runner, launch } = await setup()
    const queued = await queue.enqueue('ai:finding', 'ai-finding-c01-a08-clean', aiJob('c01-clean'))
    const running = runner.runOnce()
    await waitFor(() => filesIn(w.inbox).length > 0, 'the inbox file')
    expect(filesIn(w.inbox)).toEqual([`${queued.id}.json`])
    expect((await row(db, queued.id)).status).toBe('running')
    expect(await launch()).toEqual({ ok: true })
    expect(await running).toBe(true)
    const done = await row(db, queued.id)
    expect(done.status).toBe('done')
    expect(done.result?.output).toEqual(VALID_OUTPUT)
    const stamp = done.result?.stamp as Json
    expect(stamp['modelId']).toBe('claude-opus-5-5')
    expect(stamp['promptVersion']).toBe(inboxJob('c01-clean')['promptVersion'])
    expect(stamp['inputHash']).toBe(inboxJob('c01-clean')['inputHash'])
    expect(validateAiOutput('finding', done.result?.output, done.result?.stamp).ok).toBe(true)
    expect(w.calls()).toHaveLength(1)
  })

  test('ARC-22 AI-9 the unredacted job ends failed with "inputs not redacted": no inbox file, no CLI call, no answer', async () => {
    const { w, db, queue, runner, launch } = await setup()
    const queued = await queue.enqueue('ai:finding', 'ai-finding-c01-a08-unredacted', aiJob('c01-unredacted'))
    expect(await runner.runOnce()).toBe(true)
    expect(await launch()).toEqual({ ok: true })
    const r = await row(db, queued.id)
    expect(r.status).not.toBe('done')
    expect(r.result).toBeNull()
    expect(r.last_error).toMatch(/inputs not redacted/)
    expect(filesIn(w.inbox)).toEqual([])
    expect(filesIn(w.outbox)).toEqual([])
    expect(w.calls()).toEqual([])
  })
})
