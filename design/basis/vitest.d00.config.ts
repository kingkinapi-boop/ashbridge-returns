import { defineConfig } from 'vitest/config'
// Temporary: the unit project include does not cover design/**; F00 owns vitest.config.ts.
export default defineConfig({ test: { include: ['design/**/*.acceptance.test.ts'] } })
