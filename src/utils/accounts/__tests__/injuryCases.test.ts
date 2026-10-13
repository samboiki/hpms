import { describe, expect, it } from 'vitest';
import {
  caseDetails,
  casePayerName,
  caseState,
  caseTitle,
  casesForVisit,
  draftOfInjuryCase,
  emptyInjuryCaseDraft,
  needsEmployer,
  normalizeInjuryCase,
  validateInjuryCaseDraft,
  type InjuryCase
} from '../injuryCases';

const TODAY = '2026-10-13';
const FUND = 'fund-ecf';
const EMPLOYER = 'acc-employer';

const iod = (changes: Partial<InjuryCase> = {}): InjuryCase => ({
  id: 'case-1',
  patientId: 'p1',
  type: 'injury_on_duty',
  injuryDate: '2026-10-10',
  employerAccountId: EMPLOYER,
  employerName: null,
  employeeNumber: 'E-1002',
  claimNumber: null,
  payerAccountId: FUND,
  notes: null,
  closedAt: null,
  removedAt: null,
  createdAt: '2026-10-10T08:00:00Z',
  ...changes
});

describe('reading a case', () => {
  it('drops a row without a kind or date it can show, rather than showing a case nobody can bill under', () => {
    expect(normalizeInjuryCase({ id: 'x', patient_id: 'p1', case_type: 'sports_injury', injury_date: '2026-10-10' })).toBeNull();
    expect(normalizeInjuryCase({ id: 'x', patient_id: 'p1', case_type: 'injury_on_duty', injury_date: null })).toBeNull();
    expect(normalizeInjuryCase({ id: 'x', patient_id: 'p1', case_type: 'motor_vehicle_accident', injury_date: '2026-10-10T00:00:00' })?.injuryDate).toBe('2026-10-10');
  });

  it('says what the case is and who pays in plain words', () => {
    const names = { [FUND]: "Employees' Compensation Fund (Social Security Commission)", [EMPLOYER]: 'Kalahari Builders' };
    expect(caseTitle(iod())).toBe('Injury on duty, 10 Oct 2026');
    expect(casePayerName(iod(), names)).toBe("Employees' Compensation Fund (Social Security Commission)");
    expect(casePayerName(iod({ payerAccountId: null }), names)).toBe('The patient (and their medical aid)');
    expect(caseDetails(iod(), names)).toBe('Employer Kalahari Builders, employee no E-1002, no claim number yet');
    expect(caseDetails(iod({ employerAccountId: null, employerName: 'Test Employer', claimNumber: 'ECF/1' }), names)).toBe('Employer Test Employer, employee no E-1002, claim no ECF/1');
  });

  it('offers only open cases for a new visit, the latest injury first, so a closed case is not billed again by mistake', () => {
    const cases = [
      iod({ id: 'old', injuryDate: '2026-01-05' }),
      iod({ id: 'closed', injuryDate: '2026-10-01', closedAt: '2026-10-02T10:00:00Z' }),
      iod({ id: 'removed', injuryDate: '2026-10-11', removedAt: '2026-10-11T10:00:00Z' }),
      iod({ id: 'new', injuryDate: '2026-10-12' })
    ];
    expect(casesForVisit(cases).map(item => item.id)).toEqual(['new', 'old']);
    expect(caseState(cases[1])).toBe('closed');
    expect(caseState(cases[2])).toBe('removed');
  });
});

describe('checking a case before it is saved', () => {
  it('needs the employer for an injury on duty, because the compensation fund pays with the employer\'s report', () => {
    expect(needsEmployer('injury_on_duty')).toBe(true);
    expect(needsEmployer('occupational_disease')).toBe(true);
    expect(needsEmployer('motor_vehicle_accident')).toBe(false);
    const checked = validateInjuryCaseDraft(emptyInjuryCaseDraft(TODAY), TODAY);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.errors.employerName).toMatch(/employer/);
    const mva = validateInjuryCaseDraft({ ...emptyInjuryCaseDraft(TODAY), type: 'motor_vehicle_accident' }, TODAY);
    expect(mva.ok).toBe(true);
  });

  it('refuses a date in the future, which is always a typing mistake', () => {
    const checked = validateInjuryCaseDraft({ ...emptyInjuryCaseDraft(TODAY), type: 'motor_vehicle_accident', injuryDate: '2026-10-14' }, TODAY);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.errors.injuryDate).toMatch(/future/);
  });

  it('lets the employer pay only when it is a company account the practice can bill', () => {
    const typed = validateInjuryCaseDraft({ ...emptyInjuryCaseDraft(TODAY), employerName: 'Test Employer', payer: 'employer' }, TODAY);
    expect(typed.ok).toBe(false);
    const account = validateInjuryCaseDraft({ ...emptyInjuryCaseDraft(TODAY), employerAccountId: EMPLOYER, payer: 'employer' }, TODAY);
    expect(account.ok && account.value).toMatchObject({ employer_account_id: EMPLOYER, employer_name: null, payer: 'employer' });
  });

  it('sends the typed employer only when no account is chosen, so the case names one employer', () => {
    const checked = validateInjuryCaseDraft({ ...emptyInjuryCaseDraft(TODAY), employerAccountId: EMPLOYER, employerName: 'Something typed' }, TODAY);
    expect(checked.ok && checked.value.employer_name).toBeNull();
  });

  it('reads the saved payer back as the choice that gives it', () => {
    expect(draftOfInjuryCase(iod(), FUND).payer).toBe('standard');
    expect(draftOfInjuryCase(iod({ payerAccountId: EMPLOYER }), FUND).payer).toBe('employer');
    expect(draftOfInjuryCase(iod({ payerAccountId: null }), FUND).payer).toBe('patient');
    const other = draftOfInjuryCase(iod({ payerAccountId: 'acc-insurer' }), FUND);
    expect(other).toMatchObject({ payer: 'account', payerAccountId: 'acc-insurer' });
  });
});
