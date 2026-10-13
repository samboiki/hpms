import { describe, expect, it } from 'vitest';
import {
  aboutSection,
  documentExtension,
  documentZipPaths,
  documentsSection,
  recordExportBase,
  recordSections,
  type PatientRecord,
  type RecordDocument
} from '../patientRecord';

// Invented patient and record
const record = (overrides: Partial<PatientRecord> = {}): PatientRecord => ({
  patient: {
    name: 'Maria Example',
    formalName: 'Ms M Example',
    idNumber: '90051400000',
    dateOfBirth: '1990-05-14',
    age: 36,
    gender: 'female',
    fileNumber: '1042',
    oldFileNumber: null,
    cellNumber: '0810000000',
    email: null,
    homeAddress: '  ',
    postalAddress: 'PO Box 1, Windhoek',
    occupation: null,
    employer: null,
    homeLanguage: null,
    maritalStatus: null,
    pregnancyDueDate: '2027-03-14'
  },
  medicalAids: [],
  nextOfKin: [],
  alerts: { allergies: [], noKnownAllergies: true, alertNote: null, activeProblems: ['Asthma (J45)'], pastProblems: [] },
  visits: [
    {
      date: '2026-10-12',
      time: '09:30:00',
      type: 'Consultation',
      status: 'completed',
      practitioner: 'Dr A Example',
      complaint: 'Cough',
      diagnosis: 'Acute bronchitis',
      icd10: ['J20.9'],
      treatmentPlan: null,
      notes: 'Invented note',
      prescription: null,
      vitals: 'BP 120/80'
    }
  ],
  medicines: [],
  labRequests: [],
  labResults: [],
  imaging: [],
  letters: [],
  notes: [],
  privateNotes: null,
  invoices: [{ date: '2026-10-12', number: 'INV-1', total: 1234.5, medicalAid: 1000, patient: 234.5, paid: 234.5, status: 'Paid' }],
  payments: [{ date: '2026-10-12', number: 'R-1', payer: 'Patient', method: 'Card', amount: 234.5, reversed: true }],
  documents: [],
  unavailable: [],
  ...overrides
});

const headings = (r: PatientRecord) => recordSections(r).map(section => section.heading);

describe('the record summary', () => {
  it('reads like a patient file: details, cover, alerts, visits, medicines, results, letters, notes, money', () => {
    expect(headings(record())).toEqual([
      'Patient details',
      'Medical aid',
      'Next of kin',
      'Allergies, alerts and problems',
      'Visits',
      'Medicines',
      'Laboratory results',
      'Imaging',
      'Letters, sick notes and consent forms',
      'Notes on the file',
      'Invoices',
      'Payments'
    ]);
  });

  it('prints only details that are on file, never empty labels', () => {
    const facts = recordSections(record())[0].blocks?.[0].facts ?? [];
    expect(facts.map(item => item.label)).toEqual(['Name', 'Date of birth', 'Gender', 'ID number', 'File number', 'Cell number', 'Postal address', 'Pregnancy due date']);
    expect(facts[0].value).toBe('Maria Example (Ms M Example)');
    expect(facts[1].value).toBe('14 May 1990 (36 years)');
    expect(facts[7].value).toBe('14 Mar 2027');
  });

  it('says plainly whether allergies were checked: none known is not the same as never recorded', () => {
    const allergies = (alerts: PatientRecord['alerts']) => recordSections(record({ alerts }))[3].blocks?.[0].facts[0].value;
    expect(allergies({ allergies: [], noKnownAllergies: true, alertNote: null, activeProblems: [], pastProblems: [] })).toBe('No known allergies');
    expect(allergies({ allergies: [], noKnownAllergies: false, alertNote: null, activeProblems: [], pastProblems: [] })).toBe('None recorded');
    expect(allergies({ allergies: null, noKnownAllergies: false, alertNote: null, activeProblems: [], pastProblems: [] })).toBe('Not recorded on this system');
    expect(allergies({ allergies: ['Penicillin (severe)'], noKnownAllergies: false, alertNote: null, activeProblems: [], pastProblems: [] })).toBe('Penicillin (severe)');
  });

  it('heads each visit with its day, time, type and practitioner, and lists its diagnosis with the ICD-10 billed', () => {
    const visits = recordSections(record())[4];
    expect(visits.blocks?.[0].title).toBe('12 Oct 2026 - 09:30 - Consultation - Dr A Example - completed');
    expect(visits.blocks?.[0].facts).toContainEqual({ label: 'ICD-10', value: 'J20.9' });
  });

  it('shows money in Namibian dollars and marks a reversed payment', () => {
    const sections = recordSections(record());
    expect(sections[10].table?.rows[0]).toEqual(['12 Oct 2026', 'INV-1', 'N$ 1,234.50', 'N$ 1,000.00', 'N$ 234.50', 'N$ 234.50', 'Paid']);
    expect(sections[11].table?.rows[0][4]).toBe('N$ 234.50 (reversed)');
  });

  it('adds private notes only when the practitioner asked for their own, and lab requests only when there are some', () => {
    expect(headings(record({ privateNotes: [] }))).toContain('My private notes');
    expect(headings(record())).not.toContain('My private notes');
    expect(headings(record({ labRequests: [{ date: '2026-10-01', laboratory: 'Example Lab', status: 'pending', notes: null }] }))).toContain(
      'Laboratory requests'
    );
  });
});

describe('the documents in the ZIP', () => {
  const doc = (overrides: Partial<RecordDocument>): RecordDocument => ({
    kind: 'Photo',
    label: 'Rash',
    date: '2026-10-12T08:00:00Z',
    ref: 'practice/patient-media/patient/123_abc.jpg',
    bucket: 'records',
    mimeType: 'image/jpeg',
    ...overrides
  });

  it('names each file by date, kind and label, keeping its extension, so the folder sorts by date', () => {
    expect(documentZipPaths('record-maria-example-2026-10-13', [doc({})])).toEqual(['record-maria-example-2026-10-13/documents/2026-10-12 Photo - Rash.jpg']);
  });

  it('numbers two documents that would share a name instead of losing one', () => {
    const paths = documentZipPaths('r', [doc({}), doc({})]);
    expect(paths).toEqual(['r/documents/2026-10-12 Photo - Rash.jpg', 'r/documents/2026-10-12 Photo - Rash (2).jpg']);
  });

  it('finds the extension in the label, the stored path or the file type', () => {
    expect(documentExtension({ label: 'Scan.PDF', ref: 'x', mimeType: null })).toBe('.pdf');
    expect(documentExtension({ label: 'Scan', ref: 'a/b/c.png?token=1', mimeType: null })).toBe('.png');
    expect(documentExtension({ label: 'Scan', ref: 'a/b/c', mimeType: 'application/pdf' })).toBe('.pdf');
    expect(documentExtension({ label: 'Scan', ref: 'a/b/c', mimeType: null })).toBe('');
  });

  it('keeps a label with slashes or dots inside the documents folder, as one file', () => {
    expect(documentZipPaths('r', [doc({ label: '../../evil', ref: 'x.pdf' })])[0]).toBe('r/documents/2026-10-12 Photo - ..-..-evil.pdf');
    expect(documentZipPaths('r', [doc({ label: 'Referral 1/2', ref: 'x.pdf' })])[0]).toBe('r/documents/2026-10-12 Photo - Referral 1-2.pdf');
  });

  it('lists every stored document with whether it is in the ZIP, or why not', () => {
    const section = documentsSection([doc({}), doc({ label: 'Missing' })], [
      { path: 'r/documents/2026-10-12 Photo - Rash.jpg', problem: null },
      { path: null, problem: 'Could not be fetched' }
    ]);
    expect(section.table?.rows).toEqual([
      ['12 Oct 2026', 'Photo: Rash', '2026-10-12 Photo - Rash.jpg'],
      ['12 Oct 2026', 'Photo: Missing', 'Could not be fetched']
    ]);
    expect(documentsSection([doc({})], null).table?.rows[0][2]).toBe('Not in this export');
  });
});

describe('who made the export', () => {
  it('names the person, the time, what it holds and what could not be read', () => {
    const facts = aboutSection({ exportedBy: 'Dr A Example', exportedAt: '13 October 2026 at 10:42', practiceName: 'Example Practice' }, ['Imaging']).blocks?.[0].facts ?? [];
    expect(facts.map(item => item.label)).toEqual(['Made by', 'Made on', 'What it holds', 'Could not be read']);
    expect(facts[2].value).toMatch(/private notes are never included/);
  });

  it('names the files after the patient and the day', () => {
    expect(recordExportBase('Maria  Ndéyapo Example', '2026-10-13')).toBe('record-maria-nd-yapo-example-2026-10-13');
    expect(recordExportBase('', '2026-10-13')).toBe('record-patient-2026-10-13');
  });
});
