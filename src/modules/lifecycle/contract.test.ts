// F02 builder unit tests: the lifecycle contract schemas.
import { describe, expect, test } from 'vitest'
import { ApprovalFingerprintSchema, ChangedItemSchema } from '../../contracts/lifecycle'

describe('F02 contracts', () => {
  test('FLOW-4 the fingerprint takes null and empty cell values, whole versions from 1, and refuses extra shapes', () => {
    const ok = { cells: [{ cellId: 'A.1', value: null }, { cellId: 'A.2', value: '' }], facts: [{ id: 'f', version: 1 }], entries: [], judgmentInputs: [] }
    expect(ApprovalFingerprintSchema.safeParse(ok).success).toBe(true)
    expect(ApprovalFingerprintSchema.safeParse({ ...ok, cells: [{ cellId: 'A.1' }] }).success).toBe(false)
    expect(ApprovalFingerprintSchema.safeParse({ ...ok, cells: [{ cellId: 'A.1', value: 5 }] }).success).toBe(false)
    expect(ApprovalFingerprintSchema.safeParse({ ...ok, facts: [{ id: 'f', version: 2147483647 }] }).success).toBe(true)
    expect(ApprovalFingerprintSchema.safeParse({ ...ok, facts: [{ id: 'f', version: 2147483648 }] }).success).toBe(false)
    expect(ApprovalFingerprintSchema.safeParse({ ...ok, entries: [{ id: 'e', version: 0 }] }).success).toBe(false)
  })

  test('FLOW-5 a changed item has a kind and its id', () => {
    expect(ChangedItemSchema.parse({ kind: 'cell', cellId: 'A.1' })).toEqual({ kind: 'cell', cellId: 'A.1' })
    for (const kind of ['fact', 'entry', 'judgmentInput'] as const) {
      expect(ChangedItemSchema.parse({ kind, id: 'x' })).toEqual({ kind, id: 'x' })
      expect(ChangedItemSchema.safeParse({ kind, cellId: 'x' }).success).toBe(false)
      expect(ChangedItemSchema.safeParse({ kind }).success).toBe(false)
    }
    expect(ChangedItemSchema.safeParse({ kind: 'cell', id: 'x' }).success).toBe(false)
    expect(ChangedItemSchema.safeParse({ kind: 'other', id: 'x' }).success).toBe(false)
  })
})
