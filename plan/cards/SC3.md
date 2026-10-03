# SC3 Security rules R62 to R66

<<<<<<< HEAD
=======
**Lead note, 3 Oct 11:15Z (A461): SC3 is not tagged core (its only product touch, tags in auth/testusers/engine.ts, would need `// @mutate` under SC's R18), but it keeps every core step: Opus spec review, Opus re-check, security review.**

**Lead directive, 3 Oct 10:35Z (A458): second spec patch, G1 to G6 from reports/SC3-spec-review.md (on claude/SC3); no build round; keep all 56 tests.** G1 a statement-level BEFORE DELETE guard counts as a guard (plant: a table guarded that way). G2 a positive non-blank match (`~ '\S'`, `'^.+$'`) is not a format (plants). G4 an arrow-function stand-in still needs @standin (plant). G3 tie the LANDING list to T08's and E00's Paths. G5 a second file reading a registered `_ENGINE` setting is caught (plant). G6 the owner-list test checks each KNOWN owner is an open card, not an exact list, so L00, B05 and FX17 can delete their entries; pin the free-text and not-an-adapter lists in the test file (outside the owners' Paths). The three FREE_TEXT keeps become owned KNOWN entries: approvals.fingerprint (T08), events.record_table (L00), sign_in_events.reason (FX17). Then an Opus re-check and a fresh security review.

>>>>>>> origin/main
**Lead directive, 3 Oct 09:45Z (A452; the A443 patch is done and is NOT this one): spec patch from reports/SC3-findings.md (on claude/SC3), its 10 items; the build needs nothing.** R66 finds append-only tables by what their triggers refuse (refuse_change and version_table_guard alike, plus a sentinel), checks each column on its own with a reviewed list of format functions, and widens the text types; FREE_TEXT splits from an owner-checked R66 KNOWN (owners confirmed on main: L00, B05, FX17); strict tag parsing; every `_ENGINE` token scanned (CSV_ENGINE a reviewed exception); every exported `create*` listed; the blank '' case; a LANDING list for T08 and E00; wider file walkers. Then a fresh security review. The card is now core as well as security.

Phase 0. Size M. Deps: A06, FX2. Where: cloud.
Tags: security; reviewed as core by directive (A461) (stand-ins in production, once-only and at-most-N rules, append-only text).
Paths: tools/test/security-rules.test.mjs, src/modules/auth/testusers/engine.ts, src/contracts/security-rules.db.test.ts, tools/test/__fixtures__/security-rules/**
Clauses: SEC-11, ARC-6, ARC-20, FLOW-1, ARC-15
Read: `reports/A06-findings.md` ("Rule tests for everywhere", risks), `reports/A06-security.md`, `plan/cards/SC.md` (rule style, R26 registry), `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

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
