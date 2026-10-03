# CQ4 scope.mjs: files the Spec names belong to the spec job (R82)

**Lead directive, 3 Oct (A430): spec patch then build round 2 from reports/CQ4-findings.md (on claude/CQ4), items 2 to 5.** The R82 set is the Spec section's names in the expectation class (`*.test.*`, `*.acceptance.*`, `__fixtures__/`, `__golden__/`, basename `verify*.mjs`, `README.md`) and not named by the Build section; report and plan commits never count; a spec file a later spec commit rewrote prints `note: superseded by <sha>`; the card is read from the base ref; `--branch <name>` reads that branch. The 7 current tests stay unchanged; the spec adds the rows of items 3 and 4. The class and the Spec-names parser are exported from tools/lib.mjs.

Phase 0. Size S. Deps: CQ2. Where: local or cloud.
Tags: none (queue tooling).
Paths: tools/scope.mjs, tools/lib.mjs, tools/test/scope-spec-files.test.mjs
Clauses: ARC-15
Read: `reports/FX8-findings.md` (root cause 2), `plan/cards/CQ2.md`, `tools/scope.mjs`.
Spec commit: 2986c8bf (validated on main 0f7e1cc4)

## Goal
FX8's builder wrote the verify line and README count its own check depended on, and scope.mjs passed it, because it never looks at merge commits and does not know which files the spec owns (A417).

## Spec
- **R82**: a file named in the card's Spec section is the spec job's from the start; a build commit, or a merge commit that edits one by hand (content not taken from either parent), is flagged by name. Planted: claude/FX8 at 005070e8, which scope.mjs passes today; a clean merge of main into a build branch is not flagged.

## Build
The check in scope.mjs; nothing else.

## Check
A checker who did neither: the new tests and every tools test pass; scope clean.
