// The question bank (G01): a catalogue of ids, slots and answer shapes, each tied to the fact it resolves, with
// no client wording at all (ARC-2, RULE-19, END-7). The loader refuses a bank that breaks the format, the no-sentence
// lint reads every string, `pick` offers the live items for a fact (AI-12) and `toHandOff` writes the rows the client reads.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { FactCatalogue, ValueType } from '../../../contracts/facts'

export const SLOT_TYPES = ['money_cents', 'date', 'count', 'percent', 'document_ref', 'account_ref', 'fact_ref', 'choice'] as const
export const ANSWER_SHAPES = ['money', 'date', 'yes_no', 'choice', 'file', 'number'] as const
export const QUESTION_TYPES = ['ASK', 'CONFIRM', 'DECIDE'] as const
export const MAX_LABEL = 60

const ID_PATTERN = /^Q-[A-Z]+-\d{3}$/
const options = z.array(z.string()).min(1)

const slotSchema = z
  .strictObject({
    name: z.string().min(1),
    type: z.enum(SLOT_TYPES),
    required: z.boolean(),
    options: options.optional(),
  })
  .refine((s) => (s.type === 'choice') === (s.options !== undefined), { message: 'a choice slot lists its option ids and no other slot does' })

const answerSchema = z
  .strictObject({ shape: z.enum(ANSWER_SHAPES), options: options.optional() })
  .refine((a) => (a.shape === 'choice') === (a.options !== undefined), { message: 'a choice answer lists its option ids and no other answer does' })

export const itemSchema = z.strictObject({
  id: z.string().regex(ID_PATTERN, { message: 'the id must read Q-<TOPIC>-<nnn>, for example Q-DIV-001' }),
  type: z.enum(QUESTION_TYPES),
  resolves: z.string().min(1),
  slots: z.array(slotSchema),
  answer: answerSchema,
  label: z.string().min(1),
  topic: z.string().min(1),
  retired: z.boolean(),
})
export type BankItem = z.infer<typeof itemSchema>

export type Bank = { version: string; items: BankItem[] }
export type BankProblem = { file: string; item: string; reason: string }
export type LoadBankResult = { ok: true; bank: Bank } | { ok: false; problems: BankProblem[] }

// The value type each fact-typed slot can take; reference and choice slots fit any fact.
const SLOT_VALUE_TYPE: Partial<Record<(typeof SLOT_TYPES)[number], ValueType>> = {
  money_cents: 'money',
  date: 'date',
  count: 'count',
  percent: 'percent',
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Every string in a value, so the lint reads keys of nothing and values of everything. */
function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (isObj(v)) for (const x of Object.values(v)) yield* strings(x)
}

/** RULE-19, END-7: nothing in a bank file may read as a sentence to a client. */
function lint(item: Record<string, unknown>): string[] {
  const reasons = new Set<string>()
  for (const s of strings(item)) {
    const t = s.trim()
    if (/[.?!]$/.test(t)) reasons.add(`"${s}" ends like a sentence (a full stop, question mark or exclamation mark)`)
    if (/\b(you|your)\b/i.test(s)) reasons.add(`"${s}" speaks to the client ("you" or "your")`)
  }
  const label = item['label']
  if (typeof label === 'string' && label.length > MAX_LABEL) reasons.add(`the label runs past ${String(MAX_LABEL)} characters`)
  return [...reasons]
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
  return v
}

/** A hash of the content of every item, not of how the files are laid out or named. */
function bankVersion(items: readonly BankItem[]): string {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return createHash('sha256').update(JSON.stringify(canonical(sorted))).digest('hex')
}

function checkAgainstCatalogue(item: BankItem, catalogue: FactCatalogue): string[] {
  const fact = catalogue.get(item.resolves)
  if (!fact) return [`resolves "${item.resolves}", which is not in the fact catalogue`]
  const reasons: string[] = []
  for (const slot of item.slots) {
    const want = SLOT_VALUE_TYPE[slot.type]
    if (want !== undefined && want !== fact.valueType) {
      reasons.push(`slot "${slot.name}" of type ${slot.type} cannot take fact "${item.resolves}", whose value type is ${fact.valueType}`)
    }
  }
  return reasons
}

/** Reads every `*.json` in the folder except `_schema.json`; refuses with the file, the item and the reason. */
export function loadBank(dir: string, catalogue: FactCatalogue): LoadBankResult {
  const problems: BankProblem[] = []
  const items: BankItem[] = []
  const firstSeen = new Map<string, BankItem>()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_schema.json').sort()
  for (const file of files) {
    let json: unknown
    try {
      json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    } catch {
      problems.push({ file, item: '(file)', reason: 'the file is not valid JSON' })
      continue
    }
    if (!isObj(json) || !Array.isArray(json['items'])) {
      problems.push({ file, item: '(file)', reason: 'the file must be an object with an "items" list' })
      continue
    }
    for (const [n, raw] of (json['items'] as unknown[]).entries()) {
      const name = isObj(raw) && typeof raw['id'] === 'string' ? raw['id'] : `item ${String(n)}`
      const reasons: string[] = []
      const parsed = itemSchema.safeParse(raw)
      if (!parsed.success) {
        for (const issue of parsed.error.issues) reasons.push(`${issue.path.join('.') || 'item'}: ${issue.message}`)
      } else {
        const item = parsed.data
        reasons.push(...checkAgainstCatalogue(item, catalogue))
        const earlier = firstSeen.get(item.id)
        if (earlier === undefined) firstSeen.set(item.id, item)
        else if (earlier.retired && !item.retired) reasons.push(`the id ${item.id} belongs to a retired item and is never reused`)
        else reasons.push(`duplicate id ${item.id}`)
        items.push(item)
      }
      if (isObj(raw)) reasons.push(...lint(raw))
      for (const reason of reasons) problems.push({ file, item: name, reason })
    }
  }
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, bank: { version: bankVersion(items), items } }
}

/** The live items that resolve a fact key, in id order (AI-12). */
export function pick(bank: Bank, factKey: string): BankItem[] {
  return bank.items
    .filter((i) => !i.retired && i.resolves === factKey)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export type SignedList = { returnId: string; questions: { id: string; slots: Record<string, unknown> }[] }
export type HandOff = {
  bankVersion: string
  returnId: string
  questions: { id: string; slots: { name: string; value: unknown }[] }[]
}

/** The rows the client app reads: ids, slot names and values, the return and the bank version; no label, no text. */
export function toHandOff(bank: Bank, list: SignedList): HandOff {
  const questions = list.questions.map((q) => {
    const item = bank.items.find((i) => i.id === q.id)
    if (!item) throw new Error(`the bank holds no question ${q.id}`)
    const slots = Object.entries(q.slots).map(([name, value]) => {
      if (!item.slots.some((s) => s.name === name)) throw new Error(`question ${q.id} has no slot ${name}`)
      return { name, value }
    })
    return { id: q.id, slots }
  })
  return { bankVersion: bank.version, returnId: list.returnId, questions }
}
