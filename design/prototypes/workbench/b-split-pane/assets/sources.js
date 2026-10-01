/* Made-up source documents for Maple Ridge Consulting Inc. (Test). One shared viewer (D03) draws them in the pane and in the second window. */
window.ASH_SOURCES = {
  'chq': { title: 'Lakeview Bank (Test) chequing 4821, December 2025, page 2', head: ['Date', 'Description', 'Out', 'In'], hl: 2, num: [2, 3],
    rows: [['17 Dec 2025', 'PRE-AUTH DEBIT AURORA CARD 7712', '420.00', ''], ['18 Dec 2025', 'E-TRANSFER RECEIVED PRIYA NAIR (TEST)', '', '12,000.00'], ['20 Dec 2025', 'E-TRANSFER SENT PRIYA NAIR (TEST)', '20,000.00', ''], ['22 Dec 2025', 'PRE-AUTH DEBIT ROGERS', '88.41', ''], ['23 Dec 2025', 'DEPOSIT NORTHWIND LOGISTICS (TEST)', '', '14,000.00'], ['29 Dec 2025', 'PRE-AUTH DEBIT LAKEVIEW FEE', '15.00', '']],
    caption: 'Statement line 01-CHQ-2025-12-0031: $20,000.00 (other than eligible dividend, per the dividend list in onboarding).' },
  'qbo-tb': { title: 'QuickBooks Online trial balance, 31 Dec 2025 (test company)', head: ['Account', 'Name', 'Debit', 'Credit'], hl: 2, num: [2, 3],
    rows: [['1010', 'Chequing (CAD)', '131,184.97', ''], ['1050', 'Aurora business card float', '0.00', ''], ['1300', 'Due from shareholder', '13,211.58', ''], ['2010', 'Credit card payable', '', '856.13'], ['2050', 'HST payable (receivable)', '', '5,486.94']],
    caption: 'Account 1300, debit $13,211.58 (advances $27,000.00, repaid $12,000.00, business items $1,788.42).' },
  'qbo-hst': { title: 'QuickBooks Online HST report, Q4 2025 (test company)', head: ['Account', 'Name', 'Debit', 'Credit'], hl: 1, num: [2, 3],
    rows: [['2040', 'HST collected', '', '24,271.00'], ['2050', 'HST payable (receivable)', '', '5,486.94'], ['2060', 'HST paid on purchases', '18,784.06', '']],
    caption: 'Account 2050, credit $5,486.94 (Q4 paid on 30 Jan 2026).' },
  'qbo-pl': { title: 'QuickBooks Online profit and loss, 1 Jan to 31 Dec 2025', head: ['Line', 'Amount'], hl: 2, num: [1],
    rows: [['Total income', '186,700.00'], ['Total expenses', '29,709.50'], ['Net income', '156,990.50']],
    caption: 'Net income $156,990.50 after the adjusting entries.' },
  'qbo-6020': { title: 'QuickBooks Online trial balance, account 6020', head: ['Account', 'Name', 'Debit'], hl: 1, num: [2],
    rows: [['6020', 'Meals and entertainment', '1,941.65'], ['6020', 'Half, not deductible', '970.83'], ['6090', 'Office supplies', '6,124.16']],
    caption: 'Account 6020 holds $1,941.65; half is not deductible, $970.83.' },
  'onb-home': { title: 'Client app onboarding, home office answer', head: ['Question', 'Answer'], hl: 1, num: [],
    rows: [['Rent per month, paid personally', '$2,800.00'], ['Share of the home used for the business', '15%'], ['Lease available', 'Yes']],
    caption: 'Owner pays the rent personally; share used for the business 15%; a person decides the claim.' },
  'onb-div': { title: 'Client app onboarding, dividend list', head: ['Date', 'Kind', 'Amount'], hl: 0, num: [2],
    rows: [['20 Dec 2025', 'Other than eligible', '$20,000.00']],
    caption: 'The only dividend the client listed. Matches statement line 01-CHQ-2025-12-0031.' },
  'qbo-gfi': { title: 'GIFI mapping from QuickBooks Online (.GFI file uploaded 1 Oct 2026, 09:20)', head: ['Account', 'Name', 'GIFI code', 'Last year'], hl: 0, num: [],
    rows: [['2010', 'Credit card payable', '2707', '2620'], ['1010', 'Chequing (CAD)', '1002', '1002'], ['1300', 'Due from shareholder', '1301', '1301']],
    caption: 'Account 2010 is mapped to 2707 in QBO; last year it was 2620.' },
  'gfi-6090': { title: 'GIFI mapping from QuickBooks Online (.GFI file uploaded 1 Oct 2026, 09:20)', head: ['Account', 'Name', 'GIFI code', 'Last year'], hl: 0, num: [],
    rows: [['6090', 'Office supplies', '8811', '8811'], ['6090', 'Office supplies (sub-account)', '8810', ''], ['6170', 'Travel', '9200', '9200']],
    caption: 'Account 6090 appears twice in the mapping: 8811 and 8810.' },
  'gfi-1500': { title: 'GIFI mapping from QuickBooks Online (.GFI file uploaded 1 Oct 2026, 09:20)', head: ['Account', 'Name', 'GIFI code', 'Last year'], hl: 0, num: [],
    rows: [['1500', 'Computer equipment', '2008', ''], ['1300', 'Due from shareholder', '1301', '1301'], ['2050', 'HST payable (receivable)', '2680', '2680']],
    caption: 'Code 2008 is a total CRA calculates (total tangible capital assets). Amounts go on component codes (RC4088).' },
  'gfi-6300': { title: 'GIFI mapping from QuickBooks Online (.GFI file uploaded 1 Oct 2026, 09:20)', head: ['Account', 'Name', 'GIFI code', 'Last year'], hl: 0, num: [],
    rows: [['6300', 'Software subscriptions', '(none)', ''], ['6170', 'Travel', '9200', '9200'], ['4010', 'Sales', '8000', '8000']],
    caption: 'Account 6300 has no GIFI code in the file.' },
  'lock-meals': { title: 'Lock export from Taxprep, 1 Oct 2026, 10:41', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 1, num: [1, 2],
    rows: [['S1.NI.BOOKS', '156,990.50', '156,990.50', 'Traced'], ['S1.ADD.MEALS', '970.83', '(not imported)', 'Orphan'], ['S1.ADD.AMORT', '0.00', '0.00', 'Traced']],
    caption: 'S1.ADD.MEALS holds $970.83 and was never imported. QBO account 6020 holds the exact value as half of $1,941.65.' },
  'lock-rent': { title: 'Lock export from Taxprep, 1 Oct 2026, 10:41', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 1, num: [1, 2],
    rows: [['S8.RENT.TOTAL', '33,600.00', '33,600.00', 'Traced'], ['S8.RENT.HOME', '5,040.00', '(not imported)', 'Orphan'], ['S8.CCA.CLAIM', '0.00', '0.00', 'Traced']],
    caption: 'S8.RENT.HOME holds $5,040.00 (a tax choice: the home office claim). It was typed in Taxprep.' },
  'lock-desig': { title: 'Lock export from Taxprep, 1 Oct 2026, 10:41', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 1, num: [],
    rows: [['S3.DIV.PAID[1].AMT', '25,000.00', '20,000.00', 'Overridden'], ['S3.DIV.PAID[1].DESIG', 'Other than eligible', '(not imported)', 'Orphan'], ['S3.DIV.PAID[1].DATE', '20 Dec 2025', '20 Dec 2025', 'Traced']],
    caption: 'The dividend designation was typed in Taxprep. The onboarding dividend list says other than eligible.' },
  'lock-bl': { title: 'Lock export from Taxprep, 1 Oct 2026, 10:41', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 1, num: [],
    rows: [['S23.ASSOC.COUNT', '0', '0', 'Traced'], ['S23.BL.SHARE', '100%', '(not imported)', 'Orphan'], ['S23.BL.LIMIT', '500,000.00', '(calculated)', 'Calculated']],
    caption: 'The business limit share was typed in Taxprep. Onboarding lists no associated corporations.' },
  'lock-amt': { title: 'Lock export from Taxprep, 1 Oct 2026, 10:41', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 0, num: [1, 2],
    rows: [['S3.DIV.PAID[1].AMT', '25,000.00', '20,000.00', 'Overridden'], ['S3.DIV.PAID[1].DATE', '20 Dec 2025', '20 Dec 2025', 'Traced']],
    caption: 'Imported $20,000.00, now $25,000.00 in Taxprep. The bank statement shows one transfer of $20,000.00.' },
  'lock-drop': { title: 'Lock export from Taxprep, 1 Oct 2026, 10:41', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 1, num: [1, 2],
    rows: [['S4.LOAN.SH[1].DATE', '31 Dec 2025', '31 Dec 2025', 'Traced'], ['S4.LOAN.SH[1].AMT', '(blank)', '13,211.58', 'Dropped'], ['S4.LOAN.SH[1].REPAY', '31 Dec 2026', '31 Dec 2026', 'Traced']],
    caption: 'Imported $13,211.58, blank in the lock export. Re-import it or explain why it is blank.' },
  'lock-int': { title: 'Lock export from Taxprep (after the CPA comments), 1 Oct 2026, 15:20', head: ['Cell', 'Value', 'Imported', 'Class'], hl: 0, num: [1, 2],
    rows: [['S4.LOAN.INT', '412.00', '(not imported)', 'Orphan'], ['S4.LOAN.SH[1].AMT', '13,211.58', '13,211.58', 'Traced']],
    caption: 'Interest on the shareholder loan, $412.00, typed in Taxprep after the CPA asked for it.' },
  'printed-d': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 0, num: [],
    rows: [['(selected diagnostic)', '', '']], caption: 'The printed return lists each diagnostic with its iFirm category.' },
  'p-F301': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 0, num: [],
    rows: [['F301', 'Filing error', 'Transmitter number is blank'], ['D118', 'Warning', 'Loan to shareholder outstanding at year end'], ['D207', 'Warning', 'Business limit not allocated']], caption: 'F301 is a Filing error: it blocks sign-off and cannot be overridden.' },
  'p-D118': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 1, num: [],
    rows: [['F301', 'Filing error', 'Transmitter number is blank'], ['D118', 'Warning', 'Loan to shareholder outstanding at year end: check Schedule 4 and Part 1 interest'], ['D207', 'Warning', 'Business limit not allocated']], caption: 'D118 is a Warning: a named preparer writes a reason and the CPA sees it in the brief.' },
  'p-D207': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 2, num: [],
    rows: [['F301', 'Filing error', 'Transmitter number is blank'], ['D118', 'Warning', 'Loan to shareholder outstanding at year end'], ['D207', 'Warning', 'Business limit not allocated between associated corporations']], caption: 'D207 is a Warning: a named preparer writes a reason.' },
  'p-D044': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 0, num: [],
    rows: [['D044', 'Information', 'Prior-year return not attached'], ['D090', 'Filing warning', 'Preparer name differs from the e-file profile'], ['D212', 'Hidden', 'Hidden in Taxprep']], caption: 'D044 is Information: it may stay with a logged reason.' },
  'p-D090': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 1, num: [],
    rows: [['D044', 'Information', 'Prior-year return not attached'], ['D090', 'Filing warning', 'Preparer name differs from the e-file profile'], ['D212', 'Hidden', 'Hidden in Taxprep']], caption: 'D090 is a Filing warning: it may stay with a logged reason.' },
  'p-D212': { title: 'Printed return, diagnostics page (1 Oct 2026, 10:44)', head: ['Id', 'Category', 'Message'], hl: 2, num: [],
    rows: [['D044', 'Information', 'Prior-year return not attached'], ['D090', 'Filing warning', 'Preparer name differs from the e-file profile'], ['D212', 'Hidden', 'Hidden in Taxprep (the printed return does not say what it is about)']], caption: 'A Hidden diagnostic never counts as cleared.' },
  'ex-psb': { title: 'QuickBooks Online sales by customer, 2025', head: ['Customer', 'Sales'], hl: 0, num: [1],
    rows: [['Northwind Logistics Inc. (Test)', '168,000.00'], ['Three other clients', '18,700.00'], ['Total', '186,700.00']], caption: 'Northwind is about 90% of revenue.' },
  'ex-loan': { title: 'QuickBooks Online trial balance, 31 Dec 2025 (test company)', head: ['Account', 'Name', 'Debit'], hl: 0, num: [2],
    rows: [['1300', 'Due from shareholder', '13,211.58']], caption: 'Repay by 31 Dec 2026 or the amount is added to income.' },
  'ex-hst': { title: 'QuickBooks Online HST report, Q4 2025 (test company)', head: ['Account', 'Name', 'Credit'], hl: 0, num: [2],
    rows: [['2050', 'HST payable (receivable)', '5,486.94']], caption: 'Q4 paid on 30 Jan 2026, so payable on 31 Dec 2025.' },
  'search-qbo': { title: 'QuickBooks Online trial balance, account 6020', head: ['Account', 'Name', 'Debit'], hl: 0, num: [2],
    rows: [['6020', 'Meals and entertainment', '1,941.65']], caption: 'Account 6020, debit $1,941.65.' }
};
window.ASH_RENDER = function (key) {
  var s = window.ASH_SOURCES[key];
  if (!s) { return ''; }
  var h = '<table class="govuk-table"><caption class="govuk-visually-hidden">Excerpt of ' + s.title + '</caption><thead class="govuk-table__head"><tr class="govuk-table__row">';
  s.head.forEach(function (c, i) { h += '<th scope="col" class="govuk-table__header' + (s.num.indexOf(i) >= 0 ? ' app-numeric' : '') + '">' + c + '</th>'; });
  h += '</tr></thead><tbody class="govuk-table__body">';
  s.rows.forEach(function (r, ri) {
    h += '<tr class="govuk-table__row' + (ri === s.hl ? ' app-hl' : '') + '"' + (ri === s.hl ? ' data-hl="1"' : '') + '>';
    r.forEach(function (c, i) {
      var cls = 'govuk-table__cell' + (s.num.indexOf(i) >= 0 ? ' app-numeric' : '');
      if (i === 0) { h += '<th scope="row" class="govuk-table__header">' + c + (ri === s.hl ? ' <span class="govuk-visually-hidden">(highlighted: the source of this figure)</span>' : '') + '</th>'; } else { h += '<td class="' + cls + '">' + c + '</td>'; }
    });
    h += '</tr>';
  });
  return h + '</tbody></table>';
};
