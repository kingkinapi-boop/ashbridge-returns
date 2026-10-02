# D02 spec (cloud-055342): released, wrong premise

Not started; no branch pushed. Reasons (spec-writer step 1, read the card first):
1. D02 is a design card (family `design`). Its output is pages made by a designer and approved by Zo at a sitting (RV-53); the card's `design/screens/cpa-review/` does not exist on main or any claude/ branch. The versions live in `design/prototypes/cpa-review/` on `claude/design-cpa-review-2` (with `_build/` lint, verify, check scripts and the brief `design/briefs/cpa-review.md`), and the shared rule checks V1 to V8 (`design/verify/rules.mjs`) are only on `claude/design-verify`. Neither is on main.
2. Acceptance checks 1, 5 and 7 of the family ("every clause visibly met", "no dead control", "no filler text") need the approved page set to name what to look for; a spec written before Zo picks a version would pin a design he has not chosen, or be a generic rule test that duplicates `design/verify` rules.
3. Deps: D01's map (`design/map/`) is not on main yet (D01 is on the train), and the lint of check 6 needs the brief's blueprint commit.
Needed from the Lead: after Zo's sitting and the `design/verify` + approved pages land on main, either (a) drop the spec job for D02 to D13 and let the design-verify rules plus a thin per-screen test (file list, `rules.mjs` run, axe) be the check, or (b) reopen this spec once `design/screens/cpa-review/` exists so the spec can assert its pages and states.
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
