# F04 spec: reported
Worker cloud-vm-b (spec by an Opus spec-writer subagent, core card). Branch claude/F04 (from claude/F00), spec commit 8a25174.
48 tests in src/contracts/ai.acceptance.test.ts (4 fast-check properties, seed 20261001) covering checks 1 to 7 (AI-1, AI-4, AI-5, AI-6, AI-10) plus a planted-instruction quote with no effect. Fail now (./ai missing); pass against a throwaway stub.
Ambers: names aiStepTypes, aiStepSchemas, citationSchema, versionStampSchema, validateAiOutput(stepType, raw, version) -> {ok,data:{output,version},toPerson}|{ok:false,problems}; citations tagged by `source` (ledger, document, return_cell); "can't tell" = {outcome:'cannot_tell',reason,citations:[]}, toPerson set by code; assumes F09 exports boxSchema {page,left,top,width,height}. Card "Spec commit" line not filled (plan/ is the Lead's).
Permission gaps: none. Model: claude-sonnet-5-5 (spec by Opus subagent).
