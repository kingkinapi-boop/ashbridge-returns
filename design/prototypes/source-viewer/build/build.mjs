// Builds the static pages. Run: node design/prototypes/source-viewer/build/build.mjs
// The pages are plain HTML; this script only keeps figures, counts and links in step with reference/sample-clients.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sources, lists, client, stmtRows } from './data.mjs'
import { statementP2, statementP3, t5Draft } from './svg.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, '..')
const w = (rel, text) => { const p = path.join(out, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text) }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

// ---------- assets ----------
fs.mkdirSync(path.join(out, 'assets/pages'), { recursive: true })
w('assets/pages/lakeview-dec-p2.svg', statementP2())
w('assets/pages/lakeview-dec-p3.svg', statementP3())
w('assets/pages/t5-draft.svg', t5Draft())
const sheetHeader = ['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance']
w('assets/data.js', `window.SV_DATA = ${JSON.stringify({ base: '../assets/', sheetHeader, sources, lists, client })};\n`)

const IDENT = `${client.name}, year end ${client.ye}`
const LOGO = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="6" fill="#ffffff"/><path d="M6 25 L16 6 L26 25 M10.5 19 H21.5" fill="none" stroke="#355b7d" stroke-width="3" stroke-linejoin="round"/></svg>`

// One shell for every page: header, the return (identity bar, record tabs), main. A work page puts the source pane beside main.
function shell({ file, title, tabs, work, pane = false, scripts, win = false, recordTabs = true, parts = null }) {
  const up = '../'
  const tabHtml = tabs.map((t) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${t.href}"${t.route ? ` data-route="${t.route}"` : ''}${t.href === file ? ' aria-current="page"' : ''}>${esc(t.text)}</a></li>`).join('\n        ')
  const head = `  <header>
    <div class="govuk-generic-header">
      <div class="govuk-generic-header__container app-wide">
        <div class="govuk-generic-header__logo">
          <a href="${up}index.html" class="govuk-generic-header__homepage-link app-brand">${LOGO}<span>Ashbridge Tax</span></a>
        </div>
      </div>
    </div>
  </header>
  <div role="region" aria-label="Return" class="app-return">
    <div class="moj-identity-bar app-wide" data-identity-bar>
      <div class="moj-identity-bar__container">
        <div class="moj-identity-bar__details"><span class="moj-identity-bar__title">${esc(IDENT)}</span></div>
        <div class="moj-identity-bar__actions"><a class="govuk-link govuk-link--no-visited-state app-bar-link" id="sv-signout" href="${up}signed-out.html">Sign out</a></div>
      </div>
    </div>${recordTabs ? `
    <nav class="moj-sub-navigation app-wide" aria-label="Return record">
      <ul class="moj-sub-navigation__list">
        ${tabHtml}
      </ul>
    </nav>` : ''}
  </div>`
  const main = `  <main id="main" tabindex="-1" class="${win ? 'app-window-main' : ''}">
${work}
  </main>`
  const body = pane ? `  <div class="app-split" id="app-split" data-view="list">
  <div class="app-split__left">
${head}
${main}
  </div>
  <div id="source-pane" class="app-split__pane" role="region" aria-label="Source viewer">
    <div id="app-splitter" class="app-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize the source pane. Left arrow widens it, right arrow narrows it" aria-controls="sv-root" aria-valuemin="360" aria-valuemax="800" aria-valuenow="480"></div>
    <div id="sv-root" class="app-viewer-root"></div>
  </div>
  </div>` : `${head}
${main}`
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}, ${esc(IDENT)} - Ashbridge Tax</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${up}assets/govuk-moj.css">
  <link rel="stylesheet" href="${up}assets/app.css">${parts ? `\n  <link rel="stylesheet" href="${parts}cite-or-reason.css">` : ''}
</head>
<body class="govuk-template__body app-shell${win ? ' app-shell--stack' : ''}" data-signed-out="${up}signed-out.html">
  <script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
  <a href="#main" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
  <div id="sv-live" class="govuk-visually-hidden" role="status" aria-live="polite"></div>
${body}
  <script src="${up}assets/signout.js"></script>
  <script src="${up}assets/data.js"></script>
  <script src="${up}assets/viewer.js"></script>${parts ? `\n  <script src="${parts}cite-or-reason.js"></script>` : ''}
${scripts.map((s) => `  <script src="${up}assets/${s}"></script>`).join('\n')}
</body>
</html>
`
}

const keysTable = (rows) => `<details class="govuk-details govuk-!-margin-top-4">
      <summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts and prototype settings</span></summary>
      <div class="govuk-details__text">
        <table class="govuk-table app-table-dense">
          <caption class="govuk-table__caption govuk-table__caption--s">Keyboard shortcuts (each repeats a visible button)</caption>
          <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Key</th><th scope="col" class="govuk-table__header">What it does</th></tr></thead>
          <tbody class="govuk-table__body">
${rows.map((r) => `            <tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><span class="app-key">${r[0]}</span></th><td class="govuk-table__cell">${r[1]}</td></tr>`).join('\n')}
          </tbody>
        </table>
        <div class="govuk-form-group">
          <div class="govuk-checkboxes govuk-checkboxes--small">
            <div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-keys-off">Turn off single-key shortcuts</label></div>
            <div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-slow" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-slow">Prototype only: load page images slowly (1.5 seconds) to see the loading state</label></div>
          </div>
        </div>
      </div>
    </details>`
// D01's one shortcut list for the viewer: j k [ ] o Esc, and from this round + - 0 (zoom) and m (A, Reviewed, next)
const KEYS_STD = [['j', 'Next figure, and show its sources'], ['k', 'Previous figure'], [']', 'Next source of the figure'], ['[', 'Previous source of the figure'], ['+', 'Zoom the page in (also =), never past the size where the whole box shows'], ['-', 'Zoom the page out'], ['0', 'Fit the box: back to the readable size'], ['o', 'Open the second window, or bring it back'], ['Esc', 'Return focus to the figure you came from (on a small screen, back to the list)']]
const KEYS_A = KEYS_STD.concat([['m', 'Reviewed, next: mark the source in view as supporting this figure and go on. It never unmarks']])

const winStrip = `<div class="app-summary-strip">
        <p id="sv-win-status" role="status"></p>
        <button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-fig-nav="-1" aria-keyshortcuts="k">Previous<span class="govuk-visually-hidden"> figure</span> <span class="app-key" aria-hidden="true">k</span></button>
        <button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-fig-nav="1" aria-keyshortcuts="j">Next<span class="govuk-visually-hidden"> figure</span> <span class="app-key" aria-hidden="true">j</span></button>
        <button type="button" id="sv-open-window" class="govuk-button govuk-button--secondary app-button-compact" aria-keyshortcuts="o">Open in second window <span class="app-key" aria-hidden="true">o</span></button>
      </div>`
const filterHtml = (n, what, tag) => `<div class="app-filter">
        <label class="govuk-label" for="sv-filter">Filter ${what}</label>
        <input class="govuk-input" id="sv-filter" type="search" autocomplete="off" spellcheck="false">
        <p class="govuk-hint" id="sv-filter-count" data-count="shown-${tag}" data-scope="of">Showing ${n} of ${n}</p>
      </div>`
const noMatch = (cols) => `<tr class="govuk-table__row" id="sv-filter-none" hidden><td class="govuk-table__cell" colspan="${cols}">Nothing matches that filter. Clear the filter to see every row.</td></tr>`
const openBtn = (item, n, what = 'sources') => `<button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-open aria-controls="source-pane">Show ${what} (${n})<span class="govuk-visually-hidden"> for ${esc(item.name)}</span></button>`
const statusTag = (cls, text) => `<strong class="govuk-tag ${cls}">${esc(text)}</strong>`
const tableOpen = (label, caption) => `<div class="app-scroll" role="region" aria-label="${label}, scrolls sideways on a small screen" tabindex="0">
        <table class="govuk-table app-table-dense">
          <caption class="govuk-table__caption govuk-visually-hidden">${caption}</caption>`

// ---------- version A: CPA review, docked pane with numbered steps ----------
{
  const L = lists.cpa
  const flagged = L.filter((f) => f.flag).length, empty = L.filter((f) => !f.src.length).length
  const rows = L.map((f) => {
    const st = f.flag ? statusTag('govuk-tag--red', 'Flagged for a person') : !f.src.length ? statusTag('govuk-tag--orange', 'Not checked: no evidence') : statusTag('govuk-tag--grey', 'Not checked')
    return `          <tr class="govuk-table__row" data-item="${f.id}">
            <td class="govuk-table__cell">${esc(f.line)}</td>
            <th scope="row" class="govuk-table__header">${esc(f.name)}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${f.amount}</td>
            <td class="govuk-table__cell" data-status>${st}</td>
            <td class="govuk-table__cell">${openBtn(f, f.src.length)}</td>
          </tr>`
  }).join('\n')
  const work = `    <section class="app-split__work" aria-label="Figures to check" tabindex="0">
      <div class="app-worktop"><h1 class="govuk-heading-m">Review figures</h1>
      <p class="govuk-body" data-count="figures-checked" data-scope="figures"><span id="sv-checked">0</span> of ${L.length} figures checked. ${flagged} flagged for a person. ${empty} with no evidence.</p></div>
      <p class="govuk-body app-done" id="sv-done" tabindex="-1" hidden>Every figure that has a source is checked. Figures with no evidence stay unchecked.</p>
      ${winStrip}
      ${filterHtml(L.length, 'figures', 'cpa')}
      ${tableOpen('Figures table', 'Figures in return order. Each is checked against its sources.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">
            <th scope="col" class="govuk-table__header">Line</th><th scope="col" class="govuk-table__header">Figure</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Amount ($)</th><th scope="col" class="govuk-table__header">Status</th><th scope="col" class="govuk-table__header">Sources</th>
          </tr></thead>
          <tbody class="govuk-table__body">
${rows}
          ${noMatch(5)}
          </tbody>
        </table>
      </div>
      ${keysTable(KEYS_A)}
    </section>`
  const tabs = [{ href: 'index.html', text: 'CPA review' }]
  w('a-docked-strip/index.html', shell({ file: 'index.html', title: 'Review figures', tabs, work, pane: true, scripts: ['work.js', 'v1.js'] }))
}

// ---------- version B: preparer, tabs and the decision beside the evidence; two record tabs on one page ----------
{
  const L = lists.prep
  const left = L.filter((f) => !f.src.length).length
  const rows = L.map((f) => {
    const orphan = !f.src.length
    const st = orphan ? statusTag('govuk-tag--orange', 'Needs a source or a reason') : statusTag('govuk-tag--green', 'Cited')
    const btn = orphan ? openBtn(f, f.cand.length, 'candidates') : openBtn(f, f.src.length)
    return `          <tr class="govuk-table__row" data-item="${f.id}">
            <td class="govuk-table__cell">${esc(f.line)}</td>
            <th scope="row" class="govuk-table__header">${esc(f.name)}${f.choice ? ' <span class="govuk-hint govuk-!-display-inline">(tax choice)</span>' : ''}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${f.amount}</td>
            <td class="govuk-table__cell" data-status>${st}</td>
            <td class="govuk-table__cell">${btn}</td>
          </tr>`
  }).join('\n')
  const V = lists.verify
  const vrows = V.map((v) => `          <tr class="govuk-table__row" data-item="${v.id}">
            <th scope="row" class="govuk-table__header">${esc(v.name)}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${v.amount}</td>
            <td class="govuk-table__cell" data-status>${statusTag('govuk-tag--grey', 'Not checked')}</td>
            <td class="govuk-table__cell"><div class="app-actions">
              <button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-open aria-controls="source-pane">Show the box<span class="govuk-visually-hidden"> for ${esc(v.name)}</span></button>
              <button type="button" class="govuk-button app-button-compact" data-act="ok">Accept<span class="govuk-visually-hidden"> ${esc(v.name)}</span></button>
              <button type="button" class="govuk-button govuk-button--warning app-button-compact" data-act="no">Reject<span class="govuk-visually-hidden"> ${esc(v.name)}</span></button>
            </div></td>
          </tr>`).join('\n')
  const work = `    <section class="app-split__work" aria-label="Work on this return" tabindex="0">
      <div class="app-worktop"><h1 class="govuk-heading-m" id="sv-h1">Cite figures</h1></div>
      ${winStrip}
      <div data-panel="cite">
      <p class="govuk-body app-counts" data-count="figures-to-cite" data-scope="figures"><span id="sv-left-cite">${left}</span> of ${L.length} figures need a source or a reason.</p>
      <p class="govuk-body" id="sv-recorded" role="status" tabindex="-1" hidden></p>
      <p class="app-counts"><button type="button" id="sv-next-orphan" class="govuk-button govuk-button--secondary app-button-compact" hidden>Go to the next one to cite</button></p>
      ${filterHtml(L.length, 'figures', 'prep')}
      ${tableOpen('Figures table', 'Figures in return order. Orphans and tax choices need a citation.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">
            <th scope="col" class="govuk-table__header">Line</th><th scope="col" class="govuk-table__header">Figure</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Amount ($)</th><th scope="col" class="govuk-table__header">Status</th><th scope="col" class="govuk-table__header">Sources</th>
          </tr></thead>
          <tbody class="govuk-table__body">
${rows}
          ${noMatch(5)}
          </tbody>
        </table>
      </div>
      </div>
      <div data-panel="verify" hidden>
      <p class="govuk-body app-counts" data-count="values-open" data-scope="values"><span id="sv-left-verify">${V.length}</span> of ${V.length} values not checked. Page 2 of the December statement.</p>
      <p class="govuk-body app-done" id="sv-done" tabindex="-1" hidden>Every value on this page is checked. Rejected values go back for extraction again.</p>
      ${tableOpen('Values table', 'Values read from the page. Compare each with the words inside its box.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">
            <th scope="col" class="govuk-table__header">Value</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Amount ($)</th><th scope="col" class="govuk-table__header">Status</th><th scope="col" class="govuk-table__header">Box and decision</th>
          </tr></thead>
          <tbody class="govuk-table__body">
${vrows}
          </tbody>
        </table>
      </div>
      </div>
      ${keysTable(KEYS_STD)}
    </section>`
  const tabs = [{ href: 'index.html', text: 'Cite figures', route: 'cite' }, { href: 'index.html?tab=verify', text: 'Verify values', route: 'verify' }]
  w('b-tabs-and-decision/index.html', shell({ file: 'index.html', title: 'Cite figures', tabs, work, pane: true, scripts: ['work.js', 'v2.js'], parts: '../../../parts/cite-or-reason/' }))
  try { fs.unlinkSync(path.join(out, 'b-tabs-and-decision/verify.html')) } catch { /* already gone */ }
}

// ---------- version C: window first ----------
{
  const L = lists.ops
  const rows = L.map((o) => {
    const st = o.src.length ? statusTag('govuk-tag--grey', 'Not checked') : statusTag('govuk-tag--orange', 'Not checked: no evidence')
    const complete = o.src.length ? `<button type="button" class="govuk-button app-button-compact" data-act="done">Complete<span class="govuk-visually-hidden"> ${esc(o.name)}</span></button>` : ''
    return `          <tr class="govuk-table__row" data-item="${o.id}">
            <th scope="row" class="govuk-table__header">${esc(o.name)}<span class="govuk-hint govuk-!-margin-bottom-0 app-what">${esc(o.what)}</span></th>
            <td class="govuk-table__cell" data-status>${st}</td>
            <td class="govuk-table__cell"><div class="app-actions">${openBtn(o, o.src.length)}${complete}<button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-act="chase">Chase<span class="govuk-visually-hidden"> the client about ${esc(o.name)}</span></button></div></td>
          </tr>`
  }).join('\n')
  const work = `    <section class="app-split__work" aria-label="Items to check" tabindex="0">
      <div class="app-worktop"><h1 class="govuk-heading-m">Check items</h1>
      <p class="govuk-body" data-count="items-left" data-scope="items"><span id="sv-left">${L.length}</span> of ${L.length} items still to check.</p></div>
      <p class="govuk-body app-done" id="sv-done" tabindex="-1" hidden>All items checked. Every item has a decision.</p>
      ${winStrip}
      <section class="app-summary-strip app-summary-strip--window" id="sv-summary" aria-label="The source now open"></section>
      ${filterHtml(L.length, 'items', 'ops')}
      ${tableOpen('Items table', 'Documents and CRA captures for this return')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">
            <th scope="col" class="govuk-table__header">Item</th><th scope="col" class="govuk-table__header">Status</th><th scope="col" class="govuk-table__header">Sources and decision</th>
          </tr></thead>
          <tbody class="govuk-table__body">
${rows}
          ${noMatch(3)}
          </tbody>
        </table>
      </div>
      ${keysTable(KEYS_STD.filter((k) => k[0] !== 'j' && k[0] !== 'k').concat([['j', 'Next item, and show its sources'], ['k', 'Previous item']]))}
    </section>`
  const tabs = [{ href: 'index.html', text: 'Check items' }]
  w('c-window-first/index.html', shell({ file: 'index.html', title: 'Check items', tabs, work, pane: true, scripts: ['work.js', 'v3.js'] }))
}

// ---------- the second window page, one per version; one layout (the numbered strip) for all ----------
function windowPage(dir, list) {
  const work = `    <div class="app-summary-strip app-summary-strip--window-top">
      <h1 class="govuk-heading-s">Source window</h1>
      <div class="govuk-checkboxes govuk-checkboxes--small">
        <div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-follow" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="sv-follow">Follow the work page</label></div>
      </div>
      <p id="sv-win-msg" role="status"></p>
      <details class="govuk-details app-keys-inline">
        <summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts</span></summary>
        <div class="govuk-details__text">
          <p class="govuk-body"><span class="app-key">]</span> next source. <span class="app-key">[</span> previous source. <span class="app-key">+</span> zoom in. <span class="app-key">-</span> zoom out. <span class="app-key">0</span> fit the box. The work page moves between figures.</p>
          <div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-keys-off">Turn off single-key shortcuts</label></div></div>
        </div>
      </details>
    </div>
    <div id="sv-root" class="app-viewer-root"></div>`
  w(`${dir}/window.html`, shell({ file: 'window.html', title: 'Source window', tabs: [], work, scripts: ['window.js', `win-${dir[0]}.js`], win: true, recordTabs: false }))
  w(`assets/win-${dir[0]}.js`, `(function () { window.SV.initWindow({ list: '${list}', title: ${JSON.stringify(IDENT)}, workUrl: 'index.html' }) })()\n`)
}
windowPage('a-docked-strip', 'cpa')
windowPage('b-tabs-and-decision', 'prep')
windowPage('c-window-first', 'ops')

// ---------- signed out ----------
w('signed-out.html', `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
  <meta charset="utf-8">
  <title>You have signed out - Ashbridge Tax</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="assets/govuk-moj.css">
  <link rel="stylesheet" href="assets/app.css">
</head>
<body class="govuk-template__body">
  <a href="#main" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
  <header><div class="govuk-generic-header"><div class="govuk-generic-header__container app-wide"><div class="govuk-generic-header__logo"><a href="index.html" class="govuk-generic-header__homepage-link app-brand">${LOGO}<span>Ashbridge Tax</span></a></div></div></div></header>
  <div class="govuk-width-container"><main id="main" class="govuk-main-wrapper" tabindex="-1">
    <h1 class="govuk-heading-l">You have signed out</h1>
    <p class="govuk-body">Every window of this system closed or came here with it, so no source stays open on any screen.</p>
    <p class="govuk-body"><a class="govuk-link" href="index.html">Back to the prototype list</a></p>
  </main></div>
</body>
</html>
`)

// ---------- landing page for the sitting ----------
const ver = [
  ['a-docked-strip', 'A. Docked pane with numbered steps (the base component)', 'The CPA review. A record page with the figures at the left and the viewer docked at the right. Sources are numbered steps above the card; the CPA marks each source as supporting the figure with a button or the key m, and the viewer moves on.'],
  ['b-tabs-and-decision', 'B. Source tabs and the decision slot', 'The preparer\'s workbench. The same viewer with the sources as MOJ sub navigation tabs. A figure with no source shows candidate sources with the picker (cite the one shown, or write a reason) in the decision slot. A second record tab verifies extracted values, and is a client route on the same page.'],
  ['c-window-first', 'C. Window first, for two monitors', 'Ops checks. Complete and Chase sit in the decision slot and in the row. The viewer lives in its own window when that is open: the pane hides and the list takes the full width. With no second window, the same viewer docks at the right.'],
]
w('index.html', `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
  <meta charset="utf-8">
  <title>Source viewer prototypes (D03) - Ashbridge Tax</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="assets/govuk-moj.css">
  <link rel="stylesheet" href="assets/app.css">
</head>
<body class="govuk-template__body" data-signed-out="signed-out.html">
  <a href="#main" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
  <header><div class="govuk-generic-header"><div class="govuk-generic-header__container app-wide"><div class="govuk-generic-header__logo"><span class="govuk-generic-header__homepage-link app-brand">${LOGO}<span>Ashbridge Tax</span></span></div></div></div></header>
  <div class="govuk-width-container"><main id="main" class="govuk-main-wrapper" tabindex="-1">
    <h1 class="govuk-heading-l">Source viewer prototypes (D03)</h1>
    <p class="govuk-body">One viewer for every family. A is the base component; B supplies the decision slot and C the window-first behaviour. Each version shows the seven source kinds, the step through several sources of one figure, the viewer beside a work list and in a second window that follows every selection. Made-up data: ${esc(client.name)}.</p>
${ver.map((v) => `    <h2 class="govuk-heading-m">${v[1]}</h2>
    <p class="govuk-body">${v[2]}</p>
    <ul class="govuk-list govuk-list--bullet">
      <li><a class="govuk-link" href="${v[0]}/index.html">Work page with the viewer docked</a></li>
${v[0] === 'b-tabs-and-decision' ? '      <li><a class="govuk-link" href="b-tabs-and-decision/index.html?tab=verify">Verify extracted values (the second record tab)</a></li>\n' : ''}      <li><a class="govuk-link" href="${v[0]}/window.html">The second window on its own</a></li>
    </ul>`).join('\n')}
    <h2 class="govuk-heading-m">States to try</h2>
    <ul class="govuk-list govuk-list--bullet">
      <li><a class="govuk-link" href="a-docked-strip/index.html?item=f1&amp;src=1">Normal: a figure with five sources, one of each of five kinds</a></li>
      <li><a class="govuk-link" href="a-docked-strip/index.html?item=f4">Flagged: evidence for the flag, then the figure's own source</a></li>
      <li><a class="govuk-link" href="a-docked-strip/index.html?item=f7">Empty: not checked, no evidence</a></li>
      <li><a class="govuk-link" href="a-docked-strip/index.html?item=f8">Error: the page image fails first and loads on Try again</a></li>
      <li><a class="govuk-link" href="a-docked-strip/index.html?item=f5">Masked: the T5 slip with SIN and date of birth blacked out in the image</a></li>
      <li><a class="govuk-link" href="b-tabs-and-decision/index.html?item=p1">Orphan with candidates and the picker (RV-22)</a></li>
    </ul>
  </main></div>
  <script src="assets/signout.js"></script>
</body>
</html>
`)
console.log('built')
