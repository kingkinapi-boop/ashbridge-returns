import { defineConfig } from '@playwright/test'

const isCI = Boolean(process.env['CI'])
const executablePath = process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: isCI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    timezoneId: 'America/Toronto',
    locale: 'en-CA',
    launchOptions: { executablePath },
  },
  webServer: {
    command: 'node tools/run-next.mjs start -p 3100',
    env: { NEXT_TELEMETRY_DISABLED: '1' },
    url: 'http://localhost:3100',
    reuseExistingServer: false,
  },
})
