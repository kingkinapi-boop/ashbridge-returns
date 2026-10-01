// FROZEN since the second round: drafted version 2 or 3 against the first data model; not run any more (their pages stay as built).
import { shell, H } from './ui.mjs';
import { esc } from './model.mjs';

export const GOVUK_PARTS = [
  ['Skip link, Header (Generic variant with the Ashbridge Tax wordmark), Service navigation', 'Page frame on every page (rule 4). Brand comes only through the settings and the logo; no crown, logotype or GOV.UK colours (RV-55).'],
  ['Tag', 'Tier, flag tier, Reviewed state, queue states. Always words.'],
  ['Summary list', 'The brief (tier, sections), the trace (built from, last year, flags) and the flag detail.'],
  ['Table (with caption and scoped headers)', 'Six numbers, sources, "Agrees with", comments, changes, the return grid.'],
  ['Inset text', 'Empty states (no comments, no returns waiting) and the prototype note on the queue.'],
  ['Warning text', 'A source page that failed to load.'],
  ['Error summary and Error message', 'The comment form when type and severity are missing (rule 9).'],
  ['Radios (small), Textarea, Fieldset, Hint, Label, Button, Checkboxes (small)', 'Comment form, flag decision, send back, "Follow my clicks", "Turn single-key shortcuts off". No radio is preselected.'],
  ['Details', '"Documents in this return" in the source window; "Jump to a state" strip (prototype only).'],
  ['Notification banner', 'Back from rework (important) and comment added (success).'],
  ['Panel (confirmation)', 'Return approved; returned to the preparer.'],
  ['Grid and spacing helpers', 'Brief and form layouts.'],
];
export const MOJ_PARTS = [
  ['Identity bar', 'Corporation, year end, tier, state and Reviewed count, kept quiet, on every return screen (RV-50).'],
  ['Sub navigation', 'The record page tabs (versions 1 and 3: one tab per section; version 2: five tabs).'],
  ['Timeline', 'History tab.'],
  ['Sortable table', 'The review queue (more than five rows, aria-sort, default order stated).'],
  ['Badge', 'Counts on tabs: open flags, comments, Reviewed state.'],
];
export const APP_PARTS = [
  ['app-wordmark', 'Stands in for the Ashbridge Tax logo file in the Generic header. The build uses the logo copy kept in design/basis/.'],
  ['app-wide', 'A wider page container. GOV.UK\'s container is 960px; a return grid with trace and source needs the laptop and the second monitor.'],
  ['app-money', 'Right-aligned tabular figures for money (rule 5). GOV.UK has the numeric cell only for plain tables.'],
  ['app-dot (green, grey, amber, purple)', 'The status dot with a different shape per status and words (EV-11). GOV.UK tags suit statuses on records but not a column of 60 dots next to numbers.'],
  ['app-flagmark', 'The separate red flag marker (EV-12), kept apart from the dot. Outlined box and the word "Flag".'],
  ['app-return and its row classes (app-row--flag, app-row--changed, app-row--sub, app-row--group, is-selected, app-rowbtn, app-change--big)', 'The return as a grid with a selectable row, a left bar for flags and changes (RV-8), subtotals. No GOV.UK or MOJ part selects a table row and keeps a highlight.'],
  ['app-panes, app-pane (title, body, foot), app-pane--short, app-pane--trace, app-pane--source, app-stack', 'Panes for return, trace and source (RV-4). No GOV.UK or MOJ split view exists (searched 28 Sep). Panes stack below 1100px.'],
  ['app-scroll', 'A labelled scrollable region for the pinned flags (MOJ has a scrollable pane in its pattern library, but not as a component).'],
  ['app-source, app-source__hit, app-source__faded, app-source__label, app-caption, app-entry, app-card, app-sheet, app-skeleton', 'The source viewer: a statement page with the figure boxed (thick outline plus the words "Boxed figure"), cards for entries, client answers, captures and computed sums, a sheet grid for spreadsheets (EV-14), a loading skeleton. The build draws these from the prepared page image and PDF.js text layer.'],
  ['app-keys', 'The keyboard shortcut legend (RV-6): keys shown on screen, never required.'],
  ['app-strip, app-progress', 'The Reviewed mark bar and progress count (RV-5). The progress is a native progress element.'],
  ['app-tile, app-tiles, app-brief, app-brief3, app-lines, app-required', 'Brief layout (six number tiles in version 3, three columns of short lists) and the red asterisk on required fields (amber A20).'],
  ['app-monitors, app-monitor, app-monitor__row, app-monitor__box, app-follow', 'The two-monitor layout drawing and the "Follow my clicks" control in the source window.'],
];

const list = (rows) => `<table class="govuk-table"><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Part</th><th scope="col" class="govuk-table__header">Used for, or the reason it is composed</th></tr></thead><tbody class="govuk-table__body">${rows.map(([a, b]) => `<tr><td class="govuk-table__cell">${esc(a)}</td><td class="govuk-table__cell">${esc(b)}</td></tr>`).join('')}</tbody></table>`;

export const WHAT = {
  v1: ['Version 1: one record page with tabs, three panes side by side', 'Tabs in printed order: Brief, Flags, Balance sheet, Income statement, Schedule 1, Other schedules, Comments, History (and Changes when a return comes back). Every section tab holds the return grid, the trace and the source at once. The source can also open in a second window.', 'Strength: everything for a number is in view, no extra clicks. Cost: three panes on a laptop are tight, so the return grid scrolls inside its pane.'],
  v2: ['Version 2: list and detail', 'Five tabs: Brief, Flags, Return, Comments, History. The Return tab is one list of every number in printed order, with four sections each carrying its own Reviewed mark, on the left; the selected number\'s trace and its source (stacked) on the right. One page load for the whole return.', 'Strength: the whole return is one scroll, "next number" crosses section edges, source gets most of the right side. Cost: the four sections share a page, so the separation is by section bars rather than tabs. Zo should say if that is too close to the /internal fault.'],
  v3: ['Version 3: two monitors', 'The same tabs as version 1 but the first monitor shows only the return grid and the trace. The source lives in its own window for the second monitor, follows every click (a Follow checkbox turns that off) and has its own Previous and Next. The layout drawing shows who sits where.', 'Strength: the source gets a whole screen and the grid gets room. Cost: if the window is closed there is no source on the page; the page then says so and offers to open it. Open the source window from any section page (key o), then click numbers: the windows talk through the browser (BroadcastChannel).'],
};

export function notesPage(id) {
  const [title, what, trade] = WHAT[id];
  const main = `<h1 class="govuk-heading-l">${esc(title)}</h1>
<p class="govuk-body">${esc(what)}</p><p class="govuk-body">${esc(trade)}</p>
<h2 class="govuk-heading-m">How to click through</h2>
<ol class="govuk-list govuk-list--number"><li>Open the <a class="govuk-link" href="queue.html">queue</a>, then Maple Ridge (red tier) or Queen West (green tier).</li><li>Read the brief. Start the first section left.</li><li>Pick numbers (click, or <kbd>j</kbd> and <kbd>k</kbd>), step flags (<kbd>f</kbd>), step sources (<kbd>]</kbd> and <kbd>[</kbd>), open the source on a second monitor (<kbd>o</kbd>), mark a section (<kbd>r</kbd>). Approve shows only when every section is marked: use "Queen West, every section marked" from "Prototype: jump to a state".</li><li>The red return also has: a number with no evidence, a loading source, a failed source, the comment form with and without errors, and a return back from rework with one section whose mark came off.</li></ol>
<h2 class="govuk-heading-m">GOV.UK Frontend parts used</h2>${list(GOVUK_PARTS)}
<h2 class="govuk-heading-m">MOJ Frontend parts used</h2>${list(MOJ_PARTS)}
<h2 class="govuk-heading-m">Composed outside GOV.UK and MOJ, with the reason</h2>${list(APP_PARTS)}
<h2 class="govuk-heading-m">Things Zo should know</h2><ul class="govuk-list govuk-list--bullet"><li>Reviewed marks follow the plain end state v1.1 item 6: an explicit mark per section, who and when, coming off with the reason when a number in it changes; Approve is absent (not disabled) until all five are marked, and the page lists what is left as links. Flags count as section 1 ("flags first"); its mark appears once no flag is open.</li><li>The brief says the queue is ordered by tier then due date; rule 6 says "queue: due date first". These designs follow the brief and state the order in the caption.</li><li>Last year's income figures are made up for the test (the sample clients carry only opening balances). Sources come from the answer keys: bank and card lines, adjusting entries, client answers.</li><li>The prototype date is pinned at 10 Mar 2026 so due dates make sense.</li></ul>`;
  return shell({ title: 'Prototype notes', main, nav: 'notes' });
}

export function layoutPage() {
  const main = `<h1 class="govuk-heading-l">Two-monitor layout</h1>
<p class="govuk-body">Monitor 1 (the laptop) holds the return and the trace. Monitor 2 holds the source viewer, which follows every click on monitor 1 in under a second and has its own Previous and Next.</p>
<div class="app-monitors">
<div class="app-monitor app-monitor--1" role="img" aria-label="Monitor 1: identity bar, tabs, Reviewed bar, return grid on the left, trace on the right, source status strip at the bottom"><span class="app-monitor__name">Monitor 1: review window</span>
<div class="app-monitor__box">Identity bar: Maple Ridge Consulting Inc. (Test), year end 31 Dec 2025, Red tier</div>
<div class="app-monitor__box">Tabs: Brief, Flags, Balance sheet, Income statement, Schedule 1, Other schedules, Comments, History</div>
<div class="app-monitor__box">Section 3 of 5: Income statement. Not reviewed. Mark section Reviewed (r). Next section (n)</div>
<div class="app-monitor__row"><div class="app-monitor__box">Return grid: each number, status, this year, last year, change, flags (j, k, f)</div><div class="app-monitor__box">Trace: built from, sources and status, agrees with, last year, notes. Comment (c)</div></div>
<div class="app-monitor__box app-monitor__box--src">Source on monitor 2: Bank statement, Mar 2025, page 3 (source 2 of 4). Open on second monitor (o)</div>
<div class="app-monitor__box">Keyboard shortcuts legend</div></div>
<div class="app-monitor app-monitor--2" role="img" aria-label="Monitor 2: source viewer with follow control, caption, boxed statement page, previous and next"><span class="app-monitor__name">Monitor 2: source window</span>
<div class="app-monitor__box">Follow my clicks in the review window (checked). Previous source ([). Next source (])</div>
<div class="app-monitor__box app-monitor__box--src">Caption: Bank statement, Mar 2025, page 3 (source 2 of 4)<br><br>The statement page, the figure boxed with a thick outline and the label "Boxed figure: $15,820.00"<br><br>A spreadsheet shows sheet, row and column. An entry, client answer or CRA capture shows as a card, never a blank pane.</div>
<div class="app-monitor__box">Documents in this return</div></div>
</div>
<h2 class="govuk-heading-m govuk-!-margin-top-6">States on monitor 2</h2>
<ul class="govuk-list govuk-list--bullet"><li>Loading: a skeleton and the words "Loading source 2 of 4".</li><li>Failed: a warning, and the number stays not Traced.</li><li>No evidence: a card saying "Not checked: no evidence", with a link to comment.</li><li>Window closed: monitor 1 says so and offers to open it.</li></ul>
<p class="govuk-body"><a class="govuk-link" href="red-income-statement.html">Open the red return's income statement</a> and press <kbd>o</kbd>.</p>`;
  return shell({ title: 'Two-monitor layout', main, nav: 'notes' });
}

export function indexPage(versions) {
  const main = `<h1 class="govuk-heading-l">CPA review: design prototypes</h1>
<p class="govuk-body">Three structures for the same job (brief, section walk, source, flags, comments, approve), on made-up sample clients: Maple Ridge (red tier) and Queen West (green tier). Brief: design/briefs/cpa-review.md.</p>
<ul class="govuk-list govuk-list--bullet">
<li><a class="govuk-link" href="v1-record-tabs/queue.html">Version 1: record page with tabs, three panes</a> (<a class="govuk-link" href="v1-record-tabs/notes.html">notes</a>)</li>
<li><a class="govuk-link" href="v2-list-and-detail/queue.html">Version 2: list and detail split</a> (<a class="govuk-link" href="v2-list-and-detail/notes.html">notes</a>)</li>
<li><a class="govuk-link" href="v3-two-monitors/queue.html">Version 3: two monitors, source in a second window</a> (<a class="govuk-link" href="v3-two-monitors/notes.html">notes</a>, <a class="govuk-link" href="v3-two-monitors/layout.html">layout drawing</a>)</li></ul>`;
  return shell({ title: 'CPA review prototypes', main, nav: 'none', asset: './assets/' }).replace(/href="queue\.html"/g, 'href="v1-record-tabs/queue.html"').replace(/href="notes\.html"/g, 'href="v1-record-tabs/notes.html"');
}
