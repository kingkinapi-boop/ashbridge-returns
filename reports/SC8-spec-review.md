# SC8 spec review (core): GAPS

Reviewer: Opus, cold, 3 Oct 2026. Spec commits f91a3f6e and e4e63a55 on claude/SC8 (validated on main 25fc96d). No `reports/SC8-spec.md` on the branch: the f91a3f6e commit message is the report.

## What is right
- Paths: the spec commits touch only `tools/test/source-read-rules.test.mjs`, its fixtures, `src/core/testing/read-own-source.acceptance.test.ts` and the card's Spec line. KNOWN is empty and `expect(KNOWN).toEqual([])` pins it.
- The FX2 plant is byte-identical to `src/modules/ocr/engine-setting.test.ts` at 6a8531b. The variable-path and fs.promises plants are there, and the scans assert non-empty plus sentinels. The resolver sentinel (bank.test.ts resolves `data/facts/catalogue.json`) guards against a resolver that silently stops working.
- I re-ran the resolver on main 6ea03922: exactly 10 raw reads in the 8 listed tests (15 problem lines), and no false alarm among the other 87 mutation-run tests.
- The captured preamble matches Stryker's real `stryNS_9fa48` / `stryCov_9fa48` / `stryMutAct_9fa48` layout. The R20 rewrite (6b) is declared, and the new "no process.env" case shows the raw read failing and the helper read passing.

## Gaps (each one needs a planted case in tools/test/source-read-rules.test.mjs, then a repo-scan expectation)
I probed rawReads with 25 read shapes. 6 were caught and 19 were missed. These are the misses that matter, grouped by class:

**G1 Local-function indirection (misses real code on main today).** The resolver does not follow a parameter of a named local function back to its call sites, does not use a local function's return value, and does not carry a list through `.map`. So `src/core/egress-rules.acceptance.test.ts:291` (`srcFiles().flatMap((f) => ... fs.readFileSync(f))`, every src file), `:139` (`fontProblems(srcFiles())`) and `src/modules/auth/rules.acceptance.test.ts:96` (`walk(src).map(relative)` then `readFileSync(path.join(ROOT, f))`) all raw-read the 29 @mutate files, and R79 passes them. A wrong build could also hide any of the 8 reads behind `const raw = (p) => fs.readFileSync(p)` and still go green.
- Shape: add the plant `planted-wrapper.test.ts.txt` with (a) `const src = (f: string) => fs.readFileSync(f, 'utf8'); src('src/core/money.ts')`, (b) `const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8'); read(ROOT, 'src', 'core', 'ids.ts')`, (c) `function srcFiles() { return walk(path.join(ROOT, 'src')) }` with `srcFiles().flatMap((f) => fs.readFileSync(f, 'utf8'))`, (d) `walk(path.join(ROOT, 'src')).map((f) => path.relative(ROOT, f))` with `.filter((f) => fs.readFileSync(path.join(ROOT, f)))`. Expect toEqual the exact problem list: money, ids, and all PINNED_MARKED for (c) and (d). Add to the clean plant a wrapper called with `data/facts/catalogue.json`, and expect no finding with that path resolved.
- Card consequence (amber for the Lead): once G1 is in, the repo scan fails on egress-rules and auth/rules. KNOWN must end empty, so add both files to Paths so the build moves those scans to readOwnSource. auth/rules is also in FX2/A04 territory, so land SC8 after them and merge, never rebase.

**G2 Callee forms.** The rule misses `import { readFileSync as rf } from 'node:fs'`, `fs['readFileSync'](p)`, `fs.readFileSync.call(fs, p)` / `.apply`, and `open(p)` / `fs.openSync(p)` (FileHandle `h.readFile()` or `readSync`). Shape: add the plant `planted-callee-forms.test.ts.txt`, one line per form on `src/core/money.ts`, and expect exactly one problem per line. The callee is printed as written.

**G3 Path roots.** These resolve to nothing today: `process.cwd()` (the sandbox root inside Stryker, which is exactly the case that reads the instrumented copy), `require.resolve('./money')` / `createRequire(import.meta.url).resolve`, `import.meta.resolve('./money.ts')`, and `new URL(...).pathname` / `.href`. Shape: add the plant `planted-roots.test.ts.txt` with one read per root, and expect one money.ts problem each. An extensionless specifier tries `.ts`, `.tsx` and `/index.ts`.

**G4 Reads that bypass fs.** Vite `?raw` gives the source text of the file Vite serves, which is the sandbox copy: `import s from './money.ts?raw'`, `await import('./money.ts?raw')`, and `import.meta.glob('./*.ts', { query: '?raw' })`. Shape: add the plant `planted-raw-import.test.ts.txt` and expect one problem per import, naming the targets (the glob names every marked file in the dir).

**G5 Ways a wrong build could pass without fixing anything** (none are guarded now):
- Unmarking: a build that deletes `// @mutate` from amount-grammar.ts or reading.ts passes, because the only marked sentinel is money.ts. Shape: `expect(mutateFiles()).toEqual(expect.arrayContaining(['src/contracts/amount-grammar.ts','src/contracts/reading.ts','src/core/clock.ts','src/core/env.ts','src/core/ids.ts','src/core/log.ts','src/core/money.ts','src/modules/ocr/index.ts']))`.
- Excluding: a build that adds the listed tests to the exclude in `vitest.mutate.config.ts` / `tools/test-homes.json` drops them from the scan. Shape: `for (const f of LISTED) expect(tests).toContain(f)`, where LISTED is the 8 Paths tests (plus G1's two).
- Dropping checks: the card says "same files, same assertions", but only a human diff checks that now. Shape: a fixture `listed-baseline.json` captured from main 25fc96d with, for each listed file, its ordered test titles and its `expect(` count. Assert both are equal after the build, that each file imports readOwnSource, and that the number of `.skip` / `skipIf` / `.todo` is unchanged.

**G6 Helpers that run in the sandbox.** The scan reads only `*.test.ts`, and the walk skips `__fixtures__`. Test harnesses that tests import (`src/modules/{sheets,storage,ocr/textlayer}/__fixtures__/harness.ts`, `src/core/testing/*`) run under Stryker too. Shape: widen the scan to the non-test `.ts`/`.mts` files under `src/**/__fixtures__/` and `src/core/testing/` (excluding read-own-source.ts), with sentinel `src/modules/sheets/__fixtures__/harness.ts`. Today this adds 0 findings (I checked: the harnesses read only data).

Accepted limits (write them in the rule header, no test): object-property paths, `let` reassignment, paths imported from another module, and shell `cat`.

## Verdict
GAPS: G1 and G5 are blocking (real misses on main, and wrong builds that pass). G2, G3, G4 and G6 complete the class. Spec patch, then build.
