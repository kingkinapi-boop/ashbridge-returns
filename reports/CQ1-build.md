# CQ1 build report (cloud-7f8978, 2 Oct 2026)

Branch claude/CQ1, head 9177b9b (spec 69eefb4, main merged in). Files: tools/claim.mjs, tools/next.mjs, tools/status.mjs.
- claim tests + status tests: 18 of 18 pass (tools/test: 194 of 194). typecheck, lint, deps:check clean; scope OK (3 files).
- Full suite: 1437 of 1438; the one fail is the cold-tool timeout in src/core/egress-rules.acceptance.test.ts (SEC-5 ESLint, 5.1 s against the 5 s default), which FX1 fixes. Not CQ1.
- Dry run `node tools/next.mjs 12` on main: no done card and no design-lane card (no card carries `lane` yet).
- Rules: (1) buildPassed(): check reported PASS and the build not reopened blocks a build and a spec refit; (2) a release with a `wait:` note stores a snapshot key (status, deps, dep statuses) and is held until it changes; `list` tags it "(waiting)", next.mjs prints "waiting (released with wait:)"; (3) `lane: "design"` gets no spec or build; (4) status.mjs reads "Version vX" from blueprint/README.md ("?" if absent).

Amber: the wait key lives in claim.mjs, not lib.mjs (lib.mjs is outside the card paths). Reverse: move waitKey into lib.mjs.
Not done (outside paths): the worker orders (.claude/agents/worker.md step 4 and plan/cards) should now say "release with `wait:` when a card must not start"; the Lead adds the line.

## Permission gaps
None.

## Model
Sonnet 5.5.
