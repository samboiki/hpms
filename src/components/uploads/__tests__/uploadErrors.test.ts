import { describe, expect, it } from 'vitest';
import { RECORD_NOT_SET_UP, RECORD_SAVE_FAILED, recordSaveError } from '../uploadErrors';

describe("what staff read when a file cannot be kept on a patient's record", () => {
  // "Column not found in table patient_media. This might be a schema mismatch issue." and "Database insert failed: ..."
  // reached the lab and imaging tabs as they were
  it('says the record cannot keep files of this kind yet when its column or table is missing', () => {
    for (const code of ['PGRST204', '42703', '42P01', 'PGRST205']) expect(recordSaveError({ code })).toBe(RECORD_NOT_SET_UP);
  });

  it('asks to try again for any other failure, never repeating the database text', () => {
    expect(recordSaveError({ code: '42501' })).toBe(RECORD_SAVE_FAILED);
    expect(recordSaveError(null)).toBe(RECORD_SAVE_FAILED);
    expect(RECORD_SAVE_FAILED).not.toMatch(/database|schema|insert|column/i);
  });
});
