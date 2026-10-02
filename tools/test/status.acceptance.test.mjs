// F08 check 7 (ARC-19): tools/status.mjs prints the picture of the build.
import { describe, expect, test, vi } from 'vitest'
import { makeWorld, runTool } from './_world.mjs'

vi.setConfig({ testTimeout: 60000 })

const card = (id, status) => ({ id, title: `t ${id}`, status, deps: [], paths: [] })

describe('ARC-19 status.mjs', () => {
  test('ARC-19 prints the counts per status from the fixture and exits 0', () => {
    const w = makeWorld({
      slices: { blueprint: 'v9', cards: [card('A', 'done'), card('B', 'done'), card('C', 'building'), card('D', 'carded'), card('E', 'todo'), card('F', 'parked')] },
      // CQ1 rule 4: the version is read from blueprint/README.md, not slices.json
      files: { 'plan/mode.json': JSON.stringify({ mode: 'normal' }), 'blueprint/README.md': '# Blueprint\n\nVersion v9, 1 Oct 2026.\n' },
    })
    const r = runTool(w, 'status.mjs')
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/mode normal \| blueprint v9/)
    expect(r.out).toMatch(/cards: done 2, in flight 1, carded 1, to write 1, parked 1 \(of 6\)/)
    expect(r.out).toMatch(/C building \| t C/)
  })

  test('ARC-19 a slices.json that does not parse exits non-zero with the file name in the message', () => {
    const w = makeWorld({ slices: '{ "cards": [ not json' })
    const r = runTool(w, 'status.mjs')
    expect(r.code).not.toBe(0)
    expect(`${r.out}\n${r.err}`).toMatch(/slices\.json/)
  })

  test('ARC-19 a missing slices.json exits non-zero with the file name in the message', () => {
    const w = makeWorld({})
    const r = runTool(w, 'status.mjs')
    expect(r.code).not.toBe(0)
    expect(`${r.out}\n${r.err}`).toMatch(/slices\.json/)
  })

  test('ARC-19 a wind-down time in the past is shown as passed', () => {
    const w = makeWorld({
      slices: { blueprint: 'v9', cards: [] },
      files: { 'plan/mode.json': JSON.stringify({ mode: 'wind-down', wind_down_at: '2026-10-01T00:00:00Z' }) },
    })
    expect(runTool(w, 'status.mjs').out).toMatch(/PASSED/)
  })
})
