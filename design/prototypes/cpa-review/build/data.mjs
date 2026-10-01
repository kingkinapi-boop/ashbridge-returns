// Builds the made-up returns the CPA review prototypes show, from the sample clients'
// answer keys (reference/sample-clients). Every figure is formatted once here, so one
// figure prints the same string in the brief, the section, the trace and the viewer.
// Values the answer keys do not hold (last year's income lines, tax, flag effects) are
// prototype figures, marked as such in README.md. They are not tax-checked.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../../../', import.meta.url).pathname;
const SC = join(ROOT, 'reference/sample-clients');

export const money = (n) => {
  if (n === null || n === undefined) return '';
  const r = Math.round(n * 100) / 100;
  const s = Math.abs(r).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return r < 0 ? `(${s})` : s;
};
export const change = (a, b) => {
  if (b === null || b === undefined) return 'new';
  const d = Math.round((a - b) * 100) / 100;
  if (d === 0) return 'no change';
  const s = Math.abs(d).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return d > 0 ? `+${s}` : `(${s})`;
};
const r2 = (n) => Math.round(n * 100) / 100;

function parseCsv(text) {
  return text.replace(/\r/g, '').split('\n').filter((l) => l.length).map((line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out;
  });
}

const letters = 'ABCDEFGH';
// Which column holds the amount, by export layout (README of the sample clients).
function amountCol(layout, header, amount, acct) {
  if (acct === 'BCD' || acct === 'PCD') return 3;
  if (layout.startsWith('A:')) return amount < 0 ? 2 : 3;
  if (layout.startsWith('B:')) return 3;
  if (layout.startsWith('C:')) return amount < 0 ? 2 : 3;
  return header.length - 1;
}

// A CSV source: the file read directly (EV-14), a window of rows around the boxed row.
function csvSource(clientDir, key, t) {
  const acc = key.accounts.find((a) => a.key === t.acct);
  const rows = parseCsv(readFileSync(join(SC, clientDir, acc.file), 'utf8'));
  const hasHeader = !acc.layout.startsWith('C:');
  const headerLines = acc.layout.startsWith('B:') ? 3 : hasHeader ? 1 : 0;
  const header = hasHeader ? rows[headerLines - 1] : rows[0].map((_, i) => `Column ${letters[i]}`);
  const idx = t.line - 1;
  const from = Math.max(headerLines, idx - 7); const to = Math.min(rows.length - 1, idx + 7);
  const col = amountCol(acc.layout, header, t.amount, t.acct);
  const file = acc.file.split('/').pop();
  const kind = acc.tag === 'BCD' || acc.tag === 'PCD' ? (acc.tag === 'PCD' ? "Owner's personal card download" : 'Business card download') : 'Bank download';
  return {
    type: 'csv', kind, file, party: 'third',
    caption: `${kind}, ${file}, row ${t.line}, column ${letters[col]} (${header[col] || 'amount'})`,
    header, columns: header.map((_, i) => letters[i]),
    rows: rows.slice(from, to + 1).map((cells, i) => ({ n: from + i + 1, cells })),
    boxRow: t.line, boxCol: col,
    figure: t.post ? money(Math.abs(t.amount)) : money(Math.abs(t.amount)),
    note: `Transaction ${t.id}, ${t.date}`,
  };
}

function qboSource(lineLabel, accounts, txs, total, unadj) {
  const rows = txs.slice(0, 14).map((t, i) => {
    const p = t.post.find((x) => accounts.includes(x.a));
    const amt = p ? (p.dr || 0) - (p.cr || 0) : 0;
    return { n: i + 2, cells: [t.date, t.description.slice(0, 38), money(amt)] };
  });
  const more = txs.length - rows.length;
  if (more > 0) rows.push({ n: rows.length + 2, cells: ['', `${more} more rows`, ''] });
  rows.push({ n: rows.length + 2, cells: ['', `Total for ${accounts.join(', ')}`, money(unadj)] });
  return {
    type: 'csv', kind: 'QuickBooks general ledger export', file: `general-ledger-${accounts[0]}.csv`, party: 'books',
    caption: `QuickBooks general ledger export, account ${accounts.join(', ')}, total row ${rows[rows.length - 1].n}, column C`,
    header: ['Date', 'Description', 'Amount'], columns: ['A', 'B', 'C'],
    rows, boxRow: rows[rows.length - 1].n, boxCol: 2, figure: money(unadj),
    note: `${txs.length} transaction${txs.length === 1 ? '' : 's'} coded to ${lineLabel} in QuickBooks before adjusting entries`,
  };
}

function ajeSource(e, accounts) {
  const lines = e.lines.map((l) => [`${l.account} ${l.name}`, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : '']);
  return {
    type: 'card', kind: 'Adjusting entry', party: 'judgment',
    caption: `Adjusting entry ${e.id}, ${e.date}`,
    title: `Adjusting entry ${e.id}`,
    fields: [['Date', e.date], ['Reason', e.reason], ['Booked by', 'Dana Price (Test)']],
    table: { head: ['Account', 'Debit', 'Credit'], rows: lines, box: e.lines.findIndex((l) => accounts.includes(l.account)) },
  };
}

function lastYearSource(name, ye, ly) {
  return {
    type: 'card', kind: "Last year's assessed return", party: 'lastyear',
    caption: `Last year's return, ${ye}, Schedule 100`,
    title: "Last year's return and notice of assessment",
    fields: [['Year end', ye], ['Closing figure', money(ly)], ['Assessed', 'Notice of assessment on file, no change']],
  };
}

const answerSource = (title, quote, field) => ({
  type: 'card', kind: 'Client answer', party: 'client',
  caption: `Client answer, onboarding, ${field}`, title, quote,
  fields: [['Given in', 'Onboarding, client app'], ['Field', field]],
});
const judgmentSource = (title, fields) => ({
  type: 'card', kind: 'Judgment input', party: 'judgment', caption: `Judgment input, ${title}`, title, fields,
});
const craSource = (title, fields) => ({
  type: 'card', kind: 'CRA data capture', party: 'third', caption: `CRA data capture, ${title}`, title, fields,
});
const docSource = (title, pageLabel, lines, box) => ({
  type: 'doc', kind: 'Document', party: 'client', caption: `${title}, ${pageLabel}`, title, pageLabel, lines, box,
});

// Deterministic made-up last-year factor per code (prototype figure, see README.md).
const lyFactor = (code) => { let h = 0; for (const c of String(code)) h = (h * 31 + c.charCodeAt(0)) % 997; return 0.78 + (h % 33) / 100; };

const GIFI_NAMES = {
  1002: 'Deposits in Canadian banks, Canadian currency', 1003: 'Deposits in Canadian banks, foreign currency',
  1062: 'Accounts receivable', 1301: 'Due from shareholders', 1484: 'Prepaid expenses',
  1740: 'Machinery, equipment, furniture and fixtures', 1741: 'Accumulated amortization of machinery, equipment, furniture and fixtures',
  1774: 'Computer equipment', 1775: 'Accumulated amortization of computer equipment',
  2599: 'Total assets', 2620: 'Amounts payable and accrued liabilities', 2627: 'Payroll deductions payable', 2628: 'Income tax withheld payable',
  2680: 'Taxes payable (HST)', 2707: 'Credit card loans', 2781: 'Due to shareholders', 3499: 'Total liabilities',
  3500: 'Common shares', 3620: 'Total shareholder equity', 3640: 'Total liabilities and shareholder equity',
  3660: 'Retained earnings, start', 3680: 'Net income', 3700: 'Dividends declared', 3849: 'Retained earnings, end',
  8000: 'Trade sales of goods and services', 8231: 'Foreign exchange gain (loss)', 8299: 'Total revenue',
  8523: 'Meals and entertainment', 8590: 'Bad debt expense', 8622: 'Employer CPP and EI', 8670: 'Amortization of tangible assets',
  8690: 'Insurance', 8715: 'Bank charges', 8810: 'Office expenses', 8811: 'Office stationery and supplies',
  8862: 'Accounting fees', 8911: 'Real estate rental', 9060: 'Salaries and wages', 9065: 'Management salaries',
  9130: 'Supplies', 9150: 'Computer-related expenses', 9152: 'Internet', 9200: 'Travel expenses', 9201: 'Meetings and conventions',
  9225: 'Telephone and telecommunications', 9275: 'Delivery, freight and express', 9368: 'Total expenses', 9945: 'Business-use-of-home expenses',
  9999: 'Net income after taxes',
};

// Dots (EV-11): green agrees with a third party; grey single third-party or last year's assessed;
// amber rests only on the client; purple rests on judgment. Prototype assignment per code.
const DOTS = {
  '01': { 1002: 'green', 1301: 'amber', 2707: 'green', 2680: 'grey', 3500: 'grey', 3660: 'grey', 3700: 'amber', 8000: 'grey', 8523: 'green', 9150: 'amber', 9945: 'purple' },
  '08': { 1002: 'green', 1003: 'green', 1062: 'amber', 1484: 'grey', 1740: 'grey', 1741: 'purple', 1774: 'grey', 1775: 'purple', 2620: 'purple', 2627: 'grey', 2628: 'grey', 2680: 'grey', 2707: 'green', 2781: 'amber', 3500: 'grey', 3660: 'grey', 8000: 'green', 8231: 'purple', 8590: 'amber', 8670: 'purple', 9060: 'green', 9065: 'green' },
};
const RANK = { purple: 4, amber: 3, grey: 2, green: 1 };
const weakest = (dots) => dots.filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] || 'grey';

export function buildReturn(cfg) {
  const key = JSON.parse(readFileSync(join(SC, cfg.dir, 'answer-key.json'), 'utf8'));
  const onb = JSON.parse(readFileSync(join(SC, cfg.dir, 'onboarding.json'), 'utf8'));
  const tb = key.trialBalance.adjusted.rows.map((r) => ({ ...r }));
  const extraAje = cfg.extraAje || [];
  for (const e of extraAje) for (const l of e.lines) {
    let row = tb.find((r) => r.account === l.account);
    if (!row) { row = { account: l.account, name: l.name, gifi: l.gifi, debit: 0, credit: 0 }; tb.push(row); }
    row.debit = r2(row.debit + (l.debit || 0)); row.credit = r2(row.credit + (l.credit || 0));
  }
  const opening = key.trialBalance.opening.rows;
  const ajes = [...key.adjustingEntries, ...extraAje];
  const dotMap = DOTS[cfg.client];
  const flagsByCode = cfg.flagsByCode || {};
  const balOf = (rows, gifi) => rows.filter((r) => r.gifi === gifi).reduce((s, r) => s + r.debit - r.credit, 0);

  const mkLine = (section, code, value, ly, opts = {}) => {
    const accounts = tb.filter((r) => r.gifi === code).map((r) => r.account);
    const line = {
      key: `${section}-${code}`, section, code: String(code), label: opts.label || GIFI_NAMES[code] || String(code),
      value: r2(value), ly: ly === null ? null : r2(ly), v: money(value), lyv: ly === null ? 'none' : money(ly),
      ch: change(value, ly), dot: opts.dot || dotMap[code] || 'grey', flags: flagsByCode[code] || [], total: !!opts.total,
      built: opts.built || [], agrees: opts.agrees || [], notes: opts.notes || [], sources: opts.sources || [],
      noEvidence: !!opts.noEvidence, feeds: opts.feeds || null,
    };
    if (!opts.sources && !opts.total && accounts.length) {
      const txs = key.transactions.filter((t) => t.post && t.post.some((p) => accounts.includes(p.a)));
      const unadj = txs.reduce((s, t) => s + t.post.filter((p) => accounts.includes(p.a)).reduce((x, p) => x + (p.dr || 0) - (p.cr || 0), 0), 0);
      const sign = section === 's100' ? (code >= 2600 && code < 3700 ? -1 : 1) : (code >= 8000 && code < 8300 ? -1 : 1);
      const openBal = balOf(opening, code);
      const ajeHits = ajes.filter((e) => e.lines.some((l) => accounts.includes(l.account)));
      if (txs.length) line.sources.push(qboSource(line.label, accounts, txs, value, r2(sign * unadj)));
      const seen = new Set();
      for (const t of txs) { if (seen.has(t.acct) || seen.size >= 2) continue; seen.add(t.acct); line.sources.push(csvSource(cfg.dir, key, t)); }
      for (const e of ajeHits) line.sources.push(ajeSource(e, accounts));
      if (section === 's100' && openBal !== 0) line.sources.push(lastYearSource(key.name, cfg.lyYe, Math.abs(openBal)));
      line.built = [];
      if (section === 's100' && openBal) line.built.push([`Opening balance from last year's return`, money(sign * openBal)]);
      if (txs.length) line.built.push([`QuickBooks, ${txs.length} transaction${txs.length === 1 ? '' : 's'} in ${accounts.join(', ')}`, money(r2(sign * unadj))]);
      for (const e of ajeHits) {
        const amt = e.lines.filter((l) => accounts.includes(l.account)).reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0);
        line.built.push([`Adjusting entry ${e.id}`, money(r2(sign * amt))]);
      }
      if (!line.agrees.length) {
        const bank = line.sources.filter((s) => s.party === 'third');
        if (line.dot === 'green' && bank.length) line.agrees.push(`${bank[0].kind} totals agree with QuickBooks to the cent`);
        else if (line.dot === 'grey') line.agrees.push('One third-party source; nothing else to agree with');
        else if (line.dot === 'amber') line.agrees.push('Rests on what the client said; no third-party source agrees');
        else if (line.dot === 'purple') line.agrees.push('Rests on judgment; see the judgment input');
      }
    }
    if (opts.extraSources) line.sources.push(...opts.extraSources);
    if (opts.failed) line.sources.splice(1, 0, opts.failed);
    if (opts.noEvidence) { line.sources = []; line.built = [[`QuickBooks, account total`, line.v]]; line.agrees = []; line.dot = 'none'; }
    return line;
  };

  // Section: balance sheet (GIFI Schedule 100), in printed order.
  const assetCodes = [...new Set(tb.filter((r) => r.gifi < 2600).map((r) => r.gifi))].sort((a, b) => a - b);
  const liabCodes = [...new Set(tb.filter((r) => r.gifi >= 2600 && r.gifi < 3500).map((r) => r.gifi))].sort((a, b) => a - b);
  const s100 = [];
  let ta = 0; let taLy = 0;
  for (const c of assetCodes) { const v = balOf(tb, c); const ly = balOf(opening, c); ta += v; taLy += ly; s100.push(mkLine('s100', c, v, ly, cfg.lineOpts?.[c])); }
  s100.push(mkLine('s100', 2599, ta, taLy, { total: true, feeds: assetCodes.map((c) => `s100-${c}`), built: [['Sum of the asset lines above', money(ta)]] }));
  let tl = 0; let tlLy = 0;
  for (const c of liabCodes) { const v = -balOf(tb, c); const ly = -balOf(opening, c); tl += v; tlLy += ly; s100.push(mkLine('s100', c, v, ly, cfg.lineOpts?.[c])); }
  s100.push(mkLine('s100', 3499, tl, tlLy, { total: true, feeds: liabCodes.map((c) => `s100-${c}`), built: [['Sum of the liability lines above', money(tl)]] }));
  const shares = -balOf(tb, 3500); const sharesLy = -balOf(opening, 3500);
  s100.push(mkLine('s100', 3500, shares, sharesLy));

  // Income statement (GIFI Schedule 125).
  const revCodes = [...new Set(tb.filter((r) => r.gifi >= 8000 && r.gifi < 8300).map((r) => r.gifi))].sort((a, b) => a - b);
  const expCodes = [...new Set(tb.filter((r) => r.gifi >= 8300 && r.gifi < 9999).map((r) => r.gifi))].sort((a, b) => a - b);
  const s125 = [];
  let rev = 0; let revLy = 0;
  for (const c of revCodes) {
    const v = -balOf(tb, c); const ly = cfg.lyOverride?.[c] ?? r2(v * lyFactor(c)); rev += v; revLy += ly;
    s125.push(mkLine('s125', c, v, ly, cfg.lineOpts?.[c]));
  }
  s125.push(mkLine('s125', 8299, rev, revLy, { total: true, feeds: revCodes.map((c) => `s125-${c}`), built: [['Sum of the revenue lines above', money(rev)]] }));
  let exp = 0; let expLy = 0;
  for (const c of expCodes) {
    const v = balOf(tb, c); const ly = cfg.newCodes?.includes(c) ? null : (cfg.lyOverride?.[c] ?? r2(v * lyFactor(c)));
    exp += v; expLy += ly || 0; s125.push(mkLine('s125', c, v, ly, cfg.lineOpts?.[c]));
  }
  exp = r2(exp); expLy = r2(expLy);
  s125.push(mkLine('s125', 9368, exp, expLy, { total: true, feeds: expCodes.map((c) => `s125-${c}`), built: [['Sum of the expense lines above', money(exp)]] }));
  const ni = r2(rev - exp); const niLy = r2(revLy - expLy);
  s125.push(mkLine('s125', 9999, ni, niLy, { total: true, feeds: ['s125-8299', 's125-9368'], built: [['Total revenue', money(rev)], ['Less total expenses', money(-exp)]] }));

  // Retained earnings, on Schedule 100.
  const reOpen = -balOf(opening, 3600); const div = balOf(tb, 3700);
  const reLyOpen = 0; const divLy = r2(reLyOpen + niLy - reOpen);
  s100.push(mkLine('s100', 3660, reOpen, reLyOpen, { sources: [lastYearSource(key.name, cfg.lyYe, reOpen)], built: [["Closing retained earnings on last year's return", money(reOpen)]], agrees: ["Agrees with last year's assessed return"] }));
  s100.push(mkLine('s100', 3680, ni, niLy, { total: true, feeds: ['s125-9999'], built: [['Net income, Schedule 125 line 9999', money(ni)]] }));
  s100.push(mkLine('s100', 3700, div, divLy, cfg.lineOpts?.[3700]));
  const reEnd = r2(reOpen + ni - div); const reEndLy = reOpen;
  s100.push(mkLine('s100', 3849, reEnd, reEndLy, { total: true, feeds: ['s100-3660', 's100-3680', 's100-3700'], built: [['Retained earnings, start', money(reOpen)], ['Plus net income', money(ni)], ['Less dividends declared', money(-div)]] }));
  const te = r2(shares + reEnd); const teLy = r2(sharesLy + reEndLy);
  s100.push(mkLine('s100', 3620, te, teLy, { total: true, feeds: ['s100-3500', 's100-3849'], built: [['Common shares', money(shares)], ['Retained earnings, end', money(reEnd)]] }));
  s100.push(mkLine('s100', 3640, r2(tl + te), r2(tlLy + teLy), { total: true, feeds: ['s100-3499', 's100-3620'], built: [['Total liabilities', money(tl)], ['Total shareholder equity', money(te)]], agrees: [`Agrees with total assets, ${money(ta)}`] }));

  // Schedule 1.
  const s1 = [];
  const meals = balOf(tb, 8523); const mealsLy = s125.find((l) => l.code === '8523')?.ly || 0;
  const amort = balOf(tb, 8670); const amortLy = s125.find((l) => l.code === '8670')?.ly || 0;
  const cca = cfg.cca ? r2(cfg.cca.reduce((s, c) => s + c.cca, 0)) : 0; const ccaLy = cfg.cca ? r2(cfg.cca.reduce((s, c) => s + c.ccaLy, 0)) : 0;
  const s1Line = (code, label, v, ly, opts) => mkLine('s1', code, v, ly, { label, ...opts });
  s1.push(s1Line('A', 'Net income after taxes per financial statements', ni, niLy, { total: true, feeds: ['s125-9999'], built: [['Schedule 125, line 9999', money(ni)]] }));
  let add = 0; let addLy = 0;
  if (amort) { add += amort; addLy += amortLy; s1.push(s1Line('104', 'Amortization of tangible assets', amort, amortLy, { dot: 'purple', built: [['Schedule 125, line 8670', money(amort)]], agrees: ['Same figure as the income statement'], sources: [ajeSource(ajes.find((e) => e.lines.some((l) => l.account === '6050')), ['6050'])] })); }
  const mealsHalf = r2(meals / 2); const mealsHalfLy = r2(mealsLy / 2); add += mealsHalf; addLy += mealsHalfLy;
  s1.push(s1Line('121', 'Non-deductible meals and entertainment', mealsHalf, mealsHalfLy, { feeds: ['s125-8523'], built: [['Schedule 125, line 8523', money(meals)], ['Half is not deductible', money(mealsHalf)]], agrees: ['Rule check: 50% of line 8523, to the cent'], sources: [] }));
  add = r2(add); addLy = r2(addLy);
  s1.push(s1Line('500', 'Total additions', add, addLy, { total: true, feeds: ['s1-104', 's1-121'], built: [['Sum of the additions above', money(add)]] }));
  let ded = 0; let dedLy = 0;
  if (cca) { ded += cca; dedLy += ccaLy; s1.push(s1Line('403', 'Capital cost allowance from Schedule 8', cca, ccaLy, { feeds: ['s8-total'], built: [['Schedule 8, total CCA claimed', money(cca)]], agrees: ['Same figure as Schedule 8'], sources: [] })); }
  s1.push(s1Line('510', 'Total deductions', ded, dedLy, { total: true, feeds: ['s1-403'], built: [['Sum of the deductions above', money(ded)]] }));
  const nit = r2(ni + add - ded); const nitLy = r2(niLy + addLy - dedLy);
  s1.push(s1Line('C', 'Net income for income tax purposes', nit, nitLy, { total: true, feeds: ['s1-A', 's1-500', 's1-510'], built: [['Line A', money(ni)], ['Plus total additions', money(add)], ['Less total deductions', money(-ded)]] }));

  const sections = [
    { id: 's100', title: 'Balance sheet', form: 'GIFI Schedule 100', lines: s100 },
    { id: 's125', title: 'Income statement', form: 'GIFI Schedule 125', lines: s125 },
    { id: 's1', title: 'Schedule 1', form: 'Net income for tax purposes', lines: s1 },
  ];
  if (cfg.cca) {
    const s8 = [];
    for (const c of cfg.cca) {
      s8.push(mkLine('s8', `${c.cls}-open`, c.open, c.openLy, { label: `Class ${c.cls}: opening UCC`, dot: 'grey', sources: [lastYearSource(key.name, cfg.lyYe, c.open)], built: [["Closing UCC on last year's Schedule 8", money(c.open)]], agrees: ["Agrees with last year's assessed return"] }));
      s8.push(mkLine('s8', `${c.cls}-add`, c.add, 0, { label: `Class ${c.cls}: additions (${c.what})`, dot: 'green', sources: c.addTx.map((id) => csvSource(cfg.dir, key, key.transactions.find((t) => t.id === id))), built: [[`${c.what}, before HST`, money(c.add)]], agrees: ['Card download agrees with QuickBooks fixed asset entry'] }));
      s8.push(mkLine('s8', `${c.cls}-cca`, c.cca, c.ccaLy, { label: `Class ${c.cls}: CCA claimed`, dot: 'purple', sources: [judgmentSource(`CCA claim, class ${c.cls}`, [['Claim', 'Full amount available'], ['Decided by', 'Dana Price (Test)'], ['Figure', `${money(c.cca)} (Taxprep's figure; prototype value, not tax-checked)`]])], built: [["Taxprep's calculation", money(c.cca)]] }));
      s8.push(mkLine('s8', `${c.cls}-close`, r2(c.open + c.add - c.cca), c.open, { label: `Class ${c.cls}: closing UCC`, total: true, feeds: [`s8-${c.cls}-open`, `s8-${c.cls}-add`, `s8-${c.cls}-cca`], built: [['Opening UCC plus additions less CCA', money(r2(c.open + c.add - c.cca))]] }));
    }
    s8.push(mkLine('s8', 'total', cca, ccaLy, { label: 'Total CCA claimed', total: true, feeds: cfg.cca.map((c) => `s8-${c.cls}-cca`), built: cfg.cca.map((c) => [`Class ${c.cls}`, money(c.cca)]) }));
    sections.push({ id: 's8', title: 'Schedule 8', form: 'Capital cost allowance', lines: s8 });
  }
  if (div) {
    const dt = key.transactions.find((t) => t.id === key.t2Inputs.schedule3.dividendsPaid[0].transaction);
    sections.push({ id: 's3', title: 'Schedule 3', form: 'Dividends paid', lines: [
      mkLine('s3', '3-paid', div, null, { label: 'Taxable dividends paid, other than eligible', dot: 'amber', sources: [csvSource(cfg.dir, key, dt), answerSource('Dividend declared', 'The $20,000 on 20 December was a dividend.', 'declared_dividends'), docSource("Directors' resolution, 20 Dec 2025", 'page 1 of 1', [['Resolved: a dividend on common shares of', money(div)], ['Payable on', '20 Dec 2025'], ['Designation', 'Other than eligible']], 0)], built: [['Dividend paid 20 Dec 2025', money(div)]], agrees: ['Bank download shows the payment; the resolution is a client document'] }),
      mkLine('s3', '3-elig', 0, 0, { label: 'Eligible dividends paid', dot: 'grey', built: [['None declared', money(0)]] }),
    ] });
  }
  sections.push({ id: 's50', title: 'Schedule 50', form: 'Shareholder information (printed page)', printed: true, lines: [
    mkLine('s50', '50-1', 100, 100, { label: `${key.t2Inputs.schedule50[0].name}, common shares %`, dot: 'grey', sources: [docSource('Schedule 50, printed return', 'page 1 of 1', [['Name of shareholder', key.t2Inputs.schedule50[0].name], ['SIN', 'masked, ends ' + key.t2Inputs.schedule50[0].sin.slice(-3)], ['Percentage common shares', '100.000'], ['Percentage preferred shares', '0.000']], 2)], built: [['Share register in onboarding', '100.00']], agrees: ["Agrees with last year's Schedule 50"] }),
  ] });

  // Flags on lines (EV-12): a separate red flag, never a dot colour.
  const allLines = sections.flatMap((s) => s.lines);
  for (const l of allLines) {
    const fl = (cfg.flags || []).filter((f) => f.on.includes(l.key)).map((f) => f.id);
    l.flags = fl;
  }
  for (const [k, v] of Object.entries(cfg.mutate || {})) { const l = allLines.find((x) => x.key === k); if (l) v(l); }
  // Dot of a total or a computed line: the weakest of what feeds it (EV-11). A not-checked line
  // does not set a total's dot; the brief lists it under the attestations instead.
  const byKey = new Map(allLines.map((l) => [l.key, l]));
  for (let pass = 0; pass < 4; pass++) for (const l of allLines) if (l.feeds) {
    const fed = l.feeds.map((k) => byKey.get(k)).filter(Boolean);
    l.dot = weakest(fed.map((x) => x.dot).filter((d) => d !== 'none'));
    l.feedLinks = fed.map((x) => ({ key: x.key, code: x.code, label: x.label, v: x.v }));
  }

  // Highlighting by tier (RV-8). Prototype reading of "changed": moved more than 10% and more than 1,000.00.
  for (const l of allLines) {
    const reasons = [];
    if (l.flags.length) reasons.push('pinned flag');
    if (cfg.tier !== 'green' && l.dot === 'amber') reasons.push('amber dot');
    if (cfg.tier === 'red' && !l.total && (l.ly === null || (Math.abs(l.value - l.ly) > 1000 && Math.abs(l.value - l.ly) > Math.abs(l.ly) * 0.1))) reasons.push('changed since last year');
    if (cfg.tier === 'red' && l.dot === 'purple') reasons.push('judgment');
    l.hi = reasons;
  }

  const fed = r2(nit * 0.09); const on = r2(nit * 0.032); const fedLy = r2(nitLy * 0.09); const onLy = r2(nitLy * 0.032);
  const inst = cfg.instalments || 0; const instLy = cfg.instalmentsLy || 0;
  const six = [
    ['Net income', ni, niLy, 's125-9999'], ['Taxable income', nit, nitLy, 's1-C'],
    ['Federal tax', fed, fedLy, null], ['Ontario tax', on, onLy, null],
    ['Instalments paid', inst, instLy, null], ['Balance owing', r2(fed + on - inst), r2(fedLy + onLy - instLy), null],
  ].map(([label, v, ly, line]) => ({ label, value: v, v: money(v), lyv: money(ly), ch: change(v, ly), line }));

  return {
    id: cfg.id, client: cfg.client, name: key.name, ye: cfg.ye, yeIso: key.fiscalYear.end, tier: cfg.tier, tierWhy: cfg.tierWhy,
    preparer: 'Dana Price (Test)', state: cfg.state, sections, six, flags: (cfg.flags || []).map((f) => ({ ...f, dollar: f.dollar === null ? 'not estimated' : money(f.dollar) })),
    changesLy: cfg.changesLy, assumptions: cfg.assumptions, attestations: cfg.attestations, comments: cfg.comments || [], history: cfg.history || [],
    seedReviewed: cfg.seedReviewed || {}, removedMarks: cfg.removedMarks || {}, rework: cfg.rework || null, notes: onb.client_notes,
  };
}
