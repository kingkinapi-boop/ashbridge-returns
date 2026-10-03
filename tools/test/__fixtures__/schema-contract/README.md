Planted bad examples for card SC (schema and contract rules). Each file breaks one rule on purpose;
tools/test/schema-contract-rules.test.mjs and src/contracts/schema-rules.db.test.ts show each rule
catching it. Made-up data only. `__golden__/` holds the R29 refusal ratchet (spec-writer only).

`known.json` lists the rule failures on main, each owned by an open card (A407): one file, the exact
problem strings, the owner card id and why. The owner fixes the defect and deletes its entry; nobody
adds to it except a spec job, and never with a pattern. "unit" is the file side, "db" the database side.
