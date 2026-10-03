// CQ12 (ARC-15): no test passes without asserting. Listed in every vitest project's setupFiles.
import { beforeEach, expect } from 'vitest'

beforeEach(() => {
  expect.hasAssertions()
})
