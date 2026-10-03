// The record page (one per scenario) and the second window. Section and tab changes are client-side routes (hash URLs, 0 page loads).
// Only govuk-, moj- and app- classes. No inline style, no zoom.
import { esc, money, SECTIONS, sectionsOf, getReturn, viewOf, marksAfter, risksOf, commentsFor } from './model.mjs';
import { H, val, frame, wrapMain, footNote, jsonSafe, keysPanel, miniBar, alertWarning } from './ui.mjs';
import { rowsFor, printedPanel, emptyPanel, unplacedPanel, flagsPanel, traceBody, flagTrace, sourceHost } from './parts.mjs';
import { briefPanel, approvePanel, commentsView, historyView, changesView, draftsHtml, digestOf, datesOf, sectionsHolding } from './brief.mjs';

export const PERSON = 'Zo (Test)';
export const SCRIPT_PATH = '<script src="static/review-v3.js"></script>';

// every state a person can be shown, grouped; the same list is on the sitting index, the notes page and the foot of each record page
export const STATE_GROUPS = [
  ['The queue (task 1)', [
    ['queue.html', 'Ten returns, overdue first, then tier, then filing due date (many, flagged)'],
    ['queue.html#/rework', 'The Back from rework view'],
    ['queue-later.html', 'Later the same day: Maple Ridge is back from rework'],
    ['queue-empty.html', 'Nothing waiting (empty)'],
    ['queue-error.html', 'The queue could not be loaded (error)'],
  ]],
  ['Read the brief and judge the flags (tasks 2 and 3)', [
    ['green.html#/brief', 'Queen West, green tier (normal)'],
    ['red.html#/brief', 'Maple Ridge, red tier, four accepted risks (flagged)'],
    ['bluewater.html#/brief', 'Bluewater, red tier, filing date passed (overdue)'],
    ['scarborough.html#/brief', 'Scarborough Robotics, first year, five accepted risks, no prior year (many)'],
    ['red.html#/flags/01-F04', 'A flag to judge, with its cited evidence'],
    ['red.html#/flags/01-F04/error', 'Judgment form with an error (nothing typed)'],
  ]],
  ['Walk the return and check a number (tasks 4 and 5)', [
    ['red.html#/statements/n-6090', 'A number: trace, source with the figure boxed'],
    ['red.html#/statements/n-6170', 'A number with no evidence (CK-2)'],
    ['red.html#/statements/n-6155/loading', 'Source loading'],
    ['red.html#/statements/n-6155/failed', 'Source failed to load'],
    ['red.html#/capital', 'A schedule shown as the printed return pages (RV-9)'],
    ['green.html#/disclosures', 'A section with nothing in this return (empty)'],
    ['scarborough.html#/forms-not-placed', 'Forms not yet placed'],
  ]],
  ['Comment and approve (tasks 6 and 7)', [
    ['red.html#/statements/n-6090/comment-error', 'Comment panel with errors (nothing chosen)'],
    ['red.html#/comments', 'Comments: four drafts'],
    ['red.html#/comments/send/error', 'Send back with an error'],
    ['green.html#/comments', 'Comments: none yet (empty)'],
    ['red-gate.html#/approve', 'Every section marked, two accepted risks not judged: Approve is absent, what remains is listed'],
    ['red-ready.html#/approve', 'Everything done: Approve shows'],
    ['green-ready.html#/approve', 'Queen West, no accepted risks: Approve shows'],
    ['approved-red.html', 'The approval record, Maple Ridge'],
    ['approved-green.html', 'The approval record, Queen West'],
  ]],
  ['After rework, void, preparer (tasks 8 to 10)', [
    ['red-rework.html#/brief', 'Maple Ridge back from rework: the digest on the brief'],
    ['red-rework.html#/changes', 'Changes: before and after, marks that came off'],
    ['red-rework.html#/comments', 'Comments with the preparer\'s answers and the AI fix drafts'],
    ['green-void.html#/brief', 'Approval void (Queen West)'],
    ['green-void.html#/changes', 'Why it is void and what changed'],
    ['red-preparer.html#/brief', 'The assigned preparer\'s read-only view'],
  ]],
];
// the entry that is the page being shown (a file with no route) is words, not a link to itself
const stateItem = (h, t, own) => (own && h === own ? `<span aria-current="page">${esc(t)} (this page)</span>` : `<a class="govuk-link" href="${h}">${esc(t)}</a>`);
const statesList = (own = '') => STATE_GROUPS.map(([g, items]) => `<li><strong>${esc(g)}</strong><ul class="govuk-list govuk-list--bullet">${items.map(([h, t]) => `<li>${stateItem(h, t, own)}</li>`).join('')}</ul></li>`).join('');
export const statesStrip = (own = '') => `<details class="govuk-details govuk-!-margin-top-2 govuk-!-margin-bottom-2"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Prototype: jump to a state</span></summary><div class="govuk-details__text"><ul class="govuk-list">${statesList(own)}</ul><p class="govuk-body-s"><a class="govuk-link" href="index.html">The sitting index</a> and <a class="govuk-link" href="notes.html">prototype notes</a>.</p></div></details>`;
export { statesList };

const kindOf = (R, s) => (s.key === 'flags' ? 'flags' : s.key === 'unplaced' ? 'forms' : R.ordered[s.key].length ? 'rows' : R.printed[s.key] ? 'printed' : 'empty');

// why a mark came off, in the words of the numbers that changed
function offReasons(R0, R, scn, view) {
  const out = {};
  if (scn.kind === 'rework') {
    const rw = view.rw;
    out.stmt = `${R.byId[rw.to].label} changed from ${money(view.before[rw.to])} to ${money(R.byId[rw.to].cy)} and ${R.byId[rw.from].label} from ${money(view.before[rw.from])} to ${money(R.byId[rw.from].cy)}, by ${rw.who}, ${rw.when} (answering C-2). Re-mark it when you have looked at the changed numbers.`;
  }
  if (scn.kind === 'void') {
    const vd = R0.cfg.void;
    for (const k of sectionsHolding(R, view)) {
      const ids = view.changed.filter((id) => R.byId[id].section === k).sort((a, b) => ((R.byId[a].kind === 'sub' || R.byId[a].derived) ? 1 : 0) - ((R.byId[b].kind === 'sub' || R.byId[b].derived) ? 1 : 0));
      const shown = ids.slice(0, 2).map((id) => `${R.byId[id].label} from ${money(view.before[id])} to ${money(R.byId[id].cy)}`);
      out[k] = `A number in this section changed after you approved: ${shown.join(' and ')}${ids.length > 2 ? ' and ' + (ids.length - 2) + ' more' : ''}. Books entry ${vd.entry} by ${vd.by}, ${vd.when}. Re-mark the section when you have looked at the changed numbers.`;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the record page
export function recordPage(scn) {
  const view = viewOf(scn);
  const R0 = view.R0, R = view.ret;
  const mode = scn.mode;
  const hold = scn.kind === 'void'; // the approval is void: the return is with the preparer, so the CPA reads and waits (task 10)
  const canAct = mode !== 'preparer' && !hold;
  const readWhy = mode === 'preparer' ? 'Read-only: you can read everything the CPA sees, not mark, judge, comment or approve.' : hold ? 'Waiting for the preparer: the approval is void and the return is with the preparer. Marking, commenting and approving come back when it is sent back.' : '';
  const risks = risksOf(R);
  const secs = sectionsOf(R);
  const marksNow = marksAfter(scn, view);
  const comments = commentsFor(R0, scn);
  const digest = digestOf(R0, scn, view);
  const d = datesOf(R);
  const held = sectionsHolding(R, view);
  const ctx = { scn, R0, R, view, mode, canAct, canJudge: canAct && risks.length > 0, canComment: canAct, before: view.before, changedTag: scn.kind === 'void' ? 'Changed after approval' : 'Changed by preparer', digest, marksNow };
  if (scn.kind === 'void') {
    const vd = R0.cfg.void;
    ctx.alert = alertWarning('Approval void', `<p class="govuk-body">The books changed after you approved on ${esc(vd.approved)}: entry ${esc(vd.entry)} by ${esc(vd.by)}, ${esc(vd.when)}. ${held.length} section marks came off. <a class="govuk-link" href="#/changes">Why it is void, and what changed</a></p>`);
  }
  ctx.drafts = draftsHtml(R0, scn);

  const sections = secs.map((s) => { const kind = kindOf(R, s); return { key: s.key, slug: s.slug, title: s.title, ref: s.ref, type: kind, rows: kind === 'flags' ? R.flags.map((f) => f.id) : kind === 'rows' ? R.ordered[s.key].map((l) => l.id) : [] }; });
  const marks = Object.fromEntries(secs.map((s) => [s.key, marksNow[s.key] ? (marksNow[s.key] === 'off' ? 'off' : { by: marksNow[s.key][0], when: marksNow[s.key][1] }) : null]));
  const data = {
    scn: scn.slug, which: scn.which, kind: scn.kind, mode, canAct, readWhy, corp: R.corp, ye: R.ye, person: PERSON, preparer: R0.cfg.preparer, now: scn.now,
    sections, marks, offReason: offReasons(R0, R, scn, view), comments: comments.map((c) => ({ id: c.id, line: c.line, type: c.type, severity: c.severity, when: c.when, text: c.text, status: c.status, reply: c.reply || '', resolved: !!c.resolved, canResolve: !c.resolved && scn.cs === 'rework' && ['Fixed by the preparer', 'Answered'].includes(R0.cfg.rework.replies[c.id].state), who: c.who, flag: c.flag || '' })),
    flags: R.flags.map((f) => ({ id: f.id, title: f.title, tier: f.tier, kind: f.kind })), judg: scn.judg || {}, unplaced: R.unplaced.map((u) => u.form),
    approveHref: `approved-${scn.which}.html`, srcFile: `source-${scn.which}.html`,
    index: [...R.lines.filter((l) => l.kind !== 'sub').map((l) => ({ id: l.id, label: l.label, acct: String(l.acct || ''), sec: l.section, val: val(l, l.cy) })), ...R.flags.map((f) => ({ id: f.id, label: f.id + ' ' + f.title, sec: 'flags', val: f.effect === null ? 'Not stated' : money(f.effect) }))],
    lines: Object.fromEntries(R.lines.map((l) => [l.id, { label: l.label, val: val(l, l.cy), section: l.section }])),
    changed: view.changed.length, hasDigest: !!digest,
  };

  const stateTags = [];
  if (mode === 'preparer') stateTags.push(H.tag('Read-only: preparer', 'grey'));
  else if (scn.kind === 'void') stateTags.push(H.tag('Approval void', 'red'));
  else if (scn.kind === 'rework') stateTags.push(H.tag('Back from rework', 'purple'));
  else if (scn.kind === 'gate' || scn.kind === 'ready') stateTags.push(H.tag('Second review', 'blue'));
  else stateTags.push(H.tag('In review', 'blue'));
  if (d.overdue) stateTags.push(H.tag('Filing overdue', 'red'));

  const idBar = `<div class="moj-identity-bar" data-identity-bar role="region" aria-label="This return"><div class="govuk-width-container app-wide"><div class="moj-identity-bar__container"><div class="moj-identity-bar__details"><h2 class="moj-identity-bar__title">${esc(R.corp)}</h2><p>Year end ${esc(R.ye)} ${H.tier(R.cfg.tier)} ${stateTags.join(' ')} <strong class="govuk-tag govuk-tag--grey" data-count-tag data-count="reviewed" data-scope="sections Reviewed"><span data-count-reviewed></span> of ${secs.length} sections Reviewed</strong></p><p class="app-idlinks"><a class="govuk-link" href="queue.html" data-queue-back>Back to the queue</a> <a class="govuk-link" href="queue.html" data-queue-prev hidden>Previous return</a> <a class="govuk-link" href="queue.html" data-queue-next hidden>Next return</a></p></div></div></div></div>`;
  const findForm = `<form class="app-find" role="search" data-find><label class="govuk-label app-find__label" for="find-q">Find a number</label><input class="govuk-input app-find__input" id="find-q" name="q" type="search" autocomplete="off" aria-describedby="find-hint" aria-keyshortcuts="s"><button type="submit" class="govuk-button govuk-button--secondary app-btn-sm">Find</button><span id="find-hint" class="govuk-visually-hidden">Searches every section and every flag, by name or account number</span></form>`;
  const pickSection = `<nav class="app-pick" aria-label="Jump to a section"><label class="govuk-label app-find__label" for="sec-pick">Section</label><select class="govuk-select app-pick__select" id="sec-pick" data-section-pick></select></nav>`;
  const changesTab = view.changed.length ? `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/changes" data-tab="changes" data-count="changes" data-scope="Changes">Changes <span class="moj-badge moj-badge--purple">${view.changed.length}<span class="govuk-visually-hidden"> changed numbers</span></span></a></li>` : '';
  const tabs = `<div class="govuk-width-container app-wide app-tabsrow"><nav class="moj-sub-navigation app-tabs" aria-label="Return record"><ul class="moj-sub-navigation__list"><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/brief" data-tab="review">Review</a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/comments" data-tab="comments" data-count="comments" data-scope="Comments">Comments <span class="moj-badge moj-badge--blue" data-comment-count>${comments.length}</span></a></li>${changesTab}<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/history" data-tab="history">History</a></li></ul></nav><div class="app-tools">${pickSection}${findForm}</div></div>`;
  const approveRail = canAct ? `<li><a class="app-rail__link" href="#/approve" data-rail="approve"><span class="app-rail__num" aria-hidden="true">${secs.length + 1}</span><span class="app-rail__title">Approve</span><span class="app-rail__mark" data-rail-mark="approve"></span></a></li>` : '';
  const rail = `<nav class="app-rail" aria-label="Return sections"><ol class="app-rail__list"><li><a class="app-rail__link" href="#/brief" data-rail="brief"><span class="app-rail__num" aria-hidden="true">0</span><span class="app-rail__title">Brief</span></a></li>${secs.map((s, i) => `<li><a class="app-rail__link" href="#/${s.slug}" data-rail="${s.key}"><span class="app-rail__num" aria-hidden="true">${i + 1}</span><span class="app-rail__title">${esc(s.key === 'unplaced' ? 'Forms not placed' : s.title)}</span><span class="app-rail__mark" data-rail-mark="${s.key}"></span></a></li>`).join('')}${approveRail}</ol></nav>`;
  const panels = secs.map((s) => {
    const k = kindOf(R, s);
    const inner = k === 'flags' ? flagsPanel(R, ctx) : k === 'forms' ? unplacedPanel(R, s) : k === 'rows' ? `<p class="app-ref">${esc(s.ref)}</p>` + rowsFor(R, s, R.ordered[s.key], ctx) : k === 'printed' ? printedPanel(R, s) : emptyPanel(R, s);
    return `<div data-panel="${s.key}" hidden>${inner}</div>`;
  }).join('');
  const traces = R.lines.map((l) => traceBody(R, l, ctx)).join('') + R.flags.map((f) => flagTrace(R, f, ctx)).join('');
  const commentBtn = canAct ? '<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-primary data-comment-open aria-keyshortcuts="c">Comment on this number</button>' : `<span class="app-readonly">${esc(hold ? 'Waiting for the preparer: comments come back when the return is sent back.' : 'Read-only: you can see the comments the CPA has sent, not write them.')}</span>`;
  const reviewView = `<div class="app-review" data-view="review">${rail}<div class="app-work" data-work>
<div class="app-panes" data-panes>
<div class="app-pane app-pane--list"><h2 class="app-pane__title" id="pl" data-list-title>Return</h2><div class="app-pane__body" data-list-body tabindex="0" role="region" aria-labelledby="pl">${briefPanel(R, scn, ctx)}${panels}${canAct ? approvePanel() : ''}<div data-panel="find" hidden><div data-find-results></div></div></div><div class="app-pane__foot" data-list-foot><div class="app-btngroup" role="group" aria-label="Flags"><span class="app-btngroup__label" aria-hidden="true">Flags</span><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-flag-prev aria-keyshortcuts="p">Previous<span class="govuk-visually-hidden"> flag</span></button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-flag-next aria-keyshortcuts="n">Next<span class="govuk-visually-hidden"> flag</span></button></div><div class="app-btngroup" role="group" aria-label="Numbers"><span class="app-btngroup__label" aria-hidden="true">Numbers</span><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-prev>Previous<span class="govuk-visually-hidden"> number</span></button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-next aria-keyshortcuts="m">Next<span class="govuk-visually-hidden"> number</span></button></div></div></div>
<div class="app-pane app-pane--trace"><h2 class="app-pane__title" id="pt">Trace</h2><div class="app-pane__body" data-trace-body tabindex="0" role="region" aria-labelledby="pt"><p class="govuk-body-s" data-trace-empty>Pick a number to see how it is built.</p>${traces}</div><div class="app-pane__foot">${commentBtn}</div></div>
<div class="app-pane app-pane--source"><h2 class="app-pane__title" id="ps">Source <span class="app-pane__sub" data-source-win>Second window: off</span></h2><div class="app-pane__body" data-source-body tabindex="0" role="region" aria-label="Source page"><p class="app-caption" data-source-caption>Pick a number to see its source.</p>${sourceHost(R, ctx)}<div data-source-state></div></div><div class="app-pane__foot"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-prev aria-keyshortcuts="[">Previous<span class="govuk-visually-hidden"> source</span></button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-next aria-keyshortcuts="]">Next<span class="govuk-visually-hidden"> source</span></button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-open-source aria-keyshortcuts="o">Open source</button><div class="govuk-checkboxes govuk-checkboxes--small app-winpref" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="win-pref" type="checkbox" aria-describedby="win-pref-hint"><label class="govuk-label govuk-checkboxes__label" for="win-pref">Open in a second window</label></div></div><span id="win-pref-hint" class="govuk-visually-hidden">Remembered for ${esc(PERSON)}. Off until you turn it on. It opens only when you pick a number and closes when you sign out.</span></div></div>
<div class="app-cpanel" data-comment-host></div>
</div></div></div>`;
  const toolbar = `<div class="app-toolbar" data-toolbar><h1 class="app-h1" id="route-title" tabindex="-1">Brief</h1><div class="app-toolbar__body" data-toolbar-body></div>${keysPanel(!canAct)}</div><div data-unmark></div>`;
  const main = `${idBar}${tabs}${wrapMain(`${toolbar}${reviewView}${commentsView(R, scn, ctx)}${historyView(R, scn, ctx)}${changesView(R, scn, ctx)}<script type="application/json" id="app-data">${jsonSafe(data)}</script>`, 'app-main--record')}`;
  return frame({ title: 'Return review', ret: R, main, bodyAttrs: 'data-record', bare: true, scripts: SCRIPT_PATH, foot: footNote(statesStrip()), person: PERSON });
}

// ---------------------------------------------------------------- the second window (the source viewer, opened on demand)
export function sourceWindow(which) {
  const R = getReturn(which);
  const keys = '<details class="app-keys app-keys--page"><summary class="app-keys__summary">Keyboard shortcuts</summary><div class="app-keys__pop" role="group" aria-label="Keyboard shortcuts"><ul class="app-keys__list"><li><kbd>]</kbd> Next source</li><li><kbd>[</kbd> Previous source</li></ul><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="keys-off" type="checkbox"><label class="govuk-label govuk-checkboxes__label" for="keys-off">Turn single-key shortcuts off</label></div></div></div></details>';
  const main = `${miniBar(R, PERSON)}<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper app-main" id="main-content" role="main">
<div class="app-queue-head">${keys}</div>
<h1 class="govuk-heading-m govuk-!-margin-bottom-1">Source viewer</h1>
<p class="govuk-body-s govuk-!-margin-bottom-2">${esc(R.corp)}, year end ${esc(R.ye)}. <span data-win-for>Waiting for a number in the review window.</span></p>
<div class="app-strip" role="group" aria-label="Source controls"><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="follow" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="follow">Follow the review window</label></div></div><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-prev aria-keyshortcuts="[">Previous source</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-src-next aria-keyshortcuts="]">Next source</button></div>
<div class="app-winbody" data-source-body tabindex="0" role="region" aria-label="Source page"><p class="app-caption" data-source-caption>Pick a number in the review window.</p>${sourceHost(R, { canComment: false })}<div data-source-state></div></div>
<p class="govuk-body-s govuk-!-margin-top-2">This window follows the review window on every number, flag and section change. It opens only when you ask, closes when you sign out, and you can turn it off with the checkbox in the review window. It comes back where you left it.</p>
</main></div>`;
  return frame({ title: 'Source viewer', ret: R, main, bodyAttrs: `data-source-window data-which="${which}"`, bare: true, scripts: SCRIPT_PATH, person: PERSON, headerPerson: false });
}
