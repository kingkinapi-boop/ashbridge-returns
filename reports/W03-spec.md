# W03 spec report (cloud-256aec)

- 32 tests in testworld/kinds/K03/kind.acceptance.test.ts: kind registered/built, W00 model loads, 261-day short year, line 410 = 35,753,425 cents, FLOW-7 due dates (30 Jun 2026 filing, 31 Mar 2026 balance due), no prior year, year end unconfirmed (END-1), figures tie to adjusted TB, origins/dots (EV-10/11), faults catalogue entries, planted-fault checks through `checkKind`.
- Clauses: ARC-8, CK-19, FLOW-7 (plus END-1, EV-10, EV-11, END-9).
- Validated on main 80d4ff0 (merged into claude/W00 base, since W00 is built but not yet merged): typecheck green; lint and the whole testworld and tools/test suites green with an empty type-only stub, only the 32 K03 tests failing (stub removed, not committed). Not run: full `npm test` and db project.
- Step 6b: no other test retired (stub sweep over testworld/ and tools/test only).
- Base: branch is from origin/claude/W00 (f905b7e) plus main; the builder must rebase onto main once W00 lands.
- Amber: the K03 API (kind.ts `kind`, `checkKind`, faults.ts, registration of K03 faults in testworld/model/faults.ts via `faults()`) is fixed in the test header; W01/W02 specs may choose a different shape, align at W00 merge. figures use cents = debit minus credit per GIFI code.
- Permission gaps: none. Model: Sonnet 5.5 (card not core).
