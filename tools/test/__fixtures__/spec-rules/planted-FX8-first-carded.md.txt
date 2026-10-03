# FX8 Sample clients: the four bare names in flag text

Phase 0. Size S. Deps: none. Where: local or cloud (Node scripts, no packages).
Tags: none (made-up names gain "(Test)"; no figure changes).
Paths: reference/sample-clients/clients/c07_08.mjs, reference/sample-clients/clients/c09_10.mjs, reference/sample-clients/clients/c13_15.mjs, reference/sample-clients/07-*/**, reference/sample-clients/09-*/**, reference/sample-clients/14-*/**, reference/sample-clients/15-*/**, reference/sample-clients/verify.mjs, reference/sample-clients/README.md, tools/test/sample-names.test.mjs
Clauses: SEC-11, ARC-8
Read: `reports/W00b-spec-review.md` ("Who owns the C07, C09, C14 bare-name fix"), `reference/sample-clients/README.md`.
Spec commit: (spec-writer fills)

## Goal
Three flag details name a shareholder without "(Test)": Grace Liu (c07_08.mjs:54), Wei Zhang and Olu Adeyemi (c09_10.mjs:58), Declan Murphy (c13_15.mjs:227); the same text reaches answer-key.json, onboarding.json and profile.md of 07, 09, 14 and 15. W00b's guard refuses bare names in text, so W00b's build waits on this card (A409).

## Spec
- `tools/test/sample-names.test.mjs`: for every folder 01 to 15, every person the folder declares (answer key and onboarding) is never named in any text of that folder without "(Test)" or "TEST" right after the name; a planted folder copy with one bare name fails, the clean copy passes. Walk-driven: the declared people come from the files, never a typed list.
- verify.mjs gains the same rule, so a regenerated folder is refused too.

## Build
Add "(Test)" at the three generator lines; regenerate 07, 09, 14, 15 with generate.mjs; nothing else moves (the spec test and `git diff --stat` show only text lines with the names).

## Check
A checker who did neither: the test fails on main and passes on the branch; verify.mjs green on all 15; regenerating is byte-identical to the branch; no figure moved.

## Landing note
W16 holds c07_08.mjs, c09_10.mjs, 07-*, verify.mjs and README.md too. Whichever of FX8 and W16 lands second merges main in and regenerates; a conflict goes back as "rebase on main".
