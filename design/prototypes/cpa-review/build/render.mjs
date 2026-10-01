// Writes the static prototype pages for the CPA review family: three versions that differ in
// structure. Run: node design/prototypes/cpa-review/build/render.mjs
// Made-up data only (reference/sample-clients 01 and 08). No em dashes anywhere.
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { RETURNS, QUEUE } from './returns.mjs';

const OUT = new URL('../', import.meta.url).pathname;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const write = (p, s) => { mkdirSync(dirname(join(OUT, p)), { recursive: true }); if (/\u2014/.test(s)) throw new Error(`em dash in ${p}`); writeFileSync(join(OUT, p), s); };

export const VERSIONS = [
  { id: 'a', dir: 'a-record-tabs', layout: 'tabs', name: 'Version A: record page, tabs and three panes', short: 'Record page with tabs; return, trace and source side by side; the source can pop out to the second monitor.' },
  { id: 'b', dir: 'b-rail-split', layout: 'rail', name: 'Version B: coverage rail, list and detail', short: 'A rail of sections with their marks on the left; the section in the middle; trace above source on the right.' },
  { id: 'c', dir: 'c-two-monitors', layout: 'walk', name: 'Version C: return walk with the source on the second monitor', short: 'The return full width on the laptop with the trace opening under each line; the source lives in its own window on the second monitor.' },
];

const TIER_TAG = { red: 'govuk-tag--red', amber: 'govuk-tag--orange', green: 'govuk-tag--green' };
const DOT_WORDS = { green: 'Agrees', grey: 'Single source', amber: 'Client only', purple: 'Judgment', none: 'Not checked' };
const dot = (d, compact = false) => (compact ? `<span class="app-dot app-dot--compact app-dot--${d}" title="${DOT_WORDS[d]}"><span class="govuk-visually-hidden">${DOT_WORDS[d]}</span></span>` : `<span class="app-dot app-dot--${d}">${DOT_WORDS[d]}</span>`);
const tierTag = (t) => `<strong class="govuk-tag ${TIER_TAG[t]}">Tier: ${t}</strong>`;
const key = (k) => `<span class="app-key" aria-hidden="true">${esc(k)}</span>`;

function page({ v, depth, title, ret, body, pageData, active, wide = true, extraHead = '' }) {
  const up = '../'.repeat(depth);
  const r = ret ? RETURNS[ret] : null;
  const fullTitle = `${title}${r ? ` - ${r.name}, year end ${r.ye}` : ''} - Ashbridge Tax`;
  const nav = [['Review queue', `${up}queue.html`, 'queue'], ['Start of this version', `${up}index.html`, 'index'], ['All versions', `${up}../index.html`, 'all']];
  return `<!doctype html>
<html lang="en-CA" class="govuk-template">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap">
<link rel="stylesheet" href="${up}../shared/ashbridge.css">
${extraHead}</head>
<body class="govuk-template__body app-dense">
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
<div class="govuk-generic-header">
  <div class="govuk-generic-header__container govuk-width-container app-width-container--wide">
    <div class="govuk-generic-header__logo">
      <a href="${up}queue.html" class="govuk-generic-header__homepage-link">Ashbridge Tax</a>
    </div>
  </div>
</div>
<div class="govuk-service-navigation" data-module="govuk-service-navigation">
  <div class="govuk-width-container app-width-container--wide">
    <div class="govuk-service-navigation__container">
      <span class="govuk-service-navigation__service-name"><span class="govuk-service-navigation__text">Returns, CPA review</span></span>
      <nav aria-label="Menu" class="govuk-service-navigation__wrapper">
        <button type="button" class="govuk-service-navigation__toggle govuk-js-service-navigation-toggle" aria-controls="navigation" hidden aria-hidden="true">Menu</button>
        <ul class="govuk-service-navigation__list" id="navigation">
${nav.map(([t, h, id]) => `          <li class="govuk-service-navigation__item${active === id ? ' govuk-service-navigation__item--active' : ''}"><a class="govuk-service-navigation__link" href="${h}"${active === id ? ' aria-current="page"' : ''}>${active === id ? `<strong class="govuk-service-navigation__active-fallback">${t}</strong>` : t}</a></li>`).join('\n')}
        </ul>
      </nav>
    </div>
  </div>
</div>
<div class="govuk-width-container app-width-container--wide">
  <div class="govuk-phase-banner">
    <p class="govuk-phase-banner__content"><strong class="govuk-tag govuk-phase-banner__content__tag">Prototype</strong>
      <span class="govuk-phase-banner__text">Made-up data. ${esc(v.name)}. <a class="govuk-link" href="#" data-reset>Reset this prototype</a></span></p>
  </div>
</div>
${r ? identityBar(r) : ''}
<div class="${wide ? 'govuk-width-container app-width-container--wide' : 'govuk-width-container'}">
  <main class="govuk-main-wrapper govuk-!-padding-top-3" id="main-content">
${scrollTables(body)}
  </main>
</div>
<div class="govuk-visually-hidden" aria-live="polite" id="app-announce"></div>
<script>window.CPA_PAGE = ${JSON.stringify({ version: v.id, layout: v.layout, ...pageData })};</script>
${r ? `<script src="${up}../shared/data/${ret}.js"></script>` : ''}
${pageData && pageData.page === 'states' ? `<script src="${up}../shared/data/r01.js"></script>` : ''}
${pageData && pageData.page === 'viewer' ? Object.keys(RETURNS).map((id) => `<script src="${up}../shared/data/${id}.js"></script>`).join('\n') : ''}
<script src="${up}../shared/vendor/govuk-frontend.bundle.js"></script>
<script src="${up}../shared/vendor/moj-frontend.bundle.js"></script>
<script src="${up}../shared/app.js"></script>
</body>
</html>
`;
}

// Every table sits in a labelled region that scrolls sideways on a narrow screen (WCAG 1.4.10).
let tableN = 0;
function scrollTables(html) {
  return html.replace(/<table class="govuk-table([^"]*)"([^>]*)>\s*<caption class="([^"]*)">([\s\S]*?)<\/caption>/g, (m, cls, attrs, ccls, cap) => {
    tableN += 1;
    const label = cap.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return `<div class="app-table-scroll" role="region" aria-label="${label}, table" tabindex="0"><table class="govuk-table${cls}"${attrs}>\n  <caption class="${ccls}">${cap}</caption>`;
  }).replace(/<\/table>/g, '</table></div>');
}

function identityBar(r) {
  return `<div class="moj-identity-bar">
  <div class="moj-identity-bar__container govuk-width-container app-width-container--wide">
    <div class="moj-identity-bar__details">
      <span class="moj-identity-bar__title"><strong>${esc(r.name)}</strong>, year end ${esc(r.ye)} ${tierTag(r.tier)} <strong class="govuk-tag govuk-tag--blue">${esc(r.state)}</strong> <span class="govuk-body-s">Preparer: ${esc(r.preparer)}</span></span>
    </div>
  </div>
</div>`;
}

function keysDetails() {
  const rows = [['j', 'Next number (opens its trace and source)'], ['k', 'Previous number'], ['f', 'Next flag, red first then dollar effect'], ['Shift + f', 'Previous flag'], ['n', 'Next source'], ['p', 'Previous source'], ['c', 'Comment on the number'], ['m', 'Mark this section reviewed, or remove your mark'], [']', 'Next section'], ['[', 'Previous section'], ['w', 'Open the source in a second window'], ['a', 'Approve (only when every section is marked)'], ['?', 'Show these shortcuts']];
  return `<details class="govuk-details govuk-!-margin-bottom-2" id="app-keys">
  <summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts</span></summary>
  <div class="govuk-details__text">
    <table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Each key repeats a button on the page. Keys do nothing while you type in a box.</caption>
      <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Key</th><th scope="col" class="govuk-table__header">Does</th></tr></thead>
      <tbody class="govuk-table__body">${rows.map(([k, d]) => `<tr class="govuk-table__row"><td class="govuk-table__cell"><span class="app-key">${esc(k)}</span></td><td class="govuk-table__cell">${esc(d)}</td></tr>`).join('')}</tbody></table>
    <div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="app-shortcuts-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="app-shortcuts-off">Turn off single-key shortcuts</label></div></div>
  </div>
</details>`;
}

// ---- navigation per layout ----
function subNav(r, current) {
  const items = [['brief', 'Brief', '']];
  if (r.rework) items.push(['changes', 'Changes after rework', `<span class="moj-badge moj-badge--red">${r.rework.changed.length}<span class="govuk-visually-hidden"> changed numbers</span></span>`]);
  for (const s of r.sections) items.push([s.id, s.title, `<span data-nav-mark="${s.id}"><span aria-hidden="true">\u25CB</span><span class="govuk-visually-hidden">, not reviewed</span></span>`]);
  items.push(['flags', 'Flags', `<span class="moj-badge">${r.flags.length}<span class="govuk-visually-hidden"> flags</span></span>`], ['comments', 'Comments', ''], ['history', 'History', '']);
  return `<nav class="moj-sub-navigation" aria-label="Return sections and tabs">
  <ul class="moj-sub-navigation__list">
${items.map(([id, t, extra]) => `    <li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" ${current === id ? 'aria-current="page" ' : ''}href="${id}.html">${esc(t)} ${extra}</a></li>`).join('\n')}
  </ul>
</nav>
<p class="govuk-body-s govuk-!-margin-bottom-1" aria-hidden="true">Tabs: \u2713 reviewed, \u25CB not reviewed, \u26A0 mark removed.</p>`;
}
function walkNav(r, current) {
  const isSection = r.sections.some((s) => s.id === current);
  const items = [['brief', 'Brief'], ...(r.rework ? [['changes', 'Changes after rework']] : []), [r.sections[0].id, 'Walk the return'], ['flags', `Flags (${r.flags.length})`], ['comments', 'Comments'], ['history', 'History']];
  return `<nav class="moj-sub-navigation" aria-label="Return tabs">
  <ul class="moj-sub-navigation__list">
${items.map(([id, t]) => { const on = current === id || (isSection && t === 'Walk the return'); return `    <li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" ${on ? 'aria-current="page" ' : ''}href="${id}.html">${esc(t)}</a></li>`; }).join('\n')}
  </ul>
</nav>`;
}
function rail(r, current) {
  const item = (id, t, extra = '') => `<li class="moj-side-navigation__item${current === id ? ' moj-side-navigation__item--active' : ''}"><a href="${id}.html"${current === id ? ' aria-current="location"' : ''}>${esc(t)} ${extra}</a></li>`;
  return `<nav class="moj-side-navigation" aria-label="Return">
  <h2 class="moj-side-navigation__title">Return</h2>
  <ul class="moj-side-navigation__list">${item('brief', 'Brief')}${r.rework ? item('changes', 'Changes after rework', `<span class="moj-badge moj-badge--red">${r.rework.changed.length}</span>`) : ''}</ul>
  <h2 class="moj-side-navigation__title">Sections, in order</h2>
  <ul class="moj-side-navigation__list">${r.sections.map((s, i) => item(s.id, `${i + 1}. ${s.title}`, `<br><span data-nav-status="${s.id}" class="govuk-tag govuk-tag--grey">Not reviewed</span>`)).join('')}</ul>
  <h2 class="moj-side-navigation__title">Also</h2>
  <ul class="moj-side-navigation__list">${item('flags', `Flags (${r.flags.length})`)}${item('comments', 'Comments')}${item('history', 'History')}</ul>
</nav>`;
}

// ---- shared blocks ----
function sixTable(r, rework) {
  return `<table class="govuk-table govuk-!-margin-bottom-3">
  <caption class="govuk-table__caption govuk-table__caption--s">The return in six numbers <span class="govuk-hint govuk-!-display-inline">(tax from Taxprep; here prototype figures, not tax-checked)</span></caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">This year</th>${rework ? '<th scope="col" class="govuk-table__header govuk-table__header--numeric">Before rework</th>' : ''}<th scope="col" class="govuk-table__header govuk-table__header--numeric">Last year</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Change</th></tr></thead>
  <tbody class="govuk-table__body">
${r.six.map((x) => { const sec = x.line ? x.line.split('-')[0] : null; return `    <tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${x.line ? `<a class="govuk-link" href="${sec}.html#l=${x.line}">${esc(x.label)}</a>` : esc(x.label)}</th><td class="govuk-table__cell govuk-table__cell--numeric"><strong>${esc(x.v)}</strong></td>${rework ? `<td class="govuk-table__cell govuk-table__cell--numeric">${esc(r.rework.sixBefore[x.label] === x.v ? 'same' : r.rework.sixBefore[x.label])}</td>` : ''}<td class="govuk-table__cell govuk-table__cell--numeric">${esc(x.lyv)}</td><td class="govuk-table__cell govuk-table__cell--numeric">${esc(x.ch)}</td></tr>`; }).join('\n')}
  </tbody>
</table>`;
}
function sortedFlags(r) {
  const rank = { red: 0, amber: 1 };
  const amt = (f) => (f.dollar === 'not estimated' ? -1 : parseFloat(f.dollar.replace(/[,()]/g, '')));
  return [...r.flags].sort((a, b) => rank[a.sev] - rank[b.sev] || amt(b) - amt(a));
}
function flagLink(r, f) { const k = f.on[0]; return `<a class="govuk-link" href="${k.split('-')[0]}.html#l=${k}&amp;f=${f.id}">${esc(f.title)}</a>`; }
function flagsTable(r, { scroll = true, short = false, caption = 'Pinned flags, red first, then dollar effect' } = {}) {
  const t = `<table class="govuk-table govuk-!-margin-bottom-0">
  <caption class="govuk-table__caption govuk-table__caption--s">${esc(caption)}</caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Flag</th><th scope="col" class="govuk-table__header">Severity</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Dollar effect</th><th scope="col" class="govuk-table__header">Preparer's answer</th></tr></thead>
  <tbody class="govuk-table__body">
${sortedFlags(r).map((f) => `    <tr class="govuk-table__row"><td class="govuk-table__cell">${flagLink(r, f)}<br><span class="govuk-hint govuk-!-display-inline">${esc(f.id)}</span></td><td class="govuk-table__cell"><strong class="govuk-tag ${f.sev === 'red' ? 'govuk-tag--red' : 'govuk-tag--orange'}">${f.sev === 'red' ? 'Red' : 'Amber'}</strong></td><td class="govuk-table__cell govuk-table__cell--numeric">${esc(f.dollar)}${f.est ? '<br><span class="govuk-hint govuk-!-display-inline">estimate</span>' : ''}</td><td class="govuk-table__cell">${esc(f.answer)}</td></tr>`).join('\n')}
  </tbody>
</table>`;
  return scroll ? `<div class="app-scroll${short ? ' app-scroll--short' : ''}" tabindex="0" role="region" aria-label="Pinned flags, scrolls">${t}</div>` : t;
}
function changesLy(r, n = 5) {
  const lines = r.sections.flatMap((s) => s.lines.filter((l) => !l.total && l.ly !== null).map((l) => ({ s, l, d: Math.abs(l.value - l.ly) }))).sort((a, b) => b.d - a.d).slice(0, n);
  return `<table class="govuk-table govuk-!-margin-bottom-3">
  <caption class="govuk-table__caption govuk-table__caption--s">Largest changes since last year</caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Line</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">This year</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Change</th></tr></thead>
  <tbody class="govuk-table__body">
${lines.map(({ s, l }) => `    <tr class="govuk-table__row"><td class="govuk-table__cell"><a class="govuk-link" href="${s.id}.html#l=${l.key}">${esc(l.code)} ${esc(l.label)}</a></td><td class="govuk-table__cell govuk-table__cell--numeric">${esc(l.v)}</td><td class="govuk-table__cell govuk-table__cell--numeric">${esc(l.ch)}</td></tr>`).join('\n')}
  </tbody>
</table>`;
}
const summary = (rows, cls = '') => `<dl class="govuk-summary-list ${cls}">${rows.map(([k, v]) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${esc(k)}</dt><dd class="govuk-summary-list__value">${v}</dd></div>`).join('')}</dl>`;
function tierBlock(r, inline = false) {
  if (inline) return `<p class="govuk-body govuk-!-margin-bottom-2">${tierTag(r.tier)} because: ${r.tierWhy.map(esc).join('. ')}.</p>`;
  return `<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Tier ${tierTag(r.tier)}</h2><ul class="govuk-list govuk-list--bullet govuk-!-margin-bottom-3">${r.tierWhy.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`;
}
function attestations(r) {
  return summary(r.attestations.map(([k, v, line]) => [k, line ? `<a class="govuk-link" href="${line.split('-')[0]}.html#l=${line}">${esc(v)}</a> <strong class="govuk-tag govuk-tag--orange">Check</strong>` : esc(v)]), 'govuk-summary-list--no-border govuk-!-margin-bottom-3');
}
function assumptions(r) { return summary(r.assumptions.map(([k, v]) => [k, esc(v)]), 'govuk-!-margin-bottom-3'); }
const coverage = () => `<div class="app-coverage" id="coverage" data-coverage><p class="govuk-body govuk-!-margin-0">Loading coverage</p></div>`;
function reworkAlert(r) {
  if (!r.rework) return '';
  return `<div class="moj-alert moj-alert--warning govuk-!-margin-bottom-2" role="region" aria-label="Warning: back from rework"><div><svg class="moj-alert__icon" role="presentation" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" height="30" width="30"><path fill-rule="evenodd" clip-rule="evenodd" d="M15 2.44922L28.75 26.1992H1.25L15 2.44922ZM13.5107 9.49579H16.4697L16.2431 17.7678H13.7461L13.5107 9.49579ZM15 19.9645C16.0 19.9645 16.87 20.82 16.87 21.82C16.87 22.82 16.0 23.695 15 23.695C14.0 23.695 13.13 22.82 13.13 21.82C13.13 20.82 14.0 19.9645 15 19.9645Z" fill="currentColor"/></svg></div><div class="moj-alert__content"><h2 class="moj-alert__heading">Back from rework: ${esc(r.rework.summary)}</h2>Their Reviewed marks came off: ${r.rework.changedSections.map((id) => `<a class="govuk-link" href="${id}.html">${esc(r.sections.find((s) => s.id === id).title)}</a>`).join(', ')}. <a class="govuk-link" href="changes.html">See only the changed cells, before and after</a>.</div></div>`;
}

// ---- the brief, three ways ----
function brief(v, r) {
  const start = `<a href="${r.sections[0].id}.html" role="button" draggable="false" class="govuk-button govuk-!-margin-bottom-2" data-module="govuk-button" aria-keyshortcuts="]">Start with ${esc(r.sections[0].title)} ${key(']')}</a>`;
  if (v.layout === 'tabs') {
    return `${subNav(r, 'brief')}
<div class="app-brief-head"><h1 class="govuk-heading-l govuk-!-margin-bottom-0">Brief</h1>${coverage()}</div>
${reworkAlert(r)}
<div class="app-brief app-brief--three">
  <div>${sixTable(r, !!r.rework)}${tierBlock(r, true)}</div>
  <div>${flagsTable(r)}</div>
  <div>${changesLy(r, 4)}<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Attestations</h2>${attestations(r)}<details class="govuk-details govuk-!-margin-bottom-2"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Assumptions and client decisions (${r.assumptions.length})</span></summary><div class="govuk-details__text">${assumptions(r)}</div></details></div>
</div>
${start}
${keysDetails()}`;
  }
  if (v.layout === 'rail') {
    return `<div class="app-panes app-panes--two app-panes--railpage">
<div class="app-rail-col">${rail(r, 'brief')}</div>
<div>
<h1 class="govuk-heading-l govuk-!-margin-bottom-2">Brief</h1>
${reworkAlert(r)}
${coverage()}
<div class="app-brief">
  <div>${sixTable(r, !!r.rework)}</div>
  <div>${tierBlock(r)}<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Attestations</h2>${attestations(r)}</div>
</div>
${flagsTable(r)}
<div class="app-brief govuk-!-margin-top-3"><div>${changesLy(r)}</div><div><h2 class="govuk-heading-s govuk-!-margin-bottom-1">Assumptions and client decisions</h2>${assumptions(r)}</div></div>
${start}
${keysDetails()}
</div></div>`;
  }
  // walk: a cover sheet with the section task list
  return `${walkNav(r, 'brief')}
<h1 class="govuk-heading-l govuk-!-margin-bottom-2">Brief</h1>
${reworkAlert(r)}
<div class="app-brief">
  <div>
    <h2 class="govuk-heading-s govuk-!-margin-bottom-1">Sections, in the order you walk them</h2>
    <ul class="govuk-task-list">
${r.sections.map((s, i) => `      <li class="govuk-task-list__item govuk-task-list__item--with-link"><div class="govuk-task-list__name-and-hint"><a class="govuk-link govuk-task-list__link" href="${s.id}.html" aria-describedby="task-${s.id}-status">${i + 1}. ${esc(s.title)}</a><div class="govuk-task-list__hint">${esc(s.form)}, ${s.lines.length} lines</div></div><div class="govuk-task-list__status" id="task-${s.id}-status" data-task-status="${s.id}">Not reviewed</div></li>`).join('\n')}
    </ul>
    ${coverage()}
    ${tierBlock(r, true)}
  </div>
  <div>${sixTable(r, !!r.rework)}<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Attestations</h2>${attestations(r)}</div>
</div>
${flagsTable(r)}
<details class="govuk-details govuk-!-margin-top-3"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Changes since last year, assumptions and client decisions</span></summary><div class="govuk-details__text"><div class="app-brief"><div>${changesLy(r)}</div><div>${assumptions(r)}</div></div></div></details>
<div class="govuk-inset-text">Before you start: open the source window and drag it to your second monitor. It follows every number you open. <button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-popout aria-keyshortcuts="w">Open the source window ${key('w')}</button></div>
${start}
${keysDetails()}`;
}

// ---- a section ----
function returnTable(r, s, { compact = false } = {}) {
  const idx = r.sections.indexOf(s);
  return `<table class="govuk-table govuk-!-margin-bottom-0">
  <caption class="govuk-table__caption govuk-table__caption--s">${esc(s.title)}, ${esc(s.form)}, in printed order${s.printed ? '. Shown as the printed page (not a structured view); still counts toward coverage' : ''}</caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Line</th><th scope="col" class="govuk-table__header">Description</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">This year</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Last year</th>${compact ? '' : '<th scope="col" class="govuk-table__header govuk-table__header--numeric">Change</th>'}<th scope="col" class="govuk-table__header">${compact ? '<span class="govuk-visually-hidden">Evidence</span>' : 'Evidence'}</th><th scope="col" class="govuk-table__header">Flag</th></tr></thead>
  <tbody class="govuk-table__body">
${s.lines.map((l) => {
    const cls = ['govuk-table__row', l.total ? 'app-row--total' : '', l.flags.length ? 'app-row--flag' : l.hi.length ? 'app-row--hi' : '', l.changedFrom ? 'app-row--changed' : ''].filter(Boolean).join(' ');
    const hi = l.hi.length ? `<span class="govuk-visually-hidden">. Highlighted: ${esc(l.hi.join(', '))}</span>` : '';
    return `    <tr class="${cls}" data-row="${l.key}"><td class="govuk-table__cell">${esc(l.code)}${hi}</td><td class="govuk-table__cell">${esc(l.label)}${l.hi.length && !l.flags.length && !compact ? `<br><span class="govuk-hint govuk-!-display-inline">${esc(l.hi.join(', '))}</span>` : ''}</td><td class="govuk-table__cell govuk-table__cell--numeric"><a class="govuk-link app-num" href="#l=${l.key}" data-line="${l.key}">${esc(l.v)}</a>${l.changedFrom ? `<span class="app-was">was ${esc(l.changedFrom)}</span>` : ''}</td><td class="govuk-table__cell govuk-table__cell--numeric">${esc(l.lyv)}</td>${compact ? '' : `<td class="govuk-table__cell govuk-table__cell--numeric">${esc(l.ch)}</td>`}<td class="govuk-table__cell">${dot(l.dot, compact)}</td><td class="govuk-table__cell">${l.flags.length ? l.flags.map((id) => `<span class="app-flag">${esc(id.slice(3))}<span class="govuk-visually-hidden"> flag ${esc(id)}</span></span>`).join(' ') : '<span class="govuk-visually-hidden">No flag</span>'}</td></tr>`;
  }).join('\n')}
  </tbody>
</table>`;
}
function toolbar(withMark = false) {
  const b = (attr, label, k, secondary = true) => `<button type="button" class="govuk-button${secondary ? ' govuk-button--secondary' : ''}" data-module="govuk-button" ${attr} aria-keyshortcuts="${k === 'Shift + f' ? 'Shift+F' : k}">${label} ${key(k)}</button>`;
  return `<div class="app-toolbar">${b('data-step="-1"', 'Previous number', 'k')}${b('data-step="1"', 'Next number', 'j')}${b('data-flag-step="1"', 'Next flag', 'f')}${b('data-section-step="-1"', 'Previous section', '[')}${b('data-section-step="1"', 'Next section', ']')}</div>`;
}
function sectionPage(v, r, s) {
  const idx = r.sections.indexOf(s);
  const head = `<span class="govuk-caption-m">Section ${idx + 1} of ${r.sections.length}: ${esc(s.form)}</span><h1 class="govuk-heading-l govuk-!-margin-bottom-2">${esc(s.title)}</h1>`;
  const status = `<div data-mark-alert></div><div class="app-coverage"><div class="app-toolbar govuk-!-margin-0" data-section-status><p class="govuk-body govuk-!-margin-0">Loading</p></div><div data-coverage><p class="govuk-body govuk-!-margin-0">Loading coverage</p></div></div>`;
  const legend = `<p class="govuk-body-s govuk-!-margin-bottom-2">Evidence: ${['green', 'grey', 'amber', 'purple', 'none'].map((d) => dot(d)).join(' ')}. A flag is shown apart from the dot.</p>`;
  if (v.layout === 'tabs') {
    return `${subNav(r, s.id)}
${head}${status}${toolbar()}${legend}
<div class="app-panes">
  <section class="app-pane" aria-labelledby="pane-return"><div class="app-pane__head"><h2 class="govuk-heading-s" id="pane-return">Return</h2></div><div class="app-pane__body" tabindex="0" role="region" aria-label="Return lines">${returnTable(r, s, { compact: true })}</div></section>
  <section class="app-pane" aria-labelledby="pane-trace"><div class="app-pane__head"><h2 class="govuk-heading-s" id="pane-trace">Trace</h2></div><div class="app-pane__body" tabindex="0" role="region" aria-label="Trace" id="trace"><p class="govuk-body">Click a number, or press j.</p></div></section>
  <section class="app-pane" aria-label="Source"><div class="app-pane__body app-pane__body--source" id="source"><p class="govuk-body">The source shows here.</p></div></section>
</div>
${keysDetails()}`;
  }
  if (v.layout === 'rail') {
    return `<div class="app-panes app-panes--rail">
<div class="app-rail-col">${rail(r, s.id)}</div>
<div>${head}${status}${toolbar()}${legend}
  <section class="app-pane" aria-labelledby="pane-return"><div class="app-pane__head"><h2 class="govuk-heading-s" id="pane-return">Return</h2></div><div class="app-pane__body" tabindex="0" role="region" aria-label="Return lines">${returnTable(r, s, { compact: true })}</div></section>
  ${keysDetails()}
</div>
<div>
  <section class="app-pane govuk-!-margin-bottom-3" aria-labelledby="pane-trace"><div class="app-pane__head"><h2 class="govuk-heading-s" id="pane-trace">Trace</h2></div><div class="app-pane__body app-pane__body--half" tabindex="0" role="region" aria-label="Trace" id="trace"><p class="govuk-body">Click a number, or press j.</p></div></section>
  <section class="app-pane" aria-label="Source"><div class="app-pane__body app-pane__body--half" id="source"><p class="govuk-body">The source shows here.</p></div></section>
</div>
</div>`;
  }
  const ids = r.sections.map((x) => x.id);
  const prev = idx > 0 ? r.sections[idx - 1] : null; const next = idx < ids.length - 1 ? r.sections[idx + 1] : null;
  const pager = `<nav class="govuk-pagination govuk-pagination--block" aria-label="Sections">
  ${prev ? `<div class="govuk-pagination__prev"><a class="govuk-link govuk-pagination__link" href="${prev.id}.html" rel="prev"><svg class="govuk-pagination__icon govuk-pagination__icon--prev" xmlns="http://www.w3.org/2000/svg" height="13" width="15" aria-hidden="true" focusable="false" viewBox="0 0 15 13"><path d="m6.5938-0.0078125-6.7266 6.7266 6.7441 6.4062 1.377-1.449-4.1856-3.9768h12.896v-2h-12.984l4.2931-4.293-1.414-1.414z"></path></svg><span class="govuk-pagination__link-title">Previous section</span><span class="govuk-visually-hidden">:</span><span class="govuk-pagination__link-label">${esc(prev.title)}</span></a></div>` : ''}
  <div class="govuk-pagination__next"><a class="govuk-link govuk-pagination__link" href="${next ? `${next.id}.html` : 'brief.html#coverage'}" rel="next"><svg class="govuk-pagination__icon govuk-pagination__icon--next" xmlns="http://www.w3.org/2000/svg" height="13" width="15" aria-hidden="true" focusable="false" viewBox="0 0 15 13"><path d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z"></path></svg><span class="govuk-pagination__link-title">${next ? 'Next section' : 'Back to the brief'}</span><span class="govuk-visually-hidden">:</span><span class="govuk-pagination__link-label">${next ? esc(next.title) : 'Coverage and approve'}</span></a></div>
</nav>`;
  return `${walkNav(r, s.id)}
${head}${status}
<div class="app-toolbar">${toolbar().replace('<div class="app-toolbar">', '').replace(/<\/div>$/, '')}<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-popout aria-keyshortcuts="w">Open the source window ${key('w')}</button></div>
${legend}
<div class="app-panes app-panes--two">
  <section aria-labelledby="pane-return"><h2 class="govuk-visually-hidden" id="pane-return">Return</h2>${returnTable(r, s)}</section>
  <section class="app-pane app-sticky" aria-label="Source on this screen"><div class="app-pane__head"><p class="govuk-body-s govuk-!-margin-0">On one screen the source shows here. With a second monitor, open the source window instead.</p></div><div class="app-pane__body" id="source"><p class="govuk-body">The source shows here.</p></div></section>
</div>
${pager}
${keysDetails()}`;
}

function wrapNav(v, r, current, inner, h1) {
  if (v.layout === 'tabs') return `${subNav(r, current)}<h1 class="govuk-heading-l">${esc(h1)}</h1>${inner}`;
  if (v.layout === 'walk') return `${walkNav(r, current)}<h1 class="govuk-heading-l">${esc(h1)}</h1>${inner}`;
  return `<div class="app-panes app-panes--two app-panes--railpage"><div class="app-rail-col">${rail(r, current)}</div><div><h1 class="govuk-heading-l">${esc(h1)}</h1>${inner}</div></div>`;
}

function flagsPage(v, r) {
  const t = `<table class="govuk-table" data-module="moj-sortable-table">
  <caption class="govuk-table__caption govuk-table__caption--m">All flags. Default order: red first, then dollar effect</caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header" aria-sort="none">Flag</th><th scope="col" class="govuk-table__header" aria-sort="descending">Severity</th><th scope="col" class="govuk-table__header govuk-table__header--numeric" aria-sort="none">Dollar effect</th><th scope="col" class="govuk-table__header" aria-sort="none">Preparer's answer</th><th scope="col" class="govuk-table__header" aria-sort="none">Its source</th></tr></thead>
  <tbody class="govuk-table__body">
${sortedFlags(r).map((f) => `    <tr class="govuk-table__row"><td class="govuk-table__cell">${flagLink(r, f)} <span class="govuk-hint govuk-!-display-inline">${esc(f.id)}</span></td><td class="govuk-table__cell" data-sort-value="${f.sev === 'red' ? 2 : 1}"><strong class="govuk-tag ${f.sev === 'red' ? 'govuk-tag--red' : 'govuk-tag--orange'}">${f.sev === 'red' ? 'Red' : 'Amber'}</strong></td><td class="govuk-table__cell govuk-table__cell--numeric" data-sort-value="${f.dollar === 'not estimated' ? -1 : f.dollar.replace(/[,()]/g, '')}">${esc(f.dollar)}${f.est ? ' (estimate)' : ''}</td><td class="govuk-table__cell">${esc(f.answer)}</td><td class="govuk-table__cell">${esc(f.source)}</td></tr>`).join('\n')}
  </tbody>
</table>
<p class="govuk-body">Step through them from any section with <span class="app-key">f</span>. Accept the risk or send it back with a comment on the number.</p>`;
  return wrapNav(v, r, 'flags', t, 'Flags');
}
function commentsPage(v, r) {
  return wrapNav(v, r, 'comments', `<p class="govuk-body">Comments go to ${esc(r.preparer)}. Each has a type and a severity.</p><div data-comments-list><p class="govuk-body">Loading comments</p></div>`, 'Comments');
}
function historyPage(v, r) {
  const tl = `<div class="moj-timeline">
${r.history.map(([at, label, by, text]) => `  <div class="moj-timeline__item"><div class="moj-timeline__header"><h2 class="moj-timeline__title">${esc(label)}</h2><p class="moj-timeline__byline">by ${esc(by)}</p></div><p class="moj-timeline__date"><time datetime="${at}">${fmtDate(at)}</time></p><div class="moj-timeline__description">${esc(text)}</div></div>`).join('\n')}
</div>`;
  return wrapNav(v, r, 'history', tl, 'History');
}
function fmtDate(iso) {
  const d = new Date(`${iso}:00`); const h = d.getHours(); const m = d.getMinutes();
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}, ${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
function changesPage(v, r) {
  const bySec = r.rework.changedSections.map((id) => r.sections.find((s) => s.id === id));
  const inner = `<p class="govuk-body">Only the cells that changed since your review. ${esc(r.rework.summary)}.</p>
${bySec.map((s) => `<table class="govuk-table">
  <caption class="govuk-table__caption govuk-table__caption--m">${esc(s.title)} <strong class="govuk-tag govuk-tag--orange">Mark removed</strong></caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Line</th><th scope="col" class="govuk-table__header">Description</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Before</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">After</th></tr></thead>
  <tbody class="govuk-table__body">
${r.rework.changed.filter((c) => c.section === s.id).map((c) => `    <tr class="govuk-table__row"><td class="govuk-table__cell">${esc(c.code)}</td><td class="govuk-table__cell">${esc(c.label)}</td><td class="govuk-table__cell govuk-table__cell--numeric">${esc(c.before)}</td><td class="govuk-table__cell govuk-table__cell--numeric"><a class="govuk-link" href="${s.id}.html#l=${c.key}">${esc(c.after)}</a></td></tr>`).join('\n')}
  </tbody>
</table>`).join('\n')}
<p class="govuk-body">Sections whose numbers did not change keep their marks.</p>
<a href="${bySec[0].id}.html" role="button" draggable="false" class="govuk-button" data-module="govuk-button">Re-review ${esc(bySec[0].title)}</a>`;
  return wrapNav(v, r, 'changes', inner, 'Changes after rework');
}
function approvedPage(v, r) {
  return wrapNav(v, r, 'approved', '<div data-approved><p class="govuk-body">Loading</p></div>', 'Approve').replace('<h1 class="govuk-heading-l">Approve</h1>', '');
}

function queuePage(v, { empty = false } = {}) {
  const rank = { red: 0, amber: 1, green: 2 };
  const rows = [...QUEUE].sort((a, b) => rank[a.tier] - rank[b.tier] || a.dueIso.localeCompare(b.dueIso));
  const ready = rows.filter((q) => q.open);
  const body = empty ? `<h1 class="govuk-heading-l">Your review queue</h1>
<p class="govuk-body">No returns are waiting for your review.</p>
<p class="govuk-body">3 returns are being prepared. The next is due 30 Jun 2026. <a class="govuk-link" href="queue.html">See the queue with returns in it</a>.</p>` : `<h1 class="govuk-heading-l">Your review queue</h1>
<p class="govuk-body">${ready.length} returns ready for you. Ordered by tier (red first), then filing due date.</p>
<table class="govuk-table" data-module="moj-sortable-table">
  <caption class="govuk-table__caption govuk-table__caption--s govuk-visually-hidden">Returns, by tier then due date</caption>
  <thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header" aria-sort="none">Corporation</th><th scope="col" class="govuk-table__header" aria-sort="none">Year end</th><th scope="col" class="govuk-table__header" aria-sort="ascending">Tier</th><th scope="col" class="govuk-table__header" aria-sort="none">State</th><th scope="col" class="govuk-table__header" aria-sort="none">Filing due</th><th scope="col" class="govuk-table__header" aria-sort="none">Blocked by</th></tr></thead>
  <tbody class="govuk-table__body">
${rows.map((q) => `    <tr class="govuk-table__row"><td class="govuk-table__cell">${q.open ? `<a class="govuk-link" href="${q.ret}/brief.html">${esc(q.name)}</a>${q.note ? `<br><span class="govuk-hint govuk-!-display-inline">${esc(q.note)}</span>` : ''}` : esc(q.name)}</td><td class="govuk-table__cell">${esc(q.ye)}</td><td class="govuk-table__cell" data-sort-value="${rank[q.tier]}">${tierTag(q.tier)}</td><td class="govuk-table__cell">${esc(q.state)}</td><td class="govuk-table__cell" data-sort-value="${q.dueIso}">${esc(q.due)}</td><td class="govuk-table__cell">${esc(q.blocks)}</td></tr>`).join('\n')}
  </tbody>
</table>
<p class="govuk-body"><a class="govuk-link" href="queue-empty.html">See the empty queue</a></p>`;
  return page({ v, depth: 0, title: empty ? 'Your review queue, empty' : 'Your review queue', body, pageData: { page: 'queue' }, active: 'queue' });
}

function statesPage(v) {
  const body = `<h1 class="govuk-heading-l">States</h1>
<p class="govuk-body">Every state the brief names, drawn with this version's parts, on Maple Ridge Consulting Inc. (Test). Each also appears in context: the failed source on Income statement line 9200, no evidence on line 9275, the mark removed on the after-rework return, the empty queue and an empty comments tab on Queen West.</p>
<div class="app-brief">
  <section class="app-pane" aria-labelledby="h-loading"><div class="app-pane__head"><h2 class="govuk-heading-s" id="h-loading">Loading a source</h2></div><div class="app-pane__body" id="st-loading"></div></section>
  <section class="app-pane" aria-labelledby="h-failed"><div class="app-pane__head"><h2 class="govuk-heading-s" id="h-failed">A source that failed</h2></div><div class="app-pane__body" id="st-failed"></div></section>
  <section class="app-pane" aria-labelledby="h-none"><div class="app-pane__head"><h2 class="govuk-heading-s" id="h-none">No evidence (CK-2)</h2></div><div class="app-pane__body" id="st-none"></div></section>
  <section class="app-pane" aria-labelledby="h-computed"><div class="app-pane__head"><h2 class="govuk-heading-s" id="h-computed">A computed line, no document</h2></div><div class="app-pane__body" id="st-computed"></div></section>
  <section class="app-pane" aria-labelledby="h-doc"><div class="app-pane__head"><h2 class="govuk-heading-s" id="h-doc">A document page, figure boxed</h2></div><div class="app-pane__body" id="st-doc"></div></section>
  <section class="app-pane" aria-labelledby="h-trace"><div class="app-pane__head"><h2 class="govuk-heading-s" id="h-trace">A flagged number's trace (three flags)</h2></div><div class="app-pane__body" id="st-trace"></div></section>
</div>
<h2 class="govuk-heading-m govuk-!-margin-top-6">Other states, where to see them</h2>
<ul class="govuk-list govuk-list--bullet">
  <li><a class="govuk-link" href="queue-empty.html">Empty queue</a></li>
  <li><a class="govuk-link" href="r08/comments.html">No comments yet</a> (Queen West)</li>
  <li><a class="govuk-link" href="r01b/s100.html">Reviewed mark removed, with the reason</a> (Maple Ridge after rework)</li>
  <li><a class="govuk-link" href="r01/brief.html">Approve absent, sections left as links</a>; <a class="govuk-link" href="r08/s50.html">one section left, then Approve appears</a></li>
  <li>Comment form error: open any number, press <span class="app-key">c</span>, then Send to preparer without choosing</li>
</ul>`;
  return page({ v, depth: 0, title: 'States', body, pageData: { page: 'states' } });
}

function viewerPage(v) {
  const body = `<h1 class="govuk-heading-m govuk-!-margin-bottom-1">Source window</h1>
<p class="govuk-body" id="viewer-line">Follows the review window.</p>
<div id="viewer" role="region" aria-label="Source"><p class="govuk-body">Loading</p></div>`;
  return page({ v, depth: 0, title: 'Source window', body, pageData: { page: 'viewer' } });
}

function versionIndex(v) {
  const scen = [
    ['r01/brief.html', 'Maple Ridge Consulting Inc. (Test), red tier, first review', 'Nothing marked yet; three red flags; one number with no evidence; one failed source.'],
    ['r08/brief.html', 'Queen West Design Studio Inc. (Test), green tier, nearly done', 'Four of five sections marked; mark Schedule 50 and Approve appears.'],
    ['r01b/brief.html', 'Maple Ridge Consulting Inc. (Test), back from rework', 'Home office booked; 11 numbers changed; three marks came off with the reason.'],
  ];
  const body = `<h1 class="govuk-heading-l">${esc(v.name)}</h1>
<p class="govuk-body-l">${esc(v.short)}</p>
<h2 class="govuk-heading-m">Start here</h2>
<ul class="govuk-list"><li><a class="govuk-link" href="queue.html">Review queue</a> (task 1: pick the next return)</li></ul>
<h2 class="govuk-heading-m">Returns to click through</h2>
${summary(scen.map(([h, t, d]) => [t, `<a class="govuk-link" href="${h}">Open the brief</a>. ${esc(d)}`]))}
<h2 class="govuk-heading-m">Also</h2>
<ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="states.html">States: loading, failed, no evidence, computed, error</a></li><li><a class="govuk-link" href="viewer.html">The second-window source viewer on its own</a></li><li><a class="govuk-link" href="../layouts.html">Two-monitor layout drawings of all three versions</a></li></ul>
<p class="govuk-body">The parts this version uses, and what is composed outside GOV.UK and MOJ, are listed in <code>README.md</code> in this folder.</p>`;
  return page({ v, depth: 0, title: v.name, body, pageData: { page: 'index' }, active: 'index' });
}

// ---- write everything ----
for (const v of VERSIONS) {
  const base = v.dir;
  write(`${base}/index.html`, versionIndex(v));
  write(`${base}/queue.html`, queuePage(v));
  write(`${base}/queue-empty.html`, queuePage(v, { empty: true }));
  write(`${base}/states.html`, statesPage(v));
  write(`${base}/viewer.html`, viewerPage(v));
  for (const [id, r] of Object.entries(RETURNS)) {
    const pd = (extra) => ({ ret: id, viewer: '../viewer.html', ...extra });
    write(`${base}/${id}/brief.html`, page({ v, depth: 1, title: 'Brief', ret: id, body: brief(v, r), pageData: pd({ page: 'brief' }) }));
    for (const s of r.sections) write(`${base}/${id}/${s.id}.html`, page({ v, depth: 1, title: s.title, ret: id, body: sectionPage(v, r, s), pageData: pd({ page: 'section', section: s.id }) }));
    write(`${base}/${id}/flags.html`, page({ v, depth: 1, title: 'Flags', ret: id, body: flagsPage(v, r), pageData: pd({ page: 'flags' }) }));
    write(`${base}/${id}/comments.html`, page({ v, depth: 1, title: 'Comments', ret: id, body: commentsPage(v, r), pageData: pd({ page: 'comments' }) }));
    write(`${base}/${id}/history.html`, page({ v, depth: 1, title: 'History', ret: id, body: historyPage(v, r), pageData: pd({ page: 'history' }) }));
    write(`${base}/${id}/approved.html`, page({ v, depth: 1, title: 'Approve', ret: id, body: approvedPage(v, r), pageData: pd({ page: 'approved' }) }));
    if (r.rework) write(`${base}/${id}/changes.html`, page({ v, depth: 1, title: 'Changes after rework', ret: id, body: changesPage(v, r), pageData: pd({ page: 'changes' }) }));
  }
}
// ---- the family's start page and the two-monitor drawings ----
const top = { id: 'all', name: 'CPA review designs' };
const topPage = (title, body) => page({ v: top, depth: 0, title, body, pageData: { page: 'top' } }).replaceAll('href="../shared/', 'href="shared/').replaceAll('src="../shared/', 'src="shared/').replaceAll('href="queue.html"', 'href="a-record-tabs/queue.html"').replaceAll('href="index.html"', 'href="index.html"').replaceAll('href="../index.html"', 'href="index.html"');
write('index.html', topPage('CPA review designs', `<h1 class="govuk-heading-l">CPA review and its source viewer: three versions</h1>
<p class="govuk-body-l">Made-up returns from the sample clients. Each version covers the same tasks: pick a return, read the brief, walk each section, check numbers against their sources, step through flags, comment, mark each section Reviewed, approve, and re-review after rework.</p>
<div class="govuk-inset-text">Reviewed is an explicit mark on each section (key <span class="app-key">m</span>), with who and when. It comes off, with the reason, when a number in that section changes. Approve appears only when every section is marked.</div>
${summary(VERSIONS.map((v) => [v.name, `<a class="govuk-link" href="${v.dir}/index.html">Open ${esc(v.name.split(':')[0])}</a>. ${esc(v.short)}`]))}
<p class="govuk-body"><a class="govuk-link" href="layouts.html">Two-monitor layout drawings</a></p>`));
const box = (x, y, w, h, label, sub = '') => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f3f5f8" stroke="#15283b" stroke-width="2"/><text x="${x + 8}" y="${y + 22}" font-size="15" font-weight="700" fill="#15283b">${esc(label)}</text>${sub ? `<text x="${x + 8}" y="${y + 42}" font-size="13" fill="#15283b">${esc(sub)}</text>` : ''}</g>`;
const screen = (x, label, inner) => `<g><rect x="${x}" y="40" width="500" height="300" rx="8" fill="#fff" stroke="#15283b" stroke-width="3"/><text x="${x}" y="28" font-size="16" font-weight="700" fill="#15283b">${esc(label)}</text>${inner}</g>`;
const drawing = (title, desc, laptop, second) => `<figure class="govuk-!-margin-0 govuk-!-margin-bottom-6"><svg class="app-drawing" viewBox="0 0 1060 360" role="img" aria-labelledby="t-${title.length} d-${title.length}"><title id="t-${title.length}">${esc(title)}</title><desc id="d-${title.length}">${esc(desc)}</desc>${screen(10, 'Laptop', laptop)}${screen(550, 'Second monitor', second)}</svg><figcaption class="govuk-body">${esc(desc)}</figcaption></figure>`;
write('layouts.html', topPage('Two-monitor layouts', `<h1 class="govuk-heading-l">Two-monitor layouts</h1>
<p class="govuk-body">How each version uses a laptop with a second monitor. All three work on the laptop alone; the panes stack below 1280 px wide.</p>
<h2 class="govuk-heading-m">${esc(VERSIONS[0].name)}</h2>
${drawing('Version A layout', 'Laptop: tabs across the top; return, trace and source side by side. Second monitor (optional): the source pops out with w and follows every click; the laptop keeps all three panes.', box(20, 55, 480, 30, 'Brief | Balance sheet | Income statement | ...') + box(20, 95, 150, 235, 'Return', 'lines, dots, flags') + box(180, 95, 150, 235, 'Trace', 'built from, sources') + box(340, 95, 160, 235, 'Source', 'figure boxed'), box(560, 55, 480, 275, 'Source window (pop-out)', 'follows the laptop; next and previous source'))}
<h2 class="govuk-heading-m">${esc(VERSIONS[1].name)}</h2>
${drawing('Version B layout', 'Laptop: a rail of sections with their Reviewed marks; the section in the middle; trace above source on the right. Second monitor: free for Taxprep or QuickBooks.', box(20, 55, 110, 275, 'Rail', 'sections, marks') + box(140, 55, 180, 275, 'Section', 'return lines') + box(330, 55, 170, 130, 'Trace') + box(330, 195, 170, 135, 'Source', 'figure boxed'), box(560, 55, 480, 275, 'Free', 'Taxprep, QuickBooks or email'))}
<h2 class="govuk-heading-m">${esc(VERSIONS[2].name)}</h2>
${drawing('Version C layout', 'Laptop: the return walked full width, the trace opening under the line; pagination to the next section. Second monitor: the source window, always open, following each number.', box(20, 55, 480, 30, 'Brief | Walk the return | Flags | Comments | History') + box(20, 95, 480, 70, 'Section lines') + box(20, 170, 480, 90, 'Trace, under the line you opened') + box(20, 265, 480, 65, 'More lines; Previous and Next section'), box(560, 55, 480, 275, 'Source window', 'figure boxed; next and previous source'))}`));

for (const [id, r] of Object.entries(RETURNS)) write(`shared/data/${id}.js`, `/* Made-up return for the prototypes, built from reference/sample-clients by build/render.mjs. */\nwindow.CPA_RETURNS = window.CPA_RETURNS || {};\nwindow.CPA_RETURNS[${JSON.stringify(id)}] = ${JSON.stringify(r)};\n`);
console.log('written');
