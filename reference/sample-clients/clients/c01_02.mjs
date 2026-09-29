import { Client } from '../lib/engine.mjs';
import { bankName, CH, locate } from '../lib/names.mjs';
import { splitTotal, money, dol as D, addDays, ymd, bizInMonth } from '../lib/util.mjs';
import { hstQuarterly, hstMonthly, amortAje } from '../lib/kit.mjs';
import { loanTable } from '../lib/payroll.mjs';

// ---------------------------------------------------------------- 01 Maple Ridge Consulting
export function build01() {
  const c = new Client({ num: '01', slug: 'maple-ridge', name: 'Maple Ridge Consulting Inc. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1101, hstMethod: 'regular' });
  const priya = c.owner('Priya Nair (Test)', 100);
  const PN = bankName(priya.name);
  for (const p of ['Northwind Logistics Inc. (Test)', 'Kestrel Print Works Inc. (Test)', 'Ontario Trail Outfitters Ltd. (Test)', 'Fernbank Clinics Inc. (Test)', 'Brightpath Bookkeeping Inc. (Test)', 'Northshore Mutual Insurance (Test)', 'TechForward Conference (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'A', tag: 'CHQ', gl: '1010', role: 'bank', last4: '4821', file: 'lakeview-chequing-4821.csv', floor: 400000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '7712', file: 'aurora-business-card-7712.csv' });
  c.account('PCD', { kind: 'CARD', tag: 'PCD', gl: '1300', role: 'pcard', last4: '3309', file: 'aurora-personal-card-3309.csv', holder: "owner's personal card" });

  // revenue: Northwind every month, three small clients
  for (const m of c.months) c.rev('CHQ', bizInMonth(ymd(m.y, m.m, c.rng.int(24, 29))), 'EFT DEPOSIT', 'NORTHWIND LOGISTICS TEST INC', 1400000, '4010');
  for (const [d, n, a] of [['2025-03-19', 'KESTREL PRINT WORKS TEST INC', 620000], ['2025-07-16', 'ONTARIO TRAIL OUTFITTERS TEST LTD', 590000], ['2025-10-22', 'FERNBANK CLINICS TEST INC', 660000]]) c.rev('CHQ', d, 'E-TRANSFER RECEIVED', n, a, '4010');

  // the owner's loan account and the dividend
  const draws = [['2025-02-12', 400000], ['2025-04-03', 650000], ['2025-06-20', 500000], ['2025-08-15', 750000], ['2025-10-10', 400000]]
    .map(([d, a]) => c.bs('CHQ', d, 'E-TRANSFER SENT', PN, -a, '1300', { kind: 'shareholder-loan-advance' }));
  const repay = c.bs('CHQ', '2025-12-18', 'E-TRANSFER RECEIVED', PN, 1200000, '1300', { kind: 'shareholder-loan-repayment' });
  const divTx = c.bs('CHQ', '2025-12-20', 'E-TRANSFER SENT', PN, -2000000, '3700', { kind: 'dividend', notes: 'non-eligible dividend; same wording as the loan advances, told apart by amount, date and the onboarding dividend list' });

  // chequing: fixed items and small debit-card purchases
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1695 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 8, amt: (i, m, r) => 8500 + r.int(0, 900) });
  c.monthly('CHQ', { gl: '6156', d1: 'PRE-AUTH DEBIT', d2: 'BELL CANADA INTERNET', day: 12, amt: 7999 });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'BRIGHTPATH BOOKKEEPING TEST INC', day: 1, amt: 28250 });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 5, amt: 11800 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'MICROSOFT*365 MSBILL.INFO', day: 15, amt: 1695 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'GOOGLE *WORKSPACE', day: 17, amt: 936 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'INTUIT *QUICKBOOKS', day: 20, amt: 3500 });
  c.routine('CHQ', { gl: '6170', tax: 'none', d1: 'POS PURCHASE', merch: ['PRESTO'], n: [12, 16], amt: [5, 45] });
  c.routine('CHQ', { gl: '6170', d1: 'POS PURCHASE', merch: ['GREEN P PARKING', 'IMPARK'], n: [5, 8], amt: [6, 28] });
  c.routine('CHQ', { gl: '6170', d1: 'POS PURCHASE', merch: ['UBER *TRIP'], n: [4, 7], amt: [11, 52] });
  c.routine('CHQ', { gl: '6090', d1: 'POS PURCHASE', merch: ['STAPLES #', 'AMAZON.CA', 'DOLLARAMA #'], n: [5, 8], amt: [6, 85] });
  c.routine('CHQ', { gl: '6195', d1: 'POS PURCHASE', merch: ['CANADA POST', 'UPS STORE #'], n: [2, 3], amt: [12, 60] });

  // business card: about $1,850.00 of meals in the year, plus subscriptions and small purchases
  const mealN = c.months.map(() => 12 + (c.rng.chance(0.5) ? 1 : 0));
  const amts = splitTotal(c.rng, 185000, mealN.reduce((a, b) => a + b, 0), 600, 2600);
  let k = 0;
  c.months.forEach((m, i) => { for (const d of c.pickDates(m, mealN[i])) c.exp('BCD', d, '', locate(c.rng, c.rng.pick([...CH.coffee, ...CH.lunch])), amts[k++], '6020', { tax: 'meal' }); });
  c.monthly('BCD', { gl: '6155', d2: 'ZOOM.US', day: 9, amt: 2259 });
  c.monthly('BCD', { gl: '6155', d2: 'DROPBOX', day: 14, amt: 1695 });
  c.monthly('BCD', { gl: '6155', d2: 'NOTION LABS', day: 22, amt: 1130 });
  c.monthly('BCD', { gl: '6155', d2: 'CANVA', day: 3, amt: 1921 });
  c.routine('BCD', { gl: '6090', merch: ['AMAZON.CA', 'STAPLES #'], n: [4, 7], amt: [7, 95] });
  c.routine('BCD', { gl: '6170', merch: ['GREEN P PARKING', 'IMPARK', 'UBER *TRIP'], n: [5, 9], amt: [7, 46] });
  c.routine('BCD', { gl: '6170', tax: 'none', merch: ['PRESTO'], n: [4, 8], amt: [6, 40] });
  c.routine('BCD', { gl: '6195', merch: ['CANADA POST', 'PUROLATOR'], n: [1, 2], amt: [11, 48] });

  // owner's personal card: mostly personal, six business items listed in onboarding
  c.personalSpend('PCD');
  const biz = [
    c.pcardBusiness('PCD', '2025-02-04', 'ADOBE *CREATIVE CLOUD', 65988, '6155'),
    c.pcardBusiness('PCD', '2025-04-16', 'EAST SIDE MARIOS #2286 TORONTO ON', 8640, '6020', { tax: 'meal', notes: 'client lunch' }),
    c.pcardBusiness('PCD', '2025-05-22', 'VIA RAIL CANADA', 8800, '6170'),
    c.pcardBusiness('PCD', '2025-06-11', 'BEST BUY #331 MISSISSAUGA ON', 37999, '6095', { notes: 'monitor: a small item; expense or capital (class 50) is a person\'s choice' }),
    c.pcardBusiness('PCD', '2025-09-10', 'MOXIES #0412 TORONTO ON', 12415, '6020', { tax: 'meal', notes: 'client lunch' }),
    c.pcardBusiness('PCD', '2025-10-21', 'TECHFORWARD CONFERENCE TEST', 45000, '6175'),
  ];
  const ajeBiz = c.aje({ date: '2025-12-31', lines: c.reimburseLines(biz, '2025-12-31'), tx: biz, onb: ['personal_card_business_items'],
    reason: 'Six business items the owner paid on her personal card (listed by her in onboarding): expense them and reduce the amount she owes the company' });

  c.opening['2050'] = -511328;
  c.opening['3010'] = -10000;
  hstQuarterly(c, 'CHQ', 511328);
  c.cardPayments('BCD', 'CHQ', 20);
  c.externalCardPayments('PCD', 18);

  // ---- flags ----
  c.flag({ rule: 'personal services business signs', judgement: true, onb: ['client_notes', 'staff'],
    detail: 'One client (Northwind Logistics Inc. (Test), $168,000.00 of about $186,700.00) is about 90% of revenue; the owner does all the work herself, has no employees, works in Northwind\'s office on its laptop 9 to 5 (client note) and Northwind calls her a contractor. She claims the small business deduction. Expect a flag for the CPA; nothing decided here.' });
  c.flag({ rule: 'shareholder loan unpaid at year end, repayment deadline 31 Dec 2026', tx: [...draws, repay], aje: [ajeBiz], onb: ['client_notes'],
    detail: (fin) => `Amount due from the owner at year end is ${money(fin.adj['1300'])}: advances $27,000.00 (12 Feb, 3 Apr, 20 Jun, 15 Aug, 10 Oct) less $12,000.00 repaid 18 Dec less $1,788.42 of her business items reimbursed. Repayment deadline: 31 Dec 2026 (end of the fiscal year after the year the loan was made). No interest is charged.` });
  c.flag({ rule: 'repay then reborrow: series of loans and repayments', judgement: true, tx: [repay], onb: ['client_notes'],
    detail: 'She repaid $12,000.00 on 18 Dec 2025 and her onboarding note says she will take about $10,000 again in January. The repayment may be part of a series of loans and repayments and may not count as a repayment. A person decides.' });
  c.flag({ rule: 'no interest charged on shareholder loan', judgement: true, tx: draws, detail: 'No interest is charged on the loan. A deemed interest benefit may apply if it stays unpaid; the prescribed rate and the treatment are for the CPA to confirm.' });
  c.flag({ rule: 'business items on the owner personal card', tx: biz, aje: [ajeBiz], onb: ['personal_card_business_items'],
    detail: 'Six items totalling $1,788.42 (Adobe $659.88, lunches $86.40 and $124.15, monitor $379.99, train $88.00, conference $450.00) are on her personal card but are business costs by her list. Expect an adjusting entry reducing the shareholder balance, with receipts asked for. The monitor is a small item (expense or class 50 is a person\'s choice).' });
  c.flag({ rule: 'meals: 50% limit on the deduction and on the HST claim', tx: biz.filter((t) => t.meta.biz.gl === '6020'),
    detail: 'About $1,850.00 of meals on the business card plus $210.55 of client lunches on the personal card. Only half is deductible (Schedule 1 add-back, see t2Inputs) and only half of the HST on meals is claimed.' });
  c.flag({ rule: 'home office: rent paid personally, needs a person\'s decision', judgement: true, onb: ['home_office'],
    detail: '15% of $2,800.00 monthly rent is $420.00 a month, $5,040.00 a year, paid by the owner personally. Not booked. A person decides whether the company may claim it (needs an arrangement to reimburse her; personal services business status may limit deductions).' });
  c.flag({ rule: 'dividend needs a resolution and a T5', tx: [divTx], onb: ['declared_dividends'],
    detail: 'Non-eligible dividend of $20,000.00 paid 20 Dec 2025 by e-transfer to the owner. Schedule 3 dividends paid, a T5 for the owner (actual amount 20,000.00) and the directors\' resolution.' });
  c.flag({ rule: 'HST payable at year end (Q4 paid 30 Jan 2026)', onb: ['hst'],
    detail: (fin) => `The Q4 2025 return is paid on 30 Jan 2026, after year end, so ${money(-fin.adj['2050'])} of HST is a current liability in the adjusted trial balance (account 2050).` });

  c.who = 'Priya Nair (Test) owns Maple Ridge Consulting Inc. (Test) alone. It is a one-person IT consulting company. Nearly all revenue is one monthly invoice to Northwind Logistics Inc. (Test); three small clients paid once each. She takes money out as needed, pays some business costs on her own card and works partly from home.';
  c.planted = [
    'Northwind invoice $14,000.00 plus HST every month ($15,820.00 deposited, about the 24th to 29th); other clients: 19 Mar $6,200.00 + HST, 16 Jul $5,900.00 + HST, 22 Oct $6,600.00 + HST.',
    'Owner e-transfers to herself: 12 Feb $4,000.00, 3 Apr $6,500.00, 20 Jun $5,000.00, 15 Aug $7,500.00, 10 Oct $4,000.00. She repays $12,000.00 on 18 Dec. Her note says about $10,000 again in January. No interest.',
    'Non-eligible dividend of $20,000.00 on 20 Dec (a Saturday e-transfer).',
    'Personal card business items: Adobe $659.88, client lunches $86.40 and $124.15, monitor $379.99, train ticket $88.00, conference $450.00.',
    'Meals on the business card: $1,850.00 in total over the year.',
    'Home office: 15% of $2,800.00 monthly rent she pays personally.',
    'HST regular, quarterly. Q4 2024 owing at the start ($5,113.28) is paid 31 Jan 2025; Q4 2025 is paid 30 Jan 2026, so it is payable at year end.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2019-03-14', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'regular', books_kept_by: 'client (QuickBooks Online with bank feeds)' },
    services: ['t2', 'hst', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 0, payroll_account: false, note: 'The owner takes money as needed; no salary, no source deductions.' },
    hst: { basis: 'regular', frequency: 'quarterly', filings: [{ period: 'Q4 2025', due: '2026-02-02', paid: '2026-01-30' }] },
    home_office: { share_percent: 15, monthly_rent_paid_personally: 2800.0, annual_amount_if_claimed: 5040.0, note: 'Rent is paid from her personal account. The company has never reimbursed her.' },
    vehicle: { business_use_percent: null, note: 'No vehicle owned or leased by the company.' },
    personal_card_business_items: [
      { date: '2025-02-04', merchant: 'Adobe Creative Cloud', amount: 659.88, what_for: 'annual design software plan' },
      { date: '2025-04-16', merchant: 'East Side Mario\'s', amount: 86.4, what_for: 'lunch with a client' },
      { date: '2025-05-22', merchant: 'VIA Rail', amount: 88.0, what_for: 'train to a client meeting' },
      { date: '2025-06-11', merchant: 'Best Buy', amount: 379.99, what_for: 'second monitor for the home office' },
      { date: '2025-09-10', merchant: 'Moxies', amount: 124.15, what_for: 'lunch with a client' },
      { date: '2025-10-21', merchant: 'TechForward Conference (Test)', amount: 450.0, what_for: 'conference ticket' },
    ],
    declared_dividends: [{ declared_on: '2025-12-20', amount: 20000.0, kind: 'non-eligible', resolution_on_file: true }],
    client_notes: [
      'Northwind is my main client. On Northwind days I work in their office, 9 to 5, on their laptop, and they call me a contractor. On other days I work from home.',
      'I take money out of the company when I need it. I put back $12,000 on 18 December. I will probably take about $10,000 again in January.',
      'I pay $2,800 a month rent for my home. About 15% of it is my office.',
      'The $20,000 on 20 December was a dividend.',
      'I put a few business things on my own card by mistake. The list is above.',
    ],
  };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [{ date: '2025-12-20', amount: 20000, designation: 'other than eligible', recipient: priya.name, transaction: divTx }] };
  c.t2.slips = { T4: [], T5: [{ recipient: priya.name, sin: priya.sin, actualAmountOfDividendsOtherThanEligible: 20000, note: 'taxable amount and dividend tax credit are computed by the slip software (Taxprep or T5 tool)' }] };
  c.t2.schedule4 = { note: 'no loss in the year and none brought forward' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.t2.shareholderLoan = { openingBalance: 0, advances: 27000, repaymentsInYear: 12000, businessItemsReimbursed: 1788.42, closingDueFromShareholder: (fin) => D(fin.adj['1300']), interestCharged: 0, repaymentDeadline: '2026-12-31' };
  c.t2.openingUcc = [];
  c.notes.push('Payments to the owner use the same words (E-TRANSFER SENT and her name) for loan advances and for the dividend; only amount, date and the onboarding list tell them apart.');
  c.notes.push('Volumes are modest on purpose: a one-person company.');
  return c;
}

// ---------------------------------------------------------------- 02 Halton Haulage
export function build02() {
  const c = new Client({ num: '02', slug: 'halton-haulage', name: 'Halton Haulage Ltd. (Test)', fyStart: '2025-04-01', fyEnd: '2026-03-31', seed: 1102, hstMethod: 'regular' });
  const marco = c.owner('Marco Bellini (Test)', 100);
  for (const p of ['Transcan Freight Ltd. (Test)', 'Prairie Truck Sales Ltd. (Test)', 'Lakeview Equipment Finance (Test)', 'Graystone Truck Repair (Test)', 'Northern Tire and Axle Ltd. (Test)', 'Blue Coast Truck Wash (Test)', 'Northshore Mutual Insurance (Test)', 'Fleetview Telematics Inc. (Test)', 'Halton Bookkeeping (Test)', 'Plate and Permit Services (Test)', 'Trillium Airways (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'B', tag: 'CHQ', gl: '1010', role: 'bank', last4: '5530', file: 'maplestone-chequing-5530.csv', floor: 900000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '4408', file: 'aurora-business-card-4408.csv' });

  for (let d = '2025-04-04'; d <= c.fyEnd; d = addDays(d, 7)) c.rev('CHQ', d, 'EFT DEPOSIT', 'TRANSCAN FREIGHT TEST LTD SETTLEMENT', c.rng.cents(5200, 6800), '4010');

  // the financed tractor: $18,000.00 plus all the HST from chequing, $100,000.00 financed
  const tractor = c.custom('CHQ', '2025-06-02', 'BANK DRAFT', 'PRAIRIE TRUCK SALES TEST LTD', -3334000,
    [{ gl: '1520', dr: 11800000 }, { gl: '2050', dr: 1534000 }, { gl: '2090', cr: 10000000 }], { kind: 'capital-purchase', notes: 'used tractor $118,000.00 + HST $15,340.00; $100,000.00 paid by the lender straight to the dealer (no bank row)' });
  c.cca('16', { date: '2025-06-02', desc: 'Used tractor unit for hauling freight', cost: 11800000, tx: tractor, note: 'before HST; HST $15,340.00 is claimed as an input tax credit' });
  const loan = loanTable({ principal: 10000000, rate: 0.085, n: 60, first: '2025-07-28' });
  loan.forEach((r) => { r.bankDate = bizInMonth(r.date); });
  const loanTx = [];
  for (const r of loan) if (r.bankDate <= c.fyEnd) loanTx.push(c.custom('CHQ', r.bankDate, 'PRE-AUTH DEBIT', 'LAKEVIEW EQUIPMENT FINANCE TEST', -r.payment, [{ gl: '6070', dr: r.interest }, { gl: '2090', dr: r.principal }], { kind: 'loan-payment', meta: { loan: r } }));

  // CRA instalments and the HST penalty
  const inst = ['2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31'].map((d) => c.bs('CHQ', d, 'CRA', 'CORP TAX INSTALMENT', -350000, '1250', { kind: 'tax-instalment' }));
  const pen = c.exp('CHQ', '2025-08-19', 'CRA', 'GST/HST PENALTY AND INTEREST', 41237, '6210', { tax: 'none', kind: 'penalty' });

  // routine chequing
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 27, amt: 2195 });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 3, amt: 126500 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'FLEETVIEW TELEMATICS TEST INC', day: 10, amt: 8900 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 12, amt: (i, m, r) => 10800 + r.int(0, 900) });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'HALTON BOOKKEEPING TEST', day: 1, amt: 22600 });
  c.exp('CHQ', '2025-06-16', 'PRE-AUTH DEBIT', 'PLATE AND PERMIT SERVICES TEST', 241200, '6080', { tax: 'none' });
  c.routine('CHQ', { gl: '6125', d1: 'ONLINE BILL PAYMENT', merch: ['GRAYSTONE TRUCK REPAIR TEST'], n: [1, 2], amt: [220, 2400] });
  c.routine('CHQ', { gl: '6125', d1: 'ONLINE BILL PAYMENT', merch: ['NORTHERN TIRE AND AXLE TEST LTD'], n: [0, 1], amt: [900, 3800] });
  c.routine('CHQ', { gl: '6190', d1: 'POS PURCHASE', merch: ['BLUE COAST TRUCK WASH TEST'], n: [4, 6], amt: [30, 95] });
  c.routine('CHQ', { gl: '6150', d1: 'POS PURCHASE', merch: ['CANADIAN TIRE #', 'PRINCESS AUTO #', 'HOME DEPOT #', 'STAPLES #'], n: [8, 12], amt: [14, 240] });
  c.routine('CHQ', { gl: '6190', d1: 'POS PURCHASE', merch: ['GREEN P PARKING', 'IMPARK', '407 ETR'], n: [5, 8], amt: [8, 60] });
  // routine card
  c.routine('BCD', { gl: '6190', merch: CH.truckstop, n: [20, 25], amt: [380, 690] });
  c.routine('BCD', { gl: '6190', merch: ['407 ETR'], n: [3, 4], amt: [28, 190] });
  c.routine('BCD', { gl: '6190', merch: ['GREEN P PARKING', 'IMPARK'], n: [2, 4], amt: [8, 35] });
  c.routine('BCD', { gl: '6150', merch: ['CANADIAN TIRE #', 'PRINCESS AUTO #', 'HOME DEPOT #'], n: [5, 8], amt: [14, 240] });
  c.routine('BCD', { gl: '6125', merch: ['GRAYSTONE TRUCK REPAIR TEST'], n: [1, 2], amt: [140, 1900] });
  // personal costs on the business card
  const gAmts = splitTotal(c.rng, 114000, 9, 6000, 19000);
  const gMonths = c.rng.shuffle(c.months).slice(0, 9);
  const groceries = gMonths.map((m, i) => c.exp('BCD', c.pickDates(m, 1)[0], '', locate(c.rng, c.rng.pick(CH.grocery)), gAmts[i], '1300', { tax: 'none', kind: 'personal-on-business-card', tags: ['personal'] }));
  const flight = c.exp('BCD', '2025-12-05', '', 'TRILLIUM AIRWAYS TEST', 164200, '1300', { tax: 'none', kind: 'personal-on-business-card', tags: ['personal'], notes: 'family flight' });

  c.opening['2050'] = -284615;
  c.opening['3010'] = -10000;
  const hstRuns = hstMonthly(c, 'CHQ', 284615);
  c.cardPayments('BCD', 'CHQ', 20);
  const am = amortAje(c, { date: c.fyEnd, items: [{ label: 'used tractor', cost: 11800000, acc: '1521', life: 8, inService: '2025-06-02' }], reason: 'Book amortization for the year on the tractor (straight-line over 8 years from 2 Jun 2025)', tx: [tractor] });

  c.flag({ rule: 'financed tractor: class 16 addition with interest and principal', tx: [tractor, ...loanTx], aje: [am.id], onb: ['loan'],
    detail: 'Used tractor bought 2 Jun 2025 for $118,000.00 plus $15,340.00 HST. Only $33,340.00 left the chequing account; $100,000.00 was financed by Lakeview Equipment Finance (Test) at 8.5% over 60 months with no bank row. Class 16 addition $118,000.00; HST claimed as an input tax credit (June is a refund month). Nine payments from July: split each into interest and principal using the onboarding table; do not expense the whole payment.' });
  c.flag({ rule: 'personal costs on the business card: groceries and a family flight', judgement: true, tx: [...groceries, flight],
    detail: 'Nine grocery charges (about $1,140.00) and a family flight ($1,642.00) are on the business card. Coded to amounts due from the shareholder (1300) until a person decides between shareholder loan, taxable benefit or pay. Not business expenses; no input tax credit.' });
  c.flag({ rule: 'CRA instalments do not agree: bank shows four, CRA credits three', tx: inst, onb: ['cra_record'],
    detail: 'The bank shows four instalments of $3,500.00 (30 Jun, 30 Sep, 31 Dec 2025 and 31 Mar 2026), $14,000.00 in all. CRA\'s record (onboarding) credits three; the 31 Dec 2025 payment is not credited. A person asks the client and CRA to move the credit before instalments are entered on the return.' });
  c.flag({ rule: 'non-deductible penalty on a late HST return', tx: [pen], judgement: true,
    detail: 'CRA charged $412.37 in August 2025 as penalty and interest on a late HST return. Penalty is not deductible: added back on Schedule 1 (the interest part on the same payment: a person confirms). Not an ordinary expense.' });
  c.flag({ rule: 'one customer only: worker status and personal services business signs', judgement: true, onb: ['client_notes'],
    detail: 'All revenue is weekly settlements from Transcan Freight Ltd. (Test), one carrier. The owner drives the tractor. A person looks at whether the arrangement looks like employment (personal services business signs) and whether the company has its own equipment, insurance and risk. The tractor and insurance point to a real business.' });
  c.flag({ rule: 'non-calendar fiscal year end (31 Mar 2026)', severity: 'info', detail: 'The year runs 1 Apr 2025 to 31 Mar 2026. The T2 is due six months after year end (30 Sep 2026); the calendar-year figures a client quotes (T-slips, CRA letters) straddle two fiscal years; instalments fall on 30 Jun, 30 Sep, 31 Dec and 31 Mar.' });
  c.flag({ rule: 'HST payable at year end: March 2026 return (monthly filer)', onb: ['hst'], detail: (fin) => `The March 2026 return is due 30 Apr 2026, after year end; the adjusted trial balance shows ${money(-fin.adj['2050'])} owing (account 2050).` });

  c.who = 'Marco Bellini (Test) owns Halton Haulage Ltd. (Test) alone and drives one tractor for one carrier, Transcan Freight Ltd. (Test), which pays a weekly settlement. He bought a used tractor in June 2025, mostly financed, and uses the business card for fuel and small costs, and sometimes for family costs. He also pays CRA instalments.';
  c.planted = [
    'Weekly settlements from TRANSCAN FREIGHT TEST LTD of $5,200.00 to $6,800.00 plus HST (every Friday, 4 Apr 2025 to 27 Mar 2026); the only customer.',
    () => `Used tractor bought 2 Jun 2025 for $118,000.00 plus $15,340.00 HST: $33,340.00 from chequing (that day), $100,000.00 financed by Lakeview Equipment Finance (Test) at 8.5% over 5 years, monthly payments of ${money(loan[0].payment)} from July (table in onboarding). Class 16.`,
    'Business card: nine grocery charges (about $1,140.00 in all) and a family flight of $1,642.00 (5 Dec 2025).',
    'CRA instalments of $3,500.00 on 30 Jun, 30 Sep, 31 Dec 2025 and 31 Mar 2026; CRA\'s record in onboarding credits only three.',
    'HST late-filing penalty and interest of $412.37 on 19 Aug 2025.',
    'HST regular, monthly; June 2025 is a refund month (tractor tax credit). Year end 31 Mar 2026.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2021-08-09', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'monthly', hst_basis: 'regular', books_kept_by: 'client (spreadsheet, bank downloads)' },
    services: ['t2', 'hst', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 0, payroll_account: false, note: 'The owner drives; no employees.' },
    hst: { basis: 'regular', frequency: 'monthly', note: 'June 2025 return is a refund because of the tractor.' },
    vehicle: { description: 'used tractor unit, bought 2 Jun 2025', business_use_percent: 100, note: 'Client says no personal use.' },
    loan: {
      lender: 'Lakeview Equipment Finance (Test)', principal: 100000.0, annual_rate: 0.085, term_months: 60, first_payment: '2025-07-28', level_payment: D(loan[0].payment),
      note: 'Paid by the lender straight to the dealer on 2 Jun 2025; payments come out of chequing.',
      schedule: loan.map((r) => ({ n: r.n, date: r.bankDate, payment: D(r.payment), interest: D(r.interest), principal: D(r.principal), balance_after: D(r.balance) })),
    },
    cra_record: {
      note: 'What the CRA account shows for corporate instalments in the fiscal year (client printed it after year end).',
      instalments_credited: [{ date: '2025-06-30', amount: 3500.0 }, { date: '2025-09-30', amount: 3500.0 }, { date: '2026-03-31', amount: 3500.0 }],
    },
    client_notes: [
      'Transcan is the only carrier I haul for. I drive the truck myself.',
      'The tractor was financed through Lakeview Equipment Finance; the down payment and the tax came out of the bank.',
      'Sometimes I use the business card at the grocery store. I will tell you which ones.',
      'I paid all four instalments of $3,500 for the year.',
    ],
  };
  c.t2.addBacks = [{ item: 'HST late-filing penalty and interest', amount: 41237, reason: 'penalty is not deductible; the interest part of the same payment is for a person to confirm', tx: [pen], confirm: true }];
  c.t2.slips = { T4: [], T5: [], note: 'No payroll and no dividends in the year.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss in the year' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.t2.openingUcc = [];
  c.t2.instalments = { paidPerBank: 14000, creditedPerCra: 10500, difference: 3500, unmatchedPayment: '2025-12-31' };
  c.hstNote = 'The tractor tax credit ($15,340.00) makes June 2025 a refund month; the refund is deposited in August.';
  c.notes.push('No owner pay, salary or dividend is visible in the year: a person may ask. (Not one of the planted issues.)');
  c.notes.push('Accrued loan interest for the last days of March is not booked (small); a person may add it.');
  return c;
}
