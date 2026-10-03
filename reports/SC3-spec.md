# SC3 spec report (cloud-0303ff, 3 Oct)

Spec commit 155938f2 on claude/SC3, validated on main 31defba1 (typecheck, lint, unit project 2505 pass; db file 11 pass, 3 fail by design).
Tests: tools/test/security-rules.test.mjs (8, unit: R62 file side and KNOWN helper) and src/contracts/security-rules.db.test.ts (14: R62 auth, tag registries, R63 to R66), plus fixtures in tools/test/__fixtures__/security-rules/.
Clauses: SEC-11, ARC-6, ARC-20, FLOW-1, ARC-15. Each rule has a planted fault caught and a clean twin that passes.
Fail until built (right reason, tags absent): the R63, R64 and R65 tag-equals-registry tests. Build adds three JSDoc tags to auth/testusers/engine.ts (card directive).
Step 6b retired tests: none. Core: no (card not core), so the spec was done on Sonnet.

## Amber
- R62 KNOWN, owner FX2: OCR_ENGINE, STORAGE_DRIVE_ENGINE, STORAGE_FILES_ENGINE are undeclared in env.ts and accept production silence. Remove with FX2.
- R66: a single-column primary key counts as keyed; 15 free-text columns are on a reviewed list with reasons (actor, approved_by, record_table are candidates for a key or list in V00 and later cards).
- Tags use a name line (`@once finishSignIn`) because the auth functions are methods, not exports.
Permission gaps: none. Model: Sonnet 5.5.
