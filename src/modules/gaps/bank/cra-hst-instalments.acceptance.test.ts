// Spec for card G17 (question bank: cra, hst, instalments). Choices the card leaves open (amber, see reports/G17-spec.md):
//  - The topic's client-askable facts are listed here by key: `onboarding.hst.registered`, `onboarding.corporation.hst_filing_frequency`,
//    `onboarding.corporation.hst_basis`, `onboarding.cra_program.program`, `onboarding.cra_program.is_open`, `onboarding.cra_record.available`.
//    The catalogue holds no client-askable instalment fact (the instalment keys are cra_capture, supplied by a document), so none is asked.
//  - "Every test-world gap on this topic" is read as: a fact of this list that no item resolves is a gap the gap pass
//    could not turn into a question (G00 does not exist yet).
//  - The file is `data/question-bank/cra-hst-instalments.json`, topic `cra-hst-instalments`, ids `Q-CRA-<nnn>`; the loader is G01's.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import { loadBank, pick, type Bank } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const BANK_DIR = path.join(ROOT, 'data', 'question-bank')
const FILE = path.join(BANK_DIR, 'cra-hst-instalments.json')

const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const TOPIC_FACTS = [
  'onboarding.hst.registered',
  'onboarding.corporation.hst_filing_frequency',
  'onboarding.corporation.hst_basis',
  'onboarding.cra_program.program',
  'onboarding.cra_program.is_open',
  'onboarding.cra_record.available',
] as const

function bank(): Bank {
  const r = loadBank(BANK_DIR, catalogue)
  if (!r.ok) throw new Error(`the question bank is refused: ${JSON.stringify(r.problems)}`)
  return r.bank
}
const topicItems = () => bank().items.filter((i) => i.topic === 'cra-hst-instalments')

function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) yield* strings(x)
}

describe('ARC-2 the cra-hst-instalments file is a valid part of the bank', () => {
  test('ARC-2 data/question-bank/cra-hst-instalments.json exists, holds items and the whole bank folder loads', () => {
    expect(fs.existsSync(FILE)).toBe(true)
    expect(topicItems().length).toBeGreaterThanOrEqual(TOPIC_FACTS.length)
  })

  test('ARC-2 every item in the file has topic cra-hst-instalments and an id Q-CRA-<nnn>; every cra-hst-instalments item is in the file', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: { id: string; topic: string }[] }).items
    for (const i of inFile) {
      expect(i.topic, i.id).toBe('cra-hst-instalments')
      expect(i.id, i.id).toMatch(/^Q-CRA-\d{3}$/)
    }
    expect(topicItems().map((i) => i.id).sort()).toEqual(inFile.map((i) => i.id).sort())
  })

  test('ARC-2 the file holds only the format\'s own keys: no wording field of any name', () => {
    const inFile = (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, unknown>[] }).items
    const allowed = ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']
    for (const i of inFile) expect(Object.keys(i).sort(), String(i['id'])).toEqual([...allowed].sort())
  })
})

describe('AI-12 every fact of this topic the client can state has a question', () => {
  test.each(TOPIC_FACTS)('AI-12 %s is in the catalogue, client-askable, and pick finds a live item for it', (key) => {
    const fact = catalogue.get(key)
    expect(fact, key).toBeDefined()
    expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), key).toBe(true)
    expect(pick(bank(), key).length, `a cra-hst-instalments gap on ${key} has no question`).toBeGreaterThan(0)
  })

  test('AI-12 every cra-hst-instalments item resolves a fact a client can state, never a document-supplied fact', () => {
    for (const i of topicItems()) {
      const fact = catalogue.get(i.resolves)
      expect(fact, `${i.id} resolves ${i.resolves}`).toBeDefined()
      expect(fact?.suppliedBy.some((s) => s === 'onboarding' || s === 'qa'), `${i.id} resolves ${i.resolves}`).toBe(true)
    }
  })

  test('AI-12 no item is retired in the first release: each fact keeps a live item', () => {
    for (const i of topicItems()) expect(i.retired, i.id).toBe(false)
  })
})

describe('ARC-2 each item fits the fact it resolves', () => {
  test('ARC-2 the yes or no facts have a yes or no answer', () => {
    for (const k of ['onboarding.hst.registered', 'onboarding.cra_program.is_open', 'onboarding.cra_record.available']) {
      const items = pick(bank(), k)
      expect(items.length, k).toBeGreaterThan(0)
      expect(items.every((i) => i.answer.shape === 'yes_no'), k).toBe(true)
    }
  })

  test('ARC-2 the HST filing frequency, HST basis and CRA program are a choice with a required choice slot and options', () => {
    for (const k of ['onboarding.corporation.hst_filing_frequency', 'onboarding.corporation.hst_basis', 'onboarding.cra_program.program']) {
      const items = pick(bank(), k)
      expect(
        items.some((i) => i.answer.shape === 'choice' && (i.answer.options?.length ?? 0) > 0 && i.slots.some((s) => s.type === 'choice' && s.required && (s.options?.length ?? 0) > 0)),
        k,
      ).toBe(true)
    }
  })

  test('ARC-2 the CRA program item offers every program the catalogue names', () => {
    const programs = ['corporate_tax', 'hst', 'payroll', 'information_returns']
    const opts = pick(bank(), 'onboarding.cra_program.program').flatMap((i) => i.answer.options ?? [])
    for (const p of programs) expect(opts, p).toContain(p)
  })

  test('ARC-2 a slot name is a word in snake case, the same slot name never twice in one item', () => {
    for (const i of topicItems()) {
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
    for (const i of topicItems()) {
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
