// Spec for card G10 (question bank: revenue). Choices the card leaves open (amber, see reports/G10-spec.md):
//  - The topic's client-askable facts are listed here by key: the revenue facts the client can state
//    (`qa.revenue.annual_sales`, `onboarding.sales_channels.list`, `onboarding.fx.has_foreign_currency`).
//    Facts a document supplies (`hst.return.total_revenue`, the income statement lines) are never asked of a client.
//  - "Every test-world gap on this topic" is read as: a fact of this list that no item resolves is a gap the gap pass
//    could not turn into a question. The three keys are the test world's revenue gaps (client 06 states its sales
//    channels, client 12 states its sales, client 08 and others hold foreign currency).
//  - The file is `data/question-bank/revenue.json`, topic `revenue`, ids `Q-REV-<nnn>`; the loader is G01's.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import { loadBank, pick, type Bank } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const BANK_DIR = path.join(ROOT, 'data', 'question-bank')
const FILE = path.join(BANK_DIR, 'revenue.json')

const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const REVENUE_FACTS = ['qa.revenue.annual_sales', 'onboarding.sales_channels.list', 'onboarding.fx.has_foreign_currency'] as const

function bank(): Bank {
  const r = loadBank(BANK_DIR, catalogue)
  if (!r.ok) throw new Error(`the question bank is refused: ${JSON.stringify(r.problems)}`)
  return r.bank
}
const revenueItems = () => bank().items.filter((i) => i.topic === 'revenue')

function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) yield* strings(x)
}

describe('ARC-2 the revenue file is a valid part of the bank', () => {
  test('ARC-2 data/question-bank/revenue.json exists, holds items and the whole bank folder loads', () => {
    expect(fs.existsSync(FILE)).toBe(true)
    expect(revenueItems().length).toBeGreaterThanOrEqual(REVENUE_FACTS.length)
  })

  test('ARC-2 every item in the file has topic revenue and an id Q-REV-<nnn>; every revenue item is in the file', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: { id: string; topic: string }[] }).items
    for (const i of inFile) {
      expect(i.topic, i.id).toBe('revenue')
      expect(i.id, i.id).toMatch(/^Q-REV-\d{3}$/)
    }
    expect(revenueItems().map((i) => i.id).sort()).toEqual(inFile.map((i) => i.id).sort())
  })

  test('ARC-2 the file holds only the format\'s own keys: no wording field of any name', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, unknown>[] }).items
    const allowed = ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']
    for (const i of inFile) expect(Object.keys(i).sort(), String(i['id'])).toEqual([...allowed].sort())
  })
})

describe('AI-12 every revenue fact the client can state has a question', () => {
  test.each(REVENUE_FACTS)('AI-12 %s is in the catalogue, client-askable, and pick finds a live item for it', (key) => {
    const fact = catalogue.get(key)
    expect(fact, key).toBeDefined()
    expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), key).toBe(true)
    expect(pick(bank(), key).length, `a revenue gap on ${key} has no question`).toBeGreaterThan(0)
  })

  test('AI-12 every revenue item resolves a fact a client can state, never a document-supplied fact', () => {
    for (const i of revenueItems()) {
      const fact = catalogue.get(i.resolves)
      expect(fact, `${i.id} resolves ${i.resolves}`).toBeDefined()
      expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), `${i.id} resolves ${i.resolves}`).toBe(true)
    }
  })

  test('AI-12 no revenue item is retired in the first release: each fact keeps a live item', () => {
    for (const i of revenueItems()) expect(i.retired, i.id).toBe(false)
  })
})

describe('ARC-2 each item fits the fact it resolves', () => {
  test('ARC-2 the sales question is an ASK for an amount: a money_cents slot and a money answer', () => {
    const items = pick(bank(), 'qa.revenue.annual_sales')
    expect(items.some((i) => i.type === 'ASK' && i.answer.shape === 'money' && i.slots.some((s) => s.type === 'money_cents' && s.required))).toBe(true)
  })

  test('ARC-2 the foreign currency question has a yes or no answer', () => {
    const items = pick(bank(), 'onboarding.fx.has_foreign_currency')
    expect(items.every((i) => i.answer.shape === 'yes_no')).toBe(true)
  })

  test('ARC-2 the sales channels question takes a list the client states, so its answer is not a yes or no, a money or a date', () => {
    const items = pick(bank(), 'onboarding.sales_channels.list')
    for (const i of items) expect(['yes_no', 'money', 'date', 'number'], i.id).not.toContain(i.answer.shape)
  })

  test('ARC-2 a slot name is a word in snake case, the same slot name never twice in one item', () => {
    for (const i of revenueItems()) {
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
    for (const i of revenueItems()) {
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
