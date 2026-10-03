# CQ4 build
Branch claude/CQ4. Worker cloud-03268d. File changed: tools/scope.mjs (only).
- Files the card's Spec section names (backticked or bare name with extension, matched by path or trailing path) count as spec files from the start: a non-spec commit touching one fails by name.
- Merge commits: `git diff-tree --cc` lists files whose content matches neither parent; one that is Spec-named fails ("spec file edited by hand in a merge"). Clean merges of main are not flagged.
- Tests: scope-spec-files 7 of 7; all tools tests 255 of 255; typecheck, lint, deps:check clean; `scope.mjs CQ4` OK.
- Planted: `scope.mjs FX8` (005070e8) now fails on reference/sample-clients/verify.mjs.
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
