import { Client } from '../lib/engine.mjs';
import { bankName, CH, locate } from '../lib/names.mjs';
import { money, dol as D, ymd, bizInMonth } from '../lib/util.mjs';
import { hstQuarterly, amortAje, t4Out, payrollMonths } from '../lib/kit.mjs';
import { payRuns, postPayroll, t4Data } from '../lib/payroll.mjs';
import { priorYear, gifiStatement } from '../lib/prior-year.mjs';

// ---------------------------------------------------------------- last year as typed inputs (client 11)
// The typed inputs are the 2023 retained earnings, the 2024 book income before tax, dividends, instalments paid, the asset register and
// the small-business rates (2024: federal 9%, Ontario 3.2%, Dept. of Finance rate tables). Tax, taxable income, balance owing, retained
// earnings and the next year's instalments are outputs of lib/prior-year.mjs (card W14 fix round 3, amber A307).
const PY_YEAR = { start: '2024-01-01', end: '2024-12-31' };
const PY_ASSET = { description: 'Computer equipment', glAccount: '1540', accumAccount: '1541', class: '50', cost: 450000, availableForUse: '2023-06-01', life: 3 };
const PY = priorYear({
  fiscalYear: PY_YEAR,
  retainedEarningsOpening: 1425000, // closing 2023, cents
  netIncomeBeforeTax: 11842000, dividends: 0, instalmentsPaid: 1200000,
  rates: { federal: 0.09, ontario: 0.032 },
  assets: [{ description: PY_ASSET.description, class: PY_ASSET.class, cost: PY_ASSET.cost, availableForUse: PY_ASSET.availableForUse, book: { method: 'straight-line', years: PY_ASSET.life, convention: 'monthly' }, cca: { firstYear: 'aii' } }],
});
const PY_NIB = 11842000;
const priorTax = PY.incomeTax;
const priorOwing = PY.balanceOwing; // paid in 2025
const money2 = (cents) => (cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // brought forward from last year: every opening figure comes from PY; retained earnings is the engine's plug and the bank balance is solved to it
  const asset = PY_ASSET, accum = PY.assets[0].accumulated, ucc = PY.ucc[0].closing;
  c.opening['1540'] = asset.cost; c.opening['1541'] = -accum; c.opening['2050'] = -438000; c.opening['3010'] = -10000; c.opening['2085'] = -priorOwing;
  const nia = PY.netIncomeAfterTax, reClose = PY.retainedEarnings.closing;
  const others = Object.values(c.opening).reduce((x, v) => x + v, 0) - c.accts.BCD.opening; // all but the bank and retained earnings; the card is a liability
  c.accts.CHQ.opening = reClose - others;
  hstQuarterly(c, 'CHQ', 438000, { d2: 'CRA GST/HST PAYMENT' });
  c.cardPayments('BCD', 'CHQ', 20);
  // last year's balance owing is paid on 31 Mar; the 2025 instalments are a quarter of 2024's tax each (the prior-year option)
  const balPay = c.bs('CHQ', '2025-03-31', 'CRA', 'CORP TAX BALANCE DUE 2024', -priorOwing, '2085', { kind: 'tax-balance' });
  const instalments = ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'].map((d, i) => c.bs('CHQ', d, 'CRA', 'CORP TAX INSTALMENT', -PY.nextYearInstalments[i], '1250', { kind: 'tax-instalment' }));
  const am = amortAje(c, { date: c.fyEnd, tx: [laptop], reason: 'Book amortization for the year (straight-line, 3 years)', items: [
    { label: 'computer equipment brought forward', cost: asset.cost, acc: '1541', life: asset.life, inService: asset.availableForUse, prior: accum },
    { label: 'laptop', cost: 289900, acc: '1541', life: 3, inService: '2025-03-18' }] });
  c.assets = [
    { description: asset.description, glAccount: asset.glAccount, accumAccount: asset.accumAccount, class: asset.class, cost: D(asset.cost), availableForUse: asset.availableForUse, book: { method: 'straight-line', years: asset.life, convention: 'monthly' }, cca: { firstYear: 'aii' } },
    { description: 'Laptop', glAccount: '1540', accumAccount: '1541', class: '50', cost: 2899, availableForUse: '2025-03-18', book: { method: 'straight-line', years: 3, convention: 'monthly' }, cca: { firstYear: 'aii' } },
  ];

  c.flag({ rule: 'CCA addition: laptop in class 50', severity: 'info', tx: [laptop], aje: [am.id],
    detail: 'One laptop, $2,899.00 before HST ($3,275.87 with it) on the business card on 18 Mar 2025: class 50 on Schedule 8. HST is claimed. Book amortization is added back on Schedule 1.' });
  c.flag({ rule: 'payroll against T4 agrees', severity: 'info', onb: ['payroll'], tx: pay.remits.slice(0, 2),
    detail: 'One employee, 26 pays in 2025. The T4 summary in onboarding agrees with the payroll deposits and the twelve CRA remittances in the year (the December 2024 deductions were paid on 15 Jan 2025).' });
  c.flag({ rule: "last year's return is ours", severity: 'info', onb: ['prior_year_closing_balances'],
    detail: "Last year's return was filed by the firm, CPA-final and assessed as filed. The answer key's prior_year block holds it; the opening balances equal its balance sheet line for line." });
  c.flag({ rule: 'HST regular, quarterly', severity: 'info', onb: ['hst'],
    detail: 'Four payments on 31 Jan, 30 Apr, 31 Jul and 31 Oct 2025 (the first is last year\'s Q4). The Q4 2025 return is paid in January 2026, so HST is payable at year end.' });
  c.flag({ rule: 'corporate tax instalments follow last year (prior-year option)', severity: 'info', tx: [balPay, ...instalments],
    detail: `Last year's tax was $${money2(priorTax)} (over $3,000), so four quarterly instalments of $${money2(PY.nextYearInstalments[0])} are paid on 31 Mar, 30 Jun, 30 Sep and 31 Dec 2025 and booked to the instalments account. Last year's balance owing of $${money2(priorOwing)} was paid on 31 Mar 2025.` });

  c.priorYear = (fin) => ({
    note: "last year's return as the firm filed it, made up; derived by lib/prior-year.mjs from typed inputs in the generator (the 2023 retained earnings, 2024 book income, dividends and instalments, the asset register, the small-business rates); tax is an output",
    fiscalYear: PY_YEAR,
    cpaFinal: true, assessed: true, filedByUs: true,
    balanceSheet: gifiStatement(fin.tb.opening.rows),
    schedule1: { amortization: D(PY.schedule1.amortization), otherAddBacks: D(PY.schedule1.otherAddBacks), cca: D(PY.schedule1.cca) },
    incomeStatement: { netIncomeBeforeTax: D(PY_NIB), incomeTax: D(priorTax), netIncomeAfterTax: D(nia) },
    retainedEarnings: { opening: D(PY.retainedEarnings.opening), dividends: D(PY.retainedEarnings.dividends), closing: D(reClose) },
    retainedEarnings3849: D(-fin.open['3600']),
    balanceOwing: { amount: D(priorOwing), account: '2085', paidBy: [balPay] },
    ucc: c.t2.openingUcc.map((u) => ({ class: u.class, ucc: u.ucc })),
    losses: { nonCapital: PY.nonCapitalLoss ? [{ amount: D(PY.nonCapitalLoss) }] : [], capital: [] },
    dividendAccounts: { grip: 0, lrip: 0, cda: 0, eRdtoh: 0, nerdtoh: 0 },
    noticeOfAssessment: { date: '2025-05-27', assessedAsFiled: true, note: 'made-up date' },
    rv2: { net_income: D(PY_NIB), taxable_income: D(PY.taxableIncome), federal_tax: D(PY.federalTax), ontario_tax: D(PY.ontarioTax), instalments: D(PY.instalmentsPaid), balance_or_refund: D(priorOwing) },
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
  c.t2.openingUcc = [{ class: '50', ucc: D(PY.ucc[0].closing), note: 'brought forward from last year: recomputed from cost, date, class rate and the first-year rule' }];
  c.t2.slips = { T4: t4o.slips, T4Summary: t4o.summary, T5: [], note: 'One employee; no dividends.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  return c;
}

// ---------------------------------------------------------------- 12 Kensington Market Crafts (K05: onboarding answers only)
// Client 12's answers, ids only (RULE-19: no wording here; contract-ids.json is the list). A screen answer (channel 'screen') resolves
// a fact its contract row lists; a fact with no screen id arrives as a conversation answer keyed by its fact id (contract line 83).
// The six expense groups and the bank, loan and share balances have no screen id, so each is keyed by a fact row from the contract's
// section 2 (the GIFI income statement and balance sheet rows); which row is which group is W05's to map to the live fact list.
const ANSWERS = [
  // question_asked, answer, what_it_resolves, channel
  ['BQ2.earn', '28,640.00', 'FL:106', 'screen'], // sales
  ['FL:107', '11,480.00', 'FL:107', 'conversation'], // materials for what she makes
  ['FL:205', '4,350.00', 'FL:205', 'conversation'], // market and booth fees
  ['FL:206', '960.00', 'FL:206', 'conversation'], // advertising and promotion
  ['FL:209', '2,214.20', 'FL:209', 'conversation'], // packaging and shipping
  ['FL:213', '1,140.00', 'FL:213', 'conversation'], // phone and internet
  ['FL:214', '980.00', 'FL:214', 'conversation'], // bank and payment fees
  ['YE1.vehicle', '3,900.00', 'FL:91', 'screen'], // vehicle costs
  ['FL:96', '6,215.80', 'FL:96', 'conversation'], // business bank balance at 31 Dec 2025
  ['FL:97', '2,600.00', 'FL:97', 'conversation'], // business bank balance at 31 Dec 2024 (all prior years were filed by another firm)
  ['FL:104', '2,500.00', 'FL:104', 'conversation'], // money she lent the company, still owed: at both year ends
  ['FL:98', '100.00', 'FL:98', 'conversation'], // amount paid in for the shares: at both year ends
  ['YE1.pcost', '16,800.00', 'FL:92', 'screen'], // home costs she pays personally
  ['YE1.puse', '10', 'FL:93', 'screen'], // share of the home used for the business, percent
  ['YE1.vkm', '12,400', 'FL:95', 'screen'], // kilometres driven
  ['YE1.vbkm', '4,100', 'FL:95', 'screen'], // kilometres driven for the business
];
export function build12() {
  const c = new Client({ num: '12', slug: 'kensington-market-crafts', name: 'Kensington Market Crafts Inc. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1112, hstMethod: 'none' });
  c.owner('Tamsin Reyes (Test)', 100);
  const ans = Object.fromEntries(ANSWERS.map((a) => [a[0], a[1]]));
  const cents = (id) => Math.round(parseFloat(ans[id].replace(/,/g, '')) * 100);
  const src = (id) => ({ kind: 'client answer', answer: id });
  // account, answer, side (the year's entry; the opening balances come from the 31 Dec 2024 answers below)
  const rows = [['1010', 'FL:96', 'dr'], ['5020', 'FL:107', 'dr'], ['6220', 'FL:205', 'dr'], ['6010', 'FL:206', 'dr'], ['6195', 'FL:209', 'dr'], ['6185', 'FL:213', 'dr'], ['6075', 'FL:214', 'dr'], ['6190', 'YE1.vehicle', 'dr'],
    ['4010', 'BQ2.earn', 'cr'], ['2080', 'FL:104', 'cr'], ['3010', 'FL:98', 'cr']];
  c.glSource = Object.fromEntries(rows.map(([gl, id]) => [gl, src(id)]));
  // 31 Dec 2024, as the client gave it: bank, the owner's loan and the share capital; retained earnings is the balancing figure (0.00 here)
  c.opening['1010'] = cents('FL:97'); c.opening['2080'] = -cents('FL:104'); c.opening['3010'] = -cents('FL:98');
  c.openSource = { 1010: src('FL:97'), 2080: src('FL:104'), 3010: src('FL:98'), 3600: { kind: 'client answer', balancing: true, answers: ['FL:97', 'FL:104', 'FL:98'] } };
  // the year moves the bank by the year's profit; the loan and the shares do not move, so they are not in the entry
  const aje = c.aje({ type: 'correction', date: c.fyEnd, onb: rows.map((r) => r[1]), reason: 'Books built from the client\'s onboarding answers only: no account files, no QuickBooks, no documents. Every line is one answer.',
    note: 'summarized entry; each line names the answer it comes from in the trial balance',
    lines: rows.filter(([gl]) => !['2080', '3010'].includes(gl)).map(([gl, id, side]) => ({ gl, [side]: gl === '1010' ? cents(id) - cents('FL:97') : cents(id) })) });

  c.flag({ rule: 'no third-party evidence for revenue', judgement: true, blocking: false, onb: ['BQ2.earn'], aje: [aje],
    detail: 'Sales of $28,640.00 come from the client\'s answer. There is no bank statement, no sales report and no invoice behind it. A person decides whether to ask for evidence or proceed on the answer.' });
  c.flag({ rule: 'bank balance has no statement', judgement: true, blocking: false, onb: ['FL:96', 'FL:97'], aje: [aje],
    detail: 'The year-end bank balance of $6,215.80 (and $2,600.00 a year earlier) is the client\'s answer. No statement or account file was given, so nothing can be tied to it.' });
  c.flag({ rule: 'home office rests on the client\'s word', judgement: true, blocking: false, onb: ['YE1.pcost', 'YE1.puse'],
    detail: 'Home costs of $16,800.00 paid personally and a business share of 10 percent. No rent or utility proof. A person decides what to claim.' });
  c.flag({ rule: 'vehicle use rests on the client\'s word', judgement: true, blocking: false, onb: ['YE1.vehicle', 'YE1.vkm', 'YE1.vbkm'],
    detail: 'Vehicle costs of $3,900.00 and 4,100 business kilometres of 12,400 driven. No logbook. A person decides the business share.' });
  c.flag({ rule: 'shareholder loan rests on the client\'s word', judgement: true, blocking: false, onb: ['FL:104'],
    detail: 'The owner says she lent the company $2,500.00 and is still owed it. No terms and no transfer to show. A person confirms.' });

  c.who = 'Tamsin Reyes (Test) owns Kensington Market Crafts Inc. (Test), a one-person craft business that sells at markets. She is not registered for HST (sales under $30,000, a small supplier). She gave only her onboarding answers: no bank statements, no QuickBooks, no documents.';
  c.planted = [
    'No account files, no QBO files and no documents: the figures are onboarding answers only, stored as the client app stores them (money as text with commas and two decimals).',
    'Sales 28,640.00; materials 11,480.00; market and booth fees 4,350.00; advertising 960.00; packaging and shipping 2,214.20; phone and internet 1,140.00; bank and payment fees 980.00; vehicle costs 3,900.00.',
    'Bank balance at 31 Dec 2025 6,215.80 (2,600.00 at 31 Dec 2024); money the owner lent the company and is still owed 2,500.00; shares issued 100.00. All prior years were filed by another firm: the 31 Dec 2024 balances are the client\'s answers and retained earnings is the balancing figure (0.00).',
    'Home costs she pays personally 16,800.00 with a home office share of 10 (percent); the vehicle drove 12,400 km in the year, 4,100 for the business.',
    'The year\'s entry has debits (the bank\'s rise of 3,615.80 and the seven expense groups) and credits (sales) that both come to 28,640.00.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2023-08-14', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: null, hst_basis: null, books_kept_by: 'owner, no software' },
    services: ['t2'],
    related_entities: [],
    staff: { employees: 0, note: 'The owner works alone.' },
    hst: { registered: false, note: 'Sales under $30,000: a small supplier.' },
    answers: ANSWERS.map(([id, verbatim, resolves, channel]) => ({ question_asked: id, answer_verbatim: verbatim, what_it_resolves: resolves, channel })),
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
