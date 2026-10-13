import { describe, it, expect } from 'vitest';
import { claimInvoiceReference, isDependantRelationship, splitMemberName } from '../claimLine';

// Business rule: reception types the main member's name in many ways; the claim needs the surname (field 9)
// and the initials of the first names (field 10). A wrong split names someone the fund cannot find.
describe('splitting the main member name', () => {
  it.each([
    { name: 'Johannes Tuhafeni Shilongo', surname: 'SHILONGO', initials: 'JT' },
    { name: 'SHILONGO, Johannes Tuhafeni', surname: 'SHILONGO', initials: 'JT' },
    { name: 'SHILONGO J T', surname: 'SHILONGO', initials: 'JT' },
    { name: 'Mrs. M. Shilongo', surname: 'SHILONGO', initials: 'M' },
    { name: 'Mr Pieter van der Merwe', surname: 'VAN DER MERWE', initials: 'P' },
    { name: 'Ndapewa Shikongo-Nangolo', surname: 'SHIKONGO-NANGOLO', initials: 'N' },
    { name: 'Shilongo', surname: 'SHILONGO', initials: '' }
  ])('$name -> $surname / $initials', ({ name, surname, initials }) => {
    expect(splitMemberName(name)).toEqual({ surname, initials });
  });

  // "Surname First" is ambiguous on its own; a child usually shares the main member's surname
  it("uses the patient's surname to read a name written surname first", () => {
    expect(splitMemberName('Shilongo Johannes', 'Shilongo')).toEqual({ surname: 'SHILONGO', initials: 'J' });
    expect(splitMemberName('Shilongo Johannes')).toEqual({ surname: 'JOHANNES', initials: 'S' });
  });

  it('gives nothing for an empty name or titles only', () => {
    expect(splitMemberName('')).toBeNull();
    expect(splitMemberName(null)).toBeNull();
    expect(splitMemberName('Mr')).toBeNull();
  });
});

// Business rule: only a spouse, child or other dependant is claimed under someone else's name.
describe('who is a dependant', () => {
  it.each([
    { relationship: 'child', dependant: true },
    { relationship: 'Spouse', dependant: true },
    { relationship: 'other', dependant: true },
    { relationship: 'self', dependant: false },
    { relationship: 'Main Member', dependant: false },
    { relationship: '', dependant: false },
    { relationship: null, dependant: false }
  ])('$relationship -> $dependant', ({ relationship, dependant }) => {
    expect(isDependantRelationship(relationship)).toBe(dependant);
  });
});

// Business rule: field 24 holds 8 characters and comes back on the fund's reports, so the same invoice must
// always give the same short number, and remittance matching uses this function too.
describe('invoice number sent to the fund', () => {
  it.each([
    { invoiceNumber: '417', sent: '417' },
    { invoiceNumber: 'INV-2026-000123', sent: '26000123' },
    { invoiceNumber: '  INV2610001 ', sent: '2610001' },
    { invoiceNumber: 'MANUAL', sent: 'MANUAL' },
    { invoiceNumber: null, sent: '' }
  ])('$invoiceNumber -> $sent', ({ invoiceNumber, sent }) => {
    expect(claimInvoiceReference(invoiceNumber)).toBe(sent);
  });
});
