# CQ3 build
Branch claude/CQ3 (main merged first). Changed: tools/claim.mjs only (plus this report).
- Rule 1: `next` skips a build while its spec is reopened or working (not stale). The check already waited on a reported build.
- Rule 2: `isHeld` holds any release with a "wait:" note until the Lead reopens it; the wait key no longer lifts it.
- Results: claim-wait + claim tests 59 of 59; tools tests 276 of 276; npm test unit 2576, db 545; typecheck, lint, deps:check clean; scope OK (3 files).
- Amber: waitKey is still stored on release but no longer read (harmless; remove later). Reverse: restore the old isHeld.
## Permission gaps
none
## Model
Sonnet 5.5
