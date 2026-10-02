// D00: compile the Ashbridge-branded GOV.UK + MOJ stylesheet and render the sample page. Offline: local node_modules only.
// MOJ Frontend forwards GOV.UK base with fixed settings, which clashes with the brand settings (card D00 lead note).
// The one file is patched in a scratch copy of the MOJ package; node_modules is never edited.
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import nunjucks from 'nunjucks'
import * as sass from 'sass'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const require = createRequire(import.meta.url)

function pkgDir(name) {
  return path.dirname(require.resolve(`${name}/package.json`))
}

/** Scratch copy of the MOJ package with the fixed GOV.UK settings removed from its vendored base. */
function patchedMoj(scratch) {
  const src = pkgDir('@ministryofjustice/frontend')
  const dest = path.join(scratch, 'moj-pkg')
  cpSync(path.join(src, 'moj'), path.join(dest, 'moj'), { recursive: true })
  copyFileSync(path.join(src, 'package.json'), path.join(dest, 'package.json'))
  // Both vendored files configure GOV.UK base with MOJ's own settings; drop that so the brand settings win.
  const strip = (name, re) => {
    const file = path.join(dest, 'moj/vendor/govuk-frontend', name)
    const text = readFileSync(file, 'utf8')
    const patched = text.replace(re, '')
    if (patched === text) throw new Error(`MOJ vendored ${name} no longer has fixed settings to patch; revisit build.mjs`)
    writeFileSync(file, patched)
  }
  strip('_base.scss', /\s+with\s*\(\s*\$govuk-suppressed-warnings:\s*\(\s*\)\s*\)/)
  strip('_index.scss', /\s+with\s*\([^)]*\)(?=\s*;)/)
  return dest
}

function compileCss(scratch) {
  const moj = patchedMoj(scratch)
  const entry = path.join(scratch, 'entry.scss')
  const base = readFileSync(path.join(here, 'entry.scss'), 'utf8')
  writeFileSync(
    entry,
    base
      .replace('@use "settings";', `@use ${JSON.stringify(pathToFileURL(path.join(here, 'settings')).href)};`)
      .replace('"pkg:@ministryofjustice/frontend/moj/all"', JSON.stringify(pathToFileURL(path.join(moj, 'moj/all')).href)),
  )
  const res = sass.compile(entry, {
    importers: [new sass.NodePackageImporter(root)],
    loadPaths: [root],
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  })
  // RV-55: no GOV.UK crest, crown or logotype asset in the brand stylesheet (the footer crest is the only one shipped).
  return res.css.replace(/[ \t]*[\w-]+:\s*url\([^)]*(?:crest|crown|logotype|govuk-logo)[^)]*\)[^;]*;\n?/gi, '')
}

function render() {
  const env = nunjucks.configure(
    [
      path.join(pkgDir('govuk-frontend'), 'dist'),
      path.join(pkgDir('@ministryofjustice/frontend')),
      path.join(here, 'templates'),
    ],
    { autoescape: true },
  )
  const filters = require('@ministryofjustice/frontend/moj/filters/all')()
  for (const [name, fn] of Object.entries(filters)) env.addFilter(name, fn)
  return env.render('sample.njk', {})
}

export async function build({ outDir }) {
  mkdirSync(outDir, { recursive: true })
  const scratch = mkdtempSync(path.join(tmpdir(), 'd00-scratch-'))
  try {
    const cssPath = path.join(outDir, 'basis.css')
    writeFileSync(cssPath, compileCss(scratch))
    copyFileSync(path.join(here, 'ashbridge-tax-logo.png'), path.join(outDir, 'ashbridge-tax-logo.png'))
    const samplePath = path.join(outDir, 'sample.html')
    writeFileSync(samplePath, render())
    return { cssPath, samplePath }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out')
  const outDir = i > 0 ? process.argv[i + 1] : path.join(root, 'design/basis/out')
  await build({ outDir })
}
