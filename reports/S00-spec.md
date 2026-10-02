# S00 spec (local-948a53): reported

Files: `src/modules/taxprep-sim/core/sim.acceptance.test.ts` (58 tests), `core/__fixtures__/harness.ts`, `core/__golden__/client-{01,05,08}-export.csv` and `-report.json`. API fixed in the test file's header comment (createSimulator, defaultReleaseList, createReturn, importCsv, exportCsv, typeCell, clearCell, setYear, addCopy, copyCount, openReturn, lock, events).

Clauses: RT-1, RT-2, RT-3, RT-7, RT-8, RT-12, RT-13, RT-23, RT-25, RT-26, ARC-14, ARC-15 (all twelve acceptance checks of the card; check 10 is a fast-check property with seed 20261002).

Validated: the F03 branch (claude/F03, not yet on main) was merged into a scratch branch to run the tests, because S00 imports `src/contracts/taxprep.ts`. Against that, with a throwaway reference simulator (written only to prove the tests are sound, deleted, never committed): 57 of 58 pass; the 58th (ARC-15 needs at least one file under `core/`) correctly waits for the build. Without the simulator all 58 fail (module `../index` missing). Typecheck on main alone fails for the same missing modules (expected, as with every spec). Validated on main d500408 (origin/main used for the toolchain run), F03 branch merged for the contract. `npm run lint` clean apart from the cascade of the missing module. Unit project: 556 pass, 3 fail: two A05 symlink EPERM (Windows, no symlink right), one SEC-5 ESLint test in src/core that times out under whole-suite load on the laptop and passes alone.

Goldens: written from a plain-JS reading of the sample import files (not from the simulator); the test file also holds an independent reference model that must equal the golden.

Ambers (card unclear, choice made):
1. Descriptions: the default list has no descriptions in taxprep-cells.json, so the golden tests pass an explicit fixture release list (descriptions "GIFI code N - Test description"); a separate test requires the default list's cells to have non-empty descriptions and to cover all 12 sample import files.
2. Repeating cells are listed once with `[1]` and `repeating: true`; `GFBGII[1]...` cells are ordinary. A row at copy index (held + 1) creates the copy; larger is refused "Cell not available." (named unconfirmed).
3. F03's writer never writes an apostrophe, so the sim must add it to the writer's bytes; tests read bytes only.
4. `setYear` records no event; hand year dates are not event cells. Default cells at creation: Ident230 "1", Ident492 "N", ContactPartner "".
5. `importCsv` of a file F03 refuses (for example a BOM) returns `{ ok: false, faults }` and changes nothing (named unconfirmed; S01 owns faults).
6. Same value re-imported into a cell that held a value gives a "replaced" line (the card's check 5 reads this way).
7. Source rules: first line `// @mutate`; no `Date.now`, `new Date()`, `Math.random`, `randomUUID`, `randomBytes`; the source must use `parseTaxprepCsv` and `writeTaxprepCsv` and no `.split(',')`.
8. The card's "Spec commit" line is not edited (plan/ is the Lead's); the commit is in the job record.

Permission gaps: none hit. The spec-writer should be an Opus subagent for this `core` card; I had no subagent tool, so it was written by Sonnet 5.5 directly and needs the adversarial read at check.
Model: Sonnet 5.5.
