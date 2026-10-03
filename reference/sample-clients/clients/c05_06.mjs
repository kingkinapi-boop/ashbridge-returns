import { Client, bnFromSeed } from '../lib/engine.mjs';
import { bankName, CH } from '../lib/names.mjs';
import { money, dol as D, addDays, hstOf, dow } from '../lib/util.mjs';
import { hstQuarterly } from '../lib/kit.mjs';

// ---------------------------------------------------------------- 05 Eglinton Holdings
export function build05() {
  const c = new Client({ num: '05', slug: 'eglinton-holdings', name: 'Eglinton Holdings Inc. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1105, hstMethod: 'none' });
  const daniel = c.owner('Daniel Okafor (Test)', 100);
  const retail = 'Eglinton Retail Ltd. (Test)';
  for (const p of [retail, 'Maplegate Banc Corp. (Test)', 'Northern Power Utilities Corp. (Test)', 'Cedarwood Telecom Corp. (Test)', 'Crestview CDN Dividend ETF (Test)', 'Addison Accounting Inc. (Test)', 'Boucher Hall LLP (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'A', tag: 'CHQ', gl: '1010', role: 'bank', last4: '3318', file: 'lakeview-chequing-3318.csv', floor: 1500000 });
  c.account('BRK', { kind: 'BROKER', tag: 'BRK', gl: '1020', role: 'broker', last4: '9051', file: 'crestview-brokerage-9051.csv', floor: 250000 });

  // dividends from the subsidiary
  const div1 = c.bs('CHQ', '2025-06-30', 'DEPOSIT', 'EGLINTON RETAIL LTD TEST DIVIDEND', 6000000, '4210', { kind: 'dividend-received' });
  const div2 = c.bs('CHQ', '2025-12-15', 'DEPOSIT', 'EGLINTON RETAIL LTD TEST DIVIDEND', 4000000, '4210', { kind: 'dividend-received' });
  // dividends paid to the owner
  const capTx = c.bs('CHQ', '2025-11-20', 'E-TRANSFER SENT', bankName(daniel.name), -3000000, '3700', { kind: 'capital-dividend', notes: 'capital dividend of $30,000.00; no election filed (onboarding)' });
  const eligTx = c.bs('CHQ', '2025-12-20', 'E-TRANSFER SENT', bankName(daniel.name), -2500000, '3700', { kind: 'dividend', notes: 'dividend of $25,000.00 designated eligible (onboarding)' });
  // money to and from the brokerage
  c.xfer('CHQ', 'BRK', '2025-02-10', ['TRANSFER TO', 'CRESTVIEW INVESTING TEST'], ['DEPOSIT', 'FROM CHEQUING LAKEVIEW BANK TEST'], 6000000, { kind: 'transfer' });
  c.bs('BRK', '2025-02-12', 'BUY', 'MAPLEGATE BANC TEST CORP', -5890000, '1320', { qty: '1000', kind: 'investment-purchase' });
  c.exp('BRK', '2025-02-12', 'FEE', 'TRADE COMMISSION CRESTVIEW INVESTING TEST', 999, '6230', { tax: 'none' });
  const sell = c.custom('BRK', '2025-09-12', 'SELL', 'CRESTVIEW CDN DIVIDEND ETF TEST', 17500000, [{ gl: '1320', cr: 8500000 }, { gl: '4220', cr: 9000000 }], { qty: '4000', kind: 'investment-sale', notes: 'proceeds $175,000.00, cost $85,000.00, gain $90,000.00' });
  c.exp('BRK', '2025-09-12', 'FEE', 'TRADE COMMISSION CRESTVIEW INVESTING TEST', 999, '6230', { tax: 'none' });
  c.xfer('BRK', 'CHQ', '2025-09-16', ['WITHDRAWAL', 'TO CHEQUING LAKEVIEW BANK TEST'], ['TRANSFER FROM', 'CRESTVIEW INVESTING TEST'], 15000000, { kind: 'transfer' });
  // portfolio dividends (eligible, $11,800.00 a year) and GIC interest ($8,000.00 a year)
  const portfolio = [];
  for (const d of ['2025-03-28', '2025-06-27', '2025-09-26', '2025-12-29']) {
    for (const [sec, amt] of [['MAPLEGATE BANC TEST CORP', 115000], ['NORTHERN POWER UTILITIES TEST CORP', 98000], ['CEDARWOOD TELECOM TEST CORP', 82000]]) portfolio.push(c.bs('BRK', d, 'DIVIDEND', sec, amt, '4210', { kind: 'dividend-received-portfolio' }));
  }
  const gic = ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'].map((d) => c.bs('BRK', d, 'INTEREST', 'GIC LAKEVIEW BANK TEST', 200000, '4200', { kind: 'interest-received' }));
  // small routine costs
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 1695 });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'ADDISON ACCOUNTING TEST INC', day: 2, amt: 35000 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'INTUIT *QUICKBOOKS', day: 20, amt: 3500 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'MICROSOFT*365 MSBILL.INFO', day: 15, amt: 1695 });
  c.monthly('BRK', { gl: '6230', tax: 'none', d1: 'FEE', d2: 'ACCOUNT ADMIN FEE CRESTVIEW INVESTING TEST', day: 27, amt: 495 });
  c.exp('CHQ', '2025-11-12', 'ONLINE BILL PAYMENT', 'BOUCHER HALL LLP TEST', 169500, '6105');
  c.exp('CHQ', '2025-03-10', 'ONLINE BILL PAYMENT', 'ONTARIO ANNUAL RETURN FILING TEST', 5000, '6080', { tax: 'none' });

  c.opening['1310'] = 20000000; c.opening['1320'] = 52000000; c.opening['1340'] = 100000; c.opening['3010'] = -10000;

  c.flag({ rule: 'investment income over $50,000 in the group: business limit reduction', judgement: true, tx: [sell, ...gic], onb: ['business_limit'],
    detail: 'Interest $8,000.00 plus a taxable capital gain of $45,000.00 (half of the $90,000.00 gain on the ETF sale; inclusion rate confirm) is $53,000.00, over the $50,000.00 threshold, before anything Eglinton Retail adds. Portfolio and connected dividends are left out of that sum (confirm). The reduction of the business limit is computed by Taxprep and must be reflected in the Schedule 23 agreement.' });
  c.flag({ rule: 'capital dividend paid with no election filed', judgement: true, tx: [capTx], onb: ['capital_dividend'],
    detail: 'A $30,000.00 capital dividend was paid 20 Nov 2025 and onboarding says no election was filed. A capital dividend is tax-free only with an election made at or before payment. A person decides how to fix it (late election with penalty, or treat as an ordinary dividend) (confirm). It is not reported as an ordinary T5 dividend by the client.' });
  c.flag({ rule: 'eligible dividend designated above GRIP', judgement: true, tx: [eligTx], onb: ['grip', 'declared_dividends'],
    detail: 'The $25,000.00 dividend on 20 Dec 2025 is designated eligible. The client\'s own note gives a general rate income pool of $3,000.00 at the start of the year; eligible dividends received ($11,800.00 from listed shares) may add to it, but the designation looks well above GRIP. Risk of an excessive eligible dividend designation (Schedule 53). A person checks.' });
  c.flag({ rule: 'business limit allocation contradicts Eglinton Retail', judgement: true, onb: ['business_limit'], detail: 'This company\'s onboarding says Holdco keeps $100,000.00 of the business limit. Eglinton Retail Ltd. (Test) allocates the whole $500,000.00 to itself. The two agreements add to $600,000.00. Schedule 23 needs one agreement that adds to no more than the limit. A person asks the client.' });
  c.flag({ rule: 'dividends from a connected corporation', tx: [div1, div2], detail: '$60,000.00 (30 Jun) and $40,000.00 (15 Dec) came from Eglinton Retail Ltd. (Test), a 100% owned subsidiary: Schedule 3, connected. Part IV tax depends on the subsidiary\'s dividend refund (Taxprep, with 06\'s return).' });
  c.flag({ rule: 'capital gain on ETF units', tx: [sell], detail: 'Sold 4,000 ETF units 12 Sep 2025: proceeds $175,000.00, adjusted cost base $85,000.00, gain $90,000.00. Schedule 6. The non-taxable half feeds the capital dividend account; the $30,000.00 capital dividend must fit inside it (Taxprep).' });
  c.flag({ rule: 'not registered for HST', severity: 'info', detail: 'The company is not registered: expenses carry HST inside the cost, no input tax credits. A person confirms it makes no taxable supplies.' });

  c.who = 'Daniel Okafor (Test) owns Eglinton Holdings Inc. (Test), a holding company. It owns 100% of Eglinton Retail Ltd. (Test) (client 06), a portfolio of listed shares and ETF units, and GICs. It receives dividends from the retail company and pays dividends to Daniel.';
  c.planted = [
    'Dividends from 06: $60,000.00 on 30 Jun and $40,000.00 on 15 Dec 2025.',
    'GIC interest $8,000.00 ($2,000.00 each quarter); listed-share dividends $11,800.00 (eligible, $2,950.00 each quarter).',
    'Sale of ETF units on 12 Sep 2025: proceeds $175,000.00, cost $85,000.00.',
    'Capital dividend of $30,000.00 paid 20 Nov 2025 with no election filed (onboarding says so).',
    'Dividend of $25,000.00 on 20 Dec 2025 (a Saturday), designated eligible.',
    'Onboarding says Holdco keeps $100,000.00 of the business limit; 06 allocates the whole $500,000.00 to itself.',
    'Volumes are low on purpose: a holding company has few transactions.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2016-09-02', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: null, hst_basis: null, books_kept_by: 'accountant' },
    services: ['t2', 'bookkeeping'],
    programs: ['corporate_tax'],
    related_entities: [{ entity_role: 'subsidiary', entity_name: retail, ownership_percent: 100, note: 'client 06 in this sample set' }],
    staff: { employees: 0, note: 'No payroll.' },
    hst: { registered: false },
    business_limit: { client_statement: 'Holdco keeps $100,000 of the business limit', allocated_to_this_corporation: 100000, allocated_to_related_corporations: null, note: 'The subsidiary\'s own onboarding allocates all $500,000 to itself.' },
    capital_dividend: { paid_on: '2025-11-20', amount: 30000.0, election_filed: false, note: 'We did not file anything with CRA for this one.' },
    declared_dividends: [{ declared_on: '2025-12-20', amount: 25000.0, kind: 'eligible', designated_eligible: true, resolution_on_file: true }],
    grip: { opening_balance: 3000.0, source: 'client note from last year\'s return, not checked' },
    investments_held: { term_deposits_gic: 200000.0, listed_shares_and_etf_at_cost: 520000.0, investment_in_subsidiary_at_cost: 1000.0 },
    client_notes: ['The retail company paid me two dividends up to Holdco. I paid $30,000 to myself in November as a capital dividend; no forms were filed.', 'On 20 December I took $25,000 as an eligible dividend.', 'Holdco keeps $100,000 of the small business limit.'],
  };
  c.t2.schedule3 = {
    dividendsReceived: [
      { payer: retail, connected: true, amount: 100000, dates: ['2025-06-30', '2025-12-15'], designation: 'as designated by the payer (client says ordinary, not eligible)', transactions: [div1, div2] },
      { payer: 'Maplegate Banc Corp. (Test), Northern Power Utilities Corp. (Test) and Cedarwood Telecom Corp. (Test)', connected: false, amount: 11800, designation: 'eligible', transactions: portfolio },
    ],
    dividendsPaid: [
      { date: '2025-12-20', amount: 25000, designation: 'eligible (designated by the client)', recipient: daniel.name, transaction: eligTx },
      { date: '2025-11-20', amount: 30000, designation: 'capital dividend', electionFiled: false, recipient: daniel.name, transaction: capTx },
    ],
  };
  c.t2.schedule6 = { dispositions: [{ security: 'Crestview CDN Dividend ETF (Test)', date: '2025-09-12', units: 4000, proceeds: 175000, adjustedCostBase: 85000, gain: 90000, transaction: sell }] };
  c.t2.investmentIncomeCheck = { interest: 8000, taxableCapitalGainHalfOfGain: 45000, total: 53000, threshold: 50000, over: true, note: 'arithmetic on the given amounts only; Taxprep computes the reduction (confirm inclusion rate)' };
  c.t2.schedule23 = { required: true, businessLimitToShare: 500000, allocations: [{ corporation: c.name, allocated: 100000, source: 'this onboarding' }, { corporation: retail, allocated: 500000, source: 'the subsidiary onboarding' }], total: 600000, consistent: false };
  c.t2.schedule9 = { relatedCorporations: [{ name: retail, businessNumber: bnFromSeed(1106), ownershipPercent: 100 }] };
  c.t2.slips = { T4: [], T5: [{ recipient: daniel.name, sin: daniel.sin, actualAmountOfEligibleDividends: 25000, note: 'taxable amount and dividend tax credit are computed by the slip software; the capital dividend is not reported as an ordinary dividend' }], T5Received: [{ issuer: 'Crestview Investing (Test)', interestFromCanadianSources: 8000, eligibleDividends: 11800 }] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.deductions = [
    { item: 'Taxable dividends received from taxable Canadian corporations (Schedule 3 to Schedule 1)', amount: 111800, note: 'carried from Schedule 3; Taxprep computes the deduction', confirm: true },
    { item: 'Book gain on the ETF sale (taxed as a capital gain instead)', amount: 90000, note: 'the $90,000.00 gain is in book income (account 4220); the taxable part comes back through Schedule 6', confirm: true },
  ];
  c.t2.addBacks = [{ item: 'Taxable capital gain from Schedule 6', amount: 4500000, reason: 'half of the $90,000.00 gain (inclusion rate: confirm); Taxprep computes it from Schedule 6', tx: [sell], confirm: true }];
  c.notes.push('The brokerage export carries about three rows a month on purpose (a small admin fee each month, dividends, GIC interest, one sale).');
  return c;
}

// ---------------------------------------------------------------- 06 Eglinton Retail
export function build06() {
  const rates = { open: 1.438, '2025-01': 1.44, '2025-02': 1.435, '2025-03': 1.43, '2025-04': 1.405, '2025-05': 1.39, '2025-06': 1.37, '2025-07': 1.375, '2025-08': 1.38, '2025-09': 1.39, '2025-10': 1.4, '2025-11': 1.395, '2025-12': 1.385 };
  const YE = 1.39;
  const c = new Client({ num: '06', slug: 'eglinton-retail', name: 'Eglinton Retail Ltd. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1106, hstMethod: 'regular', rates });
  const holdco = c.owner('Eglinton Holdings Inc. (Test)', 100, { corp: true, bn: bnFromSeed(1105) });
  for (const p of ['Lakehead Homewares Ltd. (Test)', 'Pacific Rim Wholesale Ltd. (Test)', 'Orient Trading Co. (Test)', 'Northgate Fulfilment Inc. (Test)', 'Cedar and Lee Accounting LLP (Test)', 'Northshore Mutual Insurance (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'B', tag: 'CHQ', gl: '1010', role: 'bank', last4: '1176', file: 'maplestone-chequing-cad-1176.csv', floor: 800000 });
  c.account('USD', { kind: 'B', currency: 'USD', tag: 'USD', gl: '1015', role: 'bank', last4: '1183', file: 'maplestone-chequing-usd-1183.csv', opening: 2500000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '5527', file: 'aurora-business-card-5527.csv' });

  // Shopify payouts in CAD (Tuesday and Friday): tax-included sales less processor fees
  for (let d = c.fyStart; d <= c.fyEnd; d = addDays(d, 1)) {
    const w = dow(d);
    if (w === 2 || w === 5) {
      const G = c.rng.cents(4200, 8100), h = hstOf(G), N = G - h, fee = Math.round(G * 0.0295);
      c.custom('CHQ', d, 'DEPOSIT', 'SHOPIFY PAYOUT', G - fee, [{ gl: '6076', dr: fee }, { gl: '4010', cr: N }, { gl: '2050', cr: h }], { kind: 'payout', meta: { parts: { grossIncludingHst: D(G), sales: D(N), hst: D(h), processorFee: D(fee) } } });
    }
    if (w === 1 || w === 4) { // Stripe payouts in USD: zero-rated exports
      const S = c.rng.cents(1400, 2800), fee = Math.round(S * 0.029) + 30, pay = S - fee, r = c.rate(d);
      const payCad = Math.round(pay * r), feeCad = Math.round(fee * r);
      c.custom('USD', d, 'DEPOSIT', 'STRIPE PAYOUT', pay, [{ gl: '6076', dr: feeCad }, { gl: '4020', cr: payCad + feeCad }], { kind: 'payout', meta: { parts: { grossSalesUsd: D(S), processorFeeUsd: D(fee), rate: r, zeroRated: true } } });
    }
  }
  // inventory purchases, in CAD and in USD
  c.routine('CHQ', { gl: '5020', d1: 'ONLINE BILL PAYMENT', merch: ['LAKEHEAD HOMEWARES TEST LTD'], n: [2, 3], amt: [3000, 12000] });
  c.routine('USD', { gl: '5020', tax: 'none', d1: 'WIRE OUT', merch: ['PACIFIC RIM WHOLESALE TEST LTD', 'ORIENT TRADING TEST CO'], n: [2, 3], amt: [2500, 7500] });
  // conversions from the USD account to the CAD account
  for (const m of c.months) {
    const d = c.clampDate(c.accts.CHQ, `${m.key}-25`);
    const usd = c.rng.cents(3000, 5500), cadIn = Math.round(usd * c.rate(d) * 0.9925);
    c.xferFx('USD', 'CHQ', d, usd, cadIn, ['WIRE OUT', 'CONVERT TO CAD MAPLESTONE BANK TEST'], ['DEPOSIT', 'CONVERTED FROM USD MAPLESTONE BANK TEST'], { kind: 'transfer-fx' });
  }
  // dividends to the holding company
  const pay1 = c.bs('CHQ', '2025-06-30', 'TRANSFER TO', 'EGLINTON HOLDINGS INC TEST', -6000000, '3700', { kind: 'dividend' });
  const pay2 = c.bs('CHQ', '2025-12-15', 'TRANSFER TO', 'EGLINTON HOLDINGS INC TEST', -4000000, '3700', { kind: 'dividend' });
  // routine costs
  c.monthly('CHQ', { gl: '6195', d1: 'PRE-AUTH DEBIT', d2: 'NORTHGATE FULFILMENT TEST INC', day: 5, amt: 587600 });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'CEDAR AND LEE ACCOUNTING TEST LLP', day: 3, amt: 50850 });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 8, amt: 38500 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 14, amt: 11800 });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 3995 });
  c.routine('CHQ', { gl: '6195', d1: 'POS PURCHASE', merch: CH.courier, n: [14, 20], amt: [18, 260] });
  c.routine('BCD', { gl: '6010', merch: CH.ads, n: [30, 40], amt: [60, 420] });
  c.routine('BCD', { gl: '6150', merch: ['AMAZON.CA', 'STAPLES #', 'DOLLARAMA #'], n: [4, 7], amt: [30, 300] });
  c.routine('BCD', { gl: '6155', merch: ['KLAVIYO', 'SHOPIFY *APPS', 'CANVA', 'ZOOM.US', 'GOOGLE *WORKSPACE'], n: [3, 5], amt: [10, 60] });
  c.monthly('BCD', { gl: '6155', d2: 'SHOPIFY *SUBSCRIPTION', day: 7, amt: 10500 });
  c.monthly('BCD', { gl: '6155', d2: 'KLAVIYO', day: 21, amt: 22000 });

  c.opening['1150'] = 4200000; c.opening['2050'] = -623410; c.opening['3010'] = -100000;
  hstQuarterly(c, 'CHQ', 623410);
  c.cardPayments('BCD', 'CHQ', 20);
  const ajeInv = c.aje({ type: 'reclass', date: c.fyEnd, onb: ['inventory'],
    lines: [{ gl: '5010', dr: 4200000 }, { gl: '1150', cr: 4200000 }, { gl: '1150', dr: 5150000 }, { gl: '5050', cr: 5150000 }],
    reason: 'Inventory: move the opening inventory ($42,000.00) into cost of sales and record the year-end count ($51,500.00, onboarding); net effect is a $9,500.00 increase in inventory and a lower cost of sales' });
  const usdClose = c.nativeBalance('USD'), carrying = c.glNet('1015'), diff = Math.round(usdClose * YE) - carrying;
  const ajeFx = c.aje({ type: 'estimate', date: c.fyEnd, onb: ['fx'], confirm: true,
    lines: diff >= 0 ? [{ gl: '1015', dr: diff }, { gl: '4310', cr: diff }] : [{ gl: '1015', cr: -diff }, { gl: '4310', dr: -diff }],
    reason: `Revalue the US-dollar account at the year-end rate 1.3900 (a test rate, onboarding): balance USD ${(usdClose / 100).toFixed(2)}; unrealized exchange ${diff >= 0 ? 'gain' : 'loss'}` });

  c.flag({ rule: 'shared business limit set inconsistently with Eglinton Holdings', judgement: true, onb: ['business_limit'], detail: 'Onboarding here allocates the whole $500,000.00 business limit to this company. Eglinton Holdings Inc. (Test) says it keeps $100,000.00. The two add to $600,000.00. One agreement on Schedule 23 is needed (associated corporations). A person asks the owner.' });
  c.flag({ rule: 'zero-rated exports: no HST on US sales', onb: ['sales_channels'], detail: 'About 35% of sales go to US customers through Stripe into the US-dollar account. They are zero-rated exports: no HST collected, and evidence of export is kept. Canadian Shopify sales carry 13% HST.' });
  c.flag({ rule: 'foreign exchange: year-end revaluation at a test rate', judgement: true, aje: [ajeFx], onb: ['fx'], detail: 'US-dollar balance revalued at 1.3900 (marked as a test rate in onboarding). Conversions to CAD show the bank spread as an exchange loss.' });
  c.flag({ rule: 'inventory count: closing $51,500.00 against opening $42,000.00', aje: [ajeInv], onb: ['inventory'], detail: 'The count at year end is $51,500.00. Opening inventory $42,000.00 goes to cost of sales (8300) and the count to closing inventory (8500).' });
  c.flag({ rule: 'dividends to the holding company', tx: [pay1, pay2], onb: ['declared_dividends'], detail: '$60,000.00 on 30 Jun and $40,000.00 on 15 Dec 2025 to Eglinton Holdings Inc. (Test): Schedule 3 dividends paid, designation (client says ordinary), dividend refund and Part IV on the holding company\'s side. No T5 for a corporate shareholder (confirm).' });
  c.flag({ rule: 'payouts are net of processor fees', tx: c.txs.filter((t) => t.kind === 'payout').slice(0, 4), detail: 'Shopify and Stripe payouts are sales (with HST for Shopify) less fees. Gross them up: fees to 6076 (processing fees), sales to 4010 or 4020.' });

  c.who = 'Eglinton Retail Ltd. (Test) is owned 100% by Eglinton Holdings Inc. (Test) (client 05). It sells home goods online: Shopify payouts in CAD twice a week and Stripe payouts in USD (about 35% of sales, US customers). It buys stock from suppliers in both currencies and pays a fulfilment company.';
  c.planted = [
    'Shopify payouts in CAD twice a week (Tuesday and Friday); US customers through Stripe into the USD account (Monday and Thursday), about 35% of sales, zero-rated.',
    'Opening inventory $42,000.00; closing count $51,500.00 (onboarding).',
    'Year-end exchange rate in onboarding (1.3900), marked as a test rate.',
    'Dividends to 05: $60,000.00 on 30 Jun and $40,000.00 on 15 Dec 2025.',
    'Onboarding allocates the whole $500,000 business limit to this company; 05 says it keeps $100,000.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2018-05-14', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'regular', books_kept_by: 'accounting firm (Cedar and Lee)' },
    services: ['t2', 'hst', 'bookkeeping'],
    related_entities: [{ entity_role: 'parent', entity_name: 'Eglinton Holdings Inc. (Test)', ownership_percent: 100, note: 'client 05 in this sample set' }],
    staff: { employees: 0, note: 'Fulfilment is outsourced; no payroll.' },
    hst: { basis: 'regular', frequency: 'quarterly', note: 'Canadian sales taxed at 13%; US sales zero-rated.' },
    business_limit: { allocated_to_this_corporation: 500000, note: 'The whole business limit goes to this company.' },
    inventory: { opening_count_value: 42000.0, closing_count_value: 51500.0, count_date: '2025-12-31', method: 'physical count at cost' },
    fx: { usd_cad_year_end: YE, note: 'test rate, made up', usd_cad_prior_year_end: rates.open },
    sales_channels: [{ channel: 'Shopify store', currency: 'CAD', hst: 'charged 13%' }, { channel: 'Stripe checkout for US customers', currency: 'USD', hst: 'zero-rated export' }],
    declared_dividends: [{ declared_on: '2025-06-30', amount: 60000.0, kind: 'non-eligible', resolution_on_file: true }, { declared_on: '2025-12-15', amount: 40000.0, kind: 'non-eligible', resolution_on_file: true }],
    client_notes: ['Twice a week Shopify sends a payout, and Stripe pays our US sales into the US dollar account.', 'We counted stock on 31 December: $51,500.', 'The whole small business limit should go to this company.'],
  };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [{ date: '2025-06-30', amount: 60000, designation: 'other than eligible', recipient: holdco.name, transaction: pay1 }, { date: '2025-12-15', amount: 40000, designation: 'other than eligible', recipient: holdco.name, transaction: pay2 }] };
  c.t2.schedule9 = { relatedCorporations: [{ name: 'Eglinton Holdings Inc. (Test)', businessNumber: holdco.sin, ownershipPercent: 100 }] };
  c.t2.schedule23 = { required: true, businessLimitToShare: 500000, allocations: [{ corporation: c.name, allocated: 500000, source: 'this onboarding' }, { corporation: 'Eglinton Holdings Inc. (Test)', allocated: 100000, source: 'the holding company onboarding' }], total: 600000, consistent: false };
  c.t2.slips = { T4: [], T5: [], note: 'The only shareholder is a corporation; no T5 (confirm).' };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.openingUcc = [];
  c.notes.push('Import duty and HST paid at the border on inventory are not modelled.');
  c.notes.push('USD rows are in US dollars in the account files and QBO files; the answer key posts them in Canadian dollars at the monthly test rates in the exchange table below.');
  c.notes.push(`Test rates (CAD per USD): ${Object.entries(rates).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(', ')}.`);
  return c;
}
