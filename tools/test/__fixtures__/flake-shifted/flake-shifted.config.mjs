// CQ10 fixture config: a tiny two-project world for tools/test/flake-shifted.test.mjs, passed to the script
// with --config. Project "unit" holds the planted files; project "other" holds a plant that must never run,
// because the script runs the unit project only. Not a repo config (the R3 rule skips __fixtures__).
// No package imports: this file must load the same way from any cwd.
import os from 'node:os'
import path from 'node:path'

process.env['TZ'] = 'America/Toronto'

export default {
  root: import.meta.dirname,
  cacheDir: path.join(os.tmpdir(), `vitest-cq10-fixture-${String(process.pid)}`),
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: import.meta.dirname,
          include: ['unit/*.check.mjs'],
          env: { TZ: 'America/Toronto' },
          // The nested file starts the script itself (a cold child process): its own budget.
          testTimeout: 240_000,
        },
      },
      {
        test: {
          name: 'other',
          root: import.meta.dirname,
          include: ['other/*.check.mjs'],
          env: { TZ: 'America/Toronto' },
        },
      },
    ],
  },
}
