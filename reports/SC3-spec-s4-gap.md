# SC3 spec round 3, S4: Paths gap (A414), cloud-3c6766

S1 to S3 were already done at 3e27033a. S4 (auth imported only inside tests, afterAll vi.resetModules) is done in reports/SC3-s4.patch (security-rules.test.mjs guard plus db test change). Alone it makes test:flake fail 5 of 5 on pg16: vi.resetModules() resets src/core/db/index.ts (`active`, `clones`, `dbCounter` are module level), so the next file builds a second template with the same name ("database ... already exists"). Keeping that state on globalThis in src/core/db/index.ts passed 15/15 files on a shuffled pg16 run (698 pass, 1 skipped); that file is outside SC3's Paths.
Lead decision needed: add src/core/db/index.ts to SC3 Paths (or an FX card), or choose another way (A06's file, vitest config). No new amber.
