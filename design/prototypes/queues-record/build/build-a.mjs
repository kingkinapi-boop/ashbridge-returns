// Version A (the one kept): Salesforce-style list views per role plus one record page with tabs.
// Fix round 2 (reports/findings-designs.md, section (a) Queues-record): n/p and the open key from B, the state strip from C.
// Run: node build/build-a.mjs   (writes ../a-tabs/*.html; B and C folders are kept as they were and no longer built)
import { STATES, stateInfo, RETURNS, PEOPLE, TIER } from './data.mjs';
import { ALL, esc, fmt, write, page, filterBox, emptyFilter, counts, oldest, diffDays, recHref, band, isDone, flagged } from './lib.mjs';
import { listTable, pick, stateChips, tierChips, bandChips, VIEWS, views, DEFAULT, LANDING } from './lists.mjs';
import { recordPage } from './record.mjs';

const DIR = 'a-tabs';
const out = (f, h) => write(DIR, f, h);
const ASSIGNEES = [PEOPLE.aisha, PEOPLE.ben];

const empty = () => `<div class="govuk-inset-text"><h2 class="govuk-heading-m">Nothing is waiting on you</h2><p class="govuk-body">Every return you hold is with someone else or finished. Choose where to look next.</p><ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="queue-all.html">All returns</a>, to take one that nobody holds</li><li><a class="govuk-link" href="queue-waiting.html">Waiting on client</a>, to see what is stuck outside the firm</li></ul></div>`;

const bulkParts = (rows) => `<div class="govuk-error-summary" data-module="govuk-error-summary" data-bulk-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#assign-to">Choose a preparer to assign the selected returns to</a></li></ul></div></div></div>
<p class="govuk-body" data-bulk-result tabindex="-1" role="status" hidden></p>`;
const bulkBar = () => `<form class="app-bulkbar" data-bulkbar hidden aria-label="Assign the selected returns"><span data-sel-count role="status"></span><div class="govuk-form-group govuk-!-margin-bottom-0" data-bulk-group><label class="govuk-label" for="assign-to">Assign selected returns to</label><p class="govuk-error-message" id="assign-to-error" hidden><span class="govuk-visually-hidden">Error:</span> Choose a preparer to assign the selected returns to</p><select class="govuk-select" id="assign-to" name="who"><option value="">Choose a preparer</option>${ASSIGNEES.map((p) => `<option>${p}</option>`).join('')}</select></div><button class="govuk-button govuk-!-margin-bottom-0" type="submit" data-module="govuk-button" data-prevent-double-click="true">Assign</button></form>`;

function listPage({ file, role, view, title, intro, set, navKey, bulk }) {
  const rows = pick(role, view);
  const land = LANDING[role];
  const note = `Default order: ${DEFAULT[set][1]}. A row opens on its ${land === 'workbench' ? 'Workbench' : land === 'review' ? 'Review' : land === 'ops' ? 'Ops' : 'Overview'} tab.`;
  const hrefFn = (r) => recHref(r, land);
  const table = `<div class="app-tablewrap" role="region" aria-label="${esc(title)}, returns table, scrollable" tabindex="0" data-list="${esc(title)}" data-land="${land}">${listTable({ id: 'returns', caption: `${title}, ${rows.length} returns, ${DEFAULT[set][1]}`, set, rows, hrefFn, select: !!bulk, hiddenCaption: true })}</div>`;
  const body = `<h1 class="govuk-heading-l govuk-!-margin-bottom-1">${title}</h1>
<p class="govuk-body-s govuk-!-margin-bottom-2">${intro}</p>
${views(role, view)}
${rows.length ? `${filterBox('', note)}${role === 'prep' || role === 'cpa' ? tierChips(rows) : stateChips(rows)}${bulk ? bulkParts(rows) : ''}${table}${bulk ? bulkBar() : ''}${emptyFilter}` : empty()}`;
  out(file, page({ title, body, nav: navKey, self: file, shortcuts: [['j and k', 'Move to the next or previous row'], ['o', 'Open the row you are on'], ...(bulk ? [['Space', 'Select the focused row (rows not flagged for a person)']] : [])] }));
}

// ---------- preparer ----------
listPage({ file: 'queue-preparer.html', role: 'prep', view: 'mine', title: 'My work', intro: 'Returns that need you now, as Aisha Rahman (Test). Open one to land on its Workbench.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-all.html', role: 'prep', view: 'all', title: 'All returns', intro: `All ${ALL.length} returns in the firm, on one page. Filter and sort do not reload the page.`, set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-waiting.html', role: 'prep', view: 'waiting', title: 'Waiting on client', intro: 'Returns with a dated waiting flag. The flag is not a state; the return stays in its state.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-due.html', role: 'prep', view: 'due14', title: 'Due in 14 days or overdue', intro: 'Filing due within 14 days or already late, not yet filed.', set: 'prep', navKey: 'queue' });
listPage({ file: 'queue-rework.html', role: 'prep', view: 'rework', title: 'Rework', intro: 'One return came back from the CPA. This is the one-row state of a list.', set: 'prep', navKey: 'queue' });
out('queue-preparer-empty.html', page({ title: 'My work', nav: 'queue', self: 'queue-preparer-empty.html', body: `<h1 class="govuk-heading-l govuk-!-margin-bottom-1">My work</h1><p class="govuk-body-s govuk-!-margin-bottom-2">Returns that need you now, as Casey Lee (Test). This is the empty state of a list.</p>${views('prep', 'mine', { mine: 0 })}${empty()}` }));

// ---------- CPA ----------
listPage({ file: 'queue-cpa.html', role: 'cpa', view: 'ready', title: 'Ready to review', intro: 'Returns waiting for the CPA, with tier, flags and days in this state. Open one to land on its Review tab.', set: 'cpa', navKey: 'review' });
listPage({ file: 'queue-cpa-rework.html', role: 'cpa', view: 'rework', title: 'Rework', intro: 'Returns sent back. The changed-cell count tells you whether to open it now.', set: 'cpa', navKey: 'review' });
listPage({ file: 'queue-cpa-due.html', role: 'cpa', view: 'due14', title: 'Due in 14 days or overdue', intro: 'Ready to review and due within 14 days or already late.', set: 'cpa', navKey: 'review' });
listPage({ file: 'queue-cpa-all.html', role: 'cpa', view: 'all', title: 'All in the review flow', intro: 'Respond, review and rework together.', set: 'cpa', navKey: 'review' });

// ---------- ops ----------
listPage({ file: 'queue-ops.html', role: 'ops', view: 'next', title: 'Next ops step', intro: 'Where ops acts. Space selects rows to assign together; rows flagged for a person are assigned from the return.', set: 'ops', navKey: 'ops', bulk: true });
listPage({ file: 'queue-ops-filed.html', role: 'ops', view: 'filed', title: 'Filed, waiting for assessment', intro: 'Filed returns until the notice of assessment is saved and compared.', set: 'ops', navKey: 'ops' });
listPage({ file: 'queue-ops-waiting.html', role: 'ops', view: 'waiting', title: 'Waiting on client', intro: 'Chase list: dated flag, days waiting and last contact. Open a return to nudge from its History tab.', set: 'chase', navKey: 'ops' });
listPage({ file: 'queue-ops-all.html', role: 'ops', view: 'all', title: 'All returns, ops columns', intro: 'Every return with its next ops step, filed ones included.', set: 'ops', navKey: 'ops', bulk: true });

// ---------- board (owner): state strip on top, due-week bands (RV-40), filtered list kept in view ----------
{
  const c = counts(ALL);
  const strip = `<h2 class="govuk-heading-s govuk-!-margin-bottom-2">Pipeline by state, in lifecycle order</h2><ol class="app-pipeline" aria-label="Returns per state">${STATES.filter((s) => s[0] !== 'closed').map(([k, l]) => `<li><button type="button" class="app-pipe${c[k] ? '' : ' app-pipe--zero'}" aria-pressed="false" data-filter-key="state" data-filter-value="${k}" data-scroll-list><span class="app-pipe__count">${c[k] || 0}</span><span class="app-pipe__label">${l}</span><span class="app-pipe__age">${c[k] ? 'oldest ' + oldest(ALL, k) + ' days' : 'none'}</span></button></li>`).join('')}</ol>`;
  const body = `<h1 class="govuk-heading-l govuk-!-margin-bottom-1">Board</h1><p class="govuk-body-s govuk-!-margin-bottom-2">Where returns jam. Choose a state or a filing week; the full list below narrows and scrolls into view. Nothing reloads.</p>${strip}${filterBox('', 'Default order: ' + DEFAULT.board[1] + '. A row opens on its Overview tab.')}${tierChips(ALL)}${bandChips(ALL)}<h2 class="govuk-heading-s govuk-!-margin-bottom-1" id="list-top" tabindex="-1">Returns</h2><div class="app-tablewrap" role="region" aria-label="All returns table, scrollable" tabindex="0" data-list="Board" data-land="overview">${listTable({ id: 'returns', caption: `All ${ALL.length} returns, ${DEFAULT.board[1]}`, set: 'board', rows: ALL, hrefFn: (r) => recHref(r, 'overview'), hiddenCaption: true })}</div>${emptyFilter}`;
  out('board.html', page({ title: 'Board', nav: 'board', body, self: 'board.html', shortcuts: [['j and k', 'Move to the next or previous row'], ['o', 'Open the row you are on']] }));
}

// ---------- search results (rule 21): one match opens the return; more show this list ----------
{
  const rows = ALL.map((r) => [r.name, r.bn, fmt(r.ye), r.state, r.tier, r.slug, PEOPLE[r.prep] || '', fmt(r.filing)]);
  const meta = { states: Object.fromEntries(STATES.map(([k, l, c]) => [k, [l, c]])), tiers: TIER };
  const ctx = `<script>window.APP_ALL=${JSON.stringify(rows)};window.APP_META=${JSON.stringify(meta)};</script>`;
  out('search.html', page({ title: 'Search results', nav: 'queue', self: 'search.html', ctx, body: `<h1 class="govuk-heading-xl" data-search-h1>Search results</h1><p class="govuk-body" role="status" data-search-summary>Type a name, business number or year end in the search box above.</p>
<div data-search-none hidden><ul class="govuk-list govuk-list--bullet"><li>Check the spelling, or try the business number (nine digits).</li><li>Try part of the name, for example "Halton".</li><li>If the return is not in the system yet, ops creates it from the client app on intake.</li></ul><p class="govuk-body"><a class="govuk-link" href="queue-all.html">Browse all returns</a></p></div>
<div class="app-tablewrap" role="region" aria-label="Search results table, scrollable" tabindex="0" data-search-table hidden></div>` }));
}

// ---------- the source, for the second window (the stand-in for the shared viewer, D03) ----------
out('source.html', page({ title: 'Source document', nav: 'queue', self: 'source.html', bodyClass: 'app-sourcepage', body: `<h1 class="govuk-heading-l" data-source-h1>Source document</h1><p class="govuk-body" data-source-meta>Open a document from a return's Documents tab, then choose "Send to second window".</p><div data-viewer-body></div>` }));

// ---------- records: one page each, tabs are client-side routes ----------
for (const r of ALL) out(`rec-${r.slug}.html`, recordPage(r));

// ---------- index ----------
out('index.html', page({ title: 'Version A, tabs', nav: '', self: 'index.html', body: `<h1 class="govuk-heading-xl">Version A: list views and a record with tabs</h1>
<p class="govuk-body">One list screen per role with a view switcher, inline filter and search; one return record with an identity bar and one tab per job, the same for every role. Pinned date: Monday 8 Jun 2026. Made-up data only.</p>
<h2 class="govuk-heading-m">Click through the tasks</h2>
<ol class="govuk-list govuk-list--number app-index">
<li><a class="govuk-link" href="queue-preparer.html">Preparer: pick the next return</a>. Press <kbd>j</kbd> then <kbd>o</kbd>, or click the name: Halton Haulage opens on its Workbench with "Since you last opened" first; <kbd>n</kbd> and <kbd>p</kbd> follow the list, "Back to the list" keeps your filter, sort and scroll.</li>
<li>Find a return: type "halton" in the search box and press Enter (one match opens it); type "eglinton" (<a class="govuk-link" href="search.html?q=eglinton">two matches, a results list</a>); <a class="govuk-link" href="search.html?q=zzz">no match</a>.</li>
<li><a class="govuk-link" href="queue-cpa.html">CPA: ready to review</a> (tier order, opens on Review), then <a class="govuk-link" href="queue-cpa-rework.html">rework</a> and <a class="govuk-link" href="rec-eglinton-holdings.html#overview">a returned return with the approval void alert</a>.</li>
<li><a class="govuk-link" href="queue-ops.html">Ops: next ops step</a>. Tick two rows and press Assign with nobody chosen (the error, in place), then choose a preparer (result announced, focus on the next row). Then the Ops tab: <a class="govuk-link" href="rec-scarborough-robotics.html#ops">upload the check export, then enter the confirmation number</a>, or <a class="govuk-link" href="rec-riverdale-rentals.html#ops">send T183CORP</a>.</li>
<li><a class="govuk-link" href="queue-ops-waiting.html">Ops: chase waiting on client</a>, then <a class="govuk-link" href="rec-danforth-cleaning.html#history">History, send the nudge</a> (banner in place). Filed returns: <a class="govuk-link" href="queue-ops-filed.html">Filed, waiting for assessment</a>, then <a class="govuk-link" href="rec-queen-west-design.html#ops">save the notice of assessment</a>.</li>
<li><a class="govuk-link" href="board.html">Owner: the state strip and due weeks over the full list</a> (${ALL.length} rows).</li>
<li>Read a source: <a class="govuk-link" href="rec-halton-haulage.html#documents">Halton, Documents</a>, choose a document (beside the list), then "Send to second window".</li>
</ol>
<h2 class="govuk-heading-m">States</h2>
<ul class="govuk-list govuk-list--bullet app-index"><li>Empty list: <a class="govuk-link" href="queue-preparer-empty.html">My work with nothing</a></li><li>One row: <a class="govuk-link" href="queue-rework.html">Rework</a></li><li>${ALL.length} rows: <a class="govuk-link" href="queue-all.html">All returns</a></li><li>No match: <a class="govuk-link" href="search.html?q=zzz">search</a>, or type "zzz" in the filter on any list</li><li>Blocked: <a class="govuk-link" href="rec-halton-haulage.html#overview">Halton</a>, <a class="govuk-link" href="rec-eglinton-retail.html#overview">Eglinton Retail</a>, <a class="govuk-link" href="rec-danforth-cleaning.html#overview">Danforth</a></li><li>Flagged, waiting on client: <a class="govuk-link" href="rec-lakeshore-eats.html#history">Lakeshore Eats</a></li><li>Approval void: <a class="govuk-link" href="rec-eglinton-holdings.html#overview">Eglinton Holdings</a></li></ul>
<p class="govuk-body"><a class="govuk-link" href="../index.html">Back to the family index</a></p>` }));
console.log('A done', ALL.length, 'returns');
