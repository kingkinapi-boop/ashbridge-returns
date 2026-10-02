# BL0 One blank rule everywhere

Phase 0. Size S. Deps: F01, F04, F05M. Where: cloud.
Tags: core (citations and checks).
Paths: src/contracts/ai.ts, src/contracts/ai.test.ts, src/contracts/checks.ts, src/contracts/checks.test.ts, src/contracts/blank-rule.acceptance.test.ts
Clauses: AI-5, ARC-8
Read: `reports/findings-F01-r2.md` (RC1, follow-ups), `reports/F04-check.md` (on main after F04 lands), `plan/cards/F01.md` round 3, `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
Every non-blank rule in the contracts uses `isBlank` from `src/contracts/text.ts` (F01 round 3), so an AI quote, a check's text and a stored record agree on what blank means. Today F04's `quote` uses `trim().min(1)` (a quote of only U+200B, U+2060 or U+0085 passes) and F05M's `checks.ts` `nonBlank` uses `trim`.

## Spec
1. An AI output whose quote is only U+200B, U+2060, U+0085 or U+2800 is refused with the blank reason; one visible character among them is accepted.
2. Every text field `checks.ts` requires non-blank refuses the F01 blank sample set.
3. SC R41's scan (no `.trim()` or `min(1)` non-blank rule in src/contracts) passes over ai.ts and checks.ts.

## Build
`ai.ts` quote and every other non-blank string use `NonBlankSchema`; `checks.ts` `nonBlank` calls `isBlank`. Mutation 100 on both files.

## Check
A checker who did neither; full suite; `mutate:changed` 100; an Opus read of every string field in both files.
