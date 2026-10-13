import { describe, it, expect } from 'vitest';
import { passwordProblem } from '../passwordRules';

// Business rule: a staff login opens patient records, so an invited person must choose a password that is not
// trivially guessed, and typing it twice catches a typo that would otherwise lock them out on their first sign-in.
describe('choosing a password', () => {
  it.each([
    { password: '', confirmation: '', problem: /Choose a password/ },
    { password: 'abc123', confirmation: 'abc123', problem: /at least 8/ },
    { password: 'abcdefgh', confirmation: 'abcdefgh', problem: /letter and one number/ },
    { password: '12345678', confirmation: '12345678', problem: /letter and one number/ },
    { password: 'Clinic2026', confirmation: 'Clinic2025', problem: /not the same/ }
  ])('refuses "$password"', ({ password, confirmation, problem }) => {
    expect(passwordProblem(password, confirmation)).toMatch(problem);
  });

  it('accepts a long enough password with a letter and a number, typed the same twice', () => {
    expect(passwordProblem('Clinic2026', 'Clinic2026')).toBeNull();
  });
});
