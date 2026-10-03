// JH0 acceptance, checks 6 and 7 in the browser (ARC-21, ARC-4). Cloud only (Playwright, production build). Spec-writer; builders never edit this file.
// The fixtures module is reached by a computed path so typecheck stays green before the build exists.
import { expect, test } from '@playwright/test'

type Fixtures = {
  PINNED: { timezone: string; locale: string; now: string }
  checkAxe(page: unknown): Promise<{ violations: unknown[] }>
}
const load = async (): Promise<Fixtures> => {
  const name = './fixtures.ts'
  return (await import(/* @vite-ignore */ name)) as Fixtures
}

test('ARC-21 the smoke page loads from the production server and the shared axe check finds no violation', async ({ page }) => {
  const f = await load()
  await page.goto('/')
  await expect(page.getByRole('main')).toHaveText('Ashbridge Returns. Staff only.')
  const res = await f.checkAxe(page)
  expect(res.violations).toEqual([])
})

test('ARC-21 the app under test runs in production mode', async ({ request }) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  expect(await res.text()).not.toContain('__next_dev')
})

test('ARC-16 the browser clock and locale are the pinned ones', async ({ page }) => {
  const f = await load()
  await page.goto('/')
  const got = await page.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, loc: Intl.DateTimeFormat().resolvedOptions().locale }))
  expect(got.tz).toBe(f.PINNED.timezone)
  expect(got.loc).toBe(f.PINNED.locale)
})
