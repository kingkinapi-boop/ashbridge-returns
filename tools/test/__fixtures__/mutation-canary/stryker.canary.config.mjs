// npm run mutate:canary: sign(n) and a test that kills every mutant must score 100; a weak test scores far lower (cloud check, before step 7).
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'tools/test/__fixtures__/mutation-canary/vitest.canary.config.mjs' },
  mutate: ['tools/test/__fixtures__/mutation-canary/canary.ts'],
  thresholds: { high: 100, low: 100, break: 100 },
  reporters: ['clear-text'],
  tempDirName: '.stryker-tmp',
}
