// CQ10 planted file that cannot load on a shifted date: under a shift it has no test results at all,
// only a failed file, and the script must still name it.
import { expect, test } from 'vitest'

const DAY = 86_400_000
const FIXED = Date.parse(process.env['CQ10_FIXED'] ?? '')
if (!Number.isFinite(FIXED) || Date.now() - FIXED > DAY) throw new Error('cq10 planted: this file loads only on the real date')

test('cq10 load file runs on the real date', () => {
  expect(Date.now() - FIXED).toBeLessThan(DAY)
})
