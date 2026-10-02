# Review, 2 Oct 2026 01:50Z

Verdict: SLOW

1. Loop works, repo safe, but the first card's core tests were written by its own builder.
2. Mode goes turbo to normal: no card is ready to build and core mutants survive.
3. Type `turbo on` when the Lead reports fixes 1, 2 and 4 done.

## Needs Zo

Two Lead calls hide items from your CPA review below a floor. In the Lead chat reply "amber ok A63 A69", or "amber reverse A63" (or A69):
- A63 (CK-32): shareholder benefit flagged only over $250.
- A69 (CK-39): flagged only over the greater of $2,000 and 5% of revenue.

## Findings

1. [verified] F00 broke spec independence. Round 0 had no spec job ("released F00 spec (lead)"); the builder (a1a25d0) wrote core.test.ts, the only money, ids, clock and env tests, unseeded (ARC-16). In round 3 the builder edited the spec's canary files (fd36cd4), excused afterwards as A253. HOLD for that area: nothing using money.ts, ids.ts or the clock lands until a spec job rewrites those tests with a pinned seed and names ARC-1, 7, 16, 17, 18, 21 (no tests in MATRIX.md). Lead.
2. [verified] ARC-15: one surviving core mutant fails the train. Tooling breaks only at 70% overall (A248), so train 20261001-2255 went green with 38 survivors; money.ts survivor at line 29 is real (formatCents(0) gives "-0.00"). Fix: per-file break at 100 on `@mutate` files; a card for money.ts and log.ts survivors (F05M covers only checks.ts). Lead.
3. [verified] Queue starved: `node tools/next.mjs 12` gives 6 startable, all "NEEDS SPEC FIRST"; about 60 cards wait on F09 (spec round 3) or TH. Lead: F09 and TH first.
4. [verified] Biggest waste: 7 of 9 first checks failed on plumbing (vitest include, lint project, PGlite, @mutate marker, scope on ledger). Fix: builders run the checker's exact gate before reporting; DG first.
5. [verified] Queue repairs 1 and 2 (tools/) reached main without a train; remedied, their tests ran green in train 2255. Queue repair 3 rides a train.
6. [verified] Pass with feature deleted: egress-rules:292 (reads config strings, lints nothing); egress-rules:216 (passes if no checkout step). Next tools spec.
7. [verified] Status files untrue: NOW.md stamps 06:30Z and 07:30Z on 2 Oct are in the future; status.mjs "in flight 0" while F03 and F09 specs work; TODO-ZO "doing now" cites items that no longer exist. Metrics for F00, F05, F08 log tokens and minutes as 0.
8. [verified] Zo's time: the memo format question (0014) was small; the .GFI took four to-do rounds (0013, 0015, 0016, 0017).
9. [verified] Bloat: 27 of 71 cards exceed 45 lines (F00 117). Proposal: cards cite clauses, never restate them.
10. [verified] Safety clean: no key-like strings, sample BNs fail the check digit, names end "(Test)", no paid dependency.

## Numbers

Merged: F00 (6 rounds, 14 jobs), F05 and F08 (1 round), queue repairs 1 and 2. Check fails 9; trains 2 of 2 green. Dispatches 153 (43 cloud runs). Ambers 301 open, 75 on clauses. Open reds 0.
