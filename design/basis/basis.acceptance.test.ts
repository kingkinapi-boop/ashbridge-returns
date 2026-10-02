// D00 acceptance tests (RV-52, RV-54, RV-55). Spec job; the build job must not edit this file.
//
// Contract the build must provide (names chosen by the spec job, reported as amber):
//   design/basis/build.mjs exports  async function build({ outDir: string }):
//       Promise<{ cssPath: string, samplePath: string }>
//     writes the compiled stylesheet (cssPath) and the sample page showing every part (samplePath, full HTML,
//     lang="en", links the stylesheet by relative path) into outDir. Uses only local node_modules, never the network.
//   build.mjs run as a script: `node design/basis/build.mjs --out <dir>` does the same and exits 0.
//   design/basis/settings.scss : colours as #rrggbb hex literals inside $govuk-functional-colours.
//   design/basis/parts.md      : every app- class that may appear, written in backticks, e.g. `app-width-container--wide`.
// Needs: sass, govuk-frontend, @ministryofjustice/frontend, nunjucks, axe-core, playwright (chromium) from the build job.
// Vitest: runs in the shared unit project (design/**/*.test.ts, tools/test-homes.json).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { BAD_PAGE, contrast, listedAppClasses, unlistedClasses } from './d00-helpers'

const root = path.resolve(import.meta.dirname, '../..')
const basis = path.join(root, 'design/basis')
const require = createRequire(import.meta.url)

type Built = { cssPath: string; samplePath: string }
let built: Built
let outDir: string

async function runBuild(dir: string): Promise<Built> {
  const mod = (await import(pathToFileURL(path.join(basis, 'build.mjs')).href)) as {
    build: (o: { outDir: string }) => Promise<Built>
  }
  return mod.build({ outDir: dir })
}

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), 'd00-'))
  built = await runBuild(outDir)
}, 90_000)

describe('RV-55 brand through settings only', () => {
  test('RV-55 the compiled stylesheet names Roboto and carries the brand colours', () => {
    const css = readFileSync(built.cssPath, 'utf8').toLowerCase()
    expect(css).toContain('roboto')
    for (const c of ['#355b7d', '#15283b', '#b3413a', '#f5c94c', '#627283', '#1f6e50']) expect(css).toContain(c)
  })
  test('RV-55 no GDS Transport font, no crown or logotype asset in the stylesheet', () => {
    const css = readFileSync(built.cssPath, 'utf8')
    expect(css).not.toMatch(/gds[\s-]?transport/i)
    expect(css).not.toMatch(/@font-face[^}]*govuk/i)
    expect(css).not.toMatch(/url\([^)]*(crown|logotype|govuk-crest|govuk-logo)[^)]*\)/i)
  })
  test('RV-55 the sample page has the Ashbridge Tax logo and no GOV.UK crown or logotype', () => {
    const html = readFileSync(built.samplePath, 'utf8')
    expect(html).not.toMatch(/govuk-header__logotype|crown|GOV\.UK<\/span>|govuk-logo/i)
    expect(html).toMatch(/ashbridge-tax-logo/)
    expect(existsSync(path.join(basis, 'ashbridge-tax-logo.png'))).toBe(true)
  })
  test('RV-55 planted fault: a stylesheet with GDS Transport is caught by the same rule', () => {
    expect('@font-face{font-family:"GDS Transport"}').toMatch(/gds[\s-]?transport/i)
  })
})

describe('RV-54 contrast of every colour in settings.scss', () => {
  const WHITE = '#ffffff'
  const PALE = '#f3f5f8'
  // colour -> [use, background(s), minimum ratio]. Text 4.5, borders and focus 3.
  const uses: Record<string, [string, string[], number]> = {
    '#355b7d': ['brand and link text', [WHITE, PALE], 4.5],
    '#4d7092': ['link hover text', [WHITE], 4.5],
    '#15283b': ['body text', [WHITE, PALE], 4.5],
    '#627283': ['secondary text', [WHITE, PALE], 4.5],
    '#b3413a': ['error text and border', [WHITE], 4.5],
    '#1f6e50': ['success text', [WHITE], 4.5],
    '#f5c94c': ['focus colour against focus text', ['#15283b'], 3],
  }
  const settings = () => readFileSync(path.join(basis, 'settings.scss'), 'utf8')
  const hexes = (s: string) => [...new Set([...s.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()))]

  test('RV-54 the helper computes the WCAG ratio (black on white is 21, client green fails)', () => {
    expect(contrast('#000000', WHITE)).toBeCloseTo(21, 1)
    expect(contrast('#2f9e76', WHITE)).toBeLessThan(4.5)
    expect(contrast('#8b9dae', WHITE)).toBeLessThan(3)
  })
  test('RV-54 settings.scss exists and every colour in it has a known use that meets AA', () => {
    const found = hexes(settings())
    expect(found.length).toBeGreaterThan(5)
    for (const c of found) {
      const u = uses[c]
      expect(u, `colour ${c} in settings.scss has no listed use`).toBeDefined()
      const [, bgs, min] = u as [string, string[], number]
      for (const bg of bgs) expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(min)
    }
  })
  test('RV-54 the two failing client colours are never used', () => {
    const found = hexes(settings())
    expect(found).not.toContain('#2f9e76')
    expect(found).not.toContain('#8b9dae')
  })
  test('RV-54 planted fault: an unlisted or low-contrast colour would be rejected', () => {
    expect(uses['#8b9dae']).toBeUndefined()
    expect(contrast('#8b9dae', WHITE)).toBeLessThan(3)
  })
})

describe('RV-54 axe on the sample page', () => {
  async function axeViolations(url: string): Promise<string[]> {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.goto(url)
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const res: unknown = await page.evaluate(
        `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })`,
      )
      return (res as { violations: { id: string }[] }).violations.map((v) => v.id)
    } finally {
      await browser.close()
    }
  }
  test('RV-54 axe (WCAG 2.2 AA tags) finds no violation on the sample page', async () => {
    expect(await axeViolations(pathToFileURL(built.samplePath).href)).toEqual([])
  }, 60_000)
  test('RV-54 planted fault: axe flags a page with an image without alt text', async () => {
    const f = path.join(outDir, 'bad.html')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(f, BAD_PAGE)
    expect(await axeViolations(pathToFileURL(f).href)).toContain('image-alt')
  }, 60_000)
})

describe('RV-52 classes on the sample page', () => {
  test('RV-52 every class is govuk-, moj- or a listed app- class', () => {
    const html = readFileSync(built.samplePath, 'utf8')
    const listed = listedAppClasses(readFileSync(path.join(basis, 'parts.md'), 'utf8'))
    expect(unlistedClasses(html, listed)).toEqual([])
  })
  test('RV-52 parts.md lists the three app- exceptions with a reason (review panes, coverage tracker, shortcuts)', () => {
    const md = readFileSync(path.join(basis, 'parts.md'), 'utf8')
    expect(md).toMatch(/three-pane|three pane/i)
    expect(md).toMatch(/coverage tracker/i)
    expect(md).toMatch(/keyboard shortcuts/i)
    expect(md).toMatch(/Official/)
    expect(md).toMatch(/To be reviewed/)
    expect(md).toMatch(/Experimental/)
  })
  test('RV-52 planted fault: an unlisted or foreign class is caught', () => {
    expect(unlistedClasses(BAD_PAGE, new Set())).toEqual(['foo', 'app-unlisted'])
    expect(unlistedClasses(BAD_PAGE, new Set(['app-unlisted']))).toEqual(['foo'])
  })
})

describe('RV-52 build runs offline in under a minute', () => {
  const guard = path.join(root, 'src/core/test-no-network.ts')
  test('RV-52 build.mjs as a script finishes in under 60 s with the network guard on', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'd00-off-'))
    const t0 = Date.now()
    execFileSync(process.execPath, ['--import', guard, path.join(basis, 'build.mjs'), '--out', dir], {
      cwd: root,
      stdio: 'pipe',
      timeout: 60_000,
    })
    expect(Date.now() - t0).toBeLessThan(60_000)
    expect(existsSync(path.join(dir, 'sample.html')) || existsSync(path.join(dir, 'index.html'))).toBe(true)
  }, 70_000)
  test('RV-52 planted fault: the guard really blocks a fetch to a public host', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['--import', guard, '-e', "fetch('https://example.com').then(()=>process.exit(0),()=>process.exit(3))"],
        { cwd: root, stdio: 'pipe', timeout: 20_000 },
      ),
    ).toThrow()
  })
})
