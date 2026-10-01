import { expect, test } from 'vitest'
import { FactRecordSchema, ReturnStateSchema, VersionStampSchema } from './records'

test('ARC-10 a version stamp must be a non-empty object', () => {
  expect(VersionStampSchema.safeParse({}).success).toBe(false)
  expect(VersionStampSchema.safeParse({ reader: 'qbo-reader (Test)' }).success).toBe(true)
})

test('FLOW-1 a state outside blueprint 02 is not a ReturnState', () => {
  expect(ReturnStateSchema.safeParse('waiting_on_client').success).toBe(false)
  expect(ReturnStateSchema.safeParse('closed').success).toBe(true)
})

test('EV-10 a fact record refuses an origin outside the five', () => {
  expect(FactRecordSchema.shape.origin.safeParse('ai').success).toBe(false)
})
