# F03R check (round 3), cloud-3703a0, 2 Oct

Branch claude/F03R at ce94026, merged main 7dd2c02. Result: PASS.

- typecheck, lint, deps:check clean. `npm test`: unit 878 of 878, db 2 of 2 (Node 24).
- Spec files unchanged since 579659a (diff empty). `scope.mjs F03R` OK (11 files).
- mutate:canary 100; `mutate:changed -- F03R` 100 on taxprep.ts (787 killed, 5 timeout, 0 survived).
- Opus adversarial read: B1, B2, B3 match the card; nothing built beyond it; forged ids and control characters refused.

## Notes (not failures)
1. Windows-1252 property test (taxprep.acceptance.test.ts:1066, ALPHABET line 1047) is Node-version dependent: on Node 22 `TextDecoder('windows-1252')` decodes 0x80 to 0x9F as C1 controls, which the writer rightly refuses; on Node 24 it passes. Cause of the two earlier cloud failures. Spec defect, not a writer defect: ALPHABET should come from a fixed table. The build report does not name this cause. Cloud runs must use Node 24 (package.json engines, engine-strict).
2. Gap in the card's B1 regex (same as main a89d508, so the ratchet holds): `+1'234`, `(1'234)`, ` 1'234`, `1'234 `, `1'234e3`, `--'12`, `1’234` (byte 92) are accepted as text with no fault. Rule for SC.
3. readBackMatches rate case uses Number(), so `''`, `' '` match rate 0 and ` 1.5`, `1.5e0` match 1.5. The writer always writes toFixed(4), so no user effect; a weak test seam. Exact compare against toFixed(4) would close it.
4. W00 spec worker finding: src/contracts/taxprep.acceptance.test.ts:280 helper `taxprepBytes` (line 84) throws on CRLF-stored files; after W00's A347 (taxprep CSVs `-text`, CRLF) it must accept CRLF and still refuse mixed endings. F03R spec fix needed before the W00 build lands.

Permission gaps: none. Model: Sonnet 5.5 checker, Opus subagent for the adversarial read.
