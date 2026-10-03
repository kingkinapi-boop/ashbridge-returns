# SC6 check (cloud-a2c0b4) on claude/SC6 7f6d200a: FAIL

Passed: typecheck, lint, deps:check, spec diff since c526b32d empty, scope clean, npm test (120 files, 2811 tests), db project on PGlite (608 pass), card-rules 33 of 33, mutate:canary scores. No `@mutate` files in the diff. pg16 and e2e not run (no db or screen code in the diff). KNOWN is empty.

## Failures (Opus adversarial read; each reproduced with a scratch copy of the rule functions)
1. Landing trap (card-rules.test.mjs:631, :746): R77 and R81 scans use `plan/cards/SC6.md` as sentinel, but `openCards()` drops done cards, so both go red once SC6 is done. `.filter((c) => c.src)` at :78 silently drops an open card with no source file; nothing asserts none were dropped.
2. R77 reads only a sentence starting with "Build" (BUILD_START :249-262). Real bold directives start "**Lead directive, <date> (Annn): build round N ...**" and give orders in later sentences: these return []: `**Lead directive, 3 Oct (A999): build round 2.** Rewrite README.md counts.`; `**Lead directive, 3 Oct: Build rewrites README.md counts.**`; `## Fix round 1` + `- Rewrite README.md counts (build).`; "Builders rewrite README.md"; "Rebuild: rewrite README.md"; `### Build` (sections() splits only on `##`).
3. R77 clauses (:234-246): passive build clause after a spec clause dropped ("README.md counts are rewritten by the build"; "rewritten" not in OWN_VERB).
4. R77 misses spec-owned files named by folder (`tools/test/__fixtures__/x/` vs `.../a.json`) or as `e2e/x.spec.ts` (isExpectationFile lacks `.spec.`).
5. Not case-blind for README: `base === 'README.md'` exact; `Readme.md` / `readme.md` unchecked in R77 and R81.
6. R81 counts a negated mention as ownership (:329-339): Spec saying only "Never touch verify.mjs." passes.
7. R78 matches per line (:396): a `spawnSync('git', [\n 'diff',\n 'main', ...])` split across lines slips.
8. Other R78 slips: `refs/heads/main`, `FETCH_HEAD`, `HEAD@{1}`, ref in a variable, "folders 01 to 10 are the same as on main", "unchanged versus main", code lines starting with `*` treated as comments; pinned hashes caught only as 64-hex (40-hex, split hex, `sha256-` base64 pass); GIT_SUB (:356) hand list lacks show-ref, for-each-ref, describe, grep, archive.
9. R81 narrower than the card: goldens are exempt (NEEDS_NAMED_OWNER :323 covers verify scripts and READMEs only).

Rule candidate: a rule test's sentinel must be a card that stays open, and every scan asserts it dropped nothing.

Model: Sonnet 5.5 checker; adversarial read by an Opus subagent. Permission gaps: none.
