import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tools/test/__fixtures__/mutation-canary/canary.test.ts'] },
})
