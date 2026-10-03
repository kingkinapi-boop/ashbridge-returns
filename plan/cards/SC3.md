# SC3 Security rules R62 to R66

**BUILD DIRECTIVE (spec job, 3 Oct, cloud-0303ff):** the build adds three JSDoc tags to `src/modules/auth/testusers/engine.ts` (tag-only edit, no behaviour change; amber): `@standin createTestUsersAuth` on that factory, `@once finishSignIn` on `finishSignIn`, `@limit 5 startSignIn` on `startSignIn` (a name line each, as `src/contracts/security-rules.db.test.ts` documents). Later cards add their own tag and registry line. Three tests fail until then: the tag-equals-registry tests of R63, R64, R65. R66 treats a single-column primary key as keyed and lists 15 free-text columns with reasons in the test file (amber: `actor`, `approved_by`, `record_table` are candidates for a key or list in V00 and F-cards). R62 KNOWN entries (OCR, storage drive and files) owner FX2; remove them when FX2 lands.

Phase 0. Size M. Deps: A06, FX2. Where: cloud.
Tags: security (stand-ins in production, once-only and at-most-N rules, append-only text).
Paths: tools/test/security-rules.test.mjs, src/contracts/security-rules.db.test.ts, tools/test/__fixtures__/security-rules/**
Clauses: SEC-11, ARC-6, ARC-20, FLOW-1, ARC-15
Read: `reports/A06-findings.md` ("Rule tests for everywhere", risks), `reports/A06-security.md`, `plan/cards/SC.md` (rule style, R26 registry), `.claude/rules/testing.md`.
Spec commit: 155938f2 (refit, validated on main d19d4bc5)

## Goal
The three causes behind A06's security findings, made rules that run on every adapter, every once-only or limited export and every append-only table, so later cards (F06, F10, E00, E01, L00, N00, Q00, V00, GL1) cannot bring them back.

## Spec
Each rule first shown failing on its planted fixture, then passing on main:
- **R62** every `*_ENGINE` setting is declared in src/core/env.ts; with NODE_ENV=production and the setting unset, every adapter factory refuses naming it. Planted: a factory with `?? 'standin'`.
- **R63** every stand-in that writes rows refuses a database holding any `is_test = false` row in the tables it writes. Planted: a seeder run on a clone with one real row.
- **R64** every export tagged `@once` (JSDoc, a registry like R26) is called 8 times in parallel on one clone and at most one call succeeds. Planted: a read-then-insert with no unique index. First entry: A06 `finishSignIn`.
- **R65** every export tagged `@limit N` lets at most N of 2N parallel attempts through. Planted: a check-then-record counter. First entry: the A06 lock-out.
- **R66** every text column of a table with a `refuse_change` trigger has a foreign key, a CHECK list or format, or a line in a reviewed free-text list with its reason. Planted: an append-only `user_id text` with none.

## Check
A checker who did neither: the five rules fail on the planted fixtures and pass on main after A06 round 2 and FX2; a `/security-review` of the rule harness.

## KNOWN shape (3 Oct, A407)
Every KNOWN entry names one rule, one file, the exact problem strings (no regex) and an open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan asserts it read at least one file and a named sentinel.
