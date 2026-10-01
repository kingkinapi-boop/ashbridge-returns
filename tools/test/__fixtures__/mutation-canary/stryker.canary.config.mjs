// npm run mutate:canary: one tiny function whose test kills every mutant; scores 77.78 (2 equivalent mutants in the spec's canary.ts, amber); a weak test scores far lower (cloud check, before step 7).
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'tools/test/__fixtures__/mutation-canary/vitest.canary.config.mjs' },
  mutate: ['tools/test/__fixtures__/mutation-canary/canary.ts'],
  thresholds: { high: 100, low: 100, break: 75 },
  reporters: ['clear-text'],
  tempDirName: '.stryker-tmp',
}
