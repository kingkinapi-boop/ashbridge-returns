# 0021: The secret scanner may ignore made-up fact names in test comparisons (2 October 2026)

Status: in force. Authority: Zo, 2 Oct 2026. Quotes are his words. Never edit: supersede.

- **Z21-1** "1: yes", answering the to-do "May the secret scanner ignore one made-up line?". `.gitleaks.toml` gains one line in `[allowlist] regexes`: `'''\.key\s*===\s*'[a-z0-9_]+(\.[a-z0-9_]+)+''''` (a fact name compared in a test, for example `e.key === 'prior_t2.schedule_8.cca_closing_undepreciated'`). No path is allowlisted and no rule is switched off. Card E03A (round 3) adds it, re-runs `gitleaks detect --no-banner --redact --log-opts="HEAD"` and expects no leaks. Any wider allowlist still needs Zo.
