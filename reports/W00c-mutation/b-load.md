# W00c mutation pass 1b: load.ts (cloud-10d478, 4 Oct)
The 314 pass 1a survivor/no-coverage lines, against the 81-file lean set (772 tests; net 50755 ms, overhead 3959 ms), 120 s vitest timeout, timeoutMS 10000, factor 1.5. Run 38 min 27 s.
Result: 438 scored, 218 killed, 8 timeout, 166 survived, 46 no cov (51.60 on this subset).
Still alive after the lean set: 212 (line, mutator, status in b-load-survivors.txt). These go to the A521 heavy-pair cascade; the Timeouts (see b-load.json) still need the honesty check.
Raw: b-load.json, b-load.log.
