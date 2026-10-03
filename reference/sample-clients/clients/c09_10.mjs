import { Client } from '../lib/engine.mjs';
import { bankName, CH } from '../lib/names.mjs';
import { money, dol as D, addDays, ymd, bizInMonth, diffDays } from '../lib/util.mjs';
import { amortAje } from '../lib/kit.mjs';

const bankCo = (n) => n.replace(/\s*\(Test\)\s*$/, '').toUpperCase().replace(/\.$/, '').replace(/ (INC|LTD|LLC|LLP)$/, ' TEST $1').replace(/^((?!TEST).)*$/, (s) => s + ' TEST');

// ---------------------------------------------------------------- 09 Scarborough Robotics Labs
export function build09() {
  const c = new Client({ num: '09', slug: 'scarborough-robotics', name: 'Scarborough Robotics Labs Inc. (Test)', fyStart: '2025-04-15', fyEnd: '2025-12-31', seed: 1109, hstMethod: 'from', hstFrom: '2025-07-01' });
  const wei = c.owner('Wei Zhang (Test)', 70), olu = c.owner('Olu Adeyemi (Test)', 30);
  for (const p of ['Workbench Coworking Inc. (Test)', 'Boucher Hall LLP (Test)', 'Testbench Engineering Ltd. (Test)', 'University Makerspace Lab (Test)', 'Circuithouse Electronics Inc. (Test)', 'Harbourfront Robotics Client Inc. (Test)', 'Ontario Innovation Voucher (Test)', 'Northshore Mutual Insurance (Test)', 'Addison Accounting Inc. (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'A', tag: 'CHQ', gl: '1010', role: 'bank', last4: '9273', file: 'lakeview-chequing-9273.csv', opening: 0 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '3390', file: 'aurora-business-card-3390.csv', opening: 0 });

  c.bs('CHQ', '2025-04-20', 'E-TRANSFER RECEIVED', bankName(wei.name), 7000, '3010', { kind: 'share-subscription', notes: 'common shares, 70 of the $100.00 paid in' });
  c.bs('CHQ', '2025-04-20', 'E-TRANSFER RECEIVED', bankName(olu.name), 3000, '3010', { kind: 'share-subscription', notes: 'common shares, 30 of the $100.00 paid in' });
  const loanW = c.bs('CHQ', '2025-04-22', 'E-TRANSFER RECEIVED', bankName(wei.name), 4000000, '2080', { kind: 'shareholder-loan-received' });
  const loanO = c.bs('CHQ', '2025-05-05', 'E-TRANSFER RECEIVED', bankName(olu.name), 1500000, '2080', { kind: 'shareholder-loan-received' });
  const legal = c.exp('CHQ', '2025-04-24', 'ONLINE BILL PAYMENT', 'BOUCHER HALL LLP TEST', 185000, '6105', { notes: 'incorporation legal fees' });
  const grant = c.bs('CHQ', '2025-09-10', 'DEPOSIT', 'ONTARIO INNOVATION VOUCHER TEST', 2500000, '1390', { kind: 'grant', notes: 'grant received; how to treat it is a person\'s decision, so it is held in suspense' });
  const printer = c.exp('BCD', '2025-06-18', '', 'CIRCUITHOUSE ELECTRONICS TEST INC', 542400, '1530', { capital: true, kind: 'capital-purchase', notes: '3D printer $4,800.00 plus $624.00 HST, bought before HST registration' });
  const lap1 = c.exp('BCD', '2025-07-08', '', 'BEST BUY #0132 SCARBOROUGH ON', 271200, '1540', { capital: true, kind: 'capital-purchase', notes: 'laptop $2,400.00 plus HST' });
  const lap2 = c.exp('BCD', '2025-07-08', '', 'BEST BUY #0132 SCARBOROUGH ON', 271200, '1540', { capital: true, kind: 'capital-purchase', notes: 'laptop $2,400.00 plus HST' });
  c.cca('8', { date: '2025-06-18', desc: '3D printer', cost: 542400, tx: printer, note: 'includes $624.00 HST not claimed (bought before the 1 Jul 2025 registration); if a person allows a credit on capital property on hand, the cost is $4,800.00' });
  c.cca('50', { date: '2025-07-08', desc: 'Two laptops at $2,400.00', cost: 480000, tx: [lap1, lap2], note: 'before HST; HST $624.00 claimed' });
  const pilot = c.rev('CHQ', '2025-11-14', 'EFT DEPOSIT', 'HARBOURFRONT ROBOTICS CLIENT TEST INC', 1800000, '4010', { notes: 'pilot contract $18,000.00 plus HST' });
  const F = '2025-05-01';
  c.exp('BCD', '2025-04-28', '', 'GOOGLE *WORKSPACE', 1400, '6155');
  c.monthly('CHQ', { gl: '6110', d1: 'PRE-AUTH DEBIT', d2: 'WORKBENCH COWORKING TEST INC', day: 1, amt: 120000, from: F });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1995, from: F });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 5, amt: 14500, from: '2025-07-01' });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'ADDISON ACCOUNTING TEST INC', day: 2, amt: 22600, from: '2025-06-01' });
  const rd = [
    c.exp('CHQ', '2025-08-12', 'ONLINE BILL PAYMENT', 'TESTBENCH ENGINEERING TEST LTD', 540000, '6200', { notes: 'contract engineering on the prototype' }),
    c.exp('CHQ', '2025-09-03', 'ONLINE BILL PAYMENT', 'UNIVERSITY MAKERSPACE LAB TEST', 160000, '6200', { notes: 'lab time' }),
  ];
  const before = c.txs.length;
  c.routine('CHQ', { gl: '6150', d1: 'POS PURCHASE', merch: ['AMAZON.CA', 'CANADIAN TIRE #', 'HOME DEPOT #', 'PRINCESS AUTO #'], n: [12, 18], amt: [10, 160], from: F });
  c.routine('CHQ', { gl: '6195', d1: 'POS PURCHASE', merch: CH.courier, n: [2, 4], amt: [12, 90], from: F });
  c.routine('BCD', { gl: '6200', merch: ['CIRCUITHOUSE ELECTRONICS TEST INC', 'AMAZON.CA'], n: [4, 7], amt: [15, 480], from: F });
  c.routine('BCD', { gl: '6150', merch: ['CANADIAN TIRE #', 'DOLLARAMA #', 'STAPLES #'], n: [5, 9], amt: [8, 90], from: F });
  c.routine('BCD', { gl: '6020', tax: 'meal', merch: [...CH.coffee, ...CH.lunch], n: [6, 10], amt: [7, 46], from: F });
  c.routine('BCD', { gl: '6155', merch: ['AMAZON WEB SERVICES', 'GITHUB', 'GOOGLE *WORKSPACE', 'ZOOM.US', 'NOTION LABS'], n: [6, 10], amt: [8, 110], from: F });
  const research = [...rd, ...c.txs.slice(before).filter((t) => t.meta.gl === '6200')];
  // the first HST return (Jul to Sep) is a refund, deposited in November
  const q3 = c.hstNet('2025-07-01', '2025-09-30');
  if (q3 < 0) c.bs('CHQ', '2025-11-26', 'CRA', 'GST/HST REFUND', -q3, '2050', { kind: 'hst-refund' });
  c.cardPayments('BCD', 'CHQ', 20);
  const am = amortAje(c, { date: c.fyEnd, tx: [printer, lap1, lap2], reason: 'Book amortization from the day each asset was ready (straight-line: printer 5 years, laptops 3 years)', items: [
    { label: '3D printer', cost: 542400, acc: '1531', life: 5, inService: '2025-06-18' },
    { label: 'two laptops', cost: 480000, acc: '1541', life: 3, inService: '2025-07-08' }] });

  c.flag({ rule: 'short first taxation year: business limit prorated', judgement: false, onb: ['corporation'],
    detail: 'Incorporated 15 Apr 2025; the first year runs 15 Apr to 31 Dec 2025, 261 days. The business limit is prorated by days over 365: $500,000.00 x 261/365 = $357,534.25 (Taxprep computes). Amortization, CCA and the small business limit use the short year.' });
  c.flag({ rule: 'loss year: non-capital loss', detail: (fin) => `Net loss per books before tax ${money(fin.netIncome)}. Schedule 4 carries the taxable loss (after Schedule 1 add-backs and CCA, computed by Taxprep) forward; the grant and research costs below can change it.` });
  c.flag({ rule: 'two shareholders lending money', tx: [loanW, loanO], onb: ['shareholder_loans'],
    detail: 'Wei Zhang (Test) lent $40,000.00 on 22 Apr and Olu Adeyemi (Test) $15,000.00 on 5 May 2025. Due to shareholders (2080); no interest, no written terms in the file. A person confirms terms and whether the loans are current or long term.' });
  c.flag({ rule: 'grant: treatment needs a person', judgement: true, tx: [grant], onb: ['grant'],
    detail: 'Ontario Innovation Voucher (Test) paid $25,000.00 on 10 Sep 2025. It may be income, a reduction of the costs it funded or a reduction of the research expenditure pool. Held in suspense (1390); a person decides. Nothing is decided here.' });
  c.flag({ rule: 'HST registration part-way through the year', judgement: true, tx: [printer], onb: ['corporation'],
    detail: 'HST registration is effective 1 Jul 2025. Costs before that carry HST inside the cost (no credit). The 3D printer bought 18 Jun ($624.00 HST) and other pre-registration costs: whether any credit on property on hand may be claimed is a person\'s decision. The first return (Jul to Sep) is a refund.' });
  c.flag({ rule: 'research costs: eligibility needs a person', judgement: true, tx: research.slice(0, 6), onb: ['research'],
    detail: 'Contract engineering, lab time and prototype components are coded to research and development (6200) as bought. Whether they qualify as scientific research and experimental development, and how the grant and the loss interact, is for a person. Nothing is claimed or capitalized here.' });
  c.flag({ rule: 'incorporation legal fees: expense or class 14.1', judgement: true, severity: 'info', tx: [legal], detail: 'The $1,850.00 of incorporation fees is coded to legal fees; whether they are deducted or added to class 14.1 is for the CPA (confirm).' });

  c.who = 'Wei Zhang (Test) 70% and Olu Adeyemi (Test) 30% incorporated Scarborough Robotics Labs Inc. (Test) on 15 Apr 2025 to build a robotics prototype. They paid $100.00 for shares and lent the company $55,000.00 between them. The company works from a coworking space, received a $25,000.00 innovation grant, registered for HST on 1 Jul 2025 and billed one pilot contract in November. The year ends in a loss.';
  c.planted = [
    'Incorporated 15 Apr 2025; common shares $100.00 on 20 Apr (Wei $70.00, Olu $30.00). First year 15 Apr to 31 Dec 2025 (261 days): the business limit is prorated.',
    'Loans from Wei $40,000.00 (22 Apr) and Olu $15,000.00 (5 May).',
    'Grant from Ontario Innovation Voucher (Test) of $25,000.00 on 10 Sep.',
    'Coworking $1,200.00 monthly from May; incorporation legal fees $1,850.00 (24 Apr); 3D printer $4,800.00 plus HST (class 8, 18 Jun); two laptops at $2,400.00 (class 50, 8 Jul).',
    'HST registration effective 1 Jul 2025. One pilot contract of $18,000.00 plus HST in November (14 Nov). The year ends in a loss.',
    'Research costs (contract engineering, lab time, components) a person must judge.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2025-04-15', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'regular', hst_registration_effective: '2025-07-01', first_taxation_year: true, books_kept_by: 'the owners with an accountant' },
    services: ['t2', 'hst', 'incorporation', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 0, note: 'The two owners are not paid this year.' },
    hst: { basis: 'regular', frequency: 'quarterly', registered_from: '2025-07-01' },
    shares: { class: 'common', issued_on: '2025-04-20', total_paid: 100.0, holders: [{ name: wei.name, percent: 70, paid: 70.0 }, { name: olu.name, percent: 30, paid: 30.0 }] },
    shareholder_loans: [{ lender: wei.name, amount: 40000.0, received_on: '2025-04-22', interest: 'none', written_terms: false }, { lender: olu.name, amount: 15000.0, received_on: '2025-05-05', interest: 'none', written_terms: false }],
    grant: { grantor: 'Ontario Innovation Voucher (Test)', amount: 25000.0, received_on: '2025-09-10', purpose: 'prototype development', conditions: 'spent on research and development' },
    research: { description: 'a robotic arm prototype: contract engineering, lab time and components', note: 'The owners think it may be scientific research; not checked.' },
    client_notes: ['The grant covers our prototype work; we have not decided how to record it.', 'We registered for HST on 1 July. Before that we paid tax on everything.', 'We lent the company $55,000 together. Nothing is signed.', 'The 3D printer was bought in June, the laptops in July.'],
    prior_year_note: 'First year: no prior-year closing balances.',
  };
  c.t2.taxationYear = { start: c.fyStart, end: c.fyEnd, days: diffDays(c.fyStart, c.fyEnd) + 1, shortYear: true, businessLimitProrated: 357534.25, note: 'prorated by days over 365; Taxprep computes' };
  c.t2.schedule4 = { currentYearLossPerBooks: (fin) => D(fin.netIncome), note: 'the taxable loss comes after Schedule 1 add-backs and CCA; first year, nothing brought forward' };
  c.t2.openingUcc = [];
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.t2.slips = { T4: [], T5: [], note: 'No payroll and no dividends.' };
  c.t2.pendingDecisions = [{ item: 'grant', amount: 25000, where: '1390 Suspense' }, { item: 'research costs', where: '6200' }, { item: 'pre-registration HST on the 3D printer', amount: 624 }];
  c.notes.push('There is no prior year: the opening trial balance is empty and the bank starts at zero on 15 Apr 2025.');
  return c;
}

// ---------------------------------------------------------------- 10 Danforth Cleaning
export function build10() {
  const c = new Client({ num: '10', slug: 'danforth-cleaning', name: 'Danforth Cleaning Co. Ltd. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1110, hstMethod: 'regular' });
  const rosa = c.owner('Rosa Ferreira (Test)', 100);
  const carlos = c.person('Carlos Ferreira (Test)');
  const cleaners = ['Maribel Cruz (Test)', 'Dmitri Volkov (Test)', 'Amara Okoro (Test)'].map((n) => c.person(n).name);
  const cust = [['Danforth Dental Group Inc. (Test)', 3400], ['Greektown Realty Ltd. (Test)', 2650], ['Pape Avenue Medical Clinic (Test)', 3900], ['Broadview Law Office (Test)', 1850], ['Riverside Yoga Studio Inc. (Test)', 1400], ['Playter Physio Inc. (Test)', 2100], ['Withrow Fitness Ltd. (Test)', 2950], ['Logan Avenue Bakery (Test)', 1550], ['Coxwell Accounting Ltd. (Test)', 1750], ['Chester Hill Church Office (Test)', 1450], ['Carlaw Print Shop Inc. (Test)', 2300], ['Jones Avenue Vet Clinic (Test)', 2750]];
  for (const [n] of cust) c.party(n, 'company');
  for (const p of ['Plains Auto Group Inc. (Test)', 'Cleanco Supply Ltd. (Test)', 'Lakefront Kids Camp (Test)', 'Northshore Mutual Insurance (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'C', tag: 'CHQ', gl: '1010', role: 'bank', last4: '4460', file: 'harbourline-chequing-4460.csv', floor: 600000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '8815', file: 'aurora-business-card-8815.csv' });

  for (const m of c.months) for (const [n, net] of cust) c.rev('CHQ', bizInMonth(ymd(m.y, m.m, c.rng.int(4, 12))), 'E-TRANSFER RECEIVED', bankCo(n), net * 100, '4010');
  for (let d = '2025-01-03'; d <= c.fyEnd; d = addDays(d, 7)) { const tot = c.rng.cents(300, 900); c.rev('CHQ', d, 'CASH DEPOSIT', 'BRANCH DEPOSIT', Math.round(tot / 1.13), '4010', { kind: 'cash-deposit' }); }
  for (let d = '2025-01-03'; d <= c.fyEnd; d = addDays(d, 7)) for (const n of cleaners) if (c.rng.chance(0.85)) c.exp('CHQ', d, 'E-TRANSFER SENT', bankName(n), c.rng.cents(280, 690), '6140', { tax: 'none', kind: 'subcontract' });
  const spouse = [];
  for (let d = '2025-01-03'; d <= c.fyEnd; d = addDays(d, 14)) spouse.push(c.bs('CHQ', d, 'E-TRANSFER SENT', bankName(carlos.name), -200000, '1390', { kind: 'spouse-pay', notes: 'called pay by the client; no source deductions' }));
  const suv = c.custom('CHQ', '2025-03-12', 'BANK DRAFT', 'PLAINS AUTO GROUP TEST INC', -8136000, [{ gl: '1520', dr: 7200000 }, { gl: '2050', dr: 936000 }], { kind: 'capital-purchase', notes: 'SUV $72,000.00 plus HST $9,360.00' });
  c.cca('10.1', { date: '2025-03-12', desc: 'SUV (passenger vehicle)', cost: 7200000, tx: suv, note: 'before HST; the class 10.1 cost limit applies to the capital cost and to the input tax credit (confirm the amount for 2025)' });
  const pen1 = c.exp('CHQ', '2025-02-18', 'CRA', 'GST/HST PENALTY AND INTEREST', 28655, '6210', { tax: 'none', kind: 'penalty' });
  const pen2 = c.exp('CHQ', '2025-10-21', 'CRA', 'GST/HST PENALTY AND INTEREST', 14310, '6210', { tax: 'none', kind: 'penalty' });
  // personal spending from the business account
  const camp = c.exp('CHQ', '2025-07-07', 'ONLINE BILL PAYMENT', 'LAKEFRONT KIDS CAMP TEST', 145000, '1300', { tax: 'none', notes: 'children\'s camp' });
  c.routine('CHQ', { gl: '1300', tax: 'none', d1: 'POS PURCHASE', merch: CH.grocery, n: [4, 7], amt: [40, 190] });
  c.monthly('CHQ', { gl: '1300', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'TELUS MOBILITY FAMILY PLAN', day: 9, amt: 18765 });
  // routine
  c.routine('CHQ', { gl: '6150', d1: 'ONLINE BILL PAYMENT', merch: ['CLEANCO SUPPLY TEST LTD'], n: [3, 5], amt: [180, 1150] });
  c.routine('CHQ', { gl: '6150', d1: 'POS PURCHASE', merch: ['COSTCO WHOLESALE #', 'HOME DEPOT #', 'DOLLARAMA #'], n: [3, 5], amt: [20, 380] });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 4, amt: 26500 });
  c.monthly('CHQ', { gl: '6190', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST AUTO', day: 6, amt: 41500 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 10, amt: 9800 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'INTUIT *QUICKBOOKS', day: 20, amt: 3500 });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 2495 });
  c.routine('BCD', { gl: '6190', merch: CH.fuel, n: [10, 14], amt: [55, 105] });
  c.routine('BCD', { gl: '6150', merch: ['HOME DEPOT #', 'CANADIAN TIRE #', 'AMAZON.CA', 'STAPLES #'], n: [5, 8], amt: [10, 210] });
  c.routine('BCD', { gl: '6190', merch: ['GREEN P PARKING', 'IMPARK'], n: [3, 6], amt: [7, 30] });
  c.routine('BCD', { gl: '6020', tax: 'meal', merch: [...CH.coffee], n: [4, 8], amt: [5, 24] });
  const personal = c.txs.filter((t) => t.meta.gl === '1300' && t.acct === 'CHQ'); personal.forEach((t) => { t.kind = 'personal-on-business-account'; });

  c.opening['2050'] = -312040; c.opening['1530'] = 980000; c.opening['1531'] = -588000; c.opening['3010'] = -10000;
  // hst quarterly: opening paid 31 Jan
  const { hstQuarterly } = await_kit();
  hstQuarterly(c, 'CHQ', 312040);
  c.cardPayments('BCD', 'CHQ', 20);
  const am = amortAje(c, { date: c.fyEnd, tx: [suv], reason: 'Book amortization for the year (straight-line, 5 years)', items: [
    { label: 'floor machines and vacuums brought forward', cost: 980000, acc: '1531', life: 5, inService: '2021-01-01', prior: 588000 },
    { label: 'SUV', cost: 7200000, acc: '1521', life: 5, inService: '2025-03-12' }] });

  // ---- the mess: May missing from the export, four March lines twice, eight December 2024 lines mixed in
  const chq = c.accts.CHQ;
  const mayRows = c.txs.filter((t) => t.acct === 'CHQ' && t.date.startsWith('2025-05'));
  mayRows.forEach((t) => { t.inExport = false; });
  const marCand = c.txs.filter((t) => t.acct === 'CHQ' && t.date.startsWith('2025-03') && ['revenue', 'expense', 'subcontract'].includes(t.kind) && t.inExport && t.amt !== 0);
  const dups = c.rng.sample(marCand, 4).map((t) => c.add('CHQ', t.date, t.d1, t.d2, t.amt, { real: false, lines: null, kind: t.kind, meta: { dupOf: t }, sortDate: t.date, sortN: t.n + 0.5, notes: 'appears twice in the export' }));
  const prior = [
    ['2024-12-06', 'E-TRANSFER RECEIVED', 'PAPE AVENUE MEDICAL CLINIC TEST', 440700], ['2024-12-09', 'CASH DEPOSIT', 'BRANCH DEPOSIT', 61500], ['2024-12-13', 'POS PURCHASE', 'COSTCO WHOLESALE #0281 SCARBOROUGH ON', -21684],
    ['2024-12-16', 'PRE-AUTH DEBIT', 'ROGERS', -9800], ['2024-12-18', 'E-TRANSFER RECEIVED', 'DANFORTH DENTAL GROUP TEST INC', 384200], ['2024-12-20', 'E-TRANSFER SENT', 'CARLOS FERREIRA TEST', -200000],
    ['2024-12-23', 'ONLINE BILL PAYMENT', 'CLEANCO SUPPLY TEST LTD', -58915], ['2024-12-27', 'PRE-AUTH DEBIT', 'NORTHSHORE MUTUAL INSURANCE TEST', -26500],
  ];
  const janPos = ['2025-01-08', '2025-01-10', '2025-01-13', '2025-01-15', '2025-01-17', '2025-01-21', '2025-01-23', '2025-01-24'];
  const priorTx = prior.map(([d, d1, d2, amt], i) => c.add('CHQ', d, d1, d2, amt, { outside: true, real: false, lines: null, kind: 'prior-year', meta: { priorYear: true }, sortDate: janPos[i], notes: 'a line from last year\'s statement (December 2024) mixed into this year\'s file' }));
  c.stmtNotes = { 'CHQ:2025-03': 'planted: four transactions appear twice in the export', 'CHQ:2025-05': 'planted: the export has no May rows; the balance jumps' };

  c.flag({ rule: 'missing month: the chequing export has no May rows', judgement: false, tx: mayRows.filter((t) => t.kind === 'spouse-pay'), onb: ['client_notes'],
    detail: (fin, cc) => { const s = cc.accts.CHQ.statements; const a = s.find((x) => x.month === '2025-05'); return `The statement balance is ${money(a.opening)} at 30 Apr and ${money(a.closing)} at 31 May, but the export has no May rows: ${cc.accts.CHQ.missing.length} real transactions are missing (listed in the answer key with missingFromExport). Ask for the May statement; do not book May from guesswork.`; } });
  c.flag({ rule: 'duplicate lines in March', tx: dups, detail: 'Four March transactions appear twice in the export (same date, words and amount). The second copy of each is a duplicate: post nothing. March activity in the export is more than the statement shows.' });
  c.flag({ rule: 'last year\'s statement mixed in', tx: priorTx, detail: 'Eight rows dated December 2024 sit among the January 2025 rows. They belong to last year and are already in the opening balances: post nothing.' });
  c.flag({ rule: 'personal spending paid from the business account', judgement: true, tx: [camp, ...personal.filter((t) => t !== camp).slice(0, 8)],
    detail: 'Groceries, a $1,450.00 children\'s camp (7 Jul) and a family phone plan ($187.65 a month) are paid from the business account. Coded to amounts due from the shareholder (1300) until a person decides between loan, benefit or pay. Not business expenses; no input tax credits.' });
  c.flag({ rule: 'spouse paid with no payroll', judgement: true, tx: spouse.slice(0, 6), onb: ['client_notes'],
    detail: 'Carlos Ferreira (Test), the owner\'s spouse, is paid $2,000.00 every two weeks (26 payments, $52,000.00 in the year, two of them in the missing May) as pay with no source deductions and no T4. Held in suspense (1390). A person decides: is he an employee (then payroll, CPP, EI and tax are owed), is the pay reasonable for work done, or is it something else.' });
  c.flag({ rule: 'luxury vehicle: class 10.1 cost limit', judgement: true, tx: [suv], onb: ['vehicle'],
    detail: 'An SUV was bought 12 Mar 2025 for $72,000.00 plus $9,360.00 HST. Class 10.1 caps the capital cost (and the HST credit) at the prescribed limit; the amount over the limit is not depreciable. Personal use is unknown (onboarding). A person decides the business-use share and confirms the limit for the year.' });
  c.flag({ rule: 'HST returns filed late twice: penalties and interest', judgement: true, tx: [pen1, pen2],
    detail: 'CRA charged penalties and interest of $286.55 (18 Feb 2025) and $143.10 (21 Oct 2025) on late HST returns. Added back on Schedule 1 (the interest part: a person confirms). Not ordinary expenses.' });
  c.flag({ rule: 'contract cleaners: worker status', judgement: true, severity: 'info', detail: 'Three people are paid weekly by e-transfer as sub-contractors. Not a planted issue; a person may still ask whether they are employees.' });

  c.who = 'Rosa Ferreira (Test) owns Danforth Cleaning Co. Ltd. (Test), which cleans offices and clinics for twelve customers under monthly contracts (paid by e-transfer) and small cash jobs. Three contract cleaners are paid weekly. The books are a mess: the bank file is incomplete and has extra lines, family costs go through the business account, her husband is paid without payroll and an SUV was bought in March.';
  c.planted = [
    'The chequing file has no May rows (the statement balance jumps); the true May activity is listed in the answer key as missing from the export.',
    'Four March transactions appear twice; eight December 2024 transactions are mixed into the January rows.',
    'HST regular, quarterly, filed late twice: penalties and interest $286.55 (18 Feb) and $143.10 (21 Oct).',
    'Twelve commercial customers pay by e-transfer; weekly cash deposits of $300.00 to $900.00.',
    'Groceries (weekly), a $1,450.00 children\'s camp on 7 Jul, and a family phone plan ($187.65 monthly) paid from the business account.',
    'Spouse Carlos Ferreira (Test) paid $2,000.00 every two weeks (from 3 Jan) as pay with no source deductions.',
    'An SUV bought 12 Mar 2025 for $72,000.00 plus $9,360.00 HST (class 10.1 limit applies).',
  ];
  c.onb = {
    corporation: { incorporation_date: '2015-10-05', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'regular', books_kept_by: 'the owner, from bank downloads', all_prior_years_filed: 'unsure' },
    services: ['t2', 'hst', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 0, note: 'The owner says her husband helps with the cleaning and she pays him every second Friday.' },
    hst: { basis: 'regular', frequency: 'quarterly', note: 'Two returns filed late this year.' },
    vehicle: { description: 'SUV bought March 2025', business_use_percent: null, note: 'Client is not sure of the business share; used for client visits and family.' },
    spouse: { name: carlos.name, paid_by_company: true, note: 'Paid $2,000 every two weeks; no payroll account used.' },
    client_notes: ['The bank sent me the file in pieces. I think May is missing and the first page has last year\'s December on it.', 'My husband Carlos helps us and I pay him $2,000 every two weeks.', 'The camp in July was for the kids. The groceries and the family phone plan go through the business account because it is easier.', 'I bought an SUV in March for visiting customers.'],
  };
  c.t2.addBacks = [{ item: 'HST late-filing penalties and interest', amount: 28655 + 14310, reason: 'penalties are not deductible; the interest part of the same payments is for a person to confirm', tx: [pen1, pen2], confirm: true }];
  c.t2.openingUcc = [{ class: '8', ucc: 2940.0, note: 'made-up' }];
  c.t2.slips = { T4: [], T5: [], note: 'The spouse\'s pay is not booked as wages; whether a T4 is required is for a person to decide (flag 10-F05).' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.t2.pendingDecisions = [{ item: 'spouse pay', amount: 52000, where: '1390 Suspense' }, { item: 'personal spending', where: '1300 Due from shareholder' }, { item: 'SUV business-use share and class 10.1 limit' }];
  c.notes.push('Contract cleaners are paid by e-transfer every Friday; they are not a planted issue.');
  return c;
}
import { hstQuarterly as _hq } from '../lib/kit.mjs';
function await_kit() { return { hstQuarterly: _hq }; }
