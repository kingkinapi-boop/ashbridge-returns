# S00 check (cloud-d2cfdd, 2 Oct 2026)

FAIL (3 failures, 2 minor notes).

Passed: typecheck, lint, deps:check, npm test (34 files, 790 tests), scope clean (18 files), spec test file and goldens unchanged since 5f74392, mutation canary.

## Failures
1. Mutation could not run: `npm run mutate:changed -- S00` stops with "core file without @mutate (first 5 lines): src/modules/taxprep-sim/core/__fixtures__/harness.ts". The harness is a spec-commit file under core/. Either the tool should skip `__fixtures__`, or the spec should have named a path outside core/. Until then the card's 100 on every marked file is unverified here (the builder's report claims 100). Tool/card conflict for the Lead.
2. RT-3 / spec round 2 point 8 ("no invented descriptions"): `src/modules/taxprep-sim/core/release-list.ts:58` gives `IDENT.Ident492` the description "Creation flag" and `:60` gives `IFirm.ContactID` "Contact ID". The real export (`grep -h "Ident492\|IFirm.Contact" reference/taxprep/*/exports/*.csv`) has an empty description for both. `IDENT.Ident230` (line 49) says "Line 990 - Language of correspondence"; the export says "Line 990 - Indicate your language of correspondence of your choice.|`English|`Français". The goldens use the fixture list (`__fixtures__/harness.ts`), so no test catches this.
3. `src/modules/taxprep-sim/core/sim.ts:194`: the cells skipped on import (Ident120, Ident121, Ident311, Ident492) are a hand-typed list; the card says to use F03's `IGNORED_ON_IMPORT` (`src/contracts/taxprep.ts:21`). The two lists can drift.

Rule candidate: a simulator or writer takes every Taxprep cell list from `src/contracts/taxprep.ts`, never a local copy; and a descriptions rule test compares the default list against the day 2 export.

## Notes (read only, not failures)
- `sim.ts:90` `NEGATIVE = /^-[1-9]\d*$/` adds the apostrophe only to negative whole numbers. RT-3 says "every negative value", so a negative decimal (for example "-0.5" in a rate cell) is exported with none, while a text cell holding "-5" gets one.
- `sim.ts:101-118`: without an id source, GUIDs come from a built-in counter (deterministic); the card says the injected source. Make it required?

The Opus read found the rest correct (F03 parser and writer only, no clock or random reads, no token cell constant, header not read, clears, cents refusal, report, next copy and gap, `openReturn`).

## Permission gaps
None.

## Model
Worker Sonnet 5.5; adversarial read by an Opus subagent (read only; findings 2 and 3 confirmed by me against the files).
