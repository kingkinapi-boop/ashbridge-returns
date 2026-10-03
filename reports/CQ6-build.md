# CQ6 build round 2 (cloud-c6e634, 3 Oct 2026)
Branch claude/CQ6. Files: tools/test-homes.json (harness list names `src/core/db/vitest-setup.ts`, not the root file), tools/mutate-changed.mjs (setup-file exemption removed from the import rule; the list is the one source).
Acceptance: mutate-harness.test.mjs 14 of 14 pass; whole tools suite 19 files, 394 of 394 pass (Node 24.21).
typecheck clean; lint clean; deps:check no violations (205 modules); scope OK (6 files inside Paths). Not core: no mutation run; `mutate:changed -- CQ6` on the real tree: no targets, import gate passes.
Missing-test-homes.json reading kept (empty list, strictest). Family-card gate (A430) moved to CQ9, not built.
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
