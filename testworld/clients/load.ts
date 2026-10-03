// @mutate
// Loads one sample client from reference/sample-clients/ in place (never copied or rewritten) into the model (ARC-8).
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { decimalToCents } from '../../src/core/money'
import { faults, type FaultEntry } from '../model/faults'
import { guardIssues, type GuardFile } from '../model/guard'
import { modelIssues } from '../model/checks'
import { repeatedKeys, reservedKeys } from './json-keys'
import { ACCOUNT_ROLES, CLIENT_ID, ClientSchema, TestWorldLoadError, calendarDate, isCalendarDate, type Client, type ClientId, type LoadIssue } from '../model/schema'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SAMPLE_ROOT = join(REPO_ROOT, 'reference', 'sample-clients')

// Amounts arrive as integer cents: readJson turns each money field's text into cents, never through a float (ARC-13).
// Every object the loader describes is strict (W00c RC-A): a key it does not declare is a 'schema' issue, never dropped.
// A key written but not read here is declared `carried` (`u`), with the card that reads it named in the comment above it.
const dollars = z.number()
const u = z.unknown().optional()
const ids = z.array(z.string())
const line = z.strictObject({
  account: z.string(),
  gifi: z.number().int().nullish(),
  gifiStatus: z.string().nullish(),
  debit: dollars,
  credit: dollars,
  // carried (T-family trial balance cards): names, notes and the source of an opening row
  name: u,
  gifiName: u,
  note: u,
  source: u,
})
const tb = z.strictObject({ rows: z.array(line), totalDebit: dollars, totalCredit: dollars })

const RawKey = z.strictObject({
  name: z.string(),
  fiscalYear: z.strictObject({ start: calendarDate, end: calendarDate, days: z.number().int() }),
  accounts: z.array(
    z.strictObject({
      key: z.string(),
      tag: z.string(),
      role: z.enum(ACCOUNT_ROLES),
      currency: z.string(),
      file: z.string(),
      qboFile: z.string(),
      glAccount: z.string(),
      openingBalance: dollars,
      closingBalance: dollars,
      rowsInExport: z.number().int(),
      rowsMissingFromExport: z.number().int(),
      // carried (W00b, B04 and the statement cards)
      layout: u,
      balanceMeaning: u,
      holder: u,
    }),
  ),
  transactions: z.array(
    z.strictObject({
      id: z.string(),
      acct: z.string(),
      date: calendarDate,
      amount: dollars,
      account: z.string(),
      accountNo: z.string().nullish(),
      missingFromExport: z.boolean().optional(),
      dupOf: z.string().optional(),
      priorYear: z.boolean().optional(),
      post: z.array(z.strictObject({ a: z.string(), dr: dollars.optional(), cr: dollars.optional() })).optional(),
      // carried (the matching, HST, payroll and posting cards: B04, JH0, S00)
      description: u,
      currency: u,
      kind: u,
      line: u,
      qboLine: u,
      gifi: u,
      gifiStatus: u,
      hstItc: u,
      hstCollected: u,
      pair: u,
      notes: u,
      flags: u,
      mirror: u,
      postedVia: u,
      personal: u,
      external: u,
      business: u,
      suggestedPost: u,
      payroll: u,
      parts: u,
    }),
  ),
  statementBalances: z.record(
    z.string(),
    z.array(z.strictObject({ month: z.string(), opening: dollars, closing: dollars, exportActivity: dollars, rolls: z.boolean(), note: u })),
  ),
  adjustingEntries: z.array(
    z.strictObject({
      id: z.string(),
      date: calendarDate,
      amount: dollars,
      reason: z.string(),
      lines: z.array(line),
      source: z.strictObject({ transactions: z.array(z.string()), onboarding: z.array(z.string()) }),
      // carried (T-family adjusting entry cards)
      note: u,
      confirm: u,
    }),
  ),
  trialBalance: z.strictObject({ opening: tb, unadjusted: tb, adjusted: tb, basis: u, netIncomeLossBeforeTax: u }),
  flags: z.array(
    z.strictObject({
      id: z.string(),
      rule: z.string(),
      detail: z.string(),
      severity: z.string().optional(),
      action: z.string().optional(),
      evidence: z.strictObject({ transactions: ids.optional(), onboarding: ids.optional(), adjustingEntries: ids.optional() }).optional(),
      // carried (the flag cards)
      judgement: u,
      blocking: u,
    }),
  ),
  parties: z.array(z.strictObject({ name: z.string(), kind: z.string().optional() })),
  t2Inputs: z
    .strictObject({
      schedule50: z
        .array(z.strictObject({ name: z.string(), sin: z.string().optional(), businessNumber: z.string().optional(), percentCommonShares: u, percentPreferredShares: u }))
        .optional(),
      schedule1: z
        .strictObject({
          addBacks: z
            .array(
              z.strictObject({
                item: u,
                amount: u,
                reason: u,
                confirm: u,
                source: z.strictObject({ account: u, adjustingEntries: ids.optional(), transactions: ids.optional(), onboarding: ids.optional() }).optional(),
              }),
            )
            .optional(),
          deductions: u,
          note: u,
        })
        .optional(),
      // carried (the T2 schedule cards, T-family): every other part of the T2 inputs
      netIncomeLossPerBooksBeforeTax: u,
      schedule8: u,
      schedule3: u,
      slips: u,
      schedule4: u,
      schedule23: u,
      shareholderLoan: u,
      instalments: u,
      schedule6: u,
      investmentIncomeCheck: u,
      schedule9: u,
      specifiedInvestmentBusiness: u,
      taxationYear: u,
      pendingDecisions: u,
      lines: u,
      losses: u,
    })
    .optional(),
  prior_year: u,
  // carried (W00b, FX8, the HST, OHIP, asset and FX cards): top-level parts the model does not read yet
  client: u,
  generator: u,
  idRule: u,
  amountConvention: u,
  postingCurrency: u,
  hst: u,
  notes: u,
  assets: u,
  fx: u,
  ohip: u,
  nonOhipIncome: u,
})

const RawOnboarding = z.strictObject({
  corporation: z.strictObject({
    legal_name: z.string(),
    business_number: z.string(),
    financial_year_end: z.string().optional(),
    fiscal_year_start: z.string().optional(),
    incorporation_date: z.string().optional(),
    // carried (the engagement and tax-status cards)
    jurisdiction: u,
    all_prior_years_filed: u,
    client_type: u,
    claims_small_business_deduction: u,
    hst_filing_frequency: u,
    hst_basis: u,
    books_kept_by: u,
    hst_registration_effective: u,
    first_taxation_year: u,
    outstanding_years: u,
    financial_year_end_confirmed: u,
  }),
  prior_year_closing_balances: z.strictObject({ as_of: z.string().optional(), accounts: u, ucc: u }).optional(),
  cra_program_accounts: z.array(z.strictObject({ account_number: z.string(), program: u, is_open: u })).optional(),
  owners: z.array(
    z.strictObject({ name: z.string(), role: u, holder_kind: u, approximate_share_percent: u, share_class: u, tax_residency: u, sin: u }),
  ),
  related_entities: z.array(z.strictObject({ entity_name: z.string(), entity_role: u, ownership_percent: u, note: u })).optional(),
  shares: z
    .strictObject({
      holders: z.array(z.strictObject({ name: z.string(), percent: u, paid: u })).optional(),
      class: u,
      issued_on: u,
      total_paid: u,
    })
    .optional(),
  shareholder_loans: z
    .array(z.strictObject({ lender: z.string().optional(), amount: u, received_on: u, interest: u, written_terms: u }))
    .optional(),
  spouse: z.strictObject({ name: z.string().optional(), paid_by_company: u, note: u }).optional(),
  // carried (the onboarding and answers cards: answers is read raw by resolves() below)
  note: u,
  is_test: u,
  accounts_provided: u,
  services: u,
  staff: u,
  hst: u,
  home_office: u,
  vehicle: u,
  personal_card_business_items: u,
  declared_dividends: u,
  client_notes: u,
  loan: u,
  cra_record: u,
  payroll: u,
  owner_bonus: u,
  card_processing_fees_by_month: u,
  business_limit: u,
  capital_dividend: u,
  grip: u,
  investments_held: u,
  inventory: u,
  fx: u,
  sales_channels: u,
  tenants: u,
  mortgage: u,
  property: u,
  grant: u,
  research: u,
  prior_year_note: u,
  answers: u,
  ohip_remittance_advice: u,
  engagements: u,
})

/** The numbered folders of a sample-clients root, as client ids (C01 upward), in order. */
export function clientFolders(root: string = SAMPLE_ROOT): Map<ClientId, string> {
  const found = new Map<ClientId, string>()
  // A folder that is itself a link is not listed: loadClient refuses its id with a 'file' issue (W00c RC4).
  for (const e of readdirSync(root, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const m = /^(\d\d)-/.exec(e.name)
    // Stryker disable next-line StringLiteral: m[1] always exists once the pattern has matched; the fallback only satisfies noUncheckedIndexedAccess
    if (m !== null && e.isDirectory() && existsSync(join(root, e.name, 'answer-key.json'))) found.set(`C${m[1] ?? ''}`, join(root, e.name))
  }
  return found
}

/** The name of a linked numbered folder of the root that would be the client `id`, if there is one. */
function linkedFolder(root: string, id: string): string | undefined {
  return readdirSync(root, { withFileTypes: true }).find((e) => e.isSymbolicLink() && new RegExp(`^${id.slice(1)}-`).test(e.name))?.name
}

const AMOUNT_KEYS = new Set(['amount', 'debit', 'credit', 'dr', 'cr', 'opening', 'closing', 'openingBalance', 'closingBalance', 'exportActivity', 'totalDebit', 'totalCredit'])

/** Is this number a money field the loader reads? Decided by the shape of the object that holds it, so rates never match. */
function isMoneyField(key: string, holder: unknown): boolean {
  // Stryker disable next-line ConditionalExpression: JSON.parse always hands the reviver an object as holder, so the null and typeof tests never decide
  if (!AMOUNT_KEYS.has(key) || holder === null || typeof holder !== 'object') return false
  const h = holder as Record<string, unknown>
  // A transaction's amount, or an adjusting entry's (its lines are written beside its reason).
  if (key === 'amount') return ('acct' in h && 'date' in h) || ('lines' in h && 'reason' in h)
  if (key === 'totalDebit' || key === 'totalCredit') return 'rows' in h
  if (key === 'exportActivity') return 'month' in h
  if (key === 'debit' || key === 'credit') return 'account' in h
  if (key === 'dr' || key === 'cr') return 'a' in h
  if (key === 'opening' || key === 'closing') return 'month' in h
  return 'glAccount' in h
}

type Reviver = (this: unknown, key: string, value: unknown, context: { source?: string }) => unknown

/** Reads a JSON file; every money field becomes integer cents straight from its written text (no float on the way). */
function readJson(path: string, moneyIssue?: (record: string, reason: string) => void): unknown {
  const reviver: Reviver = function (key, value, context) {
    // Stryker disable next-line ConditionalExpression: a parsed number always has its source text in Node 24, so the undefined test never decides
    if (typeof value !== 'number' || context.source === undefined || !isMoneyField(key, this)) return value
    const r = decimalToCents(context.source)
    if (r.ok) return r.cents
    const id = (this as { id?: unknown }).id
    // Stryker disable next-line OptionalChaining: both callers pass moneyIssue, so the optional call and the plain call behave the same
    moneyIssue?.(`${basename(path)} ${typeof id === 'string' ? `${id} ` : ''}${key}`, r.reason)
    return 0
  }
  return JSON.parse(readFileSync(path, 'utf8'), reviver as Parameters<typeof JSON.parse>[1]) as unknown
}

/**
 * Reads one JSON file of the client folder. A file that is missing, is not a regular file (a directory) or is not valid
 * JSON is a 'file' issue and undefined, never a raw ENOENT, EISDIR or SyntaxError.
 */
function readClientJson(
  folder: string,
  name: string,
  moneyIssue: (record: string, reason: string) => void,
  fileIssue: (record: string, reason: string) => void,
): unknown {
  const path = join(folder, name)
  const kind = lstatSync(path, { throwIfNoEntry: false })
  if (kind === undefined) {
    fileIssue(name, 'the file is not in the client folder')
    return undefined
  }
  // lstat, not stat: a link to another file (another client's, say) is never read as this client's file.
  if (!kind.isFile()) {
    fileIssue(name, 'it is not a regular file')
    return undefined
  }
  const text = readFileSync(path, 'utf8')
  const again = repeatedKeys(text)
  // A prototype name as a key is dropped or reached through the prototype by z.record, so it is refused beside a repeat (W00c RC-A).
  const reserved = reservedKeys(text)
  for (const r of again) fileIssue(name, `the key "${r.key}" is written twice in one object`)
  for (const r of reserved) fileIssue(name, `the key "${r.key}" is a reserved name (a prototype name) and is never written as a key`)
  if (again.length > 0 || reserved.length > 0) return undefined
  try {
    return readJson(path, moneyIssue)
  } catch (e) {
    // Stryker disable next-line ConditionalExpression: the other errors (a failed read) cannot be made in a test that runs as root
    if (!(e instanceof SyntaxError)) throw e
    fileIssue(name, `it is not valid JSON: ${e.message}`)
    return undefined
  }
}

/** Data rows of an account CSV: every non-blank line after the header. */
function csvRows(path: string): number {
  return (
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '').length - 1
  )
}

/** The calendar day before a YYYY-MM-DD date. */
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Is this a path of the form `<dir>/<name>.csv`, directly inside `dir`? */
function isAccountFile(name: string, dir: string): boolean {
  return name.startsWith(`${dir}/`) && name.endsWith('.csv') && name.length > dir.length + 5 && !name.includes('/', dir.length + 1)
}

/** Every string leaf of a parsed JSON tree, with its path (array indexes are numbers), in document order. */
function stringLeaves(json: unknown, visit: (path: readonly (string | number)[], value: string) => void, path: readonly (string | number)[] = []): void {
  if (typeof json === 'string') visit(path, json)
  else if (Array.isArray(json)) for (const [i, x] of json.entries()) stringLeaves(x, visit, [...path, i])
  else if (json !== null && typeof json === 'object') for (const [k, v] of Object.entries(json)) stringLeaves(v, visit, [...path, k])
}

/** A value written like a date: two or three numbers split by dashes, slashes or dots ("2025-13", "03/02/2025", "2025.02.30"). */
const DATE_SHAPED = /^\d{1,4}[-/.]\d{1,2}(?:[-/.]\d{1,4})?$/
/** Two numbers split by a dot are a decimal ("10.1", "960.00"), a CCA class or an amount, never a date. */
const DECIMAL = /^\d+\.\d+$/
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/
const TIMESTAMP = /^\d{4}-\d\d-\d\dT/

/** Why a string is a bad date, or undefined when it is not date-shaped or is a whole calendar date, a month or a timestamp with one (W00c RC-B). */
function dateProblem(v: string): string | undefined {
  if (TIMESTAMP.test(v)) return isCalendarDate(v.slice(0, 10)) ? undefined : 'its date part is not a calendar date written YYYY-MM-DD'
  if (!DATE_SHAPED.test(v) || DECIMAL.test(v) || isCalendarDate(v) || MONTH.test(v)) return undefined
  return v.split(/[-/.]/).length === 3 ? 'it is not a calendar date written YYYY-MM-DD' : 'it is not a month written YYYY-MM'
}

/** The days of a fiscal year, both ends counted. */
function daysIn(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
}

const TX_ID = /^\d\d-[A-Z]{2,4}-\d{4}-\d\d-\d{4}$/
const AJE_ID = /^\d\d-AJE-\d\d$/

/** Walks a dotted path own key by own key, so "corporation.toString" is never found through the prototype. */
function hasOwnPath(root: unknown, dotted: string): boolean {
  let cur = root
  for (const k of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, k)) return false
    cur = (cur as Record<string, unknown>)[k]
  }
  return true
}

/** Loads a client, or throws a TestWorldLoadError listing every check it fails. Deterministic: no clock, no randomness. */
export function loadClient(id: ClientId, opts: { root?: string; faults?: readonly FaultEntry[] } = {}): Client {
  const root = opts.root ?? SAMPLE_ROOT
  const folder = CLIENT_ID.test(id) ? clientFolders(root).get(id) : undefined
  if (folder === undefined) {
    const linked = CLIENT_ID.test(id) ? linkedFolder(root, id) : undefined
    if (linked !== undefined) throw new TestWorldLoadError(id, [{ client: id, check: 'file', record: linked, reason: 'the client folder is a link, not a folder' }])
  }
  if (folder === undefined) throw new Error(`test-world client ${id} has no folder in ${root}`)
  const issues: LoadIssue[] = []
  const schemaIssue = (record: string, reason: string): void => {
    issues.push({ client: id, check: 'schema', record, reason })
  }
  const moneyIssue = (record: string, reason: string): void => {
    issues.push({ client: id, check: 'money', record, reason })
  }
  const fileIssue = (record: string, reason: string): void => {
    issues.push({ client: id, check: 'file', record, reason })
  }
  // clientFolders only lists a folder that has its answer-key.json; the onboarding file may be missing.
  const keyJson = readClientJson(folder, 'answer-key.json', moneyIssue, fileIssue)
  const onbJson = readClientJson(folder, 'onboarding.json', moneyIssue, fileIssue)
  if (keyJson === undefined || onbJson === undefined) throw new TestWorldLoadError(id, issues)
  const keyResult = RawKey.safeParse(keyJson)
  const onbResult = RawOnboarding.safeParse(onbJson)
  if (!keyResult.success) for (const i of keyResult.error.issues) schemaIssue(`answer-key.json ${i.path.join('.')}`, i.message)
  if (!onbResult.success) for (const i of onbResult.error.issues) schemaIssue(`onboarding.json ${i.path.join('.')}`, i.message)
  if (!keyResult.success || !onbResult.success) throw new TestWorldLoadError(id, issues)
  const key = keyResult.data
  const onb = onbResult.data

  // Each onboarding date is a calendar date and agrees with the fiscal year in the answer key (W00c RC3).
  const { start, end } = key.fiscalYear
  const twin = (field: string, value: string | undefined, agrees: (v: string) => string | undefined): void => {
    if (value === undefined) return
    if (!isCalendarDate(value)) schemaIssue(`onboarding.json ${field}`, 'it is not a calendar date written YYYY-MM-DD')
    else {
      const why = agrees(value)
      if (why !== undefined) schemaIssue(`onboarding.json ${field}`, why)
    }
  }
  twin('corporation.financial_year_end', onb.corporation.financial_year_end, (v) => (v === end ? undefined : `it is ${v} but the fiscal year ends ${end}`))
  twin('corporation.fiscal_year_start', onb.corporation.fiscal_year_start, (v) => (v === start ? undefined : `it is ${v} but the fiscal year starts ${start}`))
  twin('corporation.incorporation_date', onb.corporation.incorporation_date, (v) => (v <= start ? undefined : `it is ${v}, after the fiscal year starts on ${start}`))
  twin('prior_year_closing_balances.as_of', onb.prior_year_closing_balances?.as_of, (v) =>
    v === dayBefore(start) ? undefined : `it is ${v} but the prior year closes the day before the fiscal year starts on ${start}`,
  )

  // One walk over every string leaf of both files, carried parts included: a date-shaped value is a whole calendar date or a month (W00c RC-B).
  for (const [file, json] of [['answer-key.json', keyJson], ['onboarding.json', onbJson]] as const) {
    stringLeaves(json, (path, v) => {
      const why = dateProblem(v)
      const record = `${file} ${path.join('.')}`
      if (why !== undefined && !issues.some((i) => i.record === record)) schemaIssue(record, why)
    })
  }
  if (daysIn(start, end) !== key.fiscalYear.days) schemaIssue('answer-key.json fiscalYear.days', `it is ${String(key.fiscalYear.days)} but the fiscal year runs ${start} to ${end}, ${String(daysIn(start, end))} days`)

  const toLine = (l: z.infer<typeof line>) => ({
    account: l.account,
    gifi: l.gifi ?? null,
    gifiStatus: l.gifiStatus ?? null,
    debitCents: l.debit,
    creditCents: l.credit,
  })
  const toTb = (t: z.infer<typeof tb>) => {
    const rows = t.rows.map(toLine)
    return {
      rows,
      totalDebitCents: rows.reduce((s, r) => s + r.debitCents, 0),
      totalCreditCents: rows.reduce((s, r) => s + r.creditCents, 0),
    }
  }

  for (const name of ['opening', 'unadjusted', 'adjusted'] as const) {
    const t = toTb(key.trialBalance[name])
    if (t.totalDebitCents !== key.trialBalance[name].totalDebit) issues.push({ client: id, check: 'trial-balance', record: name, reason: `its totalDebit is written ${String(key.trialBalance[name].totalDebit)} but its rows add up to ${String(t.totalDebitCents)}` })
    if (t.totalCreditCents !== key.trialBalance[name].totalCredit) issues.push({ client: id, check: 'trial-balance', record: name, reason: `its totalCredit is written ${String(key.trialBalance[name].totalCredit)} but its rows add up to ${String(t.totalCreditCents)}` })
  }
  for (const j of key.adjustingEntries) {
    const debits = j.lines.reduce((sum, l) => sum + l.debit, 0)
    if (debits !== j.amount) schemaIssue(`${j.id} amount`, `it is written ${String(j.amount)} but its lines debit ${String(debits)}`)
  }

  const transactions = key.transactions.map((t) => ({
    id: t.id,
    accountKey: t.acct,
    date: t.date,
    amountCents: t.amount,
    account: t.account,
    glAccount: t.accountNo ?? '',
    missingFromExport: t.missingFromExport === true,
    ...(t.dupOf === undefined ? {} : { dupOf: t.dupOf }),
    ...(t.priorYear === true ? { priorYear: true } : {}),
    postings: (t.post ?? []).map((p) => ({ account: p.a, debitCents: p.dr ?? 0, creditCents: p.cr ?? 0 })),
  }))

  const home = realpathSync(folder)
  /** Rows of an account file, or 0 and a 'file' issue when it is not `<dir>/<name>.csv`, is not a regular file in the client folder, or is not there. */
  const accountFile = (account: string, field: string, name: string, dir: string): number => {
    const record = `${account} ${field}`
    if (!isAccountFile(name, dir)) {
      fileIssue(record, `${name} is not a ${dir}/<name>.csv file of the client folder`)
      return 0
    }
    const path = resolve(folder, name)
    if (!existsSync(path)) {
      fileIssue(record, `${name} is not in the client folder`)
      return 0
    }
    const real = relative(home, realpathSync(path)).split(sep).join('/')
    if (real === '..' || real.startsWith('../')) {
      fileIssue(record, `${name} leads out of the client folder`)
      return 0
    }
    // The file checks look at what the name resolves to, not at the name (W00c RC4).
    if (!isAccountFile(real, dir)) {
      fileIssue(record, `${name} resolves to ${real}, which is not a ${dir}/<name>.csv file of the client folder`)
      return 0
    }
    if (!lstatSync(realpathSync(path)).isFile()) {
      fileIssue(record, `${name} is not a regular file`)
      return 0
    }
    return csvRows(path)
  }

  const accounts = key.accounts.map((a) => {
    const months = (Object.hasOwn(key.statementBalances, a.key) ? (key.statementBalances[a.key] as (typeof key.statementBalances)[string]) : []).map((m) => {
      const activityCents = transactions
        .filter((t) => t.accountKey === a.key && t.date.slice(0, 7) === m.month && !t.missingFromExport)
        .reduce((s, t) => s + t.amountCents, 0)
      const net = a.role === 'card' || a.role === 'pcard' ? m.opening - activityCents : m.opening + activityCents
      if (m.rolls !== (net === m.closing)) issues.push({ client: id, check: 'roll', record: `${a.key} ${m.month}`, reason: `its rolls is written ${String(m.rolls)} but its opening, activity and closing say ${String(net === m.closing)}` })
      if (m.exportActivity !== activityCents) issues.push({ client: id, check: 'roll', record: `${a.key} ${m.month}`, reason: `its exportActivity is written ${String(m.exportActivity)} but its transactions in the export add up to ${String(activityCents)}` })
      return { month: m.month, openingCents: m.opening, closingCents: m.closing, activityCents, rolls: net === m.closing }
    })
    const exported = key.transactions.filter((t) => t.acct === a.key && t.missingFromExport !== true).length
    if (a.rowsInExport !== exported) schemaIssue(`${a.key} rowsInExport`, `it is written ${String(a.rowsInExport)} but ${String(exported)} of its transactions are in the export`)
    const missing = key.transactions.filter((t) => t.acct === a.key && t.missingFromExport === true).length
    if (a.rowsMissingFromExport !== missing) schemaIssue(`${a.key} rowsMissingFromExport`, `it is written ${String(a.rowsMissingFromExport)} but ${String(missing)} of its transactions are missing from the export`)
    // The export file is still checked for being there; its line count is not the row count (a layout B or C export has more or fewer lines).
    accountFile(a.key, 'file', a.file, 'accounts')
    return {
      key: a.key,
      role: a.role,
      currency: a.currency,
      glAccount: a.glAccount,
      openingCents: a.openingBalance,
      closingCents: a.closingBalance,
      exportRows: a.rowsInExport,
      qboRows: accountFile(a.key, 'qboFile', a.qboFile, 'qbo'),
      months,
    }
  })

  const declaredKeys = new Set(key.accounts.map((a) => a.key))
  for (const k of Object.keys(key.statementBalances)) {
    if (!declaredKeys.has(k)) issues.push({ client: id, check: 'roll', record: k, reason: 'it has statement balances but the answer key declares no such account' })
  }
  const txIds = new Set(key.transactions.map((t) => t.id))
  const onbAnswers = (onbJson as { answers?: unknown }).answers
  const onbKeys = onbJson as Record<string, unknown>
  /** The `{account, name}` items of an onboarding key, for a "(NNNN Name)" qualifier to name one of them. */
  const recordsOf = (base: string): { account: string; name: string }[] => {
    const holder = onbKeys[base]
    const list = (holder as { accounts?: unknown } | null)?.accounts
    // Stryker disable next-line ArrayDeclaration: a non-list gives no record either way (a stand-in item has no account, so it never matches a qualifier)
    if (!Array.isArray(list)) return []
    // A record counts only when its account and name are both written as strings: a missing name is never the text "undefined".
    return list.flatMap((x) => {
      const r = x as { account?: unknown; name?: unknown }
      return typeof r.account === 'string' && typeof r.name === 'string' ? [{ account: r.account, name: r.name }] : []
    })
  }
  const resolves = (source: string): boolean => {
    if (Array.isArray(onbAnswers) && onbAnswers.some((x) => (x as { question_asked?: unknown }).question_asked === source)) return true
    const q = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(source)
    if (q === null) return hasOwnPath(onbKeys, source)
    // A "(...)" qualifier must name a record of that key: "(1200 Prepaid expenses)" is the account 1200 called "Prepaid expenses".
    const base = q[1] as string
    const named = /^(\d+) (.+)$/.exec(q[2] as string)
    return Object.hasOwn(onbKeys, base) && named !== null && recordsOf(base).some((r) => r.account === named[1] && r.name === named[2])
  }
  // Every id-shaped string of the answer key is a whole id of this client (W00c RC-C); an adjusting entry's own source ids are checked below.
  stringLeaves(keyJson, (path, v) => {
    const [top, , sub, third] = path
    if ((top === 'transactions' || top === 'adjustingEntries') && sub === 'id' && path.length === 3) return
    if (top === 'adjustingEntries' && sub === 'source' && third === 'transactions') return
    const record = `answer-key.json ${path.join('.')}`
    if (/^\d\d-AJE-/.test(v)) {
      if (!AJE_ID.test(v) || !key.adjustingEntries.some((j) => j.id === v)) schemaIssue(record, `"${v}" is not an adjusting entry of this client`)
    } else if (/^\d\d-[A-Z]{2,4}-/.test(v) && (!TX_ID.test(v) || !txIds.has(v))) schemaIssue(record, `"${v}" is not a transaction of this client`)
  })
  // Onboarding evidence of flags and Schedule 1 add-backs resolves like an adjusting entry's.
  const evidence = (record: string, sources: readonly string[] | undefined): void => {
    for (const [i, s] of (sources ?? []).entries()) if (!resolves(s)) schemaIssue(`${record}.${String(i)}`, `"${s}" is not in onboarding.json`)
  }
  for (const [i, f] of key.flags.entries()) evidence(`answer-key.json flags.${String(i)}.evidence.onboarding`, f.evidence?.onboarding)
  for (const [i, a] of (key.t2Inputs?.schedule1?.addBacks ?? []).entries()) evidence(`answer-key.json t2Inputs.schedule1.addBacks.${String(i)}.source.onboarding`, a.source?.onboarding)
  for (const j of key.adjustingEntries) {
    for (const s of j.source.transactions) {
      if (!txIds.has(s)) issues.push({ client: id, check: 'adjusting-entry', record: j.id, reason: `its source "${s}" is not a transaction of this client` })
    }
    for (const s of j.source.onboarding) {
      if (!resolves(s)) issues.push({ client: id, check: 'adjusting-entry', record: j.id, reason: `its source "${s}" is not in onboarding.json` })
    }
  }

  const adjustingEntries = key.adjustingEntries.map((j) => {
    const sources = [...j.source.transactions, ...j.source.onboarding]
    return {
      id: j.id,
      date: j.date,
      type:
        j.source.transactions.length > 0 && j.source.onboarding.length > 0
          ? 'from-transactions-and-onboarding'
          : j.source.onboarding.length > 0
            ? 'from-onboarding'
            : 'from-transactions',
      reason: j.reason,
      sources,
      lines: j.lines.map(toLine),
    }
  })

  const client = {
    id,
    corporation: {
      name: key.name,
      businessNumber: onb.corporation.business_number,
      yearStart: key.fiscalYear.start,
      yearEnd: key.fiscalYear.end,
    },
    owners: onb.owners.map((o) => ({ name: o.name })),
    accounts,
    transactions,
    adjustingEntries,
    trialBalance: {
      opening: toTb(key.trialBalance.opening),
      unadjusted: toTb(key.trialBalance.unadjusted),
      adjusted: toTb(key.trialBalance.adjusted),
    },
    flags: key.flags.map((f) => ({ id: f.id, rule: f.rule, detail: f.detail, severity: f.severity ?? null, action: f.action ?? null })),
    priorYear: key.prior_year ?? null,
  }

  const parsed = ClientSchema.safeParse(client)
  if (!parsed.success) {
    for (const i of parsed.error.issues) schemaIssue(i.path.join('.'), i.message)
    throw new TestWorldLoadError(id, issues)
  }

  // An opening trial balance is empty only in a first year: the corporation was incorporated on the fiscal year start.
  if (parsed.data.trialBalance.opening.rows.length === 0 && onb.corporation.incorporation_date !== start) {
    issues.push({ client: id, check: 'trial-balance', record: 'opening', reason: `the opening trial balance has no rows and the corporation was not incorporated on the fiscal year start ${start}` })
  }

  // The guard reads every file of the folder, not a field list (SEC-11).
  const files: GuardFile[] = [...guardFiles(folder)]
  const people = [
    ...onb.owners.map((o) => o.name),
    ...(onb.shares?.holders ?? []).map((h) => h.name),
    // Stryker disable next-line ArrayDeclaration: a stand-in item has no lender, so flatMap drops it exactly as it drops the empty list
    ...(onb.shareholder_loans ?? []).flatMap((l) => (l.lender === undefined ? [] : [l.lender])),
    ...(onb.spouse?.name === undefined ? [] : [onb.spouse.name]),
    ...key.parties.filter((p) => p.kind === 'person').map((p) => p.name),
  ]
  issues.push(...guardIssues(id, files, people), ...modelIssues(parsed.data, opts.faults ?? faults()))
  if (issues.length > 0) throw new TestWorldLoadError(id, issues)
  return parsed.data
}

/** Every text file of a client folder the guard reads: the JSON files, the profile, the account and QBO CSVs. */
function guardFiles(folder: string): GuardFile[] {
  const out: GuardFile[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.isFile()) {
        // Stryker disable next-line StringLiteral: only the json and csv kinds are told apart later; md and an empty kind are scanned the same way
        const kind = e.name.endsWith('.json') ? 'json' : e.name.endsWith('.csv') ? 'csv' : e.name.endsWith('.md') ? 'md' : undefined
        if (kind !== undefined) out.push({ file: relative(folder, full).split(sep).join('/'), kind, text: readFileSync(full, 'utf8') })
      }
    }
  }
  walk(folder)
  return out
}
