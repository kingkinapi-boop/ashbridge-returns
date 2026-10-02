# F09 spec, fix round 3 (cloud-85862e; tests by an Opus spec-writer subagent)

Commit 6b127d3 on claude/F09: 5 tests in `src/contracts/reading.acceptance.test.ts` (3 for check 17, no -0; 2 for check 18, non-finite converter input throws RangeError). All 5 fail on the current build (normaliseAmount returns -0; NaN x or y gives ZodError); the other 50 tests in the file and the rest of `npm test` stay green and unchanged. Validated on main deab596; typecheck and lint clean.
Amber: `amountGroups` is not exported, so group zero is tested through normaliseAmount on the group text valueInBox builds, plus valueInBox matching 0.00 and -0.00 (that part passes today). Check 18 requires RangeError, not its message (the build note asks it to name the field).

## Permission gaps
None.
## Model
Spec tests by Opus 5.5 subagent; worker Sonnet 5.5.
