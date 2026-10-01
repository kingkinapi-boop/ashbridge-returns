# Diagnostics list, Probe Co. (Test), T2 2025-12-31 (3 Oct run, 23 items: 10 General, 13 Filing)
Panel: status bar bottom right, diagnostics icon (count 23), opens a Diagnostics panel with tabs All / General / Filing / Custom / Reviewed. Columns: severity icon, Type (EFILE or General), Jurisdiction, Form, Diagnostic (text with code in brackets). Rows carry data-id = "<code>_<cell id>" (links to the cell). Severity icon aria-label: Error, Filing error, Warning, Informative (the aria-label for Information). Virtual list (about 6 rows in view).
Blocking: EFILE button is greyed out while Filing errors exist (inferred; not tried to e-file). Type EFILE = Filing error. Type General = Error / Warning / Informative.
Format: severity | code | cell id | type | form | text pattern
Filing error | N1 | - | EFILE | N/A | Certain errors detected by the federal bar codes diagnostics have not been corrected. Verify the 'Mandatory modification' federal diagnostics.
Filing error | R2000100 | IDENT.Ident160 | EFILE | ID | The type of corporation at the end of the taxation year has not been provided on line 040
Filing error | R2000032 | IDENT.Ident212 | EFILE | ID | Certification information incomplete at lines 950, 951, 954, 955, 956, 957
Filing error | N18 | IDENT.Ident212 | EFILE | ID | Corporation Internet Filing does not process returns without complete certification on lines 200950...
Filing error | R2000017 | IDENT.Ident240 | EFILE | ID | Yes/No at line 070 (first year of filing after incorporation) not answered
Filing error | R20003xx (code cut) | IDENT.Ident309 | EFILE | ID | Answered No at line 957 but no contact name and telephone provided
Filing error | (code cut) | IDENT.Ident422 | EFILE | ID | A NAICS code must be entered at main revenue-generating business activity
Filing error | R2000xxx | IDENT.Ident7 | EFILE | ID | Business number (line 001) not provided
Filing error | R2000xxx | IDENT.Ident8 | EFILE | ID | Province or territory where income earned (line 750) not indicated
Error | M5 | IDENT.Ident128 | General | ID | Incorporation date missing
Error | M42 | IDENT.Ident254 | General | ID | Breakdown of principal products or services not provided on line 284
Error | M318 | IDENT.Ident431 | General | ID | Prepared by a tax preparer for a fee: preparer information missing
Warning | E2099 | IDENT.Ident187 | General | ID | Value (BC) in the Province/State field of the contact information (invalid format)
Warning | E2105 | IDENT.Ident199 | General | ID | Same as E2099 for the second contact
Error | M417 | FDEDI.Ttwedi44 | General | T183 | Indicate whether T183 was electronically signed by the authorized signing officer
Filing error | R1000001 | GFGIB.Ttwgib31 | EFILE | S100 | Balance sheet information is missing
Filing error | R1000002 | GFGIB.Ttwgib31 | EFILE | S100 | Total assets does not equal total liabilities plus total shareholder equity
Error | G107 | GFGIB.Ttwgib31 | General | S100 | Item 2599 is required by the CRA. Verify if different from zero
Error | G109 | GFGIB.Ttwgib36 | General | S100 | Item 3499 is required by the CRA. Verify if different from zero
Filing error | R130 | GFBGII[1].GFGII.Ttwgii2 | EFILE | S125 | Describe the activity carried on only if multiple financial statements
Error | G123 | GFBGII[1].GFGII.Ttwgii18 | General | S125 | Item 9368 is required by the CRA. Verify if different from zero
Filing error | R1410102 | GFGHA.Ttwgha9 | EFILE | S141 | Corporation has not answered YES or NO at line 111
Informative | P71 | HSINT.Ttwint8 | General | INTEREST | T2 seems to be filed late (interest/penalty note)
Notes: code numbers for rows 5 to 8 were cut in the walker's reading (the pattern is R20000nn); the cell id is exact. Diagnostic codes: N = notice/net-file, R = filing rule, M = mandatory modification, G = GIFI required item, E = format, P = penalty/interest. Not the full list for other tax situations.
