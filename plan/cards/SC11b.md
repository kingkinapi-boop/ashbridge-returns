# SC11b Db harness rules, the rest of SC11's round 3 (connection peak, connect timeout, setup bounds, R119 and R120 everywhere)

Tags: security (a leaked connection or an unbounded setup query can make db tests falsely green).
Paths: tools/measure-db-peak.mjs, src/core/db/index.ts, src/core/db/global-setup.ts, src/core/db/pool-rules.acceptance.test.ts
Clauses: ARC-6, SEC-1, ARC-15
Read: `reports/SC11-findings-3.md` (copied into plan/cards/SC11.md, A540), `plan/cards/SC11.md`.

## Goal
Split from SC11 at its round 3 (A540) so SC11 can pass in one more round; does not block SC3.

## Spec
- S12's connection peak becomes a cloud measurement script, `tools/measure-db-peak.mjs`, its peak quoted in the check report, never a db test.
- openPool's pool-wide 3 s connect timeout (SC11 read 5, amber 1): scope it to inspectIdle, or prove it with a queued-connect pg16 test.
- A named bound for each setup-time admin query (create database, setup listRoles; SC11 read 7); an outer bound always outlasts the steps inside it.
- R119 (no number literal as a time limit) and R120 (no ended or closed flag set inside a try's `finally`) widened from the harness files to src/**, with SC12's rules family.

## Build
Make the spec pass; nothing else.

## Check
The definition of done; pg16 and test:flake as SC11's check ran them.
