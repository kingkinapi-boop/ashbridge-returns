# SC spec (cloud-18d04e, 2 Oct): refit plus R34 widened, R35, R45 cite, R46 to R56

Spec commit 34e8ac0 on claude/SC, validated on main 6d8efd6 (origin/main merged). 94 rule tests (unit 75 in tools/test/schema-contract-rules.test.mjs, db 19 in src/contracts/schema-rules.db.test.ts; 29 new). `npm run typecheck`, `npm run lint`, `npm test` (unit 1955, db 446) and `npm run test:flake` (5 of 5) are green. Retired tests (step 6b): none; SC is rules only, so the stub is empty and no other test moved.

## What is new
- Each new rule first catches a planted example under tools/test/__fixtures__/schema-contract/ (r35/, r51/, planted-r34-pii.json, planted-r34-pii-dotted.txt, planted-r46/r47/r49/r50/r52-r53/r56, db/r55-bound.sql), and a clean twin passes where a false alarm is possible.
- R34 widened: a SIN as a JSON number, in exponent form (2.71000002e8), with mixed, dotted or no-break separators; binary test data only on a reasoned list (A01 PDFs, A05 placeholder PDFs); W00b's guardFolder runs once guard.ts is on main. Fixed a false alarm: box fractions such as 0.490196078 in A01's fixtures no longer count as SINs. R34 now uses lib/util.mjs luhnValid (R50).
- R47, R48, R54 run on A01 now through a READERS registry; A02, A03, A07, B04 and E00 are declared in PENDING and must get a registry entry when they land (a spec job), or the rule fails.
- R55 (db): is_version_stamp and sources_are_real against VersionStampSchema and sourcesAreReal at 1.797693134862315807937e308, 1e400, 1e-400 and 2^53+1.

## Owner defects on main (in KNOWN; add each to its card)
- F01 family (records.ts, db/schema): R12 returns.returns has no truncate refusal; R15 exceptions.status has no list (SQL and zod); R23 the record schemas accept a stray key at the top; R43 ids.ts has no FUTURE_POINTERS (20 pointer columns); R55 SQL refuses the midpoint while JS accepts it as MAX_VALUE, and 1e-400 and 9007199254740993 are accepted but read back changed in JS (A367).
- F02: R16 lifecycle/index.ts orders by occurred_at, id; R23 lifecycle.ts ApprovalFingerprintSchema and ChangedItemSchema accept stray keys.
- G00 or G02: R18 gaps/index.ts lacks // @mutate. G01: R41 gaps/bank/index.ts uses .trim() and z.string().min(1).
- F09B: R49 reading.ts:48-49 z.string().trim() on the engine name and version.
- E03: R45 the loader does not enforce the cra_form cite pattern (plus the earlier R45 entries).
- A01 successor: R54 a zero-size MediaBox ends in a raw error, not a refusal.

## Amber (decided, reverse by editing the test)
- R54 for A01: the reading contract returns a result or rejects, so a rejection with A01's own "Reading refused: ..." Error counts as a refusal with a reason. Any other throw fails. The SC card says "never throws"; the alternative is a result-or-refusal type in reading.ts (F09 family).
- PENDING list (R35 "unless declared"): a rule whose subject is not built yet passes on its declaration and runs as soon as the subject exists.
- R52 catalogue: until W00c's faults.ts lands, the test holds the marker catalogue (dupOf, priorYear, missingFromExport) and the proofs (original exists and matches, dated before the year, counts match, months roll with card balances signed as amounts owing). When faults.ts lands, it must name each marker.
- R53 also links a client kept over two years (folders NN-name-YYYY): last closing equals the next year's opening.
- R46 and R56 are text scans with named patterns (cell/value/raw/item .text, String(x) or a template with no typed switch; regexes naming sheet XML tags with no self-close branch; Math.abs(...) < an absolute constant).

## Permission gaps
None.

## Model
Opus 5.5.
