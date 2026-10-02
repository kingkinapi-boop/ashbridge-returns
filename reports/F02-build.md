# F02 build (cloud-bb208a, Sonnet, 2 Oct)
Branch claude/F02; head is the commit that adds this report. Based on the spec commit plus origin/main ccca7ec.
Files: src/contracts/lifecycle.ts; src/modules/lifecycle/{index,moves,dates,logic}.ts; unit tests logic.test.ts and contract.test.ts.
Acceptance: unit 25 of 25, db 77 of 77 (the spec's 102). Own unit tests: 11. Full suite: unit 1721 and db 427 passed (before the contract test moved; lifecycle unit rerun 36 of 36).
typecheck 0 errors; lint clean; deps:check clean; scope OK (12 files); mutate:changed F02 score 100 (dates, logic, moves, contracts/lifecycle).
## Ambers
- Stryker runs unit tests only, so db glue in index.ts cannot be scored: it carries `// @mutate` plus `// Stryker disable all: <reason>`, and every decision lives in logic.ts (scored 100). Reverse: drop the disable line if Stryker ever runs the db project.
- ChangedItemSchema is z.union, not discriminatedUnion: a mutant that breaks the module at load shows as "survived" in Stryker (no failing test, only "no tests").
- voidApproval works from approved, client_sign and ready_to_file; any other state refuses with a reason. No approval source or no current approval: refuses or voids nothing.
- setWaiting when already waiting, and clearWaiting when not, return ok:false.
- Hold expiry at exactly 4 hours counts as expired; a taken-again hold updates taken_at; an expired one is closed at its expiry time.
- Waiting flag rows: returns.events with record_table 'returns', to_value {"waitingOnClient": bool}.
## Could not do
Nothing. Tool gap for the Lead: mutation testing cannot reach db-only code (above).
## Permission gaps
None met.
## Model
claude-sonnet-5-5.
