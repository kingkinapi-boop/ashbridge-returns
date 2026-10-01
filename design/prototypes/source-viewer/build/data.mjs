// Data for the source viewer prototypes. All figures come from reference/sample-clients/01-maple-ridge
// (Maple Ridge Consulting Inc. (Test), year end 31 Dec 2025). Statement rows are read from the real CSV.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const clientDir = path.join(root, 'reference/sample-clients/01-maple-ridge')
const csvLines = fs.readFileSync(path.join(clientDir, 'accounts/lakeview-chequing-4821.csv'), 'utf8').trim().split(/\r?\n/)
const money = (s) => (s === '' || s === undefined ? '' : Number(s).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
export const csvRow = (lineNo) => {
  const [date, desc, wd, dep, bal] = csvLines[lineNo - 1].split(',')
  return { line: lineNo, date, desc, wd: money(wd), dep: money(dep), bal: money(bal) }
}
export const csvHeader = csvLines[0].split(',')
export const csvTotal = csvLines.length

// Statement page 2: file lines 540 to 553
export const stmtRows = []
for (let i = 540; i <= 553; i++) stmtRows.push(csvRow(i))
export const closingBalance = csvRow(csvTotal).bal

// SVG page geometry (US letter, 612 x 792)
export const PAGE = { w: 612, h: 792 }
const pct = (x, y, w, h) => ({
  x: +((x / PAGE.w) * 100).toFixed(2),
  y: +((y / PAGE.h) * 100).toFixed(2),
  w: +((w / PAGE.w) * 100).toFixed(2),
  h: +((h / PAGE.h) * 100).toFixed(2),
})
export const ROW_Y0 = 262
export const ROW_STEP = 22
const rowBox = (idx) => pct(92, ROW_Y0 + idx * ROW_STEP - 15, 404, 21)
const idxOf = (line) => stmtRows.findIndex((r) => r.line === line)
const row18 = stmtRows[idxOf(546)]
const row20 = stmtRows[idxOf(548)]
export const boxes = {
  dec18: rowBox(idxOf(546)),
  dec17a: rowBox(idxOf(544)),
  dec17b: rowBox(idxOf(545)),
  dec20: rowBox(idxOf(548)),
  closing: pct(300, 226, 270, 34),
  t5box24: pct(330, 468, 244, 52),
}

const STAFF = {
  prep: 'Anita Rao (Test)',
  cpa: 'Dev Malhotra (Test)',
  ops: 'Sam Okoye (Test)',
  client: 'Priya Nair (Test)',
}

// ---------- sources (EV-5 kinds) ----------
export const sources = {
  'lv-dec-p2': {
    kind: 'page', title: 'Lakeview Bank (Test) chequing statement, December 2025', page: 'Page 2 of 3',
    img: 'pages/lakeview-dec-p2.svg', alt: 'Lakeview Bank (Test) chequing statement, December 2025, page 2 of 3. Account number blacked out.',
    box: boxes.dec18, ocr: `${row18.desc} ${row18.dep}`, extracted: `${row18.date}, deposit ${row18.dep}`,
    who: `Uploaded by ${STAFF.client} in the client app`, when: '14 Jan 2026', masked: 'Account number on file (blacked out in the image)',
  },
  'lv-dec-p3': {
    kind: 'page', title: 'Lakeview Bank (Test) chequing statement, December 2025', page: 'Page 3 of 3',
    img: 'pages/lakeview-dec-p3.svg', alt: 'Lakeview Bank (Test) chequing statement, December 2025, page 3 of 3, closing balance. Account number blacked out.',
    box: boxes.closing, ocr: closingBalance, extracted: `31 Dec 2025, closing balance ${closingBalance}`,
    who: `Uploaded by ${STAFF.client} in the client app`, when: '14 Jan 2026', masked: 'Account number on file (blacked out in the image)', failFirst: true,
  },
  't5-draft': {
    kind: 'page', title: 'T5 slip, draft for the December dividend', page: 'Page 1 of 1',
    img: 'pages/t5-draft.svg', alt: 'Draft T5 slip for Priya Nair (Test). Social insurance number and date of birth blacked out.',
    box: boxes.t5box24, ocr: 'Box 24 Actual amount of dividends other than eligible dividends 20,000.00', extracted: 'Box 24, 20,000.00',
    who: `Drafted by ${STAFF.prep}`, when: '28 Sep 2026', masked: 'SIN on file and date of birth on file (blacked out in the image)',
  },
  'sh-feb12': {
    kind: 'sheet', title: 'Lakeview chequing export, row 59, column C (Withdrawals)', file: 'lakeview-chequing-4821.csv',
    rows: [1, 57, 58, 59, 60, 61], boxRow: 59, boxCol: 2, sheetNote: `Row 59 of ${csvTotal}`,
    who: `Imported by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'sh-dec20': {
    kind: 'sheet', title: 'Lakeview chequing export, row 548, column C (Withdrawals)', file: 'lakeview-chequing-4821.csv',
    rows: [1, 546, 547, 548, 549, 550], boxRow: 548, boxCol: 2, sheetNote: `Row 548 of ${csvTotal}`,
    who: `Imported by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'sh-acct': {
    kind: 'sheet', title: 'Lakeview chequing export, row 2, column C (Withdrawals)', file: 'lakeview-chequing-4821.csv',
    rows: [1, 2, 3, 4, 5, 6], boxRow: 2, boxCol: 2, sheetNote: `Row 2 of ${csvTotal}`,
    who: `Imported by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'qbo-1300': {
    kind: 'qbo', title: 'QBO account 1300 Due from shareholder, balance at 31 Dec 2025',
    snapshot: 'Read from the QBO sandbox company on 14 Jan 2026 at 09:12',
    fields: [['Company', 'Maple Ridge Consulting Inc. (Test)'], ['Account', '1300 Due from shareholder'], ['Balance at 31 Dec 2025', '13,211.58'],
      ['Posted to the account', 'Advances 27,000.00 (12 Feb, 3 Apr, 20 Jun, 15 Aug, 10 Oct); repaid 12,000.00 (18 Dec); entry 01-AJE-01 1,788.42']],
    who: `Pulled by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'qbo-2050': {
    kind: 'qbo', title: 'QBO account 2050 HST payable (receivable), balance at 31 Dec 2025',
    snapshot: 'Read from the QBO sandbox company on 14 Jan 2026 at 09:12',
    fields: [['Company', 'Maple Ridge Consulting Inc. (Test)'], ['Account', '2050 HST payable (receivable)'], ['Balance at 31 Dec 2025', '5,486.94 payable']],
    who: `Pulled by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'qbo-6020': {
    kind: 'qbo', title: 'QBO account 6020 Meals and entertainment, balance at 31 Dec 2025',
    snapshot: 'Read from the QBO sandbox company on 14 Jan 2026 at 09:12',
    fields: [['Company', 'Maple Ridge Consulting Inc. (Test)'], ['Account', '6020 Meals and entertainment'], ['Balance at 31 Dec 2025', '1,941.65'], ['Half, for the add-back', '970.83']],
    who: `Pulled by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'qbo-6100': {
    kind: 'qbo', title: 'QBO account 6100 Accounting fees, balance at 31 Dec 2025',
    snapshot: 'Read from the QBO sandbox company on 14 Jan 2026 at 09:12',
    fields: [['Company', 'Maple Ridge Consulting Inc. (Test)'], ['Account', '6100 Accounting fees'], ['Balance at 31 Dec 2025', '3,000.00'], ['Lines', '12 monthly debits of 250.00 plus HST, BRIGHTPATH BOOKKEEPING TEST INC']],
    who: `Pulled by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'qbo-4010': {
    kind: 'qbo', title: 'QBO account 4010 Sales, Northwind Logistics Inc. (Test)',
    snapshot: 'Read from the QBO sandbox company on 14 Jan 2026 at 09:12',
    fields: [['Company', 'Maple Ridge Consulting Inc. (Test)'], ['Account', '4010 Sales'], ['Customer', 'Northwind Logistics Inc. (Test)'], ['Sales to this customer, year', '168,000.00 of 186,700.00 total (about 90%)']],
    who: `Pulled by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'ans-loan': {
    kind: 'answer', title: 'Client answer: money taken out of the company', question: 'Anything else we should know about money you took out or put back?',
    answer: 'I take money out of the company when I need it. I put back $12,000 on 18 December. I will probably take about $10,000 again in January.',
    who: `Answered by ${STAFF.client} in the client app`, when: '12 Jan 2026',
  },
  'ans-home': {
    kind: 'answer', title: 'Client answer: home office', question: 'Do you work from home? How much of your home is the office?',
    answer: 'I pay $2,800 a month rent for my home. About 15% of it is my office.',
    who: `Answered by ${STAFF.client} in the client app`, when: '12 Jan 2026',
  },
  'ans-div': {
    kind: 'answer', title: 'Client answer: the December payment', question: 'What was the $20,000 paid out on 20 December?',
    answer: 'The $20,000 on 20 December was a dividend.',
    who: `Answered by ${STAFF.client} in the client app`, when: '12 Jan 2026',
  },
  'ans-psb': {
    kind: 'answer', title: 'Client answer: how you work with Northwind', question: 'Where and how do you do the work for your main client?',
    answer: 'Northwind is my main client. On Northwind days I work in their office, 9 to 5, on their laptop, and they call me a contractor. On other days I work from home.',
    who: `Answered by ${STAFF.client} in the client app`, when: '12 Jan 2026', flagEvidence: true,
  },
  'cra-hst': {
    kind: 'cra', title: 'CRA My Business Account, HST program account, quarter 4 2025',
    fields: [['Program account', 'HST, 983056423RT0001'], ['Period', 'Quarter 4 2025'], ['Due', '2 Feb 2026'], ['Paid', '30 Jan 2026'], ['Captured from', 'CRA My Business Account, representative view']],
    who: `Captured by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'ly-2680': {
    kind: 'lastyear', title: 'Last year\'s return, Schedule 100, taxes payable (GIFI 2680)',
    fields: [['Return', 'Maple Ridge Consulting Inc. (Test), year end 31 Dec 2024'], ['Schedule', 'Schedule 100, balance sheet'], ['GIFI line', '2680 Taxes payable'], ['Amount at 31 Dec 2024', '5,113.28']],
    who: `Carried forward by ${STAFF.ops}`, when: '14 Jan 2026',
  },
  'rs-1300': {
    kind: 'reason', title: 'Reason for the shareholder loan treatment',
    reason: 'Treated as a shareholder loan, not as income. Repayment is due by 31 Dec 2026 (the end of the fiscal year after the year the loan was made). No interest is charged: flagged for the CPA as 01-F04.',
    who: `Reason written by ${STAFF.prep}`, when: '30 Sep 2026',
  },
  'rs-6020': {
    kind: 'reason', title: 'Reason for the meals add-back',
    reason: 'Only half of meals and entertainment is deductible, so half of 1,941.65 is added back on Schedule 1.',
    who: `Reason written by ${STAFF.prep}`, when: '30 Sep 2026',
  },
}

// ---------- lists ----------
const fig = (id, line, name, amount, src, extra = {}) => ({ id, line, name, amount, src, ...extra })

export const lists = {
  // Family: the CPA review (version A)
  cpa: [
    fig('f1', '1301', 'Due from shareholder', '13,211.58', ['lv-dec-p2', 'sh-feb12', 'qbo-1300', 'ans-loan', 'rs-1300']),
    fig('f2', '2680', 'Taxes payable (HST)', '5,486.94', ['cra-hst', 'qbo-2050', 'ly-2680']),
    fig('f3', 'Sch. 1', 'Meals add-back', '970.83', ['qbo-6020', 'rs-6020']),
    fig('f4', '8000', 'Sales to Northwind', '168,000.00', ['ans-psb', 'qbo-4010'],
      { flag: { id: '01-F01', text: 'Personal services business signs' }, flagCount: 1 }),
    fig('f5', 'Sch. 100', 'Dividend declared (non-eligible)', '20,000.00', ['t5-draft', 'sh-dec20', 'ans-div']),
    fig('f6', 'Sch. 1', 'Home office, 15% of rent', '5,040.00', ['ans-home'],
      { flag: { id: '01-F07', text: 'Home office needs a person\'s decision' }, flagCount: 1 }),
    fig('f7', '8862', 'Accounting fees', '3,000.00', []),
    fig('f8', '1002', 'Chequing (CAD), balance at year end', '131,184.97', ['lv-dec-p3']),
  ],
  // Family: the preparer's workbench (version B), cite a tax choice or an orphan (RV-22)
  prep: [
    fig('p1', '8862', 'Accounting fees', '3,000.00', [], { cand: ['qbo-6100', 'sh-acct'] }),
    fig('p2', 'Sch. 1', 'Home office, 15% of rent', '5,040.00', [], { cand: ['ans-home'], choice: true }),
    fig('p3', '1301', 'Due from shareholder', '13,211.58', ['lv-dec-p2', 'sh-feb12', 'qbo-1300', 'ans-loan', 'rs-1300']),
    fig('p4', 'Sch. 1', 'Meals add-back', '970.83', ['qbo-6020', 'rs-6020']),
    fig('p5', 'Sch. 100', 'Dividend declared (non-eligible)', '20,000.00', ['t5-draft', 'sh-dec20', 'ans-div']),
    fig('p6', '2680', 'Taxes payable (HST)', '5,486.94', ['cra-hst', 'qbo-2050', 'ly-2680']),
  ],
  // Verify an extracted value (EV-6), version B second page
  verify: [
    { id: 'v1', name: 'Deposit on 18 Dec', amount: row18.dep, src: ['lv-dec-p2'] },
    { id: 'v2', name: 'Withdrawal on 20 Dec', amount: row20.wd, src: ['v2-box'] },
    { id: 'v3', name: 'Google Workspace on 17 Dec', amount: stmtRows[idxOf(544)].wd, src: ['v3-box'] },
    { id: 'v4', name: 'Presto on 17 Dec', amount: stmtRows[idxOf(545)].wd, src: ['v4-box'] },
  ],
  // Ops: check a document or CRA capture (version C)
  ops: [
    { id: 'o1', name: 'Lakeview chequing statement, December 2025', what: 'Bank statement from the client', src: ['lv-dec-p2', 'lv-dec-p3'] },
    { id: 'o2', name: 'CRA HST program account capture', what: 'CRA capture', src: ['cra-hst'] },
    { id: 'o3', name: 'T5 slip draft, December dividend', what: 'Document from the preparer', src: ['t5-draft'] },
    { id: 'o4', name: 'Aurora business card statement, December 2025', what: 'Bank statement from the client', src: [] },
    { id: 'o5', name: 'Client answers, onboarding', what: 'Client answers', src: ['ans-loan', 'ans-home', 'ans-div'] },
  ],
}

// extra sources for the verify list (each boxes one value on statement page 2)
sources['v2-box'] = { ...sources['lv-dec-p2'], box: boxes.dec20, ocr: `${row20.desc} ${row20.wd}`, extracted: `${row20.date}, withdrawal ${row20.wd}` }
sources['v3-box'] = { ...sources['lv-dec-p2'], box: boxes.dec17a, ocr: `${stmtRows[idxOf(544)].desc} ${stmtRows[idxOf(544)].wd}`, extracted: `${stmtRows[idxOf(544)].date}, withdrawal ${stmtRows[idxOf(544)].wd}` }
sources['v4-box'] = { ...sources['lv-dec-p2'], box: boxes.dec17b, ocr: `${stmtRows[idxOf(545)].desc} ${stmtRows[idxOf(545)].wd}`, extracted: `${stmtRows[idxOf(545)].date}, withdrawal ${stmtRows[idxOf(545)].wd}` }

// sheet grids need their rows
for (const s of Object.values(sources)) {
  if (s.kind === 'sheet') s.grid = s.rows.map((n) => (n === 1 ? { line: 1, cells: csvHeader } : { line: n, cells: [csvRow(n).date, csvRow(n).desc, csvRow(n).wd, csvRow(n).dep, csvRow(n).bal] }))
}

export const client = {
  name: 'Maple Ridge Consulting Inc. (Test)', ye: '31 Dec 2025', bn: 'Business number on file', staff: STAFF,
}
