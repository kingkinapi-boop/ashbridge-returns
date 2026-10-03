// JH0 spec: the API the builder must export from e2e/_harness/* (spec-writer; builders never edit this file).
// The acceptance tests reach the harness through loadHarness(), whose import path is computed, so
// typecheck and lint stay green before the build exists; the types below are the contract.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Client, ClientId } from '../index'

export type Row = { isTest: boolean } & Record<string, unknown>
/** One entry per table the loader writes in schema `returns`; every row says whether it is a test row. */
export type HarnessRows = {
  returns: Row[]
  accounts: Row[]
  facts: Row[]
  adjusting_entries: Row[]
  entry_lines: Row[]
}
export type HarnessDb = { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>; exec(sql: string): Promise<unknown> }
export type LoadResult = { returnId: string; counts: Record<keyof HarnessRows, number> }

export type StepId = 'intake' | 'read' | 'books' | 'figures' | 'import-file' | 'simulator' | 'trace' | 'checks'
export type StepResult = { figures?: Record<string, number>; flags?: string[]; exceptions?: string[] }
export type StepContext = { db: HarnessDb; client: Client; clientId: ClientId; seed: number; now: Date }
export type StepModule = { default: { run(ctx: StepContext): StepResult | Promise<StepResult> } }

export type Expected = { figures: Record<string, number>; flags: string[]; exceptions: string[] }
export type Difference = { kind: 'figure' | 'flag' | 'exception'; key: string; expected?: number; actual?: number; message: string }

export type JourneyResult = {
  passed: boolean
  built: StepId[]
  notBuilt: StepId[]
  differences: Difference[]
  /** The text a failing journey prints: the not-built list and the difference list. */
  report: string
  /** What every built step returned, in step order, for the same-seed comparison. */
  results: Record<string, StepResult>
}

export type Harness = {
  load: {
    HarnessRefusal: new (...a: never[]) => Error & { reason: string }
    buildRows(client: Client): HarnessRows
    writeRows(db: HarnessDb, rows: HarnessRows, opts?: { databaseUrl?: string; testCloudHosts?: string[] }): Promise<LoadResult>
    loadIntoDb(db: HarnessDb, target: string, opts?: { databaseUrl?: string; testCloudHosts?: string[] }): Promise<LoadResult>
    checkDatabaseUrl(url: string | undefined, opts?: { testCloudHosts?: string[] }): { ok: true } | { ok: false; reason: string }
  }
  pipeline: {
    STEPS: readonly StepId[]
    registerSteps(stepsDir?: string): Promise<Record<StepId, StepModule | undefined>>
    runJourney(
      db: HarnessDb,
      target: string,
      opts?: { stepsDir?: string; requireAll?: boolean; seed?: number },
    ): Promise<JourneyResult>
  }
  expect: {
    expectedFor(client: Client): Expected
    compare(actual: StepResult, expected: Expected): Difference[]
    formatDifferences(d: Difference[]): string
  }
  kinds: {
    SAMPLE_CLIENTS: readonly ClientId[]
    requireAllFrom(env: Record<string, string | undefined>, argv: string[]): boolean
    planKindsRun(opts: {
      requireAll: boolean
      kinds?: { id: string; startsFrom: 'new' | ClientId[]; status: 'built' | 'not built' }[]
    }): { journeys: string[]; notBuilt: string[]; failures: string[]; message: string; passed: boolean }
  }
  fixtures: {
    PINNED: { timezone: string; locale: string; seed: number; now: string }
    harnessClock(): { now(): Date }
  }
}

/** A value the test has just shown to exist; throws (a test failure) when it does not. */
export function must<T>(v: T | undefined, what = 'value'): T {
  if (v === undefined) throw new Error(`expected ${what} to exist`)
  return v
}

const HERE = path.dirname(new URL(import.meta.url).pathname)
export const REPO = path.resolve(HERE, '..', '..')
const at = (f: string): string => pathToFileURL(path.join(REPO, 'e2e', '_harness', f)).href

export async function loadHarness(): Promise<Harness> {
  const [load, pipeline, expect, kinds, fixtures] = await Promise.all(
    ['load', 'pipeline', 'expect', 'kinds', 'fixtures'].map((f) => import(/* @vite-ignore */ at(`${f}.ts`)) as Promise<unknown>),
  )
  return { load, pipeline, expect, kinds, fixtures } as Harness
}
