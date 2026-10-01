import { STATES, stateInfo, RETURNS, PEOPLE } from './data.mjs';
import { ALL, esc, fmt, diffDays, stateTag, tierTag, waitTag, person, recHref, dateCell, nameCell, table, dataAttrs, sortDue, counts, chips, filterBox, emptyFilter, subNav } from './lib.mjs';

const ord = (k) => STATES.findIndex((s) => s[0] === k);
const tierOrd = { red: 0, amber: 1, green: 2, none: 3 };
const OPS_STEP = { intake: 'Check onboarding data', evidence: 'Capture CRA data', approved: 'Run gate 1, send T183CORP', client_sign: 'Upload signed certificate', ready_to_file: 'Enter the confirmation number', filed: 'Save the notice of assessment' };
export const opsStep = (r) => r.nextOps || OPS_STEP[r.state] || 'None';

export const PREP_STATES = ['gaps', 'prepare', 'trace', 'respond', 'rework'];
export const OPS_STATES = ['intake', 'evidence', 'approved', 'client_sign', 'ready_to_file', 'filed'];

// column library: [header, sort, numeric, cell(r) -> [html, sortValue]]
export const COL = {
  corp: ['Corporation and year end', 'none', false, (r, h) => [nameCell(r, h), r.name]],
  state: ['State', 'none', false, (r) => [stateTag(r.state), ord(r.state)]],
  tier: ['Tier', 'none', false, (r) => [tierTag(r.tier), tierOrd[r.tier]]],
  block: ['What blocks', 'none', false, (r) => [r.blocker ? `${esc(r.blocker)}${r.waiting ? '<br>' + waitTag(r.waiting) : ''}` : 'Nothing', r.blocker ? 0 : 1]],
  filing: ['Filing due', 'ascending', false, (r) => dateCell(r.filing, 'filing', ['filed', 'assessed', 'closed'].includes(r.state))],
  balance: ['Balance due', 'none', false, (r) => dateCell(r.balance, 'balance', ['filed', 'assessed', 'closed'].includes(r.state))],
  holder: ['Held by', 'none', false, (r) => [r.holder ? `${esc(person(r.holder))}<br><span class="govuk-hint govuk-!-margin-bottom-0">Expires ${r.holdExpires || 'in 2 hours'}</span>` : 'Nobody', r.holder ? 0 : 1]],
  flags: ['Flags or changes', 'none', true, (r) => [r.state === 'rework' ? `${r.changed} changed cells` : `${r.flags} pinned flags`, r.state === 'rework' ? r.changed : r.flags]],
  prep: ['Preparer', 'none', false, (r) => [esc(person(r.prep)), person(r.prep)]],
  days: ['Days waiting', 'none', true, (r) => [`${r.daysInState}`, r.daysInState]],
  next: ['Next ops step', 'none', false, (r) => [esc(opsStep(r)), opsStep(r)]],
  missing: ['Missing item', 'none', false, (r) => [r.missing ? `<strong class="govuk-tag govuk-tag--orange">${esc(r.missing)}</strong>` : 'Nothing', r.missing ? 0 : 1]],
  flag: ['Waiting flag', 'none', false, (r) => [r.waiting ? waitTag(r.waiting) : 'None', r.waiting ? 0 : 1]],
  since: ['Waiting since', 'none', false, (r) => r.waiting ? [`${esc(r.waiting.since ? fmt(r.waiting.since) : r.daysInState + ' days ago')}`, r.waiting.since || ''] : ['None', '']],
  waitdays: ['Days waiting on client', 'none', true, (r) => [`${r.waiting ? r.waiting.days : 0}`, r.waiting ? r.waiting.days : 0]],
  last: ['Last contact', 'none', false, (r) => [r.waiting && r.waiting.last ? `${fmt(r.waiting.last)}<br><span class="govuk-hint govuk-!-margin-bottom-0">${esc(r.waiting.lastHow)}</span>` : 'Not recorded', r.waiting && r.waiting.last ? r.waiting.last : '']],
};
export const SETS = {
  prep: ['corp', 'state', 'tier', 'block', 'filing', 'balance', 'holder'],
  cpa: ['corp', 'state', 'tier', 'flags', 'prep', 'days', 'filing', 'balance'],
  ops: ['corp', 'state', 'next', 'missing', 'filing', 'balance', 'flag'],
  chase: ['corp', 'state', 'since', 'waitdays', 'last', 'filing', 'balance', 'prep'],
  splitprep: ['corp', 'state', 'tier', 'filing'],
  splitcpa: ['corp', 'tier', 'flags', 'filing'],
  splitops: ['corp', 'state', 'next', 'filing'],
  board: ['corp', 'state', 'tier', 'filing', 'balance', 'prep', 'days', 'flag'],
};

export function listTable({ id, caption, set, rows, hrefFn, select = false, hiddenCaption = false, rowAttrs = () => '' }) {
  const keys = SETS[set];
  const cols = keys.map((k) => ({ h: COL[k][0], sort: COL[k][1] === 'ascending' ? 'ascending' : 'none', num: COL[k][2] }));
  return table({ id, caption, cols, select, hiddenCaption, rows: sortDue(rows).map((r) => ({ id: r.slug, label: r.name, attrs: dataAttrs(r) + rowAttrs(r), cells: keys.map((k) => COL[k][3](r, hrefFn)) })) });
}

// views
export const VIEWS = {
  prep: { mine: (r) => r.prep === 'aisha' && PREP_STATES.includes(r.state), all: () => true, waiting: (r) => !!r.waiting, due14: (r) => diffDays(r.filing) <= 14 && diffDays(r.filing) >= 0 && !['filed', 'assessed', 'closed'].includes(r.state), rework: (r) => r.state === 'rework' && r.prep === 'aisha' },
  cpa: { ready: (r) => r.state === 'review', rework: (r) => r.state === 'rework', all: (r) => ['review', 'rework', 'respond'].includes(r.state), due14: (r) => r.state === 'review' && diffDays(r.filing) <= 14 },
  ops: { next: (r) => OPS_STATES.includes(r.state), waiting: (r) => !!r.waiting, all: () => true },
};
export const pick = (role, v) => ALL.filter(VIEWS[role][v]);

export const stateChips = (rows, which) => { const c = counts(rows); return chips('Filter by state', STATES.filter((s) => c[s[0]] && (!which || which.includes(s[0]))).map((s) => ['state', s[0], s[1], c[s[0]]])); };
export const tierChips = (rows) => chips('Filter by tier', [['tier', 'red', 'Tier red', rows.filter((r) => r.tier === 'red').length], ['tier', 'amber', 'Tier amber', rows.filter((r) => r.tier === 'amber').length], ['tier', 'green', 'Tier green', rows.filter((r) => r.tier === 'green').length], ['wait', 'yes', 'Waiting on client', rows.filter((r) => r.waiting).length], ['due', '14', 'Due in 14 days or overdue', rows.filter((r) => diffDays(r.filing) <= 14 && diffDays(r.filing) >= 0).length]]);

export function views(role, active) {
  const n = (v) => pick(role, v).length;
  const defs = {
    prep: [['mine', 'My work', 'queue-preparer.html'], ['all', 'All returns', 'queue-all.html'], ['waiting', 'Waiting on client', 'queue-waiting.html'], ['due14', 'Due in 14 days', 'queue-due.html'], ['rework', 'Rework', 'queue-rework.html']],
    cpa: [['ready', 'Ready to review', 'queue-cpa.html'], ['rework', 'Rework', 'queue-cpa-rework.html'], ['due14', 'Due in 14 days', 'queue-cpa-due.html'], ['all', 'All in review flow', 'queue-cpa-all.html']],
    ops: [['next', 'Next ops step', 'queue-ops.html'], ['waiting', 'Waiting on client', 'queue-ops-waiting.html'], ['all', 'All returns', 'queue-ops-all.html']],
  }[role];
  return `<h2 class="govuk-visually-hidden">List views</h2>` + subNav('List views', defs.map(([k, l, h]) => [k, l, h, n(k)]), active);
}
