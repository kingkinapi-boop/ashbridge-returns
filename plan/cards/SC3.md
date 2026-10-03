# SC3 Security rules R62 to R66

**Lead directive, 3 Oct 19:05Z (A511): spec item S4 before the Opus read.** SC3's round 3 spec (S1 to S3) reported; test:flake on pg16 then failed 4 of 5 on auth.acceptance.db's SEC-1 scrypt count: with isolate false, SC3's db file loads the auth module before that file's vi.mock runs, so the mock never applies. S4: SC3's db files load no product module at the top level that another db file mocks (import inside the test, then `vi.resetModules()` in afterAll), so module load order between files cannot change a mock. Gate: test:flake 5 of 5 with TEST_DB=pg16. Then the Lead marks the build reported; Opus read; security review.

**Lead directive, 3 Oct 17:17Z (A504): round 3 is a spec patch (S1 to S3, spec-owned files only; core reading: an Opus spec writer) that starts after train 2b's verdict; no build; then an Opus read and a security review (A496).** From SC3's findings review 1 of train 2's red (Opus; the report stays on the laptop, so these lines are the whole brief). Root causes: (1) closed lists are snapshots of main whose members come from cards that cannot edit them (the create* inventory predates A04's createAiRunner and createAiStepHandler; the db test predates FX12's budget); (2) R62 finds adapters by spelling, not by ARC-6's adapter table: createAiRunner starts on the recorded stand-in, switches engine by a call and never reads the go-live setting; (3) the R65 "serialised" twin holds no lock: PGlite runs one transaction at a time, while Postgres gives each transaction its own pooled connection (4 of 6 got through on pg16). Refit f0dde579 already fixed the db budget (each split test keeps its plant and its catch): keep it.
Spec patch (each new plant fails first):
- S1: merge origin/main (A04 is on it once train 2b lands; if A04 parks, drop this item). createAiStepHandler joins INVENTORY.notAdapter and PINNED_NOT_ADAPTER with the reason "the ai:<step> job handler over a runner it is given; chooses no engine". createAiRunner gets two KNOWN entries (rule R62-inventory, the exact "on no list" strings, files src/modules/ai/runner/runner.ts and src/modules/ai/index.ts, the fix in runner.ts), owner GL1: never NOT_ADAPTER (a silent pass, A329) and never A04. The KNOWN header's "R62 is empty since FX2" note says why it no longer is. knownPinProblems accepts exactly these two non-R66 entries; twins that fail: the same entry owned by A04C, and one naming createAiStepHandler. If S00 is on main first, its createSimulator (ARC-6's Taxprep stand-in) gets the same treatment: a KNOWN entry owned by GL1.
- S2: the R65 clean twin locks first, as A06's lockUser does: planted-r65-limit.sql gains `planted_limits (id text primary key)` with one row; the twin's transaction opens with `select ... for update`; its name says locked, not serialised. The planted twin is unchanged. It is a spec file, so this is spec work.
- S3: R64 and R65 each gain a planted twin "in a transaction, no lock (or no unique index)" in DB16's form (a barrier between read and write, `ON ? test : test.fails`, as in pg16.acceptance.db.test.ts:597-637): caught on pg16, a named blind spot on PGlite. One world each.
Build: none (engine.ts's tags stand; keep f0dde579).
R62's reach (card text, A504): R62 reaches every ARC-6 adapter row; an adapter switched by a call, or one with no factory yet, is a KNOWN entry owned by GL1.
Risks and re-test: S1's KNOWN allowance stays exact (the security review reads it). FX17's merge meets S1's lines beside its own deletions. Re-test: security-rules.test.mjs and db-budget.test.mjs (unit); security-rules.db.test.ts on PGlite and with TEST_DB=pg16; test:flake 5 of 5 with TEST_DB=pg16; CQ12's assertion floor (every SC3 test reaches an expect); delete one KNOWN line and see it fail as stale.

**Lead note, 3 Oct 11:15Z (A461): SC3 is not tagged core (its only product touch, tags in auth/testusers/engine.ts, would need `// @mutate` under SC's R18), but it keeps every core step: Opus spec review, Opus re-check, security review.**

**Lead directive, 3 Oct 10:35Z (A458): second spec patch, G1 to G6 from reports/SC3-spec-review.md (on claude/SC3); no build round; keep all 56 tests.** G1 a statement-level BEFORE DELETE guard counts as a guard (plant: a table guarded that way). G2 a positive non-blank match (`~ '\S'`, `'^.+$'`) is not a format (plants). G4 an arrow-function stand-in still needs @standin (plant). G3 tie the LANDING list to T08's and E00's Paths. G5 a second file reading a registered `_ENGINE` setting is caught (plant). G6 the owner-list test checks each KNOWN owner is an open card, not an exact list, so L00, B05 and FX17 can delete their entries; pin the free-text and not-an-adapter lists in the test file (outside the owners' Paths). The three FREE_TEXT keeps become owned KNOWN entries: approvals.fingerprint (T08), events.record_table (L00), sign_in_events.reason (FX17). Then an Opus re-check and a fresh security review.

**Lead directive, 3 Oct 09:45Z (A452; the A443 patch is done and is NOT this one): spec patch from reports/SC3-findings.md (on claude/SC3), its 10 items; the build needs nothing.** R66 finds append-only tables by what their triggers refuse (refuse_change and version_table_guard alike, plus a sentinel), checks each column on its own with a reviewed list of format functions, and widens the text types; FREE_TEXT splits from an owner-checked R66 KNOWN (owners confirmed on main: L00, B05, FX17); strict tag parsing; every `_ENGINE` token scanned (CSV_ENGINE a reviewed exception); every exported `create*` listed; the blank '' case; a LANDING list for T08 and E00; wider file walkers. Then a fresh security review. The card is now core as well as security.

Phase 0. Size M. Deps: A06, FX2. Where: cloud.
Tags: security (stand-ins in production, once-only and at-most-N rules, append-only text; an Opus check by directive, A461).
Paths: tools/test/security-rules.test.mjs, src/modules/auth/testusers/engine.ts, src/contracts/security-rules.db.test.ts, tools/test/__fixtures__/security-rules/**
Clauses: SEC-11, ARC-6, ARC-20, FLOW-1, ARC-15
Read: `reports/A06-findings.md` ("Rule tests for everywhere", risks), `reports/A06-security.md`, `plan/cards/SC.md` (rule style, R26 registry), `.claude/rules/testing.md`.
Spec commit: 3e27033a (round 3, A504 S1 to S3; validated on main b37a8e35)

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
