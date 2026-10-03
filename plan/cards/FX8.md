# FX8 Sample clients: the four bare names in flag text

**Lead directive, 3 Oct 15:04Z (A493): spec patch, two items, reopened by the Lead only after W00c's build is taken (known.json, A481); then the build.** (1) The three verify.mjs items SC6 could not do (W16 review 3, outside SC6's Paths): R11 treats a missing "N known" as a failure, never 0; `*` and indented bullets are read; folders outside SPEC are checked too. Plant each. (2) A history-free run: every checker over sample data (reference/sample-clients/verify.mjs first) passes in an export with no history (git archive, git init, one commit, no remote); planted, verify.mjs as it was before W16 round 2 fails both of its ARC-16 lines there, because merge-base finds no origin/main. The merge skill's sample-client step runs the same export. First merge origin/main: reference/sample-clients/verify.mjs and clients/c09_10.mjs conflict (main changed both after FX8's spec, W16 round 2); keep main's changes and re-apply FX8's on top (the refit released on that conflict at 15:28Z).

**Build note (A442):** regenerate 07, 09, 14 and 15 on a cloud box (Linux): regenerating on Windows writes CRLF and breaks RT-3 (sample 01 import.csv). Spec commit a9dd4aa3 on claude/FX8-r2.

**Lead directive, 3 Oct (A417): round 2 from reports/FX8-findings.md, on a fresh branch claude/FX8-r2 from main after W16 lands.** The spec job owns the test, the SEC-11 verify line and the README count (main's count plus 15) and pastes the exact red set on its commit (the SEC-11 lines and the two R11 lines); the acceptance test also asserts no declared person is skipped by the 5-character name guard. The build changes only the three generator lines and regenerates 07, 09, 14 and 15. The check runs verify.mjs green on the branch and again after merging origin/main into a scratch copy. W16 replaces the two whole-folder lines; FX8 does not touch them.

Phase 0. Size S. Deps: W16. Where: local or cloud (Node scripts, no packages).
Tags: none (made-up names gain "(Test)"; no figure changes).
Paths: reference/sample-clients/clients/c07_08.mjs, reference/sample-clients/clients/c09_10.mjs, reference/sample-clients/clients/c13_15.mjs, reference/sample-clients/07-*/**, reference/sample-clients/09-*/**, reference/sample-clients/14-*/**, reference/sample-clients/15-*/**, reference/sample-clients/verify.mjs, reference/sample-clients/README.md, tools/test/sample-names.test.mjs, tools/test/__fixtures__/schema-contract/known.json, tools/test/sample-verify.test.mjs, tools/test/__fixtures__/sample-verify/** (A493 patch)
Clauses: SEC-11, ARC-8
Read: `reports/W00b-spec-review.md` ("Who owns the C07, C09, C14 bare-name fix"), `reference/sample-clients/README.md`.
Spec commit: a9dd4aa3; patch (A493) see claude/FX8 head; validated on main bd5ec11

## Goal
Three flag details name a shareholder without "(Test)": Grace Liu (c07_08.mjs:54), Wei Zhang and Olu Adeyemi (c09_10.mjs:58), Declan Murphy (c13_15.mjs:227); the same text reaches answer-key.json, onboarding.json and profile.md of 07, 09, 14 and 15. W00b's guard refuses bare names in text, so W00b's build waits on this card (A409).

## Spec
- `tools/test/sample-names.test.mjs`: for every folder 01 to 15, every person the folder declares (answer key and onboarding) is never named in any text of that folder without "(Test)" or "TEST" right after the name; a planted folder copy with one bare name fails, the clean copy passes. Walk-driven: the declared people come from the files, never a typed list.
- verify.mjs gains the same rule, so a regenerated folder is refused too.
- The spec job owns the pass-count sentence in `reference/sample-clients/README.md` (A430).

## Build
Add "(Test)" at the three generator lines; regenerate 07, 09, 14, 15 with generate.mjs; nothing else moves (the spec test and `git diff --stat` show only text lines with the names).

## Check
A checker who did neither: the test fails on main and passes on the branch; verify.mjs green on all 15; regenerating is byte-identical to the branch; no figure moved.

## Landing note
W16 holds c07_08.mjs, c09_10.mjs, 07-*, verify.mjs and README.md too. Whichever of FX8 and W16 lands second merges main in and regenerates; a conflict goes back as "rebase on main".
