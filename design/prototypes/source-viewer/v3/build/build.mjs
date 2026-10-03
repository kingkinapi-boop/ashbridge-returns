// Builds the static pages of source viewer prototype v3 (D03, version "B+"). Run: node design/prototypes/source-viewer/v3/build/build.mjs
// The pages are plain HTML; this script only keeps figures, counts and links in step with reference/sample-clients.
// Everything the viewer draws comes from static/viewer.js: no page draws its own viewer.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sources, lists, client, people, today, story } from './data.mjs'
import { statementP2, statementP3, t5Draft } from './svg.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, '..')
const w = (rel, text) => { const p = path.join(out, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text) }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

// ---------- static files ----------
w('static/pages/lakeview-dec-p2.svg', statementP2())
w('static/pages/lakeview-dec-p3.svg', statementP3())
w('static/pages/t5-draft.svg', t5Draft())
w('static/data.js', `window.SV_DATA = ${JSON.stringify({ base: 'static/', sources, lists, client, people, today, story })};\n`)

const IDENT = `${client.name}, year end ${client.ye}`
const LOGO = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="6" fill="#ffffff"/><path d="M6 25 L16 6 L26 25 M10.5 19 H21.5" fill="none" stroke="#355b7d" stroke-width="3" stroke-linejoin="round"/></svg>`
const PARTS = '../../../parts/cite-or-reason/'

const TABS = [
  { id: 'workbench', text: 'Workbench', h1: 'Cite figures', person: 'anita', filter: 'figures', list: 'prep' },
  { id: 'review', text: 'Review', h1: 'Review figures', person: 'dev', filter: 'figures', list: 'cpa' },
  { id: 'documents', text: 'Documents', h1: 'Verify extracted values', person: 'anita', filter: 'values', list: 'verify' },
  { id: 'exceptions', text: 'Exceptions', h1: 'Judge accepted risks', person: 'dev', filter: 'exceptions', list: 'risks' },
  { id: 'ops', text: 'Ops', h1: 'Check items', person: 'sam', filter: 'items', list: 'ops' },
]

// ---------- small helpers ----------
const tagH = (cls, text) => `<strong class="govuk-tag ${cls}">${esc(text)}</strong>`
const btn = (label, extra = '') => `<button type="button" class="govuk-button govuk-button--secondary app-button-compact" ${extra}>${label}</button>`
const openBtn = (item, label) => `<button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-open aria-controls="source-pane" aria-keyshortcuts="o">${label}<span class="govuk-visually-hidden"> for ${esc(item.name)}</span></button>`
const tableOpen = (label, caption) => `<div class="app-scroll" role="region" aria-label="${label}, scrolls sideways on a small screen" tabindex="0">
        <table class="govuk-table app-table-dense">
          <caption class="govuk-table__caption govuk-visually-hidden">${caption}</caption>`
const th = (t, num = false) => `<th scope="col" class="govuk-table__header${num ? ' govuk-table__header--numeric' : ''}">${t}</th>`
const keysRows = [
  ['m', 'Next number: the next row of the list, with its sources shown'],
  ['n', 'Next flag: the next row flagged for a person, in the lists that have flags'],
  ['p', 'Previous flag'],
  ['o', 'Open the source of the number you are on, in the second window when that is on'],
  [']', 'Next source of the figure. An adjusting entry\'s own sources come in turn'],
  ['[', 'Previous source of the figure'],
  ['s', 'Search: move to the search box at the top'],
  ['Esc', 'Return focus to the figure you came from. On a small screen, back to the list'],
]
const keysTable = () => `<details class="govuk-details govuk-!-margin-top-4">
      <summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts and prototype settings</span></summary>
      <div class="govuk-details__text">
        <table class="govuk-table app-table-dense">
          <caption class="govuk-table__caption govuk-table__caption--s">Keyboard shortcuts (each repeats a visible control)</caption>
          <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Key')}${th('What it does')}</tr></thead>
          <tbody class="govuk-table__body">
${keysRows.map((r) => `            <tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><span class="app-key">${r[0]}</span></th><td class="govuk-table__cell">${r[1]}</td></tr>`).join('\n')}
          </tbody>
        </table>
        <p class="govuk-body-s">Keys that decide something, such as Approve and the review mark, belong to the Review page and are not part of the viewer.</p>
        <div class="govuk-form-group">
          <div class="govuk-checkboxes govuk-checkboxes--small">
            <div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-keys-off">Turn off single-key shortcuts</label></div>
            <div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-slow" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-slow">Prototype only: load page images slowly (1.5 seconds) to see the loading state</label></div>
          </div>
        </div>
      </div>
    </details>`

// ---------- the five panels (each a tab of the one return record) ----------
const prepTags = (f) => {
  const cited = f.src.length > 0
  const t = [tagH(cited ? 'govuk-tag--green' : 'govuk-tag--orange', cited ? 'Cited' : f.cand ? 'Not cited' : 'Needs a reason')]
  if (f.flag) t.push(tagH('govuk-tag--red', 'Flagged for a person'))
  return t.join(' ')
}
const prepRow = (f) => {
  const label = f.src.length ? `Sources (${f.src.length})` : f.cand ? `Candidates (${f.cand.length})` : 'Cell facts'
  const hint = f.cls === 'orphan' || f.cls === 'cited' ? '' : `<span class="app-what">${esc(f.cls)}</span>`
  return `          <tr class="govuk-table__row" data-item="${f.id}" data-list="prep"${f.flag ? ' data-flagged' : ''}>
            <td class="govuk-table__cell">${esc(f.line)}</td>
            <th scope="row" class="govuk-table__header">${esc(f.name)}${hint}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${f.amount}</td>
            <td class="govuk-table__cell" data-status>${prepTags(f)}</td>
            <td class="govuk-table__cell">${openBtn(f, label)}</td>
          </tr>`
}
const cpaTagsInit = (f) => {
  const t = []
  if (f.flag) t.push(tagH('govuk-tag--red', 'Flagged for a person'))
  if (!f.src.length) { if (!f.flag) t.push(tagH('govuk-tag--orange', 'Not checked: no evidence')) } else if (!f.flag) t.push(tagH('govuk-tag--grey', 'Not started'))
  return t.join(' ')
}
const cpaRow = (f) => `          <tr class="govuk-table__row" data-item="${f.id}" data-list="cpa"${f.flag ? ' data-flagged' : ''}>
            <td class="govuk-table__cell">${esc(f.line)}</td>
            <th scope="row" class="govuk-table__header">${esc(f.name)}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${f.amount}</td>
            <td class="govuk-table__cell" data-status>${cpaTagsInit(f)}</td>
            <td class="govuk-table__cell">${openBtn(f, `Sources (${f.src.length})`)}</td>
          </tr>`
const verifyRow = (v) => `          <tr class="govuk-table__row" data-item="${v.id}" data-list="verify">
            <th scope="row" class="govuk-table__header">${esc(v.name)}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${v.amount}</td>
            <td class="govuk-table__cell" data-status>${tagH('govuk-tag--grey', 'Not checked')}</td>
            <td class="govuk-table__cell"><div class="app-actions">${openBtn(v, 'Show the box')}</div></td>
          </tr>`
const ANSWER = { accepted: ['govuk-tag--yellow', 'Accepted risk'], explained: ['govuk-tag--turquoise', 'Explained'], fixed: ['govuk-tag--green', 'Fixed'] }
const riskRow = (x) => `          <tr class="govuk-table__row" data-item="${x.id}" data-list="risks"${x.answer === 'accepted' ? ' data-flagged' : ''}>
            <th scope="row" class="govuk-table__header">${esc(x.name)}<span class="app-what">${x.flagId}</span></th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${x.amount}</td>
            <td class="govuk-table__cell" data-status><span class="govuk-visually-hidden">Preparer's answer: </span>${tagH(...ANSWER[x.answer])} <span class="govuk-visually-hidden">CPA judgment: </span>${tagH('govuk-tag--grey', x.answer === 'accepted' ? 'Not judged' : 'Nothing to judge')}</td>
            <td class="govuk-table__cell"><div class="app-actions">${openBtn(x, `Sources (${x.src.length})`)}</div></td>
          </tr>`
const opsRow = (o) => `          <tr class="govuk-table__row" data-item="${o.id}" data-list="ops">
            <th scope="row" class="govuk-table__header">${esc(o.name)}</th>
            <td class="govuk-table__cell" data-status>${o.src.length ? tagH('govuk-tag--grey', 'Not checked') : tagH('govuk-tag--orange', 'Not checked: no evidence')}</td>
            <td class="govuk-table__cell"><div class="app-actions">${openBtn(o, o.src.length ? `Sources (${o.src.length})` : 'The item')}</div></td>
          </tr>`
const changedRow = (g) => `          <tr class="govuk-table__row" data-item="${g.id}" data-list="changed">
            <td class="govuk-table__cell">${g.line}</td>
            <th scope="row" class="govuk-table__header">${esc(g.name)}</th>
            <td class="govuk-table__cell govuk-table__cell--numeric">${g.amount}</td>
            <td class="govuk-table__cell govuk-table__cell--numeric">${g.was}</td>
            <td class="govuk-table__cell">${openBtn(g, 'Show the change')}</td>
          </tr>`

const P = lists.prep, C = lists.cpa, V = lists.verify, X = lists.risks, O = lists.ops
const needCite = P.filter((f) => !f.src.length).length
const accepted = X.filter((x) => x.answer === 'accepted').length
const flaggedCpa = C.filter((f) => f.flag).length, noEvidenceCpa = C.filter((f) => !f.src.length).length

function panels(active) {
  const hid = (id) => (id === active ? '' : ' hidden')
  return `      <div data-panel="workbench"${hid('workbench')}>
        <p class="govuk-body app-counts" data-count="figures-to-cite" data-scope="figures"><span id="sv-left-cite">${needCite}</span> of ${P.length} figures need a source or a reason.</p>
        <p class="govuk-body app-recorded" id="sv-recorded" role="status" tabindex="-1" hidden></p>
        <p class="govuk-body app-done" id="sv-done-workbench" tabindex="-1" hidden>Every figure has a source or a reason.</p>
        <section data-void-only data-nofilter hidden aria-labelledby="sv-changed-h">
          <h2 class="govuk-heading-s app-section-h" id="sv-changed-h">Changed since approval, ${lists.changed.length} cells</h2>
          ${tableOpen('Changed cells table', 'Cells that changed after approval, with the value now and the value approved')}
            <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Line')}${th('Figure')}${th('Now ($)', true)}${th('Approved ($)', true)}${th('Sources')}</tr></thead>
            <tbody class="govuk-table__body">
${lists.changed.map(changedRow).join('\n')}
            </tbody>
          </table>
          </div>
        </section>
        ${tableOpen('Figures table', 'Figures in return order. Orphans and tax choices need a citation; overridden and dropped cells need a reason.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Line')}${th('Figure')}${th('Amount ($)', true)}${th('Status')}${th('Sources')}</tr></thead>
          <tbody class="govuk-table__body">
${P.map(prepRow).join('\n')}
          </tbody>
        </table>
        </div>
      </div>
      <div data-panel="review"${hid('review')}>
        <p class="govuk-body app-counts" data-count="figures-ticked" data-scope="figures"><span id="sv-ticked">0</span> of ${C.length} figures ticked. ${flaggedCpa} flagged for a person. ${noEvidenceCpa} with no evidence.</p>
        <p class="govuk-body app-done" id="sv-done-review" tabindex="-1" hidden>Every figure with a source has all its sources ticked. A tick is your place, not a review mark. Figures with no evidence stay as they are.</p>
        ${tableOpen('Figures table', 'Figures in return order. Each is checked against its sources.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Line')}${th('Figure')}${th('Amount ($)', true)}${th('Status')}${th('Sources')}</tr></thead>
          <tbody class="govuk-table__body">
${C.map(cpaRow).join('\n')}
          </tbody>
        </table>
        </div>
      </div>
      <div data-panel="documents"${hid('documents')}>
        <p class="govuk-body app-counts" data-count="values-open" data-scope="values"><span id="sv-left-verify">${V.length}</span> of ${V.length} values not checked.</p>
        <p class="govuk-body app-done" id="sv-done-documents" tabindex="-1" hidden>Every value is checked. Rejected values go back for extraction again.</p>
        ${tableOpen('Values table', 'Values read from the documents. Compare each with the words inside its box.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Value')}${th('Amount ($)', true)}${th('Status')}${th('Box')}</tr></thead>
          <tbody class="govuk-table__body">
${V.map(verifyRow).join('\n')}
          </tbody>
        </table>
        </div>
      </div>
      <div data-panel="exceptions"${hid('exceptions')}>
        <p class="govuk-body app-counts" data-count="risks-open" data-scope="accepted risks"><span id="sv-left-risks">${accepted}</span> of ${accepted} accepted risks not judged. ${X.length} exceptions in all.</p>
        <p class="govuk-body app-done" id="sv-done-exceptions" tabindex="-1" hidden>Every accepted risk is judged. <a class="govuk-link" href="review.html" data-route="review">Open the Review tab</a> for the first section not reviewed.</p>
        ${tableOpen('Exceptions table', 'Exceptions and the preparer\'s answer to each. The CPA judges the accepted risks.')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Exception')}${th('Amount ($)', true)}${th('Answer and judgment')}${th('Sources')}</tr></thead>
          <tbody class="govuk-table__body">
${X.map(riskRow).join('\n')}
          </tbody>
        </table>
        </div>
      </div>
      <div data-panel="ops"${hid('ops')}>
        <p class="govuk-body app-counts" data-count="items-left" data-scope="items"><span id="sv-left-ops">${O.length}</span> of ${O.length} items still to check.</p>
        <p class="govuk-body app-done" id="sv-done-ops" tabindex="-1" hidden>All items checked. Every item has a decision.</p>
        ${tableOpen('Items table', 'Documents and CRA captures for this return')}
          <thead class="govuk-table__head"><tr class="govuk-table__row">${th('Item')}${th('Status')}${th('Sources')}</tr></thead>
          <tbody class="govuk-table__body">
${O.map(opsRow).join('\n')}
          </tbody>
        </table>
        </div>
      </div>`
}

// ---------- the shell: header with search, the return (identity bar, record tabs), main ----------
function head({ search = true, home = 'index.html' }) {
  return `  <header>
    <div class="govuk-generic-header">
      <div class="govuk-generic-header__container app-wide app-header-row">
        <div class="govuk-generic-header__logo">
          <a href="${home}" class="govuk-generic-header__homepage-link app-brand">${LOGO}<span>Ashbridge Tax</span></a>
        </div>${search ? `
        <form class="moj-search app-header-search" role="search" action="search.html" method="get">
          <div class="govuk-form-group">
            <label class="govuk-label moj-search__label" for="sv-search">Search<span class="govuk-visually-hidden"> figures, values, exceptions, items and sources</span></label>
            <div class="moj-search__input-wrapper">
              <input class="govuk-input moj-search__input" id="sv-search" name="q" type="search" autocomplete="off" spellcheck="false" aria-keyshortcuts="s">
              <button type="submit" class="govuk-button moj-search__button" data-module="govuk-button">Search</button>
            </div>
          </div>
        </form>` : ''}
      </div>
    </div>
  </header>`
}
function returnBar({ tabs = true, active = '', person }) {
  const p = people[person]
  const tabHtml = TABS.map((t) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${t.id}.html" data-route="${t.id}"${t.id === active ? ' aria-current="page"' : ''}>${t.text}</a></li>`).join('\n        ')
  return `  <div role="region" aria-label="Return" class="app-return">
    <div class="moj-identity-bar app-wide" data-identity-bar>
      <div class="moj-identity-bar__container">
        <div class="moj-identity-bar__details"><span class="moj-identity-bar__title">${esc(IDENT)}</span></div>
        <div class="moj-identity-bar__actions"><span class="app-bar-who">Signed in: ${esc(p.name)}, ${p.role}</span> <a class="govuk-link govuk-link--no-visited-state app-bar-link" id="sv-signout" href="signed-out.html">Sign out</a></div>
      </div>
    </div>${tabs ? `
    <nav class="moj-sub-navigation app-wide" aria-label="Return record">
      <ul class="moj-sub-navigation__list">
        ${tabHtml}
      </ul>
    </nav>` : ''}
  </div>`
}
function doc({ title, bodyAttr = '', bodyClass = '', body, scripts = [], css = [] }) {
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
  <meta charset="utf-8">
  <title>${esc(title)} - Ashbridge Tax</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="static/govuk-moj.css">
  <link rel="stylesheet" href="static/app.css">${css.map((c) => `\n  <link rel="stylesheet" href="${c}">`).join('')}
</head>
<body class="govuk-template__body${bodyClass}"${bodyAttr}>
  <script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
  <a href="#main" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
  <div id="sv-live" class="govuk-visually-hidden" role="status" aria-live="polite"></div>
${body}
${scripts.map((s) => `  <script src="${s}"></script>`).join('\n')}
</body>
</html>
`
}

// ---------- the five record pages: every file holds all five panels; a tab change is a client route ----------
const alertSvg = '<svg class="moj-alert__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" height="30" width="30" aria-hidden="true" focusable="false"><path d="M20.1 26.5H9.9c-.9 0-1.5-.9-1.1-1.7L13.9 5.2c.4-.8 1.6-.8 2 0l5.1 19.6c.4.8-.2 1.7-1.1 1.7z" fill="currentcolor"/></svg>'
const voidAlert = `    <div class="moj-alert moj-alert--warning app-void" role="region" aria-label="Approval void" data-module="moj-alert" data-void-only hidden>
      <div>${alertSvg}</div>
      <div class="moj-alert__content"><strong>Approval void.</strong> The books changed after approval on ${story.approvedDay}; the return is back in trace and there is nothing to decide here.
        <span data-void-note="workbench">The changed cells are below.</span><span data-void-note="other" hidden>The changed cells are on the <a class="govuk-link" href="workbench.html?state=void" data-route="workbench">Workbench tab</a>.</span></div>
    </div>
`
function recordPage(tab) {
  const t = TABS.find((x) => x.id === tab)
  const nouns = { workbench: 'number', review: 'number', documents: 'value', exceptions: 'exception', ops: 'item' }
  const n = lists[t.list].length
  const body = `  <div class="app-split" id="app-split" data-view="list">
  <div class="app-split__left">
${head({})}
${returnBar({ active: tab, person: t.person })}
  <main id="main" tabindex="-1">
${voidAlert}    <section class="app-split__work" aria-label="Work on this return" tabindex="0">
      <div class="app-headline">
        <h1 class="govuk-heading-m app-h1" id="sv-h1" tabindex="-1">${t.h1}</h1>
        <div class="app-filter">
          <label class="govuk-label" for="sv-filter" id="sv-filter-label">Filter<span class="govuk-visually-hidden"> ${t.filter}</span></label>
          <input class="govuk-input" id="sv-filter" type="search" autocomplete="off" spellcheck="false">
          <p class="govuk-hint" id="sv-filter-count" data-count="shown-${tab}" data-scope="of">Showing ${n} of ${n}</p>
        </div>
      </div>
      <div class="app-tools">
        <div class="app-navbar" role="group" aria-label="Move through the list">
          <button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-fig-nav="1" aria-keyshortcuts="m">Next <span data-noun>${nouns[tab]}</span> <span class="app-key" aria-hidden="true">m</span></button>
          <button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-flag-nav="-1" aria-keyshortcuts="p"${['workbench', 'review', 'exceptions'].includes(tab) ? '' : ' hidden'}>Previous flag <span class="app-key" aria-hidden="true">p</span></button>
          <button type="button" class="govuk-button govuk-button--secondary app-button-compact" data-flag-nav="1" aria-keyshortcuts="n"${['workbench', 'review', 'exceptions'].includes(tab) ? '' : ' hidden'}>Next flag <span class="app-key" aria-hidden="true">n</span></button>
        </div>
        <div class="app-winctl" role="group" aria-label="Second window">
          <button type="button" id="sv-open-window" class="govuk-button govuk-button--secondary app-button-compact">Open in a second window</button>
          <div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-win-pref" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-win-pref">Every time<span class="govuk-visually-hidden"> I show a source, use a second window</span></label></div></div>
          <p class="app-win-status" id="sv-win-status" role="status">Second window: off. Sources show beside the list.</p>
        </div>
      </div>
      <div id="sv-winslot" class="app-winslot" role="group" aria-label="Decision, with the source in the second window" hidden></div>
${panels(tab)}
      <p class="govuk-body" id="sv-filter-none" hidden>Nothing matches that filter. Clear the filter to see every row.</p>
      ${keysTable()}
    </section>
  </main>
  </div>
  <div id="source-pane" class="app-split__pane" role="region" aria-label="Source viewer">
    <div id="app-splitter" class="app-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize the source pane. Left arrow widens it, right arrow narrows it" aria-controls="sv-root" aria-valuemin="360" aria-valuemax="800" aria-valuenow="480"></div>
    <div id="sv-root" class="app-viewer-root"></div>
  </div>
  </div>`
  w(`${tab}.html`, doc({
    title: `${t.h1}, ${IDENT}`, bodyClass: ' app-shell', bodyAttr: ` data-signed-out="signed-out.html" data-person="${t.person}" data-tab="${tab}"`, body,
    css: [`${PARTS}cite-or-reason.css`],
    scripts: ['static/signout.js', 'static/data.js', 'static/viewer.js', `${PARTS}cite-or-reason.js`, 'static/work.js', 'static/hosts.js'],
  }))
}
for (const t of TABS) recordPage(t.id)

// ---------- the second window: the same viewer as a full page ----------
w('window.html', doc({
  title: `Source window, ${IDENT}`, bodyClass: ' app-shell app-shell--stack', bodyAttr: ' data-signed-out="signed-out.html" data-person="anita"',
  body: `${head({ search: false })}
${returnBar({ tabs: false, person: 'anita' })}
  <main id="main" tabindex="-1" class="app-window-main">
    <div class="app-summary-strip app-summary-strip--window-top">
      <h1 class="govuk-heading-s">Source window</h1>
      <div class="govuk-checkboxes govuk-checkboxes--small">
        <div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-follow" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="sv-follow">Follow the work page</label></div>
      </div>
      <p id="sv-win-msg" role="status"></p>
      <details class="govuk-details app-keys-inline">
        <summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts</span></summary>
        <div class="govuk-details__text">
          <p class="govuk-body"><span class="app-key">]</span> next source. <span class="app-key">[</span> previous source. <span class="app-key">Esc</span> back to the Follow box. The work page moves between figures and holds the decision.</p>
          <div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sv-keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="sv-keys-off">Turn off single-key shortcuts</label></div></div>
        </div>
      </details>
    </div>
    <div id="sv-root" class="app-viewer-root"></div>
  </main>`,
  scripts: ['static/signout.js', 'static/data.js', 'static/viewer.js', 'static/window.js'],
}))

// ---------- search results (header search, rule 21) ----------
w('search.html', doc({
  title: `Search results, ${IDENT}`, bodyClass: ' app-shell app-shell--page', bodyAttr: ' data-signed-out="signed-out.html" data-person="anita"',
  body: `${head({})}
  <div class="govuk-width-container app-results-wrap"><main id="main" class="govuk-main-wrapper app-results" tabindex="-1">
    <h1 class="govuk-heading-l">Search results</h1>
    <p class="govuk-body" id="sv-results-count" data-count="results" data-scope="result" role="status"></p>
    <div id="sv-results"></div>
    <p class="govuk-body"><a class="govuk-link" href="review.html">Back to the return record</a></p>
  </main></div>`,
  scripts: ['static/signout.js', 'static/data.js', 'static/viewer.js', 'static/search.js'],
}))

// ---------- signed out ----------
w('signed-out.html', doc({
  title: 'You have signed out', bodyClass: '', bodyAttr: '',
  body: `${head({ search: false })}
  <div class="govuk-width-container"><main id="main" class="govuk-main-wrapper" tabindex="-1">
    <h1 class="govuk-heading-l">You have signed out</h1>
    <p class="govuk-body">Every window of this system closed or came here with it, so no source stays open on any screen.</p>
    <p class="govuk-body"><a class="govuk-link" href="index.html">Back to the prototype list</a></p>
  </main></div>`,
  scripts: [],
}))

// ---------- the landing page for the sitting ----------
const st = [
  ['Normal: a figure with six sources of six kinds', 'review.html?item=f1&src=1', 'Due from shareholder: a QBO trial balance line, an adjusting entry, a QBO transaction, a bank page, a client answer and a written reason. Each header names the origin and the dot in words.'],
  ['An adjusting entry and its own sources as steps', 'review.html?item=f1&src=2.1', 'Source 2 is entry 01-AJE-01 with its type, reason and memo. Press ] to step through its seven sources: six card rows and the client\'s list.'],
  ['QBO line with its id', 'review.html?item=f1&src=3', 'A deposit with its QBO Transaction ID, date, type, number and memo, from the dated snapshot.'],
  ['QBO trial balance line (no id)', 'review.html?item=f1&src=1', 'A trial balance line names the snapshot and the account and says it carries no id.'],
  ['QBO line without an id (composite key)', 'review.html?item=f3&src=1', 'A General Ledger line with no id: the composite key and the flag for a person show at once, and the line comes first (TB-13).'],
  ['Flagged: the flag\'s own evidence first', 'review.html?item=f4&src=1', 'The client answer that raised the flag comes first, then the figure\'s own source.'],
  ['Empty: not checked, no evidence', 'review.html?item=f7', 'Capital dividend account: never blank, and the reason there is no source.'],
  ['Error: the page image fails, then loads', 'review.html?item=f8&src=1', 'Try again loads the image. The error summary names what happened.'],
  ['Masked: the T5 slip with SIN and date of birth blacked out', 'review.html?item=f5&src=1', 'The masking is in the image itself; the words say "SIN on file".'],
  ['CRA capture with its pull date', 'review.html?item=f9&src=1', 'An Auto-fill value shows when it was pulled (CK-12).'],
  ['Last year\'s return and assessment', 'review.html?item=f2&src=3', 'A cell of the filed return, grey: one third-party source.'],
  ['Candidates: exact value first, rounds apart, none chosen', 'workbench.html?item=c2', 'Taxes payable: the client\'s answer matches exactly; two captures round to the value. Nothing is preselected.'],
  ['Overridden cell: a reason only', 'workbench.html?item=c5', 'No candidate: the cell facts and one box for the reason.'],
  ['Verify an extracted value', 'documents.html?item=v1', 'The words inside the box beside Accept and Reject.'],
  ['Judge an accepted risk with its source open', 'exceptions.html?item=x2', 'One reason box, Accept the risk or Comment. Sign in as Dev Malhotra (Test) for the buttons.'],
  ['Check an item: Complete or Chase', 'ops.html?item=o1', 'Chase writes a dated staff note and sends nothing.'],
  ['Done rows with Undo that asks for a reason', 'ops.html?state=done&item=o2', 'Also on Documents, Exceptions, Workbench and Review with state=done.'],
  ['Approval void: the books changed after approval', 'workbench.html?state=void&item=g1', 'Snapshot value and re-read value with both dates, and nothing to decide.'],
  ['The same Workbench as another person', 'workbench.html?as=dev&item=c2', 'The remembered second-window choice and the actions follow the person.'],
]
const landRows = st.map((r) => `        <tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><a class="govuk-link" href="${r[1].replace(/&/g, '&amp;')}">${esc(r[0])}</a></th><td class="govuk-table__cell">${esc(r[2])}</td></tr>`).join('\n')
w('index.html', doc({
  title: 'Source viewer prototype, version B+ (D03)', bodyClass: '', bodyAttr: ' data-signed-out="signed-out.html"',
  body: `  <header><div class="govuk-generic-header"><div class="govuk-generic-header__container app-wide"><div class="govuk-generic-header__logo"><span class="govuk-generic-header__homepage-link app-brand">${LOGO}<span>Ashbridge Tax</span></span></div></div></div></header>
  <div class="govuk-width-container"><main id="main" class="govuk-main-wrapper" tabindex="-1">
    <h1 class="govuk-heading-l">Source viewer prototype, version B+ (D03)</h1>
    <p class="govuk-body">One viewer for every family, as chosen at design sitting 1: version B (sources as tabs, the decision beside the evidence) with A (keys, the "Supports" tick) and C (Complete with Undo, window first) folded in. It sits as a pane inside the return record, beside five record tabs, each a client route. Made-up data: ${esc(client.name)}.</p>
    <h2 class="govuk-heading-m">Pages</h2>
    <ul class="govuk-list govuk-list--bullet">
      <li><a class="govuk-link" href="workbench.html">Workbench</a>: cite a source or write a reason (preparer).</li>
      <li><a class="govuk-link" href="review.html?as=dev">Review</a>: check each figure against its sources and tick your place (CPA reviewer).</li>
      <li><a class="govuk-link" href="documents.html">Documents</a>: verify extracted values (preparer).</li>
      <li><a class="govuk-link" href="exceptions.html?as=dev">Exceptions</a>: judge accepted risks (CPA reviewer).</li>
      <li><a class="govuk-link" href="ops.html?as=sam">Ops</a>: complete or chase an item (Operations).</li>
      <li><a class="govuk-link" href="window.html">The second window on its own</a>, a full page. From any record tab, "Open in a second window" opens it and it follows every click.</li>
      <li><a class="govuk-link" href="search.html?q=meals">Search results</a>, from the search box at the top of every page.</li>
      <li><a class="govuk-link" href="signed-out.html">Signed out</a>, where every window goes on sign-out.</li>
    </ul>
    <h2 class="govuk-heading-m">States to try</h2>
    <table class="govuk-table app-table-dense">
      <caption class="govuk-table__caption govuk-visually-hidden">States of the viewer, each opened on the figure that shows it</caption>
      <thead class="govuk-table__head"><tr class="govuk-table__row">${th('State')}${th('What to look for')}</tr></thead>
      <tbody class="govuk-table__body">
${landRows}
      </tbody>
    </table>
    <h2 class="govuk-heading-m">The second window</h2>
    <p class="govuk-body">It opens only when you ask: the button "Open in a second window", the tick box beside it, or the key o. The tick box is remembered for each signed-in person (default off) and its state is written next to it. While the window is open and following, the list takes the full width and the decision sits above the list.</p>
  </main></div>
  <script src="static/signout.js"></script>`,
  scripts: [],
}))
console.log('built')
