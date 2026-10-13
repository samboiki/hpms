import { describe, it, expect } from 'vitest';
import { isDentalPractice, isOptometryPractice } from '../billing/tariffRules';
import { needsPracticeTypeChoice, practiceTypeChanged, practiceTypeLabel, practiceTypeOptions, practiceTypeState, practiceTypeUpdate } from '../practiceType';

// Invented ids; the names are the practice_types rows of the live database
const ROWS = [
  { id: 'type-dental', name: 'dental', is_active: true },
  { id: 'type-medical', name: 'medical', is_active: true },
  { id: 'type-optometry', name: 'optometry', is_active: true },
  { id: 'type-physio', name: 'physiotherapy', is_active: true },
  { id: 'type-old', name: 'veterinary', is_active: false }
];
const OPTIONS = practiceTypeOptions(ROWS);
const option = (name: string) => OPTIONS.find(item => item.name === name)!;

describe('choosing the practice type', () => {
  // Every discipline rule reads practices.practice_type, the directory reads practice_type_id: written separately they
  // disagreed for 866 of 874 practices, so a dental practice could get no tooth chart and no dental tariff list
  it('writes both copies from one practice_types row, so they can never disagree again', () => {
    expect(practiceTypeUpdate(option('dental'))).toEqual({ practice_type: 'dental', practice_type_id: 'type-dental' });
  });

  it('writes the exact text the discipline rules recognise, so the Teeth or Eyes records follow the choice', () => {
    expect(isDentalPractice(practiceTypeUpdate(option('dental')).practice_type)).toBe(true);
    expect(isOptometryPractice(practiceTypeUpdate(option('optometry')).practice_type)).toBe(true);
    expect(isDentalPractice(practiceTypeUpdate(option('medical')).practice_type)).toBe(false);
  });

  it("shows the default 'general' as not chosen and suggests the directory's type, one tap from agreeing", () => {
    const state = practiceTypeState({ practice_type: 'general', practice_type_id: 'type-dental' }, OPTIONS);
    expect(state.current).toBeNull();
    expect(state.linkedElsewhere?.name).toBe('dental');
    expect(state.suggested?.name).toBe('dental');
    expect(practiceTypeLabel('general')).toBe('General');
  });

  it('offers a save when only the directory link is wrong, and none when both copies already agree', () => {
    expect(practiceTypeChanged({ practice_type: 'dental', practice_type_id: 'type-medical' }, option('dental'))).toBe(true);
    expect(practiceTypeChanged({ practice_type: 'dental', practice_type_id: 'type-dental' }, option('dental'))).toBe(false);
  });

  it('offers only active types, in plain words, the most common disciplines first', () => {
    expect(OPTIONS.map(item => item.label)).toEqual(['Medical practice (GP)', 'Dental', 'Optometry', 'Physiotherapy']);
  });
});

// Owner decision 13 Oct 2026: 'general' matches no price list, so Settings > Practice asks the practice to choose a type
describe("a practice still on 'general'", () => {
  it('is asked to choose its type, as is a practice with none', () => {
    expect(needsPracticeTypeChoice('general')).toBe(true);
    expect(needsPracticeTypeChoice(' General ')).toBe(true);
    expect(needsPracticeTypeChoice(null)).toBe(true);
    expect(needsPracticeTypeChoice('')).toBe(true);
    expect(needsPracticeTypeChoice('dental')).toBe(false);
  });

  it("is never offered 'general' again, even if the practice_types table has such a row", () => {
    const options = practiceTypeOptions([...ROWS, { id: 'type-general', name: 'general', is_active: true }]);
    expect(options.map(item => item.name)).not.toContain('general');
  });
});
