# CQ8 spec, rule 3 round (cloud-613a54)
Added 5 tests to tools/test/next-paths.test.mjs (13 total): local-* refused spec, build and check of Where "cloud (...)" and "cloud." cards; offered "cloud, then one laptop run" and "local or cloud"; a cloud worker still offered the cloud cards; next.mjs tags only cloud-only cards. Clause ARC-15.
Fault plant: with claim.mjs rule 3 disabled 3 tests fail; with the next.mjs tag disabled 2 fail. On the build, 13 of 13 pass (rule 3 code reads correct, per the check).
Validated on main 2bb7db20: typecheck, lint, tools tests 393 of 393. Step 6b retired tests: none.
Amber: where-field reading differs between claim.mjs and next.mjs (check amber 1): untested, no card has `where` in slices.json.
Spec commit b7913ddb.
