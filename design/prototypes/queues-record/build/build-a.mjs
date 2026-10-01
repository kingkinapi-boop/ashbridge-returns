// Version A: Salesforce-style list views per role plus a record page with tabs (the brief's recommended option),
// with the owner's pipeline count strip above the full list.
import { STATES, RETURNS, PEOPLE, bySlug } from './data.mjs';
import { ALL, esc, fmt, write, page, chips, filterBox, emptyFilter, subNav, counts, oldest, diffDays, recHref, stateTag } from './lib.mjs';
import { listTable, pick, stateChips, tierChips, SETS, views } from './lists.mjs';
import { TABS, recordPage, sourcePage } from './record.mjs';

const DIR = 'a-tabs';
const out = (f, h) => write(DIR, f, h);


function listPage({ file, role, view, title, intro, set, navKey, saved }) {
  const rows = pick(role, view);
  const body = `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">${title}</h1>
<p class="govuk-body">${intro}</p>
${views(role, view)}
<p class="govuk-body govuk-hint">Saved views are kept per staff account. Default order: filing due date, earliest first. Click a column heading to sort the whole list.</p>
${rows.length ? `${filterBox()}${role === 'prep' || role === 'cpa' ? tierChips(rows) : stateChips(rows)}
${role === 'ops' ? `<form class="app-bulkbar" data-bulkbar hidden action="queue-ops-assign-error.html" data-bulk-form><span data-sel-count role="status"></span><div class="govuk-form-group govuk-!-margin-bottom-0"><label class="govuk-label" for="assign-to">Assign selected returns to</label><select class="govuk-select" id="assign-to" name="who"><option value="">Choose a person</option><option>${PEOPLE.priti}</option><option>${PEOPLE.ben}</option></select></div><button class="govuk-button govuk-!-margin-bottom-0" type="submit">Assign</button></form><p class="govuk-body" data-bulk-result tabindex="-1" role="status" hidden></p>` : ''}
<div class="app-tablewrap" role="region" aria-label="Returns, scrollable" tabindex="0">${listTable({ id: 'returns', caption: `${title}, ${rows.length} returns, sorted by filing due date`, set, rows, select: role === 'ops', hiddenCaption: true })}</div>${emptyFilter}` : empty(role)}`;
  out(file, page({ title, body, nav: navKey, shortcuts: [['Space', 'Select the focused row (ops list)']] }));
}
const empty = (role) => `<div class="govuk-inset-text"><h2 class="govuk-heading-m">Nothing is waiting on you</h2><p class="govuk-body">Every return you hold is with someone else or finished. Choose where to look next.</p><ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="queue-all.html">All returns</a>, to take one that nobody holds</li><li><a class="govuk-link" href="queue-waiting.html">Waiting on client</a>, to see what is stuck outside the firm</li></ul></div>`;

// ---------- preparer ----------
listPage({ file: 'queue-preparer.html', role: 'prep', view: 'mine', title: 'My work', intro: 'Returns that need you now, as Aisha Rahman (Test). Open one to see where it stands.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-all.html', role: 'prep', view: 'all', title: 'All returns', intro: 'All 300 returns in the firm, on one page. Filter and sort do not reload the page.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-waiting.html', role: 'prep', view: 'waiting', title: 'Waiting on client', intro: 'Returns with a dated waiting flag. The flag is not a state; the return stays in its state.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-due.html', role: 'prep', view: 'due14', title: 'Due in 14 days', intro: 'Filing due within 14 days, not yet filed.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-rework.html', role: 'prep', view: 'rework', title: 'Rework', intro: 'One return came back from the CPA. This is the one-row state of a list.', set: 'prep', navKey: 'queue' });
out('queue-preparer-empty.html', page({ title: 'My work', navKey: 'queue', nav: 'queue', body: `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">My work</h1><p class="govuk-body">Returns that need you now, as Casey Lee (Test). This is the empty state of a list.</p>${views('prep', 'mine')}${empty('prep')}` }));

// no match
out('search-no-match.html', page({ title: 'No match', nav: 'queue', body: `<h1 class="govuk-heading-xl">No return matches that search</h1><p class="govuk-body">Nothing in any queue matches <strong data-echo-q>that text</strong>.</p><ul class="govuk-list govuk-list--bullet"><li>Check the spelling, or try the business number (9 digits).</li><li>Try part of the name, for example "Halton".</li><li>If the return is not in the system yet, ops creates it from the client app on intake.</li></ul><p class="govuk-body"><a class="govuk-link" href="queue-all.html">Browse all returns</a></p>` }));

// ---------- CPA ----------
listPage({ file: 'queue-cpa.html', role: 'cpa', view: 'ready', title: 'Ready to review', intro: 'Returns waiting for the CPA, with tier, flags and days waiting. Open one to go to its review tab.', set: 'cpa', navKey: 'review' });
listPage({ file: 'queue-cpa-rework.html', role: 'cpa', view: 'rework', title: 'Rework', intro: 'Returns sent back. The changed-cell count tells you whether to open it now.', set: 'cpa', navKey: 'review' });
listPage({ file: 'queue-cpa-due.html', role: 'cpa', view: 'due14', title: 'Due in 14 days', intro: 'Ready to review and due within 14 days.', set: 'cpa', navKey: 'review' });
listPage({ file: 'queue-cpa-all.html', role: 'cpa', view: 'all', title: 'All in the review flow', intro: 'Respond, review and rework together.', set: 'cpa', navKey: 'review' });

// ---------- ops ----------
listPage({ file: 'queue-ops.html', role: 'ops', view: 'next', title: 'Next ops step', intro: 'Where ops acts: intake, evidence, gates, filing. Select rows with Space to assign several at once.', set: 'ops', navKey: 'ops' });
listPage({ file: 'queue-ops-waiting.html', role: 'ops', view: 'waiting', title: 'Waiting on client', intro: 'Chase list: dated flag, days waiting and last contact. Open a return to nudge from its history tab.', set: 'chase', navKey: 'ops' });
listPage({ file: 'queue-ops-all.html', role: 'ops', view: 'all', title: 'All returns, ops columns', intro: 'Every return with its next ops step.', set: 'ops', navKey: 'ops' });
// bulk assign error state (no one chosen)
{
  const rows = pick('ops', 'next');
  out('queue-ops-assign-error.html', page({ title: 'Next ops step', error: true, nav: 'ops', body: `<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#assign-to">Choose a person to assign the selected returns to</a></li></ul></div></div></div>
<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">Next ops step</h1>${views('ops', 'next')}
<form class="app-bulkbar" action="queue-ops.html"><span role="status">2 returns selected</span><div class="govuk-form-group govuk-form-group--error govuk-!-margin-bottom-0"><label class="govuk-label" for="assign-to">Assign selected returns to</label><p id="assign-to-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> Choose a person to assign the selected returns to</p><select class="govuk-select govuk-select--error" id="assign-to" name="who" aria-describedby="assign-to-error"><option value="">Choose a person</option><option>${PEOPLE.priti}</option><option>${PEOPLE.ben}</option></select></div><button class="govuk-button govuk-!-margin-bottom-0" type="submit">Assign</button></form>
<p class="govuk-body govuk-hint">The list below keeps its place and its selection after the error.</p>
<div class="app-tablewrap" role="region" aria-label="Returns, scrollable" tabindex="0">${listTable({ id: 'returns', caption: 'Next ops step, sorted by filing due date', set: 'ops', rows: rows.slice(0, 8), select: true, hiddenCaption: true })}</div>` }));
}

// ---------- board (owner) ----------
{
  const c = counts(ALL);
  const strip = `<h2 class="govuk-heading-m">Pipeline by state, in lifecycle order</h2><ol class="app-pipeline" aria-label="Returns per state">${STATES.filter((s) => s[0] !== 'closed').map(([k, l]) => `<li><a href="#state=${k}" data-filter-key="state" data-filter-value="${k}" aria-current="false" class="${c[k] ? '' : 'app-pipeline__zero'}"><span class="app-pipeline__count">${c[k] || 0}</span><span class="app-pipeline__label">${l}</span><span class="app-pipeline__age">${c[k] ? 'oldest ' + oldest(ALL, k) + ' days' : 'none'}</span></a></li>`).join('')}</ol>`;
  const body = `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">Board</h1><p class="govuk-body">Where returns jam. Choose a state to filter the full list below; nothing reloads.</p>${strip}${filterBox()}${tierChips(ALL)}<div class="app-tablewrap" role="region" aria-label="Returns, scrollable" tabindex="0">${listTable({ id: 'returns', caption: 'All 300 returns, sorted by filing due date', set: 'board', rows: ALL, hiddenCaption: true })}</div>${emptyFilter}`;
  out('board.html', page({ title: 'Board', nav: 'board', body }));
}

// ---------- records ----------
for (const r of RETURNS) {
  for (const [tab] of TABS) out(`rec-${r.slug}-${tab}.html`, recordPage(r, tab, 'A'));
  if (r.waiting) out(`rec-${r.slug}-history-nudged.html`, recordPage(r, 'history', 'A', true));
  r.docs.forEach((_, i) => out(`src-${r.slug}-${i + 1}.html`, sourcePage(r, i + 1, 'A')));
}

// ---------- index ----------
out('index.html', page({ title: 'Version A, tabs', nav: '', body: `<h1 class="govuk-heading-xl">Version A: list views and a record with tabs</h1>
<p class="govuk-body">One list screen per role with a view switcher, inline filter and search; a record page with an identity strip and one tab per job. Salesforce list views and record page (Zo's taste), built from MOJ case list, sub navigation, summary card, timeline and identity bar.</p>
<h2 class="govuk-heading-m">Click through the tasks</h2>
<ol class="govuk-list govuk-list--number app-index">
<li><a class="govuk-link" href="queue-preparer.html">Preparer: pick the next return</a>, then open <a class="govuk-link" href="rec-halton-haulage-overview.html">Halton Haulage (blocked, held)</a>; its Overview shows what changed since you left.</li>
<li>Find a return: type "halton" or "7798" in the search box at the top, press Enter. Or <a class="govuk-link" href="search-no-match.html">a search with no match</a>.</li>
<li><a class="govuk-link" href="queue-cpa.html">CPA: ready to review</a>, then <a class="govuk-link" href="queue-cpa-rework.html">rework</a> and <a class="govuk-link" href="rec-eglinton-holdings-overview.html">a returned return with the approval void alert</a>.</li>
<li><a class="govuk-link" href="queue-ops.html">Ops: next ops step</a> with bulk assign (<a class="govuk-link" href="queue-ops-assign-error.html">the error state</a>), then <a class="govuk-link" href="rec-scarborough-robotics-ops.html">the ops tab</a>.</li>
<li><a class="govuk-link" href="queue-ops-waiting.html">Ops: chase waiting on client</a>, then <a class="govuk-link" href="rec-danforth-cleaning-history.html">history with the nudge</a>.</li>
<li><a class="govuk-link" href="board.html">Owner: pipeline strip over the full list (300 rows)</a>.</li>
</ol>
<h2 class="govuk-heading-m">States</h2>
<ul class="govuk-list govuk-list--bullet app-index"><li>Empty list: <a class="govuk-link" href="queue-preparer-empty.html">My work with nothing</a></li><li>One row: <a class="govuk-link" href="queue-rework.html">Rework</a></li><li>300 rows: <a class="govuk-link" href="queue-all.html">All returns</a></li><li>No match: <a class="govuk-link" href="search-no-match.html">search</a>, or type "zzz" in the filter on any list</li><li>Blocked: <a class="govuk-link" href="rec-halton-haulage-overview.html">Halton</a>, <a class="govuk-link" href="rec-eglinton-retail-overview.html">Eglinton Retail</a>, <a class="govuk-link" href="rec-danforth-cleaning-overview.html">Danforth</a></li><li>Flagged, waiting on client: <a class="govuk-link" href="rec-lakeshore-eats-overview.html">Lakeshore Eats</a></li></ul>
<p class="govuk-body"><a class="govuk-link" href="../index.html">All versions</a></p>` }));
console.log('A done');
