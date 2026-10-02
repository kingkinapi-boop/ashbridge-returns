import { describe, expect, test } from 'vitest'
import {
  CCA,
  CLASS_CELL,
  CLAIMED_CELL,
  GIFI_CASH,
  YES_NO,
  extendedList,
  fixtureList,
  fromText,
  makeReturn,
  makeSim,
} from './__fixtures__/harness'
import { createSimulator, DEFAULT_RELEASE_NAME } from './sim'

const HEAD = '[X (Test)|0|0|00000000-0000-0000-0000-000000000000],"Current Year","Last Year",""\r\n'
const raw = (rows: string[]) => fromText(HEAD + rows.join('\r\n') + '\r\n')
const input = {
  businessNumber: '1',
  yearEnd: '2025-12-31',
  returnName: 'A (Test)',
  corporationName: 'A',
  clientCode: 'C1',
}
const REPLACED = 'The value of this cell has been replaced by a new imported value.'

function must(made: ReturnType<typeof makeReturn>, rows: string[]) {
  const r = made.sim.importCsv(made.ret, raw(rows))
  if (!r.ok) throw new Error('import refused')
  return r.report
}

describe('S00 simulator unit', () => {
  test('ARC-14 default guids are numbered, one per return, in order', () => {
    const sim = createSimulator()
    expect(sim.createReturn(input).guid).toBe('00000000-0000-4000-8000-000000000001')
    expect(sim.createReturn({ ...input, businessNumber: '2' }).guid).toBe('00000000-0000-4000-8000-000000000002')
  })

  test('RT-23 the same business number and year end gives the same return; getReturn finds it', () => {
    const sim = createSimulator()
    const a = sim.createReturn(input)
    expect(sim.createReturn(input)).toBe(a)
    expect(sim.getReturn('1', '2025-12-31')).toBe(a)
    expect(sim.getReturn('1', '2024-12-31')).toBeUndefined()
  })

  test('RT-23 the release name is the default or the one given', () => {
    expect(DEFAULT_RELEASE_NAME).toBe('CCH iFirm 2026.20.198267')
    expect(createSimulator().createReturn(input).releaseName).toBe(DEFAULT_RELEASE_NAME)
    expect(createSimulator({ releaseName: 'R1' }).createReturn(input).releaseName).toBe('R1')
  })

  test("RT-23 rows export in the list's order field, and the caller's list is left alone", () => {
    const list = [
      {
        identifier: 'GFGBA.Ttwgba72',
        description: 'B',
        kind: 'amount' as const,
        order: 2,
      },
      {
        identifier: 'GFGBA.Ttwgba64',
        description: 'A',
        kind: 'amount' as const,
        order: 1,
      },
      {
        identifier: 'GFGBA.Ttwgba127',
        description: 'C',
        kind: 'amount' as const,
        order: 3,
      },
    ]
    const sim = createSimulator({ releaseList: list })
    const ret = sim.createReturn(input)
    sim.typeCell(ret, 'GFGBA.Ttwgba127', '3')
    sim.typeCell(ret, 'GFGBA.Ttwgba72', '2')
    sim.typeCell(ret, 'GFGBA.Ttwgba64', '1')
    const ids = Buffer.from(sim.exportCsv(ret, 'entered'))
      .toString('latin1')
      .split('\r\n')
      .slice(1)
      .map((l) => l.split(',')[0])
    expect(ids.slice(0, 3)).toEqual(['GFGBA.Ttwgba64', 'GFGBA.Ttwgba72', 'GFGBA.Ttwgba127'])
    expect(list.map((c) => c.order)).toEqual([2, 1, 3])
  })

  test('ARC-6 a release list with a bad identifier throws its reason on export', () => {
    const sim = createSimulator({
      releaseList: [{ identifier: 'bad', description: '', kind: 'text', order: 1 }],
    })
    const ret = sim.createReturn(input)
    expect(() => sim.exportCsv(ret, 'all-input')).toThrow(/identifier "bad" is refused/)
  })

  test('RT-23 a return from another simulator is refused with a plain sentence', () => {
    const ret = createSimulator().createReturn(input)
    expect(() => createSimulator().exportCsv(ret, 'entered')).toThrow('this return belongs to another simulator')
  })

  test('RT-1 a file F03 refuses changes nothing and returns its faults', () => {
    const made = makeReturn()
    const before = made.sim.exportCsv(made.ret, 'entered')
    const r = made.sim.importCsv(made.ret, fromText('not a taxprep file'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.faults.length).toBeGreaterThan(0)
    expect(Buffer.from(made.sim.exportCsv(made.ret, 'entered')).equals(Buffer.from(before))).toBe(true)
  })

  test('RT-7 a gap copy index changes nothing and leaves no event; a clear on the next copy is silent', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    const report = must(made, [`${CLASS_CELL(3)},"8","",""`, `${CLASS_CELL(2)},"","",""`])
    expect(report.lines.map((l) => l.result)).toEqual(['Cell not available.'])
    expect(made.sim.copyCount(made.ret, CCA)).toBe(1)
    expect(made.sim.events(made.ret)).toEqual([])
    expect(report.lines[0]).toEqual({
      form: '--',
      description: '--',
      box: '--',
      result: 'Cell not available.',
    })
  })

  test('RT-12 a yes or no clear gives the full "replaced" line and an N event', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.typeCell(made.ret, YES_NO, 'Y')
    const report = must(made, [`${YES_NO},"","",""`])
    expect(report.lines).toEqual([
      {
        form: '--',
        description: 'Line 070 - Test yes or no',
        box: '--',
        result: REPLACED,
      },
    ])
    expect(made.sim.events(made.ret).at(-1)).toEqual({
      identifier: YES_NO,
      source: 'import',
      value: 'N',
    })
  })

  test('RT-12 a clear of a cell that holds nothing is silent', () => {
    const made = makeReturn({ list: extendedList() })
    expect(must(made, [`${YES_NO},"","",""`, `${GIFI_CASH},"","",""`])).toEqual({
      lines: [],
      summary: 'Data imported successfully',
    })
    expect(made.sim.events(made.ret)).toEqual([])
  })

  test('RT-25 a refused amount names the cell and nothing else changes', () => {
    const made = makeReturn()
    const report = must(made, [`${GIFI_CASH},"7693.52","",""`])
    expect(report.lines).toEqual([
      {
        form: '--',
        description: 'GIFI code 1002 - Test description',
        box: '--',
        result: 'The value 7693.52 could not be imported in this cell because it was invalid.',
      },
    ])
    expect(report.summary).toBeNull()
  })

  test('RT-23 hand typing and clearing are events; a hand clear stays out of the entered export', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '5')
    made.sim.typeCell(made.ret, GIFI_CASH, '')
    made.sim.clearCell(made.ret, GIFI_CASH)
    expect(made.sim.events(made.ret)).toEqual([
      { identifier: GIFI_CASH, source: 'typed', value: '5' },
      { identifier: GIFI_CASH, source: 'typed', value: '' },
      { identifier: GIFI_CASH, source: 'cleared', value: '' },
    ])
    expect(Buffer.from(made.sim.exportCsv(made.ret, 'entered')).toString('latin1')).not.toContain(GIFI_CASH)
  })

  test('RT-23 a cell not on the list, or a copy that does not exist, cannot be typed or cleared', () => {
    const made = makeReturn()
    expect(() => {
      made.sim.typeCell(made.ret, 'ZZZ.Unknown', '1')
    }).toThrow("ZZZ.Unknown is not on this release's list")
    expect(() => {
      made.sim.clearCell(made.ret, CLAIMED_CELL(1))
    }).toThrow(`${CLAIMED_CELL(1)}: that copy does not exist`)
    expect(() => {
      made.sim.typeCell(made.ret, CLAIMED_CELL(3), '1')
    }).toThrow('that copy does not exist')
    made.sim.addCopy(made.ret, CCA)
    expect(() => {
      made.sim.typeCell(made.ret, CLAIMED_CELL(1), '1')
    }).not.toThrow()
  })

  test('RT-3 an export writes an apostrophe before each negative, in the right row, and not before a hyphen elsewhere', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, 'GFGBA.Ttwgba72', '-5')
    made.sim.typeCell(made.ret, GIFI_CASH, '-12')
    made.sim.typeCell(made.ret, 'GFGBA.Ttwgba127', '-0')
    made.sim.typeCell(made.ret, 'IDENT.Ident311', '-9 Co')
    const text = Buffer.from(made.sim.exportCsv(made.ret, 'entered')).toString('latin1')
    expect(text).toContain(`\r\n${GIFI_CASH},"'-12"`)
    expect(text).toContain('\r\nGFGBA.Ttwgba72,"\'-5"')
    expect(text).toContain('\r\nGFGBA.Ttwgba127,"-0"')
    expect(text).not.toContain(`'-9`)
  })

  test('RT-3 a value like -12abc is not a negative and gets no apostrophe', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, 'IDENT.Ident311', '-12abc')
    expect(Buffer.from(made.sim.exportCsv(made.ret, 'entered')).toString('latin1')).not.toContain(`'-12abc`)
  })

  test('RT-23 lock state is per return and flips both ways; years set by hand are not events', () => {
    const sim = makeSim()
    const a = sim.createReturn(input)
    const b = sim.createReturn({ ...input, businessNumber: '2' })
    expect(sim.isLocked(a)).toBe(false)
    sim.lock(a)
    expect([sim.isLocked(a), sim.isLocked(b)]).toEqual([true, false])
    sim.unlock(a)
    expect(sim.isLocked(a)).toBe(false)
    sim.setYear(a, { start: '2025-01-01', end: '2025-12-31' })
    expect(sim.events(a)).toEqual([])
  })

  test('RT-2 openReturn wipes only the partner cell', () => {
    const made = makeReturn({ clientCode: 'C77' })
    must(made, ['IFirm.ContactPartner,"Pat","",""'])
    made.sim.openReturn(made.ret)
    const text = Buffer.from(made.sim.exportCsv(made.ret, 'entered')).toString('latin1')
    expect(text).toContain('\r\nIFirm.ContactPartner,"",')
    expect(text).toContain('\r\nIFirm.ContactID,"C77",')
  })

  test('RT-7 copyCount and addCopy count per path from zero', () => {
    const made = makeReturn()
    expect(made.sim.copyCount(made.ret, CCA)).toBe(0)
    expect(made.sim.addCopy(made.ret, CCA)).toBe(1)
    expect(made.sim.addCopy(made.ret, CCA)).toBe(2)
    expect(made.sim.copyCount(made.ret, CCA)).toBe(2)
    expect(fixtureList().length).toBeGreaterThan(300)
  })
})
