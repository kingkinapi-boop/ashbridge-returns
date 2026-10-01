// Builds the Taxprep import CSV for one sample client from its answer key.
// Node built-ins only. Format settled by the trial (reference/taxprep/day1-findings.md and
// 2026-10-02-day2/notes.md): header `[name|0|0|GUID],"Current Year","Last Year",""`, rows
// `id,"value","",""`, every value quoted, CRLF, Windows-1252, whole dollars only (cents are
// refused by the import), no blank cells (RT-12), no year start or end (RT-13).
// Only GIFI cells with a confirmed identifier are written. Net income (S1) is calculated by
// Taxprep and never imported. Schedules 1, 8 and 50 are not mapped yet and are left out.
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
// A null code (a suspense account awaiting a decision) is kept with the assets.
export function gifiAmounts(key) {
  const s100 = new Map(), s125 = new Map();
  for (const r of key.trialBalance.adjusted.rows) {
    const dr = cents(r.debit), cr = cents(r.credit);
    let v, map;
    if (r.gifi === null || r.gifi < 2600) { map = s100; v = isContra(r) ? cr - dr : dr - cr; }
    else if (r.gifi < 4000) { map = s100; v = cr - dr; }
    else if (r.gifi < 8300) { map = s125; v = cr - dr; }
    else { map = s125; v = dr - cr; }
    map.set(r.gifi, (map.get(r.gifi) || 0) + v);
  }
  return { s100, s125 };
}

// Whole dollars, half away from zero, per code. Then Schedule 100 is kept balanced by
// putting the rounding difference (a few dollars at most) on GIFI 3600 (retained earnings),
// or on the largest liability or equity line if the client has no 3600.
const wholeDollars = (c) => Math.sign(c) * Math.round(Math.abs(c) / 100);
const isAssetCode = (c) => c === null || c < 2600;
export function wholeAmounts(key) {
  const { s100, s125 } = gifiAmounts(key);
  const contra = new Set(key.trialBalance.adjusted.rows.filter(isContra).map((r) => r.gifi));
  const w100 = new Map([...s100].map(([k, v]) => [k, wholeDollars(v)]));
  const w125 = new Map([...s125].map(([k, v]) => [k, wholeDollars(v)]));
  let assets = 0, liabEq = 0, ni = 0;
  for (const [c, v] of w100) {
    if (isAssetCode(c)) assets += contra.has(c) ? -v : v; else liabEq += v;
  }
  for (const [c, v] of w125) ni += c < 8300 ? v : -v;
  const residual = assets - liabEq - ni;
  let plug = null;
  if (residual !== 0) {
    let code = w100.has(3600) ? 3600 : null;
    if (code === null) for (const [c, v] of w100) if (!isAssetCode(c) && (code === null || Math.abs(v) > Math.abs(w100.get(code)))) code = c;
    w100.set(code, w100.get(code) + residual);
    plug = { code, amount: residual };
  }
  return { w100, w125, plug, ni, contra };
}

// Rows for the import: confirmed GIFI cells only, whole dollars, zero omitted (RT-12).
// `info.unmapped` receives the codes with no confirmed cell, `info.plug` the rounding plug.
export function buildRows(key, cells = loadCells(), info = {}) {
  const rows = [], unmapped = [];
  const { w100, w125, plug } = wholeAmounts(key);
  info.plug = plug; info.unmapped = unmapped;
  for (const m of [w100, w125])
    for (const [code, v] of [...m].sort((a, b) => (a[0] ?? 1e9) - (b[0] ?? 1e9))) {
      const cell = code === null ? undefined : cells.gifi.byCode[String(code)];
      if (!cell) { unmapped.push({ code, amount: v }); continue; }
      if (v === 0) continue;
      rows.push({ cell, value: v });
    }
  return rows;
}

// Windows-1252: refuse (never replace) a character outside it.
const CP1252_EXTRA = new Map([[0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x2122, 0x99]]);
export function encodeCp1252(s) {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else if (CP1252_EXTRA.has(c)) out.push(CP1252_EXTRA.get(c));
    else throw new Error(`character U+${c.toString(16)} is outside Windows-1252`);
  }
  return Buffer.from(out);
}

const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

export function toCsv(key, cells = loadCells()) {
  const out = [`[${key.name}|0|0|${cells.header.guid}],"Current Year","Last Year",""`];
  for (const r of buildRows(key, cells)) out.push(`${r.cell},${q(r.value)},"",""`);
  return out.join('\r\n') + '\r\n';
}
export const toCsvBuffer = (key, cells = loadCells()) => encodeCp1252(toCsv(key, cells));
