# F03R build (round 2), worker cloud-5d8906

Branch claude/F03R. Files changed: src/contracts/taxprep.ts only.
Acceptance tests: 368 of 368 in src/contracts/taxprep*.test.ts pass (504 of 504 in src/contracts; full suite 789 of 789).
Numbers: typecheck clean, lint clean, deps:check no violations, scope OK, mutate:changed F03R 100.00 on taxprep.ts.

Changes: classifyValue refuses any `-'` prefix (check 6); formatValue re-reads every written value through classifyValue (formatKind holds the per-kind writing), which also refuses 1e21 and 1e300 rates (check 5, 7); ALWAYS_EXPORTED exported, built on IGNORED_ON_IMPORT plus Ident230, Ident451, ContactPartner, ContactID (check 8); `@writes parseTaxprepCsv` in the writer's JSDoc.

Amber: (1) no separate rate-size guard and no read-back text comparison: the read-back's fault check already refuses `1e+21`, and a text comparison was unreachable (Windows-1252 text and ASCII kinds always decode to what was given), so every mutant of them survived; reverse: add them with a test that reaches them. (2) Formatting checked with prettier --no-semi --single-quote --print-width 120 (not a repo dependency).
Env note: the cloud image has Node 22; I installed node@24 and npm@11 under the scratchpad to satisfy engines.
Permission gaps: none. Model: Sonnet 5.5 (build).
