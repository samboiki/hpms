import { describe, expect, it } from 'vitest';
import {
  BILLING_ROLES,
  billingRightsProblem,
  canRaiseInvoices,
  defaultTreatingPractitionerId,
  isClinician,
  practitionerLabel,
  treatingPractitionerOptions,
  type StaffMember
} from '../invoiceRights';

const staff = (id: string, role: string, overrides: Partial<StaffMember> = {}): StaffMember => ({
  id,
  role,
  is_active: true,
  full_name: `Person ${id}`,
  hpcsa_number: `MP${id.toUpperCase()}`,
  ...overrides
});

describe('who may raise an invoice', () => {
  // Reception bills at the front desk; before this only doctors could, so patients waited for the practitioner
  it.each(BILLING_ROLES)('lets an active %s raise invoices', role => {
    expect(billingRightsProblem({ role, is_active: true })).toBeNull();
    expect(canRaiseInvoices({ role })).toBe(true);
  });

  it('reads the role without case or spaces, as stored by older forms', () => {
    expect(canRaiseInvoices({ role: ' Receptionist ' })).toBe(true);
  });

  // A switched-off account (staff member who left) must not be able to bill the practice's patients
  it('refuses a switched-off account and says who can help', () => {
    expect(billingRightsProblem({ role: 'doctor', is_active: false })).toMatch(/switched off.*administrator/);
  });

  it('refuses roles without billing rights and names the roles that have them', () => {
    expect(billingRightsProblem({ role: 'patient' })).toBe(
      'Your role (patient) cannot create invoices. Administrators, doctors, nurses and receptionists can.'
    );
    expect(billingRightsProblem({ role: null })).toMatch(/role \(not set\)/);
  });

  it('asks to sign in again when nobody is signed in', () => {
    expect(billingRightsProblem(null)).toBe('Sign in again to create invoices.');
  });
});

describe('the treating practitioner', () => {
  it('only offers active clinicians: doctors first, then nurses, by name', () => {
    const options = treatingPractitionerOptions([
      staff('n1', 'nurse', { full_name: 'Anna Nurse' }),
      staff('r1', 'receptionist', { full_name: 'Rita Front' }),
      staff('d2', 'doctor', { full_name: 'Zed Doctor' }),
      staff('d1', 'doctor', { full_name: 'Dr. Amy Doctor' }),
      staff('d3', 'doctor', { full_name: 'Old Doctor', is_active: false })
    ]);
    expect(options.map(option => option.id)).toEqual(['d1', 'd2', 'n1']);
    // One "Dr." even when the stored name already has it (formatDoctorName)
    expect(options[0].label).toBe('Dr. Amy Doctor');
    expect(options[2].label).toBe('Anna Nurse');
  });

  // An older visit must still show who treated the patient after that practitioner left the practice
  it('keeps the visit practitioner in the list even when their account was switched off', () => {
    const options = treatingPractitionerOptions([staff('d3', 'doctor', { is_active: false })], ['d3']);
    expect(options.map(option => option.id)).toEqual(['d3']);
  });

  // The fund rejects a claim without the treating practitioner's HPCNA number: warn before the invoice is saved
  it('warns about a practitioner without an HPCNA number, because the claim would be stopped', () => {
    const [option] = treatingPractitionerOptions([staff('d1', 'doctor', { hpcsa_number: '  ' })]);
    expect(option.hpcnaNumber).toBeNull();
    expect(option.warning).toMatch(/No HPCNA number/);
    expect(treatingPractitionerOptions([staff('d2', 'doctor')])[0].warning).toBeNull();
  });

  it('lists each person once even when the staff list repeats them', () => {
    expect(treatingPractitionerOptions([staff('d1', 'doctor'), staff('d1', 'doctor')])).toHaveLength(1);
  });

  // Reception raising the invoice must not become the treating practitioner on the claim
  it('defaults to the visit practitioner, not to whoever raises the invoice', () => {
    const receptionist = staff('r1', 'receptionist');
    expect(defaultTreatingPractitionerId({ visitPractitionerId: 'd1', raiser: receptionist })).toBe('d1');
    expect(defaultTreatingPractitionerId({ visitPractitionerId: null, raiser: receptionist })).toBeNull();
  });

  it('falls back to the clinician raising the invoice when the visit has no practitioner', () => {
    expect(defaultTreatingPractitionerId({ visitPractitionerId: '', raiser: staff('d9', 'doctor') })).toBe('d9');
    expect(defaultTreatingPractitionerId({ raiser: staff('n9', 'nurse', { is_active: false }) })).toBeNull();
  });

  it('treats only active doctors and nurses as clinicians', () => {
    expect(isClinician({ role: 'doctor' })).toBe(true);
    expect(isClinician({ role: 'nurse', is_active: true })).toBe(true);
    expect(isClinician({ role: 'admin' })).toBe(false);
    expect(isClinician({ role: 'doctor', is_active: false })).toBe(false);
  });

  it('labels a nurse by name and a nameless record plainly', () => {
    expect(practitionerLabel({ role: 'nurse', full_name: 'Maria' })).toBe('Maria');
    expect(practitionerLabel({ role: 'doctor', full_name: '' })).toBe('Unnamed practitioner');
  });
});
