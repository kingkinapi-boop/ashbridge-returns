// Setup file of the vitest `db` project (ARC-4): one template per worker, clones closed and the
// clock reset after every test, so isolate:false leaks nothing between files.
import { afterAll, afterEach, beforeAll } from 'vitest'
import { systemClock, setClock } from '../clock'
import {
  assertCleanClones,
  closeClones,
  createTemplate,
  CLOSE_BOUNDS_MS,
  hasActiveTemplate,
  setActiveTemplate,
  settleAll,
  STEP_BOUND_MS,
} from './index'

// hookTimeout in vitest.config.ts covers this boot (measured there).
beforeAll(async () => {
  if (hasActiveTemplate()) return
  setActiveTemplate(await createTemplate())
})

// A clone left dirty fails the test that left it (R90); the clones close either way, and every failure is named (SC11 S4).
// The step bounds add up to a worst case of 0.8 of the hookTimeout at most (S11).
afterEach(async () => {
  try {
    await settleAll('afterEach', [
      { name: 'assertCleanClones', run: () => assertCleanClones(), boundMs: STEP_BOUND_MS },
      { name: 'closeClones', run: () => closeClones(), boundMs: Object.values(CLOSE_BOUNDS_MS).reduce((a, b) => a + b, 0) },
    ])
  } finally {
    setClock(systemClock)
  }
})

// A connection error that arrived after its pool ended is named here when no later test was left to name it (R116).
afterAll(async () => {
  await settleAll('afterAll', [{ name: 'assertCleanClones', run: () => assertCleanClones(), boundMs: STEP_BOUND_MS }])
})
