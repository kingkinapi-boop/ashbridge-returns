import { Client } from '../lib/engine.mjs';
import { bankName, CH, locate } from '../lib/names.mjs';
import { money, dol as D, ymd, bizInMonth } from '../lib/util.mjs';
import { hstQuarterly, amortAje, t4Out, payrollMonths } from '../lib/kit.mjs';
import { payRuns, postPayroll, t4Data } from '../lib/payroll.mjs';

// ---------------------------------------------------------------- 11 Humber Bay Software (K01: returning, clean books)
export function build11() {
  const c = new Client({ num: '11', slug: 'humber-bay-software', name: 'Humber Bay Software Ltd. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1111, hstMethod: 'regular' });
  c.codeEveryRow = true; // the control client: the CRA HST payments are coded to 2050 too, so no row is left uncoded
  const elliot = c.owner('Elliot Barrow (Test)', 100);
  const nadia = c.person('Nadia Petrov (Test)');
  for (const p of ['Bayview Analytics Inc. (Test)', 'Cedarvale Clinics Ltd. (Test)', 'Portlands Media Inc. (Test)', 'Lakeview Bank (Test)', 'Aurora Card (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'A', tag: 'CHQ', gl: '1010', role: 'bank', last4: '3306', file: 'lakeview-chequing-3306.csv', floor: 800000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '5528', file: 'aurora-business-card-5528.csv' });

  // revenue: three steady customers, each paid once a month with HST
  for (const m of c.months) {
    for (const [name, day, net] of [['BAYVIEW ANALYTICS TEST INC', 6, 600000], ['CEDARVALE CLINICS TEST LTD', 14, 350000], ['PORTLANDS MEDIA TEST INC', 23, 220000]]) {
      c.rev('CHQ', bizInMonth(ymd(m.y, m.m, Math.min(28, day + c.rng.int(0, 2)))), 'EFT DEPOSIT', name, net, '4010');
    }
  }

  // payroll: one employee every two weeks (26 pays in 2025); December 2024 runs give the opening payroll remittance
  const runs = payRuns(c.rng, [{ key: 'nadia', name: nadia.name, gl: '6130', freq: 'biweekly', anchor: '2025-01-10', gross: 230000 }], '2024-12-01', '2025-12-31');
  const pay = postPayroll(c, 'CHQ', runs);
  const t4o = t4Out(c, t4Data(runs), [2025]);

  // the one capital purchase: a laptop on the business card (class 50)
  const laptop = c.exp('BCD', '2025-03-18', '', 'BEST BUY #0221 TORONTO ON', 327587, '1540', { capital: true, kind: 'capital-purchase' });
  c.cca('50', { date: '2025-03-18', desc: 'Laptop', cost: 289900, tx: laptop, note: 'before HST' });

  // routine spending
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1695 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 8, amt: (i, m, r) => 9200 + r.int(0, 700) });
  c.monthly('CHQ', { gl: '6156', d1: 'PRE-AUTH DEBIT', d2: 'BELL CANADA INTERNET', day: 12, amt: 8999 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'MICROSOFT*365 MSBILL.INFO', day: 15, amt: 2259 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'GOOGLE *WORKSPACE', day: 17, amt: 1412 });
  c.routine('CHQ', { gl: '6090', d1: 'POS PURCHASE', merch: ['STAPLES #', 'AMAZON.CA', 'DOLLARAMA #'], n: [2, 4], amt: [8, 90] });
  c.routine('CHQ', { gl: '6195', d1: 'POS PURCHASE', merch: ['CANADA POST', 'UPS STORE #'], n: [1, 2], amt: [12, 55] });
  c.monthly('BCD', { gl: '6155', d2: 'AMAZON WEB SERVICES', day: 4, amt: (i, m, r) => 31000 + r.int(0, 4000) });
  c.monthly('BCD', { gl: '6155', d2: 'GITHUB', day: 9, amt: 4520 });
  c.monthly('BCD', { gl: '6155', d2: 'ZOOM.US', day: 11, amt: 2259 });
  c.monthly('BCD', { gl: '6155', d2: 'SLACK', day: 19, amt: 1695 });
  c.routine('BCD', { gl: '6090', merch: ['AMAZON.CA', 'STAPLES #'], n: [2, 4], amt: [9, 110] });
  c.routine('BCD', { gl: '6170', merch: ['GREEN P PARKING', 'IMPARK', 'UBER *TRIP'], n: [2, 4], amt: [8, 40] });

  // brought forward from last year (the answer key's prior_year block holds the whole return)
  c.opening['1540'] = 450000; c.opening['1541'] = -260000; c.opening['2050'] = -438000; c.opening['3010'] = -10000;
  hstQuarterly(c, 'CHQ', 438000, { d2: 'CRA GST/HST PAYMENT' });
  c.cardPayments('BCD', 'CHQ', 20);
  const am = amortAje(c, { date: c.fyEnd, tx: [laptop], reason: 'Book amortization for the year (straight-line, 3 years)', items: [
    { label: 'computer equipment brought forward', cost: 450000, acc: '1541', life: 3, inService: '2023-06-01', prior: 260000 },
    { label: 'laptop', cost: 289900, acc: '1541', life: 3, inService: '2025-03-18' }] });

  c.flag({ rule: 'CCA addition: laptop in class 50', severity: 'info', tx: [laptop], aje: [am.id],
    detail: 'One laptop, $2,899.00 before HST ($3,275.87 with it) on the business card on 18 Mar 2025: class 50 on Schedule 8. HST is claimed. Book amortization is added back on Schedule 1.' });
  c.flag({ rule: 'payroll against T4 agrees', severity: 'info', onb: ['payroll'], tx: pay.remits.slice(0, 2),
    detail: 'One employee, 26 pays in 2025. The T4 summary in onboarding agrees with the payroll deposits and the twelve CRA remittances in the year (the December 2024 deductions were paid on 15 Jan 2025).' });
  c.flag({ rule: "last year's return is ours", severity: 'info', onb: ['prior_year_closing_balances'],
    detail: "Last year's return was filed by the firm, CPA-final and assessed as filed. The answer key's prior_year block holds it; the opening balances equal its balance sheet line for line." });
  c.flag({ rule: 'HST regular, quarterly', severity: 'info', onb: ['hst'],
    detail: 'Four payments on 31 Jan, 30 Apr, 31 Jul and 31 Oct 2025 (the first is last year\'s Q4). The Q4 2025 return is paid in January 2026, so HST is payable at year end.' });

  c.priorYear = (fin) => ({
    note: "last year's return as the firm filed it, made up",
    fiscalYear: { start: '2024-01-01', end: '2024-12-31' },
    cpaFinal: true, assessed: true, filedByUs: true,
    balanceSheet: fin.tb.opening.rows.map((r) => ({ gifi: r.gifi, gifiName: r.gifiName, debit: r.debit, credit: r.credit })),
    retainedEarnings3849: D(-fin.open['3600']),
    ucc: c.t2.openingUcc.map((u) => ({ class: u.class, ucc: u.ucc })),
    losses: { nonCapital: [], capital: [] },
    dividendAccounts: { grip: 0, lrip: 0, cda: 0, eRdtoh: 0, nerdtoh: 0 },
    noticeOfAssessment: { date: '2025-05-27', assessedAsFiled: true, note: 'made-up date' },
    rv2: { net_income: 118420.0, taxable_income: 118420.0, federal_tax: 10657.8, ontario_tax: 3789.44, instalments: 12000.0, balance_or_refund: 2447.24 },
  });

  c.who = 'Elliot Barrow (Test) owns Humber Bay Software Ltd. (Test), a small software consultancy with one employee and three steady customers. He takes no salary, draws or dividends. The firm filed last year\'s return. This is the control client: nothing in the books needs a judgement.';
  c.planted = [
    'Monthly payments from three customers, twelve each: BAYVIEW ANALYTICS TEST INC $6,780.00, CEDARVALE CLINICS TEST LTD $3,955.00 and PORTLANDS MEDIA TEST INC $2,486.00 (HST included).',
    'One employee, Nadia Petrov (Test), paid every two weeks (26 pays), with 12 CRA payroll remittances in the year.',
    'CRA GST/HST payments on 31 Jan, 30 Apr, 31 Jul and 31 Oct 2025.',
    'A laptop of $3,275.87 (HST included) at Best Buy on the business card on 18 Mar 2025 (class 50, $2,899.00 before HST).',
    'No owner draws, no personal items, no duplicates, no suspense: every flag is information only.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2019-03-04', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'regular', books_kept_by: 'owner, in QuickBooks' },
    services: ['t2', 'hst', 'payroll', 'bookkeeping'],
    programs: ['corporate_tax', 'hst', 'payroll'],
    related_entities: [],
    staff: { employees: 1, owner_on_payroll: false, pay: 'one employee every two weeks' },
    hst: { basis: 'regular', frequency: 'quarterly', note: 'Calendar quarters, paid by the end of the next month.' },
    payroll: { note: 'Simulated figures; runs from December 2024 give the opening payroll liability.', by_month: payrollMonths(pay.months), t4_summaries: t4o.summary },
    client_notes: ['Nothing unusual this year. One new laptop in March.', 'I take no salary or dividends; the company keeps its cash.'],
  };
  c.t2.openingUcc = [{ class: '50', ucc: 1480.0, note: 'brought forward from last year, made-up figure' }];
  c.t2.slips = { T4: t4o.slips, T4Summary: t4o.summary, T5: [], note: 'One employee; no dividends.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  return c;
}

// ---------------------------------------------------------------- 12 Kensington Market Crafts (K05: onboarding answers only)
const ANSWERS = [
  // id, label, answer, what it resolves, channel
  ['BQ2.earn', 'What the business sold in the year', '28,640.00', 'Revenue for the year (FL:106)', 'screen'],
  ['YE2.materials', 'Materials for what you make', '11,480.00', 'Cost of materials (FL:107)', 'screen'],
  ['YE2.booths', 'Market and booth fees', '4,350.00', 'Main expense groups (FL:107)', 'screen'],
  ['YE2.ads', 'Advertising and promotion', '960.00', 'Main expense groups (FL:107)', 'screen'],
  ['YE2.packing', 'Packaging and shipping', '2,214.20', 'Main expense groups (FL:107)', 'screen'],
  ['YE2.phone', 'Phone and internet', '1,140.00', 'Main expense groups (FL:107)', 'screen'],
  ['YE2.fees', 'Bank and payment fees', '980.00', 'Main expense groups (FL:107)', 'screen'],
  ['YE1.vehicle', 'Vehicle costs for the year', '3,900.00', 'Vehicle costs (FL:91)', 'screen'],
  ['ARB.bal', 'Business bank balance on the last day of the year', '6,215.80', 'Year-end cash (FL:96)', 'screen'],
  ['BQ7.loan', 'Money you lent the company that it still owes you', '2,500.00', 'Shareholder loan (FL:104)', 'screen'],
  ['INC3.shares', 'Amount paid in for the shares', '100.00', 'Share capital (FL:98)', 'screen'],
  ['YE1.pcost', 'Home costs you pay personally for the year', '16,800.00', 'Home office costs (FL:93)', 'screen'],
  ['YE1.puse', 'Share of your home used for the business, in percent', '10', 'Home office share (FL:93)', 'screen'],
  ['YE1.vkm', 'Kilometres driven in the year', '12,400', 'Vehicle kilometres (FL:95)', 'screen'],
  ['YE1.vbkm', 'Kilometres driven for the business', '4,100', 'Vehicle business kilometres (FL:95)', 'screen'],
];
export function build12() {
  const c = new Client({ num: '12', slug: 'kensington-market-crafts', name: 'Kensington Market Crafts Inc. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1112, hstMethod: 'none' });
  c.owner('Tamsin Reyes (Test)', 100);
  const ans = Object.fromEntries(ANSWERS.map((a) => [a[0], a[2]]));
  const cents = (id) => Math.round(parseFloat(ans[id].replace(/,/g, '')) * 100);
  const src = (id) => ({ kind: 'client answer', answer: id });
  // account, answer, side
  const rows = [['1010', 'ARB.bal', 'dr'], ['5020', 'YE2.materials', 'dr'], ['6220', 'YE2.booths', 'dr'], ['6010', 'YE2.ads', 'dr'], ['6195', 'YE2.packing', 'dr'], ['6185', 'YE2.phone', 'dr'], ['6075', 'YE2.fees', 'dr'], ['6190', 'YE1.vehicle', 'dr'],
    ['4010', 'BQ2.earn', 'cr'], ['2080', 'BQ7.loan', 'cr'], ['3010', 'INC3.shares', 'cr']];
  c.glSource = Object.fromEntries(rows.map(([gl, id]) => [gl, src(id)]));
  const aje = c.aje({ date: c.fyEnd, onb: rows.map((r) => r[1]), reason: 'Books built from the client\'s onboarding answers only: no account files, no QuickBooks, no documents. Every line is one answer.',
    note: 'summarized entry; each line names the answer it comes from in the trial balance',
    lines: rows.map(([gl, id, side]) => ({ gl, [side]: cents(id) })) });

  c.flag({ rule: 'no third-party evidence for revenue', judgement: true, blocking: false, onb: ['BQ2.earn'], aje: [aje],
    detail: 'Sales of $28,640.00 come from the client\'s answer. There is no bank statement, no sales report and no invoice behind it. A person decides whether to ask for evidence or proceed on the answer.' });
  c.flag({ rule: 'bank balance has no statement', judgement: true, blocking: false, onb: ['ARB.bal'], aje: [aje],
    detail: 'The year-end bank balance of $6,215.80 is the client\'s answer. No statement or account file was given, so nothing can be tied to it.' });
  c.flag({ rule: 'home office rests on the client\'s word', judgement: true, blocking: false, onb: ['YE1.pcost', 'YE1.puse'],
    detail: 'Home costs of $16,800.00 paid personally and a business share of 10 percent. No rent or utility proof. A person decides what to claim.' });
  c.flag({ rule: 'vehicle use rests on the client\'s word', judgement: true, blocking: false, onb: ['YE1.vehicle', 'YE1.vkm', 'YE1.vbkm'],
    detail: 'Vehicle costs of $3,900.00 and 4,100 business kilometres of 12,400 driven. No logbook. A person decides the business share.' });
  c.flag({ rule: 'shareholder loan rests on the client\'s word', judgement: true, blocking: false, onb: ['BQ7.loan'],
    detail: 'The owner says she lent the company $2,500.00 and is still owed it. No terms and no transfer to show. A person confirms.' });

  c.who = 'Tamsin Reyes (Test) owns Kensington Market Crafts Inc. (Test), a one-person craft business that sells at markets. She is not registered for HST (sales under $30,000, a small supplier). She gave only her onboarding answers: no bank statements, no QuickBooks, no documents.';
  c.planted = [
    'No account files, no QBO files and no documents: the figures are onboarding answers only, stored as the client app stores them (money as text with commas and two decimals).',
    'Sales 28,640.00; materials 11,480.00; market and booth fees 4,350.00; advertising 960.00; packaging and shipping 2,214.20; phone and internet 1,140.00; bank and payment fees 980.00; vehicle costs 3,900.00.',
    'Bank balance at 31 Dec 2025 6,215.80; money the owner lent the company and is still owed 2,500.00; shares issued 100.00.',
    'Home costs she pays personally 16,800.00 with a home office share of 10 (percent); the vehicle drove 12,400 km in the year, 4,100 for the business.',
    'Debits (bank and the seven expense groups) and credits (sales, the owner\'s loan and the shares) both come to 31,240.00.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2023-08-14', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: null, hst_basis: null, books_kept_by: 'owner, no software' },
    services: ['t2'],
    related_entities: [],
    staff: { employees: 0, note: 'The owner works alone.' },
    hst: { registered: false, note: 'Sales under $30,000: a small supplier.' },
    answers: ANSWERS.map(([id, label, verbatim, resolves, channel]) => ({ question_asked: `${id}: ${label}`, answer_verbatim: verbatim, what_it_resolves: resolves, channel })),
    client_notes: ['I sell at markets and online. I do not have bank statements for the company; the balance is what the app showed on 31 December.', 'I lent the company $2,500 when I started.'],
  };
  c.t2.lines = [
    { input: 'Sales', amount: D(cents('BQ2.earn')), unit: 'money', source: src('BQ2.earn') },
    { input: 'Vehicle costs', amount: D(cents('YE1.vehicle')), unit: 'money', source: src('YE1.vehicle') },
    { input: 'Home costs paid personally', amount: D(cents('YE1.pcost')), unit: 'money', source: src('YE1.pcost') },
    { input: 'Home office share of the home', amount: 10, unit: 'percent', source: src('YE1.puse') },
    { input: 'Kilometres driven in the year', amount: 12400, unit: 'km', source: src('YE1.vkm') },
    { input: 'Kilometres driven for the business', amount: 4100, unit: 'km', source: src('YE1.vbkm') },
  ];
  c.t2.openingUcc = [];
  c.t2.slips = { T4: [], T5: [], note: 'No payroll and no dividends.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss brought forward (made-up)' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  return c;
}
