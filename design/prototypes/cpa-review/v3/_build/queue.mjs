// The CPA queue (V15), the approval record (RV-11) and the signed-out page. Only govuk-, moj- and app- classes.
import { esc, longDate, SECTIONS, sectionsOf, getReturn, SCENARIOS, risksOf, queueRows, waited, sinceText, TODAY_ISO } from './model.mjs';
import { H, frame, wrapMain, footNote, miniBar } from './ui.mjs';
import { PERSON, SCRIPT_PATH, statesStrip } from './record.mjs';

const RANK = { red: 1, amber: 2, green: 3 };
const keysQueue = () => '<details class="app-keys app-keys--page"><summary class="app-keys__summary">Keyboard shortcuts</summary><div class="app-keys__pop" role="group" aria-label="Keyboard shortcuts"><ul class="app-keys__list"><li><kbd>s</kbd> Search: find a return</li></ul><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="keys-off">Turn single-key shortcuts off</label></div></div></div></details>';

// ---------------------------------------------------------------- queue (task 1)
export function queuePage(mode) {
  const rows = mode === 'empty' || mode === 'error' ? [] : queueRows(mode === 'later');
  const nRework = rows.filter((q) => q.round === 'Back from rework').length;
  const tr = rows.map((q) => {
    const bal = q.balancePast ? `<span class="app-nowrap">${longDate(q.balance)}</span><br><span class="app-quiet">date has passed</span>` : `<span class="app-nowrap">${longDate(q.balance)}</span>`;
    const fil = q.overdue ? `<span class="app-nowrap">${longDate(q.filing)}</span><br>${H.tag('Overdue', 'red')}` : `<span class="app-nowrap">${longDate(q.filing)}</span>`;
    const name = q.open ? `<a class="govuk-link" href="${q.open}" data-q-open>${esc(q.name)}</a>` : esc(q.name);
    return `<tr class="govuk-table__row" data-q-name="${esc(q.name.toLowerCase())}" data-q-tier="${q.tier}" data-q-round="${esc(q.round)}"><th scope="row" class="govuk-table__header">${name}</th><td class="govuk-table__cell" data-sort-value="${q.ye}"><span class="app-nowrap">${longDate(q.ye)}</span></td><td class="govuk-table__cell" data-sort-value="${q.overdue ? 0 : 1}-${RANK[q.tier]}-${q.filing}-${q.since}">${H.tier(q.tier)}<br><span class="app-why-text">${esc(q.why)}</span></td><td class="govuk-table__cell" data-sort-value="${q.filing}">${fil}</td><td class="govuk-table__cell" data-sort-value="${q.balance}">${bal}</td><td class="govuk-table__cell" data-sort-value="${esc(q.signed)}">${esc(q.signed)}</td><td class="govuk-table__cell" data-sort-value="${esc(q.round)}">${q.round === 'Back from rework' ? H.tag('Back from rework', 'purple') : 'First review'}</td><td class="govuk-table__cell" data-sort-value="${q.since}">${waited(q.since, mode === 'later' ? '2026-03-10T14:30' : undefined)}<br><span class="app-quiet">since ${sinceText(q.since)}</span></td></tr>`;
  }).join('');
  const views = `<nav class="moj-sub-navigation app-qviews" aria-label="Queue views"><ul class="moj-sub-navigation__list"><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/all" data-qview="all">All <span class="moj-badge moj-badge--blue">${rows.length}<span class="govuk-visually-hidden"> returns</span></span></a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/rework" data-qview="rework">Back from rework <span class="moj-badge moj-badge--purple">${nRework}<span class="govuk-visually-hidden"> returns</span></span></a></li></ul></nav>`;
  const intro = '<p class="govuk-body govuk-!-margin-bottom-2" id="q-order">Order: overdue first, then tier (red first), then filing due date, then longest waiting. Select a column heading to sort.</p>';
  const filters = `<div class="app-qrow"><form class="app-qfilter" data-qfilter role="search" aria-label="Filter the queue"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="q-search">Search by name</label><input class="govuk-input" id="q-search" name="q" type="search" autocomplete="off" aria-keyshortcuts="s"></div><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="q-tier">Tier</label><select class="govuk-select" id="q-tier" name="tier"><option value="">All tiers</option><option value="red">Red</option><option value="amber">Amber</option><option value="green">Green</option></select></div><div class="govuk-form-group"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-q-clear>Clear filters</button></div></form><p class="govuk-body app-qcount" data-q-count data-count="queue" data-scope="waiting" role="status">${rows.length} returns waiting.</p></div>`;
  let body;
  if (mode === 'error') {
    body = `<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#retry">The review queue could not be loaded. Try again, and tell the office manager if it happens twice.</a></li></ul></div></div></div>
<h1 class="govuk-heading-l govuk-!-margin-bottom-2">Review queue</h1>
<p class="govuk-body">Nothing is shown because the list did not load. No return was changed or lost.</p>
<p class="govuk-body"><a class="govuk-button app-btn-sm" role="button" draggable="false" id="retry" href="queue.html">Try again</a></p>`;
  } else if (mode === 'empty') {
    body = `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Review queue</h1><div class="app-queue-head">${views}${keysQueue()}</div>
<div class="govuk-inset-text" data-q-none="all"><p class="govuk-body"><strong>No returns are waiting for your review.</strong></p><p class="govuk-body">New returns appear here when a preparer sends one. Nothing to do now.</p></div>
<div class="govuk-inset-text" data-q-none="rework" hidden><p class="govuk-body"><strong>No returns are back from rework.</strong></p><p class="govuk-body">A return appears here when its preparer sends it back after your comments. Nothing to do now.</p></div>`;
  } else {
    body = `<h1 class="govuk-heading-m govuk-!-margin-bottom-1">Review queue</h1>${intro}<div class="app-queue-head">${views}${keysQueue()}</div>${filters}
<div data-q-empty hidden class="govuk-inset-text"><p class="govuk-body"><strong data-q-empty-title>No returns match.</strong></p><p class="govuk-body" data-q-empty-why>Clear the filters to see all ${rows.length}.</p></div>
<div class="app-scroll-x" role="region" aria-label="Returns waiting for review" tabindex="0"><table class="govuk-table" data-module="moj-sortable-table" data-q-table><caption class="govuk-table__caption govuk-visually-hidden">Returns waiting for review, overdue first, then tier, then filing due date (${rows.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header" aria-sort="none">Return</th><th scope="col" class="govuk-table__header" aria-sort="none">Year end</th><th scope="col" class="govuk-table__header" aria-sort="ascending">Tier and why</th><th scope="col" class="govuk-table__header" aria-sort="none">Filing due</th><th scope="col" class="govuk-table__header" aria-sort="none">Balance due</th><th scope="col" class="govuk-table__header" aria-sort="none">Preparer who signed</th><th scope="col" class="govuk-table__header" aria-sort="none">Round</th><th scope="col" class="govuk-table__header" aria-sort="none">Waiting</th></tr></thead><tbody class="govuk-table__body">${tr}</tbody></table></div>
<div class="govuk-inset-text">In this prototype four returns open: Bluewater, Maple Ridge, Scarborough Robotics and Queen West. The other six rows show the list only.${mode === 'later' ? ' Later the same day: the preparer has sent Maple Ridge back.' : ''}</div>`;
  }
  const main = wrapMain(body, 'app-main--queue');
  const title = { first: 'Review queue', later: 'Review queue, later', empty: 'Review queue, nothing waiting', error: 'Review queue' }[mode];
  return frame({ title, error: mode === 'error', main, bodyAttrs: `data-queue data-mode="${mode}"`, foot: footNote(statesStrip({ first: 'queue.html', later: 'queue-later.html', empty: 'queue-empty.html', error: 'queue-error.html' }[mode])), scripts: SCRIPT_PATH, person: PERSON });
}

// ---------------------------------------------------------------- approved (RV-11: marks, judgments, time on each section and every source opened)
const APPROVED_AT = { red: '10 Mar 2026, 15:41', green: '10 Mar 2026, 11:34', blue: '10 Mar 2026, 12:05', scar: '10 Mar 2026, 12:40' };
// made-up judgments for the approval records of the returns whose judgments are not in a scenario (a judgment made in this session replaces them)
const SAMPLE_JUDG = {
  blue: {
    '03-F05': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 11:41', reason: 'The preparer\'s list names every payee and the contract. I accept that these are subcontractors, not employees, and I will ask for the T5018 slips before filing.' },
    '03-F01': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 11:47', reason: 'The bonus was paid on day 181, so the deduction moves to next year. I keep the add-back on Schedule 1 and accept the deferral.' },
  },
  scar: {
    '09-F03': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:25', reason: 'Both lenders are the shareholders; I will ask for a one-line loan agreement and treat the loans as long term for now.' },
    '09-F04': { kind: 'comment', by: 'Zo', when: '10 Mar 2026, 10:41', comment: 'C-1' },
    '09-F06': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 11:58', reason: 'The costs are coded as bought and nothing is claimed this year. I accept that and the research claim is for next year\'s review.' },
    '09-F05': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 12:06', reason: 'The HST before registration sits inside the cost and the amount is small. I accept the treatment.' },
    '09-F07': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 12:14', reason: 'Small amount in the first year. I accept the preparer\'s coding and note class 14.1 in the file.' },
  },
};
const SAMPLE = [[4, 12, 6], [3, 40, 9], [2, 5, 3], [1, 50, 2], [1, 5, 0], [2, 20, 4], [1, 35, 3], [3, 0, 5], [0, 40, 0], [0, 25, 0], [1, 30, 2], [0, 55, 2]];
export function approvedPage(which) {
  const R = getReturn(which);
  const secs = sectionsOf(R);
  const risks = risksOf(R);
  const J = which === 'red' ? SCENARIOS['red-ready'].judg : (SAMPLE_JUDG[which] || {});
  const rows = secs.map((s, i) => `<tr><th scope="row" class="govuk-table__header">${esc(s.title)}</th><td class="govuk-table__cell">Zo, 10 Mar 2026, ${which === 'red' ? '15:' + String(2 + i * 2).padStart(2, '0') : '11:' + String(8 + i * 2).padStart(2, '0')}</td><td class="govuk-table__cell app-money">${SAMPLE[i][0]} min ${String(SAMPLE[i][1]).padStart(2, '0')} s</td><td class="govuk-table__cell app-money">${SAMPLE[i][2]}</td></tr>`).join('');
  const totalSec = secs.reduce((a, s, i) => a + SAMPLE[i][0] * 60 + SAMPLE[i][1], 0), totalSrc = secs.reduce((a, s, i) => a + SAMPLE[i][2], 0);
  const judgRows = risks.map((f) => {
    const j = J[f.id];
    const word = j.kind === 'accept' ? 'Accepted' : 'Commented instead';
    const why = j.kind === 'accept' ? j.reason : `Comment ${j.comment} sent to the preparer.`;
    return `<tr data-judg-row="${f.id}"><th scope="row" class="govuk-table__header">${esc(f.id)} ${esc(f.title)}</th><td class="govuk-table__cell" data-judg-word>${word}</td><td class="govuk-table__cell" data-judg-why>${esc(why)}</td><td class="govuk-table__cell" data-judg-who>${esc(j.by + ', ' + j.when)}</td></tr>`;
  }).join('');
  const judgTable = risks.length
    ? `<div class="app-scroll-x" role="region" aria-label="Judgments" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--m">Your judgments on the accepted risks (${risks.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Accepted risk</th><th scope="col" class="govuk-table__header">Judgment</th><th scope="col" class="govuk-table__header">Your reason, or the comment</th><th scope="col" class="govuk-table__header">Who and when</th></tr></thead><tbody class="govuk-table__body" data-judg-body>${judgRows}</tbody></table></div>`
    : '<h2 class="govuk-heading-m">Your judgments on the accepted risks</h2><div class="govuk-inset-text"><p class="govuk-body">None. No flag in this return is an accepted risk.</p></div>';
  const row = (k, v) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${k}</dt><dd class="govuk-summary-list__value">${v}</dd></div>`;
  const main = miniBar(R, PERSON) + wrapMain(`<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Return approved</h1><div class="govuk-panel__body">${esc(R.corp)}<br>by Zo, ${APPROVED_AT[which]}</div></div>
<dl class="govuk-summary-list">${row('Sections', `${secs.length} of ${secs.length} marked Reviewed`)}${row('Accepted risks', risks.length ? `${risks.length} of ${risks.length} judged` : 'none in this return')}${row('Comments', { red: '4 of 4 resolved', scar: '2 of 2 resolved' }[which] || 'none')}${row('When the approval is void', 'If any number changes after approval, the approval is void and the marks in the sections that hold the changed numbers come off (FLOW-5, TB-11).')}</dl>
${judgTable}
<div class="app-scroll-x" role="region" aria-label="Approval record" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--m">Each mark, the time on each section and every source opened (${secs.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header">Marked Reviewed</th><th scope="col" class="govuk-table__header app-money">Time on section</th><th scope="col" class="govuk-table__header app-money">Sources opened</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table></div>
<p class="govuk-body">Total time ${Math.floor(totalSec / 60)} min ${String(totalSec % 60).padStart(2, '0')} s; ${totalSrc} sources opened.</p>
<p class="govuk-body"><a class="govuk-link" href="queue.html" data-queue-next-link>Open the next return in the queue</a></p>`);
  return frame({ title: 'Approved', ret: R, main, bodyAttrs: `data-approved data-which="${which}"`, foot: footNote(), scripts: SCRIPT_PATH, person: PERSON, bare: true });
}

// ---------------------------------------------------------------- signed out
export function signedOutPage() {
  const main = wrapMain(`<h1 class="govuk-heading-l">You have signed out</h1>
<p class="govuk-body">The second source window, if it was open, has closed. Your choice about the second window is remembered for the next time you sign in.</p>
<p class="govuk-body"><a class="govuk-link" href="queue.html">Sign in again</a> (the prototype goes straight to the review queue).</p>`);
  return frame({ title: 'Signed out', main, bodyAttrs: 'data-signedout', foot: footNote(), scripts: SCRIPT_PATH, bare: true, person: null });
}
