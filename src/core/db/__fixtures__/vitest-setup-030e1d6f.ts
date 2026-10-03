// PLANT (SC11 round 3, spec-owned, A508): src/core/db/vitest-setup.ts exactly as SC11's round 2 build left it (git show
// 030e1d6f:src/core/db/vitest-setup.ts), the version whose cleanup sequences stop at their first failure or let a later
// failure replace an earlier one (RC1, R118). Only import paths edited so it can live here (../clock is now ../../clock, ./index is now ../index). Scanned as
// text only (pool-rules.acceptance.test.ts), never imported, never edited.
// Setup file of the vitest `db` project (ARC-4): one template per worker, clones closed and the
// clock reset after every test, so isolate:false leaks nothing between files.
import { afterAll, afterEach, beforeAll } from 'vitest'
import { systemClock, setClock } from '../../clock'
import { assertCleanClones, closeClones, createTemplate, hasActiveTemplate, setActiveTemplate } from '../index'

// hookTimeout in vitest.config.ts covers this boot (measured there).
beforeAll(async () => {
  if (hasActiveTemplate()) return
  setActiveTemplate(await createTemplate())
})

// A clone left dirty fails the test that left it (R90); the clones close either way.
afterEach(async () => {
  try {
    await assertCleanClones()
  } finally {
    try {
      await closeClones()
    } finally {
      setClock(systemClock)
    }
  }
})

// A connection error that arrived after its pool ended is named here when no later test was left to name it (R116).
afterAll(async () => {
  await assertCleanClones()
})
