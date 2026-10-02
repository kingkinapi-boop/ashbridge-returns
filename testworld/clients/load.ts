// Loads one sample client from reference/sample-clients/ in place (never copied or rewritten) into the model (ARC-8).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { dollarsToCents } from '../model/money'
import { guardIssues, type GuardInput } from '../model/guard'
import { modelIssues } from '../model/checks'
import { CLIENT_ID, ClientSchema, TestWorldLoadError, type Client, type ClientId, type LoadIssue } from '../model/schema'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SAMPLE_ROOT = join(REPO_ROOT, 'reference', 'sample-clients')

const dollars = z.number()
const line = z.object({ account: z.string(), gifi: z.number().int().nullish(), debit: dollars, credit: dollars })
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
  parties: z.array(z.object({ name: z.string() })),
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
})

/** The numbered folders of a sample-clients root, as client ids (C01 upward), in order. */
export function clientFolders(root: string = SAMPLE_ROOT): Map<ClientId, string> {
  const found = new Map<ClientId, string>()
  for (const name of readdirSync(root).sort()) {
    const m = /^(\d\d)-/.exec(name)
    if (m !== null && existsSync(join(root, name, 'answer-key.json'))) found.set(`C${m[1] ?? ''}`, join(root, name))
  }
  return found
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

/** Data rows of an account CSV: every non-blank line after the header. */
function csvRows(path: string): number {
  return (
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '').length - 1
  )
}

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) strings(x, out)
  else if (v !== null && typeof v === 'object') for (const x of Object.values(v)) strings(x, out)
  return out
}

/** Loads a client, or throws a TestWorldLoadError listing every check it fails. Deterministic: no clock, no randomness. */
export function loadClient(id: ClientId, opts: { root?: string } = {}): Client {
  const folder = CLIENT_ID.test(id) ? clientFolders(opts.root).get(id) : undefined
  if (folder === undefined) throw new Error(`test-world client ${id} has no folder in ${opts.root ?? SAMPLE_ROOT}`)
  const issues: LoadIssue[] = []
  const schemaIssue = (record: string, reason: string): void => {
    issues.push({ client: id, check: 'schema', record, reason })
  }
  const keyResult = RawKey.safeParse(readJson(join(folder, 'answer-key.json')))
  const onbResult = RawOnboarding.safeParse(readJson(join(folder, 'onboarding.json')))
  if (!keyResult.success) for (const i of keyResult.error.issues) schemaIssue(`answer-key.json ${i.path.join('.')}`, i.message)
  if (!onbResult.success) for (const i of onbResult.error.issues) schemaIssue(`onboarding.json ${i.path.join('.')}`, i.message)
  if (!keyResult.success || !onbResult.success) throw new TestWorldLoadError(id, issues)
  const key = keyResult.data
  const onb = onbResult.data

  const cents = (x: number, where: string): number => {
    const r = dollarsToCents(x)
    if (r.ok) return r.cents
    schemaIssue(where, r.reason)
    return 0
  }
  const toLine = (l: z.infer<typeof line>, where: string) => ({
    account: l.account,
    gifi: l.gifi ?? null,
    debitCents: cents(l.debit, `${where} debit`),
    creditCents: cents(l.credit, `${where} credit`),
  })
  const toTb = (name: string, t: z.infer<typeof tb>) => {
    const rows = t.rows.map((r) => toLine(r, `${name} ${r.account}`))
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
    amountCents: cents(t.amount, t.id),
    account: t.account,
    glAccount: t.accountNo ?? '',
    missingFromExport: t.missingFromExport === true,
    postings: (t.post ?? []).map((p) => ({
      account: p.a,
      debitCents: cents(p.dr ?? 0, `${t.id} ${p.a}`),
      creditCents: cents(p.cr ?? 0, `${t.id} ${p.a}`),
    })),
  }))

  const accounts = key.accounts.map((a) => {
    const months = (key.statementBalances[a.key] ?? []).map((m) => ({
      month: m.month,
      openingCents: cents(m.opening, `${a.key} ${m.month} opening`),
      closingCents: cents(m.closing, `${a.key} ${m.month} closing`),
      activityCents: transactions
        .filter((t) => t.accountKey === a.key && t.date.startsWith(m.month) && !t.missingFromExport)
        .reduce((s, t) => s + t.amountCents, 0),
      rolls: m.rolls,
    }))
    return {
      key: a.key,
      role: a.role,
      currency: a.currency,
      glAccount: a.glAccount,
      openingCents: cents(a.openingBalance, `${a.key} opening`),
      closingCents: cents(a.closingBalance, `${a.key} closing`),
      exportRows: csvRows(join(folder, a.file)),
      qboRows: csvRows(join(folder, a.qboFile)),
      months,
    }
  })

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
      lines: j.lines.map((l) => toLine(l, j.id)),
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
      opening: toTb('opening', key.trialBalance.opening),
      unadjusted: toTb('unadjusted', key.trialBalance.unadjusted),
      adjusted: toTb('adjusted', key.trialBalance.adjusted),
    },
    flags: key.flags.map((f) => ({ id: f.id, rule: f.rule, detail: f.detail, severity: f.severity ?? null, action: f.action ?? null })),
    priorYear: key.prior_year ?? null,
  }

  const parsed = ClientSchema.safeParse(client)
  if (!parsed.success) {
    for (const i of parsed.error.issues) schemaIssue(i.path.join('.'), i.message)
    throw new TestWorldLoadError(id, issues)
  }

  const guard: GuardInput = {
    names: [
      { where: 'corporation', name: onb.corporation.legal_name },
      { where: 'corporation', name: key.name },
      ...onb.owners.map((o) => ({ where: 'owner', name: o.name })),
      ...(onb.related_entities ?? []).map((r) => ({ where: 'related entity', name: r.entity_name })),
      ...key.parties.map((p) => ({ where: 'party', name: p.name })),
      ...(key.t2Inputs?.schedule50 ?? []).map((s) => ({ where: 'schedule 50 holder', name: s.name })),
    ],
    numbers: [
      { where: 'corporation business number', value: onb.corporation.business_number, kind: 'business number' },
      ...(onb.cra_program_accounts ?? []).map((a) => ({
        where: 'CRA program account',
        value: a.account_number.slice(0, 9),
        kind: 'business number' as const,
      })),
      ...(key.t2Inputs?.schedule50 ?? []).flatMap((s) => [
        ...(s.sin === undefined ? [] : [{ where: `schedule 50 ${s.name}`, value: s.sin, kind: 'SIN' as const }]),
        ...(s.businessNumber === undefined
          ? []
          : [{ where: `schedule 50 ${s.name}`, value: s.businessNumber, kind: 'business number' as const }]),
      ]),
    ],
    text: [
      { where: 'onboarding.json', text: strings(readJson(join(folder, 'onboarding.json'))).join('\n') },
      { where: 'profile.md', text: readFileSync(join(folder, 'profile.md'), 'utf8') },
    ],
  }
  issues.push(...guardIssues(id, guard), ...modelIssues(parsed.data))
  if (issues.length > 0) throw new TestWorldLoadError(id, issues)
  return parsed.data
}
