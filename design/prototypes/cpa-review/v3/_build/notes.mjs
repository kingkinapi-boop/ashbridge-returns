// Notes page and sitting index for version 3 (round 3). The parts lists are also copied into reports/design-cpa-review-3.md.
import { frame, wrapMain, BLUEPRINT_COMMIT } from './ui.mjs';
import { esc } from './model.mjs';
import { statesList } from './record.mjs';

export const GOVUK_PARTS = [
  ['Skip link, Header (Generic variant with the Ashbridge Tax wordmark), Service navigation', 'Page frame (rule 4). Brand comes only through the settings and the logo; no crown, logotype or GOV.UK colours (RV-55). The record page drops the service navigation to leave room; the identity bar and a Back to the queue link replace it.'],
  ['Tag', 'Tier, flag tier, Reviewed state, queue states, "AI draft", attestation Met and Not met, overdue. Always words.'],
  ['Summary list', 'The trace (status, built from, last year, flags), the flag detail (preparer and CPA kept apart) and the fix-round digest.'],
  ['Table (caption, scoped headers)', 'The return grid, pinned flags, ten largest changes, sources, "Agrees with", comments, changes, search results, the approval record and the judgments.'],
  ['Inset text', 'Empty states, "No prior year to compare", the prototype note on the queue, "Why the mark came off".'],
  ['Warning text', 'A source page that failed to load.'],
  ['Error summary and Error message', 'The comment panel, the judgment form, taking a mark off, send back and the queue that could not load (rule 9). The summary takes focus.'],
  ['Radios (small), Textarea, Fieldset, Hint, Label, Button (secondary and warning), Input, Select, Checkboxes (small)', 'Comment panel (3 fields), judgment reason, reason for taking a mark off, send back, find a number, queue filters, "Open in a second window", "Follow the review window", "Turn single-key shortcuts off". No radio is preselected.'],
  ['Details', 'Why this tier, and the prototype "jump to a state" strip.'],
  ['Notification banner', 'Send back succeeded.'],
  ['Panel (confirmation variant)', 'Return approved.'],
];
export const MOJ_PARTS = [
  ['Identity bar (adapted to the wide container)', 'Corporation, year end, tier, state and the Reviewed count, on every return screen (RV-50); Back, previous and next return follow the queue list you came from.'],
  ['Sub navigation', 'The record tabs (Review, Comments, Changes after rework or void, History: the same shell for every role, rule 23) and the queue views (All, Back from rework).'],
  ['Timeline', 'History tab; new marks, judgments and decisions are added to it as you work.'],
  ['Sortable table', 'The review queue and the two lists of flags (the pinned flags on the brief and the Flags list): each has more than five rows, aria-sort, and a default order stated in its caption (queue: overdue, tier, due date; flags: red first, then dollar effect, EX-4). Next flag and previous flag follow the list as sorted. The return sections are never sortable (RV-1).'],
  ['Badge', 'Counts on the Comments and Changes tabs and on the queue views.'],
  ['Alert (warning)', 'Approval void, at the top of the brief of a voided return.'],
];
// parts this prototype uses that design/basis/parts.md does not list (the Lead's A485 ruling: name each one)
export const LACKING = [
  ['GOV.UK Textarea', 'The comment text, the reason for accepting a risk, the reason for taking a mark off, send back. parts.md lists text input, not textarea.'],
  ['GOV.UK Select', 'The tier filter in the queue and the Section select that replaces the rail under 1200 px.'],
  ['GOV.UK Checkboxes (small)', 'Open in a second window, Follow the review window, Turn single-key shortcuts off.'],
  ['GOV.UK Label and Hint', 'A label on every field and a hint where a stranger could misread it (rule 16). parts.md lists neither by name.'],
  ['GOV.UK Panel (confirmation variant)', 'Return approved. parts.md lists the interruption panel only.'],
  ['MOJ Sub navigation', 'Record tabs and queue views. parts.md lists Side navigation, not Sub navigation.'],
  ['MOJ Badge', 'Counts on tabs and views. Not listed in parts.md.'],
];
export const EXPERIMENTAL = [
  ['MOJ Confirm an action', 'Not used. Approve is one click here (budget: 1 load, 1 click). The sitting decides whether Approve gets a confirm step (choice 1 on the index).'],
  ['MOJ Contextual date', 'Not used. The filing and balance-due dates are plain text with the words "Filing overdue" and "date has passed"; the experimental part has no plain-text fallback we can rely on yet.'],
];
export const APP_PARTS = [
  ['app-wordmark', 'Stands in for the Ashbridge Tax logo file in the Generic header (design/basis/ashbridge-tax-logo.png is a tall square image that does not fit a slim header; the final header fit is the shell designer\'s, D13).'],
  ['app-header-person, app-header-link', 'Who is signed in, with Sign out, on the right of the header row so the identity bar and the tabs gain no height. GOV.UK Header has no signed-in person; its service navigation row would cost a line.'],
  ['app-wide, app-main, app-main--record, app-main--queue, app-footer, app-narrow, app-narrow--wide, app-scroll, app-scroll-x, app-winbody', 'A wider page container (GOV.UK\'s is 960px; the return grid, trace and source need the laptop and a second monitor), a record page that fills the window so each pane scrolls on its own, and labelled scrollable regions.'],
  ['app-money, app-num', 'Right-aligned tabular figures (rule 5). GOV.UK has the numeric cell only for plain tables.'],
  ['app-dot, app-dot--green, app-dot--grey, app-dot--amber, app-dot--purple', 'Status dot with a different shape per status, plus words (EV-11). A tag suits one record, not a column of 60.'],
  ['app-flagmark', 'The red flag chip on a number (EV-12): a link, at least 24 px, with the GOV.UK focus style.'],
  ['app-madeup, app-madeup-note', 'A dashed "Made up" label on the values the sample clients do not carry yet (taxable income, tax, instalments, balance).'],
  ['app-state', 'The state of a brief number in words, under the figure: "Not confirmed in Taxprep yet" (CP7). A tag would crowd a six-column tile row.'],
  ['app-return, app-row--flag, app-row--changed, app-row--hl, app-row--sub, app-row--group, app-rowbtn, app-meta, app-change, app-change--big', 'The return as a grid with a selectable row and left bars for flags and changes (RV-8). No GOV.UK or MOJ part selects a table row. Three columns so three panes fit at 1093 px. app-row--hl is the quiet dotted bar on a number worth a look for its tier; its reason is always in words (dot, tag) in the row.'],
  ['app-review, app-rail, app-rail__list, app-rail__link, app-rail__num, app-rail__title, app-rail__mark, app-rail__mark--on, app-rail__mark--off, app-rail__word, app-find, app-find__label, app-find__input, app-tabsrow, app-tools, app-pick, app-pick__select', 'The vertical rail of sections (RV-1), each with a Reviewed mark as a shape and words, and "Find a number" beside the record tabs. Neither GOV.UK nor MOJ has a vertical section list with state (design/basis calls it app-coverage-tracker). Under 1200 px wide the rail gives way to a Section select in the same row, so the three panes keep their width at 125% zoom.'],
  ['app-tabs', 'Tightens the MOJ sub navigation so the record tabs take one slim row.'],
  ['app-qviews', 'The MOJ sub navigation used as the queue views (All, Back from rework), kept slim.'],
  ['app-toolbar, app-toolbar__body, app-h1, app-sectionof, app-approvehint, app-unmark, app-offwhy, app-btn-sm, app-readonly', 'The one bar above the work: section name, mark state, "Reviewed, next", Approve (only when every section is Reviewed and every accepted risk is judged, RV-10), taking a mark off with a reason, and the words that tell the assigned preparer the screen is read-only. Built from GOV.UK buttons and tags; the bar and the small button size are composed.'],
  ['app-work, app-panes, app-pane, app-pane--list, app-pane--trace, app-pane--source, app-pane__title, app-pane__sub, app-pane__body, app-pane__foot', 'The three panes of RV-4: the return, the trace, the source at full height. No GOV.UK or MOJ split view exists (searched 28 Sep). They stay side by side at 1093 px and 1366 px and stack only on a narrow screen.'],
  ['app-winpref', 'The second-window checkbox beside the Open source button: a GOV.UK small checkbox laid out in the pane foot with its state in words.'],
  ['app-judge, app-judged', 'Your judgment on an accepted risk (CP2, A421): a small bordered form (reason, Accept, Comment instead) and, once judged, the read-out of what you decided and why. GOV.UK form parts inside a box so they sit in the trace pane.'],
  ['app-cpanel, app-cp, app-cp__head, app-cp__body, app-cp__foot, app-cp__note', 'The in-place comment panel: one box laid over the trace and source panes so the 3 fields and Add comment are in view with no scrolling inside, even at 1093 px. Header keeps the boxed figure caption; only the body scrolls (an error summary), the buttons stay pinned. Ordinary GOV.UK radios, textarea and button inside; no GOV.UK or MOJ part lays a form over a split view.'],
  ['app-sendback', 'The send-back form in a bordered box on the Comments tab.'],
  ['app-brief, app-brief2, app-tiles, app-tile, app-tile__value, app-tile__small, app-h2, app-ref, app-lines, app-inline-list, app-inline-list--col, app-strip, app-strip__row, app-required, app-inset-tight, app-why, app-att, app-changes', 'The brief: six numbers as tiles (RV-2), the tier line with its short reason, the pinned flags, and just below them the ten largest changes since last year and the attestations (CP6, V02), the sections still to mark as links (RV-10), and the red asterisk on required fields (amber A20). app-strip holds the tier and the dates in two rows; app-changes and app-att only tighten a GOV.UK table and a list; app-inline-list--col stacks the Approve links.'],
  ['app-btngroup, app-btngroup__label', 'A visible caption beside a pair of buttons under the list ("Flags: Previous, Next" and "Numbers: Previous, Next"), so the buttons can be short and the foot keeps one row at 1093 px. The spoken names are still "Previous flag" and so on.'],
  ['app-approve', 'The Approve view: what remains as links (sections, forms not placed, accepted risks not judged) and, when nothing remains, the Approve button.'],
  ['app-drafts, app-draftlist, app-draft, app-draft__head, app-digest', 'The AI fix drafts as read-only cards with an "AI draft" tag and no approve control (CP14, RV-12), and the fix-round digest (CP16). Built from a GOV.UK list, tag and summary list inside a bordered card.'],
  ['app-alert', 'Spacing around the MOJ alert so the void alert sits above the brief without pushing the six numbers off the first screen.'],
  ['app-source, app-source__hit, app-source__faded, app-source__label, app-caption, app-card, app-sheet, app-hit, app-entry, app-skeleton', 'The source viewer: a statement page with the figure boxed (thick outline plus the words "Boxed figure"), cards for entries, client answers, captures and results, a sheet grid for spreadsheets (EV-14), a loading skeleton. The build draws these from the prepared page image and PDF.js text layer. The same viewer fills the second window.'],
  ['app-sources', 'The sources in the trace as a short list of buttons with their status: a three-column table does not fit a 240 px pane at 16 px text.'],
  ['app-printed, app-printed__table, app-page, app-pagebtns', 'Printed-return pages for schedules not drawn as structured views (RV-9).'],
  ['app-keys, app-keys--page, app-keys__summary, app-keys__pop, app-keys__list', 'The keyboard shortcut list, opened in place from the toolbar (RV-6, rule 10). design/basis calls it app-shortcuts.'],
  ['app-qfilter, app-qrow, app-qcount, app-queue-head, app-idlinks, app-quiet, app-why-text, app-nowrap', 'Queue filter row with its count on the same line, the row that holds the queue views and the key list, the Back, previous and next links in the identity bar, the quiet second line in a queue cell (why the tier, how long ago), and a no-wrap span so a date stays on one line and the first row is whole on the first screen.'],
];

let listNo = 0;
const list = (rows, head = 'Used for, or the reason it is composed') => `<div class="app-scroll-x" role="region" aria-label="Parts, table ${++listNo}" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-visually-hidden">Parts</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Part</th><th scope="col" class="govuk-table__header">${head}</th></tr></thead><tbody class="govuk-table__body">${rows.map(([a, b]) => `<tr><td class="govuk-table__cell">${esc(a)}</td><td class="govuk-table__cell">${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;

export const CHOICES = [
  ['Approve in one click, or with a confirm step', 'Drawn: Approve return is one button and one click (budget: 1 load, 1 click), and it appears only when every section is Reviewed and every accepted risk is judged. Alternative: the experimental MOJ Confirm an action step ("Are you sure?") before the approval record. It adds a click to the commonest end of every return and protects against a slip; the slip is already hard because Approve is absent until everything is done and the key a only moves focus to it. Recommendation: one click.'],
  ['Do open comments stop Approve?', 'Drawn: no. RV-10 names three things that stop it (a section not Reviewed, a form not placed, an accepted risk not judged). The Approve view lists open comments as a note, because approving with must-fix comments not yet sent is odd. Alternative: add them as a fourth thing that stops it. Recommendation: keep the note, ask the preparer, decide after the first month of use.'],
];

export function notesPage() {
  const main = wrapMain(`
<h1 class="govuk-heading-l">Prototype notes: the CPA review, record tabs (version 3, round 3)</h1>
<p class="govuk-body">One record page per return. The record tabs are Review, Comments, Changes (after rework or when an approval is void) and History. Under Review a vertical rail holds the brief, the flags (first, EX-4 order), the ten sections of RV-1 in their fixed order and Approve. Section and tab changes are client-side (the address after the # changes, no page load). The return, the trace and the source sit side by side; the source can also open in a second window, on request, which follows every number and every tab change and is remembered for the person who is signed in. Written against blueprint commit ${BLUEPRINT_COMMIT}.</p>
<h2 class="govuk-heading-m">How to click through</h2>
<ol class="govuk-list govuk-list--number">
<li><strong>Pick the next return (task 1).</strong> Open the <a class="govuk-link" href="queue.html">queue</a>. Overdue first (Bluewater), then red, amber, green, then filing due date. Switch to <a class="govuk-link" href="queue.html#/rework">Back from rework</a> (none yet), search, filter by tier. <a class="govuk-link" href="queue-later.html">Later the same day</a> Maple Ridge is back from rework. Also <a class="govuk-link" href="queue-empty.html">nothing waiting</a> and <a class="govuk-link" href="queue-error.html">the queue could not load</a>.</li>
<li><strong>Read the brief (task 2).</strong> Six numbers against last year, the tier and why, the pinned flags. Just below: the ten largest changes since last year, and the three attestations. <a class="govuk-link" href="green.html#/brief">Queen West</a> (green), <a class="govuk-link" href="red.html#/brief">Maple Ridge</a> (red), <a class="govuk-link" href="bluewater.html#/brief">Bluewater</a> (filing overdue), <a class="govuk-link" href="scarborough.html#/brief">Scarborough Robotics</a> (first year, no prior year, five accepted risks).</li>
<li><strong>Judge the flags (task 3).</strong> Press <kbd>n</kbd> for the next flag. An accepted risk shows a short form in the trace pane: type your reason and Accept, or Comment instead. Your judgment sits apart from what the preparer did, and is part of the approval record.</li>
<li><strong>Walk the return (task 4).</strong> The rail lists the sections in their fixed order. <kbd>r</kbd> is Reviewed, next. <a class="govuk-link" href="red.html#/capital">Capital</a> shows the printed return pages; <a class="govuk-link" href="green.html#/disclosures">Disclosures in Queen West</a> is a section with nothing in it; <a class="govuk-link" href="scarborough.html#/forms-not-placed">Forms not yet placed</a> needs a mark of its own.</li>
<li><strong>Check one number (task 5).</strong> Click a number or press Enter: the source opens beside it with the figure boxed. <kbd>]</kbd> and <kbd>[</kbd> step through the sources, <kbd>m</kbd> goes to the next number. Try <a class="govuk-link" href="red.html#/statements/n-6170">a number with no evidence</a> and the <a class="govuk-link" href="red.html#/statements/n-6155/failed">source that failed to load</a>.</li>
<li><strong>Comment (task 6).</strong> <kbd>c</kbd> opens the panel over the trace and source: type, severity, text. A real empty submit shows the errors; so does <a class="govuk-link" href="red.html#/statements/n-6090/comment-error">this link</a>.</li>
<li><strong>Approve (task 7).</strong> <a class="govuk-link" href="red-gate.html#/approve">Every section is marked but two accepted risks are not judged</a>: Approve is absent and the two risks are links. <a class="govuk-link" href="red-ready.html#/approve">Everything done</a>: Approve shows. It opens the <a class="govuk-link" href="approved-red.html">approval record</a>, which keeps your judgments.</li>
<li><strong>Re-review after rework (task 8).</strong> <a class="govuk-link" href="red-rework.html#/brief">Maple Ridge back from rework</a>: the digest on the brief, <a class="govuk-link" href="red-rework.html#/changes">only the changed numbers</a>, the marks that came off and why, and <a class="govuk-link" href="red-rework.html#/comments">comments with the preparer's answers and the AI fix drafts</a>. Resolve a comment in place.</li>
<li><strong>Second window (task 9).</strong> Tick Open in a second window under the source. The window follows. Sign out closes it. The choice is remembered for the signed-in person.</li>
<li><strong>Voided approval (task 10).</strong> <a class="govuk-link" href="green-void.html#/brief">Queen West, approval void</a>, and <a class="govuk-link" href="green-void.html#/changes">why, and what changed</a>. The return is with the preparer, so the screen is read-only for you until it is sent back: it says so in words and offers no mark, comment or Approve control.</li>
<li><strong>The assigned preparer</strong> sees the <a class="govuk-link" href="red-preparer.html#/brief">same record read-only</a>.</li>
</ol>
<h2 class="govuk-heading-m">All the states</h2>
<ul class="govuk-list">${statesList()}</ul>
<h2 class="govuk-heading-m">GOV.UK Frontend parts used</h2>${list(GOVUK_PARTS)}
<h2 class="govuk-heading-m">MOJ Frontend parts used</h2>${list(MOJ_PARTS)}
<h2 class="govuk-heading-m">Parts used that design/basis/parts.md does not list</h2>${list(LACKING, 'Used for')}
<h2 class="govuk-heading-m">Experimental MOJ parts not used</h2>${list(EXPERIMENTAL, 'Why not used')}
<h2 class="govuk-heading-m">Composed outside GOV.UK and MOJ, with the reason</h2>${list(APP_PARTS)}
<h2 class="govuk-heading-m">Things Zo should know</h2>
<ul class="govuk-list govuk-list--bullet">
<li>Judgment is separate from the mark. A mark says you have looked at a section; a judgment says you accept an accepted risk, with your reason, or that you commented instead. Approve needs every mark and every judgment (RV-10), and the approval record keeps both (RV-11).</li>
<li>Reviewed marks follow RV-5: only "Reviewed, next" marks; the key <kbd>r</kbd> never takes a mark off. Taking a mark off is a separate button that asks for a reason. The mark comes off by itself, with the reason shown, when a number in the section changes.</li>
<li>Flags are section 1 of 11 for marks (12 when a form is not placed). A flag shows what the preparer did (fixed, explained, accepted risk) apart from what you did.</li>
<li>Keys come from the one list of D01: <kbd>n</kbd> next flag, <kbd>p</kbd> previous flag, <kbd>m</kbd> next number, <kbd>o</kbd> open the number's source, <kbd>r</kbd> reviewed and next, <kbd>a</kbd> move to Approve, <kbd>c</kbd> comment, <kbd>s</kbd> search, <kbd>]</kbd> and <kbd>[</kbd> source steps. They do nothing in a text field and can be turned off. The key <kbd>a</kbd> only moves focus to Approve or to what is left. "Mark and step" has no key.</li>
<li>Second window: off until you tick the box; remembered for the person signed in, in this browser; it opens when you tick the box, press <kbd>o</kbd> or open a source with the box ticked, never by itself; it closes when you sign out. A pop-up blocker can stop it: the words next to the box then say so.</li>
<li>Taxable income, federal tax, Ontario tax, instalments and the balance are made-up values, labelled "Made up", because the sample clients do not carry RV-2's six lines yet. Last year's figures are made up too. A number Taxprep has not confirmed shows "Not confirmed in Taxprep yet" under the figure.</li>
<li>The "Supports" tick on a figure is not drawn: a stored tick would change the approval record (RV-11).</li>
<li>Printed-return pages (RV-9) stand in for schedules not drawn as structured views: Capital (when no CCA), Losses and reserves, Ontario, Disclosures.</li>
<li>Queue order shown is Zo's pick (Z20-4): overdue first, then tier, then filing due date, then the one waiting longest.</li>
<li>The prototype date is pinned at 10 Mar 2026. Four returns open (Bluewater, Maple Ridge, Scarborough Robotics, Queen West); the other six queue rows show the list only. Secondary text is #4c5b6b, a little darker than the basis grey #627283, so it passes contrast on the grey panes.</li>
</ul>`);
  return frame({ title: 'Prototype notes', main, nav: 'notes' });
}

export function indexPage() {
  const main = wrapMain(`
<h1 class="govuk-heading-l">CPA review: design prototype, version 3</h1>
<p class="govuk-body">One structure, kept after the usability panel and the findings review: the return record page with tabs, a vertical rail of sections, the source beside the work, and a second window on request that is remembered for the person signed in. Made-up sample clients: Maple Ridge (red tier), Queen West (green tier), Bluewater (red tier, filing date passed) and Scarborough Robotics Labs (red tier, first year, many accepted risks). Brief: design/briefs/cpa-review.md, written from blueprint commit ${BLUEPRINT_COMMIT}.</p>
<ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="queue.html">Start at the review queue</a> (task 1)</li><li><a class="govuk-link" href="notes.html">Notes, parts and how to click through</a></li></ul>
<h2 class="govuk-heading-m">Two real choices for the sitting</h2>
<ol class="govuk-list govuk-list--number">${CHOICES.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ol>
<h2 class="govuk-heading-m">Experimental parts, not used</h2>
<p class="govuk-body">The sitting accepts or refuses these before any screen uses them.</p>
${list(EXPERIMENTAL, 'Why not used')}
<h2 class="govuk-heading-m">Every state</h2>
<ul class="govuk-list">${statesList()}</ul>`);
  return frame({ title: 'CPA review prototype, version 3', main, nav: 'none', bare: true, person: null });
}
