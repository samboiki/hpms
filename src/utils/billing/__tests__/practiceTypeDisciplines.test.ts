/**
 * The built-in copy of the practice types' NAMAF disciplines is the same list the database got. Why it matters: the app
 * reads practice_types.namaf_discipline_code and falls back to the copy only while that column is missing. Two lists
 * that disagree would bill a practice from one discipline before the migration and another after it (an optometrist
 * from the wrong price list), and nobody would see why. The migration is the list the database holds.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAMAF_DISCIPLINE_BY_PRACTICE_TYPE } from '../namafTariffs';
import { practiceTypeLabel, practiceTypeOptions } from '../../practiceType';

const SQL = readFileSync('proposals/2026-10-14-practice-type-disciplines.sql', 'utf8');
// Section 2 inserts the missing types, section 3 sets the discipline of every type
const inserted = [...SQL.slice(SQL.indexOf('INSERT INTO public.practice_types'), SQL.indexOf('ON CONFLICT (name)')).matchAll(/\('([a-z_]+)',/g)].map(match => match[1]);
const links = [...SQL.slice(SQL.indexOf('FROM (VALUES'), SQL.indexOf(') AS v(name, code)')).matchAll(/\('([a-z_]+)',\s*'(\d{3}(?:\d{3})?)'\)/g)].map(match => [match[1], match[2]] as const);
// The second migration (the dental specialists and every other discipline with a code list) inserts each type with its
// discipline in one statement: ('name', 'description', true, 'code')
const MORE_SQL = readFileSync('proposals/2026-10-14-more-practice-types.sql', 'utf8');
const more = [
  ...MORE_SQL.slice(MORE_SQL.indexOf('INSERT INTO public.practice_types'), MORE_SQL.indexOf('ON CONFLICT (name)')).matchAll(
    /\('([a-z0-9_]+)',\s*'[^']*',\s*true,\s*'(\d{3}(?:\d{3})?)'\)/g
  )
].map(match => [match[1], match[2]] as const);

describe("the practice types' NAMAF disciplines", () => {
  it('are the same in the app and in the migrations, so a practice bills from the same list before and after they run', () => {
    expect(links.length).toBeGreaterThanOrEqual(28);
    expect(more).toHaveLength(54);
    expect(Object.fromEntries([...links, ...more])).toEqual(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE);
  });

  it('give every added practice type a discipline, and no discipline twice for one type', () => {
    expect(inserted).toHaveLength(11);
    const names = [...links, ...more].map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
    inserted.forEach(name => expect(names).toContain(name));
  });

  // Business rule: every type is a real NAMAF list. The migration checks each discipline against the loaded list; here the
  // codes are held to the format the column accepts, so a typo cannot ship in the fallback copy
  it('use codes of the shape the column accepts, the dental specialists on their own lists', () => {
    Object.values(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE).forEach(code => expect(code).toMatch(/^\d{3}(\d{3})?$/));
    expect(Object.fromEntries(more.filter(([name]) => name.match(/^(orthodontist|maxillofacial_oral_surgeon|periodontist|prosthodontist|dental_therapist)$/)))).toEqual({
      orthodontist: '064',
      maxillofacial_oral_surgeon: '062',
      periodontist: '092',
      prosthodontist: '094',
      dental_therapist: '095'
    });
  });

  it('are offered in Settings > Practice in plain words, after the types that were there before', () => {
    const rows = [...Object.keys(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE), 'aesthetic'].map(name => ({ id: `id-${name}`, name, is_active: true }));
    const options = practiceTypeOptions(rows);
    const labelOf = (name: string) => options.find(option => option.name === name)?.label;
    expect(inserted.map(labelOf)).toEqual([
      'Anaesthetics',
      'Internal medicine (specialist physician)',
      'Psychiatry',
      'General surgery',
      'Urology',
      'Occupational therapy',
      'Speech therapy and audiology',
      'Dietetics',
      'Biokinetics',
      'Private hospital (A tariff)',
      'Day clinic'
    ]);
    // The order the practice administrator already knew does not change: the old types first, the added ones after
    const position = (name: string) => options.findIndex(option => option.name === name);
    expect(position('medical')).toBe(0);
    expect(position('aesthetic')).toBeLessThan(position('anesthesiology'));
    expect(position('day_clinic')).toBeLessThan(position('orthodontist'));
    expect(practiceTypeLabel('private_hospital')).toBe('Private hospital (A tariff)');
  });

  // Owner, 14 Oct 2026: plain labels like "Orthodontist" and "Maxillo-facial and oral surgeon". Two NAMAF lists that sit
  // beside each other (private hospital A and B tariff, day clinic 076 and 077) must be told apart by their words, or a
  // practice would pick the wrong one.
  it('name the dental specialists plainly and tell the neighbouring lists apart', () => {
    const rows = more.map(([name]) => ({ id: `id-${name}`, name, is_active: true }));
    const labels = Object.fromEntries(practiceTypeOptions(rows).map(option => [option.name, option.label]));
    expect(labels).toMatchObject({
      orthodontist: 'Orthodontist',
      maxillofacial_oral_surgeon: 'Maxillo-facial and oral surgeon',
      prosthodontist: 'Prosthodontist',
      periodontist: 'Periodontist (oral medicine)',
      dental_therapist: 'Dental therapist',
      private_hospital_b: 'Private hospital (B tariff)',
      day_clinic_077: 'Day clinic (NAMAF list 077)'
    });
    expect(new Set([...Object.values(labels), practiceTypeLabel('private_hospital'), practiceTypeLabel('day_clinic')]).size).toBe(more.length + 2);
    // Staff read words, never the database name
    Object.values(labels).forEach(label => expect(label).not.toMatch(/_/));
  });
});
