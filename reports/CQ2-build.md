# CQ2 build report

Branch claude/CQ2. Worker cloud-2f8ae4. Files: tools/claim.mjs, tools/next.mjs, tools/scope.mjs, tools/test/claim-needs-lead.test.mjs (new), .claude/skills/merge/SKILL.md.

- tools/test: 223 of 223 pass (the 23 CQ2 acceptance tests plus 3 new rule 6 tests). typecheck, lint and deps:check clean.
- Rule 6 (needs Lead) had no acceptance tests in the spec; I added tools/test/claim-needs-lead.test.mjs.
- Scope gap: `scope.mjs CQ2` fails on two files outside the card Paths: that new test file and .claude/skills/merge/SKILL.md (the card's Build asks for it). Lead: add both to the card Paths, or board with this note.
- Dry run: next.mjs 12 prints in flight 6 (from claims), START only SC, waiting on check: A04. scope.mjs F02 now exits 2 (no origin/claude/F02 branch), as designed.

Ambers: (1) a spec reopened while the build is reported is still offered (the Lead's reopen counts as the Lead's choice); reverse: drop the `s.state === 'reopened'` exception in claim.mjs. (2) The needs-Lead hold applies to every role and ignores "wait:" releases; reverse: restrict in the update() release block.

Permission gaps: none. Model: Sonnet 5.5.

## Round 2, local-3, 3 Oct (spec rule 6 tests, 934365e7)
No product change needed: main merged, the spec job's 28 rule 6 tests in tools/test/claim-needs-lead.test.mjs pass against the existing claim.mjs, next.mjs and scope.mjs. tools/test: 13 files, 231 of 231 pass. eslint on the three tools clean (the .mjs test is lint-ignored), deps:check clean, typecheck clean outside sheets/xlsx and ocr/textlayer (laptop node_modules lacks exceljs and pdfjs-dist, unrelated). `node tools/scope.mjs CQ2`: SCOPE OK, 12 files. Ambers from round 1 stand. Model: Sonnet 5.5.
