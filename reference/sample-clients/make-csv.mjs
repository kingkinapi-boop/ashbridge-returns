// node reference/sample-clients/make-csv.mjs [--check] [--list]
// Writes <nn-name>/taxprep/import.csv for each client from answer-key.json (Windows-1252,
// CRLF), then verifies the files on disk. With --check it only verifies; --list also prints
// the codes left out of each import (no confirmed cell yet).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toCsvBuffer, wholeAmounts, buildRows, loadCells } from './lib/taxprep-csv.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dirs = readdirSync(root).filter((d) => /^\d\d-/.test(d)).sort();
const cells = loadCells();
const check = process.argv.includes('--check');
const list = process.argv.includes('--list');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL', m); } };
const idOf = new Map(Object.entries(cells.gifi.byCode).map(([c, id]) => [id, c]));

for (const d of dirs) {
  const key = JSON.parse(readFileSync(join(root, d, 'answer-key.json'), 'utf8'));
  const file = join(root, d, 'taxprep', 'import.csv');
  if (!check) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, toCsvBuffer(key, cells)); }
  const raw = readFileSync(file);
  const text = raw.toString('latin1');
  ok(!(raw[0] === 0xef && raw[1] === 0xbb), `${d} no BOM`);
  ok(!/[^\r]\n/.test(text) && text.endsWith('\r\n'), `${d} CRLF on every line`);
  const lines = text.split('\r\n').filter(Boolean);
  ok(/^\[.+\|0\|0\|[0-9a-f-]{36}\],"Current Year","Last Year",""$/.test(lines[0]), `${d} header`);
  const map = new Map();
  for (const l of lines.slice(1)) {
    const m = l.match(/^([^,"]+),"(-?\d+)","",""$/);
    ok(!!m, `${d} row shape (id,"whole dollars","",""): ${l}`); // RT-12, whole dollars, quoted
    ok(!/YEAR(START|END)/i.test(l), `${d} no year start or end (RT-13)`);
    if (m) { ok(!map.has(m[1]), `${d} duplicate id ${m[1]}`); map.set(m[1], parseInt(m[2], 10)); ok(idOf.has(m[1]), `${d} unconfirmed id ${m[1]}`); }
  }
  ok(![...map.keys()].some((k) => /^(S1\.|S8\[|S50\[|S100\.|S125\.)/.test(k)), `${d} no guessed ids`);
  // Every mapped GIFI figure is the answer key's figure in whole dollars (plus the plug).
  const { w100, w125, plug, ni, contra } = wholeAmounts(key);
  const info = {}; const rows = buildRows(key, cells, info);
  for (const m of [w100, w125])
    for (const [code, v] of m) {
      const id = cells.gifi.byCode[String(code)];
      if (!id || v === 0) continue;
      ok(map.get(id) === v, `${d} ${id} (GIFI ${code}) expected ${v} got ${map.get(id)}`);
    }
  ok(lines.length - 1 === rows.length, `${d} row count`);
  ok(!plug || Math.abs(plug.amount) <= 20, `${d} rounding plug ${plug && plug.amount} is small`);
  // Schedule 100 balances in cents (the key) and in whole dollars (what we write).
  let assets = 0, liabEq = 0, niC = 0;
  for (const r of key.trialBalance.adjusted.rows) {
    const c = r.gifi, net = Math.round(r.debit * 100) - Math.round(r.credit * 100);
    if (c !== null && c >= 4000) niC -= net; // revenue less expenses = credits less debits
    else if (c === null || c < 2600) assets += net; else liabEq -= net;
  }
  ok(assets === liabEq + niC, `${d} cents schedule 100 balances: assets ${assets} vs ${liabEq + niC}`);
  let wa = 0, wl = 0;
  for (const [c, v] of w100) { if (c === null || c < 2600) wa += contra.has(c) ? -v : v; else wl += v; }
  ok(wa === wl + ni, `${d} whole-dollar schedule 100 balances: assets ${wa} vs ${wl + ni}`);
  ok(Math.abs(ni - key.t2Inputs.netIncomeLossPerBooksBeforeTax) <= 20, `${d} schedule 125 net income ${ni} vs key ${key.t2Inputs.netIncomeLossPerBooksBeforeTax}`);
  ok(map.size > 0, `${d} has GIFI rows`);
  if (list) console.log(d, 'left out (unmapped):', info.unmapped.map((u) => (u.code === null ? 'suspense' : u.code)).join(' ') || 'none', plug ? `plug ${plug.amount} on ${plug.code}` : '');
}
console.log(`${passes} passes, ${fails} failures`);
process.exit(fails ? 1 : 0);
