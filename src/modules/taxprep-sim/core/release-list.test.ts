import { describe, expect, test } from 'vitest'
import { defaultReleaseList } from './release-list'

describe('S00 release list unit', () => {
  const list = defaultReleaseList()

  test('RT-23 orders run from 1 with no gap, the 300 GIFI cells first', () => {
    expect(list.map((c) => c.order)).toEqual(list.map((_, i) => i + 1))
    expect(list).toHaveLength(308)
    expect(list.slice(0, 300).every((c) => c.kind === 'amount' && c.confirmed === true)).toBe(true)
    expect(list[0]?.description).toMatch(/^GIFI code \d+ - /)
  })

  // Retired by spec(S00) round 3: 'RT-13 the eight creation cells close the list, with their kinds and descriptions'
  // pinned invented descriptions and a local list of the eight cells (card items 14 and 15, findings wave 2 RC4).
})
