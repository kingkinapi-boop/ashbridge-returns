// Made-up test-world data for the three steps this version draws. Two returns: Maple Ridge Consulting Inc. (Test), Eglinton Retail Ltd. (Test).
// Whole dollars in Taxprep cells (RT-25). Every count on a page is computed from these arrays.
export const UNIT = 'dollars'

const q = (src, label) => ({ src, label })

// ================================================================ Maple Ridge
const mapleItems = [
  { id: 't1', cell: 'S1.ADD.MEALS', value: '$971', cls: 'orphan', src: 'lock-meals', needs: 'A source or a written reason',
    blurb: 'Typed in Taxprep; not in the import file.',
    exact: [], rounds: [q('qbo-6021', 'QBO account 6020, half: $970.83')] },
  { id: 't2', cell: 'S23.BL.SHARE', value: '100%', cls: 'orphan', kind: 'bl', src: 'lock-bl', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep. Onboarding lists no associated corporation.',
    exact: [q('onb-rel', 'Onboarding: no associated company')], rounds: [] },
  { id: 't3', cell: 'S3.DIV.PAID[1].DESIG', value: 'Other than eligible', cls: 'orphan', kind: 'div', src: 'lock-desig', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep: the dividend designation.',
    exact: [q('onb-div', 'Onboarding, dividend list'), q('chq', 'Chequing statement, 20 Dec 2025')], rounds: [] },
  { id: 't4', cell: 'S4.NCL.APPLY', value: '$3,400', cls: 'orphan', kind: 'loss', src: 'lock-loss', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep: the non-capital loss applied this year.',
    exact: [q('onb-nol', 'Onboarding balances: $3,400.00')], rounds: [q('noa-2024', 'Notice of assessment: $3,399.60')] },
  { id: 't5', cell: 'S8.CCA.C10.CLAIM', value: '$2,592', cls: 'orphan', kind: 'cca', src: 'lock-cca', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep: the CCA claim for class 10.',
    exact: [], rounds: [] },
  { id: 't6', cell: 'S3.DIV.PAID[1].AMT', value: '$25,000 (imported $20,000)', valueLabel: '$25,000 (imported $20,000)', cls: 'overridden', src: 'lock-amt', needs: 'A reason for the change',
    blurb: 'Imported $20,000, now $25,000 in Taxprep. An override needs a reason, or restore the imported value in Taxprep and upload again.',
    diff: { importedHead: 'Imported (import file)', imported: '$20,000', typed: '$25,000', delta: '$5,000' } },
  { id: 't7', cell: 'S53.GRIP.OPEN', value: '$11,400 (from CRA $11,040)', valueLabel: '$11,400 (from CRA $11,040)', cls: 'overridden', src: 'lock-grip', needs: 'A reason for the change',
    blurb: 'Auto-fill brought $11,040 from CRA. A typed value over it is an override.',
    diff: { importedHead: 'Imported from CRA (Auto-fill)', imported: '$11,040', typed: '$11,400', delta: '$360' } },
  { id: 't8', cell: 'S4.LOAN.SH[1].AMT', value: '(blank) (imported $13,212)', valueLabel: '(blank), imported $13,212', cls: 'dropped', src: 'lock-drop', needs: 'Re-import it or explain why it is blank',
    blurb: 'The cell was imported and is blank in the lock export. It blocks sign-off until it is re-imported or explained.' },
  { id: 't9', cell: 'Export of 1 Oct, 15:20', value: '2 cells differ', valueLabel: '2 cells differ', cls: 'changed', src: 'lock-diff', needs: 'Unlock, fix, lock again, upload',
    blurb: 'This lock export differs from the last recorded one, and no import is recorded between them.',
    cells: ['S8.CCA.C10.CLAIM: $2,592 in the export of 10:41, $2,100 in the export of 15:20', 'S1.ADD.MEALS: $971 in the export of 10:41, $985 in the export of 15:20'] },
  { id: 't10', cell: 'S4.LOAN.INT', value: '$412', cls: 'orphan', src: 'lock-int', needs: 'A source or a written reason (CPA comment)',
    blurb: 'Typed in Taxprep after the CPA asked for interest on the loan.',
    exact: [], rounds: [] }
]
const byId = (id) => mapleItems.find((x) => x.id === id)

const mapleGroups = {
  traced: [
    ['S1.NI.BOOKS', '156,991', 'QBO profit and loss, net income'], ['S1.ADD.AMORT', '0', 'QBO account 7010'], ['S100.1002', '131,185', 'QBO account 1010'],
    ['S100.1301', '13,212', 'QBO account 1300'], ['S100.2707', '856', 'QBO account 2010'], ['S100.2680', '5,487', 'QBO account 2050'],
    ['S125.8000', '186,700', 'QBO account 4010'], ['S125.9200', '4,310', 'QBO account 6170'], ['S125.8811', '6,124', 'QBO account 6090'],
    ['S125.9270', '1,213', 'QBO account 6030'], ['S3.DIV.PAID[1].DATE', '20 Dec 2025', 'Client app, dividend list'], ['S4.LOAN.SH[1].DATE', '31 Dec 2025', 'QBO account 1300']
  ],
  rolled: [
    ['S1.RET.EARN.OPEN', '88,420', 'Last year\'s return facts'], ['S8.CCA.C10.UCC', '8,640', 'Last year\'s closing UCC, class 10'], ['S50.SHARE.CAP', '100', 'Last year\'s return facts']
  ],
  calculated: [
    ['S1.TOT.ADDS', '971', 'Schedule 1 additions'], ['S1.TAXABLE', '157,962', 'Taxable income'], ['S7.ABI', '157,962', 'Active business income'],
    ['S125.NETINC', '156,991', 'Schedule 125 net income'], ['S125.9999', '156,991', 'Net income after taxes'], ['S100.3600', '245,411', 'Retained earnings, closing'],
    ['S8.CCA.C10.END', '6,048', 'Closing UCC, class 10'], ['S4.NCL.CLOSE', '0', 'Non-capital loss, closing']
  ],
  allowed: [
    ['IDENT.Ident120', 'Y', 'Taxprep setting'], ['IDENT.Ident121', 'N', 'Taxprep setting'], ['IFirm.ContactID', 'M01', 'Filled from the iFirm contact']
  ],
  cra: [
    ['S4.NCL.OPEN', '3,400', 'Auto-fill from CRA'], ['S53.RDTOH.OPEN', '0', 'Auto-fill from CRA'], ['S1.INSTAL.PAID', '0', 'Auto-fill from CRA']
  ],
  rounding: [
    ['S100.LIAB.2680', '1', 'rounding: kept Schedule 100 balanced on the liability line with the largest amount']
  ]
}

const reworkRows = [
  { ...byId('t1'), done: 'Cited', doneText: 'Cited: QBO trial balance, account 6020' },
  { ...byId('t2'), done: 'Cited', doneText: 'Cited: client app onboarding, related companies' },
  { ...byId('t3'), done: 'Cited', doneText: 'Cited: client app onboarding, dividend list' },
  { ...byId('t10') },
  { ...byId('t4'), done: 'Cited', doneText: 'Cited: client app onboarding, prior-year balances' },
  { ...byId('t5'), done: 'Reason saved', doneText: 'Written reason saved' },
  { ...byId('t6'), needs: 'A reason for the change (CPA comment)' },
  { ...byId('t7'), done: 'Reason saved', doneText: 'Written reason saved' },
  { ...byId('t8'), done: 'Explained', doneText: 'Explained in a written reason' }
]

export const MAPLE = {
  traced: {
    exportName: 'the lock export', groups: mapleGroups,
    rows: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'].map(byId),
    items: mapleItems
  },
  rework: {
    exportName: 'the new lock export', groups: { ...mapleGroups, traced: [...mapleGroups.traced] },
    rows: reworkRows, items: [byId('t10')]
  },
  exceptions: {
    rows: [
      { id: 'e1', title: 'Personal services business signs', level: 'red', effect: 29828, state: 'open', src: 'ex-psb',
        found: 'Northwind Logistics is about 90% of revenue ($168,000.00 of about $186,700.00); owner works in its office; no employees. The small business deduction is claimed: about $29,828.00 of tax rests on it.',
        sourceWords: 'QBO sales by customer, 2025', last: 'Explained: the Northwind work is project based, done by its own staff on site, with a written contract on file.' },
      { id: 'e2', title: 'Shareholder loan unpaid at year end', level: 'red', effect: 13211.58, state: 'answered', choice: 'explained', src: 'ex-loan',
        found: '$13,211.58 due at 31 Dec 2025; repay by 31 Dec 2026 or the amount is added to income.',
        sourceWords: 'QBO trial balance, account 1300', answerText: 'Client told in the onboarding note; repayment plan in the file.' },
      { id: 'e3', title: 'Pay to a relative with no T4', level: 'red', effect: 12000, state: 'open', src: 'ex-spouse',
        found: 'Twelve payments of $1,000.00 to the owner\'s spouse sit in suspense, with no T4. The $12,000.00 deduction is at risk.',
        sourceWords: 'QBO suspense account 2300' },
      { id: 'e4', title: 'Government receipt in suspense', level: 'red', effect: 8000, state: 'open', src: 'ex-grant',
        found: 'A grant of $8,000.00 received on 9 Sep 2025 sits in suspense, not in income. Found by code from the account name.',
        sourceWords: 'QBO suspense account 2300' },
      { id: 'e5', title: 'Small supplier limit passed before registration', level: 'red', effect: 3848, state: 'accepted', choice: 'accepted', src: 'ex-small',
        found: 'Sales passed $30,000.00 in Q2 2025 and the HST registration is dated 12 Sep 2025. HST on the sales in between: $3,848.00.',
        sourceWords: 'QBO sales by quarter, 2025', answerText: 'Registered on the date the client gave; the earlier sales were made before the limit was known. The CPA to judge.' },
      { id: 'e6', title: 'Slips the return implies: T5 and T4A', level: 'amber', effect: 25300, state: 'open', src: 'ex-slips',
        found: 'A T5 for the $20,000.00 dividend and two T4As for fees of $3,300.00 and $2,000.00; none on file. The slips total $25,300.00.',
        sourceWords: 'Slips found by code' },
      { id: 'e7', title: 'HST payable at year end', level: 'amber', effect: 5486.94, state: 'answered', choice: 'explained', src: 'ex-hst',
        found: 'Q4 paid on 30 Jan 2026, so $5,486.94 is payable on 31 Dec 2025.',
        sourceWords: 'QBO HST report, Q4 2025', answerText: 'Matches the QBO HST report.' },
      { id: 'e8', title: 'Home office needs a person\'s decision', level: 'amber', effect: 5040, state: 'answered', choice: 'explained', src: 'onb-home',
        found: 'Rent paid personally; 15% used for the business: $5,040.00 of rent at stake.',
        sourceWords: 'Client app onboarding, home office answer', answerText: 'Claim $5,040.00, owner provides the lease.' },
      { id: 'e9', title: 'Prepaid expense not deferred', level: 'amber', effect: 4400, state: 'open', src: 'ex-prepaid',
        found: 'An annual insurance policy paid 1 Dec 2025 is all expensed; eleven months, $4,400.00, belong in prepaid expenses.',
        sourceWords: 'QBO trial balance, accounts 6140 and 1250', last: 'Explained: the policy is renewed each December and the amount is the same each year, so the effect is nil over time.' },
      { id: 'e10', title: 'Quick method eligibility', level: 'amber', effect: 1940, state: 'open', src: 'ex-quick',
        found: 'Taxable sales of $186,700.00 are under the $400,000.00 limit. The quick method may cut HST payable by about $1,940.00.',
        sourceWords: 'HST filing method and sales, 2025' },
      { id: 'e11', title: 'Late-filing exposure', level: 'amber', effect: 1560, state: 'open', src: 'ex-late',
        found: 'Filing is expected on 14 Jul 2026, after the 30 Jun 2026 due date: a late-filing penalty of 5% of $31,200.00.',
        sourceWords: 'Filing and payment dates' },
      { id: 'e12', title: 'Input tax credit claimed before registration', level: 'amber', effect: 412.3, state: 'open', src: 'ex-itc',
        found: 'HST of $412.30 paid on 14 Aug 2025, before the registration date of 12 Sep 2025, was claimed as an input tax credit.',
        sourceWords: 'QBO HST report, purchases before registration' },
      { id: 'e13', title: 'No interest charged on the shareholder loan', level: 'amber', effect: 132.12, state: 'answered', choice: 'explained', src: 'ex-loan',
        found: 'The loan was outstanding all year with no interest: a benefit of about $132.12.',
        sourceWords: 'QBO trial balance, account 1300', answerText: 'Benefit under subsection 80.4 considered; amount below $500.00; CPA to confirm.' }
    ]
  },
  comments: {
    sections: [
      { name: 'Schedule 1', comments: [
        { id: 'c1', topic: 'Meals line label', title: 'Meals line label: use the standard wording', text: 'Label the Schedule 1 meals line "Meals, 50% not deductible".', type: 'Presentation', sev: 'note', state: 'open', section: 'Schedule 1', src: 'cm-label',
          before: 'Meals add-back (Schedule 1, line 121)', after: 'Open',
          draft: { kind: 'taxprep', cell: 'S1.ADD.MEALS (line label)', before: 'Meals add-back', after: 'Meals, 50% not deductible', text: 'Type the new label in Taxprep on line 121; the number does not change.', cites: 'Taxprep lock export, S1.ADD.MEALS (found by code)' } },
        { id: 'c2', topic: 'Meals add-back', title: 'Meals: add-back matches half of 6020', text: 'Meals add-back should match half of account 6020.', type: 'Error', sev: 'should', state: 'resolved', section: 'Schedule 1', src: 'qbo-6020',
          before: '$971 at Schedule 1, line 121', after: '$971 (agreed, source cited)', resolve: ['trace', 't1', 'Open the cell in Trace'] }
      ] },
      { name: 'Capital (Schedules 8 and 6)', comments: [
        { id: 'c3', topic: 'Class 10 claim', title: 'Class 10: why nothing was added this year', text: 'Why is nothing added to class 10 this year?', type: 'Question', sev: 'note', state: 'open', section: 'Capital (Schedules 8 and 6)', src: 'cm-cca10',
          before: '$0 added at Schedule 8, class 10', after: 'Open' }
      ] },
      { name: 'Losses and reserves (Schedules 4 and 13)', comments: [
        { id: 'c4', topic: 'Shareholder loan', title: 'Shareholder loan: add interest', text: 'Add interest on the loan, or show why none is due.', type: 'Error', sev: 'must', state: 'open', section: 'Losses and reserves (Schedules 4 and 13)', src: 'cm-loan',
          before: '$0 at Schedule 4, line 150', after: 'Open', draft: { kind: 'cannot', reason: 'the file holds no loan rate or start date.' },
          resolve: ['trace', 't10', 'Resolve at the number'] }
      ] },
      { name: 'Shareholders and related parties (Schedules 50, 9 and 11, slips)', comments: [
        { id: 'c5', topic: 'Dividend', title: 'Dividend: amount differs from the bank', text: 'S3.DIV.PAID[1].AMT should be $20,000: the bank shows one transfer.', type: 'Error', sev: 'must', state: 'open', section: 'Shareholders and related parties (Schedules 50, 9 and 11, slips)', src: 'chq',
          before: '$25,000 at Schedule 3, line 200', after: 'Open',
          draft: { kind: 'fact', fact: 'Dividend paid, 20 Dec 2025', before: '$25,000.00', after: '$20,000.00', text: 'Set the fact to $20,000.00 and run the round trip.', cites: 'Lakeview chequing statement line 01-CHQ-2025-12-0031, $20,000.00 (found by code)' },
          resolve: ['trace', 't6', 'Resolve at the number'] }
      ] },
      { name: 'Payment and filing', comments: [
        { id: 'c6', topic: 'HST payment evidence', title: 'HST payment: attach the confirmation', text: 'Attach the payment confirmation for the Q4 HST paid on 30 Jan 2026.', type: 'Missing evidence', sev: 'should', state: 'open', section: 'Payment and filing', src: 'cm-hst-pay',
          before: 'No payment confirmation on file', after: 'Open', draft: { kind: 'cannot', reason: 'the document has to come from the client or the bank.' },
          resolve: ['shell-other.html?tab=Documents', null, 'Open the Documents tab'] }
      ] }
    ]
  }
}

// ================================================================ Eglinton Retail
const egItems = [
  { id: 't1', cell: 'S1.DED.FXLOSS', value: '$2,184', cls: 'orphan', src: 'lock-eg-fx', needs: 'A source or a written reason',
    blurb: 'Typed in Taxprep; not in the import file.',
    exact: [], rounds: [q('qbo-7100', 'QBO account 7100: $2,183.62')] },
  { id: 't2', cell: 'S23.BL.SHARE', value: '40%', cls: 'orphan', kind: 'bl', src: 'lock-eg-bl', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep: the business limit share. The parent claims 60%.',
    exact: [q('onb-eg-rel', 'Onboarding: 40% here, 60% parent')], rounds: [] },
  { id: 't3', cell: 'S3.DIV.PAID[1].DESIG', value: 'Eligible', cls: 'orphan', kind: 'div', src: 'lock-eg-desig', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep: the dividend designation.',
    exact: [q('onb-eg-div', 'Onboarding, dividend list')], rounds: [] },
  { id: 't4', cell: 'T2054.ELECT.AMT', value: '$5,000', cls: 'orphan', kind: 'elect', src: 'lock-eg-elect', needs: 'a source or a written reason',
    blurb: 'Typed in Taxprep: an election amount.',
    exact: [], rounds: [] },
  { id: 't5', cell: 'S8.CCA.C8.ADD', value: '$12,400 (imported $12,000)', valueLabel: '$12,400 (imported $12,000)', cls: 'overridden', src: 'lock-eg-ccaadd', needs: 'A reason for the change',
    blurb: 'Imported $12,000, now $12,400 in Taxprep. An override needs a reason, or restore the imported value in Taxprep and upload again.',
    diff: { importedHead: 'Imported (import file)', imported: '$12,000', typed: '$12,400', delta: '$400' } },
  { id: 't6', cell: 'Export of 1 Oct, 16:40', value: '1 cell differs', valueLabel: '1 cell differs', cls: 'changed', src: 'lock-eg-diff', needs: 'Unlock, fix, lock again, upload',
    blurb: 'This lock export differs from the last recorded one, and no import is recorded between them.',
    cells: ['S8.CCA.C8.CLAIM: $9,822 in the export of 11:05, $12,400 in the export of 16:40'] }
]
export const EGLINTON = {
  traced: {
    exportName: 'the lock export', rows: egItems, items: egItems,
    groups: {
      traced: [['S1.NI.BOOKS', '412,630', 'QBO profit and loss, net income'], ['S100.1002', '88,415', 'QBO account 1010 (CAD)'], ['S100.1003', '54,970', 'QBO account 1020 (USD, in CAD)'], ['S100.1121', '214,300', 'QBO account 1200'],
        ['S100.1301', '0', 'QBO account 1300'], ['S100.2707', '3,990', 'QBO account 2010'], ['S100.2680', '18,420', 'QBO account 2050'], ['S125.8000', '2,104,300', 'QBO account 4010'],
        ['S125.8320', '1,311,800', 'QBO account 5010'], ['S125.9200', '22,140', 'QBO account 6170'], ['S125.8810', '9,880', 'QBO account 7200'], ['S1.DED.AMORT', '8,420', 'QBO account 7010'],
        ['S3.DIV.PAID[1].AMT', '60,000', 'Client app, dividend list'], ['S3.DIV.PAID[1].DATE', '15 Dec 2025', 'Client app, dividend list']],
      rolled: [['S1.RET.EARN.OPEN', '640,210', 'Last year\'s return facts'], ['S8.CCA.C8.OPEN', '41,300', 'Last year\'s closing UCC, class 8'], ['S4.NCL.OPEN', '41,000', 'Last year\'s return facts'], ['S50.SHARE.CAP', '1,000', 'Last year\'s return facts']],
      calculated: [['S1.TOT.ADDS', '0', 'Schedule 1 additions'], ['S1.TAXABLE', '403,230', 'Taxable income'], ['S7.ABI', '403,230', 'Active business income'], ['S125.NETINC', '412,630', 'Schedule 125 net income'],
        ['S125.9999', '412,630', 'Net income after taxes'], ['S100.3600', '1,052,840', 'Retained earnings, closing'], ['S8.CCA.C8.CLAIM', '9,822', 'CCA claim, class 8'], ['S8.CCA.C8.END', '43,878', 'Closing UCC, class 8'], ['S23.BL.LIMIT', '200,000', 'Business limit after sharing']],
      allowed: [['IDENT.Ident120', 'Y', 'Taxprep setting'], ['IFirm.ContactID', 'M06', 'Filled from the iFirm contact']],
      linked: [['MJRAW.SLIPA[1].CORPNAME', 'Eglinton Holdings Inc. (Test)', 'Linked from the parent\'s return'], ['MJRAW.SLIPA[1].YEAREND', '31 Dec 2025', 'Linked from the parent\'s return'], ['MJRAW.SLIPA[1].SHARE', '60%', 'Linked from the parent\'s return'],
        ['MJRAW.SLIPA[1].LIMIT', '300,000', 'Linked from the parent\'s return'], ['MJRAW.SLIPA[1].Ghost01', '0', 'Linked from the parent\'s return'], ['MJRAW.SLIPA[1].Ghost02', '0', 'Linked from the parent\'s return']],
      cra: [['S4.NCL.OPEN.CRA', '41,000', 'Auto-fill from CRA'], ['S53.GRIP.OPEN', '27,300', 'Auto-fill from CRA']],
      rounding: [['S100.LIAB.2680', '1', 'rounding: kept Schedule 100 balanced on the liability line with the largest amount']]
    }
  },
  exceptions: {
    rows: [
      { id: 'e1', title: 'Business limit shared with the parent set differently', level: 'red', effect: 19000, state: 'open', src: 'ex-eg-bl',
        found: 'This return claims 50% of the business limit and the parent\'s return claims 60%: 110% between them. The overlap is worth about $19,000.00 of tax.',
        sourceWords: 'Business limit shares, both returns' },
      { id: 'e2', title: 'Inventory differs from the onboarding count', level: 'red', effect: 15650, state: 'open', src: 'ex-inv',
        found: 'Inventory in QBO is $214,300.00; the count the client gave at onboarding is $198,650.00. The difference is $15,650.00.',
        sourceWords: 'QBO inventory, account 1200, and the onboarding count' },
      { id: 'e3', title: 'Non-capital loss does not continue from last year', level: 'red', effect: 11000, state: 'open', src: 'ex-ncl',
        found: 'Last year\'s return closes at $41,000.00 and this return opens at $52,000.00: a gap of $11,000.00 of loss.',
        sourceWords: 'Last year\'s return facts and this return\'s opening' },
      { id: 'e4', title: 'Research account is not nil', level: 'amber', effect: 9400, state: 'open', src: 'ex-research',
        found: 'Account 6800 holds $9,400.00. A research account that is not nil is checked against the research credit rules. Found by code from the account name.',
        sourceWords: 'QBO trial balance, account 6800' },
      { id: 'e5', title: 'Foreign-currency balance at year end', level: 'amber', effect: 3640, state: 'open', src: 'ex-usd',
        found: 'US$38,200.00 is booked at $51,330.00; at the year-end rate it is $54,970.00. A gain of $3,640.00 is not recorded.',
        sourceWords: 'Maplestone Bank (Test) chequing USD', last: 'Explained: the exchange difference is booked by an adjusting entry each year after the bank rate is known.' }
    ]
  }
}
