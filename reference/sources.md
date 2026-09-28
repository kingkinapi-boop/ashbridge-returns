# Sources

Every tax rule in a check cites one of these, or another CRA or statute page (CK-1). A rule with no source is built as a flag, never as a pass or fail. Checked 28 Sep 2026.

## CCH iFirm Taxprep
- CSV syntax (header `[name|return id|language]`; columns identifier, this year, prior year; copies `FORM[n].CELL`; blank not imported; "0" imports zero; dates YYYY-MM-DD): https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_csv_syntax.htm
- Import a CSV file (Retrieve tab; separators chosen at import; a report lists modified cells and errors; T2 year-start and year-end cells ignored): https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_import_csv.htm
- Export data (a filter decides what is exported; separators and number formats are settings): https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_export_data.htm
- Custom filters: https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_create_filter.htm
- Corporate Taxprep export (one file per return option; Excel may misread custom separators): https://www.taxprep.com/assistance/T2/2025/v20/en-ca/Content/ImportExport/Export.htm
- Facts CCH confirmed to Zo by email or call are listed in blueprint RULE-2.

## CRA and statute
- GST/HST line 101, regular method (includes zero-rated and exempt supplies, excludes the tax; Telefile filers skip it): https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/instructions-preparing-return.html
- Quick method (line 101 includes the tax, excludes zero-rated and exempt supplies): https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4058/quick-method-accounting-gst-hst.html
- Small business deduction and passive income (AAII of tax years ending in the preceding calendar year; the greater of the passive and taxable-capital reductions): https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/federal-government-budgets/budget-2018-equality-growth-strong-middle-class/passive-investment-income/small-business-deduction-rules.html
- Ontario small business deduction (not reduced for passive income; reduced for taxable capital): https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/provincial-territorial-corporation-tax/ontario-provincial-corporation-tax/ontario-small-business-deduction.html
- Shareholder loans, Folio S3-F1-C1 (1.71 one-year repayment; 1.81 oldest first; 1.83 to 1.85 series of loans and repayments): https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/folio-1-shares-shareholders-security-transactions/income-tax-folio-s3-f1-c1-shareholder-loans-debts.html
- GIFI guide RC4088 (retained earnings 3660, 3680, 3700, 3720, 3740, 3849; 8523 meals and entertainment; 8670 amortization of tangible assets): https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4088/general-index-financial-information-gifi.html
- T183CORP (needed for every initial and amended e-filed T2; amounts must match the filed return; keep six years after filing): https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/corporation-internet-filing/t183corp-information-return-corporations-filing-electronically.html
- Balance-due day (two months; three for a CCPC that meets the conditions): https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-payments/paying-your-balance-corporation-tax/balance-day.html
- Income Tax Act section 125 (specified investment business: more than five full-time employees; short-year proration of the business limit): https://laws-lois.justice.gc.ca/eng/acts/i-3.3/section-125.html
- Ontario annual returns left the T2 in 2021 (now filed on the Ontario Business Registry): https://www.taxcycle.com/news/cra-no-longer-collecting-s546-s547-s548-and-rc232-for-ontario/

## Not yet checked here (check before building on them)
- T1135 threshold (foreign property cost over $100,000 at any time in the year).
- Section 78(4): unpaid remuneration deductible only if paid within 180 days after year end.
- The filing due date rule for year ends on the last day of a month.

## Claude Code (for the modes)
- Cloud sessions share the plan's limits: https://code.claude.com/docs/en/claude-code-on-the-web
- Routines draw on subscription usage: https://code.claude.com/docs/en/routines
- Statusline input fields: https://code.claude.com/docs/en/statusline
- Agent SDK and headless use with a Claude plan: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
