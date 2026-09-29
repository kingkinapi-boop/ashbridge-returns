import { Client } from '../lib/engine.mjs';
import { bankName, CH } from '../lib/names.mjs';
import { money, dol as D, addDays, bizInMonth, hstOn, sum, dow } from '../lib/util.mjs';
import { hstQuarterly, amortAje, t4Out, payrollMonths } from '../lib/kit.mjs';
import { payRuns, postPayroll, t4Data } from '../lib/payroll.mjs';

// ---------------------------------------------------------------- 03 Bluewater Renovations
export function build03() {
  const c = new Client({ num: '03', slug: 'bluewater-renovations', name: 'Bluewater Renovations Inc. (Test)', fyStart: '2024-07-01', fyEnd: '2025-06-30', seed: 1103, hstMethod: 'regular' });
  const sarah = c.owner('Sarah Kowalski (Test)', 100);
  const devon = c.person('Devon Marsh (Test)'), tyrone = c.person('Tyrone Baptiste (Test)');
  for (const p of ['Sheridan Truck Centre Inc. (Test)', 'Klein Tool and Saw (Test)', 'Marlow Electric Ltd. (Test)', 'Cedarline Plumbing Inc. (Test)', 'Northgate Drywall Ltd. (Test)', 'Brickhouse Masonry (Test)', 'Skyline Roofing Inc. (Test)', 'Truefit Flooring (Test)', 'Paintworks Crew Ltd. (Test)', 'Lumberline Building Supply Ltd. (Test)', 'Tile and Stone Depot (Test)', 'Bluewater Industrial Park (Test)', 'Northshore Mutual Insurance (Test)', 'Cedarbridge Accounting Inc. (Test)']) c.party(p, 'company');
  c.account('CHQ', { kind: 'C', tag: 'CHQ', gl: '1010', role: 'bank', last4: '2287', file: 'harbourline-chequing-2287.csv', floor: 250000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '9034', file: 'aurora-business-card-9034.csv' });

  // customers pay in three steps: 30% at the start, 40% in the middle, 30% at the end
  const names = ['Gordon Achterberg', 'Fatima Qureshi', 'Liam Oakley', 'Sofia Marchetti', 'Harold Bright', 'Yuki Tanaka', 'Ravi Subramanian', 'Beth Callahan', 'Marcus Delacroix', 'Ines Pereira', 'Colin Fraser', 'Deepa Malhotra', 'Terrence Boyd', 'Alicia Romero', 'Stefan Novak', 'Naomi Whitfield'];
  names.forEach((n, i) => {
    const nm = `${n} (Test)`; c.person(nm);
    if (i === 15) return; // Naomi's deposit is separate, below
    const total = c.rng.int(22, 88) * 1000, start = addDays(c.fyStart, c.rng.int(0, 235));
    const plan = [[0, 0.3], [c.rng.int(21, 35), 0.4], [c.rng.int(50, 84), 0.3]];
    for (const [off, share] of plan) {
      let d = addDays(start, off); if (d > '2025-06-06') d = addDays('2025-06-06', -c.rng.int(0, 24));
      c.rev('CHQ', bizInMonth(d), 'E-TRANSFER RECEIVED', bankName(nm), Math.round(total * share) * 100, '4010');
    }
  });
  const dep = c.custom('CHQ', '2025-06-10', 'E-TRANSFER RECEIVED', bankName('Naomi Whitfield (Test)'), 1500000, [{ gl: '2060', cr: 1327434 }, { gl: '2050', cr: 172566 }], { kind: 'customer-deposit', notes: 'deposit for a kitchen job that starts in August 2025; $15,000.00 including HST' });

  // capital purchases
  const truck = c.custom('CHQ', '2024-09-16', 'BANK DRAFT', 'SHERIDAN TRUCK CENTRE TEST INC', -6554000, [{ gl: '1520', dr: 5800000 }, { gl: '2050', dr: 754000 }], { kind: 'capital-purchase', notes: 'pickup truck bought Sunday 15 Sep 2024, paid Monday 16 Sep: $58,000.00 plus HST $7,540.00' });
  c.cca('10', { date: '2024-09-15', desc: 'Pickup truck', cost: 5800000, tx: truck, note: 'before HST; bank row is the next business day' });
  const saw = c.exp('CHQ', '2025-02-14', 'POS PURCHASE', 'KLEIN TOOL AND SAW TEST', 259900, '1530', { capital: true, kind: 'capital-purchase' });
  c.cca('8', { date: '2025-02-14', desc: 'Table saw', cost: 230000, tx: saw, note: 'before HST' });

  // payroll: owner monthly, two employees every two weeks; remittances monthly; runs cover both calendar years
  const emps = [
    { key: 'sarah', name: sarah.name, gl: '6131', freq: 'monthly', gross: 550000 },
    { key: 'devon', name: devon.name, gl: '5030', freq: 'biweekly', anchor: '2024-01-05', gross: (rng) => rng.int(72, 84) * 2750 },
    { key: 'tyrone', name: tyrone.name, gl: '5030', freq: 'biweekly', anchor: '2024-01-05', gross: (rng) => rng.int(70, 84) * 3100 },
  ];
  const runs = payRuns(c.rng, emps, '2024-01-01', '2025-12-31', [{ emp: 'sarah', date: '2025-12-28', gross: 2500000 }]);
  const pay = postPayroll(c, 'CHQ', runs);
  const t4o = t4Out(c, t4Data(runs), [2024, 2025]);
  for (const d of ['2024-07-31', '2024-10-31', '2025-01-31', '2025-04-30']) c.exp('CHQ', d, 'PRE-AUTH DEBIT', 'WSIB PREMIUM', c.rng.cents(1620, 1940), '6045', { tax: 'none' });

  // routine spending
  const SUBS = ['MARLOW ELECTRIC TEST LTD', 'CEDARLINE PLUMBING TEST INC', 'NORTHGATE DRYWALL TEST LTD', 'BRICKHOUSE MASONRY TEST', 'SKYLINE ROOFING TEST INC', 'TRUEFIT FLOORING TEST', 'PAINTWORKS TEST CREW LTD'];
  c.routine('CHQ', { gl: '5040', d1: 'E-TRANSFER SENT', merch: SUBS, n: [4, 7], amt: [800, 7500] });
  c.routine('CHQ', { gl: '5020', d1: 'POS PURCHASE', merch: ['HOME DEPOT #', 'RONA #', 'LUMBERLINE BUILDING SUPPLY TEST LTD', 'TILE AND STONE DEPOT TEST'], n: [10, 15], amt: [60, 2600] });
  c.monthly('CHQ', { gl: '6110', d1: 'PRE-AUTH DEBIT', d2: 'BLUEWATER INDUSTRIAL PARK TEST', day: 1, amt: 271200 });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 5, amt: 41200 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'ROGERS', day: 9, amt: (i, m, r) => 14000 + r.int(0, 1800) });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'CEDARBRIDGE ACCOUNTING TEST INC', day: 3, amt: 20340 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'INTUIT *QUICKBOOKS', day: 20, amt: 3500 });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 2995 });
  c.routine('BCD', { gl: '6190', merch: CH.fuel, n: [10, 14], amt: [55, 130] });
  c.routine('BCD', { gl: '6150', merch: ['CANADIAN TIRE #', 'PRINCESS AUTO #', 'HOME DEPOT #', 'RONA #'], n: [6, 10], amt: [12, 380] });
  c.routine('BCD', { gl: '6020', tax: 'meal', merch: [...CH.coffee, ...CH.lunch], n: [14, 20], amt: [6, 34] });
  c.routine('BCD', { gl: '6190', merch: ['GREEN P PARKING', 'IMPARK'], n: [3, 5], amt: [8, 30] });
  c.monthly('BCD', { gl: '6155', d2: 'GOOGLE *WORKSPACE', day: 11, amt: 936 });
  c.monthly('BCD', { gl: '6155', d2: 'ZOOM.US', day: 13, amt: 1695 });

  c.opening['1530'] = 2460000; c.opening['1531'] = -1230000; c.opening['2050'] = -941255; c.opening['3010'] = -10000;
  hstQuarterly(c, 'CHQ', 941255);
  c.cardPayments('BCD', 'CHQ', 20);
  const ajeBonus = c.aje({ date: '2025-06-30', lines: [{ gl: '6132', dr: 2500000 }, { gl: '2035', cr: 2500000 }], reason: 'Owner bonus of $25,000.00 declared by resolution on 30 Jun 2025: accrued at year end; paid 28 Dec 2025', onb: ['owner_bonus'] });
  const am = amortAje(c, { date: c.fyEnd, tx: [truck, saw], reason: 'Book amortization for the year (straight-line, 5 years)', items: [
    { label: 'shop equipment brought forward', cost: 2460000, acc: '1531', life: 5, inService: '2020-01-01', prior: 1230000 },
    { label: 'pickup truck', cost: 5800000, acc: '1521', life: 5, inService: '2024-09-15' },
    { label: 'table saw', cost: 230000, acc: '1531', life: 5, inService: '2025-02-14' }] });

  c.flag({ rule: 'bonus paid after day 179', tx: [], aje: [ajeBonus], onb: ['owner_bonus'],
    detail: 'Bonus of $25,000.00 declared at 30 Jun 2025 and paid 28 Dec 2025, which is day 181 after year end; the rule needs payment by day 179 (26 Dec 2025). The accrued expense is not deductible in this year: Schedule 1 add-back $25,000.00; deductible in the year it was paid. It is on the owner\'s 2025 T4.' });
  c.flag({ rule: 'customer deposit for a job after year end is not revenue', tx: [dep],
    detail: 'The $15,000.00 received 10 Jun 2025 (HST included) is for a job that starts in August: deferred income (2060) of $13,274.34 and HST of $1,725.66, not sales.' });
  c.flag({ rule: 'payroll against T4 summaries across two calendar years', onb: ['payroll'], tx: pay.remits,
    detail: 'The fiscal year (1 Jul 2024 to 30 Jun 2025) spans calendar 2024 and 2025. Payroll by month and both T4 summaries are in onboarding; the books hold only the months inside the year, so calendar 2024 includes Jan to Jun 2024 (last year) and calendar 2025 includes Jul to Dec 2025 (next year, and the bonus). Source deductions are remitted on the 15th of the next month; June 2025 deductions are still owing at year end.' });
  c.flag({ rule: 'CCA additions in classes 10 and 8', tx: [truck, saw], detail: 'Pickup truck $58,000.00 (class 10, acquired 15 Sep 2024) and table saw $2,300.00 (class 8, 14 Feb 2025), both before HST.' });
  c.flag({ rule: 'subcontractor payments: slip and status checks', judgement: true, severity: 'info', detail: 'Payments to subcontractors (about a third of costs): a person confirms which are individuals (T4A) and whether T5018 statements of contract payments are needed for a construction business, and whether HST numbers and WSIB clearances are held (confirm).' });
  c.flag({ rule: 'WSIB premiums paid quarterly, unpaid quarter not accrued', severity: 'info', detail: 'Four quarterly premiums were paid in the year. The premium for Apr to Jun 2025 (paid after year end) is not accrued; a person may add it.' });

  c.who = 'Sarah Kowalski (Test) owns Bluewater Renovations Inc. (Test) alone. It renovates kitchens and bathrooms for homeowners with two employees, paid every two weeks, and a crew of subcontractors. Sarah is paid a monthly salary and, this year, a bonus. The year runs 1 Jul 2024 to 30 Jun 2025.';
  c.planted = [
    'Payroll: owner salary monthly, two employees every two weeks, source deductions remitted monthly; payroll by month and T4 summaries for calendar 2024 and 2025 are in onboarding.',
    'A $15,000.00 deposit on 10 Jun 2025 for a job starting in August.',
    'Table saw $2,300.00 (class 8, 14 Feb 2025) and a pickup truck bought 15 Sep 2024 for $58,000.00 plus HST (class 10; the bank row is Monday 16 Sep).',
    'Owner bonus of $25,000.00 declared at 30 Jun 2025 and paid 28 Dec 2025 (day 181; the rule needs payment by day 179). The payment is after the year and not in the bank file; it is in onboarding.',
    'WSIB paid quarterly. Subcontractor payments throughout. HST regular, quarterly; the return for the quarter ending 30 Jun 2025 is filed after year end (31 Jul 2025), so that quarter sits in HST payable (receivable) at year end.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2017-06-05', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'regular', books_kept_by: 'client with a part-time bookkeeper' },
    services: ['t2', 'hst', 'payroll', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 2, owner_on_payroll: true, pay: 'owner monthly; two employees every two weeks', workers_comp: 'WSIB, quarterly' },
    hst: { basis: 'regular', frequency: 'quarterly', note: 'The return for the quarter ending 30 Jun 2025 is filed 31 Jul 2025, after year end.' },
    payroll: { note: 'Simulated figures. Runs cover calendar 2024 and 2025; remittances are on the 15th of the following month.', by_month: payrollMonths(pay.months), t4_summaries: t4o.summary },
    owner_bonus: { declared_on: '2025-06-30', amount: 25000.0, paid_on: '2025-12-28', resolution_on_file: true, note: 'Paid by payroll with deductions; on the 2025 T4.' },
    vehicle: { description: 'pickup truck bought 15 Sep 2024', business_use_percent: 100, note: 'Client says work use only.' },
    client_notes: [
      'Sarah: I declared a $25,000 bonus at year end and paid it on 28 December.',
      'A customer paid $15,000 in June for a kitchen we start in August.',
      'The truck is only for the business. I bought a table saw in February.',
      'I pay WSIB every quarter. Most electrical, plumbing and drywall is done by subcontractors.',
    ],
  };
  c.t2.openingUcc = [{ class: '8', ucc: 9840.0, note: 'brought forward from last year, made-up figure' }];
  c.t2.addBacks = [{ item: 'Owner bonus accrued at year end and not paid within 179 days', amount: 2500000, reason: 'paid on day 181; deductible in the year paid', aje: [ajeBonus], onb: ['owner_bonus'] }];
  c.t2.slips = { T4: t4o.slips, T4Summary: t4o.summary, T5: [], note: 'T4 slips are by calendar year, not by fiscal year. Sarah\'s 2025 slip includes the $25,000.00 bonus paid 28 Dec 2025.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss brought forward or created' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.notes.push('Employee names in bank text carry TEST; the T4 slips carry SINs that fail the check digit.');
  return c;
}

// ---------------------------------------------------------------- 04 Lakeshore Eats
export function build04() {
  const c = new Client({ num: '04', slug: 'lakeshore-eats', name: 'Lakeshore Eats Inc. (Test)', fyStart: '2025-01-01', fyEnd: '2025-12-31', seed: 1104, hstMethod: 'quick', quickRate: 0.088 });
  c.owner('Tom Nguyen (Test)', 60); c.owner('Lina Haddad (Test)', 40);
  for (const p of ['Lakeshore Plaza Holdings (Test)', 'Northline Equipment Leasing (Test)', 'Northline Restaurant Equipment Ltd. (Test)', 'Harbour Meat and Fish Ltd. (Test)', 'Primo Produce Inc. (Test)', 'Golden Grain Bakery (Test)', 'Lakeview Food Service Ltd. (Test)', 'Dairy Crest (Test)', 'Spice Route Imports (Test)', 'Kitchen Repair Pros (Test)', 'Frostline Refrigeration (Test)', 'Lakeshore Utilities (Test)', 'Resto POS Systems (Test)', 'Addison Accounting Inc. (Test)', 'Lakeshore Linen (Test)', 'Northshore Mutual Insurance (Test)']) c.party(p, 'company');
  const staff = ['Ayesha Rahman', 'Kevin Doyle', 'Maria Santos', 'Jordan Pike', 'Priyanka Desai', 'Ethan Clarke'].map((n, i) => ({ key: 's' + i, name: `${n} (Test)`, wage: [1720, 1740, 1760, 1800, 1850, 1950][i] }));
  staff.forEach((s) => c.person(s.name));
  c.account('CHQ', { kind: 'A', tag: 'CHQ', gl: '1010', role: 'bank', last4: '6640', file: 'lakeview-chequing-6640.csv', floor: 300000 });
  c.account('BCD', { kind: 'CARD', tag: 'BCD', gl: '2010', role: 'card', last4: '2251', file: 'aurora-business-card-2251.csv' });

  // card sales settle on business days (Monday settles Fri, Sat, Sun); tips ride in the batch
  const daily = { 1: [520, 760], 2: [560, 800], 3: [600, 850], 4: [640, 900], 5: [820, 1250], 6: [980, 1500], 0: [760, 1150] };
  const tipsByDate = {}, qSales = [0, 0, 0, 0], feeByMonth = {}, grossByMonth = {};
  let coll = 0;
  for (let d = c.fyStart; d <= c.fyEnd; d = addDays(d, 1)) {
    const w = dow(d); if (w === 0 || w === 6) continue;
    const covered = w === 1 ? [addDays(d, -3), addDays(d, -2), addDays(d, -1)] : [addDays(d, -1)];
    if (covered.some((x) => x < c.fyStart)) continue;
    const season = +d.slice(5, 7) >= 6 && +d.slice(5, 7) <= 9 ? 1.06 : 0.92;
    let N = 0; for (const x of covered) { const r = daily[dow(x)]; N += Math.round(c.rng.cents(r[0], r[1]) * season); }
    const h = hstOn(N), tips = Math.round(N * (0.055 + c.rng.next() * 0.03)), G = N + h + tips, fee = Math.round(G * 0.026);
    const t = c.custom('CHQ', d, 'DEPOSIT', `MONERIS TEST BATCH ${c.rng.int(100000, 999999)}`, G - fee, [{ gl: '6076', dr: fee }, { gl: '4010', cr: N }, { gl: '2050', cr: h }, { gl: '2070', cr: tips }], { kind: 'card-batch', meta: { parts: { grossIncludingHstAndTips: D(G), sales: D(N), hst: D(h), tips: D(tips), processingFee: D(fee), feeRatePercent: 2.6 } } });
    tipsByDate[d] = tips; qSales[Math.floor((+d.slice(5, 7) - 1) / 3)] += N + h; coll += h;
    const mk = d.slice(0, 7); feeByMonth[mk] = (feeByMonth[mk] ?? 0) + fee; grossByMonth[mk] = (grossByMonth[mk] ?? 0) + G;
  }
  for (let d = '2025-01-07'; d <= c.fyEnd; d = addDays(d, 7)) {
    const N = c.rng.cents(780, 1500), h = hstOn(N);
    c.rev('CHQ', d, 'CASH DEPOSIT', 'BRANCH DEPOSIT', N, '4010', { kind: 'cash-deposit' });
    qSales[Math.floor((+d.slice(5, 7) - 1) / 3)] += N + h; coll += h;
  }

  // kitchen equipment in May: tax credit claimed on capital purchases under the quick method
  const kit = c.custom('CHQ', '2025-05-08', 'ONLINE BILL PAYMENT', 'NORTHLINE RESTAURANT EQUIPMENT TEST LTD', -1638500, [{ gl: '1530', dr: 1450000 }, { gl: '2050', dr: 188500 }], { kind: 'capital-purchase' });
  c.cca('8', { date: '2025-05-08', desc: 'Kitchen equipment (range, hood and prep tables)', cost: 1450000, tx: kit, note: 'before HST; HST $1,885.00 claimed on the quick-method return' });

  // quick-method remittances: rate x tax-included sales for the quarter (capital credit taken in Q2)
  const due = qSales.map((s) => Math.round(s * c.quickRate));
  c.opening['2050'] = -795040;
  const rem = [
    c.bs('CHQ', '2025-01-31', 'CRA', 'GST/HST QUICK METHOD PAYMENT', -795040, '2050', { kind: 'hst-remit', notes: 'pays the fourth-quarter 2024 remittance (opening balance)' }),
    c.bs('CHQ', '2025-04-30', 'CRA', 'GST/HST QUICK METHOD PAYMENT', -due[0], '2050', { kind: 'hst-remit' }),
    c.bs('CHQ', '2025-07-31', 'CRA', 'GST/HST QUICK METHOD PAYMENT', -(due[1] - 188500), '2050', { kind: 'hst-remit', notes: 'net of the $1,885.00 credit on the kitchen equipment' }),
    c.bs('CHQ', '2025-10-31', 'CRA', 'GST/HST QUICK METHOD PAYMENT', -due[2], '2050', { kind: 'hst-remit' }),
  ];
  const excess = coll - due.reduce((a, b) => a + b, 0);
  const ajeQm = c.aje({ date: c.fyEnd, lines: [{ gl: '2050', dr: excess }, { gl: '4300', cr: excess }], confirm: true, tx: rem,
    reason: 'Quick method: HST collected (13/113 of sales) is more than the remittance due (rate x tax-included sales). The difference is the business\'s own income; leave only the fourth-quarter remittance due in HST payable', onb: ['hst'] });

  // payroll: six part-time staff every two weeks, card tips paid out through payroll
  const payDates = []; for (let d = '2024-12-06'; d <= c.fyEnd; d = addDays(d, 14)) payDates.push(d);
  const hrs = {}; for (const d of payDates) { hrs[d] = {}; for (const s of staff) hrs[d][s.key] = c.rng.int(20, 46); }
  const pool = (d) => { let n = 0; for (let k = 0; k < 14; k++) n += tipsByDate[addDays(d, -k)] ?? 0; return n; };
  const emps = staff.map((s) => ({ key: s.key, name: s.name, gl: '6130', freq: 'biweekly', anchor: '2025-01-03',
    gross: (rng, i, d) => hrs[d][s.key] * s.wage,
    tips: (rng, i, d) => Math.round((pool(d) * hrs[d][s.key]) / sum(Object.values(hrs[d]))) }));
  const runs = payRuns(c.rng, emps, '2024-12-01', c.fyEnd);
  const pay = postPayroll(c, 'CHQ', runs);
  const t4o = t4Out(c, t4Data(runs), [2025]);

  // routine spending
  c.monthly('CHQ', { gl: '6110', d1: 'PRE-AUTH DEBIT', d2: 'LAKESHORE PLAZA HOLDINGS TEST', day: 1, amt: 650000 });
  c.monthly('CHQ', { gl: '6115', d1: 'PRE-AUTH DEBIT', d2: 'NORTHLINE EQUIPMENT LEASING TEST', day: 15, amt: 61240 });
  c.monthly('CHQ', { gl: '6180', d1: 'PRE-AUTH DEBIT', d2: 'LAKESHORE UTILITIES TEST', day: 18, amt: (i, m, r) => r.int(82000, 165000) });
  c.monthly('CHQ', { gl: '6060', tax: 'none', d1: 'PRE-AUTH DEBIT', d2: 'NORTHSHORE MUTUAL INSURANCE TEST', day: 6, amt: 48600 });
  c.monthly('CHQ', { gl: '6156', d1: 'PRE-AUTH DEBIT', d2: 'BELL CANADA INTERNET', day: 10, amt: 11999 });
  c.monthly('CHQ', { gl: '6185', d1: 'PRE-AUTH DEBIT', d2: 'TELUS MOBILITY', day: 12, amt: 8600 });
  c.monthly('CHQ', { gl: '6155', d1: 'PRE-AUTH DEBIT', d2: 'RESTO POS SYSTEMS TEST', day: 3, amt: 9040 });
  c.monthly('CHQ', { gl: '6075', tax: 'none', d1: 'MONTHLY ACCOUNT FEE', d2: '', day: 28, amt: 2995 });
  c.monthly('CHQ', { gl: '6100', d1: 'PRE-AUTH DEBIT', d2: 'ADDISON ACCOUNTING TEST INC', day: 2, amt: 33900 });
  c.routine('CHQ', { gl: '5020', d1: 'E-TRANSFER SENT', merch: ['HARBOUR MEAT AND FISH TEST LTD', 'PRIMO PRODUCE TEST INC', 'GOLDEN GRAIN BAKERY TEST', 'LAKEVIEW FOOD SERVICE TEST LTD', 'DAIRY CREST TEST', 'SPICE ROUTE IMPORTS TEST'], n: [20, 26], amt: [50, 380] });
  c.routine('CHQ', { gl: '6120', d1: 'ONLINE BILL PAYMENT', merch: ['KITCHEN REPAIR PROS TEST', 'FROSTLINE REFRIGERATION TEST'], n: [1, 2], amt: [110, 900] });
  c.routine('BCD', { gl: '6150', merch: ['COSTCO WHOLESALE #', 'WALMART SUPERCENTRE #', 'CANADIAN TIRE #', 'DOLLARAMA #', 'STAPLES #', 'AMAZON.CA'], n: [16, 22], amt: [14, 200] });
  c.routine('BCD', { gl: '6010', merch: ['FACEBK *ADS', 'GOOGLE *ADS'], n: [3, 6], amt: [25, 140] });
  c.routine('BCD', { gl: '6150', merch: ['LAKESHORE LINEN TEST'], n: [4, 5], amt: [60, 110] });
  c.routine('BCD', { gl: '6155', merch: ['CANVA', 'ZOOM.US', 'GOOGLE *WORKSPACE'], n: [1, 3], amt: [10, 40] });

  c.opening['1530'] = 6200000; c.opening['1531'] = -2800000; c.opening['3010'] = -20000;
  c.cardPayments('BCD', 'CHQ', 20);
  const am = amortAje(c, { date: c.fyEnd, tx: [kit], reason: 'Book amortization for the year (straight-line, 5 years)', items: [
    { label: 'kitchen equipment brought forward', cost: 6200000, acc: '1531', life: 5, inService: '2021-01-01', prior: 2800000 },
    { label: 'kitchen equipment bought in May', cost: 1450000, acc: '1531', life: 5, inService: '2025-05-08' }] });

  c.flag({ rule: 'HST quick method: rate, line 101 and no input tax credits on costs', judgement: true, aje: [ajeQm], onb: ['hst'],
    detail: (fin) => `Quick method rate used: 8.8% (confirm against CRA; whether a restaurant counts as a service supplier or a retailer decides the rate). Remittance = rate x tax-included sales of the quarter, no credits on expenses, credit on the kitchen equipment only. Sales (account 4010) are ${money(-fin.adj['4010'])} before HST; line 101 must agree. The difference between HST collected and remitted (${money(-fin.adj['4300'])}) is other income (adjusting entry ${ajeQm}).` });
  c.flag({ rule: 'card batches are net of fees and include tips and HST', tx: c.txs.filter((t) => t.kind === 'card-batch').slice(0, 5),
    detail: 'Each MONERIS TEST BATCH deposit is gross sales plus HST plus tips less about 2.6% fees. Gross it up: sales to 4010, HST to 2050, tips to 2070, fees to 6076 (monthly totals of fees are in onboarding). Weekly cash deposits are tax-included sales.' });
  c.flag({ rule: 'payroll with tips: tips paid out through payroll', tx: pay.remits.slice(0, 2), onb: ['payroll'],
    detail: (fin) => `Card tips are held as tips payable and paid out with each biweekly pay (they are part of box 14, CPP and EI apply). Tips payable at year end: ${money(-(fin.adj['2070'] ?? 0))}. Six part-time staff; T4s and the summary are in the answer key and onboarding.` });
  c.flag({ rule: 'two shareholders: Schedule 50', onb: ['owners'], detail: 'Tom Nguyen (Test) 60% and Lina Haddad (Test) 40% of the common shares; both are 10% or more, so both are listed on Schedule 50. Neither is paid through payroll in this file.' });
  c.flag({ rule: 'kitchen equipment: class 8 addition', tx: [kit], detail: 'Equipment bought 8 May 2025 for $14,500.00 plus $1,885.00 HST: class 8 addition $14,500.00; the HST is claimed as a capital credit under the quick method.' });
  c.flag({ rule: 'equipment lease: operating or capital', judgement: true, severity: 'info', detail: 'Monthly equipment lease payments are expensed as rent. A person confirms it is an operating lease (not a purchase in disguise).' });

  c.who = 'Tom Nguyen (Test) 60% and Lina Haddad (Test) 40% own Lakeshore Eats Inc. (Test), a small restaurant. Card sales settle daily into the chequing account through MONERIS TEST BATCH (net of fees, with tips), with weekly cash deposits. Six part-time staff are paid every two weeks with their tips. The company uses the HST quick method.';
  c.planted = [
    'Daily card batches from MONERIS TEST BATCH net of about 2.6% fees (each batch: sales + HST + tips, less the fee); weekly cash deposits (Tuesdays).',
    'HST quick method (rate in onboarding, marked confirm against CRA); remitted quarterly on 30 Apr, 31 Jul and 31 Oct 2025, and 31 Jan 2025 for the fourth quarter of 2024.',
    'Six part-time staff every two weeks, tips paid out with pay.',
    'Two shareholders, 60% and 40%.',
    'Rent $6,500.00 monthly; kitchen equipment $14,500.00 plus HST on 8 May 2025 (class 8); equipment lease $612.40 monthly.',
  ];
  c.onb = {
    corporation: { incorporation_date: '2020-02-18', client_type: 'ccpc', claims_small_business_deduction: 'yes', hst_filing_frequency: 'quarterly', hst_basis: 'quick', books_kept_by: 'part-time bookkeeper' },
    services: ['t2', 'hst', 'payroll', 'bookkeeping'],
    related_entities: [],
    staff: { employees: 6, employment: 'part-time, paid every two weeks; card tips paid out with pay' },
    hst: { basis: 'quick', frequency: 'quarterly', quick_method_rate: { value: 0.088, note: 'confirm against CRA' } },
    payroll: { note: 'Simulated figures.', by_month: payrollMonths(Object.fromEntries(Object.entries(pay.months).filter(([k]) => k >= '2025-01'))), t4_summaries: t4o.summary },
    card_processing_fees_by_month: Object.entries(feeByMonth).sort().map(([month, f]) => ({ month, processing_fees: D(f), gross_card_batches: D(grossByMonth[month]) })),
    client_notes: ['We use the quick method for HST. Card sales come in daily; the deposit is after the fees.', 'Tips go to the staff every second Friday with their pay.', 'Rent is $6,500 a month. We bought a new range and hood in May.'],
  };
  c.t2.openingUcc = [{ class: '8', ucc: 21400.0, note: 'brought forward from last year, made-up figure' }];
  c.t2.slips = { T4: t4o.slips, T4Summary: t4o.summary, T5: [], note: 'No dividends and no owner pay in the year.' };
  c.t2.schedule3 = { dividendsReceived: [], dividendsPaid: [] };
  c.t2.schedule4 = { note: 'no loss' };
  c.t2.schedule23 = { required: false, note: 'no associated corporations' };
  c.hstNote = 'Quick method: HST is collected at 13% but remitted at the quick-method rate; the difference is booked as other revenue by adjusting entry.';
  c.notes.push('Owners take no pay or dividends in this file (routine detail left out).');
  return c;
}
