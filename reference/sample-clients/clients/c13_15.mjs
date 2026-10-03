import { Client, bnFromSeed } from '../lib/engine.mjs';
import { finalize } from '../lib/emit.mjs';
import { isPL } from '../lib/chart.mjs';
import { bankName, CH } from '../lib/names.mjs';
import { money, dol as D, ymd, Rng, badNine } from '../lib/util.mjs';
import { amortAje, payrollMonths, t4Out } from '../lib/kit.mjs';
import { payRuns, postPayroll, t4Data } from '../lib/payroll.mjs';

// ================================================================ 13 Sharma Medicine Professional Corporation (K06)
// OHIP remittance advice (RA) by payment month. Each RA pays the services of two months before. Amounts in cents:
// [payment month, payment date, [[service month, amount]] lines, [[service month, amount]] recoveries].
// The June 2025 RA recovers a March 2025 payment (the one reduction, R18); an August 2025 claim of 412.60 is rejected on the October RA
// (which pays August without it) and paid on the December RA. Nov and Dec 2025 services are paid in Jan and Feb 2026 (inside the CK-21 window).
const RA = [
  ['2025-01', '2025-01-14', [['2024-11', 3124050]], []],
  ['2025-02', '2025-02-14', [['2024-12', 2791580]], []],
  ['2025-03', '2025-03-14', [['2025-01', 3241025]], []],
  ['2025-04', '2025-04-14', [['2025-02', 3088060]], []],
  ['2025-05', '2025-05-14', [['2025-03', 3310540]], []],
  ['2025-06', '2025-06-14', [['2025-04', 3176015]], [['2025-03', 118040]]],
  ['2025-07', '2025-07-14', [['2025-05', 3294570]], []],
  ['2025-08', '2025-08-14', [['2025-06', 2983035]], []],
  ['2025-09', '2025-09-14', [['2025-07', 2841590]], []],
  ['2025-10', '2025-10-14', [['2025-08', 3080785]], []],
  ['2025-11', '2025-11-14', [['2025-09', 3267080]], []],
  ['2025-12', '2025-12-14', [['2025-10', 3348020], ['2025-08', 41260]], []],
  ['2026-01', '2026-01-14', [['2025-11', 3190565]], []],
  ['2026-02', '2026-02-14', [['2025-12', 2674030]], []],
];
const raTotal = ([, , lines, red]) => lines.reduce((s, l) => s + l[1], 0) - red.reduce((s, l) => s + l[1], 0);
const PAYER = 'MOH OHIP PAYMENT TEST';
const NON_OHIP = [['2025-03-21', 'NORTHGATE LIFE INSURANCE TEST', 'Northgate Life Insurance (Test)', 65000, 'insurance form'], ['2025-06-11', 'BRANTLEY AND COLE LLP TEST', 'Brantley and Cole LLP (Test)', 240000, 'medical-legal report'],
  ['2025-09-17', 'BRANTLEY AND COLE LLP TEST', 'Brantley and Cole LLP (Test)', 185000, 'medical-legal report'], ['2025-11-26', 'NORTHGATE LIFE INSURANCE TEST', 'Northgate Life Insurance (Test)', 48000, 'insurance form']];

export function build13() {
  const c = new Client({ num: '13', slug: 'sharma-medicine', name: 'Sharma Medicine Professional Corporation (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1113, hstMethod: 'none' });
  c.owner('Anika Sharma (Test)', 100);
  const leah = c.person('Leah Fortin (Test)');
  for (const p of ['Harbourline Credit Union (Test)', 'Aurora Card (Test)', 'Northgate Life Insurance (Test)', 'Brantley and Cole LLP (Test)', 'Meridian Medical Supply (Test)', 'Clinical Supply Co (Test)', 'Clinic Rent Share (Test)', 'Arbour Bookkeeping (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'C', tag: 'CHQ', gl: '1010', role: 'bank', last4: '6620', file: 'harbourline-chequing-6620.csv', floor: 900000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '7714', file: 'aurora-business-card-7714.csv' });

  // OHIP: one deposit a month on the 14th. The January and February deposits pay the opening receivable (2024 services), so they
  // credit it; the others are revenue. The accrual entry below books Nov and Dec 2025 services, paid after year end.
  const deposit = new Map();
  for (const ra of RA.filter((r) => r[1] <= c.fyEnd)) {
    const amt = raTotal(ra);
    const t = ra[2].every((l) => l[0] < '2025-01')
      ? c.bs('CHQ', ra[1], 'EFT DEPOSIT', PAYER, amt, '1100', { kind: 'ohip-deposit', notes: 'pays 2024 services: reduces the opening OHIP receivable' })
      : c.rev('CHQ', ra[1], 'EFT DEPOSIT', PAYER, amt, '4010', { tax: 'none', kind: 'ohip-deposit' });
    deposit.set(ra[0], t);
  }
  // non-OHIP fees (R09): taxable supplies, under the $30,000 small supplier limit, so no registration
  const nonOhip = NON_OHIP.map(([d, bank, who, amt]) => ({ date: d, payer: who, amount: amt, transaction: c.rev('CHQ', d, 'EFT DEPOSIT', bank, amt, '4300', { tax: 'none', kind: 'non-ohip-income' }) }));

  // the office assistant: every two weeks (26 pays), December 2024 runs give the opening payroll remittance
  const runs = payRuns(c.rng, [{ key: 'leah', name: leah.name, gl: '6130', freq: 'biweekly', anchor: '2025-01-10', gross: 215000 }], '2024-12-01', '2025-12-31');
  const pay = postPayroll(c, 'CHQ', runs);
  const t4o = t4Out(c, t4Data(runs), [2025]);

  // exam-room equipment on the business card (class 8): not registered, so no input tax credit and the whole $6,850.00 is cost
  const equip = c.exp('BCD', '2025-05-20', '', 'MERIDIAN MEDICAL SUPPLY TEST', 685000, '1530', { capital: true, kind: 'capital-purchase' });
  c.cca('8', { date: '2025-05-20', desc: 'Exam-room equipment', cost: 685000, tx: equip, note: 'HST included in the cost: the corporation is not registered and claims no input tax credit' });

  // routine costs
  c.monthly('CHQ', { gl: '6110', d1: 'PRE-AUTH DEBIT', d2: 'CLINIC RENT SHARE TEST', day: 1, amt: 420000 });
  c.monthly('CHQ', { gl: '6075', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1295 });
  c.exp('CHQ', '2025-01-30', 'PRE-AUTH DEBIT', 'CMPA DUES TEST', 640000, '6080', { kind: 'dues' });
  c.exp('CHQ', '2025-04-15', 'ONLINE BILL PAYMENT', 'COLLEGE OF PHYSICIANS FEES TEST', 175000, '6080', { kind: 'dues' });
  c.exp('CHQ', '2025-03-03', 'ONLINE BILL PAYMENT', 'ARBOUR BOOKKEEPING TEST', 150000, '6100');
  c.monthly('BCD', { gl: '6150', d2: 'CLINICAL SUPPLY CO TEST', day: 9, amt: (i, m, r) => r.int(38000, 64000) });
  c.monthly('BCD', { gl: '6155', d2: 'INTUIT *QUICKBOOKS', day: 6, amt: 3900 });
  c.monthly('BCD', { gl: '6185', d2: 'ROGERS', day: 12, amt: (i, m, r) => 8400 + r.int(0, 600) });
  c.routine('BCD', { gl: '6090', merch: ['STAPLES #', 'AMAZON.CA'], n: [1, 3], amt: [14, 120] });
  c.cardPayments('BCD', 'CHQ', 20);

  // opening: the receivable for Nov and Dec 2024 services, the share capital; the payroll liabilities come from the December 2024 runs
  c.opening['1100'] = 5915630; c.opening['3010'] = -10000;
  const accrual = c.aje({ date: c.fyEnd, onb: ['ohip_remittance_advice'], tx: [deposit.get('2025-12')], reason: 'OHIP accrual: services for November and December 2025 are paid by the January and February 2026 remittance advice, inside the window (three months of claim submission plus one monthly payment cycle after year end)',
    lines: [{ gl: '1100', dr: 5864595 }, { gl: '4010', cr: 5864595 }] });
  const am = amortAje(c, { date: c.fyEnd, tx: [equip], reason: 'Book amortization on the exam-room equipment (straight-line, 5 years)', items: [{ label: 'exam-room equipment', cost: 685000, acc: '1531', life: 5, inService: '2025-05-20' }] });

  c.flag({ rule: 'OHIP accrual after year end', severity: 'must fire', tx: [deposit.get('2025-12')], aje: [accrual], onb: ['ohip_remittance_advice'],
    detail: 'Services for November and December 2025 ($58,645.95) are paid on 14 Jan and 14 Feb 2026, after year end and not in the bank file. They are accrued as OHIP receivable in one adjusting entry. The window (three months of claim submission plus one monthly payment cycle) closes 30 Apr 2026. The opening receivable of $59,156.30 for 2024 services was collected by the January and February 2025 deposits. A person confirms the accrual against the 2026 remittance advice.' });
  c.flag({ rule: 'RA reduction (recovery of a prior payment)', severity: 'must fire', judgement: true, tx: [deposit.get('2025-06')], onb: ['ohip_remittance_advice'],
    detail: 'The June 2025 remittance advice recovers $1,180.40 paid for March 2025 services, so the June deposit is $30,579.75 and March revenue is $31,925.00. A person confirms the recovery is a reduction of revenue for the service month it belongs to.' });
  c.flag({ rule: 'rejected and resubmitted claim', severity: 'must fire', tx: [deposit.get('2025-10'), deposit.get('2025-12')], onb: ['ohip_remittance_advice'],
    detail: 'One August 2025 claim of $412.60 was rejected on the October remittance advice and paid on the December one with October services ($33,892.80). The resubmitted claim belongs to August 2025 services ($31,220.45 for the month).' });
  c.flag({ rule: 'non-OHIP taxable supplies against the small supplier limit', severity: 'must fire', judgement: true, tx: nonOhip.map((n) => n.transaction), onb: ['hst'],
    detail: 'Insurance form fees and medical-legal reports ($5,380.00 in four deposits) are taxable supplies, kept apart from the exempt OHIP income. They are well under the $30,000 small supplier limit, so there is no registration and no HST. A person confirms the limit was not passed in this or the four previous quarters.' });
  c.flag({ rule: 'no HST return expected', severity: 'info', onb: ['hst', 'cra_program_accounts'],
    detail: 'Insured medical services are exempt supplies and the small supplier limit is not passed: no HST account, no HST program on the CRA account list and no HST return. The exam-room equipment carries its HST in the cost.' });
  c.flag({ rule: 'payroll against T4 agrees', severity: 'info', onb: ['payroll'], tx: pay.remits.slice(0, 2),
    detail: 'One employee, 26 pays in 2025. The T4 summary in onboarding agrees with the payroll deposits and the twelve CRA remittances in the year (the December 2024 deductions were paid on 15 Jan 2025).' });
  c.flag({ rule: 'CCA addition: exam-room equipment in class 8', severity: 'info', tx: [equip], aje: [am.id],
    detail: 'Exam-room equipment of $6,850.00 on the business card on 20 May 2025: class 8 on Schedule 8, HST included in the cost because the corporation is not registered. Book amortization is added back on Schedule 1.' });

  const ras = RA.map((ra) => ({ paymentMonth: ra[0], paymentDate: ra[1], lines: ra[2].map(([m, a]) => ({ serviceMonth: m, amount: D(a), ...(m === '2025-08' && ra[0] === '2025-12' ? { note: 'resubmitted claim, rejected on the October RA' } : {}) })),
    reductions: ra[3].map(([m, a]) => ({ serviceMonth: m, amount: D(a), kind: 'recovery', note: 'recovery of a prior payment (R18)' })), total: D(raTotal(ra)), depositTransaction: deposit.get(ra[0]) ?? null }));
  const byService = new Map();
  for (const ra of RA) { for (const [m, a] of ra[2]) byService.set(m, (byService.get(m) ?? 0) + a); for (const [m, a] of ra[3]) byService.set(m, (byService.get(m) ?? 0) - a); }
  const sumOf = (ms) => ms.reduce((s, m) => s + byService.get(m), 0);
  c.extraKey = {
    ohip: {
      note: 'OHIP income by service month against the remittance advice; made up. Deposits dated in the year, less the opening receivable, plus the accrued receivable, equal revenue for the year\'s service months net of the reduction.',
      payerDescription: PAYER, revenueAccount: '4010', receivableAccount: '1100',
      window: { lastServiceDay: c.fyEnd, submissionMonths: 3, paymentCycles: 1, closesOn: '2026-04-30' },
      raStatements: ras,
      openingReceivable: { serviceMonths: ['2024-11', '2024-12'], amount: D(sumOf(['2024-11', '2024-12'])) },
      accruedReceivable: { serviceMonths: ['2025-11', '2025-12'], amount: D(sumOf(['2025-11', '2025-12'])), paidIn: ['2026-01', '2026-02'], adjustingEntry: accrual },
      reduction: { paymentMonth: '2025-06', serviceMonth: '2025-03', amount: D(118040) },
      resubmission: { serviceMonth: '2025-08', amount: D(41260), rejectedOn: '2025-10', paidOn: '2025-12' },
      revenueByServiceMonth: c.months.map((m) => ({ serviceMonth: m.key, amount: D(byService.get(m.key)) })),
    },
    nonOhipIncome: { note: 'taxable supplies, not OHIP (R09); the small supplier limit is $30,000 in four consecutive quarters', items: nonOhip.map((n) => ({ date: n.date, payer: n.payer, amount: D(n.amount), transaction: n.transaction })), total: D(nonOhip.reduce((s, n) => s + n.amount, 0)), smallSupplierLimit: 30000 },
  };

  c.who = 'Anika Sharma (Test) is a physician and owns Sharma Medicine Professional Corporation (Test). OHIP pays the practice once a month for the services of two months before; the remittance advice says which. She charges a few insurance and legal form fees outside OHIP. An office assistant is on payroll. The corporation is not registered for HST: insured services are exempt supplies.';
  c.planted = [
    'OHIP pays into chequing on the 14th, bank text MOH OHIP PAYMENT TEST, twelve deposits in 2025: Jan $31,240.50, Feb $27,915.80, Mar $32,410.25, Apr $30,880.60, May $33,105.40, Jun $30,579.75, Jul $32,945.70, Aug $29,830.35, Sep $28,415.90, Oct $30,807.85, Nov $32,670.80, Dec $33,892.80. The 14 Jan 2026 ($31,905.65) and 14 Feb 2026 ($26,740.30) payments are after year end and not in the file.',
    'The opening OHIP receivable for Nov and Dec 2024 services is $59,156.30; the accrued receivable for Nov and Dec 2025 services is $58,645.95; OHIP revenue for 2025 services, net of the reduction, is $374,185.35.',
    'The June 2025 remittance advice recovers $1,180.40 paid for March 2025 services (the one reduction). A claim of $412.60 for August 2025 is rejected on the October advice and paid on the December one.',
    'Non-OHIP fees: NORTHGATE LIFE INSURANCE TEST $650.00 on 21 Mar and $480.00 on 26 Nov; Brantley and Cole LLP (Test) $2,400.00 on 11 Jun and $1,850.00 on 17 Sep (bank text in capitals with TEST): $5,380.00 in all, under the $30,000 small supplier limit.',
    'Exam-room equipment of $6,850.00 at MERIDIAN MEDICAL SUPPLY TEST on the business card on 20 May 2025 (class 8). An office assistant paid every two weeks (26 pays) with 12 CRA payroll remittances. No HST anywhere.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2019-08-12', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: null, hst_basis: null, books_kept_by: 'practice manager, in QuickBooks' },
    services: ['t2', 'payroll', 'bookkeeping'],
    programs: ['corporate_tax', 'payroll'],
    related_entities: [],
    staff: { employees: 1, owner_on_payroll: false, pay: 'one office assistant every two weeks' },
    hst: { registered: false, note: 'Insured medical services are exempt supplies; non-OHIP fees are well under the $30,000 small supplier limit.' },
    payroll: { note: 'Simulated figures; runs from December 2024 give the opening payroll liability.', by_month: payrollMonths(pay.months), t4_summaries: t4o.summary },
    ohip_remittance_advice: RA.map((ra) => ({ payment_month: ra[0], payment_date: ra[1], total: D(raTotal(ra)) })),
    client_notes: ['OHIP pays me once a month. The statement shows two months back, so November and December services are paid in January and February.', 'I do a few insurance and legal forms for a fee each year. I have never gone near $30,000.'],
  };
  c.t2.openingUcc = [];
  c.t2.slips = { T4: t4o.slips, T4Summary: t4o.summary, T5: [], note: 'One employee; no dividends.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  return c;
}

// ================================================================ 14 and 15 Rouge Valley Landscaping Inc. (K13: one corporation, two unfiled years)
const OWNER = 'Declan Murphy (Test)';
const SHARED_SIN = badNine(new Rng(1114 ^ 0x2468ace));
const BN = bnFromSeed(1114); // one corporation, one business number, in both folders
const CORP = { incorporation_date: '2021-05-17', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'annual', hst_basis: 'regular', books_kept_by: 'owner, in a spreadsheet',
  all_prior_years_filed: 'no', outstanding_years: '2024 and 2025', financial_year_end_confirmed: false };
// The same 2025 year bought twice: two T2 engagements, one tax year (contract U3); 2024 is text only.
const ENGAGEMENTS = [
  { id: '7c1f0a52-3d4e-4b8a-9c21-5e6d7f8a9b01', service: 't2', recurrence: 'annual', tax_year: 2025, current_state: 'intake', created_at: '2025-02-10T14:05:00Z', is_test: true },
  { id: 'b94e2d17-60aa-4c35-8f1b-2a3c4d5e6f70', service: 't2', recurrence: 'annual', tax_year: 2025, current_state: 'intake', created_at: '2025-03-18T09:40:00Z', is_test: true },
];
const CUST_RES = ['MIRELA COSTA TEST', 'HASSAN KARIMI TEST', 'LINDA ODONNELL TEST', 'PETER WONG TEST', 'SOFIA MARTINEZ TEST', 'GRANT LAWSON TEST', 'AMINA YUSUF TEST', 'DENIS TREMBLAY TEST'];
const CUST_COM = ['WILLOWDALE PLAZA MGMT TEST', 'ROUGE PARK CONDO BOARD TEST', 'CEDAR HEIGHTS DENTAL TEST'];
const ASSETS = [
  { description: 'Zero-turn mower', glAccount: '1530', accumAccount: '1531', class: '8', cost: 14200, availableForUse: '2024-04-12', book: { method: 'straight-line', years: 5, convention: 'monthly' }, cca: { firstYear: 'aii' } },
  { description: 'Trailer', glAccount: '1520', accumAccount: '1521', class: '10', cost: 6800, availableForUse: '2024-04-26', book: { method: 'straight-line', years: 5, convention: 'monthly' }, cca: { firstYear: 'aii' } },
];
// Class 8 at 20% and class 10 at 30%, claimed in full (the accelerated investment incentive factor is 1.0 for 2024 additions). Cents.
const RATE = { 8: 0.2, 10: 0.3 };
const ccaOf = (cls, base) => Math.round(RATE[cls] * base);

function landscaper(o) {
  const c = new Client({ num: o.num, slug: o.slug, name: 'Rouge Valley Landscaping Inc. (Test)', fyStart: o.start, fyEnd: o.end, seed: o.seed, hstMethod: 'regular' });
  c.bn = BN;
  c.owner(OWNER, 100, { bn: SHARED_SIN });
  c.person('Kofi Asante (Test)'); c.person('Ryan Bouchard (Test)');
  for (const n of [...CUST_RES, ...CUST_COM]) c.party(n.replace(/ TEST$/, '').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase()) + ' (Test)', n.includes(' PLAZA') || n.includes('BOARD') || n.includes('DENTAL') ? 'company' : 'person');
  for (const p of ['Maplestone Bank (Test)', 'Aurora Card (Test)', 'Greenline Turf Equipment (Test)', 'Northbay Trailer Sales (Test)', 'Riverbend Insurance (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'B', tag: 'CHQ', gl: '1010', role: 'bank', last4: '4417', file: 'maplestone-chequing-4417.csv', floor: o.floor ?? 150000, opening: o.chqOpening });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '9031', file: 'aurora-business-card-9031.csv', opening: o.cardOpening });

  // seasonal revenue: residential and commercial customers pay by e-transfer, HST added
  for (const m of c.months) {
    if (m.m < o.seasonFrom || m.m > o.seasonTo) continue;
    for (const d of c.pickDates(m, c.rng.int(o.n[0], o.n[1]), { wk: true })) {
      const com = c.rng.chance(0.3);
      c.rev('CHQ', d, 'E-TRANSFER RECEIVED', c.rng.pick(com ? CUST_COM : CUST_RES), c.rng.cents(...(com ? o.com : o.res)), '4010');
    }
    // two crew members paid by e-transfer (small suppliers, no HST charged)
    for (const [who, day] of [['KOFI ASANTE TEST', 5], ['RYAN BOUCHARD TEST', 19]]) c.exp('CHQ', c.clampDate(c.accts.CHQ, ymd(m.y, m.m, day)), 'E-TRANSFER SENT', who, c.rng.cents(...o.crew), '5040', { tax: 'none', kind: 'subcontractor' });
  }
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1495 });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'RIVERBEND INSURANCE TEST', day: 3, amt: 21500 });
  c.monthly('BCD', { gl: '6155', d2: 'INTUIT *QUICKBOOKS', day: 6, amt: 3900 });
  c.monthly('BCD', { gl: '6185', d2: 'ROGERS', day: 12, amt: (i, m, r) => 7600 + r.int(0, 500) });
  c.routine('BCD', { gl: '6190', merch: CH.fuel, n: [3, 5], amt: [45, 115], from: o.start.slice(0, 5) + '04-01', to: o.start.slice(0, 5) + '11-30' });
  c.routine('BCD', { gl: '6150', merch: ['HOME DEPOT #', 'CANADIAN TIRE #', 'PRINCESS AUTO #'], n: [2, 4], amt: [30, 260], from: o.start.slice(0, 5) + '04-01', to: o.start.slice(0, 5) + '11-30' });
  c.routine('BCD', { gl: '6010', merch: ['FACEBK *ADS'], n: [1, 2], amt: [40, 120], from: o.start.slice(0, 5) + '03-01', to: o.start.slice(0, 5) + '06-30' });
  for (const [d, amt] of o.repairs) c.exp('CHQ', d, 'POS PURCHASE', 'GREENLINE TURF EQUIPMENT TEST', amt, '6120');
  c.cardPayments('BCD', 'CHQ', 20);
  c.assets = ASSETS;
  return c;
}

const lossOf = (fin, cca) => -(fin.netIncome + (fin.adj['6050'] ?? 0) - cca); // non-capital loss for the year, cents (negative: income for tax)
const incomeOf = (fin, cca) => fin.netIncome + (fin.adj['6050'] ?? 0) - cca;
const sumCca = (rows) => rows.reduce((s, r) => s + r.cca, 0);

// ---------------------------------------------------------------- 14: 2024
const Y14 = { start: '2024-01-01', end: '2024-12-31' };
const CCA14 = [{ cls: '8', open: 0, add: 1420000, cca: ccaOf(8, 1420000) }, { cls: '10', open: 0, add: 680000, cca: ccaOf(10, 680000) }];
export function build14() {
  const c = landscaper({ num: '14', slug: 'rouge-valley-landscaping-2024', ...Y14, seed: 1114, seasonFrom: 4, seasonTo: 11, n: [5, 7], res: [250, 650], com: [600, 1100], crew: [900, 1500],
    repairs: [['2024-06-18', 38650], ['2024-09-09', 51240]] });
  const loan = c.bs('CHQ', '2024-04-10', 'E-TRANSFER RECEIVED', bankName(OWNER), 2500000, '2080', { kind: 'shareholder-loan-received' });
  const mower = c.exp('CHQ', '2024-04-12', 'POS PURCHASE', 'GREENLINE TURF EQUIPMENT TEST', 1604600, '1530', { capital: true, kind: 'capital-purchase' });
  const trailer = c.exp('CHQ', '2024-04-26', 'POS PURCHASE', 'NORTHBAY TRAILER SALES TEST', 768400, '1520', { capital: true, kind: 'capital-purchase' });
  c.cca('8', { date: '2024-04-12', desc: 'Zero-turn mower', cost: 1420000, tx: mower, note: 'before HST (HST is claimed)' });
  c.cca('10', { date: '2024-04-26', desc: 'Trailer', cost: 680000, tx: trailer, note: 'before HST (HST is claimed)' });
  c.opening['3010'] = -10000;
  // book amortization: straight-line over 5 years, whole months in service (nine months in 2024)
  const a8 = Math.round((1420000 * 9) / 60), a10 = Math.round((680000 * 9) / 60);
  const am = c.aje({ date: c.fyEnd, tx: [mower, trailer], reason: 'Book amortization for 2024 (straight-line, 5 years, nine months in service): mower and trailer',
    note: `mower ${a8 / 100}, trailer ${a10 / 100}`, lines: [{ gl: '6050', dr: a8 + a10 }, { gl: '1531', cr: a8 }, { gl: '1521', cr: a10 }] });
  const cca = sumCca(CCA14);

  corporationFlags(c, { onbYear: 2024 });
  c.flag({ rule: 'non-capital loss for 2024', severity: 'must fire', judgement: true, onb: ['prior_year_closing_balances'],
    detail: (fin) => `The 2024 year ends in a loss: ${money(fin.netIncome)} per books, a non-capital loss of ${money(lossOf(fin, cca))} for tax after the book amortization add-back and the CCA claimed. It is carried to 2025 (folder 15), which applies it against that year's income.` });
  c.flag({ rule: 'CCA additions: mower in class 8 and trailer in class 10', severity: 'info', tx: [mower, trailer], aje: [am],
    detail: 'A zero-turn mower of $14,200.00 plus HST ($16,046.00) on 12 Apr 2024 (class 8) and a trailer of $6,800.00 plus HST ($7,684.00) on 26 Apr 2024 (class 10), both from chequing. HST is claimed, so capital cost is before HST. CCA is claimed in full (class 8 at 20%, class 10 at 30%, the accelerated investment incentive factor 1.0 for 2024).' });
  c.flag({ rule: 'shareholder loan from the owner', severity: 'must fire', judgement: true, tx: [loan], onb: ['owners'],
    detail: 'Declan Murphy (Test) lent the company $25,000.00 on 10 Apr 2024 (account 2080). No interest, no written terms. A person confirms the terms and whether the loan is current or long term. It is still owed at year end and carries into 2025.' });

  c.who = 'Declan Murphy (Test) owns Rouge Valley Landscaping Inc. (Test), a seasonal residential and commercial landscaping business (April to November). The firm was asked to prepare two years at once: this is the first, 2024. Nothing has been filed for 2024 or 2025. In April he lent the company money and bought a mower and a trailer; the year ends in a loss.';
  c.planted = [
    'The owner lends the company $25,000.00 on 10 Apr 2024 (DECLAN MURPHY TEST, his only row).',
    'A zero-turn mower from GREENLINE TURF EQUIPMENT TEST on 12 Apr 2024: $14,200.00 plus HST ($16,046.00; class 8). A trailer from NORTHBAY TRAILER SALES TEST on 26 Apr 2024: $6,800.00 plus HST ($7,684.00; class 10).',
    'Seasonal work from April to November; the year ends in a loss. Nothing is paid to CRA in the year and no penalty is in the books.',
    'Onboarding says not all prior years are filed, holds "2024 and 2025" only as text, marks the year end unconfirmed, and lists the same 2025 year as two T2 engagements.',
  ];
  common(c);
  c.t2.openingUcc = [];
  c.t2.closingUcc = CCA14.map((r) => ({ class: r.cls, opening: D(r.open), additions: D(r.add), disposals: 0, ccaClaimed: D(r.cca), ucc: D(r.open + r.add - r.cca) }));
  c.t2.losses = (fin) => ({ nonCapitalLossForYear: D(lossOf(fin, cca)), note: 'loss per books plus Schedule 1 add-backs less deductions and the CCA claimed; carried to 2025' });
  c.t2.schedule4 = { note: 'a non-capital loss for 2024, carried to 2025 (see losses)' };
  return c;
}

// ---------------------------------------------------------------- 15: 2025, opens from 14
const Y15 = { start: '2025-01-01', end: '2025-12-31' };
export function build15() {
  // 14 is built and finished here only to read its closing figures; the same build runs for folder 14 itself.
  const c14 = build14(), f14 = finalize(c14);
  if (f14.adj['1010'] !== c14.accts.CHQ.closing || f14.adj['2010'] !== -c14.accts.BCD.closing) throw new Error('14: the books and the statements disagree at year end');
  const cca14 = sumCca(CCA14), loss14 = lossOf(f14, cca14);
  if (!(loss14 > 0)) throw new Error('14 must end in a tax loss');
  const c = landscaper({ num: '15', slug: 'rouge-valley-landscaping-2025', ...Y15, seed: 1115, seasonFrom: 3, seasonTo: 11, n: [6, 9], res: [350, 850], com: [800, 1500], crew: [1100, 1700],
    repairs: [['2025-05-22', 44880], ['2025-08-14', 63790]], chqOpening: c14.accts.CHQ.closing, cardOpening: c14.accts.BCD.closing });
  // every balance sheet line opens at 14's adjusted closing line; retained earnings is the engine's balancing figure (14's opening plus 14's net income)
  for (const [gl, v] of Object.entries(f14.adj)) { if (isPL(gl) || ['1010', '2010', '3600', '3700'].includes(gl) || v === 0) continue; c.opening[gl] = v; }
  const open8 = CCA14[0].open + CCA14[0].add - CCA14[0].cca, open10 = CCA14[1].open + CCA14[1].add - CCA14[1].cca;
  const CCA15 = [{ cls: '8', open: open8, add: 0, cca: ccaOf(8, open8) }, { cls: '10', open: open10, add: 0, cca: ccaOf(10, open10) }];
  const cca = sumCca(CCA15);
  // book amortization: a full year, straight-line over 5 years
  const a8 = Math.round(1420000 / 5), a10 = Math.round(680000 / 5);
  c.aje({ date: c.fyEnd, onb: ['prior_year_closing_balances'], reason: 'Book amortization for 2025 (straight-line, 5 years): mower and trailer brought forward from 2024',
    note: `mower ${a8 / 100}, trailer ${a10 / 100}`, lines: [{ gl: '6050', dr: a8 + a10 }, { gl: '1531', cr: a8 }, { gl: '1521', cr: a10 }] });

  corporationFlags(c, { onbYear: 2025 });
  c.flag({ rule: 'opening balances from the 2024 return', severity: 'must fire', judgement: true, onb: ['prior_year_closing_balances'],
    detail: 'Every opening balance equals the closing balance sheet of the 2024 books (folder 14), retained earnings is 2024\'s opening plus its net income, opening UCC is 2024\'s closing UCC by class (8 and 10), and each account opens at the 2024 statement closing balance. If the 2024 return changes, this year\'s opening changes with it.' });
  c.flag({ rule: 'non-capital loss applied from 2024', severity: 'must fire', judgement: true, onb: ['prior_year_closing_balances'],
    detail: (fin) => { const inc = incomeOf(fin, cca), app = Math.min(loss14, Math.max(0, inc)); return `The 2024 non-capital loss of ${money(loss14)} is available. This year's income for tax is ${money(inc)} (profit per books plus book amortization less the CCA claimed), so ${money(app)} is applied and ${money(loss14 - app)} is carried on. A person confirms the application once the 2024 return is final.`; } });
  c.flag({ rule: 'shareholder loan carried from 2024', severity: 'must fire', judgement: true, onb: ['owners'],
    detail: 'The $25,000.00 loan from the owner carries untouched (no repayment, no new loan, no rows with his name). Still no interest and no written terms: a person confirms the terms.' });

  c.who = 'The same company as folder 14: Declan Murphy (Test) owns Rouge Valley Landscaping Inc. (Test), a seasonal landscaping business. This is the second of two unfiled years, 2025, and opens from the 2024 closing balance sheet. No new capital purchases. The year returns to a profit.';
  c.planted = [
    'Opens from 14: every balance sheet line equals 14\'s adjusted closing line; retained earnings is 14\'s opening plus its net income; each account opens at 14\'s statement closing balance; opening UCC for classes 8 and 10 is 14\'s closing UCC.',
    'The owner\'s $25,000.00 loan carries untouched: no rows with his name. Nothing is paid to CRA and no penalty is in the books.',
    '14\'s non-capital loss is brought forward and applied against this year\'s income; the year returns to a profit.',
    'The same business number, owner and engagements as 14 (the same 2025 year bought twice, "2024 and 2025" as text, an unconfirmed year end).',
  ];
  common(c);
  c.t2.openingUcc = CCA15.map((r) => ({ class: r.cls, ucc: D(r.open), note: '2024 closing UCC from folder 14 (made up)' }));
  c.t2.closingUcc = CCA15.map((r) => ({ class: r.cls, opening: D(r.open), additions: D(r.add), disposals: 0, ccaClaimed: D(r.cca), ucc: D(r.open + r.add - r.cca) }));
  c.t2.losses = (fin) => { const inc = incomeOf(fin, cca), app = Math.min(loss14, Math.max(0, inc)); return { nonCapitalLossForYear: 0, nonCapitalBroughtForward: [{ taxYearEnd: '2024-12-31', amount: D(loss14) }], nonCapitalApplied: D(app), nonCapitalClosing: D(loss14 - app), note: 'the lesser of the 2024 loss and this year\'s income for tax is applied' }; };
  c.t2.schedule4 = { note: 'the 2024 non-capital loss is brought forward and applied (see losses)' };
  // last year's return as 14's books give it: a loss year, so no tax, no instalments and no balance
  c.priorYear = (fin) => {
    const ni14 = f14.netIncome, re14 = -f14.open['3600'], re15 = -fin.open['3600'], am14 = f14.adj['6050'] ?? 0;
    return {
      note: 'the 2024 return as folder 14\'s books give it (a loss year, so no tax); prepared in the same catch-up, not yet filed',
      client: '14', fiscalYear: { start: Y14.start, end: Y14.end }, cpaFinal: false, assessed: false, filedByUs: false,
      schedule1: { amortization: D(am14), otherAddBacks: 0, cca: D(cca14) },
      incomeStatement: { netIncomeBeforeTax: D(ni14), incomeTax: 0, netIncomeAfterTax: D(ni14) },
      retainedEarnings: { opening: D(re14), dividends: 0, closing: D(re15) },
      retainedEarnings3849: D(re15),
      ucc: c.t2.openingUcc.map((u) => ({ class: u.class, ucc: u.ucc })),
      losses: { nonCapital: [{ taxYearEnd: '2024-12-31', amount: D(loss14) }], capital: [] },
      rv2: { net_income: D(ni14), taxable_income: 0, federal_tax: 0, ontario_tax: 0, instalments: 0, balance_or_refund: 0 },
    };
  };
  return c;
}

// the five flags both years carry (END-1) and the onboarding both years share
function corporationFlags(c, { onbYear }) {
  c.flag({ rule: 'catch-up years filed in order', severity: 'must fire', judgement: true, onb: ['corporation.all_prior_years_filed', 'corporation.outstanding_years'],
    detail: 'Onboarding says not all prior years are filed and holds the unfiled years only as text ("2024 and 2025"). Catch-up years are filed in order, oldest first: red tier (CK-40\'s list), a person decides. This folder is ' + onbYear + '.' });
  c.flag({ rule: 'second return waits for the first', severity: 'must fire', judgement: true,
    detail: 'The 2025 return opens from the 2024 closing balances, retained earnings, UCC and non-capital loss, so it waits until the 2024 return is final. Any change to 2024 changes 2025.' });
  c.flag({ rule: 'year end to be confirmed by ops', severity: 'must fire', judgement: true, onb: ['corporation.financial_year_end'],
    detail: 'The client app stored 31 December as a guess from the quote month; no question confirms it (contract U4). Ops confirms the year end from CRA capture, the articles or the prior return before either year is filed.' });
  c.flag({ rule: '2025 bought twice', severity: 'must fire', judgement: true, onb: ['engagements'],
    detail: 'Onboarding lists two T2 engagements for tax year 2025 (created 10 Feb and 18 Mar 2025) and none for 2024: the second quote reused the year (contract U3). Ops confirms which is real and that 2024 is covered.' });
  c.flag({ rule: 'late-filing exposure', severity: 'must fire', judgement: true, onb: ['corporation.outstanding_years'],
    detail: 'Neither the T2 nor the annual HST return is filed for 2024 or 2025: CRA late-filing penalty and interest may apply. No penalty is in the books (no row says CRA or penalty); a person estimates the exposure and tells the client.' });
}
function common(c) {
  c.onb = {
    corporation: { ...CORP, ...c.onb?.corporation },
    services: ['t2', 'hst', 'bookkeeping'],
    programs: ['corporate_tax', 'hst'],
    related_entities: [],
    staff: { employees: 0, note: 'No employees. Two crew members are paid per job by e-transfer.' },
    hst: { basis: 'regular', frequency: 'annual', note: 'Annual filer; no HST return has been filed for 2024 or 2025.' },
    engagements: ENGAGEMENTS,
    client_notes: ['I run the business from April to November. I have not filed anything for the last two years.', 'I put $25,000 of my own money in when I bought the mower and trailer in 2024.'],
  };
  c.t2.slips = { T4: [], T5: [], note: 'No payroll and no dividends.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
}
