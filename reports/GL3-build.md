# GL3 build, round 4 close (A515)
Branch claude/GL3. Change: header lines only. index.ts `// @mutate`; db.ts and manifest.ts `// @mutate` plus the ruled `Stryker disable all` reasons.
Acceptance: unit 56 of 56, db 42 of 42 with TEST_DB=pg16 (Postgres 16 identity test ran, not skipped).
typecheck, lint, deps:check clean; scope OK GL3 (22 files in paths).
mutate:changed GL3: all files 100 (scan.ts 144 killed, 0 survived; db.ts and manifest.ts n/a, disabled).
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
