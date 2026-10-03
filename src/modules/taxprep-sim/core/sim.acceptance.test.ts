/**
 * S00 Taxprep simulator: acceptance tests (spec-writer only; builders never edit).
 * Follows plan/cards/S00.md and reference/taxprep/FINDINGS.md (trial release CCH iFirm 2026.20.198267).
 *
 * The public API these tests fix (spec choices, amber; the builder implements exactly these names in
 * src/modules/taxprep-sim/index.ts, with the code under src/modules/taxprep-sim/core/):
 *
 *   type CellKind = 'amount' | 'text' | 'date' | 'yesNo' | 'rate'
 *   type ReleaseCell = { identifier: string; description: string; kind: CellKind; order: number;
 *                        repeating?: boolean; confirmed?: boolean; form?: string; box?: string }
 *     (spec round 4, review gap 2, amber: `form` and `box` are what Taxprep's report shows for the cell, `S1599` and
 *     `1002` for GIFI 1002; a report line carries `""` for either when the list gives none)
 *     A repeating-form cell is listed once, written with copy index [1] (`CCACat.FD08C[1].FED.Ttw08cA1`), and stands
 *     for the same cell under every copy; in an export its copies come at its place in the list, ascending.
 *     A cell written with `[1]` that is not marked repeating (`GFBGII[1].GFGIJ...`) is an ordinary cell.
 *   defaultReleaseList(): readonly ReleaseCell[]   (from reference/sample-clients/lib/taxprep-cells.json:
 *     the 300 GIFI input cells as amount cells with `confirmed: true`, the eight creation and contact cells)
 *   createSimulator(options: { newGuid: () => string; releaseList?: readonly ReleaseCell[]; releaseName?: string }): Simulator
 *     (round 3, ARC-14: the id source is required; no options, or options without a newGuid function, throw an Error
 *     whose message names `newGuid`; no list given: the default list; no clock read)
 *   Simulator.ignoredOnImport: the very IGNORED_ON_IMPORT array of src/contracts/taxprep.ts (F03) the import skips by;
 *   Simulator.alwaysExported: the very ALWAYS_EXPORTED array (F03R) the "entered" export always lists (round 3, RT-13;
 *     amber: the card asks for `toBe` against both lists, so the simulator shows the lists it uses).
 *
 *   Simulator.createReturn(input: { businessNumber: string; yearEnd: string; returnName: string;
 *                                   corporationName: string; clientCode: string }): SimReturn
 *     one return per (businessNumber, yearEnd): the same key gives the same object; the guid is newGuid()'s next value.
 *     Cells held at creation: IDENT.Ident311 = corporationName, IDENT.Ident230 = "1", IDENT.Ident451 = clientCode,
 *     IDENT.Ident492 = "N", IFirm.ContactPartner = "", IFirm.ContactID = clientCode; IDENT.Ident120 and Ident121 are
 *     empty until setYear. The business number is only a key: no cell holds it.
 *   Simulator.getReturn(businessNumber, yearEnd): SimReturn | undefined
 *   SimReturn: { readonly returnName; guid; releaseName; businessNumber; yearEnd }  (read-only fields)
 *   Simulator.importCsv(ret, bytes): { ok: true; report: ImportReport } | { ok: false; faults: TaxprepFault[] }
 *     bytes F03's parser refuses: { ok: false } and nothing changes (unconfirmed against the trial; S01 owns faults,
 *     and S03 owns what a UTF-8 or byte-order-mark file does: round 2 does not fix S00's answer for those).
 *   Yes or no cells (kind 'yesNo'; FINDINGS Q20, run 2, 5D): `Y` on a cell at its default `N` imports with no report
 *     line; `""` or `" "` cannot empty it: it resets to `N`, reported "replaced", and the "entered" export shows `N`.
 *   Rate cells take decimals (`"0.2000"`), and so do text cells (`"10.1"`): only amount cells refuse cents (RT-25).
 *   An identifier the release list does not hold, in any form (unknown form, unknown field on a known form, a copy
 *     index on a cell that is not repeating), is "Cell not available." (O4). Several new copy indexes in one file
 *     take the following indexes in row order (RT-7); a gap index is refused (unconfirmed).
 *   ImportReport = { lines: ReportLine[]; summary: 'Data imported successfully' | null }
 *   ReportLine = { form: string; description: string; box: string; result: string }   (exactly these four keys)
 *     a known cell's line takes form, description and box from its release cell; "Cell not available." takes `--`.
 *     summary is the success text exactly when lines is empty, else null.
 *   Simulator.exportCsv(ret, filter: 'entered' | 'all-input'): Uint8Array
 *   Simulator.typeCell(ret, identifier, value: string): void      (by hand; an identifier off the list throws)
 *   Simulator.clearCell(ret, identifier): void                    (by hand)
 *   Simulator.setYear(ret, { start: string; end: string }): void  (by hand; sets IDENT.Ident120 and Ident121; records no event)
 *   Simulator.addCopy(ret, copyPath: string): number              (by hand; returns the new copy's index)
 *   Simulator.copyCount(ret, copyPath: string): number
 *   Simulator.openReturn(ret): void                               (the contact synchronisation wipes IFirm.ContactPartner)
 *   Simulator.lock(ret) / unlock(ret) / isLocked(ret): boolean
 *   Simulator.events(ret): readonly { identifier: string; source: 'import' | 'typed' | 'cleared'; value: string }[]
 *     in order; a clear has value "".
 *
 * Amber, unasked by the card: (1) F03's writer never writes an apostrophe, so the exported leading apostrophe is the
 * simulator's own addition on top of the writer's bytes; the tests read bytes only. Round 3: the apostrophe is chosen by
 * the cell's kind (a negative whole number in an amount cell), never by the value's text (A333, findings wave 2 fix 1c).
 * (2) The golden export header carries the guid the test injects. (3) Round 3 source scans read the committed text
 * through DG's readOwnSource, so they hold inside Stryker's sandbox.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { ALWAYS_EXPORTED, IGNORED_ON_IMPORT, parseTaxprepCsv } from '../../../contracts/taxprep'
import { readOwnSource } from '../../../core/testing/read-own-source'
import * as simModule from '../index'
import { createSimulator, defaultReleaseList, type SimulatorOptions } from '../index'
import {
  CCA,
  CLAIMED_CELL,
  CLASS_CELL,
  EIGHT,
  GIFI_CASH,
  GIFI_IDS,
  GIFI_PREPAID,
  GIFI_RECEIVABLE,
  GUID_1,
  GUID_2,
  RATE_CELL,
  SEED,
  UCC_CELL,
  YES_NO,
  amt,
  asText,
  clr,
  day2Descriptions,
  day2ExportBytes,
  exportedApostrophe,
  extendedList,
  file,
  fixtureList,
  goldenBytes,
  makeReturn,
  makeSim,
  mustImport,
  parseOk,
  rawFile,
  readExport,
  readsBackAs,
  referenceEntered,
  taxprepBytes,
  whereOf,
} from './__fixtures__/harness'

const SAMPLES = [
  { n: '01', dir: 'reference/sample-clients/01-maple-ridge', code: 'C001' },
  { n: '05', dir: 'reference/sample-clients/05-eglinton-holdings', code: 'C005' },
  { n: '08', dir: 'reference/sample-clients/08-queen-west-design', code: 'C008' },
] as const

const CELL_NA = { form: '--', description: '--', box: '--', result: 'Cell not available.' }
const REPLACED = 'The value of this cell has been replaced by a new imported value.'
const EMPTIED = 'This cell has been emptied by the import.'
const OK = 'Data imported successfully'

function describeOf(identifier: string): string {
  const cell = fixtureList().find((c) => c.identifier === identifier)
  if (cell === undefined) throw new Error(`test fixture: ${identifier} is not in the fixture list`)
  return cell.description
}

// ---------- 1 and 2: the round trip and the goldens ----------

describe('RT-3 import then export (check 1)', () => {
  for (const s of SAMPLES) {
    const importBytes = taxprepBytes(`${s.dir}/taxprep/import.csv`)
    const imported = parseOk(importBytes)
    const name = imported.header.returnName

    test(`RT-3 client ${s.n}: the "entered" export equals the golden file byte for byte`, () => {
      const made = makeReturn({ name, clientCode: s.code })
      mustImport(made, importBytes)
      const bytes = made.sim.exportCsv(made.ret, 'entered')
      expect(asText(bytes)).toBe(asText(goldenBytes(`client-${s.n}-export.csv`)))
    })

    test(`RT-3 client ${s.n}: the golden export is what the trial's rules give (reference model)`, () => {
      const expected = referenceEntered({
        importBytes,
        list: fixtureList(),
        returnName: name,
        guid: GUID_1,
        fixed: {
          'IDENT.Ident120': '2025-01-01',
          'IDENT.Ident121': '2025-12-31',
          'IDENT.Ident311': name,
          'IDENT.Ident230': '1',
          'IDENT.Ident451': s.code,
          'IDENT.Ident492': 'N',
          'IFirm.ContactPartner': '',
          'IFirm.ContactID': s.code,
        },
      })
      expect(asText(goldenBytes(`client-${s.n}-export.csv`))).toBe(asText(expected))
    })

    test(`RT-3, RT-26 client ${s.n}: importing into an empty return gives the golden report`, () => {
      const made = makeReturn({ name, clientCode: s.code })
      const report = mustImport(made, importBytes)
      expect(report).toEqual(JSON.parse(asText(goldenBytes(`client-${s.n}-report.json`))))
    })

    test(`RT-3 client ${s.n}: every imported row is exported with the same value, the eight cells are listed, the header is the return's own`, () => {
      const made = makeReturn({ name, clientCode: s.code })
      mustImport(made, importBytes)
      const out = readExport(made, 'entered')
      expect(out.header).toEqual({ returnName: name, guid: GUID_1 })
      expect(out.header.guid).not.toBe(imported.header.guid)
      const kindOf = new Map(fixtureList().map((c) => [c.identifier, c.kind]))
      for (const row of imported.rows) {
        const seen = out.seen.get(row.id.text)
        expect(seen, row.id.text).toBeDefined()
        const value = row.current.kind === 'value' ? row.current.text : ''
        expect(seen?.value, row.id.text).toBe(value)
        // round 3: by the cell's kind (a negative whole number in an amount cell), not by the value's text
        expect(seen?.apostrophe, row.id.text).toBe(exportedApostrophe(kindOf.get(row.id.text) ?? 'text', value))
      }
      for (const cell of EIGHT) expect(out.ids, cell).toContain(cell)
      expect(out.ids).toHaveLength(imported.rows.length + EIGHT.length)
      expect(out.seen.get('IDENT.Ident311')?.value).toBe(name)
      expect(out.seen.get('IDENT.Ident451')?.value).toBe(s.code)
      expect(out.seen.get('IFirm.ContactID')?.value).toBe(s.code)
      expect(out.seen.get('IDENT.Ident120')?.value).toBe('2025-01-01')
      expect(out.seen.get('IDENT.Ident121')?.value).toBe('2025-12-31')
    })
  }

  test('RT-3 client 08: a negative is exported with exactly one leading apostrophe, and the file ends in CR LF', () => {
    const importBytes = taxprepBytes(`${SAMPLES[2].dir}/taxprep/import.csv`)
    const made = makeReturn({ name: parseOk(importBytes).header.returnName, clientCode: 'C008' })
    mustImport(made, importBytes)
    const text = asText(made.sim.exportCsv(made.ret, 'entered'))
    expect(text).toContain(`GFBGII[1].GFGIJ.Ttwgij121,"'-818","",`)
    expect(text).not.toContain(`''-`)
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.split('\n').every((l, i, all) => i === all.length - 1 || l.endsWith('\r'))).toBe(true)
  })

  test('RT-3 the description column comes from the release list on every row and the first line is the return header', () => {
    const made = makeReturn({ name: 'Probe Co. (Test)', clientCode: 'C000' })
    mustImport(made, file([[GIFI_CASH, amt(10)]]))
    const out = readExport(made, 'entered')
    expect(out.rows.every((r) => r.shape === 'standard')).toBe(true)
    expect(out.seen.get(GIFI_CASH)?.description).toBe(describeOf(GIFI_CASH))
    expect(out.seen.get('IFirm.ContactPartner')?.description).toBe('Partner')
    expect(asText(made.sim.exportCsv(made.ret, 'entered')).split('\r\n')[0]).toBe(
      `[Probe Co. (Test)|0|0|${GUID_1}],"Current Year","Last Year",""`,
    )
  })
})

describe('RT-9 the export is Windows-1252', () => {
  test('RT-9 a return named "Café (Test)" exports é as the single byte 0xE9, in the header and in the name cell', () => {
    const made = makeReturn({ name: 'Café (Test)', clientCode: 'C000' })
    mustImport(made, file([[GIFI_CASH, amt(10)]]))
    const bytes = Buffer.from(made.sim.exportCsv(made.ret, 'entered'))
    const header = Buffer.from('[Caf\u00e9 (Test)|0|0|', 'latin1')
    expect(bytes.subarray(0, header.length).equals(header)).toBe(true)
    expect(bytes.subarray(0, header.length)[4]).toBe(0xe9)
    expect(bytes.includes(Buffer.from('IDENT.Ident311,"Caf\u00e9 (Test)"', 'latin1'))).toBe(true)
    expect(bytes.includes(Buffer.from([0xc3, 0xa9]))).toBe(false)
    expect(bytes.includes(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false)
    expect(bytes.filter((b) => b === 0xe9).length).toBe(2)
  })
})

describe('RT-3, ARC-14 export then import into a fresh return then export (check 2)', () => {
  test('RT-3 ARC-14 the second export equals the first apart from the header name and guid', () => {
    const importBytes = taxprepBytes(`${SAMPLES[2].dir}/taxprep/import.csv`)
    const corp = parseOk(importBytes).header.returnName
    const a = makeReturn({ name: 'Return A (Test)', corp, clientCode: 'C008', bn: '100000008RC0001', guids: [GUID_1] })
    mustImport(a, importBytes)
    a.sim.typeCell(a.ret, GIFI_PREPAID, '-42')
    const first = a.sim.exportCsv(a.ret, 'entered')

    const b = makeReturn({ name: 'Return B (Test)', corp, clientCode: 'C008', bn: '100000009RC0001', guids: [GUID_2] })
    const report = b.sim.importCsv(b.ret, first)
    expect(report.ok).toBe(true)
    const second = b.sim.exportCsv(b.ret, 'entered')

    const firstLines = asText(first).split('\r\n')
    const secondLines = asText(second).split('\r\n')
    expect(firstLines[0]).toBe(`[Return A (Test)|0|0|${GUID_1}],"Current Year","Last Year",""`)
    expect(secondLines[0]).toBe(`[Return B (Test)|0|0|${GUID_2}],"Current Year","Last Year",""`)
    expect(secondLines.slice(1)).toEqual(firstLines.slice(1))
    // a negative written with its apostrophe was read back through F03's strip, and written with one again
    expect(secondLines).toContain(`${GIFI_PREPAID},"'-42","","${describeOf(GIFI_PREPAID)}"`)
  })
})

// ---------- 3: clearing ----------

describe('RT-12, RT-8 clears and zero (check 3)', () => {
  test('RT-12 a "" row and a " " row each clear a cell typed earlier; "0" sets zero; the report says so', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '500')
    made.sim.typeCell(made.ret, GIFI_RECEIVABLE, '700')
    made.sim.typeCell(made.ret, GIFI_PREPAID, '900')
    const bytes = rawFile([`${GIFI_CASH},"","",""`, `${GIFI_RECEIVABLE}," ","",""`, `${GIFI_PREPAID},"0","",""`])
    const report = mustImport(made, bytes)
    expect(report.lines.map((l) => l.result)).toEqual([EMPTIED, EMPTIED, REPLACED])
    expect(report.lines.map((l) => l.description)).toEqual([
      describeOf(GIFI_CASH),
      describeOf(GIFI_RECEIVABLE),
      describeOf(GIFI_PREPAID),
    ])
    expect(report.summary).toBeNull()
    const out = readExport(made, 'entered')
    expect(out.ids).not.toContain(GIFI_CASH)
    expect(out.ids).not.toContain(GIFI_RECEIVABLE)
    expect(out.seen.get(GIFI_PREPAID)?.value).toBe('0')
  })

  test('RT-8 an explicit clear row from the writer empties the cell and the event list records it as an import', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(500)]]))
    const report = mustImport(made, file([[GIFI_CASH, clr]]))
    expect(report.lines.map((l) => l.result)).toEqual([EMPTIED])
    expect(readExport(made, 'entered').ids).not.toContain(GIFI_CASH)
    expect(made.sim.events(made.ret).filter((e) => e.identifier === GIFI_CASH)).toEqual([
      { identifier: GIFI_CASH, source: 'import', value: '500' },
      { identifier: GIFI_CASH, source: 'import', value: '' },
    ])
  })

  test('RT-12 a clear of a cell that was already empty changes nothing and has no report line', () => {
    const made = makeReturn()
    const report = mustImport(made, file([[GIFI_CASH, clr]]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(readExport(made, 'entered').ids).not.toContain(GIFI_CASH)
    expect(made.sim.events(made.ret)).toEqual([])
  })

  test('RT-12 a " " row into an already empty cell is no change either: no line, no event', () => {
    const made = makeReturn()
    const report = mustImport(made, rawFile([`${GIFI_CASH}," ","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(made.sim.events(made.ret)).toEqual([])
  })
})

// ---------- round 2 (1): yes or no cells ----------

describe('RT-12, RT-23 a yes or no cell cannot be emptied (FINDINGS Q20)', () => {
  test('RT-12 a "" row on a yes or no cell holding Y resets it to N with a "replaced" line, and N stays in the export', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.typeCell(made.ret, YES_NO, 'Y')
    const report = mustImport(made, rawFile([`${YES_NO},"","",""`]))
    expect(report.lines).toHaveLength(1)
    expect(report.lines[0]?.result).toBe(REPLACED)
    expect(report.lines[0]?.description).toBe('Line 070 - Test yes or no')
    expect(report.summary).toBeNull()
    const out = readExport(made, 'entered')
    expect(out.ids).toContain(YES_NO)
    expect(out.seen.get(YES_NO)?.value).toBe('N')
    expect(readExport(made, 'all-input').seen.get(YES_NO)?.value).toBe('N')
  })

  test('RT-12 a " " row on a yes or no cell holding Y resets it to N as well, never to empty', () => {
    const made = makeReturn({ list: extendedList() })
    mustImport(made, rawFile([`${YES_NO},"Y","",""`]))
    const report = mustImport(made, rawFile([`${YES_NO}," ","",""`, `${GIFI_CASH},"4","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([REPLACED])
    expect(readExport(made, 'entered').seen.get(YES_NO)?.value).toBe('N')
    expect(readExport(made, 'entered').seen.get(GIFI_CASH)?.value).toBe('4')
  })

  test('RT-26 Y imported into a yes or no cell at its default N gives no report line and is exported as Y', () => {
    const made = makeReturn({ list: extendedList() })
    const report = mustImport(made, rawFile([`${YES_NO},"Y","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(readExport(made, 'entered').seen.get(YES_NO)?.value).toBe('Y')
  })
})

// ---------- round 2 (2): decimals outside amount cells ----------

describe('RT-25 only amount cells refuse decimals', () => {
  test('RT-25 a rate cell imports "0.2000" with no report line and exports it as written', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.addCopy(made.ret, CCA)
    const report = mustImport(made, rawFile([`${RATE_CELL(1)},"0.2000","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(readExport(made, 'entered').seen.get(RATE_CELL(1))?.value).toBe('0.2000')
  })

  test('RT-25 a decimal in a text cell is not refused: "10.1" replaces the class number with a "replaced" line', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    made.sim.typeCell(made.ret, CLASS_CELL(1), '8')
    const report = mustImport(made, rawFile([`${CLASS_CELL(1)},"10.1","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([REPLACED])
    expect(readExport(made, 'entered').seen.get(CLASS_CELL(1))?.value).toBe('10.1')
  })
})

// ---------- 4: silent skips ----------

describe('RT-13 year and contact cells are skipped silently (check 4)', () => {
  test('RT-13 rows for the year start, year end, the name cell and Ident492 change nothing and give no report line', () => {
    const made = makeReturn({ name: 'Probe Co. (Test)', clientCode: 'C000' })
    const bytes = rawFile([
      `IDENT.Ident120,"2024-01-01","","Line 060 - Tax year start date"`,
      `IDENT.Ident121,"2024-12-31","","Line 061 - Tax year-end"`,
      `IDENT.Ident311,"Other Name (Test)","","Corporation's name"`,
      `IDENT.Ident492,"Y","",""`,
      `${GIFI_CASH},"100","",""`,
    ])
    const report = mustImport(made, bytes)
    expect(report).toEqual({ lines: [], summary: OK })
    const out = readExport(made, 'entered')
    expect(out.seen.get('IDENT.Ident120')?.value).toBe('2025-01-01')
    expect(out.seen.get('IDENT.Ident121')?.value).toBe('2025-12-31')
    expect(out.seen.get('IDENT.Ident311')?.value).toBe('Probe Co. (Test)')
    expect(out.seen.get('IDENT.Ident492')?.value).toBe('N')
    expect(out.seen.get(GIFI_CASH)?.value).toBe('100')
    expect(made.sim.events(made.ret).map((e) => e.identifier)).toEqual([GIFI_CASH])
  })

  test('RT-13 skipped even when the cell already held a value and the file names it with a clear: still no line', () => {
    const made = makeReturn({ name: 'Probe Co. (Test)' })
    const report = mustImport(made, rawFile([`IDENT.Ident311,"","",""`, `IDENT.Ident120," ","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    const out = readExport(made, 'entered')
    expect(out.seen.get('IDENT.Ident311')?.value).toBe('Probe Co. (Test)')
    expect(out.seen.get('IDENT.Ident120')?.value).toBe('2025-01-01')
  })
})

// ---------- 5: the report ----------

describe('RT-26 the import report lists only cells that already held a value (check 5)', () => {
  test('RT-26 an import into an empty return says "Data imported successfully" and has no per-cell lines', () => {
    const made = makeReturn()
    const importBytes = taxprepBytes(`${SAMPLES[0].dir}/taxprep/import.csv`)
    expect(mustImport(made, importBytes)).toEqual({ lines: [], summary: OK })
  })

  test('RT-26 importing again with one value changed gives one "replaced" line for it and one for each other cell that held a value', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(100)], [GIFI_RECEIVABLE, amt(200)], [GIFI_PREPAID, amt(300)]]))
    const report = mustImport(
      made,
      file([
        [GIFI_CASH, amt(150)],
        [GIFI_RECEIVABLE, amt(200)],
        ['GFGBA.Ttwgba65', amt(5)],
      ]),
    )
    expect(report.summary).toBeNull()
    expect(report.lines).toHaveLength(2)
    expect(report.lines.map((l) => l.result)).toEqual([REPLACED, REPLACED])
    expect(report.lines.map((l) => l.description)).toEqual([describeOf(GIFI_CASH), describeOf(GIFI_RECEIVABLE)])
    // the new cell and the cell the file left out give no line; the left-out cell keeps its value
    const out = readExport(made, 'entered')
    expect(out.seen.get(GIFI_PREPAID)?.value).toBe('300')
    expect(out.seen.get('GFGBA.Ttwgba65')?.value).toBe('5')
    expect(out.seen.get(GIFI_CASH)?.value).toBe('150')
  })

  test('RT-26 a line has only form, description, box and result: no counts, no identifier', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '1')
    const report = mustImport(made, file([[GIFI_CASH, amt(2)], ['GFGBA.Ttwgba999999', amt(3)]]))
    for (const line of report.lines) expect(Object.keys(line).sort()).toEqual(['box', 'description', 'form', 'result'])
    expect(Object.keys(report).sort()).toEqual(['lines', 'summary'])
  })

  test('RT-26 lines come in the file\'s row order', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(1)], [GIFI_RECEIVABLE, amt(2)], [GIFI_PREPAID, amt(3)]]))
    const report = mustImport(made, file([[GIFI_PREPAID, amt(3)], [GIFI_CASH, amt(1)], [GIFI_RECEIVABLE, clr]]))
    expect(report.lines.map((l) => l.description)).toEqual([
      describeOf(GIFI_PREPAID),
      describeOf(GIFI_CASH),
      describeOf(GIFI_RECEIVABLE),
    ])
    expect(report.lines.map((l) => l.result)).toEqual([REPLACED, REPLACED, EMPTIED])
  })
})

// ---------- 6: cents ----------

describe('RT-25 cents are refused in amount cells (check 6)', () => {
  test('RT-25 7693.52 in an amount cell is refused with the trial wording and changes nothing; the rest imports', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '100')
    const report = mustImport(
      made,
      rawFile([`${GIFI_CASH},"7693.52","",""`, `${GIFI_RECEIVABLE},"1200","",""`, `${GIFI_PREPAID},"3","",""`]),
    )
    expect(report.lines).toHaveLength(1)
    expect(report.lines[0]?.result).toBe(
      'The value 7693.52 could not be imported in this cell because it was invalid.',
    )
    expect(report.lines[0]?.description).toBe(describeOf(GIFI_CASH))
    expect(report.summary).toBeNull()
    const out = readExport(made, 'entered')
    expect(out.seen.get(GIFI_CASH)?.value).toBe('100')
    expect(out.seen.get(GIFI_RECEIVABLE)?.value).toBe('1200')
    expect(out.seen.get(GIFI_PREPAID)?.value).toBe('3')
  })

  test('RT-25 a refused cents row into an empty cell still gives a refusal line and leaves the cell empty', () => {
    const made = makeReturn()
    const report = mustImport(made, rawFile([`${GIFI_CASH},"0.5","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([
      'The value 0.5 could not be imported in this cell because it was invalid.',
    ])
    expect(readExport(made, 'entered').ids).not.toContain(GIFI_CASH)
  })

  test('RT-25 a negative with cents is refused the same way, and no refused row is an event', () => {
    const made = makeReturn()
    const report = mustImport(made, rawFile([`${GIFI_CASH},"-12.30","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([
      'The value -12.30 could not be imported in this cell because it was invalid.',
    ])
    expect(made.sim.events(made.ret)).toEqual([])
  })
})

// ---------- 7: the header is not read ----------

describe('RT-1 the header is not read (check 7)', () => {
  test('RT-1 a file naming another return and another guid is applied to the return the call names, silently', () => {
    const made = makeReturn({ name: 'First (Test)', bn: '100000001RC0001', guids: [GUID_1, GUID_2] })
    const other = made.sim.createReturn({
      businessNumber: '100000002RC0001',
      yearEnd: '2025-12-31',
      returnName: 'Second (Test)',
      corporationName: 'Second (Test)',
      clientCode: 'C002',
    })
    expect(other.guid).toBe(GUID_2)
    const bytes = file([[GIFI_CASH, amt(77)]], { returnName: 'Second (Test)', guid: GUID_2 })
    const report = mustImport(made, bytes)
    expect(report).toEqual({ lines: [], summary: OK })
    expect(readExport(made, 'entered').seen.get(GIFI_CASH)?.value).toBe('77')
    expect(readExport(made, 'entered').header).toEqual({ returnName: 'First (Test)', guid: GUID_1 })
    const otherOut = parseOk(made.sim.exportCsv(other, 'entered'))
    expect(otherOut.rows.map((r) => r.id.text)).not.toContain(GIFI_CASH)
  })

  test('RT-1 the parsed header is never compared: the call names the target even when the header is all zeros', () => {
    const made = makeReturn()
    const report = mustImport(made, rawFile([`${GIFI_CASH},"5","",""`], '[Nobody (Test)|0|0|00000000-0000-0000-0000-000000000000],"Current Year","Last Year",""'))
    expect(report.lines).toEqual([])
    const out = readExport(made, 'entered')
    expect(out.seen.get(GIFI_CASH)?.value).toBe('5')
    expect(out.header).toEqual({ returnName: 'Probe Co. (Test)', guid: GUID_1 })
  })
})

// ---------- 8: hand edits ----------

describe('RT-23 hand edits are recorded as such (check 8)', () => {
  test('RT-23 a cell typed after import is exported and listed as typed by hand; a cleared one is absent from "entered", "" in "all-input"', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(1000)], [GIFI_RECEIVABLE, amt(2000)]]))
    made.sim.typeCell(made.ret, GIFI_PREPAID, '300')
    made.sim.clearCell(made.ret, GIFI_RECEIVABLE)

    const entered = readExport(made, 'entered')
    expect(entered.seen.get(GIFI_CASH)?.value).toBe('1000')
    expect(entered.seen.get(GIFI_PREPAID)?.value).toBe('300')
    expect(entered.ids).not.toContain(GIFI_RECEIVABLE)

    const all = readExport(made, 'all-input')
    expect(all.seen.get(GIFI_RECEIVABLE)?.value).toBe('')
    expect(all.seen.get(GIFI_CASH)?.value).toBe('1000')

    const events = made.sim.events(made.ret)
    const of = (cell: string) => events.filter((e) => e.identifier === cell)
    expect(of(GIFI_CASH)).toEqual([{ identifier: GIFI_CASH, source: 'import', value: '1000' }])
    expect(of(GIFI_PREPAID)).toEqual([{ identifier: GIFI_PREPAID, source: 'typed', value: '300' }])
    expect(of(GIFI_RECEIVABLE)).toEqual([
      { identifier: GIFI_RECEIVABLE, source: 'import', value: '2000' },
      { identifier: GIFI_RECEIVABLE, source: 'cleared', value: '' },
    ])
  })

  test('RT-23 the "all-input" export lists every GIFI cell of the release list, empty ones as "", in list order', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(1)]]))
    const all = readExport(made, 'all-input')
    expect(all.ids.filter((i) => GIFI_IDS.includes(i))).toEqual(GIFI_IDS)
    expect(all.seen.get('GFGBA.Ttwgba65')?.value).toBe('')
    for (const cell of EIGHT) expect(all.ids, cell).toContain(cell)
    expect(all.seen.get('GFGBA.Ttwgba65')?.description).toBe(describeOf('GFGBA.Ttwgba65'))
  })

  test('RT-23 a hand-typed negative is exported with its apostrophe, like an imported one', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '-1299')
    const out = readExport(made, 'entered')
    expect(out.seen.get(GIFI_CASH)).toMatchObject({ value: '-1299', apostrophe: true })
  })

  test('RT-23 typing into a cell that is not on the release list is refused', () => {
    const made = makeReturn()
    expect(() => {
      made.sim.typeCell(made.ret, 'GFGBA.Ttwgba999999', '5')
    }).toThrow()
    expect(made.sim.events(made.ret)).toEqual([])
  })

  test('RT-23 a return per (business number, year end): the same key is the same return, another year end another return', () => {
    const made = makeReturn({ bn: '100000001RC0001', yearEnd: '2025-12-31' })
    expect(made.sim.getReturn('100000001RC0001', '2025-12-31')).toBe(made.ret)
    expect(made.sim.getReturn('100000001RC0001', '2024-12-31')).toBeUndefined()
    const again = made.sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: 'Ignored (Test)',
      corporationName: 'Ignored (Test)',
      clientCode: 'C999',
    })
    expect(again).toBe(made.ret)
    const next = made.sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2024-12-31',
      returnName: 'Last Year (Test)',
      corporationName: 'Last Year (Test)',
      clientCode: 'C000',
    })
    expect(next).not.toBe(made.ret)
    expect(next.guid).not.toBe(made.ret.guid)
    expect(made.ret.guid).toBe(GUID_1)
  })

  test('RT-23 the lock flag toggles and does not change what an export says', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(5)]]))
    expect(made.sim.isLocked(made.ret)).toBe(false)
    const before = made.sim.exportCsv(made.ret, 'entered')
    made.sim.lock(made.ret)
    expect(made.sim.isLocked(made.ret)).toBe(true)
    expect(made.sim.exportCsv(made.ret, 'entered')).toEqual(before)
    made.sim.unlock(made.ret)
    expect(made.sim.isLocked(made.ret)).toBe(false)
  })
})

// ---------- 9: unknown cells and copies ----------

describe('RT-23, RT-7 unknown cells and repeating copies (check 9)', () => {
  test('RT-23 an identifier off the release list gives "Cell not available." with "--" and no identifier; the rest imports', () => {
    const made = makeReturn()
    const bytes = rawFile([
      `GFGBA.Ttwgba999999,"5","",""`,
      `${GIFI_CASH},"10","",""`,
      `GFGBA.Ttwgba999998,"6","",""`,
    ])
    const report = mustImport(made, bytes)
    expect(report.lines).toEqual([CELL_NA, CELL_NA])
    for (const line of report.lines) expect('identifier' in line).toBe(false)
    expect(JSON.stringify(report)).not.toContain('999')
    expect(report.summary).toBeNull()
    const out = readExport(made, 'entered')
    expect(out.seen.get(GIFI_CASH)?.value).toBe('10')
    expect(out.ids.some((i) => i.includes('999'))).toBe(false)
    expect(made.sim.events(made.ret).map((e) => e.identifier)).toEqual([GIFI_CASH])
  })

  test('RT-7 with two copies of CCACat.FD08C, a row for copy [3] creates a third copy with no report line', () => {
    const made = makeReturn()
    expect(made.sim.addCopy(made.ret, CCA)).toBe(1)
    expect(made.sim.addCopy(made.ret, CCA)).toBe(2)
    made.sim.typeCell(made.ret, CLASS_CELL(1), '8')
    made.sim.typeCell(made.ret, CLASS_CELL(2), '1')
    const report = mustImport(made, rawFile([`${CLASS_CELL(3)},"10","",""`, `${UCC_CELL(3)},"20000","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(made.sim.copyCount(made.ret, CCA)).toBe(3)
    const out = readExport(made, 'entered')
    expect(out.seen.get(CLASS_CELL(3))?.value).toBe('10')
    expect(out.seen.get(UCC_CELL(3))?.value).toBe('20000')
    expect(out.seen.get(CLASS_CELL(1))?.value).toBe('8')
    expect(out.seen.get(CLASS_CELL(2))?.value).toBe('1')
    expect(out.ids.indexOf(CLASS_CELL(1))).toBeLessThan(out.ids.indexOf(CLASS_CELL(2)))
    expect(out.ids.indexOf(CLASS_CELL(2))).toBeLessThan(out.ids.indexOf(CLASS_CELL(3)))
  })

  test('RT-7 a return with no copy takes a row for copy [1] as the next copy and creates it', () => {
    const made = makeReturn()
    expect(made.sim.copyCount(made.ret, CCA)).toBe(0)
    const report = mustImport(made, rawFile([`${CLASS_CELL(1)},"8","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(made.sim.copyCount(made.ret, CCA)).toBe(1)
  })

  test('RT-7 a row into an existing copy replaces its value and reports it like any cell', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    made.sim.typeCell(made.ret, UCC_CELL(1), '5000')
    const report = mustImport(made, rawFile([`${UCC_CELL(1)},"6000","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([REPLACED])
    expect(made.sim.copyCount(made.ret, CCA)).toBe(1)
  })

  test('RT-7 (unconfirmed: the trial has not tried a gap index) a row for copy [5] with two copies is refused as "Cell not available."', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    made.sim.addCopy(made.ret, CCA)
    const report = mustImport(made, rawFile([`${CLASS_CELL(5)},"8","",""`, `${GIFI_CASH},"1","",""`]))
    expect(report.lines).toEqual([CELL_NA])
    expect(made.sim.copyCount(made.ret, CCA)).toBe(2)
    const out = readExport(made, 'entered')
    expect(out.ids).not.toContain(CLASS_CELL(5))
    expect(out.seen.get(GIFI_CASH)?.value).toBe('1')
  })

  test('RT-7 (unconfirmed: the trial has not tried a gap index) a row for copy [4] with two copies is refused as "Cell not available."', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    made.sim.addCopy(made.ret, CCA)
    const report = mustImport(made, rawFile([`${CLASS_CELL(4)},"8","",""`, `${GIFI_CASH},"1","",""`]))
    expect(report.lines).toEqual([CELL_NA])
    expect(made.sim.copyCount(made.ret, CCA)).toBe(2)
    expect(readExport(made, 'all-input').ids).not.toContain(CLASS_CELL(4))
    expect(readExport(made, 'entered').seen.get(GIFI_CASH)?.value).toBe('1')
  })

  test('RT-7 (unconfirmed: the trial has not tried a gap index) a row for copy [2] on a return with no copy is refused as "Cell not available."', () => {
    const made = makeReturn()
    const report = mustImport(made, rawFile([`${UCC_CELL(2)},"500","",""`, `${GIFI_CASH},"1","",""`]))
    expect(report.lines).toEqual([CELL_NA])
    expect(made.sim.copyCount(made.ret, CCA)).toBe(0)
    expect(readExport(made, 'entered').ids).not.toContain(UCC_CELL(2))
    expect(made.sim.events(made.ret).map((e) => e.identifier)).toEqual([GIFI_CASH])
  })

  test('RT-7 rows for copy [3] then copy [4] in one file, on a return with two copies, create both copies in order with no line', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    made.sim.addCopy(made.ret, CCA)
    const report = mustImport(
      made,
      rawFile([`${CLASS_CELL(3)},"10","",""`, `${CLASS_CELL(4)},"43","",""`, `${UCC_CELL(4)},"900","",""`]),
    )
    expect(report).toEqual({ lines: [], summary: OK })
    expect(made.sim.copyCount(made.ret, CCA)).toBe(4)
    const out = readExport(made, 'entered')
    expect(out.seen.get(CLASS_CELL(3))?.value).toBe('10')
    expect(out.seen.get(CLASS_CELL(4))?.value).toBe('43')
    expect(out.seen.get(UCC_CELL(4))?.value).toBe('900')
    expect(out.ids.indexOf(CLASS_CELL(3))).toBeLessThan(out.ids.indexOf(CLASS_CELL(4)))
  })

  test('RT-23 O4 an unknown field on a known form, an unknown form, and a copy index on a cell that is not repeating each give "Cell not available."; the rest imports', () => {
    const made = makeReturn()
    const bytes = rawFile([
      `GFGBA.Ttwzzz1,"5","",""`,
      `ZZTEST.Ttw1,"6","",""`,
      `GFBGII[2].GFGIJ.Ttwgij68,"7","",""`,
      `GFGBA[1].Ttwgba64,"8","",""`,
      `${GIFI_CASH},"10","",""`,
    ])
    const report = mustImport(made, bytes)
    expect(report.lines).toEqual([CELL_NA, CELL_NA, CELL_NA, CELL_NA])
    expect(report.summary).toBeNull()
    const out = readExport(made, 'all-input')
    for (const bad of ['GFGBA.Ttwzzz1', 'ZZTEST.Ttw1', 'GFBGII[2].GFGIJ.Ttwgij68', 'GFGBA[1].Ttwgba64']) {
      expect(out.ids, bad).not.toContain(bad)
    }
    expect(out.seen.get('GFBGII[1].GFGIJ.Ttwgij68')?.value).toBe('')
    expect(out.seen.get(GIFI_CASH)?.value).toBe('10')
    expect(made.sim.events(made.ret).map((e) => e.identifier)).toEqual([GIFI_CASH])
  })

  test('RT-7 the "all-input" export lists each copy of a repeating cell', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    made.sim.addCopy(made.ret, CCA)
    const all = readExport(made, 'all-input')
    for (const n of [1, 2]) {
      for (const cell of [CLASS_CELL(n), UCC_CELL(n), CLAIMED_CELL(n)]) {
        expect(all.seen.get(cell)?.value, cell).toBe('')
      }
    }
    expect(all.ids).not.toContain(CLASS_CELL(3))
  })
})

// ---------- 10: the property ----------

describe('RT-3 import then export holds the last value written for each cell (check 10)', () => {
  type V = { kind: 'amount'; n: number } | { kind: 'text'; t: string } | { kind: 'clear'; blank: '' | ' ' }
  const amountPool: string[] = [
    ...GIFI_IDS.slice(0, 6),
    'GFBGII[1].GFGIJ.Ttwgij68',
    ...[1, 2, 3].flatMap((n) => [UCC_CELL(n), CLAIMED_CELL(n)]),
  ]
  const textPool: string[] = [1, 2, 3].map((n) => CLASS_CELL(n))
  const pool = [...amountPool, ...textPool]
  // text a class-number cell may hold: letters, digits, a period, an inner space and é (Windows-1252 E9), with or
  // without a leading minus: round 3, a text cell never gets the apostrophe, whatever its text (by kind, A333)
  // spec round 4 (review gap 7): an inner apostrophe (O'Brien) and comma too; kept to values F03's format carries
  const textArb = fc.stringMatching(/^-?[A-Za-z0-9é][A-Za-z0-9é. ',]{0,8}[A-Za-z0-9é]$/).filter(readsBackAs)
  const clearArb = fc.constantFrom<V>({ kind: 'clear', blank: '' }, { kind: 'clear', blank: ' ' })
  const amountOp = fc.tuple(
    fc.constantFrom(...amountPool),
    fc.oneof(
      { weight: 4, arbitrary: fc.integer({ min: -99999, max: 99999 }).map((n): V => ({ kind: 'amount', n })) },
      { weight: 1, arbitrary: clearArb },
    ),
  )
  const textOp = fc.tuple(
    fc.constantFrom(...textPool),
    fc.oneof({ weight: 4, arbitrary: textArb.map((t): V => ({ kind: 'text', t })) }, { weight: 1, arbitrary: clearArb }),
  )
  const op = fc.oneof({ weight: 3, arbitrary: amountOp }, { weight: 1, arbitrary: textOp })

  const shown = (v: V): string => (v.kind === 'amount' ? String(v.n) : v.kind === 'text' ? v.t : v.blank)
  const rowOf = ([cell, v]: [string, V]): string => `${cell},"${shown(v)}","",""`

  const check = (made: ReturnType<typeof makeReturn>, ops: [string, V][], report: { lines: { result: string }[] }) => {
    for (const line of report.lines) expect([REPLACED, EMPTIED]).toContain(line.result)
    const last = new Map<string, V>()
    for (const [cell, v] of ops) last.set(cell, v)
    const out = readExport(made, 'entered')
    for (const cell of pool) {
      const want = last.get(cell)
      if (want === undefined || want.kind === 'clear') {
        expect(out.ids, cell).not.toContain(cell)
      } else {
        expect(out.seen.get(cell)?.value, cell).toBe(shown(want))
        expect(out.seen.get(cell)?.apostrophe, cell).toBe(want.kind === 'amount' && want.n < 0)
      }
    }
    const held = [...last.values()].filter((v) => v.kind !== 'clear').length
    expect(out.ids).toHaveLength(held + EIGHT.length)
  }

  test('RT-3 for any list of valid rows (amounts, text, "" and " " clears, with copies), "entered" holds exactly the last value per cell and every value round-trips byte for byte (seed fixed)', () => {
    fc.assert(
      fc.property(fc.array(op, { minLength: 1, maxLength: 25 }), (ops) => {
        const made = makeReturn()
        for (let i = 0; i < 3; i++) made.sim.addCopy(made.ret, CCA)
        const report = mustImport(made, rawFile(ops.map(rowOf)))
        check(made, ops, report)
      }),
      { seed: SEED, numRuns: 100 },
    )
  })

  test('RT-3 RT-7 the same holds when the file itself creates copies [1], [2] and [3] before the other rows (seed fixed)', () => {
    fc.assert(
      fc.property(fc.tuple(textArb, textArb, textArb), fc.array(op, { maxLength: 25 }), (classes, rest) => {
        const made = makeReturn()
        const head: [string, V][] = classes.map((t, i) => [CLASS_CELL(i + 1), { kind: 'text', t }])
        const ops = [...head, ...rest]
        const report = mustImport(made, rawFile(ops.map(rowOf)))
        expect(made.sim.copyCount(made.ret, CCA)).toBe(3)
        check(made, ops, report)
      }),
      { seed: SEED, numRuns: 100 },
    )
  })

  test('RT-3 the same file built by F03\'s writer (amounts and clears) gives the same export as the hand-made one', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(-15)], [GIFI_RECEIVABLE, amt(0)], [GIFI_PREPAID, clr]]))
    const other = makeReturn()
    mustImport(other, rawFile([`${GIFI_CASH},"-15","",""`, `${GIFI_RECEIVABLE},"0","",""`, `${GIFI_PREPAID},"","",""`]))
    expect(asText(made.sim.exportCsv(made.ret, 'entered'))).toBe(asText(other.sim.exportCsv(other.ret, 'entered')))
  })
})

// ---------- 11: determinism ----------

describe('RT-23 deterministic output (check 11)', () => {
  test('RT-23 two exports with nothing changed between them are byte-identical, for both filters', () => {
    const made = makeReturn()
    mustImport(made, taxprepBytes(`${SAMPLES[2].dir}/taxprep/import.csv`))
    made.sim.addCopy(made.ret, CCA)
    for (const filter of ['entered', 'all-input'] as const) {
      const a = made.sim.exportCsv(made.ret, filter)
      const b = made.sim.exportCsv(made.ret, filter)
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    }
  })

  test('RT-23 two simulators given the same guids and the same steps write the same bytes (no clock, no randomness)', () => {
    const run = () => {
      const made = makeReturn({ guids: [GUID_1] })
      mustImport(made, taxprepBytes(`${SAMPLES[0].dir}/taxprep/import.csv`))
      return asText(made.sim.exportCsv(made.ret, 'entered'))
    }
    expect(run()).toBe(run())
  })
})

// ---------- 12: the contact cells and no token ----------

describe('RT-2, RT-23 the contact cells and no token cell (check 12)', () => {
  test('RT-2 a value imported into IFirm.ContactPartner is in the next export, and "" after openReturn()', () => {
    const made = makeReturn({ clientCode: 'C042' })
    const report = mustImport(made, rawFile([`IFirm.ContactPartner,"PARTNER-ABC","",""`]))
    expect(report).toEqual({ lines: [], summary: OK })
    expect(readExport(made, 'entered').seen.get('IFirm.ContactPartner')?.value).toBe('PARTNER-ABC')
    made.sim.openReturn(made.ret)
    const after = readExport(made, 'entered')
    expect(after.ids).toContain('IFirm.ContactPartner')
    expect(after.seen.get('IFirm.ContactPartner')?.value).toBe('')
  })

  test('RT-2 a second import into a cell that held the partner value reports it as replaced (it held a value)', () => {
    const made = makeReturn()
    mustImport(made, rawFile([`IFirm.ContactPartner,"ONE","",""`]))
    const report = mustImport(made, rawFile([`IFirm.ContactPartner,"TWO","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([REPLACED])
    expect(report.lines[0]?.description).toBe('Partner')
  })

  test('RT-23 IFirm.ContactID holds the return\'s client code in every "entered" export, before and after opening the return', () => {
    const made = makeReturn({ clientCode: 'C042' })
    expect(readExport(made, 'entered').seen.get('IFirm.ContactID')?.value).toBe('C042')
    mustImport(made, file([[GIFI_CASH, amt(1)]]))
    expect(readExport(made, 'entered').seen.get('IFirm.ContactID')?.value).toBe('C042')
    made.sim.openReturn(made.ret)
    expect(readExport(made, 'entered').seen.get('IFirm.ContactID')?.value).toBe('C042')
    expect(readExport(made, 'entered').seen.get('IDENT.Ident451')?.value).toBe('C042')
  })

  test('RT-2 the module exports no token constant and no release cell is a token cell', () => {
    expect(Object.keys(simModule).filter((k) => /token/i.test(k))).toEqual([])
    for (const list of [defaultReleaseList(), fixtureList()]) {
      for (const cell of list) expect(`${cell.identifier} ${cell.description}`).not.toMatch(/token/i)
    }
    const made = makeReturn()
    expect(asText(made.sim.exportCsv(made.ret, 'all-input'))).not.toMatch(/token/i)
  })
})

// ---------- the default release list and the defaults ----------

describe('RT-23 the default release list and constructor defaults', () => {
  test('RT-23 the default list holds the 300 GIFI input cells (amount, confirmed) and the eight creation cells, with unique ascending orders', () => {
    const list = defaultReleaseList()
    const byId = new Map(list.map((c) => [c.identifier, c]))
    for (const cell of GIFI_IDS) expect(byId.get(cell), cell).toMatchObject({ kind: 'amount', confirmed: true })
    for (const cell of EIGHT) expect(byId.has(cell), cell).toBe(true)
    const orders = list.map((c) => c.order)
    expect(new Set(orders).size).toBe(orders.length)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(new Set(list.map((c) => c.identifier)).size).toBe(list.length)
  })

  test('RT-23 default-list descriptions are Taxprep\'s own text: three GIFI cells match the day 2 export word for word', () => {
    const day2 = parseOk(taxprepBytes('reference/taxprep/2026-10-02-day2/exports/rt-07-imported-default.csv'))
    const byId = new Map(defaultReleaseList().map((c) => [c.identifier, c.description]))
    const expected: Record<string, string> = {
      'GFGBA.Ttwgba64': 'GIFI code 1002 - Deposits in Canadian banks and institutions - Canadian currency',
      'GFGBA.Ttwgba72': 'GIFI code 1062 - Trade accounts receivable',
      'GFGBA.Ttwgba127': 'GIFI code 1484 - Prepaid expenses',
    }
    for (const [cell, text] of Object.entries(expected)) {
      expect(day2.rows.find((r) => r.id.text === cell)?.description, `day 2 export ${cell}`).toBe(text)
      expect(byId.get(cell), cell).toBe(text)
    }
  })

  test('RT-23 the default list covers every cell of every sample client\'s import file (12 at first, 15 since W15)', () => {
    const ids = new Set(defaultReleaseList().map((c) => c.identifier))
    const dirs = readdirSync(new URL('../../../../reference/sample-clients/', import.meta.url)).filter((d) => /^\d\d-/.test(d))
    expect(dirs.length).toBeGreaterThanOrEqual(15)
    for (const d of dirs) {
      const csv = taxprepBytes(`reference/sample-clients/${d}/taxprep/import.csv`)
      for (const row of parseOk(csv).rows) expect(ids.has(row.id.text), `${d} ${row.id.text}`).toBe(true)
    }
  })

  test('RT-3 a simulator made with only its id source takes the default list, imports client 01 and exports every row with its own header', () => {
    const sim = createSimulator({ newGuid: () => GUID_1 })
    const importBytes = taxprepBytes(`${SAMPLES[0].dir}/taxprep/import.csv`)
    const imported = parseOk(importBytes)
    const ret = sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: imported.header.returnName,
      corporationName: imported.header.returnName,
      clientCode: 'C001',
    })
    expect(ret.guid).toBe(GUID_1)
    expect(sim.importCsv(ret, importBytes).ok).toBe(true)
    const out = parseOk(sim.exportCsv(ret, 'entered'))
    expect(out.header).toEqual({ returnName: imported.header.returnName, guid: ret.guid })
    const seen = new Set(out.rows.map((r) => r.id.text))
    for (const row of imported.rows) expect(seen.has(row.id.text), row.id.text).toBe(true)
  })

  test('RT-23 the release name is the one given to the simulator and is kept on every return', () => {
    const sim = createSimulator({ releaseList: fixtureList(), releaseName: 'CCH iFirm 2026.20.198267', newGuid: () => GUID_1 })
    const ret = sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: 'Probe Co. (Test)',
      corporationName: 'Probe Co. (Test)',
      clientCode: 'C000',
    })
    expect(ret.releaseName).toBe('CCH iFirm 2026.20.198267')
    expect(ret.businessNumber).toBe('100000001RC0001')
    expect(ret.yearEnd).toBe('2025-12-31')
    expect(ret.returnName).toBe('Probe Co. (Test)')
  })

  test('ARC-14 two simulators do not share returns', () => {
    const a = makeSim()
    const b = makeSim()
    const input = {
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: 'Probe Co. (Test)',
      corporationName: 'Probe Co. (Test)',
      clientCode: 'C000',
    }
    a.createReturn(input)
    expect(b.getReturn(input.businessNumber, input.yearEnd)).toBeUndefined()
  })
})

// ---------- round 3 (findings wave 2): descriptions, single-source lists, apostrophe by kind, id source ----------

describe('RT-3 the default list\'s descriptions are the day 2 export text, nothing invented (round 3 item 14)', () => {
  const IDENT230 = 'Line 990 - Indicate your language of correspondence of your choice.|`English|`Fran\u00e7ais'

  test('RT-3 every default-list description equals the day 2 export text for that cell, and is "" where no day 2 export holds it', () => {
    const day2 = day2Descriptions()
    expect(day2.size).toBeGreaterThan(300)
    const list = defaultReleaseList()
    for (const cell of list) expect(cell.description, cell.identifier).toBe(day2.get(cell.identifier) ?? '')
  })

  test('RT-3 IDENT.Ident230 carries its full export text; Ident492 and IFirm.ContactID, blank in the exports, stay ""', () => {
    const day2 = day2Descriptions()
    expect(day2.get('IDENT.Ident230')).toBe(IDENT230)
    expect(day2.get('IDENT.Ident492')).toBe('')
    expect(day2.get('IFirm.ContactID')).toBe('')
    const byId = new Map(defaultReleaseList().map((c) => [c.identifier, c.description]))
    expect(byId.get('IDENT.Ident230')).toBe(IDENT230)
    expect(byId.get('IDENT.Ident492')).toBe('')
    expect(byId.get('IFirm.ContactID')).toBe('')
  })

  test('RT-3 the default list\'s "entered" export writes the export text in the description column, Ident230 with its accent as the byte 0xE7', () => {
    const sim = createSimulator({ newGuid: () => GUID_1 })
    const ret = sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: 'Probe Co. (Test)',
      corporationName: 'Probe Co. (Test)',
      clientCode: 'C000',
    })
    const bytes = Buffer.from(sim.exportCsv(ret, 'entered'))
    const rows = new Map(parseOk(bytes).rows.map((r) => [r.id.text, r.description]))
    expect(rows.get('IDENT.Ident230')).toBe(IDENT230)
    expect(rows.get('IDENT.Ident492')).toBe('')
    expect(rows.get('IFirm.ContactID')).toBe('')
    expect(bytes.includes(Buffer.from('`Fran\u00e7ais', 'latin1'))).toBe(true)
  })
})

describe('RT-13 the skip list and the eight cells come from F03 and F03R, the same objects (round 3 item 15)', () => {
  test('RT-13 the simulator\'s ignored-on-import list is F03\'s IGNORED_ON_IMPORT itself (toBe, not a copy)', () => {
    const sim = makeSim()
    expect(sim.ignoredOnImport).toBe(IGNORED_ON_IMPORT)
    expect(createSimulator({ newGuid: () => GUID_1 }).ignoredOnImport).toBe(IGNORED_ON_IMPORT)
  })

  test('RT-13 the simulator\'s always-exported cells are F03R\'s ALWAYS_EXPORTED itself (toBe, not a copy), the same eight cells as the trial\'s', () => {
    const sim = makeSim()
    expect(sim.alwaysExported).toBe(ALWAYS_EXPORTED)
    expect(createSimulator({ newGuid: () => GUID_1 }).alwaysExported).toBe(ALWAYS_EXPORTED)
    expect(new Set(ALWAYS_EXPORTED.map((c) => c.identifier))).toEqual(new Set(EIGHT))
  })

  test('RT-13 a row for each cell on F03\'s IGNORED_ON_IMPORT, even a clear, changes nothing and gives no line, no event', () => {
    const made = makeReturn({ name: 'Probe Co. (Test)', clientCode: 'C000' })
    const before = asText(made.sim.exportCsv(made.ret, 'all-input'))
    const rows = IGNORED_ON_IMPORT.flatMap((c) => [`${c.identifier},"9","",""`, `${c.identifier},"","",""`])
    expect(rows.length).toBeGreaterThan(0)
    expect(mustImport(made, rawFile(rows))).toEqual({ lines: [], summary: OK })
    expect(asText(made.sim.exportCsv(made.ret, 'all-input'))).toBe(before)
    expect(made.sim.events(made.ret)).toEqual([])
  })

  test('RT-13 every cell on F03R\'s ALWAYS_EXPORTED is in the "entered" export of a fresh return, cleared or not', () => {
    const made = makeReturn()
    made.sim.openReturn(made.ret)
    const ids = readExport(made, 'entered').ids
    for (const c of ALWAYS_EXPORTED) expect(ids, c.identifier).toContain(c.identifier)
    expect(ids).toHaveLength(ALWAYS_EXPORTED.length)
  })
})

describe('RT-3 the exported apostrophe is chosen by the cell\'s kind (round 3 item 16; unconfirmed beyond amount cells)', () => {
  const lineOf = (text: string, cell: string): string | undefined => text.split('\r\n').find((l) => l.startsWith(`${cell},`))

  test('RT-3 a negative whole number in an amount cell exports with exactly one leading apostrophe', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.typeCell(made.ret, GIFI_CASH, '-1299')
    const text = asText(made.sim.exportCsv(made.ret, 'entered'))
    expect(lineOf(text, GIFI_CASH)).toBe(`${GIFI_CASH},"'-1299","","${describeOf(GIFI_CASH)}"`)
  })

  test('RT-3 (unconfirmed) a negative decimal in a rate cell exports with no apostrophe', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.addCopy(made.ret, CCA)
    made.sim.typeCell(made.ret, RATE_CELL(1), '-0.0500')
    const text = asText(made.sim.exportCsv(made.ret, 'entered'))
    expect(lineOf(text, RATE_CELL(1))).toBe(`${RATE_CELL(1)},"-0.0500","","CCA rate"`)
    expect(readExport(made, 'entered').seen.get(RATE_CELL(1))).toMatchObject({ value: '-0.0500', apostrophe: false })
  })

  test('RT-3 (unconfirmed) "-5" in a text cell exports with no apostrophe, typed by hand or imported (planted fault: a value-text rule would add one)', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.addCopy(made.ret, CCA)
    made.sim.addCopy(made.ret, CCA)
    made.sim.typeCell(made.ret, CLASS_CELL(1), '-5')
    expect(mustImport(made, rawFile([`${CLASS_CELL(2)},"-5","",""`]))).toEqual({ lines: [], summary: OK })
    const text = asText(made.sim.exportCsv(made.ret, 'entered'))
    expect(lineOf(text, CLASS_CELL(1))).toBe(`${CLASS_CELL(1)},"-5","","CCA class number"`)
    expect(lineOf(text, CLASS_CELL(2))).toBe(`${CLASS_CELL(2)},"-5","","CCA class number"`)
    expect(text).not.toContain(`"'-5"`)
  })

  test('RT-3 (unconfirmed) a negative whole number in a rate cell gets no apostrophe either: the kind decides, not the text', () => {
    const made = makeReturn({ list: extendedList() })
    made.sim.addCopy(made.ret, CCA)
    made.sim.typeCell(made.ret, RATE_CELL(1), '-5')
    made.sim.typeCell(made.ret, UCC_CELL(1), '-5')
    const out = readExport(made, 'entered')
    expect(out.seen.get(RATE_CELL(1))).toMatchObject({ value: '-5', apostrophe: false })
    expect(out.seen.get(UCC_CELL(1))).toMatchObject({ value: '-5', apostrophe: true })
  })

  test('RT-3 ARC-14 the by-kind export reads back into a fresh return unchanged: text "-5" stays text, the amount keeps its apostrophe', () => {
    const a = makeReturn({ list: extendedList(), guids: [GUID_1] })
    a.sim.addCopy(a.ret, CCA)
    a.sim.typeCell(a.ret, CLASS_CELL(1), '-5')
    a.sim.typeCell(a.ret, UCC_CELL(1), '-700')
    a.sim.typeCell(a.ret, RATE_CELL(1), '-0.0500')
    const first = a.sim.exportCsv(a.ret, 'entered')
    const b = makeReturn({ list: extendedList(), guids: [GUID_1] })
    expect(b.sim.importCsv(b.ret, first).ok).toBe(true)
    expect(asText(b.sim.exportCsv(b.ret, 'entered'))).toBe(asText(first))
  })
})

describe('ARC-14 the id source is required (round 3 item 17)', () => {
  const loose = createSimulator as unknown as (options?: unknown) => unknown

  test('ARC-14 constructing the simulator with no options is refused with a reason that names newGuid', () => {
    expect(() => loose()).toThrow(/newGuid/)
  })

  test('ARC-14 options without an id source, or with one that is not a function, are refused with the reason', () => {
    expect(() => loose({ releaseList: fixtureList() })).toThrow(/newGuid/)
    expect(() => loose({ releaseList: fixtureList(), newGuid: 'not a function' })).toThrow(/newGuid/)
    const opts: SimulatorOptions = { releaseList: fixtureList(), newGuid: () => GUID_2 }
    const sim = createSimulator(opts)
    const ret = sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: 'Probe Co. (Test)',
      corporationName: 'Probe Co. (Test)',
      clientCode: 'C000',
    })
    expect(ret.guid).toBe(GUID_2)
  })
})

// ---------- source rules: ARC-14, ARC-15, F03 only ----------

describe('ARC-14, ARC-15 the simulator source follows the rules the card names', () => {
  const coreDir = new URL('./', import.meta.url)
  const files = (): { name: string; text: string }[] => {
    const out: { name: string; text: string }[] = []
    const walk = (dir: URL, prefix: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (entry.name === '__fixtures__' || entry.name === '__golden__') continue
          walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
        } else if (entry.name.endsWith('.ts') && !/\.test\.ts$/.test(entry.name)) {
          // the committed text, even inside Stryker's sandbox (DG round 3, readOwnSource)
          out.push({ name: `${prefix}${entry.name}`, text: readOwnSource(fileURLToPath(new URL(entry.name, dir))) })
        }
      }
    }
    walk(coreDir, 'core/')
    out.push({ name: 'index.ts', text: readOwnSource(fileURLToPath(new URL('../index.ts', import.meta.url))) })
    return out
  }

  test('ARC-15 every non-test .ts file under core/ and index.ts is marked "// @mutate" in its first 5 lines (as mutate-changed reads it)', () => {
    const all = files()
    expect(all.filter((f) => f.name.startsWith('core/')).length).toBeGreaterThan(0)
    for (const f of all) {
      expect(f.text.split(/\r?\n/).slice(0, 5).map((l) => l.trim()), f.name).toContain('// @mutate')
    }
  })

  test('ARC-14 no file reads the clock or randomness: only the injected guid source makes a guid', () => {
    for (const f of files()) {
      expect(f.text, f.name).not.toMatch(/Date\.now\s*\(|new Date\s*\(\s*\)|Math\.random|randomUUID|randomBytes|performance\.now/)
    }
  })

  test('RT-3 the simulator reads and writes CSV only through F03: it uses parseTaxprepCsv and writeTaxprepCsv and no second reader', () => {
    const all = files()
    const text = all.map((f) => f.text).join('\n')
    expect(text).toMatch(/parseTaxprepCsv/)
    expect(text).toMatch(/writeTaxprepCsv/)
    expect(text).toMatch(/contracts\/taxprep/)
    for (const f of all) {
      expect(f.text, f.name).not.toMatch(/\.split\(\s*['"`],['"`]\s*\)|\.split\(\s*\/\\r\?\\n\/|\.split\(\s*['"`]\\r?\\n['"`]/)
    }
  })

  test('RT-2 no source file names a token cell', () => {
    for (const f of files()) expect(f.text, f.name).not.toMatch(/\bTOKEN\b|import[_ ]token/i)
  })

  // round 3 item 15 (RC4): one source for the skip list and the eight cells. A local list is any bracketed span with no
  // inner bracket that quotes two or more of the eight identifiers (an array of them, or of objects naming them).
  const quoted = `['"\`](?:${EIGHT.map((c) => c.replace(/\./g, '\\.')).join('|')})['"\`]`
  const localList = new RegExp(`\\[[^\\[\\]]*${quoted}[^\\[\\]]*${quoted}[^\\[\\]]*\\]`)

  test('RT-13 the scan for a local list of the creation cells catches one (planted fault)', () => {
    const planted = `export const CREATION_CELLS = [\n  'IDENT.Ident120',\n  'IDENT.Ident121',\n]\n`
    const plantedDrafts = `const D = [\n  { identifier: 'IDENT.Ident492', kind: 'yesNo' },\n  { identifier: "IFirm.ContactID", kind: 'text' },\n]\n`
    expect(planted).toMatch(localList)
    expect(plantedDrafts).toMatch(localList)
    expect(`values.set('IDENT.Ident311', name)\nvalues.set('IDENT.Ident230', '1')\nconst k: string[] = []\n`).not.toMatch(localList)
  })

  test('RT-13 no source file keeps its own list of the eight creation and contact cells; the module uses F03\'s IGNORED_ON_IMPORT and F03R\'s ALWAYS_EXPORTED', () => {
    const all = files()
    for (const f of all) expect(f.text, f.name).not.toMatch(localList)
    const text = all.map((f) => f.text).join('\n')
    expect(text).toMatch(/\bIGNORED_ON_IMPORT\b/)
    expect(text).toMatch(/\bALWAYS_EXPORTED\b/)
  })
})

// ---------- spec round 4 (Opus spec review, 3 Oct; A402): reports/S00-spec-review.md gaps 2 to 11 ----------

const centsLine = (v: string): string => `The value ${v} could not be imported in this cell because it was invalid.`
const lineIn = (text: string, cell: string): string | undefined =>
  text.split('\r\n').find((l) => l.startsWith(`${cell},`))

describe('RT-26 a known cell\'s report line names its form and box (review gap 2)', () => {
  test('RT-26 a replaced, an emptied and a cents-refused line each carry the cell\'s form, description and box from the release list', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '100')
    mustImport(made, rawFile([`IFirm.ContactPartner,"PARTNER-ABC","",""`]))
    const first = mustImport(made, rawFile([`${GIFI_CASH},"200","",""`, `IFirm.ContactPartner,"","",""`]))
    expect(first.lines).toEqual([
      { form: 'S1599', description: describeOf(GIFI_CASH), box: '1002', result: REPLACED },
      { form: 'IW', description: 'Partner', box: '', result: EMPTIED },
    ])
    const second = mustImport(made, rawFile([`${GIFI_CASH},"48600.01","",""`]))
    expect(second.lines).toEqual([
      { form: 'S1599', description: describeOf(GIFI_CASH), box: '1002', result: centsLine('48600.01') },
    ])
  })

  test('RT-26 a cell the list gives no form or box gets "" for both, never another cell\'s or "--"', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '1')
    made.sim.typeCell(made.ret, GIFI_RECEIVABLE, '2')
    const report = mustImport(made, rawFile([`${GIFI_CASH},"3","",""`, `${GIFI_RECEIVABLE},"4","",""`]))
    expect(report.lines).toEqual([
      { form: 'S1599', description: describeOf(GIFI_CASH), box: '1002', result: REPLACED },
      { form: '', description: describeOf(GIFI_RECEIVABLE), box: '', result: REPLACED },
    ])
  })
})

describe('RT-3 the property over rate and yes or no cells too (review gap 3)', () => {
  const list = extendedList()
  const kindOf = new Map(list.map((c) => [c.identifier, c.kind]))
  const amountCells = [...GIFI_IDS.slice(0, 4), UCC_CELL(1), UCC_CELL(2)]
  const rateCells = [RATE_CELL(1), RATE_CELL(2)]
  const blank = fc.constantFrom('', ' ')
  const amountRaw = fc.oneof(
    { weight: 4, arbitrary: fc.integer({ min: -99999, max: 99999 }).map(String) },
    { weight: 1, arbitrary: blank },
  )
  const rateRaw = fc.oneof(
    {
      weight: 3,
      arbitrary: fc
        .tuple(fc.boolean(), fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 9999 }))
        .map(([neg, i, f]) => `${neg ? '-' : ''}${String(i)}.${String(f).padStart(4, '0')}`),
    },
    { weight: 1, arbitrary: fc.integer({ min: -99, max: 99 }).map(String) },
    { weight: 1, arbitrary: blank },
  )
  const op = fc.oneof(
    { weight: 3, arbitrary: fc.tuple(fc.constantFrom(...amountCells), amountRaw) },
    { weight: 2, arbitrary: fc.tuple(fc.constantFrom(...rateCells), rateRaw) },
    { weight: 1, arbitrary: fc.tuple(fc.constant(YES_NO), fc.constantFrom('Y', 'N', '', ' ')) },
  )

  test('RT-3 RT-12 for any rows over amount, rate and yes or no cells, "entered" holds the last value per cell, the yes or no cell N after a blank, and the apostrophe by kind (seed fixed)', () => {
    fc.assert(
      fc.property(fc.array(op, { minLength: 1, maxLength: 25 }), (ops) => {
        const made = makeReturn({ list })
        made.sim.addCopy(made.ret, CCA)
        made.sim.addCopy(made.ret, CCA)
        made.sim.typeCell(made.ret, YES_NO, 'Y')
        const report = mustImport(made, rawFile(ops.map(([cell, raw]) => `${cell},"${raw}","",""`)))
        for (const line of report.lines) expect([REPLACED, EMPTIED]).toContain(line.result)
        const last = new Map<string, string>([[YES_NO, 'Y']])
        for (const [cell, raw] of ops) last.set(cell, cell === YES_NO && raw.trim() === '' ? 'N' : raw)
        const out = readExport(made, 'entered')
        for (const cell of [...amountCells, ...rateCells, YES_NO]) {
          const want = last.get(cell)
          if (want === undefined || want.trim() === '') {
            expect(out.ids, cell).not.toContain(cell)
            continue
          }
          expect(out.seen.get(cell)?.value, cell).toBe(want)
          // a repeating cell is listed once with copy index [1] and stands for every copy
          const kind = kindOf.get(cell.replace(/\[\d+\]/, '[1]'))
          expect(kind, cell).toBeDefined()
          expect(out.seen.get(cell)?.apostrophe, cell).toBe(exportedApostrophe(kind ?? 'text', want))
        }
        const held = [...last.values()].filter((v) => v.trim() !== '').length
        expect(out.ids).toHaveLength(held + EIGHT.length)
      }),
      { seed: SEED, numRuns: 100 },
    )
  })
})

describe('RT-26 the report rule as a property (review gap 4)', () => {
  const list = fixtureList()
  const known = [GIFI_CASH, GIFI_RECEIVABLE, GIFI_PREPAID, ...GIFI_IDS.filter((c) => ![GIFI_CASH, GIFI_RECEIVABLE, GIFI_PREPAID].includes(c)).slice(0, 5)]
  const unknown = ['GFGBA.Ttwgba999991', 'GFGBA.Ttwgba999992', 'ZZTEST.Ttw1']
  type Raw = { kind: 'whole' | 'blank' | 'cents'; raw: string }
  const knownRaw: fc.Arbitrary<Raw> = fc.oneof(
    { weight: 3, arbitrary: fc.integer({ min: -99999, max: 99999 }).map((n): Raw => ({ kind: 'whole', raw: String(n) })) },
    { weight: 1, arbitrary: fc.constantFrom<Raw>({ kind: 'blank', raw: '' }, { kind: 'blank', raw: ' ' }) },
    {
      weight: 1,
      arbitrary: fc
        .tuple(fc.integer({ min: 0, max: 99999 }), fc.integer({ min: 0, max: 99 }))
        .map(([i, c]): Raw => ({ kind: 'cents', raw: `${String(i)}.${String(c).padStart(2, '0')}` })),
    },
  )
  const row = fc.oneof(
    { weight: 4, arbitrary: fc.tuple(fc.constantFrom(...known), knownRaw) },
    { weight: 1, arbitrary: fc.tuple(fc.constantFrom(...unknown), fc.integer({ min: 0, max: 999 }).map((n): Raw => ({ kind: 'whole', raw: String(n) }))) },
  )

  test('RT-26 for any held cells and any rows (distinct cells), the lines are one per row whose cell held a value, one per refused or unknown row, none else, in row order; the summary shows exactly when there are none (seed fixed)', () => {
    fc.assert(
      fc.property(
        fc.subarray(known),
        fc.uniqueArray(row, { selector: (r) => r[0], minLength: 1, maxLength: 11 }),
        (held, rows) => {
          const made = makeReturn()
          for (const [i, cell] of held.entries()) made.sim.typeCell(made.ret, cell, String(i * 7))
          const report = mustImport(made, rawFile(rows.map(([cell, v]) => `${cell},"${v.raw}","",""`)))
          const want: { form: string; description: string; box: string; result: string }[] = []
          for (const [cell, v] of rows) {
            if (unknown.includes(cell)) want.push(CELL_NA)
            else if (v.kind === 'cents') want.push({ ...whereOf(list, cell), result: centsLine(v.raw) })
            else if (held.includes(cell)) want.push({ ...whereOf(list, cell), result: v.kind === 'blank' ? EMPTIED : REPLACED })
          }
          expect(report.lines).toEqual(want)
          expect(report.summary).toBe(want.length === 0 ? OK : null)
        },
      ),
      { seed: SEED, numRuns: 100 },
    )
  })
})

describe('RT-25 cents by class: plain and repeating amount cells (review gap 5)', () => {
  for (const v of ['48600.01', '100.00', '.5', '-0.01']) {
    test(`RT-25 ${v} is refused in a plain amount cell and in a repeating amount copy with the trial's wording; nothing changes, the rest imports`, () => {
      const made = makeReturn()
      made.sim.addCopy(made.ret, CCA)
      made.sim.typeCell(made.ret, GIFI_CASH, '100')
      made.sim.typeCell(made.ret, UCC_CELL(1), '5000')
      const before = made.sim.events(made.ret).length
      const report = mustImport(
        made,
        rawFile([`${GIFI_CASH},"${v}","",""`, `${UCC_CELL(1)},"${v}","",""`, `${GIFI_RECEIVABLE},"7","",""`]),
      )
      expect(report.lines).toEqual([
        { ...whereOf(fixtureList(), GIFI_CASH), result: centsLine(v) },
        { ...whereOf(fixtureList(), UCC_CELL(1)), result: centsLine(v) },
      ])
      expect(report.summary).toBeNull()
      const out = readExport(made, 'entered')
      expect(out.seen.get(GIFI_CASH)?.value).toBe('100')
      expect(out.seen.get(UCC_CELL(1))?.value).toBe('5000')
      expect(out.seen.get(GIFI_RECEIVABLE)?.value).toBe('7')
      expect(made.sim.events(made.ret).slice(before)).toEqual([{ identifier: GIFI_RECEIVABLE, source: 'import', value: '7' }])
    })
  }

  test('RT-25 RT-7 (unconfirmed) a cents row naming the next free copy index is refused and creates no copy', () => {
    const made = makeReturn()
    made.sim.addCopy(made.ret, CCA)
    const report = mustImport(made, rawFile([`${UCC_CELL(2)},"48600.01","",""`, `${GIFI_CASH},"1","",""`]))
    expect(report.lines.map((l) => l.result)).toEqual([centsLine('48600.01')])
    expect(made.sim.copyCount(made.ret, CCA)).toBe(1)
    expect(readExport(made, 'all-input').ids).not.toContain(UCC_CELL(2))
    expect(made.sim.events(made.ret).map((e) => e.identifier)).toEqual([GIFI_CASH])
  })
})

describe('RT-9 Windows-1252 at its boundary (review gap 6)', () => {
  test('RT-9 a return named "O’Neil € (Test)" exports ’ as 0x92 and € as 0x80, in the header and the name cell, with no UTF-8 bytes', () => {
    const name = 'O’Neil € (Test)'
    const made = makeReturn({ name, clientCode: 'C000' })
    mustImport(made, file([[GIFI_CASH, amt(10)]]))
    const bytes = Buffer.from(made.sim.exportCsv(made.ret, 'entered'))
    const enc = Buffer.from([0x4f, 0x92, ...Buffer.from('Neil ', 'latin1'), 0x80, ...Buffer.from(' (Test)', 'latin1')])
    expect(bytes.subarray(0, enc.length + 1).equals(Buffer.concat([Buffer.from('['), enc]))).toBe(true)
    expect(bytes.includes(Buffer.concat([Buffer.from('IDENT.Ident311,"', 'latin1'), enc, Buffer.from('"')]))).toBe(true)
    expect(bytes.filter((b) => b === 0x92).length).toBe(2)
    expect(bytes.filter((b) => b === 0x80).length).toBe(2)
    expect(bytes.includes(Buffer.from([0xe2]))).toBe(false)
    expect(readExport(made, 'entered').header.returnName).toBe(name)
    expect(readExport(made, 'entered').seen.get('IDENT.Ident311')?.value).toBe(name)
  })
})

describe('RT-3 text holding an apostrophe or a comma (review gap 7)', () => {
  test('RT-3 O\'Brien, "A, B" and \'-5 in text cells: import, export, import into a fresh return, export gives the same bytes and the same stored values', () => {
    const a = makeReturn({ guids: [GUID_1] })
    for (let i = 0; i < 3; i++) a.sim.addCopy(a.ret, CCA)
    mustImport(a, rawFile([`${CLASS_CELL(1)},"O'Brien","",""`, `${CLASS_CELL(2)},"A, B","",""`, `${CLASS_CELL(3)},"'-5","",""`]))
    const first = a.sim.exportCsv(a.ret, 'entered')
    const text = asText(first)
    expect(lineIn(text, CLASS_CELL(1))).toBe(`${CLASS_CELL(1)},"O'Brien","","CCA class number"`)
    expect(lineIn(text, CLASS_CELL(2))).toBe(`${CLASS_CELL(2)},"A, B","","CCA class number"`)
    // F03's reader strips the one apostrophe before a negative whole number (RT-3); a text cell exports none back (A333)
    expect(lineIn(text, CLASS_CELL(3))).toBe(`${CLASS_CELL(3)},"-5","","CCA class number"`)
    const b = makeReturn({ guids: [GUID_1] })
    expect(b.sim.importCsv(b.ret, first).ok).toBe(true)
    const second = b.sim.exportCsv(b.ret, 'entered')
    expect(asText(second)).toBe(text)
    for (const made of [a, b]) {
      const seen = readExport(made, 'entered').seen
      expect(seen.get(CLASS_CELL(1))?.value).toBe("O'Brien")
      expect(seen.get(CLASS_CELL(2))?.value).toBe('A, B')
      expect(seen.get(CLASS_CELL(3))).toMatchObject({ value: '-5', apostrophe: false })
    }
  })

  test('RT-3 the test-data filter keeps O\'Brien and "A, B" and drops what F03 refuses (planted: an apostrophe in a number, a thousands comma)', () => {
    expect(readsBackAs("O'Brien")).toBe(true)
    expect(readsBackAs('A, B')).toBe(true)
    expect(readsBackAs("1'2")).toBe(false)
    expect(readsBackAs('1,234')).toBe(false)
  })
})

describe('RT-13, RT-2 the three creation cells that take imports (review gap 8; unconfirmed: the trial has not imported into them)', () => {
  test('RT-13 (unconfirmed) rows for IDENT.Ident230, IDENT.Ident451 and IFirm.ContactID set them like any input cell, each with a "replaced" line (each holds a value from creation)', () => {
    const made = makeReturn({ clientCode: 'C042' })
    const report = mustImport(
      made,
      rawFile([`IDENT.Ident230,"2","",""`, `IDENT.Ident451,"C777","",""`, `IFirm.ContactID,"C778","",""`]),
    )
    expect(report.lines).toEqual([
      { ...whereOf(fixtureList(), 'IDENT.Ident230'), result: REPLACED },
      { ...whereOf(fixtureList(), 'IDENT.Ident451'), result: REPLACED },
      { ...whereOf(fixtureList(), 'IFirm.ContactID'), result: REPLACED },
    ])
    const out = readExport(made, 'entered')
    expect(out.seen.get('IDENT.Ident230')?.value).toBe('2')
    expect(out.seen.get('IDENT.Ident451')?.value).toBe('C777')
    expect(out.seen.get('IFirm.ContactID')?.value).toBe('C778')
    expect(made.sim.events(made.ret)).toEqual([
      { identifier: 'IDENT.Ident230', source: 'import', value: '2' },
      { identifier: 'IDENT.Ident451', source: 'import', value: 'C777' },
      { identifier: 'IFirm.ContactID', source: 'import', value: 'C778' },
    ])
  })

  test('RT-2 (unconfirmed) after openReturn() IFirm.ContactID holds the return\'s client code again, whatever was imported into it', () => {
    const made = makeReturn({ clientCode: 'C042' })
    mustImport(made, rawFile([`IFirm.ContactID,"C778","",""`, `IFirm.ContactPartner,"PARTNER-ABC","",""`]))
    made.sim.openReturn(made.ret)
    const out = readExport(made, 'entered')
    expect(out.seen.get('IFirm.ContactID')?.value).toBe('C042')
    expect(out.seen.get('IFirm.ContactPartner')?.value).toBe('')
  })
})

describe('RT-9 a file F03 refuses (review gap 9; unconfirmed against the trial, S01 and S03 own the fault set)', () => {
  test('RT-9 (unconfirmed) a file with an unquoted value is refused whole with F03\'s own faults; no event, both exports unchanged', () => {
    const made = makeReturn()
    mustImport(made, file([[GIFI_CASH, amt(100)]]))
    const enteredBefore = asText(made.sim.exportCsv(made.ret, 'entered'))
    const allBefore = asText(made.sim.exportCsv(made.ret, 'all-input'))
    const eventsBefore = [...made.sim.events(made.ret)]
    const bytes = rawFile([`${GIFI_RECEIVABLE},"5","",""`, `${GIFI_PREPAID},7,"",""`])
    const f03 = parseTaxprepCsv(bytes)
    expect(f03.ok).toBe(false)
    const faults = f03.ok ? [] : f03.faults
    expect(faults.some((f) => f.code === 'unquoted')).toBe(true)
    expect(made.sim.importCsv(made.ret, bytes)).toEqual({ ok: false, faults })
    expect(made.sim.events(made.ret)).toEqual(eventsBefore)
    expect(asText(made.sim.exportCsv(made.ret, 'entered'))).toBe(enteredBefore)
    expect(asText(made.sim.exportCsv(made.ret, 'all-input'))).toBe(allBefore)
  })
})

describe('RT-23 a hand edit off the release list is refused with its reason (review gap 10)', () => {
  const reason = /GFGBA\.Ttwgba999999|not on the release list/

  test('RT-23 typeCell on a cell off the release list throws a reason naming the cell or "not on the release list"; nothing changes', () => {
    const made = makeReturn()
    const before = asText(made.sim.exportCsv(made.ret, 'all-input'))
    expect(() => {
      made.sim.typeCell(made.ret, 'GFGBA.Ttwgba999999', '5')
    }).toThrow(reason)
    expect(made.sim.events(made.ret)).toEqual([])
    expect(asText(made.sim.exportCsv(made.ret, 'all-input'))).toBe(before)
  })

  test('RT-23 clearCell on a cell off the release list throws the same kind of reason; nothing changes', () => {
    const made = makeReturn()
    made.sim.typeCell(made.ret, GIFI_CASH, '5')
    const before = asText(made.sim.exportCsv(made.ret, 'all-input'))
    expect(() => {
      made.sim.clearCell(made.ret, 'GFGBA.Ttwgba999999')
    }).toThrow(reason)
    expect(made.sim.events(made.ret)).toEqual([{ identifier: GIFI_CASH, source: 'typed', value: '5' }])
    expect(asText(made.sim.exportCsv(made.ret, 'all-input'))).toBe(before)
  })
})

describe('ARC-14, RT-3 Taxprep\'s own bytes (review gap 11)', () => {
  test('ARC-14 RT-3 the day 2 Riverdale export, imported into a default-list return set up as it says, exports back byte for byte plus the IFirm.ContactID row day 5 added', () => {
    const real = day2ExportBytes('rt-07-imported-default.csv')
    const header = parseOk(real).header
    expect(header.returnName).toBe('Riverdale Rentals Inc. (Test)')
    const sim = createSimulator({ newGuid: () => header.guid })
    const ret = sim.createReturn({
      businessNumber: '100000001RC0001',
      yearEnd: '2025-12-31',
      returnName: header.returnName,
      corporationName: header.returnName,
      clientCode: '1',
    })
    sim.setYear(ret, { start: '2025-01-01', end: '2025-12-31' })
    expect(sim.importCsv(ret, real).ok).toBe(true)
    expect(asText(sim.exportCsv(ret, 'entered'))).toBe(`${asText(real)}IFirm.ContactID,"1","",""\r\n`)
  })
})
