import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSENTS_FOLDER, consentPdfPath } from '../patientConsentsService';

const SQL = readFileSync('proposals/2026-10-13-consent-files-locked.sql', 'utf8');
const PRACTICE = '11111111-1111-4111-8111-111111111111';
const PATIENT = '22222222-2222-4222-8222-222222222222';

// The storage rules protect a folder by its place in the path; if the app stored consents anywhere else, a signed
// consent (a legal record) could be deleted or replaced by any staff member of the practice
describe('signed consent PDFs are stored where the storage rules lock them', () => {
  it('stores every PDF in the patient documents consents folder that the policies name', () => {
    const parts = consentPdfPath(PRACTICE, PATIENT, '2026-10-13', 'abc123').split('/');
    expect(parts).toEqual([PRACTICE, 'patient-documents', PATIENT, CONSENTS_FOLDER, 'consent-2026-10-13-abc123.pdf']);
    // split_part is 1-based: segment 2 is parts[1], segment 4 is parts[3]
    const folder = "bucket_id = 'records' AND split_part(name, '/', 2) = 'patient-documents' AND split_part(name, '/', 4) = 'consents'";
    expect(SQL.split(folder).length - 1).toBe(3);
  });

  it('locks the folder with RESTRICTIVE policies for deleting and for changing or moving, never for uploading or reading', () => {
    expect(SQL).toMatch(/CREATE POLICY records_consents_no_delete ON storage\.objects AS RESTRICTIVE FOR DELETE TO public/);
    expect(SQL).toMatch(/CREATE POLICY records_consents_no_update ON storage\.objects AS RESTRICTIVE FOR UPDATE TO public/);
    expect(SQL).not.toMatch(/AS RESTRICTIVE FOR (INSERT|SELECT|ALL)/);
    expect(SQL).not.toMatch(/(DROP|ALTER) POLICY (IF EXISTS )?records_staff_/);
  });

  it('records a consent only with its PDF in that folder, in the table and in the function', () => {
    expect(SQL).toContain("AND split_part(file_path, '/', 2) = 'patient-documents' AND split_part(file_path, '/', 4) = 'consents'");
    expect(SQL).toContain("OR split_part(v_path, '/', 2) <> 'patient-documents' OR split_part(v_path, '/', 4) <> 'consents'");
  });
});
