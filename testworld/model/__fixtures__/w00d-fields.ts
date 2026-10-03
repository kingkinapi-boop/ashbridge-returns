// Spec-owned helpers for the W00d acceptance tests (card W00d, split from W00c by A501; reports/W00c-check.md items
// 1 to 5 and suspicions).
//
// Two kinds of list live here, and nothing in them is copied from the code under test:
// - the field list of the raw schemas is DERIVED from the schemas' own shape (A426): schemaFields() walks the zod
//   definitions load.ts exports as RAW_SCHEMAS (see below), never a hand copy of them;
// - the READ and carried lists are the spec's own record of what the loader must do with each field (the card:
//   "a test compares the READ list (w00c-r3-walk.ts) and the carried list with the raw schema's field list").
//
// What W00d's build exports (the one new public name the tests read): `RAW_SCHEMAS` from testworld/clients/load.ts,
// an object with the keys 'answer-key.json' and 'onboarding.json', each the zod schema the loader parses that file
// with (RawKey and RawOnboarding today). The tests read it through a namespace import, so a build that has not added
// it fails by name ("load.ts exports RAW_SCHEMAS"), not with a missing-import error.
import { passesCheckDigit } from '../guard'
import type { WalkClient } from './sample-walk'
import { READ, READ_ONBOARDING, pattern, type JsonFile } from './w00c-r3-walk'

// ---- the raw schema's field list, from the schema's shape (A426) ----

/** One field of a raw schema: its label "<file> <generic path>" (pattern() applied) and whether it is declared carried (unknown). */
export interface SchemaField {
  label: string
  carried: boolean
}

interface ZodLike {
  _zod: { def: Record<string, unknown> & { type: string } }
}
const isZod = (x: unknown): x is ZodLike =>
  x !== null && typeof x === 'object' && '_zod' in x && typeof (x as { _zod?: { def?: { type?: unknown } } })._zod?.def?.type === 'string'

/** The wrappers whose meaning is the schema inside them (an optional, nullable or defaulted field is still its field). */
const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault', 'readonly', 'nonoptional', 'catch'])

/**
 * Every leaf field of a zod schema, as generic paths: array items add "[]" to their key, a record's keys are "*",
 * the three trial balances are "*" (pattern() of w00c-r3-walk.ts). An object's own path is not a field; its keys are.
 * A field whose schema is unknown (or any) is carried; any other leaf (string, number, boolean, enum, literal, a
 * union) is typed.
 */
export function schemaFields(file: JsonFile, schema: unknown): SchemaField[] {
  const out = new Map<string, boolean>()
  const add = (generic: string, carried: boolean): void => {
    const label = `${file} ${pattern(generic)}`
    // The three trial balances share one schema: a label seen twice keeps "typed" if any copy is typed.
    out.set(label, (out.get(label) ?? true) && carried)
  }
  const walk = (s: unknown, generic: string): void => {
    if (!isZod(s)) throw new Error(`fixture: ${file} ${generic} is not a zod schema`)
    const def = s._zod.def
    if (WRAPPERS.has(def.type)) {
      walk(def['innerType'], generic)
      return
    }
    if (def.type === 'pipe') {
      walk(def['in'], generic)
      return
    }
    if (def.type === 'object') {
      for (const [k, v] of Object.entries(def['shape'] as Record<string, unknown>)) walk(v, generic === '' ? k : `${generic}.${k}`)
      return
    }
    if (def.type === 'array') {
      walk(def['element'], `${generic}[]`)
      return
    }
    if (def.type === 'record') {
      walk(def['valueType'], generic === '' ? '*' : `${generic}.*`)
      return
    }
    add(generic, def.type === 'unknown' || def.type === 'any')
  }
  walk(schema, '')
  return [...out].map(([label, carried]) => ({ label, carried }))
}

/** Is this label the entry itself or a field inside it ("<entry>." or "<entry>[]" follows)? */
export const within = (label: string, entry: string): boolean => label === entry || label.startsWith(`${entry}.`) || label.startsWith(`${entry}[]`)

// ---- the spec's lists ----

const key = (gs: readonly string[]): string[] => gs.map((g) => `answer-key.json ${g}`)
const onb = (gs: readonly string[]): string[] => gs.map((g) => `onboarding.json ${g}`)

/**
 * The four typed fields of reports/W00c-check.md items 2 and 3 that W00c neither held nor checked, and the adjusting
 * entry's TB-2 type (A511). W00d reads each: a change refuses the load or changes the model (the plants in
 * w00d-fields.acceptance.test.ts and w00d-types.acceptance.test.ts).
 */
export const W00D_READ: readonly string[] = [
  ...key(['accounts[].tag', 'parties[].kind', 't2Inputs.schedule50[].businessNumber', 'adjustingEntries[].type']),
  ...onb(['cra_program_accounts[].account_number']),
]

/** Name fields the made-up-data guard reads (SEC-11): a name not ending "(Test)" is refused (proved by a plant). */
export const GUARD_NAMES: readonly string[] = [
  ...key(['parties[].name', 't2Inputs.schedule50[].name']),
  ...onb(['corporation.legal_name', 'related_entities[].entity_name', 'shares.holders[].name', 'shareholder_loans[].lender', 'spouse.name']),
]

/** Nine-digit numbers the guard reads: one that passes the check digit is refused (SEC-11; proved by a plant). */
export const GUARD_NUMBERS: readonly string[] = key(['t2Inputs.schedule50[].sin'])

/** Evidence lists the id walk and resolves() read (W00c RC-C): an id or onboarding path that does not resolve is refused. */
export const REFS: readonly string[] = key([
  'flags[].evidence.transactions[]',
  'flags[].evidence.onboarding[]',
  'flags[].evidence.adjustingEntries[]',
  't2Inputs.schedule1.addBacks[].source.transactions[]',
  't2Inputs.schedule1.addBacks[].source.onboarding[]',
  't2Inputs.schedule1.addBacks[].source.adjustingEntries[]',
])

/** Every typed field the loader reads, by list: each must be a typed field of the raw schema (never declared carried). */
export const READ_LISTS: Readonly<Record<string, readonly string[]>> = {
  'READ (w00c-r3-walk.ts)': [...READ, ...READ_ONBOARDING],
  W00D_READ,
  GUARD_NAMES,
  GUARD_NUMBERS,
  REFS,
}

/**
 * Parts the model holds whole (Client.priorYear): every field at or under the entry is parsed through a typed schema,
 * none is declared carried (reports/W00c-check.md item 4: prior_year was declared carried and held raw).
 */
export const MODEL_WHOLE: readonly string[] = key(['prior_year'])

/**
 * The carried list: keys written in the sample files that no card has read yet. An entry covers itself and every field
 * under it (a later card may describe a carried part further). A carried field may be typed: a type is never a loss.
 */
export const CARRIED: readonly string[] = [
  ...key(['accounts[].layout', 'accounts[].balanceMeaning', 'accounts[].holder']),
  ...key(
    ['description', 'currency', 'kind', 'line', 'qboLine', 'gifi', 'gifiStatus', 'hstItc', 'hstCollected', 'pair', 'notes', 'flags', 'mirror', 'postedVia', 'personal', 'external', 'business', 'suggestedPost', 'payroll', 'parts'].map(
      (f) => `transactions[].${f}`,
    ),
  ),
  ...key(['statementBalances.*[].note']),
  ...key(['name', 'gifiName', 'note', 'source'].flatMap((f) => [`adjustingEntries[].lines[].${f}`, `trialBalance.*.rows[].${f}`])),
  ...key(['adjustingEntries[].note', 'adjustingEntries[].confirm']),
  ...key(['trialBalance.basis', 'trialBalance.netIncomeLossBeforeTax']),
  ...key(['flags[].judgement', 'flags[].blocking']),
  ...key(['t2Inputs.schedule50[].percentCommonShares', 't2Inputs.schedule50[].percentPreferredShares']),
  ...key(['item', 'amount', 'reason', 'confirm', 'source.account'].map((f) => `t2Inputs.schedule1.addBacks[].${f}`)),
  ...key(['t2Inputs.schedule1.deductions', 't2Inputs.schedule1.note']),
  ...key(
    ['netIncomeLossPerBooksBeforeTax', 'schedule8', 'schedule3', 'slips', 'schedule4', 'schedule23', 'shareholderLoan', 'instalments', 'schedule6', 'investmentIncomeCheck', 'schedule9', 'specifiedInvestmentBusiness', 'taxationYear', 'pendingDecisions', 'lines', 'losses'].map(
      (f) => `t2Inputs.${f}`,
    ),
  ),
  ...key(['client', 'generator', 'idRule', 'amountConvention', 'postingCurrency', 'hst', 'notes', 'assets', 'fx', 'ohip', 'nonOhipIncome']),
  ...onb(
    ['jurisdiction', 'all_prior_years_filed', 'client_type', 'claims_small_business_deduction', 'hst_filing_frequency', 'hst_basis', 'books_kept_by', 'hst_registration_effective', 'first_taxation_year', 'outstanding_years', 'financial_year_end_confirmed'].map(
      (f) => `corporation.${f}`,
    ),
  ),
  ...onb(['prior_year_closing_balances.accounts', 'prior_year_closing_balances.ucc']),
  ...onb(['cra_program_accounts[].program', 'cra_program_accounts[].is_open']),
  ...onb(['role', 'holder_kind', 'approximate_share_percent', 'share_class', 'tax_residency', 'sin'].map((f) => `owners[].${f}`)),
  ...onb(['related_entities[].entity_role', 'related_entities[].ownership_percent', 'related_entities[].note']),
  ...onb(['shares.holders[].percent', 'shares.holders[].paid', 'shares.class', 'shares.issued_on', 'shares.total_paid']),
  ...onb(['amount', 'received_on', 'interest', 'written_terms'].map((f) => `shareholder_loans[].${f}`)),
  ...onb(['spouse.paid_by_company', 'spouse.note']),
  ...onb(
    ['note', 'is_test', 'accounts_provided', 'services', 'staff', 'hst', 'home_office', 'vehicle', 'personal_card_business_items', 'declared_dividends', 'client_notes', 'loan', 'cra_record', 'payroll', 'owner_bonus', 'card_processing_fees_by_month', 'business_limit', 'capital_dividend', 'grip', 'investments_held', 'inventory', 'fx', 'sales_channels', 'tenants', 'mortgage', 'property', 'grant', 'research', 'prior_year_note', 'answers', 'ohip_remittance_advice', 'engagements'],
  ),
]

/** Why a schema field breaks the lists, or undefined when it is covered as it should be. */
export function fieldProblem(f: SchemaField): string | undefined {
  const lists = Object.entries(READ_LISTS).filter(([, l]) => l.includes(f.label)).map(([n]) => n)
  if (lists.length > 0) return f.carried ? `${f.label} is on ${lists.join(', ')} but the schema declares it carried (unknown), so it is never read` : undefined
  if (MODEL_WHOLE.some((e) => within(f.label, e))) return f.carried ? `${f.label} is held whole in the model but declared carried (unknown), so it is never parsed` : undefined
  if (CARRIED.some((e) => within(f.label, e))) return undefined
  return `${f.label} is a field of the raw schema on neither the READ lists nor the carried list`
}

// ---- small helpers ----

/** The digits with the last one replaced so the whole number passes the check digit (a planted "real" number). */
export function withValidCheckDigit(digits: string): string {
  const head = digits.slice(0, -1)
  for (let d = 0; d <= 9; d++) if (passesCheckDigit(`${head}${String(d)}`)) return `${head}${String(d)}`
  throw new Error('fixture: no check digit')
}

/** The digits with the last one moved up (mod 10) until the number differs and still fails the check digit, as made-up numbers do. */
export function oneDigitOff(digits: string): string {
  const head = digits.slice(0, -1)
  const last = Number(digits.slice(-1))
  for (let step = 1; step <= 9; step++) {
    const next = `${head}${String((last + step) % 10)}`
    if (!passesCheckDigit(next)) return next
  }
  throw new Error('fixture: no other failing digit')
}

/** The raw onboarding and answer-key views the plants need. */
export interface Party {
  name: string
  kind?: string
}
export const partiesOf = (c: WalkClient): Party[] => (c.key as unknown as { parties?: Party[] }).parties ?? []
export const ownersOf = (c: WalkClient): { name: string; holder_kind?: string }[] => (c.onboarding['owners'] as { name: string; holder_kind?: string }[] | undefined) ?? []
export const schedule50Of = (c: WalkClient): { name: string; sin?: string; businessNumber?: string }[] =>
  (c.key as unknown as { t2Inputs?: { schedule50?: { name: string; sin?: string; businessNumber?: string }[] } }).t2Inputs?.schedule50 ?? []
export const relatedOf = (c: WalkClient): { entity_name: string }[] => (c.onboarding['related_entities'] as { entity_name: string }[] | undefined) ?? []
export const craOf = (c: WalkClient): { account_number: string }[] => (c.onboarding['cra_program_accounts'] as { account_number: string }[] | undefined) ?? []
export const businessNumberOf = (c: WalkClient): string => (c.onboarding['corporation'] as { business_number: string }).business_number
export const tagsOf = (c: WalkClient): { key: string; tag: string }[] => c.key.accounts as unknown as { key: string; tag: string }[]

/**
 * The kind another written fact of the same client fixes for a party, or undefined when none does: an owner's
 * holder_kind ("person" or a company form), a Schedule 50 row's sin (a person) or businessNumber (a company), a
 * related entity (a company).
 */
export function kindFixedFor(c: WalkClient, name: string): 'person' | 'company' | undefined {
  const owner = ownersOf(c).find((o) => o.name === name)
  if (owner?.holder_kind !== undefined) return owner.holder_kind === 'person' ? 'person' : 'company'
  const s50 = schedule50Of(c).find((s) => s.name === name)
  if (s50?.sin !== undefined) return 'person'
  if (s50?.businessNumber !== undefined) return 'company'
  if (relatedOf(c).some((r) => r.entity_name === name)) return 'company'
  return undefined
}
