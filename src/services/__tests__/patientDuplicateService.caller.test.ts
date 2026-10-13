import { beforeEach, describe, expect, it, vi } from 'vitest';

// All people and numbers are invented
type Filters = Array<[string, string, string]>;
const db = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; filters: Filters }>,
  // The rows a query with these filters returns
  rowsFor: (() => []) as (filters: Filters, table: string) => unknown[]
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Array<[string, string, string]> = [];
      db.calls.push({ table, filters });
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (column: string, value: string) => {
          filters.push(['eq', column, value]);
          return chain;
        },
        ilike: (column: string, value: string) => {
          filters.push(['ilike', column, value]);
          return chain;
        },
        in: (column: string, values: string[]) => {
          filters.push(['in', column, values.join(',')]);
          return chain;
        },
        limit: () => chain,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: db.rowsFor(filters, table), error: null }).then(resolve)
      };
      return chain;
    }
  }
}));

import { findPracticeDuplicates, findPracticeDuplicatesForCaller } from '../patientDuplicateService';

const file = { id: 'p1', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: '90051400123', date_of_birth: '1990-05-14', cell_number: '+264 81 123 4567' };

beforeEach(() => {
  db.calls = [];
  db.rowsFor = () => [];
});

describe('findPracticeDuplicatesForCaller', () => {
  it("reads only the practice's own patients (another practice's files are never offered)", async () => {
    await findPracticeDuplicatesForCaller('practice-1', { firstName: 'Ndapewa', lastName: 'Shilongo', cellNumber: '081 123 4567' });
    expect(db.calls.length).toBeGreaterThan(0);
    for (const call of db.calls) expect(call.filters).toContainEqual(['eq', 'practice_id', 'practice-1']);
  });

  it('looks numbers up by their last four digits, so a number saved as +264 81 123 4567 is found from 081 123 4567', async () => {
    db.rowsFor = filters => (filters.some(([kind, column, value]) => kind === 'ilike' && column === 'cell_number' && value === '%4567%') ? [file] : []);
    const matches = await findPracticeDuplicatesForCaller('practice-1', { firstName: 'Tangeni', lastName: 'Nangolo', cellNumber: '081 123 4567' });
    expect(matches).toEqual([{ patient: file, reasons: ['cell_number'] }]);
  });

  it('treats a typed % or _ as part of the name, not as a wildcard that lists every patient', async () => {
    await findPracticeDuplicatesForCaller('practice-1', { firstName: 'Ndapewa', lastName: '%', cellNumber: '' });
    const patterns = db.calls.flatMap(call => call.filters.filter(([kind]) => kind === 'ilike').map(([, , value]) => value));
    expect(patterns).not.toContain('%%%');
  });
});

// Registering a caller in full: their temporary file (placeholder birthday) is found by the cell number, so the person
// keeps one file and their booking is not left on an incomplete one.
describe('findPracticeDuplicates: temporary files', () => {
  const temporary = { id: 't1', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', cell_number: '+264 81 123 4567' };
  const registration = { firstName: 'Ndapewa', lastName: 'Shilongo', idNumber: '85030200123', dateOfBirth: '1985-03-02', cellNumber: '081 123 4567' };

  it("reads only this practice's temporary files with the same last four digits", async () => {
    await findPracticeDuplicates('practice-1', registration);
    const temporaryQuery = db.calls.find(call => call.filters.some(([kind, column]) => kind === 'ilike' && column === 'id_number'));
    expect(temporaryQuery?.filters).toEqual(
      expect.arrayContaining([['eq', 'practice_id', 'practice-1'], ['ilike', 'id_number', 'TEMP-%'], ['ilike', 'cell_number', '%4567%']])
    );
  });

  it('offers the temporary file although its birthday differs from the one typed', async () => {
    db.rowsFor = filters => (filters.some(([kind, column]) => kind === 'ilike' && column === 'id_number') ? [temporary] : []);
    const matches = await findPracticeDuplicates('practice-1', registration);
    expect(matches).toEqual([{ patient: temporary, reasons: ['temporary_file'] }]);
  });
});

// Registering someone with an old file number or a medical aid membership: the files that already carry it are read,
// only from this practice (an archived, merged-away file has no practice and is never offered).
describe('findPracticeDuplicates: old file number and membership', () => {
  const registration = {
    firstName: 'Ndapewa',
    lastName: 'Shilongo',
    idNumber: '90051400123',
    dateOfBirth: '1990-05-14',
    cellNumber: null,
    oldFileNumber: 'A-0012345',
    membership: { fundId: 'fund-nmc', fundName: 'Namibia Medical Care', number: '012 345 678', dependantCode: '' }
  };

  it("reads only this practice's files, by the last digits of each number", async () => {
    await findPracticeDuplicates('practice-1', registration);
    const byOldNumber = db.calls.find(call => call.filters.some(([, column]) => column === 'legacy_account_number'));
    expect(byOldNumber?.filters).toEqual(expect.arrayContaining([['eq', 'practice_id', 'practice-1'], ['ilike', 'legacy_account_number', '%2345%']]));
    const byMembership = db.calls.find(call => call.table === 'medical_aid_details');
    expect(byMembership?.filters).toEqual(expect.arrayContaining([['eq', 'patient.practice_id', 'practice-1'], ['ilike', 'membership_number', '%5678%']]));
  });

  it('offers a file found by membership with both reasons it matched, once', async () => {
    // Another ID number and surname; the old file number written differently ("a-0012 345" is "A-0012345")
    const member = { ...file, id: 'p-member', id_number: '90051499999', last_name: 'Nghifikwa', date_of_birth: '1990-05-15', legacy_account_number: 'a-0012 345' };
    db.rowsFor = (filters, table) => {
      if (table === 'medical_aid_details') {
        return [{ medical_aid_provider_id: 'fund-nmc', provider: 'Namibia Medical Care', membership_number: '12345678', dependant_code: null, patient: member }];
      }
      return filters.some(([, column]) => column === 'legacy_account_number') ? [member] : [];
    };
    const matches = await findPracticeDuplicates('practice-1', registration);
    expect(matches).toHaveLength(1);
    expect(matches[0].patient.id).toBe('p-member');
    expect(matches[0].reasons).toEqual(['membership', 'old_file_number']);
  });

  it('looks up neither when reception typed none', async () => {
    await findPracticeDuplicates('practice-1', { ...registration, oldFileNumber: '', membership: null });
    expect(db.calls.some(call => call.table === 'medical_aid_details')).toBe(false);
    expect(db.calls.some(call => call.filters.some(([, column]) => column === 'legacy_account_number'))).toBe(false);
  });
});
