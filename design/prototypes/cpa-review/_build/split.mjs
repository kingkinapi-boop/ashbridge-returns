// FROZEN since the second round: drafted version 2 or 3 against the first data model; not run any more (their pages stay as built).
// Version 2: list and detail. Tabs: Brief, Flags, Return, Comments, History. The Return tab is one list of every number in
// printed order (four sections, each with its own Reviewed mark) on the left; the selected number's trace and its source,
// stacked, on the right.
import { esc, money, SECTIONS, SCENARIOS, getReturn, reworkView, sectionState, marksLeft } from './model.mjs';
import { H, shell, subNav, badge, keysLegend, returnTable, sourcePaneBody, sourceButtons, traceBody, flagDetail, flagList, openFlags, isDecided, commentsTable, timeline, commentForm, commentErrorSummary, sixTable, pinnedFlags, changesList, assumptionsList, attestationsList, protoStrip, chg } from './ui.mjs';
import { windowPage } from './tabs.mjs';

export function build(emit) {
  for (const scn of Object.values(SCENARIOS)) {
    const R0 = getReturn(scn.which);
    const rv = reworkView(R0, scn);
    const R = rv.ret;
    const left = marksLeft(scn);
    const done = 5 - left.length;
    const nav = (active) => {
      const items = [
        { key: 'brief', title: 'Brief', href: `${scn.slug}-brief.html` },
        { key: 'flags', title: 'Flags', href: `${scn.slug}-flags.html`, badge: badge(openFlags(R, scn).length + ' open', openFlags(R, scn).length ? 'red' : 'green') },
        { key: 'return', title: 'Return', href: `${scn.slug}-return.html`, badge: badge(done + ' of 5 Reviewed', left.length ? 'grey' : 'green') },
      ];
      if (scn.kind === 'rework') items.push({ key: 'changes', title: 'Changes', href: `${scn.slug}-changes.html`, badge: badge(2, 'purple', 'changed numbers') });
      items.push({ key: 'comments', title: 'Comments', href: `${scn.slug}-comments.html`, badge: badge(R.cfg.comments.length, R.cfg.comments.length ? 'blue' : 'grey', 'comments') });
      items.push({ key: 'history', title: 'History', href: `${scn.slug}-history.html` });
      return subNav(items, active, 'Return record');
    };
    const proto = protoStrip('v2', scn);
    const page = (slug, title, body, o = {}) => emit(`${scn.slug}-${slug}.html`, shell({ title, ret: R, scn, main: body, proto, error: o.error }));
    emit(`${scn.slug}-source-window.html`, windowPage(scn, R, 'v2'));
    const winLink = `<a class="govuk-link" href="${scn.slug}-source-window.html" target="ashbridge-source" data-open-source aria-keyshortcuts="o">Open on second monitor</a>`;

    const approveBtn = `<a href="${scn.slug}-approved.html" role="button" draggable="false" class="govuk-button govuk-button--start app-btn-sm" data-module="govuk-button" data-key="a" aria-keyshortcuts="a">Approve return</a>`;
    const leftLinks = (skip) => left.filter((s) => s.key !== skip).map((s) => `<a class="govuk-link" href="${s.key === 'flags' ? scn.slug + '-flags.html' : scn.slug + '-return.html#sec-' + s.key}">${esc(s.title)}${sectionState(scn, s.key).state === 'off' ? ' (mark came off)' : ''}</a>`).join(', ');
    const approveOrLeft = left.length === 0 ? approveBtn : `<span>Left before Approve shows (${left.length} of 5): ${leftLinks()}.</span>`;

    // ---------------- brief: decision first, then numbers and flags
    const rwBanner = scn.kind === 'rework' ? `<div class="govuk-notification-banner" role="region" aria-labelledby="nb-title" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="nb-title">Back from rework</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">${esc(R.cfg.preparer)} changed 2 numbers. The Income statement mark came off. <a class="govuk-notification-banner__link" href="${scn.slug}-changes.html">See only the changes</a>.</p></div></div>` : '';
    const goHref = left.length ? (left[0].key === 'flags' ? `${scn.slug}-flags.html` : `${scn.slug}-return.html#sec-${left[0].key}`) : `${scn.slug}-return.html`;
    page('brief', 'Brief', `${rwBanner}<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Brief</h1>${nav('brief')}
<div class="govuk-grid-row govuk-!-margin-top-3">
<div class="govuk-grid-column-one-half">
<div class="app-card govuk-!-margin-bottom-3"><h2 class="govuk-heading-s govuk-!-margin-bottom-1">Go, or send back</h2>
<dl class="govuk-summary-list govuk-summary-list--no-border govuk-!-margin-bottom-2"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Tier</dt><dd class="govuk-summary-list__value">${H.tier(R.cfg.tier)} ${esc(R.cfg.tierWhy)}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Sections</dt><dd class="govuk-summary-list__value">${approveOrLeft}</dd></div></dl>
<a href="${goHref}" role="button" draggable="false" class="govuk-button govuk-!-margin-bottom-0 app-btn-sm" data-module="govuk-button">${scn.kind === 'ready' ? 'Open the return' : 'Start with ' + esc(left[0].title)}</a> &nbsp; <a class="govuk-link" href="${scn.slug}-send-back.html">Send back to ${esc(R.cfg.preparer)}</a></div>
${sixTable(R, scn)}</div>
<div class="govuk-grid-column-one-half">${pinnedFlags(R, scn)}
<dl class="govuk-summary-list govuk-!-margin-top-3 govuk-!-margin-bottom-0"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Changes</dt><dd class="govuk-summary-list__value">${changesList(R)}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Assumptions</dt><dd class="govuk-summary-list__value">${assumptionsList(R)}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Attestations</dt><dd class="govuk-summary-list__value">${attestationsList(R)}</dd></div></dl></div></div>`);

    // ---------------- the two-column pages
    const detailPane = ({ keysList, sel, srcState, commentHref, traceHtml, retryHref }) => {
      const body3 = keysList.map((l) => sourcePaneBody(l.id, l.srcs, { sel: l.id === sel, state: l.id === sel ? srcState : 'normal', commentHref, label: l.label, retry: retryHref })).join('');
      const nSrc = (keysList.find((l) => l.id === sel) || { srcs: [] }).srcs.length;
      return `<div class="app-stack"><section class="app-pane app-pane--trace" aria-labelledby="pd"><h2 class="app-pane__title" id="pd">Trace</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Trace of the selected number">${traceHtml}</div><div class="app-pane__foot"><a class="govuk-link" data-key="c" aria-keyshortcuts="c" href="${commentHref}">Comment on this number</a></div></section>
<section class="app-pane app-pane--source" aria-labelledby="ps"><h2 class="app-pane__title" id="ps">Source</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Source page">${body3}</div><div class="app-pane__foot">${sourceButtons(nSrc)}${winLink}</div></section></div>`;
    };

    // ---------------- return (walk): all four sections in one list
    const groupBar = (secKey) => {
      const sec = SECTIONS.find((s) => s.key === secKey);
      const idx = SECTIONS.findIndex((s) => s.key === secKey) + 1;
      const st = sectionState(scn, secKey);
      let tag, btn;
      if (st.state === 'on') { tag = `<strong class="govuk-tag govuk-tag--green" data-mark-state data-section="${secKey}">Reviewed by ${esc(st.who)}, ${esc(st.when)}</strong>`; btn = `<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-mark data-section="${secKey}" aria-pressed="true" aria-keyshortcuts="r">Reviewed by Zo. Take mark off</button>`; }
      else if (st.state === 'off') { tag = `<strong class="govuk-tag govuk-tag--red" data-mark-state data-section="${secKey}">Mark came off</strong>`; btn = `<button type="button" class="govuk-button app-btn-sm" data-mark data-section="${secKey}" aria-pressed="false" aria-keyshortcuts="r">Mark section Reviewed</button>`; }
      else { tag = `<strong class="govuk-tag govuk-tag--grey" data-mark-state data-section="${secKey}">Not reviewed</strong>`; btn = `<button type="button" class="govuk-button app-btn-sm" data-mark data-section="${secKey}" aria-pressed="false" aria-keyshortcuts="r">Mark section Reviewed</button>`; }
      const why = st.state === 'off' && rv.rw ? `<p class="govuk-body-s govuk-!-margin-top-1 govuk-!-margin-bottom-0"><strong>Why the mark came off:</strong> ${esc(R.byId[rv.rw.to].label)} changed from ${money(rv.before[rv.rw.to])} to ${money(R.byId[rv.rw.to].cy)} and ${esc(R.byId[rv.rw.from].label)} from ${money(rv.before[rv.rw.from])} to ${money(R.byId[rv.rw.from].cy)} (${esc(rv.rw.who)}, ${esc(rv.rw.when)}, answering ${esc(rv.rw.comment)}).</p>` : '';
      return `<div class="app-strip govuk-!-margin-top-3" id="sec-${secKey}" role="group" aria-label="Reviewed mark for ${esc(sec.title)}"><h3 class="govuk-heading-s govuk-!-margin-0">Section ${idx} of 5: ${esc(sec.title)}</h3>${tag}${btn}${why}</div>`;
    };
    const walk = (o = {}) => {
      const keysList = ['bs', 'is', 's1', 'other'].flatMap((k) => R.ordered[k]).map((l) => ({ id: l.id, srcs: l.srcs, label: l.label }));
      const sel = o.sel || R.ordered.bs[0].id;
      const jump = SECTIONS.filter((s) => s.key !== 'flags').map((s) => { const st = sectionState(scn, s.key); return `<a class="govuk-link" href="#sec-${s.key}">${esc(s.title)}</a> ${st.state === 'on' ? H.tag('Reviewed', 'green') : st.state === 'off' ? H.tag('Mark came off', 'red') : H.tag('Not reviewed', 'grey')}`; }).join(' &nbsp; ');
      const lists = ['bs', 'is', 's1', 'other'].map((k) => groupBar(k) + returnTable(R.ordered[k], { caption: `${SECTIONS.find((s) => s.key === k).title}, year ended ${R.ye}, in printed order`, sel, fl: R.flags, tier: R.cfg.tier, scn })).join('');
      const traces = keysList.map((l) => traceBody(R.byId[l.id], R, scn, { sel: l.id === sel, key: l.id })).join('');
      const commentHref = `${scn.slug}-comment.html`;
      const pane1 = `<section class="app-pane" aria-labelledby="pl"><h2 class="app-pane__title" id="pl">The return, in printed order</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Every number in the return">
<p class="govuk-body-s govuk-!-margin-bottom-1">Sections: ${jump}. Flags have their own tab.</p>${lists}</div>
<div class="app-pane__foot"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-next aria-keyshortcuts="j">Next number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-prev aria-keyshortcuts="k">Previous number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-next-flag aria-keyshortcuts="f">Next flag</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-next-section aria-keyshortcuts="n">Next section</button></div></section>`;
      const banner = o.banner ? `<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" aria-labelledby="nb-title" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="nb-title">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Comment C-${R.cfg.comments.length + 1} added on ${esc(R.byId[sel].label)}. It goes to ${esc(R.cfg.preparer)} when you send the return back.</p></div></div>` : '';
      const strip = `<div class="app-strip" role="group" aria-label="Progress"><span><progress class="app-progress" value="${done}" max="5" aria-label="Sections Reviewed">${done} of 5</progress> ${done} of 5 sections Reviewed</span><span>${approveOrLeft}</span></div>`;
      page('return' + (o.suffix || ''), o.title || 'Return', `${banner}<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Return</h1>${nav('return')}<div class="govuk-!-margin-top-3">${strip}</div><div class="app-panes app-panes--split govuk-!-margin-top-2">${pane1}${detailPane({ keysList, sel, srcState: o.srcState, commentHref, traceHtml: traces, retryHref: `${scn.slug}-return.html#${sel}` })}</div>${keysLegend()}`);
    };
    walk();
    walk({ banner: true, sel: scn.slug === 'red' ? 'n-6090' : R.ordered.is[0].id, suffix: '-commented', title: 'Return, comment added' });
    if (scn.slug === 'red') {
      walk({ sel: 'n-6170', suffix: '-no-evidence' });
      walk({ sel: 'n-6155', suffix: '-source-loading', srcState: 'loading' });
      walk({ sel: 'n-6155', suffix: '-source-failed', srcState: 'failed' });
    }

    // ---------------- comment form page: the form beside the number's trace
    const commentLine = scn.slug === 'red' ? R.byId['n-6090'] : R.ordered.is[0];
    const cf = (error) => {
      const trace = traceBody(commentLine, R, scn, { sel: true, key: commentLine.id });
      return `${error ? commentErrorSummary() : ''}<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Comment on ${esc(commentLine.label)}</h1>${nav('return')}
<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-one-half">${commentForm({ line: commentLine, R, scn, error, action: error ? `${scn.slug}-return-commented.html` : (scn.slug === 'red' ? `${scn.slug}-comment-error.html` : `${scn.slug}-return-commented.html`) }).replace(/Cancel<\/a>/, 'Cancel</a>').replace(/href="[^"]*">Cancel/, `href="${scn.slug}-return.html">Cancel`)}</div>
<div class="govuk-grid-column-one-half"><section class="app-pane app-pane--short" aria-labelledby="ct"><h2 class="app-pane__title" id="ct">The number</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Trace of the number">${trace}</div></section></div></div>`;
    };
    page('comment', 'Comment on ' + commentLine.label, cf(false));
    if (scn.slug === 'red') page('comment-error', 'Comment on ' + commentLine.label, cf(true), { error: true });

    // ---------------- flags: list left, detail and source right
    {
      const sel = R.flags[0].id;
      const keysList = R.flags.map((f) => ({ id: f.id, srcs: R.byId[f.where].srcs, label: f.title }));
      const traces = R.flags.map((f) => flagDetail(f, R, scn, { sel: f.id === sel })).join('');
      const st = sectionState(scn, 'flags');
      const nOpen = openFlags(R, scn).length;
      let mark;
      if (st.state === 'on') mark = `<strong class="govuk-tag govuk-tag--green" data-mark-state data-section="flags">Reviewed by ${esc(st.who)}, ${esc(st.when)}</strong><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-mark data-section="flags" aria-pressed="true" aria-keyshortcuts="r">Reviewed by Zo. Take mark off</button>`;
      else if (nOpen) mark = `<strong class="govuk-tag govuk-tag--grey" data-mark-state data-section="flags">Not reviewed</strong><span>${nOpen} flags still need a decision. Step through them with <kbd>f</kbd>; the Reviewed mark appears when none is open.</span>`;
      else mark = `<strong class="govuk-tag govuk-tag--grey" data-mark-state data-section="flags">Not reviewed</strong><button type="button" class="govuk-button app-btn-sm" data-mark data-section="flags" aria-pressed="false" aria-keyshortcuts="r">Mark section Reviewed</button>`;
      const pane1 = `<section class="app-pane" aria-labelledby="pl"><h2 class="app-pane__title" id="pl">Flags <span class="govuk-body-s govuk-!-margin-0">red first, then dollar effect</span></h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Flag list">${flagList(R, scn, sel)}</div><div class="app-pane__foot"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-next aria-keyshortcuts="j">Next number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-prev aria-keyshortcuts="k">Previous number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-next-flag aria-keyshortcuts="f">Next flag</button></div></section>`;
      page('flags', 'Flags', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Flags</h1>${nav('flags')}<div class="app-strip govuk-!-margin-top-3" role="group" aria-label="Reviewed mark for Flags"><strong>Section 1 of 5: Flags</strong>${mark}<span>${approveOrLeft}</span></div><div class="app-panes app-panes--split govuk-!-margin-top-2">${pane1}${detailPane({ keysList, sel, commentHref: `${scn.slug}-comment.html`, traceHtml: traces, retryHref: '#' })}</div>${keysLegend()}`);
    }

    // ---------------- changes, comments, history, send back, approved
    if (scn.kind === 'rework') {
      const rw = rv.rw;
      const rows = [rw.to, rw.from].map((id) => `<tr><th scope="row" class="govuk-table__header">${esc(R.byId[id].label)}</th><td class="govuk-table__cell">Income statement</td><td class="govuk-table__cell app-money">${money(rv.before[id])}</td><td class="govuk-table__cell app-money">${money(R.byId[id].cy)}</td><td class="govuk-table__cell app-money">${chg({ cy: R.byId[id].cy, ly: rv.before[id] })}</td><td class="govuk-table__cell"><a class="govuk-link" href="${scn.slug}-return.html#${id}">Open the number</a></td></tr>`).join('');
      page('changes', 'Changes since you sent it back', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Changes since you sent it back</h1>${nav('changes')}<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-two-thirds"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Changed numbers, before and after (2)</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header app-money">Before</th><th scope="col" class="govuk-table__header app-money">After</th><th scope="col" class="govuk-table__header app-money">Change</th><th scope="col" class="govuk-table__header">Source</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table><p class="govuk-body">Changed by ${esc(rw.who)}, ${esc(rw.when)}, answering ${esc(rw.comment)}. Total expenses and net income did not change.</p><h2 class="govuk-heading-s">Sections whose mark came off</h2><ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="${scn.slug}-return.html#sec-is">Income statement</a>: a number in it changed.</li></ul><p class="govuk-body">Still Reviewed: Balance sheet, Schedule 1, Other schedules. Flags are not marked yet.</p></div></div>`);
    }
    page('comments', 'Comments', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Comments</h1>${nav('comments')}<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-full">${commentsTable(R, scn)}<p class="govuk-body">To add one, open a number and press <kbd>c</kbd>.</p></div></div>`);
    page('history', 'History', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">History</h1>${nav('history')}<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-two-thirds">${timeline(R, scn)}</div></div>`);
    page('send-back', 'Send back to the preparer', `<h1 class="govuk-heading-l">Send back to ${esc(R.cfg.preparer)}</h1><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><form action="${scn.slug}-sent-back.html" method="get"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="why">What should the preparer do first? <span class="app-required" aria-hidden="true">*</span></label><div id="why-hint" class="govuk-hint">Required. One or two sentences. Your ${R.cfg.comments.length} comments go with it.</div><textarea class="govuk-textarea" id="why" name="why" rows="4" aria-describedby="why-hint"></textarea></div><button class="govuk-button" data-module="govuk-button" data-prevent-double-click="true">Send back</button> <a class="govuk-link" href="${scn.slug}-brief.html">Cancel</a></form></div></div>`);
    page('sent-back', 'Sent back', `<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Returned to the preparer</h1><div class="govuk-panel__body">${esc(R.corp)}</div></div><p class="govuk-body">It leaves your queue until ${esc(R.cfg.preparer)} sends it back. Its sections keep their Reviewed marks; any number that changes takes the mark off.</p><p class="govuk-body"><a class="govuk-link" href="queue.html">Back to the queue</a></p>`);
    if (scn.kind === 'ready') page('approved', 'Approved', `<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Return approved</h1><div class="govuk-panel__body">${esc(R.corp)}<br>by Zo, 10 Mar 2026, 11:34</div></div><p class="govuk-body">Every section was Reviewed. The approval is voided if any number changes.</p><p class="govuk-body"><a class="govuk-link" href="queue.html">Open the next return in the queue</a></p>`);
  }
}
