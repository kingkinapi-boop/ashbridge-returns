// F02 builder unit tests for the pure decisions (logic.ts) and the leap rule and padding of dates.ts.
import { describe, expect, test } from 'vitest'
import type { ApprovalFingerprint } from '../../contracts/lifecycle'
import { dueDates } from './dates'
import { HOLD_IDLE_MS, MOVES } from './moves'
import { blankWho, changedInFingerprint, findMove, foldWaiting, hasBlankId, holdExpired } from './logic'

const FP: ApprovalFingerprint = {
  cells: [{ cellId: 'A.1', value: null }],
  facts: [{ id: 'f1', version: 1 }],
  entries: [{ id: 'e1', version: 1 }],
  judgmentInputs: [{ id: 'j1', version: 1 }],
}

describe('F02 logic', () => {
  test('FLOW-2 findMove finds a table move and nothing else', () => {
    expect(findMove('intake', 'evidence')).toBe(MOVES[0])
    expect(findMove('evidence', 'intake')).toBeUndefined()
    expect(findMove('intake', 'gaps')).toBeUndefined()
  })

  test('FLOW-1 blankWho names which of who and why is missing', () => {
    expect(blankWho('Pat', 'done')).toBeNull()
    expect(blankWho(' ', 'done')).toBe('who made this change is missing')
    expect(blankWho('Pat', '')).toBe('why is missing')
  })

  test('FLOW-5 hasBlankId looks at cellId for cells and id for the rest', () => {
    expect(hasBlankId({ kind: 'cell', cellId: ' ' })).toBe(true)
    expect(hasBlankId({ kind: 'cell', cellId: 'A.1' })).toBe(false)
    expect(hasBlankId({ kind: 'fact', id: '' })).toBe(true)
    expect(hasBlankId({ kind: 'entry', id: 'e1' })).toBe(false)
  })

  test('FLOW-5 changedInFingerprint keeps fingerprinted items by kind and id, in order, once each', () => {
    const out = changedInFingerprint(FP, [
      { kind: 'judgmentInput', id: 'j1' },
      { kind: 'fact', id: 'e1' },
      { kind: 'cell', cellId: 'A.1' },
      { kind: 'cell', cellId: 'A.1' },
      { kind: 'entry', id: 'e1' },
      { kind: 'fact', id: 'f1' },
      { kind: 'entry', id: 'f1' },
      { kind: 'judgmentInput', id: 'f1' },
      { kind: 'cell', cellId: 'j1' },
    ])
    expect(out).toEqual([
      { kind: 'judgmentInput', id: 'j1' },
      { kind: 'cell', cellId: 'A.1' },
      { kind: 'entry', id: 'e1' },
      { kind: 'fact', id: 'f1' },
    ])
    expect(changedInFingerprint(FP, [])).toEqual([])
  })

  test('FLOW-3 foldWaiting builds periods, ignores a repeated set or a clear with nothing open', () => {
    const d = (n: number): Date => new Date(2026, 0, n)
    expect(foldWaiting([])).toEqual({ since: null, periods: [] })
    expect(foldWaiting([{ occurred_at: d(1), flag: false }])).toEqual({ since: null, periods: [] })
    expect(foldWaiting([{ occurred_at: d(1), flag: true }, { occurred_at: d(2), flag: false }])).toEqual({ since: null, periods: [{ from: d(1), to: d(2) }] })
    expect(foldWaiting([{ occurred_at: d(1), flag: true }])).toEqual({ since: d(1), periods: [{ from: d(1), to: null }] })
    expect(foldWaiting([{ occurred_at: d(1), flag: true }, { occurred_at: d(2), flag: true }])).toEqual({ since: d(1), periods: [{ from: d(1), to: null }] })
    expect(
      foldWaiting([
        { occurred_at: d(1), flag: true },
        { occurred_at: d(2), flag: false },
        { occurred_at: d(3), flag: false },
        { occurred_at: d(4), flag: true },
      ]),
    ).toEqual({ since: d(4), periods: [{ from: d(1), to: d(2) }, { from: d(4), to: null }] })
  })

  test('FLOW-10 holdExpired: exactly the idle time counts as expired, one millisecond less does not', () => {
    const t = new Date('2026-03-16T09:00:00Z')
    expect(holdExpired(t, new Date(t.getTime() + HOLD_IDLE_MS - 1))).toBe(false)
    expect(holdExpired(t, new Date(t.getTime() + HOLD_IDLE_MS))).toBe(true)
  })
})

describe('F02 dates details', () => {
  test('FLOW-12 century leap rule: 2100 is not a leap year, 2000 is', () => {
    expect(dueDates('2099-08-31', { ccpcConditionsMet: false }).filing).toBe('2100-02-28')
    expect(dueDates('1999-08-31', { ccpcConditionsMet: false }).filing).toBe('2000-02-29')
    expect(() => dueDates('2100-02-29', { ccpcConditionsMet: false })).toThrow()
    expect(dueDates('2000-02-29', { ccpcConditionsMet: false }).filing).toBe('2000-08-31')
  })

  test('FLOW-12 30-day months end on the 30th; day 0 and month 0 are refused; text around the date is refused', () => {
    expect(dueDates('2026-04-30', { ccpcConditionsMet: false }).filing).toBe('2026-10-31')
    expect(() => dueDates('2026-04-31', { ccpcConditionsMet: false })).toThrow(/calendar date/)
    expect(() => dueDates('nope', { ccpcConditionsMet: false })).toThrow(/YYYY-MM-DD/)
    expect(() => dueDates('2026-00-10', { ccpcConditionsMet: false })).toThrow()
    expect(() => dueDates('2026-01-00', { ccpcConditionsMet: false })).toThrow()
    expect(() => dueDates(' 2026-01-10', { ccpcConditionsMet: false })).toThrow()
    expect(() => dueDates('2026-01-10 ', { ccpcConditionsMet: false })).toThrow()
    expect(() => dueDates('12026-01-10', { ccpcConditionsMet: false })).toThrow()
    expect(dueDates('0099-01-10', { ccpcConditionsMet: false })).toEqual({ filing: '0099-07-10', balance: '0099-03-10' })
  })

  test('FLOW-12 every month length is right for year ends on the 29th to 31st', () => {
    const last = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    for (const [i, n] of last.entries()) {
      const m = String(i + 1).padStart(2, '0')
      expect(() => dueDates(`2026-${m}-${String(n)}`, { ccpcConditionsMet: false })).not.toThrow()
      expect(() => dueDates(`2026-${m}-${String(n + 1)}`, { ccpcConditionsMet: false })).toThrow()
    }
  })
})
