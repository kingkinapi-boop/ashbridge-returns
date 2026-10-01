// Shared fragments for the three versions. Only govuk-, moj- and app- classes.
import { esc, money, DOTS, SECTIONS, SCENARIOS, sectionState, marksLeft, PROTOTYPE_TODAY } from './model.mjs';

const GOVUK = 'https://cdn.jsdelivr.net/npm/govuk-frontend@6.5.1/dist/govuk/';
const MOJ = 'https://cdn.jsdelivr.net/npm/@ministryofjustice/frontend@11/moj/';

let MODE = 'v1';
export const setMode = (m) => { MODE = m; };
const SECSLUG = { bs: 'balance-sheet', is: 'income-statement', s1: 'schedule-1', other: 'other-schedules' };
// where a number lives: its own section tab (versions 1 and 3) or the one Return list (version 2)
export const secUrl = (scn, section, id) => (MODE === 'v2' ? `${scn.slug}-return.html#${id}` : `${scn.slug}-${SECSLUG[section]}.html#${id}`);

export const H = {
  tier: (t) => ({ red: '<strong class="govuk-tag govuk-tag--red">Red tier</strong>', amber: '<strong class="govuk-tag govuk-tag--orange">Amber tier</strong>', green: '<strong class="govuk-tag govuk-tag--green">Green tier</strong>' }[t]),
  tierWord: (t) => ({ red: 'Red', amber: 'Amber', green: 'Green' }[t]),
  flagTier: (t) => ({ red: '<strong class="govuk-tag govuk-tag--red">Red: you decide</strong>', amber: '<strong class="govuk-tag govuk-tag--orange">Amber: check</strong>', green: '<strong class="govuk-tag govuk-tag--green">Green: answered</strong>' }[t]),
  dot: (d) => `<span class="app-dot app-dot--${d}">${DOTS[d]}</span>`,
  tag: (txt, colour) => `<strong class="govuk-tag${colour ? ' govuk-tag--' + colour : ''}">${esc(txt)}</strong>`,
};

export function chg(l) {
  if (l.pct) return '<span class="govuk-visually-hidden">No change</span>0%';
  const d = Math.round((l.cy - l.ly) * 100) / 100;
  if (d === 0) return 'No change';
  const p = l.ly ? Math.round((d / Math.abs(l.ly)) * 100) + '%' : 'new';
  return `${d > 0 ? '+' : '-'}${money(Math.abs(d))} (${d > 0 && l.ly ? '+' : ''}${p})`;
}
export const val = (l, v) => (l.pct ? v + '%' : money(v));

// ---------------------------------------------------------------- page shell
export function shell({ title, ret, scn, h1, main, nav = 'queue', error = false, bodyAttrs = '', proto = '', asset = '../assets/', keys = true, extraHead = '', bare = false }) {
  const t = `${error ? 'Error: ' : ''}${title}${ret ? ' - ' + ret.corp : ''} - Ashbridge Tax`;
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
<meta charset="utf-8">
<title>${esc(t)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#355b7d">
<link rel="stylesheet" href="${GOVUK}govuk-frontend.min.css">
<link rel="stylesheet" href="${MOJ}moj-frontend.min.css">
<link rel="stylesheet" href="${asset}ashbridge.css">
${extraHead}
</head>
<body class="govuk-template__body" ${bodyAttrs}>
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
<header class="govuk-header" data-module="govuk-header">
  <div class="govuk-header__container govuk-header__container--full-width">
    <div class="govuk-header__logo"><a href="queue.html" class="govuk-header__homepage-link"><span class="app-wordmark">Ashbridge <span>Tax</span></span></a></div>
  </div>
</header>
${bare ? "" : `<section aria-label="Service information" class="govuk-service-navigation" data-module="govuk-service-navigation">
  <div class="govuk-width-container app-wide"><div class="govuk-service-navigation__container">
    <span class="govuk-service-navigation__service-name"><a class="govuk-service-navigation__link" href="queue.html">Return review</a></span>
    <nav aria-label="Menu" class="govuk-service-navigation__wrapper"><ul class="govuk-service-navigation__list">
      <li class="govuk-service-navigation__item${nav === 'queue' ? ' govuk-service-navigation__item--active' : ''}"><a class="govuk-service-navigation__link" href="queue.html"${nav === 'queue' ? ' aria-current="true"' : ''}>${nav === 'queue' ? '<strong class="govuk-service-navigation__active-fallback">Review queue</strong>' : 'Review queue'}</a></li>
      <li class="govuk-service-navigation__item"><a class="govuk-service-navigation__link" href="notes.html">Prototype notes</a></li>
    </ul></nav>
  </div></div>
</section>`}
${ret ? identityBar(ret, scn) : ''}
<div class="govuk-width-container app-wide">
  <main class="govuk-main-wrapper govuk-!-padding-top-3 govuk-!-padding-bottom-4" id="main-content" role="main">
${main}
  </main>
</div>
<footer class="govuk-footer"><div class="govuk-width-container app-wide">${proto}<p class="govuk-body-s govuk-!-margin-top-3 govuk-!-margin-bottom-0">Prototype for Zo to look at. Made-up data only (sample clients). Prototype date: ${PROTOTYPE_TODAY}.</p></div></footer>
<div id="app-live" class="govuk-visually-hidden" role="status" aria-live="polite"></div>
<script type="module" src="${GOVUK}govuk-frontend.min.js"></script>
<script type="module">import { initAll } from '${GOVUK}govuk-frontend.min.js'; initAll();</script>
<script src="${MOJ}moj-frontend.min.js"></script>
<script>if (window.MOJFrontend) { window.MOJFrontend.initAll(); }</script>
<script src="${asset}review.js"></script>
</body>
</html>
`;
}

export function identityBar(R, scn) {
  const left = marksLeft(scn).length;
  return `<div class="moj-identity-bar" role="region" aria-label="This return">
  <div class="govuk-width-container app-wide"><div class="moj-identity-bar__container">
    <div class="moj-identity-bar__details"><h2 class="moj-identity-bar__title govuk-!-font-size-24">${esc(R.corp)}</h2>
      <p class="govuk-body govuk-!-margin-bottom-0">Year end ${esc(R.ye)} &nbsp; ${H.tier(R.cfg.tier)} &nbsp; ${scn.kind === 'rework' ? H.tag('Back from rework', 'purple') : H.tag('In review', 'blue')} &nbsp; ${left === 0 ? H.tag('Every section Reviewed', 'green') : H.tag(5 - left + ' of 5 sections Reviewed', 'grey')}</p></div>
  </div></div>
</div>`;
}

// ---------------------------------------------------------------- key legend (rule 10)
export function keysLegend(opts = {}) {
  const items = [['j', 'Next number'], ['k', 'Previous number'], ['f', 'Next flag'], [']', 'Next source'], ['[', 'Previous source'], ['o', 'Open source on second monitor'], ['c', 'Comment'], ['n', 'Next section'], ['r', 'Mark Reviewed'], ['a', 'Approve (when it shows)']];
  return `<div class="app-keys" role="group" aria-label="Keyboard shortcuts"><strong>Keyboard shortcuts:</strong>${items.map(([k, v]) => `<span><kbd>${esc(k)}</kbd> ${esc(v)}</span>`).join('')}
  <span class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><span class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="keys-off">Turn single-key shortcuts off</label></span></span></div>`;
}

// ---------------------------------------------------------------- sub navigation (MOJ)
export function subNav(items, active, label = 'Return sections') {
  return `<nav class="moj-sub-navigation" aria-label="${esc(label)}"><ul class="moj-sub-navigation__list">${items.map((i) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${i.href}"${i.key === active ? ' aria-current="page"' : ''}>${esc(i.title)}${i.badge || ''}</a></li>`).join('')}</ul></nav>`;
}
export const badge = (n, colour = 'grey', word = '') => ` <span class="moj-badge moj-badge--${colour}">${n}${word ? '<span class="govuk-visually-hidden"> ' + esc(word) + '</span>' : ''}</span>`;

// ---------------------------------------------------------------- the return table (one section, fixed printed order)
export function returnTable(lines, { caption, sel, fl, tier, scn, rw }) {
  let group = null, rows = '';
  for (const l of lines) {
    if (l.group !== group && l.group !== 'Total') { group = l.group; rows += `<tr class="app-row--group"><th scope="colgroup" colspan="6">${esc(group)}</th></tr>`; }
    const flags = l.flagIds.map((id) => { const f = fl.find((x) => x.id === id); return `<a class="app-flagmark" href="${scn.slug}-flags.html#${id}">Flag ${esc(id.slice(-3))}<span class="govuk-visually-hidden"> ${esc(f.tier === 'red' ? 'red' : f.tier)}: ${esc(f.title)}</span></a>`; }).join('');
    const reworked = l.reworked ? ' ' + H.tag('Changed by preparer', 'purple') : '';
    const big = l.changed && !l.reworked ? ' ' + H.tag('Large change', 'yellow') : '';
    const cls = [l.kind === 'sub' ? 'app-row--sub' : '', l.flagIds.length ? 'app-row--flag' : '', (l.changed || l.reworked) ? 'app-row--changed' : '', l.id === sel ? 'is-selected' : ''].filter(Boolean).join(' ');
    rows += `<tr class="${cls}" data-row="${l.id}" data-section="${l.section}" data-label="${esc(l.label)}"${l.flagIds.length ? ' data-flagged' : ''}>
<th scope="row" class="govuk-table__header"><button type="button" class="app-rowbtn" data-pick aria-pressed="${l.id === sel}">${esc(l.label)}${l.acct ? ' <span class="govuk-visually-hidden">account ' + l.acct + '</span>' : ''}</button></th>
<td>${H.dot(l.dot)}</td><td class="app-money">${val(l, l.cy)}</td><td class="app-money">${val(l, l.ly)}</td><td class="app-money${l.changed ? ' app-change--big' : ''}">${chg(l)}</td><td>${flags}${big}${reworked}</td></tr>`;
  }
  return `<table class="govuk-table app-return"><caption class="govuk-table__caption govuk-visually-hidden">${esc(caption)}</caption>
<thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Status</th><th scope="col" class="govuk-table__header app-money">This year</th><th scope="col" class="govuk-table__header app-money">Last year</th><th scope="col" class="govuk-table__header app-money">Change</th><th scope="col" class="govuk-table__header">Flags and marks</th></tr></thead>
<tbody class="govuk-table__body">${rows}</tbody></table>`;
}

// ---------------------------------------------------------------- sources
const stmtAmt = (t) => money(t.amount);
export function sourceCaption(s, k, n) {
  let base;
  if (s.kind === 'statement') base = `${s.title}, ${s.month}, page ${s.page}`;
  else if (s.kind === 'closing') base = `${s.role === 'card' ? 'Card' : 'Bank'} statement, ${monthLabel(s.month)}, last page`;
  else if (s.kind === 'sheet') base = `${s.title}, sheet ${s.sheet}, row ${s.hitRow}, column ${s.hitCol}`;
  else base = s.title;
  return `${base} (source ${k + 1} of ${n})`;
}
const monthLabel = (ym) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);

export function sourceBody(s) {
  if (s.kind === 'statement') {
    const rows = s.rows.map((t) => {
      const hit = t.id === s.hit;
      return `<tr class="${hit ? 'app-source__hit' : 'app-source__faded'}"><td>${esc(t.date)}</td><td>${esc(t.description)}</td><td class="app-num">${stmtAmt(t)}${hit ? ` <span class="app-source__label">Boxed figure: ${money(s.hitAmt)}</span>` : ''}</td></tr>`;
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
  return `<div class="app-card"><h4>${esc(s.title)}</h4><p class="govuk-body-s">Not a document page. ${s.kind === 'cra' ? 'A capture from CRA My Business Account (test).' : s.kind === 'answer' ? 'An answer the client gave in the client app.' : 'A figure carried from a calculation or a prior return.'}</p><dl>${s.fields.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>`;
}

// the source pane content for one number (every source, one visible); state: normal | loading | failed
export function sourcePaneBody(key, srcs, { sel, state = 'normal', commentHref = '#', label = '', retry = '#' }) {
  if (!srcs.length) {
    return `<div data-nosource="${key}"${sel ? '' : ' hidden'}><div class="app-card"><h4>Not checked: no evidence</h4><p>No statement page, entry, client answer or capture was found for this number (CK-2). It stays marked "Not checked: no evidence" until something is attached.</p><p class="govuk-body-s">The sources list is empty, so there is no boxed figure to show.</p><a class="govuk-link" href="${commentHref}">Comment: missing evidence</a></div></div>`;
  }
  const n = srcs.length;
  return srcs.map((s, k) => {
    const hidden = !(sel && k === 0);
    let inner;
    if (sel && k === 0 && state === 'loading') inner = `<div role="status" aria-live="polite"><p class="app-caption">${esc(sourceCaption(s, k, n))}</p><p class="govuk-body">Loading source ${k + 1} of ${n}...</p><div class="app-skeleton"></div><div class="app-skeleton"></div><div class="app-skeleton"></div><div class="app-skeleton"></div></div>`;
    else if (sel && k === 0 && state === 'failed') inner = `<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>The page image for source ${k + 1} of ${n} did not load. The number is not marked Traced until you see it.</strong></div><p class="app-caption">${esc(sourceCaption(s, k, n))}</p><p><a class="govuk-link" href="${retry}">Try again</a> or <a class="govuk-link" href="${commentHref}">comment: missing evidence</a></p>`;
    else inner = `<p class="app-caption">${esc(sourceCaption(s, k, n))}</p>${sourceBody(s)}`;
    return `<section data-source="${key}:${k}"${hidden ? ' hidden' : ''} aria-label="Source ${k + 1} of ${n} for ${esc(label)}">${inner}</section>`;
  }).join('');
}

export function sourceButtons(n, extra = '') {
  return `<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-prev aria-keyshortcuts="[">Previous source</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-next aria-keyshortcuts="]">Next source</button>${extra}`;
}

// ---------------------------------------------------------------- trace
const statusOf = (s) => ({ sheet: ['green', 'Traced'], statement: ['green', 'Traced'], closing: ['green', 'Traced'], cra: ['green', 'Traced'], prior: ['green', 'Traced'], entry: ['purple', 'Entry or judgement'], answer: ['purple', 'Entry or judgement'], computed: ['purple', 'Computed'] }[s.kind]);
export function traceBody(l, R, scn, { sel, key, srcsOverride }) {
  const srcs = srcsOverride || l.srcs;
  const fl = l.flagIds.map((id) => R.flags.find((f) => f.id === id));
  const notes = R.cfg.comments.filter((c) => c.line === l.id);
  const agrees = [];
  if (l.kind !== 'sub' && !l.pct && l.acct) {
    agrees.push(['QuickBooks balance (test company)', money(l.cy), 'Agrees']);
    agrees.push([`Taxprep GIFI ${l.gifi}`, money(l.cy), 'Agrees']);
    if (l.dot === 'amber') agrees.push(['Statement pages for every transaction', 'Two items have no page', 'Does not agree: partly traced']);
    if (l.dot === 'grey') agrees.push(['Statement pages for every transaction', 'None found', 'Not checked: no evidence']);
  } else if (l.id === 'n-net-income') agrees.push(['Schedule 1, first line', money(l.cy), 'Agrees']);
  else if (l.id === 'n-total-assets' || l.id === 'n-total-le') agrees.push(['Total liabilities and equity', money(R.byId['n-total-le'].cy), 'Agrees']);
  else agrees.push(['Taxprep', money(l.cy), 'Agrees']);
  const srcRows = srcs.length ? srcs.map((s, k) => { const [d, w] = statusOf(s); return `<tr><td class="govuk-table__cell">${k + 1}</td><td class="govuk-table__cell"><button type="button" class="app-rowbtn" data-goto="${k}">${esc(sourceCaption(s, k, srcs.length).replace(/ \(source.*$/, ''))}</button></td><td class="govuk-table__cell">${H.dot(d)}</td></tr>`; }).join('') : `<tr><td class="govuk-table__cell" colspan="3">${H.dot('grey')} No sources found.</td></tr>`;
  return `<div data-trace="${key}"${sel ? '' : ' hidden'}>
<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${esc(l.label)}: ${val(l, l.cy)}</h3>
<dl class="govuk-summary-list govuk-summary-list--no-border">
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Status</dt><dd class="govuk-summary-list__value">${H.dot(l.dot)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Built from</dt><dd class="govuk-summary-list__value">${esc(l.built)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Last year</dt><dd class="govuk-summary-list__value">${val(l, l.ly)}, change ${chg(l)}${l.section === 'is' ? '<br><span class="govuk-hint govuk-!-margin-bottom-0">Last year is made up for the test.</span>' : ''}</dd></div>
${fl.length ? `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Flags</dt><dd class="govuk-summary-list__value">${fl.map((f) => `<a class="govuk-link" href="${scn.slug}-flags.html#${f.id}">${esc(f.id)} ${esc(f.title)}</a>`).join('<br>')}</dd></div>` : ''}
</dl>
<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Sources${l.total && l.total > 3 ? ` (largest 3 of ${l.total} transactions)` : ''}</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">No.</th><th scope="col" class="govuk-table__header">Source</th><th scope="col" class="govuk-table__header">Status</th></tr></thead><tbody class="govuk-table__body">${srcRows}</tbody></table>
<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Agrees with</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Compared with</th><th scope="col" class="govuk-table__header app-money">Value</th><th scope="col" class="govuk-table__header">Result</th></tr></thead><tbody class="govuk-table__body">${agrees.map(([a, b, c]) => `<tr><td class="govuk-table__cell">${esc(a)}</td><td class="govuk-table__cell app-money">${esc(b)}</td><td class="govuk-table__cell">${esc(c)}</td></tr>`).join('')}</tbody></table>
<h4 class="govuk-heading-s govuk-!-margin-bottom-1">Notes</h4>
${notes.length ? notes.map((c) => `<p class="govuk-body-s govuk-!-margin-bottom-1"><strong>${esc(c.id)} ${esc(c.type)}, ${esc(c.severity)}</strong> (${esc(c.status)}): ${esc(c.text)}</p>`).join('') : '<p class="govuk-body-s">No notes on this number.</p>'}
</div>`;
}

// ---------------------------------------------------------------- reviewed mark (RV-5) bar
export function openFlags(R, scn) { return R.flags.filter((f) => !isDecided(R, scn, f)); }
export const isDecided = (R, scn, f) => scn.kind === 'ready' || (R.cfg.decided[scn.kind === 'rework' ? 'rework' : 'progress'] || []).includes(f.id);

export function markBar(R, scn, key, { rw, back } = {}) {
  const idx = SECTIONS.findIndex((s) => s.key === key);
  const sec = SECTIONS[idx];
  const st = sectionState(scn, key);
  const next = SECTIONS[idx + 1];
  const left = marksLeft(scn).filter((s) => s.key !== key || st.state !== 'on');
  const done = 5 - marksLeft(scn).length;
  let tag, btn = '', why = '';
  if (st.state === 'on') { tag = `<strong class="govuk-tag govuk-tag--green" data-mark-state>Reviewed by ${esc(st.who)}, ${esc(st.when)}</strong>`; btn = `<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-mark aria-pressed="true" aria-keyshortcuts="r">Reviewed by Zo. Take mark off</button>`; }
  else if (st.state === 'off') { tag = `<strong class="govuk-tag govuk-tag--red" data-mark-state>Mark came off</strong>`; btn = `<button type="button" class="govuk-button app-btn-sm" data-mark aria-pressed="false" aria-keyshortcuts="r">Mark section Reviewed</button>`; why = rw ? `<p class="govuk-body-s govuk-!-margin-bottom-0 govuk-!-margin-top-1"><strong>Why the mark came off:</strong> ${esc(R.byId[rw.rw.to].label)} changed from ${money(rw.before[rw.rw.to])} to ${money(R.byId[rw.rw.to].cy)} and ${esc(R.byId[rw.rw.from].label)} from ${money(rw.before[rw.rw.from])} to ${money(R.byId[rw.rw.from].cy)}, by ${esc(rw.rw.who)}, ${esc(rw.rw.when)} (answering ${esc(rw.rw.comment)}). Re-mark it when you have looked at the changed numbers.</p>` : ''; }
  else {
    tag = `<strong class="govuk-tag govuk-tag--grey" data-mark-state>Not reviewed</strong>`;
    if (key === 'flags' && openFlags(R, scn).length) btn = `<span class="govuk-body-s govuk-!-margin-0">${openFlags(R, scn).length} flags still need a decision. Step through them with <kbd>f</kbd>; the Reviewed mark appears when none is open.</span>`;
    else btn = `<button type="button" class="govuk-button app-btn-sm" data-mark aria-pressed="false" aria-keyshortcuts="r">Mark section Reviewed</button>`;
  }
  const leftLinks = marksLeft(scn).filter((s) => s.key !== key).map((s) => `<a class="govuk-link" href="${scn.slug}-${s.slug}.html">${esc(s.title)}</a>`);
  const allDone = marksLeft(scn).length === 0;
  const approve = allDone
    ? `<a href="${scn.slug}-approved.html" role="button" draggable="false" class="govuk-button govuk-button--start app-btn-sm" data-key="a" aria-keyshortcuts="a">Approve return</a>`
    : `<span class="govuk-body-s govuk-!-margin-0">Left before Approve shows: ${leftLinks.length ? leftLinks.join(', ') : 'mark this section'}.</span>`;
  return `<div class="app-strip" role="group" aria-label="Reviewed mark for ${esc(sec.title)}">
<strong>Section ${idx + 1} of 5: ${esc(sec.title)}</strong> ${tag} ${btn}
<span><progress class="app-progress" value="${done}" max="5" aria-label="Sections Reviewed">${done} of 5</progress> ${done} of 5 sections Reviewed</span>
${next ? `<a class="govuk-link" data-key="n" aria-keyshortcuts="n" href="${scn.slug}-${next.slug}.html">Next section: ${esc(next.title)}</a>` : `<a class="govuk-link" href="${scn.slug}-comments.html">Next: Comments</a>`}
${approve}
${why}</div>`;
}

// ---------------------------------------------------------------- flags
export function flagDetail(f, R, scn, { sel }) {
  const decided = isDecided(R, scn, f);
  return `<div data-trace="${f.id}"${sel ? '' : ' hidden'}>
<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${esc(f.id)} ${esc(f.title)}</h3>
<p>${H.flagTier(f.tier)} ${decided ? H.tag('Accepted by Zo', 'green') : H.tag('Open', 'grey')}</p>
<dl class="govuk-summary-list govuk-summary-list--no-border">
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Dollar effect</dt><dd class="govuk-summary-list__value">${esc(f.effectText)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Preparer's answer</dt><dd class="govuk-summary-list__value">${esc(f.answer)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Cites</dt><dd class="govuk-summary-list__value">${esc(f.cites)}. <a class="govuk-link" href="${secUrl(scn, R.byId[f.where].section, f.where)}">Open the number</a></dd></div>
</dl>
${decided ? '<p class="govuk-body-s">Decision recorded. Press <kbd>f</kbd> for the next flag.</p>' : `<form action="${scn.slug}-flags.html" method="get"><div class="govuk-form-group govuk-!-margin-bottom-2"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Your decision on ${esc(f.id)}</legend><div class="govuk-radios govuk-radios--small" data-module="govuk-radios"><div class="govuk-radios__item"><input class="govuk-radios__input" id="d-${f.id}-a" name="d-${f.id}" type="radio" value="accept"><label class="govuk-label govuk-radios__label" for="d-${f.id}-a">Accept the risk</label></div><div class="govuk-radios__item"><input class="govuk-radios__input" id="d-${f.id}-s" name="d-${f.id}" type="radio" value="send"><label class="govuk-label govuk-radios__label" for="d-${f.id}-s">Send back to the preparer</label></div></div></fieldset></div><button class="govuk-button app-btn-sm" data-module="govuk-button">Record decision</button></form>`}
</div>`;
}
export function flagList(R, scn, sel) {
  return `<table class="govuk-table app-return"><caption class="govuk-table__caption govuk-visually-hidden">Flags: red first, then dollar effect</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Flag</th><th scope="col" class="govuk-table__header">Tier</th><th scope="col" class="govuk-table__header app-money">Effect</th><th scope="col" class="govuk-table__header">State</th></tr></thead><tbody class="govuk-table__body">
${R.flags.map((f) => `<tr data-row="${f.id}" data-label="${esc(f.id + ' ' + f.title)}" data-flagged class="${[f.tier === 'red' ? 'app-row--flag' : '', f.id === sel ? 'is-selected' : ''].join(' ').trim()}" id="${f.id}"><th scope="row" class="govuk-table__header"><button type="button" class="app-rowbtn" data-pick aria-pressed="${f.id === sel}">${esc(f.id.slice(-3))} ${esc(f.title)}</button></th><td>${H.tierWord(f.tier)}</td><td class="app-money">${f.effect === null ? 'Not stated' : money(f.effect)}</td><td>${isDecided(R, scn, f) ? 'Accepted' : 'Open'}</td></tr>`).join('')}
</tbody></table>`;
}

// ---------------------------------------------------------------- comments, history
export function commentsTable(R, scn, linkPrefix) {
  const cs = R.cfg.comments.map((c) => ({ ...c }));
  if (scn.kind === 'rework') { cs.find((c) => c.id === 'C-2').status = 'Answered: preparer changed the numbers'; }
  if (!cs.length) return `<div class="govuk-inset-text"><p class="govuk-body"><strong>No comments on this return yet.</strong></p><p class="govuk-body">Press <kbd>c</kbd> on any number to comment. Comments you send go to ${esc(R.cfg.preparer)}.</p></div>`;
  const secOf = (id) => ({ bs: 'balance-sheet', is: 'income-statement', s1: 'schedule-1', other: 'other-schedules' }[R.byId[id].section]);
  return `<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Comments, newest last (${cs.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">No.</th><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Type</th><th scope="col" class="govuk-table__header">Severity</th><th scope="col" class="govuk-table__header">Comment</th><th scope="col" class="govuk-table__header">State</th><th scope="col" class="govuk-table__header">Who and when</th></tr></thead><tbody class="govuk-table__body">
${cs.map((c) => `<tr><td class="govuk-table__cell">${c.id}</td><td class="govuk-table__cell"><a class="govuk-link" href="${secUrl(scn, R.byId[c.line].section, c.line)}">${esc(R.byId[c.line].label)}</a></td><td class="govuk-table__cell">${esc(c.type)}</td><td class="govuk-table__cell">${esc(c.severity)}</td><td class="govuk-table__cell">${esc(c.text)}</td><td class="govuk-table__cell">${esc(c.status)}</td><td class="govuk-table__cell">${esc(c.who)}, ${esc(c.when)}</td></tr>`).join('')}</tbody></table>`;
}

export function timeline(R, scn) {
  const ev = R.cfg.history.map((e) => [...e]);
  if (scn.kind === 'rework') {
    ev.push(['10 Mar 2026, 10:20', 'Schedule 1 and Other schedules marked Reviewed', 'Zo', '']);
    ev.push(['10 Mar 2026, 10:40', 'Returned to the preparer', 'Zo', 'Comments C-1 to C-3.']);
    ev.push(['10 Mar 2026, 14:10', 'Preparer changed two numbers', R.cfg.rework.who, 'Moved $180.00 from Office expenses to Software and computer expenses (answering C-2). Income statement mark came off.']);
  }
  if (scn.kind === 'ready') ev.push(['10 Mar 2026, 11:33', 'Every section marked Reviewed', 'Zo', 'Approve now shows.']);
  return `<div class="moj-timeline">${ev.map(([when, title, who, desc]) => `<div class="moj-timeline__item"><div class="moj-timeline__header"><h3 class="moj-timeline__title">${esc(title)}</h3><p class="moj-timeline__byline">by ${esc(who)}</p></div><p class="moj-timeline__date"><time datetime="">${esc(when)}</time></p>${desc ? `<div class="moj-timeline__description"><p class="govuk-body">${esc(desc)}</p></div>` : ''}</div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- the comment form (GOV.UK error pattern)
export function commentForm({ line, R, scn, error = false, action }) {
  const typeErr = error ? 'Select the type of comment' : '';
  const sevErr = error ? 'Select how serious it is' : '';
  const radios = (name, items, err) => `<div class="govuk-form-group${err ? ' govuk-form-group--error' : ''}"><fieldset class="govuk-fieldset" aria-describedby="${name}-hint${err ? ' ' + name + '-error' : ''}"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">${name === 'type' ? 'Type of comment' : 'Severity'}<span class="govuk-visually-hidden"> (required)</span> <span aria-hidden="true" class="app-required">*</span></legend><div id="${name}-hint" class="govuk-hint">${name === 'type' ? 'Pick the one that fits best.' : 'Must fix goes to the top of the list for the preparer. Note is for information.'}</div>${err ? `<p id="${name}-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ${err}</p>` : ''}<div class="govuk-radios govuk-radios--small" data-module="govuk-radios">${items.map((t, i) => `<div class="govuk-radios__item"><input class="govuk-radios__input" id="${name}-${i}" name="${name}" type="radio" value="${esc(t)}"${i === 0 && err ? ' ' : ''}><label class="govuk-label govuk-radios__label" for="${name}-${i}">${esc(t)}</label></div>`).join('')}</div></fieldset></div>`;
  return `
<form action="${action}" method="get" novalidate>
<h3 class="govuk-heading-s">Comment on ${esc(line.label)} (${val(line, line.cy)})</h3>
${radios('type', ['Error', 'Question', 'Missing evidence', 'Presentation'], typeErr)}
${radios('severity', ['Must fix', 'Should fix', 'Note'], sevErr)}
<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="text">Comment</label><div id="text-hint" class="govuk-hint">Optional for presentation. Say what you want done.</div><textarea class="govuk-textarea" id="text" name="text" rows="3" aria-describedby="text-hint"></textarea></div>
<button class="govuk-button app-btn-sm" data-module="govuk-button" data-prevent-double-click="true">Add comment</button> <a class="govuk-link" href="${action.replace('-commented', '').replace('-comment-error', '')}">Cancel</a>
</form>`;
}

// ---------------------------------------------------------------- brief parts
export function sixTable(R, scn, tl = 'six') {
  return `<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Six numbers against last year</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header app-money">This year</th><th scope="col" class="govuk-table__header app-money">Last year</th><th scope="col" class="govuk-table__header app-money">Change</th><th scope="col" class="govuk-table__header">Status</th></tr></thead><tbody class="govuk-table__body">
${R.six.map((id) => { const l = R.byId[id]; const sec = { bs: 'balance-sheet', is: 'income-statement', s1: 'schedule-1', other: 'other-schedules' }[l.section]; return `<tr><th scope="row" class="govuk-table__header"><a class="govuk-link" href="${secUrl(scn, l.section, l.id)}">${esc(l.label)}</a></th><td class="govuk-table__cell app-money">${money(l.cy)}</td><td class="govuk-table__cell app-money">${money(l.ly)}</td><td class="govuk-table__cell app-money">${chg(l)}</td><td class="govuk-table__cell">${H.dot(l.dot)}</td></tr>`; }).join('')}</tbody></table>`;
}
export function pinnedFlags(R, scn, max) {
  return `<div class="app-scroll" role="region" aria-label="Pinned flags" tabindex="0"><table class="govuk-table govuk-!-margin-bottom-0"><caption class="govuk-table__caption govuk-table__caption--s">Pinned flags: red first, then dollar effect (${R.flags.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Flag</th><th scope="col" class="govuk-table__header">Effect</th><th scope="col" class="govuk-table__header">Preparer's answer</th></tr></thead><tbody class="govuk-table__body">
${R.flags.slice(0, max || 99).map((f) => `<tr><td class="govuk-table__cell">${H.flagTier(f.tier)}<br><a class="govuk-link" href="${scn.slug}-flags.html#${f.id}">${esc(f.id.slice(-3))} ${esc(f.title)}</a></td><td class="govuk-table__cell">${esc(f.effectText)}</td><td class="govuk-table__cell">${esc(f.answer)}</td></tr>`).join('')}</tbody></table></div>`;
}
export function changesList(R) {
  const ch = R.lines.filter((l) => l.changed).slice(0, 4);
  return `<ul class="app-lines">${ch.map((l) => `<li>${esc(l.label)}: ${val(l, l.cy)} against ${val(l, l.ly)} (${chg(l)})</li>`).join('') || '<li>No large changes.</li>'}</ul><p class="govuk-body-s govuk-!-margin-bottom-0">${R.lines.filter((l) => l.changed).length} large changes in all, marked in each section.</p>`;
}
export function assumptionsList(R) {
  const k = R.key;
  const items = R.which === 'red'
    ? ['HST regular, filed quarterly; Q4 paid 30 Jan 2026.', 'No interest on the shareholder loan.', 'Home office not claimed until you decide.', 'Last year\'s income figures are made up for the test.']
    : ['HST annual filer with instalments.', 'US-dollar sales at the monthly test rate.', 'Laptop class 50 and camera class 8, cost before HST.', 'Last year\'s income figures are made up for the test.'];
  return `<ul class="app-lines">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}
export function attestationsList(R) {
  return `<ul class="app-lines"><li>${esc(R.cfg.preparer)}: books agree to the bank and card statements, 5 Mar 2026.</li><li>Client app: owner confirmed the onboarding answers.</li><li>${R.which === 'red' ? 'Not yet: resolution for the $20,000.00 dividend.' : 'Owner signed the annual HST instalment summary.'}</li></ul>`;
}
export function protoStrip(version, scn) {
  const rows = Object.values(SCENARIOS).map((s) => `<li><a class="govuk-link" href="${s.slug}-brief.html">${esc(s.label)}</a></li>`).join('');
  const extra = scn.slug === 'red' ? (version === 'v2' ? `<li><a class="govuk-link" href="red-return-no-evidence.html">Number with no evidence</a></li><li><a class="govuk-link" href="red-return-source-loading.html">Source loading</a></li><li><a class="govuk-link" href="red-return-source-failed.html">Source failed to load</a></li><li><a class="govuk-link" href="red-comment.html">Comment form</a></li><li><a class="govuk-link" href="red-comment-error.html">Comment form with errors</a></li><li><a class="govuk-link" href="red-send-back.html">Send back</a></li>` : `<li><a class="govuk-link" href="red-income-statement-no-evidence.html">Number with no evidence</a></li><li><a class="govuk-link" href="red-income-statement-source-loading.html">Source loading</a></li><li><a class="govuk-link" href="red-income-statement-source-failed.html">Source failed to load</a></li><li><a class="govuk-link" href="red-income-statement-comment.html">Comment form</a></li><li><a class="govuk-link" href="red-income-statement-comment-error.html">Comment form with errors</a></li><li><a class="govuk-link" href="red-send-back.html">Send back</a></li>`) : '';
  return `<details class="govuk-details govuk-!-margin-top-3"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Prototype: jump to a state</span></summary><div class="govuk-details__text"><ul class="govuk-list govuk-list--bullet">${rows}<li><a class="govuk-link" href="queue.html">Queue</a></li><li><a class="govuk-link" href="queue-empty.html">Queue, empty</a></li>${extra}</ul></div></details>`;
}

// ---------------------------------------------------------------- queue (task 1)
export function commentErrorSummary() {
  return `<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#type-0">Select the type of comment</a></li><li><a href="#severity-0">Select how serious it is</a></li></ul></div></div></div>`;
}

export const QUEUE = [
  { name: 'Bluewater Renovations Inc. (Test)', ye: '30 Jun 2025', tier: 'red', due: '31 Dec 2025', dueIso: '2025-12-31', state: 'Ready for review', blocks: '2 red flags open', overdue: true },
  { name: 'Maple Ridge Consulting Inc. (Test)', ye: '31 Dec 2025', tier: 'red', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Ready for review', blocks: '4 red flags open', open: 'red' },
  { name: 'Eglinton Holdings Inc. (Test)', ye: '31 Dec 2025', tier: 'red', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Ready for review', blocks: '3 red flags open' },
  { name: 'Eglinton Retail Ltd. (Test)', ye: '31 Dec 2025', tier: 'amber', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Back from rework', blocks: '2 changed numbers to re-check' },
  { name: 'Queen West Design Studio Inc. (Test)', ye: '30 Sep 2025', tier: 'green', due: '31 Mar 2026', dueIso: '2026-03-31', state: 'Ready for review', blocks: 'Nothing blocks', open: 'green' },
  { name: 'Riverdale Rentals Inc. (Test)', ye: '31 Dec 2025', tier: 'green', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Ready for review', blocks: 'Nothing blocks' },
];
export function queuePage(version, empty) {
  const tierTagQ = (t) => H.tier(t);
  const main = empty
    ? `<h1 class="govuk-heading-l">Review queue</h1><div class="govuk-inset-text"><p class="govuk-body"><strong>No returns are waiting for your review.</strong></p><p class="govuk-body">New returns appear here when a preparer sends them. Nothing to do now.</p></div>`
    : `<h1 class="govuk-heading-l govuk-!-margin-bottom-3">Review queue</h1>
<p class="govuk-body">${QUEUE.length} returns waiting. Ordered by tier (red first), then due date. Select a heading to sort. Open a return with its name.</p>
<div class="govuk-inset-text">This prototype opens two returns: Maple Ridge (red tier) and Queen West (green tier). The other rows show the list only.</div>
<table class="govuk-table" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-visually-hidden">Returns waiting for review, ordered by tier then due date</caption><thead class="govuk-table__head"><tr>
<th scope="col" class="govuk-table__header" aria-sort="none">Return</th><th scope="col" class="govuk-table__header" aria-sort="none">Year end</th><th scope="col" class="govuk-table__header" aria-sort="ascending">Tier</th><th scope="col" class="govuk-table__header" aria-sort="none">Due</th><th scope="col" class="govuk-table__header" aria-sort="none">State</th><th scope="col" class="govuk-table__header" aria-sort="none">What blocks</th></tr></thead><tbody class="govuk-table__body">
${QUEUE.map((q) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${q.open ? `<a class="govuk-link" href="${q.open}-brief.html">${esc(q.name)}</a>` : esc(q.name)}</th><td class="govuk-table__cell" data-sort-value="${q.ye}">${q.ye}</td><td class="govuk-table__cell" data-sort-value="${{ red: 1, amber: 2, green: 3 }[q.tier]}">${tierTagQ(q.tier)}</td><td class="govuk-table__cell" data-sort-value="${q.dueIso}">${q.due}${q.overdue ? ' ' + H.tag('Overdue', 'red') : ''}</td><td class="govuk-table__cell">${q.state}</td><td class="govuk-table__cell">${q.blocks}</td></tr>`).join('')}</tbody></table>`;
  return { main };
}
