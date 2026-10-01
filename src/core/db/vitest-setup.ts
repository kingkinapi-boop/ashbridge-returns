// Setup file of the vitest `db` project (ARC-4): one template per worker, clones closed and the
// clock reset after every test, so isolate:false leaks nothing between files.
import { afterEach, beforeAll } from 'vitest'
import { systemClock, setClock } from '../clock'
import { closeClones, createTemplate, hasActiveTemplate, setActiveTemplate } from './index'

// hookTimeout in vitest.config.ts covers this boot (measured there).
beforeAll(async () => {
  if (hasActiveTemplate()) return
  setActiveTemplate(await createTemplate())
})

afterEach(async () => {
  await closeClones()
  setClock(systemClock)
})
