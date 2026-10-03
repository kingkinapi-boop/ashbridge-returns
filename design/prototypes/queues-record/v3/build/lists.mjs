// List pages: the preparer queue (My returns for a preparer, Preparer queue for the CPA and owner; two ways for Q8) and the
// carried-over Review queue, Ops queue, New returns and Board. One generic engine in static/app.js narrows, sorts and remembers them.
// The HTML is written for the default signed-in user (Aisha Rahman (Test)); the script shows each person their own rows and counts.
import { STATES, PEOPLE, esc, fmt, diffDays, stateTag, tierTag, nameCell, dateCell, holdCell, blockCell, hint, waitTag, isDone, band, idx, PREP_STATES, table, wrapTable, page, person } from './lib.mjs'

const tierOrd = { red: 0, amber: 1, green: 2, none: 3 }
const OPS_STEP = { intake: 'Check onboarding data', evidence: 'Capture the CRA data', approved: 'Send T183CORP', client_sign: 'Upload the signed certificate', ready_to_file: 'Upload the check export', filed: 'Save the notice of assessment' }
export const opsStep = (r) => r.nextOps || OPS_STEP[r.state] || 'None'
const DEFAULT_VIEWER = 'aisha'

// ---------- columns: [header, numeric, cell(r, o) -> [html, sortValue], only roles] ----------
export const COL = {
  corp: ['Corporation and year end', false, (r) => [nameCell(r, `rec-${r.slug}.html`), r.name]],
  state: ['State', false, (r) => [stateTag(r.state), idx(r.state)]],
  tier: ['Tier', false, (r) => [tierTag(r.tier), tierOrd[r.tier]]],
  filing: ['Filing due', false, (r) => dateCell(r.filing, 'filing', isDone(r))],
  balance: ['Balance due', false, (r) => dateCell(r.balance, 'balance', isDone(r))],
  held: ['Held by', false, (r, o) => holdCell(r, o.viewer), 'preparer'],
  block: ['Blocked by', false, (r) => blockCell(r)],
  prep: ['Preparer', false, (r) => [r.prep ? esc(person(r.prep)) : 'Nobody yet', r.prep ? person(r.prep) : 'zzz'], 'cpa owner ops'],
  prepcell: ['Preparer', false, (r) => [`<span data-prep-cell>${r.prep ? esc(person(r.prep)) : 'Nobody yet'}</span>`, r.prep ? person(r.prep) : 'zzz']],
  days: ['Days in this state', true, (r) => [`${r.daysInState}`, r.daysInState]],
  flags: ['Flags or changes', true, (r) => [r.state === 'rework' ? `${r.changed} changed cells` : `${r.flags} pinned flags`, r.state === 'rework' ? r.changed : r.flags]],
  next: ['Next ops step', false, (r) => [esc(opsStep(r)), opsStep(r)]],
  missing: ['Missing item', false, (r) => [r.missing ? `<strong class="govuk-tag govuk-tag--orange">${esc(r.missing)}</strong>` : 'Nothing', r.missing ? 0 : 1]],
  wflag: ['Waiting on client', false, (r) => [r.waiting ? `${waitTag}<br>${hint(`since ${fmt(r.waiting.since)}, ${r.waiting.days} days`)}` : 'No', r.waiting ? r.waiting.days : 0]],
}

// the sets: columns at most 8 per list row (QR8)
export const SETS = {
  prep: ['corp', 'state', 'tier', 'filing', 'balance', 'prep', 'held', 'block'],
  cpa: ['corp', 'state', 'tier', 'flags', 'prep', 'days', 'filing', 'balance'],
  ops: ['corp', 'state', 'next', 'missing', 'filing', 'balance', 'days', 'wflag'],
  new: ['corp', 'state', 'prepcell', 'next', 'filing', 'balance', 'days'],
  board: ['corp', 'state', 'tier', 'filing', 'balance', 'prep', 'days', 'wflag'],
}

// ---------- default orders, each stated in the caption ----------
const byName = (a, b) => a.name.localeCompare(b.name)
const byFiling = (a, b) => a.filing.localeCompare(b.filing) || byName(a, b)
export const ORDERS = {
  filing: { key: 'filing', sort: byFiling, text: 'filing due date, earliest first, then corporation name' },
  cpa: { key: null, sort: (a, b) => (band(a) === 'overdue' ? 0 : 1) - (band(b) === 'overdue' ? 0 : 1) || tierOrd[a.tier] - tierOrd[b.tier] || a.filing.localeCompare(b.filing) || b.daysInState - a.daysInState || byName(a, b), text: 'overdue first, then tier, then filing due date; ties by longest wait' },
  ops: { key: null, sort: (a, b) => (band(a) === 'overdue' ? 0 : 1) - (band(b) === 'overdue' ? 0 : 1) || a.filing.localeCompare(b.filing) || idx(a.state) - idx(b.state) || a.slug.localeCompare(b.slug), text: 'overdue first, then filing due date, then lifecycle order' },
}

// ---------- views: [key, label, test] ----------
export const VIEWS = {
  mine: [
    ['todo', 'To do now', (r) => PREP_STATES.includes(r.state)],
    ['all', 'All mine', () => true],
    ['waiting', 'Waiting on client', (r) => !!r.waiting],
    ['due14', 'Due in 14 days or overdue', (r) => !isDone(r) && diffDays(r.filing) <= 14],
    ['rework', 'My rework', (r) => r.state === 'rework'],
  ],
  prep: [
    ['todo', 'All preparer work', (r) => PREP_STATES.includes(r.state)],
    ['rework', 'All rework', (r) => r.state === 'rework'],
    ['waiting', 'Waiting on client', (r) => !!r.waiting],
    ['due14', 'Due in 14 days or overdue', (r) => !isDone(r) && diffDays(r.filing) <= 14 && PREP_STATES.includes(r.state)],
  ],
  cpa: [
    ['ready', 'Ready to review', (r) => r.state === 'review'],
    ['rework', 'All rework', (r) => r.state === 'rework'],
    ['due14', 'Ready to review, due in 14 days or overdue', (r) => r.state === 'review' && diffDays(r.filing) <= 14],
    ['all', 'All in the review flow', (r) => ['respond', 'review', 'rework'].includes(r.state)],
  ],
  ops: [
    ['next', 'Next ops step', (r) => ['approved', 'client_sign', 'ready_to_file'].includes(r.state)],
    ['filed', 'Filed, waiting for assessment', (r) => r.state === 'filed'],
    ['waiting', 'Waiting on client', (r) => !!r.waiting],
    ['all', 'All in the Ops queue', () => true],
  ],
  new: [
    ['new', 'New returns', () => true],
    ['unassigned', 'No preparer yet', (r) => !r.prep],
    ['waiting', 'Waiting on client', (r) => !!r.waiting],
  ],
  board: [
    ['all', 'All returns', () => true],
    ['overdue', 'Overdue', (r) => !isDone(r) && band(r) === 'overdue'],
    ['week', 'Due in the next 7 days', (r) => band(r) === 'week'],
    ['waiting', 'Waiting on client', (r) => !!r.waiting],
  ],
}

// membership of each list (before its views)
const OPS_STATES = ['approved', 'client_sign', 'ready_to_file', 'filed']
export const MEMBERS = {
  prep: (r) => !!r.prep,
  cpa: (r) => ['respond', 'review', 'rework'].includes(r.state),
  ops: (r) => OPS_STATES.includes(r.state) || !!r.waiting,
  new: (r) => ['intake', 'evidence'].includes(r.state) || (!r.prep && idx(r.state) < idx('review')),
  board: () => true,
}

const dataAttrs = (r, modes) => ` data-slug="${r.slug}"${modes.map(([m, vs]) => ` data-views-${m}="${vs.filter((v) => v[2](r)).map((v) => v[0]).join(' ')}"`).join('')} data-state="${r.state}" data-tier="${r.tier}" data-prep="${r.prep || ''}" data-wait="${r.waiting ? 'yes' : 'no'}" data-due="${isDone(r) ? 9999 : diffDays(r.filing)}" data-band="${band(r)}" data-text="${esc((r.name + ' ' + r.bn + ' ' + fmt(r.ye) + ' ' + r.ye + ' ' + (r.prep ? person(r.prep) : '') + ' ' + (r.blocker || '') + ' ' + (r.waiting ? 'waiting on client' : '')).toLowerCase())}"`

export const flagged = (r) => !!(r.waiting || r.blocker || r.tier === 'red')

// ---------- the page ----------
// o: { file, titles: {preparer?, default}, listName, rows, scope: 'prep' | 'all', set, views: {mine?: [..], all: [..]}, order, mode: 'tabs' | 'select', filter: bool,
//      bulk, nav, roles, as, note, strip, leads, empty }
export function listPage(o) {
  const modeKeys = Object.keys(o.views)
  const primary = o.views.mine ? 'mine' : 'all'
  const views = o.views[primary]
  const scoped = o.scope === 'prep' ? o.rows.filter((r) => r.prep === DEFAULT_VIEWER) : o.rows
  const ord = ORDERS[o.order]
  const sorted = [...o.rows].sort(ord.sort)
  const setCols = SETS[o.set]
  const counts = Object.fromEntries(views.map(([k, , f]) => [k, scoped.filter(f).length]))
  const active = views[0][0]
  const activeTest = views[0][2]
  const total = counts[active]
  const title = o.scope === 'prep' ? o.titles.preparer : o.titles.default
  const colDefs = setCols.map((k) => ({ key: k, h: COL[k][0], num: COL[k][1], only: COL[k][3], sort: ord.key === k ? 'ascending' : 'none' }))
  const defaultSort = ord.key ? (o.bulk ? 1 : 0) + setCols.indexOf(ord.key) : null
  const rowsHtml = sorted.map((r) => {
    const inScope = o.scope === 'prep' ? r.prep === DEFAULT_VIEWER : true
    return {
      id: r.slug, label: r.name, flagged: flagged(r),
      attrs: dataAttrs(r, modeKeys.map((m) => [m, o.views[m]])) + (inScope && activeTest(r) ? '' : ' hidden'),
      cells: setCols.map((k) => COL[k][2](r, { viewer: DEFAULT_VIEWER })),
    }
  })
  const cap = `<span data-caption-title>${esc(title)}</span>, sorted by ${ord.text}`
  const tbl = table({ id: 'returns', caption: cap, cols: colDefs, rows: rowsHtml, select: !!o.bulk })
  const tabs = `<nav class="moj-sub-navigation" aria-label="Views of ${esc(o.listName)}" data-view-tabs><ul class="moj-sub-navigation__list">${views.map(([k, l]) => `<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#view=${k}" data-view="${k}"${k === active ? ' aria-current="page"' : ''} data-count="${esc(title + ': ' + l.toLowerCase())}" data-scope="${esc(l)}">${esc(l)} <span class="moj-badge moj-badge--grey"><span class="govuk-visually-hidden">(</span>${counts[k]}<span class="govuk-visually-hidden"> returns)</span></span></a></li>`).join('')}</ul></nav>`
  const select = `<div class="app-listbar">
<div class="govuk-form-group app-listbar__field"><label class="govuk-label" for="list-view">Show</label>
<select class="govuk-select" id="list-view" name="view" data-view-select>${views.map(([k, l]) => `<option value="${k}"${k === active ? ' selected' : ''}>${esc(l)} (${counts[k]})</option>`).join('')}</select></div>
<div class="govuk-form-group app-listbar__field"><label class="govuk-label" for="list-filter">Filter by name, business number or year end</label>
<input class="govuk-input app-listbar__input" id="list-filter" type="search" autocomplete="off" spellcheck="false" data-list-filter></div>
</div>`
  const filterBox = `<div class="app-listbar"><div class="govuk-form-group app-listbar__field"><label class="govuk-label" for="list-filter">Filter this view by name, business number or year end</label><input class="govuk-input app-listbar__input" id="list-filter" type="search" autocomplete="off" spellcheck="false" data-list-filter></div></div>`
  const viewName = views.find((v) => v[0] === active)[1]
  const status = `<p class="govuk-body govuk-!-margin-bottom-2" role="status" tabindex="-1" data-list-status data-count="${esc(title + ': ' + viewName.toLowerCase() + ' showing')}" data-scope="of"><span data-status-count>Showing ${total} of ${total} returns in ${esc(viewName)}.</span> <span data-status-order>Sorted by ${ord.text}.</span> <button type="button" class="app-linkbutton" data-filter-clear hidden>Clear the filter</button></p>`
  const cfg = { name: o.listName, titles: { ...o.titles }, orderText: ord.text, scope: o.scope, views: Object.fromEntries(modeKeys.map((m) => [m, o.views[m].map((v) => [v[0], v[1]])])), defaultSort, empty: o.empty || {}, leads: o.leads || null }
  const lead0 = o.leads ? (o.scope === 'prep' ? o.leads.preparer : o.leads.default) : ''
  const body = `<h1 class="govuk-heading-l govuk-!-margin-bottom-2" data-identity-bar data-list-title>${esc(title)}</h1>
<p class="govuk-body govuk-!-margin-bottom-2" data-list-lead${lead0 ? '' : ' hidden'}>${lead0 || ''}</p>${o.strip || ''}
${o.mode === 'select' ? select : tabs}${o.mode === 'tabs' && o.filter ? filterBox : ''}
${status}
<div data-list data-list-name="${esc(o.listName)}" data-view-mode="${o.mode}">
<div data-list-table${total ? '' : ' hidden'}>${wrapTable(`${title} table`, tbl)}</div>
<div class="govuk-inset-text govuk-!-margin-top-2 govuk-!-margin-bottom-2" data-list-empty${total ? ' hidden' : ''}><p class="govuk-body govuk-!-margin-bottom-1"><strong data-empty-title>${total ? '' : 'No returns in ' + esc(viewName) + '.'}</strong></p><p class="govuk-body govuk-!-margin-bottom-0" data-empty-body>${total ? '' : esc((o.empty && (o.empty[active] || o.empty.default)) || 'Choose another view, or use the search box at the top of the page.')}</p></div>
</div>
${o.bulk ? bulkBar() : ''}
<script type="application/json" id="list-config">${JSON.stringify(cfg).replace(/</g, '\\u003c')}</script>`
  return page({ title, body, nav: o.nav, bodyClass: 'app-list', roles: o.roles, as: o.as, note: o.note })
}

function bulkBar() {
  const who = [['aisha', PEOPLE.aisha], ['ben', PEOPLE.ben], ['x1', PEOPLE.x1], ['x2', PEOPLE.x2]]
  return `<form class="app-bulkbar" data-bulkbar hidden aria-label="Assign the selected returns" novalidate>
<div class="govuk-error-summary app-bulkbar__summary" data-module="govuk-error-summary" data-disable-auto-focus="true" data-bulk-summary hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#assign-to">Choose a preparer to assign the selected returns to</a></li></ul></div></div></div>
<div class="app-bulkbar__row"><span data-sel-count data-count="New returns: selected" data-scope="selected" role="status"></span><div class="govuk-form-group govuk-!-margin-bottom-0 app-bulkbar__field" data-bulk-group><label class="govuk-label govuk-!-margin-bottom-0" for="assign-to">Assign selected returns to</label><p class="govuk-error-message govuk-!-margin-bottom-0" id="assign-to-error" hidden><span class="govuk-visually-hidden">Error:</span> Choose a preparer to assign the selected returns to</p><select class="govuk-select" id="assign-to" name="who"><option value="">Choose a preparer</option>${who.map(([k, p]) => `<option value="${k}">${p}</option>`).join('')}</select></div><button class="govuk-button govuk-!-margin-bottom-0" type="submit" data-module="govuk-button" data-prevent-double-click="true" data-primary>Assign</button></div></form>
<p class="govuk-body app-bulkresult" data-bulk-result tabindex="-1" role="status" hidden></p>`
}

// the Board's state strip: real buttons that narrow the list below (owner, RV-40). Carried over; D10 redraws it.
export function boardStrip(rows) {
  const c = {}
  const oldest = {}
  for (const r of rows) { c[r.state] = (c[r.state] || 0) + 1; oldest[r.state] = Math.max(oldest[r.state] || 0, r.daysInState || 0) }
  return `<h2 class="govuk-heading-s govuk-!-margin-bottom-2">All ${rows.length} returns by state, in lifecycle order</h2><ol class="app-pipeline" aria-label="Returns per state">${STATES.map(([k, l]) => `<li><button type="button" class="app-pipe${c[k] ? '' : ' app-pipe--zero'}" aria-pressed="false" data-state-filter="${k}" data-count="Board: ${esc(l)}" data-scope="${esc(l)}"><span class="app-pipe__count">${c[k] || 0}</span> <span class="app-pipe__label">${esc(l)}</span> <span class="app-pipe__age">${c[k] ? 'oldest ' + oldest[k] + ' days' : 'none'}</span></button></li>`).join('')}</ol>`
}
