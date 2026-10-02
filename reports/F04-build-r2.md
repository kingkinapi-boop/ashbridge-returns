# F04 build round 2 (cloud-47e70d, 2 Oct 2026)
Branch claude/F04. Files: src/contracts/ai.ts, src/contracts/ai.test.ts. Spec file untouched.
Built: page citation kind (`source: 'page'`, documentId, page >= 1, strict), "missing" finding rule (no ledger record), page allowed only on a "missing" finding, stricter evidence union for every other step. Strict objects at every depth were already in place (F09B's strict BoxSchema).
Numbers: ai.acceptance 80 of 80 pass (was 22 failing); full suite 42 files, 1424 tests green; typecheck, lint, deps:check, scope clean; mutate:changed F04 100.00 on ai.ts.
Amber: seven `// Stryker disable` lines (ObjectLiteral/StringLiteral) on top-level schema constants: a mutant that breaks a schema at module load crashes the test file and the runner reports it survived, though the unit tests fail on it when run by hand. Also one on the zod issue `code`, which describe() never prints. Reverse: delete the comments and wrap the schemas in factories.
Rule candidate: Stryker marks load-time-crash mutants of top-level schemas as survived; a shared note or tool fix would save a disable comment per contract.
Permission gaps: none. Model: Sonnet 5.5.
