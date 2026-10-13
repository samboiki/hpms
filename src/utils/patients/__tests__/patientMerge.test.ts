import { describe, expect, it } from 'vitest';
import { describeRecordCounts, parseAddedRecords, suggestKeptFile } from '../patientMerge';

// The merge record counts rows per database table; an administrator reads "12 visits, 8 invoices", never
// "invoices_enhanced", and a table added later must not show its database name either.
describe('describeRecordCounts', () => {
  it('names what reception knows first, in plain words with singular and plural', () => {
    expect(describeRecordCounts({ receipts: 1, invoices_enhanced: 8, visits: 12 })).toBe('12 visits, 8 invoices and 1 receipt');
  });

  it('counts the rest together as other records', () => {
    expect(describeRecordCounts({ visits: 2, invoices_enhanced: 1, receipts: 1, batch_details: 3, patient_notes: 4, practice_sms_logs: 5 })).toBe(
      '2 visits, 1 invoice, 1 receipt, 3 claim lines and 9 other records'
    );
  });

  it('never shows a database name: an unknown table is a record', () => {
    expect(describeRecordCounts({ some_new_table: 2 })).toBe('2 records');
    expect(describeRecordCounts({ visits: 1, some_new_table: 1 })).toBe('1 visit and 1 other record');
  });

  it('says nothing moved when nothing did', () => {
    expect(describeRecordCounts({})).toBe('nothing');
    expect(describeRecordCounts(null)).toBe('nothing');
  });
});

// The suggestion is the file that stays: keeping the one with the history moves fewer rows and keeps the reference
// that claims and statements already carry.
describe('suggestKeptFile', () => {
  const a = { id: 'a', id_number: '90051400123', system_patient_reference_number: 900 };
  const b = { id: 'b', id_number: '90051400999', system_patient_reference_number: 12 };

  it('suggests the file with more visits, invoices and claims', () => {
    const counts = new Map([
      ['a', { visits: 9, invoices: 7, claims: 4 }],
      ['b', { visits: 1, invoices: 0, claims: 0 }]
    ]);
    expect(suggestKeptFile(a, b, counts)).toBe('a');
  });

  it("prefers a complete file over a caller's temporary file when the history is equal", () => {
    const temporary = { id: 't', id_number: 'TEMP-1728000000000-abc123xyz', system_patient_reference_number: 1 };
    expect(suggestKeptFile(temporary, a, new Map())).toBe('a');
  });

  it('otherwise suggests the older file (lower OneHealth reference)', () => {
    expect(suggestKeptFile(a, b, null)).toBe('b');
  });
});

// An undo refused because the kept file changed says what was added, so the administrator knows why.
describe('parseAddedRecords', () => {
  it('reads the counts the database sends with the refusal', () => {
    expect(parseAddedRecords('{"visits": 1, "practice_sms_logs": 2}')).toEqual({ visits: 1, practice_sms_logs: 2 });
  });

  it('gives null for anything else', () => {
    expect(parseAddedRecords(undefined)).toBeNull();
    expect(parseAddedRecords('not json')).toBeNull();
    expect(parseAddedRecords('[1]')).toBeNull();
    expect(parseAddedRecords('{"visits": 0}')).toBeNull();
  });
});
