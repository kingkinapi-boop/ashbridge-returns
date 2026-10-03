import { STATES, stateInfo, RETURNS, PEOPLE } from './data.mjs';
import { ALL, esc, fmt, diffDays, stateTag, tierTag, waitTag, person, recHref, dateCell, nameCell, table, dataAttrs, sortDue, counts, chips, band, isDone, flagged, subNav } from './lib.mjs';

const ord = (k) => STATES.findIndex((s) => s[0] === k);
const tierOrd = { red: 0, amber: 1, green: 2, none: 3 };
const OPS_STEP = { intake: 'Check onboarding data', evidence: 'Capture the CRA data', approved: 'Send T183CORP', client_sign: 'Upload the signed certificate', ready_to_file: 'Upload the check export', filed: 'Save the notice of assessment' };
export const opsStep = (r) => r.nextOps || OPS_STEP[r.state] || 'None';

export const PREP_STATES = ['gaps', 'prepare', 'trace', 'respond', 'rework'];
export const OPS_STATES = ['intake', 'evidence', 'approved', 'client_sign', 'ready_to_file'];

// column library: [header, sort, numeric, cell(r) -> [html, sortValue]]
export const COL = {
  corp: ['Corporation and year end', 'none', false, (r, h) => [nameCell(r, h), r.name]],
  state: ['State', 'none', false, (r) => [stateTag(r.state), ord(r.state)]],
  tier: ['Tier', 'none', false, (r) => [tierTag(r.tier), tierOrd[r.tier]]],
  block: ['What blocks', 'none', false, (r) => [r.blocker ? `${esc(r.blocker)}${r.waiting ? '<br>' + waitTag(r.waiting) : ''}` : 'Nothing', r.blocker ? 0 : 1]],
  filing: ['Filing due', 'none', false, (r) => dateCell(r.filing, 'filing', isDone(r))],
  balance: ['Balance due', 'none', false, (r) => dateCell(r.balance, 'balance', isDone(r))],
  holder: ['Held by', 'none', false, (r) => [r.holder ? `${esc(person(r.holder))}<br><span class="govuk-hint govuk-!-margin-bottom-0">Hold ends ${r.holdExpires}</span>` : 'Nobody', r.holder ? 0 : 1]],
  flags: ['Flags or changes', 'none', true, (r) => [r.state === 'rework' ? `${r.changed} changed cells` : `${r.flags} pinned flags`, r.state === 'rework' ? r.changed : r.flags]],
  prep: ['Preparer', 'none', false, (r) => [`<span data-prep-cell>${esc(person(r.prep))}</span>`, person(r.prep)]],
  days: ['Days in this state', 'none', true, (r) => [`${r.daysInState}`, r.daysInState]],
  next: ['Next ops step', 'none', false, (r) => [esc(opsStep(r)), opsStep(r)]],
  missing: ['Missing item', 'none', false, (r) => [r.missing ? `<strong class="govuk-tag govuk-tag--orange">${esc(r.missing)}</strong>` : 'Nothing', r.missing ? 0 : 1]],
  flag: ['Waiting flag', 'none', false, (r) => [r.waiting ? waitTag(r.waiting) : 'None', r.waiting ? 0 : 1]],
  since: ['Waiting since', 'none', false, (r) => r.waiting ? [`${fmt(r.waiting.since)}`, r.waiting.since] : ['None', '9999']],
  waitdays: ['Days waiting on client', 'none', true, (r) => [`${r.waiting ? r.waiting.days : 0}`, r.waiting ? r.waiting.days : 0]],
  last: ['Last contact', 'none', false, (r) => r.waiting && r.waiting.last ? [`${fmt(r.waiting.last)}<br><span class="govuk-hint govuk-!-margin-bottom-0">${esc(r.waiting.lastHow)}</span>`, r.waiting.last] : ['Not recorded', '9999']],
};
export const SETS = {
  prep: ['corp', 'state', 'tier', 'block', 'days', 'filing', 'balance', 'holder'],
  cpa: ['corp', 'state', 'tier', 'flags', 'prep', 'days', 'filing', 'balance'],
  ops: ['corp', 'state', 'next', 'missing', 'prep', 'days', 'filing', 'balance', 'flag'],
  chase: ['corp', 'state', 'since', 'waitdays', 'last', 'filing', 'balance', 'prep'],
  board: ['corp', 'state', 'tier', 'filing', 'balance', 'prep', 'days', 'flag'],
};
// the default order of each list, stated by its own clause (staff-screens rule 6)
export const DEFAULT = {
  prep: ['filing', 'Filing due, earliest first (RV-20)'],
  cpa: ['tier', 'Tier, red first, then filing due (RV-8)'],
  ops: ['filing', 'Filing due, earliest first (RV-20)'],
  chase: ['since', 'Waiting since, longest first (RV-20)'],
  board: ['filing', 'Filing due, earliest first (RV-40)'],
};
const tieSort = { filing: (a, b) => a.filing.localeCompare(b.filing), tier: (a, b) => tierOrd[a.tier] - tierOrd[b.tier] || a.filing.localeCompare(b.filing), since: (a, b) => (a.waiting ? a.waiting.since : '9999').localeCompare(b.waiting ? b.waiting.since : '9999') };

export function listTable({ id, caption, set, rows, hrefFn, select = false, hiddenCaption = false, rowAttrs = () => '' }) {
  const keys = SETS[set];
  const def = DEFAULT[set][0];
  const cols = keys.map((k) => ({ h: COL[k][0], sort: k === def ? 'ascending' : 'none', num: COL[k][2] }));
  const sorted = [...rows].sort((a, b) => tieSort[def](a, b) || a.name.localeCompare(b.name));
  return table({ id, caption, cols, select, hiddenCaption, rows: sorted.map((r) => ({ id: r.slug, label: r.name, flagged: flagged(r), attrs: dataAttrs(r) + rowAttrs(r), cells: keys.map((k) => COL[k][3](r, hrefFn)) })) });
}

// views
export const VIEWS = {
  prep: { mine: (r) => r.prep === 'aisha' && PREP_STATES.includes(r.state), all: () => true, waiting: (r) => !!r.waiting, due14: (r) => diffDays(r.filing) <= 14 && !isDone(r), rework: (r) => r.state === 'rework' && r.prep === 'aisha' },
  cpa: { ready: (r) => r.state === 'review', rework: (r) => r.state === 'rework', all: (r) => ['review', 'rework', 'respond'].includes(r.state), due14: (r) => r.state === 'review' && diffDays(r.filing) <= 14 },
  ops: { next: (r) => OPS_STATES.includes(r.state), filed: (r) => r.state === 'filed', waiting: (r) => !!r.waiting, all: () => true },
};
export const pick = (role, v) => ALL.filter(VIEWS[role][v]);
// where a row opens: the preparer on the Workbench, the CPA on Review, ops on Ops (fix 2)
export const LANDING = { prep: 'workbench', cpa: 'review', ops: 'ops', board: 'overview' };

export const stateChips = (rows, which, scope = '') => { const c = counts(rows); return chips('Filter by state', STATES.filter((s) => c[s[0]] && (!which || which.includes(s[0]))).map((s) => ['state', s[0], s[1], c[s[0]]]), scope); };
export const tierChips = (rows, scope = '') => chips('Filter by tier or date', [['tier', 'red', 'Tier red', rows.filter((r) => r.tier === 'red').length], ['tier', 'amber', 'Tier amber', rows.filter((r) => r.tier === 'amber').length], ['tier', 'green', 'Tier green', rows.filter((r) => r.tier === 'green').length], ['wait', 'yes', 'Waiting on client', rows.filter((r) => r.waiting).length], ['due', '14', 'Due in 14 days or overdue', rows.filter((r) => !isDone(r) && diffDays(r.filing) <= 14).length]], scope);
export const bandChips = (rows, scope = '') => chips('Filter by filing due week', [['band', 'overdue', 'Overdue', rows.filter((r) => band(r) === 'overdue').length], ['band', 'week', 'Due in the next 7 days', rows.filter((r) => band(r) === 'week').length], ['band', 'month', 'Due in 8 to 28 days', rows.filter((r) => band(r) === 'month').length], ['band', 'later', 'Due later', rows.filter((r) => band(r) === 'later').length]], scope);

export const VIEW_DEFS = {
  prep: [['mine', 'My work', 'queue-preparer.html'], ['all', 'All returns', 'queue-all.html'], ['waiting', 'Waiting on client', 'queue-waiting.html'], ['due14', 'Due in 14 days or overdue', 'queue-due.html'], ['rework', 'My rework', 'queue-rework.html']],
  cpa: [['ready', 'Ready to review', 'queue-cpa.html'], ['rework', 'All rework', 'queue-cpa-rework.html'], ['due14', 'Ready to review, due in 14 days or overdue', 'queue-cpa-due.html'], ['all', 'All in review flow', 'queue-cpa-all.html']],
  ops: [['next', 'Next ops step', 'queue-ops.html'], ['filed', 'Filed, waiting for assessment', 'queue-ops-filed.html'], ['waiting', 'Waiting on client', 'queue-ops-waiting.html'], ['all', 'All returns', 'queue-ops-all.html']],
};
export function views(role, active, override = {}) {
  const n = (v) => (override[v] != null ? override[v] : pick(role, v).length);
  return `<h2 class="govuk-visually-hidden">List views</h2>` + subNav('List views', VIEW_DEFS[role].map(([k, l, h]) => [k, l, h, n(k), override[k] != null ? `${l} (empty-state example)` : l]), active);
}
