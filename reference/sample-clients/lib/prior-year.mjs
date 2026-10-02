// The prior-year engine for the sample clients (card W14, fix round 3, amber A307): last year's return is an output of typed inputs,
// never typed figure by figure. Pure functions, no packages. Every amount is integer cents, except gifiStatement (dollars, the answer
// key's convention). Taxable income, tax, balance owing, retained earnings and next year's instalments all come from priorYear().
// CK-11 (retained earnings roll) and CK-15 (Schedule 1: book amortization added back, CCA deducted) are the rules it follows.

// CCA class rates (declining balance) the sample clients use.
const CCA_RATE = { 1: 0.04, 8: 0.2, 10: 0.3, 12: 1, 50: 0.55 };
const bp = (rate) => Math.round(rate * 10000);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
// num / den, half away from zero, in integers (no float drift at the half cent)
const halfAway = (num, den) => (Math.sign(num) * Math.floor((2 * Math.abs(num) + den) / (2 * den))) + 0;
const rateCents = (cents, rate) => halfAway(cents * bp(rate), 10000);
const monthsIncl = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;

// The accelerated investment incentive: 1.5 times the cost for property available for use to the end of 2023, 1.0 for 2024 to 2027,
// the half-year rule before 21 Nov 2018 and after 2027 (or when the asset says half-year).
const firstYearFactor = (rule, date) => (rule === 'half-year' ? 0.5 : date <= '2018-11-20' ? 0.5 : date < '2024-01-01' ? 1.5 : date <= '2027-12-31' ? 1 : 0.5);

// Book amortization per fiscal year, from the year the asset came into use to the prior year's end; straight-line, whole months in
// service ('monthly') or half a year in the first year ('half-year'). Cumulative amounts are rounded, so each year is a difference.
function amortizationOf(asset, fiscalEnd) {
  const y0 = Number(asset.availableForUse.slice(0, 4)), y1 = Number(fiscalEnd.slice(0, 4)), { years, convention } = asset.book;
  const years_ = [];
  let prev = 0;
  for (let y = y0; y <= y1; y++) {
    const end = y === y1 ? fiscalEnd : `${y}-12-31`;
    const k = y - y0 + 1;
    const raw = convention === 'monthly'
      ? Math.round((asset.cost * monthsIncl(asset.availableForUse, `${y}-12-31`)) / (years * 12))
      : Math.round((asset.cost * (2 * k - 1)) / (2 * years));
    const cum = Math.min(asset.cost, raw);
    years_.push({ end, amount: cum - prev });
    prev = cum;
  }
  return { amortizationByYear: years_, accumulated: prev };
}

// Undepreciated capital cost per class: CCA = rate x (opening + first-year factor x additions), at most the UCC, rounded half away from zero.
function uccOf(assets, fiscalEnd) {
  const out = [];
  for (const cls of [...new Set(assets.map((a) => String(a.class)))].sort()) {
    const rate = CCA_RATE[cls];
    if (rate === undefined) throw new Error(`no CCA rate held for class ${cls}`);
    const mine = assets.filter((a) => String(a.class) === cls);
    const y0 = Math.min(...mine.map((a) => Number(a.availableForUse.slice(0, 4)))), y1 = Number(fiscalEnd.slice(0, 4));
    const years = [];
    let opening = 0;
    for (let y = y0; y <= y1; y++) {
      const adds = mine.filter((a) => Number(a.availableForUse.slice(0, 4)) === y);
      const additions = sum(adds.map((a) => a.cost));
      // everything doubled so the half-year factor stays whole
      const base2 = 2 * opening + sum(adds.map((a) => 2 * firstYearFactor(a.cca.firstYear, a.availableForUse) * a.cost));
      const cca = Math.min(halfAway(base2 * bp(rate), 20000), opening + additions);
      const closing = opening + additions - cca;
      years.push({ end: y === y1 ? fiscalEnd : `${y}-12-31`, opening, additions, cca, closing });
      opening = closing;
    }
    out.push({ class: cls, rate, years, closing: opening });
  }
  return out;
}

export function priorYear(inputs) {
  const { fiscalYear, retainedEarningsOpening, netIncomeBeforeTax, dividends, instalmentsPaid, rates, assets: inAssets = [] } = inputs;
  const otherAddBacks = inputs.otherAddBacks ?? 0;
  const assets = inAssets.map((a) => amortizationOf(a, fiscalYear.end));
  const ucc = uccOf(inAssets, fiscalYear.end);
  const atEnd = (end) => (y) => y.end === end;
  const schedule1 = {
    amortization: sum(assets.map((a) => a.amortizationByYear.find(atEnd(fiscalYear.end))?.amount ?? 0)),
    otherAddBacks,
    cca: sum(ucc.map((u) => u.years.find(atEnd(fiscalYear.end))?.cca ?? 0)),
  };
  const x = netIncomeBeforeTax + schedule1.amortization + schedule1.otherAddBacks - schedule1.cca;
  const taxableIncome = Math.max(0, x), nonCapitalLoss = Math.max(0, -x);
  const federalTax = rateCents(taxableIncome, rates.federal), ontarioTax = rateCents(taxableIncome, rates.ontario);
  const incomeTax = federalTax + ontarioTax;
  // four instalments in whole cents summing to the tax (the earlier ones carry the odd cents), none at $3,000 or less
  const q = Math.floor(incomeTax / 4), odd = incomeTax - 4 * q;
  const nextYearInstalments = incomeTax > 300000 ? [0, 1, 2, 3].map((i) => q + (i < odd ? 1 : 0)) : [];
  return {
    schedule1, taxableIncome, nonCapitalLoss, federalTax, ontarioTax, incomeTax,
    netIncomeAfterTax: netIncomeBeforeTax - incomeTax,
    retainedEarnings: { opening: retainedEarningsOpening, dividends, closing: retainedEarningsOpening + netIncomeBeforeTax - incomeTax - dividends },
    instalmentsPaid, balanceOwing: incomeTax - instalmentsPaid,
    nextYearInstalments, assets, ucc,
  };
}

// One row per GIFI code, ascending: the account rows' net by code, on one side, in dollars, the total kept to the cent.
export function gifiStatement(rows) {
  const cents = (x) => Math.round(x * 100);
  const byCode = new Map();
  for (const r of rows) {
    const e = byCode.get(r.gifi) ?? { gifiName: r.gifiName, net: 0 };
    e.net += cents(r.debit) - cents(r.credit);
    byCode.set(r.gifi, e);
  }
  return [...byCode].filter(([, e]) => e.net !== 0).sort((a, b) => a[0] - b[0])
    .map(([gifi, e]) => ({ gifi, gifiName: e.gifiName, debit: e.net > 0 ? e.net / 100 : 0, credit: e.net < 0 ? -e.net / 100 : 0 }));
}
