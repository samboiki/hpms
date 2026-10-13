import { describe, expect, it } from 'vitest';
import { billsAccount, choiceOfVisit, choiceValue, parseChoice, sameChoice, visitPayerOptions, visitPayerPayload } from '../visitPayer';
import type { InjuryCase } from '../injuryCases';
import type { PayerAccount, PayerMember } from '../payerAccounts';

const account = (id: string, changes: Partial<PayerAccount> = {}): PayerAccount => ({
  id,
  practiceId: 'pr',
  kind: 'employer',
  name: `Company ${id}`,
  accountNumber: 'AC-0001',
  registrationNumber: null,
  vatNumber: null,
  contactName: null,
  phone: null,
  email: null,
  postalAddress: null,
  town: null,
  region: null,
  notes: null,
  createdAt: null,
  closedAt: null,
  closeReason: null,
  ...changes
});

const member = (accountId: string, unlinkedAt: string | null = null): PayerMember => ({
  id: `m-${accountId}`,
  accountId,
  patientId: 'p1',
  employeeNumber: null,
  linkedAt: null,
  unlinkedAt,
  unlinkReason: null
});

const injury = (id: string, payerAccountId: string | null, closedAt: string | null = null): InjuryCase => ({
  id,
  patientId: 'p1',
  type: 'injury_on_duty',
  injuryDate: '2026-10-10',
  employerAccountId: null,
  employerName: 'Test Employer',
  employeeNumber: null,
  claimNumber: null,
  payerAccountId,
  notes: null,
  closedAt,
  removedAt: null,
  createdAt: null
});

describe('the choices for a visit', () => {
  it('offers the patient, the employer accounts the patient is on and the open cases, nothing more', () => {
    const options = visitPayerOptions({
      accounts: [account('a1'), account('a2'), account('fund', { kind: 'compensation_fund', name: 'ECF' })],
      members: [member('a1'), member('a2', '2026-01-01T00:00:00Z')],
      cases: [injury('c1', 'fund'), injury('c2', 'fund', '2026-10-11T00:00:00Z')],
      current: { mode: 'patient' }
    });
    expect(options.map(option => option.value)).toEqual(['patient', 'account:a1', 'case:c1']);
    expect(options[2].detail).toMatch(/Billed to ECF under the case/);
  });

  it('still shows what is saved even when that account closed or the case closed since', () => {
    const options = visitPayerOptions({
      accounts: [account('a1', { closedAt: '2026-10-01T00:00:00Z' })],
      members: [],
      cases: [injury('c2', 'fund', '2026-10-11T00:00:00Z')],
      current: { mode: 'case', caseId: 'c2' }
    });
    expect(options.map(option => option.value)).toEqual(['patient', 'case:c2']);
  });
});

describe('what a choice means for the invoice', () => {
  it('makes the invoice private only when an account pays, because the patient\'s medical aid must not be claimed for it', () => {
    const cases = [injury('fund-paid', 'fund'), injury('patient-paid', null)];
    expect(billsAccount({ mode: 'account', accountId: 'a1' }, cases)).toBe(true);
    expect(billsAccount({ mode: 'case', caseId: 'fund-paid' }, cases)).toBe(true);
    expect(billsAccount({ mode: 'case', caseId: 'patient-paid' }, cases)).toBe(false);
    expect(billsAccount({ mode: 'patient' }, cases)).toBe(false);
  });

  it('reads the saved row back as the choice it came from (a case wins over its payer)', () => {
    expect(choiceOfVisit(null)).toEqual({ mode: 'patient' });
    expect(choiceOfVisit({ visitId: 'v', accountId: 'a1', caseId: null })).toEqual({ mode: 'account', accountId: 'a1' });
    expect(choiceOfVisit({ visitId: 'v', accountId: 'fund', caseId: 'c1' })).toEqual({ mode: 'case', caseId: 'c1' });
  });

  it('round-trips the select value and sends set_visit_payer exactly what it reads', () => {
    for (const choice of [{ mode: 'patient' as const }, { mode: 'account' as const, accountId: 'a1' }, { mode: 'case' as const, caseId: 'c1' }]) {
      expect(sameChoice(parseChoice(choiceValue(choice)), choice)).toBe(true);
    }
    expect(parseChoice('account:')).toEqual({ mode: 'patient' });
    expect(visitPayerPayload({ mode: 'case', caseId: 'c1' }, '  ')).toEqual({ mode: 'case', case_id: 'c1' });
    expect(visitPayerPayload({ mode: 'account', accountId: 'a1' }, 'Pre-employment medical')).toEqual({ mode: 'account', account_id: 'a1', reason: 'Pre-employment medical' });
  });
});
