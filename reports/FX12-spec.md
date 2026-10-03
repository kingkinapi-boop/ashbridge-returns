# FX12 spec (cloud-d98b06, 3 Oct)

- Spec commit afeebf8, validated on main 0e39bb0 (merged into claude/FX12, which sits on claude/FX10 for the split auth file). One file: tools/test/db-budget.test.mjs, 17 ARC-15 tests, 6 fail by design (worker setting; config still gives '50%' by CPU count), 11 pass (the planted-fixture scanner, KNOWN and the measured table).
- Setting (amber): DB_TEST_MACHINE (cloud|laptop, else cloud when CI is set, else laptop), pinned laptop 2 and cloud 4; DB_TEST_WORKERS overrides; bad values throw naming the setting. Tests load vitest.config.ts in a child with os.cpus() faked at 2, 4, 16. Reverse: change PINNED in the test and the config.
- One database per test: static TS-AST scan of every *.db.test.ts (helpers and loops counted, planted fixtures). KNOWN lists 5 multi-world tests (db ARC-4, bridge RT-5 and END-1, jobs ARC-5 and ARC-16), owner FX14. **Lead: card FX14 (split those 5 tests, and the RT-5 property test at 4506 ms); the rule test requires an owner id only, not that FX14 exists.**
- Measured table (10 slowest, this cloud box, 4 CPUs, 2 workers, 564 tests green, 210 s): only bridge RT-5 property (4506 ms of 6000) is over half; owner FX14. The check re-measures with test:flake.
- Step 6b: stub (config setting) passes all 17; tools 293 of 293, typecheck and lint clean; no test retired.
- Permission gaps: none. Model: Sonnet 5.5 (not core).
