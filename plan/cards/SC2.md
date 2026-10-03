# SC2 Test-world rules R57 to R61

**Lead directive, 3 Oct 09:28Z (A450): spec patch.** The 75-test spec is kept; add the rules under "Also (A450)" at the bottom (R98 to R100, R102, R103) and reword R75. R76 KNOWN owner W00b confirmed.

Phase 0. Size S. Deps: W00c. Where: cloud.
Tags: core (the answer keys every later kind is checked against).
Paths: tools/test/testworld-rules.test.mjs, tools/test/__fixtures__/testworld-rules/**
Clauses: ARC-8, ARC-13, ARC-16
Read: `reports/W00a-findings.md` ("Tests to add", rule tests), `reports/W00c-findings.md` ("Rule tests for SC2": R57, R59, R60, R61 reworded there win over older wording), `plan/cards/SC.md` (rule style, R52), `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
The causes behind three W00 failures, made rules that run on every answer key, kind and loader, so a later kind cannot bring them back.

## Spec
Each rule first shown failing on a planted copy of today's C10, C01 or C07 (fixtures under tools/test/__fixtures__/testworld-rules/), then passing on main:
- **R57** every marker field in any answer key or kind is pinned: a one-cent change or an extra marked row is refused (R52 gains "no vacuous proof").
- **R58** every id-keyed collection refuses duplicates; every lookup by a data key refuses Object.prototype names.
- **R59** each per-record check also runs when the record's list is empty.
- **R60** every date field is a calendar date; every file field matches its folder and extension.
- **R61** every loader turns a directory, a missing file or malformed JSON into a LoadIssue, never a raw error.

## Build
None beyond the rules: the rules are the deliverable (a spec writer writes them, a builder makes any planted-fixture harness pass, a checker runs them on main after W00c).

## Check
A checker who did neither: the five rules fail on the planted copies and pass on main.

## Added 3 Oct (A403, from reports/W00c-findings.md)
- **R75** every written derived value in a test-world file equals its computed twin (a statement's `rolls`, an account's `rowsInExport`). Planted: C10 with `rolls` edited.
- **R76** a posting with neither `dr` nor `cr` (or both) is refused, never read as 0. Planted: a C12 posting with both missing.
- Known limit, not a rule yet: an unmarked +1/-1 cent pair in one month keeps every total; only the bank CSV rows could pin it, and no card reads those layouts yet. Revisit when one does.

## KNOWN shape (3 Oct, A407)
Every KNOWN entry names one rule, one file, the exact problem strings (no regex) and an open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan asserts it read at least one file and a named sentinel.

## Also (A450, reports/W00c-findings-3.md)
Each first failing on a planted copy of C10, C12 or C14:
- **R98** every testworld/** loader schema is strict at every depth and every JSON leaf is read or declared carried (R73 extended to testworld; plant `dup_of` in C10).
- **R99** every date-shaped leaf of every folder is a calendar date or month (plant 2023-02-29 in C14).
- **R100** every id-shaped leaf resolves within its client and agrees with the idRule.
- **R102** priorYear money is integer cents (ARC-13).
- **R103** one GIFI code per account across the three trial balances and the adjusting lines (TB-3).
- **R75 reworded:** compare `rowsInExport` with the account's transaction count, never CSV lines.
