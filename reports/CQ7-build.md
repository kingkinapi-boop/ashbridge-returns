# CQ7 build (local-1, 3 Oct)

- Branch claude/CQ7, on main 0cd2dea2 (merged). Build commit: "CQ7: update and beat write on the tip they read".
- Files changed: tools/claim.mjs only (update and beat read the tip once as `decidedTip` and pass it to `writeClaims`, as CQ5's `next` does; the check-FAIL write of the held build goes in the same guarded write). Nothing else.
- Acceptance tests: tools/test/claim-race-update.test.mjs 5 of 5 pass (spec commit f62e90f, unedited).
- tools/test: 383 of 385 in the full run; the 2 failures are SC R31 and R34 timing out under full-suite load on this laptop (known); schema-contract-rules alone passes 87 of 87.
- typecheck clean; lint clean; deps:check no violations (200 modules); scope OK (4 files, all inside the card's paths). Not core: no mutation run.
- Ambers: none.
- Could not do: the full suite runs in the cloud, not on this laptop.
