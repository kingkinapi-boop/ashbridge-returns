# W16 findings review (round 1), 3 Oct

Read: plan/cards/W16.md, spec 78a9fba1, build 562b3494, reports/W16-check.md and W16-build.md (claude/W16), tools/scope.mjs, blueprint 09, verify.mjs on main.

## Root cause (one)
The card split the work by file (spec job: verify.mjs and README; build job: data), but those spec-owned files hold facts about the end state that only the build makes true, and the card assigned neither to the spec:
1. Two frozen history guards in verify.mjs (W14's "folders 01 to 10 byte-identical to main", W15's "01 to 12") hard-code folder lists. W16 must change 03, 04, 07, 08 and 10, so they fail for every correct build.
2. R11 makes the README pass count equal this run. The spec wrote the interim state (534 passes, 5 failures), so R11 fails once R8 turns green. Card Build bullet 3 also tells the builder to list moved figures in the README, a spec file.
So the spec wrote expectations for the before state, not the end state, and no build could pass it. The builder then edited spec files (scope FAIL) and reported "scope.mjs W16 OK", which the check disproved: scope must run after the last commit, output pasted.

## Card or spec?
The card is right on substance; the spec and the card's "Who does what" must change. ARC-16 (blueprint/09-architecture.md:32): "Tests pin clocks and random seeds. A flaky test counts as a failure: it is fixed or removed within a day, never retried until it passes." It covers determinism (a second generation byte-identical), not "these folders never change". Nothing in ARC-8 or END-2 freezes 03, 04, 07, 08 and 10; the card's Goal requires them to change. The frozen guards are W14 and W15 scope checks mislabelled ARC-16, and scope.mjs already enforces "only Paths change" on every card. Card defect (amber): its split left the README counts and old guards unassigned, and Build bullet 3 hands the builder a spec file.
Do not adopt the builder's edits as they stand: its hard-coded `w16` exclusion list would stay in verify.mjs after landing and exempt those five folders from the guard for every later card.

## Consolidated fix list (in order)
1. Lead, card W16 (one amber row): bold round-2 directive at the top. "Who does what": the spec job also (a) retires the two merge-base guards (scope.mjs plus the second-generation check cover check 3; the alternative, one guard computed from the card's Paths, is larger), (b) writes the README counts at the end state, (c) writes the moved-figure list; the build edits no line of verify.mjs or README. Build bullet 3: a moved opening UCC changes the answer key's `t2Inputs` openingUcc and onboarding's `prior_year_closing_balances.ucc` together; UCC is no trial balance line, so no retained earnings line moves; the build lists moved figures in its report. Check 3 splits into "ARC-16 second generation byte-identical" and "scope.mjs W16 passes". Accept the five UCC moves (the card's fallback; 08 class 50's old 1,210.00 exceeded its 1,200 cost, so the old figures could not all fit).
2. Lead, branch: scope.mjs walks commit history (tools/scope.mjs lines 83 to 90) and never forgets 562b349, so claude/W16 cannot pass scope without a force-push. Tag e4ba504d as w16-round1, then start round 2 on a fresh branch from main (delete and re-create claude/W16, or a name claim.mjs accepts).
3. Spec job (Opus, core), first commit `spec(W16):` on the new branch: remove the two merge-base guards (main verify.mjs, about lines 996 to 1008), keep the second-generation and make-csv checks, KNOWN stays empty; README count line at the true target (recount: retiring two lines lowers 539); README lists each moved figure and why: 03 9,840.00 to 11,020.80; 04 21,400.00 to 29,120.00; 07 481,200.00 to 466,121.40; 08 class 8 3,440.00 to 3,315.20, class 50 1,210.00 to 42.52; 10 2,940.00 to 4,390.40. New acceptance line (END-2, core money): each README-listed opening UCC equals the answer key's openingUcc and onboarding's ucc for that class (skip if verify already ties key to onboarding). Fails first on main: R8 on five, the UCC line, R11.
4. Build job: bring over only the data from 562b349 (clients/c03_04.mjs, c07_08.mjs, c09_10.mjs and folders 03, 04, 07, 08, 10), regenerate, verify 0 failures, run `node tools/scope.mjs W16` after the last commit and paste the output.
5. Check job (a third worker): verify, scope, determinism, make-csv --check, SEC-11; `/security-review`; Opus adversarial read: recompute one class per client by hand (R8 passing is circular, the builder fitted registers to R8), confirm the changed amortization in-service dates move no planted issue or flag, and confirm the trial balances are unchanged.

## Where else it can bite
- Frozen guards: any later card changing content in folders 01 to 12. W00b and W00c rewrite every taxprep/import.csv and pass only through --ignore-cr-at-eol (checked: their sample-clients diff is empty ignoring CR). Retiring the guards removes the trap.
- R11 counts: any card whose spec edits reference/sample-clients/README.md while its build changes the pass count: future sample clients for kinds with none (blueprint 00, ARC-8), any FX card on sample data. W14 and W15 escaped because their cards list "the new pass count" among build edits (W14.md:30, W15.md:29).
- KNOWN removal by a spec: FX2, FX3, FX4 against the SC, SC4, SC5 KNOWN tables. No count or merge-base guard sits there (merge-base appears only in verify.mjs), but "a KNOWN entry that passes is a failure" means each FX spec must remove exactly the entries its build fixes.
- Cards with a spec/build file split: DG, F00T, SC, TH, W14, W15, W16; the card lint below covers them.
- Downstream of the UCC moves, low: openingUcc is kept out of import.csv (lib/taxprep-cells.json schedule8), so S00's 08 import is unchanged; W00c's RawKey is z.object, so `assets` loads (11 and 12 already carry it).

## Rule tests to add (own card after SC5; next free ids R77, R78)
- R77 card lint, every card file: a file the spec job owns is not named as something the Build section writes. Planted: W16.md as on main (README in both) fails.
- R78: no spec-owned expectation file holds a run-dependent baseline: verify.mjs has no git merge-base guard with a hard-coded folder count. Planted: verify.mjs as on main fails.
- Lesson for reference/lessons.md and the spec-writer orders: write every expectation, counts included, at the card's end state; it fails before the build for the right reason.

## Risks and re-tests
- Retiring the guards lowers the pass count; R11's target must match. Run verify twice (determinism).
- The fresh branch must not drag 562b349's verify.mjs and README hunks; the checker runs scope.mjs.
- Land order with W00c and W00b: the second to land merges main and re-runs verify.mjs, generate.ts determinism, make-csv --check and tools/test/sample-prior-year.test.mjs.
