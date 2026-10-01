// The return record: one identity bar and one set of record tabs (staff-screens rule 23). Version A.
// One page per return. A tab change is a client-side route (#overview, #documents/2 ...), 0 page loads (rule 18).
import { STATES, stateInfo, PEOPLE, RETURNS, bySlug, TODAY } from './data.mjs';
import { esc, fmt, diffDays, rel, stateTag, tierTag, waitTag, person, page, simpleTable as baseTable, isDone } from './lib.mjs';
const simpleTable = (o) => `<div class="app-tablewrap" role="region" aria-label="${esc(o.caption)}, scrollable" tabindex="0">${baseTable(o)}</div>`;

export const TABS = [['overview', 'Overview'], ['workbench', 'Workbench'], ['review', 'Review'], ['documents', 'Documents'], ['exceptions', 'Exceptions'], ['history', 'History'], ['ops', 'Ops']];
const order = STATES.map((s) => s[0]);
const idx = (k) => order.indexOf(k);
const recFile = (r) => `rec-${r.slug}.html`;
const tabHref = (tab) => `#${tab}`;

export const nextStep = (r) => {
  const who = { intake: 'The system creates the return from client-app data.', evidence: 'Ops and the system read documents and capture the CRA data.', gaps: `${person(r.prep)} signs the question list, or confirms there is nothing to ask.`, qa: 'The client answers in the client app, or the no-response rule applies.', build: 'The system writes the import file and saves the AI draft.', prepare: `${person(r.prep)} uploads the lock export and the printed return, reads the tax choices and presses Ready.`, trace: 'The system and the preparer clear every orphan cell and unexplained override.', respond: `${person(r.prep)} answers every exception and signs.`, review: `${person('dana')} reviews the full return and approves, or sends comments.`, rework: `${person(r.prep)} re-traces and re-checks the changed cells, then signs.`, approved: 'Ops sends T183CORP to the client.', client_sign: 'The client signs in CCH Digital Signature; ops uploads the signed certificate.', ready_to_file: 'Ops uploads the check export, which must match the approval, then transmits and enters the confirmation number.', filed: 'Ops saves the notice of assessment and compares it.', assessed: 'The system freezes the binder.', closed: 'Nothing. The return is closed and read-only.' };
  return who[r.state];
};

const dash = (n) => `${n}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const identity = (r, menu) => `<div class="moj-identity-bar"><div class="moj-identity-bar__container">
<div class="moj-identity-bar__details"><h1 class="govuk-heading-m govuk-!-margin-bottom-1">${esc(r.name)}, year end ${fmt(r.ye)}</h1>
<p class="govuk-body govuk-!-margin-bottom-0"><span data-state-tag>${stateTag(r.state)}</span> ${tierTag(r.tier)} ${r.waiting ? waitTag(r.waiting) : ''}${r.blocker && !r.waiting ? ` <strong class="govuk-tag govuk-tag--red">Blocked</strong>` : ''}</p></div>
<div class="moj-identity-bar__menu">${menu || ''}</div></div></div>`;

const goBtn = (label, tab, secondary) => `<button type="button" class="govuk-button${secondary ? ' govuk-button--secondary' : ''} moj-button-menu__item" data-goto="${tab}">${esc(label)}</button>`;
const actions = (r) => {
  const b = [];
  if (r.state === 'prepare' || r.state === 'rework') b.push(goBtn('Open the workbench', 'workbench', true));
  if (r.state === 'review') b.push(goBtn('Open the review', 'review'));
  if (r.nextOps) b.push(goBtn(r.nextOps, 'ops'));
  if (r.waiting) b.push(goBtn('Chase in History', 'history', true));
  return b.length ? `<div class="moj-button-menu"><div class="moj-button-menu__wrapper">${b.join('')}</div></div>` : '';
};

// "Since you last opened this return": first, under the identity bar (fix 5)
const since = (r) => {
  const c = r.changesSince; if (!c) return '';
  const items = [];
  if (c.comments) items.push(`<li><a class="govuk-link" href="#history">${plural(c.comments, 'new comment', 'new comments')} in History</a></li>`);
  if (c.docs) items.push(`<li><a class="govuk-link" href="#documents">${plural(c.docs, 'new document', 'new documents')} in Documents</a></li>`);
  if (c.events) items.push(`<li><a class="govuk-link" href="#history">${plural(c.events, 'event', 'events')} in History</a></li>`);
  return `<section class="app-since" aria-labelledby="since-h"><h2 class="govuk-heading-s govuk-!-margin-bottom-1" id="since-h">Since you last opened this return (${c.when})</h2><ul class="app-since__list">${items.join('')}</ul></section>`;
};

const facts = (r) => {
  const o = (iso) => { const n = diffDays(iso); return `${fmt(iso)} (${n < 0 ? -n + ' days ago' : rel(iso)})`; };
  const other = r.group ? `${esc(r.group)}: <a class="govuk-link" href="${r.slug === 'eglinton-holdings' ? 'rec-eglinton-retail.html' : 'rec-eglinton-holdings.html'}">${r.slug === 'eglinton-holdings' ? 'Eglinton Retail Ltd. (Test)' : 'Eglinton Holdings Inc. (Test)'}</a>` : 'None';
  const rows = [['Preparer', esc(person(r.prep))], ['CPA reviewer', esc(person(r.cpa))], ['Held by', r.holder ? `${esc(person(r.holder))}, hold ends ${r.holdExpires}` : 'Nobody'], ['Group', other], ['Filing due', o(r.filing)], ['Balance due', o(r.balance)], ['Days in this state', `${r.daysInState}, since ${fmt(r.since)}`], ['Blocked by', r.blocker ? `<a class="govuk-link" href="#${r.blockerLink || 'overview'}">${esc(r.blocker)}</a>` : 'Nothing']];
  return `<section class="app-facts" aria-label="Facts about this return"><dl class="app-facts__list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`;
};

const DOCS_DEFAULT = [['Chequing statements', 'Client app', 'Read'], ['Prior-year T2 return', 'Client app', 'Read']];
const docsOf = (r) => (r.docs && r.docs.length ? r.docs : DOCS_DEFAULT);
const excOf = (r) => r.exc || [];
const histOf = (r) => (r.hist && r.hist.length ? r.hist : [[`Return in ${stateInfo[r.state].label}`, 'System', fmt(r.since), null]]);
const statusTag = (s) => s === 'Read' ? '<strong class="govuk-tag govuk-tag--green">Read</strong>' : s === 'Missing' || s === 'Gap' ? `<strong class="govuk-tag govuk-tag--red">${s}</strong>` : `<strong class="govuk-tag govuk-tag--yellow">${esc(s)}</strong>`;

const docRows = (r, rows, link) => rows.map((d, i) => [link ? `<a class="govuk-link" href="#documents/${i + 1}">${esc(d[0])}</a>` : `<button type="button" class="app-linkbutton" data-doc="${i + 1}" data-name="${esc(d[0])}" data-source="${esc(d[1])}" data-status="${esc(d[2])}" data-ret="${esc(r.name)}" data-ye="${fmt(r.ye)}">${esc(d[0])}</button>`, esc(d[1]), statusTag(d[2])]);
const docTable = (r, rows, cap, link) => simpleTable({ hide: true, caption: cap, head: ['Document', 'Source', 'Status'], rows: docRows(r, rows, link) });
const sev = (s) => `<strong class="govuk-tag govuk-tag--${s === 'Red' ? 'red' : 'yellow'}">${s === 'Red' ? 'Red flag' : 'Amber flag'}</strong>`;
const excTable = (rows, cap) => simpleTable({ hide: true, caption: cap, head: ['Exception', 'Flag', 'Answer'], rows: rows.map((e) => [esc(e[0]), sev(e[1]), e[2] === 'Open' ? '<strong class="govuk-tag govuk-tag--orange">Open</strong>' : '<strong class="govuk-tag govuk-tag--green">Answered</strong>']) });

const timeline = (hist, n) => `<div class="moj-timeline" data-timeline>${hist.slice(0, n).map((h) => `<div class="moj-timeline__item"><div class="moj-timeline__header"><h3 class="moj-timeline__title govuk-heading-s govuk-!-margin-bottom-0">${esc(h[0])}</h3><p class="moj-timeline__byline govuk-body-s">by ${esc(h[1])}</p></div><p class="moj-timeline__date govuk-body-s">${h[2]}${h[3] ? ` | move: ${esc(h[3])}` : ''}</p></div>`).join('')}</div>`;

const taskList = (items) => `<ul class="govuk-task-list">${items.map(([l, s, h]) => `<li class="govuk-task-list__item${h ? ' govuk-task-list__item--with-link' : ''}"><div class="govuk-task-list__name-and-hint">${h ? `<a class="govuk-link govuk-task-list__link" href="${h}">${l}</a>` : `<div>${l}</div>`}</div><div class="govuk-task-list__status">${s}</div></li>`).join('')}</ul>`;
const done = '<strong class="govuk-tag govuk-tag--green">Done</strong>';
const todo = '<strong class="govuk-tag govuk-tag--blue">To do</strong>';
const cant = '<span class="govuk-task-list__status--cannot-start-yet">Cannot start yet</span>';

const panel = (id, h, inner) => `<section class="app-panel" id="panel-${id}" data-panel="${id}" aria-labelledby="h-${id}"><h2 class="govuk-heading-m" id="h-${id}" tabindex="-1">${h}</h2>${inner}</section>`;
const stepper = (r) => `<ol class="app-stepper" aria-label="Lifecycle position, ${STATES.length} states">${STATES.map(([k, l]) => `<li${k === r.state ? ' aria-current="step"' : ''}${idx(k) < idx(r.state) ? ' class="app-stepper__done"' : ''}>${l}</li>`).join('')}</ol>`;

// ---------- the Ops tab (RV-30): each step is an in-place form of 3 fields or fewer (rule 19) ----------
// Steps in order. No gate 1 (A30): approval is the CPA's; ops sends T183CORP after it.
const STEPS = [
  { k: 'cra', label: 'CRA data capture checklist, saved as a PDF and read into facts', at: 'evidence', form: { file: 'Capture checklist PDF', hint: 'The fixed capture checklist, saved from the CRA account.', btn: 'Save the capture', done: 'CRA data capture saved and read into facts.' } },
  { k: 't183', label: 'T183CORP sent to the client', at: 'approved', form: { none: true, btn: 'Send T183CORP in the client app', done: 'T183CORP sent in the client app. The return is now Client signing.', next: 'client_sign' } },
  { k: 'cert', label: 'T183CORP signed, certificate uploaded', at: 'client_sign', form: { file: 'Signed T183CORP certificate', hint: 'The certificate PDF from CCH Digital Signature.', btn: 'Upload the certificate', done: 'Signed certificate saved. The return is now Ready to file.', next: 'ready_to_file' } },
  { k: 'chk', label: 'Check export uploaded (must match the approval)', at: 'ready_to_file', form: { file: 'Check export from Taxprep', hint: 'The export taken just before transmit (RT-19).', btn: 'Upload the check export', done: 'Check export matches the approval: 1,204 of 1,204 cells match. Transmit in Taxprep, then enter the confirmation number below.' } },
  { k: 'conf', label: 'Confirmation number entered', at: 'ready_to_file', after: 'chk', form: { text: 'Confirmation number', hint: 'The number CRA shows after transmission. Letters and digits only.', btn: 'Save the confirmation number', done: 'Confirmation number saved. The return is now Filed.', next: 'filed' } },
  { k: 'noa', label: 'Notice of assessment saved and compared', at: 'filed', form: { file: 'Notice of assessment PDF', hint: 'The PDF from the CRA account.', btn: 'Save the notice of assessment', done: 'Notice of assessment saved and compared: it matches the filed return.', next: 'assessed' } },
];
const stepState = (r, s, i) => {
  const cur = idx(r.state);
  // a step is done when the return is past it
  const doneAt = { cra: idx('gaps'), t183: idx('client_sign'), cert: idx('ready_to_file'), chk: idx('filed'), conf: idx('filed'), noa: idx('assessed') };
  if (cur >= doneAt[s.k]) return 'done';
  const prev = STEPS[i - 1];
  if (s.k === 'conf') return cur === idx('ready_to_file') && stepState(r, STEPS[3], 3) === 'done' ? 'todo' : 'locked';
  if (s.k === 'cra') return cur === idx('evidence') ? 'todo' : cur < idx('evidence') ? 'locked' : 'done';
  return cur === idx(s.at) ? 'todo' : 'locked';
};
const LOCK_WHY = { cra: 'Starts when the return reaches Evidence.', t183: 'Starts after the CPA approves.', cert: 'Starts when T183CORP has been sent.', chk: 'Starts when the client has signed and the certificate is uploaded.', conf: 'Starts after the check export is uploaded and the return is transmitted.', noa: 'Starts after the confirmation number is entered.' };

const opsPanel = (r) => {
  const items = STEPS.map((s, i) => {
    const st = stepState(r, s, i);
    const f = s.form;
    const form = st !== 'done' ? `<form class="app-opsform"${st === 'locked' ? ' hidden' : ''} data-ops-form data-step="${s.k}" data-done="${esc(f.done)}"${f.next ? ` data-next="${f.next}"` : ''} novalidate>
<div class="govuk-form-group" data-field-group>${f.none ? '' : `<label class="govuk-label govuk-label--s" for="f-${s.k}">${f.file || f.text}</label><div class="govuk-hint" id="f-${s.k}-hint">${f.hint}</div><p class="govuk-error-message" id="f-${s.k}-error" hidden><span class="govuk-visually-hidden">Error:</span> <span data-error-text>${f.file ? 'Choose the file to upload' : 'Enter the confirmation number'}</span></p>${f.file ? `<input class="govuk-file-upload" id="f-${s.k}" name="f" type="file" aria-describedby="f-${s.k}-hint">` : `<input class="govuk-input govuk-input--width-20" id="f-${s.k}" name="f" type="text" autocomplete="off" spellcheck="false" aria-describedby="f-${s.k}-hint">`}`}</div>
<button class="govuk-button govuk-!-margin-bottom-0" type="submit" data-module="govuk-button" data-prevent-double-click="true">${f.btn}</button></form>` : '';
    const status = st === 'done' ? done : st === 'todo' ? todo : cant;
    return `<li class="app-step" data-step-item="${s.k}" data-step-state="${st}"><div class="app-step__head"><span class="app-step__name">${s.label}</span><span class="app-step__status" data-status-slot>${status}</span></div>${st === 'locked' ? `<p class="govuk-hint govuk-!-margin-bottom-0" data-lock-why>${LOCK_WHY[s.k]}</p>` : ''}${form}</li>`;
  });
  const left = STEPS.filter((s, i) => stepState(r, s, i) !== 'done');
  const leftTxt = left.length ? `Left to do on this return: ${left.map((s) => s.label.split(',')[0].toLowerCase()).join(', then ')}.` : 'Every ops step is done.';
  return panel('ops', 'Ops steps', `<p class="govuk-body" data-ops-left>${leftTxt}</p><p class="govuk-body" role="status" tabindex="-1" data-ops-result hidden></p><div class="govuk-error-summary" data-module="govuk-error-summary" data-ops-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#ops" data-error-link>Fix the field</a></li></ul></div></div></div><ol class="app-steps">${items.join('')}</ol>`);
};

function panels(r) {
  const t = (x) => tabHref(x);
  const docs = docsOf(r), exc = excOf(r), hist = histOf(r);
  const ps = [];
  // overview
  let o = '';
  if (r.voided) o += `<div class="moj-alert moj-alert--warning" role="region" aria-label="Approval void" data-module="moj-alert"><div><svg class="moj-alert__icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 8v9M15 20v2" stroke="currentColor" stroke-width="3"/></svg></div><div class="moj-alert__content"><strong>Approval void.</strong> ${r.changed} cells changed after approval. The CPA sees only those cells, before and after. <a class="govuk-link" href="${t('exceptions')}">See the exceptions</a></div></div>`;
  if (r.blocker) o += `<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>Blocked by: ${esc(r.blocker)}. <a class="govuk-link" href="${t(r.blockerLink || 'overview')}">See where</a></strong></div>`;
  o += stepper(r);
  o += `<div class="govuk-grid-row"><div class="govuk-grid-column-one-half"><div class="govuk-summary-card"><div class="govuk-summary-card__title-wrapper"><h3 class="govuk-summary-card__title">Next step</h3></div><div class="govuk-summary-card__content"><p class="govuk-body">${esc(nextStep(r))}</p>${r.note ? `<p class="govuk-body govuk-hint">${esc(r.note)}</p>` : ''}</div></div></div>
<div class="govuk-grid-column-one-half"><div class="govuk-summary-card"><div class="govuk-summary-card__title-wrapper"><h3 class="govuk-summary-card__title">Who acts on each state</h3></div><div class="govuk-summary-card__content"><p class="govuk-body">Now: <strong>${stateInfo[r.state].label}</strong>, acted on by ${esc(stateInfo[r.state].who)}.</p><p class="govuk-body">Then: <strong>${esc(stateInfo[order[Math.min(idx(r.state) + 1, 15)]].label)}</strong>.</p></div></div></div></div>`;
  o += `<section class="govuk-!-margin-bottom-6"><h3 class="govuk-heading-s">Documents</h3>${docTable(r, docs.slice(0, 5), `Documents, ${Math.min(5, docs.length)} of ${docs.length}`, true)}<p class="govuk-body"><a class="govuk-link" href="${t('documents')}">View all ${docs.length} documents</a></p></section>`;
  o += `<section class="govuk-!-margin-bottom-6"><h3 class="govuk-heading-s">Exceptions</h3>${exc.length ? excTable(exc.slice(0, 5), `Exceptions, ${Math.min(5, exc.length)} of ${exc.length}`) + `<p class="govuk-body"><a class="govuk-link" href="${t('exceptions')}">View all ${exc.length} exceptions</a></p>` : '<p class="govuk-body">No exceptions on this return.</p>'}</section>`;
  o += `<section class="govuk-!-margin-bottom-6"><h3 class="govuk-heading-s">Changed cells</h3>${r.changed ? simpleTable({ hide: true, caption: `Changed since approval, ${r.changed} cells (first 3)`, head: ['Line', 'Before', 'After'], numCols: [1, 2], rows: [['Line 8320 Total revenue', '412,310.00', '412,860.00'], ['Line 9270 Other expenses', '18,420.50', '17,990.50'], ['Schedule 8 class 8 addition', '14,500.00', '14,850.00']].map((x) => [x[0], `<span class="app-money">${x[1]}</span>`, `<span class="app-money">${x[2]}</span>`]) }) + `<p class="govuk-body"><a class="govuk-link" href="${t('review')}">View all ${r.changed} changed cells in Review</a></p>` : '<p class="govuk-body">No cells have changed since the last approval check.</p>'}</section>`;
  o += `<section class="govuk-!-margin-bottom-6"><h3 class="govuk-heading-s">Recent history</h3>${timeline(hist, 3)}<p class="govuk-body"><a class="govuk-link" href="${t('history')}">View full history</a></p></section>`;
  ps.push(panel('overview', 'Overview', o));
  // workbench
  {
    const st = r.state; const early = idx(st) < idx('prepare');
    const items = early ? [['Lock export and printed return uploaded', cant], ['Tax choices read and cited', cant], ['Mark Ready', cant]] : st === 'prepare' ? [['Lock export and printed return uploaded', '<strong class="govuk-tag govuk-tag--orange">Not uploaded</strong>', t('documents')], ['Tax choices read and cited, 3 of 5 done', '<strong class="govuk-tag govuk-tag--blue">In progress</strong>', t('exceptions')], ['Mark Ready', cant]] : [['Lock export and printed return uploaded', done, t('documents')], ['Tax choices read and cited', done, t('exceptions')], ['Mark Ready', done]];
    ps.push(panel('workbench', 'What is left for the preparer', `<p class="govuk-body">Each step opens the tab that holds it. The workbench grid has its own design family; this tab only says where the preparer stands.</p>` + taskList(items)));
  }
  // review
  {
    const inReview = ['review', 'rework'].includes(r.state);
    ps.push(panel('review', 'Review', inReview ? `<p class="govuk-body">No section is marked Reviewed yet. Approve appears only when every section is reviewed. ${r.state === 'rework' ? `${r.changed} cells changed since the last approval check.` : `${r.flags} pinned flags are waiting.`}</p><p class="govuk-body">The sections with their Reviewed marks are designed in the CPA review family.</p>` : `<p class="govuk-body">Review has not started. This return is in <strong>${stateInfo[r.state].label}</strong>${idx(r.state) > idx('review') ? ' and has already passed review' : ' and reaches the CPA after Respond'}.</p>`));
  }
  // documents with the viewer beside the list (rule 20)
  ps.push(panel('documents', 'Documents', `<div class="app-docs"><div class="app-docs__list">${simpleTable({ hide: true, caption: `Documents, ${docs.length}`, head: ['Document', 'Source', 'Status'], rows: docRows(r, docs, false) })}<p class="govuk-hint">Choose a document to read it beside this list. Use "Send to second window" to keep it on your other screen; it follows each document you choose.</p></div>
<aside class="app-viewer" aria-label="Source viewer" data-viewer tabindex="-1"><p class="govuk-body" data-viewer-empty>Choose a document to read it here.</p><div data-viewer-body hidden></div></aside></div>`));
  // exceptions
  ps.push(panel('exceptions', 'Exceptions', exc.length ? excTable(exc, `Exceptions, ${exc.length}`) : '<p class="govuk-body">No exceptions on this return.</p>'));
  // history
  {
    let h = '';
    if (r.waiting) h += `<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" tabindex="-1" aria-labelledby="nb-title" data-nudge-banner hidden><div class="govuk-notification-banner__header"><h3 class="govuk-notification-banner__title" id="nb-title">Success</h3></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Nudge sent to the client in the client app. Last contact is now ${fmt(TODAY)}.</p></div></div>
<div class="govuk-summary-card"><div class="govuk-summary-card__title-wrapper"><h3 class="govuk-summary-card__title">Waiting on client</h3></div><div class="govuk-summary-card__content"><dl class="govuk-summary-list govuk-summary-list--no-border"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Flag set</dt><dd class="govuk-summary-list__value">${fmt(r.waiting.since)}, ${r.waiting.days} days ago</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Last contact</dt><dd class="govuk-summary-list__value" data-last-contact>${fmt(r.waiting.last)}: ${esc(r.waiting.lastHow)}</dd></div></dl><button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-nudge>Send a nudge in the client app</button></div></div>`;
    ps.push(panel('history', 'History', h + timeline(hist, 99)));
  }
  ps.push(opsPanel(r));
  return ps.join('\n');
}

const landing = (r) => (r.state === 'review' ? 'review' : ['approved', 'ready_to_file', 'filed', 'client_sign'].includes(r.state) ? 'ops' : 'queue');

export function recordPage(r) {
  const nav = `<nav class="moj-sub-navigation" aria-label="Sections of this return"><ul class="moj-sub-navigation__list">${TABS.map(([k, l]) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#${k}" data-route="${k}">${l}</a></li>`).join('')}</ul></nav>`;
  const pn = `<p class="govuk-body app-listnav" data-listnav><a class="govuk-link" href="queue-preparer.html" data-back>Back to the list</a> <a class="govuk-link" href="queue-preparer.html" data-key-prev aria-keyshortcuts="p" hidden>Previous return (p)</a> <a class="govuk-link" href="queue-preparer.html" data-key-next aria-keyshortcuts="n" hidden>Next return (n)</a></p>`;
  const html = `${pn}${identity(r, actions(r))}${since(r)}${facts(r)}${nav}<p class="govuk-visually-hidden" role="status" data-route-status></p>${panels(r)}`;
  const sc = [['n', 'Next return in the list you came from'], ['p', 'Previous return in the list you came from']];
  return page({ title: 'Return', ret: r, nav: landing(r), body: html, shortcuts: sc, self: recFile(r), bodyClass: 'app-record', ctx: `<script>window.APP_REC=${JSON.stringify({ slug: r.slug, name: r.name, ye: fmt(r.ye) })};</script>` });
}
