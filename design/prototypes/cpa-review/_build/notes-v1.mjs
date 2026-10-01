// Notes page and index for version 1 (second round). The parts lists are also copied into reports/design-cpa-review.md.
import { frame, BLUEPRINT_COMMIT } from './v1.mjs';
import { esc } from './model.mjs';

export const GOVUK_PARTS = [
  ['Skip link, Header (Generic variant with the Ashbridge Tax wordmark), Service navigation', 'Page frame (rule 4). Brand comes only through the settings and the logo; no crown, logotype or GOV.UK colours (RV-55). The return page drops the service navigation to leave room; the identity bar and a Back to the queue link replace it.'],
  ['Tag', 'Tier, flag tier, Reviewed state, queue states. Always words.'],
  ['Summary list', 'The trace (status, built from, last year, flags) and the flag detail (preparer and CPA kept apart).'],
  ['Table (caption, scoped headers)', 'The return grid, sources, "Agrees with", comments, changes, search results, the approval record.'],
  ['Inset text', 'Empty states and the prototype note on the queue; "Why the mark came off".'],
  ['Warning text', 'A source page that failed to load.'],
  ['Error summary and Error message', 'The comment panel, the flag decision, taking a mark off and send back (rule 9). The summary takes focus.'],
  ['Radios (small), Textarea, Fieldset, Hint, Label, Button (secondary and warning), Input, Select, Checkboxes (small)', 'Comment panel (3 fields), flag decision, reason for taking a mark off, send back, find a number, queue filters, "Follow the review window", "Turn single-key shortcuts off". No radio is preselected.'],
  ['Details', 'The prototype "jump to a state" strip only.'],
  ['Notification banner', 'Send back succeeded.'],
  ['Panel (confirmation)', 'Return approved.'],
];
export const MOJ_PARTS = [
  ['Identity bar (adapted to the wide container)', 'Corporation, year end, tier, state and the Reviewed count, on every return screen (RV-50); Back, previous and next return follow the queue list you came from.'],
  ['Sub navigation', 'The record tabs: Review, Comments, Changes (after rework), History. The same shell for every role (rule 23).'],
  ['Timeline', 'History tab; new marks and decisions are added to it as you work.'],
  ['Sortable table', 'The review queue (more than five rows, aria-sort, default order stated in the caption).'],
  ['Badge', 'Counts on the Comments and Changes tabs.'],
];
export const APP_PARTS = [
  ['app-wordmark', 'Stands in for the Ashbridge Tax logo file in the Generic header. The build uses the logo copy kept in design/basis/ (not yet made: D00).'],
  ['app-wide, app-main, app-main--record, app-footer, app-narrow, app-scroll, app-scroll-x, app-winbody', 'A wider page container (GOV.UK\'s is 960px; the return grid, trace and source need the laptop and a second monitor), a record page that fills the window so each pane scrolls on its own, and labelled scrollable regions.'],
  ['app-money, app-num', 'Right-aligned tabular figures (rule 5). GOV.UK has the numeric cell only for plain tables.'],
  ['app-dot, app-dot--green, app-dot--grey, app-dot--amber, app-dot--purple', 'Status dot with a different shape per status, plus words (EV-11). A tag suits one record, not a column of 60.'],
  ['app-flagmark', 'The red flag chip on a number (EV-12): a link, at least 24 px, with the GOV.UK focus style.'],
  ['app-madeup, app-madeup-note', 'A dashed "Made up" label on the values the sample clients do not carry yet (taxable income, tax, instalments, balance).'],
  ['app-return, app-row--flag, app-row--changed, app-row--sub, app-row--group, app-rowbtn, app-meta, app-change, app-change--big', 'The return as a three-column grid with a selectable row and left bars for flags and changes (RV-8). No GOV.UK or MOJ part selects a table row. Three columns so three panes fit at 1093 px wide.'],
  ['app-review, app-rail, app-rail__list, app-rail__link, app-rail__num, app-rail__title, app-rail__mark, app-rail__mark--on, app-rail__mark--off, app-rail__word, app-rail__progress, app-find, app-find__label, app-find__row, app-find__input', 'The vertical rail of sections (RV-1), each with a Reviewed mark as a shape and words, a progress count, and "Find a number". Neither GOV.UK nor MOJ has a vertical section list with state.'],
  ['app-tabs', 'Tightens the MOJ sub navigation so the record tabs take one slim row.'],
  ['app-toolbar, app-toolbar__body, app-h1, app-sectionof, app-approvehint, app-progresswrap, app-progress, app-unmark, app-offwhy, app-btn-sm', 'The one bar above the work: section name, mark state, "Reviewed, next", Approve (only when every section is Reviewed, RV-10), taking a mark off with a reason. Built from GOV.UK buttons and tags; the bar and the small button size are composed.'],
  ['app-work, app-panes, app-pane, app-pane--list, app-pane--trace, app-pane--source, app-pane__title, app-pane__sub, app-pane__body, app-pane__foot', 'The three panes of RV-4: the return, the trace, the source at full height. No GOV.UK or MOJ split view exists (searched 28 Sep). They stay side by side at 1093 px and 1366 px and stack only on a narrow screen.'],
  ['app-commentpanel, app-decide, app-sendback', 'The in-place comment panel, the flag decision and the send-back form: ordinary GOV.UK form parts in a bordered box so they sit inside the trace pane and the Comments tab.'],
  ['app-brief, app-brief3, app-tiles, app-tile, app-tile__value, app-tile__small, app-h2, app-ref, app-lines, app-left, app-inline-list, app-strip, app-required', 'The brief: six numbers as tiles (RV-2), three short lists, the sections still to mark as links (RV-10), and the red asterisk on required fields (amber A20).'],
  ['app-source, app-source__hit, app-source__faded, app-source__label, app-caption, app-card, app-sheet, app-hit, app-entry, app-skeleton', 'The source viewer: a statement page with the figure boxed (thick outline plus the words "Boxed figure"), cards for entries, client answers, captures and results, a sheet grid for spreadsheets (EV-14), a loading skeleton. The build draws these from the prepared page image and PDF.js text layer. The same viewer fills the second window.'],
  ['app-printed, app-printed__table, app-page, app-pagebtns', 'Printed-return pages for schedules not drawn as structured views (RV-9).'],
  ['app-keys, app-keys__summary, app-keys__pop, app-keys__list', 'The keyboard shortcut list, opened in place from the toolbar (RV-6, rule 10).'],
  ['app-qfilter, app-idlinks', 'Queue filter row and the Back, previous, next links in the identity bar.'],
];

const list = (rows) => `<table class="govuk-table"><caption class="govuk-table__caption govuk-visually-hidden">Parts</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Part</th><th scope="col" class="govuk-table__header">Used for, or the reason it is composed</th></tr></thead><tbody class="govuk-table__body">${rows.map(([a, b]) => `<tr><td class="govuk-table__cell">${esc(a)}</td><td class="govuk-table__cell">${esc(b)}</td></tr>`).join('')}</tbody></table>`;

export function notesPage() {
  const main = `<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper app-main" id="main-content" role="main">
<h1 class="govuk-heading-l">Prototype notes: the CPA review, record tabs (second round)</h1>
<p class="govuk-body">One return record page. The record tabs are Review, Comments, Changes (after rework) and History. Under Review a vertical rail holds the brief, the flags (first, EX-4 order) and the ten sections of RV-1 in their fixed order. Section and tab changes are client-side (the address after the # changes, no page load). The return, the trace and the source sit side by side; the source can also open in a second window, on demand, which follows every number and every tab change. Written against blueprint commit ${BLUEPRINT_COMMIT}.</p>
<h2 class="govuk-heading-m">How to click through</h2>
<ol class="govuk-list govuk-list--number"><li>Open the <a class="govuk-link" href="queue.html">queue</a>. Filter or search it, then open Maple Ridge (red tier) or Queen West (green tier). <a class="govuk-link" href="queue-later.html">Later the same day</a> Maple Ridge is back from rework.</li><li>Read the brief: six numbers, the tier and why, the first flags. Start review.</li><li>Flags first: pick a flag, see its own cited evidence in the source pane, record a decision in place. Then <strong>Reviewed, next</strong> (key r) walks the sections. A number opens its source with a click or Enter; j and k step on across sections.</li><li>Comment on a number (c): a panel opens in the trace pane, three fields, no page load. The Comments tab and the number's trace both list it.</li><li>Open the second window (o). Pick numbers and change section: the window follows. Its own Previous and Next move the main window too.</li><li>Approve shows only when all 11 marks are on: use <a class="govuk-link" href="green-ready.html">Queen West, every section marked</a>. Approve opens the approval record with the time on each section and the sources opened (RV-11).</li></ol>
<h2 class="govuk-heading-m">GOV.UK Frontend parts used</h2>${list(GOVUK_PARTS)}
<h2 class="govuk-heading-m">MOJ Frontend parts used</h2>${list(MOJ_PARTS)}
<h2 class="govuk-heading-m">Composed outside GOV.UK and MOJ, with the reason</h2>${list(APP_PARTS)}
<h2 class="govuk-heading-m">Things Zo should know</h2><ul class="govuk-list govuk-list--bullet"><li>Reviewed marks follow RV-5: only "Reviewed, next" marks; the key r never takes a mark off. Taking a mark off is a separate button that asks for a reason. The mark comes off by itself, with the reason shown, when a number in the section changes.</li><li>Flags are section 1 of 11 for marks (flags first, RV-1). A flag shows what the preparer did ("Answered by preparer" or "Left for you") apart from what you did ("Accepted by CPA", "Sent back to the preparer"). Sending a flag back adds a comment, so the counts agree.</li><li>Taxable income, federal tax, Ontario tax, instalments and the balance are made-up values, labelled "Made up", because the sample clients do not carry RV-2's six lines yet. Last year's figures are made up too.</li><li>Printed-return pages (RV-9) stand in for schedules not drawn as structured views: Capital (when no CCA), Losses and reserves, Ontario, Disclosures.</li><li>Queue order shown is the one recommended to Zo (overdue first, then tier, then due date); it is Zo's pick (design question 4).</li><li>Single keys: j, k, f, [, ], o, c, n, r, a and Esc. They do nothing in a text field and can be turned off. The key a only moves focus to Approve.</li><li>The prototype date is pinned at 10 Mar 2026. Only the red and green returns open; the other four queue rows show the list only.</li></ul>
</main></div>`;
  return frame({ title: 'Prototype notes', main, nav: 'notes' });
}

export function indexPage() {
  const main = `<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper app-main" id="main-content" role="main">
<h1 class="govuk-heading-l">CPA review: design prototype</h1>
<p class="govuk-body">One structure, kept after the usability panel and the findings review: the return record page with tabs, a vertical rail of sections, the source beside the work, and a second window opened on demand. Made-up sample clients: Maple Ridge (red tier) and Queen West (green tier). Brief: design/briefs/cpa-review.md, written from blueprint commit ${BLUEPRINT_COMMIT}.</p>
<ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="v1-record-tabs/queue.html">Start at the review queue</a> (<a class="govuk-link" href="v1-record-tabs/notes.html">notes and parts</a>)</li></ul>
<p class="govuk-body-s">Two earlier drafts (version 2, list and detail; version 3, two monitors) stay in their folders for the record and are not part of the sitting.</p>
</main></div>`;
  return frame({ title: 'CPA review prototype', main, nav: 'none', bare: true }).replace(/href="\.\.\/assets\//g, 'href="assets/').replace(/href="queue\.html"/g, 'href="v1-record-tabs/queue.html"');
}
