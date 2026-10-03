// Shared fragments for version 3 of the CPA review prototype. Only govuk-, moj- and app- classes. No inline style, no CSS zoom.
import { esc, money, DOTS, BLUEPRINT_COMMIT, PROTOTYPE_TODAY, KIND_TAG } from './model.mjs';

export const VENDOR = 'static/vendor/';
export { BLUEPRINT_COMMIT };
export const jsonSafe = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export const H = {
  tier: (t) => ({ red: '<strong class="govuk-tag govuk-tag--red">Red tier</strong>', amber: '<strong class="govuk-tag govuk-tag--orange">Amber tier</strong>', green: '<strong class="govuk-tag govuk-tag--green">Green tier</strong>' }[t]),
  tierWord: (t) => ({ red: 'Red', amber: 'Amber', green: 'Green' }[t]),
  flagTier: (t) => ({ red: '<strong class="govuk-tag govuk-tag--red">Red: you decide</strong>', amber: '<strong class="govuk-tag govuk-tag--orange">Amber: check</strong>', green: '<strong class="govuk-tag govuk-tag--green">Green: answered</strong>' }[t]),
  dot: (d) => `<span class="app-dot app-dot--${d}">${DOTS[d]}</span>`,
  tag: (txt, colour) => `<strong class="govuk-tag${colour ? ' govuk-tag--' + colour : ''}">${esc(txt)}</strong>`,
  kind: (k) => { const [w, c] = KIND_TAG[k]; return `<strong class="govuk-tag govuk-tag--${c}">${esc(w)}</strong>`; },
};

export function chg(l) {
  if (l.pct) return 'No change';
  if (l.ly === null || l.ly === undefined) return 'No prior year';
  const d = Math.round((l.cy - l.ly) * 100) / 100;
  if (d === 0) return 'No change';
  const p = l.ly ? Math.round((d / Math.abs(l.ly)) * 100) + '%' : 'new';
  return `${d > 0 ? '+' : '-'}${money(Math.abs(d))} (${d > 0 && l.ly ? '+' : ''}${p})`;
}
export const chgPct = (l) => {
  if (l.pct) return 'no change';
  if (l.ly === null || l.ly === undefined) return 'no prior year';
  const d = Math.round((l.cy - l.ly) * 100) / 100;
  if (d === 0) return 'no change';
  if (!l.ly) return 'new';
  const p = Math.round((d / Math.abs(l.ly)) * 100);
  return (d > 0 ? '+' : '-') + Math.abs(p) + '%';
};
export const val = (l, v) => (v === null || v === undefined ? 'No prior year' : (l.pct ? v + '%' : money(v)));
export const madeTag = (l) => (l.madeUp ? ' <span class="app-madeup">Made up</span>' : '');

// ---------------------------------------------------------------- page frame (Generic header with the Ashbridge Tax wordmark)
export function frame({ title, main, ret, error = false, bodyAttrs = '', nav = 'queue', bare = false, scripts = '', foot = '', root = '', person = 'Zo (Test)', headerPerson = true }) {
  const t = `${error ? 'Error: ' : ''}${title}${ret ? ' - ' + ret.corp : ''} - Ashbridge Tax`;
  const V = root + VENDOR;
  const item = (key, href, text, extra = '') => `<li class="govuk-service-navigation__item${nav === key ? ' govuk-service-navigation__item--active' : ''}"><a class="govuk-service-navigation__link" href="${root}${href}"${nav === key ? ' aria-current="true"' : ''}${extra}>${nav === key ? `<strong class="govuk-service-navigation__active-fallback">${text}</strong>` : text}</a></li>`;
  const serviceNav = bare ? '' : `<section aria-label="Service information" class="govuk-service-navigation" data-module="govuk-service-navigation"><div class="govuk-width-container app-wide"><div class="govuk-service-navigation__container"><span class="govuk-service-navigation__service-name">${nav === 'queue' ? '<span class="govuk-service-navigation__text">Return review</span>' : `<a class="govuk-service-navigation__link" href="${root}queue.html">Return review</a>`}</span><nav aria-label="Menu" class="govuk-service-navigation__wrapper"><button type="button" class="govuk-service-navigation__toggle govuk-js-service-navigation-toggle" aria-controls="navigation" hidden>Menu</button><ul class="govuk-service-navigation__list" id="navigation">${item('queue', 'queue.html', 'Review queue')}${item('notes', 'notes.html', 'Prototype notes')}</ul></nav></div></div></section>`;
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
<meta charset="utf-8">
<title>${esc(t)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#355b7d">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${V}govuk-frontend.min.css">
<link rel="stylesheet" href="${V}moj-frontend.min.css">
<link rel="stylesheet" href="${root}static/ashbridge-v3.css">
</head>
<body class="govuk-template__body" ${bodyAttrs} data-person="${esc(person || '')}">
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
<header class="govuk-header" data-module="govuk-header"><div class="govuk-header__container govuk-header__container--full-width"><div class="govuk-header__logo"><a href="${root}queue.html" class="govuk-header__homepage-link"><span class="app-wordmark">Ashbridge <span>Tax</span></span></a></div>${person && headerPerson ? `<p class="app-header-person">Signed in as ${esc(person)} <a class="govuk-link app-header-link" href="${root}signed-out.html" data-signout>Sign out</a></p>` : ''}</div></header>
${serviceNav}
${main}
${foot}
<div id="app-live" class="govuk-visually-hidden" role="status" aria-live="polite"></div>
<script src="${V}govuk-frontend.bundle.js"></script>
<script src="${V}moj-frontend.bundle.js"></script>
<script>if (window.GOVUKFrontend) { GOVUKFrontend.initAll(); } if (window.MOJFrontend) { MOJFrontend.initAll(); }</script>
${scripts}
</body>
</html>
`;
}
export const wrapMain = (inner, cls = '') => `<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper app-main ${cls}" id="main-content" role="main">${inner}</main></div>`;
export const footNote = (extra = '') => `<footer class="govuk-footer app-footer"><div class="govuk-width-container app-wide">${extra}<p class="govuk-body-s govuk-!-margin-bottom-0">Prototype for Zo to look at (version 3, round 3). Made-up data only (sample clients). Prototype date: ${PROTOTYPE_TODAY}. Written against blueprint commit ${BLUEPRINT_COMMIT}.</p></div></footer>`;
export const SCRIPT = '<script src="static/review-v3.js"></script>';

// ---------------------------------------------------------------- the MOJ alert (static markup: the sheet styles it, no script is needed)
const ALERT_WARNING = '<path fill-rule="evenodd" clip-rule="evenodd" d="M15 2.44922L28.75 26.1992H1.25L15 2.44922ZM13.5107 9.49579H16.4697L16.2431 17.7678H13.7461L13.5107 9.49579ZM13.1299 21.82C13.1299 21.5661 13.1787 21.3285 13.2764 21.1071C13.374 20.8793 13.5075 20.6807 13.6768 20.5114C13.8525 20.3421 14.0544 20.2087 14.2822 20.111C14.5101 20.0134 14.7542 19.9645 15.0146 19.9645C15.2686 19.9645 15.5062 20.0134 15.7275 20.111C15.9554 20.2087 16.154 20.3421 16.3232 20.5114C16.4925 20.6807 16.626 20.8793 16.7236 21.1071C16.8213 21.3285 16.8701 21.5661 16.8701 21.82C16.8701 22.0804 16.8213 22.3246 16.7236 22.5524C16.626 22.7803 16.4925 22.9789 16.3232 23.1481C16.154 23.3174 15.9554 23.4509 15.7275 23.5485C15.5062 23.6462 15.2686 23.695 15.0146 23.695C14.7542 23.695 14.5101 23.6462 14.2822 23.5485C14.0544 23.4509 13.8525 23.3174 13.6768 23.1481C13.5075 22.9789 13.374 22.7803 13.2764 22.5524C13.1787 22.3246 13.1299 22.0804 13.1299 21.82Z" fill="currentColor"/>';
export const alertWarning = (title, html) => `<div class="app-alert"><div role="region" class="moj-alert moj-alert--warning moj-alert--with-heading" aria-label="warning: ${esc(title)}"><div><svg class="moj-alert__icon" role="presentation" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" height="30" width="30">${ALERT_WARNING}</svg></div><div class="moj-alert__content"><h2 class="moj-alert__heading">${esc(title)}</h2>${html}</div><div class="moj-alert__action"><button type="button" class="moj-alert__dismiss" hidden>Dismiss</button></div></div></div>`;

// ---------------------------------------------------------------- sources (the one viewer; the same markup fills the second window)
const monthLabel = (ym) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
export function sourceCaption(s, k, n) {
  let base;
  if (s.kind === 'statement') base = `${s.title}, ${s.month}, page ${s.page}`;
  else if (s.kind === 'closing') base = `${s.role === 'card' ? 'Card' : 'Bank'} statement, ${monthLabel(s.month)}, last page`;
  else if (s.kind === 'sheet') base = `${s.title}, sheet ${s.sheet}, row ${s.hitRow}, column ${s.hitCol}`;
  else base = s.title;
  return `${base} (source ${k + 1} of ${n})`;
}
export function sourceBody(s) {
  if (s.kind === 'statement') {
    const rows = s.rows.map((t) => {
      const hit = t.id === s.hit;
      return `<tr class="${hit ? 'app-source__hit' : 'app-source__faded'}"><td>${esc(t.date)}</td><td>${esc(t.description)}</td><td class="app-num">${money(t.amount)}${hit ? ` <span class="app-source__label">Boxed figure: ${money(s.hitAmt)}</span>` : ''}</td></tr>`;
    }).join('');
    return `<div class="app-source"><h4>${esc(s.inst)}</h4><p>Statement period ${esc(s.month)}. Page ${s.page}. Amounts: money in is positive, money out is negative.</p>
<table><thead><tr><th>Date</th><th>Description</th><th class="app-num">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="govuk-body-s govuk-!-margin-top-2 govuk-!-margin-bottom-0">Coded as: ${esc(s.note)}. ${s.coded !== s.hitAmt ? 'The boxed figure is the whole deposit or payment; ' + money(s.coded) + ' of it is this number.' : 'The boxed figure is this number.'}</p>`;
  }
  if (s.kind === 'closing') {
    return `<div class="app-source"><h4>${esc(s.inst)}</h4><p>Statement for ${monthLabel(s.month)}. Summary page.</p><table><tbody>
<tr class="app-source__faded"><td>Opening balance</td><td class="app-num">${money(s.opening)}</td></tr>
<tr class="app-source__hit"><td>Closing balance</td><td class="app-num">${money(s.closing)} <span class="app-source__label">Boxed figure</span></td></tr></tbody></table></div>`;
  }
  if (s.kind === 'entry') {
    const rows = s.lines.map((l) => `<tr class="${l.account === s.hitAcct ? 'app-source__hit' : 'app-source__faded'}"><td>${l.account} ${esc(l.name)}</td><td class="app-num">${l.debit ? money(l.debit) : ''}</td><td class="app-num">${l.credit ? money(l.credit) : ''}${l.account === s.hitAcct ? ' <span class="app-source__label">Boxed line</span>' : ''}</td></tr>`).join('');
    return `<div class="app-card"><h4>Adjusting entry ${esc(s.id)}</h4><p class="govuk-body-s">Entered ${esc(s.date)}. Not a document: an entry made in the books. ${esc(s.reason)}</p>
<table class="app-entry"><thead><tr><th>Account</th><th class="app-num">Debit</th><th class="app-num">Credit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  if (s.kind === 'sheet') {
    const body = [s.header, ...s.rows].map((r, i) => `<tr><th scope="row">${i + 1}</th>${r.map((c, j) => `<td${i + 1 === s.hitRow && 'ABC'[j] === s.hitCol ? ' class="app-hit"' : ''}>${esc(c)}${i + 1 === s.hitRow && 'ABC'[j] === s.hitCol ? ' <span class="app-source__label">Boxed cell</span>' : ''}</td>`).join('')}</tr>`).join('');
    return `<div class="app-card"><h4>${esc(s.title)}</h4><p class="govuk-body-s">A spreadsheet from the client. Shown as sheet, row and column. ${esc(s.note)}</p><table class="app-sheet"><caption class="govuk-visually-hidden">Sheet ${esc(s.sheet)}</caption><thead><tr><th scope="col"><span class="govuk-visually-hidden">Row</span></th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  if (s.kind === 'computed') {
    return `<div class="app-card"><h4>${esc(s.title)}</h4><p class="govuk-body-s">Not a document: a sum the system made. Each part is a number you can open.</p><ul class="app-lines">${s.parts.map((p) => `<li>${p.sign < 0 ? 'Less ' : ''}${esc(p.label)}: ${money(p.value)}</li>`).join('')}</ul></div>`;
  }
  return `<div class="app-card"><h4>${esc(s.title)}</h4><p class="govuk-body-s">Not a document page. ${s.kind === 'taxprep' ? 'A Taxprep result. Made-up value for the design.' : s.kind === 'cra' ? 'A capture from CRA My Business Account (test).' : s.kind === 'answer' ? 'An answer the client gave in the client app.' : 'A figure carried from a calculation or a prior return.'}</p><dl>${s.fields.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>`;
}
export const statusOf = (s) => ({ sheet: ['green', 'Traced'], statement: ['green', 'Traced'], closing: ['green', 'Traced'], cra: ['green', 'Traced'], prior: ['green', 'Traced'], entry: ['purple', 'Entry or judgement'], answer: ['purple', 'Entry or judgement'], computed: ['purple', 'Computed'], taxprep: ['purple', 'Computed'] }[s.kind]);

// The boxed figure (or the whole card when there is no box) is the evidence node of the pane: V3 checks it is in view (reports/findings-designs-2.md).
export const markEvidence = (h) => /app-source__hit|app-hit/.test(h) ? h.replace(/class="(app-source__hit|app-hit)"/g, 'class="$1" data-evidence') : h.replace(/<div class="app-card">/, '<div class="app-card" data-evidence>');

// ---------------------------------------------------------------- key legend (rule 10): D01's one list, in place, with an off switch
export const KEYS = [
  ['n', 'Next flag', 'all'], ['p', 'Previous flag', 'all'], ['m', 'Next number (runs on into the next section)', 'all'], ['o', 'Open the number\'s source (second window when it is on)', 'all'],
  ['r', 'Reviewed, next (marks and moves on; never takes a mark off)', 'cpa'], ['a', 'Move to Approve, or to what is left (never approves)', 'cpa'], ['c', 'Comment on the number or flag', 'cpa'], ['s', 'Search: find a number', 'all'],
  [']', 'Next source', 'all'], ['[', 'Previous source', 'all'], ['Esc', 'Back from the source to the number, or close the comment', 'all'],
];
export function keysPanel(readonly) {
  const items = KEYS.filter(([, , who]) => who === 'all' || !readonly).map(([k, v]) => [k, v]);
  return `<details class="app-keys"><summary class="app-keys__summary">Keyboard shortcuts</summary><div class="app-keys__pop" role="group" aria-label="Keyboard shortcuts"><ul class="app-keys__list">${items.map(([k, v]) => `<li><kbd>${esc(k)}</kbd> ${esc(v)}</li>`).join('')}</ul><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="keys-off">Turn single-key shortcuts off</label></div></div></div></details>`;
}

export const miniBar = (R, person) => `<div class="moj-identity-bar" data-identity-bar role="region" aria-label="This return"><div class="govuk-width-container app-wide"><div class="moj-identity-bar__container"><div class="moj-identity-bar__details"><h2 class="moj-identity-bar__title">${esc(R.corp)}</h2><p>Year end ${esc(R.ye)} ${H.tier(R.cfg.tier)}</p></div></div></div></div>`;
