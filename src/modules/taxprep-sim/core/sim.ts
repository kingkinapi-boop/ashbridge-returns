// @mutate
// The Taxprep simulator (S00): in-memory returns that import and export as the trial recorded
// (reference/taxprep/FINDINGS.md). Reads and writes CSV only through the F03 contract. Computes no tax.
import {
  parseCellId,
  parseTaxprepCsv,
  withCopyIndex,
  writeTaxprepCsv,
  type CellId,
  type TaxprepFault,
  type WriteRow,
} from '../../../contracts/taxprep'
import { CREATION_CELLS, defaultReleaseList, type ReleaseCell } from './release-list'

export type ReportLine = { form: string; description: string; box: string; result: string }
export type ImportReport = { lines: ReportLine[]; summary: 'Data imported successfully' | null }
export type SimEvent = { identifier: string; source: 'import' | 'typed' | 'cleared'; value: string }
export type ExportFilter = 'entered' | 'all-input'

export type SimReturn = {
  readonly returnName: string
  readonly guid: string
  readonly releaseName: string
  readonly businessNumber: string
  readonly yearEnd: string
}

export type CreateReturnInput = {
  businessNumber: string
  yearEnd: string
  returnName: string
  corporationName: string
  clientCode: string
}

export type SimulatorOptions = {
  releaseList?: readonly ReleaseCell[]
  newGuid?: () => string
  releaseName?: string
}

export type Simulator = {
  createReturn(input: CreateReturnInput): SimReturn
  getReturn(businessNumber: string, yearEnd: string): SimReturn | undefined
  importCsv(ret: SimReturn, bytes: Uint8Array): { ok: true; report: ImportReport } | { ok: false; faults: TaxprepFault[] }
  exportCsv(ret: SimReturn, filter: ExportFilter): Uint8Array
  typeCell(ret: SimReturn, identifier: string, value: string): void
  clearCell(ret: SimReturn, identifier: string): void
  setYear(ret: SimReturn, year: { start: string; end: string }): void
  addCopy(ret: SimReturn, copyPath: string): number
  copyCount(ret: SimReturn, copyPath: string): number
  openReturn(ret: SimReturn): void
  lock(ret: SimReturn): void
  unlock(ret: SimReturn): void
  isLocked(ret: SimReturn): boolean
  events(ret: SimReturn): readonly SimEvent[]
}

export const DEFAULT_RELEASE_NAME = 'CCH iFirm 2026.20.198267'

const SUCCESS = 'Data imported successfully'
const REPLACED = 'The value of this cell has been replaced by a new imported value.'
const EMPTIED = 'This cell has been emptied by the import.'
const NOT_AVAILABLE = 'Cell not available.'
const NONE = '--'
const YEAR_START = 'IDENT.Ident120'
const YEAR_END = 'IDENT.Ident121'
const NAME_CELL = 'IDENT.Ident311'
const LANGUAGE_CELL = 'IDENT.Ident230'
const CLIENT_CODE_CELL = 'IDENT.Ident451'
const FLAG_CELL = 'IDENT.Ident492'
const PARTNER_CELL = 'IFirm.ContactPartner'
const CONTACT_ID_CELL = 'IFirm.ContactID'
const WHOLE_DOLLARS = /^-?\d+$/
const NEGATIVE = /^-[1-9]\d*$/

type State = {
  values: Map<string, string>
  copies: Map<string, number>
  events: SimEvent[]
  locked: boolean
}

type Resolved = { cell: ReleaseCell; id: CellId }

function countingGuids(): () => string {
  let n = 0
  return () => {
    n += 1
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  }
}

function mustParse(identifier: string): CellId {
  const parsed = parseCellId(identifier)
  if (!parsed.ok) throw new Error(parsed.reason)
  return parsed.id
}

export function createSimulator(options: SimulatorOptions = {}): Simulator {
  const list = [...(options.releaseList ?? defaultReleaseList())].sort((a, b) => a.order - b.order)
  const byIdentifier = new Map(list.map((c) => [c.identifier, c]))
  const newGuid = options.newGuid ?? countingGuids()
  const releaseName = options.releaseName ?? DEFAULT_RELEASE_NAME
  const returns = new Map<string, SimReturn>()
  const states = new Map<SimReturn, State>()

  function stateOf(ret: SimReturn): State {
    const st = states.get(ret)
    if (st === undefined) throw new Error('this return belongs to another simulator')
    return st
  }

  function resolve(id: CellId): Resolved | null {
    const exact = byIdentifier.get(id.text)
    if (exact !== undefined) return { cell: exact, id }
    if (id.copyIndex === null) return null
    const template = byIdentifier.get(withCopyIndex(id, 1).text)
    if (template?.repeating !== true) return null
    return { cell: template, id }
  }

  function describe(cell: ReleaseCell): string {
    return cell.description
  }

  function held(st: State, identifier: string): boolean {
    return (st.values.get(identifier) ?? '') !== ''
  }

  function setValue(st: State, identifier: string, value: string): void {
    if (value === '') st.values.delete(identifier)
    else st.values.set(identifier, value)
  }

  /** The copy state a cell stands under: null when the cell is ordinary, else how its index sits against the copies. */
  function copyStatus(st: State, r: Resolved): 'none' | 'exists' | 'next' | 'gap' {
    if (r.cell.repeating !== true) return 'none'
    const path = r.id.copyPath as string
    const index = r.id.copyIndex as number
    const count = st.copies.get(path) ?? 0
    if (index <= count) return 'exists'
    return index === count + 1 ? 'next' : 'gap'
  }

  function createReturn(input: CreateReturnInput): SimReturn {
    const key = `${input.businessNumber}|${input.yearEnd}`
    const existing = returns.get(key)
    if (existing !== undefined) return existing
    const ret: SimReturn = Object.freeze({
      returnName: input.returnName,
      guid: newGuid(),
      releaseName,
      businessNumber: input.businessNumber,
      yearEnd: input.yearEnd,
    })
    const values = new Map<string, string>([
      [NAME_CELL, input.corporationName],
      [LANGUAGE_CELL, '1'],
      [CLIENT_CODE_CELL, input.clientCode],
      [FLAG_CELL, 'N'],
      [CONTACT_ID_CELL, input.clientCode],
    ])
    returns.set(key, ret)
    states.set(ret, { values, copies: new Map(), events: [], locked: false })
    return ret
  }

  function importCsv(ret: SimReturn, bytes: Uint8Array) {
    const st = stateOf(ret)
    const parsed = parseTaxprepCsv(bytes)
    if (!parsed.ok) return { ok: false as const, faults: parsed.faults }
    const lines: ReportLine[] = []
    for (const row of parsed.file.rows) {
      const text = row.id.text
      if (text === YEAR_START || text === YEAR_END || text === NAME_CELL || text === FLAG_CELL) continue
      const found = resolve(row.id)
      const status = found === null ? 'gap' : copyStatus(st, found)
      if (found === null || status === 'gap') {
        lines.push({ form: NONE, description: NONE, box: NONE, result: NOT_AVAILABLE })
        continue
      }
      const label = describe(found.cell)
      if (row.current.kind === 'clear') {
        if (status === 'next' || !held(st, text)) continue
        if (found.cell.kind === 'yesNo') {
          // FINDINGS Q20: a yes or no cell cannot be emptied; a clear resets it to N.
          setValue(st, text, 'N')
          st.events.push({ identifier: text, source: 'import', value: 'N' })
          lines.push({ form: NONE, description: label, box: NONE, result: REPLACED })
          continue
        }
        setValue(st, text, '')
        st.events.push({ identifier: text, source: 'import', value: '' })
        lines.push({ form: NONE, description: label, box: NONE, result: EMPTIED })
        continue
      }
      const value = row.current.text
      if (found.cell.kind === 'amount' && !WHOLE_DOLLARS.test(value)) {
        lines.push({
          form: NONE,
          description: label,
          box: NONE,
          result: `The value ${value} could not be imported in this cell because it was invalid.`,
        })
        continue
      }
      if (status === 'next') st.copies.set(row.id.copyPath as string, row.id.copyIndex as number)
      const replaced = held(st, text)
      setValue(st, text, value)
      st.events.push({ identifier: text, source: 'import', value })
      if (replaced) lines.push({ form: NONE, description: label, box: NONE, result: REPLACED })
    }
    const report: ImportReport = { lines, summary: lines.length === 0 ? SUCCESS : null }
    return { ok: true as const, report }
  }

  function exportCsv(ret: SimReturn, filter: ExportFilter): Uint8Array {
    const st = stateOf(ret)
    const creation = new Set(CREATION_CELLS)
    const rows: WriteRow[] = []
    const negatives: string[] = []
    for (const cell of list) {
      const base = mustParse(cell.identifier)
      const count = cell.repeating === true ? (st.copies.get(base.copyPath as string) ?? 0) : 1
      for (let n = 1; n <= count; n += 1) {
        const id = cell.repeating === true ? withCopyIndex(base, n) : base
        const value = st.values.get(id.text) ?? ''
        if (filter === 'entered' && value === '' && !creation.has(cell.identifier)) continue
        rows.push({
          id,
          current: value === '' ? { kind: 'clear' } : { kind: 'text', text: value },
          description: cell.description,
        })
        if (NEGATIVE.test(value)) negatives.push(id.text)
      }
    }
    const header = { returnName: ret.returnName, guid: ret.guid }
    const written = writeTaxprepCsv({ header, rows }, { purpose: 'export' })
    if (!written.ok) throw new Error(written.problems.map((p) => p.reason).join('; '))
    let text = Array.from(written.bytes, (b) => String.fromCharCode(b)).join('')
    // Taxprep's "-123" setting writes a leading apostrophe before every negative; F03's writer never does.
    let cursor = 0
    for (const identifier of negatives) {
      const marker = `\r\n${identifier},"-`
      const at = text.indexOf(marker, cursor)
      const quoteAt = at + marker.length - 1
      text = `${text.slice(0, quoteAt)}'${text.slice(quoteAt)}`
      cursor = quoteAt + 1
    }
    return Uint8Array.from(text, (ch) => ch.charCodeAt(0))
  }

  function onList(identifier: string, st: State): Resolved {
    const found = resolve(mustParse(identifier))
    if (found === null) throw new Error(`${identifier} is not on this release's list`)
    const status = copyStatus(st, found)
    if (status === 'next' || status === 'gap') throw new Error(`${identifier}: that copy does not exist`)
    return found
  }

  return {
    createReturn,
    getReturn: (businessNumber, yearEnd) => returns.get(`${businessNumber}|${yearEnd}`),
    importCsv,
    exportCsv,
    typeCell(ret, identifier, value) {
      const st = stateOf(ret)
      onList(identifier, st)
      setValue(st, identifier, value)
      st.events.push({ identifier, source: 'typed', value })
    },
    clearCell(ret, identifier) {
      const st = stateOf(ret)
      onList(identifier, st)
      setValue(st, identifier, '')
      st.events.push({ identifier, source: 'cleared', value: '' })
    },
    setYear(ret, year) {
      const st = stateOf(ret)
      setValue(st, YEAR_START, year.start)
      setValue(st, YEAR_END, year.end)
    },
    addCopy(ret, copyPath) {
      const st = stateOf(ret)
      const next = (st.copies.get(copyPath) ?? 0) + 1
      st.copies.set(copyPath, next)
      return next
    },
    copyCount: (ret, copyPath) => stateOf(ret).copies.get(copyPath) ?? 0,
    openReturn(ret) {
      setValue(stateOf(ret), PARTNER_CELL, '')
    },
    lock(ret) {
      stateOf(ret).locked = true
    },
    unlock(ret) {
      stateOf(ret).locked = false
    },
    isLocked: (ret) => stateOf(ret).locked,
    events: (ret) => [...stateOf(ret).events],
  }
}
