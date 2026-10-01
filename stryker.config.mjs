/** Changed money, tax, CSV and citation files only: npm run mutate:changed */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['src/core/money.ts', 'src/core/ids.ts'],
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',
  thresholds: { high: 90, low: 80, break: 70 },
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
}
