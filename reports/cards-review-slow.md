# Cards for the Reviewer SLOW (2 Oct 01:50Z)

Branch `claude/cards-review-slow`. Card side only; nothing applied to `decisions/`, `.claude/` or `plan/AMBER.md`.

## Done
- New card `plan/cards/F00T.md` (phase 0, S, deps F00, core) and its slices entry. Holds the Reviewer HOLD. F00T added to the deps of F05M, M00, A06, B04, B05, F06, JH0, U02, V00 (cards whose Paths or text use `src/core/money.ts` or the clock; no card names `src/core/ids.ts`; F01's `ids.ts` is `src/contracts/ids.ts`).
- `plan/cards/DG.md`: per-file break at 100 on every `// @mutate` file, read from Stryker's JSON report inside `mutate-changed.mjs` (no Stryker config change), new rule R22, canary kept. One "Mutation bar" line added at the end of the fix rounds of F01, F03, F09, E03.
- `plan/cards/TH.md`: finding 6 as a spec fix item (egress-rules:292 and :216); TH Paths (card and slices) gain `src/core/egress-rules.acceptance.test.ts`.
- `node tools/matrix.mjs --plan`: PLAN OK. `plan/MATRIX.md` untouched.

## Proposed ambers (not applied)
1. Cards cite clauses, never restate them: a card names the clause IDs and says only what the clause leaves open (paths, fixtures, who does what, the check), and a card over 45 lines is split or trimmed at its next fix round; why: Reviewer finding 9 (27 of 71 cards over 45 lines, F00 at 117), restated clauses drift from the blueprint and cost every worker tokens; reverse: drop the rule from CLAUDE.md or the dispatch skill and let cards restate again.
2. `.claude/rules/testing.md` mutation line reads "every `// @mutate` file scores 100 (ARC-15); the canary scores 100" instead of "break threshold 70 now, raised at the phase 3 gate", changed by the Lead when DG lands; why: ARC-15 says one surviving core mutant fails the train and the rules file contradicts it (A248); reverse: restore the 70 line and drop R22 from DG.
3. The HOLD covers money, ids and the clock only, by Paths or text; TH (mentions the pinned clock reset but changes no clock code) and the `env.ts` readers (A04, A05, A06, B04) are not held for env; why: the Reviewer named three modules, and holding TH would starve the queue further (finding 3); reverse: add F00T to TH's deps.
4. F00T also marks and closes `clock.ts`, `env.ts` and `log.ts` at 100, not only money and ids; why: they are core files with builder-written tests, the log survivors are named in finding 2, and splitting them out would add a card for a few lines; reverse: narrow F00T's Paths to money and ids and card log separately.
5. Watch: U00's money cell formatter does not name `money.ts`; if its build imports `formatCents`, it adds F00T to its deps; why: the -0 survivor would print "-0.00" on screens; reverse: none needed (a dep only).
