# 12 Kensington Market Crafts Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Tamsin Reyes (Test) owns Kensington Market Crafts Inc. (Test), a one-person craft business that sells at markets. She is not registered for HST (sales under $30,000, a small supplier). She gave only her onboarding answers: no bank statements, no QuickBooks, no documents.

## Accounts and files

None: onboarding answers only. No account files, no QBO files and no documents.

## Planted issues (exact amounts and dates)

- No account files, no QBO files and no documents: the figures are onboarding answers only, stored as the client app stores them (money as text with commas and two decimals).
- Sales 28,640.00; materials 11,480.00; market and booth fees 4,350.00; advertising 960.00; packaging and shipping 2,214.20; phone and internet 1,140.00; bank and payment fees 980.00; vehicle costs 3,900.00.
- Bank balance at 31 Dec 2025 6,215.80 (2,600.00 at 31 Dec 2024); money the owner lent the company and is still owed 2,500.00; shares issued 100.00. All prior years were filed by another firm: the 31 Dec 2024 balances are the client's answers and retained earnings is the balancing figure (0.00).
- Home costs she pays personally 16,800.00 with a home office share of 10 (percent); the vehicle drove 12,400 km in the year, 4,100 for the business.
- The year's entry has debits (the bank's rise of 3,615.80 and the seven expense groups) and credits (sales) that both come to 28,640.00.

## What each check should find

- **no third-party evidence for revenue** (12-F01, a person decides): Sales of $28,640.00 come from the client's answer. There is no bank statement, no sales report and no invoice behind it. A person decides whether to ask for evidence or proceed on the answer.
- **bank balance has no statement** (12-F02, a person decides): The year-end bank balance of $6,215.80 (and $2,600.00 a year earlier) is the client's answer. No statement or account file was given, so nothing can be tied to it.
- **home office rests on the client's word** (12-F03, a person decides): Home costs of $16,800.00 paid personally and a business share of 10 percent. No rent or utility proof. A person decides what to claim.
- **vehicle use rests on the client's word** (12-F04, a person decides): Vehicle costs of $3,900.00 and 4,100 business kilometres of 12,400 driven. No logbook. A person decides the business share.
- **shareholder loan rests on the client's word** (12-F05, a person decides): The owner says she lent the company $2,500.00 and is still owed it. No terms and no transfer to show. A person confirms.


## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.
