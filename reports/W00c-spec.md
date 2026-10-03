# W00c spec report (round 2, with the review 3 patch)

Card: plan/cards/W00c.md (directives A403 and A413). Clauses: ARC-8, ARC-13, ARC-16, END-9, TB-3.
Round 2 spec commit: 82b19ae5 (its commit message is the round 2 report: RC1 to RC5 acceptance groups, the golden
catalogue with listed marker rows, and the 6b rewrites of checks-rolls, w00c-checks, w00c-survivors, w00c-load,
checks.test and faults.test). This file adds the review 3 patch (reports/W00c-spec-review-3.md, four gaps).
Spec patch commit: d89d7e8b. Validated on main 3e79eb12 (merged as 7f92a32a; the brief named 2288da55, and main moved by plan files only before the merge).

## The patch: what each gap now asserts (all walk-driven over the 15 sample folders, seeds pinned)

1. **RC3 out-of-year rows name the bound** (testworld/model/ranges.acceptance.test.ts). The day-before-start and
   day-after-end row tests now also require the yearStart or yearEnd date string in the issue; the adjusting-entry
   tests likewise. New class, every folder with accounts: fiscalYear.start moved one day later (fiscal_year_start and
   as_of moved to match) with an unmarked zero row on the old start, and fiscalYear.end moved one day earlier
   (financial_year_end to match) with a row on the old end: refused naming the row and the new bound. These dates stay
   inside a statement month, so only the year-range rule can catch them (all 28 fail today: they load).
2. **A client folder that is a link** (testworld/model/links.acceptance.test.ts). Every folder renamed to
   `linked-(Test)-<folder>` beside it, its own name a relative symlink to that: `clientFolders(root)` does not list it,
   lists the other 14 at their real paths, and `loadClient` of its id throws TestWorldLoadError with a 'file' issue
   naming the folder; with the link in place the other 14 still load. Linux only (symlinkSync).
3. **Repeated JSON keys at any depth.** New testworld/clients/json-keys.acceptance.test.ts drives the pure scanner,
   loaded by dynamic import from `testworld/clients/json-keys.ts` (inside Paths `testworld/clients/**`), as
   `repeatedKeys(text: string): readonly { key: string }[]` (more fields allowed; [] when none). It walks every
   object node of every onboarding.json, and in every answer-key.json one node per depth present plus 30 more
   (fast-check seed 20261003); each node is written with its first key twice, a same-type decoy first. Plus: clean
   sample files give []; equal keys in other objects and key-like text inside strings are not repeats; a `\u` escaped
   repeat is named decoded; a repeat inside nested arrays is found. testworld/model/json-keys.acceptance.test.ts adds
   the loader side: in every folder, both files, one node per depth (root included) gives a 'file' issue naming the
   file and the key. Today: "Cannot find module" and "should have been refused".
4. **Leap day by walk** (ranges.acceptance.test.ts). Folders whose year holds Feb 29 (the walk asserts C14 is among
   them) load with an unmarked zero row and the first adjusting entry dated that day; every folder whose year holds a
   non-leap February refuses its Feb 29 on the row and on the entry with a 'schema' issue naming the date field as
   not a calendar date. This group passes today (it restores strength lost in round 2; it is a regression guard).

Fixture helpers (testworld/model/__fixtures__/w00c-walk.ts): `Planter.clientFolderAsLink`, `objectNodes`,
`repeatFirstKey`, `sampleNodes`.

## Amber choices
- "Refused by clientFolders" read as "not listed, and loading the id is a 'file' issue naming the folder", because
  clientFolders returns a map and the other 14 must still list. Reverse: assert a throw from clientFolders instead.
- The renamed copy is `linked-(Test)-<folder>` (no leading number): a `<folder>-real-(Test)` copy would itself be
  listed as the same client id and hide the refusal.
- "Day 2" and "the day before month end" written as start+1 and end-1: the same for 14 folders, and C09 (starts
  15 April) still gets a day the old month check cannot catch.
- The bound text is also required on the adjusting-entry out-of-year tests (same rule, same reason).
- Scanner name and shape `repeatedKeys(text) -> { key }[]` chosen here; W00b round 3 imports it under that name.
- Answer-key nodes are sampled (40k nodes x 0.5 MB files is too slow for a full walk); onboarding nodes are walked in full.

## Validation (step 6)
typecheck and lint clean. `npm test`: db project green; unit project fails only in W00c's own tests: the acceptance
files (empties, json-keys x2, links, lookups, marker-pins, ranges) and the round 2 spec rewrites of
testworld/clients/checks-rolls.test.ts (8), w00c-checks.test.ts (9) and w00c-survivors.test.ts (1), which wait on the
RC1 to RC3 build (commit 82b19ae5).

## Sweep (step 6b)
A throwaway stub (scanner, lstat in clientFolders and a link refusal in loadClient, an out-of-year check naming the
bound) passed every new test; the full unit and db runs on it showed no other test newly failing. Retired: none.
