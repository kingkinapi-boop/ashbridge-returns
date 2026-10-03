// A04 acceptance tests: the AI runner (spec-writer; builders never edit this file).
// The job-queue behaviour (checks 5, 6 and 11 through F06's real queue) is in
// src/pipeline/ai-exchange.acceptance.db.test.ts, because a module may not import another module (ARC-7).
//
// The shape these tests fix (the builder matches it; extra exports are fine):
// `src/modules/ai/index.ts` exports
//   createAiRunner(options): AiRunner
//     options: { recordingsDir: string; approvedPath?: string (default data/ai/approved.json at the repo root);
//                env?: Record<string, string | undefined> (default process.env; settings read by name, values never
//                printed); sink?: (line: string) => void (one log line per call, plus one line for each flagged file:
//                a malformed recording or a non-result outbox file, once per name and content); pollMs?: number (outbox poll) }
//   AiRunner: {
//     engine(): 'recorded' | 'project'                 'recorded' until switched
//     useEngine(name: string): { ok: true } | { ok: false; reason: string }
//     runAiStep(job: AiJob, ctx?: { jobId?: string }): Promise<AiStepResult>   (the project engine needs ctx.jobId)
//     refusals(stepType: string): number               per-step count of refused outputs
//   }
//   AiJob: { stepType, promptVersion, promptHash, modelId, inputs (redacted, JSON), redaction?: { redactedBy,
//            redactorVersion }, isTest (the return's is_test), ocrEngine, ocrEngineVersion, mappingRelease }
//   AiStepResult: { ok: true; output; stamp (F04's VersionStamp) } | { ok: false; reason: string; problems: string[] }
//   aiEngines: { recorded: { run(...) }, project: { run(...) } }   the runner calls aiEngines[name].run at call time
//   createAiStepHandler(stepType, runner): Handler (src/contracts/jobs.ts), kind `ai:<stepType>`, leaseMs 24 hours,
//     run(input, ctx) = runAiStep(input, { jobId: ctx.jobId }); a result is { output, stamp }; a refusal throws an
//     Error whose message holds the reason and the problems.
//   AI_JOB_LEASE_MS (24 hours), AI_SETTING_NAMES (every setting name the runner reads),
//   inputHashOf(inputs): sha256 hex of the canonical JSON (keys sorted at every depth, no whitespace),
//   InboxFileSchema and ApprovedListSchema (zod, strict at every depth).
// Recordings: every *.json in recordingsDir is one recording { modelId, promptHash, inputHash, output, stamp },
//   matched on the three key parts; the stamp is F04's VersionStamp as recorded.
// Approved list: { "triples": [ { stepType, promptVersion, modelId } ] }.
// Exchange (ARC-22), under AI_EXCHANGE_DIR: the runner writes inbox/<jobId>.json = { jobId, stepType, promptVersion,
//   promptHash, modelId, inputHash, schema (z.toJSONSchema(aiStepSchemas[stepType]), default options), redaction,
//   isTest, ocrEngine, ocrEngineVersion, mappingRelease, inputs }, then waits for outbox/<jobId>.json =
//   { jobId, output, stamp }. A file named for no job it is waiting on is ignored and logged by file name only.
//   Round 5 (exchange.acceptance.test.ts header): the job id grammar, the deadline, the refusal file, and an own file
//   that is neither a result nor a refusal failing the step at once.
// Amber choices are listed in reports/A04-spec.md.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { aiStepSchemas, validateAiOutput, versionStampSchema, type VersionStamp } from '../../../contracts/ai'
import { readSettings } from '../../../core/env'
import { readOwnSource } from '../../../core/testing/read-own-source'
import {
  AI_JOB_LEASE_MS,
  AI_SETTING_NAMES,
  ApprovedListSchema,
  InboxFileSchema,
  aiEngines,
  createAiRunner,
  createAiStepHandler,
  inputHashOf,
} from '../index'
import {
  RECORDINGS_DIR,
  REPO_ROOT,
  canonical,
  collectLines,
  expectedInputHash,
  filesIn,
  job,
  outboxResult,
  recording,
  sha256,
  startFakeProject,
  tempDir,
  tripleOf,
  waitFor,
  writeApproved,
  writeOutbox,
} from './__fixtures__/harness'
import * as runnerTs from './runner'

const NOT_REDACTED = /inputs not redacted/
const DECISION_0008 = 'AI runs only through the Claude project (decision 0008)'
const JOB_ID = 'job-c01-finding-test'
const NEEDS_JOB_ID = 'the project engine needs a job id (the inbox file is named by it)'
const LIST_UNREADABLE = 'not approved: the approved list cannot be read (AI-11)'
const ALL_JOBS = ['good', 'broken', 'strayKey', 'noModelId', 'noPromptHash', 'noInputHash', 'injected'] as const

let tmp: { dir: string; cleanup: () => void }
let exchange: string
let approvedPath: string
let stops: (() => void)[]

beforeEach(() => {
  tmp = tempDir('runner')
  exchange = path.join(tmp.dir, 'exchange-canary-value')
  fs.mkdirSync(exchange)
  approvedPath = writeApproved(tmp.dir, ALL_JOBS.map((n) => tripleOf(job(n))))
  stops = []
})

afterEach(() => {
  for (const stop of stops) stop()
  vi.useRealTimers() // a failed fake-timer test never leaves its timers to the next test
  vi.restoreAllMocks()
  tmp.cleanup()
})

/** Under fake timers: the step's result once it settles within one poll; a step still waiting fails here by name. */
async function withinOnePoll<T>(step: Promise<T>): Promise<T> {
  const state = { done: false }
  step.then(
    () => { state.done = true },
    () => { state.done = true },
  )
  await vi.advanceTimersByTimeAsync(5)
  if (!state.done) throw new Error('the step is still waiting after one poll')
  return step
}

type RunnerOptions = Parameters<typeof createAiRunner>[0]

function runner(extra: Partial<RunnerOptions> = {}) {
  return createAiRunner({ recordingsDir: RECORDINGS_DIR, approvedPath, env: {}, pollMs: 5, ...extra })
}

/** A runner switched to the project engine against the temp exchange folder. */
function projectRunner(extra: Partial<RunnerOptions> = {}) {
  const r = runner({ env: { AI_EXCHANGE_DIR: exchange }, ...extra })
  const switched = r.useEngine('project')
  expect(switched).toEqual({ ok: true })
  return r
}

function fakeProject(respond: Parameters<typeof startFakeProject>[1]) {
  const fake = startFakeProject(exchange, respond)
  stops.push(fake.stop)
  return fake
}

/** The fake answers every inbox file with the good recorded answer for that job. */
function answeringProject(output: unknown = recording('finding-c01-good').output) {
  return fakeProject(({ json }) => {
    const id = String(json['jobId'])
    writeOutbox(exchange, `${id}.json`, outboxResult(id, output, recording('finding-c01-good').stamp))
  })
}

const allText = (r: { ok: boolean; reason?: string; problems?: string[] }): string =>
  [r.reason ?? '', ...(r.problems ?? [])].join('\n')

const inbox = (): string[] => filesIn(path.join(exchange, 'inbox'))

// ---------- AI-1: checked output and refusals ----------

describe('AI-1 every output is checked with F04 before anything uses it', () => {
  test('AI-1 the recorded answer for the fixture job comes back F04-valid with its stamp', async () => {
    const r = runner()
    const res = await r.runAiStep(job('good'))
    const rec = recording('finding-c01-good')
    expect(res).toMatchObject({ ok: true, output: rec.output, stamp: rec.stamp })
    if (!res.ok) throw new Error('expected ok')
    expect(validateAiOutput('finding', res.output, res.stamp).ok).toBe(true)
    expect(r.refusals('finding')).toBe(0)
  })

  test('AI-1 a recorded answer that breaks F04 (no citations) is refused with F04 problem list and the step refusal count goes up by one', async () => {
    const r = runner()
    const rec = recording('finding-c01-broken')
    const f04 = validateAiOutput('finding', rec.output, rec.stamp)
    if (f04.ok) throw new Error('fixture must break F04')
    expect(r.refusals('finding')).toBe(0)
    const res = await r.runAiStep(job('broken'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.problems).toEqual(expect.arrayContaining(f04.problems))
    expect(res.problems.join(' ')).toMatch(/citations/)
    expect(r.refusals('finding')).toBe(1)
    expect(r.refusals('extraction')).toBe(0)
  })

  test('AI-1 a recorded answer with a stray key is refused like any F04 failure and counted (Lead note RC2)', async () => {
    const r = runner()
    const rec = recording('finding-c01-stray-key')
    const f04 = validateAiOutput('finding', rec.output, rec.stamp)
    if (f04.ok) throw new Error('fixture must break F04')
    const res = await r.runAiStep(job('strayKey'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.problems).toEqual(expect.arrayContaining(f04.problems))
    expect(r.refusals('finding')).toBe(1)
    // a good answer after it does not reset or raise the count
    expect((await r.runAiStep(job('good'))).ok).toBe(true)
    expect(r.refusals('finding')).toBe(1)
  })
})

// ---------- AI-10: the stamp ----------

describe('AI-10 an output with an incomplete stamp is refused, naming the missing part', () => {
  const cases = [
    ['noModelId', /model ?id/i],
    ['noPromptHash', /prompt ?hash/i],
    ['noInputHash', /input ?hash/i],
  ] as const
  for (const [name, part] of cases) {
    test(`AI-10 a stamp without ${String(part)} is refused and names it`, async () => {
      const res = await runner().runAiStep(job(name))
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(allText(res)).toMatch(part)
    })
  }

  test('AI-10 a good result stamp carries the exact model id, prompt version and hash, input hash, OCR engine and version and mapping release', async () => {
    const j = job('good')
    const res = await runner().runAiStep(j)
    if (!res.ok) throw new Error(`expected ok: ${allText(res)}`)
    expect(res.stamp).toEqual({
      modelId: j.modelId,
      promptVersion: j.promptVersion,
      promptHash: j.promptHash,
      inputHash: expectedInputHash(j.inputs),
      ocrEngine: j.ocrEngine,
      ocrEngineVersion: j.ocrEngineVersion,
      mappingRelease: j.mappingRelease,
    })
  })

  test('AI-10 inputHashOf is the sha256 hex of the canonical JSON, the same whatever the key order', () => {
    const j = job('good')
    expect(inputHashOf(j.inputs)).toBe(expectedInputHash(j.inputs))
    const reordered = Object.fromEntries(Object.entries(j.inputs).reverse())
    expect(inputHashOf(reordered)).toBe(expectedInputHash(j.inputs))
    expect(inputHashOf({ ...j.inputs, entity: 'Other Co (Test)' })).not.toBe(expectedInputHash(j.inputs))
  })
})

// ---------- AI-9: redaction stamp before any engine ----------

describe('AI-9 a job without a redaction stamp is refused before any engine runs', () => {
  const unstamped = () => {
    const j = job('good')
    delete j.redaction
    return j
  }

  test('AI-9 no redaction stamp: refused with "inputs not redacted" and neither engine is called (recorded engine on)', async () => {
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const proj = vi.spyOn(aiEngines.project, 'run')
    const r = runner()
    const res = await r.runAiStep(unstamped())
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toMatch(NOT_REDACTED)
    expect(rec).not.toHaveBeenCalled()
    expect(proj).not.toHaveBeenCalled()
  })

  test('AI-9 no redaction stamp: refused with "inputs not redacted", neither engine is called and no inbox file is written (project engine on)', async () => {
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const proj = vi.spyOn(aiEngines.project, 'run')
    const r = projectRunner()
    const res = await r.runAiStep(unstamped(), { jobId: JOB_ID })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toMatch(NOT_REDACTED)
    expect(rec).not.toHaveBeenCalled()
    expect(proj).not.toHaveBeenCalled()
    expect(inbox()).toEqual([])
  })

  test('AI-9 a redaction stamp with a blank part (who or version) is refused the same way', async () => {
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const blankWho = job('good')
    blankWho.redaction = { redactedBy: ' ', redactorVersion: '0.0.0-test' }
    const blankVersion = job('good')
    blankVersion.redaction = { redactedBy: 'redactor stand-in (Test)', redactorVersion: '' }
    for (const j of [blankWho, blankVersion]) {
      const res = await runner().runAiStep(j)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toMatch(NOT_REDACTED)
    }
    expect(rec).not.toHaveBeenCalled()
  })

  test('AI-9 the spies see the recorded engine when the job is stamped (the spies are live)', async () => {
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const res = await runner().runAiStep(job('good'))
    expect(res.ok).toBe(true)
    expect(rec).toHaveBeenCalledTimes(1)
  })
})

// ---------- ARC-16: recorded answers never pass silently ----------

describe('ARC-16 a changed key fails with "re-record" and the three key parts', () => {
  test('ARC-16 a changed input hash fails with re-record, the model id, the prompt hash and the new input hash; the project engine is not called', async () => {
    const proj = vi.spyOn(aiEngines.project, 'run')
    const j = job('good')
    j.inputs = { ...j.inputs, entity: 'Maple Ridge Consulting Inc. renamed (Test)' }
    const res = await runner().runAiStep(j)
    expect(res.ok).toBe(false)
    if (res.ok) return
    const text = allText(res)
    expect(text).toMatch(/re-record/)
    expect(text).toContain(j.modelId)
    expect(text).toContain(j.promptHash)
    expect(text).toContain(expectedInputHash(j.inputs))
    expect(proj).not.toHaveBeenCalled()
    expect(inbox()).toEqual([])
  })

  test('ARC-16 a changed prompt hash fails with re-record and the three key parts; the project engine is not called', async () => {
    const proj = vi.spyOn(aiEngines.project, 'run')
    const j = job('good')
    j.promptHash = 'e'.repeat(64)
    const res = await runner().runAiStep(j)
    expect(res.ok).toBe(false)
    if (res.ok) return
    const text = allText(res)
    expect(text).toMatch(/re-record/)
    expect(text).toContain(j.modelId)
    expect(text).toContain('e'.repeat(64))
    expect(text).toContain(expectedInputHash(j.inputs))
    expect(proj).not.toHaveBeenCalled()
  })

  test('ARC-16 a changed model id fails with re-record (the model id is part of the key)', async () => {
    const j = job('good')
    j.modelId = 'claude-other-model-test'
    const res = await runner({ approvedPath: writeApproved(tmp.dir, [tripleOf(j)], 'approved-other.json') }).runAiStep(j)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(allText(res)).toMatch(/re-record[\s\S]*claude-other-model-test|claude-other-model-test[\s\S]*re-record/)
  })
})

// ---------- ARC-22: the exchange folder (the format; the job states are in the db test) ----------

describe('ARC-22 the project engine writes one inbox file in the fixed format and reads back the result', () => {
  test('ARC-22 a project job writes exactly one inbox file, equal to the golden file, and returns the F04-valid result', async () => {
    const fake = answeringProject()
    const r = projectRunner()
    const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(fake.seen).toHaveLength(1)
    const seen = fake.seen[0]
    if (!seen) throw new Error('no inbox file seen')
    expect(seen.file).toBe(`${JOB_ID}.json`)
    expect(seen.inboxCount).toBe(1)
    expect(seen.text.charCodeAt(0)).not.toBe(0xfeff)
    await expect(JSON.stringify(canonical(seen.json), null, 2) + '\n').toMatchFileSnapshot('./__golden__/inbox-finding-c01.json')
    expect(res).toMatchObject({ ok: true, output: recording('finding-c01-good').output })
    if (res.ok) expect(validateAiOutput('finding', res.output, res.stamp).ok).toBe(true)
  })

  test('ARC-22 the inbox file carries the JSON Schema from z.toJSONSchema, the redaction stamp, is_test and the stamp parts the launcher copies', async () => {
    const fake = answeringProject()
    const j = job('good')
    await projectRunner().runAiStep(j, { jobId: JOB_ID })
    const seen = fake.seen[0]?.json
    expect(seen).toBeDefined()
    expect(seen?.['schema']).toEqual(z.toJSONSchema(aiStepSchemas.finding))
    expect(seen?.['redaction']).toEqual(j.redaction)
    expect(seen?.['isTest']).toBe(true)
    expect(seen?.['inputs']).toEqual(j.inputs)
    expect(seen?.['inputHash']).toBe(expectedInputHash(j.inputs))
    expect(InboxFileSchema.safeParse(seen).success).toBe(true)
  })

  test('ARC-22 the inbox schema is strict at runtime: a stray key at the top or inside the redaction stamp fails (SC R23)', async () => {
    const fake = answeringProject()
    await projectRunner().runAiStep(job('good'), { jobId: JOB_ID })
    const seen = fake.seen[0]?.json ?? {}
    expect(InboxFileSchema.safeParse({ ...seen, extra: 'x' }).success).toBe(false)
    const redaction = seen['redaction'] as Record<string, unknown>
    expect(InboxFileSchema.safeParse({ ...seen, redaction: { ...redaction, extra: 'x' } }).success).toBe(false)
  })

  // Round 5 (reports/A04-findings-5.md, RC2): restated. The own file that is not one JSON result no longer leaves the
  // job waiting until the lease ends: it fails the step at once, naming the file and the cause, never the content.
  test('ARC-22 an own outbox file that is not JSON fails the step at once, naming the file, never its content', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const canary = 'PLANTED-CANARY-CONTENT (Test)'
      writeOutbox(exchange, `${JOB_ID}.json`, `not json ${canary}`)
      const r = projectRunner({ sink })
      const res = await withinOnePoll(r.runAiStep(job('good'), { jobId: JOB_ID }))
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.reason).toContain(`${JOB_ID}.json`)
      expect(res.reason).toContain('not JSON')
      expect(res.reason).toMatch(/\bARC-22\b/)
      expect(res.problems).toEqual([])
      expect(r.refusals('finding')).toBe(0)
      expect(allText(res) + lines.join('\n')).not.toContain(canary)
      expect(allText(res) + lines.join('\n')).not.toContain(exchange)
    } finally {
      vi.useRealTimers()
    }
  })

  test('ARC-22 an own outbox file holding JSON that is not one result (an array) fails the step at once, naming the file, never its content', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const canary = 'PLANTED-CANARY-ARRAY (Test)'
      writeOutbox(exchange, `${JOB_ID}.json`, JSON.stringify([canary, canary]))
      const r = projectRunner({ sink })
      const res = await withinOnePoll(r.runAiStep(job('good'), { jobId: JOB_ID }))
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.reason).toContain(`${JOB_ID}.json`)
      expect(res.reason).toContain('not one result or refusal')
      expect(res.reason).toMatch(/\bARC-22\b/)
      expect(res.problems).toEqual([])
      expect(r.refusals('finding')).toBe(0)
      expect(allText(res) + lines.join('\n')).not.toContain(canary)
      expect(allText(res) + lines.join('\n')).not.toContain(exchange)
    } finally {
      vi.useRealTimers()
    }
  })

  test('ARC-22 an outbox file for an unknown job id is ignored and logged by file name only, never its content', async () => {
    const { lines, sink } = collectLines()
    const canary = 'PLANTED-CANARY-UNKNOWN (Test)'
    const stranger = 'job-nobody-is-waiting-on-test.json'
    fakeProject(async ({ json }) => {
      const id = String(json['jobId'])
      writeOutbox(exchange, stranger, outboxResult('job-nobody-is-waiting-on-test', { ...recording('finding-c01-good').output, summary: canary }, recording('finding-c01-good').stamp))
      await waitFor(() => lines.some((l) => l.includes(stranger)), 'the unknown outbox file to be logged')
      writeOutbox(exchange, `${id}.json`, outboxResult(id, recording('finding-c01-good').output, recording('finding-c01-good').stamp))
    })
    const res = await projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
    expect(res).toMatchObject({ ok: true, output: recording('finding-c01-good').output })
    expect(lines.join('\n')).not.toContain(canary)
  })

  test('ARC-22 AI-1 an outbox result that fails F04 is refused with the problems and counted, never returned as output', async () => {
    const bad = { ...recording('finding-c01-good').output, citations: [] }
    answeringProject(bad)
    const r = projectRunner()
    const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.problems.join(' ')).toMatch(/citations/)
    expect(r.refusals('finding')).toBe(1)
  })

  test('ARC-22 the project engine without a job id is refused and writes nothing', async () => {
    const res = await projectRunner().runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe(NEEDS_JOB_ID)
    expect(inbox()).toEqual([])
  })
})

// ---------- ARC-6, ARC-20, END-8: the engine switch ----------

describe('ARC-6 ARC-20 END-8 the project engine is off by default and the switch works both ways', () => {
  test('ARC-6 a new runner uses the recorded engine', () => {
    expect(runner().engine()).toBe('recorded')
    expect(runner({ env: { AI_EXCHANGE_DIR: exchange } }).engine()).toBe('recorded')
  })

  test('ARC-20 switching on the project engine without AI_EXCHANGE_DIR is refused, naming the setting; a blank setting too', () => {
    for (const env of [{}, { AI_EXCHANGE_DIR: '' }, { AI_EXCHANGE_DIR: '   ' }]) {
      const r = runner({ env })
      const res = r.useEngine('project')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toMatch(/AI_EXCHANGE_DIR/)
      expect(r.engine()).toBe('recorded')
    }
  })

  test('ARC-20 recorded to project to recorded: each side runs, and the setting value is never printed', async () => {
    const { lines, sink } = collectLines()
    const fake = answeringProject()
    const r = runner({ env: { AI_EXCHANGE_DIR: exchange }, sink })
    expect((await r.runAiStep(job('good'))).ok).toBe(true)
    expect(inbox()).toEqual([])

    const on = r.useEngine('project')
    expect(on).toEqual({ ok: true })
    expect(r.engine()).toBe('project')
    const viaProject = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(viaProject).toMatchObject({ ok: true, output: recording('finding-c01-good').output })
    expect(fake.seen).toHaveLength(1)

    const off = r.useEngine('recorded')
    expect(off).toEqual({ ok: true })
    expect(r.engine()).toBe('recorded')
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const proj = vi.spyOn(aiEngines.project, 'run')
    expect((await r.runAiStep(job('good'), { jobId: 'job-c01-after-switch-test' })).ok).toBe(true)
    expect(rec).toHaveBeenCalledTimes(1)
    expect(proj).not.toHaveBeenCalled()
    expect(fake.seen).toHaveLength(1)
    expect(lines.join('\n')).not.toContain(exchange)
  })

  for (const name of ['api', 'anthropic', 'API', 'openai']) {
    test(`END-8 asking for an engine named "${name}" is refused with the decision 0008 reason`, () => {
      const r = runner({ env: { AI_EXCHANGE_DIR: exchange } })
      const res = r.useEngine(name)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toContain(DECISION_0008)
      expect(r.engine()).toBe('recorded')
    })
  }

  test('ARC-20 a refused switch while the project engine is on leaves it on', () => {
    const r = projectRunner()
    expect(r.useEngine('api').ok).toBe(false)
    expect(r.engine()).toBe('project')
  })
})

// ---------- END-8: no vendor client, no key ----------

describe('END-8 no paid model API: no vendor client and no key setting', () => {
  const VENDOR = /^(@anthropic-ai\/|anthropic$|openai$|@openai\/|@google\/(generative-ai|genai)$|@google-cloud\/vertexai$|cohere|@mistralai\/|@ai-sdk\/|^ai$|langchain|@langchain\/|ollama|groq-sdk$|replicate$|together-ai$|@aws-sdk\/client-bedrock)/

  test('END-8 package.json has no Anthropic SDK or other model-vendor client', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>
    const names = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].flatMap((k) => Object.keys(pkg[k] ?? {}))
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((n) => VENDOR.test(n))).toEqual([])
  })

  test('END-8 the planted vendor names are caught by the check (the check is live)', () => {
    for (const n of ['@anthropic-ai/sdk', 'openai', '@ai-sdk/anthropic', 'langchain', '@langchain/anthropic']) expect(VENDOR.test(n)).toBe(true)
    expect(VENDOR.test('zod')).toBe(false)
  })

  test('END-8 every setting the runner reads is named, AI_EXCHANGE_DIR is one, and none holds a key (names only)', () => {
    expect(AI_SETTING_NAMES).toContain('AI_EXCHANGE_DIR')
    const keyish = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i
    expect(AI_SETTING_NAMES.filter((n: string) => keyish.test(n))).toEqual([])
  })

  test('END-8 the runner source imports no vendor client and names no key setting', () => {
    const dir = path.join(REPO_ROOT, 'src', 'modules', 'ai', 'runner')
    const files: string[] = []
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (!e.name.startsWith('__')) walk(path.join(d, e.name))
        } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(path.join(d, e.name))
      }
    }
    walk(dir)
    files.push(path.join(REPO_ROOT, 'src', 'modules', 'ai', 'index.ts'))
    expect(files.length).toBeGreaterThan(1)
    for (const f of files) {
      const text = readOwnSource(path.relative(process.cwd(), f))
      const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
      expect(imports.filter((i) => VENDOR.test(i)), f).toEqual([])
      expect(text, f).not.toMatch(/\b[A-Z][A-Z0-9_]*(API_KEY|_KEY|_TOKEN|_SECRET|_PASSWORD)\b/)
      expect(text, f).not.toMatch(/api\.anthropic\.com|api\.openai\.com/)
    }
  })

  test('END-8 a key-like setting in the environment changes nothing: the runner still uses recorded answers', async () => {
    const env = { AI_EXCHANGE_DIR: exchange, ANTHROPIC_API_KEY: 'sk-ant-planted-not-a-key-test', AI_ENGINE: 'api' }
    const { lines, sink } = collectLines()
    const r = runner({ env, sink })
    expect(r.engine()).toBe('recorded')
    expect((await r.runAiStep(job('good'))).ok).toBe(true)
    expect(lines.join('\n')).not.toContain('sk-ant-planted-not-a-key-test')
  })
})

// ---------- SEC-11: made-up returns only before go-live ----------

describe('SEC-11 before go-live the project engine runs only made-up returns', () => {
  test('SEC-11 a project job for a return with is_test = false is refused with the reason and no inbox file is written', async () => {
    const proj = vi.spyOn(aiEngines.project, 'run')
    const fake = answeringProject()
    const j = job('good')
    j.isTest = false
    const res = await projectRunner().runAiStep(j, { jobId: JOB_ID })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/SEC-11/)
    expect(inbox()).toEqual([])
    expect(fake.seen).toHaveLength(0)
    expect(proj).not.toHaveBeenCalled()
  })

  test('SEC-11 the same job with is_test = true runs (the refusal is about is_test alone)', async () => {
    answeringProject()
    const res = await projectRunner().runAiStep(job('good'), { jobId: JOB_ID })
    expect(res.ok).toBe(true)
  })
})

// ---------- AI-11: the approved list ----------

describe('AI-11 only approved (step type, prompt version, model id) triples run', () => {
  test('AI-11 the shipped data/ai/approved.json is a strict list with no triples, and the runner refuses the fixture job by default', async () => {
    const shipped = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'ai', 'approved.json'), 'utf8')) as unknown
    expect(ApprovedListSchema.parse(shipped)).toEqual({ triples: [] })
    const r = createAiRunner({ recordingsDir: RECORDINGS_DIR, env: {} })
    const res = await r.runAiStep(job('good'))
    // round 3: the default list is read (the shipped file, not a missing one), so the reason is the absent triple
    expect(res).toEqual({ ok: false, reason: 'not approved: run the evaluation set first (AI-11)', problems: [] })
  })

  test('AI-11 a triple not on the list is refused with "not approved"; adding it to a temp copy lets the same job run', async () => {
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const list = writeApproved(tmp.dir, [], 'approved-empty.json')
    const refused = await runner({ approvedPath: list }).runAiStep(job('good'))
    expect(refused.ok).toBe(false)
    if (!refused.ok) {
      expect(refused.reason).toMatch(/not approved/)
      expect(refused.reason).toMatch(/AI-11/)
    }
    expect(rec).not.toHaveBeenCalled()
    writeApproved(tmp.dir, [tripleOf(job('good'))], 'approved-empty.json')
    const ran = await runner({ approvedPath: list }).runAiStep(job('good'))
    expect(ran).toMatchObject({ ok: true, output: recording('finding-c01-good').output })
  })

  test('AI-11 a near-miss triple (other prompt version, other model, other step) does not approve the job', async () => {
    const j = tripleOf(job('good'))
    for (const near of [
      { ...j, promptVersion: 'finding-v2' },
      { ...j, modelId: 'claude-opus-5-5-other' },
      { ...j, stepType: 'extraction' },
    ]) {
      const list = writeApproved(tmp.dir, [near], 'approved-near.json')
      const res = await runner({ approvedPath: list }).runAiStep(job('good'))
      expect(res.ok, JSON.stringify(near)).toBe(false)
      if (!res.ok) expect(res.reason).toMatch(/not approved/)
    }
  })

  test('AI-11 the approved list is strict: a triple with a stray key is not read as approval (SC R23)', async () => {
    const list = writeApproved(tmp.dir, [{ ...tripleOf(job('good')), approvedBy: 'someone (Test)' }], 'approved-stray.json')
    const res = await runner({ approvedPath: list }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    expect(ApprovedListSchema.safeParse({ triples: [{ ...tripleOf(job('good')), approvedBy: 'x' }] }).success).toBe(false)
    expect(ApprovedListSchema.safeParse({ triples: [], note: 'x' }).success).toBe(false)
  })
})

// ---------- ARC-22: the handler F10 registers ----------

describe('ARC-22 the ai:<step> handler', () => {
  test('ARC-22 the handler is kind ai:finding with a 24-hour lease (Lead note 1 Oct)', () => {
    const h = createAiStepHandler('finding', runner())
    expect(h.kind).toBe('ai:finding')
    expect(AI_JOB_LEASE_MS).toBe(24 * 60 * 60 * 1000)
    expect(h.leaseMs).toBe(24 * 60 * 60 * 1000)
    expect(h.input.safeParse(job('good')).success).toBe(true)
  })

  test('ARC-22 the handler returns { output, stamp } for a good job and throws the reason for a refusal', async () => {
    const h = createAiStepHandler('finding', runner())
    const ctx = { jobId: JOB_ID, attempt: 1, now: new Date('2026-10-02T12:00:00Z'), returnId: null }
    const out = (await h.run(job('good'), ctx)) as { output: unknown; stamp: unknown }
    expect(out).toMatchObject({ output: recording('finding-c01-good').output, stamp: recording('finding-c01-good').stamp })
    expect(h.result.safeParse(out).success).toBe(true)
    const unstamped = job('good')
    delete unstamped.redaction
    await expect(Promise.resolve().then(() => h.run(unstamped, ctx))).rejects.toThrow(NOT_REDACTED)
  })

  test('ARC-7 the AI module does not import the jobs module (F00 boundary)', () => {
    const dir = path.join(REPO_ROOT, 'src', 'modules', 'ai')
    const sources: string[] = []
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.tsx?$/.test(e.name)) sources.push(p)
      }
    }
    walk(dir)
    expect(sources.length).toBeGreaterThan(1)
    for (const f of sources) expect(readOwnSource(path.relative(process.cwd(), f)), f).not.toMatch(/modules\/jobs|from ['"]\.\.\/\.\.\/jobs/)
  })
})

// ---------- Planted instructions (AI cards): no effect ----------

describe('AI-1 AI-9 a document with planted instructions has no effect', () => {
  test('AI-1 the planted note passes through the recorded engine as data: same engine, no refusal counted, no exchange file', async () => {
    const r = runner({ env: { AI_EXCHANGE_DIR: exchange } })
    const res = await r.runAiStep(job('injected'))
    expect(res).toMatchObject({ ok: true, output: recording('finding-c01-injected').output })
    if (res.ok) expect(res.stamp).toEqual(recording('finding-c01-injected').stamp)
    expect(r.engine()).toBe('recorded')
    expect(r.refusals('finding')).toBe(0)
    expect(filesIn(exchange)).toEqual([])
  })

  test('AI-1 through the project the planted note reaches the inbox as data only, and an answer that obeys it (adds "approved") is refused', async () => {
    const j = job('injected')
    const obeying = { ...recording('finding-c01-injected').output, approved: true }
    const fake = fakeProject(({ json }) => {
      const id = String(json['jobId'])
      writeOutbox(exchange, `${id}.json`, outboxResult(id, obeying, recording('finding-c01-injected').stamp))
    })
    const r = projectRunner()
    const res = await r.runAiStep(j, { jobId: JOB_ID })
    const seen = fake.seen[0]?.json
    expect(seen?.['inputs']).toEqual(j.inputs)
    expect(seen?.['modelId']).toBe(j.modelId)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.problems.join(' ')).toMatch(/approved/)
    expect(r.engine()).toBe('project')
    expect(filesIn(path.join(exchange, 'outbox')).some((n) => n.includes('approved'))).toBe(false)
  })
})

// ---------- Round 2 (reports/A04-findings.md, "Tests to add"): branches the first build added without a test ----------
// The settings come through src/core/env.ts (fix 2); the exchange folder is captured when the project engine is
// switched on, never re-read at run time; a missing or malformed approved list has its own reason (fix 5); the
// default log sink is the core logger (fix 4). Every behaviour the db test proves also has a unit twin here (RC2).

const LISTED_NOT_APPROVED = 'not approved: run the evaluation set first (AI-11)'
const GOOD_REC = (): ReturnType<typeof recording> => recording('finding-c01-good')

/** A recordings folder in the temp dir holding exactly the given recordings (one file each). */
function recordingsWith(label: string, recs: readonly object[]): string {
  const dir = path.join(tmp.dir, `recordings-${label}`)
  fs.mkdirSync(dir)
  recs.forEach((rec, i) => {
    fs.writeFileSync(path.join(dir, `rec-${String(i)}.json`), JSON.stringify(rec, null, 2) + '\n')
  })
  return dir
}

describe('AI-11 round 2: an approved list that cannot be read refuses with its own reason', () => {
  const cases: readonly (readonly [string, string | undefined])[] = [
    ['missing', undefined],
    ['malformed JSON', '{ "triples": [ '],
    ['the wrong shape', JSON.stringify({ triples: 'every triple (Test)' })],
  ]
  for (const [label, content] of cases) {
    test(`AI-11 an approved list that is ${label} is refused with "${LIST_UNREADABLE}" and neither engine is called`, async () => {
      const list = path.join(tmp.dir, `approved-${label.replace(/\W+/g, '-')}.json`)
      if (content !== undefined) fs.writeFileSync(list, content)
      const rec = vi.spyOn(aiEngines.recorded, 'run')
      const proj = vi.spyOn(aiEngines.project, 'run')
      const viaRecorded = await runner({ approvedPath: list }).runAiStep(job('good'))
      expect(viaRecorded).toEqual({ ok: false, reason: LIST_UNREADABLE, problems: [] })
      const viaProject = await projectRunner({ approvedPath: list }).runAiStep(job('good'), { jobId: JOB_ID })
      expect(viaProject).toEqual({ ok: false, reason: LIST_UNREADABLE, problems: [] })
      expect(rec).not.toHaveBeenCalled()
      expect(proj).not.toHaveBeenCalled()
      expect(inbox()).toEqual([])
    })
  }

  test('AI-11 a readable list without the triple keeps the card wording, distinct from the unreadable-list reason', async () => {
    const res = await runner({ approvedPath: writeApproved(tmp.dir, [], 'approved-none.json') }).runAiStep(job('good'))
    expect(res).toEqual({ ok: false, reason: LISTED_NOT_APPROVED, problems: [] })
  })
})

describe('ARC-16 round 2: recordings that cannot be matched', () => {
  test('ARC-16 a recordings folder that does not exist fails with re-record and the three key parts; no engine but the recorded one runs; the only log line is the refusal', async () => {
    const proj = vi.spyOn(aiEngines.project, 'run')
    const j = job('good')
    const { lines, sink } = collectLines()
    const res = await runner({ recordingsDir: path.join(tmp.dir, 'no-recordings-here'), sink }).runAiStep(j)
    expect(lines, 'a missing folder is not a malformed recording').toEqual(['ai step finding: refused'])
    expect(res.ok).toBe(false)
    if (res.ok) return
    const text = allText(res)
    expect(text).toMatch(/re-record/)
    expect(text).toContain(j.modelId)
    expect(text).toContain(j.promptHash)
    expect(text).toContain(expectedInputHash(j.inputs))
    expect(proj).not.toHaveBeenCalled()
  })

  test('ARC-16 SC R23 a recording with a stray top-level key is not read as a recording: re-record, never its answer', async () => {
    const dir = recordingsWith('stray', [{ ...GOOD_REC(), note: 'recorded by someone (Test)' }])
    const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(allText(res)).toMatch(/re-record/)
  })

  test('ARC-16 the same recording without the stray key is matched (the stray-key test is live)', async () => {
    const dir = recordingsWith('clean', [GOOD_REC()])
    expect(await runner({ recordingsDir: dir }).runAiStep(job('good'))).toMatchObject({ ok: true, output: GOOD_REC().output })
  })
})

// ---------- AI-10 round 4 (A426): the stamp table is derived from F04's contract, never copied from the runner ----------

/** Every stamp part, from the contract's shape (spec-writer, A426): a part added to F04 joins every test below. */
const STAMP_PARTS: readonly (keyof VersionStamp)[] = Object.keys(versionStampSchema.shape) as (keyof VersionStamp)[]
/** For each part, a F04-valid value that belongs to another job (never printed in a refusal). */
const OTHER: Readonly<Record<keyof VersionStamp, string>> = Object.fromEntries(
  STAMP_PARTS.map((k, i) => [k, `PLANTED-OTHER-STAMP-${String(i)}-${k} (Test)`]),
) as Record<keyof VersionStamp, string>
/** runner.ts read by name, so a missing export fails its test by name (round 4: the build exports the two lists). */
const runnerModule: Readonly<Record<string, unknown>> = runnerTs
const STAMP_MISMATCH = /the answer's stamp does not match the job: ([^\n]*?) \(AI-10\)/

/** The parts a refusal names, as an exact set parsed from the AI-10 reason (never a regex per part: /ocr ?engine/ also matches ocrEngineVersion). */
function namedParts(text: string): string[] {
  const m = STAMP_MISMATCH.exec(text)
  if (m === null) return []
  return (m[1] ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '').sort()
}

/** True when the runner's two lists cover the contract's parts exactly, once each. */
function coversContract(fromJob: readonly string[], fromAnswer: readonly string[], keys: readonly string[]): boolean {
  const all = [...fromJob, ...fromAnswer]
  const disjoint = fromJob.every((k) => !fromAnswer.includes(k))
  return disjoint && new Set(all).size === all.length && [...all].sort().join(',') === [...keys].sort().join(',')
}

function stampWith(part: keyof VersionStamp): VersionStamp {
  const stamp: VersionStamp = versionStampSchema.parse(GOOD_REC().stamp)
  stamp[part] = OTHER[part]
  return stamp
}

/** The fake project answers every inbox file with the good output under the given stamp. */
function projectAnswering(stamp: VersionStamp): void {
  fakeProject(({ json }) => {
    const id = String(json['jobId'])
    writeOutbox(exchange, `${id}.json`, outboxResult(id, GOOD_REC().output, stamp))
  })
}

async function handlerMessage(r: ReturnType<typeof runner>): Promise<{ threw: boolean; message: string }> {
  const h = createAiStepHandler('finding', r)
  const ctx = { jobId: 'job-c01-handler-stamp-test', attempt: 1, now: new Date('2026-10-02T12:00:00Z'), returnId: null }
  try {
    await h.run(job('good'), ctx)
    return { threw: false, message: '' }
  } catch (e) {
    return { threw: true, message: e instanceof Error ? e.message : String(e) }
  }
}

describe('AI-10 round 4: the runner compares every stamp part the contract has', () => {
  test('AI-10 the stamp table is the contract: STAMP_PARTS_FROM_JOB plus STAMP_PARTS_FROM_ANSWER equal versionStampSchema keys, disjoint', () => {
    const lists = z
      .strictObject({ fromJob: z.array(z.string()).readonly(), fromAnswer: z.array(z.string()).readonly() })
      .safeParse({ fromJob: runnerModule['STAMP_PARTS_FROM_JOB'], fromAnswer: runnerModule['STAMP_PARTS_FROM_ANSWER'] })
    expect(lists.success, 'runner.ts exports STAMP_PARTS_FROM_JOB and STAMP_PARTS_FROM_ANSWER as string lists').toBe(true)
    if (!lists.success) return
    expect(new Set([...lists.data.fromJob, ...lists.data.fromAnswer])).toEqual(new Set(STAMP_PARTS))
    expect(coversContract(lists.data.fromJob, lists.data.fromAnswer, STAMP_PARTS)).toBe(true)
  })

  test('AI-10 planted: a table missing mappingRelease, a part in both lists, or a part twice is caught by the meta check', () => {
    expect(STAMP_PARTS).toContain('mappingRelease')
    expect(coversContract(STAMP_PARTS, [], STAMP_PARTS)).toBe(true)
    expect(coversContract(STAMP_PARTS.filter((k) => k !== 'mappingRelease'), [], STAMP_PARTS)).toBe(false)
    expect(coversContract(STAMP_PARTS, ['mappingRelease'], STAMP_PARTS)).toBe(false)
    expect(coversContract([...STAMP_PARTS, 'modelId'], [], STAMP_PARTS)).toBe(false)
    expect(coversContract([...STAMP_PARTS, 'ordersVersion'], [], STAMP_PARTS)).toBe(false)
  })

  test('AI-10 planted: the exact-set parse tells ocrEngine from ocrEngineVersion and reads nothing from an unrelated reason', () => {
    expect(namedParts("the answer's stamp does not match the job: ocrEngineVersion (AI-10)")).toEqual(['ocrEngineVersion'])
    expect(namedParts("the answer's stamp does not match the job: ocrEngine, ocrEngineVersion (AI-10)")).toEqual(['ocrEngine', 'ocrEngineVersion'])
    expect(namedParts('inputs not redacted (AI-9)')).toEqual([])
  })

  test('AI-10 the table is live: every OTHER value is F04-valid, differs from the job, and the own-stamp answer runs', async () => {
    expect(STAMP_PARTS.length).toBeGreaterThan(0)
    for (const part of STAMP_PARTS) {
      expect(validateAiOutput('finding', GOOD_REC().output, stampWith(part)).ok, part).toBe(true)
      expect(OTHER[part], part).not.toBe(GOOD_REC().stamp[part])
    }
    const dir = recordingsWith('stamp-own', [GOOD_REC()])
    expect((await runner({ recordingsDir: dir }).runAiStep(job('good'))).ok).toBe(true)
  })

  for (const part of STAMP_PARTS) {
    test(`AI-10 recorded engine: an answer differing from the job only at ${part} is refused naming exactly {${part}}, no value printed`, async () => {
      const dir = recordingsWith(`stamp-${part}`, [{ ...GOOD_REC(), stamp: stampWith(part) }])
      const r = runner({ recordingsDir: dir })
      const res = await r.runAiStep(job('good'))
      expect(res.ok).toBe(false)
      if (res.ok) return
      const all = allText(res)
      expect(namedParts(all)).toEqual([part])
      expect(all).not.toContain(OTHER[part])
    })

    test(`AI-10 ARC-22 project engine: a result differing from the job only at ${part} is refused naming exactly {${part}}, no value printed`, async () => {
      projectAnswering(stampWith(part))
      const res = await projectRunner().runAiStep(job('good'), { jobId: JOB_ID })
      expect(res.ok).toBe(false)
      if (res.ok) return
      const all = allText(res)
      expect(namedParts(all)).toEqual([part])
      expect(all).not.toContain(OTHER[part])
    })

    test(`AI-10 ARC-22 handler: a project result differing from the job only at ${part} throws naming exactly {${part}}, no value printed`, async () => {
      projectAnswering(stampWith(part))
      const got = await handlerMessage(projectRunner())
      expect(got.threw).toBe(true)
      expect(namedParts(got.message)).toEqual([part])
      expect(got.message).not.toContain(OTHER[part])
    })
  }

  test('AI-10 an answer differing at both OCR parts is refused naming exactly {ocrEngine, ocrEngineVersion}', async () => {
    const stamp = { ...GOOD_REC().stamp, ocrEngine: OTHER.ocrEngine, ocrEngineVersion: OTHER.ocrEngineVersion }
    expect(validateAiOutput('finding', GOOD_REC().output, stamp).ok).toBe(true)
    const dir = recordingsWith('stamp-two-ocr', [{ ...GOOD_REC(), stamp }])
    const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(namedParts(allText(res))).toEqual(['ocrEngine', 'ocrEngineVersion'])
  })
})

describe('SEC-11 round 2: the is_test gate is for the project engine only', () => {
  test('SEC-11 a recorded-engine job for a return with is_test = false runs on its recorded answer', async () => {
    const rec = vi.spyOn(aiEngines.recorded, 'run')
    const j = job('good')
    j.isTest = false
    const res = await runner().runAiStep(j)
    expect(res).toMatchObject({ ok: true, output: GOOD_REC().output })
    expect(rec).toHaveBeenCalledTimes(1)
  })
})

describe('ARC-20 round 2: the exchange folder is read once, through env.ts, when the project engine is switched on', () => {
  test('ARC-20 SEC-10 env.ts reads AI_EXCHANGE_DIR by name beside the other settings, and a blank one does not break the read', () => {
    expect(readSettings({ AI_EXCHANGE_DIR: 'exchange folder (Test)', AUTH_ENGINE: 'live' })).toEqual({
      NODE_ENV: 'development',
      AUTH_ENGINE: 'live',
      AI_EXCHANGE_DIR: 'exchange folder (Test)',
    })
    expect(readSettings({ NODE_ENV: 'test' })).toEqual({ NODE_ENV: 'test' })
    expect(readSettings({ AI_EXCHANGE_DIR: '', AUTH_ENGINE: '' }).NODE_ENV).toBe('development')
    expect(() => readSettings({ AI_EXCHANGE_DIR: 'exchange folder (Test)', NODE_ENV: 'PLANTED-bad (Test)' })).toThrow(new Error('Invalid settings: NODE_ENV'))
  })

  test('ARC-20 the AI module reads its settings only through src/core/env.ts: no process.env in its sources', () => {
    const dir = path.join(REPO_ROOT, 'src', 'modules', 'ai')
    const files: string[] = []
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) {
          if (!e.name.startsWith('__')) walk(p)
        } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p)
      }
    }
    walk(dir)
    expect(files.length).toBeGreaterThan(1)
    for (const f of files) expect(readOwnSource(path.relative(process.cwd(), f)), f).not.toMatch(/process\.env/)
  })

  test('ARC-20 the setting cleared after the switch: the job still runs on the folder captured at the switch', async () => {
    const env: Record<string, string | undefined> = { AI_EXCHANGE_DIR: exchange }
    const r = runner({ env })
    expect(r.useEngine('project')).toEqual({ ok: true })
    delete env['AI_EXCHANGE_DIR']
    answeringProject()
    const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(res).toMatchObject({ ok: true, output: GOOD_REC().output })
    expect(inbox()).toEqual([`${JOB_ID}.json`])
  })

  test('ARC-20 the setting changed after the switch: the inbox file still goes to the folder captured at the switch', async () => {
    const other = path.join(tmp.dir, 'other-exchange')
    fs.mkdirSync(other)
    const env: Record<string, string | undefined> = { AI_EXCHANGE_DIR: exchange }
    const r = runner({ env })
    expect(r.useEngine('project')).toEqual({ ok: true })
    env['AI_EXCHANGE_DIR'] = other
    answeringProject()
    // a second fake on the other folder, so a runner that re-reads the setting ends instead of hanging
    const otherFake = startFakeProject(other, ({ json }) => {
      const id = String(json['jobId'])
      writeOutbox(other, `${id}.json`, outboxResult(id, GOOD_REC().output, GOOD_REC().stamp))
    })
    stops.push(otherFake.stop)
    const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(res.ok).toBe(true)
    expect(inbox()).toEqual([`${JOB_ID}.json`])
    expect(filesIn(path.join(other, 'inbox'))).toEqual([])
  })

  // Round 3 (reports/A04-spec-review-2.md gap 3): a blank folder is as unset as a missing one at the engine too,
  // or '' would write to ./inbox. The file writes are planted to throw, so a wrong engine fails fast and writes nothing.
  const NO_FOLDER: readonly (readonly [string, string | undefined])[] = [
    ['unset', undefined],
    ['empty', ''],
    ['spaces only', '   '],
  ]
  for (const [label, folder] of NO_FOLDER) {
    test(`ARC-20 aiEngines.project.run with an exchange folder that is ${label} refuses naming the setting and writes nothing`, async () => {
      const planted = (): never => {
        throw new Error('PLANTED: the engine touched the disk with no exchange folder')
      }
      const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(planted)
      const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(planted)
      const rename = vi.spyOn(fs, 'renameSync').mockImplementation(planted)
      const { lines, sink } = collectLines()
      // Round 5 engine context (exchange.acceptance.test.ts header): waiting counts pollers, now and deadline pin the wait.
      const ctx = {
        jobId: JOB_ID,
        recordingsDir: RECORDINGS_DIR,
        pollMs: 5,
        sink,
        waiting: new Map<string, number>(),
        seen: new Set<string>(),
        now: () => new Date('2026-10-03T09:00:00.000Z'),
        deadline: new Date('2026-10-04T08:50:00.000Z'),
        ...(folder === undefined ? {} : { exchangeDir: folder }),
      } as unknown as Parameters<typeof aiEngines.project.run>[1]
      // G2 (reports/A04-spec-review-3.md): the refusal comes back as a result; a thrown error fails here.
      const pending = Promise.resolve().then(() => aiEngines.project.run(job('good'), ctx))
      await expect(pending).resolves.toMatchObject({ ok: false, reason: expect.stringMatching(/AI_EXCHANGE_DIR/) as unknown })
      expect(write).not.toHaveBeenCalled()
      expect(mkdir).not.toHaveBeenCalled()
      expect(rename).not.toHaveBeenCalled()
      expect(fs.existsSync(path.join(process.cwd(), 'inbox'))).toBe(false)
      expect(lines).toEqual([])
    })
  }

  test('ARC-22 a blank job id ("  ") is refused with the job-id reason and no inbox file is written', async () => {
    const write = vi.spyOn(fs, 'writeFileSync')
    const res = await projectRunner().runAiStep(job('good'), { jobId: '  ' })
    expect(res).toEqual({ ok: false, reason: NEEDS_JOB_ID, problems: [] })
    expect(inbox()).toEqual([])
    expect(write).not.toHaveBeenCalled()
  })
})

describe('ARC-22 round 2: outbox files the job is not waiting for', () => {
  // Round 5 (RC2): restated. The own file holding another job's result fails the step at once instead of waiting.
  test('ARC-22 an outbox file named for this job but holding another job id fails the step at once, naming the file, never the other id', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const canary = 'PLANTED-CANARY-OTHER-ID (Test)'
      writeOutbox(exchange, `${JOB_ID}.json`, outboxResult('job-someone-else-test', { ...GOOD_REC().output, summary: canary }, GOOD_REC().stamp))
      const r = projectRunner({ sink })
      const res = await withinOnePoll(r.runAiStep(job('good'), { jobId: JOB_ID }))
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.reason).toContain(`${JOB_ID}.json`)
      expect(res.reason).toContain('another job')
      expect(res.problems).toEqual([])
      expect(r.refusals('finding')).toBe(0)
      const all = allText(res) + lines.join('\n')
      expect(all).not.toContain(canary)
      expect(all).not.toContain('job-someone-else-test')
      expect(all).not.toContain(exchange)
    } finally {
      vi.useRealTimers()
    }
  })

  test('ARC-22 two jobs waiting at once: neither logs the other job\'s outbox file while both wait', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const r = projectRunner({ sink })
      const A = 'job-c01-first-test'
      const B = 'job-c01-second-test'
      const pa = r.runAiStep(job('good'), { jobId: A })
      const pb = r.runAiStep(job('good'), { jobId: B })
      await vi.advanceTimersByTimeAsync(0)
      expect(inbox()).toEqual([`${A}.json`, `${B}.json`])
      // A started first, so A polls first and sees B's file while B still waits; then B reads it
      writeOutbox(exchange, `${B}.json`, outboxResult(B, GOOD_REC().output, GOOD_REC().stamp))
      await vi.advanceTimersByTimeAsync(5)
      expect(await pb).toMatchObject({ ok: true, output: GOOD_REC().output })
      expect(lines).toEqual(['ai step finding: ok'])
      writeOutbox(exchange, `${A}.json`, outboxResult(A, GOOD_REC().output, GOOD_REC().stamp))
      await vi.advanceTimersByTimeAsync(5)
      expect(await pa).toMatchObject({ ok: true, output: GOOD_REC().output })
      expect(lines.filter((l) => l.includes(`${A}.json`))).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  // Round 5 (fix 5): restated. A stranger is lstat'd only, never opened, and its name is logged quoted.
  test('ARC-22 a folder named like a result file in the outbox is logged once, quoted, never opened, and the job waits for its real file', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const folder = 'folder-not-a-result-test.json'
      const folderPath = path.resolve(exchange, 'outbox', folder)
      fs.mkdirSync(folderPath, { recursive: true })
      const touched: string[] = []
      const readFileSync = fs.readFileSync.bind(fs)
      vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        return (readFileSync as (...a: unknown[]) => unknown)(p, ...rest)
      }) as typeof fs.readFileSync)
      const openSync = fs.openSync.bind(fs)
      vi.spyOn(fs, 'openSync').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        return (openSync as (...a: unknown[]) => number)(p, ...rest)
      }))
      // A04 spec review 5, G2: the callback, stream and promise forms too (pass-through), so no read is invisible.
      const open = fs.open.bind(fs)
      vi.spyOn(fs, 'open').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        ;(open as (...a: unknown[]) => void)(p, ...rest)
      }))
      const readFile = fs.readFile.bind(fs)
      vi.spyOn(fs, 'readFile').mockImplementation(((p: unknown, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        ;(readFile as (...a: unknown[]) => void)(p, ...rest)
      }))
      const createReadStream = fs.createReadStream.bind(fs)
      vi.spyOn(fs, 'createReadStream').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        return (createReadStream as (...a: unknown[]) => fs.ReadStream)(p, ...rest)
      }))
      const promisesOpen = fs.promises.open.bind(fs.promises)
      vi.spyOn(fs.promises, 'open').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        return (promisesOpen as (...a: unknown[]) => unknown)(p, ...rest)
      }) as typeof fs.promises.open)
      const promisesReadFile = fs.promises.readFile.bind(fs.promises)
      vi.spyOn(fs.promises, 'readFile').mockImplementation(((p: unknown, ...rest: unknown[]) => {
        if (typeof p === 'string') touched.push(path.resolve(p))
        return (promisesReadFile as (...a: unknown[]) => unknown)(p, ...rest)
      }) as typeof fs.promises.readFile)
      const p = projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
      await vi.advanceTimersByTimeAsync(0)
      for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(5)
      writeOutbox(exchange, `${JOB_ID}.json`, outboxResult(JOB_ID, GOOD_REC().output, GOOD_REC().stamp))
      await vi.advanceTimersByTimeAsync(5)
      expect(await p).toMatchObject({ ok: true, output: GOOD_REC().output })
      expect(lines.filter((l) => l.includes(folder))).toEqual([`ai exchange: ignored outbox file ${JSON.stringify(folder)}`])
      expect(touched).not.toContain(folderPath)
      // liveness (G2): the own file is seen opening, so the spies are not blind
      expect(touched).toContain(path.resolve(exchange, 'outbox', `${JOB_ID}.json`))
      expect(lines.join('\n')).not.toContain(exchange)
    } finally {
      vi.useRealTimers()
    }
  })

  test('ARC-22 a second outbox file for a job already done is ignored and logged by name only (unit twin of the db test)', async () => {
    const { lines, sink } = collectLines()
    const canary = 'PLANTED-CANARY-SECOND-UNIT (Test)'
    const A = 'job-c01-done-first-test'
    const B = 'job-c01-after-it-test'
    fakeProject(async ({ json }) => {
      const id = String(json['jobId'])
      if (id === A) {
        writeOutbox(exchange, `${A}.json`, outboxResult(A, GOOD_REC().output, GOOD_REC().stamp))
        return
      }
      writeOutbox(exchange, `${A}.json`, outboxResult(A, { ...GOOD_REC().output, summary: canary }, GOOD_REC().stamp))
      await waitFor(() => lines.some((l) => l.includes(`${A}.json`)), 'the second file for the done job to be logged', 1000).catch(() => undefined)
      writeOutbox(exchange, `${id}.json`, outboxResult(id, GOOD_REC().output, GOOD_REC().stamp))
    })
    const r = projectRunner({ sink })
    expect(await r.runAiStep(job('good'), { jobId: A })).toMatchObject({ ok: true, output: GOOD_REC().output })
    expect(await r.runAiStep(job('good'), { jobId: B })).toMatchObject({ ok: true, output: GOOD_REC().output })
    expect(lines.some((l) => l.includes(`${A}.json`))).toBe(true)
    expect(lines.join('\n')).not.toContain(canary)
    expect(lines.join('\n')).not.toContain(exchange)
  })

  test('ARC-22 with no sink given, an ignored outbox file is logged through the core logger by name only', async () => {
    const written: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
      return true
    })
    const canary = 'PLANTED-CANARY-DEFAULT-SINK (Test)'
    const stranger = 'job-nobody-waits-default-sink-test.json'
    fakeProject(async ({ json }) => {
      const id = String(json['jobId'])
      writeOutbox(exchange, stranger, outboxResult('job-nobody-waits-default-sink-test', { ...GOOD_REC().output, summary: canary }, GOOD_REC().stamp))
      await waitFor(() => written.some((w) => w.includes(stranger)), 'the stranger to reach the core logger', 1000).catch(() => undefined)
      writeOutbox(exchange, `${id}.json`, outboxResult(id, GOOD_REC().output, GOOD_REC().stamp))
    })
    const r = createAiRunner({ recordingsDir: RECORDINGS_DIR, approvedPath, env: { AI_EXCHANGE_DIR: exchange }, pollMs: 5 })
    expect(r.useEngine('project')).toEqual({ ok: true })
    const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(res.ok).toBe(true)
    const all = written.join('\n')
    expect(all).toContain(stranger)
    expect(all).not.toContain(canary)
    expect(all).not.toContain(exchange)
  })

  test('ARC-22 the outbox is polled every 1000 ms by default: no read at 999 ms, the result read at 1000 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const r = createAiRunner({ recordingsDir: RECORDINGS_DIR, approvedPath, env: { AI_EXCHANGE_DIR: exchange } })
      expect(r.useEngine('project')).toEqual({ ok: true })
      let settled = false
      const p = r.runAiStep(job('good'), { jobId: JOB_ID }).then((res) => {
        settled = true
        return res
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(inbox()).toEqual([`${JOB_ID}.json`])
      writeOutbox(exchange, `${JOB_ID}.json`, outboxResult(JOB_ID, GOOD_REC().output, GOOD_REC().stamp))
      await vi.advanceTimersByTimeAsync(999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toBe(true)
      expect(await p).toMatchObject({ ok: true, output: GOOD_REC().output })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ARC-22 round 2: the log line and the handler, exactly', () => {
  test('ARC-22 each run logs exactly one line, "ai step finding: ok" or "ai step finding: refused", and nothing else', async () => {
    const { lines, sink } = collectLines()
    const r = runner({ sink })
    await r.runAiStep(job('good'))
    expect(lines).toEqual(['ai step finding: ok'])
    await r.runAiStep(job('broken'))
    expect(lines).toEqual(['ai step finding: ok', 'ai step finding: refused'])
    const unstamped = job('good')
    delete unstamped.redaction
    await r.runAiStep(unstamped)
    expect(lines).toEqual(['ai step finding: ok', 'ai step finding: refused', 'ai step finding: refused'])
  })

  test('ARC-22 the handler versions are exactly { handler: "ai:finding", runner: "a04-1" }', () => {
    expect(createAiStepHandler('finding', runner()).versions).toEqual({ handler: 'ai:finding', runner: 'a04-1' })
  })

  test('ARC-22 AI-1 a refusal through the handler throws a message holding the reason and every problem', async () => {
    const expected = await runner().runAiStep(job('broken'))
    if (expected.ok) throw new Error('fixture must be refused')
    expect(expected.problems.length).toBeGreaterThan(0)
    const h = createAiStepHandler('finding', runner())
    const ctx = { jobId: JOB_ID, attempt: 1, now: new Date('2026-10-02T12:00:00Z'), returnId: null }
    let message = ''
    try {
      await h.run(job('broken'), ctx)
    } catch (e) {
      message = e instanceof Error ? e.message : String(e)
    }
    expect(message).toContain(expected.reason)
    for (const p of expected.problems) expect(message).toContain(p)
  })
})

describe('AI-10 round 2: the input hash on nulls and arrays of objects', () => {
  test('AI-10 inputHashOf keeps nulls, sorts keys inside arrays of objects at every depth and keeps array order', () => {
    const a = { note: null, rows: [{ b: 1, a: { d: null, c: [2, 1] } }, { y: 'x (Test)', x: 0 }] }
    const shuffled = { rows: [{ a: { c: [2, 1], d: null }, b: 1 }, { x: 0, y: 'x (Test)' }], note: null }
    const literal = '{"note":null,"rows":[{"a":{"c":[2,1],"d":null},"b":1},{"x":0,"y":"x (Test)"}]}'
    expect(inputHashOf(a)).toBe(sha256(literal))
    expect(inputHashOf(shuffled)).toBe(sha256(literal))
    expect(inputHashOf({ note: null, rows: [...shuffled.rows].reverse() })).not.toBe(sha256(literal))
    expect(inputHashOf({ only: null })).toBe(expectedInputHash({ only: null }))
  })
})

// ---------- Round 3 (reports/A04-spec-review-2.md, gaps 2 and 4 to 7; gap 3 is the loop in the ARC-20 round 2 block) ----------
// A malformed recording fails closed; the stamp check holds through the project engine and the handler; an ignored
// outbox file is logged again only when its content changes; every AI setting goes through env.ts; two recordings
// for one key are a flag for a person, never a silent pick (Lead, A410).

const DUPLICATE = /two recordings for one key/

/** A recordings folder in the temp dir holding exactly the given files, written as raw text. */
function rawRecordings(label: string, files: Readonly<Record<string, string>>): string {
  const dir = path.join(tmp.dir, `raw-recordings-${label}`)
  fs.mkdirSync(dir)
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text)
  return dir
}

const recordingText = (rec: object): string => JSON.stringify(rec, null, 2) + '\n'

describe('ARC-16 round 3: a malformed recording fails closed, never a crash', () => {
  const MALFORMED: Readonly<Record<string, string>> = {
    'a-bad.json': '{',
    'a-empty.json': '',
    'a-null.json': 'null',
    'a-list.json': '[]',
  }

  test('ARC-16 recordings that are not one JSON recording sit beside the good one: the step resolves on the good one', async () => {
    const dir = rawRecordings('bad-and-good', { ...MALFORMED, 'b-good.json': recordingText(GOOD_REC()) })
    await expect(runner({ recordingsDir: dir }).runAiStep(job('good'))).resolves.toMatchObject({ ok: true, output: GOOD_REC().output })
  })

  for (const [name, text] of Object.entries(MALFORMED)) {
    test(`ARC-16 a folder holding only ${name} (${JSON.stringify(text)}) resolves to "re-record" with the three key parts`, async () => {
      const j = job('good')
      const dir = rawRecordings(`only-${name.replace(/\W+/g, '-')}`, { [name]: text })
      const res = await runner({ recordingsDir: dir }).runAiStep(j)
      expect(res.ok).toBe(false)
      if (res.ok) return
      const all = allText(res)
      expect(all).toMatch(/re-record/)
      expect(all).toContain(j.modelId)
      expect(all).toContain(j.promptHash)
      expect(all).toContain(expectedInputHash(j.inputs))
    })
  }

  test('ARC-16 the handler turns a malformed-only folder into a thrown refusal with the reason, not a crash of another kind', async () => {
    const dir = rawRecordings('handler-bad', { 'a-bad.json': '{' })
    const h = createAiStepHandler('finding', runner({ recordingsDir: dir }))
    const ctx = { jobId: JOB_ID, attempt: 1, now: new Date('2026-10-02T12:00:00Z'), returnId: null }
    await expect(Promise.resolve().then(() => h.run(job('good'), ctx))).rejects.toThrow(/re-record/)
  })

  test('ARC-16 only *.json files are recordings: a notes.txt holding the good answer is never read, and the only log line is the refusal', async () => {
    const dir = rawRecordings('txt', { 'notes.txt': recordingText(GOOD_REC()) })
    const read = vi.spyOn(fs, 'readFileSync')
    const { lines, sink } = collectLines()
    const res = await runner({ recordingsDir: dir, sink }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(allText(res)).toMatch(/re-record/)
    expect(read.mock.calls.filter((c) => String(c[0]).endsWith('notes.txt'))).toEqual([])
    expect(lines, 'a non-JSON file is not a malformed recording').toEqual(['ai step finding: refused'])
  })
})

// ---------- G1 (Lead, A418; reports/A04-spec-review-3.md): a malformed recording is skipped and logged once by
// name with the reason, never its content or the folder path. Reasons: "unparseable" (not JSON at all) and
// "not one recording" (JSON, but not one recording) are told apart; a .json entry that cannot be read (a folder)
// is flagged too. Logged again only when the file is rewritten with other bytes (the outbox rule, amber). ----------

const UNPARSEABLE = /unparseable/i
const NOT_ONE_RECORDING = /not one recording/i
const BAD_CANARY = 'PLANTED-CANARY-BAD-RECORDING (Test)'
const STRAY_VALUE = 'PLANTED-STRAY-VALUE (Test)'
const WRONG_TYPE_VALUE = 4242424242

type MalformedKind = { name: string; text: string | null; reason: RegExp | null; secret: string | null }

const MALFORMED_KINDS: readonly MalformedKind[] = [
  { name: 'a-bad.json', text: `{ "summary": "${BAD_CANARY}"`, reason: UNPARSEABLE, secret: BAD_CANARY },
  { name: 'a-empty.json', text: '', reason: UNPARSEABLE, secret: null },
  { name: 'a-null.json', text: 'null', reason: NOT_ONE_RECORDING, secret: null },
  { name: 'a-list.json', text: '[]', reason: NOT_ONE_RECORDING, secret: null },
  { name: 'a-stray.json', text: recordingText({ ...GOOD_REC(), note: STRAY_VALUE }), reason: NOT_ONE_RECORDING, secret: STRAY_VALUE },
  { name: 'a-wrong-type.json', text: recordingText({ ...GOOD_REC(), modelId: WRONG_TYPE_VALUE }), reason: NOT_ONE_RECORDING, secret: String(WRONG_TYPE_VALUE) },
  // A folder named like a recording: the unreadable-entry branch (text null: made with mkdir).
  { name: 'a-dir.json', text: null, reason: null, secret: null },
]

describe('ARC-16 A418: a malformed recording is skipped and logged once by name with the reason', () => {
  for (const kind of MALFORMED_KINDS) {
    test(`ARC-16 ${kind.name} beside the good recording: the step resolves ok, the file is logged once by name with its reason, never its content or the folder path`, async () => {
      const dir = path.join(tmp.dir, `recordings-folder-canary-${kind.name.replace(/\W+/g, '-')}`)
      fs.mkdirSync(dir)
      const at = path.join(dir, kind.name)
      if (kind.text === null) fs.mkdirSync(at)
      else fs.writeFileSync(at, kind.text)
      fs.writeFileSync(path.join(dir, 'b-good.json'), recordingText(GOOD_REC()))
      const { lines, sink } = collectLines()
      const r = runner({ recordingsDir: dir, sink })
      const named = (): string[] => lines.filter((l) => l.includes(kind.name))

      await expect(r.runAiStep(job('good'))).resolves.toMatchObject({ ok: true, output: GOOD_REC().output })
      expect(lines).toHaveLength(2)
      expect(lines).toContain('ai step finding: ok')
      expect(named(), 'one line names the file').toHaveLength(1)
      const line = named()[0] ?? ''
      expect(line.replace(kind.name, '').trim().length, 'the line gives a reason besides the name').toBeGreaterThan(0)
      if (kind.reason === UNPARSEABLE) {
        expect(line).toMatch(UNPARSEABLE)
        expect(line).not.toMatch(NOT_ONE_RECORDING)
      }
      if (kind.reason === NOT_ONE_RECORDING) {
        expect(line).toMatch(NOT_ONE_RECORDING)
        expect(line).not.toMatch(UNPARSEABLE)
      }
      if (kind.secret !== null) expect(lines.join('\n')).not.toContain(kind.secret)
      expect(lines.join('\n')).not.toContain(dir)
      expect(lines.join('\n')).not.toContain('folder-canary')

      // once: the same file on the next run adds no line for it
      await expect(r.runAiStep(job('good'))).resolves.toMatchObject({ ok: true })
      expect(named()).toHaveLength(1)
      expect(lines).toHaveLength(3)
      expect(lines.filter((l) => l === 'ai step finding: ok')).toHaveLength(2)

      // rewritten with other bad bytes: logged again (amber; reverse by dropping this block)
      if (kind.text !== null) {
        fs.writeFileSync(at, `${kind.text} \n`)
        await expect(r.runAiStep(job('good'))).resolves.toMatchObject({ ok: true })
        expect(named()).toHaveLength(2)
        expect(lines).toHaveLength(5)
        if (kind.secret !== null) expect(lines.join('\n')).not.toContain(kind.secret)
      }
    })
  }

  test('ARC-16 the two reasons are told apart: an unparseable file and a file that is not one recording log different reasons', async () => {
    const dir = path.join(tmp.dir, 'recordings-two-reasons')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'x-bad.json'), '{')
    fs.writeFileSync(path.join(dir, 'y-null.json'), 'null')
    fs.writeFileSync(path.join(dir, 'z-good.json'), recordingText(GOOD_REC()))
    const { lines, sink } = collectLines()
    await expect(runner({ recordingsDir: dir, sink }).runAiStep(job('good'))).resolves.toMatchObject({ ok: true })
    const bad = (lines.find((l) => l.includes('x-bad.json')) ?? '').replace('x-bad.json', '')
    const notOne = (lines.find((l) => l.includes('y-null.json')) ?? '').replace('y-null.json', '')
    expect(bad).toMatch(UNPARSEABLE)
    expect(notOne).toMatch(NOT_ONE_RECORDING)
    expect(bad).not.toBe(notOne)
    expect(lines).toHaveLength(3)
  })
})

describe('ARC-16 round 3: two recordings for one key are refused, naming both files (Lead, A410)', () => {
  test('ARC-16 two recordings with the same key and different answers refuse with "two recordings for one key", naming both files; neither answer is used', async () => {
    const good = GOOD_REC()
    const other = { ...good, output: { ...good.output, summary: 'another recorded answer (Test)' } }
    const dir = rawRecordings('duplicate', {
      'a-first.json': recordingText(good),
      'b-second.json': recordingText(other),
      'c-another-job.json': recordingText(recording('finding-c01-broken')),
    })
    const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    const all = allText(res)
    expect(all).toMatch(DUPLICATE)
    expect(all).toContain('a-first.json')
    expect(all).toContain('b-second.json')
    // each name stands on its own (a person must be able to read both)
    expect(all).toMatch(/\ba-first\.json\b[\s\S]*\bb-second\.json\b|\bb-second\.json\b[\s\S]*\ba-first\.json\b/)
    expect(all).not.toContain('c-another-job.json')
    expect(all).not.toContain('another recorded answer (Test)')
  })

  test('ARC-16 two identical copies of one recording are refused the same way (the rule is about the key, not the answer)', async () => {
    const dir = rawRecordings('copies', { 'copy-1.json': recordingText(GOOD_REC()), 'copy-2.json': recordingText(GOOD_REC()) })
    const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(allText(res)).toMatch(DUPLICATE)
    expect(allText(res)).toContain('copy-1.json')
    expect(allText(res)).toContain('copy-2.json')
  })

  test('ARC-16 a duplicate of another job\'s key does not stop this job: only this job\'s key is checked', async () => {
    const broken = recording('finding-c01-broken')
    const dir = rawRecordings('other-dup', {
      'a-broken.json': recordingText(broken),
      'b-broken-again.json': recordingText(broken),
      'c-good.json': recordingText(GOOD_REC()),
    })
    expect(await runner({ recordingsDir: dir }).runAiStep(job('good'))).toMatchObject({ ok: true, output: GOOD_REC().output })
  })

  test('ARC-16 the shipped recordings folder holds no two recordings for one key', () => {
    const keys = filesIn(RECORDINGS_DIR)
      .filter((n) => n.endsWith('.json'))
      .map((n) => {
        const rec = JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, n), 'utf8')) as { modelId: string; promptHash: string; inputHash: string }
        return `${rec.modelId} ${rec.promptHash} ${rec.inputHash}`
      })
    expect(keys.length).toBeGreaterThan(1)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('ARC-22 round 3: an ignored outbox file is logged once per content', () => {
  // Round 5 (fix 5): restated. A stranger is never opened, so "logged once" is keyed by its name, size and mtime
  // (lstat), not its content. The mtimes are set with utimes, so a same-size rewrite in the same millisecond is no part
  // of this test (reports/A04-findings-5.md, risks).
  test('ARC-22 a stranger file is logged once over many polls, again only when its size or mtime changes, by name only', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const strangerId = 'job-stranger-rewritten-test'
      const stranger = `${strangerId}.json`
      const strangerPath = path.join(exchange, 'outbox', stranger)
      const first = 'PLANTED-CANARY-FIRST-CONTENT (Test)'
      const second = 'PLANTED-CANARY-SECOND-CONTENT (Test)'
      const content = (summary: string): string => outboxResult(strangerId, { ...GOOD_REC().output, summary }, GOOD_REC().stamp)
      const at = (sec: number): Date => new Date(Date.UTC(2026, 9, 3, 9, 0, sec))
      const plant = (text: string, mtime: Date): void => {
        writeOutbox(exchange, stranger, text)
        fs.utimesSync(strangerPath, mtime, mtime)
      }
      const polls = async (n: number): Promise<void> => {
        for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(5)
      }
      const strangerLines = (): string[] => lines.filter((l) => l.includes(stranger))

      plant(content(first), at(1))
      const p = projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
      await vi.advanceTimersByTimeAsync(0)
      await polls(6)
      expect(strangerLines()).toHaveLength(1)

      plant(content(first), at(1)) // the same bytes and the same mtime again: nothing new to flag
      await polls(6)
      expect(strangerLines()).toHaveLength(1)

      plant(content(first), at(2)) // the same size, a new mtime: flagged again
      await polls(6)
      expect(strangerLines()).toHaveLength(2)

      expect(Buffer.byteLength(content(second))).not.toBe(Buffer.byteLength(content(first)))
      plant(content(second), at(2)) // a new size (SECOND is one letter longer than FIRST), the same mtime: flagged again
      await polls(6)
      expect(strangerLines()).toHaveLength(3)

      writeOutbox(exchange, `${JOB_ID}.json`, outboxResult(JOB_ID, GOOD_REC().output, GOOD_REC().stamp))
      await polls(1)
      expect(await p).toMatchObject({ ok: true, output: GOOD_REC().output })
      const logged = strangerLines()
      expect(logged).toHaveLength(3)
      expect(new Set(logged)).toEqual(new Set([`ai exchange: ignored outbox file ${JSON.stringify(stranger)}`]))
      const all = lines.join('\n')
      expect(all).not.toContain(first)
      expect(all).not.toContain(second)
      expect(all).not.toContain(exchange)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ARC-20 SEC-10 round 3: every AI setting goes through env.ts (R71 is the everywhere rule)', () => {
  test('ARC-20 SEC-10 for each name in AI_SETTING_NAMES, readSettings returns the value under that name', () => {
    expect(AI_SETTING_NAMES.length).toBeGreaterThan(0)
    for (const name of AI_SETTING_NAMES) {
      const got = readSettings({ [name]: 'x (Test)' }) as Record<string, unknown>
      expect(got[name], name).toBe('x (Test)')
    }
  })
})

// Round 3 survivor tests: behaviour a passing stub left unpinned under `npm run mutate:changed -- A04`
// (reports/A04-spec.md, round 3). Each names what it pins.

describe('AI-1 AI-10 round 3: every refusal names its clause and every part it lists stands on its own', () => {
  test('AI-1 an answer that fails F04 is refused with a reason naming AI-1, besides the problems', async () => {
    const res = await runner().runAiStep(job('broken'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toMatch(/\bAI-1\b/)
    expect(res.problems.length).toBeGreaterThan(0)
  })

  test('AI-10 an answer stamped with another model id and another input hash is refused naming both parts, each on its own', async () => {
    const good = GOOD_REC()
    const stamp = { ...good.stamp, modelId: OTHER.modelId, inputHash: OTHER.inputHash }
    expect(validateAiOutput('finding', good.output, stamp).ok).toBe(true)
    const dir = recordingsWith('stamp-two-parts', [{ ...good, stamp }])
    const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (res.ok) return
    const all = allText(res)
    expect(all).toMatch(/AI-10/)
    expect(namedParts(all)).toEqual(['inputHash', 'modelId'])
  })

  test('ARC-22 the handler message keeps the reason and each problem apart (never run together)', async () => {
    const expected = await runner().runAiStep(job('broken'))
    if (expected.ok) throw new Error('fixture must be refused')
    const [firstProblem] = expected.problems
    if (firstProblem === undefined) throw new Error('fixture must list a problem')
    const h = createAiStepHandler('finding', runner())
    const ctx = { jobId: JOB_ID, attempt: 1, now: new Date('2026-10-02T12:00:00Z'), returnId: null }
    let message = ''
    try {
      await h.run(job('broken'), ctx)
    } catch (e) {
      message = e instanceof Error ? e.message : String(e)
    }
    expect(message).toContain(expected.reason)
    expect(message).toContain(firstProblem)
    expect(message).not.toContain(expected.reason + firstProblem)
  })
})

describe('ARC-22 round 3: a file in the outbox that is not a result is flagged, by name only (card: files that match no running job)', () => {
  test('ARC-22 a notes.txt in the outbox is ignored, logged once by name, and the job waits for its real file', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const canary = 'PLANTED-CANARY-NOTES (Test)'
      writeOutbox(exchange, 'notes.txt', `${canary}\n`)
      const p = projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
      await vi.advanceTimersByTimeAsync(0)
      for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(5)
      expect(lines.filter((l) => l.includes('notes.txt'))).toHaveLength(1)
      writeOutbox(exchange, `${JOB_ID}.json`, outboxResult(JOB_ID, GOOD_REC().output, GOOD_REC().stamp))
      await vi.advanceTimersByTimeAsync(5)
      expect(await p).toMatchObject({ ok: true, output: GOOD_REC().output })
      expect(lines.filter((l) => l.includes('notes.txt'))).toHaveLength(1)
      expect(lines.join('\n')).not.toContain(canary)
      expect(lines.join('\n')).not.toContain(exchange)
    } finally {
      vi.useRealTimers()
    }
  })
})
