import { describe, expect, it } from 'vitest';
import { LARGEST_GROUP, findDuplicatePairs, withoutFile, type PracticeFile } from '../duplicatePairs';

// Invented people. The finder offers an administrator pairs to merge: every pair it misses keeps a split history (an
// allergy on one file, the invoices on the other), every false pair costs a careful look, so both directions matter.
let next = 0;
const file = (overrides: Partial<PracticeFile>): PracticeFile => {
  next += 1;
  return {
    id: `p${next}`,
    first_name: 'Ndapewa',
    last_name: 'Shilongo',
    id_number: `9005140${String(next).padStart(4, '0')}`,
    date_of_birth: '1990-05-14',
    cell_number: null,
    system_patient_reference_number: next,
    medical_aid_details: [],
    ...overrides
  };
};

const reasonsOf = (files: PracticeFile[]) => findDuplicatePairs(files).map(pair => ({ ids: pair.files.map(f => f.id), reasons: pair.reasons }));

describe('findDuplicatePairs', () => {
  it('pairs two files with the same ID number however it was spaced, first in the list', () => {
    const a = file({ id_number: '90051400123', first_name: 'Maria', date_of_birth: '1991-01-01' });
    const b = file({ id_number: '9005 1400 123', last_name: 'Nghifikwa', date_of_birth: '1992-02-02' });
    const c = file({ first_name: 'Tangeni', date_of_birth: '1980-03-03', cell_number: '0811234567' });
    const d = file({ first_name: 'Tangeni', date_of_birth: '1980-03-03', cell_number: '+264 81 123 4567' });
    expect(reasonsOf([c, d, a, b])).toEqual([
      { ids: [a.id, b.id], reasons: ['id_number'] },
      { ids: [c.id, d.id], reasons: ['name_and_birth_date', 'name_and_cell'] }
    ]);
  });

  it('pairs the same name and birthday, names typed the wrong way round included', () => {
    const a = file({});
    const b = file({ first_name: 'Shilongo', last_name: 'Ndapewa' });
    expect(reasonsOf([a, b])).toEqual([{ ids: [a.id, b.id], reasons: ['name_and_birth_date'] }]);
  });

  it("pairs a caller's temporary file with their full file by name and cell, never by the placeholder birthday", () => {
    const full = file({ cell_number: '081 123 4567' });
    const temporary = file({ id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', cell_number: '+264811234567' });
    const otherTemporary = file({ id_number: 'TEMP-1728000000001-def456uvw', first_name: 'Maria', date_of_birth: '1990-01-01', cell_number: '0851112222' });
    expect(reasonsOf([full, temporary, otherTemporary])).toEqual([{ ids: [full.id, temporary.id], reasons: ['name_and_cell'] }]);
  });

  it('pairs the same membership (fund, number, dependant code) even when the surname changed', () => {
    const fund = { medical_aid_provider_id: 'fund-psemas', provider: 'PSEMAS', membership_number: '00123456', dependant_code: '01' };
    const a = file({ medical_aid_details: [fund] });
    const b = file({ last_name: 'Nghifikwa', date_of_birth: '1990-05-15', medical_aid_details: [{ ...fund, membership_number: '123456' }] });
    expect(reasonsOf([a, b])).toEqual([{ ids: [a.id, b.id], reasons: ['membership'] }]);
  });

  it('does not pair family members on one membership number (another dependant code, name and birthday)', () => {
    const fund = { medical_aid_provider_id: 'fund-psemas', provider: 'PSEMAS', membership_number: '00123456' };
    const parent = file({ first_name: 'Johannes', date_of_birth: '1965-02-02', medical_aid_details: [{ ...fund, dependant_code: '00' }] });
    const child = file({ first_name: 'Tangeni', date_of_birth: '2015-03-02', medical_aid_details: [{ ...fund, dependant_code: null }] });
    expect(findDuplicatePairs([parent, child])).toEqual([]);
  });

  it('does not pair a family sharing a cell number, nor namesakes born on other days', () => {
    const mother = file({ first_name: 'Maria', date_of_birth: '1965-02-02', cell_number: '0811234567' });
    const son = file({ first_name: 'Tangeni', date_of_birth: '1995-02-02', cell_number: '0811234567' });
    const namesake = file({ date_of_birth: '1975-07-07' });
    const another = file({ date_of_birth: '1999-09-09' });
    expect(findDuplicatePairs([mother, son, namesake, another])).toEqual([]);
  });

  it('leaves out a fact shared by many files (a number typed everywhere is no sign of one person)', () => {
    const many = Array.from({ length: LARGEST_GROUP + 1 }, (_, index) =>
      file({ first_name: 'Baby', last_name: 'Shilongo', date_of_birth: `2020-01-${String(index + 1).padStart(2, '0')}`, cell_number: '0610000000' })
    );
    expect(findDuplicatePairs(many)).toEqual([]);
  });

  it('lists each pair once with every reason, the older file (lower reference) first', () => {
    const newer = file({ system_patient_reference_number: 900, cell_number: '0811234567' });
    const older = file({ system_patient_reference_number: 12, cell_number: '0811234567' });
    const pairs = findDuplicatePairs([newer, older]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].files.map(f => f.id)).toEqual([older.id, newer.id]);
    expect(pairs[0].reasons).toEqual(['name_and_birth_date', 'name_and_cell']);
  });
});

describe('withoutFile', () => {
  it('drops every pair with the file a merge archived', () => {
    const a = file({});
    const b = file({});
    const c = file({ first_name: 'Maria', date_of_birth: '1970-01-01', id_number: '70010100111' });
    const d = file({ first_name: 'Maria', date_of_birth: '1970-01-01', id_number: '70010100222' });
    const pairs = findDuplicatePairs([a, b, c, d]);
    expect(withoutFile(pairs, b.id).map(pair => pair.files.map(f => f.id))).toEqual([[c.id, d.id]]);
  });
});
