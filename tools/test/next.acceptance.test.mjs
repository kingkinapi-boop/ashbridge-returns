// F08 checks 2 and 3 (ARC-19): tools/next.mjs decides which cards may start.
import { describe, expect, test, vi } from 'vitest'
import { makeWorld, runTool } from './_world.mjs'

vi.setConfig({ testTimeout: 60000 })

const card = (id, status, extra = {}) => ({ id, title: `t ${id}`, status, spec: null, deps: [], paths: [`src/${id.toLowerCase()}/**`], ...extra })
const starts = (out) => [...out.matchAll(/^START (\S+)/gm)].map((m) => m[1])
const run = (cards, slots) => runTool(makeWorld({ slices: { blueprint: 'x', cards } }), 'next.mjs', slots === undefined ? [] : [String(slots)])

describe('ARC-19 next.mjs', () => {
  test('ARC-19 picks only carded cards whose dependencies are all done', () => {
    const r = run(
      [
        card('D1', 'done'),
        card('D2', 'building'),
        card('OK', 'carded', { deps: ['D1'] }),
        card('WAIT', 'carded', { deps: ['D1', 'D2'] }),
        card('TODO', 'todo'),
        card('FINISHED', 'done'),
      ],
      10,
    )
    expect(r.code).toBe(0)
    expect(starts(r.out)).toEqual(['OK'])
  })

  test('ARC-19 never picks two cards with overlapping paths in one run', () => {
    const r = run(
      [card('A', 'carded', { paths: ['src/x/**'] }), card('B', 'carded', { paths: ['src/x/y.ts'] }), card('C', 'carded', { paths: ['src/z/**'] })],
      10,
    )
    expect(starts(r.out)).toEqual(['A', 'C'])
    expect(r.out).toMatch(/waiting on paths in use: B\b/)
  })

  test('ARC-19 skips a card whose paths overlap an in-flight card and names it as blocked by paths', () => {
    const r = run(
      [card('FLY', 'building', { paths: ['src/q/**'] }), card('BLOCKED', 'carded', { paths: ['src/q/a.ts'] }), card('FREE', 'carded', { paths: ['src/r/**'] })],
      10,
    )
    expect(starts(r.out)).toEqual(['FREE'])
    expect(r.out).toMatch(/waiting on paths in use: BLOCKED\b/)
  })

  test('ARC-19 every in-flight status holds its paths', () => {
    for (const s of ['speccing', 'building', 'checking', 'merging']) {
      const r = run([card('FLY', s, { paths: ['src/q/**'] }), card('NEXT', 'carded', { paths: ['src/q/a.ts'] })], 10)
      expect(starts(r.out), s).toEqual([])
    }
  })

  test('ARC-19 never returns more than the slot count', () => {
    const cards = ['A', 'B', 'C', 'D', 'E'].map((id) => card(id, 'carded'))
    expect(starts(run(cards, 2).out)).toEqual(['A', 'B'])
    expect(starts(run(cards, 0).out)).toEqual([])
    expect(starts(run(cards).out)).toHaveLength(3)
  })

  test('ARC-19 the output is the same for the same input', () => {
    const cards = ['A', 'B', 'C', 'D'].map((id) => card(id, 'carded'))
    expect(run(cards, 3).out).toBe(run(cards, 3).out)
  })

  test('ARC-19 a card that depends on a parked card is not picked', () => {
    const r = run([card('P', 'parked'), card('DEP', 'carded', { deps: ['P'] }), card('OTHER', 'carded')], 10)
    expect(starts(r.out)).toEqual(['OTHER'])
  })

  test('ARC-19 a card that depends on an unknown card is not picked', () => {
    const r = run([card('DEP', 'carded', { deps: ['NOPE'] })], 10)
    expect(starts(r.out)).toEqual([])
  })

  test('ARC-19 a card with no spec is printed as NEEDS SPEC FIRST', () => {
    const r = run([card('A', 'carded', { spec: null }), card('B', 'carded', { spec: 'abc123' })], 10)
    expect(r.out).toMatch(/START A .*NEEDS SPEC FIRST/)
    expect(r.out).toMatch(/START B .*spec abc123/)
  })
})
