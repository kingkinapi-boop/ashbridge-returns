# FX7 Rule defects in landed contracts and readers (found by SC)

Phase 0. Size M. Deps: SC, W00c, FX2. Where: cloud.
Tags: core (contracts every figure and citation passes through).
Paths: src/contracts/facts.ts, src/contracts/reading.ts, src/contracts/amount-grammar.ts, src/modules/ocr/textlayer/**, src/modules/storage/**, src/core/test-no-network.ts, .gitattributes, src/contracts/auth.ts, tools/test/__fixtures__/planted-interpolated-log.ts.txt
Clauses: EV-1, EV-5, ARC-10, ARC-15, SEC-11
Read: `reports/SC-findings.md` (fix list step 3: the FX7 entries), `plan/cards/SC.md`, `src/contracts/text.ts` (the one blank rule).
Spec commit: (spec-writer fills)

## Goal
SC lands with exact KNOWN entries whose files belong to cards already done (F09, F09A/B, A01, A05, E03): R23 facts.ts; R41 reading.ts, facts.ts, amount-grammar.ts; R37 CSV line endings (.gitattributes); R45 enum and cite keys; R38 the Node 24 setup check; R39 amountGroups; R49 reading.ts; R34 the A05 log plant; R54 the A01 MediaBox. This card fixes each at its source and deletes its KNOWN entry, so the rule then holds on main.

## Spec
None new: SC's rules are the tests. The spec job lists the FX7 entries from SC's KNOWN on main and confirms each fails for that reason only.

## Build
Fix each defect at its source; never weaken a rule or widen KNOWN (A329). A defect whose file belongs to an open card goes to that card instead (W00c owns the sample-client CSVs).

## Check
A checker who did neither: SC's rules green with no FX7 entry in KNOWN, `npm test`, an Opus read of the contract changes.
