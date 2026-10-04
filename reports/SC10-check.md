# SC10 check (round 2, landing form): PASS

Worker cloud-2cc0af. Checked claude/SC10 merged with origin/main (6c10c28), SC10 set done in plan/slices.json (not committed). Node 24.21.0.

- typecheck, lint, deps:check: clean.
- tools/test (all 26 files): 539 of 539 pass; card-rules 78 of 78.
- src/contracts/schema-rules.db.test.ts (db project, PGlite): 23 of 23.
- scope.mjs SC10: OK, 18 files inside Paths. KNOWN is empty. R89 list = the 17 guards of MOVES; each owner is an open card with the list file in Paths.
- Opus adversarial read (A496): PASS; 20 mutants over P2 to P7, each killed by a named test.

Non-blocking notes (fix forward before src/pipeline/deps.ts exists): codeOnly (card-rules.test.mjs:309-342) ignores regex literals, so a quote in one can hide createLifecycle; objectOf (:377-380) takes the first same-named const in any scope; nested type arguments in createLifecycle<...>( fail loudly although the header allows them; a guards option in a second argument is ignored; knownShape's subject test (:533) is a substring match ("V1" matches "V10").

Permission gaps: none. Model: Sonnet 5.5 checker; Opus 5.5 subagent for the read.
