import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadFactCatalogue } from '../../../contracts/facts'
import { loadBank } from './index'

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..')
const loaded = loadFactCatalogue(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'facts', 'catalogue.json'), 'utf8')))
if (!loaded.ok) throw new Error('the fact catalogue does not load')

describe('ARC-2 AI-12 revenue bank', () => {
  test('ARC-2 the whole bank folder loads with no problem', () => {
    const r = loadBank(path.join(ROOT, 'data', 'question-bank'), loaded.catalogue)
    expect(r.ok).toBe(true)
  })

  test('AI-12 each revenue item resolves a distinct fact', () => {
    const r = loadBank(path.join(ROOT, 'data', 'question-bank'), loaded.catalogue)
    if (!r.ok) throw new Error('bank refused')
    const keys = r.bank.items.filter((i) => i.topic === 'revenue').map((i) => i.resolves)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
