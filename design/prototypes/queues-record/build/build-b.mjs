// Version B: Zendesk-style views. A list on the left, a summary pane of the selected return on the right
// (no page load, j and k move the selection); the full record opens as a page with a left rail of sections
// and Previous and Next return links, so a CPA can triage in order.
import { STATES, RETURNS, PEOPLE, stateInfo } from './data.mjs';
import { ALL, esc, fmt, write, page, filterBox, emptyFilter, counts, oldest, recHref, stateTag, tierTag, waitTag, person, diffDays } from './lib.mjs';
import { listTable, pick, stateChips, tierChips, views } from './lists.mjs';
import { TABS, recordPage, sourcePage, nextStep } from './record.mjs';

const DIR = 'b-split';
const out = (f, h) => write(DIR, f, h);
const hrefFn = (r) => '#' + r.slug; hrefFn.force = true;

const pane = (r) => {
  const row = (k, v) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${k}</dt><dd class="govuk-summary-list__value">${v}</dd></div>`;
  return `<section data-pane="${r.slug}" aria-labelledby="p-${r.slug}"><h2 class="govuk-heading-m" id="p-${r.slug}">${esc(r.name)}, year end ${fmt(r.ye)}</h2>
<p class="govuk-body">${stateTag(r.state)} ${tierTag(r.tier)} ${r.waiting ? waitTag(r.waiting) : ''}</p>
${r.blocker ? `<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>Blocked by: ${esc(r.blocker)}</strong></div>` : ''}
<dl class="govuk-summary-list govuk-summary-list--no-border">${row('Preparer', esc(person(r.prep)))}${row('CPA reviewer', esc(person(r.cpa)))}${row('Filing due', fmt(r.filing))}${row('Balance due', fmt(r.balance))}${row('In this state', r.daysInState + ' days')}${row('Held by', r.holder ? esc(person(r.holder)) : 'Nobody')}${r.group ? row('Group', esc(r.group)) : ''}${r.flags ? row('Pinned flags', r.flags) : ''}${r.changed ? row('Changed cells', r.changed) : ''}</dl>
<p class="govuk-body"><strong>Next:</strong> ${esc(nextStep(r))}</p>
${r.filler ? '<p class="govuk-hint">This is a filler row for the 300-row state. Only the ten sample clients have a record page.</p>' : `<ul class="govuk-list govuk-list--bullet"><li>${r.docs.length} documents</li><li>${r.exc.length} exceptions</li><li>Latest: ${esc(r.hist[0][0])}</li></ul><a class="govuk-button" role="button" draggable="false" href="${recHref(r)}">Open the full record</a>`}</section>`;
};

function split({ file, role, view, title, intro, set, navKey, bulk = false }) {
  const rows = pick(role, view);
  const body = `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">${title}</h1><p class="govuk-body">${intro}</p>${views(role, view)}${role === 'ops' ? '<p class="govuk-body"><a class="govuk-link" href="queue-ops-assign.html">Assign several returns</a></p>' : ''}
${rows.length ? `${filterBox()}${role === 'ops' ? stateChips(rows) : tierChips(rows)}
<div class="app-split"><div class="app-split__list app-tablewrap" role="region" aria-label="List of returns, scrollable" tabindex="0">${listTable({ id: 'returns', caption: `${title}, ${rows.length} returns, sorted by filing due date`, set, rows, hrefFn, hiddenCaption: true, rowAttrs: (r) => ` data-pane-row="${r.slug}" aria-selected="false"` })}</div>
<div class="app-split__pane" role="region" aria-label="Summary of the selected return" aria-live="polite">${rows.map(pane).join('')}</div></div>${emptyFilter}` : `<div class="govuk-inset-text"><h2 class="govuk-heading-m">Nothing is waiting on you</h2><p class="govuk-body">Choose <a class="govuk-link" href="queue-all.html">All returns</a> to take one that nobody holds.</p></div>`}`;
  out(file, page({ title, nav: navKey, body, shortcuts: [['j and k', 'Select the next or previous return in the list; the summary follows'], ['Enter', 'On a name in the list, shows its summary']] }));
}
split({ file: 'queue-preparer.html', role: 'prep', view: 'mine', title: 'My work', intro: 'Select a return to see its summary at the right. The summary has the one button that opens the full record.', set: 'splitprep', navKey: 'queue' });
split({ file: 'queue-all.html', role: 'prep', view: 'all', title: 'All returns', intro: 'All 300 returns. The ten sample clients open into full records.', set: 'splitprep', navKey: 'queue' });
split({ file: 'queue-waiting.html', role: 'prep', view: 'waiting', title: 'Waiting on client', intro: 'Dated flag, not a state.', set: 'splitprep', navKey: 'queue' });
split({ file: 'queue-due.html', role: 'prep', view: 'due14', title: 'Due in 14 days', intro: 'Filing due within 14 days.', set: 'splitprep', navKey: 'queue' });
split({ file: 'queue-rework.html', role: 'prep', view: 'rework', title: 'Rework', intro: 'One return came back from the CPA (the one-row state).', set: 'splitprep', navKey: 'queue' });
split({ file: 'queue-cpa.html', role: 'cpa', view: 'ready', title: 'Ready to review', intro: 'Triage here: tier, flag count and due date at left, the whole summary at right. Press n on a record to go to the next return in this order.', set: 'splitcpa', navKey: 'review' });
split({ file: 'queue-cpa-rework.html', role: 'cpa', view: 'rework', title: 'Rework', intro: 'Returned returns with the changed-cell count.', set: 'splitcpa', navKey: 'review' });
split({ file: 'queue-cpa-due.html', role: 'cpa', view: 'due14', title: 'Due in 14 days', intro: 'Ready to review and due within 14 days.', set: 'splitcpa', navKey: 'review' });
split({ file: 'queue-cpa-all.html', role: 'cpa', view: 'all', title: 'All in the review flow', intro: 'Respond, review and rework together.', set: 'splitcpa', navKey: 'review' });
split({ file: 'queue-ops.html', role: 'ops', view: 'next', title: 'Next ops step', intro: 'Intake to filing. The summary names the next ops step.', set: 'splitops', navKey: 'ops' });
split({ file: 'queue-ops-waiting.html', role: 'ops', view: 'waiting', title: 'Waiting on client', intro: 'Chase list. Open the record and its history tab to nudge.', set: 'splitprep', navKey: 'ops' });
split({ file: 'queue-ops-all.html', role: 'ops', view: 'all', title: 'All returns, ops columns', intro: 'Every return.', set: 'splitops', navKey: 'ops' });

out('queue-preparer-empty.html', page({ title: 'My work', nav: 'queue', body: `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">My work</h1><p class="govuk-body">As Casey Lee (Test). The empty state of the split list.</p>${views('prep', 'mine')}<div class="govuk-inset-text"><h2 class="govuk-heading-m">Nothing is waiting on you</h2><p class="govuk-body">Every return you hold is with someone else or finished.</p><ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="queue-all.html">All returns</a></li><li><a class="govuk-link" href="queue-waiting.html">Waiting on client</a></li></ul></div>` }));
out('search-no-match.html', page({ title: 'No match', nav: 'queue', body: `<h1 class="govuk-heading-xl">No return matches that search</h1><p class="govuk-body">Nothing in any queue matches <strong data-echo-q>that text</strong>.</p><ul class="govuk-list govuk-list--bullet"><li>Check the spelling, or try the business number (9 digits).</li><li>Try part of the name.</li></ul><p class="govuk-body"><a class="govuk-link" href="queue-all.html">Browse all returns</a></p>` }));

// bulk assign for ops, as a plain list below the split (error state)
out('queue-ops-assign-error.html', page({ title: 'Assign returns', error: true, nav: 'ops', body: `<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#assign-to">Choose a person to assign the selected returns to</a></li></ul></div></div></div><h1 class="govuk-heading-xl">Assign returns</h1><p class="govuk-body">In this version bulk assignment is its own small screen, opened from the ops list with "Assign several returns", so the split stays one job.</p>
<form action="queue-ops.html"><div class="govuk-form-group govuk-form-group--error"><label class="govuk-label" for="assign-to">Assign 2 selected returns to</label><p id="assign-to-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> Choose a person to assign the selected returns to</p><select class="govuk-select govuk-select--error" id="assign-to" aria-describedby="assign-to-error"><option value="">Choose a person</option><option>${PEOPLE.priti}</option><option>${PEOPLE.ben}</option></select></div><button class="govuk-button" type="submit">Assign</button></form>` }));

out('queue-ops-assign.html', page({ title: 'Assign returns', nav: 'ops', body: `<h1 class="govuk-heading-xl">Assign returns</h1><form action="queue-ops-assign-error.html" data-assign-page><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--m">Returns to assign</legend><div class="govuk-checkboxes govuk-checkboxes--small">${RETURNS.filter((r) => ['approved', 'ready_to_file', 'filed'].includes(r.state)).map((r) => `<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="a-${r.slug}" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="a-${r.slug}">${esc(r.name)}, year end ${fmt(r.ye)}, next: ${esc(r.nextOps)}</label></div>`).join('')}</div></fieldset><div class="govuk-form-group govuk-!-margin-top-4"><label class="govuk-label" for="assign-to">Assign to</label><select class="govuk-select" id="assign-to" name="who"><option value="">Choose a person</option><option>${PEOPLE.priti}</option><option>${PEOPLE.ben}</option></select></div><button class="govuk-button" type="submit">Assign</button></form>` }));
// board: strip, then the split
{
  const c = counts(ALL);
  const strip = `<ol class="app-pipeline" aria-label="Returns per state">${STATES.filter((s) => s[0] !== 'closed').map(([k, l]) => `<li><a href="#state=${k}" data-filter-key="state" data-filter-value="${k}" aria-current="false" class="${c[k] ? '' : 'app-pipeline__zero'}"><span class="app-pipeline__count">${c[k] || 0}</span><span class="app-pipeline__label">${l}</span><span class="app-pipeline__age">${c[k] ? 'oldest ' + oldest(ALL, k) + ' days' : 'none'}</span></a></li>`).join('')}</ol>`;
  out('board.html', page({ title: 'Board', nav: 'board', body: `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">Board</h1><p class="govuk-body">Pipeline by state. The strip filters the list; the pane summarises the selected return.</p>${strip}${filterBox()}${tierChips(ALL)}<div class="app-split"><div class="app-split__list app-tablewrap" role="region" aria-label="List of returns, scrollable" tabindex="0">${listTable({ id: 'returns', caption: 'All 300 returns, sorted by filing due date', set: 'splitprep', rows: ALL, hrefFn, hiddenCaption: true, rowAttrs: (r) => ` data-pane-row="${r.slug}" aria-selected="false"` })}</div><div class="app-split__pane" role="region" aria-label="Summary of the selected return" aria-live="polite">${ALL.map(pane).join('')}</div></div>${emptyFilter}` }));
}

for (const r of RETURNS) {
  for (const [tab] of TABS) out(`rec-${r.slug}-${tab}.html`, recordPage(r, tab, 'B'));
  if (r.waiting) out(`rec-${r.slug}-history-nudged.html`, recordPage(r, 'history', 'B', true));
  r.docs.forEach((_, i) => out(`src-${r.slug}-${i + 1}.html`, sourcePage(r, i + 1, 'B')));
}

out('index.html', page({ title: 'Version B, split', nav: '', body: `<h1 class="govuk-heading-xl">Version B: list and detail split</h1>
<p class="govuk-body">Zendesk-style views: the list at the left, the summary of the selected return at the right, no page load between returns. The full record is a page with a left rail of sections and Previous and Next return links. Best for triage (the CPA) and for ops chasing; costs width, which the brief warned about, so the pane holds a summary only and no tabs.</p>
<ol class="govuk-list govuk-list--number app-index">
<li><a class="govuk-link" href="queue-preparer.html">Preparer: My work</a>; select a row, press j or k, then "Open the full record".</li>
<li>Find a return: type "halton" in the search box, Enter. <a class="govuk-link" href="search-no-match.html">No match</a>.</li>
<li><a class="govuk-link" href="queue-cpa.html">CPA: ready to review</a>, <a class="govuk-link" href="queue-cpa-rework.html">rework</a>; on a record, <a class="govuk-link" href="rec-maple-ridge-overview.html">Maple Ridge</a> has Next return (n).</li>
<li><a class="govuk-link" href="queue-ops.html">Ops: next step</a>, <a class="govuk-link" href="queue-ops-assign-error.html">assign error</a>, <a class="govuk-link" href="rec-scarborough-robotics-ops.html">ops tab</a>.</li>
<li><a class="govuk-link" href="queue-ops-waiting.html">Chase waiting on client</a>, <a class="govuk-link" href="rec-danforth-cleaning-history.html">history and nudge</a>.</li>
<li><a class="govuk-link" href="board.html">Board: strip over 300 rows</a>.</li></ol>
<p class="govuk-body">States: <a class="govuk-link" href="queue-preparer-empty.html">empty</a>, <a class="govuk-link" href="queue-rework.html">one row</a>, <a class="govuk-link" href="queue-all.html">300 rows</a>, <a class="govuk-link" href="rec-halton-haulage-overview.html">blocked</a>, <a class="govuk-link" href="rec-eglinton-holdings-overview.html">approval void</a>.</p>
<p class="govuk-body"><a class="govuk-link" href="../index.html">All versions</a></p>` }));
console.log('B done');
