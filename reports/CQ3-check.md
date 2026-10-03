# CQ3 check (local-3, 3 Oct 06:50Z): PASS

Branch claude/CQ3 at b84e4b44 (spec 2f1a4298, refit 8e11109b; build 50c8b7f9). Local check: tools only, no db, no screens, not core, not security.

- `npm run typecheck` 0, `npm run lint` 0, `npm run deps:check` no violations (197 modules).
- `npx vitest run tools/test`: 15 files, 276 of 276 pass (claim-wait.test.mjs: rule 1 rows, rule 2 HOLD_ROWS and OTHER_ROWS, the next.mjs row).
- `git diff 8e11109b HEAD -- tools/test/` empty: the build did not touch the spec files.
- `node tools/scope.mjs CQ3`: OK, 5 files inside the paths.
- Mutation: no `@mutate` file on the card (tags none).
- Diff read: `next` skips a build while its spec is reopened or working and not stale; `isHeld` holds any "wait:" release until the Lead reopens it (reopen ends the released state). Nothing built beyond the two filters. The card says "a job"; the spec holds builds and specs only, which matches `update ... reopened` being allowed for those two roles only (a held check could never be freed). Amber, not a failure.

For the Lead (not CQ3's scope, found while taking W16's spec at 05:56Z): `next` computes its pick from one claims tip, but `writeClaims` re-reads `refs/remotes/origin/claude/claims`, which another local worker's fetch can move in between (all worktrees share refs). The commit then lands as a fast-forward on the newer tip and overwrites a claim made seconds earlier: local-3's W16 spec claim (0ec70d0a) replaced cloud-03268d's (3ba6da28) with no RACE. Rule candidate: `writeClaims` takes the tip the decision was made on and pushes with that parent only (or re-checks the claim file on the new tip before writing).
