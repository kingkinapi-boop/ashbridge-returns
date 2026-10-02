// @mutate
// The identifier list of one Taxprep release (S00): what a simulated return accepts, in the order it exports.
import cellsFile from '../../../../reference/sample-clients/lib/taxprep-cells.json'
import gifiDescriptions from './gifi-descriptions.json'

export type CellKind = 'amount' | 'text' | 'date' | 'yesNo' | 'rate'

export type ReleaseCell = {
  identifier: string
  description: string
  kind: CellKind
  order: number
  /** Listed once with copy index [1]; stands for the same cell under every copy of its form. */
  repeating?: boolean
  confirmed?: boolean
}

/** The eight creation and contact cells every "entered" export lists, even when empty (RT-13, RT-15). */
export const CREATION_CELLS: readonly string[] = [
  'IDENT.Ident120',
  'IDENT.Ident121',
  'IDENT.Ident311',
  'IDENT.Ident230',
  'IDENT.Ident451',
  'IDENT.Ident492',
  'IFirm.ContactPartner',
  'IFirm.ContactID',
]

type Draft = Omit<ReleaseCell, 'order'>

const CREATION_DRAFTS: readonly Draft[] = [
  { identifier: 'IDENT.Ident120', description: 'Line 060 - Tax year start date', kind: 'date' },
  { identifier: 'IDENT.Ident121', description: 'Line 061 - Tax year-end', kind: 'date' },
  { identifier: 'IDENT.Ident311', description: "Corporation's name", kind: 'text' },
  { identifier: 'IDENT.Ident230', description: 'Line 990 - Language of correspondence', kind: 'text' },
  { identifier: 'IDENT.Ident451', description: 'CCH iFirm - Client code', kind: 'text' },
  { identifier: 'IDENT.Ident492', description: 'Creation flag', kind: 'yesNo' },
  { identifier: 'IFirm.ContactPartner', description: 'Partner', kind: 'text' },
  { identifier: 'IFirm.ContactID', description: 'Contact ID', kind: 'text' },
]

/** The 300 GIFI input cells (amount, confirmed in the trial's exports; descriptions are Taxprep's own text from the day 2 exports), then the eight creation cells. */
export function defaultReleaseList(): readonly ReleaseCell[] {
  const drafts: Draft[] = []
  for (const [code, identifier] of Object.entries(cellsFile.gifi.byCode)) {
    drafts.push({ identifier, description: (gifiDescriptions as Record<string, string>)[identifier] ?? `GIFI code ${code}`, kind: 'amount', confirmed: true })
  }
  drafts.push(...CREATION_DRAFTS)
  return drafts.map((d, i) => ({ ...d, order: i + 1 }))
}
