# FX2 spec refit
- Merged origin/main 0f7e1cc4 into claude/FX2; every assertion kept. Old validated sha 77648178.
- validated on main 0f7e1cc4: typecheck and lint clean; npm test 2570 pass, 1 fail: src/modules/storage/engine-setting.test.ts ARC-20 (auth/index.ts still reads process.env; intended, the round 2 build fixes it).
- Retired tests: none.
## Permission gaps
none
## Model
Sonnet 5.5 (refit only, no new assertions)
