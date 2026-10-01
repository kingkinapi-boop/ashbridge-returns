// Stryker runs the unit tests only: no db project (PGlite, isolate:false, globalSetup), no evals.
import { defineConfig } from 'vitest/config'

process.env['TZ'] = 'America/Toronto'

export default defineConfig({
  test: {
    name: 'unit',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts', 'src/**/*.eval.test.ts', 'node_modules/**'],
    setupFiles: ['src/core/test-no-network.ts'],
    env: { TZ: 'America/Toronto' },
  },
})
