// Made-up test-world data for the gap review and round trip prototypes (D07, D05). Names end "(Test)". No client wording.
// Facts come from reference/sample-clients (profile.md, onboarding.json, answer-key.json, bank CSVs) and reference/taxprep (day 3 probe).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const SC = path.resolve(here, '../../../../../reference/sample-clients')

export const PREPARER = 'Dana Whitfield (Test)'
export const OTHER_HOLDER = 'Sam Okafor (Test)'
export const TODAY = '3 Oct 2026'
export const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------- the returns
export const RETURNS = {
  maple: { key: 'maple', name: 'Maple Ridge Consulting Inc. (Test)', ye: '31 Dec 2025', due: '30 Jun 2026', tier: 2, state: 'Prepare', short: 'Maple Ridge' },
  halton: { key: 'halton', name: 'Halton Haulage Ltd. (Test)', ye: '31 Mar 2026', due: '30 Sep 2026', tier: 1, state: 'Prepare', short: 'Halton Haulage' },
  danforth: { key: 'danforth', name: 'Danforth Cleaning Co. Ltd. (Test)', ye: '31 Dec 2025', due: '30 Jun 2026', tier: 3, state: 'Prepare', short: 'Danforth Cleaning' },
}

// ---------------------------------------------------------------- sources (the one shared viewer draws these)
export const SOURCES = {
  'maple-1300': { title: 'QuickBooks Online account 1300, Due from shareholder, 2025 (test company)', head: ['Date', 'Entry', 'Debit', 'Credit'], num: [2, 3], hl: 6,
    rows: [['12 Feb 2025', 'Advance to owner', '4,000.00', ''], ['3 Apr 2025', 'Advance to owner', '6,500.00', ''], ['20 Jun 2025', 'Advance to owner', '5,000.00', ''], ['15 Aug 2025', 'Advance to owner', '7,500.00', ''], ['10 Oct 2025', 'Advance to owner', '4,000.00', ''], ['18 Dec 2025', 'Repayment from owner', '', '12,000.00'], ['31 Dec 2025', 'Balance at year end', '13,211.58', '']],
    caption: 'Account 1300 balance $13,211.58 (advances $27,000.00, repaid $12,000.00, business items on her card $1,788.42).' },
  'maple-chq': { title: 'Lakeview Bank (Test) chequing 4821, December 2025', head: ['Date', 'Description', 'Out', 'In'], num: [2, 3], hl: 1,
    rows: [['17 Dec 2025', 'PRE-AUTH DEBIT AURORA CARD 7712', '420.00', ''], ['18 Dec 2025', 'E-TRANSFER RECEIVED PRIYA NAIR TEST', '', '12,000.00'], ['20 Dec 2025', 'E-TRANSFER SENT PRIYA NAIR TEST', '20,000.00', ''], ['23 Dec 2025', 'DEPOSIT NORTHWIND LOGISTICS TEST', '', '14,000.00']],
    caption: 'Statement line 18 Dec 2025: $12,000.00 received from the owner, the only repayment in the year.' },
  'maple-note': { title: 'Onboarding, the client\'s own notes', head: ['Note', 'Client\'s words'], num: [], hl: 1,
    rows: [['1', 'Northwind is my main client. On Northwind days I work in their office, 9 to 5, on their laptop.'], ['2', 'I take money out of the company when I need it. I put back $12,000 on 18 December. I will probably take about $10,000 again in January.'], ['3', 'I pay $2,800 a month rent for my home. About 15% of it is my office.'], ['4', 'The $20,000 on 20 December was a dividend.']],
    caption: 'Note 2: a new advance of about $10,000 is expected in January 2026.' },
  'maple-home': { title: 'Onboarding, home office', head: ['Item', 'Value'], num: [], hl: 3,
    rows: [['Share of home used for business', '15%'], ['Monthly rent paid personally', '$2,800.00'], ['Annual amount if claimed', '$5,040.00'], ['Arrangement to reimburse the owner', 'None on file. The company has never reimbursed her.']],
    caption: 'No arrangement to reimburse the owner is on file.' },
  'maple-pcard': { title: 'Aurora Card (Test), owner\'s personal card 3309, business items', head: ['Date', 'Description', 'Amount'], num: [2], hl: 0,
    rows: [['16 Apr 2025', 'EAST SIDE MARIOS #2286 TORONTO ON', '86.40'], ['10 Sep 2025', 'MOXIES #0412 TORONTO ON', '124.15']],
    caption: 'Two lunches on the personal card, $86.40 and $124.15, listed by the owner as business; no client is named.' },
  'maple-div': { title: 'Onboarding, declared dividends', head: ['Declared on', 'Amount', 'Kind', 'Resolution on file'], num: [1], hl: 0,
    rows: [['20 Dec 2025', '$20,000.00', 'Non-eligible', 'Yes']],
    caption: 'A resolution is on file; its date is not recorded.' },
  'halton-loan': { title: 'Onboarding, equipment loan', head: ['Item', 'Value'], num: [], hl: 0,
    rows: [['Lender', 'Lakeview Equipment Finance (Test)'], ['Principal', '$100,000.00'], ['Annual rate', '8.5%'], ['Term', '60 months'], ['First payment', '28 Jul 2025'], ['Level payment', '$2,051.65']],
    caption: 'Paid by the lender straight to the dealer on 2 Jun 2025; payments come out of chequing.' },
  'halton-card': { title: 'Aurora Card (Test), business card 4408', head: ['Date', 'Description', 'Amount'], num: [2], hl: 3,
    rows: [['24 Sep 2025', 'FRESHCO #1972 VAUGHAN ON', '120.85'], ['31 Oct 2025', 'LOBLAWS #6717 MISSISSAUGA ON', '72.96'], ['16 Nov 2025', 'LOBLAWS #5629 HAMILTON ON', '135.71'], ['5 Dec 2025', 'TRILLIUM AIRWAYS TEST', '1,642.00']],
    caption: 'Four of the ten personal-looking charges on the business card, including the $1,642.00 flight on 5 Dec 2025.' },
  'halton-cra': { title: 'Onboarding, what the CRA account credits for instalments', head: ['Date', 'Credited'], num: [1], hl: -1,
    rows: [['30 Jun 2025', '$3,500.00'], ['30 Sep 2025', '$3,500.00'], ['31 Mar 2026', '$3,500.00']],
    caption: 'Three credited. The bank shows four payments of $3,500.00; none is credited for 31 Dec 2025.' },
  'halton-pen': { title: 'Maplestone Bank (Test) chequing 5530, August 2025', head: ['Date', 'Description', 'Out'], num: [2], hl: 1,
    rows: [['12 Aug 2025', 'WEEKLY SETTLEMENT TRANSCAN FREIGHT TEST', ''], ['19 Aug 2025', 'GST/HST PENALTY AND INTEREST', '412.37'], ['26 Aug 2025', 'LAKEVIEW EQUIPMENT FINANCE TEST', '2,051.65']],
    caption: 'One payment of $412.37 to the CRA; the line does not say how much is penalty and how much is interest.' },
}

// ---------------------------------------------------------------- gap questions (code decided found, missing, conflicting or weak; AI filled slot values only, AI-12)
// ev: found | missing | conflicting | weak
export const GAPS = {
  maple: [
    { id: 'q1', text: 'Is the $13,211.58 owed by the shareholder at year end to be repaid by 31 Dec 2026?', ev: 'conflicting', src: 'maple-1300', hl: 6,
      obs: 'Code found the balance in account 1300. The owner\'s own note says she will borrow about $10,000 again in January, so the repayment may not count (onboarding note 2).',
      slots: [['Balance owed at year end', '$13,211.58'], ['Repayment due by', '31 Dec 2026'], ['How the owner will repay', '']] },
    { id: 'q2', text: 'Was the $12,000.00 repaid on 18 Dec 2025 followed by a new advance in January 2026?', ev: 'weak', src: 'maple-chq', hl: 1,
      obs: 'Only the client\'s note says so (onboarding note 2); no January bank rows exist yet in the files.',
      slots: [['New advance, about', '$10,000.00'], ['Date of the new advance', '']] },
    { id: 'q3', text: 'Does the company reimburse the owner for the 15% of her home rent used as an office?', ev: 'missing', src: 'maple-home', hl: 3,
      obs: 'No arrangement to reimburse the owner is on file. The rent of $2,800.00 a month is paid personally.',
      slots: [['Share of home used', '15%'], ['Monthly rent paid personally', '$2,800.00'], ['Reimbursement arrangement', '']] },
    { id: 'q4', text: 'Which of the two lunches on the owner\'s personal card were with clients?', ev: 'found', src: 'maple-pcard', hl: 0,
      obs: 'Code found both charges ($86.40 on 16 Apr 2025, $124.15 on 10 Sep 2025). Neither names a client.',
      slots: [['Client, 16 Apr 2025 lunch', ''], ['Client, 10 Sep 2025 lunch', '']] },
    { id: 'q5', text: 'On what date was the directors\' resolution for the $20,000.00 dividend of 20 Dec 2025 signed?', ev: 'found', src: 'maple-div', hl: 0,
      obs: 'Onboarding says a resolution is on file but not its date.',
      slots: [['Resolution date', ''], ['Kind of dividend', 'Non-eligible']] },
  ],
  halton: [
    { id: 'q1', text: 'Is the tractor financing $100,000.00 at 8.5% over 60 months from Lakeview Equipment Finance (Test)?', ev: 'found', src: 'halton-loan', hl: 1,
      obs: 'Found in onboarding; the lender paid the dealer on 2 Jun 2025 and no bank row shows it.',
      slots: [['Amount financed', '$100,000.00'], ['Annual rate', '8.5%'], ['First payment', '28 Jul 2025']] },
    { id: 'q2', text: 'Which charges on the business card are personal: the grocery charges and the family flight?', ev: 'found', src: 'halton-card', hl: 3,
      obs: 'Code found the flight ($1,642.00 on 5 Dec 2025) and the grocery charges; the owner will say which.',
      slots: [['Grocery charges, total', ''], ['Family flight', '$1,642.00']] },
    { id: 'q3', text: 'Why does the CRA credit three instalments of $3,500.00 when the bank shows four?', ev: 'conflicting', src: 'halton-cra', hl: -1,
      obs: 'The bank shows payments on 30 Jun, 30 Sep and 31 Dec 2025 and 31 Mar 2026. The CRA account credits no payment for 31 Dec 2025.',
      slots: [['Payment not credited', '31 Dec 2025'], ['Amount', '$3,500.00'], ['Client asked CRA to move the credit', '']] },
    { id: 'q4', text: 'Of the $412.37 paid to the CRA on 19 Aug 2025, how much is penalty and how much is interest?', ev: 'weak', src: 'halton-pen', hl: 1,
      obs: 'The bank line reads "penalty and interest" with one amount.',
      slots: [['Penalty part', ''], ['Interest part', '']] },
  ],
  danforth: [],
}

export const BANK = [
  { id: 'b1', text: 'Is any of the revenue from outside Canada?', slots: [['Amount from outside Canada', ''], ['Country', '']], src: null },
  { id: 'b2', text: 'Were any capital assets bought or sold in the year?', slots: [['Asset', ''], ['Date', ''], ['Amount', '']], src: null },
  { id: 'b3', text: 'Did the company pay a bonus after year end?', slots: [['Amount', ''], ['Date paid', '']], src: null },
  { id: 'b4', text: 'Was any of the owner\'s pay taken as salary?', slots: [['Salary paid in the year', ''], ['Payroll account open', '']], src: null },
]

// ---------------------------------------------------------------- .GFI read (Maple), from the adjusted trial balance of the answer key
function gifiLines(dir) {
  const k = JSON.parse(fs.readFileSync(path.join(SC, dir, 'answer-key.json'), 'utf8'))
  const m = new Map()
  for (const r of k.trialBalance.adjusted.rows) {
    const e = m.get(r.gifi) || { code: r.gifi, desc: r.gifiName, net: 0 }
    e.net += r.debit - r.credit
    m.set(r.gifi, e)
  }
  return [...m.values()].sort((a, b) => a.code - b.code).map((e) => ({ code: e.code, desc: e.desc, amount: Math.round(e.net * 100) / 100 }))
}
export const GFI = { maple: gifiLines('01-maple-ridge'), halton: gifiLines('02-halton-haulage'), danforth: gifiLines('10-danforth-cleaning') }

// flags on the mapping (TB-3, TB-12): accounts, not codes
export const GFI_FLAGS = [
  { id: 'f1', acct: '2010 Credit card payable', kind: 'Changed from last year', detail: 'Last year 2620 Accounts payable; this year 2707 Credit card loans.', fix: 'accept' },
  { id: 'f2', acct: '6090 Office supplies', kind: 'Mapped to more than one code', detail: 'Mapped to 8810 Office expenses and to 8811 Office stationery and supplies.', fix: 'qbo' },
  { id: 'f3', acct: '6190 Postage', kind: 'Mapped to no code', detail: 'No GIFI code in the file for this account.', fix: 'qbo' },
  { id: 'f4', acct: '1500 Equipment', kind: 'Mapped to a code CRA calculates', detail: 'Mapped to 2008 Total tangible capital assets. Counted as unmapped; amounts go on component codes.', fix: 'qbo' },
]

// ---------------------------------------------------------------- import file, still held, upload classes, diagnostics
export const IMPORT_ROWS = [
  ['S8 class 10, additions', 'CCA class 10 goes to copy 3', '$2,100.00', 'New row, next free copy'],
  ['S8 class 8, additions', 'copy 1 (holds class 8)', '$1,284.40', 'Changed'],
  ['S50 shareholder, Priya Nair (Test)', 'copy 1 (holds this shareholder)', '100%', 'Unchanged, not written'],
  ['S125 line 8000, trade sales', 'IDENT-linked cell', '$186,700.00', 'Changed'],
]
export const WAITING = [
  { fact: 'Shareholder, Schedule 50', why: 'Waits on verification', link: '../../b-split-pane/record.html#/evidence' },
  { fact: 'Owner\'s home office share', why: 'Waits on verification', link: '../../b-split-pane/record.html#/evidence' },
]
export const REIMPORT = {
  changed: [['S8 class 8, additions', '$1,284.40', '$1,396.00'], ['S1 line 121, meals add-back', '$970.83', '$975.83'], ['S125 line 8523, meals', '$1,941.65', '$1,951.65']],
  cleared: [['S8 class 10, additions', '$2,100.00', 'empty']],
}
export const STILL_HELD = [
  { id: 'h1', cell: 'S8 class 8, additions, copy 1 (CCACat.FD08C[1].FED.Ttw08cA3)', value: '$2,100.00', why: 'The asset was removed from the register; the figure is gone from the new import file.' },
  { id: 'h2', cell: 'S3 line 455, eligible dividends designated (Ttadiv369)', value: '$8,000.00', why: 'The designation was removed from the verified facts.' },
]
export const CLASSES = [['Traced', 84], ['Overridden', 3], ['Dropped', 1], ['Rolled forward', 5], ['Orphan', 2], ['Calculated', 14]]

// diagnostics from the day 3 probe file (reference/taxprep/2026-10-03-day3/diagnostics-probe.md): severity, code, cell, form, text
export const DIAG = [
  ['Filing error', 'N1', '', 'N/A', 'Certain errors detected by the federal bar codes diagnostics have not been corrected.'],
  ['Filing error', 'R2000100', 'IDENT.Ident160', 'ID', 'The type of corporation at the end of the taxation year has not been provided on line 040.'],
  ['Filing error', 'R2000032', 'IDENT.Ident212', 'ID', 'Certification information incomplete at lines 950, 951, 954, 955, 956, 957.'],
  ['Filing error', 'N18', 'IDENT.Ident212', 'ID', 'Corporation Internet Filing does not process returns without complete certification.'],
  ['Filing error', 'R2000017', 'IDENT.Ident240', 'ID', 'Yes or No at line 070 (first year of filing after incorporation) not answered.'],
  ['Filing error', 'R2000028', 'IDENT.Ident309', 'ID', 'Answered No at line 957 but no contact name and telephone provided.'],
  ['Filing error', 'R2000299', 'IDENT.Ident422', 'ID', 'A NAICS code must be entered at main revenue-generating business activity.'],
  ['Filing error', 'R2000002', 'IDENT.Ident7', 'ID', 'Business number (line 001) not provided.'],
  ['Filing error', 'R2000300', 'IDENT.Ident8', 'ID', 'Province or territory where income earned (line 750) not indicated.'],
  ['Filing error', 'R1000001', 'GFGIB.Ttwgib31', 'S100', 'Balance sheet information is missing.'],
  ['Filing error', 'R1000002', 'GFGIB.Ttwgib31', 'S100', 'Total assets does not equal total liabilities plus total shareholder equity.'],
  ['Filing error', 'R130', 'GFBGII[1].GFGII.Ttwgii2', 'S125', 'Describe the activity carried on only if multiple financial statements.'],
  ['Filing error', 'R1410102', 'GFGHA.Ttwgha9', 'S141', 'Corporation has not answered YES or NO at line 111.'],
  ['Error', 'M5', 'IDENT.Ident128', 'ID', 'Incorporation date missing.'],
  ['Error', 'M42', 'IDENT.Ident254', 'ID', 'Breakdown of principal products or services not provided on line 284.'],
  ['Error', 'M318', 'IDENT.Ident431', 'ID', 'Prepared by a tax preparer for a fee: preparer information missing.'],
  ['Error', 'M417', 'FDEDI.Ttwedi44', 'T183', 'Indicate whether T183 was electronically signed by the authorized signing officer.'],
  ['Error', 'G107', 'GFGIB.Ttwgib31', 'S100', 'Item 2599 is required by the CRA. Verify if different from zero.'],
  ['Error', 'G109', 'GFGIB.Ttwgib36', 'S100', 'Item 3499 is required by the CRA. Verify if different from zero.'],
  ['Error', 'G123', 'GFBGII[1].GFGII.Ttwgii18', 'S125', 'Item 9368 is required by the CRA. Verify if different from zero.'],
  ['Warning', 'E2099', 'IDENT.Ident187', 'ID', 'Value (BC) in the Province/State field of the contact information (invalid format).'],
  ['Warning', 'E2105', 'IDENT.Ident199', 'ID', 'Same as E2099 for the second contact.'],
  ['Informative', 'P71', 'HSINT.Ttwint8', 'INTEREST', 'T2 seems to be filed late (interest and penalty note).'],
]
export const DIAG_GONE = [
  ['Filing error', 'R2000017', 'IDENT.Ident240', 'ID', 'Yes or No at line 070 (first year of filing after incorporation) not answered.'],
  ['Error', 'M5', 'IDENT.Ident128', 'ID', 'Incorporation date missing.'],
]
// after the preparer fixed the identification in Taxprep and pasted again: only these remain
export const DIAG_CLEAN = DIAG.filter((r) => ['E2099', 'E2105', 'P71'].includes(r[1]))
export const DIAG_SEV_ORDER = ['Filing error', 'Error', 'Warning', 'Informative']

// ---------------------------------------------------------------- upload refusals (RT-1, RT-2, RT-25 and the file checks)
export const REFUSALS = {
  'refused-client': { title: 'This export is for another return', why: 'The business number on the export ends 0009; this return\'s business number ends 0017.', fix: 'Open Maple Ridge Consulting Inc. (Test) in Taxprep, lock it, and export again.', field: 'lock', fieldMsg: 'Choose the lock export of this return' },
  'refused-yearend': { title: 'The year end differs', why: 'The export\'s tax year end is 31 Dec 2024; this return\'s is 31 Dec 2025.', fix: 'Export the 2025 return from Taxprep and upload that file.', field: 'lock', fieldMsg: 'Choose the lock export for year end 31 Dec 2025' },
  'refused-guid': { title: 'The file header differs from this return\'s first export', why: 'The header GUID ends c41e; the one recorded from this return\'s first export ends 7b90.', fix: 'Export again from the same return in Taxprep. If the return was created again in Taxprep, tell the CPA before uploading.', field: 'lock', fieldMsg: 'Choose a lock export from this return\'s own file' },
  'refused-stale': { title: 'The export is stale', why: 'Three cells the second import changed do not hold that import\'s values and are not classed overridden with a reason: S8 class 8 additions, S1 line 121, S125 line 8523.', fix: 'Import the latest file into Taxprep, lock, and export again.', field: 'lock', fieldMsg: 'Choose a lock export made after the latest import' },
  'refused-cents': { title: 'A value has cents', why: 'Row 14 (S8 class 8 additions) holds 1,284.40. Taxprep takes whole dollars only (RT-25).', fix: 'Change the value in Taxprep to a whole number, lock, and export again.', field: 'lock', fieldMsg: 'Choose a lock export with whole-dollar values' },
  'refused-char': { title: 'A character is outside Windows-1252', why: 'Row 31 (IDENT.Ident202, corporation name) holds the letter "Ł", which Windows-1252 cannot hold.', fix: 'Replace it in Taxprep with a plain letter, lock, and export again.', field: 'lock', fieldMsg: 'Choose a lock export with Windows-1252 characters only' },
  'refused-pdf': { title: 'The printed return is not a PDF', why: 'The second file is a Word document (.docx).', fix: 'Print the return to PDF from Taxprep (Office copy) and choose that file.', field: 'pdf', fieldMsg: 'Choose the printed return as a PDF file' },
  'refused-size': { title: 'The printed return is over the size cap', why: 'The file is 31.4 MB; the cap is 25 MB.', fix: 'Print the Office copy only, not every copy, and choose the new file.', field: 'pdf', fieldMsg: 'Choose a PDF of 25 MB or less' },
}
// GIFI refusals
export const GFI_REFUSALS = {
  'refused-header': { title: 'The file holds a header and no code lines', why: 'Nothing was read: the file stops after its header.', fix: 'Pick T2 Corporation on the Tax mapping tab in Workpapers, then export again.' },
  'refused-layout': { title: 'The layout is not a .GFI export', why: 'Expected the columns Code, Description and Amount; found Account, Name, Debit, Credit and Code.', fix: 'In Workpapers choose the .GFI export (not the Excel export) and upload that file.' },
  'refused-calc': { title: 'A code CRA calculates', why: 'Account 1500 Equipment is mapped to 2008 Total tangible capital assets, which CRA calculates. It is counted as unmapped (1 account).', fix: 'Map the account to a component code in Workpapers, export again and upload the new file.' },
  'refused-unknown': { title: 'A code is not in the GIFI list', why: 'Code 8555 is not in the list the firm holds from CRA\'s guide (RC4088).', fix: 'Check the code in Workpapers, export again and upload the new file.' },
}
