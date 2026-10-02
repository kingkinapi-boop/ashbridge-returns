# A05 security review (2 Oct, Opus, cold; text returned to the Lead and recorded here)

Diff: merge-base 7a6038d to origin/claude/A05 fbcd62d, 16 files. /security-review checklist by hand plus an adversarial read against plan/cards/A05.md.

Verdict: CLEAN for A05 (no high or medium). 3 low, 1 info. The gitleaks failure does not come from A05.

## Findings
1. Low. src/modules/storage/files/index.ts:52-58 (`put`): the write path never checks the real parent folder; a symlinked or junctioned `<root>/sha256/<xx>` sends bytes outside the root. `get` checks (`checkOnDisk`). Fix: after mkdir, `realInside(root, path.dirname(file), 'key folder')` before writing. Rule test: every adapter write path checks the real parent folder as reads do.
2. Low. files/index.ts:78-80 (`has`): `lstat` still follows symlinked folders, so `has` is true through a symlinked prefix outside the root. Fix: same real-parent check; false or refuse when it fails.
3. Low. drive/index.ts:33 (`readIndex`): `index.json` read without `realInside`. Fix: `realInside(root, path.join(root,'index.json'), 'index')`.
4. Info, card mismatch. safe.ts:44-50 reads settings from `options.env ?? process.env`, not through `src/core/env.ts` as the card requires (builder amber 1). Values never printed.

## Checked and clean
Path traversal (null, backslash, leading slash incl. UNC, drive letters, `..`; key shape `sha256/<2 hex>/<64 hex>` matched to the hash; realpath checks), write-once (put/get/has/list only, content keys, 0444 with `wx`, temp then rename, re-hash on get), live slots refused with or without a key, no network or child_process, SEC-11 "(Test)" checks, made-up fixtures.

## gitleaks "leaks found: 13"
Not run locally. From CI summaries: `gitleaks detect` without `--log-opts` scans every fetched ref (`fetch-depth: 0`), so one branch fails all. The hits appeared between 23:33Z and 00:00Z; the only non-doc commit then is 7a50ac1 on claude/E03 (`data/facts/catalogue.json`, 156 `"key": "<dotted fact name>"` entries, generic-api-key shape). Not real secrets. A05's planted settings values passed real gitleaks on its spec commit.
Fix: (a) `.gitleaks.toml` with `[extend] useDefault = true` and an allowlist regex for `"key": "[a-z0-9_]+(\.[a-z0-9_]+)+"` (optionally planted values starting `PLANTED-` or `k-test-`; never whole test folders); (b) `.github/workflows/checks.yml:46`: `./gitleaks detect --no-banner --redact --log-opts="HEAD"`; (c) confirm the 13 on claude/E03 with a JSON report listing RuleID, File, StartLine only. Belongs to a toolchain card, not A05.
