# FX18 security review, round 3

Scope: `git diff origin/main...HEAD -- src data` on claude/FX18 (safe-read.ts, engines.ts, runner.ts, schemas.ts, ai/index.ts, data/ai/exchange-limits.json). Read-only review, 4 Oct 2026.

## Result: no medium or higher

## Low

### L1. chmod follows a link swapped in after the realpath check
`src/modules/ai/runner/engines.ts:328-332` (`realFolder`, make = true). The folder is checked with `realpathSync(dir) === join(realpath(root), name)`, then `fs.chmodSync(dir, 0o700)` runs on the path. `chmodSync` follows links, so a process that can write the exchange folder can swap `inbox` or `outbox` for a link to any other file or folder the runner user owns in the gap; that target is set to mode 0700 (owner rwx: a data file becomes executable and loses group/other read). The swap is caught afterwards by the pre-rename and per-poll `realFolder(..., false)` checks, so no data is read or written through the link; the only effect is the mode change on a runner-owned target. Exploit needs write access to the exchange folder and a tight race. Fix: open the folder (`O_DIRECTORY | O_NOFOLLOW`), `fstat` it against the realpath look, then `fchmodSync(fd, 0o700)`.

### L2. Each poll walks the whole outbox listing
`src/modules/ai/runner/engines.ts:278-288` (`logStrangers`). `lstat` and logging are capped at `strangerBatch` per poll and names logged at `seenMax + 1` per wait, but the loop calls `dir.readSync()` over every entry up to the cursor on every poll. An outbox with millions of planted entries costs CPU each poll (memory stays bounded by `bufferSize`). Nuisance only; the folder is the runner's own 0700 folder.

## Checked, no finding
- `safe-read.ts`: lstat look, `nlink > 1` refused before and after open, `O_NOFOLLOW | O_NONBLOCK`, dev/ino match on the opened fd, read capped at maxBytes + 1. A hard link or final-component symlink swap is refused. A swap of the outbox folder itself between the per-poll `realFolder` check and `readOwn` would only let the same writer feed a file it could already write; output is then schema-checked (`checkedOutput`).
- Log injection: `quotedName` JSON-escapes the name and also escapes Cf, Zl, Zp; the default sink goes through `logger.info('ai runner', { line })`, which `JSON.stringify`s the whole record, so no raw newline reaches the log. Recording names (unquoted, pre-existing) reach the log the same JSON-encoded way.
- Log flooding: recordings per runner and outbox names per wait capped at `seenMax` plus one "more" line; the held-apart `<id>.*` name logs once per wait.
- Leakage: every fs error in the exchange path is replaced by a fixed sentence (`attempt`, MKDIR_FAILED, INBOX_WRITE_FAILED, OUTBOX_READ_FAILED); no path, content or error text reaches logs or `last_error`. `lastErrorLine` strips Cc/Cf/Zl/Zp and caps at 600 code points.
- Redaction and permissions: AI-9 (`isRedacted`) and SEC-11 (`isTest`) gates now also sit inside `projectRun`; the runner gates are unchanged in effect; `aiEngines` is no longer exported from the module index (narrower). Staging file `wx`, mode 0600, random name, removed in `finally`. Exchange folder refused when inside the repository (`insideRepo`, real paths). Handler input now pins the step type. Stamp fields tightened to an identifier grammar.
