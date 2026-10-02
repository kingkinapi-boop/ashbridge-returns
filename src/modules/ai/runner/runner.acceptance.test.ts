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
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/not approved/)
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
