# Family: learning cause rule ({cause})

Phase (the card's own, in plan/slices.json). Where: local or cloud.

Cards N10 to N18. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 07 (LL-4) and `src/modules/learning/diffs/` (N01).

## Goal
A difference between versions caused by "{cause}" is labelled so by a code rule, so lessons are blamed on the right thing without anyone logging them.

## Build
- `src/modules/learning/causes/{cause}/`: a rule that looks at a difference and its evidence trail (events, document arrival times, mapping rows, judgment inputs) and says yes, no, or cannot tell. The rule replaces N01's stub in `causes/{cause}/`; never edits `_core`.
- Rules never guess: "cannot tell" leaves the difference for the AI to propose a cause, marked unconfirmed.

## Acceptance checks
1. On N01's planted set, the version pairs that plant a "{cause}" difference: the rule says yes.
2. On N01's planted set, the differences planted with every other cause: the rule says no or cannot tell (never a wrong yes); a planted rule that says yes to another cause's case fails naming the case.
3. Late information is never blamed on the AI or the preparer (LL-2, LL-4).

## Not in this card
Ranking (N20).
