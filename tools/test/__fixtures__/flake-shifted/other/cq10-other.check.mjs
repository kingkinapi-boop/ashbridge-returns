// CQ10 plant in a second project: date-dependent, but the script runs the unit project only, so it is never named.
import { expect, test } from 'vitest'

const DAY = 86_400_000
const FIXED = Date.parse(process.env['CQ10_FIXED'] ?? '')

test('cq10 other project plant (never run)', () => {
  expect(Date.now() - FIXED).toBeLessThan(DAY)
})
