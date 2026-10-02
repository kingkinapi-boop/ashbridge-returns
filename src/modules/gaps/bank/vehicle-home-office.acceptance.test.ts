// Spec for card G16 (question bank: vehicle, home, office). Choices the card leaves open (amber, see reports/G16-spec.md):
//  - G11 (expenses) already holds items for the other vehicle and home facts (business use, km, costs, home share), so this
//    topic lists only the two client-only facts no other bank file resolves: `qa.vehicle.ownership` (owned or leased)
//    and `qa.home_office.principal_place` (yes or no). Reverse: add keys to the list below.
//  - "Every test-world gap on this topic" is read as: a fact of this list that no item resolves is a gap the gap pass
//    could not turn into a question (G00 does not exist yet).
//  - The file is `data/question-bank/vehicle-home-office.json`, topic `vehicle-home-office`, ids `Q-VHO-<nnn>`; the loader is G01's.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import { loadBank, pick, type Bank } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const BANK_DIR = path.join(ROOT, 'data', 'question-bank')
const FILE = path.join(BANK_DIR, 'vehicle-home-office.json')

const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const VHO_FACTS = [
  'qa.vehicle.ownership',
  'qa.home_office.principal_place',
] as const

function bank(): Bank {
  const r = loadBank(BANK_DIR, catalogue)
  if (!r.ok) throw new Error(`the question bank is refused: ${JSON.stringify(r.problems)}`)
  return r.bank
}
const vhoItems = () => bank().items.filter((i) => i.topic === 'vehicle-home-office')

function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) yield* strings(x)
}

describe('ARC-2 the vehicle-home-office file is a valid part of the bank', () => {
  test('ARC-2 data/question-bank/vehicle-home-office.json exists, holds items and the whole bank folder loads', () => {
    expect(fs.existsSync(FILE)).toBe(true)
    expect(vhoItems().length).toBeGreaterThanOrEqual(VHO_FACTS.length)
  })

  test('ARC-2 every item in the file has topic vehicle-home-office and an id Q-VHO-<nnn>; every vehicle-home-office item is in the file', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: { id: string; topic: string }[] }).items
    for (const i of inFile) {
      expect(i.topic, i.id).toBe('vehicle-home-office')
      expect(i.id, i.id).toMatch(/^Q-VHO-\d{3}$/)
    }
    expect(vhoItems().map((i) => i.id).sort()).toEqual(inFile.map((i) => i.id).sort())
  })

  test('ARC-2 the file holds only the format\'s own keys: no wording field of any name', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, unknown>[] }).items
    const allowed = ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']
    for (const i of inFile) expect(Object.keys(i).sort(), String(i['id'])).toEqual([...allowed].sort())
  })
})

describe('AI-12 every vehicle, home and office fact the client can state has a question', () => {
  test.each(VHO_FACTS)('AI-12 %s is in the catalogue, client-askable, and pick finds a live item for it', (key) => {
    const fact = catalogue.get(key)
    expect(fact, key).toBeDefined()
    expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), key).toBe(true)
    expect(pick(bank(), key).length, `a vehicle, home or office gap on ${key} has no question`).toBeGreaterThan(0)
  })

  test('AI-12 every vehicle-home-office item resolves a fact a client can state, never a document-supplied fact', () => {
    for (const i of vhoItems()) {
      const fact = catalogue.get(i.resolves)
      expect(fact, `${i.id} resolves ${i.resolves}`).toBeDefined()
      expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), `${i.id} resolves ${i.resolves}`).toBe(true)
    }
  })

  test('AI-12 no vehicle-home-office item is retired in the first release: each fact keeps a live item', () => {
    for (const i of vhoItems()) expect(i.retired, i.id).toBe(false)
  })
})

describe('ARC-2 each item fits the fact it resolves', () => {
  test('ARC-2 the ownership fact has a choice answer of exactly the catalogue options; the principal-place fact is yes or no', () => {
    const opts = catalogue.get('qa.vehicle.ownership')?.options ?? []
    expect(opts.length).toBeGreaterThan(0)
    const own = pick(bank(), 'qa.vehicle.ownership')
    expect(own.length).toBeGreaterThan(0)
    for (const i of own) {
      expect(i.answer.shape, i.id).toBe('choice')
      expect([...(i.answer.options ?? [])].sort(), i.id).toEqual([...opts].sort())
    }
    const place = pick(bank(), 'qa.home_office.principal_place')
    expect(place.length).toBeGreaterThan(0)
    expect(place.every((i) => i.answer.shape === 'yes_no')).toBe(true)
  })

  test('ARC-2 no vehicle-home-office item asks for an amount: costs and km are G11 items, not repeated here', () => {
    for (const i of vhoItems()) {
      expect(i.answer.shape, i.id).not.toBe('money')
      expect(i.slots.some((s) => s.type === 'money_cents'), i.id).toBe(false)
    }
  })

  test('ARC-2 a slot name is a word in snake case, the same slot name never twice in one item', () => {
    for (const i of vhoItems()) {
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
    for (const i of vhoItems()) {
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
