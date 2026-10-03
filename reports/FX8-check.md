# FX8 check

FAIL. Checker local-3 (Opus 5.5, laptop, did neither the spec nor the build), 3 Oct 2026, branch claude/FX8 at 005070e8.

## What passed
- typecheck, lint, deps:check clean. Scope OK (13 files). Spec test untouched (`git diff 84810b04 HEAD -- tools/test/sample-names.test.mjs` empty).
- `tools/test/sample-names.test.mjs`: 17 of 17 on the branch; with main's `reference/sample-clients` put back it fails 3 (07, 09, 14), as the card asks.
- tools/test plus the three contract tests that read sample clients: 15 files, 775 pass.
- Regenerating (generate.mjs, make-csv.mjs) is byte-identical to the branch apart from the known import.csv CRLF on disk (git ignores it). Only the four name lines moved; no figure moved.

## Failure
1. **verify.mjs is not green** (card Check: "verify.mjs green on all 15"). `node reference/sample-clients/verify.mjs` on the branch: 546 passed, 5 known, 3 failed. On main: 534 passed, 5 known, 0 failed.
   - `FAIL R11 ARC-8 ... README says 546 passes, this run gives 547`. The README count is wrong for both states. On the branch the first R11 line expects 547. After landing, the two ARC-16 lines pass, because the merge base with origin/main is HEAD. That gives 547 passes before R11, so both R11 lines would fail on main: the README needs 549, not 546. Main goes from green to 2 failures. Fix: set the README count to the post-landing total and recheck it after the W16 merge, whichever lands second.
   - `FAIL ARC-16 ... folders 01 to 10 (and 01 to 12) are byte-identical to main before W14/W15`: lists 07 and 09. This line fails on any branch that rightly edits folders 01 to 12. It passes on main once landed, so it is not this build's defect. But the card's Check cannot be met on the branch while it stands. The build report says the W16 spec retires these lines; until then a checker cannot tell a real freeze breach from FX8's allowed change.
   - Rule candidate: a freeze guard (ARC-16) names the cards allowed to change frozen folders (FX8: the three flag lines), so a branch can be checked green. A README count rule (R11) is checked in the state the code will land in, not only on the branch.

## Notes (not failures)
- The R11 arithmetic: nPass before R11 on the branch is 545 (546 minus the passing second R11 line). Adding the 2 ARC-16 passes after landing makes 547, so R11 expects 549.
