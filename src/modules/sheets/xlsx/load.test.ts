// A07C unit tests: what counts as a workbook (EV-14).
import { describe, expect, test } from 'vitest'
import { storedZip } from '../__fixtures__/harness'
import { NOT_A_WORKBOOK, readXlsx } from './index'

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'

function workbook(sheets: string, sheetXml?: string): Uint8Array {
  const entries: [string, string][] = [
    ['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`],
    ['_rels/.rels', `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${sheets}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
  ]
  if (sheetXml !== undefined) entries.push(['xl/worksheets/sheet1.xml', sheetXml])
  return storedZip(entries)
}

describe('EV-14 a zip is a workbook only when it loads and holds a sheet', () => {
  test('EV-14 a workbook with one empty sheet reads; the same workbook with no sheets is refused', async () => {
    const sheet = `${XML}<worksheet xmlns="${NS}"><sheetData/></worksheet>`
    const ok = await readXlsx(workbook('<sheet name="Only (Test)" sheetId="1" r:id="rId1"/>', sheet))
    expect(ok.ok && ok.sheets.map((s) => s.name)).toEqual(['Only (Test)'])
    expect(await readXlsx(workbook('', sheet))).toEqual({ ok: false, reason: NOT_A_WORKBOOK })
  })

  test('EV-14 a workbook whose sheet XML the library cannot read is refused, never read as empty', async () => {
    const out = await readXlsx(workbook('<sheet name="Broken (Test)" sheetId="1" r:id="rId1"/>', `${XML}<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>1</row></sheetData></worksheet>`))
    expect(out).toEqual({ ok: false, reason: NOT_A_WORKBOOK })
  })
})
