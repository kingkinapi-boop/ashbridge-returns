// JH0 acceptance tests, check 4 (END-9). Spec-writer; builders never edit this file.
// expectedFor(client): figures `tb.adjusted.<account>` = debit - credit of each adjusted trial-balance row (cents),
// flags = the client's flag ids, exceptions = []. compare() checks what a step returned, and only that.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { loadClient } from '../index'
import { loadHarness, must } from './_api'

describe('JH0 expect.ts', () => {
  test('END-9 expectedFor C01 gives the adjusted trial balance in cents and the flag ids', async () => {
    const h = await loadHarness()
    const c = loadClient('C01')
    const e = h.expect.expectedFor(c)
    const rows = c.trialBalance.adjusted.rows
    expect(Object.keys(e.figures).length).toBe(rows.length)
    for (const r of rows) expect(e.figures[`tb.adjusted.${r.account}`]).toBe(r.debitCents - r.creditCents)
    expect(e.flags).toEqual(c.flags.map((f) => f.id))
    expect(e.exceptions).toEqual([])
  })

  test('END-9 a right answer has no differences, and a step may return only the figures it owns', async () => {
    const h = await loadHarness()
    const e = h.expect.expectedFor(loadClient('C01'))
    expect(h.expect.compare({ figures: { ...e.figures }, flags: [...e.flags] }, e)).toEqual([])
    const one = must(Object.keys(e.figures)[0])
    expect(h.expect.compare({ figures: { [one]: must(e.figures[one]) } }, e)).toEqual([])
    expect(h.expect.compare({}, e)).toEqual([])
  })

  test('END-9 a figure one cent off fails with the figure key, the expected and the actual cents', async () => {
    const h = await loadHarness()
    const e = h.expect.expectedFor(loadClient('C01'))
    const key = must(Object.keys(e.figures)[3])
    const want = must(e.figures[key])
    const d = h.expect.compare({ figures: { [key]: want - 1 } }, e)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ kind: 'figure', key, expected: want, actual: want - 1 })
    const text = h.expect.formatDifferences(d)
    expect(text).toContain(key)
    expect(text).toContain(String(want))
    expect(text).toContain(String(want - 1))
  })

  test('END-9 a figure the test world does not expect is a difference, never ignored', async () => {
    const h = await loadHarness()
    const e = h.expect.expectedFor(loadClient('C01'))
    const d = h.expect.compare({ figures: { 'tb.adjusted.9999': 5 } }, e)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ kind: 'figure', key: 'tb.adjusted.9999', actual: 5 })
    expect(d[0]?.expected).toBeUndefined()
  })

  test('END-9 a missing expected flag fails with its id; an unexpected flag fails too', async () => {
    const h = await loadHarness()
    const e = h.expect.expectedFor(loadClient('C01'))
    expect(e.flags.length).toBeGreaterThan(1)
    const missing = must(e.flags[0])
    const d = h.expect.compare({ flags: e.flags.slice(1) }, e)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ kind: 'flag', key: missing })
    expect(h.expect.formatDifferences(d)).toContain(missing)
    const extra = h.expect.compare({ flags: [...e.flags, 'F-planted-extra'] }, e)
    expect(extra).toHaveLength(1)
    expect(extra[0]).toMatchObject({ kind: 'flag', key: 'F-planted-extra' })
  })

  test('END-9 a missing or unexpected exception is a difference with its id', async () => {
    const h = await loadHarness()
    const e = { figures: {}, flags: [], exceptions: ['X-1'] }
    expect(h.expect.compare({ exceptions: [] }, e)).toMatchObject([{ kind: 'exception', key: 'X-1' }])
    expect(h.expect.compare({ exceptions: ['X-1', 'X-2'] }, e)).toMatchObject([{ kind: 'exception', key: 'X-2' }])
  })

  test('END-9 property: any single-cent change to any expected figure is caught, exactly once, and a copy is never a difference', async () => {
    const h = await loadHarness()
    const e = h.expect.expectedFor(loadClient('C01'))
    const keys = Object.keys(e.figures)
    fc.assert(
      fc.property(fc.integer({ min: 0, max: keys.length - 1 }), fc.constantFrom(-1, 1), fc.integer({ min: 1, max: 1_000_000 }), (i, sign, big) => {
        const key = must(keys[i])
        const base = must(e.figures[key])
        const delta = sign * big
        const d = h.expect.compare({ figures: { [key]: base + delta } }, e)
        return d.length === 1 && d[0]?.key === key && d[0].actual === base + delta && h.expect.compare({ figures: { [key]: base } }, e).length === 0
      }),
      { seed: 20261003, numRuns: 100 },
    )
  })

  test('END-9 a non-integer or non-finite figure is a difference (cents are safe integers)', async () => {
    const h = await loadHarness()
    const e = { figures: { a: 100 }, flags: [], exceptions: [] }
    for (const bad of [100.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
      expect(h.expect.compare({ figures: { a: bad } }, e).length, String(bad)).toBe(1)
    }
  })
})
