# Proposal: a proper set of books for HPMS Finance (October 2026)

Status: **proposal only. Nothing has been applied to any database.** The SQL is in
`2026-10-finance-ledger.sql`; it ends in `ROLLBACK`, so running it by mistake changes nothing.

Superseded in part (7 October 2026): receipts, allocations and credit notes now live in
`2026-10-07-receipts-and-allocations.sql`. Its own receipt tables (section 3) must not be applied as well.

## Why

The Finance page now builds its ledgers from records HPMS already keeps: invoices, payslips,
practice expenses and inventory. That is accurate for what it covers, but it is not a set of books.
HPMS does not record when money actually arrived, part-payments, credit notes, the bank, VAT or the
owner's equity, so the "trial balance" on the Finance page cannot balance the way an accountant's does.

## What it adds

| Table | In plain words |
|---|---|
| `chart_of_accounts` | The practice's list of accounts (bank, receivables from medical aids, receivables from patients, revenue, salaries, rent, ...). Created automatically for each practice; the accountant can rename or add accounts. |
| `journal_entries` and `journal_lines` | The books. Every event is an entry with debit and credit lines that must add up to the same amount. |
| `payment_receipts` | Money received, with the real date and method (cash, card, EFT, medical aid remittance). |
| `payment_allocations` | Which invoices a receipt pays, so part-payments and one medical aid remittance covering many invoices work. |
| `credit_notes` | Reduce what is owed on an invoice (short-payment by a scheme, write-off, discount) without editing the invoice. |
| `finance_posting_errors` | Anything that could not be posted, so it can be fixed. |

## How things post (automatically)

| When this happens in HPMS | Debit | Credit |
|---|---|---|
| An invoice is created | Receivables - medical aids (the medical aid portion) and Receivables - patients (the rest) | Medical services revenue |
| An invoice is edited | only the difference | |
| An invoice is cancelled | the original posting is reversed | |
| A receipt is recorded | Bank (or Cash) | Receivables of whoever paid |
| An invoice is marked paid on today's screens | HPMS creates the receipt for what is still owed, then posts it as above | |
| A credit note is issued | Credit notes and discounts | Receivables of that funder |
| A payslip is generated | Salaries and wages (gross pay) | PAYE and deductions payable; Salaries payable (net pay) |
| A payslip is marked paid | Salaries payable | Bank |
| A practice expense is recorded | The expense account for its type (rent, utilities, ...) | Payables - suppliers |
| A practice expense is marked paid | Payables - suppliers | Bank (or Cash if paid in cash) |
| Monthly stock valuation (button or schedule) | Stock on hand and Equipment at cost (any increase) | Medical supplies used and Equipment expensed |

The rules are the same as the Finance page today: a cancelled invoice is void, and the patient is
responsible for whatever the medical aid does not cover, so the two always add up to the invoice total.

## Safety rules built in

- Every entry must balance; the database refuses one that does not.
- Nothing posted is ever edited or deleted. A change posts a new entry for the difference, dated the
  day of the change, so closed months stay closed.
- Posting can never stop someone saving an invoice, payslip or expense. If posting fails, the save
  still works and the problem is logged in `finance_posting_errors`.
- Each practice sees only its own books. Only practice admins and doctors can record receipts, credit
  notes or manual journals; journal entries themselves are written only by the system.

## Suggested rollout

1. Review the chart of accounts with the practice's accountant (VAT status, when equipment should be
   capitalised, depreciation).
2. Apply on a Supabase branch, run `finance_backfill` for one practice, and compare the result with
   the Finance page's derived summary.
3. Apply to production and run `finance_backfill` once per practice.
4. Point the Finance ledgers at the journals (the screens already exist), then add screens to record
   receipts (with allocation to invoices and medical aid remittances), issue credit notes, post the
   stock valuation and post manual journals.
5. Remove the "marked paid creates a receipt" bridge once receipts are recorded directly.

## Open questions

- VAT: a VAT account is created, but nothing posts to it until the practice's VAT status is confirmed.
- Historical payments: HPMS has no payment dates, so the backfill dates old receipts on the invoice's
  last update. The accountant may prefer a single opening-balance journal instead.
- Patients with financial history should be archived rather than deleted.
- Super admins: the access rules follow the existing pattern (the user's own practice). Access to other
  practices' books needs a separate decision.
- Export of journals to the accountant's package (Xero, Sage, Pastel) is a follow-up.
