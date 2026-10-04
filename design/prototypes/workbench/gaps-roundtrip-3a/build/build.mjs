// Builds both versions of the gap review (D07) and round trip (D05) prototypes from the data in data.mjs.
//   node design/prototypes/workbench/gaps-roundtrip-3a/build/build.mjs
// Version A: list-and-detail split (steps | list | pane, round trip as list | detail). Version B: one column, one question at a time and
// the round trip as the task list with the open step expanded under its row. Same data, same markup inside the panes, same script.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as D from './data.mjs'
import { esc, money } from './data.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '..')
const VERSIONS = { a: { dir: 'a-list-detail', name: 'List and detail' }, b: { dir: 'b-one-column', name: 'One column' } }
const BLOCK = '../../b-split-pane/' // version B round 2 of the workbench: pages of other steps (read only)

const tag = (cls, t) => `<strong class="govuk-tag govuk-tag--${cls}">${t}</strong>`
const EVTAG = { found: tag('green', 'Evidence found'), missing: tag('red', 'Evidence missing'), conflicting: tag('yellow', 'Evidence conflicts'), weak: tag('orange', 'Evidence weak') }
const DRAFT = tag('light-blue', 'AI drafted, not verified')
const btn = (label, attrs = '', cls = '') => `<button type="button" class="govuk-button ${cls}" ${attrs} data-module="govuk-button">${label}</button>`
const sbtn = (label, attrs = '', cls = '') => `<button type="submit" class="govuk-button ${cls}" ${attrs} data-module="govuk-button">${label}</button>`
const summary = (inner = '') => `<div class="govuk-error-summary" data-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list">${inner}</ul></div></div></div>`
const staticSummary = (items) => `<div class="govuk-error-summary" data-summary data-static tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list">${items.map((i) => `<li><a href="#${i.id}">${esc(i.text)}</a></li>`).join('')}</ul></div></div></div>`
const fieldMsg = (id, msg) => `<p id="${id}-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ${esc(msg)}</p>`


// ================================================================ viewer (the shared source viewer, D03)
function viewer(id, srcKey, hlOverride) {
  const s = D.SOURCES[srcKey]
  if (!s) return ''
  const hl = hlOverride ?? s.hl
  const head = s.head.map((h, i) => `<th scope="col" class="govuk-table__header${s.num.includes(i) ? ' app-numeric' : ''}">${esc(h)}</th>`).join('')
  const rows = s.rows.map((r, ri) => `<tr class="govuk-table__row${ri === hl ? ' app-hl' : ''}"${ri === hl ? ' data-hl' : ''}>${r.map((c, i) => {
    const inner = (ri === hl && i === 0 ? '<span class="govuk-visually-hidden">Highlighted line: </span>' : '') + esc(c)
    return i === 0 ? `<th scope="row" class="govuk-table__header">${inner}</th>` : `<td class="govuk-table__cell${s.num.includes(i) ? ' app-numeric' : ''}">${inner}</td>`
  }).join('')}</tr>`).join('')
  return `<div class="app-viewer" data-viewer data-src="${srcKey}">
<div class="app-viewer__head"><h2 class="govuk-heading-s">Source</h2><div class="app-viewer__bar"><div class="govuk-checkboxes govuk-checkboxes--small app-g3-second" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input app-g3-sw-toggle" id="${id}-sw" type="checkbox" data-sw-toggle><label class="govuk-label govuk-checkboxes__label" for="${id}-sw">Second window</label></div></div><button type="button" class="govuk-button govuk-button--secondary" data-act="open-source" aria-keyshortcuts="o" data-module="govuk-button">Open source</button></div></div>
<div class="app-viewer__box" data-evidence tabindex="0" role="region" aria-label="Source excerpt, scrollable"><table class="govuk-table app-dense"><caption class="govuk-table__caption govuk-visually-hidden">${esc(s.title)}</caption><thead class="govuk-table__head"><tr class="govuk-table__row">${head}</tr></thead><tbody class="govuk-table__body">${rows}</tbody></table></div>
<p class="govuk-body-s app-viewer__cap">${esc(s.title)}. ${esc(s.caption)}</p>
</div>`
}

// ================================================================ gap review
function slotFields(p, slots) {
  return slots.map((s, j) => `<div class="govuk-form-group"><label class="govuk-label" for="${p}-s${j}">${esc(s[0])}</label><input class="govuk-input" id="${p}-s${j}" name="s${j}" type="text" value="${esc(s[1])}" data-label="${esc(s[0])}" data-initial="${esc(s[1])}" autocomplete="off"></div>`).join('')
}
function qPane(retKey, q, n, total, opts = {}) {
  const p = `${opts.prefix || ''}${retKey}-${q.id}`
  const evt = q.ev ? EVTAG[q.ev] : tag('grey', 'Added from the bank')
  const obs = q.obs || 'Added from the approved question bank by the preparer.'
  return `<section class="app-item app-g3-q" data-qpane="${q.id}" data-st="draft" aria-label="Question ${n} of ${total}" hidden>
<div class="app-item__head"><h2 class="govuk-heading-s" tabindex="-1" data-pos>Question ${n} of ${total}</h2><div class="app-pager"><button type="button" class="govuk-button govuk-button--secondary" data-nav="prev" aria-keyshortcuts="p" aria-label="Previous open question" data-module="govuk-button">Prev</button><button type="button" class="govuk-button govuk-button--secondary" data-nav="next" aria-keyshortcuts="n" aria-label="Next open question" data-module="govuk-button">Next</button></div><p class="govuk-body app-g3-qtext"><strong>${esc(q.text)}</strong> <span class="app-g3-ev">${evt}</span></p><p class="govuk-body app-g3-tagline"><span data-pane-state>${DRAFT}</span></p></div>
<div class="app-item__scroll">${q.src ? viewer(p, q.src, q.hl) : `<div class="govuk-inset-text">From the question bank: no source yet. Fill the slot values from what the client says, or drop the question.</div>`}<p class="govuk-body-s app-g3-observe">${esc(obs)}</p></div>
<div class="app-item__foot">
<form data-form="slots" data-edit novalidate>${summary()}<div class="app-g3-slots">${slotFields(p, q.slots)}</div><div class="app-actions" data-save-row hidden>${sbtn('Save slot values', 'data-act="save"', 'govuk-button--secondary')}</div></form>
<div class="app-actions" data-edit data-actions>${btn('Keep and next', 'data-act="keep" data-primary aria-keyshortcuts="r"')}${btn('Merge', 'data-act="merge-open" aria-label="Merge this question with another question"', 'govuk-button--secondary')}${btn('Drop', 'data-act="drop-open" aria-label="Drop this question, with a reason"', 'govuk-button--warning')}</div>
<div class="app-actions" data-edit data-reopen hidden>${btn('Change this answer', 'data-act="reopen"', 'govuk-button--secondary')}</div>
<form data-form="merge" class="app-g3-inline" data-edit hidden novalidate><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend">Merge this question into (it stays in the list)</legend><div data-targets></div></fieldset><div class="app-actions">${btn('Cancel', 'data-act="cancel"', 'govuk-button--secondary')}</div></form>
<form data-form="drop" class="app-g3-inline" data-edit hidden novalidate>${summary()}<div class="govuk-form-group" data-group="reason"><label class="govuk-label" for="${p}-reason">Reason for dropping this question</label><textarea class="govuk-textarea" id="${p}-reason" name="reason" rows="2" data-req="Write why this question is dropped" autocomplete="off"></textarea></div><div class="app-actions">${sbtn('Drop with this reason', 'data-act="drop" data-primary', 'govuk-button--warning')}${btn('Cancel', 'data-act="cancel"', 'govuk-button--secondary')}</div></form>
</div></section>`
}
function qRow(q, n, st = DRAFT) {
  const evt = q.ev ? EVTAG[q.ev] : tag('grey', 'Added from the bank')
  return `<tr class="govuk-table__row" data-qrow="${q.id}" data-st="draft"><th scope="row" class="govuk-table__header"><button type="button" class="app-linkbtn" data-row aria-keyshortcuts="n p" data-qn>Question ${n}</button></th><td class="govuk-table__cell">${esc(q.text)}</td><td class="govuk-table__cell">${evt}</td><td class="govuk-table__cell" data-state>${st}</td></tr>`
}
function gapsView(ret, layout) {
  const qs = D.GAPS[ret.key]
  const total = qs.length
  const rows = qs.map((q, i) => qRow(q, i + 1)).join('')
  const panes = qs.map((q, i) => qPane(ret.key, q, i + 1, total)).join('')
  const tpl = D.BANK.map((b) => `<template data-bank-row="${b.id}">${qRow({ ...b, ev: null, id: 'bk' + b.id }, 0)}</template><template data-bank-pane="${b.id}">${qPane(ret.key, { ...b, ev: null, id: 'bk' + b.id, obs: '', hl: null }, 0, 0, { prefix: 'add-' })}</template>`).join('')
  const table = `<div class="app-scroll" role="region" aria-label="Draft questions, scrollable" tabindex="0" data-when-rows><table class="govuk-table app-dense" id="gaps-table"><caption class="govuk-table__caption govuk-visually-hidden">Draft questions in the order of the return</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Question</th><th scope="col" class="govuk-table__header">Text</th><th scope="col" class="govuk-table__header">Evidence</th><th scope="col" class="govuk-table__header">State</th></tr></thead><tbody class="govuk-table__body" data-qbody>${rows}</tbody></table></div>`
  const bank = `<details class="govuk-details" data-edit data-bank><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Add a question from the bank</span></summary><div class="govuk-details__text"><form data-form="bank" novalidate><p class="govuk-body-s" data-bank-note>Choose a bank question. It is added to the end of the list.</p><ul class="govuk-list app-g3-bank" data-bank-list>${D.BANK.map((x) => `<li data-bank-item="${x.id}"><button type="submit" class="govuk-button govuk-button--secondary" name="bank" value="${x.id}" data-module="govuk-button">${esc(x.text)}</button></li>`).join('')}</ul></form></div></details>`
  const signTop = `<div data-sign-area><form data-form="sign" data-edit hidden novalidate>${summary()}${sbtn('Sign the gap list', 'data-act="sign" data-primary')}</form>
<div class="govuk-inset-text" data-signed hidden><span data-signed-text></span> <a class="govuk-link" href="#/roundtrip">Go to Round trip</a></div></div>`
  const sign = `<p class="govuk-body" data-sign-wait>The sign button appears when every question is reviewed (<span data-count="gaps" data-scope="not reviewed">0 of 0 not reviewed</span>). <a class="govuk-link" href="#/gaps" data-next-open>Go to the next open question</a></p>`
  const empty = `<div data-when-empty hidden><h2 class="govuk-heading-s">Nothing to ask</h2><p class="govuk-body">Code found every required fact in the evidence. There are no draft questions for this return. You can still add a question from the bank.</p></div>`
  const holdNote = `<div class="govuk-inset-text" data-held-only hidden>This return is held by ${D.OTHER_HOLDER} since 2 Oct 2026, 14:05. You can read the questions and their sources. Buttons that change the return are not shown.</div>`
  const intro = `<p class="govuk-body-s">Code decided found, missing, conflicting or weak. AI filled slot values only.</p>`
  const head = `<div class="app-g3-titlerow"><h1 class="govuk-heading-m" id="page-title">Gap review</h1><p class="govuk-body-s"><span data-count="gaps" data-scope="not reviewed">0 of 0 not reviewed</span></p>${layout === 'b' ? intro : ''}</div>`
  const prefix = `${head}${holdNote}`
  if (layout === 'a') {
    return `<div class="app-g3-view" data-view="gaps" data-title="Gap review" hidden>${holdNote}<div class="app-g3-split"><div class="app-g3-list">${head}${signTop}${intro}${empty}${table}${bank}${sign}</div>
<aside class="app-pane" aria-label="Question detail"><div class="app-paneset" data-paneset>${panes}<div data-pane-empty class="app-g3-pane-empty"><p class="govuk-body">Choose a question to see its source and decide.</p></div></div></aside></div>${tpl}</div>`
  }
  return `<div class="app-g3-view" data-view="gaps" data-title="Gap review" hidden>${prefix}${signTop}${empty}<div class="app-g3-disc"><details class="govuk-details app-g3-qlist" data-when-rows><summary class="govuk-details__summary"><span class="govuk-details__summary-text">All questions (<span data-count="gaps-all" data-scope="questions">0 questions</span>)</span></summary><div class="govuk-details__text">${table.replace(' data-when-rows', '')}</div></details>${bank}</div>
<div class="app-g3-focus" data-paneset>${panes}<div data-pane-empty class="app-g3-pane-empty"><p class="govuk-body">Choose a question from the list to see its source and decide.</p></div></div>${sign}${tpl}</div>`
}

// ================================================================ round trip
const STEPS = [
  { id: 'gfi', name: 'GIFI mapping', needs: '', done: 'No flag left' },
  { id: 'import', name: 'Import file', needs: 'the GIFI mapping', done: 'Downloaded' },
  { id: 'taxprep', name: 'In Taxprep', needs: 'the import file', done: 'Ready pressed' },
  { id: 'upload', name: 'Upload', needs: 'Ready in Taxprep', done: 'Accepted' },
  { id: 'diag', name: 'Diagnostics', needs: 'the upload', done: 'All cleared' },
  { id: 'cite', name: 'Cite and explain', needs: 'the diagnostics', done: 'Nothing left' },
  { id: 'signoff', name: 'Sign off', needs: 'every step above', done: '' },
]
const sceneTag = { complete: ['green', 'Complete'], progress: ['blue', 'In progress'], refused: ['red', 'Refused'], flagged: ['yellow', 'Flagged for a person'], blocked: ['red', 'Not cleared'], cannot: ['grey', 'Cannot start yet'] }

function fileField(id, label, hint, msg, accept, err) {
  return `<div class="govuk-form-group${err ? ' govuk-form-group--error' : ''}" data-group="${id}"><label class="govuk-label" for="${id}">${label}</label>${hint ? `<div id="${id}-hint" class="govuk-hint">${hint}</div>` : ''}${err ? fieldMsg(id, err) : ''}<input class="govuk-file-upload${err ? ' govuk-file-upload--error' : ''}" id="${id}" name="${id}" type="file" accept="${accept}" data-req="${esc(msg)}"${hint ? ` aria-describedby="${id}-hint${err ? ' ' + id + '-error' : ''}"` : err ? ` aria-describedby="${id}-error"` : ''}></div>`
}
function proto(options, label) {
  return `<div class="app-proto"><label class="govuk-label" for="proto-${label}">Prototype only: what the chosen file gives</label><select class="govuk-select" id="proto-${label}" data-proto>${options.map((o) => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select></div>`
}
const dl = (rows) => `<dl class="govuk-summary-list govuk-summary-list--no-border">${rows.map((r) => `<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">${r[0]}</dt><dd class="govuk-summary-list__value">${r[1]}</dd></div>`).join('')}</dl>`
function sortTable(id, caption, cols, rows, opts = {}) {
  const th = cols.map((c, i) => `<th scope="col" class="govuk-table__header${c.num ? ' app-numeric' : ''}"${c.sort ? ` aria-sort="${c.sort === true ? 'none' : c.sort}"` : ''}>${c.label}</th>`).join('')
  return `<div class="app-scroll app-g3-rows" role="region" aria-label="${esc(caption)}, scrollable" tabindex="0"><table class="govuk-table app-dense" id="${id}"${opts.sortable ? ' data-module="moj-sortable-table"' : ''}><caption class="govuk-table__caption govuk-visually-hidden">${esc(caption)}</caption><thead class="govuk-table__head"><tr class="govuk-table__row">${th}</tr></thead><tbody class="govuk-table__body">${rows.join('')}</tbody></table></div>`
}
const cell = (v, num) => `<td class="govuk-table__cell${num ? ' app-numeric' : ''}">${v}</td>`

function gfiLinesTable(ret, id) {
  const lines = D.GFI[ret.key] || D.GFI.maple
  const rows = lines.map((l) => `<tr class="govuk-table__row" data-code="${l.code}" data-text="${l.code} ${esc(l.desc)}"><th scope="row" class="govuk-table__header">${l.code}</th>${cell(esc(l.desc))}${cell(money(l.amount), true)}</tr>`)
  return `<form class="app-filter-row" data-filter-form="${id}" role="search" aria-label="Filter code lines"><div class="govuk-form-group"><label class="govuk-label" for="${id}-q">Filter code lines</label><input class="govuk-input" id="${id}-q" type="search" data-filter-input autocomplete="off"></div><p class="govuk-body app-count-line" data-filter-count>Showing ${lines.length} of ${lines.length}</p></form>` + sortTable(id, 'Code lines read from the .GFI file', [{ label: 'Code', sort: 'ascending' }, { label: 'Description', sort: true }, { label: 'Amount', sort: true, num: true }], rows, { sortable: true })
}
function gfiUploadForm(ret, err, pr = '') {
  const fe = err ? err.fieldMsg || 'Choose the .GFI file' : null
  return `<form data-form="gfi-upload" novalidate>${err ? staticSummary([{ id: 'gfi-file', text: err.why }]) : summary()}${fileField('gfi-file', '.GFI file from QuickBooks Online', 'In Workpapers, on the Tax mapping tab, export the .GFI. One line for each GIFI code.', 'Choose the .GFI file', '.gfi,.GFI,.txt', err ? err.why : null)}<div class="app-g3-btnrow">${sbtn('Upload the .GFI', 'data-primary')}${pr}</div></form>`
}
function gfiRead(ret, flagged) {
  const lines = D.GFI[ret.key] || D.GFI.maple
  const flags = D.GFI_FLAGS
  const flagRows = flags.map((f) => `<tr class="govuk-table__row app-row-flag" data-flag="${f.id}"><th scope="row" class="govuk-table__header">${esc(f.acct)}</th>${cell(esc(f.kind))}${cell(esc(f.detail))}<td class="govuk-table__cell" data-flag-state>${f.fix === 'accept' ? `<button type="button" class="app-linkbtn" data-act="flag-open" data-flag="${f.id}" data-edit>Accept the change</button>` : 'Fix in QuickBooks Online, then upload again'}</td></tr>`)
  const flagTable = `<div class="app-scroll" role="region" aria-label="Flagged accounts, scrollable" tabindex="0"><table class="govuk-table app-dense" id="gfi-flags"><caption class="govuk-table__caption govuk-visually-hidden">Flagged accounts</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Account</th><th scope="col" class="govuk-table__header">Flag</th><th scope="col" class="govuk-table__header">Detail</th><th scope="col" class="govuk-table__header">What to do</th></tr></thead><tbody class="govuk-table__body">${flagRows.join('')}</tbody></table></div>
<form data-form="flag-accept" class="app-g3-inline" data-edit hidden novalidate>${summary()}<div class="govuk-form-group" data-group="flag-reason"><label class="govuk-label" for="flag-reason">Reason for accepting the change from last year (saved under ${D.PREPARER})</label><textarea class="govuk-textarea" id="flag-reason" rows="2" data-req="Write why the new code is right" autocomplete="off"></textarea></div><div class="app-actions">${sbtn('Accept the change', 'data-act="flag-accept"')}${btn('Cancel', 'data-act="cancel"', 'govuk-button--secondary')}</div></form>`
  const n = flagged ? flags.length : 0
  const sum = dl([['Firm', 'Ashbridge Tax'], ['Tax year end in the file', `${ret.ye}, the return\'s year end is ${ret.ye}`], ['Code lines read', `<span data-count="gfi-lines" data-scope="code lines read">${lines.length} code lines read</span> (one for each GIFI code)`], ['Flags', flagged ? `<span data-count="gfi-flags" data-scope="left">${n} flags left</span>` : 'None left']])
  return `${sum}${flagged ? `<h2 class="govuk-heading-s">Accounts flagged for a person</h2><p class="govuk-body">A flag clears only when you upload a new .GFI that no longer shows it, except a change from last year, which you may accept with a reason. Returns never proposes a code.</p>${flagTable}` : `<div class="govuk-inset-text">No flag left. Nothing to confirm: QuickBooks Online made the mapping.</div>`}<h2 class="govuk-heading-s">Code lines read</h2>${gfiLinesTable(ret, 'gfi-lines-' + (flagged ? 'f' : 'c'))}`
}
function scene(name, result, hint, html, extra = '') {
  return `<div data-scene="${name}" data-result="${result}" data-hint="${esc(hint)}" ${extra} hidden>${html}</div>`
}
function refusalForm(kind, r, pdf, pr = '') {
  const sfx = '-' + kind
  const fid = (r.field === 'pdf' ? 'up-pdf' : 'up-lock') + sfx
  return `<form data-form="upload" novalidate>${staticSummary([{ id: fid, text: r.why }])}${uploadFields(pdf ? { pdf: r.fieldMsg } : { lock: r.fieldMsg }, r.field, sfx, false)}<p class="govuk-body"><strong>What to do:</strong> ${esc(r.fix)} Nothing was saved.</p><div class="app-g3-btnrow">${sbtn('Upload both files', 'data-primary')}${pr}</div></form>`
}
function uploadFields(errs = {}, which, sfx = '', hints = true) {
  return '<div class="app-g3-cols">' + fileField('up-lock' + sfx, 'Lock export (CSV) from Taxprep', hints ? 'Taxprep, File, Export, the lock export of this return.' : '', 'Choose the lock export file', '.csv', which === 'lock' ? errs.lock : null) + fileField('up-pdf' + sfx, 'Printed return (PDF)', hints ? 'Print the return to PDF from Taxprep, Office copy. It is the binder record only.' : '', 'Choose the printed return', '.pdf', which === 'pdf' ? errs.pdf : null) + '</div>'
}
function rtBodies(ret, layout) {
  const yr = Number(ret.ye.slice(-4))
  const sub = (s) => s.replaceAll('{NAME}', ret.name).replaceAll('{YE}', ret.ye).replaceAll('{PYE}', ret.ye.slice(0, -4) + (yr - 1)).replaceAll('{YR}', String(yr))
  const out = {}
  const h = (step, t) => (layout === 'a' ? `<h2 class="govuk-heading-s" tabindex="-1" data-body-title>${t}</h2>` : '')
  const cannot = (step) => scene('cannot', 'cannot', '', `<div class="govuk-inset-text">Cannot start yet. It needs ${esc(step.needs)}. <a class="govuk-link" href="#/roundtrip" data-open-current>Go to the step you are on</a>.</div>`)
  // ---- GIFI mapping
  const gfiOpts = [['read', 'A good file: no flag'], ['flagged', 'Read, with flags'], ['refused-header', 'Header only'], ['refused-layout', 'Layout mismatch'], ['refused-calc', 'A code CRA calculates'], ['refused-unknown', 'An unknown code']]
  out.gfi = h('gfi', 'GIFI mapping') + [
    scene('before', 'progress', 'Choose the .GFI file', `<p class="govuk-body">QuickBooks Online makes the GIFI mapping. Returns reads it from the .GFI file you download in QuickBooks Online Accountant and upload here. Nothing is typed or confirmed here.</p>${gfiUploadForm(ret, null, proto(gfiOpts, 'gfi'))}`),
    scene('read', 'complete', `${(D.GFI[ret.key] || D.GFI.maple).length} lines read, no flag`, gfiRead(ret, false) + `<p class="govuk-body"><a class="govuk-link" href="#/roundtrip/gfi.before">Upload a new .GFI</a></p>`),
    scene('flagged', 'flagged', `${D.GFI_FLAGS.length} accounts flagged`, gfiRead(ret, true) + `<p class="govuk-body"><a class="govuk-link" href="#/roundtrip/gfi.before">Upload a new .GFI</a></p>`),
    ...Object.entries(D.GFI_REFUSALS).map(([k, r]) => scene(k, 'refused', 'Refused, upload again', `<form data-form="gfi-upload" novalidate>${staticSummary([{ id: 'gfi-file-' + k, text: `${r.why} ${r.fix}` }])}${fileField('gfi-file-' + k, '.GFI file from QuickBooks Online', '', 'Choose the .GFI file', '.gfi,.GFI,.txt', `${r.why} ${r.fix}`)}<p class="govuk-body"><strong>${esc(r.title)}.</strong> Nothing was read from this file.</p><div class="app-g3-btnrow">${sbtn('Upload the .GFI', 'data-primary')}${proto(gfiOpts, 'gfi-' + k)}</div></form>`)),
    cannot(STEPS[0]),
  ].join('')
  // ---- Import file
  const impTable = sortTable('imp-rows', 'Rows in the import file', [{ label: 'Cell' }, { label: 'Where it goes' }, { label: 'Value', num: true }, { label: 'What happens' }], D.IMPORT_ROWS.map((r) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${esc(r[0])}</th>${cell(esc(r[1]))}${cell(esc(r[2]), true)}${cell(esc(r[3]))}</tr>`))
  const waiting = `<h2 class="govuk-heading-s">Rows waiting on verification (${D.WAITING.length})</h2><ul class="govuk-list govuk-list--bullet">${D.WAITING.map((w) => `<li><a class="govuk-link" href="${BLOCK}record.html#/evidence">${esc(w.fact)}</a>: ${esc(w.why)}</li>`).join('')}</ul>`
  const dlBtn = (label) => `<a class="govuk-button" role="button" draggable="false" href="${BLOCK}assets/01_2025-12-31_v1.csv" download data-act="download" data-edit data-primary data-module="govuk-button">${label}</a>`
  const rt = D.REIMPORT
  out.import = h('import', 'Import file') + [
    scene('ready', 'progress', `${D.IMPORT_ROWS.length} rows, ${D.WAITING.length} waiting`, `<p class="govuk-body">Version 2 of the import file, built from the verified facts and the code lines read. A natural key that no copy in the latest export holds goes to the next free copy.</p>${dlBtn('Download the import file')}<p class="govuk-body"><span data-count="imp-rows" data-scope="rows to write">${D.IMPORT_ROWS.length} rows to write</span>, <span data-count="imp-wait" data-scope="waiting">${D.WAITING.length} waiting</span>.</p>${impTable}${waiting}`),
    scene('heldback', 'progress', `${D.IMPORT_ROWS.length} rows held back`, `<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>New rows are held back: no export since this return was created.</strong></div><p class="govuk-body">Taxprep numbers repeating forms itself, so Returns cannot tell which copy to write to until it has seen one export. Export once from Taxprep, then re-import.</p><ol class="govuk-list govuk-list--number"><li>Download the file without the held rows and import it into Taxprep.</li><li>Lock the return and export it, then upload it in step 4.</li><li>Come back here and download the import file again; the held rows are then in it.</li></ol>${dlBtn('Download the file without the held rows')}<h2 class="govuk-heading-s">Held back (<span data-count="imp-held" data-scope="held back">${D.IMPORT_ROWS.length} rows</span>)</h2>${impTable.replace('imp-rows', 'imp-held-rows')}${waiting}`),
    scene('reimport', 'progress', `${rt.changed.length} changed, ${rt.cleared.length} cleared`, `<p class="govuk-body">A re-import sends only the cells that changed or were cleared since the last import.</p>${dlBtn('Download the re-import file')}<p class="govuk-body"><span data-count="re-changed" data-scope="changed">${rt.changed.length} changed</span>, <span data-count="re-cleared" data-scope="cleared">${rt.cleared.length} cleared</span>. <a class="govuk-link" href="#/roundtrip/import.held">${D.STILL_HELD.length} cells Taxprep still holds</a></p><h2 class="govuk-heading-s">Changed cells</h2>${sortTable('re-ch', 'Changed cells', [{ label: 'Cell' }, { label: 'Before', num: true }, { label: 'Now', num: true }], rt.changed.map((r) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${esc(r[0])}</th>${cell(esc(r[1]), true)}${cell(esc(r[2]), true)}</tr>`))}<h2 class="govuk-heading-s">Cleared cells</h2>${sortTable('re-cl', 'Cleared cells', [{ label: 'Cell' }, { label: 'Before', num: true }, { label: 'Now', num: true }], rt.cleared.map((r) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${esc(r[0])}</th>${cell(esc(r[1]), true)}${cell(esc(r[2]), true)}</tr>`))}`),
    scene('held', 'progress', `${D.STILL_HELD.length} cells Taxprep still holds`, `<p class="govuk-body">These cells still hold a figure in Taxprep that is gone from the import file. Clear each in the next file, with a reason, or clear it by hand in Taxprep.</p><p class="govuk-body"><span data-count="still-held" data-scope="still held">${D.STILL_HELD.length} cells still held</span>. <a class="govuk-link" href="#/roundtrip/import.reimport">Back to the re-import</a></p><ul class="govuk-list" data-held-list>${D.STILL_HELD.map((c) => `<li class="app-g3-inline" data-held="${c.id}"><p class="govuk-body"><strong>${esc(c.cell)}</strong><br>Taxprep still holds ${esc(c.value)}. ${esc(c.why)}</p><p class="govuk-body" data-held-state><button type="button" class="govuk-button govuk-button--secondary" data-act="held-open" data-held="${c.id}" data-edit data-module="govuk-button">Clear in the next file</button></p></li>`).join('')}</ul><form data-form="held-clear" class="app-g3-inline" data-edit hidden novalidate>${summary()}<div class="govuk-form-group" data-group="held-reason"><label class="govuk-label" for="held-reason">Reason for clearing this cell (saved under ${D.PREPARER})</label><textarea class="govuk-textarea" id="held-reason" rows="2" data-req="Write why the cell is cleared" autocomplete="off"></textarea></div><div class="app-actions">${sbtn('Clear in the next file', 'data-act="held-clear"')}${btn('Cancel', 'data-act="cancel"', 'govuk-button--secondary')}</div></form>`),
    scene('done', 'complete', 'Downloaded', `<p class="govuk-body">The import file was downloaded. Import it into Taxprep next.</p>`),
    cannot(STEPS[1]),
  ].join('')
  // ---- In Taxprep
  out.taxprep = h('taxprep', 'In Taxprep') + [
    scene('todo', 'progress', 'Lock, then press Ready', `<p class="govuk-body">Everything here happens in Taxprep. Nothing is typed in Returns.</p><ol class="govuk-list govuk-list--number"><li><strong>Import.</strong> File, Import, choose the file you downloaded.</li><li><strong>Tax choices.</strong> CCA claims, dividend designations, elections, business limit shares and loss or donation claims are typed in Taxprep. Each typed value gets a source or a written reason in Trace after the upload.</li><li><strong>Lock.</strong> Lock the return in Taxprep.</li></ol><div class="govuk-inset-text">Press Ready only when the return is locked. The import report in Taxprep is not proof of what was imported; the upload check in the next step is.</div>${btn('Ready', 'data-act="ready" data-edit data-primary')}`),
    scene('done', 'complete', 'Ready pressed', `<p class="govuk-body">Ready was pressed by ${D.PREPARER} on ${D.TODAY}. The return moved from Prepare to Trace.</p>`),
    cannot(STEPS[2]),
  ].join('')
  // ---- Upload
  const upOpts = [['accepted', 'Accepted'], ['accepted-bn', 'Accepted, business number not entered'], ...Object.entries(D.REFUSALS).map(([k, r]) => [k, 'Refused: ' + r.title])]
  const classRows = D.CLASSES.map((c) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${c[0]}</th>${cell(String(c[1]), true)}</tr>`)
  const total = D.CLASSES.reduce((a, c) => a + c[1], 0)
  const acc = (bn) => `<p class="govuk-body">Both files passed the checks. <span data-count="up-cells" data-scope="cells read">${total} cells read</span>, each in one class.</p>${bn ? `<div class="govuk-inset-text"><strong>${tag('yellow', 'Flagged for a person')} Business number not entered.</strong> The export holds no business number, so that check could not run. The year end and header checks passed.</div>` : ''}${sortTable('up-classes' + (bn ? '-bn' : ''), 'Cells by class', [{ label: 'Class' }, { label: 'Cells', num: true }], classRows)}<p class="govuk-body">Dropped cells block sign-off: re-import and export again (<a class="govuk-link" href="#/roundtrip/import.reimport">Import file</a>). Next: paste the diagnostics list. <a class="govuk-link" href="#/roundtrip/diag.paste">Go to Diagnostics</a></p>`
  out.upload = h('upload', 'Upload the lock export and the printed return') + [
    scene('form', 'progress', 'Choose both files', `<form data-form="upload" novalidate>${summary()}${uploadFields()}<div class="app-g3-btnrow">${sbtn('Upload both files', 'data-primary')}${proto(upOpts, 'up')}</div></form>`),
    scene('accepted', 'complete', `${total} cells read`, acc(false)),
    scene('accepted-bn', 'complete', `${total} cells, no business number`, acc(true)),
    ...Object.entries(D.REFUSALS).map(([k, r0]) => { const r = { ...r0, why: sub(r0.why), fix: sub(r0.fix), fieldMsg: sub(r0.fieldMsg) }; return scene(k, 'refused', 'Refused, upload again', `${refusalForm(k, r, r.field === 'pdf', proto(upOpts, 'up-' + k))}`) }),
    cannot(STEPS[3]),
  ].join('')
  // ---- Diagnostics
  const diagText = D.DIAG.map((r) => `${r[0]} | ${r[1]}${r[2] ? '_' + r[2] : ''} | ${r[3]} | ${r[4]}`).join('\n')
  const pasteForm = (opts = {}, sfx = '') => {
    const cm = opts.countMsg || (opts.err ? 'Type the All count shown in Taxprep' : '')
    const items = [].concat(opts.err ? [{ id: 'dg-text' + sfx, text: 'Paste the diagnostics list' }] : [], cm ? [{ id: 'dg-count' + sfx, text: cm }] : [])
    return `<form data-form="diag-paste" novalidate>${items.length ? staticSummary(items) : summary()}<div class="app-g3-cols app-g3-cols--paste"><div class="govuk-form-group${opts.err ? ' govuk-form-group--error' : ''}" data-group="dg-text"><label class="govuk-label" for="dg-text${sfx}">Diagnostics list from Taxprep</label><div id="dg-text${sfx}-hint" class="govuk-hint">In the Diagnostics panel choose the All tab, include Hidden rows, copy every row and paste here.</div>${opts.err ? fieldMsg('dg-text' + sfx, 'Paste the diagnostics list') : ''}<textarea class="govuk-textarea" id="dg-text${sfx}" name="text" rows="${opts.text ? 3 : 2}" data-req="Paste the diagnostics list" aria-describedby="dg-text${sfx}-hint${opts.err ? ' dg-text' + sfx + '-error' : ''}">${opts.text ? esc(diagText) : ''}</textarea></div><div class="govuk-form-group${cm ? ' govuk-form-group--error' : ''}" data-group="dg-count"><label class="govuk-label" for="dg-count${sfx}">The All count in the panel</label><div id="dg-count${sfx}-hint" class="govuk-hint">The number beside All.</div>${cm ? fieldMsg('dg-count' + sfx, cm) : ''}<input class="govuk-input govuk-input--width-3${cm ? ' govuk-input--error' : ''}" id="dg-count${sfx}" name="count" type="text" inputmode="numeric" value="${opts.count ?? ''}" data-req="Type the All count shown in Taxprep" aria-describedby="dg-count${sfx}-hint${cm ? ' dg-count' + sfx + '-error' : ''}"></div></div>${sbtn('Check the list', 'data-primary')}</form>`
  }
  const counts = (rows) => D.DIAG_SEV_ORDER.map((s) => [s, rows.filter((r) => r[0] === s).length])
  const dcounts = counts(D.DIAG)
  const diagRows = (rows, withState = true) => rows.map((r, i) => {
    const sevCls = { 'Filing error': 'red', Error: 'red', Warning: 'yellow', Informative: 'blue' }[r[0]]
    const key = `${r[1]}${r[2] ? '_' + r[2] : ''}`
    const act = r[0] === 'Filing error' || r[0] === 'Error' ? 'Fix in Taxprep, paste again (no override)' : r[0] === 'Warning' ? `<button type="button" class="app-linkbtn" data-act="diag-open" data-key="${esc(key)}" data-kind="warning" data-edit>Give a reason</button>` : `<button type="button" class="app-linkbtn" data-act="diag-open" data-key="${esc(key)}" data-kind="info" data-edit>Give a logged reason</button>`
    return `<tr class="govuk-table__row" data-diag="${esc(key)}" data-sev="${r[0]}" data-open="1"><th scope="row" class="govuk-table__header">${tag(sevCls, r[0])}</th>${cell(esc(r[1]))}${cell(esc(r[2] || 'none'))}${cell(esc(r[3]))}${cell(esc(r[4]))}<td class="govuk-table__cell" data-diag-state>${act}</td></tr>`
  })
  const diagTable = (rows, id) => `<form class="app-filter-row" data-filter-form="${id}" role="search" aria-label="Filter diagnostics"><div class="govuk-form-group"><label class="govuk-label" for="${id}-sev">Show category</label><select class="govuk-select" id="${id}-sev" data-filter-select><option value="">All categories</option>${D.DIAG_SEV_ORDER.map((s) => `<option>${s}</option>`).join('')}</select></div><p class="govuk-body app-count-line" data-filter-count>Showing ${rows.length} of ${rows.length}</p></form>` + `<div class="app-scroll app-g3-rows" role="region" aria-label="Diagnostics, scrollable" tabindex="0"><table class="govuk-table app-dense" id="${id}" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-visually-hidden">Diagnostics. Rows you can clear with a reason come first, then Error and Filing error rows, which are fixed in Taxprep</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header" aria-sort="none">Category</th><th scope="col" class="govuk-table__header" aria-sort="none">Code</th><th scope="col" class="govuk-table__header" aria-sort="none">Cell</th><th scope="col" class="govuk-table__header">Form</th><th scope="col" class="govuk-table__header">Text</th><th scope="col" class="govuk-table__header">What to do</th></tr></thead><tbody class="govuk-table__body">${diagRows([...rows].sort((x, y) => ({ Warning: 0, Informative: 1, Error: 2, 'Filing error': 3 }[x[0]] - { Warning: 0, Informative: 1, Error: 2, 'Filing error': 3 }[y[0]]))).join('')}</tbody></table></div>`
  const reasonForm = (sfx) => `<form data-form="diag-reason" class="app-g3-inline" data-edit hidden novalidate>${summary()}<div class="govuk-form-group" data-group="diag-reason"><label class="govuk-label" for="diag-reason${sfx}"><span data-diag-reason-label>Reason</span> (saved under ${D.PREPARER})</label><div id="diag-reason${sfx}-hint" class="govuk-hint" data-diag-reason-hint>A Warning needs your written reason; the CPA sees it in the brief.</div><textarea class="govuk-textarea" id="diag-reason${sfx}" rows="2" data-req="Write the reason" aria-describedby="diag-reason${sfx}-hint" autocomplete="off"></textarea></div><div class="app-actions">${sbtn('Save the reason', 'data-act="diag-reason"')}${btn('Cancel', 'data-act="cancel"', 'govuk-button--secondary')}</div></form>`
  const catLine = (c) => c.map((x) => `${x[0]}: ${x[1]}`).join('; ')
  const blockNote = `<p class="govuk-body">An Error or Filing error blocks sign-off and has no override. A Warning needs a named reason of yours, shown to the CPA. An Informative may stay with a logged reason. A Hidden or Ignored row never counts as cleared. An unknown code or unknown category counts as an Error until a person classes it.</p>`
  const notClearedN = dcounts.reduce((a, c) => a + c[1], 0)
  const goneRows = D.DIAG_GONE.map((r) => `<li class="app-g3-inline" data-gone="${esc(r[1])}"><p class="govuk-body"><strong>${esc(r[1])}</strong> (${esc(r[2])}): ${esc(r[4])} <span data-gone-state><button type="button" class="app-linkbtn" data-act="gone-ack" data-gone="${esc(r[1])}" data-edit>Acknowledge it is gone</button></span></p></li>`).join('')
  out.diag = h('diag', 'Diagnostics') + [
    scene('paste', 'progress', 'Paste the list', `<p class="govuk-body">Diagnostics are not on the printed return. Copy them from Taxprep and paste them here, with the count Taxprep shows.</p>${pasteForm({}, '-a')}${blockNote}`),
    scene('paste-error', 'refused', 'Paste the list', pasteForm({ err: true }, '-b')),
    scene('paste-filled', 'progress', 'Ready to check', `<p class="govuk-body">The day 3 probe list of 23 rows, pasted. Press Check to read it.</p>${pasteForm({ text: true, count: dcounts.reduce((a, c) => a + c[1], 0) }, '-c')}`),
    scene('result', 'blocked', `${notClearedN} not cleared`, `<p class="govuk-body">${D.DIAG.length} rows read; you typed ${D.DIAG.length} from the panel, so the list is complete. By category: ${catLine(dcounts)}. <span data-count="diag-open" data-scope="not cleared">${notClearedN} not cleared</span>.</p>${blockNote}${diagTable(D.DIAG, 'diag-all')}${reasonForm('-a')}`),
    scene('incomplete', 'refused', 'List incomplete', pasteForm({ text: true, count: 25, countMsg: `The count you typed (25) does not match the ${D.DIAG.length} rows pasted. Paste the whole All tab, or correct the count` }, '-d')),
    scene('gone', 'blocked', `${D.DIAG_GONE.length} gone, ${notClearedN - D.DIAG_GONE.length} not cleared`, `<p class="govuk-body">Compared with your earlier paste, <span data-count="gone-n" data-scope="gone">${D.DIAG_GONE.length} diagnostics are gone</span>. A row that is gone does not count as cleared until you acknowledge it.</p><ul class="govuk-list" data-gone-list>${goneRows}</ul><h2 class="govuk-heading-s">Still in the list</h2><p class="govuk-body"><span data-count="diag-open" data-scope="not cleared">${notClearedN - D.DIAG_GONE.length} not cleared</span>.</p>${diagTable(D.DIAG.filter((r) => !D.DIAG_GONE.some((g) => g[1] === r[1])), 'diag-left')}${reasonForm('-b')}`),
    scene('clean', 'complete', 'All cleared', `<p class="govuk-body">After the identification was fixed in Taxprep and the list pasted again, ${D.DIAG_CLEAN.length} rows remain, each with a reason. <span data-count="diag-open" data-scope="not cleared">0 not cleared</span>.</p><div class="app-scroll app-g3-rows" role="region" aria-label="Diagnostics with reasons, scrollable" tabindex="0"><table class="govuk-table app-dense" id="diag-clean"><caption class="govuk-table__caption govuk-visually-hidden">Remaining diagnostics, each with a reason</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Category</th><th scope="col" class="govuk-table__header">Code</th><th scope="col" class="govuk-table__header">Reason</th></tr></thead><tbody class="govuk-table__body"><tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${tag('yellow', 'Warning')}</th>${cell('E2099')}${cell('Contact province typed as BC; Taxprep format only. ' + D.PREPARER + ', 3 Oct 2026.')}</tr><tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${tag('yellow', 'Warning')}</th>${cell('E2105')}${cell('Same as E2099, second contact. ' + D.PREPARER + ', 3 Oct 2026.')}</tr><tr class="govuk-table__row"><th scope="row" class="govuk-table__header">${tag('blue', 'Informative')}</th>${cell('P71')}${cell('Late-filing note is expected: onboarding was after year end. Logged.')}</tr></tbody></table></div>`),
    cannot(STEPS[4]),
  ].join('')
  // ---- Cite and explain
  out.cite = h('cite', 'Cite and explain') + [
    scene('todo', 'progress', '6 cells need action', `<p class="govuk-body">Every cell that needs a source or a written reason is in Trace, beside the tax choices typed in Taxprep. Cite and explain is its own step; it opens Trace.</p><ul class="govuk-list govuk-list--bullet"><li>2 orphans</li><li>3 overridden cells</li><li>1 dropped cell (re-import)</li><li>0 changed outside the trace</li></ul><a class="govuk-button" role="button" draggable="false" href="${BLOCK}record.html#/trace" data-module="govuk-button">Open Trace</a>`),
    scene('done', 'complete', 'Nothing left', `<p class="govuk-body">No orphan, override or dropped cell is left.</p>`),
    cannot(STEPS[5]),
  ].join('')
  // ---- Sign off
  out.signoff = h('signoff', 'Sign off') + [
    scene('blocked', 'cannot', 'Appears when nothing blocks', `<p class="govuk-body">There is no sign button until nothing blocks. Still blocking:</p><ul class="govuk-list govuk-list--bullet"><li><a class="govuk-link" href="${BLOCK}record.html#/trace">2 orphans with no source</a></li><li><a class="govuk-link" href="${BLOCK}record.html#/trace">3 overrides with no reason</a></li><li><a class="govuk-link" href="#/roundtrip/import.reimport">1 dropped cell</a></li><li><a class="govuk-link" href="#/roundtrip/diag.result">${notClearedN} diagnostics not cleared</a></li></ul>`),
    scene('ready', 'complete', 'Nothing blocks', `<p class="govuk-body">Nothing blocks. Sign and send to review is on the Hand-off step.</p><a class="govuk-button" role="button" draggable="false" href="${BLOCK}record.html#/handoff" data-module="govuk-button">Go to Hand-off</a>`),
    cannot(STEPS[6]),
  ].join('')
  return out
}
function rtView(ret, layout) {
  const bodies = rtBodies(ret, layout)
  const itemHtml = (s, i) => `<li class="govuk-task-list__item govuk-task-list__item--with-link" data-rt-item="${s.id}"><div class="govuk-task-list__name-and-hint"><a class="govuk-link govuk-task-list__link" href="#/roundtrip/${s.id}" data-open-step="${s.id}">${i + 1}. ${s.name}</a><div class="govuk-task-list__hint" data-rt-hint>${s.needs ? 'Needs ' + esc(s.needs) : 'Upload the .GFI from QuickBooks Online'}</div></div><div class="govuk-task-list__status" data-rt-status>${tag('grey', 'Cannot start yet')}</div></li>`
  const count = `<p class="govuk-body app-g3-rt-count"><span data-count="rt-steps" data-scope="steps complete">0 of 6 steps complete</span></p>`
  const head = `<div class="app-g3-titlerow"><h1 class="govuk-heading-m" id="rt-title">Round trip</h1>${count.replace(' app-g3-rt-count', ' govuk-body-s')}</div>`
  const bodyEl = (s) => `<div class="app-g3-body" data-body="${s.id}" hidden>${bodies[s.id]}</div>`
  if (layout === 'a') {
    return `<div class="app-g3-view" data-view="roundtrip" data-title="Round trip" hidden><div class="app-g3-split app-g3-split--rt"><div class="app-g3-list">${head}<nav aria-label="Round trip checklist"><ol class="govuk-task-list app-g3-rt-list">${STEPS.map(itemHtml).join('')}</ol></nav></div><div class="app-g3-detail" tabindex="-1" data-detail>${STEPS.map(bodyEl).join('')}</div></div></div>`
  }
  const sec = (s, i) => itemHtml(s, i).replace('</li>', `${bodyEl(s)}</li>`)
  return `<div class="app-g3-view" data-view="roundtrip" data-title="Round trip" hidden>${head}<nav aria-label="Round trip checklist"><ol class="govuk-task-list app-g3-rt-list">${STEPS.map(sec).join('')}</ol></nav></div>`
}

// ================================================================ page shell
const RAIL = [['Checklist', BLOCK + 'record.html#/checklist'], ['Evidence and facts', BLOCK + 'record.html#/evidence'], ['Gap review', '#/gaps', 'gaps'], ['Round trip', '#/roundtrip', 'roundtrip'], ['Trace', BLOCK + 'record.html#/trace'], ['Exceptions', BLOCK + 'record.html#/exceptions'], ['CPA comments', BLOCK + 'record.html#/comments'], ['Hand-off', BLOCK + 'record.html#/handoff']]
function page(ret, layout) {
  const V = VERSIONS[layout]
  const n = D.GAPS[ret.key].length
  const rail = RAIL.map((r) => `<li><a href="${r[1]}"${r[2] ? ` data-goto="${r[2]}" data-step="${r[2]}"` : ''}><span>${r[0]}</span>${r[2] === 'gaps' ? `<span class="moj-notification-badge" data-badge="gaps"><span data-n>${n}</span><span class="govuk-visually-hidden"> to review</span></span>` : ''}</a></li>`).join('')
  const keys = [['/ or s', 'Search'], ['n', 'Next open question'], ['p', 'Previous open question'], ['r', 'Keep and next'], ['o', 'Open the source'], ['?', 'This list']]
  const keyTable = `<details class="govuk-details app-keys" id="keys-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts</span></summary><div class="govuk-details__text"><table class="govuk-table app-dense"><caption class="govuk-table__caption govuk-visually-hidden">Keyboard shortcuts</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Key</th><th scope="col" class="govuk-table__header">Does</th></tr></thead><tbody class="govuk-table__body">${keys.map((k) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><kbd>${k[0]}</kbd></th><td class="govuk-table__cell">${k[1]}</td></tr>`).join('')}</tbody></table><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="keys-on" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="keys-on">Single-key shortcuts on</label></div></div><p class="govuk-body-s">No key drops, approves or sends anything; a key only moves focus or marks reviewed and moves on.</p></div></details>`
  const title = `Gap review - ${ret.name} - Ashbridge Tax`
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="../../vendor/govuk-frontend.min.css">
<link rel="stylesheet" href="../../vendor/moj-frontend.min.css">
<link rel="stylesheet" href="../../b-split-pane/assets/b.css">
<link rel="stylesheet" href="../assets/g3.css">
</head>
<body class="govuk-template__body app-g3-${layout}" data-layout="${layout}" data-return="${ret.key}" data-return-name="${esc(ret.name)}" data-name="${esc(D.PREPARER)}">
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
<header class="govuk-header" data-module="govuk-header"><div class="govuk-header__container govuk-width-container app-wide"><div class="govuk-header__logo"><a href="${BLOCK}queue.html" class="govuk-header__homepage-link app-logo" aria-label="Ashbridge Tax, home">Ashbridge Tax</a></div><div class="app-topbar"><div class="app-topbar__inner"><p class="app-topbar__name govuk-body">Preparer workbench</p><nav aria-label="Menu"><ul><li><a class="govuk-link" href="${BLOCK}queue.html?back=1">Queue</a></li><li><a class="govuk-link" href="states.html">All states</a></li><li><a class="govuk-link" href="${BLOCK}signed-out.html">Sign out</a></li></ul></nav><span class="govuk-body-s govuk-!-margin-0">${esc(D.PREPARER)}</span><form class="moj-search" role="search" aria-label="Site search" action="${BLOCK}results.html" method="get"><label class="govuk-label moj-search__label govuk-visually-hidden" for="site-search">Search</label><input class="govuk-input moj-search__input" id="site-search" name="q" type="search" aria-keyshortcuts="/ s"><button type="submit" class="govuk-button moj-search__button" data-module="govuk-button">Search</button></form></div></div></div></header>
<div class="app-return-bar"><div class="govuk-width-container app-wide"><div class="moj-identity-bar" data-identity-bar role="region" aria-label="Return"><div class="moj-identity-bar__container"><div class="moj-identity-bar__details"><h2 class="moj-identity-bar__title">${esc(ret.name)}</h2><span>Year end ${ret.ye}</span><span data-stage-tag>${tag('blue', 'Prepare')}</span>${tag('grey', 'Tier ' + ret.tier)}<span>Filing due ${ret.due}</span><span class="app-hold" data-hold-text>Held by you</span></div></div></div></div></div>
<div class="app-tabs"><div class="govuk-width-container app-wide"><nav class="moj-sub-navigation" aria-label="Return tabs"><ul class="moj-sub-navigation__list"><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${BLOCK}shell-other.html?tab=Overview">Overview</a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" aria-current="page" href="record-${ret.key}.html#/gaps">Workbench</a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${BLOCK}shell-other.html?tab=Review">Review</a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${BLOCK}shell-other.html?tab=Documents">Documents</a></li><li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="${BLOCK}shell-other.html?tab=History">History</a></li></ul></nav></div></div>
<div class="govuk-width-container app-wide">
<main class="govuk-main-wrapper govuk-!-padding-top-1" id="main-content">
<div class="app-g3-ws">
<nav class="app-steps" aria-label="Workbench steps"><h2 class="govuk-heading-s">Steps, in order</h2><ol>${rail}</ol>${keyTable}</nav>
<div class="app-g3-content">
${gapsView(ret, layout)}
${rtView(ret, layout)}
</div>
</div>
</main></div>
<footer class="govuk-footer"><div class="govuk-width-container app-wide"><div class="govuk-footer__meta"><div class="govuk-footer__meta-item govuk-footer__meta-item--grow"><span class="govuk-footer__licence-description">Ashbridge Tax staff system. Design prototype (${V.name}) with made-up sample clients only.</span></div></div></div></footer>
<div id="live" class="app-live" role="status" aria-live="polite"></div>
<script type="module" src="../assets/g3.js"></script>
</body>
</html>
`
}

// ================================================================ second window, states, index, parts
function sourceWindow() {
  const data = JSON.stringify(Object.fromEntries(Object.entries(D.SOURCES).map(([k, s]) => [k, s])))
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template"><head><meta charset="utf-8"><title>Source, second window - Ashbridge Tax</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="../../vendor/govuk-frontend.min.css"><link rel="stylesheet" href="../../vendor/moj-frontend.min.css"><link rel="stylesheet" href="../../b-split-pane/assets/b.css"><link rel="stylesheet" href="../assets/g3.css"></head>
<body class="govuk-template__body"><script>document.body.className += ' js-enabled';</script><a href="#main-content" class="govuk-skip-link">Skip to main content</a>
<header class="govuk-header"><div class="govuk-header__container govuk-width-container app-wide"><div class="govuk-header__logo"><span class="govuk-header__homepage-link app-logo">Ashbridge Tax</span></div></div></header>
<div class="app-g3-sw"><main id="main-content"><h1 class="govuk-heading-m">Source, second window</h1><p class="govuk-body" id="sw-for">Waiting for a selection in the workbench window.</p>
<div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="sw-follow" type="checkbox" checked><label class="govuk-label govuk-checkboxes__label" for="sw-follow">Follow the workbench window</label></div></div>
<div class="app-viewer"><h2 class="govuk-heading-s" id="sw-title">No source selected yet</h2><div class="app-viewer__box app-viewer__box--tall" id="sw-box" tabindex="0" role="region" aria-label="Source excerpt"></div><p class="govuk-body-s app-viewer__cap" id="sw-cap"></p></div></main></div>
<div id="live" class="app-live" role="status" aria-live="polite"></div>
<script id="sw-data" type="application/json">${data.replace(/</g, '\\u003c')}</script>
<script src="../assets/g3-window.js"></script>
</body></html>
`
}
const PRESETS_GAPS = [
  ['fresh', 'Normal: nothing reviewed yet (draft questions)'],
  ['edit', 'Edit slot values (a question open for editing)'],
  ['editerror', 'Error: save slot values with every slot empty'],
  ['merge', 'Merge: choose the question to merge into'],
  ['drop', 'Drop: the reason box'],
  ['droperror', 'Error: drop with no reason'],
  ['bank', 'Add from the bank: choose a bank question'],
  ['partial', 'Partly reviewed: one merged, one edited, one dropped, two open'],
  ['ready', 'All reviewed, slots filled: the sign button appears'],
  ['refused', 'Error: sign refused, each empty slot named'],
  ['signed', 'Approved: gap list signed'],
  ['held', 'Held by another person: read-only'],
]
function statesPage(layout) {
  const V = VERSIONS[layout]
  const li = (href, t) => `<li><a class="govuk-link" href="${href}">${esc(t)}</a></li>`
  const rtScenes = (ret, list) => list.map(([s, t]) => li(`record-${ret}.html#/roundtrip/${s}`, t)).join('')
  const gfi = [['gfi.before', 'Before upload'], ['gfi.read', 'Read, no flag left'], ['gfi.flagged', 'Read, flagged for a person (accept a change with a reason)'], ['gfi.refused-header', 'Refused: header only (pick T2 Corporation on the Tax mapping tab)'], ['gfi.refused-layout', 'Refused: layout mismatch'], ['gfi.refused-calc', 'Refused: a code CRA calculates, counted as unmapped'], ['gfi.refused-unknown', 'Refused: unknown code']]
  const imp = [['import.ready', 'Import file: new natural key to the next free copy, rows waiting on verification'], ['import.reimport', 'Re-import: changed and cleared cells only'], ['import.held', 'Taxprep still holds: clear in the next file, with a reason']]
  const tp = [['taxprep.todo', 'In Taxprep: import, tax choices, lock, Ready'], ['taxprep.done', 'After Ready: the return is in Trace']]
  const up = [['upload.form', 'Upload form (one form, two files)'], ['upload.accepted', 'Accepted: count for each class'], ['upload.accepted-bn', 'Accepted with the flag: business number not entered'], ...Object.entries(D.REFUSALS).map(([k, r]) => ['upload.' + k, 'Refused: ' + r.title])]
  const dg = [['diag.paste', 'Paste box and instructions'], ['diag.paste-error', 'Error: nothing pasted, no count typed'], ['diag.paste-filled', 'Pasted list ready to check (day 3 probe rows)'], ['diag.result', 'Result by category, 23 not cleared'], ['diag.incomplete', 'List incomplete: counts differ'], ['diag.gone', 'Gone since the earlier paste: acknowledge'], ['diag.clean', 'Every diagnostic cleared']]
  const end = [['cite.todo', 'Cite and explain: opens Trace'], ['signoff.blocked', 'Sign off absent: what still blocks, as links'], ['signoff.ready', 'Sign off: nothing blocks']]
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template"><head><meta charset="utf-8"><title>All states, gap review and round trip (${V.name}) - Ashbridge Tax</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="../../vendor/govuk-frontend.min.css"><link rel="stylesheet" href="../../vendor/moj-frontend.min.css"><link rel="stylesheet" href="../../b-split-pane/assets/b.css"><link rel="stylesheet" href="../assets/g3.css"></head>
<body class="govuk-template__body"><script>document.body.className += ' js-enabled';</script><a href="#main-content" class="govuk-skip-link">Skip to main content</a>
<header class="govuk-header"><div class="govuk-header__container govuk-width-container app-wide"><div class="govuk-header__logo"><a href="../index.html" class="govuk-header__homepage-link app-logo" aria-label="Ashbridge Tax, home">Ashbridge Tax</a></div><div class="app-topbar"><div class="app-topbar__inner"><p class="app-topbar__name govuk-body">Design prototypes</p><form class="moj-search" role="search" aria-label="Site search" action="${BLOCK}results.html" method="get"><label class="govuk-label moj-search__label govuk-visually-hidden" for="site-search">Search</label><input class="govuk-input moj-search__input" id="site-search" name="q" type="search"><button type="submit" class="govuk-button moj-search__button" data-module="govuk-button">Search</button></form></div></div></div></header>
<div class="govuk-width-container app-wide"><main class="govuk-main-wrapper" id="main-content"><h1 class="govuk-heading-l">All states: gap review and round trip, ${V.name}</h1>
<p class="govuk-body">Made-up sample clients only. Every link opens the return in that state; the first action is the one a person takes next. The queue is not drawn here: <a class="govuk-link" href="${BLOCK}queue.html">open the queue (version B of the workbench)</a>.</p>
<h2 class="govuk-heading-m">Gap review (D07)</h2>
<h3 class="govuk-heading-s">Maple Ridge Consulting Inc. (Test), 5 draft questions</h3><ul class="govuk-list govuk-list--bullet">${PRESETS_GAPS.map(([k, t]) => li(`record-maple.html#/gaps/${k}`, t)).join('')}</ul>
<h3 class="govuk-heading-s">Halton Haulage Ltd. (Test), 4 draft questions</h3><ul class="govuk-list govuk-list--bullet">${li('record-halton.html#/gaps/fresh', 'Normal: nothing reviewed yet')}${li('record-halton.html#/gaps/partial', 'Partly reviewed')}${li('record-halton.html#/gaps/signed', 'Approved: gap list signed')}</ul>
<h3 class="govuk-heading-s">Danforth Cleaning Services Inc. (Test), no gaps</h3><ul class="govuk-list govuk-list--bullet">${li('record-danforth.html#/gaps/fresh', 'Empty: Nothing to ask, with the sign button')}${li('record-danforth.html#/gaps/signed', 'Approved: signed with Nothing to ask')}</ul>
<h2 class="govuk-heading-m">Round trip (D05), the task list in RV-21's order</h2>
<h3 class="govuk-heading-s">1 GIFI mapping (Maple Ridge)</h3><ul class="govuk-list govuk-list--bullet">${rtScenes('maple', gfi)}</ul>
<h3 class="govuk-heading-s">2 Import file</h3><ul class="govuk-list govuk-list--bullet">${rtScenes('maple', imp)}${li('record-halton.html#/roundtrip/import.heldback', 'Halton Haulage: no export since the return was created, new rows held back')}</ul>
<h3 class="govuk-heading-s">3 In Taxprep</h3><ul class="govuk-list govuk-list--bullet">${rtScenes('maple', tp)}</ul>
<h3 class="govuk-heading-s">4 Upload</h3><ul class="govuk-list govuk-list--bullet">${rtScenes('maple', up)}</ul>
<h3 class="govuk-heading-s">5 Diagnostics</h3><ul class="govuk-list govuk-list--bullet">${rtScenes('maple', dg)}</ul>
<h3 class="govuk-heading-s">6 Cite and explain, 7 Sign off</h3><ul class="govuk-list govuk-list--bullet">${rtScenes('maple', end)}</ul>
<h2 class="govuk-heading-m">Other</h2><ul class="govuk-list govuk-list--bullet">${li('source-window.html', 'The second window on its own')}${li('PARTS.md', 'Parts used, and what was composed with the reason')}</ul>
</main></div>
<footer class="govuk-footer"><div class="govuk-width-container app-wide"><div class="govuk-footer__meta"><div class="govuk-footer__meta-item govuk-footer__meta-item--grow"><span class="govuk-footer__licence-description">Ashbridge Tax staff system. Design prototype with made-up sample clients only.</span></div></div></div></footer>
</body></html>
`
}
function indexPage() {
  return `<!DOCTYPE html>
<html lang="en" class="govuk-template"><head><meta charset="utf-8"><title>Gap review and round trip, two versions - Ashbridge Tax</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="../vendor/govuk-frontend.min.css"><link rel="stylesheet" href="../vendor/moj-frontend.min.css"><link rel="stylesheet" href="../b-split-pane/assets/b.css"></head>
<body class="govuk-template__body"><a href="#main-content" class="govuk-skip-link">Skip to main content</a>
<header class="govuk-header"><div class="govuk-header__container govuk-width-container"><div class="govuk-header__logo"><a href="../index.html" class="govuk-header__homepage-link app-logo" aria-label="Ashbridge Tax, home">Ashbridge Tax</a></div></div></header>
<div class="govuk-width-container"><main class="govuk-main-wrapper" id="main-content"><h1 class="govuk-heading-l">Gap review and round trip: two versions</h1>
<p class="govuk-body">Designer 4, cards D07 (Gap review) and D05 (the Gaps and Round trip steps). Both build on version B of the workbench (steps on the left) and differ in structure. Made-up sample clients only.</p>
<ul class="govuk-list govuk-list--bullet">
<li><a class="govuk-link" href="a-list-detail/record-maple.html#/gaps">Version A, list and detail</a>: the questions in a list with the source and the decision in a pinned pane; the round trip as a task list on the left and the open step on the right. <a class="govuk-link" href="a-list-detail/states.html">All states</a>, <a class="govuk-link" href="a-list-detail/PARTS.md">parts</a>.</li>
<li><a class="govuk-link" href="b-one-column/record-maple.html#/gaps">Version B, one column</a>: one question at a time, work on the left and its source on the right, the list folded away; the round trip as the task list with the open step expanded under its row. <a class="govuk-link" href="b-one-column/states.html">All states</a>, <a class="govuk-link" href="b-one-column/PARTS.md">parts</a>.</li>
</ul></main></div></body></html>
`
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage())
for (const [k, V] of Object.entries(VERSIONS)) {
  const dir = path.join(OUT, V.dir)
  fs.mkdirSync(dir, { recursive: true })
  for (const ret of Object.values(D.RETURNS)) fs.writeFileSync(path.join(dir, `record-${ret.key}.html`), page(ret, k))
  fs.writeFileSync(path.join(dir, 'states.html'), statesPage(k))
  fs.writeFileSync(path.join(dir, 'source-window.html'), sourceWindow())
}
console.log('built', Object.values(VERSIONS).map((v) => v.dir).join(', '))
