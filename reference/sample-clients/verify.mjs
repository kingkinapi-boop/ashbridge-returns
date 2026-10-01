#!/usr/bin/env node
// Checks the generated sample clients against the README: one PASS or FAIL line per check.
// Usage: node verify.mjs      (it regenerates twice itself for the ARC-16 check: generate.mjs, then make-csv.mjs)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv, luhnValid } from './lib/util.mjs';
import { CHAIN_TOKENS, GENERIC_RE } from './lib/names.mjs';
import { GIFI, isPL } from './lib/chart.mjs';

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
  // W14: the new kinds' clients (K01 and K05). An empty layouts list means onboarding answers only (no account files).
  '11': { dir: '11-humber-bay-software', kind: 'K01', name: 'Humber Bay Software Ltd. (Test)', start: '2025-01-01', end: '2025-12-31', seed: 1111, layouts: { CHQ: 'A', BCD: 'CARD' } },
  '12': { dir: '12-kensington-market-crafts', kind: 'K05', name: 'Kensington Market Crafts Inc. (Test)', start: '2025-01-01', end: '2025-12-31', seed: 1112, layouts: {} },
  // W15: K06 (physician corporation) and K13 (one corporation, two unfiled years: 14 is 2024, 15 is 2025 and opens from 14).
  '13': { dir: '13-sharma-medicine', kind: 'K06', name: 'Sharma Medicine Professional Corporation (Test)', start: '2025-01-01', end: '2025-12-31', seed: 1113, layouts: { CHQ: 'C', BCD: 'CARD' } },
  '14': { dir: '14-rouge-valley-landscaping-2024', kind: 'K13', name: 'Rouge Valley Landscaping Inc. (Test)', start: '2024-01-01', end: '2024-12-31', seed: 1114, layouts: { CHQ: 'B', BCD: 'CARD' } },
  '15': { dir: '15-rouge-valley-landscaping-2025', kind: 'K13', name: 'Rouge Valley Landscaping Inc. (Test)', start: '2025-01-01', end: '2025-12-31', seed: 1115, layouts: { CHQ: 'B', BCD: 'CARD' } },
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
  '11': [['CHQ', null, 6780, /BAYVIEW ANALYTICS TEST INC/, 12], ['CHQ', null, 3955, /CEDARVALE CLINICS TEST LTD/, 12], ['CHQ', null, 2486, /PORTLANDS MEDIA TEST INC/, 12],
    ['CHQ', null, null, /NADIA PETROV TEST/, 26], ['CHQ', null, null, /CRA PAYROLL DEDUCTIONS/, 12], ['CHQ', null, null, /CRA GST\/HST PAYMENT/, 4], ['CHQ', '2025-01-31', null, /CRA GST\/HST PAYMENT/, 1], ['CHQ', '2025-04-30', null, /CRA GST\/HST PAYMENT/, 1], ['CHQ', '2025-07-31', null, /CRA GST\/HST PAYMENT/, 1], ['CHQ', '2025-10-31', null, /CRA GST\/HST PAYMENT/, 1],
    ['BCD', '2025-03-18', -3275.87, /BEST BUY/, 1], ['CHQ', null, null, /ELLIOT BARROW TEST/, 0]],
  // W15. 13: twelve OHIP deposits on the 14th (the RA paid that month), four non-OHIP fees (R09), the class 8 addition, payroll, no HST.
  '13': [['CHQ', null, null, /MOH OHIP PAYMENT TEST/, 12],
    ['CHQ', '2025-01-14', 31240.5, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-02-14', 27915.8, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-03-14', 32410.25, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-04-14', 30880.6, /MOH OHIP PAYMENT TEST/, 1],
    ['CHQ', '2025-05-14', 33105.4, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-06-14', 30579.75, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-07-14', 32945.7, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-08-14', 29830.35, /MOH OHIP PAYMENT TEST/, 1],
    ['CHQ', '2025-09-14', 28415.9, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-10-14', 30807.85, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-11-14', 32670.8, /MOH OHIP PAYMENT TEST/, 1], ['CHQ', '2025-12-14', 33892.8, /MOH OHIP PAYMENT TEST/, 1],
    ['CHQ', '2025-03-21', 650, /NORTHGATE LIFE INSURANCE TEST/, 1], ['CHQ', '2025-06-11', 2400, /BRANTLEY AND COLE LLP TEST/, 1], ['CHQ', '2025-09-17', 1850, /BRANTLEY AND COLE LLP TEST/, 1], ['CHQ', '2025-11-26', 480, /NORTHGATE LIFE INSURANCE TEST/, 1],
    ['BCD', '2025-05-20', -6850, /MERIDIAN MEDICAL SUPPLY TEST/, 1],
    ['CHQ', null, null, /LEAH FORTIN TEST/, 26], ['CHQ', null, null, /CRA PAYROLL DEDUCTIONS/, 12], ['CHQ', null, null, /GST\/HST/, 0], ['BCD', null, null, /GST\/HST/, 0]],
  // 14 (2024): the owner's loan, the mower (class 8) and the trailer (class 10) from chequing; nothing paid to CRA and no penalty in the books.
  '14': [['CHQ', '2024-04-10', 25000, /DECLAN MURPHY TEST/, 1], ['CHQ', null, null, /DECLAN MURPHY TEST/, 1],
    ['CHQ', '2024-04-12', -16046, /GREENLINE TURF EQUIPMENT TEST/, 1], ['CHQ', '2024-04-26', -7684, /NORTHBAY TRAILER SALES TEST/, 1],
    ['CHQ', null, null, /\bCRA\b/, 0], ['CHQ', null, null, /PENALTY/, 0]],
  // 15 (2025): the loan carries untouched (no rows with the owner's name); still no penalty in the books.
  '15': [['CHQ', null, null, /DECLAN MURPHY TEST/, 0], ['CHQ', null, null, /PENALTY/, 0]],
};
// Client 13's OHIP figures (README): RA totals by payment month, the opening and accrued receivables, the reduction and the resubmission.
const OHIP13 = {
  ra: [['2025-01', 31240.5], ['2025-02', 27915.8], ['2025-03', 32410.25], ['2025-04', 30880.6], ['2025-05', 33105.4], ['2025-06', 30579.75], ['2025-07', 32945.7],
    ['2025-08', 29830.35], ['2025-09', 28415.9], ['2025-10', 30807.85], ['2025-11', 32670.8], ['2025-12', 33892.8], ['2026-01', 31905.65], ['2026-02', 26740.3]],
  openingReceivable: { serviceMonths: ['2024-11', '2024-12'], amount: 59156.3 },
  accruedReceivable: { serviceMonths: ['2025-11', '2025-12'], amount: 58645.95, paidIn: ['2026-01', '2026-02'] },
  reduction: { paymentMonth: '2025-06', serviceMonth: '2025-03', amount: 1180.4 },
  resubmission: { serviceMonth: '2025-08', amount: 412.6, rejectedOn: '2025-10', paidOn: '2025-12' },
  revenue2025: 374185.35, nonOhipTotal: 5380,
};
// Client 12 has no account files: its planted issues are the onboarding answers, as the client app stores them (README).
const PLANTED_ANSWERS = {
  '12': { money: ['28,640.00', '11,480.00', '4,350.00', '960.00', '2,214.20', '1,140.00', '980.00', '3,900.00', '6,215.80', '2,500.00', '100.00', '16,800.00'], numbers: [10, 12400, 4100] },
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
  '11': [/CCA addition/i, /payroll against T4/i, /last year's return/i],
  '12': [/no third-party evidence for revenue/i, /bank balance has no statement/i, /home office/i, /vehicle/i],
  '13': [/OHIP accrual after year end/i, /RA reduction/i, /resubmitted claim/i, /small supplier limit/i, /no HST return/i, /payroll against T4/i, /CCA addition/i],
  '14': [/catch-up years filed in order/i, /second return waits for the first/i, /year end to be confirmed by ops/i, /2025 bought twice/i, /late-filing exposure/i, /non-capital loss/i, /CCA additions/i, /shareholder loan/i],
  '15': [/catch-up years filed in order/i, /second return waits for the first/i, /year end to be confirmed by ops/i, /2025 bought twice/i, /late-filing exposure/i, /opening balances from the 2024 return/i, /non-capital loss applied/i, /shareholder loan/i],
};
// The client app stores money in answers as text with commas and two decimals (onboarding contract U12).
const MONEY_RE = /^-?[0-9]{1,3}(,[0-9]{3})*\.[0-9]{2}$/;
const answerCents = (s) => Math.round(parseFloat(s.replace(/,/g, '')) * 100);
const answerNumber = (s) => parseFloat(String(s).replace(/[,%\s]/g, ''));
const answerId = (a) => String(a.question_asked ?? '').split(':')[0].trim();

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

// ---------- W14: checks only clients 11 (K01) and 12 (K05) carry; each names its clause ----------
const netCents = (r) => cd(r.debit ?? 0) - cd(r.credit ?? 0);
const byGifi = (rows) => { const m = new Map(); for (const r of rows ?? []) m.set(r.gifi, (m.get(r.gifi) ?? 0) + netCents(r)); return m; };
const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const uccMap = (rows) => new Map((rows ?? []).map((u) => [String(u.class), cd(u.ucc)]));
const RV2 = ['net_income', 'taxable_income', 'federal_tax', 'ontario_tax', 'instalments', 'balance_or_refund'];
// SEC-11 (both): names end (Test) or carry TEST in bank text; every business number and SIN fails its check digit.
function sec11({ num, key, onb, nameBad, proseBad, rawBad, descBad, jsonText, nines }) {
  const ids = []; const walk = (v, k = '') => { if (typeof v === 'string' || typeof v === 'number') { if (/^(business_number|businessNumber|bn|sin|SIN)$/.test(k) && /^[0-9]{9}$/.test(String(v))) ids.push([k, String(v)]); } else if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk)); };
  walk(onb); walk(key);
  const isSin = (k) => k === 'sin' || k === 'SIN', bns = ids.filter(([k]) => !isSin(k)), sins = ids.filter(([k]) => isSin(k));
  const bad = [...nameBad, ...proseBad, ...rawBad.filter((x) => !/TEST/.test(x)), ...descBad, ...ids.filter(([, v]) => luhnValid(v)).map(([k, v]) => `${k} ${v} passes the check digit`), ...nines(jsonText).filter((x) => luhnValid(x)).map((x) => `${x} passes the check digit`)];
  K(num, 'SEC-11 only made-up data: every name ends (Test) or carries TEST in bank text; the business number and every SIN fail the check digit; marked is_test', bad.length === 0 && bns.length >= 1 && sins.length >= 1 && onb.is_test === true, first(bad) || `${bns.length} business numbers, ${sins.length} SINs, all fail luhn`);
}
const CLIENT_CHECKS = {
  '11': (c) => {
    const { num, spec, key, onb, keys, rollBad, planted } = c;
    sec11(c);
    K(num, `ARC-16 generated from the fixed seed ${spec.seed}`, key.generator?.seed === spec.seed, `seed ${key.generator?.seed}`);
    K(num, 'END-2 every month of every account rolls (opening + activity = closing), no fault planted', keys.length === 2 && rollBad.length === 0 && planted.length === 0, first(rollBad) || first(planted) || `${keys.length} accounts`);
    const adj = key.trialBalance.adjusted.rows, dr = adj.reduce((s, r) => s + cd(r.debit), 0), cr = adj.reduce((s, r) => s + cd(r.credit), 0);
    K(num, 'END-2 the adjusted trial balance balances in cents', dr === cr && dr > 0, `debits ${dr} credits ${cr}`);
    const noAcct = key.transactions.filter((t) => !t.account || !t.accountNo).map((t) => t.id), susp = adj.filter((r) => r.gifi === null).map((r) => r.account);
    K(num, 'END-2 every transaction has an account and nothing sits in suspense', key.transactions.length > 0 && noAcct.length === 0 && susp.length === 0, first([...noAcct, ...susp]) || `${key.transactions.length} transactions`);
    const py = key.prior_year;
    if (!py) { K(num, 'END-2 the answer key holds last year\'s return (prior_year)', false, 'no prior_year block'); return; }
    const pyBad = [];
    if (py.cpaFinal !== true || py.assessed !== true || py.filedByUs !== true) pyBad.push('cpaFinal, assessed and filedByUs must all be true');
    if (py.fiscalYear?.start !== '2024-01-01' || py.fiscalYear?.end !== '2024-12-31') pyBad.push('fiscalYear 2024-01-01 to 2024-12-31');
    if (!Array.isArray(py.losses?.nonCapital) || !Array.isArray(py.losses?.capital) || py.losses.nonCapital.length || py.losses.capital.length) pyBad.push('losses.nonCapital and losses.capital empty');
    if (!py.dividendAccounts || typeof py.dividendAccounts !== 'object' || Object.values(py.dividendAccounts).some((v) => v !== 0)) pyBad.push('dividendAccounts all zero');
    const noa = py.noticeOfAssessment;
    if (!noa || noa.assessedAsFiled !== true || !/^2025-[0-9]{2}-[0-9]{2}$/.test(noa.date ?? '')) pyBad.push('noticeOfAssessment assessed as filed, dated in 2025');
    const rvMiss = RV2.filter((k) => !Number.isFinite(py.rv2?.[k])); if (rvMiss.length) pyBad.push('rv2 missing ' + rvMiss.join(' '));
    K(num, 'END-2 prior_year is last year\'s return as the firm filed it: CPA-final, assessed as filed, no losses, no dividend accounts, the six RV-2 numbers', pyBad.length === 0, first(pyBad));
    const pycb = onb.prior_year_closing_balances ?? {}, a = byGifi(py.balanceSheet), b = byGifi(pycb.accounts);
    K(num, 'END-2 prior_year GIFI balance sheet at 31 Dec 2024 equals prior_year_closing_balances line for line (by GIFI code, in cents)', pycb.as_of === '2024-12-31' && a.size > 0 && sameMap(a, b), `${a.size} GIFI lines against ${b.size}`);
    const re = cd(py.retainedEarnings3849 ?? NaN), reOpen = -(byGifi(key.trialBalance.opening.rows).get(3600) ?? NaN), reOnb = -(b.get(3600) ?? NaN);
    K(num, 'END-2 prior_year 3849 retained earnings equals the opening retained earnings (opening trial balance and onboarding, GIFI 3600)', Number.isFinite(re) && re === reOpen && re === reOnb, `3849 ${re}, opening ${reOpen}, onboarding ${reOnb}`);
    const u1 = uccMap(py.ucc), u2 = uccMap(key.t2Inputs.schedule8?.openingUcc), u3 = uccMap(pycb.ucc);
    K(num, 'END-2 prior_year UCC by class equals this year\'s opening UCC (Schedule 8) and onboarding', Array.isArray(py.ucc) && sameMap(u1, u2) && sameMap(u1, u3), `${u1.size} classes`);
    const judged = key.flags.filter((f) => f.severity !== 'info' || f.judgement).map((f) => f.id);
    K(num, 'END-2 the control client: flags hold no judgement item (info items only)', key.flags.length > 0 && judged.length === 0, first(judged) || `${key.flags.length} info flags`);
  },
  '12': (c) => {
    const { num, spec, key, onb } = c;
    sec11(c);
    K(num, `ARC-16 generated from the fixed seed ${spec.seed}`, key.generator?.seed === spec.seed, `seed ${key.generator?.seed}`);
    const ans = Array.isArray(onb.answers) ? onb.answers : [], byId = new Map(ans.map((a) => [answerId(a), a]));
    const shapeBad = ans.filter((a) => !/^[A-Z][A-Z0-9]*\.[A-Za-z0-9_.]+$/.test(answerId(a)) || !/: \S/.test(a.question_asked ?? '') || typeof a.answer_verbatim !== 'string' || !a.what_it_resolves || !['screen', 'conversation', 'internal'].includes(a.channel)).map((a) => a.question_asked ?? JSON.stringify(a).slice(0, 40));
    K(num, 'END-6 onboarding answers in the client app\'s shape (question_asked "<id>: <label>", answer_verbatim text, what_it_resolves, channel), ids unique', ans.length > 0 && shapeBad.length === 0 && byId.size === ans.length, first(shapeBad) || `${ans.length} answers`);
    // A line traces to one answer: { source: { kind: 'client answer', answer: '<question id>' } }.
    const trace = (label, v, src, unit = 'money') => {
      if (src?.kind !== 'client answer') return `${label}: source kind ${src?.kind} is not "client answer"`;
      const a = byId.get(src.answer); if (!a) return `${label}: answer ${src.answer} not in onboarding.json`;
      const t = String(a.answer_verbatim);
      if (unit === 'money') { if (!MONEY_RE.test(t)) return `${label}: answer ${src.answer} "${t}" is not 1,234.56 text`; if (answerCents(t) !== cd(v)) return `${label}: ${cd(v)} cents against answer ${src.answer} "${t}"`; }
      else if (answerNumber(t) !== v) return `${label}: ${v} against answer ${src.answer} "${t}"`;
      return null;
    };
    const tbRows = key.trialBalance.adjusted.rows, money = new Set();
    const tbBad = tbRows.map((r) => { money.add(r.source?.answer); return trace(`TB ${r.account}`, Math.abs(netCents(r)) / 100, r.source); }).filter(Boolean);
    K(num, 'END-6 every trial balance line names an onboarding answer that exists and whose text parses to the same cents (source kind client answer, so every dot is amber)', tbRows.length > 0 && tbBad.length === 0, first(tbBad) || `${tbRows.length} lines`);
    const lines = Array.isArray(key.t2Inputs.lines) ? key.t2Inputs.lines : [];
    const t2Bad = lines.map((l) => { const u = l.unit ?? 'money'; if (u === 'money') money.add(l.source?.answer); return ['money', 'percent', 'km'].includes(u) ? trace(`T2 ${l.input}`, l.amount, l.source, u) : `T2 ${l.input}: unit ${u}`; }).filter(Boolean);
    K(num, 'END-6 every T2 input (t2Inputs.lines) names an onboarding answer that exists and parses to the same value (cents for money; percent and km as numbers)', lines.length > 0 && lines.some((l) => l.unit === 'percent') && lines.some((l) => l.unit === 'km') && t2Bad.length === 0, first(t2Bad) || `${lines.length} inputs`);
    const looksMoney = (t) => /^\$?-?[0-9][0-9,]*\.[0-9]+$/.test(t.trim()) || /^\$/.test(t.trim());
    const mBad = ans.filter((a) => (money.has(answerId(a)) || looksMoney(String(a.answer_verbatim))) && !MONEY_RE.test(String(a.answer_verbatim))).map((a) => `${answerId(a)} "${a.answer_verbatim}"`);
    const nMoney = ans.filter((a) => MONEY_RE.test(String(a.answer_verbatim))).length;
    K(num, 'END-6 every money answer is text in the 1,234.56 shape (commas, two decimals)', nMoney >= 5 && mBad.length === 0, first(mBad) || `${nMoney} money answers`);
    const blocking = key.flags.filter((f) => f.blocking !== false || !/person/i.test(f.action ?? '')).map((f) => f.id);
    K(num, 'END-6 every flag is for a person to look at and none blocks (blocking false)', key.flags.length >= 4 && blocking.length === 0, first(blocking) || `${key.flags.length} flags`);
  },
  '13': (c) => {
    const { num, spec, key, onb, accts } = c;
    sec11(c);
    K(num, `ARC-16 generated from the fixed seed ${spec.seed}`, key.generator?.seed === spec.seed, `seed ${key.generator?.seed}`);
    const oh = key.ohip;
    if (!oh || !Array.isArray(oh.raStatements)) { K(num, 'CK-21 the answer key holds the OHIP reconciliation (ohip.raStatements)', false, 'no ohip block'); return; }
    const ras = oh.raStatements, fyS = spec.start, fyE = spec.end;
    const raSum = (pred) => ras.reduce((s, r) => s + (r.lines ?? []).filter(pred).reduce((x, l) => x + cd(l.amount), 0), 0);
    const redSum = (pred) => ras.reduce((s, r) => s + (r.reductions ?? []).filter(pred).reduce((x, l) => x + cd(l.amount), 0), 0);
    // 1. every RA totals its lines less its reductions; key and onboarding agree with the README's totals by payment month
    const raBad = ras.filter((r) => cd(r.total) !== (r.lines ?? []).reduce((x, l) => x + cd(l.amount), 0) - (r.reductions ?? []).reduce((x, l) => x + cd(l.amount), 0) || monthOf(r.paymentDate ?? '') !== r.paymentMonth).map((r) => r.paymentMonth);
    const exp = OHIP13.ra.map(([m, v]) => `${m}:${cd(v)}`).join();
    const gotKey = ras.map((r) => `${r.paymentMonth}:${cd(r.total)}`).join();
    const ora = Array.isArray(onb.ohip_remittance_advice) ? onb.ohip_remittance_advice : [];
    const gotOnb = ora.map((r) => `${r.payment_month}:${cd(r.total)}`).join();
    K(num, 'CK-21 every OHIP remittance advice (ohip.raStatements, Jan 2025 to Feb 2026) totals its service-month lines less its reductions, and onboarding ohip_remittance_advice holds the same totals by payment month as the README', raBad.length === 0 && gotKey === exp && gotOnb === exp && ora.every((r) => monthOf(r.payment_date ?? '') === r.payment_month), first(raBad) || (gotKey !== exp ? `key ${gotKey.slice(0, 60)}` : gotOnb !== exp ? `onboarding ${gotOnb.slice(0, 60)}` : `${ras.length} RAs`));
    // 2. each 2025 RA is one chequing deposit; RAs after year end are not in the bank file
    const payer = typeof oh.payerDescription === 'string' ? oh.payerDescription : '';
    const bankRows = (accts.CHQ?.rows ?? []).filter((r) => payer && r.desc.includes(payer));
    const tx = new Map(key.transactions.map((t) => [t.id, t]));
    const depBad = ras.flatMap((r) => {
      if (r.paymentDate > fyE) return r.depositTransaction == null ? [] : [`${r.paymentMonth} after year end names a deposit`];
      const t = tx.get(r.depositTransaction);
      return t && t.acct === 'CHQ' && t.date === r.paymentDate && cd(t.amount) === cd(r.total) && t.description.includes(payer) ? [] : [`${r.paymentMonth} deposit ${r.depositTransaction}`];
    });
    const in25 = ras.filter((r) => r.paymentDate >= fyS && r.paymentDate <= fyE);
    K(num, 'CK-21 each RA paid in 2025 is one chequing deposit (depositTransaction: same date and cents, bank text ohip.payerDescription); RAs paid after year end have none', /OHIP/.test(payer) && /TEST/.test(payer) && depBad.length === 0 && bankRows.length === in25.length && in25.length === 12, first(depBad) || `${bankRows.length} OHIP deposits, ${in25.length} RAs paid in the year`);
    // 3. the identity, to the cent
    const deposits = bankRows.filter((r) => r.date >= fyS && r.date <= fyE).reduce((s, r) => s + r.amt, 0);
    const opening = cd(oh.openingReceivable?.amount ?? NaN), accrued = cd(oh.accruedReceivable?.amount ?? NaN);
    const svc25 = (l) => l.serviceMonth >= fyS.slice(0, 7) && l.serviceMonth <= fyE.slice(0, 7);
    const ra25Net = raSum(svc25) - redSum(svc25);
    const openFromRa = raSum((l) => l.serviceMonth < fyS.slice(0, 7)), accrFromRa = ras.filter((r) => r.paymentDate > fyE).reduce((s, r) => s + (r.lines ?? []).filter(svc25).reduce((x, l) => x + cd(l.amount), 0), 0);
    K(num, 'CK-21 OHIP deposits dated in 2025, less the opening receivable for 2024 services, plus the accrued receivable for Nov and Dec 2025 services, equal the RA totals for 2025 service months net of the reduction, to the cent', Number.isFinite(opening) && Number.isFinite(accrued) && deposits - opening + accrued === ra25Net && opening === openFromRa && accrued === accrFromRa && ra25Net === cd(OHIP13.revenue2025) && opening === cd(OHIP13.openingReceivable.amount) && accrued === cd(OHIP13.accruedReceivable.amount), `deposits ${deposits} - opening ${opening} (RA ${openFromRa}) + accrued ${accrued} (RA ${accrFromRa}) against ${ra25Net}`);
    // 4. the books carry it: revenue by service month, the revenue account, the receivable and the accrual entry
    const rbs = Array.isArray(oh.revenueByServiceMonth) ? oh.revenueByServiceMonth : [];
    const adjNet = new Map(key.trialBalance.adjusted.rows.map((r) => [r.account, netCents(r)])), openNet = new Map(key.trialBalance.opening.rows.map((r) => [r.account, netCents(r)]));
    const aje = key.adjustingEntries.find((j) => j.id === oh.accruedReceivable?.adjustingEntry);
    const booksBad = [];
    if (rbs.length !== 12 || rbs.map((r) => r.serviceMonth).join() !== key.statementBalances.CHQ.map((s) => s.month).join()) booksBad.push('revenueByServiceMonth is not the twelve 2025 months');
    if (rbs.reduce((s, r) => s + cd(r.amount), 0) !== ra25Net) booksBad.push('revenueByServiceMonth does not sum to the RA total net of the reduction');
    if (!oh.revenueAccount || -(adjNet.get(oh.revenueAccount) ?? 0) !== ra25Net) booksBad.push(`adjusted ${oh.revenueAccount} credit ${-(adjNet.get(oh.revenueAccount) ?? 0)}`);
    if ((openNet.get(oh.receivableAccount) ?? 0) !== opening || (adjNet.get(oh.receivableAccount) ?? 0) !== accrued) booksBad.push(`receivable ${oh.receivableAccount} opening ${openNet.get(oh.receivableAccount)} adjusted ${adjNet.get(oh.receivableAccount)}`);
    if (!aje || cd(aje.amount) !== accrued || !aje.lines.some((l) => l.account === oh.receivableAccount && cd(l.debit) === accrued)) booksBad.push('no accrual adjusting entry debiting the receivable');
    K(num, 'CK-21 the books carry it: revenue by service month sums to the RA total net of the reduction and equals the OHIP revenue account; the receivable opens at the 2024 services and closes at the accrual (one adjusting entry)', booksBad.length === 0, first(booksBad));
    // 5. the window: three months of claim submission plus one monthly payment cycle after year end
    const [wy, wm] = fyE.split('-').map(Number), closes = new Date(Date.UTC(wy, wm + 4, 0)).toISOString().slice(0, 10);
    const after = ras.filter((r) => r.paymentDate > fyE);
    const lateSvc = (oh.accruedReceivable?.serviceMonths ?? []).join(), paidIn = after.map((r) => r.paymentMonth).join();
    K(num, `CK-21 the payments after year end fall inside the window (three months of claim submission plus one monthly payment cycle: on or before ${closes}); the Nov and Dec 2025 services are paid in Jan and Feb 2026`, after.length === 2 && after.every((r) => r.paymentDate <= closes) && oh.window?.closesOn === closes && lateSvc === OHIP13.accruedReceivable.serviceMonths.join() && paidIn === OHIP13.accruedReceivable.paidIn.join() && after.every((r) => (r.lines ?? []).every((l) => OHIP13.accruedReceivable.serviceMonths.includes(l.serviceMonth))), `${paidIn} against window ${oh.window?.closesOn}`);
    // 6. no HST anywhere
    const hstBad = [];
    for (const nm of ['opening', 'unadjusted', 'adjusted']) if (key.trialBalance[nm].rows.some((r) => r.account === '2050' || r.gifi === 2680 || r.gifi === 1066)) hstBad.push(`${nm} trial balance has an HST line`);
    const taxed = key.transactions.filter((t) => t.hstItc || t.hstCollected).map((t) => t.id); if (taxed.length) hstBad.push(`HST on ${first(taxed, 2)}`);
    if ((onb.cra_program_accounts ?? []).some((p) => p.program === 'hst')) hstBad.push('an hst program in onboarding');
    if (onb.hst?.registered !== false) hstBad.push('hst.registered is not false');
    K(num, 'CK-21 no HST payable or receivable account in any trial balance, no HST on any row, no hst program in onboarding (insured services are exempt supplies)', hstBad.length === 0, first(hstBad));
    // 7. non-OHIP income (R09): taxable supplies under the small supplier limit
    const no = key.nonOhipIncome ?? {}, items = Array.isArray(no.items) ? no.items : [];
    const noBad = items.filter((i) => { const t = tx.get(i.transaction); return !t || t.acct !== 'CHQ' || t.date !== i.date || cd(t.amount) !== cd(i.amount) || (payer && t.description.includes(payer)); }).map((i) => `${i.date} ${i.transaction}`);
    const noTot = items.reduce((s, i) => s + cd(i.amount), 0);
    K(num, 'CK-21 non-OHIP income (R09) kept apart: nonOhipIncome items are each one chequing deposit, total under the $30,000 small supplier limit', items.length === 4 && noBad.length === 0 && noTot === cd(no.total ?? NaN) && noTot === cd(OHIP13.nonOhipTotal) && cd(no.smallSupplierLimit ?? NaN) === 3000000 && noTot < 3000000, first(noBad) || `${items.length} items, ${noTot} cents`);
  },
  '14': (c) => {
    const { num, spec, key } = c;
    sec11(c);
    K(num, `ARC-16 generated from the fixed seed ${spec.seed}`, key.generator?.seed === spec.seed, `seed ${key.generator?.seed}`);
    end1(c);
    const ub = uccRoll(key);
    const cls = (key.t2Inputs.schedule8?.closingUcc ?? []).map((r) => String(r.class)).sort().join();
    K(num, 'CK-12 the 2024 closing UCC by class (schedule8.closingUcc) is opening + additions - disposals - CCA claimed, additions as Schedule 8 lists them (classes 8 and 10)', ub.length === 0 && cls === '10,8', first(ub) || cls);
    const L = key.t2Inputs.losses ?? {}, ni = cd(key.t2Inputs.netIncomeLossPerBooksBeforeTax), inc = taxIncome(key);
    K(num, 'CK-12 the 2024 non-capital loss (t2Inputs.losses.nonCapitalLossForYear) is the loss per books plus Schedule 1 add-backs, less deductions and CCA claimed', ni < 0 && inc < 0 && cd(L.nonCapitalLossForYear ?? NaN) === -inc, `per books ${ni}, for tax ${inc}, key ${cd(L.nonCapitalLossForYear ?? NaN)}`);
  },
  '15': (c) => {
    const { num, spec, key, onb } = c;
    sec11(c);
    K(num, `ARC-16 generated from the fixed seed ${spec.seed}`, key.generator?.seed === spec.seed, `seed ${key.generator?.seed}`);
    end1(c);
    const p = sibling('14');
    if (!p) { K(num, 'CK-12 the 2024 folder (14) exists to open from', false, 'no folder 14'); return; }
    // SEC-11: one corporation, one business number, one owner
    const bn = onb.corporation?.business_number, others = specNums.filter((n) => n !== '14' && n !== '15').filter((n) => { const d = folderOf(n); return d && (read(path.join(root, d, 'onboarding.json')) + read(path.join(root, d, 'answer-key.json'))).includes(bn); });
    K(num, 'SEC-11 14 and 15 carry the same business number (one corporation, two years), it fails the check digit, no other client carries it, and Schedule 50 names the same owner and SIN', /^[0-9]{9}$/.test(bn ?? '') && !luhnValid(bn) && p.onb.corporation?.business_number === bn && others.length === 0 && JSON.stringify(p.key.t2Inputs.schedule50) === JSON.stringify(key.t2Inputs.schedule50), others.length ? `also in ${others.join(', ')}` : `bn ${p.onb.corporation?.business_number === bn ? 'shared' : 'differs'}`);
    K(num, 'END-1 14 and 15 hold the same engagements (the client app has one set per corporation)', JSON.stringify(p.onb.engagements) === JSON.stringify(onb.engagements));
    // CK-12: 15 opens from 14
    const a14 = new Map(p.key.trialBalance.adjusted.rows.map((r) => [r.account, netCents(r)])), o15 = new Map(key.trialBalance.opening.rows.map((r) => [r.account, netCents(r)]));
    const bsKeys = [...new Set([...a14.keys(), ...o15.keys()])].filter((a) => !isPL(a) && a !== '3600' && a !== '3700').sort();
    const bsBad = bsKeys.filter((a) => (a14.get(a) ?? 0) !== (o15.get(a) ?? 0)).map((a) => `${a} 14 ${a14.get(a) ?? 0} 15 ${o15.get(a) ?? 0}`);
    K(num, 'CK-12 every balance sheet line of the opening trial balance equals 14\'s adjusted closing line, in cents', bsKeys.length >= 5 && bsBad.length === 0 && !a14.has('3700') && !o15.has('3700'), first(bsBad) || (a14.has('3700') || o15.has('3700') ? 'a dividends line (3700)' : `${bsKeys.length} lines`));
    const ni14 = cd(p.key.trialBalance.netIncomeLossBeforeTax), re14 = -(a14.get('3600') ?? NaN), re15 = -(o15.get('3600') ?? NaN), py = key.prior_year ?? {};
    K(num, 'CK-12 opening 3849 retained earnings (GIFI 3600) equals 14\'s opening 3849 plus 14\'s net income; prior_year names 14 with the same figures', Number.isFinite(re15) && re15 === re14 + ni14 && py.client === '14' && py.fiscalYear?.start === '2024-01-01' && py.fiscalYear?.end === '2024-12-31' && py.filedByUs === false && cd(py.netIncome ?? NaN) === ni14 && cd(py.retainedEarnings3849 ?? NaN) === re15, `14 opening ${re14} + net income ${ni14} against 15 opening ${re15}`);
    const bankBad = key.accounts.filter((a) => { const b = p.key.accounts.find((x) => x.key === a.key); return !b || cd(b.closingBalance) !== cd(a.openingBalance); }).map((a) => a.key);
    K(num, 'CK-12 each account opens at 14\'s statement closing balance', key.accounts.length === 2 && bankBad.length === 0, first(bankBad));
    const u14 = uccMap(p.key.t2Inputs.schedule8?.closingUcc), u15 = uccMap(key.t2Inputs.schedule8?.openingUcc), ub = uccRoll(key);
    K(num, 'CK-12 opening UCC by class equals 14\'s closing UCC (and onboarding\'s prior_year_closing_balances.ucc); this year\'s closing UCC rolls the same way', u14.size >= 2 && sameMap(u14, u15) && sameMap(u15, uccMap(onb.prior_year_closing_balances?.ucc)) && ub.length === 0, first(ub) || `${u15.size} classes`);
    const L = key.t2Inputs.losses ?? {}, bf = (L.nonCapitalBroughtForward ?? []).find((x) => x.taxYearEnd === '2024-12-31'), inc = taxIncome(key);
    const appl = bf ? Math.min(cd(bf.amount), Math.max(0, inc)) : NaN, ni = cd(key.t2Inputs.netIncomeLossPerBooksBeforeTax);
    K(num, 'CK-12 14\'s non-capital loss appears in the T2 inputs (losses.nonCapitalBroughtForward) and is applied: the lesser of the loss and this year\'s income for tax, the rest carried on; the year returns to a profit', !!bf && cd(bf.amount) === cd(p.key.t2Inputs.losses?.nonCapitalLossForYear ?? NaN) && ni > 0 && appl > 0 && cd(L.nonCapitalApplied ?? NaN) === appl && cd(L.nonCapitalClosing ?? NaN) === cd(bf.amount) - appl, bf ? `brought forward ${cd(bf.amount)}, income ${inc}, applied ${cd(L.nonCapitalApplied ?? NaN)} expected ${appl}` : 'no 2024 loss brought forward');
  },
};
// W15 helpers. END-1 (14 and 15): the onboarding cases ops confirms, each named by a flag.
function end1({ num, onb, key }) {
  const corp = onb.corporation ?? {};
  K(num, 'END-1 onboarding says not all prior years filed (all_prior_years_filed "no") and holds the unfiled years only as text (outstanding_years "2024 and 2025", contract U3)', corp.all_prior_years_filed === 'no' && corp.outstanding_years === '2024 and 2025', `${corp.all_prior_years_filed} / ${JSON.stringify(corp.outstanding_years)}`);
  K(num, 'END-1 the year end is marked unconfirmed (corporation.financial_year_end_confirmed false, contract U4)', corp.financial_year_end_confirmed === false && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(corp.financial_year_end ?? ''), String(corp.financial_year_end_confirmed));
  const eng = Array.isArray(onb.engagements) ? onb.engagements : [], t2 = eng.filter((e) => e.service === 't2');
  K(num, 'END-1 onboarding lists two T2 engagements for 2025 (the same year bought twice) and none for 2024 (an outstanding year is text only)', t2.length === 2 && t2.every((e) => e.tax_year === 2025 && e.is_test === true && e.id && e.created_at) && new Set(t2.map((e) => e.id)).size === 2 && !eng.some((e) => e.tax_year === 2024), `${t2.length} T2 engagements: ${t2.map((e) => e.tax_year).join(', ')}`);
  const need = [[/catch-up years filed in order/i, ['corporation.all_prior_years_filed', 'corporation.outstanding_years'], /red tier/i], [/year end to be confirmed by ops/i, ['corporation.financial_year_end'], null], [/2025 bought twice/i, ['engagements'], null], [/second return waits for the first/i, [], null]];
  const miss = need.filter(([re, fields, det]) => !key.flags.some((f) => re.test(f.rule) && fields.every((x) => (f.evidence?.onboarding ?? []).includes(x)) && (!det || det.test(f.detail)))).map(([re]) => re.source);
  K(num, 'END-1 the flags name each case (catch-up years in order, red tier; year end unconfirmed; 2025 bought twice; the second return waits), each citing its onboarding field', miss.length === 0, first(miss));
}
// CK-12 (14 and 15): schedule8.closingUcc rows { class, opening, additions, disposals, ccaClaimed, ucc } roll, in cents.
function uccRoll(key) {
  const s8 = key.t2Inputs.schedule8 ?? {}, rows = s8.closingUcc;
  if (!Array.isArray(rows) || !rows.length) return ['no schedule8.closingUcc'];
  const open = uccMap(s8.openingUcc), adds = new Map();
  for (const c2 of s8.classes ?? []) adds.set(String(c2.class), (c2.additions ?? []).reduce((s, a) => s + cd(a.capitalCost), 0));
  const bad = [], seen = new Set(rows.map((r) => String(r.class)));
  for (const r of rows) {
    const k = String(r.class);
    if (cd(r.opening ?? NaN) !== (open.get(k) ?? 0)) bad.push(`class ${k} opening`);
    if (cd(r.additions ?? NaN) !== (adds.get(k) ?? 0)) bad.push(`class ${k} additions`);
    if (!(cd(r.ccaClaimed ?? NaN) >= 0) || cd(r.opening) + cd(r.additions) - cd(r.disposals ?? 0) - cd(r.ccaClaimed) !== cd(r.ucc ?? NaN)) bad.push(`class ${k} does not roll`);
  }
  for (const k of [...open.keys(), ...adds.keys()]) if (!seen.has(k)) bad.push(`class ${k} has no closing row`);
  return bad;
}
// Income for tax in cents: per books, plus Schedule 1 add-backs, less Schedule 1 deductions and the CCA claimed.
const taxIncome = (key) => { const t = key.t2Inputs, s = (a, f) => (a ?? []).reduce((x, i) => x + cd(i[f] ?? 0), 0); return cd(t.netIncomeLossPerBooksBeforeTax) + s(t.schedule1?.addBacks, 'amount') - s(t.schedule1?.deductions, 'amount') - s(t.schedule8?.closingUcc, 'ccaClaimed'); };
const sibling = (n) => { const d = folderOf(n); if (!d) return null; try { return { key: JSON.parse(read(path.join(root, d, 'answer-key.json'))), onb: JSON.parse(read(path.join(root, d, 'onboarding.json'))) }; } catch { return null; } };

// ---------- ARC-16: regenerate twice (generate.mjs, then make-csv.mjs, as the README says); lines printed at the end ----------
const specNums = Object.keys(SPEC).sort();
const folderOf = (num) => fs.readdirSync(root).find((d) => d.startsWith(num + '-') && fs.statSync(path.join(root, d)).isDirectory());
const hashAll = () => {
  const h = {};
  for (const num of specNums) { const d = folderOf(num); if (d) for (const f of allFiles(path.join(root, d))) h[path.relative(root, f)] = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
  return h;
};
const regenerate = () => {
  const g = spawnSync(process.execPath, [path.join(root, 'generate.mjs')], { encoding: 'utf8' });
  if (g.status !== 0) throw new Error(`generate.mjs exited ${g.status}: ${(g.stderr || g.stdout || '').trim().split('\n').slice(-2).join(' ')}`);
  spawnSync(process.execPath, [path.join(root, 'make-csv.mjs')], { encoding: 'utf8' }); // its own pass or fail is the ARC-8 make-csv check below
  return hashAll();
};
const regen = { err: null, h1: {}, h2: {} };
try { regen.h1 = regenerate(); regen.h2 = regenerate(); } catch (e) { regen.err = e.message; }

// ---------- run ----------
const dirs = fs.readdirSync(root).filter((d) => /^\d\d-/.test(d)).sort();
line(dirs.map((d) => d.slice(0, 2)).join() === specNums.join(), `ARC-8 one client folder for each SPEC entry, ${specNums[0]} to ${specNums[specNums.length - 1]} (found ${dirs.length}: ${dirs.join(', ')})`);
const allText = [];

for (const num of specNums) {
  const d = folderOf(num), spec = SPEC[num];
  if (!d) { K(num, 'client folder exists', false, `missing ${spec.dir ?? num + '-*'}`); continue; }
  const dir = path.join(root, d);
  if (spec.dir) K(num, 'folder name as the README says', d === spec.dir, d);
  try {
  const need = ['profile.md', 'onboarding.json', 'answer-key.json'];
  const missing = need.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) { K(num, 'files exist', false, missing.join(', ')); continue; }
  const key = JSON.parse(read(path.join(dir, 'answer-key.json'))), onb = JSON.parse(read(path.join(dir, 'onboarding.json'))), profile = read(path.join(dir, 'profile.md'));
  const files = allFiles(dir);
  for (const f of files) allText.push([path.relative(root, f), read(f)]);
  // Onboarding answers only (client 12): no account files, so the account checks below are skipped and the END-6 checks run instead.
  const answersOnly = Object.keys(spec.layouts).length === 0;
  const accts = {};
  if (!answersOnly) for (const a of key.accounts) accts[a.key] = { ...a, kind: kindOf(a.layout), rows: parseAccount(kindOf(a.layout), read(path.join(dir, a.file))), qbo: parseQbo(read(path.join(dir, a.qboFile))) };
  const keys = Object.keys(accts);
  if (!answersOnly) K(num, 'account files, QBO files and layouts as the README says', keys.join() === Object.keys(spec.layouts).join() && keys.every((k) => accts[k].kind === spec.layouts[k]) && key.accounts.every((a) => fs.existsSync(path.join(dir, a.qboFile))), keys.map((k) => `${k} ${accts[k].rows.length} rows`).join(', '));
  else { const af = files.map((f) => path.relative(dir, f)).filter((f) => /^(accounts|qbo)[\\/]/.test(f)); K(num, 'END-6 onboarding answers only: no accounts/ or qbo/ files, and no account in the key points at one', af.length === 0 && (key.accounts ?? []).every((a) => !a.file && !a.qboFile), first(af) || `${(key.accounts ?? []).length} accounts in the key`); }
  K(num, 'company name and fiscal year match the README', key.name === spec.name && onb.corporation.legal_name === spec.name && onb.corporation.financial_year_end === spec.end && key.fiscalYear.end === spec.end && key.fiscalYear.start === spec.start && onb.corporation.fiscal_year_start === spec.start, `${spec.start} to ${spec.end}`);

  // dates within the year (client 10 has planted December 2024 rows)
  const outside = keys.flatMap((k) => accts[k].rows.filter((r) => r.date < spec.start || r.date > spec.end).map((r) => `${k} ${r.date}`));
  if (answersOnly) { /* no account rows */ } else if (num === '10') K(num, 'all dates in the year except the eight planted December 2024 rows', outside.length === 8 && outside.every((x) => x.includes('2024-12')), `${outside.length} outside`);
  else K(num, 'every date is inside the fiscal year', outside.length === 0, first(outside));
  // every month has rows (client 10 has no May by design; client 09 starts 15 Apr)
  const monthsNeeded = answersOnly ? [] : key.statementBalances[keys[0]].map((s) => s.month);
  const emptyMonths = keys.flatMap((k) => monthsNeeded.filter((m) => !accts[k].rows.some((r) => monthOf(r.date) === m)).map((m) => `${k} ${m}`));
  if (answersOnly) { /* no account rows */ } else if (num === '10') K(num, 'twelve months per account except the missing May', emptyMonths.join() === 'CHQ 2025-05', emptyMonths.join());
  else K(num, 'twelve months per account (every month has rows)', emptyMonths.length === 0 && monthsNeeded.length === (num === '09' ? 9 : 12), first(emptyMonths) || `${monthsNeeded.length} months`);
  // QBO layout carries the same rows
  if (!answersOnly) K(num, 'QBO files carry the same rows in QBO layout', keys.every((k) => accts[k].qbo.length === accts[k].rows.length && accts[k].qbo.every((q, i) => q.date === accts[k].rows[i].date && q.amt === accts[k].rows[i].amt && q.desc === accts[k].rows[i].desc)));

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
  if (!answersOnly) K(num, 'every CSV row has an answer-key entry with its id, date, amount and account', bad.length === 0, first(bad));
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
  if (answersOnly) { /* no account rows */ } else if (num === '10') K(num, 'balances roll every month except the planted faults (March duplicates, missing May)', rollBad.length === 0 && planted.join() === 'CHQ 2025-03,CHQ 2025-05', first(rollBad) || planted.join());
  else K(num, 'every balance rolls month to month (opening + activity = closing, no faults planted)', rollBad.length === 0 && planted.length === 0, first(rollBad) || first(planted));

  const overdrawn = [];
  for (const k of keys) {
    const a = accts[k]; if (a.role === 'card' || a.role === 'pcard' || (num === '10' && k === 'CHQ')) continue;
    let bal = cd(a.openingBalance), min = bal; for (const r of a.rows) { bal += r.amt; if (bal < min) min = bal; }
    if (min < 0) overdrawn.push(`${k} low ${min}`);
  }
  if (!answersOnly) K(num, 'no bank or brokerage account goes overdrawn', overdrawn.length === 0, first(overdrawn));
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
  if (num === '11') {
    const t4 = (onb.payroll?.t4_summaries ?? []).find((x) => x.year === 2025); if (!t4 || t4.slips !== 1) pl.push('T4 summary 2025 with one slip');
    const c50 = (key.t2Inputs.schedule8?.classes ?? []).find((c) => c.class === '50'); if (!c50 || !c50.additions?.some((a) => cd(a.capitalCost) === 289900 && a.date === '2025-03-18')) pl.push('class 50 laptop 2899.00 on 18 Mar 2025');
    if (onb.hst?.basis !== 'regular' || onb.hst?.frequency !== 'quarterly') pl.push('HST regular, quarterly');
  }
  if (num === '12') {
    const ans = onb.answers ?? [], verb = ans.map((a) => String(a.answer_verbatim));
    for (const m of PLANTED_ANSWERS['12'].money) if (!verb.includes(m)) pl.push(`answer ${m} missing`);
    for (const n of PLANTED_ANSWERS['12'].numbers) if (!verb.some((v) => answerNumber(v) === n)) pl.push(`answer ${n} missing`);
    if (onb.hst?.registered !== false) pl.push('not HST registered (hst.registered false)');
  }
  if (num === '13') {
    const t4 = (onb.payroll?.t4_summaries ?? []).find((x) => x.year === 2025); if (!t4 || t4.slips !== 1) pl.push('T4 summary 2025 with one slip');
    const c8 = (key.t2Inputs.schedule8?.classes ?? []).find((x) => String(x.class) === '8'); if (!c8 || !c8.additions?.some((a) => cd(a.capitalCost) === 685000 && a.date === '2025-05-20')) pl.push('class 8 exam-room equipment 6850.00 (HST included) on 20 May 2025');
    if (onb.hst?.registered !== false) pl.push('not HST registered (hst.registered false)');
    const oh = key.ohip ?? {}, ras = oh.raStatements ?? [], ra = (m) => ras.find((r) => r.paymentMonth === m) ?? {};
    const R = OHIP13.reduction, S = OHIP13.resubmission;
    if (oh.reduction?.paymentMonth !== R.paymentMonth || oh.reduction?.serviceMonth !== R.serviceMonth || cd(oh.reduction?.amount ?? NaN) !== cd(R.amount) || !(ra(R.paymentMonth).reductions ?? []).some((x) => x.serviceMonth === R.serviceMonth && cd(x.amount) === cd(R.amount))) pl.push('RA reduction 1180.40 on the June 2025 RA for March 2025 services');
    if (ras.reduce((n, r) => n + (r.reductions ?? []).length, 0) !== 1) pl.push('exactly one RA reduction');
    if (oh.resubmission?.serviceMonth !== S.serviceMonth || cd(oh.resubmission?.amount ?? NaN) !== cd(S.amount) || oh.resubmission?.rejectedOn !== S.rejectedOn || oh.resubmission?.paidOn !== S.paidOn || !(ra(S.paidOn).lines ?? []).some((l) => l.serviceMonth === S.serviceMonth && cd(l.amount) === cd(S.amount)) || (ra(S.rejectedOn).lines ?? []).some((l) => l.serviceMonth === S.serviceMonth && cd(l.amount) === cd(S.amount))) pl.push('rejected claim 412.60 for August 2025, rejected on the October RA, paid on the December RA');
    const rbs = new Map((oh.revenueByServiceMonth ?? []).map((r) => [r.serviceMonth, cd(r.amount)])); if (rbs.get('2025-03') !== 3192500 || rbs.get('2025-08') !== 3122045) pl.push('revenue by service month: March 31925.00 (net of the reduction), August 31220.45 (with the resubmitted claim)');
    if (!/^MOH OHIP PAYMENT TEST$/.test(oh.payerDescription ?? '')) pl.push('payerDescription MOH OHIP PAYMENT TEST');
  }
  if (num === '14' || num === '15') {
    if (onb.hst?.basis !== 'regular' || onb.hst?.frequency !== 'annual') pl.push('HST regular, annual');
    const loan = key.trialBalance.adjusted.rows.find((r) => r.account === '2080'); if (!loan || cd(loan.credit) !== 2500000) pl.push('shareholder loan 2080 credit 25000.00 at year end');
    if (onb.owners?.length !== 1 || onb.owners[0].name !== 'Declan Murphy (Test)' || onb.owners[0].approximate_share_percent !== 100) pl.push('one owner, Declan Murphy (Test), 100%');
  }
  if (num === '14') {
    const add = (k, cost, date) => (key.t2Inputs.schedule8?.classes ?? []).find((x) => String(x.class) === k)?.additions?.some((a) => cd(a.capitalCost) === cost && a.date === date);
    if (!add('8', 1420000, '2024-04-12')) pl.push('class 8 mower 14200.00 on 12 Apr 2024');
    if (!add('10', 680000, '2024-04-26')) pl.push('class 10 trailer 6800.00 on 26 Apr 2024');
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
  if (!answersOnly) K(num, 'bank and card balances in the books equal the statement closing balances', tie.length === 0, first(tie));
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
  const cardPays = answersOnly ? 0 : key.transactions.filter((t) => t.kind === 'card-payment' && !t.external && t.amount < 0 && key.accounts.find((a) => a.key === t.acct).role === 'bank').length;
  if (!answersOnly) K(num, 'transfers and card payments appear on both sides', trBad.length === 0 && (keys.filter((k) => accts[k].role === 'card').length === 0 || cardPays >= Math.max(5, monthsNeeded.length - 3)), `${tr.length / 2} pairs, ${cardPays} card payments${num === '10' ? ', May payments missing from the chequing export by design' : ''}`);

  // names and numbers
  const nameBad = key.parties.filter((p) => !/\(Test\)$/.test(p.name)).map((p) => p.name);
  const NAMEKEYS = new Set(['legal_name', 'name', 'entity_name', 'tenant', 'lender', 'grantor', 'recipient', 'employee', 'payer', 'issuer', 'corporation', 'payee', 'payer', 'owner']);
  const walk = (v, k = '') => { if (typeof v === 'string') { if (NAMEKEYS.has(k) && !/\(Test\)$/.test(v)) nameBad.push(`${k}=${v}`); } else if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk)); };
  walk({ ...onb, prior_year_closing_balances: undefined, accounts_provided: undefined }); walk(key.t2Inputs);
  const rawBad = (profile + JSON.stringify(onb)).match(/[A-Z][A-Za-z&' -]+ (?:Inc\.|Ltd\.|LLC|LLP)(?! \(Test\))/g) ?? [];
  const proseBad = (profile + JSON.stringify(onb) + JSON.stringify(key.flags) + JSON.stringify(key.adjustingEntries) + JSON.stringify(key.notes) + JSON.stringify(key.t2Inputs)).match(/\bTest (?:Inc|Ltd|LLC|LLP)\b/g) ?? [];
  K(num, 'every person and company name ends in (Test)', nameBad.length === 0 && proseBad.length === 0 && rawBad.filter((x) => !/TEST/.test(x)).length === 0, first([...nameBad, ...proseBad, ...rawBad]));
  const descBad = [...new Set(keys.flatMap((k) => accts[k].rows.map((r) => r.desc)))].filter((s) => !/TEST/.test(s) && !CHAIN_TOKENS.some((t) => s.includes(t)) && !GENERIC_RE.test(s));
  if (!answersOnly) K(num, 'bank descriptions carry TEST or name only a common chain or bank wording', descBad.length === 0, first(descBad));
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
  K(num, 'profile.md and onboarding.json carry the planted issues, services, owners and prior-year balances', profile.includes('## Planted issues') && profile.includes(spec.name) && onb.services?.length && onb.owners?.length && (answersOnly ? onb.answers?.length : onb.prior_year_closing_balances) && onb.client_notes?.length);
  CLIENT_CHECKS[num]?.({ num, spec, dir, files, key, onb, profile, accts, keys, rollBad, planted, nameBad, proseBad, rawBad, descBad, jsonText, nines });
  } catch (e) { K(num, 'checks ran to the end without an error', false, e.message.split('\n')[0]); }
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

// ---------- W14: ARC-16 and ARC-8 across all SPEC folders ----------
{
  const k1 = Object.keys(regen.h1).sort(), k2 = Object.keys(regen.h2).sort();
  const absent = specNums.filter((n) => !k2.some((f) => f.startsWith(n + '-')));
  const differ = [...new Set([...k1, ...k2])].filter((f) => regen.h1[f] !== regen.h2[f]);
  line(!regen.err && absent.length === 0 && differ.length === 0, `ARC-16 a second generation (generate.mjs, then make-csv.mjs) is byte-identical for all ${specNums.length} folders` + (regen.err ? `: ${regen.err}` : absent.length ? `: no output for ${absent.join(', ')}` : differ.length ? `: differs in ${first(differ)}` : ` (${k2.length} files)`));
  const old = specNums.filter((n) => n <= '10').map(folderOf).filter(Boolean);
  const base = spawnSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' });
  // --ignore-cr-at-eol: main's import.csv blobs were committed with LF from a Windows checkout; make-csv.mjs writes CRLF (amber, W14 spec).
  const q = base.status === 0 ? spawnSync('git', ['diff', '--quiet', '--ignore-cr-at-eol', base.stdout.trim(), '--', ...old], { cwd: root, encoding: 'utf8' }) : null;
  const changed = !q || q.status > 1 ? null : q.status === 0 ? [] : spawnSync('git', ['diff', '--stat=200', '--ignore-cr-at-eol', base.stdout.trim(), '--', ...old], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter((l) => l.includes('|')).map((l) => l.trim());
  line(old.length === 10 && changed !== null && changed.length === 0, 'ARC-16 after regeneration, folders 01 to 10 are byte-identical to main before W14 (git diff against the merge base with origin/main)' + (old.length !== 10 ? `: ${old.length} of the ten folders found` : changed === null ? `: git failed (${(base.stderr || q?.stderr || '').trim().split('\n')[0]})` : changed.length ? `: ${first(changed)}` : ''));
  const mc = spawnSync(process.execPath, [path.join(root, 'make-csv.mjs'), '--check'], { encoding: 'utf8' });
  const noCsv = specNums.filter((n) => { const d = folderOf(n); return !d || !fs.existsSync(path.join(root, d, 'taxprep', 'import.csv')); });
  line(mc.status === 0 && noCsv.length === 0, `ARC-8 make-csv.mjs --check passes for all ${specNums.length} folders (every row equals the answer key, Schedule 100 balances, no blank cells)` + (noCsv.length ? `: no taxprep/import.csv for ${noCsv.join(', ')}` : '') + (mc.status !== 0 ? `: ${(mc.stdout || mc.stderr || '').trim().split('\n').slice(-1)[0]}` : ''));
}
// ---------- W15: folders 01 to 12 unchanged by W15 ----------
// The reference is main before W15 (the merge base with origin/main). While W14 has not landed, main has no folder 12,
// so the reference is W14's branch head instead (amber, W15 spec); once W14 is on main, main is used.
{
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  const old = specNums.filter((n) => n <= '12').map(folderOf).filter(Boolean);
  const prefix = git('rev-parse', '--show-prefix').stdout.trim();
  const has12 = (ref) => git('cat-file', '-e', `${ref}:${prefix}${SPEC['12'].dir}/answer-key.json`).status === 0;
  let refName = 'main', mb = git('merge-base', 'HEAD', 'origin/main'), ref = mb.status === 0 ? mb.stdout.trim() : null;
  if (ref && !has12(ref)) { const w = git('merge-base', 'HEAD', 'origin/claude/W14'); refName = 'claude/W14 (W14 not on main yet)'; ref = w.status === 0 && has12(w.stdout.trim()) ? w.stdout.trim() : null; }
  const q = ref ? git('diff', '--quiet', '--ignore-cr-at-eol', ref, '--', ...old) : null;
  const changed = !q || q.status > 1 ? null : q.status === 0 ? [] : git('diff', '--stat=200', '--ignore-cr-at-eol', ref, '--', ...old).stdout.split('\n').filter((l) => l.includes('|')).map((l) => l.trim());
  line(old.length === 12 && changed !== null && changed.length === 0, `ARC-16 after regeneration, folders 01 to 12 are byte-identical to ${refName} before W15 (git diff against the merge base)` + (old.length !== 12 ? `: ${old.length} of the twelve folders found` : changed === null ? ': git failed or no reference holds folder 12' : changed.length ? `: ${first(changed)}` : ''));
}
console.log(`\n${nPass} passed, ${nFail} failed`);
process.exit(nFail ? 1 : 0);
