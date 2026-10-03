// Shared helpers for the version 3 pages: the shell (header, service navigation, footer), small parts, tables.
// Static HTML is written for the default signed-in user (Aisha Rahman (Test), preparer); static/app.js re-evaluates it for the signed-in user.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TODAY, NOW_TEXT, STATES, stateInfo, PEOPLE, TIER, ALL, bySlug, HOLD_HOURS } from './data.mjs'

export { TODAY, NOW_TEXT, STATES, stateInfo, PEOPLE, TIER, ALL, bySlug, HOLD_HOURS }
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${M[m - 1]} ${y}` }
export const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000)
export const diffDays = (iso) => dayNum(iso) - dayNum(TODAY)
export const rel = (iso) => { const n = diffDays(iso); return n === 0 ? 'today' : n > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} ago` }
export const person = (k) => PEOPLE[k] || ''
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// ---------- the people who can sign in (the same table is in static/app.js) ----------
export const USERS = {
  aisha: { name: PEOPLE.aisha, role: 'preparer', label: 'preparer' },
  casey: { name: PEOPLE.casey, role: 'preparer', label: 'preparer' },
  dana: { name: PEOPLE.dana, role: 'cpa', label: '' },
  priti: { name: PEOPLE.priti, role: 'ops', label: 'ops' },
  owen: { name: PEOPLE.owen, role: 'owner', label: 'owner' },
}

// ---------- state helpers ----------
export const PREP_STATES = ['gaps', 'prepare', 'trace', 'respond', 'rework']
export const DONE = ['filed', 'assessed', 'closed']
export const isDone = (r) => DONE.includes(r.state)
export const order = STATES.map((s) => s[0])
export const idx = (k) => order.indexOf(k)
export const holdable = (r) => PREP_STATES.includes(r.state)
export const band = (r) => { if (isDone(r)) return 'done'; const n = diffDays(r.filing); return n < 0 ? 'overdue' : n <= 7 ? 'week' : n <= 28 ? 'month' : 'later' }

// ---------- small parts ----------
export const stateTag = (k) => `<strong class="govuk-tag govuk-tag--${stateInfo[k].colour}">${stateInfo[k].label}</strong>`
export const tierTag = (t) => { const [w, c] = TIER[t]; return `<strong class="govuk-tag govuk-tag--${c}">${w}</strong>` }
export const waitTag = '<strong class="govuk-tag govuk-tag--yellow">Waiting on client</strong>'
export const voidTag = '<strong class="govuk-tag govuk-tag--red">Approval void</strong>'
export const hint = (t) => `<span class="govuk-hint govuk-!-margin-bottom-0">${t}</span>`

export function dateCell(iso, kind, done) {
  if (done) return [fmt(iso), dayNum(iso)]
  const n = diffDays(iso)
  let note
  if (n < 0) note = kind === 'filing' ? `<strong class="govuk-tag govuk-tag--red">${-n} days overdue</strong>` : hint(`${-n} days ago`)
  else note = hint(rel(iso))
  return [`${fmt(iso)}<br>${note}`, dayNum(iso)]
}

export const nameCell = (r, href) =>
  `<a class="govuk-link govuk-!-font-weight-bold" href="${href}" data-pick>${esc(r.name)}</a><br>${hint(`Year end ${fmt(r.ye)}`)}`

// "Held by" cell as the signed-in person sees it (viewer is a person key, or null)
export function holdCell(r, viewer) {
  const h = r.hold
  if (h && h.kind === 'held') {
    const you = h.by === viewer
    return [`<span data-hold-name data-by="${h.by}" data-name="${esc(person(h.by))}">${you ? 'You' : esc(person(h.by))}</span><br>${hint(`ends ${h.ends} if idle`)}`, you ? 0 : 1]
  }
  if (h && h.kind === 'expired') return [`Nobody<br>${hint(`hold ended ${esc(h.endedAt)}`)}`, 2]
  return ['Nobody', 3]
}

const blockText = (r) => (r.blocker || '').replace(/^Waiting on client:? ?/, '')
export function blockCell(r) {
  const txt = blockText(r)
  const parts = []
  if (txt) parts.push(esc(txt))
  if (r.waiting) parts.push(`${waitTag} ${hint(`since ${fmt(r.waiting.since)}, ${r.waiting.days} days`)}`)
  if (!parts.length) return ['Nothing', 0]
  return [parts.join('<br>'), r.waiting ? 100 + r.waiting.days : 1]
}

// ---------- tables ----------
// cols: {h, sort: 'ascending' | 'none' | false, num}; rows: {cells: [html | [html, sortValue]], attrs, label, flagged}
export function table({ id, caption, cols, rows, select = false, hideCaption = true, extra = '' }) {
  const dc = (c) => (c && c.key ? ` data-col="${c.key}"` : '')
  const head = cols.map((c) => {
    const num = c.num ? ' govuk-table__header--numeric' : ''
    const only = c.only ? ` data-only="${c.only}"${c.only.split(' ').includes('preparer') ? '' : ' hidden'}` : ''
    if (c.sort === false) return `<th scope="col" class="govuk-table__header${num}"${only}${dc(c)}>${c.h}</th>`
    return `<th scope="col" class="govuk-table__header${num}"${only}${dc(c)} aria-sort="${c.sort || 'none'}">${c.h}</th>`
  }).join('')
  const body = rows.map((r) => {
    const tds = r.cells.map((c, i) => {
      const [h, sv] = Array.isArray(c) ? c : [c, null]
      if (i === 0) return `<th scope="row" class="govuk-table__header"${dc(cols[0])}${sv != null ? ` data-sort-value="${esc(sv)}"` : ''}>${h}</th>`
      const only = cols[i]?.only ? ` data-only="${cols[i].only}"${cols[i].only.split(' ').includes('preparer') ? '' : ' hidden'}` : ''
      return `<td class="govuk-table__cell${cols[i]?.num ? ' govuk-table__cell--numeric' : ''}"${only}${dc(cols[i])}${sv != null ? ` data-sort-value="${esc(sv)}"` : ''}>${h}</td>`
    }).join('')
    const sel = select ? (r.flagged
      ? `<td class="govuk-table__cell">${hint(`Flagged<span class="govuk-visually-hidden">: ${esc(r.label)} is flagged for a person, open it to assign</span>`)}</td>`
      : `<td class="govuk-table__cell"><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="${id}-${r.id}" name="pick" value="${r.id}" data-row-select><label class="govuk-label govuk-checkboxes__label" for="${id}-${r.id}"><span class="govuk-visually-hidden">Select ${esc(r.label)}</span></label></div></div></td>`) : ''
    return `<tr class="govuk-table__row"${r.attrs || ''}>${sel}${tds}</tr>`
  }).join('\n')
  const sortable = cols.some((c) => c.sort !== false)
  return `<table class="govuk-table" id="${id}"${sortable ? ' data-module="moj-sortable-table"' : ''}${extra}>
<caption class="govuk-table__caption govuk-table__caption--m${hideCaption ? ' govuk-visually-hidden' : ''}">${caption}</caption>
<thead class="govuk-table__head"><tr class="govuk-table__row">${select ? '<th scope="col" class="govuk-table__header">Select</th>' : ''}${head}</tr></thead>
<tbody class="govuk-table__body">
${body}
</tbody></table>`
}

// a plain table: used for tables of five rows or fewer and for fixed-order sections. With `sortable`, a table of more than five rows
// becomes an MOJ sortable table that starts in the order it arrived in (no header sorted), each cell sorting on its words.
const words = (h) => String(h).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
export function simpleTable({ caption, head, rows, numCols = [], hide = false, sortable = false }) {
  const sort = sortable && rows.length > 5
  const sv = (c) => (sort ? ` data-sort-value="${esc(words(c))}"` : '')
  const heads = head.map((h, i) => `<th scope="col" class="govuk-table__header${numCols.includes(i) ? ' govuk-table__header--numeric' : ''}"${sort ? ' aria-sort="none"' : ''}>${h}</th>`).join('')
  const body = rows.map((r) => `<tr class="govuk-table__row">${r.map((c, i) => `<${i === 0 ? 'th scope="row" class="govuk-table__header"' : `td class="govuk-table__cell${numCols.includes(i) ? ' govuk-table__cell--numeric' : ''}"`}${sv(c)}>${c}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')
  return wrapTable(`${words(caption)} table`, `<table class="govuk-table"${sort ? ' data-module="moj-sortable-table"' : ''}><caption class="govuk-table__caption govuk-table__caption--m${hide ? ' govuk-visually-hidden' : ''}">${caption}</caption><thead class="govuk-table__head"><tr class="govuk-table__row">${heads}</tr></thead><tbody class="govuk-table__body">${body}</tbody></table>`)
}

// every table sits in a labelled, keyboard-reachable scrollable region (rule 13: at 320 px only a table inside such a region may scroll sideways)
export const wrapTable = (label, inner) => `<div class="app-tablewrap" role="region" aria-label="${esc(label)}, scrollable" tabindex="0">${inner}</div>`

// ---------- the shell ----------
const ALERT_ICONS = {
  information: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.2165 3.45151C11.733 2.82332 13.3585 2.5 15 2.5C16.6415 2.5 18.267 2.82332 19.7835 3.45151C21.3001 4.07969 22.6781 5.00043 23.8388 6.16117C24.9996 7.3219 25.9203 8.69989 26.5485 10.2165C27.1767 11.733 27.5 13.3585 27.5 15C27.5 18.3152 26.183 21.4946 23.8388 23.8388C21.4946 26.183 18.3152 27.5 15 27.5C13.3585 27.5 11.733 27.1767 10.2165 26.5485C8.69989 25.9203 7.3219 24.9996 6.16117 23.8388C3.81696 21.4946 2.5 18.3152 2.5 15C2.5 11.6848 3.81696 8.50537 6.16117 6.16117C7.3219 5.00043 8.69989 4.07969 10.2165 3.45151ZM16.3574 22.4121H13.6621V12.95H16.3574V22.4121ZM13.3789 9.20898C13.3789 8.98763 13.4212 8.7793 13.5059 8.58398C13.5905 8.38216 13.7044 8.20964 13.8477 8.06641C13.9974 7.91667 14.1699 7.79948 14.3652 7.71484C14.5605 7.63021 14.7721 7.58789 15 7.58789C15.2214 7.58789 15.4297 7.63021 15.625 7.71484C15.8268 7.79948 15.9993 7.91667 16.1426 8.06641C16.2923 8.20964 16.4095 8.38216 16.4941 8.58398C16.5788 8.7793 16.6211 8.98763 16.6211 9.20898C16.6211 9.43685 16.5788 9.64844 16.4941 9.84375C16.4095 10.0391 16.2923 10.2116 16.1426 10.3613C15.9993 10.5046 15.8268 10.6185 15.625 10.7031C15.4297 10.7878 15.2214 10.8301 15 10.8301C14.7721 10.8301 14.5605 10.7878 14.3652 10.7031C14.1699 10.6185 13.9974 10.5046 13.8477 10.3613C13.7044 10.2116 13.5905 10.0391 13.5059 9.84375C13.4212 9.64844 13.3789 9.43685 13.3789 9.20898Z" fill="currentColor"/>',
  success: '<path d="M11.2869 24.6726L2.00415 15.3899L4.62189 12.7722L11.2869 19.4186L25.3781 5.32739L27.9958 7.96369L11.2869 24.6726Z" fill="currentColor"/>',
  warning: '<path fill-rule="evenodd" clip-rule="evenodd" d="M15 2.44922L28.75 26.1992H1.25L15 2.44922ZM13.5107 9.49579H16.4697L16.2431 17.7678H13.7461L13.5107 9.49579ZM13.1299 21.82C13.1299 21.5661 13.1787 21.3285 13.2764 21.1071C13.374 20.8793 13.5075 20.6807 13.6768 20.5114C13.8525 20.3421 14.0544 20.2087 14.2822 20.111C14.5101 20.0134 14.7542 19.9645 15.0146 19.9645C15.2686 19.9645 15.5062 20.0134 15.7275 20.111C15.9554 20.2087 16.154 20.3421 16.3232 20.5114C16.4925 20.6807 16.626 20.8793 16.7236 21.1071C16.8213 21.3285 16.8701 21.5661 16.8701 21.82C16.8701 22.0804 16.8213 22.3246 16.7236 22.5524C16.626 22.7803 16.4925 22.9789 16.3232 23.1481C16.154 23.3174 15.9554 23.4509 15.7275 23.5485C15.5062 23.6462 15.2686 23.695 15.0146 23.695C14.7542 23.695 14.5101 23.6462 14.2822 23.5485C14.0544 23.4509 13.8525 23.3174 13.6768 23.1481C13.5075 22.9789 13.374 22.7803 13.2764 22.5524C13.1787 22.3246 13.1299 22.0804 13.1299 21.82Z" fill="currentColor"/>',
}
// the official MOJ alert markup (moj/components/alert/template.njk), headed
export const alertBox = ({ variant = 'information', title, html, attrs = '' }) =>
  `<div role="region" class="moj-alert moj-alert--${variant} moj-alert--with-heading" aria-label="${variant}: ${esc(title)}" data-module="moj-alert"${attrs}>
<div><svg class="moj-alert__icon" role="presentation" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" height="30" width="30">${ALERT_ICONS[variant]}</svg></div>
<div class="moj-alert__content"><h2 class="moj-alert__heading">${esc(title)}</h2>${html}</div>
<div class="moj-alert__action"><button class="moj-alert__dismiss" hidden>Dismiss</button></div>
</div>`

// role service navigation, as the default user (preparer). static/app.js rebuilds it for the signed-in role.
export const NAV_PREP = [['My returns', 'queue-a.html', 'prep']]
// the item for the page you are on is not a link to itself (the lint finds no self-link); the other items are links
const navItems = (items, active) => items.map(([l, h, k]) => {
  const on = k === active
  return on
    ? `<li class="govuk-service-navigation__item govuk-service-navigation__item--active"><span class="govuk-service-navigation__link" aria-current="page"><strong class="govuk-service-navigation__active-fallback">${l}</strong></span></li>`
    : `<li class="govuk-service-navigation__item"><a class="govuk-service-navigation__link" href="${h}">${l}</a></li>`
}).join('')

const KEYS = [['s', 'Search', 'Moves focus to the search box in the header.']]

const searchForm = () => `<form class="app-search" role="search" action="search.html" method="get">
<label class="govuk-label app-search__label" for="header-search">Find a return by name, business number or year end</label>
<input class="govuk-input app-search__input" id="header-search" name="q" type="search" autocomplete="off" spellcheck="false" aria-keyshortcuts="s">
<button class="govuk-button govuk-button--secondary app-search__button" type="submit" data-module="govuk-button">Search</button>
</form>`

export function page({ title, ret, nav = '', body, error = false, auth = false, wide = true, back = '', ctx = '', bodyClass = '', mainClass = '', roles = '', as = '', note = '', direct = false, guide = true }) {
  const t = `${error ? 'Error: ' : ''}${title}${ret ? ' - ' + ret.name + ', year end ' + fmt(ret.ye) : ''} - Ashbridge Tax`
  const w = wide ? ' app-width-container--wide' : ''
  const home = 'queue-a.html'
  // before sign-in there is nowhere to go from the logo, so it is not a link; after sign-in it goes to the person's own list (static/app.js sets the address)
  const logo = auth
    ? '<img src="static/ashbridge-tax-logo.png" alt="Ashbridge Tax" width="40" height="40">'
    : `<a href="${home}" class="govuk-header__homepage-link" data-home><img src="static/ashbridge-tax-logo.png" alt="Ashbridge Tax, your list" width="40" height="40"></a>`
  const header = `<header class="govuk-header">
<div class="govuk-header__container govuk-width-container${w} app-header-row">
<div class="govuk-header__logo">${logo}</div>
${auth ? '' : searchForm()}
</div></header>`
  const navHtml = auth ? '' : `<section aria-label="Service information" class="govuk-service-navigation" data-module="govuk-service-navigation">
<div class="govuk-width-container${w}"><div class="govuk-service-navigation__container">
<span class="govuk-service-navigation__service-name"><span class="govuk-service-navigation__text">Ashbridge Returns</span></span>
<nav aria-label="Menu" class="govuk-service-navigation__wrapper">
<button type="button" class="govuk-service-navigation__toggle govuk-js-service-navigation-toggle" aria-controls="navigation" hidden aria-hidden="true">Menu</button>
<ul class="govuk-service-navigation__list" id="navigation" data-role-nav>${navItems(NAV_PREP, nav)}<li class="govuk-service-navigation__item"><a class="govuk-service-navigation__link" href="signed-out.html" data-signout>Sign out</a></li></ul>
</nav><p class="app-header-user" data-user-line>Signed in as ${esc(USERS.aisha.name)}, ${USERS.aisha.label}</p></div></div></section>`
  const shortcuts = auth ? '' : `<details class="govuk-details app-shortcuts"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Keyboard shortcuts</span></summary><div class="govuk-details__text">
<table class="govuk-table govuk-!-margin-bottom-2"><caption class="govuk-table__caption govuk-visually-hidden">Keyboard shortcuts</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Key</th><th scope="col" class="govuk-table__header">Control it repeats</th><th scope="col" class="govuk-table__header">What it does</th></tr></thead><tbody class="govuk-table__body">${KEYS.map(([k, c, d]) => `<tr class="govuk-table__row"><th scope="row" class="govuk-table__header"><kbd>${k}</kbd></th><td class="govuk-table__cell">${c}</td><td class="govuk-table__cell">${d}</td></tr>`).join('')}</tbody></table>
<div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="shortcuts-off" type="checkbox" data-shortcuts-off><label class="govuk-label govuk-checkboxes__label" for="shortcuts-off">Turn off single-key shortcuts</label></div></div>
</div></details>`
  return `<!DOCTYPE html>
<html lang="en-CA" class="govuk-template">
<head>
<meta charset="utf-8">
<title>${esc(t)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="static/basis.css">
<link rel="stylesheet" href="static/app.css">
</head>
<body class="govuk-template__body ${bodyClass}" data-page="${auth ? 'auth' : 'app'}" data-nav="${nav}"${roles ? ` data-roles="${roles}"` : ''}${as ? ` data-demo-user="${as}"` : ''}${direct ? ' data-direct-ok' : ''}>
<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
${header}
${navHtml}
<div class="govuk-width-container${w}">
${back}
<main class="govuk-main-wrapper govuk-!-padding-top-2 ${mainClass}" id="main-content">
${body}
</main>
</div>
<footer class="govuk-footer"><div class="govuk-width-container${w}">
${shortcuts}
<p class="govuk-body-s govuk-!-margin-bottom-0">Ashbridge Tax staff prototype, version 3. Made-up data only: every name ends (Test). Pinned time: Monday ${NOW_TEXT}. ${note ? esc(note) + ' ' : ''}${guide ? '<a class="govuk-footer__link" href="index.html">Prototype guide, test users and codes</a>' : ''}</p>
</div></footer>
${ctx}<script src="static/govuk-frontend.js"></script>
<script src="static/moj-frontend.js"></script>
<script src="static/app.js"></script>
</body></html>
`
}

export function write(file, html) {
  if (new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(html)) throw new Error('dash in ' + file)
  fs.writeFileSync(path.join(ROOT, file), html)
}
