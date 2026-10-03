// The brief, the Approve view, comments, history and changes of the record page. Only govuk-, moj- and app- classes.
import { esc, money, longDate, SECTIONS, UNPLACED, TODAY_ISO, filingDue, balanceDue, risksOf, topChanges, commentsFor, whyShort } from './model.mjs';
import { H, chg, val, madeTag } from './ui.mjs';
import { route, flagKey, effectKey, KIND_RANK } from './parts.mjs';

const PREP_SHORT = { fixed: 'Fixed', explained: 'Explained', accepted: 'For you to judge' };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (k) => (/^[A-Z]{2}/.test(k) ? k : k.charAt(0).toLowerCase() + k.slice(1));
const countsText = (c) => Object.entries(c).map(([k, n]) => `${n} ${lowerFirst(k)}`).join(', ');

export function datesOf(R) {
  const f = filingDue(R.yeIso), b = balanceDue(R.yeIso, R.cfg.ccpc3);
  return { f, b, overdue: f < TODAY_ISO, balancePast: b < TODAY_ISO };
}

// the sections that hold a changed number (their marks come off)
export const sectionsHolding = (R, view) => [...new Set(view.changed.map((id) => R.byId[id].section))];

// the fix-round digest (CP16): one place that says what the round did
export function digestOf(R0, scn, view) {
  if (view.mode !== 'rework') return null;
  const rw = R0.cfg.rework;
  const cs = commentsFor(R0, scn);
  const counts = {};
  for (const c of cs) { const s = c.resolved ? 'Resolved' : rw.replies[c.id].state; counts[s] = (counts[s] || 0) + 1; }
  return { sent: '10 Mar 2026, 10:40', back: rw.back, who: rw.who, changed: view.changed.length, off: sectionsHolding(view.ret, view).length, comments: cs.length, counts, drafts: rw.ai.length, draftsApproved: rw.ai.filter((d) => d.approved || scn.cs === 'resolved').length };
}

// ---------------------------------------------------------------- the brief (RV-2, V02): the first screen, then a short part just below
export function briefPanel(R, scn, ctx) {
  const d = datesOf(R);
  const risks = risksOf(R);
  const att = R.cfg.attest.filter((a) => !a.ok).length;
  const dg = ctx.digest;
  const strip = `<div class="app-strip"><div class="app-strip__row">${H.tier(R.cfg.tier)} <span>${esc(whyShort(R.which))}</span></div><div class="app-strip__row"><span>${d.overdue ? H.tag('Filing overdue', 'red') + ' It was due ' : 'Filing due '}${longDate(d.f)}; balance due ${longDate(d.b)}${d.balancePast ? ' (date has passed)' : ''}.</span>${att ? `<a class="govuk-link" href="#/brief/attest">${att} of ${R.cfg.attest.length} attestations not met</a>` : ''}${dg ? `<span>Back from rework: <a class="govuk-link" href="#/changes">${plural(dg.changed, 'number', 'numbers')} changed${dg.off ? ', ' + plural(dg.off, 'mark', 'marks') + ' came off' : ''}</a>; <a class="govuk-link" href="#/comments">${plural(dg.comments, 'comment', 'comments')}</a>.</span>` : ''}${ctx.voidLine || ''}<details class="govuk-details app-why"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Why this tier</span></summary><div class="govuk-details__text"><p class="govuk-body-s">${esc(R.cfg.tierWhy)}</p><ul class="govuk-list govuk-list--bullet govuk-body-s">${R.cfg.tierRules.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></details></div></div>`;

  const tiles = R.six.map((id) => {
    const l = R.byId[id];
    const prior = l.ly !== null && l.ly !== undefined;
    return `<li class="app-tile"><a class="govuk-link" href="${route(R, id)}">${esc(l.label)}</a><div class="app-tile__value">${money(l.cy)}${madeTag(l)}</div><div class="app-tile__small">${prior ? `Last year ${money(l.ly)}<br><span class="govuk-visually-hidden">Change </span>${chg(l)}` : `No prior year (${R.cfg.firstYear ? 'first year' : 'none on file'})`}</div>${l.unconfirmed ? '<div class="app-state">Not confirmed in Taxprep yet</div>' : ''}</li>`;
  }).join('');

  const flagRows = R.flags.map((f) => `<tr><td class="govuk-table__cell" data-sort-value="${flagKey(f)}"><a class="govuk-link" href="#/flags/${f.id}">${esc(f.num)} ${esc(f.title)}</a><span class="app-meta">${H.flagTier(f.tier)}${f.kind === 'accepted' ? ' ' + H.kind('accepted') : ''}</span></td><td class="govuk-table__cell app-money" data-sort-value="${effectKey(f)}">${f.effect === null ? 'Not stated' : money(f.effect)}</td><td class="govuk-table__cell" data-sort-value="${esc(f.taxShort.toLowerCase())}">${esc(f.taxShort)}</td><td class="govuk-table__cell" data-sort-value="k${KIND_RANK[f.kind]}-${f.id}">${PREP_SHORT[f.kind]}: ${esc(f.short)}</td>${ctx.canJudge ? `<td class="govuk-table__cell" data-sort-value="Not judged"><strong data-flag-state="${f.id}"></strong></td>` : ''}</tr>`).join('');

  const tc = topChanges(R);
  const link = (l) => `<a class="govuk-link" href="${route(R, l.id)}">${esc(l.label)}</a>`;
  const topRows = tc.top.map((l) => `<tr><th scope="row" class="govuk-table__header">${link(l)}</th><td class="govuk-table__cell app-money">${val(l, l.cy)}</td><td class="govuk-table__cell app-money">${val(l, l.ly)}</td><td class="govuk-table__cell app-money">${chg(l)}</td></tr>`).join('');
  const names = (arr) => (arr.length ? arr.map(link).join(', ') : 'none');
  const top = tc.none
    ? `<h2 class="govuk-heading-s">Changes since last year</h2><div class="govuk-inset-text app-inset-tight"><p class="govuk-body"><strong>No prior year to compare.</strong> This is the first year of the corporation, so there are no changes since last year to rank.</p></div>`
    : `<table class="govuk-table app-changes"><caption class="govuk-table__caption govuk-table__caption--s">Ten largest changes since last year, by dollar amount (${tc.top.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header app-money">This year</th><th scope="col" class="govuk-table__header app-money">Last year</th><th scope="col" class="govuk-table__header app-money">Change</th></tr></thead><tbody class="govuk-table__body">${topRows}</tbody></table><p class="govuk-body-s govuk-!-margin-bottom-1">New this year (${tc.news.length}): ${names(tc.news)}.</p><p class="govuk-body-s">Gone since last year (${tc.gone.length}): ${names(tc.gone)}.</p>`;

  const warns = R.cfg.warnings.map((w) => `<li>${esc(w.text)}: ${w.reason ? esc(w.reason) : '<strong>no written reason from the preparer</strong>'}</li>`).join('');
  const attest = `<h2 class="govuk-heading-s" id="attest-h" tabindex="-1">Attestations (${R.cfg.attest.length})</h2><ul class="app-att">${R.cfg.attest.map((a) => `<li>${a.ok ? H.tag('Met', 'green') : H.tag('Not met', 'red')} ${esc(a.text)}${a.key === 'diag' ? `<ul class="app-lines">${warns}</ul>` : ''}</li>`).join('')}</ul>`;

  return `<div data-panel="brief" hidden class="app-brief">
${ctx.alert || ''}${strip}
<h2 class="govuk-heading-s app-h2">The return in six numbers, against last year <span class="app-madeup-note">Values marked Made up are not in the sample clients yet.</span></h2>
<ul class="app-tiles">${tiles}</ul>
<div class="app-scroll" role="region" aria-label="Pinned flags"><table class="govuk-table govuk-!-margin-bottom-0" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-table__caption--s" data-count="flags" data-scope="flags">Pinned flags: red first, then dollar effect (${R.flags.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header" aria-sort="ascending">Flag</th><th scope="col" class="govuk-table__header app-money" aria-sort="none">Dollar effect</th><th scope="col" class="govuk-table__header" aria-sort="none">Tax effect</th><th scope="col" class="govuk-table__header" aria-sort="none">Preparer's answer</th>${ctx.canJudge ? '<th scope="col" class="govuk-table__header" aria-sort="none">Your judgment</th>' : ''}</tr></thead><tbody class="govuk-table__body">${flagRows}</tbody></table></div>
<div class="app-brief2">
<div>${top}</div>
<div>${attest}<h2 class="govuk-heading-s">Assumptions and client decisions (${R.cfg.assumptions.length})</h2><ul class="app-lines">${R.cfg.assumptions.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
</div>
</div>`;
}

// ---------------------------------------------------------------- Approve (RV-10): what remains as links, then the button; filled in by the script from the marks and judgments
export const approvePanel = () => '<div data-panel="approve" hidden class="app-approve"><div data-approve-body></div></div>';

// ---------------------------------------------------------------- the AI fix drafts (RV-12, V13): read-only cards, no approve control
export function draftsHtml(R0, scn) {
  const rw = R0.cfg.rework;
  if (!rw || scn.cs === 'none' || scn.cs === 'draft') return '';
  const drafts = rw.ai;
  return `<section class="app-drafts" aria-labelledby="drafts-h"><h2 class="govuk-heading-s" id="drafts-h">AI fix drafts for simple comments (${drafts.length})</h2><p class="govuk-body-s">Read-only. AI only drafts: it changes nothing, approves nothing and resolves nothing. Only ${esc(R0.cfg.preparer)} can approve a draft, in the preparer's own screen, and the change then goes through the normal round trip (RV-12).</p><ul class="app-draftlist">${drafts.map((d) => {
    const approved = d.approved || scn.cs === 'resolved';
    const state = approved ? (d.approved ? d.state : 'Approved by ' + R0.cfg.preparer + ', 10 Mar 2026, 15:02') : d.state;
    return `<li class="app-draft"><div class="app-draft__head">${H.tag('AI draft', 'purple')} <strong>${esc(d.id)}</strong> for comment ${esc(d.for)}: ${esc(d.title)}</div><ol class="app-lines">${d.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p class="govuk-body-s govuk-!-margin-bottom-1"><strong>Citations, checked by code:</strong></p><ul class="app-lines">${d.cites.map((c) => `<li>${esc(c)}</li>`).join('')}</ul><p class="govuk-body-s govuk-!-margin-bottom-0"><strong>State:</strong> ${esc(state)}</p></li>`;
  }).join('')}</ul></section>`;
}

// ---------------------------------------------------------------- comments (RV-7) with the preparer's answers
export function commentsView(R, scn, ctx) {
  return `<div data-view="comments" hidden tabindex="0" role="region" aria-label="Comments">
<div class="app-narrow app-narrow--wide"><div data-comments-list></div>
${ctx.drafts}
${ctx.canComment ? '<div data-sendback></div>' : ''}</div>
</div>`;
}

// ---------------------------------------------------------------- history
export function historyView(R, scn, ctx) {
  const built = R.lines.filter((l) => l.kind !== 'sub' && !l.madeUp).length;
  const ev = R.cfg.history.map((e) => [e[0], e[1], e[2], e[3].replace('@NUMBERS numbers', built + ' numbers')]);
  const rw = R.cfg.rework;
  if (ctx.canAct) {
    if (scn.kind === 'rework') {
      ev.push(['10 Mar 2026, 10:31', 'Five sections marked Reviewed', 'Zo', 'Schedule 1 to Dividend accounts. Statements and GIFI was marked first, at 09:42.']);
      ev.push(['10 Mar 2026, 10:40', 'Returned to the preparer', 'Zo', 'Comments C-1 to C-4.']);
      ev.push([rw.when, 'Preparer changed two numbers', rw.who, 'Moved $180.00 from Office expenses to Software and computer expenses (answering C-2). The Statements and GIFI mark came off.']);
      ev.push([rw.back, 'Back for review', rw.who, 'AI draft D-1 approved by the preparer; D-2 waits for the preparer.']);
    }
    if (R.which !== 'red') {
      const nameOf = (k) => (SECTIONS.find((s) => s.key === k) || UNPLACED).title;
      for (const [k, m] of Object.entries(scn.marks)) if (Array.isArray(m)) ev.push([m[1], `${nameOf(k)} marked Reviewed`, m[0], '']);
    }
    if ((scn.kind === 'gate' || scn.kind === 'ready') && rw) {
      ev.push(['10 Mar 2026, 10:40', 'Returned to the preparer', 'Zo', 'Comments C-1 to C-4.']);
      ev.push([rw.when, 'Preparer changed two numbers', rw.who, 'Moved $180.00 from Office expenses to Software and computer expenses (answering C-2). The Statements and GIFI mark came off.']);
      ev.push([rw.back, 'Back for review', rw.who, 'AI drafts D-1 and D-2 approved by the preparer.']);
      ev.push(['10 Mar 2026, 15:19', 'All four comments resolved', 'Zo', '']);
      ev.push(['10 Mar 2026, 15:25', 'Statements and GIFI marked Reviewed again', 'Zo', scn.kind === 'ready' ? 'Every section is Reviewed and every accepted risk is judged. Approve shows.' : 'Every section is Reviewed. Two accepted risks are not judged yet, so Approve is absent.']);
    }
    for (const [id, j] of Object.entries(scn.judg || {})) ev.push([j.when, j.kind === 'accept' ? `Accepted risk ${id} judged: accepted` : `Accepted risk ${id} judged: commented instead`, 'Zo', j.kind === 'accept' ? j.reason : `Comment ${j.comment}.`]);
    if (scn.kind === 'void') {
      const vd = R.cfg.void;
      ev.push([vd.approved, 'Return approved', 'Zo', 'Every section Reviewed.']);
      ev.push([vd.when, 'Approval void', 'System', `Books changed after approval: entry ${vd.entry} by ${vd.by}. Marks came off in the sections that hold changed numbers.`]);
    }
  } else {
    for (const re of [/Brief opened/, /marked Reviewed/, /Comment C-1/]) { const k = ev.findIndex((e) => re.test(e[1])); if (k > -1) ev.splice(k, 1); }
  }
  const stamp = (s) => Date.parse(s.replace(',', ''));
  ev.sort((a, b) => stamp(a[0]) - stamp(b[0]));
  const item = ([when, title, who, desc]) => `<div class="moj-timeline__item"><div class="moj-timeline__header"><h3 class="moj-timeline__title">${esc(title)}</h3><p class="moj-timeline__byline">by ${esc(who)}</p></div><p class="moj-timeline__date"><time>${esc(when)}</time></p>${desc ? `<div class="moj-timeline__description"><p class="govuk-body">${esc(desc)}</p></div>` : ''}</div>`;
  return `<div data-view="history" hidden tabindex="0" role="region" aria-label="History"><div class="app-narrow"><div class="moj-timeline" data-timeline>${ev.map(item).join('')}</div></div></div>`;
}

// ---------------------------------------------------------------- changes: after rework (RV-7) and after a void (FLOW-5): only the changed cells, before and after
export function changesView(R, scn, ctx) {
  const v = ctx.view;
  if (!v.changed.length) return '';
  const isVoid = scn.kind === 'void';
  const secOf = (id) => (SECTIONS.find((s) => s.key === R.byId[id].section) || UNPLACED);
  const rows = v.changed.map((id) => `<tr><th scope="row" class="govuk-table__header">${esc(R.byId[id].label)}</th><td class="govuk-table__cell">${esc(secOf(id).title)}</td><td class="govuk-table__cell app-money">${money(v.before[id])}</td><td class="govuk-table__cell app-money">${money(R.byId[id].cy)}</td><td class="govuk-table__cell app-money">${chg({ cy: R.byId[id].cy, ly: v.before[id] })}</td><td class="govuk-table__cell"><a class="govuk-link" href="${route(R, id)}">Open the number</a></td></tr>`).join('');
  const dg = ctx.digest;
  const held = sectionsHolding(R, v);
  const offList = held.map((k) => { const s = SECTIONS.find((x) => x.key === k); return `<li data-off-item="${k}"><a class="govuk-link" href="#/${s.slug}">${esc(s.title)}</a>: a number in it changed. <span data-off-state="${k}"></span></li>`; }).join('');
  const row = (k, v2) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${k}</dt><dd class="govuk-summary-list__value">${v2}</dd></div>`;
  const head = isVoid
    ? `<dl class="govuk-summary-list app-digest">${row('Approved', esc(R.cfg.void.approved) + ' by Zo')}${row('Void since', `${esc(R.cfg.void.when)}, by ${esc(R.cfg.void.by)}, entry ${esc(R.cfg.void.entry)}`)}${row('Numbers changed', `${v.changed.length}, listed below`)}${row('Marks that came off', `${plural(held.length, 'section', 'sections')}, listed below`)}${row('What happens next', 'Nothing for you to do yet. The preparer fixes or confirms the books and sends the return back. Then you mark the sections again and approve.')}</dl>`
    : `<dl class="govuk-summary-list app-digest">${row('Round', `Second review. Sent back ${esc(dg.sent)}; back ${esc(dg.back)} from ${esc(dg.who)}`)}${row('Numbers changed', `${v.changed.length}, listed below`)}${row('Marks that came off', `${plural(held.length, 'section', 'sections')}, listed below`)}${row('Comments', `${dg.comments}: ${esc(countsText(dg.counts))}. <a class="govuk-link" href="#/comments">Open the comments</a>`)}${row('AI fix drafts', `${dg.drafts}: ${dg.draftsApproved} approved by the preparer, ${dg.drafts - dg.draftsApproved} waiting for the preparer`)}</dl>`;
  return `<div data-view="changes" hidden tabindex="0" role="region" aria-label="Changes"><div class="app-narrow app-narrow--wide">
<h2 class="govuk-heading-s">${isVoid ? 'What changed after you approved' : 'The fix round in one place'}</h2>${head}
<div class="app-scroll-x" role="region" aria-label="Changed numbers" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">${isVoid ? 'Numbers changed after approval, before and after' : 'Changed numbers, before and after'} (${v.changed.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header app-money">Before</th><th scope="col" class="govuk-table__header app-money">After</th><th scope="col" class="govuk-table__header app-money">Change</th><th scope="col" class="govuk-table__header">Source</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table></div>
${isVoid ? `<p class="govuk-body">${esc(R.cfg.void.why)}</p>` : `<p class="govuk-body">Changed by ${esc(R.cfg.rework.who)}, ${esc(R.cfg.rework.when)}, answering C-2. Total expenses and net income did not change.</p>`}
<h2 class="govuk-heading-s">Sections whose mark came off (${held.length})</h2><ul class="govuk-list govuk-list--bullet">${offList}</ul>
<p class="govuk-body">Every other section keeps its mark.</p></div></div>`;
}
