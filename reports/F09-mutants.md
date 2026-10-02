# F09 mutation survivors, round 4 (spec worker cloud-ce4873, 2 Oct 2026)

Run: Stryker 10.0.0 on `src/contracts/reading.ts` only, non-incremental, JSON reporter to scratch (not committed), on branch `claude/F09-spec4` = build `claude/F09` (94bad03) merged with origin/main 8ebaa97.

- Before the round 4 tests: 76.29 (381 killed, 2 timeout, 110 survived, 9 no coverage). Same as reports/F09-check.md.
- After the round 4 tests (spec only, no product change): 88.45 (442 killed, 2 timeout, 55 survived, 3 no coverage). Every clause mutant is killed; the 58 left are exactly the internal and equivalent rows below (mutant ids are stable between the two runs: same source).

## Counts

| Class | Count | Who acts |
|---|---|---|
| clause | 61 | spec (this round): acceptance tests "... r4 ..." in `src/contracts/reading.acceptance.test.ts`; all 61 now killed |
| internal | 29 | builder: unit tests in `src/contracts/reading.test.ts` (or delete the code the card does not need) |
| equivalent | 29 | builder: remove by rewrite, or `// Stryker disable next-line <mutator>: <reason>` |

Classes: **clause** = observable behaviour EV-5, EV-6 or ARC-10 demand as the card states it; **internal** = observable but not settled by a clause or the card (message texts, zod issue shape, grammar choices that belong to F09A); **equivalent** = no input changes any outcome (or changes only which of two reasons a refusal gives, with neither reason specified).

## Choices made (amber, for the Lead)

1. A word whose centre lies exactly on the box edge is inside (closed box), pinned as clause (206 to 216). The card says "centre lies inside"; the build is inclusive; the earlier property test avoided edges.
2. Two word boxes that only touch vertically are different lines (368, 372), pinned as clause under "same line".
3. A zero-size page is refused with RangeError for every rect (98 to 116), the same error type as check 18; a sliver rect within the 1e-9 edge tolerance otherwise produced a box (zero height) or a ZodError from NaN (zero width).
4. Grammar choices the card does not state ("$$5.00", "-5.00 CR", unbalanced brackets) were split: unbalanced brackets read as a different amount ("(15.05" as -15.00), so clause; two dollar signs and CR with a minus are refused by the build but the card is silent, so internal (F09A owns the grammar and may replace these).
5. Pages listed out of order ([2, 1]) are accepted by the build (sorted); the card does not settle order, so internal.

## Every survivor and no-coverage mutant

| Id | Status | Line | Mutator | Original -> mutant | Class | Why, and what kills or removes it |
|---|---|---|---|---|---|---|
| 9 | survived | 19 | EqualityOperator | `b.left + b.width <= 1 + EPS` -> `b.left + b.width < 1 + EPS` | equivalent | float tolerance boundary (exactly 1+EPS or -EPS): no clause behaviour at 1e-9. Rewrite without EPS on that comparison or disable comment with reason |
| 14 | survived | 19 | EqualityOperator | `b.top + b.height <= 1 + EPS` -> `b.top + b.height < 1 + EPS` | equivalent | float tolerance boundary (exactly 1+EPS or -EPS): no clause behaviour at 1e-9. Rewrite without EPS on that comparison or disable comment with reason |
| 18 | survived | 19 | ObjectLiteral | `{` -> `{}` | internal | BoxSchema refine message text; no clause fixes it. Unit-test the message or make it a checked constant |
| 19 | survived | 20 | StringLiteral | `'box runs off the page'` -> `""` | internal | BoxSchema refine message text; no clause fixes it. Unit-test the message or make it a checked constant |
| 25 | survived | 43 | MethodExpression | `z.string().trim()` -> `z.string()` | clause | ARC-10 blank stamp: spaces-only name or version accepted (test "ARC-10 r4 ... only spaces") |
| 27 | survived | 44 | MethodExpression | `z.string().trim()` -> `z.string()` | clause | ARC-10 blank stamp: spaces-only name or version accepted (test "ARC-10 r4 ... only spaces") |
| 30 | survived | 52 | ObjectLiteral | `{ offset: true }` -> `{}` | internal | readAt accepts an offset; the clock gives Date and producers write Z. Unit-test the offset case or drop offset:true |
| 31 | survived | 52 | BooleanLiteral | `true` -> `false` | internal | readAt accepts an offset; the clock gives Date and producers write Z. Unit-test the offset case or drop offset:true |
| 42 | survived | 60 | ObjectLiteral | `{` -> `{}` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 43 | survived | 61 | StringLiteral | `'custom'` -> `""` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 44 | survived | 62 | ArrayDeclaration | `['words', i, 'box', 'page']` -> `[]` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 45 | survived | 62 | StringLiteral | `'words'` -> `""` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 46 | survived | 62 | StringLiteral | `'box'` -> `""` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 47 | survived | 62 | StringLiteral | `'page'` -> `""` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 48 | survived | 63 | StringLiteral | `'page ${String(w.box.page)} is beyond the page cou` -> `''` | internal | zod issue shape for a word beyond pageCount (code, path, message); refusal itself is pinned. Unit-test the issue path and message |
| 49 | survived | 67 | MethodExpression | `r.pages.map((p) => p.number).sort((a, b) => a - b)` -> `r.pages.map(p => p.number)` | internal | pages given out of order ([2,1]) are accepted thanks to the sort; order is not settled by the card. Unit-test [2,1] (keep) or drop the sort and test refusal |
| 51 | survived | 67 | ArrowFunction | `(a, b) => a - b` -> `() => undefined` | internal | pages given out of order ([2,1]) are accepted thanks to the sort; order is not settled by the card. Unit-test [2,1] (keep) or drop the sort and test refusal |
| 52 | survived | 67 | ArithmeticOperator | `a - b` -> `a + b` | internal | pages given out of order ([2,1]) are accepted thanks to the sort; order is not settled by the card. Unit-test [2,1] (keep) or drop the sort and test refusal |
| 66 | survived | 69 | ObjectLiteral | `{ code: 'custom', path: ['pages'], message: 'pages` -> `{}` | internal | zod issue shape for the page list; refusal itself is pinned. Unit-test path and message |
| 67 | survived | 69 | StringLiteral | `'custom'` -> `""` | internal | zod issue shape for the page list; refusal itself is pinned. Unit-test path and message |
| 68 | survived | 69 | ArrayDeclaration | `['pages']` -> `[]` | internal | zod issue shape for the page list; refusal itself is pinned. Unit-test path and message |
| 69 | survived | 69 | StringLiteral | `'pages'` -> `""` | internal | zod issue shape for the page list; refusal itself is pinned. Unit-test path and message |
| 70 | survived | 69 | StringLiteral | `'pages must be exactly 1 to ${String(r.pageCount)}` -> `''` | internal | zod issue shape for the page list; refusal itself is pinned. Unit-test path and message |
| 73 | survived | 80 | ConditionalExpression | `n < 0` -> `false` | clause | EV-5 A4 rect ending at the top edge refused by float noise (test "EV-5 r4 an A4 rect ...") |
| 74 | survived | 80 | EqualityOperator | `n < 0` -> `n <= 0` | equivalent | snap of exactly 0 or 1 to itself. Disable comment |
| 77 | survived | 80 | ConditionalExpression | `n > 1` -> `false` | internal | snap of a fraction just above 1 only reachable for width in (W, W+1e-9]: float-noise tolerance. Unit-test it or drop the upper snap |
| 78 | survived | 80 | EqualityOperator | `n > 1` -> `n >= 1` | equivalent | snap of exactly 0 or 1 to itself. Disable comment |
| 86 | survived | 86 | StringLiteral | `'rect ${f} must be a finite number'` -> `''` | clause | EV-5 check 18 RangeError must name the field (test "EV-5 r4 the RangeError ... names the field") |
| 89 | survived | 88 | ConditionalExpression | `!Number.isFinite(width)` -> `false` | clause | EV-5 check 18 RangeError must name the field (test "EV-5 r4 the RangeError ... names the field") |
| 91 | survived | 88 | StringLiteral | `'page width must be a finite number'` -> `""` | clause | EV-5 check 18 RangeError must name the field (test "EV-5 r4 the RangeError ... names the field") |
| 94 | survived | 89 | ConditionalExpression | `!Number.isFinite(height)` -> `false` | clause | EV-5 check 18 RangeError must name the field (test "EV-5 r4 the RangeError ... names the field") |
| 96 | survived | 89 | StringLiteral | `'page height must be a finite number'` -> `""` | clause | EV-5 check 18 RangeError must name the field (test "EV-5 r4 the RangeError ... names the field") |
| 98 | survived | 90 | ConditionalExpression | `!(width > 0) \|\| !(height > 0) \|\| !Number.isFinite(` -> `false` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 99 | survived | 90 | LogicalOperator | `!(width > 0) \|\| !(height > 0) \|\| !Number.isFinite(` -> `(!(width > 0) \|\| !(height > 0) \|\| !Number.isFinite` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 100 | survived | 90 | ConditionalExpression | `!(width > 0) \|\| !(height > 0) \|\| !Number.isFinite(` -> `false` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 101 | survived | 90 | LogicalOperator | `!(width > 0) \|\| !(height > 0) \|\| !Number.isFinite(` -> `(!(width > 0) \|\| !(height > 0)) && !Number.isFinit` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 102 | survived | 90 | ConditionalExpression | `!(width > 0) \|\| !(height > 0)` -> `false` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 103 | survived | 90 | LogicalOperator | `!(width > 0) \|\| !(height > 0)` -> `!(width > 0) && !(height > 0)` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 105 | survived | 90 | ConditionalExpression | `width > 0` -> `true` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 107 | survived | 90 | EqualityOperator | `width > 0` -> `width >= 0` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 110 | survived | 90 | ConditionalExpression | `height > 0` -> `true` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 112 | survived | 90 | EqualityOperator | `height > 0` -> `height >= 0` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 116 | survived | 90 | BlockStatement | `{` -> `{}` | clause | EV-5 (e) zero-size page: sliver rect gives a box or ZodError/NaN (test "EV-5 r4 a page of zero width or height ...") |
| 118 | survived | 91 | StringLiteral | `'page size must be above zero'` -> `""` | internal | converter refusal message texts (page size, rect size, off page); refusal itself is pinned. Unit-test the messages |
| 133 | survived | 93 | StringLiteral | `'rect must have a width and a height'` -> `""` | internal | converter refusal message texts (page size, rect size, off page); refusal itself is pinned. Unit-test the messages |
| 142 | survived | 94 | EqualityOperator | `rect.x < -EPS` -> `rect.x <= -EPS` | equivalent | float tolerance boundary (exactly 1+EPS or -EPS): no clause behaviour at 1e-9. Rewrite without EPS on that comparison or disable comment with reason |
| 146 | survived | 94 | EqualityOperator | `rect.y < -EPS` -> `rect.y <= -EPS` | equivalent | float tolerance boundary (exactly 1+EPS or -EPS): no clause behaviour at 1e-9. Rewrite without EPS on that comparison or disable comment with reason |
| 149 | survived | 94 | ConditionalExpression | `rect.x + rect.width > width + EPS` -> `false` | clause | EV-5 (e) never clamp: a rect wider than the page is snapped to 1 (test "EV-5 r4 a rect wider or taller ...") |
| 150 | survived | 94 | EqualityOperator | `rect.x + rect.width > width + EPS` -> `rect.x + rect.width >= width + EPS` | equivalent | float tolerance boundary (exactly 1+EPS or -EPS): no clause behaviour at 1e-9. Rewrite without EPS on that comparison or disable comment with reason |
| 152 | survived | 94 | ArithmeticOperator | `rect.x + rect.width` -> `rect.x - rect.width` | clause | EV-5 (e) never clamp: a rect wider than the page is snapped to 1 (test "EV-5 r4 a rect wider or taller ...") |
| 155 | survived | 94 | EqualityOperator | `rect.y + rect.height > height + EPS` -> `rect.y + rect.height >= height + EPS` | equivalent | float tolerance boundary (exactly 1+EPS or -EPS): no clause behaviour at 1e-9. Rewrite without EPS on that comparison or disable comment with reason |
| 161 | survived | 95 | StringLiteral | `'rect runs off the page'` -> `""` | internal | converter refusal message texts (page size, rect size, off page); refusal itself is pinned. Unit-test the messages |
| 206 | survived | 149 | EqualityOperator | `cx >= box.left` -> `cx > box.left` | clause | EV-6 centre on the box edge counts as inside (amber) (test "EV-6 r4 a word whose centre lies exactly on an edge ...") |
| 209 | survived | 149 | EqualityOperator | `cx <= box.left + box.width` -> `cx < box.left + box.width` | clause | EV-6 centre on the box edge counts as inside (amber) (test "EV-6 r4 a word whose centre lies exactly on an edge ...") |
| 213 | survived | 149 | EqualityOperator | `cy >= box.top` -> `cy > box.top` | clause | EV-6 centre on the box edge counts as inside (amber) (test "EV-6 r4 a word whose centre lies exactly on an edge ...") |
| 216 | survived | 149 | EqualityOperator | `cy <= box.top + box.height` -> `cy < box.top + box.height` | clause | EV-6 centre on the box edge counts as inside (amber) (test "EV-6 r4 a word whose centre lies exactly on an edge ...") |
| 236 | survived | 167 | Regex | `/\s+/g` -> `/\s/g` | equivalent | /\s+/g vs /\s/g replacing with "" is the same. Rewrite (e.g. /\s/g) or disable comment |
| 240 | survived | 168 | ConditionalExpression | `s === ''` -> `false` | equivalent | empty-string early return: GROUPED refuses "" anyway with a reason. Remove the early return or disable comment |
| 242 | survived | 168 | StringLiteral | `''` -> `"Stryker was here!"` | equivalent | empty-string early return: GROUPED refuses "" anyway with a reason. Remove the early return or disable comment |
| 247 | survived | 172 | Regex | `/(CR\|DR)$/i` -> `/(CR\|DR)/i` | equivalent | CR/DR anchor: any non-final CR/DR leaves letters, so the text is refused either way. Disable comment or rewrite |
| 255 | survived | 174 | OptionalChaining | `tail[1]?.toUpperCase` -> `tail[1].toUpperCase` | equivalent | ?. / ?? fallbacks needed only for noUncheckedIndexedAccess; the index is always defined. Rewrite (destructure, for-of, slice) to remove |
| 258 | survived | 175 | BooleanLiteral | `true` -> `false` | internal | CR with another sign mark ("-5.00 CR") refused; card silent, F09A grammar. Unit-test in reading.test.ts |
| 266 | survived | 179 | AssignmentOperator | `dollars += 1` -> `dollars -= 1` | internal | two dollar signs ("$$5.00", "$-$5") refused; card says "strips dollar signs", F09A grammar. Unit-test |
| 270 | survived | 182 | LogicalOperator | `s.startsWith('(') && s.endsWith(')')` -> `s.startsWith('(') \|\| s.endsWith(')')` | clause | EV-6 unbalanced bracket read as a different negative amount (test "EV-6 r4 an unbalanced bracket ...") |
| 272 | survived | 182 | StringLiteral | `'('` -> `""` | clause | EV-6 unbalanced bracket read as a different negative amount (test "EV-6 r4 an unbalanced bracket ...") |
| 274 | survived | 182 | StringLiteral | `')'` -> `""` | clause | EV-6 unbalanced bracket read as a different negative amount (test "EV-6 r4 an unbalanced bracket ...") |
| 299 | survived | 195 | AssignmentOperator | `dollars += 1` -> `dollars -= 1` | internal | two dollar signs ("$$5.00", "$-$5") refused; card says "strips dollar signs", F09A grammar. Unit-test |
| 307 | survived | 198 | ConditionalExpression | `negative > 0 && credit` -> `false` | internal | CR with another sign mark ("-5.00 CR") refused; card silent, F09A grammar. Unit-test in reading.test.ts |
| 314 | survived | 198 | StringLiteral | `'more than one sign mark'` -> `""` | clause | EV-6 checks 2/11 refusal "with the reason": empty reason (test "EV-6 r4 property: every refusal carries a non-empty reason ...") |
| 316 | survived | 199 | ConditionalExpression | `dollars > 1` -> `false` | internal | two dollar signs ("$$5.00", "$-$5") refused; card says "strips dollar signs", F09A grammar. Unit-test |
| 326 | no cov | 201 | StringLiteral | `''` -> `"Stryker was here!"` | equivalent | ?. / ?? fallbacks needed only for noUncheckedIndexedAccess; the index is always defined. Rewrite (destructure, for-of, slice) to remove |
| 332 | survived | 203 | ConditionalExpression | `whole.length > 15` -> `false` | equivalent | whole.length > 15 subsumed by the safe-integer check (any 15+ digit whole is unsafe in cents, same reason). Remove the line |
| 333 | survived | 203 | EqualityOperator | `whole.length > 15` -> `whole.length >= 15` | equivalent | whole.length > 15 subsumed by the safe-integer check (any 15+ digit whole is unsafe in cents, same reason). Remove the line |
| 335 | no cov | 203 | ObjectLiteral | `{ ok: false, reason: 'amount is too large' }` -> `{}` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 336 | no cov | 203 | BooleanLiteral | `false` -> `true` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 337 | no cov | 203 | StringLiteral | `'amount is too large'` -> `""` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 342 | survived | 205 | ConditionalExpression | `!Number.isSafeInteger(cents)` -> `false` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 343 | no cov | 205 | ObjectLiteral | `{ ok: false, reason: 'amount is too large' }` -> `{}` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 344 | no cov | 205 | BooleanLiteral | `false` -> `true` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 345 | no cov | 205 | StringLiteral | `'amount is too large'` -> `""` | clause | EV-6/ARC-13 cents past the safe integer range returned rounded or with no reason (test "EV-6 r4 an amount whose cents pass the safe integer range ...") |
| 358 | survived | 215 | MethodExpression | `s.trim().replace(/\s+/g, ' ').toLowerCase()` -> `s.trim().replace(/\s+/g, ' ').toUpperCase()` | equivalent | toLowerCase vs toUpperCase: both sides folded alike. Disable comment |
| 367 | survived | 218 | ConditionalExpression | `a.box.top < b.box.top + b.box.height` -> `true` | clause | EV-6 (a) same line only: reverse reading order and touching lines join (amber: touching is not same line) (test "EV-6 r4 words on different lines ...") |
| 368 | survived | 218 | EqualityOperator | `a.box.top < b.box.top + b.box.height` -> `a.box.top <= b.box.top + b.box.height` | clause | EV-6 (a) same line only: reverse reading order and touching lines join (amber: touching is not same line) (test "EV-6 r4 words on different lines ...") |
| 372 | survived | 218 | EqualityOperator | `b.box.top < a.box.top + a.box.height` -> `b.box.top <= a.box.top + a.box.height` | clause | EV-6 (a) same line only: reverse reading order and touching lines join (amber: touching is not same line) (test "EV-6 r4 words on different lines ...") |
| 375 | survived | 220 | Regex | `/^[-$(]+$/` -> `/[-$(]+$/` | clause | EV-6 groups: trailing sign closes the group (test "EV-6 r4 a trailing sign closes the group ...") |
| 377 | survived | 220 | Regex | `/^[-$(]+$/` -> `/^[-$(]$/` | clause | EV-6 groups: "$" "-" "1,234.56" reads negative (test "EV-6 r4 \"$\" \"-\" \"1,234.56\" ...") |
| 379 | survived | 221 | Regex | `/^(\)\|-\|CR\|DR)$/i` -> `/(\)\|-\|CR\|DR)$/i` | clause | EV-6 groups: join only across a whole sign word (test "EV-6 r4 a sign word joins only as a whole word ...") |
| 380 | survived | 221 | Regex | `/^(\)\|-\|CR\|DR)$/i` -> `/^(\)\|-\|CR\|DR)/i` | clause | EV-6 groups: join only across a whole sign word (test "EV-6 r4 a sign word joins only as a whole word ...") |
| 382 | survived | 222 | Regex | `/^\.\d{1,2}$/` -> `/^\.\d{1,2}/` | clause | EV-6 (b) split whose second part is not exactly .dd/,ddd/ddd never joins (test "EV-6 r4 a word that is not exactly ...") |
| 386 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/^,\d{3}(\.\d{1,2})?/` | clause | EV-6 (b) split whose second part is not exactly .dd/,ddd/ddd never joins (test "EV-6 r4 a word that is not exactly ...") |
| 385 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/,\d{3}(\.\d{1,2})?$/` | clause | EV-6 (b) split whose second part is not exactly .dd/,ddd/ddd never joins (test "EV-6 r4 a word that is not exactly ...") |
| 387 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/^,\d(\.\d{1,2})?$/` | clause | EV-6 groups: ",ddd" word joins (test "EV-6 r4 a \",ddd\" word joins ...") |
| 388 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/^,\D{3}(\.\d{1,2})?$/` | clause | EV-6 groups: ",ddd" word joins (test "EV-6 r4 a \",ddd\" word joins ...") |
| 389 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/^,\d{3}(\.\d{1,2})$/` | clause | EV-6 groups: ",ddd" word joins (test "EV-6 r4 a \",ddd\" word joins ...") |
| 390 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/^,\d{3}(\.\d)?$/` | clause | EV-6 groups: ",ddd" word joins (test "EV-6 r4 a \",ddd\" word joins ...") |
| 391 | survived | 223 | Regex | `/^,\d{3}(\.\d{1,2})?$/` -> `/^,\d{3}(\.\D{1,2})?$/` | clause | EV-6 groups: ",ddd" word joins (test "EV-6 r4 a \",ddd\" word joins ...") |
| 392 | survived | 224 | Regex | `/^\d{3}(\.\d{1,2})?$/` -> `/\d{3}(\.\d{1,2})?$/` | clause | EV-6 (b) split whose second part is not exactly .dd/,ddd/ddd never joins (test "EV-6 r4 a word that is not exactly ...") |
| 393 | survived | 224 | Regex | `/^\d{3}(\.\d{1,2})?$/` -> `/^\d{3}(\.\d{1,2})?/` | clause | EV-6 (b) split whose second part is not exactly .dd/,ddd/ddd never joins (test "EV-6 r4 a word that is not exactly ...") |
| 399 | survived | 225 | Regex | `/(?:^\|[^\d.,])\d{1,3}(?:,\d{3})*$/` -> `/(?:^\|[^\d.,])\d{1,3}(?:,\d{3})*/` | clause | EV-6 groups: three-digit group joins only a whole-dollar part (test "EV-6 r4 a three-digit group joins only ...") |
| 401 | survived | 225 | Regex | `/(?:^\|[^\d.,])\d{1,3}(?:,\d{3})*$/` -> `/(?:^\|[\d.,])\d{1,3}(?:,\d{3})*$/` | clause | EV-6 groups: three-digit group joins only a whole-dollar part (test "EV-6 r4 a three-digit group joins only ...") |
| 402 | survived | 225 | Regex | `/(?:^\|[^\d.,])\d{1,3}(?:,\d{3})*$/` -> `/(?:^\|[^\D.,])\d{1,3}(?:,\d{3})*$/` | clause | EV-6 groups: three-digit group joins only a whole-dollar part (test "EV-6 r4 a three-digit group joins only ...") |
| 408 | survived | 226 | Regex | `/^[\d$(.-]/` -> `/[\d$(.-]/` | internal | OPENS_AMOUNT anchor: only differs for a word with a leading space or symbol after a sign word. Unit-test (" 5" after "-") or drop the case |
| 417 | survived | 231 | ConditionalExpression | `!/\d$/.test(group)` -> `false` | clause | EV-6 groups: sign word never joins a word not ending in a digit (test "EV-6 r4 a sign word never joins a word that does not end in a digit ...") |
| 418 | survived | 231 | Regex | `/\d$/` -> `/\d/` | clause | EV-6 groups: sign word never joins a word not ending in a digit (test "EV-6 r4 a sign word never joins a word that does not end in a digit ...") |
| 428 | survived | 234 | ConditionalExpression | `SPACE_GROUP.test(next)` -> `true` | clause | EV-6 whole groups: every group counts, not only the last (test "EV-6 r4 each word that is a whole amount ...") |
| 432 | survived | 240 | ArrayDeclaration | `[]` -> `["Stryker was here"]` | equivalent | initial group array/current text and the push guards: an extra group "" or "Stryker was here" is never an amount; empty word list returns earlier. Rewrite amountGroups (e.g. reduce over words) or disable comment |
| 433 | survived | 241 | StringLiteral | `''` -> `"Stryker was here!"` | equivalent | initial group array/current text and the push guards: an extra group "" or "Stryker was here" is never an amount; empty word list returns earlier. Rewrite amountGroups (e.g. reduce over words) or disable comment |
| 442 | survived | 246 | ConditionalExpression | `last` -> `true` | equivalent | initial group array/current text and the push guards: an extra group "" or "Stryker was here" is never an amount; empty word list returns earlier. Rewrite amountGroups (e.g. reduce over words) or disable comment |
| 443 | survived | 246 | ConditionalExpression | `last` -> `false` | clause | EV-6 whole groups: every group counts, not only the last (test "EV-6 r4 each word that is a whole amount ...") |
| 444 | survived | 246 | CallExpression | `groups.push(current)` -> `;` | clause | EV-6 whole groups: every group counts, not only the last (test "EV-6 r4 each word that is a whole amount ...") |
| 446 | survived | 253 | ConditionalExpression | `last` -> `true` | equivalent | initial group array/current text and the push guards: an extra group "" or "Stryker was here" is never an amount; empty word list returns earlier. Rewrite amountGroups (e.g. reduce over words) or disable comment |
| 483 | survived | 275 | EqualityOperator | `i < words.length` -> `i <= words.length` | equivalent | text-run loop bounds and the first-join branch: an extra "" word is trimmed away by foldText. Rewrite with slice/join or disable comment |
| 487 | survived | 276 | StringLiteral | `''` -> `"Stryker was here!"` | equivalent | text-run loop bounds and the first-join branch: an extra "" word is trimmed away by foldText. Rewrite with slice/join or disable comment |
| 489 | survived | 277 | EqualityOperator | `j < words.length` -> `j <= words.length` | equivalent | text-run loop bounds and the first-join branch: an extra "" word is trimmed away by foldText. Rewrite with slice/join or disable comment |
| 494 | survived | 278 | ConditionalExpression | `j === i` -> `false` | equivalent | text-run loop bounds and the first-join branch: an extra "" word is trimmed away by foldText. Rewrite with slice/join or disable comment |
| 497 | survived | 278 | OptionalChaining | `words[j]?.text` -> `words[j].text` | equivalent | ?. / ?? fallbacks needed only for noUncheckedIndexedAccess; the index is always defined. Rewrite (destructure, for-of, slice) to remove |
| 498 | no cov | 278 | StringLiteral | `''` -> `"Stryker was here!"` | equivalent | ?. / ?? fallbacks needed only for noUncheckedIndexedAccess; the index is always defined. Rewrite (destructure, for-of, slice) to remove |
| 501 | survived | 278 | OptionalChaining | `words[j]?.text` -> `words[j].text` | equivalent | ?. / ?? fallbacks needed only for noUncheckedIndexedAccess; the index is always defined. Rewrite (destructure, for-of, slice) to remove |
| 502 | no cov | 278 | StringLiteral | `''` -> `"Stryker was here!"` | equivalent | ?. / ?? fallbacks needed only for noUncheckedIndexedAccess; the index is always defined. Rewrite (destructure, for-of, slice) to remove |
