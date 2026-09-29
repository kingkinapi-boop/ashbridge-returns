// Simulated payroll (made-up deductions in the shape of 2024 and 2025 CPP and EI), loan tables and
// straight-line book amortization. Nothing here is advice; the numbers only need to be consistent.
import { addDays, dnum, monthEnd, prevBiz, bizInMonth, ymd, diffDays, monthKey } from './util.mjs';
import { bankName } from './names.mjs';

const CPP = { 2024: { ex: 350000, ympe: 6850000, ampe: 7320000 }, 2025: { ex: 350000, ympe: 7130000, ampe: 8120000 } };
const EI = { 2024: { rate: 0.0166, mie: 6320000 }, 2025: { rate: 0.0164, mie: 6570000 } };
const CPP_RATE = 0.0595;

// emps: [{ key, name, gl, freq: 'monthly'|'biweekly', anchor, gross: cents | (rng, i) => cents, start?, end?, tips?: (rng) => cents }]
// extra: [{ emp, date, gross, bonus: true }] one-off runs (a bonus)
export function payRuns(rng, emps, from, to, extra = []) {
  const raw = [];
  for (const e of emps) {
    const dates = [];
    if (e.freq === 'monthly') {
      for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) for (let m = 1; m <= 12; m++) {
        const d = prevBiz(monthEnd(ymd(y, m, 1)));
        if (d >= from && d <= to) dates.push(d);
      }
    } else {
      let d = e.anchor; while (d > from) d = addDays(d, -14);
      for (; d <= to; d = addDays(d, 14)) if (d >= from) dates.push(d);
    }
    dates.forEach((d, i) => {
      if ((e.start && d < e.start) || (e.end && d > e.end)) return;
      const gross = typeof e.gross === 'function' ? e.gross(rng, i, d) : e.gross;
      const tips = e.tips ? e.tips(rng, i, d) : 0;
      raw.push({ e, date: d, gross: gross + tips, tips, periods: e.freq === 'monthly' ? 12 : 26, bonus: false });
    });
  }
  for (const x of extra) {
    const e = emps.find((z) => z.key === x.emp);
    raw.push({ e, date: x.date, gross: x.gross, tips: 0, periods: 12, bonus: true });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.e.key.localeCompare(b.e.key));
  const ytd = {};
  const runs = [];
  for (const r of raw) {
    const year = +r.date.slice(0, 4);
    const k = r.e.key + year;
    const y = (ytd[k] ??= { gross: 0, cpp: 0, cpp2: 0, ei: 0 });
    const cp = CPP[year], ei = EI[year];
    const maxBase = Math.round(CPP_RATE * (cp.ympe - cp.ex));
    let cpp = Math.round(Math.max(0, r.gross - cp.ex / r.periods) * CPP_RATE);
    cpp = Math.min(cpp, Math.max(0, maxBase - y.cpp));
    let cpp2 = 0;
    const lo = Math.max(y.gross, cp.ympe), hi = Math.min(y.gross + r.gross, cp.ampe);
    if (hi > lo) cpp2 = Math.round((hi - lo) * 0.04);
    let eiP = Math.min(Math.round(r.gross * ei.rate), Math.max(0, Math.round(ei.rate * ei.mie) - y.ei));
    const annualD = (r.gross * r.periods) / 100;
    const rate = r.bonus ? 0.27 : Math.min(0.3, Math.max(0.06, 0.04 + annualD / 400000));
    const tax = Math.round(r.gross * rate);
    y.gross += r.gross; y.cpp += cpp; y.cpp2 += cpp2; y.ei += eiP;
    runs.push({
      emp: r.e.key, name: r.e.name, gl: r.e.gl, date: r.date, year, gross: r.gross, tips: r.tips, bonus: r.bonus,
      cpp, cpp2, ei: eiP, tax, net: r.gross - cpp - cpp2 - eiP - tax, erCpp: cpp + cpp2, erEi: Math.round(eiP * 1.4),
    });
  }
  return runs;
}

export const remitDate = (mKey, day = 15) => {
  let y = +mKey.slice(0, 4), m = +mKey.slice(5, 7) + 1; if (m > 12) { m = 1; y++; }
  return bizInMonth(ymd(y, m, day));
};

// Post the bank rows for runs and remittances that fall in the client's year; return what onboarding needs.
export function postPayroll(c, acctKey, runs, o = {}) {
  const dep = o.dep ?? 'PAYROLL DEPOSIT';
  const months = {};
  for (const r of runs) {
    const k = monthKey(r.date);
    const m = (months[k] ??= { gross: 0, tips: 0, cpp: 0, ei: 0, tax: 0, erCpp: 0, erEi: 0, runs: 0 });
    m.gross += r.gross; m.tips += r.tips; m.cpp += r.cpp + r.cpp2; m.ei += r.ei; m.tax += r.tax; m.erCpp += r.erCpp; m.erEi += r.erEi; m.runs++;
  }
  const posted = [];
  for (const r of runs) {
    if (r.date < c.fyStart || r.date > c.fyEnd) continue;
    const lines = [{ gl: r.gl, dr: r.gross - r.tips }];
    if (r.tips) lines.push({ gl: '2070', dr: r.tips });
    lines.push({ gl: '6040', dr: r.erCpp + r.erEi });
    lines.push({ gl: '2040', cr: r.cpp + r.cpp2 + r.ei + r.erCpp + r.erEi });
    lines.push({ gl: '2041', cr: r.tax });
    const t = c.custom(acctKey, r.date, dep, bankName(r.name), -r.net, lines, { kind: 'payroll', meta: { payroll: r } });
    posted.push(t);
  }
  let open2040 = 0, open2041 = 0;
  const remits = [];
  for (const [k, m] of Object.entries(months)) {
    const rd = remitDate(k, o.remitDay ?? 15);
    const a = m.cpp + m.ei + m.erCpp + m.erEi, tx = m.tax;
    m.remitDate = rd; m.remittance = a + tx;
    if (rd >= c.fyStart && rd <= c.fyEnd) {
      remits.push(c.custom(acctKey, rd, 'PRE-AUTH DEBIT', 'CRA PAYROLL DEDUCTIONS', -(a + tx), [{ gl: '2040', dr: a }, { gl: '2041', dr: tx }], { kind: 'payroll-remittance' }));
    } else if (rd > c.fyEnd && k <= c.fyEnd.slice(0, 7)) {
      m.owingAtYearEnd = true;
    }
    if (k < c.fyStart.slice(0, 7) && rd >= c.fyStart) { open2040 -= a; open2041 -= tx; m.owingAtYearStart = true; }
  }
  c.opening['2040'] = (c.opening['2040'] ?? 0) + open2040;
  c.opening['2041'] = (c.opening['2041'] ?? 0) + open2041;
  return { posted, remits, months };
}

// T4 figures by calendar year and employee, from every run (including runs outside the fiscal year).
export function t4Data(runs) {
  const out = {};
  for (const r of runs) {
    const y = (out[r.year] ??= {});
    const e = (y[r.emp] ??= { name: r.name, gross: 0, cpp: 0, cpp2: 0, ei: 0, tax: 0, erCpp: 0, erEi: 0, tips: 0 });
    e.gross += r.gross; e.cpp += r.cpp; e.cpp2 += r.cpp2; e.ei += r.ei; e.tax += r.tax; e.erCpp += r.erCpp; e.erEi += r.erEi; e.tips += r.tips;
  }
  return out;
}

// Level-payment loan table: monthly compounding, first payment on `first`, later ones on the same day of the month.
export function loanTable({ principal, rate, n, first, payment = null, count = n }) {
  const r = rate / 12;
  const pay = payment ?? Math.round((principal * r) / (1 - Math.pow(1 + r, -n)));
  const rows = [];
  let bal = principal;
  for (let i = 0; i < count; i++) {
    const interest = Math.round(bal * r);
    let prin = pay - interest;
    if (i === n - 1) prin = bal;
    bal -= prin;
    let y = +first.slice(0, 4), m = +first.slice(5, 7) - 1 + i; y += Math.floor(m / 12); m %= 12;
    const day = Math.min(+first.slice(8, 10), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    rows.push({ n: i + 1, date: ymd(y, m + 1, day), payment: i === n - 1 ? interest + prin : pay, interest, principal: prin, balance: bal });
  }
  return rows;
}

// Straight-line book amortization for the fiscal year (days in service / 365), capped at what is left.
export function slAmort(c, { cost, lifeYears, inService, priorAccum = 0 }) {
  const from = inService > c.fyStart ? inService : c.fyStart;
  const days = diffDays(from, c.fyEnd) + 1;
  const yearDays = diffDays(c.fyStart, c.fyEnd) + 1;
  const full = Math.round((cost / lifeYears) * (Math.min(days, 365) / 365) * (yearDays > 366 ? 1 : 1));
  return Math.max(0, Math.min(full, cost - priorAccum));
}
