// Lint for version 3 (design card checks 6, 7 and 9, and the static rules of .claude/rules/staff-screens.md).
// Run: node design/prototypes/queues-record/v3/build/check.mjs     (no packages; exit code 1 when a problem is found)
//  6  retired terms and unknown clause IDs in the brief, the pages, the script and the style sheet; the brief names the blueprint commit
//  7  no self-link, no # link that changes nothing, no control drawn as plain text, no filler in a data column,
//     no two counts that disagree (view tabs, menu options and the state strip against the rows)
//  9  only govuk-, moj- and app- classes, each app- class listed in basis.md; no zoom, no third-party font, no inline style
//  r  page rules: one h1, skip link, title, header search, labels, captions and scoped headers, no disabled control, sign-in rules
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const REPO = path.resolve(here, '..', '..', '..', '..', '..')
const read = (p) => fs.readFileSync(p, 'utf8')
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']')
const RETIRED = /export 1\b|export 2\b|review-lines export|receipt export|gate 1\b|judgment input sheet|judgment inputs|AI-proposed GIFI/i
const FILLER = /^(next ops step|tbd|n\/a|lorem.*|coming soon|xxx+|placeholder)$/i
const TABS = ['overview', 'workbench', 'review', 'documents', 'exceptions', 'history', 'ops']
const BASIS_ALLOWED = ['app-width-container--wide', 'app-panes', 'app-coverage-tracker', 'app-shortcuts'] // design/basis/ allows these four without a reason here

const found = new Map() // "check: message" -> [files]
const err = (check, file, msg) => { const k = `${check}: ${msg}`; if (!found.has(k)) found.set(k, []); found.get(k).push(file) }
const stats = { pages: 0, links: 0, selfExempt: 0, tables: 0, rows: 0, fields: 0, listPages: 0, appClasses: new Set() }

// ---------- files ----------
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()
const html = Object.fromEntries(pages.map((f) => [f, read(path.join(ROOT, f))]))
const briefPath = path.join(REPO, 'design', 'briefs', 'queues-record.md')
const brief = read(briefPath)
const basis = read(path.join(ROOT, 'basis.md'))
const js = read(path.join(ROOT, 'static', 'app.js'))
const css = read(path.join(ROOT, 'static', 'app.css'))
const listed = new Set([...basis.matchAll(/app-[a-z0-9][a-z0-9_-]*/g)].map((m) => m[0]))
const okApp = (c) => BASIS_ALLOWED.includes(c) || listed.has(c)
const PREFIX = /^(govuk-|moj-|app-|js-enabled$)/

// ---------- check 6: retired terms, clause IDs, the blueprint commit ----------
const blueprint = fs.readdirSync(path.join(REPO, 'blueprint')).filter((f) => f.endsWith('.md')).map((f) => read(path.join(REPO, 'blueprint', f))).join('\n')
const ID = /\b(?:RV|FLOW|SEC|RT|TB|LL|CP|ARC)-\d+\b/g
for (const [name, text] of [['brief', brief], ['basis.md', basis], ['app.js', js], ['app.css', css], ...pages.map((f) => [f, html[f]])]) {
  if (RETIRED.test(text)) err(6, name, `retired term "${RETIRED.exec(text)[0]}"`)
  if (DASH.test(text)) err('dash', name, 'em or en dash')
  if (text.includes('\r')) err('lf', name, 'CRLF line ends (use LF)')
  for (const id of new Set(text.match(ID) || [])) if (!blueprint.includes(id)) err(6, name, `clause ${id} is not in blueprint/`)
}
{
  const m = /blueprint v[\d.]+ \(main ([0-9a-f]{7,40})\)/.exec(brief)
  if (!m) err(6, 'brief', 'the brief does not name the blueprint commit it was written from ("blueprint v1.2 (main <sha>)")')
  else { try { execFileSync('git', ['cat-file', '-e', m[1] + '^{commit}'], { cwd: REPO, stdio: 'ignore' }) } catch (e) { err(6, 'brief', `the blueprint commit ${m[1]} is not in this repository`) } }
}

// ---------- the pages ----------
const idsOf = (h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/\sdata-([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
const rowTags = (h) => [...h.matchAll(/<tr class="govuk-table__row"( data-slug="[^"]*"[^>]*)>/g)].map((m) => m[1])

for (const f of pages) {
  const h = html[f]
  const e = (c, m) => err(c, f, m)
  stats.pages++
  const ids = idsOf(h)
  const hasList = /id="list-config"/.test(h)
  if (hasList) stats.listPages++

  // check 7: links
  for (const m of h.matchAll(/<a\b([^>]*)>/g)) {
    stats.links++
    const a = m[1]; const hm = /\shref="([^"]*)"/.exec(' ' + a)
    if (!hm) { e(7, 'link without href'); continue }
    const href = hm[1]
    if (href === '#' || href === '') { e(7, 'empty # link'); continue }
    if (/^(https?:|mailto:)/.test(href)) { e(7, 'external link ' + href); continue }
    const hash = href.indexOf('#'); const frag = hash > -1 ? href.slice(hash + 1) : undefined; const file = (hash > -1 ? href.slice(0, hash) : href).split('?')[0]
    if (file === '' && frag !== undefined) {
      const route = TABS.includes(frag.split('/')[0]) || /^view=/.test(frag)
      if (!route && !ids.includes(frag)) e(7, '# link to nothing: #' + frag)
      continue
    }
    if (!fs.existsSync(path.join(ROOT, file))) { e(7, 'dead link ' + href); continue }
    if (file === f) {
      if (/\sdata-home\b/.test(a) && hasList) { stats.selfExempt++; continue } // the logo on its own list starts the list afresh (static/app.js, listsAfter)
      if (!(frag !== undefined && (TABS.includes(frag.split('/')[0]) || /^view=/.test(frag)))) e(7, 'self-link ' + href)
    }
    if (/class="[^"]*govuk-button/.test(a)) e(7, 'link drawn as a button: ' + href)
    if (/role="button"/.test(a)) e(7, 'role=button on a link')
  }
  for (const m of h.matchAll(/<(span|div|p|li)\b[^>]*(onclick|role="button")[^>]*>/g)) e(7, 'control drawn as text: ' + m[0].slice(0, 50))
  for (const m of h.matchAll(/<td class="govuk-table__cell[^"]*"[^>]*>([^<]*)<\/td>/g)) if (FILLER.test(m[1].trim())) e(7, 'filler in a data cell: ' + m[1])

  // check 9: classes
  for (const m of h.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) {
    if (!c) continue
    if (!PREFIX.test(c)) e(9, 'class without govuk-, moj- or app- prefix: ' + c)
    if (c.startsWith('app-')) { stats.appClasses.add(c); if (!okApp(c)) e(9, 'app- class not in basis.md: ' + c) }
  }
  if (/\sstyle="/.test(h)) e(9, 'inline style')
  if (/<style\b/.test(h)) e(9, 'style element in the page')

  // page rules
  if ((h.match(/<h1[ >]/g) || []).length !== 1) e('r', 'not exactly one h1')
  if (!/<a href="#main-content" class="govuk-skip-link"/.test(h) || !/<main\b[^>]*id="main-content"/.test(h)) e('r', 'skip link to main missing')
  if (!/<html lang="en-CA"/.test(h)) e('r', 'html lang missing')
  if (!/<title>[^<]+ - Ashbridge Tax<\/title>/.test(h)) e('r', 'title does not end "- Ashbridge Tax"')
  if (!/<header class="govuk-header">[\s\S]*<img src="static\/ashbridge-tax-logo\.png"/.test(h)) e('r', 'Generic header with the logo missing')
  if (/placeholder=|lorem ipsum|coming soon/i.test(h)) e('r', 'placeholder text or attribute')
  if (/\sdisabled\b|aria-disabled/.test(h)) e('r', 'disabled control (rule 8)')
  if (/<input[^>]*type="radio"[^>]*\schecked/.test(h)) e('r', 'a radio is preselected (rule 9)')
  if (/\bSIN\b(?! on file)/.test(h) || /\b\d{3}[- ]\d{3}[- ]\d{3}\b/.test(h)) e('r', 'a SIN is shown (rule 15)')
  const dup = ids.find((x, i) => ids.indexOf(x) !== i); if (dup) e('r', 'duplicate id ' + dup)
  for (const m of h.matchAll(/\s(?:for|aria-controls)="([^"]+)"/g)) if (!ids.includes(m[1])) e('r', 'label/controls target missing: ' + m[1])
  for (const m of h.matchAll(/\saria-(?:describedby|labelledby)="([^"]+)"/g)) for (const t of m[1].split(/\s+/)) if (!ids.includes(t)) e('r', 'aria reference target missing: ' + t)
  // (the MOJ alert's hidden Dismiss button is the official markup and carries no type; no alert here is dismissible)
  for (const m of h.matchAll(/<button\b([^>]*)>/g)) if (!/\stype="/.test(m[1]) && !/class="moj-alert__dismiss"/.test(m[1])) e('r', 'button without type')
  // fields have labels (rule 16)
  for (const m of h.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const a = m[2]; if (/type="(hidden|submit|button)"/.test(a)) continue
    stats.fields++
    const id = (/\sid="([^"]+)"/.exec(a) || [])[1]
    if (!(id && new RegExp(`<label[^>]*for="${id}"`).test(h)) && !/\saria-label=/.test(a)) e('r', 'field without a label: ' + (id || a.slice(0, 40)))
  }
  // tables: caption, scoped headers, sortable when long (rules 5 and 6)
  for (const m of h.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/g)) {
    stats.tables++
    const inner = m[2]
    if (!/<caption\b/.test(inner)) e('r', 'table without a caption')
    for (const th of inner.matchAll(/<th\b([^>]*)>/g)) if (!/\sscope="(col|row)"/.test(th[1])) e('r', 'th without scope')
    const tb = /<tbody[^>]*>([\s\S]*)<\/tbody>/.exec(inner)
    const n = tb ? (tb[1].match(/<tr\b/g) || []).length : 0
    // (index.html is the prototype guide for reviewers, not a staff screen: its page list is not a list of returns)
    if (n > 5 && f !== 'index.html' && !/moj-sortable-table/.test(m[1])) e('r', `table of ${n} rows is not sortable`)
  }
  // shortcuts are listed (rule 10)
  for (const m of h.matchAll(/aria-keyshortcuts="([^"]+)"/g)) if (!new RegExp(`<kbd>${m[1]}</kbd>`).test(h)) e('r', `shortcut ${m[1]} is not listed under Keyboard shortcuts`)
  if (/data-page="app"/.test(h)) {
    if (!/<form class="app-search" role="search"/.test(h)) e('r', 'header search missing')
    const ul = /<ul class="govuk-service-navigation__list"[^>]*data-role-nav>([\s\S]*?)<\/ul>/.exec(h)
    const lis = ul ? ul[1].split('</li>').filter((x) => x.includes('<li')) : []
    if (!lis.length || !/data-signout/.test(lis[lis.length - 1])) e('r', 'Sign out is not the last service navigation item')
  }
  // records: the one shell (rule 23)
  if (f.startsWith('rec-')) {
    if (!/class="moj-identity-bar"/.test(h)) e('r', 'record without the identity bar')
    if (!/<title>[^<]*\(Test\)[^<]*year end \d/.test(h)) e('r', 'record title does not name the return')
    const tabs = [...h.matchAll(/class="moj-sub-navigation__link" href="#([a-z]+)"/g)].map((m) => m[1])
    if (tabs.join(',') !== TABS.join(',')) e('r', 'record tabs differ from the one set: ' + tabs.join(','))
    for (const t of TABS) if (!new RegExp(`data-panel="${t}"`).test(h)) e('r', 'record panel missing: ' + t)
  }
}

// ---------- check 7: counts that must agree (the static page is written for Aisha Rahman (Test); static/app.js recounts per person) ----------
const crossPage = new Map()
for (const f of pages) {
  const h = html[f]
  const m = /<script type="application\/json" id="list-config">([\s\S]*?)<\/script>/.exec(h)
  if (!m) continue
  const cfg = JSON.parse(m[1])
  const mode = cfg.scope === 'prep' ? 'mine' : 'all'
  const views = cfg.views[mode]
  const rows = rowTags(h).map(attrsOf)
  const inScope = rows.filter((r) => (cfg.scope === 'prep' ? r.prep === 'aisha' : true))
  const countOf = (k) => inScope.filter((r) => (r['views-' + mode] || '').split(' ').includes(k)).length
  rows.forEach(() => { stats.rows++ })
  const tabBadges = [...h.matchAll(/data-view="([^"]+)" data-count="([^"]*)" data-scope="([^"]*)"[^>]*>[^<]*<span class="moj-badge moj-badge--grey"><span class="govuk-visually-hidden">\(<\/span>(\d+)</g)]
  const options = [...h.matchAll(/<option value="([^"]+)"[^>]*>[^<]*\((\d+)\)<\/option>/g)]
  if (!tabBadges.length && !options.length) err(7, f, 'no view counts to compare')
  for (const [, k, name, scope, n] of tabBadges) {
    if (countOf(k) !== +n) err(7, f, `view tab "${k}" says ${n}, the rows say ${countOf(k)}`)
    const key = name + '|' + scope; if (crossPage.has(key) && crossPage.get(key).n !== +n) err(7, f, `"${name}" is ${crossPage.get(key).n} on ${crossPage.get(key).f} and ${n} here`); else crossPage.set(key, { n: +n, f })
  }
  for (const [, k, n] of options) if (countOf(k) !== +n) err(7, f, `menu option "${k}" says ${n}, the rows say ${countOf(k)}`)
  const active = views[0][0]
  const shown = rows.filter((r, i) => true).length
  const st = /Showing (\d+) of (\d+) returns in/.exec(h)
  if (!st) err(7, f, 'status line missing')
  else {
    if (+st[1] !== countOf(active) || +st[2] !== countOf(active)) err(7, f, `status line says ${st[1]} of ${st[2]}, the first view has ${countOf(active)} rows`)
    const visible = [...h.matchAll(/<tr class="govuk-table__row"( data-slug="[^"]*"[^>]*)>/g)].filter((x) => !/\shidden$/.test(x[1]) && !/\shidden\b[^"]*$/.test(x[1].replace(/data-[a-z-]+="[^"]*"/g, ''))).length
    if (visible !== countOf(active)) err(7, f, `the page draws ${visible} visible rows, the first view has ${countOf(active)}`)
  }
  for (const s of h.matchAll(/data-state-filter="([^"]+)"[^>]*><span class="app-pipe__count">(\d+)</g)) {
    const c = rows.filter((r) => r.state === s[1]).length
    if (c !== +s[2]) err(7, f, `state strip ${s[1]} says ${s[2]}, rows ${c}`)
  }
}

// ---------- check 9: style sheet and script ----------
{
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/\bzoom\s*:/.test(bare)) err(9, 'app.css', 'zoom')
  if (/@import|fonts\.googleapis|fonts\.gstatic|@font-face/.test(bare)) err(9, 'app.css', 'third-party font or import')
  for (const m of bare.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
    if (!PREFIX.test(m[1]) && m[1] !== 'govuk-frontend-supported') err(9, 'app.css', 'selector class without prefix: ' + m[1])
    if (m[1].startsWith('app-')) { stats.appClasses.add(m[1]); if (!okApp(m[1])) err(9, 'app.css', 'app- class not in basis.md: ' + m[1]) }
  }
  if (/\.style\.|setAttribute\(\s*['"]style['"]/.test(js)) err(9, 'app.js', 'inline style set by script')
  // class attributes written by the script: whole attributes are checked for prefixes; one assembled from pieces ('...' + x + '...') is checked
  // for its govuk-, moj- and app- words here, and every class of the live page is audited again in the browser by build/verify.mjs
  for (const m of js.matchAll(/class="([^"]*)"/g)) {
    const whole = !/['+]/.test(m[1])
    const tokens = whole ? m[1].split(/\s+/).filter(Boolean) : (m[1].match(/\b(?:app|govuk|moj)-[a-z0-9][a-z0-9_-]*/g) || [])
    for (const c of tokens) {
      if (!PREFIX.test(c)) err(9, 'app.js', 'class without prefix: ' + c)
      if (c.startsWith('app-')) { stats.appClasses.add(c); if (!okApp(c)) err(9, 'app.js', 'app- class not in basis.md: ' + c) }
    }
  }
  for (const m of js.matchAll(/(?:className\s*=|classList\.(?:add|remove|toggle|contains)\()\s*'([^']*)'/g)) for (const c of m[1].split(/\s+/)) { if (c && !PREFIX.test(c)) err(9, 'app.js', 'class without prefix: ' + c); if (c.startsWith('app-')) { stats.appClasses.add(c); if (!okApp(c)) err(9, 'app.js', 'app- class not in basis.md: ' + c) } }
  for (const c of listed) if (!BASIS_ALLOWED.includes(c) && ![...stats.appClasses].includes(c)) err(9, 'basis.md', 'class listed but not used: ' + c)
  if (fs.existsSync(path.join(ROOT, 'assets')) || fs.existsSync(path.join(ROOT, 'static', 'assets'))) err(9, 'v3', 'a folder named assets (it is git-ignored on Windows)')
  const ls = fs.readdirSync(path.join(ROOT, 'static')).sort()
  const want = ['app.css', 'app.js', 'ashbridge-tax-logo.png', 'basis.css', 'govuk-frontend.js', 'moj-frontend.js']
  if (ls.join() !== want.join()) err(9, 'static', 'static/ holds ' + ls.join(', ') + ', expected ' + want.join(', '))
}

// ---------- sign-in rules (QR2, QR3, SEC-1): one failure message, no locked state, no resend control, paste allowed ----------
for (const f of ['sign-in.html', 'sign-in-error.html', 'sign-in-ended.html', 'code.html', 'code-error.html']) {
  const h = html[f]; if (!h) { err('r', f, 'missing'); continue }
  const visible = h.replace(/<script[\s\S]*?<\/script>/g, '')
  if (/locked|lock out|too many|resend|send a new code|forgot|reset your password/i.test(visible)) err('r', f, 'a locked state, a resend control or a recovery link is drawn (QR2, QR3)')
  if (/onpaste|paste.*preventDefault/i.test(h + js)) err('r', f, 'paste is blocked')
  if (/\sautocomplete="off"/.test(h)) err('r', f, 'autocomplete is off on a sign-in field')
  if (f.startsWith('sign-in') && !/autocomplete="username"/.test(h)) err('r', f, 'User ID field lacks autocomplete="username"')
  if (f.startsWith('sign-in') && !/autocomplete="current-password"/.test(h)) err('r', f, 'password field lacks autocomplete="current-password"')
  if (!f.startsWith('sign-in') && !/autocomplete="one-time-code"/.test(h)) err('r', f, 'code field lacks autocomplete="one-time-code"')
  if (/error/.test(f)) {
    if (!/Sign-in failed\./.test(h)) err('r', f, 'the one failure message is missing')
    if ((h.match(/Sign-in failed\./g) || []).length < 2) err('r', f, 'the failure message should show in the summary and at the field')
    if (!/<title>Error: /.test(h)) err('r', f, 'title does not start "Error: "')
  } else {
    if (/govuk-error-(summary|message)/.test(visible)) err('r', f, 'an error shows before any submit')
    if (/<title>Error: /.test(h)) err('r', f, 'title starts "Error: " with no error')
  }
}

// ---------- report ----------
const order = ['6', '7', '9', 'r', 'dash', 'lf']
const byCheck = (c) => [...found.entries()].filter(([k]) => k.startsWith(c + ':'))
let total = 0
for (const c of order) {
  const list = byCheck(c); let n = 0
  for (const [msg, files] of list) {
    const uniq = [...new Set(files)]; n += uniq.length
    if (total < 80) console.log(`  ${msg}  [${uniq.length} page${uniq.length === 1 ? '' : 's'}: ${uniq.slice(0, 3).join(', ')}${uniq.length > 3 ? ', ...' : ''}]`)
    total += uniq.length
  }
  console.log(`check ${c}: ${n} problem${n === 1 ? '' : 's'}`)
}
console.log(`checked ${stats.pages} pages (${stats.listPages} lists), ${stats.links} links (${stats.selfExempt} logo link${stats.selfExempt === 1 ? '' : 's'} to its own list, which starts that list afresh), ${stats.tables} tables, ${stats.fields} fields, ${stats.rows} list rows`)
console.log('app- classes used: ' + [...stats.appClasses].sort().join(' '))
console.log(`problems: ${total}`)
process.exit(total ? 1 : 0)
