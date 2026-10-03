// The return record: one identity bar and one set of record tabs for every role (staff-screens rule 23).
// One page per return. A tab change is a client-side route (#overview, #documents/2 ...), 0 page loads (rule 18).
// The page is written for the default signed-in user (Aisha, preparer); static/app.js shows or hides the parts each role sees.
import { STATES, stateInfo, bySlug, HOLD_HOURS, esc, fmt, diffDays, rel, stateTag, tierTag, waitTag, voidTag, person, page, simpleTable, isDone, idx, order, holdable, hint, alertBox } from './lib.mjs'

export const TABS = [['overview', 'Overview'], ['workbench', 'Workbench'], ['review', 'Review'], ['documents', 'Documents'], ['exceptions', 'Exceptions'], ['history', 'History'], ['ops', 'Ops']]
const DEFAULT_USER = 'aisha'
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// who sees a part: roles are preparer, cpa, ops, owner. The page is written for the preparer.
const forRoles = (roles) => ` data-roles="${roles}"${roles.split(' ').includes('preparer') ? '' : ' hidden'}`
const forAssigned = (r) => ` data-assigned${r.prep === DEFAULT_USER ? '' : ' hidden'}`
const forOthers = (r) => ` data-not-assigned${r.prep === DEFAULT_USER ? ' hidden' : ''}`

export const nextStep = (r) => {
  const p = r.prep ? person(r.prep) : 'A preparer'
  const who = {
    intake: 'The system creates the return from client-app data.',
    evidence: 'Ops and the system read documents and capture the CRA data.',
    gaps: `${p} signs the question list, or confirms there is nothing to ask.`,
    qa: 'The client answers in the client app, or the no-response rule applies.',
    build: 'The system writes the import file and saves the AI draft.',
    prepare: `${p} uploads the lock export and the printed return, reads the tax choices and presses Ready.`,
    trace: 'The system and the preparer clear every orphan cell and unexplained override.',
    respond: `${p} answers every exception and signs.`,
    review: `${person('dana')} reviews the full return and approves, or sends comments.`,
    rework: `${p} re-traces and re-checks the changed cells, then signs.`,
    approved: 'Ops sends T183CORP to the client.',
    client_sign: 'The client signs in CCH Digital Signature; ops uploads the signed certificate.',
    ready_to_file: 'Ops uploads the check export, which must match the approval, then transmits and enters the confirmation number.',
    filed: 'Ops saves the notice of assessment and compares it.',
    assessed: 'The system freezes the binder.',
    closed: 'Nothing. The return is closed and read only.',
  }
  return who[r.state]
}

// ---------- the hold (FLOW-10): not held, held by you, held by another, expired ----------
export const holdText = (r, me = DEFAULT_USER) => {
  const h = r.hold
  if (h && h.kind === 'held') return h.by === me ? `Held by you, ends ${h.ends} if idle.` : `Held by ${person(h.by)}, ends ${h.ends} if idle.`
  if (h && h.kind === 'expired') return `Ended ${h.endedAt}: ${person(h.by)} was idle for ${HOLD_HOURS} hours.`
  if (r.state === 'closed') return 'None. The return is closed and read only.'
  return 'Nobody holds this return.'
}
const holdData = (r) => {
  const h = r.hold
  return { kind: h ? h.kind : 'none', by: h ? h.by : '', byName: h ? person(h.by) : '', ends: h && h.ends ? h.ends : '', endedAt: h && h.endedAt ? h.endedAt : '', holdable: holdable(r), hours: HOLD_HOURS }
}

// ---------- the identity bar ----------
const when = (iso, done) => (done ? fmt(iso) : `${fmt(iso)} (${diffDays(iso) < 0 ? `${-diffDays(iso)} days overdue` : rel(iso)})`)
const actionButton = (key, label) => `<button type="button" class="govuk-button govuk-button--secondary moj-button-menu__item" data-module="govuk-button" data-action="${key}">${label}</button>`

function identity(r) {
  const done = isDone(r)
  const hd = holdData(r)
  const actions = []
  if (r.prep === DEFAULT_USER && hd.holdable) {
    if (hd.kind === 'held' && hd.by === DEFAULT_USER) actions.push(actionButton('release', 'Release the hold'))
    else if (hd.kind !== 'held') actions.push(actionButton('take', 'Take the hold'))
  }
  if (r.waiting) actions.push(actionButton('chase', 'Record a chase'))
  const other = r.other ? bySlug[r.other] : null
  const fact = (k, v, extra = '') => `<div class="app-fact"${extra}><dt>${k}</dt> <dd>${v}</dd></div>`
  const facts = [
    fact('Preparer', esc(r.prep ? person(r.prep) : 'Nobody yet')),
    fact('CPA', esc(person(r.cpa))),
    fact('Business number', esc(r.bn)),
    fact('Filing due', when(r.filing, done)),
    fact('Balance due', when(r.balance, done)),
    fact('Hold', `<span data-hold-text tabindex="-1">${esc(holdText(r))}</span>`, ' data-hold'),
    fact('Blocked by', r.blocker ? `<a class="govuk-link" href="#${r.blockerLink || 'overview'}" data-route="${r.blockerLink || 'overview'}">${esc(r.blocker)}</a>` : 'Nothing'),
  ]
  if (other) facts.push(fact('Group', `${esc(r.group)}: <a class="govuk-link" href="rec-${other.slug}.html">${esc(other.name)}, year end ${fmt(other.ye)}</a>`))
  const menu = actions.length
    ? `<div class="moj-identity-bar__actions"><div class="moj-identity-bar__menu"><div class="moj-button-menu" data-module="moj-button-menu" data-button-classes="govuk-button--secondary" data-align-menu="right">${actions.join('')}</div></div></div>`
    : '<div class="moj-identity-bar__actions" hidden><div class="moj-identity-bar__menu"><div class="moj-button-menu"></div></div></div>'
  return `<div class="moj-identity-bar" data-identity-bar>
<div class="moj-identity-bar__container">
<div class="moj-identity-bar__details">
<div class="app-identity-title"><h1 class="moj-identity-bar__title">${esc(r.name)}, year end ${fmt(r.ye)}</h1> <span data-state-tag>${stateTag(r.state)}</span> ${tierTag(r.tier)}${r.waiting ? ' ' + waitTag : ''}${r.void ? ' ' + voidTag : ''}</div>
<dl class="app-facts">${facts.join('')}</dl>
<p class="govuk-visually-hidden" role="status" data-hold-announce></p>
</div>
${menu}
</div></div>`
}

// ---------- the strip "Since you last opened this return" ----------
function since(r) {
  const c = r.changesSince
  if (!c) return ''
  const items = []
  if (c.comments) items.push(`<a class="govuk-link" href="#history" data-route="history">${plural(c.comments, 'new comment', 'new comments')} in History</a>`)
  if (c.docs) items.push(`<a class="govuk-link" href="#documents" data-route="documents">${plural(c.docs, 'new document', 'new documents')} in Documents</a>`)
  if (c.events) items.push(`<a class="govuk-link" href="#history" data-route="history">${plural(c.events, 'event', 'events')} in History</a>`)
  return `<div class="govuk-inset-text app-since" data-since><p class="govuk-body govuk-!-margin-bottom-0"><strong>Since you last opened this return (${c.when}):</strong> ${items.join(', ')}.</p></div>`
}

// ---------- panel parts ----------
const DOCS_DEFAULT = [['Chequing statements', 'Client app', 'Read'], ['Prior-year T2 return', 'Client app', 'Read']]
const docsOf = (r) => (r.docs && r.docs.length ? r.docs : DOCS_DEFAULT)
const excOf = (r) => r.exc || []
const histOf = (r) => (r.hist && r.hist.length ? r.hist : [[`Return in ${stateInfo[r.state].label}`, 'System', fmt(r.since), null]])
const statusTag = (s) => (s === 'Read' ? '<strong class="govuk-tag govuk-tag--green">Read</strong>' : s === 'Missing' || s === 'Gap' ? `<strong class="govuk-tag govuk-tag--red">${s}</strong>` : `<strong class="govuk-tag govuk-tag--yellow">${esc(s)}</strong>`)
const sev = (s) => `<strong class="govuk-tag govuk-tag--${s === 'Red' ? 'red' : 'yellow'}">${s === 'Red' ? 'Red flag' : 'Amber flag'}</strong>`
const openTag = (s) => (s === 'Open' ? '<strong class="govuk-tag govuk-tag--orange">Open</strong>' : '<strong class="govuk-tag govuk-tag--green">Answered</strong>')

const docRowsLink = (rows) => rows.map((d, i) => [`<a class="govuk-link" href="#documents/${i + 1}" data-route="documents">${esc(d[0])}</a>`, esc(d[1]), statusTag(d[2])])
const excRows = (rows) => rows.map((e) => [esc(e[0]), sev(e[1]), openTag(e[2])])
const timeline = (hist, n, tl = false) => `<div class="moj-timeline"${tl ? ' data-timeline' : ''}>${hist.slice(0, n).map((h) => `<div class="moj-timeline__item"><div class="moj-timeline__header"><h3 class="moj-timeline__title">${esc(h[0])}</h3><p class="moj-timeline__byline">by ${esc(h[1])}</p></div><p class="moj-timeline__date">${esc(h[2])}${h[3] ? `, move: ${esc(h[3])}` : ''}</p></div>`).join('')}</div>`
const taskList = (items) => `<ul class="govuk-task-list">${items.map(([l, s, h]) => `<li class="govuk-task-list__item${h ? ' govuk-task-list__item--with-link' : ''}"><div class="govuk-task-list__name-and-hint">${h ? `<a class="govuk-link govuk-task-list__link" href="${h}" data-route="${h.slice(1)}">${l}</a>` : `<div>${l}</div>`}</div>${s}</li>`).join('')}</ul>`
const doneT = '<div class="govuk-task-list__status"><strong class="govuk-tag govuk-tag--green">Done</strong></div>'
const cannot = '<div class="govuk-task-list__status govuk-task-list__status--cannot-start-yet">Cannot start yet</div>'

// the panel's h2 names it for assistive technology; the active tab is its visible name, so the heading is not repeated on screen
const panel = (id, h, inner) => `<section class="app-panel" id="panel-${id}" data-panel="${id}" aria-labelledby="h-${id}"${id === 'workbench' ? '' : ' hidden'}><h2 class="govuk-visually-hidden" id="h-${id}">${h}</h2>${inner}</section>`

// ---------- alerts: approved and void (FLOW-5, RT-19, TB-11) ----------
const VOID_WHY = {
  evidence: (r) => `A document changed after the CPA approved. ${r.void.changed} cells in the return changed (${r.void.when}).`,
  export: (r) => `The check export did not match the approval: ${r.void.changed} cells differ (${r.void.when}).`,
  books: (r) => `The books changed in QuickBooks Online after approval: ${r.void.changed} cells changed (${r.void.when}).`,
}
const approvedAlert = (r) => alertBox({ variant: 'success', title: `Approved by ${person(r.approval.by)} on ${r.approval.at}`, html: `<p class="govuk-body govuk-!-margin-bottom-0">The numbers are fixed. A change to any number voids the approval and returns the return to Trace. ${r.state === 'approved' ? 'Ops sends T183CORP next.' : ''}</p>` })
const voidAlert = (r) => alertBox({ variant: 'warning', title: 'Approval is void', html: `<p class="govuk-body govuk-!-margin-bottom-1">${esc(VOID_WHY[r.void.why](r))}</p><p class="govuk-body govuk-!-margin-bottom-0">${esc(person(r.prep))} traces the changed cells again. The CPA then reviews only those cells. <a class="govuk-link" href="#exceptions" data-route="exceptions">See the exceptions</a></p>` })

// ---------- the Ops tab (RV-30): each step is an in-place form of 3 fields or fewer (rule 19) ----------
const STEPS = [
  { k: 'cra', label: 'CRA data capture checklist, saved as a PDF and read into facts', at: 'evidence', form: { file: 'Capture checklist PDF', hint: 'The fixed capture checklist, saved from the CRA account.', btn: 'Save the capture', done: 'CRA data capture saved and read into facts.' } },
  { k: 't183', label: 'T183CORP sent to the client', at: 'approved', form: { none: true, btn: 'Send T183CORP in the client app', done: 'T183CORP sent in the client app. The return is now Client signing.', next: 'client_sign' } },
  { k: 'cert', label: 'T183CORP signed, certificate uploaded', at: 'client_sign', form: { file: 'Signed T183CORP certificate', hint: 'The certificate PDF from CCH Digital Signature.', btn: 'Upload the certificate', done: 'Signed certificate saved. The return is now Ready to file.', next: 'ready_to_file' } },
  { k: 'chk', label: 'Check export uploaded (must match the approval)', at: 'ready_to_file', form: { file: 'Check export from Taxprep', hint: 'The export taken just before transmit.', btn: 'Upload the check export', done: 'Check export matches the approval: 1,204 of 1,204 cells match. Transmit in Taxprep, then enter the confirmation number below.' } },
  { k: 'conf', label: 'Confirmation number entered', at: 'ready_to_file', form: { text: 'Confirmation number', hint: 'The number CRA shows after transmission. Letters and digits only.', btn: 'Save the confirmation number', done: 'Confirmation number saved. The return is now Filed.', next: 'filed' } },
  { k: 'noa', label: 'Notice of assessment saved and compared', at: 'filed', form: { file: 'Notice of assessment PDF', hint: 'The PDF from the CRA account.', btn: 'Save the notice of assessment', done: 'Notice of assessment saved and compared: it matches the filed return.', next: 'assessed' } },
]
const LOCK_WHY = { cra: 'Starts when the return reaches Evidence.', t183: 'Starts after the CPA approves.', cert: 'Starts when T183CORP has been sent.', chk: 'Starts when the client has signed and the certificate is uploaded.', conf: 'Starts after the check export is uploaded and the return is transmitted.', noa: 'Starts after the confirmation number is entered.' }
const doneTag = '<strong class="govuk-tag govuk-tag--green">Done</strong>'
const todoTag = '<strong class="govuk-tag govuk-tag--blue">To do</strong>'
function stepState(r, s) {
  const cur = idx(r.state)
  const doneAt = { cra: idx('gaps'), t183: idx('client_sign'), cert: idx('ready_to_file'), chk: idx('filed'), conf: idx('filed'), noa: idx('assessed') }
  if (cur >= doneAt[s.k]) return 'done'
  if (s.k === 'conf') return 'locked'
  if (s.k === 'cra') return cur === idx('evidence') ? 'todo' : cur < idx('evidence') ? 'locked' : 'done'
  return cur === idx(s.at) ? 'todo' : 'locked'
}
function opsPanel(r) {
  const items = STEPS.map((s, i) => ({ s, st: stepState(r, s), i }))
  const html = items.map(({ s, st, i }) => {
    const f = s.form
    const field = f.none ? '' : `<div class="govuk-form-group" data-field-group data-evidence><label class="govuk-label govuk-label--s" for="f-${s.k}">${f.file || f.text}</label><div class="govuk-hint" id="f-${s.k}-hint">${f.hint}</div><p class="govuk-error-message" id="f-${s.k}-error" hidden><span class="govuk-visually-hidden">Error:</span> <span data-error-text>${f.file ? 'Choose the file to upload' : 'Enter the confirmation number'}</span></p>${f.file ? `<input class="govuk-file-upload" id="f-${s.k}" name="f" type="file" aria-describedby="f-${s.k}-hint">` : `<input class="govuk-input govuk-input--width-20" id="f-${s.k}" name="f" type="text" autocomplete="off" spellcheck="false" aria-describedby="f-${s.k}-hint">`}</div>`
    const form = st !== 'done' ? `<form class="app-opsform" data-roles="ops cpa owner" hidden${st === 'locked' ? ' data-locked' : ''} data-ops-form data-step="${s.k}" data-done="${esc(f.done)}"${f.next ? ` data-after-state="${f.next}"` : ''} novalidate>${field}<button class="govuk-button govuk-!-margin-bottom-0" type="submit" data-module="govuk-button" data-prevent-double-click="true" data-primary>${f.btn}</button></form>` : ''
    const status = st === 'done' ? doneTag : st === 'todo' ? todoTag : 'Cannot start yet'
    const roleNote = st === 'todo' ? `<p class="govuk-hint govuk-!-margin-bottom-0" data-roles="preparer">Ops carries out this step. You can read it here.</p>` : ''
    // a step with no field decides on the step itself, so its name and status are the evidence in view
    return `<li class="app-step" data-step-item="${s.k}" data-step-state="${st}" data-order="${i}"><div class="app-step__head"${st === 'todo' && f.none ? ' data-evidence' : ''}><span class="app-step__name">${s.label}</span><span class="app-step__status" data-status-slot>${status}</span></div>${st === 'locked' ? `<p class="govuk-hint govuk-!-margin-bottom-0" data-lock-why>${LOCK_WHY[s.k]}</p>` : ''}${roleNote}${form}</li>`
  })
  const rank = { todo: 0, locked: 1, done: 2 }
  const sorted = items.map((x, n) => [html[n], x]).sort((a, b) => rank[a[1].st] - rank[b[1].st] || a[1].i - b[1].i).map((x) => x[0])
  const left = items.filter((x) => x.st !== 'done')
  const leftTxt = left.length ? `Left to do on this return: ${left.map((x) => x.s.label.split(',')[0].replace(/ \(.*\)/, '').toLowerCase()).join(', then ')}.` : 'Every ops step is done.'
  return panel('ops', 'Ops steps', `<p class="govuk-visually-hidden" data-ops-left>${leftTxt}</p><p class="govuk-body app-result" role="status" tabindex="-1" data-ops-result hidden></p><div class="govuk-error-summary" data-module="govuk-error-summary" data-disable-auto-focus="true" data-ops-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#ops" data-error-link>Fix the field</a></li></ul></div></div></div><ol class="app-steps">${sorted.join('')}</ol>`)
}

// ---------- the seven panels ----------
function panels(r) {
  const docs = docsOf(r), exc = excOf(r), hist = histOf(r)
  const ps = []
  const isApproved = r.approval && !r.void
  // overview
  {
    let o = ''
    if (r.void) o += voidAlert(r)
    else if (isApproved) o += approvedAlert(r)
    const pos = `${stateInfo[r.state].label} (state ${idx(r.state) + 1} of ${STATES.length}).${idx(r.state) < STATES.length - 1 ? ` Then ${stateInfo[order[idx(r.state) + 1]].label}.` : ''}`
    o += `<div class="govuk-grid-row"><div class="govuk-grid-column-one-half"><h3 class="govuk-heading-s govuk-!-margin-bottom-1">Next step</h3><p class="govuk-body govuk-!-margin-bottom-1">${esc(nextStep(r))}</p><p class="govuk-body govuk-!-margin-bottom-3">${hint('Where it stands: ' + esc(pos))}</p>${r.note ? `<p class="govuk-body govuk-!-margin-bottom-3">${esc(r.note)}</p>` : ''}</div>
<div class="govuk-grid-column-one-half"><h3 class="govuk-heading-s govuk-!-margin-bottom-1">Exceptions</h3>${exc.length ? simpleTable({ hide: true, caption: `Exceptions, ${Math.min(5, exc.length)} of ${exc.length}`, head: ['Exception', 'Flag', 'Answer'], rows: excRows(exc.slice(0, 5)) }) + `<p class="govuk-body"><a class="govuk-link" href="#exceptions" data-route="exceptions">View all ${exc.length} exceptions</a></p>` : '<p class="govuk-body">No exceptions on this return.</p>'}</div></div>`
    o += `<div class="govuk-grid-row"><div class="govuk-grid-column-one-half"><h3 class="govuk-heading-s govuk-!-margin-bottom-1">Documents</h3>${simpleTable({ hide: true, caption: `Documents, ${Math.min(5, docs.length)} of ${docs.length}`, head: ['Document', 'Source', 'Status'], rows: docRowsLink(docs.slice(0, 5)) })}<p class="govuk-body"><a class="govuk-link" href="#documents" data-route="documents">View all ${docs.length} documents</a></p></div>
<div class="govuk-grid-column-one-half"><h3 class="govuk-heading-s govuk-!-margin-bottom-1">Recent history</h3>${timeline(hist, 3)}<p class="govuk-body"><a class="govuk-link" href="#history" data-route="history">View full history</a></p></div></div>`
    if (r.changed) o += `<h3 class="govuk-heading-s govuk-!-margin-bottom-1">Changed cells</h3>${simpleTable({ hide: true, caption: `Changed since approval, ${r.changed} cells (first 3)`, head: ['Line', 'Before', 'After'], numCols: [1, 2], rows: [['Line 8320 Total revenue', '412,310.00', '412,860.00'], ['Line 9270 Other expenses', '18,420.50', '17,990.50'], ['Schedule 8 class 8 addition', '14,500.00', '14,850.00']].map((x) => [x[0], `<span class="app-money">${x[1]}</span>`, `<span class="app-money">${x[2]}</span>`]) })}<p class="govuk-body"><a class="govuk-link" href="#review" data-route="review">View all ${r.changed} changed cells in Review</a></p>`
    ps.push(panel('overview', 'Overview', o))
  }
  // workbench: the preparer's tab. The grid itself is the workbench family's; this tab says where the preparer stands.
  {
    const st = r.state
    const early = idx(st) < idx('prepare')
    const items = early
      ? [['Lock export and printed return uploaded', cannot], ['Tax choices read and cited', cannot], ['Mark Ready', cannot]]
      : st === 'prepare'
        ? [['Lock export and printed return uploaded', '<div class="govuk-task-list__status"><strong class="govuk-tag govuk-tag--orange">Not uploaded</strong></div>', '#documents'], ['Tax choices read and cited, 3 of 5 done', '<div class="govuk-task-list__status"><strong class="govuk-tag govuk-tag--blue">In progress</strong></div>', '#exceptions'], ['Mark Ready', cannot]]
        : [['Lock export and printed return uploaded', doneT, '#documents'], ['Tax choices read and cited', doneT, '#exceptions'], ['Mark Ready', doneT]]
    const pname = r.prep ? person(r.prep) : 'A preparer'
    ps.push(panel('workbench', 'Workbench', `<p class="govuk-body"${forAssigned(r)}>You prepare this return here. Each step opens the tab that holds it.</p><p class="govuk-body"${forOthers(r)}>${esc(pname)} prepares this return here. You can read this tab; only the preparer who holds the return can change it.</p>${taskList(items)}`))
  }
  // review: the CPA's tab
  {
    const inReview = ['review', 'rework'].includes(r.state)
    const cpaText = inReview
      ? `<p class="govuk-body">No section is marked Reviewed yet. Approve appears only when every section is reviewed. ${r.state === 'rework' ? `${r.changed} cells changed since the last approval check.` : `${r.flags} pinned flags are waiting.`}</p>`
      : `<p class="govuk-body">Review has not started. This return is in <strong>${stateInfo[r.state].label}</strong>${idx(r.state) > idx('review') ? ' and has already passed review' : ' and reaches the CPA after Respond'}.</p>`
    ps.push(panel('review', 'Review', `<div${forRoles('cpa owner')}>${cpaText}</div><div${forRoles('preparer ops')}><p class="govuk-body">The CPA reviews the full return here. You can read this tab; review marks and Approve are the CPA's alone.</p>${cpaText}</div>`))
  }
  // documents with the viewer beside the list (rule 20)
  {
    const rows = docs.map((d, i) => [`<button type="button" class="app-linkbutton" data-doc="${i + 1}" data-name="${esc(d[0])}" data-source="${esc(d[1])}" data-status="${esc(d[2])}" data-ret="${esc(r.name)}" data-ye="${fmt(r.ye)}">${esc(d[0])}</button>`, esc(d[1]), statusTag(d[2])])
    ps.push(panel('documents', 'Documents', `<div class="app-docs"><div class="app-docs__list">${simpleTable({ hide: true, sortable: true, caption: `Documents, ${docs.length}, in the order received, oldest first`, head: ['Document', 'Source', 'Status'], rows })}<p class="govuk-hint">Choose a document to read it beside this list. "Send to second window" keeps it on your other screen; it follows each document you choose.</p></div>
<aside class="app-viewer" aria-label="Source viewer" data-viewer tabindex="-1"><p class="govuk-body" data-viewer-empty>Choose a document to read it here.</p><div data-viewer-body hidden></div></aside></div>`))
  }
  // exceptions
  ps.push(panel('exceptions', 'Exceptions', exc.length ? simpleTable({ hide: true, sortable: true, caption: `Exceptions, ${exc.length}, in the order raised, oldest first`, head: ['Exception', 'Flag', 'Answer'], rows: excRows(exc) }) : '<p class="govuk-body">No exceptions on this return.</p>'))
  // history: the chase (a dated staff note, QR16) and the timeline
  {
    let h = ''
    if (r.waiting) {
      // two columns: what is flagged on the left, the chase on the right (the form and its error fit the first screen at 1093 x 525); the result sits under the button, so recording it moves nothing above it
      h += `<div class="govuk-grid-row">
<div class="govuk-grid-column-one-third"><h3 class="govuk-heading-s govuk-!-margin-bottom-1">Waiting on client</h3>
<p class="govuk-body govuk-!-margin-bottom-2">Flag set ${fmt(r.waiting.since)}, ${r.waiting.days} days ago. Last chase: <span data-last-contact>${fmt(r.waiting.last)}, ${esc(r.waiting.lastHow)}</span>.</p></div>
<div class="govuk-grid-column-two-thirds">
<form class="app-opsform" data-chase-form novalidate>
<div class="govuk-error-summary" data-module="govuk-error-summary" data-disable-auto-focus="true" data-chase-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#chase-how" data-chase-error-link>Choose how you chased the client</a></li></ul></div></div></div>
<div class="govuk-form-group" data-chase-group data-evidence>
<fieldset class="govuk-fieldset" aria-describedby="chase-hint"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">How did you chase the client?</legend>
<div id="chase-hint" class="govuk-hint">This records a dated note on the return. It does not send anything to the client.</div>
<p class="govuk-error-message" id="chase-how-error" hidden><span class="govuk-visually-hidden">Error:</span> Choose how you chased the client</p>
<div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">
<div class="govuk-radios__item"><input class="govuk-radios__input" id="chase-how" name="how" type="radio" value="phone"><label class="govuk-label govuk-radios__label" for="chase-how">Phone</label></div>
<div class="govuk-radios__item"><input class="govuk-radios__input" id="chase-how-2" name="how" type="radio" value="email"><label class="govuk-label govuk-radios__label" for="chase-how-2">Email</label></div>
<div class="govuk-radios__item"><input class="govuk-radios__input" id="chase-how-3" name="how" type="radio" value="in person"><label class="govuk-label govuk-radios__label" for="chase-how-3">In person</label></div>
</div></fieldset></div>
<button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true" data-primary>Record the chase</button>
</form>
<p class="govuk-body app-result" role="status" tabindex="-1" data-chase-banner data-chase-banner-text hidden></p>
</div></div>`
    }
    ps.push(panel('history', 'History', h + timeline(hist, 99, true)))
  }
  ps.push(opsPanel(r))
  return ps.join('\n')
}

const nav = () => `<nav class="moj-sub-navigation" aria-label="Sections of this return"><ul class="moj-sub-navigation__list">${TABS.map(([k, l]) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#${k}" data-route="${k}"${k === 'workbench' ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>`

export function recordPage(r) {
  const seq = `<p class="app-listnav" data-listnav><a class="govuk-link" href="queue-a.html" data-back>Back to My returns</a> <a class="govuk-link" href="queue-a.html" data-prev hidden>Previous return</a> <a class="govuk-link" href="queue-a.html" data-next hidden>Next return</a></p>`
  const html = `${identity(r)}${since(r)}<div class="app-tabrow">${nav()}${seq}</div><p class="govuk-visually-hidden" role="status" data-route-status></p>${panels(r)}`
  const rec = { slug: r.slug, name: r.name, ye: fmt(r.ye), prep: r.prep || '', hold: holdData(r), state: r.state, waiting: !!r.waiting }
  return page({ title: 'Workbench', ret: r, nav: '', body: html, bodyClass: 'app-record', ctx: `<script type="application/json" id="rec-data">${JSON.stringify(rec).replace(/</g, '\\u003c')}</script>\n` })
}
