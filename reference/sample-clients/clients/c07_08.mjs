import { Client } from '../lib/engine.mjs';
import { bankName, CH } from '../lib/names.mjs';
import { splitTotal, money, dol as D, addDays, ymd, bizInMonth } from '../lib/util.mjs';
import { amortAje, prepaidInsurance, t4Out, payrollMonths, mergeLines } from '../lib/kit.mjs';
import { payRuns, postPayroll, t4Data, loanTable } from '../lib/payroll.mjs';

// ---------------------------------------------------------------- 07 Riverdale Rentals
export function build07() {
  const c = new Client({ num: '07', slug: 'riverdale-rentals', name: 'Riverdale Rentals Inc. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1107, hstMethod: 'none' });
  const grace = c.owner('Grace Liu (Test)', 100);
  const ten1 = 'Kavya Menon (Test)', ten2 = 'Owen Blackwood (Test)';
  c.person(ten1); c.person(ten2);
  for (const p of ['Harbourline Credit Union (Test)', 'Summit Roofing Ltd. (Test)', 'Blueline Plumbing Inc. (Test)', 'Frostline Snow Services (Test)', 'Greenedge Lawn Care (Test)', 'Lakeshore Utilities (Test)', 'Hearthside Gas (Test)', 'Northshore Mutual Insurance (Test)', 'Arbour Bookkeeping (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'C', tag: 'CHQ', gl: '1010', role: 'bank', last4: '7745', file: 'harbourline-chequing-7745.csv', floor: 500000 });

  let halfOct = null;
  for (const m of c.months) {
    c.rev('CHQ', bizInMonth(ymd(m.y, m.m, c.rng.int(1, 3))), 'E-TRANSFER RECEIVED', bankName(ten1), 210000, '4100', { tax: 'none' });
    if (m.m === 10) continue; // unit 2 misses October
    c.rev('CHQ', bizInMonth(ymd(m.y, m.m, c.rng.int(1, 5))), 'E-TRANSFER RECEIVED', bankName(ten2), 195000, '4100', { tax: 'none' });
    if (m.m === 11) halfOct = c.rev('CHQ', '2025-11-12', 'E-TRANSFER RECEIVED', bankName(ten2), 97500, '4100', { tax: 'none', notes: 'half of the missed October rent' });
  }
  const mort = loanTable({ principal: 41800000, rate: 0.0465, n: 300, first: '2025-01-01', payment: 248000, count: 12 });
  const mortTx = mort.map((r) => c.custom('CHQ', bizInMonth(r.date), 'PRE-AUTH DEBIT', 'MORTGAGE PAYMENT HARBOURLINE CREDIT UNION TEST', -r.payment, [{ gl: '6071', dr: r.interest }, { gl: '2095', dr: r.principal }], { kind: 'mortgage-payment', meta: { loan: r } }));
  for (const d of ['2025-03-03', '2025-06-02', '2025-09-02']) c.exp('CHQ', d, 'ONLINE BILL PAYMENT', 'MUNICIPAL TAX BILL TEST', 296650, '6160', { tax: 'none', kind: 'property-tax' });
  const repair = c.exp('CHQ', '2025-05-14', 'ONLINE BILL PAYMENT', 'BLUELINE PLUMBING TEST INC', 64000, '6126', { tax: 'none', notes: 'plumbing repair' });
  const loanIn = c.bs('CHQ', '2025-08-18', 'E-TRANSFER RECEIVED', bankName(grace.name), 1500000, '2080', { kind: 'shareholder-loan-received' });
  const roof = c.custom('CHQ', '2025-08-20', 'ONLINE BILL PAYMENT', 'SUMMIT ROOFING TEST LTD', -1840000, [{ gl: '1510', dr: 1840000 }], { kind: 'capital-purchase', notes: 'new roof, capital; not a repair' });
  c.cca('1', { date: '2025-08-20', desc: 'New roof on the duplex', cost: 1840000, tx: roof, note: 'capital improvement; the company is not registered for HST so the whole $18,400.00 is cost' });
  const ins = c.exp('CHQ', '2025-10-01', 'PRE-AUTH DEBIT', 'NORTHSHORE MUTUAL INSURANCE TEST', 216000, '6060', { tax: 'none', kind: 'insurance-prepaid', notes: 'twelve months from 1 Oct 2025' });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1295 });
  c.monthly('CHQ', { gl: '6180', d1: 'PRE-AUTH DEBIT', d2: 'LAKESHORE UTILITIES TEST', day: 16, amt: (i, m, r) => r.int(6800, 12400) });
  c.monthly('CHQ', { gl: '6180', d1: 'PRE-AUTH DEBIT', d2: 'HEARTHSIDE GAS TEST', day: 20, amt: (i, m, r) => ([0, 1, 2, 3, 10, 11].includes(i) ? r.int(9000, 21000) : 0) });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'ARBOUR BOOKKEEPING TEST', day: 2, amt: 9500 });
  c.monthly('CHQ', { gl: '6120', d1: 'ONLINE BILL PAYMENT', d2: 'GREENEDGE LAWN TEST', day: 12, amt: (i, m, r) => (i >= 3 && i <= 9 ? r.int(11000, 14000) : 0) });
  c.monthly('CHQ', { gl: '6120', d1: 'ONLINE BILL PAYMENT', d2: 'FROSTLINE SNOW TEST', day: 20, amt: (i, m, r) => ([0, 1, 2, 11].includes(i) ? r.int(15000, 32000) : 0) });
  c.routine('CHQ', { gl: '6120', d1: 'POS PURCHASE', merch: ['HOME DEPOT #', 'RONA #', 'CANADIAN TIRE #', 'HOME HARDWARE #'], n: [3, 6], amt: [12, 190] });

  c.opening['1500'] = 31000000; c.opening['1510'] = 56000000; c.opening['1511'] = -11200000; c.opening['2095'] = -41800000; c.opening['1200'] = 162000; c.opening['3010'] = -20000000;
  const pre = prepaidInsurance(c, { paidTx: ins, premium: 216000, start: '2025-10-01', months: 12, openingPrepaid: 162000, openingNote: 'the policy of 1 Oct 2024 to 30 Sep 2025 cost $2,160.00; nine months were left at 1 Jan 2025' });
  const ajeRent = c.aje({ type: 'accrual', date: c.fyEnd, lines: [{ gl: '1110', dr: 97500 }, { gl: '4100', cr: 97500 }], tx: [halfOct], onb: ['tenants'],
    reason: 'Unit 2 rent: October ($1,950.00) was half paid in November and $975.00 is still owed at year end (the tenant left): rent earned but not received' });
  const am = amortAje(c, { date: c.fyEnd, tx: [roof], reason: 'Book amortization on the building (straight-line, 25 years)', items: [
    { label: 'building brought forward', cost: 56000000, acc: '1511', life: 25, inService: '2020-01-01', prior: 11200000 },
    { label: 'new roof', cost: 1840000, acc: '1511', life: 25, inService: '2025-08-20' }] });

  c.flag({ rule: 'specified investment business: no employees', judgement: true, onb: ['staff'],
    detail: 'The company owns a duplex, has no employees and earns rent. Rental income is investment income in a specified investment business (fewer than six full-time employees): the small business deduction is not available and the passive income rules and refundable taxes apply. A person confirms and Taxprep computes.' });
  c.flag({ rule: 'new roof is capital, not repair', tx: [roof, repair], onb: ['client_notes'],
    detail: 'The $18,400.00 roof on 20 Aug 2025 replaces the old one: added to the building (class 1) and amortized, not expensed. The $640.00 plumbing repair on 14 May is an ordinary repair. The company is not registered, so no HST is claimed.' });
  c.flag({ rule: 'prepaid insurance', tx: [ins], aje: pre.ids, onb: ['prior_year_closing_balances'],
    detail: 'The $2,160.00 premium paid 1 Oct 2025 covers twelve months; nine are after year end, so $1,620.00 is a prepaid asset. The $1,620.00 prepaid brought forward is released to expense.' });
  c.flag({ rule: 'owner lent the company money', tx: [loanIn, roof], onb: ['client_notes'],
    detail: 'Grace Liu lent $15,000.00 on 18 Aug 2025, two days before the roof was paid. Due to shareholder (2080), no interest, no written terms. A person confirms terms and whether the loan is current or long term.' });
  c.flag({ rule: 'rent arrears at year end', judgement: true, tx: [halfOct], aje: [ajeRent], onb: ['tenants'],
    detail: 'Unit 2 missed October, paid half in November and left at year end owing $975.00. Booked as rent receivable; whether it can be collected, reserved or written off is a person\'s decision.' });
  c.flag({ rule: 'mortgage payments: interest and principal', tx: mortTx.slice(0, 3), onb: ['mortgage'],
    detail: 'Twelve payments of $2,480.00. Only the interest (split in onboarding) is an expense; the rest reduces the mortgage. Mortgage interest is deductible against rent.' });
  c.flag({ rule: 'not registered for HST: residential rent is exempt', severity: 'info', detail: 'Rent from residential units is exempt, so no registration and no input tax credits; HST on costs is part of the cost.' });

  c.who = 'Grace Liu (Test) owns Riverdale Rentals Inc. (Test), which holds one duplex. Two tenants pay rent by e-transfer. The company has a mortgage, no employees and is not registered for HST. The second tenant fell behind in the fall and left at year end. The roof was replaced in August with money Grace lent the company.';
  c.planted = [
    'Rents $2,100.00 (unit 1) and $1,950.00 (unit 2) monthly; unit 2 misses October, pays half of it ($975.00) in November (12 Nov), then leaves at year end owing $975.00.',
    'Mortgage payments of $2,480.00 monthly (interest and principal split in onboarding).',
    'Property tax in three instalments (3 Mar, 2 Jun, 2 Sep).',
    'Insurance $2,160.00 paid 1 Oct 2025 for twelve months.',
    'Plumbing repair $640.00 (14 May). New roof $18,400.00 on 20 Aug 2025, paid with $15,000.00 the owner lent the company on 18 Aug.',
    'Volumes are low on purpose: two tenants and a mortgage.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2018-11-20', client_type: 'ccpc', claims_small_business_deduction: 'no', hst_filing_frequency: null, hst_basis: null, books_kept_by: 'part-time bookkeeper' },
    services: ['t2', 'bookkeeping'],
    programs: ['corporate_tax'],
    related_entities: [],
    staff: { employees: 0, note: 'No employees. A snow and lawn contractor is paid per visit.' },
    hst: { registered: false, note: 'Residential rent only.' },
    tenants: [{ unit: 1, tenant: ten1, monthly_rent: 2100.0 }, { unit: 2, tenant: ten2, monthly_rent: 1950.0, note: 'missed October; paid half of it on 12 Nov; left 31 Dec 2025 owing 975.00' }],
    mortgage: { lender: 'Harbourline Credit Union (Test)', opening_balance: 418000.0, annual_rate: 0.0465, monthly_payment: 2480.0, schedule: mort.map((r) => ({ date: bizInMonth(r.date), payment: D(r.payment), interest: D(r.interest), principal: D(r.principal), balance_after: D(r.balance) })) },
    property: { type: 'duplex (two rental units)', land_cost: 310000.0, building_cost: 560000.0 },
    client_notes: ['The second tenant did not pay in October and paid half in November. She moved out at the end of December owing me $975.', 'I put $15,000 of my own money in on 18 August because the roof had to be replaced. Nothing is written down about interest.', 'The insurance renewed on 1 October.'],
  };
  c.t2.openingUcc = [{ class: '1', ucc: 447096.03, note: 'brought forward from last year, made-up figure' }];
  c.assets = [{ description: 'Rental building brought forward', glAccount: '1510', accumAccount: '1511', class: '1', cost: 560000, availableForUse: '2020-01-01', book: { method: 'straight-line', years: 25, convention: 'monthly' }, cca: { firstYear: 'aii' } }];
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss brought forward (made-up)' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.t2.slips = { T4: [], T5: [], note: 'No payroll and no dividends.' };
  c.t2.specifiedInvestmentBusiness = { fullTimeEmployees: 0, note: 'rent is income from a specified investment business (confirm)' };
  return c;
}

// ---------------------------------------------------------------- 08 Queen West Design Studio
export function build08() {
  const rates = { open: 1.35, '2024-10': 1.38, '2024-11': 1.4, '2024-12': 1.43, '2025-01': 1.44, '2025-02': 1.435, '2025-03': 1.43, '2025-04': 1.405, '2025-05': 1.39, '2025-06': 1.37, '2025-07': 1.375, '2025-08': 1.38, '2025-09': 1.39 };
  const YE = 1.39;
  const c = new Client({ num: '08', slug: 'queen-west-design', name: 'Queen West Design Studio Inc. (Test)', fyStart: '2024-10-01', fyEnd: '2025-09-30', seed: 1108, hstMethod: 'regular', rates });
  const amir = c.owner('Amir Rahimi (Test)', 100);
  const zoe = c.person('Zoe Alvarez (Test)');
  const cad = ['Harbord Coffee Roasters Inc. (Test)', 'Ossington Outfitters Ltd. (Test)', 'Kensington Market Co-op (Test)', 'Trinity Bellwoods Brewing Ltd. (Test)', 'Liberty Village Realty Inc. (Test)', 'Spadina Fashion House Inc. (Test)', 'Distillery Tours Inc. (Test)', 'Junction Bikes Ltd. (Test)'];
  const bayview = 'Bayview Print and Pack Ltd. (Test)';
  for (const p of [...cad, bayview, 'Cobalt and Oak Brands LLC (Test)', 'Redwood Labs Inc. (Test)', 'Queen Street Studios (Test)', 'Studio Books Inc. (Test)', 'Northshore Mutual Insurance (Test)', 'Trillium Airways (Test)', 'Marquis Hotel Austin (Test)']) c.party(p, 'company');
  const bank = (n) => n.replace(/\s*\(Test\)\s*$/, '').toUpperCase().replace(/\bINC\.?$/, 'INC').replace(/\bLTD\.?$/, 'LTD').replace(/\bLLC$/, 'LLC').replace(/\.$/, '').replace(/ (INC|LTD|LLC)$/, ' TEST $1').replace(/^((?!TEST).)*$/, (s) => s + ' TEST');
  c.account('CHQ', { kind: 'A', tag: 'CHQ', gl: '1010', role: 'bank', last4: '8102', file: 'lakeview-chequing-8102.csv', floor: 500000 });
  c.account('USD', { kind: 'A', currency: 'USD', tag: 'USD', gl: '1015', role: 'bank', last4: '8119', file: 'lakeview-chequing-usd-8119.csv', opening: 1500000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '6650', file: 'aurora-business-card-6650.csv' });
  c.account('PCD', { kind: 'CARD', tag: 'PCD', gl: '1300', role: 'pcard', last4: '1846', file: 'aurora-personal-card-1846.csv', holder: "owner's personal card" });

  // revenue: Canadian clients with HST, two US clients paid in USD (zero-rated)
  for (const m of c.months) {
    for (const d of c.pickDates(m, c.rng.int(3, 4), { wk: true })) c.rev('CHQ', d, c.rng.chance(0.5) ? 'EFT DEPOSIT' : 'E-TRANSFER RECEIVED', bank(c.rng.pick(cad)), c.rng.int(30, 150) * 5000, '4010');
    for (const [name, day, usd] of [['COBALT AND OAK BRANDS TEST LLC', 14, 480000], ['REDWOOD LABS TEST INC', 22, 620000]]) {
      const d = bizInMonth(ymd(m.y, m.m, day));
      c.rev('USD', d, 'WIRE IN', name, usd, '4020', { tax: 'zero', kind: 'revenue-usd' });
      c.exp('USD', d, 'INCOMING WIRE FEE', '', 1200, '6075', { tax: 'none' });
    }
    const d = c.clampDate(c.accts.CHQ, ymd(m.y, m.m, 28)), usd = c.rng.cents(9000, 11000);
    c.xferFx('USD', 'CHQ', d, usd, Math.round(usd * c.rate(d) * 0.9925), ['WIRE OUT', 'CONVERT TO CAD LAKEVIEW BANK TEST'], ['DEPOSIT', 'CONVERTED FROM USD LAKEVIEW BANK TEST'], { kind: 'transfer-fx' });
  }

  // payroll: owner $6,000.00 monthly, one designer every two weeks; T4 for calendar 2024 and 2025
  const emps = [{ key: 'amir', name: amir.name, gl: '6131', freq: 'monthly', gross: 600000 }, { key: 'zoe', name: zoe.name, gl: '6130', freq: 'biweekly', anchor: '2024-01-05', gross: 240000 }];
  const runs = payRuns(c.rng, emps, '2024-01-01', '2025-12-31');
  const pay = postPayroll(c, 'CHQ', runs);
  const t4o = t4Out(c, t4Data(runs), [2024, 2025]);

  // capital purchases on the business card
  const laptop = c.exp('BCD', '2024-11-19', '', 'BEST BUY #0221 TORONTO ON', 372787, '1540', { capital: true, kind: 'capital-purchase' });
  c.cca('50', { date: '2024-11-19', desc: 'Laptop', cost: 329900, tx: laptop, note: 'before HST' });
  const camera = c.exp('BCD', '2025-03-11', '', 'BEST BUY #0187 MISSISSAUGA ON', 242950, '1530', { capital: true, kind: 'capital-purchase' });
  c.cca('8', { date: '2025-03-11', desc: 'Camera', cost: 215000, tx: camera, note: 'before HST' });
  // US conference and client meals
  const flight = c.exp('BCD', '2025-04-24', '', 'TRILLIUM AIRWAYS TEST', 125000, '6170', { tax: 'none', notes: 'US conference: flight' });
  const hotel = c.exp('BCD', '2025-04-27', '', 'MARQUIS HOTEL AUSTIN TEST', 185000, '6170', { tax: 'none', notes: 'US conference: hotel' });
  const mealN = c.months.map(() => 7 + (c.rng.chance(0.5) ? 1 : 0));
  const mAmts = splitTotal(c.rng, 240000, mealN.reduce((a, b) => a + b, 0), 1800, 6500);
  let k = 0;
  c.months.forEach((m, i) => { for (const d of c.pickDates(m, mealN[i])) c.exp('BCD', d, '', require_loc(c, c.rng.pick([...CH.lunch, ...CH.coffee])), mAmts[k++], '6020', { tax: 'meal', notes: 'client meal' }); });
  // routine
  c.monthly('CHQ', { gl: '6110', d1: 'PRE-AUTH DEBIT', d2: 'QUEEN STREET STUDIOS TEST', day: 1, amt: 361600 });
  c.monthly('CHQ', { gl: '6156', d1: 'PRE-AUTH DEBIT', d2: 'BELL CANADA INTERNET', day: 10, amt: 9999 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 12, amt: 8900 });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'STUDIO BOOKS TEST INC', day: 3, amt: 16950 });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 2495 });
  const ins = c.exp('CHQ', '2025-07-01', 'PRE-AUTH DEBIT', 'NORTHSHORE MUTUAL INSURANCE TEST', 180000, '6060', { tax: 'none', kind: 'insurance-prepaid', notes: 'liability insurance for twelve months from 1 Jul 2025' });
  c.routine('CHQ', { gl: '6090', d1: 'POS PURCHASE', merch: ['STAPLES #', 'AMAZON.CA', 'DOLLARAMA #'], n: [9, 13], amt: [8, 120] });
  c.routine('CHQ', { gl: '6170', d1: 'POS PURCHASE', merch: ['UBER *TRIP', 'PRESTO'], n: [6, 10], amt: [8, 48] });
  c.routine('CHQ', { gl: '6195', d1: 'POS PURCHASE', merch: CH.courier, n: [1, 3], amt: [12, 90] });
  c.monthly('BCD', { gl: '6155', d2: 'GOOGLE *WORKSPACE', day: 6, amt: 1400 });
  c.routine('BCD', { gl: '6090', merch: ['AMAZON.CA', 'STAPLES #'], n: [8, 12], amt: [10, 150] });
  c.routine('BCD', { gl: '6170', merch: ['GREEN P PARKING', 'IMPARK', 'UBER *TRIP'], n: [8, 12], amt: [8, 44] });
  c.routine('BCD', { gl: '6150', merch: ['AMAZON.CA', 'DOLLARAMA #'], n: [5, 8], amt: [12, 140] });

  // owner's personal card: software he lists as business, plus his own spending
  c.personalSpend('PCD', 0.9);
  const subs = [['ADOBE *CREATIVE CLOUD', 8399, 5], ['FIGMA', 2260, 9], ['NOTION LABS', 1130, 14], ['DROPBOX', 1695, 17], ['SLACK', 1130, 21]];
  const sw = [];
  for (const m of c.months) for (const [name, amt, day] of subs) sw.push(c.pcardBusiness('PCD', ymd(m.y, m.m, day), name, amt, '6155'));

  // HST: annual filer with quarterly instalments
  c.opening['2050'] = -634055; c.opening['1530'] = 860000; c.opening['1531'] = -516000; c.opening['1200'] = 132000; c.opening['3010'] = -10000;
  c.bs('CHQ', '2024-10-31', 'CRA', 'GST/HST INSTALMENT', -150000, '2050', { kind: 'hst-instalment' });
  c.bs('CHQ', '2024-12-31', 'CRA', 'GST/HST ANNUAL RETURN PAYMENT', -484055, '2050', { kind: 'hst-remit', notes: 'balance of last year\'s return (opening HST payable less the October instalment)' });
  for (const d of ['2025-01-31', '2025-04-30', '2025-07-31']) c.bs('CHQ', d, 'CRA', 'GST/HST INSTALMENT', -150000, '2050', { kind: 'hst-instalment' });
  c.cardPayments('BCD', 'CHQ', 20);
  c.externalCardPayments('PCD', 18);

  // adjusting entries
  const ajeInv = c.aje({ type: 'accrual', date: '2025-02-14', lines: [{ gl: '1100', dr: 452000 }, { gl: '4010', cr: 400000 }, { gl: '2050', cr: 52000 }], onb: ['client_notes'],
    reason: 'Invoice dated 14 Feb 2025 to Bayview Print and Pack Ltd. (Test): $4,000.00 plus $520.00 HST = $4,520.00. Never paid, so it is not in the bank data' });
  const ajeBad = c.aje({ type: 'estimate', date: '2025-09-22', lines: [{ gl: '6030', dr: 400000 }, { gl: '2050', dr: 52000 }, { gl: '1100', cr: 452000 }], confirm: true, onb: ['client_notes'],
    reason: 'Write off the $4,520.00 invoice from Feb 2025 (the client went bankrupt, written off 22 Sep 2025); the HST bad-debt adjustment is for a person to confirm' });
  const pre = prepaidInsurance(c, { paidTx: ins, premium: 180000, start: '2025-07-01', months: 12, openingPrepaid: 132000, openingNote: 'the policy of 1 Jul 2024 to 30 Jun 2025 cost $1,760.00; nine months were left at 1 Oct 2024' });
  const ajeFee = c.aje({ type: 'accrual', date: c.fyEnd, lines: [{ gl: '6100', dr: 350000 }, { gl: '2030', cr: 350000 }], onb: ['client_notes'],
    reason: 'Year-end accounting fee of $3,500.00 for this year, billed after year end: accrue it (HST is claimed when it is invoiced, next year)' });
  const ajeSw = c.aje({ type: 'accrual', date: c.fyEnd, lines: mergeLines(c.reimburseLines(sw, c.fyEnd, '2080')), tx: sw, onb: ['personal_card_business_items'],
    reason: 'Software the owner paid on his personal card (listed in onboarding): expense it and record what the company owes him' });
  const am = amortAje(c, { date: c.fyEnd, tx: [laptop, camera], reason: 'Book amortization for the year (straight-line: laptop 3 years, camera and older equipment 5 years)', items: [
    { label: 'equipment brought forward', cost: 860000, acc: '1531', life: 5, inService: '2021-10-01', prior: 516000 },
    { label: 'laptop', cost: 329900, acc: '1541', life: 3, inService: '2024-11-19' },
    { label: 'camera', cost: 215000, acc: '1531', life: 5, inService: '2025-03-11' }] });
  const usdClose = c.nativeBalance('USD'), carrying = c.glNet('1015'), diff = Math.round(usdClose * YE) - carrying;
  const ajeFx = c.aje({ type: 'estimate', date: c.fyEnd, confirm: true, onb: ['fx'], lines: diff >= 0 ? [{ gl: '1015', dr: diff }, { gl: '4310', cr: diff }] : [{ gl: '1015', cr: -diff }, { gl: '4310', dr: -diff }],
    reason: `Revalue the US-dollar account at the year-end rate 1.3900 (a test rate): balance USD ${(usdClose / 100).toFixed(2)}` });

  c.flag({ rule: 'bad debt: invoice of $4,520.00 written off in September', aje: [ajeInv, ajeBad], onb: ['client_notes'], judgement: true,
    detail: 'An invoice of $4,520.00 (HST included) from Feb 2025 was never paid and was written off 22 Sep 2025 (the client went bankrupt). It was recorded as sales, then written off to bad debts ($4,000.00) with the HST adjustment ($520.00, confirm). A person checks the write-off is supported.' });
  c.flag({ rule: 'prepaid insurance', tx: [ins], aje: pre.ids, detail: 'The $1,800.00 premium paid 1 Jul 2025 covers twelve months; nine are after year end, so $1,350.00 is prepaid. The $1,320.00 prepaid brought forward is released.' });
  c.flag({ rule: 'accrued year-end accounting fee', aje: [ajeFee], onb: ['client_notes'], detail: 'The $3,500.00 year-end accounting fee is billed after year end for work on this year: accrued as an expense and a liability.' });
  c.flag({ rule: 'owner salary and one employee: payroll against T4', onb: ['payroll'], tx: pay.remits.slice(0, 2), detail: 'Owner salary $6,000.00 monthly and one designer every two weeks. Payroll by month and the T4 summaries for 2024 and 2025 are in onboarding; calendar years straddle the fiscal year (1 Oct 2024 to 30 Sep 2025). September 2025 deductions are still owing at year end.' });
  c.flag({ rule: 'US clients paid in USD: zero-rated and exchange', aje: [ajeFx], onb: ['fx'], detail: 'Two US clients pay by wire in US dollars: no HST (zero-rated), recorded at the monthly test rate; the USD account is revalued at 1.3900 at year end (test rate); conversions carry a bank spread.' });
  c.flag({ rule: 'software on the owner personal card', tx: sw.slice(0, 5), aje: [ajeSw], onb: ['personal_card_business_items'], detail: 'Five subscriptions ($134.14 a month in all, twelve months) are on his personal card but are business costs by his list. Expense them and record what the company owes him; ask for receipts.' });
  c.flag({ rule: 'CCA: laptop class 50 and camera class 8', tx: [laptop, camera], detail: 'Laptop $3,299.00 (19 Nov 2024, class 50) and camera $2,150.00 (11 Mar 2025, class 8), both before HST.' });
  c.flag({ rule: 'meals: 50% limit', detail: 'About $2,400.00 of client meals: half is deductible (Schedule 1 add-back) and half of the HST is claimed. The US conference flight and hotel ($3,100.00) carry no Canadian HST.' });
  c.flag({ rule: 'HST annual filer with instalments', onb: ['hst'], detail: (fin) => `Annual return, instalments of $1,500.00 on 31 Oct 2024 (last year), 31 Jan, 30 Apr and 31 Jul 2025. HST owing at year end: ${money(-fin.adj['2050'])} (return due 31 Dec 2025, with the 31 Oct 2025 instalment to come).` });

  c.who = 'Amir Rahimi (Test) owns Queen West Design Studio Inc. (Test), a small design studio with one employee. Canadian clients pay with HST; two US clients pay in US dollars. Amir pays himself a monthly salary and puts some software on his personal card. The year ends 30 Sep 2025.';
  c.planted = [
    'Owner salary $6,000.00 monthly and one designer every two weeks; T4 summaries for 2024 and 2025 in onboarding.',
    'Two US clients paid in USD (around the 14th and 22nd of each month, USD $4,800.00 and $6,200.00); the USD account is in its own file.',
    'Laptop $3,299.00 on 19 Nov 2024 (class 50); camera $2,150.00 on 11 Mar 2025 (class 8), both before HST.',
    'About $2,400.00 of client meals; a US conference: flight $1,250.00 (24 Apr) and hotel $1,850.00 (27 Apr), $3,100.00 in all.',
    'A $4,520.00 invoice (HST included) from 14 Feb 2025 written off on 22 Sep 2025 (the client went bankrupt).',
    'Liability insurance $1,800.00 paid 1 Jul 2025 for twelve months.',
    'Year-end accounting fee of $3,500.00 billed after year end.',
    'Software on the owner\'s personal card, listed in onboarding (five subscriptions, monthly).',
  ];
  c.onb = {
    corporation: { incorporation_date: '2020-01-13', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'annual', hst_basis: 'regular', books_kept_by: 'part-time bookkeeper' },
    services: ['t2', 'hst', 'payroll', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 1, owner_on_payroll: true, pay: 'owner monthly, one designer every two weeks' },
    hst: { basis: 'regular', frequency: 'annual', instalments: 'quarterly, $1,500.00 each', note: 'Annual return is due three months after year end.' },
    payroll: { note: 'Simulated figures; runs cover calendar 2024 and 2025.', by_month: payrollMonths(pay.months), t4_summaries: t4o.summary },
    fx: { usd_cad_year_end: YE, note: 'test rate, made up', usd_cad_prior_year_end: rates.open },
    personal_card_business_items: { note: 'Five software subscriptions the owner pays on his personal card every month for the business.', subscriptions: subs.map(([n, a]) => ({ merchant: n, monthly_amount: D(a), months: 12 })), total_for_the_year: D(sw.reduce((s, t) => s + t.meta.biz.total, 0)) },
    client_notes: ['One client, Bayview Print and Pack, went bankrupt in the summer. The invoice from February was never paid; I wrote it off in September.', 'Our accountant bills the year-end work after the year ends: $3,500.', 'I put my design software on my own card. The list is above.', 'I paid for a conference in the US in April.'],
  };
  c.t2.openingUcc = [{ class: '8', ucc: 3315.2, note: 'made-up' }, { class: '50', ucc: 42.52, note: 'made-up' }];
  c.assets = [{ description: 'Studio furniture and equipment brought forward', glAccount: '1530', accumAccount: '1531', class: '8', cost: 7400, availableForUse: '2021-10-01', book: { method: 'straight-line', years: 5, convention: 'monthly' }, cca: { firstYear: 'aii' } }, { description: 'Computers brought forward', glAccount: '1530', accumAccount: '1531', class: '50', cost: 1200, availableForUse: '2021-10-01', book: { method: 'straight-line', years: 5, convention: 'monthly' }, cca: { firstYear: 'aii' } }];
  c.t2.slips = { T4: t4o.slips, T4Summary: t4o.summary, T5: [], note: 'T4 slips are by calendar year, not by fiscal year.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.notes.push(`Test rates (CAD per USD): ${Object.entries(rates).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(', ')}.`);
  return c;
}
function require_loc(c, base) { return base.endsWith(' #') ? `${base}${c.rng.int(100, 9999)} ${c.rng.pick(['TORONTO ON', 'MISSISSAUGA ON'])}` : base; }
