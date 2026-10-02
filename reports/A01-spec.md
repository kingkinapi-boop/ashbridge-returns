# A01 spec refit: released (cloud-1452fe)
The refit needs `readOwnSource` from DG round 3 (`src/core/testing/read-own-source.ts`), which is not on main yet (train DG is still checking). Without it the refit cannot be written or validated. Nothing changed in the tests. Re-offer after DG lands.
