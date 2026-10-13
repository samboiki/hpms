import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { DEFAULT_ORDER, maskPersonalData, parseArgs, psqlMetaCommandLines, stripTransactionControl } from '../rehearsal';

// Business rule: the rehearsal runs every proposal inside ONE transaction that is rolled back, so the live database
// never changes. A proposal's own COMMIT or ROLLBACK would end that transaction early (and a COMMIT would keep its
// changes), so they must be neutralised, while PL/pgSQL function bodies stay exactly as written.
describe('preparing a proposal for the rehearsal', () => {
  it('turns top-level transaction control into comments', () => {
    const sql = 'BEGIN;\nCREATE TABLE t (id int);\nROLLBACK;  -- change to COMMIT after review\nCOMMIT;\n';
    const out = stripTransactionControl(sql);
    expect(out).toContain('-- (rehearsal) BEGIN;');
    expect(out).toContain('-- (rehearsal) ROLLBACK;  -- change to COMMIT after review');
    expect(out).toContain('-- (rehearsal) COMMIT;');
    expect(out).toContain('CREATE TABLE t (id int);');
  });

  it('leaves function bodies alone, including their BEGIN and END;', () => {
    const fn = "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$\nBEGIN\n  PERFORM 1;\nEND;\n$$;\nCREATE FUNCTION g() RETURNS void LANGUAGE plpgsql AS $body$\nBEGIN\nEND;\n$body$;\n";
    expect(stripTransactionControl(fn)).toBe(fn);
  });

  it('finds psql-only commands, which plain SQL cannot run', () => {
    expect(psqlMetaCommandLines('SELECT 1;\n\\set x 1\n  \\echo hi\n')).toEqual([2, 3]);
    expect(psqlMetaCommandLines('SELECT 1; -- a \\ in a comment is fine\n')).toEqual([]);
  });
});

// Business rule: proposal NOTICE lines can list accounts (for example logins without a staff profile); the output is
// read by people and tools that must never see patient data.
it('masks emails and long numbers in printed notices', () => {
  expect(maskPersonalData('login anna@example.com has no staff row; ID 90051700123; phone +264 81 123 4567; 12 rows'))
    .toBe('login <email> has no staff row; ID <number>; phone <number>; 12 rows');
});

describe('choosing what to run', () => {
  it('rehearses (rolls back) unless --commit is given', () => {
    expect(parseArgs([])).toEqual({ files: [...DEFAULT_ORDER], commit: false, insecureTls: false });
    expect(parseArgs(['proposals/a.sql', '--commit'])).toEqual({ files: ['proposals/a.sql'], commit: true, insecureTls: false });
  });

  // The patient app's staff-only guard covers the tables that exist when it runs, so it must come last
  it('applies the patient app proposal last, after every table it must guard', () => {
    expect(DEFAULT_ORDER[DEFAULT_ORDER.length - 1]).toBe('proposals/2026-10-07-patient-portal.sql');
    expect(DEFAULT_ORDER.indexOf('proposals/2026-10-07-receipts-and-allocations.sql')).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-remittances.sql'));
  });

  // It replaces remittance_post_document and reads account_flags and dc_first_open_day: run before those exist, it
  // would fail (or later be overwritten by the older remittance function)
  it('runs the "Do not claim" and closed-month fixes after the files they change', () => {
    const fixes = DEFAULT_ORDER.indexOf('proposals/2026-10-07-claims-flags-and-closed-months.sql');
    expect(fixes).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-remittances.sql'));
    expect(fixes).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-debtors-and-controls.sql'));
  });

  // It finishes what the RLS file started (super admins on its views, the two views it left) and must not run after
  // the portal file, whose staff-only guard and open-policy notices assume the practice policies are in place
  it('runs practice isolation after the RLS file and before the patient app guard', () => {
    const isolation = DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql');
    expect(isolation).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-rls-onehealth.sql'));
    expect(isolation).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // Its policies call the rls_* helpers practice isolation creates, and it drops the storage policies the
  // documents-bucket file alters by name: in any other order one of the files fails and the rehearsal stops
  it('runs practice isolation 2 after the helpers and bucket policies it builds on', () => {
    const second = DEFAULT_ORDER.indexOf('proposals/2026-10-08-practice-isolation-2.sql');
    expect(second).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql'));
    expect(second).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-08-documents-bucket.sql'));
    expect(second).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // set_practice_feature lets only super admins switch a practice's SMS replies by calling rls_is_super_admin(), which
  // practice isolation creates: earlier, the file stops at its first check
  it('runs the support switch for practice features after the helper it calls', () => {
    const features = DEFAULT_ORDER.indexOf('proposals/2026-10-08-practice-features-switch.sql');
    expect(features).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql'));
    expect(features).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // The records bucket's policies read the practice through rls_my_practice_id() and rls_is_super_admin(), which
  // practice isolation creates: earlier, CREATE POLICY fails and the rehearsal stops
  it('runs the private records bucket after the helpers its policies call', () => {
    const records = DEFAULT_ORDER.indexOf('proposals/2026-10-08-records-bucket.sql');
    expect(records).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql'));
    expect(records).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // Its read policy and write functions find the caller's practice through rls_my_practice_id(), which practice
  // isolation creates: earlier, the file stops at its first check
  it('runs the patient notes after the helper they call and before the patient app guard', () => {
    const notes = DEFAULT_ORDER.indexOf('proposals/2026-10-08-patient-notes.sql');
    expect(notes).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql'));
    expect(notes).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
    // The practitioners file replaces the notes file's rule and drops its old function: it must come right after it
    expect(DEFAULT_ORDER.indexOf('proposals/2026-10-08-patient-notes-practitioners.sql')).toBe(notes + 1);
  });

  // Claim corrections credit through ar_post_adjustment (receipts), resubmit through claim_rejection_act (remittances),
  // read what the funds answered (claims follow-up) and the invoice lines' ICD-10 codes, write the invoice history
  // (invoicing) and change stock_sync_invoice_line (stock) in place: earlier, its first check stops the file
  it('runs the claim corrections after everything they build on', () => {
    const corrections = DEFAULT_ORDER.indexOf('proposals/2026-10-09-claim-corrections.sql');
    for (const before of [
      'proposals/2026-10-07-receipts-and-allocations.sql',
      'proposals/2026-10-07-remittances.sql',
      'proposals/2026-10-07-invoicing.sql',
      'proposals/2026-10-07-dispensing-and-stock.sql',
      'proposals/2026-10-08-claims-follow-up.sql',
      'proposals/2026-10-08-invoice-line-codes.sql'
    ]) {
      expect(corrections).toBeGreaterThan(DEFAULT_ORDER.indexOf(before));
    }
    expect(corrections).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
    // The authorisation follow-up edits claim_line_correct and writes the column line-portions adds
    const authorisation = DEFAULT_ORDER.indexOf('proposals/2026-10-12-claim-correction-authorisation.sql');
    expect(authorisation).toBeGreaterThan(corrections);
    expect(authorisation).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-09-line-portions.sql'));
  });

  // The fund master's functions and policies call practice isolation's rls_is_super_admin and rls_my_practice_id
  // (earlier, its policies fail), and the patient app's file stays last so its staff-only guard covers the new tables
  it('runs the fund master after the practice-isolation helpers and before the patient app guard', () => {
    const funds = DEFAULT_ORDER.indexOf('proposals/2026-10-12-fund-master.sql');
    expect(funds).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql'));
    expect(funds).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // Recalls rewrite patient_list_facts() as the optometry file left it (earlier, the stopped check fires); the family
  // move calls the debtors helpers; the payment's practitioner reads allocation lines and the invoice-line practitioner
  it('runs recalls, the family account move and the payment practitioner after the files they build on', () => {
    const recalls = DEFAULT_ORDER.indexOf('proposals/2026-10-12-patient-recalls.sql');
    expect(recalls).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-08-optometry.sql'));
    expect(recalls).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-practice-isolation.sql'));
    const move = DEFAULT_ORDER.indexOf('proposals/2026-10-12-family-account-move.sql');
    expect(move).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-debtors-and-controls.sql'));
    const practitioner = DEFAULT_ORDER.indexOf('proposals/2026-10-12-allocation-practitioner.sql');
    expect(practitioner).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-09-allocation-lines.sql'));
    expect(practitioner).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-invoicing.sql'));
    for (const file of [recalls, move, practitioner]) {
      expect(file).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
    }
  });

  // The claim rules move into one function built from sync_invoice_to_batch as the referrals file left it, and the file
  // stops unless all three functions are those versions: earlier, its own checks stop it. Its undo is never run by default
  it('runs the claims consistency file after every file that edited the claim builders', () => {
    const consistency = DEFAULT_ORDER.indexOf('proposals/2026-10-13-claims-consistency.sql');
    for (const before of ['proposals/2026-10-09-line-portions.sql', 'proposals/2026-10-12-claim-correction-authorisation.sql',
      'proposals/2026-10-12-line-teeth-and-billing-practitioners.sql', 'proposals/2026-10-12-referrals-and-authorisations.sql']) {
      expect(consistency).toBeGreaterThan(DEFAULT_ORDER.indexOf(before));
    }
    expect(consistency).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
    expect(DEFAULT_ORDER).not.toContain('proposals/2026-10-13-claims-consistency-undo.sql');
    // The follow-up edits the function the first file creates, so it stops (claim_invoice_into_batch not found) earlier
    const followUp = DEFAULT_ORDER.indexOf('proposals/2026-10-13-claims-consistency-followup.sql');
    expect(followUp).toBeGreaterThan(consistency);
    expect(followUp).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
    expect(DEFAULT_ORDER).not.toContain('proposals/2026-10-13-claims-consistency-followup-undo.sql');
    // The open-batch lock reuses the lock claim-batch-numbers' trigger takes to number a batch, and its own check stops
    // it while that trigger does not take it, so it must come later
    const openBatchLock = DEFAULT_ORDER.indexOf('proposals/2026-10-13-claims-open-batch-lock.sql');
    expect(openBatchLock).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-claim-batch-numbers.sql'));
    expect(openBatchLock).toBeGreaterThan(followUp);
    expect(openBatchLock).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
    expect(DEFAULT_ORDER).not.toContain('proposals/2026-10-13-claims-open-batch-lock-undo.sql');
  });

  // The sweep names every function and table it closes (a missing one stops the whole file), and its first check needs
  // the pre-visit link to exist and be open to the public key: before any of those files it stops
  it('runs the security sweep after every file whose functions and tables it closes', () => {
    const sweep = DEFAULT_ORDER.indexOf('proposals/2026-10-13-security-sweep.sql');
    for (const before of ['proposals/2026-10-07-receipts-and-allocations.sql', 'proposals/2026-10-07-invoicing.sql',
      'proposals/2026-10-07-quotes-and-bundles.sql', 'proposals/2026-10-07-patient-lists.sql',
      'proposals/2026-10-07-fund-tariffs.sql', 'proposals/2026-10-07-diary.sql', 'proposals/2026-10-07-patient-safety.sql',
      'proposals/2026-10-09-patient-merge.sql', 'proposals/2026-10-12-line-teeth-and-billing-practitioners.sql',
      'proposals/2026-10-12-who-did-what.sql', 'proposals/2026-10-13-previsit-questionnaire.sql']) {
      expect(sweep).toBeGreaterThan(DEFAULT_ORDER.indexOf(before));
    }
    expect(sweep).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // It replaces optometry_consignment_settle (stopping if the optometry file did not leave it as expected) and records
  // consignment invoices in the supplier ledger's tables: before either file it stops at its first check
  it('puts consignment invoices on the supplier ledger after the ledger and consignment files', () => {
    const consignmentLedger = DEFAULT_ORDER.indexOf('proposals/2026-10-13-consignment-supplier-ledger.sql');
    expect(consignmentLedger).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-13-stock-stores-and-suppliers.sql'));
    expect(consignmentLedger).toBeGreaterThan(DEFAULT_ORDER.indexOf('proposals/2026-10-13-optometry-frames-and-exam.sql'));
    expect(consignmentLedger).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  // Applied before the release, it would stop today's app reading Gmail settings (it still reads the secret columns)
  it('leaves the OAuth secret columns proposal out of the default run', () => {
    expect(DEFAULT_ORDER).not.toContain('proposals/2026-10-08-oauth-secrets-columns.sql');
  });

  it('lists only proposals that exist or are being written today', () => {
    const existing = DEFAULT_ORDER.filter(file => existsSync(file));
    expect(existing.length).toBeGreaterThanOrEqual(9);
  });
});
