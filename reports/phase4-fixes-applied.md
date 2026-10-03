# Phase 4 card review: fixes applied, 3 Oct 2026

From `reports/phase4-card-review-2026-10-03.md` (AMBER A447). One line per FIX.

- C1, B06, T10, T11, V10, V11, N01, GL3, GL4: done. B06 line 3 and Check add the security review; T10 and T11 line 3 add the Opus read (T11 now "Where: cloud", hard stays false; T11 Check "Opus read"); slices: V10 security and core, V11 security, N01 security (card line 3 and Check add the security review), GL3 security and core, GL4 core.
- C2, T11, V02, T13, cpa-check: done. `reference/cpa-check.md` items 34 (federal tax on the approval summary, covers V02) and 35 (T13's notice mapping, full list once W29's shape is fixed); T11 line 34 maps `federal_tax` to the CPA check's key, `part1_tax` with `cpa_check: pending` until then; V02 line 19 points to the same item.
- C3, N19, GL2 to GL6, GL1: done. No card files written; review points in each slices note. N19 paths set; GL2 deps add T14 and LIVE-9 dropped; GL4 deps add FX9; GL6 deps add FX11; GL3 and GL5 notes. LIVE-8: line on GL1's "Not in this card" plus the A447 row (go-live run owns it).
- C4, FX3: done. FX3 note: lands before the first phase 4 build (FX3's Paths not narrowed). No card change for handlers.ts, as the review says.
- C5, GL1, GL6, N20, T11, T14: done. Each go-live RED in its card's slices note.
- C6, PHASES: done. Row 4 names the go-live switch and drafts (GL1 to GL6), all off.
- 1, T13: done. Line 25 replaced; a planted unreadable copy added to the fixtures.
- 2, T14: done. No state event at creation; the link row is the creation record; `returns.bridge_returns` row through F07; spec-job report sentence dropped; golden file the link row only.
- 3, T14: done. Columns `original_return_id` and `amended_return_id`, no `return_id`; T10's sweep sentinel sentence.
- 4, V10, T14: done. New returns lists returns before `review` with no preparer; amended return fixture; T14 line 22 adds the line.
- 5, T11, T14: done. `list_version` across returns, original's `sent` rows to `closed`; T14 line 21 one `sent` list per engagement.
- 6, T14: done. Not-in-this-card line reworded.
- 7, T10: done. Manifest adds B06 recheck records, X00 answers and V03 risk judgments, preparer signs.
- 8, T10: done. `returns.jobs` reason at lines 20 and 32.
- 9, T11: done. `recordT183Sent` refused while a summary line is unconfirmed.
- 10, T11, V10: done. Certificate `checked` column with a CHECK list; V10 line 24 shows the flag on the T183CORP page and the Ops queue row.
- 11, V10: done. Ops queue lists `assessed` with open follow-ups; property covers it.
- 12, V10: done. Previous preparer loses access; planted keep-old-row case.
- 13, V11: done. Two decimals, basis points / 100, no rounding; D10's page wins.
- 14, N01: done. Fixtures through `saveVersion`, `closed` fixture dropped; line 25 catalog scan; Check "the catalog scan green".
- 15, N01: done. Pairs across a void take the void source's stage; exhaustive class rule.
- 16, N01: done. END-5 in card and slices clauses.
- 17, N01, family cause: done. Stubs in every `causes/<cause>/index.ts` (Paths in card and slices), planted set in `causes/_core/__fixtures__/`; family line 9 and acceptance 1 and 2.
- 18, N20: done. Unconfirmed, `none yet` and `conflict` grouping.
- 19, N20: done. Dating rule per measure and the Monday boundary.
- 20, N20: done. `tools/lessons.mjs` takes paths, tests on a temp copy, never this repo's `plan/` during the build.
- 21, J6: done. Deps add N19 (slices; family card).
- 22, GL1: done. Deps add SC3, SC5, SC11, FX7, FX10, FX11, FX13 (card line 3 and slices).

Not applied: RED 1 (left as the review states, on T11 and T14 notes); the "binder frozen" screen gap (a recommendation for D09's brief, not a FIX item; the Lead decides).
