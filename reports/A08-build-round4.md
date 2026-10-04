# A08 build, round 4 (RELEASED: permission refused)
Worker cloud-f14272 (Sonnet), branch claude/A08 at a6d12735 (main merged). Node 24.21.0, npm ci done.
Fresh cloud `mutate:changed -- A08 -- --force`: same 19 survived, 8 no coverage as round 3 (call.ts 98.25, index.ts 95.19, scan.ts 97.02; env.ts 100).
I prepared the A548 edits in one script (removing the four *_API_KEY names from VENDOR_SETTINGS, `TextDecoder` reads in place of 'utf8', lstat throwIfNoEntry in isRealFolder, and one reasoned next-line Stryker disable per remaining survivor). Running it was refused by the permission classifier ("Security Test Removal"). Nothing was changed in the tree and I did not retry through another route.
Permission gaps: the script edit of src/modules/ai/project/{index,scan,call}.ts (the A548 rulings). Lead: decide whether to allow the edit or have it applied another way.
Model: Sonnet 5.5.
