// Sign-in, two-step code, session end, signed out, not found, source (second window) and the prototype guide.
// SEC-1 (A06): user ID and password, then a 6-digit time-based code; every refusal shows only "sign-in failed"; no locked state is drawn.
import { esc, fmt, page, ALL, bySlug, USERS, NOW_TEXT, stateInfo, TIER, dayNum, wrapTable } from './lib.mjs'

const FAIL = 'Sign-in failed. Check what you entered, then try again.'

const summary = (href) => `<div class="govuk-error-summary" data-module="govuk-error-summary" tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="${href}">${FAIL}</a></li></ul></div></div></div>`

const passwordInput = (err) => `<div class="govuk-form-group govuk-password-input" data-module="govuk-password-input">
<label class="govuk-label govuk-label--s" for="password">Password</label>
<div class="govuk-input__wrapper govuk-password-input__wrapper"><input class="govuk-input govuk-password-input__input govuk-js-password-input-input${err ? ' govuk-input--error' : ''}" id="password" name="password" type="password" spellcheck="false" autocomplete="current-password" autocapitalize="none"${err ? ' aria-describedby="signin-error"' : ''}><button type="button" class="govuk-button govuk-button--secondary govuk-password-input__toggle govuk-js-password-input-toggle" data-module="govuk-button" aria-controls="password" aria-label="Show password" hidden>Show</button></div>
</div>`

const signInForm = (err) => `<form data-signin data-keep-next method="post" action="code.html" novalidate>
<div class="govuk-form-group${err ? ' govuk-form-group--error' : ''}" data-evidence>
<fieldset class="govuk-fieldset"${err ? ' aria-describedby="signin-error"' : ''}><legend class="govuk-fieldset__legend govuk-visually-hidden">Your sign-in details</legend>
${err ? `<p id="signin-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ${FAIL}</p>` : ''}
<div class="govuk-form-group govuk-!-margin-bottom-4"><label class="govuk-label govuk-label--s" for="user-id">User ID</label><input class="govuk-input govuk-input--width-20${err ? ' govuk-input--error' : ''}" id="user-id" name="user" type="text" autocomplete="username" spellcheck="false" autocapitalize="none"></div>
${passwordInput(err)}
</fieldset></div>
<button class="govuk-button govuk-!-margin-bottom-0" type="submit" data-module="govuk-button" data-prevent-double-click="true" data-primary>Continue</button>
</form>`

const authBody = (inner) => `<div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds">${inner}</div></div>`

export function signIn({ error = false } = {}) {
  const body = authBody(`${error ? summary('#user-id') : ''}<h1 class="govuk-heading-l govuk-!-margin-bottom-4">Sign in</h1>${signInForm(error)}`)
  return page({ title: 'Sign in', auth: true, error, body, wide: false, note: error ? 'State page: the one failure message, shown after Continue.' : '' })
}

// the page a person sees after a session ends (QR4): the asked-for address is kept
export function signInEnded() {
  const body = authBody(`<div class="govuk-notification-banner" role="region" aria-labelledby="govuk-notification-banner-title" data-module="govuk-notification-banner" data-disable-auto-focus="true"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="govuk-notification-banner-title">Important</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">You were signed out after 30 minutes without activity.</p><p class="govuk-body govuk-!-margin-bottom-0">Sign in again to go back to <strong data-next-shown data-next-default="rec-halton-haulage.html#documents/2" data-next-label="Halton Haulage Ltd. (Test), Documents tab, second document">the page you asked for</strong>. Your selection is restored from the address.</p></div></div>
<h1 class="govuk-heading-l govuk-!-margin-bottom-4">Sign in</h1>${signInForm(false)}`)
  return page({ title: 'Sign in', auth: true, body, wide: false, note: 'State page: what a person sees after a timeout.' })
}

export function code({ error = false } = {}) {
  const back = '<a href="sign-in.html" class="govuk-back-link" data-back-signin>Back</a>'
  const form = `<form data-code data-keep-next method="post" action="queue-a.html" novalidate>
<div class="govuk-form-group${error ? ' govuk-form-group--error' : ''}" data-evidence>
<label class="govuk-label govuk-label--s" for="code">6-digit code</label>
<div id="code-hint" class="govuk-hint">Open your authenticator app and enter the code it shows for Ashbridge Tax. You can paste it.</div>
${error ? `<p id="code-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ${FAIL}</p>` : ''}
<input class="govuk-input govuk-input--width-10${error ? ' govuk-input--error' : ''}" id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" spellcheck="false" aria-describedby="code-hint${error ? ' code-error' : ''}">
</div>
<button class="govuk-button govuk-!-margin-bottom-0" type="submit" data-module="govuk-button" data-prevent-double-click="true" data-primary>Verify</button>
</form>`
  // the Back link sits first inside main: outside it, axe reports content outside any landmark (rule 3, the region rule)
  const body = authBody(`${back}${error ? summary('#code') : ''}<h1 class="govuk-heading-l govuk-!-margin-bottom-4">Enter your code</h1>${form}`)
  return page({ title: 'Enter your code', auth: true, error, body, wide: false, direct: true, note: error ? 'State page: the same single failure message.' : 'Opened directly, the code signs in Aisha Rahman (Test).' })
}

export function signedOut() {
  const body = authBody(`<h1 class="govuk-heading-l" data-signed-out>You have signed out</h1><p class="govuk-body">Your session has ended. A source open in a second window has closed.</p><p class="govuk-body"><a class="govuk-link" href="sign-in.html">Sign in again</a></p>`)
  return page({ title: 'You have signed out', auth: true, body, wide: false })
}

export function notFound() {
  const body = authBody(`<h1 class="govuk-heading-l" data-identity-bar>Page not found</h1><p class="govuk-body">If you typed the web address, check it is correct.</p><p class="govuk-body">If you pasted the web address, check you copied the entire address.</p><p class="govuk-body"><a class="govuk-link" href="queue-a.html" data-home>Go to your list</a></p>`)
  return page({ title: 'Page not found', nav: '', body, wide: false })
}

export function search() {
  const states = Object.fromEntries(Object.entries(stateInfo).map(([k, v]) => [k, [v.label, v.colour]]))
  const tiers = Object.fromEntries(Object.entries(TIER).map(([k, v]) => [k, v]))
  const data = ALL.map((r) => [r.name, r.bn, fmt(r.ye), r.state, r.tier, r.slug, dayNum(r.filing), r.prep || '', r.ye, fmt(r.filing)])
  const body = `<h1 class="govuk-heading-l govuk-!-margin-bottom-2" data-identity-bar data-search-h1>Search for a return</h1>
<p class="govuk-body" role="status" data-search-summary>Type a corporation name, a business number or a year end in the search box at the top of the page.</p>
<div data-search-box data-list-name="Search results" hidden><div data-search-table></div></div>
<script type="application/json" id="search-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script type="application/json" id="search-meta">${JSON.stringify({ states, tiers })}</script>`
  return page({ title: 'Search results', nav: '', body, wide: true })
}

export function source() {
  const body = `<h1 class="govuk-heading-m govuk-!-margin-bottom-2" data-identity-bar data-source-h1>Source viewer</h1>
<p class="govuk-body" data-source-meta>No document chosen yet. Open a return, choose a document in its Documents tab, then choose "Send to second window". This window then follows each document you choose.</p>
<div class="app-viewer app-viewer--page" data-viewer><div data-viewer-body></div></div>`
  return page({ title: 'Source viewer', nav: '', body, wide: true, bodyClass: 'app-sourcepage' })
}

// ---------- the prototype guide ----------
export function index() {
  const users = Object.entries(USERS).map(([k, u]) => [k, u.name, u.role === 'cpa' ? 'CPA reviewer' : u.role, { preparer: 'My returns', cpa: 'Review queue', ops: 'Ops queue', owner: 'Board' }[u.role]])
  const tr = (cells, th = false) => `<tr class="govuk-table__row">${cells.map((c, i) => (i === 0 ? `<th scope="row" class="govuk-table__header">${c}</th>` : `<td class="govuk-table__cell">${c}</td>`)).join('')}</tr>`
  const table = (cap, head, rows) => wrapTable(`${cap} table`, `<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--m">${cap}</caption><thead class="govuk-table__head"><tr class="govuk-table__row">${head.map((h) => `<th scope="col" class="govuk-table__header">${h}</th>`).join('')}</tr></thead><tbody class="govuk-table__body">${rows.map((r) => tr(r)).join('')}</tbody></table>`)
  const a = (h, t) => `<a class="govuk-link" href="${h}">${t}</a>`
  const states = table('Pages by state', ['Page', 'Open this', 'Other states', 'Sign in as'], [
    ['Sign in', a('sign-in.html', 'Empty'), `${a('sign-in-error.html', 'Error (one failure message)')}, ${a('sign-in-ended.html', 'After a timeout, address kept')}`, 'Nobody'],
    ['Two-step code', a('code.html', 'Empty'), a('code-error.html', 'Error (the same message)'), 'Nobody'],
    ['Signed out, not found', a('signed-out.html', 'Signed out'), a('not-found.html', 'Not found'), 'Anyone; not found is also what Aisha sees for a return that is not hers'],
    ['Search results', a('search.html?q=rouge+valley', 'Two matches'), `${a('search.html?q=halton', 'One match opens the return')}, ${a('search.html?q=zzz', 'No match')}`, 'Anyone'],
    ['My returns or Preparer queue, view tabs (version A)', a('queue-a.html', '36 returns of Aisha Rahman (Test)'), a('queue-a-empty.html', 'Empty: nothing to do now'), 'Aisha; empty page: Casey Lee'],
    ['My returns or Preparer queue, filter line (version B)', a('queue-b.html', '36 returns of Aisha Rahman (Test)'), a('queue-b-empty.html', 'Empty: nothing to do now'), 'Aisha; empty page: Casey Lee'],
    ['Review queue, Ops queue, New returns, Board', `${a('queue-cpa.html', 'Review queue')}, ${a('queue-ops.html', 'Ops queue')}`, `${a('queue-new.html', 'New returns')}, ${a('board.html', 'Board')}. Carried over; the CPA and ops family rounds redraw them`, 'Dana, Priti, Owen'],
    ['Return, normal', a('rec-maple-ridge.html', 'Maple Ridge Consulting Inc. (Test), in Review'), a('rec-eglinton-retail.html', 'Eglinton Retail Ltd. (Test), hold ended, in a group'), 'Aisha, or Dana, Priti, Owen'],
    ['Return, flagged', a('rec-danforth-cleaning.html', 'Danforth Cleaning Co. Ltd. (Test), waiting on client'), a('rec-lakeshore-eats.html', 'Lakeshore Eats Inc. (Test), a chase to record (assigned to Ben Ortiz (Test))'), 'Aisha for Danforth; Dana, Priti or Owen for Lakeshore'],
    ['Return, hold held by you', a('rec-halton-haulage.html', 'Halton Haulage Ltd. (Test)'), 'Open it as Dana: it reads "Held by Aisha Rahman (Test), ends 14:20 if idle"', 'Aisha, then Dana'],
    ['Return, approved', a('rec-riverdale-rentals.html', 'Riverdale Rentals Inc. (Test)'), 'Ops carries the next step on its Ops tab', 'Aisha or Priti'],
    ['Return, approval void', a('rec-filler-012.html', 'Willow Landscaping 012 Inc. (Test), a document changed'), `${a('rec-filler-083.html', 'books changed')}, ${a('rec-filler-047.html', 'check export did not match (Ben Ortiz (Test))')}`, 'Aisha for 012 and 083'],
    ['Return, closed (read only)', a('rec-bluewater-renovations.html', 'Bluewater Renovations Inc. (Test)'), 'Hold: none', 'Aisha or Owen'],
    ['Source in a second window', a('source.html', 'Source viewer'), 'Opened from a return\'s Documents tab with "Send to second window"', 'Anyone'],
  ])
  const body = `<h1 class="govuk-heading-l govuk-!-margin-bottom-2">Prototype guide: sign-in, the return record and the preparer queue</h1>
<p class="govuk-body">Staff prototype, version 3, for design cards D13 and D04. Made-up data only: 15 sample clients and 285 filler returns, every name ends (Test). The clock is fixed at Monday ${NOW_TEXT}. ${a('sign-in.html', 'Start at Sign in')}.</p>
<div class="govuk-inset-text"><p class="govuk-body govuk-!-margin-bottom-0">Test password for every user: <strong>ashbridge-test</strong>. Test code: <strong>482913</strong> (a real code is time based and works once). These are made-up values for this prototype only.</p></div>
${table('Test users', ['User ID', 'Name', 'Role', 'Lands on after sign-in'], users)}
${states}
<p class="govuk-body">Keys: <kbd>s</kbd> moves to the search box. It repeats the visible search box and can be turned off under Keyboard shortcuts.</p>`
  return page({ title: 'Prototype guide', auth: true, body, wide: false, guide: false })
}
