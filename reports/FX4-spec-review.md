# FX4 spec review (Opus, cold): GAPS

Reviewed: plan/cards/FX4.md (Lead note A432), reports/A07D-opus-read.md, reports/FX4-spec.md, spec commit 63df226e (fx4-sums and fx4-slide acceptance tests, fixtures fx4.ts and fx4-worker.mjs, KNOWN removal in tools/test/reading-rules.test.mjs). Read against src/modules/sheets/xlsx/index.ts and raw.ts on main.

## What is right
Every finding has its Opus read input. The tests run through the public reader. The SCC oracle shares no code with the reader. The whole-sheet range puts terms at XFD1048576, so clipping the walk to the sheet's extent cannot pass. The `'` escape property is a real class. Removing KNOWN entries makes R67, R68, R70 and R74 fail by name, which is the intent. I agree that item 1 cannot be reached through the reader: when the snap fires, its text is the cell's own text.

## Gaps (a wrong build passes, or one example stands in for a class)
Probes ran on scratch copies of raw.ts. The main checkout was not touched.

1. **5b is tested by example, and a known wrong build passes it.** I made `WORD` Unicode-aware (`/[\p{L}_\\][\p{L}\p{N}_.]*/yu`) and changed nothing else. That build passes all 576 combinations of the spec's generator (the accent always sits before the digits). It still slides `B1Ü*2` to `B2Ü*2`, because `NOT_NAME_AFTER` is ASCII-only, and `ÉB1*2` to `ÉB2*2`, because a combining mark is not \p{L}. Add property seed 20261038. Draw name characters from non-ASCII \p{L}, \p{M} and \p{N}, including astral code points (U+1D400, U+20000) and combining marks (U+0301, U+0308). Place them before, inside and after a cell-shaped core: `${cell}${u}`, `${letter}${mark}${cell}`, `${u}${cell}${u}`. Assert `slidesOnlyTheCell(\`${name}*2\`, c, m)`. Add `B1Ü*2`, `ÉB1*2`, `税B1*2` and `𝐀B1*2` to the OPUS table so they also run through the reader.
2. **5c has one shape.** On main `SUM(Q1:Dec!B1)` gives `SUM(Q2:Dec!B2)`. The generator only draws cell-shaped sheet names and a single cell after `!`. Extend seed 20261037. Draw s1 and s2 each from {cell-shaped, word (`Dec`, `Jan2`), off-grid (`XYZ100`), four letters (`ABCD1`)}. Draw the part after `!` from {`B1`, `$B$1`, `B1:C3`, `$B1:C$3`}. Expect the sheet names unchanged and the part after `!` slid as a reference. Add the single-sheet form `Q1!B1`.
3. **5a stops at ZZZ.** Add columns of 4 to 7 letters (`ABCD1`, `TAXRATE1`). Add cell-shaped prefixes that run on into a name (`TAX2026A`, `A1_B`, `A1.B2`). Each must stay unchanged. Main passes these. They guard the AREA and NOT_NAME_AFTER rewrite that gap 1 forces.
4. **Item 2 has one non-SUM edge shape (`A<n>*1`).** A build that finds edges with a cell regex over the formula text passes this. Such a build misses the inner cells of ranges in other functions, and it links `Other!A1` to this sheet. Add these node kinds to the generator, with every cell of every range as an oracle edge: `$A$<n>+0`, `IF(A<n>>0,A<n>,0)`, `ROUND(A<n>,2)`, `AVERAGE(A<lo>:A<hi>)`, `SUM(A<lo>:A<hi>,0)` (SUM_RANGE does not match it), `'Cells (Test)'!A<n>*1` and `SUM($A$<lo>:$A$<hi>)`. Add two examples on a two-sheet fixture:
   - A cross-sheet cycle: A1 `SUM(A2:G2)`, A2 `Other!A1*1`, Other!A1 `'Cells (Test)'!A1*1`. A1 keeps its own text.
   - The same without the cycle (Other!A1 = 5). A1 snaps, so no false cycle.
5. **Item 2 never needs iteration.** The graphs have at most 6 nodes, so a recursive Tarjan passes. The A07D 20k chain has only SUMs and no cycle. Add in-process tests:
   - A 50,000-cell ring: A1 `SUM(A2:G2)`, A<r> `A<r+1>*1` for r = 2 to 49,999, A50000 `A1*1`. The read must not throw, and A1 keeps its own text.
   - A 50,000-SUM chain closed into a ring.
6. **Item 2 checks only one direction.** A build that unsnaps every SUM that reaches any non-SUM formula passes both the property and example 3. Add property seed 20261039 over acyclic graphs (edges only to later rows), with Excel-true cached values computed bottom-up. Every SUM with terms reads the exact cent total of its terms as read.
7. **Item 3's whole-sheet range accepts the own text.** That lets an area cap (never snap a wide range) pass. Six existing cells are far below any budget. Pin `253914.88` exactly. Add `SUM(A2:A1048576)` and `SUM(A2:XFD2)` over six cells, both exact.
8. **Item 3 uses wall time where a work count is possible, and "with a reason" is not pinned.** The R74 cases run at the same time in workers (Promise.all) beside the other test files. On a 2-core cloud box a correct but slow build can miss the 30 s budget, which would be a flaky test. No contract change is needed. Export `snapSums(cells, limit = SUM_WORK_LIMIT)` from xlsx/index.ts, returning `{ visits: number; skipped: { row: number; column: number; reason: 'reference cycle' | 'over the work limit' }[] }`. Test it in-process with no clock:
   - (a) For the 20k running balance, `visits <= SUM_WORK_LIMIT + cells.length`. Every balance not skipped reads exact cents. Every skipped balance reads its own text with reason `over the work limit`.
   - (b) The whole-sheet range has `visits <= cells.length` and nothing skipped.
   - (c) 20k rows of `C<r> = SUM($A$1:$B$20000)` (8e8 visits if walked naively) stay within the limit.
   - (d) Cycle members are skipped with reason `reference cycle`.
   - (e) `SUM_WORK_LIMIT >= 1_000_000`. Every balance k with k(k+1)/2 <= limit reads exact (replaces "the first 100", which a tiny limit passes).
   - Keep the two worker tests as smoke tests.
9. **The Lead note's merge refusal is not pinned.** R74 accepts either a kept merge or a refusal. Add an acceptance test run in the worker, inside 10 s:
   - A merge whose total area is over the cap is refused (`ok: false`): one `A1:XFD1048576`, and 2,000 merges of 1,000 cells each. The reason names the merge, and is not a library message or the file name.
   - A merge well under the cap (`A1:XFD1`, 16,384 cells) reads.
   - Lead to choose the cap and log an amber row (the stub used 1,000,000 cells per workbook).
10. **Item 1 is unobservable, so its fix line becomes an equivalent mutant**, which conflicts with mutation 100. Verified: `String(Number(7053684657509001n)/100)` is `70536846575090.02`. Export a pure `centText(cents: bigint): string | undefined` and test it:
    - `centText(7053684657509001n)` is undefined.
    - `centText(4689734153625260n)` is `'46897341536252.6'`.
    - Property: result is undefined or `textCents(result) === cents`, and every |cents| < 1e15 gives a text (so "never snap" fails).
    - In both item 1 properties, draw the exponent from 12 to 17 (log-uniform). Today about 90% of draws sit above 1e16 cents.
11. **ARC-10 is cited but not tested, and its tag sits on the item 3 time tests.** FX4 changes derived text (cycle members, slid formulas, skipped SUMs), but `engine` stays `exceljs 4.4.0`. A pointer read before FX4 and one read after cannot be told apart. Lead decision (amber), two options:
    - Recommended: `engine.version = \`${XLSX_LIBRARY.version}+${READER_RULES}\``, with a test that it is not the bare library version. Any A07 test that pins `4.4.0` is updated by a spec job.
    - Drop ARC-10 from the card's clauses.

## Order for the spec patch
Do 1, 2, 4, 7, 9 and 10 first: today a wrong build passes these. Then 8 (flaky budgets and the reason), 5, 6 and 3. Gap 11 waits for the Lead's call. Run each new test on main and on the spec writer's stub. Every test must fail on main for the stated reason, except the guards in 3 and 6, which pass on main by design.
