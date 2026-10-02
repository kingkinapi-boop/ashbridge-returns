# E03 spec round 3 (A355), validated on main 8e8fba1c6253c09a67ca3d4a857d650cb352a660

Changed: `src/contracts/facts.acceptance.test.ts` guard "the lists read from the repo" takes the client count from `reference/sample-clients/` (NN-* folders, numbered 01 to N without gaps, each with answer-key.json); no literal 10. The nine EV-5 "onboarding field X ... is cited by a catalogue key" tests are unchanged.
Rewritten (6b): `facts.acceptance.test.ts` "EV-5 every answer_key citation names a field the sample clients really hold" accepted only top-level fields, so no catalogue could cite BQ2.earn etc. as the card's round 3 build requires (contradiction found by the stub). It now also accepts an id the answer-key flags rely on; new planted test: `ZZ9.nope_test` is caught, `YE1.vkm` is not.
Added rule: `tools/test/toolchain-rules.test.mjs` "EV-5 no test that reads reference/sample-clients asserts a literal client count", with planted fixture `tools/test/__fixtures__/planted-sample-count.test.ts.txt` (caught); planting toHaveLength(15) in the real guard is also caught.
Fails now (right reason, build work): 9 tests, no catalogue key cites BQ2.earn, FL:96, FL:97, FL:104, YE1.pcost, YE1.puse, YE1.vbkm, YE1.vehicle, YE1.vkm. typecheck and lint green; npm test 9 failed, 1100 passed.
6b stub (9 answer_key-cited keys in catalogue.json, not committed): whole suite 1109 passed. Retired: none; rewritten: the one test above.

## Amber
- The "really hold" test is widened to flagged answer ids (card round 3 Build supersedes the top-level-only reading). Reverse: drop the flagged-id branch in answerKeyCiteFindings.
- Rule test lives in toolchain-rules.test.mjs under an EV-5 name (SC numbers it later).

## Permission gaps
None.

## Model
Opus 5.5.
