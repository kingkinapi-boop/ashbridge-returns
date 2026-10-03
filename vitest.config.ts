import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

const homes = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'tools', 'test-homes.json'), 'utf8')) as {
  unit: { include: string[]; exclude: string[] }
  db: { include: string[] }
  evals: { include: string[] }
}

process.env['TZ'] = 'America/Toronto'
const isCloud = Boolean(process.env['CI']) || os.cpus().length > 4
const maxWorkers = isCloud ? '50%' : 2

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), `vitest-ashbridge-${String(process.pid)}`),
  test: {
    reporters: ['agent'],
    maxWorkers,
    projects: [
      {
        test: {
          name: 'unit',
          include: homes.unit.include,
          exclude: homes.unit.exclude,
          setupFiles: ['src/core/test-no-network.ts'],
          env: { TZ: 'America/Toronto' },
        },
      },
      {
        test: {
          name: 'db',
          include: homes.db.include,
          env: { TZ: 'America/Toronto' },
          globalSetup: ['src/core/db/global-setup.ts'],
          setupFiles: ['src/core/test-no-network.ts', 'src/core/db/vitest-setup.ts'],
          // isolate:false: the template lives once per worker, not once per file.
          isolate: false,
          // Roles are cluster-wide on Postgres 16 (DB16), so files take turns there; PGlite keeps them parallel.
          fileParallelism: process.env['TEST_DB'] !== 'pg16',
          // hookTimeout: measured on the cloud machine, 10 cold runs (1 Oct): boot p95 2.8 s, so 3x = 8.4 s; floor 30 s.
          // Laptop (3 runs through tools/heavy.mjs) not yet measured: the Lead adds it.
          hookTimeout: 30_000,
          // testTimeout: measured on the cloud machine, 10 cold runs: slowest test body 1.7 s, so 3x = 5.1 s, set to 6 s.
          testTimeout: 6_000,
        },
      },
      {
        test: {
          name: 'evals',
          include: homes.evals.include,
          setupFiles: ['src/core/test-no-network.ts'],
          env: { TZ: 'America/Toronto' },
        },
      },
    ],
  },
})
