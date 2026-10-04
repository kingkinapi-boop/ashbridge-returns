// D00 RV-54 axe tests, moved out of the unit project (A351): browsers run only where `npm run e2e` runs.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import { BAD_PAGE } from '../design/basis/d00-helpers'

const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

async function build(dir: string): Promise<{ samplePath: string }> {
  const mod = (await import(pathToFileURL(path.join(root, 'design/basis/build.mjs')).href)) as {
    build: (o: { outDir: string }) => Promise<{ samplePath: string }>
  }
  return mod.build({ outDir: dir })
}

test.describe('RV-54 axe on the sample page', () => {
  test.setTimeout(90_000)
  const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

  async function violations(page: import('@playwright/test').Page, url: string): Promise<string[]> {
    await page.goto(url)
    await page.addScriptTag({ content: axe })
    const res: unknown = await page.evaluate(
      `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })`,
    )
    return (res as { violations: { id: string }[] }).violations.map((v) => v.id)
  }

  test('RV-54 axe (WCAG 2.2 AA tags) finds no violation on the sample page', async ({ page }) => {
    const out = mkdtempSync(path.join(tmpdir(), 'd00-axe-'))
    const built = await build(out)
    expect(await violations(page, pathToFileURL(built.samplePath).href)).toEqual([])
  })

  test('RV-54 planted fault: axe flags a page with an image without alt text', async ({ page }) => {
    const f = path.join(mkdtempSync(path.join(tmpdir(), 'd00-axe-')), 'bad.html')
    writeFileSync(f, BAD_PAGE)
    expect(await violations(page, pathToFileURL(f).href)).toContain('image-alt')
  })
})
