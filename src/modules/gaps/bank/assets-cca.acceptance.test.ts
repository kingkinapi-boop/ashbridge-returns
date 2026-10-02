// Spec for card G12 (question bank: assets, cca). Choices the card leaves open (amber):
//  - The topic's client-askable facts are the six `qa.assets.*` facts E03A added (not-in-use cost and class, disposal
//    proceeds, kind, original cost and class). Each gets exactly one live item (the bank's one-fact rule); R27 and R28
//    gaps are what the gap pass raises on them. CCA closing balances come from the prior T2 and are never asked.
//  - Asset rows repeat (rowKey asset); the item resolves the fact and the row is the gap pass's concern, not a slot.
//  - The file is `data/question-bank/assets-cca.json`, topic `assets-cca`, ids `Q-ASSETS-<nnn>`.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import { loadBank, pick, type Bank } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const BANK_DIR = path.join(ROOT, 'data', 'question-bank')
const FILE = path.join(BANK_DIR, 'assets-cca.json')

const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const ASSET_FACTS = [
  'qa.assets.purchased_not_in_use',
  'qa.assets.purchased_not_in_use_cca_class',
  'qa.assets.disposed',
  'qa.assets.disposed_kind',
  'qa.assets.disposed_original_cost',
  'qa.assets.disposed_cca_class',
] as const

function bank(): Bank {
  const r = loadBank(BANK_DIR, catalogue)
  if (!r.ok) throw new Error(`the question bank is refused: ${JSON.stringify(r.problems)}`)
  return r.bank
}
const assetItems = () => bank().items.filter((i) => i.topic === 'assets-cca')

function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) yield* strings(x)
}

describe('ARC-2 the assets-cca file is a valid part of the bank', () => {
  test('ARC-2 data/question-bank/assets-cca.json exists, holds items and the whole bank folder loads', () => {
    expect(fs.existsSync(FILE)).toBe(true)
    expect(assetItems().length).toBeGreaterThanOrEqual(ASSET_FACTS.length)
  })

  test('ARC-2 every item in the file has topic assets-cca and an id Q-ASSETS-<nnn>; every assets item is in the file', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: { id: string; topic: string }[] }).items
    for (const i of inFile) {
      expect(i.topic, i.id).toBe('assets-cca')
      expect(i.id, i.id).toMatch(/^Q-ASSETS-\d{3}$/)
    }
    expect(assetItems().map((i) => i.id).sort()).toEqual(inFile.map((i) => i.id).sort())
  })

  test('ARC-2 the file holds only the format\'s own keys: no wording field of any name', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, unknown>[] }).items
    const allowed = ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']
    for (const i of inFile) expect(Object.keys(i).sort(), String(i['id'])).toEqual([...allowed].sort())
  })
})

describe('AI-12 every asset fact the client can state has exactly one question', () => {
  test.each(ASSET_FACTS)('AI-12 %s is in the catalogue, client-askable, and pick finds exactly one live item for it', (key) => {
    const fact = catalogue.get(key)
    expect(fact, key).toBeDefined()
    expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), key).toBe(true)
    expect(pick(bank(), key).length, `an asset gap on ${key} needs one question`).toBe(1)
  })

  test('AI-12 every assets item resolves a fact a client can state, never a document-supplied fact (CCA closing balances stay with the prior T2)', () => {
    for (const i of assetItems()) {
      const fact = catalogue.get(i.resolves)
      expect(fact, `${i.id} resolves ${i.resolves}`).toBeDefined()
      expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), `${i.id} resolves ${i.resolves}`).toBe(true)
      expect(i.resolves, i.id).not.toMatch(/^prior_t2\./)
    }
  })

  test('AI-12 no assets item is retired in the first release, and each resolves a distinct fact', () => {
    const items = assetItems()
    for (const i of items) expect(i.retired, i.id).toBe(false)
    expect(new Set(items.map((i) => i.resolves)).size).toBe(items.length)
  })
})

describe('ARC-2 each item fits the fact it resolves', () => {
  test('ARC-2 the cost and proceeds facts are an ASK for an amount: a required money_cents slot and a money answer', () => {
    for (const k of ['qa.assets.purchased_not_in_use', 'qa.assets.disposed', 'qa.assets.disposed_original_cost']) {
      const items = pick(bank(), k)
      expect(items.length, k).toBe(1)
      for (const i of items) {
        expect(i.type, i.id).toBe('ASK')
        expect(i.answer.shape, i.id).toBe('money')
        expect(i.slots.some((s) => s.type === 'money_cents' && s.required), i.id).toBe(true)
      }
    }
  })

  test('ARC-2 the disposal kind is a choice of exactly sold or written_off, in the slot and in the answer', () => {
    const kinds = pick(bank(), 'qa.assets.disposed_kind')
    expect(kinds.length).toBe(1)
    for (const i of kinds) {
      expect(i.answer.shape, i.id).toBe('choice')
      expect([...(i.answer.options ?? [])].sort(), i.id).toEqual(['sold', 'written_off'])
      const slot = i.slots.find((s) => s.type === 'choice')
      expect(slot, i.id).toBeDefined()
      expect([...(slot?.options ?? [])].sort(), i.id).toEqual(['sold', 'written_off'])
    }
  })

  test('ARC-2 the two CCA class questions each take one required slot and are not an amount, a date or a yes or no', () => {
    for (const k of ['qa.assets.purchased_not_in_use_cca_class', 'qa.assets.disposed_cca_class']) {
      const items = pick(bank(), k)
      expect(items.length, k).toBe(1)
      for (const i of items) {
        expect(i.slots.filter((s) => s.required).length, i.id).toBeGreaterThanOrEqual(1)
        expect(['money', 'date', 'yes_no', 'number'], i.id).not.toContain(i.answer.shape)
      }
    }
  })

  test('ARC-2 a slot name is a word in snake case, the same slot name never twice in one item', () => {
    for (const i of assetItems()) {
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
    for (const i of assetItems()) {
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
