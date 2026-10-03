// Version C: pipeline first and two monitors. The owner's pipeline is the front door; every state has its own list
// screen; each role's work list is grouped by state in lifecycle order; the record shows its place in the
// lifecycle and opens every document in a second window (the source window) that follows the clicks.
import { STATES, RETURNS, PEOPLE, stateInfo } from './data.mjs';
import { ALL, esc, fmt, write, page, counts, oldest, recHref, stateTag, diffDays, filterBox } from './lib.mjs';
import { listTable, pick, PREP_STATES, OPS_STATES } from './lists.mjs';
import { TABS, recordPage, sourcePage, NAVC } from './record.mjs';

const DIR = 'c-pipeline';
const out = (f, h) => write(DIR, f, h);
const P = (o) => page({ navLinks: NAVC, ...o });
const c = counts(ALL);
const live = STATES.filter((s) => s[0] !== 'closed');

const strip = (active) => `<ol class="app-pipeline" aria-label="Returns per state, in lifecycle order">${live.map(([k, l]) => `<li><a href="state-${k}.html" class="${c[k] ? '' : 'app-pipeline__zero'}"${active === k ? ' aria-current="true"' : ''}><span class="app-pipeline__count">${c[k] || 0}</span><span class="app-pipeline__label">${l}</span><span class="app-pipeline__age">${c[k] ? 'oldest ' + oldest(ALL, k) + ' days' : 'none'}</span></a></li>`).join('')}</ol>`;

out('pipeline.html', P({ title: 'Pipeline', nav: 'pipeline', body: `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">Pipeline</h1><p class="govuk-body">Every return by state in lifecycle order, with the age of the oldest. Choose a state to see its returns; the number says where work jams.</p>${strip()}
<h2 class="govuk-heading-m">Two monitors</h2><p class="govuk-body">Open the <a class="govuk-link" href="source-window.html" target="ashbridge-source">source window</a> and drag it to the second monitor. Every document you open from any return then shows in that window; the first monitor keeps the return.</p>
<h2 class="govuk-heading-m">Find</h2><p class="govuk-body">Use the search box above: name, business number or year end.</p>` }));

// state pages
live.forEach(([k, l], i) => {
  const rows = ALL.filter((r) => r.state === k);
  const prev = live[i - 1], next = live[i + 1];
  const body = `<p class="govuk-body"><a class="govuk-link" href="pipeline.html">Back to the pipeline</a></p><h1 class="govuk-heading-xl govuk-!-margin-bottom-2">${l}: ${rows.length} returns</h1>
<p class="govuk-body">Acted on by ${esc(stateInfo[k].who)}. Sorted by filing due date.</p>${strip(k)}
${rows.length ? `${filterBox()}<div class="app-tablewrap" role="region" aria-label="Returns, scrollable" tabindex="0">${listTable({ id: 'returns', caption: `${l}, ${rows.length} returns, sorted by filing due date`, set: 'board', rows, hiddenCaption: true })}</div>` : `<div class="govuk-inset-text"><h2 class="govuk-heading-m">No returns in ${l}</h2><p class="govuk-body">Nothing is waiting in this state. ${next ? `Next state: <a class="govuk-link" href="state-${next[0]}.html">${next[1]}</a>.` : ''}</p></div>`}
<p class="govuk-body">${prev ? `<a class="govuk-link" href="state-${prev[0]}.html">Earlier state: ${prev[1]}</a>` : ''}${prev && next ? ' | ' : ''}${next ? `<a class="govuk-link" href="state-${next[0]}.html">Later state: ${next[1]}</a>` : ''}</p>`;
  out(`state-${k}.html`, P({ title: l, nav: 'pipeline', body }));
});

// role work lists, grouped by state in lifecycle order
function grouped(file, role, title, intro, rows, set, states, nav) {
  const sections = states.map((k) => {
    const rs = rows.filter((r) => r.state === k);
    if (!rs.length) return '';
    return `<div class="app-group-head"><h2 class="govuk-heading-m govuk-!-margin-bottom-1">${stateInfo[k].label}</h2><span class="govuk-body">${rs.length} returns</span></div><div class="app-tablewrap" role="region" aria-label="${stateInfo[k].label}, scrollable" tabindex="0">${listTable({ id: 't-' + k, caption: `${stateInfo[k].label}, ${rs.length} returns, sorted by filing due date`, set, rows: rs, hiddenCaption: true })}</div>`;
  }).join('');
  out(file, P({ title, nav, body: `<h1 class="govuk-heading-xl govuk-!-margin-bottom-2">${title}</h1><p class="govuk-body">${intro}</p>${sections || '<div class="govuk-inset-text"><h2 class="govuk-heading-m">Nothing is waiting on you</h2><p class="govuk-body"><a class="govuk-link" href="pipeline.html">See the pipeline</a> to take work that nobody holds.</p></div>'}` }));
}
const mine = pick('prep', 'mine');
grouped('my-work.html', 'prep', 'My work', 'As Aisha Rahman (Test). Your returns, grouped by state in lifecycle order; each group is sorted by filing due date.', mine, 'prep', ['gaps', 'prepare', 'trace', 'respond', 'rework'], 'queue');
grouped('my-work-empty.html', 'prep', 'My work', 'As Casey Lee (Test). The empty state.', [], 'prep', [], 'queue');
grouped('my-work-one-row.html', 'prep', 'My work', 'As Aisha Rahman (Test), rework only (the one-row state).', mine.filter((r) => r.state === 'rework'), 'prep', ['rework'], 'queue');
grouped('cpa-work.html', 'cpa', 'CPA review', 'Ready to review first, then rework. Tier, flags or changed cells, and days waiting sit on each row.', ALL.filter((r) => ['review', 'rework'].includes(r.state)), 'cpa', ['review', 'rework'], 'review');
grouped('ops-work.html', 'ops', 'Ops', 'Intake to filing, one group per ops state. Open a return to its ops tab for the step.', ALL.filter((r) => OPS_STATES.includes(r.state)), 'ops', OPS_STATES, 'ops');

// source window
out('source-window.html', P({ title: 'Source window', nav: '', body: `<div data-source-follow></div><h1 class="govuk-heading-l">Source window</h1><div class="govuk-inset-text">No document is open yet. Open a document from the Documents tab of any return in your main window; it appears here and stays here for the next one.</div><p class="govuk-body"><a class="govuk-link" href="pipeline.html" target="_self">Back to the pipeline in this window</a></p>` }));

// ops error state: confirmation number
const form = (err) => `<h1 class="govuk-heading-xl">Enter the confirmation number</h1><p class="govuk-body">Scarborough Robotics Labs Inc. (Test), year end 31 Dec 2025. Gate 2 passed and the return was transmitted on 4 Jun 2026.</p>
<form action="confirm-number-error.html" data-confirm><div class="govuk-form-group${err ? ' govuk-form-group--error' : ''}"><label class="govuk-label govuk-label--m" for="conf">Confirmation number <span class="govuk-hint govuk-!-display-inline">(required)</span></label><div id="conf-hint" class="govuk-hint">From the CRA transmission receipt, for example 8 characters of letters and numbers.</div>${err ? '<p id="conf-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> Enter the confirmation number from the transmission receipt</p>' : ''}<input class="govuk-input govuk-input--width-10${err ? ' govuk-input--error' : ''}" id="conf" name="conf" type="text" aria-describedby="conf-hint${err ? ' conf-error' : ''}" spellcheck="false"></div><button class="govuk-button" type="submit">Save and mark as filed</button></form><p class="govuk-body"><a class="govuk-link" href="rec-scarborough-robotics-ops.html">Back to the ops tab</a></p>`;
out('confirm-number.html', P({ title: 'Enter the confirmation number', nav: 'ops', body: form(false) }));
out('confirm-number-error.html', P({ title: 'Enter the confirmation number', nav: 'ops', error: true, body: `<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#conf">Enter the confirmation number from the transmission receipt</a></li></ul></div></div></div>${form(true)}` }));

out('search-no-match.html', P({ title: 'No match', nav: '', body: `<h1 class="govuk-heading-xl">No return matches that search</h1><p class="govuk-body">Nothing matches <strong data-echo-q>that text</strong>.</p><ul class="govuk-list govuk-list--bullet"><li>Check the spelling, or try the business number (9 digits).</li><li>Try part of the name.</li></ul><p class="govuk-body"><a class="govuk-link" href="pipeline.html">See the pipeline</a></p>` }));

for (const r of RETURNS) {
  for (const [tab] of TABS) out(`rec-${r.slug}-${tab}.html`, recordPage(r, tab, 'C'));
  if (r.waiting) out(`rec-${r.slug}-history-nudged.html`, recordPage(r, 'history', 'C', true));
  r.docs.forEach((_, i) => out(`src-${r.slug}-${i + 1}.html`, sourcePage(r, i + 1, 'C')));
}

out('index.html', P({ title: 'Version C, pipeline first', nav: '', body: `<h1 class="govuk-heading-xl">Version C: pipeline first, two monitors</h1>
<p class="govuk-body">The front door is the owner's pipeline by state. Each role's work list is grouped by state in lifecycle order. The record shows where the return sits in the lifecycle, and its documents open in a second window on the second monitor that follows every click. Weaker for the preparer's daily pick (the brief says so) but the strongest for "where does it jam" and for source work.</p>
<ol class="govuk-list govuk-list--number app-index">
<li><a class="govuk-link" href="pipeline.html">Owner: pipeline</a>, then <a class="govuk-link" href="state-review.html">Review</a> or an empty state such as <a class="govuk-link" href="state-intake.html">Intake</a>.</li>
<li><a class="govuk-link" href="my-work.html">Preparer: My work grouped by state</a>; <a class="govuk-link" href="rec-halton-haulage-overview.html">Halton</a> (blocked, since you left), <a class="govuk-link" href="my-work-empty.html">empty</a>, <a class="govuk-link" href="my-work-one-row.html">one row</a>.</li>
<li>Find: type "eglinton" in the search box, Enter; <a class="govuk-link" href="search-no-match.html">no match</a>.</li>
<li><a class="govuk-link" href="cpa-work.html">CPA review</a>, <a class="govuk-link" href="rec-eglinton-holdings-overview.html">rework with approval void</a>.</li>
<li><a class="govuk-link" href="ops-work.html">Ops</a>, <a class="govuk-link" href="rec-scarborough-robotics-ops.html">ops tab</a>, <a class="govuk-link" href="confirm-number.html">enter a number</a> (<a class="govuk-link" href="confirm-number-error.html">error</a>), <a class="govuk-link" href="rec-danforth-cleaning-history.html">chase with the nudge</a>.</li>
<li>Second window: open <a class="govuk-link" href="source-window.html" target="ashbridge-source">the source window</a>, then click a document in <a class="govuk-link" href="rec-halton-haulage-documents.html">Halton's Documents tab</a>.</li></ol>
<p class="govuk-body"><a class="govuk-link" href="../index.html">All versions</a></p>` }));
console.log('C done');
