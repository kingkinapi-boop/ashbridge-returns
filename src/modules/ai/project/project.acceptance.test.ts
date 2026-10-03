// A08 acceptance tests: the Claude project's run-once launcher, its orders and its settings (spec-writer;
// builders never edit this file). Check 11 (A04's runner and this launcher together, through F06's queue) is in
// src/pipeline/ai-project.acceptance.db.test.ts. No test calls the real `claude`: every run uses the fake program
// in __fixtures__/fake-claude.mjs (its protocol is written at its top).
//
// The shape these tests fix (the builder matches it; extra exports are fine):
// `src/modules/ai/project/index.ts` exports
//   runAiProjectOnce(options): Promise<{ ok: true } | { ok: false; reason: string }>
//     options: { argv?: readonly string[] (the arguments after `npm run ai:once --`; default none);
//                env: Record<string, string | undefined> (settings, read by name; values never printed);
//                approvedPath?: string (default data/ai/approved.json at the repo root; tests point at their own,
//                as A04's runner does); sink?: (line: string) => void (every log line) }
//     One pass over `<AI_EXCHANGE_DIR>/inbox`, then it resolves. A run-level refusal (the project is off, a key
//     setting, a watch or loop option, an exchange folder inside the repo) is { ok: false, reason } with nothing
//     written; per-job outcomes are outbox files, and the run itself is { ok: true }.
//   `npm run ai:once [-- args]` runs the same pass from the command line, prints its log lines, exits 0 after a pass
//   and non-zero on a run-level refusal, printing the reason.
// Settings: AI_EXCHANGE_DIR (the exchange folder), AI_PROJECT_CLAUDE_BIN (the program; default `claude`; a path
//   ending in .mjs is run with the running Node, so the fake works on every machine).
// Inbox: A04's file, `inbox/<job id>.json` (see A04's golden). Jobs are taken in job id order.
// Outbox, written as a temp file then a rename:
//   an answer:  { jobId, output, stamp }  exactly A04's OutboxFileSchema; `output` is the model's JSON as returned;
//               `stamp` is F04's VersionStamp (modelId as the CLI reported it, promptVersion, promptHash, inputHash,
//               ocrEngine, ocrEngineVersion, mappingRelease copied from the job).
//   a refusal:  { jobId, refusal: { reason: string, problems: string[] } }  (no output, no stamp). A job whose id
//               breaks the grammar is refused in `outbox/<inbox file stem>.json`.
// Per-job folder: a fresh folder under the exchange folder, the working folder of the CLI call; it holds a copy of
//   the job's inputs. Temp files (the outbox write is a temp file then a rename) live outside `outbox/` (A420):
//   `outbox/` only ever holds `<job id>.json` result files, even mid-run.
// The run log (every `sink` line, and what `npm run ai:once` prints) carries the orders version: sha256 hex of the
//   bytes of ai-project/ORDERS.md followed by the bytes of ai-project/settings.json. It is not in the stamp, which
//   is exactly F04's 7 parts (A426); every table over the stamp's parts is derived from `versionStampSchema.shape`.
// The CLI call: print mode, `--output-format json`, `--model <job model id>`, the orders as the system prompt
//   (`--system-prompt` or `--system-prompt-file`), the project's settings (`--settings`), each input inside a
//   `<data ...>...</data>` block in the prompt with every `<` inside the data escaped.
// The model id the CLI reports is the key of `modelUsage` in its JSON (the fake prints it that way).
// Amber choices: see reports/A08-spec.md (the refusal shape; the `<data>` wrapper; the reasons below; the orders
//   version as a run-log line).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { z } from 'zod'
import { aiStepSchemas, validateAiOutput, versionStampSchema } from '../../../contracts/ai'
import { readOwnSource } from '../../../core/testing/read-own-source'
import { createAiRunner, InboxFileSchema, type AiJob } from '../index'
import { runAiProjectOnce } from './index'
import {
  AI_PROJECT_DIR,
  FIXTURE_NAMES,
  OTHER_MODEL,
  PLANTED_INSTRUCTION,
  PLANTED_SIN,
  PLANTED_SIN_DIGITS,
  REPO_ROOT,
  SCHEMA_BREAKING_OUTPUT,
  VALID_OUTPUT,
  VALID_TEXT,
  callsFor,
  canonical,
  filesHolding,
  hashTree,
  inboxJob,
  inputHashOf,
  insideData,
  listTree,
  makeWorld,
  markerOf,
  outboxOf,
  outsideData,
  readJson,
  ordersVersionNow,
  stampFromJob,
  tripleOf,
  watchNames,
  writeApproved,
  type FakeCall,
  type FixtureName,
  type Json,
  type World,
} from './__fixtures__/harness'

const SLOW = { timeout: 60_000 }

let worlds: World[] = []
afterEach(() => {
  for (const w of worlds) w.cleanup()
  worlds = []
})

function world(...args: Parameters<typeof makeWorld>): World {
  const w = makeWorld(...args)
  worlds.push(w)
  return w
}

interface Run {
  result: { ok: boolean; reason?: string }
  lines: string[]
}

async function runOnce(w: World, extra: { argv?: string[]; env?: Record<string, string | undefined>; approvedPath?: string } = {}): Promise<Run> {
  const lines: string[] = []
  const result = (await runAiProjectOnce({
    argv: extra.argv ?? [],
    env: extra.env ?? w.env,
    approvedPath: extra.approvedPath ?? w.approvedPath,
    sink: (line: string) => {
      lines.push(line)
    },
  })) as { ok: boolean; reason?: string }
  return { result, lines }
}

/** `npm run ai:once` as a person runs it; the environment holds only what the test gives. */
function cli(env: Record<string, string | undefined>, args: string[] = []): { status: number | null; out: string; error: Error | undefined } {
  const win = process.platform === 'win32'
  const base: Record<string, string | undefined> = {
    ComSpec: process.env['ComSpec'],
    PATHEXT: process.env['PATHEXT'],
    APPDATA: process.env['APPDATA'],
    USERPROFILE: process.env['USERPROFILE'],
  }
  const r = spawnSync(win ? 'npm.cmd' : 'npm', ['run', '--silent', 'ai:once', ...(args.length > 0 ? ['--', ...args] : [])], {
    cwd: REPO_ROOT,
    env: { ...base, ...env } as NodeJS.ProcessEnv,
    encoding: 'utf8',
    timeout: 45_000,
    shell: win,
  })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, error: r.error }
}

const outboxNames = (w: World): string[] => (fs.existsSync(w.outbox) ? fs.readdirSync(w.outbox).sort() : [])
const refusalOf = (w: World, stem: string): { reason: string; problems: string[] } => {
  const file = outboxOf(w, stem)
  expect(file, `${stem} should be a refusal`).toHaveProperty('refusal')
  expect(file).not.toHaveProperty('output')
  expect(file).not.toHaveProperty('stamp')
  return file['refusal'] as { reason: string; problems: string[] }
}
const golden = (file: Json): string => JSON.stringify(canonical(file), null, 2) + '\n'
const stampOf = (j: Json, modelId?: string): Json => stampFromJob(j, modelId)
const isInside = (child: string, parent: string): boolean => {
  const rel = path.relative(fs.realpathSync(parent), fs.realpathSync(child))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}
/** The prompt texts a call received: every argument except the system prompt's value, and stdin. */
function promptTexts(call: FakeCall): string[] {
  const out: string[] = []
  for (let i = 0; i < call.argv.length; i++) {
    const a = call.argv[i] ?? ''
    if (a === '--system-prompt' || a === '--system-prompt-file') {
      i++
      continue
    }
    if (a.startsWith('--system-prompt=') || a.startsWith('--system-prompt-file=')) continue
    out.push(a)
  }
  if (call.stdin.trim() !== '') out.push(call.stdin)
  return out
}
const ORDERS = (): string => fs.readFileSync(path.join(AI_PROJECT_DIR, 'ORDERS.md'), 'utf8')
const SETTINGS_TEXT = (): string => fs.readFileSync(path.join(AI_PROJECT_DIR, 'settings.json'), 'utf8')

/** Writes an extra inbox job built from a fixture, with its input hash recomputed. */
function addJob(w: World, stem: string, from: FixtureName, change: (j: Json) => void): Json {
  const j = inboxJob(from)
  change(j)
  j['inputHash'] = inputHashOf(j['inputs'])
  fs.writeFileSync(path.join(w.inbox, `${stem}.json`), JSON.stringify(j, null, 2) + '\n')
  return j
}
const withText = (text: string, variant: string) => (j: Json): void => {
  const inputs = j['inputs'] as { documents: { text: string }[]; variant: string }
  const doc = inputs.documents[0]
  if (doc) doc.text = text
  inputs.variant = variant
  j['jobId'] = variant
}

/** The expected outcome of each fixture after one run with the fixture answers. */
const EXPECTED: Record<FixtureName, { answered: true } | { reason: RegExp }> = {
  'c01-clean': { answered: true },
  'c01-injected': { answered: true },
  'c01-unredacted': { reason: /^inputs not redacted \(AI-9\)$/ },
  'c01-planted-sin': { reason: /AI-9/ },
  'c01-dob': { reason: /AI-9/ },
  'c01-bank': { reason: /AI-9/ },
  'c01-not-test': { reason: /SEC-11/ },
  'c01-unapproved': { reason: /not approved/ },
  'dotdot-escape': { reason: /job id/i },
  'c01-answer-not-json': { reason: /AI-1/ },
  'c01-answer-schema': { reason: /AI-1/ },
  'c01-answer-other-model': { reason: /model id/i },
  'c01-answer-no-model': { reason: /model id/i },
}
const PRE_CALL_REFUSED: FixtureName[] = ['c01-unredacted', 'c01-planted-sin', 'c01-dob', 'c01-bank', 'c01-not-test', 'c01-unapproved', 'dotdot-escape']

// ---------- ARC-22, AI-1: one pass, one outbox file per job ----------

describe('ARC-22 AI-1 one run answers the inbox once and stops', SLOW, () => {
  test('ARC-22 AI-1 one run over the fixture inbox writes exactly one outbox file per job, each its golden file or a refusal with the expected reason', async () => {
    const w = world()
    const { result } = await runOnce(w)
    expect(result).toEqual({ ok: true })
    expect(outboxNames(w)).toEqual(FIXTURE_NAMES.map((n) => `${n}.json`).sort())
    await expect(golden(outboxOf(w, 'c01-clean'))).toMatchFileSnapshot('./__golden__/outbox-c01-clean.json')
    await expect(golden(outboxOf(w, 'c01-unredacted'))).toMatchFileSnapshot('./__golden__/outbox-c01-unredacted.json')
    for (const name of FIXTURE_NAMES) {
      const want = EXPECTED[name]
      const file = outboxOf(w, name)
      if ('answered' in want) {
        expect(file, name).toEqual({ jobId: inboxJob(name)['jobId'], output: VALID_OUTPUT, stamp: stampOf(inboxJob(name)) })
      } else {
        expect(refusalOf(w, name).reason, name).toMatch(want.reason)
        if (name !== 'dotdot-escape') expect(file['jobId'], name).toBe(name)
      }
    }
  })

  test('ARC-22 the clean answer is F04-valid and its outbox file is exactly A04 outbox shape (jobId, output, stamp)', async () => {
    const w = world(['c01-clean'])
    await runOnce(w)
    const file = outboxOf(w, 'c01-clean')
    expect(Object.keys(file).sort()).toEqual(['jobId', 'output', 'stamp'])
    expect(validateAiOutput('finding', file['output'], file['stamp']).ok).toBe(true)
  })

  test('ARC-22 the fake is called once for each job that passes every check, in job id order, and never for the others', async () => {
    const w = world()
    await runOnce(w)
    const called = w.calls().map((c) => FIXTURE_NAMES.find((n) => [...c.argv, c.stdin].join('\n').includes(markerOf(n))))
    const expected = FIXTURE_NAMES.filter((n) => !PRE_CALL_REFUSED.includes(n)).sort((a, b) => String(inboxJob(a)['jobId']).localeCompare(String(inboxJob(b)['jobId'])))
    expect(called).toEqual(expected)
    for (const n of PRE_CALL_REFUSED) expect(callsFor(w, n), n).toHaveLength(0)
  })

  test('ARC-22 a run writes nothing outside outbox/ and the per-job folders: before-and-after listing of the exchange folder and of the repo', async () => {
    const w = world()
    const repoWatched = ['ai-project', path.join('src', 'modules', 'ai'), 'data']
    const repoBefore = repoWatched.map((d) => hashTree(path.join(REPO_ROOT, d)))
    const topBefore = fs.readdirSync(REPO_ROOT).sort()
    const inboxBefore = hashTree(w.inbox)
    const fakeBefore = listTree(w.fakeDir)
    await runOnce(w)
    expect(repoWatched.map((d) => hashTree(path.join(REPO_ROOT, d)))).toEqual(repoBefore)
    expect(fs.readdirSync(REPO_ROOT).sort()).toEqual(topBefore)
    expect(hashTree(w.inbox)).toEqual(inboxBefore)
    // the fake's own folder gains only its call log
    expect(listTree(w.fakeDir)).toEqual([...fakeBefore, 'fake-claude.calls.jsonl'].sort())
    expect(listTree(w.root).filter((f) => !f.startsWith('exchange/') && !f.startsWith('fake/'))).toEqual(['approved.json'])
    const jobFolders = w.calls().map((c) => path.relative(w.exchange, c.cwd).split(path.sep).join('/'))
    for (const f of jobFolders) {
      expect(f.startsWith('..') || path.isAbsolute(f) || f === '', f).toBe(false)
      expect(f === 'inbox' || f === 'outbox' || f.startsWith('inbox/') || f.startsWith('outbox/'), f).toBe(false)
    }
    const stray = listTree(w.exchange).filter(
      (f) => !f.startsWith('inbox/') && !f.startsWith('outbox/') && !jobFolders.some((d) => f.startsWith(`${d}/`)),
    )
    expect(stray).toEqual([])
    expect(listTree(w.outbox)).toEqual(FIXTURE_NAMES.map((n) => `${n}.json`).sort())
  })

  test('ARC-22 A420 outbox/ only ever holds result files: no temp file appears there during the run, not even one renamed away', async () => {
    const w = world()
    fs.mkdirSync(w.outbox, { recursive: true })
    const watch = watchNames(w.outbox)
    await runOnce(w)
    const seen = await watch.stop()
    const results = FIXTURE_NAMES.map((n) => `${n}.json`)
    // sentinel: the watcher saw the result files, so an empty list cannot pass
    expect(seen).toEqual(expect.arrayContaining(['c01-clean.json', 'c01-unredacted.json']))
    expect(seen.filter((n) => !results.includes(n))).toEqual([])
    expect(listTree(w.outbox)).toEqual([...results].sort())
  })

  test('ARC-22 A420 rule: the outbox watch catches a temp file written in outbox/ and renamed to the result', async () => {
    const w = world([])
    fs.mkdirSync(w.outbox, { recursive: true })
    const watch = watchNames(w.outbox)
    fs.writeFileSync(path.join(w.outbox, 'c01-clean.json.tmp-planted'), '{}')
    fs.renameSync(path.join(w.outbox, 'c01-clean.json.tmp-planted'), path.join(w.outbox, 'c01-clean.json'))
    const seen = await watch.stop()
    expect(seen).toContain('c01-clean.json.tmp-planted')
    expect(listTree(w.outbox)).toEqual(['c01-clean.json'])
  })

  test('ARC-22 a job that already has an outbox file is skipped: no call, and the file is left as it was', async () => {
    const w = world(['c01-clean', 'c01-injected'])
    fs.mkdirSync(w.outbox, { recursive: true })
    const earlier = JSON.stringify({ jobId: 'c01-clean', output: { earlier: 'answer (Test)' }, stamp: {} })
    fs.writeFileSync(path.join(w.outbox, 'c01-clean.json'), earlier)
    await runOnce(w)
    expect(fs.readFileSync(path.join(w.outbox, 'c01-clean.json'), 'utf8')).toBe(earlier)
    expect(callsFor(w, 'c01-clean')).toHaveLength(0)
    expect(callsFor(w, 'c01-injected')).toHaveLength(1)
  })

  test('ARC-22 a second run over the same folder calls nothing and changes nothing', async () => {
    const w = world()
    await runOnce(w)
    const callsAfterFirst = w.calls().length
    const before = hashTree(w.exchange)
    const { result } = await runOnce(w)
    expect(result).toEqual({ ok: true })
    expect(w.calls()).toHaveLength(callsAfterFirst)
    expect(hashTree(w.exchange)).toEqual(before)
  })

  test('ARC-22 npm run ai:once makes one pass over the fixture inbox and exits on its own (exit code 0), printing no planted SIN', () => {
    const w = world()
    // the shipped approved list holds no fixture triple, so every job is refused before any call
    const r = cli(w.env)
    expect(r.error).toBeUndefined()
    expect(r.status).toBe(0)
    expect(outboxNames(w)).toEqual(FIXTURE_NAMES.map((n) => `${n}.json`).sort())
    expect(refusalOf(w, 'c01-clean').reason).toMatch(/not approved/)
    expect(w.calls()).toHaveLength(0)
    expect(r.out).not.toContain(PLANTED_SIN)
    expect(r.out).not.toContain(PLANTED_SIN_DIGITS)
    // AI-10: the run log names the orders version on every run, even one where every job is refused
    expect(r.out).toContain(ordersVersionNow())
  })
})

// ---------- ARC-22, AI-10: A04's runner and this launcher together (unit twin of check 11's db test) ----------

/** An A04 AI job from an inbox fixture: the inbox file minus what A04's runner adds (jobId, schema, inputHash). */
function aiJobOf(name: FixtureName): AiJob {
  const j = inboxJob(name)
  delete j['jobId']
  delete j['schema']
  delete j['inputHash']
  return j as unknown as AiJob
}

async function within<T>(p: Promise<T>, ms: number, label: string): Promise<T | string> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      resolve(`timed out: ${label}`)
    }, ms)
  })
  try {
    return await Promise.race([p, late])
  } finally {
    clearTimeout(timer)
  }
}

describe('ARC-22 AI-10 A04 runner with the project engine and this launcher on one exchange folder', SLOW, () => {
  test("ARC-22 AI-10 A04's runner writes the clean job's inbox file, the launcher answers it, and the runner accepts the answer with its F04 stamp", async () => {
    const w = world([])
    const ai = createAiRunner({
      recordingsDir: path.join(w.root, 'no-recordings'),
      approvedPath: w.approvedPath,
      env: { AI_EXCHANGE_DIR: w.exchange },
      pollMs: 5,
      sink: () => undefined,
    })
    expect(ai.useEngine('project')).toEqual({ ok: true })
    const pending = ai.runAiStep(aiJobOf('c01-clean'), { jobId: 'c01-clean' })
    const until = Date.now() + 10_000
    while (!fs.existsSync(path.join(w.inbox, 'c01-clean.json')) && Date.now() < until) await new Promise((r) => setTimeout(r, 5))
    expect(InboxFileSchema.safeParse(readJson(path.join(w.inbox, 'c01-clean.json'))).success).toBe(true)
    expect(await runOnce(w)).toMatchObject({ result: { ok: true } })
    const got = await within(pending, 10_000, "A04's runner never accepted the launcher's outbox file")
    expect(got).toEqual({ ok: true, output: VALID_OUTPUT, stamp: stampOf(inboxJob('c01-clean')) })
    expect(w.calls()).toHaveLength(1)
  })

  test('ARC-22 AI-9 the unredacted job is refused by A04 with "inputs not redacted": no inbox file, no call, no outbox file', async () => {
    const w = world([])
    const ai = createAiRunner({
      recordingsDir: path.join(w.root, 'no-recordings'),
      approvedPath: w.approvedPath,
      env: { AI_EXCHANGE_DIR: w.exchange },
      pollMs: 5,
      sink: () => undefined,
    })
    expect(ai.useEngine('project')).toEqual({ ok: true })
    const got = await ai.runAiStep(aiJobOf('c01-unredacted'), { jobId: 'c01-unredacted' })
    expect(got).toMatchObject({ ok: false, reason: expect.stringMatching(/inputs not redacted/) as unknown })
    expect(await runOnce(w)).toMatchObject({ result: { ok: true } })
    expect(listTree(w.exchange).filter((f) => f.startsWith('inbox/') || f.startsWith('outbox/'))).toEqual([])
    expect(w.calls()).toEqual([])
  })

  test("ARC-22 every fixture but c01-unredacted is a valid A04 inbox file whose schema is F04's JSON Schema for its step today", () => {
    for (const name of FIXTURE_NAMES) {
      const j = inboxJob(name)
      expect(InboxFileSchema.safeParse(j).success, name).toBe(name !== 'c01-unredacted')
      expect(j['schema'], name).toEqual(z.toJSONSchema(aiStepSchemas.finding))
      expect(j['inputHash'], name).toBe(inputHashOf(j['inputs']))
    }
  })
})

// ---------- AI-9, SEC-5: nothing sensitive reaches the model ----------

describe('AI-9 SEC-5 unredacted or sensitive input is refused before any call', SLOW, () => {
  test('AI-9 the job with no redaction stamp is refused with "inputs not redacted (AI-9)" and the fake is never called for it', async () => {
    const w = world(['c01-unredacted', 'c01-clean'])
    await runOnce(w)
    expect(refusalOf(w, 'c01-unredacted')).toEqual({ reason: 'inputs not redacted (AI-9)', problems: [] })
    expect(callsFor(w, 'c01-unredacted')).toHaveLength(0)
    expect(callsFor(w, 'c01-clean')).toHaveLength(1)
  })

  test('AI-9 a redaction stamp with blank parts counts as no stamp', async () => {
    const w = world([])
    addJob(w, 'c01-blank-stamp', 'c01-clean', (j) => {
      withText('Aurora Card (Test) statement, meals total 1,850.00', 'c01-blank-stamp')(j)
      j['redaction'] = { redactedBy: ' ', redactorVersion: '' }
    })
    await runOnce(w)
    expect(refusalOf(w, 'c01-blank-stamp').reason).toMatch(/inputs not redacted/)
    expect(w.calls()).toHaveLength(0)
  })

  test('SEC-5 AI-9 the job holding a planted SIN that passes the check digit is refused; the SIN reaches no argument, no input, no log line and no file but its inbox file', async () => {
    const w = world(['c01-planted-sin', 'c01-clean'])
    const { lines } = await runOnce(w)
    const refusal = refusalOf(w, 'c01-planted-sin')
    expect(refusal.reason).toMatch(/AI-9/)
    expect(JSON.stringify(refusal)).not.toContain(PLANTED_SIN_DIGITS)
    expect(JSON.stringify(refusal)).not.toContain(PLANTED_SIN)
    expect(callsFor(w, 'c01-planted-sin')).toHaveLength(0)
    for (const c of w.calls()) {
      const all = JSON.stringify(c)
      expect(all).not.toContain(PLANTED_SIN)
      expect(all).not.toContain(PLANTED_SIN_DIGITS)
    }
    const log = lines.join('\n')
    expect(log).not.toContain(PLANTED_SIN)
    expect(log).not.toContain(PLANTED_SIN_DIGITS)
    expect(filesHolding(w.exchange, PLANTED_SIN)).toEqual(['inbox/c01-planted-sin.json'])
  })

  test.each([
    ['without separators', '729458133'],
    ['with dashes', '729-458-133'],
    ['with spaces', '729 458 133'],
  ])('SEC-5 AI-9 a SIN that passes the check digit is caught when written %s', async (_label, sin) => {
    const w = world([])
    addJob(w, 'c01-sin-variant', 'c01-clean', withText(`Payroll slip (Test), reference ${sin}`, 'c01-sin-variant'))
    const { lines } = await runOnce(w)
    expect(refusalOf(w, 'c01-sin-variant').reason).toMatch(/AI-9/)
    expect(w.calls()).toHaveLength(0)
    expect(lines.join('\n')).not.toContain(sin)
  })

  test('SEC-5 AI-9 a SIN in an input field (not document text) is caught too', async () => {
    const w = world([])
    addJob(w, 'c01-sin-field', 'c01-clean', (j) => {
      withText('Aurora Card (Test) statement, meals total 1,850.00', 'c01-sin-field')(j)
      ;(j['inputs'] as Json)['reference'] = PLANTED_SIN_DIGITS
    })
    await runOnce(w)
    expect(refusalOf(w, 'c01-sin-field').reason).toMatch(/AI-9/)
    expect(w.calls()).toHaveLength(0)
  })

  test('SEC-5 AI-9 no false alarm: a 9-digit number that fails the SIN check digit, in a clean job, is answered', async () => {
    const w = world([])
    // 729458134 differs from the planted SIN in the check digit only
    addJob(w, 'c01-not-a-sin', 'c01-clean', withText('Invoice (Test) number 729458134, meals total 1,850.00', 'c01-not-a-sin'))
    await runOnce(w)
    expect(outboxOf(w, 'c01-not-a-sin')).toHaveProperty('output')
    expect(w.calls()).toHaveLength(1)
  })

  test('SEC-5 AI-9 the job naming a date of birth and the job holding a bank account shape are refused before any call', async () => {
    const w = world(['c01-dob', 'c01-bank'])
    await runOnce(w)
    expect(refusalOf(w, 'c01-dob').reason).toMatch(/AI-9/)
    expect(refusalOf(w, 'c01-bank').reason).toMatch(/AI-9/)
    expect(w.calls()).toHaveLength(0)
  })

  test('SEC-5 AI-9 a date of birth named by a field key (dateOfBirth) is refused', async () => {
    const w = world([])
    addJob(w, 'c01-dob-field', 'c01-clean', (j) => {
      withText('Aurora Card (Test) statement, meals total 1,850.00', 'c01-dob-field')(j)
      ;(j['inputs'] as Json)['dateOfBirth'] = '1971-04-12'
    })
    await runOnce(w)
    expect(refusalOf(w, 'c01-dob-field').reason).toMatch(/AI-9/)
    expect(w.calls()).toHaveLength(0)
  })
})

// ---------- SEC-11: made-up returns only ----------

describe('SEC-11 before go-live the project answers only made-up returns', SLOW, () => {
  test('SEC-11 the is_test false job is refused with the reason and the fake is not called for it', async () => {
    const w = world(['c01-not-test', 'c01-clean'])
    await runOnce(w)
    expect(refusalOf(w, 'c01-not-test').reason).toMatch(/SEC-11/)
    expect(callsFor(w, 'c01-not-test')).toHaveLength(0)
    expect(callsFor(w, 'c01-clean')).toHaveLength(1)
  })

  test('SEC-11 a job with no is_test at all is refused the same way', async () => {
    const w = world([])
    addJob(w, 'c01-no-is-test', 'c01-clean', (j) => {
      withText('Aurora Card (Test) statement, meals total 1,850.00', 'c01-no-is-test')(j)
      delete j['isTest']
    })
    await runOnce(w)
    expect(refusalOf(w, 'c01-no-is-test').reason).toMatch(/SEC-11/)
    expect(w.calls()).toHaveLength(0)
  })
})

describe('ARC-22 the approved-triple gate is checked again by the launcher', SLOW, () => {
  test('ARC-22 a job whose (step type, prompt version, model id) is not approved is refused with "not approved" and no call', async () => {
    const w = world(['c01-unapproved'])
    await runOnce(w)
    expect(refusalOf(w, 'c01-unapproved').reason).toMatch(/not approved/)
    expect(w.calls()).toHaveLength(0)
  })

  test('ARC-22 the same job runs once its triple is on the list the launcher reads', async () => {
    const w = world(['c01-unapproved'])
    fs.writeFileSync(
      w.approvedPath,
      JSON.stringify({ triples: [{ stepType: 'finding', promptVersion: 'finding-unapproved-test', modelId: 'claude-opus-5-5' }] }),
    )
    await runOnce(w)
    expect(outboxOf(w, 'c01-unapproved')).toHaveProperty('output')
    expect(w.calls()).toHaveLength(1)
  })
})

// ---------- SEC-10: the job id grammar ----------

describe('SEC-10 a job id outside the grammar is refused and nothing escapes the outbox', SLOW, () => {
  test('SEC-10 the job id "../escape" is refused with the reason, no call is made and nothing is written outside the outbox', async () => {
    const w = world(['dotdot-escape'])
    const rootBefore = listTree(w.root)
    await runOnce(w)
    expect(refusalOf(w, 'dotdot-escape').reason).toMatch(/job id/i)
    expect(w.calls()).toHaveLength(0)
    expect(fs.existsSync(path.join(w.exchange, 'escape.json'))).toBe(false)
    expect(fs.existsSync(path.join(w.root, 'escape.json'))).toBe(false)
    expect(listTree(w.root).filter((f) => !rootBefore.includes(f))).toEqual(['exchange/outbox/dotdot-escape.json'])
  })

  test.each([
    ['a slash', 'c01/escape'],
    ['a backslash', '..\\escape'],
    ['a drive letter', 'C:escape'],
    ['an absolute path', '/tmp/escape'],
  ])('SEC-10 a job id with %s is refused and only its outbox refusal is written', async (_label, jobId) => {
    const w = world([])
    addJob(w, 'c01-bad-id', 'c01-clean', (j) => {
      withText('Aurora Card (Test) statement, meals total 1,850.00', 'c01-bad-id')(j)
      j['jobId'] = jobId
    })
    const rootBefore = listTree(w.root)
    await runOnce(w)
    expect(refusalOf(w, 'c01-bad-id').reason).toMatch(/job id/i)
    expect(w.calls()).toHaveLength(0)
    expect(listTree(w.root).filter((f) => !rootBefore.includes(f))).toEqual(['exchange/outbox/c01-bad-id.json'])
  })
})

// ---------- AI-1: the answer is one schema-valid JSON value, never repaired ----------

describe('AI-1 an answer that is not one JSON value, or breaks the schema, becomes a refusal', SLOW, () => {
  test('AI-1 the not-JSON answer becomes a refusal listing the problem; it is not stored as a result', async () => {
    const w = world(['c01-answer-not-json'])
    await runOnce(w)
    const r = refusalOf(w, 'c01-answer-not-json')
    expect(r.reason).toMatch(/AI-1/)
    expect(r.problems.length).toBeGreaterThan(0)
    expect(callsFor(w, 'c01-answer-not-json')).toHaveLength(1)
  })

  test("AI-1 the schema-breaking answer becomes a refusal listing F04's problems; it is not stored as a result", async () => {
    const w = world(['c01-answer-schema'])
    await runOnce(w)
    const r = refusalOf(w, 'c01-answer-schema')
    expect(r.reason).toMatch(/AI-1/)
    const f04 = validateAiOutput('finding', SCHEMA_BREAKING_OUTPUT, stampOf(inboxJob('c01-answer-schema')))
    expect(f04.ok).toBe(false)
    if (f04.ok) return
    expect(f04.problems.length).toBeGreaterThan(0)
    expect(r.problems).toEqual(expect.arrayContaining(f04.problems))
  })

  test.each([
    ['in a markdown fence', '```json\n' + VALID_TEXT + '\n```'],
    ['followed by prose', VALID_TEXT + '\nI hope this helps (Test).'],
    ['as two JSON values', VALID_TEXT + '\n' + VALID_TEXT],
    ['as a JSON array', `[${VALID_TEXT}]`],
  ])('AI-1 a valid finding %s is refused, never repaired', async (_label, text) => {
    const w = world(['c01-clean'], { rules: [], defaultResult: text })
    await runOnce(w)
    const r = refusalOf(w, 'c01-clean')
    expect(r.reason).toMatch(/AI-1/)
  })
})

// ---------- AI-10: the stamp ----------

describe('AI-10 every answer carries its versions', SLOW, () => {
  test('AI-10 a clean result carries every F04 stamp part copied from the job, the model id as the CLI reported it', async () => {
    const w = world(['c01-clean'])
    await runOnce(w)
    expect(outboxOf(w, 'c01-clean')['stamp']).toEqual(stampOf(inboxJob('c01-clean')))
  })

  test("AI-10 the clean result's stamp parses with F04's versionStampSchema and holds exactly its parts (no orders version, nothing extra)", async () => {
    const w = world(['c01-clean'])
    await runOnce(w)
    const stamp = outboxOf(w, 'c01-clean')['stamp'] as Json
    expect(versionStampSchema.safeParse(stamp).success).toBe(true)
    expect(Object.keys(stamp).sort()).toEqual(Object.keys(versionStampSchema.shape).sort())
    expect(stamp).not.toHaveProperty('ordersVersion')
    expect(JSON.stringify(outboxOf(w, 'c01-clean'))).not.toContain(ordersVersionNow())
  })

  // A426: one row per stamp part, from the contract's shape. Each row plants a fresh value for that part in the job
  // (approving the triple when the part is in it) and expects the outbox stamp to follow the job, not a constant.
  test.each(Object.keys(versionStampSchema.shape))('AI-10 the stamp part %s is copied from this job', async (part) => {
    const w = world([])
    const planted = `${part}-planted-a08-test`
    const job = addJob(w, 'c01-part', 'c01-clean', (j) => {
      withText(`Aurora Card (Test) statement, meals total 1,850.00 (${part})`, `a08-part-${part}`)(j)
      j['jobId'] = 'c01-part'
      if (part !== 'inputHash') j[part] = planted
    })
    writeApproved(w.approvedPath, [tripleOf(job)])
    await runOnce(w)
    const file = outboxOf(w, 'c01-part')
    expect(file, 'the job should be answered').toHaveProperty('stamp')
    const stamp = file['stamp'] as Json
    expect(stamp[part]).toBe(job[part])
    expect(stamp[part]).not.toBe(inboxJob('c01-clean')[part])
    expect(stamp).toEqual(stampOf(job))
  })

  test('AI-10 the run log carries the orders version: sha256 of the bytes of ORDERS.md then settings.json', async () => {
    const w = world(['c01-clean'])
    const { lines } = await runOnce(w)
    const ordersVersion = ordersVersionNow()
    expect(ordersVersion).toMatch(/^[0-9a-f]{64}$/)
    expect(lines.filter((l) => l.includes(ordersVersion)).length).toBeGreaterThan(0)
  })

  test('AI-10 the model id in the stamp is the one the CLI reports', async () => {
    const w = world(['c01-clean'], { rules: [{ match: 'a08-clean', result: VALID_TEXT, model: 'claude-opus-5-5' }], defaultResult: VALID_TEXT })
    await runOnce(w)
    expect((outboxOf(w, 'c01-clean')['stamp'] as Json)['modelId']).toBe('claude-opus-5-5')
  })

  test('AI-10 an answer reporting a different model id becomes a refusal naming both ids', async () => {
    const w = world(['c01-answer-other-model'])
    await runOnce(w)
    const r = refusalOf(w, 'c01-answer-other-model')
    expect(r.reason).toContain('claude-opus-5-5')
    expect(r.reason).toContain(OTHER_MODEL)
  })

  test('AI-10 an answer with no model id reported becomes a refusal', async () => {
    const w = world(['c01-answer-no-model'])
    await runOnce(w)
    expect(refusalOf(w, 'c01-answer-no-model').reason).toMatch(/model id/i)
  })
})

// ---------- AI-8: the project's permissions and the call ----------

const WRITING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch', 'Task', 'Agent']

/** Every problem with a Claude Code settings object for the project: allowed tools other than Read, missing denials, hooks, plugins, MCP. */
function settingsProblems(s: Json): string[] {
  const problems: string[] = []
  const perms = (s['permissions'] ?? {}) as { allow?: unknown; deny?: unknown; defaultMode?: unknown; additionalDirectories?: unknown }
  const allow = Array.isArray(perms.allow) ? (perms.allow as unknown[]).map(String) : []
  const deny = Array.isArray(perms.deny) ? (perms.deny as unknown[]).map(String) : []
  const tool = (rule: string): string => rule.replace(/\(.*$/s, '')
  for (const rule of allow) {
    if (tool(rule) !== 'Read') problems.push(`allowed: ${rule}`)
    const spec = /^Read\((.*)\)$/s.exec(rule)?.[1]
    if (spec !== undefined && (spec.startsWith('/') || spec.startsWith('~') || spec.includes('..') || /^[A-Za-z]:/.test(spec))) {
      problems.push(`Read reaches outside the job folder: ${rule}`)
    }
  }
  if (!allow.some((r) => tool(r) === 'Read')) problems.push('Read is not allowed')
  for (const t of WRITING_TOOLS) if (!deny.includes(t)) problems.push(`not denied: ${t}`)
  if (!deny.some((r) => r.startsWith('mcp__'))) problems.push('mcp__ tools are not denied')
  if (perms.defaultMode !== undefined && perms.defaultMode !== 'default' && perms.defaultMode !== 'plan') problems.push(`defaultMode: ${JSON.stringify(perms.defaultMode)}`)
  if (perms.additionalDirectories !== undefined && (perms.additionalDirectories as unknown[]).length > 0) problems.push('additionalDirectories')
  for (const k of ['hooks', 'enabledPlugins', 'plugins', 'mcpServers', 'enabledMcpjsonServers', 'extraKnownMarketplaces', 'apiKeyHelper']) {
    if (k in s) problems.push(`has ${k}`)
  }
  if (s['enableAllProjectMcpServers'] === true) problems.push('enableAllProjectMcpServers')
  return problems
}

describe("AI-8 the project's settings allow Read only", () => {
  test('AI-8 ai-project/settings.json allows Read only (in the job folder) and denies every writing, shell, web, agent and MCP tool, with no hooks, plugins or MCP servers', () => {
    const s = JSON.parse(SETTINGS_TEXT()) as Json
    expect(settingsProblems(s)).toEqual([])
  })

  test('AI-8 rule: planted settings that allow Write, allow Read of the repo, add a hook or skip permissions are each caught', () => {
    const good = JSON.parse(SETTINGS_TEXT()) as Json
    const perms = good['permissions'] as Json
    const planted: Json[] = [
      { ...good, permissions: { ...perms, allow: ['Read(./**)', 'Write(./**)'] } },
      { ...good, permissions: { ...perms, allow: ['Read(/home/**)'] } },
      { ...good, permissions: { ...perms, allow: ['Read(../**)'] } },
      { ...good, permissions: { ...perms, deny: (perms['deny'] as string[]).filter((d) => d !== 'Bash') } },
      { ...good, permissions: { ...perms, defaultMode: 'bypassPermissions' } },
      { ...good, hooks: { PreToolUse: [] } },
      { ...good, mcpServers: { x: {} } },
    ]
    for (const p of planted) expect(settingsProblems(p).length, JSON.stringify(p)).toBeGreaterThan(0)
  })
})

describe('AI-8 the call: the project settings, the orders, the job folder, no permission skipping', SLOW, () => {
  test("AI-8 the fake's recorded arguments show the project's settings file, the orders as the system prompt, print mode, JSON output, the job's model and no permission-skipping flag", async () => {
    const w = world(['c01-clean'])
    await runOnce(w)
    const [call] = w.calls()
    expect(call).toBeDefined()
    if (!call) return
    expect(call.argv.some((a) => a === '-p' || a === '--print')).toBe(true)
    expect(call.settingsText).not.toBeNull()
    expect(JSON.parse(call.settingsText ?? 'null')).toEqual(JSON.parse(SETTINGS_TEXT()))
    expect(call.systemPrompt?.trim()).toBe(ORDERS().trim())
    const flag = (name: string): string | undefined => {
      const i = call.argv.indexOf(name)
      return i >= 0 ? call.argv[i + 1] : call.argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1)
    }
    expect(flag('--output-format')).toBe('json')
    expect(flag('--model')).toBe('claude-opus-5-5')
    const joined = call.argv.join(' ')
    expect(joined).not.toMatch(/dangerously-skip-permissions/)
    expect(flag('--permission-mode') ?? 'default').not.toMatch(/bypassPermissions|acceptEdits/)
    expect(call.argv).not.toContain('--mcp-config')
    expect(call.argv).not.toContain('--plugin-dir')
    expect(call.envNames.filter((n) => /API_KEY|AUTH_TOKEN/i.test(n))).toEqual([])
  })

  test('AI-8 the call runs in a fresh per-job folder inside the exchange folder, outside the repo, holding this job inputs and no other job', async () => {
    const w = world(['c01-clean', 'c01-injected'])
    await runOnce(w)
    const calls = w.calls()
    expect(calls).toHaveLength(2)
    const cwds = calls.map((c) => c.cwd)
    expect(new Set(cwds).size).toBe(2)
    for (const c of calls) {
      expect(isInside(c.cwd, w.exchange), c.cwd).toBe(true)
      expect(isInside(c.cwd, REPO_ROOT), c.cwd).toBe(false)
      expect(fs.realpathSync(c.cwd)).not.toBe(fs.realpathSync(w.exchange))
      expect(isInside(c.cwd, w.inbox) || isInside(c.cwd, w.outbox), c.cwd).toBe(false)
      const mine = FIXTURE_NAMES.find((n) => [...c.argv, c.stdin].join('\n').includes(markerOf(n)))
      expect(mine).toBeDefined()
      const folderText = Object.values(c.cwdFiles).join('\n')
      expect(folderText).toContain(markerOf(mine as FixtureName))
      for (const other of ['c01-clean', 'c01-injected'] as const) {
        if (other !== mine) expect(folderText).not.toContain(markerOf(other))
      }
    }
  })

  test('AI-8 a leftover per-job folder from an earlier run is not reused: the folder is fresh', async () => {
    const w = world(['c01-clean'])
    await runOnce(w)
    const [first] = w.calls()
    if (!first) throw new Error('no call')
    fs.writeFileSync(path.join(first.cwd, 'leftover-planted.txt'), 'planted leftover (Test)')
    fs.rmSync(path.join(w.outbox, 'c01-clean.json'))
    await runOnce(w)
    const second = w.calls()[1]
    expect(second).toBeDefined()
    expect(Object.keys(second?.cwdFiles ?? {})).not.toContain('leftover-planted.txt')
  })
})

describe('AI-8 document text is data: a planted instruction has no effect', SLOW, () => {
  test('AI-8 for the planted-instruction job the fake receives the planted words only inside the data wrapper, never in the system prompt or the instructions part', async () => {
    const w = world(['c01-injected'])
    await runOnce(w)
    const [call] = w.calls()
    expect(call).toBeDefined()
    if (!call) return
    const planted = PLANTED_INSTRUCTION.toLowerCase()
    expect((call.systemPrompt ?? '').toLowerCase()).not.toContain(planted)
    const texts = promptTexts(call)
    for (const t of texts) {
      expect(outsideData(t).toLowerCase(), 'instructions part').not.toContain(planted)
      // the planted "</data>" and "<data ...>" cannot open or close a wrapper
      expect((t.match(/<data\b/g) ?? []).length).toBe((t.match(/<\/data>/g) ?? []).length)
    }
    expect(texts.flatMap(insideData).some((d) => d.toLowerCase().includes(planted))).toBe(true)
  })

  test('AI-8 the planted-instruction job ends like any clean job: the plain answer, its stamp, nothing else written', async () => {
    const w = world(['c01-injected'])
    await runOnce(w)
    expect(outboxOf(w, 'c01-injected')).toEqual({ jobId: 'c01-injected', output: VALID_OUTPUT, stamp: stampOf(inboxJob('c01-injected')) })
    expect(listTree(w.outbox)).toEqual(['c01-injected.json'])
  })

  test('AI-8 the clean job prompt also carries its inputs inside the data wrapper', async () => {
    const w = world(['c01-clean'])
    await runOnce(w)
    const [call] = w.calls()
    if (!call) throw new Error('no call')
    const inside = promptTexts(call).flatMap(insideData).join('\n')
    expect(inside).toContain('a08-clean')
    expect(inside).toContain('txn-c01-bcd-0042')
    expect(promptTexts(call).map(outsideData).join('\n')).not.toContain('Aurora Card (Test) statement')
  })
})

// ---------- ARC-6, ARC-20, END-8: off by default, the fake as the live side, no key ----------

describe('ARC-6 ARC-20 END-8 the switch and the subscription', SLOW, () => {
  test('ARC-6 without AI_EXCHANGE_DIR the launcher refuses with "the Claude project is off" and calls nothing', async () => {
    const w = world(['c01-clean'])
    const env = { ...w.env }
    delete env['AI_EXCHANGE_DIR']
    const { result } = await runOnce(w, { env })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('the Claude project is off')
    expect(w.calls()).toHaveLength(0)
    expect(fs.existsSync(w.outbox)).toBe(false)
  })

  test('ARC-6 a blank AI_EXCHANGE_DIR is off too', async () => {
    const w = world(['c01-clean'])
    const { result } = await runOnce(w, { env: { ...w.env, AI_EXCHANGE_DIR: '  ' } })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('the Claude project is off')
  })

  test('ARC-20 with AI_EXCHANGE_DIR set it runs against the fake program named by AI_PROJECT_CLAUDE_BIN', async () => {
    const w = world(['c01-clean'])
    const { result } = await runOnce(w)
    expect(result).toEqual({ ok: true })
    expect(w.calls()).toHaveLength(1)
  })

  test.each(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY'])(
    'END-8 with %s set the launcher refuses to run and names the setting only, never its value',
    async (name) => {
      const w = world(['c01-clean'])
      const value = 'PLANTED-k-test-a08-not-a-key'
      const { result, lines } = await runOnce(w, { env: { ...w.env, [name]: value } })
      expect(result.ok).toBe(false)
      expect(result.reason).toContain(name)
      expect(`${result.reason ?? ''}\n${lines.join('\n')}`).not.toContain(value)
      expect(w.calls()).toHaveLength(0)
      expect(fs.existsSync(w.outbox)).toBe(false)
    },
  )

  test('END-8 npm run ai:once with ANTHROPIC_API_KEY set exits non-zero, prints the name and never the value', () => {
    const w = world(['c01-clean'])
    const value = 'PLANTED-k-test-a08-cli-not-a-key'
    const r = cli({ ...w.env, ANTHROPIC_API_KEY: value })
    expect(r.error).toBeUndefined()
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('ANTHROPIC_API_KEY')
    expect(r.out).not.toContain(value)
    expect(w.calls()).toHaveLength(0)
  })

  test('ARC-6 npm run ai:once without AI_EXCHANGE_DIR exits non-zero with "the Claude project is off"', () => {
    const w = world(['c01-clean'])
    const env = { ...w.env }
    delete env['AI_EXCHANGE_DIR']
    const r = cli(env)
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('the Claude project is off')
  })

  test.each([
    ['a folder inside the repo', ['tmp-a08-exchange-planted']],
    ['the repo root itself', []],
    ['a nested folder inside the repo', ['src', 'tmp-a08-exchange-planted']],
  ])('END-8 an exchange folder at %s is refused and not created', async (_label, parts) => {
    const w = world(['c01-clean'])
    const inside = path.join(REPO_ROOT, ...parts)
    const { result } = await runOnce(w, { env: { ...w.env, AI_EXCHANGE_DIR: inside } })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/repo/i)
    if (parts.length > 0) expect(fs.existsSync(inside)).toBe(false)
    expect(fs.existsSync(path.join(REPO_ROOT, 'inbox'))).toBe(false)
    expect(fs.existsSync(path.join(REPO_ROOT, 'outbox'))).toBe(false)
    expect(w.calls()).toHaveLength(0)
  })
})

// ---------- ARC-22, decision 0010: one-off runs only ----------

/** Lines that set up a timer, a watcher or a schedule. */
function timerProblems(text: string): string[] {
  const problems: string[] = []
  if (/\bsetInterval\s*\(/.test(text)) problems.push('setInterval')
  if (/\bwatch(?:File)?\s*\(/.test(text)) problems.push('fs.watch')
  if (/chokidar/.test(text)) problems.push('chokidar')
  if (/node-cron|node-schedule|\bcron\s*\./.test(text)) problems.push('a cron library')
  if (/(?:^|['"`\s])(?:[*\d/,-]+\s+){4}[*\d/,-]+(?:['"`\s]|$)/m.test(text) && /\*/.test(/(?:[*\d/,-]+\s+){4}[*\d/,-]+/.exec(text)?.[0] ?? '')) {
    problems.push('a cron string')
  }
  return problems
}

describe('ARC-22 decision 0010: started by hand, one pass, no timer', SLOW, () => {
  test.each([[['--watch']], [['--every', '5m']], [['--every=5m']], [['--loop']]])('ARC-22 ai:once %j is refused with the decision 0010 reason and does nothing', async (argv) => {
    const w = world(['c01-clean'])
    const { result } = await runOnce(w, { argv })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('decision 0010')
    expect(w.calls()).toHaveLength(0)
    expect(fs.existsSync(w.outbox)).toBe(false)
  })

  test('ARC-22 npm run ai:once -- --watch exits non-zero with the decision 0010 reason', () => {
    const w = world(['c01-clean'])
    const r = cli(w.env, ['--watch'])
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('decision 0010')
    expect(w.calls()).toHaveLength(0)
  })

  test('ARC-22 a job added to the inbox while the fake is answering is left for the next run, and the next run answers it', async () => {
    const w = world(['c01-clean'])
    const late = { ...inboxJob('c01-clean'), jobId: 'c01-late' }
    w.setControl({
      rules: [],
      defaultResult: VALID_TEXT,
      arrive: { match: 'a08-clean', file: path.join(w.inbox, 'c01-late.json'), text: JSON.stringify(late, null, 2) + '\n' },
    })
    await runOnce(w)
    expect(fs.existsSync(path.join(w.inbox, 'c01-late.json'))).toBe(true)
    expect(outboxNames(w)).toEqual(['c01-clean.json'])
    expect(w.calls()).toHaveLength(1)
    await runOnce(w)
    expect(outboxNames(w)).toEqual(['c01-clean.json', 'c01-late.json'])
    expect(outboxOf(w, 'c01-late')).toEqual({ jobId: 'c01-late', output: VALID_OUTPUT, stamp: stampOf(late) })
  })

  test('ARC-22 rule: planted sources with setInterval, fs.watch, chokidar and a cron string are each caught; a plain one-pass source is not', () => {
    expect(timerProblems('const t = setInterval(() => run(), 1000)')).toContain('setInterval')
    expect(timerProblems("fs.watch(inbox, () => run())")).toContain('fs.watch')
    expect(timerProblems("import chokidar from 'chokidar'")).toContain('chokidar')
    expect(timerProblems("schedule('*/5 * * * *', run)")).toContain('a cron string')
    expect(timerProblems('for (const id of ids.sort()) await answer(id)\nconst amount = 1 2')).toEqual([])
  })

  test('ARC-22 no file under src/modules/ai/project/ or ai-project/ uses setInterval, a cron string, fs.watch or chokidar', () => {
    const files: string[] = []
    const walk = (dir: string): void => {
      if (!fs.existsSync(dir)) return
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (!e.name.startsWith('__')) walk(p)
        } else if (/\.(?:ts|tsx|mjs|cjs|js|json)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p)
      }
    }
    walk(path.join(REPO_ROOT, 'src', 'modules', 'ai', 'project'))
    walk(AI_PROJECT_DIR)
    expect(files.some((f) => f.endsWith(path.join('project', 'index.ts')))).toBe(true)
    expect(files.some((f) => f.endsWith('settings.json'))).toBe(true)
    const found = files.flatMap((f) => timerProblems(readOwnSource(path.relative(process.cwd(), f))).map((p) => `${path.relative(REPO_ROOT, f)}: ${p}`))
    expect(found).toEqual([])
  })

  test('ARC-22 package.json has an ai:once script with no watch, every, loop or watcher program in it, and no other ai: script runs on a timer', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    const script = pkg.scripts['ai:once']
    expect(script).toBeDefined()
    for (const [name, body] of Object.entries(pkg.scripts).filter(([n]) => n.startsWith('ai:'))) {
      expect(body, name).not.toMatch(/--watch|--every|--loop|nodemon|chokidar|\bwatch\b|cron/)
    }
  })
})

// ---------- AI-8 and the rest of the orders: ORDERS.md ----------

const ORDERS_CLAUSES = ['AI-1', 'AI-4', 'AI-5', 'AI-6', 'AI-7', 'AI-8']

/** Clauses with no heading of their own, and any tax rule (an Income Tax Act reference or a GIFI code). */
function ordersProblems(text: string): string[] {
  const problems: string[] = []
  const headings = text.split('\n').filter((l) => /^#{1,6}\s/.test(l))
  for (const c of ORDERS_CLAUSES) {
    if (!headings.some((h) => new RegExp(`\\b${c}(?!\\d)`).test(h))) problems.push(`no heading for ${c}`)
  }
  if (/\bIncome Tax Act\b|\bITA\b|\bsubsection\b|\bparagraph\s+\d|\bs\.\s*\d+(?:\.\d+)?(?:\(\d+\))?/i.test(text)) problems.push('an Income Tax Act reference')
  if (/\bGIFI\b/i.test(text) || /\b(?!19\d\d\b|20\d\d\b)[1-9]\d{3}\b/.test(text)) problems.push('a GIFI code')
  return problems
}

describe('AI-8 the orders file: one section per rule, no tax rules', () => {
  test('AI-8 ORDERS.md has a section headed with each of AI-1, AI-4, AI-5, AI-6, AI-7 and AI-8, and holds no tax rule', () => {
    expect(ordersProblems(ORDERS())).toEqual([])
  })

  test('AI-8 rule: planted orders with a missing AI-6 heading, an Income Tax Act section or a GIFI code are each caught', () => {
    const good = ORDERS()
    expect(ordersProblems(good.replace(/^(#{1,6}\s.*)\bAI-6\b/m, '$1AI-x'))).toContain('no heading for AI-6')
    expect(ordersProblems(`${good}\nMeals are 50% deductible under ITA s. 67.1.\n`)).toContain('an Income Tax Act reference')
    expect(ordersProblems(`${good}\nMap meals to GIFI 8523.\n`)).toContain('a GIFI code')
    expect(ordersProblems(`${good}\nMap meals to 8523.\n`)).toContain('a GIFI code')
    expect(ordersProblems('# AI-10 only\n')).toContain('no heading for AI-1')
  })

  test('AI-8 the orders are not named CLAUDE.md, so no Claude Code session in this repo loads them', () => {
    expect(fs.existsSync(path.join(AI_PROJECT_DIR, 'ORDERS.md'))).toBe(true)
    expect(fs.existsSync(path.join(AI_PROJECT_DIR, 'CLAUDE.md'))).toBe(false)
    expect(fs.existsSync(path.join(AI_PROJECT_DIR, '.claude'))).toBe(false)
  })

  test('ARC-22 RUNNING.md names the one command, the exchange folder setting, what an outbox refusal means and the subscription', () => {
    const text = fs.readFileSync(path.join(AI_PROJECT_DIR, 'RUNNING.md'), 'utf8')
    expect(text).toContain('npm run ai:once')
    expect(text).toContain('AI_EXCHANGE_DIR')
    expect(text).toMatch(/refusal/i)
    expect(text).toMatch(/subscription/i)
  })
})
