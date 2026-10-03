# W00d spec

## Round 1 (A501): ddece04b

222 tests in testworld/clients/w00d-fields, w00d-ids and w00d-dates .acceptance.test.ts plus testworld/model/__fixtures__/w00d-fields.ts; 147 fail on W00c 75556283 for the card's reasons. Step 6b rewrote three planted ids in testworld/model/ranges.acceptance.test.ts (lines 296, 363, 401; see the commit message). Validated on main 89be70a6 with W00c 394db377 merged.

## A511 patch (Lead directive 3 Oct 19:05Z): 53e602df

Worker cloud-8c7eee. Validated on main a677d7fe (merged into claude/W00d) with W00c 394db377 merged.

- New: testworld/clients/w00d-types.acceptance.test.ts, 89 tests (TB-2, ARC-8). 86 fail on W00c's loader for the right reason: "Unrecognized key: type" on each sandbox plant, the derived "from-*" type, and the sample answer keys carrying no type yet. 3 pass by design: the type list read from TB-2's text, the rule's own plants (no type, "from-transactions", the old memo "from-transactions-and-onboarding") and the five-type coverage of the sandbox plants.
- The sandbox plants write their own types into a copy, so the loader half is proved whatever the committed data says: per folder (14 with entries), written types are the model's; an entry with no type, "from-transactions", the old memo, "Reclass" or "" is refused as a schema issue naming answer-key.json adjustingEntries.<n>.type.
- testworld/model/__fixtures__/w00d-fields.ts: W00D_READ gains answer-key.json adjustingEntries[].type (RC-A's list comparison then needs the build's raw schema to type it).
- Step 6b: testworld/clients/load.test.ts:259 "ARC-8 an adjusting entry is typed by where its sources come from, and lists transactions then onboarding sources" rewritten as "ARC-8 an adjusting entry lists its transactions sources, then its onboarding sources" (the derived type is superseded by A511; the sources assertion is unchanged). With a stub (raw schema z.enum of the five, model type = j.type, typed answer keys) the whole unit and db projects pass except the 147 round 1 W00d tests the stub did not build and testworld/clients/regenerate.acceptance.test.ts (3 tests, ARC-16).
- Validation on the branch: typecheck and lint clean; unit 233 failed, all in w00d-* files (147 round 1 plus 86 new); db 662 passed.

### Paths gap (data half not done)

Writing `type` into reference/sample-clients/*/answer-key.json alone breaks ARC-16 (regenerate.acceptance.test.ts: the generator must reproduce every sample byte for byte). The type must come from the generator: lib/engine.mjs (aje() stores and checks a type), lib/emit.mjs (writes it after amount), lib/kit.mjs (amortAje passes estimate, prepaidInsurance allocation) and the c.aje calls in clients/*.mjs. An edit there was refused by the session's permission classifier (outside the card's Paths), so no answer key is changed in this commit. Until those files join W00d's Paths and a spec job writes the data, two tests stay red that the build cannot turn green: "TB-2 every adjusting entry of every sample answer key has a type" and "TB-2 ARC-8 the loaded type ... equals its answer key's". The build must not start before that data commit.

Types chosen from each reason (amber, made-up data), for the data job:

| Type | Entries |
|---|---|
| reclass | 01-AJE-01 (owner card items out of the shareholder loan), 04-AJE-01 (quick method HST to income), 06-AJE-01 (opening inventory to cost of sales, year-end count) |
| accrual | 03-AJE-01 (bonus), 07-AJE-03 (rent earned), 08-AJE-01 (unrecorded invoice), 08-AJE-05 (accounting fee), 08-AJE-06 (software owed to the owner), 13-AJE-01 (OHIP) |
| allocation | 07-AJE-01, 07-AJE-02, 08-AJE-03, 08-AJE-04 (prepaid insurance) |
| estimate | every book amortization entry (02-01, 03-02, 04-02, 07-04, 08-07, 09-01, 10-01, 11-01, 13-02, 14-01, 15-01), 06-AJE-02 and 08-AJE-08 (FX revaluation at a test rate), 08-AJE-02 (bad debt write-off) |
| correction | 12-AJE-01 (books built from onboarding answers) |

Not required, outside Paths: testworld/model/schema.ts keeps `type: z.string().min(1)`; tightening it to the five is a later card's choice.
