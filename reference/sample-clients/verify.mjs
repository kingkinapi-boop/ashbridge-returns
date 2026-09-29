#!/usr/bin/env node
// Checks the ten generated sample clients against the README: one PASS or FAIL line per check.
// Usage: node verify.mjs      (run node generate.mjs first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, luhnValid } from './lib/util.mjs';
import { CHAIN_TOKENS, GENERIC_RE } from './lib/names.mjs';
import { GIFI } from './lib/chart.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
let nPass = 0, nFail = 0;
const line = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); ok ? nPass++ : nFail++; };
const K = (num, name, ok, detail = '') => line(!!ok, `${num} ${name}${ok ? (detail ? ` (${detail})` : '') : detail ? `: ${detail}` : ''}`);
const read = (p) => fs.readFileSync(p, 'utf8');
const cents = (s) => Math.round(parseFloat(s) * 100);
const cd = (x) => Math.round(x * 100);
const first = (arr, n = 3) => arr.slice(0, n).join(' | ');

// What the README says about each client (kept apart from the generator on purpose)
const SPEC = {
  '01': { name: 'Maple Ridge Consulting Inc. (Test)', start: '2025-01-01', end: '2025-12-31', layouts: { CHQ: 'A', BCD: 'CARD', PCD: 'CARD' } },
  '02': { name: 'Halton Haulage Ltd. (Test)', start: '2025-04-01', end: '2026-03-31', layouts: { CHQ: 'B', BCD: 'CARD' } },
  '03': { name: 'Bluewater Renovations Inc. (Test)', start: '2024-07-01', end: '2025-06-30', layouts: { CHQ: 'C', BCD: 'CARD' } },
  '04': { name: 'Lakeshore Eats Inc. (Test)', start: '2025-01-01', end: '2025-12-31', layouts: { CHQ: 'A', BCD: 'CARD' } },
  '05': { name: 'Eglinton Holdings Inc. (Test)', start: '2025-01-01', end: '2025-12-31', layouts: { CHQ: 'A', BRK: 'BROKER' } },
  '06': { name: 'Eglinton Retail Ltd. (Test)', start: '2025-01-01', end: '2025-12-31', layouts: { CHQ: 'B', USD: 'B', BCD: 'CARD' } },
  '07': { name: 'Riverdale Rentals Inc. (Test)', start: '2025-01-01', end: '2025-12-31', layouts: { CHQ: 'C' } },
  '08': { name: 'Queen West Design Studio Inc. (Test)', start: '2024-10-01', end: '2025-09-30', layouts: { CHQ: 'A', USD: 'A', BCD: 'CARD', PCD: 'CARD' } },
  '09': { name: 'Scarborough Robotics Labs Inc. (Test)', start: '2025-04-15', end: '2025-12-31', layouts: { CHQ: 'A', BCD: 'CARD' } },
  '10': { name: 'Danforth Cleaning Co. Ltd. (Test)', start: '2025-01-01', end: '2025-12-31', layouts: { CHQ: 'C', BCD: 'CARD' } },
};
// Planted rows: [account, date or null, amount in dollars or null, description pattern, expected count]
const PLANTED = {
  '01': [['CHQ', '2025-02-12', -4000, /PRIYA NAIR TEST/, 1], ['CHQ', '2025-04-03', -6500, /PRIYA NAIR TEST/, 1], ['CHQ', '2025-06-20', -5000, /PRIYA NAIR TEST/, 1], ['CHQ', '2025-08-15', -7500, /PRIYA NAIR TEST/, 1], ['CHQ', '2025-10-10', -4000, /PRIYA NAIR TEST/, 1], ['CHQ', '2025-12-18', 12000, /PRIYA NAIR TEST/, 1], ['CHQ', '2025-12-20', -20000, /PRIYA NAIR TEST/, 1],
    ['CHQ', null, 15820, /NORTHWIND LOGISTICS TEST INC/, 12], ['CHQ', '2025-03-19', 7006, /KESTREL/, 1], ['CHQ', '2025-07-16', 6667, /ONTARIO TRAIL/, 1], ['CHQ', '2025-10-22', 7458, /FERNBANK/, 1],
    ['PCD', '2025-02-04', -659.88, /ADOBE/, 1], ['PCD', '2025-04-16', -86.4, /EAST SIDE MARIOS/, 1], ['PCD', '2025-09-10', -124.15, /MOXIES/, 1], ['PCD', '2025-06-11', -379.99, /BEST BUY/, 1], ['PCD', '2025-05-22', -88, /VIA RAIL/, 1], ['PCD', '2025-10-21', -450, /TECHFORWARD/, 1]],
  '02': [['CHQ', '2025-06-02', -33340, /PRAIRIE TRUCK SALES TEST/, 1], ['CHQ', '2025-06-30', -3500, /CORP TAX INSTALMENT/, 1], ['CHQ', '2025-09-30', -3500, /CORP TAX INSTALMENT/, 1], ['CHQ', '2025-12-31', -3500, /CORP TAX INSTALMENT/, 1], ['CHQ', '2026-03-31', -3500, /CORP TAX INSTALMENT/, 1],
    ['CHQ', '2025-08-19', -412.37, /PENALTY/, 1], ['BCD', '2025-12-05', -1642, /TRILLIUM AIRWAYS TEST/, 1], ['CHQ', null, null, /LAKEVIEW EQUIPMENT FINANCE TEST/, 9], ['CHQ', null, null, /TRANSCAN FREIGHT TEST LTD/, 52]],
  '03': [['CHQ', '2025-06-10', 15000, /NAOMI WHITFIELD TEST/, 1], ['CHQ', '2024-09-16', -65540, /SHERIDAN TRUCK CENTRE TEST/, 1], ['CHQ', '2025-02-14', -2599, /KLEIN TOOL AND SAW TEST/, 1], ['CHQ', null, null, /CRA PAYROLL DEDUCTIONS/, 12], ['CHQ', null, null, /WSIB/, 4]],
  '04': [['CHQ', '2025-05-08', -16385, /NORTHLINE RESTAURANT EQUIPMENT TEST/, 1], ['CHQ', null, null, /BRANCH DEPOSIT/, 52], ['CHQ', null, -6500, /LAKESHORE PLAZA HOLDINGS TEST/, 12]],
  '05': [['CHQ', '2025-06-30', 60000, /EGLINTON RETAIL LTD TEST DIVIDEND/, 1], ['CHQ', '2025-12-15', 40000, /EGLINTON RETAIL LTD TEST DIVIDEND/, 1], ['CHQ', '2025-11-20', -30000, /DANIEL OKAFOR TEST/, 1], ['CHQ', '2025-12-20', -25000, /DANIEL OKAFOR TEST/, 1], ['BRK', '2025-09-12', 175000, /SELL CRESTVIEW CDN DIVIDEND ETF TEST/, 1]],
  '06': [['CHQ', '2025-06-30', -60000, /EGLINTON HOLDINGS INC TEST/, 1], ['CHQ', '2025-12-15', -40000, /EGLINTON HOLDINGS INC TEST/, 1], ['CHQ', null, null, /SHOPIFY PAYOUT/, 104], ['USD', null, null, /STRIPE PAYOUT/, 104]],
  '07': [['CHQ', null, 2100, /KAVYA MENON TEST/, 12], ['CHQ', null, 1950, /OWEN BLACKWOOD TEST/, 11], ['CHQ', '2025-11-12', 975, /OWEN BLACKWOOD TEST/, 1], ['CHQ', null, -2480, /MORTGAGE PAYMENT/, 12], ['CHQ', '2025-10-01', -2160, /NORTHSHORE MUTUAL INSURANCE TEST/, 1], ['CHQ', '2025-05-14', -640, /BLUELINE PLUMBING TEST/, 1], ['CHQ', '2025-08-18', 15000, /GRACE LIU TEST/, 1], ['CHQ', '2025-08-20', -18400, /SUMMIT ROOFING TEST/, 1], ['CHQ', null, null, /MUNICIPAL TAX BILL TEST/, 3]],
  '08': [['BCD', '2024-11-19', -3727.87, /BEST BUY/, 1], ['BCD', '2025-03-11', -2429.5, /BEST BUY/, 1], ['CHQ', '2025-07-01', -1800, /NORTHSHORE MUTUAL INSURANCE TEST/, 1], ['USD', null, 4800, /COBALT AND OAK BRANDS TEST LLC/, 12], ['USD', null, 6200, /REDWOOD LABS TEST INC/, 12], ['BCD', '2025-04-24', -1250, /TRILLIUM AIRWAYS TEST/, 1], ['BCD', '2025-04-27', -1850, /MARQUIS HOTEL AUSTIN TEST/, 1], ['PCD', null, null, /ADOBE \*CREATIVE CLOUD/, 12]],
  '09': [['CHQ', '2025-04-20', 70, /WEI ZHANG TEST/, 1], ['CHQ', '2025-04-20', 30, /OLU ADEYEMI TEST/, 1], ['CHQ', '2025-04-22', 40000, /WEI ZHANG TEST/, 1], ['CHQ', '2025-05-05', 15000, /OLU ADEYEMI TEST/, 1], ['CHQ', '2025-09-10', 25000, /ONTARIO INNOVATION VOUCHER TEST/, 1], ['CHQ', '2025-04-24', -1850, /BOUCHER HALL LLP TEST/, 1], ['CHQ', '2025-11-14', 20340, /HARBOURFRONT ROBOTICS CLIENT TEST INC/, 1], ['CHQ', null, -1200, /WORKBENCH COWORKING TEST INC/, 8], ['BCD', '2025-06-18', -5424, /CIRCUITHOUSE/, 1], ['BCD', '2025-07-08', -2712, /BEST BUY/, 2]],
  '10': [['CHQ', '2025-02-18', -286.55, /PENALTY/, 1], ['CHQ', '2025-10-21', -143.1, /PENALTY/, 1], ['CHQ', '2025-07-07', -1450, /LAKEFRONT KIDS CAMP TEST/, 1], ['CHQ', '2025-03-12', -81360, /PLAINS AUTO GROUP TEST/, 1], ['CHQ', null, -2000, /CARLOS FERREIRA TEST/, 25]],
};
const MUST = {
  '01': [/personal services business/i, /shareholder loan unpaid at year end, repayment deadline 31 Dec 2026/i, /repay then reborrow/i, /meals/i, /home office/i, /dividend/i, /HST payable at year end/i, /personal card/i],
  '02': [/financed tractor/i, /personal costs on the business card/i, /instalments do not agree/i, /penalty/i, /non-calendar/i, /one customer/i],
  '03': [/bonus paid after day 179/i, /customer deposit/i, /payroll against T4/i, /CCA additions/i],
  '04': [/quick method/i, /card batches/i, /tips/i, /two shareholders/i, /kitchen equipment/i],
  '05': [/investment income over \$50,000/i, /capital dividend paid with no election/i, /GRIP/i, /business limit allocation contradicts/i],
  '06': [/shared business limit/i, /zero-rated/i, /foreign exchange/i, /inventory count/i],
  '07': [/specified investment business/i, /roof/i, /prepaid insurance/i, /owner lent/i, /rent arrears/i],
  '08': [/bad debt/i, /prepaid insurance/i, /accrued/i, /owner salary/i, /US clients/i, /software/i, /CCA/i],
  '09': [/short first taxation year/i, /loss/i, /shareholders lending/i, /grant/i, /HST registration/i, /research/i],
  '10': [/missing month/i, /duplicate/i, /mixed in/i, /personal spending/i, /spouse/i, /class 10\.1/i, /late/i],
};

// ---------- parsing ----------
const kindOf = (layout) => (layout.startsWith('A:') ? 'A' : layout.startsWith('B:') ? 'B' : layout.startsWith('C:') ? 'C' : layout.startsWith('Aurora') ? 'CARD' : 'BROKER');
function parseAccount(kind, text) {
  const R = parseCsv(text).filter((r) => !(r.length === 1 && r[0] === ''));
  const head = { A: 1, B: 3, C: 0, CARD: 1, BROKER: 1 }[kind];
  return R.slice(head).map((r, i) => {
    const o = { line: head + i + 1 };
    if (kind === 'A') Object.assign(o, { date: r[0], desc: r[1], amt: r[3] ? cents(r[3]) : -cents(r[2]), bal: cents(r[4]) });
    if (kind === 'B') Object.assign(o, { date: `${r[0].slice(6, 10)}-${r[0].slice(0, 2)}-${r[0].slice(3, 5)}`, desc: `${r[1]} ${r[2]}`.trim(), amt: cents(r[3]) });
    if (kind === 'C') Object.assign(o, { date: `${r[0].slice(6, 10)}-${r[0].slice(3, 5)}-${r[0].slice(0, 2)}`, desc: r[1], amt: r[3] ? cents(r[3]) : -cents(r[2]) });
    if (kind === 'CARD') Object.assign(o, { date: r[0], desc: r[2], amt: -cents(r[3]) });
    if (kind === 'BROKER') Object.assign(o, { date: r[0], desc: `${r[1]} ${r[2]}`.trim(), amt: cents(r[4]), bal: cents(r[5]) });
    o.n = r.length; return o;
  });
}
const parseQbo = (text) => parseCsv(text).filter((r) => !(r.length === 1 && r[0] === '')).slice(1).map((r) => ({ date: `${r[0].slice(6, 10)}-${r[0].slice(3, 5)}-${r[0].slice(0, 2)}`, desc: r[1], amt: cents(r[2]) }));
const monthOf = (d) => d.slice(0, 7);
const allFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// ---------- run ----------
const dirs = fs.readdirSync(root).filter((d) => /^\d\d-/.test(d)).sort();
line(dirs.length === 10 && dirs.map((d) => d.slice(0, 2)).join() === Object.keys(SPEC).sort().join(), `ten client folders 01 to 10 exist (${dirs.join(', ')})`);
const allText = [];

for (const d of dirs) {
  const num = d.slice(0, 2), spec = SPEC[num], dir = path.join(root, d);
  const need = ['profile.md', 'onboarding.json', 'answer-key.json'];
  const missing = need.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) { K(num, 'files exist', false, missing.join(', ')); continue; }
  const key = JSON.parse(read(path.join(dir, 'answer-key.json'))), onb = JSON.parse(read(path.join(dir, 'onboarding.json'))), profile = read(path.join(dir, 'profile.md'));
  const files = allFiles(dir);
  for (const f of files) allText.push([path.relative(root, f), read(f)]);
  const accts = {};
  for (const a of key.accounts) accts[a.key] = { ...a, kind: kindOf(a.layout), rows: parseAccount(kindOf(a.layout), read(path.join(dir, a.file))), qbo: parseQbo(read(path.join(dir, a.qboFile))) };
  const keys = Object.keys(accts);
  K(num, 'account files, QBO files and layouts as the README says', keys.join() === Object.keys(spec.layouts).join() && keys.every((k) => accts[k].kind === spec.layouts[k]) && key.accounts.every((a) => fs.existsSync(path.join(dir, a.qboFile))), keys.map((k) => `${k} ${accts[k].rows.length} rows`).join(', '));
  K(num, 'company name and fiscal year match the README', key.name === spec.name && onb.corporation.legal_name === spec.name && onb.corporation.financial_year_end === spec.end && key.fiscalYear.end === spec.end && key.fiscalYear.start === spec.start && onb.corporation.fiscal_year_start === spec.start, `${spec.start} to ${spec.end}`);

  // dates within the year (client 10 has planted December 2024 rows)
  const outside = keys.flatMap((k) => accts[k].rows.filter((r) => r.date < spec.start || r.date > spec.end).map((r) => `${k} ${r.date}`));
  if (num === '10') K(num, 'all dates in the year except the eight planted December 2024 rows', outside.length === 8 && outside.every((x) => x.includes('2024-12')), `${outside.length} outside`);
  else K(num, 'every date is inside the fiscal year', outside.length === 0, first(outside));
  // every month has rows (client 10 has no May by design; client 09 starts 15 Apr)
  const monthsNeeded = key.statementBalances[keys[0]].map((s) => s.month);
  const emptyMonths = keys.flatMap((k) => monthsNeeded.filter((m) => !accts[k].rows.some((r) => monthOf(r.date) === m)).map((m) => `${k} ${m}`));
  if (num === '10') K(num, 'twelve months per account except the missing May', emptyMonths.join() === 'CHQ 2025-05', emptyMonths.join());
  else K(num, 'twelve months per account (every month has rows)', emptyMonths.length === 0 && monthsNeeded.length === (num === '09' ? 9 : 12), first(emptyMonths) || `${monthsNeeded.length} months`);
  // QBO layout carries the same rows
  K(num, 'QBO files carry the same rows in QBO layout', keys.every((k) => accts[k].qbo.length === accts[k].rows.length && accts[k].qbo.every((q, i) => q.date === accts[k].rows[i].date && q.amt === accts[k].rows[i].amt && q.desc === accts[k].rows[i].desc)));

  // ids and the answer key
  const byLine = new Map(key.transactions.filter((t) => t.line).map((t) => [`${t.acct}:${t.line}`, t]));
  const bad = [];
  for (const k of keys) {
    const cnt = {};
    for (const r of accts[k].rows) {
      const mk = monthOf(r.date); cnt[mk] = (cnt[mk] ?? 0) + 1;
      const id = `${num}-${accts[k].tag}-${mk}-${String(cnt[mk]).padStart(4, '0')}`;
      const e = byLine.get(`${k}:${r.line}`);
      if (!e || e.id !== id || e.date !== r.date || cd(e.amount) !== r.amt || e.description !== r.desc || !e.account) bad.push(`${k} line ${r.line}${e ? ' ' + e.id + ' vs ' + id : ' none'}`);
    }
  }
  K(num, 'every CSV row has an answer-key entry with its id, date, amount and account', bad.length === 0, first(bad));
  const ids = key.transactions.map((t) => t.id);
  K(num, 'ids are unique and every keyed row is in a file (or listed as missing)', new Set(ids).size === ids.length && key.transactions.filter((t) => t.line).length === keys.reduce((s, k) => s + accts[k].rows.length, 0), `${ids.length} entries`);

  // balances roll
  const rollBad = [], planted = [];
  for (const k of keys) {
    const a = accts[k], sgn = a.role === 'card' || a.role === 'pcard' ? -1 : 1;
    const st = key.statementBalances[k];
    if (a.kind === 'A' || a.kind === 'BROKER') {
      let bal = cd(a.openingBalance);
      a.rows.forEach((r) => { bal += r.amt; if (bal !== r.bal) rollBad.push(`${k} line ${r.line} balance ${r.bal} expected ${bal}`); });
    }
    st.forEach((s, i) => {
      const act = a.rows.filter((r) => monthOf(r.date) === s.month).reduce((x, r) => x + r.amt, 0);
      const rolls = cd(s.opening) + sgn * act === cd(s.closing);
      if (rolls !== s.rolls) rollBad.push(`${k} ${s.month} flag says ${s.rolls}`);
      if (!rolls) planted.push(`${k} ${s.month}`);
      if (i > 0 && cd(st[i - 1].closing) !== cd(s.opening)) rollBad.push(`${k} ${s.month} opening differs from the last closing`);
    });
    if (cd(st[0].opening) !== cd(a.openingBalance) || cd(st[st.length - 1].closing) !== cd(a.closingBalance)) rollBad.push(`${k} first opening or last closing`);
  }
  if (num === '10') K(num, 'balances roll every month except the planted faults (March duplicates, missing May)', rollBad.length === 0 && planted.join() === 'CHQ 2025-03,CHQ 2025-05', first(rollBad) || planted.join());
  else K(num, 'every balance rolls month to month (opening + activity = closing, no faults planted)', rollBad.length === 0 && planted.length === 0, first(rollBad) || first(planted));

  const overdrawn = [];
  for (const k of keys) {
    const a = accts[k]; if (a.role === 'card' || a.role === 'pcard' || (num === '10' && k === 'CHQ')) continue;
    let bal = cd(a.openingBalance), min = bal; for (const r of a.rows) { bal += r.amt; if (bal < min) min = bal; }
    if (min < 0) overdrawn.push(`${k} low ${min}`);
  }
  K(num, 'no bank or brokerage account goes overdrawn', overdrawn.length === 0, first(overdrawn));
  // planted rows exist exactly as described
  const pl = [];
  const has = (k, date, amt, re) => accts[k].rows.filter((r) => (!date || r.date === date) && (amt === null || r.amt === cd(amt)) && re.test(r.desc)).length;
  for (const [k, date, amt, re, n] of PLANTED[num] ?? []) { const got = has(k, date, amt, re); if (got !== n) pl.push(`${k} ${date ?? 'any'} ${amt ?? ''} ${re.source.slice(0, 30)} expected ${n} got ${got}`); }
  if (num === '02') { const g = accts.BCD.rows.filter((r) => /LOBLAWS|NO FRILLS|SOBEYS|METRO|FRESHCO|FOOD BASICS|COSTCO WHOLESALE|WALMART SUPERCENTRE|FARM BOY/.test(r.desc)); if (g.length !== 9 || g.reduce((s, r) => s + r.amt, 0) !== -114000) pl.push(`groceries ${g.length} rows`); const t = accts.CHQ.rows.filter((r) => /TRANSCAN/.test(r.desc)); if (t.some((r) => r.amt < cd(5200 * 1.13) - 1 || r.amt > cd(6800 * 1.13) + 1)) pl.push('settlement out of range'); }
  if (num === '05') { const s = (re, k) => accts[k].rows.filter((r) => re.test(r.desc)).reduce((x, r) => x + r.amt, 0); if (s(/^INTEREST GIC/, 'BRK') !== 800000) pl.push('GIC interest not 8000.00'); if (s(/^DIVIDEND /, 'BRK') !== 1180000) pl.push('dividends not 11800.00'); if (onb.capital_dividend?.election_filed !== false) pl.push('capital dividend election flag'); if (!/100,?000/.test(JSON.stringify(onb.business_limit))) pl.push('business limit note'); }
  if (num === '06') { if (onb.inventory?.opening_count_value !== 42000 || onb.inventory?.closing_count_value !== 51500) pl.push('inventory values'); if (!/test rate/i.test(onb.fx?.note ?? '')) pl.push('test rate note'); if (onb.business_limit?.allocated_to_this_corporation !== 500000) pl.push('business limit 500000'); }
  if (num === '04') { if (!/confirm against CRA/.test(JSON.stringify(onb.hst?.quick_method_rate))) pl.push('quick method rate note'); if ((onb.payroll?.t4_summaries?.[0]?.slips ?? 0) !== 6) pl.push('six T4s'); if (accts.CHQ.rows.filter((r) => /MONERIS TEST BATCH/.test(r.desc)).length < 240) pl.push('daily batches'); const b = key.transactions.filter((t) => t.kind === 'card-batch'); const fees = b.reduce((s, t) => s + (t.parts?.processingFee ?? 0), 0), gross = b.reduce((s, t) => s + (t.parts?.grossIncludingHstAndTips ?? 0), 0); if (Math.abs(fees / gross - 0.026) > 0.0006) pl.push('fees are not about 2.6%'); }
  if (num === '03') { const yrs = (onb.payroll?.t4_summaries ?? []).map((x) => x.year).join(); if (yrs !== '2024,2025') pl.push('T4 summaries ' + yrs); if ((onb.payroll?.by_month ?? []).length < 24) pl.push('payroll months'); if (onb.owner_bonus?.paid_on !== '2025-12-28' || onb.owner_bonus?.declared_on !== '2025-06-30' || onb.owner_bonus?.amount !== 25000) pl.push('bonus dates'); }
  if (num === '07') { if (accts.CHQ.rows.some((r) => /OWEN BLACKWOOD/.test(r.desc) && monthOf(r.date) === '2025-10')) pl.push('unit 2 paid in October'); }
  if (num === '08') { const sw = accts.PCD.rows.filter((r) => /ADOBE|FIGMA|NOTION|DROPBOX|SLACK/.test(r.desc)); if (sw.length !== 60) pl.push(`software rows ${sw.length}`); }
  if (num === '09') { if (keys.some((k) => accts[k].rows.some((r) => r.date < '2025-04-15'))) pl.push('row before 15 Apr'); if (key.t2Inputs.taxationYear?.days !== 261) pl.push('261 days'); }
  if (num === '10') {
    if (accts.CHQ.rows.some((r) => monthOf(r.date) === '2025-05')) pl.push('May rows present');
    const seen = new Map(); for (const r of accts.CHQ.rows) { const k2 = `${r.date}|${r.desc}|${r.amt}`; seen.set(k2, (seen.get(k2) ?? 0) + 1); }
    const dups = [...seen.entries()].filter(([, n]) => n > 1); if (dups.length !== 4 || dups.some(([k2, n]) => n !== 2 || !k2.startsWith('2025-03'))) pl.push(`duplicates: ${dups.length} groups`);
    if (accts.CHQ.rows.filter((r) => r.date.startsWith('2024-12')).length !== 8) pl.push('December 2024 rows');
    if (new Set(accts.CHQ.rows.filter((r) => /E-TRANSFER RECEIVED/.test(r.desc) && r.amt > 100000).map((r) => r.desc)).size < 12) pl.push('twelve customers');
    if (key.accounts.find((a) => a.key === 'CHQ').rowsMissingFromExport < 40) pl.push('missing May rows not listed');
  }
  K(num, 'planted issues exist exactly as described', pl.length === 0, first(pl, 4));

  // trial balance
  const tbBad = [];
  for (const nm of ['opening', 'unadjusted', 'adjusted']) {
    const t = key.trialBalance[nm], dr = t.rows.reduce((s, r) => s + cd(r.debit), 0), cr = t.rows.reduce((s, r) => s + cd(r.credit), 0);
    if (dr !== cr || cd(t.totalDebit) !== dr || cd(t.totalCredit) !== cr) tbBad.push(`${nm} dr ${dr} cr ${cr}`);
  }
  K(num, 'trial balance debits equal credits (opening, unadjusted, adjusted)', tbBad.length === 0, first(tbBad));
  const codes = key.trialBalance.adjusted.rows.filter((r) => r.gifi !== null);
  K(num, 'every trial-balance line has a GIFI code from RC4088 or is marked confirm', codes.every((r) => GIFI[r.gifi] && r.gifiName === GIFI[r.gifi]) && key.trialBalance.adjusted.rows.filter((r) => r.gifi === null).every((r) => r.gifiStatus === 'confirm'), `${key.trialBalance.adjusted.rows.length} lines, ${key.trialBalance.adjusted.rows.filter((r) => r.gifiStatus === 'confirm').length} marked confirm`);
  // the trial balance can be rebuilt from the coded rows and entries in the key
  const net = {}; const bump = (a, v) => { net[a] = (net[a] ?? 0) + v; };
  for (const r of key.trialBalance.opening.rows) bump(r.account, cd(r.debit) - cd(r.credit));
  for (const t of key.transactions) for (const l of t.post ?? []) bump(l.a, cd(l.dr ?? 0) - cd(l.cr ?? 0));
  const un = Object.fromEntries(key.trialBalance.unadjusted.rows.map((r) => [r.account, cd(r.debit) - cd(r.credit)]));
  const diff1 = [...new Set([...Object.keys(net), ...Object.keys(un)])].filter((a) => (net[a] ?? 0) !== (un[a] ?? 0));
  for (const j of key.adjustingEntries) for (const l of j.lines) bump(l.account, cd(l.debit) - cd(l.credit));
  const ad = Object.fromEntries(key.trialBalance.adjusted.rows.map((r) => [r.account, cd(r.debit) - cd(r.credit)]));
  const diff2 = [...new Set([...Object.keys(net), ...Object.keys(ad)])].filter((a) => (net[a] ?? 0) !== (ad[a] ?? 0));
  K(num, 'the trial balance follows from the coded rows and the adjusting entries', diff1.length === 0 && diff2.length === 0, first([...diff1, ...diff2]));
  const glOf = (k) => key.accounts.find((a) => a.key === k).glAccount;
  const tie = [];
  for (const k of keys) { const a = accts[k]; if (a.role === 'pcard' || a.currency !== 'CAD') continue; const v = a.role === 'card' ? -(un[glOf(k)] ?? 0) : un[glOf(k)] ?? 0; if (v !== cd(a.closingBalance)) tie.push(`${k} books ${v} statement ${cd(a.closingBalance)}`); }
  K(num, 'bank and card balances in the books equal the statement closing balances', tie.length === 0, first(tie));
  const ajeBad = key.adjustingEntries.filter((j) => !j.reason || cd(j.lines.reduce((s, l) => s + l.debit, 0)) !== cd(j.lines.reduce((s, l) => s + l.credit, 0)) || !(j.source.transactions.length || j.source.onboarding.length));
  K(num, 'adjusting entries balance and name a reason and a source', ajeBad.length === 0, `${key.adjustingEntries.length} entries`);

  // transfers and card payments on both sides
  const byId = new Map(key.transactions.map((t) => [t.id, t]));
  const tr = key.transactions.filter((t) => ['transfer', 'card-payment', 'transfer-fx'].includes(t.kind) && !t.external), trBad = [];
  for (const t of tr) {
    const p = byId.get(t.pair);
    if (!p || p.pair !== t.id) { trBad.push(`${t.id} pair`); continue; }
    const ok = t.kind === 'transfer-fx' ? (() => { const r = Math.abs(t.currency === 'USD' ? p.amount / t.amount : t.amount / p.amount); return t.amount * p.amount < 0 && r > 1.2 && r < 1.6; })() : cd(t.amount) === -cd(p.amount);
    if (!ok || Math.abs(new Date(t.date) - new Date(p.date)) > 3 * 86400000) trBad.push(`${t.id} amounts or dates`);
    if (!!t.missingFromExport !== !!p.missingFromExport && !(num === '10' && (t.missingFromExport ? t : p).date.startsWith('2025-05'))) trBad.push(`${t.id} one side missing`);
  }
  const cardPays = key.transactions.filter((t) => t.kind === 'card-payment' && !t.external && t.amount < 0 && key.accounts.find((a) => a.key === t.acct).role === 'bank').length;
  K(num, 'transfers and card payments appear on both sides', trBad.length === 0 && (keys.filter((k) => accts[k].role === 'card').length === 0 || cardPays >= Math.max(5, monthsNeeded.length - 3)), `${tr.length / 2} pairs, ${cardPays} card payments${num === '10' ? ', May payments missing from the chequing export by design' : ''}`);

  // names and numbers
  const nameBad = key.parties.filter((p) => !/\(Test\)$/.test(p.name)).map((p) => p.name);
  const NAMEKEYS = new Set(['legal_name', 'name', 'entity_name', 'tenant', 'lender', 'grantor', 'recipient', 'employee', 'payer', 'issuer', 'corporation', 'payee', 'payer', 'owner']);
  const walk = (v, k = '') => { if (typeof v === 'string') { if (NAMEKEYS.has(k) && !/\(Test\)$/.test(v)) nameBad.push(`${k}=${v}`); } else if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk)); };
  walk({ ...onb, prior_year_closing_balances: undefined, accounts_provided: undefined }); walk(key.t2Inputs);
  const rawBad = (profile + JSON.stringify(onb)).match(/[A-Z][A-Za-z&' -]+ (?:Inc\.|Ltd\.|LLC|LLP)(?! \(Test\))/g) ?? [];
  const proseBad = (profile + JSON.stringify(onb) + JSON.stringify(key.flags) + JSON.stringify(key.adjustingEntries) + JSON.stringify(key.notes) + JSON.stringify(key.t2Inputs)).match(/\bTest (?:Inc|Ltd|LLC|LLP)\b/g) ?? [];
  K(num, 'every person and company name ends in (Test)', nameBad.length === 0 && proseBad.length === 0 && rawBad.filter((x) => !/TEST/.test(x)).length === 0, first([...nameBad, ...proseBad, ...rawBad]));
  const descBad = [...new Set(keys.flatMap((k) => accts[k].rows.map((r) => r.desc)))].filter((s) => !/TEST/.test(s) && !CHAIN_TOKENS.some((t) => s.includes(t)) && !GENERIC_RE.test(s));
  K(num, 'bank descriptions carry TEST or name only a common chain or bank wording', descBad.length === 0, first(descBad));
  const nines = (s) => s.match(/(?<![0-9])[0-9]{9}(?![0-9])/g) ?? [];
  const jsonText = read(path.join(dir, 'onboarding.json')) + read(path.join(dir, 'answer-key.json'));
  const luhnBad = nines(jsonText).filter((x) => luhnValid(x));
  K(num, 'every business number and SIN fails its check digit', luhnBad.length === 0 && nines(jsonText).length >= 2, `${nines(jsonText).length} nine-digit numbers found`);
  const shape = (s) => /(^|[^0-9])[0-9]{9}([^0-9]|$)|[0-9]{3}[ -][0-9]{3}[ -][0-9]{3}|[0-9]{5}[ -][0-9]{3}[ -][0-9]{7,12}|(^|[^0-9])[0-9]{15,20}([^0-9]|$)/.test(s);
  const shapeBad = [profile, ...keys.flatMap((k) => accts[k].rows.map((r) => r.desc))].filter(shape);
  const onbLines = read(path.join(dir, 'onboarding.json')).split('\n').filter((l) => shape(l) && !/"(business_number|account_number)"/.test(l));
  K(num, 'no SIN-shaped or bank-shaped digit runs in descriptions, profile or onboarding text (client-app rule)', shapeBad.length === 0 && onbLines.length === 0, first([...shapeBad, ...onbLines]));

  // flags and answer key content
  const fl = key.flags, flagBad = (MUST[num] ?? []).filter((re) => !fl.some((f) => re.test(f.rule)));
  K(num, 'the flags that must fire are in the key, each with a rule, detail and action', flagBad.length === 0 && fl.every((f) => f.rule && f.detail && f.action), `${fl.length} flags` + (flagBad.length ? '; missing ' + flagBad.map((r) => r.source).join(', ') : ''));
  const t2 = key.t2Inputs;
  K(num, 'T2 inputs present: Schedule 1, 8, 50, 3, 4, slips', t2.schedule1 && t2.schedule8 && t2.schedule50?.length >= 1 && t2.schedule3 && t2.schedule4 && t2.slips && t2.schedule50.every((h) => h.sin || h.businessNumber));
  K(num, 'profile.md and onboarding.json carry the planted issues, services, owners and prior-year balances', profile.includes('## Planted issues') && profile.includes(spec.name) && onb.services?.length && onb.owners?.length && onb.prior_year_closing_balances && onb.client_notes?.length);
}

// ---------- the associated pair (05 owns 06) ----------
{
  const j = (p) => JSON.parse(read(path.join(root, p)));
  const k5 = j('05-eglinton-holdings/answer-key.json'), k6 = j('06-eglinton-retail/answer-key.json'), o5 = j('05-eglinton-holdings/onboarding.json'), o6 = j('06-eglinton-retail/onboarding.json');
  line(k6.t2Inputs.schedule50[0].businessNumber === o5.corporation.business_number && k5.t2Inputs.schedule9.relatedCorporations[0].businessNumber === o6.corporation.business_number && k6.t2Inputs.schedule9.relatedCorporations[0].businessNumber === o5.corporation.business_number, '05 and 06 name each other with the right business numbers (Schedule 9 and Schedule 50)');
  line(o5.business_limit.allocated_to_this_corporation + o6.business_limit.allocated_to_this_corporation > 500000 && k5.t2Inputs.schedule23.consistent === false && k6.t2Inputs.schedule23.consistent === false, '05 and 06 allocate the shared business limit inconsistently (100000 and 500000 against 500000)');
}
// ---------- files across all clients ----------
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']'); // em dash and en dash, written as char codes so this file has none
const dashes = allText.filter(([, t]) => DASH.test(t)).map(([f]) => f);
line(dashes.length === 0, `no em dashes or en dashes in any generated file${dashes.length ? ': ' + first(dashes) : ` (${allText.length} files scanned)`}`);
const junk = allText.filter(([, t]) => /undefined|NaN|\[object/.test(t)).map(([f]) => f);
line(junk.length === 0, `no undefined, NaN or [object] text in any generated file${junk.length ? ': ' + first(junk) : ''}`);
line(fs.existsSync(path.join(root, 'generate.mjs')), 'generate.mjs is next to verify.mjs');
console.log(`\n${nPass} passed, ${nFail} failed`);
process.exit(nFail ? 1 : 0);
