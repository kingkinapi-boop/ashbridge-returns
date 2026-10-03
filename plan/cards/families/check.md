# Family: one check ({check})

Phase (the card's own, in plan/slices.json). Where: local or cloud; check: cloud (the mutation run on the check's rule).

Cards Q10 to Q47 (Q33 parked). Deps, paths and clauses: the card's entry in `plan/slices.json`. Read the clause {check} in blueprint 05, `src/contracts/checks.ts` (F05), `src/modules/checks/engine/` (Q00) and `reference/sources.md`.

## Goal
{check} runs on every return where its evidence exists, says "not checked: no evidence" where it does not, and never raises a false alarm on a clean test-world kind.

## Build
- `src/modules/checks/{kind}/` + the check folder: the check record (CK-1) with its source link, and its rule.
- Ties agree to the dollar (CK-3). Reconciliations list typed, sourced reconciling items and raise only the unexplained remainder (CK-4), using only the item types the CK-4 table allows for this check, from `src/modules/checks/reconciling/` (Q01; CK-48 to CK-50). Firm parameters (thresholds the research set) are data, never constants in the rule. Flags go to a person and are never passed or failed by code (CK-5).
- The dollar amount and estimated tax effect on anything raised (CK-6).
- Tax rules cite a CRA page or statute. If no source settles a point, build it as a flag and log amber.

## Acceptance checks
1. {check} is raised on every test-world kind that plants its fault, with the right amount.
2. It is not raised on any kind that does not plant it (no false alarms across all thirteen).
3. With the needed evidence missing, the result is "not checked: no evidence".
4. The check record carries a working source link.
5. A mutation test run on the check's rule leaves no surviving mutant (cloud).

## Not in this card
Screens. Other checks.
