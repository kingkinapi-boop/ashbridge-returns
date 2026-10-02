# Cards from findings F01-F09 (2 Oct, card side only)

Branch claude/cards-findings-f01. Inputs: reports/findings-F01-F09.md. Changed: plan/cards F01, F09, SC (new), L00, E01, I00, V01, E00, F06, B05, T04, N00; plan/slices.json entries F01, F09, SC. `node tools/matrix.mjs --plan`: PLAN OK (plan/MATRIX.md unchanged). Nothing red.

## Proposed ambers (what; why; reverse)
1. F01 gains checks 13 to 19 as the report lists them; the findings review showed the twelve checks let TRUNCATE, blank members, loose pointers, tied ordering and in-place updates through; drop the seven checks from the card.
2. F01 deps gain F09 (card and slices) and F09 lands first; one Box shape needs F09's BoxSchema to exist before F01 rebuilds its source_box; remove F09 from F01's deps and let F01 keep its own box.
3. F01 Paths and slices paths gain src/contracts/records.acceptance.db.test.ts; the spec file already lives on claude/F01 and the round 2 spec edits it; remove the path.
4. F01 Clauses gain EV-14 and FLOW-4 (card and slices); checks 15 and 19 test the sheet, row and column pointer and version_no for the approval fingerprint; remove the two clauses and relabel checks 15 and 19.
5. F01 check 14 refuses entries with fewer than two lines (the report's amber); a one-line entry cannot be a balanced adjusting entry; drop that clause of check 14.
6. F01 check 16 refuses a return inserted in any state but intake (the report's amber); later states must come through events, so W00 and JH0 seed through events; drop that clause and let seeding insert any state.
7. F01 check 15 asks the QBO pointer for snapshot and account, with the transaction only where there is one; EV-5 reads "an account or transaction", and the report asks for the account; require the transaction too, or either one.
8. F01 Fix round 2 states it supersedes Fix round 1's "no content change", and the re-check waits for both the round 2 spec and build and adds a PGlite truncate-trigger check; the report's headline says not to re-check before the content fixes; delete the section.
9. F09 build gains maximal amount groups, the leading-zero rule, one-space text joins, whole-box validity and `// @mutate`, with checks 8 to 13 mapping to the report's (a) to (f); RC4 and RC5 let wrong matches and bad boxes through; revert the F09 card to Fix round 1.
10. F09 accepts "$-1,234.56", "-$1,234.56" and "$(1,234.56)" as negative (the report's amber); these are common bank and statement layouts; refuse them and say so in check 8.
11. F09 Clauses gain ARC-15 (card and slices) for check 13 (`// @mutate`, Stryker break 70); a check must be named by a clause; remove ARC-15 and drop check 13 to the Fix round only.
12. F09 Fix round 2 spec is folded into the lint refit if that has not started, else a second spec job, never the builder; the report allows either; always run a separate spec job.
13. New card SC "Schema and contract rules", phase 0, size M, core, deps F01 and F09, with R12 to R18 as checks 1 to 7 and a green-on-main check 8; the report asks for a card of its own so the faults cannot return in later tables; delete plan/cards/SC.md and its slices entry.
14. SC paths are tools/test/schema-contract-rules.test.mjs (unit project, file rules R15 list side, R16 to R18), src/contracts/schema-rules.db.test.ts (db project, catalog rules R12 to R15, because the db project only takes src/**/*.db.test.ts) and tools/test/__fixtures__/schema-contract/**; the brief said tools/test/** fixtures and rule test files, and the catalog rules need a database; move the db rules into tools/test once TH gives tools a db home.
15. SC's fixture folder overlaps TH's tools/test/__fixtures__/** path, so tools/next.mjs never runs the two at once; a narrow sub-folder is the smallest change and TH is small; give SC a fixture folder outside tools/test/__fixtures__.
16. SC Clauses SEC-7, EV-1, ARC-10, EV-5, EV-8, EV-10, FLOW-1, ARC-15; each rule protects one of them (R12 SEC-7 and EV-1, R13 EV-1 and FLOW-1, R14 ARC-10, R15 EV-8, EV-10 and FLOW-1, R16 FLOW-1, R17 EV-5, R18 ARC-15); trim to the clauses the Lead prefers.
17. SC: a rule failing on main is a defect added to the owning card, never fixed in SC; the CLAUDE.md rule "never patch what a later card rebuilds"; let SC fix small misses itself.
18. One Build line in L00, E01, I00, V01 naming F09's Box shape (BoxSchema in src/contracts/reading.ts), and one Build line in E00, E01, F06, B05, T04, I00, N00 saying version stamps are non-blank scalars (R14) and the spec names the stamp's fields; the report's risks list these cards; delete the added lines.
19. Notes on slices entries F01 and F09 point at Fix round 2 and the order (F09 first); the queue reader sees the hold without opening the card; remove the two notes.

## Red
None.
