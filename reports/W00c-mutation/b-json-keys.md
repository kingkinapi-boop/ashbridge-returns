# W00c mutation pass 1b: json-keys.ts (cloud-10d478, 4 Oct)
Survivor lines of pass 1a only, against the 81-file lean set (lean-testfiles.txt), 120 s vitest timeout, timeoutMS 10000, factor 1.5, Node 24.21.0.
Dry run: "Ran 772 tests in 6 minutes and 13 seconds (net 368509 ms, overhead 4597 ms)". Run took 27 min 35 s.
Result: 57 scored, 45 killed, 1 timeout, 11 survived, 0 no cov (80.70 on this subset).
Still alive after the lean set (line:col, mutator): 10:10 EqualityOperator, 10:10 ConditionalExpression, 10:51 ConditionalExpression, 10:63 StringLiteral, 25:26 ArrayDeclaration, 27:10 EqualityOperator, 32:11 ConditionalExpression x2 + LogicalOperator, 40:96 ConditionalExpression, 42:30 ConditionalExpression.
These go to the A521 heavy-pair cascade next. Timeout line is in b-json-keys.json (honesty check pending). Raw: b-json-keys.json, b-json-keys.log.
