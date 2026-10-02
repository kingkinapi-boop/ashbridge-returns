# SC build (released again, cloud-a03a3e, 2 Oct)

Branch claude/SC with main 3df2e9b merged. No product code written: SC is rules only and the builder cannot edit the tests. 7 of 65 still fail (unit 4 of 48, db 3 of 17), all on defects in files other cards own ("added to that card, never fixed here"). The KNOWN list has no entry for any of them.

- F01 (db/schema): R12 `returns.returns` refuses UPDATE/DELETE but not TRUNCATE. R15 `returns.exceptions.status` has no CHECK list. R43 `*_id` columns pointing at unbuilt tables are not in FUTURE_POINTERS.
- records.ts owner (F09/F01): R15 `ExceptionRecordSchema.status` not an enum of a list. R23 stray keys accepted at top level in about 22 schemas (use `.strict()`); FactRecordSchema and others lack a valid sample in R23_SAMPLES (a spec job adds them).
- src/modules/gaps owner: R18 `gaps/index.ts` lacks `// @mutate`. R41 `gaps/bank/index.ts` uses `.trim()` and `z.string().min(1)`.
- src/contracts/ai.ts owner: R41 `.trim()` and `z.string().min(1)`.

Needed from the Lead: add each defect to its owning card (or KNOWN entries with owners via a spec job), then re-offer the SC build. Re-offering without that gives the same result.

Amber: none. Permission gaps: none. Model: Sonnet 5.5.

## Re-run 2 Oct (cloud-dea37c), main 3df2e9b merged
Unchanged: unit 4 of 48 fail (R15, R18, R23, R41), same files and owners as above (records.ts, gaps/index.ts, gaps/bank, ai.ts, F01 schema for the db three). Released again; nothing for a builder to do until the owning cards carry the defects.

## Re-run 2 Oct 18:50Z (cloud-c520ec), main 8806c6c..f86ad4d merged
Unchanged: unit 4 of 48 fail (R15, R18, R23, R41), db 3 of 17 fail (R12, R15, R43), same owners as above. Released; nothing for a builder to do until the owning cards carry the defects or a spec job adds KNOWN entries.

## Re-run 2 Oct 19:40Z (cloud-14c055), main 50608a1 merged
No code changed on main since the last run (plan/ and reports/ only). Same 7 failures, same owners; not re-run. Released; re-offer only after the owning cards carry the defects or a spec job adds KNOWN entries.

## Run 2 Oct 19:58Z (cloud-7c1598), main fae1588 merged, spec 34e8ac0 (94 rule tests)
No product code written (rules only). Unit 3 of 75 fail, db 5 of 19 fail; db reasons not itemised (R13, R15, R42, R43, R44, same F01 schema owners as above).
New since the spec was validated on 6d8efd6: F06 and F07 landed and are not in KNOWN:
- R16 src/modules/jobs/queue.ts (F06): two `order by created_at, id` queries with no identity seq first.
- R23 src/contracts/jobs.ts (F06): JobSchema accepts a stray key at the top.
- R41 src/modules/bridge/run.ts (F07): a `.trim()` blank rule (go through src/contracts/text.ts).
Needed from the Lead: add these to F06 and F07 (or KNOWN via a spec refit), and the older F01/records.ts/gaps/ai.ts defects to their cards; re-offer only then.
Permission gaps: none. Model: Sonnet 5.5.

## Run 2 Oct 20:10Z (cloud-3e2f84), main e77ffc5, no new commits since the last run
Nothing changed on main; same defects (F01 schema, records.ts, gaps, ai.ts, F06 queue.ts and jobs.ts, F07 run.ts) are not on their owning cards or in KNOWN. Not re-run; released.

## Run 2 Oct (cloud-de3dc1), main 3a... no product code changed since e77ffc5
Same seven or more failures, same owners (F01 schema, records.ts, gaps, ai.ts, F06 jobs, F07 run.ts) are not on their cards or in KNOWN. Not re-run; released. Re-offering SC without the Lead adding these first only repeats this (six releases so far).

## Run 2 Oct 20:2xZ (cloud-1fe112), main 0d4448e merged
Unit 3 of 75 fail, the same three as the 19:58Z run: R16 (F06 queue.ts), R23 (F06 jobs.ts and others), R41 (F07 run.ts). Rules only; nothing for a builder to change. Released; do not re-offer until those defects sit on F06/F07/F01/records.ts/gaps/ai.ts cards or in KNOWN via a spec refit.
Permission gaps: none. Model: Sonnet 5.5.

## Run 2 Oct 20:2xZ (cloud-2cbd52), main e7abd12
No product code on main changed since cloud-1fe112 (only plan/train and reports); same failures and owners. Not re-run; released. Re-offer only after the owning cards carry the defects or a spec refit adds KNOWN entries.
Permission gaps: none. Model: Sonnet 5.5.

## Run 2 Oct 21:15Z (cloud-b4d2b5), main 042c2dd merged, spec ee0255d
No product code written (rules only; tests not mine to edit). Unit 2 of 75 fail, db 19 of 19 pass. KNOWN entries from the spec work; the two failures are new on main (src/modules/ocr/recorded landed after the spec was validated):
- R34: `src/modules/ocr/recorded/__fixtures__/one-page.pdf` and `unrecorded.pdf` are binary fixtures not on BINARY_FIXTURES (needs a reasoned entry).
- R47: `src/modules/ocr/recorded` is a reader adapter with no entry in the READERS registry.
Needed: a spec refit adds both (test-file edits), then re-offer the build. Released.
Permission gaps: none. Model: Sonnet 5.5.

## Run 2 Oct 21:20Z (cloud-0c9d3d), main merged (up to date)
No product code written. Unit 2 of 75 fail, db 19 of 19 pass; same two as cloud-b4d2b5, both from src/modules/ocr/recorded (A03): R34 (one-page.pdf and unrecorded.pdf need reasoned BINARY_FIXTURES entries) and R47 (recorded adapter missing from the READERS registry). Both are edits to the test file, which the builder may not make. Released; needs a spec refit, then re-offer.
Permission gaps: none. Model: Sonnet 5.5.

## Run 2 Oct 21:3xZ (cloud-a181cc), main ae7deb6 merged
No product code written. Unit 2 of 75 fail (same as cloud-0c9d3d): R34 (A03 one-page.pdf and unrecorded.pdf need reasoned BINARY_FIXTURES entries) and R47 (src/modules/ocr/recorded missing from READERS). Both are test-file edits, so a spec refit is needed before re-offering. Released.
Permission gaps: none. Model: Sonnet 5.5.
