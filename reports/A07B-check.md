# A07B check (cloud-2f60ce, 2 Oct, Node 24.21): FAIL

Commands: typecheck, lint, deps:check clean; scope OK (54 files); canary 100; `npm test` 1581 pass, 1 fail (src/core/egress-rules SEC-5, an ESLint timing flake under load: passes alone, 24 of 24; a flaky test is a failure, W00/TH area, not A07B code); acceptance a07b 27 pass, 1 skipped (A01 reader, ocr absent). Spec diff 7d641b0..HEAD over spec files empty. mutate:changed A07B: 99.66 (break 70 met; the card asks 100). Survivors: src/modules/sheets/index.ts line 24 (`every` to `some` in startsWith: no test with bytes matching only part of the compound magic) and line 35 (StringLiteral on the route label despite the Stryker disable comment).
Note: Node 24.11 has a windows-1252 TextDecoder bug (2 tests fail: taxprep RT-3, csv EV-14); Node 24.21 is correct. Use 24.21+.

## Opus adversarial read: 4 failures (scripts kept in the checker's scratchpad, not pushed)
1. numberText 4-ulp band measured on the result misses noise from mixed-sign sums: cached SUM of -7335624.99, 2860106.52, -2434451.58, 8522880.37, 4815622.56, -6174618 = 253914.87999999803 reads as "253914.87999999803"; `cellValueMatches(..., "253914.88")` gives value differs. Seeded property: 5.4% of 20000 mixed-sign sums (up to 20 amounts under $10M) read as noise; 2.5% with up to 40 terms.
2. A number, boolean or formula cell carrying a hyperlink reads as type "empty", text "" (typed() accepts only string or richText text); the formula is dropped too.
3. A wrong-kind container under a CSV name (.docx, truncated xlsx, empty zip as "a.csv") returns ok:true with garbage cells starting "PK\u0003\u0004...[Content_Types].xml". Conflicts with A07B item 2's rule; the spec's amber 3 allows it, so also a spec gap.
4. `<v>12abc</v>` reads as number "12" and `<v>0x10</v>` as "0" (parseFloat); stored text silently becomes another value.
Rule candidate: every cell-value test runs over every ExcelJS value shape (number, boolean, date, formula, error, richText, hyperlink with each text kind); the money-text property uses mixed-sign sums of up to 50 cent amounts up to 1e12, not only a few ulps of noise on the result; a wrong-kind container is refused under every file name.
Permission gaps: nvm install left Node 22; used downloaded Node tarballs. Model: Sonnet 5.5 with an Opus subagent for the read.
