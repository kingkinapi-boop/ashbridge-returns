# W00c mutation check 5 (A533 shard 1, json-keys.ts) - RELEASED "continue:", no score

Checker: cloud-331e27 (Sonnet 5.5), 3 Oct 23:43Z to 4 Oct 00:15Z box clock. Node 24.21.0 (tarball in /opt/n24). Build 75556283 on claude/W00c. No score is claimed for any file.

## What ran
- Overlay (quoted in reports/W00c-mutation/overlay-*-a533.scratch.mjs.txt; scratch files deleted): lean set of 81 files (lean-testfiles.txt), Stryker timeoutMS 10000, timeoutFactor 1.5, dryRunTimeoutMinutes 90, `--mutate testworld/clients/json-keys.ts` (101 mutants), no ignoreStatic.
- A533's plain 5 s vitest timeout fails the dry run: "ARC-8 each account exportRows is its written rowsInExport..." times out at 5000 ms under instrumentation (no mutant active). Pass 1 used 30 s test/hook timeouts instead (amber, Lead may rule that test heavy). Dry run about 12 min.

## Result
Mutation phase scored 10 of 101 in the first minute, then nothing for 8 minutes (0 survived, 0 timed out; no mutant ever counted Timeout despite timeoutMS 10000); ETA 1 h 19 m. Under 20 a minute after 10 minutes, so per A533 I stopped (my own pids only) and release.

## Slow mutants
The progress reporter prints no mutant ids. Best reading by code, all in testworld/clients/json-keys.ts: the `while` conditions in `stringEnd` (line 10) and `scanKeys` (line 25): a condition forced true past the end of the text spins forever and the Stryker worker never reports Timeout. Unconfirmed: run `--mutate testworld/clients/json-keys.ts:10-10` and `:25-25` alone with logLevel debug to name them.

## Recommendation (Lead)
1. Next shard: json-keys.ts lines 10 and 25 alone, then the rest of the file; load.ts only after.
2. Rule the ARC-8 exportRows test heavy, or accept 30 s in pass 1.
3. If those loops never Timeout, that is a Stryker or vitest-runner fault (a sync infinite loop in a worker): a tool card, not missing tests.

## Process note
I ran `pkill -f` once by mistake (it only killed my own shell before anything ran); then killed Stryker by process ids. No other process touched.
Planted-survivor proof and mutate:canary not reached. Permission gaps: none. Model: Sonnet 5.5.
