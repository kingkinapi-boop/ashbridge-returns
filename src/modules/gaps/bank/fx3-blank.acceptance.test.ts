// FX3 acceptance tests, the question bank's blank rules (spec-writer; builders never edit this file).
// Card plan/cards/FX3.md defect 3: src/modules/gaps/bank/index.ts kept its own blank rules (.trim() and
// z.string().min(1)), so text made only of invisible characters passed as a label, a topic or a slot
// name, and a sentence hidden behind a trailing invisible character passed the no-sentence lint (EV-1:
// one blank definition, src/contracts/text.ts). SC R41 is the source scan; these are its behaviour tests.
//
// The shape these tests fix: loadBank(dir, catalogue) refuses the item, with a problem whose reason
// starts with the field's path (as zod issues read today: "label: ...", "slots.0.name: ...").
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { loadFactCatalogue, type FactCatalogue } from '../../../contracts/facts'
import { isBlank } from '../../../contracts/text'
import { loadBank, type LoadBankResult } from './index'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..')
const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error(`the fact catalogue does not load: ${loaded.reasons.join('; ')}`)
const catalogue: FactCatalogue = loaded.catalogue

const tmpRoots: string[] = []
afterAll(() => {
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true })
})

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

function load(item: Record<string, unknown>): LoadBankResult {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fx3-bank-'))
  tmpRoots.push(d)
  fs.writeFileSync(path.join(d, 'dividends.json'), JSON.stringify({ items: [item] }))
  return loadBank(d, catalogue)
}
const reasons = (r: LoadBankResult): string[] => (r.ok ? [] : r.problems.map((p) => p.reason))

// Blank by text.ts, but not by String.prototype.trim (Cf, Default_Ignorable and the braille blank).
const INVISIBLE = ['⠀', '​', '⁠', '​⠀', '\u{e0020}']

test('EV-1 the invisible samples are blank by text.ts and survive .trim() (the gap this card closes)', () => {
  expect(INVISIBLE.length).toBeGreaterThan(0)
  for (const s of INVISIBLE) {
    expect(isBlank(s), JSON.stringify(s)).toBe(true)
    expect(s.trim(), JSON.stringify(s)).not.toBe('')
  }
})

test('EV-1 control: the base item loads', () => {
  const r = load(BASE_ITEM)
  expect(r.ok, reasons(r).join('; ')).toBe(true)
})

describe('FX3 defect 3: a blank field is refused through text.ts (EV-1; SC R41)', () => {
  test.each(INVISIBLE.map((s) => [JSON.stringify(s), s]))('EV-1 R41 a label of only invisible characters %s is refused', (_, s) => {
    const r = load({ ...BASE_ITEM, label: s })
    expect(r.ok).toBe(false)
    expect(reasons(r).some((x) => x.startsWith('label')), reasons(r).join('; ')).toBe(true)
  })

  test.each(INVISIBLE.map((s) => [JSON.stringify(s), s]))('EV-1 R41 a topic of only invisible characters %s is refused', (_, s) => {
    const r = load({ ...BASE_ITEM, topic: s })
    expect(r.ok).toBe(false)
    expect(reasons(r).some((x) => x.startsWith('topic')), reasons(r).join('; ')).toBe(true)
  })

  test.each(INVISIBLE.map((s) => [JSON.stringify(s), s]))('EV-1 R41 a slot name of only invisible characters %s is refused', (_, s) => {
    const r = load({ ...BASE_ITEM, slots: [{ name: s, type: 'money_cents', required: true }] })
    expect(r.ok).toBe(false)
    expect(reasons(r).some((x) => x.startsWith('slots.0.name')), reasons(r).join('; ')).toBe(true)
  })

  test('EV-1 R41 control: a fact key of only invisible characters is refused (resolves; no fact has that key either)', () => {
    const r = load({ ...BASE_ITEM, resolves: '⠀' })
    expect(r.ok).toBe(false)
  })

  test('EV-1 R41 control: a label with visible text between invisible characters loads, kept exactly as given', () => {
    const label = '​Dividend amount​'
    const r = load({ ...BASE_ITEM, label })
    expect(r.ok, reasons(r).join('; ')).toBe(true)
    expect(r.ok ? r.bank.items[0]?.label : undefined).toBe(label)
  })
})

describe('FX3 defect 3: the no-sentence lint reads past trailing blanks by the one definition (RULE-19, EV-1; SC R41)', () => {
  test.each(INVISIBLE.map((s) => [JSON.stringify(s), s]))('RULE-19 EV-1 a label ending in a full stop then %s still reads as a sentence and is refused', (_, s) => {
    const r = load({ ...BASE_ITEM, label: `Dividend amount.${s}` })
    expect(r.ok).toBe(false)
    expect(reasons(r).some((x) => x.includes('ends like a sentence')), reasons(r).join('; ')).toBe(true)
  })

  test('RULE-19 EV-1 a topic ending in a question mark then a zero-width space is refused as a sentence', () => {
    const r = load({ ...BASE_ITEM, topic: 'dividends?​' })
    expect(r.ok).toBe(false)
    expect(reasons(r).some((x) => x.includes('ends like a sentence')), reasons(r).join('; ')).toBe(true)
  })

  test('RULE-19 control: a full stop then ordinary trailing spaces is refused, as before', () => {
    const r = load({ ...BASE_ITEM, label: 'Dividend amount.  ' })
    expect(r.ok).toBe(false)
    expect(reasons(r).some((x) => x.includes('ends like a sentence')), reasons(r).join('; ')).toBe(true)
  })

  test('RULE-19 control: a full stop inside the label, not at its end, is no sentence', () => {
    const r = load({ ...BASE_ITEM, label: 'Div. amount​' })
    expect(reasons(r).filter((x) => x.includes('ends like a sentence'))).toEqual([])
  })
})
