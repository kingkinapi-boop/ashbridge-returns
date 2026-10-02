# F04 build (cloud-3d81d3)
Branch claude/F04, files: src/contracts/ai.ts, src/contracts/ai.test.ts (own unit tests), this report.
Acceptance: 48 of 48 in ai.acceptance.test.ts pass, spec untouched. Full suite: 750 unit + 2 db pass.
typecheck, lint, deps:check clean; scope OK; mutate:changed F04 score 85.58 (break 70).
Amber: step-answer fields beyond the spec (extraction fields, category, gifiCode, slot/value, tag, concern) chosen minimal; reversible, later cards may extend. "I can't tell" requires an empty citations array (max 0).
Needed on build env: Node 24 via /opt/nvm (nvm install 24; system node is 22).
Permission gaps: none. Model: Sonnet 5.5.
