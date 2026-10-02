import { describe, expect, test } from 'vitest'
import { validateAiOutput } from './ai'

const stamp = {
  modelId: 'm',
  promptVersion: 'v1',
  promptHash: 'h',
  inputHash: 'i',
  ocrEngine: 'e',
  ocrEngineVersion: '1',
  mappingRelease: 'r',
}
const cell = { source: 'return_cell', figureKey: 'gifi.9270' }

describe('F04 unit', () => {
  test('AI-1 every non-finding step type accepts a cited answer and rejects an uncited one', () => {
    const answers = {
      extraction: { fields: [{ name: 'box 1', value: '12' }] },
      category_proposal: { category: 'Meals' },
      gifi_mapping_proposal: { gifiCode: '8523' },
      question_slot_fill: { slot: 'a', value: 'b' },
      cause_tag: { tag: 'missing_slip' },
      red_team_item: { concern: 'Check it.' },
    } as const
    for (const [t, body] of Object.entries(answers)) {
      const step = t as keyof typeof answers
      expect(validateAiOutput(step, { outcome: 'answer', ...body, citations: [cell] }, stamp).ok).toBe(true)
      expect(validateAiOutput(step, { outcome: 'answer', ...body, citations: [] }, stamp).ok).toBe(false)
    }
  })

  test('AI-6 "I can\'t tell" must not carry citations', () => {
    const raw = { outcome: 'cannot_tell', reason: 'Faint.', citations: [cell] }
    expect(validateAiOutput('cause_tag', raw, stamp).ok).toBe(false)
  })

  test('AI-10 a missing stamp and a bad output are both reported together', () => {
    const r = validateAiOutput('finding', 'text', undefined)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems).toHaveLength(2)
  })
})
