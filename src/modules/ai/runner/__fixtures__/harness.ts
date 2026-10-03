// A04 test fixtures (spec-writer): the made-up C01 finding jobs, their recorded answers, temp
// folders, an approved-list writer and a fake Claude project that watches a temp exchange folder.
// All data is made up; names end in "(Test)".
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RUNNER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const RECORDINGS_DIR = path.join(RUNNER_DIR, '__recordings__')
export const REPO_ROOT = path.resolve(RUNNER_DIR, '..', '..', '..', '..')

export interface FixtureJob {
  stepType: 'finding'
  promptVersion: string
  promptHash: string
  modelId: string
  inputs: Record<string, unknown>
  redaction?: { redactedBy: string; redactorVersion: string }
  isTest: boolean
  ocrEngine: string
  ocrEngineVersion: string
  mappingRelease: string
}

export type JobName = 'good' | 'broken' | 'strayKey' | 'noModelId' | 'noPromptHash' | 'noInputHash' | 'injected'

export interface Recording {
  modelId: string
  promptHash: string
  inputHash: string
  output: Record<string, unknown>
  stamp: Record<string, string>
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8')) as unknown

/** A fresh deep copy of a fixture job, so no test can change another's. */
export function job(name: JobName): FixtureJob {
  const all = readJson(path.join(RUNNER_DIR, '__fixtures__', 'jobs.json')) as Record<JobName, FixtureJob>
  return all[name]
}

export function recording(name: string): Recording {
  return readJson(path.join(RECORDINGS_DIR, `${name}.json`)) as Recording
}

/** Keys sorted at every depth; arrays keep their order. */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, canonical(obj[k])]),
    )
  }
  return value
}

export const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex')

/** The input hash the card fixes: sha256 hex of the canonical JSON (sorted keys, no whitespace). */
export const expectedInputHash = (inputs: unknown): string => sha256(JSON.stringify(canonical(inputs)))

export function tempDir(label: string): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `a04-${label}-`))
  return { dir, cleanup: () => { fs.rmSync(dir, { recursive: true, force: true }) } }
}

export interface Triple {
  stepType: string
  promptVersion: string
  modelId: string
}

/** Writes an approved list (the shape of data/ai/approved.json) and returns its path. */
export function writeApproved(dir: string, triples: readonly object[], name = 'approved.json'): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, JSON.stringify({ triples }, null, 2) + '\n')
  return file
}

export const tripleOf = (j: FixtureJob): Triple => ({ stepType: j.stepType, promptVersion: j.promptVersion, modelId: j.modelId })

/** Lists a folder's files, or none when it does not exist. */
export function filesIn(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
}

/** Writes an outbox file in one step (written beside the outbox, then renamed in), so no reader sees half a file. */
export function writeOutbox(exchange: string, name: string, content: string): void {
  const outbox = path.join(exchange, 'outbox')
  fs.mkdirSync(outbox, { recursive: true })
  const staging = path.join(exchange, `.staging-${name}`)
  fs.writeFileSync(staging, content)
  fs.renameSync(staging, path.join(outbox, name))
}

export interface InboxSeen {
  file: string
  text: string
  json: Record<string, unknown>
  /** How many files the inbox held when this one was seen. */
  inboxCount: number
}

/**
 * The fake Claude project: polls `<exchange>/inbox` and calls `respond` once for each new file,
 * in the order seen. `respond` writes whatever outbox files the test wants (writeOutbox).
 */
export function startFakeProject(
  exchange: string,
  respond: (seen: InboxSeen) => void | Promise<void>,
  pollMs = 5,
): { seen: InboxSeen[]; stop: () => void } {
  const inbox = path.join(exchange, 'inbox')
  const handled = new Set<string>()
  const seen: InboxSeen[] = []
  let busy = false
  const timer = setInterval(() => {
    if (busy) return
    busy = true
    void (async () => {
      try {
        const names = filesIn(inbox).filter((n) => n.endsWith('.json'))
        for (const file of names) {
          if (handled.has(file)) continue
          let text: string
          let json: Record<string, unknown>
          try {
            text = fs.readFileSync(path.join(inbox, file), 'utf8')
            json = JSON.parse(text) as Record<string, unknown>
          } catch {
            continue // half written: try again on the next poll
          }
          handled.add(file)
          const s = { file, text, json, inboxCount: names.length }
          seen.push(s)
          await respond(s)
        }
      } finally {
        busy = false
      }
    })()
  }, pollMs)
  return { seen, stop: () => { clearInterval(timer) } }
}

/** Waits (real time) until `check` is true; fails with `label` after `ms`. */
export async function waitFor(check: () => boolean, label: string, ms = 4000): Promise<void> {
  const until = Date.now() + ms
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 5))
  }
}

/** A log sink that keeps every line. */
export function collectLines(): { lines: string[]; sink: (line: string) => void } {
  const lines: string[] = []
  return { lines, sink: (line) => { lines.push(line) } }
}

/** The outbox file the fake project writes: one JSON result for one job. */
export function outboxResult(jobId: string, output: unknown, stamp: unknown): string {
  return JSON.stringify({ jobId, output, stamp }, null, 2) + '\n'
}
