
# W00 spec report (cloud-0a2392, 2 Oct)
Branch claude/W00, spec commit 59bb5ae (pushed 184dcd6). Refit of the existing spec: 223 tests in 4 files under testworld/, C01 to C15, clauses ARC-8, ARC-13, ARC-16, SEC-11, END-9. Validated on main 30986dd + claude/TH ccba63d. Fail for the right reason (missing modules); with a throwaway stub all pass. Retired tests: none.
Finding for the Lead: check 8 byte-identical regeneration cannot pass a plain compare: .gitattributes (`* text=auto eol=lf`) stores taxprep/import.csv as LF but make-csv.mjs writes CRLF (251 failures), and generate.mjs deletes taxprep/. Suggested: `reference/sample-clients/**/taxprep/*.csv -text` plus re-commit with CRLF (reference/ edit, straight to main).
Ambers: old spec API kept (decimalToCents/centsToDecimal, TestWorldLoadError, checkRegeneration({root})); K01, K05, K06, K13 start from 'new' per blueprint 00; fault catalogue covers all 15 folders.
Permission gaps: none. Model: spec by Opus 5.5 subagent.
