// Builder unit tests: the hand-written fault catalogue pinned to a reviewed golden (ARC-8, A353).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { faults, type FaultEntry } from './faults'

const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__golden__', 'faults-catalogue.json'), 'utf8')) as FaultEntry[]

describe('ARC-8 the fault catalogue', () => {
  it('ARC-8 equals the reviewed golden, entry by entry and word for word', () => {
    expect(faults()).toEqual(golden)
  })

  it('ARC-8 holds 105 flag entries and the two roll waivers of C10', () => {
    const all = faults()
    expect(all).toHaveLength(107)
    expect(all.filter((f) => f.roll === undefined)).toHaveLength(105)
    expect(all.filter((f) => f.roll !== undefined).map((f) => [f.id, f.client, f.roll])).toEqual([
      ['C10-roll-CHQ-2025-03', 'C10', { account: 'CHQ', month: '2025-03' }],
      ['C10-roll-CHQ-2025-05', 'C10', { account: 'CHQ', month: '2025-05' }],
    ])
  })

  it('ARC-8 every flag entry names its own client and flag id', () => {
    for (const f of faults().filter((x) => x.roll === undefined)) {
      expect(f.flagId).toBe(f.id)
      expect(f.client).toBe(`C${f.id.slice(0, 2)}`)
      expect(f.expected).toMatch(new RegExp(`^flag ${f.id} \\(.+\\), (must fire|info): flag for a person; do not decide alone$`))
    }
  })

  it('ARC-8 returns a fresh array each call, so a caller cannot change the catalogue', () => {
    const a = faults()
    a.pop()
    a.length = 0
    expect(faults()).toHaveLength(107)
    expect(faults()).not.toBe(faults())
  })
})
