// S00 test harness (spec-writer only; builders never edit). Test-side helpers for the Taxprep simulator tests.
// Nothing here imports the simulator's own code except its public types and factory (from '../../index').
import { readFileSync } from 'node:fs'
import {
  parseCellId,
  parseTaxprepCsv,
  writeTaxprepCsv,
  type CellId,
  type ParsedRow,
  type TaxprepHeader,
  type WriteRow,
  type WriteValue,
} from '../../../../contracts/taxprep'
import { createSimulator, type ReleaseCell, type SimReturn, type Simulator } from '../../index'

export const SEED = 20261002

const repoUrl = (rel: string): URL => new URL(`../../../../../${rel}`, import.meta.url)
export const goldenUrl = (name: string): URL => new URL(`../__golden__/${name}`, import.meta.url)
export const goldenBytes = (name: string): Buffer => readFileSync(goldenUrl(name))

/** A committed reference CSV (LF or CRLF in git, by checkout) with the CRLF line ends Taxprep wrote. */
export function taxprepBytes(rel: string): Buffer {
  const raw = readFileSync(repoUrl(rel))
  return Buffer.from(raw.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1')
}

export const asText = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1')
export const fromText = (text: string): Buffer => Buffer.from(text, 'latin1')

export function id(text: string): CellId {
  const r = parseCellId(text)
  if (!r.ok) throw new Error(`test fixture: ${text} should parse: ${r.reason}`)
  return r.id
}

export function parseOk(bytes: Uint8Array): { header: TaxprepHeader; rows: ParsedRow[] } {
  const r = parseTaxprepCsv(bytes)
  if (!r.ok) throw new Error(`expected the file to parse, got faults: ${JSON.stringify(r.faults)}`)
  return r.file
}

// ---------- the release list the tests give the simulator ----------

const cells = JSON.parse(readFileSync(repoUrl('reference/sample-clients/lib/taxprep-cells.json'), 'utf8')) as {
  gifi: { byCode: Record<string, string> }
}

export const CCA = 'CCACat.FD08C'
export const CLASS_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA1`
export const UCC_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA5`
export const CLAIMED_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA22`

/** The eight creation and contact cells of the "entered" export (RT-13, RT-15), in list order. */
export const EIGHT = [
  'IDENT.Ident120',
  'IDENT.Ident121',
  'IDENT.Ident311',
  'IDENT.Ident230',
  'IDENT.Ident451',
  'IDENT.Ident492',
  'IFirm.ContactPartner',
  'IFirm.ContactID',
] as const

/** GIFI input cells (300, amount cells), then the eight creation cells, then the S8 copy cells (repeating). */
export function fixtureList(): ReleaseCell[] {
  const list: Omit<ReleaseCell, 'order'>[] = []
  for (const [code, identifier] of Object.entries(cells.gifi.byCode)) {
    list.push({ identifier, description: `GIFI code ${code} - Test description`, kind: 'amount' })
  }
  list.push(
    { identifier: 'IDENT.Ident120', description: 'Line 060 - Tax year start date', kind: 'date' },
    { identifier: 'IDENT.Ident121', description: 'Line 061 - Tax year-end', kind: 'date' },
    { identifier: 'IDENT.Ident311', description: "Corporation's name", kind: 'text' },
    { identifier: 'IDENT.Ident230', description: 'Line 990 - Language of correspondence', kind: 'text' },
    { identifier: 'IDENT.Ident451', description: 'CCH iFirm - Client code', kind: 'text' },
    { identifier: 'IDENT.Ident492', description: '', kind: 'yesNo' },
    { identifier: 'IFirm.ContactPartner', description: 'Partner', kind: 'text' },
    { identifier: 'IFirm.ContactID', description: 'Contact ID', kind: 'text' },
    { identifier: CLASS_CELL(1), description: 'CCA class number', kind: 'text', repeating: true },
    { identifier: UCC_CELL(1), description: 'UCC at start of year', kind: 'amount', repeating: true },
    { identifier: CLAIMED_CELL(1), description: 'CCA claimed', kind: 'amount', repeating: true },
  )
  return list.map((c, i) => ({ ...c, order: i + 1 }))
}

export const YES_NO = 'IDENT.Ident240'
export const RATE_CELL = (n: number): string => `${CCA}[${String(n)}].FED.Ttw08cA2`

/**
 * The fixture list plus a yes or no cell (`IDENT.Ident240`, line 070, not on F03's ignored-on-import list) and the
 * S8 rate cell (A2, exported to 4 decimals: FINDINGS run 4). Kept apart from fixtureList() so the goldens and the
 * property do not depend on how an untouched yes or no cell is exported (the trial has not said).
 */
export function extendedList(): ReleaseCell[] {
  const base = fixtureList()
  const extra: Omit<ReleaseCell, 'order'>[] = [
    { identifier: YES_NO, description: 'Line 070 - Test yes or no', kind: 'yesNo' },
    { identifier: RATE_CELL(1), description: 'CCA rate', kind: 'rate', repeating: true },
  ]
  return [...base, ...extra.map((c, i) => ({ ...c, order: base.length + i + 1 }))]
}

export const GIFI_IDS: string[] = Object.values(cells.gifi.byCode)
export const GIFI_CASH = 'GFGBA.Ttwgba64'
export const GIFI_RECEIVABLE = 'GFGBA.Ttwgba72'
export const GIFI_PREPAID = 'GFGBA.Ttwgba127'

// ---------- building a simulator and a return ----------

export const GUID_1 = '11111111-1111-4111-8111-111111111111'
export const GUID_2 = '22222222-2222-4222-8222-222222222222'

/** A simulator whose guid source hands out the given guids in order, then numbered ones. */
export function makeSim(guids: string[] = [GUID_1, GUID_2], list: ReleaseCell[] = fixtureList()): Simulator {
  const queue = [...guids]
  let n = 0
  return createSimulator({
    releaseList: list,
    newGuid: () => queue.shift() ?? `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  })
}

export type Made = { sim: Simulator; ret: SimReturn }

export function makeReturn(
  opts: {
    name?: string
    corp?: string
    clientCode?: string
    bn?: string
    yearEnd?: string
    guids?: string[]
    list?: ReleaseCell[]
  } = {},
): Made {
  const sim = makeSim(opts.guids, opts.list)
  const name = opts.name ?? 'Probe Co. (Test)'
  const ret = sim.createReturn({
    businessNumber: opts.bn ?? '100000001RC0001',
    yearEnd: opts.yearEnd ?? '2025-12-31',
    returnName: name,
    corporationName: opts.corp ?? name,
    clientCode: opts.clientCode ?? 'C000',
  })
  sim.setYear(ret, { start: '2025-01-01', end: '2025-12-31' })
  return { sim, ret }
}

// ---------- import files ----------

export const HEADER: TaxprepHeader = { returnName: 'Anything (Test)', guid: '00000000-0000-0000-0000-000000000000' }

export const amt = (amount: number): WriteValue => ({ kind: 'amount', amount })
export const txt = (text: string): WriteValue => ({ kind: 'text', text })
export const clr: WriteValue = { kind: 'clear' }

/** An import file from (identifier, value) pairs through F03's writer; 'export' purpose so any cell may be named. */
export function file(pairs: [string, WriteValue][], header: TaxprepHeader = HEADER): Uint8Array {
  const rows: WriteRow[] = pairs.map(([cell, current]) => ({ id: id(cell), current }))
  const r = writeTaxprepCsv({ header, rows }, { purpose: 'export' })
  if (!r.ok) throw new Error(`test fixture file refused: ${JSON.stringify(r.problems)}`)
  return r.bytes
}

/** A hand-made file body (exact text, CRLF added) for rows F03's writer would refuse, such as cents. */
export function rawFile(rows: string[], header = `[Anything (Test)|0|0|00000000-0000-0000-0000-000000000000],"Current Year","Last Year",""`): Uint8Array {
  return fromText([header, ...rows].join('\r\n') + '\r\n')
}

export function mustImport(made: Made, bytes: Uint8Array) {
  const r = made.sim.importCsv(made.ret, bytes)
  if (!r.ok) throw new Error(`expected the import to be applied, got faults: ${JSON.stringify(r.faults)}`)
  return r.report
}

export type Seen = Map<string, { value: string; apostrophe: boolean; description: string | null }>

/** An export read back through F03's reader: identifier to its current-year value. */
export function readExport(made: Made, filter: 'entered' | 'all-input'): { header: TaxprepHeader; rows: ParsedRow[]; seen: Seen; ids: string[] } {
  const file = parseOk(made.sim.exportCsv(made.ret, filter))
  const seen: Seen = new Map()
  for (const row of file.rows) {
    seen.set(row.id.text, {
      value: row.current.kind === 'clear' ? '' : row.current.text,
      apostrophe: row.apostrophe,
      description: row.description,
    })
  }
  return { ...file, seen, ids: file.rows.map((r) => r.id.text) }
}

// ---------- a reference model of the "entered" export, for the goldens ----------

/**
 * What the "entered" export of a fresh return must hold after one import of `importBytes`, written by hand from the
 * trial's rules (not by the simulator): the file's rows in list order with the creation cells, a leading apostrophe on
 * every negative, descriptions from the list, the return's own header. `fixed` gives the creation cells' values.
 */
export function referenceEntered(args: {
  importBytes: Uint8Array
  list: readonly ReleaseCell[]
  returnName: string
  guid: string
  fixed: Record<string, string>
}): Uint8Array {
  const file = parseOk(args.importBytes)
  const values = new Map<string, string>()
  for (const row of file.rows) {
    values.set(row.id.text, row.current.kind === 'clear' ? '' : row.current.text)
  }
  for (const [cell, v] of Object.entries(args.fixed)) values.set(cell, v)
  const eight = new Set<string>(EIGHT)
  let out = `[${args.returnName}|0|0|${args.guid}],"Current Year","Last Year",""\r\n`
  for (const cell of [...args.list].sort((a, b) => a.order - b.order)) {
    const v = values.get(cell.identifier)
    if (!eight.has(cell.identifier) && (v === undefined || v === '')) continue
    const shown = (v ?? '').startsWith('-') ? `'${v ?? ''}` : (v ?? '')
    out += `${cell.identifier},"${shown}","","${cell.description}"\r\n`
  }
  return fromText(out)
}
