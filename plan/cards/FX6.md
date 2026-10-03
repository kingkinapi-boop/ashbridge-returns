# FX6 Taxprep rate text invents digits at huge values (found by SC4)

Phase 1. Size S. Deps: W00c, SC4, SC. Where: cloud.
Tags: core (Taxprep CSV figures).
Paths: src/contracts/taxprep.ts, src/contracts/taxprep.acceptance.test.ts, tools/test/reading-rules.test.mjs
Clauses: EV-5, ARC-10
Read: `reports/SC4-spec.md` (KNOWN, R69), `plan/cards/SC4.md` (R69), `src/contracts/taxprep.ts` (the rate text near `toFixed(4)`).
Spec commit: (spec-writer fills)

## Goal
SC4's R69 (every number-to-text is total over the doubles, no digits invented) fails on the Taxprep rate text: `toFixed(4)` invents digits from about 1e17 up (1.00000000001e20). SC4 lands with this in KNOWN, owner FX6. This card fixes it and deletes the KNOWN entry.

## Spec
None new: R69 is the test. The spec job removes the FX6 KNOWN entry and confirms R69 fails on main for this reason only.

## Build
The smaller option: a rate the schema accepts has a bounded range that a Taxprep rate can really take (refuse anything whose four-decimal text does not read back to the same value), or the text comes from the shared total formatter. Never weaken R69 (A329). W00c owns the file until it lands, hence the dep.

## Check
A checker who did neither: R69 green with no FX6 entry in KNOWN, F03's and F03R's tests unchanged and green, mutation 100 on the changed `@mutate` file.

## SC KNOWN entries (3 Oct, A407)
SC lands with exact KNOWN entries owned by this card (reports/SC-findings.md, fix list step 3). Each defect fixed here deletes its entry; never widen an entry or weaken a rule (A329).
