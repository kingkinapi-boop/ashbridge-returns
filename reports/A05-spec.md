# A05 spec, fix round 2 (2 Oct, worker cloud-4ab7b4)

1. Tests: `src/modules/storage/real-parent.acceptance.test.ts`, 14 tests (8 fail now, 6 pass as guards): put, has, get, list each meet a planted symlinked prefix folder at two levels (`sha256` and `sha256/<xx>`); the Drive stand-in meets an `index.json` linked out of the root (getFile and listFolder); two controls.
2. Clauses: ARC-6 (security review lows 1 to 3, reports/A05-security.md). Low 4 (settings via env.ts) left to a later card per A267; gitleaks left to TH.
3. Fail for the right reason: put succeeds through the link (2 kinds x 2 levels), has answers true (2), index read through the link succeeds (2). Commit c52b2f4. Validated on main 2cb2159 (typecheck, lint green; npm test 198 pass, only these 8 fail).
4. Amber: put must also refuse when the bytes already sit outside behind the link (its early "already stored" answer), since get refuses that file; has may answer false or refuse; put may create an empty folder outside (only files are checked), since the review's fix checks after mkdir.
5. Amber: list is in the rule for completeness; it already skips linked folders and passes.

Permission gaps: `head` after `;` in one Bash call was denied; worked around with plain commands.

Model: Opus 5.5.
