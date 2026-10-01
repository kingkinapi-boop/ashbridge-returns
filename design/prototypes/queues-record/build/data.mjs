// Made-up test-world data for the queues-record prototypes. Ten sample clients (reference/sample-clients)
// plus synthetic filler returns for the 300-row state. Nothing here is real.
export const TODAY = '2026-06-08'; // the prototype's pinned "today" (a Monday)

export const STATES = [
  ['intake', 'Intake', 'grey', 'system'],
  ['evidence', 'Evidence', 'grey', 'system, ops'],
  ['gaps', 'Gaps', 'grey', 'preparer'],
  ['qa', 'Client questions', 'grey', 'client'],
  ['build', 'Build', 'blue', 'system'],
  ['prepare', 'Prepare', 'blue', 'preparer'],
  ['trace', 'Trace', 'blue', 'system, preparer'],
  ['respond', 'Respond', 'blue', 'preparer'],
  ['review', 'Review', 'purple', 'CPA'],
  ['rework', 'Rework', 'orange', 'preparer'],
  ['approved', 'Approved', 'green', 'ops'],
  ['client_sign', 'Client signing', 'green', 'client'],
  ['ready_to_file', 'Ready to file', 'green', 'ops'],
  ['filed', 'Filed', 'turquoise', 'ops'],
  ['assessed', 'Assessed', 'turquoise', 'system'],
  ['closed', 'Closed', 'grey', 'none'],
];
export const stateInfo = Object.fromEntries(STATES.map(([k, l, c, who]) => [k, { key: k, label: l, colour: c, who }]));

export const PEOPLE = {
  aisha: 'Aisha Rahman (Test)',
  ben: 'Ben Ortiz (Test)',
  dana: 'Dana Whitfield, CPA (Test)',
  priti: 'Priti Shah (Test)',
  x1: 'Carla Mendes (Test)',
  x2: 'Dev Patel (Test)',
  x3: 'Elena Petrova (Test)',
  x4: 'Farid Haddad (Test)',
  x5: 'Grace Okoro (Test)',
  x6: 'Hiro Tanaka (Test)',
};

const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export { addDays }; // ISO strings stay as they are

// year end -> due dates (FLOW-7): filing = 6 months after, balance due = 2 months, or 3 for a CCPC that qualifies.
function addMonthsEnd(iso, m) {
  const [y, mo, day] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo - 1 + m + 1, 0));
  const isEnd = new Date(Date.UTC(y, mo, 0)).getUTCDate() === day;
  if (isEnd) return last.toISOString().slice(0, 10);
  const t = new Date(Date.UTC(y, mo - 1 + m, Math.min(day, last.getUTCDate())));
  return t.toISOString().slice(0, 10);
}
export function dues(ye, threeMonths = true) {
  return { filing: addMonthsEnd(ye, 6), balance: addMonthsEnd(ye, threeMonths ? 3 : 2) };
}

const mk = (o) => {
  const dd = dues(o.ye, o.three !== false);
  return { tier: 'none', flags: 0, changed: 0, group: null, holder: null, blocker: null, waiting: null, nextOps: null, missing: null, cpa: 'dana', ...dd, ...o };
};

export const RETURNS = [
  mk({ slug: 'maple-ridge', name: 'Maple Ridge Consulting Inc. (Test)', bn: '983056423', ye: '2025-12-31', state: 'review', since: '2026-06-05', tier: 'amber', flags: 4, prep: 'aisha', daysInState: 3,
    note: 'Personal services business signs and the shareholder loan are pinned flags.', changesSince: { when: '5 Jun 2026, 09:00', comments: 0, docs: 1, events: 3 },
    docs: [['Chequing statements Jan to Dec 2025', 'Lakeview Bank (Test)', 'Read'], ['Business card statements 2025', 'Aurora Card (Test)', 'Read'], ['Owner personal card, business items', 'Aurora Card (Test)', 'Read'], ['Prior-year T2 return', 'Client app upload', 'Read'], ['Onboarding summary', 'Client app', 'Read'], ['Shareholder loan schedule', 'Preparer', 'Read']],
    exc: [['Shareholder loan repaid then re-borrowed', 'Red', 'Answered'], ['Personal services business signs', 'Red', 'Answered'], ['Home office share 15%', 'Amber', 'Answered'], ['Meals about 1,850.00 on business card', 'Amber', 'Answered'], ['Dividend 20,000.00 and T5', 'Amber', 'Answered']],
    hist: [['Preparer signed; sent to review', 'Aisha Rahman (Test)', '5 Jun 2026, 16:40', 'respond to review'], ['Exceptions all answered', 'Aisha Rahman (Test)', '5 Jun 2026, 15:12', null], ['Lock export and printed return uploaded', 'Aisha Rahman (Test)', '4 Jun 2026, 11:03', null], ['Zero orphans, zero unexplained overrides', 'System', '4 Jun 2026, 11:04', 'trace to respond']] }),
  mk({ slug: 'halton-haulage', name: 'Halton Haulage Ltd. (Test)', bn: '779886143', ye: '2026-03-31', state: 'prepare', since: '2026-06-02', tier: 'amber', flags: 3, prep: 'aisha', holder: 'aisha', holdExpires: '8 Jun 2026, 14:20', daysInState: 6,
    blocker: 'Lock export not uploaded', blockerLink: 'documents',
    note: 'Tractor financing (class 16) and CRA instalment record that credits three of four payments.',
    docs: [['Chequing statements Apr 2025 to Mar 2026', 'Maplestone Bank (Test)', 'Read'], ['Business card statements', 'Aurora Card (Test)', 'Read'], ['Equipment finance amortisation table', 'Client app', 'Read'], ['CRA instalment record', 'CRA, saved by ops', 'Read'], ['Taxprep lock export and printed return', 'Preparer', 'Not uploaded']],
    exc: [['CRA credits 3 of 4 instalments', 'Red', 'Open'], ['Personal groceries and flight on business card', 'Amber', 'Open'], ['HST late-filing penalty 412.37', 'Amber', 'Open']],
    hist: [['Hold taken by Aisha Rahman (Test)', 'Aisha Rahman (Test)', '8 Jun 2026, 09:12', null], ['Import file written (AI draft saved)', 'System', '2 Jun 2026, 10:30', 'build to prepare'], ['Question list answered by client', 'Client, in the client app', '1 Jun 2026, 17:55', 'qa to build']],
    changesSince: { when: '4 Jun 2026, 16:40', comments: 1, docs: 1, events: 2 } }),
  mk({ slug: 'bluewater-renovations', name: 'Bluewater Renovations Inc. (Test)', bn: '413840162', ye: '2025-06-30', state: 'assessed', since: '2026-02-12', tier: 'green', prep: 'ben', daysInState: 116,
    docs: [['Filed return PDF', 'Preparer', 'Read'], ['Notice of assessment', 'Ops', 'Read']], exc: [], hist: [['Notice of assessment saved and compared: matches', 'System', '12 Feb 2026, 10:00', 'filed to assessed']] }),
  mk({ slug: 'lakeshore-eats', name: 'Lakeshore Eats Inc. (Test)', bn: '565724300', ye: '2025-12-31', state: 'qa', since: '2026-05-29', prep: 'ben', daysInState: 10,
    waiting: { since: '2026-05-29', last: '2026-06-02', lastHow: 'Nudge sent from the client app', days: 10 }, blocker: 'Waiting on client: 6 answers', blockerLink: 'history', changesSince: { when: '1 Jun 2026, 16:00', comments: 0, docs: 0, events: 1 },
    docs: [['Daily card batch summaries', 'Moneris (Test)', 'Read'], ['Chequing statements', 'Lakeview Bank (Test)', 'Read'], ['Quick-method rate confirmation', 'Client app', 'Missing']],
    exc: [['Quick-method rate to confirm against CRA', 'Amber', 'Open']], hist: [['Nudge sent to client', 'Priti Shah (Test)', '2 Jun 2026, 09:00', null], ['Question list sent, 6 questions', 'Ben Ortiz (Test)', '29 May 2026, 14:20', 'gaps to qa']] }),
  mk({ slug: 'eglinton-holdings', name: 'Eglinton Holdings Inc. (Test)', bn: '290325330', ye: '2025-12-31', state: 'rework', since: '2026-06-04', tier: 'red', flags: 5, changed: 7, prep: 'aisha', daysInState: 4, group: 'Eglinton group (2 returns)',
    voided: true, changesSince: { when: '4 Jun 2026, 12:00', comments: 4, docs: 0, events: 2 }, note: 'Capital dividend paid with no election filed; business limit allocation clashes with the retail company.',
    docs: [['Brokerage statements', 'Crestview Investing (Test)', 'Read'], ['Dividend resolutions', 'Client app', 'Read'], ['GIC interest slips', 'Client app', 'Read']],
    exc: [['Capital dividend 30,000.00, no election filed', 'Red', 'Answered'], ['Business limit 100,000.00 kept, retail claims 500,000.00', 'Red', 'Answered'], ['Capital gain on ETF units 90,000.00', 'Amber', 'Answered']],
    hist: [['CPA returned with 4 comments', 'Dana Whitfield, CPA (Test)', '4 Jun 2026, 17:30', 'review to rework'], ['Approval void: 7 cells changed after approval check', 'System', '4 Jun 2026, 17:31', null], ['Preparer signed; sent to review', 'Aisha Rahman (Test)', '3 Jun 2026, 16:05', 'respond to review']] }),
  mk({ slug: 'eglinton-retail', name: 'Eglinton Retail Ltd. (Test)', bn: '332698207', ye: '2025-12-31', state: 'trace', since: '2026-06-06', tier: 'amber', flags: 2, prep: 'aisha', daysInState: 2, group: 'Eglinton group (2 returns)',
    blocker: '2 orphan cells in the lock export', blockerLink: 'exceptions',
    docs: [['Shopify payout reports', 'Client app', 'Read'], ['Stripe USD account statements', 'Stripe (Test)', 'Read'], ['Year-end exchange rate (test rate)', 'Client app', 'Read'], ['Lock export', 'Preparer upload', 'Read'], ['Printed return', 'Preparer upload', 'Read']],
    exc: [['Orphan cell: line 8320 total', 'Red', 'Open'], ['Orphan cell: schedule 8 class 8 addition', 'Red', 'Open']],
    hist: [['Lock export and printed return uploaded', 'Aisha Rahman (Test)', '6 Jun 2026, 14:41', null], ['Trace found 2 orphans', 'System', '6 Jun 2026, 14:42', null]] }),
  mk({ slug: 'riverdale-rentals', name: 'Riverdale Rentals Inc. (Test)', bn: '378085437', ye: '2025-12-31', state: 'approved', since: '2026-06-05', tier: 'green', prep: 'ben', daysInState: 3, nextOps: 'Send T183CORP', missing: 'T183CORP not sent',
    docs: [['Mortgage interest split', 'Client app', 'Read'], ['Property tax bills', 'Client app', 'Read']], exc: [['Roof 18,400.00 capital, not repair', 'Amber', 'Answered']],
    hist: [['CPA approved; fingerprint stored', 'Dana Whitfield, CPA (Test)', '5 Jun 2026, 10:22', 'review to approved']] }),
  mk({ slug: 'queen-west-design', name: 'Queen West Design Studio Inc. (Test)', bn: '706169250', ye: '2025-09-30', state: 'filed', since: '2026-03-30', tier: 'green', prep: 'ben', daysInState: 70, nextOps: 'Save the notice of assessment', missing: 'Notice of assessment',
    docs: [['Filing confirmation', 'Ops', 'Read']], exc: [], hist: [['Confirmation number entered', 'Priti Shah (Test)', '30 Mar 2026, 11:15', 'ready_to_file to filed']] }),
  mk({ slug: 'scarborough-robotics', name: 'Scarborough Robotics Labs Inc. (Test)', bn: '603783528', ye: '2025-12-31', state: 'ready_to_file', since: '2026-06-04', tier: 'green', prep: 'ben', daysInState: 4, nextOps: 'Upload the check export', missing: 'Check export', three: false,
    docs: [['T183CORP certificate, signed', 'CCH Digital Signature', 'Read']], exc: [['Short first year, limit prorated', 'Amber', 'Answered']],
    hist: [['Gate 2 passed; transmitted', 'Priti Shah (Test)', '4 Jun 2026, 15:50', null]] }),
  mk({ slug: 'danforth-cleaning', name: 'Danforth Cleaning Co. Ltd. (Test)', bn: '404759750', ye: '2025-12-31', state: 'gaps', since: '2026-05-21', prep: 'ben', daysInState: 18,
    waiting: { since: '2026-05-21', last: '2026-05-21', lastHow: 'Question sent by Ben Ortiz (Test)', days: 18 }, blocker: 'Missing statement: March 2025', blockerLink: 'documents',
    docs: [['Chequing statements (March missing)', 'Harbourline Credit Union (Test)', 'Gap'], ['Prior-year statement mixed in', 'Client upload', 'Check'], ['Business card statements', 'Aurora Card (Test)', 'Read']],
    exc: [['Spouse paid with no payroll', 'Red', 'Open'], ['Luxury vehicle cost over class 10.1 limit', 'Amber', 'Open'], ['Late-filing penalties', 'Amber', 'Open']],
    hist: [['Question sent: March 2025 statement', 'Ben Ortiz (Test)', '21 May 2026, 10:10', 'evidence to gaps']] }),
];

// filler: synthetic returns, 290 of them, so the whole list is 300
function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
export function filler() {
  const r = lcg(42); const out = []; const pick = (a) => a[Math.floor(r() * a.length)];
  const words = ['Cedar', 'Harbour', 'Willow', 'Summit', 'Parkdale', 'Beaches', 'Annex', 'Leaside', 'Weston', 'Rouge', 'Humber', 'Don Mills', 'Agincourt', 'Kensington'];
  const kinds = ['Plumbing', 'Dental', 'Bakery', 'Logistics', 'Studio', 'Consulting', 'Landscaping', 'Print', 'Rentals', 'Foods'];
  const yes = ['2025-12-31', '2025-12-31', '2025-12-15', '2025-12-10', '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'];
  const stateKeys = ['evidence', 'gaps', 'qa', 'prepare', 'prepare', 'trace', 'respond', 'review', 'review', 'rework', 'approved', 'ready_to_file', 'filed'];
  for (let i = 1; i <= 290; i++) {
    const st = pick(stateKeys); const ye = st === 'filed' ? pick(['2025-09-30', '2025-06-30']) : pick(yes); const dd = dues(ye, true);
    const n = String(i).padStart(3, '0');
    const prep = pick(['aisha', 'ben', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6']);
    const tier = ['gaps', 'qa', 'evidence'].includes(st) ? 'none' : pick(['green', 'green', 'amber', 'red']);
    const dis = 1 + Math.floor(r() * 30); const wd = 2 + Math.floor(r() * 20); const w = r() < 0.12 && ['gaps', 'qa'].includes(st) ? { days: wd, since: addDays(TODAY, -wd), last: addDays(TODAY, -Math.max(1, wd - 3)), lastHow: 'Question sent from the client app' } : null;
    out.push({ slug: 'filler-' + n, name: `${pick(words)} ${pick(kinds)} ${n} Inc. (Test)`, bn: String(100000000 + Math.floor(r() * 899999999)), ye, state: st, tier, prep, cpa: 'dana', ...dd, flags: tier === 'red' ? 3 : tier === 'amber' ? 2 : 0, changed: st === 'rework' ? 1 + Math.floor(r() * 12) : 0, waiting: w, blocker: w ? 'Waiting on client' : null, daysInState: dis, since: addDays(TODAY, -dis), nextOps: null, filler: true });
  }
  return out;
}

export const TIER = { none: ['Tier not set', 'grey'], green: ['Tier green', 'green'], amber: ['Tier amber', 'yellow'], red: ['Tier red', 'red'] };
export const bySlug = Object.fromEntries(RETURNS.map((x) => [x.slug, x]));
