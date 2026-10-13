/**
 * Owner decision 13 Oct 2026: each practice enters its own company details in Settings (the invented OneHealth block
 * went). The rules below keep a missing column from ever being written and only send what changed.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { companyChanges, companyFromRow, companyProblem, type CompanyDetails } from '../practiceCompanyService';

const details = (overrides: Partial<CompanyDetails> = {}): CompanyDetails => ({
  name: 'Example Family Practice',
  registration_number: '',
  tax_number: '',
  contact_phone: '',
  contact_email: '',
  address: '',
  city: '',
  postal_code: '',
  website_url: '',
  ...overrides
});

describe('companyFromRow', () => {
  it('a column the practices row lacks is not set up yet (never shown as empty, never written)', () => {
    const { available, details: read } = companyFromRow({ name: 'Example Family Practice', tax_number: '123', contact_phone: null });
    expect(available).toEqual(['name', 'tax_number', 'contact_phone']);
    expect(read.tax_number).toBe('123');
    expect(read.contact_phone).toBe('');
  });
});

describe('companyChanges', () => {
  it('sends only the fields that changed and that exist; a cleared field is saved as no value', () => {
    const before = details({ tax_number: '123', contact_phone: '061 000 000' });
    const after = details({ tax_number: '456', contact_phone: '', registration_number: 'CC/2020/1' });
    expect(companyChanges(before, after, ['name', 'tax_number', 'contact_phone'])).toEqual({ tax_number: '456', contact_phone: null });
  });
});

describe('companyProblem', () => {
  it('the name is required, and a mistyped email or phone is caught before saving', () => {
    expect(companyProblem(details({ name: ' ' }))).toMatch(/company name/);
    expect(companyProblem(details({ contact_email: 'reception@' }))).toMatch(/email/);
    expect(companyProblem(details({ contact_phone: 'call us' }))).toMatch(/phone/);
    expect(companyProblem(details({ contact_email: 'reception@example.com.na', contact_phone: '+264 61 000 000' }))).toBeNull();
  });
});
