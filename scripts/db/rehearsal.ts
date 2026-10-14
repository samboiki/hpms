/**
 * Pure helpers for rehearse-proposals.ts: the order the SQL proposals are applied in, and how a file is prepared for
 * a rehearsal inside one outer transaction. Unit tested in scripts/db/__tests__/rehearsal.test.ts.
 */

/**
 * The order the proposals are applied in. Later files rely on earlier ones (the patient app's staff-only guard covers
 * every table that exists when it runs, so it goes last). Files that do not exist yet are skipped.
 * Not here on purpose:
 * - 2026-10-06-data-fixes.sql: its sections are chosen one by one (the owner already applied 6c and 8);
 * - 2026-10-claims.sql: check against the remittances proposal before applying;
 * - 2026-10-08-oauth-secrets-columns.sql: only after the release in which the browser stops reading OAuth secrets.
 */
export const DEFAULT_ORDER: readonly string[] = [
  // First and urgent: the public key could read invoices and claim lines without signing in
  'proposals/2026-10-07-close-anonymous-access.sql',
  'proposals/2026-10-07-two-way-sms.sql',
  'proposals/2026-10-07-patient-lists.sql',
  'proposals/2026-10-07-receipts-and-allocations.sql',
  // Needs the receipts tables: cash-up, daybook, month-end lock, debtors and family accounts
  'proposals/2026-10-07-debtors-and-controls.sql',
  'proposals/2026-10-07-quotes-and-bundles.sql',
  'proposals/2026-10-07-fund-codes.sql',
  'proposals/2026-10-07-claim-batch-numbers.sql',
  'proposals/2026-10-07-tariff-tooth-flags.sql',
  // NAMAF 2025 marks crowns, implants, bridges and amalgams T: they need a tooth number too
  'proposals/2026-10-07-tooth-flags-2.sql',
  'proposals/2026-10-07-dependant-code.sql',
  'proposals/2026-10-07-claim-diagnoses.sql',
  'proposals/2026-10-07-fund-tariffs.sql',
  // After receipts (which read invoice totals) and fund tariffs: invoice numbers, per-line date, practitioner and
  // discount, the co-payment split kept, who raised an invoice, the invoice change history
  'proposals/2026-10-07-invoicing.sql',
  'proposals/2026-10-07-remittances.sql',
  // Replaces functions of the remittances file and reads account_flags and the month-end lock (debtors)
  'proposals/2026-10-07-claims-flags-and-closed-months.sql',
  'proposals/2026-10-07-diary.sql',
  'proposals/2026-10-07-diary-2.sql',
  // Allergies, alerts, problem list, letters: before the portal file so its staff-only guard covers them
  'proposals/2026-10-07-patient-safety.sql',
  // RLS for the OneHealth tables that still had it off, and views with the caller's rights
  'proposals/2026-10-07-rls-onehealth.sql',
  // Practice-scoped policies for the tables that were still open to every login, super admins back on the views
  'proposals/2026-10-07-practice-isolation.sql',
  // Anon reads only the staff columns practice websites show (no bank details)
  'proposals/2026-10-07-anon-staff-columns.sql',
  // Marking a visit ready or cancelled failed in a broken notification trigger
  'proposals/2026-10-07-visit-notifications-fix.sql',
  // Sent emails stayed "pending": a broken usage trigger on practice_email_logs
  'proposals/2026-10-07-email-log-status-fix.sql',
  // Only administrators change bank details, numbers and the practice name; only support changes plans and limits
  'proposals/2026-10-07-practice-protected-columns.sql',
  'proposals/2026-10-07-dispensing-and-stock.sql',
  // Medicine lines are claimed with their NAPPI code (needs invoice_services.nappi_code from the stock file)
  'proposals/2026-10-08-claim-nappi.sql',
  // Medicines are claimed as GMED with type M/R/D, materials keep a 4-digit code (claim specification p. 7)
  'proposals/2026-10-08-claim-medicines.sql',
  // A sent claim batch is never rewritten (and an invoice never claimed twice)
  'proposals/2026-10-08-claim-sent-batches.sql',
  'proposals/2026-10-07-dental-chart.sql',
  // Needs receipts, debtors, patient lists, invoicing and the dependant code: moving over from Eminance
  'proposals/2026-10-07-eminance-import.sql',
  'proposals/2026-10-08-automations.sql',
  // Optometry: frames are stock items, and it rewrites patient_list_facts() as the stock file left it
  'proposals/2026-10-08-optometry.sql',
  // The follow-up automation engine was callable with the public key
  'proposals/2026-10-08-follow-up-functions-closed.sql',
  // The public key ran raw SQL (via the deployed execute-sql) and 36 owner-rights functions
  'proposals/2026-10-08-close-public-functions.sql',
  // The public key could list, replace and delete files in the documents bucket
  'proposals/2026-10-08-documents-bucket.sql',
  // "Mark No Show" failed: visits_status_check did not allow 'no-show'
  'proposals/2026-10-08-visit-no-show.sql',
  // Patient files, audit trail, payroll, OAuth secrets, documents and 19 owner-rights functions scoped to the
  // practice (uses practice isolation's rls_* helpers; replaces the documents-bucket policies)
  'proposals/2026-10-08-practice-isolation-2.sql',
  // A practice's type text matches its linked type (866 directory rows held 'general')
  'proposals/2026-10-08-practice-type-align.sql',
  // OneHealth support switches a practice's SMS replies (set_practice_feature; uses practice isolation's
  // rls_is_super_admin)
  'proposals/2026-10-08-practice-features-switch.sql',
  // Patient and staff records in a private bucket, practice id first in the path (uses practice isolation's
  // rls_my_practice_id and rls_is_super_admin)
  'proposals/2026-10-08-records-bucket.sql',
  // Title and initials on the patient file (additive; the existing patients policies cover them)
  'proposals/2026-10-08-patient-title-initials.sql',
  // The public key could list and read the orphaned files in the media bucket
  'proposals/2026-10-08-media-bucket.sql',
  // Each user's default practitioner in the diary (additive; the existing users policies cover it)
  'proposals/2026-10-08-diary-default-practitioner.sql',
  // Typed patient notes with a follow-up and a lock; the dashboard's follow-ups due (policies call practice
  // isolation's rls_my_practice_id)
  'proposals/2026-10-08-patient-notes.sql',
  // Clinical notes also for staff with a practitioner registration number (replaces the patient-notes file's rule)
  'proposals/2026-10-08-patient-notes-practitioners.sql',
  // Practice administrators choose which roles open Finance and Stock (set_screen_access; uses practice isolation's
  // rls_is_super_admin)
  'proposals/2026-10-08-screen-access.sql',
  // Claim batches move on with the funds' answers; fund payments keyed line by line, saved and posted (replaces
  // remittance_post_document of the claims-flags file, adding one block; needs receipts and remittances)
  'proposals/2026-10-08-claims-follow-up.sql',
  // ICD-10 codes and a changed fee per invoice line; sync_invoice_to_batch carries the codes into the claim line
  // (replaces the claim-sent-batches version, keeping its guards)
  'proposals/2026-10-08-invoice-line-codes.sql',
  // A practice's usual ICD-10 code per tariff code (uses practice isolation's rls_my_practice_id and rls_is_super_admin)
  'proposals/2026-10-08-tariff-icd10-defaults.sql',
  // Two 2025 "anon full access" policies on branches and practice_settings, inert since the grants went
  'proposals/2026-10-09-inert-anon-policies.sql',
  // A re-batched invoice keeps its lines in claim batches already sent (edits the invoice-line-codes version)
  'proposals/2026-10-09-claim-sent-lines-kept.sql',
  // Only a practice's administrators (and support) change colleagues' staff records; doctors keep their own row
  'proposals/2026-10-09-staff-records-admins.sql',
  // "No interest" and "Lay-bye" account flags, honoured by interest runs; an administrator's reason kept when an
  // invoice goes over a credit limit (needs the debtors file; replaces dc_flag_rule and dc_post_interest_run in place)
  'proposals/2026-10-09-account-flags-billing.sql',
  // What each payment covered, line by line: allocation lines, the automatic split and the existing allocations
  // mapped (needs receipts and the invoice-line columns; ar_insert_allocations changed in place)
  'proposals/2026-10-09-allocation-lines.sql',
  // A practice's own tariff codes and prices, over the shared list of its type (uses practice isolation's rls_* helpers)
  'proposals/2026-10-09-practice-own-tariffs.sql',
  // Code bundles: a fixed ICD-10 code and fee per line, stock items, "needs an authorisation number" (quotes-and-bundles)
  'proposals/2026-10-09-bundle-extras.sql',
  // Lines the patient pays all of are never claimed, and each line's authorisation number reaches the claim (edits
  // sync_invoice_to_batch as claim-sent-lines-kept left it, and add_invoice_to_batch, in place)
  'proposals/2026-10-09-line-portions.sql',
  // Credit notes line by line with reversals to the fund (a C credit file), a sent line corrected and sent again,
  // unpaid lines sent again (field 32): claim_rejection_act and stock_sync_invoice_line changed in place
  'proposals/2026-10-09-claim-corrections.sql',
  // Duplicate files merged inside a practice (and undone), the ID number unique per practice; the Eminance import's
  // ID check scoped to the practice (needs staff-records-admins' rls_is_staff_admin and the import's functions)
  'proposals/2026-10-09-patient-merge.sql',
  // A corrected authorisation number follows the invoice line's rule and goes on the invoice line too (claim_line_correct
  // of claim-corrections changed in place; needs line-portions' invoice_services.authorisation_number)
  'proposals/2026-10-12-claim-correction-authorisation.sql',
  // The full ICD-10 list the funds validate against (SA MIT; filled by scripts/db/load-icd10-mit.ts) and its search
  'proposals/2026-10-12-icd10-master.sql',
  // What a payment covers leaves out what a credit note took off a line (needs allocation-lines and claim-corrections'
  // credit_note_lines; ar_split_allocation_over_lines and ar_insert_allocation_lines changed in place)
  'proposals/2026-10-12-allocation-lines-credits.sql',
  // A patient merge moves rows in OneHealth's own tables only, never the other application's (edits patient-merge)
  'proposals/2026-10-12-patient-merge-own-tables.sql',
  // The fund master: each fund's claim rules in a table OneHealth support keeps, a practice's own note per fund (uses
  // practice isolation's rls_is_super_admin and rls_my_practice_id; replaces section 3 of 2026-10-claims.sql)
  'proposals/2026-10-12-fund-master.sql',
  // A practice's own booking statuses and appointment types (length, daily limit), a diary slot per practitioner (adds
  // the practitioner_slots key to diary-2's save_diary_settings; uses practice isolation's rls_* helpers)
  'proposals/2026-10-12-diary-statuses-and-types.sql',
  // Tooth surfaces and quadrants on invoice and claim lines; each line claimed under its own practitioner's HPCNA and
  // practice number, practitioners' own rates (edits sync_invoice_to_batch and add_invoice_to_batch as line-portions
  // left them; uses practice isolation's rls_* helpers and staff-records-admins' rls_is_staff_admin)
  'proposals/2026-10-12-line-teeth-and-billing-practitioners.sql',
  // The diary's free times per practitioner and appointment type, read only, for staff (needs diary-statuses-and-types)
  'proposals/2026-10-12-diary-free-slots.sql',
  // A claim line holds the whole 21-character authorisation number an invoice line accepts (a longer one failed the save)
  'proposals/2026-10-12-claim-authorisation-length.sql',
  // A practice's letter templates with merge fields; each kept letter names its template (patient_letters_stamp of
  // patient-safety changed in place; uses practice isolation's rls_my_practice_id and rls_is_super_admin)
  'proposals/2026-10-12-letter-templates.sql',
  // The claims dashboard per month and fund, and one claim line's story on one timeline (read only; needs
  // claims-follow-up, remittances, claim-corrections, invoicing and allocation-lines)
  'proposals/2026-10-12-claims-dashboard-and-story.sql',
  // Who did what: one staff member's postings and changes for administrators, and every Finance report download or
  // print recorded (report_exports; uses the rls_* helpers and claim_assert_staff)
  'proposals/2026-10-12-who-did-what.sql',
  // A recall date and reason per patient, done when a matching booking is made (patient_recall_status); rewrites
  // patient_list_facts() as optometry left it, adding recall_on and recall_reason (uses the rls_* helpers)
  'proposals/2026-10-12-patient-recalls.sql',
  // "Make main member" and "Make account holder" move the whole family account in one step (needs debtors-and-controls)
  'proposals/2026-10-12-family-account-move.sql',
  // Each part of a payment carries the practitioner of the line it paid (needs allocation-lines and invoicing)
  'proposals/2026-10-12-allocation-practitioner.sql',
  // Finance > Reports: money received per practitioner by payment date, for the practitioner stored with each part of
  // a payment (read only; needs allocation-practitioner and claim-corrections' claim_assert_staff)
  'proposals/2026-10-12-finance-reports.sql',
  // Referral and authorisation registers per patient, a visit's referral and hospital details, the people on a line;
  // the claim lines carry them (edits sync_invoice_to_batch and add_invoice_to_batch as line-teeth left them, and
  // claim_line_correct as claim-correction-authorisation left it; needs claim-authorisation-length)
  'proposals/2026-10-12-referrals-and-authorisations.sql',
  // "Someone else changed this first": every change to a patient, a visit or an invoice moves updated_at and records
  // updated_by (a trigger on each; the screens compare before saving)
  'proposals/2026-10-13-record-versions.sql',
  // Who opened which patient's file, and sign-ins and sign-outs, shown in Who did what (rewrites report_user_activity
  // as who-did-what left it; uses the rls_* helpers)
  'proposals/2026-10-13-access-log.sql',
  // Every export of a patient's record in the access log too (edits log_record_access as access-log left it)
  'proposals/2026-10-13-access-log-exports.sql',
  // A practitioner's private notes, the pregnancy due date, consent forms signed on the screen (a consent kind of letter
  // template: replaces letter-templates' save_letter_template with the kind added; uses the rls_* helpers and
  // patient-notes' patient_note_types_i_see)
  'proposals/2026-10-13-patient-file-extras.sql',
  // Signed consent PDFs are uploaded once and never deleted, replaced or moved: two RESTRICTIVE storage policies for the
  // records bucket's consents folders (every other path as before); record_patient_consent of patient-file-extras
  // replaced, requiring that folder
  'proposals/2026-10-13-consent-files-locked.sql',
  // Dental lab orders with their steps, the lab's invoice lines billed under 8099 (claimed as L lines) and where each is
  // billed (new tables only; needs receipts' ar_today and the stock file's stock_suppliers)
  'proposals/2026-10-13-dental-lab-work.sql',
  // Discounts on invoices as their own entries (patient portion only, numbered DS-, in balances, daybook, control totals
  // and the month end) and a statement message per account (edits the ar_ and dc_ functions as receipts and debtors
  // left them; needs debtors-and-controls)
  'proposals/2026-10-13-discounts-and-statements.sql',
  // One set of claim rules: add_invoice_to_batch builds lines through claim_invoice_into_batch, the body of
  // sync_invoice_to_batch as referrals left it; claim_line_correct takes the invoice's practitioner (edits all three as
  // referrals-and-authorisations left them)
  'proposals/2026-10-13-claims-consistency.sql',
  // What happens when a practice bills a code (authorisation, lab work, time, a recall, the place of service, linked
  // codes) and the yearly increase, saving each price through practice-own-tariffs' save_practice_tariff (new table and
  // functions only; uses the rls_* helpers)
  'proposals/2026-10-13-tariff-code-rules.sql',
  // An invoice whose patient lost the fund link leaves its never-sent batch (back to "Not yet batched"), and a batch is
  // locked before its line numbers are read (edits claim_invoice_into_batch as claims-consistency left it)
  'proposals/2026-10-13-claims-consistency-followup.sql',
  // Two saves when a fund has no open batch open one batch, not two: get_or_create_active_batch_id waits on the lock
  // claim-batch-numbers' trigger takes to number a batch, then looks again (edits the function as it is live today)
  'proposals/2026-10-13-claims-open-batch-lock.sql',
  'proposals/2026-10-13-batch-function-grants.sql',
  // A video booking keeps its room link (visits.video_link, https only; no policy changes)
  'proposals/2026-10-13-video-bookings.sql',
  // The booking confirmation's claim hands over that link (edits automation_queue_claim as automations left it)
  'proposals/2026-10-13-video-link-in-confirmations.sql',
  // The diary's waiting list and the offers made (new table and functions; needs ar_today and diary_appointment_types)
  'proposals/2026-10-13-diary-waiting-list.sql',
  // The practice's questions before a visit, the answers (tablet or link) and the link codes; previsit_questionnaire is
  // the one function the public key may run (needs pgcrypto and ar_today)
  'proposals/2026-10-13-previsit-questionnaire.sql',
  // Radiology reports on imaging requests: who entered them and when, through save_imaging_report (needs ar_today)
  'proposals/2026-10-13-imaging-reports.sql',
  // Payment plans, prepaid packages, promotions, the medicine price tiers and the material rule (new tables and functions;
  // invoice_services.promotion_id and package_id; needs ar_today, dc_first_open_day, the stock file's stock_ helpers and
  // line-portions' paid_by)
  'proposals/2026-10-13-billing-extras.sql',
  // Finance > Reports > Build a report: saved report definitions per practice (new table and functions; needs
  // claim-corrections' claim_assert_staff and rls_my_practice_id)
  'proposals/2026-10-13-report-builder.sql',
  // Stock per store with transfers between stores, and the creditors ledger (payments to suppliers and what they paid);
  // replaces stock_receive, stock_return_to_supplier, stock_adjust, stock_start_count, stock_record_counts and
  // stock_save_supplier as the stock file left them, adding the store (needs the stock file and branches)
  'proposals/2026-10-13-stock-stores-and-suppliers.sql',
  // A patient's town and region (patients.town and region, nullable; the namibian_region domain; no policy changes)
  'proposals/2026-10-13-patient-town.sql',
  // Company (employer) accounts, the compensation and MVA funds as accounts, injury and accident cases, who pays for a
  // visit (a BEFORE trigger on invoice_services before invoice_services_fill_split; needs receipts, debtors,
  // line-portions' paid_by, rls_my_practice_id and patient-town's namibian_region)
  'proposals/2026-10-13-company-accounts-and-injury-cases.sql',
  // Moving many patients to another fund or option in one step (administrators; needs claim_invoice_into_batch)
  'proposals/2026-10-13-fund-moves.sql',
  // A patient's own balance (ar_patient_balances) leaves out the invoices company and fund accounts pay (needs the
  // receipts file's balance views and company-accounts' visit_payers)
  'proposals/2026-10-13-company-accounts-followup.sql',
  // Optometry: the full eye exam (case history, keratometry, ocular health, the contact-lens fit), one barcode per frame
  // kept in step with the stock ledger (a trigger on stock_movements), consignment frames and what is owed to the
  // supplier, job costs on lab orders (replaces optometry_save_exam and optometry_save_frame as the optometry file left
  // them; calls stock_receive, stock_return_to_supplier and stock_adjust as stock-stores-and-suppliers left them)
  'proposals/2026-10-13-optometry-frames-and-exam.sql',
  // Rows that only carry invoices (payment plans, packages, Eminance opening balances) are not visits: visit_is_carrier
  // and patches to the visit counts, the visit number trigger, the patient app's appointments and two views. Each patch
  // first checks the object's text is the one it was written for, so on a database that already has it the file stops
  // at that check and changes nothing (needs billing-extras; patches portal_appointments of the patient app file)
  'proposals/2026-10-13-billing-extras-followup.sql',
  // The public key runs previsit_questionnaire only (92 OneHealth functions closed to it), the staff-only guard on
  // patient_merges, practitioner_billing and report_exports, no TRUNCATE for app logins on 14 new tables, the four
  // materialized views for the service key only, and a fixed search path on 45 owner-rights functions (needs every file
  // that creates those functions and tables, previsit-questionnaire included)
  'proposals/2026-10-13-security-sweep.sql',
  // A skipped recall offer is kept per visit and code (needs tariff-code-rules' offers and practice isolation)
  'proposals/2026-10-13-recall-offer-skips.sql',
  // A patient's price rate: private, staff or contract (needs billing-extras' billing_assert_staff)
  'proposals/2026-10-13-patient-price-rates.sql',
  // Consignment supplier invoices on the supplier's account: optometry_consignment_settle also records a CSG supplier
  // invoice (stock_deliveries.consignment), reversing one puts its frames back to owed (needs stock-stores-and-suppliers
  // and optometry-frames-and-exam; replaces optometry_consignment_settle as the latter left it)
  'proposals/2026-10-13-consignment-supplier-ledger.sql',
  // Eminance recalls also become the patient's recall (through set_patient_recall), with a backfill of earlier imports
  // (needs eminance-import and patient-recalls; replaces legacy_import_recalls and legacy_import_undo_step)
  'proposals/2026-10-13-eminance-recalls.sql',
  // Owner decisions of 13 Oct: payslips for administrators and the person; refunds, reversals and credit notes for
  // administrators, no new discounts, invoices never deleted (needs discounts-and-statements); cash-up per cashier
  // (needs debtors-and-controls); patient photo and "heard about us"; Meta connections; stock photos cleared;
  // researched claim deadlines and member-number lengths (needs fund-master)
  'proposals/2026-10-13-payslips-admin-or-own.sql',
  'proposals/2026-10-13-admin-only-money-corrections.sql',
  'proposals/2026-10-13-cashier-cash-ups.sql',
  'proposals/2026-10-13-patient-photo-and-referral-source.sql',
  'proposals/2026-10-13-meta-connections.sql',
  'proposals/2026-10-13-clear-stock-avatars.sql',
  'proposals/2026-10-13-claims-standards.sql',
  // The general ledger (accounting export), reworked 13 Oct to post from receipts and invoice_adjustments
  'proposals/2026-10-finance-ledger.sql',
  // Public practice listing for websites; anon no longer reads practices' bank and tax columns
  'proposals/2026-10-13-public-practice-listing.sql',
  // Owner step once the practice websites read practice_listing (they ask practices for select=* until redeployed)
  'proposals/2026-10-13-close-practice-bank-fields.sql',
  // Scheduler: pg_cron + pg_net run the reminder and automation functions every 15 minutes (Vault secrets)
  'proposals/2026-10-13-scheduler.sql',
  // The inpatient tables were open to the public key: closed first, then the Inpatient page's functions (replaces
  // set_screen_access from screen-access with 'inpatient' added)
  'proposals/2026-10-13-inpatient-access.sql',
  'proposals/2026-10-13-inpatient-module.sql',
  // The NAMAF 2026 benchmark list for every discipline (rows loaded from the owner's file, not in this file)
  'proposals/2026-10-13-namaf-tariffs.sql',
  // Each practice type's NAMAF discipline (practice_types.namaf_discipline_code) and the types that were missing
  // (needs namaf-tariffs: the checks read namaf_tariff_disciplines)
  'proposals/2026-10-14-practice-type-disciplines.sql',
  // ICD-10 suggestions per tariff code: what a practice itself bills (learned_tariff_icd10) and a short reviewed starter
  // list for NAMAF codes that name their situation (needs the ICD-10 list, practice isolation's rls_* helpers and the
  // receipts file's ar_today; its checks read namaf_tariffs and icd10_codes when they are loaded)
  'proposals/2026-10-14-tariff-icd10-suggestions.sql',
  // The starter links that follow the South African ICD-10 coding standards, and the column that names the standard
  // (needs tariff-icd10-suggestions)
  'proposals/2026-10-14-tariff-icd10-suggestions-standards.sql',
  'proposals/2026-10-07-patient-portal.sql'
];

const TRANSACTION_CONTROL = /^[ \t]*(BEGIN|START TRANSACTION|ROLLBACK|COMMIT|END)[ \t]*;[^\n]*$/gim;

/**
 * Turns a proposal's own top-level BEGIN; / ROLLBACK; / COMMIT; lines into comments, so the file runs inside the
 * rehearsal's single transaction instead of ending it. PL/pgSQL blocks are untouched: their BEGIN has no semicolon
 * and their END; follows other statements inside a $$ body (see dollarQuoted below).
 */
export function stripTransactionControl(sql: string): string {
  const quoted = dollarQuotedRanges(sql);
  return sql.replace(TRANSACTION_CONTROL, (match, _word, offset: number) =>
    quoted.some(([start, end]) => offset > start && offset < end) ? match : `-- (rehearsal) ${match.trim()}`
  );
}

/** [start, end] offsets of $$...$$ and $tag$...$tag$ bodies (function code), where BEGIN/END belong to PL/pgSQL. */
export function dollarQuotedRanges(sql: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const opener = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(sql)) !== null) {
    const tag = match[0];
    const close = sql.indexOf(tag, match.index + tag.length);
    if (close < 0) break;
    ranges.push([match.index, close + tag.length]);
    opener.lastIndex = close + tag.length;
  }
  return ranges;
}

/** psql meta-commands (\set, \echo, \i ...) only work in psql; the rehearsal sends plain SQL. */
export function psqlMetaCommandLines(sql: string): number[] {
  return sql.split(/\r?\n/).flatMap((line, index) => (/^\s*\\[a-z]/i.test(line) ? [index + 1] : []));
}

/**
 * Masks personal data that a proposal's NOTICE lines may print (for example logins without a staff profile):
 * email addresses and runs of 7 or more digits (ID, phone and member numbers). The rehearsal output is read by people
 * and tools that must not see patient data.
 */
export function maskPersonalData(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/\+?\d[\d ]{6,}\d/g, digits => (digits.replace(/\D/g, '').length >= 7 ? '<number>' : digits));
}

export interface RehearsalOptions {
  files: string[];
  commit: boolean;
  insecureTls: boolean;
}

/** Command line: file paths (default: DEFAULT_ORDER), --commit, --insecure-tls. */
export function parseArgs(argv: readonly string[]): RehearsalOptions {
  const files = argv.filter(arg => !arg.startsWith('--'));
  return {
    files: files.length > 0 ? files : [...DEFAULT_ORDER],
    commit: argv.includes('--commit'),
    insecureTls: argv.includes('--insecure-tls')
  };
}
