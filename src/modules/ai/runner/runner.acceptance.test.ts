// A04 acceptance tests: the AI runner (spec-writer; builders never edit this file).
// The job-queue behaviour (checks 5, 6 and 11 through F06's real queue) is in
// src/pipeline/ai-exchange.acceptance.db.test.ts, because a module may not import another module (ARC-7).
//
// The shape these tests fix (the builder matches it; extra exports are fine):
// `src/modules/ai/index.ts` exports
//   createAiRunner(options): AiRunner
//     options: { recordingsDir: string; approvedPath?: string (default data/ai/approved.json at the repo root);
//                env?: Record<string, string | undefined> (default process.env; settings read by name, values never
//                printed); sink?: (line: string) => void (one log line per call); pollMs?: number (outbox poll) }
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
//   { jobId, output, stamp }. A file that is not one JSON object, or names no job it is waiting on, is ignored and
//   logged by file name only.
// Amber choices are listed in reports/A04-spec.md.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { aiStepSchemas, validateAiOutput } from '../../../contracts/ai'
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
  vi.restoreAllMocks()
  tmp.cleanup()
})

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

  test('ARC-22 an outbox file that is not one JSON result is ignored and logged by name only; the job waits for a real one', async () => {
    const { lines, sink } = collectLines()
    const canary = 'PLANTED-CANARY-CONTENT (Test)'
    fakeProject(async ({ json }) => {
      const id = String(json['jobId'])
      writeOutbox(exchange, `${id}.json`, `not json ${canary}`)
      await waitFor(() => lines.some((l) => l.includes(`${id}.json`)), 'the bad outbox file to be logged')
      writeOutbox(exchange, `${id}.json`, JSON.stringify([canary, canary]))
      await waitFor(() => lines.filter((l) => l.includes(`${id}.json`)).length >= 2, 'the two-result file to be logged')
      writeOutbox(exchange, `${id}.json`, outboxResult(id, recording('finding-c01-good').output, recording('finding-c01-good').stamp))
    })
    const r = projectRunner({ sink })
    const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
    expect(res).toMatchObject({ ok: true, output: recording('finding-c01-good').output })
    expect(lines.join('\n')).not.toContain(canary)
    expect(lines.join('\n')).not.toContain(exchange)
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
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
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
  test('ARC-16 a recordings folder that does not exist fails with re-record and the three key parts; no engine but the recorded one runs', async () => {
    const proj = vi.spyOn(aiEngines.project, 'run')
    const j = job('good')
    const res = await runner({ recordingsDir: path.join(tmp.dir, 'no-recordings-here') }).runAiStep(j)
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

/** The four stamp parts the runner compares with the job (AI-10), and a value for each that belongs to another job. */
const PARTS = {
  modelId: /model ?id/i,
  promptVersion: /prompt ?version/i,
  promptHash: /prompt ?hash/i,
  inputHash: /input ?hash/i,
} as const
const OTHER: Record<keyof typeof PARTS, string> = {
  modelId: 'claude-other-model-test',
  promptVersion: 'finding-v2-test',
  promptHash: 'e'.repeat(64),
  inputHash: 'f'.repeat(64),
}

describe('AI-10 round 2: a F04-valid answer stamped for another job is refused, naming exactly the part that differs', () => {
  for (const part of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
    test(`AI-10 a recorded answer stamped with another ${part} is refused naming ${part} and no other part; nothing is counted as output`, async () => {
      const good = GOOD_REC()
      const stamp = { ...good.stamp, [part]: OTHER[part] }
      expect(validateAiOutput('finding', good.output, stamp).ok).toBe(true)
      const dir = recordingsWith(`stamp-${part}`, [{ ...good, stamp }])
      const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
      expect(res.ok).toBe(false)
      if (res.ok) return
      const text = allText(res)
      expect(text).toMatch(/AI-10/)
      expect(text).toMatch(PARTS[part])
      for (const other of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
        if (other !== part) expect(text, other).not.toMatch(PARTS[other])
      }
      expect(text).not.toContain(OTHER[part])
    })
  }

  test('AI-10 the same recording with its own stamp runs (the stamp tests are live)', async () => {
    const dir = recordingsWith('stamp-own', [GOOD_REC()])
    expect((await runner({ recordingsDir: dir }).runAiStep(job('good'))).ok).toBe(true)
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
      const ctx: Parameters<typeof aiEngines.project.run>[1] = {
        jobId: JOB_ID,
        recordingsDir: RECORDINGS_DIR,
        pollMs: 5,
        sink,
        waiting: new Set<string>(),
        seen: new Set<string>(),
        ...(folder === undefined ? {} : { exchangeDir: folder }),
      }
      const res = await aiEngines.project
        .run(job('good'), ctx)
        .catch((e: unknown) => ({ ok: false as const, reason: `threw: ${String(e)}`, problems: [] }))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toMatch(/AI_EXCHANGE_DIR/)
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
  test('ARC-22 an outbox file named for this job but holding another job id is ignored and logged once, by name only', async () => {
    const { lines, sink } = collectLines()
    const canary = 'PLANTED-CANARY-OTHER-ID (Test)'
    fakeProject(async ({ json }) => {
      const id = String(json['jobId'])
      writeOutbox(exchange, `${id}.json`, outboxResult('job-someone-else-test', { ...GOOD_REC().output, summary: canary }, GOOD_REC().stamp))
      await waitFor(() => lines.some((l) => l.includes(`${id}.json`)), 'the mislabelled file to be logged', 1000).catch(() => undefined)
      await pause(40) // several more polls see the same file
      writeOutbox(exchange, `${id}.json`, outboxResult(id, GOOD_REC().output, GOOD_REC().stamp))
    })
    const res = await projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
    expect(res).toMatchObject({ ok: true, output: GOOD_REC().output })
    expect(lines.filter((l) => l.includes(`${JOB_ID}.json`))).toHaveLength(1)
    expect(lines.join('\n')).not.toContain(canary)
    expect(lines.join('\n')).not.toContain('job-someone-else-test')
    expect(lines.join('\n')).not.toContain(exchange)
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

  test('ARC-22 a folder named like a result file in the outbox is logged once by name and the job waits for its real file', async () => {
    const { lines, sink } = collectLines()
    const folder = 'folder-not-a-result-test.json'
    fs.mkdirSync(path.join(exchange, 'outbox', folder), { recursive: true })
    fakeProject(async ({ json }) => {
      const id = String(json['jobId'])
      await waitFor(() => lines.some((l) => l.includes(folder)), 'the folder to be logged', 1000).catch(() => undefined)
      await pause(40)
      writeOutbox(exchange, `${id}.json`, outboxResult(id, GOOD_REC().output, GOOD_REC().stamp))
    })
    const res = await projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
    expect(res).toMatchObject({ ok: true, output: GOOD_REC().output })
    expect(lines.filter((l) => l.includes(folder))).toHaveLength(1)
    expect(lines.join('\n')).not.toContain(exchange)
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

  test('ARC-16 only *.json files are recordings: a notes.txt holding the good answer is never read', async () => {
    const dir = rawRecordings('txt', { 'notes.txt': recordingText(GOOD_REC()) })
    const read = vi.spyOn(fs, 'readFileSync')
    const res = await runner({ recordingsDir: dir }).runAiStep(job('good'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(allText(res)).toMatch(/re-record/)
    expect(read.mock.calls.filter((c) => String(c[0]).endsWith('notes.txt'))).toEqual([])
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

describe('AI-10 round 3: the stamp check holds through the project engine and the handler', () => {
  for (const part of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
    test(`AI-10 ARC-22 a project result F04-valid but stamped with another ${part} is refused naming ${part} only, and the handler throws it`, async () => {
      const good = GOOD_REC()
      const stamp = { ...good.stamp, [part]: OTHER[part] }
      expect(validateAiOutput('finding', good.output, stamp).ok).toBe(true)
      fakeProject(({ json }) => {
        const id = String(json['jobId'])
        writeOutbox(exchange, `${id}.json`, outboxResult(id, good.output, stamp))
      })
      const r = projectRunner()
      const res = await r.runAiStep(job('good'), { jobId: JOB_ID })
      expect(res.ok).toBe(false)
      if (res.ok) return
      const all = allText(res)
      expect(all).toMatch(/AI-10/)
      expect(all).toMatch(PARTS[part])
      for (const other of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
        if (other !== part) expect(all, other).not.toMatch(PARTS[other])
      }
      expect(all).not.toContain(OTHER[part])

      const h = createAiStepHandler('finding', r)
      const ctx = { jobId: 'job-c01-handler-stamp-test', attempt: 1, now: new Date('2026-10-02T12:00:00Z'), returnId: null }
      let message = ''
      try {
        await h.run(job('good'), ctx)
      } catch (e) {
        message = e instanceof Error ? e.message : String(e)
      }
      expect(message).toMatch(/AI-10/)
      expect(message).toMatch(PARTS[part])
      expect(message).not.toContain(OTHER[part])
    })
  }
})

describe('ARC-22 round 3: an ignored outbox file is logged once per content', () => {
  test('ARC-22 a stranger file is logged once over many polls, again only when rewritten with new content, by name only', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { lines, sink } = collectLines()
      const strangerId = 'job-stranger-rewritten-test'
      const stranger = `${strangerId}.json`
      const first = 'PLANTED-CANARY-FIRST-CONTENT (Test)'
      const second = 'PLANTED-CANARY-SECOND-CONTENT (Test)'
      const content = (summary: string): string => outboxResult(strangerId, { ...GOOD_REC().output, summary }, GOOD_REC().stamp)
      const polls = async (n: number): Promise<void> => {
        for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(5)
      }
      const strangerLines = (): string[] => lines.filter((l) => l.includes(stranger))

      writeOutbox(exchange, stranger, content(first))
      const p = projectRunner({ sink }).runAiStep(job('good'), { jobId: JOB_ID })
      await vi.advanceTimersByTimeAsync(0)
      await polls(6)
      expect(strangerLines()).toHaveLength(1)

      writeOutbox(exchange, stranger, content(first)) // the same bytes again: nothing new to flag
      await polls(6)
      expect(strangerLines()).toHaveLength(1)

      writeOutbox(exchange, stranger, content(second))
      await polls(6)
      expect(strangerLines()).toHaveLength(2)

      writeOutbox(exchange, `${JOB_ID}.json`, outboxResult(JOB_ID, GOOD_REC().output, GOOD_REC().stamp))
      await polls(1)
      expect(await p).toMatchObject({ ok: true, output: GOOD_REC().output })
      const logged = strangerLines()
      expect(logged).toHaveLength(2)
      expect(logged[0]).toBe(logged[1])
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
    expect(all).toMatch(/model ?id\W+input ?hash|input ?hash\W+model ?id/i)
    expect(all).not.toMatch(PARTS.promptVersion)
    expect(all).not.toMatch(PARTS.promptHash)
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
