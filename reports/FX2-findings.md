# FX2 findings review (round 1 check FAIL, claude/FX2 at 6a8531b)
Opus 5.5, 3 Oct 2026. Inputs: plan/cards/FX2.md, reports/FX2-spec.md, FX2-build.md, FX2-check.md, the diff, SC3/SC5/SC7/FX7/B04/JH0 cards, testing.md. The product code reads correct; both failures are card and spec side.

## Root causes
**RC1 Paths drawn from the module barrel, not from where the setting is read; no step turns a Paths gap into a card change.** Paths list src/modules/storage/index.ts (a re-export, untouched), while A05 reads the engine in storage/safe.ts (readEngine) called from files/index.ts and drive/index.ts. The spec writer saw it and wrote it as an amber in its report; the builder edited the three files instead of stopping (builder.md: "stop and report") and reported "scope OK (4 files)", a false OK (scope.mjs reads the wrong ref; CQ2 item 4). Where else:
- auth/index.ts:18 still passes `opts.env ?? process.env` (AUTH_ENGINE). SC5 R71 will flag it; SC5 names its owner "A06 round 2", but A06 is done, so the KNOWN entry has no open owner.
- SC5 R73 names FX2 as owner of the loose drive `Index` schema (z.object, drive/index.ts:17), but FX2's card says nothing of it.
- FX7 Paths hold src/modules/storage/** with no dep on FX2: the two builds collide on safe.ts and drive/index.ts.
- B04 reads QBO_ENGINE "through src/core/env.ts" but env.ts is not in its Paths and its spec has no production-unset refusal, so SC3 R62 fails it on landing.
- npm run e2e serves `next start` (production) with no *_ENGINE in playwright.config.ts webServer env. Harmless today (no served route builds an adapter); F10 deps.ts will. JH0 already sets engines for journeys; e2e has no such line.
**RC2 The source-scan rule (testing.md: read through readOwnSource, from DG) is written but not enforced, and its planted case is unlike real Stryker output.** ocr/engine-setting.test.ts reads ocr/index.ts (@mutate) with fs.readFileSync and asserts no /process\.env/; Stryker's real preamble holds `g.process.env.__STRYKER_ACTIVE_MUTANT__`, so the dry run fails. DG's planted preamble (read-own-source.acceptance.test.ts:21) has no process.env, so it never modelled this. Where else (raw reads of @mutate files on main, latent until their file is mutated): amount-grammar.acceptance (601, 737), reading.acceptance (755), reading-strict (266, skips when instrumented), clock (120, 133), env (77), ids (125), log (228), money (154). FX7 mutates reading.ts and amount-grammar.ts next, so it can hit the same wall. storage/engine-setting.test.ts:129 reads raw too (safe.ts is not @mutate today).

## Consolidated fix list (in order)
1. Card, amber (FX2's own concern, engine reads through env.ts): Paths gain src/modules/storage/safe.ts, storage/files/index.ts, storage/drive/index.ts, src/modules/auth/index.ts; drop storage/index.ts. Build gains: auth/index.ts calls `readSettings(opts.env)` (same behaviour). Bold directive at the top (claim.mjs drops reopen notes).
2. Card ambers elsewhere: SC5's KNOWN owner for auth/index.ts becomes FX2, for the drive Index (R73) FX7 (it owns storage/** and readers of done cards); FX7 gains dep FX2; B04 Paths gain src/core/env.ts and a spec item "production with QBO_ENGINE unset refuses naming it"; F10 (first served adapter, deps.ts) gains playwright.config.ts and sets OCR_ENGINE, STORAGE_FILES_ENGINE, STORAGE_DRIVE_ENGINE, AUTH_ENGINE in webServer env.
3. Spec job, round 2: both engine-setting tests read through readOwnSource, same files and regexes (assertions unchanged; never drop the process.env check, skip in the sandbox, unmark @mutate or exclude files from Stryker: A329); the scan adds auth/index.ts (fails on the branch today for the right reason).
4. Build round 2: merge the spec; the one auth line; nothing else. scope.mjs from the FX2 branch must be clean.
5. Check: scope, npm test, test:flake, mutate:changed FX2 at 100 on env.ts and ocr/index.ts (list any survivors), then /security-review before boarding (security tag; not run in round 1).

## Tests to add
- Acceptance (FX2 spec job): item 3 above; plus production with AUTH_ENGINE unset still refuses after the auth change (A06's test already covers it: re-run, do not copy).
- R79 (new rule card SC8, or SC6 if the Lead prefers): every test that reads the text of a src file marked `// @mutate` reads it through readOwnSource. Planted: ocr/engine-setting.test.ts as at 6a8531b. KNOWN: the 9 reads listed in RC2 (owners named by the Lead; FX7 for the contracts tests). Also fix DG's fixture: plant a real captured Stryker preamble (with process.env) in read-own-source's acceptance test.
- R80 (SC7, the shared KNOWN helper): every KNOWN entry's file lies inside its owner card's Paths and the owner is open in plan/slices.json. Planted: SC5's R73 entry owned by FX2 as carded before this review; A06 (done) owning auth/index.ts.
- Agent orders (amber): spec-writer.md step 6 gains "a test that needs product edits outside Paths is a Paths gap: report it to the Lead and stop"; builder.md's existing stop rule is cited in the builder's reopen directive.

## Risks of the fixes, and what to re-test
- readSettings parses the whole schema, so a bad unrelated setting (AUTH_ENGINE=foo) now stops OCR and storage with "Invalid settings: AUTH_ENGINE". Fail closed is right; note it on GL1. Re-test src/contracts/auth.acceptance.test.ts and the auth module tests after the auth line.
- env.ts is @mutate and shared (A06, FX2, B04 later): each change must keep 100; run env.acceptance and auth tests with it.
- Storage: re-run settings.acceptance, files.acceptance, drive.acceptance, real-parent.acceptance (options.env now optional; undefined falls to process.env).
- FX7 rebases over FX2's storage edits; land FX2 first. npm run e2e stays 1 of 1 on the production build.
