# F03R build (round 3), worker cloud-f135fc

Branch claude/F03R. Files changed: src/contracts/taxprep.ts only (round 3: B1, B2, B3).
Acceptance tests: 576 of 576 in src/contracts pass; full suite 878 unit + 2 db pass (no failures, including the Windows-1252 property test).
Numbers: typecheck clean, lint clean, deps:check clean, scope OK, mutate:changed F03R 100.00 on taxprep.ts.

Changes: B1 apostrophe condition in classifyValue (leading, `-'`, or an apostrophe inside a number-shaped value); keep rule unchanged. B2 ALWAYS_EXPORTED as eight explicit entries citing the export finding (item 9), no spread. B3 `readBackMatches` exported (@internal), formatValue refuses on false.

Amber: the read-back refusal in formatValue is unreachable (formatKind output always reads back equal), so its mutants carry `// Stryker disable next-line` comments with a reason; reverse: remove them if a writer path can ever produce a mismatch. Formatting checked with prettier --no-semi --single-quote --print-width 120.
Permission gaps: none (Node 24 via nvm install 24). Model: Sonnet 5.5 (build).
