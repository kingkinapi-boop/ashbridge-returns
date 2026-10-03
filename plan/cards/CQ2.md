# CQ2 Queue: released checks re-offered, honest counts

**Lead directive, 3 Oct (A394): spec round for rule 6 only.** The check (reports/CQ2-check.md on claude/CQ2) found rule 6 has no independent tests: the builder wrote `tools/test/claim-needs-lead.test.mjs`. The spec writer owns that file now: read it, rewrite or replace it so rule 6 is tested by its own author (released twice with no new commit, held as needs Lead, shown in `list`, reopened by the Lead), validate it fails on main, report. Then the build reopens to make them pass, then a fresh check. Other rules' tests are unchanged.

Phase 0. Size S. Deps: CQ1. Where: cloud.
Tags: none (build tooling).
Paths: tools/claim.mjs, tools/next.mjs, tools/status.mjs, tools/scope.mjs, tools/test/claim.test.mjs, tools/test/scope.test.mjs, tools/test/claim-needs-lead.test.mjs, tools/test/__fixtures__/claims/**, .claude/skills/merge/SKILL.md
Clauses: ARC-15
Read: `plan/cards/CQ1.md` (Follow-up), `.claude/skills/dispatch/SKILL.md`, `.claude/skills/merge/SKILL.md` (Board the train), `plan/NOW.md` (Next, step 2).
Spec commit: (spec-writer fills)

## Goal
The Lead still re-stamps builds by hand so their checks can be offered again, and the tools tell the Lead things that are not true: `next.mjs` printed "in flight 0" with nine jobs working and offered START on cards whose builds had already reported; `scope.mjs <card>` run from main printed "0 file(s) changed" for cards with 6 to 38 changed files. Each costs a Lead step or a wrong board decision.

## Spec (planted claim fixtures under tools/test/__fixtures__/claims/)
1. A check released for a build (state released, `for` = that build) is offered again to a worker other than the card's spec writer and builder, with no re-stamp of the build.
2. A spec job is not offered while the card's build is reported but not merged (a spec refit then would invalidate a checked build); it waits until the card lands or the Lead reopens the build.
3. `next.mjs` counts in flight from the claims (working jobs, any role) and never prints START for a card whose build is reported, checked or done; those show under "waiting on check" or "ready to board".
4. `scope.mjs <card>` compares the card's branch (`origin/claude/<card>`) with the base whatever the current checkout, and fails loudly (exit 2) when that branch is missing, instead of reading HEAD.

5. A spec the Lead reopens for a new round (note does not start with `refit`) is offered with the Lead's note as the job's first line, and a worker cannot report it as a refit with no test change (A06 round 2 was reported "refit: no test change" on 2 Oct).
6. A job released twice with no new commit on the card's branch between the two releases is held as "needs Lead" (not offered) until the Lead reopens it; `claim.mjs list` shows it under that label (Critic 2 Oct evening, proposal 2, decision 0024: the SC build was taken 41 times in 22 runs).

## Build
The five rules in claim.mjs, next.mjs and scope.mjs; the merge skill's board step names `node tools/scope.mjs <card>` from any checkout.

## Check
A checker who did neither: the claim and scope tests, `npm test`, a dry run of `node tools/next.mjs 12` and `node tools/scope.mjs F02` on main showing true counts and F02's real file count.
