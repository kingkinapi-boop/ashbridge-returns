// Versions 1 and 3: a return record page with sub navigation tabs. Version 1 shows return, trace and source side by side
// (three panes). Version 3 keeps return and trace on the first monitor and the source viewer in a second window.
import { esc, money, SECTIONS, SCENARIOS, getReturn, reworkView, sectionState, marksLeft } from './model.mjs';
import { H, shell, subNav, badge, keysLegend, returnTable, sourcePaneBody, sourceButtons, sourceCaption, traceBody, flagDetail, flagList, markBar, openFlags, isDecided, commentsTable, timeline, commentForm, sixTable, pinnedFlags, changesList, assumptionsList, attestationsList, protoStrip, val, chg, commentErrorSummary } from './ui.mjs';

const SLUG = { bs: 'balance-sheet', is: 'income-statement', s1: 'schedule-1', other: 'other-schedules' };

function tiles(R, scn) {
  return `<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Six numbers against last year</h2><div class="app-tiles">${R.six.map((id) => { const l = R.byId[id]; const sec = SLUG[l.section]; return `<div class="app-tile"><a class="govuk-link" href="${scn.slug}-${sec}.html#${l.id}">${esc(l.label)}</a><div class="app-tile__value">${money(l.cy)}</div><div class="govuk-body-s govuk-!-margin-bottom-1">Last year ${money(l.ly)}<br>Change ${chg(l)}</div>${H.dot(l.dot)}</div>`; }).join('')}</div>`;
}

export function windowPage(scn, R, version) {
  // the source viewer for the second monitor: every source of the return, one shown, follows the main window
  const keys = [...R.lines.filter((l) => l.section !== 'x'), ...R.flags.map((f) => ({ id: f.id, srcs: R.byId[f.where].srcs, label: f.title }))];
  const bodies = keys.map((l) => sourcePaneBody(l.id, l.srcs, { sel: false, label: l.label, commentHref: version === 'v2' ? `${scn.slug}-comment.html` : `${scn.slug}-income-statement-comment.html` })).join('');
  const docs = R.key.accounts.map((a) => `<li>${esc(a.layout.replace(/^[A-C]: /, ''))}: twelve monthly statements, account ending ${esc(a.file.match(/(\d{4})\.csv$/)[1])}</li>`).join('');
  return shell({
    title: 'Source viewer', ret: R, scn, nav: 'none', bare: true, bodyAttrs: 'data-source-window', proto: '',
    main: `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Source viewer</h1>
<div class="app-strip" role="group" aria-label="Source controls">
<span class="app-follow govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><span class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="follow" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="follow">Follow my clicks in the review window</label></span></span>
${sourceButtons(0)}
</div>
<div class="govuk-!-margin-top-3" aria-label="Current source">${bodies}</div>
<details class="govuk-details govuk-!-margin-top-4"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Documents in this return</span></summary><div class="govuk-details__text"><ul class="govuk-list govuk-list--bullet">${docs}</ul></div></details>
<p class="govuk-body-s">This window follows the review window. Close it any time.</p>`,
  });
}

export function build(version, emit) {
  const two = version === 'v3';
  for (const scn of Object.values(SCENARIOS)) {
    const R0 = getReturn(scn.which);
    const rv = reworkView(R0, scn);
    const R = rv.ret;
    const open = openFlags(R, scn).length;
    const tabs = (active) => {
      const items = [{ key: 'brief', title: 'Brief', href: `${scn.slug}-brief.html` }];
      for (const s of SECTIONS) {
        const st = sectionState(scn, s.key);
        const b = st.state === 'on' ? badge('Reviewed', 'green') : st.state === 'off' ? badge('Mark came off', 'red') : badge('Not reviewed', 'grey');
        items.push({ key: s.key, title: s.title, href: `${scn.slug}-${s.slug}.html`, badge: b });
      }
      if (scn.kind === 'rework') items.push({ key: 'changes', title: 'Changes', href: `${scn.slug}-changes.html`, badge: badge(2, 'purple', 'changed numbers') });
      items.push({ key: 'comments', title: 'Comments', href: `${scn.slug}-comments.html`, badge: badge(R.cfg.comments.length, R.cfg.comments.length ? 'blue' : 'grey', 'comments') });
      items.push({ key: 'history', title: 'History', href: `${scn.slug}-history.html` });
      return subNav(items, active, 'Return record');
    };
    const proto = protoStrip(version, scn) + (two ? `<p class="govuk-body-s"><a class="govuk-link" href="layout.html">Two-monitor layout drawing</a></p>` : '');
    const page = (slug, title, body, o = {}) => emit(`${scn.slug}-${slug}.html`, shell({ title, ret: R, scn, main: body, proto, error: o.error, nav: 'queue' }));

    emit(`${scn.slug}-source-window.html`, windowPage(scn, R, version));
    const winLink = `<a class="govuk-link" href="${scn.slug}-source-window.html" target="ashbridge-source" data-open-source aria-keyshortcuts="o">Open on second monitor</a>`;

    // ------------------------------------------------ brief
    const rwBanner = scn.kind === 'rework' ? `<div class="govuk-notification-banner" role="region" aria-labelledby="nb-title" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="nb-title">Back from rework</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">${esc(R.cfg.preparer)} changed 2 numbers since you sent the return back. The Income statement mark came off. <a class="govuk-notification-banner__link" href="${scn.slug}-changes.html">See only the changes</a>.</p></div></div>` : '';
    const left = marksLeft(scn);
    const approveBlock = left.length === 0
      ? `<p class="govuk-body govuk-!-margin-bottom-0"><strong>Every section is Reviewed by Zo.</strong> Approve is ready above.</p>`
      : `<p class="govuk-body govuk-!-margin-bottom-0"><strong>Left before Approve shows (${left.length} of 5):</strong> ${left.map((s) => `<a class="govuk-link" href="${scn.slug}-${s.slug}.html">${esc(s.title)}${sectionState(scn, s.key).state === 'off' ? ' (mark came off)' : ''}</a>`).join(', ')}.</p>`;
    const startHref = `${scn.slug}-${left.length ? left[0].slug : 'flags'}.html`;
    page('brief', 'Brief', `${rwBanner}<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Brief</h1>${tabs('brief')}
<div class="app-strip govuk-!-margin-bottom-3" role="group" aria-label="Go or send back">
<span><strong>Tier ${H.tierWord(R.cfg.tier)}.</strong> ${esc(R.cfg.tierWhy)}</span>
${left.length ? `<a href="${startHref}" role="button" draggable="false" class="govuk-button govuk-!-margin-bottom-0 app-btn-sm" data-module="govuk-button" data-key="n" aria-keyshortcuts="n">${(left.length === 5 ? "Start section 1: " : "Next section left: ") + left[0].title}</a>` : `<a href="${scn.slug}-approved.html" role="button" draggable="false" class="govuk-button govuk-button--start govuk-!-margin-bottom-0 app-btn-sm" data-module="govuk-button" data-key="a" aria-keyshortcuts="a">Approve return</a>`}
<a class="govuk-link" href="${scn.slug}-send-back.html">Send back to ${esc(R.cfg.preparer)}</a>
</div>
<div class="app-brief">
<div>${two ? tiles(R, scn) : sixTable(R, scn)}<h2 class="govuk-heading-s govuk-!-margin-top-3 govuk-!-margin-bottom-1">Sections</h2>${approveBlock}</div>
<div>${pinnedFlags(R, scn)}</div></div>
<div class="app-brief3">
<div><h2>Changes since last year</h2>${changesList(R)}</div>
<div><h2>Assumptions</h2>${assumptionsList(R)}</div>
<div><h2>Attestations</h2>${attestationsList(R)}</div></div>`);

    // ------------------------------------------------ sections
    const secPage = (secKey, o = {}) => {
      const sec = SECTIONS.find((s) => s.key === secKey);
      const isFlags = secKey === 'flags';
      const lines = isFlags ? null : R.ordered[secKey];
      const rows = isFlags ? R.flags : lines;
      const sel = o.sel || rows[0].id;
      const keyOf = (x) => x.id;
      const commentHref = `${scn.slug}-${sec.slug}-comment.html`;
      let pane1;
      if (isFlags) pane1 = flagList(R, scn, sel);
      else pane1 = returnTable(lines, { caption: `${sec.title}, year ended ${R.ye}, in printed order`, sel, fl: R.flags, tier: R.cfg.tier, scn });
      const pane1Foot = `<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-next aria-keyshortcuts="j">Next number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-step-prev aria-keyshortcuts="k">Previous number</button><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-next-flag aria-keyshortcuts="f">Next flag</button>`;
      // trace (middle pane)
      let mid = '';
      if (o.comment) {
        const ln = R.byId[sel];
        mid = commentForm({ line: ln, R, scn, error: o.error, action: o.error ? `${scn.slug}-${sec.slug}-commented.html` : (scn.slug === 'red' && secKey === 'is' ? `${scn.slug}-${sec.slug}-comment-error.html` : `${scn.slug}-${sec.slug}-commented.html`) });
      } else if (isFlags) mid = R.flags.map((f) => flagDetail(f, R, scn, { sel: f.id === sel })).join('');
      else mid = lines.map((l) => traceBody(l, R, scn, { sel: l.id === sel, key: l.id })).join('');
      const midFoot = o.comment ? `<a class="govuk-link" href="${scn.slug}-${sec.slug}.html">Back to the trace</a>` : (isFlags ? `<a class="govuk-link" href="${scn.slug}-comments.html">All comments</a>` : `<a class="govuk-link" data-key="c" aria-keyshortcuts="c" href="${commentHref}">Comment on this number</a>`);
      // source (right pane)
      const srcKeys = isFlags ? R.flags.map((f) => ({ id: f.id, srcs: R.byId[f.where].srcs, label: f.title })) : lines.map((l) => ({ id: l.id, srcs: l.srcs, label: l.label }));
      const body3 = srcKeys.map((l) => sourcePaneBody(l.id, l.srcs, { sel: l.id === sel, state: l.id === sel ? o.srcState : 'normal', commentHref, label: l.label, retry: `${scn.slug}-${sec.slug}.html${o.noHashRetry ? '' : '#' + sel}` })).join('');
      const nSrc = (srcKeys.find((l) => l.id === sel) || { srcs: [] }).srcs.length;
      const pane3 = two
        ? `<section class="app-pane app-pane--short" aria-labelledby="p3"><h2 class="app-pane__title" id="p3">Source on monitor 2</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Source status"><p class="govuk-body">The boxed source follows your clicks in the source window.</p><p class="govuk-body"><strong data-caption-target>Current source: select a number</strong></p><p class="govuk-body-s">If the window is not open, ${winLink}. It opens where you last put it.</p><div hidden>${body3}</div></div><div class="app-pane__foot">${sourceButtons(nSrc)}${winLink}</div></section>`
        : `<section class="app-pane" aria-labelledby="p3"><h2 class="app-pane__title" id="p3">Source</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="Source page">${body3}</div><div class="app-pane__foot">${sourceButtons(nSrc)}${winLink}</div></section>`;
      const p1 = `<section class="app-pane" aria-labelledby="p1"><h2 class="app-pane__title" id="p1">${isFlags ? 'Flags' : esc(sec.title)} <span class="govuk-body-s govuk-!-margin-0">${isFlags ? 'red first, then dollar effect' : 'fixed printed order'}</span></h2><div class="app-pane__body" tabindex="0" role="region" aria-label="${esc(sec.title)} list">${pane1}</div><div class="app-pane__foot">${pane1Foot}</div></section>`;
      const p2 = `<section class="app-pane" aria-labelledby="p2"><h2 class="app-pane__title" id="p2">${o.comment ? 'Comment' : 'Trace'}</h2><div class="app-pane__body" tabindex="0" role="region" aria-label="${o.comment ? 'Comment form' : 'Trace'}">${mid}</div><div class="app-pane__foot">${midFoot}</div></section>`;
      const panesFixed = two ? `<div class="app-panes app-panes--2">${p1}${p2}</div><div class="govuk-!-margin-top-2">${pane3}</div>` : `<div class="app-panes app-panes--3">${p1}${p2}${pane3}</div>`;
      const banner = o.banner ? `<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" aria-labelledby="nb-title" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="nb-title">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Comment C-${R.cfg.comments.length + 1} added on ${esc(R.byId[sel].label)}. It goes to ${esc(R.cfg.preparer)} when you send the return back.</p></div></div>` : '';
      const err = o.error ? '' : '';
      const slug = sec.slug + (o.suffix || '');
      const title = (o.comment ? 'Comment on ' + R.byId[sel].label + ', ' : '') + sec.title;
      page(slug, title, `${o.error ? commentErrorSummary() : ''}${banner}<h1 class="govuk-heading-m govuk-!-margin-bottom-2">${esc(o.comment ? 'Comment on ' + R.byId[sel].label : sec.title)}</h1>${tabs(secKey)}${markBar(R, scn, secKey, { rw: scn.kind === 'rework' ? rv : null })}<div class="govuk-!-margin-top-3">${panesFixed}</div>${keysLegend()}`, { error: o.error });
    };
    function summaryFor() { return ''; }

    for (const s of SECTIONS) {
      secPage(s.key);
      if (s.key !== 'flags') {
        const first = (R.ordered[s.key].find((l) => l.kind !== 'sub') || R.ordered[s.key][0]).id;
        const sel = scn.slug === 'red' && s.key === 'is' ? 'n-6090' : first;
        secPage(s.key, { comment: true, sel, suffix: '-comment' });
        secPage(s.key, { banner: true, sel, suffix: '-commented' });
      }
    }
    if (scn.slug === 'red') {
      secPage('is', { sel: 'n-6170', suffix: '-no-evidence' });
      secPage('is', { sel: 'n-6155', suffix: '-source-loading', srcState: 'loading' });
      secPage('is', { sel: 'n-6155', suffix: '-source-failed', srcState: 'failed' });
      secPage('is', { comment: true, sel: 'n-6090', error: true, suffix: '-comment-error' });
    }

    // ------------------------------------------------ changes (task 8)
    if (scn.kind === 'rework') {
      const rw = rv.rw;
      const rows = [rw.to, rw.from].map((id) => `<tr><th scope="row" class="govuk-table__header">${esc(R.byId[id].label)}</th><td class="govuk-table__cell">Income statement</td><td class="govuk-table__cell app-money">${money(rv.before[id])}</td><td class="govuk-table__cell app-money">${money(R.byId[id].cy)}</td><td class="govuk-table__cell app-money">${chg({ cy: R.byId[id].cy, ly: rv.before[id] })}</td><td class="govuk-table__cell"><a class="govuk-link" href="${scn.slug}-income-statement.html#${id}">Open the number</a></td></tr>`).join('');
      page('changes', 'Changes since you sent it back', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Changes since you sent it back</h1>${tabs('changes')}
<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-two-thirds">
<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Changed numbers, before and after (2)</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header app-money">Before</th><th scope="col" class="govuk-table__header app-money">After</th><th scope="col" class="govuk-table__header app-money">Change</th><th scope="col" class="govuk-table__header">Source</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table>
<p class="govuk-body">Changed by ${esc(rw.who)}, ${esc(rw.when)}, answering ${esc(rw.comment)}. Total expenses and net income did not change.</p>
<h2 class="govuk-heading-s">Sections whose mark came off</h2>
<ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="${scn.slug}-income-statement.html">Income statement</a>: a number in it changed.</li></ul>
<p class="govuk-body">Sections still Reviewed: Balance sheet, Schedule 1, Other schedules. Flags are not marked yet.</p></div></div>`);
    }

    // ------------------------------------------------ comments, history
    page('comments', 'Comments', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">Comments</h1>${tabs('comments')}<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-full">${commentsTable(R, scn)}<p class="govuk-body">To add one, open a number and press <kbd>c</kbd>. Comments are sent to ${esc(R.cfg.preparer)} when you send the return back; they do not stop you approving once every section is Reviewed.</p></div></div>`);
    page('history', 'History', `<h1 class="govuk-heading-m govuk-!-margin-bottom-2">History</h1>${tabs('history')}<div class="govuk-grid-row govuk-!-margin-top-3"><div class="govuk-grid-column-two-thirds">${timeline(R, scn)}</div></div>`);

    // ------------------------------------------------ send back, approve
    page('send-back', 'Send back to the preparer', `<h1 class="govuk-heading-l">Send back to ${esc(R.cfg.preparer)}</h1><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><form action="${scn.slug}-sent-back.html" method="get"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="why">What should the preparer do first? <span class="app-required" aria-hidden="true">*</span></label><div id="why-hint" class="govuk-hint">Required. One or two sentences. Your ${R.cfg.comments.length} comments go with it.</div><textarea class="govuk-textarea" id="why" name="why" rows="4" aria-describedby="why-hint"></textarea></div><button class="govuk-button" data-module="govuk-button" data-prevent-double-click="true">Send back</button> <a class="govuk-link" href="${scn.slug}-brief.html">Cancel</a></form></div></div>`);
    page('sent-back', 'Sent back', `<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Returned to the preparer</h1><div class="govuk-panel__body">${esc(R.corp)}</div></div><p class="govuk-body">It leaves your queue until ${esc(R.cfg.preparer)} sends it back. Its sections keep their Reviewed marks; any number that changes takes the mark off.</p><p class="govuk-body"><a class="govuk-link" href="queue.html">Back to the queue</a></p>`);
    if (scn.kind === 'ready') {
      page('approved', 'Approved', `<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Return approved</h1><div class="govuk-panel__body">${esc(R.corp)}<br>by Zo, ${'10 Mar 2026, 11:34'}</div></div><p class="govuk-body">Every section was Reviewed. The approval is voided if any number changes.</p><p class="govuk-body"><a class="govuk-link" href="queue.html">Open the next return in the queue</a></p>`);
    }
  }
}
