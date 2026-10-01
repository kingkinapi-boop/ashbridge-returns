// Version 1, second round: ONE return record page per scenario. Section and tab changes are client-side routes (hash URLs, 0 page loads).
// Run through build.mjs. Only govuk-, moj- and app- classes. No inline style, no zoom.
import { esc, money, SECTIONS, SCENARIOS, getReturn, reworkView, PROTOTYPE_TODAY } from './model.mjs';
import { H, chg, val, sourceBody, sourceCaption, statusOf } from './ui.mjs';

const GOVUK = 'https://cdn.jsdelivr.net/npm/govuk-frontend@6.5.1/dist/govuk/';
const MOJ = 'https://cdn.jsdelivr.net/npm/@ministryofjustice/frontend@11/moj/';
export const BLUEPRINT_COMMIT = 'b9c5003';
const NOW = '10 Mar 2026, 11:40';
const slugOf = (key) => SECTIONS.find((s) => s.key === key).slug;
const route = (R, id) => { const l = R.byId[id]; return `#/${slugOf(l.section)}/${id}`; };
const jsonSafe = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

// ---------------------------------------------------------------- page frame (Generic header with the Ashbridge Tax wordmark)
export function frame({ title, main, ret, error = false, bodyAttrs = '', nav = 'queue', bare = false, scripts = '', foot = '' }) {
  const t = `${error ? 'Error: ' : ''}${title}${ret ? ' - ' + ret.corp : ''} - Ashbridge Tax`;
  const serviceNav = bare ? '' : `<section aria-label="Service information" class="govuk-service-navigation" data-module="govuk-service-navigation"><div class="govuk-width-container app-wide"><div class="govuk-service-navigation__container"><span class="govuk-service-navigation__service-name">${nav === 'queue' ? '<span class="govuk-service-navigation__text">Return review</span>' : '<a class="govuk-service-navigation__link" href="queue.html">Return review</a>'}</span><nav aria-label="Menu" class="govuk-service-navigation__wrapper"><button type="button" class="govuk-service-navigation__toggle govuk-js-service-navigation-toggle" aria-controls="navigation" hidden>Menu</button><ul class="govuk-service-navigation__list" id="navigation"><li class="govuk-service-navigation__item${nav === 'queue' ? ' govuk-service-navigation__item--active' : ''}"><a class="govuk-service-navigation__link" href="queue.html"${nav === 'queue' ? ' aria-current="true"' : ''}>${nav === 'queue' ? '<strong class="govuk-service-navigation__active-fallback">Review queue</strong>' : 'Review queue'}</a></li><li class="govuk-service-navigation__item${nav === 'notes' ? ' govuk-service-navigation__item--active' : ''}"><a class="govuk-service-navigation__link" href="notes.html"${nav === 'notes' ? ' aria-current="true"' : ''}>${nav === 'notes' ? '<strong class="govuk-service-navigation__active-fallback">Prototype notes</strong>' : 'Prototype notes'}</a></li></ul></nav></div></div></section>`;
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
<meta charset="utf-8">
<title>${esc(t)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#355b7d">
<link rel="stylesheet" href="${GOVUK}govuk-frontend.min.css">
<link rel="stylesheet" href="${MOJ}moj-frontend.min.css">
<link rel="stylesheet" href="../assets/ashbridge-v1.css">
</head>
<body class="govuk-template__body" ${bodyAttrs}>
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
<header class="govuk-header" data-module="govuk-header"><div class="govuk-header__container govuk-header__container--full-width"><div class="govuk-header__logo"><a href="queue.html" class="govuk-header__homepage-link"><span class="app-wordmark">Ashbridge <span>Tax</span></span></a></div></div></header>
${serviceNav}
${main}
${foot}
<div id="app-live" class="govuk-visually-hidden" role="status" aria-live="polite"></div>
<script type="module">import { initAll } from '${GOVUK}govuk-frontend.min.js'; initAll();</script>
<script type="module">import { initAll as mojInit } from '${MOJ}moj-frontend.min.js'; mojInit();</script>
${scripts}
</body>
</html>
`;
}
const wrapMain = (inner, cls = '') => `<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper app-main ${cls}" id="main-content" role="main">${inner}</main></div>`;
const footNote = (extra = '') => `<footer class="govuk-footer app-footer"><div class="govuk-width-container app-wide">${extra}<p class="govuk-body-s govuk-!-margin-bottom-0">Prototype for Zo to look at. Made-up data only (sample clients). Prototype date: ${PROTOTYPE_TODAY}. Written against blueprint commit ${BLUEPRINT_COMMIT}.</p></div></footer>`;

// ---------------------------------------------------------------- pieces
const madeTag = (l) => (l.madeUp ? ' <span class="app-madeup">Made up</span>' : '');

function rowsFor(R, sec, lines) {
  let group = null, rows = '';
  for (const l of lines) {
    const g = sec.key === 'stmt' ? (l.group === 'Total' ? null : (l.part === 'bs' ? 'Balance sheet: ' : 'Income statement: ') + l.group) : l.group === 'Total' ? null : l.group;
    if (g && g !== group) { group = g; rows += `<tr class="app-row--group"><td colspan="3"><strong>${esc(g)}</strong></td></tr>`; }
    const flags = l.flagIds.map((id) => { const f = R.flags.find((x) => x.id === id); return `<a class="app-flagmark" href="#/flags/${id}">Flag ${esc(id.slice(-3))}<span class="govuk-visually-hidden"> ${esc(f.tier)}: ${esc(f.title)}</span></a>`; }).join('');
    const reworked = l.reworked ? ' ' + H.tag('Changed by preparer', 'purple') : '';
    const big = l.changed && !l.reworked ? ' ' + H.tag('Large change', 'yellow') : '';
    const cls = [l.kind === 'sub' ? 'app-row--sub' : '', l.flagIds.length ? 'app-row--flag' : '', (l.changed || l.reworked) ? 'app-row--changed' : ''].filter(Boolean).join(' ');
    rows += `<tr class="${cls}" data-row="${l.id}" data-section="${sec.key}" data-label="${esc(l.label)}"${l.flagIds.length ? ' data-flagged' : ''}><th scope="row" class="govuk-table__header"><button type="button" class="app-rowbtn" data-pick>${esc(l.label)}${l.acct ? ' <span class="govuk-visually-hidden">account ' + l.acct + '</span>' : ''}</button>${madeTag(l)}<span class="app-meta">${H.dot(l.dot)}${flags}${big}${reworked}</span></th><td class="app-money">${val(l, l.cy)}</td><td class="app-money">${val(l, l.ly)}<br><span class="app-change${l.changed ? ' app-change--big' : ''}">${chg(l)}</span></td></tr>`;
  }
  return `<table class="govuk-table app-return"><caption class="govuk-table__caption govuk-visually-hidden">${esc(sec.title)}, year ended ${esc(R.ye)}, in printed order</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number and status</th><th scope="col" class="govuk-table__header app-money">This year</th><th scope="col" class="govuk-table__header app-money">Last year and change</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table>`;
}

function printedPanel(R, sec) {
  const pages = R.printed[sec.key];
  return `<div class="app-printed" data-printed="${sec.key}"><p class="app-ref">${esc(sec.ref)}. Not drawn as a structured view: the printed return's pages, with a mark like every other section (RV-9).</p>
${pages.map((p, i) => `<section class="app-page" data-page="${sec.key}:${i}"${i ? ' hidden' : ''} aria-label="Printed return page ${p.no} of ${p.of}"><p class="app-caption">Printed return, page ${p.no} of ${p.of}: ${esc(p.title)} (page ${i + 1} of ${pages.length} for this section)</p><table class="app-printed__table"><caption class="govuk-visually-hidden">${esc(p.title)}</caption><tbody>${p.rows.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td class="app-num">${esc(b)}</td></tr>`).join('')}</tbody></table></section>`).join('')}
<div class="app-pagebtns"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-page-prev aria-keyshortcuts="[">Previous page</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-page-next aria-keyshortcuts="]">Next page</button></div></div>`;
}

function flagsPanel(R) {
  const rows = R.flags.map((f) => `<tr data-row="${f.id}" data-section="flags" data-label="${esc(f.id + ' ' + f.title)}" data-flagged class="${f.tier === 'red' ? 'app-row--flag' : ''}"><th scope="row" class="govuk-table__header"><button type="button" class="app-rowbtn" data-pick>${esc(f.id.slice(-3))} ${esc(f.title)}</button><span class="app-meta">${H.flagTier(f.tier)}</span></th><td class="app-money">${f.effect === null ? 'Not stated' : money(f.effect)}</td><td>${f.answered ? 'Answered by preparer' : 'Left for you'}<br><strong data-flag-state="${f.id}"></strong></td></tr>`).join('');
  return `<table class="govuk-table app-return"><caption class="govuk-table__caption govuk-visually-hidden">Flags: red first, then dollar effect (EX-4)</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Flag</th><th scope="col" class="govuk-table__header app-money">Dollar effect</th><th scope="col" class="govuk-table__header">Preparer and CPA</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table>`;
}

function traceBody(R, l) {
  const fl = l.flagIds.map((id) => R.flags.find((f) => f.id === id));
  const srcs = l.srcs;
  const agrees = [];
  if (l.kind !== 'sub' && !l.pct && l.acct) {
    agrees.push(['QuickBooks balance (test company)', money(l.cy), 'Agrees']);
    agrees.push([`Taxprep GIFI ${l.gifi}`, money(l.cy), 'Agrees']);
    if (l.dot === 'amber') agrees.push(['Statement pages for every transaction', 'Two items have no page', 'Does not agree: partly traced']);
    if (l.dot === 'grey') agrees.push(['Statement pages for every transaction', 'None found', 'Not checked: no evidence']);
  } else if (l.id === 'n-net-income') agrees.push(['Schedule 1, first line', money(l.cy), 'Agrees']);
  else if (l.id === 'n-total-assets' || l.id === 'n-total-le') agrees.push(['Total liabilities and equity', money(R.byId['n-total-le'].cy), 'Agrees']);
  else agrees.push(['Taxprep', money(l.cy), 'Agrees']);
  const srcRows = srcs.length ? srcs.map((s, k) => { const [d] = statusOf(s); return `<tr><td class="govuk-table__cell">${k + 1}</td><td class="govuk-table__cell"><button type="button" class="app-rowbtn" data-goto="${k}">${esc(sourceCaption(s, k, srcs.length).replace(/ \(source.*$/, ''))}</button></td><td class="govuk-table__cell">${H.dot(d)}</td></tr>`; }).join('') : `<tr><td class="govuk-table__cell" colspan="3">${H.dot('grey')} No sources found.</td></tr>`;
  return `<div data-trace="${l.id}" hidden>
<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${esc(l.label)}: ${val(l, l.cy)}${madeTag(l)}</h3>
<dl class="govuk-summary-list govuk-summary-list--no-border">
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Status</dt><dd class="govuk-summary-list__value">${H.dot(l.dot)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Built from</dt><dd class="govuk-summary-list__value">${esc(l.built)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Last year</dt><dd class="govuk-summary-list__value">${val(l, l.ly)}, change ${chg(l)}${l.part === 'is' || l.madeUp ? '<br><span class="govuk-hint govuk-!-margin-bottom-0">Last year is made up for the test.</span>' : ''}</dd></div>
${fl.length ? `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Flags</dt><dd class="govuk-summary-list__value">${fl.map((f) => `<a class="govuk-link" href="#/flags/${f.id}">${esc(f.id)} ${esc(f.title)}</a>`).join('<br>')}</dd></div>` : ''}
</dl>
<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Sources${l.total && l.total > 3 ? ` (largest 3 of ${l.total} transactions)` : ''}</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">No.</th><th scope="col" class="govuk-table__header">Source</th><th scope="col" class="govuk-table__header">Status</th></tr></thead><tbody class="govuk-table__body">${srcRows}</tbody></table>
<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Agrees with</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Compared with</th><th scope="col" class="govuk-table__header app-money">Value</th><th scope="col" class="govuk-table__header">Result</th></tr></thead><tbody class="govuk-table__body">${agrees.map(([a, b, c]) => `<tr><td class="govuk-table__cell">${esc(a)}</td><td class="govuk-table__cell app-money">${esc(b)}</td><td class="govuk-table__cell">${esc(c)}</td></tr>`).join('')}</tbody></table>
<h4 class="govuk-heading-s govuk-!-margin-bottom-1">Comments on this number</h4><div data-notes="${l.id}"></div>
</div>`;
}

function flagTrace(R, f) {
  return `<div data-trace="${f.id}" hidden>
<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${esc(f.id)} ${esc(f.title)}</h3>
<p class="govuk-!-margin-bottom-1">${H.flagTier(f.tier)}</p>
<form class="app-decide" data-flag-form="${f.id}" novalidate><div data-flag-decide="${f.id}"></div></form>
<dl class="govuk-summary-list govuk-summary-list--no-border">
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Preparer</dt><dd class="govuk-summary-list__value">${f.answered ? 'Answered by the preparer' : 'Left for you: not decided'}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">CPA</dt><dd class="govuk-summary-list__value"><strong data-flag-state="${f.id}"></strong></dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Dollar effect</dt><dd class="govuk-summary-list__value">${esc(f.effectText)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Preparer's answer</dt><dd class="govuk-summary-list__value">${esc(f.answer)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Evidence cited</dt><dd class="govuk-summary-list__value">${esc(f.cites)}. The source pane shows the cited evidence (${f.evidence.length} item${f.evidence.length === 1 ? '' : 's'}). <a class="govuk-link" href="${route(R, f.where)}">Open the number it sits on</a></dd></div>
</dl>
</div>`;
}

// ---------------------------------------------------------------- source host (every source, hidden until chosen)
function sourceHost(R) {
  const keyed = [...R.lines.map((l) => ({ id: l.id, srcs: l.srcs, label: l.label })), ...R.flags.map((f) => ({ id: f.id, srcs: f.evidence, label: f.title, flag: true }))];
  return keyed.map(({ id, srcs, label, flag }) => {
    if (!srcs.length) return `<div data-srcset="${id}" data-nosource hidden><div class="app-card"><h4>Not checked: no evidence</h4><p>No statement page, entry, client answer or capture was found for this number (CK-2). It stays marked "Not checked: no evidence" until something is attached.</p><p class="govuk-body-s">The sources list is empty, so there is no boxed figure to show.</p><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-comment-kind="Missing evidence">Comment: missing evidence</button></div></div>`;
    const n = srcs.length;
    return `<div data-srcset="${id}" data-count="${n}" hidden>${srcs.map((s, k) => `<section data-source="${id}:${k}" hidden aria-label="${flag ? 'Evidence' : 'Source'} ${k + 1} of ${n} for ${esc(label)}"><p class="app-caption">${esc(flag ? 'Cited evidence: ' : '')}${esc(sourceCaption(s, k, n))}</p>${sourceBody(s)}</section>`).join('')}</div>`;
  }).join('');
}

// ---------------------------------------------------------------- brief
function briefPanel(R, scn, rv) {
  const tiles = R.six.map((id) => { const l = R.byId[id]; return `<li class="app-tile"><a class="govuk-link" href="${route(R, id)}">${esc(l.label)}</a>${madeTag(l)}<div class="app-tile__value">${money(l.cy)}</div><div class="app-tile__small">Last year ${money(l.ly)}<br>Change ${chg(l)}</div></li>`; }).join('');
  const flagRows = R.flags.map((f) => `<tr><td class="govuk-table__cell">${H.flagTier(f.tier)}<br><a class="govuk-link" href="#/flags/${f.id}">${esc(f.id.slice(-3))} ${esc(f.title)}</a></td><td class="govuk-table__cell">${esc(f.effectText)}</td><td class="govuk-table__cell">${f.answered ? 'Answered: ' : 'Left for you: '}${esc(f.answer)}<br><strong data-flag-state="${f.id}"></strong></td></tr>`).join('');
  const ch = R.lines.filter((l) => l.changed && !l.madeUp).slice(0, 4);
  const items = R.which === 'red'
    ? ['HST regular, filed quarterly; Q4 paid 30 Jan 2026.', 'No interest on the shareholder loan (client decision, flagged).', 'Home office not claimed until you decide.', 'Last year\'s income figures are made up for the test.']
    : ['HST annual filer with instalments.', 'US-dollar sales at the monthly test rate.', 'Laptop class 50 and camera class 8, cost before HST.', 'Last year\'s income figures are made up for the test.'];
  const att = [`Zero orphans: every Taxprep number is traced or cited (RT-16).`, `Diagnostics cleared: three Warnings, each with a named reason (RT-17).`, `Preparer signed: ${R.cfg.preparer}, ${R.which === 'red' ? '5 Mar 2026' : '4 Mar 2026'}.`, R.which === 'red' ? 'Not yet: resolution for the $20,000.00 dividend.' : 'Owner signed the annual HST instalment summary.'];
  return `<div data-panel="brief" hidden class="app-brief">
<div class="app-strip"><span><strong>Tier ${H.tierWord(R.cfg.tier)}.</strong> ${esc(R.cfg.tierWhy)}</span></div>
<h2 class="govuk-heading-s app-h2">The return in six numbers, against last year <span class="app-madeup-note">Taxable income, tax, instalments and balance are made-up values for the design: the sample clients do not carry them yet.</span></h2>
<ul class="app-tiles">${tiles}</ul>
<div class="app-scroll" role="region" aria-label="Pinned flags" tabindex="0"><table class="govuk-table govuk-!-margin-bottom-0"><caption class="govuk-table__caption govuk-table__caption--s">Pinned flags: red first, then dollar effect (${R.flags.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Flag</th><th scope="col" class="govuk-table__header">Dollar effect</th><th scope="col" class="govuk-table__header">Preparer's answer and your decision</th></tr></thead><tbody class="govuk-table__body">${flagRows}</tbody></table></div>
<div class="app-brief3">
<div><h2 class="govuk-heading-s">What changed since last year</h2><ul class="app-lines">${ch.map((l) => `<li>${esc(l.label)}: ${val(l, l.cy)} against ${val(l, l.ly)} (${chg(l)})</li>`).join('')}</ul><p class="govuk-body-s govuk-!-margin-bottom-0">${R.lines.filter((l) => l.changed).length} large changes in all, marked in the sections.</p></div>
<div><h2 class="govuk-heading-s">Assumptions and client decisions</h2><ul class="app-lines">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
<div><h2 class="govuk-heading-s">Attestations</h2><ul class="app-lines">${att.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div></div>
<div class="app-left" data-left-list></div>
</div>`;
}

function commentsView(R, scn) {
  return `<div data-view="comments" hidden tabindex="0" role="region" aria-label="Comments">
<div data-comments-list></div>
<div data-sendback></div>
</div>`;
}

function historyView(R, scn) {
  const built = R.lines.filter((l) => l.kind !== 'sub' && !l.madeUp).length;
  const ev = R.cfg.history.map((e) => [e[0], e[1], e[2], e[3].replace(/^(Sixty-one|Fifty-eight) numbers/, built + ' numbers')]);
  if (scn.kind === 'rework') {
    ev.push(['10 Mar 2026, 10:20', 'Schedule 1 and the sections after it marked Reviewed', 'Zo', '']);
    ev.push(['10 Mar 2026, 10:40', 'Returned to the preparer', 'Zo', 'Comments C-1 to C-3.']);
    ev.push(['10 Mar 2026, 14:10', 'Preparer changed two numbers', R.cfg.rework.who, 'Moved $180.00 from Office expenses to Software and computer expenses (answering C-2). The Statements and GIFI mark came off.']);
  }
  if (scn.kind === 'ready') ev.push(['10 Mar 2026, 11:33', 'Every section marked Reviewed', 'Zo', 'Approve now shows.']);
  const item = ([when, title, who, desc]) => `<div class="moj-timeline__item"><div class="moj-timeline__header"><h3 class="moj-timeline__title">${esc(title)}</h3><p class="moj-timeline__byline">by ${esc(who)}</p></div><p class="moj-timeline__date"><time>${esc(when)}</time></p>${desc ? `<div class="moj-timeline__description"><p class="govuk-body">${esc(desc)}</p></div>` : ''}</div>`;
  return `<div data-view="history" hidden tabindex="0" role="region" aria-label="History"><div class="app-narrow"><div class="moj-timeline" data-timeline>${ev.map(item).join('')}</div></div></div>`;
}

function changesView(R, scn, rv) {
  if (scn.kind !== 'rework') return '';
  const rw = rv.rw;
  const rows = [rw.to, rw.from].map((id) => `<tr><th scope="row" class="govuk-table__header">${esc(R.byId[id].label)}</th><td class="govuk-table__cell">Statements and GIFI</td><td class="govuk-table__cell app-money">${money(rv.before[id])}</td><td class="govuk-table__cell app-money">${money(R.byId[id].cy)}</td><td class="govuk-table__cell app-money">${chg({ cy: R.byId[id].cy, ly: rv.before[id] })}</td><td class="govuk-table__cell"><a class="govuk-link" href="${route(R, id)}">Open the number</a></td></tr>`).join('');
  return `<div data-view="changes" hidden tabindex="0" role="region" aria-label="Changes"><div class="app-narrow"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Changed numbers, before and after (2)</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header app-money">Before</th><th scope="col" class="govuk-table__header app-money">After</th><th scope="col" class="govuk-table__header app-money">Change</th><th scope="col" class="govuk-table__header">Source</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table>
<p class="govuk-body">Changed by ${esc(rw.who)}, ${esc(rw.when)}, answering ${esc(rw.comment)}. Total expenses and net income did not change.</p>
<h2 class="govuk-heading-s">Sections whose mark came off</h2><ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="#/statements">Statements and GIFI</a>: a number in it changed. Re-mark it when you have looked at the two numbers.</li></ul>
<p class="govuk-body">Every other section keeps its mark. Flags are not marked yet.</p></div></div>`;
}

function keysPanel() {
  const items = [['j', 'Next number (runs on into the next section)'], ['k', 'Previous number'], ['f', 'Next flag'], [']', 'Next source'], ['[', 'Previous source'], ['o', 'Open or focus the second window'], ['c', 'Comment on the number'], ['n', 'Next section'], ['r', 'Reviewed, next (marks and moves on; never takes a mark off)'], ['a', 'Move to Approve, when it shows (never approves)'], ['Esc', 'Back from the source to the number, or close the comment']];
  return `<details class="app-keys"><summary class="app-keys__summary">Keyboard shortcuts</summary><div class="app-keys__pop" role="group" aria-label="Keyboard shortcuts"><ul class="app-keys__list">${items.map(([k, v]) => `<li><kbd>${esc(k)}</kbd> ${esc(v)}</li>`).join('')}</ul><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="keys-off">Turn single-key shortcuts off</label></div></div></div></details>`;
}

const miniBar = (R) => `<div class="moj-identity-bar" role="region" aria-label="This return"><div class="govuk-width-container app-wide"><div class="moj-identity-bar__container"><div class="moj-identity-bar__details"><h2 class="moj-identity-bar__title">${esc(R.corp)}</h2><p>Year end ${esc(R.ye)} ${H.tier(R.cfg.tier)}</p></div></div></div></div>`;

// ---------------------------------------------------------------- the record page
export function recordPage(scn) {
  const R0 = getReturn(scn.which);
  const rv = reworkView(R0, scn);
  const R = rv.ret;
  const open = R.flags.filter((f) => !decidedFor(R0, scn, f)).length;
  const sections = SECTIONS.map((s) => ({ key: s.key, slug: s.slug, title: s.title, ref: s.ref, rows: s.key === 'flags' ? R.flags.map((f) => f.id) : R.ordered[s.key].map((l) => l.id), printed: !!(R.printed[s.key]) }));
  const marks = Object.fromEntries(SECTIONS.map((s) => [s.key, scn.marks[s.key] ? (scn.marks[s.key] === 'off' ? 'off' : { by: scn.marks[s.key][0], when: scn.marks[s.key][1] }) : null]));
  const comments = R.cfg.comments.map((c) => ({ ...c, status: scn.kind === 'rework' && c.id === 'C-2' ? 'Answered: preparer changed the numbers' : c.status }));
  const data = {
    scn: scn.slug, which: scn.which, kind: scn.kind, corp: R.corp, ye: R.ye, preparer: R.cfg.preparer, now: NOW,
    sections, marks, comments, approveHref: `approved-${scn.which}.html`,
    flags: R.flags.map((f) => ({ id: f.id, title: f.title, tier: f.tier, decided: decidedFor(R0, scn, f) ? 'accept' : null })),
    offReason: scn.kind === 'rework' ? { stmt: `${R.byId[rv.rw.to].label} changed from ${money(rv.before[rv.rw.to])} to ${money(R.byId[rv.rw.to].cy)} and ${R.byId[rv.rw.from].label} from ${money(rv.before[rv.rw.from])} to ${money(R.byId[rv.rw.from].cy)}, by ${rv.rw.who}, ${rv.rw.when} (answering ${rv.rw.comment}). Re-mark it when you have looked at the changed numbers.` } : {},
    index: [...R.lines.filter((l) => l.kind !== 'sub').map((l) => ({ id: l.id, label: l.label, sec: l.section, val: val(l, l.cy) })), ...R.flags.map((f) => ({ id: f.id, label: f.id + ' ' + f.title, sec: 'flags', val: f.effect === null ? 'Not stated' : money(f.effect) }))],
    lines: Object.fromEntries(R.lines.map((l) => [l.id, { label: l.label, val: val(l, l.cy), section: l.section }])),
    srcFile: `source-${scn.which}.html`,
  };
  const idBar = `<div class="moj-identity-bar" role="region" aria-label="This return"><div class="govuk-width-container app-wide"><div class="moj-identity-bar__container"><div class="moj-identity-bar__details"><h2 class="moj-identity-bar__title">${esc(R.corp)}</h2><p>Year end ${esc(R.ye)} ${H.tier(R.cfg.tier)} ${scn.kind === 'rework' ? H.tag('Back from rework', 'purple') : H.tag('In review', 'blue')} <strong class="govuk-tag govuk-tag--grey" data-count-tag><span data-count-reviewed></span> of ${SECTIONS.length} sections Reviewed</strong></p><p class="app-idlinks"><a class="govuk-link" href="queue.html" data-queue-back>Back to the queue</a> <a class="govuk-link" href="queue.html" data-queue-prev hidden>Previous return</a> <a class="govuk-link" href="queue.html" data-queue-next hidden>Next return</a></p></div></div></div></div>`;
  const tabs = `<div class="govuk-width-container app-wide"><nav class="moj-sub-navigation app-tabs" aria-label="Return record"><ul class="moj-sub-navigation__list"><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/brief" data-tab="review">Review</a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/comments" data-tab="comments">Comments <span class="moj-badge moj-badge--blue" data-comment-count>${comments.length}</span></a></li>${scn.kind === 'rework' ? `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/changes" data-tab="changes">Changes <span class="moj-badge moj-badge--purple">2<span class="govuk-visually-hidden"> changed numbers</span></span></a></li>` : ''}<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/history" data-tab="history">History</a></li></ul></nav></div>`;
  const rail = `<nav class="app-rail" aria-label="Return sections"><form class="app-find" role="search" data-find><label class="govuk-label app-find__label" for="find-q">Find a number</label><div class="app-find__row"><input class="govuk-input app-find__input" id="find-q" name="q" type="search" autocomplete="off" aria-describedby="find-hint"><button type="submit" class="govuk-button govuk-button--secondary app-btn-sm">Find</button></div><div id="find-hint" class="govuk-visually-hidden">Searches every section, by name or account number</div></form>
<div class="app-rail__progress" data-progress></div>
<ol class="app-rail__list"><li><a class="app-rail__link" href="#/brief" data-rail="brief"><span class="app-rail__num" aria-hidden="true">0</span><span class="app-rail__title">Brief</span></a></li>${SECTIONS.map((s, i) => `<li><a class="app-rail__link" href="#/${s.slug}" data-rail="${s.key}"><span class="app-rail__num" aria-hidden="true">${i + 1}</span><span class="app-rail__title">${esc(s.title)}</span><span class="app-rail__mark" data-rail-mark="${s.key}"></span></a></li>`).join('')}</ol></nav>`;
  const panels = SECTIONS.map((s) => {
    if (s.key === 'flags') return `<div data-panel="flags" hidden>${flagsPanel(R)}</div>`;
    const lines = R.ordered[s.key];
    return `<div data-panel="${s.key}" hidden>${lines.length ? `<p class="app-ref">${esc(s.ref)}</p>` + rowsFor(R, s, lines) : printedPanel(R, s)}</div>`;
  }).join('');
  const traces = R.lines.map((l) => traceBody(R, l)).join('') + R.flags.map((f) => flagTrace(R, f)).join('');
  const reviewView = `<div class="app-review" data-view="review">${rail}<div class="app-work" data-work>
<div class="app-panes" data-panes>
<section class="app-pane app-pane--list" aria-labelledby="pl"><h2 class="app-pane__title" id="pl" data-list-title>Return</h2><div class="app-pane__body" data-list-body tabindex="0" role="region" aria-label="Return">${briefPanel(R, scn, rv)}${panels}<div data-panel="find" hidden><div data-find-results></div></div></div><div class="app-pane__foot" data-list-foot><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-next aria-keyshortcuts="j">Next number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-prev aria-keyshortcuts="k">Previous number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-next-flag aria-keyshortcuts="f">Next flag</button></div></section>
<section class="app-pane app-pane--trace" aria-labelledby="pt"><h2 class="app-pane__title" id="pt">Trace</h2><div class="app-pane__body" data-trace-body tabindex="0" role="region" aria-label="Trace"><div data-comment-host></div><p class="govuk-body-s" data-trace-empty>Pick a number to see how it is built.</p>${traces}</div><div class="app-pane__foot"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-comment-open aria-keyshortcuts="c">Comment on this number</button></div></section>
<section class="app-pane app-pane--source" aria-labelledby="ps"><h2 class="app-pane__title" id="ps">Source <span class="app-pane__sub" data-source-win>Second window: not open</span></h2><div class="app-pane__body" data-source-body tabindex="0" role="region" aria-label="Source page"><p class="app-caption" data-source-caption>Pick a number to see its source.</p>${sourceHost(R)}<div data-source-state></div></div><div class="app-pane__foot"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-prev aria-keyshortcuts="[">Previous source</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-next aria-keyshortcuts="]">Next source</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-open-source aria-keyshortcuts="o">Open in a second window</button></div></section>
</div></div></div>`;
  const toolbar = `<div class="app-toolbar" data-toolbar><h1 class="app-h1" id="route-title" tabindex="-1">Brief</h1><div class="app-toolbar__body" data-toolbar-body></div>${keysPanel()}</div><div data-unmark></div>`;
  const main = `${idBar}${tabs}${wrapMain(`${toolbar}${reviewView}${commentsView(R, scn)}${historyView(R, scn)}${changesView(R, scn, rv)}<script type="application/json" id="app-data">${jsonSafe(data)}</script>`, 'app-main--record')}`;
  return frame({ title: 'Return review', ret: R, main, bodyAttrs: 'data-record', bare: true, scripts: '<script src="../assets/review-v1.js"></script>', foot: footNote(statesStrip(R, scn)) });
}

export const decidedFor = (R, scn, f) => scn.kind === 'ready' || (R.cfg.decided[scn.kind === 'rework' ? 'rework' : 'progress'] || []).includes(f.id);

function statesStrip(R, scn) {
  const l = (h, t) => `<li><a class="govuk-link" href="${h}">${t}</a></li>`;
  const red = scn.slug === 'red' ? [l('red.html#/statements/n-6170', 'Number with no evidence'), l('red.html#/statements/n-6155/loading', 'Source loading'), l('red.html#/statements/n-6155/failed', 'Source failed to load'), l('red.html#/statements/n-6090', 'Comment panel: pick a number, press c, then Add comment with nothing chosen')] : [];
  return `<details class="govuk-details govuk-!-margin-top-2 govuk-!-margin-bottom-2"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Prototype: jump to a state</span></summary><div class="govuk-details__text"><ul class="govuk-list govuk-list--bullet">${l('red.html#/brief', 'Maple Ridge, first review (red tier, flagged)')}${l('red-rework.html#/brief', 'Maple Ridge, back from rework (a mark came off)')}${l('green.html#/brief', 'Queen West, first review (green tier)')}${l('green-ready.html#/brief', 'Queen West, every section marked (Approve shows)')}${l('queue.html', 'Queue')}${l('queue-later.html', 'Queue, later the same day (one back from rework)')}${l('queue-empty.html', 'Queue, nothing waiting')}${l('green.html#/comments', 'Comments, empty (Queen West)')}${red.join('')}</ul></div></details>`;
}

// ---------------------------------------------------------------- the second window (the source viewer, opened on demand)
export function sourceWindow(which) {
  const R = getReturn(which);
  const scn = which === 'red' ? SCENARIOS.red : SCENARIOS.green;
  const main = `${miniBar(R)}<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper app-main" id="main-content" role="main">
<h1 class="govuk-heading-m govuk-!-margin-bottom-1">Source viewer</h1>
<p class="govuk-body-s govuk-!-margin-bottom-2">${esc(R.corp)}, year end ${esc(R.ye)}. <span data-win-for>Waiting for a number in the review window.</span></p>
<div class="app-strip" role="group" aria-label="Source controls"><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="follow" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="follow">Follow the review window</label></div></div><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-prev aria-keyshortcuts="[">Previous source</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-next aria-keyshortcuts="]">Next source</button></div>
<div class="app-winbody" data-source-body tabindex="0" role="region" aria-label="Source page"><p class="app-caption" data-source-caption>Pick a number in the review window.</p>${sourceHost(R)}<div data-source-state></div></div>
<p class="govuk-body-s govuk-!-margin-top-2">This window follows the review window on every number, flag and section change. It closes when you sign out. Close it any time; press o in the review window to open it again where you left it.</p>
</main></div>`;
  return frame({ title: 'Source viewer', ret: R, main, bodyAttrs: 'data-source-window', bare: true, scripts: '<script src="../assets/review-v1.js"></script>' });
}

// ---------------------------------------------------------------- queue (task 1)
export const QUEUE_ROWS = (later) => [
  { name: 'Bluewater Renovations Inc. (Test)', ye: '30 Jun 2025', tier: 'red', due: '31 Dec 2025', dueIso: '2025-12-31', state: 'Ready for review', blocks: '2 red flags open', overdue: true },
  { name: 'Maple Ridge Consulting Inc. (Test)', ye: '31 Dec 2025', tier: 'red', due: '30 Jun 2026', dueIso: '2026-06-30', state: later ? 'Back from rework' : 'Ready for review', blocks: later ? '2 changed numbers to re-check' : '4 red flags open', open: later ? 'red-rework.html#/brief' : 'red.html#/brief' },
  { name: 'Eglinton Holdings Inc. (Test)', ye: '31 Dec 2025', tier: 'red', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Ready for review', blocks: '3 red flags open' },
  { name: 'Eglinton Retail Ltd. (Test)', ye: '31 Dec 2025', tier: 'amber', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Ready for review', blocks: '2 amber flags open' },
  { name: 'Queen West Design Studio Inc. (Test)', ye: '30 Sep 2025', tier: 'green', due: '31 Mar 2026', dueIso: '2026-03-31', state: 'Ready for review', blocks: 'Nothing blocks', open: 'green.html#/brief' },
  { name: 'Riverdale Rentals Inc. (Test)', ye: '31 Dec 2025', tier: 'green', due: '30 Jun 2026', dueIso: '2026-06-30', state: 'Ready for review', blocks: 'Nothing blocks' },
];
export function queuePage(mode) {
  if (mode === 'empty') {
    return frame({ title: 'Review queue, empty', main: wrapMain(`<h1 class="govuk-heading-l">Review queue</h1><div class="govuk-inset-text"><p class="govuk-body"><strong>No returns are waiting for your review.</strong></p><p class="govuk-body">New returns appear here when a preparer sends them. Nothing to do now.</p></div>`) , foot: footNote() });
  }
  const later = mode === 'later';
  const rows = QUEUE_ROWS(later);
  const rank = { red: 1, amber: 2, green: 3 };
  const tr = rows.map((q) => `<tr class="govuk-table__row" data-q-name="${esc(q.name.toLowerCase())}" data-q-tier="${q.tier}" data-q-state="${q.state}"><th scope="row" class="govuk-table__header">${q.open ? `<a class="govuk-link" href="${q.open}" data-q-open>${esc(q.name)}</a>` : esc(q.name)}</th><td class="govuk-table__cell" data-sort-value="${q.ye.split(' ').reverse().join('-')}">${q.ye}</td><td class="govuk-table__cell" data-sort-value="${q.overdue ? 0 : 1}-${rank[q.tier]}-${q.dueIso}">${H.tier(q.tier)}</td><td class="govuk-table__cell" data-sort-value="${q.dueIso}">${q.due}${q.overdue ? ' ' + H.tag('Overdue', 'red') : ''}</td><td class="govuk-table__cell">${q.state}</td><td class="govuk-table__cell">${q.blocks}</td></tr>`).join('');
  const nRework = rows.filter((q) => q.state === 'Back from rework').length;
  const main = wrapMain(`<h1 class="govuk-heading-l govuk-!-margin-bottom-2">Review queue</h1>
<p class="govuk-body govuk-!-margin-bottom-2" id="q-order">Order: overdue first, then tier (red first), then due date. This is the order recommended to Zo (design question 4); select a heading to sort another way.${later ? ' Later the same day: the preparer has sent Maple Ridge back.' : ''}</p>
<form class="app-qfilter" data-qfilter role="search" aria-label="Filter the queue"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="q-search">Search by name</label><input class="govuk-input" id="q-search" name="q" type="search" autocomplete="off"></div>
<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="q-tier">Tier</label><select class="govuk-select" id="q-tier" name="tier"><option value="">All tiers</option><option value="red">Red</option><option value="amber">Amber</option><option value="green">Green</option></select></div>
<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="q-state">View</label><select class="govuk-select" id="q-state" name="state"><option value="">All waiting (${rows.length})</option><option value="Ready for review">Ready for review (${rows.length - nRework})</option><option value="Back from rework">Back from rework (${nRework})</option></select></div>
<div class="govuk-form-group"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-q-clear>Clear filters</button></div></form>
<p class="govuk-body" data-q-count role="status">${rows.length} returns waiting.</p>
<div data-q-empty hidden class="govuk-inset-text"><p class="govuk-body"><strong>No returns match.</strong> Clear the filters to see all ${rows.length}. ${nRework === 0 ? 'Nothing is back from rework yet; the preparer sends a return back here.' : ''}</p></div>
<div class="app-scroll-x" role="region" aria-label="Returns waiting for review" tabindex="0"><table class="govuk-table" data-module="moj-sortable-table" data-q-table><caption class="govuk-table__caption govuk-visually-hidden">Returns waiting for review, overdue first, then tier, then due date</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header" aria-sort="none">Return</th><th scope="col" class="govuk-table__header" aria-sort="none">Year end</th><th scope="col" class="govuk-table__header" aria-sort="ascending">Tier</th><th scope="col" class="govuk-table__header" aria-sort="none">Due</th><th scope="col" class="govuk-table__header" aria-sort="none">State</th><th scope="col" class="govuk-table__header" aria-sort="none">What blocks</th></tr></thead><tbody class="govuk-table__body">${tr}</tbody></table></div>
<div class="govuk-inset-text">In this prototype two returns open: Maple Ridge (red tier) and Queen West (green tier). The other four rows show the list only.</div>`);
  return frame({ title: later ? 'Review queue, later' : 'Review queue', main, bodyAttrs: 'data-queue', foot: footNote(), scripts: '<script src="../assets/review-v1.js"></script>' });
}

// ---------------------------------------------------------------- approved (RV-11: time on each section and every source opened)
export function approvedPage(which) {
  const R = getReturn(which);
  const secs = SECTIONS;
  const sample = [[4, 12, 6], [3, 40, 9], [2, 5, 3], [1, 50, 2], [1, 5, 0], [2, 20, 4], [1, 35, 3], [3, 0, 5], [0, 40, 0], [0, 25, 0], [1, 30, 2]];
  const rows = secs.map((s, i) => `<tr><th scope="row" class="govuk-table__header">${esc(s.title)}</th><td class="govuk-table__cell">Zo, ${'10 Mar 2026, 11:' + String(8 + i * 2).padStart(2, '0')}</td><td class="govuk-table__cell app-money">${sample[i][0]} min ${String(sample[i][1]).padStart(2, '0')} s</td><td class="govuk-table__cell app-money">${sample[i][2]}</td></tr>`).join('');
  const totalSec = sample.reduce((a, x) => a + x[0] * 60 + x[1], 0), totalSrc = sample.reduce((a, x) => a + x[2], 0);
  const main = miniBar(R) + wrapMain(`<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Return approved</h1><div class="govuk-panel__body">${esc(R.corp)}<br>by Zo, 10 Mar 2026, 11:34</div></div>
<p class="govuk-body">Every section was Reviewed. The approval is voided if any number changes.</p>
<div class="app-scroll-x" role="region" aria-label="Approval record" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--m">The approval record (RV-11): each mark, the time on each section and every source opened</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header">Marked Reviewed</th><th scope="col" class="govuk-table__header app-money">Time on section</th><th scope="col" class="govuk-table__header app-money">Sources opened</th></tr></thead><tbody class="govuk-table__body">${rows}<tr><th scope="row" class="govuk-table__header">All sections</th><td class="govuk-table__cell">11 of 11 marked</td><td class="govuk-table__cell app-money">${Math.floor(totalSec / 60)} min ${String(totalSec % 60).padStart(2, '0')} s</td><td class="govuk-table__cell app-money">${totalSrc}</td></tr></tbody></table></div>
<p class="govuk-body"><a class="govuk-link" href="queue.html" data-queue-next-link>Open the next return in the queue</a></p>`);
  return frame({ title: 'Approved', ret: R, main, bodyAttrs: 'data-approved', foot: footNote(), scripts: '<script src="../assets/review-v1.js"></script>' });
}
