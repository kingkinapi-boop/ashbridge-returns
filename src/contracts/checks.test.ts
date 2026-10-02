import { expect, test } from 'vitest'
import { reconcile, tie, validateReconcilingItem } from './checks'

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
