import { STATES, stateInfo, PEOPLE, RETURNS, bySlug, TODAY } from './data.mjs';
import { esc, fmt, diffDays, rel, stateTag, tierTag, waitTag, person, recHref, page, simpleTable, sortDue } from './lib.mjs';

export const TABS = [['overview', 'Overview'], ['workbench', 'Workbench'], ['review', 'Review'], ['documents', 'Documents'], ['exceptions', 'Exceptions'], ['history', 'History'], ['ops', 'Ops']];
const order = STATES.map((s) => s[0]);
const idx = (k) => order.indexOf(k);

export const nextStep = (r) => {
  const who = { intake: 'The system creates the return from client-app data.', evidence: 'Ops and the system read documents and capture CRA data.', gaps: `${person(r.prep)} signs the question list, or confirms there is nothing to ask.`, qa: 'The client answers in the client app, or the no-response rule applies.', build: 'The system writes the import file and saves the AI draft.', prepare: `${person(r.prep)} verifies the receipt export, finishes judgment inputs and presses Ready.`, trace: 'The system and the preparer clear every orphan cell and unexplained override.', respond: `${person(r.prep)} answers every exception and signs.`, review: `${person('dana')} reviews the full return and approves, or sends comments.`, rework: `${person(r.prep)} re-traces and re-checks the changed cells, then signs.`, approved: 'Ops runs gate 1 and sends T183CORP.', client_sign: 'The client signs in CCH Digital Signature; ops uploads the certificate.', ready_to_file: 'Ops runs gate 2, transmits and enters the confirmation number.', filed: 'Ops saves the notice of assessment and compares it.', assessed: 'The system freezes the binder.', closed: 'Nothing. The return is closed and read-only.' };
  return who[r.state];
};

export const identity = (r, menu) => `<div class="moj-identity-bar"><div class="moj-identity-bar__container">
<div class="moj-identity-bar__details"><h1 class="govuk-heading-l govuk-!-margin-bottom-2">${esc(r.name)}, year end ${fmt(r.ye)}</h1>
<p class="govuk-body govuk-!-margin-bottom-0">${stateTag(r.state)} ${tierTag(r.tier)} ${r.waiting ? waitTag(r.waiting) : ''}${r.blocker && !r.waiting ? ` <strong class="govuk-tag govuk-tag--red">Blocked</strong>` : ''}</p></div>
<div class="moj-identity-bar__menu">${menu || ''}</div></div></div>`;

const actions = (r) => {
  const b = [];
  if (r.state === 'prepare') b.push(`<a class="govuk-button govuk-button--secondary moj-button-menu__item" role="button" draggable="false" href="${recHref(r, 'workbench')}">Open workbench tab</a>`);
  if (r.state === 'review') b.push(`<a class="govuk-button moj-button-menu__item" role="button" draggable="false" href="${recHref(r, 'review')}">Open review tab</a>`);
  if (r.state === 'rework') b.push(`<a class="govuk-button moj-button-menu__item" role="button" draggable="false" href="${recHref(r, 'workbench')}">Open workbench tab</a>`);
  if (r.nextOps) b.push(`<a class="govuk-button moj-button-menu__item" role="button" draggable="false" href="${recHref(r, 'ops')}">${esc(r.nextOps)}</a>`);
  if (r.waiting) b.push(`<a class="govuk-button govuk-button--secondary moj-button-menu__item" role="button" draggable="false" href="${recHref(r, 'history')}">Open history to chase</a>`);
  return b.length ? `<div class="moj-button-menu"><div class="moj-button-menu__wrapper">${b.join('')}</div></div>` : '';
};

const facts = (r) => {
  const dl = (rows) => `<dl class="govuk-summary-list govuk-summary-list--no-border">${rows.map(([k, v]) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${k}</dt><dd class="govuk-summary-list__value">${v}</dd></div>`).join('')}</dl>`;
  const o = (iso) => { const n = diffDays(iso); return `${fmt(iso)} (${n < 0 ? -n + ' days ago' : rel(iso)})`; };
  return `<section class="app-facts" aria-label="Facts about this return"><div class="govuk-grid-row">
<div class="govuk-grid-column-one-half">${dl([['Preparer', esc(person(r.prep))], ['CPA reviewer', esc(person(r.cpa))], ['Held by', r.holder ? `${esc(person(r.holder))}, hold expires ${r.holdExpires}` : 'Nobody'], ['Group', r.group ? `${esc(r.group)}: ${r.slug === 'eglinton-holdings' ? '<a class="govuk-link" href="' + recHref(bySlug['eglinton-retail']) + '">Eglinton Retail Ltd. (Test)</a>' : '<a class="govuk-link" href="' + recHref(bySlug['eglinton-holdings']) + '">Eglinton Holdings Inc. (Test)</a>'}` : 'None']])}</div>
<div class="govuk-grid-column-one-half">${dl([['Filing due', o(r.filing)], ['Balance due', o(r.balance)], ['In this state', `${r.daysInState} days, since ${fmt(r.since)}`], ['Blocked by', r.blocker ? `<a class="govuk-link" href="${recHref(r, r.blockerLink || 'overview')}">${esc(r.blocker)}</a>` : 'Nothing']])}</div>
</div></section>`;
};

const docTable = (r, rows, v, cap) => simpleTable({ hide: true, caption: cap, head: ['Document', 'Source', 'Status'], rows: rows.map((d, i) => [`<a class="govuk-link" href="src-${r.slug}-${i + 1}.html"${v === 'C' ? ' target="ashbridge-source" data-source-open' : ''}>${esc(d[0])}</a>`, esc(d[1]), d[2] === 'Read' ? '<strong class="govuk-tag govuk-tag--green">Read</strong>' : d[2] === 'Missing' || d[2] === 'Gap' ? `<strong class="govuk-tag govuk-tag--red">${d[2]}</strong>` : `<strong class="govuk-tag govuk-tag--yellow">${esc(d[2])}</strong>`]) });
const sev = (s) => `<strong class="govuk-tag govuk-tag--${s === 'Red' ? 'red' : 'yellow'}">${s === 'Red' ? 'Red flag' : 'Amber flag'}</strong>`;
const excTable = (rows, cap) => simpleTable({ hide: true, caption: cap, head: ['Exception', 'Flag', 'Answer'], rows: rows.map((e) => [esc(e[0]), sev(e[1]), e[2] === 'Open' ? '<strong class="govuk-tag govuk-tag--orange">Open</strong>' : '<strong class="govuk-tag govuk-tag--green">Answered</strong>']) });

const timeline = (hist, n) => `<div class="moj-timeline">${hist.slice(0, n).map((h) => `<div class="moj-timeline__item"><div class="moj-timeline__header"><h3 class="moj-timeline__title govuk-heading-s govuk-!-margin-bottom-0">${esc(h[0])}</h3><p class="moj-timeline__byline govuk-body-s">by ${esc(h[1])}</p></div><p class="moj-timeline__date govuk-body-s"><time datetime="2026-06-08">${h[2]}</time>${h[3] ? ` | move: ${esc(h[3])}` : ''}</p></div>`).join('')}</div>`;

const taskList = (items) => `<ul class="govuk-task-list">${items.map(([l, s, h]) => `<li class="govuk-task-list__item${h ? ' govuk-task-list__item--with-link' : ''}"><div class="govuk-task-list__name-and-hint">${h ? `<a class="govuk-link govuk-task-list__link" href="${h}">${l}</a>` : `<div>${l}</div>`}</div><div class="govuk-task-list__status">${s}</div></li>`).join('')}</ul>`;
const done = '<strong class="govuk-tag govuk-tag--green">Done</strong>';
const todo = '<strong class="govuk-tag govuk-tag--blue">To do</strong>';
const cant = '<span class="govuk-task-list__status--cannot-start-yet">Cannot start yet</span>';

const section = (h, inner) => `<section class="govuk-!-margin-bottom-6"><h2 class="govuk-heading-m">${h}</h2>${inner}</section>`;

function body(r, tab, v) {
  const t = (x) => recHref(r, x);
  if (tab === 'overview') {
    let o = '';
    if (r.changesSince) o += `<div class="govuk-inset-text"><h2 class="govuk-heading-s govuk-!-margin-bottom-1">Since you last opened this return (${r.changesSince.when})</h2><ul class="govuk-list govuk-list--bullet govuk-!-margin-bottom-0"><li><a class="govuk-link" href="${t('history')}">${r.changesSince.comments} new comment and ${r.changesSince.events} events in History</a></li><li><a class="govuk-link" href="${t('documents')}">${r.changesSince.docs} new document in Documents</a></li></ul></div>`;
    if (r.voided) o += `<div class="moj-alert moj-alert--warning" role="region" aria-label="Approval void" data-module="moj-alert"><div><svg class="moj-alert__icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 8v9M15 20v2" stroke="currentColor" stroke-width="3"/></svg></div><div class="moj-alert__content"><strong>Approval void.</strong> ${r.changed} cells changed after approval. The CPA sees only those cells, before and after. <a class="govuk-link" href="${t('exceptions')}">See the exceptions</a></div></div>`;
    if (r.blocker) o += `<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>Blocked by: ${esc(r.blocker)}. <a class="govuk-link" href="${t(r.blockerLink || 'overview')}">See where</a></strong></div>`;
    o += `<div class="govuk-grid-row"><div class="govuk-grid-column-one-half"><div class="govuk-summary-card"><div class="govuk-summary-card__title-wrapper"><h2 class="govuk-summary-card__title">Next step</h2></div><div class="govuk-summary-card__content"><p class="govuk-body">${esc(nextStep(r))}</p>${r.note ? `<p class="govuk-body govuk-hint">${esc(r.note)}</p>` : ''}</div></div></div>
<div class="govuk-grid-column-one-half"><div class="govuk-summary-card"><div class="govuk-summary-card__title-wrapper"><h2 class="govuk-summary-card__title">Who acts on each state</h2></div><div class="govuk-summary-card__content"><p class="govuk-body">Now: <strong>${stateInfo[r.state].label}</strong>, acted on by ${esc(stateInfo[r.state].who)}.</p><p class="govuk-body">Then: <strong>${esc(stateInfo[order[Math.min(idx(r.state) + 1, 15)]].label)}</strong>.</p></div></div></div></div>`;
    o += section('Documents', docTable(r, r.docs.slice(0, 5), v, 'Documents, first 5') + `<p class="govuk-body"><a class="govuk-link" href="${t('documents')}">View all ${r.docs.length} documents</a></p>`);
    o += section('Exceptions', r.exc.length ? excTable(r.exc.slice(0, 5), 'Exceptions, first 5') + `<p class="govuk-body"><a class="govuk-link" href="${t('exceptions')}">View all ${r.exc.length} exceptions</a></p>` : '<p class="govuk-body">No exceptions on this return.</p>');
    o += section('Changed cells', r.changed ? simpleTable({ hide: true, caption: `Changed since approval, ${r.changed} cells (first 3)`, head: ['Line', 'Before', 'After'], numCols: [1, 2], rows: [['Line 8320 Total revenue', '412,310.00', '412,860.00'], ['Line 9270 Other expenses', '18,420.50', '17,990.50'], ['Schedule 8 class 8 addition', '14,500.00', '14,850.00']].map((x) => [x[0], `<span class="app-money">${x[1]}</span>`, `<span class="app-money">${x[2]}</span>`]) }) + `<p class="govuk-body"><a class="govuk-link" href="${t('review')}">View all ${r.changed} changed cells in the review tab</a></p>` : '<p class="govuk-body">No cells have changed since the last approval check.</p>');
    o += section('Recent history', timeline(r.hist, 3) + `<p class="govuk-body"><a class="govuk-link" href="${t('history')}">View full history</a></p>`);
    return o;
  }
  if (tab === 'workbench') {
    const st = r.state; const early = idx(st) < idx('prepare');
    const items = early ? [['Receipt export verified', cant], ['Judgment inputs', cant], ['Mark Ready', cant]] : st === 'prepare' ? [['Receipt export verified', '<strong class="govuk-tag govuk-tag--orange">Not verified</strong>', t('documents')], ['Judgment inputs, 3 of 5 done', '<strong class="govuk-tag govuk-tag--blue">In progress</strong>', t('exceptions')], ['Mark Ready', cant]] : [['Receipt export verified', done, t('documents')], ['Judgment inputs', done, t('exceptions')], ['Mark Ready', done]];
    return section('What is left for the preparer', `<p class="govuk-body">Each step opens the tab that holds it. The workbench grid itself has its own design family; this tab only says where the preparer stands.</p>` + taskList(items));
  }
  if (tab === 'review') {
    const inReview = ['review', 'rework'].includes(r.state);
    return section('Review', inReview ? `<p class="govuk-body">Sections reviewed: <strong>0 of 9</strong>. Approve appears only when every section is reviewed. ${r.state === 'rework' ? `${r.changed} cells changed since the last approval check.` : `${r.flags} pinned flags are waiting.`}</p><p class="govuk-body">The review sections with their Reviewed marks are designed in the CPA review family.</p>` : `<p class="govuk-body">Review has not started. This return is in <strong>${stateInfo[r.state].label}</strong>${idx(r.state) > idx('review') ? ' and has already passed review' : ' and reaches the CPA after Respond'}.</p>`);
  }
  if (tab === 'documents') return section('Documents', docTable(r, r.docs, v, `Documents, ${r.docs.length}`) + (v === 'C' ? '<p class="govuk-hint">Each document opens in the source window on your second monitor and stays there as you click through them.</p>' : ''));
  if (tab === 'exceptions') return section('Exceptions', r.exc.length ? excTable(r.exc, `Exceptions, ${r.exc.length}`) : '<p class="govuk-body">No exceptions on this return.</p>');
  if (tab === 'history') {
    let o = '';
    if (r.waiting) o += `<div class="govuk-summary-card"><div class="govuk-summary-card__title-wrapper"><h2 class="govuk-summary-card__title">Waiting on client</h2></div><div class="govuk-summary-card__content"><dl class="govuk-summary-list govuk-summary-list--no-border"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Flag set</dt><dd class="govuk-summary-list__value">${fmt(r.waiting.since)}, ${r.waiting.days} days ago</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Last contact</dt><dd class="govuk-summary-list__value">${fmt(r.waiting.last)}: ${esc(r.waiting.lastHow)}</dd></div></dl><a class="govuk-button govuk-button--secondary" role="button" draggable="false" href="${recHref(r, 'history').replace('.html', '-nudged.html')}">Send a nudge in the client app</a></div></div>`;
    return o + section('History', timeline(r.hist, 99));
  }
  if (tab === 'ops') {
    const i = idx(r.state);
    const L = [['CRA data captured', i > 1 ? done : todo], ['Gate 1 passes', i >= idx('client_sign') ? done : i === idx('approved') ? todo : cant], ['T183CORP sent', i >= idx('client_sign') ? done : i === idx('approved') ? todo : cant], ['Signed certificate uploaded', i >= idx('ready_to_file') ? done : cant], ['Gate 2 passes and transmit', i >= idx('filed') ? done : i === idx('ready_to_file') ? todo : cant], ['Confirmation number entered', i >= idx('filed') ? done : cant], ['Notice of assessment saved and compared', i >= idx('assessed') ? done : r.state === 'filed' ? '<strong class="govuk-tag govuk-tag--orange">Missing</strong>' : cant]];
    return section('Ops steps', taskList(L) + (r.nextOps ? `<p class="govuk-body">Next ops step: <strong>${esc(r.nextOps)}</strong>.${r.missing ? ' Missing item: ' + esc(r.missing) + '.' : ''}</p>` : ''));
  }
}

const stepper = (r) => `<ol class="app-stepper" aria-label="Lifecycle position">${STATES.map(([k, l]) => `<li${k === r.state ? ' aria-current="step"' : ''}${idx(k) < idx(r.state) ? ' class="app-stepper__done"' : ''}>${l}</li>`).join('')}</ol>`;

export function recordPage(r, tab, v, nudged = false) {
  const label = TABS.find((x) => x[0] === tab)[1];
  const list = sortDue(RETURNS.filter((x) => x.state !== 'closed'));
  const i = list.findIndex((x) => x.slug === r.slug);
  const prev = list[i - 1], next = list[i + 1];
  let nav;
  if (v === 'B') {
    nav = `<nav class="moj-side-navigation" aria-label="Sections of this return"><ul class="moj-side-navigation__list">${TABS.map(([k, l]) => `<li class="moj-side-navigation__item"${k === tab ? ' aria-current="location"' : ''}><a href="${recHref(r, k)}">${l}</a></li>`).join('')}</ul></nav>`;
  } else {
    nav = `<nav class="moj-sub-navigation" aria-label="Sections of this return"><ul class="moj-sub-navigation__list">${TABS.map(([k, l]) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${recHref(r, k)}"${k === tab ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>`;
  }
  const pn = v === 'B' ? `<p class="govuk-body"><a class="govuk-link" href="queue-all.html">Back to the list</a>${prev ? ` | <a class="govuk-link" href="${recHref(prev, tab)}" data-key-prev aria-keyshortcuts="p">Previous return (p): ${esc(prev.name)}</a>` : ''}${next ? ` | <a class="govuk-link" href="${recHref(next, tab)}" data-key-next aria-keyshortcuts="n">Next return (n): ${esc(next.name)}</a>` : ''}</p>` : `<p class="govuk-body"><a class="govuk-link" href="${v === 'C' ? 'my-work.html' : 'queue-preparer.html'}">Back to the list</a></p>`;
  const success = nudged ? `<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" aria-labelledby="nb-title" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="nb-title">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Nudge sent to the client in the client app. Last contact is now ${fmt(TODAY)}.</p></div></div>` : '';
  const content = `${success}${body(r, tab, v)}`;
  const inner = v === 'B' ? `<div class="govuk-grid-row"><div class="govuk-grid-column-one-quarter">${nav}</div><div class="govuk-grid-column-three-quarters">${content}</div></div>` : `${nav}${content}`;
  const html = `${pn}${identity(r, actions(r))}${v === 'C' ? stepper(r) : ''}${facts(r)}${inner}`;
  const sc = v === 'B' ? [['n', 'Next return in the list'], ['p', 'Previous return in the list'], ['j and k', 'On the list page, move the selected row down or up']] : [];
  return page({ title: label, ret: r, nav: r.state === 'review' ? 'review' : ['approved', 'ready_to_file', 'filed', 'client_sign'].includes(r.state) ? 'ops' : 'queue', body: html, shortcuts: sc, navLinks: v === 'C' ? NAVC : undefined });
}
export const NAVC = [['pipeline', 'Pipeline', 'pipeline.html'], ['queue', 'My work', 'my-work.html'], ['review', 'CPA review', 'cpa-work.html'], ['ops', 'Ops', 'ops-work.html']];

export function sourcePage(r, n, v) {
  const d = r.docs[n - 1];
  const rows = [['2025-01-03', 'POS PURCHASE FUEL TEST', '212.40', ''], ['2025-01-07', 'E-TRANSFER IN CLIENT TEST', '', '5,200.00'], ['2025-01-14', 'MONTHLY FEE', '29.95', ''], ['2025-01-21', 'UTILITY AUTOPAY TEST', '186.12', ''], ['2025-01-28', 'E-TRANSFER IN CLIENT TEST', '', '5,200.00']];
  const html = `<p class="govuk-body"><a class="govuk-link" href="${recHref(r, 'documents')}">Back to the documents of ${esc(r.name)}</a></p>
<h1 class="govuk-heading-l">${esc(d[0])}</h1>
<p class="govuk-body">${esc(r.name)}, year end ${fmt(r.ye)}. Source: ${esc(d[1])}. Status: ${esc(d[2])}.</p>
<div class="app-src">${simpleTable({ caption: 'First rows of the source (made-up sample lines)', head: ['Date', 'Description', 'Withdrawals', 'Deposits'], numCols: [2, 3], rows: rows.map((x) => [x[0], x[1], `<span class="app-money">${x[2]}</span>`, `<span class="app-money">${x[3]}</span>`]) })}</div>
<p class="govuk-hint">The full source viewer with highlighted cells is designed in the evidence and source viewer family.</p>`;
  return page({ title: d[0], ret: r, nav: 'queue', body: v === 'C' ? `<div data-source-follow></div>${html}` : html, navLinks: v === 'C' ? NAVC : undefined });
}
