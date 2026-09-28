# 02 Lifecycle

## States and moves

| State | Who acts | Leaves when | Next |
|---|---|---|---|
| intake | system | the return is created from client-app data | evidence |
| evidence | system, ops | documents read; CRA data captured when access exists | gaps |
| gaps | preparer | question list signed, or nothing to ask | qa, or build |
| qa | client, in the client app | all answered, or the no-response rule applies | build |
| build | system | import file written (AI draft saved) | prepare |
| prepare | preparer | receipt export verified; judgment inputs done; Ready pressed | trace |
| trace | system, preparer | lock export, review-lines export and printed return uploaded; zero orphans; zero unexplained overrides; diagnostics clear | respond |
| respond | preparer | every exception answered; preparer signs | review |
| review | CPA | approves, or sends comments | approved, or rework |
| rework | preparer | changed cells re-traced and re-checked; preparer signs | review |
| approved | ops | gate 1 passes; T183CORP sent | client_sign |
| client_sign | client, in CCH Digital Signature | certificate uploaded | ready_to_file |
| ready_to_file | ops | gate 2 passes; transmitted; confirmation number entered | filed |
| filed | ops | notice of assessment saved and compared | assessed |
| assessed | system | binder frozen | closed |

## Rules

- **FLOW-1** A return has exactly one state. Every change is an event: who, when, from, to, why.
- **FLOW-2** Only the moves in the table are allowed. Code refuses any other.
- **FLOW-3** "Waiting on the client" is a dated flag, not a state. The no-response rule from the client app's Q&A spec applies.
- **FLOW-4** Approval stores a fingerprint: every value in the lock export and the review-lines export, plus the id and version of every fact, entry and judgment input linked to them.
- **FLOW-5** Any later export or evidence change that alters a fingerprinted item voids the approval. The return goes back to trace, and the CPA later sees only the changed cells, before and after.
- **FLOW-6** Late evidence: a document that arrives after lock resets only the facts it touches. If those facts feed figures, the return goes back to prepare for those figures only; otherwise the document is attached and the state does not change.
- **FLOW-7** Every return shows its filing due date (six months after year end) and its balance-due date (two months after year end, or three for a CCPC that meets CRA's conditions) on every queue.
- **FLOW-8** An assessment that differs from the filed return opens a follow-up item. An amended return starts a new cycle at prepare and needs a new T183CORP.
- **FLOW-9** A closed return is read-only. Its binder (return PDF, every source, the trace, comments, approvals, signatures, confirmation) is frozen with a fingerprint and kept at least six years.
- **FLOW-10** One preparer holds a return at a time. A hold expires after a set idle time.
- **FLOW-11** An associated group's returns are linked, and group checks (CK-19) run across them.
