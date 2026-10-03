// Data layer for the CPA review prototype, version 3 (round 3, D02). Reads the made-up sample clients (answer keys) and builds the return,
// the numbers' traces, sources, flags, comments, judgments and history. Values the sample clients do not carry (RV-2's tax lines, last year's
// income figures, the tax effect of a flag) are made up and labelled so on screen.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
export const ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const SC = path.join(ROOT, 'reference', 'sample-clients');

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function money(n) {
  const v = Math.round(n * 100) / 100;
  const s = Math.abs(v).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-$' : '$') + s;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (iso) => MON[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
export const longDate = (iso) => +iso.slice(8, 10) + ' ' + MON[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const r2 = (n) => Math.round(n * 100) / 100;

export const PROTOTYPE_TODAY = '10 Mar 2026';
export const NOW = '10 Mar 2026, 11:40';
export const BLUEPRINT_COMMIT = 'dfdec2fa';
export const COMBINED_RATE = 0.122; // 9% federal and 3.2% Ontario small business rates, made up for the design

// RV-1 order: the brief, then the flags, then the full return in this fixed order. "Reviewed" marks (RV-5) sit on Flags and on each section.
export const SECTIONS = [
  { key: 'flags', slug: 'flags', title: 'Flags', ref: 'Every flag, red first, then dollar effect (EX-4)' },
  { key: 'stmt', slug: 'statements', title: 'Statements and GIFI', ref: 'Balance sheet, income statement, retained earnings; Schedules 100, 125 and 141' },
  { key: 's1', slug: 'schedule-1', title: 'Schedule 1', ref: 'Net income for tax purposes' },
  { key: 'cap', slug: 'capital', title: 'Capital', ref: 'Schedules 8 and 6' },
  { key: 'loss', slug: 'losses', title: 'Losses and reserves', ref: 'Schedules 4 and 13' },
  { key: 'rate', slug: 'rate', title: 'Rate', ref: 'Schedules 7 and 23, the small business deduction, personal services business signs' },
  { key: 'div', slug: 'dividends', title: 'Dividend accounts', ref: 'GRIP, RDTOH, Part IV, capital dividend account; Schedule 3 sits here' },
  { key: 'sh', slug: 'shareholders', title: 'Shareholders and related parties', ref: 'Schedules 50, 9 and 11, slips' },
  { key: 'on', slug: 'ontario', title: 'Ontario', ref: 'Schedule 500 or 5' },
  { key: 'disc', slug: 'disclosures', title: 'Disclosures', ref: 'T1135, T1134, T106' },
  { key: 'pay', slug: 'payment', title: 'Payment and filing', ref: 'Tax payable, instalments, balance or refund' },
];
export const UNPLACED = { key: 'unplaced', slug: 'forms-not-placed', title: 'Forms not yet placed', ref: 'Forms in the Taxprep file that the review does not place in a section yet (RV-9)' };
export const sectionsOf = (R) => (R.unplaced.length ? [...SECTIONS, UNPLACED] : SECTIONS);

export const DOTS = {
  green: 'Traced',
  purple: 'Entry or judgement',
  amber: 'Partly traced',
  grey: 'Not checked: no evidence',
};
const WORST = ['grey', 'amber', 'purple', 'green'];
export const KIND_WORDS = { fixed: 'Fixed', explained: 'Explained, with a source', accepted: 'Accepted risk, for you to judge' };

function loadKey(dir) { return JSON.parse(fs.readFileSync(path.join(SC, dir, 'answer-key.json'), 'utf8')); }

// ---------------------------------------------------------------- dates (FLOW-7, FLOW-12)
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function plusMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = (m - 1) + n; const ny = y + Math.floor(t / 12); const nm = (t % 12) + 1;
  const monthEnd = d === lastDay(y, m);
  const nd = monthEnd ? lastDay(ny, nm) : Math.min(d, lastDay(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}
export const filingDue = (ye) => plusMonths(ye, 6);
export const balanceDue = (ye, ccpc3) => plusMonths(ye, ccpc3 ? 3 : 2);
export const TODAY_ISO = '2026-03-10';
const t12 = (amount, dir) => `Estimated tax effect: about ${money(r2(Math.abs(amount) * COMBINED_RATE))} ${dir} (12.2% combined small business rate, made up for the design).`;

// ---------------------------------------------------------------- client configuration (what the sample data does not say)
const CFG = {
  red: {
    dir: '01-maple-ridge', slug: 'red', short: 'Maple Ridge', tier: 'red', preparer: 'Dana Whitfield (Test)', signed: '5 Mar 2026', dueText: '30 Jun 2026',
    ccpc3: false, firstYear: false,
    tierWhy: 'Four flags are accepted risks for your judgment: personal services business signs, repay then reborrow, no interest on the shareholder loan, home office. Nine flags in all.',
    tierRules: ['Personal services business signs (CK-40): one client is about 90% of sales, $168,000.00 of $186,700.00; no staff; works in the client\'s office.', 'Repay then reborrow: a series of loans and repayments on the shareholder loan.', 'No interest charged on the shareholder loan; home office rent paid personally, not booked.'],
    ly: { 'n-4010': 171200, 'n-6090': 5410.5, 'n-6170': 8120, 'n-6155': 1402.2, 'n-6095': 590.4, 'n-6020': 1710.2 },
    dotOverride: { '6090': 'amber', '6020': 'amber', '6170': 'grey' },
    threshold: { pct: 0.2, min: 500 },
    unconfirmed: ['p-inst', 'p-bal'],
    flags: [
      { id: '01-F01', title: 'Personal services business signs', tier: 'red', kind: 'accepted', effect: 168000, effectText: '$168,000.00 of sales from one client (about 90%)', taxText: 'Not estimated: if the corporation is a personal services business it loses the small business deduction. For you to judge.', where: 'n-4010', answer: 'One client, no staff, works in the client\'s office on its laptop 9 to 5 (client note). Not decided: for you.', cites: 'Client app note, staff list' },
      { id: '01-F03', title: 'Repay then reborrow: series of loans and repayments', tier: 'red', kind: 'accepted', effect: 12000, effectText: '$12,000.00 repaid 18 Dec 2025; about $10,000 to be taken again in January', taxText: 'Not estimated: depends on whether the repayment counts. For you to judge.', where: 'n-1300', answer: 'Repayment may not count as a repayment. Not decided: for you.', cites: 'Bank statement Dec 2025; client note' },
      { id: '01-F07', title: 'Home office: rent paid personally', tier: 'red', kind: 'accepted', effect: 5040, effectText: '$5,040.00 a year (15% of $2,800.00 a month); not booked', taxText: t12(5040, 'less tax if allowed'), where: 's1-home', answer: 'Not booked. Needs a reimbursement arrangement; may be limited if a personal services business. Not decided: for you.', cites: 'Client app: home office share' },
      { id: '01-F04', title: 'No interest charged on shareholder loan', tier: 'red', kind: 'accepted', effect: null, effectText: 'Not stated: the prescribed rate is for you to confirm', taxText: 'Not estimated: the prescribed rate is for you to confirm.', where: 'n-1300', answer: 'No interest charged. Deemed benefit may apply if unpaid after the deadline. Not decided: for you.', cites: 'Bank statements, five advances' },
      { id: '01-F08', title: 'Dividend needs a resolution and a T5', tier: 'amber', kind: 'explained', effect: 20000, effectText: '$20,000.00 non-eligible dividend, 20 Dec 2025', taxText: 'None for the corporation (a dividend is not deductible).', where: 'n-3700', answer: 'Schedule 3 line entered, T5 for the owner prepared, resolution requested from the client.', cites: 'Bank statement Dec 2025, page 4' },
      { id: '01-F02', title: 'Shareholder loan unpaid at year end', tier: 'amber', kind: 'explained', effect: 13211.58, effectText: '$13,211.58 due from the owner; repayment deadline 31 Dec 2026', taxText: 'None now. Becomes income if still unpaid after 31 Dec 2026.', where: 'n-1300', answer: 'Advances $27,000.00, less $12,000.00 repaid, less $1,788.42 of business items. Deadline noted.', cites: 'Five bank statements; entry 01-AJE-01' },
      { id: '01-F09', title: 'HST payable at year end', tier: 'amber', kind: 'explained', effect: 5486.94, effectText: '$5,486.94 payable; Q4 paid 30 Jan 2026', taxText: 'None (a balance sheet amount).', where: 'n-2050', answer: 'Booked as a current liability. Payment date agrees to the 30 Jan 2026 payment.', cites: 'CRA capture, HST balance' },
      { id: '01-F05', title: 'Business items on the owner\'s personal card', tier: 'green', kind: 'fixed', effect: 1788.42, effectText: '$1,788.42 in six items', taxText: t12(1788.42, 'less tax'), where: 'n-6155', answer: 'Entry 01-AJE-01 booked; receipts requested for all six.', cites: 'Personal card statement, six pages' },
      { id: '01-F06', title: 'Meals: 50% limit on deduction and HST claim', tier: 'green', kind: 'fixed', effect: 970.83, effectText: '$970.83 added back on Schedule 1', taxText: t12(970.83, 'more tax'), where: 'n-6020', answer: 'Half added back on Schedule 1; half of the HST claim removed.', cites: 'Business card statement; Schedule 1 add-back' },
    ],
    extraS1: { id: 's1-home', label: 'Home office, not claimed', value: 0, ly: 0, flag: '01-F07', dot: 'purple', built: 'A person\'s decision. Nothing is booked. Taxprep input left empty until you decide.' },
    assumptions: ['HST regular, filed quarterly; Q4 paid 30 Jan 2026 (client app).', 'No interest on the shareholder loan (client decision, flagged).', 'Home office not claimed until you decide (tax choice, no cite yet).', 'Last year\'s income figures are made up for the test.'],
    attest: [
      { key: 'orphans', ok: true, text: 'Zero orphans: every Taxprep number is traced or cited (RT-16).' },
      { key: 'diag', ok: false, text: 'Diagnostics not cleared: 1 of 3 Warnings has no written reason from the preparer. Waiting on Dana Whitfield (Test) (RT-17).' },
      { key: 'signed', ok: true, text: 'Preparer signed: Dana Whitfield (Test), 5 Mar 2026.' },
    ],
    warnings: [
      { text: 'Shareholder loan has no interest charged', reason: null },
      { text: 'Home office rent paid personally is not booked', reason: 'Client decision; flagged as 01-F07 for you.' },
      { text: 'Meals and entertainment: half is not deductible', reason: 'Half added back on Schedule 1.' },
    ],
    comments: [
      { id: 'C-1', line: 'n-6170', type: 'Missing evidence', severity: 'Must fix', when: '10 Mar 2026, 09:51', text: 'No statement pages for the $10,883.60. Please attach receipts for the five largest trips.' },
      { id: 'C-2', line: 'n-6095', type: 'Error', severity: 'Should fix', when: '10 Mar 2026, 09:58', text: 'The $180.00 courier invoice is in Office expenses. It is a software renewal and belongs in Software and computer expenses.' },
      { id: 'C-3', line: 'n-1300', type: 'Question', severity: 'Note', when: '10 Mar 2026, 10:04', text: 'Is the deemed interest benefit worked out anywhere?', flag: '01-F04' },
      { id: 'C-4', line: 'n-6075', type: 'Presentation', severity: 'Note', when: '10 Mar 2026, 10:09', text: 'The line is called Bank charges but it holds card fees too. Rename it.' },
    ],
    rework: {
      from: 'n-6095', to: 'n-6155', amount: 180, who: 'Dana Whitfield (Test)', when: '10 Mar 2026, 14:10', back: '10 Mar 2026, 14:12',
      replies: {
        'C-1': { state: 'Not answered', text: 'The client has not sent the receipts yet. Asked again on 10 Mar.', open: true, done: 'Receipts for the five largest trips were attached on 10 Mar 2026, 15:00.' },
        'C-2': { state: 'Fixed by the preparer', text: 'Moved $180.00 from Office expenses to Software and computer expenses, using the AI draft D-1 (approved 14:08).', open: true },
        'C-3': { state: 'Answered', text: 'Not worked out anywhere yet. The benefit is flagged on 01-F04 for your judgment.', open: true },
        'C-4': { state: 'AI draft waiting for the preparer', text: '', open: true, done: 'Renamed to Bank and card charges by the preparer, using the AI draft D-2 (approved 15:02).' },
      },
      ai: [
        { id: 'D-1', for: 'C-2', title: 'Move $180.00 from Office expenses to Software and computer expenses', steps: ['Debit account 6155 Software and computer expenses $180.00.', 'Credit account 6095 Office expenses $180.00.'], cites: ['Card statement, Feb 2026, page 3 (line "RENEWAL", $180.00)', 'Entry 01-AJE-02 (draft, same amounts)'], state: 'Approved by Dana Whitfield (Test), 10 Mar 2026, 14:08', approved: true },
        { id: 'D-2', for: 'C-4', title: 'Rename the line to "Bank and card charges"', steps: ['Change the label of account 6075 from Bank charges to Bank and card charges.', 'No amount changes.'], cites: ['Card statement, Feb 2026, page 1 (card fee lines)', 'Chart of accounts, account 6075'], state: 'Waiting for Dana Whitfield (Test) to approve. Only the assigned preparer approves a draft (RV-12).', approved: false },
      ],
    },
    history: [
      ['24 Feb 2026, 08:15', 'Return built from the QuickBooks books (test company)', 'System', '@NUMBERS numbers, nine flags fired.'],
      ['2 Mar 2026, 10:05', 'Adjusting entry 01-AJE-01 drafted', 'AI draft', 'Six personal-card items. Citations checked by code. The preparer approved it.'],
      ['5 Mar 2026, 15:40', 'Sent to review', 'Dana Whitfield (Test), preparer', 'Preparer answers added to the nine flags.'],
      ['10 Mar 2026, 09:30', 'Brief opened', 'Zo', 'Tier red.'],
      ['10 Mar 2026, 09:42', 'Statements and GIFI marked Reviewed', 'Zo', ''],
      ['10 Mar 2026, 09:51', 'Comment C-1 added (draft, not sent)', 'Zo', 'Missing evidence on Travel, must fix.'],
    ],
  },
  green: {
    dir: '08-queen-west-design', slug: 'green', short: 'Queen West', tier: 'green', preparer: 'Dana Whitfield (Test)', signed: '4 Mar 2026', dueText: '31 Mar 2026',
    ccpc3: true, firstYear: false,
    tierWhy: 'No flag is an accepted risk for your judgment. Nine flags fired; each is fixed, or explained with a source.',
    tierRules: ['No red rule fired (CK-40).', 'Nine flags fired; each is fixed or explained with a source and none is an accepted risk.'],
    ly: { 'n-4010': 176900, 'n-4020': 161200 },
    dotOverride: {},
    threshold: { pct: 0.5, min: 1000 },
    unconfirmed: [],
    flags: [
      { id: '08-F05', title: 'US clients paid in USD: zero-rated sales and exchange', tier: 'amber', kind: 'explained', effect: 185075, effectText: '$185,075.00 zero-rated sales; exchange loss $818.10', taxText: t12(818.1, 'less tax') + ' Sales are already in income.', where: 'n-4020', answer: 'Zero-rated, posted at monthly test rates. Exchange loss entered (08-AJE-08).', cites: 'USD statements; rate table' },
      { id: '08-F04', title: 'Owner salary and one employee: payroll against T4', tier: 'green', kind: 'explained', effect: 134400, effectText: '$134,400.00 of salaries', taxText: 'None extra (already deducted).', where: 'n-6130', answer: 'Payroll totals agree to the T4 summaries for 2025.', cites: 'Client app payroll; T4 summary' },
      { id: '08-F07', title: 'CCA: laptop class 50 and camera class 8', tier: 'green', kind: 'fixed', effect: 5449, effectText: '$5,449.00 of additions', taxText: 'Taxprep computes the allowance.', where: 'n-1540', answer: 'Both entered on Schedule 8 before recoverable HST.', cites: 'Card statements, Nov 2024 and Mar 2025' },
      { id: '08-F09', title: 'HST annual filer with instalments', tier: 'green', kind: 'explained', effect: 10711.88, effectText: '$10,711.88 payable at year end', taxText: 'None (a balance sheet amount).', where: 'n-2050', answer: 'Instalments agree to the CRA capture.', cites: 'CRA capture, HST balance' },
      { id: '08-F01', title: 'Bad debt: invoice of $4,520.00 written off', tier: 'amber', kind: 'fixed', effect: 4000, effectText: '$4,000.00 written off; $520.00 HST adjustment', taxText: t12(4000, 'less tax'), where: 'n-6030', answer: 'Written off in September; HST adjustment entered (08-AJE-01).', cites: 'Entry 08-AJE-01; client note' },
      { id: '08-F03', title: 'Accrued year-end accounting fee', tier: 'green', kind: 'fixed', effect: 3500, effectText: '$3,500.00 billed after year end', taxText: t12(3500, 'less tax'), where: 'n-2030', answer: 'Accrued from the invoice dated after year end.', cites: 'Entry 08-AJE-05' },
      { id: '08-F06', title: 'Software on the owner\'s personal card', tier: 'green', kind: 'explained', effect: 1700.64, effectText: 'Up to $1,700.64 of software', taxText: t12(1700.64, 'less tax'), where: 'n-6155', answer: 'Listed by the owner in onboarding and reimbursed through the shareholder loan.', cites: 'Client app: personal card items' },
      { id: '08-F02', title: 'Prepaid insurance', tier: 'green', kind: 'fixed', effect: 1350, effectText: '$1,350.00 prepaid at year end', taxText: 'None (timing only).', where: 'n-1200', answer: 'Twelve months from 1 Jul 2025; three months remain.', cites: 'Entry 08-AJE-03' },
      { id: '08-F08', title: 'Meals: 50% limit', tier: 'green', kind: 'fixed', effect: 1130.84, effectText: '$1,130.84 added back', taxText: t12(1130.84, 'more tax'), where: 'n-6020', answer: 'Half added back on Schedule 1.', cites: 'Schedule 1 add-back' },
    ],
    assumptions: ['HST annual filer with instalments (client app).', 'US-dollar sales at the monthly test rate (rate table).', 'Laptop class 50 and camera class 8, cost before HST (Taxprep choice, cite: Schedule 8 note).', 'Last year\'s income figures are made up for the test.'],
    attest: [
      { key: 'orphans', ok: true, text: 'Zero orphans: every Taxprep number is traced or cited (RT-16).' },
      { key: 'diag', ok: true, text: 'Diagnostics cleared: three Warnings, each with the preparer\'s written reason (RT-17).' },
      { key: 'signed', ok: true, text: 'Preparer signed: Dana Whitfield (Test), 4 Mar 2026.' },
    ],
    warnings: [
      { text: 'Foreign exchange loss on US-dollar sales', reason: 'Exchange loss entered at the monthly test rates (08-AJE-08).' },
      { text: 'Bad debt written off', reason: 'Invoice of $4,520.00 written off in September (08-AJE-01).' },
      { text: 'Laptop and camera added to Schedule 8', reason: 'Classes 50 and 8, cost before HST.' },
    ],
    comments: [],
    void: {
      entry: '08-AJE-09', by: 'Dana Whitfield (Test)', when: '10 Mar 2026, 15:05', approved: '10 Mar 2026, 11:34',
      line: 'n-6100', delta: 500, cash: 'n-1010',
      why: 'The accounting fee invoice was corrected in the books from $5,300.00 to $5,800.00 after the owner questioned the bill (entry 08-AJE-09). A change in the books after approval voids the approval (FLOW-5, TB-11).',
    },
    history: [
      ['2 Mar 2026, 09:10', 'Return built from the QuickBooks books (test company)', 'System', '@NUMBERS numbers, nine flags fired.'],
      ['4 Mar 2026, 13:25', 'Sent to review', 'Dana Whitfield (Test), preparer', 'Preparer answers added to the nine flags.'],
      ['10 Mar 2026, 11:00', 'Brief opened', 'Zo', 'Tier green.'],
    ],
  },
  scar: {
    dir: '09-scarborough-robotics', slug: 'scarborough', short: 'Scarborough Robotics', tier: 'red', preparer: 'Dana Whitfield (Test)', signed: '9 Mar 2026', dueText: '30 Jun 2026',
    ccpc3: true, firstYear: true, noPrior: true,
    tierWhy: 'First-year corporation with a short tax year. Five accepted risks need your judgment: shareholder loans, the grant, HST registration part-way, research costs, incorporation fees. Seven flags in all.',
    tierRules: ['First-year corporation (CK-40): incorporated 15 Apr 2025, no prior-year return.', 'Short tax year (CK-40): 261 days, 15 Apr to 31 Dec 2025; the business limit is prorated.', 'Grant, research costs and pre-registration HST need a person\'s judgment.'],
    ly: {},
    dotOverride: { '1390': 'amber', '6200': 'amber' },
    threshold: { pct: 0.5, min: 1000 },
    unconfirmed: [],
    unplaced: [
      { form: 'T661, Scientific Research and Experimental Development (SR&ED) Expenditures Claim', why: 'In the Taxprep file, not named in the section map. Linked to flag 09-F06 (research costs).' },
      { form: 'Schedule 31, Investment tax credit, corporations', why: 'In the Taxprep file, not named in the section map. Linked to flag 09-F06 (research costs).' },
    ],
    flags: [
      { id: '09-F03', title: 'Two shareholders lending money', tier: 'red', kind: 'accepted', effect: 55000, effectText: '$55,000.00 lent: $40,000.00 on 22 Apr and $15,000.00 on 5 May 2025', taxText: 'Not estimated: depends on the terms and whether the loans are current or long term. For you to judge.', where: 'n-2080', answer: 'No interest and no written terms in the file. A person confirms the terms. Not decided: for you.', cites: 'Bank statements Apr and May 2025; client app: shareholder loans' },
      { id: '09-F04', title: 'Grant: treatment needs a person', tier: 'red', kind: 'accepted', effect: 25000, effectText: '$25,000.00 Ontario Innovation Voucher (Test), paid 10 Sep 2025', taxText: 'Not estimated: income, or a reduction of the costs it funded. For you to judge.', where: 'n-1390', answer: 'Held in suspense (1390). It may be income, a reduction of costs, or a reduction of the research expenditure pool. Not decided: for you.', cites: 'Bank statement Sep 2025; client app: grant' },
      { id: '09-F06', title: 'Research costs: eligibility needs a person', tier: 'red', kind: 'accepted', effect: 16400.89, effectText: '$16,400.89 coded to research and development', taxText: 'Not estimated: depends on whether the costs qualify and how the grant and the loss interact. For you to judge.', where: 'n-6200', answer: 'Coded as bought. Nothing is claimed or capitalized. Not decided: for you.', cites: 'Bank statement Aug 2025; client app: research' },
      { id: '09-F05', title: 'HST registration part-way through the year', tier: 'red', kind: 'accepted', effect: 624, effectText: '$624.00 of HST on the 3D printer bought 18 Jun, before registration on 1 Jul', taxText: 'No income tax effect; a possible HST credit of $624.00 if allowed. For you to judge.', where: 'n-1530', answer: 'HST before 1 Jul 2025 is inside the cost. Whether a credit on property on hand is allowed is for you. Not decided: for you.', cites: 'Bank statement Jun 2025; client app: corporation' },
      { id: '09-F01', title: 'Short first taxation year: business limit prorated', tier: 'amber', kind: 'explained', effect: 142465.75, effectText: 'Business limit $357,534.25 (261 of 365 days) instead of $500,000.00', taxText: 'Taxprep applies the prorated limit; the corporation has a loss, so no tax effect this year.', where: 'r-limit', answer: 'Incorporated 15 Apr 2025; the year runs 15 Apr to 31 Dec 2025, 261 days. Taxprep prorates the limit.', cites: 'Client app: corporation' },
      { id: '09-F02', title: 'Loss year: non-capital loss', tier: 'amber', kind: 'explained', effect: 30300.52, effectText: 'Net loss per books before tax $30,300.52', taxText: 'No tax this year; the loss carries forward (Schedule 4).', where: 'n-net-income', answer: 'Loss carried to Schedule 4; nothing brought forward in a first year. The grant and research costs can change it.', cites: 'Schedule 4 note' },
      { id: '09-F07', title: 'Incorporation legal fees: expense or class 14.1', tier: 'amber', kind: 'accepted', effect: 1850, effectText: '$1,850.00 coded to legal fees', taxText: t12(1850, 'less tax if expensed') , where: 'n-6105', answer: 'Coded to legal fees. Deducted, or added to class 14.1, is for the CPA to confirm. Not decided: for you.', cites: 'Bank statement Apr 2025' },
    ],
    assumptions: ['First year: incorporated 15 Apr 2025; tax year 261 days (client app).', 'HST registered from 1 Jul 2025 (client app).', 'Two shareholders lent $55,000.00 with no written terms (client app).', 'The grant stays in suspense until a person decides.'],
    attest: [
      { key: 'orphans', ok: false, text: 'Orphans remain: 1 number is not traced to a Taxprep line. Suspense (account 1390), $25,000.00, the grant (RT-16).' },
      { key: 'diag', ok: true, text: 'Diagnostics cleared: two Warnings, each with the preparer\'s written reason (RT-17).' },
      { key: 'signed', ok: true, text: 'Preparer signed: Dana Whitfield (Test), 9 Mar 2026.' },
    ],
    warnings: [
      { text: 'Suspense account has a balance', reason: 'The grant is held in suspense until a person decides (09-F04).' },
      { text: 'Short tax year', reason: '261 days; Taxprep prorates the business limit (09-F01).' },
    ],
    comments: [
      { id: 'C-1', line: 'n-1390', type: 'Missing evidence', severity: 'Must fix', when: '10 Mar 2026, 10:41', text: 'Where is the grant letter for the $25,000.00? I need the approval terms before I decide.' },
      { id: 'C-2', line: 'n-6200', type: 'Question', severity: 'Should fix', when: '10 Mar 2026, 10:52', text: 'Which of these costs are contract engineering, and which are components?' },
    ],
    history: [
      ['8 Mar 2026, 16:20', 'Return built from the QuickBooks books (test company)', 'System', '@NUMBERS numbers, seven flags fired. First-year corporation, no prior year.'],
      ['9 Mar 2026, 10:00', 'Sent to review', 'Dana Whitfield (Test), preparer', 'Preparer answers added to the seven flags.'],
      ['10 Mar 2026, 10:15', 'Brief opened', 'Zo', 'Tier red.'],
      ['10 Mar 2026, 10:30', 'Statements and GIFI marked Reviewed', 'Zo', ''],
    ],
  },
  blue: {
    dir: '03-bluewater-renovations', slug: 'blue', short: 'Bluewater', tier: 'red', preparer: 'Dana Whitfield (Test)', signed: '2 Mar 2026', dueText: '31 Dec 2025',
    ccpc3: true, firstYear: false,
    tierWhy: 'Two flags are accepted risks for your judgment: the owner bonus paid after day 179 and the subcontractor payments. Six flags in all. The filing due date has passed.',
    tierRules: ['Owner bonus accrued at year end and paid on day 181 (CK-40): the 179-day rule needs payment by 26 Dec 2025.', 'Subcontractor payments are about a third of costs: slips and status checks need a person.', 'The filing due date, 31 Dec 2025, has passed (FLOW-12).'],
    ly: { 'n-4010': 802500, 'n-5040': 201300, 'n-6132': 0, 'n-2035': 0, 'n-6045': 6580.4 },
    dotOverride: { '5040': 'amber' },
    threshold: { pct: 0.2, min: 1000 },
    unconfirmed: ['p-bal'],
    flags: [
      { id: '03-F01', title: 'Owner bonus paid after day 179', tier: 'red', kind: 'accepted', effect: 25000, effectText: '$25,000.00 declared at 30 Jun 2025 and paid 28 Dec 2025 (day 181; the rule needs day 179, 26 Dec 2025)', taxText: t12(25000, 'more tax in this year if added back'), where: 'n-6132', answer: 'Added back on Schedule 1 ($25,000.00) and deductible in the year it was paid; it is on the owner\'s 2025 T4. Whether to keep the add-back is for you.', cites: 'Entry 03-AJE-01; owner bonus note' },
      { id: '03-F05', title: 'Subcontractor payments: slips and status checks', tier: 'red', kind: 'accepted', effect: 222655.08, effectText: '$222,655.08 paid to subcontractors (about a third of costs)', taxText: 'No income tax effect; a penalty risk if T4A or T5018 slips are missing. For you to judge.', where: 'n-5040', answer: 'Not decided: which payees are individuals (T4A), whether T5018 statements are needed, and whether HST numbers and WSIB clearances are held. Not decided: for you.', cites: 'Subcontractor list; client app: subcontractors' },
      { id: '03-F02', title: 'Customer deposit for a job after year end', tier: 'amber', kind: 'fixed', effect: 15000, effectText: '$15,000.00 received 10 Jun 2025: $13,274.34 deferred and $1,725.66 of HST', taxText: t12(13274.34, 'less tax this year'), where: 'n-4010', answer: 'Deferred income of $13,274.34 and HST of $1,725.66 entered; the job starts in August.', cites: 'Bank statement Jun 2025' },
      { id: '03-F03', title: 'Payroll against T4 summaries across two calendar years', tier: 'amber', kind: 'explained', effect: 183519.5, effectText: '$183,519.50 of wages and salaries over calendar 2024 and 2025', taxText: 'None extra (already deducted).', where: 'n-5030', answer: 'Payroll by month agrees to both T4 summaries; the June 2025 deductions owing at year end are booked.', cites: 'Client app payroll; T4 summaries' },
      { id: '03-F04', title: 'CCA additions: truck class 10 and table saw class 8', tier: 'green', kind: 'fixed', effect: 60300, effectText: '$60,300.00 of additions, before HST', taxText: 'Taxprep computes the allowance.', where: 'n-1520', answer: 'Both entered on Schedule 8 before recoverable HST.', cites: 'Bank statement Sep 2024; bank statement Feb 2025' },
      { id: '03-F06', title: 'WSIB premium for the last quarter not accrued', tier: 'green', kind: 'explained', effect: 1783.55, effectText: 'About $1,783.55 for Apr to Jun 2025, paid after year end', taxText: t12(1783.55, 'less tax if accrued'), where: 'n-6045', answer: 'Four quarterly premiums were paid in the year; the last quarter is not accrued. It is small and left for you.', cites: 'Bank statements, quarterly premiums' },
    ],
    assumptions: ['HST regular, filed quarterly (client app).', 'Owner bonus of $25,000.00 added back until you decide (flag 03-F01).', 'Subcontractors are about a third of costs; slips are not decided (flag 03-F05).', 'Last year\'s income figures are made up for the test.'],
    attest: [
      { key: 'orphans', ok: true, text: 'Zero orphans: every Taxprep number is traced or cited (RT-16).' },
      { key: 'diag', ok: true, text: 'Diagnostics cleared: three Warnings, each with the preparer\'s written reason (RT-17).' },
      { key: 'signed', ok: true, text: 'Preparer signed: Dana Whitfield (Test), 2 Mar 2026.' },
    ],
    warnings: [
      { text: 'Owner bonus accrued and paid after day 179', reason: 'Added back on Schedule 1 (03-F01).' },
      { text: 'Subcontractor payments are a large share of costs', reason: 'Flagged as 03-F05 for you.' },
      { text: 'Customer deposit received before the job starts', reason: 'Deferred income entered (03-F02).' },
    ],
    comments: [],
    history: [
      ['26 Feb 2026, 09:05', 'Return built from the QuickBooks books (test company)', 'System', '@NUMBERS numbers, six flags fired.'],
      ['2 Mar 2026, 09:15', 'Sent to review', 'Dana Whitfield (Test), preparer', 'Preparer answers added to the six flags.'],
      ['10 Mar 2026, 10:50', 'Brief opened', 'Zo', 'Tier red. Filing due date passed.'],
    ],
  },
};

const INST =(layout) => layout.replace(/^[A-C]: /, '');

// The preparer's answer in a few words, for the brief's pinned flags (the full answer is in the Flags section), and the tax effect in a few words.
const SHORT = {
  '01-F01': 'One client, no staff, works in the client\'s office', '01-F03': 'Repayment may not count as a repayment', '01-F07': 'Not booked; needs a reimbursement arrangement', '01-F04': 'No interest charged on the loan',
  '01-F08': 'Schedule 3 entered, T5 prepared, resolution requested', '01-F02': 'Advances less repayment less business items', '01-F09': 'Booked as a liability, agrees to the payment', '01-F05': 'Entry 01-AJE-01 booked, receipts requested', '01-F06': 'Half added back, half of the HST claim removed',
  '08-F05': 'Zero-rated, monthly test rates, exchange loss entered', '08-F04': 'Payroll agrees to the T4 summaries', '08-F07': 'Both assets on Schedule 8, cost before HST', '08-F09': 'Instalments agree to the CRA capture', '08-F01': 'Written off in September, HST adjusted', '08-F03': 'Accrued from an invoice dated after year end', '08-F06': 'Listed by the owner, reimbursed through the loan', '08-F02': 'Twelve months from 1 Jul 2025, three remain', '08-F08': 'Half added back on Schedule 1',
  '03-F01': 'Added back on Schedule 1; keeping it is yours to decide', '03-F05': 'Payees, slips and status checks not decided', '03-F02': 'Deferred income and HST entered', '03-F03': 'Payroll agrees to both T4 summaries', '03-F04': 'Both assets on Schedule 8, cost before HST', '03-F06': 'Last quarter not accrued; small, left for you',
  '09-F03': 'No written terms in the file', '09-F04': 'Held in suspense until you decide', '09-F06': 'Coded as bought, nothing claimed', '09-F05': 'HST before registration is inside the cost', '09-F01': 'Taxprep applies the prorated limit', '09-F02': 'Loss carried to Schedule 4', '09-F07': 'Coded to legal fees; class 14.1 is yours to confirm',
};
const NOEST = { '01-F01': 'Not estimated', '01-F03': 'Not estimated', '01-F04': 'Not estimated', '01-F08': 'None', '01-F02': 'None now', '01-F09': 'None', '08-F04': 'None', '08-F07': 'Taxprep computes it', '08-F09': 'None', '08-F02': 'None (timing only)', '03-F05': 'Not estimated (penalty risk)', '03-F03': 'None', '03-F04': 'Taxprep computes it', '09-F03': 'Not estimated', '09-F04': 'Not estimated', '09-F06': 'Not estimated', '09-F05': 'Possible HST credit of $624.00', '09-F01': 'None (loss year)', '09-F02': 'None (loss year)' };
const taxShortOf = (id, taxText) => { const m = taxText.match(/^Estimated tax effect: about (\$[\d,.]+) ([^(]*?)\s*\(/); return m ? `About ${m[1]} ${m[2].trim()}` : (NOEST[id] || 'Not estimated'); };
export const KIND_TAG = { fixed: ['Fixed', 'green'], explained: ['Explained', 'blue'], accepted: ['Accepted risk, for you to judge', 'purple'] };

// ---------------------------------------------------------------- build one return
export function buildReturn(which) {
  const cfg = CFG[which];
  const key = loadKey(cfg.dir);
  const adj = key.trialBalance.adjusted.rows;
  const opn = key.trialBalance.opening.rows;
  const noPrior = !!cfg.noPrior;
  const net = (r, creditPositive) => creditPositive ? r2((r.credit || 0) - (r.debit || 0)) : r2((r.debit || 0) - (r.credit || 0));
  const opening = (acct, creditPositive) => { const r = opn.find((x) => x.account === acct); return r ? net(r, creditPositive) : 0; };
  const txs = key.transactions;
  const acctInfo = Object.fromEntries(key.accounts.map((a) => [a.key, a]));

  const lines = [];
  const byId = {};
  const add = (l) => { l.srcs = l.srcs || []; l.flagIds = []; if (noPrior) l.ly = null; lines.push(l); byId[l.id] = l; return l; };

  const dotFor = (acct, srcs, fallback) => {
    if (cfg.dotOverride[acct]) return cfg.dotOverride[acct];
    if (!srcs.length) return 'grey';
    if (srcs.some((s) => s.kind === 'entry')) return 'purple';
    return fallback || 'green';
  };

  function sourcesFor(acct, label, cy) {
    const out = [];
    const hits = [];
    for (const t of txs) {
      const pl = (t.post || []).find((p) => p.a === acct);
      if (!pl) continue;
      hits.push({ t, amt: (pl.dr || 0) + (pl.cr || 0) });
    }
    hits.sort((a, b) => b.amt - a.amt);
    const total = hits.length;
    for (const h of hits.slice(0, 3)) out.push(statementSource(h.t, h.amt, acct, label));
    for (const e of key.adjustingEntries) {
      if (e.lines.some((l) => l.account === acct)) out.push(entrySource(e, acct));
    }
    const ac = key.accounts.find((a) => a.glAccount === acct);
    if (ac && key.statementBalances[ac.key]) {
      const sb = key.statementBalances[ac.key].slice(-1)[0];
      out.unshift({ kind: 'closing', title: 'Statement closing balance', month: sb.month, inst: INST(ac.layout), closing: sb.closing, opening: sb.opening, role: ac.role });
    }
    if (acct === '2050') out.push({ kind: 'cra', title: 'CRA capture, HST balance', fields: [['Account', 'GST/HST (made-up business number)'], ['Balance at year end', money(key.hst.balanceAtYearEndPayable)], ['Method', key.hst.method], ['Captured', '24 Feb 2026 (test capture)']] });
    if (acct === '4310') out.push({ kind: 'sheet', title: 'Exchange rates (client app, test)', sheet: 'Rates', header: ['Item', 'USD to CAD'], rows: [['Prior year end', '1.35'], ['Year end', '1.39']], hitRow: 3, hitCol: 'B', note: 'Test rates, made up.' });
    if (acct === '3600' || acct === '3010') {
      if (noPrior) out.push({ kind: 'answer', title: 'Share register (client app)', fields: [['Line', label], ['Amount', money(cy)], ['Source', 'Client app: share register. First year: there is no prior-year return.']] });
      else out.push({ kind: 'prior', title: 'Prior-year return', fields: [['Line', label], ['Closing last year', money(cy)], ['Source', 'Prior-year return filed (test); share register from the client app']] });
    }
    out.total = total;
    return out;
  }

  function statementSource(t, amt, acct, label) {
    const ac = acctInfo[t.acct];
    const near = txs.filter((x) => x.acct === t.acct && Math.abs(x.line - t.line) <= 10).sort((a, b) => a.line - b.line);
    return {
      kind: 'statement', title: ac && ac.role === 'card' ? 'Card statement' : 'Bank statement', inst: INST(ac ? ac.layout : 'Bank (Test)'),
      month: monthYear(t.date), page: Math.max(1, Math.ceil(t.line / 40)), rows: near, hit: t.id, hitAmt: Math.abs(t.amount), coded: amt, acct, label,
      note: t.post.map((p) => (p.dr ? 'dr ' : 'cr ') + p.a + ' ' + money(p.dr || p.cr)).join(', '),
    };
  }
  function entrySource(e, acct) {
    const l = e.lines.find((x) => x.account === acct);
    return { kind: 'entry', title: 'Adjusting entry ' + e.id, id: e.id, date: longDate(e.date), reason: e.reason, lines: e.lines, hitAcct: acct, hit: l };
  }

  // -------- balance sheet
  const bsRows = adj.filter((r) => +r.account < 4000);
  const grp = (from, to) => bsRows.filter((r) => +r.account >= from && +r.account < to);
  const mkLine = (r, section, group, creditPositive) => {
    const cy = net(r, creditPositive);
    const id = 'n-' + r.account;
    const ly = noPrior ? null : (cfg.ly[id] !== undefined ? cfg.ly[id] : (section === 'bs' ? opening(r.account, creditPositive) : r2(cy * (0.78 + (hash(id) % 40) / 100))));
    let srcs = sourcesFor(r.account, r.name, cy);
    const noEvidence = cfg.dotOverride[r.account] === 'grey';
    const total0 = srcs.total || 0;
    if (noEvidence) srcs = [];
    const total = srcs.total || 0;
    return add({
      id, section, group, acct: r.account, label: r.name, gifi: r.gifi, cy, ly, srcs, total, creditPositive,
      dot: dotFor(r.account, srcs),
      built: `Adjusted trial balance, account ${r.account} ${r.name} (${r.gifi ? 'GIFI ' + r.gifi : 'no GIFI code yet'}). ${noEvidence ? total0 + ' coded transactions, but no statement page, receipt or entry was found for them.' : total ? total + ' coded transaction' + (total === 1 ? '' : 's') + (key.adjustingEntries.some((e) => e.lines.some((l) => l.account === r.account)) ? ' and an adjusting entry' : '') + '.' : (srcs.length ? 'Opening balance and entries.' : 'Nothing coded to this account in the transactions.')}`,
    });
  };
  const sub = (id, section, label, parts, built, extra = {}) => {
    const cy = r2(parts.reduce((s, p) => s + p.sign * byId[p.id].cy, 0));
    const ly = noPrior ? null : r2(parts.reduce((s, p) => s + p.sign * byId[p.id].ly, 0));
    const worst = WORST.find((d) => parts.some((p) => byId[p.id].dot === d)) || 'green';
    return add({ id, section, group: 'Total', label, cy, ly, kind: 'sub', dot: worst, built, parts, srcs: [{ kind: 'computed', title: 'Computed from the lines above', parts: parts.map((p) => ({ label: byId[p.id].label, value: byId[p.id].cy, sign: p.sign })) }], ...extra });
  };

  const assetRows = grp(1000, 2000), liabRows = grp(2000, 3000), eqRows = grp(3000, 4000);
  const assetIds = assetRows.map((r) => mkLine(r, 'bs', 'Assets', false).id);
  const aTot = sub('n-total-assets', 'bs', 'Total assets', assetIds.map((id) => ({ id, sign: 1 })), 'Sum of the asset lines (accumulated amortization is a negative line).');
  const liabIds = liabRows.map((r) => mkLine(r, 'bs', 'Liabilities', true).id);
  const lTot = sub('n-total-liab', 'bs', 'Total liabilities', liabIds.map((id) => ({ id, sign: 1 })), 'Sum of the liability lines.');
  const eqIds = eqRows.map((r) => { const l = mkLine(r, 'bs', 'Equity', true); if (r.account === '3700') { l.cy = -r2(r.debit); l.ly = noPrior ? null : 0; l.built = 'Dividends declared in the year, shown as a deduction from equity. ' + (key.t2Inputs.schedule3.dividendsPaid.length ? 'Agrees to Schedule 3.' : ''); l.creditPositive = true; } return l.id; });

  // -------- income statement
  const isRows = adj.filter((r) => +r.account >= 4000);
  const revRows = isRows.filter((r) => +r.account < 5000);
  const expRows = isRows.filter((r) => +r.account >= 5000);
  const revIds = revRows.map((r) => mkLine(r, 'is', 'Revenue', true).id);
  const rTot = sub('n-total-rev', 'is', 'Total revenue', revIds.map((id) => ({ id, sign: 1 })), 'Sum of the revenue lines.');
  const expIds = expRows.map((r) => mkLine(r, 'is', 'Expenses', false).id);
  const eTot = sub('n-total-exp', 'is', 'Total expenses', expIds.map((id) => ({ id, sign: 1 })), 'Sum of the expense lines.');
  const ni = sub('n-net-income', 'is', 'Net income before tax', [{ id: rTot.id, sign: 1 }, { id: eTot.id, sign: -1 }], 'Total revenue less total expenses. Income tax is not booked: Taxprep computes it.' + (ni0(rTot, eTot) < 0 ? ' A loss year.' : ''));
  function ni0(a, b) { return a.cy - b.cy; }

  const ce = { id: 'n-curr-earn', section: 'bs', group: 'Equity', acct: '', label: 'Current year earnings', cy: ni.cy, ly: noPrior ? null : 0, dot: ni.dot, derived: true, srcs: [{ kind: 'computed', title: 'Net income before tax from the Income statement', parts: [{ label: 'Net income before tax', value: ni.cy, sign: 1 }] }], built: 'Net income before tax from the income statement. ' + (noPrior ? 'First year: nothing was in opening retained earnings.' : 'Last year it was already in opening retained earnings.'), flagIds: [], kind: 'line', follow: 'n-net-income' };
  lines.splice(lines.indexOf(byId[eqIds[eqIds.length - 1]]) + 1, 0, ce); byId[ce.id] = ce;
  const eTotal = sub('n-total-eq', 'bs', 'Total equity', [...eqIds, ce.id].map((id) => ({ id, sign: 1 })), 'Shares, opening retained earnings, less dividends, plus current year earnings.');
  const lePlus = sub('n-total-le', 'bs', 'Total liabilities and equity', [{ id: lTot.id, sign: 1 }, { id: eTotal.id, sign: 1 }], 'Must equal total assets.');
  if (Math.abs(lePlus.cy - aTot.cy) > 0.005) throw new Error('balance sheet does not balance for ' + which + ': ' + aTot.cy + ' vs ' + lePlus.cy);
  const order = [];
  const place = (ids, tot) => { ids.forEach((id) => order.push(byId[id])); if (tot) order.push(tot); };
  place(assetIds, aTot); place(liabIds, lTot); place([...eqIds, ce.id], eTotal); order.push(lePlus);
  place(revIds, rTot); place(expIds, eTot); order.push(ni);

  // -------- schedule 1
  const t2 = key.t2Inputs;
  const s1Ids = [];
  const nic = add({ id: 's1-ni', section: 's1', group: 'Schedule 1', label: 'Net income per books before tax', cy: ni.cy, ly: ni.ly, dot: ni.dot, derived: true, follow: 'n-net-income', built: 'From the Income statement.', srcs: [{ kind: 'computed', title: 'Net income before tax from the Income statement', parts: [{ label: 'Net income before tax', value: ni.cy, sign: 1 }] }] });
  s1Ids.push(nic.id);
  t2.schedule1.addBacks.forEach((a, i) => {
    const srcRow = a.source.account ? adj.find((r) => r.account === a.source.account) : null;
    const ent = (a.source.adjustingEntries || []).join(', ');
    const srcCard = srcRow
      ? { kind: 'prior', title: 'Calculation from account ' + a.source.account, fields: [['Rule', a.reason], ['Source account', a.source.account + ' ' + srcRow.name], ['Book amount', money(net(srcRow, false))], ['Result', money(a.amount)]] }
      : { kind: 'prior', title: 'Calculation' + (ent ? ' from entry ' + ent : ''), fields: [['Rule', a.reason], ['Entry', ent || 'none'], ['Result', money(a.amount)]] };
    const l = add({ id: 's1-add' + i, section: 's1', group: 'Add', label: a.item.charAt(0).toUpperCase() + a.item.slice(1), cy: a.amount, ly: r2(a.amount * (0.8 + (hash(a.item) % 30) / 100)), dot: 'purple', built: a.reason, srcs: [srcCard] });
    s1Ids.push(l.id);
  });
  if (cfg.extraS1) { const x = cfg.extraS1; const l = add({ id: x.id, section: 's1', group: 'Add', label: x.label, cy: x.value, ly: x.ly, dot: x.dot, built: x.built, srcs: [{ kind: 'answer', title: 'Client answer', fields: [['Question', 'Share of the home used for work'], ['Answer', '15% of $2,800.00 monthly rent, paid personally'], ['From', 'Client app, onboarding']] }] }); s1Ids.push(l.id); }
  const s1Tot = add({ id: 's1-total', section: 's1', group: 'Total', kind: 'sub', label: 'Net income for tax purposes before other adjustments', cy: r2(s1Ids.reduce((s, id) => s + byId[id].cy, 0)), ly: noPrior ? null : r2(s1Ids.reduce((s, id) => s + byId[id].ly, 0)), dot: 'purple', built: 'Net income per books plus add-backs. Taxprep computes taxable income and tax.', parts: s1Ids.map((id) => ({ id, sign: 1 })), srcs: [{ kind: 'computed', title: 'Computed from the lines above', parts: s1Ids.map((id) => ({ label: byId[id].label, value: byId[id].cy, sign: 1 })) }] });
  s1Ids.push(s1Tot.id);

  // -------- other schedules
  const oIds = [];
  t2.schedule3.dividendsPaid.forEach((d, i) => {
    const l = add({ id: 'o-div' + i, section: 'div', group: 'Schedule 3', label: `Dividend paid ${longDate(d.date)} (${d.designation})`, cy: d.amount, ly: 0, dot: 'green', built: 'Schedule 3, dividends paid.', srcs: [statementSource(txs.find((x) => x.id === d.transaction), d.amount, '3700', 'Dividends declared')] });
    oIds.push(l.id);
  });
  (t2.schedule8.classes || []).forEach((c, i) => c.additions.forEach((ad, j) => {
    const t = ad.transactions && txs.find((x) => x.id === ad.transactions[0]);
    const l = add({ id: `o-cca${i}${j}`, section: 'cap', group: 'Schedule 8', label: `Class ${c.class} addition: ${ad.description}`, cy: ad.capitalCost, ly: 0, dot: t ? 'green' : 'purple', built: 'Schedule 8 capital cost before recoverable HST. ' + (ad.note || ''), srcs: t ? [statementSource(t, ad.capitalCost, '', ad.description)] : [] });
    oIds.push(l.id);
  }));
  t2.schedule50.forEach((s, i) => {
    const l = add({ id: 'o-sh' + i, section: 'sh', group: 'Schedule 50', label: `Shareholder ${s.name}: percent of common shares`, cy: s.percentCommonShares, ly: s.percentCommonShares, pct: true, dot: 'purple', built: 'Schedule 50. SIN on file; no digits are shown on a review page (SEC-4).', srcs: [{ kind: 'answer', title: 'Client answer', fields: [['Question', 'Who owns the shares'], ['Answer', s.name + ', ' + s.percentCommonShares + '% common'], ['SIN', 'SIN on file'], ['From', 'Client app, onboarding']] }] });
    oIds.push(l.id);
  });
  if (t2.shareholderLoan) {
    const sl = t2.shareholderLoan;
    [['Advances in the year', sl.advances], ['Repayments in the year', sl.repaymentsInYear], ['Business items reimbursed', sl.businessItemsReimbursed], ['Due from shareholder at year end', sl.closingDueFromShareholder]].forEach(([lab, v], i) => {
      const l = add({ id: 'o-loan' + i, section: 'sh', group: 'Shareholder loan', label: lab, cy: v, ly: i === 3 ? sl.openingBalance : 0, dot: i === 3 ? 'amber' : 'green', built: 'Shareholder loan schedule. Repayment deadline ' + longDate(sl.repaymentDeadline) + '.', srcs: i === 3 ? byId['n-1300'].srcs : byId['n-1300'].srcs.slice(0, 2) });
      oIds.push(l.id);
    });
  }

  // -------- RV-2's tax lines: the sample clients do not carry them yet, so these are made-up values, labelled
  const madeUp = (id, section, group, label, cy, ly, built, extra = {}) => add({ id, section, group, label, cy: r2(cy), ly: noPrior ? null : r2(ly), dot: 'purple', madeUp: true, built: built + ' Made-up value for the design: the sample clients do not carry this line yet.', srcs: [{ kind: 'taxprep', title: 'Taxprep result for ' + label.toLowerCase(), fields: [['Line', label], ['Made-up rule', built], ['Result', money(cy)], ['Status', 'Made up for the design']] }], ...extra });
  const rateIds = [], payIds = [], lossIds = [];
  const tx = s1Tot;
  const pos = (v) => Math.max(0, v);
  const loss = tx.cy < 0;
  rateIds.push(madeUp('r-taxable', 'rate', 'Taxable income', 'Taxable income', tx.cy, tx.ly, loss ? 'Net income for tax purposes from Schedule 1 (a loss), before capital cost allowance.' : 'Net income for tax purposes from Schedule 1, no other adjustments.').id);
  if (cfg.firstYear) {
    const ty = t2.taxationYear;
    const l = add({ id: 'r-limit', section: 'rate', group: 'Business limit', label: `Business limit, prorated for ${ty.days} of 365 days`, cy: ty.businessLimitProrated, ly: null, dot: 'purple', built: `Short first year, ${longDate(ty.start)} to ${longDate(ty.end)}: $500,000.00 x ${ty.days}/365. Taxprep computes it; the value is from the sample client.`, srcs: [{ kind: 'answer', title: 'Client answer', fields: [['Question', 'Date of incorporation'], ['Answer', longDate(ty.start)], ['Tax year', ty.days + ' days, ' + longDate(ty.start) + ' to ' + longDate(ty.end)], ['From', 'Client app, onboarding']] }] });
    rateIds.push(l.id);
  }
  rateIds.push(madeUp('r-sbd', 'rate', 'Small business deduction', 'Small business deduction', pos(tx.cy) * 0.19, pos(tx.ly || 0) * 0.19, loss ? '19% of taxable income, which is nil in a loss year.' : '19% of taxable income, within the business limit of $500,000.00.').id);
  const fed = pos(tx.cy) * 0.09, fedLy = pos(tx.ly || 0) * 0.09, onT = pos(tx.cy) * 0.032, onLy = pos(tx.ly || 0) * 0.032;
  const instal = cfg.firstYear ? 0 : Math.round((fed + onT) * 0.6 / 100) * 100, instalLy = cfg.firstYear ? 0 : Math.round((fedLy + onLy) * 0.9 / 100) * 100;
  payIds.push(madeUp('p-fed', 'pay', 'Tax payable', 'Federal tax', fed, fedLy, loss ? '9% of taxable income, which is nil in a loss year.' : '9% of taxable income (federal rate after the small business deduction).').id);
  payIds.push(madeUp('p-on', 'pay', 'Tax payable', 'Ontario tax', onT, onLy, loss ? '3.2% of taxable income, which is nil in a loss year.' : '3.2% of taxable income (Ontario small business rate).').id);
  payIds.push(madeUp('p-inst', 'pay', 'Paid', 'Instalments paid', instal, instalLy, cfg.firstYear ? 'No instalments were due in a first year.' : 'Instalments paid in the year, from the CRA account capture.').id);
  payIds.push(madeUp('p-bal', 'pay', 'Result', 'Balance owing', fed + onT - instal, fedLy + onLy - instalLy, 'Federal tax plus Ontario tax less instalments. A refund would show as a negative number.', { kind: 'sub' }).id);
  if (loss) {
    lossIds.push(madeUp('l-loss', 'loss', 'Schedule 4', 'Non-capital loss for the year, before capital cost allowance', -tx.cy, 0, 'Taxable loss from Schedule 1 before capital cost allowance; Taxprep computes the final loss.').id);
    const l0 = add({ id: 'l-bf', section: 'loss', group: 'Schedule 4', label: 'Losses brought forward', cy: 0, ly: null, dot: 'green', built: 'First year: nothing is brought forward (Schedule 4 note in the sample client).', srcs: [{ kind: 'answer', title: 'Client answer', fields: [['Question', 'Losses from earlier years'], ['Answer', 'None: first year of the corporation'], ['From', 'Client app, onboarding']] }] });
    lossIds.push(l0.id);
  }
  for (const id of [...rateIds, ...payIds]) if ((cfg.unconfirmed || []).includes(id)) byId[id].unconfirmed = true;

  // flags attach to lines
  const flags = cfg.flags.map((f) => ({ ...f, answered: f.kind !== 'accepted', short: SHORT[f.id], taxShort: taxShortOf(f.id, f.taxText), num: f.id.slice(-3) }));
  for (const f of flags) { const l = byId[f.where]; if (l) l.flagIds.push(f.id); }
  for (const f of flags) {
    const wl = byId[f.where];
    const ev = [];
    for (const part of f.cites.split(';').map((x) => x.trim())) {
      const em = part.match(/(\d\d-AJE-\d\d)/);
      const entry = em && key.adjustingEntries.find((e) => e.id === em[1]);
      if (entry) { ev.push(entrySource(entry, wl && wl.acct ? wl.acct : entry.lines[0].account)); continue; }
      if (/CRA capture/i.test(part)) { ev.push({ kind: 'cra', title: 'CRA capture, HST balance', fields: [['Account', 'GST/HST (made-up business number)'], ['Balance at year end', money(key.hst.balanceAtYearEndPayable)], ['Cited on flag', f.id + ' ' + f.title]] }); continue; }
      if (/statement/i.test(part) && wl && wl.srcs.some((s) => s.kind === 'statement')) { ev.push(wl.srcs.find((s) => s.kind === 'statement')); continue; }
      ev.push({ kind: 'answer', title: part, fields: [['Preparer\'s answer', f.answer]] });
    }
    f.evidence = ev;
  }
  const sortedFlags = [...flags].sort((a, b) => (a.tier === 'red' ? 0 : 1) - (b.tier === 'red' ? 0 : 1) || (b.effect ?? -1) - (a.effect ?? -1));

  // changed (RV-8): the fact of a large change is kept on every line; the highlight follows the tier and never hides the rest
  for (const l of lines) {
    if (l.ly === null || l.ly === undefined) { l.changed = false; continue; }
    const d = l.cy - l.ly;
    l.changed = l.kind !== 'sub' && !l.derived && !l.pct && Math.abs(d) >= cfg.threshold.min && (l.ly === 0 || Math.abs(d) / Math.abs(l.ly) >= cfg.threshold.pct);
  }
  const top5 = new Set([...lines].filter((l) => l.kind !== 'sub' && !l.derived && !l.madeUp && !l.pct).sort((a, b) => Math.abs(b.cy) - Math.abs(a.cy)).slice(0, 5).map((l) => l.id));
  for (const l of lines) {
    const flagged = l.flagIds.length > 0;
    l.top5 = top5.has(l.id);
    l.hl =cfg.tier === 'green' ? flagged : cfg.tier === 'amber' ? (flagged || l.dot === 'amber' || top5.has(l.id)) : (flagged || l.changed || l.dot === 'amber' || l.dot === 'grey');
  }
  const dupOf = { 'o-loan3': 'n-1300', 'o-div0': 'n-3700' };
  for (const [d, of] of Object.entries(dupOf)) if (byId[d]) byId[d].dupOf = of;

  for (const l of lines) if (l.section === 'bs' || l.section === 'is') { l.part = l.section; l.section = 'stmt'; }
  const pick = (sec) => oIds.filter((i) => byId[i].section === sec).map((i) => byId[i]);
  const ordered = { stmt: order, s1: s1Ids.map((i) => byId[i]), cap: pick('cap'), loss: lossIds.map((i) => byId[i]), rate: rateIds.map((i) => byId[i]), div: pick('div'), sh: pick('sh'), on: [], disc: [], pay: payIds.map((i) => byId[i]) };

  // schedules not drawn as structured views show the printed return's pages (RV-9); made-up pages
  const printed = {
    cap: [{ no: 18, of: 31, title: 'Schedule 8, capital cost allowance', rows: [['Additions in the year', 'Nil'], ['Disposals in the year', 'Nil'], ['Closing undepreciated capital cost', 'Nil']] }, { no: 19, of: 31, title: 'Schedule 6, grants, credits and assistance', rows: [['Government assistance received', 'Nil'], ['Amounts repaid', 'Nil']] }],
    loss: [{ no: 14, of: 31, title: 'Schedule 4, corporation loss continuity and application', rows: [['Non-capital losses, opening', 'Nil'], ['Non-capital loss for the year', 'Nil'], ['Losses applied in the year', 'Nil'], ['Non-capital losses, closing', 'Nil']] }, { no: 15, of: 31, title: 'Schedule 13, continuity of reserves', rows: [['Reserves, opening', 'Nil'], ['Reserves, closing', 'Nil']] }],
    on: [{ no: 24, of: 31, title: 'Schedule 500, Ontario corporate tax', rows: [['Taxable income', money(pos(tx.cy))], ['Ontario small business rate', '3.2%'], ['Ontario tax before credits', money(onT)]] }, { no: 25, of: 31, title: 'Ontario credits and surtaxes', rows: [['Ontario credits claimed', 'Nil'], ['Ontario tax payable', money(onT)]] }],
  };
  if (!pick('div').length) printed.div = [{ no: 20, of: 31, title: 'Dividend accounts: GRIP, RDTOH, Part IV tax and capital dividend account', rows: [['General rate income pool, closing', 'Nil'], ['Eligible refundable dividend tax on hand, closing', 'Nil'], ['Part IV tax payable', 'Nil'], ['Capital dividend account, closing', 'Nil']] }];
  if (ordered.cap.length) delete printed.cap;
  if (ordered.loss.length) delete printed.loss;
  // a section with nothing in this return says so and still needs a mark (RV-9, RULE-7)
  const empty = { disc: 'No T1135, T1134 or T106 is needed for this return: no foreign property over $100,000.00, no foreign affiliate and no reportable transaction with a non-resident.' };

  const six = ['n-net-income', 'r-taxable', 'p-fed', 'p-on', 'p-inst', 'p-bal'];
  const ty = t2.taxationYear;

  return { which, cfg, key, lines, byId, ordered, printed, empty, unplaced: cfg.unplaced || [], flags: sortedFlags, six, corp: key.name, ye: longDate(key.fiscalYear.end), yeIso: key.fiscalYear.end, start: longDate(key.fiscalYear.start), noPrior, shortYear: ty && ty.shortYear ? ty : null };
}

// ---------------------------------------------------------------- applying a change after the return was built (rework, void)
// Recomputes every subtotal and made-up tax line after a change to leaf lines, so the ripple is exact.
export function applyChanges(R, deltas) {
  const clone = (l) => ({ ...l });
  const lines = R.lines.map(clone);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  const before = {};
  for (const [id, d] of Object.entries(deltas)) { before[id] = byId[id].cy; byId[id].cy = r2(byId[id].cy + d); }
  const tax = (l) => (l.cy < 0 ? 0 : l.cy);
  for (let pass = 0; pass < 4; pass++) {
    for (const l of lines) {
      if (l.parts) l.cy = r2(l.parts.reduce((s, p) => s + p.sign * byId[p.id].cy, 0));
      else if (l.follow) l.cy = byId[l.follow].cy;
    }
    const taxable = byId['s1-total'].cy;
    byId['r-taxable'].cy = r2(taxable);
    byId['r-sbd'].cy = r2(Math.max(0, taxable) * 0.19);
    byId['p-fed'].cy = r2(Math.max(0, taxable) * 0.09);
    byId['p-on'].cy = r2(Math.max(0, taxable) * 0.032);
    byId['p-bal'].cy = r2(byId['p-fed'].cy + byId['p-on'].cy - byId['p-inst'].cy);
  }
  const changed = lines.filter((l) => !l.pct && r2(l.cy) !== r2(R.byId[l.id].cy)).map((l) => l.id);
  for (const id of changed) { before[id] = R.byId[id].cy; byId[id].reworked = true; }
  const ordered = Object.fromEntries(Object.entries(R.ordered).map(([k, arr]) => [k, arr.map((l) => byId[l.id])]));
  void tax;
  return { before, changed, ret: { ...R, lines, byId, ordered } };
}

// ---------------------------------------------------------------- scenarios (which state of which return)
const T = (m) => ['Zo', '10 Mar 2026, ' + m];
const ALL_MARKS = (base) => Object.fromEntries(SECTIONS.map((s, i) => [s.key, T(String(base + i * 2).padStart(2, '0').replace(/^(\d\d)$/, (x) => x))]));
const readyMarks = (h, m0) => Object.fromEntries(SECTIONS.map((s, i) => { const mm = m0 + i * 2; return [s.key, ['Zo', `10 Mar 2026, ${h + Math.floor(mm / 60)}:${String(mm % 60).padStart(2, '0')}`]]; }));
void ALL_MARKS;

export const SCENARIOS = {
  'red': { slug: 'red', which: 'red', label: 'Maple Ridge, first review (red tier, flagged)', mode: 'cpa', kind: 'progress', cs: 'draft', marks: { stmt: T('09:42') }, judg: {} },
  'red-rework': {
    slug: 'red-rework', which: 'red', label: 'Maple Ridge, back from rework (a mark came off)', mode: 'cpa', kind: 'rework', cs: 'rework',
    marks: { stmt: 'off', s1: T('10:20'), cap: T('10:24'), loss: T('10:26'), rate: T('10:28'), div: T('10:31') },
    judg: {
      '01-F01': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:12', reason: 'One client, but the owner names two more clients starting in April and sets her own hours. I accept that it is not a personal services business, and I will note it in the file.' },
      '01-F03': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:15', reason: 'The December repayment is a real repayment from the bank statement. The January advance is a new loan.' },
      '01-F04': { kind: 'comment', by: 'Zo', when: '10 Mar 2026, 10:04', comment: 'C-3' },
    },
  },
  'red-gate': {
    slug: 'red-gate', which: 'red', label: 'Maple Ridge, every section marked but two accepted risks not judged (Approve is absent)', mode: 'cpa', kind: 'gate', cs: 'resolved',
    marks: { ...readyMarks(10, 22), stmt: T('15:25') },
    judg: {
      '01-F01': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:12', reason: 'One client, but the owner names two more clients starting in April and sets her own hours. I accept that it is not a personal services business, and I will note it in the file.' },
      '01-F03': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:15', reason: 'The December repayment is a real repayment from the bank statement. The January advance is a new loan.' },
    },
  },
  'red-ready': {
    slug: 'red-ready', which: 'red', label: 'Maple Ridge, everything done (Approve shows)', mode: 'cpa', kind: 'ready', cs: 'resolved',
    marks: { ...readyMarks(10, 22), stmt: T('15:25') },
    judg: {
      '01-F01': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:12', reason: 'One client, but the owner names two more clients starting in April and sets her own hours. I accept that it is not a personal services business, and I will note it in the file.' },
      '01-F03': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:15', reason: 'The December repayment is a real repayment from the bank statement. The January advance is a new loan.' },
      '01-F04': { kind: 'comment', by: 'Zo', when: '10 Mar 2026, 10:04', comment: 'C-3' },
      '01-F07': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:50', reason: 'Not claimed this year. The reimbursement arrangement is for next year\'s plan; no number changes now.' },
    },
  },
  'red-preparer': { slug: 'red-preparer', which: 'red', label: 'Maple Ridge, as the assigned preparer sees it (read-only)', mode: 'preparer', kind: 'progress', cs: 'none', marks: { stmt: T('09:42') }, judg: {} },
  'green': { slug: 'green', which: 'green', label: 'Queen West, first review (green tier)', mode: 'cpa', kind: 'progress', cs: 'none', marks: { flags: T('11:08'), stmt: T('11:15') }, judg: {} },
  'green-ready': { slug: 'green-ready', which: 'green', label: 'Queen West, every section marked (Approve shows)', mode: 'cpa', kind: 'ready', cs: 'none', marks: readyMarks(11, 8), judg: {} },
  'green-void': { slug: 'green-void', which: 'green', label: 'Queen West, approval void (books changed after approval)', mode: 'void', kind: 'void', cs: 'none', marks: readyMarks(11, 8), judg: {} },
  'bluewater': { slug: 'bluewater', which: 'blue', label: 'Bluewater Renovations, first review (red tier, filing date passed)', mode: 'cpa', kind: 'progress', cs: 'none', marks: {}, judg: {} },
  'scarborough': {
    slug: 'scarborough', which: 'scar', label: 'Scarborough Robotics, first review (red tier, many accepted risks, first year, loss year)', mode: 'cpa', kind: 'progress', cs: 'draft',
    marks: { stmt: T('10:30'), s1: T('10:36') },
    judg: { '09-F03': { kind: 'accept', by: 'Zo', when: '10 Mar 2026, 10:25', reason: 'Both lenders are the shareholders; I will ask for a one-line loan agreement and treat the loans as long term for now.' } },
  },
};

const NOWS = { 'red-rework': '10 Mar 2026, 14:30', 'red-gate': '10 Mar 2026, 15:30', 'red-ready': '10 Mar 2026, 15:40', 'green-void': '10 Mar 2026, 15:20' };
for (const s of Object.values(SCENARIOS)) s.now = NOWS[s.slug] || NOW;

const cache = {};
export function getReturn(which) { return cache[which] || (cache[which] = buildReturn(which)); }

// the view of a scenario: the return as it stands (after a rework change or a void change) and what moved
export function viewOf(scn) {
  const R0 = getReturn(scn.which);
  // later in the same round (gate, ready) the preparer's change from the rework is already in the numbers
  if (scn.kind === 'rework' || ((scn.kind === 'gate' || scn.kind === 'ready') && scn.which === 'red')) {
    const rw = R0.cfg.rework;
    const v = applyChanges(R0, { [rw.from]: -rw.amount, [rw.to]: rw.amount });
    return { R0, ...v, rw, mode: 'rework' };
  }
  if (scn.kind === 'void') {
    const vd = R0.cfg.void;
    const v = applyChanges(R0, { [vd.line]: vd.delta, [vd.cash]: -vd.delta });
    return { R0, ...v, vd, mode: 'void' };
  }
  return { R0, before: {}, changed: [], ret: R0, mode: 'plain' };
}

export function sectionState(scn, key) {
  const m = scn.marks[key];
  return m === 'off' ? { state: 'off' } : m ? { state: 'on', who: m[0], when: m[1] } : { state: 'none' };
}
// sections whose mark is on after a void: the ones holding no changed number keep their mark
export function marksAfter(scn, view) {
  if (scn.kind !== 'void') return scn.marks;
  const out = { ...scn.marks };
  const secOf = new Set(view.changed.map((id) => view.R0.byId[id].section));
  for (const s of secOf) out[s] = 'off';
  return out;
}
export const risksOf = (R) => R.flags.filter((f) => f.kind === 'accepted');

// the comments of a scenario, with their state words
export function commentsFor(R, scn) {
  const base = R.cfg.comments || [];
  if (scn.cs === 'none') return [];
  const rw = R.cfg.rework;
  return base.map((c) => {
    const o = { ...c, who: 'Zo' };
    if (scn.cs === 'draft') { o.status = 'Draft, not sent'; o.resolved = false; }
    else if (scn.cs === 'rework') {
      const rp = rw.replies[c.id];
      o.status = 'Sent to the preparer, 10 Mar 2026, 10:40. ' + rp.state; o.reply = rp.text; o.resolved = false; o.open = true;
    } else if (scn.cs === 'resolved') {
      o.status = 'Resolved by Zo, 10 Mar 2026, 15:' + (10 + base.indexOf(c) * 3); const rp2 = rw.replies[c.id] || {}; o.reply = rp2.done || rp2.text || ''; o.resolved = true;
    }
    return o;
  });
}

// ---------------------------------------------------------------- the changes since last year (V02): the ten largest, by absolute amount
export const TOP_N = 10; // a firm setting (CP6): the brief says "Ten" from it
export function topChanges(R) {
  if (R.noPrior) return { none: true, top: [], news: [], gone: [], total: 0 };
  // the statements and the Schedule 1 add-backs: the schedules repeat those numbers, so they are not counted twice
  const cand = R.lines.filter((l) => (l.section === 'stmt' || /^s1-add/.test(l.id)) && l.kind !== 'sub' && !l.derived && !l.pct && !l.madeUp && !l.dupOf && l.ly !== null && l.ly !== undefined);
  const diff = (l) => Math.abs(r2(l.cy - l.ly));
  const moved = cand.filter((l) => diff(l) > 0).sort((a, b) => diff(b) - diff(a) || (a.id < b.id ? -1 : 1));
  const news = cand.filter((l) => l.ly === 0 && l.cy !== 0);
  const gone = cand.filter((l) => l.cy === 0 && l.ly !== 0);
  return { none: false, top: moved.slice(0, TOP_N), news, gone, total: moved.length };
}

// ---------------------------------------------------------------- the queue (V15)
export const QUEUE = [
  { id: 'bluewater', name: 'Bluewater Renovations Inc. (Test)', ye: '2025-06-30', tier: 'red', ccpc3: true, since: '2026-03-02T09:15', round: 'First review', signed: 'Dana Whitfield (Test)', why: 'Owner bonus paid after day 179 and subcontractor payments for your judgment; filing date passed.', open: 'bluewater.html#/brief' },
  { id: 'maple', name: 'Maple Ridge Consulting Inc. (Test)', ye: '2025-12-31', tier: 'red', ccpc3: false, since: '2026-03-05T15:40', round: 'First review', signed: 'Dana Whitfield (Test)', why: 'Personal services business signs; repay then reborrow; no interest on the loan; home office.', open: 'red.html#/brief' },
  { id: 'eglinton-h', name: 'Eglinton Holdings Inc. (Test)', ye: '2025-12-31', tier: 'red', ccpc3: false, since: '2026-03-06T09:10', round: 'First review', signed: 'Priya Raman (Test)', why: 'Related-party loans and a non-arm\'s-length sale.' },
  { id: 'scar', name: 'Scarborough Robotics Labs Inc. (Test)', ye: '2025-12-31', tier: 'red', ccpc3: true, since: '2026-03-09T10:00', round: 'First review', signed: 'Dana Whitfield (Test)', why: 'First-year corporation, short tax year; grant, research costs and pre-registration HST for your judgment.', open: 'scarborough.html#/brief' },
  { id: 'eglinton-r', name: 'Eglinton Retail Ltd. (Test)', ye: '2025-12-31', tier: 'amber', ccpc3: false, since: '2026-03-09T16:20', round: 'Back from rework', signed: 'Priya Raman (Test)', why: 'Inventory count differs from the books; two flags open.' },
  { id: 'lakeshore', name: 'Lakeshore Eats Inc. (Test)', ye: '2025-12-31', tier: 'amber', ccpc3: false, since: '2026-03-07T11:30', round: 'First review', signed: 'Sam Okafor (Test)', why: 'Tips and payroll; one flag open.' },
  { id: 'harbourfront', name: 'Harbourfront Print Co. Ltd. (Test)', ye: '2026-02-28', tier: 'amber', ccpc3: false, since: '2026-03-09T09:00', round: 'First review', signed: 'Sam Okafor (Test)', why: 'Year end 28 Feb: new equipment and a vehicle lease.' },
  { id: 'queen', name: 'Queen West Design Studio Inc. (Test)', ye: '2025-09-30', tier: 'green', ccpc3: true, since: '2026-03-04T13:25', round: 'First review', signed: 'Dana Whitfield (Test)', why: 'No red rule fired; nine flags, each fixed or explained.', open: 'green.html#/brief' },
  { id: 'riverdale', name: 'Riverdale Rentals Inc. (Test)', ye: '2025-12-31', tier: 'green', ccpc3: false, since: '2026-03-06T14:05', round: 'First review', signed: 'Priya Raman (Test)', why: 'No red rule fired; rental income only.' },
  { id: 'humber', name: 'Humber Bay Software Ltd. (Test)', ye: '2025-12-31', tier: 'green', ccpc3: false, since: '2026-03-09T13:45', round: 'Back from rework', signed: 'Sam Okafor (Test)', why: 'No red rule fired; five flags, each fixed or explained.' },
];
const RANK = { red: 1, amber: 2, green: 3 };
// the queue's short reason for the tier, so the queue row and the brief say the same words (rule 7: one status, one word)
const QID = { red: 'maple', green: 'queen', blue: 'bluewater', scar: 'scar' };
export const whyShort = (which) => (QUEUE.find((q) => q.id === QID[which]) || {}).why || '';
export function queueRows(later) {
  return QUEUE.map((q) => {
    const row = { ...q };
    if (later && q.id === 'maple') { row.round = 'Back from rework'; row.since = '2026-03-10T14:12'; row.open = 'red-rework.html#/brief'; }
    row.filing = filingDue(q.ye); row.balance = balanceDue(q.ye, q.ccpc3);
    row.overdue = row.filing < TODAY_ISO; row.balancePast = row.balance < TODAY_ISO;
    return row;
  }).sort((a, b) => (a.overdue ? 0 : 1) - (b.overdue ? 0 : 1) || RANK[a.tier] - RANK[b.tier] || (a.filing < b.filing ? -1 : a.filing > b.filing ? 1 : 0) || (a.since < b.since ? -1 : a.since > b.since ? 1 : 0) || (a.id < b.id ? -1 : 1));
}
export function waited(sinceIso, nowIso = '2026-03-10T11:40') {
  const ms = Date.parse(nowIso) - Date.parse(sinceIso);
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins / 60);
  if (h < 48) return h + ' h';
  return Math.floor(h / 24) + ' days';
}
export const sinceText = (s) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}, ${s.slice(11, 16)}`;
