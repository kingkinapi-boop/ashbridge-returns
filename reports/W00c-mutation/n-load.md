# W00c mutation, session 1, pass 1a: load.ts (cloud-c7a694, 4 Oct)

Method (A538): `--testFiles` load.test, load-files.test, w00c-load.test, w00c-survivors.test, model/generate.test, model/kinds.test; related true; 120 s vitest timeout in the overlay; timeoutMS 10000, factor 1.5; scratch overlays vitest.scratch.mjs and stryker.scratch.mjs (A533's vitest overlay with 120 s, and a stryker config mutating testworld/clients/load.ts; both deleted after).
Dry run: "Initial test run succeeded. Ran 116 tests in 23 seconds (net 20603 ms, overhead 2433 ms)". T = 1.5 x 20603 + 10000 + 2433 = about 43 s. Whole run 30 min 3 s, no stall.

| File | scored | killed | timeout | survived | no cov | score |
|---|---|---|---|---|---|---|
| load.ts | 898 | 584 | 0 | 258 | 56 | 65.03 |

No Timeouts, so nothing for the honesty check. Pass 1a only: survivors and no-coverage lines (314) are in n-load-survivors.txt (line, mutator, status) for pass 1b against the lean set and the heavy pairs. Mutation JSON: n-load.json.
Not done: the other 9 targets (guard, money, kinds, schema, checks, faults, generate and the two index.ts).
