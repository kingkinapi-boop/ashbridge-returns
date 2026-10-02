// Spec for card G01 (question bank format). Choices the card leaves open, recorded as amber in the spec report:
//  - `loadBank(dir, catalogue)` takes E03's loaded catalogue (the card says the loader checks `resolves` against it).
//  - A bank file is `{ "items": [...] }`; the loader skips `_schema.json`; files are read in name order.
//  - Result: `{ ok: true, bank: { version, items } }` or `{ ok: false, problems: [{ file, item, reason }] }`, `file` being
//    the file's base name and `item` the item id (or the item's position when it has no readable id).
//  - Slot types: money_cents, date, count, percent, document_ref, account_ref, fact_ref, choice (with `options`).
//    A money_cents, date, count or percent slot must match the fact's value type; reference and choice slots fit any fact.
//  - Answer shapes: money, date, yes_no, choice (with `options`), file, number.
//  - `toHandOff(bank, list)`: list is `{ returnId, questions: [{ id, slots: { <slot name>: <value> } }] }`.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { afterAll, describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import * as gaps from '../index'
import { loadBank, pick, toHandOff } from './index'

const FIXTURES = path.join(import.meta.dirname, '__fixtures__')
const GOLDEN = path.join(import.meta.dirname, '__golden__')
const REAL_BANK_DIR = path.join(import.meta.dirname, '..', '..', '..', '..', 'data', 'question-bank')

const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', '..', '..', 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const tmpRoots: string[] = []
function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'g01-bank-'))
  tmpRoots.push(d)
  return d
}
afterAll(() => {
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true })
})

/** Copy a fixture folder, so a test can change one file. */
function copyFixture(name: string): string {
  const d = tmpDir()
  fs.cpSync(path.join(FIXTURES, name), d, { recursive: true })
  return d
}

const BASE_ITEM = {
  id: 'Q-DIV-001',
  type: 'ASK',
  resolves: 'onboarding.dividend.amount',
  slots: [{ name: 'amount', type: 'money_cents', required: true }],
  answer: { shape: 'money' },
  label: 'Dividend amount',
  topic: 'dividends',
  retired: false,
}

/** A one-file bank holding the base item with the given fields replaced. */
function bankWith(patch: Record<string, unknown>): string {
  const d = tmpDir()
  fs.writeFileSync(path.join(d, 'dividends.json'), JSON.stringify({ items: [{ ...BASE_ITEM, ...patch }] }))
  return d
}

function refusal(dir: string): { file: string; item: string; reason: string }[] {
  const r = loadBank(dir, catalogue)
  expect(r.ok, `expected ${dir} to be refused`).toBe(false)
  return r.ok ? [] : r.problems
}

function accepted(dir: string): ReturnType<typeof expectBank> {
  return expectBank(loadBank(dir, catalogue))
}
function expectBank(r: ReturnType<typeof loadBank>) {
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r.problems)}`)
  return r.bank
}

describe('ARC-2 the valid fixture bank loads, each bad copy is refused naming file, item and reason', () => {
  test('ARC-2 the valid fixture bank loads with a version and every item, skipping _schema.json', () => {
    const bank = accepted(path.join(FIXTURES, 'valid'))
    expect(bank.version).toMatch(/^[0-9a-f]{64}$/)
    expect(bank.items.map((i) => i.id).sort()).toEqual(
      ['Q-CRA-001', 'Q-DIV-001', 'Q-DIV-002', 'Q-DIV-003', 'Q-DIV-004', 'Q-DOC-001', 'Q-OWN-001'],
    )
    const decide = bank.items.find((i) => i.id === 'Q-CRA-001')
    expect(decide).toMatchObject({ type: 'DECIDE', resolves: 'onboarding.cra_program.program', topic: 'cra', retired: false })
    expect(bank.items.find((i) => i.id === 'Q-DIV-003')?.retired).toBe(true)
  })

  test('ARC-2 the shipped data/question-bank folder loads (its _schema.json is skipped; the topic cards add items)', () => {
    expect(fs.existsSync(path.join(REAL_BANK_DIR, '_schema.json'))).toBe(true)
    accepted(REAL_BANK_DIR)
  })

  test('ARC-2 _schema.json is a JSON Schema that names every item field', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(REAL_BANK_DIR, '_schema.json'), 'utf8')) as Record<string, unknown>
    const text = JSON.stringify(schema)
    for (const field of ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']) {
      expect(text, field).toContain(`"${field}"`)
    }
    for (const word of ['ASK', 'CONFIRM', 'DECIDE']) expect(text, word).toContain(word)
  })

  test.each([
    ['bad-duplicate-id', 'b-second.json', 'Q-DIV-001', /duplicate/i],
    ['bad-id-pattern', 'dividends.json', 'DIV-1', /id|pattern/i],
    ['bad-unknown-fact', 'dividends.json', 'Q-DIV-001', /catalogue|unknown fact|onboarding\.nothing\.here/i],
    ['bad-slot-type', 'dividends.json', 'Q-DIV-002', /slot|money_cents/i],
    ['bad-retired-reuse', 'b-new.json', 'Q-DIV-001', /retired/i],
  ])('ARC-2 %s is refused naming file %s, item %s and a reason', (folder, file, item, reason) => {
    const problems = refusal(path.join(FIXTURES, folder))
    const hit = problems.find((p) => p.file === file && p.item === item)
    expect(hit, JSON.stringify(problems)).toBeDefined()
    expect(hit?.reason).toMatch(reason)
  })

  test('ARC-2 a refusal never loads part of a bank: ok is false and no bank is returned', () => {
    const r = loadBank(path.join(FIXTURES, 'bad-duplicate-id'), catalogue)
    expect(r.ok).toBe(false)
    expect(r).not.toHaveProperty('bank')
  })

  test('ARC-2 the unknown-fact refusal names the fact key it could not find', () => {
    const [p] = refusal(path.join(FIXTURES, 'bad-unknown-fact'))
    expect(p?.reason).toContain('onboarding.nothing.here')
  })

  test('ARC-2 an id must be Q-<TOPIC>-<nnn>: wrong shapes are refused, right shapes load', () => {
    for (const id of ['q-div-001', 'Q-DIV-1', 'Q-DIV-0001x', 'Q--001', 'Q-DIV-', 'X-DIV-001', 'Q-DIV-001 ', ' Q-DIV-001', 'Q-D1V-001']) {
      expect(refusal(bankWith({ id })).some((p) => p.item === id), id).toBe(true)
    }
    for (const id of ['Q-DIV-001', 'Q-CRAB-123', 'Q-A-999']) accepted(bankWith({ id }))
  })

  test('ARC-2 a missing required field, an unknown type and an unknown answer shape are refused', () => {
    for (const field of ['id', 'type', 'resolves', 'slots', 'answer', 'label', 'topic', 'retired']) {
      const item = Object.fromEntries(Object.entries(BASE_ITEM).filter(([k]) => k !== field))
      const d = tmpDir()
      fs.writeFileSync(path.join(d, 'x.json'), JSON.stringify({ items: [item] }))
      expect(refusal(d).length, field).toBeGreaterThan(0)
    }
    expect(refusal(bankWith({ type: 'TELL' })).length).toBeGreaterThan(0)
    expect(refusal(bankWith({ type: 'ask' })).length).toBeGreaterThan(0)
    expect(refusal(bankWith({ answer: { shape: 'essay' } })).length).toBeGreaterThan(0)
    expect(refusal(bankWith({ retired: 'no' })).length).toBeGreaterThan(0)
  })

  test('ARC-2 a file that is not JSON, or holds no items list, is refused naming the file', () => {
    const d = tmpDir()
    fs.writeFileSync(path.join(d, 'broken.json'), '{ not json')
    expect(refusal(d).some((p) => p.file === 'broken.json')).toBe(true)
    const e = tmpDir()
    fs.writeFileSync(path.join(e, 'noitems.json'), JSON.stringify({ rows: [] }))
    expect(refusal(e).some((p) => p.file === 'noitems.json')).toBe(true)
  })

  test('ARC-2 every problem in a bank is reported, not only the first', () => {
    const d = tmpDir()
    fs.writeFileSync(
      path.join(d, 'many.json'),
      JSON.stringify({
        items: [
          { ...BASE_ITEM, id: 'Q-DIV-001', resolves: 'onboarding.nothing.here' },
          { ...BASE_ITEM, id: 'Q-DIV-002', label: 'Is it so?' },
          { ...BASE_ITEM, id: 'bad' },
        ],
      }),
    )
    const items = refusal(d).map((p) => p.item)
    for (const id of ['Q-DIV-001', 'Q-DIV-002', 'bad']) expect(items).toContain(id)
  })

  test('ARC-2 a retired id may stay in the bank beside its own file and a retired duplicate is not reused by a live item', () => {
    // The retired item alone loads; the same id live in another file is the refusal tested above.
    accepted(bankWith({ retired: true }))
  })
})

describe('ARC-2 slot types fit the fact they fill', () => {
  const slot = (type: string, extra: Record<string, unknown> = {}) => [{ name: 'v', type, required: true, ...extra }]

  test.each([
    ['money_cents', 'onboarding.dividend.declared_on'],
    ['date', 'onboarding.dividend.amount'],
    ['count', 'onboarding.shareholder.percent_common'],
    ['percent', 'onboarding.dividend.amount'],
    ['money_cents', 'onboarding.hst.registered'],
    ['date', 'onboarding.owners.count'],
  ])('ARC-2 planted fault: a %s slot on %s is refused naming the slot type', (type, resolves) => {
    const problems = refusal(bankWith({ resolves, slots: slot(type) }))
    expect(problems[0]?.item).toBe('Q-DIV-001')
    expect(problems[0]?.reason).toContain(type)
  })

  test.each([
    ['money_cents', 'onboarding.dividend.amount'],
    ['date', 'onboarding.dividend.declared_on'],
    ['count', 'onboarding.owners.count'],
    ['percent', 'onboarding.shareholder.percent_common'],
  ])('ARC-2 no false alarm: a %s slot on %s loads', (type, resolves) => {
    accepted(bankWith({ resolves, slots: slot(type) }))
  })

  test.each(['document_ref', 'account_ref', 'fact_ref'])('ARC-2 a %s slot loads on any fact', (type) => {
    accepted(bankWith({ resolves: 'onboarding.dividend.declared_on', slots: slot(type) }))
    accepted(bankWith({ resolves: 'onboarding.dividend.amount', slots: slot(type) }))
  })

  test('ARC-2 a choice slot lists its option ids; one with none, or an unknown slot type, is refused', () => {
    accepted(bankWith({ resolves: 'onboarding.cra_program.program', slots: slot('choice', { options: ['hst', 'payroll'] }) }))
    expect(refusal(bankWith({ resolves: 'onboarding.cra_program.program', slots: slot('choice') })).length).toBeGreaterThan(0)
    expect(refusal(bankWith({ resolves: 'onboarding.cra_program.program', slots: slot('choice', { options: [] }) })).length).toBeGreaterThan(0)
    expect(refusal(bankWith({ slots: slot('sentence') })).length).toBeGreaterThan(0)
  })

  test('ARC-2 a slot needs a name and a required flag', () => {
    expect(refusal(bankWith({ slots: [{ type: 'money_cents', required: true }] })).length).toBeGreaterThan(0)
    expect(refusal(bankWith({ slots: [{ name: 'amount', type: 'money_cents' }] })).length).toBeGreaterThan(0)
  })
})

describe('RULE-19 END-7 the no-sentence lint', () => {
  test('RULE-19 the label ending in a question mark is refused by the lint', () => {
    const problems = refusal(path.join(FIXTURES, 'bad-label-question'))
    const hit = problems.find((p) => p.file === 'dividends.json' && p.item === 'Q-DIV-001')
    expect(hit?.reason).toMatch(/question mark|sentence|\?/i)
  })

  test('END-7 the label holding "your" is refused by the lint', () => {
    const problems = refusal(path.join(FIXTURES, 'bad-label-your'))
    const hit = problems.find((p) => p.file === 'dividends.json' && p.item === 'Q-DIV-001')
    expect(hit?.reason).toMatch(/your|second.person|sentence/i)
  })

  test.each([
    ['Dividend amount.', 'full stop'],
    ['Dividend amount!', 'exclamation'],
    ['Dividend amount?', 'question'],
    ['Did you declare it', 'you'],
    ['YOUR dividend', 'your'],
    ['What is your amount', 'your'],
  ])('RULE-19 planted fault: the label %j is refused', (label) => {
    expect(refusal(bankWith({ label })).some((p) => p.item === 'Q-DIV-001')).toBe(true)
  })

  test.each(['Dividend amount, young shareholder', 'Youth grant', 'Dividend 2025.5', 'Label with a, comma', 'Q: dividend (old)'])(
    'RULE-19 no false alarm: the label %j loads',
    (label) => {
      accepted(bankWith({ label }))
    },
  )

  test('RULE-19 a label of exactly 60 characters loads and one of 61 is refused', () => {
    accepted(bankWith({ label: 'a'.repeat(60) }))
    expect(refusal(bankWith({ label: 'a'.repeat(61) })).some((p) => p.item === 'Q-DIV-001')).toBe(true)
  })

  test('RULE-19 the lint reads every string in a bank file, not only labels', () => {
    const slots = [{ name: 'amount?', type: 'money_cents', required: true }]
    expect(refusal(bankWith({ slots })).some((p) => p.item === 'Q-DIV-001')).toBe(true)
    expect(refusal(bankWith({ topic: 'dividends.' })).some((p) => p.item === 'Q-DIV-001')).toBe(true)
    const choice = [{ name: 'program', type: 'choice', required: true, options: ['hst', 'Pick your own'] }]
    expect(refusal(bankWith({ resolves: 'onboarding.cra_program.program', slots: choice })).some((p) => p.item === 'Q-DIV-001')).toBe(true)
    const shape = { shape: 'choice', options: ['yes', 'no.'] }
    expect(refusal(bankWith({ resolves: 'onboarding.cra_program.program', slots: [], answer: shape })).some((p) => p.item === 'Q-DIV-001')).toBe(true)
  })

  test('RULE-19 property (seed 20261002): any label ending in a full stop, question mark or exclamation mark, or past 60 characters, is refused', () => {
    const words = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,38}[A-Za-z]$/).filter((s) => !/\b(you|your)\b/i.test(s))
    const ending = fc.tuple(words, fc.constantFrom('.', '?', '!')).map(([w, e]) => `${w}${e}`)
    const tooLong = fc.stringMatching(/^[a-z]{61,100}$/)
    const d = tmpDir()
    fc.assert(
      fc.property(fc.oneof(ending, tooLong), (label) => {
        fs.writeFileSync(path.join(d, 'dividends.json'), JSON.stringify({ items: [{ ...BASE_ITEM, label }] }))
        const r = loadBank(d, catalogue)
        return !r.ok && r.problems.some((p) => p.item === 'Q-DIV-001')
      }),
      { seed: 20261002, numRuns: 60 },
    )
  })

  test('RULE-19 property (seed 20261003): a label of plain words up to 60 characters, with no final mark, is never refused', () => {
    const label = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,58}[A-Za-z]$/).filter((s) => !/\b(you|your)\b/i.test(s))
    const d = tmpDir()
    fc.assert(
      fc.property(label, (l) => {
        fs.writeFileSync(path.join(d, 'dividends.json'), JSON.stringify({ items: [{ ...BASE_ITEM, label: l }] }))
        return loadBank(d, catalogue).ok
      }),
      { seed: 20261003, numRuns: 60 },
    )
  })
})

const LIST = {
  returnId: 'RET-0001',
  questions: [
    { id: 'Q-DIV-001', slots: { amount: 1250000 } },
    { id: 'Q-DIV-002', slots: { declared_on: '2025-12-15' } },
    { id: 'Q-CRA-001', slots: { program: 'hst' } },
  ],
}

describe('ARC-2 END-7 toHandOff', () => {
  const bank = accepted(path.join(FIXTURES, 'valid'))

  test('ARC-2 toHandOff equals its golden file (bank version stands in for the hash)', async () => {
    const out = toHandOff(bank, LIST)
    expect(out.bankVersion).toBe(bank.version)
    const shown = JSON.stringify({ ...out, bankVersion: '<bank version>' }, null, 2) + '\n'
    await expect(shown).toMatchFileSnapshot(path.join(GOLDEN, 'to-hand-off.json'))
  })

  test('END-7 the hand-off holds no label or other text: only ids, slot names, slot values, the return and the bank version', () => {
    const out = toHandOff(bank, LIST)
    expect(Object.keys(out).sort()).toEqual(['bankVersion', 'questions', 'returnId'])
    for (const q of out.questions) {
      expect(Object.keys(q).sort()).toEqual(['id', 'slots'])
      for (const s of q.slots) expect(Object.keys(s).sort()).toEqual(['name', 'value'])
    }
    const text = JSON.stringify(out)
    for (const item of bank.items) expect(text, item.label).not.toContain(item.label)
    expect(text).not.toMatch(/label|topic|answer|resolves/)
  })

  test('END-7 the questions keep the order of the list given', () => {
    const reversed = { ...LIST, questions: [...LIST.questions].reverse() }
    expect(toHandOff(bank, reversed).questions.map((q) => q.id)).toEqual(['Q-CRA-001', 'Q-DIV-002', 'Q-DIV-001'])
  })

  test('ARC-2 the hand-off names a question or slot the bank does not hold by refusing it', () => {
    expect(() => toHandOff(bank, { returnId: 'RET-0001', questions: [{ id: 'Q-NOPE-001', slots: {} }] })).toThrow(/Q-NOPE-001/)
    expect(() => toHandOff(bank, { returnId: 'RET-0001', questions: [{ id: 'Q-DIV-001', slots: { nope: 1 } }] })).toThrow(/nope/)
  })
})

describe('AI-12 pick', () => {
  const bank = accepted(path.join(FIXTURES, 'valid'))

  test('AI-12 pick returns the non-retired items that resolve the fact key, in id order, whatever the file order', () => {
    expect(pick(bank, 'onboarding.dividend.amount').map((i) => i.id)).toEqual(['Q-DIV-001', 'Q-DIV-004'])
  })

  test('AI-12 a retired item is never picked', () => {
    expect(pick(bank, 'onboarding.dividend.amount').map((i) => i.id)).not.toContain('Q-DIV-003')
    const onlyRetired = accepted(bankWith({ retired: true }))
    expect(pick(onlyRetired, 'onboarding.dividend.amount')).toEqual([])
  })

  test('AI-12 only items that resolve that key are returned; a fact with no item gives an empty list', () => {
    expect(pick(bank, 'onboarding.dividend.declared_on').map((i) => i.id)).toEqual(['Q-DIV-002'])
    expect(pick(bank, 'onboarding.cra_program.program').map((i) => i.id)).toEqual(['Q-CRA-001'])
    expect(pick(bank, 'bank.statement.closing_balance')).toEqual([])
  })
})

describe('ARC-2 the bank version', () => {
  const versionOf = (dir: string): string => accepted(dir).version

  test('ARC-2 the version changes when any item changes', () => {
    const base = versionOf(path.join(FIXTURES, 'valid'))
    const edits: Array<(item: Record<string, unknown>) => void> = [
      (i) => { i['label'] = 'A different label' },
      (i) => { i['retired'] = true },
      (i) => { i['topic'] = 'other' },
      (i) => { i['slots'] = [{ name: 'amount', type: 'money_cents', required: false }] },
      (i) => { i['answer'] = { shape: 'number' } },
    ]
    for (const [n, edit] of edits.entries()) {
      const d = copyFixture('valid')
      const file = path.join(d, 'a-dividends.json')
      const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { items: Array<Record<string, unknown>> }
      edit(json.items[0] as Record<string, unknown>)
      fs.writeFileSync(file, JSON.stringify(json))
      expect(versionOf(d), `edit ${String(n)}`).not.toBe(base)
    }
  })

  test('ARC-2 the version changes when an item is added or removed', () => {
    const base = versionOf(path.join(FIXTURES, 'valid'))
    const d = copyFixture('valid')
    const file = path.join(d, 'a-dividends.json')
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { items: unknown[] }
    json.items.pop()
    fs.writeFileSync(file, JSON.stringify(json))
    expect(versionOf(d)).not.toBe(base)
  })

  test('ARC-2 the version does not change when a file is re-saved unchanged, laid out differently', () => {
    const base = versionOf(path.join(FIXTURES, 'valid'))
    const d = copyFixture('valid')
    for (const f of ['a-dividends.json', 'b-programs.json']) {
      const file = path.join(d, f)
      fs.writeFileSync(file, JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')), null, 4) + '\r\n')
    }
    expect(versionOf(d)).toBe(base)
  })

  test('ARC-2 loading the same folder twice gives the same version', () => {
    expect(versionOf(path.join(FIXTURES, 'valid'))).toBe(versionOf(path.join(FIXTURES, 'valid')))
  })
})

describe('ARC-2 the gaps module exports the bank', () => {
  test('ARC-2 src/modules/gaps/index.ts exports loadBank, pick and toHandOff', () => {
    expect(gaps.loadBank).toBe(loadBank)
    expect(gaps.pick).toBe(pick)
    expect(gaps.toHandOff).toBe(toHandOff)
  })
})
