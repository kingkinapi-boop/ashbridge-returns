import { describe, expect, test } from 'vitest'
import { CREATION_CELLS, defaultReleaseList } from './release-list'

describe('S00 release list unit', () => {
  const list = defaultReleaseList()

  test('RT-23 orders run from 1 with no gap, the 300 GIFI cells first', () => {
    expect(list.map((c) => c.order)).toEqual(list.map((_, i) => i + 1))
    expect(list).toHaveLength(308)
    expect(list.slice(0, 300).every((c) => c.kind === 'amount' && c.confirmed === true)).toBe(true)
    expect(list[0]?.description).toMatch(/^GIFI code \d+ - /)
  })

  test('RT-13 the eight creation cells close the list, with their kinds and descriptions', () => {
    expect(list.slice(300).map((c) => [c.identifier, c.kind, c.description])).toEqual([
      ['IDENT.Ident120', 'date', 'Line 060 - Tax year start date'],
      ['IDENT.Ident121', 'date', 'Line 061 - Tax year-end'],
      ['IDENT.Ident311', 'text', "Corporation's name"],
      ['IDENT.Ident230', 'text', 'Line 990 - Language of correspondence'],
      ['IDENT.Ident451', 'text', 'CCH iFirm - Client code'],
      ['IDENT.Ident492', 'yesNo', 'Creation flag'],
      ['IFirm.ContactPartner', 'text', 'Partner'],
      ['IFirm.ContactID', 'text', 'Contact ID'],
    ])
    expect(CREATION_CELLS).toEqual(list.slice(300).map((c) => c.identifier))
  })
})
