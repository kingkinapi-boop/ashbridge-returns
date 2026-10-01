import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

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
          include: ['src/**/*.test.ts', 'tools/test/**/*.test.mjs'],
          exclude: ['src/**/*.db.test.ts', 'src/**/*.eval.test.ts', 'node_modules/**'],
          env: { TZ: 'America/Toronto' },
        },
      },
      {
        test: {
          name: 'db',
          include: ['src/**/*.db.test.ts'],
          env: { TZ: 'America/Toronto' },
        },
      },
      {
        test: {
          name: 'evals',
          include: ['evals/**/*.test.ts', 'src/**/*.eval.test.ts'],
          env: { TZ: 'America/Toronto' },
        },
      },
    ],
  },
})
