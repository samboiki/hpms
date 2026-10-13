import { describe, expect, it } from 'vitest';
import {
  LEGACY_RECORDS_BUCKET,
  RECORDS_BUCKET,
  RECORD_LINK_SECONDS,
  RecordPathError,
  bucketOf,
  isRecordPath,
  recordPath,
  storedFileTarget
} from '../recordPaths';

// Invented ids
const PRACTICE_A = '1a2b3c4d-0000-4000-8000-00000000000a';
const PRACTICE_B = '1a2b3c4d-0000-4000-8000-00000000000b';
const PATIENT = '5e6f7a8b-0000-4000-8000-000000000001';

// The storage rules (proposals/2026-10-08-records-bucket.sql) let a practice's staff reach a file only when the
// first folder of its path is their practice: a record stored anywhere else is lost to them, or open to another
// practice.
describe('where a record is stored', () => {
  it('always starts with the practice the record belongs to', () => {
    expect(recordPath(PRACTICE_A, 'invoices', 'invoice_INV-1_1.pdf')).toBe(`${PRACTICE_A}/invoices/invoice_INV-1_1.pdf`);
    expect(recordPath(PRACTICE_A, 'lab-results', PATIENT, '1_report.pdf').split('/')[0]).toBe(PRACTICE_A);
  });

  it('writes the practice id in small letters, as the database compares it', () => {
    expect(recordPath(PRACTICE_A.toUpperCase(), 'invoices', 'x.pdf').startsWith(`${PRACTICE_A}/`)).toBe(true);
  });

  it('refuses a record whose practice is not known, instead of storing it where nobody can open it', () => {
    for (const practice of [null, undefined, '', 'practice-a', `${PRACTICE_A}/x`]) {
      expect(() => recordPath(practice, 'prescriptions', 'x.pdf')).toThrow(RecordPathError);
    }
  });

  it('keeps a crafted file name inside the practice folder', () => {
    const path = recordPath(PRACTICE_A, 'patient-documents', PATIENT, `../../${PRACTICE_B}/stolen.pdf`);
    expect(path.split('/')).toHaveLength(4);
    expect(path.startsWith(`${PRACTICE_A}/patient-documents/${PATIENT}/`)).toBe(true);
    expect(path.split('/').some(part => part === '..' || part === '.')).toBe(false);
    expect(recordPath(PRACTICE_A, 'invoices', '..')).toBe(`${PRACTICE_A}/invoices/_`);
  });

  it('turns characters the storage server rejects into "_" and keeps ordinary names readable', () => {
    expect(recordPath(PRACTICE_A, 'practice-documents', '1_Licence (2026).pdf')).toBe(`${PRACTICE_A}/practice-documents/1_Licence (2026).pdf`);
    expect(recordPath(PRACTICE_A, 'practice-documents', 'Café #1?.pdf')).toBe(`${PRACTICE_A}/practice-documents/Cafe _1_.pdf`);
  });

  it('refuses a record without a file name', () => {
    expect(() => recordPath(PRACTICE_A, 'invoices', ' ', '')).toThrow(RecordPathError);
  });
});

// Rows written before 2026-10-08 point at the public bucket and keep working until the move script repoints them:
// reading a new path from the old bucket (or an old one from the new bucket) would show "file not found".
describe('telling new paths from paths written before the move', () => {
  it('knows a path this version wrote', () => {
    expect(isRecordPath(`${PRACTICE_A}/invoices/x.pdf`)).toBe(true);
    expect(bucketOf(`${PRACTICE_A}/patient-documents/${PATIENT}/x.pdf`)).toBe(RECORDS_BUCKET);
  });

  it('reads the old folders from the old bucket: invoices/, a patient folder, a practice\'s documents/', () => {
    expect(bucketOf('invoices/invoice_INV-1_1.pdf')).toBe(LEGACY_RECORDS_BUCKET);
    expect(bucketOf(`${PATIENT}/1_abc.pdf`)).toBe(LEGACY_RECORDS_BUCKET);
    expect(bucketOf(`${PRACTICE_A}/documents/1_licence.pdf`)).toBe(LEGACY_RECORDS_BUCKET);
  });

  it('trusts the row\'s own bucket column when it has one', () => {
    expect(bucketOf(`${PATIENT}/1_abc.png`, 'documents')).toBe('documents');
    expect(bucketOf(`${PRACTICE_A}/patient-media/${PATIENT}/1.png`, RECORDS_BUCKET)).toBe(RECORDS_BUCKET);
  });
});

describe('links saved in rows before the move', () => {
  const storage = 'https://project.supabase.co/storage/v1/object';

  it('opens an old public link as it is: it keeps working until its file is moved', () => {
    const link = `${storage}/public/documents/timesheets/u/1_2026-09.pdf`;
    expect(storedFileTarget(link)).toEqual({ link });
  });

  it('signs an old signed link again, because its token has expired', () => {
    expect(storedFileTarget(`${storage}/sign/documents/lab-results/${PATIENT}/1_Lab%20report.pdf?token=old`)).toEqual({
      bucket: 'documents',
      path: `lab-results/${PATIENT}/1_Lab report.pdf`
    });
  });

  it('never opens a "public" link into the private bucket (it cannot work): the file is signed instead', () => {
    expect(storedFileTarget(`${storage}/public/records/${PRACTICE_A}/invoices/x.pdf`)).toEqual({
      bucket: RECORDS_BUCKET,
      path: `${PRACTICE_A}/invoices/x.pdf`
    });
  });

  it('signs a stored path from the bucket it is in', () => {
    expect(storedFileTarget(`${PRACTICE_A}/timesheets/u/x.pdf`)).toEqual({ bucket: RECORDS_BUCKET, path: `${PRACTICE_A}/timesheets/u/x.pdf` });
    expect(storedFileTarget('prescriptions/prescription_v_1.pdf')).toEqual({ bucket: 'documents', path: 'prescriptions/prescription_v_1.pdf' });
  });
});

// A forwarded or leaked link must stop working within minutes, but last long enough to load and print the file
it('makes links that last minutes, not hours', () => {
  expect(RECORD_LINK_SECONDS).toBeGreaterThanOrEqual(60);
  expect(RECORD_LINK_SECONDS).toBeLessThanOrEqual(15 * 60);
});
