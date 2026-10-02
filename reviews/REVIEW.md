# Review, 2 Oct 2026 14:40Z (since the 02:20Z review)

Verdict: SLOW

1. Progress: 21 of about 299 cards on main (9 landed since 02:20Z), 45 of 198 testable clauses have tests (23%). Main is green; data, secrets and blueprint are clean.
2. Turbo was real in spend (153 dispatches today, 6 workers at once) but not in output: much of it went on rework, re-offered jobs and refits, and only 2 cards are spec'd and ready, so I lowered the mode to normal (rules below).
3. To have turbo back now, type `turbo on` in the Lead chat; I suggest waiting until FX1 and F01C land (both in the queue).

## Needs Zo

Nothing.

## Findings

1. [verified] Rework: of 11 cards finished or stopped since 02:20Z, 4 reached build round 3 or more (DG reopened 3 times, D00 twice; F09A and F01 parked at round 3 and split into F09B, F01C). Over a fifth: SLOW.
2. [verified] Flaky test on a train: train 20261002-1359 (G01) failed only on SEC-5 timing out at 5032 ms; passes alone. Flaky: SLOW.
3. [verified] Queue starving in turbo: `node tools/next.mjs 12` gives 2 spec'd startable (F01C, W00); 10 need specs; 13 cards wait on F01C; 28 cards still to write.
4. [verified] Biggest waste: the queue re-offers cards that must not start. Since 02:20Z: 72 releases against 136 reports; G12 picked up 7 times, U00 6, D02 5 (about 18 wasted pickups), F04 build re-offered after it landed.
5. [verified] NOW.md not fully true: "Local workers: None running now" (one runs W04), the to-do #1 sitting line (the to-do says nothing needs Zo), plan use from 07:15Z, and Next item 1 lists F09B, DG2, D00, E03 to board though they landed. `status.mjs` prints blueprint v1.1; the blueprint says v1.2. Lead.
6. [verified] Metrics lines since 02:20Z carry no tokens or minutes, and "rounds" (TH 8, DG 10) counts jobs, not build rounds.
7. [verified] Sampled DG, D00, F04: specs unchanged to merge; three different workers each. No keys or personal data found; decision 0019 quotes Zo.
8. [inferred] `scope.mjs DG` flags e480b61, a later DG2 commit that reached claude/DG through main: a false alarm. Lead.

## Applied (Zo said "apply", 2 Oct 14:55Z)

- testing.md: cold-tool tests set a 30 s timeout.
- dispatch skill: an Opus review of every core spec before its build; a card released as "must not start" is parked or given its dep at once.
- merge skill: metrics "rounds" means build rounds; minutes are real.

Lead, in this order: FX1, then re-board G01 with D00L; a claim.mjs card (no build re-offer after a PASS or a landing, F04); W01 to W10 specs and cards T08, Q00, Q01, I01, I30, I40; NOW.md and status.mjs corrected.

## Numbers

Since 02:20Z: 9 cards merged (TH, F03R, D01, DG, DG2, D00, F09B, E03, F04), 2 parked and split (F09A, F01). Check fails 7 (F09A, F01, A01, A07, W00, F04, E03). Trains 13: 12 green, 1 red (flake). Dispatches today 153 (107 cloud runs). Ambers A313 to A362 (50). Open reds 0. Mode lowered turbo to normal.
