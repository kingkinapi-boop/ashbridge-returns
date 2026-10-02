# Onboarding contract: what the client app holds that this system needs

P01 output for END-1 and ARC-2. Read-only scan of ashbridge-app at commit f87a0043 (28 Sep 2026; its log calls it live; source unchanged through 4e02312d): migrations, docs and source types only. No script run, no `.env` read, no database touched, no client data seen. R07 builds the bridge against made-up data with exactly these names; R62 drafts the views for the client repo. The client repo moves daily (its head changed during this scan): re-run this scout before go-live.
Cites: `M0002:50` = supabase/migrations/0002_*.sql line 50 (applied migrations never change). `L:` = src/lib/, `F:` = src/flow/ (lines as of the commit above). `FL:` `QA:` `DL:` = docs/fact-list-v2.md, ashbridge-qa-conversation-spec-v1.md, ashbridge-decisions-log.md.
Rules for the bridge: (1) read only the `bridge.*` views below, never a base table; (2) every view carries `is_test` (default true, M0002:5-7; made-up data is test data, live reads use false); (3) no view holds anything in section 3; (4) the column names here, with the types on the cited lines, are the contract.

## 1. What this system reads

**bridge.client** (a person plus the entities they act for; role is owner or delegate, M0001:30)
- people: id M0002:14, full_name M0002:15, is_test M0002:33. corporation_people: person_id M0002:110, corporation_id M0002:111, role M0002:116.
- entity_people: entity_id M0029:74, person_id M0029:75, role M0029:76.

**bridge.corporation** (the entity)
- entities: id M0029:23, kind M0029:24, corporation_id M0029:27, intake_id M0029:39, is_test M0029:42. Only kind 'company' (M0029:44), one per corporation (M0029:56). Personal-return entities (return_for M0029:36, family_index M0034:34) are T1: skipped.
- corporations: id M0002:49, legal_name M0002:50, business_number M0002:55, financial_year_end M0002:57, incorporation_date M0002:58, jurisdiction M0002:59, client_type M0002:72, all_prior_years_filed M0002:74, outstanding_years M0002:75, is_test M0002:96, drive_folder_url M0017:160.
- corporations, facts and switches: has_cra_login M0002:77, is_partnership_member M0002:82, holds_ontario_company_key M0002:88, holds_federal_login M0002:89, filed_initial_return M0002:92, claims_small_business_deduction M0012:41, hst_filing_frequency M0012:42, hst_basis M0012:43, books_kept_by M0012:62.
- business_number is the typed home for nine plain digits (M0002:52-55; L:businessNumber.ts:30) and is not restricted. The two holds_* columns are booleans, never the credential. The yes_no_unsure columns (has_cra_login, all_prior_years_filed, is_partnership_member, filed_initial_return) hold yes, no or unsure; null means never asked (M0001:48-51).

**bridge.t2_return** (what was bought, T2 per year)
- engagements: id M0003:80, corporation_id M0003:81, entity_id M0029:89, service M0003:83, recurrence M0003:84, tax_year M0003:89, current_state M0003:98, created_at M0003:105, is_test M0003:107. A return exists for every row with service 't2' (M0001:63-65) and a corporation_id (null for T1, M0029:90: left join).
- Other services on the same corporation (bookkeeping, hst, payroll, compilation, incorporation) say what evidence to expect. current_state is the client app's own Part 13 state: context only. due_date M0003:103 is never set for a T2 (L:intake/create.ts:240): not used, FLOW-7 computes dates.
- flow_progress: entity_id M0030:24, step_key M0030:27, submitted_at M0030:29 give submitted_at (step 'CYA', Check your answers); if 0030 is absent, the answer row 'CYA.submit' (L:flow/answers.ts:33).

**bridge.flag**
- flags: engagement_id M0003:145, flag M0003:146, raised_at M0003:148, cleared_at M0003:151 (open = null), is_test M0003:154. intakes: quote_reference M0021:24, latest_event M0021:30, is_test M0021:47.
- Intake raises payment_refunded, payment_disputed, subscription_lapsed, call_requested, referral_owed (L:intake/process.ts:30; M0025:15-19) and possible_duplicate_client (M0028:21): a person looks; this system never stops a return by itself.
- The attribute flags behind FL:36-57 (no_cra_access, family_shareholders, entity_above and so on, M0001:84-98) are raised only by v1 screens (L:screens/screen1a.ts:446, screen3.ts:612), never by v2.

**bridge.answer** (onboarding answers and the fact each resolves)
- answers: id M0006:35, entity_id M0029:95, corporation_id M0006:39, person_id M0006:40, engagement_id M0006:49, tax_year M0006:45, what_it_resolves M0006:43, question_asked M0006:41, answer_verbatim M0006:42.
- answers, state: status M0006:46, superseded_by_id M0006:54, channel M0006:44, source M0022:12, document_id M0020:128, created_at M0006:56, is_test M0006:57. channel is screen, conversation (year-end Q&A) or internal (firm marks) (M0001:156).
- Current answer = superseded_by_id null and status not 'superseded' (L:flow/answers.ts:113). v2 writes question_asked as `<question id>: <label>` (L:flow/answers.ts:30,226): the id is the stable key. what_it_resolves is never blank (M0006:64) but holds fact-list wording, not an id (U1).

**bridge.document** (documents with their Drive ids)
- documents: id M0004:245, corporation_id M0004:246, engagement_id M0004:247, drive_file_id M0004:249, drive_folder_id M0004:251, filename M0004:252, mime_type M0004:253, document_kind M0004:254, uploaded_at M0004:257, content_sha256 M0020:115, is_test M0004:258. Pointers only, never bytes (M0004:263-264).
- Unioned with v2 pointers: an upload answer holds entries `name|drive:<id>` in answer_verbatim (F:form.ts:130-155; L:flow/uploads.ts:42). v2 writes no documents row (only L:connections.ts:628, L:lastMile/signing.ts:326, L:storage.ts:163 do).
- Drive shape: `<legal name> (<first 8 hex of corporation id>)/<tax year>` (L:drive/folders.ts:64,121); the folder link is corporations.drive_folder_url M0017:160.

**bridge.cra_access** (CRA access status)
- v2: answers row 'CRA.confirmed', channel internal, current (L:flow/answers.ts:43; L:flow/craAccess.ts:148,274). v1: cra_authorization_requests corporation_id M0013:110, submitted_at M0013:111, approved_at M0013:113, expired_at M0013:114.
- cra_program_accounts: corporation_id M0002:143, program M0002:144, account_number M0002:145, is_open M0002:146. program is corporate_tax, hst, payroll or information_returns (M0001:54-56); account_number is a CRA program number, a documented non-restricted exception (L:sensitiveColumns.ts:52).
- Confirmed only by a current CRA.confirmed row or an approved, unexpired v1 request. The client's own choice (CRAB.choice) is stored as option wording (F:screens.ts:564): never parsed here.

**bridge.v1_*** (clients onboarded before v2; v2 leaves these empty)
- shareholders: holder_name M0004:19, holder_kind M0004:20, approximate_share_percent M0004:31, share_class M0004:39, tax_residency M0004:42. related_entities: entity_role M0004:61, entity_name M0004:62. business_operations: tax_year M0004:100, earns_money M0004:102, operates_from M0004:108, holds_inventory M0004:110.
- slip_recipients: full_legal_name M0004:149. payroll_people: full_legal_name M0004:197, pay_basis M0004:201. connections: account_kind M0004:222, method M0004:227. ownership_changes: tax_year M0012:86, changed M0012:87.
- declared_dividends: declared_on M0017:130, amount_cents M0017:131, resolution_on_file M0017:133. predecessor_requests: firm_name M0013:76, records_arrived_at M0013:80.

## 2. Which facts feed which T2 needs (FL row numbers; v2 question ids in the last column)

| T2 need | Fact rows | Supplied today by |
|---|---|---|
| T2 page 1, Schedule 24, industry code, year end | FL:102,195,196,229-231 | BQ1.bn/date/where/address, BQ2.describe, FY1.date/articles, INC1.*, INC2.*; legal_name to jurisdiction M0002:50-59 |
| CCPC status, small business deduction, provincial allocation | FL:201,207,232,233 | BQ5.res, INC4.resident, BQ3.partner, INC6.partner; M0012:41; is_partnership_member M0002:82 |
| Schedule 50, Schedule 9 association, business limit, split income | FL:98,101,103,105,200,202-204,234,260,261 | BQ4.*, BQ5.*, BQ6.*, INC3.*, INC4.holders, FY1.more; v1 shareholders M0004:15, related_entities M0004:57 |
| Schedule 1 add-backs, home office, insurance, Schedule 2 donations | FL:84,92,93,208,210,248,249 | YE1.phone/pcost/puse, BQ2.operate, BQ3.ins; the books built here |
| GIFI balance sheet and income statement, cutoff, receivables, inventory, ledger evidence | FL:96,97,106,107,205,206,209,213,214,235-240,253,254 | ARF.files, ARB.*, BQ2.earn/agent, BQ3.inv/invvalue (mostly uploads) |
| Schedule 8 CCA, vehicle benefits | FL:90,91,94,95,244-247 | CRA capture (R14), LR1.files, PA3.files, YE1.buy/bfiles, YE1.vehicle/vkm/vbkm |
| Schedule 3, T5, Part IV, Schedule 89, GRIP, RDTOH, Schedule 4, instalments and balances | FL:88,99,241-243,255-259,265 | CRA capture, else LR1.files or PA3.files; BQ7.others, BQ8.*; v1 declared_dividends M0017:122 |
| Owner pay, shareholder loan, T4 and T5 slips, payroll | FL:85-87,89,104,211,212,215,250-252,263 | YE1.personal/owner, BQ7.you/name/rel/addr, PY1.* to PY3.*; v1 slip_recipients M0004:145, payroll_people M0004:193 |
| HST reconciliation | FL:239,262 | HST1.*, BQ8.hst; hst_filing_frequency M0012:42 |
| Foreign property, compliance filings, program accounts | FL:100,197-199,216,264,266,379-386 | ARB.type (investment accounts), PA1.*, cra_program_accounts M0002:141; the rest is not asked in v2 |

- Attributes (FL:36-57): PAYROLL, HST-REG, BOOKS-ELSEWHERE come from services bought (M0001:63-65) and answers (PY1.*, HST1.*, ARF.*), not flags; NO-CRA is "no confirmed access" (bridge.cra_access).
- v2 already asks annual facts FL:86,87,88,90,92,94,101,106 (YE1.owner, BQ7.you/others, YE1.vehicle, YE1.phone, YE1.buy, BQ5.control, BQ3.invvalue): the year-end bank counts them as evidence and never re-asks (QA:644). The other 16 (FL:84,85,89,91,93,95-100,102-105,107) are only ever asked by this system's bank.

## 3. Never read

- restricted_data (M0005:15): no join, no select. value_encrypted M0005:34 is ciphertext and even last_four M0005:40 is not needed. Kinds: sin, date_of_birth, bank_transit, bank_institution, bank_account, ontario_company_key (M0001:171-178). A catalog test proves no bridge view references it.
- Marker answers: PY3.sin, PY3.dob, PY3.bank, BQ7.sin hold only `restricted-provided` or that plus last digits (F:form.ts:347,356,370); BQ1.bn holds a fixed sentence (L:screenAnswers.ts:76). Read them as "given", never as a value. Business number digits come only from corporations.business_number (M0002:55).
- Credentials and tokens: quickbooks_connections access_token_encrypted M0015:317, refresh_token_encrypted M0015:318; links token_hash M0007:20; signin_codes code_hash M0029:113; handoff_tokens token_hash M0029:137; person_sessions token_hash M0029:158; person_own_codes code_hash M0032:28.
- Contact details and prose this work does not need: people email M0002:16, mobile_number M0002:17; predecessor_requests email M0013:77; message_log to_address M0008:14, body M0008:17; qa_transcript body M0024:54; client_requests message M0033:37; intakes raw_payload M0021:25 (holds contact and payment; the quote facts needed are already on corporations and engagements).
- The database refuses SIN-shaped and bank-shaped digit runs in answers, file names and transcripts (M0006:71-76, M0019:50, M0024:80): made-up data must obey the same shapes or it will not load on live.

## 4. The shared table: question list and approval summary

`returns.client_handoff` (ARC-2): this system writes it, the client app reads it with its own service role, and no column can hold a sentence. One row per list item.
- Every row: id uuid, corporation_id uuid (M0002:49), engagement_id uuid (the T2, M0003:80), tax_year int (M0003:89), list_kind questions|approval, list_version int, position int, status draft|sent|withdrawn|closed, sent_at, is_test. Status sent means a preparer signed the list (blueprint 02, gaps); draft never leaves this system.
- Question rows add: item_id (bank id), primitive ask|confirm|decide, fact_id (what it resolves), answer_shape free_text|number|choice|date|percentage|document (QA:166), choice_ids text[], slots jsonb. A slot value is an id, a number, cents, a percent, an ISO date, or a label copied from a document (60 characters at most, never a sentence). A DECIDE row carries recommendation_id and reason_id (deck line ids, QA:163), not words.
- Approval rows add: item_id in net_income, taxable_income, federal_tax, ontario_tax, instalments, balance_or_refund (RV-2), value_cents and prior_value_cents (bigint); plus one assumption row (id, slots) per unanswered question the file proceeds without (QA:541, DL:210).
- The client app reads it the way it reads today's list: this corporation, this engagement or none, status 'sent', in position order (L:qa/reader.ts:54,90-107). It draws each row from its own deck by item_id and slots; a template that cannot be filled is not shown half-filled (L:copy/qa.ts:109). The wording lives and is approved in the client repo (LIVE-6).
- Limits the client app already applies (settings, DL:208): the list plus half again in follow-ups, at most two regenerations per session; a new list_version is written only after a person signs it.
- Answers return as the client app's own answers row: what_it_resolves = fact_id, engagement_id set, channel 'conversation' (L:qa/answers.ts:141-175; M0006:43). This system matches on (engagement_id, fact_id), never on wording. gap_list_rows (M0023:75) is not used: its question column is required prose (M0023:93,119).
- Note (Returns side, 2 Oct, findings review W14-D01; the contract's terms above are unchanged): answers come in two shapes. Screen answers (line 32) carry fact-list wording in what_it_resolves and `<id>: <label>` in question_asked; year-end bank answers (line 83) carry what_it_resolves = fact_id, channel conversation. This system reads both (id prefix first, U1). Its own sample clients hold no wording: question_asked is the id alone, and a fact with no screen id arrives as a conversation answer keyed by its fact id (`FL:<row>`); the ids allowed are listed in `reference/sample-clients/contract-ids.json`.

## 5. The Q&A spec in five lines

1. ASK: we do not know it and the client does; if the client does not know, investigate and never press (QA:59-65).
2. CONFIRM: we propose a treatment and the client checks it; a "not sure" answer is useful; unanswered goes to the reviewer; chosen by exception, not volume (QA:67-81, 102).
3. DECIDE: a choice with consequences; the recommendation and reason come first (DL:210, Q6); unanswered blocks the file and escalates, and the system never chooses (QA:83-93, 656).
4. No response: same day nothing; next day a nudge on both channels; day 3 a note on how few questions remain; day 7 Client Ops contacts the client personally; then deadline-aware; never restart, never re-ask (QA:517-533).
5. After that the file proceeds on documented assumptions (QA:535-548) at the Q8 default in DL:210 (provisional, Affan may amend): 14 days after the day-7 step, or when the T2 filing date or the February slip date is 10 business days away or past; each assumption is recorded, shown to the reviewer and written to the client; prepared, not filed, until the T183CORP is signed.

## 6. Unclear, with the choice this system makes (amber; the Lead logs each in plan/AMBER.md)

- U1. what_it_resolves has two vocabularies: v1 dotted keys (L:questions/rules.ts:112) and v2 fact-list wording, sometimes several facts joined by "; " or marked "no fact-list row" (F:screens.ts:561). Choice: map by question id first (prefix of question_asked, L:flow/answers.ts:30), then by exact wording; an unmapped answer becomes a check for a person, never a guess.
- U2. v2 writes answers plus only business_number (L:flow/save.ts:42), drive_folder_url (L:drive/folders.ts:104) and slip or payroll person names (L:flow/restricted.ts:54,97), so v1 tables are empty for v2 clients. Choice: answers first; a v1 table only when no v2 answer exists; two different values make the fact "conflicting" for a person.
- U3. T2 per year is not stored per year: a quote makes one T2 engagement per company, tax_year from the nearest upcoming year end (L:intake/create.ts:73,240,318); extra unfiled years exist only as text in outstanding_years (L:intake/create.ts:80; M0002:75); there is no unique rule on (corporation_id, service, tax_year) and a second quote reuses the year (L:intake/create.ts:354,367); onboarding answers carry the first T2 year only (L:flow/loadInputs.ts:92). Choice: one return per (corporation, tax_year), duplicates merged and flagged; an outstanding year gets a return only when a person adds it.
- U4. Year end: the quote gives a month and the app stores its last day as a guess (L:intake/create.ts:46,73); no v2 question confirms it (BQ1 asks number, incorporation date, place, address). Choice: financial_year_end (M0002:57) is unconfirmed; the return's year end comes from CRA capture, articles or the prior T2 (RT-1), else a person.
- U5. CRA access lives in three places (v2 CRA.confirmed row, v1 cra_authorization_requests M0013:108, corporations.has_cra_login M0002:77) and the client's choice is wording. Choice: as in bridge.cra_access; ask the client repo (R62 draft, red there) for a computed path column (given, first_year, manual). Until then "no confirmed access" means the NO-CRA variant (FL:272-288).
- U6. No client number exists in the client app (only quote_reference M0021:24, one per quote, and uuids). Choice: this system mints its own client_ref per corporation, keeps the mapping and uses it in file names (RT-5).
- U7. A CONFIRM "not sure" is a separate per-engagement count, not a column (L:qa/answers.ts:204; M0024:122), and an answer has no link to its question row (only qa_transcript.gap_list_row_id M0024:51). Choice: the fact_id match in section 4; every CONFIRM answer counts as answered and the preparer reads the words; ask the client repo for a new outcome column on answers in R62 (a client migration, red there).
- U8. Two state machines and a v1 last mile: current_state (M0003:98) overlaps our lifecycle, and review_findings M0017:68, signature_captures M0015:189, final_payments M0015:169, filings M0015:207 overlap approved to filed (the T183CORP is signed in CCH). Choice: read current_state as context, write nothing to the client app, never use the last-mile tables; whether the client app retires them is Zo's call at LIVE-6 (red there).
- U9. Migration headers are stale: 0019 to 0026 and 0028 say "not yet applied", 0029, 0030, 0032 to 0034 say "DRAFT, supabase/drafts", yet all sit in supabase/migrations/; what is live cannot be seen from files. Choice: a go-live probe of information_schema for every table and column named here; anything missing keeps the bridge on made-up data; no code assumes 0030 exists.
- U10. A v2 intake never sets client_type or business_type_tag (L:intake/create.ts:321; M0002:68,72). Choice: derive kinds K1 to K12 from facts (incorporation service, all_prior_years_filed, LR1 and PA1 answers, BQ2.describe); a doubtful kind is a flag for a person.
- U11. Facts exist only for the client's path: with confirmed CRA access most of FL:195-217 is never asked (F:conditions.ts:225 basicQuestionsApply), so a missing answer is not a missing fact. Choice: the gap pass (R16) checks the path and the CRA capture first and asks only what remains.
- U12. Money in answers is text with commas because a nine-digit run is refused (M0006:71-76; F:screens.ts:994). Choice: parse only `1,234,567.89` shapes; anything else is a check for a person.
- U13. Q8 is open in QA:24 but has a provisional default in DL:210. Choice: hold DL:210's numbers as a setting, not code, and re-read at go-live.
- U14. Contact details are not exposed, yet ops must reach clients. Choice: staff use the client app's own internal pages for contact; this system shows the name and its own client_ref only.
