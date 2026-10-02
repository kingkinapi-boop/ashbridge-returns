import { describe, expect, test } from 'vitest'
import { citationSchema, validateAiOutput, versionStampSchema } from './ai'

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
    expect(validateAiOutput('finding', null, stamp)).toEqual({
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

  const box = { page: 1, left: 0.1, top: 0.1, width: 0.2, height: 0.1 }
  const ledger = { source: 'ledger', recordKind: 'txn', recordId: 'r1' }
  const docCite = { source: 'document', documentId: 'd1', box, quote: 'q' }
  const pageCite = { source: 'page', documentId: 'd1', page: 2 }
  const missing = (citations: unknown[]) => ({ outcome: 'answer', findingType: 'missing', summary: 'S', citations })

  test('AI-1 each citation kind is accepted whole, and a stray key or blank text fails it', () => {
    for (const c of [ledger, docCite, cell, pageCite]) {
      expect(citationSchema.safeParse(c).success).toBe(true)
      expect(citationSchema.safeParse({ ...c, extra: 1 }).success).toBe(false)
    }
    expect(citationSchema.safeParse({ ...ledger, recordKind: ' ' }).success).toBe(false)
    expect(citationSchema.safeParse({ ...ledger, recordId: ' ' }).success).toBe(false)
    expect(citationSchema.safeParse({ ...docCite, documentId: ' ' }).success).toBe(false)
    expect(citationSchema.safeParse({ ...docCite, quote: ' ' }).success).toBe(false)
    expect(citationSchema.safeParse({ ...docCite, box: { ...box, extra: 1 } }).success).toBe(false)
    expect(citationSchema.safeParse({ ...cell, figureKey: ' ' }).success).toBe(false)
    expect(citationSchema.safeParse({ ...pageCite, documentId: ' ' }).success).toBe(false)
    expect(citationSchema.safeParse({ source: 'other' }).success).toBe(false)
  })

  test('AI-4 a page citation carries a whole page number from 1 and no quote or box', () => {
    for (const page of [0, -1, 1.5, '2']) expect(citationSchema.safeParse({ ...pageCite, page }).success).toBe(false)
    expect(citationSchema.safeParse({ ...pageCite, page: 1 }).success).toBe(true)
    expect(citationSchema.safeParse({ ...pageCite, quote: 'q' }).success).toBe(false)
    expect(citationSchema.safeParse({ ...pageCite, box }).success).toBe(false)
  })

  test('AI-5 a "missing" finding may cite a page, a document box or a return cell, never a ledger record', () => {
    for (const c of [pageCite, docCite, cell]) expect(validateAiOutput('finding', missing([c]), stamp).ok).toBe(true)
    expect(validateAiOutput('finding', missing([pageCite, docCite, cell]), stamp).ok).toBe(true)
    const msg =
      'A "missing" finding must cite where the item should be (a document box, a page or a return cell), not a ledger record.'
    expect(validateAiOutput('finding', missing([ledger]), stamp)).toEqual({
      ok: false,
      problems: [`The field "citations.0" is missing or not valid: ${msg}.`],
    })
    const mixed = validateAiOutput('finding', missing([cell, ledger]), stamp)
    expect(mixed).toEqual({ ok: false, problems: [`The field "citations.1" is missing or not valid: ${msg}.`] })
  })

  test('AI-5 only a "missing" finding may cite a page; no other step may', () => {
    const msg = 'Only a "missing" finding may cite a page; cite a document box, a ledger record or a return cell.'
    expect(validateAiOutput('finding', { ...finding, citations: [pageCite] }, stamp)).toEqual({
      ok: false,
      problems: [`The field "citations.0" is missing or not valid: ${msg}.`],
    })
    expect(validateAiOutput('finding', { ...finding, citations: [ledger, docCite, cell] }, stamp).ok).toBe(true)
    expect(validateAiOutput('finding', { ...finding, citations: [cell, pageCite] }, stamp)).toEqual({
      ok: false,
      problems: [`The field "citations.1" is missing or not valid: ${msg}.`],
    })
    expect(validateAiOutput('cause_tag', { outcome: 'answer', tag: 't', citations: [pageCite] }, stamp).ok).toBe(false)
  })

  test('AI-1 a stray key fails at every depth of a finding, "I can\'t tell", a step and the stamp', () => {
    expect(validateAiOutput('finding', { ...finding, extra: 1 }, stamp).ok).toBe(false)
    expect(validateAiOutput('finding', { outcome: 'cannot_tell', reason: 'r', citations: [], extra: 1 }, stamp).ok).toBe(false)
    expect(validateAiOutput('finding', { outcome: 'cannot_tell', reason: 'r', citations: [] }, stamp).ok).toBe(true)
    expect(validateAiOutput('finding', { ...finding, citations: [{ ...cell, extra: 1 }] }, stamp).ok).toBe(false)
    expect(validateAiOutput('finding', finding, { ...stamp, extra: 1 }).ok).toBe(false)
    expect(versionStampSchema.safeParse(stamp).success).toBe(true)
    expect(validateAiOutput('cause_tag', { outcome: 'answer', tag: 't', citations: [cell], extra: 1 }, stamp).ok).toBe(false)
  })

  test('AI-1 a problem at the top of the output is named "The output"', () => {
    expect(validateAiOutput('finding', { ...finding, extra: 1 }, stamp)).toEqual({
      ok: false,
      problems: ['The output is missing or not valid: Unrecognized key: "extra".'],
    })
  })

  test('AI-6 "I can\'t tell" goes to a person and an answer does not', () => {
    const t = validateAiOutput('finding', { outcome: 'cannot_tell', reason: 'r', citations: [] }, stamp)
    expect(t.ok && t.toPerson).toBe(true)
    const a = validateAiOutput('finding', finding, stamp)
    expect(a.ok && a.toPerson).toBe(false)
    expect(a.ok && a.data.version).toEqual(stamp)
  })
})
