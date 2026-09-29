// Reusable client steps: HST returns paid from the books, book amortization, prepaid expenses, shared text.
import { addDays, ymd, monthEnd, prevBiz, bizInMonth, diffDays, longDate, monthKey, monthList, fmt, dol as D } from './util.mjs';
import { slAmort } from './payroll.mjs';

const lastOfNext = (iso) => { let y = +iso.slice(0, 4), m = +iso.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return prevBiz(monthEnd(ymd(y, m, 1))); };

// Calendar-quarter HST filer: pay (or receive) the net for each quarter by the end of the next month.
export function hstQuarterly(c, key, openingPayable = 0, { d1 = 'CRA', d2 = 'GST/HST PAYMENT' } = {}) {
  const prevEnd = addDays(c.fyStart, -1);
  if (openingPayable > 0) {
    const pay = lastOfNext(prevEnd);
    if (pay >= c.fyStart && pay <= c.fyEnd) c.bs(key, pay, d1, d2, -openingPayable, '2050', { kind: 'hst-remit', notes: 'pays the HST owing at the start of the year (opening balance)' });
  }
  const out = [];
  for (const m of c.months) {
    if (![3, 6, 9, 12].includes(m.m)) continue;
    const to = monthEnd(m.first), from = ymd(m.y, m.m - 2, 1);
    const pay = lastOfNext(to);
    const net = c.hstNet(from < c.fyStart ? c.fyStart : from, to);
    out.push({ from, to, pay, net });
    if (pay > c.fyEnd) continue;
    if (net > 0) c.bs(key, pay, d1, d2, -net, '2050', { kind: 'hst-remit' });
    else if (net < 0) c.bs(key, pay, d1, 'GST/HST REFUND', -net, '2050', { kind: 'hst-refund' });
  }
  return out;
}
// Monthly HST filer.
export function hstMonthly(c, key, openingPayable = 0, refundDelay = 27) {
  const prevEnd = addDays(c.fyStart, -1);
  if (openingPayable > 0) {
    const pay = lastOfNext(prevEnd);
    if (pay >= c.fyStart && pay <= c.fyEnd) c.bs(key, pay, 'CRA', 'GST/HST PAYMENT', -openingPayable, '2050', { kind: 'hst-remit', notes: 'pays the HST owing at the start of the year (opening balance)' });
  }
  const out = [];
  for (const m of c.months) {
    const net = c.hstNet(m.first, m.last);
    const pay = lastOfNext(m.last);
    out.push({ month: m.key, pay, net });
    if (pay > c.fyEnd) continue;
    if (net > 0) c.bs(key, pay, 'CRA', 'GST/HST PAYMENT', -net, '2050', { kind: 'hst-remit' });
    else if (net < 0) { const d = bizInMonth(addDays(pay, refundDelay - 1)); if (d <= c.fyEnd) c.bs(key, d, 'CRA', 'GST/HST REFUND', -net, '2050', { kind: 'hst-refund' }); }
  }
  return out;
}

// One adjusting entry for book amortization. items: [{ label, cost, acc, life, inService, prior }]
export function amortAje(c, { date, items, reason, tx = [], onb = [], confirm = false }) {
  const parts = items.map((i) => ({ ...i, amount: slAmort(c, { cost: i.cost, lifeYears: i.life, inService: i.inService ?? c.fyStart, priorAccum: i.prior ?? 0 }) })).filter((p) => p.amount > 0);
  const total = parts.reduce((s, p) => s + p.amount, 0);
  const cr = {};
  for (const p of parts) cr[p.acc] = (cr[p.acc] ?? 0) + p.amount;
  const id = c.aje({
    date, reason, tx, onb, confirm,
    note: 'straight-line book amortization: ' + parts.map((p) => `${p.label} ${fmt(p.amount)} (${p.life} years)`).join('; '),
    lines: [{ gl: '6050', dr: total }, ...Object.entries(cr).map(([gl, v]) => ({ gl, cr: v }))],
  });
  return { id, total, parts };
}

// Insurance paid up front for `months` from `start`: release the opening prepaid, then set up what is unexpired at year end.
export function prepaidInsurance(c, { paidTx, premium, start, months, openingPrepaid = 0, openingNote = '' }) {
  const ids = [];
  if (openingPrepaid > 0) {
    ids.push(c.aje({ date: c.fyEnd, reason: 'Release the prepaid insurance brought forward from last year: the old policy has expired', onb: ['prior_year_closing_balances (1200 Prepaid expenses)'], note: openingNote,
      lines: [{ gl: '6060', dr: openingPrepaid }, { gl: '1200', cr: openingPrepaid }] }));
  }
  const used = Math.min(months, Math.max(0, Math.round(diffDays(start, c.fyEnd) / 30.4375)));
  const days = diffDays(start, c.fyEnd) + 1, total = diffDays(start, addDays(start, Math.round(months * 30.4375)));
  const unexpired = Math.round((premium * Math.max(0, months - used)) / months);
  ids.push(c.aje({ date: c.fyEnd, reason: `Prepaid insurance: the policy of ${longDate(start)} covers ${months} months, ${months - used} of them fall after year end`, tx: paidTx, note: `${fmt(premium)} x ${months - used}/${months} = ${fmt(unexpired)}`,
    lines: [{ gl: '1200', dr: unexpired }, { gl: '6060', cr: unexpired }] }));
  return { ids, unexpired };
}
export const dayBefore = (iso) => addDays(iso, -1);
export { monthList };

// Add up lines of an entry by account (a debit and a credit to one account net off).
export function mergeLines(lines) {
  const m = {};
  for (const l of lines) { const x = (m[l.gl] ??= { gl: l.gl, n: 0 }); x.n += (l.dr ?? 0) - (l.cr ?? 0); }
  return Object.values(m).filter((x) => x.n !== 0).map((x) => (x.n > 0 ? { gl: x.gl, dr: x.n } : { gl: x.gl, cr: -x.n }));
}

// T4 slips and the T4 summary from t4Data (cents in, dollars out). years: calendar years to keep.
const MIE = { 2024: 6320000, 2025: 6570000 }, YMPE = { 2024: 6850000, 2025: 7130000 };
export function t4Out(c, t4, years) {
  const slips = [], summary = [];
  for (const [year, emps] of Object.entries(t4)) {
    if (years && !years.includes(+year)) continue;
    const tot = { year: +year, slips: 0, employmentIncome: 0, employeeCpp: 0, employeeSecondCpp: 0, employeeEi: 0, taxDeducted: 0, employerCpp: 0, employerEi: 0 };
    for (const e of Object.values(emps)) {
      slips.push({ year: +year, employee: e.name, sin: c.person(e.name).sin, box14EmploymentIncome: D(e.gross), box16CppContributions: D(e.cpp), box16ASecondAdditionalCpp: D(e.cpp2), box18EiPremiums: D(e.ei), box22IncomeTaxDeducted: D(e.tax), box24EiInsurableEarnings: D(Math.min(e.gross, MIE[year])), box26CppPensionableEarnings: D(Math.min(e.gross, YMPE[year])), employerCpp: D(e.erCpp), employerEi: D(e.erEi), ...(e.tips ? { tipsIncludedInBox14: D(e.tips) } : {}) });
      tot.slips++; tot.employmentIncome += e.gross; tot.employeeCpp += e.cpp; tot.employeeSecondCpp += e.cpp2; tot.employeeEi += e.ei; tot.taxDeducted += e.tax; tot.employerCpp += e.erCpp; tot.employerEi += e.erEi;
    }
    summary.push({ year: tot.year, slips: tot.slips, totalEmploymentIncome: D(tot.employmentIncome), employeeCpp: D(tot.employeeCpp), employeeSecondCpp: D(tot.employeeSecondCpp), employeeEi: D(tot.employeeEi), taxDeducted: D(tot.taxDeducted), employerCpp: D(tot.employerCpp), employerEi: D(tot.employerEi), remittancesDueForTheYear: D(tot.employeeCpp + tot.employeeSecondCpp + tot.employeeEi + tot.taxDeducted + tot.employerCpp + tot.employerEi) });
  }
  return { slips, summary };
}
// payroll by month for onboarding (dollars)
export function payrollMonths(months) {
  return Object.entries(months).sort().map(([month, m]) => ({ month, runs: m.runs, gross: D(m.gross), ...(m.tips ? { tips_included_in_gross: D(m.tips) } : {}), employee_cpp: D(m.cpp), employee_ei: D(m.ei), income_tax: D(m.tax), employer_cpp: D(m.erCpp), employer_ei: D(m.erEi), remittance_due: D(m.remittance), remittance_date: m.remitDate }));
}
