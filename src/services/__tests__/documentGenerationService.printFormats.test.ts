import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentGenerationService } from '../documentGenerationService';

// The owner designed the printed prescription (with the practice logo) and the medical leave form himself (git
// bd02f25) and asked on 15 Oct 2026 for their format to be left alone. These tests pin it; a change needs his request.

const { openRecord, download, storageFrom } = vi.hoisted(() => {
  const download = vi.fn();
  return { openRecord: vi.fn(), download, storageFrom: vi.fn(() => ({ download })) };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), storage: { from: storageFrom }, auth: { getUser: vi.fn() } } }));
vi.mock('../recordFiles', () => ({
  RECORDS_BUCKET: 'records',
  openRecord,
  recordLink: vi.fn(),
  recordPath: (...parts: string[]) => parts.join('/')
}));

// Invented practice, doctor, patient and visit
const practice = {
  id: 'practice-1',
  name: 'Example Practice',
  logo_url: 'https://example.test/logo.png',
  primary_color: '#0e9f8e',
  address: '12 Example Street',
  city: 'Windhoek',
  country: 'Namibia',
  postal_code: '9000',
  contact_phone: '+264 61 000 0000',
  contact_email: 'reception@example.test',
  practice_number: '0000000'
};
const visit = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  visit_date: '2026-10-07',
  patients: { first_name: 'Anna', last_name: 'Example', cell_number: '+264 81 000 0001', email: 'anna@example.test', home_address: '7 Sample Road' },
  users: { full_name: 'Dr A Example', signature_url: null }
};
const medicalAid = { scheme: 'Example Plus', membership_number: 'EX1234567', medical_aid_providers: { name: 'Example Medical Fund', short_name: 'EMF' } };
const medications = [
  { medication_name: 'Amoxicillin 500 mg', dosage: '1 capsule', frequency: 'Three times a day', duration: '5 days', instructions: 'Finish the course' },
  { medication_name: 'Paracetamol 500 mg', dosage: '2 tablets', frequency: 'Every 6 hours when needed', duration: '3 days', instructions: 'No more than 8 a day' }
];
const leaveForm = { form_number: 'LF-000045', from_date: '2026-10-07', to_date: '2026-10-09', diagnosis: 'Acute upper respiratory infection', diagnosis_code: 'J06.9' };

type Templates = {
  createPrescriptionHTML: (...args: unknown[]) => string;
  createLeaveFormHTML: (...args: unknown[]) => string;
};
const templates = () => new DocumentGenerationService() as unknown as Templates;
const compact = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
const textOf = (html: string) => compact(html).replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe("the owner's printed prescription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('is drawn as he designed it (snapshot)', () => {
    expect(compact(templates().createPrescriptionHTML(visit, practice, medications, medicalAid))).toMatchSnapshot();
  });

  // The practice logo exactly where it was: first in the header, above the practice name, on an A5 page
  it('puts the practice logo top left above the practice name, on A5', () => {
    const html = compact(templates().createPrescriptionHTML(visit, practice, medications, medicalAid));
    expect(html).toContain('width: 595px; /* A5 in points */ height: 842px;');
    const logo = html.indexOf('<img src="https://example.test/logo.png"');
    expect(logo).toBeGreaterThan(-1);
    expect(logo).toBeLessThan(html.indexOf('>Example Practice<'));
  });

  it('keeps his sections and wording in order', () => {
    const text = textOf(templates().createPrescriptionHTML(visit, practice, medications, medicalAid));
    const order = [
      'Example Practice',
      'MEDICAL PRESCRIPTION #RX-A1B2C3D4',
      'DATE ISSUED 15 Oct 2026',
      'PREPARED FOR Anna Example',
      'EMF Scheme: Example Plus Member: EX1234567',
      'PRESCRIBED MEDICATIONS',
      'Amoxicillin 500 mg 1 capsule Three times a day 5 days Finish the course',
      'Patient Signature',
      'Dr A Example Prescribing Physician'
    ];
    let from = 0;
    order.forEach(part => {
      const at = text.indexOf(part, from);
      expect(at, part).toBeGreaterThanOrEqual(from);
      from = at + part.length;
    });
  });

  // Added on 13 Oct 2026 and taken off again on the owner's word (listed for him to decide)
  it('prints no allergy line under the patient', () => {
    expect(templates().createPrescriptionHTML(visit, practice, medications, medicalAid)).not.toMatch(/Allerg/i);
  });
});

describe("the owner's medical leave form (sick note)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('is drawn as he designed it (snapshot)', () => {
    expect(compact(templates().createLeaveFormHTML(visit, practice, leaveForm, medicalAid))).toMatchSnapshot();
  });

  it('puts the practice logo top left above the practice name, on A5', () => {
    const html = compact(templates().createLeaveFormHTML(visit, practice, leaveForm, medicalAid));
    expect(html).toContain('width: 595px; /* A5 in points */ height: 842px;');
    const logo = html.indexOf('<img src="https://example.test/logo.png"');
    expect(logo).toBeGreaterThan(-1);
    expect(logo).toBeLessThan(html.indexOf('>Example Practice<'));
  });

  it('keeps his sections and wording in order', () => {
    const text = textOf(templates().createLeaveFormHTML(visit, practice, leaveForm, medicalAid));
    const order = [
      'MEDICAL CERTIFICATE #LF-000045',
      'PREPARED FOR Anna Example',
      'MEDICAL JUSTIFICATION FOR ABSENCE',
      // (the bold words are their own tags, hence the spaces before punctuation)
      'This letter serves to certify that the patient, Anna Example , was examined and treated at our facility on 07 October 2026 .',
      'three ( 3 ) days of sick leave',
      'fit to resume normal duties from 10 October 2026 .',
      'Acute upper respiratory infection (ICD-10: J06.9)',
      'MEDICAL LEAVE PERIOD',
      // (capitals by style)
      'From Date 07 Oct 2026',
      'To Date 09 Oct 2026',
      'Total Days 3 days',
      'Patient Signature',
      'Dr A Example Prescribing Physician'
    ];
    let from = 0;
    order.forEach(part => {
      const at = text.indexOf(part, from);
      expect(at, part).toBeGreaterThanOrEqual(from);
      from = at + part.length;
    });
  });
});

// The Sick notes tab's Print, the visit screen's Print buttons and the Dashboard's visit cards print the same stored
// document in his format
describe('printing a visit document in the owner format', () => {
  const service = () => {
    const made = new DocumentGenerationService();
    const spies = {
      list: vi.spyOn(made, 'getVisitDocuments'),
      generate: vi.spyOn(made, 'generateVisitDocuments')
    };
    return { made, spies };
  };
  const options = { visitId: 'visit-1', patientId: 'patient-1', practiceId: 'practice-1', type: 'leave_form' as const };

  beforeEach(() => openRecord.mockReset());

  it('opens the newest stored leave form of the visit', async () => {
    const { made, spies } = service();
    spies.list.mockResolvedValue([
      { document_type: 'prescription', file_path: 'practice-1/prescriptions/rx.pdf', storage_bucket: 'records' },
      { document_type: 'leave_form', file_path: 'practice-1/leave_forms/new.pdf', storage_bucket: 'records' },
      { document_type: 'leave_form', file_path: 'practice-1/leave_forms/old.pdf', storage_bucket: 'records' }
    ]);

    await expect(made.openVisitDocument(options)).resolves.toBe(true);
    expect(openRecord).toHaveBeenCalledWith('practice-1/leave_forms/new.pdf', 'records');
    expect(spies.generate).not.toHaveBeenCalled();
  });

  it('makes the leave form first when the visit has none stored yet', async () => {
    const { made, spies } = service();
    spies.list.mockResolvedValue([]);
    spies.generate.mockResolvedValue([{ type: 'leave_form', documentName: 'Leave Form', filePath: 'practice-1/leave_forms/made.pdf', fileSize: 10 }]);

    await expect(made.openVisitDocument(options)).resolves.toBe(true);
    expect(spies.generate).toHaveBeenCalledWith({ visitId: 'visit-1', patientId: 'patient-1', practiceId: 'practice-1', documents: ['leave_form'] });
    expect(openRecord).toHaveBeenCalledWith('practice-1/leave_forms/made.pdf', 'records');
  });

  it('says so when there is nothing to print', async () => {
    const { made, spies } = service();
    spies.list.mockResolvedValue([]);
    spies.generate.mockResolvedValue([]);

    await expect(made.openVisitDocument(options)).resolves.toBe(false);
    expect(openRecord).not.toHaveBeenCalled();
  });
});

// An emailed sick note is the owner's leave form too, the same as it prints (owner, 15 Oct 2026): the attachment is the
// stored leave form PDF of the visit, made first when there is none
describe('emailing a visit document in the owner format', () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.3 invented leave form');
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  const service = () => {
    const made = new DocumentGenerationService();
    return { made, list: vi.spyOn(made, 'getVisitDocuments'), generate: vi.spyOn(made, 'generateVisitDocuments') };
  };
  const options = { visitId: 'visit-1', patientId: 'patient-1', practiceId: 'practice-1', type: 'leave_form' as const };

  beforeEach(() => {
    download.mockReset();
    storageFrom.mockClear();
    download.mockResolvedValue({ data: new Blob([pdfBytes], { type: 'application/pdf' }), error: null });
  });

  it("attaches the visit's newest stored leave form", async () => {
    const { made, list, generate } = service();
    list.mockResolvedValue([{ document_type: 'leave_form', file_path: 'practice-1/leave_forms/new.pdf', storage_bucket: 'records' }]);

    await expect(made.visitDocumentBase64(options)).resolves.toBe(base64);
    expect(storageFrom).toHaveBeenCalledWith('records');
    expect(download).toHaveBeenCalledWith('practice-1/leave_forms/new.pdf');
    expect(generate).not.toHaveBeenCalled();
  });

  it('makes the leave form first when none is stored yet', async () => {
    const { made, list, generate } = service();
    list.mockResolvedValue([]);
    generate.mockResolvedValue([{ type: 'leave_form', documentName: 'Leave Form', filePath: 'practice-1/leave_forms/made.pdf', fileSize: 10 }]);

    await expect(made.visitDocumentBase64(options)).resolves.toBe(base64);
    expect(generate).toHaveBeenCalledWith({ visitId: 'visit-1', patientId: 'patient-1', practiceId: 'practice-1', documents: ['leave_form'] });
    expect(download).toHaveBeenCalledWith('practice-1/leave_forms/made.pdf');
  });

  // Sending the letter layout instead would make the emailed note look different from the printed one
  it('says plainly when no leave form can be made, instead of sending something else', async () => {
    const { made, list, generate } = service();
    list.mockResolvedValue([]);
    generate.mockResolvedValue([]);

    await expect(made.visitDocumentBase64(options)).rejects.toThrow('The leave form could not be made. Save the sick note and try again.');
    expect(download).not.toHaveBeenCalled();
  });
});
