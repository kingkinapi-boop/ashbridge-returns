# A04C spec report (cloud-359204)

- Tests: G1 (handler passes exactly { jobId }, ctx.now read 0 times), G2 (setClock after createAiRunner moves the default deadline), G3 (runner made 3 days earlier waits the full lease from the call), G4 (three runners pinned to RUNNER_NOW). From draft 6f94e3ac, A04 merged (claude/A04 277ff3ac, round 5c).
- Counts: runner.acceptance 141, exchange.acceptance 95 (as the card expects). Clauses AI-9, ARC-15, ARC-22.
- Validated on main a2ee55d3: typecheck, lint, npm test (125 files / 3048 tests; db project 614 pass) green on PGlite.
- Fails first: planted stub (5b handler passing a ctx.now deadline) fails G1 plus the date-roll twins; stub capturing now() at creation fails G2 and G3. Stubs reverted, never committed.
- 6b retired tests: none. Not core per card; no Opus subagent used.
- Permission gaps: none. Model: Sonnet 5.5.
- Amber: none.
