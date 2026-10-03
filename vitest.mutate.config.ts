// Stryker runs the unit tests only: no db project (PGlite, isolate:false, globalSetup), no evals.
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

const homes = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'tools', 'test-homes.json'), 'utf8')) as {
  unit: { include: string[]; exclude: string[] }
}

process.env['TZ'] = 'America/Toronto'

export default defineConfig({
  test: {
    name: 'unit',
    include: homes.unit.include.filter((g) => g.startsWith('src/') || g.startsWith('testworld/')),
    exclude: homes.unit.exclude,
    setupFiles: ['src/core/test-no-network.ts', 'src/core/test-assertions.ts'],
    env: { TZ: 'America/Toronto' },
  },
})
