# F03 mutants (Stryker 10, src/contracts/taxprep.ts, 2 Oct 2026)

Run on claude/F03 (merged with origin/main), `stryker run --mutate src/contracts/taxprep.ts`: score 75.25, 8 timeout, 167 survived, 32 no coverage. No code changed. Raw JSON: `reports/mutation/mutation.json` (not committed). Classes are a first pass by the worker (clause = a rule in RT-3/7/9/12/13/21/25 is untested; internal = message wording or defaults, test with a unit test; equivalent = no behaviour change).

Counts: clause (no coverage) 32, clause 138, equivalent 3, internal 26

## Clause-class groups the spec round must cover
- 66, 69, 85: the five CP1252 undefined bytes (U+0081, 008D, 008F, 0090, 009D) are not refused on write (RT-9).
- 105, 131, 135: identifier grammar not anchored (`A.B[1]x`, `A.B[1]]`), copy path (RT-21).
- 192 to 238: each fault regex (apostrophe, brackets, thousands, decimal comma, scientific, date) loses an anchor or class unnoticed (RT-9).
- 255 to 304, 320 to 332, 343 to 394: unquoted, separator, BOM, UTF-8, CRLF and header faults, including lines never reached (no coverage on 294 to 304, 361 to 364, 391 to 394).
- 432 to 434: row shape and last/description columns (RT-3).
- 460 to 465: natural-key helper skips (RT-7).
- 520 to 524: date validity (RT-9); 533 to 554: amount, rate, text refusals (RT-25, RT-8); 574 to 581: header write refusals; 590 and 593: ignored-on-import and last-column (RT-13).

## All survivors and no-coverage mutants

| Line | Mutator | Status | Class | Replacement |
|---|---|---|---|---|
| 49 | ConditionalExpression | Survived | clause | `true` |
| 66 | ArrayDeclaration | Survived | clause | `[]` |
| 69 | ConditionalExpression | Survived | clause | `true` |
| 75 | EqualityOperator | Survived | equivalent | `i <= raw.length` |
| 77 | ConditionalExpression | Survived | clause | `true` |
| 77 | LogicalOperator | Survived | clause | `c >= 0x80    c <= 0x9f` |
| 77 | ConditionalExpression | Survived | clause | `true` |
| 77 | ConditionalExpression | Survived | clause | `true` |
| 77 | EqualityOperator | Survived | clause | `c < 0x9f` |
| 84 | ConditionalExpression | Survived | clause | `false` |
| 85 | EqualityOperator | Survived | clause | `cp <= 0x80` |
| 85 | ConditionalExpression | Survived | clause | `true` |
| 85 | EqualityOperator | Survived | clause | `cp > 0xa0` |
| 85 | EqualityOperator | Survived | clause | `cp < 0xff` |
| 91 | EqualityOperator | Survived | equivalent | `i <= bytes.length` |
| 105 | Regex | Survived | clause | `/^([A-Z][A-Za-z0-9]*)(?:\[([^\]]*)\])?/` |
| 112 | StringLiteral | Survived | clause | `""` |
| 112 | ConditionalExpression | Survived | clause | `false` |
| 112 | StringLiteral | Survived | clause | `"Stryker was here!"` |
| 113 | StringLiteral | Survived | clause | `""` |
| 113 | ConditionalExpression | Survived | clause | `false` |
| 115 | StringLiteral | Survived | clause | `""` |
| 123 | ConditionalExpression | Survived | clause | `true` |
| 123 | ConditionalExpression | Survived | clause | `false` |
| 123 | EqualityOperator | Survived | clause | `part !== ''` |
| 123 | StringLiteral | Survived | clause | `"Stryker was here!"` |
| 124 | StringLiteral | Survived | clause | `""` |
| 125 | StringLiteral | Survived | clause | `` |
| 128 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 130 | StringLiteral | Survived | clause | `""` |
| 131 | Regex | Survived | clause | `/^[1-9]\d*/` |
| 132 | StringLiteral | Survived | clause | `` |
| 135 | MethodExpression | Survived | clause | `names` |
| 144 | StringLiteral | Survived | internal | `` |
| 145 | LogicalOperator | Survived | clause | `!Number.isSafeInteger(n) && n < 1` |
| 145 | ConditionalExpression | Survived | clause | `false` |
| 145 | ConditionalExpression | Survived | clause | `false` |
| 145 | StringLiteral | Survived | internal | `` |
| 147 | CallExpression | NoCoverage | clause (no coverage) | `;` |
| 147 | ConditionalExpression | Survived | clause | `false` |
| 192 | Regex | Survived | clause | `/-?\d+$/` |
| 192 | Regex | Survived | clause | `/^-?\d+/` |
| 193 | Regex | Survived | clause | `/^'-\d+/` |
| 193 | Regex | Survived | clause | `/'-0+$/` |
| 193 | Regex | Survived | clause | `/^'-0+/` |
| 193 | Regex | Survived | clause | `/^'-0$/` |
| 203 | StringLiteral | Survived | internal | `` |
| 206 | Regex | Survived | clause | `/\(\s*-?[\d.,]+\s*\)$/` |
| 206 | Regex | Survived | clause | `/^\(\s*-?[\d.,]+\s*\)/` |
| 206 | Regex | Survived | clause | `/^\(\S*-?[\d.,]+\s*\)$/` |
| 206 | Regex | Survived | clause | `/^\(\s*-?[\d.,]+\S*\)$/` |
| 210 | StringLiteral | Survived | internal | `` |
| 213 | Regex | Survived | clause | `/-?\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?$/` |
| 213 | Regex | Survived | clause | `/^-?\d{1,3}(?:[, ]\d{3})(?:\.\d+)?$/` |
| 213 | Regex | Survived | clause | `/^-?\d{1,3}(?:[, ]\d{3})+(?:\.\D+)?$/` |
| 213 | Regex | Survived | clause | `/^-?\d{1,3}(?:[, ]\d{3})+(?:\.\d)?$/` |
| 217 | StringLiteral | Survived | internal | `` |
| 220 | Regex | Survived | clause | `/-?\d+,\d+$/` |
| 220 | Regex | Survived | clause | `/^-?\d+,\d+/` |
| 220 | Regex | Survived | clause | `/^-?\d,\d+$/` |
| 224 | StringLiteral | Survived | internal | `` |
| 227 | Regex | Survived | clause | `/-?\d+(?:\.\d+)?[eE][+-]?\d+$/` |
| 227 | Regex | Survived | clause | `/^-?\d+(?:\.\d+)?[eE][+-]?\d+/` |
| 227 | Regex | Survived | clause | `/^-?\d(?:\.\d+)?[eE][+-]?\d+$/` |
| 227 | Regex | Survived | clause | `/^-?\d+(?:\.\d+)[eE][+-]?\d+$/` |
| 227 | Regex | Survived | clause | `/^-?\d+(?:\.\d+)?[eE][+-]\d+$/` |
| 231 | StringLiteral | Survived | internal | `` |
| 234 | Regex | Survived | clause | `/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/` |
| 234 | Regex | Survived | clause | `/\d{4}[/.]\d{1,2}[/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[/.]\d{1,2}[/.]\d{1,2}/` |
| 234 | Regex | Survived | clause | `/^\d[/.]\d{1,2}[/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\D{4}[/.]\d{1,2}[/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[^/.]\d{1,2}[/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[/.]\d[/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[/.]\D{1,2}[/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[/.]\d{1,2}[^/.]\d{1,2}$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[/.]\d{1,2}[/.]\d$/` |
| 234 | Regex | Survived | clause | `/^\d{4}[/.]\d{1,2}[/.]\D{1,2}$/` |
| 238 | StringLiteral | Survived | internal | `` |
| 255 | BlockStatement | Survived | clause | `{}` |
| 255 | ConditionalExpression | Survived | clause | `false` |
| 257 | MethodExpression | Survived | clause | `rest` |
| 257 | ConditionalExpression | Survived | clause | `true` |
| 257 | ConditionalExpression | Survived | clause | `false` |
| 257 | EqualityOperator | Survived | clause | `rest.indexOf(',', pos) <= 0` |
| 257 | EqualityOperator | Survived | clause | `rest.indexOf(',', pos) >= 0` |
| 257 | StringLiteral | Survived | clause | `""` |
| 257 | StringLiteral | Survived | clause | `""` |
| 262 | StringLiteral | Survived | internal | `` |
| 268 | EqualityOperator | Survived | clause | `pos > rest.length` |
| 269 | ObjectLiteral | Survived | internal | `{}` |
| 271 | StringLiteral | Survived | internal | `""` |
| 272 | StringLiteral | Survived | internal | `""` |
| 289 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 290 | ConditionalExpression | Survived | clause | `true` |
| 294 | ConditionalExpression | NoCoverage | clause (no coverage) | `true` |
| 294 | ConditionalExpression | NoCoverage | clause (no coverage) | `false` |
| 294 | BlockStatement | NoCoverage | clause (no coverage) | `{}` |
| 295 | ObjectLiteral | NoCoverage | clause (no coverage) | `{}` |
| 296 | BooleanLiteral | NoCoverage | clause (no coverage) | `true` |
| 297 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 298 | StringLiteral | NoCoverage | clause (no coverage) | `` |
| 301 | ObjectLiteral | NoCoverage | clause (no coverage) | `{}` |
| 302 | BooleanLiteral | NoCoverage | clause (no coverage) | `true` |
| 303 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 304 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 320 | MethodExpression | Survived | clause | `raw` |
| 323 | Regex | Survived | clause | `/[\xc2-\xdf][\x80-\xbf] [\xe0-\xef][\x80` |
| 323 | Regex | Survived | clause | `/[\xc2-\xdf][\x80-\xbf] [\xe0-\xef][\x80` |
| 323 | Regex | Survived | clause | `/[\xc2-\xdf][\x80-\xbf] [\xe0-\xef][\x80` |
| 332 | LogicalOperator | Survived | clause | `/(?<!\r)\n/.test(raw) && /\r(?!\n)/.test` |
| 332 | ConditionalExpression | Survived | clause | `false` |
| 340 | ConditionalExpression | Survived | clause | `true` |
| 343 | StringLiteral | Survived | clause | `"Stryker was here!"` |
| 344 | StringLiteral | Survived | clause | `"Stryker was here!"` |
| 344 | ObjectLiteral | Survived | clause | `{}` |
| 344 | StringLiteral | Survived | clause | `"Stryker was here!"` |
| 345 | Regex | Survived | clause | `/\[(.*)\ ([^ ]*)\ ([^ ]*)\ ([^ \]]*)\]/` |
| 345 | Regex | Survived | clause | `/^\[(.*)\ ([^ ])\ ([^ ]*)\ ([^ \]]*)\]/` |
| 345 | Regex | Survived | clause | `/^\[(.*)\ ([^ ]*)\ ([^ ])\ ([^ \]]*)\]/` |
| 353 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 353 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 355 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 355 | BlockStatement | Survived | clause | `{}` |
| 355 | ConditionalExpression | Survived | clause | `false` |
| 355 | LogicalOperator | Survived | clause | `rest[0] && ''` |
| 356 | ObjectLiteral | Survived | internal | `{}` |
| 357 | StringLiteral | Survived | internal | `""` |
| 361 | BlockStatement | NoCoverage | clause (no coverage) | `{}` |
| 361 | Regex | Survived | clause | `/,"[^"]*","[^"]*",""$/` |
| 361 | ConditionalExpression | Survived | clause | `false` |
| 361 | Regex | Survived | clause | `/^,"[^"]*","[^"]*",""/` |
| 362 | ObjectLiteral | NoCoverage | clause (no coverage) | `{}` |
| 363 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 364 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 374 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 375 | Regex | Survived | clause | `/([^,\t; "]*)(.?)/` |
| 375 | Regex | Survived | clause | `/^([^,\t; "]*)(.)/` |
| 376 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 376 | OptionalChaining | Survived | clause | `m[1]` |
| 377 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 377 | OptionalChaining | Survived | clause | `m[2]` |
| 383 | BlockStatement | Survived | clause | `{}` |
| 383 | ConditionalExpression | Survived | clause | `false` |
| 384 | ObjectLiteral | Survived | internal | `{}` |
| 385 | StringLiteral | Survived | internal | `""` |
| 386 | StringLiteral | Survived | internal | `` |
| 391 | BlockStatement | NoCoverage | clause (no coverage) | `{}` |
| 391 | ConditionalExpression | Survived | clause | `false` |
| 392 | ObjectLiteral | NoCoverage | clause (no coverage) | `{}` |
| 393 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 394 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 412 | MethodExpression | Survived | clause | `[f0, f1]` |
| 412 | MethodExpression | Survived | clause | `Math.max(tokens.fields.length, 2)` |
| 413 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 420 | BooleanLiteral | Survived | clause | `false` |
| 426 | ConditionalExpression | Survived | clause | `false` |
| 431 | ObjectLiteral | NoCoverage | clause (no coverage) | `{}` |
| 431 | StringLiteral | NoCoverage | clause (no coverage) | `""` |
| 432 | ConditionalExpression | Survived | clause | `true` |
| 432 | EqualityOperator | Survived | clause | `n > 2` |
| 433 | StringLiteral | NoCoverage | clause (no coverage) | `"Stryker was here!"` |
| 434 | EqualityOperator | Survived | clause | `n >= 3` |
| 460 | ConditionalExpression | Survived | clause | `false` |
| 460 | LogicalOperator | Survived | clause | `row.id.copyPath !== copyPath && copyInde` |
| 460 | ConditionalExpression | Survived | clause | `false` |
| 460 | ConditionalExpression | Survived | clause | `false` |
| 462 | ConditionalExpression | Survived | clause | `false` |
| 465 | ConditionalExpression | Survived | clause | `true` |
| 520 | Regex | Survived | clause | `/(\d{4})-(\d{2})-(\d{2})$/` |
| 520 | Regex | Survived | clause | `/^(\d{4})-(\d{2})-(\d{2})/` |
| 524 | LogicalOperator | Survived | clause | `t.getUTCFullYear() === y && t.getUTCMont` |
| 524 | ConditionalExpression | Survived | clause | `true` |
| 524 | LogicalOperator | Survived | clause | `t.getUTCFullYear() === y    t.getUTCMont` |
| 524 | ConditionalExpression | Survived | clause | `true` |
| 524 | ConditionalExpression | Survived | clause | `true` |
| 524 | ConditionalExpression | Survived | clause | `true` |
| 533 | StringLiteral | Survived | internal | `` |
| 533 | ConditionalExpression | Survived | clause | `false` |
| 536 | StringLiteral | Survived | internal | `` |
| 541 | StringLiteral | Survived | internal | `""` |
| 542 | StringLiteral | Survived | clause | `""` |
| 545 | StringLiteral | Survived | internal | `` |
| 551 | StringLiteral | Survived | internal | `` |
| 553 | EqualityOperator | Survived | clause | `Math.abs(Number(text) - v.rate) >= 1e-9` |
| 554 | StringLiteral | Survived | internal | `` |
| 573 | StringLiteral | Survived | clause | `""` |
| 574 | Regex | Survived | clause | `/[\x20-\x7e]*$/` |
| 574 | Regex | Survived | clause | `/^[\x20-\x7e]*/` |
| 575 | StringLiteral | Survived | internal | `""` |
| 579 | ObjectLiteral | Survived | internal | `{}` |
| 580 | UnaryOperator | Survived | clause | `+1` |
| 581 | StringLiteral | Survived | clause | `""` |
| 590 | StringLiteral | Survived | internal | `` |
| 593 | ConditionalExpression | Survived | clause | `true` |
| 594 | StringLiteral | Survived | clause | `""` |
| 597 | ConditionalExpression | Survived | clause | `false` |
| 603 | ConditionalExpression | Survived | clause | `true` |
| 609 | EqualityOperator | Survived | equivalent | `i <= out.length` |
