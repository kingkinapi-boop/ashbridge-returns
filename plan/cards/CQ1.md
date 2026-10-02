# CQ1 Queue: no wasted offers

Phase 0. Size S. Deps: none. Where: cloud.
Tags: none (build tooling).
Paths: tools/claim.mjs, tools/next.mjs, tools/status.mjs, tools/test/claim.test.mjs, tools/test/__fixtures__/claims/**
Clauses: ARC-15
Read: `reviews/REVIEW.md` (2 Oct 14:40Z, findings 3 to 5), `.claude/skills/dispatch/SKILL.md`, `plan/AMBER.md` A352, A354.
Spec commit: (spec-writer fills)

## Goal
Since 02:20Z the queue made 72 releases against 136 reports: it re-offered G12 7 times, U00 6 and D02 5 (cards that must not start), and offered F04's build again after F04 passed and landed. Each wasted pickup costs a cloud run.

## Spec (planted claim fixtures under tools/test/__fixtures__/claims/)
1. A card whose status is done is never offered any job; a card whose build check PASSED is never offered a build unless the Lead reopens it, even when its spec needs a toolchain refit (the refit then waits for the next reopen).
2. A job released with a reason in the "must not start" class (the note starts with `wait:`) is not offered again until its card's deps or status change; next.mjs lists it under "waiting".
3. A spec job is offered only when every dep is done or has a reported build (current rule) and the card is not in the design lane (`lane: "design"` in slices.json skips spec and build).
4. `status.mjs` prints the blueprint version read from blueprint/README.md, not a literal.

## Build
The four rules in claim.mjs, next.mjs and status.mjs; the worker orders say to release with `wait:` when a card must not start.

## Check
A checker who did neither: the claim tests, `npm test`, and one dry run of `node tools/next.mjs 12` on main showing no done or design-lane card.
