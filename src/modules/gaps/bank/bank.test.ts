import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { loadFactCatalogue } from '../../../contracts/facts'
import { itemSchema, loadBank, pick, toHandOff } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error('the fact catalogue does not load')
const catalogue = loaded.catalogue
const valid = path.join(import.meta.dirname, '__fixtures__', 'valid')

describe('G01 unit', () => {
  test('ARC-2 the committed _schema.json is the item schema, so the two cannot drift', () => {
    const committed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'question-bank', '_schema.json'), 'utf8')) as unknown
    expect(committed).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(itemSchema))))
  })

  test('ARC-2 an item with a key the format does not name is refused', () => {
    const r = itemSchema.safeParse({
      id: 'Q-DIV-001', type: 'ASK', resolves: 'a.b.c', slots: [], answer: { shape: 'money' },
      label: 'L', topic: 't', retired: false, text: 'What is it',
    })
    expect(r.success).toBe(false)
  })

  test('ARC-2 a choice slot needs options and no other slot may carry them', () => {
    const base = { id: 'Q-DIV-001', type: 'ASK', resolves: 'a.b.c', answer: { shape: 'money' }, label: 'L', topic: 't', retired: false }
    expect(itemSchema.safeParse({ ...base, slots: [{ name: 'n', type: 'date', required: true, options: ['x'] }] }).success).toBe(false)
    expect(itemSchema.safeParse({ ...base, slots: [{ name: 'n', type: 'choice', required: true, options: ['x'] }] }).success).toBe(true)
    expect(itemSchema.safeParse({ ...base, answer: { shape: 'money', options: ['x'] }, slots: [] }).success).toBe(false)
  })

  test('AI-12 pick leaves the bank unchanged and sorts a copy', () => {
    const r = loadBank(valid, catalogue)
    if (!r.ok) throw new Error('valid bank refused')
    const before = r.bank.items.map((i) => i.id)
    pick(r.bank, 'onboarding.dividend.amount')
    expect(r.bank.items.map((i) => i.id)).toEqual(before)
  })

  test('ARC-2 the hand-off keeps an empty slot list for a question with no slots given', () => {
    const r = loadBank(valid, catalogue)
    if (!r.ok) throw new Error('valid bank refused')
    expect(toHandOff(r.bank, { returnId: 'R', questions: [{ id: 'Q-DIV-001', slots: {} }] }).questions).toEqual([{ id: 'Q-DIV-001', slots: [] }])
  })
})
