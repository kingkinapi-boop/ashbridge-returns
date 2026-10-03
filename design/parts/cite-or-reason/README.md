# Part: cite-or-reason

One decision on one value or question: cite a source, or write a reason. Used by the workbench Trace pane (version B); meant for the source viewer (D03) and any later cite form (D08, D12).

Files: `cite-or-reason.css`, `cite-or-reason.js` (plain script, `window.AshCiteOrReason.init(root)`), `example.html` (the markup to copy). Link them from the page: `../../../parts/cite-or-reason/cite-or-reason.css` and `.js` (path from `design/prototypes/<family>/<version>/`).

Rules it keeps (reports/findings-designs-2.md fix W2, check V8):
- Typing a reason checks "A written reason" for you. There is never a "Choose a source or write a reason" error while a reason is typed.
- The reason path is 2 clicks: click the box, type, press the button. The source path is 2 clicks: radio, button.
- Choosing the reason radio by hand moves focus into the box. Choosing a source keeps the typed text; the checked radio decides.
- No radio is preselected; no error before a submit (rule 9). The error pattern is the GOV.UK one (summary at the top of the form, link to the field, same message at the field). Whether the submit handler is the page's own or the part's, it reads `data-req`, `data-msg` and `data-req-if` as in `example.html`.
- Hooks for the shared checks (`design/verify`): `data-primary` on the submit button, `data-evidence` on the source box that sits above the form.

Parts used: GOV.UK radios (small), textarea, error message, error summary, button. Composed outside GOV.UK: `app-cor` (spacing of the group) and `app-cor__row` and `app-cor__reason` (the reason radio and its box share one line, the box is always visible, so typing is the choice; GOV.UK's conditional reveal hides the box and so cannot be typed into before it is chosen).
