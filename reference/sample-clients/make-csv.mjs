// node reference/sample-clients/make-csv.mjs [--check]
// Writes <nn-name>/taxprep/import.csv for each client from answer-key.json, then verifies
// the files on disk. With --check it only verifies.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toCsv, gifiAmounts, buildRows, loadCells, money } from './lib/taxprep-csv.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dirs = readdirSync(root).filter((d) => /^\d\d-/.test(d)).sort();
const cells = loadCells();
const check = process.argv.includes('--check');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL', m); } };

for (const d of dirs) {
  const key = JSON.parse(readFileSync(join(root, d, 'answer-key.json'), 'utf8'));
  const file = join(root, d, 'taxprep', 'import.csv');
  if (!check) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, toCsv(key, cells)); }
  const lines = readFileSync(file, 'utf8').split('\r\n').filter(Boolean);
  ok(/^\[.+\|.+\|.+\]$/.test(lines[0]), `${d} header`);
  const map = new Map();
  for (const l of lines.slice(1)) {
    const m = l.match(/^([^,]+),(.+)$/);
    ok(!!m && m[2].trim() !== '' && !/,\s*$/.test(l), `${d} no blank cell: ${l}`); // RT-12
    ok(!/YEAR(START|END)/i.test(l), `${d} no year start or end (RT-13)`);
    if (m) map.set(m[1], m[2]);
  }
  // Every GIFI figure in the answer key appears with the same value.
  const { s100, s125 } = gifiAmounts(key);
  for (const [tpl, m] of [[cells.gifi.schedule100.cell, s100], [cells.gifi.schedule125.cell, s125]])
    for (const [code, v] of m) {
      if (v === 0) continue;
      const id = tpl.replace('{code}', code);
      ok(map.get(id) === (v / 100).toFixed(2), `${d} ${id} expected ${(v / 100).toFixed(2)} got ${map.get(id)}`);
    }
  const t = key.t2Inputs;
  ok(map.get(cells.schedule1.netIncomePerBooks.cell) === money(t.netIncomeLossPerBooksBeforeTax), `${d} net income`);
  t.schedule1.addBacks.forEach((a, k) => ok(map.get(`S1.ADD[${k + 1}].AMT`) === money(a.amount), `${d} addback ${k + 1}`));
  t.schedule1.deductions.forEach((a, k) => ok(map.get(`S1.DED[${k + 1}].AMT`) === money(a.amount), `${d} deduction ${k + 1}`));
  const adds = t.schedule8.classes.reduce((s, c) => s + c.additions.reduce((x, a) => x + a.capitalCost, 0), 0);
  let fileAdds = 0;
  for (const [k, v] of map) if (/^S8\[\d+\]\.ADDITIONS$/.test(k)) fileAdds += parseFloat(v);
  ok(Math.abs(fileAdds - adds) < 0.005, `${d} schedule 8 additions ${fileAdds} vs ${adds}`);
  t.schedule50.forEach((s, k) => ok(map.get(`S50[${k + 1}].COMMONPCT`) === money(s.percentCommonShares), `${d} s50 ${k + 1}`));
  ok(lines.length - 1 === buildRows(key, cells).length, `${d} row count`);
  // Schedule 100 balances: assets (contra included in the net) = liabilities + equity + net income per books.
  let assets = 0, liabEq = 0;
  for (const r of key.trialBalance.adjusted.rows) {
    if (r.gifi >= 4000) continue;
    const net = Math.round(r.debit * 100) - Math.round(r.credit * 100);
    if (r.gifi < 2600) assets += net; else liabEq -= net;
  }
  const ni = [...s125].reduce((s, [c, v]) => s + (c < 8300 ? v : -v), 0);
  ok(assets === liabEq + ni, `${d} schedule 100 balances: assets ${assets} vs ${liabEq + ni}`);
  ok(Math.abs(ni / 100 - t.netIncomeLossPerBooksBeforeTax) < 0.005, `${d} schedule 125 net income ${ni / 100} vs key ${t.netIncomeLossPerBooksBeforeTax}`);
  ok([...map.keys()].some((k) => k.startsWith('S100.')), `${d} has S100 rows`);
}
console.log(`${passes} passes, ${fails} failures`);
process.exit(fails ? 1 : 0);
