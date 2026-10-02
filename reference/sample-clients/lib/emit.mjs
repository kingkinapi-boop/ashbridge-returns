// Finish a client (order rows, give every row its id, roll balances, build the trial balance) and write the files.
import fs from 'node:fs';
import path from 'node:path';
import { dmy, mdy, fmt, csvLine, pretty, monthKey, sum, longDate, dol as D, addDays, nextBiz, diffDays } from './util.mjs';
import { GL, GIFI, gifiFor, isPL } from './chart.mjs';
import { HSTGL } from './engine.mjs';

export const IDRULE = 'id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.';
const LAYOUT = { A: 'A: Lakeview Bank (Test) chequing', B: 'B: Maplestone Bank (Test) chequing', C: 'C: Harbourline Credit Union (Test) chequing', CARD: 'Aurora Card (Test)', BROKER: 'Crestview Investing (Test)' };
const HEAD = { A: 1, B: 3, C: 0, CARD: 1, BROKER: 1 }; // header lines before the first data row
export const descOf = (t) => [t.d1, t.d2].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
const glLabel = (gl) => `${gl} ${GL[gl].name}`;

export function finalize(c) {
  const accts = Object.values(c.accts);
  const byDate = (x, y) => x.date.localeCompare(y.date) || x.n - y.n;
  // 1. opening balance of every bank-type account: just enough to keep the balance above its floor
  for (const a of accts) {
    if (a.opening != null) continue;
    let cum = 0, min = 0;
    for (const t of c.txs.filter((t) => t.acct === a.key && t.real).sort(byDate)) { cum += t.amt; if (cum < min) min = cum; }
    a.opening = a.floor - min + a.extra + c.rng.cents(0, 999);
  }
  // 2. file order, ids, running balances, statement table
  for (const a of accts) {
    const rows = c.txs.filter((t) => t.acct === a.key);
    const cmp = (x, y) => (x.sortDate ?? x.date).localeCompare(y.sortDate ?? y.date) || (x.sortN ?? x.n) - (y.sortN ?? y.n);
    a.export = rows.filter((t) => t.inExport).sort(cmp);
    a.missing = rows.filter((t) => !t.inExport).sort(byDate);
    const cnt = {};
    for (const t of [...a.export, ...a.missing]) {
      const k = monthKey(t.date); cnt[k] = (cnt[k] ?? 0) + 1;
      t.id = `${c.num}-${a.tag}-${k}-${String(cnt[k]).padStart(4, '0')}`;
    }
    const sgn = a.role === 'card' || a.role === 'pcard' ? -1 : 1;
    a.sgn = sgn;
    let bal = a.opening;
    for (const t of a.export) {
      if (t.real) bal += sgn * t.amt;
      t.bal = bal;
      if (a.kind === 'CARD') {
        if (t.pdate) continue;
        let p = t.kind === 'card-payment' ? t.date : nextBiz(addDays(t.date, c.rng.int(0, 2)));
        if (monthKey(p) !== monthKey(t.date)) p = t.date;
        t.pdate = p;
      }
    }
    const real = rows.filter((t) => t.real);
    const before = (d) => a.opening + sgn * sum(real.filter((t) => t.date < d), (t) => t.amt);
    a.statements = c.months.map((m) => {
      const opening = before(m.first);
      const closing = opening + sgn * sum(real.filter((t) => monthKey(t.date) === m.key), (t) => t.amt);
      const act = sum(a.export.filter((t) => monthKey(t.date) === m.key), (t) => t.amt);
      return { month: m.key, opening, closing, exportActivity: act, rolls: opening + sgn * act === closing };
    });
    a.closing = a.statements.length ? a.statements[a.statements.length - 1].closing : a.opening;
    a.outOfPeriod = a.export.filter((t) => t.date < c.fyStart || t.date > c.fyEnd);
  }
  // 3. postings (the funding line is the account itself)
  for (const t of c.txs) {
    const a = c.accts[t.acct];
    if (t.lines && t.real && !t.mirror) {
      const cad = c.cad(a, t.amt, t.date);
      t.post = [...t.lines.map((l) => ({ gl: l.gl, dr: l.dr ?? 0, cr: l.cr ?? 0 })), { gl: a.gl, dr: cad > 0 ? cad : 0, cr: cad < 0 ? -cad : 0 }];
    } else t.post = [];
  }
  // 4. opening trial balance: the client's own openings, the bank and card balances, and retained earnings as the plug
  const open = { ...c.opening };
  if (open['3600']) throw new Error('retained earnings opening is a plug');
  const bump = (m, gl, v) => { m[gl] = (m[gl] ?? 0) + v; };
  for (const a of accts) {
    if (a.role === 'bank' || a.role === 'broker') bump(open, a.gl, a.currency === 'USD' ? Math.round(a.opening * (c.rates.open ?? c.rate(c.fyStart))) : a.opening);
    else if (a.role === 'card') bump(open, a.gl, -a.opening);
  }
  open['3600'] = -sum(Object.values(open));
  const unadj = { ...open };
  for (const t of c.txs) for (const l of t.post) bump(unadj, l.gl, l.dr - l.cr);
  const adj = { ...unadj };
  for (const j of c.ajes) for (const l of j.lines) bump(adj, l.gl, (l.dr ?? 0) - (l.cr ?? 0));
  const tbRows = (m, srcMap = c.glSource) => {
    const rows = Object.keys(m).filter((k) => m[k] !== 0).sort().map((gl) => {
      const g = GL[gl]; const net = m[gl]; const code = gifiFor(gl, net);
      return { account: gl, name: g.name, gifi: code ?? null, gifiName: code ? GIFI[code] : null, gifiStatus: code ? g.st : 'confirm', ...(g.st === 'confirm' && g.note ? { note: g.note } : {}), ...(srcMap?.[gl] ? { source: srcMap[gl] } : {}), debit: net > 0 ? D(net) : 0, credit: net < 0 ? D(-net) : 0 };
    });
    const dr = sum(Object.values(m).filter((v) => v > 0)), cr = -sum(Object.values(m).filter((v) => v < 0));
    if (dr !== cr) throw new Error(`${c.num}: trial balance does not balance: dr ${dr} cr ${cr}`);
    return { rows, totalDebit: D(dr), totalCredit: D(cr) };
  };
  const fin = { open, unadj, adj, tb: { opening: tbRows(open, c.openSource ?? c.glSource), unadjusted: tbRows(unadj, c.openSource ?? c.glSource), adjusted: tbRows(adj) } };
  fin.netIncome = -sum(Object.keys(adj).filter(isPL), (g) => adj[g]);
  // 5. HST summary
  let coll = 0, itc = 0, remit = 0;
  for (const t of c.txs) for (const l of t.post) if (l.gl === HSTGL) {
    if (['hst-remit', 'hst-refund', 'hst-instalment'].includes(t.kind)) remit += l.dr - l.cr; else { coll += l.cr; itc += l.dr; }
  }
  fin.hst = { method: c.hstMethod, collectedOnSales: D(coll), itcClaimedOnPurchases: D(itc), paidToCraNetOfRefunds: D(remit), balanceAtYearEndPayable: D(-adj[HSTGL] || 0) };
  fin.ajeOf = new Map();
  for (const j of c.ajes) for (const t of j.tx) if (typeof t === 'object' && !fin.ajeOf.has(t)) fin.ajeOf.set(t, j.id);
  return fin;
}

// ---------- CSV ----------
export function accountCsv(a) {
  const L = [];
  if (a.kind === 'A') L.push(csvLine(['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance']));
  if (a.kind === 'B') { L.push('Chequing'); L.push(`XXXXXXX${a.last4}`); L.push(csvLine(['Transaction Date', 'Description 1', 'Description 2', a.currency === 'USD' ? 'USD$' : 'CAD$'])); }
  if (a.kind === 'CARD') L.push(csvLine(['Transaction Date', 'Posting Date', 'Description', 'Amount']));
  if (a.kind === 'BROKER') L.push(csvLine(['Date', 'Activity', 'Security', 'Quantity', 'Amount', 'Cash Balance']));
  for (const t of a.export) {
    if (a.kind === 'A') L.push(csvLine([t.date, descOf(t), t.amt < 0 ? fmt(-t.amt) : '', t.amt > 0 ? fmt(t.amt) : '', fmt(t.bal)]));
    else if (a.kind === 'B') L.push(csvLine([mdy(t.date), t.d1, t.d2, fmt(t.amt)]));
    else if (a.kind === 'C') L.push(csvLine([dmy(t.date), descOf(t), t.amt < 0 ? fmt(-t.amt) : '', t.amt > 0 ? fmt(t.amt) : '']));
    else if (a.kind === 'CARD') L.push(csvLine([t.date, t.pdate ?? t.date, descOf(t), fmt(-t.amt)]));
    else if (a.kind === 'BROKER') L.push(csvLine([t.date, t.d1, t.d2, t.qty ?? '', fmt(t.amt), fmt(t.bal)]));
  }
  return L.join('\n') + '\n';
}
export function qboCsv(a) {
  return [csvLine(['Date', 'Description', 'Amount']), ...a.export.map((t) => csvLine([dmy(t.date), descOf(t), fmt(t.amt)]))].join('\n') + '\n';
}

// ---------- answer key ----------
const postOut = (post) => post.filter((l) => l.dr || l.cr).map((l) => { const o = { a: l.gl }; if (l.dr) o.dr = D(l.dr); if (l.cr) o.cr = D(l.cr); return o; });
function mainGl(t) {
  if (['transfer', 'card-payment', 'transfer-fx'].includes(t.kind)) return (t.lines ?? []).find((l) => l.gl !== '4310')?.gl ?? null;
  const cand = (t.lines ?? []).filter((l) => l.gl !== HSTGL);
  if (!cand.length) return null;
  cand.sort((x, y) => (y.dr ?? 0) + (y.cr ?? 0) - ((x.dr ?? 0) + (x.cr ?? 0)));
  return cand[0].gl;
}

// Turn transaction objects into their ids and call lazy values (functions of the finished books) before writing JSON.
export function res(v, fin, c) {
  if (typeof v === 'function') return res(v(fin, c), fin, c);
  if (v && typeof v === 'object') {
    if (v.n !== undefined && v.acct !== undefined && v.d2 !== undefined) return v.id;
    if (Array.isArray(v)) return v.map((x) => res(x, fin, c));
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, res(x, fin, c)]));
  }
  return v;
}

export function buildKey(c, fin) {
  const entries = [];
  const info = (gl) => ({ account: glLabel(gl), accountNo: gl, gifi: GL[gl].gifiCr ? `${GL[gl].gifiCr} when payable, ${GL[gl].gifiDr} when receivable` : GL[gl].gifi, gifiStatus: GL[gl].st });
  for (const a of Object.values(c.accts)) {
    const off = HEAD[a.kind];
    [...a.export, ...a.missing].forEach((t, i) => {
      const inExp = t.inExport;
      const idx = a.export.indexOf(t);
      const e = { id: t.id, acct: a.key, date: t.date, description: descOf(t), amount: D(t.amt), currency: a.currency, kind: t.kind ?? 'other' };
      if (inExp) { e.line = idx + 1 + off; e.qboLine = idx + 2; } else { e.missingFromExport = true; }
      let gl = null;
      if (t.personal) { Object.assign(e, { account: 'PERSONAL: not a company transaction', accountNo: null, gifi: null, personal: true }); if (t.external) e.external = 'paid from the owner\'s own bank, not in this data'; }
      else if (t.meta.priorYear) Object.assign(e, { account: 'PRIOR YEAR: already in the opening balances, not this year', accountNo: null, gifi: null, priorYear: true });
      else if (t.meta.dupOf) { const o = t.meta.dupOf; gl = mainGl(o) ?? null; e.dupOf = o.id; Object.assign(e, gl ? info(gl) : { account: 'DUPLICATE', accountNo: null, gifi: null }); e.note0 = 'duplicate line: post nothing'; }
      else if (t.mirror) { gl = t.pair ? c.accts[t.pair.acct].gl : null; Object.assign(e, info(gl)); e.mirror = true; e.pair = t.pair.id; e.postedVia = t.pair.id; }
      else if (t.meta.biz) { gl = t.meta.biz.gl; Object.assign(e, info(gl)); e.business = true; e.postedVia = fin.ajeOf.get(t) ?? null; e.suggestedPost = postOut(c.reimburseLines([t], t.date)); }
      else { gl = mainGl(t) ?? (c.codeEveryRow && t.lines?.length ? t.lines[0].gl : null); if (gl) Object.assign(e, info(gl)); else Object.assign(e, { account: 'UNCODED', accountNo: null }); }
      if (t.post.length) {
        e.post = postOut(t.post);
        const h = t.post.filter((l) => l.gl === HSTGL);
        const itcV = sum(h, (l) => l.dr), colV = sum(h, (l) => l.cr); if (itcV) e.hstItc = D(itcV); if (colV) e.hstCollected = D(colV);
      }
      if (t.pair && !e.pair) e.pair = t.pair.id;
      if (t.meta.payroll) { const r = t.meta.payroll; e.payroll = { gross: D(r.gross), cpp: D(r.cpp + r.cpp2), ei: D(r.ei), tax: D(r.tax), net: D(r.net), employerCpp: D(r.erCpp), employerEi: D(r.erEi) }; }
      if (t.meta.parts) e.parts = t.meta.parts;
      if (t.flags.length) e.flags = t.flags;
      if (t.notes.length) e.notes = t.notes;
      if (e.note0) { (e.notes ??= []).push(e.note0); delete e.note0; }
      entries.push(e);
    });
  }
  const idOf = (x) => (typeof x === 'object' ? x.id : x);
  const ajes = c.ajes.map((j) => ({
    id: j.id, date: j.date, amount: D(j.amount), reason: j.reason, confirm: j.confirm || undefined, note: j.note ?? undefined,
    lines: j.lines.map((l) => ({ account: l.gl, name: GL[l.gl].name, gifi: GL[l.gl].gifi, debit: D(l.dr ?? 0), credit: D(l.cr ?? 0) })),
    source: { transactions: j.tx.map(idOf), onboarding: j.onb },
  }));
  const flags = c.flagList.map((f) => ({
    id: f.id, rule: f.rule, detail: res(f.detail, fin, c), severity: f.severity, action: f.action, judgement: f.judgement || undefined, blocking: f.blocking,
    evidence: { transactions: f.tx.map(idOf), onboarding: f.onb, adjustingEntries: f.aje },
  }));
  // Schedule 1 add-backs computed from the books, plus the client's own list
  const add = [];
  const meals = fin.adj['6020'] ?? 0;
  if (meals) add.push({ item: '50% of meals and entertainment', amount: D(Math.round(meals / 2)), reason: 'only half of meals and entertainment is deductible; the books expense the whole amount (account 6020)', source: { account: '6020' } });
  const amort = fin.adj['6050'] ?? 0;
  if (amort) add.push({ item: 'Book amortization', amount: D(amort), reason: 'accounting amortization is added back; capital cost allowance is claimed on Schedule 8', source: { account: '6050', adjustingEntries: c.ajes.filter((j) => j.lines.some((l) => l.gl === '6050')).map((j) => j.id) } });
  for (const x of c.t2.addBacks ?? []) add.push({ item: x.item, amount: D(x.amount), reason: x.reason, source: { transactions: NLids(x.tx), adjustingEntries: x.aje ?? [], onboarding: x.onb ?? [] }, confirm: x.confirm || undefined });
  const byClass = {};
  for (const x of c.ccaAdds) (byClass[x.cls] ??= { class: x.cls, additions: [], disposals: [] }).additions.push({ date: x.date, description: x.desc, capitalCost: D(x.cost), transactions: NLids(x.tx), note: x.note });
  for (const x of c.ccaDisposals) (byClass[x.cls] ??= { class: x.cls, additions: [], disposals: [] }).disposals.push(x);
  const t2 = {
    netIncomeLossPerBooksBeforeTax: D(fin.netIncome),
    schedule1: { addBacks: add, deductions: c.t2.deductions ?? [], note: 'Inputs only. Taxprep computes taxable income and tax.' },
    schedule8: { openingUcc: c.t2.openingUcc ?? [], ...(c.t2.closingUcc ? { closingUcc: c.t2.closingUcc } : {}), classes: Object.values(byClass).sort((x, y) => String(x.class).localeCompare(String(y.class), undefined, { numeric: true })), note: c.ccaAdds.length || c.ccaDisposals.length ? 'Capital cost is before recoverable HST. Disposals: none unless listed.' : 'No additions or disposals in the year.' },
    schedule50: c.owners.map((o) => ({ name: o.name, ...(o.corp ? { businessNumber: o.sin } : { sin: o.sin }), percentCommonShares: o.percent, percentPreferredShares: 0 })),
    ...Object.fromEntries(Object.entries(c.t2).filter(([k]) => !['addBacks', 'deductions', 'openingUcc', 'closingUcc'].includes(k))),
  };
  return {
    client: c.num, name: c.name, fiscalYear: { start: c.fyStart, end: c.fyEnd, days: diffDays(c.fyStart, c.fyEnd) + 1 },
    generator: { file: 'generate.mjs', seed: c.seed }, idRule: IDRULE,
    amountConvention: 'amount is the cash effect on the company account: money in is positive, money out is negative. On a card a charge is negative and a payment positive (the card CSV shows the opposite sign). post lines list the coded entry: dr and cr in dollars, the last line is the bank or card account itself.',
    postingCurrency: 'CAD: every post line, adjusting entry and trial balance figure is in Canadian dollars; USD rows are posted at the monthly test rate in fx',
    ...(c.rates ? { fx: { pair: 'CAD per USD', note: 'made-up test rates', priorYearEnd: c.rates.open, monthly: Object.fromEntries(Object.entries(c.rates).filter(([k]) => k !== 'open')) } } : {}),
    accounts: Object.values(c.accts).map((a) => ({ key: a.key, tag: a.tag, layout: LAYOUT[a.kind], role: a.role, currency: a.currency, holder: a.holder || undefined, file: `accounts/${a.file}`, qboFile: `qbo/${a.file}`, glAccount: a.gl, openingBalance: D(a.opening), closingBalance: D(a.closing), balanceMeaning: a.sgn === -1 ? 'amount owing on the card' : 'cash balance', rowsInExport: a.export.length, rowsMissingFromExport: a.missing.length })),
    transactions: entries,
    statementBalances: Object.fromEntries(Object.values(c.accts).map((a) => [a.key, a.statements.map((s) => ({ month: s.month, opening: D(s.opening), closing: D(s.closing), exportActivity: D(s.exportActivity), rolls: s.rolls, note: c.stmtNotes?.[`${a.key}:${s.month}`] ?? undefined }))])),
    adjustingEntries: ajes,
    trialBalance: { basis: 'debits and credits in dollars; unadjusted = opening balances plus every coded transaction; adjusted = plus the adjusting entries; income tax is not booked (Taxprep computes it)', ...fin.tb, netIncomeLossBeforeTax: D(fin.netIncome) },
    ...(c.assets ? { assets: res(c.assets, fin, c) } : {}),
    t2Inputs: res(t2, fin, c),
    ...(c.priorYear ? { prior_year: res(c.priorYear, fin, c) } : {}),
    ...(c.extraKey ? res(c.extraKey, fin, c) : {}), // blocks only some clients carry (W15: client 13's OHIP reconciliation and non-OHIP income)
    hst: { ...fin.hst, ...(c.hstNote ? { note: res(c.hstNote, fin, c) } : {}) },
    flags,
    parties: c.parties,
    notes: res(c.notes, fin, c),
  };
}
const NLids = (x) => [x].flat(3).filter(Boolean).map((t) => (typeof t === 'object' ? t.id : t));

// ---------- onboarding ----------
export function buildOnboarding(c, fin) {
  const programs = c.onb.programs ?? ['corporate_tax', ...(c.hstMethod === 'none' ? [] : ['hst'])];
  const suffix = { corporate_tax: 'RC0001', hst: 'RT0001', payroll: 'RP0001' };
  const { corporation, programs: _p, ...rest } = c.onb;
  return {
    note: 'Made up. Shaped like the bridge views in reference/onboarding-contract.md. The business number is nine plain digits that fail the check digit. SINs are never handed over (restricted-provided).',
    is_test: true,
    corporation: { legal_name: c.name, business_number: c.bn, financial_year_end: c.fyEnd, fiscal_year_start: c.fyStart, jurisdiction: 'ON', all_prior_years_filed: 'yes', ...res(corporation ?? {}, fin, c) },
    cra_program_accounts: programs.map((p) => ({ program: p, account_number: `${c.bn}${suffix[p]}`, is_open: true })),
    owners: c.owners.map((o) => ({ name: o.name, role: 'owner', holder_kind: o.corp ? 'corporation' : 'person', approximate_share_percent: o.percent, share_class: o.shareClass, tax_residency: 'CA', ...(o.corp ? {} : { sin: 'restricted-provided' }) })),
    accounts_provided: Object.values(c.accts).map((a) => ({ file: `accounts/${a.file}`, institution: LAYOUT[a.kind], currency: a.currency, months: c.months.length })),
    ...res(rest, fin, c),
    prior_year_closing_balances: { as_of: addDays(c.fyStart, -1), accounts: fin.tb.opening.rows, ucc: c.t2.openingUcc ?? [] },
  };
}

// ---------- profile ----------
export function buildProfile(c, fin) {
  const L = [];
  const accts = Object.values(c.accts);
  L.push(`# ${c.num} ${c.name}`, '', 'All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.', '');
  L.push(`**Fiscal year:** ${longDate(c.fyStart)} to ${longDate(c.fyEnd)} (year end ${longDate(c.fyEnd)}).`, '');
  const R = (x) => res(x, fin, c);
  L.push('## Who they are', '', R(c.who), '');
  if (!accts.length) L.push('## Accounts and files', '', 'None: onboarding answers only. No account files, no QBO files and no documents.', '');
  else L.push('## Accounts and files', '', '| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const a of accts) L.push(`| ${a.key} | ${LAYOUT[a.kind]}${a.holder ? ', ' + a.holder : ''} | ${a.currency} | ${a.file} | ${a.export.length}${a.missing.length ? ` (+${a.missing.length} not in the export)` : ''} | ${fmt(a.opening)} | ${fmt(a.closing)} |`);
  if (accts.length) L.push('', 'Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.', '');
  L.push('## Planted issues (exact amounts and dates)', '', ...c.planted.map((p) => `- ${R(p)}`), '');
  L.push('## What each check should find', '', ...c.flagList.map((f) => `- **${f.rule}** (${f.id}${f.judgement ? ', a person decides' : ''}): ${R(f.detail)}`), '');
  if (accts.length) L.push('## Statement balances by month (from the statements, not from the export)', '', '| Account | Month | Opening | Closing | Export activity | Rolls |', '| --- | --- | --- | --- | --- | --- |');
  if (accts.length) for (const a of accts) for (const s of a.statements) L.push(`| ${a.key} | ${s.month} | ${fmt(s.opening)} | ${fmt(s.closing)} | ${fmt(s.exportActivity)} | ${s.rolls ? 'yes' : 'NO' + (c.stmtNotes?.[`${a.key}:${s.month}`] ? ': ' + c.stmtNotes[`${a.key}:${s.month}`] : '')} |`);
  L.push('', '## Answer key and ids', '', IDRULE, '', 'answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.', '');
  if (c.notes.length) L.push('## Notes', '', ...c.notes.map((n) => `- ${R(n)}`), '');
  return L.join('\n');
}

export function writeClient(c, fin, root) {
  const dir = path.join(root, c.dir);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (Object.keys(c.accts).length) { fs.mkdirSync(path.join(dir, 'accounts'), { recursive: true }); fs.mkdirSync(path.join(dir, 'qbo'), { recursive: true }); }
  for (const a of Object.values(c.accts)) {
    fs.writeFileSync(path.join(dir, 'accounts', a.file), accountCsv(a));
    fs.writeFileSync(path.join(dir, 'qbo', a.file), qboCsv(a));
  }
  fs.writeFileSync(path.join(dir, 'onboarding.json'), pretty(buildOnboarding(c, fin)) + '\n');
  fs.writeFileSync(path.join(dir, 'answer-key.json'), pretty(buildKey(c, fin)) + '\n');
  fs.writeFileSync(path.join(dir, 'profile.md'), buildProfile(c, fin));
}
