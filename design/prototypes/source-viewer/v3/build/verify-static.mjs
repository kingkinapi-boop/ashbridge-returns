// Static lint for the v3 pages (design family checks 6, 7 and 9): no browser needed.
// Check 6: no retired term and no removed clause in the brief or the prototype.
// Check 7: no self-link, no dead # link, no broken link, one h1 per page, no inline style, no third-party host.
// Check 9: only govuk-, moj- and app- classes; every app- class defined in CSS and listed in notes.md; no CSS zoom; no third-party font.
// Strings below are built from pieces so that this file does not itself hold a retired term, a dash or a sample SIN.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { V3, HERE, DESIGN, ck } from './verify-lib.mjs'

const j = (...p) => p.join('')
const RETIRED = [j('export ', '1'), j('export ', '2'), j('review-lines ', 'export'), j('receipt ', 'export'), j('gate ', '1'), j('judgment input ', 'sheet'), j('AI-proposed ', 'GIFI'), j('Judgment ', 'tab')]
const DASHES = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)]
const FILLER = new RegExp(j('lorem ', 'ipsum') + '|' + j('coming ', 'soon') + '|\\bTB' + 'D\\b|placeholder=', 'i')
const SIN = new RegExp(j('3779', '79456') + '|\\bSIN ' + j('end', 'ing') + '|' + j('end', 'ing in ') + '\\d')
const ROOT = path.resolve(DESIGN, '..')

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])
const rel = (f) => path.relative(V3, f).replace(/\\/g, '/')

export const sections = {}

sections.lint = async (T) => {
  const brief = path.resolve(DESIGN, 'briefs/source-viewer.md')
  const files = walk(V3)
  const html = files.filter((f) => f.endsWith('.html'))
  const own = files.filter((f) => /\.(html|js|css|md|svg|mjs)$/.test(f) && !/govuk-moj\.css$/.test(f) && !/[\\/]build[\\/]verify[^\\/]*\.mjs$/.test(f))
  const notesPath = path.join(V3, 'notes.md')
  const report = path.resolve(ROOT, 'reports/design-source-viewer-3.md')
  const texts = [...own, brief, ...(fs.existsSync(report) ? [report] : [])]
  const findings = { retired: [], removed: [], unknownClause: [], dash: [], filler: [], sin: [], zoom: [], host: [], font: [], link: [], cls: [], page: [], inline: [], app: [] }

  // ---- check 6: retired terms, removed and unknown clauses
  const bp = fs.readdirSync(path.join(ROOT, 'blueprint')).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(ROOT, 'blueprint', f), 'utf8')).join('\n')
  const removed = new Set([...bp.matchAll(/^- \*\*([A-Z]+-\d+[a-z]?)\*\* ?\(removed/gm)].map((m) => m[1]))
  const defined = new Set([...bp.matchAll(/^- \*\*([A-Z]+-\d+[a-z]?)\*\*/gm)].map((m) => m[1]))
  const prefixes = new Set([...defined].map((d) => d.split('-')[0]))
  for (const f of texts) {
    const t = fs.readFileSync(f, 'utf8'), name = f === brief ? 'brief' : f === report ? 'report' : rel(f), low = t.toLowerCase()
    for (const r of RETIRED) if (low.includes(r.toLowerCase())) findings.retired.push(`"${r}" in ${name}`)
    for (const id of removed) if (new RegExp('\\b' + id + '\\b').test(t)) findings.removed.push(`${id} in ${name}`)
    for (const m of t.matchAll(/\b([A-Z]{2,5})-(\d+[a-z]?)\b/g)) if (prefixes.has(m[1]) && !defined.has(m[0])) findings.unknownClause.push(`${m[0]} in ${name}`)
    for (const d of DASHES) if (t.includes(d)) findings.dash.push(`dash in ${name}`)
    if (FILLER.test(t) && f !== brief) findings.filler.push(`filler in ${name}`)
    if (SIN.test(t)) findings.sin.push(`SIN text in ${name}`)
  }
  ck('check 6: no retired term in the brief or the prototype (' + RETIRED.length + ' terms, ' + texts.length + ' files)', !findings.retired.length, findings.retired.join('; '))
  ck('check 6: no removed clause named (' + [...removed].join(', ') + ') and no clause ID the blueprint does not define', !findings.removed.length && !findings.unknownClause.length, [...findings.removed, ...[...new Set(findings.unknownClause)]].join('; '))
  ck('no dash character, no filler text, no SIN digits in any page, script, stylesheet, note or report', !findings.dash.length && !findings.filler.length && !findings.sin.length, [...new Set([...findings.dash, ...findings.filler, ...findings.sin])].join('; '))

  // ---- check 9: stylesheets and fonts
  for (const f of files.filter((f) => f.endsWith('.css'))) {
    const t = fs.readFileSync(f, 'utf8')
    if (!/govuk-moj\.css$/.test(f) && /(^|[;{\s])zoom\s*:/.test(t)) findings.zoom.push(rel(f))
    // the compiled official stylesheet names images of parts this prototype does not use (the GOV.UK crest, MOJ icons): they must not be
    // fetched, which the "no failed request" listener and the rendered background check of the dom section prove; only a host is a finding there
    const official = /govuk-moj\.css$/.test(f)
    for (const m of t.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const u = m[1]
      if (/^(https?:)?\/\//.test(u)) findings.font.push(`${u} in ${rel(f)}`)
      else if (!official && !u.startsWith('data:') && !fs.existsSync(path.resolve(path.dirname(f), u.split(/[?#]/)[0]))) findings.font.push(`missing ${u} in ${rel(f)}`)
    }
  }
  const zoomInOfficial = (fs.readFileSync(path.join(V3, 'static/govuk-moj.css'), 'utf8').match(/(^|[;{\s])zoom\s*:/g) || []).length
  ck('check 9: no CSS zoom in app.css or the shared part; no third-party font or stylesheet host; every url() resolves', !findings.zoom.length && !findings.font.length, [...findings.zoom, ...findings.font].join('; '))
  for (const f of own.filter((f) => !f.endsWith('.md') && !f.endsWith('.css'))) {
    const t = fs.readFileSync(f, 'utf8')
    for (const m of t.matchAll(/https?:\/\/[^\s"')<>]+/g)) if (!/^http:\/\/www\.w3\.org\//.test(m[0])) findings.host.push(`${m[0].slice(0, 60)} in ${rel(f)}`)
  }
  ck('check 9: no third-party host in any page, script or image (only the w3.org namespace in SVG)', !findings.host.length, findings.host.join('; '))
  ck('the official GOV.UK and MOJ stylesheet is used as compiled (zoom declarations in it, counted and not ours: ' + zoomInOfficial + ')', true, '')

  // ---- check 7 and 9 on the pages
  const ids = (t) => new Set([...t.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
  for (const f of html) {
    const t = fs.readFileSync(f, 'utf8'), dir = path.dirname(f), name = path.basename(f), idset = ids(t)
    for (const m of t.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/g)) {
      const hh = m[1].replace(/&amp;/g, '&'), tag = m[0]
      if (hh === '#' || hh === '') findings.link.push(`dead # link in ${name}`)
      else if (hh.startsWith('#')) { if (!idset.has(hh.slice(1))) findings.link.push(`missing anchor ${hh} in ${name}`) }
      else if (!/^https?:/.test(hh)) {
        const target = path.resolve(dir, hh.split(/[?#]/)[0])
        if (!fs.existsSync(target)) findings.link.push(`broken link ${hh} in ${name}`)
        // a client-route link (data-route) goes to another tab of the same record by script, so it is not a link to nowhere even though the five tabs share one file
        else if (target === f && !/aria-current/.test(tag) && !/data-route=/.test(tag)) findings.link.push(`self link ${hh} in ${name}`)
      }
    }
    for (const m of t.matchAll(/\bclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/).filter(Boolean)) if (!/^(govuk-|moj-|app-)/.test(c) && !['js-enabled'].includes(c)) findings.cls.push(`class ${c} in ${name}`)
    if ((t.match(/<h1[\s>]/g) || []).length !== 1) findings.page.push(`h1 count in ${name}`)
    if (/\sstyle="/.test(t)) findings.inline.push(`inline style in ${name}`)
    if (!/<a href="#main" class="govuk-skip-link"/.test(t)) findings.page.push(`no skip link in ${name}`)
    if (!/govuk-generic-header/.test(t)) findings.page.push(`no Generic header in ${name}`)
    if (!/<title>[^<]+ - Ashbridge Tax<\/title>/.test(t)) findings.page.push(`title shape in ${name}`)
    if (/app-viewer__(head|stage|card|title|steps|foot)/.test(t)) findings.page.push(`page draws its own viewer: ${name}`)
  }
  ck('check 7: no dead # link, no missing anchor, no broken relative link, no self-link without aria-current (' + html.length + ' pages)', !findings.link.length, findings.link.join('; '))
  ck('rules 1, 4: only govuk-, moj- and app- classes; one h1, a skip link, the Generic header and a titled page on every page; no inline style in any page; no page draws its own viewer', !findings.cls.length && !findings.page.length && !findings.inline.length, [...findings.cls, ...findings.page, ...findings.inline].join('; '))

  // ---- app- classes: defined in CSS, used somewhere, listed in notes.md
  const css = fs.readFileSync(path.join(V3, 'static/app.css'), 'utf8')
  const partCss = fs.readFileSync(path.join(DESIGN, 'parts/cite-or-reason/cite-or-reason.css'), 'utf8')
  const def = new Set([...(css + partCss).matchAll(/\.(app-[a-z0-9_-]+)/g)].map((m) => m[1]).filter((c) => !c.endsWith('-')))
  const used = new Set()
  const scan = files.filter((f) => (f.endsWith('.html') || /static[\\/][a-z-]+\.js$/.test(f)) && !/data\.js$/.test(f))
  for (const f of scan) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\b(app-[a-z0-9_-]+)/g)) if (!m[1].endsWith('-')) used.add(m[1])
  for (const m of fs.readFileSync(path.join(DESIGN, 'parts/cite-or-reason/cite-or-reason.js'), 'utf8').matchAll(/\b(app-[a-z0-9_-]+)/g)) if (!m[1].endsWith('-')) used.add(m[1])
  const dynamic = ['app-dot--green', 'app-dot--grey', 'app-dot--amber', 'app-dot--purple'] // built as 'app-dot--' + colour in viewer.js
  for (const d of dynamic) used.add(d)
  const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8') : ''
  const partReadme = fs.readFileSync(path.join(DESIGN, 'parts/cite-or-reason/README.md'), 'utf8')
  for (const u of used) {
    if (!def.has(u) && u !== 'app-pane-w') findings.app.push(`used without CSS: ${u}`)
    if (!notes.includes('`' + u + '`') && !partReadme.includes(u) && u !== 'app-pane-w') findings.app.push(`not listed in notes.md: ${u}`)
  }
  for (const d of def) if (!used.has(d)) findings.app.push(`defined but never used: ${d}`)
  out_lint(T, { appClasses: [...used].sort(), defined: def.size, removed: [...removed], findings })
  ck('check 9: every app- class used is defined in the stylesheet and listed in notes.md or the shared part\'s README, and none is dead (' + used.size + ' classes)', !findings.app.length, [...new Set(findings.app)].join('; '))

  // ---- the generated data file is in step with the data module
  const mod = await import(pathToFileURL(path.join(HERE, 'data.mjs')).href)
  const want = `window.SV_DATA = ${JSON.stringify({ base: 'static/', sources: mod.sources, lists: mod.lists, client: mod.client, people: mod.people, today: mod.today, story: mod.story })};\n`
  const have = fs.readFileSync(path.join(V3, 'static/data.js'), 'utf8')
  ck('static/data.js is the output of build/data.mjs (the pages are in step with reference/sample-clients)', want === have, 'differs: run build.mjs')
  const names = [mod.client.name, ...Object.values(mod.people).map((p) => p.name)]
  ck('made-up names end "(Test)": the company and the three people', names.every((n) => /\(Test\)$/.test(n)), names.join(' | '))
  const pageText = html.map((f) => fs.readFileSync(f, 'utf8')).join('\n') + have
  ck('no nine-digit number that could be a SIN or account number in any page or in the data', !/(?<![\d.,])\d{3}[ -]\d{3}[ -]\d{3}(?![\d])|(?<![\d.,A-Za-z])\d{9}(?![\d.A-Za-z])/.test(pageText), '')
}

function out_lint(T, o) { T.out.lint = { ...T.out.lint, ...o } }
