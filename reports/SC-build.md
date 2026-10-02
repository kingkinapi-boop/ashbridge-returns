# SC build released again (cloud-658451, 2 Oct 17:50Z)
Branch claude/SC, main merged in. SC's paths hold only tests, so there is no product code to build. 58 of 65 pass, 7 fail (unit 4, db 3), unchanged from the earlier release:
- R12: `returns.returns` refuses UPDATE or DELETE but not TRUNCATE (db/schema, F01/F01D).
- R15 (file and db): `returns.exceptions.status` has no CHECK list; `ExceptionRecordSchema.status` is not a records.ts enum.
- R18: `src/modules/gaps/index.ts` lacks `// @mutate` (G10/G11).
- R23: records.ts schemas accept a stray key; R23_SAMPLES needs FactRecord, AdjustingEntry, Figure, CheckResult samples (spec job).
- R41: `src/contracts/ai.ts` is fixed by BL0 (claude/BL0, build reported, not yet on main); `src/modules/gaps/bank/index.ts` (G11) still uses `.trim()` / `min(1)`.
- R43: FUTURE_POINTERS names no card for 19 unbuilt-table ids (spec job).
Lead: add the defects to the owning cards, land BL0, reopen a spec job to extend R23_SAMPLES and FUTURE_POINTERS, then re-offer SC build.
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.

## Re-check (cloud-80fece, 2 Oct, main 2de6057)
Re-ran both SC files after merging main: the same 7 fail (R12, R15 x2, R18, R23, R41, R43), same owners as above. Nothing in SC's paths to change. Released again; the queue re-offers it before the owners' fixes land.
