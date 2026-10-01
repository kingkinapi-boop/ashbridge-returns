# Lessons

From the client app build (items 1 to 25) and for this autonomous build (26 onward). Phrased for a builder or Lead to follow.

1. A green suite is not a client: walk it on the deployed host, in the mode the client meets, pressing every button including Save without Continue.
2. Every part can pass its own test while the whole is untested: walk the real journey with a real link on a deployed preview before merge.
3. "Matches the spec" is not "usable": ask whether a stranger can finish without calling, and give that question an explicit owner.
4. Write the navigation model, copy and save/back/progress rules as approved documents before building screens; a silent spec gets the minimum.
5. Keep every client-facing sentence in one source; generate the code and tests from it, never transcribe it by hand into code and then test the transcription.
6. Schedule a walk of the journey mid-build while the builder's context is still warm, not only at the end of a wave.
7. Give reviewers one seeded test client with nothing pre-answered; pre-filled answers hide the screens that ask for them.
8. Label test data and test controls in the product's own words, or a reviewer learns the wrong model from the label.
9. Review the firm's internal side as carefully as the client side; the people doing the work are an audience too.
10. Treat a "done" claim as a claim, not a fact, until it is verified with raw output, especially when the claimant reports its own work.
11. Plant a real failure in every check before trusting it; a check that has never seen a failure may be checking nothing.
12. Keep one implementation of any shared logic; copies drift, and only one copy is usually right.
13. Tell builders to verify the premise of a brief before acting on it; the brief is sometimes wrong.
14. Isolating builders in worktrees keeps merges clean but can ship screens that never actually meet; add a journey test and preview walk at merge time.
15. Pin every clock and random value in tests; a test that passes by luck teaches everyone that red means nothing.
16. Keep a migration file out of the migrations directory until it is approved; the test database applies whatever sits there.
17. Write a rule as a rule ("no digit run near a banking word"), not as a patch against the last failing phrasing, or it will fail on the next phrasing.
18. A record is not evidence of state unless it was written by a verification step; a status the claimant sets can sit wrong for days.
19. When a tool guard blocks a correct action, fix the permission rule, never route around the guard.
20. Never let a secret pass through chat, even briefly; anything typed into a conversation must be treated as compromised and rotated.
21. Whatever renders in the mode a reviewer actually uses is client copy for that review, guard label or not.
22. Write down why a value is safe to reuse, not just what it does; two separately-correct later changes can make a silent assumption wrong.
23. Confirm a red test actually ran the assertion you wrote; a failure can come from something else entirely and still look like proof.
24. Redirects and URLs must be built from the forwarded host or be relative; something that differs only on the deployed host is invisible to any local walk or test.
25. When a mode guard exists (test vs. live), write and test the other side on day one, and walk it independently, in the client's mode, before go-live.

## For an autonomous build

26. A builder fills a silent spec with guesses, and guesses drift: make the spec executable (acceptance tests with clause IDs) before anyone builds.
27. Many small questions stall a build and wear out the owner: decide inside the blueprint, log amber, and ask only what would change the blueprint.
28. Comments multiply when each is fixed where it was found: turn each into a rule and a test that runs on every screen and every return kind.
29. Parallel builders collide on shared files: give each card its own paths, and change shared contracts one card at a time.
30. Generated files conflict when several branches regenerate them: only the Lead regenerates them, at merge.
31. A usage limit or a crash loses nothing when NOW.md is written before each dispatch, not after.
32. The Lead's context is the scarcest resource in the build: it reads indexes, reports and tool summaries, never code.
33. A simulator built from the vendor's published rules lets the build run without the vendor; the real proof still happens before go-live, and every simulator rule names its source.
34. A helper that kills a hung browser by name kills Zo's browsers too (1 Oct: every Edge window closed). Kill only the process IDs you started.
