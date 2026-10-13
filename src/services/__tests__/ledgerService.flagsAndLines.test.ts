/**
 * Account flags where people bill (parity A8) and what each payment covered, line by line (parity H2).
 * Amounts are cents. The line split here is the preview of what the database does with every payment
 * (ar_split_allocation_over_lines in proposals/2026-10-09-allocation-lines.sql), so a receptionist sees on
 * screen what the receipt, the invoice and the statement will say afterwards.
 */
import { describe, it, expect } from 'vitest';
import {
  BILLING_FLAG_KINDS,
  DEFAULT_INTEREST_SETTINGS,
  DEFAULT_STATEMENT_CRITERIA,
  FLAG_DEFINITIONS,
  billingFlags,
  buildStatement,
  checkFlagChange,
  checkInvoiceFlags,
  checkLineSplit,
  coverCodes,
  coverLabel,
  coverSummary,
  effectiveFlags,
  flagSummaryText,
  lineRoomCents,
  normalizeAccountFlag,
  normalizeAllocationCover,
  normalizeInvoiceLineBalance,
  overrideReasonProblem,
  planInterestRun,
  planStatementRun,
  sortLinesOldestFirst,
  splitCovers,
  suggestLineSplit,
  type AccountFlag,
  type AgeAnalysisRow,
  type AllocationCover,
  type ArAllocation,
  type ArReceipt,
  type InterestInvoice,
  type InvoiceLineOpen
} from '../ledgerService';
import { buildAllocationLines, buildReceiptPayload } from '../../components/finance/receipts/arPayloads';

// ---------------------------------------------------------------------------------------------
// Invented data
// ---------------------------------------------------------------------------------------------

const flag = (overrides: Partial<AccountFlag> & Pick<AccountFlag, 'flag'>): AccountFlag => ({
  id: `f-${overrides.flag}`,
  patientId: 'acc',
  amountCents: null,
  value: null,
  reason: 'Agreed with the account holder',
  setBy: 'u1',
  setAt: '2026-10-01T08:00:00Z',
  clearedAt: null,
  clearedBy: null,
  clearReason: null,
  ...overrides
});

const flagsOf = (...stored: AccountFlag[]) => effectiveFlags({ patientId: 'acc', holderId: null, flags: stored, smsOptOut: false });

const line = (lineId: string, overrides: Partial<InvoiceLineOpen> = {}): InvoiceLineOpen => ({
  lineId,
  invoiceId: 'inv-1',
  code: lineId.toUpperCase(),
  description: `Service ${lineId}`,
  dateKey: '2026-10-01',
  order: 1,
  billed: { medical_aid: 0, patient: 10000 },
  paid: { medical_aid: 0, patient: 0 },
  credited: { medical_aid: 0, patient: 0 },
  unpaidCents: 10000,
  ...overrides
});

// ---------------------------------------------------------------------------------------------
// A8: the two new flags
// ---------------------------------------------------------------------------------------------

describe('"No interest" and "Lay-bye" account flags', () => {
  it('keeps both on whoever pays, with a reason, because they change what the account is charged', () => {
    expect(FLAG_DEFINITIONS.no_interest).toMatchObject({ level: 'account', needsReason: true, value: 'none' });
    expect(FLAG_DEFINITIONS.lay_bye).toMatchObject({ level: 'account', needsReason: true, value: 'none' });
  });

  it('lets only an administrator or a doctor waive interest (it gives money away), but any staff member record a lay-bye agreed at the desk', () => {
    const noInterest = { kind: 'no_interest' as const, setting: true, reason: 'Pensioner, agreed by the owner' };
    expect(checkFlagChange(noInterest, null, 'receptionist')).toEqual({ ok: false, error: 'Only a practice admin or doctor can set "No interest"' });
    expect(checkFlagChange(noInterest, null, 'admin').ok).toBe(true);
    expect(checkFlagChange({ kind: 'lay_bye', setting: true, reason: 'Frames kept until paid' }, null, 'receptionist').ok).toBe(true);
    expect(checkFlagChange({ kind: 'lay_bye', setting: true, reason: '' }, null, 'receptionist').ok).toBe(false);
  });

  it('reads both from the database (they were dropped as unknown before)', () => {
    expect(normalizeAccountFlag({ id: 'x', patient_id: 'acc', flag: 'lay_bye', set_at: '2026-10-01T08:00:00Z' })?.flag).toBe('lay_bye');
    expect(normalizeAccountFlag({ id: 'y', patient_id: 'acc', flag: 'no_interest', set_at: '2026-10-01T08:00:00Z' })?.flag).toBe('no_interest');
  });
});

describe('the flags shown where people book and bill', () => {
  const all = flagsOf(
    flag({ flag: 'cash_only' }),
    flag({ flag: 'credit_limit', amountCents: 200000 }),
    flag({ flag: 'no_statement' }),
    flag({ flag: 'statement_language', value: 'af' }),
    flag({ flag: 'no_interest' }),
    flag({ flag: 'lay_bye' })
  );

  it('shows what changes how the visit is charged or paid, and leaves statement and interest settings on the patient file (calm, not cluttered)', () => {
    expect(billingFlags(all).map(item => item.kind)).toEqual(['cash_only', 'credit_limit', 'lay_bye']);
    expect(BILLING_FLAG_KINDS).not.toContain('no_statement');
    expect(BILLING_FLAG_KINDS).not.toContain('no_interest');
  });

  it("gives a diary card's one icon its words, most important first, so a screen reader hears what the colour shows", () => {
    expect(flagSummaryText(['lay_bye', 'no_statement', 'dispute', 'cash_only'])).toBe('Account: In dispute, Cash only, Lay-bye');
    // Nothing that matters for billing: no icon at all
    expect(flagSummaryText(['no_statement', 'statement_language'])).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// A8: checks when invoicing
// ---------------------------------------------------------------------------------------------

describe('checking the account when a visit is invoiced', () => {
  const invoice = { totalCents: 50000, patientCents: 10000 };

  it('makes a cash-only invoice wholly the patient\'s (nothing is claimed) and asks the person to confirm', () => {
    const result = checkInvoiceFlags({ flags: flagsOf(flag({ flag: 'cash_only' })), owedCents: null, invoice, role: 'receptionist' });
    expect(result).toMatchObject({ cashOnly: true, patientCents: 50000, overLimit: null, needsConfirmation: true });
  });

  it('asks nothing when the account has no flag that matters, so ordinary invoicing stays one click', () => {
    expect(checkInvoiceFlags({ flags: flagsOf(flag({ flag: 'no_statement' })), owedCents: 0, invoice, role: 'receptionist' }).needsConfirmation).toBe(false);
  });

  it('warns when what the account owes plus what the patient owes on this invoice goes above the limit, and only an administrator may go on', () => {
    const limited = flagsOf(flag({ flag: 'credit_limit', amountCents: 100000 }));
    const reception = checkInvoiceFlags({ flags: limited, owedCents: 95000, invoice, role: 'receptionist' });
    expect(reception.overLimit).toEqual({ limitCents: 100000, owedCents: 95000, afterCents: 105000, overCents: 5000 });
    expect(reception.canOverride).toBe(false);
    expect(checkInvoiceFlags({ flags: limited, owedCents: 95000, invoice, role: 'doctor' }).canOverride).toBe(false);
    expect(checkInvoiceFlags({ flags: limited, owedCents: 95000, invoice, role: 'admin' }).canOverride).toBe(true);
    // Exactly at the limit is still within it
    expect(checkInvoiceFlags({ flags: limited, owedCents: 90000, invoice, role: 'receptionist' }).overLimit).toBeNull();
  });

  it('counts a cash-only invoice in full against the limit, because the patient owes all of it', () => {
    const both = flagsOf(flag({ flag: 'cash_only' }), flag({ flag: 'credit_limit', amountCents: 100000 }));
    expect(checkInvoiceFlags({ flags: both, owedCents: 60000, invoice, role: 'admin' }).overLimit?.afterCents).toBe(110000);
  });

  it('does not count an invoice twice when its lines are saved again, and never trips the limit when the patient owes nothing more', () => {
    const limited = flagsOf(flag({ flag: 'credit_limit', amountCents: 100000 }));
    // The invoice already adds N$ 100.00 to the N$ 980.00 owed: saving it again at N$ 100.00 adds nothing
    expect(checkInvoiceFlags({ flags: limited, owedCents: 98000, invoice, replacingPatientCents: 10000, role: 'receptionist' }).overLimit).toBeNull();
    // A fully claimed invoice on an account already over its limit is not the patient's debt
    expect(checkInvoiceFlags({ flags: limited, owedCents: 150000, invoice: { totalCents: 50000, patientCents: 0 }, role: 'receptionist' }).overLimit).toBeNull();
  });

  it('skips the limit when what the account owes cannot be read, rather than blocking the practice', () => {
    expect(checkInvoiceFlags({ flags: flagsOf(flag({ flag: 'credit_limit', amountCents: 100 })), owedCents: null, invoice, role: 'receptionist' }).overLimit).toBeNull();
  });

  it('wants a real reason from the administrator, because it is kept with the account', () => {
    expect(overrideReasonProblem(' ok ')).toBe('Give a reason: it is kept with the account');
    expect(overrideReasonProblem('Known patient, pays monthly')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// A8: honoured where interest and statements are worked out
// ---------------------------------------------------------------------------------------------

describe('interest and statements for lay-bye and "No interest" accounts', () => {
  const on = { ...DEFAULT_INTEREST_SETTINGS, enabled: true, annualRatePercent: 12, minAgeDays: 60 };
  const old = (invoiceId: string, patientId: string): InterestInvoice => ({
    invoiceId, invoiceNumber: invoiceId.toUpperCase(), patientId, ageDays: 120, patientOwedCents: 100000, medicalAidOwedCents: 0, interestChargedCents: 0
  });

  it('never charges interest on an account paying off a lay-bye as agreed, or one marked "No interest" (the database refuses the same)', () => {
    const plan = planInterestRun([old('a', 'lay'), old('b', 'free'), old('c', 'plain')], on, { lay: ['lay_bye'], free: ['no_interest'] });
    expect(plan.excluded.map(item => [item.invoiceId, item.reason])).toEqual([['a', 'lay_bye'], ['b', 'no_interest']]);
    expect(plan.lines.map(item => item.invoiceId)).toEqual(['c']);
  });

  // Both accounts owe N$ 300.00 from 10 days ago
  const row = (accountId: string, flags: AgeAnalysisRow['flags']): AgeAnalysisRow => ({
    key: accountId, label: `Account ${accountId}`, accountId, patientIds: [accountId],
    bands: { current: 30000, days_30: 0, days_60: 0, days_90: 0, days_120: 0, days_150: 0, days_180_plus: 0 },
    medicalAidCents: 0, patientCents: 30000, owedCents: 30000, unallocatedCents: 0, netCents: 30000, invoiceCount: 1, oldestAgeDays: 10, flags
  });

  it('still sends a lay-bye its statement when the run only wants debts 30 days old: nothing on a lay-bye is overdue, but the patient needs to see what is left', () => {
    const plan = planStatementRun({
      accounts: [row('lay', ['lay_bye']), row('plain', [])],
      criteria: { ...DEFAULT_STATEMENT_CRITERIA, minAgeDays: 30, channels: ['print'] },
      contacts: {},
      fundByPatient: {}
    });
    expect(plan.statements.map(item => item.patientId)).toEqual(['lay']);
    expect(plan.skipped).toEqual([{ patientId: 'plain', name: 'Account plain', reason: 'too_recent' }]);
  });
});

// ---------------------------------------------------------------------------------------------
// H2: the split over an invoice's lines
// ---------------------------------------------------------------------------------------------

describe('which lines a payment covers when nobody chooses (oldest line first)', () => {
  it('pays the oldest line first, each line no more than is unpaid on it, and keeps what fits on no line apart', () => {
    const lines = [line('b', { dateKey: '2026-10-02' }), line('a', { dateKey: '2026-10-01' })];
    expect(suggestLineSplit(15000, 'patient', lines)).toEqual({ lines: [{ lineId: 'a', amountCents: 10000 }, { lineId: 'b', amountCents: 5000 }], offLineCents: 0 });
    // N$ 50.00 of interest on top of two N$ 100.00 lines is on none of them
    expect(suggestLineSplit(25000, 'patient', lines).offLineCents).toBe(5000);
  });

  it("pays each line's own portion first, so a co-payment is matched to the line it came from", () => {
    const lines = [
      line('consult', { order: 1, billed: { medical_aid: 8000, patient: 2000 }, unpaidCents: 10000 }),
      line('medicine', { order: 2, billed: { medical_aid: 0, patient: 5000 }, unpaidCents: 5000 })
    ];
    expect(suggestLineSplit(7000, 'patient', lines).lines).toEqual([{ lineId: 'consult', amountCents: 2000 }, { lineId: 'medicine', amountCents: 5000 }]);
    expect(suggestLineSplit(8000, 'medical_aid', lines).lines).toEqual([{ lineId: 'consult', amountCents: 8000 }]);
  });

  it('lets a patient pay what a fund did not, once it was moved to them, but never lets a fund pay the patient\'s part', () => {
    // The fund paid N$ 300.00 of a N$ 400.00 line; the N$ 100.00 shortfall was moved to the patient
    const shortPaid = [line('x', { billed: { medical_aid: 40000, patient: 0 }, paid: { medical_aid: 30000, patient: 0 }, unpaidCents: 10000 })];
    expect(suggestLineSplit(10000, 'patient', shortPaid)).toEqual({ lines: [{ lineId: 'x', amountCents: 10000 }], offLineCents: 0 });
    const patientsLine = [line('y', { billed: { medical_aid: 0, patient: 10000 }, unpaidCents: 10000 })];
    expect(suggestLineSplit(10000, 'medical_aid', patientsLine)).toEqual({ lines: [], offLineCents: 10000 });
  });

  // A patient must never be asked to pay, or have a payment allocated against, money a credit note already took off:
  // the receipt would say it paid a service the practice cancelled, and the account would look owed when it is not
  it('leaves nothing to pay on a line credited in full, so a payment goes to the lines still owed', () => {
    const lines = [
      line('credited', { order: 1, credited: { medical_aid: 0, patient: 10000 }, unpaidCents: 0 }),
      line('open', { order: 2 })
    ];
    expect(lineRoomCents(lines[0], 'patient')).toBe(0);
    expect(suggestLineSplit(10000, 'patient', lines)).toEqual({ lines: [{ lineId: 'open', amountCents: 10000 }], offLineCents: 0 });
    expect(checkLineSplit(100, 'patient', lines, [{ lineId: 'credited', amountCents: 100 }]).lineErrors).toEqual({ credited: 'More than the N$ 0.00 still unpaid on this line' });
    // The fund's part credited: a fund payment has no room left on that line either
    const fundCredited = line('x', { billed: { medical_aid: 8000, patient: 2000 }, credited: { medical_aid: 8000, patient: 0 }, unpaidCents: 2000 });
    expect(lineRoomCents(fundCredited, 'medical_aid')).toBe(0);
  });

  it('leaves only the rest to pay on a part-credited line, and never lets a payment go beyond it', () => {
    // N$ 100.00 line, N$ 40.00 credited: N$ 60.00 is left
    const partly = [line('partly', { order: 1, credited: { medical_aid: 0, patient: 4000 }, unpaidCents: 6000 }), line('next', { order: 2 })];
    expect(lineRoomCents(partly[0], 'patient')).toBe(6000);
    expect(suggestLineSplit(10000, 'patient', partly).lines).toEqual([{ lineId: 'partly', amountCents: 6000 }, { lineId: 'next', amountCents: 4000 }]);
    expect(checkLineSplit(7000, 'patient', partly, [{ lineId: 'partly', amountCents: 7000 }]).lineErrors).toEqual({ partly: 'More than the N$ 60.00 still unpaid on this line' });
    expect(checkLineSplit(6000, 'patient', partly, [{ lineId: 'partly', amountCents: 6000 }]).ok).toBe(true);
  });

  it('orders undated lines first and then in the order they were added, as the database does', () => {
    const lines = [line('late', { dateKey: '2026-10-05', order: 1 }), line('second', { dateKey: null, order: 2 }), line('first', { dateKey: null, order: 1 })];
    expect(sortLinesOldestFirst(lines).map(item => item.lineId)).toEqual(['first', 'second', 'late']);
  });
});

describe('lines chosen by staff', () => {
  const lines = [line('consult', { billed: { medical_aid: 8000, patient: 2000 }, unpaidCents: 10000 }), line('medicine')];

  it('lets the patient pay the medicine and leave the consultation for the fund', () => {
    expect(checkLineSplit(10000, 'patient', lines, [{ lineId: 'medicine', amountCents: 10000 }])).toEqual({ ok: true, error: null, lineErrors: {}, totalCents: 10000 });
  });

  it('refuses more than a line still owes, a line of another invoice, and lines that do not make the amount paid', () => {
    expect(checkLineSplit(12000, 'patient', lines, [{ lineId: 'medicine', amountCents: 12000 }]).lineErrors).toEqual({ medicine: 'More than the N$ 100.00 still unpaid on this line' });
    expect(checkLineSplit(500, 'patient', lines, [{ lineId: 'elsewhere', amountCents: 500 }]).lineErrors).toEqual({ elsewhere: 'Not a line of this invoice' });
    expect(checkLineSplit(10000, 'patient', lines, [{ lineId: 'medicine', amountCents: 6000 }]).error).toBe('The lines add up to N$ 60.00, not the N$ 100.00 paid on this invoice');
  });

  it("limits a fund to its own part of a line (the database's rule)", () => {
    expect(lineRoomCents(lines[0], 'medical_aid')).toBe(8000);
    expect(lineRoomCents(lines[0], 'patient')).toBe(10000);
  });
});

describe('what a payment covered, in words', () => {
  const covers: AllocationCover[] = [
    { allocationId: 'a1', invoiceLineId: 'l1', code: '0190', description: 'Consultation', dateKey: '2026-10-01', portion: 'patient', amountCents: 20000, chosen: false },
    { allocationId: 'a1', invoiceLineId: 'l2', code: '0190', description: 'Consultation', dateKey: '2026-10-01', portion: 'patient', amountCents: 5000, chosen: false },
    { allocationId: 'a1', invoiceLineId: null, code: null, description: null, dateKey: null, portion: 'patient', amountCents: 1000, chosen: false }
  ];

  it('names each line with its amount for receipts, and each code once for statements', () => {
    expect(coverSummary(covers.slice(0, 1))).toBe('0190 Consultation N$ 200.00');
    expect(coverCodes(covers)).toBe('0190, other');
    expect(coverLabel(covers[2])).toBe('Not on a line (interest or a correction)');
  });

  it('words a split before it is saved the same way as a saved one', () => {
    const lines = [line('l1', { code: '0190', description: 'Consultation' })];
    expect(splitCovers({ lines: [{ lineId: 'l1', amountCents: 2500 }], offLineCents: 700 }, lines, 'patient').map(coverLabel))
      .toEqual(['0190 Consultation', 'Not on a line (interest or a correction)']);
  });

  it('reads the database rows (numbers arrive as text)', () => {
    expect(normalizeInvoiceLineBalance({
      invoice_line_id: 'l1', invoice_id: 'inv', code: '0190', description: 'Consultation', line_date: '2026-10-01', line_order: 3,
      billed: '100.00', medical_aid_billed: '80.00', patient_billed: '20.00', medical_aid_paid: '80.00', patient_paid: '0', unpaid: '15.00',
      medical_aid_credited: '0', patient_credited: '5.00'
    })).toEqual({
      lineId: 'l1', invoiceId: 'inv', code: '0190', description: 'Consultation', dateKey: '2026-10-01', order: 3,
      billed: { medical_aid: 8000, patient: 2000 }, paid: { medical_aid: 8000, patient: 0 }, credited: { medical_aid: 0, patient: 500 }, unpaidCents: 1500
    });
    expect(normalizeAllocationCover({ id: 'r', allocation_id: 'a1', invoice_line_id: null, portion: 'patient', amount: '10.00', source: 'chosen' }))
      .toMatchObject({ allocationId: 'a1', invoiceLineId: null, amountCents: 1000, chosen: true, practitionerId: null });
  });

  // Parity H4: one receipt can pay the work of several practitioners; the receipt says whose work each line paid, as
  // "Cash flow per practitioner" counts it
  it('names the practitioner of each line paid, and says "Former practitioner" for one no longer at the practice', () => {
    const withPractitioners: AllocationCover[] = [
      { ...covers[0], practitionerId: 'dr-a' },
      { ...covers[1], practitionerId: 'dr-gone' },
      { ...covers[2], practitionerId: null }
    ];
    const names: Record<string, string> = { 'dr-a': 'Dr A Shikongo' };
    expect(coverSummary(withPractitioners, (id) => names[id] ?? null)).toBe(
      '0190 Consultation (Dr A Shikongo) N$ 200.00 · 0190 Consultation (Former practitioner) N$ 50.00 · Not on a line (interest or a correction) N$ 10.00'
    );
    // Without names (still loading) the receipt reads as before
    expect(coverSummary(withPractitioners.slice(0, 1))).toBe('0190 Consultation N$ 200.00');
    expect(normalizeAllocationCover({ id: 'r', allocation_id: 'a1', invoice_line_id: 'l1', portion: 'patient', amount: '5.00', practitioner_id: 'dr-a' }))
      .toMatchObject({ practitionerId: 'dr-a' });
  });
});

describe('statements say what each payment covered', () => {
  const receipt: ArReceipt = {
    id: 'r1', number: 'RC-000007', payerType: 'patient', patientId: 'pt', fundName: null, payerName: null, method: 'cash', amountCents: 20000,
    receivedOn: '2026-10-05', reference: null, source: 'manual', notes: null, createdBy: null, createdAt: '2026-10-05T09:00:00Z', reversal: null,
    allocatedCents: 20000, refundedCents: 0, unallocatedCents: 0
  };
  const allocation = (covers?: AllocationCover[]): ArAllocation => ({
    id: 'a1', receiptId: 'r1', invoiceId: 'inv', portion: 'patient', amountCents: 20000, createdBy: null, createdAt: '2026-10-05T09:00:00Z', reversal: null, covers
  });
  const statementOf = (allocations: ArAllocation[]) => buildStatement({
    patientId: 'pt',
    invoices: [{ id: 'inv', invoiceNumber: 'INV-9', dateKey: '2026-10-01', billed: { medical_aid: 0, patient: 20000 }, cancelled: false }],
    receipts: [receipt],
    allocations,
    adjustments: []
  });

  it('adds the codes to the receipt line, so the patient sees which services the money paid', () => {
    const covered = [{ allocationId: 'a1', invoiceLineId: 'l1', code: '0190', description: 'Consultation', dateKey: '2026-10-01', portion: 'patient' as const, amountCents: 20000, chosen: true }];
    const receiptLine = statementOf([allocation(covered)]).lines.find(item => item.kind === 'receipt');
    expect(receiptLine).toMatchObject({ description: 'Receipt RC-000007 (cash), for 0190', covered: '0190' });
  });

  it('words a payment as before when what it covered is not known (before the update, or old data)', () => {
    const receiptLine = statementOf([allocation()]).lines.find(item => item.kind === 'receipt');
    expect(receiptLine?.description).toBe('Receipt RC-000007 (cash)');
    expect(receiptLine?.covered).toBeUndefined();
  });
});

describe('the receipt payload with chosen lines', () => {
  const base = { practiceId: 'p1', payerType: 'patient' as const, patientId: 'pt', method: 'cash' as const, amountCents: 10000 };

  it('sends the lines staff chose with their allocation, amounts exact to the cent', () => {
    const payload = buildReceiptPayload({ ...base, allocations: [{ invoiceId: 'inv', portion: 'patient', amountCents: 10000, lines: [{ lineId: 'med', amountCents: 10000 }, { lineId: 'skip', amountCents: 0 }] }] });
    expect(payload.allocations).toEqual([{ invoice_id: 'inv', portion: 'patient', amount: '100.00', external_ref: null, lines: [{ invoice_line_id: 'med', amount: '100.00' }] }]);
  });

  it('sends no lines when nobody chose, so the database splits it oldest line first (as before)', () => {
    const payload = buildReceiptPayload({ ...base, allocations: [{ invoiceId: 'inv', portion: 'patient', amountCents: 10000 }] });
    expect(payload.allocations).toEqual([{ invoice_id: 'inv', portion: 'patient', amount: '100.00', external_ref: null }]);
    expect(buildAllocationLines([{ invoiceId: 'inv', portion: 'patient', amountCents: 500, lines: [{ lineId: 'l', amountCents: 500 }] }]))
      .toEqual([{ invoice_id: 'inv', portion: 'patient', amount: '5.00', lines: [{ invoice_line_id: 'l', amount: '5.00' }] }]);
  });
});
