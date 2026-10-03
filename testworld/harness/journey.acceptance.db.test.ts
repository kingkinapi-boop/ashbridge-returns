// JH0 acceptance tests, checks 3 and 5 (END-9, ARC-16). Spec-writer; builders never edit this file.
// Step files live one per file in a steps folder as `<step>.ts` with a default export { run(ctx) }; the register finds
// them by glob. The tests point the register at fixture folders (steps-empty, steps-right, steps-wrong).
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { cloneTestDb } from '../../src/core/db'
import { loadClient } from '../index'
import { loadHarness, must, REPO, type HarnessDb } from './_api'

const dir = (n: string): string => path.join(REPO, 'testworld', 'harness', '__fixtures__', n)
const ALL = ['intake', 'read', 'books', 'figures', 'import-file', 'simulator', 'trace', 'checks']

describe('JH0 pipeline register and journey', () => {
  test('END-9 the register knows the eight steps in order and the real steps folder is e2e/steps', async () => {
    const h = await loadHarness()
    expect([...h.pipeline.STEPS]).toEqual(ALL)
    const found = await h.pipeline.registerSteps(dir('steps-empty'))
    expect(Object.keys(found)).toEqual(ALL)
    expect(Object.values(found).every((m) => m === undefined)).toBe(true)
  })

  test('END-9 the register finds a step by its file name alone and no other step', async () => {
    const h = await loadHarness()
    const found = await h.pipeline.registerSteps(dir('steps-right'))
    expect(found.figures).toBeDefined()
    expect(Object.entries(found).filter(([, m]) => m !== undefined).map(([k]) => k)).toEqual(['figures'])
  })

  test('END-9 with no step files every step is "not built"; without --require-all the journey passes on the load alone and lists them', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const r = await h.pipeline.runJourney(db, 'C01', { stepsDir: dir('steps-empty') })
    expect(r.passed).toBe(true)
    expect(r.built).toEqual([])
    expect(r.notBuilt).toEqual(ALL)
    for (const s of ALL) expect(r.report).toContain(s)
    expect(r.report).toMatch(/not built/i)
    expect(r.differences).toEqual([])
  })

  test('END-9 with --require-all the same journey fails and the report lists every not-built step', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const r = await h.pipeline.runJourney(db, 'C01', { stepsDir: dir('steps-empty'), requireAll: true })
    expect(r.passed).toBe(false)
    expect(r.notBuilt).toEqual(ALL)
    for (const s of ALL) expect(r.report).toContain(s)
  })

  test('END-9 a stub step that returns the expected figures passes; the other seven stay "not built" and are never a pass', async () => {
    const h = await loadHarness()
    const db = (await cloneTestDb()) as unknown as HarnessDb
    const r = await h.pipeline.runJourney(db, 'C01', { stepsDir: dir('steps-right') })
    expect(r.passed).toBe(true)
    expect(r.built).toEqual(['figures'])
    expect(r.notBuilt).toEqual(ALL.filter((s) => s !== 'figures'))
    expect(Object.keys(r.results.figures?.figures ?? {}).length).toBe(loadClient('C01').trialBalance.adjusted.rows.length)
    const strict = await h.pipeline.runJourney(await freshDb(), 'C01', { stepsDir: dir('steps-right'), requireAll: true })
    expect(strict.passed).toBe(false)
  })

  test('END-9 a stub step that is one cent off fails the journey with and without the flag, naming the figure and both cents', async () => {
    const h = await loadHarness()
    const c = loadClient('C01')
    for (const requireAll of [false, true]) {
      const r = await h.pipeline.runJourney(await freshDb(), 'C01', { stepsDir: dir('steps-wrong'), requireAll })
      expect(r.passed, requireAll ? 'with the flag' : 'without the flag').toBe(false)
      expect(r.differences.length).toBe(1)
      const d = must(r.differences[0])
      const first = must(c.trialBalance.adjusted.rows[0])
      expect(d.kind).toBe('figure')
      expect(d.key).toBe(`tb.adjusted.${first.account}`)
      expect(d.expected).toBe(first.debitCents - first.creditCents)
      expect(d.actual).toBe(first.debitCents - first.creditCents + 1)
      expect(r.report).toContain(d.key)
    }
  })

  test('END-9 a journey for a client the loader refuses fails and runs no step', async () => {
    const h = await loadHarness()
    await expect(h.pipeline.runJourney(await freshDb(), 'C99', { stepsDir: dir('steps-right') })).rejects.toThrow(/C99/)
  })

  test('ARC-16 two journeys on the same client with the same seed give identical results; a pinned clock reaches every step', async () => {
    const h = await loadHarness()
    const a = await h.pipeline.runJourney(await freshDb(), 'C01', { stepsDir: dir('steps-right'), seed: 7 })
    const b = await h.pipeline.runJourney(await freshDb(), 'C01', { stepsDir: dir('steps-right'), seed: 7 })
    expect(a).toEqual(b)
    expect(h.fixtures.harnessClock().now().toISOString()).toBe(new Date(h.fixtures.PINNED.now).toISOString())
    expect(h.fixtures.harnessClock().now().getTime()).toBe(h.fixtures.harnessClock().now().getTime())
  })
})

async function freshDb(): Promise<HarnessDb> {
  return await cloneTestDb()
}
