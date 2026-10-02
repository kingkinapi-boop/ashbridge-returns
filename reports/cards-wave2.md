# Cards wave 2: fix list 1 (a) to (g) and items 2 to 8 applied (2 Oct)

Source: `reports/findings-wave2.md`. Cards changed: F04, F09A, F03R, S00, DG, A01, SC, I00, A04; `.claude/agents/spec-writer.md` (step 6b); `plan/slices.json` deps (F04 +F09A, S00 +F03R, A01 +F09A). `node tools/matrix.mjs --plan`: PLAN OK.

## Proposed ambers (one per line: what; why; reverse)

1. F04 citation kind `page` {documentId, page}, no quote or box, allowed only on a "missing" finding, whose citations are each a document box, a page or a return cell (never a ledger record); I00 checks the page exists; why: AI-5 names "a page" and F04 had no kind for it, and "cites only document, page or return_cell" read "document" as the existing document-box kind; reverse: drop the kind and the rule in F04's spec round 2 before its build.
2. F09A makes the five reading schemas strict at runtime at every depth, F04 and A01 depend on F09A; why: RC2, zod drops unknown keys silently; reverse: remove F09A from the two deps and `.strict()` from the schemas.
3. F09A retires exactly one F09 test (reading.acceptance.test.ts:1063-1067, mutant 375), rewritten to A296's dash rule; every other F09 grammar test was read against the table and kept; any further failure the sweep finds goes to the Lead, not retired; why: the card note asked for the full retire list and only that test contradicts A296; reverse: restore the test from 981d672.
4. S00 apostrophe by cell kind (negative whole numbers in amount cells only; rate and text negatives without, unconfirmed), id source a required constructor argument, S00 depends on F03R; why: RC3 and A333's RT-3 reading; reverse: return to "every negative value" and drop the dep.
5. F03R exports `ALWAYS_EXPORTED` (the eight creation and contact cells, each with its finding) from taxprep.ts and tags its writer `@writes <parser>`; why: SC R25 forbids a cell list outside taxprep.ts, so S00 needs a single source, and R24 finds writers by the tag; reverse: move the list back into S00 and narrow R25.
6. F03R's writer re-reads every branch through `classifyValue` at its exit; new checks 5 to 8 (1e21 and 1e300 rates, `-'` faults, a write-then-parse property with extremes, the list); why: RC3; reverse: drop the round 2 section.
7. DG round 3 Paths add `stryker.config.mjs`, `vitest.mutate.config.ts` and `src/core/testing/read-own-source.ts`; source scans survive Stryker through a shared `readOwnSource()` that reads the committed file from the repo root when run under `.stryker-tmp/`, chosen over leaving source-scan tests out of the mutate config; why: leaving out whole files would drop mutant-killing tests in mixed files (reading.acceptance.test.ts holds both), and Stryker's per-test runs override a name filter; reverse: replace the helper by a mutate-config exclusion.
8. DG round 3's planted cases both sit in R20 (fixtures skip, source scans) and a canary and same-test-set check in R22; why: fix 2 named R20 for one and gave the other no number; reverse: renumber in the spec.
9. A01 build round 2 starts with a spec refit by a spec worker (dependency.acceptance.test.ts reads through `readOwnSource`, every assertion kept), and blank pdfjs items are dropped before building words rather than loosening WordSchema; why: the builder may not edit acceptance tests, and F09A makes word text non-blank; reverse: drop the refit and accept the Stryker failure as a reasoned exclusion.
10. SC adds R23 (strict schemas, env.ts excluded), R24 (`@writes` read-back property), R25 (no IDENT./IFirm. list or Taxprep description outside taxprep.ts, tests and fixtures excluded) and renumbers its R19 to R21 to R26 to R28 (DG keeps R19 to R22); F09A's `@money` note now names R26; why: fix 8 and 1g; reverse: renumber back and drop the three rules.
11. spec-writer step 6b: a throwaway stub that passes the new spec, the whole suite run, every other failing test retired or rewritten with its reason in the commit, an unclear one reported to the Lead instead; survivor rounds read dependants' defect notes first; why: RC1; reverse: delete step 6b.
12. I00 and A04 carry a Lead note on the page kind and runtime-strict schemas; why: the risks list says both handle the widened AI-5; reverse: delete the notes.

## Proposed clause change

None. AI-4 ("any quoted number or words appear in the OCR words inside the cited box") already allows a citation with no quote, and AI-5 already names "a document, a page or a return cell", so the page kind needs no clause wording change.

## For the Lead (not done here: slices changes outside deps)

- `plan/slices.json` DG `paths` should gain `stryker.config.mjs`, `vitest.mutate.config.ts` and `src/core/testing/read-own-source.ts` (the card's Paths line has them); `tools/scope.mjs` reads paths from slices, so DG round 3's build fails scope until this lands. DG's `note` still says round 3 is "skip __fixtures__ for the marker"; it is now widened.
- `plan/cards/F09.md` (landed) still says "SC's rule R20" for `@converter`; that rule is now R27. Left as history.
