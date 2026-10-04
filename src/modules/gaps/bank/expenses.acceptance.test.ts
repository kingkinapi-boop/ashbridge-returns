// Spec for card G11 (question bank: expenses). Choices the card leaves open (amber, see reports/G11-spec.md):
//  - The topic's client-askable facts are listed here by key: the expense facts only the client can state
//    (`onboarding.expense.personal_card_business_items`, `onboarding.home_office.claimed`, `onboarding.vehicle.business_use`,
//    `qa.home.personal_costs`, `qa.home.business_use_share`, `qa.vehicle.business_km`, `qa.vehicle.total_km`, `qa.vehicle.cost`).
//    Expense amounts a document or the books supply are never asked of a client.
//  - "Every test-world gap on this topic" is read as: a fact of this list that no item resolves is a gap the gap pass
//    could not turn into a question (G00 does not exist yet).
//  - The file is `data/question-bank/expenses.json`, topic `expenses`, ids `Q-EXP-<nnn>`; the loader is G01's.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import { loadBank, pick, type Bank } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const BANK_DIR = path.join(ROOT, 'data', 'question-bank')
const FILE = path.join(BANK_DIR, 'expenses.json')

const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const EXPENSE_FACTS = [
  'onboarding.expense.personal_card_business_items',
  'onboarding.home_office.claimed',
  'onboarding.vehicle.business_use',
  'qa.home.personal_costs',
  'qa.home.business_use_share',
  'qa.vehicle.business_km',
  'qa.vehicle.total_km',
  'qa.vehicle.cost',
] as const

function bank(): Bank {
  const r = loadBank(BANK_DIR, catalogue)
  if (!r.ok) throw new Error(`the question bank is refused: ${JSON.stringify(r.problems)}`)
  return r.bank
}
const expenseItems = () => bank().items.filter((i) => i.topic === 'expenses')

function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) yield* strings(x)
}

describe('ARC-2 the expenses file is a valid part of the bank', () => {
  test('ARC-2 data/question-bank/expenses.json exists, holds items and the whole bank folder loads', () => {
    expect(fs.existsSync(FILE)).toBe(true)
    expect(expenseItems().length).toBeGreaterThanOrEqual(EXPENSE_FACTS.length)
  })

  test('ARC-2 every item in the file has topic expenses and an id Q-EXP-<nnn>; every expense item is in the file', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: { id: string; topic: string }[] }).items
    for (const i of inFile) {
      expect(i.topic, i.id).toBe('expenses')
      expect(i.id, i.id).toMatch(/^Q-EXP-\d{3}$/)
    }
    expect(expenseItems().map((i) => i.id).sort()).toEqual(inFile.map((i) => i.id).sort())
  })

  test('ARC-2 the file holds only the format\'s own keys: no wording field of any name', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, unknown>[] }).items
    const allowed = ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']
    for (const i of inFile) expect(Object.keys(i).sort(), String(i['id'])).toEqual([...allowed].sort())
  })
})

describe('AI-12 every expense fact the client can state has a question', () => {
  test.each(EXPENSE_FACTS)('AI-12 %s is in the catalogue, client-askable, and pick finds a live item for it', (key) => {
    const fact = catalogue.get(key)
    expect(fact, key).toBeDefined()
    expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), key).toBe(true)
    expect(pick(bank(), key).length, `a expenses gap on ${key} has no question`).toBeGreaterThan(0)
  })

  test('AI-12 every expense item resolves a fact a client can state, never a document-supplied fact', () => {
    for (const i of expenseItems()) {
      const fact = catalogue.get(i.resolves)
      expect(fact, `${i.id} resolves ${i.resolves}`).toBeDefined()
      expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), `${i.id} resolves ${i.resolves}`).toBe(true)
    }
  })

  test('AI-12 no expense item is retired in the first release: each fact keeps a live item', () => {
    for (const i of expenseItems()) expect(i.retired, i.id).toBe(false)
  })
})

describe('ARC-2 each item fits the fact it resolves', () => {
  test('ARC-2 the yes or no facts have a yes or no answer', () => {
    for (const k of ['onboarding.expense.personal_card_business_items', 'onboarding.home_office.claimed', 'onboarding.vehicle.business_use']) {
      const items = pick(bank(), k)
      expect(items.length, k).toBeGreaterThan(0)
      expect(items.every((i) => i.answer.shape === 'yes_no'), k).toBe(true)
    }
  })

  test('ARC-2 the money facts are an ASK for an amount: a required money_cents slot and a money answer', () => {
    for (const k of ['qa.home.personal_costs', 'qa.vehicle.cost']) {
      const items = pick(bank(), k)
      expect(items.some((i) => i.type === 'ASK' && i.answer.shape === 'money' && i.slots.some((s) => s.type === 'money_cents' && s.required)), k).toBe(true)
    }
  })

  test('ARC-2 the business-use share is a percent slot, and the kilometres are count slots with a number answer', () => {
    expect(pick(bank(), 'qa.home.business_use_share').some((i) => i.slots.some((s) => s.type === 'percent' && s.required))).toBe(true)
    for (const k of ['qa.vehicle.business_km', 'qa.vehicle.total_km']) {
      const items = pick(bank(), k)
      expect(items.some((i) => i.answer.shape === 'number' && i.slots.some((s) => s.type === 'count' && s.required)), k).toBe(true)
    }
  })

  test('ARC-2 a slot name is a word in snake case, the same slot name never twice in one item', () => {
    expect(expenseItems().length, 'the expenses topic holds items to check').toBeGreaterThan(0)
    for (const i of expenseItems()) {
      const names = i.slots.map((s) => s.name)
      for (const n of names) expect(n, i.id).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(new Set(names).size, i.id).toBe(names.length)
    }
  })
})

describe('RULE-19 END-7 the file holds no sentence for a client', () => {
  test('RULE-19 no string in the file ends in a full stop, question mark or exclamation mark, or speaks to "you"', () => {
    const text = JSON.parse(fs.readFileSync(FILE, 'utf8')) as unknown
    for (const s of strings(text)) {
      expect(s.trim(), s).not.toMatch(/[.?!]$/)
      expect(s, s).not.toMatch(/\b(you|your)\b/i)
    }
  })

  test('END-7 every label is a staff label of at most 60 characters', () => {
    for (const i of expenseItems()) {
      expect(i.label.length, i.id).toBeLessThanOrEqual(60)
      expect(i.label.trim(), i.id).not.toBe('')
    }
  })

  test('END-7 no string in the file reads as a question or an instruction: no word that starts a question', () => {
    const text = JSON.parse(fs.readFileSync(FILE, 'utf8')) as unknown
    const opens = /^(what|when|where|why|how|did|do|does|is|are|please|tell|enter|select)\b/i
    for (const s of strings(text)) expect(s, s).not.toMatch(opens)
  })
})
