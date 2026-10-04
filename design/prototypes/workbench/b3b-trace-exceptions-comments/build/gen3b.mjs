// Generates record.html (Maple Ridge) and record-eglinton.html from version B's record.html (the base, unchanged),
// replacing the Trace, Exceptions and CPA comments views and their panes. Run: node design/prototypes/workbench/b3b-trace-exceptions-comments/build/gen3b.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAPLE, EGLINTON, UNIT } from './data3b.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(here, '..')
const BASE = fs.readFileSync(path.join(OUT, '..', 'b-split-pane', 'record.html'), 'utf8').split('\n')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const tag = (c, t) => `<strong class="govuk-tag govuk-tag--${c}">${t}</strong>`
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const money = (n) => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PAGER = '<div class="app-pager"><button type="button" class="govuk-button govuk-button--secondary" data-nav="prev" aria-keyshortcuts="p">Previous</button><button type="button" class="govuk-button govuk-button--secondary" data-nav="next" aria-keyshortcuts="n">Next</button><span class="govuk-body-s" data-pos></span></div>'
const SUMMARY = '<div class="govuk-error-summary" data-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"></ul></div></div></div>'
const REQ = '<span class="app-req" aria-hidden="true">*</span><span class="govuk-visually-hidden"> (required)</span>'
const VIEWER = '<div data-pane-empty hidden><p class="govuk-body">Nothing selected.</p></div><div class="app-viewer" data-viewer hidden><div class="app-viewer__head"><h3 class="govuk-heading-s" data-viewer-title></h3><button type="button" class="govuk-button govuk-button--secondary" data-src-window aria-label="Send to second window">Second window</button></div><div class="app-viewer__box" data-viewer-box data-evidence tabindex="0" role="region" aria-label="Source excerpt, scrollable"></div><p class="govuk-body-s app-viewer__cap" data-viewer-caption></p><p class="govuk-body-s app-viewer__status" data-src-status role="status"></p></div>'

const item = (id, src, label, inner) => `<section class="app-item" data-compact data-item="${id}" data-src="${src}" aria-label="${esc(label)}" hidden>${PAGER}${inner}</section>`
const head1 = (title, extra = '') => `<h2 class="govuk-heading-s">${esc(title)}</h2><p class="govuk-body"><span data-state-slot></span>${extra ? ' ' + extra : ''}</p>`
const head = (title, text) => `<h2 class="govuk-heading-s">${esc(title)}</h2><p class="govuk-body"><span data-state-slot></span></p><p class="govuk-body">${text}</p>`
const textarea = (id, name, msg, extra = '', desc = '') => `<textarea class="govuk-textarea" id="${id}" name="${name}" rows="1" data-grow data-req data-msg="${esc(msg)}" ${extra} aria-describedby="${desc} ${id}-error"></textarea>`
const group = (label, body, id, hint, inline = false) => `<div class="govuk-form-group${inline ? ' app-inline-field' : ''}"><label class="govuk-label" for="${id}">${label} ${REQ}</label>${hint ? `<div class="govuk-hint" id="${id}-hint">${hint}</div>` : ''}<p class="govuk-error-message" id="${id}-error" hidden></p>${body}</div>`

// ---------------------------------------------------------------- Trace
const KIND = { cca: 'CCA claim', div: 'Dividend designation', elect: 'Election', bl: 'Business limit share', loss: 'Loss or donation claim' }
const CLASS_TAG = { orphan: ['yellow', 'Orphan'], overridden: ['orange', 'Overridden'], dropped: ['red', 'Dropped'], changed: ['red', 'Changed outside the trace'] }

function traceRow(c) {
  const open = !c.done
  const [col, word] = c.done ? ['green', c.done] : CLASS_TAG[c.cls]
  const needsText = c.done ? c.doneText : c.needs
  const needs = c.kind
    ? `${tag('turquoise', KIND[c.kind])} Tax choice: ${needsText}`
    : needsText
  const state = c.done ? tag(col, word) : c.cls === 'changed'
    ? `${tag(col, word)} <span class="govuk-visually-hidden">needs action</span><br><span class="govuk-body-s">Flagged for a person</span>`
    : `${tag(col, word)} <span class="govuk-visually-hidden">needs action</span>`
  return `<tr class="govuk-table__row${c.cls === 'changed' ? ' app-row-flag' : ''}" data-id="${c.id}"${open ? ' data-open="1"' : ''} data-class="${c.cls}" data-kind="${c.kind ? 'tax' : 'any'}"><th scope="row" class="govuk-table__header" data-sort-value="${esc(c.cell.toLowerCase())}"><button type="button" class="app-linkbtn" data-row>${esc(c.cell)}</button></th><td class="govuk-table__cell app-tabular">${c.value}</td><td class="govuk-table__cell" data-state data-sort-value="${c.cls} needs action">${state}</td><td class="govuk-table__cell">${needs}</td></tr>`
}
function groupTable(title, cols, rows, noteWord) {
  const th = cols.map((c, i) => `<th scope="col" class="govuk-table__header${i === 1 ? ' app-numeric' : ''}">${c}</th>`).join('')
  const body = rows.map((r) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${esc(r[0])}</th><td class="govuk-table__cell app-tabular">${esc(r[1])}</td><td class="govuk-table__cell">${esc(r[2])}</td></tr>`).join('')
  return `<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">${title}: ${rows.length} ${rows.length === 1 ? 'cell' : 'cells'}, ${noteWord}</span></summary><div class="govuk-details__text"><div class="app-scroll" role="region" aria-label="${esc(title)}, scrollable" tabindex="0"><table class="govuk-table app-dense"><caption class="govuk-table__caption govuk-visually-hidden">${esc(title)}: cells that need no action</caption><thead class="govuk-table__head"><tr class="govuk-table__row">${th}</tr></thead><tbody class="govuk-table__body">${body}</tbody></table></div></div></details>`
}
const GROUPS = [
  ['traced', 'Traced', 'imported and unchanged'],
  ['rolled', 'Rolled forward', 'equal to last year\'s return facts'],
  ['calculated', 'Calculated', 'review lines worked out by Taxprep'],
  ['allowed', 'Allowed typing', 'Taxprep settings and e-file options'],
  ['linked', 'Linked from another return', 'written by Import and link corporations'],
  ['cra', 'Imported from CRA', 'Auto-fill, not edited'],
  ['rounding', 'Rounding', 'keeps Schedule 100 balanced']
]
function traceCounts(ds) {
  const open = ds.rows
  const n = (cls) => open.filter((r) => r.cls === cls).length
  const g = (k) => (ds.groups[k] || []).length
  const parts = [['traced', g('traced') + (ds.extraTraced || 0)], ['overridden', n('overridden')], ['dropped', n('dropped')], ['rolled forward', g('rolled')], ['orphan', n('orphan')], ['calculated', g('calculated')], ['allowed typing', g('allowed')], ['linked from another return', g('linked')], ['imported from CRA', g('cra')], ['rounding', g('rounding')]]
  const total = parts.reduce((a, p) => a + p[1], 0)
  return { total, text: parts.map((p) => `${p[0]} ${p[1]}`).join(', ') }
}
function traceBody(ds, k) {
  const counts = traceCounts(ds)
  const changed = ds.rows.some((r) => r.cls === 'changed')
  const body = ds.rows.map(traceRow).join('')
  const groups = GROUPS.filter((g) => (ds.groups[g[0]] || []).length).map((g) => groupTable(g[1], ['Cell', 'Value', 'Where it comes from'], ds.groups[g[0]], g[2])).join('')
  const nTax = ds.rows.filter((r) => r.kind).length
  return `<p class="govuk-body-s">Of ${counts.total} cells in ${ds.exportName}: ${counts.text}.${changed ? ' One flag: the export changed outside the trace.' : ''} <span data-count="trace" data-scope="open" data-fmt="{n} open: each needs a source, a reason or a fix">${ds.rows.filter((r) => !r.done).length} open: each needs a source, a reason or a fix</span>; ${nTax} tax choices typed in Taxprep are listed with the orphans.</p>
<form class="app-filter-row" data-filter-form role="search" aria-label="Filter cells"><div class="govuk-form-group"><label class="govuk-label" for="tr-q-${k}">Filter cells</label><input class="govuk-input" id="tr-q-${k}" type="search" data-filter-for="trace-table-${k}" data-kind="text"></div><div class="govuk-form-group"><label class="govuk-label" for="tr-c-${k}">Class</label><select class="govuk-select" id="tr-c-${k}" data-filter-for="trace-table-${k}" data-kind="attr" data-attr="class"><option value="all">All classes that need action</option><option value="orphan">Orphan</option><option value="overridden">Overridden</option><option value="dropped">Dropped</option><option value="changed">Changed outside the trace</option></select></div><div class="govuk-form-group"><label class="govuk-label" for="tr-k-${k}">Show</label><select class="govuk-select" id="tr-k-${k}" data-filter-for="trace-table-${k}" data-kind="attr" data-attr="kind"><option value="all">All cells that need action</option><option value="tax">Tax choices only</option></select></div><p class="govuk-body-s app-count-line" data-shown-for="trace-table-${k}">Showing ${ds.rows.length} of ${ds.rows.length}</p></form>
<div data-empty-for="trace-table-${k}" hidden><p class="govuk-body">No cell matches. Clear the filter.</p></div>
<div class="app-scroll" role="region" aria-label="Cells that need action, scrollable" tabindex="0"><table class="govuk-table app-dense" id="trace-table-${k}" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-visually-hidden">Cells that open: each needs a source, a reason or a fix: needs action first, then class, then cell</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header" aria-sort="none">Cell</th><th scope="col" class="govuk-table__header">Value</th><th scope="col" class="govuk-table__header" aria-sort="none">Class</th><th scope="col" class="govuk-table__header">What it needs</th></tr></thead><tbody class="govuk-table__body">${body}</tbody></table></div>
<h2 class="govuk-heading-s govuk-!-margin-top-4">Cells that need no action</h2><p class="govuk-body-s">Opened only when you want to look. Allowed typing and cells linked from another return are checked against the return elsewhere.</p>${groups}`
}
function traceView(maple) {
  const dsT = maple.traced, dsR = maple.rework
  if (!dsR) { return `<div class="app-view" data-view="trace" data-title="Trace: sources and reasons" data-error-in="pane" hidden>${traceBody(dsT, 'traced')}</div>` }
  return `<div class="app-view" data-view="trace" data-title="Trace: sources and reasons" data-error-in="pane" hidden><div data-stage-only="import upload"><div class="govuk-inset-text">The trace starts when the lock export and the printed return are uploaded (<a class="govuk-link" href="#/roundtrip" data-goto="roundtrip">Round trip, step 5</a>).</div></div><div data-stage-only="traced" hidden>${traceBody(dsT, 'traced')}</div><div data-stage-only="rework" hidden>${traceBody(dsR, 'rework')}</div></div>`
}
const traceEmpty = '<div class="app-view" data-view="trace/empty" data-title="Trace: sources and reasons" hidden><h2 class="govuk-heading-s">Nothing needs a source or a reason</h2><p class="govuk-body">Every cell in the lock export is traced, rolled forward, calculated or allowed. No orphan, override, dropped or changed-outside cell is left.</p><p class="govuk-body"><a class="govuk-link" href="#/diagnostics" data-goto="diagnostics">Go to Diagnostics</a></p></div>'

// the cite form (D12): exact value first, "rounds to this value" apart, none preselected, no AI choice
function citeForm(c) {
  const id = c.id
  const radio = (cand, i) => `<div class="govuk-radios__item"><input class="govuk-radios__input" id="${id}-src-${i}" name="${id}-src" type="radio" value="${i}" data-view-src="${cand.src}"${i === 0 ? ` data-req data-msg="Choose a source or write a reason"` : ''}><label class="govuk-label govuk-radios__label" for="${id}-src-${i}">${esc(cand.label)}</label></div>`
  let i = 0
  let list = ''
  const ex = c.exact || [], ro = c.rounds || []
  if (ex.length) { list += `<p class="govuk-body-s app-cor__group" id="${id}-g-exact">Holds this exact value</p>` + ex.map((x) => radio(x, i++)).join('') }
  if (ro.length) { list += `<p class="govuk-body-s app-cor__group" id="${id}-g-round">Rounds to this value</p>` + ro.map((x) => radio(x, i++)).join('') }
  if (!ex.length && !ro.length) list += `<p class="govuk-body-s app-cor__group">No document holds this value.</p>`
  const reasonRadio = `<div class="govuk-radios__item app-cor__row"><input class="govuk-radios__input" id="${id}-src-reason" name="${id}-src" type="radio" value="reason" data-cor-reason-radio${!ex.length && !ro.length ? ' data-req data-msg="Write the reason the CPA will read beside the number"' : ''}><label class="govuk-label govuk-radios__label" for="${id}-src-reason">A written reason</label><div class="govuk-form-group app-cor__reason"><label class="govuk-label govuk-visually-hidden" for="${id}-why">Reason for the CPA (required if you chose a written reason)</label><p class="govuk-error-message" id="${id}-why-error" hidden></p><textarea class="govuk-textarea" id="${id}-why" name="reason" rows="1" data-cor-reason data-req data-msg="Write the reason the CPA will read beside the number" data-req-if="${id}-src-reason" aria-describedby="${id}-why-error"></textarea></div></div>`
  return `<form id="${id}-form" data-form data-cor data-edit data-act="set" data-to="Source saved" data-tag="green" data-say="Source saved" data-closes="1" novalidate>${SUMMARY}<div class="govuk-form-group app-cor"><fieldset class="govuk-fieldset" aria-describedby="${id}-src-error"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Source or reason ${REQ}</legend><p class="govuk-error-message" id="${id}-src-error" hidden></p><div class="govuk-radios govuk-radios--small" data-module="govuk-radios">${list}${reasonRadio}</div></fieldset></div><div class="app-actions"><button type="submit" class="govuk-button" data-module="govuk-button" data-primary>Cite this source</button></div></form>`
}
function traceItem(c) {
  const kindTag = c.kind ? `${tag('turquoise', KIND[c.kind])} ` : ''
  const label = `${c.cell} ${c.valueLabel || c.value}`
  if (c.cls === 'orphan') return item(c.id, c.src, label, head1(label, kindTag.trim()) + citeForm(c))
  if (c.cls === 'overridden') {
    const diff = c.diff
    const side = `<table class="govuk-table app-dense"><caption class="govuk-table__caption govuk-visually-hidden">Imported and typed values side by side</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">${esc(diff.importedHead)}</th><th scope="col" class="govuk-table__header">Typed in Taxprep</th><th scope="col" class="govuk-table__header">Difference</th></tr></thead><tbody class="govuk-table__body"><tr class="govuk-table__row"><td class="govuk-table__cell app-tabular">${diff.imported}</td><td class="govuk-table__cell app-tabular">${diff.typed}</td><td class="govuk-table__cell app-tabular">${diff.delta}</td></tr></tbody></table>`
    const form = `<form id="${c.id}-form" data-form data-edit data-act="set" data-to="Reason saved" data-tag="green" data-say="Reason saved" data-closes="1" novalidate>${SUMMARY}${group('Why was the value changed?', textarea(`${c.id}-why`, 'reason', 'Write why the value was changed', '', ''), `${c.id}-why`, '')}<div class="app-actions"><button type="submit" class="govuk-button" data-module="govuk-button" data-primary>Save the reason</button></div></form>`
    return item(c.id, c.src, label, head(label, c.blurb) + '<p class="govuk-body-s">The CPA reads the reason beside the number.</p>' + side + form)
  }
  if (c.cls === 'dropped') {
    const form = `<form id="${c.id}-form" data-form data-cor data-edit data-act="set" data-to="Explained" data-tag="green" data-say="Explanation saved" data-closes="1" novalidate>${SUMMARY}<div class="govuk-form-group app-cor"><fieldset class="govuk-fieldset" aria-describedby="${c.id}-how-error"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">What will you do? ${REQ}</legend><p class="govuk-error-message" id="${c.id}-how-error" hidden></p><div class="govuk-radios govuk-radios--small" data-module="govuk-radios"><div class="govuk-radios__item"><input class="govuk-radios__input" id="${c.id}-how-0" name="${c.id}-how" type="radio" value="0" data-req data-msg="Choose what you will do"><label class="govuk-label govuk-radios__label" for="${c.id}-how-0">Re-import: restore the cell in Taxprep</label></div><div class="govuk-radios__item app-cor__row"><input class="govuk-radios__input" id="${c.id}-how-reason" name="${c.id}-how" type="radio" value="reason" data-cor-reason-radio><label class="govuk-label govuk-radios__label" for="${c.id}-how-reason">A written reason</label><div class="govuk-form-group app-cor__reason"><label class="govuk-label govuk-visually-hidden" for="${c.id}-why">Why is it blank? (required if you chose a written reason)</label><p class="govuk-error-message" id="${c.id}-why-error" hidden></p><textarea class="govuk-textarea" id="${c.id}-why" name="reason" rows="1" data-cor-reason data-req data-msg="Write why the cell is blank" data-req-if="${c.id}-how-reason" aria-describedby="${c.id}-why-error"></textarea></div></div></div></fieldset></div><div class="app-actions"><button type="submit" class="govuk-button" data-module="govuk-button" data-primary>Save</button></div></form>`
    return item(c.id, c.src, label, head(label, c.blurb) + form)
  }
  // changed outside the trace: no cite form, the fix is in Taxprep
  const acts = `<p class="govuk-body"><a class="govuk-button" role="button" draggable="false" href="#/roundtrip" data-goto="roundtrip" data-module="govuk-button">Go to Round trip: unlock, fix, lock, upload</a></p>`
  const list = `<ul class="govuk-list govuk-list--bullet">${c.cells.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
  return item(c.id, c.src, label, head(c.cell, c.blurb) + `<h3 class="govuk-heading-s">Cells that differ</h3>${list}<p class="govuk-body">Nothing here can be cited or accepted. Unlock the return in Taxprep, fix the cell, lock it again and upload the new lock export.</p>` + acts)
}
const tracePane = (ds) => `<div class="app-paneset" data-view="trace" hidden>${ds.items.map(traceItem).join('')}${VIEWER}</div>`
const tracePaneEmpty = '<div class="app-paneset" data-view="trace/empty" hidden><h2 class="govuk-heading-s">Nothing selected</h2><p class="govuk-body">There is nothing to cite.</p></div>'

// ---------------------------------------------------------------- Exceptions
const LEVEL = { red: ['red', 'Red flag'], amber: ['orange', 'Amber flag'] }
const EXC_STATE = { open: ['yellow', 'Not answered'], answered: ['green', 'Answered'], accepted: ['orange', 'Accepted risk, for the CPA to judge'] }
function excRow(e) {
  const [lc, lw] = LEVEL[e.level]
  const [sc, sw] = EXC_STATE[e.state]
  return `<tr class="govuk-table__row" data-id="${e.id}"${e.state === 'open' ? ' data-open="1"' : ''} data-level="${e.level}" data-effect="${e.effect}"><th scope="row" class="govuk-table__header"><button type="button" class="app-linkbtn" data-row>${esc(e.title)}</button></th><td class="govuk-table__cell">${e.found}</td><td class="govuk-table__cell app-numeric app-tabular" data-sort-value="${e.effect}">${money(e.effect)}</td><td class="govuk-table__cell" data-sort-value="${e.level === 'red' ? 2 : 1}">${tag(lc, lw)}</td><td class="govuk-table__cell" data-state>${tag(sc, sw)}</td></tr>`
}
function excItem(e) {
  const [lc, lw] = LEVEL[e.level]
  const radios = [['fixed', 'Fixed', 'I fixed it in the return'], ['explained', 'Explained', 'It is right as it is, and a source or reason shows why'], ['accepted', 'Accepted risk', 'It stays; the CPA judges it']]
    .map(([v, w, hint], i) => `<div class="govuk-radios__item"><input class="govuk-radios__input" id="${e.id}-how-${v}" name="${e.id}-how" type="radio" value="${v}"${i === 0 ? ' data-req data-msg="Choose Fixed, Explained or Accepted risk"' : ''}${e.choice === v ? ' checked' : ''}><label class="govuk-label govuk-radios__label" for="${e.id}-how-${v}">${w}</label></div>`).join('')
  const last = e.last
    ? `<div class="govuk-inset-text"><strong>Last year's answer, accepted:</strong> ${esc(e.last)} It is only a proposal. It is not applied until you press the button.</div>`
    : ''
  const lastBtn = e.last
    ? `<button type="button" class="govuk-button govuk-button--secondary" data-lastyear data-to="Answered" data-tag="green" data-closes="1" data-say="Last year's answer used" data-module="govuk-button">Use last year's answer</button>`
    : ''
  const prior = e.answerText ? esc(e.answerText) : ''
  const form = `<form id="${e.id}-form" data-form data-edit data-exc data-act="set" data-to="Answered" data-tag="green" data-say="Answer saved" data-closes="1" novalidate>${SUMMARY}<div class="govuk-form-group"><fieldset class="govuk-fieldset" aria-describedby="${e.id}-how-error"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Your answer ${REQ}</legend><p class="govuk-error-message" id="${e.id}-how-error" hidden></p><div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">${radios}</div></fieldset></div>${group('Source or reason', `<textarea class="govuk-textarea" id="${e.id}-why" name="reason" rows="1" data-grow data-req data-ban="per client|as per client|per the client|client said so|per client." data-msg="Write the source or the reason this answer rests on" data-msg-wrong="Say what the source shows. 'Per client' alone is not accepted" aria-describedby="${e.id}-why-error">${prior}</textarea>`, `${e.id}-why`, '', true)}<div class="app-actions"><button type="submit" class="govuk-button" data-module="govuk-button" data-primary>Save answer</button>${lastBtn}</div></form>`
  const eff = `<dl class="govuk-summary-list govuk-summary-list--no-border"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Flag</dt><dd class="govuk-summary-list__value">${tag(lc, lw)}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Dollar effect</dt><dd class="govuk-summary-list__value">${money(e.effect)}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Source</dt><dd class="govuk-summary-list__value">${esc(e.sourceWords)}</dd></div></dl>`
  const accepted = e.state === 'accepted' ? `<p class="govuk-body">The CPA judges this accepted risk. Nothing on this page judges it.</p>` : ''
  const how = '<p class="govuk-body-s">Fixed: you fixed it in the return. Explained: it is right as it is, and a source or reason shows why. Accepted risk: it stays and the CPA judges it. "Per client" alone is not accepted as a reason.</p>'
  return item(e.id, e.src, e.title, head(e.title, e.found) + eff + last + accepted + how + form)
}
function excView(ds, ids = '') {
  const sorted = ds.rows
  const nOpen = sorted.filter((e) => e.state === 'open').length
  const body = sorted.map(excRow).join('')
  return `<div class="app-view" data-view="exceptions" data-title="Exceptions: one answer each" data-error-in="pane" hidden><p class="govuk-body-s"><span data-count="exceptions" data-scope="not answered" data-fmt="{n} not answered">${nOpen} not answered</span> of ${sorted.length}. Red flags first, then by dollar effect. The hand-off needs every exception answered. An accepted risk is tagged for the CPA to judge.</p><form class="app-filter-row" data-filter-form role="search" aria-label="Filter exceptions"><div class="govuk-form-group"><label class="govuk-label" for="ex-q${ids}">Filter exceptions</label><input class="govuk-input" id="ex-q${ids}" type="search" data-filter-for="exc-table" data-kind="text"></div><div class="govuk-form-group"><label class="govuk-label" for="ex-l${ids}">Flag</label><select class="govuk-select" id="ex-l${ids}" data-filter-for="exc-table" data-kind="attr" data-attr="level"><option value="all">All flags</option><option value="red">Red flags</option><option value="amber">Amber flags</option></select></div><p class="govuk-body-s app-count-line" data-shown-for="exc-table">Showing ${sorted.length} of ${sorted.length}</p></form><div data-empty-for="exc-table" hidden><p class="govuk-body">No exception matches. Clear the filter.</p></div><div class="app-scroll" role="region" aria-label="Exceptions, scrollable" tabindex="0"><table class="govuk-table app-dense" id="exc-table" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-visually-hidden">Exceptions and flags, red first, then dollar effect</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Exception</th><th scope="col" class="govuk-table__header">What was found</th><th scope="col" class="govuk-table__header app-numeric" aria-sort="none">Dollar effect</th><th scope="col" class="govuk-table__header" aria-sort="none">Flag</th><th scope="col" class="govuk-table__header">State</th></tr></thead><tbody class="govuk-table__body">${body}</tbody></table></div></div>`
}
const excEmpty = '<div class="app-view" data-view="exceptions/empty" data-title="Exceptions: one answer each" hidden><h2 class="govuk-heading-s">No exceptions on this return</h2><p class="govuk-body">The checks found nothing a person must answer. The hand-off needs no answer here.</p></div>'
const excPaneEmpty = '<div class="app-paneset" data-view="exceptions/empty" hidden><h2 class="govuk-heading-s">Nothing selected</h2><p class="govuk-body">There is no exception to answer.</p></div>'

// ---------------------------------------------------------------- CPA comments
const SEV = { must: 'Must fix', should: 'Should fix', note: 'Note' }
function cmRow(c) {
  const [col, word] = c.state === 'open' ? ['yellow', 'Open'] : c.state === 'resolved' ? ['green', 'Resolved'] : ['blue', c.stateWord]
  return `<tr class="govuk-table__row" data-id="${c.id}"${c.state === 'open' ? ' data-open="1"' : ''}><th scope="row" class="govuk-table__header"><button type="button" class="app-linkbtn" data-row>${esc(c.topic)}</button></th><td class="govuk-table__cell">${esc(c.text)}${c.draft ? ' ' + tag('light-blue', 'AI draft') : ''}</td><td class="govuk-table__cell">${c.type}</td><td class="govuk-table__cell">${SEV[c.sev]}</td><td class="govuk-table__cell" data-state>${tag(col, word)}</td></tr>`
}
function cmTable(sec) {
  return `<h2 class="govuk-heading-s govuk-!-margin-top-3" id="cm-sec-${slug(sec.name)}">${esc(sec.name)}</h2><div class="app-scroll" role="region" aria-label="CPA comments on ${esc(sec.name)}, scrollable" tabindex="0"><table class="govuk-table app-dense" id="cm-table-${slug(sec.name)}"><caption class="govuk-table__caption govuk-visually-hidden">CPA comments on ${esc(sec.name)}</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Topic</th><th scope="col" class="govuk-table__header">Comment</th><th scope="col" class="govuk-table__header">Type</th><th scope="col" class="govuk-table__header">Severity</th><th scope="col" class="govuk-table__header">State</th></tr></thead><tbody class="govuk-table__body">${sec.comments.map(cmRow).join('')}</tbody></table></div>`
}
function cmItem(c) {
  const meta = `<dl class="govuk-summary-list govuk-summary-list--no-border"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Section</dt><dd class="govuk-summary-list__value">${esc(c.section)}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Type, severity</dt><dd class="govuk-summary-list__value">${c.type}, ${SEV[c.sev].toLowerCase()}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Before</dt><dd class="govuk-summary-list__value">${c.before}</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">After</dt><dd class="govuk-summary-list__value">${c.after}</dd></div></dl>`
  const resolve = c.resolve && c.resolve[0].includes('.html') ? `<p class="govuk-body"><a class="govuk-link" href="${c.resolve[0]}">${c.resolve[2]}</a></p>` : c.resolve ? `<p class="govuk-body"><a class="govuk-link" href="#/${c.resolve[0]}" data-goto="${c.resolve[0]}"${c.resolve[1] ? ` data-select="${c.resolve[1]}"` : ''}>${c.resolve[2]}</a></p>` : ''
  const heldNote = '<div class="govuk-inset-text" data-held-only hidden>Only the assigned preparer can approve, reject or answer. You can read everything here.</div>'
  let rest = meta, foot = ''
  if (c.draft) {
    const d = c.draft
    if (d.kind === 'cannot') {
      rest += `<p class="govuk-body" data-keep><strong>AI cannot tell:</strong> ${esc(d.reason)}</p>`
    } else {
      const change = d.kind === 'fact'
        ? `<table class="govuk-table app-dense"><caption class="govuk-table__caption govuk-visually-hidden">The drafted change to a fact value</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Fact</th><th scope="col" class="govuk-table__header">Before</th><th scope="col" class="govuk-table__header">After</th></tr></thead><tbody class="govuk-table__body"><tr class="govuk-table__row"><td class="govuk-table__cell">${esc(d.fact)}</td><td class="govuk-table__cell app-tabular">${d.before}</td><td class="govuk-table__cell app-tabular">${d.after}</td></tr></tbody></table><p class="govuk-body-s">Kind of change: a fact value. It goes into the next import file.</p>`
        : `<table class="govuk-table app-dense"><caption class="govuk-table__caption govuk-visually-hidden">The drafted entry to type in Taxprep</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Cell</th><th scope="col" class="govuk-table__header">Before</th><th scope="col" class="govuk-table__header">After</th></tr></thead><tbody class="govuk-table__body"><tr class="govuk-table__row"><td class="govuk-table__cell">${esc(d.cell)}</td><td class="govuk-table__cell app-tabular">${d.before}</td><td class="govuk-table__cell app-tabular">${d.after}</td></tr></tbody></table><p class="govuk-body-s">Kind of change: an entry typed in Taxprep. Approving it adds a to-do for you; nothing changes until you type it and run the round trip.</p>`
      rest += `<div class="govuk-inset-text">${tag('light-blue', 'AI draft')} <strong>AI drafted fix, not applied.</strong> ${esc(d.text)} Cites: ${esc(d.cites)}.</div>${change}`
      const line = d.kind === 'fact' ? `Set ${esc(d.fact)} from ${d.before} to ${d.after}.` : `Type ${esc(d.cell)} in Taxprep: ${esc(d.before)} to ${esc(d.after)}.`
      foot = `<form id="${c.id}-form" data-form data-edit data-act="set" data-to="Draft rejected, you will fix it" data-tag="grey" data-say="Draft rejected" data-closes="0" novalidate>${SUMMARY}<p class="govuk-body">${tag('light-blue', 'AI draft')} ${line}</p>${group('Reason to reject', textarea(`${c.id}-why`, 'reason', 'Write why you reject the draft', '', ''), `${c.id}-why`, '', true)}<div class="app-actions"><button type="button" class="govuk-button" data-approve data-to="Draft approved, in the round trip" data-tag="blue" data-closes="0" data-say="Draft approved. ${d.kind === 'fact' ? 'It goes into the next import file' : 'It is now your to-do in Taxprep'}" data-key="a" data-key-mode="focus" aria-keyshortcuts="a" data-module="govuk-button" data-primary>Approve draft</button><button type="submit" class="govuk-button govuk-button--secondary" data-module="govuk-button">Reject draft</button></div></form>`
    }
  }
  if (!foot && c.state !== 'resolved') {
    foot = `<form id="${c.id}-form" data-form data-edit data-act="set" data-to="Answered" data-tag="blue" data-say="Answer saved" data-closes="1" novalidate>${SUMMARY}${group('Your answer to the CPA', textarea(`${c.id}-ans`, 'reason', 'Write your answer to the CPA', 'data-key="c" data-key-mode="focus" aria-keyshortcuts="c"', ''), `${c.id}-ans`, '', true)}<div class="app-actions"><button type="submit" class="govuk-button" data-module="govuk-button" data-primary>Save answer</button></div></form>`
  }
  return item(c.id, c.src, c.title, head(c.title, esc(c.text)) + heldNote + rest + resolve + foot)
}
function cmView(ds) {
  const all = ds.sections.flatMap((s) => s.comments)
  const nOpen = all.filter((c) => c.state === 'open').length
  const empty = `<div data-stage-only="import upload traced"><h2 class="govuk-heading-s">No CPA comments yet</h2><p class="govuk-body">Comments arrive after the CPA reviews the return. They are grouped by section of the return, with the type, the severity and the number before and after.</p></div>`
  const full = `<div data-stage-only="rework" hidden><p class="govuk-body-s">Grouped by section of the return, in the CPA's order. <span data-count="comments" data-scope="open" data-fmt="{n} open">${nOpen} open</span> of ${all.length}.</p>${ds.sections.map(cmTable).join('')}</div>`
  return `<div class="app-view" data-view="comments" data-title="CPA comments" hidden>${empty}${full}</div>`
}
const cmPane = (ds) => `<div class="app-paneset" data-view="comments" hidden>${ds.sections.flatMap((s) => s.comments).map(cmItem).join('')}${VIEWER}</div>`
const cmEmptyEglinton = '<div class="app-view" data-view="comments" data-title="CPA comments" hidden><h2 class="govuk-heading-s">No CPA comments yet</h2><p class="govuk-body">Comments arrive after the CPA reviews the return. They are grouped by section of the return, with the type, the severity and the number before and after.</p></div>'
const cmPaneEmptyEglinton = '<div class="app-paneset" data-view="comments" hidden><h2 class="govuk-heading-s">Nothing selected</h2><p class="govuk-body">There is no comment to answer.</p></div>'

// ---------------------------------------------------------------- assemble Maple Ridge
function replaceLine(lines, startsWith, html) {
  const i = lines.findIndex((l) => l.startsWith(startsWith))
  if (i < 0) throw new Error('marker not found: ' + startsWith)
  lines[i] = html
}
const KEYS_ROWS = '<tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><kbd>A</kbd></th><td class="govuk-table__cell">CPA comments: move focus to Approve draft (a key never approves)</td></tr><tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><kbd>C</kbd></th><td class="govuk-table__cell">CPA comments: move focus to your answer box</td></tr>'
function common(html) {
  return html.replaceAll('assets/b.js', 'assets/b3b.js').replaceAll('assets/b.css', 'assets/b3b.css')
    .replace('</tbody></table><p class="govuk-body-s">Shortcuts do nothing', KEYS_ROWS + '</tbody></table><p class="govuk-body-s">Shortcuts do nothing')
    .replace('<script src="assets/sources.js"></script>', '<script src="assets/sources.js"></script><script src="assets/sources3b.js"></script>')
}
{
  const L = BASE.slice()
  replaceLine(L, '<div class="app-view" data-view="trace" ', traceView(MAPLE))
  replaceLine(L, '<div class="app-view" data-view="trace/empty"', traceEmpty)
  replaceLine(L, '<div class="app-view" data-view="exceptions" ', excView(MAPLE.exceptions))
  replaceLine(L, '<div class="app-view" data-view="exceptions/empty"', excEmpty)
  replaceLine(L, '<div class="app-view" data-view="comments" ', cmView(MAPLE.comments))
  replaceLine(L, '<div class="app-paneset" data-view="trace" ', tracePane(MAPLE.traced))
  replaceLine(L, '<div class="app-paneset" data-view="trace/empty"', tracePaneEmpty)
  replaceLine(L, '<div class="app-paneset" data-view="exceptions" ', `<div class="app-paneset" data-view="exceptions" hidden>${MAPLE.exceptions.rows.map(excItem).join('')}${VIEWER}</div>`)
  replaceLine(L, '<div class="app-paneset" data-view="exceptions/empty"', excPaneEmpty)
  // the rework trace needs items for its own rows
  const html = L.join('\n')
  const rework = MAPLE.rework.items.filter((x) => !MAPLE.traced.items.some((y) => y.id === x.id)).map(traceItem).join('')
  let out = html.replace('<div class="app-paneset" data-view="trace" hidden>', '<div class="app-paneset" data-view="trace" hidden>' + rework)
  // comments pane
  const L2 = out.split('\n')
  replaceLine(L2, '<div class="app-paneset" data-view="comments" ', cmPane(MAPLE.comments))
  out = common(L2.join('\n'))
  out = out.replace('<title>Checklist - Maple Ridge', '<title>Checklist - Maple Ridge')
  fs.writeFileSync(path.join(OUT, 'record.html'), out)
}

// ---------------------------------------------------------------- Eglinton Retail: a second return, only the steps this version draws
{
  let h = BASE.join('\n')
  const L = h.split('\n')
  const keep = new Set(['trace', 'trace/empty', 'exceptions', 'exceptions/empty', 'comments'])
  const out = []
  const c0 = L.findIndex((l) => l.startsWith('<div class="app-view" data-view="checklist"'))
  const c1 = L.findIndex((l) => l.startsWith('<div class="app-view" data-view="evidence"'))
  for (let li = 0; li < L.length; li++) {
    let l = L[li]
    if (li >= c0 && li < c1) continue
    if (l.startsWith('<aside class="app-pane"')) l = '<aside class="app-pane" tabindex="0" aria-label="Detail and source, scrollable">'
    const m = l.match(/^<div class="app-(view|paneset)" data-view="([^"]+)"/)
    if (m && !keep.has(m[2])) continue
    out.push(l)
  }
  const L3 = out
  replaceLine(L3, '<div class="app-view" data-view="trace" ', traceView({ traced: EGLINTON.traced }))
  replaceLine(L3, '<div class="app-view" data-view="trace/empty"', traceEmpty)
  replaceLine(L3, '<div class="app-view" data-view="exceptions" ', excView(EGLINTON.exceptions, '-eg'))
  replaceLine(L3, '<div class="app-view" data-view="exceptions/empty"', excEmpty)
  replaceLine(L3, '<div class="app-view" data-view="comments" ', cmEmptyEglinton)
  replaceLine(L3, '<div class="app-paneset" data-view="trace" ', tracePane(EGLINTON.traced))
  replaceLine(L3, '<div class="app-paneset" data-view="trace/empty"', tracePaneEmpty)
  replaceLine(L3, '<div class="app-paneset" data-view="exceptions" ', `<div class="app-paneset" data-view="exceptions" hidden>${EGLINTON.exceptions.rows.map(excItem).join('')}${VIEWER}</div>`)
  replaceLine(L3, '<div class="app-paneset" data-view="exceptions/empty"', excPaneEmpty)
  replaceLine(L3, '<div class="app-paneset" data-view="comments" ', cmPaneEmptyEglinton)
  h = common(L3.join('\n'))
  // identity bar, title, steps that this version does not draw for this return
  h = h.replaceAll('Maple Ridge Consulting Inc. (Test)', 'Eglinton Retail Ltd. (Test)')
  h = h.replace('<span>Filing due 30 Jun 2026</span>', '<span>Filing due 30 Jun 2026</span>')
  h = h.replace('<body class="govuk-template__body">', '<body class="govuk-template__body" data-fixed-stage="traced">')
  h = h.replace(/<title>[^<]*<\/title>/, '<title>Trace: sources and reasons - Eglinton Retail Ltd. (Test) - Ashbridge Tax</title>')
  // nav: undrawn steps link to the note page; record tabs stay
  for (const step of ['checklist', 'evidence', 'gaps', 'books', 'roundtrip', 'diagnostics', 'handoff']) {
    const re = new RegExp(`<a href="#/${step}" data-goto="${step}" data-step="${step}"([^>]*)>`, 'g')
    h = h.replace(re, `<a href="shell-other.html?step=${step}" data-step="${step}"$1>`)
  }
  h = h.replace('href="record.html#/checklist" data-goto="checklist">Workbench', 'href="record-eglinton.html#/trace" data-goto="trace">Workbench')
  // stage buttons are Maple Ridge's: this return is shown after the upload only; the hold switch stays
  h = h.replace(/<button type="button"[^>]*data-stage-set="[a-z]+"[^>]*>[^<]*<\/button>/g, '').replace('Prototype only: change the stage', 'Prototype only: who holds the return').replace('Show this return at:<br>', 'Show this return held by:<br>')
  fs.writeFileSync(path.join(OUT, 'record-eglinton.html'), h)
}
console.log('generated record.html and record-eglinton.html')
