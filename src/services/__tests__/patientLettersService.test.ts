import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));
const comms = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock('../communicationService', () => ({
  communicationService: comms,
  getCommunicationErrorMessage: (_channel: string, error?: string) => `Not sent: ${error ?? 'unknown'}`
}));
vi.mock('../../components/quotes/quoteService', () => ({
  loadLetterhead: async () => ({
    id: 'practice-1',
    name: 'Example Family Practice',
    contactPhone: null,
    contactEmail: null,
    address: null,
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: null,
    practiceNumber: null,
    licenseNumber: null,
    taxNumber: null,
    primaryColor: null,
    bankName: null,
    accountNumber: null,
    branchCode: null
  })
}));
const safety = vi.hoisted(() => ({ loadPatientSafety: vi.fn() }));
vi.mock('../patientSafetyService', () => ({
  loadPatientSafety: safety.loadPatientSafety,
  isSafetyNotSetUp: (error: unknown) => (error as { notSetUp?: boolean } | null)?.notSetUp === true
}));
vi.mock('../../components/letters/letterPdf', () => ({
  renderLetterPdf: () => ({}),
  letterPdfBase64: () => 'BASE64PDF'
}));

import { emailLetter, isLettersNotSetUp, loadLetterContext } from '../patientLettersService';
import type { LetterDocument } from '../../utils/clinical/letters';

/** A thenable query that resolves to `result` whatever filters are chained */
const query = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'gte', 'order', 'update']) chain[name] = vi.fn(() => chain);
  chain.single = async () => result;
  chain.maybeSingle = async () => result;
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
};

const documentOf = (overrides: Partial<LetterDocument> = {}): LetterDocument =>
  ({
    kind: 'referral',
    fileName: 'referral-x.pdf',
    recordTitle: 'Referral to Dr M Example',
    email: { subject: 'Referral: Ndapewa Shilongo', text: 'Good day', html: '<p>Good day</p>' },
    ...overrides
  }) as LetterDocument;

afterEach(() => {
  supabaseMock.from.mockReset();
  comms.sendEmail.mockReset();
  safety.loadPatientSafety.mockReset();
});

describe('emailLetter', () => {
  it('sends the letter as a PDF through the centralized email gateway and notes it on the letter', async () => {
    comms.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    const update = query({ error: null });
    supabaseMock.from.mockReturnValue(update);
    const result = await emailLetter({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      visitId: 'visit-1',
      document: documentOf(),
      to: ' specialist@example.test ',
      recipientName: 'Dr M Example',
      letterId: 'letter-1'
    });
    expect(result).toEqual({ ok: true, message: 'Emailed to specialist@example.test.' });
    expect(comms.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: 'practice-1',
        recipientEmail: 'specialist@example.test',
        subject: 'Referral: Ndapewa Shilongo',
        emailType: 'report',
        patientId: 'patient-1',
        attachments: [{ filename: 'referral-x.pdf', content: 'BASE64PDF', type: 'application/pdf' }]
      })
    );
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ sent_via: 'email', sent_to: 'specialist@example.test' }));
  });

  it('never calls the gateway with an incomplete address', async () => {
    const result = await emailLetter({ practiceId: 'p', patientId: 'x', visitId: null, document: documentOf(), to: 'dr@', recipientName: null });
    expect(result.ok).toBe(false);
    expect(comms.sendEmail).not.toHaveBeenCalled();
  });

  it('reports a failed send in plain words and does not mark the letter as sent', async () => {
    comms.sendEmail.mockResolvedValue({ success: false, logId: '', status: 'failed', error: 'limit reached' });
    const result = await emailLetter({ practiceId: 'p', patientId: 'x', visitId: null, document: documentOf(), to: 'a@b.test', recipientName: null, letterId: 'letter-1' });
    expect(result).toEqual({ ok: false, message: 'Not sent: limit reached' });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});

describe('loadLetterContext', () => {
  const tables = (overrides: Record<string, unknown> = {}) => {
    const results: Record<string, unknown> = {
      users: { data: { full_name: 'Dr A Example', job_title: 'General practitioner', hpcsa_number: 'MP 00000' }, error: null },
      patients: { data: { first_name: 'Ndapewa', last_name: 'Shilongo', date_of_birth: '1990-05-14', id_number: '90051400123', email: 'patient@example.test' }, error: null },
      visits: { data: { visit_date: '2026-10-06T00:00:00', diagnosis: 'HPT I10' }, error: null },
      medications: {
        data: [
          { medication_name: 'Amlodipine', dosage: '10 mg', frequency: 'once daily' },
          { medication_name: 'amlodipine', dosage: '5 mg', frequency: 'once daily' }
        ],
        error: null
      },
      ...overrides
    };
    supabaseMock.from.mockImplementation((table: string) => query(results[table]));
  };

  it('reads what a letter may say: practitioner, patient, the visit, its medicines once each, and the allergies', async () => {
    tables();
    safety.loadPatientSafety.mockResolvedValue({
      allergies: [{ substance: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis' }],
      profile: null,
      problems: [
        { description: 'Essential (primary) hypertension', icd10Code: 'I10', status: 'active' },
        { description: 'Old fracture', icd10Code: null, status: 'past' }
      ]
    });
    const { context, patientEmail } = await loadLetterContext({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1', authorId: 'user-1', letterDate: '2026-10-07' });
    expect(patientEmail).toBe('patient@example.test');
    expect(context.author).toEqual({ name: 'Dr A Example', title: 'General practitioner', hpcnaNumber: 'MP 00000' });
    expect(context.patient).toEqual({ name: 'Ndapewa Shilongo', dateOfBirth: '1990-05-14', idNumber: '90051400123' });
    expect(context.visitDate).toBe('2026-10-06');
    expect(context.medicines).toEqual(['Amlodipine, 10 mg, once daily']);
    expect(context.allergies).toEqual(['Penicillin (severe: Anaphylaxis)']);
    expect(context.problems).toEqual(['Essential (primary) hypertension (I10)']);
  });

  // {{patientAddress}} on a letter carries the town the town picker keeps apart; a database without that column still
  // writes the letter, with the address alone
  it('puts the town on the address, and still writes the letter before the town column exists', async () => {
    safety.loadPatientSafety.mockResolvedValue({ allergies: [], profile: null, problems: [] });
    const withAddress = { first_name: 'Ndapewa', last_name: 'Shilongo', postal_address: 'PO Box 1', postal_code: '9000' };
    tables({ patients: { data: { ...withAddress, town: 'Windhoek' }, error: null } });
    const loaded = await loadLetterContext({ practiceId: 'practice-1', patientId: 'patient-1', visitId: null, authorId: 'user-1', letterDate: '2026-10-07' });
    expect(loaded.merge.patientAddress).toBe('PO Box 1, Windhoek 9000');

    const answers = [
      { data: null, error: { code: '42703', message: 'column patients.town does not exist' } },
      { data: withAddress, error: null }
    ];
    tables();
    const others = supabaseMock.from.getMockImplementation() as (table: string) => unknown;
    supabaseMock.from.mockImplementation((table: string) => (table === 'patients' ? query(answers.shift()) : others(table)));
    const before = await loadLetterContext({ practiceId: 'practice-1', patientId: 'patient-1', visitId: null, authorId: 'user-1', letterDate: '2026-10-07' });
    expect(before.merge.patientAddress).toBe('PO Box 1 9000');
  });

  it('writes letters before the safety records exist, saying the allergies are not recorded', async () => {
    tables();
    safety.loadPatientSafety.mockRejectedValue({ notSetUp: true });
    const { context } = await loadLetterContext({ practiceId: 'practice-1', patientId: 'patient-1', visitId: null, authorId: 'user-1', letterDate: '2026-10-07' });
    expect(context.allergies).toEqual([]);
    expect(context.noKnownAllergies).toBe(false);
  });
});

describe('isLettersNotSetUp', () => {
  it('recognises the missing letters table, and nothing else', () => {
    expect(isLettersNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.patient_letters' in the schema cache" })).toBe(true);
    expect(isLettersNotSetUp({ code: '42501', message: 'permission denied for table patient_letters' })).toBe(false);
  });
});
