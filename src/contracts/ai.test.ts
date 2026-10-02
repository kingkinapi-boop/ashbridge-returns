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

  const finding = { outcome: 'answer', findingType: 'issue', summary: 'S', citations: [cell] }

  test('AI-1 problems are exact plain sentences', () => {
    expect(validateAiOutput('finding', 'x', stamp)).toEqual({
      ok: false,
      problems: ['The model output must be a JSON object.'],
    })
    expect(validateAiOutput('finding', [], stamp)).toEqual({
      ok: false,
      problems: ['The model output must be a JSON object.'],
    })
    const r = validateAiOutput('finding', { ...finding, citations: [] }, stamp)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems.every((p) => p.startsWith('The field "') && p.endsWith('.'))).toBe(true)
  })

  test('AI-10 a missing or null stamp gives the one plain sentence; a bad field names version.<field>', () => {
    const msg = { ok: false, problems: ['The version stamp ("version") is missing.'] }
    expect(validateAiOutput('finding', finding, undefined)).toEqual(msg)
    expect(validateAiOutput('finding', finding, null)).toEqual(msg)
    const r = validateAiOutput('finding', finding, { ...stamp, modelId: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problems).toHaveLength(1)
      expect(r.problems[0]).toMatch(/^The field "version\.modelId" is missing or not valid: /)
    }
    const s = validateAiOutput('finding', finding, 'stamp')
    expect(s.ok).toBe(false)
  })

  test('AI-1 a bad output field is named by its path and both faults are reported together', () => {
    const r = validateAiOutput('finding', { ...finding, summary: '' }, { ...stamp, inputHash: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problems).toHaveLength(2)
      expect(r.problems[0]).toMatch(/^The field "summary" /)
      expect(r.problems[1]).toMatch(/^The field "version\.inputHash" /)
    }
  })

  test('AI-1 text that is only spaces is refused everywhere text is required', () => {
    expect(validateAiOutput('finding', { ...finding, summary: '   ' }, stamp).ok).toBe(false)
    expect(validateAiOutput('finding', finding, { ...stamp, promptHash: '  ' }).ok).toBe(false)
    expect(validateAiOutput('cause_tag', { outcome: 'answer', tag: ' ', citations: [cell] }, stamp).ok).toBe(false)
    expect(validateAiOutput('extraction', { outcome: 'answer', fields: [{ name: ' ', value: '' }], citations: [cell] }, stamp).ok).toBe(false)
    expect(validateAiOutput('extraction', { outcome: 'answer', fields: [{ name: 'a', value: '', x: 1 }], citations: [cell] }, stamp).ok).toBe(false)
    expect(validateAiOutput('extraction', { outcome: 'answer', fields: [{ name: 'a', value: '' }], citations: [cell] }, stamp).ok).toBe(true)
  })

  test('AI-6 an "I can\'t tell" with no reason is refused', () => {
    expect(validateAiOutput('finding', { outcome: 'cannot_tell', reason: ' ', citations: [] }, stamp).ok).toBe(false)
  })
})
