import { describe, expect, it } from 'vitest';
import { describeLimit, noteForFund, validateFundNoteDraft, type FundNote } from '../fundNotes';

const note = (values: Partial<FundNote>): FundNote => ({
  id: 'n', fundReference: 'NMC1', planOption: null, note: 'Spectacles every 24 months', limitCents: null, cycleMonths: null, ...values
});

// Business rule: OneHealth invents no benefit tables; the practice's own note for the patient's fund (and option) is
// what staff see when the patient chooses spectacles
describe('the optical benefit note for a patient', () => {
  const fundNote = note({ id: 'fund' });
  const optionNote = note({ id: 'option', planOption: 'Saver', note: 'Saver: frames up to N$ 900' });

  it('prefers the note for the patient\'s option, matched without case', () => {
    expect(noteForFund([fundNote, optionNote], { reference: 'nmc1', planOptions: ['SAVER'] })?.id).toBe('option');
  });

  it('falls back to the fund\'s own note for another option', () => {
    expect(noteForFund([fundNote, optionNote], { reference: 'NMC1', planOptions: ['Comprehensive'] })?.id).toBe('fund');
  });

  it('shows nothing for a patient without a medical aid, or a fund without a note', () => {
    expect(noteForFund([fundNote], null)).toBeNull();
    expect(noteForFund([fundNote], { reference: 'MAG1', planOptions: [] })).toBeNull();
    expect(noteForFund([optionNote], { reference: 'NMC1', planOptions: [] })).toBeNull();
  });

  it('writes the limit and cycle in plain words', () => {
    expect(describeLimit({ limitCents: 150000, cycleMonths: 24 })).toBe('Limit N$ 1,500.00 every 24 months');
    expect(describeLimit({ limitCents: null, cycleMonths: 12 })).toBe('Benefit cycle: every 12 months');
    expect(describeLimit({ limitCents: null, cycleMonths: null })).toBe('');
  });
});

describe('writing a note', () => {
  it('keeps the fund code in capitals and reads the limit as people write it ("1 500", "N$ 1,500")', () => {
    const expected = {
      ok: true,
      payload: { id: null, fund_reference: 'NHPM', plan_option: null, note: 'Pre-authorise multifocals', limit_amount: 1500, cycle_months: 24 }
    };
    expect(validateFundNoteDraft({ fundReference: 'nhpm', planOption: '', note: ' Pre-authorise multifocals ', limit: '1 500', cycleMonths: '24' })).toEqual(expected);
    expect(validateFundNoteDraft({ fundReference: 'NHPM', planOption: ' ', note: 'Pre-authorise multifocals', limit: 'N$ 1,500', cycleMonths: '24' })).toEqual(expected);
    expect(validateFundNoteDraft({ fundReference: 'NHPM', planOption: '', note: 'x', limit: 'a lot', cycleMonths: '61' })).toMatchObject({
      ok: false,
      errors: { limit: expect.any(String), cycleMonths: expect.any(String) }
    });
  });

  it('needs the fund and the note itself', () => {
    expect(validateFundNoteDraft({ fundReference: '', planOption: '', note: '', limit: '', cycleMonths: '' })).toMatchObject({
      ok: false,
      errors: { fundReference: expect.any(String), note: expect.any(String) }
    });
  });
});
