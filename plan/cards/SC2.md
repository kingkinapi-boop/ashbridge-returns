# SC2 Test-world rules R57 to R61

Phase 0. Size S. Deps: W00c. Where: cloud.
Tags: core (the answer keys every later kind is checked against).
Paths: tools/test/testworld-rules.test.mjs, tools/test/__fixtures__/testworld-rules/**
Clauses: ARC-8, ARC-13, ARC-16
Read: `reports/W00a-findings.md` ("Tests to add", rule tests), `plan/cards/SC.md` (rule style, R52), `.claude/rules/testing.md`.
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
