# W00b spec report, round 3 (cloud-f0768b, 3 Oct 2026)

Round 3 closes the 10 gaps of reports/W00b-spec-review.md (A409). Earlier rounds: first spec b6b2120, round 2 0445e9a.

## Tests added
- testworld/model/made-up-data.acceptance.test.ts now holds 504 tests (about 226 new); helpers in testworld/model/__fixtures__/guard/world.ts. Each gap has its own describe ("R3 gap 1" to "R3 gap 10", plus "money" for the card decision); gap 10 (card numbers) is a separate describe so it can move to SC R34.
- Gap 1 kind.ts exports guarded; 2 repeated JSON keys (escaped digits, escaped keys, hidden subtrees); 3 links (outside, dangling, loops, inside folder links); 4 loadClient on a C01 copy with planted pdf, txt, tsv, nested, e-mail, phone, README and outside link; 5 classOf closed (planted keys under every node, record maps 1 to 10); 6 nine digits with every Unicode space and dash separator, 9 placements and JSON keys, with Luhn-fail, date and code controls; 7 declared persons in 6 writings in 4 places; 8 e-mail incl. non-ASCII and full width, reserved domains clean; 9 fail closed (missing path, file path, FIFO, chmod 000, Map, Set, Date, BigInt, function, NaN, Infinity, circular, undefined); 10 card numbers 13 to 19 digits, Luhn-passing refused, failing clean.
- fast-check SEED 20261002, 40 runs. Slow folder tests carry their own 30 s timeout.
- Fails first: on the branch 494 fail by name (guardFolder not exported, guard-fields.ts missing, loadKind ignores root, loadClient does not refuse, properties whose counterexamples show the guard absent), 9 pass (controls), 1 skipped (chmod as root).

## Clauses
SEC-11, ARC-8.

## Validated
Validated on main 2288da55 (merge ad551fa4): typecheck and lint clean; unit project 5544 tests, only the 494 acceptance failures above; db project 545/545; tools/test 197/197. Then merged origin/main 8bbb16d4 (plan and reports only, no toolchain change).

## Step 6b (stub sweep)
Rewritten (contradicted by gaps 3 and 4: loadClient now also refuses an outside link through the guard, so the link test sees a made-up-data issue too; each keeps its own assertion on the non-guard issues):
- testworld/clients/load-files.test.ts:90 "a link that leads out of the folder is refused, for a file and for the parent folder"
- testworld/clients/w00c-load.test.ts:128 "a link out of the folder is still refused as leading out"
- testworld/clients/w00c-survivors.test.ts:55 "a link to the parent folder is \"leads out\", not \"not a regular file\""
Retired:
- testworld/clients/load.test.ts:335 "SEC-11 files by kind: json, csv and md are scanned; other files are not; nested paths use slashes" (contradicts S4 and gap 4: other files are now refused, not skipped; its coverage moved to acceptance "R3 gap 4").
Stub failures not retired (stub choices the API leaves open; the builder adapts): kinds.test.ts "a built kind loads" and "does not pick another" (fs mock lacks statSync), load-order.test.ts:47 (record format), load.test.ts:309 (declared persons beyond answer-key), lookups.acceptance TB-3 C03, C04, C08 (slow stub guard over 6 s: the guard must stay fast).

## Amber choices
- classOf gains a 'money' class; a JSON number at a money path is not a nine-digit candidate, a string there is (card decision).
- An outside link is refused even when its target is clean.
- A top-level string passed to guardValue is free text.
- An ISO date or month next to a number exempts it from the nine-digit rule.
- kind.ts exports are classed by export name as the first path key; a function in an export is refused.
- chmod 000 test is skipped when running as root; the FIFO test covers fail-closed in the cloud.
- Card number reason matches /check digit|card/i.

## Notes for the Lead
- W00c review 3 says to take W00c's copies of load-files, w00c-load and w00c-survivors at merge; that would undo the three rewrites above. Keep the W00b versions or re-apply the made-up-data filter.
- C07, C09, C14 no-false-alarm tests fail until FX8 lands.
- No Paths gap (A414): the tests need only guard.ts, guard-fields.ts, kinds.ts and load.ts, all in the card Paths. A sync loadKind importing kind.ts via createRequire works (proved in the stub).
- Spec commit line on plan/cards/W00b.md left for the Lead (card lives on main).

## Permission gaps
None.

## Model
Opus 5.5.
