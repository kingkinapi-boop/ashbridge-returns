// Builds the Taxprep import CSV for one sample client from its answer key.
// Node built-ins only. Follows RT-3 (header, rows, YYYY-MM-DD, FORM[n].CELL),
// RT-12 (no blank cells) and RT-13 (no year start or end). Cell identifiers come from
// taxprep-cells.json and are unconfirmed guesses until trial day 1.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const loadCells = () => JSON.parse(readFileSync(join(here, 'taxprep-cells.json'), 'utf8'));

const cents = (n) => Math.round(n * 100);
export const money = (n) => (cents(n) / 100).toFixed(2);
export const isContra = (r) => /accumulated|allowance/i.test(r.name || '');

// Natural-sign amount in cents per GIFI code: assets debit-less-credit, contra assets
// positive, liabilities and equity credit-less-debit, revenue credit, expenses debit.
export function gifiAmounts(key) {
  const s100 = new Map(), s125 = new Map();
  for (const r of key.trialBalance.adjusted.rows) {
    const dr = cents(r.debit), cr = cents(r.credit);
    let v, map;
    if (r.gifi < 2600) { map = s100; v = isContra(r) ? cr - dr : dr - cr; }
    else if (r.gifi < 4000) { map = s100; v = cr - dr; }
    else if (r.gifi < 8300) { map = s125; v = cr - dr; }
    else { map = s125; v = dr - cr; }
    map.set(r.gifi, (map.get(r.gifi) || 0) + v);
  }
  return { s100, s125 };
}

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

export function buildRows(key, cells = loadCells()) {
  const rows = [];
  const add = (cell, value) => {
    if (value === undefined || value === null || value === '') return; // RT-12
    if (typeof value === 'number' && value === 0) return;
    rows.push({ cell, value });
  };
  const { s100, s125 } = gifiAmounts(key);
  for (const [code, v] of [...s100].sort((a, b) => a[0] - b[0]))
    add(fill(cells.gifi.schedule100.cell, { code }), v / 100);
  for (const [code, v] of [...s125].sort((a, b) => a[0] - b[0]))
    add(fill(cells.gifi.schedule125.cell, { code }), v / 100);

  const t = key.t2Inputs, c1 = cells.schedule1;
  add(c1.netIncomePerBooks.cell, t.netIncomeLossPerBooksBeforeTax);
  t.schedule1.addBacks.forEach((a, k) => {
    add(fill(c1.addBackDescription.cell, { i: k + 1 }), a.item);
    add(fill(c1.addBackAmount.cell, { i: k + 1 }), a.amount);
  });
  t.schedule1.deductions.forEach((a, k) => {
    add(fill(c1.deductionDescription.cell, { i: k + 1 }), a.item);
    add(fill(c1.deductionAmount.cell, { i: k + 1 }), a.amount);
  });

  const c8 = cells.schedule8, byClass = new Map();
  for (const o of t.schedule8.openingUcc) byClass.set(o.class, { open: o.ucc, add: 0 });
  for (const cl of t.schedule8.classes) {
    const e = byClass.get(cl.class) || { open: 0, add: 0 };
    e.add = cl.additions.reduce((s, a) => s + cents(a.capitalCost), 0) / 100;
    byClass.set(cl.class, e);
  }
  [...byClass].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).forEach(([cls, e], k) => {
    const n = k + 1;
    add(fill(c8.class.cell, { n }), cls);
    add(fill(c8.openingUcc.cell, { n }), e.open);
    add(fill(c8.additions.cell, { n }), e.add);
  });

  const c50 = cells.schedule50;
  t.schedule50.forEach((s, k) => {
    const n = k + 1;
    add(fill(c50.name.cell, { n }), s.name);
    add(fill(c50.sin.cell, { n }), s.sin);
    add(fill(c50.businessNumber.cell, { n }), s.businessNumber);
    add(fill(c50.commonPercent.cell, { n }), s.percentCommonShares);
    add(fill(c50.preferredPercent.cell, { n }), s.percentPreferredShares);
  });
  return rows;
}

const q = (s) => (/[",\n|]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const fmt = (v) => (typeof v === 'number' ? money(v) : q(String(v)));

// Two columns only (cell, this year): no prior-year column, so no blank cells (RT-12).
export function toCsv(key, cells = loadCells()) {
  const h = cells.header;
  const out = [`[${key.name}|${h.returnIdPrefix}${key.client}|${h.language}]`];
  for (const r of buildRows(key, cells)) out.push(`${r.cell},${fmt(r.value)}`);
  return out.join('\r\n') + '\r\n';
}
