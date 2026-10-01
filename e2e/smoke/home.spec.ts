import { expect, test } from '@playwright/test'

test('home page says staff only', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toHaveText('Ashbridge Returns. Staff only.')
})
