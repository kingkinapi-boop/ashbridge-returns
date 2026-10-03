# SC3 spec review, patch A452 (Opus, 3 Oct)

Read: plan/cards/SC3.md (main, A452 directive), reports/SC3-findings.md, SC3-security.md, SC3-spec.md, the patch d69c50b1 (harness.ts, both test files, 10 new fixtures), db/schema/, the T08, E00, L00, B05 and FX17 cards on main. Static read; no npm.

**Verdict: GAPS (6).** All 10 findings items are in and tested as classes (behaviour for append-only, per-column checks, types through domains and arrays, every `_ENGINE` token, an inventory of every exported `create*`). Each plant fails on the old rule for its stated reason (blank_only and not_format were already caught by the old rule; they stay as guards on the new format-function path). Nothing is weakened (A329): the "waits on V00" lines left FREE_TEXT for owner-checked KNOWN entries, and no rule lost a case. The rule logic sits in the spec-owned harness, so no build can satisfy a test without the rule.

## Ambers
- CHECK vouching only through operand or format-function argument, even single-column: sound (stricter than the findings; main stays green).
- LIKE not counting, format functions by call (pinned list, sources checked): sound.
- Append-only needing the guard pair: sound, but the ROW bit opens G1.
- harness.ts in the fixtures folder: sound (`__fixtures__` keeps it out of the product scans), but owners now hold it in their Paths, which opens G5.

## Gaps, each with the test to add (spec only)
1. **G1 statement-level DELETE guard escapes R66 (item 1 class).** `appendOnlyTables` needs ROW on the DELETE trigger, and the sentinel only sees functions whose text says "append-only". Plant planted-r66-statement-guard.sql: `planted_stmt (id text primary key, author text)`, function `planted_forbid()` raising 'records are permanent', `before delete or truncate ... for each statement`. Expect `appendOnlyTables` to hold planted_stmt and `freeText` to give `['planted_stmt.author']`. Add a unit twin with tgtype BEFORE|DELETE|TRUNCATE and no ROW. Fix: test (BEFORE|DELETE) whether or not ROW is set. Main is unchanged: it has no statement-level DELETE triggers.
2. **G2 a positive non-blank regex vouches (item 2 class).** `x ~ '\S'`, `x ~ '.'` and `x ~ '^.+$'` pass `checkVouches`. Twin: each of those returns false, while main's four inline matches (client_ref, token_hash, jobs.kind, the handoff pattern) still return true. Add a `nonblank_match` column with `check (nonblank_match ~ '\S')` to planted-r66-checks.sql, expected in the list. Rule: a `~` match counts only if its literal is anchored `^...$` and has no `.` outside brackets followed by `*`, `+` or `{n,}`.
3. **G3 LANDING is not tied to its card.** If T08 or E00 renamed its folder, the entry would stay silent forever. Add a test that each LANDING dir matches a Paths glob of its card (`pathMatches(glob, dir + '/x.ts')`). Plant `{card:'T08', dir:'src/modules/approvals'}` against T08's Paths: caught.
4. **G4 an arrow-declared stand-in skips the @standin check.** `takesDb` reads only `function name(`. Plant `export const createPlantedStandIn = (opts: PlantedOptions) => ...`, untagged: expect "takes a database but carries no @standin tag".
5. **G5 a second reader of a registered setting is never tested.** `src/app/x.ts` doing `env.OCR_ENGINE ?? 'recorded'` passes, because OCR_ENGINE has a factory. Add a rule that every `*_ENGINE` token outside env.ts and NOT_SETTINGS sits in its factory's file (FACTORIES[].file). Plant that line: caught. Main passes (grep: each setting is read only in its factory's index.ts).
6. **G6 owners cannot land, and they can loosen the lists.** The byOwner test (security-rules.test.mjs, outside the Paths of L00, B05 and FX17) uses exact equality, so it fails as soon as an owner deletes its KNOWN entries as its card says. Meanwhile harness.ts, which the owners can edit, holds unpinned FREE_TEXT and NOT_ADAPTER lists. Fix:
   - byOwner becomes "each owner's columns are a subset of its pinned A452 list, and no other owner appears".
   - Pin the FREE_TEXT keys, the INVENTORY.notAdapter keys and LANDING exactly in the test file.
   - Twins: removing L00's entry passes; moving facts.fact_key to FREE_TEXT fails.

## The three FREE_TEXT keeps: own them (part of G6's pin)
Their own reasons describe a format or a fixed list, and item 4 keeps only free-by-nature columns. Proposed owners:
- approvals.fingerprint: KNOWN owner **T08** (60_versions.sql is in its Paths; format `^[0-9a-f]{64}$`, as token_hash has). Add harness.ts to T08's Paths.
- events.record_table: KNOWN owner **L00** (a list of record tables).
- sign_in_events.reason: KNOWN owner **FX17** through its fix file (an `= ANY` list of the engine's sentences). This widens FX17 by one column: amber.

The Lead may instead keep them free as an amber.

## Build
None. The patch touches only spec-owned files, and every gap above is harness, test or fixture work. The round 2 build (three strict JSDoc tags in engine.ts; grep shows no other @once, @limit or @standin mention in src) stands. Next steps:
1. A spec patch for G1 to G6.
2. Card lines on T08, L00 and FX17.
3. An Opus re-check (delete one KNOWN entry: it must fail as stale), then `/security-review`.
