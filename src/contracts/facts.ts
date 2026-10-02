// The fact catalogue contract (E03): one entry per fact key, with its value type and whether it is
// sensitive. Pure: no I/O. The data lives in data/facts/catalogue.json (EV-5, EV-10, SEC-4, AI-9).
import { createHash } from 'node:crypto'
import { z } from 'zod'

/** The one list of document kind ids. E02's kinds.json uses exactly these ids. */
export const DOCUMENT_KINDS = [
  'bank',
  'card',
  'loan',
  'tb-pdf',
  'tb-sheet',
  'fs',
  'invoice',
  'prior-t2',
  'noa',
  'cra-sheet',
  'hst',
  't4',
  't5',
  'ohip',
  'corporate',
  'resolution',
  'payroll-remittance',
  'cra-notice',
] as const

/** Where a fact can come from besides a document. */
export const NON_DOCUMENT_SOURCES = ['onboarding', 'qa', 'cra_capture', 'prior_return', 'qbo', 'judgment'] as const

export const VALUE_TYPES = ['money', 'date', 'text', 'count', 'percent', 'boolean', 'enum'] as const
export const SENSITIVE_KINDS = ['none', 'sin', 'birth_date', 'bank_account'] as const
export const CITE_KINDS = ['cra_form', 'onboarding_contract', 'answer_key'] as const

export type ValueType = (typeof VALUE_TYPES)[number]
export type SensitiveKind = (typeof SENSITIVE_KINDS)[number]

const KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/
const MAX_LABEL = 60

const sources: ReadonlySet<string> = new Set<string>([...DOCUMENT_KINDS, ...NON_DOCUMENT_SOURCES])

/** The kind a key's own name demands (SEC-4): a SIN, a birth date or an account or card number. */
export function sensitiveKindForKey(key: string): SensitiveKind {
  const tokens = key.split(/[._]/)
  if (key.includes('account_number') || key.endsWith('.card_number')) return 'bank_account'
  if (tokens.includes('sin')) return 'sin'
  if (tokens.includes('birth')) return 'birth_date'
  return 'none'
}

export type FactEntry = {
  key: string
  valueType: ValueType
  options?: readonly string[]
  period: 'instant' | 'duration'
  repeating: 'none' | { rowKey: string }
  sensitive: SensitiveKind
  suppliedBy: readonly string[]
  label: string
  cites: readonly { kind: (typeof CITE_KINDS)[number]; ref: string }[]
}

export type FactCatalogue = {
  version: string
  entries: readonly FactEntry[]
  get(key: string): FactEntry | undefined
}

export type LoadResult = { ok: true; catalogue: FactCatalogue } | { ok: false; reasons: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// One entry. Shape problems and rule problems alike come out as messages that name the field.
export const factEntrySchema = z.looseObject({ key: z.string() }).superRefine((raw, ctx) => {
  const bad = (message: string): void => {
    ctx.addIssue({ code: 'custom', message })
  }
  const e = raw as Record<string, unknown>
  const key = e['key'] as string
  if (!KEY_PATTERN.test(key)) bad(`key "${key}" is not in the dotted pattern <area>.<subject>.<measure>`)

  const vt = e['valueType']
  if (typeof vt !== 'string' || !(VALUE_TYPES as readonly string[]).includes(vt)) {
    bad(`unknown value type "${String(vt)}"`)
  } else if (vt === 'enum') {
    const o = e['options']
    if (!Array.isArray(o) || o.length === 0 || o.some((x) => typeof x !== 'string' || x === '')) {
      bad('an enum value type needs its option ids')
    }
  } else if (e['options'] !== undefined) {
    bad('options are only for the enum value type')
  }

  if (e['period'] !== 'instant' && e['period'] !== 'duration') bad(`unknown period "${String(e['period'])}"`)

  const rep = e['repeating']
  if (rep !== 'none') {
    const rk = isObj(rep) ? rep['rowKey'] : undefined
    if (typeof rk !== 'string' || rk.trim() === '') bad('a repeating key needs a non-empty row key (repeating.rowKey)')
  }

  const s = e['sensitive']
  if (typeof s !== 'string' || !(SENSITIVE_KINDS as readonly string[]).includes(s)) {
    bad(`unknown sensitive kind "${String(s)}"`)
  } else {
    const wanted = sensitiveKindForKey(key)
    if (wanted !== 'none' && s !== wanted) {
      bad(`sensitive must be "${wanted}" because the key name says so (found "${s}")`)
    }
  }

  const by = e['suppliedBy']
  if (!Array.isArray(by) || by.length === 0) {
    bad('suppliedBy needs at least one source')
  } else {
    for (const b of by) {
      if (typeof b !== 'string' || !sources.has(b)) bad(`suppliedBy source "${String(b)}" is not a document kind or a named source`)
    }
  }

  const label = e['label']
  if (typeof label !== 'string' || label.trim() === '') bad('label is empty')
  else {
    if (label.length > MAX_LABEL) bad(`label is ${label.length} characters, more than ${MAX_LABEL}`)
    if (label.endsWith('.')) bad('label ends in a full stop')
  }

  const cites = e['cites']
  if (!Array.isArray(cites) || cites.length === 0) bad('an entry must cite where its meaning comes from (cites)')
  else {
    for (const c of cites) {
      const ok =
        isObj(c) &&
        (CITE_KINDS as readonly string[]).includes(c['kind'] as string) &&
        typeof c['ref'] === 'string' &&
        c['ref'].trim() !== ''
      if (!ok) bad('a cite needs a kind (cra_form, onboarding_contract or answer_key) and a ref')
    }
  }
})

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (isObj(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

/** The catalogue version: a hash of the content, not of how the file is laid out. */
export function catalogueVersion(entries: readonly unknown[]): string {
  const sorted = [...entries].sort((a, b) => ((a as FactEntry).key < (b as FactEntry).key ? -1 : 1))
  return createHash('sha256').update(canonical(sorted)).digest('hex')
}

export function loadFactCatalogue(json: unknown): LoadResult {
  if (!isObj(json) || !Array.isArray(json['entries'])) {
    return { ok: false, reasons: ['the catalogue must be an object with an "entries" list'] }
  }
  const reasons: string[] = []
  const seen = new Set<string>()
  const good: FactEntry[] = []
  for (const [i, raw] of (json['entries'] as unknown[]).entries()) {
    const parsed = factEntrySchema.safeParse(raw)
    const key = isObj(raw) && typeof raw['key'] === 'string' ? raw['key'] : `entry ${i}`
    if (!parsed.success) {
      for (const issue of parsed.error.issues) reasons.push(`${key}: ${issue.message}`)
      continue
    }
    if (seen.has(key)) reasons.push(`${key}: duplicate key`)
    seen.add(key)
    good.push(parsed.data as unknown as FactEntry)
  }
  if (reasons.length > 0) return { ok: false, reasons }
  const byKey = new Map(good.map((e) => [e.key, e]))
  return {
    ok: true,
    catalogue: { version: catalogueVersion(good), entries: good, get: (k) => byKey.get(k) },
  }
}
