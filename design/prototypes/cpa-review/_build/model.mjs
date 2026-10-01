// Data layer for the CPA review prototypes. Reads the made-up sample clients (answer keys) and builds the return,
// the numbers' traces, sources, flags, comments and history. Last-year income figures are made up (marked so on screen).
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
export const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const SC = path.join(ROOT, 'reference', 'sample-clients');

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function money(n) {
  const v = Math.round(n * 100) / 100;
  const s = Math.abs(v).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-$' : '$') + s;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (iso) => MON[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
const longDate = (iso) => +iso.slice(8, 10) + ' ' + MON[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const r2 = (n) => Math.round(n * 100) / 100;

export const SECTIONS = [
  { key: 'flags', slug: 'flags', title: 'Flags' },
  { key: 'bs', slug: 'balance-sheet', title: 'Balance sheet' },
  { key: 'is', slug: 'income-statement', title: 'Income statement' },
  { key: 's1', slug: 'schedule-1', title: 'Schedule 1' },
  { key: 'other', slug: 'other-schedules', title: 'Other schedules' },
];

export const DOTS = {
  green: 'Traced',
  purple: 'Entry or judgement',
  amber: 'Partly traced',
  grey: 'Not checked: no evidence',
};
const WORST = ['grey', 'amber', 'purple', 'green'];

function loadKey(dir) { return JSON.parse(fs.readFileSync(path.join(SC, dir, 'answer-key.json'), 'utf8')); }

// ---------------------------------------------------------------- client configuration (what the sample data does not say)
const CFG = {
  red: {
    dir: '01-maple-ridge', slug: 'red', short: 'Maple Ridge', tier: 'red', preparer: 'Dana Whitfield (Test)', dueText: '30 Jun 2026',
    tierWhy: 'Four flags need your judgement (personal services business signs, repay then reborrow, no interest on the shareholder loan, home office). Nine flags in all.',
    ly: { 'n-4010': 171200, 'n-6090': 5410.5, 'n-6170': 8120, 'n-6155': 1402.2, 'n-6095': 590.4, 'n-6020': 1710.2 },
    dotOverride: { '6090': 'amber', '6020': 'amber', '6170': 'grey' },
    threshold: { pct: 0.2, min: 500 },
    flags: [
      { id: '01-F01', title: 'Personal services business signs', tier: 'red', effect: 168000, effectText: '$168,000.00 of sales from one client (about 90%)', where: 'n-4010', answer: 'One client, no staff, works in the client\'s office on its laptop 9 to 5 (client note). Not decided: for you.', cites: 'Client app note, staff list' },
      { id: '01-F03', title: 'Repay then reborrow: series of loans and repayments', tier: 'red', effect: 12000, effectText: '$12,000.00 repaid 18 Dec 2025; about $10,000 to be taken again in January', where: 'n-1300', answer: 'Repayment may not count as a repayment. Not decided: for you.', cites: 'Bank statement Dec 2025; client note' },
      { id: '01-F07', title: 'Home office: rent paid personally', tier: 'red', effect: 5040, effectText: '$5,040.00 a year (15% of $2,800.00 a month); not booked', where: 's1-home', answer: 'Not booked. Needs a reimbursement arrangement; may be limited if a personal services business. Not decided: for you.', cites: 'Client app: home office share' },
      { id: '01-F04', title: 'No interest charged on shareholder loan', tier: 'red', effect: null, effectText: 'Not stated: the prescribed rate is for you to confirm', where: 'n-1300', answer: 'No interest charged. Deemed benefit may apply if unpaid after the deadline. Not decided: for you.', cites: 'Bank statements, five advances' },
      { id: '01-F08', title: 'Dividend needs a resolution and a T5', tier: 'amber', effect: 20000, effectText: '$20,000.00 non-eligible dividend, 20 Dec 2025', where: 'n-3700', answer: 'Schedule 3 line entered, T5 for the owner prepared, resolution requested from the client.', cites: 'Bank statement Dec 2025, page 4' },
      { id: '01-F02', title: 'Shareholder loan unpaid at year end', tier: 'amber', effect: 13211.58, effectText: '$13,211.58 due from the owner; repayment deadline 31 Dec 2026', where: 'n-1300', answer: 'Advances $27,000.00, less $12,000.00 repaid, less $1,788.42 of business items. Deadline noted.', cites: 'Five bank statements; entry 01-AJE-01' },
      { id: '01-F09', title: 'HST payable at year end', tier: 'amber', effect: 5486.94, effectText: '$5,486.94 payable; Q4 paid 30 Jan 2026', where: 'n-2050', answer: 'Booked as a current liability. Payment date agrees to the 30 Jan 2026 payment.', cites: 'CRA capture, HST balance' },
      { id: '01-F05', title: 'Business items on the owner\'s personal card', tier: 'green', effect: 1788.42, effectText: '$1,788.42 in six items', where: 'n-6155', answer: 'Entry 01-AJE-01 booked; receipts requested for all six.', cites: 'Personal card statement, six pages' },
      { id: '01-F06', title: 'Meals: 50% limit on deduction and HST claim', tier: 'green', effect: 970.83, effectText: '$970.83 added back on Schedule 1', where: 'n-6020', answer: 'Half added back on Schedule 1; half of the HST claim removed.', cites: 'Business card statement; Schedule 1 add-back' },
    ],
    decided: { 'progress': ['01-F05', '01-F06'], 'rework': ['01-F05', '01-F06', '01-F08', '01-F09'] },
    extraS1: { id: 's1-home', label: 'Home office, not claimed', value: 0, ly: 0, flag: '01-F07', dot: 'purple', built: 'A person\'s decision. Nothing is booked. Taxprep input left empty until you decide.' },
    comments: [
      { id: 'C-1', line: 'n-6170', type: 'Missing evidence', severity: 'Must fix', who: 'Zo', when: '10 Mar 2026, 09:51', text: 'No statement pages for the $10,883.60. Please attach receipts for the five largest trips.', status: 'Sent to preparer' },
      { id: 'C-2', line: 'n-6095', type: 'Question', severity: 'Should fix', who: 'Zo', when: '10 Mar 2026, 09:58', text: 'Why is the $180.00 courier invoice in Office expenses and not Software?', status: 'Sent to preparer' },
      { id: 'C-3', line: 'n-1300', type: 'Question', severity: 'Note', who: 'Zo', when: '10 Mar 2026, 10:04', text: 'Is the deemed interest benefit worked out anywhere?', status: 'Draft, not sent' },
    ],
    rework: { from: 'n-6095', to: 'n-6155', amount: 180, who: 'Dana Whitfield (Test)', when: '10 Mar 2026, 14:10', comment: 'C-2' },
    history: [
      ['24 Feb 2026, 08:15', 'Return built from the QuickBooks books (test company)', 'System', 'Sixty-one numbers, nine flags fired.'],
      ['2 Mar 2026, 10:05', 'Adjusting entry 01-AJE-01 drafted', 'AI draft', 'Six personal-card items. Citations checked by code. Preparer approved it.'],
      ['5 Mar 2026, 15:40', 'Sent to review', 'Dana Whitfield (Test), preparer', 'Preparer answers added to the nine flags.'],
      ['10 Mar 2026, 09:30', 'Brief opened', 'Zo', 'Tier red.'],
      ['10 Mar 2026, 09:42', 'Balance sheet marked Reviewed', 'Zo', ''],
      ['10 Mar 2026, 09:51', 'Comment C-1 sent to the preparer', 'Zo', 'Missing evidence on Travel.'],
    ],
  },
  green: {
    dir: '08-queen-west-design', slug: 'green', short: 'Queen West', tier: 'green', preparer: 'Dana Whitfield (Test)', dueText: '31 Mar 2026',
    tierWhy: 'No flag needs your judgement. Nine flags fired, all answered by the preparer with sources.',
    ly: { 'n-4010': 176900, 'n-4020': 161200 },
    dotOverride: {},
    threshold: { pct: 0.5, min: 1000 },
    flags: [
      { id: '08-F05', title: 'US clients paid in USD: zero-rated sales and exchange', tier: 'amber', effect: 185075, effectText: '$185,075.00 zero-rated sales; exchange loss $818.10', where: 'n-4020', answer: 'Zero-rated, posted at monthly test rates. Exchange loss entered (08-AJE-08).', cites: 'USD statements; rate table' },
      { id: '08-F04', title: 'Owner salary and one employee: payroll against T4', tier: 'green', effect: 134400, effectText: '$134,400.00 of salaries', where: 'n-6130', answer: 'Payroll totals agree to the T4 summaries for 2025.', cites: 'Client app payroll; T4 summary' },
      { id: '08-F07', title: 'CCA: laptop class 50 and camera class 8', tier: 'green', effect: 5449, effectText: '$5,449.00 of additions', where: 'n-1540', answer: 'Both entered on Schedule 8 before recoverable HST.', cites: 'Card statements, Nov 2024 and Mar 2025' },
      { id: '08-F09', title: 'HST annual filer with instalments', tier: 'green', effect: 10711.88, effectText: '$10,711.88 payable at year end', where: 'n-2050', answer: 'Instalments agree to the CRA capture.', cites: 'CRA capture, HST balance' },
      { id: '08-F01', title: 'Bad debt: invoice of $4,520.00 written off', tier: 'amber', effect: 4000, effectText: '$4,000.00 written off; $520.00 HST adjustment', where: 'n-6030', answer: 'Written off in September; HST adjustment entered (08-AJE-01).', cites: 'Entry 08-AJE-01; client note' },
      { id: '08-F03', title: 'Accrued year-end accounting fee', tier: 'green', effect: 3500, effectText: '$3,500.00 billed after year end', where: 'n-2030', answer: 'Accrued from the invoice dated after year end.', cites: 'Entry 08-AJE-05' },
      { id: '08-F06', title: 'Software on the owner\'s personal card', tier: 'green', effect: 1700.64, effectText: 'Up to $1,700.64 of software', where: 'n-6155', answer: 'Listed by the owner in onboarding and reimbursed through the shareholder loan.', cites: 'Client app: personal card items' },
      { id: '08-F02', title: 'Prepaid insurance', tier: 'green', effect: 1350, effectText: '$1,350.00 prepaid at year end', where: 'n-1200', answer: 'Twelve months from 1 Jul 2025; three months remain.', cites: 'Entry 08-AJE-03' },
      { id: '08-F08', title: 'Meals: 50% limit', tier: 'green', effect: 1130.84, effectText: '$1,130.84 added back', where: 'n-6020', answer: 'Half added back on Schedule 1.', cites: 'Schedule 1 add-back' },
    ],
    decided: { 'progress': ['08-F04', '08-F07', '08-F09', '08-F03', '08-F06', '08-F02', '08-F08'] },
    comments: [],
    history: [
      ['2 Mar 2026, 09:10', 'Return built from the QuickBooks books (test company)', 'System', 'Fifty-eight numbers, nine flags fired.'],
      ['4 Mar 2026, 13:25', 'Sent to review', 'Dana Whitfield (Test), preparer', 'Preparer answers added to the nine flags.'],
      ['10 Mar 2026, 11:00', 'Brief opened', 'Zo', 'Tier green.'],
    ],
  },
};

const INST = (layout) => layout.replace(/^[A-C]: /, '');

// ---------------------------------------------------------------- build one return
export function buildReturn(which) {
  const cfg = CFG[which];
  const key = loadKey(cfg.dir);
  const adj = key.trialBalance.adjusted.rows;
  const opn = key.trialBalance.opening.rows;
  const net = (r, creditPositive) => creditPositive ? r2((r.credit || 0) - (r.debit || 0)) : r2((r.debit || 0) - (r.credit || 0));
  const opening = (acct, creditPositive) => { const r = opn.find((x) => x.account === acct); return r ? net(r, creditPositive) : 0; };
  const txs = key.transactions;
  const acctInfo = Object.fromEntries(key.accounts.map((a) => [a.key, a]));

  const lines = []; // all numbers in the return, in order
  const byId = {};
  const add = (l) => { l.srcs = l.srcs || []; l.flagIds = []; lines.push(l); byId[l.id] = l; return l; };

  const dotFor = (acct, srcs, fallback) => {
    if (cfg.dotOverride[acct]) return cfg.dotOverride[acct];
    if (!srcs.length) return 'grey';
    if (srcs.some((s) => s.kind === 'entry')) return 'purple';
    return fallback || 'green';
  };

  function sourcesFor(acct, label, cy, creditPositive) {
    const out = [];
    // statement pages: transactions whose coded entry touches this account, largest three
    const hits = [];
    for (const t of txs) {
      const pl = (t.post || []).find((p) => p.a === acct);
      if (!pl) continue;
      const amt = (pl.dr || 0) + (pl.cr || 0);
      hits.push({ t, amt });
    }
    hits.sort((a, b) => b.amt - a.amt);
    const total = hits.length;
    for (const h of hits.slice(0, 3)) out.push(statementSource(h.t, h.amt, acct, label));
    // adjusting entries
    for (const e of key.adjustingEntries) {
      if (e.lines.some((l) => l.account === acct)) out.push(entrySource(e, acct));
    }
    // statement closing balance for cash and card accounts
    const ac = key.accounts.find((a) => a.glAccount === acct);
    if (ac && key.statementBalances[ac.key]) {
      const sb = key.statementBalances[ac.key].slice(-1)[0];
      out.unshift({ kind: 'closing', title: 'Statement closing balance', month: sb.month, inst: INST(ac.layout), closing: sb.closing, opening: sb.opening, role: ac.role });
    }
    // CRA capture for HST
    if (acct === '2050') out.push({ kind: 'cra', title: 'CRA capture, HST balance', fields: [['Account', 'GST/HST (made-up business number)'], ['Balance at year end', money(key.hst.balanceAtYearEndPayable)], ['Method', key.hst.method], ['Captured', '24 Feb 2026 (test capture)']] });
    // a spreadsheet source (EV-14): sheet, row, column
    if (acct === '4310') out.push({ kind: 'sheet', title: 'Exchange rates (client app, test)', sheet: 'Rates', header: ['Item', 'USD to CAD'], rows: [['Prior year end', '1.35'], ['Year end', '1.39']], hitRow: 3, hitCol: 'B', note: 'Test rates, made up.' });
    // opening balances: the prior-year return
    if (acct === '3600' || acct === '3010') out.push({ kind: 'prior', title: 'Prior-year return', fields: [['Line', label], ['Closing last year', money(cy)], ['Source', 'Prior-year return filed (test); share register from the client app']] });
    out.total = total;
    return out;
  }

  function statementSource(t, amt, acct, label) {
    const ac = acctInfo[t.acct];
    const near = txs.filter((x) => x.acct === t.acct && Math.abs(x.line - t.line) <= 3).sort((a, b) => a.line - b.line);
    return {
      kind: 'statement', title: ac && ac.role === 'card' ? 'Card statement' : 'Bank statement', inst: INST(ac ? ac.layout : 'Bank (Test)'),
      month: monthYear(t.date), page: Math.max(1, Math.ceil(t.line / 40)), rows: near, hit: t.id, hitAmt: Math.abs(t.amount), coded: amt, acct, label,
      note: t.post.map((p) => (p.dr ? 'dr ' : 'cr ') + p.a + ' ' + money(p.dr || p.cr)).join(', '),
    };
  }
  function entrySource(e, acct) {
    const l = e.lines.find((x) => x.account === acct);
    return { kind: 'entry', title: 'Adjusting entry ' + e.id, id: e.id, date: longDate(e.date), reason: e.reason, lines: e.lines, hitAcct: acct, hit: l };
  }

  // -------- balance sheet
  const bsRows = adj.filter((r) => +r.account < 4000);
  const grp = (from, to) => bsRows.filter((r) => +r.account >= from && +r.account < to);
  const mkLine = (r, section, group, creditPositive) => {
    const cy = net(r, creditPositive);
    const id = 'n-' + r.account;
    const ly = cfg.ly[id] !== undefined ? cfg.ly[id] : (section === 'bs' ? opening(r.account, creditPositive) : r2(cy * (0.78 + (hash(id) % 40) / 100)));
    let srcs = sourcesFor(r.account, r.name, cy, creditPositive);
    const noEvidence = cfg.dotOverride[r.account] === 'grey';
    const total0 = srcs.total || 0;
    if (noEvidence) srcs = [];
    const total = srcs.total || 0;
    return add({
      id, section, group, acct: r.account, label: r.name, gifi: r.gifi, cy, ly, srcs, total, creditPositive,
      dot: dotFor(r.account, srcs),
      built: `Adjusted trial balance, account ${r.account} ${r.name} (GIFI ${r.gifi}). ${noEvidence ? total0 + ' coded transactions, but no statement page, receipt or entry was found for them.' : total ? total + ' coded transaction' + (total === 1 ? '' : 's') + (key.adjustingEntries.some((e) => e.lines.some((l) => l.account === r.account)) ? ' and an adjusting entry' : '') + '.' : (srcs.length ? 'Opening balance and entries.' : 'Nothing coded to this account in the transactions.')}`,
    });
  };
  const sub = (id, section, label, parts, built, extra = {}) => {
    const cy = r2(parts.reduce((s, p) => s + p.sign * byId[p.id].cy, 0));
    const ly = r2(parts.reduce((s, p) => s + p.sign * byId[p.id].ly, 0));
    const worst = WORST.find((d) => parts.some((p) => byId[p.id].dot === d)) || 'green';
    return add({ id, section, group: 'Total', label, cy, ly, kind: 'sub', dot: worst, built, parts, srcs: [{ kind: 'computed', title: 'Computed from the lines above', parts: parts.map((p) => ({ label: byId[p.id].label, value: byId[p.id].cy, sign: p.sign })) }], ...extra });
  };

  const assetRows = grp(1000, 2000), liabRows = grp(2000, 3000), eqRows = grp(3000, 4000);
  const assetIds = assetRows.map((r) => mkLine(r, 'bs', 'Assets', false).id);
  const aTot = sub('n-total-assets', 'bs', 'Total assets', assetIds.map((id) => ({ id, sign: 1 })), 'Sum of the asset lines (accumulated amortization is a negative line).');
  const liabIds = liabRows.map((r) => mkLine(r, 'bs', 'Liabilities', true).id);
  const lTot = sub('n-total-liab', 'bs', 'Total liabilities', liabIds.map((id) => ({ id, sign: 1 })), 'Sum of the liability lines.');
  const eqIds = eqRows.map((r) => { const l = mkLine(r, 'bs', 'Equity', true); if (r.account === '3700') { l.cy = -r2(r.debit); l.ly = 0; l.built = 'Dividends declared in the year, shown as a deduction from equity. ' + (key.t2Inputs.schedule3.dividendsPaid.length ? 'Agrees to Schedule 3.' : ''); l.creditPositive = true; } return l.id; });

  // -------- income statement
  const isRows = adj.filter((r) => +r.account >= 4000);
  const revRows = isRows.filter((r) => +r.account < 5000);
  const expRows = isRows.filter((r) => +r.account >= 5000);
  const revIds = revRows.map((r) => mkLine(r, 'is', 'Revenue', true).id);
  const rTot = sub('n-total-rev', 'is', 'Total revenue', revIds.map((id) => ({ id, sign: 1 })), 'Sum of the revenue lines.');
  const expIds = expRows.map((r) => mkLine(r, 'is', 'Expenses', false).id);
  const eTot = sub('n-total-exp', 'is', 'Total expenses', expIds.map((id) => ({ id, sign: 1 })), 'Sum of the expense lines.');
  const ni = sub('n-net-income', 'is', 'Net income before tax', [{ id: rTot.id, sign: 1 }, { id: eTot.id, sign: -1 }], 'Total revenue less total expenses. Income tax is not booked: Taxprep computes it.');

  // current-year earnings enters equity (before the totals)
  const ce = { id: 'n-curr-earn', section: 'bs', group: 'Equity', acct: '', label: 'Current year earnings', cy: ni.cy, ly: 0, dot: ni.dot, srcs: [{ kind: 'computed', title: 'Net income before tax from the Income statement', parts: [{ label: 'Net income before tax', value: ni.cy, sign: 1 }] }], built: 'Net income before tax from the income statement. Last year it was already in opening retained earnings.', flagIds: [], kind: 'line' };
  lines.splice(lines.indexOf(byId[eqIds[eqIds.length - 1]]) + 1, 0, ce); byId[ce.id] = ce;
  const eTotal = sub('n-total-eq', 'bs', 'Total equity', [...eqIds, ce.id].map((id) => ({ id, sign: 1 })), 'Shares, opening retained earnings, less dividends, plus current year earnings.');
  const lePlus = sub('n-total-le', 'bs', 'Total liabilities and equity', [{ id: lTot.id, sign: 1 }, { id: eTotal.id, sign: 1 }], 'Must equal total assets.');
  if (Math.abs(lePlus.cy - aTot.cy) > 0.005) throw new Error('balance sheet does not balance for ' + which + ': ' + aTot.cy + ' vs ' + lePlus.cy);
  // move sub lines to their natural place in the order (assets total after assets, etc.)
  const order = [];
  const place = (ids, tot) => { ids.forEach((id) => order.push(byId[id])); if (tot) order.push(tot); };
  place(assetIds, aTot); place(liabIds, lTot); place([...eqIds, ce.id], eTotal); order.push(lePlus);
  place(revIds, rTot); place(expIds, eTot); order.push(ni);

  // -------- schedule 1
  const t2 = key.t2Inputs;
  const s1Ids = [];
  const nic = add({ id: 's1-ni', section: 's1', group: 'Schedule 1', label: 'Net income per books before tax', cy: ni.cy, ly: ni.ly, dot: ni.dot, built: 'From the Income statement.', srcs: [{ kind: 'computed', title: 'Net income before tax from the Income statement', parts: [{ label: 'Net income before tax', value: ni.cy, sign: 1 }] }] });
  s1Ids.push(nic.id);
  t2.schedule1.addBacks.forEach((a, i) => {
    const l = add({ id: 's1-add' + i, section: 's1', group: 'Add', label: a.item.charAt(0).toUpperCase() + a.item.slice(1), cy: a.amount, ly: r2(a.amount * (0.8 + (hash(a.item) % 30) / 100)), dot: 'purple', built: a.reason, srcs: [{ kind: 'prior', title: 'Calculation from account ' + a.source.account, fields: [['Rule', a.reason], ['Source account', a.source.account + ' ' + (adj.find((r) => r.account === a.source.account) || {}).name], ['Book amount', money(net(adj.find((r) => r.account === a.source.account), false))], ['Result', money(a.amount)]] }] });
    s1Ids.push(l.id);
  });
  if (cfg.extraS1) { const x = cfg.extraS1; const l = add({ id: x.id, section: 's1', group: 'Add', label: x.label, cy: x.value, ly: x.ly, dot: x.dot, built: x.built, srcs: [{ kind: 'answer', title: 'Client answer', fields: [['Question', 'Share of the home used for work'], ['Answer', '15% of $2,800.00 monthly rent, paid personally'], ['From', 'Client app, onboarding']] }] }); s1Ids.push(l.id); }
  const s1Tot = add({ id: 's1-total', section: 's1', group: 'Total', kind: 'sub', label: 'Net income for tax purposes before other adjustments', cy: r2(s1Ids.reduce((s, id) => s + byId[id].cy, 0)), ly: r2(s1Ids.reduce((s, id) => s + byId[id].ly, 0)), dot: 'purple', built: 'Net income per books plus add-backs. Taxprep computes taxable income and tax.', srcs: [{ kind: 'computed', title: 'Computed from the lines above', parts: s1Ids.map((id) => ({ label: byId[id].label, value: byId[id].cy, sign: 1 })) }] });
  s1Ids.push(s1Tot.id);

  // -------- other schedules
  const oIds = [];
  t2.schedule3.dividendsPaid.forEach((d, i) => {
    const l = add({ id: 'o-div' + i, section: 'other', group: 'Schedule 3', label: `Dividend paid ${longDate(d.date)} (${d.designation})`, cy: d.amount, ly: 0, dot: 'green', built: 'Schedule 3, dividends paid.', srcs: [statementSource(txs.find((x) => x.id === d.transaction), d.amount, '3700', 'Dividends declared')] });
    oIds.push(l.id);
  });
  (t2.schedule8.classes || []).forEach((c, i) => c.additions.forEach((ad, j) => {
    const t = ad.transactions && txs.find((x) => x.id === ad.transactions[0]);
    const l = add({ id: `o-cca${i}${j}`, section: 'other', group: 'Schedule 8', label: `Class ${c.class} addition: ${ad.description}`, cy: ad.capitalCost, ly: 0, dot: t ? 'green' : 'purple', built: 'Schedule 8 capital cost before recoverable HST. ' + (ad.note || ''), srcs: t ? [statementSource(t, ad.capitalCost, '', ad.description)] : [] });
    oIds.push(l.id);
  }));
  t2.schedule50.forEach((s, i) => {
    const l = add({ id: 'o-sh' + i, section: 'other', group: 'Schedule 50', label: `Shareholder ${s.name}: percent of common shares`, cy: s.percentCommonShares, ly: s.percentCommonShares, pct: true, dot: 'purple', built: 'Schedule 50. Social insurance number is held masked and never shown on a review page.', srcs: [{ kind: 'answer', title: 'Client answer', fields: [['Question', 'Who owns the shares'], ['Answer', s.name + ', ' + s.percentCommonShares + '% common'], ['SIN', 'Masked (***-***-' + s.sin.slice(-3).replace(/./g, '*') + ')'], ['From', 'Client app, onboarding']] }] });
    oIds.push(l.id);
  });
  if (t2.shareholderLoan) {
    const sl = t2.shareholderLoan;
    [['Advances in the year', sl.advances], ['Repayments in the year', sl.repaymentsInYear], ['Business items reimbursed', sl.businessItemsReimbursed], ['Due from shareholder at year end', sl.closingDueFromShareholder]].forEach(([lab, v], i) => {
      const l = add({ id: 'o-loan' + i, section: 'other', group: 'Shareholder loan', label: lab, cy: v, ly: i === 3 ? sl.openingBalance : 0, dot: i === 3 ? 'amber' : 'green', built: 'Shareholder loan schedule. Repayment deadline ' + longDate(sl.repaymentDeadline) + '.', srcs: i === 3 ? byId['n-1300'].srcs : byId['n-1300'].srcs.slice(0, 2) });
      oIds.push(l.id);
    });
  }

  // flags attach to lines
  const flags = cfg.flags.map((f) => ({ ...f }));
  for (const f of flags) { const l = byId[f.where]; if (l) l.flagIds.push(f.id); }
  const sortedFlags = [...flags].sort((a, b) => (a.tier === 'red' ? 0 : 1) - (b.tier === 'red' ? 0 : 1) || (b.effect ?? -1) - (a.effect ?? -1));

  // changed (RV-8): highlight follows tier, never hides the rest
  for (const l of lines) {
    const d = l.cy - l.ly;
    l.changed = l.kind !== 'sub' && !l.pct && Math.abs(d) >= cfg.threshold.min && (l.ly === 0 || Math.abs(d) / Math.abs(l.ly) >= cfg.threshold.pct);
  }

  // section ordering: IS and BS lines in the right order
  const sectionLines = (sec) => lines.filter((l) => l.section === sec);
  const ordered = { bs: order.filter((l) => l.section === 'bs'), is: order.filter((l) => l.section === 'is'), s1: s1Ids.map((i) => byId[i]), other: oIds.map((i) => byId[i]) };

  // six numbers for the brief
  const six = which === 'red'
    ? ['n-4010', 'n-net-income', 's1-total', 'n-total-assets', 'n-1300', 'n-2050']
    : ['n-4010', 'n-net-income', 's1-total', 'n-total-assets', 'n-6130', 'n-2050'];

  return { which, cfg, key, lines, byId, ordered, flags: sortedFlags, six, corp: key.name, ye: longDate(key.fiscalYear.end), sectionLines };
}

// ---------------------------------------------------------------- scenarios (which state of which return)
export const SCENARIOS = {
  'red': { slug: 'red', which: 'red', label: 'Maple Ridge, in progress', marks: { flags: null, bs: ['Zo', '10 Mar 2026, 09:42'], is: null, s1: null, other: null }, kind: 'progress' },
  'red-rework': { slug: 'red-rework', which: 'red', label: 'Maple Ridge, back from rework', marks: { flags: null, bs: ['Zo', '10 Mar 2026, 09:42'], is: 'off', s1: ['Zo', '10 Mar 2026, 10:20'], other: ['Zo', '10 Mar 2026, 10:31'] }, kind: 'rework' },
  'green': { slug: 'green', which: 'green', label: 'Queen West, in progress', marks: { flags: ['Zo', '10 Mar 2026, 11:08'], bs: ['Zo', '10 Mar 2026, 11:15'], is: null, s1: null, other: null }, kind: 'progress' },
  'green-ready': { slug: 'green-ready', which: 'green', label: 'Queen West, every section marked', marks: { flags: ['Zo', '10 Mar 2026, 11:08'], bs: ['Zo', '10 Mar 2026, 11:15'], is: ['Zo', '10 Mar 2026, 11:24'], s1: ['Zo', '10 Mar 2026, 11:29'], other: ['Zo', '10 Mar 2026, 11:33'] }, kind: 'ready' },
};

const cache = {};
export function getReturn(which) { return cache[which] || (cache[which] = buildReturn(which)); }

// the rework scenario: 180.00 moves from Office expenses to Software (totals do not change)
export function reworkView(R, scn) {
  if (scn.kind !== 'rework') return { before: {}, changed: [], ret: R };
  const rw = R.cfg.rework;
  const clone = (l) => ({ ...l });
  const lines = R.lines.map(clone);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  byId[rw.from].cy = r2(byId[rw.from].cy - rw.amount);
  byId[rw.to].cy = r2(byId[rw.to].cy + rw.amount);
  const before = { [rw.from]: R.byId[rw.from].cy, [rw.to]: R.byId[rw.to].cy };
  byId[rw.from].reworked = true; byId[rw.to].reworked = true;
  const ordered = Object.fromEntries(Object.entries(R.ordered).map(([k, arr]) => [k, arr.map((l) => byId[l.id])]));
  return { before, changed: [rw.from, rw.to], ret: { ...R, lines, byId, ordered }, rw };
}

export function sectionState(scn, key) {
  const m = scn.marks[key];
  return m === 'off' ? { state: 'off' } : m ? { state: 'on', who: m[0], when: m[1] } : { state: 'none' };
}
export function marksLeft(scn) { return SECTIONS.filter((s) => sectionState(scn, s.key).state !== 'on'); }
export const PROTOTYPE_TODAY = '10 Mar 2026';
