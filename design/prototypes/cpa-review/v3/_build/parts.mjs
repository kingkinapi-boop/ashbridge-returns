// Pieces of the record page: the sections, the flags, the trace and the sources. Only govuk-, moj- and app- classes. No inline style.
import { esc, money, SECTIONS, UNPLACED } from './model.mjs';
import { H, chg, chgPct, val, madeTag, sourceBody, sourceCaption, statusOf, markEvidence } from './ui.mjs';

export const SLUG = Object.fromEntries([...SECTIONS, UNPLACED].map((s) => [s.key, s.slug]));
export const route = (R, id) => `#/${SLUG[R.byId[id].section]}/${id}`;
export const PREP_WORD = { fixed: 'Fixed by the preparer', explained: 'Explained by the preparer, with a source', accepted: 'Accepted risk: left for you to judge' };

const lastYear = (l) => (l.ly === null || l.ly === undefined ? 'No prior year' : `Last year ${val(l, l.ly)}, ${chgPct(l)}`);

// ---------------------------------------------------------------- one section of the return, in printed order (RV-1), never sortable
export function rowsFor(R, sec, lines, ctx) {
  const tier = R.cfg.tier;
  let group = null, rows = '';
  for (const l of lines) {
    const g = sec.key === 'stmt' ? (l.group === 'Total' ? null : (l.part === 'bs' ? 'Balance sheet: ' : 'Income statement: ') + l.group) : l.group === 'Total' ? null : l.group;
    if (g && g !== group) { group = g; rows += `<tr class="app-row--group"><td colspan="2"><strong>${esc(g)}</strong></td></tr>`; }
    const flags = l.flagIds.map((id) => { const f = R.flags.find((x) => x.id === id); return `<a class="app-flagmark" href="#/flags/${id}">Flag ${esc(id.slice(-3))}<span class="govuk-visually-hidden"> ${esc(f.tier)}: ${esc(f.title)}</span></a>`; }).join('');
    const reworked = l.reworked ? ' ' + H.tag(ctx.changedTag, 'purple') : '';
    const big = tier === 'red' && l.changed && !l.reworked ? ' ' + H.tag('Large change', 'yellow') : '';
    const five = tier === 'amber' && l.top5 ? ' ' + H.tag('One of the five largest', 'grey') : '';
    const cls = [l.kind === 'sub' ? 'app-row--sub' : '', l.flagIds.length ? 'app-row--flag' : '', (l.hl && !l.flagIds.length && l.kind !== 'sub') ? 'app-row--hl' : '', (l.changed || l.reworked) && tier === 'red' ? 'app-row--changed' : ''].filter(Boolean).join(' ');
    rows += `<tr class="${cls}" data-row="${l.id}" data-section="${sec.key}" data-label="${esc(l.label)}"${l.flagIds.length ? ' data-flagged' : ''}><th scope="row" class="govuk-table__header"><button type="button" class="app-rowbtn" data-pick>${esc(l.label)}${l.acct ? ' <span class="govuk-visually-hidden">account ' + l.acct + '</span>' : ''}</button>${madeTag(l)}<span class="app-meta">${H.dot(l.dot)}${flags}${big}${five}${reworked}</span></th><td class="app-money">${val(l, l.cy)}<br><span class="app-change${l.changed || l.reworked ? ' app-change--big' : ''}">${lastYear(l)}</span></td></tr>`;
  }
  return `<table class="govuk-table app-return"><caption class="govuk-table__caption govuk-visually-hidden">${esc(sec.title)}, year ended ${esc(R.ye)}, in printed order</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number and status</th><th scope="col" class="govuk-table__header app-money">This year, last year and change</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table>`;
}

// ---------------------------------------------------------------- schedules not drawn as structured views (RV-9), an empty section, forms not yet placed
export function printedPanel(R, sec) {
  const pages = R.printed[sec.key];
  return `<div class="app-printed" data-printed="${sec.key}"><p class="app-ref">${esc(sec.ref)}. Not drawn as a structured view: the printed return's pages, with a mark like every other section (RV-9).</p>
${pages.map((p, i) => `<section class="app-page" data-page="${sec.key}:${i}"${i ? ' hidden' : ''} aria-label="Printed return page ${p.no} of ${p.of}"><p class="app-caption">Printed return, page ${p.no} of ${p.of}: ${esc(p.title)} (page ${i + 1} of ${pages.length} for this section)</p><table class="app-printed__table" data-evidence><caption class="govuk-visually-hidden">${esc(p.title)}</caption><tbody>${p.rows.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td class="app-num">${esc(b)}</td></tr>`).join('')}</tbody></table></section>`).join('')}
<div class="app-pagebtns"><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-page-prev>Previous page</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-page-next>Next page</button></div></div>`;
}
export function emptyPanel(R, sec) {
  return `<div class="app-printed" data-printed="${sec.key}"><p class="app-ref">${esc(sec.ref)}.</p><div class="govuk-inset-text" data-evidence><p class="govuk-body"><strong>Nothing in this return for this section.</strong></p><p class="govuk-body">${esc(R.empty[sec.key])}</p></div><p class="govuk-body-s">An empty section still needs its mark, so a skipped section never looks reviewed (RV-9).</p></div>`;
}
export function unplacedPanel(R, sec) {
  const rows = R.unplaced.map((u) => `<tr><th scope="row" class="govuk-table__header">form not placed: ${esc(u.form)}</th><td class="govuk-table__cell">${esc(u.why)}</td></tr>`).join('');
  return `<div class="app-printed" data-printed="${sec.key}" data-evidence><p class="app-ref">${esc(sec.ref)}. Each form is named in the Approve list until this section has its mark.</p><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Forms not yet placed (${R.unplaced.length})</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Form</th><th scope="col" class="govuk-table__header">Why it is here</th></tr></thead><tbody class="govuk-table__body">${rows}</tbody></table><p class="govuk-body-s">The data file that places forms in sections does not name these yet. They are shown so none is skipped silently.</p></div>`;
}

// ---------------------------------------------------------------- the flags (EX-4: red first, then dollar effect; more than 5 rows, so an MOJ sortable table, rule 6)
// The default order is one sort value on the first column: tier (red, amber, green), then the larger dollar effect, then the number.
export const TIER_RANK = { red: 1, amber: 2, green: 3 };
export const KIND_RANK = { accepted: 1, explained: 2, fixed: 3 };
export const flagKey = (f) => `k${TIER_RANK[f.tier]}-${String(99999999999 - Math.round((f.effect || 0) * 100)).padStart(11, '0')}-${f.id}`;
export const effectKey = (f) => (f.effect === null ? -1 : f.effect);
export function flagsPanel(R, ctx) {
  const rows = R.flags.map((f) => {
    const state = ctx.canJudge ? `<td data-sort-value="Not judged"><strong data-flag-state="${f.id}"></strong></td>` : '';
    return `<tr data-row="${f.id}" data-section="flags" data-label="${esc(f.id + ' ' + f.title)}" data-flagged class="${f.tier === 'red' ? 'app-row--flag' : ''}"><th scope="row" class="govuk-table__header" data-sort-value="${flagKey(f)}"><button type="button" class="app-rowbtn" data-pick>${esc(f.id.slice(-3))} ${esc(f.title)}</button><span class="app-meta">${H.flagTier(f.tier)} ${H.kind(f.kind)}</span></th><td class="app-money" data-sort-value="${effectKey(f)}">${f.effect === null ? 'Not stated' : money(f.effect)}</td>${state}</tr>`;
  }).join('');
  return `<table class="govuk-table app-return" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-visually-hidden">Flags: red first, then dollar effect (EX-4)</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header" aria-sort="ascending">Flag and what the preparer did</th><th scope="col" class="govuk-table__header app-money" aria-sort="none">Dollar effect</th>${ctx.canJudge ? '<th scope="col" class="govuk-table__header" aria-sort="none">Your judgment</th>' : ''}</tr></thead><tbody class="govuk-table__body">${rows}</tbody></table>`;
}

// ---------------------------------------------------------------- the trace of one number
export function traceBody(R, l, ctx) {
  const fl = l.flagIds.map((id) => R.flags.find((f) => f.id === id));
  const srcs = l.srcs;
  const agrees = [];
  if (l.kind !== 'sub' && !l.pct && l.acct) {
    agrees.push(['QuickBooks balance (test company)', money(l.cy), 'Agrees']);
    agrees.push([`Taxprep GIFI ${l.gifi}`, money(l.cy), 'Agrees']);
    if (l.dot === 'amber') agrees.push(['Statement pages for every transaction', 'Two items have no page', 'Does not agree: partly traced']);
    if (l.dot === 'grey') agrees.push(['Statement pages for every transaction', 'None found', 'Not checked: no evidence']);
  } else if (l.id === 'n-net-income') agrees.push(['Schedule 1, first line', money(l.cy), 'Agrees']);
  else if (l.id === 'n-total-assets' || l.id === 'n-total-le') agrees.push(['Total liabilities and equity', money(R.byId['n-total-le'].cy), 'Agrees']);
  else agrees.push(['Taxprep', money(l.cy), 'Agrees']);
  const srcRows = srcs.length ? srcs.map((s, k) => { const [d] = statusOf(s); return `<li><button type="button" class="app-rowbtn" data-goto="${k}">${k + 1}. ${esc(sourceCaption(s, k, srcs.length).replace(/ \(source.*$/, ''))}</button> ${H.dot(d)}</li>`; }).join('') : `<li>${H.dot('grey')} No sources found.</li>`;
  const ly = l.ly === null || l.ly === undefined ? `No prior year (${R.cfg.firstYear ? 'first year of the corporation' : 'none on file'})` : `${val(l, l.ly)}, change ${chg(l)}`;
  const was = ctx.before[l.id] !== undefined && l.reworked ? `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${esc(ctx.changedTag)}</dt><dd class="govuk-summary-list__value">Was ${val(l, ctx.before[l.id])}, now ${val(l, l.cy)}. <a class="govuk-link" href="#/changes">See the changes</a></dd></div>` : '';
  return `<div data-trace="${l.id}" hidden>
<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${esc(l.label)}: ${val(l, l.cy)}${madeTag(l)}</h3>
<dl class="govuk-summary-list govuk-summary-list--no-border">
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Status</dt><dd class="govuk-summary-list__value">${H.dot(l.dot)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Built from</dt><dd class="govuk-summary-list__value">${esc(l.built)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Last year</dt><dd class="govuk-summary-list__value">${ly}${(l.part === 'is' || l.madeUp) && l.ly !== null && l.ly !== undefined ? '<br><span class="govuk-hint govuk-!-margin-bottom-0">Last year is made up for the test.</span>' : ''}</dd></div>
${was}${fl.length ? `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Flags</dt><dd class="govuk-summary-list__value">${fl.map((f) => `<a class="govuk-link" href="#/flags/${f.id}">${esc(f.id)} ${esc(f.title)}</a>`).join('<br>')}</dd></div>` : ''}
</dl>
<h4 class="govuk-heading-s govuk-!-margin-bottom-1">Sources${l.total && l.total > 3 ? ` (largest 3 of ${l.total} transactions)` : ''}</h4><ol class="app-sources">${srcRows}</ol>
<h4 class="govuk-heading-s govuk-!-margin-bottom-1">Agrees with</h4><dl class="govuk-summary-list govuk-summary-list--no-border">${agrees.map(([a, b, c]) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${esc(a)}</dt><dd class="govuk-summary-list__value">${esc(b)}: ${esc(c)}</dd></div>`).join('')}</dl>
${ctx.canComment ? `<h4 class="govuk-heading-s govuk-!-margin-bottom-1">Comments on this number</h4><div data-notes="${l.id}"></div>` : ''}
</div>`;
}

export function flagTrace(R, f, ctx) {
  return `<div data-trace="${f.id}" hidden>
<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${esc(f.id)} ${esc(f.title)}</h3>
<p class="govuk-!-margin-bottom-1">${H.flagTier(f.tier)} ${H.kind(f.kind)}</p>
${ctx.canJudge && f.kind === 'accepted' ? `<div data-judge="${f.id}"></div>` : ''}
<dl class="govuk-summary-list govuk-summary-list--no-border">
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Preparer</dt><dd class="govuk-summary-list__value">${PREP_WORD[f.kind]}</dd></div>
${ctx.canJudge ? `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">You</dt><dd class="govuk-summary-list__value"><strong data-flag-state="${f.id}"></strong></dd></div>` : ''}
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Dollar effect</dt><dd class="govuk-summary-list__value">${esc(f.effectText)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Tax effect</dt><dd class="govuk-summary-list__value">${esc(f.taxText)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Preparer's answer</dt><dd class="govuk-summary-list__value">${esc(f.answer)}</dd></div>
<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Evidence cited</dt><dd class="govuk-summary-list__value">${esc(f.cites)}. The source pane shows the cited evidence (${f.evidence.length} item${f.evidence.length === 1 ? '' : 's'}). <a class="govuk-link" href="${route(R, f.where)}">Open the number it sits on</a></dd></div>
</dl>
</div>`;
}

// ---------------------------------------------------------------- every source, hidden until chosen (the same markup fills the second window)
export function sourceHost(R, ctx = {}) {
  const keyed = [...R.lines.map((l) => ({ id: l.id, srcs: l.srcs, label: l.label })), ...R.flags.map((f) => ({ id: f.id, srcs: f.evidence, label: f.title, flag: true }))];
  return keyed.map(({ id, srcs, label, flag }) => {
    if (!srcs.length) return `<div data-srcset="${id}" data-nosource hidden><div class="app-card" data-evidence><h4>Not checked: no evidence</h4><p>No statement page, entry, client answer or capture was found for this number (CK-2). It stays marked "Not checked: no evidence" until something is attached.</p><p class="govuk-body-s">The sources list is empty, so there is no boxed figure to show.</p>${ctx.canComment ? '<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-comment-kind="Missing evidence">Comment: missing evidence</button>' : ''}</div></div>`;
    const n = srcs.length;
    return `<div data-srcset="${id}" data-count="${n}" hidden>${srcs.map((s, k) => `<section data-source="${id}:${k}" hidden aria-label="${flag ? 'Evidence' : 'Source'} ${k + 1} of ${n} for ${esc(label)}"><p class="app-caption">${esc(flag ? 'Cited evidence: ' : '')}${esc(sourceCaption(s, k, n))}</p>${markEvidence(sourceBody(s))}</section>`).join('')}</div>`;
  }).join('');
}
