import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), bucket: '' }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    storage: {
      from: (bucket: string) => {
        storage.bucket = bucket;
        return { upload: storage.upload, remove: storage.remove };
      }
    }
  }
}));
// The PDF itself is drawn elsewhere (letterPdf.ts, tested there): here a few invented bytes stand for it
const PDF_BYTES = new TextEncoder().encode('%PDF-1.3 invented consent');
vi.mock('../../components/letters/letterPdf', () => ({
  renderLetterPdf: () => ({ output: () => PDF_BYTES.slice().buffer })
}));

import { ConsentsNotSetUpError, recordConsent, sha256Hex, toConsentRecord, type NewConsent } from '../patientConsentsService';
import type { LetterDocument } from '../../utils/clinical/letters';

const PRACTICE = '11111111-1111-4111-8111-111111111111';
const consent: NewConsent = {
  practiceId: PRACTICE,
  patientId: '22222222-2222-4222-8222-222222222222',
  visitId: null,
  templateId: 'template-1',
  document: { recordTitle: 'Consent to treatment' } as LetterDocument,
  signedBy: 'patient',
  signerName: 'Maria Example',
  dateKey: '2026-10-13'
};

beforeEach(() => {
  storage.upload.mockReset().mockResolvedValue({ data: { path: 'x' }, error: null });
  storage.remove.mockReset().mockResolvedValue({ data: [], error: null });
  rpc.mockReset();
});

describe('keeping a signed consent form', () => {
  it("stores the PDF in the practice's patient documents, then records it with its size and SHA-256", async () => {
    rpc.mockResolvedValue({ data: 'consent-1', error: null });
    await expect(recordConsent(consent)).resolves.toBe('consent-1');
    expect(storage.bucket).toBe('records');
    const [path] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${PRACTICE}/patient-documents/${consent.patientId}/consents/consent-2026-10-13-[a-z0-9]+\\.pdf$`));
    expect(storage.upload.mock.calls[0][2]).toEqual({ contentType: 'application/pdf', upsert: false });
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('record_patient_consent');
    expect(args).toMatchObject({
      p_file_path: path,
      p_file_size: PDF_BYTES.byteLength,
      p_file_sha256: createHash('sha256').update(PDF_BYTES).digest('hex'),
      p_title: 'Consent to treatment',
      p_signed_by: 'patient'
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('takes the PDF out again when the form cannot be recorded, so no unrecorded consent lies in the documents', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'This visit is not one of the patient\'s visits at your practice.' } });
    await expect(recordConsent(consent)).rejects.toThrow("This visit is not one of the patient's visits at your practice.");
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]]);
  });

  it('records nothing when the PDF could not be stored', async () => {
    storage.upload.mockResolvedValue({ data: null, error: { message: 'Storage is full' } });
    await expect(recordConsent(consent)).rejects.toThrow(/could not be saved/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('says "not set up yet" before the consent forms exist', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.record_patient_consent' } });
    await expect(recordConsent(consent)).rejects.toBeInstanceOf(ConsentsNotSetUpError);
  });

  it('computes the same SHA-256 as Node, so a copy can be checked against what was signed', async () => {
    await expect(sha256Hex(PDF_BYTES)).resolves.toBe(createHash('sha256').update(PDF_BYTES).digest('hex'));
  });

  it('reads a record with who witnessed it, and treats an unknown signer kind as the patient', () => {
    const record = toConsentRecord({
      id: 'c1',
      patient_id: 'p1',
      visit_id: null,
      template_id: null,
      title: 'Consent to treatment',
      signed_by: 'parent_or_guardian',
      signer_name: 'Anna Example',
      file_path: 'x.pdf',
      file_sha256: 'ab',
      file_size: 10,
      signed_at: '2026-10-13T08:42:00Z',
      obtained: [{ full_name: 'Dr A Example' }]
    });
    expect(record).toMatchObject({ signedBy: 'parent_or_guardian', obtainedByName: 'Dr A Example', document: null });
    expect(toConsentRecord({ id: 'c2', signed_by: 'friend' }).signedBy).toBe('patient');
  });
});
