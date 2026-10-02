// @mutate
// Loads one sample client from reference/sample-clients/ in place (never copied or rewritten) into the model (ARC-8).
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { decimalToCents } from '../../src/core/money'
import { faults, type FaultEntry } from '../model/faults'
import { guardIssues, type GuardFile } from '../model/guard'
import { modelIssues } from '../model/checks'
import { CLIENT_ID, ClientSchema, TestWorldLoadError, type Client, type ClientId, type LoadIssue } from '../model/schema'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SAMPLE_ROOT = join(REPO_ROOT, 'reference', 'sample-clients')

// Amounts arrive as integer cents: readJson turns each money field's text into cents, never through a float (ARC-13).
const dollars = z.number()
const line = z.object({
  account: z.string(),
  gifi: z.number().int().nullish(),
  gifiStatus: z.string().nullish(),
  debit: dollars,
  credit: dollars,
})
const tb = z.object({ rows: z.array(line) })

const RawKey = z.object({
  name: z.string(),
  fiscalYear: z.object({ start: z.string(), end: z.string() }),
  accounts: z.array(
    z.object({
      key: z.string(),
      role: z.string(),
      currency: z.string(),
      file: z.string(),
      qboFile: z.string(),
      glAccount: z.string(),
      openingBalance: dollars,
      closingBalance: dollars,
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
      acct: z.string(),
      date: z.string(),
      amount: dollars,
      account: z.string(),
      accountNo: z.string().nullish(),
      missingFromExport: z.boolean().optional(),
      dupOf: z.string().optional(),
      priorYear: z.boolean().optional(),
      post: z.array(z.object({ a: z.string(), dr: dollars.optional(), cr: dollars.optional() })).optional(),
    }),
  ),
  statementBalances: z.record(z.string(), z.array(z.object({ month: z.string(), opening: dollars, closing: dollars, rolls: z.boolean() }))),
  adjustingEntries: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      reason: z.string(),
      lines: z.array(line),
      source: z.object({ transactions: z.array(z.string()), onboarding: z.array(z.string()) }),
    }),
  ),
  trialBalance: z.object({ opening: tb, unadjusted: tb, adjusted: tb }),
  flags: z.array(
    z.object({ id: z.string(), rule: z.string(), detail: z.string(), severity: z.string().optional(), action: z.string().optional() }),
  ),
  parties: z.array(z.object({ name: z.string(), kind: z.string().optional() })),
  t2Inputs: z
    .object({
      schedule50: z.array(z.object({ name: z.string(), sin: z.string().optional(), businessNumber: z.string().optional() })).optional(),
    })
    .optional(),
  prior_year: z.unknown().optional(),
})

const RawOnboarding = z.object({
  corporation: z.object({
    legal_name: z.string(),
    business_number: z.string(),
    financial_year_end: z.string().optional(),
    fiscal_year_start: z.string().optional(),
  }),
  cra_program_accounts: z.array(z.object({ account_number: z.string() })).optional(),
  owners: z.array(z.object({ name: z.string() })),
  related_entities: z.array(z.object({ entity_name: z.string() })).optional(),
  shares: z.object({ holders: z.array(z.object({ name: z.string() })).optional() }).optional(),
  shareholder_loans: z.array(z.object({ lender: z.string().optional() })).optional(),
  spouse: z.object({ name: z.string().optional() }).optional(),
})

/** The numbered folders of a sample-clients root, as client ids (C01 upward), in order. */
export function clientFolders(root: string = SAMPLE_ROOT): Map<ClientId, string> {
  const found = new Map<ClientId, string>()
  for (const name of readdirSync(root).sort()) {
    const m = /^(\d\d)-/.exec(name)
    // Stryker disable next-line StringLiteral: m[1] always exists once the pattern has matched; the fallback only satisfies noUncheckedIndexedAccess
    if (m !== null && existsSync(join(root, name, 'answer-key.json'))) found.set(`C${m[1] ?? ''}`, join(root, name))
  }
  return found
}

const AMOUNT_KEYS = new Set(['amount', 'debit', 'credit', 'dr', 'cr', 'opening', 'closing', 'openingBalance', 'closingBalance'])

/** Is this number a money field the loader reads? Decided by the shape of the object that holds it, so rates never match. */
function isMoneyField(key: string, holder: unknown): boolean {
  // Stryker disable next-line ConditionalExpression: JSON.parse always hands the reviver an object as holder, so the null and typeof tests never decide
  if (!AMOUNT_KEYS.has(key) || holder === null || typeof holder !== 'object') return false
  const h = holder as Record<string, unknown>
  if (key === 'amount') return 'acct' in h && 'date' in h
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

/** Reads one JSON file of the client folder; a file that is not there is a 'file' issue and undefined, never a raw ENOENT. */
function readClientJson(
  folder: string,
  name: string,
  moneyIssue: (record: string, reason: string) => void,
  fileIssue: (record: string, reason: string) => void,
): unknown {
  const path = join(folder, name)
  if (!existsSync(path)) {
    fileIssue(name, 'the file is not in the client folder')
    return undefined
  }
  return readJson(path, moneyIssue)
}

/** Data rows of an account CSV: every non-blank line after the header. */
function csvRows(path: string): number {
  return (
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '').length - 1
  )
}

/** Loads a client, or throws a TestWorldLoadError listing every check it fails. Deterministic: no clock, no randomness. */
export function loadClient(id: ClientId, opts: { root?: string; faults?: readonly FaultEntry[] } = {}): Client {
  const folder = CLIENT_ID.test(id) ? clientFolders(opts.root).get(id) : undefined
  if (folder === undefined) throw new Error(`test-world client ${id} has no folder in ${opts.root ?? SAMPLE_ROOT}`)
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
  const keyJson = readJson(join(folder, 'answer-key.json'), moneyIssue)
  const onbJson = readClientJson(folder, 'onboarding.json', moneyIssue, fileIssue)
  if (onbJson === undefined) throw new TestWorldLoadError(id, issues)
  const keyResult = RawKey.safeParse(keyJson)
  const onbResult = RawOnboarding.safeParse(onbJson)
  if (!keyResult.success) for (const i of keyResult.error.issues) schemaIssue(`answer-key.json ${i.path.join('.')}`, i.message)
  if (!onbResult.success) for (const i of onbResult.error.issues) schemaIssue(`onboarding.json ${i.path.join('.')}`, i.message)
  if (!keyResult.success || !onbResult.success) throw new TestWorldLoadError(id, issues)
  const key = keyResult.data
  const onb = onbResult.data

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
  /** Rows of an account file, or 0 and a 'file' issue when it leaves the client folder or is not there. */
  const accountFile = (account: string, field: string, name: string): number => {
    const path = resolve(folder, name)
    const out = relative(folder, path)
    if (isAbsolute(name) || out === '..' || out.startsWith(`..${sep}`)) {
      fileIssue(`${account} ${field}`, `${name} is outside the client folder`)
      return 0
    }
    if (!existsSync(path)) {
      fileIssue(`${account} ${field}`, `${name} is not in the client folder`)
      return 0
    }
    const real = relative(home, realpathSync(path))
    if (real === '..' || real.startsWith(`..${sep}`)) {
      fileIssue(`${account} ${field}`, `${name} leads out of the client folder`)
      return 0
    }
    return csvRows(path)
  }

  const accounts = key.accounts.map((a) => {
    const months = (key.statementBalances[a.key] ?? []).map((m) => {
      const activityCents = transactions
        .filter((t) => t.accountKey === a.key && t.date.startsWith(m.month) && !t.missingFromExport)
        .reduce((s, t) => s + t.amountCents, 0)
      const net = a.role === 'card' || a.role === 'pcard' ? m.opening - activityCents : m.opening + activityCents
      return { month: m.month, openingCents: m.opening, closingCents: m.closing, activityCents, rolls: net === m.closing }
    })
    return {
      key: a.key,
      role: a.role,
      currency: a.currency,
      glAccount: a.glAccount,
      openingCents: a.openingBalance,
      closingCents: a.closingBalance,
      exportRows: accountFile(a.key, 'file', a.file),
      qboRows: accountFile(a.key, 'qboFile', a.qboFile),
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
  const resolves = (source: string): boolean => {
    const base = source.replace(/\s*\([^)]*\)\s*$/, '')
    return (
      Object.hasOwn(onbKeys, base) ||
      (Array.isArray(onbAnswers) && onbAnswers.some((x) => (x as { question_asked?: unknown }).question_asked === source))
    )
  }
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
