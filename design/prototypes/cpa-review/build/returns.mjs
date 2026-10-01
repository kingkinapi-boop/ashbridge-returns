// The three return scenarios the prototypes show. Made-up data only (sample clients 01 and 08).
// Flag severities, dollar effects, preparer answers, comments and history are prototype text.
import { buildReturn, money } from './data.mjs';

const r01Flags = [
  { id: '01-F01', sev: 'red', title: 'Personal services business signs', dollar: 30486.54, est: true, on: ['s125-8000'], answer: 'Asked the client for the Northwind contract on 24 Sep. She says she sets her own hours on other days. Left for the CPA.', source: 'Client answer, onboarding, client_notes' },
  { id: '01-F02', sev: 'red', title: 'Shareholder loan unpaid at year end, repay by 31 Dec 2026', dollar: 13211.58, on: ['s100-1301'], answer: 'Balance agrees to the bank rows and her list. Client told the deadline on 25 Sep.', source: 'Bank download, 6 rows' },
  { id: '01-F03', sev: 'red', title: 'Repaid 18 Dec, plans to reborrow in January', dollar: 12000, on: ['s100-1301'], answer: 'She confirms about $10,000 again in January. Left for the CPA.', source: 'Client answer, onboarding, client_notes' },
  { id: '01-F07', sev: 'amber', title: 'Home office: rent paid personally, not booked', dollar: 5040, on: ['s125-9368'], answer: 'Not booked. 15% of $2,800.00 a month is $5,040.00. Needs the CPA to decide.', source: 'Client answer, onboarding, home_office' },
  { id: '01-F08', sev: 'amber', title: 'Dividend needs a resolution and a T5', dollar: 20000, on: ['s3-3-paid', 's100-3700'], answer: 'Resolution on file. T5 drafted for Priya Nair (Test).', source: "Document, directors' resolution" },
  { id: '01-F09', sev: 'amber', title: 'HST payable at year end (Q4 paid 30 Jan 2026)', dollar: 5486.94, on: ['s100-2680'], answer: 'Q4 return paid 30 Jan 2026. CRA capture agrees.', source: 'CRA data capture, HST account' },
  { id: '01-F05', sev: 'amber', title: 'Business items on the owner personal card', dollar: 1788.42, on: ['s125-9150'], answer: 'Booked as 01-AJE-01. Receipts asked for; 4 of 6 received.', source: 'Adjusting entry 01-AJE-01' },
  { id: '01-F06', sev: 'amber', title: 'Meals: 50% limit on the deduction and the HST claim', dollar: 970.83, on: ['s1-121'], answer: 'Added back on Schedule 1. Half the HST on meals reversed.', source: 'Rule check' },
  { id: '01-F04', sev: 'amber', title: 'No interest charged on the shareholder loan', dollar: null, on: ['s100-1301'], answer: 'No interest charged. Treatment for the CPA to confirm.', source: 'Client answer, onboarding, client_notes' },
];

const r01Base = {
  id: 'r01', client: '01', dir: '01-maple-ridge', ye: '31 Dec 2025', lyYe: '31 Dec 2024', tier: 'red', state: 'Ready for review',
  tierWhy: ['Three red flags: personal services business signs, a shareholder loan unpaid at year end, and repay then reborrow', 'A judgment call on home office is open', 'Revenue rests on one client (about 90%)'],
  flags: r01Flags,
  lyOverride: { 8000: 158400, 8523: 1720.4 },
  instalments: 0, instalmentsLy: 0,
  lineOpts: {
    9200: { failed: { type: 'failed', kind: 'Bank download', party: 'third', caption: 'Bank download, lakeview-chequing-4821.csv', reason: 'The file could not be read just now. The QuickBooks export and the card download still show.' } },
    9275: { noEvidence: true },
    1301: { extraSources: [{ type: 'card', kind: 'Client answer', party: 'client', caption: 'Client answer, onboarding, personal_card_business_items', title: 'Business items on my personal card', quote: 'I put a few business things on my own card by mistake. The list is above.', fields: [['Given in', 'Onboarding, client app'], ['Items', '6, total 1,788.42']] }] },
    2680: { extraSources: [{ type: 'card', kind: 'CRA data capture', party: 'third', caption: 'CRA data capture, HST account, Q4 2025', title: 'HST account, Q4 2025', fields: [['Period', '1 Oct 2025 to 31 Dec 2025'], ['Net tax', '5,486.94'], ['Paid', '30 Jan 2026'], ['Captured by', 'Sam Okoro (Test), 26 Sep 2026']] }] },
  },
  assumptions: [
    ['Personal services business', 'Not decided. Left for the CPA (flag 01-F01).'],
    ['Monitor $379.99', 'Expensed, not added to class 50 (preparer)'],
    ['Home office', 'Not claimed until the CPA decides (flag 01-F07)'],
    ['Client said', 'The $20,000 on 20 Dec was a dividend'],
    ['Client said', 'Six items on her personal card are business costs'],
  ],
  attestations: [
    ['Numbers with no source', '1: Delivery, freight and express', 's125-9275'],
    ['Taxprep diagnostics cleared', 'Yes, 14 of 14'],
    ['Preparer signed', 'Dana Price (Test), 30 Sep 2026, 4:42 pm'],
  ],
  history: [
    ['2026-09-30T16:42', 'Sent to the CPA for review', 'Dana Price (Test)', 'Preparer signed. 14 Taxprep diagnostics cleared.'],
    ['2026-09-30T11:05', 'Return locked and traced', 'Dana Price (Test)', '41 numbers traced; 1 with no source.'],
    ['2026-09-26T09:30', 'CRA data captured', 'Sam Okoro (Test)', 'HST account and instalments.'],
  ],
};

export const r01 = buildReturn(r01Base);

const aje2 = {
  id: '01-AJE-02', date: '2025-12-31', amount: 5040,
  reason: "Home office: 15% of the rent the owner pays personally, as the CPA decided on 1 Oct 2026. It reduces what she owes the company.",
  lines: [{ account: '6200', name: 'Business-use-of-home expenses', gifi: 9945, debit: 5040, credit: 0 }, { account: '1300', name: 'Due from shareholder', gifi: 1301, debit: 0, credit: 5040 }],
};

const r01bRaw = buildReturn({
  ...r01Base, id: 'r01b', state: 'Back from rework', extraAje: [aje2], newCodes: [9945],
  flags: r01Flags.map((f) => (f.id === '01-F07' ? { ...f, on: ['s125-9945'], answer: 'Booked as 01-AJE-02 as the CPA decided (comment 1).', source: 'Adjusting entry 01-AJE-02' } : f)),
  lineOpts: {
    ...r01Base.lineOpts,
    9945: { extraSources: [{ type: 'card', kind: 'Judgment input', party: 'judgment', caption: 'Judgment input, home office claim', title: 'Home office claim', fields: [['Decision', 'Claim 15% of rent'], ['Decided by', 'Zo (Test), CPA, comment 1'], ['Amount', '5,040.00']] }, { type: 'card', kind: 'Client answer', party: 'client', caption: 'Client answer, onboarding, home_office', title: 'Home office', quote: 'I pay $2,800 a month rent for my home. About 15% of it is my office.', fields: [['Share', '15%'], ['Rent a month', '2,800.00']] }] },
  },
  comments: [
    { n: 1, line: 's125-9368', type: 'Error', sev: 'High', by: 'Zo (Test)', at: '1 Oct 2026, 3:12 pm', text: 'I accept the home office claim. Book 15% of rent, $5,040.00, against the shareholder balance.', reply: 'Booked as 01-AJE-02, 2 Oct 2026, 9:58 am.', replyBy: 'Dana Price (Test)', status: 'Answered' },
    { n: 2, line: 's125-8000', type: 'Missing evidence', sev: 'High', by: 'Zo (Test)', at: '1 Oct 2026, 3:20 pm', text: 'Upload the Northwind contract before I decide on personal services business.', reply: 'Contract uploaded 2 Oct 2026. It is in the sources for line 8000.', replyBy: 'Dana Price (Test)', status: 'Answered' },
  ],
  seedReviewed: { s3: { by: 'Zo (Test)', at: '1 Oct 2026, 3:24 pm' }, s50: { by: 'Zo (Test)', at: '1 Oct 2026, 3:25 pm' } },
  history: [
    ['2026-10-02T10:14', 'Reviewed marks removed from 3 sections', 'Ashbridge Returns', 'Numbers changed in Balance sheet, Income statement and Schedule 1 after rework.'],
    ['2026-10-02T10:12', 'Sent back to the CPA', 'Dana Price (Test)', 'Both comments answered.'],
    ['2026-10-02T09:58', 'Adjusting entry 01-AJE-02 booked', 'Dana Price (Test)', 'Home office, 5,040.00.'],
    ['2026-10-01T15:31', 'Sent back to the preparer', 'Zo (Test)', '2 comments.'],
    ['2026-10-01T15:25', 'Schedule 50 marked reviewed', 'Zo (Test)', ''],
    ['2026-10-01T15:24', 'Schedule 3 marked reviewed', 'Zo (Test)', ''],
    ['2026-10-01T15:02', 'Balance sheet, Income statement and Schedule 1 marked reviewed', 'Zo (Test)', ''],
    ...r01Base.history,
  ],
});

// After rework: only changed cells, before and after (RV-7). Sections with a changed number lose their mark.
const before = new Map(r01.sections.flatMap((s) => s.lines).map((l) => [l.key, l]));
const changed = r01bRaw.sections.flatMap((s) => s.lines.filter((l) => !before.has(l.key) || before.get(l.key).value !== l.value).map((l) => ({ key: l.key, section: s.id, sectionTitle: s.title, code: l.code, label: l.label, before: before.has(l.key) ? before.get(l.key).v : 'none', after: l.v })));
const sixBefore = new Map(r01.six.map((x) => [x.label, x.v]));
const changedSections = [...new Set(changed.map((c) => c.section))];
const sectionTitle = (id) => r01bRaw.sections.find((s) => s.id === id).title;
for (const l of r01bRaw.sections.flatMap((s) => s.lines)) {
  const c = changed.find((x) => x.key === l.key);
  if (c) { l.changedFrom = c.before; if (!l.hi.includes('changed after rework')) l.hi.push('changed after rework'); }
}
r01bRaw.rework = {
  changed, changedSections, sixBefore: Object.fromEntries(sixBefore),
  summary: `${changed.length} numbers changed in ${changedSections.length} sections after rework`,
};
r01bRaw.removedMarks = Object.fromEntries(changedSections.map((id) => [id, `Mark removed 2 Oct 2026, 10:14 am: ${changed.filter((c) => c.section === id).length} numbers in ${sectionTitle(id)} changed after rework (adjusting entry 01-AJE-02).`]));
r01bRaw.comments = r01bRaw.comments;
export const r01b = r01bRaw;

export const r08 = buildReturn({
  id: 'r08', client: '08', dir: '08-queen-west-design', ye: '30 Sep 2025', lyYe: '30 Sep 2024', tier: 'green', state: 'Ready for review',
  tierWhy: ['No red flag', 'Three amber flags, each answered with a source', 'Two lines rest on judgment (amortization and the accrued fee)'],
  flags: [
    { id: '08-F01', sev: 'amber', title: 'Bad debt: invoice of $4,520.00 written off in September', dollar: 4000, on: ['s125-8590'], answer: 'Client went bankrupt (notice uploaded). HST of $520.00 claimed back.', source: 'Document, bankruptcy notice' },
    { id: '08-F05', sev: 'amber', title: 'US clients paid in USD: exchange and zero-rating', dollar: 818.1, on: ['s125-8231', 's100-1003'], answer: 'USD account revalued at 1.3900 (test rate). Zero-rated sales agree to the USD download.', source: 'Bank download, USD account' },
    { id: '08-F07', sev: 'amber', title: 'CCA: laptop class 50 and camera class 8', dollar: null, on: ['s8-8-add', 's8-50-add'], answer: 'Both before HST, both on the business card.', source: 'Card download, 2 rows' },
  ],
  lyOverride: {},
  cca: [
    { cls: '8', what: 'Camera', open: 3440, openLy: 4300, add: 2150, addTx: ['08-BCD-2025-03-0018'], cca: 1118, ccaLy: 860 },
    { cls: '50', what: 'Laptop', open: 1210, openLy: 2689, add: 3299, addTx: ['08-BCD-2024-11-0020'], cca: 2479.95, ccaLy: 1479 },
  ],
  instalments: 0, instalmentsLy: 0,
  assumptions: [
    ['Accounting fee', 'Accrued $3,500.00 billed after year end (preparer)'],
    ['Amortization', 'Straight line: laptop 3 years, camera and older equipment 5 years (preparer)'],
    ['Client said', 'Five software subscriptions on his personal card are business costs'],
  ],
  attestations: [
    ['Numbers with no source', '0'],
    ['Taxprep diagnostics cleared', 'Yes, 9 of 9'],
    ['Preparer signed', 'Dana Price (Test), 29 Sep 2026, 2:10 pm'],
  ],
  seedReviewed: { s100: { by: 'Zo (Test)', at: '1 Oct 2026, 11:02 am' }, s125: { by: 'Zo (Test)', at: '1 Oct 2026, 11:09 am' }, s1: { by: 'Zo (Test)', at: '1 Oct 2026, 11:11 am' }, s8: { by: 'Zo (Test)', at: '1 Oct 2026, 11:14 am' } },
  history: [
    ['2026-10-01T11:14', 'Schedule 8 marked reviewed', 'Zo (Test)', ''],
    ['2026-10-01T11:00', 'Review started', 'Zo (Test)', ''],
    ['2026-09-29T14:10', 'Sent to the CPA for review', 'Dana Price (Test)', 'Preparer signed. 9 Taxprep diagnostics cleared.'],
  ],
});

export const QUEUE = [
  { ret: 'r01', name: 'Maple Ridge Consulting Inc. (Test)', ye: '31 Dec 2025', tier: 'red', state: 'Ready for review', due: '30 Jun 2026', dueIso: '2026-06-30', blocks: 'Nothing', open: true },
  { ret: 'r08', name: 'Queen West Design Studio Inc. (Test)', ye: '30 Sep 2025', tier: 'green', state: 'In review, 4 of 5 sections', due: '31 Mar 2026', dueIso: '2026-03-31', blocks: 'Nothing', open: true },
  { ret: 'r01b', name: 'Maple Ridge Consulting Inc. (Test)', ye: '31 Dec 2025', tier: 'red', state: 'Back from rework', due: '30 Jun 2026', dueIso: '2026-06-30', blocks: 'Nothing', open: true, note: 'the same return after rework (second scenario)' },
  { name: 'Danforth Cleaning Co. Ltd. (Test)', ye: '31 Dec 2025', tier: 'red', state: 'Preparing', due: '30 Jun 2026', dueIso: '2026-06-30', blocks: 'Missing May bank statement' },
  { name: 'Halton Haulage Ltd. (Test)', ye: '31 Mar 2026', tier: 'amber', state: 'Preparing', due: '30 Sep 2026', dueIso: '2026-09-30', blocks: 'CRA instalment record' },
  { name: 'Eglinton Holdings Inc. (Test)', ye: '31 Dec 2025', tier: 'amber', state: 'Preparing', due: '30 Jun 2026', dueIso: '2026-06-30', blocks: 'Waiting on Eglinton Retail Ltd. (Test)' },
];

export const RETURNS = { r01, r01b, r08 };
export { money };
