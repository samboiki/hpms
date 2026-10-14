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

describe("the practice types' NAMAF disciplines", () => {
  it('are the same in the app and in the migration, so a practice bills from the same list before and after it runs', () => {
    expect(links.length).toBeGreaterThanOrEqual(28);
    expect(Object.fromEntries(links)).toEqual(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE);
  });

  it('give every added practice type a discipline, and no discipline twice for one type', () => {
    expect(inserted).toHaveLength(11);
    const names = links.map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
    inserted.forEach(name => expect(names).toContain(name));
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
      'Private hospital',
      'Day clinic'
    ]);
    // The order the practice administrator already knew does not change: the old types first, the added ones after
    const position = (name: string) => options.findIndex(option => option.name === name);
    expect(position('medical')).toBe(0);
    expect(position('aesthetic')).toBeLessThan(position('anesthesiology'));
    expect(practiceTypeLabel('private_hospital')).toBe('Private hospital');
  });
});
