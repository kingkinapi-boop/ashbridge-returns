import { expect, test } from 'vitest'
import { reconcile, tie, validateCheckRecord, validateReconcilingItem } from './checks'

test('CK-3 one cent under a dollar ties, a dollar does not', () => {
  expect(tie(0, 99).status).toBe('pass')
  expect(tie(0, 100).status).toBe('fail')
})

test('CK-4 a rounding item R21 is on the fixed list', () => {
  expect(validateReconcilingItem({ code: 'R21', amount: 1, source: 'x' })).toEqual({ ok: true })
})

test('CK-4 negative difference with matching items raises nothing', () => {
  const r = reconcile({ left: 0, right: 500, items: [{ code: 'R01', amount: -500, source: 's' }] })
  expect(r.raisesException).toBe(false)
})

const goodRecord = {
  id: 'CK-20',
  kind: 'tie',
  appliesTo: () => true,
  inputs: [],
  rule: 'r',
  sourceLink: 's',
  raises: 'x',
}

test('CK-1 a refusal names the field and says why, and several are joined with a semicolon', () => {
  expect(validateCheckRecord({ ...goodRecord, rule: ' ' })).toEqual({ ok: false, reason: 'rule: must not be blank' })
  expect(validateCheckRecord({ ...goodRecord, appliesTo: 3 })).toEqual({ ok: false, reason: 'appliesTo: must be a function' })
  const two = validateCheckRecord({ ...goodRecord, rule: '', raises: '' })
  expect(two).toEqual({ ok: false, reason: 'rule: must not be blank; raises: must not be blank' })
})

test('CK-1 a refusal with no field path carries no leading colon', () => {
  const r = validateCheckRecord(5)
  expect(r.ok).toBe(false)
  if (!r.ok) {
    expect(r.reason.length).toBeGreaterThan(0)
    expect(r.reason.startsWith(':')).toBe(false)
  }
})

test('CK-4 an item type off the fixed list is refused with its reason', () => {
  expect(validateReconcilingItem({ code: 'R99', amount: 1, source: 'x' })).toEqual({
    ok: false,
    reason: 'code: type is not on the fixed list',
  })
})

test('ARC-13 a tie refuses a right-hand side that is not whole cents', () => {
  expect(() => tie(0, 1.5)).toThrow()
  expect(() => tie(1.5, 0)).toThrow()
})

test('CK-1 a refusal inside a list names the position with a dot', () => {
  const r = validateCheckRecord({ ...goodRecord, inputs: ['a', 1] })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.reason.startsWith('inputs.1: ')).toBe(true)
})
