import { describe, expect, it } from 'vitest';
import { NAMAF_DISCIPLINE_BY_PRACTICE_TYPE } from '../billing/namafTariffs';
import { practiceTypeChanged, practiceTypeGroups, practiceTypeOptions, practiceTypeState, practiceTypeUpdate } from '../practiceType';

// Every practice type the database holds: the ones with a NAMAF list and 'aesthetic' (which has none). Invented ids.
const NAMES = [...Object.keys(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE), 'aesthetic'];
const OPTIONS = practiceTypeOptions(NAMES.map(name => ({ id: `id-${name}`, name, is_active: true })));
const GROUPS = practiceTypeGroups(OPTIONS);

// Business rule (owner, 14 Oct 2026): every NAMAF discipline with a code list is a practice type, so Settings > Practice
// offers about 80 of them. One flat list that long is hard to use; a practice administrator finds the type under a
// heading ("Dental", "Specialist doctors") and loses none.
describe('the practice types under their headings in Settings > Practice', () => {
  it('lists every type once, and none is left in "Other"', () => {
    const names = GROUPS.flatMap(group => group.options.map(option => option.name));
    expect(names).toHaveLength(NAMES.length);
    expect(new Set(names).size).toBe(NAMES.length);
    expect(GROUPS.map(group => group.label)).not.toContain('Other');
  });

  it('keeps the headings in one order, the practices most people run first, and none too long to scan', () => {
    expect(GROUPS.map(group => group.label)).toEqual([
      'General practice and nursing',
      'Dental',
      'Specialist doctors',
      'Therapy and allied health',
      'Complementary medicine',
      'Hospitals, clinics and services'
    ]);
    GROUPS.forEach(group => expect(group.options.length).toBeLessThanOrEqual(30));
  });

  it('puts the dental specialists with Dental, by name', () => {
    const dental = GROUPS.find(group => group.label === 'Dental')!;
    expect(dental.options.map(option => option.label)).toEqual([
      'Dental',
      'Dental technician (laboratory)',
      'Dental therapist',
      'Maxillo-facial and oral surgeon',
      'Orthodontist',
      'Periodontist (oral medicine)',
      'Prosthodontist'
    ]);
  });

  it('puts the common practices where their discipline is looked for', () => {
    const headingOf = (name: string) => GROUPS.find(group => group.options.some(option => option.name === name))?.label;
    expect(headingOf('medical')).toBe('General practice and nursing');
    expect(headingOf('family_medicine')).toBe('General practice and nursing');
    expect(headingOf('urology')).toBe('Specialist doctors');
    expect(headingOf('optometry')).toBe('Therapy and allied health');
    expect(headingOf('chiropractor')).toBe('Complementary medicine');
    expect(headingOf('private_hospital_b')).toBe('Hospitals, clinics and services');
  });

  it('lists a type no heading names last, under "Other", so a type added in the database later is never lost', () => {
    const groups = practiceTypeGroups(practiceTypeOptions([{ id: 'a', name: 'dental', is_active: true }, { id: 'b', name: 'brand_new_type', is_active: true }]));
    expect(groups.map(group => group.label)).toEqual(['Dental', 'Other']);
    expect(groups[1].options.map(option => option.label)).toEqual(['Brand new type']);
  });

  it('leaves out a heading that has no type', () => {
    expect(practiceTypeGroups([])).toEqual([]);
    expect(practiceTypeGroups(practiceTypeOptions([{ id: 'a', name: 'dental', is_active: true }])).map(group => group.label)).toEqual(['Dental']);
  });
});

// Business rule (owner, 14 Oct 2026): one practice is typed 'dental_practice', which matches no practice type. The app
// treats it as Dental, and its stored text is not touched: Settings shows Dental and offers one save to tidy the text.
describe("the practice typed 'dental_practice' in Settings > Practice", () => {
  const dental = OPTIONS.find(option => option.name === 'dental')!;
  const practice = { practice_type: 'dental_practice', practice_type_id: dental.id };

  it('is shown as Dental, with both copies agreeing about the type', () => {
    const state = practiceTypeState(practice, OPTIONS);
    expect(state.current?.name).toBe('dental');
    expect(state.linkedElsewhere).toBeNull();
    expect(state.suggested?.name).toBe('dental');
  });

  it('can be tidied with one save, which writes the real type name over the alias', () => {
    expect(practiceTypeChanged(practice, dental)).toBe(true);
    expect(practiceTypeUpdate(dental)).toEqual({ practice_type: 'dental', practice_type_id: dental.id });
    expect(practiceTypeChanged({ practice_type: 'dental', practice_type_id: dental.id }, dental)).toBe(false);
  });
});
