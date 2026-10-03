# W00b spec refit: released (cloud-8a46bb, 3 Oct)

- The refit job (toolchain refit; old validated sha 3df2e9b) cannot start: claude/W00b is built on W00a code (509 commits ahead of main, 269 behind), not on W00c, which is still unlanded (build reported, check open).
- Merging origin/main into claude/W00b conflicts in 12 files: package-lock.json, src/contracts/reading.ts, src/contracts/taxprep.acceptance.test.ts (W00c/A-card paths) and plan/ files the Lead owns (MATRIX, NOW, TODO-ZO, mode, slices, train, cards A01, A06, T08). Resolving them is not a worker job and would guess at other cards' code.
- Re-offer after W00c lands: the Lead rebases the base (branch from main plus the 242 tests), then the refit is only a typecheck, lint, npm test run.
- Permission gaps: none. Model: Sonnet 5.5.
