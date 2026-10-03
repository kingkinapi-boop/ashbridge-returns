# A07D Opus adversarial read (origin/claude/A07D vs origin/main)

Reviewer: Opus, read-only. Scope: src/modules/sheets/xlsx/raw.ts, src/modules/sheets/xlsx/index.ts (src/contracts/sheets.ts unchanged). The probes are standalone copies of `slide`, `numberText` and `snapSums` run with node --experimental-strip-types (scratch at /tmp/claude-0/a7/x/).

## Verdict: PASS for money in the realistic domain. No wrong figure passes silently below $10 trillion. Five findings below. Three of them are D1 or D2 class failures that the landing rule routes to fallback or SC.

## D3 number text: holds
I fuzzed 2,000,000 random double bit patterns and 2,000,000 cent values up to 1e15. There were 0 violations: each text maps back to the same double or to a cent within 4 ulps, a nonzero value never reads "0", and no text has more significant digits than String(x). 1e23 reads "1e+23", 5e-324 reads "5e-324", -0 reads "0" and 0.004999 reads "0.004999".

## D2 nested SUMs
1. **A wrong cent text at 16 or more significant digits (money, out of the realistic domain).** index.ts:187-190 writes `String(Number(sum.cents)/100)`. For totals of 1e13 or more (16+ significant digits), the shortest round-trip text is not the exact cent total, and the half-cent guard still passes. Out of 200k random two-term sums near 1e13 to 1e14, 39,889 snapped to a different cent. Examples: `46897341535815.55 + 437.05` (exact 46897341536252.60) reads `46897341536252.59`, and `70536846574112.62 + 977.39` (exact ...090.01) reads `...090.02`. Fix: snap only when `String(total)` equals the bigint cent text, so values above the band keep their own text. Below 1e13 it is exact (15 digits always round-trip).
2. **A cycle member is missed (spec S5 deviation, no money effect seen).** index.ts:226 marks only the stack segment on a back edge. A SUM that joins the cycle through an already finished node is never marked. Input: A1=`SUM(A2:A3)`, A2=`SUM(A1:A1)`, A3=`SUM(A2:A2)`. A3 is in the cycle A3->A2->A1->A3 but gets `inCycle=false` and is snapped. Use SCCs (iterative Tarjan) to fix it. A cycle that runs through a non-SUM formula (A1=`SUM(A2:A3)`, A2=`A1*1`) is not detected either. Both snap only against the terms' cached text, so neither is a wrong figure.
3. **Quadratic time on running balances (a budget failure, not money).** termCells (index.ts:144-147) walks every range in full. A ledger running balance `SUM($A$1:A<r>)` takes 0.6 s at 2k rows, 3.2 s at 5k and 16 s at 10k (about 65 s at 20k), which exceeds the 30 s S6 budget. The S6 test uses a linear shape (`SUM(C(r+1):D(r+1))`), so it does not catch this. `SUM(A1:XFD1048576)` matches SUM_RANGE and loops about 1.7e10 times, so the read effectively hangs. This was already true in A07C. Fix: walk only the existing cells that fall inside the range (bounded by sheet extent), or cap the range area and leave such a SUM unsnapped. Add it to SC as a rule test.

## D1 shared-formula sliding (formula text only; the cached value stays right)
4. **Structured-reference escapes.** closeBracket (raw.ts:100) ignores the `'` escape. `slide("Table1[Col'[1]+A1","C1","C2")` returns it unchanged, where it should give `...+A2`. The unbalanced `[` swallows the rest of the formula.
5. **Name-versus-reference edges.**
   - (a) A name that looks like a reference past XFD becomes #REF! (raw.ts:69,88). `slide("XYZ100*2","C1","C2")` returns `#REF!*2`, where it should stay `XYZ100*2`. This holds even for a (0,0) slide, because the bounds check runs on every part.
   - (b) Non-ASCII name characters: WORD (raw.ts:76) is ASCII-only. `slide("ÜB1*2","C1","C2")` returns `ÜB2*2`.
   - (c) Unquoted 3D sheet range: `slide("SUM(Q1:Q4!B1)","C1","C2")` returns `SUM(Q2:Q4!B2)`. AREA backtracks to `Q1` because `:` is allowed after it. Excel normally quotes such sheet names, but third-party writers may not.

   All of these are wrong formula text with the right cached value. A citation would say "differs" at worst.

These checked cases gave the right text: quoted names with `''`, `'Q4 FY2026'!B1`, `A:A`, `$A:A`, `1:1`, `Sheet2!B1`, `[1]Sheet1!A1`, `Sheet1:Sheet3!A1`, strings with `""`, `1.5E+3`, `LOG10(`, `_xlfn.`, spill `A1#`, intersections, off-grid becoming #REF!, and `A$1` and `$A` mixes.

## Landing-rule routing
- Items 4 and 5 are inside D1 (bracket and name text must not change). Either take the D1 fix (the WORD regex allows Unicode letters, closeBracket honours `'` escapes, a reference past XFD or row 1048576 is a name, and a reference followed by `:` plus a sheet-qualified part is a name) or take the `sharedFrom` fallback.
- Item 1 is a one-line guard inside D2.
- Items 2 and 3 go to SC (R68 visit order and cycles, plus a new rule on range-size and time bounds).
