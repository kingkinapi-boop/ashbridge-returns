// Generates every page of version 3 into design/prototypes/queues-record/v3/.
//   node tools/heavy.mjs -- node design/prototypes/queues-record/v3/build/build.mjs
import { ALL, write, TODAY } from './lib.mjs'
import { listPage, boardStrip, VIEWS, MEMBERS } from './lists.mjs'
import { recordPage } from './record.mjs'
import * as auth from './auth.mjs'

const Q8 = 'Sitting question Q8: '

// ---------- the preparer queue, drawn two ways (QR21) ----------
const prepEmpty = {
  'preparer:todo': 'Nothing is waiting on you. Your other returns are with the client or the CPA. Choose "All mine" to see them.',
  'preparer:waiting': 'None of your returns is waiting on a client.',
  'preparer:due14': 'None of your returns is due in the next 14 days or overdue.',
  'preparer:rework': 'The CPA has sent nothing back to you.',
  todo: 'No return is waiting on a preparer.',
  rework: 'No return is in rework.',
  waiting: 'No return is waiting on a client.',
  due14: 'No return is due in the next 14 days or overdue.',
  default: 'Choose another view, or use the search box at the top of the page.',
}
const prep = (o) => listPage({
  titles: { preparer: 'My returns', default: 'Preparer queue' }, listName: 'Preparer queue', rows: ALL.filter(MEMBERS.prep), scope: 'prep', set: 'prep',
  views: { mine: VIEWS.mine, all: VIEWS.prep }, order: 'filing', nav: 'prep', roles: 'preparer cpa owner', empty: prepEmpty, ...o,
})
const files = {}
files['queue-a.html'] = prep({ mode: 'tabs', filter: false, note: Q8 + 'this page draws view tabs; version B draws a "Show" menu and a filter line.' })
files['queue-b.html'] = prep({ mode: 'select', filter: true, note: Q8 + 'this page draws a "Show" menu and a filter line; version A draws view tabs.' })
files['queue-a-empty.html'] = prep({ mode: 'tabs', filter: false, as: 'casey', note: 'Empty state: signed in as Casey Lee (Test), who has nothing to do now. ' + Q8 + 'view tabs.' })
files['queue-b-empty.html'] = prep({ mode: 'select', filter: true, as: 'casey', note: 'Empty state: signed in as Casey Lee (Test), who has nothing to do now. ' + Q8 + 'a "Show" menu and a filter line.' })

// ---------- carried over from the last round (the CPA and ops family rounds redraw these) ----------
files['queue-cpa.html'] = listPage({
  titles: { default: 'Review queue' }, listName: 'Review queue', rows: ALL.filter(MEMBERS.cpa), scope: 'all', set: 'cpa', views: { all: VIEWS.cpa }, order: 'cpa', mode: 'tabs', filter: true, nav: 'review', roles: 'cpa owner',
  empty: { ready: 'No return is ready to review.', rework: 'No return is in rework.', due14: 'No return that is ready to review is due in the next 14 days or overdue.', all: 'No return is in the review flow.', default: 'Choose another view.' },
  note: 'Carried over from the last round; the CPA review family redraws this list.',
})
files['queue-ops.html'] = listPage({
  titles: { default: 'Ops queue' }, listName: 'Ops queue', rows: ALL.filter(MEMBERS.ops), scope: 'all', set: 'ops', views: { all: VIEWS.ops }, order: 'ops', mode: 'tabs', filter: true, nav: 'ops', roles: 'ops cpa owner',
  empty: { next: 'No return is waiting for an ops step.', filed: 'No return is waiting for its notice of assessment.', waiting: 'No return is waiting on a client.', all: 'The Ops queue is empty.', default: 'Choose another view.' },
  note: 'Carried over from the last round; the ops family redraws this list.',
})
files['queue-new.html'] = listPage({
  titles: { default: 'New returns' }, listName: 'New returns', rows: ALL.filter(MEMBERS.new), scope: 'all', set: 'new', views: { all: VIEWS.new }, order: 'filing', mode: 'tabs', filter: true, bulk: true, nav: 'new', roles: 'ops cpa owner',
  empty: { new: 'No new returns.', unassigned: 'Every new return has a preparer.', waiting: 'No new return is waiting on a client.', default: 'Choose another view.' },
  note: 'Carried over from the last round; the ops family redraws this list and its bulk assign.',
})
files['board.html'] = listPage({
  titles: { default: 'Board' }, listName: 'Board', rows: ALL, scope: 'all', set: 'board', views: { all: VIEWS.board }, order: 'filing', mode: 'tabs', filter: true, nav: 'board', roles: 'cpa owner', strip: boardStrip(ALL),
  empty: { overdue: 'No return is overdue.', week: 'No return is due in the next 7 days.', waiting: 'No return is waiting on a client.', all: 'There are no returns.', default: 'Choose another view.' },
  note: 'Carried over from the last round; the owner family redraws this list and its count strip.',
})

// ---------- sign-in family, search, source, guide ----------
files['sign-in.html'] = auth.signIn()
files['sign-in-error.html'] = auth.signIn({ error: true })
files['sign-in-ended.html'] = auth.signInEnded()
files['code.html'] = auth.code()
files['code-error.html'] = auth.code({ error: true })
files['signed-out.html'] = auth.signedOut()
files['not-found.html'] = auth.notFound()
files['search.html'] = auth.search()
files['source.html'] = auth.source()
files['index.html'] = auth.index()

// ---------- the 300 records ----------
for (const r of ALL) files[`rec-${r.slug}.html`] = recordPage(r)

let n = 0
for (const [f, h] of Object.entries(files)) { write(f, h); n++ }

// a short tally so the numbers in the report come from the build
const aisha = ALL.filter((r) => r.prep === 'aisha')
const tally = (rows, views) => views.map(([k, l, f]) => `${l} ${rows.filter(f).length}`).join(', ')
console.log(`wrote ${n} pages (${ALL.length} records) for ${TODAY}`)
console.log(`Aisha ${aisha.length} returns: ${tally(aisha, VIEWS.mine)}`)
console.log(`Casey: ${tally(ALL.filter((r) => r.prep === 'casey'), VIEWS.mine)}`)
console.log(`Preparer queue (everyone): ${tally(ALL.filter(MEMBERS.prep), VIEWS.prep)}`)
console.log(`Review queue: ${tally(ALL.filter(MEMBERS.cpa), VIEWS.cpa)}`)
console.log(`Ops queue: ${tally(ALL.filter(MEMBERS.ops), VIEWS.ops)}`)
console.log(`New returns: ${tally(ALL.filter(MEMBERS.new), VIEWS.new)}`)
console.log(`Board: ${tally(ALL, VIEWS.board)}`)
