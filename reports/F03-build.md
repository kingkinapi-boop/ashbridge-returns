# F03 build: released (void spec)

Worker cloud-3b6e2d. Branch claude/F03 (no new code).

The acceptance tests on claude/F03 (`src/contracts/taxprep.acceptance.test.ts`, 80 tests) follow the OLD card (CCH help page: `[name|return id|language]` header, `T4SLIP[1].TOATSC4`, `57565.00`, blank = "no import", CRLF and Windows-1252 as faults, LF writer, UTF-8). The card's "Re-spec needed (1 Oct 2026)" section says any earlier spec is void. They contradict the current card (header `[name|0|0|GUID]`, quoted values, CRLF, Windows-1252, `""` = clear, RT-21 grammar, apostrophe negative, ignored-on-import list). Building to them would be wrong; editing them is forbidden.

Needed: reopen the spec (`update F03 spec reopened --worker lead`) and re-spec from the current card, then build.

Permission gaps: none. Model: Sonnet 5.5.
