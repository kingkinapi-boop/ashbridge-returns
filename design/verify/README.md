# Shared verify rules V1 to V8

`rules.mjs` holds the eight rule checks every family's verify script runs (reports/findings-designs-2.md; staff-screens rules 9, 18, 19, 20; design check 8). Each is first shown failing on a planted bad page (`planted/`, run by `selftest.mjs`).

Selftest: `PW_NM=<folder with playwright> node tools/heavy.mjs -- node design/verify/selftest.mjs`. Expect `selftest: 32 of 32 cases behave`.

## Use in a family's verify script

```js
import * as R from '../../../verify/rules.mjs'          // adjust the path
const r = await R.atSizes(browser, url, (page) => R.V3(page))   // both rule-18 sizes (R.SIZES)
// or on your own page: R.V1(page), R.V2(page, { name: 'Complete', click: '[data-act=complete]' })
```

Every function returns `{ rule, ok, failures: [string] }`. Serve over http, put the page in the state under test, call, then `ck(name, r.ok, r.failures.join('; '))`. Run on every page and state, at 1366 x 650 and 1093 x 525.

An action is `{ name, click: selector }`, `{ name, press: key }` or `{ name, run: async (page) => {}, expect }`; `wait` (ms, default 200) is optional. For a Back step use `run: (p) => p.goBack()`.

| Rule | Call | Needs |
|---|---|---|
| V1 No early error | `V1(page, { input? })` on load and after non-submit input | nothing |
| V2 Page stays put | `V2(page, action, { identity?, max? })` for every in-place action | identity bar |
| V3 Work in view | `V3(page, { evidence?, primary? })` in every pane state | `data-evidence`, `data-primary` |
| V4 Focus lands | `V4(page, action, { shortcuts: [{ key, selector }] })`; `action.expect` is the selector of the result, next row or row you came from | a selector for the expected focus |
| V5 Counts carry scope | `V5(page)` per page, then `V5same([results])` across pages; `V5caption(page, action, { caption })` for filters | `data-count="name"` and `data-scope="words"` (the scope words must appear in the visible text) or text "N of M" |
| V6 Search promise | `V6(page, { input, result, label, kinds: [{ kind, value }] })`, value copied in the format shown | selector of one result row, of the label |
| V7 Every click does something | `V7(page, { reset?, skip?, limit? })`; reloads (or `reset`) between controls | `data-noop-ok` on any control that truly changes nothing (rare, justify it) |
| V8 One choice, one action | `V8(page, { field, radio, submit })` | selectors of the field, its option, the submit |

## Data attributes and selectors a family must provide

- `data-identity-bar` on the MOJ identity bar (default selector `[data-identity-bar]`; pass `{ identity }` for another).
- `data-evidence` on the evidence node in each pane (the source box, the figure and its trace); `data-primary` on the action that decides on it (cite, reason, complete).
- `data-count` and `data-scope` on each visible count (see V5).

V1 treats any visible `.govuk-error-message`, `.govuk-error-summary` or `[class*="--error"]` as an error, and any `[hidden]` node that does not compute `display:none` as a fault.
V3 uses the full-visibility test (the whole node inside the viewport); a pane larger than the viewport must mark a smaller node.
V7 skips disabled controls; "Complete" on a done row must still do something (say "Already complete", move focus) or be absent (rule 8).
