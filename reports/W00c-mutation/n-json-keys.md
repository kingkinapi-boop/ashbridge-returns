# W00c mutation, session 1, pass 1a: json-keys.ts (cloud-6d2e46, 4 Oct)

Method (A538): `--testFiles` json-keys.acceptance, reserved-keys.acceptance, model/json-keys.acceptance; related true; 120 s vitest timeout in the overlay (30 s timed out the RC5 "every depth of every answer-key" test in the dry run, 00:45Z); timeoutMS 10000, factor 1.5; incremental file n-json-keys.incr.json (not committed).
Dry run: "Initial test run succeeded. Ran 406 tests in 7 minutes and 11 seconds (net 429869 ms, overhead 1840 ms)". T = 1.5 x 429869 + 10000 + 1840 = about 656 s. Whole run 53 min 34 s.

| File | scored | killed | timeout | survived | no cov | score |
|---|---|---|---|---|---|---|
| json-keys.ts | 101 | 79 | 6 | 15 | 1 | 84.16 |

Timeouts (line, mutator): 10 LogicalOperator, 27 BlockStatement, 30 BlockStatement, 38 ArithmeticOperator, 39 BlockStatement, 43 UpdateOperator. All six are loop condition, update or body: counted as detected.
Survivors and no-coverage for pass 1b (line, mutator): 10 EqualityOperator, 10 ConditionalExpression x2, 10 StringLiteral, 18 BlockStatement (no cov), 25 ArrayDeclaration, 27 EqualityOperator, 32 ConditionalExpression x2, 32 LogicalOperator, 40 ConditionalExpression, 42 ConditionalExpression, 58 ArrayDeclaration, 58 StringLiteral x3 (the RESERVED set: the three acceptance files do not pin it; the load.ts tests may).
Not done: the other 10 targets (load.ts and the rest). One target takes about an hour on this 4-core box, so session 1 cannot cover all 11. Mutation.json: n-json-keys.json.
