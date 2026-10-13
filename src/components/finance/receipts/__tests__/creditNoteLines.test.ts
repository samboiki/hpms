/**
 * Credit notes line by line (parity D24, F16). A credit must come off the portion that was billed for the line (a
 * line the fund pays is credited to the fund, or the patient's statement is wrong), never more than is left on the
 * line, and a line the fund was already sent must be reversed with the fund, or the fund pays for a service the
 * practice took back. A claim still waiting in an unsent batch is corrected there instead: crediting it would leave
 * the fund claimed in full. Invented values only.
 */
import { describe, expect, it } from 'vitest';
import { checkCreditNote, leftToCredit, splitCredit, type CreditableLine } from '../creditNoteLines';

const line = (id: string, overrides: Partial<CreditableLine> = {}): CreditableLine => ({
  id,
  code: '0190',
  description: 'Consultation',
  serviceDate: '2026-10-01',
  tooth: null,
  quantity: 1,
  totalCents: 45000,
  medicalAidCents: 45000,
  patientCents: 0,
  creditedCents: 0,
  claimedIn: null,
  waitingIn: null,
  ...overrides
});

const draft = (amounts: Array<[string, string]>, reason = 'Billed by mistake') => ({ amounts: new Map(amounts), reason });

describe('splitCredit', () => {
  it('credits a line the fund pays to the fund and a private line to the patient', () => {
    expect(splitCredit(line('a'), 45000)).toEqual({ medicalAidCents: 45000, patientCents: 0 });
    expect(splitCredit(line('a', { medicalAidCents: 0, patientCents: 45000 }), 10000)).toEqual({ medicalAidCents: 0, patientCents: 10000 });
  });

  // The same rounding as credit_note_post_lines: half a cent goes up, and the two parts always add up
  it('splits a co-paid line in proportion, to the cent', () => {
    expect(splitCredit(line('a', { totalCents: 30000, medicalAidCents: 20000, patientCents: 10000 }), 10001)).toEqual({ medicalAidCents: 6667, patientCents: 3334 });
    expect(splitCredit(line('a', { totalCents: 3, medicalAidCents: 1, patientCents: 2 }), 3)).toEqual({ medicalAidCents: 1, patientCents: 2 });
  });
});

describe('checkCreditNote', () => {
  it('credits the chosen lines with one reason and counts the reversals the fund will be sent', () => {
    const lines = [line('a', { claimedIn: { batchId: 'b5', batchNumber: 5 } }), line('b', { medicalAidCents: 0, patientCents: 20000, totalCents: 20000 })];
    const result = checkCreditNote(lines, draft([['a', '450.00'], ['b', '50']]));
    expect(result.ok).toBe(true);
    expect(result.medicalAidCents).toBe(45000);
    expect(result.patientCents).toBe(5000);
    expect(result.reversals).toBe(1);
    expect(result.lines).toEqual([{ invoice_line_id: 'a', amount: '450.00' }, { invoice_line_id: 'b', amount: '50.00' }]);
  });

  it('never credits more than is left on a line', () => {
    const credited = line('a', { creditedCents: 40000 });
    expect(leftToCredit(credited)).toBe(5000);
    expect(checkCreditNote([credited], draft([['a', '50.01']])).lineErrors.a).toBe('At most N$ 50.00 is left to credit on this line');
    expect(checkCreditNote([line('a', { creditedCents: 45000 })], draft([['a', '1']])).lineErrors.a).toBe('This line is credited in full already');
  });

  it('refuses a fund credit on a line still waiting to be claimed, but not a patient credit there', () => {
    expect(checkCreditNote([line('a', { waitingIn: 9 })], draft([['a', '100']])).lineErrors.a).toMatch(/^Waiting to be claimed in batch 9/);
    expect(checkCreditNote([line('a', { waitingIn: 9, medicalAidCents: 0, patientCents: 45000 })], draft([['a', '100']])).ok).toBe(true);
  });

  it('needs a line, a reason and amounts in cents', () => {
    expect(checkCreditNote([line('a')], draft([])).errors).toContain('Choose the lines to credit.');
    expect(checkCreditNote([line('a')], draft([['a', '10']], '  ')).errors).toContain('Say why the lines are credited: it is printed on the credit note.');
    expect(checkCreditNote([line('a')], draft([['a', '10.005']])).lineErrors.a).toBe('Enter an amount like 120.00');
  });
});
