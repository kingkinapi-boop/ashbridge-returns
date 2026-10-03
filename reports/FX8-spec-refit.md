# FX8 spec refit (cloud-0ac9e9, 3 Oct 2026)
Branch claude/FX8-r2. Merged origin/main 66de2c9 into spec a9dd4aa3; no assertion changed; old validated sha unknown (refit), new 66de2c9.
typecheck and lint clean. Unit project: 2794 of 2797 pass, the 3 failures are sample-names.test.mjs (SEC-11, folders 07, 09, 14) for the planted-fix reason. verify.mjs: 551 passed, 5 failed = those 3 SEC-11 lines plus the two R11 lines (README count 556 vs run 552/553 until the build regenerates folders). 551 + 5 = 556, so the README count stays correct once the build lands; no README edit.
Permission gaps: none. Model: Sonnet 5.5.
