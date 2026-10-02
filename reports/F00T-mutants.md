# F00T mutants: Stryker on main over the five core files

Spec job, 2 Oct 2026 (cloud). First run on main `fddfaee`; rerun on main `eae6b11` (core files unchanged between the two) with the main tests only (core.test.ts and log.acceptance.test.ts), StrykerJS 10.0.0, Vitest runner, `vitest.mutate.config.ts`, `--mutate src/core/{money,ids,clock,env,log}.ts`, incremental off, break off.

| File | Score on main (eae6b11) | Killed | Timeout | Survived | No coverage |
|---|---|---|---|---|---|
| clock.ts | 62.50 | 5 | 0 | 2 | 1 |
| env.ts | 66.67 | 10 | 0 | 5 | 0 |
| ids.ts | 36.36 | 4 | 0 | 7 | 0 |
| log.ts | 75.19 | 95 | 2 | 26 | 6 |
| money.ts | 83.33 | 30 | 0 | 6 | 0 |
| All | 73.37 | 144 | 2 | 46 | 7 |

The two runs differ on main from run to run (Stryker score stability, upstream 6073): on fddfaee ids.ts:11 `false` survived and log.ts:66 and log.ts:67 were killed; on eae6b11 the reverse. The table below is the union of both runs. The eae6b11 numbers match `reports/F00-check.md` (ids 36.36, log 75.19).

Class: **test** = a behaviour, now killed by a named acceptance test; **equivalent** = no input can tell the mutant apart, the build removes it by a rewrite or a disable comment with this reason. No survivor is classed internal: each behaviour one is reachable through the public functions.

## Survivors and no-coverage mutants

| File:line | Mutator | Mutant | Clause | Class | Killed by / reason |
|---|---|---|---|---|---|
| money.ts:6 | StringLiteral | message `""` | ARC-13 | test | money: "cents refuses a non-safe integer with its reason" |
| money.ts:19 | CallExpression | guard `cents(c)` removed in roundCentsToDollars | ARC-13 | test | money: "every entry point refuses a non-safe integer" |
| money.ts:22 | EqualityOperator | `c <= 0` | ARC-13 | equivalent | at c = 0 or -0, `dollars` is 0, so `dollars !== 0` is false either way; rewrite the sign step (e.g. `dollars === 0 ? 0 : ...`) or disable with this reason |
| money.ts:26 | CallExpression | guard `cents(c)` removed in formatCents | ARC-13 | test | money: "every entry point refuses a non-safe integer" |
| money.ts:29 | ConditionalExpression | `true` | ARC-13 | test | money: "formatCents examples" (5 gives "0.05") |
| money.ts:29 | EqualityOperator | `c <= 0` (formatCents(0) gives "-0.00") | ARC-13 | test | money: "formatCents(0) and formatCents(-0) print 0.00" |
| ids.ts:9 | BlockStatement | body emptied | ARC-16 | test | ids: format and exact-id tests |
| ids.ts:11 | ConditionalExpression | `true` | ARC-16 | test | ids: same-millisecond counter tests |
| ids.ts:11 | ConditionalExpression | `false` | ARC-16 | test | ids: same-millisecond counter tests |
| ids.ts:11 | EqualityOperator | `ms !== lastMs` | ARC-16 | test | ids: same-millisecond counter tests |
| ids.ts:12 | BlockStatement | else emptied | ARC-16 | test | ids: "a new millisecond starts again at 0000" |
| ids.ts:17 | ArithmeticOperator | `+` to `-` | ARC-16 | test | ids: exact-id and format tests |
| ids.ts:17 | StringLiteral | `padStart(12, '')` | ARC-16 | test | ids: "milliseconds padded to 12" (1 ms, 255 ms, 2026) |
| ids.ts:18 | StringLiteral | `padStart(4, '')` | ARC-16 | test | ids: "counter padded to 4" |
| clock.ts:6 | ObjectLiteral | `systemClock = {}` | ARC-16 | test | clock: "systemClock reads the system time" (fake timers) |
| clock.ts:6 | ArrowFunction | `now: () => undefined` | ARC-16 | test | clock: same |
| clock.ts:15 | BlockStatement (no coverage) | getClock body emptied | ARC-16 | test | clock: "getClock returns the clock that was set", "reset" |
| env.ts:5 | StringLiteral x3 | `'development'`, `'test'`, `'production'` to `""` | SEC-10 | test | env: "each allowed NODE_ENV is read back as given" |
| env.ts:14 | StringLiteral | `join('.')` to `join("")` | SEC-10 | equivalent | the schema has one top-level key, so every issue path has one part; rewrite (e.g. `String(i.path[0])`) or disable with this reason |
| env.ts:14 | StringLiteral | `join(', ')` to `join("")` | SEC-10 | equivalent | NODE_ENV is the only setting and an enum gives one issue, so there is never a second name; becomes killable when a second setting arrives (disable comment says so) |
| log.ts:5 | Regex x2 | first or second `[ -]?` made required (SIN_PATTERN) | SEC-5 | test | log: "a SIN written without separators, or with one, is redacted in text" |
| log.ts:6 | Regex x2 | `[ -]?` to `[^ -]?` (SIN_ONE) | SEC-5 | test | log: "no false alarm: a 10-digit amount in cents" |
| log.ts:9 | StringLiteral | REDACTED `""` | SEC-5 | test | log: "a redacted field prints exactly [redacted]" |
| log.ts:10 | StringLiteral | CIRCULAR `""` | SEC-5 | test | log: "a cycle prints exactly [circular]" |
| log.ts:28-30 | StringLiteral x3 | `'access token'`, `'refresh token'`, `'token hash'` to `""` | SEC-10 | equivalent | the kind `'token'` already matches any key with the word part "token"; remove the three redundant entries (rewrite) |
| log.ts:39 | MethodExpression | `.filter((p) => p !== '')` removed | SEC-5 | equivalent | split on `[^A-Za-z0-9]+` leaves empty parts only at the ends, and no kind has an empty word; rewrite (drop the filter; then log.ts:42 becomes killable by the "runs of separators" test) or disable |
| log.ts:41 | Regex | `([^A-Z]+)` for `([A-Z]+)` | SEC-5 | test | log: "keys with acronym runs before a word are split" |
| log.ts:41 | Regex | `([A-Z])` for `([A-Z]+)` | SEC-5 | equivalent | the space goes before the last capital of the run either way ("APIKey" gives "API Key" both ways); rewrite to the single-capital form or disable |
| log.ts:41 | StringLiteral | `'$1 $2'` to `""` | SEC-5 | test | log: acronym-run test |
| log.ts:42 | Regex | `+` dropped from the split | SEC-5 | equivalent while the filter stays | the filter removes the empty parts; killed by "keys with runs of separators" once the filter goes |
| log.ts:43 | ConditionalExpression | filter `true` | SEC-5 | equivalent | as log.ts:39 |
| log.ts:43 | StringLiteral | `p !== "Stryker was here!"` | SEC-5 | equivalent | as log.ts:39 |
| log.ts:50 | ArithmeticOperator | `i - run.length` | SEC-5 | equivalent | the extra iterations compare against `undefined` parts and never match; rewrite the run search (e.g. a join of parts with a space and a bounded `includes` with word edges) or disable |
| log.ts:64 | ConditionalExpression | `value === null` to `false` | SEC-5 | test | log: "null, booleans and undefined pass through" (null otherwise reaches Object.entries and throws) |
| log.ts:65 | ConditionalExpression | depth cap `false` | SEC-5 | test | log: "depth cap" and "a very deep object (100000 levels)" |
| log.ts:65 | EqualityOperator | `depth > MAX_DEPTH` | SEC-5 | test | log: "depth cap: 19 kept, 20 redacted" |
| log.ts:66 | ConditionalExpression | cycle check `ancestors.includes(value)` to `false` (eae6b11 run) | SEC-5 | test | log: "a cycle prints exactly [circular]" (the cycle otherwise runs to the depth cap); planted by hand on the spec branch, fails |
| log.ts:67 | ArrayDeclaration | `next = []` (ancestors never grow; eae6b11 run) | SEC-5 | test | log: same; planted by hand on the spec branch, fails |
| log.ts:68 | ArithmeticOperator | arrays `depth - 1` | SEC-5 | test | log: depth cap (array levels) |
| log.ts:70 | ArithmeticOperator | objects `depth - 1` | SEC-5 | test | log: depth cap |
| log.ts:75 | ArrayDeclaration | ancestors `["Stryker was here"]` | SEC-5 | equivalent | a string is never `===` an object, so the seed entry never matches; rewrite (e.g. a `WeakSet` or default parameter) or disable |
| log.ts:80 | ArrowFunction (no coverage) | default sink `() => undefined` | SEC-10 | test | log: "the default sink writes one JSON line ending in a newline to stdout" |
| log.ts:80 | StringLiteral (no coverage) | `'\n'` to `""` | SEC-10 | test | log: same |
| log.ts:85 | StringLiteral | `'info'` to `""` | SEC-10 | test | log: "the three log levels print their own level name" |
| log.ts:86 | BlockStatement, StringLiteral (no coverage) | warn emptied, `'warn'` to `""` | SEC-10 | test | log: same |
| log.ts:87 | BlockStatement, StringLiteral (no coverage) | error emptied, `'error'` to `""` | SEC-10 | test | log: same |

## Shown failing first (step 5)

- Rerun of Stryker over money, clock, env and log with the new acceptance files (the tests that fail on main filtered out): clock 100, money 97.22, env 86.67, log 92.25. The 13 left are exactly the rows classed equivalent above.
- ids.ts: every new ids test fails on main by name ("ids.ts exports setIdRandom(source)"). With a throwaway injection stand-in in place (never committed, ids.ts restored), all 7 pass, and each of the 8 ids survivors applied by hand fails 3 to 6 of them.
- Fail on main for the right reason: addCents returns an inexact total when a float running total passes 2^53 (`addCents(MAX, 2, -2)` gives MAX - 1; property seed 20261002 found `addCents(MAX, 50, -49)` returning MAX instead of refusing); clock.ts and env.ts lack `// @mutate`; ids.ts has no injection point. `formatCents(-0)` already prints "0.00" on main; the mutant at money.ts:29 is what the 0 test kills.

## For the build job

- `core.test.ts` is deleted by this spec commit: its money, clock, ids, logger and env content moved into the acceptance files; its ARC-9 globToRegExp case is already in `tools/test/lib.acceptance.test.mjs`.
- Score per file must reach 100 after the equivalents above are removed by rewrite or a disable comment with the reason given here.
