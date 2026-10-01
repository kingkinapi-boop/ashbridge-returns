import fs from 'node:fs';
import path from 'node:path';
import { TODAY, STATES, stateInfo, PEOPLE, TIER, RETURNS, filler, bySlug } from './data.mjs';

import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${M[m - 1]} ${y}`; };
export const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);
export const diffDays = (iso) => dayNum(iso) - dayNum(TODAY);
export const rel = (iso) => { const n = diffDays(iso); return n === 0 ? 'today' : n > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} ago`; };
export const ALL = [...RETURNS, ...filler()];
export const sortDue = (arr) => [...arr].sort((a, b) => a.filing.localeCompare(b.filing) || a.name.localeCompare(b.name));

// ---------- small parts ----------
export const stateTag = (k) => { const s = stateInfo[k]; return `<strong class="govuk-tag govuk-tag--${s.colour}">${s.label}</strong>`; };
export const tierTag = (t) => { const [w, c] = TIER[t]; return `<strong class="govuk-tag govuk-tag--${c}">${w}</strong>`; };
export const waitTag = (w) => `<strong class="govuk-tag govuk-tag--yellow">Flag: waiting on client, ${w.days} days</strong>`;
export const person = (k) => PEOPLE[k] || '';
export const link = (href, t, cls = 'govuk-link') => `<a class="${cls}" href="${href}">${esc(t)}</a>`;
export const recHref = (r, tab = 'overview') => `rec-${r.slug}.html#${tab}`;
export const dateCell = (iso, kind = 'filing', done = false) => {
  const n = diffDays(iso);
  if (done) return [fmt(iso), String(dayNum(iso))];
  const note = n < 0 ? `<br><span class="govuk-hint govuk-!-margin-bottom-0">${kind === 'filing' ? -n + ' days overdue' : 'passed ' + -n + ' days ago'}</span>` : `<br><span class="govuk-hint govuk-!-margin-bottom-0">${rel(iso)}</span>`;
  return [`${fmt(iso)}${note}`, String(dayNum(iso))];
};
export const nameCell = (r, hrefFn = recHref) =>
  `<a class="govuk-link govuk-!-font-weight-bold" href="${hrefFn(r)}" data-pick aria-keyshortcuts="o">${esc(r.name)}</a><br><span class="govuk-hint govuk-!-margin-bottom-0">Year end ${fmt(r.ye)} | BN ${esc(r.bn)}</span>`;

// ---------- table (MOJ sortable table markup, sorted in the browser) ----------
// cols: {h, sort: 'ascending'|'none'|false, num}; rows: array of {cells:[html | [html, sortValue]], attrs}
export function table({ id, caption, cols, rows, select = false, hiddenCaption = false }) {
  const head = cols.map((c, i) => {
    const idx = i + (select ? 1 : 0);
    if (c.sort === false) return `<th scope="col" class="govuk-table__header">${c.h}</th>`;
    return `<th scope="col" class="govuk-table__header${c.num ? ' govuk-table__header--numeric' : ''}" aria-sort="${c.sort || 'none'}"><button type="button" data-index="${idx}">${c.h}</button></th>`;
  }).join('');
  const body = rows.map((r) => {
    const tds = r.cells.map((c, i) => {
      const [h, sv] = Array.isArray(c) ? c : [c, null];
      return `<td class="govuk-table__cell${cols[i]?.num ? ' govuk-table__cell--numeric' : ''}"${sv != null ? ` data-sort-value="${esc(sv)}"` : ''}>${h}</td>`;
    }).join('');
    const sel = select ? (r.flagged ? `<td class="govuk-table__cell"><span class="govuk-hint govuk-!-margin-bottom-0">Flagged<span class="govuk-visually-hidden">: ${esc(r.label)} is flagged for a person, open it to assign</span></span></td>` : `<td class="govuk-table__cell"><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="${id}-${r.id}" name="pick" value="${r.id}" data-row-select><label class="govuk-label govuk-checkboxes__label" for="${id}-${r.id}"><span class="govuk-visually-hidden">Select ${esc(r.label)}</span></label></div></div></td>`) : '';
    return `<tr class="govuk-table__row"${r.attrs || ''}>${sel}${tds}</tr>`;
  }).join('\n');
  return `<table class="govuk-table" id="${id}" data-module="moj-sortable-table" data-app-sortable>
<caption class="govuk-table__caption govuk-table__caption--m${hiddenCaption ? ' govuk-visually-hidden' : ''}">${caption}</caption>
<thead class="govuk-table__head"><tr class="govuk-table__row">${select ? '<th scope="col" class="govuk-table__header">Select</th>' : ''}${head}</tr></thead>
<tbody class="govuk-table__body">
${body}
</tbody></table>`;
}
export const simpleTable = ({ caption, head, rows, numCols = [], hide = false }) => `<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--m${hide ? ' govuk-visually-hidden' : ''}">${caption}</caption><thead class="govuk-table__head"><tr class="govuk-table__row">${head.map((h, i) => `<th scope="col" class="govuk-table__header${numCols.includes(i) ? ' govuk-table__header--numeric' : ''}">${h}</th>`).join('')}</tr></thead><tbody class="govuk-table__body">${rows.map((r) => `<tr class="govuk-table__row">${r.map((c, i) => `<td class="govuk-table__cell${numCols.includes(i) ? ' govuk-table__cell--numeric' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

export const DONE = ['filed', 'assessed', 'closed'];
export const isDone = (r) => DONE.includes(r.state);
export const band = (r) => { if (isDone(r)) return 'done'; const n = diffDays(r.filing); return n < 0 ? 'overdue' : n <= 7 ? 'week' : n <= 28 ? 'month' : 'later'; };
export const flagged = (r) => !!(r.waiting || r.blocker || r.tier === 'red');
export const dataAttrs = (r) => ` data-slug="${r.slug}" data-state="${r.state}" data-tier="${r.tier}" data-prep="${r.prep}" data-wait="${r.waiting ? 'yes' : 'no'}" data-due="${isDone(r) ? 9999 : diffDays(r.filing)}" data-band="${band(r)}" data-text="${esc((r.name + ' ' + r.bn + ' ' + fmt(r.ye) + ' ' + r.ye + ' ' + (PEOPLE[r.prep] || '')).toLowerCase())}"`;

// ---------- page frame ----------
const LOGO = `<svg class="app-logo__mark" aria-hidden="true" focusable="false" width="34" height="34" viewBox="0 0 34 34"><rect width="34" height="34" rx="4" fill="#fff"/><path d="M6 27 L17 7 L28 27 Z" fill="none" stroke="#355b7d" stroke-width="3"/><path d="M10 27 H24" stroke="#355b7d" stroke-width="3"/></svg>`;

export const NAV = [['queue', 'My work', 'queue-preparer.html'], ['review', 'CPA review', 'queue-cpa.html'], ['ops', 'Ops', 'queue-ops.html'], ['board', 'Board', 'board.html']];

export function page({ title, h1Title, ret, nav, body, navLinks, error = false, extraHead = '', bodyClass = '', searchRows = true, shortcuts = [], main = true, self = '', ctx = '' }) {
  const t = `${error ? 'Error: ' : ''}${title}${ret ? ' - ' + ret.name + ', year end ' + fmt(ret.ye) : ''} - Ashbridge Tax`;
  const links = (navLinks || NAV).map(([k, l, h]) => `<li class="govuk-service-navigation__item${nav === k ? ' govuk-service-navigation__item--active' : ''}">${h === self ? `<span class="govuk-service-navigation__link" aria-current="true"><strong class="govuk-service-navigation__active-fallback">${l}</strong></span>` : `<a class="govuk-service-navigation__link" href="${h}"${nav === k ? ' aria-current="true"' : ''}>${nav === k ? `<strong class="govuk-service-navigation__active-fallback">${l}</strong>` : l}</a>`}</li>`).join('');
  const sc = [['/', 'Focus the search box', 'Slash'], ...shortcuts];
  return `<!DOCTYPE html>
<html lang="en-CA" class="govuk-template">
<head>
<meta charset="utf-8">
<title>${esc(t)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="../_shared/govuk.css">
<link rel="stylesheet" href="../_shared/moj.css">
<link rel="stylesheet" href="../_shared/a.css">
${extraHead}
</head>
<body class="govuk-template__body ${bodyClass}">
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
<header class="govuk-header" data-module="govuk-header">
<div class="govuk-header__container govuk-width-container app-header-row">
<div class="govuk-header__logo"><a class="govuk-header__link app-logo" href="../index.html" aria-label="Ashbridge Tax, all versions of this prototype">${LOGO}<span class="app-logo__name">Ashbridge Tax</span></a></div>
<form class="app-search" role="search" action="search.html" method="get">
<label class="govuk-label app-search__label" for="header-search">Find a return by name, number or year end</label>
<input class="govuk-input app-search__input" id="header-search" name="q" type="search" autocomplete="off" aria-keyshortcuts="/">
<button class="govuk-button govuk-button--secondary app-search__button govuk-!-margin-bottom-0" type="submit">Search</button>
</form>
</div></header>
<section aria-label="Service information" class="govuk-service-navigation" data-module="govuk-service-navigation">
<div class="govuk-width-container"><div class="govuk-service-navigation__container">
<span class="govuk-service-navigation__service-name"><span class="govuk-service-navigation__text">Staff returns</span></span>
<nav aria-label="Menu" class="govuk-service-navigation__wrapper"><ul class="govuk-service-navigation__list">${links}<li class="govuk-service-navigation__item"><a class="govuk-service-navigation__link" href="../index.html">Sign out</a></li></ul></nav>
</div></div></section>
<div class="govuk-width-container">
<main class="govuk-main-wrapper govuk-!-padding-top-2" id="main-content" role="main">
${body}
</main>
</div>
<footer class="govuk-footer"><div class="govuk-width-container">
<details class="govuk-details app-shortcuts"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts</span></summary><div class="govuk-details__text">
<table class="govuk-table"><caption class="govuk-table__caption govuk-visually-hidden">Keyboard shortcuts</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Key</th><th scope="col" class="govuk-table__header">Does</th></tr></thead><tbody class="govuk-table__body">${sc.map(([k, d, n]) => `<tr class="govuk-table__row"><td class="govuk-table__cell"><kbd>${esc(n ? k : k)}</kbd></td><td class="govuk-table__cell">${d}</td></tr>`).join('')}</tbody></table>
<div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="shortcuts-off" type="checkbox" data-shortcuts-off><label class="govuk-label govuk-checkboxes__label" for="shortcuts-off">Turn off single-key shortcuts</label></div></div>
</div></details>
<span class="govuk-footer__meta-item">Ashbridge Tax staff prototype. Made-up data only, every name ends (Test). Pinned date: Monday 8 Jun 2026.</span>
</div></footer>
${ctx}<script src="../_shared/proto.js"></script>
</body></html>`;
}

export const heading = (t, cls = 'govuk-heading-xl') => `<h1 class="${cls}">${t}</h1>`;

export function write(dir, file, html) {
  const p = path.join(ROOT, dir);
  fs.mkdirSync(p, { recursive: true });
  const bad = html.match(/—|–/);
  if (bad) throw new Error('dash in ' + file);
  fs.writeFileSync(path.join(p, file), html);
}

// ---------- list-page parts ----------
export const subNav = (label, items, active) => `<nav class="moj-sub-navigation" aria-label="${label}"><ul class="moj-sub-navigation__list">${items.map(([k, l, h, n, cn]) => `<li class="moj-sub-navigation__item">${active === k ? `<span class="moj-sub-navigation__link" aria-current="page"${n != null ? ` data-count="${esc(cn || l)}" data-scope="${esc(l)}"` : ''}>` : `<a class="moj-sub-navigation__link" href="${h}"${n != null ? ` data-count="${esc(cn || l)}" data-scope="${esc(l)}"` : ''}>`}${l}${n != null ? ` <span class="moj-badge moj-badge--grey"><span class="govuk-visually-hidden">(</span>${n}<span class="govuk-visually-hidden"> returns)</span></span>` : ''}${active === k ? '</span>' : '</a>'}</li>`).join('')}</ul></nav>`;

export const chips = (label, defs, scope = '') => `<div class="app-chips" role="group" aria-label="${label}">${defs.map(([k, v, l, n]) => `<button type="button" class="app-chip" aria-pressed="false" data-filter-key="${k}" data-filter-value="${v}" data-count="${esc(scope + ': ' + l)}" data-scope="${esc(l)}"><span data-chip-label>${l}</span> <span class="moj-badge moj-badge--grey">${n}</span></button>`).join('')}<button type="button" class="app-chip app-chip--clear govuk-link" data-filter-clear hidden>Clear filters</button></div>`;

export const filterBox = (extra = '', note = '', name = '') => `<div class="app-filterbar"><label class="govuk-label govuk-!-margin-bottom-0" for="list-filter">Filter this list by name, business number or year end</label><input class="govuk-input app-filterbar__input" id="list-filter" type="search" autocomplete="off" data-list-filter>${extra}<p class="govuk-body govuk-!-margin-bottom-0" role="status" aria-live="polite" data-list-status data-count="showing: ${esc(name)}" data-scope="of" data-note="${esc(note)}"></p></div>`;

export const emptyFilter = `<div class="govuk-inset-text" data-list-empty hidden><p class="govuk-body govuk-!-margin-bottom-1"><strong>No return matches these filters.</strong></p><p class="govuk-body govuk-!-margin-bottom-0">Clear a filter, or search all returns by name or business number in the box at the top of the page.</p></div>`;

export const counts = (rows) => { const c = {}; for (const r of rows) c[r.state] = (c[r.state] || 0) + 1; return c; };
export const oldest = (rows, k) => Math.max(0, ...rows.filter((r) => r.state === k).map((r) => r.daysInState || 0));
