// Data for the source viewer prototype v3 (D03, version "B+"). Made-up, from reference/sample-clients/01-maple-ridge
// (Maple Ridge Consulting Inc. (Test), year end 31 Dec 2025). Statement and card rows are read from the real test CSV files.
// Pinned story date: Monday 8 Jun 2026 (the void-state page reads QBO again on 9 Jun 2026). No real client data anywhere.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..') // repo root: build, v3, source-viewer, prototypes, design, repo
const clientDir = path.join(root, 'reference/sample-clients/01-maple-ridge')
const readCsv = (rel) => fs.readFileSync(path.join(clientDir, rel), 'utf8').trim().split(/\r?\n/).map((l) => l.split(','))
const money = (s) => (s === '' || s === undefined ? '' : Number(s).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

// ---------- the two CSV files the sheet sources read ----------
const lakeview = readCsv('accounts/lakeview-chequing-4821.csv')
const card = readCsv('accounts/aurora-personal-card-3309.csv')
export const csvRow = (n) => { const [date, desc, wd, dep, bal] = lakeview[n - 1]; return { line: n, date, desc, wd: money(wd), dep: money(dep), bal: money(bal) } }
export const csvTotal = lakeview.length
export const stmtRows = []
for (let i = 540; i <= 553; i++) stmtRows.push(csvRow(i))
export const closingBalance = csvRow(csvTotal).bal

// ---------- page geometry (US letter, 612 x 792) ----------
export const PAGE = { w: 612, h: 792 }
const pct = (x, y, w, h) => ({ x: +((x / PAGE.w) * 100).toFixed(2), y: +((y / PAGE.h) * 100).toFixed(2), w: +((w / PAGE.w) * 100).toFixed(2), h: +((h / PAGE.h) * 100).toFixed(2) })
export const ROW_Y0 = 262
export const ROW_STEP = 22
const rowBox = (idx) => pct(92, ROW_Y0 + idx * ROW_STEP - 15, 404, 21)
const idxOf = (line) => stmtRows.findIndex((r) => r.line === line)
const row18 = stmtRows[idxOf(546)]
const row20 = stmtRows[idxOf(548)]
const row17a = stmtRows[idxOf(544)]
const row17b = stmtRows[idxOf(545)]
export const boxes = { dec18: rowBox(idxOf(546)), dec17a: rowBox(idxOf(544)), dec17b: rowBox(idxOf(545)), dec20: rowBox(idxOf(548)), closing: pct(300, 226, 270, 34), t5box24: pct(330, 468, 244, 52) }

// ---------- people (made up) ----------
export const people = {
  anita: { id: 'anita', name: 'Anita Rao (Test)', role: 'Preparer', can: ['cite', 'verify'], home: 'workbench.html' },
  dev: { id: 'dev', name: 'Dev Malhotra (Test)', role: 'CPA reviewer', can: ['judge'], home: 'review.html' },
  sam: { id: 'sam', name: 'Sam Okoye (Test)', role: 'Operations', can: ['ops'], home: 'ops.html' },
}
const PREP = people.anita.name, OPS = people.sam.name, CLIENT = 'Priya Nair (Test)'
const COMPANY = 'Maple Ridge Consulting Inc. (Test)'
export const today = { text: '8 Jun 2026', iso: '2026-06-08' }
const SNAP = 'QBO snapshot of 4 Jun 2026 at 09:12 (fingerprint a41f9c07), a dated copy and not live'

const MASK_STMT = 'Account number on file (blacked out in the image)'
const upl = `Uploaded by ${CLIENT} in the client app`

// ---------- sources (EV-5 kinds; origin EV-10; dot EV-11) ----------
// origin: third | filed | prepared | said | judgment.  dot: green | grey | amber | purple.  dotNote overrides the dot words.
export const sources = {
  // document pages
  'lv-dec-p2': { kind: 'page', origin: 'third', dot: 'green', title: 'Lakeview Bank (Test) statement, Dec 2025', page: 'page 2 of 3',
    img: 'pages/lakeview-dec-p2.svg', alt: 'Lakeview Bank (Test) chequing statement, December 2025, page 2 of 3. Account number blacked out.',
    minText: 11, box: boxes.dec18, ocr: `${row18.desc} ${row18.dep}`, extracted: `${row18.date}, deposit ${row18.dep}`, who: upl, when: '14 Jan 2026', masked: MASK_STMT },
  'lv-dec-p3': { kind: 'page', origin: 'third', dot: 'green', title: 'Lakeview Bank (Test) statement, Dec 2025', page: 'page 3 of 3',
    img: 'pages/lakeview-dec-p3.svg', alt: 'Lakeview Bank (Test) chequing statement, December 2025, page 3 of 3, closing balance. Account number blacked out.',
    minText: 16, box: boxes.closing, ocr: closingBalance, extracted: `31 Dec 2025, closing balance ${closingBalance}`, who: upl, when: '14 Jan 2026', masked: MASK_STMT, failFirst: true },
  't5-draft': { kind: 'page', origin: 'prepared', dot: 'amber', title: 'T5 slip draft, December dividend', page: 'page 1 of 1',
    img: 'pages/t5-draft.svg', alt: 'Draft T5 slip for Priya Nair (Test). Social insurance number and date of birth blacked out.',
    minText: 10, box: boxes.t5box24, ocr: 'Box 24 Actual amount of dividends other than eligible dividends 20,000.00', extracted: 'Box 24, 20,000.00',
    who: `Drafted by ${PREP}`, when: '28 May 2026', masked: 'SIN on file and date of birth on file (blacked out in the image)' },
  // sheet rows of the bank download (EV-14)
  'sh-dec20': { kind: 'sheet', origin: 'third', dot: 'green', title: 'Lakeview download, row 548, column C', file: 'lakeview-chequing-4821.csv',
    header: ['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance'], rows: [1, 547, 548, 549], boxRow: 548, boxCol: 2, numCols: [2, 3, 4], note: `Row 548 of ${csvTotal}`, who: `Imported by ${OPS}`, when: '14 Jan 2026' },
  // the six lines of the personal card that the adjusting entry reclassifies, each a sheet row (column D, Amount)
  'ajs-47': sheetCard(47, 'Adobe Creative Cloud'), 'ajs-152': sheetCard(152, "East Side Mario's"), 'ajs-200': sheetCard(200, 'VIA Rail'),
  'ajs-229': sheetCard(229, 'Best Buy'), 'ajs-354': sheetCard(354, 'Moxies'), 'ajs-405': sheetCard(405, 'TechForward Conference'),
  'ajs-list': { kind: 'answer', origin: 'said', dot: 'amber', title: 'Client list: business items on the card', question: 'Which business costs did you put on your own card?',
    answer: "Adobe Creative Cloud 659.88, annual design software plan. East Side Mario's 86.40, lunch with a client. VIA Rail 88.00, train to a client meeting. Best Buy 379.99, second monitor for the home office. Moxies 124.15, lunch with a client. TechForward Conference 450.00, conference ticket.",
    who: `Answered by ${CLIENT} in the client app`, when: '12 Jan 2026' },
  // QBO (TB-7, TB-10, TB-13, TB-11)
  'qbo-1300': qboTb('QBO trial balance: 1300 Due from shareholder', [['Account', '1300 Due from shareholder'], ['Debit at 31 Dec 2025', '13,211.58'], ['Credit at 31 Dec 2025', '0.00'],
    ['Made up of', 'Advances 27,000.00 (12 Feb, 3 Apr, 20 Jun, 15 Aug, 10 Oct), repaid 12,000.00 (18 Dec), entry 01-AJE-01 1,788.42']]),
  'qbo-2050': qboTb('QBO trial balance: 2050 HST payable (receivable)', [['Account', '2050 HST payable (receivable)'], ['Debit at 31 Dec 2025', '0.00'], ['Credit at 31 Dec 2025', '5,486.94']]),
  'qbo-6020': qboTb('QBO trial balance: 6020 Meals and entertainment', [['Account', '6020 Meals and entertainment'], ['Debit at 31 Dec 2025', '1,941.65'], ['Credit at 31 Dec 2025', '0.00'], ['Half of the debit, for the add-back', '970.83']]),
  'qbo-6100': qboTb('QBO trial balance: 6100 Accounting fees', [['Account', '6100 Accounting fees'], ['Debit at 31 Dec 2025', '3,000.00'], ['Credit at 31 Dec 2025', '0.00'], ['Made up of', '12 monthly debits of 250.00 plus HST, BRIGHTPATH BOOKKEEPING TEST INC']]),
  'qbo-4010': qboTb('QBO trial balance: 4010 Sales', [['Account', '4010 Sales'], ['Debit at 31 Dec 2025', '0.00'], ['Credit at 31 Dec 2025', '186,700.00'], ['Of which Northwind Logistics Inc. (Test)', '168,000.00, about 90%']]),
  'qbo-1010': qboTb('QBO trial balance: 1010 Chequing (CAD)', [['Account', '1010 Chequing (CAD)'], ['Debit at 31 Dec 2025', '131,184.97'], ['Credit at 31 Dec 2025', '0.00']]),
  'qbo-txn-2188': { kind: 'qbo', origin: 'prepared', dot: 'amber', title: 'QBO transaction: Deposit of 18 Dec 2025, 12,000.00', snapshot: SNAP, qboId: '2188',
    fields: [['QBO Transaction ID', '2188'], ['Type', 'Deposit'], ['Date', '18 Dec 2025'], ['Number', 'None'], ['Account', '1010 Chequing (CAD)'], ['Posted against', '1300 Due from shareholder, credit'], ['Memo', 'Shareholder repayment'], ['Amount', '12,000.00']],
    who: `Read by ${OPS}`, when: '4 Jun 2026' },
  'qbo-gl-pret': { kind: 'qbo', origin: 'prepared', dot: 'amber', title: 'QBO ledger line: 6020 Meals, 24 Apr 2025, 18.39', snapshot: SNAP, noId: true, flag: 'Flagged for a person',
    compositeKey: '2025-04-24 | Credit Card Expense | no number | 6020 | 18.39',
    fields: [['QBO Transaction ID', 'None: the General Ledger line carries no id'], ['Date', '24 Apr 2025'], ['Type', 'Credit Card Expense'], ['Number', 'None'], ['Account', '6020 Meals and entertainment'], ['Description', 'PRET A MANGER #7588 TORONTO ON'], ['Amount', '18.39'],
      ['Why no id', 'The Transaction List has several rows of this type with no number, so the join on type and number found no single row']],
    who: `Read by ${OPS}`, when: '4 Jun 2026' },
  // the same two items after the books changed (TB-11)
  'qbo-6100-changed': changedSrc('QBO 6100 Accounting fees, changed', '6100 Accounting fees', 'Balance at 31 Dec 2025', '3,000.00', '3,250.00', '+250.00'),
  'qbo-txn-2188-changed': changedSrc('QBO Deposit 2188, changed', '2188, Deposit, 1010 Chequing (CAD)', 'Amount', '12,000.00', '12,500.00', '+500.00'),
  // adjusting entry (TB-2): type, reason, memo, lines, and its own sources as steps (TB-9)
  'aje-01': { kind: 'aje', origin: 'judgment', dot: 'purple', title: 'Adjusting entry 01-AJE-01', aje: {
      type: 'reclass', date: '31 Dec 2025', amount: '1,788.42',
      reason: 'Six business items the owner paid on her personal card (listed by her in onboarding): expense them and reduce the amount she owes the company',
      memo: 'AJE reclass: Six business items the owner paid on her personal card: expense them and reduce the amount she owes the company | source: aurora-personal-card-3309.csv rows 47, 152, 200, 229, 354 and 405; onboarding list personal_card_business_items',
      lines: [['6155 Software and computer expenses', '583.96', ''], ['6020 Meals and entertainment', '198.44', ''], ['6170 Travel', '77.88', ''], ['6095 Office expenses', '336.27', ''], ['6175 Conferences and meetings', '398.23', ''], ['2050 HST payable (receivable)', '193.64', ''], ['1300 Due from shareholder', '', '1,788.42']],
      debits: '1,788.42', credits: '1,788.42' },
    children: ['ajs-47', 'ajs-152', 'ajs-200', 'ajs-229', 'ajs-354', 'ajs-405', 'ajs-list'], who: `Read by ${OPS} from the QBO journal entry; reason by ${PREP}`, when: '4 Jun 2026' },
  // client answers (EV-5)
  'ans-loan': answer('Client answer: money taken out of the company', 'Anything else we should know about money you took out or put back?', 'I take money out of the company when I need it. I put back $12,000 on 18 December. I will probably take about $10,000 again in January.'),
  'ans-home': answer('Client answer: home office', 'Do you work from home? How much of your home is the office?', 'I pay $2,800 a month rent for my home. About 15% of it is my office.'),
  'ans-div': answer('Client answer: the December payment', 'What was the $20,000 paid out on 20 December?', 'The $20,000 on 20 December was a dividend.'),
  'ans-psb': { ...answer('Client answer: how you work with Northwind', 'Where and how do you do the work for your main client?', 'Northwind is my main client. On Northwind days I work in their office, 9 to 5, on their laptop, and they call me a contractor. On other days I work from home.'), flagEvidence: true },
  'ans-hst': answer('Client answer: the fourth quarter HST payment', 'How much HST did you pay for the fourth quarter, and when?', 'I paid $5,487 for the fourth quarter on 30 January.'),
  // CRA captures (CK-12: an Auto-fill value is stored with its pull date)
  'cra-hst': { kind: 'cra', origin: 'third', dot: 'green', title: 'CRA HST account, quarter 4 2025',
    fields: [['Program account', 'HST, 983056423RT0001'], ['Period', 'Quarter 4 2025'], ['Due', '2 Feb 2026'], ['Paid', '30 Jan 2026'], ['Amount paid', '5,486.94'], ['Captured from', 'CRA My Business Account, representative view']],
    who: `Captured by ${OPS}`, when: '2 Jun 2026' },
  'cra-autofill': { kind: 'cra', origin: 'third', dot: 'grey', title: 'CRA T2 Auto-fill, latest assessed year (2024)', pulled: '2 Jun 2026 at 10:15',
    fields: [['Pulled from CRA Auto-fill', '2 Jun 2026 at 10:15'], ['Assessed year', '2024, year end 31 Dec 2024'], ['RDTOH, eligible, closing', '0.00'], ['RDTOH, non-eligible, closing', '0.00'],
      ['Losses, GRIP, capital dividend account', 'No cell: Auto-fill did not give these']],
    who: `Pulled by ${OPS}`, when: '2 Jun 2026' },
  // last year's return and assessment (EV-5, TB-8)
  'ly-2680': { kind: 'lastyear', origin: 'filed', dot: 'grey', dotNote: "last year's assessed return", title: "Last year's taxes payable (GIFI 2680)",
    fields: [['Return', `${COMPANY}, year end 31 Dec 2024`], ['Schedule', 'Schedule 100, balance sheet'], ['GIFI line', '2680 Taxes payable'], ['Amount at 31 Dec 2024', '5,113.28']],
    who: `Carried forward by ${OPS}`, when: '14 Jan 2026' },
  'ly-noa': { kind: 'lastyear', origin: 'third', dot: 'grey', dotNote: "last year's assessed return", title: "Last year's assessment, non-eligible RDTOH",
    fields: [['Notice', 'Notice of assessment, year end 31 Dec 2024'], ['Cell', 'Non-eligible RDTOH, closing balance'], ['Amount', '0.00'], ['Assessed', '1 Jul 2025']],
    who: `Carried forward by ${OPS}`, when: '14 Jan 2026' },
  // written reasons (EV-5)
  'rs-1300': { kind: 'reason', origin: 'judgment', dot: 'purple', title: 'Reason for the shareholder loan treatment',
    reason: 'Treated as a shareholder loan, not as income. Repayment is due by 31 Dec 2026 (the end of the fiscal year after the year the loan was made). No interest is charged: flagged for the CPA as 01-F04.',
    who: `Reason written by ${PREP}`, when: '3 Jun 2026' },
  'rs-6020': { kind: 'reason', origin: 'judgment', dot: 'purple', title: 'Reason for the meals add-back',
    reason: 'Only half of meals and entertainment is deductible, so half of 1,941.65 is added back on Schedule 1.',
    who: `Reason written by ${PREP}`, when: '3 Jun 2026' },
}
// the verify list boxes other values on statement page 2
sources['v2-box'] = { ...sources['lv-dec-p2'], box: boxes.dec20, ocr: `${row20.desc} ${row20.wd}`, extracted: `${row20.date}, withdrawal ${row20.wd}` }
sources['v3-box'] = { ...sources['lv-dec-p2'], box: boxes.dec17a, ocr: `${row17a.desc} ${row17a.wd}`, extracted: `${row17a.date}, withdrawal ${row17a.wd}` }
sources['v4-box'] = { ...sources['lv-dec-p2'], box: boxes.dec17b, ocr: `${row17b.desc} ${row17b.wd}`, extracted: `${row17b.date}, withdrawal ${row17b.wd}` }

function sheetCard(line, what) {
  return { kind: 'sheet', origin: 'third', dot: 'green', title: `Card statement row ${line}, column D: ${what}`, file: 'aurora-personal-card-3309.csv',
    header: ['Transaction Date', 'Posting Date', 'Description', 'Amount'], rows: [1, line - 1, line, line + 1], boxRow: line, boxCol: 3, numCols: [3], note: `Row ${line} of ${card.length}`, who: `Imported by ${OPS}`, when: '14 Jan 2026' }
}
function qboTb(title, fields) {
  return { kind: 'qbo', origin: 'prepared', dot: 'amber', title, snapshot: SNAP, fields: fields.concat([['QBO id', 'None: a trial balance line carries no id, so this names the snapshot and the account']]), who: `Read by ${OPS}`, when: '4 Jun 2026' }
}
function changedSrc(title, item, measure, before, after, change) {
  return { kind: 'qbo', origin: 'prepared', dot: 'amber', title, changed: { item, measure, before, after, change, snapBefore: '4 Jun 2026 at 09:12', fpBefore: 'a41f9c07', snapAfter: '9 Jun 2026 at 10:05', fpAfter: '7be20d41' }, who: `Read again by ${OPS}`, when: '9 Jun 2026' }
}
function answer(title, question, text) { return { kind: 'answer', origin: 'said', dot: 'amber', title, question, answer: text, who: `Answered by ${CLIENT} in the client app`, when: '12 Jan 2026' } }

// sheet grids need their rows
for (const s of Object.values(sources)) {
  if (s.kind !== 'sheet') continue
  const csv = s.file.startsWith('lakeview') ? lakeview : card
  s.grid = s.rows.map((n) => ({ line: n, cells: csv[n - 1].map((c, ci) => (n > 1 && s.numCols.includes(ci) ? money(c) : c)) }))
}

// ---------- lists ----------
const fig = (id, line, name, amount, src, extra = {}) => ({ id, line, name, amount, src, ...extra })
const cand = (exact = [], rounds = []) => exact.map((id) => ({ id, group: 'exact' })).concat(rounds.map((id) => ({ id, group: 'rounds' })))

export const lists = {
  // Workbench (preparer): orphans, tax choices, an overridden cell, a dropped cell and a cited figure (RT-14, RT-16, RV-22)
  prep: [
    fig('c1', 'Sch. 1', 'Meals add-back', '971', [], { cand: cand([], ['qbo-6020']), cls: 'orphan' }),
    fig('c2', '2680', 'Taxes payable (HST)', '5,487', [], { cand: cand(['ans-hst'], ['cra-hst', 'qbo-2050']), cls: 'orphan', dots: { 'cra-hst': 'grey' } }),
    fig('c3', 'Sch. 3', 'Dividend other than eligible', '20,000', [], { cand: cand(['sh-dec20', 't5-draft', 'ans-div']), cls: 'tax choice', choice: true }),
    fig('c4', 'Sch. 1', 'Home office, 15% of rent', '5,040', [], { cand: cand(['ans-home']), cls: 'tax choice', choice: true, flag: { id: '01-F07', text: 'Home office: a person decides' } }),
    fig('c5', '8810', 'Office expenses', '0', [], { cls: 'overridden', facts: [['Class', 'Overridden: imported, then changed'], ['Taxprep cell', 'GFBGII[1].GFGIL.Ttwgil162, Office expenses'], ['Imported', '336'], ['In the lock export', '0'], ['Why it matters', 'An overridden cell needs a written reason. The second monitor is claimed as class 50 instead.']] }),
    fig('c6', '9201', 'Conferences and meetings', 'Blank', [], { cls: 'dropped', facts: [['Class', 'Dropped: imported, but blank in the export'], ['Taxprep cell', 'GFBGII[1].GFGIL.Ttwgil230, Conferences and meetings'], ['Imported', '398'], ['In the lock export', 'Blank'], ['Why it matters', 'A dropped cell blocks sign-off until it is imported again or explained.']] }),
    fig('c7', '1301', 'Due from shareholder', '13,212', ['qbo-1300', 'aje-01', 'qbo-txn-2188', 'lv-dec-p2', 'ans-loan', 'rs-1300'], { cls: 'cited' }),
    fig('c8', '8862', 'Accounting fees', '3,000', [], { cand: cand(['qbo-6100']), cls: 'orphan' }),
  ],
  // Review (CPA): the figures of the return, each with its sources
  cpa: [
    fig('f1', '1301', 'Due from shareholder', '13,212', ['qbo-1300', 'aje-01', 'qbo-txn-2188', 'lv-dec-p2', 'ans-loan', 'rs-1300'], { flag: { id: '01-F02', text: 'Shareholder loan unpaid' } }),
    fig('f2', '2680', 'Taxes payable (HST)', '5,487', ['cra-hst', 'qbo-2050', 'ly-2680']),
    fig('f3', 'Sch. 1', 'Meals add-back', '971', ['qbo-gl-pret', 'qbo-6020', 'rs-6020'], { flag: { id: '01-F10', text: 'QBO line without an id' } }),
    fig('f4', '8000', 'Sales to Northwind', '168,000', ['ans-psb', 'qbo-4010'], { flag: { id: '01-F01', text: 'Personal services business' } }),
    fig('f5', 'Sch. 100', 'Dividend declared (non-eligible)', '20,000', ['t5-draft', 'sh-dec20', 'ans-div']),
    fig('f6', 'Sch. 1', 'Home office, 15% of rent', '5,040', ['ans-home'], { flag: { id: '01-F07', text: 'Home office: a person decides' } }),
    fig('f7', 'Sch. 3', 'Capital dividend account, opening', '0', [], { note: 'CRA Auto-fill (pulled 2 Jun 2026) gave no capital dividend account cell, and there is no filed closing to roll forward.' }),
    fig('f8', '1002', 'Chequing (CAD), balance at year end', '131,185', ['lv-dec-p3', 'qbo-1010']),
    fig('f9', 'Sch. 3', 'Opening RDTOH, non-eligible', '0', ['cra-autofill', 'ly-noa']),
  ],
  // Documents (preparer): verify an extracted value against the words in its box (EV-6)
  verify: [
    { id: 'v1', name: 'Deposit on 18 Dec', amount: row18.dep, src: ['lv-dec-p2'] },
    { id: 'v2', name: 'Withdrawal on 20 Dec', amount: row20.wd, src: ['v2-box'] },
    { id: 'v3', name: 'Google Workspace on 17 Dec', amount: row17a.wd, src: ['v3-box'] },
    { id: 'v4', name: 'Presto on 17 Dec', amount: row17b.wd, src: ['v4-box'] },
    { id: 'v5', name: 'Closing balance on 31 Dec', amount: closingBalance, src: ['lv-dec-p3'] },
    { id: 'v6', name: 'T5 box 24, dividends other than eligible', amount: '20,000.00', src: ['t5-draft'] },
  ],
  // Exceptions (CPA): one answer each (EX-1); the CPA judges the accepted risks
  risks: [
    { id: 'x1', flagId: '01-F01', name: 'Personal services business signs', answer: 'accepted', amount: '168,000.00', effect: 'The small business deduction could be lost on this income.', by: PREP, on: '3 Jun 2026', src: ['ans-psb', 'qbo-4010'] },
    { id: 'x2', flagId: '01-F03', name: 'Repay then reborrow', answer: 'accepted', amount: '12,000.00', effect: 'The repayment may not count if it is part of a series of loans and repayments.', by: PREP, on: '3 Jun 2026', src: ['ans-loan', 'qbo-txn-2188', 'lv-dec-p2'] },
    { id: 'x3', flagId: '01-F04', name: 'No interest on the shareholder loan', answer: 'accepted', amount: '13,211.58', effect: 'A deemed interest benefit may apply while the loan stays unpaid.', by: PREP, on: '3 Jun 2026', src: ['qbo-1300', 'rs-1300'] },
    { id: 'x4', flagId: '01-F07', name: 'Home office', answer: 'explained', amount: '5,040.00', effect: 'Rent paid personally, not booked: a person decides the claim.', by: PREP, on: '3 Jun 2026', src: ['ans-home'] },
    { id: 'x5', flagId: '01-F06', name: 'Meals limited to 50%', answer: 'fixed', amount: '970.83', effect: 'Half of meals is added back on Schedule 1.', by: PREP, on: '3 Jun 2026', src: ['qbo-6020', 'rs-6020'] },
    { id: 'x6', flagId: '01-F09', name: 'HST payable at year end', answer: 'explained', amount: '5,486.94', effect: 'The Q4 payment was made after year end, so it is a liability at 31 Dec 2025.', by: PREP, on: '3 Jun 2026', src: ['cra-hst', 'qbo-2050'] },
  ],
  // Ops: documents and captures to complete or chase
  ops: [
    { id: 'o1', name: 'Lakeview chequing statement, December 2025', what: 'Bank statement from the client', src: ['lv-dec-p2', 'lv-dec-p3'] },
    { id: 'o2', name: 'CRA HST program account capture', what: 'CRA capture', src: ['cra-hst'] },
    { id: 'o3', name: 'CRA T2 Auto-fill capture, pulled 2 Jun 2026', what: 'CRA capture', src: ['cra-autofill'] },
    { id: 'o4', name: 'T5 slip draft, December dividend', what: 'Document from the preparer', src: ['t5-draft'] },
    { id: 'o5', name: 'Aurora business card statement, December 2025', what: 'Bank statement from the client', src: [] },
    { id: 'o6', name: 'Client answers, onboarding', what: 'Client answers', src: ['ans-loan', 'ans-home', 'ans-div'] },
  ],
  // the cells that changed after approval (TB-11); shown on the Workbench when the approval is void
  changed: [
    { id: 'g1', line: '8862', name: 'Accounting fees', amount: '3,250', was: '3,000', src: ['qbo-6100-changed'] },
    { id: 'g2', line: '1301', name: 'Due from shareholder', amount: '12,712', was: '13,212', src: ['qbo-txn-2188-changed'] },
  ],
}

export const client = { name: COMPANY, ye: '31 Dec 2025' }
export const story = { snapshot: '4 Jun 2026 at 09:12', approved: '8 Jun 2026 at 15:20', approvedDay: '8 Jun 2026', reread: '9 Jun 2026 at 10:05' }
export const sheetFiles = { lakeview: { name: 'lakeview-chequing-4821.csv', rows: csvTotal }, card: { name: 'aurora-personal-card-3309.csv', rows: card.length } }
