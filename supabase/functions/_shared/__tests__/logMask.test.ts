import { describe, it, expect } from 'vitest';
import { maskEmail, maskPhone } from '../logMask';

// Function logs are kept and read by support: a patient's number or address must never appear there in full,
// while enough stays visible to tell two messages apart when tracing a delivery problem.
describe('contact details in function logs', () => {
  it('keeps only the first letter and the domain of an email address', () => {
    expect(maskEmail('anna.example@mail.example.com')).toBe('a***@mail.example.com');
  });

  it('hides a value that is not an email address at all', () => {
    expect(maskEmail('not-an-address')).toBe('***');
    expect(maskEmail('')).toBe('');
    expect(maskEmail(null)).toBe('');
  });

  it('keeps only the country code and the last four digits of a number', () => {
    expect(maskPhone('+264811234567')).toBe('+264*****4567');
  });
});
