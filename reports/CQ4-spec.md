# CQ4 spec patch (round 2, A430)
- 7 tests added to tools/test/scope-spec-files.test.mjs (14 total, the 7 old unchanged): Spec prose naming build code files (bare and backticked) not flagged while verify.mjs still is; hand-resolved merge in a spec-touched file not named in Spec fails; card read from base ref; --branch <name> (default unchanged); reports/** and plan/** commits never flagged; "note: superseded by <sha>" without failing; build commit after last spec commit still fails.
- 6 fail by name for the right reason (false flag on src/f/a.ts, missing checks, --branch unknown); 8 pass. Not covered here: the real FX8 plant at 005070e8 (fixture stand-in used), SC10 rule tests (separate card).
- validated on main 25fc96d: typecheck and lint clean. Step 6b: none retired (R19 tests in done-gate and scope tests untouched).
- Amber: CLI form is `scope.mjs <card> --branch <name>`; superseded note prints the 7-char sha.
## Permission gaps
none
## Model
Sonnet 5.5 (queue tooling card, not core)
