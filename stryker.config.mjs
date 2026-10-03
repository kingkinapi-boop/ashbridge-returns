/** Mutation targets are chosen only by the `// @mutate` marker: npm run mutate:changed (tools/mutate-changed.mjs). */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.mutate.config.ts', related: true },
  incremental: true,
  dryRunTimeoutMinutes: 45, // W00c: 2845 mutants over 6858 tests need more than the 5 minute default (CQ9)
  incrementalFile: 'reports/mutation/stryker-incremental.json',
  thresholds: { high: 90, low: 80, break: 70 },
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
}
