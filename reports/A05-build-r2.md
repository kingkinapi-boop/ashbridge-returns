# A05 build, fix round 2 (cloud-b1776c)
Branch claude/A05. Files: src/modules/storage/files/index.ts (checkParent before put and has; list skips keys whose folder resolves outside), drive/index.ts (readIndex uses realInside).
Acceptance: storage folder 42 of 42 pass; full suite 208 of 208. typecheck, lint, deps:check clean; scope OK (19 files in paths).
Amber: checkParent walks to the deepest existing folder before mkdir, so a linked prefix never gets a stray folder created outside the root. Reverse: call realInside after mkdir instead.
Not done: settings still read from options.env ?? process.env (A267). Permission gaps: none. Model: sonnet. Note: default node was 22; used /opt/nvm node 24.
