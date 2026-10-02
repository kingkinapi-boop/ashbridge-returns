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
